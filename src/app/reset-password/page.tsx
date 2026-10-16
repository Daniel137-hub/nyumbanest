import type { Metadata } from "next";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { PASSWORD_RECOVERY_COOKIE, safeNextPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Choose a new password | NyumbaNest" };
export const instant = false;

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ return_to?: string | string[] }> }) {
  const { return_to: returnTo } = await searchParams;
  await connection();
  const destination = safeNextPath(returnTo, "/profile");
  const cookieStore = await cookies();
  if (cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value !== "1") {
    redirect(`/forgot-password?error=recovery&next=${encodeURIComponent(destination)}`);
  }
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    redirect(`/forgot-password?error=recovery&next=${encodeURIComponent(destination)}`);
  }
  return <AuthShell title="Choose a new password" subtitle="Choose a strong password you haven't used here before.">
    <ResetPasswordForm nextPath={destination} />
  </AuthShell>;
}
