// Agenda: prazos oficiais (encerramento dos pregões do Kanban) entram sozinhos; tarefas e
// compromissos são do usuário. Tem cadastro rápido em linguagem natural e lembretes no navegador.
import { registrarAba, estado, COLUNAS, dadosCarregados } from './app.js';
import { carregar, salvar, id } from './loja.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
const DIAS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const TIPOS = {
  prazo: { nome: 'Prazo oficial', cor: '#2563eb' },
  oportunidade: { nome: 'Oportunidade do perfil', cor: '#0d9488' },
  compromisso: { nome: 'Compromisso', cor: '#16a34a' },
  tarefa: { nome: 'Tarefa', cor: '#a16207' },
};
const ATIVAS = new Set(['captada', 'analise', 'proposta', 'aguardando']);

let itens = [], carregado = false;
let mes = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })();
let modo = store.get('pregoes.agendaModo') || 'mes';

const diaChave = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hora = d => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

// Todos os eventos do período: os do usuário + os automáticos.
function eventos(ini, fim) {
  const filtroPerfil = store.get('pregoes.agendaPerfil') || '';
  const tipos = new Set(JSON.parse(store.get('pregoes.agendaTipos') || '["prazo","compromisso","tarefa"]'));
  const out = [];
  for (const e of itens) out.push({ ...e, data: new Date(e.inicio) });
  for (const c of estado.kanban) {
    if (!c.encerramento || !ATIVAS.has(c.coluna)) continue;
    out.push({ id: 'k-' + c.id, tipo: 'prazo', titulo: `Encerramento: ${c.objeto}`, inicio: c.encerramento, data: new Date(c.encerramento), perfil: c.perfil, cardId: c.id, pncp: c.pncp, sub: `${c.orgao} · ${c.cidade}/${c.uf} · ${COLUNAS.find(x => x.id === c.coluna)?.nome}` });
  }
  if (tipos.has('oportunidade') && window.filtroPerfil && window.painel) {
    const noKanban = new Set(estado.kanban.map(c => c.pncp));
    for (const r of window.painel.registros()) {
      if (!r.enc || r.enc < ini || r.enc > fim || noKanban.has(r.id) || !window.filtroPerfil(r)) continue;
      out.push({ id: 'o-' + r.id, tipo: 'oportunidade', titulo: r.obj, inicio: r.enc.toISOString(), data: r.enc, pncp: r.id, sub: `${r.org} · ${r.mun}/${r.uf}` });
    }
  }
  return out.filter(e => e.data >= ini && e.data <= fim && tipos.has(e.tipo) && (!filtroPerfil || !e.perfil || e.perfil === filtroPerfil))
    .sort((a, b) => a.data - b.data);
}

function chip(e) {
  const t = TIPOS[e.tipo];
  return `<button type="button" class="ag-ev ${e.feito ? 'feito' : ''}" data-ev="${esc(e.id)}" style="--cor:${t.cor}" title="${esc(t.nome)}: ${esc(e.titulo)}${e.sub ? '\n' + esc(e.sub) : ''}">
    ${e.diaInteiro ? '' : `<b>${hora(e.data)}</b> `}${e.tipo === 'tarefa' ? (e.feito ? '☑ ' : '☐ ') : ''}${esc(e.titulo)}</button>`;
}

function desenhar() {
  const v = $('#ap-agenda');
  if (!carregado) { v.innerHTML = '<p class="empty">Carregando agenda…</p>'; return; }
  const tipos = new Set(JSON.parse(store.get('pregoes.agendaTipos') || '["prazo","compromisso","tarefa"]'));
  const filtroPerfil = store.get('pregoes.agendaPerfil') || '';
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const prox7 = eventos(new Date(), new Date(+hoje + 8 * 864e5)).filter(e => !e.feito);
  v.innerHTML = `<div class="card ap-pad">
    <div class="ap-topo"><div><h2>Agenda</h2><p class="m">Os encerramentos dos pregões do Kanban entram sozinhos. Use tarefas e compromissos para organizar o resto.</p></div>
      <div class="ap-acoes"><button class="btn-ghost" id="agLembrete">${'Notification' in window && Notification.permission === 'granted' ? '🔔 Lembretes ativos' : '🔔 Ativar lembretes'}</button>
        <button class="btn-primary" id="agNovo">+ Adicionar</button></div></div>
    <form class="ag-rapido" id="agRapido"><span>⚡ Cadastro rápido</span><input id="agTexto" placeholder="Ex.: revisar proposta amanhã às 14h · reunião com fornecedor sexta 10h30 · enviar documentos dia 25"><button class="btn-ghost">Conferir</button></form>
    <div class="ag-boletim"><b>Próximos 7 dias:</b> ${prox7.length ? prox7.slice(0, 6).map(e => `<span class="ag-bol-item" style="--cor:${TIPOS[e.tipo].cor}">${e.data.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })} ${e.diaInteiro ? '' : hora(e.data)} · ${esc(e.titulo.slice(0, 60))}</span>`).join('') + (prox7.length > 6 ? `<span class="m">+${prox7.length - 6}</span>` : '') : '<span class="m">nada marcado.</span>'}</div>
    <div class="ag-barra">
      <button class="btn-ghost" id="agAnt" aria-label="Mês anterior">‹</button><button class="btn-ghost" id="agHoje">Hoje</button><button class="btn-ghost" id="agProx" aria-label="Próximo mês">›</button>
      <b class="ag-mes">${mes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</b>
      <span class="ag-modos"><button class="btn-ghost ${modo === 'mes' ? 'ativo' : ''}" data-modo="mes">Mês</button><button class="btn-ghost ${modo === 'lista' ? 'ativo' : ''}" data-modo="lista">Lista</button></span>
      <select id="agPerfil"><option value="">Todas as empresas</option>${estado.perfis.map(p => `<option value="${esc(p.id)}" ${p.id === filtroPerfil ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select>
      <span class="ag-tipos">${Object.entries(TIPOS).map(([k, t]) => `<label style="--cor:${t.cor}"><input type="checkbox" value="${k}" ${tipos.has(k) ? 'checked' : ''}>${t.nome}</label>`).join('')}</span>
    </div>
    <div id="agCorpo"></div>
  </div>`;
  if (modo === 'mes') desenharMes(); else desenharLista();
  $('#agAnt').onclick = () => { mes = new Date(mes.getFullYear(), mes.getMonth() - 1, 1); desenhar(); };
  $('#agProx').onclick = () => { mes = new Date(mes.getFullYear(), mes.getMonth() + 1, 1); desenhar(); };
  $('#agHoje').onclick = () => { const d = new Date(); mes = new Date(d.getFullYear(), d.getMonth(), 1); desenhar(); };
  v.querySelectorAll('[data-modo]').forEach(b => b.onclick = () => { modo = b.dataset.modo; store.set('pregoes.agendaModo', modo); desenhar(); });
  $('#agPerfil').onchange = e => { store.set('pregoes.agendaPerfil', e.target.value); desenhar(); };
  v.querySelectorAll('.ag-tipos input').forEach(c => c.onchange = () => { store.set('pregoes.agendaTipos', JSON.stringify([...v.querySelectorAll('.ag-tipos input:checked')].map(x => x.value))); desenhar(); });
  $('#agNovo').onclick = () => editar({ tipo: 'tarefa', inicio: new Date(Date.now() + 36e5).toISOString() });
  $('#agLembrete').onclick = ativarLembretes;
  $('#agRapido').onsubmit = e => {
    e.preventDefault();
    const txt = $('#agTexto').value.trim(); if (!txt) return;
    editar({ ...interpretar(txt), deTexto: txt }); // abre para conferir: nada é salvo antes
  };
}

function desenharMes() {
  const corpo = $('#agCorpo');
  const ini = new Date(mes); ini.setDate(1 - ((ini.getDay() + 6) % 7)); // começa na segunda
  const fim = new Date(+ini + 42 * 864e5);
  const evs = eventos(ini, fim);
  const porDia = {};
  for (const e of evs) (porDia[diaChave(e.data)] ||= []).push(e);
  const hoje = diaChave(new Date());
  let html = '<div class="ag-grade">' + ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'].map(d => `<div class="ag-sem">${d}</div>`).join('');
  for (let i = 0; i < 42; i++) {
    const d = new Date(+ini + i * 864e5), k = diaChave(d), lista = porDia[k] || [];
    html += `<div class="ag-dia ${d.getMonth() !== mes.getMonth() ? 'fora' : ''} ${k === hoje ? 'hoje' : ''}" data-dia="${k}">
      <div class="ag-num"><span>${d.getDate()}</span><button type="button" class="ag-mais" title="Adicionar neste dia">+</button></div>
      ${lista.slice(0, 4).map(chip).join('')}${lista.length > 4 ? `<button type="button" class="ag-ver" data-ver="${k}">+${lista.length - 4} mais</button>` : ''}</div>`;
  }
  corpo.innerHTML = html + '</div>' + legenda(evs.length);
  ligar(corpo, evs);
}

function desenharLista() {
  const corpo = $('#agCorpo');
  const ini = new Date(mes), fim = new Date(mes.getFullYear(), mes.getMonth() + 1, 0, 23, 59, 59);
  const evs = eventos(ini, fim);
  const porDia = {};
  for (const e of evs) (porDia[diaChave(e.data)] ||= []).push(e);
  corpo.innerHTML = (Object.keys(porDia).length ? Object.entries(porDia).map(([k, lista]) => `<div class="ag-lista-dia"><h3>${new Date(k + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</h3>
      ${lista.map(e => `<div class="ag-lista-ev">${chip(e)}${e.sub ? `<div class="m">${esc(e.sub)}</div>` : ''}${e.notas ? `<div class="m">📝 ${esc(e.notas)}</div>` : ''}</div>`).join('')}</div>`).join('')
    : '<p class="empty">Nada marcado neste mês.</p>') + legenda(evs.length);
  ligar(corpo, evs);
}

const legenda = n => `<div class="ag-legenda">${Object.values(TIPOS).map(t => `<span style="--cor:${t.cor}">${t.nome}</span>`).join('')}<span class="m">Horário de Brasília · ${n} registro(s)</span></div>`;

function ligar(corpo, evs) {
  corpo.querySelectorAll('[data-ev]').forEach(b => b.onclick = ev => {
    ev.stopPropagation();
    const e = evs.find(x => x.id === b.dataset.ev);
    if (e.tipo === 'prazo' || e.tipo === 'oportunidade') {
      if (e.pncp && window.painel?.abrir(e.pncp)) return;
      if (e.cardId) window.irParaAba('kanban');
    } else editar(itens.find(x => x.id === e.id));
  });
  corpo.querySelectorAll('.ag-mais').forEach(b => b.onclick = ev => {
    ev.stopPropagation();
    const d = new Date(b.closest('[data-dia]').dataset.dia + 'T09:00');
    editar({ tipo: 'tarefa', inicio: d.toISOString() });
  });
  corpo.querySelectorAll('[data-ver]').forEach(b => b.onclick = () => { modo = 'lista'; store.set('pregoes.agendaModo', modo); desenhar(); });
}

// ---------- cadastro e edição ----------
function editar(e) {
  const novo = !e.id;
  const dt = new Date(e.inicio || Date.now());
  const local = new Date(dt - dt.getTimezoneOffset() * 6e4).toISOString();
  const dlg = document.createElement('dialog');
  dlg.className = 'ap-dialog';
  dlg.innerHTML = `<form class="ap-form">
    <div class="ap-topo"><h2>${novo ? (e.deTexto ? 'Conferir antes de salvar' : 'Adicionar à agenda') : 'Editar'}</h2><button type="button" class="btn-ghost ag-x">Fechar ✕</button></div>
    ${e.deTexto ? `<p class="ap-largo m">Entendi assim a frase "<i>${esc(e.deTexto)}</i>". Ajuste se precisar.</p>` : ''}
    <label>Tipo<select name="tipo"><option value="tarefa" ${e.tipo === 'tarefa' ? 'selected' : ''}>Tarefa</option><option value="compromisso" ${e.tipo === 'compromisso' ? 'selected' : ''}>Compromisso</option></select></label>
    <label>Empresa<select name="perfil"><option value="">Pessoal / geral</option>${estado.perfis.map(p => `<option value="${esc(p.id)}" ${p.id === e.perfil ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></label>
    <label class="ap-largo">Título *<input name="titulo" required value="${esc(e.titulo || '')}"></label>
    <label>Data<input type="date" name="data" required value="${local.slice(0, 10)}"></label>
    <label>Hora<input type="time" name="hora" value="${e.diaInteiro ? '' : local.slice(11, 16)}"> <span class="m">vazio = dia inteiro</span></label>
    <label>Licitação do Kanban (opcional)<select name="cardId"><option value="">—</option>${estado.kanban.filter(c => ATIVAS.has(c.coluna)).map(c => `<option value="${esc(c.id)}" ${c.id === e.cardId ? 'selected' : ''}>${esc(c.objeto.slice(0, 70))}</option>`).join('')}</select></label>
    <label>Lembrar<select name="lembrar">${[['', 'Não lembrar'], ['15', '15 min antes'], ['60', '1 hora antes'], ['1440', '1 dia antes']].map(([v, n]) => `<option value="${v}" ${String(e.lembrarMin ?? (novo ? '60' : '')) === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <label class="ap-largo">Notas<textarea name="notas" rows="3">${esc(e.notas || '')}</textarea></label>
    ${novo ? '' : `<label class="ap-chk ap-largo"><input type="checkbox" name="feito" ${e.feito ? 'checked' : ''}> Concluída</label>`}
    <div class="ap-rodape">${novo ? '<span></span>' : '<button type="button" class="btn-ghost ap-perigo ag-apagar">Apagar</button>'}<button class="btn-primary">Salvar</button></div>
  </form>`;
  document.body.append(dlg); dlg.showModal();
  const fechar = () => { dlg.close(); dlg.remove(); };
  $('.ag-x', dlg).onclick = fechar;
  $('.ag-apagar', dlg)?.addEventListener('click', async () => {
    if (!confirm('Apagar este registro da agenda?')) return;
    await gravar(itens.filter(x => x.id !== e.id)); fechar();
  });
  $('form', dlg).onsubmit = async ev => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const h = fd.get('hora');
    const reg = {
      id: e.id || id(), tipo: fd.get('tipo'), titulo: fd.get('titulo').trim(), perfil: fd.get('perfil'), cardId: fd.get('cardId'),
      inicio: new Date(`${fd.get('data')}T${h || '09:00'}`).toISOString(), diaInteiro: !h, notas: fd.get('notas').trim(),
      lembrarMin: fd.get('lembrar') ? Number(fd.get('lembrar')) : null, feito: fd.get('feito') === 'on', criadoEm: e.criadoEm || new Date().toISOString(),
    };
    await gravar(novo ? [...itens, reg] : itens.map(x => x.id === e.id ? reg : x));
    if (e.deTexto) $('#agTexto') && ($('#agTexto').value = '');
    fechar();
  };
}

async function gravar(lista) {
  try { itens = await salvar('agenda', lista); }
  catch (err) { if (err.conflito) itens = err.itens; alert('Não consegui salvar: ' + err.message); }
  desenhar();
}

// ---------- cadastro rápido: entende datas e horas em português ----------
export function interpretar(txt, agora = new Date()) {
  let t = ' ' + norm(txt) + ' ';
  const tirar = re => { const m = t.match(re); if (m) t = t.replace(m[0], ' '); return m; };
  const base = new Date(agora); base.setHours(9, 0, 0, 0);
  let data = null, temHora = false;
  let m;
  if (tirar(/\bdepois de amanha\b/)) data = new Date(+base + 2 * 864e5);
  else if (tirar(/\bamanha\b/)) data = new Date(+base + 864e5);
  else if (tirar(/\bhoje\b/)) data = new Date(base);
  else if ((m = tirar(/\bem (\d{1,2}) dias?\b/))) data = new Date(+base + m[1] * 864e5);
  else if ((m = tirar(/\b(?:dia )?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) {
    const ano = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : base.getFullYear();
    data = new Date(ano, m[2] - 1, +m[1], 9);
    if (!m[3] && data < base) data.setFullYear(ano + 1);
  } else if ((m = tirar(/\bdia (\d{1,2})\b/))) {
    data = new Date(base.getFullYear(), base.getMonth(), +m[1], 9);
    if (data < base) data.setMonth(data.getMonth() + 1);
  } else {
    const semana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    m = tirar(/\b(?:na |no |proxima |proximo )?(domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:-feira| feira)?\b/);
    if (m) { const alvo = semana.indexOf(m[1]); let dif = (alvo - base.getDay() + 7) % 7; if (dif === 0) dif = 7; data = new Date(+base + dif * 864e5); }
  }
  data = data || new Date(base);
  if ((m = tirar(/\b(?:as |a |às )?(\d{1,2})(?::|h)(\d{2})\b/))) { data.setHours(+m[1], +m[2]); temHora = true; }
  else if ((m = tirar(/\b(?:as |a )?(\d{1,2}) ?h(?:oras?)?\b/))) { data.setHours(+m[1], 0); temHora = true; }
  else if ((m = tirar(/\bas (\d{1,2})\b/))) { data.setHours(+m[1], 0); temHora = true; }
  const tipo = /\b(reuniao|visita|compromisso|audiencia|sessao|encontro|almoco|call|ligacao)\b/.test(norm(txt)) ? 'compromisso' : 'tarefa';
  // Título: a frase original sem os pedaços de data e hora.
  const palavrasRestantes = new Set(t.split(/\s+/).filter(Boolean));
  let titulo = txt.split(/\s+/).filter(w => palavrasRestantes.has(norm(w))).join(' ').replace(/\s+(as|às|a|no|na|em|dia|de)$/i, '').trim();
  titulo = titulo ? titulo[0].toUpperCase() + titulo.slice(1) : txt;
  return { tipo, titulo, inicio: data.toISOString(), diaInteiro: !temHora };
}
window.__interpretar = interpretar; // usado no teste

// ---------- lembretes ----------
async function ativarLembretes() {
  if (!('Notification' in window)) return alert('Este navegador não mostra notificações.');
  const p = await Notification.requestPermission();
  alert(p === 'granted' ? 'Lembretes ativos: o navegador avisa enquanto o painel estiver aberto (pode ser numa aba em segundo plano).' : 'O navegador não liberou as notificações.');
  desenhar();
}

function verificarLembretes() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const avisados = new Set(JSON.parse(store.get('pregoes.agendaAvisados') || '[]'));
  const agora = Date.now();
  const lista = [...itens.filter(e => e.lembrarMin && !e.feito).map(e => ({ chave: e.id + e.inicio, quando: new Date(e.inicio) - e.lembrarMin * 6e4, inicio: new Date(e.inicio), titulo: e.titulo })),
    ...estado.kanban.filter(c => c.encerramento && ATIVAS.has(c.coluna)).map(c => ({ chave: 'k' + c.id + c.encerramento, quando: new Date(c.encerramento) - 1440 * 6e4, inicio: new Date(c.encerramento), titulo: 'Encerra amanhã: ' + c.objeto }))];
  for (const l of lista) {
    if (avisados.has(l.chave) || agora < l.quando || agora > +l.inicio) continue;
    new Notification('Agenda de licitações', { body: `${l.inicio.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · ${l.titulo.slice(0, 140)}`, tag: l.chave });
    avisados.add(l.chave);
  }
  store.set('pregoes.agendaAvisados', JSON.stringify([...avisados].slice(-500)));
}

// ---------- início ----------
registrarAba('agenda', '📅 Agenda', desenhar);
async function iniciar() {
  try { itens = await carregar('agenda'); } catch {}
  carregado = true;
  if (store.get('pregoes.aba') === 'agenda') desenhar();
  verificarLembretes();
  setInterval(verificarLembretes, 60000);
}
if (dadosCarregados()) iniciar(); else window.addEventListener('dados-prontos', iniciar, { once: true });
document.addEventListener('visibilitychange', async () => {
  if (document.hidden || !carregado) return;
  try { itens = await carregar('agenda'); if (store.get('pregoes.aba') === 'agenda') desenhar(); } catch {}
});
