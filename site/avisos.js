// Sino de avisos e menu lateral. Junta o que precisa de atenção em todas as telas:
// encerramentos próximos do Kanban, certidões vencendo, prazos jurídicos, entregas e vigências,
// e pregões novos dos órgãos e palavras vigiados.
import { estado } from './app.js';
import { $, esc, dataBR, diasAte, store } from './ui.js';
import { certidoes, situacaoCert, nomeCert } from './documentos.js';
import { pos, vigente } from './poslicitacao.js';
import { juridico, prazoDe } from './juridico.js';
import { monit, pregoesDo } from './monitoramento.js';

const ATIVAS = new Set(['captada', 'analise', 'proposta', 'aguardando']);
const ABERTAS = new Set(['Documentos pendentes', 'Em análise', 'Minuta gerada', 'Em revisão', 'Aprovado']);

function coletar() {
  const a = [];
  for (const c of estado.kanban) {
    if (!ATIVAS.has(c.coluna) || !c.encerramento) continue;
    const h = (new Date(c.encerramento) - Date.now()) / 36e5;
    if (h > 0 && h <= 48) a.push({ nivel: 'hot', aba: 'kanban', txt: `Encerra em ${Math.max(1, Math.round(h))}h: ${c.objeto}`, sub: c.orgao });
  }
  for (const c of certidoes.itens) {
    const s = situacaoCert(c);
    if (s.cls !== 'ok') a.push({ nivel: s.cls, aba: 'documentos', txt: `${nomeCert(c)}: ${s.txt}`, sub: estado.perfis.find(p => p.id === c.perfil)?.nome });
  }
  for (const j of juridico.itens) {
    const pz = prazoDe(j);
    if (!pz || !ABERTAS.has(j.situacao)) continue;
    const d = diasAte(pz);
    if (d <= 3) a.push({ nivel: d < 0 ? 'hot' : d <= 1 ? 'hot' : 'soon', aba: 'juridico', txt: `${d < 0 ? 'Prazo vencido' : d === 0 ? 'Prazo vence hoje' : `Prazo em ${d} dia(s)`}: ${j.titulo || j.tipo}`, sub: dataBR(pz) });
  }
  for (const i of pos.itens) {
    if (i.tipo === 'empenho') {
      const ent = (i.entregas || []).reduce((s, x) => s + (Number(x.valor) || 0), 0);
      if (i.prazo && ent < (Number(i.valor) || 0)) { const d = diasAte(i.prazo); if (d <= 5) a.push({ nivel: d < 0 ? 'hot' : 'soon', aba: 'poslicitacao', txt: `${d < 0 ? 'Entrega atrasada' : d === 0 ? 'Entrega vence hoje' : `Entrega em ${d} dia(s)`}: empenho ${i.numero}`, sub: i.orgao }); }
    } else if (i.fim && vigente(i) && diasAte(i.fim) <= 30) {
      a.push({ nivel: 'soon', aba: 'poslicitacao', txt: `${i.tipo === 'ata' ? 'Ata' : 'Contrato'} ${i.numero} termina em ${diasAte(i.fim)} dia(s)`, sub: i.orgao });
    }
  }
  const vistos = JSON.parse(store.get('pregoes.monVistos') || '{}');
  for (const m of monit.itens) {
    if (m.tipo === 'concorrente') continue;
    const novos = pregoesDo(m).filter(r => !(vistos[m.id] || []).includes(r.id)).length;
    if (novos) a.push({ nivel: 'novo', aba: 'monitoramento', txt: `${novos} pregão(ões) aberto(s) de "${m.nome || m.valor}"`, sub: 'Monitoramento' });
  }
  const ordem = { hot: 0, soon: 1, novo: 2 };
  return a.sort((x, y) => ordem[x.nivel] - ordem[y.nivel]);
}

function montar() {
  const header = $('header.top');
  if (!header || $('#avSino')) return;
  const alvo = header.lastElementChild || header; // a caixa de botões do topo (Agentes IA, Tema…)
  const b = document.createElement('button');
  b.id = 'avSino'; b.type = 'button'; b.className = 'btn-ghost av-sino'; b.title = 'Avisos';
  b.innerHTML = '🔔<span class="av-cont" id="avCont"></span>';
  alvo.prepend(b);
  const painel = document.createElement('div');
  painel.id = 'avPainel'; painel.className = 'card av-painel'; painel.hidden = true;
  document.body.append(painel);
  b.onclick = e => { e.stopPropagation(); painel.hidden = !painel.hidden; if (!painel.hidden) desenharPainel(); };
  document.addEventListener('click', e => { if (!painel.hidden && !painel.contains(e.target)) painel.hidden = true; });
}

function desenharPainel() {
  const a = coletar(), p = $('#avPainel');
  p.innerHTML = `<div class="ap-topo"><b>Avisos</b><span class="m">${a.length} item(ns)</span></div>
    ${a.length ? a.slice(0, 40).map((x, i) => `<button class="av-item av-${x.nivel}" data-i="${i}"><span>${esc(x.txt)}</span>${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</button>`).join('')
      : '<p class="m">Nada pedindo atenção agora. 🎉</p>'}`;
  p.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { p.hidden = true; window.irParaAba(a[b.dataset.i].aba); });
}

function atualizar() {
  const n = coletar().length;
  const el = $('#avCont'); if (el) el.textContent = n ? (n > 9 ? '9+' : n) : '';
  if ($('#avPainel') && !$('#avPainel').hidden) desenharPainel();
}

// Menu lateral: a barra de abas vira um menu à esquerda em telas largas (com botão para recolher).
function separarIcones(nav) {
  nav.querySelectorAll('button[data-aba]:not([data-sep])').forEach(b => {
    b.dataset.sep = '1';
    const t = b.firstChild;
    if (t?.nodeType !== 3) return;
    const [ico, ...resto] = t.textContent.trim().split(' ');
    const i = document.createElement('span'); i.className = 'av-ico'; i.textContent = ico;
    const r = document.createElement('span'); r.className = 'av-rot'; r.textContent = ' ' + resto.join(' ') + ' ';
    b.title = resto.join(' ');
    t.replaceWith(i, r);
  });
}

function menuLateral() {
  const nav = $('.ap-abas');
  if (nav) separarIcones(nav);
  if (!nav || nav.dataset.lateral) return;
  nav.dataset.lateral = '1';
  const topo = document.createElement('div');
  topo.className = 'av-menu-topo';
  topo.innerHTML = '<span class="av-marca">🏛️ <b>Painel de Pregões</b></span><button type="button" class="av-recolher" title="Recolher menu">«</button>';
  nav.prepend(topo);
  const recolhido = () => document.body.classList.contains('menu-recolhido');
  const aplicar = r => { document.body.classList.toggle('menu-recolhido', r); topo.querySelector('.av-recolher').textContent = r ? '»' : '«'; store.set('pregoes.menuRecolhido', r ? '1' : ''); };
  topo.querySelector('.av-recolher').onclick = () => aplicar(!recolhido());
  aplicar(store.get('pregoes.menuRecolhido') === '1');
  document.body.classList.add('com-menu');
}

montar();
window.addEventListener('dados-prontos', () => { menuLateral(); atualizar(); });
setTimeout(menuLateral, 0);
for (const ev of ['avisos-mudaram', 'dados-alterados']) window.addEventListener(ev, atualizar);
setInterval(atualizar, 5 * 60000);
