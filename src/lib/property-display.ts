export type PropertyType = "house" | "apartment" | "land" | "commercial" | "other";
export type TransactionType = "sale" | "rent";

export type PropertyFixture = {
  slug: string;
  title: string;
  location: string;
  region: string;
  image: string;
  imageAlt: string;
  price: number;
  transaction: TransactionType;
  type: PropertyType;
  bedrooms?: number;
  bathrooms?: number;
  areaSqm?: number;
  verified: boolean;
};

export function formatPropertyPrice(price: number, transaction: TransactionType) {
  const formatted = new Intl.NumberFormat("en-TZ", {
    maximumFractionDigits: 0,
  }).format(price);

  return transaction === "rent"
    ? `TSh ${formatted} / month`
    : `TSh ${formatted}`;
}
