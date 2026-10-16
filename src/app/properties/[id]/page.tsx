import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bath, BedDouble, Check, MapPin, Maximize, ParkingSquare, ShieldCheck } from "lucide-react";
import { FavoriteControl } from "@/components/marketplace/favorite-control";
import { MobileBottomNavigation } from "@/components/marketplace/marketplace-chrome";
import { MarketplaceNavigation } from "@/components/marketplace/marketplace-navigation";
import { PropertyCard } from "@/components/marketplace/marketplace-content";
import { PropertyGallery } from "@/components/marketplace/property-gallery";
import { PropertyInquiryForm } from "@/components/marketplace/property-inquiry-form";
import {
  getFavoritePropertyIds,
  getPublicProperty,
  getPublicViewer,
  getSimilarListings,
} from "@/lib/marketplace";
import { getPublicImageUrl } from "@/lib/property-image-url";
import { formatPropertyPrice } from "@/lib/property-display";

type PropertyPageProps = { params: Promise<{ id: string }> };
export const instant = false;

export async function generateMetadata({ params }: PropertyPageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await getPublicProperty(id);
  if (!result.data) {
    return {
      title: "Property details | NyumbaNest",
      description: "Explore property listings on NyumbaNest.",
      alternates: { canonical: `/properties/${encodeURIComponent(id)}` },
    };
  }
  const property = result.data.record;
  return {
    title: `${property.title} | NyumbaNest`,
    description: property.description?.slice(0, 155) ||
      `${property.property_type} for ${property.transaction_type} in ${property.region}, Tanzania.`,
    alternates: { canonical: `/properties/${property.id}` },
    openGraph: {
      title: `${property.title} | NyumbaNest`,
      description: property.description?.slice(0, 155) || `Property in ${property.region}, Tanzania.`,
      images: result.data.images[0]
      ? [{ url: getPublicImageUrl(result.data.images[0].storage_path) }]
        : undefined,
    },
  };
}

export default async function PropertyPage({ params }: PropertyPageProps) {
  const { id } = await params;
  const result = await getPublicProperty(id);
  if (result.error) {
    return (
      <div className="marketplace-page">
        <div className="marketplace-shell marketplace-shell--subpage">
          <MarketplaceNavigation />
          <main className="property-detail">
            <section className="marketplace-error" role="alert">
              <h1>Property details are temporarily unavailable</h1>
              <p>{result.error}</p>
              <Link className="button button--primary" href="/properties">Browse properties</Link>
            </section>
          </main>
        </div>
        <MobileBottomNavigation activeItem="Search" />
      </div>
    );
  }
  if (!result.data) notFound();

  const { record: property, images } = result.data;
  const viewer = await getPublicViewer();
  const favoriteQuery = viewer.user
    ? await getFavoritePropertyIds(viewer.user.id, [id])
    : viewer.error
      ? { data: null, error: viewer.error }
      : { data: new Set<string>(), error: null };
  const similar = await getSimilarListings(property, id);
  const similarFavoriteQuery = viewer.user && similar.data?.length
    ? await getFavoritePropertyIds(viewer.user.id, similar.data.map((item) => item.id))
    : viewer.error
      ? { data: null, error: viewer.error }
      : { data: new Set<string>(), error: null };
  const location = [property.neighborhood, property.district, property.region]
    .filter(Boolean)
    .join(", ");
  const isRoomRelevant = property.property_type === "house" || property.property_type === "apartment";

  return (
    <div className="marketplace-page">
      <div className="marketplace-shell marketplace-shell--subpage">
        <MarketplaceNavigation />
        <main className="property-detail">
          <Link className="back-link" href="/properties">
            <ArrowLeft size={15} aria-hidden="true" /> Browse properties
          </Link>
          <div className="property-detail__layout">
            <PropertyGallery title={property.title} images={images} />
            <section className="property-detail__copy">
              <div className="property-detail__badges">
                <span className="transaction-tag">
                  {property.transaction_type === "sale" ? "For sale" : "For rent"}
                </span>
                <span className="property-detail__verification">
                  <ShieldCheck size={15} aria-hidden="true" />
                  {property.is_verified ? "Verified listing" : "Not verified"}
                </span>
              </div>
              <h1>{property.title}</h1>
              <p className="property-detail__location">
                <MapPin size={17} aria-hidden="true" /> {location}
              </p>
              <strong className="property-detail__price">
                {formatPropertyPrice(property.price, property.transaction_type)}
              </strong>
              <div className="property-detail__attributes">
                <span><Check size={17} aria-hidden="true" /> {property.property_type[0].toUpperCase() + property.property_type.slice(1)}</span>
                {property.area_sqm !== null ? <span><Maximize size={17} aria-hidden="true" /> {property.area_sqm} m²</span> : null}
                {isRoomRelevant && property.bedrooms !== null ? <span><BedDouble size={17} aria-hidden="true" /> {property.bedrooms} bedrooms</span> : null}
                {isRoomRelevant && property.bathrooms !== null ? <span><Bath size={17} aria-hidden="true" /> {property.bathrooms} bathrooms</span> : null}
                {property.parking_spaces !== null ? <span><ParkingSquare size={17} aria-hidden="true" /> {property.parking_spaces} parking spaces</span> : null}
                {property.furnished !== null && isRoomRelevant ? <span>{property.furnished ? "Furnished" : "Unfurnished"}</span> : null}
              </div>
              <div className="property-detail__favorite">
                {favoriteQuery.error ? (
                  <p className="form-message form-message--error" role="alert">{favoriteQuery.error}</p>
                ) : (
                  <FavoriteControl
                    propertyId={id}
                    title={property.title}
                    isSaved={favoriteQuery.data?.has(id) ?? false}
                    isAuthenticated={Boolean(viewer.user)}
                    next={`/properties/${id}`}
                  />
                )}
                {!favoriteQuery.error ? <span>Save property</span> : null}
              </div>
            </section>
          </div>
          <div className="property-detail__sections">
            <section className="property-detail__description">
              <h2>About this property</h2>
              <p>{property.description || "The owner has not added a description yet."}</p>
              <p className="property-detail__privacy-note">
                The exact street address and owner contact details are kept private. Use the inquiry form to contact the owner.
              </p>
              {property.amenities.length ? (
                <div className="property-detail__amenities">
                  <h3>Amenities</h3>
                  <ul>{property.amenities.map((amenity) => <li key={amenity}>{amenity}</li>)}</ul>
                </div>
              ) : null}
            </section>
            <PropertyInquiryForm propertyId={id} />
          </div>
          {similar.error ? (
            <p className="marketplace-notice" role="status">Similar listings could not be loaded at this time.</p>
          ) : similar.data?.length ? (
            <section className="similar-properties" aria-labelledby="similar-properties-title">
              <h2 id="similar-properties-title">Similar listings</h2>
              <div className="property-grid">
                {similarFavoriteQuery.error ? (
                  <p className="marketplace-notice" role="alert">{similarFavoriteQuery.error}</p>
                ) : null}
                {similar.data.map(({ id: similarId, property: similarProperty }) => (
                  <PropertyCard
                    key={similarId}
                    property={similarProperty}
                    detailsHref={`/properties/${similarId}`}
                    hideFavorite={Boolean(similarFavoriteQuery.error)}
                    favoriteAction={
                      <FavoriteControl
                        propertyId={similarId}
                        title={similarProperty.title}
                        isSaved={similarFavoriteQuery.data?.has(similarId) ?? false}
                        isAuthenticated={Boolean(viewer.user)}
                        next={`/properties/${similarId}`}
                      />
                    }
                  />
                ))}
              </div>
            </section>
          ) : null}
        </main>
      </div>
      <MobileBottomNavigation activeItem="Search" />
    </div>
  );
}
