import { getSupabaseBrowser } from "./supabase-browser";

export async function listConnectorRuns(limit = 50) {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from("connector_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function createConnectorRun(input: {
  connectorId: string;
  runType: "COLLECT" | "REFRESH" | "PUBLISH";
  status?: "PENDING" | "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED" | "SKIPPED";
  metadata?: Record<string, unknown>;
}) {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from("connector_runs")
    .insert({
      connector_id: input.connectorId,
      run_type: input.runType,
      status: input.status ?? "PENDING",
      metadata: input.metadata ?? {}
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
