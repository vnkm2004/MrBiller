create function public.import_shop_data(p_shop_id uuid, p_legacy jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_legacy is null or jsonb_typeof(p_legacy) <> 'object' then
    raise exception 'Import data must be an object.';
  end if;
  if jsonb_array_length(coalesce(p_legacy -> 'products', '[]'::jsonb)) > 5000
    or jsonb_array_length(coalesce(p_legacy -> 'invoices', '[]'::jsonb)) > 5000
    or jsonb_array_length(coalesce(p_legacy -> 'custom_units', '[]'::jsonb)) > 500 then
    raise exception 'This device archive is too large to import in one operation.';
  end if;

  perform s.id from public.shops s where s.id = p_shop_id and s.active for update;
  if not found then
    raise exception 'Shop not found or suspended.';
  end if;
  if exists (select 1 from public.products p where p.shop_id = p_shop_id)
    or exists (select 1 from public.invoices i where i.shop_id = p_shop_id)
    or exists (select 1 from public.custom_units u where u.shop_id = p_shop_id) then
    raise exception 'Choose an empty shop for this import.';
  end if;

  insert into public.products (shop_id, name, name_kn, price, quantity, unit, category, created_at, updated_at)
  select p_shop_id, p.name, p.name_kn, p.price, p.quantity, coalesce(p.unit, 'pcs'), p.category,
    coalesce(p.created_at, (extract(epoch from now()) * 1000)::bigint),
    coalesce(p.updated_at, (extract(epoch from now()) * 1000)::bigint)
  from jsonb_to_recordset(coalesce(p_legacy -> 'products', '[]'::jsonb)) as p(
    name text, name_kn text, price numeric, quantity numeric, unit text, category text,
    created_at bigint, updated_at bigint
  );

  insert into public.invoices (shop_id, invoice_number, date_ms, items, subtotal, gst_rate, gst_amount, total, customer_name, customer_phone, payment_method, status)
  select p_shop_id, i.invoice_number, i.date_ms, coalesce(i.items, '[]'::jsonb), i.subtotal,
    coalesce(i.gst_rate, 0), coalesce(i.gst_amount, 0), i.total, i.customer_name, i.customer_phone,
    i.payment_method, coalesce(i.status, 'completed')
  from jsonb_to_recordset(coalesce(p_legacy -> 'invoices', '[]'::jsonb)) as i(
    invoice_number text, date_ms bigint, items jsonb, subtotal numeric, gst_rate numeric,
    gst_amount numeric, total numeric, customer_name text, customer_phone text,
    payment_method text, status text
  );

  insert into public.custom_units (shop_id, name, created_at)
  select p_shop_id, u.name, coalesce(u.created_at, (extract(epoch from now()) * 1000)::bigint)
  from jsonb_to_recordset(coalesce(p_legacy -> 'custom_units', '[]'::jsonb)) as u(name text, created_at bigint);

  if jsonb_typeof(p_legacy -> 'settings') = 'object' then
    insert into public.store_settings (shop_id, settings)
    values (p_shop_id, p_legacy -> 'settings');
  end if;
end;
$$;

revoke all on function public.import_shop_data(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.import_shop_data(uuid, jsonb) to service_role;
