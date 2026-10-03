"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { listFeeProfiles, upsertFeeProfile } from "@/lib/fee-profile-repository";
import { calculateProfit } from "@/lib/calculator";

type Platform="shopee"|"mercado_livre"|"tiktok"|"pinterest";

export default function FeesPage(){
  const [profiles,setProfiles]=useState<any[]>([]);
  const [msg,setMsg]=useState("");
  const [preview,setPreview]=useState<any|null>(null);
  const [form,setForm]=useState({
    platform:"shopee" as Platform,
    name:"Perfil principal",
    percentageFee:"0",
    fixedFee:"0",
    shippingEstimate:"0",
    reservePercentage:"0",
    adsPercentage:"0",
    notes:"",
    productCost:"40",
    salePrice:"90"
  });

  async function refresh(){ setProfiles(await listFeeProfiles()); }

  useEffect(()=>{(async()=>{
    try{
      const supabase=getSupabaseBrowser();
      const {data}=await supabase.auth.getSession();
      if(!data.session){window.location.href="/login";return;}
      await refresh();
    }catch(e){setMsg(e instanceof Error?e.message:"Falha ao carregar perfis.");}
  })();},[]);

  async function save(e:React.FormEvent){
    e.preventDefault();setMsg("");
    try{
      await upsertFeeProfile({
        platform:form.platform,
        name:form.name,
        percentageFee:Number(form.percentageFee||0),
        fixedFee:Number(form.fixedFee||0),
        shippingEstimate:Number(form.shippingEstimate||0),
        reservePercentage:Number(form.reservePercentage||0),
        adsPercentage:Number(form.adsPercentage||0),
        notes:form.notes
      });
      await refresh();
      setMsg("Perfil salvo. Os valores continuam editáveis quando as taxas oficiais mudarem.");
    }catch(e){setMsg(e instanceof Error?e.message:"Falha ao salvar perfil.");}
  }

  function simulate(){
    setPreview(calculateProfit(
      Number(form.productCost||0),
      Number(form.salePrice||0),
      {
        percentageFee:Number(form.percentageFee||0),
        fixedFee:Number(form.fixedFee||0),
        estimatedShipping:Number(form.shippingEstimate||0),
        reservePercentage:Number(form.reservePercentage||0),
        estimatedAdsPercentage:Number(form.adsPercentage||0)
      }
    ));
  }

  return <main className="shell">
    <header className="topbar">
      <div><p className="eyebrow">RL PIN • TAXAS & MARGEM</p><h1>Perfis <span>Configuráveis</span></h1><p className="sub">Sem taxas engessadas: você atualiza quando cada marketplace mudar.</p></div>
      <a className="secondary linkBtn backBtn" href="/">← Voltar ao painel</a>
    </header>
    {msg&&<div className="notice">{msg}</div>}

    <section className="grid2">
      <article className="card panel">
        <div className="panelTitle"><div><p className="eyebrow">PERFIL</p><h2>Configurar taxas</h2></div><span className="badge">editável</span></div>
        <form className="feeForm" onSubmit={save}>
          <select value={form.platform} onChange={e=>setForm({...form,platform:e.target.value as Platform})}>
            <option value="shopee">Shopee</option><option value="mercado_livre">Mercado Livre</option><option value="tiktok">TikTok Shop</option><option value="pinterest">Pinterest</option>
          </select>
          <input placeholder="Nome do perfil" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
          <input placeholder="% taxa marketplace" inputMode="decimal" value={form.percentageFee} onChange={e=>setForm({...form,percentageFee:e.target.value})}/>
          <input placeholder="Taxa fixa R$" inputMode="decimal" value={form.fixedFee} onChange={e=>setForm({...form,fixedFee:e.target.value})}/>
          <input placeholder="Frete estimado R$" inputMode="decimal" value={form.shippingEstimate} onChange={e=>setForm({...form,shippingEstimate:e.target.value})}/>
          <input placeholder="% reserva" inputMode="decimal" value={form.reservePercentage} onChange={e=>setForm({...form,reservePercentage:e.target.value})}/>
          <input placeholder="% anúncios" inputMode="decimal" value={form.adsPercentage} onChange={e=>setForm({...form,adsPercentage:e.target.value})}/>
          <input placeholder="Observações" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/>
          <button className="primary" type="submit">Salvar perfil</button>
        </form>
      </article>

      <article className="card panel">
        <div className="panelTitle"><div><p className="eyebrow">SIMULADOR</p><h2>Teste rápido de margem</h2></div><span className="badge">usa o perfil acima</span></div>
        <div className="feeForm">
          <input placeholder="Custo do produto" inputMode="decimal" value={form.productCost} onChange={e=>setForm({...form,productCost:e.target.value})}/>
          <input placeholder="Preço de venda" inputMode="decimal" value={form.salePrice} onChange={e=>setForm({...form,salePrice:e.target.value})}/>
          <button className="primary" type="button" onClick={simulate}>Calcular</button>
        </div>
        {preview&&<div className="resultGrid">
          <div><span>Lucro</span><strong>R$ {preview.profit.toFixed(2)}</strong></div>
          <div><span>Margem</span><strong>{preview.marginPercentage.toFixed(1)}%</strong></div>
          <div><span>Preço mínimo</span><strong>R$ {preview.minimumPrice.toFixed(2)}</strong></div>
          <div><span>Sugerido</span><strong>R$ {preview.suggestedPrice.toFixed(2)}</strong></div>
          <div><span>Veredito</span><strong>{preview.verdict}</strong></div>
        </div>}
      </article>
    </section>

    <section className="card panel">
      <div className="panelTitle"><div><p className="eyebrow">ATIVOS</p><h2>Perfis salvos</h2></div><span className="badge">{profiles.length} perfis</span></div>
      <div className="tableWrap"><table><thead><tr><th>Plataforma</th><th>Nome</th><th>% taxa</th><th>Fixa</th><th>Frete</th><th>Reserva</th><th>Anúncios</th></tr></thead><tbody>
      {profiles.map(p=><tr key={p.id}><td>{p.platform}</td><td>{p.name}</td><td>{p.percentage_fee}%</td><td>R$ {Number(p.fixed_fee).toFixed(2)}</td><td>R$ {Number(p.shipping_estimate).toFixed(2)}</td><td>{p.reserve_percentage}%</td><td>{p.ads_percentage}%</td></tr>)}
      </tbody></table></div>
    </section>
  </main>;
}
