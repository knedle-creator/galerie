// Slovníček: (a) všechna slova z balíčků, (b) Můj slovníček s krabičkami (Leitner) a kartičkami.
import { $, $$, esc, shuffle } from './util.js';
import { S, save } from './store.js';
import { app, route, go, toast, setProgress } from './ui.js';
import { speak, hasTTS } from './speech.js';
import { allWords } from './packs.js';
import { sfx, celebrate, kapka } from './fx.js';

const MAXBOX = 5;
const boxInfo = b => b <= 1 ? ['b1', 'ještě ne'] : b <= 3 ? ['b2', 'skoro'] : ['b3', 'umím'];
const fold = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/’/g, "'");

export function addToMyVocab(en, cz, own = false) {
  const id = String(en).trim().toLowerCase();
  if (!id || S.vocab.some(v => v.id === id)) return false;
  S.vocab.push({ id, en: String(en).trim(), cz: String(cz).trim(), box: 1, own, added: new Date().toISOString() });
  save(); return true;
}

route('vocab', ({ tab = 'all' }) => {
  app.innerHTML = `<header class="hero"><h1>📚 Slovníček</h1></header>
   <div class="tabs" role="tablist"><button data-t="all" class="${tab === 'all' ? 'on' : ''}">Všechna slova</button><button data-t="my" class="${tab === 'my' ? 'on' : ''}">Můj slovníček (${S.vocab.length})</button></div>
   <div id="vb"></div>`;
  $$('.tabs button').forEach(b => b.onclick = () => go('vocab', { tab: b.dataset.t }, { replace: true }));
  tab === 'my' ? mine() : all();
});

function all() {
  const words = allWords();
  $('#vb').innerHTML = `<input class="inp" id="q" type="search" placeholder="Hledej česky nebo anglicky…" autocomplete="off" aria-label="Hledat">
   <div class="card" style="margin-top:.8rem"><ul class="words" id="wl"></ul><p class="cz" id="none" hidden>Nic se nenašlo. Zkus jiné slovo.</p></div>`;
  const draw = () => {
    const q = fold($('#q').value.trim());
    const list = q ? words.filter(w => fold(w.en).includes(q) || fold(w.cz).includes(q)) : words;
    $('#wl').innerHTML = list.map(w => {
      const mine = S.vocab.some(v => v.id === w.en.toLowerCase());
      return `<li><span class="e">${esc(w.e)}</span><b>${esc(w.en)}</b>${hasTTS ? `<button class="say" data-say="${esc(w.en)}" aria-label="Přehrát">🔊</button>` : ''}
       <span class="cz">${esc(w.cz)}</span><button class="addbtn" data-en="${esc(w.en)}" data-cz="${esc(w.cz)}" aria-label="Přidat do mého slovníčku" ${mine ? 'disabled' : ''}>${mine ? '✓' : '＋'}</button></li>`;
    }).join('');
    $('#none').hidden = list.length > 0;
    $$('[data-say]').forEach(b => b.onclick = () => speak(b.dataset.say, { force: true }));
    $$('.addbtn').forEach(b => b.onclick = () => { if (addToMyVocab(b.dataset.en, b.dataset.cz)) { toast(`„${b.dataset.en}“ je v tvém slovníčku.`); b.textContent = '✓'; b.disabled = true; } });
  };
  $('#q').oninput = draw; draw();
}

function mine() {
  const v = S.vocab;
  $('#vb').innerHTML = `${v.length ? `<button class="btn pink wide" id="rev">🗂️ Opakovat kartičky</button>` : ''}
   <div class="card" style="margin-top:.8rem">${v.length
     ? `<ul class="words">${v.slice().sort((a, b) => a.box - b.box).map(w => { const [c, l] = boxInfo(w.box); return `<li><span class="wtx"><b>${esc(w.en)}</b><small class="cz">${esc(w.cz)}</small></span>${hasTTS ? `<button class="say" data-say="${esc(w.en)}" aria-label="Přehrát">🔊</button>` : ''}<span class="box ${c}">${l}</span><button class="addbtn" data-del="${esc(w.id)}" aria-label="Odebrat">✕</button></li>`; }).join('')}</ul>`
     : '<p>Zatím tu nic není. Slova přidáš tlačítkem ＋ ve „Všech slovech“, klepnutím na slovo při čtení, nebo tady dole.</p>'}</div>
   <div class="card"><h3>Přidat vlastní slovo</h3>
    <label class="lbl" for="nen">Anglicky</label><input class="inp" id="nen" autocomplete="off" autocapitalize="off">
    <label class="lbl" for="ncz">Česky</label><input class="inp" id="ncz" autocomplete="off">
    <div class="actions"><button class="btn" id="nadd">＋ Přidat</button></div></div>`;
  $$('[data-say]').forEach(b => b.onclick = () => speak(b.dataset.say, { force: true }));
  $$('[data-del]').forEach(b => b.onclick = () => { S.vocab = S.vocab.filter(x => x.id !== b.dataset.del); save(); go('vocab', { tab: 'my' }, { replace: true }); });
  const r = $('#rev'); if (r) r.onclick = () => go('flash');
  $('#nadd').onclick = () => {
    const en = $('#nen').value.trim(), cz = $('#ncz').value.trim();
    if (!en || !cz) { toast('Vyplň obě políčka.'); return; }
    toast(addToMyVocab(en, cz, true) ? 'Přidáno.' : 'Tohle slovo už ve slovníčku máš.');
    go('vocab', { tab: 'my' }, { replace: true });
  };
}

// Kartičky: nejdřív slova v nejnižších krabičkách. Správně = o krabičku dál, špatně = zpět na začátek.
route('flash', () => {
  const pool = shuffle(S.vocab).sort((a, b) => a.box - b.box).slice(0, 5);
  if (!pool.length) return go('vocab', { tab: 'my' }, { replace: true });
  let i = 0, knew = 0;
  const card = () => {
    setProgress(i / pool.length * 100);
    if (i >= pool.length) {
      celebrate(false);
      app.innerHTML = `<div class="card" style="margin-top:1rem"><div class="kapka-big">${kapka('cheer', 100)}</div><h2 style="text-align:center">Kartičky prošlé</h2>
        <p>Prošla jsi ${pool.length} ${pool.length === 1 ? 'kartičku' : pool.length < 5 ? 'kartičky' : 'kartiček'}. ${knew ? `${knew}× sis vzpomněla a ${knew === 1 ? 'to slovo se posunulo' : 'ta slova se posunula'} o krabičku dál.` : 'Slova, která si zatím nepamatuješ, ti ukážu znovu příště.'}</p>
        <p class="cz">Opakování po kouskách funguje líp než jedno dlouhé učení.</p>
        <div class="actions"><button class="btn pink wide" id="again">Dalších 5 kartiček</button><button class="btn ghost wide" id="bk">Zpět do slovníčku</button></div></div>`;
      $('#again').onclick = () => go('flash', {}, { replace: true });
      $('#bk').onclick = () => history.back();
      return;
    }
    const w = pool[i];
    app.innerHTML = `<div class="card flash"><p class="cz">Kartička ${i + 1} z ${pool.length}</p>
      <p class="en">${esc(w.en)}</p>${hasTTS ? `<button class="say" id="fs" aria-label="Přehrát">🔊</button>` : ''}
      <p class="czw" id="ans" hidden>${esc(w.cz)}</p>
      <div class="actions" id="fa"><button class="btn wide" id="show">Ukázat překlad</button></div></div>`;
    const fs = $('#fs'); if (fs) fs.onclick = () => speak(w.en, { force: true });
    speak(w.en);
    $('#show').onclick = () => {
      $('#ans').hidden = false;
      $('#fa').innerHTML = '<button class="btn pink wide" id="yes">👍 Věděla jsem</button><button class="btn ghost wide" id="no">Ještě ne</button>';
      const mark = ok => { if (ok) sfx.ok(); const x = S.vocab.find(v => v.id === w.id); if (x) { x.box = ok ? Math.min(MAXBOX, x.box + 1) : 1; x.seen = new Date().toISOString(); save(); } if (ok) knew++; i++; card(); };
      $('#yes').onclick = () => mark(true);
      $('#no').onclick = () => mark(false);
    };
  };
  card();
});
