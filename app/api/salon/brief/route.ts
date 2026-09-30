import { buildSalonBrief } from "@/lib/salon-brief";

export async function POST(request: Request) {
  const body = await request.json();
  if(!body?.title) return Response.json({ok:false,error:"title obrigatório"},{status:400});
  return Response.json({
    ok:true,
    brief:buildSalonBrief({
      title:String(body.title),
      category:body.category?String(body.category):undefined,
      platform:String(body.platform??""),
      marketPrice:body.marketPrice!=null?Number(body.marketPrice):undefined
    })
  });
}
