import type { Metadata } from "next";
import { PrivatePageShell } from "@/components/auth/private-page-shell";
import { MyListingsBoard } from "@/components/marketplace/my-listings-board";
import { OWNER_PROPERTY_COLUMNS, type PropertyWithImages } from "@/lib/properties";
import { requireAdminUser } from "@/lib/supabase/auth-guard";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Admin listings | NyumbaNest" };
export const instant = false;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string | string[] }>;
}) {
  await requireAdminUser("/admin");
  const supabase = await createClient();
  const { data: properties, error } = await supabase
    .from("properties")
    .select(OWNER_PROPERTY_COLUMNS)
    .order("created_at", { ascending: false });

  let listings: PropertyWithImages[] = [];
  let loadError: string | undefined;
  if (error) {
    loadError = "Property data could not be retrieved. Please try again.";
  } else if (properties.length) {
    const ownerIds = [...new Set(properties.map(({ owner_id }) => owner_id))];
    const [{ data: images, error: imageError }, { data: owners, error: ownersError }] = await Promise.all([
      supabase
        .from("property_images")
        .select("*")
        .in("property_id", properties.map(({ id }) => id))
        .order("sort_order", { ascending: true }),
      supabase
        .from("profiles")
        .select("id,full_name")
        .in("id", ownerIds),
    ]);
    if (imageError) {
      loadError = "Property photos could not be retrieved. Please retry before managing listings.";
    } else if (ownersError) {
      loadError = "Listing owner details could not be retrieved. Please retry before managing listings.";
    } else {
      const ownerNames = new Map((owners ?? []).map(({ id, full_name }) => [id, full_name]));
      listings = properties.map((property) => ({
        property,
        ownerName: ownerNames.get(property.owner_id) ?? undefined,
        images: images.filter((image) => image.property_id === property.id).map((image) => ({
          ...image,
          publicUrl: supabase.storage.from("property-images").getPublicUrl(image.storage_path).data.publicUrl,
        })),
      }));
    }
  }

  const { success } = await searchParams;
  const successMessage = success === "created" || success === "updated" ? success : undefined;

  return <PrivatePageShell eyebrow="Administrator moderation" title="All property listings" activeItem="Listings">
    <MyListingsBoard listings={listings} loadError={loadError} success={successMessage} isAdmin />
  </PrivatePageShell>;
}
