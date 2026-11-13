// Profil dítěte: jméno, rod oslovení a vzhled. Načítá se z profile.json vedle index.html.
// Klaudie i Robin mají stejný kód appky, liší se jen profilem a balíčky.
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

export async function loadProfile() {
  try {
    const r = await fetch('profile.json');
    if (r.ok) {
      const o = await r.json();
      Object.assign(P, o, { t: Object.assign({}, P.t, o.t || {}) });
    }
  } catch (e) { /* bez profilu platí výchozí */ }
  document.documentElement.dataset.app = P.theme;
  document.title = P.title;
  if (P.bg) document.querySelectorAll('meta[name="theme-color"]').forEach(m => {
    const c = /dark/.test(m.media) ? P.bg.dark : P.bg.light; if (c) m.content = c;
  });
}
