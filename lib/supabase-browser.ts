import { createClient } from "@supabase/supabase-js";

let client: any = null;

// Publishable Supabase values are safe in browser code.
// Environment variables still override these defaults when configured.
const DEFAULT_SUPABASE_URL = "https://ebmojzknksggxnhvuimq.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Xe64aFRSrHyimYivwrbjXQ_TOUC4ADz";

export function getSupabaseBrowser(): any {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_PUBLISHABLE_KEY;

  if (!client) {
    client = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }

  return client;
}
