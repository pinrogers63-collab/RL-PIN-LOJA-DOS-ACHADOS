import { getSupabaseBrowser } from "./supabase-browser";

export async function getSystemHealth() {
  const supabase = getSupabaseBrowser();

  const [
    products,
    suppliers,
    queue,
    salon,
    connectors,
    runs
  ] = await Promise.all([
    supabase.from("products").select("*", { count:"exact", head:true }),
    supabase.from("suppliers").select("*", { count:"exact", head:true }),
    supabase.from("publish_queue").select("status"),
    supabase.from("salon_jobs").select("status"),
    supabase.from("connectors").select("id,name,connected,last_success_at,last_error_at,last_error"),
    supabase.from("connector_runs").select("status,created_at").order("created_at",{ascending:false}).limit(20)
  ]);

  const errors = [products.error,suppliers.error,queue.error,salon.error,connectors.error,runs.error].filter(Boolean);
  if (errors.length) throw errors[0];

  return {
    database: "ONLINE",
    products: products.count ?? 0,
    suppliers: suppliers.count ?? 0,
    publishReady: queue.data?.filter(q=>q.status==="PRONTO").length ?? 0,
    publishBlocked: queue.data?.filter(q=>q.status==="BLOQUEADO").length ?? 0,
    salonPending: salon.data?.filter(j=>j.status==="PLANEJADO" || j.status==="GERANDO").length ?? 0,
    connectors: connectors.data ?? [],
    recentFailedRuns: runs.data?.filter(r=>r.status==="FAILED").length ?? 0,
    recentRuns: runs.data ?? []
  };
}
