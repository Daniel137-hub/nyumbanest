# NyumbaNest project instructions

## Project baseline

- Preserve the existing Next.js application; make focused changes and do not scaffold or replace the app.
- The current baseline is Next.js 16.4.0, React 19.3.0, Tailwind CSS 4.3.3, and strict TypeScript. Check `package.json` and the lockfile before relying on these versions.
- Routes currently live in `src/app/`. Tailwind CSS 4 is loaded with `@import "tailwindcss";` in `src/app/globals.css`; the Tailwind Turbopack CSS loader is configured in `next.config.ts`. Do not add a Tailwind v3 config or directives unless the setup is intentionally migrated.
- Before writing version-dependent Next.js code, read the applicable guide in `node_modules/next/dist/docs/`. Follow the installed version's App Router APIs and conventions.

## Engineering standards

- Use strict TypeScript and precise types. Prefer reusable, focused components and existing project patterns.
- Follow Next.js App Router conventions. Use Server Components by default; add `"use client"` only for UI that needs browser APIs, state, effects, or event handlers.
- Use accessible semantic HTML, meaningful labels, keyboard-operable controls, and appropriate loading, empty, error, and success states.
- Use consistent NyumbaNest design tokens. Define or reuse shared tokens rather than introducing one-off colors, spacing, or typography values.
- Implement production functionality with database-backed data, not hard-coded or fake records presented as real marketplace content.

## Supabase and security

- Use Supabase SSR authentication patterns appropriate to the installed Next.js and Supabase package versions. Keep server-only credentials and privileged operations on the server; never expose service-role keys or other secrets to the browser.
- Enforce Row Level Security (RLS) for private and user-owned records. Treat client-side checks as presentation only, not authorization.
- Validate and authorize mutations on the server, handle Supabase errors explicitly, and do not silently turn failures into successful or empty results.
- Do not add Supabase dependencies until the implementation requires them; then use the established package manager and update the lockfile.

## Scope and validation

- Do not modify unrelated files or install unnecessary dependencies. Preserve existing work, including staged or uncommitted changes.
- Before each implementation phase, inspect the relevant code and configuration. After each phase, run the smallest applicable lint, type-check, build, or test command and report what was actually run.
- Update directly related documentation when behavior or setup changes.
