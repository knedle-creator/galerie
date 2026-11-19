// Profil dítěte: jméno, rod oslovení a vzhled.
// Základ je profile.json vedle index.html (Klaudie, nebo Robin): stejný kód, jiný profil a balíčky.
// Další děti (bratranci) mají profil v profiles/<id>.json a seznam v profiles/index.json.
// Zařízení se jednou otevře s odkazem ?kdo=<id> (např. ?kdo=teo) a od té doby si pamatuje, komu patří.
// Výchozí hodnoty = Klaudie (kdyby profile.json chyběl).
export const P = {
  id: 'klaudie',              // klíč pro ukládání v telefonu (nikdy neměnit, jinak se ztratí postup)
  name: 'Klaudie',
  title: 'Klaudiina galerie',
  titleGen: 'Klaudiiny galerie', // 2. pád: „záloha Klaudiiny galerie“
  gender: 'f',                // 'f' = oslovujeme v ženském rodě, 'm' = v mužském
  theme: 'galerie',           // vzhled: 'galerie' (obrazy v rámu) nebo 'vyprava' (odznaky)
  courses: { harmonize2: '🎨', nz: '🥝' },
  courseOrder: ['harmonize2', 'nz'],
  lessonIcon: '🎨',
  t: {
    tagline: 'Angličtina po malých krocích. Jedna lekce trvá asi 5–8 minut.',
    allDone: 'Galerie je plná 🖼️',
    courseCount: 'obrazů v galerii',     // „3 z 5 obrazů v galerii“
    courseHint: 'Hotová lekce = obraz v rámu. Všechno jde kdykoli otevřít znovu.',
    lessonDone: 'Obraz visí v galerii!',
    listenSkill: 'Přesně tahle dovednost se hodí v testu i na závodech v cizině.'
  }
};

// Rod: g('zvládla', 'zvládl') vrátí tvar podle profilu.
export const g = (f, m) => (P.gender === 'm' ? m : f);

// Všechny profily téhle appky [{id, name}]: základní dítě a pak ty z profiles/index.json.
export const PROFILES = [];

// Profil dalšího dítěte přepíše jen to, co uvádí. Texty (t), ikony kurzů a popisy předmětů se slučují.
function apply(o) {
  const t = Object.assign({}, P.t, o.t || {});
  const courses = Object.assign({}, P.courses, o.courses || {});
  const subjectCz = Object.assign({}, P.subjectCz, o.subjectCz || {});
  Object.assign(P, o, { t, courses, subjectCz });
}
const ls = {
  get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* plno: nevadí */ } },
  del: k => { try { localStorage.removeItem(k); } catch (e) { /* nic */ } }
};
// Galerie i výprava běží na stejném webu, proto mají klíč podle základního dítěte.
const kdoKey = () => `${P.base}-kdo`;
const copyKey = id => `${P.base}-profil-${id}`;
const getJSON = async url => { try { const r = await fetch(url); return r.ok ? await r.json() : null; } catch (e) { return null; } };
const validId = id => /^[a-z0-9_-]{1,30}$/.test(id);

// Přepne, komu appka v tomhle zařízení patří (z rodičovské sekce). Data ostatních dětí zůstávají.
export function setProfile(id) {
  if (!id || id === P.base) ls.del(kdoKey()); else ls.set(kdoKey(), id);
  location.reload();
}

export async function loadProfile() {
  const [base, list] = await Promise.all([getJSON('profile.json'), getJSON('profiles/index.json')]);
  if (base) apply(base);
  P.base = P.id; // klaudie / robin: komu appka patří, když nikdo nic nevybral
  PROFILES.length = 0;
  PROFILES.push({ id: P.base, name: P.name });
  for (const x of (list && list.profiles) || []) if (x && validId(x.id) && x.id !== P.base) PROFILES.push({ id: x.id, name: x.name || x.id });

  // ?kdo=teo stačí otevřít jednou. ?kdo=klaudie (nebo prázdné) vrátí appku základnímu dítěti.
  const q = new URLSearchParams(location.search).get('kdo');
  let who = ls.get(kdoKey());
  if (q !== null) {
    const id = q.trim().toLowerCase();
    who = !id || id === P.base ? null : id;
    if (!who) ls.del(kdoKey());
    const u = new URL(location.href); u.searchParams.delete('kdo');
    history.replaceState(history.state, '', u.pathname + u.search + u.hash);
  }
  if (who && who !== P.base && validId(who)) {
    let o = await getJSON(`profiles/${who}.json`);
    if (o && o.id === who) ls.set(copyKey(who), JSON.stringify(o));
    else { try { o = JSON.parse(ls.get(copyKey(who)) || 'null'); } catch (e) { o = null; } } // offline: záložní kopie
    if (o && o.id === who) { apply(o); ls.set(kdoKey(), who); }
  }

  window.APP_PROFILE = P; // hry ve složce hry/ běží v okně appky a čtou si odsud jméno a rod
  document.documentElement.dataset.app = P.theme;
  document.title = P.title;
  if (P.bg) document.querySelectorAll('meta[name="theme-color"]').forEach(m => {
    const c = /dark/.test(m.media) ? P.bg.dark : P.bg.light; if (c) m.content = c;
  });
  // Vlastní název a ikona na ploše (např. „Teova výprava“ místo „Klaudiina galerie“).
  const link = (rel, href) => { const l = document.querySelector(`link[rel="${rel}"]`); if (l && href) l.href = href; };
  link('manifest', P.manifest); link('icon', P.favicon); link('apple-touch-icon', P.touchIcon);
}
