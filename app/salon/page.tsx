"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { createSalonJob, listSalonEligibleProducts, listSalonJobs } from "@/lib/salon-repository";
import { salonConcepts } from "@/lib/salon";
import { buildSalonBrief } from "@/lib/salon-brief";

type ProductRow={id:string;title:string;platform:string;score:number;category:string|null;status:string};
type JobRow={id:string;status:string;selected_concept:string;victory_wardrobe:string;channels:string[];created_at:string;products?:{title?:string}};

export default function SalonPage(){
  const [products,setProducts]=useState<ProductRow[]>([]);
  const [jobs,setJobs]=useState<JobRow[]>([]);
  const [msg,setMsg]=useState("");
  const [brief,setBrief]=useState<any|null>(null);

  async function refresh(){
    const [p,j]=await Promise.all([listSalonEligibleProducts(),listSalonJobs()]);
    setProducts(p as ProductRow[]);
    setJobs(j as JobRow[]);
  }

  useEffect(()=>{(async()=>{
    try{
      const supabase=getSupabaseBrowser();
      const {data}=await supabase.auth.getSession();
      if(!data.session){window.location.href="/login";return;}
      await refresh();
    }catch(e){setMsg(e instanceof Error?e.message:"Falha ao abrir o Salão.");}
  })();},[]);

  function previewBrief(p:ProductRow){
    setBrief(buildSalonBrief({
      title:p.title,
      category:p.category ?? undefined,
      platform:p.platform
    }));
  }

  async function prepare(p:ProductRow){
    try{
      await createSalonJob(p);
      setMsg("Produto entrou no Salão. Briefing das 4 versões preparado.");
      await refresh();
    }catch(e){setMsg(e instanceof Error?e.message:"Falha ao preparar Salão.");}
  }

  return <main className="shell">
    <header className="topbar">
      <div><p className="eyebrow">RL PIN • SALÃO DA VITÓRIA</p><h1>Criação <span>Premium</span></h1><p className="sub">Quatro conceitos, formatos por canal e figurino da Vitória.</p></div>
      <a className="secondary linkBtn backBtn" href="/">← Voltar ao painel</a>
    </header>
    {msg&&<div className="notice">{msg}</div>}

    <section className="grid2">
      <article className="card panel">
        <div className="panelTitle"><div><p className="eyebrow">CONCEITOS</p><h2>4 versões padrão</h2></div><span className="badge">fidelidade ao produto</span></div>
        <div className="conceptGrid">{salonConcepts.map(c=><div className="conceptCard" key={c.id}><strong>{c.name}</strong><p>{c.goal}</p></div>)}</div>
      </article>

      <article className="card panel">
        <div className="panelTitle"><div><p className="eyebrow">FILA</p><h2>Produtos elegíveis</h2></div><span className="badge">{products.length} itens</span></div>
        <div className="platforms">{products.map(p=><div className="platform" key={p.id}><div><strong>{p.title}</strong><small>{p.platform} • score {p.score} • {p.status}</small></div><div className="actions"><button onClick={()=>previewBrief(p)}>Ver briefing</button><button className="primary" onClick={()=>prepare(p)}>Preparar</button></div></div>)}
        {!products.length&&<p className="empty">Aprove um produto para enviá-lo ao Salão.</p>}</div>
      </article>
    </section>

    {brief&&<section className="card panel">
      <div className="panelTitle"><div><p className="eyebrow">BRIEFING INTERNO</p><h2>{brief.product}</h2></div><button className="secondary" onClick={()=>setBrief(null)}>Fechar</button></div>
      <div className="conceptGrid">{brief.concepts.map((c:any)=><div className="conceptCard" key={c.id}><strong>{c.title}</strong><p>{c.prompt}</p></div>)}</div>
      <div className="copyBox"><strong>{brief.copy.headline}</strong><p>{brief.copy.body}</p><small>{brief.copy.cta}</small></div>
    </section>}

    <section className="card panel">
      <div className="panelTitle"><div><p className="eyebrow">JOBS DO SALÃO</p><h2>Produção preparada</h2></div><span className="badge">{jobs.length} jobs</span></div>
      <div className="tableWrap"><table><thead><tr><th>Produto</th><th>Status</th><th>Conceito</th><th>Vitória</th><th>Canais</th><th>Criado</th></tr></thead><tbody>{jobs.map(j=><tr key={j.id}><td>{j.products?.title??"-"}</td><td><span className="status">{j.status}</span></td><td>{j.selected_concept}</td><td>{j.victory_wardrobe}</td><td>{j.channels.join(", ")}</td><td>{new Date(j.created_at).toLocaleString("pt-BR")}</td></tr>)}</tbody></table></div>
      <p className="sub salonNote">A geração real de imagens/vídeo permanece bloqueada até conectarmos um provedor de IA; o sistema não marca como “gerado” algo que ainda não foi produzido.</p>
    </section>
  </main>;
}
