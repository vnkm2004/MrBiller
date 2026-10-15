create function public.create_invoice_with_stock(
  p_shop_id uuid,
  p_invoice_number text,
  p_date_ms bigint,
  p_items jsonb,
  p_subtotal numeric,
  p_gst_rate numeric,
  p_gst_amount numeric,
  p_total numeric,
  p_customer_name text,
  p_customer_phone text,
  p_payment_method text,
  p_status text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_invoice public.invoices;
  line jsonb;
  v_product_id bigint;
  v_quantity numeric;
  updated_product_id bigint;
begin
  if not exists (
    select 1 from public.shop_memberships m join public.shops s on s.id = m.shop_id
    where m.shop_id = p_shop_id and m.user_id = (select auth.uid()) and m.active and s.active
  ) then
    raise exception using errcode = '42501', message = 'An active shop login is required.';
  end if;

  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'Invoice items must be an array.';
  end if;

  insert into public.invoices (
    shop_id, invoice_number, date_ms, items, subtotal, gst_rate, gst_amount,
    total, customer_name, customer_phone, payment_method, status
  ) values (
    p_shop_id, p_invoice_number, p_date_ms, p_items, p_subtotal, p_gst_rate, p_gst_amount,
    p_total, p_customer_name, p_customer_phone, p_payment_method, p_status
  ) returning * into saved_invoice;

  for line in select value from jsonb_array_elements(p_items) as item(value) loop
    if coalesce(line ->> 'productId', line ->> 'product_id') is null then
      continue;
    end if;
    v_product_id := coalesce(line ->> 'productId', line ->> 'product_id')::bigint;
    v_quantity := (line ->> 'quantity')::numeric;
    if v_quantity <= 0 then
      raise exception 'Invoice quantities must be positive.';
    end if;

    update public.products
      set quantity = quantity - v_quantity, updated_at = p_date_ms
      where id = v_product_id and shop_id = p_shop_id and quantity >= v_quantity
      returning id into updated_product_id;
    if not found then
      raise exception using errcode = '23514', message = 'Not enough stock for one or more products. Refresh the product list and try again.';
    end if;
  end loop;

  return to_jsonb(saved_invoice);
end;
$$;

revoke all on function public.create_invoice_with_stock(uuid, text, bigint, jsonb, numeric, numeric, numeric, numeric, text, text, text, text) from public, anon;
grant execute on function public.create_invoice_with_stock(uuid, text, bigint, jsonb, numeric, numeric, numeric, numeric, text, text, text, text) to authenticated;
