import type { Metadata } from "next";
import { PublicListingsPage } from "@/components/marketplace/public-listings-page";

export const metadata: Metadata = {
  title: "Commercial property in Tanzania | NyumbaNest",
  description: "Browse published commercial real estate for sale and rent across Tanzania.",
  alternates: { canonical: "/commercial" },
  openGraph: {
    type: "website",
    title: "Commercial property in Tanzania | NyumbaNest",
    description: "Browse published commercial real estate for sale and rent across Tanzania.",
  },
};
export const instant = false;

export default function CommercialPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <PublicListingsPage
      searchParams={searchParams}
      preset={{
        path: "/commercial",
        title: "Commercial property",
        description: "Find commercial properties listed for sale or rent across Tanzania.",
        type: "commercial",
      }}
    />
  );
}
