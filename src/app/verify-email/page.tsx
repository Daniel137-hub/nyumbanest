import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyEmailForm } from "@/components/auth/auth-forms";
import { safeNextPath } from "@/lib/auth";

export const metadata: Metadata = { title: "Verify your email | NyumbaNest" };
export const instant = false;

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ next?: string | string[]; error?: string | string[]; verified?: string | string[] }> }) {
  const { next, error, verified } = await searchParams;
  return <AuthShell title="Verify your email" subtitle="One quick step to secure your NyumbaNest account.">
    <VerifyEmailForm nextPath={safeNextPath(next)} callbackError={typeof error === "string" ? error : undefined}
      verified={verified === "1"} />
  </AuthShell>;
}
