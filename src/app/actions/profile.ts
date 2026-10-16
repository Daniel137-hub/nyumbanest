"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const AVATAR_BUCKET = "profile-photos";
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const AVATAR_FORMATS = {
  "image/jpeg": { extension: "jpg", signature: [0xff, 0xd8, 0xff] },
  "image/png": { extension: "png", signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  "image/webp": { extension: "webp", signature: [0x52, 0x49, 0x46, 0x46] },
} as const;

export type ProfilePhotoState = {
  error?: string;
  success?: string;
};

type SupabaseOperationError = {
  name?: string;
  statusCode?: string | number;
  code?: string;
};

function logProfilePhotoFailure(stage: string, error: SupabaseOperationError) {
  if (process.env.NODE_ENV !== "production") {
    console.error(`[profile-photo] ${stage} failed`, {
      name: error.name,
      statusCode: error.statusCode,
      code: error.code,
    });
  }
}

function storageUploadMessage(error: SupabaseOperationError) {
  if (error.name === "BucketNotFound" || error.statusCode === "404" || error.statusCode === 404) {
    return "Profile photo storage is not set up yet. Ask an administrator to apply the profile photo migration.";
  }
  if (error.statusCode === "403" || error.statusCode === 403 || error.statusCode === "401" || error.statusCode === 401) {
    return "The profile photo upload was denied. Check your sign-in and profile photo storage permissions.";
  }
  if (error.statusCode === "413" || error.statusCode === 413) {
    return "Choose a photo no larger than 5 MiB.";
  }
  return "Your photo could not be uploaded. Please check your connection and try again.";
}

function hasValidImageSignature(type: string, bytes: Uint8Array) {
  const format = AVATAR_FORMATS[type as keyof typeof AVATAR_FORMATS];
  if (!format || !format.signature.every((byte, index) => bytes[index] === byte)) return false;
  return type !== "image/webp" ||
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
}

function isOwnedAvatarPath(path: string | null, userId: string): path is string {
  return Boolean(
    path &&
    path.startsWith(`${userId}/`) &&
    new RegExp(`^${userId}/[0-9a-f-]{36}\\.(?:jpg|png|webp)$`, "i").test(path),
  );
}

export async function updateProfilePhoto(
  _previousState: ProfilePhotoState,
  formData: FormData,
): Promise<ProfilePhotoState> {
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return { error: "Choose a photo to upload." };
  }
  if (photo.size > MAX_AVATAR_SIZE) {
    return { error: "Choose a photo no larger than 5 MiB." };
  }

  const format = AVATAR_FORMATS[photo.type as keyof typeof AVATAR_FORMATS];
  const signature = new Uint8Array(await photo.slice(0, 12).arrayBuffer());
  if (!format || !hasValidImageSignature(photo.type, signature)) {
    return { error: "Use a valid JPEG, PNG, or WebP photo." };
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Sign in again to update your profile photo." };

  const { data: profile, error: profileReadError } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  if (profileReadError || !profile) {
    if (profileReadError) logProfilePhotoFailure("profile read", profileReadError);
    return { error: "Your profile could not be loaded. Please try again." };
  }

  const path = `${user.id}/${randomUUID()}.${format.extension}`;
  const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(path, photo, {
    cacheControl: "3600",
    contentType: photo.type,
    upsert: false,
  });
  if (uploadError) {
    logProfilePhotoFailure("storage upload", uploadError);
    return { error: storageUploadMessage(uploadError) };
  }

  const { data: updatedProfile, error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: path })
    .eq("id", user.id)
    .select("id")
    .maybeSingle();
  if (updateError || !updatedProfile) {
    if (updateError) logProfilePhotoFailure("profile update", updateError);
    const { error: cleanupError } = await supabase.storage.from(AVATAR_BUCKET).remove([path]);
    if (cleanupError) logProfilePhotoFailure("orphaned photo cleanup", cleanupError);
    return {
      error: cleanupError
        ? "Your profile was not updated, and the uploaded photo could not be cleaned up. Please try again or contact your administrator."
        : "Your profile could not be updated. Please try again.",
    };
  }

  let success = "Profile photo updated.";
  if (isOwnedAvatarPath(profile.avatar_url, user.id)) {
    const { error: removeError } = await supabase.storage.from(AVATAR_BUCKET).remove([profile.avatar_url]);
    if (removeError) {
      logProfilePhotoFailure("previous photo removal", removeError);
      success = "Profile photo updated. The previous photo could not be removed.";
    }
  }

  revalidatePath("/profile");
  return { success };
}
