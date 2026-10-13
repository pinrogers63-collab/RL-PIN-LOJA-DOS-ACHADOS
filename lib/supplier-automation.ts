import { getSupabaseBrowser } from "./supabase-browser";

export async function registerSupplierTest(id: string, passed: boolean) {
  const supabase = getSupabaseBrowser();
  const { data: supplier, error } = await supabase
    .from("suppliers").select("*").eq("id", id).single();

  if (error) throw error;
  if (supplier.status === "BLOQUEADO") throw new Error("Fornecedor bloqueado.");

  const testedOrders = Number(supplier.tested_orders ?? 0) + 1;
  const passedTests = Number(supplier.passed_tests ?? 0) + (passed ? 1 : 0);
  const failedTests = Number(supplier.failed_tests ?? 0) + (passed ? 0 : 1);

  // A supplier never becomes approved just by clicking test buttons.
  // Financial, contractual, fiscal and delivery checks need separate verification.
  const { data, error: updateError } = await supabase
    .from("suppliers")
    .update({
      tested_orders: testedOrders,
      passed_tests: passedTests,
      failed_tests: failedTests,
      status: "EM_TESTE"
    })
    .eq("id", id)
    .select()
    .single();

  if (updateError) throw updateError;
  return data;
}
