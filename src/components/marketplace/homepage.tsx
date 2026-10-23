import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FavoriteControl } from "@/components/marketplace/favorite-control";
import { MobileBottomNavigation } from "@/components/marketplace/marketplace-chrome";
import { MarketplaceNavigation } from "@/components/marketplace/marketplace-navigation";
import { HomepageHero } from "@/components/marketplace/homepage-hero";
import { PropertyCard, PropertyOwnerBanner, TrustFeatures } from "@/components/marketplace/marketplace-content";
import { getFavoritePropertyIds, getPublicListings, getPublicViewer } from "@/lib/marketplace";

const featuredFilters = {
  sort: "newest" as const,
  page: 1,
  invalid: false,
};

export async function MarketplaceHomepage() {
  const [listings, viewer] = await Promise.all([
    getPublicListings(featuredFilters, { pageSize: 8, includeCount: false }),
    getPublicViewer(),
  ]);
  const properties = listings.data ?? [];
  const favoriteQuery = viewer.user && properties.length
    ? await getFavoritePropertyIds(viewer.user.id, properties.map((item) => item.id))
    : viewer.error
      ? { data: null, error: viewer.error }
      : { data: new Set<string>(), error: null };

  return (
    <div className="marketplace-page">
      <div className="marketplace-shell">
        <MarketplaceNavigation />
        <main>
          <HomepageHero />
          <section className="listing-section" aria-label="Featured properties">
            <div className="listing-section__heading">
              <div>
                <p className="eyebrow">Made for your next chapter</p>
                <h2>Find your place in Tanzania</h2>
              </div>
              <Link className="listing-section__all" href="/properties">
                View all <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <nav className="category-filters" aria-label="Property categories">
              <Link className="category-chip is-selected" href="/properties">All properties</Link>
              <Link className="category-chip" href="/buy">For sale</Link>
              <Link className="category-chip" href="/rent">For rent</Link>
              <Link className="category-chip" href="/land">Land</Link>
              <Link className="category-chip" href="/commercial">Commercial</Link>
            </nav>
            {favoriteQuery.error ? (
              <p className="marketplace-notice" role="alert">{favoriteQuery.error}</p>
            ) : null}
            {listings.error ? (
              <section className="marketplace-error" role="alert">
                <h2>Featured properties are unavailable</h2>
                <p>{listings.error}</p>
                <Link className="button button--secondary" href="/">Retry</Link>
              </section>
            ) : properties.length ? (
              <div className="property-grid">
                {properties.map(({ id, property }) => (
                  <PropertyCard
                    key={id}
                    property={property}
                    detailsHref={`/properties/${id}`}
                    hideFavorite={Boolean(favoriteQuery.error)}
                    favoriteAction={
                      <FavoriteControl
                        propertyId={id}
                        title={property.title}
                        isSaved={favoriteQuery.data?.has(id) ?? false}
                        isAuthenticated={Boolean(viewer.user)}
                        next={`/properties/${id}`}
                      />
                    }
                  />
                ))}
              </div>
            ) : (
              <section className="marketplace-empty">
                <h2>No properties are listed yet</h2>
                <p>Check back soon or browse all published property listings.</p>
                <Link className="button button--primary" href="/properties">Browse properties</Link>
              </section>
            )}
          </section>
          <PropertyOwnerBanner />
          <TrustFeatures />
        </main>
        <footer className="site-footer">
          <Link className="brand brand--footer" href="/">NyumbaNest</Link>
          <span>Find a place to call yours, across Tanzania.</span>
          <Link href="/my-listings/new">List your property <ArrowRight size={14} aria-hidden="true" /></Link>
        </footer>
      </div>
      <MobileBottomNavigation activeItem="Home" />
    </div>
  );
}
