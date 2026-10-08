"use client";

import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.href = "/";
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      setMessage(raw === "Failed to fetch" ? "Banco temporariamente indisponível. Aguarde alguns instantes e tente novamente." : raw || "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

  async function signUp() {
    setBusy(true);
    setMessage("");
    try {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      setMessage("Cadastro criado. Confirme o e-mail se o Supabase solicitar confirmação.");
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      setMessage(raw === "Failed to fetch" ? "Banco temporariamente indisponível. Aguarde alguns instantes e tente novamente." : raw || "Não foi possível criar a conta.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="loginShell">
      <section className="card loginCard">
        <p className="eyebrow">RL PIN • ACESSO SEGURO</p>
        <h1>Entrar na <span>V5 Premium</span></h1>
        <p className="sub">Acesso ao banco real da Loja dos Achados.</p>
        <form onSubmit={signIn} className="loginForm">
          <input type="email" required placeholder="Seu e-mail" value={email} onChange={(e)=>setEmail(e.target.value)} />
          <input type="password" required minLength={6} placeholder="Sua senha" value={password} onChange={(e)=>setPassword(e.target.value)} />
          <button className="primary" disabled={busy} type="submit">{busy ? "Aguarde..." : "Entrar"}</button>
        </form>
        <button className="secondary full" disabled={busy} onClick={signUp}>Criar primeiro acesso</button>
        {message && <p className="loginMessage">{message}</p>}
      </section>
    </main>
  );
}
