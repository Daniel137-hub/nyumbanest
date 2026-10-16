import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/auth-forms";
import { safeNextPath } from "@/lib/auth";

export const metadata: Metadata = { title: "Create your account | NyumbaNest" };
export const instant = false;

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);
  return <AuthShell title="Find your place." subtitle="Create an account to save homes and manage your property plans.">
    <SignupForm nextPath={nextPath} />
  </AuthShell>;
}
