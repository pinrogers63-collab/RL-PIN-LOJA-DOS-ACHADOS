import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase com service_role — SOMENTE server-side (API routes, crons).
 * A service_role ignora o RLS; nunca exponha essa chave ao client (sem prefixo NEXT_PUBLIC_).
 */
let serviceClient: any = null;

export function getSupabaseServiceRole(): any {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Armazenamento seguro indisponível. Configure SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente do servidor."
    );
  }

  if (!serviceClient) {
    serviceClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }

  return serviceClient;
}
