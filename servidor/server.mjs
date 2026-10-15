// Servidor do painel para a rede Wi-Fi de casa/escritório.
// Serve a pasta site/ para qualquer aparelho da rede e mantém os dados atualizados:
// a cada 30 minutos copia o arquivo completo que o robô do GitHub publica e busca
// no PNCP só os pregões publicados depois dele.
// Uso: node servidor/server.mjs   (ou dê dois cliques em iniciar-servidor.bat)
import http from 'node:http';
import os from 'node:os';
import { readFile, writeFile, mkdir, stat, appendFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { criarPesquisa, verPesquisa, pesquisaDisponivel } from './precos.mjs';
import { buscarNovos } from './novos.mjs';

const PORT = Number(process.env.PORT) || 8080;
const SITE = fileURLToPath(new URL('../site/', import.meta.url));
const DATA = join(SITE, 'data', 'pregoes.json');
const ORIGEM = 'https://a37617.github.io/painel-pregoes/data/pregoes.json';
const ATUALIZAR_MIN = 30;

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.zip': 'application/zip', '.ico': 'image/x-icon',
};

const hora = () => new Date().toLocaleTimeString('pt-BR');

// Além da janela, as mensagens vão para servidor/registro.log (útil quando a janela fica minimizada).
const ARQ_LOG = fileURLToPath(new URL('registro.log', import.meta.url));
for (const nivel of ['log', 'warn']) {
  const original = console[nivel].bind(console);
  console[nivel] = (...a) => {
    original(...a);
    appendFile(ARQ_LOG, `${new Date().toLocaleDateString('pt-BR')} ${a.join(' ')}\n`).catch(() => {});
  };
}
stat(ARQ_LOG).then(s => { if (s.size > 2e6) return writeFile(ARQ_LOG, ''); }).catch(() => {});

// Dados = arquivo completo do robô do GitHub (base) + pregões novos que este servidor
// achou no PNCP depois dele (extras). Os extras ficam salvos para sobreviver a reinícios.
const ARQ_NOVOS = fileURLToPath(new URL('novos.json', import.meta.url));
let base = null;
let extras = new Map();
let ultimaBusca = null;
try {
  const s = JSON.parse(await readFile(ARQ_NOVOS, 'utf8'));
  extras = new Map(s.registros.map(r => [r.c, r]));
  ultimaBusca = s.ultimaBusca ? new Date(s.ultimaBusca) : null;
} catch {}

async function baixarBase() {
  try {
    const r = await fetch(ORIGEM, { signal: AbortSignal.timeout(120000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    if (!Array.isArray(d.registros)) throw new Error('arquivo inválido');
    base = d;
  } catch (e) {
    if (!base) base = await readFile(DATA, 'utf8').then(JSON.parse).catch(() => null);
    console.warn(`[${hora()}] Não consegui baixar os dados do GitHub (${e.message}).${base ? ' Continuo com os anteriores.' : ''}`);
  }
}

async function buscarNovosNoPncp() {
  if (!base) return;
  // Desde a última busca (ou desde a coleta completa do GitHub), com 1 hora de folga.
  const desde = new Date(Math.max(new Date(base.atualizadoEm) - 36e5, ultimaBusca ? ultimaBusca - 36e5 : 0));
  try {
    const { registros, paginas, bloqueado, motivo } = await buscarNovos(desde);
    for (const r of registros) extras.set(r.c, r);
    // Com bloqueio, não avança a marca de tempo: o próximo ciclo busca de novo o mesmo período.
    if (!bloqueado) ultimaBusca = new Date();
    console.log(`[${hora()}] PNCP: ${registros.length} pregão(ões) publicado(s) desde ${desde.toLocaleString('pt-BR')} (${paginas} página(s))${bloqueado ? ` · parei antes do fim (${motivo}); continuo no próximo ciclo` : ''}`);
  } catch (e) {
    console.warn(`[${hora()}] Não consegui buscar os pregões novos no PNCP (${e.message}).`);
  }
}

async function gravarDados() {
  if (!base) return;
  const agora = Date.now();
  const naBase = new Set(base.registros.map(r => r.c));
  // Some o que o GitHub já trouxe e o que já encerrou.
  for (const [c, r] of extras) if (naBase.has(c) || (r.en && new Date(r.en) <= agora)) extras.delete(c);
  const registros = base.registros.concat([...extras.values()]);
  await mkdir(join(SITE, 'data'), { recursive: true });
  await writeFile(DATA, JSON.stringify({ ...base, registros, novosLocais: extras.size, atualizadoLocalEm: ultimaBusca?.toISOString() }));
  await writeFile(ARQ_NOVOS, JSON.stringify({ ultimaBusca, registros: [...extras.values()] })).catch(() => {});
  console.log(`[${hora()}] Painel com ${registros.length.toLocaleString('pt-BR')} pregões (${extras.size} novo(s) ainda não coletado(s) pelo GitHub)`);
}

let rodando = false;
async function atualizarDados() {
  if (rodando) return;
  rodando = true;
  try { await baixarBase(); await buscarNovosNoPncp(); await gravarDados(); }
  finally { rodando = false; }
}

const json = (res, code, obj) => res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }).end(JSON.stringify(obj));

// A pesquisa de preços dispara o Claude: só vale neste computador ou com a senha do servidor.
const ARQ_SENHA = fileURLToPath(new URL('senha.txt', import.meta.url));
let SENHA = (await readFile(ARQ_SENHA, 'utf8').catch(() => '')).trim();
if (!SENHA) {
  SENHA = randomBytes(9).toString('base64url');
  await writeFile(ARQ_SENHA, SENHA + '\n');
}
const ehLocal = req => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
function senhaOk(req) {
  const a = Buffer.from(String(req.headers['x-senha'] || ''));
  const b = Buffer.from(SENHA);
  return a.length === b.length && timingSafeEqual(a, b);
}
const tentativas = new Map(); // ip -> [horários de senhas erradas]
function bloqueado(ip) {
  const t = (tentativas.get(ip) || []).filter(x => Date.now() - x < 15 * 60000);
  tentativas.set(ip, t);
  return t.length >= 10;
}

async function api(req, res, path) {
  const liberado = ehLocal(req) || senhaOk(req);
  if (path === '/api/status') return json(res, 200, { pesquisa: pesquisaDisponivel(), liberado });
  if (path.startsWith('/api/pesquisa-preco')) {
    const ip = req.socket.remoteAddress;
    if (bloqueado(ip)) return json(res, 429, { erro: 'Muitas senhas erradas. Tente de novo em 15 minutos.' });
    if (!liberado) {
      if (req.headers['x-senha']) tentativas.get(ip).push(Date.now());
      return json(res, 401, { erro: 'Senha necessária' });
    }
  }
  if (path === '/api/pesquisa-preco' && req.method === 'POST') {
    let body = '';
    for await (const c of req) { body += c; if (body.length > 200000) return json(res, 413, { erro: 'pedido grande demais' }); }
    let pedido;
    try { pedido = JSON.parse(body); } catch { return json(res, 400, { erro: 'pedido inválido' }); }
    try { return json(res, 202, criarPesquisa(pedido)); }
    catch (e) { return json(res, e.code || 500, { erro: e.message }); }
  }
  const m = path.match(/^\/api\/pesquisa-preco\/(\d+)$/);
  if (m) { const j = verPesquisa(m[1]); return j ? json(res, 200, j) : json(res, 404, { erro: 'pesquisa não encontrada' }); }
  return json(res, 404, { erro: 'rota não encontrada' });
}

const server = http.createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.startsWith('/api/')) return api(req, res, path);
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(SITE, path));
  if (!file.startsWith(normalize(SITE))) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': TIPOS[extname(file)] || 'application/octet-stream',
      // Código e dados sempre conferidos com o servidor: depois de uma atualização o navegador já pega a versão nova.
      'cache-control': /\.(json|html|js|css)$/.test(file) ? 'no-cache' : 'max-age=300',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Não encontrado');
  }
});

server.listen(PORT, '0.0.0.0', async () => {
  const ips = Object.values(os.networkInterfaces()).flat()
    .filter(i => i && i.family === 'IPv4' && !i.internal && !i.address.startsWith('169.254'))
    .map(i => i.address);
  console.log('Painel de Pregões no ar. Abra em qualquer aparelho do Wi-Fi:');
  ips.forEach(ip => console.log(`   http://${ip}:${PORT}`));
  console.log(`   (neste computador: http://localhost:${PORT})`);
  console.log(`Senha da pesquisa de preços em outros aparelhos: ${SENHA}  (está em servidor\\senha.txt)`);
  console.log('Deixe esta janela aberta. Para parar, feche-a ou aperte Ctrl+C.\n');
  await atualizarDados();
  setInterval(atualizarDados, ATUALIZAR_MIN * 60000);
});
