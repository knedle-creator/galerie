// Řeč: hlas telefonu (TTS) a mikrofon. Logika převzatá z prototypu.
import { S } from './store.js';
import { esc } from './util.js';

export const PEOPLE = {};   // postavy z balíčků: {e, pitch, voice}
export const hasTTS = 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance !== 'undefined';
let VO = [], playToken = 0;
function lv() { try { VO = rankVoices(speechSynthesis.getVoices()); } catch (e) {} }
if (hasTTS) { lv(); try { speechSynthesis.addEventListener('voiceschanged', lv); } catch (e) {} }
export const voiceCount = () => VO.length;

/* ---- výběr hlasu: nejpřirozenější britský hlas ---- */
// Zábavné a staré robotické hlasy na Macu: nikdy je nebereme.
const NOVELTY = /^(albert|bad news|bahh|bells|boing|bubbles|cellos|eddy|flo|fred|good news|grandma|grandpa|jester|junior|kathy|organ|ralph|reed|rocko|sandy|shelley|superstar|trinoids|whisper|wobble|zarvox)\b/i;
// Kvalitní britské hlasy Macu a iPhonu.
const GOOD_MAC = /^(daniel|serena|kate|oliver|jamie|stephanie|martha|arthur)\b/i;
export function voiceScore(v) {
  const n = v.name || '', l = String(v.lang || '').replace('_', '-').toLowerCase();
  if (!/^en/.test(l) || NOVELTY.test(n)) return -1;
  let s = 0;
  if (l === 'en-gb') s += 100;                         // britská angličtina
  else if (/^en-(ie|au|nz)/.test(l)) s += 20;
  if (/google/i.test(n)) s += 60;                      // Chrome na počítači: Google UK English
  if (/premium|enhanced|natural|neural|siri/i.test(n)) s += 50;
  if (/en-gb-x-|english.*united kingdom/i.test(n)) s += 40; // Android (Google řeč)
  if (GOOD_MAC.test(n)) s += 30;
  if (/^daniel/i.test(n)) s += 5;                     // Daniel je na Macu nejpřirozenější britský
  if (v.localService) s += 3;                          // funguje i offline
  return s;
}
const rankVoices = list => list.map(v => [v, voiceScore(v)]).filter(x => x[1] >= 0).sort((a, b) => b[1] - a[1]).map(x => x[0]);
export const englishVoices = () => VO.slice();

/* ---- ženský nebo mužský hlas ---- */
// Podle jména hlasu (Mac, Chrome, Android). Neznámé hlasy vrací null a hodí se pro obě role.
const FEMALE = /female|woman|\b(martha|serena|kate|stephanie|moira|karen|catherine|tessa|samantha|fiona|victoria|allison|ava|susan|zoe|libby|sonia|hazel|amy|emma)\b|-(gba|gbc|gbg)-/i;
const MALE = /\bmale\b|\bman\b|\b(daniel|arthur|oliver|jamie|gordon|aaron|rishi|fred|thomas|george|ryan|brian|alfie)\b|-(gbb|gbd|rjs)-/i;
export function voiceGender(v) { const n = v.name || ''; return FEMALE.test(n) ? 'f' : MALE.test(n) ? 'm' : null; }
// Postava: pole "gender" v balíčku, jinak odhad podle výšky hlasu (Mia 1.2 = žena, Leo 0.8 = muž).
const personGender = w => w.gender || (w.pitch >= 1.05 ? 'f' : w.pitch <= 0.95 ? 'm' : null);
const NARRATOR = { pitch: 1, voice: 0, gender: 'f' }; // hlas ve cvičeních

let netBroken = false; // hlas přes internet jednou selhal → do konce sezení jen hlasy v telefonu
const usablePool = () => {
  if (netBroken || navigator.onLine === false) { const loc = VO.filter(v => v.localService); if (loc.length) return loc; }
  return VO;
};

/* ---- obsazení rolí v rozhovoru: každá postava jiný hlas ---- */
let CAST = {};      // jméno postavy -> {voice, shift}
let castNames = [];
export const clearCast = () => { CAST = {}; castNames = []; };
export function castVoices(names) {
  CAST = {}; castNames = [...new Set(names)];
  const pool = usablePool(), used = [];
  for (const n of castNames) {
    const w = PEOPLE[n] || NARRATOR, g = personGender(w);
    const fit = v => { const vg = voiceGender(v); return !g ? 100 : vg === g ? 200 : vg === null ? 100 : 0; };
    let pick = null, shift = 0;
    // 1) hlas vybraný rodiči, pokud ho ještě nemá jiná postava
    const prefName = g === 'm' ? S.voiceM : S.voiceF;
    const pref = prefName && pool.find(v => v.name === prefName);
    if (pref && !used.includes(pref)) pick = pref;
    // 2) nejlepší volný hlas: správné pohlaví > neznámé pohlaví, britský > jiný anglický přízvuk
    if (!pick) {
      const free = pool.filter(v => !used.includes(v) && fit(v) > 0 && voiceScore(v) >= 20)
        .sort((a, b) => (fit(b) + voiceScore(b)) - (fit(a) + voiceScore(a)));
      if (free[0]) pick = free[0];
    }
    // 3) žádný další vhodný hlas: stejný hlas, ale jiná výška (aby se postavy daly rozeznat)
    if (!pick) {
      const again = used.find(v => fit(v) === 200) || used.find(v => fit(v) === 100) || pool[0];
      if (again) { pick = again; shift = used.filter(v => v === again).length; }
    }
    if (pick) { used.push(pick); CAST[n] = { voice: pick, shift }; }
  }
  return CAST;
}

function pickVoice(w) {
  if (!VO.length) return null;
  const pool = usablePool();
  const g = personGender(w);
  // hlas vybraný rodiči pro ženské / mužské role
  const prefName = g === 'm' ? S.voiceM : S.voiceF;
  const pref = prefName && pool.find(v => v.name === prefName);
  if (pref) return pref;
  const best = voiceScore(pool[0]);
  const min = best >= 100 ? 100 : best - 40; // když je britský hlas, berou se jen britské
  const good = pool.filter(v => voiceScore(v) >= min);
  if (g) {
    const same = good.find(v => voiceGender(v) === g);   // nejlepší hlas správného pohlaví
    if (same) return same;
    const unknown = good.find(v => voiceGender(v) === null);
    if (unknown) return unknown;                          // pohlaví nepoznáme, výšku upraví pitchFor
  }
  return good[(w.voice || 0) % good.length];
}
// Když telefon nemá hlas správného pohlaví, aspoň posuneme výšku.
function pitchFor(w, v) {
  const p = w.pitch || 1, g = personGender(w), vg = v ? voiceGender(v) : null;
  if (g === 'f' && vg === 'm') return Math.max(p, 1.35);
  if (g === 'm' && vg === 'f') return Math.min(p, 0.7);
  return vg && g === vg ? 1 + (p - 1) * 0.4 : p; // správný hlas: výšku měníme jen trochu, ať zní přirozeně
}

let troubleShown = false, troubleHandler = null;
export const onSpeechTrouble = fn => { troubleHandler = fn; };
function trouble() { if (troubleShown) return; troubleShown = true; troubleHandler && troubleHandler(); }

// Přečte text. Bez force jen tehdy, když je zapnutý automatický zvuk.
// Dlouhý text čte po větách (hlasy Google v Chromu jinak po ~15 s zmlknou).
export async function speak(text, o = {}) {
  if (!hasTTS || (!S.sound && !o.force)) return;
  const t = String(text);
  const parts = t.length > 140 ? t.split(/(?<=[.!?])\s+/).filter(Boolean) : [t];
  const tok = playToken;
  for (const p of parts) { if (tok !== playToken) return; await speakOne(p, o); }
}
function speakOne(text, o) {
  return new Promise(res => {
    try {
      speechSynthesis.cancel();
      const slow = o.slow ?? S.slow;
      const t = String(text).replace(/\p{Extended_Pictographic}|️|‍/gu, '');
      const u = new SpeechSynthesisUtterance(t);
      const w = PEOPLE[o.who] || NARRATOR;
      u.rate = slow ? 0.68 : 0.92; u.lang = 'en-GB';
      const c = !o.voice && CAST[o.who];
      const v = o.voice || (c ? c.voice : pickVoice(w)); if (v) { u.voice = v; u.lang = v.lang; }
      let pitch = o.voice ? 1 : pitchFor(w, v);
      if (c && c.shift) { // druhá postava se stejným hlasem: znatelně jiná výška
        const up = personGender(w) !== 'm';
        pitch = up ? pitch * Math.pow(1.2, c.shift) : pitch * Math.pow(0.82, c.shift);
        u.rate *= up ? 1.05 : 0.95;
      }
      u.pitch = Math.max(0.3, Math.min(1.9, pitch));
      let done = false, started = false; const fin = () => { if (!done) { done = true; res(); } };
      // Selhání: hlas přes internet → zkusit znovu hlasem v telefonu. Jinak (jednou) vysvětlit, že je to telefonem.
      const fail = () => {
        if (done) return;
        if (v && !v.localService && !o._retry && VO.some(x => x.localService)) {
          netBroken = true; done = true;
          try { speechSynthesis.cancel(); } catch (e) {}
          if (castNames.length) castVoices(castNames); // obsadit role znovu jen hlasy z telefonu
          speakOne(text, { ...o, voice: null, _retry: true }).then(res);
          return;
        }
        trouble(); try { speechSynthesis.cancel(); } catch (e) {} fin();
      };
      u.onstart = () => { started = true; };
      u.onend = fin;
      u.onerror = e => { if (['canceled', 'interrupted'].includes(e && e.error)) fin(); else fail(); };
      // Když telefon nezačne mluvit do 2,5 s (u hlasu přes internet do 5 s), jde o selhání.
      setTimeout(() => { if (!started) fail(); }, v && !v.localService ? 5000 : 2500);
      setTimeout(fin, 3000 + t.length * (slow ? 150 : 100)); // pojistka, kdyby telefon nedal vědět
      speechSynthesis.speak(u);
    } catch (e) { res(); }
  });
}
export function stopAll() {
  playToken++;
  if (hasTTS) try { speechSynthesis.cancel(); } catch (e) {}
  try { window._rec && window._rec.abort(); } catch (e) {}
}
export const token = () => playToken;
export const newToken = () => ++playToken;

/* ---- mikrofon ---- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export let micOK = !!SR;
export function hear() {
  return new Promise((res, rej) => {
    let r; try { r = new SR(); } catch (e) { return rej('unsupported'); }
    r.lang = 'en-GB'; r.interimResults = false; r.maxAlternatives = 4; r.continuous = false;
    let got = false;
    r.onresult = e => { got = true; res([...e.results[0]].map(a => a.transcript)); };
    r.onerror = e => { got = true; rej(e.error || 'error'); };
    r.onend = () => { if (!got) rej('no-speech'); };
    window._rec = r;
    try { if (hasTTS) speechSynthesis.cancel(); r.start(); } catch (e) { rej('unsupported'); }
  });
}

const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const CONTR = { "it's": 'it is', "that's": 'that is', "i'd": 'i would', "i'm": 'i am', "i've": 'i have', "we're": 'we are', "we've": 'we have', "wasn't": 'was not', "weren't": 'were not', "didn't": 'did not', "they're": 'they are', "you're": 'you are', "he's": 'he is', "she's": 'she is', "what's": 'what is', "can't": 'can not', "don't": 'do not', "isn't": 'is not', "aren't": 'are not', "let's": 'let us', "there's": 'there is' };
export function toWords(s) {
  s = String(s).toLowerCase().replace(/[’‘]/g, "'")
    .replace(/\b(\d{1,2})[:.]00\b/g, (m, n) => (NUM[+n] || n) + " o'clock")
    .replace(/\b(\d{1,2})\b/g, (m, n) => NUM[+n] || n)
    .replace(/colorful/g, 'colourful').replace(/\bcolor/g, 'colour').replace(/cannot/g, 'can not')
    .replace(/[a-z]+'[a-z]+/g, w => CONTR[w] || w).replace(/'/g, '').replace(/[^a-z\s]/g, ' ');
  return s.split(/\s+/).filter(Boolean);
}
export function score(target, alts) {
  const T = toWords(target); let best = { s: -1, miss: T, heard: alts[0] || '' };
  for (const a of alts) {
    const bag = {}; toWords(a).forEach(w => bag[w] = (bag[w] || 0) + 1);
    const miss = []; let m = 0;
    T.forEach(w => { if (bag[w]) { bag[w]--; m++; } else miss.push(w); });
    const sc = T.length ? m / T.length : 0;
    if (sc > best.s) best = { s: sc, miss, heard: a };
  }
  return best;
}

// Widget „řekni nahlas“. onDone(true) = mluvila, onDone(null) = přeskočila.
export function speakWidget(el, target, onDone, who) {
  let tries = 0, finished = false;
  const done = v => { if (finished) return; finished = true; onDone(v); };
  const render = () => {
    el.innerHTML = `<p class="big-sent">${esc(target)}</p>
     <div class="row">${hasTTS ? '<button class="btn ghost" data-a="model">🔊 Vzor</button>' : ''}
     ${micOK ? '<button class="btn pink" data-a="mic">🎤 Teď mluvím já</button>' : ''}</div>
     ${micOK ? '' : `<p class="cz">Řekni to nahlas${hasTTS ? ' a porovnej se vzorem' : ''}. Jak to šlo?</p>
       <div class="row"><button class="btn" data-a="self">👍 Řekla jsem to</button>${hasTTS ? '<button class="btn ghost" data-a="slow">🐢 Vzor pomalu</button>' : ''}</div>`}
     <div class="status" aria-live="polite"></div>
     <p><button class="linkbtn" data-a="skip">Teď mluvit nemůžu, přeskočit</button></p>`;
    el.querySelectorAll('[data-a]').forEach(b => b.onclick = () => act(b.dataset.a, b));
  };
  const st = h => { const s = el.querySelector('.status'); if (s) s.innerHTML = h; };
  async function act(a, b) {
    if (finished) return;
    if (a === 'model') return speak(target, { force: true, who });
    if (a === 'slow') return speak(target, { force: true, slow: true, who });
    if (a === 'skip') return done(null);
    if (a === 'self') return done(true);
    if (a !== 'mic') return;
    b.disabled = true; b.textContent = '👂 Poslouchám…'; st('<p>Mluv teď, nahlas a v klidu.</p>');
    try {
      const r = score(target, await hear()); tries++;
      if (r.s >= 0.75) { st(`<div class="fb ok"><p>Telefon slyšel: „${esc(r.heard)}“ 👍</p></div>`); setTimeout(() => done(true), 900); return; }
      if (tries < 3) st(`<div class="fb try"><p>Telefon slyšel: „${esc(r.heard)}“.${r.miss.length ? ` Nezachytil: <b>${esc(r.miss.slice(0, 4).join(', '))}</b>.` : ''}</p><p>Zkus to ještě jednou, trochu pomaleji. Klidně si nejdřív pusť vzor.</p></div>`);
      else { st('<div class="fb ok"><p>Telefony rozumí dětem hůř než lidi, takže to vůbec nevadí. Důležité je, že mluvíš nahlas. Jdeme dál.</p></div>'); setTimeout(() => done(true), 2200); return; }
    } catch (err) {
      if (['not-allowed', 'service-not-allowed', 'audio-capture', 'unsupported', 'network', 'language-not-supported'].includes(err)) {
        micOK = false; render(); st('<p class="cz">Mikrofon v telefonu teď nejde použít. Nevadí, zkusíme to bez něj: řekni to nahlas sama pro sebe.</p>'); return;
      }
      if (err === 'aborted') return;
      st('<div class="fb try"><p>Telefon nic nezachytil. Podrž ho blíž a zkus to znovu.</p></div>');
    }
    b.disabled = false; b.textContent = '🎤 Teď mluvím já';
  }
  render();
}
