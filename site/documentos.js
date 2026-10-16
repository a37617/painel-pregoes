// Documentos: cofre de certidões com vencimento e declarações de habilitação prontas,
// preenchidas com os dados do perfil da empresa, para imprimir ou salvar num PDF só.
import { registrarAba, estado, dadosCarregados } from './app.js';
import { $, $$, esc, dataBR, diasAte, hojeISO, colecao, formulario, seletorPerfil, perfilEscolhido, ligarSeletorPerfil, imprimir, opcoesCards, cardPorId, store } from './ui.js';
import { id } from './loja.js';

export const certidoes = colecao('certidoes');
const personalizadas = colecao('declaracoes');

// Certidões mais pedidas, com onde emitir (sites oficiais).
const TIPOS_CERT = [
  ['federal', 'CND Federal (Receita/PGFN)', 'https://solucoes.receita.fazenda.gov.br/Servicos/certidaointernet/PJ/Emitir'],
  ['fgts', 'CRF – FGTS', 'https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf'],
  ['trabalhista', 'CNDT – Trabalhista', 'https://cndt-certidao.tst.jus.br/inicio.faces'],
  ['estadual', 'Certidão Estadual (Sefaz)', ''],
  ['municipal', 'Certidão Municipal', ''],
  ['falencia', 'Falência e recuperação judicial', ''],
  ['sicaf', 'SICAF', 'https://www3.comprasnet.gov.br/sicaf-web/index.jsf'],
  ['sancoes', 'Consulta CEIS/CNEP/TCU', 'https://certidoes.cgu.gov.br/'],
  ['balanco', 'Balanço patrimonial', ''],
  ['contrato', 'Contrato social / alterações', ''],
  ['atestado', 'Atestado de capacidade técnica', ''],
  ['outro', 'Outro documento', ''],
];
const tipoCert = t => TIPOS_CERT.find(x => x[0] === t) || TIPOS_CERT.at(-1);
export const nomeCert = c => c.nome || tipoCert(c.tipo)[1];

export function situacaoCert(c) {
  if (!c.validade) return { cls: 'ok', txt: 'sem validade' };
  const d = diasAte(c.validade);
  if (d < 0) return { cls: 'hot', txt: `vencida há ${-d} dia(s)` };
  if (d <= 15) return { cls: 'soon', txt: d === 0 ? 'vence hoje' : `vence em ${d} dia(s)` };
  return { cls: 'ok', txt: `válida até ${dataBR(c.validade)}` };
}

// Declarações padrão (Lei 14.133/2021). Campos entre chaves vêm do perfil e da licitação escolhida.
const DECLARACOES = [
  ['habilitacao', 'Declaração de cumprimento dos requisitos de habilitação', 'Art. 63, I, da Lei 14.133/2021',
    'A empresa {razao}, inscrita no CNPJ sob o nº {cnpj}, com sede em {endereco}, por intermédio de seu representante legal, declara, para fins de participação no {certame}, que cumpre plenamente os requisitos de habilitação exigidos no edital, e que as declarações prestadas são verdadeiras, sob as penas da lei.'],
  ['impeditivo', 'Declaração de inexistência de fato impeditivo e de idoneidade', 'Art. 156 da Lei 14.133/2021',
    'A empresa {razao}, CNPJ nº {cnpj}, declara, para fins de participação no {certame}, que até a presente data inexistem fatos impeditivos para sua habilitação, que não foi declarada inidônea nem está suspensa ou impedida de licitar e contratar com a Administração Pública, ciente da obrigatoriedade de comunicar ocorrências posteriores.'],
  ['menor', 'Declaração de não emprego de menor', 'Art. 7º, XXXIII, da Constituição Federal',
    'A empresa {razao}, CNPJ nº {cnpj}, declara, para fins do {certame}, que não emprega menor de 18 anos em trabalho noturno, perigoso ou insalubre, nem menor de 16 anos em qualquer trabalho, salvo na condição de aprendiz, a partir de 14 anos.'],
  ['independente', 'Declaração de elaboração independente de proposta', 'Ausência de conluio',
    'A empresa {razao}, CNPJ nº {cnpj}, declara que a proposta apresentada no {certame} foi elaborada de forma independente, que seu conteúdo não foi, no todo ou em parte, informado, discutido ou recebido de qualquer outro participante ou potencial participante, e que não houve tentativa de influenciar a decisão de outros licitantes.'],
  ['vinculo', 'Declaração de inexistência de vínculo com agente público', 'Art. 9º e art. 14 da Lei 14.133/2021',
    'A empresa {razao}, CNPJ nº {cnpj}, declara, para fins do {certame}, que não possui em seu quadro societário ou de empregados servidor ou dirigente do órgão contratante, nem pessoa que mantenha com eles vínculo que configure impedimento nos termos da Lei 14.133/2021.'],
  ['pcd', 'Declaração de reserva de cargos para PCD e aprendiz', 'Art. 63, IV, da Lei 14.133/2021',
    'A empresa {razao}, CNPJ nº {cnpj}, declara, para fins do {certame}, que cumpre as exigências de reserva de cargos para pessoa com deficiência e para reabilitado da Previdência Social previstas em lei e em outras normas específicas.'],
  ['edital', 'Declaração de concordância com os termos do edital', 'Ciência e aceitação',
    'A empresa {razao}, CNPJ nº {cnpj}, declara que tomou conhecimento de todas as informações e condições do {certame}, que concorda integralmente com os termos do edital e seus anexos e que a proposta compreende a integralidade dos custos para atendimento dos direitos trabalhistas assegurados na Constituição Federal, nas leis trabalhistas, nas normas infralegais, nas convenções coletivas de trabalho e nos termos de ajustamento de conduta vigentes.'],
  ['normas', 'Declaração de conformidade com normas técnicas', 'ABNT / INMETRO, quando aplicável',
    'A empresa {razao}, CNPJ nº {cnpj}, declara, para fins do {certame}, que os produtos e serviços ofertados atendem às normas técnicas da ABNT, às regulamentações do INMETRO e às demais normas aplicáveis ao objeto.'],
  ['vistoria', 'Declaração de vistoria ou de dispensa de vistoria', 'Conhecimento das condições do local',
    'A empresa {razao}, CNPJ nº {cnpj}, declara, para fins do {certame}, que tem pleno conhecimento das condições e peculiaridades inerentes à natureza do objeto e do local de execução, assumindo total responsabilidade por esse fato, e que não utilizará esta circunstância para quaisquer questionamentos futuros.'],
  ['nepotismo', 'Declaração de inexistência de parentesco (nepotismo)', 'Decreto 7.203/2010 e Súmula Vinculante 13 do STF',
    'A empresa {razao}, CNPJ nº {cnpj}, declara, para fins do {certame}, que seus sócios e administradores não são cônjuges, companheiros ou parentes, em linha reta, colateral ou por afinidade, até o terceiro grau, de agentes públicos do órgão contratante que atuem na licitação ou na fiscalização do contrato.'],
  ['meepp', 'Declaração de enquadramento como ME/EPP', 'Lei Complementar 123/2006 (só para ME e EPP)',
    'A empresa {razao}, CNPJ nº {cnpj}, declara, sob as penas da lei, que está enquadrada como {porte}, nos termos da Lei Complementar 123/2006, que não se enquadra em nenhuma das vedações do § 4º do art. 3º dessa lei e que está apta a usufruir do tratamento favorecido nela previsto no {certame}.'],
  ['bancarios', 'Declaração de dados bancários', 'Para pagamento, quando o edital pedir',
    'A empresa {razao}, CNPJ nº {cnpj}, informa, para fins de pagamento referente ao {certame}, os seguintes dados bancários: Banco {banco}, Agência {agencia}, Conta {conta}{pixTexto}.'],
  ['forcado', 'Declaração de não utilização de trabalho forçado ou degradante', 'Art. 68, VI, e art. 14, VI, da Lei 14.133/2021',
    'A empresa {razao}, CNPJ nº {cnpj}, declara, para fins do {certame}, que não possui, em sua cadeia produtiva, empregados executando trabalho degradante ou forçado, observando o disposto nos incisos III e IV do art. 1º e no inciso III do art. 5º da Constituição Federal.'],
  ['ambiental', 'Declaração de responsabilidade ambiental e sustentabilidade', 'Práticas sustentáveis',
    'A empresa {razao}, CNPJ nº {cnpj}, declara, para fins do {certame}, que adota práticas de sustentabilidade ambiental na execução do objeto, observando a legislação ambiental vigente quanto ao uso de materiais, descarte de resíduos e consumo de recursos.'],
  ['sancoes', 'Declaração de ausência de sanções (CEIS/CNEP/TCU)', 'Não consta em cadastros de impedidos',
    'A empresa {razao}, CNPJ nº {cnpj}, declara, para fins do {certame}, que não consta no Cadastro Nacional de Empresas Inidôneas e Suspensas (CEIS), no Cadastro Nacional de Empresas Punidas (CNEP), nem na relação de inabilitados e inidôneos do Tribunal de Contas da União.'],
  ['anexos', 'Declaração de ciência do edital e anexos', 'Conhecimento de todas as condições',
    'A empresa {razao}, CNPJ nº {cnpj}, declara que recebeu o edital do {certame} e todos os seus anexos, que tomou conhecimento de todas as condições para o cumprimento das obrigações do objeto da licitação e que não há dúvidas ou questionamentos pendentes.'],
  ['ciencia', 'Declaração de que a proposta compreende todos os custos', 'Art. 63, § 1º, da Lei 14.133/2021',
    'A empresa {razao}, CNPJ nº {cnpj}, declara, para fins do {certame}, que sua proposta econômica compreende a integralidade dos custos para atendimento dos direitos trabalhistas, tributários, previdenciários e de todas as despesas necessárias à execução do objeto.'],
];

let v;

export function preencher(texto, p, lic = {}) {
  const certame = lic.numero || lic.orgao
    ? `${lic.modalidade || 'Pregão'} nº ${lic.numero || '____'}${lic.orgao ? `, promovido por ${lic.orgao}` : ''}${lic.processo ? ` (processo ${lic.processo})` : ''}`
    : 'certame em referência';
  const dados = {
    razao: p.razao || p.nome || '[RAZÃO SOCIAL]', cnpj: p.cnpj || '[CNPJ]', endereco: [p.endereco, p.cidade && `${p.cidade}/${p.uf}`, p.cep && `CEP ${p.cep}`].filter(Boolean).join(', ') || '[ENDEREÇO]',
    porte: p.porte === 'EPP' ? 'empresa de pequeno porte' : p.porte === 'ME' ? 'microempresa' : '[ME ou EPP]',
    banco: p.banco || '[BANCO]', agencia: p.agencia || '[AGÊNCIA]', conta: p.conta || '[CONTA]', pixTexto: p.pix ? `, chave PIX ${p.pix}` : '',
    certame, orgao: lic.orgao || '[ÓRGÃO]', pregao: lic.numero || '[Nº]', processo: lic.processo || '',
    representante: p.repNome || '[REPRESENTANTE]', cpf: p.repCpf || '[CPF]',
  };
  return texto.replace(/\{(\w+)\}/g, (_, k) => dados[k] ?? `{${k}}`);
}

export function timbre(p) {
  return `<div class="timbre">${p.logo ? `<img src="${p.logo}" alt="">` : ''}<div><b>${esc(p.razao || p.nome)}</b><br>CNPJ ${esc(p.cnpj || '—')}<br>${esc([p.endereco, p.cidade && `${p.cidade}/${p.uf}`].filter(Boolean).join(' · '))}${p.telefone || p.email ? `<br>${esc([p.telefone, p.email].filter(Boolean).join(' · '))}` : ''}</div></div>`;
}

export function assinatura(p) {
  const hoje = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  return `<p class="local">${esc(p.cidade || '[Cidade]')}/${esc(p.uf || 'UF')}, ${hoje}.</p>
    <div class="assinatura"><div></div>${esc(p.repNome || '[Representante legal]')}<br>${esc(p.repCargo || 'Representante legal')}${p.repCpf ? ` · CPF ${esc(p.repCpf)}` : ''}<br>${esc(p.razao || p.nome)}</div>`;
}

function desenhar() {
  const perfilId = perfilEscolhido('pregoes.docPerfil', false);
  const p = estado.perfis.find(x => x.id === perfilId);
  const certs = certidoes.itens.filter(c => c.perfil === perfilId).sort((a, b) => (a.validade || '9999').localeCompare(b.validade || '9999'));
  const marcadas = new Set(JSON.parse(store.get('pregoes.docMarcadas') || '[]'));
  const pers = personalizadas.itens.filter(d => !d.perfil || d.perfil === perfilId);
  const faltam = p ? ['razao', 'cnpj', 'endereco', 'repNome'].filter(k => !p[k]) : [];
  v.innerHTML = `<div class="ap-topo ap-pad-x"><div><h2>Documentos</h2><p class="m">Certidões com aviso de vencimento e declarações prontas com os dados da empresa.</p></div>
      ${estado.perfis.length ? seletorPerfil('pregoes.docPerfil', false) : ''}</div>
    ${!estado.perfis.length ? `<div class="card ap-pad"><p class="empty">Crie um perfil de empresa para guardar certidões e gerar declarações.</p><button class="btn-primary" data-ir="perfis">+ Criar perfil</button></div>` : `
    ${faltam.length ? `<div class="ui-aviso">Faltam dados da empresa no perfil (${faltam.map(k => ({ razao: 'razão social', cnpj: 'CNPJ', endereco: 'endereço', repNome: 'representante' })[k]).join(', ')}). As declarações sairão com esses campos em branco. <button class="btn-ghost" data-ir="perfis">Completar perfil</button></div>` : ''}
    <section class="card ap-pad ui-bloco">
      <div class="ap-topo"><div><h3>Certidões e documentos da empresa</h3><p class="m">${certs.filter(c => situacaoCert(c).cls === 'hot').length} vencida(s) · ${certs.filter(c => situacaoCert(c).cls === 'soon').length} vencendo em até 15 dias</p></div>
        <button class="btn-primary" id="docNovaCert">+ Certidão / documento</button></div>
      ${certs.length ? `<div class="tscroll"><table class="ui-tabela"><thead><tr><th>Documento</th><th>Nº / observação</th><th>Emissão</th><th>Situação</th><th></th></tr></thead><tbody>
        ${certs.map(c => { const s = situacaoCert(c), t = tipoCert(c.tipo); return `<tr>
          <td><b>${esc(c.nome || t[1])}</b></td><td class="m">${esc([c.numero, c.obs].filter(Boolean).join(' · ') || '—')}</td><td>${dataBR(c.emissao)}</td>
          <td><span class="badge ${s.cls}">${esc(s.txt)}</span></td>
          <td class="ui-acoes">${(c.link || t[2]) ? `<a class="btn-ghost" href="${esc(c.link || t[2])}" target="_blank" rel="noopener">Emitir ↗</a>` : ''}<button class="btn-ghost" data-cert="${esc(c.id)}">Editar</button></td></tr>`; }).join('')}
      </tbody></table></div>` : '<p class="empty">Nenhuma certidão cadastrada. Cadastre a validade de cada uma para receber aviso antes de vencer.</p>'}
      <details class="ui-links"><summary>Onde emitir as principais certidões</summary><ul>${TIPOS_CERT.filter(t => t[2]).map(t => `<li><a href="${t[2]}" target="_blank" rel="noopener">${t[1]} ↗</a></li>`).join('')}</ul></details>
    </section>
    <section class="card ap-pad ui-bloco">
      <div class="ap-topo"><div><h3>Declarações</h3><p class="m">Marque as que o edital pede, escolha a licitação e gere tudo num PDF só.</p></div>
        <span class="ap-acoes"><button class="btn-ghost" id="docTodas">Marcar todas</button><button class="btn-ghost" id="docLimpar">Limpar</button></span></div>
      <div class="ui-grid2">
        <label>Licitação do Kanban (preenche órgão e número)<select id="docCard">${opcoesCards(perfilId).map(([vv, r]) => `<option value="${esc(vv)}">${esc(r)}</option>`).join('')}</select></label>
        <label>Ou digite: órgão<input id="docOrgao" placeholder="Prefeitura Municipal de …"></label>
        <label>Nº do pregão<input id="docNumero" placeholder="90012/2026"></label>
        <label>Processo<input id="docProcesso" placeholder="opcional"></label>
      </div>
      <div class="ui-decls">${DECLARACOES.map(([k, t, base]) => `<label class="ui-decl"><input type="checkbox" value="${k}" ${marcadas.has(k) ? 'checked' : ''}><span><b>${esc(t)}</b><small>${esc(base)}</small></span></label>`).join('')}
        ${pers.map(d => `<label class="ui-decl"><input type="checkbox" value="p:${esc(d.id)}" ${marcadas.has('p:' + d.id) ? 'checked' : ''}><span><b>${esc(d.titulo)}</b><small>Personalizada · <a href="#" data-editdecl="${esc(d.id)}">editar</a></small></span></label>`).join('')}
      </div>
      <div class="ap-rodape"><button class="btn-ghost" id="docNovaDecl">+ Declaração personalizada</button>
        <button class="btn-primary" id="docGerar">📄 Gerar PDF das marcadas (<span id="docQtd">${[...marcadas].length}</span>)</button></div>
    </section>`}`;
  ligarSeletorPerfil(v, desenhar);
  $$('[data-ir]', v).forEach(b => b.onclick = () => window.irParaAba(b.dataset.ir));
  if (!p) return;

  $('#docNovaCert').onclick = () => editarCert({ perfil: perfilId, tipo: 'federal' });
  $$('[data-cert]', v).forEach(b => b.onclick = () => editarCert(certidoes.itens.find(c => c.id === b.dataset.cert)));
  const salvarMarcadas = () => {
    const m = $$('.ui-decl input:checked', v).map(i => i.value);
    store.set('pregoes.docMarcadas', JSON.stringify(m));
    $('#docQtd').textContent = m.length;
  };
  $$('.ui-decl input', v).forEach(i => i.onchange = salvarMarcadas);
  $('#docTodas').onclick = () => { $$('.ui-decl input', v).forEach(i => i.checked = true); salvarMarcadas(); };
  $('#docLimpar').onclick = () => { $$('.ui-decl input', v).forEach(i => i.checked = false); salvarMarcadas(); };
  $('#docCard').onchange = e => {
    const c = cardPorId(e.target.value);
    $('#docOrgao').value = c?.orgao || ''; $('#docNumero').value = c?.numero || ''; $('#docProcesso').value = c?.processo || '';
  };
  $('#docNovaDecl').onclick = () => editarDecl({ perfil: perfilId });
  $$('[data-editdecl]', v).forEach(a => a.onclick = e => { e.preventDefault(); editarDecl(personalizadas.itens.find(d => d.id === a.dataset.editdecl)); });
  $('#docGerar').onclick = () => {
    const m = $$('.ui-decl input:checked', v).map(i => i.value);
    if (!m.length) return alert('Marque ao menos uma declaração.');
    const lic = { orgao: $('#docOrgao').value.trim(), numero: $('#docNumero').value.trim(), processo: $('#docProcesso').value.trim() };
    const paginas = m.map(k => {
      const d = k.startsWith('p:') ? (x => x && [k, x.titulo, '', x.texto])(personalizadas.itens.find(x => 'p:' + x.id === k)) : DECLARACOES.find(x => x[0] === k);
      if (!d) return '';
      const destino = lic.orgao ? `<p>À<br>${esc(lic.orgao)}${lic.numero ? `<br>Ref.: Pregão nº ${esc(lic.numero)}` : ''}</p>` : '';
      return `<section class="pagina">${timbre(p)}${destino}<h1>${esc(d[1])}</h1>${preencher(d[3], p, lic).split(/\n+/).map(par => `<p>${esc(par)}</p>`).join('')}${assinatura(p)}</section>`;
    }).join('');
    imprimir(`Declarações – ${p.razao || p.nome}`, paginas);
  };
}

async function editarCert(c) {
  const r = await formulario(c.id ? 'Editar documento' : 'Novo documento', [
    { k: 'tipo', rot: 'Tipo', tipo: 'select', opcoes: TIPOS_CERT.map(t => [t[0], t[1]]) },
    { k: 'nome', rot: 'Nome (se diferente do tipo)', ph: 'Ex.: CND Estadual RS' },
    { k: 'numero', rot: 'Número / código de controle' },
    { k: 'emissao', rot: 'Emitida em', tipo: 'date', padrao: hojeISO() },
    { k: 'validade', rot: 'Válida até', tipo: 'date' },
    { k: 'link', rot: 'Link para emitir de novo', ph: 'https://…', largo: true },
    { k: 'obs', rot: 'Observação', largo: true },
  ], c, { apagar: !!c.id });
  if (!r) return;
  const lista = r.apagar ? certidoes.itens.filter(x => x.id !== c.id)
    : c.id ? certidoes.itens.map(x => x.id === c.id ? { ...x, ...r } : x) : [...certidoes.itens, { ...r, id: id(), perfil: c.perfil }];
  if (await certidoes.salvar(lista)) { desenhar(); window.dispatchEvent(new CustomEvent('avisos-mudaram')); }
}

async function editarDecl(d) {
  const r = await formulario(d.id ? 'Editar declaração' : 'Nova declaração personalizada', [
    { k: 'titulo', rot: 'Título', req: true, largo: true },
    { k: 'texto', rot: 'Texto (use {razao}, {cnpj}, {endereco}, {certame}, {orgao}, {pregao}, {representante})', tipo: 'area', linhas: 8, largo: true,
      ph: 'A empresa {razao}, CNPJ nº {cnpj}, declara, para fins do {certame}, que…' },
  ], d, { apagar: !!d.id });
  if (!r) return;
  const lista = r.apagar ? personalizadas.itens.filter(x => x.id !== d.id)
    : d.id ? personalizadas.itens.map(x => x.id === d.id ? { ...x, ...r } : x) : [...personalizadas.itens, { ...r, id: id(), perfil: d.perfil }];
  if (await personalizadas.salvar(lista)) desenhar();
}

v = registrarAba('documentos', '📄 Documentos', async () => {
  if (!certidoes.pronto) { v.innerHTML = '<p class="empty">Carregando…</p>'; await Promise.all([certidoes.carregar(), personalizadas.carregar()]); }
  desenhar();
});
window.addEventListener('dados-prontos', () => { certidoes.carregar().then(() => window.dispatchEvent(new CustomEvent('avisos-mudaram'))); });
