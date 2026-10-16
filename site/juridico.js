// Jurídico: impugnações, pedidos de esclarecimento, recursos e contrarrazões, com prazo calculado
// pela Lei 14.133/2021 e minuta pronta (dados da empresa e da licitação) para revisar e protocolar.
import { registrarAba, estado } from './app.js';
import { $, $$, esc, dataBR, diasAte, diasUteis, hojeISO, colecao, formulario, seletorPerfil, perfilEscolhido, ligarSeletorPerfil, nomePerfil, opcoesCards, cardPorId, imprimir, store } from './ui.js';
import { timbre, assinatura } from './documentos.js';
import { id } from './loja.js';

export const juridico = colecao('juridico');
const SITUACOES = ['Documentos pendentes', 'Em análise', 'Minuta gerada', 'Em revisão', 'Aprovado', 'Protocolado', 'Encerrado'];
const ABERTAS = new Set(SITUACOES.slice(0, 5));
let v;

// Prazos (dias úteis). Impugnação e esclarecimento: até 3 dias úteis antes da abertura (art. 164).
// Recurso: 3 dias úteis da intimação/ata (art. 165, I). Contrarrazões: 3 dias úteis da intimação do recurso (art. 165, § 4º).
const TIPOS = {
  impugnacao: { nome: 'Impugnação ao edital', base: 'abertura', calc: d => diasUteis(d, -3), regra: 'até 3 dias úteis antes da abertura (art. 164)' },
  esclarecimento: { nome: 'Pedido de esclarecimento', base: 'abertura', calc: d => diasUteis(d, -3), regra: 'até 3 dias úteis antes da abertura (art. 164)' },
  recurso: { nome: 'Recurso administrativo', base: 'intimacao', calc: d => diasUteis(d, 3), regra: '3 dias úteis da intimação ou da lavratura da ata (art. 165, I)' },
  contrarrazoes: { nome: 'Contrarrazões', base: 'intimacao', calc: d => diasUteis(d, 3), regra: '3 dias úteis da intimação do recurso (art. 165, § 4º)' },
  defesa: { nome: 'Defesa em processo de sanção', base: 'intimacao', calc: d => diasUteis(d, 15), regra: '15 dias úteis da intimação (art. 157 e 158)' },
  outro: { nome: 'Outra demanda', base: '', calc: () => '', regra: 'prazo informado manualmente' },
};

export function prazoDe(j) { return j.prazo || (TIPOS[j.tipo]?.base && j[TIPOS[j.tipo].base] ? TIPOS[j.tipo].calc(j[TIPOS[j.tipo].base]) : ''); }

// Modelos de minuta (estrutura básica para o usuário completar os fundamentos do caso).
function minuta(j, p) {
  const c = cardPorId(j.card) || {};
  const ref = `${c.numero ? `Pregão nº ${c.numero}` : 'Pregão nº [Nº]'}${j.processo ? ` – Processo nº ${j.processo}` : ''}`;
  const orgao = j.orgao || c.orgao || '[ÓRGÃO]';
  const qualif = `${p.razao || p.nome || '[RAZÃO SOCIAL]'}, inscrita no CNPJ sob o nº ${p.cnpj || '[CNPJ]'}, com sede em ${[p.endereco, p.cidade && `${p.cidade}/${p.uf}`].filter(Boolean).join(', ') || '[ENDEREÇO]'}, neste ato representada por ${p.repNome || '[REPRESENTANTE]'}${p.repCpf ? `, CPF nº ${p.repCpf}` : ''}`;
  const fatos = j.fatos || '[Descreva os fatos: o que o edital ou a decisão diz, item e página.]';
  const pedido = j.pedido || '[Descreva o que se pede.]';
  const t = {
    impugnacao: ['IMPUGNAÇÃO AO EDITAL', `${qualif}, vem, tempestivamente, com fundamento no art. 164 da Lei nº 14.133/2021, apresentar IMPUGNAÇÃO AO EDITAL do ${ref}, pelas razões a seguir.`, `I – DOS FATOS\n${fatos}\n\nII – DO DIREITO\nA exigência impugnada restringe indevidamente a competitividade do certame, em afronta aos princípios da isonomia, da competitividade e da seleção da proposta mais vantajosa (art. 5º e art. 9º, I, da Lei nº 14.133/2021). [Complete com os fundamentos e jurisprudência aplicáveis.]\n\nIII – DO PEDIDO\nDiante do exposto, requer o recebimento e o provimento desta impugnação para ${pedido}, com a republicação do edital e a reabertura do prazo, nos termos do art. 55, § 1º, da Lei nº 14.133/2021.`],
    esclarecimento: ['PEDIDO DE ESCLARECIMENTO', `${qualif}, vem, com fundamento no art. 164 da Lei nº 14.133/2021, apresentar PEDIDO DE ESCLARECIMENTO referente ao ${ref}.`, `${fatos}\n\nDiante disso, solicita esclarecer: ${pedido}\n\nRequer que a resposta seja divulgada em sítio eletrônico oficial, nos termos do parágrafo único do art. 164.`],
    recurso: ['RECURSO ADMINISTRATIVO', `${qualif}, vem, tempestivamente, com fundamento no art. 165, I, da Lei nº 14.133/2021, interpor RECURSO ADMINISTRATIVO contra a decisão proferida no ${ref}, pelas razões a seguir.`, `I – DA TEMPESTIVIDADE\nO recurso é tempestivo, pois apresentado dentro do prazo de 3 (três) dias úteis contados da intimação.\n\nII – DOS FATOS\n${fatos}\n\nIII – DAS RAZÕES\n[Demonstre por que a decisão deve ser revista: vinculação ao edital, julgamento objetivo, formalismo moderado, diligências do art. 64.]\n\nIV – DO PEDIDO\nRequer o conhecimento e o provimento do recurso para ${pedido}. Caso não haja retratação, requer o encaminhamento à autoridade superior, nos termos do art. 165, § 2º.`],
    contrarrazoes: ['CONTRARRAZÕES AO RECURSO', `${qualif}, vem, tempestivamente, com fundamento no art. 165, § 4º, da Lei nº 14.133/2021, apresentar CONTRARRAZÕES ao recurso interposto no ${ref}.`, `I – DOS FATOS\n${fatos}\n\nII – DAS RAZÕES PARA MANTER A DECISÃO\n[Demonstre que a decisão recorrida está correta e que o recurso não deve prosperar.]\n\nIII – DO PEDIDO\nRequer seja negado provimento ao recurso, mantendo-se a decisão${pedido.startsWith('[') ? '' : `, ${pedido}`}.`],
    defesa: ['DEFESA PRÉVIA', `${qualif}, vem, tempestivamente, apresentar DEFESA no processo administrativo de apuração de responsabilidade relativo ao ${ref}.`, `I – DOS FATOS\n${fatos}\n\nII – DAS RAZÕES DE DEFESA\n[Apresente justificativas, provas e atenuantes, conforme o art. 156, § 1º, da Lei nº 14.133/2021.]\n\nIII – DO PEDIDO\nRequer ${pedido}.`],
    outro: [String(j.titulo || 'REQUERIMENTO').toUpperCase(), `${qualif}, vem respeitosamente apresentar o que segue, referente ao ${ref}.`, `${fatos}\n\nRequer ${pedido}`],
  }[j.tipo] || [];
  return { titulo: t[0], abertura: t[1], corpo: t[2], destino: `Ao(À) Agente de Contratação / Pregoeiro(a)\n${orgao}\nRef.: ${ref}` };
}

function desenhar() {
  const perfilId = perfilEscolhido('pregoes.jurPerfil');
  const busca = (store.get('pregoes.jurBusca') || '').toLowerCase();
  const sit = store.get('pregoes.jurSit') || '';
  const lista = juridico.itens.filter(j => (!perfilId || j.perfil === perfilId) && (!sit || j.situacao === sit)
    && (!busca || [j.titulo, j.orgao, j.processo, cardPorId(j.card)?.objeto].join(' ').toLowerCase().includes(busca)))
    .sort((a, b) => (prazoDe(a) || '9999').localeCompare(prazoDe(b) || '9999'));
  v.innerHTML = `<div class="ap-topo ap-pad-x"><div><h2>Jurídico</h2><p class="m">Impugnações, esclarecimentos, recursos e contrarrazões, com prazo da Lei 14.133 e minuta pronta.</p></div>
      <button class="btn-primary" id="jurNova">+ Nova demanda</button></div>
    <div class="card ap-pad ui-filtros">${seletorPerfil('pregoes.jurPerfil')}
      <label>Localizar<input id="jurBusca" value="${esc(busca)}" placeholder="Título, órgão, processo ou licitação"></label>
      <label>Situação<select id="jurSit"><option value="">Todas</option>${SITUACOES.map(s => `<option ${s === sit ? 'selected' : ''}>${s}</option>`).join('')}</select></label></div>
    <section class="card ap-pad">${lista.length ? `<div class="tscroll"><table class="ui-tabela"><thead><tr><th>Prazo</th><th>Demanda</th><th>Licitação</th><th>Situação</th><th></th></tr></thead><tbody>
      ${lista.map(j => { const pz = prazoDe(j), d = pz ? diasAte(pz) : null, aberta = ABERTAS.has(j.situacao); return `<tr>
        <td>${pz ? `${dataBR(pz)}<br>${aberta ? `<span class="badge ${d < 0 ? 'hot' : d <= 2 ? 'soon' : 'ok'}">${d < 0 ? 'prazo vencido' : d === 0 ? 'vence hoje' : `${d} dia(s)`}</span>` : ''}` : '—'}</td>
        <td><b>${esc(j.titulo || TIPOS[j.tipo]?.nome)}</b><div class="m">${esc(TIPOS[j.tipo]?.nome || '')} · ${esc(nomePerfil(j.perfil))}</div></td>
        <td>${esc((cardPorId(j.card)?.objeto || '').slice(0, 80) || j.orgao || '—')}<div class="m">${esc(j.orgao || cardPorId(j.card)?.orgao || '')}${j.processo ? ' · proc. ' + esc(j.processo) : ''}</div></td>
        <td><select data-sit="${esc(j.id)}">${SITUACOES.map(s => `<option ${s === j.situacao ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
        <td class="ui-acoes"><button class="btn-ghost" data-minuta="${esc(j.id)}">📄 Minuta</button><button class="btn-ghost" data-editar="${esc(j.id)}">Editar</button></td></tr>`; }).join('')}
    </tbody></table></div>` : '<p class="empty">Nenhuma demanda jurídica. Cadastre uma impugnação, esclarecimento ou recurso: o prazo é calculado e a minuta sai pronta para revisar.</p>'}
    <p class="m ui-nota">Prazos em dias úteis, sem contar feriados locais. As minutas são um ponto de partida: revise os fundamentos com um advogado antes de protocolar.</p></section>`;
  ligarSeletorPerfil(v, desenhar);
  $('#jurBusca').oninput = e => { store.set('pregoes.jurBusca', e.target.value); clearTimeout(desenhar.t); desenhar.t = setTimeout(() => { desenhar(); $('#jurBusca').focus(); $('#jurBusca').setSelectionRange(99, 99); }, 300); };
  $('#jurSit').onchange = e => { store.set('pregoes.jurSit', e.target.value); desenhar(); };
  $('#jurNova').onclick = () => editar({ tipo: 'impugnacao', situacao: 'Em análise', perfil: perfilId || estado.perfis[0]?.id || '' });
  $$('[data-editar]', v).forEach(b => b.onclick = () => editar(juridico.itens.find(j => j.id === b.dataset.editar)));
  $$('[data-minuta]', v).forEach(b => b.onclick = () => gerarMinuta(juridico.itens.find(j => j.id === b.dataset.minuta)));
  $$('[data-sit]', v).forEach(s => s.onchange = async () => { await juridico.salvar(juridico.itens.map(j => j.id === s.dataset.sit ? { ...j, situacao: s.value } : j)); desenhar(); window.dispatchEvent(new CustomEvent('avisos-mudaram')); });
}

async function editar(j) {
  const r = await formulario(j.id ? 'Editar demanda' : 'Nova demanda jurídica', [
    { k: 'tipo', rot: 'Tipo', tipo: 'select', opcoes: Object.entries(TIPOS).map(([k, t]) => [k, t.nome]) },
    { k: 'titulo', rot: 'Título', ph: 'Ex.: Impugnar exigência de marca no item 3', largo: true },
    { k: 'perfil', rot: 'Empresa', tipo: 'select', opcoes: estado.perfis.map(p => [p.id, p.nome]) },
    { k: 'card', rot: 'Licitação do Kanban', tipo: 'select', opcoes: opcoesCards(j.perfil) },
    { k: 'orgao', rot: 'Órgão (se não estiver no Kanban)' },
    { k: 'processo', rot: 'Nº do processo' },
    { k: 'abertura', rot: 'Data de abertura da sessão (impugnação/esclarecimento)', tipo: 'date' },
    { k: 'intimacao', rot: 'Data da intimação / ata (recurso, contrarrazões, defesa)', tipo: 'date' },
    { k: 'prazo', rot: 'Prazo final (deixe vazio para calcular)', tipo: 'date' },
    { k: 'situacao', rot: 'Situação', tipo: 'select', opcoes: SITUACOES },
    { k: 'fatos', rot: 'Fatos (vão para a minuta)', tipo: 'area', linhas: 4, largo: true, ph: 'O item 5.2 do edital exige…' },
    { k: 'pedido', rot: 'Pedido (vai para a minuta)', tipo: 'area', linhas: 2, largo: true, ph: 'excluir a exigência de…' },
  ], { ...j, abertura: j.abertura || (cardPorId(j.card)?.encerramento || '').slice(0, 10) }, { apagar: !!j.id, extra: `<p class="m ap-largo">Prazos: ${Object.values(TIPOS).slice(0, 5).map(t => `<b>${t.nome}</b> ${t.regra}`).join(' · ')}.</p>` });
  if (!r) return;
  if (!r.abertura && r.card) r.abertura = (cardPorId(r.card)?.encerramento || '').slice(0, 10);
  const lista = r.apagar ? juridico.itens.filter(x => x.id !== j.id)
    : j.id ? juridico.itens.map(x => x.id === j.id ? { ...x, ...r } : x) : [...juridico.itens, { ...r, id: id(), criadoEm: new Date().toISOString() }];
  if (await juridico.salvar(lista)) { desenhar(); window.dispatchEvent(new CustomEvent('avisos-mudaram')); }
}

function gerarMinuta(j) {
  const p = estado.perfis.find(x => x.id === j.perfil) || {};
  const m = minuta(j, p);
  const par = t => t.split(/\n+/).map(x => `<p>${esc(x)}</p>`).join('');
  imprimir(`${m.titulo} – ${p.razao || p.nome || ''}`, `<section class="pagina">${timbre(p)}<p>${esc(m.destino).replace(/\n/g, '<br>')}</p><h1>${esc(m.titulo)}</h1><p>${esc(m.abertura)}</p>${par(m.corpo)}<p>Nestes termos, pede deferimento.</p>${assinatura(p)}</section>`);
  if (j.situacao === 'Em análise' || j.situacao === 'Documentos pendentes') juridico.salvar(juridico.itens.map(x => x.id === j.id ? { ...x, situacao: 'Minuta gerada' } : x)).then(desenhar);
}

v = registrarAba('juridico', '⚖️ Jurídico', async () => {
  if (!juridico.pronto) { v.innerHTML = '<p class="empty">Carregando…</p>'; await juridico.carregar(); }
  desenhar();
}, 'documentos'); // no menu, antes de Documentos (que é carregado primeiro por causa do timbre)
window.addEventListener('dados-prontos', () => { juridico.carregar().then(() => window.dispatchEvent(new CustomEvent('avisos-mudaram'))); });
