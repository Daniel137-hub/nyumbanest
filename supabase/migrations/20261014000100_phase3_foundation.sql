-- NyumbaNest Phase 3: schema, least-privilege grants, RLS, and public listing photos.
create extension if not exists pgcrypto with schema extensions;

create type public.property_transaction_type as enum ('sale', 'rent');
create type public.property_type as enum ('house', 'apartment', 'land', 'commercial', 'other');
create type public.property_status as enum ('draft', 'pending_review', 'published', 'rejected', 'rented', 'sold');
create type public.inquiry_status as enum ('new', 'read', 'replied', 'closed');

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_length check (full_name is null or char_length(full_name) <= 160),
  constraint profiles_email_length check (email is null or char_length(email) <= 320),
  constraint profiles_phone_length check (phone is null or char_length(phone) <= 40),
  constraint profiles_avatar_url_length check (avatar_url is null or char_length(avatar_url) <= 2048)
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  transaction_type public.property_transaction_type not null,
  property_type public.property_type not null,
  price numeric(14,2) not null,
  currency text not null default 'TZS',
  region text not null,
  district text,
  neighborhood text,
  address text,
  area_sqm numeric(12,2),
  bedrooms smallint,
  bathrooms smallint,
  parking_spaces smallint,
  furnished boolean,
  amenities text[] not null default '{}',
  latitude double precision,
  longitude double precision,
  status public.property_status not null default 'draft',
  is_verified boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint properties_title_length check (char_length(title) between 1 and 180),
  constraint properties_description_length check (description is null or char_length(description) <= 12000),
  constraint properties_price_nonnegative check (price >= 0),
  constraint properties_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint properties_region_length check (char_length(region) between 1 and 120),
  constraint properties_location_lengths check (
    (district is null or char_length(district) <= 120) and
    (neighborhood is null or char_length(neighborhood) <= 160) and
    (address is null or char_length(address) <= 500)
  ),
  constraint properties_area_positive check (area_sqm is null or area_sqm > 0),
  constraint properties_bedrooms_nonnegative check (bedrooms is null or bedrooms >= 0),
  constraint properties_bathrooms_nonnegative check (bathrooms is null or bathrooms >= 0),
  constraint properties_parking_nonnegative check (parking_spaces is null or parking_spaces >= 0),
  constraint properties_land_no_rooms check (
    property_type <> 'land' or (bedrooms is null and bathrooms is null and furnished is null)
  ),
  constraint properties_coordinates_pair check ((latitude is null) = (longitude is null)),
  constraint properties_latitude_range check (latitude is null or latitude between -90 and 90),
  constraint properties_longitude_range check (longitude is null or longitude between -180 and 180),
  constraint properties_published_timestamp check (
    (status in ('published', 'rented', 'sold') and published_at is not null) or
    (status in ('draft', 'pending_review', 'rejected') and published_at is null)
  )
);

create table public.property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  storage_path text not null unique,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint property_images_path_length check (char_length(storage_path) between 1 and 1024),
  constraint property_images_alt_text_length check (alt_text is null or char_length(alt_text) <= 500),
  constraint property_images_sort_order_nonnegative check (sort_order >= 0)
);

create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint favorites_user_property_unique unique (user_id, property_id)
);

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  sender_name text,
  sender_email text,
  sender_phone text,
  message text not null,
  status public.inquiry_status not null default 'new',
  created_at timestamptz not null default now(),
  constraint inquiries_name_length check (sender_name is null or char_length(sender_name) between 1 and 160),
  constraint inquiries_email_length check (sender_email is null or char_length(sender_email) <= 320),
  constraint inquiries_phone_length check (sender_phone is null or char_length(sender_phone) <= 40),
  constraint inquiries_message_length check (char_length(message) between 1 and 10000)
);

create index properties_owner_created_idx on public.properties (owner_id, created_at desc);
create index properties_public_browse_idx on public.properties (region, property_type, transaction_type, price)
  where status = 'published';
create index properties_published_at_idx on public.properties (published_at desc) where status = 'published';
create index property_images_property_sort_idx on public.property_images (property_id, sort_order, created_at);
create index favorites_property_idx on public.favorites (property_id);
create index inquiries_property_created_idx on public.inquiries (property_id, created_at desc);
create index inquiries_sender_idx on public.inquiries (sender_id) where sender_id is not null;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger properties_set_updated_at before update on public.properties
  for each row execute function public.set_updated_at();

-- Auth metadata is copied only at creation; users cannot set id/email through table grants.
create or replace function public.initialize_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'avatar_url'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.initialize_profile() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.initialize_profile();

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.property_images enable row level security;
alter table public.favorites enable row level security;
alter table public.inquiries enable row level security;

revoke all on public.profiles, public.properties, public.property_images, public.favorites, public.inquiries from anon, authenticated;

grant select (id, full_name, avatar_url), update (full_name, avatar_url, phone)
  on public.profiles to authenticated;
grant select (id, owner_id, title, description, transaction_type, property_type, price, currency,
  region, district, neighborhood, area_sqm, bedrooms, bathrooms, parking_spaces, furnished,
  amenities, status, is_verified, published_at, created_at, updated_at)
  on public.properties to anon, authenticated;
grant insert (owner_id, title, description, transaction_type, property_type, price, currency,
  region, district, neighborhood, address, area_sqm, bedrooms, bathrooms, parking_spaces, furnished,
  amenities, latitude, longitude, status)
  on public.properties to authenticated;
grant update (title, description, transaction_type, property_type, price, currency, region, district,
  neighborhood, address, area_sqm, bedrooms, bathrooms, parking_spaces, furnished, amenities, latitude,
  longitude, status)
  on public.properties to authenticated;
grant select (id, property_id, storage_path, alt_text, sort_order, created_at)
  on public.property_images to anon, authenticated;
grant insert (property_id, storage_path, alt_text, sort_order), update (storage_path, alt_text, sort_order), delete
  on public.property_images to authenticated;
grant select, insert, delete on public.favorites to authenticated;
grant select (id, property_id, sender_id, sender_name, sender_email, sender_phone, message, status, created_at),
  insert (property_id, sender_id, sender_name, sender_email, sender_phone, message)
  on public.inquiries to anon, authenticated;
grant update (status) on public.inquiries to authenticated;

create policy "profiles_select_own" on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Table grants expose only listing display fields. Owner addresses are available through
-- an ownership-checked function; row policies limit visitors to published stock.
create policy "properties_public_read_published" on public.properties for select to anon, authenticated
  using (status = 'published');
create policy "properties_owner_read" on public.properties for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "properties_owner_insert_unprivileged" on public.properties for insert to authenticated
  with check (owner_id = (select auth.uid()) and status in ('draft', 'pending_review') and not is_verified and published_at is null);
create policy "properties_owner_update_unprivileged" on public.properties for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and status in ('draft', 'pending_review', 'published'));
create policy "properties_explicit_admin_all" on public.properties for all to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Admin review uses this narrowly scoped RPC because client column grants deliberately
-- exclude verification and publication timestamps. Assign app_metadata.role via the
-- Supabase Admin API/service role only; never from user-editable user_metadata.
create or replace function public.review_property(
  target_property_id uuid,
  next_status public.property_status,
  mark_verified boolean
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'admin' then
    raise exception 'Administrative role required' using errcode = '42501';
  end if;
  if next_status not in ('draft', 'pending_review', 'published', 'rejected', 'rented', 'sold') then
    raise exception 'Invalid review status' using errcode = '22023';
  end if;
  update public.properties
    set status = next_status,
        is_verified = mark_verified,
        published_at = case
          when next_status in ('published', 'rented', 'sold') then coalesce(published_at, now())
          else null
        end
    where id = target_property_id;
  if not found then raise exception 'Property not found' using errcode = 'P0002'; end if;
end;
$$;
revoke all on function public.review_property(uuid, public.property_status, boolean) from public, anon;
grant execute on function public.review_property(uuid, public.property_status, boolean) to authenticated;

create policy "property_images_public_for_published" on public.property_images for select to anon, authenticated
  using (exists (select 1 from public.properties p where p.id = property_id and p.status = 'published'));
create policy "property_images_owner_read" on public.property_images for select to authenticated
  using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid())));
create policy "property_images_owner_insert" on public.property_images for insert to authenticated
  with check (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid())));
create policy "property_images_owner_update" on public.property_images for update to authenticated
  using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid())));
create policy "property_images_owner_delete" on public.property_images for delete to authenticated
  using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid())));

create policy "favorites_select_own" on public.favorites for select to authenticated
  using (user_id = (select auth.uid()));
create policy "favorites_insert_own_published" on public.favorites for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.properties p where p.id = property_id and p.status = 'published'
  ));
create policy "favorites_delete_own" on public.favorites for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "inquiries_insert_public_listing" on public.inquiries for insert to anon, authenticated
  with check (
    (sender_id is null or sender_id = (select auth.uid())) and
    exists (select 1 from public.properties p where p.id = property_id and p.status = 'published')
  );
create policy "inquiries_sender_read_own" on public.inquiries for select to authenticated
  using (sender_id = (select auth.uid()));
create policy "inquiries_listing_owner_read" on public.inquiries for select to authenticated
  using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid())));
create policy "inquiries_listing_owner_update_status" on public.inquiries for update to authenticated
  using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid())));

-- Photos are intentionally public for fast listing pages and CDN delivery. Public URLs are
-- permanent and guessable; never put private documents in this bucket. Upload/delete access
-- remains restricted to the owner of the property encoded in {user_id}/{property_id}/... .
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-images', 'property-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "property_images_upload_owned_listing" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'property-images' and
    (storage.foldername(name))[1] = (select auth.uid())::text and
    exists (select 1 from public.properties p where p.id::text = (storage.foldername(name))[2]
      and p.owner_id = (select auth.uid()))
  );
create policy "property_images_update_owned_listing" on storage.objects for update to authenticated
  using (
    bucket_id = 'property-images' and
    (storage.foldername(name))[1] = (select auth.uid())::text and
    exists (select 1 from public.properties p where p.id::text = (storage.foldername(name))[2]
      and p.owner_id = (select auth.uid()))
  ) with check (
    bucket_id = 'property-images' and
    (storage.foldername(name))[1] = (select auth.uid())::text and
    exists (select 1 from public.properties p where p.id::text = (storage.foldername(name))[2]
      and p.owner_id = (select auth.uid()))
  );
create policy "property_images_delete_owned_listing" on storage.objects for delete to authenticated
  using (
    bucket_id = 'property-images' and
    (storage.foldername(name))[1] = (select auth.uid())::text and
    exists (select 1 from public.properties p where p.id::text = (storage.foldername(name))[2]
      and p.owner_id = (select auth.uid()))
  );

comment on table public.profiles is 'Private profile data. RLS exposes each profile only to its owner.';
comment on column public.properties.is_verified is 'Administrative verification flag; client roles cannot insert or update it.';
comment on table public.inquiries is 'Contact details and messages are private to the sender and listing owner.';
