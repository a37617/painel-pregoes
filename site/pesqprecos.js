// Pesquisa de Preços: quanto o governo já pagou (Compras.gov, por código CATMAT/CATSER)
// e quanto custa no mercado (pesquisa com IA no servidor do Wi-Fi).
import { registrarAba } from './app.js';
import { $, $$, esc, brl, dataBR, store } from './ui.js';

const UFS = 'AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' ');
const senha = () => store.get('pregoes.senhaServidor') || '';
const cab = () => (senha() ? { 'x-senha': senha() } : {});
let v, temServidor = null;

const mediana = l => { const s = [...l].sort((a, b) => a - b), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0; };

function desenhar() {
  v.innerHTML = `<div class="ap-topo ap-pad-x"><div><h2>Pesquisa de Preços</h2><p class="m">Preços que órgãos públicos pagaram (Compras.gov) e preço atual no mercado (IA).</p></div></div>
    ${temServidor === false ? '<div class="ui-aviso">Esta tela usa o servidor do Wi-Fi para consultar o Compras.gov e a IA. Abra o painel pelo endereço do servidor (iniciar-servidor.bat).</div>' : ''}
    <section class="card ap-pad ui-bloco">
      <h3>🏛️ Preços praticados em compras públicas</h3>
      <p class="m">Pelo código do item no catálogo do governo (CATMAT para materiais, CATSER para serviços). Não sabe o código? <a href="https://catalogo.compras.gov.br/cnbs-web/busca" target="_blank" rel="noopener">Procure no Catálogo de Compras ↗</a> ou veja o código nos itens de um pregão.</p>
      <form class="ui-filtros" id="ppGov">
        <label>Tipo<select name="tipo"><option value="material">Material (CATMAT)</option><option value="servico">Serviço (CATSER)</option></select></label>
        <label>Código<input name="codigo" required inputmode="numeric" pattern="\\d+" placeholder="Ex.: 150479" value="${esc(store.get('pregoes.ppCodigo') || '')}"></label>
        <label>UF<select name="estado"><option value="">Brasil</option>${UFS.map(u => `<option>${u}</option>`).join('')}</select></label>
        <button class="btn-primary">Buscar preços</button>
      </form>
      <div id="ppGovRes"></div>
    </section>
    <section class="card ap-pad ui-bloco">
      <h3>🛒 Preço no mercado (IA)</h3>
      <p class="m">Descreva o produto com as especificações: a IA procura em lojas brasileiras, confere as especificações em cada página e traz os links. Leva de 3 a 8 minutos.</p>
      <form class="ui-filtros" id="ppIa">
        <label class="ap-largo">Produto e especificações<textarea name="descricao" rows="3" required placeholder="Ex.: Refletor LED 200W, 6500K, IP66, bivolt"></textarea></label>
        <label>Unidade<input name="unidade" value="Unidade"></label>
        <button class="btn-primary">Pesquisar no mercado</button>
      </form>
      <div id="ppIaRes"></div>
    </section>`;
  $('#ppGov').onsubmit = buscarGov;
  $('#ppIa').onsubmit = buscarIa;
}

async function buscarGov(e) {
  e.preventDefault();
  const fd = new FormData(e.target), out = $('#ppGovRes');
  store.set('pregoes.ppCodigo', fd.get('codigo'));
  out.innerHTML = '<p class="m">Consultando o Compras.gov… pode levar até 1 minuto.</p>';
  try {
    const q = new URLSearchParams({ codigo: fd.get('codigo') }); if (fd.get('estado')) q.set('estado', fd.get('estado'));
    const r = await fetch(`api/gov/precos-${fd.get('tipo')}?${q}`);
    const d = await r.json();
    if (!r.ok) throw new Error(d.erro || 'HTTP ' + r.status);
    const l = d.resultado.filter(x => x.precoUnitario > 0).sort((a, b) => (b.dataResultado || b.dataCompra || '').localeCompare(a.dataResultado || a.dataCompra || ''));
    if (!l.length) { out.innerHTML = '<p class="empty">Nenhuma compra registrada com esse código e filtros.</p>'; return; }
    const precos = l.map(x => x.precoUnitario);
    const desc = l[0].descricaoItem || '';
    const porUf = {};
    for (const x of l) (porUf[x.estado || '—'] ||= []).push(x.precoUnitario);
    out.innerHTML = `<p><b>${esc(desc)}</b>${l[0].nomePdm ? ` · ${esc(l[0].nomePdm)}` : ''}</p>
      <div class="kpis">
        <div class="card kpi"><div class="l">Compras encontradas</div><div class="v">${l.length}</div><div class="h">${d.total > l.length ? `de ${d.total} registros` : 'registros com preço'}</div></div>
        <div class="card kpi"><div class="l">Menor preço</div><div class="v">${brl(Math.min(...precos))}</div></div>
        <div class="card kpi"><div class="l">Mediana</div><div class="v">${brl(mediana(precos))}</div><div class="h">referência mais segura</div></div>
        <div class="card kpi"><div class="l">Maior preço</div><div class="v">${brl(Math.max(...precos))}</div></div>
      </div>
      <p class="m">Mediana por UF: ${Object.entries(porUf).sort((a, b) => b[1].length - a[1].length).slice(0, 10).map(([u, p]) => `<b>${esc(u)}</b> ${brl(mediana(p))} (${p.length})`).join(' · ')}</p>
      <div class="tscroll"><table class="ui-tabela"><thead><tr><th>Data</th><th>Órgão</th><th>Fornecedor · marca</th><th class="num">Qtd.</th><th class="num">Preço unitário</th></tr></thead><tbody>
        ${l.slice(0, 200).map(x => `<tr><td>${dataBR(x.dataResultado || x.dataCompra)}</td><td>${esc(x.nomeOrgao || x.nomeUasg || '—')}<div class="m">${esc([x.municipio, x.estado].filter(Boolean).join('/'))}</div></td>
          <td>${esc(x.nomeFornecedor || '—')}<div class="m">${esc(x.marca || '')}</div></td><td class="num">${(x.quantidade || 0).toLocaleString('pt-BR')} ${esc(x.siglaUnidadeFornecimento || '')}</td><td class="num"><b>${brl(x.precoUnitario)}</b></td></tr>`).join('')}
      </tbody></table></div>`;
  } catch (err) { out.innerHTML = `<p class="pz-ruim">Não deu certo: ${esc(err.message)}</p>`; }
}

async function buscarIa(e) {
  e.preventDefault();
  const fd = new FormData(e.target), out = $('#ppIaRes'), botao = $('button', e.target);
  botao.disabled = true;
  out.innerHTML = '<p class="m">Enviando para a IA…</p>';
  try {
    let r = await fetch('api/pesquisa-preco', { method: 'POST', headers: { 'content-type': 'application/json', ...cab() }, body: JSON.stringify({ itens: [{ numero: 1, descricao: fd.get('descricao'), unidade: fd.get('unidade') }] }) });
    let job = await r.json();
    if (!r.ok) throw new Error(r.status === 401 ? 'este aparelho precisa da senha do servidor (ela aparece na janela do servidor)' : job.erro);
    const t0 = Date.now();
    while (job.status !== 'pronto' && job.status !== 'erro') {
      out.innerHTML = `<p class="m">${job.status === 'na fila' ? 'Na fila, esperando outra pesquisa terminar…' : `Pesquisando lojas e conferindo especificações… ${Math.round((Date.now() - t0) / 1000)}s`}</p>`;
      await new Promise(res => setTimeout(res, 4000));
      job = await (await fetch('api/pesquisa-preco/' + job.id, { headers: cab() })).json();
    }
    if (job.status === 'erro') throw new Error(job.erro);
    const x = job.resultado[1];
    if (!x || !(x.preco_unitario_mediano > 0)) { out.innerHTML = `<p class="pz-ruim">Nenhum produto compatível encontrado.</p>${x?.observacao ? `<p class="m">${esc(x.observacao)}</p>` : ''}`; return; }
    out.innerHTML = `<div class="kpis"><div class="card kpi"><div class="l">Mediana no mercado</div><div class="v">${brl(x.preco_unitario_mediano)}</div><div class="h">confiança ${esc(x.confianca)}</div></div>
      <div class="card kpi"><div class="l">Menor preço</div><div class="v">${brl(x.preco_unitario_minimo)}</div></div>
      <div class="card kpi"><div class="l">Atendem a tudo</div><div class="v">${x.compativeis} de ${x.fontes.length}</div><div class="h">produtos conferidos</div></div></div>
      ${x.produto_encontrado ? `<p><b>Modelo que atende:</b> ${esc(x.produto_encontrado)}</p>` : ''}
      <ul class="ui-lista">${x.fontes.map(f => `<li><span class="badge ${f.compativel === 'sim' ? 'ok' : f.compativel === 'nao' ? 'hot' : 'soon'}">${f.compativel === 'sim' ? 'atende' : f.compativel === 'nao' ? 'não atende' : 'sem confirmar'}</span> <a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">${esc(f.loja)}</a> ${brl(f.preco)} · <span class="m">${esc(f.produto)}</span></li>`).join('')}</ul>
      ${x.observacao ? `<p class="m">${esc(x.observacao)}</p>` : ''}`;
  } catch (err) { out.innerHTML = `<p class="pz-ruim">Não deu certo: ${esc(err.message)}</p>`; }
  finally { botao.disabled = false; }
}

v = registrarAba('pesqprecos', '💲 Pesquisa de Preços', async () => {
  if (temServidor === null) temServidor = await fetch('api/status').then(r => r.ok).catch(() => false);
  desenhar();
});
