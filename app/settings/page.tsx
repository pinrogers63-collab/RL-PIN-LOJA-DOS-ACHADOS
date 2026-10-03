"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { getSettings, saveSettings } from "@/lib/settings-repository";

export default function SettingsPage(){
  const [s,setS]=useState<any|null>(null);
  const [msg,setMsg]=useState("");

  useEffect(()=>{(async()=>{
    try{
      const supabase=getSupabaseBrowser();
      const {data}=await supabase.auth.getSession();
      if(!data.session){window.location.href="/login";return;}
      setS(await getSettings());
    }catch(e){setMsg(e instanceof Error?e.message:"Falha ao abrir configurações.");}
  })();},[]);

  async function save(){
    try{
      setS(await saveSettings(s));
      setMsg("Configurações salvas.");
    }catch(e){setMsg(e instanceof Error?e.message:"Falha ao salvar.");}
  }

  if(!s) return <main className="shell"><section className="card panel"><p>Carregando configurações...</p></section></main>;

  return <main className="shell">
    <header className="topbar">
      <div><p className="eyebrow">RL PIN • CONFIGURAÇÕES</p><h1>Regras <span>Centrais</span></h1><p className="sub">Os limites que controlam score, margem, fornecedor e risco.</p></div>
      <a className="secondary linkBtn backBtn" href="/">← Voltar ao painel</a>
    </header>
    {msg&&<div className="notice">{msg}</div>}
    <section className="card panel">
      <div className="settingsGrid">
        <label>Score mínimo<input type="number" value={s.min_product_score} onChange={e=>setS({...s,min_product_score:Number(e.target.value)})}/></label>
        <label>Margem alvo %<input type="number" value={s.target_margin_percentage} onChange={e=>setS({...s,target_margin_percentage:Number(e.target.value)})}/></label>
        <label>Testes mínimos fornecedor<input type="number" value={s.min_supplier_tests} onChange={e=>setS({...s,min_supplier_tests:Number(e.target.value)})}/></label>
        <label>Despacho máximo (h)<input type="number" value={s.max_dispatch_hours} onChange={e=>setS({...s,max_dispatch_hours:Number(e.target.value)})}/></label>
        <label>Risco política máximo<input type="number" value={s.max_policy_risk} onChange={e=>setS({...s,max_policy_risk:Number(e.target.value)})}/></label>
        <label>Moeda<input value={s.default_currency} onChange={e=>setS({...s,default_currency:e.target.value})}/></label>
        <label>Fuso horário<input value={s.timezone} onChange={e=>setS({...s,timezone:e.target.value})}/></label>
        <label className="checkLabel"><input type="checkbox" checked={s.auto_homologate_supplier} onChange={e=>setS({...s,auto_homologate_supplier:e.target.checked})}/> Homologar automaticamente quando cumprir os testes</label>
        <label className="checkLabel"><input type="checkbox" checked={s.daily_report_enabled} onChange={e=>setS({...s,daily_report_enabled:e.target.checked})}/> Gerar relatório diário</label>
      </div>
      <button className="primary settingsSave" onClick={save}>Salvar regras</button>
    </section>
  </main>;
}
