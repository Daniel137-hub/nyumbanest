import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { PASSWORD_RECOVERY_COOKIE, safeNextPath } from "@/lib/auth";
import { getSupabaseConfig } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

const EMAIL_OTP_TYPES = ["signup", "invite", "magiclink", "recovery", "email_change", "email"] as const;

function destination(request: NextRequest, path: string, response: NextResponse) {
  response.headers.set("Location", new URL(path, request.url).toString());
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNextPath(url.searchParams.get("next"));
  const nextUrl = new URL(next, request.url);
  const resetFlow = nextUrl.pathname === "/reset-password";
  const recoveryFlow = url.searchParams.get("flow") === "recovery";
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const rawType = url.searchParams.get("type");
  const type = EMAIL_OTP_TYPES.find((candidate) => candidate === rawType);
  const signupFlow = !recoveryFlow && rawType !== "recovery" &&
    (url.searchParams.get("flow") === "signup" || type === "signup");
  const { url: supabaseUrl, publishableKey } = getSupabaseConfig();
  const response = new NextResponse(null, { status: 307 });
  const supabase = createServerClient<Database>(supabaseUrl, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [name, value] of Object.entries(headers)) {
          response.headers.set(name, value);
        }
      },
    },
  });

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user && data.session) {
      if (resetFlow && recoveryFlow) setRecoveryGrant(request, response);
      const successPath = signupFlow
        ? `/verify-email?verified=1&next=${encodeURIComponent(next)}`
        : next;
      return destination(request, successPath, response);
    }
  } else if (tokenHash && type && EMAIL_OTP_TYPES.includes(type)) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error && data.user && data.session) {
      if (type === "recovery" && resetFlow) setRecoveryGrant(request, response);
      const successPath = signupFlow
        ? `/verify-email?verified=1&next=${encodeURIComponent(next)}`
        : next;
      return destination(request, successPath, response);
    }
  }

  const returnTo = resetFlow
    ? safeNextPath(nextUrl.searchParams.get("return_to"), "/profile")
    : "/";
  const failurePath = resetFlow
    ? `/forgot-password?error=verification&next=${encodeURIComponent(returnTo)}`
    : `/verify-email?error=verification&next=${encodeURIComponent(next)}`;
  return destination(request, failurePath, response);
}

function setRecoveryGrant(request: NextRequest, response: NextResponse) {
  response.cookies.set(PASSWORD_RECOVERY_COOKIE, "1", {
    httpOnly: true,
    maxAge: 15 * 60,
    path: "/reset-password",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
  });
}
