"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function setPropertyFavorite(propertyId: string, saved: boolean) {
  if (!UUID_PATTERN.test(propertyId)) return { error: "This property could not be found." };

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError && authError.name !== "AuthSessionMissingError") {
    return { error: "We couldn't verify your session. Please try again." };
  }
  if (!user) return { error: "Sign in to save properties.", signInRequired: true };

  if (saved) {
    const { error } = await supabase.from("favorites").insert({
      user_id: user.id,
      property_id: propertyId,
    });
    if (error && error.code !== "23505") {
      return { error: "We couldn't save this property. Please try again." };
    }
  } else {
    const { error } = await supabase.from("favorites").delete()
      .eq("user_id", user.id)
      .eq("property_id", propertyId);
    if (error) return { error: "We couldn't remove this saved property. Please try again." };
  }

  revalidatePath("/saved");
  revalidatePath(`/properties/${propertyId}`);
  return { error: null };
}

export type InquiryInput = {
  propertyId: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  website: string;
};

export async function submitPropertyInquiry(input: InquiryInput) {
  if (!UUID_PATTERN.test(input.propertyId)) return { error: "This property could not be found." };
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();
  const message = input.message.trim();

  if (input.website.trim()) return { error: "We couldn't send your message. Please review the form and try again." };
  if (name.length < 1 || name.length > 160) return { error: "Enter your name (up to 160 characters)." };
  if (email.length > 320 || !EMAIL_PATTERN.test(email)) return { error: "Enter a valid email address." };
  if (phone.length > 40) return { error: "Phone numbers must be 40 characters or fewer." };
  if (message.length < 10 || message.length > 4_000) {
    return { error: "Your message must be between 10 and 4,000 characters." };
  }
  if (/https?:\/\/|www\./i.test(message)) {
    return { error: "Please remove links from your message before sending." };
  }

  const supabase = await createClient();
  const { data: property, error: propertyError } = await supabase.from("properties")
    .select("id")
    .eq("id", input.propertyId)
    .eq("status", "published")
    .maybeSingle();
  if (propertyError) return { error: "We couldn't confirm this listing. Please try again." };
  if (!property) return { error: "This listing is no longer available." };

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError && authError.name !== "AuthSessionMissingError") {
    return { error: "We couldn't verify your session. Please try again." };
  }

  const { error } = await supabase.from("inquiries").insert({
    property_id: input.propertyId,
    sender_id: user?.id ?? null,
    sender_name: name,
    sender_email: email,
    sender_phone: phone || null,
    message,
  });
  if (error) {
    return {
      error: error.code === "23514"
        ? "You've sent several messages recently. Please wait a little before trying again."
        : "We couldn't send your inquiry. Please try again.",
    };
  }

  revalidatePath(`/properties/${input.propertyId}`);
  return { error: null };
}
