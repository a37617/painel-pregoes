// Peças comuns às telas da Fase 3 (Documentos, Pós-licitação, Jurídico, Preços, Monitoramento, Lances).
import { estado } from './app.js';
import { carregar, salvar } from './loja.js';

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const brl = (v, casas = 2) => v === '' || v == null || isNaN(v) ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: casas, maximumFractionDigits: casas });
// Aceita "117.66" (campo numérico) e "1.234,56" (digitado no formato brasileiro).
export const num = v => {
  const s = String(v ?? '').trim();
  const n = parseFloat(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return isNaN(n) ? 0 : n;
};
export const dataBR = s => s ? new Date(s.length === 10 ? s + 'T12:00' : s).toLocaleDateString('pt-BR') : '—';
export const hojeISO = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
export const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };

// Dias até uma data (negativo = já passou).
export const diasAte = s => Math.ceil((new Date(s.length === 10 ? s + 'T23:59' : s) - Date.now()) / 864e5);

// Soma dias úteis (seg a sex; não conta feriados) a partir de uma data. Negativo volta no calendário.
export function diasUteis(dataISO, n) {
  const d = new Date(dataISO.length === 10 ? dataISO + 'T12:00' : dataISO);
  const passo = n < 0 ? -1 : 1;
  let faltam = Math.abs(n);
  while (faltam > 0) { d.setDate(d.getDate() + passo); if (d.getDay() !== 0 && d.getDay() !== 6) faltam--; }
  return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
}

// Seletor de empresa (perfil), lembrado por tela.
export function seletorPerfil(chave, comTodas = true) {
  const atual = store.get(chave) ?? (comTodas ? '' : estado.perfis[0]?.id || '');
  return `<label class="ui-perfil">Empresa / perfil <select data-perfil="${esc(chave)}">
    ${comTodas ? '<option value="">Todas as empresas</option>' : ''}
    ${estado.perfis.map(p => `<option value="${esc(p.id)}" ${p.id === atual ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}
  </select></label>`;
}
export const perfilEscolhido = (chave, comTodas = true) => store.get(chave) ?? (comTodas ? '' : estado.perfis[0]?.id || '');
export const nomePerfil = idp => estado.perfis.find(p => p.id === idp)?.nome || '';
export function ligarSeletorPerfil(raiz, aoMudar) {
  $$('[data-perfil]', raiz).forEach(s => s.onchange = () => { store.set(s.dataset.perfil, s.value); aoMudar(); });
}

// Coleção guardada no servidor do Wi-Fi (ou no navegador), com tratamento de conflito.
export function colecao(nome) {
  let itens = [], pronto = false;
  return {
    get itens() { return itens; },
    get pronto() { return pronto; },
    async carregar() { try { itens = await carregar(nome); } catch (e) { if (e.message !== 'senha') console.warn(nome, e); } pronto = true; return itens; },
    async salvar(lista) {
      try { itens = await salvar(nome, lista); return true; }
      catch (err) { if (err.conflito) itens = err.itens; alert('Não consegui salvar: ' + err.message); return false; }
    },
  };
}

// Janela de formulário simples: campos [{k, rot, tipo, opcoes, largo, ph}] -> objeto ou null.
export function formulario(titulo, campos, valores = {}, { apagar = false, extra = '' } = {}) {
  return new Promise(ok => {
    const dlg = document.createElement('dialog');
    dlg.className = 'ap-dialog';
    dlg.innerHTML = `<form method="dialog" class="ap-form">
      <div class="ap-topo"><h2>${esc(titulo)}</h2></div>
      ${extra}
      ${campos.map(c => {
        const v = esc(valores[c.k] ?? c.padrao ?? '');
        const ctrl = c.tipo === 'select' ? `<select name="${c.k}">${c.opcoes.map(o => { const [val, rot] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(val)}" ${String(val) === String(valores[c.k] ?? c.padrao ?? '') ? 'selected' : ''}>${esc(rot)}</option>`; }).join('')}</select>`
          : c.tipo === 'area' ? `<textarea name="${c.k}" rows="${c.linhas || 4}" placeholder="${esc(c.ph || '')}">${v}</textarea>`
          : `<input name="${c.k}" type="${c.tipo || 'text'}" value="${v}" placeholder="${esc(c.ph || '')}" ${c.req ? 'required' : ''} ${c.tipo === 'number' ? 'step="any"' : ''}>`;
        return `<label class="${c.largo ? 'ap-largo' : ''}">${esc(c.rot)}${c.req ? ' *' : ''}${ctrl}</label>`;
      }).join('')}
      <div class="ap-rodape">
        ${apagar ? '<button type="button" class="btn-ghost ap-perigo" value="apagar">Apagar</button>' : '<span></span>'}
        <span><button type="button" class="btn-ghost" value="cancelar">Cancelar</button> <button class="btn-primary" value="ok">Salvar</button></span>
      </div>
    </form>`;
    document.body.append(dlg);
    const fim = v => { dlg.close(); dlg.remove(); ok(v); };
    $('[value="cancelar"]', dlg).onclick = () => fim(null);
    $('[value="apagar"]', dlg)?.addEventListener('click', () => { if (confirm('Apagar este registro?')) fim({ apagar: true }); });
    $('form', dlg).onsubmit = e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      fim(Object.fromEntries(campos.map(c => [c.k, (fd.get(c.k) ?? '').toString().trim()])));
    };
    dlg.addEventListener('cancel', () => fim(null));
    dlg.showModal();
  });
}

// Cards do Kanban para ligar um registro a uma licitação.
export const opcoesCards = (perfil = '') => [['', '— nenhuma —'], ...estado.kanban.filter(c => !perfil || c.perfil === perfil)
  .map(c => [c.id, `${c.numero ? c.numero + ' · ' : ''}${(c.objeto || '').slice(0, 70)} · ${c.orgao || ''}`])];
export const cardPorId = idc => estado.kanban.find(c => c.id === idc);

// Abre um documento HTML numa janela para imprimir ou salvar em PDF.
export function imprimir(titulo, corpo) {
  const w = window.open('', '_blank');
  if (!w) { alert('O navegador bloqueou a janela. Libere os pop-ups deste site.'); return; }
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>
    body{font:12pt/1.5 "Times New Roman",serif;color:#000;margin:0}
    .pagina{padding:2cm 2.2cm;page-break-after:always;min-height:24cm;box-sizing:border-box}
    .pagina:last-child{page-break-after:auto}
    .timbre{display:flex;gap:14px;align-items:center;border-bottom:1px solid #444;padding-bottom:8px;margin-bottom:22px;font-size:10pt}
    .timbre img{max-height:60px;max-width:160px}
    h1{font-size:13pt;text-align:center;text-transform:uppercase;margin:0 0 20px}
    p{text-align:justify;margin:0 0 12px}
    .local{margin-top:28px}
    .assinatura{margin-top:60px;text-align:center}
    .assinatura div{border-top:1px solid #000;width:320px;margin:0 auto 4px}
    table{border-collapse:collapse;width:100%;font-size:10pt} td,th{border:1px solid #666;padding:4px 6px;text-align:left}
    @media screen{body{background:#ddd}.pagina{background:#fff;max-width:21cm;margin:16px auto;box-shadow:0 2px 8px rgba(0,0,0,.2)}}
    @page{size:A4;margin:0}
  </style></head><body>${corpo}<script>setTimeout(()=>print(),400)<\/script></body></html>`);
  w.document.close();
}
