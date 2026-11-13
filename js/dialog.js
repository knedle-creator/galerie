// Rozhovory: 1 poslech bez textu → 2 otázky → 3 text s překladem → 4 hraní role.
import { $, $$, esc, rand, shuffle, sleep, OK } from './util.js';
import { S, save } from './store.js';
import { app, route, go, onLeave } from './ui.js';
import { speak, stopAll, hasTTS, speakWidget, PEOPLE, newToken, token, castVoices, clearCast } from './speech.js';
import { item } from './packs.js';
import { sfx, celebrate, withKapka, kapka } from './fx.js';
import { P, g } from './profile.js';

const STEPS = [['listen', '1 Poslech'], ['quiz', '2 Otázky'], ['text', '3 Text'], ['role', '4 Role']];
const who = n => PEOPLE[n] || { e: '🙂' };
let D = null;

route('dialog', ({ key }) => {
  const it = item(key); if (!it) return go('home', {}, { replace: true });
  const pr = S.prog[key] || (S.prog[key] = {});
  const step = pr.run && STEPS.some(s => s[0] === pr.run.step) ? pr.run.step : (hasTTS ? 'listen' : 'text');
  D = { key, d: it.data, step, qi: 0, tries: 0, me: null, ri: -1 };
  castVoices([...it.data.people, ...it.data.lines.map(l => l.who)]); // každá postava jiný hlas
  onLeave(clearCast);
  S.last = key; setStep(step);
});

function setStep(step) {
  D.step = step; D.qi = 0; D.tries = 0; D.me = null; D.ri = -1;
  const pr = S.prog[D.key];
  if (!pr.done || pr.run) pr.run = { step }; // hotový rozhovor zůstane hotový
  save(); draw();
}

async function playLines(idxs, onLine) {
  const tok = newToken();
  for (const k of idxs) {
    if (tok !== token()) return false;
    onLine && onLine(k);
    const l = D.d.lines[k];
    await speak(l.en, { force: true, who: l.who });
    await sleep(250);
  }
  if (tok === token()) onLine && onLine(-1);
  return tok === token();
}
const fb = h => { const f = $('#fb'); if (f) f.innerHTML = h; };
const fbk = (ok, inner) => fb(`<div class="fb ${ok ? 'ok' : 'try'}">${withKapka(ok, inner)}</div>`);

function draw() {
  stopAll();
  const d = D.d, all = d.lines.map((_, k) => k);
  const steps = `<div class="steps">${STEPS.map(([k, l]) => `<button class="${D.step === k ? 'on' : ''}" data-s="${k}" ${!hasTTS && (k === 'listen' || k === 'quiz') ? 'disabled' : ''}>${l}</button>`).join('')}</div>`;
  const slowBox = hasTTS ? `<label class="toggle"><input type="checkbox" id="slow" ${S.slow ? 'checked' : ''}> 🐢 Pomaleji</label>` : '';
  let body = '';
  if (D.step === 'listen') {
    body = `<p>Poslouchej bez textu. Nevadí, když nerozumíš všemu. Zkus zachytit, kdo mluví a o čem.</p>
     <div class="avs">${d.people.map(p => `<div class="av" data-av="${esc(p)}">${esc(who(p).e)}<small>${esc(p)}</small></div>`).join('')}</div>
     <div class="row"><button class="btn pink" id="play">▶️ Přehrát rozhovor</button><button class="btn ghost" id="stop">⏹ Stop</button></div>
     ${slowBox}<div class="actions"><button class="btn wide" id="nextstep">Jdu na otázky</button></div>`;
  } else if (D.step === 'quiz') {
    const qs = d.qs || [];
    if (D.qi >= qs.length) {
      body = `<div class="fb ok"><h3>Otázky máš za sebou</h3><p>${g('Odpovídala', 'Odpovídal')} jsi jen podle toho, co jsi ${g('slyšela', 'slyšel')}. ${P.t.listenSkill}</p></div>
       <div class="actions"><button class="btn wide" id="nextstep">Teď si přečti text</button></div>`;
    } else {
      const Q = qs[D.qi];
      body = `<p class="cz">Otázka ${D.qi + 1} ze ${qs.length}</p><p class="q">${esc(Q.q)} ${hasTTS ? '<button class="say" id="sayq" aria-label="Přečíst otázku">🔊</button>' : ''}</p>
       <div class="opts">${shuffle(Q.opts).map(v => `<button class="opt" data-v="${esc(v)}">${esc(v)}</button>`).join('')}</div>
       <div class="row"><button class="btn ghost small" id="part">🔁 Pustit tu část znovu</button><button class="btn ghost small" id="whole">Celý rozhovor</button></div>
       <div id="fb" aria-live="polite"></div><div class="actions" id="acts"></div>`;
    }
  } else if (D.step === 'text') {
    body = `<p>${hasTTS ? 'Klepni na 🔊 u věty, nebo pusť celý rozhovor. ' : ''}Klepnutím na CZ uvidíš překlad.</p>
     ${hasTTS ? `<div class="row"><button class="btn pink" id="play">▶️ Celý rozhovor</button><button class="btn ghost" id="stop">⏹ Stop</button></div>${slowBox}` : ''}
     <div style="margin-top:.6rem">${d.lines.map((l, k) => `<div class="dl" id="dl${k}"><span class="who">${esc(who(l.who).e)}</span><div class="tx"><b>${esc(l.who)}</b>${esc(l.en)}<div class="tr">${esc(l.cz || '')}</div></div>
       ${hasTTS ? `<button class="say" data-line="${k}" aria-label="Přehrát">🔊</button>` : ''}<button class="say cz-btn" data-cz="${k}" aria-label="Překlad">CZ</button></div>`).join('')}</div>
     <div class="actions"><button class="btn wide" id="nextstep">Zahrát si roli</button></div>`;
  } else if (D.step === 'role') {
    if (!D.me) {
      body = `<p>Ty budeš mluvit za jednu postavu, telefon za tu druhou. Tvoje věty uvidíš napsané, stačí je přečíst nahlas.</p>
       <div class="opts">${d.people.map(p => `<button class="opt" data-me="${esc(p)}">${esc(who(p).e)} Budu ${esc(p)}</button>`).join('')}</div>`;
    } else {
      body = `<div>${d.lines.map((l, k) => `<div class="dl" id="dl${k}"><span class="who">${esc(who(l.who).e)}</span><div class="tx ${l.who === D.me ? 'mine' : ''}"><b>${esc(l.who)}${l.who === D.me ? ' (ty)' : ''}</b><span class="t">${k <= D.ri ? esc(l.en) : '…'}</span><div id="sw${k}"></div></div></div>`).join('')}</div>
       <div id="fb"></div><div class="actions" id="acts"></div>`;
    }
  }
  app.innerHTML = `<div class="card"><h2>${esc(d.title)}</h2>${d.cz ? `<p class="cz">${esc(d.cz)}</p>` : ''}${steps}${body}</div>`;

  $$('.steps button').forEach(b => b.onclick = () => setStep(b.dataset.s));
  const ns = $('#nextstep'); if (ns) ns.onclick = () => { const i = STEPS.findIndex(s => s[0] === D.step); setStep(STEPS[i + 1][0]); };
  const sl = $('#slow'); if (sl) sl.onchange = () => { S.slow = sl.checked; save(); };
  const stop = $('#stop'); if (stop) stop.onclick = stopAll;

  if (D.step === 'listen') {
    $('#play').onclick = () => playLines(all, k => { $$('.av').forEach(a => a.classList.toggle('talk', k >= 0 && a.dataset.av === d.lines[k].who)); });
  }
  if (D.step === 'text') {
    const hl = k => { $$('.dl').forEach(x => x.classList.remove('cur')); if (k >= 0) $('#dl' + k).classList.add('cur'); };
    const p = $('#play'); if (p) p.onclick = () => playLines(all, hl);
    $$('[data-line]').forEach(b => b.onclick = () => playLines([+b.dataset.line], hl));
    $$('[data-cz]').forEach(b => b.onclick = () => $('#dl' + b.dataset.cz).classList.toggle('showcz'));
  }
  if (D.step === 'quiz' && D.qi < (d.qs || []).length) {
    const Q = d.qs[D.qi]; let solved = false;
    const part = () => playLines([Math.max(0, Q.line - 1), Q.line]);
    const nextQ = () => { $('#acts').innerHTML = '<button class="btn pink wide" id="nq">Další</button>'; $('#nq').onclick = () => { D.qi++; D.tries = 0; draw(); }; };
    const sq = $('#sayq'); if (sq) sq.onclick = () => speak(Q.q, { force: true });
    $('#part').onclick = part;
    $('#whole').onclick = () => playLines(all);
    $$('.opt').forEach(b => b.onclick = () => {
      if (solved) return;
      if (b.dataset.v === Q.a) {
        solved = true; b.classList.add('right'); $$('.opt').forEach(x => x.disabled = true);
        sfx.ok(); fbk(true, `<h3>${rand(OK)}</h3><p><b>${esc(Q.a)}</b></p>`); nextQ();
      } else {
        b.classList.add('wrong'); b.disabled = true; D.tries++;
        if (D.tries < 2) { sfx.hint(); fbk(false, '<h3>Ještě jednou</h3><p>Pustím ti tu část znovu. Poslouchej pozorně a zkus to ještě jednou.</p>'); setTimeout(part, 500); }
        else {
          solved = true; $$('.opt').forEach(x => { x.disabled = true; if (x.dataset.v === Q.a) x.classList.add('right'); });
          const l = d.lines[Q.line];
          sfx.reveal(); fbk(false, `<h3>Tohle si zapamatuj</h3><p>V rozhovoru zaznělo: <b>${esc(l.en)}</b></p><p class="cz">${esc(l.cz || '')}</p>`); nextQ();
        }
      }
    });
  }
  if (D.step === 'role' && !D.me) $$('[data-me]').forEach(b => b.onclick = () => { D.me = b.dataset.me; D.ri = -1; draw(); roleNext(); });
}

async function roleNext() {
  const d = D.d; D.ri++;
  $$('.dl').forEach(x => x.classList.remove('cur'));
  if (D.ri >= d.lines.length) {
    const pr = S.prog[D.key]; pr.done = true; pr.doneAt = new Date().toISOString(); delete pr.run; save();
    fb(`<div class="fb ok"><div class="kapka-big">${kapka('cheer', 96)}</div><h3>${g('Zahrála', 'Zahrál')} jsi celou roli 🎭</h3><p>${g('Mluvila', 'Mluvil')} jsi v rozhovoru anglicky od začátku do konce. Příště si můžeš zahrát i tu druhou postavu.</p></div>`);
    celebrate(true);
    $('#acts').innerHTML = '<button class="btn pink wide" id="again">Zahrát druhou roli</button><button class="btn ghost wide" id="dl">Zpět</button>';
    $('#again').onclick = () => { D.me = d.people.find(p => p !== D.me) || D.me; D.ri = -1; draw(); roleNext(); };
    $('#dl').onclick = () => history.back();
    return;
  }
  const l = d.lines[D.ri], row = $('#dl' + D.ri);
  if (!row) return;
  row.classList.add('cur'); row.querySelector('.t').textContent = l.en; row.scrollIntoView({ block: 'center', behavior: 'smooth' });
  if (l.who !== D.me) {
    const tok = newToken(), ri = D.ri;
    await speak(l.en, { force: true, who: l.who });
    if (tok !== token() || !D || D.ri !== ri || !$('#dl' + ri)) return;
    setTimeout(roleNext, hasTTS ? 300 : 1500 + l.en.length * 60); // bez hlasu je čas si větu přečíst
  } else {
    row.querySelector('.t').textContent = '';
    speakWidget($('#sw' + D.ri), l.en, () => {
      const sw = $('#sw' + D.ri); if (sw) sw.innerHTML = '';
      row.querySelector('.t').textContent = l.en; setTimeout(roleNext, 300);
    }, l.who);
  }
}
