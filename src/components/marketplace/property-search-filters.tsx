"use client";

import type { MarketplaceFilters } from "@/lib/marketplace";

export function PropertySearchFilters({
  path,
  filters,
}: {
  path: string;
  filters: MarketplaceFilters;
}) {
  return (
    <form className="property-search-filters" action={path} method="get" role="search">
      <label>
        Location
        <input name="location" type="search" maxLength={80} placeholder="Region, district or neighborhood"
          defaultValue={filters.location} />
      </label>
      <label>
        Transaction
        <select name="transaction" defaultValue={filters.transaction ?? ""}>
          <option value="">Buy or rent</option>
          <option value="sale">For sale</option>
          <option value="rent">For rent</option>
        </select>
      </label>
      <label>
        Property type
        <select name="type" defaultValue={filters.type ?? ""}>
          <option value="">Any type</option>
          <option value="house">House</option>
          <option value="apartment">Apartment</option>
          <option value="land">Land</option>
          <option value="commercial">Commercial</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label>
        Minimum price (TSh)
        <input name="minPrice" type="number" min="0" max="999999999999" step="1"
          defaultValue={filters.minPrice} />
      </label>
      <label>
        Maximum price (TSh)
        <input name="maxPrice" type="number" min="0" max="999999999999" step="1"
          defaultValue={filters.maxPrice} />
      </label>
      <label>
        Minimum bedrooms
        <input name="bedrooms" type="number" min="0" max="100" step="1"
          defaultValue={filters.bedrooms} />
      </label>
      <label>
        Minimum area (m²)
        <input name="minArea" type="number" min="0.01" max="1000000" step="0.01"
          defaultValue={filters.minArea} />
      </label>
      <label>
        Sort by
        <select name="sort" defaultValue={filters.sort}>
          <option value="newest">Newest</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </select>
      </label>
      <button className="button button--primary" type="submit">Apply filters</button>
    </form>
  );
}
