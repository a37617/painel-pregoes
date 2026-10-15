// Pesquisa de preços dos itens na internet (feita pelo Claude no servidor do Wi-Fi) e cálculo do lucro.
// Só aparece quando o painel é aberto pelo servidor local (servidor/server.mjs), que tem a rota /api.
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const brl = v => v == null || isNaN(v) ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: v < 100 ? 2 : 0 });
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

let status = null; // null = sem servidor (ex.: GitHub Pages)
try {
  const r = await fetch('api/status', { headers: senhaHeader() });
  if (r.ok) status = await r.json();
} catch {}

function senhaHeader() { const s = store.get('pregoes.senhaServidor'); return s ? { 'x-senha': s } : {}; }

const extras = () => { const v = parseFloat(store.get('pregoes.custosExtras')); return isNaN(v) ? 15 : v; };

// item do PNCP + resultado da pesquisa -> lucro
function calcular(it, r) {
  const est = it.valorUnitarioEstimado, qtd = it.quantidade || 0;
  if (!r || !(r.preco_unitario_mediano > 0) || !(est > 0)) return null;
  const custo = r.preco_unitario_mediano * (1 + extras() / 100);
  const un = est - custo;
  return { custo, un, total: un * qtd, margem: un / est };
}

const ICONE = { atende: '✅', nao_atende: '❌', nao_confirmado: '❔' };
const SELO = { sim: ['pz-alta', 'atende tudo'], parcial: ['pz-media', 'sem confirmar tudo'], nao: ['pz-ruim-bg', 'não atende'] };

function fonteHtml(f) {
  const [cls, txt] = SELO[f.compativel] || SELO.parcial;
  const falhas = (f.especificacoes || []).filter(x => x.status !== 'atende');
  return `<li><span class="pz-conf ${cls}">${txt}</span> <a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">${esc(f.loja)}</a>: <b>${brl(f.preco)}</b>${f.usado_no_preco ? ' <span class="pz-bom">· entrou no preço</span>' : ''}
    <div class="m">${esc(f.produto || '')}${f.verificado_na_pagina ? '' : ' · página não abriu, conferido pela busca'}</div>
    ${falhas.length ? `<div class="m">${falhas.map(x => `${ICONE[x.status]} ${esc(x.especificacao)}${x.detalhe ? `: ${esc(x.detalhe)}` : ''}`).join('<br>')}</div>` : ''}</li>`;
}

// Quadro: cada especificação exigida x cada loja.
function quadro(r) {
  const exig = r.especificacoes_exigidas || [], fontes = r.fontes || [];
  if (!exig.length || !fontes.length) return '';
  const norm = s => String(s).toLowerCase();
  const status = (f, e) => (f.especificacoes || []).find(x => norm(x.especificacao) === norm(e))?.status || 'nao_confirmado';
  return `<div class="pz-quadro"><table><thead><tr><th>Especificação do edital</th>${fontes.map(f => `<th title="${esc(f.produto || '')}">${esc(f.loja)}</th>`).join('')}</tr></thead>
    <tbody>${exig.map(e => `<tr><td>${esc(e)}</td>${fontes.map(f => `<td>${ICONE[status(f, e)]}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function celula(it, r) {
  if (!r) return '';
  const total = r.fontes?.length || 0;
  const detalhes = `<details class="pz-fontes"><summary>Conferência: ${r.compativeis ?? 0} de ${total} produto(s) atendem a todas as especificações${r.doCache ? ' · pesquisa recente' : ''}</summary>
      ${r.usou_anexo ? '<div class="m">📎 Especificações lidas do anexo do edital (termo de referência).</div>' : ''}
      ${(r.especificacoes_exigidas || []).length ? `<div class="m"><b>Exigências conferidas:</b> ${r.especificacoes_exigidas.map(esc).join(' · ')}</div>` : ''}
      ${r.produto_encontrado ? `<div class="m"><b>Modelo que atende:</b> ${esc(r.produto_encontrado)}</div>` : ''}
      ${quadro(r)}
      <ul>${(r.fontes || []).map(fonteHtml).join('')}</ul>
      ${r.observacao ? `<div class="m">${esc(r.observacao)}</div>` : ''}
    </details>`;
  if (!(r.preco_unitario_mediano > 0)) return `<span class="pz-ruim">Nenhum produto compatível encontrado</span>${detalhes}`;
  const c = calcular(it, r);
  const cor = !c ? '' : c.margem >= 0.15 ? 'pz-bom' : c.margem >= 0 ? 'pz-medio' : 'pz-ruim';
  const aviso = r.base_preco === 'parciais'
    ? '<div class="pz-medio">⚠️ Nenhum produto confirmou todas as especificações: preço calculado com produtos que não deu para conferir por completo.</div>' : '';
  return `<div><b>${brl(r.preco_unitario_mediano)}</b>/un no mercado <span class="pz-conf pz-${esc(r.confianca)}">confiança ${esc(r.confianca)}</span></div>
    ${aviso}
    ${c ? `<div class="${cor}">Lucro: <b>${brl(c.un)}</b>/un · <b>${brl(c.total)}</b> no total · margem ${(c.margem * 100).toFixed(0)}%</div>` : '<div class="m">Sem valor estimado para comparar.</div>'}
    ${detalhes}`;
}

// Serviços e itens julgados por desconto não têm um produto de loja para comparar.
function semPesquisa(it) {
  if (!it) return '';
  const crit = String(it.criterioJulgamentoNome || '').toLowerCase();
  // Alguns órgãos cadastram no PNCP um item só ("proposta para todos os itens", "lote único") e põem a lista real no edital.
  if (/proposta (para|com) todos|todos os itens|lote (unico|único|global)|valor global/i.test(it.descricao || '') && (it.descricao || '').length < 160)
    return 'O órgão cadastrou no PNCP só um item genérico. A lista real de produtos e quantidades está no edital ou no termo de referência (botão "Ver no PNCP", aba Arquivos). Use o "Analisar com IA" para resumir o edital.';
  if (crit.includes('desconto')) return `Julgamento por ${esc(it.criterioJulgamentoNome.toLowerCase())}: o lance é um percentual de desconto sobre uma tabela de referência (ex.: tabela de peças da montadora), não um preço por produto. Por isso não dá para calcular lucro pela internet: confira no edital qual tabela vale e quanto de desconto você consegue dar.`;
  if (it.materialOuServico === 'S') return 'Serviço: a pesquisa na internet compara produtos de loja, e serviço depende de mão de obra, deslocamento e escala. Para ter uma referência, veja os vencedores de contratos parecidos no PNCP (o agente "Pesquisa de preços" do chat faz isso).';
  return '';
}

window.addEventListener('itens-carregados', e => {
  const { r: pregao, items } = e.detail;
  const tabela = document.querySelector('#drawer table.items');
  if (!tabela) return;

  const box = document.createElement('div');
  box.className = 'pz-box';
  tabela.closest('.tscroll').before(box);

  if (!status) {
    box.innerHTML = '<span class="m">💡 A pesquisa de preços na internet com IA funciona quando o painel é aberto pelo servidor do Wi-Fi (iniciar-servidor.bat).</span>';
    return;
  }
  if (!status.pesquisa?.ok) {
    box.innerHTML = '<span class="m">A pesquisa de preços precisa do Claude Code instalado no computador do servidor.</span>';
    return;
  }

  const resultados = {};
  const porNumero = Object.fromEntries(items.map(it => [it.numeroItem, it]));
  // O resultado vai numa linha própria logo abaixo de cada item, na largura toda (não corta no painel lateral).
  tabela.querySelectorAll('tbody tr[data-n]').forEach(tr => {
    tr.classList.add('pz-item');
    const motivo = semPesquisa(porNumero[tr.dataset.n]);
    tr.insertAdjacentHTML('afterend', `<tr class="pz-linha" data-pz="${tr.dataset.n}"><td></td><td colspan="4" class="pz-cel">${motivo
      ? `<span class="m">ℹ️ ${motivo}</span>`
      : '<button type="button" class="pz-um" title="Pesquisar o preço deste item na internet">🔎 Pesquisar preço deste item</button>'}</td></tr>`);
  });
  const pesquisaveis = items.filter(it => !semPesquisa(it)).map(it => it.numeroItem);

  box.innerHTML = `
    <button type="button" class="pz-todos">🔎 Pesquisar preços na internet (IA)</button>
    <label class="pz-extra">Impostos + frete <input type="number" min="0" max="200" step="1" value="${extras()}"> %</label>
    <span class="pz-status m"></span>
    ${status.liberado ? '' : `<label class="pz-senha">Senha do servidor <input type="password" value="${esc(store.get('pregoes.senhaServidor') || '')}" autocomplete="off"></label>`}
    <div class="pz-resumo"></div>
    <div class="m pz-aviso">O lucro usa o valor máximo estimado pelo órgão. No pregão vence o menor lance, então o lucro real tende a ser menor. Confira os preços nos links antes de dar lance.</div>`;

  const st = box.querySelector('.pz-status');
  box.querySelector('.pz-senha input')?.addEventListener('change', ev => store.set('pregoes.senhaServidor', ev.target.value.trim()));
  box.querySelector('.pz-extra input').addEventListener('input', ev => { store.set('pregoes.custosExtras', ev.target.value); redesenhar(); });

  function redesenhar() {
    let soma = 0, n = 0, semPreco = 0;
    tabela.querySelectorAll('tbody tr[data-n]').forEach(tr => {
      const num = +tr.dataset.n, r = resultados[num];
      if (!r) return;
      tabela.querySelector(`tr[data-pz="${num}"] .pz-cel`).innerHTML = celula(porNumero[num], r);
      const c = calcular(porNumero[num], r);
      if (c) { soma += c.total; n++; } else semPreco++;
    });
    box.querySelector('.pz-resumo').innerHTML = n ? `Lucro estimado nos ${n} item(ns) pesquisado(s): <b class="${soma >= 0 ? 'pz-bom' : 'pz-ruim'}">${brl(soma)}</b>${semPreco ? ` · ${semPreco} sem preço comparável` : ''}` : '';
  }

  async function pesquisar(nums) {
    const lote = nums.slice(0, status.pesquisa.maxItens);
    const botoes = box.querySelectorAll('button');
    botoes.forEach(b => b.disabled = true);
    lote.forEach(num => { const td = tabela.querySelector(`tr[data-pz="${num}"] .pz-cel`); if (td && !resultados[num]) td.innerHTML = '<span class="m">⏳ pesquisando…</span>'; });
    st.textContent = `Pesquisando ${lote.length} item(ns) na internet e conferindo as especificações… leva de 3 a 8 minutos.`;
    try {
      const corpo = {
        contexto: `${pregao.org} · ${pregao.mun}/${pregao.uf}`,
        pregao: { cnpj: pregao.cnpj, ano: pregao.raw.anoCompra, seq: pregao.raw.sequencialCompra },
        itens: lote.map(num => ({ numero: num, descricao: porNumero[num].descricao, unidade: porNumero[num].unidadeMedida })),
      };
      let r = await fetch('api/pesquisa-preco', { method: 'POST', headers: { 'content-type': 'application/json', ...senhaHeader() }, body: JSON.stringify(corpo) });
      let job = await r.json();
      if (!r.ok) throw new Error(r.status === 401 ? 'digite a senha do servidor (ela aparece na janela do servidor)' : job.erro);
      const t0 = Date.now();
      while (job.status !== 'pronto' && job.status !== 'erro') {
        await new Promise(res => setTimeout(res, 4000));
        r = await fetch('api/pesquisa-preco/' + job.id, { headers: senhaHeader() });
        job = await r.json();
        st.textContent = job.status === 'na fila' ? 'Na fila, esperando outra pesquisa terminar…' : `${job.etapa ? job.etapa[0].toUpperCase() + job.etapa.slice(1) : 'Pesquisando'}… ${Math.round((Date.now() - t0) / 1000)}s`;
      }
      if (job.status === 'erro') throw new Error(job.erro);
      Object.assign(resultados, job.resultado);
      lote.forEach(num => { if (!resultados[num]) resultados[num] = { preco_unitario_mediano: 0, observacao: 'A pesquisa não trouxe este item.' }; });
      st.textContent = '';
      redesenhar();
    } catch (err) {
      st.textContent = 'Não deu certo: ' + err.message;
      lote.forEach(num => { const td = tabela.querySelector(`tr[data-pz="${num}"] .pz-cel`); if (td && !resultados[num]) td.innerHTML = '<button type="button" class="pz-um">🔎 Tentar de novo</button>'; });
    } finally {
      box.querySelectorAll('button').forEach(b => b.disabled = false);
      ligarBotoes();
    }
  }

  function ligarBotoes() {
    tabela.querySelectorAll('.pz-um').forEach(b => b.onclick = ev => { ev.stopPropagation(); pesquisar([+b.closest('tr').dataset.pz]); });
  }
  ligarBotoes();
  box.querySelector('.pz-todos').onclick = () => {
    const faltam = pesquisaveis.filter(n => !resultados[n]);
    if (!faltam.length) { st.textContent = pesquisaveis.length ? 'Todos os produtos já foram pesquisados.' : 'Este pregão só tem serviços ou itens por desconto: não há produto para pesquisar.'; return; }
    if (faltam.length > status.pesquisa.maxItens) st.textContent = `Pesquisando os ${status.pesquisa.maxItens} primeiros itens; clique de novo para os próximos.`;
    pesquisar(faltam);
  };
});
