"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudUpload, Eye, HousePlus, Pencil, Trash2, X } from "lucide-react";
import { deleteProperty } from "@/app/actions/properties";
import { PropertyCard } from "@/components/marketplace/marketplace-content";
import { formatPropertyPrice, type PropertyFixture } from "@/lib/property-display";
import { propertyStatusLabel, type ListingStatus, type PropertyWithImages } from "@/lib/properties";

type FilterValue = "all" | ListingStatus;

function toCardProperty(entry: PropertyWithImages): PropertyFixture {
  const { property, images } = entry;
  const location = [property.neighborhood, property.district, property.region].filter(Boolean).join(", ");
  return {
    slug: property.id,
    title: property.title,
    location,
    region: property.region,
    image: images[0]?.publicUrl ?? "",
    imageAlt: images[0]?.alt_text || property.title,
    price: property.price,
    transaction: property.transaction_type,
    type: property.property_type,
    bedrooms: property.bedrooms ?? undefined,
    bathrooms: property.bathrooms ?? undefined,
    areaSqm: property.area_sqm ?? undefined,
    verified: property.is_verified,
  };
}

export function MyListingsBoard({
  listings,
  loadError,
  success,
}: {
  listings: PropertyWithImages[];
  loadError?: string;
  success?: "created" | "updated";
}) {
  const router = useRouter();
  const previewDialog = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const [filter, setFilter] = useState<FilterValue>("all");
  const [preview, setPreview] = useState<PropertyWithImages | null>(null);
  const [deleting, setDeleting] = useState<PropertyWithImages | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (preview && !previewDialog.current?.open) previewDialog.current?.showModal();
    else if (previewDialog.current?.open) previewDialog.current.close();
  }, [preview]);

  useEffect(() => {
    if (deleting && !deleteDialog.current?.open) deleteDialog.current?.showModal();
    else if (deleteDialog.current?.open) deleteDialog.current.close();
  }, [deleting]);

  useEffect(() => {
    if (!preview) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreview(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [preview]);

  const filteredListings = listings.filter(({ property }) => filter === "all" || property.status === filter);
  const counts = {
    total: listings.length,
    published: listings.filter(({ property }) => property.status === "published").length,
    pending_review: listings.filter(({ property }) => property.status === "pending_review").length,
    draft: listings.filter(({ property }) => property.status === "draft").length,
    rented: listings.filter(({ property }) => property.status === "rented").length,
    sold: listings.filter(({ property }) => property.status === "sold").length,
  };

  async function confirmDelete() {
    if (!deleting || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await deleteProperty(deleting.property.id);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      setDeleting(null);
      router.refresh();
    } catch {
      setMessage("We couldn't delete this listing. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <p className="destination-page__description">Manage your properties, update listing details, and track their status.</p>
    <div className="my-listings-heading">
      <div><h2>Property dashboard</h2><p>Only you can manage your listings.</p></div>
      <Link className="button button--primary" href="/my-listings/new"><HousePlus size={17} aria-hidden="true" /> Add Property</Link>
    </div>

    {success ? <p className="listing-feedback listing-feedback--success" role="status">
      {success === "created" ? "Your property was saved successfully." : "Your property changes were saved."}
      {success === "created" ? " It will appear here while it is reviewed." : ""}
    </p> : null}
    {message ? <p className="auth-message auth-message--error" role="alert">{message}</p> : null}

    {loadError ? <section className="listing-state-card" role="alert">
      <h2>We couldn&apos;t load your listings</h2>
      <p>{loadError}</p>
      <button className="button button--secondary" type="button" onClick={() => router.refresh()}>Retry</button>
    </section> : listings.length === 0 ? <section className="listing-empty-card">
      <span className="listing-empty-card__icon"><CloudUpload size={43} strokeWidth={1.6} aria-hidden="true" /></span>
      <h2>You haven&apos;t listed any properties yet.</h2>
      <p>Your properties will appear here after you add your first listing.</p>
      <Link className="button button--primary" href="/my-listings/new">Upload Your First Property</Link>
      <Link className="listing-empty-card__secondary" href="/search">Explore the Marketplace</Link>
    </section> : <>
      <section className="listing-summary" aria-label="Listing counts">
        <div><strong>{counts.total}</strong><span>Total listings</span></div>
        <div><strong>{counts.published}</strong><span>Published</span></div>
        <div><strong>{counts.pending_review}</strong><span>Pending review</span></div>
        <div><strong>{counts.draft}</strong><span>Drafts</span></div>
        <div><strong>{counts.rented}</strong><span>Rented</span></div>
        <div><strong>{counts.sold}</strong><span>Sold</span></div>
      </section>
      <div className="listing-filters">
        <label htmlFor="listing-status-filter">Filter listings</label>
        <select id="listing-status-filter" value={filter} onChange={(event) => setFilter(event.target.value as FilterValue)}>
          <option value="all">All statuses</option>
          <option value="draft">Draft</option><option value="pending_review">Pending review</option>
          <option value="published">Published</option><option value="rejected">Needs changes</option>
          <option value="rented">Rented</option><option value="sold">Sold</option>
        </select>
        <Link className="listing-filters__add" href="/my-listings/new">Add another property</Link>
      </div>
      {filteredListings.length ? <div className="property-grid my-listings-grid">
        {filteredListings.map((entry) => {
          const card = toCardProperty(entry);
          const label = propertyStatusLabel(entry.property.status);
          return <PropertyCard key={entry.property.id} property={card}
            detailsHref={`/my-listings/${entry.property.id}/edit`} managementStatus={label}
            actions={<div className="property-management-actions">
              <Link className="property-management-actions__link" href={`/my-listings/${entry.property.id}/edit`}>
                <Pencil size={14} aria-hidden="true" /> Edit
              </Link>
              <button className="property-management-actions__link" type="button" onClick={() => setPreview(entry)}>
                <Eye size={14} aria-hidden="true" /> Preview
              </button>
              <button className="property-management-actions__delete" type="button" onClick={() => {
                setMessage("");
                setDeleting(entry);
              }}>
                <Trash2 size={14} aria-hidden="true" /> Delete
              </button>
            </div>} />;
        })}
      </div> : <section className="listing-state-card">
        <h2>No listings match this filter</h2>
        <p>Choose another status to see your properties.</p>
        <button className="button button--secondary" type="button" onClick={() => setFilter("all")}>Show all listings</button>
      </section>}
    </>}

    {preview ? <dialog ref={previewDialog} className="listing-dialog" aria-labelledby="listing-preview-title"
      onCancel={(event) => { event.preventDefault(); setPreview(null); }}>
      <div className="listing-dialog__header">
        <div><p className="eyebrow">Listing preview · {propertyStatusLabel(preview.property.status)}</p>
          <h2 id="listing-preview-title">{preview.property.title}</h2></div>
        <button className="listing-dialog__close" type="button" aria-label="Close preview" onClick={() => setPreview(null)}><X size={20} /></button>
      </div>
      <p className="listing-dialog__price">{formatPropertyPrice(preview.property.price, preview.property.transaction_type)}</p>
      <p className="listing-dialog__location">{[preview.property.neighborhood, preview.property.district, preview.property.region].filter(Boolean).join(", ")}</p>
      <p>{preview.property.description || "No description has been added."}</p>
      {preview.images.length > 0 ? <div className="listing-dialog__photos">
        {preview.images.map((image) => <Image key={image.id} src={image.publicUrl} alt={image.alt_text ?? preview.property.title}
          width={240} height={160} unoptimized />)}
      </div> : null}
      <div className="listing-dialog__actions">
        <Link className="button button--primary" href={`/my-listings/${preview.property.id}/edit`}>Edit listing</Link>
        <button className="button button--secondary" type="button" onClick={() => setPreview(null)}>Close</button>
      </div>
    </dialog> : null}

    {deleting ? <dialog ref={deleteDialog} className="listing-dialog listing-dialog--confirm"
      aria-labelledby="listing-delete-title" onCancel={(event) => { event.preventDefault(); setDeleting(null); }}>
      <div className="listing-dialog__header">
        <div><p className="eyebrow">Delete property</p><h2 id="listing-delete-title">Delete “{deleting.property.title}”?</h2></div>
        <button className="listing-dialog__close" type="button" aria-label="Cancel deletion" disabled={busy} onClick={() => setDeleting(null)}><X size={20} /></button>
      </div>
      <p>This permanently removes the listing and its uploaded photos. This action cannot be undone.</p>
      {message ? <p className="auth-message auth-message--error" role="alert">{message}</p> : null}
      <div className="listing-dialog__actions">
        <button className="button button--secondary" type="button" disabled={busy} onClick={() => setDeleting(null)}>Keep listing</button>
        <button className="button button--danger" type="button" disabled={busy} onClick={confirmDelete}>{busy ? "Deleting…" : "Delete property"}</button>
      </div>
    </dialog> : null}
  </>;
}
