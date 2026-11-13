// Ukládání: postup a texty v localStorage, fotky v IndexedDB. Všechno zůstává v telefonu.
// Klíče jsou podle profilu (klaudie-v1, robin-v1), aby se data dvou dětí nikdy nepomíchala.
import { P } from './profile.js';
const KEY = () => P.id + '-v1';
const UPK = () => P.id + '-userpacks';

export const defaults = () => ({
  v: 1,
  prog: {},      // klíč položky -> {done, doneAt, run}
  last: null,    // naposledy otevřená položka
  mist: [],      // úlohy „co mi ještě nejde“: "balíček|sada:index"
  sound: true,   // automatické přehrávání
  slow: false,
  drafts: {},    // rozepsané texty
  texts: [],     // hotové texty
  vocab: [],     // Můj slovníček
  missions: {},  // klíč mise -> {done, note, photo}
  pin: null,
  voiceF: null,  // ženský hlas vybraný rodiči (jméno)
  voiceM: null,  // mužský hlas vybraný rodiči
  sfx: true,     // zvukové efekty a maskot
  rec: true      // nahrané hlasy (když jsou k dispozici)
});

export let S = defaults();

export function load() {
  try { const r = localStorage.getItem(KEY()); if (r) S = Object.assign(defaults(), JSON.parse(r)); } catch (e) { /* poškozená data: začneme čistě */ }
}
export function save() {
  try { localStorage.setItem(KEY(), JSON.stringify(S)); return true; } catch (e) { return false; }
}
export function replaceAll(o) { S = Object.assign(defaults(), o || {}); save(); }

export function getUserPacks() { try { return JSON.parse(localStorage.getItem(UPK()) || '{}'); } catch (e) { return {}; } }
export function setUserPacks(o) { localStorage.setItem(UPK(), JSON.stringify(o)); }

/* ---- fotky (IndexedDB) ---- */
let dbp = null;
function db() {
  return dbp || (dbp = new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error('no-idb'));
    const r = indexedDB.open(P.id, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('photos');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction('photos', mode);
    const rq = fn(t.objectStore('photos'));
    t.oncomplete = () => res(rq ? rq.result : undefined);
    t.onerror = t.onabort = () => rej(t.error);
  });
}
export const putPhoto = (k, blob) => tx('readwrite', s => s.put(blob, k));
export const getPhoto = k => tx('readonly', s => s.get(k)).catch(() => null);
export const delPhoto = k => tx('readwrite', s => s.delete(k)).catch(() => {});
const photoKeys = () => tx('readonly', s => s.getAllKeys()).catch(() => []);
const clearPhotos = () => tx('readwrite', s => s.clear()).catch(() => {});

const blobToData = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.onerror = () => r(null); f.readAsDataURL(b); });
const dataToBlob = async d => (await fetch(d)).blob();

/* ---- záloha ---- */
export async function exportBackup() {
  const photos = {};
  for (const k of await photoKeys()) { const b = await getPhoto(k); if (b) { const d = await blobToData(b); if (d) photos[k] = d; } }
  return JSON.stringify({ app: P.id, v: 1, exportedAt: new Date().toISOString(), state: S, userPacks: getUserPacks(), photos });
}
export async function importBackup(text) {
  let o;
  try { o = JSON.parse(text); } catch (e) { throw new Error('Tenhle soubor se nedá přečíst. Je to opravdu záloha z této appky (.json)?'); }
  if (!o || o.app !== P.id || typeof o.state !== 'object') throw new Error(`Tohle není záloha ${P.titleGen}.`);
  replaceAll(o.state);
  setUserPacks(o.userPacks || {});
  await clearPhotos();
  for (const [k, d] of Object.entries(o.photos || {})) { try { await putPhoto(k, await dataToBlob(d)); } catch (e) { /* jedna fotka nevadí */ } }
}
export async function resetAll() {
  try { localStorage.removeItem(KEY()); localStorage.removeItem(UPK()); } catch (e) {}
  await clearPhotos();
  S = defaults(); save();
}
