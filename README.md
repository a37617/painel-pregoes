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

## Telas do painel

Menu lateral (recolhível) com sino de avisos no topo:

| Tela | O que faz |
|---|---|
| 🔎 Busca | Todos os pregões abertos, filtros, gráficos, itens, pesquisa de preço com IA e lucro |
| 🗂️ Kanban | Licitações acompanhadas da captação ao resultado, por empresa |
| 📅 Agenda | Encerramentos automáticos, tarefas e compromissos |
| 📊 Relatórios | Participações, vitórias, perdas, taxa de êxito e PDF |
| 📑 Pós-licitação | Atas, contratos e empenhos, com entregas, pagamentos, saldo e vigência |
| ⚖️ Jurídico | Impugnações, esclarecimentos, recursos e contrarrazões com prazo da Lei 14.133 e minuta pronta |
| 📄 Documentos | Cofre de certidões com vencimento e 17 declarações de habilitação geradas num PDF só |
| 💲 Pesquisa de Preços | Preços pagos pelo governo (Compras.gov, por código CATMAT/CATSER) e preço de mercado com IA |
| 🔭 Monitoramento | Órgãos e palavras vigiados e itens ganhos por concorrentes (CNPJ) |
| 🎯 Lances | Lance mínimo (custo + impostos + margem) e plano de lances; não envia lances sozinho |
| 🏢 Perfis de empresa | Dados da empresa usados na busca, propostas, declarações e minutas |

O sino junta encerramentos em até 48 h, certidões vencendo, prazos jurídicos, entregas atrasadas, vigências acabando e pregões novos dos órgãos vigiados. Os dados ficam no servidor do Wi-Fi (`servidor/dados/`) ou, no painel online, só no navegador.

## Instalar a extensão (Chrome ou Edge)

1. Abra `chrome://extensions` (no Edge: `edge://extensions`).
2. Ligue o **Modo do desenvolvedor**, no canto superior direito.
3. Clique em **Carregar sem compactação** e escolha a pasta `extensao`.
4. Fixe o ícone na barra, clique nele e cadastre suas palavras-chave, UF e valor mínimo.

A extensão confere os dados a cada hora. Quando surge um pregão novo que bate com os seus filtros, ela mostra um número no ícone e uma notificação.

## Servidor na rede Wi-Fi

Dê dois cliques em **`iniciar-servidor.bat`** e deixe a janela aberta. O painel fica disponível para qualquer aparelho do mesmo Wi-Fi, no endereço que aparece na janela (ex.: `http://192.168.1.133:8080`). O servidor copia os dados publicados pelo robô do GitHub a cada 30 minutos, então funciona mesmo sem consultar o PNCP diretamente. A extensão pode ser baixada pelo botão **⬇ Extensão do Chrome** no topo do painel.

## Rodar localmente

```bash
node scripts/sync.mjs
npx serve site
```
