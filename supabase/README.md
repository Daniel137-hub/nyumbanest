# Supabase setup

## Configure the app

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the project-root `.env.local`. Copy the project's URL and publishable key from Supabase Dashboard → Connect / Project API settings. Never use a service-role key in this Next.js app.

## Apply the schema

Install and authenticate the Supabase CLI, link this directory to the intended project, then apply committed migrations:

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

For a local Supabase stack, run `npx supabase start` and then `npx supabase db reset`. These commands execute the SQL; merely adding a migration file does not apply it. Apply every migration, including `20261015000100_phase5_property_management.sql`, `20261016000100_phase6_inquiry_rate_limit.sql`, and `20261019000100_profile_photos.sql`, before using the marketplace. The Phase 5 migration adds owner-only property deletion and ensures changes to published, rented, or sold properties return them to moderation. The Phase 6 migration requires an inquiry email address and limits each email address to three inquiries per ten minutes. The profile-photo migration adds the private, owner-restricted photo bucket.

## Dashboard configuration

- In **Authentication → Providers → Email**, enable email/password sign-in and keep **Confirm email** enabled in production.
- In **Authentication → URL Configuration**, set the **Site URL** to the deployed origin. Add exact redirect URLs for each environment, including `http://localhost:3000/auth/confirm` for local development and `https://YOUR_DOMAIN/auth/confirm` for production. Do not allow broad wildcard redirects in production.
- Configure the project API URL and publishable key as above.
- The migration creates a public `property-images` bucket (10 MiB maximum, JPEG/PNG/WebP/AVIF). Public photos are served by public URL and CDN, so anyone with a URL can view them. Upload, overwrite, and delete remain restricted by Storage RLS to the authenticated owner of the property identified by the path `{user_id}/{property_id}/{filename}`. Do not store private documents in this bucket.
- The `profile-photos` bucket is private (5 MiB maximum, JPEG/PNG/WebP). Each account can upload, read, and delete only its own UUID-named image under `{user_id}/`. The profile page uses short-lived signed URLs; the `profiles.avatar_url` column stores only the Storage path.
- Property-image metadata RLS also requires each stored path to use the same `{user_id}/{property_id}/` prefix as its owning listing, preventing a listing owner from attaching another owner's public Storage object to their listing.
- Administrative authorization uses the protected `app_metadata.role = "admin"` claim. Assign it only through the Supabase Admin API/service-role tooling in a trusted administrative environment. Never set it from client-editable user metadata. Admins change publication/verification state with `review_property`; this app does not include an admin UI.
- Owners manage their own listings through authenticated Supabase requests and RLS. New listings can be saved as drafts or submitted for review; clients cannot set verification/publication fields. Editing a published, rented, or sold property automatically clears its live status and verification and sends it back to pending review. Deleting a property removes its owned Storage objects first, then deletes the row (and cascaded image metadata).

## Authentication (Phase 4)

1. In **Authentication → Email Templates → Confirm signup**, retain the Supabase `{{ .ConfirmationURL }}` link and include `{{ .Token }}` in the same message. For example:

   ```html
   <h2>Confirm your NyumbaNest account</h2>
   <p><a href="{{ .ConfirmationURL }}">Verify email</a></p>
   <p>Or enter this verification code in NyumbaNest: <strong>{{ .Token }}</strong></p>
   ```

   Supabase's default confirmation URL verifies the email and redirects through `/auth/confirm`; manual signup codes use `verifyOtp({ email, token, type: "email" })`. Resending uses Supabase's `resend({ type: "signup" })`. Both methods consume a one-time verification token, so the other method is no longer needed after success.
2. In **Authentication → Email Templates → Reset Password**, retain `{{ .ConfirmationURL }}` and include `{{ .Token }}` in the same email:

   ```html
   <h2>Reset your NyumbaNest password</h2>
   <p><a href="{{ .ConfirmationURL }}">Reset password</a></p>
   <p>Or enter this recovery code in NyumbaNest: <strong>{{ .Token }}</strong></p>
   ```

   The recovery link returns through `/auth/confirm` and opens `/reset-password`. Manual recovery codes are entered on `/forgot-password` and verified with `verifyOtp({ email, token, type: "recovery" })`. The application sets a short-lived, HttpOnly recovery grant after either server-verified recovery method and requires it for a password update.
3. Ensure the configured email OTP length is 6–10 digits; both manual code forms accept that range. The email OTP expiration setting governs code/link expiry.
4. For local development, the Supabase CLI captures outgoing email in Mailpit. Supabase's hosted default sender is rate-limited; configure a custom SMTP provider in **Project Settings → Authentication → SMTP Settings** and verify its sender domain for production. Check SMTP credentials, sender verification, the provider confirmation setting, redirect allow-list, rate limits, and spam filtering if messages do not arrive.

Signup passes `full_name` as Supabase Auth user metadata; the existing database trigger initializes the profile. Passwords remain in Supabase Auth and OTPs are handled by Supabase Auth; neither is written to application tables or logged by the app. A successful recovery request is presented identically whether or not the address belongs to an account. Supabase's response confirms that the request was accepted, not that an email reached the recipient; actual delivery depends on Auth and SMTP configuration.

## Access model

- Visitors and authenticated users can select published listing display fields only. Exact street addresses and coordinates are excluded from table SELECT grants and are returned by `get_owned_property_private_location` only when the caller owns the requested listing.
- Public search, category, homepage, and detail pages explicitly query published records, use bounded pagination, and select only fields granted for public display. The exact address, owner email, phone, and profile rows are never exposed in public property metadata or cards.
- Owners create listings only with their own `auth.uid()` and cannot set verification or publication timestamps. They can edit their own listings; edits to live, rented, or sold records are returned to pending review automatically. Publishing/rejection and verification are administrative actions.
- Profiles are private to their owner. Auth-triggered initialization copies name, email, and avatar metadata; client updates are limited to name, avatar, and phone.
- Favorites are private to their user. Inquiries accept submissions only for published listings and are readable by the sender or listing owner. Contact data is not public. Inquiry submissions also use a form honeypot, server validation, and a database email-based rate limit.
- All five application tables have RLS enabled, with explicit grants plus row policies. No client-supplied owner ID is treated as proof of ownership. Property owners can delete only their own rows; deleting a property cascades its image metadata after the application removes the corresponding Storage objects.
