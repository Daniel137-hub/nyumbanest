import type { Metadata } from "next";
import { MarketplacePage } from "@/components/marketplace/marketplace-pages";

export const metadata: Metadata = { title: "My listings | NyumbaNest" };

export default function ListingsPage() {
  return (
    <MarketplacePage
      eyebrow="Property owner"
      title="Your listings, all in one place."
      description="Your property listings will appear here once owner accounts are available."
      actionLabel="Post a property"
      actionHref="/list-property"
      activeItem="Listings"
    />
  );
}
