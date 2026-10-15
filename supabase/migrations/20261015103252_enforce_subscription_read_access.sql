-- Expired shop members can still open the subscription panel but cannot read shop data directly.
drop policy "admins and members read store settings" on public.store_settings;
create policy "admins and active subscribers read store settings"
  on public.store_settings for select to authenticated
  using (
    exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()))
    or exists (
      select 1 from public.shop_memberships m join public.shops s on s.id = m.shop_id
      where m.shop_id = store_settings.shop_id
        and m.user_id = (select auth.uid()) and m.active and s.active
        and exists (
          select 1 from public.shop_subscriptions sub
          where sub.shop_id = store_settings.shop_id and sub.expires_at > now()
        )
    )
  );

drop policy "admins and members read products" on public.products;
create policy "admins and active subscribers read products"
  on public.products for select to authenticated
  using (
    exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()))
    or exists (
      select 1 from public.shop_memberships m join public.shops s on s.id = m.shop_id
      where m.shop_id = products.shop_id
        and m.user_id = (select auth.uid()) and m.active and s.active
        and exists (
          select 1 from public.shop_subscriptions sub
          where sub.shop_id = products.shop_id and sub.expires_at > now()
        )
    )
  );

drop policy "admins and members read invoices" on public.invoices;
create policy "admins and active subscribers read invoices"
  on public.invoices for select to authenticated
  using (
    exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()))
    or exists (
      select 1 from public.shop_memberships m join public.shops s on s.id = m.shop_id
      where m.shop_id = invoices.shop_id
        and m.user_id = (select auth.uid()) and m.active and s.active
        and exists (
          select 1 from public.shop_subscriptions sub
          where sub.shop_id = invoices.shop_id and sub.expires_at > now()
        )
    )
  );

drop policy "admins and members read custom units" on public.custom_units;
create policy "admins and active subscribers read custom units"
  on public.custom_units for select to authenticated
  using (
    exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()))
    or exists (
      select 1 from public.shop_memberships m join public.shops s on s.id = m.shop_id
      where m.shop_id = custom_units.shop_id
        and m.user_id = (select auth.uid()) and m.active and s.active
        and exists (
          select 1 from public.shop_subscriptions sub
          where sub.shop_id = custom_units.shop_id and sub.expires_at > now()
        )
    )
  );
