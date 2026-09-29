type Metric = { label: string; value: number; hint: string };
type Platform = { name: string; count: number; status: "online" | "pending"; next: string };
type Product = { title: string; platform: string; price: string; margin: string; score: number; status: string };

const metrics: Metric[] = [
  { label: "Encontrados hoje", value: 87, hint: "garimpo principal 06:00" },
  { label: "Válidos", value: 61, hint: "passaram no Guardião RL" },
  { label: "No Salão", value: 6, hint: "aguardando criação premium" },
  { label: "Prontos p/ publicar", value: 4, hint: "revisão final pendente" }
];

const platforms: Platform[] = [
  { name: "Shopee", count: 34, status: "pending", next: "06:00" },
  { name: "Mercado Livre", count: 27, status: "pending", next: "06:05" },
  { name: "TikTok Shop", count: 26, status: "pending", next: "06:12" },
  { name: "Pinterest", count: 0, status: "pending", next: "Distribuição" }
];

const products: Product[] = [
  { title: "Kit premium de utensílios de cozinha", platform: "Shopee", price: "R$ 89,90", margin: "34%", score: 92, status: "SALÃO" },
  { title: "Luminária decorativa touch", platform: "Mercado Livre", price: "R$ 79,90", margin: "31%", score: 88, status: "APROVADO" },
  { title: "Organizador modular para cozinha", platform: "TikTok Shop", price: "R$ 59,90", margin: "28%", score: 84, status: "OBSERVAR" }
];

export default function Home() {
  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">RL PIN • CENTRAL DE OPERAÇÕES</p>
          <h1>Loja dos Achados <span>V5 Premium</span></h1>
          <p className="sub">Garimpo → Guardião → Margem → Salão → Vitória → Publicação</p>
        </div>
        <div className="sync">
          <span className="dot" />
          <div>
            <strong>Sistema em preparação</strong>
            <small>Próxima coleta planejada: 06:00 BRT</small>
          </div>
        </div>
      </header>

      <section className="metrics">
        {metrics.map((m) => (
          <article className="card metric" key={m.label}>
            <small>{m.label}</small>
            <strong>{m.value}</strong>
            <span>{m.hint}</span>
          </article>
        ))}
      </section>

      <section className="grid2">
        <article className="card panel">
          <div className="panelTitle">
            <div>
              <p className="eyebrow">FONTES</p>
              <h2>Plataformas</h2>
            </div>
            <span className="badge">06h • 10h • 15h</span>
          </div>
          <div className="platforms">
            {platforms.map((p) => (
              <div className="platform" key={p.name}>
                <div>
                  <strong>{p.name}</strong>
                  <small>Próxima: {p.next}</small>
                </div>
                <div className="platformRight">
                  <b>{p.count}</b>
                  <span>{p.status === "online" ? "conectado" : "não conectado"}</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="card panel hero">
          <p className="eyebrow">PRODUTO CAMPEÃO DO DIA</p>
          <h2>Seleção inteligente com explicação</h2>
          <p>
            O sistema destacará os produtos com melhor combinação de margem, tendência,
            concorrência, estoque e confiabilidade do fornecedor — sem publicar nada sozinho.
          </p>
          <div className="heroScore">
            <div><span>Score</span><strong>92</strong></div>
            <div><span>Margem</span><strong>34%</strong></div>
            <div><span>Status</span><strong>Bom momento</strong></div>
          </div>
          <button className="primary">Abrir no Salão</button>
        </article>
      </section>

      <section className="card panel">
        <div className="panelTitle">
          <div>
            <p className="eyebrow">ESTEIRA</p>
            <h2>Produtos em análise</h2>
          </div>
          <button className="secondary">+ Importar produto</button>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Produto</th><th>Origem</th><th>Preço</th><th>Margem</th><th>Score</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.title}>
                  <td>{p.title}</td><td>{p.platform}</td><td>{p.price}</td><td>{p.margin}</td><td>{p.score}</td>
                  <td><span className="status">{p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid3">
        <article className="card mini">
          <p className="eyebrow">GUARDIÃO RL</p>
          <h3>Conformidade antes do Salão</h3>
          <p>Marca, restrições, estoque, prazo, política e fornecedor.</p>
          <button className="secondary">Abrir Guardião</button>
        </article>
        <article className="card mini">
          <p className="eyebrow">CALCULADORA</p>
          <h3>Preço e lucro automático</h3>
          <p>Taxas, custo, frete, reserva, lucro e preço recomendado.</p>
          <button className="secondary">Calcular margem</button>
        </article>
        <article className="card mini">
          <p className="eyebrow">SALÃO DA VITÓRIA</p>
          <h3>4 conceitos cinematográficos</h3>
          <p>Imagem premium, copy por canal e vídeo curto da Vitória.</p>
          <button className="primary">Entrar no Salão</button>
        </article>
      </section>

      <footer>
        <span>RL PIN • Loja dos Achados</span>
        <span>V5 Premium • base inicial</span>
      </footer>
    </main>
  );
}
