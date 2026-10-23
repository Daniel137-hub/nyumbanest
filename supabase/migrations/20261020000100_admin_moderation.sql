create policy "profiles_admin_read" on public.profiles for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "property_images_admin_read" on public.property_images for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "property_images_admin_delete" on public.property_images for delete to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "property_images_admin_storage_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'property-images' and
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create or replace function public.get_admin_property_private_location(target_property_id uuid)
returns table (address text, latitude double precision, longitude double precision)
language sql
stable
security definer
set search_path = ''
as $$
  select p.address, p.latitude, p.longitude
  from public.properties as p
  where p.id = target_property_id
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
$$;

revoke all on function public.get_admin_property_private_location(uuid) from public, anon;
grant execute on function public.get_admin_property_private_location(uuid) to authenticated;

create or replace function public.approve_property(target_property_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'admin' then
    raise exception 'Administrative role required' using errcode = '42501';
  end if;

  update public.properties
    set status = 'published',
        is_verified = false,
        published_at = now()
    where id = target_property_id
      and status = 'pending_review';

  if not found then
    raise exception 'Property not found or not awaiting review' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.approve_property(uuid) from public, anon;
grant execute on function public.approve_property(uuid) to authenticated;
