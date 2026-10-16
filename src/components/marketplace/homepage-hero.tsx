"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
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

function PropertySearch({
  transaction,
  onTransactionChange,
}: {
  transaction: TransactionType;
  onTransactionChange: (value: TransactionType) => void;
}) {
  const router = useRouter();
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
        <select value={type} onChange={(event) => setType(
          propertyTypeOptions.find((option) => option.value === event.target.value)?.value ?? "",
        )}>
          {propertyTypeOptions.map((option) => (
            <option value={option.value} key={option.label}>{option.label}</option>
          ))}
        </select>
        <ChevronDown size={14} aria-hidden="true" />
      </label>
      <div className="transaction-toggle" role="group" aria-label="Transaction type">
        <button type="button" className={transaction === "sale" ? "is-selected" : ""}
          aria-pressed={transaction === "sale"} onClick={() => onTransactionChange("sale")}>
          Buy
        </button>
        <button type="button" className={transaction === "rent" ? "is-selected" : ""}
          aria-pressed={transaction === "rent"} onClick={() => onTransactionChange("rent")}>
          Rent
        </button>
      </div>
      <button className="button button--primary search-submit" type="submit">
        <Search size={16} aria-hidden="true" /> Search
      </button>
    </form>
  );
}

export function HomepageHero() {
  const [transaction, setTransaction] = useState<TransactionType>("sale");
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero__image">
        {!imageFailed ? (
          <Image
            src="/images/hero-exterior.jpg"
            alt="Contemporary villa with rooftop terrace and swimming pool"
            fill
            priority
            sizes="(max-width: 800px) 100vw, 70vw"
            onError={() => setImageFailed(true)}
          />
        ) : <div className="hero__image-fallback" />}
      </div>
      <div className="hero__content">
        <p className="eyebrow">A better way home</p>
        <h1 id="hero-title">Find a place<br />to call <span>yours.</span></h1>
        <p className="hero__description">
          Discover quality homes, apartments, land and commercial spaces across Tanzania. Buy or rent with confidence.
        </p>
      </div>
      <PropertySearch transaction={transaction} onTransactionChange={setTransaction} />
    </section>
  );
}
