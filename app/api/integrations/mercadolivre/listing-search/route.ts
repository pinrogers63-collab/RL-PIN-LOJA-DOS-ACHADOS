import { createClient } from "@supabase/supabase-js";
import { getValidMercadoLivreToken, mercadoLivreGet } from "@/lib/mercadolivre";

type Listing={id?:string;title?:string;price?:number;currency_id?:string;permalink?:string;available_quantity?:number;category_id?:string;condition?:string};
type SearchResponse={results?:Listing[];paging?:{total?:number}};

export async function GET(request:Request){
  const bearer=request.headers.get("authorization");
  const userToken=bearer?.startsWith("Bearer ")?bearer.slice(7):"";
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!userToken || !url || !key) return Response.json({ok:false,error:"Sessão necessária."},{status:401});
  const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:auth,error:authError}=await supabase.auth.getUser(userToken);
  if(authError || !auth.user) return Response.json({ok:false,error:"Sessão inválida."},{status:401});

  const keyword=new URL(request.url).searchParams.get("q")?.trim()??"";
  if(keyword.length<3 || keyword.length>100) return Response.json({ok:false,error:"Digite de 3 a 100 caracteres."},{status:400});
  try{
    const token=await getValidMercadoLivreToken();
    const data=await mercadoLivreGet<SearchResponse>(`/sites/MLB/search?q=${encodeURIComponent(keyword)}&limit=5`,token);
    const results=(data.results??[]).slice(0,5).filter(x=>x.id&&x.title).map(x=>({
      id:String(x.id).slice(0,40),title:String(x.title).slice(0,250),
      price:typeof x.price==="number"?x.price:null,
      currency:x.currency_id??"BRL",
      url:typeof x.permalink==="string" && /^https:\/\/(www\.)?mercadolivre\.com\.br\//i.test(x.permalink)?x.permalink:null,
      stock:typeof x.available_quantity==="number"?x.available_quantity:null,
      category:x.category_id??null,condition:x.condition??null
    }));
    return Response.json({ok:true,keyword,kind:"marketplace_listings_not_verified_suppliers",
      note:"Preço e estoque são anúncios de terceiros, não custo de fornecedor nem garantia de revenda.",
      results,total:data.paging?.total??null},{headers:{"cache-control":"no-store"}});
  }catch(e){
    return Response.json({ok:false,error:e instanceof Error?e.message:"Falha ao consultar catálogo."},{status:502});
  }
}
