// Lances: calculadora do lance mínimo (custo + impostos + frete + margem) e plano de disputa
// por licitação, com a tabela de lances até o piso. Os lances são dados pela pessoa no portal.
import { registrarAba } from './app.js';
import { $, esc, brl, num, colecao, opcoesCards, cardPorId } from './ui.js';
import { id } from './loja.js';

export const planos = colecao('lances');
let v, atual = null;

const CAMPOS = [
  ['custo', 'Custo unitário do produto (R$)'], ['frete', 'Frete por unidade (R$)'], ['impostos', 'Impostos sobre a venda (%)'],
  ['outros', 'Outras despesas (%) (comissão, taxa do portal, garantia)'], ['margem', 'Margem mínima de lucro (%)'],
  ['estimado', 'Valor estimado pelo órgão (R$/un)'], ['quantidade', 'Quantidade'],
];
const PADRAO = { tipoDec: 'pct', decremento: 1, impostos: 8, outros: 2, margem: 10, quantidade: 1 };

function calcular(p) {
  const custo = num(p.custo) + num(p.frete);
  const desp = (num(p.impostos) + num(p.outros)) / 100;
  const perc = desp + num(p.margem) / 100;
  const piso = perc < 1 && custo > 0 ? custo / (1 - perc) : NaN; // preço em que sobra exatamente a margem mínima
  const est = num(p.estimado), q = num(p.quantidade) || 1;
  const lucro = preco => preco * (1 - desp) - custo;
  const passos = [];
  if (est > 0 && piso > 0 && est > piso) {
    const dec = num(p.decremento) || (p.tipoDec === 'rs' ? 0.01 : 1);
    for (let x = est, i = 0; i < 40 && x > piso; i++) {
      passos.push(x);
      x = p.tipoDec === 'rs' ? x - dec : x * (1 - dec / 100);
    }
    passos.push(piso);
  }
  return { custo, piso, est, q, lucro, passos };
}

function resultado(p) {
  const c = calcular(p);
  const card = cardPorId(p.card);
  return `<div class="kpis">
      <div class="card kpi"><div class="l">Custo total por unidade</div><div class="v">${brl(c.custo)}</div></div>
      <div class="card kpi alert"><div class="l">Lance mínimo (piso)</div><div class="v">${isFinite(c.piso) ? brl(c.piso) : '—'}</div><div class="h">abaixo disso a margem fica menor que ${esc(p.margem || 0)}%</div></div>
      <div class="card kpi"><div class="l">Lucro no valor estimado</div><div class="v">${c.est && c.custo ? brl(c.lucro(c.est) * c.q, 0) : '—'}</div><div class="h">${c.est && c.custo ? `${((c.lucro(c.est) / c.est) * 100).toFixed(1)}% de margem` : 'informe custo e valor estimado'}</div></div>
      <div class="card kpi"><div class="l">Lucro no piso</div><div class="v">${isFinite(c.piso) ? brl(c.lucro(c.piso) * c.q, 0) : '—'}</div><div class="h">para ${c.q.toLocaleString('pt-BR')} un.</div></div>
    </div>
    ${c.est && isFinite(c.piso) && c.est < c.piso ? `<div class="ui-aviso">⚠️ O valor estimado (${brl(c.est)}) já está abaixo do seu piso. Só vale disputar se conseguir custo menor.</div>` : ''}
    ${c.passos.length ? `<h3>Plano de lances</h3><div class="tscroll"><table class="ui-tabela"><thead><tr><th>#</th><th class="num">Lance (R$/un)</th><th class="num">Total</th><th class="num">Lucro total</th><th class="num">Margem</th></tr></thead><tbody>
      ${c.passos.map((x, i) => { const l = c.lucro(x); return `<tr class="${i === c.passos.length - 1 ? 'ui-piso' : ''}"><td>${i === c.passos.length - 1 ? 'PISO' : i + 1}</td><td class="num"><b>${brl(x)}</b></td><td class="num">${brl(x * c.q, 0)}</td><td class="num">${brl(l * c.q, 0)}</td><td class="num">${((l / x) * 100).toFixed(1)}%</td></tr>`; }).join('')}
    </tbody></table></div>` : '<p class="m">Preencha custo, impostos, margem e valor estimado para ver o plano de lances.</p>'}
    ${card ? `<p class="m">Licitação: ${esc(card.objeto)} · ${esc(card.orgao)} · estimado total ${brl(card.valor, 0)}</p>` : ''}
    <p class="m ui-nota">Os lances são dados por você no portal de compras. Robôs que enviam lances sozinhos podem violar as regras dos portais e levar a sanções; por isso esta tela calcula e organiza, mas não envia lances.</p>`;
}

function desenhar() {
  const p = atual || { ...PADRAO };
  v.innerHTML = `<div class="ap-topo ap-pad-x"><div><h2>Lances</h2><p class="m">Descubra seu lance mínimo antes da disputa e leve um plano de lances pronto.</p></div>
      <span class="ap-acoes"><select id="lcPlanos"><option value="">+ Novo plano</option>${planos.itens.map(x => `<option value="${esc(x.id)}" ${x.id === p.id ? 'selected' : ''}>${esc(x.nome || cardPorId(x.card)?.objeto?.slice(0, 50) || 'Plano')}</option>`).join('')}</select></span></div>
    <div class="ui-dupla">
      <form class="card ap-pad ap-form" id="lcForm">
        <label class="ap-largo">Licitação do Kanban<select name="card">${opcoesCards().map(([val, r]) => `<option value="${esc(val)}" ${val === (p.card || '') ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
        <label class="ap-largo">Nome do plano<input name="nome" value="${esc(p.nome || '')}" placeholder="Ex.: Item 2 – luminária 200 W"></label>
        ${CAMPOS.map(([k, r]) => `<label>${r}<input name="${k}" type="number" step="any" min="0" value="${esc(p[k] ?? '')}"></label>`).join('')}
        <label>Redução por lance<span class="ui-linha"><input name="decremento" type="number" step="any" min="0" value="${esc(p.decremento ?? '')}"><select name="tipoDec"><option value="pct" ${p.tipoDec !== 'rs' ? 'selected' : ''}>%</option><option value="rs" ${p.tipoDec === 'rs' ? 'selected' : ''}>R$</option></select></span></label>
        <label class="ap-largo">Anotações da disputa<textarea name="notas" rows="2">${esc(p.notas || '')}</textarea></label>
        <div class="ap-rodape">${p.id ? '<button type="button" class="btn-ghost ap-perigo" id="lcApagar">Apagar plano</button>' : '<span></span>'}<span class="m" id="lcMsg"></span><button class="btn-primary">Salvar plano</button></div>
      </form>
      <section class="card ap-pad" id="lcRes">${resultado(p)}</section>
    </div>`;
  const form = $('#lcForm');
  const ler = () => { const o = { ...p }; for (const [k, val] of new FormData(form)) o[k] = val; return o; };
  // Só os resultados são redesenhados enquanto digita: o formulário não perde o foco.
  form.oninput = form.onchange = () => { atual = ler(); $('#lcRes').innerHTML = resultado(atual); };
  form.onsubmit = async e => {
    e.preventDefault();
    const o = { ...ler(), id: p.id || id(), atualizadoEm: new Date().toISOString() };
    if (await planos.salvar(p.id ? planos.itens.map(x => x.id === p.id ? o : x) : [...planos.itens, o])) { atual = o; desenhar(); $('#lcMsg').textContent = 'Plano salvo.'; }
  };
  $('#lcApagar')?.addEventListener('click', async () => { if (confirm('Apagar este plano?') && await planos.salvar(planos.itens.filter(x => x.id !== p.id))) { atual = null; desenhar(); } });
  $('#lcPlanos').onchange = e => { atual = planos.itens.find(x => x.id === e.target.value) || null; desenhar(); };
}

v = registrarAba('lances', '🎯 Lances', async () => {
  if (!planos.pronto) { v.innerHTML = '<p class="empty">Carregando…</p>'; await planos.carregar(); }
  desenhar();
});
