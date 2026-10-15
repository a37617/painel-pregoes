// Servidor do painel para a rede Wi-Fi de casa/escritório.
// Serve a pasta site/ para qualquer aparelho da rede e mantém os dados atualizados
// copiando o arquivo que o robô do GitHub publica (sem sobrecarregar o PNCP).
// Uso: node servidor/server.mjs   (ou dê dois cliques em iniciar-servidor.bat)
import http from 'node:http';
import os from 'node:os';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

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

async function atualizarDados() {
  try {
    const r = await fetch(ORIGEM, { signal: AbortSignal.timeout(120000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const txt = await r.text();
    const d = JSON.parse(txt); // garante que veio um arquivo válido antes de trocar
    await mkdir(join(SITE, 'data'), { recursive: true });
    await writeFile(DATA, txt);
    console.log(`[${hora()}] Dados atualizados: ${d.registros.length.toLocaleString('pt-BR')} pregões (PNCP de ${new Date(d.atualizadoEm).toLocaleString('pt-BR')})`);
  } catch (e) {
    const tem = await stat(DATA).then(() => true, () => false);
    console.warn(`[${hora()}] Não consegui atualizar os dados (${e.message}).${tem ? ' Continuo com os dados anteriores.' : ''}`);
  }
}

const server = http.createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(SITE, path));
  if (!file.startsWith(normalize(SITE))) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': TIPOS[extname(file)] || 'application/octet-stream',
      'cache-control': path.endsWith('.json') ? 'no-cache' : 'max-age=300',
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
  console.log('Deixe esta janela aberta. Para parar, feche-a ou aperte Ctrl+C.\n');
  await atualizarDados();
  setInterval(atualizarDados, ATUALIZAR_MIN * 60000);
});
