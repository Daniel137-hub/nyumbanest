NyumbaNest is a Tanzania-focused property marketplace built with the Next.js App Router, React, TypeScript, Tailwind CSS, and Supabase.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Supabase authentication

Create a root `.env.local` containing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Use values from the Supabase project API settings; never use a service-role key in this app. See [Supabase setup and access policies](./supabase/README.md) for schema, RLS, and full email configuration.

Set `NEXT_PUBLIC_SITE_URL` to the site's canonical origin in production so canonical links and social metadata use the public domain. On Vercel, `VERCEL_URL` is used as a fallback.

For email/password signup, verification links, and OTPs:

1. Enable Email as an authentication provider and keep **Confirm email** enabled.
2. Set the Site URL and allow-list the exact callback URLs for each environment, including `http://localhost:3000/auth/confirm` and `https://YOUR_DOMAIN/auth/confirm`.
3. In **Authentication → Email Templates → Confirm signup** and **Reset Password**, include both the standard `{{ .ConfirmationURL }}` link and `{{ .Token }}` code. See [Supabase setup and access policies](./supabase/README.md) for copyable templates. Signup links use `/auth/confirm`; signup OTPs use type `email`; recovery links use `/auth/confirm`; recovery OTPs use type `recovery` on `/forgot-password`.
4. Keep the configured email OTP length between 6 and 10 digits. The verification forms accept that range.

The hosted default email sender is rate-limited; configure a custom SMTP provider and verify its sender domain for production. Supabase CLI local development captures outgoing emails in Mailpit.

## Property management (Phase 5)

Apply all migrations, including the Phase 5 property-management migration, with `npx supabase db push` before using `/my-listings`. Owners can save listings as drafts or submit them for review. Photographs are stored in the existing public `property-images` bucket under the RLS-protected path `{user_id}/{property_id}/{uuid}.{ext}` and recorded in `property_images`. Edits to published, rented, or sold listings return them to pending review; only an administrator can publish or verify them again. See [Supabase setup and access policies](./supabase/README.md) for the bucket and RLS details.

## Public marketplace (Phase 6)

The homepage and `/search`, `/properties`, `/buy`, `/rent`, `/land`, `/commercial`, and `/properties/[id]` load published listings from Supabase. Search filters and sorting are encoded in the URL, and property results are paginated. Exact addresses and owner contact records remain private; visitors contact owners through the inquiry form. Signed-in users can save listings to `/saved`. Apply `20261016000100_phase6_inquiry_rate_limit.sql` with the other migrations to require a contact email and limit each email address to three inquiries per ten minutes.

When accessing the Next.js development server from another device on this LAN, use the configured dev origin `192.168.0.184` or update `allowedDevOrigins` in `next.config.ts` to that device-facing hostname/IP, then restart `next dev`. Client JavaScript is required for the authentication forms; the auth forms use POST as a safe fallback so credentials are not placed in a GET query string if client hydration fails.

## Validate

Run `npm run lint`, `npx tsc --noEmit`, and `npm test`. The Playwright suites run against a local mock Auth, PostgREST, and Storage API; they do not create real Supabase rows, upload to a real bucket, or send email.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
