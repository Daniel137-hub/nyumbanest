"use server";

import { revalidatePath } from "next/cache";
import type { User } from "@supabase/supabase-js";
import type { PropertyFormValues, SubmissionStatus } from "@/lib/properties";
import { validatePropertyForm } from "@/lib/properties";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IMAGE_PATH_PATTERN = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(?:jpg|png|webp|avif)$/i;
const IMAGE_BUCKET = "property-images";

type UploadedImage = { path: string; altText: string };
type SavePropertyResult =
  | { error: string; propertyId?: never; ownerId?: never }
  | { error: null; propertyId: string; ownerId: string };
type VerifiedAuth =
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; user: User }
  | { ok: false; supabase: Awaited<ReturnType<typeof createClient>>; error: string };

async function getVerifiedUser(): Promise<VerifiedAuth> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { ok: false, supabase, error: "Sign in to manage your listings." } as const;
  if (!user.email_confirmed_at) {
    return { ok: false, supabase, error: "Verify your email before managing property listings." } as const;
  }
  return { ok: true, supabase, user } as const;
}

function validPropertyId(propertyId: string) {
  return UUID_PATTERN.test(propertyId);
}

function validUploadedImages(images: unknown, ownerId: string, propertyId: string): images is UploadedImage[] {
  return Array.isArray(images) && images.length <= 10 && images.every((image) =>
    image && typeof image === "object" &&
    typeof image.path === "string" &&
    IMAGE_PATH_PATTERN.test(image.path) &&
    image.path.startsWith(`${ownerId}/${propertyId}/`) &&
    typeof image.altText === "string" &&
    image.altText.length <= 500
  );
}

async function removeStoragePaths(supabase: Awaited<ReturnType<typeof createClient>>, paths: string[]) {
  if (!paths.length) return null;
  const { error } = await supabase.storage.from(IMAGE_BUCKET).remove(paths);
  return error;
}

export async function saveProperty(
  propertyId: string | null,
  values: PropertyFormValues,
  status: SubmissionStatus,
): Promise<SavePropertyResult> {
  if (status !== "draft" && status !== "pending_review") {
    return { error: "Choose to save a draft or submit the property for review." };
  }
  if (propertyId !== null && !validPropertyId(propertyId)) return { error: "This listing could not be found." };

  let property;
  try {
    property = validatePropertyForm(values);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Check the property details and try again." };
  }

  const auth = await getVerifiedUser();
  if (!auth.ok) return { error: auth.error };

  if (!propertyId) {
    const { data, error } = await auth.supabase.from("properties")
      .insert({ ...property, owner_id: auth.user.id, status })
      .select("id")
      .single();
    if (error) return { error: "We couldn't save this property. Check the details and try again." };
    revalidatePath("/my-listings");
    return { error: null, propertyId: data.id, ownerId: auth.user.id };
  }

  const { data, error } = await auth.supabase.from("properties")
    .update({ ...property, status })
    .eq("id", propertyId)
    .select("id")
    .maybeSingle();
  if (error) return { error: "We couldn't update this property. Check the details and try again." };
  if (!data) return { error: "This listing was not found or you don't have permission to edit it." };
  revalidatePath("/my-listings");
  revalidatePath(`/my-listings/${propertyId}/edit`);
  return { error: null, propertyId: data.id, ownerId: auth.user.id };
}

export async function addPropertyImages(propertyId: string, images: UploadedImage[]) {
  if (!validPropertyId(propertyId)) return { error: "This listing could not be found." };
  const auth = await getVerifiedUser();
  if (!auth.ok) return { error: auth.error };
  if (!validUploadedImages(images, auth.user.id, propertyId)) {
    return { error: "One or more selected images are invalid. Choose the images again." };
  }

  const { data: property, error: propertyError } = await auth.supabase
    .from("properties").select("id").eq("id", propertyId).maybeSingle();
  if (propertyError) return { error: "We couldn't verify listing ownership before saving the images." };
  if (!property) return { error: "This listing was not found or you don't have permission to edit it." };

  const { data: existing, error: imageError } = await auth.supabase.from("property_images")
    .select("sort_order")
    .eq("property_id", propertyId)
    .order("sort_order", { ascending: false })
    .limit(1);
  if (imageError) return { error: "We couldn't check the current listing photos." };
  const firstOrder = existing?.[0]?.sort_order === undefined ? 0 : existing[0].sort_order + 1;
  const { error } = await auth.supabase.from("property_images").insert(images.map((image, index) => ({
    property_id: propertyId,
    storage_path: image.path,
    alt_text: image.altText,
    sort_order: firstOrder + index,
  })));
  if (error) return { error: "The property was saved, but its photos could not be attached." };
  revalidatePath("/my-listings");
  return { error: null };
}

export async function removePropertyUploads(propertyId: string, paths: string[]) {
  if (!validPropertyId(propertyId) || !Array.isArray(paths) || paths.length > 10) {
    return { error: "The uploaded images could not be verified." };
  }
  const auth = await getVerifiedUser();
  if (!auth.ok) return { error: auth.error };
  if (!validUploadedImages(paths.map((path) => ({ path, altText: "" })), auth.user.id, propertyId)) {
    return { error: "The uploaded images could not be verified." };
  }
  const { data: property, error: propertyError } = await auth.supabase.from("properties")
    .select("id").eq("id", propertyId).maybeSingle();
  if (propertyError) return { error: "We couldn't verify listing ownership to clean up photos." };
  if (!property) return { error: "The listing needed to authorize photo cleanup could not be found." };
  const { data: images, error: imageError } = await auth.supabase.from("property_images")
    .select("id,storage_path")
    .eq("property_id", propertyId)
    .in("storage_path", paths);
  if (imageError) return { error: "We couldn't verify uploaded photo records before cleanup." };
  const storageError = await removeStoragePaths(auth.supabase, paths);
  if (storageError) return { error: "Some uploaded photos could not be removed from storage." };
  if (images.length) {
    const { error } = await auth.supabase.from("property_images").delete()
      .eq("property_id", propertyId)
      .in("id", images.map((image) => image.id));
    if (error) return { error: "Photo files were removed, but their listing records could not be cleaned up." };
  }
  return { error: null };
}

export async function rollbackNewProperty(propertyId: string, paths: string[]) {
  if (!validPropertyId(propertyId) || !Array.isArray(paths) || paths.length > 10) {
    return { error: "The new listing could not be cleaned up safely." };
  }
  const auth = await getVerifiedUser();
  if (!auth.ok) return { error: auth.error };
  if (!validUploadedImages(paths.map((path) => ({ path, altText: "" })), auth.user.id, propertyId)) {
    return { error: "The uploaded images could not be verified." };
  }
  const storageError = await removeStoragePaths(auth.supabase, paths);
  if (storageError) return { error: "Uploaded photos could not be removed; the draft was kept so cleanup can be retried." };
  const { error } = await auth.supabase.from("properties").delete().eq("id", propertyId);
  if (error) return { error: "Photos were removed, but the empty draft could not be deleted." };
  revalidatePath("/my-listings");
  return { error: null };
}

export async function removePropertyImages(propertyId: string, imageIds: string[]) {
  if (!validPropertyId(propertyId) || !Array.isArray(imageIds) || !imageIds.length || imageIds.length > 10 ||
    imageIds.some((id) => !validPropertyId(id))) {
    return { error: "Choose valid listing photos to remove." };
  }
  const auth = await getVerifiedUser();
  if (!auth.ok) return { error: auth.error };
  const { data: images, error: selectError } = await auth.supabase.from("property_images")
    .select("id,storage_path")
    .eq("property_id", propertyId)
    .in("id", imageIds);
  if (selectError) return { error: "We couldn't verify the selected listing photos." };
  if (images.length !== imageIds.length || images.some((image) =>
    !image.storage_path.startsWith(`${auth.user.id}/${propertyId}/`)
  )) {
    return { error: "One or more photos are no longer available on this listing." };
  }
  const storageError = await removeStoragePaths(auth.supabase, images.map((image) => image.storage_path));
  if (storageError) return { error: "The selected photos could not be removed from storage. The listing was not changed." };
  const { error } = await auth.supabase.from("property_images").delete()
    .eq("property_id", propertyId)
    .in("id", imageIds);
  if (error) return { error: "The photo files were removed, but their listing records could not be updated. Contact support." };
  revalidatePath("/my-listings");
  return { error: null };
}

export async function deleteProperty(propertyId: string) {
  if (!validPropertyId(propertyId)) return { error: "This listing could not be found." };
  const auth = await getVerifiedUser();
  if (!auth.ok) return { error: auth.error };
  const { data: property, error: propertyError } = await auth.supabase.from("properties")
    .select("id").eq("id", propertyId).maybeSingle();
  if (propertyError) return { error: "We couldn't verify this listing before deletion." };
  if (!property) return { error: "This listing was not found or you don't have permission to delete it." };
  const { data: images, error: imageError } = await auth.supabase.from("property_images")
    .select("storage_path").eq("property_id", propertyId);
  if (imageError) return { error: "We couldn't load this listing's photos; nothing was deleted." };
  const storageError = await removeStoragePaths(auth.supabase, images.map((image) => image.storage_path));
  if (storageError) return { error: "Some listing photos could not be removed; the listing was not deleted." };
  const { data, error } = await auth.supabase.from("properties")
    .delete().eq("id", propertyId).select("id").maybeSingle();
  if (error) return { error: "The photos were removed, but the listing could not be deleted." };
  if (!data) return { error: "This listing was not found or you don't have permission to delete it." };
  revalidatePath("/my-listings");
  return { error: null };
}
