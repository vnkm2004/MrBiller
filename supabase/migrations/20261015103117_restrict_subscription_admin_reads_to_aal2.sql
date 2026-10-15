-- Keep subscription data behind the same administrator MFA requirement as the shop data.
create policy "subscription admin access requires aal2"
  on public.subscription_plans as restrictive for all to authenticated
  using (
    not exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()))
    or (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    not exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()))
    or (select auth.jwt() ->> 'aal') = 'aal2'
  );

create policy "subscription admin access requires aal2"
  on public.shop_subscriptions as restrictive for all to authenticated
  using (
    not exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()))
    or (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    not exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()))
    or (select auth.jwt() ->> 'aal') = 'aal2'
  );

create policy "subscription admin access requires aal2"
  on public.subscription_coupons as restrictive for all to authenticated
  using (
    not exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()))
    or (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    not exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()))
    or (select auth.jwt() ->> 'aal') = 'aal2'
  );

create policy "subscription admin access requires aal2"
  on public.subscription_coupon_redemptions as restrictive for all to authenticated
  using (
    not exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()))
    or (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    not exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()))
    or (select auth.jwt() ->> 'aal') = 'aal2'
  );

create policy "subscription admin access requires aal2"
  on public.subscription_requests as restrictive for all to authenticated
  using (
    not exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()))
    or (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    not exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()))
    or (select auth.jwt() ->> 'aal') = 'aal2'
  );
