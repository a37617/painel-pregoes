// Monitoramento: órgãos e palavras que você quer vigiar (pregões abertos que aparecem nos dados)
// e concorrentes por CNPJ (itens que eles ganharam, pelos dados abertos do Compras.gov).
import { registrarAba, estado } from './app.js';
import { $, $$, esc, brl, dataBR, hojeISO, colecao, formulario, seletorPerfil, perfilEscolhido, ligarSeletorPerfil, nomePerfil, store } from './ui.js';
import { id } from './loja.js';

export const monit = colecao('monitoramento');
const TIPOS = { orgao: '🏛️ Órgão', termo: '🔤 Palavra-chave', concorrente: '🥊 Concorrente' };
const soDig = s => String(s || '').replace(/\D/g, '');
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
let v;

// Pregões abertos (dos dados carregados no painel) que batem com um item vigiado.
export function pregoesDo(m) {
  const regs = window.painel?.registros?.() || [];
  const alvo = norm(m.valor), cnpj = soDig(m.valor);
  return regs.filter(r => r.encMs > 0 && (m.tipo === 'orgao'
    ? (cnpj.length === 14 ? r.cnpj === cnpj : norm(r.org).includes(alvo))
    : m.tipo === 'termo' ? r.objN.includes(alvo) : false));
}

function desenhar() {
  const perfilId = perfilEscolhido('pregoes.monPerfil');
  const lista = monit.itens.filter(m => !perfilId || !m.perfil || m.perfil === perfilId);
  const vistos = JSON.parse(store.get('pregoes.monVistos') || '{}');
  v.innerHTML = `<div class="ap-topo ap-pad-x"><div><h2>Monitoramento</h2><p class="m">Vigie órgãos e palavras-chave (novos pregões abertos) e acompanhe o que seus concorrentes ganham.</p></div>
      <span class="ap-acoes">${seletorPerfil('pregoes.monPerfil')}<button class="btn-primary" id="monNovo">+ Vigiar</button></span></div>
    ${lista.length ? `<div class="ui-cards">${lista.map(m => {
      const n = m.tipo === 'concorrente' ? null : pregoesDo(m);
      const novos = n ? n.filter(r => !(vistos[m.id] || []).includes(r.id)).length : 0;
      return `<div class="card ap-pad ui-mon">
        <div class="ap-topo"><div><span class="m">${TIPOS[m.tipo]}</span><h3>${esc(m.nome || m.valor)}</h3>${m.nome && m.nome !== m.valor ? `<div class="m">${esc(m.valor)}</div>` : ''}${m.perfil ? `<span class="ap-tag">${esc(nomePerfil(m.perfil))}</span>` : ''}</div>
          <button class="btn-ghost" data-editar="${esc(m.id)}">Editar</button></div>
        ${m.tipo === 'concorrente'
          ? `<button class="btn-ghost" data-conc="${esc(m.id)}">Ver itens ganhos nos últimos 12 meses</button><div class="ui-conc" id="conc-${esc(m.id)}"></div>`
          : `<p><b>${n.length}</b> pregão(ões) aberto(s)${novos ? ` · <span class="badge hot">${novos} novo(s)</span>` : ''}</p>
             ${n.slice(0, 5).map(r => `<a href="#" class="ui-preg" data-abrir="${esc(r.id)}" data-mon="${esc(m.id)}">${esc(r.obj.slice(0, 90))}<span class="m">${esc(r.mun)}/${esc(r.uf)} · ${brl(r.val, 0)} · encerra ${dataBR(r.enc?.toISOString?.() || '')}</span></a>`).join('')}
             ${n.length > 5 ? `<button class="btn-ghost" data-vertodos="${esc(m.id)}">Ver os ${n.length} na Busca</button>` : ''}`}
      </div>`; }).join('')}</div>`
      : '<div class="card ap-pad"><p class="empty">Nada sendo vigiado. Adicione órgãos que compram o que você vende, palavras-chave ou o CNPJ dos seus concorrentes.</p></div>'}
    <p class="m ui-nota">Acompanhar a sessão de disputa ao vivo (chat do pregoeiro) depende de cada portal de compras e não é feito por aqui.</p>`;
  ligarSeletorPerfil(v, desenhar);
  $('#monNovo').onclick = () => editar({ tipo: 'orgao', perfil: perfilId });
  $$('[data-editar]', v).forEach(b => b.onclick = () => editar(monit.itens.find(m => m.id === b.dataset.editar)));
  $$('[data-abrir]', v).forEach(a => a.onclick = e => {
    e.preventDefault();
    vistos[a.dataset.mon] = [...new Set([...(vistos[a.dataset.mon] || []), a.dataset.abrir])].slice(-500);
    store.set('pregoes.monVistos', JSON.stringify(vistos));
    window.dispatchEvent(new CustomEvent('avisos-mudaram'));
    window.painel?.abrir?.(a.dataset.abrir);
  });
  $$('[data-vertodos]', v).forEach(b => b.onclick = () => {
    const m = monit.itens.find(x => x.id === b.dataset.vertodos);
    window.painel?.aplicarFiltros?.({ q: m.tipo === 'termo' ? m.valor : (m.nome || m.valor) });
    window.irParaAba('busca');
  });
  $$('[data-conc]', v).forEach(b => b.onclick = () => concorrente(monit.itens.find(m => m.id === b.dataset.conc)));
}

async function concorrente(m) {
  const out = $('#conc-' + m.id);
  out.innerHTML = '<p class="m">Consultando o Compras.gov…</p>';
  const fim = hojeISO(), ini = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
  try {
    const r = await fetch(`api/gov/fornecedor?niFornecedor=${soDig(m.valor)}&dataResultadoPncpInicial=${ini}&dataResultadoPncpFinal=${fim}`);
    const d = await r.json();
    if (!r.ok) throw new Error(d.erro || 'HTTP ' + r.status);
    const l = d.resultado.sort((a, b) => (b.dataResultadoPncp || '').localeCompare(a.dataResultadoPncp || ''));
    if (!l.length) { out.innerHTML = '<p class="m">Nenhum item ganho nos últimos 12 meses (contratações da Lei 14.133 registradas no PNCP).</p>'; return; }
    const total = l.reduce((s, x) => s + (x.valorTotalHomologado || 0), 0);
    const porUf = {}; for (const x of l) porUf[x.unidadeOrgaoUfSigla || '—'] = (porUf[x.unidadeOrgaoUfSigla || '—'] || 0) + (x.valorTotalHomologado || 0);
    const link = c => { const mm = /^(\d{14})-\d-(\d+)\/(\d{4})$/.exec(c || ''); return mm ? `https://pncp.gov.br/app/editais/${mm[1]}/${mm[3]}/${Number(mm[2])}` : ''; };
    if (!m.nome && l[0].nomeRazaoSocialFornecedor) monit.salvar(monit.itens.map(x => x.id === m.id ? { ...x, nome: l[0].nomeRazaoSocialFornecedor } : x));
    out.innerHTML = `<p><b>${esc(l[0].nomeRazaoSocialFornecedor || '')}</b> ${l[0].porteFornecedorNome ? `(${esc(l[0].porteFornecedorNome)})` : ''}: <b>${d.total}</b> item(ns) ganho(s), ${brl(total, 0)} homologados${d.total > l.length ? ` (mostrando ${l.length})` : ''}.</p>
      <p class="m">Por UF: ${Object.entries(porUf).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([u, s]) => `<b>${esc(u)}</b> ${brl(s, 0)}`).join(' · ')}</p>
      <div class="tscroll"><table class="ui-tabela"><thead><tr><th>Data</th><th>Pregão</th><th class="num">Qtd.</th><th class="num">Unitário</th><th class="num">Total</th></tr></thead><tbody>
        ${l.slice(0, 50).map(x => `<tr><td>${dataBR(x.dataResultadoPncp)}</td><td>${link(x.idContratacaoPNCP) ? `<a href="${link(x.idContratacaoPNCP)}" target="_blank" rel="noopener">${esc(x.idContratacaoPNCP)} ↗</a>` : esc(x.idContratacaoPNCP || '—')} · item ${x.numeroItemPncp}<div class="m">${esc(x.unidadeOrgaoUfSigla || '')}</div></td>
          <td class="num">${(x.quantidadeHomologada || 0).toLocaleString('pt-BR')}</td><td class="num">${brl(x.valorUnitarioHomologado)}</td><td class="num">${brl(x.valorTotalHomologado)}</td></tr>`).join('')}
      </tbody></table></div>`;
  } catch (err) { out.innerHTML = `<p class="pz-ruim">Não deu certo: ${esc(err.message)}. Esta consulta usa o servidor do Wi-Fi.</p>`; }
}

async function editar(m) {
  const r = await formulario(m.id ? 'Editar monitoramento' : 'Vigiar', [
    { k: 'tipo', rot: 'O que vigiar', tipo: 'select', opcoes: Object.entries(TIPOS) },
    { k: 'valor', rot: 'CNPJ ou nome do órgão / palavra-chave / CNPJ do concorrente', req: true, largo: true, ph: 'Ex.: 88768080000170, Prefeitura de São Gabriel, notebook' },
    { k: 'nome', rot: 'Apelido (opcional)' },
    { k: 'perfil', rot: 'Empresa', tipo: 'select', opcoes: [['', 'Todas'], ...estado.perfis.map(p => [p.id, p.nome])] },
  ], m, { apagar: !!m.id });
  if (!r) return;
  if (r.tipo === 'concorrente' && soDig(r.valor).length < 11) return alert('Para concorrente, informe o CNPJ (só números ou com pontuação).');
  const lista = r.apagar ? monit.itens.filter(x => x.id !== m.id)
    : m.id ? monit.itens.map(x => x.id === m.id ? { ...x, ...r } : x) : [...monit.itens, { ...r, id: id(), criadoEm: new Date().toISOString() }];
  if (await monit.salvar(lista)) { desenhar(); window.dispatchEvent(new CustomEvent('avisos-mudaram')); }
}

v = registrarAba('monitoramento', '🔭 Monitoramento', async () => {
  if (!monit.pronto) { v.innerHTML = '<p class="empty">Carregando…</p>'; await monit.carregar(); }
  desenhar();
});
window.addEventListener('dados-prontos', () => { monit.carregar().then(() => window.dispatchEvent(new CustomEvent('avisos-mudaram'))); });
