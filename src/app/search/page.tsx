import type { Metadata } from "next";
import { PublicListingsPage } from "@/components/marketplace/public-listings-page";

export const metadata: Metadata = {
  title: "Search homes and property | NyumbaNest",
  description: "Search published homes, rentals, land, and commercial property across Tanzania.",
  alternates: { canonical: "/search" },
  openGraph: {
    type: "website",
    title: "Search homes and property | NyumbaNest",
    description: "Search published homes, rentals, land, and commercial property across Tanzania.",
  },
};
export const instant = false;

export default function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <PublicListingsPage
      searchParams={searchParams}
      preset={{
        path: "/search",
        title: "Explore properties",
        description: "Search published homes, rentals, land, and commercial property across Tanzania.",
      }}
    />
  );
}
