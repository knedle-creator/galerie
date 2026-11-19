// Úvod lekce a přehrávač cvičení (mc, listen, gap, pair, build, type, dict, speak, info, fill, num).
// num umí i desetinné číslo (dec) a periodické číslo (per). Periodu v textu píšeme v [ ]: "0,1[6]".
import { $, $$, esc, escN, norm, shuffle, rand, safeHtml, pl, OK, SPOKE } from './util.js';
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
const optsHtml = o => `<div class="opts">${shuffle(o).map(v => `<button class="opt" data-v="${esc(v)}">${escN(v)}</button>`).join('')}</div>`;

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
    body = `<p class="q">${safeHtml(E.q || 'Spoj dvojice.')}</p><div class="pairs"><div class="col">${shuffle(E.pairs.map(p => p[0])).map(v => `<button class="opt" data-side="l" data-v="${esc(v)}">${escN(v)}</button>`).join('')}</div>
     <div class="col">${shuffle(E.pairs.map(p => p[1])).map(v => `<button class="opt" data-side="r" data-v="${esc(v)}">${escN(v)}</button>`).join('')}</div></div>`; check = false;
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
  else if (E.t === 'info') { body = `<div class="info">${safeHtml(E.html)}</div>`; check = false; }
  else if (E.t === 'fill') {
    body = `<p class="q">${safeHtml(E.q)}</p><div class="fillwrap" id="fill">${fillSvg(E)}</div>
     <p class="cz fcount" id="fcount">Klepnutím dílek vybarvíš, dalším klepnutím ho zase odbarvíš.</p>`;
  } else if (E.t === 'num') { body = `<p class="q">${safeHtml(E.q)}</p>${numForm(E)}`; }

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
  if (E.t === 'info') { answered = true; cont(true, 'Rozumím, dál'); }
  if (E.t === 'fill') wireFill();
  if (E.t === 'num') {
    $$('#numf input').forEach((i, k, all) => {
      i.onkeydown = e => { if (e.key === 'Enter') { const n = all[k + 1]; n ? n.focus() : checkNum(); } };
      i.oninput = () => { i.value = i.value.replace(/\D/g, '').slice(0, i.maxLength > 0 ? i.maxLength : 3); };
    });
    $('#check').onclick = checkNum;
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
  if (E.t === 'fill') return E.show || pl(E.a, 'dílek', 'dílky', 'dílků');
  if (E.t === 'num') return E.show || numText(E.a, E.form);
  return '';
}
function good() {
  answered = true;
  const f = full();
  fb(true, `<h3>${rand(OK)}</h3>${f ? `<p><b>${escN(f)}</b></p>` : ''}${tries > 0 ? `<p>Napodruhé, ale ${g('sama', 'sám')}. Tohle se počítá.</p>` : ''}`);
  sfx.ok();
  if (f && cur.t !== 'dict' && !cur._mute) later(() => speak(f), S.sfx !== false ? 450 : 0); // nejdřív „ding“, pak věta
  if (run.mode === 'review') { S.mist = S.mist.filter(x => x !== cur.id); run.fixed++; save(); }
  else if (tries > 0 && !S.mist.includes(cur.id)) { S.mist.push(cur.id); save(); }
  cont(true);
}
// První chyba = nápověda a druhý pokus. Druhá chyba = ukážeme správnou odpověď.
function bad(final, msg) {
  if (!final) { tries++; sfx.hint(); fb(false, `<h3>Ještě jednou</h3><p>${msg}</p>`); return; }
  answered = true;
  fb(false, `<h3>Tohle si zapamatuj</h3><p>Správně je: <b>${escN(full())}</b></p>${msg ? `<p>${msg}</p>` : ''}${cur.why ? `<p>${escN(cur.why)}</p>` : ''}${run.mode !== 'review' ? '<p class="cz">Tahle úloha se ti ještě jednou vrátí na konci lekce.</p>' : ''}`);
  sfx.reveal();
  const f = full(); if (!cur._mute) later(() => speak(f), 400);
  if (!S.mist.includes(cur.id)) { S.mist.push(cur.id); save(); }
  cont(false);
}
const fb = (ok, html) => { $('#fb').innerHTML = `<div class="fb ${ok ? 'ok' : 'try'}">${withKapka(ok, html)}</div>`; };
// Spustí akci se zpožděním, jen pokud mezitím neodešla na jinou úlohu.
const later = (fn, ms) => { const tk = token(); setTimeout(() => { if (tk === token()) fn(); }, ms); };

function cont(ok, label = 'Pokračovat') {
  const a = $('#acts');
  a.innerHTML = `<button class="btn pink wide" id="nx">${esc(label)}</button>`;
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
  if (tries === 0) bad(false, escN(E.why || (E.t === 'gap' ? `Podívej se ještě jednou na celou větu. Jednu možnost už jsi ${g('vyřadila', 'vyřadil')}.` : E.t === 'listen' ? `Pusť si slovo ještě jednou 🔊 a poslouchej začátek. Jednu možnost už jsi ${g('vyřadila', 'vyřadil')}.` : `Zkus to ještě jednou. Jednu možnost už jsi ${g('vyřadila', 'vyřadil')}.`)));
  else { $$('.opt').forEach(x => { x.disabled = true; if (x.dataset.v === E.a) x.classList.add('right'); }); bad(true); }
}
function wirePairs() {
  const E = cur, map = Object.fromEntries(E.pairs); let sel = null, left = E.pairs.length, miss = 0;
  // Anglicky je levý sloupec; když jsou vlevo jen obrázky (emoji), pak pravý.
  const enSide = E.pairs.some(p => /[a-z]/i.test(p[0])) ? 'l' : 'r';
  $$('.pairs .opt').forEach(b => b.onclick = () => {
    if (b.classList.contains('done')) return;
    if (b.dataset.side === enSide && !E._mute) speak(b.dataset.v);
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
/* ---------- vybarvi dílky (pizza nebo krabice) ---------- */
function fillSvg(E) {
  const parts = E.parts, wholes = E.wholes || 1, out = [];
  for (let w = 0; w < wholes; w++) {
    let shapes = '';
    if (E.shape === 'pizza') {
      const c = 80, r = 72;
      for (let k = 0; k < parts; k++) {
        const a1 = (k / parts) * 2 * Math.PI - Math.PI / 2, a2 = ((k + 1) / parts) * 2 * Math.PI - Math.PI / 2;
        const x1 = c + r * Math.cos(a1), y1 = c + r * Math.sin(a1), x2 = c + r * Math.cos(a2), y2 = c + r * Math.sin(a2);
        shapes += `<path class="part" data-part="${w}-${k}" tabindex="0" role="button" aria-label="Dílek ${k + 1}" d="M${c} ${c}L${x1.toFixed(1)} ${y1.toFixed(1)}A${r} ${r} 0 ${parts === 1 ? 1 : 0} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}Z"/>`;
      }
      out.push(`<svg class="pz" viewBox="0 0 160 160" aria-label="Pizza na ${parts} dílků">${shapes}<circle class="rim" cx="80" cy="80" r="72"/></svg>`);
    } else {
      const cols = parts <= 3 ? parts : Math.ceil(parts / 2), rows = parts <= 3 ? 1 : 2, S = 44, G = 4, P = 6;
      const W = P * 2 + cols * S + (cols - 1) * G, H = P * 2 + rows * S + (rows - 1) * G;
      for (let k = 0; k < parts; k++) {
        const x = P + (k % cols) * (S + G), y = P + Math.floor(k / cols) * (S + G);
        shapes += `<rect class="part" data-part="${w}-${k}" tabindex="0" role="button" aria-label="Místo ${k + 1}" x="${x}" y="${y}" width="${S}" height="${S}" rx="6"/>`;
      }
      out.push(`<svg class="bx" viewBox="0 0 ${W} ${H}" style="width:${W * 1.25}px" aria-label="Krabice na ${parts} dílků"><rect class="rim" x="1" y="1" width="${W - 2}" height="${H - 2}" rx="10"/>${shapes}</svg>`);
    }
  }
  return out.join('');
}
function wireFill() {
  const cnt = $('#fcount');
  const toggle = el => {
    if (answered) return;
    el.classList.toggle('on'); el.setAttribute('aria-pressed', el.classList.contains('on'));
    sfx.tap();
    const n = $$('#fill .part.on').length;
    cnt.textContent = `Vybarveno: ${pl(n, 'dílek', 'dílky', 'dílků')}`;
  };
  $$('#fill .part').forEach(el => {
    el.onclick = () => toggle(el);
    el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(el); } };
  });
  $('#check').onclick = checkFill;
}
function checkFill() {
  if (answered) return;
  const E = cur, n = $$('#fill .part.on').length;
  if (!n && E.a) { fb(false, `<p>Klepni na dílky, které chceš vybarvit.</p>`); return; }
  if (n === E.a) { $('#fill').classList.add('lock'); return good(); }
  const msg = (n < E.a
    ? `Máš ${pl(n, 'dílek', 'dílky', 'dílků')}. Kolik jich má být podle čísla nahoře ve zlomku?`
    : `Máš ${pl(n, 'dílek', 'dílky', 'dílků')}, to je o ${n - E.a} víc. Klepnutím dílek zase odbarvíš.`) + (E.why ? ` ${escN(E.why)}` : '');
  if (tries === 0) { bad(false, msg); return; }
  // Ukázat správně: vybarvit přesně E.a dílků popořadě.
  $$('#fill .part').forEach((el, k) => el.classList.toggle('on', k < E.a));
  $('#fill').classList.add('lock');
  bad(true);
}

/* ---------- napiš číslo nebo zlomek ---------- */
// dec = desetinné číslo [celé, za čárkou], per = periodické číslo [celé, před periodou, perioda] (texty v uvozovkách).
const NUM_IDS = { int: ['n0'], frac: ['n1', 'n2'], mixed: ['n0', 'n1', 'n2'], dec: ['n0', 'n3'], per: ['n0', 'n3', 'n4'] };
const DEC = { dec: 1, per: 1 };
const numIn = (id, label, max = 3) => `<input class="ninp" id="${id}" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="${max}" aria-label="${label}">`;
const nbox = (inp, cap, cls = '') => `<span class="nbox ${cls}">${inp}<small>${cap}</small></span>`;
// Políčko „před vzorem“ se ukáže, když ho odpověď potřebuje, nebo když ho úloha chce vždycky (pre: true).
const perPre = E => E.a[1] !== '' || E.pre === true;
function numForm(E) {
  const lhs = E.lhs ? `<span class="lhs">${safeHtml(E.lhs)}</span><span class="eq">=</span>` : '';
  const frac = `<span class="nfrac">${numIn('n1', 'čitatel (nahoře)')}<i></i>${numIn('n2', 'jmenovatel (dole)')}</span>`;
  const whole = nbox(numIn('n0', 'celá část'), 'celé'), comma = '<span class="ncomma">,</span>';
  let right, note = '';
  if (E.form === 'int') right = numIn('n0', 'číslo');
  else if (E.form === 'frac') right = frac;
  else if (E.form === 'mixed') { right = `${numIn('n0', 'celé číslo')}${frac}`; note = 'Vlevo celé číslo, vpravo zlomek.'; }
  else if (E.form === 'dec') right = `<span class="ndec">${whole}${comma}${nbox(numIn('n3', 'za čárkou', 5), 'za čárkou', 'wide')}</span>`;
  else {
    const pre = perPre(E);
    right = `<span class="ndec">${whole}${comma}${pre ? nbox(numIn('n3', 'před vzorem', 4), 'před vzorem', 'wide') : ''}${nbox(numIn('n4', 'vzor, perioda', 6), 'vzor', 'wide nper')}</span>`;
    note = pre ? 'Do „vzoru“ patří číslice, které se opakují pořád dokola. Když se opakují hned za čárkou, nech „před vzorem“ prázdné.' : 'Do „vzoru“ patří číslice, které se opakují pořád dokola.';
  }
  return `<div class="numf" id="numf">${lhs}${right}</div>${note ? `<p class="cz">${note}</p>` : ''}`;
}
export const numText = (a, form) => form === 'int' ? `${a[0]}` : form === 'frac' ? `${a[0]}/${a[1]}` : form === 'dec' ? `${a[0]},${a[1]}`
  : form === 'per' ? `${a[0]},${a[1]}[${a[2]}]` : `${a[0]} ${a[1]}/${a[2]}`;

// Porovnává hodnotu, ne zápis: 0,3[3] = 0,[3], 0,[0909] = 0,[09], 0,50 = 0,5.
export function canonDec(w, pre = '', rep = '') {
  w = String(w).replace(/^0+(?=\d)/, ''); pre = String(pre); rep = String(rep);
  if (/^0*$/.test(rep)) { rep = ''; pre = pre.replace(/0+$/, ''); return [w, pre, rep]; }
  for (let L = 1; L <= rep.length; L++) if (rep.length % L === 0 && rep.slice(0, L).repeat(rep.length / L) === rep) { rep = rep.slice(0, L); break; }
  while (pre && pre.slice(-1) === rep.slice(-1)) { pre = pre.slice(0, -1); rep = rep.slice(-1) + rep.slice(0, -1); }
  return [w, pre, rep];
}
function decHint(E, v) {
  const [aw, ap, ar] = canonDec(...E.a), [vw, vp, vr] = canonDec(...v);
  if (vw !== aw) return 'Před čárkou to nesedí. Kolikrát se celý jmenovatel vejde do čitatele? Když vůbec, píšeš 0.';
  if (E.form === 'dec') return vp && ap.startsWith(vp)
    ? 'Začátek máš dobře. Dělení ale ještě neskončilo: zbytek není 0, tak k němu připiš nulu a děl dál.'
    : 'Před čárkou to máš dobře. Za čárkou vždycky připiš ke zbytku nulu a děl dál, dokud nevyjde zbytek 0.';
  if (vr === ar) return 'Vzor máš dobře. Podívej se ještě na začátek: opakují se číslice hned za čárkou, nebo je před vzorem něco navíc?';
  if (vp === ap) return 'Začátek sedí. Které číslice se pak opakují pořád dokola? Ty patří do vzoru.';
  return 'Hlídej zbytky: jakmile se zbytek zopakuje, začnou se opakovat i číslice. Klidně si to vyděl na papír.';
}

function checkNum() {
  if (answered) return;
  const E = cur, ids = NUM_IDS[E.form], ins = ids.map(id => $('#' + id));
  const need = ins.filter((i, k) => i && !(E.form === 'per' && ids[k] === 'n3'));
  if (need.some(i => i.value.trim() === '')) {
    fb(false, `<p>${E.form === 'per' ? 'Vyplň celou část a vzor.' : `Vyplň ${ins.length > 1 ? 'všechna políčka' : 'políčko'}.`}</p>`); return;
  }
  const live = ins.filter(Boolean);
  if (DEC[E.form]) {
    const v = ins.map(i => i ? i.value.trim() : '');
    if (E.form === 'dec') v.push('');
    const want = canonDec(...E.a), got = canonDec(...v);
    if (want.every((x, k) => x === got[k])) { live.forEach(i => { i.disabled = true; }); return good(); }
    let msg = decHint(E, v);
    if (E.why) msg = `${msg} ${escN(E.why)}`;
    if (tries === 0) { bad(false, msg); return; }
    live.forEach(i => { i.disabled = true; });
    bad(true);
    return;
  }
  const v = ins.map(i => parseInt(i.value, 10));
  const same = x => x.length === v.length && x.every((k, i) => k === v[i]);
  if (same(E.a) || (E.alt || []).some(same)) { ins.forEach(i => { i.disabled = true; }); return good(); }
  const a = E.a; let msg = '';
  if (E.form === 'frac' && v[0] === a[1] && v[1] === a[0]) msg = 'Čísla jsou prohozená. Nahoru patří, kolik dílků máš, dolů, na kolik dílků je celek rozdělený.';
  else if (E.form === 'mixed') {
    if (v[0] !== a[0]) msg = 'Zkus znovu spočítat plné krabice. To je to celé číslo vlevo.';
    else if (v[2] !== a[2]) msg = 'Celé číslo máš dobře. Dole ve zlomku zůstává, kolik míst má jedna krabice.';
    else msg = 'Celé číslo máš dobře. Teď spočítej dílky, které zbyly v poslední krabici.';
  }
  if (E.why) msg = msg ? `${msg} ${escN(E.why)}` : escN(E.why);
  if (!msg) msg = 'Zkus to ještě jednou. Klidně si to nakresli.';
  if (tries === 0) { bad(false, msg); return; }
  ins.forEach(i => { i.disabled = true; });
  bad(true);
}

function checkType() {
  if (answered) return;
  const E = cur, v = norm($('#inp').value);
  if (!v) { fb(false, '<p>Napiš odpověď do políčka.</p>'); return; }
  if (E.a.some(a => norm(a) === v)) { $('#inp').disabled = true; return good(); }
  let msg = 'Zkus to ještě jednou.';
  // Nápovědy k -ing jen tam, kde se opravdu čeká was/were + -ing (ne u odpovědi „were“ nebo „will be“).
  const cont = E.a.some(x => /^(was|were|wasn't|weren't)\b.*ing\b/.test(norm(x)));
  if (cont && /ing\b/.test(v) && !/^(was|were|wasn't|weren't)\b/.test(v)) msg = 'Před tvar s -ing patří ještě was nebo were.';
  else if (cont && /^(was|were)\b/.test(v) && !/ing\b/.test(v)) msg = 'Po was/were potřebuješ sloveso s koncovkou -ing.';
  else if (E.why) msg = escN(E.why);
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
  const undone = i => i.kind === 'lesson' && !S.prog[i.key]?.done;
  const next = mode === 'lesson' ? (ITEMS.find(i => undone(i) && i.pack.course === it.pack.course) || ITEMS.find(undone)) : null;
  app.innerHTML = `<div class="card" style="margin-top:1rem">${head}<h2 style="text-align:center">${esc(title)}</h2><p>${text}</p>
   ${m && mode !== 'review' ? `<p class="cz">Na hlavní stránce máš ${pl(m, 'věc', 'věci', 'věcí')} k procvičení. Zkus je zítra, mozek si to mezitím uleží.</p>` : ''}
   <div class="actions"><button class="btn pink wide" id="hm">Domů</button>${next ? `<button class="btn ghost wide" id="nl">Další lekce: ${esc(next.data.title)}</button>` : ''}</div></div>`;
  $('#hm').onclick = toHome;
  const nl = $('#nl'); if (nl) nl.onclick = () => openItem(next);
  celebrate(true);
  run = null;
}
