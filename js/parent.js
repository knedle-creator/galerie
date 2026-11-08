// Pro rodiče: skryté za podržením nadpisu 3 s + PIN. PIN je jen dětská pojistka, ne zabezpečení.
import { $, $$, esc, pl } from './util.js';
import { S, save, exportBackup, importBackup, resetAll, getUserPacks, setUserPacks } from './store.js';
import { app, route, go, toHome, toast, modal } from './ui.js';
import { PACKS, ITEMS, KINDS, LOAD_ERRORS, validatePack, loadAll, status } from './packs.js';
import { hasTTS, voiceCount, micOK, englishVoices, voiceGender, speak, clearCast } from './speech.js';

const SAMPLE = { f: 'Hi, I’m Mia. The mural is huge and very colourful.', m: 'Hi, I’m Leo. I was paddling on the river.' };
const voiceList = g => englishVoices().filter(v => voiceGender(v) !== (g === 'f' ? 'm' : 'f')).slice(0, 8);
function voiceGroup(g) {
  const vs = voiceList(g), key = g === 'f' ? 'voiceF' : 'voiceM';
  if (!vs.length) return '';
  const cur = S[key] && vs.some(v => v.name === S[key]) ? S[key] : null;
  return `<h3 style="margin-top:1.2rem">${g === 'f' ? '👧 Ženský hlas' : '👦 Mužský hlas'}</h3>
    <p class="cz" style="margin:.2rem 0 .5rem">${g === 'f' ? 'Mluví ve cvičeních a za Miu a další dívky a ženy.' : 'Mluví za Lea, průvodce, úředníka a další muže.'} Když v rozhovoru mluví dvě ženy (nebo dva muži), druhá postava dostane jiný hlas automaticky.</p>
    <div class="items">
     <label class="item" style="cursor:pointer"><input type="radio" name="${key}" value="" ${cur ? '' : 'checked'} style="width:1.3rem;height:1.3rem;flex:none">
      <span class="tx"><b>Vybrat automaticky</b><small>nejlepší dostupný (bez internetu sám přepne)</small></span></label>
     ${vs.map(v => `<label class="item" style="cursor:pointer">
      <input type="radio" name="${key}" value="${esc(v.name)}" ${v.name === cur ? 'checked' : ''} style="width:1.3rem;height:1.3rem;flex:none">
      <span class="tx"><b>${esc(v.name)}</b><small>${esc(v.lang)}${v.localService ? '' : ' · přes internet'}</small></span>
      <button class="say" type="button" data-try="${esc(v.name)}" data-g="${g}" aria-label="Přehrát ukázku">▶</button></label>`).join('')}</div>`;
}
function voicePicker() {
  if (!englishVoices().length) return '<p class="cz">Telefon zatím nenabízí žádný anglický hlas.</p>';
  return `${voiceGroup('f')}${voiceGroup('m')}
    <p class="cz">Hlasy „přes internet“ (např. Google) znějí nejpřirozeněji, ale potřebují připojení a čtený anglický text posílají Googlu. Bez internetu appka sama použije hlas uložený v telefonu.</p>`;
}

const hash = s => { let h = 5381; for (const c of 'klaudie:' + s) h = ((h << 5) + h + c.charCodeAt(0)) | 0; return String(h >>> 0); };
let unlocked = false;

route('parent', () => unlocked ? panel() : lock());

function lock() {
  const first = !S.pin;
  app.innerHTML = `<div class="card" style="margin-top:1rem"><h2>🔒 Pro rodiče</h2>
   <p>${first ? 'Vytvořte si PIN (4 číslice). Budete ho zadávat při každém vstupu sem.' : 'Zadejte PIN.'}</p>
   <div class="pin"><input class="inp" id="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="off" aria-label="PIN"></div>
   ${first ? '<div class="pin"><input class="inp" id="pin2" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="off" aria-label="PIN znovu" placeholder="znovu"></div>' : ''}
   <p class="err" id="perr" aria-live="polite"></p>
   <div class="actions"><button class="btn wide" id="pok">${first ? 'Uložit PIN' : 'Vstoupit'}</button></div>
   ${first ? '' : '<p class="cz">Zapomenutý PIN: v Chromu smažte data této stránky. Smaže se tím ale i postup, proto si pravidelně dělejte zálohu.</p>'}</div>`;
  const ok = () => {
    const p = $('#pin').value.trim();
    if (!/^\d{4,8}$/.test(p)) { $('#perr').textContent = 'PIN musí mít 4 až 8 číslic.'; return; }
    if (first) {
      if (p !== $('#pin2').value.trim()) { $('#perr').textContent = 'PINy se neshodují.'; return; }
      S.pin = hash(p); save();
    } else if (hash(p) !== S.pin) { $('#perr').textContent = 'Tohle není správný PIN.'; $('#pin').value = ''; return; }
    unlocked = true; panel();
  };
  $('#pok').onclick = ok;
  $$('.pin input').forEach(i => i.onkeydown = e => { if (e.key === 'Enter') ok(); });
  setTimeout(() => $('#pin').focus(), 50);
}

const fmt = iso => iso ? new Date(iso).toLocaleDateString('cs-CZ') : '';

function panel() {
  const rows = PACKS.map(p => {
    const its = ITEMS.filter(i => i.pack === p && i.kind !== 'mission');
    const done = its.filter(i => status(i) === 'done').length;
    return `<div class="stat"><span>${esc(p.title)}<br><small class="cz">${esc(p.courseTitle || p.course)}${getUserPacks()[p.id] ? ' · nahraný' : ''}</small></span><span>${done} / ${its.length}</span></div>`;
  }).join('');
  const recent = ITEMS.filter(i => S.prog[i.key]?.doneAt).sort((a, b) => S.prog[b.key].doneAt.localeCompare(S.prog[a.key].doneAt)).slice(0, 10);
  const mis = ITEMS.filter(i => i.kind === 'mission' && S.missions[i.key]);
  const up = getUserPacks();
  app.innerHTML = `<header class="hero"><h1>Pro rodiče</h1><p>Tady nic nevidí Klaudie, pokud nezná PIN.</p></header>
   <div class="card"><h2>Postup</h2>${rows || '<p>Žádné balíčky.</p>'}
    <div class="stat"><span>Úlohy „co mi ještě nejde“</span><span>${S.mist.length}</span></div>
    <div class="stat"><span>Můj slovníček</span><span>${pl(S.vocab.length, 'slovo', 'slova', 'slov')} (${S.vocab.filter(v => v.box >= 4).length} umí)</span></div>
    <div class="stat"><span>Hotové texty</span><span>${S.texts.length}</span></div>
    ${recent.length ? `<h3 style="margin-top:1rem">Naposledy dokončené</h3>${recent.map(i => `<div class="stat"><span>${esc(KINDS[i.kind].e)} ${esc(i.data.title)}</span><span>${fmt(S.prog[i.key].doneAt)}</span></div>`).join('')}` : ''}</div>

   <div class="card"><h2>Hotové texty</h2>${S.texts.length ? S.texts.slice().reverse().map(t => `<div class="saved"><small>${esc(t.date)}, ${esc(t.title)}</small><p lang="en">${esc(t.text).replace(/\n/g, '<br>')}</p></div>`).join('') : '<p class="cz">Zatím žádné.</p>'}</div>

   <div class="card"><h2>Mise</h2>${mis.length ? mis.map(i => { const m = S.missions[i.key]; return `<div class="saved"><small>${m.done ? '✅ splněno' : '⏳ rozpracováno'}${m.photo ? ' · 📷 fotka' : ''}</small><p><b>${esc(i.data.cz)}</b>${m.note ? `<br>${esc(m.note)}` : ''}</p></div>`; }).join('') : '<p class="cz">Zatím žádné.</p>'}</div>

   <div class="card"><h2>Nahrát balíček</h2>
    <p>Sem můžete nahrát nový balíček <code>.json</code> přímo do telefonu. Balíček se zkontroluje a při chybě uvidíte, co je špatně.</p>
    <span class="btn filebtn">📦 Vybrat soubor .json<input type="file" accept=".json,application/json" id="pf" aria-label="Vybrat balíček"></span>
    <div id="pres" aria-live="polite"></div>
    ${Object.keys(up).length ? `<h3 style="margin-top:1rem">Nahrané balíčky</h3>${Object.values(up).map(p => `<div class="stat"><span>${esc(p.title)} <small class="cz">(${esc(p.id)})</small></span><span><button class="btn ghost small" data-rm="${esc(p.id)}">Odebrat</button></span></div>`).join('')}` : ''}
    ${LOAD_ERRORS.length ? `<div class="fb try"><h3>Některé balíčky se nenačetly</h3>${LOAD_ERRORS.map(e => `<p><b>${esc(e.file)}</b>: ${e.errors.map(esc).join(' ')}</p>`).join('')}</div>` : ''}</div>

   <div class="card"><h2>Záloha</h2>
    <p>Záloha obsahuje celý postup, slovníček, texty, mise i fotky. Hodí se při výměně telefonu nebo před smazáním dat v Chromu.</p>
    <div class="actions"><button class="btn" id="exp">⬇️ Stáhnout zálohu</button>
    <span class="btn ghost filebtn">⬆️ Obnovit ze zálohy<input type="file" accept=".json,application/json" id="imp" aria-label="Vybrat zálohu"></span></div>
    <div id="bres" aria-live="polite"></div></div>

   <div class="card"><h2>Řeč a soukromí</h2>
    <div class="stat"><span>Hlas telefonu (předčítání)</span><span>${hasTTS ? `funguje${voiceCount() ? ` (${voiceCount()} angl. hlasů)` : ', ale zatím bez anglického hlasu'}` : 'nedostupné'}</span></div>
    <div class="stat"><span>Rozpoznávání řeči</span><span>${micOK ? 'dostupné' : 'nedostupné (cvičení jdou dokončit i bez něj)'}</span></div>
    <label class="toggle" style="margin-top:.6rem"><input type="checkbox" id="snd" ${S.sound ? 'checked' : ''}> Automaticky předčítat správné odpovědi</label>
    <label class="toggle"><input type="checkbox" id="sfx" ${S.sfx !== false ? 'checked' : ''}> Zvukové efekty, potlesk a maskot Kapka</label>
    ${hasTTS ? voicePicker() : ''}
    <p class="cz">Rozpoznávání řeči v Chromu posílá zvuk z mikrofonu ke zpracování na servery Googlu. Appka sama nic nikam neposílá, nemá analytiku ani reklamy a všechna data zůstávají v telefonu. Když nechcete, aby se mikrofon používal, zakažte ho této stránce v nastavení Chromu. Klaudie pak bude mluvit „nanečisto“ a porovnávat se se vzorem.</p>
    <p class="cz">Když chybí anglický hlas: Nastavení Androidu → Usnadnění → Převod textu na řeč → nainstalovat angličtinu (Velká Británie).</p></div>

   <div class="card"><h2>Ostatní</h2>
    <div class="actions"><button class="btn ghost" id="cpin">Změnit PIN</button><button class="btn ghost" id="rst">Smazat všechna data…</button></div></div>
   <div class="actions"><button class="btn wide" id="out">Zamknout a odejít</button></div>`;

  $('#snd').onchange = e => { S.sound = e.target.checked; save(); };
  $$('[data-try]').forEach(b => b.onclick = e => {
    e.preventDefault();
    speak(SAMPLE[b.dataset.g], { force: true, voice: englishVoices().find(x => x.name === b.dataset.try) });
  });
  $$('input[name=voiceF],input[name=voiceM]').forEach(r => r.onchange = () => {
    S[r.name] = r.value || null; save(); clearCast(); toast('Hlas je vybraný.');
    const g = r.name === 'voiceF' ? 'f' : 'm';
    speak(SAMPLE[g], { force: true, who: g === 'f' ? 'Mia' : 'Leo' });
  });
  const fx = $('#sfx'); if (fx) fx.onchange = e => { S.sfx = e.target.checked; save(); };
  $('#out').onclick = () => { unlocked = false; toHome(); };
  $('#cpin').onclick = () => { S.pin = null; save(); unlocked = false; lock(); };
  $$('[data-rm]').forEach(b => b.onclick = async () => {
    const o = getUserPacks(); delete o[b.dataset.rm]; setUserPacks(o); await loadAll(); toast('Balíček odebrán.'); panel();
  });
  $('#pf').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    const out = $('#pres');
    let p;
    try { p = JSON.parse(await f.text()); } catch (err) { out.innerHTML = `<div class="fb try"><p>Soubor „${esc(f.name)}“ není platný JSON. Většinou chybí čárka nebo uvozovka. Otevřete ho v editoru, nebo si nechte poslat nový.</p></div>`; return; }
    const errs = validatePack(p);
    if (errs.length) { out.innerHTML = `<div class="fb try"><h3>Balíček nejde nahrát</h3><ul>${errs.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`; return; }
    const o = getUserPacks(); o[p.id] = p;
    try { setUserPacks(o); } catch (err) { out.innerHTML = '<div class="fb try"><p>V telefonu už není místo na další balíček.</p></div>'; return; }
    await loadAll();
    toast(`Balíček „${p.title}“ je nahraný.`); panel();
  };
  $('#exp').onclick = async () => {
    try {
      const blob = new Blob([await exportBackup()], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `klaudie-zaloha-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (err) { $('#bres').innerHTML = '<div class="fb try"><p>Zálohu se nepodařilo vytvořit.</p></div>'; }
  };
  $('#imp').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    const c = modal(`<h2>Obnovit ze zálohy?</h2><p>Současný postup v tomhle telefonu se nahradí obsahem souboru „${esc(f.name)}“.</p>
      <div class="actions"><button class="btn" id="yes">Obnovit</button><button class="btn ghost" data-close>Zrušit</button></div>`);
    $('#yes', c).onclick = async () => {
      document.getElementById('ov').innerHTML = '';
      try { await importBackup(await f.text()); await loadAll(); unlocked = true; toast('Záloha je obnovená.'); panel(); }
      catch (err) { $('#bres').innerHTML = `<div class="fb try"><p>${esc(err.message)}</p></div>`; }
    };
  };
  $('#rst').onclick = () => {
    const c = modal(`<h2>Smazat všechna data?</h2><p>Smaže se celý postup, slovníček, texty, mise, fotky, nahrané balíčky i PIN. <b>Nejde to vrátit.</b> Pokud si nejste jistí, stáhněte nejdřív zálohu.</p>
      <div class="actions"><button class="btn pink" id="yes">Ano, smazat</button><button class="btn ghost" data-close>Zrušit</button></div>`);
    $('#yes', c).onclick = async () => { document.getElementById('ov').innerHTML = ''; await resetAll(); await loadAll(); unlocked = false; toast('Data jsou smazaná.'); toHome(); };
  };
}
