import type { Metadata } from "next";
import { PublicListingsPage } from "@/components/marketplace/public-listings-page";

export const metadata: Metadata = {
  title: "Property for rent in Tanzania | NyumbaNest",
  description: "Browse homes, apartments, and commercial properties for rent in Tanzania.",
  alternates: { canonical: "/rent" },
  openGraph: {
    type: "website",
    title: "Property for rent in Tanzania | NyumbaNest",
    description: "Browse homes, apartments, and commercial properties for rent in Tanzania.",
  },
};
export const instant = false;

export default function RentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <PublicListingsPage
      searchParams={searchParams}
      preset={{
        path: "/rent",
        title: "Properties for rent",
        description: "Find a place to rent, from apartments and family homes to commercial spaces.",
        transaction: "rent",
      }}
    />
  );
}
