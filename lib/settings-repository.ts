import { getSupabaseBrowser } from "./supabase-browser";

export type AppSettings = {
  id?: string;
  min_product_score: number;
  target_margin_percentage: number;
  min_supplier_tests: number;
  max_dispatch_hours: number;
  max_policy_risk: number;
  auto_homologate_supplier: boolean;
  default_currency: string;
  timezone: string;
  daily_report_enabled: boolean;
};

export async function getSettings(): Promise<AppSettings> {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (data) return data as AppSettings;

  const defaults: AppSettings = {
    min_product_score: 75,
    target_margin_percentage: 30,
    min_supplier_tests: 3,
    max_dispatch_hours: 48,
    max_policy_risk: 59,
    auto_homologate_supplier: true,
    default_currency: "BRL",
    timezone: "America/Sao_Paulo",
    daily_report_enabled: true
  };

  const { data: created, error: createError } = await supabase
    .from("app_settings")
    .insert(defaults)
    .select()
    .single();

  if (createError) throw createError;
  return created as AppSettings;
}

export async function saveSettings(settings: AppSettings) {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from("app_settings")
    .upsert(settings)
    .select()
    .single();

  if (error) throw error;
  return data as AppSettings;
}
