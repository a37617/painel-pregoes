// Endereços do painel publicado no GitHub Pages.
export const PANEL_URL = 'https://a37617.github.io/painel-pregoes/';
export const DATA_URL = PANEL_URL + 'data/pregoes.json';

export const DEFAULTS = { q: '', uf: '', vmin: '', notificar: true };

export const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export async function getPrefs() {
  return { ...DEFAULTS, ...(await chrome.storage.sync.get(Object.keys(DEFAULTS))) };
}

// Aplica as preferências aos registros do arquivo de dados (mesmo formato enxuto do painel).
export function match(registros, prefs) {
  const terms = prefs.q.split(',').map(t => norm(t.trim())).filter(Boolean);
  const vmin = parseFloat(prefs.vmin);
  const now = Date.now();
  return registros
    .filter(r => (!r.en || new Date(r.en) > now) &&
      (!prefs.uf || r.uf === prefs.uf) &&
      (isNaN(vmin) || (r.v ?? 0) >= vmin) &&
      (!terms.length || terms.some(t => norm(r.o + ' ' + (r.i || '')).includes(t))))
    .sort((a, b) => new Date(a.en || 8.64e15) - new Date(b.en || 8.64e15));
}

export function panelLink(prefs) {
  const h = new URLSearchParams();
  if (prefs.q) h.set('q', prefs.q);
  if (prefs.uf) h.set('uf', prefs.uf);
  if (prefs.vmin) h.set('vmin', prefs.vmin);
  return PANEL_URL + (h.toString() ? '#' + h : '');
}

export const pncpLink = r => `https://pncp.gov.br/app/editais/${r.j}/${r.a}/${r.s}`;
