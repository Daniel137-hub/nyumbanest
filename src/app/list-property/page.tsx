import type { Metadata } from "next";
import { MarketplacePage } from "@/components/marketplace/marketplace-pages";

export const metadata: Metadata = { title: "List a property | NyumbaNest" };

export default function ListPropertyPage() {
  return (
    <MarketplacePage
      eyebrow="For property owners"
      title="Bring your property to the right people."
      description="Share your home, land, or commercial space with buyers and tenants across Tanzania. Listing tools will be connected in a later phase."
      actionLabel="Continue to sign in"
      actionHref="/login"
      activeItem="Listings"
    />
  );
}
