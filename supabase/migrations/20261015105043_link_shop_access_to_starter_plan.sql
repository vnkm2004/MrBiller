-- Link older free-month subscriptions to the now-priced entry plan without
-- changing their already recorded start or expiry time.
update public.shop_subscriptions sub
set plan_id = plan.id,
    max_users = plan.max_users
from public.subscription_plans plan
where plan.name = 'Starter'
  and sub.plan_id is null;
