import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && publishableKey);

export const supabase = supabaseUrl && publishableKey
  ? createClient(supabaseUrl, publishableKey, {
      global: {
        fetch: (input, init) => fetch(input, {
          ...init,
          ...(init?.method?.toUpperCase() === 'GET' ? { cache: 'no-store' as const } : {}),
        }),
      },
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
  }
  return supabase;
}
