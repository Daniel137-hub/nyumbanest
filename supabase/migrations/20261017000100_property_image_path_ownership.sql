drop policy "property_images_owner_insert" on public.property_images;
create policy "property_images_owner_insert" on public.property_images for insert to authenticated
  with check (
    exists (
      select 1 from public.properties p
      where p.id = property_images.property_id
        and p.owner_id = (select auth.uid())
    )
    and left(
      property_images.storage_path,
      char_length((select auth.uid())::text || '/' || property_images.property_id::text || '/')
    ) = (select auth.uid())::text || '/' || property_images.property_id::text || '/'
    and char_length(property_images.storage_path) >
      char_length((select auth.uid())::text || '/' || property_images.property_id::text || '/')
  );

drop policy "property_images_owner_update" on public.property_images;
create policy "property_images_owner_update" on public.property_images for update to authenticated
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_images.property_id
        and p.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.properties p
      where p.id = property_images.property_id
        and p.owner_id = (select auth.uid())
    )
    and left(
      property_images.storage_path,
      char_length((select auth.uid())::text || '/' || property_images.property_id::text || '/')
    ) = (select auth.uid())::text || '/' || property_images.property_id::text || '/'
    and char_length(property_images.storage_path) >
      char_length((select auth.uid())::text || '/' || property_images.property_id::text || '/')
  );
