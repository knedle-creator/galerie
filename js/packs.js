// Načítání a kontrola balíčků z packs/*.json. Žádný obsah tady není natvrdo.
import { S, getUserPacks } from './store.js';
import { PEOPLE } from './speech.js';
import { P, g } from './profile.js';

export const PACKS = [];        // seřazené balíčky
export const BY_ID = {};
export const ITEMS = [];        // všechny položky všech balíčků v pořadí
export const LOAD_ERRORS = [];  // {file, errors[]}
export const SOON = [];         // balíčky s datem odemčení v budoucnu {id, title, course, from, locked}
const DICT = new Map();         // anglické slovo -> čeština

export const KINDS = {
  lesson: { list: 'lessons', e: P.lessonIcon, label: 'Lekce' },
  practice: { list: 'practice', e: '🗣️', label: 'Procvičování' },
  dialog: { list: 'dialogs', e: '🎧', label: 'Rozhovory' },
  reading: { list: 'readings', e: '📰', label: 'Čtení' },
  writing: { list: 'writing', e: '✍️', label: 'Psaní' },
  mission: { list: 'missions', e: '🧭', label: 'Mise' },
  game: { list: 'games', e: '🎮', label: 'Hry' }
};
const EX_TYPES = ['mc', 'listen', 'gap', 'pair', 'build', 'type', 'dict', 'speak', 'info', 'fill', 'num', 'tip'];
const NUM_FORMS = { int: 1, frac: 2, mixed: 3, dec: 2, per: 3 };

/* ---------- kontrola balíčku ---------- */
export function validatePack(p) {
  const E = [];
  const str = v => typeof v === 'string' && v.trim() !== '';
  const arr = v => Array.isArray(v);
  if (!p || typeof p !== 'object' || arr(p)) return ['Soubor neobsahuje balíček (čekám objekt { … }).'];
  if (!str(p.id) || !/^[a-z0-9_-]+$/i.test(p.id)) E.push('Chybí „id“ balíčku (jen písmena, čísla, - a _).');
  if (!str(p.course)) E.push('Chybí „course“ (např. "harmonize2" nebo "nz").');
  if (!str(p.title)) E.push('Chybí „title“ balíčku.');
  if (p.from !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(p.from)) E.push('„from“ musí být datum ve tvaru "2026-12-09".');
  for (const k of ['lessons', 'practice', 'dialogs', 'readings', 'writing', 'missions', 'games'])
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
      if (e.t === 'info') {
        need('html');
        if (e.tip !== undefined && !str(e.tip)) E.push(`${w} (info): „tip“ musí být klíč tipu z úlohy „tip“, např. "leto".`);
        if (e.tipok !== undefined && !arr(e.tipok)) E.push(`${w} (info): „tipok“ musí být seznam tipů, které vyšly.`);
      }
      if (e.t === 'tip') { need('q'); need('opts'); need('key'); }
      if (e.more !== undefined && !str(e.more)) E.push(`${w}: „more“ musí být text.`);
      if (e.t === 'fill') {
        need('q');
        if (!['pizza', 'box'].includes(e.shape)) E.push(`${w} (fill): „shape“ musí být "pizza" nebo "box".`);
        const parts = e.parts, wholes = e.wholes ?? 1;
        if (!Number.isInteger(parts) || parts < 2 || parts > 12) E.push(`${w} (fill): „parts“ musí být celé číslo 2–12.`);
        else if (!Number.isInteger(wholes) || wholes < 1 || wholes > 4) E.push(`${w} (fill): „wholes“ musí být 1–4.`);
        else if (!Number.isInteger(e.a) || e.a < 0 || e.a > parts * wholes) E.push(`${w} (fill): „a“ musí být počet dílků 0–${parts * wholes}.`);
      }
      if (e.t === 'num') {
        need('q');
        const n = NUM_FORMS[e.form];
        if (!n) E.push(`${w} (num): „form“ musí být "int", "frac", "mixed", "dec" nebo "per".`);
        else if (e.form === 'dec' || e.form === 'per') {
          // číslice jako text, aby se neztratily nuly: ["0", "08", "3"] = 0,083 s pruhem nad trojkou
          const dig = (x, k) => typeof x === 'string' && (e.form === 'per' && k === 1 ? /^\d*$/ : /^\d+$/).test(x);
          if (!arr(e.a) || e.a.length !== n || !e.a.every(dig)) E.push(`${w} (num): „a“ musí být ${e.form === 'dec' ? '["celé", "za čárkou"], např. ["0", "75"]' : '["celé", "před periodou", "perioda"], např. ["0", "1", "6"] nebo ["0", "", "3"]'}.`);
        } else {
          const ok = x => arr(x) && x.length === n && x.every(Number.isInteger);
          if (!ok(e.a)) E.push(`${w} (num): „a“ musí být seznam ${n} celých čísel.`);
          if (e.alt !== undefined && (!arr(e.alt) || !e.alt.every(ok))) E.push(`${w} (num): „alt“ musí být seznam odpovědí ve stejném tvaru jako „a“.`);
        }
      }
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
  (p.games || []).forEach((x, i) => {
    if (!x || !str(x.id) || !str(x.title) || !str(x.src)) { E.push(`Hra ${i + 1}: chybí „id“, „title“ nebo „src“.`); return; }
    if (!/^hry\/[a-z0-9_-]+\.html$/i.test(x.src)) E.push(`Hra ${i + 1}: „src“ musí být soubor ve složce hry/, např. "hry/hustota.html".`);
    uniq(x.id, `Hra ${i + 1}`);
  });
  return E.slice(0, 12);
}

/* ---------- načtení ---------- */
export async function loadAll() {
  PACKS.length = 0; ITEMS.length = 0; LOAD_ERRORS.length = 0; SOON.length = 0; DICT.clear();
  for (const k in BY_ID) delete BY_ID[k];
  const add = (p, file) => {
    if (p && typeof p === 'object') genderize(p);
    const errs = validatePack(p);
    if (!errs.length && hidden(p)) return; // kurz, který tohle dítě nemá (např. Nový Zéland u bratranců)
    if (!errs.length && p.from && isoToday() < p.from) {
      SOON.push({ id: p.id, title: p.title, course: p.courseTitle || p.course, from: p.from, locked: locked(p.from) });
      if (locked(p.from)) return; // ještě není ten den: dítě balíček nevidí (telefon ho má stažený)
    }
    if (errs.length) { LOAD_ERRORS.push({ file, errors: errs }); return; }
    if (BY_ID[p.id]) { const i = PACKS.indexOf(BY_ID[p.id]); PACKS.splice(i, 1); } // nahraný balíček nahradí stejný z repa
    BY_ID[p.id] = p; PACKS.push(p);
  };
  let files = [];
  try { files = (await (await fetch('packs/index.json')).json()).packs || []; } catch (e) { LOAD_ERRORS.push({ file: 'packs/index.json', errors: ['Seznam balíčků se nepodařilo načíst.'] }); }
  const loaded = await Promise.all(files.map(f => fetch('packs/' + f).then(r => { if (!r.ok) throw 0; return r.json(); }).then(p => [p, f]).catch(() => [null, f])));
  for (const [p, f] of loaded) p ? add(p, f) : LOAD_ERRORS.push({ file: f, errors: ['Soubor se nepodařilo načíst (chybí, nebo není platný JSON).'] });
  for (const [id, p] of Object.entries(getUserPacks())) add(p, `nahraný balíček ${id}`);

  KINDS.lesson.e = P.lessonIcon;
  const co = c => { const i = (P.courseOrder || []).indexOf(c); return i < 0 ? 99 : i; };
  PACKS.sort((a, b) => co(a.course) - co(b.course) || String(a.course).localeCompare(b.course) || (a.order ?? 99) - (b.order ?? 99));

  for (const p of PACKS) {
    p._subject = subjectOf(p);
    // Balíčky, které nejsou anglicky (matika, fyzika…), se nečtou anglickým hlasem.
    const mute = (p.lang || 'en') !== 'en';
    for (const set of (p.lessons || []).concat(p.practice || [])) for (const e of set.ex || []) e._mute = mute;
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
// Rodové tvary v textech balíčků: [[ženský|mužský]], např. "Teď celé [[sama|sám]]."
// Stejné lekce tak můžou mít Klaudie i Teo, Robin i Rózka.
const GT = /\[\[([^|\[\]]*)\|([^|\[\]]*)\]\]/g;
function genderize(o) {
  if (typeof o === 'string') return o.includes('[[') ? o.replace(GT, (_, f, m) => g(f, m)) : o;
  if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) o[i] = genderize(o[i]); return o; }
  if (o && typeof o === 'object') { for (const k of Object.keys(o)) o[k] = genderize(o[k]); }
  return o;
}
// Kurzy a předměty, které profil skrývá ("hide": ["nz", "vzn", "es"]).
const isHidden = id => (P.hide || []).includes(id);
const hidden = p => isHidden(p.course) || isHidden(p.subject) || isHidden(subjectOf(p));
// Odemčení podle data: "from": "2026-12-09" u balíčku nebo předmětu. Do toho dne ho dítě nevidí.
// Rodič si ho v Pro rodiče může ukázat dřív, jen v tomhle zařízení (localStorage "<id>-nahled").
export const isoToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } } };
export const previewOn = () => ls.get(`${P.id}-nahled`) === '1';
export function setPreview(on) { try { if (on) localStorage.setItem(`${P.id}-nahled`, '1'); else localStorage.removeItem(`${P.id}-nahled`); } catch (e) { /* nic */ } }
export const locked = from => typeof from === 'string' && isoToday() < from && !previewOn();
// „2026-12-09“ -> „9. 12. 2026“
export const czDate = iso => { const [y, m, d] = String(iso).split('-').map(Number); return `${d}. ${m}. ${y}`; };
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

/* ---------- předměty ---------- */
// Předměty (angličtina, matika, …) jsou v profile.json. Bez nich appka ukazuje rovnou kurzy (Robin).
export const hasSubjects = () => Array.isArray(P.subjects) && P.subjects.length > 0;
export function subjectOf(p) {
  if (p.subject) return p.subject;
  const s = (P.subjects || []).find(x => (x.courses || []).includes(p.course));
  return s ? s.id : 'en';
}
export function subjects() {
  return (P.subjects || []).filter(s => !isHidden(s.id) && !locked(s.from)).map(s => ({
    ...s, cz: (P.subjectCz || {})[s.id] ?? s.cz,
    list: courses().filter(c => c.packs.some(p => p._subject === s.id))
  }));
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
  if (it.kind === 'game') return S.prog[it.key]?.opened ? 'played' : 'new';
  const p = S.prog[it.key];
  if (p?.run) return 'doing';
  return p?.done ? 'done' : 'new';
}
export const STATUS_LABEL = { new: 'nové', doing: 'rozdělané', done: 'hotovo ✓', played: 'hraju' };
export const artOf = l => l.art || ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'][[...String(l.id)].reduce((s, c) => s + c.charCodeAt(0), 0) % 6];

// Úloha podle odkazu "balíček|sada" a čísla.
export function exRef(r, ei) {
  const [pid, sid] = String(r).split('|');
  const p = BY_ID[pid]; if (!p) return null;
  const set = (p.lessons || []).concat(p.practice || []).find(x => x.id === sid);
  return set && set.ex[ei] ? set.ex[ei] : null;
}
