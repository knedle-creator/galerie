// Start appky: načte data, balíčky a ukáže první obrazovku.
import { load } from './store.js';
import { loadProfile } from './profile.js';
import { loadAll } from './packs.js';
import { initChrome, render, modal } from './ui.js';
import { onSpeechTrouble, loadRecordings } from './speech.js';

// Telefon nemluví: vina telefonu, nikdy její. Vysvětlit a nabídnout cestu dál.
onSpeechTrouble(() => modal(`<div class="big">🔇</div><h2 style="text-align:center;margin-top:.5rem">Telefon teď nemluví</h2>
  <p>To není tvoje chyba, telefon zrovna nechce přehrávat řeč.</p>
  <p>Zkus zesílit zvuk tlačítky na boku telefonu a vypnout tichý režim.</p>
  <p class="cz">Když to pořád nepůjde, nevadí: u poslechu klepni na „Nic neslyším“ a úlohu uděláš bez zvuku.</p>
  <div class="actions"><button class="btn wide" data-close>Rozumím</button></div>`));
import './home.js';
import './exercise.js';
import './dialog.js';
import './reading.js';
import './vocab.js';
import './write.js';
import './missions.js';
import './parent.js';

async function start() {
  await loadProfile(); // jméno, rod a vzhled (Klaudie / Robin) musí být známé dřív než data
  load();
  initChrome();
  await loadAll();
  loadRecordings(); // nahrané hlasy se načítají na pozadí, appka mezitím běží
  if (!history.state) history.replaceState({ name: 'home', params: {}, d: 0 }, '');
  render(history.state);
}
start();

// Offline režim. Na localhostu se vypíná, aby se při vývoji vždy načetla nejnovější verze (zapneš ho přes ?sw=1).
const dev = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !/[?&]sw=1/.test(location.search);
if ('serviceWorker' in navigator && !dev) navigator.serviceWorker.register('sw.js').catch(() => {});
