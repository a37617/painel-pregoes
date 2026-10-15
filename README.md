# Painel de Pregões

Painel com **todos os pregões com propostas abertas** no [PNCP](https://pncp.gov.br), atualizado sozinho a cada 3 horas, e uma extensão do Chrome que avisa quando aparece pregão com as suas palavras-chave.

## Como funciona

```
GitHub Actions (a cada 3h) ──► scripts/sync.mjs baixa o PNCP ──► site/data/pregoes.json
                                                                       │
                                     GitHub Pages publica site/ ◄──────┘
                                        │                   │
                               Painel no navegador   Extensão do Chrome (verifica a cada 1h)
```

- **`scripts/sync.mjs`**: baixa os pregões eletrônicos e presenciais com propostas abertas e grava um arquivo enxuto. Se mais de 20% das páginas falharem, não publica, e o painel continua com os dados anteriores.
- **`site/index.html`**: o painel. Abre já carregado, com filtros, gráficos, tabela, detalhe com itens e vencedores (consultados ao vivo no PNCP) e exportação para CSV. Os filtros ficam no link (ex.: `#uf=SP&q=notebook`), então dá para salvar ou compartilhar uma busca.
- **`.github/workflows/atualizar.yml`**: o agendamento. Para atualizar na hora: aba **Actions** → *Atualizar pregões* → **Run workflow**.
- **`extensao/`**: a extensão do Chrome.

## Instalar a extensão (Chrome ou Edge)

1. Abra `chrome://extensions` (no Edge: `edge://extensions`).
2. Ligue o **Modo do desenvolvedor**, no canto superior direito.
3. Clique em **Carregar sem compactação** e escolha a pasta `extensao`.
4. Fixe o ícone na barra, clique nele e cadastre suas palavras-chave, UF e valor mínimo.

A extensão confere os dados a cada hora. Quando surge um pregão novo que bate com os seus filtros, ela mostra um número no ícone e uma notificação.

## Rodar localmente

```bash
node scripts/sync.mjs
npx serve site
```
