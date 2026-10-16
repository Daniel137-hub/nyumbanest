import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/auth-forms";
import { safeNextPath } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in | NyumbaNest" };
export const instant = false;

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[]; error?: string | string[] }> }) {
  const { next, error } = await searchParams;
  return <AuthShell title="Welcome back." subtitle="Sign in to pick up where you left off.">
    <LoginForm nextPath={safeNextPath(next)} initialError={typeof error === "string" ? error : undefined} />
  </AuthShell>;
}
