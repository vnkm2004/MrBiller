create index if not exists shop_subscriptions_plan_id_idx
  on public.shop_subscriptions (plan_id);
create index if not exists shop_subscriptions_granted_by_idx
  on public.shop_subscriptions (granted_by);

create index if not exists subscription_coupons_plan_id_idx
  on public.subscription_coupons (plan_id);
create index if not exists subscription_coupons_created_by_idx
  on public.subscription_coupons (created_by);

create index if not exists coupon_redemptions_shop_id_idx
  on public.subscription_coupon_redemptions (shop_id);
create index if not exists coupon_redemptions_redeemed_by_idx
  on public.subscription_coupon_redemptions (redeemed_by);

create index if not exists subscription_requests_plan_id_idx
  on public.subscription_requests (plan_id);
create index if not exists subscription_requests_requested_by_idx
  on public.subscription_requests (requested_by);
create index if not exists subscription_requests_resolved_by_idx
  on public.subscription_requests (resolved_by);
