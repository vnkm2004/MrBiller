alter table public.subscription_plans
  add column max_users integer not null default 2
  check (max_users between 1 and 60);

alter table public.shop_subscriptions
  add column max_users integer not null default 2
  check (max_users between 1 and 60);

create policy "public can read active subscription plans"
  on public.subscription_plans for select to anon
  using (active);
grant select on public.subscription_plans to anon;

-- Keep the old generic option for historical requests but hide it from new customers.
update public.subscription_plans
set description = 'Legacy monthly plan',
    active = false,
    updated_at = now()
where name = 'Monthly';

-- An earlier setup may already have created a Starter plan at a draft price.
update public.subscription_plans
set description = 'A simple start for a small shop',
    months = 1,
    price = 499,
    active = true,
    max_users = 2,
    updated_at = now()
where name = 'Starter';

insert into public.subscription_plans (name, description, months, price, max_users)
values ('Starter', 'A simple start for a small shop', 1, 499, 2)
on conflict (name) do update set
  description = excluded.description,
  months = excluded.months,
  price = excluded.price,
  max_users = excluded.max_users,
  active = true,
  updated_at = now();

insert into public.subscription_plans (name, description, months, price, max_users)
values
  ('Growth', 'More logins for a growing counter team', 1, 899, 5),
  ('Business', 'Room for a busy shop team', 1, 1599, 10),
  ('Business 25', 'For larger teams and multiple counters', 1, 2999, 25),
  ('Business 60', 'For high-volume shops with larger teams', 1, 5999, 60)
on conflict (name) do update set
  description = excluded.description,
  months = excluded.months,
  price = excluded.price,
  max_users = excluded.max_users,
  active = true,
  updated_at = now();

update public.shop_subscriptions sub
set plan_id = starter.id
from public.subscription_plans monthly, public.subscription_plans starter
where monthly.name = 'Monthly' and starter.name = 'Starter' and sub.plan_id = monthly.id;

update public.shop_subscriptions sub
set max_users = plan.max_users
from public.subscription_plans plan
where plan.id = sub.plan_id;

create table public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('landing', 'shop')),
  status text not null default 'open' check (status in ('open', 'closed')),
  contact_name text not null check (length(btrim(contact_name)) between 1 and 120),
  contact_email text,
  contact_phone text,
  location text,
  shop_id uuid references public.shops(id) on delete set null,
  opened_by uuid references auth.users(id) on delete set null,
  visitor_token_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  check (
    (source = 'landing' and contact_email is not null and contact_phone is not null and location is not null and visitor_token_hash is not null and shop_id is null)
    or
    (source = 'shop' and shop_id is not null and opened_by is not null and visitor_token_hash is null)
  )
);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  sender_role text not null check (sender_role in ('customer', 'shop_user', 'admin')),
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_name text not null check (length(btrim(sender_name)) between 1 and 120),
  body text not null check (length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index support_conversations_updated_idx on public.support_conversations (status, last_message_at desc);
create index support_conversations_shop_idx on public.support_conversations (shop_id, last_message_at desc) where shop_id is not null;
create unique index support_conversations_visitor_token_idx on public.support_conversations (visitor_token_hash) where visitor_token_hash is not null;
create index support_messages_conversation_created_idx on public.support_messages (conversation_id, created_at);

alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;

-- Conversation data is accessed only through the support-chat Edge Function, which
-- validates a visitor token or a signed-in shop/admin identity on every request.
revoke all on public.support_conversations, public.support_messages from public, anon, authenticated;
grant all on public.support_conversations, public.support_messages to service_role;

-- Keep the earlier subscription grant RPC signature and store the plan's seat limit.
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
  granted_user_limit integer := 2;
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
  if p_plan_id is not null then
    select p.max_users into granted_user_limit from public.subscription_plans p where p.id = p_plan_id;
    if not found then
      raise exception using errcode = 'P0002', message = 'Subscription plan not found.';
    end if;
  end if;

  perform 1 from public.shops s where s.id = p_shop_id for update;
  select * into existing_sub from public.shop_subscriptions sub where sub.shop_id = p_shop_id for update;
  if found and existing_sub.expires_at > now() then
    if p_plan_id is null then granted_user_limit := existing_sub.max_users; end if;
    period_start := existing_sub.expires_at;
    grant_started_at := existing_sub.starts_at;
  else
    period_start := now();
    grant_started_at := period_start;
  end if;

  insert into public.shop_subscriptions (shop_id, plan_id, starts_at, expires_at, granted_by, updated_at, max_users)
  values (
    p_shop_id,
    p_plan_id,
    grant_started_at,
    date_trunc('day', timezone('Asia/Kolkata', period_start) + make_interval(months => p_months)) at time zone 'Asia/Kolkata',
    p_admin_id,
    now(),
    granted_user_limit
  )
  on conflict (shop_id) do update set
    plan_id = excluded.plan_id,
    starts_at = excluded.starts_at,
    expires_at = excluded.expires_at,
    granted_by = excluded.granted_by,
    updated_at = excluded.updated_at,
    max_users = excluded.max_users
  returning * into saved_sub;
  return saved_sub;
end;
$$;

revoke all on function public.admin_grant_shop_subscription(uuid, integer, uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_grant_shop_subscription(uuid, integer, uuid, uuid) to service_role;

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
  granted_user_limit integer := 2;
begin
  if not exists (
    select 1 from public.shop_memberships m join public.shops s on s.id = m.shop_id
    where m.shop_id = p_shop_id and m.user_id = p_user_id and m.active and s.active
  ) then
    raise exception using errcode = '42501', message = 'An active shop login is required.';
  end if;

  perform 1 from public.shops s where s.id = p_shop_id for update;
  select * into coupon from public.subscription_coupons c where c.code = upper(btrim(p_code)) for update;
  if not found or not coupon.active then
    raise exception using errcode = 'P0002', message = 'This coupon is invalid or inactive.';
  end if;
  if coupon.expires_at is not null and coupon.expires_at <= now() then
    raise exception using errcode = '22023', message = 'This coupon has expired.';
  end if;
  if coupon.redeemed_count >= coupon.max_redemptions then
    raise exception using errcode = '22023', message = 'This coupon has already been used the maximum number of times.';
  end if;
  if exists (select 1 from public.subscription_coupon_redemptions r where r.coupon_id = coupon.id and r.shop_id = p_shop_id) then
    raise exception using errcode = '23505', message = 'This shop has already used this coupon.';
  end if;
  if coupon.plan_id is not null then
    select p.max_users into granted_user_limit from public.subscription_plans p where p.id = coupon.plan_id;
    if not found then
      raise exception using errcode = 'P0002', message = 'The coupon plan is no longer available.';
    end if;
  end if;

  select * into existing_sub from public.shop_subscriptions sub where sub.shop_id = p_shop_id for update;
  if found and existing_sub.expires_at > now() then
    if coupon.plan_id is null then granted_user_limit := existing_sub.max_users; end if;
    period_start := existing_sub.expires_at;
    grant_started_at := existing_sub.starts_at;
  else
    period_start := now();
    grant_started_at := period_start;
  end if;

  insert into public.shop_subscriptions (shop_id, plan_id, starts_at, expires_at, granted_by, updated_at, max_users)
  values (
    p_shop_id,
    coupon.plan_id,
    grant_started_at,
    date_trunc('day', timezone('Asia/Kolkata', period_start) + make_interval(months => coupon.months)) at time zone 'Asia/Kolkata',
    coupon.created_by,
    now(),
    granted_user_limit
  )
  on conflict (shop_id) do update set
    plan_id = excluded.plan_id,
    starts_at = excluded.starts_at,
    expires_at = excluded.expires_at,
    granted_by = excluded.granted_by,
    updated_at = excluded.updated_at,
    max_users = excluded.max_users
  returning * into saved_sub;

  insert into public.subscription_coupon_redemptions (coupon_id, shop_id, redeemed_by) values (coupon.id, p_shop_id, p_user_id);
  update public.subscription_coupons set redeemed_count = redeemed_count + 1 where id = coupon.id;
  return saved_sub;
end;
$$;

revoke all on function public.redeem_shop_subscription_coupon(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.redeem_shop_subscription_coupon(uuid, uuid, text) to service_role;
