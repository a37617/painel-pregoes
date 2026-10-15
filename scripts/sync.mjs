// Baixa do PNCP todos os pregões (eletrônicos e presenciais) com propostas em aberto
// e grava em site/data/pregoes.json, num formato enxuto que o painel lê ao abrir.
// Uso: node scripts/sync.mjs
import { mkdir, writeFile } from 'node:fs/promises';

const API = 'https://pncp.gov.br/api/consulta/v1/contratacoes/proposta';
const MODALIDADES = [6, 7]; // 6 = Pregão eletrônico, 7 = Pregão presencial
const PAGE_SIZE = 50;
const CONCURRENCY = 3;
const OUT = new URL('../site/data/pregoes.json', import.meta.url);

const ymd = d => d.toISOString().slice(0, 10).replace(/-/g, '');
// "dataFinal" é o limite do encerramento das propostas; 2 anos à frente cobre tudo que está aberto.
const dataFinal = ymd(new Date(Date.now() + 730 * 864e5));
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJSON(url, tries = 6) {
  for (let i = 1; i <= tries; i++) {
    let wait = 1500 * i;
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (r.status === 204) return null;
      if (r.status === 429) { // o PNCP limita o ritmo: espera o que ele pedir (ou um tempo crescente)
        wait = (Number(r.headers.get('retry-after')) || 10 * i) * 1000;
        throw new Error('HTTP 429');
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (i === tries) throw new Error(`${e.message} em ${url}`);
      await sleep(wait);
    }
  }
}

// Campos curtos para o arquivo ficar pequeno; o painel converte de volta.
function slim(r) {
  return {
    c: r.numeroControlePNCP,
    m: r.modalidadeId,
    n: r.numeroCompra,
    a: r.anoCompra,
    s: r.sequencialCompra,
    o: (r.objetoCompra || '').trim(),
    i: r.informacaoComplementar && r.informacaoComplementar.trim() !== (r.objetoCompra || '').trim()
      ? r.informacaoComplementar.trim().slice(0, 600) : undefined,
    g: r.orgaoEntidade?.razaoSocial,
    j: r.orgaoEntidade?.cnpj,
    un: r.unidadeOrgao?.nomeUnidade,
    uf: r.unidadeOrgao?.ufSigla,
    mu: r.unidadeOrgao?.municipioNome,
    v: r.valorTotalEstimado || undefined,
    h: r.valorTotalHomologado || undefined,
    sr: r.srp ? 1 : undefined,
    ab: r.dataAberturaProposta,
    en: r.dataEncerramentoProposta,
    pu: r.dataPublicacaoPncp,
    d: r.modoDisputaNome,
    st: r.situacaoCompraNome,
    p: r.processo,
    al: r.amparoLegal?.nome,
    l: r.linkSistemaOrigem || undefined,
  };
}

async function fetchModalidade(mod) {
  const base = `${API}?dataFinal=${dataFinal}&codigoModalidadeContratacao=${mod}&tamanhoPagina=${PAGE_SIZE}`;
  const first = await getJSON(`${base}&pagina=1`);
  if (!first?.data?.length) return { rows: [], failed: 0 };
  const rows = [...first.data];
  const queue = Array.from({ length: first.totalPaginas - 1 }, (_, k) => k + 2);
  let failed = 0, done = 1;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const n = queue.shift();
      try { const d = await getJSON(`${base}&pagina=${n}`); if (d?.data) rows.push(...d.data); }
      catch (e) { failed++; console.warn(e.message); }
      await sleep(400); // ritmo gentil: o PNCP bloqueia (HTTP 429) quem pede rápido demais
      if (++done % 25 === 0) console.log(`  modalidade ${mod}: ${done}/${first.totalPaginas} páginas`);
    }
  }));
  console.log(`Modalidade ${mod}: ${rows.length} de ${first.totalRegistros} registros, ${failed} página(s) com falha`);
  return { rows, failed, total: first.totalRegistros, pages: first.totalPaginas };
}

const t0 = Date.now();
const results = [];
for (const mod of MODALIDADES) results.push(await fetchModalidade(mod));

const seen = new Set();
const now = Date.now();
const registros = results.flatMap(r => r.rows)
  .filter(r => !seen.has(r.numeroControlePNCP) && seen.add(r.numeroControlePNCP))
  .filter(r => !r.dataEncerramentoProposta || new Date(r.dataEncerramentoProposta) > now - 864e5)
  .map(slim);

const totalPages = results.reduce((s, r) => s + (r.pages || 0), 0);
const failedPages = results.reduce((s, r) => s + r.failed, 0);
// Se muita coisa falhou, não sobrescreve os dados bons da execução anterior.
if (!registros.length || failedPages > totalPages * 0.2) {
  console.error(`Abortado: ${failedPages} de ${totalPages} páginas falharam.`);
  process.exit(1);
}

await mkdir(new URL('.', OUT), { recursive: true });
await writeFile(OUT, JSON.stringify({
  atualizadoEm: new Date().toISOString(),
  totalPncp: results.reduce((s, r) => s + (r.total || 0), 0),
  paginasComFalha: failedPages,
  registros,
}));
console.log(`OK: ${registros.length} pregões gravados em ${((Date.now() - t0) / 1000).toFixed(0)}s`);
