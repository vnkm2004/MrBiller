import { withSupabase } from 'npm:@supabase/server@1.9.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Payload = {
  action?: string;
  code?: string;
  plan_id?: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const subscriptionHandler = withSupabase({ auth: 'user' }, async (request, context) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  try {
    const userId = context.userClaims?.id;
    if (!userId) return json({ error: 'Sign in with a shop login first.' }, 401);
    const body = await request.json() as Payload;
    const adminClient = context.supabaseAdmin;

    const { data: membership, error: membershipError } = await adminClient
      .from('shop_memberships')
      .select('shop_id, active')
      .eq('user_id', userId)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership?.active) return json({ error: 'An active shop login is required.' }, 403);

    const { data: shop, error: shopError } = await adminClient
      .from('shops')
      .select('id, active')
      .eq('id', membership.shop_id)
      .maybeSingle();
    if (shopError) throw shopError;
    if (!shop?.active) return json({ error: 'This shop is disabled. Contact the administrator.' }, 403);

    if (body.action === 'redeem_coupon') {
      const code = body.code?.trim().toUpperCase() || '';
      if (!/^[A-Z0-9-]{4,32}$/.test(code)) return json({ error: 'Enter a valid coupon code.' }, 400);
      const { data: subscription, error } = await adminClient.rpc('redeem_shop_subscription_coupon', {
        p_shop_id: shop.id,
        p_user_id: userId,
        p_code: code,
      });
      if (error) throw error;
      return json({ subscription });
    }

    if (body.action === 'request_plan') {
      if (!body.plan_id) return json({ error: 'Choose a subscription plan.' }, 400);
      const { data: plan, error: planError } = await adminClient
        .from('subscription_plans')
        .select('id, name, months, price')
        .eq('id', body.plan_id)
        .eq('active', true)
        .maybeSingle();
      if (planError) throw planError;
      if (!plan) return json({ error: 'This plan is no longer available.' }, 404);

      const { data: existing, error: existingError } = await adminClient
        .from('subscription_requests')
        .select('id')
        .eq('shop_id', shop.id)
        .eq('status', 'pending')
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing) return json({ error: 'A plan request is already waiting for administrator approval.' }, 409);

      const { data: created, error: insertError } = await adminClient
        .from('subscription_requests')
        .insert({
          shop_id: shop.id,
          requested_by: userId,
          plan_id: plan.id,
          plan_name: plan.name,
          months: plan.months,
          price: plan.price,
        })
        .select('id, plan_name, months, status, created_at')
        .single();
      if (insertError?.code === '23505') return json({ error: 'A plan request is already waiting for administrator approval.' }, 409);
      if (insertError) throw insertError;
      return json({ request: created });
    }

    return json({ error: 'Unknown subscription action.' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The subscription request could not be completed.';
    console.error('Subscription request failed:', message);
    return json({ error: message }, 400);
  }
});

Deno.serve((request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  return subscriptionHandler(request);
});
