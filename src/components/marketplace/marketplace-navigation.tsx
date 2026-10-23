import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MarketplaceNavigationClient } from "@/components/marketplace/marketplace-chrome";

const PROFILE_PHOTO_BUCKET = "profile-photos";

async function AuthenticatedMarketplaceNavigation() {
  await connection();
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  let avatarUrl: string | null = null;

  if (authError) {
    if (authError.name !== "AuthSessionMissingError" && process.env.NODE_ENV !== "production") {
      console.error("[navigation-profile-photo] authentication lookup failed", {
        name: authError.name,
        code: authError.code,
      });
    }
  } else if (user) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[navigation-profile-photo] profile lookup failed", {
          code: profileError.code,
        });
      }
    } else if (profile?.avatar_url) {
      const ownedPhotoPath = new RegExp(
        `^${user.id}/[0-9a-f-]{36}\\.(?:jpg|png|webp)$`,
        "i",
      );
      if (ownedPhotoPath.test(profile.avatar_url)) {
        const { data, error } = await supabase.storage
          .from(PROFILE_PHOTO_BUCKET)
          .createSignedUrl(profile.avatar_url, 3600);

        if (error) {
          if (process.env.NODE_ENV !== "production") {
            console.error("[navigation-profile-photo] signed URL creation failed", {
              name: error.name,
              statusCode: error.statusCode,
            });
          }
        } else {
          avatarUrl = data.signedUrl;
        }
      }
    }
  }

  return <MarketplaceNavigationClient
    avatarUrl={avatarUrl}
    isAdmin={user ? user.app_metadata.role === "admin" : false}
  />;
}

export function MarketplaceNavigation() {
  return (
    <Suspense fallback={<MarketplaceNavigationClient avatarUrl={null} />}>
      <AuthenticatedMarketplaceNavigation />
    </Suspense>
  );
}
