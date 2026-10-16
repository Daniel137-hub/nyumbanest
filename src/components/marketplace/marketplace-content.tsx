"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Bath,
  BedDouble,
  Check,
  Heart,
  House,
  LayoutGrid,
  Leaf,
  MapPin,
  Maximize,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { formatPropertyPrice, type PropertyFixture } from "@/lib/property-display";
import { isLocalSupabaseUrl } from "@/lib/property-image-url";

export type PropertyCategory = "all" | "sale" | "rent" | "land";

const categoryOptions: { label: string; value: PropertyCategory }[] = [
  { label: "All Properties", value: "all" },
  { label: "For sale", value: "sale" },
  { label: "For rent", value: "rent" },
  { label: "Land", value: "land" },
];

export function PropertyCategoryFilters({
  selectedCategory,
  onCategoryChange,
}: {
  selectedCategory: PropertyCategory;
  onCategoryChange: (category: PropertyCategory) => void;
}) {
  return (
    <div className="category-filters" role="group" aria-label="Filter properties">
      {categoryOptions.map(({ label, value }, index) => (
        <button
          className={`category-chip${selectedCategory === value ? " is-selected" : ""}`}
          key={value}
          type="button"
          onClick={() => onCategoryChange(value)}
          aria-pressed={selectedCategory === value}
        >
          {index === 0 ? <LayoutGrid className="category-chip__grid" size={14} aria-hidden="true" /> : null}
          {label}
        </button>
      ))}
    </div>
  );
}

export function PropertyCard({
  property,
  detailsHref,
  managementStatus,
  actions,
  favoriteAction,
  hideFavorite = false,
}: {
  property: PropertyFixture;
  detailsHref?: string;
  managementStatus?: string;
  actions?: ReactNode;
  favoriteAction?: ReactNode;
  hideFavorite?: boolean;
}) {
  const [isSaved, setIsSaved] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <article className="property-card">
      <div className="property-card__image-wrap">
        {imageFailed || !property.image ? (
          <div className="image-fallback" aria-label={property.imageAlt}>
            <span>NyumbaNest</span>
          </div>
        ) : (
          <Image
            className="property-card__image"
            src={property.image}
            alt={property.imageAlt}
            fill
            sizes="(max-width: 680px) 92vw, (max-width: 1050px) 45vw, (max-width: 1420px) 30vw, 22vw"
            priority={property.slug === "modern-villa-mikocheni"}
            unoptimized={property.image.startsWith("http") && isLocalSupabaseUrl()}
            onError={() => setImageFailed(true)}
          />
        )}
        {property.verified ? (
          <span className="verified-badge">
            <Check size={11} strokeWidth={3} aria-hidden="true" />
            Verified
          </span>
        ) : null}
        {favoriteAction ?? (!actions && !hideFavorite ? <button
          className={`favorite-button${isSaved ? " is-saved" : ""}`}
          type="button"
          aria-label={isSaved ? `Remove ${property.title} from saved homes` : `Save ${property.title}`}
          aria-pressed={isSaved}
          onClick={() => setIsSaved((saved) => !saved)}
        >
          <Heart size={21} fill={isSaved ? "currentColor" : "none"} aria-hidden="true" />
        </button> : null)}
      </div>
      <Link className="property-card__details" href={detailsHref ?? `/properties/${property.slug}`}>
        <strong className="property-card__price">
          {formatPropertyPrice(property.price, property.transaction)}
        </strong>
        <span className="property-card__title">{property.title}</span>
        <span className="property-card__location">
          <MapPin size={13} aria-hidden="true" />
          {property.location}
        </span>
        <span className="property-card__attributes" aria-label="Property details">
          {(property.type === "house" || property.type === "apartment") && property.bedrooms !== undefined ? (
            <span><BedDouble size={15} aria-hidden="true" />{property.bedrooms}</span>
          ) : null}
          {(property.type === "house" || property.type === "apartment") && property.bathrooms !== undefined ? (
            <span><Bath size={15} aria-hidden="true" />{property.bathrooms}</span>
          ) : null}
          {property.areaSqm !== undefined ? <span><Maximize size={14} aria-hidden="true" />{property.areaSqm} m²</span> : null}
        </span>
        <span className="transaction-tag">
          {property.transaction === "sale" ? "For sale" : "For rent"}
        </span>
        {managementStatus ? <span className={`listing-status listing-status--${managementStatus.toLowerCase().replaceAll(" ", "-")}`}>
          {managementStatus}
        </span> : null}
      </Link>
      {actions ? <div className="property-card__management">{actions}</div> : null}
    </article>
  );
}

export function PropertyDetailImage({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className="property-detail__photo">
      {imageFailed ? (
        <div className="image-fallback" role="img" aria-label={alt}>
          <span>Property image unavailable</span>
        </div>
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 800px) 100vw, 65vw"
          loading="eager"
          onError={() => setImageFailed(true)}
        />
      )}
    </div>
  );
}

export function PropertyGrid({
  properties,
  emptyTitle = "No properties found",
  emptyDescription = "Try changing your filters to see more homes.",
}: {
  properties: PropertyFixture[];
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (properties.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="property-grid">
      {properties.map((property) => (
        <PropertyCard key={property.slug} property={property} />
      ))}
    </div>
  );
}

export function PropertyOwnerBanner() {
  return (
    <section className="owner-banner" aria-labelledby="owner-banner-title">
      <House className="owner-banner__mark" aria-hidden="true" strokeWidth={1.8} />
      <div className="owner-banner__copy">
        <h2 id="owner-banner-title">Have a property to sell or rent?</h2>
        <p>Reach potential buyers and tenants across Tanzania.</p>
      </div>
      <Link className="button button--primary owner-banner__button" href="/my-listings/new">
        Post Your Listing <ArrowRight size={16} aria-hidden="true" />
      </Link>
      <div className="owner-banner__image" aria-hidden="true" />
    </section>
  );
}

export function TrustFeatures() {
  const features = [
    { title: "Verified Listings", text: "More trust, less risk", icon: ShieldCheck },
    { title: "Real People", text: "Local support team", icon: UsersRound },
    { title: "Wide Choice", text: "Homes, apartments, land & more", icon: Leaf },
  ];

  return (
    <section className="trust-features" aria-label="Why choose NyumbaNest">
      {features.map(({ title, text, icon: Icon }) => (
        <div className="trust-feature" key={title}>
          <Icon className="trust-feature__icon" aria-hidden="true" strokeWidth={1.8} />
          <span>
            <strong>{title}</strong>
            <small>{text}</small>
          </span>
        </div>
      ))}
    </section>
  );
}

export function LoadingSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="property-grid" role="status" aria-label="Loading properties" aria-busy="true">
      {Array.from({ length: count }, (_, index) => (
        <div className="property-skeleton" key={index}>
          <div className="skeleton-block property-skeleton__image" />
          <div className="property-skeleton__copy">
            <div className="skeleton-block skeleton-line skeleton-line--wide" />
            <div className="skeleton-block skeleton-line" />
            <div className="skeleton-block skeleton-line skeleton-line--short" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="state-card" role="status">
      <House className="state-card__icon" aria-hidden="true" strokeWidth={1.8} />
      <h2>{title}</h2>
      <p>{description}</p>
      <Link className="text-link" href="/search">
        Explore all properties <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </div>
  );
}

export function ErrorState({
  title = "We couldn’t load properties",
  description = "Please check your connection and try again.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="state-card state-card--error" role="alert">
      <h2>{title}</h2>
      <p>{description}</p>
      {onRetry ? (
        <button className="button button--secondary" type="button" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}
