// Odměny: zvuky (Web Audio, bez souborů, funguje offline), maskot Kapka a konfety.
// Chyba zní jemně a zvědavě, nikdy jako trest. Vše jde vypnout v sekci Pro rodiče.
import { S } from './store.js';

const on = () => S.sfx !== false;
const calm = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- zvuky ---------- */
let ctx = null;
function ac() {
  if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; try { ctx = new A(); } catch (e) { return null; } }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
// Jeden tón: frekvence, začátek (s), délka (s), hlasitost, barva zvuku.
function tone(f, at, dur, vol = 0.18, type = 'sine', slideTo) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
}
// Potlesk: hodně krátkých šumových „tlesknutí“ v náhodných časech.
function applause(at = 0, len = 2.2) {
  const c = ac(); if (!c) return;
  const sr = c.sampleRate, buf = c.createBuffer(1, Math.floor(sr * 0.05), sr), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
  const n = 70;
  for (let k = 0; k < n; k++) {
    const x = Math.random(), when = at + x * len;
    const amp = 0.25 * Math.sin(Math.PI * Math.min(1, x * 1.15)) + 0.03; // zesílí a zase utichne
    const s = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf; s.playbackRate.value = 0.8 + Math.random() * 0.5;
    bp.type = 'bandpass'; bp.frequency.value = 900 + Math.random() * 1600; bp.Q.value = 1.2;
    g.gain.value = amp;
    s.connect(bp).connect(g).connect(c.destination);
    s.start(c.currentTime + when);
  }
}
const vib = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

export const sfx = {
  ok() { if (!on()) return; tone(784, 0, 0.16, 0.16, 'triangle'); tone(1175, 0.09, 0.32, 0.15, 'triangle'); vib(25); },          // „ding-dink“
  hint() { if (!on()) return; tone(523, 0, 0.18, 0.09, 'sine', 494); tone(587, 0.16, 0.26, 0.08, 'sine'); },                   // „hmm?“ zvědavě nahoru
  reveal() { if (!on()) return; tone(440, 0, 0.35, 0.08, 'sine', 392); },                                                     // klidný tón
  tap() { if (!on()) return; tone(988, 0, 0.09, 0.1, 'triangle'); },                                                         // dvojice sedí
  soft() { if (!on()) return; tone(330, 0, 0.12, 0.05, 'sine'); },                                                           // nesedí, skoro neslyšně
  finish(big = true) {                                                                                                       // fanfára + potlesk
    if (!on()) return;
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.3, 0.14, 'triangle'));
    tone(1319, 0.48, 0.6, 0.12, 'triangle'); tone(1047, 0.48, 0.6, 0.08, 'sine');
    if (big) applause(0.35, 2.4);
    vib([30, 60, 30]);
  }
};

/* ---------- maskot Kapka ---------- */
const FACES = {
  happy: '<path d="M37 64q5-6 10 0M53 64q5-6 10 0" stroke="#2A2140" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M41 76q9 9 18 0" stroke="#2A2140" stroke-width="3.5" fill="none" stroke-linecap="round"/>',
  think: '<circle cx="42" cy="63" r="6" fill="#fff"/><circle cx="58" cy="63" r="6" fill="#fff"/><circle cx="43.5" cy="60.5" r="3" fill="#2A2140"/><circle cx="59.5" cy="60.5" r="3" fill="#2A2140"/><circle cx="51" cy="79" r="3.6" fill="#2A2140"/>',
  cheer: '<path d="M36 63q6-7 12 0M52 63q6-7 12 0" stroke="#2A2140" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M38 73q12 17 24 0z" fill="#2A2140"/><path d="M44 77q6 5 12 0" fill="#FF8FB8"/>'
};
const ARMS = {
  happy: '<path d="M17 74q-8 2-10 10M83 74q8 2 10 10" stroke="var(--violet)" stroke-width="6" fill="none" stroke-linecap="round"/>',
  think: '<path d="M17 76q-8 4-8 12M83 72q10-4 4-16" stroke="var(--violet)" stroke-width="6" fill="none" stroke-linecap="round"/>',
  cheer: '<path d="M18 66q-10-8-10-22M82 66q10-8 10-22" stroke="var(--violet)" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="8" cy="42" r="5" fill="var(--sun)"/><circle cx="92" cy="42" r="5" fill="var(--pink)"/>'
};
export function kapka(mood = 'happy', size = 64) {
  return `<svg class="kapka ${mood}" viewBox="0 0 100 106" width="${size}" height="${Math.round(size * 1.06)}" aria-hidden="true">
    ${ARMS[mood] || ''}
    <path d="M50 6C50 6 16 46 16 68a34 34 0 0 0 68 0C84 46 50 6 50 6Z" fill="var(--violet)"/>
    <path d="M50 6C50 6 16 46 16 68a34 34 0 0 0 68 0C84 46 50 6 50 6Z" fill="url(#kg)" opacity=".35"/>
    <defs><radialGradient id="kg" cx=".35" cy=".35" r=".7"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
    <ellipse cx="36" cy="44" rx="5" ry="9" fill="#fff" opacity=".55" transform="rotate(25 36 44)"/>
    <circle cx="33" cy="73" r="4.5" fill="var(--pink)" opacity=".55"/><circle cx="67" cy="73" r="4.5" fill="var(--pink)" opacity=".55"/>
    ${FACES[mood] || FACES.happy}
  </svg>`;
}
// Zpětná vazba s maskotem (když jsou efekty zapnuté).
export function withKapka(ok, html) {
  if (!on()) return html;
  return `<div class="fbm">${kapka(ok ? 'happy' : 'think', 58)}<div class="fbt">${html}</div></div>`;
}

/* ---------- konfety ---------- */
export function confetti(n = 70) {
  if (!on() || calm()) return;
  const box = document.createElement('div'); box.className = 'confetti'; box.setAttribute('aria-hidden', 'true');
  const cols = ['var(--pink)', 'var(--sun)', 'var(--teal)', 'var(--violet)', 'var(--sky)'];
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    const x = Math.random() * 100, dx = (Math.random() - 0.5) * 40, r = Math.random() * 720 - 360;
    p.style.cssText = `left:${x}%;background:${cols[i % cols.length]};--dx:${dx}vw;--r:${r}deg;animation-delay:${Math.random() * 0.4}s;animation-duration:${1.8 + Math.random() * 1.2}s;${Math.random() < 0.35 ? 'border-radius:50%;' : ''}`;
    box.appendChild(p);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 3600);
}
// Velká oslava: fanfára, potlesk, konfety.
export function celebrate(big = true) { sfx.finish(big); confetti(big ? 80 : 40); }
