"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LoaderCircle, MailCheck } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  updatePasswordAfterRecovery,
  verifyPasswordRecoveryOtp,
} from "@/app/actions/password-recovery";
import {
  getAuthErrorMessage,
  PENDING_EMAIL_KEY,
  RESEND_COOLDOWN_KEY,
  validatePassword,
} from "@/lib/auth";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function FieldError({ id, children }: { id: string; children?: string }) {
  return children ? <p className="auth-field__error" id={id} role="alert">{children}</p> : null;
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  visible,
  onToggle,
  autoComplete,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  autoComplete: string;
  error?: string;
}) {
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <div className={`auth-input-wrap${error ? " has-error" : ""}`}>
        <input id={id} name={id} type={visible ? "text" : "password"} value={value}
          onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete}
          required aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />
        <button className="auth-visibility" type="button" onClick={onToggle}
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`} aria-pressed={visible}>
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}

function SubmitButton({ children, busy }: { children: string; busy: boolean }) {
  return <button className="button button--primary auth-submit" type="submit" disabled={busy}>
    {busy && <LoaderCircle className="auth-spinner" size={17} aria-hidden="true" />}{busy ? "Please wait…" : children}
  </button>;
}

export function SignupForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const submissionLock = useRef(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || submissionLock.current) return;
    const nextErrors: Record<string, string> = {};
    if (fullName.trim().length < 2) nextErrors.fullName = "Enter your full name.";
    if (!EMAIL_PATTERN.test(email.trim())) nextErrors.email = "Enter a valid email address.";
    const passwordError = validatePassword(password);
    if (passwordError) nextErrors.password = passwordError;
    if (confirmation !== password) nextErrors.confirmation = "The passwords do not match.";
    setErrors(nextErrors);
    setMessage("");
    if (Object.keys(nextErrors).length) return;

    submissionLock.current = true;
    setBusy(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: `${window.location.origin}/auth/confirm?flow=signup&next=${encodeURIComponent(nextPath)}`,
        },
      });
      if (error) {
        if (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") {
          setMessage(getAuthErrorMessage(error));
        } else if (error.code === "weak_password") {
          setErrors({ password: getAuthErrorMessage(error) });
        } else {
          setMessage(getAuthErrorMessage(error));
        }
        return;
      }

      if (data.session) {
        // This happens when the project has disabled email confirmation.
        router.replace(nextPath);
        router.refresh();
        return;
      }
      sessionStorage.setItem(PENDING_EMAIL_KEY, email.trim().toLowerCase());
      sessionStorage.removeItem(RESEND_COOLDOWN_KEY);
      router.push(`/verify-email?next=${encodeURIComponent(nextPath)}`);
    } catch {
      setMessage("We couldn't reach the authentication service. Check your connection and try again.");
    } finally {
      submissionLock.current = false;
      setBusy(false);
    }
  }

  return <form className="auth-form" method="post" onSubmit={submit} noValidate>
    <div className="auth-field">
      <label htmlFor="fullName">Full name</label>
      <input id="fullName" name="fullName" type="text" autoComplete="name" required maxLength={160}
        value={fullName} onChange={(event) => setFullName(event.target.value)} aria-invalid={Boolean(errors.fullName)}
        aria-describedby={errors.fullName ? "fullName-error" : undefined} />
      <FieldError id="fullName-error">{errors.fullName}</FieldError>
    </div>
    <div className="auth-field">
      <label htmlFor="signup-email">Email address</label>
      <input id="signup-email" name="email" type="email" autoComplete="email" required maxLength={320}
        value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={Boolean(errors.email)}
        aria-describedby={errors.email ? "signup-email-error" : undefined} />
      <FieldError id="signup-email-error">{errors.email}</FieldError>
    </div>
    <PasswordField id="signup-password" label="Password" value={password} onChange={setPassword}
      visible={showPassword} onToggle={() => setShowPassword((value) => !value)} autoComplete="new-password" error={errors.password} />
    <PasswordField id="signup-confirmation" label="Confirm password" value={confirmation} onChange={setConfirmation}
      visible={showConfirmation} onToggle={() => setShowConfirmation((value) => !value)} autoComplete="new-password" error={errors.confirmation} />
    <p className="auth-hint">Use at least 8 characters with a letter and a number.</p>
    {message && <p className="auth-message auth-message--error" role="alert">{message}</p>}
    <SubmitButton busy={busy}>Create account</SubmitButton>
    <p className="auth-switch">Already have an account? <Link href={`/login?next=${encodeURIComponent(nextPath)}`}>Sign in</Link></p>
  </form>;
}

export function LoginForm({ nextPath, initialError }: { nextPath: string; initialError?: string }) {
  const router = useRouter();
  const submissionLock = useRef(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(initialError === "verification" ? "That verification link is invalid or expired. Request a new code to continue." : "");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || submissionLock.current) return;
    if (!EMAIL_PATTERN.test(email.trim()) || password.length === 0) {
      setMessage("Enter a valid email address and password.");
      return;
    }
    submissionLock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await createClient().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) {
        setMessage(getAuthErrorMessage(error));
        if (error.code === "email_not_confirmed") sessionStorage.setItem(PENDING_EMAIL_KEY, email.trim().toLowerCase());
        return;
      }
      router.replace(nextPath);
      router.refresh();
    } catch {
      setMessage("We couldn't reach the authentication service. Check your connection and try again.");
    } finally {
      submissionLock.current = false;
      setBusy(false);
    }
  }

  return <form className="auth-form" method="post" onSubmit={submit} noValidate>
    <div className="auth-field">
      <label htmlFor="login-email">Email address</label>
      <input id="login-email" name="email" type="email" autoComplete="email" required maxLength={320} value={email}
        onChange={(event) => setEmail(event.target.value)} />
    </div>
    <PasswordField id="login-password" label="Password" value={password} onChange={setPassword} visible={visible}
      onToggle={() => setVisible((value) => !value)} autoComplete="current-password" />
    <div className="auth-inline"><Link href={`/forgot-password?next=${encodeURIComponent(nextPath)}`}>Forgot password?</Link></div>
    {message && <div className="auth-message auth-message--error" role="alert">
      <p>{message}</p>
      {message.includes("verify your email") && <Link href={`/verify-email?next=${encodeURIComponent(nextPath)}`}>Go to email verification</Link>}
    </div>}
    <SubmitButton busy={busy}>Sign in</SubmitButton>
    <p className="auth-switch">New to NyumbaNest? <Link href={`/signup?next=${encodeURIComponent(nextPath)}`}>Create an account</Link></p>
  </form>;
}

export function VerifyEmailForm({
  nextPath,
  callbackError,
  verified = false,
}: {
  nextPath: string;
  callbackError?: string;
  verified?: boolean;
}) {
  const router = useRouter();
  const submissionLock = useRef(false);
  const resendLock = useRef(false);
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState(callbackError ? "That code or link is invalid, expired, or already used. Request a new code and try again." : "");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (verified) {
      sessionStorage.removeItem(PENDING_EMAIL_KEY);
      sessionStorage.removeItem(RESEND_COOLDOWN_KEY);
      const timer = window.setTimeout(() => {
        router.replace(nextPath);
        router.refresh();
      }, 1800);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      const pendingEmail = sessionStorage.getItem(PENDING_EMAIL_KEY);
      if (pendingEmail) setEmail(pendingEmail);
      const resendUntil = Number(sessionStorage.getItem(RESEND_COOLDOWN_KEY));
      if (Number.isFinite(resendUntil) && resendUntil > Date.now()) {
        setCooldown(Math.ceil((resendUntil - Date.now()) / 1000));
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [nextPath, router, verified]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setInterval(() => {
      const resendUntil = Number(sessionStorage.getItem(RESEND_COOLDOWN_KEY));
      const remaining = Math.max(0, Math.ceil((resendUntil - Date.now()) / 1000));
      setCooldown(remaining);
      if (remaining === 0) sessionStorage.removeItem(RESEND_COOLDOWN_KEY);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || submissionLock.current) return;
    if (!EMAIL_PATTERN.test(email.trim()) || !/^\d{6,10}$/.test(token)) {
      setMessage("Enter the email address and verification code from your email.");
      return;
    }
    submissionLock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await createClient().auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token,
        type: "email",
      });
      if (error) {
        setMessage(error.status === 429 ? getAuthErrorMessage(error) : "That code is incorrect, expired, or already used. Request a new code and try again.");
        return;
      }
      sessionStorage.removeItem(PENDING_EMAIL_KEY);
      sessionStorage.removeItem(RESEND_COOLDOWN_KEY);
      setSuccess("Your email is verified. Taking you to your account…");
      router.replace(nextPath);
      router.refresh();
    } catch {
      setMessage("We couldn't verify that code right now. Check your connection and try again.");
    } finally {
      submissionLock.current = false;
      setBusy(false);
    }
  }

  async function resend() {
    if (resending || cooldown > 0 || resendLock.current) return;
    if (!EMAIL_PATTERN.test(email.trim())) {
      setMessage("We couldn't find the email address for this verification. Return to sign up and enter it again.");
      return;
    }
    resendLock.current = true;
    setResending(true);
    setCooldown(60);
    sessionStorage.setItem(RESEND_COOLDOWN_KEY, String(Date.now() + 60_000));
    setMessage("");
    try {
      const { error } = await createClient().auth.resend({
        type: "signup",
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: `${window.location.origin}/auth/confirm?flow=signup&next=${encodeURIComponent(nextPath)}` },
      });
      if (error) {
        setMessage(getAuthErrorMessage(error));
      } else {
        setSuccess("If this address has a pending account, a fresh code has been sent.");
      }
    } catch {
      setMessage("We couldn't request another code. Check your connection and try again.");
    } finally {
      resendLock.current = false;
      setResending(false);
    }
  }

  if (verified) {
    return <p className="auth-message auth-message--success" role="status">
      Your email is verified. Taking you to your NyumbaNest account…
    </p>;
  }

  return <>
    <div className="verify-email-summary"><span><MailCheck size={21} aria-hidden="true" /></span>
      <p>Enter the code sent to the email address you used to sign up.</p>
    </div>
    <form className="auth-form" method="post" onSubmit={verify} noValidate>
      <div className="auth-field">
        <label htmlFor="verification-email">Email address</label>
        <input id="verification-email" name="email" type="email" autoComplete="email" required maxLength={320}
          value={email} onChange={(event) => {
            const value = event.target.value;
            setEmail(value);
            sessionStorage.setItem(PENDING_EMAIL_KEY, value);
          }} />
      </div>
      <div className="auth-field">
        <label htmlFor="verification-code">Verification code</label>
        <input className="auth-otp" id="verification-code" name="token" type="text" inputMode="numeric" autoComplete="one-time-code"
          pattern="[0-9]{6,10}" maxLength={10} required value={token} onChange={(event) => setToken(event.target.value.replace(/\D/g, "").slice(0, 10))}
          aria-describedby="verification-hint" />
        <p className="auth-hint" id="verification-hint">Enter the code from your email.</p>
      </div>
      {message && <p className="auth-message auth-message--error" role="alert">{message}</p>}
      {success && <p className="auth-message auth-message--success" role="status">{success}</p>}
      <SubmitButton busy={busy}>Verify email</SubmitButton>
    </form>
    <div className="verify-email-actions">
      <button className="auth-text-button" type="button" onClick={resend} disabled={resending || cooldown > 0}>
        {resending ? "Sending…" : cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
      </button>
      <Link className="auth-text-button" href={`/signup?next=${encodeURIComponent(nextPath)}`}>Change email or return to sign up</Link>
    </div>
    <p className="auth-switch">Already verified? <Link href={`/login?next=${encodeURIComponent(nextPath)}`}>Sign in</Link></p>
  </>;
}

export function ForgotPasswordForm({ nextPath = "/profile", initialError = "" }: { nextPath?: string; initialError?: string }) {
  const router = useRouter();
  const submissionLock = useRef(false);
  const [email, setEmail] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(initialError === "recovery"
    ? "Your recovery session is missing or expired. Request a new reset email to continue."
    : initialError
      ? "That reset link is invalid or expired. Request a new one to continue."
      : "");
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || submissionLock.current) return;
    if (!EMAIL_PATTERN.test(email.trim())) {
      setMessage("Enter a valid email address.");
      return;
    }
    submissionLock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const callback = new URL("/auth/confirm", window.location.origin);
      callback.searchParams.set("flow", "recovery");
      callback.searchParams.set("next", `/reset-password?return_to=${encodeURIComponent(nextPath)}`);
      const { error } = await createClient().auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: callback.toString() });
      if (error) setMessage(getAuthErrorMessage(error));
      else setSent(true);
    } catch {
      setMessage("We couldn't reach the authentication service. Check your connection and try again.");
    } finally {
      submissionLock.current = false;
      setBusy(false);
    }
  }

  async function verifyRecoveryCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || submissionLock.current) return;
    if (!EMAIL_PATTERN.test(email.trim()) || !/^\d{6,10}$/.test(recoveryCode)) {
      setMessage("Enter the email address and recovery code from your email.");
      return;
    }

    submissionLock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const result = await verifyPasswordRecoveryOtp(email, recoveryCode);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      router.push(`/reset-password?return_to=${encodeURIComponent(nextPath)}`);
      router.refresh();
    } catch {
      setMessage("We couldn't verify that recovery code. Check your connection and try again.");
    } finally {
      submissionLock.current = false;
      setBusy(false);
    }
  }

  return sent ? <>
    <div className="auth-message auth-message--success" role="status">
      If an account exists for that address, a password reset email is on its way. Check your inbox.
    </div>
    <p className="auth-hint">You can reset your password using the email link or by entering its recovery code below.</p>
    <form className="auth-form" method="post" onSubmit={verifyRecoveryCode} noValidate>
      <div className="auth-field">
        <label htmlFor="recovery-code-email">Email address</label>
        <input id="recovery-code-email" name="email" type="email" autoComplete="email" required maxLength={320}
          value={email} onChange={(event) => setEmail(event.target.value)} />
      </div>
      <div className="auth-field">
        <label htmlFor="recovery-code">Recovery code</label>
        <input className="auth-otp" id="recovery-code" name="recovery-code" type="text" inputMode="numeric"
          autoComplete="one-time-code" pattern="[0-9]{6,10}" maxLength={10} required value={recoveryCode}
          onChange={(event) => setRecoveryCode(event.target.value.replace(/\D/g, "").slice(0, 10))} />
      </div>
      {message && <p className="auth-message auth-message--error" role="alert">{message}</p>}
      <SubmitButton busy={busy}>Verify recovery code</SubmitButton>
    </form>
  </> : <form className="auth-form" method="post" onSubmit={submit} noValidate>
    <div className="auth-field"><label htmlFor="recovery-email">Email address</label>
      <input id="recovery-email" name="email" type="email" autoComplete="email" required maxLength={320} value={email}
        onChange={(event) => setEmail(event.target.value)} /></div>
    {message && <p className="auth-message auth-message--error" role="alert">{message}</p>}
    <SubmitButton busy={busy}>Send reset link</SubmitButton>
    <p className="auth-switch"><Link href="/login">Return to sign in</Link></p>
  </form>;
}

export function ResetPasswordForm({ nextPath = "/profile" }: { nextPath?: string }) {
  const router = useRouter();
  const submissionLock = useRef(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [complete, setComplete] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || submissionLock.current) return;
    const validation = validatePassword(password);
    if (validation) { setMessage(validation); return; }
    if (password !== confirm) { setMessage("The passwords do not match."); return; }
    submissionLock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const formData = new FormData();
      formData.set("password", password);
      formData.set("confirmation", confirm);
      const result = await updatePasswordAfterRecovery(formData, nextPath);
      if (result.error) { setMessage(result.error); return; }
      setComplete(true);
      window.setTimeout(() => {
        router.replace(result.nextPath ?? nextPath);
        router.refresh();
      }, 1500);
    } catch {
      setMessage("Your reset link may have expired. Request a new password reset email and try again.");
    } finally {
      submissionLock.current = false;
      setBusy(false);
    }
  }

  if (complete) return <div className="auth-message auth-message--success" role="status">Your password has been updated. Redirecting to your profile…</div>;
  return <form className="auth-form" method="post" onSubmit={submit} noValidate>
    <PasswordField id="reset-password" label="New password" value={password} onChange={setPassword} visible={visible}
      onToggle={() => setVisible((value) => !value)} autoComplete="new-password" />
    <PasswordField id="reset-confirm" label="Confirm new password" value={confirm} onChange={setConfirm} visible={confirmVisible}
      onToggle={() => setConfirmVisible((value) => !value)} autoComplete="new-password" />
    <p className="auth-hint">Use at least 8 characters with a letter and a number.</p>
    {message && <p className="auth-message auth-message--error" role="alert">{message}</p>}
    <SubmitButton busy={busy}>Update password</SubmitButton>
  </form>;
}
