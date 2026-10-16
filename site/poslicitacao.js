// Pós-licitação: atas de registro de preços, contratos e empenhos, com entregas, pagamentos,
// saldo e vencimentos. O que foi ganho no Kanban vira instrumento com um clique.
import { registrarAba, estado } from './app.js';
import { $, $$, esc, brl, num, dataBR, diasAte, hojeISO, colecao, formulario, seletorPerfil, perfilEscolhido, ligarSeletorPerfil, nomePerfil, opcoesCards, cardPorId, store } from './ui.js';
import { id } from './loja.js';

export const pos = colecao('poslicitacao');
const TIPOS = { ata: 'Ata de registro de preços', contrato: 'Contrato', empenho: 'Empenho / ordem de fornecimento' };
let v;

const soma = (l, k = 'valor') => (l || []).reduce((s, x) => s + num(x[k]), 0);
const empenhosDe = idInst => pos.itens.filter(e => e.tipo === 'empenho' && e.vinculo === idInst);
const entregue = e => soma(e.entregas);
const pago = e => soma(e.pagamentos);
export function vigente(i) { return !i.fim || diasAte(i.fim) >= 0; }

function resumo(lista) {
  const inst = lista.filter(i => i.tipo !== 'empenho' && vigente(i));
  const emp = lista.filter(i => i.tipo === 'empenho');
  const saldo = inst.reduce((s, i) => s + num(i.valor) - soma(empenhosDe(i.id)), 0);
  const empenhado = soma(emp);
  const abertos = emp.filter(e => num(e.valor) - pago(e) > 0.009);
  const aReceber = emp.reduce((s, e) => s + Math.max(0, entregue(e) - pago(e)), 0);
  const recebido = emp.reduce((s, e) => s + pago(e), 0);
  return { inst, contratos: inst.filter(i => i.tipo === 'contrato').length, saldo, empenhado, abertos, aReceber, recebido };
}

function desenhar() {
  const perfilId = perfilEscolhido('pregoes.posPerfil');
  const lista = pos.itens.filter(i => !perfilId || i.perfil === perfilId);
  const aba = store.get('pregoes.posAba') || 'ata';
  const r = resumo(lista);
  const daAba = lista.filter(i => i.tipo === aba).sort((a, b) => (b.inicio || '').localeCompare(a.inicio || ''));
  const ganhos = estado.kanban.filter(c => c.coluna === 'ganhou' && (!perfilId || c.perfil === perfilId) && !pos.itens.some(i => i.card === c.id));
  v.innerHTML = `<div class="ap-topo ap-pad-x"><div><h2>Pós-licitação</h2><p class="m">Atas, contratos, empenhos, entregas e pagamentos de tudo que você ganhou.</p></div>
      <span class="ap-acoes">${seletorPerfil('pregoes.posPerfil')}
      <button class="btn-primary" data-novo="ata">+ Ata</button><button class="btn-primary" data-novo="contrato">+ Contrato</button><button class="btn-primary" data-novo="empenho">+ Empenho</button></span></div>
    <div class="kpis">
      <div class="card kpi"><div class="l">Instrumentos vigentes</div><div class="v">${r.inst.length}</div><div class="h">${r.contratos} contrato(s)</div></div>
      <div class="card kpi"><div class="l">Saldo para empenhar</div><div class="v">${brl(r.saldo, 0)}</div><div class="h">${brl(r.empenhado, 0)} empenhados</div></div>
      <div class="card kpi"><div class="l">Empenhos em aberto</div><div class="v">${r.abertos.length}</div><div class="h">${brl(r.abertos.reduce((s, e) => s + num(e.valor) - pago(e), 0), 0)} a faturar/receber</div></div>
      <div class="card kpi ${r.aReceber ? 'alert' : ''}"><div class="l">Entregue e não pago</div><div class="v">${brl(r.aReceber, 0)}</div><div class="h">${brl(r.recebido, 0)} já recebidos</div></div>
    </div>
    ${ganhos.length ? `<div class="ui-aviso">🏆 ${ganhos.length} licitação(ões) ganha(s) no Kanban ainda sem ata ou contrato: ${ganhos.slice(0, 3).map(c => `<button class="btn-ghost" data-ganho="${esc(c.id)}">${esc((c.objeto || '').slice(0, 50))}…</button>`).join(' ')}</div>` : ''}
    <section class="card ap-pad">
      <nav class="ui-sub">${Object.entries(TIPOS).map(([k, n]) => `<button data-aba="${k}" class="${k === aba ? 'ativa' : ''}">${n.split(' ')[0]}s (${lista.filter(i => i.tipo === k).length})</button>`).join('')}</nav>
      ${daAba.length ? (aba === 'empenho' ? tabelaEmpenhos(daAba) : tabelaInstrumentos(daAba)) : `<p class="empty">Nenhum registro de ${TIPOS[aba].toLowerCase()}. <button class="btn-ghost" data-novo="${aba}">Cadastrar</button></p>`}
    </section>`;
  ligarSeletorPerfil(v, desenhar);
  $$('[data-aba]', v).forEach(b => b.onclick = () => { store.set('pregoes.posAba', b.dataset.aba); desenhar(); });
  $$('[data-novo]', v).forEach(b => b.onclick = () => editar({ tipo: b.dataset.novo, perfil: perfilId || estado.perfis[0]?.id || '' }));
  $$('[data-editar]', v).forEach(b => b.onclick = () => editar(pos.itens.find(i => i.id === b.dataset.editar)));
  $$('[data-ganho]', v).forEach(b => b.onclick = () => { const c = cardPorId(b.dataset.ganho); editar({ tipo: 'ata', perfil: c.perfil, card: c.id, orgao: c.orgao, objeto: c.objeto, numero: '', valor: c.valorFinal || c.valorProposta || c.valor || '' }); });
  $$('[data-mov]', v).forEach(b => b.onclick = () => movimento(b.dataset.id, b.dataset.mov));
}

function tabelaInstrumentos(l) {
  return `<div class="tscroll"><table class="ui-tabela"><thead><tr><th>Nº</th><th>Objeto · órgão</th><th class="num">Valor</th><th class="num">Empenhado</th><th class="num">Saldo</th><th>Vigência</th><th></th></tr></thead><tbody>
    ${l.map(i => { const emp = soma(empenhosDe(i.id)); const d = i.fim ? diasAte(i.fim) : null; return `<tr>
      <td><b>${esc(i.numero || '—')}</b><div class="m">${esc(nomePerfil(i.perfil))}</div></td>
      <td>${esc(i.objeto || '—')}<div class="m">${esc(i.orgao || '')}</div></td>
      <td class="num">${brl(num(i.valor), 0)}</td><td class="num">${brl(emp, 0)}</td><td class="num"><b>${brl(num(i.valor) - emp, 0)}</b></td>
      <td>${dataBR(i.inicio)} a ${dataBR(i.fim)}${d != null ? `<br><span class="badge ${d < 0 ? '' : d <= 30 ? 'soon' : 'ok'}">${d < 0 ? 'encerrado' : `${d} dia(s)`}</span>` : ''}</td>
      <td class="ui-acoes"><button class="btn-ghost" data-editar="${esc(i.id)}">Editar</button></td></tr>`; }).join('')}
  </tbody></table></div>`;
}

function tabelaEmpenhos(l) {
  const inst = idv => pos.itens.find(i => i.id === idv);
  return `<div class="tscroll"><table class="ui-tabela"><thead><tr><th>Nº empenho</th><th>Vinculado a</th><th class="num">Valor</th><th class="num">Entregue</th><th class="num">Pago</th><th>Prazo de entrega</th><th></th></tr></thead><tbody>
    ${l.map(e => { const d = e.prazo ? diasAte(e.prazo) : null; const ent = entregue(e), pg = pago(e); return `<tr>
      <td><b>${esc(e.numero || '—')}</b><div class="m">emitido ${dataBR(e.inicio)}</div></td>
      <td>${esc(inst(e.vinculo)?.numero ? `${TIPOS[inst(e.vinculo).tipo].split(' ')[0]} ${inst(e.vinculo).numero}` : e.orgao || '—')}<div class="m">${esc(e.objeto || inst(e.vinculo)?.orgao || '')}</div></td>
      <td class="num">${brl(num(e.valor))}</td><td class="num">${brl(ent)}</td><td class="num">${brl(pg)}${ent - pg > 0.009 ? `<div class="pz-medio">falta receber ${brl(ent - pg)}</div>` : ''}</td>
      <td>${dataBR(e.prazo)}${d != null && ent < num(e.valor) ? `<br><span class="badge ${d < 0 ? 'hot' : d <= 5 ? 'soon' : 'ok'}">${d < 0 ? `atrasado ${-d}d` : `${d} dia(s)`}</span>` : ''}</td>
      <td class="ui-acoes"><button class="btn-ghost" data-mov="entregas" data-id="${esc(e.id)}">+ Entrega</button><button class="btn-ghost" data-mov="pagamentos" data-id="${esc(e.id)}">+ Pagamento</button><button class="btn-ghost" data-editar="${esc(e.id)}">Editar</button></td></tr>
      ${[...(e.entregas || []).map(x => ['📦 Entrega', x]), ...(e.pagamentos || []).map(x => ['💰 Pagamento', x])].sort((a, b) => (a[1].data || '').localeCompare(b[1].data || '')).map(([t, x]) => `<tr class="ui-sublinha"><td></td><td colspan="6" class="m">${t} ${dataBR(x.data)} · ${brl(num(x.valor))}${x.descricao ? ' · ' + esc(x.descricao) : ''}</td></tr>`).join('')}`; }).join('')}
  </tbody></table></div>`;
}

async function editar(i) {
  const instrumentos = pos.itens.filter(x => x.tipo !== 'empenho' && (!i.perfil || x.perfil === i.perfil));
  const campos = [
    { k: 'perfil', rot: 'Empresa', tipo: 'select', opcoes: estado.perfis.map(p => [p.id, p.nome]) },
    { k: 'numero', rot: i.tipo === 'empenho' ? 'Nº do empenho / OF' : i.tipo === 'ata' ? 'Nº da ata' : 'Nº do contrato', req: true },
    ...(i.tipo === 'empenho' ? [{ k: 'vinculo', rot: 'Vinculado à ata/contrato', tipo: 'select', opcoes: [['', '— nenhum —'], ...instrumentos.map(x => [x.id, `${x.numero} · ${(x.objeto || '').slice(0, 50)}`])] }] : [{ k: 'card', rot: 'Licitação do Kanban', tipo: 'select', opcoes: opcoesCards(i.perfil) }]),
    { k: 'orgao', rot: 'Órgão' },
    { k: 'objeto', rot: 'Objeto', largo: true },
    { k: 'valor', rot: 'Valor (R$)', tipo: 'number' },
    { k: 'inicio', rot: i.tipo === 'empenho' ? 'Emitido em' : 'Início da vigência', tipo: 'date', padrao: hojeISO() },
    i.tipo === 'empenho' ? { k: 'prazo', rot: 'Prazo de entrega', tipo: 'date' } : { k: 'fim', rot: 'Fim da vigência', tipo: 'date' },
    { k: 'obs', rot: 'Observações', tipo: 'area', linhas: 2, largo: true },
  ];
  const r = await formulario(`${i.id ? 'Editar' : 'Novo(a)'} ${TIPOS[i.tipo].toLowerCase()}`, campos, i, { apagar: !!i.id });
  if (!r) return;
  const lista = r.apagar ? pos.itens.filter(x => x.id !== i.id)
    : i.id ? pos.itens.map(x => x.id === i.id ? { ...x, ...r } : x) : [...pos.itens, { ...i, ...r, id: id(), entregas: [], pagamentos: [] }];
  if (await pos.salvar(lista)) { desenhar(); window.dispatchEvent(new CustomEvent('avisos-mudaram')); }
}

async function movimento(idEmp, campo) {
  const r = await formulario(campo === 'entregas' ? 'Registrar entrega' : 'Registrar pagamento recebido', [
    { k: 'data', rot: 'Data', tipo: 'date', padrao: hojeISO() },
    { k: 'valor', rot: 'Valor (R$)', tipo: 'number', req: true },
    { k: 'descricao', rot: campo === 'entregas' ? 'O que foi entregue / nota fiscal' : 'Observação', largo: true },
  ]);
  if (!r) return;
  const lista = pos.itens.map(e => e.id === idEmp ? { ...e, [campo]: [...(e[campo] || []), r] } : e);
  if (await pos.salvar(lista)) desenhar();
}

v = registrarAba('poslicitacao', '📑 Pós-licitação', async () => {
  if (!pos.pronto) { v.innerHTML = '<p class="empty">Carregando…</p>'; await pos.carregar(); }
  desenhar();
});
window.addEventListener('dados-prontos', () => { pos.carregar().then(() => window.dispatchEvent(new CustomEvent('avisos-mudaram'))); });
