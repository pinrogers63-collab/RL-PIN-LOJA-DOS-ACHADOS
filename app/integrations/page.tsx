"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type Check = { id:string; label:string; ready:boolean; kind?:string; note?:string };
type Custom = { id:string; name:string; slug:string; status:string; notes?:string|null };

export default function IntegrationsPage(){
  const [checks,setChecks]=useState<Check[]>([]);
  const [custom,setCustom]=useState<Custom[]>([]);
  const [name,setName]=useState("");
  const [msg,setMsg]=useState("");

  async function load(){
    const supabase=getSupabaseBrowser();
    const {data}=await supabase.auth.getSession();
    if(!data.session){window.location.href="/login";return;}
    const [r,c]=await Promise.all([
      fetch("/api/readiness",{cache:"no-store"}),
      supabase.from("custom_integrations").select("id,name,slug,status,notes").order("created_at")
    ]);
    if(r.ok){
      const d=await r.json();
      setChecks((d.checks??[]).filter((x:Check)=>x.kind==="marketplace"||x.kind==="distribution"));
    }
    if(c.error) setMsg(c.error.message); else setCustom((c.data??[]) as Custom[]);
  }

  useEffect(()=>{void load();},[]);

  async function add(){
    const clean=name.trim();
    if(!clean) return;
    const slug=clean.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
    const supabase=getSupabaseBrowser();
    const {error}=await supabase.from("custom_integrations").insert({name:clean,slug,status:"PLANEJADO",notes:"Aguardando definição da API/autorização oficial."});
    if(error){setMsg(error.message);return;}
    setName(""); setMsg("Nova plataforma adicionada à área de integrações."); await load();
  }

  return <main className="shell">
    <header className="topbar">
      <div><p className="eyebrow">RL PIN • INTEGRAÇÕES</p><h1>Central de <span>Plataformas</span></h1><p className="sub">Conecte marketplaces e canais sem reconstruir a esteira.</p></div>
      <a className="secondary linkBtn backBtn" href="/">← Voltar ao painel</a>
    </header>
    {msg&&<div className="notice">{msg}</div>}

    <section className="card panel">
      <div className="panelTitle"><div><p className="eyebrow">PLATAFORMAS PRINCIPAIS</p><h2>Conectores</h2></div><span className="badge">arquitetura plugável</span></div>
      <div className="platforms">
        {checks.map(x=><div className="platform" key={x.id}>
          <div><strong>{x.label}</strong><small>{x.note}</small></div>
          <div className="platformRight">
            <span className="status">{x.ready?"CONECTADO":"AGUARDANDO"}</span>
            {x.id==="mercado_livre"&&!x.ready&&<a className="primary linkBtn" href="/api/integrations/mercadolivre/start">Conectar</a>}
          </div>
        </div>)}
      </div>
    </section>

    <section className="card panel">
      <div className="panelTitle"><div><p className="eyebrow">EXPANSÃO</p><h2>Adicionar outra plataforma</h2></div><span className="badge">sem refazer o painel</span></div>
      <p className="sub">Cadastre aqui um novo marketplace/canal. Ele entra como planejado até configurarmos a API e a autorização oficial.</p>
      <div className="productForm">
        <input placeholder="Nome da nova plataforma" value={name} onChange={e=>setName(e.target.value)} />
        <button className="primary" type="button" onClick={add}>+ Adicionar plataforma</button>
      </div>
      <div className="platforms">
        {custom.map(x=><div className="platform" key={x.id}><div><strong>{x.name}</strong><small>{x.notes??"Conector adicional"}</small></div><span className="status">{x.status}</span></div>)}
        {!custom.length&&<p className="empty">Nenhuma plataforma adicional cadastrada.</p>}
      </div>
    </section>
  </main>;
}
