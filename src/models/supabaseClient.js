import { createClient } from '@supabase/supabase-js';

// Requests stay user-scoped so Supabase RLS policies continue to apply.
export function supabaseForUser(accessToken) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Thiếu SUPABASE_URL hoặc SUPABASE_PUBLISHABLE_KEY trong môi trường chạy.');
  }
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined
  });
}
