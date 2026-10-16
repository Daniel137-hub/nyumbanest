import type { Metadata } from "next";
import { PublicListingsPage } from "@/components/marketplace/public-listings-page";

export const metadata: Metadata = {
  title: "Property for sale in Tanzania | NyumbaNest",
  description: "Find homes, apartments, land, and commercial property for sale in Tanzania.",
  alternates: { canonical: "/buy" },
  openGraph: {
    type: "website",
    title: "Property for sale in Tanzania | NyumbaNest",
    description: "Find homes, apartments, land, and commercial property for sale in Tanzania.",
  },
};
export const instant = false;

export default function BuyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <PublicListingsPage
      searchParams={searchParams}
      preset={{
        path: "/buy",
        title: "Properties for sale",
        description: "Explore homes, apartments, land, and commercial listings available to buy.",
        transaction: "sale",
      }}
    />
  );
}
