revoke select (address, latitude, longitude) on public.properties from anon, authenticated;

create or replace function public.get_owned_property_private_location(target_property_id uuid)
returns table (address text, latitude double precision, longitude double precision)
language sql
stable
security definer
set search_path = ''
as $$
  select p.address, p.latitude, p.longitude
  from public.properties as p
  where p.id = target_property_id
    and p.owner_id = (select auth.uid())
$$;

revoke all on function public.get_owned_property_private_location(uuid) from public, anon;
grant execute on function public.get_owned_property_private_location(uuid) to authenticated;
