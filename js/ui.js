// Přepínání obrazovek přes History API, aby systémové tlačítko Zpět vracelo o krok zpět.
import { $, esc } from './util.js';
import { stopAll } from './speech.js';

export const app = $('#app');
export const ov = $('#ov');
const routes = {};
let leave = null;

export const route = (name, fn) => { routes[name] = fn; };
export const onLeave = fn => { leave = fn; };
const depth = () => (history.state && history.state.d) || 0;

export function go(name, params = {}, { replace = false } = {}) {
  const st = { name, params, d: replace ? depth() : depth() + 1 };
  history[replace ? 'replaceState' : 'pushState'](st, '');
  render(st);
}
export const refresh = () => { const y = window.scrollY; render(history.state || { name: 'home', d: 0 }); window.scrollTo(0, y); };
export function back() { if (depth() > 0) history.back(); else go('home', {}, { replace: true }); }
export function toHome() { const d = depth(); if (d > 0) history.go(-d); else render({ name: 'home', d: 0 }); }

export function render(st) {
  if (leave) { try { leave(); } catch (e) {} leave = null; }
  stopAll(); ov.innerHTML = ''; setProgress(null);
  const name = routes[st && st.name] ? st.name : 'home';
  $('#hb').hidden = name === 'home';
  $('#hh').hidden = name === 'home';
  routes[name]((st && st.params) || {});
  window.scrollTo(0, 0);
}
window.addEventListener('popstate', e => render(e.state || { name: 'home', d: 0 }));

export function initChrome() {
  $('#hb').onclick = back;
  $('#hp').onclick = pause;
  $('#hh').onclick = toHome;
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && ov.innerHTML) ov.innerHTML = ''; });
}
export function setProgress(p) {
  const b = $('#hbar'); if (!b) return;
  if (p == null) { b.hidden = true; return; }
  b.hidden = false; b.firstElementChild.style.width = Math.max(0, Math.min(100, p)) + '%';
}

export function pause() {
  stopAll();
  modal(`<div class="big">🧃</div><h2 style="text-align:center;margin-top:.5rem">Pauza</h2>
   <p>Zvedni se, napij se, protáhni ruce nad hlavu. Všechno na tebe počká a nic se neztratí.</p>
   <div class="actions"><button class="btn wide" data-close>Pokračovat</button></div>`);
}
export function modal(html) {
  ov.innerHTML = `<div class="overlay" role="dialog" aria-modal="true"><div class="card">${html}</div></div>`;
  ov.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { ov.innerHTML = ''; });
  const f = ov.querySelector('button,input'); if (f) f.focus();
  return ov.querySelector('.card');
}
export function sheet(html) {
  ov.innerHTML = `<div class="overlay" style="background:rgba(20,10,40,.25)" data-close></div><div class="sheet"><div class="card">${html}</div></div>`;
  ov.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { ov.innerHTML = ''; });
  return ov.querySelector('.sheet .card');
}
let tt = null;
export function toast(msg) {
  const t = $('#toast'); t.innerHTML = `<div>${esc(msg)}</div>`;
  clearTimeout(tt); tt = setTimeout(() => { t.innerHTML = ''; }, 2600);
}
