// Abas do painel (Busca, Kanban, Perfis), perfis de empresa e Kanban de licitações.
import { carregar, salvar, id, descobrirModo, definirSenha } from './loja.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const brl = v => v == null || v === '' || isNaN(v) ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtDT = s => s ? new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const UFS = 'AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' ');
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };

export const COLUNAS = [
  { id: 'captada', nome: 'Captada', cor: '#6b7280' },
  { id: 'analise', nome: 'Em análise', cor: '#2563eb' },
  { id: 'proposta', nome: 'Proposta / disputa', cor: '#a16207' },
  { id: 'aguardando', nome: 'Aguardando resultado', cor: '#7c3aed' },
  { id: 'ganhou', nome: 'Ganhou', cor: '#15803d' },
  { id: 'perdeu', nome: 'Perdeu', cor: '#b91c1c' },
  { id: 'desistiu', nome: 'Desistiu', cor: '#9ca3af' },
];

let perfis = [], kanban = [], aba = store.get('pregoes.aba') || 'busca';

// ---------- perfil ativo (vale para a busca, os itens e a proposta) ----------
export const termosDe = p => (p?.termos || '').split(/\n|,/).map(t => t.trim()).filter(Boolean);
export function perfilAtivo() { return perfis.find(p => p.id === store.get('pregoes.perfilAtivo')) || null; }
window.perfilAtivo = perfilAtivo;
window.termosDoPerfil = () => termosDe(perfilAtivo());

function aplicarPerfil() {
  const p = perfilAtivo();
  if (!p) { window.filtroPerfil = null; }
  else {
    const termos = termosDe(p).map(norm), excluir = (p.excluir || '').split(/\n|,/).map(t => norm(t.trim())).filter(Boolean);
    const ufs = new Set(p.ufs || []), mods = new Set((p.modalidades || []).map(Number)), cidades = (p.cidades || '').split(/\n|,/).map(t => norm(t.trim())).filter(Boolean);
    window.filtroPerfil = r =>
      (!termos.length || termos.some(t => r.objN.includes(t))) &&
      (!excluir.length || !excluir.some(t => r.objN.includes(t))) &&
      (!ufs.size || ufs.has(r.uf)) &&
      (!mods.size || mods.has(r.mod)) &&
      (!cidades.length || cidades.some(c => norm(r.mun).includes(c)));
  }
  window.painel?.render?.();
  desenharSeletor();
}

function desenharSeletor() {
  let box = $('#apPerfilBox');
  const form = $('#f');
  if (!form) return;
  if (!box) {
    box = document.createElement('label');
    box.id = 'apPerfilBox';
    box.innerHTML = 'Perfil de busca <select id="apPerfil"></select>';
    form.prepend(box);
    box.querySelector('select').onchange = e => { store.set('pregoes.perfilAtivo', e.target.value); aplicarPerfil(); };
  }
  const sel = $('#apPerfil'), atual = store.get('pregoes.perfilAtivo') || '';
  sel.innerHTML = '<option value="">Sem perfil (busca manual)</option>' + perfis.map(p => `<option value="${esc(p.id)}" ${p.id === atual ? 'selected' : ''}>${esc(p.nome)}</option>`).join('');
}

// ---------- abas ----------
function montarAbas() {
  const header = $('header.top');
  const nav = document.createElement('nav');
  nav.className = 'ap-abas';
  nav.innerHTML = `<button data-aba="busca">🔎 Busca</button><button data-aba="kanban">🗂️ Kanban <span class="ap-cont" id="apContKanban"></span></button><button data-aba="perfis">🏢 Perfis de empresa</button>`;
  header.after(nav);
  nav.querySelectorAll('button').forEach(b => b.onclick = () => irPara(b.dataset.aba));
  const vk = document.createElement('section'); vk.id = 'apKanban'; vk.className = 'ap-view';
  const vp = document.createElement('section'); vp.id = 'apPerfis'; vp.className = 'ap-view';
  nav.after(vk, vp);
}

function irPara(a) {
  aba = a; store.set('pregoes.aba', a);
  document.querySelectorAll('.ap-abas button').forEach(b => b.classList.toggle('ativa', b.dataset.aba === a));
  // Na aba Busca aparece o painel de sempre; nas outras, só a tela da aba.
  [...document.querySelectorAll('.wrap > *')].forEach(el => {
    if (el.matches('header.top, .ap-abas')) return;
    if (el.id === 'apKanban') el.hidden = a !== 'kanban';
    else if (el.id === 'apPerfis') el.hidden = a !== 'perfis';
    else el.hidden = a !== 'busca';
  });
  if (a === 'kanban') desenharKanban();
  if (a === 'perfis') desenharPerfis();
  window.scrollTo(0, 0);
}
window.irParaAba = irPara;

// ---------- perfis de empresa ----------
const MODALIDADES = { 6: 'Pregão eletrônico', 7: 'Pregão presencial' };
const CAMPOS_EMPRESA = [
  ['razao', 'Razão social'], ['cnpj', 'CNPJ'], ['porte', 'Porte', ['', 'ME', 'EPP', 'Demais']], ['ie', 'Inscrição estadual'], ['im', 'Inscrição municipal'],
  ['telefone', 'Telefone'], ['email', 'E-mail'], ['endereco', 'Endereço completo', null, true], ['cidade', 'Cidade'], ['uf', 'UF', ['', ...UFS]], ['cep', 'CEP'],
];
const CAMPOS_REPRES = [['repNome', 'Nome completo'], ['repCargo', 'Cargo'], ['repCpf', 'CPF'], ['repRg', 'RG']];
const CAMPOS_BANCO = [['banco', 'Banco'], ['agencia', 'Agência'], ['conta', 'Conta'], ['pix', 'Chave PIX']];
const CAMPOS_PROPOSTA = [['validade', 'Validade da proposta', null, false, '60 (sessenta) dias'], ['prazoEntrega', 'Prazo de entrega', null, false, 'Conforme edital'], ['pagamento', 'Condições de pagamento', null, false, 'Conforme edital']];

function campo([k, rotulo, opcoes, largo, ph], p) {
  const v = esc(p[k] || '');
  const input = opcoes
    ? `<select name="${k}">${opcoes.map(o => `<option ${o === (p[k] || '') ? 'selected' : ''}>${o}</option>`).join('')}</select>`
    : `<input name="${k}" value="${v}" placeholder="${esc(ph || '')}">`;
  return `<label class="${largo ? 'ap-largo' : ''}">${rotulo}${input}</label>`;
}

function desenharPerfis(editando = null) {
  const v = $('#apPerfis');
  if (editando) return formularioPerfil(editando);
  v.innerHTML = `<div class="card ap-pad">
    <div class="ap-topo"><div><h2>Perfis de empresa</h2><p class="m">Cada perfil é uma empresa (ou cliente): termos de busca, filtros e os dados que vão nas propostas.</p></div>
      <button class="btn-primary" id="apNovoPerfil">+ Novo perfil</button></div>
    ${perfis.length ? `<div class="ap-perfis">${perfis.map(p => `
      <div class="ap-perfil-card">
        ${p.logo ? `<img src="${p.logo}" alt="">` : '<div class="ap-logo-vazio">🏢</div>'}
        <div class="ap-perfil-info"><b>${esc(p.nome)}</b><div class="m">${esc(p.razao || 'Dados da empresa não preenchidos')}${p.cnpj ? ' · ' + esc(p.cnpj) : ''}</div>
          <div class="m">${termosDe(p).length} termo(s)${(p.ufs || []).length ? ' · ' + p.ufs.join(', ') : ' · Brasil inteiro'}</div></div>
        <div class="ap-acoes"><button class="btn-ghost" data-usar="${esc(p.id)}">Usar na busca</button><button class="btn-ghost" data-editar="${esc(p.id)}">Editar</button></div>
      </div>`).join('')}</div>`
      : '<p class="empty">Nenhum perfil ainda. Crie o primeiro para filtrar a busca pelos seus produtos e gerar propostas com os dados da empresa.</p>'}
  </div>`;
  $('#apNovoPerfil').onclick = () => formularioPerfil({ id: '', nome: '', termos: '', ufs: [], modalidades: [] });
  v.querySelectorAll('[data-editar]').forEach(b => b.onclick = () => formularioPerfil(perfis.find(p => p.id === b.dataset.editar)));
  v.querySelectorAll('[data-usar]').forEach(b => b.onclick = () => { store.set('pregoes.perfilAtivo', b.dataset.usar); aplicarPerfil(); irPara('busca'); });
}

function formularioPerfil(p) {
  const v = $('#apPerfis');
  v.innerHTML = `<form class="card ap-pad ap-form" id="apFormPerfil">
    <div class="ap-topo"><h2>${p.id ? 'Editar perfil' : 'Novo perfil'}</h2><button type="button" class="btn-ghost" id="apVoltar">← Voltar</button></div>
    <fieldset><legend>Busca</legend>
      <label class="ap-largo">Nome do perfil *<input name="nome" required value="${esc(p.nome)}" placeholder="Ex.: Minha empresa – informática"></label>
      <label class="ap-largo">Termos de busca (um por linha)<textarea name="termos" rows="5" placeholder="notebook&#10;computador&#10;monitor">${esc(p.termos || '')}</textarea></label>
      <label class="ap-largo">Excluir pregões com estas palavras (uma por linha)<textarea name="excluir" rows="2" placeholder="locação&#10;manutenção">${esc(p.excluir || '')}</textarea></label>
      <div class="ap-largo"><span class="ap-rot">Estados (vazio = Brasil inteiro)</span><div class="ap-ufs">${UFS.map(u => `<label class="ap-chk"><input type="checkbox" name="ufs" value="${u}" ${(p.ufs || []).includes(u) ? 'checked' : ''}>${u}</label>`).join('')}</div></div>
      <div class="ap-largo"><span class="ap-rot">Modalidades (vazio = todas)</span>${Object.entries(MODALIDADES).map(([k, n]) => `<label class="ap-chk"><input type="checkbox" name="modalidades" value="${k}" ${(p.modalidades || []).map(String).includes(k) ? 'checked' : ''}>${n}</label>`).join('')}</div>
      <label class="ap-largo">Cidades (uma por linha, vazio = todas)<textarea name="cidades" rows="2" placeholder="Novo Hamburgo&#10;São Leopoldo">${esc(p.cidades || '')}</textarea></label>
    </fieldset>
    <fieldset><legend>Dados da empresa (vão na proposta)</legend>
      <label class="ap-largo">Logo (para o timbre da proposta)<input type="file" accept="image/png,image/jpeg" id="apLogo">
        <span class="ap-logo-prev">${p.logo ? `<img src="${p.logo}" alt=""> <button type="button" class="btn-ghost" id="apTiraLogo">Remover logo</button>` : ''}</span></label>
      ${CAMPOS_EMPRESA.map(c => campo(c, p)).join('')}
    </fieldset>
    <fieldset><legend>Representante legal (assina a proposta)</legend>${CAMPOS_REPRES.map(c => campo(c, p)).join('')}</fieldset>
    <fieldset><legend>Dados bancários</legend>${CAMPOS_BANCO.map(c => campo(c, p)).join('')}</fieldset>
    <fieldset><legend>Padrões da proposta</legend>${CAMPOS_PROPOSTA.map(c => campo(c, p)).join('')}</fieldset>
    <div class="ap-rodape">
      ${p.id ? '<button type="button" class="btn-ghost ap-perigo" id="apApagar">Apagar perfil</button>' : '<span></span>'}
      <span class="m" id="apMsg"></span>
      <button class="btn-primary" type="submit">Salvar perfil</button>
    </div>
  </form>`;
  let logo = p.logo || '';
  $('#apVoltar').onclick = () => desenharPerfis();
  $('#apTiraLogo')?.addEventListener('click', () => { logo = ''; v.querySelector('.ap-logo-prev').innerHTML = ''; });
  $('#apLogo').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    logo = await reduzirImagem(f, 500);
    v.querySelector('.ap-logo-prev').innerHTML = `<img src="${logo}" alt="">`;
  };
  $('#apApagar')?.addEventListener('click', async () => {
    if (!confirm(`Apagar o perfil "${p.nome}"? Os cards do Kanban continuam, só perdem a ligação com o perfil.`)) return;
    try { perfis = await salvar('perfis', perfis.filter(x => x.id !== p.id)); aplicarPerfil(); desenharPerfis(); }
    catch (err) { erroSalvar(err, 'perfis'); }
  });
  $('#apFormPerfil').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const novo = { ...p, id: p.id || id(), logo, atualizadoEm: new Date().toISOString() };
    for (const [k] of [...CAMPOS_EMPRESA, ...CAMPOS_REPRES, ...CAMPOS_BANCO, ...CAMPOS_PROPOSTA]) novo[k] = (fd.get(k) || '').trim();
    for (const k of ['nome', 'termos', 'excluir', 'cidades']) novo[k] = (fd.get(k) || '').trim();
    novo.ufs = fd.getAll('ufs'); novo.modalidades = fd.getAll('modalidades').map(Number);
    const lista = p.id ? perfis.map(x => x.id === p.id ? novo : x) : [...perfis, novo];
    $('#apMsg').textContent = 'Salvando…';
    try {
      perfis = await salvar('perfis', lista);
      if (!store.get('pregoes.perfilAtivo')) store.set('pregoes.perfilAtivo', novo.id);
      aplicarPerfil(); desenharPerfis();
    } catch (err) { erroSalvar(err, 'perfis'); $('#apMsg').textContent = ''; }
  };
}

function reduzirImagem(file, max) {
  return new Promise((ok, falha) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      ok(c.toDataURL('image/png'));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => falha(new Error('imagem inválida'));
    img.src = URL.createObjectURL(file);
  });
}

function erroSalvar(err, nome) {
  if (err.conflito) { if (nome === 'perfis') perfis = err.itens; else kanban = err.itens; aplicarPerfil(); if (aba === 'kanban') desenharKanban(); }
  alert('Não consegui salvar: ' + err.message);
}

// ---------- Kanban ----------
function encBadge(en) {
  if (!en) return '';
  const h = (new Date(en) - Date.now()) / 36e5;
  if (h <= 0) return '<span class="badge">encerrado</span>';
  if (h < 48) return `<span class="badge hot">${h < 24 ? Math.max(1, Math.round(h)) + 'h' : '1 dia'}</span>`;
  const d = Math.round(h / 24);
  return `<span class="badge ${d <= 7 ? 'soon' : 'ok'}">${d} dias</span>`;
}

function contarKanban() {
  const n = kanban.filter(c => !['ganhou', 'perdeu', 'desistiu'].includes(c.coluna)).length;
  const el = $('#apContKanban'); if (el) el.textContent = n ? n : '';
}

export async function adicionarAoKanban(r, perfilId) {
  if (kanban.some(c => c.pncp === r.id)) return false;
  const card = {
    id: id(), pncp: r.id, coluna: 'captada', perfil: perfilId ?? perfilAtivo()?.id ?? '',
    objeto: r.obj, orgao: r.org, cidade: r.mun, uf: r.uf, valor: r.val, encerramento: r.raw?.dataEncerramentoProposta || (r.enc && r.enc.toISOString()),
    link: `https://pncp.gov.br/app/editais/${r.cnpj}/${r.raw?.anoCompra}/${r.raw?.sequencialCompra}`, numero: r.raw?.numeroCompra,
    criadoEm: new Date().toISOString(), historico: [{ em: new Date().toISOString(), coluna: 'captada' }], notas: '',
  };
  try { kanban = await salvar('kanban', [...kanban, card]); contarKanban(); return true; }
  catch (err) { erroSalvar(err, 'kanban'); return false; }
}
export const cardDoPregao = idPncp => kanban.find(c => c.pncp === idPncp);

async function moverCard(idCard, coluna) {
  const lista = kanban.map(c => c.id === idCard && c.coluna !== coluna
    ? { ...c, coluna, historico: [...(c.historico || []), { em: new Date().toISOString(), coluna }] } : c);
  try { kanban = await salvar('kanban', lista); } catch (err) { erroSalvar(err, 'kanban'); }
  desenharKanban(); contarKanban();
}

function desenharKanban() {
  const v = $('#apKanban');
  const filtro = store.get('pregoes.kanbanPerfil') || '';
  const cards = kanban.filter(c => !filtro || c.perfil === filtro);
  const nomePerfil = idp => perfis.find(p => p.id === idp)?.nome || '';
  v.innerHTML = `<div class="ap-topo ap-pad-x">
      <div><h2>Kanban</h2><p class="m">${cards.length} licitação(ões) acompanhada(s). Arraste os cards entre as colunas ou use o seletor do card.</p></div>
      <div class="ap-acoes">
        <select id="apKFiltro"><option value="">Todas as empresas</option>${perfis.map(p => `<option value="${esc(p.id)}" ${p.id === filtro ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select>
        <button class="btn-ghost" id="apKManual">+ Adicionar manual</button>
      </div></div>
    <div class="ap-board">${COLUNAS.map(col => {
      const doCol = cards.filter(c => c.coluna === col.id).sort((a, b) => new Date(a.encerramento || 8.64e15) - new Date(b.encerramento || 8.64e15));
      const soma = doCol.reduce((s, c) => s + (Number(c.valorFinal || c.valorProposta || c.valor) || 0), 0);
      return `<div class="ap-col" data-col="${col.id}"><div class="ap-col-topo" style="--cor:${col.cor}"><b>${col.nome}</b><span>${doCol.length}${soma ? ' · ' + brl(soma) : ''}</span></div>
        <div class="ap-col-cards">${doCol.map(c => cardHtml(c, nomePerfil(c.perfil))).join('') || '<div class="ap-vazio">—</div>'}</div></div>`;
    }).join('')}</div>`;
  $('#apKFiltro').onchange = e => { store.set('pregoes.kanbanPerfil', e.target.value); desenharKanban(); };
  $('#apKManual').onclick = () => editarCard(null);
  v.querySelectorAll('.ap-card').forEach(el => {
    el.draggable = true;
    el.ondragstart = e => { e.dataTransfer.setData('text/plain', el.dataset.id); el.classList.add('arrastando'); };
    el.ondragend = () => el.classList.remove('arrastando');
    el.querySelector('.ap-mover').onchange = e => moverCard(el.dataset.id, e.target.value);
    el.querySelector('.ap-abrir').onclick = () => abrirCard(kanban.find(c => c.id === el.dataset.id));
    el.querySelector('.ap-editar').onclick = () => editarCard(kanban.find(c => c.id === el.dataset.id));
  });
  v.querySelectorAll('.ap-col').forEach(col => {
    col.ondragover = e => { e.preventDefault(); col.classList.add('sobre'); };
    col.ondragleave = () => col.classList.remove('sobre');
    col.ondrop = e => { e.preventDefault(); col.classList.remove('sobre'); moverCard(e.dataTransfer.getData('text/plain'), col.dataset.col); };
  });
}

function cardHtml(c, perfilNome) {
  const fim = ['ganhou', 'perdeu', 'desistiu'].includes(c.coluna);
  return `<div class="ap-card" data-id="${esc(c.id)}">
    <div class="ap-card-obj">${esc(c.objeto)}</div>
    <div class="m">${esc(c.orgao)} · ${esc(c.cidade)}/${esc(c.uf)}</div>
    <div class="ap-card-meta">${fim ? '' : encBadge(c.encerramento)}<span>${brl(c.valorFinal || c.valorProposta || c.valor)}</span>${perfilNome ? `<span class="ap-tag">${esc(perfilNome)}</span>` : ''}</div>
    ${c.notas ? `<div class="ap-card-nota">📝 ${esc(c.notas.slice(0, 120))}</div>` : ''}
    ${c.coluna === 'perdeu' && c.motivo ? `<div class="ap-card-nota">Motivo: ${esc(c.motivo)}</div>` : ''}
    <div class="ap-card-acoes"><select class="ap-mover" title="Mover para">${COLUNAS.map(col => `<option value="${col.id}" ${col.id === c.coluna ? 'selected' : ''}>${col.nome}</option>`).join('')}</select>
      <button class="btn-ghost ap-abrir" title="Abrir a licitação">Abrir</button><button class="btn-ghost ap-editar" title="Notas, valores e resultado">Editar</button></div>
  </div>`;
}

function abrirCard(c) {
  if (c.pncp && window.painel?.abrir(c.pncp)) return;
  if (c.link) window.open(c.link, '_blank', 'noopener');
}

function editarCard(c) {
  const novo = !c;
  c = c || { id: '', coluna: 'captada', perfil: perfilAtivo()?.id || '', objeto: '', orgao: '', cidade: '', uf: '', valor: '', encerramento: '', link: '', notas: '' };
  const dlg = document.createElement('dialog');
  dlg.className = 'ap-dialog';
  const dtLocal = s => { if (!s) return ''; const d = new Date(s); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); };
  dlg.innerHTML = `<form method="dialog" class="ap-form">
    <div class="ap-topo"><h2>${novo ? 'Adicionar licitação manualmente' : 'Card do Kanban'}</h2><button type="button" class="btn-ghost" value="x" id="apKFechar">Fechar ✕</button></div>
    <label class="ap-largo">Objeto *<textarea name="objeto" rows="2" required>${esc(c.objeto)}</textarea></label>
    <label>Órgão<input name="orgao" value="${esc(c.orgao)}"></label>
    <label>Número do edital<input name="numero" value="${esc(c.numero || '')}"></label>
    <label>Cidade<input name="cidade" value="${esc(c.cidade)}"></label>
    <label>UF<select name="uf">${['', ...UFS].map(u => `<option ${u === c.uf ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
    <label>Encerramento<input type="datetime-local" name="encerramento" value="${dtLocal(c.encerramento)}"></label>
    <label>Valor estimado (R$)<input type="number" step="0.01" name="valor" value="${esc(c.valor ?? '')}"></label>
    <label class="ap-largo">Link do edital ou portal<input name="link" value="${esc(c.link)}"></label>
    <label>Empresa (perfil)<select name="perfil"><option value="">—</option>${perfis.map(p => `<option value="${esc(p.id)}" ${p.id === c.perfil ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></label>
    <label>Coluna<select name="coluna">${COLUNAS.map(col => `<option value="${col.id}" ${col.id === c.coluna ? 'selected' : ''}>${col.nome}</option>`).join('')}</select></label>
    <label>Valor da nossa proposta (R$)<input type="number" step="0.01" name="valorProposta" value="${esc(c.valorProposta ?? '')}"></label>
    <label>Valor final / adjudicado (R$)<input type="number" step="0.01" name="valorFinal" value="${esc(c.valorFinal ?? '')}"></label>
    <label class="ap-largo">Motivo da perda ou desistência<input name="motivo" value="${esc(c.motivo || '')}" placeholder="Ex.: preço acima do vencedor, documento vencido…"></label>
    <label class="ap-largo">Notas<textarea name="notas" rows="4">${esc(c.notas)}</textarea></label>
    ${c.historico?.length ? `<div class="ap-largo m">Histórico: ${c.historico.map(h => `${COLUNAS.find(x => x.id === h.coluna)?.nome || h.coluna} (${fmtDT(h.em)})`).join(' → ')}</div>` : ''}
    <div class="ap-rodape">${novo ? '<span></span>' : '<button type="button" class="btn-ghost ap-perigo" id="apKApagar">Tirar do Kanban</button>'}<button class="btn-primary" type="submit" value="ok">Salvar</button></div>
  </form>`;
  document.body.append(dlg);
  dlg.showModal();
  const fechar = () => { dlg.close(); dlg.remove(); };
  dlg.querySelector('#apKFechar').onclick = fechar;
  dlg.querySelector('#apKApagar')?.addEventListener('click', async () => {
    if (!confirm('Tirar esta licitação do Kanban?')) return;
    try { kanban = await salvar('kanban', kanban.filter(x => x.id !== c.id)); } catch (err) { erroSalvar(err, 'kanban'); }
    fechar(); desenharKanban(); contarKanban();
  });
  dlg.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const num = k => { const x = fd.get(k); return x === '' || x == null ? undefined : Number(x); };
    const enc = fd.get('encerramento');
    const dados = {
      ...c, id: c.id || id(), objeto: fd.get('objeto').trim(), orgao: fd.get('orgao').trim(), numero: fd.get('numero').trim(),
      cidade: fd.get('cidade').trim(), uf: fd.get('uf'), encerramento: enc ? new Date(enc).toISOString() : '', valor: num('valor'),
      link: fd.get('link').trim(), perfil: fd.get('perfil'), valorProposta: num('valorProposta'), valorFinal: num('valorFinal'),
      motivo: fd.get('motivo').trim(), notas: fd.get('notas').trim(), criadoEm: c.criadoEm || new Date().toISOString(),
    };
    const coluna = fd.get('coluna');
    if (coluna !== c.coluna || novo) dados.historico = [...(c.historico || []), { em: new Date().toISOString(), coluna }];
    dados.coluna = coluna;
    try { kanban = await salvar('kanban', novo ? [...kanban, dados] : kanban.map(x => x.id === c.id ? dados : x)); }
    catch (err) { erroSalvar(err, 'kanban'); }
    fechar(); desenharKanban(); contarKanban();
  };
}

// Botão "Kanban" no detalhe do pregão.
window.addEventListener('pregao-aberto', e => {
  const r = window.painel?.registros().find(x => x.id === e.detail);
  const links = document.querySelector('#drawer .links');
  if (!r || !links) return;
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'ap-btn-kanban';
  const pintar = () => { const c = cardDoPregao(r.id); b.textContent = c ? `✓ No Kanban: ${COLUNAS.find(x => x.id === c.coluna)?.nome}` : '➕ Adicionar ao Kanban'; };
  pintar();
  b.onclick = async () => {
    if (cardDoPregao(r.id)) { irPara('kanban'); document.getElementById('drawer').classList.remove('open'); document.getElementById('dbg').classList.remove('open'); return; }
    b.disabled = true; b.textContent = 'Salvando…';
    await adicionarAoKanban(r); b.disabled = false; pintar();
  };
  links.prepend(b);
});

// ---------- início ----------
async function iniciar() {
  montarAbas();
  const modo = await descobrirModo();
  if (modo === 'senha') {
    const s = prompt('Este aparelho precisa da senha do servidor para ver perfis e Kanban (ela aparece na janela do servidor):');
    if (s) definirSenha(s);
  }
  try { perfis = await carregar('perfis'); kanban = await carregar('kanban'); }
  catch (e) { if (e.message === 'senha') console.warn('Perfis e Kanban precisam da senha do servidor.'); else console.warn(e); }
  aplicarPerfil(); contarKanban(); irPara(aba);
  // Outro aparelho pode ter mexido: recarrega quando a aba volta a ficar visível.
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) return;
    try { perfis = await carregar('perfis'); kanban = await carregar('kanban'); aplicarPerfil(); contarKanban(); if (aba === 'kanban') desenharKanban(); } catch {}
  });
}
iniciar();
