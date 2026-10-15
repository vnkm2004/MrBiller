create or replace function public.create_invoice_with_stock(
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
  v_stock_quantity numeric;
  v_product_unit text;
  v_line_unit text;
  v_product_unit_normalized text;
  v_line_unit_normalized text;
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
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Invoice quantities must be positive.';
    end if;

    select coalesce(nullif(btrim(p.unit), ''), 'pcs') into v_product_unit
      from public.products p
      where p.id = v_product_id and p.shop_id = p_shop_id;
    if not found then
      raise exception using errcode = '23514', message = 'Product was not found in this shop.';
    end if;

    v_line_unit := line ->> 'unit';
    if v_line_unit is null or btrim(v_line_unit) = '' then
      v_stock_quantity := v_quantity;
    else
      v_product_unit_normalized := lower(btrim(v_product_unit));
      v_line_unit_normalized := lower(btrim(v_line_unit));
      if v_product_unit_normalized in ('g', 'gram', 'grams') then
        v_product_unit_normalized := 'gm';
      end if;
      if v_line_unit_normalized in ('g', 'gram', 'grams') then
        v_line_unit_normalized := 'gm';
      end if;

      if v_product_unit_normalized = v_line_unit_normalized then
        v_stock_quantity := v_quantity;
      elsif v_product_unit_normalized = 'kg' and v_line_unit_normalized = 'gm' then
        v_stock_quantity := v_quantity / 1000;
      elsif v_product_unit_normalized = 'gm' and v_line_unit_normalized = 'kg' then
        v_stock_quantity := v_quantity * 1000;
      else
        raise exception 'Invoice quantity unit is not compatible with the product stock unit.';
      end if;
    end if;

    if v_stock_quantity <= 0 then
      raise exception 'Invoice quantities must be positive.';
    end if;

    update public.products
      set quantity = greatest(coalesce(quantity, 0) - v_stock_quantity, 0),
          updated_at = p_date_ms
      where id = v_product_id and shop_id = p_shop_id
      returning id into updated_product_id;
    if not found then
      raise exception using errcode = '23514', message = 'Product was not found in this shop.';
    end if;
  end loop;

  return to_jsonb(saved_invoice);
end;
$$;

revoke all on function public.create_invoice_with_stock(uuid, text, bigint, jsonb, numeric, numeric, numeric, numeric, text, text, text, text) from public, anon;
grant execute on function public.create_invoice_with_stock(uuid, text, bigint, jsonb, numeric, numeric, numeric, numeric, text, text, text, text) to authenticated;
