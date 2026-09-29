import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RL PIN - Loja dos Achados V5 Premium",
  description: "Central premium de curadoria, análise e operação de e-commerce."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
