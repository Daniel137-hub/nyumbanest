export const PENDING_EMAIL_KEY = "nyumbanest.auth.pending-email";
export const RESEND_COOLDOWN_KEY = "nyumbanest.auth.resend-until";
export const PASSWORD_RECOVERY_COOKIE = "nyumbanest-password-recovery";

export function safeNextPath(value: unknown, fallback = "/") {
  if (typeof value !== "string") return fallback;
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }

  try {
    const parsed = new URL(value, "https://nyumbanest.local");
    if (parsed.origin !== "https://nyumbanest.local" || parsed.pathname.startsWith("//") || parsed.pathname.includes("\\")) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function validatePassword(password: string) {
  if (password.length < 8) return "Use at least 8 characters.";
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Include at least one letter and one number.";
  }
  return null;
}

export function getAuthErrorMessage(error: { code?: string; message?: string; status?: number }) {
  if (error.code === "email_not_confirmed") {
    return "Please verify your email before signing in. You can request another code from the verification page.";
  }
  if (error.code === "invalid_credentials") return "Email or password is incorrect.";
  if (
    error.status === 429 ||
    error.code === "over_email_send_rate_limit" ||
    error.code === "over_request_rate_limit"
  ) {
    return "Too many attempts. Wait a little before trying again.";
  }
  if (error.code === "weak_password") return "Choose a stronger password that meets the requirements.";
  if (error.message?.toLowerCase().includes("fetch")) return "Could not reach the authentication service. Check your connection and try again.";
  return "We couldn't complete that request. Please try again.";
}
