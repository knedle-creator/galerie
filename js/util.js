// Drobné pomocné funkce, které používají všechny obrazovky.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const norm = s => String(s).toLowerCase().replace(/[’‘]/g, "'").replace(/[.,!?“”"…]/g, '').replace(/\s+/g, ' ').trim();
export const shuffle = a => { a = a.slice(); for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } return a; };
export const rand = a => a[Math.floor(Math.random() * a.length)];
export const sleep = ms => new Promise(r => setTimeout(r, ms));
// Čeština podle čísla: pl(1,'věc','věci','věcí') -> "1 věc", pl(3,…) -> "3 věci", pl(5,…) -> "5 věcí"
export const pl = (n, one, few, many) => `${n} ${n === 1 ? one : n >= 2 && n <= 4 ? few : many}`;
export const today =() => new Date().toLocaleDateString('cs-CZ');

// HTML z balíčků (otázky, úvody) – odstraní skripty a nebezpečné atributy.
export function safeHtml(h) {
  const d = new DOMParser().parseFromString('<body>' + String(h ?? ''), 'text/html');
  d.querySelectorAll('script,style,iframe,object,embed,link,meta,form,input,img').forEach(n => n.remove());
  d.body.querySelectorAll('*').forEach(n => [...n.attributes].forEach(a => {
    if (/^on/i.test(a.name) || /javascript:/i.test(a.value) || a.name === 'style') n.removeAttribute(a.name);
  }));
  return d.body.innerHTML;
}

// Pochvala za snahu a postup, nikdy za talent.
export const OK = ['Výborně!', 'Sedí!', 'Přesně tak!', 'Paráda!', 'Trefa!'];
export const SPOKE = [
  'Mluvit nahlas je v cizím jazyce to nejtěžší. A ty to děláš.',
  'Slyšet se mluvit anglicky chce odvahu. Paráda.',
  'Tvoje pusa si zvyká na anglická slova. Přesně o to jde.'
];
