import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Building2, ChevronRight, CreditCard, Heart, LogOut } from "lucide-react";
import { ProfilePhotoForm } from "@/components/auth/profile-photo-form";
import { MarketplaceNavigation } from "@/components/marketplace/marketplace-navigation";
import { MobileBottomNavigation } from "@/components/marketplace/marketplace-chrome";
import { requireAuthenticatedUser } from "@/lib/supabase/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Profile | NyumbaNest" };
export const instant = false;

export default async function ProfilePage() {
  const user = await requireAuthenticatedUser("/profile");
  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name,avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  const metadataName = typeof user.user_metadata.full_name === "string"
    ? user.user_metadata.full_name
    : null;
  const fullName = profile?.full_name || metadataName || "NyumbaNest member";
  let photoUrl: string | null = null;
  let photoLoadError: string | null = profileError
    ? "Your profile photo could not be loaded."
    : null;

  if (profileError && process.env.NODE_ENV !== "production") {
    console.error("[profile-photo] profile read failed", {
      code: profileError.code,
    });
  }

  if (profile?.avatar_url) {
    const photoPathPattern = new RegExp(`^${user.id}/[0-9a-f-]{36}\\.(?:jpg|png|webp)$`, "i");
    if (!photoPathPattern.test(profile.avatar_url)) {
      photoLoadError = "Your profile photo path is invalid.";
    } else {
      const { data, error } = await supabase.storage
        .from("profile-photos")
        .createSignedUrl(profile.avatar_url, 3600);
      if (error) {
        photoLoadError = "Your profile photo could not be loaded.";
        if (process.env.NODE_ENV !== "production") {
          console.error("[profile-photo] signed URL creation failed", {
            name: error.name,
            statusCode: error.statusCode,
          });
        }
      }
      else photoUrl = data.signedUrl;
    }
  }

  return (
    <div className="marketplace-page">
      <div className="marketplace-shell marketplace-shell--subpage">
        <MarketplaceNavigation />
        <main className="profile-page">
          <Link className="profile-page__back" href="/">
            <ArrowLeft size={17} aria-hidden="true" /> My Profile
          </Link>

          <section className="profile-card" aria-labelledby="profile-name">
            <div className="profile-card__identity">
              <ProfilePhotoForm photoUrl={photoUrl} />
              {photoLoadError ? <p className="profile-photo-form__message profile-photo-form__message--error" role="alert">{photoLoadError}</p> : null}
              <h1 id="profile-name">{fullName}</h1>
              <p className="profile-card__email">{user.email ?? "Email address unavailable"}</p>
              <p className="profile-card__caption">Your account information</p>
            </div>

            <nav className="profile-links" aria-label="Account pages">
              <Link className="profile-link" href="/my-listings">
                <span className="profile-link__icon"><Building2 size={19} aria-hidden="true" /></span>
                <span className="profile-link__copy">
                  <span className="profile-link__title">My Listings</span>
                  <span className="profile-link__description">Manage your property listings</span>
                </span>
                <ChevronRight className="profile-link__chevron" size={18} aria-hidden="true" />
              </Link>
              <Link className="profile-link" href="/saved">
                <span className="profile-link__icon"><Heart size={19} aria-hidden="true" /></span>
                <span className="profile-link__copy">
                  <span className="profile-link__title">Saved Properties</span>
                  <span className="profile-link__description">View properties you have saved</span>
                </span>
                <ChevronRight className="profile-link__chevron" size={18} aria-hidden="true" />
              </Link>
              <Link className="profile-link" href="/pricing">
                <span className="profile-link__icon"><CreditCard size={19} aria-hidden="true" /></span>
                <span className="profile-link__copy">
                  <span className="profile-link__title">Subscription &amp; Billing</span>
                  <span className="profile-link__description">Manage your plan and payments</span>
                </span>
                <ChevronRight className="profile-link__chevron" size={18} aria-hidden="true" />
              </Link>
            </nav>

            <form className="profile-signout" action={signOut}>
              <button type="submit">
                <LogOut size={18} aria-hidden="true" />
                Sign Out
              </button>
            </form>
          </section>
        </main>
      </div>
      <MobileBottomNavigation activeItem="Profile" />
    </div>
  );
}
