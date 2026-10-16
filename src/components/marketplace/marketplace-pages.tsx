import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { MobileBottomNavigation } from "@/components/marketplace/marketplace-chrome";
import { MarketplaceNavigation } from "@/components/marketplace/marketplace-navigation";

export function MarketplacePage({
  eyebrow,
  title,
  description,
  actionLabel = "Back to home",
  actionHref = "/",
  activeItem,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  activeItem?: "Search" | "Saved" | "Listings" | "Profile";
}) {
  return (
    <div className="marketplace-page">
      <div className="marketplace-shell marketplace-shell--subpage">
        <MarketplaceNavigation />
        <main className="destination-page">
          <Link className="back-link" href="/">
            <ArrowLeft size={15} aria-hidden="true" /> Home
          </Link>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="destination-page__description">{description}</p>
          <Link className="button button--primary" href={actionHref}>
            {actionLabel} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </main>
      </div>
      <MobileBottomNavigation activeItem={activeItem} />
    </div>
  );
}
