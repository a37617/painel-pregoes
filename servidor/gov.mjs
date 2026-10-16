// Ponte para a API de dados abertos do Compras.gov (o navegador não pode chamá-la direto: CORS).
// Só consultas fixas e parâmetros conferidos; respostas guardadas por 12 horas.
const BASE = 'https://dadosabertos.compras.gov.br';
const FONTES = {
  // Preços praticados (Painel de Preços) por código CATMAT/CATSER.
  'precos-material': { caminho: '/modulo-pesquisa-preco/1_consultarMaterial', fixos: { tipo: 'codigoItemCatalogo' }, params: { codigo: /^\d{1,9}$/, estado: /^[A-Z]{2}$/ } },
  'precos-servico': { caminho: '/modulo-pesquisa-preco/3_consultarServico', fixos: { tipo: 'codigoItemCatalogo' }, params: { codigo: /^\d{1,9}$/, estado: /^[A-Z]{2}$/ } },
  // Itens que um fornecedor ganhou em contratações da Lei 14.133 (para monitorar concorrentes).
  'fornecedor': { caminho: '/modulo-contratacoes/3_consultarResultadoItensContratacoes_PNCP_14133', params: { niFornecedor: /^\d{11,14}$/, dataResultadoPncpInicial: /^\d{4}-\d{2}-\d{2}$/, dataResultadoPncpFinal: /^\d{4}-\d{2}-\d{2}$/ } },
};
const MAX_PAGINAS = 4;
const cache = new Map();

export async function consultarGov(fonte, query) {
  const f = FONTES[fonte];
  if (!f) throw Object.assign(new Error('fonte desconhecida'), { code: 400 });
  const p = new URLSearchParams({ ...f.fixos, tamanhoPagina: '500' });
  for (const [k, re] of Object.entries(f.params)) {
    const v = query.get(k);
    if (v == null || v === '') continue;
    if (!re.test(v)) throw Object.assign(new Error(`parâmetro inválido: ${k}`), { code: 400 });
    p.set(k, v);
  }
  const chave = fonte + '?' + p;
  const c = cache.get(chave);
  if (c && Date.now() - c.em < 12 * 36e5) return c.d;
  const resultado = [];
  let total = 0;
  for (let pag = 1; pag <= MAX_PAGINAS; pag++) {
    p.set('pagina', String(pag));
    const r = await fetch(`${BASE}${f.caminho}?${p}`, { signal: AbortSignal.timeout(90000) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(d.detail || `Compras.gov respondeu HTTP ${r.status}`), { code: r.status === 400 ? 400 : 502 });
    resultado.push(...(d.resultado || []));
    total = d.totalRegistros || resultado.length;
    if (pag >= (d.totalPaginas || 1)) break;
  }
  const d = { total, resultado };
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  cache.set(chave, { em: Date.now(), d });
  return d;
}
