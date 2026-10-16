import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";
import { safeNextPath } from "@/lib/auth";

export const metadata: Metadata = { title: "Reset your password | NyumbaNest" };
export const instant = false;

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ next?: string | string[]; error?: string | string[] }> }) {
  const { next, error } = await searchParams;
  return <AuthShell title="Reset your password" subtitle="We'll send a secure reset link if an account matches that address.">
    <ForgotPasswordForm nextPath={safeNextPath(next, "/profile")} initialError={typeof error === "string" ? error : undefined} />
  </AuthShell>;
}
