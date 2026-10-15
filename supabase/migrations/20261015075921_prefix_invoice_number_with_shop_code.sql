create or replace function public.next_invoice_number(p_shop_id uuid, p_day_prefix text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  shop_code text;
  existing_max integer;
  next_value integer;
begin
  if p_day_prefix !~ '^[0-9]{6}$' then
    raise exception 'Invoice day prefix must contain six digits.';
  end if;

  select s.code into shop_code
  from public.shop_memberships m
  join public.shops s on s.id = m.shop_id
  where m.shop_id = p_shop_id
    and m.user_id = (select auth.uid())
    and m.active
    and s.active;

  if not found then
    raise exception using errcode = '42501', message = 'An active shop login is required.';
  end if;

  -- Continue from invoices created before shop codes were added to invoice numbers.
  select coalesce(max(
    case
      when i.invoice_number ~ ('^' || p_day_prefix || '[0-9]{4}$')
        then substring(i.invoice_number from 7)::integer
      when left(i.invoice_number, length(shop_code) + 7) = shop_code || '/' || p_day_prefix
        and substring(i.invoice_number from length(shop_code) + 8) ~ '^[0-9]{4}$'
        then substring(i.invoice_number from length(shop_code) + 8)::integer
    end
  ), 0)
  into existing_max
  from public.invoices i
  where i.shop_id = p_shop_id
    and (
      i.invoice_number ~ ('^' || p_day_prefix || '[0-9]{4}$')
      or (
        left(i.invoice_number, length(shop_code) + 7) = shop_code || '/' || p_day_prefix
        and substring(i.invoice_number from length(shop_code) + 8) ~ '^[0-9]{4}$'
      )
    );

  insert into public.invoice_number_sequences (shop_id, day_prefix, last_value)
  values (p_shop_id, p_day_prefix, greatest(1, existing_max + 1))
  on conflict (shop_id, day_prefix) do update
    set last_value = greatest(
      public.invoice_number_sequences.last_value,
      excluded.last_value - 1
    ) + 1
  returning last_value into next_value;

  if next_value > 9999 then
    raise exception using errcode = '22003', message = 'Daily invoice limit reached.';
  end if;

  return shop_code || '/' || p_day_prefix || lpad(next_value::text, 4, '0');
end;
$$;
