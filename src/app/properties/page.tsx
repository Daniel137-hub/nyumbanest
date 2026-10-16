import type { Metadata } from "next";
import { PublicListingsPage } from "@/components/marketplace/public-listings-page";

export const metadata: Metadata = {
  title: "Properties in Tanzania | NyumbaNest",
  description: "Browse available property listings across Tanzania.",
  alternates: { canonical: "/properties" },
  openGraph: {
    type: "website",
    title: "Properties in Tanzania | NyumbaNest",
    description: "Browse published property listings across Tanzania.",
  },
};
export const instant = false;

export default function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <PublicListingsPage
      searchParams={searchParams}
      preset={{
        path: "/properties",
        title: "All properties",
        description: "Browse published homes, apartments, land, and commercial properties from across Tanzania.",
      }}
    />
  );
}
