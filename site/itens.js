// No detalhe do pregão: filtra os itens pelos termos do perfil (ou da busca), destaca os termos
// e gera a proposta comercial em Word com os dados da empresa.
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const brl = v => v == null || isNaN(v) ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
const num = v => { const n = parseFloat(String(v).replace(/\./g, '').replace(',', '.')); return isNaN(n) ? 0 : n; };

function termosAtivos() {
  const doPerfil = window.termosDoPerfil?.() || [];
  if (doPerfil.length) return { termos: doPerfil, origem: 'do perfil' };
  const q = (document.getElementById('q')?.value || '').split(',').map(t => t.trim()).filter(Boolean);
  return { termos: q, origem: 'da busca' };
}

// Destaca os termos no texto sem mexer na acentuação original.
function destacar(texto, termos) {
  if (!termos.length) return esc(texto);
  const n = norm(texto);
  const marcas = [];
  for (const t of termos.map(norm).filter(t => t.length > 1)) { let i = -1; while ((i = n.indexOf(t, i + 1)) !== -1) marcas.push([i, i + t.length]); }
  if (!marcas.length) return esc(texto);
  marcas.sort((a, b) => a[0] - b[0]);
  let out = '', pos = 0;
  for (const [a, b] of marcas) { if (a < pos) continue; out += esc(texto.slice(pos, a)) + '<mark>' + esc(texto.slice(a, b)) + '</mark>'; pos = b; }
  return out + esc(texto.slice(pos));
}

window.addEventListener('itens-carregados', e => {
  const { r: pregao, items } = e.detail;
  const tabela = document.querySelector('#drawer table.items');
  if (!tabela) return;
  const porNumero = Object.fromEntries(items.map(it => [it.numeroItem, it]));
  const { termos, origem } = termosAtivos();
  const bate = it => termos.some(t => norm(it.descricao).includes(norm(t)));
  const qtdBate = items.filter(bate).length;

  const barra = document.createElement('div');
  barra.className = 'it-barra';
  barra.innerHTML = `
    <input type="search" class="it-busca" placeholder="Pesquisar nos itens desta licitação">
    ${termos.length ? `<label class="it-chk"><input type="checkbox" class="it-meus" ${qtdBate ? 'checked' : ''}> Só itens com os termos ${origem} (${qtdBate})</label>` : ''}
    <span class="m it-cont"></span>
    <button type="button" class="btn-primary it-proposta"><i data-ic="documento"></i> Gerar proposta (Word)</button>`;
  tabela.closest('.tscroll').before(barra);

  function filtrar() {
    const q = norm(barra.querySelector('.it-busca').value.trim());
    const meus = barra.querySelector('.it-meus')?.checked;
    let vis = 0;
    tabela.querySelectorAll('tbody tr[data-n]').forEach(tr => {
      const it = porNumero[tr.dataset.n];
      const ok = it && (!meus || bate(it)) && (!q || norm(it.descricao).includes(q));
      tr.hidden = !ok;
      const extra = tabela.querySelector(`tr[data-pz="${tr.dataset.n}"]`); if (extra) extra.hidden = !ok; // linha da pesquisa de preço
      if (ok) vis++;
    });
    barra.querySelector('.it-cont').textContent = `Exibindo ${vis} de ${items.length} itens`;
  }

  // Destaque dos termos na descrição (o primeiro trecho de texto da célula).
  tabela.querySelectorAll('tbody tr[data-n]').forEach(tr => {
    const td = tr.cells[1], it = porNumero[tr.dataset.n];
    const no = td?.firstChild;
    if (!it || !no || no.nodeType !== 3) return;
    const span = document.createElement('span');
    span.innerHTML = destacar(no.textContent, termos);
    td.replaceChild(span, no);
  });

  barra.querySelector('.it-busca').oninput = filtrar;
  barra.querySelector('.it-meus')?.addEventListener('change', filtrar);
  barra.querySelector('.it-proposta').onclick = () => abrirProposta(pregao, items, items.filter(it => !tabela.querySelector(`tr[data-n="${it.numeroItem}"]`)?.hidden));
  filtrar();
});

// ---------- proposta em Word ----------
const lerExtras = () => { try { const v = parseFloat(localStorage.getItem('pregoes.custosExtras')); return isNaN(v) ? 15 : v; } catch { return 15; } };
const lerMargem = () => { try { const v = parseFloat(localStorage.getItem('pregoes.margemProposta')); return isNaN(v) ? 20 : v; } catch { return 20; } };

async function lerPerfis() {
  try { const { carregar } = await import('./loja.js'); return await carregar('perfis'); } catch { return []; }
}

async function abrirProposta(pregao, todos, visiveis) {
  const perfis = await lerPerfis();
  const ativo = window.perfilAtivo?.();
  const marcados = new Set(visiveis.map(it => it.numeroItem));
  const dlg = document.createElement('dialog');
  dlg.className = 'ap-dialog it-dialog';
  dlg.innerHTML = `<form class="ap-form">
    <div class="ap-topo"><div><h2>Proposta comercial</h2><p class="m">${esc(pregao.obj.slice(0, 160))}</p></div><button type="button" class="btn-ghost it-fechar">Fechar <i data-ic="fechar"></i></button></div>
    <label class="ap-largo">Empresa (perfil com os dados que vão na proposta)
      <select name="perfil">${perfis.length ? perfis.map(p => `<option value="${esc(p.id)}" ${p.id === ativo?.id ? 'selected' : ''}>${esc(p.nome)}${p.razao ? '' : ' (sem dados da empresa)'}</option>`).join('') : '<option value="">Nenhum perfil: crie um na aba Perfis de empresa</option>'}</select></label>
    <div class="ap-largo it-preencher">
      <span>Preencher o valor unitário com:</span>
      <select class="it-base"><option value="auto">Preço de mercado pesquisado + margem (ou o estimado do órgão, se não pesquisou)</option><option value="mercado">Só preço de mercado pesquisado + margem</option><option value="orgao">Valor estimado do órgão</option></select>
      <label class="it-margem">Margem <input type="number" class="it-pct" min="0" max="500" step="1" value="${esc(lerMargem())}"> %</label>
      <button type="button" class="btn-ghost it-aplicar">Aplicar</button>
      <span class="m">Mercado + impostos/frete (${esc(String(lerExtras()))}%) + margem. Confira cada valor antes de enviar.</span>
    </div>
    <div class="ap-largo it-tabela-wrap"><table class="it-tab"><thead><tr><th><input type="checkbox" class="it-todos" checked title="Marcar todos"></th><th>#</th><th>Descrição</th><th>Qtd.</th><th>Ref. unit.</th><th>Marca</th><th>Modelo</th><th>Valor unit. (R$)</th><th>Total</th></tr></thead>
      <tbody>${todos.map(it => `<tr data-n="${it.numeroItem}" ${marcados.has(it.numeroItem) ? '' : 'class="it-off"'}>
        <td><input type="checkbox" class="it-sel" ${marcados.has(it.numeroItem) ? 'checked' : ''}></td><td>${it.numeroItem}</td>
        <td class="it-desc" title="${esc(it.descricao)}">${esc((it.descricao || '').slice(0, 110))}</td><td>${(it.quantidade || 0).toLocaleString('pt-BR')} ${esc(it.unidadeMedida || '')}</td>
        <td>${brl(it.valorUnitarioEstimado)}</td><td><input class="it-marca" placeholder="Marca"></td><td><input class="it-modelo" placeholder="Modelo"></td>
        <td><input class="it-valor" inputmode="decimal" placeholder="0,00"></td><td class="it-total">—</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="8">Total da proposta</td><td class="it-soma">R$ 0,00</td></tr></tfoot></table></div>
    <label>Validade da proposta<input name="validade" value="${esc(ativo?.validade || '60 (sessenta) dias')}"></label>
    <label>Prazo de entrega<input name="prazoEntrega" value="${esc(ativo?.prazoEntrega || 'Conforme edital')}"></label>
    <label>Condições de pagamento<input name="pagamento" value="${esc(ativo?.pagamento || 'Conforme edital')}"></label>
    <label>Local<input name="local" value="${esc(ativo?.cidade ? `${ativo.cidade}${ativo.uf ? '/' + ativo.uf : ''}` : '')}"></label>
    <label class="ap-largo">Observações (opcional)<textarea name="obs" rows="2"></textarea></label>
    <div class="ap-rodape"><span class="m it-msg">Itens marcados sem valor saem em branco para você preencher no Word.</span><span class="ap-acoes"><button type="button" class="btn-ghost it-ver"><i data-ic="olho"></i> Pré-visualizar</button><button class="btn-primary" type="submit"><i data-ic="baixar"></i> Baixar proposta (.docx)</button></span></div>
  </form>`;
  document.body.append(dlg);
  dlg.showModal();
  const fechar = () => { dlg.close(); dlg.remove(); };
  dlg.querySelector('.it-fechar').onclick = fechar;
  const recalc = () => {
    let soma = 0;
    dlg.querySelectorAll('tbody tr').forEach(tr => {
      const on = tr.querySelector('.it-sel').checked; tr.classList.toggle('it-off', !on);
      const it = todos.find(x => String(x.numeroItem) === tr.dataset.n);
      const t = num(tr.querySelector('.it-valor').value) * (it.quantidade || 0);
      tr.querySelector('.it-total').textContent = t ? brl(t) : '—';
      if (on) soma += t;
    });
    dlg.querySelector('.it-soma').textContent = brl(soma);
  };
  // Preenche valor (e modelo, se a pesquisa achou) a partir da pesquisa de preços ou do estimado do órgão.
  const pesquisas = window.precosDoPregao?.id === pregao.id ? window.precosDoPregao.resultados : {};
  const preencher = () => {
    const base = dlg.querySelector('.it-base').value;
    const margem = parseFloat(dlg.querySelector('.it-pct').value) || 0;
    try { localStorage.setItem('pregoes.margemProposta', String(margem)); } catch {}
    const fator = (1 + lerExtras() / 100) * (1 + margem / 100);
    dlg.querySelectorAll('tbody tr').forEach(tr => {
      const it = todos.find(x => String(x.numeroItem) === tr.dataset.n);
      const r = pesquisas[it.numeroItem];
      const mercado = r?.preco_unitario_mediano > 0 ? r.preco_unitario_mediano * fator : null;
      const v = base === 'orgao' ? it.valorUnitarioEstimado : base === 'mercado' ? mercado : (mercado ?? it.valorUnitarioEstimado);
      tr.querySelector('.it-valor').value = v > 0 ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
      const modelo = tr.querySelector('.it-modelo');
      const achado = (r?.fontes || []).find(f => f.usado_no_preco) || (r?.fontes || [])[0];
      if (achado && !modelo.value) modelo.value = achado.produto || '';
      tr.title = mercado ? `Mercado: ${brl(r.preco_unitario_mediano)} · com impostos/frete e margem: ${brl(mercado)}` : '';
    });
    const n = todos.filter(it => pesquisas[it.numeroItem]?.preco_unitario_mediano > 0).length;
    dlg.querySelector('.it-msg').textContent = n ? `${n} item(ns) com preço de mercado pesquisado; os outros usam o estimado do órgão.` : 'Nenhum item pesquisado: usei o valor estimado do órgão. Rode a pesquisa de preços para usar o mercado.';
    recalc();
  };
  dlg.querySelector('.it-aplicar').onclick = preencher;
  dlg.querySelector('.it-base').onchange = preencher;
  dlg.querySelector('tbody').addEventListener('input', recalc);
  dlg.querySelector('tbody').addEventListener('change', recalc);
  dlg.querySelector('.it-todos').onchange = e => { dlg.querySelectorAll('.it-sel').forEach(c => c.checked = e.target.checked); recalc(); };
  const montar = async () => {
    const fd = new FormData(dlg.querySelector('form'));
    const perfil = perfis.find(p => p.id === fd.get('perfil')) || {};
    const linhas = [...dlg.querySelectorAll('tbody tr')].filter(tr => tr.querySelector('.it-sel').checked).map(tr => {
      const it = todos.find(x => String(x.numeroItem) === tr.dataset.n);
      return { it, marca: tr.querySelector('.it-marca').value.trim(), modelo: tr.querySelector('.it-modelo').value.trim(), valor: num(tr.querySelector('.it-valor').value) };
    });
    if (!linhas.length) { dlg.querySelector('.it-msg').textContent = 'Marque pelo menos um item.'; return null; }
    return gerarDocx({ pregao, perfil, linhas, opc: Object.fromEntries(fd) });
  };
  const msg = dlg.querySelector('.it-msg');
  dlg.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    msg.textContent = 'Gerando o arquivo…';
    try { const arq = await montar(); if (arq) { baixar(arq); msg.textContent = 'Pronto: confira o arquivo baixado antes de enviar.'; } }
    catch (err) { msg.textContent = 'Não consegui gerar: ' + err.message; }
  };
  dlg.querySelector('.it-ver').onclick = async () => {
    msg.textContent = 'Montando a pré-visualização…';
    try { const arq = await montar(); if (arq) { msg.textContent = ''; await previsualizar(arq, () => baixar(arq)); } }
    catch (err) { msg.textContent = 'Não consegui mostrar: ' + err.message; }
  };
  preencher();
}

// Valor por extenso (reais e centavos), como as propostas costumam pedir.
function extenso(valor) {
  const u = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const d = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const c = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  const ate999 = n => {
    if (n === 100) return 'cem';
    const p = [];
    if (n >= 100) { p.push(c[Math.floor(n / 100)]); n %= 100; }
    if (n >= 20) { p.push(d[Math.floor(n / 10)]); n %= 10; }
    if (n > 0) p.push(u[n]);
    return p.join(' e ');
  };
  const inteiro = Math.floor(valor), cent = Math.round((valor - inteiro) * 100);
  const grupos = [['', ''], ['mil', 'mil'], ['milhão', 'milhões'], ['bilhão', 'bilhões']];
  const partes = []; // [texto, valor do grupo]
  let n = inteiro, g = 0;
  while (n > 0) {
    const k = n % 1000;
    if (k) partes.unshift([g === 0 ? ate999(k) : g === 1 ? (k === 1 ? 'mil' : `${ate999(k)} mil`) : `${ate999(k)} ${k === 1 ? grupos[g][0] : grupos[g][1]}`, k]);
    n = Math.floor(n / 1000); g++;
  }
  // "mil e quinhentos", "mil duzentos e trinta": usa "e" antes de grupo menor que 100 ou de centena exata.
  let txt = partes.length ? partes.map(([s, k], i) => i === 0 ? s : ((k < 100 || k % 100 === 0) ? ' e ' : ' ') + s).join('') : 'zero';
  txt += inteiro === 1 ? ' real' : (inteiro >= 1e6 && inteiro % 1e6 === 0 ? ' de reais' : ' reais');
  if (cent) txt += ` e ${ate999(cent)} ${cent === 1 ? 'centavo' : 'centavos'}`;
  return txt;
}

async function gerarDocx({ pregao, perfil, linhas, opc }) {
  const docx = await import('https://esm.sh/docx@8.5.0');
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, ImageRun, BorderStyle, Header, TableLayoutType, VerticalAlign } = docx;
  // Larguras em twips (1/20 de ponto). Em porcentagem o docx grava um valor que o Word lê como 2% da página,
  // e a tabela saía espremida. A4 (11906) menos as margens de 1000 de cada lado.
  const UTIL = 11906 - 2000;
  const COLS = [6, 38, 17, 8, 7, 12, 12].map(pc => Math.round(UTIL * pc / 100));
  const t = (texto, o = {}) => new TextRun({ text: String(texto ?? ''), font: 'Calibri', size: 21, ...o });
  const p = (filhos, o = {}) => new Paragraph({ children: Array.isArray(filhos) ? filhos : [filhos], spacing: { after: 100 }, ...o });
  const cel = (texto, o = {}) => new TableCell({ children: [p(t(texto, { size: 18, bold: o.bold }), { alignment: o.alinhar || AlignmentType.LEFT, spacing: { after: 0 } })], shading: o.fundo ? { fill: o.fundo } : undefined, width: o.largura ? { size: o.largura, type: WidthType.DXA } : undefined, verticalAlign: VerticalAlign.CENTER, margins: { top: 40, bottom: 40, left: 70, right: 70 } });

  // Timbre: logo + dados da empresa no cabeçalho de todas as páginas.
  const cab = [];
  if (perfil.logo) {
    const bin = Uint8Array.from(atob(perfil.logo.split(',')[1]), ch => ch.charCodeAt(0));
    const img = await new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.src = perfil.logo; });
    const h = 55, w = Math.round(img.width * h / img.height);
    cab.push(p(new ImageRun({ data: bin, transformation: { width: Math.min(w, 220), height: h } })));
  }
  cab.push(p(t(perfil.razao || perfil.nome || 'RAZÃO SOCIAL DA EMPRESA', { bold: true, size: 22 })));
  cab.push(p(t([perfil.cnpj && `CNPJ ${perfil.cnpj}`, perfil.ie && `IE ${perfil.ie}`, perfil.endereco, perfil.cidade && `${perfil.cidade}/${perfil.uf || ''}`, perfil.telefone, perfil.email].filter(Boolean).join(' · '), { size: 16, color: '555555' }),
    { border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '999999', space: 4 } } }));

  const x = pregao.raw || {};
  const total = linhas.reduce((s, l) => s + l.valor * (l.it.quantidade || 0), 0);
  const tabela = new Table({
    width: { size: UTIL, type: WidthType.DXA },
    columnWidths: COLS,
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({ tableHeader: true, children: ['Item', 'Descrição', 'Marca / Modelo', 'Unid.', 'Qtd.', 'Valor unit.', 'Valor total'].map((h, i) => cel(h, { bold: true, fundo: 'E6E6E6', largura: COLS[i] })) }),
      ...linhas.map(l => new TableRow({ children: [
        cel(l.it.numeroItem, { alinhar: AlignmentType.CENTER, largura: COLS[0] }), cel(l.it.descricao, { largura: COLS[1] }), cel([l.marca, l.modelo].filter(Boolean).join(' / '), { largura: COLS[2] }),
        cel(l.it.unidadeMedida || '', { largura: COLS[3] }), cel((l.it.quantidade || 0).toLocaleString('pt-BR'), { alinhar: AlignmentType.RIGHT, largura: COLS[4] }),
        cel(l.valor ? brl(l.valor) : '', { alinhar: AlignmentType.RIGHT, largura: COLS[5] }), cel(l.valor ? brl(l.valor * (l.it.quantidade || 0)) : '', { alinhar: AlignmentType.RIGHT, largura: COLS[6] }),
      ] })),
      new TableRow({ children: [new TableCell({ columnSpan: 6, width: { size: COLS.slice(0, 6).reduce((a, b) => a + b, 0), type: WidthType.DXA }, children: [p(t('VALOR TOTAL DA PROPOSTA', { bold: true, size: 18 }), { alignment: AlignmentType.RIGHT, spacing: { after: 0 } })] }), cel(total ? brl(total) : '', { bold: true, alinhar: AlignmentType.RIGHT, largura: COLS[6] })] }),
    ],
  });

  const hoje = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  const filhos = [
    p(t('PROPOSTA COMERCIAL', { bold: true, size: 28 }), { alignment: AlignmentType.CENTER, spacing: { before: 200, after: 300 } }),
    p([t('À '), t(pregao.org, { bold: true })]),
    pregao.unidade ? p(t(pregao.unidade)) : null,
    p(t(`${pregao.mun}/${pregao.uf}`)),
    p([t('Ref.: ', { bold: true }), t(`${x.modalidadeNome || 'Pregão'} nº ${x.numeroCompra || '—'}${x.processo ? ` · Processo nº ${x.processo}` : ''}`)], { spacing: { before: 200, after: 100 } }),
    p([t('Objeto: ', { bold: true }), t(pregao.obj)]),
    p(t('Apresentamos nossa proposta para o fornecimento dos itens abaixo, conforme as condições do edital e seus anexos:'), { spacing: { before: 200, after: 150 } }),
    tabela,
    total ? p([t('Valor total: ', { bold: true }), t(`${brl(total)} (${extenso(total)}).`)], { spacing: { before: 200 } }) : null,
    p([t('Validade da proposta: ', { bold: true }), t(opc.validade)], { spacing: { before: 200 } }),
    p([t('Prazo de entrega: ', { bold: true }), t(opc.prazoEntrega)]),
    p([t('Condições de pagamento: ', { bold: true }), t(opc.pagamento)]),
    (perfil.banco || perfil.pix) ? p([t('Dados bancários: ', { bold: true }), t([perfil.banco && `Banco ${perfil.banco}`, perfil.agencia && `Agência ${perfil.agencia}`, perfil.conta && `Conta ${perfil.conta}`, perfil.pix && `PIX ${perfil.pix}`].filter(Boolean).join(' · '))]) : null,
    opc.obs ? p([t('Observações: ', { bold: true }), t(opc.obs)]) : null,
    p(t('Declaramos que nos preços propostos estão incluídas todas as despesas com tributos, encargos sociais, frete, seguros e demais custos necessários ao fornecimento, e que estamos de acordo com todas as condições do edital e seus anexos.'), { spacing: { before: 200 } }),
    p(t(`${opc.local || '__________'}, ${hoje}.`), { spacing: { before: 400, after: 600 } }),
    p(t('_______________________________________'), { alignment: AlignmentType.CENTER, spacing: { after: 0 } }),
    p(t(perfil.repNome || 'Nome do representante legal', { bold: true }), { alignment: AlignmentType.CENTER, spacing: { after: 0 } }),
    p(t([perfil.repCargo, perfil.repCpf && `CPF ${perfil.repCpf}`].filter(Boolean).join(' · ')), { alignment: AlignmentType.CENTER, spacing: { after: 0 } }),
    p(t(perfil.razao || ''), { alignment: AlignmentType.CENTER }),
  ].filter(Boolean);

  const doc = new Document({ sections: [{ headers: { default: new Header({ children: cab }) }, properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1700, bottom: 1000, left: 1000, right: 1000, header: 500 } } }, children: filhos }] });
  const blob = await Packer.toBlob(doc);
  const nome = `Proposta - ${(x.numeroCompra || 'pregao').replace(/[\\/:*?"<>|]/g, '-')} - ${(perfil.nome || 'empresa').replace(/[\\/:*?"<>|]/g, '-')}.docx`;
  return { blob, nome };
}

function baixar({ blob, nome }) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// Mostra o próprio .docx renderizado (como o Word vai abrir), antes de baixar.
async function previsualizar(arquivo, aoBaixar) {
  const { renderAsync } = await import('https://esm.sh/docx-preview@0.3.2');
  const dlg = document.createElement('dialog');
  dlg.className = 'ap-dialog it-prev';
  dlg.innerHTML = `<div class="ap-topo"><h2>Pré-visualização da proposta</h2><div class="ap-acoes"><button type="button" class="btn-primary it-prev-baixar">Baixar (.docx)</button><button type="button" class="btn-ghost it-prev-fechar">Fechar</button></div></div>
    <p class="m">É assim que o arquivo abre no Word. A aparência pode variar um pouco conforme a versão do Word.</p><div class="it-prev-doc"></div>`;
  document.body.append(dlg); dlg.showModal();
  dlg.querySelector('.it-prev-fechar').onclick = () => { dlg.close(); dlg.remove(); };
  dlg.querySelector('.it-prev-baixar').onclick = () => { aoBaixar(); dlg.close(); dlg.remove(); };
  await renderAsync(arquivo.blob, dlg.querySelector('.it-prev-doc'), null, { inWrapper: true, ignoreWidth: false, breakPages: true });
}

window.__extenso = extenso; // usado no teste
