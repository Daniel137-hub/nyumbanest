import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireAuthenticatedUser } from "@/lib/supabase/auth-guard";
import { FavoriteControl } from "@/components/marketplace/favorite-control";
import { MobileBottomNavigation } from "@/components/marketplace/marketplace-chrome";
import { MarketplaceNavigation } from "@/components/marketplace/marketplace-navigation";
import { PropertyCard } from "@/components/marketplace/marketplace-content";
import { getSavedListings, marketplacePageSize, parseMarketplaceFilters } from "@/lib/marketplace";

export const metadata: Metadata = {
  title: "Saved properties | NyumbaNest",
  description: "Revisit the properties you have saved on NyumbaNest.",
  robots: { index: false, follow: false },
};
export const instant = false;

export default async function SavedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAuthenticatedUser("/saved");
  const filters = parseMarketplaceFilters(await searchParams);
  const result = await getSavedListings(user.id, filters.page);
  const totalPages = Math.ceil(result.count / marketplacePageSize());
  const path = "/saved";

  return (
    <div className="marketplace-page">
      <div className="marketplace-shell marketplace-shell--subpage">
        <MarketplaceNavigation />
        <main className="results-page">
          <p className="eyebrow">Your shortlist</p>
          <h1>Saved properties</h1>
          <p className="results-page__summary">Keep the properties you love close and return to them anytime.</p>
          {result.error ? (
            <section className="marketplace-error" role="alert">
              <h2>We couldn&apos;t load your saved properties</h2>
              <p>{result.error}</p>
              <Link className="button button--secondary" href={path}>Retry</Link>
            </section>
          ) : result.data?.length ? (
            <>
              <div className="property-grid">
                {result.data.map(({ id, property }) => (
                  <PropertyCard
                    key={id}
                    property={property}
                    detailsHref={`/properties/${id}`}
                    favoriteAction={
                      <FavoriteControl
                        propertyId={id}
                        title={property.title}
                        isSaved
                        isAuthenticated
                        next={`/properties/${id}`}
                      />
                    }
                  />
                ))}
              </div>
              {totalPages > 1 ? (
                <nav className="marketplace-pagination" aria-label="Saved property pages">
                  {filters.page > 1 ? (
                    <Link href={`${path}?page=${filters.page - 1}`}>
                      <ChevronLeft size={18} aria-hidden="true" /> Previous
                    </Link>
                  ) : <span aria-disabled="true"><ChevronLeft size={18} aria-hidden="true" /> Previous</span>}
                  <span>Page {filters.page} of {totalPages}</span>
                  {filters.page < totalPages ? (
                    <Link href={`${path}?page=${filters.page + 1}`}>
                      Next <ChevronRight size={18} aria-hidden="true" />
                    </Link>
                  ) : <span aria-disabled="true">Next <ChevronRight size={18} aria-hidden="true" /></span>}
                </nav>
              ) : null}
            </>
          ) : (
            <section className="marketplace-empty">
              <h2>You haven&apos;t saved any properties yet</h2>
              <p>Tap the heart on a listing to keep it here for your next visit.</p>
              <Link className="button button--primary" href="/properties">Explore properties</Link>
            </section>
          )}
        </main>
      </div>
      <MobileBottomNavigation activeItem="Saved" />
    </div>
  );
}
