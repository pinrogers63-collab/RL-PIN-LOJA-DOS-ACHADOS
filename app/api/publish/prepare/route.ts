import { createClient } from "@supabase/supabase-js";
import { runGuardian } from "@/lib/guardian";
import type { Product } from "@/lib/types";

export async function POST(request: Request) {
  const bearer = request.headers.get("authorization");
  const accessToken = bearer?.startsWith("Bearer ") ? bearer.slice(7) : "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!accessToken || !url || !key) return Response.json({ok:false,error:"Sessão necessária."},{status:401});
  const supabase = createClient(url,key,{
    global:{headers:{Authorization:`Bearer ${accessToken}`}},
    auth:{persistSession:false,autoRefreshToken:false}
  });
  const {data:auth,error:authError}=await supabase.auth.getUser(accessToken);
  if(authError || !auth.user) return Response.json({ok:false,error:"Sessão inválida."},{status:401});

  try {
    const body = await request.json();
    if(typeof body?.productId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.productId))
      return Response.json({ok:false,error:"ID de produto inválido."},{status:400});

    const {data:row,error:productError}=await supabase.from("products")
      .select("*,suppliers(status,dispatch_hours,invoice,invoice_mode,tracking,ships_directly)")
      .eq("id",body.productId).single();
    if(productError || !row) return Response.json({ok:false,error:"Produto não encontrado."},{status:404});

    const product:Product = {
      id:row.id,title:row.title,platform:row.platform,externalId:row.external_id??undefined,
      sourceUrl:row.source_url??undefined,sku:row.sku??undefined,
      cost:Number(row.cost),marketPrice:Number(row.market_price),stock:Number(row.stock),
      score:Number(row.score),status:row.status,supplierId:row.supplier_id??undefined,
      updatedAt:row.updated_at
    };
    const guard=runGuardian({
      ...product,
      category:row.category??undefined,
      supplierStatus:row.suppliers?.status??undefined,
      supplierDispatchHours:row.suppliers?.dispatch_hours??undefined,
      hasInvoice:row.suppliers?.invoice??undefined,
      invoiceMode:row.suppliers?.invoice_mode??undefined,
      hasTracking:row.suppliers?.tracking??undefined,
      shipsDirectly:row.suppliers?.ships_directly??undefined,
      restrictedCategory:Boolean(row.metadata?.restrictedCategory),
      policyRisk:Number(row.metadata?.policyRisk??0)
    });
    const status=guard.approved?"PRONTO":"BLOQUEADO";
    const {data:queue,error:queueError}=await supabase.from("publish_queue").upsert({
      product_id:row.id,platform:row.platform,status,guard_result:guard,owner_id:auth.user.id
    },{onConflict:"product_id,platform"}).select().single();
    if(queueError) throw queueError;
    return Response.json({ok:true,guard,queue,note:"Somente preparação interna; nenhum anúncio é publicado automaticamente."});
  } catch(error) {
    return Response.json({ok:false,error:error instanceof Error?error.message:"Falha na análise."},{status:500});
  }
}
