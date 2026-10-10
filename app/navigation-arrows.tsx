"use client";

export default function NavigationArrows() {
  return (
    <nav className="pageNavArrows" aria-label="Navegação entre páginas">
      <button type="button" onClick={() => window.history.back()} title="Voltar" aria-label="Voltar">←</button>
      <button type="button" onClick={() => window.history.forward()} title="Avançar" aria-label="Avançar">→</button>
    </nav>
  );
}
