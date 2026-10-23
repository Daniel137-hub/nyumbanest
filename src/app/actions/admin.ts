"use server";

import { revalidatePath } from "next/cache";
import { hasAdminRole, requireVerifiedUser } from "@/lib/supabase/auth-guard";
import { validatePropertyForm, type PropertyFormValues } from "@/lib/properties";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function getAdminClient() {
  const user = await requireVerifiedUser("/admin");
  if (!hasAdminRole(user)) return null;
  return createClient();
}

export async function approveProperty(propertyId: string) {
  if (!UUID_PATTERN.test(propertyId)) return { error: "This listing could not be found." };
  const supabase = await getAdminClient();
  if (!supabase) return { error: "Administrator access is required to approve listings." };

  const { error } = await supabase.rpc("approve_property", {
    target_property_id: propertyId,
  });
  if (error) {
    console.error("Property approval RPC failed", {
      code: error.code,
      message: error.message,
    });
    return {
      error: error.code === "P0002"
        ? "This listing is no longer awaiting review."
        : "We couldn't approve this listing. Please try again.",
    };
  }

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/properties");
  revalidatePath(`/properties/${propertyId}`);
  return { error: null };
}

export async function deletePropertyAsAdmin(propertyId: string) {
  if (!UUID_PATTERN.test(propertyId)) return { error: "This listing could not be found." };
  const supabase = await getAdminClient();
  if (!supabase) return { error: "Administrator access is required to delete listings." };

  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .maybeSingle();
  if (propertyError) return { error: "We couldn't verify this listing before deletion." };
  if (!property) return { error: "This listing could not be found." };

  const { data: images, error: imageError } = await supabase
    .from("property_images")
    .select("storage_path")
    .eq("property_id", propertyId);
  if (imageError) return { error: "We couldn't load this listing's photos; nothing was deleted." };

  if (images.length) {
    const { error } = await supabase.storage
      .from("property-images")
      .remove(images.map(({ storage_path }) => storage_path));
    if (error) return { error: "Some listing photos could not be removed; the listing was not deleted." };
  }

  const { data, error } = await supabase
    .from("properties")
    .delete()
    .eq("id", propertyId)
    .select("id")
    .maybeSingle();
  if (error) return { error: "The photos were removed, but the listing could not be deleted." };
  if (!data) return { error: "This listing could not be found." };
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/properties");
  revalidatePath(`/properties/${propertyId}`);
  return { error: null };
}

export async function savePropertyAsAdmin(propertyId: string, values: PropertyFormValues) {
  if (!UUID_PATTERN.test(propertyId)) return { error: "This listing could not be found." };
  const supabase = await getAdminClient();
  if (!supabase) return { error: "Administrator access is required to edit listings." };

  let property;
  try {
    property = validatePropertyForm(values);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Check the property details and try again." };
  }

  const { data, error } = await supabase
    .from("properties")
    .update(property)
    .eq("id", propertyId)
    .select("id")
    .maybeSingle();
  if (error) return { error: "We couldn't update this listing. Check the details and try again." };
  if (!data) return { error: "This listing could not be found." };
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/properties");
  revalidatePath(`/properties/${propertyId}`);
  revalidatePath(`/my-listings/${propertyId}/edit`);
  return { error: null };
}
