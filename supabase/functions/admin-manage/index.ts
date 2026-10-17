import { withSupabase } from 'npm:@supabase/server@1.9.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Payload = {
  action?: string;
  name?: string;
  code?: string;
  username?: string;
  password?: string;
  shop_id?: string;
  user_id?: string;
  active?: boolean;
  plan_id?: string | null;
  plan_name?: string;
  description?: string | null;
  months?: number;
  price?: number | null;
  max_users?: number;
  coupon_id?: string | null;
  code?: string;
  max_redemptions?: number;
  expires_at?: string | null;
  request_id?: string;
  approve?: boolean;
  legacy?: {
    products?: Array<Record<string, unknown>>;
    invoices?: Array<Record<string, unknown>>;
    customUnits?: Array<Record<string, unknown>>;
    settings?: Record<string, unknown> | null;
  };
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function validUsername(value: string) {
  return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(value);
}

function validPassword(value: string) {
  return value.length >= 8 && value.length <= 256;
}

function loginEmail(shopCode: string, username: string) {
  return `user-${username}-${shopCode}@accounts.biller.invalid`;
}

const adminHandler = withSupabase({ auth: 'user' }, async (request, context) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  try {
    const actorId = context.userClaims?.id;
    if (!actorId) return json({ error: 'Sign in as an administrator first.' }, 401);
    if (context.jwtClaims?.aal !== 'aal2') {
      return json({ error: 'Complete administrator sign-in with your authenticator code first.' }, 403);
    }
    const adminClient = context.supabaseAdmin;
    const { data: admin, error: adminError } = await adminClient
      .from('app_admins')
      .select('user_id')
      .eq('user_id', actorId)
      .maybeSingle();
    if (adminError) throw adminError;
    if (!admin) return json({ error: 'Administrator access is required for this action.' }, 403);

    const body = await request.json() as Payload;

    if (body.action === 'create_shop') {
      const name = body.name?.trim() || '';
      const code = body.code?.trim().toLowerCase() || '';
      const username = body.username?.trim().toLowerCase() || '';
      const password = body.password || '';
      if (!name || name.length > 80) return json({ error: 'Enter a shop name under 80 characters.' }, 400);
      if (!/^[a-z0-9][a-z0-9-]{1,19}$/.test(code)) return json({ error: 'Shop ID must contain 2–20 lowercase letters, numbers, or hyphens.' }, 400);
      if (!validUsername(username)) return json({ error: 'User ID must contain 3–32 lowercase letters, numbers, dots, underscores, or hyphens.' }, 400);
      if (!validPassword(password)) return json({ error: 'Password must contain 8–256 characters.' }, 400);

      const { data: starterPlan, error: starterPlanError } = await adminClient.from('subscription_plans')
        .select('id').eq('name', 'Starter').eq('active', true).maybeSingle();
      if (starterPlanError) throw starterPlanError;
      if (!starterPlan) return json({ error: 'The Starter plan is unavailable. Enable it before creating a shop.' }, 503);

      const { data: shop, error: shopError } = await adminClient
        .from('shops')
        .insert({ name, code })
        .select('id, code, name')
        .single();
      if (shopError) throw shopError;

      const { data: created, error: createUserError } = await adminClient.auth.admin.createUser({
        email: loginEmail(code, username),
        password,
        email_confirm: true,
      });
      if (createUserError || !created.user) {
        await adminClient.from('shops').delete().eq('id', shop.id);
        throw createUserError || new Error('Could not create the shop login.');
      }

      const { error: membershipError } = await adminClient.from('shop_memberships').insert({
        shop_id: shop.id,
        user_id: created.user.id,
        username,
        role: 'owner',
      });
      if (membershipError) {
        await adminClient.auth.admin.deleteUser(created.user.id);
        await adminClient.from('shops').delete().eq('id', shop.id);
        throw membershipError;
      }

      const { error: trialError } = await adminClient.rpc('admin_grant_shop_subscription', {
        p_shop_id: shop.id,
        p_months: 1,
        p_plan_id: starterPlan.id,
        p_admin_id: actorId,
      });
      if (trialError) {
        await adminClient.auth.admin.deleteUser(created.user.id);
        await adminClient.from('shops').delete().eq('id', shop.id);
        throw trialError;
      }

      return json({ shop: { id: shop.id, code: shop.code, name: shop.name }, username });
    }

    if (body.action === 'create_user') {
      const shopId = body.shop_id || '';
      const username = body.username?.trim().toLowerCase() || '';
      const password = body.password || '';
      if (!shopId) return json({ error: 'Choose a shop for this login.' }, 400);
      if (!validUsername(username)) return json({ error: 'User ID must contain 3–32 lowercase letters, numbers, dots, underscores, or hyphens.' }, 400);
      if (!validPassword(password)) return json({ error: 'Password must contain 8–256 characters.' }, 400);

      const { data: shop, error: shopError } = await adminClient
        .from('shops')
        .select('id, code, name, active')
        .eq('id', shopId)
        .maybeSingle();
      if (shopError) throw shopError;
      if (!shop) return json({ error: 'Shop not found.' }, 404);
      if (!shop.active) return json({ error: 'Reactivate the shop before adding a login.' }, 400);

      const { data: subscription, error: subscriptionError } = await adminClient.from('shop_subscriptions')
        .select('expires_at, max_users').eq('shop_id', shop.id).maybeSingle();
      if (subscriptionError) throw subscriptionError;
      if (!subscription || Date.parse(subscription.expires_at) <= Date.now()) {
        return json({ error: 'Activate a subscription before adding another user ID.' }, 403);
      }
      const { count: activeLoginCount, error: memberCountError } = await adminClient.from('shop_memberships')
        .select('id', { count: 'exact', head: true }).eq('shop_id', shop.id).eq('active', true);
      if (memberCountError) throw memberCountError;
      if ((activeLoginCount || 0) >= subscription.max_users) {
        return json({ error: `This plan includes up to ${subscription.max_users} active user IDs, including the owner login. Upgrade the plan or disable an existing login to add another.` }, 409);
      }

      const { data: created, error: createUserError } = await adminClient.auth.admin.createUser({
        email: loginEmail(shop.code, username),
        password,
        email_confirm: true,
      });
      if (createUserError || !created.user) throw createUserError || new Error('Could not create the login.');

      const { error: membershipError } = await adminClient.from('shop_memberships').insert({
        shop_id: shop.id,
        user_id: created.user.id,
        username,
        role: 'staff',
      });
      if (membershipError) {
        await adminClient.auth.admin.deleteUser(created.user.id);
        throw membershipError;
      }

      return json({ user_id: created.user.id, username });
    }

    if (body.action === 'set_shop_active') {
      if (!body.shop_id || typeof body.active !== 'boolean') return json({ error: 'Shop and active state are required.' }, 400);
      const { data: shop, error } = await adminClient
        .from('shops')
        .update({ active: body.active })
        .eq('id', body.shop_id)
        .select('id, name, active')
        .single();
      if (error) throw error;
      return json({ shop });
    }

    if (body.action === 'set_user_active') {
      if (!body.user_id || typeof body.active !== 'boolean') return json({ error: 'User and active state are required.' }, 400);
      const { data: membership, error } = await adminClient
        .from('shop_memberships')
        .update({ active: body.active })
        .eq('user_id', body.user_id)
        .select('username, active')
        .single();
      if (error) throw error;
      return json({ username: membership.username, active: membership.active });
    }

    if (body.action === 'reset_password') {
      const password = body.password || '';
      if (!body.user_id) return json({ error: 'Choose a login to reset.' }, 400);
      if (!validPassword(password)) return json({ error: 'Password must contain 8–256 characters.' }, 400);
      const { data: membership, error: memberError } = await adminClient
        .from('shop_memberships')
        .select('username')
        .eq('user_id', body.user_id)
        .maybeSingle();
      if (memberError) throw memberError;
      if (!membership) return json({ error: 'Shop login not found.' }, 404);
      const { error } = await adminClient.auth.admin.updateUserById(body.user_id, { password });
      if (error) throw error;
      return json({ username: membership.username });
    }

    if (body.action === 'save_subscription_plan') {
      const name = body.name?.trim() || '';
      const description = body.description?.trim() || null;
      const months = Number(body.months);
      const price = body.price === null || body.price === undefined || body.price === '' ? null : Number(body.price);
      const maxUsers = Number(body.max_users);
      if (!name || name.length > 60) return json({ error: 'Plan name must contain 1–60 characters.' }, 400);
      if (description && description.length > 160) return json({ error: 'Plan description must be 160 characters or fewer.' }, 400);
      if (!Number.isInteger(months) || months < 1 || months > 120) return json({ error: 'Plan duration must be between 1 and 120 months.' }, 400);
      if (price !== null && (!Number.isFinite(price) || price < 0)) return json({ error: 'Plan price must be zero or higher.' }, 400);
      if (!Number.isInteger(maxUsers) || maxUsers < 1 || maxUsers > 60) return json({ error: 'Plan user ID limit must be between 1 and 60.' }, 400);
      if (typeof body.active !== 'boolean') return json({ error: 'Choose whether this plan is available.' }, 400);

      const values = { name, description, months, price, max_users: maxUsers, active: body.active, updated_at: new Date().toISOString() };
      const query = body.plan_id
        ? adminClient.from('subscription_plans').update(values).eq('id', body.plan_id)
        : adminClient.from('subscription_plans').insert(values);
      const { data: plan, error } = await query.select('id, name, months, price, max_users, active').single();
      if (error) throw error;
      return json({ plan });
    }

    if (body.action === 'save_subscription_coupon') {
      const couponId = body.coupon_id || null;
      const code = body.code?.trim().toUpperCase() || '';
      const months = Number(body.months);
      const maxRedemptions = Number(body.max_redemptions);
      const expiresAt = body.expires_at || null;
      if (!/^[A-Z0-9-]{4,32}$/.test(code)) return json({ error: 'Coupon code must contain 4–32 letters, numbers, or hyphens.' }, 400);
      if (!Number.isInteger(months) || months < 1 || months > 120) return json({ error: 'Coupon duration must be between 1 and 120 months.' }, 400);
      if (!Number.isInteger(maxRedemptions) || maxRedemptions < 1 || maxRedemptions > 100000) return json({ error: 'Enter a valid coupon redemption limit.' }, 400);
      if (expiresAt && (!Number.isFinite(Date.parse(expiresAt)) || (body.active && Date.parse(expiresAt) <= Date.now()))) {
        return json({ error: 'Coupon expiry must be a future date.' }, 400);
      }
      if (typeof body.active !== 'boolean') return json({ error: 'Choose whether this coupon can be redeemed.' }, 400);
      if (body.plan_id) {
        const { data: plan, error } = await adminClient.from('subscription_plans').select('id').eq('id', body.plan_id).maybeSingle();
        if (error) throw error;
        if (!plan) return json({ error: 'Choose a valid subscription plan.' }, 400);
      }
      if (couponId) {
        const { data: current, error: readError } = await adminClient
          .from('subscription_coupons').select('redeemed_count').eq('id', couponId).maybeSingle();
        if (readError) throw readError;
        if (!current) return json({ error: 'Coupon not found.' }, 404);
        if (maxRedemptions < current.redeemed_count) return json({ error: 'Redemption limit cannot be lower than uses already claimed.' }, 400);
      }

      const values = {
        code,
        plan_id: body.plan_id || null,
        months,
        max_redemptions: maxRedemptions,
        expires_at: expiresAt,
        active: body.active,
      };
      const query = couponId
        ? adminClient.from('subscription_coupons').update(values).eq('id', couponId)
        : adminClient.from('subscription_coupons').insert({ ...values, created_by: actorId });
      const { data: coupon, error } = await query.select('id, code, months, max_redemptions, redeemed_count, active').single();
      if (error) throw error;
      return json({ coupon });
    }

    if (body.action === 'grant_subscription') {
      const shopId = body.shop_id || '';
      const months = Number(body.months);
      if (!shopId) return json({ error: 'Choose a shop.' }, 400);
      if (!Number.isInteger(months) || months < 1 || months > 120) return json({ error: 'Subscription duration must be between 1 and 120 months.' }, 400);
      const { data: subscription, error } = await adminClient.rpc('admin_grant_shop_subscription', {
        p_shop_id: shopId,
        p_months: months,
        p_plan_id: body.plan_id || null,
        p_admin_id: actorId,
      });
      if (error) throw error;
      return json({ subscription });
    }

    if (body.action === 'set_subscription_plan') {
      const shopId = body.shop_id || '';
      const planId = body.plan_id || '';
      if (!shopId || !planId) return json({ error: 'Choose a shop and plan.' }, 400);

      const [planResult, subscriptionResult, memberCountResult] = await Promise.all([
        adminClient.from('subscription_plans').select('id, name, max_users').eq('id', planId).eq('active', true).maybeSingle(),
        adminClient.from('shop_subscriptions').select('shop_id').eq('shop_id', shopId).maybeSingle(),
        adminClient.from('shop_memberships').select('id', { count: 'exact', head: true }).eq('shop_id', shopId).eq('active', true),
      ]);
      if (planResult.error) throw planResult.error;
      if (subscriptionResult.error) throw subscriptionResult.error;
      if (memberCountResult.error) throw memberCountResult.error;
      if (!planResult.data) return json({ error: 'Choose an active subscription plan.' }, 400);
      if (!subscriptionResult.data) return json({ error: 'Activate a subscription before changing its plan.' }, 400);

      const activeUsers = memberCountResult.count || 0;
      if (activeUsers > planResult.data.max_users) {
        return json({
          error: `This shop has ${activeUsers} active logins. Disable logins until the count fits the ${planResult.data.name} plan limit of ${planResult.data.max_users}.`,
        }, 409);
      }

      const { data: subscription, error } = await adminClient.from('shop_subscriptions')
        .update({ plan_id: planResult.data.id, max_users: planResult.data.max_users, granted_by: actorId, updated_at: new Date().toISOString() })
        .eq('shop_id', shopId)
        .select('shop_id, plan_id, starts_at, expires_at, max_users')
        .single();
      if (error) throw error;
      return json({ subscription });
    }

    if (body.action === 'resolve_subscription_request') {
      if (!body.request_id || typeof body.approve !== 'boolean') return json({ error: 'Choose a request and resolution.' }, 400);
      const { data: requestRow, error } = await adminClient.rpc('admin_resolve_subscription_request', {
        p_request_id: body.request_id,
        p_approve: body.approve,
        p_admin_id: actorId,
      });
      if (error) throw error;
      return json({ request: requestRow });
    }

    if (body.action === 'import_shop_data') {
      const shopId = body.shop_id || '';
      const legacy = body.legacy;
      if (!shopId || !legacy) return json({ error: 'Choose a shop and device archive.' }, 400);
      const products = legacy.products || [];
      const invoices = legacy.invoices || [];
      const customUnits = legacy.customUnits || [];
      if (products.length + invoices.length + customUnits.length > 10000) {
        return json({ error: 'This device archive is too large to import.' }, 400);
      }

      const legacyPayload = {
        products: products.map((product) => ({
          name: product.name,
          name_kn: product.nameKn || null,
          price: product.price,
          quantity: product.quantity,
          unit: product.unit || 'pcs',
          category: product.category || null,
          created_at: product.createdAt,
          updated_at: product.updatedAt,
        })),
        invoices: invoices.map((invoice) => ({
          invoice_number: invoice.invoiceNumber,
          date_ms: invoice.date,
          items: invoice.items,
          subtotal: invoice.subtotal,
          gst_rate: invoice.gstRate || 0,
          gst_amount: invoice.gstAmount || 0,
          total: invoice.total,
          customer_name: invoice.customerName || null,
          customer_phone: invoice.customerPhone || null,
          payment_method: invoice.paymentMethod,
          status: invoice.status || 'completed',
        })),
        custom_units: customUnits.map((unit) => ({ name: unit.name, created_at: unit.createdAt })),
        settings: legacy.settings || null,
      };

      const { error } = await adminClient.rpc('import_shop_data', {
        p_shop_id: shopId,
        p_legacy: legacyPayload,
      });
      if (error) throw error;
      return json({ imported: true });
    }

    return json({ error: 'Unknown administration action.' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The request could not be completed.';
    console.error('Admin management request failed:', message);
    return json({ error: message }, 400);
  }
});

Deno.serve((request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  return adminHandler(request);
});
