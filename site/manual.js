// Manual de uso do painel, numa aba própria: começo rápido, um capítulo por tela e perguntas frequentes.
import { registrarAba } from './app.js';
import { $, $$, esc } from './ui.js';

// [id da aba (ou ''), ícone, título, para que serve, passos, dicas]
const CAPITULOS = [
  ['', '🚀', 'Começo rápido', 'O caminho mais curto para usar o painel no dia a dia.', [
    'Abra o painel pelo servidor do Wi-Fi (http://localhost:8080 neste computador, ou o endereço que aparece na janela do servidor nos outros aparelhos). É por ele que funcionam a IA, os dados salvos e a pesquisa de preços.',
    'Em 🏢 Perfis de empresa, cadastre sua empresa: termos de busca (o que você vende), estados, dados da empresa, representante e banco.',
    'Em 🔎 Busca, escolha o perfil no topo: a lista mostra só os pregões que combinam com você.',
    'Abra um pregão, confira os itens e clique em "Adicionar ao Kanban" nos que interessam.',
    'Acompanhe tudo pelo 🗂️ Kanban, pelo 📅 Agenda e pelo sino 🔔 no topo.',
  ], ['Comece com poucos termos bem específicos (ex.: "notebook", "toner") e vá ajustando.', 'Os filtros ficam no endereço da página: salve nos favoritos uma busca que você usa sempre.']],

  ['busca', '🔎', 'Busca', 'Todos os pregões com propostas abertas no Brasil (PNCP), atualizados sozinhos a cada 30 minutos no servidor do Wi-Fi.', [
    'Use os filtros: perfil, modalidade, UF, prazo de encerramento, palavras, município, valor e registro de preços.',
    'Clique numa barra dos gráficos (estado, município, órgão) para filtrar por ela.',
    'Clique num pregão para abrir os detalhes: dados, links do PNCP e do portal, itens e vencedores.',
    'Nos itens, "🔎 Pesquisar preço deste item" procura o produto em lojas, confere as especificações e calcula o lucro. Ajuste "Impostos + frete" para o lucro ficar realista.',
    'Se o órgão cadastrou só "LOTE 01" ou "Proposta para todos os itens", use "📄 Ler os itens do edital (IA)": a IA monta a lista real a partir do PDF.',
    'Com os itens na tela, gere a proposta comercial em Word (.docx) com o timbre e os dados da empresa.',
    'Exporte a lista filtrada em "Exportar CSV" para abrir no Excel.',
  ], ['Na coluna "Encerra", vermelho é menos de 48 horas e laranja é até 7 dias.', 'O lucro usa o valor máximo estimado pelo órgão; no pregão vence o menor lance, então o lucro real tende a ser menor.']],

  ['kanban', '🗂️', 'Kanban', 'Organiza as licitações que você está acompanhando, da captação ao resultado.', [
    'Adicione pregões pela Busca (botão no detalhe do pregão).',
    'Arraste os cards entre as colunas: Captada, Em análise, Proposta/disputa, Aguardando resultado, Ganhou, Perdeu, Desistiu.',
    'Abra um card para anotar, registrar o valor da sua proposta, o valor final e, se perdeu, o motivo.',
    'Filtre por empresa quando trabalhar com mais de um perfil.',
  ], ['Registrar valores e motivos de perda é o que alimenta os Relatórios.']],

  ['agenda', '📅', 'Agenda', 'Calendário com os prazos dos pregões do Kanban (entram sozinhos), tarefas e compromissos.', [
    'Veja o mês ou a lista. Os encerramentos dos pregões em andamento aparecem automaticamente.',
    'Use o ⚡ Cadastro rápido escrevendo do seu jeito, por exemplo "reunião com fornecedor sexta 10h30"; confira e salve.',
    'Ligue "🔔 Ativar lembretes" para o navegador avisar na hora dos compromissos.',
  ], ['Marque "Oportunidades do perfil" para ver no calendário quando encerram os pregões que combinam com você e ainda não estão no Kanban.']],

  ['relatorios', '📊', 'Relatórios', 'Resultados por período e por empresa: captadas, participações, vitórias, perdas, taxa de êxito e valores.', [
    'Escolha a empresa e o período.',
    'Veja os indicadores, a situação das oportunidades, os motivos de perda e o comparativo entre empresas.',
    'Escreva um comentário e gere o PDF (imprimir → salvar como PDF) para enviar ao cliente ou guardar.',
  ], ['Para mandar a um cliente, selecione só a empresa dele antes de gerar o PDF.']],

  ['poslicitacao', '📑', 'Pós-licitação', 'Controle do que você ganhou: atas de registro de preços, contratos e empenhos, com entregas e pagamentos.', [
    'Cadastre a ata ou o contrato (quando aparece o aviso 🏆, um clique cria a ata a partir do Kanban).',
    'Cadastre cada empenho/ordem de fornecimento ligado à ata ou contrato, com o prazo de entrega.',
    'Registre cada entrega (+ Entrega) e cada pagamento recebido (+ Pagamento).',
    'Acompanhe nos indicadores: saldo para empenhar, empenhos em aberto e o que foi entregue e ainda não foi pago.',
  ], ['O sino avisa entregas atrasadas ou para hoje e atas/contratos que terminam em até 30 dias.']],

  ['juridico', '⚖️', 'Jurídico', 'Impugnações, pedidos de esclarecimento, recursos, contrarrazões e defesas, com prazo e minuta.', [
    'Clique em "+ Nova demanda", escolha o tipo e ligue à licitação do Kanban.',
    'Informe a data de abertura (impugnação/esclarecimento) ou da intimação (recurso, contrarrazões, defesa): o prazo é calculado em dias úteis pela Lei 14.133.',
    'Escreva os fatos e o pedido, e clique em "📄 Minuta" para gerar o documento com os dados da empresa e salvar em PDF.',
    'Atualize a situação (em análise, minuta gerada, protocolado…) direto na lista.',
  ], ['Impugnação e esclarecimento: até 3 dias úteis antes da abertura. Recurso e contrarrazões: 3 dias úteis da intimação.', 'A minuta é um ponto de partida: revise os fundamentos antes de protocolar. Feriados locais não entram na conta.']],

  ['documentos', '📄', 'Documentos', 'Cofre de certidões com aviso de vencimento e declarações de habilitação prontas.', [
    'Escolha a empresa no topo.',
    'Cadastre cada certidão com a data de validade; o botão "Emitir ↗" leva ao site oficial para tirar a próxima.',
    'Em Declarações, marque as que o edital pede, escolha a licitação do Kanban (ou digite órgão e número) e clique em "Gerar PDF das marcadas".',
    'Crie declarações personalizadas usando os campos {razao}, {cnpj}, {certame}, {orgao}, {pregao}.',
  ], ['Se faltar razão social, CNPJ, endereço ou representante no perfil, a tela avisa: as declarações sairiam com campos em branco.']],

  ['pesqprecos', '💲', 'Pesquisa de Preços', 'Quanto o governo já pagou por um item e quanto ele custa no mercado.', [
    'Preços praticados: informe o código do item no catálogo do governo (CATMAT para material, CATSER para serviço) e, se quiser, a UF. Veja menor, mediana, maior, preço por estado e cada compra com órgão, fornecedor e marca.',
    'Não sabe o código? Use o link do Catálogo de Compras ou veja o código nos itens de um pregão.',
    'Preço no mercado: descreva o produto com as especificações; a IA procura em lojas, confere as especificações e traz os links (3 a 8 minutos).',
  ], ['A mediana é a referência mais segura: o menor e o maior preço costumam ter casos fora do comum.']],

  ['monitoramento', '🔭', 'Monitoramento', 'Vigia órgãos e palavras-chave e mostra o que os concorrentes ganham.', [
    'Clique em "+ Vigiar" e escolha: órgão (CNPJ ou nome), palavra-chave ou concorrente (CNPJ).',
    'Para órgãos e palavras, aparecem os pregões abertos; os ainda não vistos ficam marcados como novos e vão para o sino.',
    'Para concorrentes, clique em "Ver itens ganhos": aparecem os itens que ele venceu nos últimos 12 meses, com valores, estados e link do pregão.',
  ], ['Vigiar os órgãos que mais compram o que você vende é a forma mais rápida de não perder oportunidade.']],

  ['lances', '🎯', 'Lances', 'Calcula seu lance mínimo e monta um plano de lances antes da disputa.', [
    'Escolha a licitação do Kanban e preencha custo, frete, impostos, outras despesas e a margem mínima que você aceita.',
    'Informe o valor estimado pelo órgão, a quantidade e quanto reduzir a cada lance (% ou R$).',
    'Veja o lance mínimo (piso), o lucro em cada lance e salve o plano para consultar durante a disputa.',
  ], ['Os lances são dados por você no portal. Robôs que enviam lances sozinhos podem violar as regras dos portais; por isso esta tela não envia lances.']],

  ['perfis', '🏢', 'Perfis de empresa', 'Cada perfil é uma empresa (ou cliente). Os dados alimentam a busca, as propostas, as declarações e as minutas.', [
    'Clique em "+ Novo perfil" e preencha os termos de busca (um por linha), palavras a excluir, estados e cidades.',
    'Preencha os dados da empresa, o representante legal, os dados bancários e envie o logo para o timbre.',
    'Use "Usar na busca" para filtrar a Busca por esse perfil.',
  ], ['Se você é assessor, crie um perfil por cliente: Kanban, Relatórios e Documentos separam tudo por empresa.']],

  ['', '🤖', 'Agentes de IA', 'Chat com quatro agentes (Buscador, Analista de edital, Pesquisa de preços e Estrategista) que consultam os pregões.', [
    'Clique em "🤖 Agentes IA" no topo.',
    'Na primeira vez, cole a chave gratuita do Google AI Studio (crie em aistudio.google.com/apikey).',
    'Escolha o agente e pergunte em português, ou use uma das sugestões.',
  ], ['Não marque "Lembrar neste navegador" em computador compartilhado.']],

  ['', '🔔', 'Sino de avisos e menu', 'O que precisa da sua atenção, reunido num lugar só.', [
    'O número no sino soma: pregões do Kanban encerrando em até 48 h, certidões vencidas ou vencendo em 15 dias, prazos jurídicos em até 3 dias, entregas atrasadas, atas e contratos terminando e pregões novos do Monitoramento.',
    'Clique num aviso para ir à tela dele.',
    'O botão « no topo do menu recolhe o menu lateral e deixa só os ícones.',
  ], []],

  ['', '🖥️', 'Servidor do Wi-Fi, senha e extensão', 'Como o painel funciona nos seus aparelhos.', [
    'O servidor liga sozinho quando o Windows inicia (janela minimizada "Painel de Pregoes"). Se cair, ele religa em segundos.',
    'Nos outros aparelhos do Wi-Fi, abra o endereço que aparece na janela do servidor. A pesquisa com IA e os dados salvos pedem a senha que está em servidor\\senha.txt.',
    'O painel online do GitHub (a37617.github.io/painel-pregoes) funciona em qualquer lugar, mas sem IA e com os dados salvos só naquele navegador.',
    'A extensão do Chrome (botão "⬇ Extensão do Chrome") avisa quando surge pregão com as suas palavras-chave.',
  ], ['Os dados de pregões vêm do PNCP: a coleta completa roda no GitHub várias vezes por dia e o servidor busca os novos a cada 30 minutos.']],
];

const PERGUNTAS = [
  ['Por que não aparece a pesquisa de preço nos itens?', 'Ela só funciona quando o painel é aberto pelo servidor do Wi-Fi. No painel online do GitHub aparece só um aviso.'],
  ['A IA disse "nenhum produto compatível". E agora?', 'Abra "Conferência" para ver quais especificações nenhuma loja confirmou. Às vezes o edital aponta para uma marca; vale ler se ele aceita "similar ou superior".'],
  ['O item é serviço ou "maior desconto". Por que não tem preço?', 'Serviço depende de mão de obra e deslocamento, e no "maior desconto" o lance é um percentual sobre uma tabela. Nesses casos não há produto de loja para comparar.'],
  ['Apareceu "outro aparelho salvou antes".', 'Duas telas mexeram nos mesmos dados ao mesmo tempo. A tela foi atualizada com a versão mais recente: refaça só a última alteração.'],
  ['Pediram uma senha.', 'Ela fica na janela do servidor e no arquivo servidor\\senha.txt, no computador onde o servidor roda.'],
  ['O painel não abre.', 'Confira se o computador do servidor está ligado e se a janela "Painel de Pregoes" está aberta. O endereço pode mudar se o roteador trocar o IP: veja o atual na janela do servidor.'],
];

let v;

function desenhar() {
  const busca = ($('#mnBusca')?.value || '').trim();
  // Sem acento e sem a terminação: "certidão" acha "certidões", "lance" acha "lances".
  const raiz = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const alvo = raiz(busca).replace(/(oes|aes|ao|s)$/, '');
  const casa = txt => !alvo || raiz(txt).includes(alvo);
  const caps = CAPITULOS.filter(c => casa([c[2], c[3], ...c[4], ...c[5]].join(' ')));
  const pergs = PERGUNTAS.filter(p => casa(p.join(' ')));
  v.innerHTML = `<div class="ap-topo ap-pad-x"><div><h2>📘 Manual</h2><p class="m">Como usar cada tela do painel, passo a passo.</p></div>
      <label class="ui-perfil">Procurar no manual<input id="mnBusca" value="${esc(busca)}" placeholder="Ex.: certidão, lance, senha"></label></div>
    <div class="mn-layout">
      <nav class="card mn-indice">${caps.map((c, i) => `<a href="#mn-${i}" data-alvo="mn-${i}">${c[1]} ${esc(c[2])}</a>`).join('')}${pergs.length ? '<a href="#mn-faq" data-alvo="mn-faq">❓ Perguntas frequentes</a>' : ''}</nav>
      <div class="mn-conteudo">
        ${caps.map((c, i) => `<section class="card ap-pad mn-cap" id="mn-${i}">
          <div class="ap-topo"><h3>${c[1]} ${esc(c[2])}</h3>${c[0] ? `<button class="btn-ghost" data-ir="${c[0]}">Abrir esta tela →</button>` : ''}</div>
          <p>${esc(c[3])}</p>
          <ol>${c[4].map(p => `<li>${esc(p)}</li>`).join('')}</ol>
          ${c[5].length ? `<div class="mn-dica">💡 ${c[5].map(esc).join('<br>💡 ')}</div>` : ''}
        </section>`).join('')}
        ${pergs.length ? `<section class="card ap-pad mn-cap" id="mn-faq"><h3>❓ Perguntas frequentes</h3>${pergs.map(([q, r]) => `<details class="mn-faq"><summary>${esc(q)}</summary><p>${esc(r)}</p></details>`).join('')}</section>` : ''}
        ${!caps.length && !pergs.length ? '<p class="empty">Nada encontrado no manual com essa palavra.</p>' : ''}
      </div>
    </div>`;
  const campo = $('#mnBusca');
  campo.oninput = () => { clearTimeout(desenhar.t); desenhar.t = setTimeout(() => { desenhar(); const c = $('#mnBusca'); c.focus(); c.setSelectionRange(99, 99); }, 250); };
  $$('[data-ir]', v).forEach(b => b.onclick = () => window.irParaAba(b.dataset.ir));
  $$('[data-alvo]', v).forEach(a => a.onclick = e => { e.preventDefault(); document.getElementById(a.dataset.alvo)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
}

v = registrarAba('manual', '📘 Manual', desenhar, '_fim'); // último item do menu
