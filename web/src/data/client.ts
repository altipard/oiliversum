import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type ClientResult = { ok: true; client: SupabaseClient } | { ok: false; missing: string[] };

/** Read-only anon client; reports missing configuration instead of throwing. */
export function createReadClient(): ClientResult {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const missing: string[] = [];
  if (!url) missing.push('VITE_SUPABASE_URL');
  if (!key) missing.push('VITE_SUPABASE_ANON_KEY');
  if (!url || !key) return { ok: false, missing };
  return {
    ok: true,
    client: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
  };
}
