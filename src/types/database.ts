export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type PropertyTransactionType = "sale" | "rent";
type PropertyType = "house" | "apartment" | "land" | "commercial" | "other";
type PropertyStatus = "draft" | "pending_review" | "published" | "rejected" | "rented" | "sold";
type InquiryStatus = "new" | "read" | "replied" | "closed";

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.1" };
  public: {
    Tables: {
      profiles: Table<
        { id: string; full_name: string | null; email: string | null; avatar_url: string | null; phone: string | null; created_at: string; updated_at: string },
        { id: string; full_name?: string | null; email?: string | null; avatar_url?: string | null; phone?: string | null; created_at?: string; updated_at?: string },
        { full_name?: string | null; avatar_url?: string | null; phone?: string | null; updated_at?: string }
      >;
      properties: Table<
        { id: string; owner_id: string; title: string; description: string | null; transaction_type: PropertyTransactionType; property_type: PropertyType; price: number; currency: string; region: string; district: string | null; neighborhood: string | null; address: string | null; area_sqm: number | null; bedrooms: number | null; bathrooms: number | null; parking_spaces: number | null; furnished: boolean | null; amenities: string[]; latitude: number | null; longitude: number | null; status: PropertyStatus; is_verified: boolean; published_at: string | null; created_at: string; updated_at: string },
        { id?: string; owner_id: string; title: string; description?: string | null; transaction_type: PropertyTransactionType; property_type: PropertyType; price: number; currency?: string; region: string; district?: string | null; neighborhood?: string | null; address?: string | null; area_sqm?: number | null; bedrooms?: number | null; bathrooms?: number | null; parking_spaces?: number | null; furnished?: boolean | null; amenities?: string[]; latitude?: number | null; longitude?: number | null; status?: PropertyStatus; is_verified?: boolean; published_at?: string | null; created_at?: string; updated_at?: string },
        { title?: string; description?: string | null; transaction_type?: PropertyTransactionType; property_type?: PropertyType; price?: number; currency?: string; region?: string; district?: string | null; neighborhood?: string | null; address?: string | null; area_sqm?: number | null; bedrooms?: number | null; bathrooms?: number | null; parking_spaces?: number | null; furnished?: boolean | null; amenities?: string[]; latitude?: number | null; longitude?: number | null; status?: PropertyStatus; updated_at?: string }
      >;
      property_images: Table<
        { id: string; property_id: string; storage_path: string; alt_text: string | null; sort_order: number; created_at: string },
        { id?: string; property_id: string; storage_path: string; alt_text?: string | null; sort_order?: number; created_at?: string },
        { storage_path?: string; alt_text?: string | null; sort_order?: number }
      >;
      favorites: Table<
        { id: string; user_id: string; property_id: string; created_at: string },
        { id?: string; user_id: string; property_id: string; created_at?: string },
        never
      >;
      inquiries: Table<
        { id: string; property_id: string; sender_id: string | null; sender_name: string | null; sender_email: string | null; sender_phone: string | null; message: string; status: InquiryStatus; created_at: string },
        { id?: string; property_id: string; sender_id?: string | null; sender_name?: string | null; sender_email?: string | null; sender_phone?: string | null; message: string; status?: InquiryStatus; created_at?: string },
        { status?: InquiryStatus }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      get_owned_property_private_location: {
        Args: { target_property_id: string };
        Returns: { address: string | null; latitude: number | null; longitude: number | null }[];
      };
      get_admin_property_private_location: {
        Args: { target_property_id: string };
        Returns: { address: string | null; latitude: number | null; longitude: number | null }[];
      };
      approve_property: { Args: { target_property_id: string }; Returns: undefined };
      review_property: { Args: { target_property_id: string; next_status: PropertyStatus; mark_verified: boolean }; Returns: undefined };
    };
    Enums: {
      property_transaction_type: PropertyTransactionType;
      property_type: PropertyType;
      property_status: PropertyStatus;
      inquiry_status: InquiryStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
