import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Payload = {
  action?: string;
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  message?: string;
  conversation_id?: string;
  visitor_token?: string;
  status?: 'open' | 'closed';
};

type Identity = { id: string; role: 'admin' | 'shop'; shopId?: string; name: string };

const url = Deno.env.get('SUPABASE_URL') || '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function clean(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function decodeClaims(token: string) {
  try {
    const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '='))) as { aal?: string };
  } catch {
    return {};
  }
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function getIdentity(request: Request): Promise<Identity> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!token) throw new Error('Sign in before opening support chat.');
  const { data: { user }, error: userError } = await db.auth.getUser(token);
  if (userError || !user) throw new Error('Your session has expired. Sign in again to use support chat.');

  const { data: admin, error: adminError } = await db.from('app_admins').select('user_id').eq('user_id', user.id).maybeSingle();
  if (adminError) throw adminError;
  if (admin) {
    if (decodeClaims(token).aal !== 'aal2') throw new Error('Complete administrator sign-in with your authenticator code first.');
    return { id: user.id, role: 'admin', name: user.email || 'Administrator' };
  }

  const { data: membership, error: membershipError } = await db
    .from('shop_memberships')
    .select('shop_id, username, active')
    .eq('user_id', user.id)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership?.active) throw new Error('An active shop login is required for support chat.');
  const { data: shop, error: shopError } = await db.from('shops').select('active').eq('id', membership.shop_id).maybeSingle();
  if (shopError) throw shopError;
  if (!shop?.active) throw new Error('An active shop login is required for support chat.');
  return { id: user.id, role: 'shop', shopId: membership.shop_id, name: membership.username };
}

async function requireAdmin(request: Request) {
  const identity = await getIdentity(request);
  if (identity.role !== 'admin') throw new Error('Administrator access is required.');
  return identity;
}

async function visitorConversation(id: string, token: string) {
  if (!id || !/^[a-f0-9]{64}$/i.test(token)) throw new Error('This support link is invalid. Start a new conversation.');
  const { data, error } = await db.from('support_conversations').select('*').eq('id', id).eq('visitor_token_hash', await sha256(token)).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('This support link is invalid or no longer available.');
  return data;
}

async function authorizedConversation(request: Request, body: Payload) {
  if (body.visitor_token) return { conversation: await visitorConversation(body.conversation_id || '', body.visitor_token), identity: null };
  const identity = await getIdentity(request);
  if (!body.conversation_id) throw new Error('Choose a conversation first.');
  const { data: conversation, error } = await db.from('support_conversations').select('*').eq('id', body.conversation_id).maybeSingle();
  if (error) throw error;
  if (!conversation) throw new Error('This conversation could not be found.');
  if (identity.role === 'shop' && (conversation.source !== 'shop' || conversation.shop_id !== identity.shopId)) {
    throw new Error('You can only open support conversations for your own shop.');
  }
  return { conversation, identity };
}

async function addMessage(conversationId: string, role: 'customer' | 'shop_user' | 'admin', senderId: string | null, senderName: string, body: string) {
  const text = clean(body, 4000);
  if (!text) throw new Error('Write a message before sending.');
  const { data: message, error } = await db.from('support_messages').insert({
    conversation_id: conversationId,
    sender_role: role,
    sender_user_id: senderId,
    sender_name: clean(senderName, 120) || (role === 'admin' ? 'Biller support' : 'Shop user'),
    body: text,
  }).select('id, conversation_id, sender_role, sender_user_id, sender_name, body, created_at').single();
  if (error) throw error;
  const { error: updateError } = await db.from('support_conversations').update({ last_message_at: message.created_at, updated_at: message.created_at }).eq('id', conversationId);
  if (updateError) throw updateError;
  return message;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 16_000) return json({ error: 'This support message is too large.' }, 413);
  try {
    const body = await request.json() as Payload;

    if (body.action === 'create_public_contact') {
      const name = clean(body.name, 120);
      const email = clean(body.email, 254).toLowerCase();
      const phone = clean(body.phone, 32);
      const location = clean(body.location, 160);
      const message = clean(body.message, 4000);
      if (name.length < 2) return json({ error: 'Enter your name.' }, 400);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Enter a valid email address.' }, 400);
      if (!/^[+\d][\d\s().-]{6,30}$/.test(phone)) return json({ error: 'Enter a valid phone number, including its country code if needed.' }, 400);
      if (location.length < 2) return json({ error: 'Enter your city or location.' }, 400);
      if (message.length < 4) return json({ error: 'Tell us briefly how we can help.' }, 400);
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: recentContacts, error: rateLimitError } = await db.from('support_conversations')
        .select('id', { count: 'exact', head: true }).eq('source', 'landing').eq('contact_email', email).gte('created_at', since);
      if (rateLimitError) throw rateLimitError;
      if ((recentContacts || 0) >= 5) return json({ error: 'This email has reached the daily contact limit. Please continue in your existing chat.' }, 429);

      const visitorToken = randomToken();
      const { data: conversation, error: createError } = await db.from('support_conversations').insert({
        source: 'landing', status: 'open', contact_name: name, contact_email: email, contact_phone: phone,
        location, visitor_token_hash: await sha256(visitorToken),
      }).select('id, source, status, contact_name, created_at, last_message_at').single();
      if (createError) throw createError;
      const messageRow = await addMessage(conversation.id, 'customer', null, name, message);
      return json({ conversation, visitor_token: visitorToken, messages: [messageRow] }, 201);
    }

    if (body.action === 'start_shop_conversation') {
      const identity = await getIdentity(request);
      if (identity.role !== 'shop' || !identity.shopId) throw new Error('Sign in with a shop login to open this chat.');
      const firstMessage = clean(body.message, 4000);
      if (firstMessage.length < 4) return json({ error: 'Write a short message so support knows what you need.' }, 400);
      const { data: conversation, error } = await db.from('support_conversations').insert({
        source: 'shop', status: 'open', contact_name: identity.name, shop_id: identity.shopId, opened_by: identity.id,
      }).select('id, source, status, contact_name, shop_id, created_at, last_message_at').single();
      if (error) throw error;
      const message = await addMessage(conversation.id, 'shop_user', identity.id, identity.name, firstMessage);
      return json({ conversation, messages: [message] }, 201);
    }

    if (body.action === 'list_shop_conversations') {
      const identity = await getIdentity(request);
      if (identity.role !== 'shop' || !identity.shopId) throw new Error('Sign in with a shop login to open support chat.');
      const { data, error } = await db.from('support_conversations').select('id, source, status, contact_name, shop_id, created_at, last_message_at')
        .eq('source', 'shop').eq('shop_id', identity.shopId).order('last_message_at', { ascending: false }).limit(30);
      if (error) throw error;
      return json({ conversations: data || [] });
    }

    if (body.action === 'list_admin_conversations') {
      await requireAdmin(request);
      const { data, error } = await db.from('support_conversations').select('id, source, status, contact_name, contact_email, contact_phone, location, shop_id, opened_by, created_at, last_message_at')
        .order('last_message_at', { ascending: false }).limit(200);
      if (error) throw error;
      return json({ conversations: data || [] });
    }

    if (body.action === 'list_messages') {
      const { conversation, identity } = await authorizedConversation(request, body);
      if (identity?.role === 'shop' && conversation.status !== 'open') {
        // Shop users can still read a closed thread for reference.
      }
      const { data, error } = await db.from('support_messages').select('id, conversation_id, sender_role, sender_user_id, sender_name, body, created_at')
        .eq('conversation_id', conversation.id).order('created_at', { ascending: true }).limit(500);
      if (error) throw error;
      return json({ conversation: { id: conversation.id, source: conversation.source, status: conversation.status }, messages: data || [] });
    }

    if (body.action === 'send_message') {
      const { conversation, identity } = await authorizedConversation(request, body);
      if (identity?.role !== 'admin' && conversation.status !== 'open') return json({ error: 'This conversation is closed. Start a new chat if you need more help.' }, 409);
      const role = identity?.role === 'admin' ? 'admin' : identity?.role === 'shop' ? 'shop_user' : 'customer';
      const name = identity?.name || conversation.contact_name;
      const message = await addMessage(conversation.id, role, identity?.id || null, name, body.message || '');
      return json({ message });
    }

    if (body.action === 'set_conversation_status') {
      await requireAdmin(request);
      if (!body.conversation_id || !['open', 'closed'].includes(body.status || '')) return json({ error: 'Choose a conversation and status.' }, 400);
      const { data, error } = await db.from('support_conversations').update({ status: body.status, updated_at: new Date().toISOString() })
        .eq('id', body.conversation_id).select('id, status').single();
      if (error) throw error;
      return json({ conversation: data });
    }

    return json({ error: 'Unknown support action.' }, 400);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      return json({ error: 'Support chat is temporarily unavailable. Please try again shortly.' }, 500);
    }
    const message = error instanceof Error ? error.message : 'Could not process the support request.';
    const status = /sign in|session has expired/i.test(message) ? 401 : /administrator|own shop|active shop login|authenticator/i.test(message) ? 403 : 400;
    return json({ error: message }, status);
  }
});
