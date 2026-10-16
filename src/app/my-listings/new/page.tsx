import type { Metadata } from "next";
import { PrivatePageShell } from "@/components/auth/private-page-shell";
import { PropertyForm } from "@/components/marketplace/property-form";
import { requireVerifiedUser } from "@/lib/supabase/auth-guard";

export const metadata: Metadata = { title: "Add a property | NyumbaNest" };
export const instant = false;

export default async function NewListingPage() {
  await requireVerifiedUser("/my-listings/new");
  return <PrivatePageShell eyebrow="For property owners" title="Add a property" activeItem="Listings">
    <p className="destination-page__description">Share your property details and choose whether to save a draft or submit it for review.</p>
    <PropertyForm />
  </PrivatePageShell>;
}
