// Čtení: odstavce s 🔊, skrytý překlad, klepnutí na slovo = překlad, na konci otázky a úkol „think“.
import { $, $$, esc, rand, shuffle, OK } from './util.js';
import { S, save } from './store.js';
import { app, route, go, sheet, toast } from './ui.js';
import { speak, hasTTS } from './speech.js';
import { item, lookupWord } from './packs.js';
import { sfx, celebrate, withKapka, kapka } from './fx.js';
import { addToMyVocab } from './vocab.js';
import { g } from './profile.js';

const wrapWords = t => String(t).split(/([A-Za-z]+(?:['’][A-Za-z]+)*)/).map((s, i) => i % 2 ? `<span class="w" data-w="${esc(s)}">${esc(s)}</span>` : esc(s)).join('');

route('reading', ({ key }) => {
  const it = item(key); if (!it) return go('home', {}, { replace: true });
  const r = it.data;
  const pr = S.prog[key] || (S.prog[key] = {});
  if (!pr.done) pr.run = pr.run || { q: 0 };
  S.last = key; save();
  app.innerHTML = `<div class="card">${r.subject ? `<span class="subject">${esc(r.subject)}</span>` : ''}<h2>${esc(r.title)}</h2>${r.cz ? `<p class="cz">${esc(r.cz)}</p>` : ''}
   <p class="cz">Klepni na jakékoli slovo a uvidíš, co znamená.</p>
   ${r.paragraphs.map((p, k) => `<div class="para"><p class="en" data-p="${k}">${wrapWords(p.en)}</p>
     <div class="tools-row">${hasTTS ? `<button class="say" data-say="${k}" aria-label="Přečíst odstavec">🔊</button>` : ''}
     ${p.cz ? `<button class="btn ghost small" data-tr="${k}">Ukázat překlad</button>` : ''}</div>
     <p class="cz" id="tr${k}" hidden>${esc(p.cz || '')}</p></div>`).join('')}
   <div class="actions"><button class="btn pink wide" id="toq">${(r.qs || []).length ? 'Přečteno, jdu na otázky' : 'Přečteno'}</button></div></div>
   <div id="quiz"></div>`;

  $$('[data-say]').forEach(b => b.onclick = () => speak(r.paragraphs[+b.dataset.say].en, { force: true }));
  $$('[data-tr]').forEach(b => b.onclick = () => { const t = $('#tr' + b.dataset.tr); t.hidden = !t.hidden; b.textContent = t.hidden ? 'Ukázat překlad' : 'Skrýt překlad'; });
  $$('.w').forEach(w => w.onclick = () => {
    $$('.w.on').forEach(x => x.classList.remove('on')); w.classList.add('on');
    const para = r.paragraphs[+w.closest('[data-p]').dataset.p].en;
    showWord(w.dataset.w, r.glossary || [], para);
  });
  $('#toq').onclick = () => quiz(key, r);
});

function showWord(raw, glossary, para) {
  const hit = lookupWord(raw, glossary, para);
  const en = hit ? hit.en : raw;
  const c = sheet(`<p class="big-sent" style="margin:0">${esc(en)} ${hasTTS ? '<button class="say" id="wsay" aria-label="Přehrát">🔊</button>' : ''}</p>
    ${hit ? `<p style="font-size:1.2rem;margin:.3rem 0 0">${esc(hit.cz)}</p>`
          : `<p class="cz">Tohle slovo zatím ve slovníčku nemám. Můžeš si překlad napsat ${g('sama', 'sám')}:</p><input class="inp" id="wcz" placeholder="česky…" autocomplete="off">`}
    <div class="actions"><button class="btn" id="wadd">＋ Přidat do mého slovníčku</button><button class="btn ghost" data-close>Zavřít</button></div>`);
  const ws = $('#wsay', c); if (ws) ws.onclick = () => speak(en, { force: true });
  speak(en);
  $('#wadd', c).onclick = () => {
    const cz = hit ? hit.cz : ($('#wcz', c).value || '').trim();
    if (!cz) { toast('Napiš nejdřív český překlad.'); return; }
    toast(addToMyVocab(en, cz) ? `„${en}“ je v tvém slovníčku.` : `„${en}“ už ve slovníčku máš.`);
    document.getElementById('ov').innerHTML = '';
  };
}

function quiz(key, r) {
  const qs = r.qs || [], el = $('#quiz');
  const finish = () => {
    const pr = S.prog[key]; pr.done = true; pr.doneAt = new Date().toISOString(); delete pr.run; save();
    celebrate(true);
    el.innerHTML = `<div class="card"><div class="kapka-big">${kapka('cheer', 110)}</div><h2 style="text-align:center">Čtení hotové</h2>
      <p>${g('Prokousala', 'Prokousal')} ses celým anglickým textem. Čtení je trénink trpělivosti a ty jsi ${g('vydržela', 'vydržel')}.</p>
      ${r.think ? `<div class="tip"><b>💭 Na přemýšlení:</b> ${esc(r.think)}</div>` : ''}
      <div class="actions"><button class="btn pink wide" id="rdone">Hotovo</button></div></div>`;
    $('#rdone').onclick = () => history.back();
    el.scrollIntoView({ behavior: 'smooth' });
  };
  let qi = 0;
  const ask = () => {
    if (qi >= qs.length) return finish();
    const Q = qs[qi]; let tries = 0, solved = false;
    el.innerHTML = `<div class="card"><p class="cz">Otázka ${qi + 1} ze ${qs.length}</p><p class="q">${esc(Q.q)}</p>
      <div class="opts">${shuffle(Q.opts).map(v => `<button class="opt" data-v="${esc(v)}">${esc(v)}</button>`).join('')}</div>
      <div id="rfb" aria-live="polite"></div><div class="actions" id="racts"></div></div>`;
    el.scrollIntoView({ behavior: 'smooth' });
    const next = () => { $('#racts').innerHTML = '<button class="btn pink wide" id="rnx">Další</button>'; $('#rnx').onclick = () => { qi++; ask(); }; };
    $$('.opt', el).forEach(b => b.onclick = () => {
      if (solved) return;
      const fbk = (ok, inner) => { $('#rfb').innerHTML = `<div class="fb ${ok ? 'ok' : 'try'}">${withKapka(ok, inner)}</div>`; };
      if (b.dataset.v === Q.a) { solved = true; b.classList.add('right'); $$('.opt', el).forEach(x => x.disabled = true); sfx.ok(); fbk(true, `<h3>${rand(OK)}</h3>`); next(); return; }
      b.classList.add('wrong'); b.disabled = true; tries++;
      if (tries < 2) { sfx.hint(); fbk(false, '<h3>Ještě jednou</h3><p>Odpověď je schovaná v textu nahoře. Projeď ho očima ještě jednou.</p>'); }
      else { solved = true; $$('.opt', el).forEach(x => { x.disabled = true; if (x.dataset.v === Q.a) x.classList.add('right'); }); sfx.reveal(); fbk(false, `<h3>Tohle si zapamatuj</h3><p>Správně je: <b>${esc(Q.a)}</b></p>`); next(); }
    });
  };
  ask();
}
