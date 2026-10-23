"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown, MapPin, Search } from "lucide-react";
import type { PropertyType, TransactionType } from "@/lib/property-display";

const propertyTypeOptions: { label: string; value: PropertyType | "" }[] = [
  { label: "Property type", value: "" },
  { label: "House", value: "house" },
  { label: "Apartment", value: "apartment" },
  { label: "Land", value: "land" },
  { label: "Commercial", value: "commercial" },
];

export function HomepagePropertySearch() {
  const router = useRouter();
  const [transaction, setTransaction] = useState<TransactionType>("sale");
  const [location, setLocation] = useState("Dar es Salaam");
  const [type, setType] = useState<PropertyType | "">("");

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const search = new URLSearchParams({ location, transaction });
    if (type) search.set("type", type);
    router.push(`/search?${search.toString()}`);
  }

  return (
    <form className="property-search" onSubmit={submitSearch}>
      <label className="search-select search-select--location">
        <MapPin size={17} aria-hidden="true" />
        <span className="sr-only">Location</span>
        <select value={location} onChange={(event) => setLocation(event.target.value)}>
          <option>Dar es Salaam</option>
          <option>Arusha</option>
          <option>Dodoma</option>
          <option>Morogoro</option>
          <option>Zanzibar</option>
        </select>
        <ChevronDown size={14} aria-hidden="true" />
      </label>
      <label className="search-select search-select--type">
        <Building2 size={17} aria-hidden="true" />
        <span className="sr-only">Property type</span>
        <select
          value={type}
          onChange={(event) => setType(
            propertyTypeOptions.find((option) => option.value === event.target.value)?.value ?? "",
          )}
        >
          {propertyTypeOptions.map((option) => (
            <option value={option.value} key={option.label}>{option.label}</option>
          ))}
        </select>
        <ChevronDown size={14} aria-hidden="true" />
      </label>
      <div className="transaction-toggle" role="group" aria-label="Transaction type">
        <button
          type="button"
          className={transaction === "sale" ? "is-selected" : ""}
          aria-pressed={transaction === "sale"}
          onClick={() => setTransaction("sale")}
        >
          Buy
        </button>
        <button
          type="button"
          className={transaction === "rent" ? "is-selected" : ""}
          aria-pressed={transaction === "rent"}
          onClick={() => setTransaction("rent")}
        >
          Rent
        </button>
      </div>
      <button className="button button--primary search-submit" type="submit">
        <Search size={16} aria-hidden="true" /> Search
      </button>
    </form>
  );
}
