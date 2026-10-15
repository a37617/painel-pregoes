// Partes comuns ao robô do GitHub (sync.mjs) e ao servidor do Wi-Fi (servidor/novos.mjs):
// download gentil da API do PNCP e o formato enxuto dos registros que o painel lê.

export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const ymd = d => d.toISOString().slice(0, 10).replace(/-/g, '');

export async function getJSON(url, tries = 6) {
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
export function slim(r) {
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
