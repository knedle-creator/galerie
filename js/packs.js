// Načítání a kontrola balíčků z packs/*.json. Žádný obsah tady není natvrdo.
import { S, getUserPacks } from './store.js';
import { PEOPLE } from './speech.js';

export const PACKS = [];        // seřazené balíčky
export const BY_ID = {};
export const ITEMS = [];        // všechny položky všech balíčků v pořadí
export const LOAD_ERRORS = [];  // {file, errors[]}
const DICT = new Map();         // anglické slovo -> čeština

export const KINDS = {
  lesson: { list: 'lessons', e: '🎨', label: 'Lekce' },
  practice: { list: 'practice', e: '🗣️', label: 'Procvičování' },
  dialog: { list: 'dialogs', e: '🎧', label: 'Rozhovory' },
  reading: { list: 'readings', e: '📰', label: 'Čtení' },
  writing: { list: 'writing', e: '✍️', label: 'Psaní' },
  mission: { list: 'missions', e: '🧭', label: 'Mise' }
};
const COURSE_ORDER = ['harmonize2', 'nz'];
const EX_TYPES = ['mc', 'listen', 'gap', 'pair', 'build', 'type', 'dict', 'speak'];

/* ---------- kontrola balíčku ---------- */
export function validatePack(p) {
  const E = [];
  const str = v => typeof v === 'string' && v.trim() !== '';
  const arr = v => Array.isArray(v);
  if (!p || typeof p !== 'object' || arr(p)) return ['Soubor neobsahuje balíček (čekám objekt { … }).'];
  if (!str(p.id) || !/^[a-z0-9_-]+$/i.test(p.id)) E.push('Chybí „id“ balíčku (jen písmena, čísla, - a _).');
  if (!str(p.course)) E.push('Chybí „course“ (např. "harmonize2" nebo "nz").');
  if (!str(p.title)) E.push('Chybí „title“ balíčku.');
  for (const k of ['lessons', 'practice', 'dialogs', 'readings', 'writing', 'missions'])
    if (p[k] !== undefined && !arr(p[k])) E.push(`„${k}“ musí být seznam [ … ].`);
  if (E.length) return E;

  const ids = new Set();
  const uniq = (id, where) => { if (ids.has(id)) E.push(`${where}: id „${id}“ se v balíčku opakuje.`); ids.add(id); };
  const checkEx = (ex, where) => {
    if (!arr(ex) || !ex.length) { E.push(`${where}: chybí seznam úloh „ex“.`); return; }
    ex.forEach((e, i) => {
      const w = `${where}, úloha ${i + 1}`;
      if (!e || !EX_TYPES.includes(e.t)) { E.push(`${w}: neznámý typ „${e && e.t}“. Povolené: ${EX_TYPES.join(', ')}.`); return; }
      const need = f => { if (e[f] === undefined || e[f] === '') E.push(`${w} (${e.t}): chybí „${f}“.`); };
      const inOpts = () => { if (arr(e.opts) && !e.opts.includes(e.a)) E.push(`${w} (${e.t}): správná odpověď „${e.a}“ není mezi možnostmi.`); };
      if (e.t === 'mc') { need('q'); need('opts'); need('a'); inOpts(); }
      if (e.t === 'listen') { need('say'); need('opts'); need('a'); inOpts(); }
      if (e.t === 'gap') { need('s'); need('opts'); need('a'); inOpts(); if (str(e.s) && !e.s.includes('___')) E.push(`${w} (gap): věta nemá místo ___.`); }
      if (e.t === 'pair') { if (!arr(e.pairs) || e.pairs.length < 2 || e.pairs.some(x => !arr(x) || x.length !== 2)) E.push(`${w} (pair): „pairs“ musí být seznam dvojic.`); }
      if (e.t === 'build') { need('cz'); need('a'); }
      if (e.t === 'type') { need('s'); need('a'); if (typeof e.a === 'string') e.a = [e.a]; }
      if (e.t === 'dict' || e.t === 'speak') need('a');
      if (e.opts !== undefined && (!arr(e.opts) || e.opts.length < 2)) E.push(`${w}: „opts“ musí mít aspoň 2 možnosti.`);
    });
  };
  (p.lessons || []).forEach((l, i) => {
    const w = `Lekce ${i + 1}${l && l.id ? ` („${l.id}“)` : ''}`;
    if (!l || !str(l.id) || !str(l.title)) { E.push(`${w}: chybí „id“ nebo „title“.`); return; }
    uniq(l.id, w);
    if (l.words !== undefined && !arr(l.words)) E.push(`${w}: „words“ musí být seznam.`);
    checkEx(l.ex, w);
  });
  (p.practice || []).forEach((l, i) => {
    const w = `Procvičování ${i + 1}`;
    if (!l || !str(l.id) || !str(l.title)) { E.push(`${w}: chybí „id“ nebo „title“.`); return; }
    uniq(l.id, w); checkEx(l.ex, w);
  });
  const checkQs = (qs, w) => (qs || []).forEach((q, i) => {
    if (!q || !str(q.q) || !arr(q.opts) || !q.opts.includes(q.a)) E.push(`${w}, otázka ${i + 1}: chybí „q“, „opts“ nebo správná odpověď „a“ mezi možnostmi.`);
  });
  (p.dialogs || []).forEach((d, i) => {
    const w = `Rozhovor ${i + 1}`;
    if (!d || !str(d.id) || !str(d.title) || !arr(d.people) || !arr(d.lines) || !d.lines.length) { E.push(`${w}: chybí „id“, „title“, „people“ nebo „lines“.`); return; }
    d.lines.forEach((l, k) => { if (!l || !str(l.who) || !str(l.en)) E.push(`${w}, replika ${k + 1}: chybí „who“ nebo „en“.`); });
    checkQs(d.qs, w);
    (d.qs || []).forEach((q, k) => { if (q && (typeof q.line !== 'number' || !d.lines[q.line])) E.push(`${w}, otázka ${k + 1}: „line“ neukazuje na existující repliku.`); });
  });
  (p.readings || []).forEach((r, i) => {
    const w = `Čtení ${i + 1}`;
    if (!r || !str(r.id) || !str(r.title) || !arr(r.paragraphs) || !r.paragraphs.length) { E.push(`${w}: chybí „id“, „title“ nebo „paragraphs“.`); return; }
    r.paragraphs.forEach((x, k) => { if (!x || !str(x.en)) E.push(`${w}, odstavec ${k + 1}: chybí „en“.`); });
    checkQs(r.qs, w);
  });
  (p.writing || []).forEach((x, i) => { if (!x || !str(x.id) || !str(x.title) || !str(x.task)) E.push(`Psaní ${i + 1}: chybí „id“, „title“ nebo „task“.`); });
  (p.missions || []).forEach((x, i) => { if (!x || !str(x.id) || !str(x.cz)) E.push(`Mise ${i + 1}: chybí „id“ nebo „cz“.`); });
  return E.slice(0, 12);
}

/* ---------- načtení ---------- */
export async function loadAll() {
  PACKS.length = 0; ITEMS.length = 0; LOAD_ERRORS.length = 0; DICT.clear();
  for (const k in BY_ID) delete BY_ID[k];
  const add = (p, file) => {
    const errs = validatePack(p);
    if (errs.length) { LOAD_ERRORS.push({ file, errors: errs }); return; }
    if (BY_ID[p.id]) { const i = PACKS.indexOf(BY_ID[p.id]); PACKS.splice(i, 1); } // nahraný balíček nahradí stejný z repa
    BY_ID[p.id] = p; PACKS.push(p);
  };
  let files = [];
  try { files = (await (await fetch('packs/index.json')).json()).packs || []; } catch (e) { LOAD_ERRORS.push({ file: 'packs/index.json', errors: ['Seznam balíčků se nepodařilo načíst.'] }); }
  const loaded = await Promise.all(files.map(f => fetch('packs/' + f).then(r => { if (!r.ok) throw 0; return r.json(); }).then(p => [p, f]).catch(() => [null, f])));
  for (const [p, f] of loaded) p ? add(p, f) : LOAD_ERRORS.push({ file: f, errors: ['Soubor se nepodařilo načíst (chybí, nebo není platný JSON).'] });
  for (const [id, p] of Object.entries(getUserPacks())) add(p, `nahraný balíček ${id}`);

  const co = c => { const i = COURSE_ORDER.indexOf(c); return i < 0 ? 99 : i; };
  PACKS.sort((a, b) => co(a.course) - co(b.course) || String(a.course).localeCompare(b.course) || (a.order ?? 99) - (b.order ?? 99));

  for (const p of PACKS) {
    Object.assign(PEOPLE, p.people || {});
    for (const [kind, m] of Object.entries(KINDS))
      for (const d of p[m.list] || []) ITEMS.push({ key: `${p.id}/${kind}/${d.id}`, kind, pack: p, data: d });
    for (const l of p.lessons || []) for (const w of l.words || []) for (const [en, cz] of expandWord(w)) addDict(en, cz);
    for (const r of p.readings || []) for (const [en, cz] of r.glossary || []) addDict(en, cz);
  }
  try {
    const d = await (await fetch('data/dictionary.json')).json();
    for (const [en, cz] of Object.entries(d)) if (!en.startsWith('_')) addDict(en, cz, true);
  } catch (e) { /* bez vestavěného slovníku to taky půjde */ }
}
function addDict(en, cz, weak) {
  const k = String(en).toLowerCase().replace(/’/g, "'").trim();
  if (k && cz && !(weak && DICT.has(k))) DICT.set(k, cz);
}

/* ---------- slova ---------- */
// ["🐘","huge / enormous","obrovský"] -> [["huge","obrovský"],["enormous","obrovský"]]
export function expandWord(w) {
  if (!Array.isArray(w) || w.length < 3) return [];
  const en = String(w[1]).split(/\s*(?:→|\/)\s*/).filter(Boolean);
  const cz = String(w[2]).split(/\s*(?:→|\/)\s*/).filter(Boolean);
  if (en.length === cz.length) return en.map((e, i) => [e, cz[i]]);
  if (cz.length === 1) return en.map(e => [e, cz[0]]);
  return [[w[1], w[2]]];
}
export function allWords() {
  const out = [], seen = new Set();
  for (const p of PACKS) for (const l of p.lessons || []) for (const w of l.words || [])
    for (const [en, cz] of expandWord(w)) {
      const k = en.toLowerCase(); if (seen.has(k)) continue; seen.add(k);
      out.push({ e: w[0], en, cz, src: l.title });
    }
  for (const p of PACKS) for (const r of p.readings || []) for (const [en, cz] of r.glossary || []) {
    const k = en.toLowerCase(); if (seen.has(k)) continue; seen.add(k);
    out.push({ e: '📰', en, cz, src: r.title });
  }
  return out;
}
// Překlad slova, na které klepla při čtení.
export function lookupWord(raw, glossary = [], paragraph = '') {
  const w = raw.toLowerCase().replace(/’/g, "'");
  const para = paragraph.toLowerCase().replace(/’/g, "'");
  // fráze z glosáře, i s koncovkami: "lean towards" najde i "leans towards"
  for (const [en, cz] of glossary) {
    const parts = en.toLowerCase().split(/\s+/);
    if (parts.length < 2) continue;
    const re = new RegExp('\\b' + parts.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "[a-z']*").join('\\s+'), 'i');
    if (re.test(para) && parts.some(p => w.startsWith(p))) return { en, cz };
  }
  for (const [en, cz] of glossary) if (en.toLowerCase() === w) return { en, cz };
  const tries = [w, w.replace(/'s$/, ''), w.replace(/s$/, ''), w.replace(/es$/, ''), w.replace(/ies$/, 'y'), w.replace(/ed$/, ''), w.replace(/ed$/, 'e'), w.replace(/ing$/, ''), w.replace(/ing$/, 'e'), w.replace(/ly$/, '')];
  for (const t of tries) if (t && DICT.has(t)) return { en: t === w ? raw : t, cz: DICT.get(t) };
  return null;
}

/* ---------- položky a stav ---------- */
export const item = key => ITEMS.find(i => i.key === key) || null;
export function courses() {
  const m = new Map();
  for (const p of PACKS) {
    if (!m.has(p.course)) m.set(p.course, { id: p.course, title: p.courseTitle || p.course, packs: [] });
    m.get(p.course).packs.push(p);
  }
  return [...m.values()];
}
export function status(it) {
  if (it.kind === 'mission') return S.missions[it.key]?.done ? 'done' : 'new';
  const p = S.prog[it.key];
  if (p?.run) return 'doing';
  return p?.done ? 'done' : 'new';
}
export const STATUS_LABEL = { new: 'nové', doing: 'rozdělané', done: 'hotovo ✓' };
export const artOf = l => l.art || ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'][[...String(l.id)].reduce((s, c) => s + c.charCodeAt(0), 0) % 6];

// Úloha podle odkazu "balíček|sada" a čísla.
export function exRef(r, ei) {
  const [pid, sid] = String(r).split('|');
  const p = BY_ID[pid]; if (!p) return null;
  const set = (p.lessons || []).concat(p.practice || []).find(x => x.id === sid);
  return set && set.ex[ei] ? set.ex[ei] : null;
}
