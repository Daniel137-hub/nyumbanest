export function getPublicImageUrl(path: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) throw new Error("Supabase URL is not configured.");
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/property-images/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

export function isLocalSupabaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!configuredUrl) return false;
  const hostname = new URL(configuredUrl).hostname;
  return hostname === "localhost" ||
    hostname === "[::1]" ||
    /^(?:127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(hostname);
}
