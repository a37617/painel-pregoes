// Busca no PNCP só os pregões publicados desde a última vez (poucas páginas),
// para os novos aparecerem no painel do Wi-Fi sem esperar o robô do GitHub.
// O PNCP bloqueia (HTTP 429) quem pede rápido demais: aqui vai uma página por vez, com pausa,
// e se vier bloqueio a busca para e guarda o que já achou; o próximo ciclo continua.
import { slim, sleep } from '../scripts/pncp.mjs';

const API = 'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao';
const MODALIDADES = [6, 7];
const MAX_PAGINAS = 60;
const PAUSA_MS = 3000; // com 1,5 s o PNCP ainda bloqueava depois de umas 6 páginas

// Data local (o PNCP filtra por dia de publicação no horário de Brasília).
const dia = d => { const x = new Date(d - d.getTimezoneOffset() * 6e4); return x.toISOString().slice(0, 10).replace(/-/g, ''); };

async function pagina(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(90000) });
  if (r.status === 204) return null;
  if (r.status === 429) throw Object.assign(new Error('o PNCP pediu para esperar (HTTP 429)'), { bloqueio: true });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

// O PNCP devolve do mais antigo para o mais novo: lendo a partir da última página,
// bastam 1 ou 2 páginas por modalidade para achar o que saiu desde a última busca.
export async function buscarNovos(desde) {
  const inicio = dia(desde);
  const fim = dia(new Date());
  const agora = Date.now();
  const achados = [];
  let paginas = 0, bloqueado = false, motivo = '';
  const url = (mod, tam, p) => `${API}?dataInicial=${inicio}&dataFinal=${fim}&codigoModalidadeContratacao=${mod}&tamanhoPagina=${tam}&pagina=${p}`;
  try {
    for (const mod of MODALIDADES) {
      if (paginas) await sleep(PAUSA_MS);
      const topo = await pagina(url(mod, 10, 1)); // só para saber o total
      paginas++;
      const total = topo?.totalRegistros || 0;
      for (let p = Math.ceil(total / 50); p >= 1 && paginas < MAX_PAGINAS; p--) {
        await sleep(PAUSA_MS);
        const d = await pagina(url(mod, 50, p));
        paginas++;
        let antigos = 0;
        for (const r of d?.data || []) {
          if (new Date(r.dataPublicacaoPncp) < desde) { antigos++; continue; }
          if (r.dataEncerramentoProposta && new Date(r.dataEncerramentoProposta) <= agora) continue; // já fechou
          achados.push(slim(r));
        }
        if (antigos) break; // chegou na parte que já tinha sido vista
      }
    }
  } catch (e) {
    // Bloqueio, lentidão ou erro do PNCP: fica com o que já achou e o próximo ciclo tenta de novo.
    bloqueado = true;
    motivo = e.bloqueio ? e.message : e.name === 'TimeoutError' ? 'o PNCP demorou demais para responder' : e.message;
  }
  return { registros: achados, paginas, bloqueado, motivo };
}
