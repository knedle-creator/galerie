// Úvod lekce a přehrávač cvičení (mc, listen, gap, pair, build, type, dict, speak).
import { $, $$, esc, norm, shuffle, rand, safeHtml, pl, OK, SPOKE } from './util.js';
import { S, save } from './store.js';
import { app, route, go, toHome, setProgress, onLeave } from './ui.js';
import { speak, hasTTS, speakWidget, token } from './speech.js';
import { sfx, celebrate, withKapka, kapka } from './fx.js';
import { item, exRef, artOf, ITEMS } from './packs.js';
import { openItem, artHtml } from './home.js';
import { P, g } from './profile.js';

/* ---------- úvod lekce ---------- */
export function wordList(ws) {
  return `<ul class="words">${ws.map(w => `<li><span class="e">${esc(w[0])}</span><b>${esc(w[1])}</b>${hasTTS ? `<button class="say" data-say="${esc(String(w[1]).replace(/→|\//g, ','))}" aria-label="Přehrát">🔊</button>` : ''}<span class="cz">${esc(w[2])}</span></li>`).join('')}</ul>`;
}
export const wireSay = (root = app) => $$('[data-say]', root).forEach(b => b.onclick = () => speak(b.dataset.say, { force: true }));

route('lesson', ({ key }) => {
  const it = item(key); if (!it) return go('home', {}, { replace: true });
  const L = it.data, run = S.prog[key]?.run;
  app.innerHTML = `<div class="card"><h2>${esc(L.title)}</h2>${L.cz ? `<p class="cz">${esc(L.cz)}</p>` : ''}${safeHtml(L.intro || '')}
   ${L.words && L.words.length ? wordList(L.words) + (hasTTS ? '<p class="cz">Klepni na 🔊 a poslechni si výslovnost.</p>' : '') : ''}
   <div class="actions">${run
     ? `<button class="btn pink wide" id="go">Pokračovat tam, kde jsem ${g('skončila', 'skončil')} (${run.n + 1}/${run.total})</button><button class="linkbtn" id="fresh">Začít lekci od začátku</button>`
     : `<button class="btn pink wide" id="go">${S.prog[key]?.done ? 'Zopakovat lekci' : 'Začít lekci'}</button>`}</div></div>`;
  wireSay();
  $('#go').onclick = () => go('play', { key }, { replace: false });
  const f = $('#fresh'); if (f) f.onclick = () => { delete S.prog[key].run; save(); go('play', { key }); };
});

/* ---------- přehrávač ---------- */
let run = null, cur = null, tries = 0, answered = false;

route('play', p => {
  if (p.mode === 'review') {
    const q = shuffle(S.mist).slice(0, 8).map(id => { const i = id.lastIndexOf(':'); return { r: id.slice(0, i), ei: +id.slice(i + 1) }; }).filter(x => exRef(x.r, x.ei));
    S.mist = S.mist.filter(id => { const i = id.lastIndexOf(':'); return exRef(id.slice(0, i), +id.slice(i + 1)); }); save();
    if (!q.length) return go('home', {}, { replace: true });
    run = { key: null, title: 'Opakování', mode: 'review', queue: q, n: 0, total: q.length, fixed: 0, requeued: [] };
  } else {
    const it = item(p.key); if (!it) return go('home', {}, { replace: true });
    const r = `${it.pack.id}|${it.data.id}`;
    const saved = S.prog[p.key]?.run;
    run = saved && saved.queue && saved.queue.length && saved.queue.every(x => exRef(x.r, x.ei))
      ? Object.assign({ key: p.key, it, mode: it.kind }, saved)
      : { key: p.key, it, mode: it.kind, queue: it.data.ex.map((_, ei) => ({ r, ei })), n: 0, total: it.data.ex.length, fixed: 0, requeued: [] };
    S.last = p.key; persist();
  }
  onLeave(() => { run = null; });
  show();
});

function persist() {
  if (!run || !run.key) return;
  const pr = S.prog[run.key] || (S.prog[run.key] = {});
  pr.run = { queue: run.queue, n: run.n, total: run.total, fixed: run.fixed, requeued: run.requeued };
  save();
}
const optsHtml = o => `<div class="opts">${shuffle(o).map(v => `<button class="opt" data-v="${esc(v)}">${esc(v)}</button>`).join('')}</div>`;

function show(opt = {}) {
  if (!run) return;
  if (!run.queue.length) return finish();
  setProgress(run.n / run.total * 100);
  const q0 = run.queue[0];
  cur = { ...exRef(q0.r, q0.ei), id: `${q0.r}:${q0.ei}` };
  tries = 0; answered = false;
  const E = cur; let body = '', check = true;
  const noVoice = !hasTTS || opt.noVoice;
  if (E.t === 'mc') { body = `<p class="q">${safeHtml(E.q)}${E.say && hasTTS ? ` <button class="say" id="sp" aria-label="Přehrát">🔊</button>` : ''}</p>${optsHtml(E.opts)}`; check = false; }
  else if (E.t === 'listen') {
    body = (noVoice ? `<p class="q">Jak se řekne <b>${esc(E.cz || '')}</b>?</p>`
      : '<p class="q">Poslechni si a vyber slovo. <button class="say" id="sp" aria-label="Přehrát">🔊</button></p>') + optsHtml(E.opts)
      + (noVoice ? '' : '<p><button class="linkbtn" id="nv">Nic neslyším</button></p>');
    check = false;
  }
  else if (E.t === 'gap') { body = `<p class="q">Doplň větu.</p><p class="sent">${esc(E.s).replace('___', '<span class="blank" id="blank">&nbsp;</span>')}</p>${optsHtml(E.opts)}`; check = false; }
  else if (E.t === 'pair') {
    body = `<p class="q">${safeHtml(E.q || 'Spoj dvojice.')}</p><div class="pairs"><div class="col">${shuffle(E.pairs.map(p => p[0])).map(v => `<button class="opt" data-side="l" data-v="${esc(v)}">${esc(v)}</button>`).join('')}</div>
     <div class="col">${shuffle(E.pairs.map(p => p[1])).map(v => `<button class="opt" data-side="r" data-v="${esc(v)}">${esc(v)}</button>`).join('')}</div></div>`; check = false;
  } else if (E.t === 'build') {
    E._tiles = shuffle(E.a.replace(/[.,!?]/g, '').split(' ').concat(E.extra || []));
    body = `<p class="q">Přelož do angličtiny.</p><p class="sent">${esc(E.cz)}</p><div class="line" id="line"></div>
     <div class="tiles">${E._tiles.map((w, k) => `<button class="tile" data-k="${k}">${esc(w)}</button>`).join('')}</div>`;
  } else if (E.t === 'type') {
    body = `<p class="q">${E.hint ? `Napiš správný tvar slovesa <b>${esc(E.hint)}</b>.` : 'Doplň slovo.'}</p><p class="sent">${esc(E.s).replace('___', '<span class="blank">…</span>')}</p>
     <input class="inp" id="inp" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Tvoje odpověď">`;
  } else if (E.t === 'dict') {
    E._copy = noVoice;
    body = noVoice
      ? `<p class="q">Opiš větu.</p><p class="cz">Telefon teď neumí přehrát zvuk, tak si větu přečti a napiš ji ${g('sama', 'sám')}.</p><p class="big-sent">${esc(E.a)}</p>
         <input class="inp" id="inp" autocomplete="off" autocapitalize="sentences" spellcheck="false" aria-label="Věta">`
      : `<p class="q">Poslechni si větu a napiš ji.</p><div class="row"><button class="btn ghost" id="p1">🔊 Přehrát</button><button class="btn ghost" id="p2">🐢 Pomalu</button></div>
         <input class="inp" id="inp" autocomplete="off" autocapitalize="sentences" spellcheck="false" aria-label="Co slyšíš">
         <p><button class="linkbtn" id="nv">Nic neslyším</button></p>`;
  } else if (E.t === 'speak') { body = `<p class="q">Řekni nahlas.</p><div id="spk"></div>`; check = false; }

  app.innerHTML = `<div class="card">${body}<div id="fb" aria-live="polite"></div>
   <div class="actions" id="acts">${check ? '<button class="btn wide" id="check">Zkontrolovat</button>' : ''}</div></div>`;

  const sp = $('#sp'); if (sp) sp.onclick = () => speak(E.say, { force: true });
  const nv = $('#nv'); if (nv) nv.onclick = () => show({ noVoice: true });
  if (E.t === 'listen' && !noVoice) setTimeout(() => cur === E && speak(E.say, { force: true }), 300);
  if (['mc', 'listen', 'gap'].includes(E.t)) $$('.opt').forEach(b => b.onclick = () => pick(b));
  if (E.t === 'pair') wirePairs();
  if (E.t === 'build') wireBuild();
  if (E.t === 'type' || E.t === 'dict') {
    const i = $('#inp'), fn = E.t === 'type' ? checkType : checkDict;
    i.onkeydown = e => { if (e.key === 'Enter') fn(); }; $('#check').onclick = fn;
  }
  if (E.t === 'dict' && !noVoice) {
    $('#p1').onclick = () => speak(E.a, { force: true, slow: false });
    $('#p2').onclick = () => speak(E.a, { force: true, slow: true });
    setTimeout(() => cur === E && speak(E.a, { force: true, slow: false }), 400);
  }
  if (E.t === 'speak') speakWidget($('#spk'), E.a, v => {
    if (answered) return; answered = true;
    if (v !== null) sfx.ok();
    fb(true, v === null ? '<p>Přeskočeno, nevadí. Příště to zkusíme znovu.</p>' : `<h3>${rand(OK)}</h3><p>${rand(SPOKE)}</p>`);
    cont(true);
  });
  window.scrollTo(0, 0);
}

function full() {
  const E = cur;
  if (E.t === 'gap') return E.s.replace('___', E.a);
  if (E.t === 'type') return E.s.replace('___', E.a[0]);
  if (['build', 'listen', 'dict', 'speak'].includes(E.t)) return E.a;
  if (E.t === 'mc') return /[áéíóúůýčďěňřšťž]/i.test(E.a) ? (E.say || '') : E.a;
  return '';
}
function good() {
  answered = true;
  const f = full();
  fb(true, `<h3>${rand(OK)}</h3>${f ? `<p><b>${esc(f)}</b></p>` : ''}${tries > 0 ? `<p>Napodruhé, ale ${g('sama', 'sám')}. Tohle se počítá.</p>` : ''}`);
  sfx.ok();
  if (f && cur.t !== 'dict') later(() => speak(f), S.sfx !== false ? 450 : 0); // nejdřív „ding“, pak věta
  if (run.mode === 'review') { S.mist = S.mist.filter(x => x !== cur.id); run.fixed++; save(); }
  else if (tries > 0 && !S.mist.includes(cur.id)) { S.mist.push(cur.id); save(); }
  cont(true);
}
// První chyba = nápověda a druhý pokus. Druhá chyba = ukážeme správnou odpověď.
function bad(final, msg) {
  if (!final) { tries++; sfx.hint(); fb(false, `<h3>Ještě jednou</h3><p>${msg}</p>`); return; }
  answered = true;
  fb(false, `<h3>Tohle si zapamatuj</h3><p>Správně je: <b>${esc(full())}</b></p>${msg ? `<p>${msg}</p>` : ''}${cur.why ? `<p>${esc(cur.why)}</p>` : ''}${run.mode !== 'review' ? '<p class="cz">Tahle úloha se ti ještě jednou vrátí na konci lekce.</p>' : ''}`);
  sfx.reveal();
  const f = full(); later(() => speak(f), 400);
  if (!S.mist.includes(cur.id)) { S.mist.push(cur.id); save(); }
  cont(false);
}
const fb = (ok, html) => { $('#fb').innerHTML = `<div class="fb ${ok ? 'ok' : 'try'}">${withKapka(ok, html)}</div>`; };
// Spustí akci se zpožděním, jen pokud mezitím neodešla na jinou úlohu.
const later = (fn, ms) => { const tk = token(); setTimeout(() => { if (tk === token()) fn(); }, ms); };

function cont(ok) {
  const a = $('#acts');
  a.innerHTML = '<button class="btn pink wide" id="nx">Pokračovat</button>';
  const b = $('#nx'); b.focus({ preventScroll: true });
  b.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  b.onclick = () => {
    const it = run.queue.shift(), k = `${it.r}:${it.ei}`;
    if (!ok && run.mode !== 'review' && !run.requeued.includes(k)) { run.requeued.push(k); run.queue.push(it); run.total++; }
    run.n++; persist(); show();
  };
}
function pick(b) {
  if (answered) return;
  const v = b.dataset.v, E = cur;
  if (E.t === 'gap') $('#blank').textContent = v;
  if (v === E.a) { b.classList.add('right'); $$('.opt').forEach(x => x.disabled = true); good(); return; }
  b.classList.add('wrong'); b.disabled = true;
  if (tries === 0) bad(false, esc(E.why || (E.t === 'gap' ? `Podívej se ještě jednou na celou větu. Jednu možnost už jsi ${g('vyřadila', 'vyřadil')}.` : E.t === 'listen' ? `Pusť si slovo ještě jednou 🔊 a poslouchej začátek. Jednu možnost už jsi ${g('vyřadila', 'vyřadil')}.` : `Zkus to ještě jednou. Jednu možnost už jsi ${g('vyřadila', 'vyřadil')}.`)));
  else { $$('.opt').forEach(x => { x.disabled = true; if (x.dataset.v === E.a) x.classList.add('right'); }); bad(true); }
}
function wirePairs() {
  const E = cur, map = Object.fromEntries(E.pairs); let sel = null, left = E.pairs.length, miss = 0;
  // Anglicky je levý sloupec; když jsou vlevo jen obrázky (emoji), pak pravý.
  const enSide = E.pairs.some(p => /[a-z]/i.test(p[0])) ? 'l' : 'r';
  $$('.pairs .opt').forEach(b => b.onclick = () => {
    if (b.classList.contains('done')) return;
    if (b.dataset.side === enSide) speak(b.dataset.v);
    if (!sel || sel.dataset.side === b.dataset.side) { if (sel) sel.classList.remove('sel'); sel = b; b.classList.add('sel'); return; }
    const l = sel.dataset.side === 'l' ? sel : b, r = sel.dataset.side === 'l' ? b : sel;
    if (map[l.dataset.v] === r.dataset.v) {
      [l, r].forEach(x => { x.classList.remove('sel'); x.classList.add('done'); x.disabled = true; }); left--; sel = null; if (left) sfx.tap(); else sfx.ok();
      if (!left) { answered = true; fb(true, `<h3>${rand(OK)}</h3><p>${miss ? `Všechny dvojice spojené. ${miss}× jsi ${g('zkusila', 'zkusil')} jinou dvojici a pak ${g('našla', 'našel')} správnou.` : 'Všechny dvojice spojené napoprvé.'}</p>`); cont(true); }
    } else { miss++; sfx.soft(); [l, r].forEach(x => { x.classList.remove('sel'); x.classList.add('shake'); setTimeout(() => x.classList.remove('shake'), 400); }); sel = null; }
  });
}
function wireBuild() {
  const E = cur, line = $('#line'); E._pick = [];
  const draw = () => {
    line.innerHTML = E._pick.map((k, p) => `<button class="tile" data-p="${p}">${esc(E._tiles[k])}</button>`).join('');
    $$('.tile', line).forEach(t => t.onclick = () => { if (answered) return; const k = E._pick.splice(+t.dataset.p, 1)[0]; $(`.tiles .tile[data-k="${k}"]`).classList.remove('used'); draw(); });
  };
  $$('.tiles .tile').forEach(t => t.onclick = () => { if (answered || t.classList.contains('used')) return; t.classList.add('used'); E._pick.push(+t.dataset.k); draw(); });
  $('#check').onclick = () => {
    if (answered) return;
    if (!E._pick.length) { fb(false, '<p>Klepej na slova dole a skládej z nich větu.</p>'); return; }
    const used = E._pick.map(k => E._tiles[k]);
    if (norm(used.join(' ')) === norm(E.a)) return good();
    const extraUsed = (E.extra || []).filter(x => used.includes(x));
    if (tries === 0) bad(false, extraUsed.length ? 'Některé slovo sem nepatří. Dvě slova dole jsou navíc.' : 'Slova máš dobře vybraná, jen zkus změnit pořadí. V angličtině jde nejdřív kdo, pak co dělá.');
    else bad(true);
  };
}
function checkType() {
  if (answered) return;
  const E = cur, v = norm($('#inp').value);
  if (!v) { fb(false, '<p>Napiš odpověď do políčka.</p>'); return; }
  if (E.a.some(a => norm(a) === v)) { $('#inp').disabled = true; return good(); }
  let msg = 'Zkus to ještě jednou.';
  if (/ing\b/.test(v) && !/^(was|were|wasn't|weren't)\b/.test(v)) msg = 'Před tvar s -ing patří ještě was nebo were.';
  else if (/^(was|were)\b/.test(v) && !/ing\b/.test(v)) msg = 'Po was/were potřebuješ sloveso s koncovkou -ing.';
  else if (E.why) msg = esc(E.why);
  if (tries === 0) bad(false, msg); else { $('#inp').disabled = true; bad(true); }
}
function checkDict() {
  if (answered) return;
  const E = cur, v = norm($('#inp').value);
  if (!v) { fb(false, `<p>${E._copy ? 'Napiš větu do políčka.' : 'Napiš, co slyšíš. Klidně si to pusť znovu.'}</p>`); return; }
  if (v === norm(E.a)) { $('#inp').disabled = true; return good(); }
  const T = norm(E.a).split(' '), U = v.split(' ');
  const wrong = T.map((w, k) => U[k] === w ? -1 : k).filter(k => k >= 0);
  if (tries === 0) {
    const n = wrong.length ? wrong[0] + 1 : T.length;
    bad(false, `Správně máš ${T.length - wrong.length} z ${T.length} slov. ${E._copy ? 'Porovnej to ještě jednou s větou nahoře' : 'Pusť si větu znovu, klidně pomalu 🐢, a zaměř se hlavně'} na ${n}. slovo.`);
    return;
  }
  $('#inp').disabled = true;
  const diffs = wrong.slice(0, 3).map(k => U[k] ? `„${esc(U[k])}“ → „${esc(T[k])}“` : `chybí „${esc(T[k])}“`).join(', ');
  bad(true, diffs ? `Rozdíl: ${diffs}` : '');
}

function finish() {
  setProgress(100);
  const mode = run.mode, it = run.it;
  let title, text, head;
  if (mode === 'review') {
    title = 'Opakování hotové'; head = `<div class="kapka-big">${kapka('cheer', 110)}</div>`;
    text = run.fixed ? `${g('Opravila', 'Opravil')} jsi ${run.fixed} ${run.fixed === 1 ? 'věc, která ti předtím nešla' : run.fixed < 5 ? 'věci, které ti předtím nešly' : 'věcí, které ti předtím nešly'}. Přesně takhle se mozek učí: chyba ukáže, kam přidat.` : `${g('Prošla', 'Prošel')} jsi všechno, co ti nešlo. Co zůstalo, zkusíme zase příště.`;
  } else {
    const pr = S.prog[run.key] || (S.prog[run.key] = {});
    delete pr.run; pr.done = true; pr.doneAt = new Date().toISOString(); save();
    const back = run.requeued.length;
    if (mode === 'lesson') { title = P.t.lessonDone; head = `<div class="endart"><div class="fr">${artHtml(it.data)}</div>${kapka('cheer', 84)}</div>`; }
    else { title = `${it.data.title}: hotovo`; head = `<div class="kapka-big">${kapka('cheer', 110)}</div>`; }
    text = back ? `${g('Dokončila', 'Dokončil')} jsi to a ${back}× ses ${g('vrátila', 'vrátil')} k něčemu, co napoprvé nevyšlo. Každý takový návrat je kus učení.` : `${g('Dokončila', 'Dokončil')} jsi celou ${mode === 'lesson' ? 'lekci' : 'sadu'}. ${g('Vydržela', 'Vydržel')} jsi u toho až do konce.`;
  }
  const m = S.mist.length;
  const next = mode === 'lesson' ? ITEMS.find(i => i.kind === 'lesson' && !S.prog[i.key]?.done) : null;
  app.innerHTML = `<div class="card" style="margin-top:1rem">${head}<h2 style="text-align:center">${esc(title)}</h2><p>${text}</p>
   ${m && mode !== 'review' ? `<p class="cz">Na hlavní stránce máš ${pl(m, 'věc', 'věci', 'věcí')} k procvičení. Zkus je zítra, mozek si to mezitím uleží.</p>` : ''}
   <div class="actions"><button class="btn pink wide" id="hm">Domů</button>${next ? `<button class="btn ghost wide" id="nl">Další lekce: ${esc(next.data.title)}</button>` : ''}</div></div>`;
  $('#hm').onclick = toHome;
  const nl = $('#nl'); if (nl) nl.onclick = () => openItem(next);
  celebrate(true);
  run = null;
}
