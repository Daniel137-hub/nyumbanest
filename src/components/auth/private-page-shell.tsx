import { MobileBottomNavigation } from "@/components/marketplace/marketplace-chrome";
import { MarketplaceNavigation } from "@/components/marketplace/marketplace-navigation";

export function PrivatePageShell({
  eyebrow,
  title,
  children,
  activeItem = "Profile",
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  activeItem?: "Saved" | "Listings" | "Profile";
}) {
  return <div className="marketplace-page">
    <div className="marketplace-shell marketplace-shell--subpage">
      <MarketplaceNavigation />
      <main className="destination-page private-page">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {children}
      </main>
    </div>
    <MobileBottomNavigation activeItem={activeItem} />
  </div>;
}
