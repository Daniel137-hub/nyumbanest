import type { Metadata } from "next";
import Link from "next/link";
import { PrivatePageShell } from "@/components/auth/private-page-shell";
import { PropertyForm } from "@/components/marketplace/property-form";
import { OWNER_PROPERTY_COLUMNS, propertyStatusLabel, type PropertyRow } from "@/lib/properties";
import { hasAdminRole, requireVerifiedUser } from "@/lib/supabase/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Edit property | NyumbaNest" };
export const instant = false;

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const returnTo = `/my-listings/${encodeURIComponent(id)}/edit`;
  const user = await requireVerifiedUser(returnTo);
  const isAdmin = hasAdminRole(user);
  const supabase = await createClient();
  let propertyQuery = supabase.from("properties").select(OWNER_PROPERTY_COLUMNS).eq("id", id);
  if (!isAdmin) propertyQuery = propertyQuery.eq("owner_id", user.id);
  const { data: property, error } = await propertyQuery.maybeSingle();

  if (error) {
    return <PrivatePageShell eyebrow="For property owners" title="Edit property" activeItem="Listings">
      <section className="listing-state-card" role="alert">
        <h2>We couldn&apos;t load this listing</h2>
        <p>Your property details could not be retrieved. Please try again.</p>
        <Link className="button button--secondary" href={returnTo}>Retry</Link>
      </section>
    </PrivatePageShell>;
  }
  if (!property) redirect(isAdmin ? "/admin" : "/my-listings");

  const { data: privateLocation, error: addressError } = await supabase.rpc(
    isAdmin ? "get_admin_property_private_location" : "get_owned_property_private_location",
    {
    target_property_id: id,
    },
  ).maybeSingle();
  if (addressError) {
    return <PrivatePageShell eyebrow="For property owners" title="Edit property" activeItem="Listings">
      <section className="listing-state-card" role="alert">
        <h2>We couldn&apos;t load this listing</h2>
        <p>Your property details could not be retrieved. Please try again.</p>
        <Link className="button button--secondary" href={returnTo}>Retry</Link>
      </section>
    </PrivatePageShell>;
  }

  const { data: images, error: imageError } = await supabase.from("property_images")
    .select("*")
    .eq("property_id", id)
    .order("sort_order", { ascending: true });
  if (imageError) {
    return <PrivatePageShell eyebrow="For property owners" title="Edit property" activeItem="Listings">
      <section className="listing-state-card" role="alert">
        <h2>We couldn&apos;t load this listing&apos;s photos</h2>
        <p>Your property details could not be retrieved. Please try again.</p>
        <Link className="button button--secondary" href={returnTo}>Retry</Link>
      </section>
    </PrivatePageShell>;
  }

  const editableProperty: PropertyRow = {
    ...property,
    address: privateLocation?.address ?? null,
    latitude: privateLocation?.latitude ?? null,
    longitude: privateLocation?.longitude ?? null,
  };

  return <PrivatePageShell eyebrow={`${isAdmin ? "Administrator" : "For property owners"} · ${propertyStatusLabel(property.status)}`} title="Edit property" activeItem="Listings">
    <p className="destination-page__description">Update this listing&apos;s details. Changes to published listings return to moderation before being published again.</p>
    <PropertyForm property={editableProperty} existingImages={images.map((image) => ({
      ...image,
      publicUrl: supabase.storage.from("property-images").getPublicUrl(image.storage_path).data.publicUrl,
    }))} adminMode={isAdmin} successPath={isAdmin ? "/admin?success=updated" : undefined} />
  </PrivatePageShell>;
}
