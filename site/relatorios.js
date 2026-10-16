// Relatórios: resultado das licitações acompanhadas no Kanban por período e por empresa,
// com motivos de perda, comparativo entre empresas, comentário e versão para PDF (imprimir).
import { registrarAba, estado, COLUNAS, dadosCarregados } from './app.js';
import { carregar, salvar, id } from './loja.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const brl = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pct = v => isFinite(v) ? (v * 100).toFixed(1).replace('.', ',') + '%' : '—';
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
const iso = d => new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);

let comentarios = [];
const PARTICIPOU = new Set(['proposta', 'aguardando', 'ganhou', 'perdeu']);

// Data em que o card chegou à coluna atual (para resultados) e data de entrada no Kanban (para captação).
const dataResultado = c => new Date([...(c.historico || [])].reverse().find(h => h.coluna === c.coluna)?.em || c.criadoEm);

function calcular(cards, ini, fim) {
  const noPeriodo = d => d >= ini && d <= fim;
  const captadas = cards.filter(c => noPeriodo(new Date(c.criadoEm)));
  const comResultado = cards.filter(c => ['ganhou', 'perdeu', 'desistiu'].includes(c.coluna) && noPeriodo(dataResultado(c)));
  const ganhas = comResultado.filter(c => c.coluna === 'ganhou');
  const perdidas = comResultado.filter(c => c.coluna === 'perdeu');
  const desistiu = comResultado.filter(c => c.coluna === 'desistiu');
  const participou = captadas.filter(c => PARTICIPOU.has(c.coluna) || (c.historico || []).some(h => PARTICIPOU.has(h.coluna)));
  const aguardando = captadas.filter(c => ['captada', 'analise', 'proposta', 'aguardando'].includes(c.coluna));
  const motivos = {};
  for (const c of [...perdidas, ...desistiu]) { const k = (c.motivo || 'Sem motivo informado').trim(); motivos[k] = (motivos[k] || 0) + 1; }
  return {
    captadas, participou, ganhas, perdidas, desistiu, aguardando, comResultado,
    exito: ganhas.length / (ganhas.length + perdidas.length),
    estimado: captadas.reduce((s, c) => s + (Number(c.valor) || 0), 0),
    propostas: participou.reduce((s, c) => s + (Number(c.valorProposta) || 0), 0),
    conquistado: ganhas.reduce((s, c) => s + (Number(c.valorFinal || c.valorProposta) || 0), 0),
    motivos: Object.entries(motivos).sort((a, b) => b[1] - a[1]),
    fluxo: COLUNAS.map(col => [col, captadas.filter(c => c.coluna === col.id).length]),
  };
}

function desenhar() {
  const v = $('#ap-relatorios');
  const hoje = new Date();
  const ini = store.get('pregoes.relIni') || iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const fim = store.get('pregoes.relFim') || iso(hoje);
  const perfilId = store.get('pregoes.relPerfil') || '';
  const dIni = new Date(ini + 'T00:00'), dFim = new Date(fim + 'T23:59:59');
  const cards = estado.kanban.filter(c => !perfilId || c.perfil === perfilId);
  const r = calcular(cards, dIni, dFim);
  const perfil = estado.perfis.find(p => p.id === perfilId);
  const chaveComent = `${perfilId}|${ini}|${fim}`;
  const coment = comentarios.find(c => c.chave === chaveComent)?.texto || '';
  const maxFluxo = Math.max(1, ...r.fluxo.map(f => f[1]));
  const maxMot = Math.max(1, ...r.motivos.map(m => m[1]));

  v.innerHTML = `<div class="card ap-pad rel">
    <div class="ap-topo rel-nao-imprime"><div><h2>Relatórios</h2><p class="m">Resultados das licitações do Kanban por período e empresa. Para mandar ao cliente, escolha só a empresa dele.</p></div>
      <div class="ap-acoes"><button class="btn-primary" id="relPdf">🖨️ Gerar PDF</button></div></div>
    <div class="rel-filtros rel-nao-imprime">
      <label>Empresa<select id="relPerfil"><option value="">Todas as empresas (consolidado)</option>${estado.perfis.map(p => `<option value="${esc(p.id)}" ${p.id === perfilId ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></label>
      <label>De<input type="date" id="relIni" value="${ini}"></label><label>Até<input type="date" id="relFim" value="${fim}"></label>
      <span class="rel-atalhos"><button class="btn-ghost" data-per="mes">Este mês</button><button class="btn-ghost" data-per="30">30 dias</button><button class="btn-ghost" data-per="ano">Este ano</button></span>
    </div>
    <div class="rel-cab-impressao">${perfil?.logo ? `<img src="${perfil.logo}" alt="">` : ''}<div><b>Relatório de licitações · ${esc(perfil?.razao || perfil?.nome || 'Todas as empresas')}</b><br><span class="m">Período: ${new Date(ini + 'T12:00').toLocaleDateString('pt-BR')} a ${new Date(fim + 'T12:00').toLocaleDateString('pt-BR')} · emitido em ${hoje.toLocaleDateString('pt-BR')}</span></div></div>
    <div class="kpis rel-kpis">
      ${[['Captadas', r.captadas.length, 'entraram no Kanban'], ['Participações', r.participou.length, r.captadas.length ? pct(r.participou.length / r.captadas.length) + ' das captadas' : '—'],
         ['Vitórias', r.ganhas.length, ''], ['Perdas', r.perdidas.length, `${r.desistiu.length} desistência(s)`],
         ['Em andamento', r.aguardando.length, 'ainda sem resultado'], ['Taxa de êxito', pct(r.exito), 'vitórias ÷ (vitórias + perdas)'],
         ['Valor estimado captado', brl(r.estimado), ''], ['Valor das propostas', brl(r.propostas), ''], ['Valor conquistado', brl(r.conquistado), 'das vitórias']]
        .map(([l, val, h]) => `<div class="card kpi"><div class="l">${l}</div><div class="v">${val}</div><div class="h">${h}</div></div>`).join('')}
    </div>
    <div class="grid">
      <div class="card chart"><h2>Situação das captadas</h2><p class="why">Onde estão hoje as licitações captadas no período.</p>
        ${r.captadas.length ? r.fluxo.map(([col, n]) => `<div class="hbar"><span class="n">${col.nome}</span><span class="t"><i style="width:${n / maxFluxo * 100}%;background:${col.cor}"></i></span><span class="x">${n}</span></div>`).join('') : '<div class="empty">Nenhuma licitação captada no período.</div>'}</div>
      <div class="card chart"><h2>Motivos de perda e desistência</h2><p class="why">Preencha o motivo no card do Kanban para aparecer aqui.</p>
        ${r.motivos.length ? r.motivos.map(([m, n]) => `<div class="hbar"><span class="n" title="${esc(m)}">${esc(m)}</span><span class="t"><i style="width:${n / maxMot * 100}%"></i></span><span class="x">${n}</span></div>`).join('') : '<div class="empty">Nenhum motivo registrado.</div>'}</div>
    </div>
    ${perfilId ? '' : `<div class="card ap-pad rel-bloco"><h2>Comparativo por empresa</h2><div class="tscroll"><table><thead><tr><th>Empresa</th><th class="num">Captadas</th><th class="num">Participou</th><th class="num">Vitórias</th><th class="num">Perdas</th><th class="num">Conquistado</th><th class="num">Êxito</th></tr></thead><tbody>
      ${[...estado.perfis, { id: '', nome: 'Sem empresa' }].map(p => { const x = calcular(estado.kanban.filter(c => (c.perfil || '') === p.id), dIni, dFim); return x.captadas.length || x.comResultado.length ? `<tr><td>${esc(p.nome)}</td><td class="num">${x.captadas.length}</td><td class="num">${x.participou.length}</td><td class="num">${x.ganhas.length}</td><td class="num">${x.perdidas.length}</td><td class="num">${brl(x.conquistado)}</td><td class="num">${pct(x.exito)}</td></tr>` : ''; }).join('') || '<tr><td colspan="7" class="empty">Sem dados no período.</td></tr>'}
    </tbody></table></div></div>`}
    <div class="card ap-pad rel-bloco"><h2>Resultados registrados</h2>
      ${r.comResultado.length ? `<div class="tscroll"><table><thead><tr><th>Data</th><th>Objeto</th><th>Órgão</th><th>Resultado</th><th class="num">Proposta</th><th class="num">Final</th><th>Motivo</th></tr></thead><tbody>
        ${r.comResultado.sort((a, b) => dataResultado(b) - dataResultado(a)).map(c => `<tr><td>${dataResultado(c).toLocaleDateString('pt-BR')}</td><td>${esc(c.objeto.slice(0, 90))}</td><td>${esc(c.orgao)}<div class="m">${esc(c.cidade)}/${esc(c.uf)}</div></td><td>${COLUNAS.find(x => x.id === c.coluna).nome}</td><td class="num">${c.valorProposta ? brl(c.valorProposta) : '—'}</td><td class="num">${c.valorFinal ? brl(c.valorFinal) : '—'}</td><td>${esc(c.motivo || '')}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">Nenhum resultado no período. Mova os cards do Kanban para Ganhou, Perdeu ou Desistiu e informe os valores.</p>'}
    </div>
    <div class="card ap-pad rel-bloco"><h2>Comentário do assessor</h2>
      <textarea id="relComent" rows="4" class="rel-nao-imprime" placeholder="Contextualize resultados, perdas e próximos passos. Vai junto no PDF.">${esc(coment)}</textarea>
      <div class="rel-coment-imp">${esc(coment).replace(/\n/g, '<br>') || '<span class="m">—</span>'}</div>
      <div class="rel-nao-imprime"><button class="btn-ghost" id="relSalvaComent">Salvar comentário</button> <span class="m" id="relMsg"></span></div>
    </div>
    <p class="m">Captação usa a data de entrada no Kanban; resultados usam a data em que o card foi para Ganhou, Perdeu ou Desistiu.</p>
  </div>`;

  const atual = () => { store.set('pregoes.relIni', $('#relIni').value); store.set('pregoes.relFim', $('#relFim').value); store.set('pregoes.relPerfil', $('#relPerfil').value); desenhar(); };
  $('#relPerfil').onchange = atual; $('#relIni').onchange = atual; $('#relFim').onchange = atual;
  v.querySelectorAll('[data-per]').forEach(b => b.onclick = () => {
    const h = new Date();
    const i = b.dataset.per === 'mes' ? new Date(h.getFullYear(), h.getMonth(), 1) : b.dataset.per === 'ano' ? new Date(h.getFullYear(), 0, 1) : new Date(+h - 30 * 864e5);
    $('#relIni').value = iso(i); $('#relFim').value = iso(h); atual();
  });
  $('#relPdf').onclick = () => { document.body.classList.add('imprimindo-relatorio'); window.print(); };
  $('#relSalvaComent').onclick = async () => {
    const texto = $('#relComent').value.trim();
    const lista = comentarios.filter(c => c.chave !== chaveComent);
    if (texto) lista.push({ id: id(), chave: chaveComent, texto, em: new Date().toISOString() });
    try { comentarios = await salvar('relatorios', lista); $('#relMsg').textContent = 'Salvo.'; desenhar(); }
    catch (err) { if (err.conflito) comentarios = err.itens; $('#relMsg').textContent = 'Não salvou: ' + err.message; }
  };
}
window.addEventListener('afterprint', () => document.body.classList.remove('imprimindo-relatorio'));

registrarAba('relatorios', '📊 Relatórios', desenhar);
async function iniciar() {
  try { comentarios = await carregar('relatorios'); } catch {}
  if (store.get('pregoes.aba') === 'relatorios') desenhar();
}
if (dadosCarregados()) iniciar(); else window.addEventListener('dados-prontos', iniciar, { once: true });
