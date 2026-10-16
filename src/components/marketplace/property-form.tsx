"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, X } from "lucide-react";
import {
  addPropertyImages,
  removePropertyUploads,
  removePropertyImages,
  rollbackNewProperty,
  saveProperty,
} from "@/app/actions/properties";
import type { PropertyFormValues, PropertyImageRow, PropertyRow } from "@/lib/properties";
import { EMPTY_PROPERTY_FORM, propertyFormFromRow, validatePropertyForm } from "@/lib/properties";
import { createClient } from "@/lib/supabase/client";

type ExistingImage = PropertyImageRow & { publicUrl: string };
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

function inputValue(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  return event.currentTarget.value;
}

export function PropertyForm({
  property,
  existingImages = [],
}: {
  property?: PropertyRow;
  existingImages?: ExistingImage[];
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const submissionLock = useRef(false);
  const [values, setValues] = useState<PropertyFormValues>(property ? propertyFormFromRow(property) : EMPTY_PROPERTY_FORM);
  const [photos, setPhotos] = useState<File[]>([]);
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [message, setMessage] = useState("");
  const [photoError, setPhotoError] = useState("");
  const previews = useMemo(() => photos.map((file) => URL.createObjectURL(file)), [photos]);

  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const canHaveRooms = values.property_type === "house" || values.property_type === "apartment";
  const keptImages = existingImages.filter((image) => !removedImageIds.includes(image.id));

  function updateField(field: keyof PropertyFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function choosePhotos(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    setPhotoError("");
    const total = keptImages.length + photos.length + selected.length;
    if (total > 10) {
      setPhotoError("You can add up to 10 photos to a listing.");
      return;
    }
    const invalid = selected.find((file) => !ALLOWED_PHOTO_TYPES[file.type] || file.size > MAX_PHOTO_BYTES || file.size === 0);
    if (invalid) {
      setPhotoError(`${invalid.name} is not supported. Choose JPEG, PNG, WebP, or AVIF photos up to 10 MiB each.`);
      return;
    }
    setPhotos((current) => [...current, ...selected]);
  }

  function removePhoto(index: number) {
    setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index));
  }

  async function cleanupUploadedPhotos(propertyId: string, paths: string[]) {
    try {
      return property
        ? await removePropertyUploads(propertyId, paths)
        : await rollbackNewProperty(propertyId, paths);
    } catch {
      return { error: "We couldn't confirm photo cleanup. Reopen the listing and review its photos before retrying." };
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || submissionLock.current) return;
    submissionLock.current = true;
    setBusy(true);
    setMessage("");
    setPhotoError("");
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const intent = submitter instanceof HTMLButtonElement ? submitter.value : "draft";
    const status = intent === "review" ? "pending_review" : "draft";
    let savedPropertyId: string | null = null;
    const uploadedPaths: string[] = [];
    try {
      validatePropertyForm(values);
      const saved = property
        ? { error: null, propertyId: property.id, ownerId: property.owner_id }
        : await saveProperty(null, values, status);
      if (saved.error !== null) {
        setMessage(saved.error);
        return;
      }
      savedPropertyId = saved.propertyId;

      const supabase = createClient();
      for (let index = 0; index < photos.length; index += 1) {
        const file = photos[index];
        const extension = ALLOWED_PHOTO_TYPES[file.type];
        if (!extension) throw new Error("One of the selected photos has an unsupported format.");
        const path = `${saved.ownerId}/${saved.propertyId}/${window.crypto.randomUUID()}.${extension}`;
        setProgress(`Uploading photo ${index + 1} of ${photos.length}…`);
        const { error } = await supabase.storage.from("property-images").upload(path, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: false,
        });
        if (error) {
          const cleanup = await cleanupUploadedPhotos(saved.propertyId, uploadedPaths);
          setMessage(cleanup.error
            ? `${error.message} ${cleanup.error}`
            : `${file.name} could not be uploaded: ${error.message}. Your listing was not created with incomplete photos.`);
          return;
        }
        uploadedPaths.push(path);
      }

      if (uploadedPaths.length) {
        const imageResult = await addPropertyImages(saved.propertyId, uploadedPaths.map((path) => ({
          path,
          altText: values.title,
        })));
        if (imageResult.error) {
          const cleanup = await cleanupUploadedPhotos(saved.propertyId, uploadedPaths);
          setMessage(cleanup.error
            ? `${imageResult.error} ${cleanup.error}`
            : imageResult.error);
          return;
        }
      }

      if (property) {
        const updated = await saveProperty(property.id, values, status);
        if (updated.error !== null) {
          const cleanup = await cleanupUploadedPhotos(property.id, uploadedPaths);
          setMessage(cleanup.error
            ? `${updated.error} ${cleanup.error}`
            : updated.error);
          return;
        }
      }

      if (removedImageIds.length) {
        setProgress("Removing selected photos…");
        const removed = await removePropertyImages(saved.propertyId, removedImageIds);
        if (removed.error) {
          setMessage(`${removed.error} Other listing changes have been saved.`);
          return;
        }
      }

      setProgress(photos.length ? `Uploaded ${photos.length} of ${photos.length} photos.` : "");
      router.replace(`/my-listings?success=${property ? "updated" : "created"}`);
      router.refresh();
    } catch (error) {
      let cleanupMessage = "";
      if (savedPropertyId && uploadedPaths.length) {
        const cleanup = await cleanupUploadedPhotos(savedPropertyId, uploadedPaths);
        if (cleanup.error) cleanupMessage = ` ${cleanup.error}`;
      }
      const reason = error instanceof Error ? error.message : "Check your connection and try again.";
      setMessage(`We couldn't finish saving the listing. ${reason}${cleanupMessage}`);
    } finally {
      submissionLock.current = false;
      setBusy(false);
      setProgress("");
    }
  }

  return <form className="property-form" onSubmit={submit}>
    <fieldset disabled={busy}>
      <legend>Property details</legend>
      <div className="property-form__grid">
        <label className="property-form__field property-form__field--wide">
          <span>Property title <b aria-hidden="true">*</b></span>
          <input name="title" required maxLength={180} value={values.title}
            onChange={(event) => updateField("title", inputValue(event))} />
        </label>
        <label className="property-form__field property-form__field--wide">
          <span>Description</span>
          <textarea name="description" rows={5} maxLength={12_000} value={values.description}
            onChange={(event) => updateField("description", inputValue(event))} />
        </label>
        <label className="property-form__field">
          <span>Transaction type <b aria-hidden="true">*</b></span>
          <select name="transaction_type" required value={values.transaction_type}
            onChange={(event) => updateField("transaction_type", inputValue(event))}>
            <option value="sale">For sale</option><option value="rent">For rent</option>
          </select>
        </label>
        <label className="property-form__field">
          <span>Property type <b aria-hidden="true">*</b></span>
          <select name="property_type" required value={values.property_type}
            onChange={(event) => updateField("property_type", inputValue(event))}>
            <option value="house">House</option><option value="apartment">Apartment</option>
            <option value="land">Land</option><option value="commercial">Commercial</option><option value="other">Other</option>
          </select>
        </label>
        <label className="property-form__field">
          <span>Price in TSh <b aria-hidden="true">*</b></span>
          <input name="price" type="number" min="0" max="999999999999.99" step="0.01" required
            value={values.price} onChange={(event) => updateField("price", inputValue(event))} />
        </label>
        <label className="property-form__field">
          <span>Property area (m²)</span>
          <input name="area_sqm" type="number" min="0.01" max="9999999999.99" step="0.01"
            value={values.area_sqm} onChange={(event) => updateField("area_sqm", inputValue(event))} />
        </label>
      </div>
    </fieldset>

    <fieldset disabled={busy}>
      <legend>Location</legend>
      <div className="property-form__grid">
        <label className="property-form__field"><span>Region <b aria-hidden="true">*</b></span>
          <input name="region" required maxLength={120} value={values.region}
            onChange={(event) => updateField("region", inputValue(event))} /></label>
        <label className="property-form__field"><span>District</span>
          <input name="district" maxLength={120} value={values.district}
            onChange={(event) => updateField("district", inputValue(event))} /></label>
        <label className="property-form__field"><span>Neighborhood</span>
          <input name="neighborhood" maxLength={160} value={values.neighborhood}
            onChange={(event) => updateField("neighborhood", inputValue(event))} /></label>
        <label className="property-form__field property-form__field--wide"><span>Address or location description</span>
          <input name="address" maxLength={500} value={values.address}
            onChange={(event) => updateField("address", inputValue(event))} /></label>
        <label className="property-form__field"><span>Latitude (optional)</span>
          <input name="latitude" type="number" min="-90" max="90" step="any" value={values.latitude}
            onChange={(event) => updateField("latitude", inputValue(event))} /></label>
        <label className="property-form__field"><span>Longitude (optional)</span>
          <input name="longitude" type="number" min="-180" max="180" step="any" value={values.longitude}
            onChange={(event) => updateField("longitude", inputValue(event))} /></label>
      </div>
    </fieldset>

    {canHaveRooms ? <fieldset disabled={busy}>
      <legend>Property features</legend>
      <div className="property-form__grid">
        <label className="property-form__field"><span>Bedrooms</span>
          <input name="bedrooms" type="number" min="0" max="32767" step="1" value={values.bedrooms}
            onChange={(event) => updateField("bedrooms", inputValue(event))} /></label>
        <label className="property-form__field"><span>Bathrooms</span>
          <input name="bathrooms" type="number" min="0" max="32767" step="1" value={values.bathrooms}
            onChange={(event) => updateField("bathrooms", inputValue(event))} /></label>
        <label className="property-form__field"><span>Parking spaces</span>
          <input name="parking_spaces" type="number" min="0" max="32767" step="1" value={values.parking_spaces}
            onChange={(event) => updateField("parking_spaces", inputValue(event))} /></label>
        <label className="property-form__field"><span>Furnished</span>
          <select name="furnished" value={values.furnished}
            onChange={(event) => updateField("furnished", inputValue(event))}>
            <option value="">Not specified</option><option value="true">Yes</option><option value="false">No</option>
          </select></label>
        <label className="property-form__field property-form__field--wide"><span>Amenities (comma-separated)</span>
          <input name="amenities" maxLength={5_000} value={values.amenities}
            onChange={(event) => updateField("amenities", inputValue(event))} /></label>
      </div>
    </fieldset> : <fieldset disabled={busy}>
      <legend>Property features</legend>
      <div className="property-form__grid">
        <label className="property-form__field"><span>Parking spaces</span>
          <input name="parking_spaces" type="number" min="0" max="32767" step="1" value={values.parking_spaces}
            onChange={(event) => updateField("parking_spaces", inputValue(event))} /></label>
        <label className="property-form__field property-form__field--wide"><span>Amenities (comma-separated)</span>
          <input name="amenities" maxLength={5_000} value={values.amenities}
            onChange={(event) => updateField("amenities", inputValue(event))} /></label>
      </div>
    </fieldset>}

    <fieldset className="property-form__photos" disabled={busy}>
      <legend>Property photographs</legend>
      <p className="property-form__help">Add up to 10 JPEG, PNG, WebP, or AVIF photos, maximum 10 MiB each.</p>
      <input ref={fileInput} className="visually-hidden" name="photos" type="file" accept="image/jpeg,image/png,image/webp,image/avif"
        multiple onChange={choosePhotos} aria-label="Choose property photos" />
      <button className="button button--secondary" type="button" onClick={() => fileInput.current?.click()}>
        <ImagePlus size={17} aria-hidden="true" /> Add photos
      </button>
      {(keptImages.length > 0 || photos.length > 0) && <div className="property-photo-grid">
        {keptImages.map((image) => <figure key={image.id} className="property-photo">
          <Image src={image.publicUrl} alt={image.alt_text ?? property?.title ?? "Property photo"} fill sizes="140px" unoptimized />
          <button type="button" aria-label={`Remove photo ${image.sort_order + 1}`}
            onClick={() => setRemovedImageIds((current) => [...current, image.id])}><X size={15} /></button>
        </figure>)}
        {photos.map((file, index) => <figure key={`${file.name}-${file.lastModified}-${index}`} className="property-photo">
          <Image src={previews[index]} alt={`Selected photo ${index + 1}: ${file.name}`} fill sizes="140px" unoptimized />
          <button type="button" aria-label={`Remove selected photo ${index + 1}`} onClick={() => removePhoto(index)}><X size={15} /></button>
        </figure>)}
      </div>}
      {photoError && <p className="auth-message auth-message--error" role="alert">{photoError}</p>}
    </fieldset>

    {message && <p className="auth-message auth-message--error" role="alert">{message}</p>}
    {progress && <p className="property-form__progress" role="status">{progress}</p>}
    {photos.length > 0 && busy && <progress className="property-form__progress-bar" max={photos.length}
      value={Math.max(0, Number(progress.match(/photo (\d+)/i)?.[1] ?? (progress.startsWith("Uploaded") ? photos.length : 0)))} />}
    <div className="property-form__actions">
      <button className="button button--secondary" type="submit" name="intent" value="draft" disabled={busy}>
        {busy ? "Saving…" : "Save draft"}
      </button>
      <button className="button button--primary" type="submit" name="intent" value="review" disabled={busy}>
        {busy ? "Saving…" : "Submit for review"}
      </button>
    </div>
    <p className="property-form__help">New and updated listings are not published automatically. Listings submitted for review remain unpublished until moderation is complete.</p>
  </form>;
}
