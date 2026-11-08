// Mise: úkoly do skutečného světa s odškrtnutím, poznámkou a fotkou (zmenšenou, uloženou v IndexedDB).
import { $, $$, esc } from './util.js';
import { S, save, putPhoto, getPhoto, delPhoto } from './store.js';
import { app, route, toast, onLeave, refresh } from './ui.js';
import { ITEMS } from './packs.js';
import { celebrate } from './fx.js';

const urls = [];

// Zmenší fotku na max. 1280 px a uloží ji jako JPEG.
async function shrink(file, max = 1280) {
  let src;
  try { src = await createImageBitmap(file); }
  catch (e) { src = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); }); }
  const w = src.width, h = src.height, k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return new Promise(res => c.toBlob(b => res(b), 'image/jpeg', 0.82));
}

route('missions', ({ pack }) => {
  const its = ITEMS.filter(i => i.kind === 'mission' && (!pack || i.pack.id === pack));
  const packs = [...new Set(its.map(i => i.pack))];
  app.innerHTML = `<header class="hero"><h1>🧭 Mise</h1><p>Úkoly do skutečného světa. Splněnou misi odškrtni, můžeš k ní napsat poznámku nebo přidat fotku.</p></header>
   ${packs.map(p => `<div class="card"><h2>${esc(p.title)}</h2>${its.filter(i => i.pack === p).map(i => {
     const m = S.missions[i.key] || {};
     return `<div class="mission" data-key="${esc(i.key)}">${i.data.where ? `<div class="where">${esc(i.data.where)}</div>` : ''}
       <p style="margin:.2rem 0 .4rem;font-weight:700">${esc(i.data.cz)}</p>
       <label class="toggle"><input type="checkbox" class="mdone" ${m.done ? 'checked' : ''}> Splněno</label>
       <label class="lbl" for="n-${esc(i.data.id)}">Poznámka</label>
       <textarea class="note mnote" id="n-${esc(i.data.id)}" placeholder="Co se stalo? Co sis zapamatovala?">${esc(m.note || '')}</textarea>
       <div class="row"><span class="btn ghost small filebtn">📷 ${m.photo ? 'Vyměnit fotku' : 'Přidat fotku'}<input type="file" accept="image/*" capture="environment" class="mfile" aria-label="Přidat fotku"></span>
       ${m.photo ? '<button class="btn ghost small mdel">Smazat fotku</button>' : ''}</div>
       <div class="mph"></div></div>`;
   }).join('')}</div>`).join('') || '<div class="card"><p>Zatím tu nejsou žádné mise.</p></div>'}`;

  onLeave(() => { while (urls.length) URL.revokeObjectURL(urls.pop()); });
  $$('.mission').forEach(async el => {
    const key = el.dataset.key;
    const m = () => S.missions[key] || (S.missions[key] = {});
    $('.mdone', el).onchange = e => { m().done = e.target.checked; m().doneAt = new Date().toISOString(); save(); if (e.target.checked) { toast('Mise splněná 🧭'); celebrate(false); } };
    $('.mnote', el).oninput = e => { m().note = e.target.value; save(); };
    $('.mfile', el).onchange = async e => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      try {
        const b = await shrink(f); if (!b) throw 0;
        await putPhoto(key, b); m().photo = true; save(); toast('Fotka je uložená.');
        refresh();
      } catch (err) { toast('Telefon fotku neuložil. Zkus to prosím znovu.'); }
    };
    const del = $('.mdel', el);
    if (del) del.onclick = async () => { await delPhoto(key); m().photo = false; save(); refresh(); };
    if (S.missions[key]?.photo) {
      const b = await getPhoto(key);
      if (b) { const u = URL.createObjectURL(b); urls.push(u); $('.mph', el).innerHTML = `<img class="photo" src="${u}" alt="Fotka k misi">`; }
    }
  });
});
