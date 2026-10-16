"use server";

import { cookies } from "next/headers";
import { getAuthErrorMessage, PASSWORD_RECOVERY_COOKIE, safeNextPath, validatePassword } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RECOVERY_GRANT_MAX_AGE = 15 * 60;

function setRecoveryGrant(cookieStore: Awaited<ReturnType<typeof cookies>>, maxAge = RECOVERY_GRANT_MAX_AGE) {
  cookieStore.set(PASSWORD_RECOVERY_COOKIE, "1", {
    httpOnly: true,
    maxAge,
    path: "/reset-password",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function verifyPasswordRecoveryOtp(email: string, token: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(normalizedEmail) || !/^\d{6,10}$/.test(token)) {
    return { error: "Enter the email address and verification code from your email." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: normalizedEmail,
    token,
    type: "recovery",
  });
  if (error) {
    return {
      error: error.status === 429
        ? getAuthErrorMessage(error)
        : "That recovery code is incorrect, expired, or already used. Request a new reset email and try again.",
    };
  }
  if (!data.user || !data.session) {
    return { error: "We couldn't verify that recovery code. Request a new reset email and try again." };
  }

  const cookieStore = await cookies();
  setRecoveryGrant(cookieStore);
  return { error: null };
}

export async function updatePasswordAfterRecovery(formData: FormData, nextPath: string) {
  const password = formData.get("password");
  const confirmation = formData.get("confirmation");
  if (typeof password !== "string" || typeof confirmation !== "string") {
    return { error: "Enter and confirm your new password." };
  }

  const validationError = validatePassword(password);
  if (validationError) return { error: validationError };
  if (password !== confirmation) return { error: "The passwords do not match." };

  const cookieStore = await cookies();
  if (cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value !== "1") {
    return { error: "Your recovery session has expired. Request a new password reset email." };
  }

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    setRecoveryGrant(cookieStore, 0);
    return { error: "Your recovery session has expired. Request a new password reset email." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: getAuthErrorMessage(error) };

  setRecoveryGrant(cookieStore, 0);
  return { error: null, nextPath: safeNextPath(nextPath, "/profile") };
}
