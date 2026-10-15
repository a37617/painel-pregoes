// Verifica os pregões a cada hora, guarda os que batem com as palavras-chave
// e avisa (notificação + número no ícone) quando aparecem novos.
import { DATA_URL, getPrefs, match } from './shared.js';

const CHECK_MINUTES = 60;

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('check', { periodInMinutes: CHECK_MINUTES, delayInMinutes: 0.1 });
});
chrome.runtime.onStartup.addListener(() => check());
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'check') check(); });
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg === 'check') { check({ silent: true }).then(() => reply(true)); return true; }
});
chrome.notifications.onClicked.addListener(() => chrome.action.openPopup?.().catch(() => {}));

export async function check({ silent = false } = {}) {
  try {
    const r = await fetch(DATA_URL, { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    const prefs = await getPrefs();
    const found = match(data.registros, prefs);
    const ids = found.map(x => x.c);
    let { seen } = await chrome.storage.local.get('seen');
    if (!seen) { seen = ids; await chrome.storage.local.set({ seen }); } // primeira execução: nada é "novo"
    const seenSet = new Set(seen);
    const novos = found.filter(x => !seenSet.has(x.c));

    await chrome.storage.local.set({
      atualizadoEm: data.atualizadoEm,
      verificadoEm: new Date().toISOString(),
      total: found.length,
      ids,
      novos: novos.map(x => x.c),
      lista: found.slice(0, 100),
      erro: null,
    });
    // Sem palavras-chave a lista inclui o Brasil todo; aí só mostramos, sem badge nem alerta.
    const filtrando = !!(prefs.q || prefs.uf || prefs.vmin);
    chrome.action.setBadgeBackgroundColor({ color: '#a4521b' });
    chrome.action.setBadgeText({ text: filtrando && novos.length ? String(Math.min(novos.length, 999)) : '' });

    if (!silent && filtrando && prefs.notificar && novos.length) {
      const top = novos[0];
      chrome.notifications.create('novos', {
        type: 'basic',
        iconUrl: 'icons/128.png',
        title: `${novos.length} pregão(ões) novo(s) para você`,
        message: `${top.o.slice(0, 120)}\n${top.g} · ${top.mu}/${top.uf}`,
        priority: 1,
      });
    }
  } catch (e) {
    await chrome.storage.local.set({ erro: e.message, verificadoEm: new Date().toISOString() });
  }
}
