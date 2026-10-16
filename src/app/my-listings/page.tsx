import type { Metadata } from "next";
import { PrivatePageShell } from "@/components/auth/private-page-shell";
import { MyListingsBoard } from "@/components/marketplace/my-listings-board";
import { OWNER_PROPERTY_COLUMNS, type PropertyWithImages } from "@/lib/properties";
import { requireVerifiedUser } from "@/lib/supabase/auth-guard";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My Listings | NyumbaNest" };
export const instant = false;

export default async function MyListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string | string[] }>;
}) {
  const user = await requireVerifiedUser("/my-listings");
  const supabase = await createClient();
  const { data: properties, error } = await supabase.from("properties")
    .select(OWNER_PROPERTY_COLUMNS)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });
  let listings: PropertyWithImages[] = [];
  let loadError: string | undefined;

  if (error) {
    loadError = "Your property data could not be retrieved. Please try again.";
  } else if (properties.length) {
    const { data: images, error: imageError } = await supabase.from("property_images")
      .select("*")
      .in("property_id", properties.map(({ id }) => id))
      .order("sort_order", { ascending: true });
    if (imageError) {
      loadError = "Your property photos could not be retrieved. Please retry before managing your listings.";
    } else {
      listings = properties.map((property) => ({
        property,
        images: images.filter((image) => image.property_id === property.id).map((image) => ({
          ...image,
          publicUrl: supabase.storage.from("property-images").getPublicUrl(image.storage_path).data.publicUrl,
        })),
      }));
    }
  }

  const { success } = await searchParams;
  const successMessage = success === "created" || success === "updated" ? success : undefined;

  return <PrivatePageShell eyebrow="For property owners" title="My Listings" activeItem="Listings">
    <MyListingsBoard listings={listings} loadError={loadError} success={successMessage} />
  </PrivatePageShell>;
}
