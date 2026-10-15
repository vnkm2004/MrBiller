create table public.invoice_number_sequences (
  shop_id uuid not null references public.shops(id) on delete cascade,
  day_prefix text not null check (day_prefix ~ '^[0-9]{6}$'),
  last_value integer not null check (last_value > 0),
  primary key (shop_id, day_prefix)
);
alter table public.invoice_number_sequences enable row level security;

create policy "active members use their invoice number sequence"
  on public.invoice_number_sequences for all to authenticated
  using (exists (
    select 1 from public.shop_memberships m join public.shops s on s.id = m.shop_id
    where m.shop_id = invoice_number_sequences.shop_id and m.user_id = (select auth.uid())
      and m.active and s.active
  ))
  with check (exists (
    select 1 from public.shop_memberships m join public.shops s on s.id = m.shop_id
    where m.shop_id = invoice_number_sequences.shop_id and m.user_id = (select auth.uid())
      and m.active and s.active
  ));

grant select, insert, update on public.invoice_number_sequences to authenticated;

create function public.next_invoice_number(p_shop_id uuid, p_day_prefix text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  next_value integer;
begin
  if p_day_prefix !~ '^[0-9]{6}$' then
    raise exception 'Invoice day prefix must contain six digits.';
  end if;

  if not exists (
    select 1 from public.shop_memberships m join public.shops s on s.id = m.shop_id
    where m.shop_id = p_shop_id and m.user_id = (select auth.uid()) and m.active and s.active
  ) then
    raise exception using errcode = '42501', message = 'An active shop login is required.';
  end if;

  insert into public.invoice_number_sequences (shop_id, day_prefix, last_value)
  values (
    p_shop_id,
    p_day_prefix,
    greatest(
      1,
      coalesce((
        select max(substring(i.invoice_number from 7)::integer)
        from public.invoices i
        where i.shop_id = p_shop_id
          and i.invoice_number ~ ('^' || p_day_prefix || '[0-9]{4}$')
      ), 0) + 1
    )
  )
  on conflict (shop_id, day_prefix) do update
    set last_value = greatest(
      public.invoice_number_sequences.last_value,
      excluded.last_value - 1
    ) + 1
  returning last_value into next_value;

  return p_day_prefix || lpad(next_value::text, 4, '0');
end;
$$;

revoke all on function public.next_invoice_number(uuid, text) from public, anon;
grant execute on function public.next_invoice_number(uuid, text) to authenticated;
