create or replace function public.enforce_inquiry_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text;
begin
  normalized_email := lower(btrim(coalesce(new.sender_email, '')));
  if normalized_email = '' then
    raise exception 'An email address is required to send an inquiry'
      using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(normalized_email, 0)
  );

  if (
    select count(*)
    from public.inquiries as inquiry
    where lower(btrim(inquiry.sender_email)) = normalized_email
      and inquiry.created_at > now() - interval '10 minutes'
  ) >= 3 then
    raise exception 'Inquiry rate limit reached'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_inquiry_rate_limit() from public, anon, authenticated;

create index inquiries_email_created_at_idx
  on public.inquiries ((lower(btrim(sender_email))), created_at desc);

create trigger inquiries_rate_limit_before_insert
before insert on public.inquiries
for each row execute function public.enforce_inquiry_rate_limit();
