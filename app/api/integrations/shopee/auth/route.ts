import { buildShopAuthUrl } from "@/lib/shopee";

// Pública como a rota start do Mercado Livre: apenas redireciona para a página
// de consentimento da Shopee usando as credenciais do servidor. Nenhum dado ou
// token é exposto; a troca do code só acontece no callback, após o vendedor
// autorizar a loja na Shopee.
export async function GET() {
  try {
    const url = buildShopAuthUrl();

    return new Response(null, {
      status: 307,
      headers: { Location: url }
    });
  } catch (error) {
    const missingCredentials =
      error instanceof Error && /credenciais/i.test(error.message);
    return Response.json(
      {
        ok: false,
        error: missingCredentials
          ? "Integração com a Shopee ainda não configurada. Cadastre o Partner ID e a Partner Key nas variáveis de ambiente (SHOPEE_PARTNER_ID e SHOPEE_PARTNER_KEY) e tente novamente."
          : "Não foi possível iniciar a autorização com a Shopee. Tente novamente em instantes."
      },
      { status: 503 }
    );
  }
}
