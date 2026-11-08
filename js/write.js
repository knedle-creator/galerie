// Psací ateliér: zadání, textové pole s automatickým ukládáním, kontrolní seznam, hotové texty.
import { $, esc, today } from './util.js';
import { S, save } from './store.js';
import { app, route, go } from './ui.js';
import { speak, hasTTS } from './speech.js';
import { item } from './packs.js';
import { celebrate, kapka } from './fx.js';

const words = t => { t = t.trim(); return t ? t.split(/\s+/).length : 0; };

route('write', ({ key }) => {
  const it = item(key); if (!it) return go('home', {}, { replace: true });
  const P = it.data;
  S.last = key;
  const pr = S.prog[key] || (S.prog[key] = {});
  const mine = S.texts.filter(t => t.key === key);
  app.innerHTML = `<div class="card"><h2>${esc(P.e || '✍️')} ${esc(P.title)}</h2>
   <p><b lang="en">${esc(P.task)}</b> ${hasTTS ? '<button class="say" id="sayt" aria-label="Přečíst zadání">🔊</button>' : ''}</p>${P.cz ? `<p class="cz">${esc(P.cz)}</p>` : ''}
   <textarea id="ta" lang="en" placeholder="${esc(P.placeholder || '')}" autocapitalize="sentences" spellcheck="false" aria-label="Tvůj text">${esc(S.drafts[key] || '')}</textarea>
   <p class="cz" id="wc" aria-live="polite"></p>
   <details><summary><b>Než to uložíš</b></summary><ul class="check">
    <li><label><input type="checkbox"> Začíná každá věta velkým písmenem a končí tečkou?</label></li>
    <li><label><input type="checkbox"> Použila jsi aspoň dvě slova z lekce?</label></li>
    <li><label><input type="checkbox"> Má každá věta sloveso?</label></li>
    <li><label><input type="checkbox"> Přečetla sis text ještě jednou nahlas?</label></li></ul></details>
   <div class="actions"><button class="btn pink wide" id="fin">✅ Hotovo, uložit</button></div>
   <div id="wfb" aria-live="polite"></div></div>
   ${mine.length ? `<div class="card"><h3>Tvoje texty k tomuhle tématu</h3>${mine.slice().reverse().map(t => `<div class="saved"><small>${esc(t.date)}</small><p lang="en">${esc(t.text).replace(/\n/g, '<br>')}</p></div>`).join('')}</div>` : ''}`;
  const ta = $('#ta'), wc = $('#wc');
  const cnt = () => { wc.textContent = `Počet slov: ${words(ta.value)} · koncept se ukládá sám`; };
  cnt();
  ta.oninput = () => { S.drafts[key] = ta.value; if (!pr.done && ta.value.trim()) pr.run = { draft: true }; save(); cnt(); };
  const st = $('#sayt'); if (st) st.onclick = () => speak(P.task, { force: true });
  $('#fin').onclick = () => {
    const t = ta.value.trim();
    if (words(t) < 3) { $('#wfb').innerHTML = '<div class="fb try"><p>Zkus napsat aspoň dvě nebo tři věty, pak to ulož.</p></div>'; return; }
    S.texts.push({ key, id: P.id, title: P.title, text: t, date: today() });
    S.drafts[key] = ''; delete pr.run; pr.done = true; pr.doneAt = new Date().toISOString(); save();
    celebrate(true);
    app.innerHTML = `<div class="card" style="margin-top:1rem"><div class="kapka-big">${kapka('cheer', 110)}</div><h2 style="text-align:center">Text je uložený</h2>
     <p>Napsala jsi vlastní text v angličtině. To je úplně jiná úroveň než doplňovat slova: vymýšlíš, skládáš věty a rozhoduješ sama.</p>
     <div class="actions"><button class="btn pink wide" id="wl">Zpět</button></div></div>`;
    $('#wl').onclick = () => history.back();
  };
});
