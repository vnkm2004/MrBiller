create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) between 1 and 60),
  description text,
  months integer not null check (months between 1 and 120),
  price numeric(12, 2) check (price is null or price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shop_subscriptions (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  plan_id uuid references public.subscription_plans(id) on delete set null,
  starts_at timestamptz not null,
  -- Exclusive end at midnight Asia/Kolkata: access lasts through the prior day at 11:59 PM.
  expires_at timestamptz not null,
  granted_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.subscription_coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and code ~ '^[A-Z0-9-]{4,32}$'),
  plan_id uuid references public.subscription_plans(id) on delete set null,
  months integer not null check (months between 1 and 120),
  max_redemptions integer not null default 1 check (max_redemptions between 1 and 100000),
  redeemed_count integer not null default 0 check (redeemed_count >= 0),
  expires_at timestamptz,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (redeemed_count <= max_redemptions)
);

create table public.subscription_coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.subscription_coupons(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  redeemed_by uuid not null references auth.users(id) on delete restrict,
  redeemed_at timestamptz not null default now(),
  unique (coupon_id, shop_id)
);

create table public.subscription_requests (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete restrict,
  plan_id uuid references public.subscription_plans(id) on delete set null,
  plan_name text not null,
  months integer not null check (months between 1 and 120),
  price numeric(12, 2),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

create unique index subscription_requests_one_pending_per_shop
  on public.subscription_requests (shop_id) where status = 'pending';
create index subscription_requests_status_created_idx
  on public.subscription_requests (status, created_at desc);

alter table public.subscription_plans enable row level security;
alter table public.shop_subscriptions enable row level security;
alter table public.subscription_coupons enable row level security;
alter table public.subscription_coupon_redemptions enable row level security;
alter table public.subscription_requests enable row level security;

create policy "active plans and admins read subscription plans"
  on public.subscription_plans for select to authenticated
  using (
    active
    or exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()))
  );

create policy "admins and shop members read their subscription"
  on public.shop_subscriptions for select to authenticated
  using (
    exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()))
    or exists (
      select 1 from public.shop_memberships m join public.shops s on s.id = m.shop_id
      where m.shop_id = shop_subscriptions.shop_id
        and m.user_id = (select auth.uid()) and m.active and s.active
    )
  );

create policy "admins read subscription coupons"
  on public.subscription_coupons for select to authenticated
  using (exists (select 1 from public.app_admins a where a.user_id = (select auth.uid())));

create policy "admins read coupon redemptions"
  on public.subscription_coupon_redemptions for select to authenticated
  using (exists (select 1 from public.app_admins a where a.user_id = (select auth.uid())));

create policy "admins and shop members read subscription requests"
  on public.subscription_requests for select to authenticated
  using (
    exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()))
    or exists (
      select 1 from public.shop_memberships m join public.shops s on s.id = m.shop_id
      where m.shop_id = subscription_requests.shop_id
        and m.user_id = (select auth.uid()) and m.active and s.active
    )
  );

grant select on public.subscription_plans, public.shop_subscriptions,
  public.subscription_coupons, public.subscription_coupon_redemptions,
  public.subscription_requests to authenticated;
grant all on public.subscription_plans, public.shop_subscriptions,
  public.subscription_coupons, public.subscription_coupon_redemptions,
  public.subscription_requests to service_role;

-- The initial monthly option is deliberately unpriced; the administrator sets the local price.
insert into public.subscription_plans (name, description, months, price)
values ('Monthly', 'One month of shop access', 1, null)
on conflict (name) do nothing;

-- Give every shop that already exists a one-month launch period.
insert into public.shop_subscriptions (shop_id, plan_id, starts_at, expires_at)
select
  s.id,
  p.id,
  now(),
  date_trunc('day', timezone('Asia/Kolkata', now()) + interval '1 month') at time zone 'Asia/Kolkata'
from public.shops s
cross join public.subscription_plans p
where p.name = 'Monthly'
  and not exists (select 1 from public.shop_subscriptions current_sub where current_sub.shop_id = s.id);

create or replace function public.admin_grant_shop_subscription(
  p_shop_id uuid,
  p_months integer,
  p_plan_id uuid,
  p_admin_id uuid
)
returns public.shop_subscriptions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing_sub public.shop_subscriptions;
  saved_sub public.shop_subscriptions;
  period_start timestamptz;
  grant_started_at timestamptz;
begin
  if not exists (select 1 from public.app_admins a where a.user_id = p_admin_id) then
    raise exception using errcode = '42501', message = 'Administrator access is required.';
  end if;
  if p_months is null or p_months < 1 or p_months > 120 then
    raise exception using errcode = '22023', message = 'Subscription duration must be between 1 and 120 months.';
  end if;
  if not exists (select 1 from public.shops s where s.id = p_shop_id) then
    raise exception using errcode = 'P0002', message = 'Shop not found.';
  end if;
  if p_plan_id is not null and not exists (
    select 1 from public.subscription_plans p where p.id = p_plan_id
  ) then
    raise exception using errcode = 'P0002', message = 'Subscription plan not found.';
  end if;

  perform 1 from public.shops s where s.id = p_shop_id for update;

  select * into existing_sub
  from public.shop_subscriptions sub
  where sub.shop_id = p_shop_id
  for update;

  if found and existing_sub.expires_at > now() then
    period_start := existing_sub.expires_at;
    grant_started_at := existing_sub.starts_at;
  else
    period_start := now();
    grant_started_at := period_start;
  end if;

  insert into public.shop_subscriptions (shop_id, plan_id, starts_at, expires_at, granted_by, updated_at)
  values (
    p_shop_id,
    p_plan_id,
    grant_started_at,
    date_trunc('day', timezone('Asia/Kolkata', period_start) + make_interval(months => p_months)) at time zone 'Asia/Kolkata',
    p_admin_id,
    now()
  )
  on conflict (shop_id) do update set
    plan_id = excluded.plan_id,
    starts_at = excluded.starts_at,
    expires_at = excluded.expires_at,
    granted_by = excluded.granted_by,
    updated_at = excluded.updated_at
  returning * into saved_sub;

  return saved_sub;
end;
$$;

create or replace function public.redeem_shop_subscription_coupon(
  p_shop_id uuid,
  p_user_id uuid,
  p_code text
)
returns public.shop_subscriptions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  coupon public.subscription_coupons;
  existing_sub public.shop_subscriptions;
  saved_sub public.shop_subscriptions;
  period_start timestamptz;
  grant_started_at timestamptz;
begin
  if not exists (
    select 1 from public.shop_memberships m join public.shops s on s.id = m.shop_id
    where m.shop_id = p_shop_id and m.user_id = p_user_id and m.active and s.active
  ) then
    raise exception using errcode = '42501', message = 'An active shop login is required.';
  end if;

  perform 1 from public.shops s where s.id = p_shop_id for update;

  select * into coupon
  from public.subscription_coupons c
  where c.code = upper(btrim(p_code))
  for update;
  if not found or not coupon.active then
    raise exception using errcode = 'P0002', message = 'This coupon is invalid or inactive.';
  end if;
  if coupon.expires_at is not null and coupon.expires_at <= now() then
    raise exception using errcode = '22023', message = 'This coupon has expired.';
  end if;
  if coupon.redeemed_count >= coupon.max_redemptions then
    raise exception using errcode = '22023', message = 'This coupon has already been used the maximum number of times.';
  end if;
  if exists (
    select 1 from public.subscription_coupon_redemptions r
    where r.coupon_id = coupon.id and r.shop_id = p_shop_id
  ) then
    raise exception using errcode = '23505', message = 'This shop has already used this coupon.';
  end if;

  select * into existing_sub
  from public.shop_subscriptions sub
  where sub.shop_id = p_shop_id
  for update;

  if found and existing_sub.expires_at > now() then
    period_start := existing_sub.expires_at;
    grant_started_at := existing_sub.starts_at;
  else
    period_start := now();
    grant_started_at := period_start;
  end if;

  insert into public.shop_subscriptions (shop_id, plan_id, starts_at, expires_at, granted_by, updated_at)
  values (
    p_shop_id,
    coupon.plan_id,
    grant_started_at,
    date_trunc('day', timezone('Asia/Kolkata', period_start) + make_interval(months => coupon.months)) at time zone 'Asia/Kolkata',
    coupon.created_by,
    now()
  )
  on conflict (shop_id) do update set
    plan_id = excluded.plan_id,
    starts_at = excluded.starts_at,
    expires_at = excluded.expires_at,
    granted_by = excluded.granted_by,
    updated_at = excluded.updated_at
  returning * into saved_sub;

  insert into public.subscription_coupon_redemptions (coupon_id, shop_id, redeemed_by)
  values (coupon.id, p_shop_id, p_user_id);
  update public.subscription_coupons
  set redeemed_count = redeemed_count + 1
  where id = coupon.id;

  return saved_sub;
end;
$$;

create or replace function public.admin_resolve_subscription_request(
  p_request_id uuid,
  p_approve boolean,
  p_admin_id uuid
)
returns public.subscription_requests
language plpgsql
security invoker
set search_path = ''
as $$
declare
  requested public.subscription_requests;
  resolved public.subscription_requests;
begin
  if not exists (select 1 from public.app_admins a where a.user_id = p_admin_id) then
    raise exception using errcode = '42501', message = 'Administrator access is required.';
  end if;

  select * into requested
  from public.subscription_requests r
  where r.id = p_request_id
  for update;
  if not found or requested.status <> 'pending' then
    raise exception using errcode = 'P0002', message = 'This plan request is no longer pending.';
  end if;

  if p_approve then
    perform public.admin_grant_shop_subscription(
      requested.shop_id,
      requested.months,
      requested.plan_id,
      p_admin_id
    );
  end if;

  update public.subscription_requests
  set status = case when p_approve then 'approved' else 'declined' end,
      resolved_at = now(),
      resolved_by = p_admin_id
  where id = p_request_id
  returning * into resolved;

  return resolved;
end;
$$;

revoke all on function public.admin_grant_shop_subscription(uuid, integer, uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_grant_shop_subscription(uuid, integer, uuid, uuid) to service_role;
revoke all on function public.admin_resolve_subscription_request(uuid, boolean, uuid) from public, anon, authenticated;
grant execute on function public.admin_resolve_subscription_request(uuid, boolean, uuid) to service_role;
revoke all on function public.redeem_shop_subscription_coupon(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.redeem_shop_subscription_coupon(uuid, uuid, text) to service_role;

-- Database-side enforcement complements the expired-shop UI gate.
drop policy "active shop members create products" on public.products;
create policy "active subscribed shop members create products"
  on public.products for insert to authenticated
  with check (
    exists (
      select 1 from public.shop_memberships m join public.shops s on s.id = m.shop_id
      where m.shop_id = products.shop_id and m.user_id = (select auth.uid()) and m.active and s.active
    )
    and exists (
      select 1 from public.shop_subscriptions sub
      where sub.shop_id = products.shop_id and sub.expires_at > now()
    )
  );

drop policy "active shop members update products" on public.products;
create policy "active subscribed shop members update products"
  on public.products for update to authenticated
  using (
    exists (
      select 1 from public.shop_memberships m join public.shops s on s.id = m.shop_id
      where m.shop_id = products.shop_id and m.user_id = (select auth.uid()) and m.active and s.active
    )
    and exists (
      select 1 from public.shop_subscriptions sub
      where sub.shop_id = products.shop_id and sub.expires_at > now()
    )
  )
  with check (
    exists (
      select 1 from public.shop_memberships m join public.shops s on s.id = m.shop_id
      where m.shop_id = products.shop_id and m.user_id = (select auth.uid()) and m.active and s.active
    )
    and exists (
      select 1 from public.shop_subscriptions sub
      where sub.shop_id = products.shop_id and sub.expires_at > now()
    )
  );

drop policy "active shop members delete products" on public.products;
create policy "active subscribed shop members delete products"
  on public.products for delete to authenticated
  using (
    exists (
      select 1 from public.shop_memberships m join public.shops s on s.id = m.shop_id
      where m.shop_id = products.shop_id and m.user_id = (select auth.uid()) and m.active and s.active
    )
    and exists (
      select 1 from public.shop_subscriptions sub
      where sub.shop_id = products.shop_id and sub.expires_at > now()
    )
  );

drop policy "active shop members create invoices" on public.invoices;
create policy "active subscribed shop members create invoices"
  on public.invoices for insert to authenticated
  with check (
    exists (
      select 1 from public.shop_memberships m join public.shops s on s.id = m.shop_id
      where m.shop_id = invoices.shop_id and m.user_id = (select auth.uid()) and m.active and s.active
    )
    and exists (
      select 1 from public.shop_subscriptions sub
      where sub.shop_id = invoices.shop_id and sub.expires_at > now()
    )
  );

drop policy "active shop members update invoices" on public.invoices;
create policy "active subscribed shop members update invoices"
  on public.invoices for update to authenticated
  using (
    exists (
      select 1 from public.shop_memberships m join public.shops s on s.id = m.shop_id
      where m.shop_id = invoices.shop_id and m.user_id = (select auth.uid()) and m.active and s.active
    )
    and exists (
      select 1 from public.shop_subscriptions sub
      where sub.shop_id = invoices.shop_id and sub.expires_at > now()
    )
  )
  with check (
    exists (
      select 1 from public.shop_memberships m join public.shops s on s.id = m.shop_id
      where m.shop_id = invoices.shop_id and m.user_id = (select auth.uid()) and m.active and s.active
    )
    and exists (
      select 1 from public.shop_subscriptions sub
      where sub.shop_id = invoices.shop_id and sub.expires_at > now()
    )
  );

drop policy "active shop members create custom units" on public.custom_units;
create policy "active subscribed shop members create custom units"
  on public.custom_units for insert to authenticated
  with check (
    exists (
      select 1 from public.shop_memberships m join public.shops s on s.id = m.shop_id
      where m.shop_id = custom_units.shop_id and m.user_id = (select auth.uid()) and m.active and s.active
    )
    and exists (
      select 1 from public.shop_subscriptions sub
      where sub.shop_id = custom_units.shop_id and sub.expires_at > now()
    )
  );
