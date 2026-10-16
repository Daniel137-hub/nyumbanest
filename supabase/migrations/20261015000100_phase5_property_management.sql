-- Owners can remove only their own properties. The existing RLS policies continue
-- to authorize selection and mutations; no privileged server key is required.
grant delete on public.properties to authenticated;

create policy "properties_owner_delete" on public.properties for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Any owner edit to a live/closed listing returns it to moderation before it can
-- become visible again. Owners cannot modify is_verified or published_at directly.
create or replace function public.requeue_live_property_edits()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status in ('published', 'rented', 'sold') and (
    new.title is distinct from old.title or
    new.description is distinct from old.description or
    new.transaction_type is distinct from old.transaction_type or
    new.property_type is distinct from old.property_type or
    new.price is distinct from old.price or
    new.currency is distinct from old.currency or
    new.region is distinct from old.region or
    new.district is distinct from old.district or
    new.neighborhood is distinct from old.neighborhood or
    new.address is distinct from old.address or
    new.area_sqm is distinct from old.area_sqm or
    new.bedrooms is distinct from old.bedrooms or
    new.bathrooms is distinct from old.bathrooms or
    new.parking_spaces is distinct from old.parking_spaces or
    new.furnished is distinct from old.furnished or
    new.amenities is distinct from old.amenities or
    new.latitude is distinct from old.latitude or
    new.longitude is distinct from old.longitude or
    new.status is distinct from old.status
  ) then
    new.status := 'pending_review';
    new.is_verified := false;
    new.published_at := null;
  end if;
  return new;
end;
$$;

create trigger properties_requeue_live_edits
  before update on public.properties
  for each row execute function public.requeue_live_property_edits();
