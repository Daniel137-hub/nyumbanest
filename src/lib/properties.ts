import type { Database } from "@/types/database";

export type PropertyRow = Database["public"]["Tables"]["properties"]["Row"];
export type OwnerPropertyRow = Omit<PropertyRow, "address" | "latitude" | "longitude">;
export type PropertyImageRow = Database["public"]["Tables"]["property_images"]["Row"];
export type ListingStatus = PropertyRow["status"];
export type SubmissionStatus = Extract<ListingStatus, "draft" | "pending_review">;
export type TransactionType = PropertyRow["transaction_type"];
export type PropertyType = PropertyRow["property_type"];

export type PropertyFormValues = {
  title: string;
  description: string;
  transaction_type: TransactionType;
  property_type: PropertyType;
  price: string;
  region: string;
  district: string;
  neighborhood: string;
  address: string;
  area_sqm: string;
  bedrooms: string;
  bathrooms: string;
  parking_spaces: string;
  furnished: string;
  amenities: string;
  latitude: string;
  longitude: string;
};

export type PropertyWrite = Omit<
  Database["public"]["Tables"]["properties"]["Insert"],
  "id" | "owner_id" | "status" | "is_verified" | "published_at" | "created_at" | "updated_at"
>;

export type PropertyWithImages = {
  property: OwnerPropertyRow;
  images: Array<PropertyImageRow & { publicUrl: string }>;
  ownerName?: string;
};

export const OWNER_PROPERTY_COLUMNS =
  "id,owner_id,title,description,transaction_type,property_type,price,currency,region,district,neighborhood,area_sqm,bedrooms,bathrooms,parking_spaces,furnished,amenities,status,is_verified,published_at,created_at,updated_at";

export const EMPTY_PROPERTY_FORM: PropertyFormValues = {
  title: "",
  description: "",
  transaction_type: "sale",
  property_type: "house",
  price: "",
  region: "",
  district: "",
  neighborhood: "",
  address: "",
  area_sqm: "",
  bedrooms: "",
  bathrooms: "",
  parking_spaces: "",
  furnished: "",
  amenities: "",
  latitude: "",
  longitude: "",
};

const PROPERTY_TYPES: PropertyType[] = ["house", "apartment", "land", "commercial", "other"];
const TRANSACTION_TYPES: TransactionType[] = ["sale", "rent"];
const MAX_PRICE = 999_999_999_999.99;
const MAX_AREA = 9_999_999_999.99;

function optionalNumber(value: string, label: string, maximum: number, positive = false): number | null {
  if (value === "") return null;
  const number = Number(value);
  const fractionDigits = value.split(".")[1]?.length ?? 0;
  if (!Number.isFinite(number) || number < (positive ? Number.MIN_VALUE : 0) ||
    number > maximum || fractionDigits > 2 || !/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)) {
    throw new Error(`${label} must be a valid ${positive ? "positive " : ""}number.`);
  }
  return number;
}

function optionalInteger(value: string, label: string): number | null {
  if (value === "") return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 32_767) {
    throw new Error(`${label} must be a whole number from 0 to 32,767.`);
  }
  return number;
}

function text(value: unknown, label: string, maximum: number, required = false): string | null {
  if (typeof value !== "string") throw new Error(`Enter a valid ${label.toLowerCase()}.`);
  const result = value.trim();
  if (required && !result) throw new Error(`Enter a ${label.toLowerCase()}.`);
  if (result.length > maximum) throw new Error(`${label} must be ${maximum} characters or fewer.`);
  return result || null;
}

function coordinate(value: string, label: string, minimum: number, maximum: number): number | null {
  if (value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}.`);
  }
  return number;
}

export function validatePropertyForm(value: unknown): PropertyWrite {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Enter the property details and try again.");
  }
  const form = value as Partial<PropertyFormValues>;
  const title = text(form.title, "Title", 180, true)!;
  const description = text(form.description, "Description", 12_000);
  const region = text(form.region, "Region", 120, true)!;
  const district = text(form.district, "District", 120);
  const neighborhood = text(form.neighborhood, "Neighborhood", 160);
  const address = text(form.address, "Address", 500);
  if (!TRANSACTION_TYPES.includes(form.transaction_type as TransactionType)) {
    throw new Error("Choose whether the property is for sale or rent.");
  }
  if (!PROPERTY_TYPES.includes(form.property_type as PropertyType)) {
    throw new Error("Choose a valid property type.");
  }
  if (typeof form.price !== "string" || form.price === "") throw new Error("Enter the property price.");
  const price = Number(form.price);
  if (!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(form.price) ||
    !Number.isFinite(price) || price < 0 || price > MAX_PRICE) {
    throw new Error("Enter a valid price in TSh, up to two decimal places.");
  }
  if (typeof form.area_sqm !== "string" || typeof form.bedrooms !== "string" ||
    typeof form.bathrooms !== "string" || typeof form.parking_spaces !== "string" ||
    typeof form.latitude !== "string" || typeof form.longitude !== "string" ||
    typeof form.furnished !== "string" || typeof form.amenities !== "string") {
    throw new Error("Some property details are missing or invalid.");
  }
  const isLand = form.property_type === "land";
  const hasRooms = form.property_type === "house" || form.property_type === "apartment";
  const latitude = coordinate(form.latitude, "Latitude", -90, 90);
  const longitude = coordinate(form.longitude, "Longitude", -180, 180);
  if ((latitude === null) !== (longitude === null)) {
    throw new Error("Enter both latitude and longitude, or leave both blank.");
  }
  const furnished = isLand || !hasRooms
    ? null
    : form.furnished === "true"
      ? true
      : form.furnished === "false"
        ? false
        : null;
  const amenities = form.amenities
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (amenities.length > 50 || amenities.some((item) => item.length > 100)) {
    throw new Error("Enter no more than 50 amenities, each up to 100 characters.");
  }

  return {
    title,
    description,
    transaction_type: form.transaction_type as TransactionType,
    property_type: form.property_type as PropertyType,
    price,
    currency: "TZS",
    region,
    district,
    neighborhood,
    address,
    area_sqm: optionalNumber(form.area_sqm, "Property area", MAX_AREA, true),
    bedrooms: hasRooms ? optionalInteger(form.bedrooms, "Bedrooms") : null,
    bathrooms: hasRooms ? optionalInteger(form.bathrooms, "Bathrooms") : null,
    parking_spaces: optionalInteger(form.parking_spaces, "Parking spaces"),
    furnished,
    amenities,
    latitude,
    longitude,
  };
}

export function propertyFormFromRow(property: PropertyRow): PropertyFormValues {
  return {
    title: property.title,
    description: property.description ?? "",
    transaction_type: property.transaction_type,
    property_type: property.property_type,
    price: String(property.price),
    region: property.region,
    district: property.district ?? "",
    neighborhood: property.neighborhood ?? "",
    address: property.address ?? "",
    area_sqm: property.area_sqm === null ? "" : String(property.area_sqm),
    bedrooms: property.bedrooms === null ? "" : String(property.bedrooms),
    bathrooms: property.bathrooms === null ? "" : String(property.bathrooms),
    parking_spaces: property.parking_spaces === null ? "" : String(property.parking_spaces),
    furnished: property.furnished === null ? "" : String(property.furnished),
    amenities: property.amenities.join(", "),
    latitude: property.latitude === null ? "" : String(property.latitude),
    longitude: property.longitude === null ? "" : String(property.longitude),
  };
}

export function propertyStatusLabel(status: ListingStatus): string {
  return {
    draft: "Draft",
    pending_review: "Pending review",
    published: "Published",
    rejected: "Needs changes",
    rented: "Rented",
    sold: "Sold",
  }[status];
}
