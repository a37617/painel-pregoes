import { getPrefs, panelLink, pncpLink } from './shared.js';

const $ = id => document.getElementById(id);
const UFS = 'AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' ');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const brl = v => v == null ? 'sem valor' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtDT = s => s ? new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';

UFS.forEach(u => $('uf').insertAdjacentHTML('beforeend', `<option>${u}</option>`));

function badge(en) {
  if (!en) return '';
  const h = (new Date(en) - Date.now()) / 36e5;
  if (h <= 0) return '<span class="badge">encerrado</span>';
  if (h < 48) return `<span class="badge hot">${h < 24 ? Math.max(1, Math.round(h)) + 'h' : '1 dia'}</span>`;
  const d = Math.round(h / 24);
  return `<span class="badge ${d <= 7 ? 'soon' : ''}">${d} dias</span>`;
}

async function render() {
  const prefs = await getPrefs();
  const st = await chrome.storage.local.get(['lista', 'total', 'novos', 'atualizadoEm', 'verificadoEm', 'erro']);
  $('painel').href = panelLink(prefs);
  const filtrando = !!(prefs.q || prefs.uf || prefs.vmin);
  if (!filtrando) $('cfg').open = true;

  if (st.erro && !st.lista) {
    $('summary').innerHTML = `Não consegui buscar os dados (${esc(st.erro)}).`;
  } else if (!st.lista) {
    $('summary').textContent = 'Buscando pregões…';
  } else {
    const novos = new Set(st.novos || []);
    $('summary').innerHTML = filtrando
      ? `<b>${st.total.toLocaleString('pt-BR')}</b> pregões abertos batem com seus filtros${novos.size ? ` · <b>${novos.size}</b> novos` : ''}`
      : `<b>${st.total.toLocaleString('pt-BR')}</b> pregões abertos no Brasil. Defina palavras-chave acima para receber avisos.`;
    $('list').innerHTML = st.lista.length ? st.lista.slice(0, 50).map(r => `<li><a href="${pncpLink(r)}" target="_blank">
        <div class="o">${esc(r.o)}</div>
        <div class="m">${novos.has(r.c) ? '<span class="badge new">novo</span>' : ''}${badge(r.en)}<span>${esc(r.g)} · ${esc(r.mu)}/${esc(r.uf)}</span></div>
        <div class="m"><span>${brl(r.v)}</span><span>encerra ${fmtDT(r.en)}</span></div></a></li>`).join('')
      : '<div class="empty">Nenhum pregão aberto com esses filtros agora.</div>';
  }
  $('upd').textContent = st.atualizadoEm ? `Dados do PNCP de ${fmtDT(st.atualizadoEm)}` : '';
}

// Ao abrir o popup, o que estava "novo" passa a ser visto: some o número do ícone.
async function markSeen() {
  const { ids = [], seen = [] } = await chrome.storage.local.get(['ids', 'seen']);
  await chrome.storage.local.set({ seen: [...new Set([...seen, ...ids])].slice(-30000) });
  chrome.action.setBadgeText({ text: '' });
}

(async () => {
  const prefs = await getPrefs();
  $('q').value = prefs.q; $('uf').value = prefs.uf; $('vmin').value = prefs.vmin; $('notificar').checked = prefs.notificar;
  await render();
  markSeen();
})();

$('prefs').addEventListener('submit', async e => {
  e.preventDefault();
  await chrome.storage.sync.set({ q: $('q').value.trim(), uf: $('uf').value, vmin: $('vmin').value, notificar: $('notificar').checked });
  $('cfg').open = false;
  $('summary').textContent = 'Atualizando…';
  await chrome.runtime.sendMessage('check');
  await render();
  markSeen();
});

$('refresh').onclick = async () => {
  $('summary').textContent = 'Verificando…';
  await chrome.runtime.sendMessage('check');
  await render();
  markSeen();
};

chrome.storage.onChanged.addListener((_c, area) => { if (area === 'local') render(); });
