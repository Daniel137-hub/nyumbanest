import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { FavoriteControl } from "@/components/marketplace/favorite-control";
import { MobileBottomNavigation } from "@/components/marketplace/marketplace-chrome";
import { MarketplaceNavigation } from "@/components/marketplace/marketplace-navigation";
import { PropertyCard } from "@/components/marketplace/marketplace-content";
import { PropertySearchFilters } from "@/components/marketplace/property-search-filters";
import {
  getFavoritePropertyIds,
  getPublicListings,
  getPublicViewer,
  marketplacePageSize,
  parseMarketplaceFilters,
  type MarketplaceFilters,
} from "@/lib/marketplace";

type SearchParams = Record<string, string | string[] | undefined>;

export type ListingPreset = {
  path: string;
  title: string;
  description: string;
  transaction?: "sale" | "rent";
  type?: "house" | "apartment" | "land" | "commercial" | "other";
};

function filtersForPreset(searchParams: SearchParams, preset: ListingPreset): MarketplaceFilters {
  const filters = parseMarketplaceFilters(searchParams);
  return {
    ...filters,
    transaction: filters.transaction ?? preset.transaction,
    type: filters.type ?? preset.type,
  };
}

function pageHref(path: string, filters: MarketplaceFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.location) params.set("location", filters.location);
  if (filters.transaction) params.set("transaction", filters.transaction);
  if (filters.type) params.set("type", filters.type);
  if (filters.minPrice !== undefined) params.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice !== undefined) params.set("maxPrice", String(filters.maxPrice));
  if (filters.bedrooms !== undefined) params.set("bedrooms", String(filters.bedrooms));
  if (filters.minArea !== undefined) params.set("minArea", String(filters.minArea));
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export async function PublicListingsPage({
  searchParams,
  preset,
}: {
  searchParams: Promise<SearchParams>;
  preset: ListingPreset;
}) {
  const filters = filtersForPreset(await searchParams, preset);
  const results = await getPublicListings(filters);
  const viewer = await getPublicViewer();
  const properties = results.data ?? [];
  const favoriteQuery = viewer.user && properties.length
    ? await getFavoritePropertyIds(viewer.user.id, properties.map((item) => item.id))
    : viewer.error
      ? { data: null, error: viewer.error }
      : { data: new Set<string>(), error: null };
  const totalPages = Math.ceil(results.count / marketplacePageSize());

  return (
    <div className="marketplace-page">
      <div className="marketplace-shell marketplace-shell--subpage">
        <MarketplaceNavigation />
        <main className="results-page">
          <p className="eyebrow">NyumbaNest Marketplace</p>
          <h1>{preset.title}</h1>
          <p className="results-page__summary">{preset.description}</p>
          <PropertySearchFilters path={preset.path} filters={filters} />
          {filters.invalid ? (
            <p className="marketplace-notice" role="status">Some invalid search filters were ignored. Please review your selections.</p>
          ) : null}
          {favoriteQuery.error ? (
            <p className="marketplace-notice" role="alert">{favoriteQuery.error}</p>
          ) : null}
          {results.error ? (
            <section className="marketplace-error" role="alert">
              <h2>Properties are temporarily unavailable</h2>
              <p>{results.error}</p>
              <Link className="button button--secondary" href={pageHref(preset.path, filters, filters.page)}>Retry</Link>
            </section>
          ) : properties.length ? (
            <>
              <p className="results-page__summary" aria-live="polite">
                {results.count} {results.count === 1 ? "property" : "properties"} found
              </p>
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
              {totalPages > 1 ? (
                <nav className="marketplace-pagination" aria-label="Property result pages">
                  {filters.page > 1 ? (
                    <Link href={pageHref(preset.path, filters, filters.page - 1)}>
                      <ChevronLeft size={18} aria-hidden="true" /> Previous
                    </Link>
                  ) : <span aria-disabled="true"><ChevronLeft size={18} aria-hidden="true" /> Previous</span>}
                  <span>Page {filters.page} of {totalPages}</span>
                  {filters.page < totalPages ? (
                    <Link href={pageHref(preset.path, filters, filters.page + 1)}>
                      Next <ChevronRight size={18} aria-hidden="true" />
                    </Link>
                  ) : <span aria-disabled="true">Next <ChevronRight size={18} aria-hidden="true" /></span>}
                </nav>
              ) : null}
            </>
          ) : (
            <section className="marketplace-empty">
              <h2>No matching properties</h2>
              <p>Try changing your filters or broadening your search to see available listings.</p>
              <Link className="button button--primary" href="/properties">
                Browse all properties <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </section>
          )}
        </main>
      </div>
      <MobileBottomNavigation activeItem="Search" />
    </div>
  );
}
