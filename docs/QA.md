# RL PIN V5 Premium — QA interno

## Fluxos considerados internos e prontos para validação
1. Login e sessão.
2. Cadastro de produto em nuvem.
3. Deduplicação por fingerprint.
4. Histórico automático de preço/estoque/score/status.
5. Auditoria automática.
6. Guardião RL.
7. Score de oportunidade.
8. Fornecedores e homologação.
9. Salão: fila, briefing, 4 conceitos, formatos e Vitória.
10. Perfis de taxas e simulador de margem.
11. Fila segura de publicação.
12. Operações e execuções.
13. Saúde do sistema.
14. Configurações centrais.
15. Snapshots diários.

## Pendências externas
- OAuth/credenciais oficiais dos marketplaces.
- Coleta real e atualização real de preço/estoque.
- Geração real de imagem/vídeo por provedor de IA.
- Publicação real nos canais.
- Teste ponta a ponta com contas reais.

## Regra de verdade operacional
Nenhum conector externo deve ser marcado como conectado sem autenticação válida.
Nenhuma mídia deve ser marcada como gerada sem retorno real do provedor.
Nenhum produto deve ser marcado como publicado sem confirmação externa.
