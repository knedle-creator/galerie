// Domů, kurz, balíček, Studio a seznamy položek.
import { esc, $, $$ } from './util.js';
import { S } from './store.js';
import { app, route, go } from './ui.js';
import { PACKS, ITEMS, BY_ID, KINDS, courses, status, STATUS_LABEL, artOf, item } from './packs.js';

const COURSE_ICON = { harmonize2: '🎨', nz: '🥝' };
const ROUTE_OF = { lesson: 'lesson', practice: 'play', dialog: 'dialog', reading: 'reading', writing: 'write', mission: 'missions' };

// Otevře položku. resume=true skočí rovnou do rozdělané lekce.
export function openItem(it, resume = false) {
  if (!it) return;
  if (it.kind === 'lesson' && resume && S.prog[it.key]?.run) return go('play', { key: it.key });
  if (it.kind === 'mission') return go('missions', { pack: it.pack.id });
  go(ROUTE_OF[it.kind], { key: it.key });
}

function nextUp() {
  const doing = ITEMS.filter(i => i.kind !== 'mission' && S.prog[i.key]?.run);
  const last = doing.find(i => i.key === S.last) || doing[0];
  if (last) return { it: last, label: 'Pokračovat', resume: true };
  const fresh = ITEMS.find(i => i.kind === 'lesson' && !S.prog[i.key]?.done);
  if (fresh) return { it: fresh, label: 'Dnešní lekce', resume: false };
  return null;
}

export function itemRow(it, showPack = false) {
  const d = it.data, st = status(it);
  const title = it.kind === 'mission' ? d.cz : d.title;
  const sub = [it.kind === 'mission' ? d.where : d.cz, showPack ? it.pack.title : ''].filter(Boolean).join(' · ');
  return `<button class="item" data-key="${esc(it.key)}"><span class="e">${esc(d.e || KINDS[it.kind].e)}</span>
    <span class="tx"><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span>
    <span class="chip ${st}">${STATUS_LABEL[st]}</span></button>`;
}
export function wireRows(root = app) {
  $$('.item[data-key]', root).forEach(b => b.onclick = () => openItem(item(b.dataset.key), true));
}

route('home', () => {
  const nx = nextUp(), m = S.mist.length;
  const cs = courses();
  app.innerHTML = `
   <header class="hero" id="logo"><h1>Klaudiina galerie</h1><p>Angličtina po malých krocích. Jedna lekce trvá asi 5–8 minut.</p></header>
   ${nx ? `<button class="big-go" id="go"><b>${nx.label} →</b><span>${esc(nx.it.data.title)}${nx.it.data.cz ? ' · ' + esc(nx.it.data.cz) : ''}</span></button>`
        : (PACKS.length ? `<button class="big-go" id="go"><b>Galerie je plná 🖼️</b><span>Všechny lekce máš hotové. Můžeš si kteroukoli zopakovat.</span></button>`
                        : `<div class="card"><p>Zatím tu nejsou žádné lekce. Požádej rodiče, ať nahrají balíček.</p></div>`)}
   ${cs.length ? `<h2 class="sec">Kurzy</h2><div class="courses">${cs.map(c => {
      const ls = ITEMS.filter(i => i.kind === 'lesson' && i.pack.course === c.id);
      const done = ls.filter(i => S.prog[i.key]?.done).length;
      return `<button class="ccard" data-c="${esc(c.id)}"><span class="e">${COURSE_ICON[c.id] || '📚'}</span><span><b>${esc(c.title)}</b><small>${done} z ${ls.length} obrazů v galerii</small></span></button>`;
    }).join('')}</div>` : ''}
   <div class="tools">
    ${m ? `<button class="btn ghost wide" id="rev">💪 Procvičit, co mi ještě nejde (${m})</button>` : ''}
    <button class="btn ghost wide" id="voc">📚 Slovníček</button>
    <button class="btn ghost wide" id="stu">🎧 Studio: rozhovory, čtení, psaní, mise</button>
   </div>
   <p class="foot">Všechno se ukládá jen v tomhle telefonu.</p>`;
  const g = $('#go');
  if (g) g.onclick = () => nx ? openItem(nx.it, nx.resume) : go('course', { id: cs[0].id });
  $$('.ccard').forEach(b => b.onclick = () => go('course', { id: b.dataset.c }));
  const r = $('#rev'); if (r) r.onclick = () => go('play', { mode: 'review' });
  $('#voc').onclick = () => go('vocab');
  $('#stu').onclick = () => go('studio');
  // Rodičovská sekce: podržet nadpis 3 sekundy.
  const logo = $('#logo'); let t = null;
  const stop = () => { clearTimeout(t); t = null; logo.classList.remove('holding'); };
  logo.addEventListener('pointerdown', () => { stop(); logo.classList.add('holding'); t = setTimeout(() => { stop(); go('parent'); }, 3000); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => logo.addEventListener(ev, stop));
  logo.addEventListener('contextmenu', e => e.preventDefault());
});

route('course', ({ id }) => {
  const c = courses().find(x => x.id === id);
  if (!c) return go('home', {}, { replace: true });
  const ls = ITEMS.filter(i => i.kind === 'lesson' && i.pack.course === id);
  const next = ls.find(i => !S.prog[i.key]?.done);
  app.innerHTML = `<header class="hero"><h1>${COURSE_ICON[id] || '📚'} ${esc(c.title)}</h1><p>Hotová lekce = obraz v rámu. Všechno jde kdykoli otevřít znovu.</p></header>
   <div class="wall">${ls.map(i => {
     const st = status(i), done = S.prog[i.key]?.done;
     return `<button class="piece ${next && next.key === i.key ? 'next' : ''}" data-key="${esc(i.key)}">
      <div class="fr">${done ? `<div class="art ${artOf(i.data)}"></div>` : '<div class="empty">?</div>'}</div>
      <div class="cap"><h3>${esc(i.data.title)}</h3><small>${esc(i.data.cz || '')}</small>
      ${st === 'doing' ? '<span class="tag half">Rozdělané</span>' : (next && next.key === i.key ? '<span class="tag">Na řadě</span>' : '')}</div></button>`;
   }).join('')}</div>
   <h2 class="sec">Celé balíčky</h2>
   <div class="items">${c.packs.map(p => `<button class="item" data-p="${esc(p.id)}"><span class="e">📦</span><span class="tx"><b>${esc(p.title)}</b><small>${esc(p.cz || '')}</small></span></button>`).join('')}</div>`;
  $$('.piece').forEach(b => b.onclick = () => go('lesson', { key: b.dataset.key }));
  $$('[data-p]').forEach(b => b.onclick = () => go('pack', { id: b.dataset.p }));
});

route('pack', ({ id }) => {
  const p = BY_ID[id];
  if (!p) return go('home', {}, { replace: true });
  const its = ITEMS.filter(i => i.pack === p);
  app.innerHTML = `<header class="hero"><h1>${esc(p.title)}</h1><p>${esc(p.cz || '')}</p></header>
   ${Object.entries(KINDS).map(([k, m]) => {
     const list = its.filter(i => i.kind === k);
     return list.length ? `<h2 class="sec">${m.e} ${m.label}</h2><div class="items">${list.map(i => itemRow(i)).join('')}</div>` : '';
   }).join('')}`;
  wireRows();
});

route('studio', () => {
  const n = k => ITEMS.filter(i => i.kind === k).length;
  const tiles = [
    ['dialog', '🎧', 'Rozhovory', 'Poslouchej, odpovídej a zahraj si roli'],
    ['reading', '📰', 'Čtení', 'Klepni na slovo a uvidíš překlad'],
    ['writing', '✍️', 'Psací ateliér', 'Napiš vlastní text'],
    ['mission', '🧭', 'Mise', 'Úkoly do skutečného světa'],
    ['practice', '🗣️', 'Výslovnost a diktát', 'Mluv a piš, co slyšíš']
  ].filter(t => n(t[0]));
  app.innerHTML = `<header class="hero"><h1>Studio</h1><p>Vyber si, na co máš zrovna chuť.</p></header>
   <div class="studio">${tiles.map(([k, e, b, s]) => `<button class="st" data-k="${k}"><span class="e">${e}</span><b>${b}</b><small>${s}</small></button>`).join('')}</div>`;
  $$('.st').forEach(b => b.onclick = () => b.dataset.k === 'mission' ? go('missions', {}) : go('list', { kind: b.dataset.k }));
});

route('list', ({ kind }) => {
  const m = KINDS[kind]; if (!m) return go('home', {}, { replace: true });
  const its = ITEMS.filter(i => i.kind === kind);
  const intro = {
    dialog: 'Každý rozhovor má čtyři kroky: poslech, otázky, text a nakonec si zahraješ jednu roli.',
    reading: 'Přečti si krátký text. Na každé slovo můžeš klepnout a uvidíš, co znamená.',
    writing: 'Vyber si téma a napiš pár vět anglicky. Nemusí to být dokonalé, o to právě jde.',
    practice: 'Krátké sady na mluvení a poslech.'
  }[kind] || '';
  app.innerHTML = `<header class="hero"><h1>${m.e} ${m.label}</h1><p>${intro}</p></header>
   <div class="items">${its.map(i => itemRow(i, true)).join('')}</div>
   ${kind === 'writing' && S.texts.length ? `<h2 class="sec">Moje hotové texty</h2><div class="card">${S.texts.slice().reverse().map(t => `<div class="saved"><small>${esc(t.date)}, ${esc(t.title)}</small><p>${esc(t.text).replace(/\n/g, '<br>')}</p></div>`).join('')}</div>` : ''}`;
  wireRows();
});
