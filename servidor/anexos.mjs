// Lê os anexos do edital publicados no PNCP (edital, termo de referência) e acha o trecho
// com as especificações de cada item. Serve para itens descritos como "conforme anexo".
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const MAX_ARQUIVOS = 4;
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_PAGINAS = 120;
const JANELA = 2500;       // caracteres antes/depois de cada menção ao item
const MAX_POR_ITEM = 7000; // tamanho máximo do trecho enviado para a pesquisa

const textos = new Map(); // controle do pregão -> Promise<[{titulo, texto}]>

// Minúsculas e sem acento, mantendo o mesmo tamanho do texto (para recortar o original depois).
const norm = s => s.split('').map(c => (c.normalize('NFD')[0] || c).toLowerCase()).join('');

const IGNORAR = new Set(('conforme especificacoes especificacao anexo anexos edital termo referencia minimas minima minimo ' +
  'unidade unidades completo completa aquisicao fornecimento material materiais tipo modelo marca descricao ' +
  'demais itens item lote para com sem pelo pela dos das nos nas uma uns').split(' '));

function palavrasChave(descricao) {
  const ws = norm(descricao).match(/[a-z0-9]{4,}/g) || [];
  return [...new Set(ws.filter(w => !IGNORAR.has(w) && !/^\d+$/.test(w)))].slice(0, 3);
}

async function baixarPdf(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(90000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error('arquivo grande demais');
  if (String.fromCharCode(...buf.slice(0, 5)) !== '%PDF-') return null; // só PDF (zip/docx ficam de fora)
  const doc = await getDocument({ data: buf, isEvalSupported: false, useSystemFonts: true, verbosity: 0 }).promise;
  let t = '';
  for (let i = 1; i <= Math.min(doc.numPages, MAX_PAGINAS); i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    t += c.items.map(x => x.str + (x.hasEOL ? '\n' : ' ')).join('') + '\n';
  }
  await doc.destroy();
  return t.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n');
}

// cnpj/ano/seq são validados como números: só baixa arquivos do próprio PNCP.
function lerAnexos({ cnpj, ano, seq }) {
  const id = `${cnpj}/${ano}/${seq}`;
  if (!textos.has(id)) {
    if (textos.size >= 30) textos.delete(textos.keys().next().value); // guarda só os pregões abertos por último
    textos.set(id, (async () => {
      const base = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${seq}/arquivos`;
      const r = await fetch(base, { signal: AbortSignal.timeout(30000) });
      if (!r.ok) return [];
      const lista = (await r.json()).filter(f => f.statusAtivo !== false).slice(0, MAX_ARQUIVOS);
      const out = [];
      for (const f of lista) {
        try {
          const texto = await baixarPdf(`${base}/${Number(f.sequencialDocumento)}`);
          if (texto && texto.trim().length > 200) out.push({ titulo: f.titulo || f.tipoDocumentoNome || 'anexo', texto });
        } catch (e) { console.warn(`[anexos] ${id} arquivo ${f.sequencialDocumento}: ${e.message}`); }
      }
      return out;
    })().catch(e => { console.warn(`[anexos] ${id}: ${e.message}`); textos.delete(id); return []; }));
  }
  return textos.get(id);
}

// Janelas de texto em volta das menções ao item, sem repetir trechos.
function janelas(texto, chaves) {
  const t = norm(texto);
  const faixas = [];
  for (const k of chaves) {
    let i = -1;
    while ((i = t.indexOf(k, i + 1)) !== -1 && faixas.length < 60) faixas.push([Math.max(0, i - 300), Math.min(t.length, i + JANELA)]);
  }
  if (!faixas.length) return [];
  faixas.sort((x, y) => x[0] - y[0]);
  const unidas = [faixas[0]];
  for (const f of faixas.slice(1)) { const u = unidas.at(-1); if (f[0] <= u[1]) u[1] = Math.max(u[1], f[1]); else unidas.push(f); }
  // Faixas longas viram pedaços menores, para um bloco de edital não ocupar todo o espaço.
  const out = [];
  for (const [x, y] of unidas) for (let i = x; i < y; i += 2800) out.push(texto.slice(i, Math.min(y, i + 2800)));
  return out;
}

// Quanto um trecho parece especificação técnica: medidas e unidades, palavras de requisito e o nome do item.
const UNIDADES = /\d+[.,]?\d*\s*(gb|tb|mb|ghz|mhz|hz|cm|mm|m\b|kg|g\b|w\b|v\b|mah|ml|l\b|pol|polegadas|"|%|rpm|dpi|ppm|btu|bits?\b|nucleos|threads)/g;
const REQUISITOS = /\b(minim[oa]|no minimo|superior|equivalente|deve(ra)?|possuir|compativel|garantia|processador|memoria|material|dimens|capacidade|potencia|voltagem)/g;
function pontuar(trecho, chaves, tituloDoc) {
  const t = norm(trecho);
  let p = (t.match(UNIDADES) || []).length * 3 + (t.match(REQUISITOS) || []).length;
  for (const k of chaves) p += (t.split(k).length - 1) * 4;
  if (/\b(tr|termo|referencia|anexo|especifica|projeto basico)\b/.test(norm(tituloDoc))) p += 40;
  p -= (t.match(/conforme especifica/g) || []).length * 3; // só remete ao anexo, não especifica
  return p;
}

// Texto dos anexos para achar a lista de itens de um lote genérico ("proposta para todos os itens").
// Termo de referência primeiro; se passar do limite, ficam os trechos com cara de tabela de itens.
const SINAL_TABELA = /\b(unid|und|un|pc|pct|cx|kg|lt|litros?|metros?|qtd|quant|quantidade|v\.? ?unit|valor unit|pre[cç]o unit)\b|r\$ ?\d/i;
export async function textoParaListaDeItens(pregao, limite = 150000) {
  const anexos = [...await lerAnexos(pregao)]
    .sort((a, b) => (/\b(tr|termo|referencia|anexo|planilha|orcament)/i.test(norm(b.titulo)) ? 1 : 0) - (/\b(tr|termo|referencia|anexo|planilha|orcament)/i.test(norm(a.titulo)) ? 1 : 0));
  const tudo = anexos.map(a => `===== ${a.titulo} =====\n${a.texto}`).join('\n');
  if (tudo.length <= limite) return { texto: tudo, arquivos: anexos.map(a => a.titulo) };
  // Grande demais: blocos de ~40 linhas, mantendo os que têm mais sinais de tabela de itens, na ordem original.
  const linhas = tudo.split('\n');
  const blocos = [];
  for (let i = 0; i < linhas.length; i += 40) {
    const txt = linhas.slice(i, i + 40).join('\n');
    blocos.push({ i, txt, p: txt.split('\n').filter(l => SINAL_TABELA.test(l)).length });
  }
  const escolhidos = [];
  let tam = 0;
  for (const b of [...blocos].sort((x, y) => y.p - x.p)) {
    if (!b.p || tam + b.txt.length > limite) continue;
    escolhidos.push(b); tam += b.txt.length;
  }
  escolhidos.sort((x, y) => x.i - y.i);
  return { texto: escolhidos.map(b => b.txt).join('\n[...]\n'), arquivos: anexos.map(a => a.titulo) };
}

export function validarPregao(p) {
  if (!p) return null;
  const cnpj = String(p.cnpj || ''), ano = String(p.ano || ''), seq = String(p.seq || '');
  return /^\d{14}$/.test(cnpj) && /^\d{4}$/.test(ano) && /^\d{1,7}$/.test(seq) ? { cnpj, ano, seq } : null;
}

// Para cada item, devolve o trecho dos anexos que fala dele (ou '' se não achou).
export async function especificacoesDosAnexos(pregao, itens) {
  const anexos = await lerAnexos(pregao);
  const res = {};
  for (const it of itens) {
    const chaves = palavrasChave(it.descricao);
    // Os trechos mais "técnicos" primeiro, até encher o espaço disponível.
    const candidatos = anexos.flatMap(a => janelas(a.texto, chaves).map(txt => ({ titulo: a.titulo, txt, p: pontuar(txt, chaves, a.titulo) })))
      .sort((x, y) => y.p - x.p);
    let trecho = '';
    for (const c of candidatos) {
      const bloco = `--- ${c.titulo} ---\n${c.txt}\n`;
      if (trecho.length + bloco.length > MAX_POR_ITEM) { if (!trecho) trecho = bloco.slice(0, MAX_POR_ITEM); continue; }
      trecho += bloco;
    }
    res[it.numero] = trecho;
  }
  return { res, arquivos: anexos.map(a => a.titulo) };
}
