import type { Metadata } from "next";
import { PublicListingsPage } from "@/components/marketplace/public-listings-page";

export const metadata: Metadata = {
  title: "Land for sale and rent in Tanzania | NyumbaNest",
  description: "Discover published land listings available for sale or rent across Tanzania.",
  alternates: { canonical: "/land" },
  openGraph: {
    type: "website",
    title: "Land for sale and rent in Tanzania | NyumbaNest",
    description: "Discover published land listings available for sale or rent across Tanzania.",
  },
};
export const instant = false;

export default function LandPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <PublicListingsPage
      searchParams={searchParams}
      preset={{
        path: "/land",
        title: "Land",
        description: "Explore plots and land listings available for sale or rent.",
        type: "land",
      }}
    />
  );
}
