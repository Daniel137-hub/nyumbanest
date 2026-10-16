import { connection } from "next/server";
import { getPublicImageUrl } from "@/lib/property-image-url";
import type { PropertyFixture } from "@/lib/property-display";
import { createClient } from "@/lib/supabase/server";

const PROPERTY_COLUMNS =
  "id,title,description,transaction_type,property_type,price,currency,region,district,neighborhood,area_sqm,bedrooms,bathrooms,parking_spaces,furnished,amenities,status,is_verified,published_at,created_at,updated_at";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PAGE = 10_000;
const MAX_PRICE = 999_999_999_999.99;
const PAGE_SIZE = 24;

export type MarketplaceFilters = {
  location?: string;
  transaction?: "sale" | "rent";
  type?: "house" | "apartment" | "land" | "commercial" | "other";
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  minArea?: number;
  sort: "newest" | "price_asc" | "price_desc";
  page: number;
  invalid: boolean;
  ids?: string[];
};

type QueryParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseNumber(value: string | undefined, minimum: number, maximum: number, integer = false) {
  if (!value || !/^\d+(?:\.\d{1,2})?$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum &&
    (!integer || Number.isInteger(parsed)) ? parsed : undefined;
}

export function parseMarketplaceFilters(params: QueryParams): MarketplaceFilters {
  const locationValue = firstValue(params.location)?.trim();
  const location = locationValue
    ? locationValue.replace(/[^\p{L}\p{N}\s,'-]/gu, "").replace(/\s+/g, " ").slice(0, 80).trim()
    : undefined;
  const transactionValue = firstValue(params.transaction);
  const typeValue = firstValue(params.type);
  const sortValue = firstValue(params.sort);
  const rawMin = firstValue(params.minPrice);
  const rawMax = firstValue(params.maxPrice);
  const rawBedrooms = firstValue(params.bedrooms);
  const rawArea = firstValue(params.minArea);
  const rawPage = firstValue(params.page);
  const minPrice = parseNumber(rawMin, 0, MAX_PRICE);
  const maxPrice = parseNumber(rawMax, 0, MAX_PRICE);
  const bedrooms = parseNumber(rawBedrooms, 0, 100, true);
  const minArea = parseNumber(rawArea, 0.01, 1_000_000);
  const pageValue = rawPage && /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
  const page = Number.isSafeInteger(pageValue) && pageValue >= 1 && pageValue <= MAX_PAGE ? pageValue : 1;
  const invalidPriceRange = minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice;

  return {
    location,
    transaction: transactionValue === "sale" || transactionValue === "rent" ? transactionValue : undefined,
    type: typeValue === "house" || typeValue === "apartment" || typeValue === "land" ||
      typeValue === "commercial" || typeValue === "other" ? typeValue : undefined,
    minPrice: invalidPriceRange ? undefined : minPrice,
    maxPrice: invalidPriceRange ? undefined : maxPrice,
    bedrooms,
    minArea,
    sort: sortValue === "price_asc" || sortValue === "price_desc" ? sortValue : "newest",
    page,
    invalid:
      (locationValue !== undefined && !location) ||
      (transactionValue !== undefined && transactionValue !== "sale" && transactionValue !== "rent") ||
      (typeValue !== undefined && !["house", "apartment", "land", "commercial", "other"].includes(typeValue)) ||
      (rawMin !== undefined && minPrice === undefined) ||
      (rawMax !== undefined && maxPrice === undefined) ||
      invalidPriceRange ||
      (rawBedrooms !== undefined && bedrooms === undefined) ||
      (rawArea !== undefined && minArea === undefined) ||
      (sortValue !== undefined && !["newest", "price_asc", "price_desc"].includes(sortValue)) ||
      (rawPage !== undefined && pageValue !== page),
  };
}

export type PublicProperty = {
  id: string;
  title: string;
  description: string | null;
  transaction_type: "sale" | "rent";
  property_type: "house" | "apartment" | "land" | "commercial" | "other";
  price: number;
  currency: string;
  region: string;
  district: string | null;
  neighborhood: string | null;
  area_sqm: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking_spaces: number | null;
  furnished: boolean | null;
  amenities: string[];
  is_verified: boolean;
  created_at: string;
};

export type PublicPropertyImage = {
  storage_path: string;
  alt_text: string | null;
  sort_order: number;
};

export type PropertyCardData = {
  property: PropertyFixture;
  id: string;
  images: PublicPropertyImage[];
};

function mapProperty(property: PublicProperty, images: PublicPropertyImage[]): PropertyCardData {
  const location = [property.neighborhood, property.district, property.region]
    .filter((part): part is string => Boolean(part))
    .join(", ");
  const firstImage = images[0];

  return {
    id: property.id,
    images,
    property: {
      slug: property.id,
      title: property.title,
      location,
      region: property.region,
      image: firstImage ? getPublicImageUrl(firstImage.storage_path) : "",
      imageAlt: firstImage?.alt_text || property.title,
      price: property.price,
      transaction: property.transaction_type,
      type: property.property_type,
      bedrooms: property.bedrooms ?? undefined,
      bathrooms: property.bathrooms ?? undefined,
      areaSqm: property.area_sqm ?? undefined,
      verified: property.is_verified,
    },
  };
}

export async function getPublicListings(filters: MarketplaceFilters) {
  await connection();
  try {
    const supabase = await createClient();
    let query = supabase.from("properties").select(PROPERTY_COLUMNS, { count: "exact" })
      .eq("status", "published");

    if (filters.ids) query = query.in("id", filters.ids);
    if (filters.transaction) query = query.eq("transaction_type", filters.transaction);
    if (filters.type) query = query.eq("property_type", filters.type);
    if (filters.minPrice !== undefined) query = query.gte("price", filters.minPrice);
    if (filters.maxPrice !== undefined) query = query.lte("price", filters.maxPrice);
    if (filters.bedrooms !== undefined) query = query.gte("bedrooms", filters.bedrooms);
    if (filters.minArea !== undefined) query = query.gte("area_sqm", filters.minArea);
    if (filters.location) {
      const pattern = filters.location.replace(/[\\,().:*%_]/g, "");
      if (pattern) {
        query = query.or(
          `region.ilike.%${pattern}%,district.ilike.%${pattern}%,neighborhood.ilike.%${pattern}%`,
        );
      }
    }

    query = query.order(
      filters.sort === "newest" ? "published_at" : "price",
      { ascending: filters.sort === "price_asc" },
    );
    if (filters.sort === "newest") query = query.order("created_at", { ascending: false });

    const from = (filters.page - 1) * PAGE_SIZE;
    const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) return { data: null, count: 0, error: "We couldn't load properties right now. Please try again." };

    const properties = data ?? [];
    if (properties.length === 0) return { data: [] as PropertyCardData[], count: count ?? 0, error: null };

    const ids = properties.map(({ id }) => id);
    const { data: imageRows, error: imageError } = await supabase.from("property_images")
      .select("storage_path,alt_text,sort_order,property_id")
      .in("property_id", ids)
      .order("sort_order", { ascending: true });
    if (imageError) return { data: null, count: 0, error: "We couldn't load property photographs. Please try again." };

    const imagesById = new Map<string, PublicPropertyImage[]>();
    for (const image of imageRows ?? []) {
      const rows = imagesById.get(image.property_id) ?? [];
      rows.push({ storage_path: image.storage_path, alt_text: image.alt_text, sort_order: image.sort_order });
      imagesById.set(image.property_id, rows);
    }
    return {
      data: properties.map((property) => mapProperty(property, imagesById.get(property.id) ?? [])),
      count: count ?? 0,
      error: null,
    };
  } catch {
    return { data: null, count: 0, error: "We couldn't reach the property service. Please try again." };
  }
}

export async function getPublicProperty(propertyId: string) {
  if (!UUID_PATTERN.test(propertyId)) return { data: null, error: null };
  await connection();
  try {
    const supabase = await createClient();
    const { data: property, error } = await supabase.from("properties")
      .select(PROPERTY_COLUMNS)
      .eq("id", propertyId)
      .eq("status", "published")
      .maybeSingle();
    if (error) return { data: null, error: "We couldn't load this property. Please try again." };
    if (!property) return { data: null, error: null };

    const { data: images, error: imageError } = await supabase.from("property_images")
      .select("storage_path,alt_text,sort_order")
      .eq("property_id", propertyId)
      .order("sort_order", { ascending: true });
    if (imageError) return { data: null, error: "We couldn't load this property's photographs. Please try again." };

    const publicProperty: PublicProperty = property;
    return {
      data: {
        ...mapProperty(publicProperty, images ?? []),
        record: publicProperty,
      },
      error: null,
    };
  } catch {
    return { data: null, error: "We couldn't reach the property service. Please try again." };
  }
}

export async function getFavoritePropertyIds(userId: string, propertyIds: string[]) {
  if (!propertyIds.length) return { data: new Set<string>(), error: null };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("favorites")
      .select("property_id")
      .eq("user_id", userId)
      .in("property_id", propertyIds);
    if (error) return { data: null, error: "We couldn't load your saved properties. Please refresh and try again." };
    return { data: new Set((data ?? []).map((favorite) => favorite.property_id)), error: null };
  } catch {
    return { data: null, error: "We couldn't load your saved properties. Please refresh and try again." };
  }
}

export async function getPublicViewer() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error && error.name !== "AuthSessionMissingError") {
      return { user: null, error: "We couldn't check your saved-property session." };
    }
    return { user, error: null };
  } catch {
    return { user: null, error: "We couldn't check your saved-property session." };
  }
}

export async function getSimilarListings(property: PublicProperty, excludeId: string) {
  const filters: MarketplaceFilters = {
    location: property.region,
    transaction: property.transaction_type,
    type: property.property_type,
    sort: "newest",
    page: 1,
    invalid: false,
  };
  const results = await getPublicListings(filters);
  if (results.error || !results.data) return results;
  return {
    data: results.data.filter((item) => item.id !== excludeId).slice(0, 4),
    count: results.count,
    error: null,
  };
}

export async function getSavedListings(userId: string, page = 1) {
  try {
    const supabase = await createClient();
    const safePage = Number.isSafeInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1;
    const first = (safePage - 1) * PAGE_SIZE;
    const { data: favorites, error, count } = await supabase.from("favorites")
      .select("property_id", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(first, first + PAGE_SIZE - 1);
    if (error) return { data: null, count: 0, error: "We couldn't load your saved properties. Please try again." };
    const ids = (favorites ?? []).map((favorite) => favorite.property_id);
    if (ids.length === 0) return { data: [] as PropertyCardData[], count: count ?? 0, error: null };

    const results = await getPublicListings({
      sort: "newest",
      page: 1,
      invalid: false,
      ids,
    });
    if (results.error || !results.data) {
      return { data: null, count: count ?? 0, error: results.error };
    }
    const order = new Map(ids.map((id, index) => [id, index]));
    return {
      data: results.data.sort((left, right) =>
        (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0)),
      count: count ?? 0,
      error: null,
    };
  } catch {
    return { data: null, count: 0, error: "We couldn't load your saved properties. Please try again." };
  }
}

export function marketplacePageSize() {
  return PAGE_SIZE;
}
