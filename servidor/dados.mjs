// Dados do usuário (perfis de empresa, Kanban) guardados em servidor/dados/<coleção>.json.
// Cada gravação leva a versão lida: se outro aparelho salvou antes, a gravação é recusada (409)
// e a tela recarrega, para ninguém apagar o trabalho do outro sem querer.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PASTA = fileURLToPath(new URL('dados/', import.meta.url));
export const COLECOES = new Set(['perfis', 'kanban']);
const MAX_BYTES = 8 * 1024 * 1024; // logos em base64 cabem folgado

const memoria = new Map(); // nome -> { versao, itens }

async function abrir(nome) {
  if (!memoria.has(nome)) {
    let d = { versao: 0, itens: [] };
    try { d = JSON.parse(await readFile(join(PASTA, nome + '.json'), 'utf8')); } catch {}
    memoria.set(nome, d);
  }
  return memoria.get(nome);
}

export async function ler(nome) {
  return abrir(nome);
}

export async function gravar(nome, { versao, itens }, tamanho) {
  if (tamanho > MAX_BYTES) throw Object.assign(new Error('dados grandes demais'), { code: 413 });
  if (!Array.isArray(itens)) throw Object.assign(new Error('formato inválido'), { code: 400 });
  const atual = await abrir(nome);
  if (Number(versao) !== atual.versao) throw Object.assign(new Error('Outro aparelho salvou antes. Recarregue.'), { code: 409, atual });
  const novo = { versao: atual.versao + 1, itens };
  await mkdir(PASTA, { recursive: true });
  const tmp = join(PASTA, nome + '.json.tmp');
  await writeFile(tmp, JSON.stringify(novo));
  await rename(tmp, join(PASTA, nome + '.json')); // troca atômica: nunca fica arquivo pela metade
  memoria.set(nome, novo);
  return novo;
}
