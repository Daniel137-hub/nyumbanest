import type { Metadata } from "next";
import { MarketplacePage } from "@/components/marketplace/marketplace-pages";

export const metadata: Metadata = {
  title: "Pricing | NyumbaNest",
  description: "Information about NyumbaNest pricing and subscriptions.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <MarketplacePage
      eyebrow="Pricing"
      title="Pricing information"
      description="NyumbaNest does not currently offer published pricing or subscription plans. Browse properties or manage your listings using the options available in the application."
      actionLabel="Browse properties"
      actionHref="/properties"
    />
  );
}
