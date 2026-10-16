import type { Metadata } from "next";
import { MarketplaceHomepage } from "@/components/marketplace/homepage";

export const metadata: Metadata = {
  title: "NyumbaNest | Find a place to call yours",
  description:
    "Discover quality homes, apartments, land, and commercial properties across Tanzania.",
  alternates: { canonical: "/" },
};
export const instant = false;

export default function Home() {
  return <MarketplaceHomepage />;
}
