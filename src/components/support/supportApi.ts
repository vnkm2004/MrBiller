import { requireSupabase } from '../../lib/supabase';

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export async function supportCall<T = Record<string, unknown>>(action: string, payload: Record<string, unknown> = {}) {
  const attempts = action.startsWith('list_') ? 3 : 1;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const { data, error } = await requireSupabase().functions.invoke('support-chat', { body: { action, ...payload } });
    if (error) {
      const details = error as { context?: unknown; name?: string };
      const response = details.context instanceof Response ? details.context : null;
      const transient = response ? response.status >= 500 : details.name === 'FunctionsFetchError';
      if (transient && attempt < attempts - 1) {
        await wait(300 * (attempt + 1));
        continue;
      }
      if (response) {
        const body = await response.clone().json().catch(() => null) as { error?: unknown } | null;
        if (typeof body?.error === 'string') throw new Error(body.error);
        if (response.status >= 500) throw new Error('Support is temporarily unavailable. Please try again in a moment.');
      }
      throw error;
    }
    if (data?.error) throw new Error(data.error);
    return data as T;
  }
  throw new Error('Support is temporarily unavailable. Please try again in a moment.');
}

export type SupportMessage = {
  id: string;
  conversation_id: string;
  sender_role: 'customer' | 'shop_user' | 'admin';
  sender_user_id: string | null;
  sender_name: string;
  body: string;
  created_at: string;
};

export type SupportConversation = {
  id: string;
  source: 'landing' | 'shop';
  status: 'open' | 'closed';
  contact_name: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  location?: string | null;
  shop_id?: string | null;
  shop_name?: string | null;
  created_at: string;
  last_message_at: string;
};
