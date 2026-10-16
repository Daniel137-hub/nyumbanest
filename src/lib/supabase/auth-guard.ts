import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireAuthenticatedUser(returnTo: string) {
  await connection();
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  }
  return user;
}

export async function requireVerifiedUser(returnTo: string) {
  const user = await requireAuthenticatedUser(returnTo);
  if (!user.email_confirmed_at) {
    redirect(`/verify-email?next=${encodeURIComponent(returnTo)}`);
  }
  return user;
}
