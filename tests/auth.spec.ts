import { expect, test } from "@playwright/test";

const mockAuthUrl = "http://127.0.0.1:54329";

test.beforeEach(async ({ request }) => {
  const response = await request.post(`${mockAuthUrl}/__reset`);
  expect(response.ok()).toBeTruthy();
});

test("authentication close button returns to the previous page", async ({ page }) => {
  await page.goto("/");
  await page.goto("/login?next=%2Fprofile");
  const closeButton = page.getByRole("button", { name: "Close authentication" });
  await expect(closeButton).toHaveAttribute("type", "button");
  await closeButton.click();
  await expect(page).toHaveURL(/\/$/);
});

test("Escape closes an authentication page and returns to the previous page", async ({ page }) => {
  await page.goto("/");
  await page.goto("/signup");
  await page.getByLabel("Full name").focus();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/$/);
});

test("closing authentication opened directly falls back to the homepage", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Close authentication" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("rejects invalid registration and mismatched passwords", async ({ page, request }) => {
  await page.goto("/signup");
  await expect(page.locator("form")).toHaveAttribute("method", "post");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Enter your full name.")).toBeVisible();

  await page.getByLabel("Full name").fill("Test Member");
  await page.getByLabel("Email address", { exact: true }).fill("not-an-email");
  await page.getByLabel("Password", { exact: true }).fill("weak");
  await page.getByLabel("Confirm password", { exact: true }).fill("weak");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await expect(page.getByText("Use at least 8 characters.")).toBeVisible();

  await page.getByLabel("Full name").fill("Test Member");
  await page.getByLabel("Email address", { exact: true }).fill("new-member@example.com");
  await page.getByLabel("Password", { exact: true }).fill("StrongPass1");
  await page.getByLabel("Confirm password", { exact: true }).fill("DifferentPass1");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("The passwords do not match.")).toBeVisible();

  const state = await (await request.get(`${mockAuthUrl}/__state`)).json();
  expect(state.requests).toHaveLength(0);
});

test("toggles password visibility independently", async ({ page }) => {
  await page.goto("/signup");
  const password = page.getByLabel("Password", { exact: true });
  const confirmation = page.getByLabel("Confirm password", { exact: true });
  await page.getByRole("button", { name: "Show password" }).first().click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(confirmation).toHaveAttribute("type", "password");

  await page.getByRole("button", { name: "Show confirm password" }).click();
  await expect(confirmation).toHaveAttribute("type", "text");
});

test("registers the name Admin, verifies an email OTP, and handles an already-verified account", async ({ page, request }) => {
  await page.goto("/signup?next=%2Fsearch");
  await page.getByLabel("Full name").fill("Admin");
  await page.getByLabel("Email address").fill("new-member@example.com");
  await page.getByLabel("Password", { exact: true }).fill("StrongPass1");
  await page.getByLabel("Confirm password", { exact: true }).fill("StrongPass1");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/verify-email\?next=%2Fsearch/);
  await expect(page.getByLabel("Email address", { exact: true }).last()).toHaveValue("new-member@example.com");

  const state = await (await request.get(`${mockAuthUrl}/__state`)).json();
  const signup = state.requests.find((entry: { path: string }) => entry.path === "/auth/v1/signup");
  expect(signup.fullName).toBe("Admin");

  await page.getByLabel("Verification code").fill("000000");
  await page.getByRole("button", { name: "Verify email" }).click();
  await expect(page.locator(".auth-message--error")).toContainText("incorrect, expired, or already used");

  await page.getByLabel("Verification code").fill("123456");
  await page.getByRole("button", { name: "Verify email" }).click();
  await expect(page).toHaveURL(/\/search$/);
  const verifiedState = await (await request.get(`${mockAuthUrl}/__state`)).json();
  const signupOtp = verifiedState.requests.find((entry: { path: string; otpType: string }) =>
    entry.path === "/auth/v1/verify" && entry.otpType === "email"
  );
  expect(signupOtp).toBeTruthy();

  await page.goto("/verify-email?next=%2Fsaved");
  await page.getByLabel("Email address").fill("new-member@example.com");
  await page.getByLabel("Verification code").fill("123456");
  await page.getByRole("button", { name: "Verify email" }).click();
  await expect(page.locator(".auth-message--error")).toContainText("incorrect, expired, or already used");

  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
  await expect(page.getByText("new-member@example.com")).toBeVisible();
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/my-listings$/);
  await page.goto("/profile");
  await page.getByRole("button", { name: "Sign Out" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/verify-email?next=%2Fsaved");
  await page.locator(".auth-switch").getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fsaved$/);
  await page.locator("#login-email").fill("new-member@example.com");
  await page.getByLabel("Password", { exact: true }).fill("StrongPass1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/saved$/);
});

test("email verification link verifies a signup without entering an OTP", async ({ page, request }) => {
  await page.goto("/signup?next=%2Fsearch");
  await page.getByLabel("Full name").fill("Link Member");
  await page.getByLabel("Email address", { exact: true }).fill("link-member@example.com");
  await page.getByLabel("Password", { exact: true }).fill("StrongPass1");
  await page.getByLabel("Confirm password", { exact: true }).fill("StrongPass1");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/verify-email\?next=%2Fsearch/);

  await page.goto("/auth/confirm?token_hash=signup-confirm-token-hash&type=signup&flow=signup&next=%2Fsearch");
  await expect(page.locator(".auth-message--success")).toContainText("Your email is verified");
  await expect(page).toHaveURL(/\/search$/);
  const state = await (await request.get(`${mockAuthUrl}/__state`)).json();
  expect(state.requests.some((entry: { path: string; otpType: string }) =>
    entry.path === "/auth/v1/verify" && entry.otpType === "signup"
  )).toBeTruthy();
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Link Member" })).toBeVisible();
});

test("resend starts and preserves a cooldown across reloads", async ({ page, request }) => {
  await page.goto("/verify-email");
  await page.getByLabel("Email address").fill("member@example.com");
  await page.getByRole("button", { name: "Resend verification email" }).click();
  await expect(page.getByRole("status")).toContainText("a fresh code has been sent");
  await expect(page.getByRole("button", { name: /Resend verification email in \d+s/ })).toBeDisabled();

  await page.reload();
  await expect(page.getByRole("button", { name: /Resend verification email in \d+s/ })).toBeDisabled();
  const state = await (await request.get(`${mockAuthUrl}/__state`)).json();
  const resendRequests = state.requests.filter((entry: { path: string; otpType: string }) =>
    entry.path === "/auth/v1/resend"
  );
  expect(resendRequests).toHaveLength(1);
  expect(resendRequests[0].otpType).toBe("signup");
});

test("signs in, preserves only safe internal destinations, and signs out", async ({ page }) => {
  await page.goto("/login?next=https%3A%2F%2Fevil.example");
  await expect(page.locator("form")).toHaveAttribute("method", "post");
  await page.getByLabel("Email address").fill("member@example.com");
  await page.getByLabel("Password", { exact: true }).fill("Correct123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/login?next=%2Fprofile");
  await page.getByLabel("Email address").fill("member@example.com");
  await page.getByLabel("Password", { exact: true }).fill("Correct123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("heading", { name: "Test Member" })).toBeVisible();
  await page.getByRole("button", { name: "Sign Out" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("shows invalid-credential feedback and protects private routes", async ({ page }) => {
  await page.goto("/login?next=%2Fprofile");
  await page.getByLabel("Email address").fill("member@example.com");
  await page.getByLabel("Password", { exact: true }).fill("WrongPass1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".auth-message--error")).toContainText("Email or password is incorrect.");

  for (const path of ["/my-listings", "/my-listings/new", "/my-listings/test-id/edit", "/saved", "/profile"]) {
    await page.goto(path);
    await expect(page).toHaveURL((url) =>
      url.pathname === "/login" && url.searchParams.get("next") === path
    );
  }
});

test("rejects expired authentication sessions without opening protected pages", async ({ page, request }) => {
  await request.post(`${mockAuthUrl}/__configure`, { data: { expireNextSession: true } });
  await page.goto("/login?next=%2Fprofile");
  await page.getByLabel("Email address").fill("member@example.com");
  await page.getByLabel("Password", { exact: true }).fill("Correct123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL((url) =>
    url.pathname === "/login" && url.searchParams.get("next") === "/profile"
  );
  await page.goto("/profile");
  await expect(page).toHaveURL((url) =>
    url.pathname === "/login" && url.searchParams.get("next") === "/profile"
  );
});

test("shows a useful error when the authentication service fails", async ({ page, request }) => {
  await request.post(`${mockAuthUrl}/__configure`, { data: { passwordAuthFailure: true } });
  await page.goto("/login");
  await page.getByLabel("Email address").fill("member@example.com");
  await page.getByLabel("Password", { exact: true }).fill("Correct123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".auth-message--error")).toContainText("We couldn't complete that request");
});

test("requests password recovery, confirms the callback, and updates the password", async ({ page, request }) => {
  await page.goto("/forgot-password?next=%2Fprofile");
  await page.getByLabel("Email address").fill("member@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("If an account exists for that address");

  const callbackResponsePromise = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/auth/confirm"
  );
  await page.goto("/auth/confirm?token_hash=recovery-token-hash&type=recovery&flow=recovery&next=%2Freset-password%3Freturn_to%3D%2Fprofile");
  const callbackResponse = await callbackResponsePromise;
  expect(await callbackResponse.headerValue("set-cookie")).toBeTruthy();
  await expect(page).toHaveURL((url) =>
    url.pathname === "/reset-password" && url.searchParams.get("return_to") === "/profile"
  );
  await page.getByLabel("New password", { exact: true }).fill("UpdatedPass2");
  await page.getByLabel("Confirm new password", { exact: true }).fill("UpdatedPass2");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.locator(".auth-message--success")).toContainText("Your password has been updated");
  await expect(page).toHaveURL(/\/profile$/);
  const state = await (await request.get(`${mockAuthUrl}/__state`)).json();
  expect(state.memberPasswordMatchesUpdate).toBe(true);

  await page.goto("/reset-password?return_to=%2Fprofile");
  await expect(page).toHaveURL(/\/forgot-password\?error=recovery/);

  await page.goto("/login?next=%2Fprofile");
  await page.getByLabel("Email address").fill("member@example.com");
  await page.getByLabel("Password", { exact: true }).fill("UpdatedPass2");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/profile$/);
});

test("recovery OTP works independently from the link and rejects invalid codes", async ({ page }) => {
  await page.goto("/forgot-password?next=%2Fsaved");
  await page.getByLabel("Email address").fill("member@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("If an account exists for that address");

  await page.getByLabel("Recovery code").fill("000000");
  await page.getByRole("button", { name: "Verify recovery code" }).click();
  await expect(page.locator(".auth-message--error")).toContainText("incorrect, expired, or already used");

  await page.getByLabel("Recovery code").fill("654321");
  await page.getByRole("button", { name: "Verify recovery code" }).click();
  await expect(page).toHaveURL(/\/reset-password\?return_to=%2Fsaved$/);
  await page.getByLabel("New password", { exact: true }).fill("OtpUpdated3");
  await page.getByLabel("Confirm new password", { exact: true }).fill("OtpUpdated3");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Your password has been updated" })).toBeVisible();
  await expect(page).toHaveURL(/\/saved$/);

  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill("member@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("If an account exists for that address");
  await page.getByLabel("Recovery code").fill("654321");
  await page.getByRole("button", { name: "Verify recovery code" }).click();
  await expect(page.locator(".auth-message--error")).toContainText("incorrect, expired, or already used");
});

test("unknown recovery email gets the same public confirmation without creating an account", async ({ page, request }) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill("unknown@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("If an account exists for that address");
  await expect(page.getByLabel("Recovery code")).toBeVisible();

  const state = await (await request.get(`${mockAuthUrl}/__state`)).json();
  expect(state.users).toContain("member@example.com");
  expect(state.users).toContain("admin@example.com");
  expect(state.users).not.toContain("unknown@example.com");
});
