// Baixa do PNCP todos os pregões (eletrônicos e presenciais) com propostas em aberto
// e grava em site/data/pregoes.json, num formato enxuto que o painel lê ao abrir.
// Uso: node scripts/sync.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { getJSON, slim, sleep, ymd } from './pncp.mjs';

const API = 'https://pncp.gov.br/api/consulta/v1/contratacoes/proposta';
const MODALIDADES = [6, 7]; // 6 = Pregão eletrônico, 7 = Pregão presencial
const PAGE_SIZE = 50;
const CONCURRENCY = 3;
const OUT = new URL('../site/data/pregoes.json', import.meta.url);

// "dataFinal" é o limite do encerramento das propostas; 2 anos à frente cobre tudo que está aberto.
const dataFinal = ymd(new Date(Date.now() + 730 * 864e5));

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
