// Onde ficam perfis e Kanban: no servidor do Wi-Fi (todos os aparelhos veem o mesmo) ou,
// no painel online do GitHub, só neste navegador.
const cache = {};
let modo = null; // 'servidor' | 'navegador'

const senha = () => { try { return localStorage.getItem('pregoes.senhaServidor') || ''; } catch { return ''; } };
const cab = () => (senha() ? { 'x-senha': senha() } : {});

export async function descobrirModo() {
  if (modo) return modo;
  try {
    const r = await fetch('api/status', { headers: cab() });
    const s = r.ok ? await r.json() : null;
    modo = s ? 'servidor' : 'navegador';
    if (s && !s.liberado) modo = 'senha'; // servidor existe, mas este aparelho precisa da senha
  } catch { modo = 'navegador'; }
  return modo;
}

export function definirSenha(s) { try { localStorage.setItem('pregoes.senhaServidor', s.trim()); } catch {} modo = null; }

export async function carregar(nome) {
  const m = await descobrirModo();
  if (m === 'servidor') {
    const r = await fetch('api/dados/' + nome, { headers: cab(), cache: 'no-store' });
    if (r.status === 401) { modo = 'senha'; throw new Error('senha'); }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    cache[nome] = await r.json();
  } else if (m === 'senha') {
    throw new Error('senha');
  } else {
    let itens = [];
    try { itens = JSON.parse(localStorage.getItem('pregoes.dados.' + nome) || '[]'); } catch {}
    cache[nome] = { versao: 0, itens };
  }
  return cache[nome].itens;
}

// Salva a coleção inteira. Se outro aparelho salvou antes, avisa e devolve os dados atuais.
export async function salvar(nome, itens) {
  const m = await descobrirModo();
  if (m === 'servidor') {
    const r = await fetch('api/dados/' + nome, {
      method: 'PUT', headers: { 'content-type': 'application/json', ...cab() },
      body: JSON.stringify({ versao: cache[nome]?.versao ?? 0, itens }),
    });
    const d = await r.json();
    if (r.status === 409) {
      cache[nome] = d.atual;
      throw Object.assign(new Error('Outro aparelho salvou alterações antes. A tela foi atualizada com a versão mais recente; refaça a última mudança.'), { conflito: true, itens: d.atual.itens });
    }
    if (!r.ok) throw new Error(d.erro || 'HTTP ' + r.status);
    cache[nome] = d;
  } else {
    try { localStorage.setItem('pregoes.dados.' + nome, JSON.stringify(itens)); }
    catch { throw new Error('O navegador não deixou salvar (memória cheia ou modo anônimo).'); }
    cache[nome] = { versao: 0, itens };
  }
  window.dispatchEvent(new CustomEvent('dados-alterados', { detail: nome }));
  return itens;
}

export const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
