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

function celula(it, r) {
  if (!r) return '';
  if (!(r.preco_unitario_mediano > 0)) return `<span class="pz-baixa">Não encontrado</span>${r.observacao ? `<div class="m">${esc(r.observacao)}</div>` : ''}`;
  const c = calcular(it, r);
  const cor = !c ? '' : c.margem >= 0.15 ? 'pz-bom' : c.margem >= 0 ? 'pz-medio' : 'pz-ruim';
  return `<div><b>${brl(r.preco_unitario_mediano)}</b>/un no mercado <span class="pz-conf pz-${esc(r.confianca)}">confiança ${esc(r.confianca)}</span></div>
    ${c ? `<div class="${cor}">Lucro: <b>${brl(c.un)}</b>/un · <b>${brl(c.total)}</b> no total · margem ${(c.margem * 100).toFixed(0)}%</div>` : '<div class="m">Sem valor estimado para comparar.</div>'}
    <details class="pz-fontes"><summary>${r.fontes?.length || 0} fonte(s)${r.doCache ? ' · pesquisa recente' : ''}</summary>
      <div class="m">${esc(r.produto_encontrado || '')}</div>
      <ul>${(r.fontes || []).map(f => `<li><a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">${esc(f.loja)}</a>: ${brl(f.preco)}</li>`).join('')}</ul>
      ${r.observacao ? `<div class="m">${esc(r.observacao)}</div>` : ''}
    </details>`;
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
  tabela.querySelector('thead tr').insertAdjacentHTML('beforeend', '<th>Mercado e lucro (IA)</th>');
  tabela.querySelectorAll('tbody tr[data-n]').forEach(tr => {
    tr.insertAdjacentHTML('beforeend', `<td class="pz-cel"><button type="button" class="pz-um" title="Pesquisar o preço deste item na internet">🔎 Pesquisar</button></td>`);
  });

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
      tr.querySelector('.pz-cel').innerHTML = celula(porNumero[num], r);
      const c = calcular(porNumero[num], r);
      if (c) { soma += c.total; n++; } else semPreco++;
    });
    box.querySelector('.pz-resumo').innerHTML = n ? `Lucro estimado nos ${n} item(ns) pesquisado(s): <b class="${soma >= 0 ? 'pz-bom' : 'pz-ruim'}">${brl(soma)}</b>${semPreco ? ` · ${semPreco} sem preço comparável` : ''}` : '';
  }

  async function pesquisar(nums) {
    const lote = nums.slice(0, status.pesquisa.maxItens);
    const botoes = box.querySelectorAll('button');
    botoes.forEach(b => b.disabled = true);
    lote.forEach(num => { const td = tabela.querySelector(`tr[data-n="${num}"] .pz-cel`); if (td && !resultados[num]) td.innerHTML = '<span class="m">⏳ pesquisando…</span>'; });
    st.textContent = `Pesquisando ${lote.length} item(ns) na internet… leva de 1 a 3 minutos.`;
    try {
      const corpo = {
        contexto: `${pregao.org} · ${pregao.mun}/${pregao.uf}`,
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
        st.textContent = job.status === 'na fila' ? 'Na fila, esperando outra pesquisa terminar…' : `Pesquisando na internet… ${Math.round((Date.now() - t0) / 1000)}s`;
      }
      if (job.status === 'erro') throw new Error(job.erro);
      Object.assign(resultados, job.resultado);
      lote.forEach(num => { if (!resultados[num]) resultados[num] = { preco_unitario_mediano: 0, observacao: 'A pesquisa não trouxe este item.' }; });
      st.textContent = '';
      redesenhar();
    } catch (err) {
      st.textContent = 'Não deu certo: ' + err.message;
      lote.forEach(num => { const td = tabela.querySelector(`tr[data-n="${num}"] .pz-cel`); if (td && !resultados[num]) td.innerHTML = '<button type="button" class="pz-um">🔎 Tentar de novo</button>'; });
    } finally {
      box.querySelectorAll('button').forEach(b => b.disabled = false);
      ligarBotoes();
    }
  }

  function ligarBotoes() {
    tabela.querySelectorAll('.pz-um').forEach(b => b.onclick = ev => { ev.stopPropagation(); pesquisar([+b.closest('tr').dataset.n]); });
  }
  ligarBotoes();
  box.querySelector('.pz-todos').onclick = () => {
    const faltam = items.map(it => it.numeroItem).filter(n => !resultados[n]);
    if (faltam.length > status.pesquisa.maxItens) st.textContent = `Pesquisando os ${status.pesquisa.maxItens} primeiros itens; clique de novo para os próximos.`;
    pesquisar(faltam);
  };
});
