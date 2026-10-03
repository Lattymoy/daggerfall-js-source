// L10N1b (2026-09-27): THE LANGUAGE SETTING, IN A REAL BROWSER, WITH NO ARENA2.
//
// test/l10n1b.test.js holds the laws and the source; what only a browser can show is the boot and the menu doing it:
// the language's text fetched before the front door draws and only that language's, the first-run offer asked in the
// browser's own language and answered once, the Settings row switching the words at once, the page's `lang` following,
// `?lang=` for one visit, and English standing wherever nothing was chosen.
//
// Run against a dev server:
//     npx vite --port 5199 &
//     node tools/languageProbe.mjs
import { chromium } from 'playwright';

const BASE = process.env.PROBE_BASE ?? 'http://127.0.0.1:5199';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

const browser = await chromium.launch();

/** A page on the game's front door, with the page errors and the locale files it fetched. */
async function open(ctx, query = '') {
  const page = await ctx.newPage();
  const errors = [];
  const fetched = new Set();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => { const m = /\/locales\/([A-Za-z0-9-]+)\/\w+\.csv/.exec(r.url()); if (m) fetched.add(m[1]); });
  await page.goto(`${BASE}/play/?nointro${query}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.px-menu button', { timeout: 20000 });
  return { page, errors, fetched };
}
/** A front-door button's words, by its structural id (door-<English id>), without the diamonds. */
const door = async (page, id) => (await page.locator(`.px-menu .door-${id}`).first().innerText()).replace(/◆/g, '').trim();
const htmlLang = (page) => page.evaluate(() => document.documentElement.lang);
const same = (a, b) => a.toLocaleLowerCase() === b.toLocaleLowerCase();   // the rail's face is set in capitals by CSS
const accountUp = async (page) => (await page.locator('.px-acctstage').count()) === 1;
/** The account window, offered once a visit to a device nobody is signed in on, closed by a tap outside it. */
async function closeAccount(page) {
  if (await accountUp(page)) await page.locator('.px-acctstage').click({ position: { x: 2, y: 2 } });
}

// 1. A FRENCH BROWSER, FIRST VISIT: English stands, the offer asks in French, Yes switches and is remembered.
{
  const ctx = await browser.newContext({ locale: 'fr-FR' });
  const { page, errors, fetched } = await open(ctx);
  const offer = page.locator('.px-langoffer');
  check('fr browser: the offer is up', (await offer.count()) === 1);
  check('fr browser: it asks in French', (await offer.locator('.px-langoffer-q').innerText()).trim() === 'Jouer en français ?');
  check('fr browser: it says the translation is machine-made', (await offer.locator('.px-langoffer-note').count()) === 1);
  check('fr browser: English stands until the player answers', same(await door(page, 'new'), 'New Game') && (await htmlLang(page)) === 'en', await door(page, 'new'));
  check('fr browser: only French was fetched', [...fetched].join() === 'fr', [...fetched].join());
  check('fr browser: the account window waits while the language is asked', !(await accountUp(page)));
  await offer.locator('.act.primary').click();
  await page.waitForFunction(() => document.documentElement.lang === 'fr');
  check('fr browser, Yes: the rail is French', same(await door(page, 'new'), 'Nouvelle partie'), await door(page, 'new'));
  check('fr browser, Yes: the offer is gone', (await page.locator('.px-langoffer').count()) === 0);
  check('fr browser, Yes: the account window follows the answer', await accountUp(page));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.px-menu button');
  check('fr browser, reloaded: French is remembered', same(await door(page, 'new'), 'Nouvelle partie') && (await htmlLang(page)) === 'fr');
  check('fr browser, reloaded: nothing is offered again', (await page.locator('.px-langoffer').count()) === 0);
  await closeAccount(page);

  // THE SETTINGS ROW: the language chosen, switched at once, labelled while machine-made
  await page.locator('.px-menu .door-settings').click();
  await page.locator('#enhanced-menu .subbtn').filter({ hasText: /^Interface/ }).first().click();
  const sel = page.locator('#enhanced-menu .row select');
  check('settings: the language row is on the Interface pane', (await sel.count()) === 1);
  check('settings: it holds the current language', (await sel.inputValue()) === 'fr');
  const options = await sel.locator('option').evaluateAll((os) => os.map((o) => o.value));
  check('settings: every language the build holds, the pseudo-locale not among them', options.length >= 26 && options[0] === 'en' && !options.includes('qps-ploc'), `${options.length}`);
  check('settings: the machine label shows', (await page.locator('#enhanced-menu .row-note', { hasText: 'Traduction automatique' }).count()) === 1);
  await sel.selectOption('de');
  await page.waitForFunction(() => document.documentElement.lang === 'de');
  const railOn = async () => (await page.locator('#enhanced-menu .railbtn.on').first().innerText()).trim();
  check('settings, German: the rail switches at once', same(await railOn(), 'Einstellungen'), await railOn());
  await page.locator('#enhanced-menu .row select').selectOption('en');
  await page.waitForFunction(() => document.documentElement.lang === 'en');
  check('settings, English: the rail is English again', same(await railOn(), 'Settings'), await railOn());
  check('settings, English: no machine label', (await page.locator('#enhanced-menu .row-note', { hasText: /machine/i }).count()) === 0);
  check('fr browser: no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// 2. A FRENCH BROWSER THAT SAYS NO: English stays, and the offer never returns.
{
  const ctx = await browser.newContext({ locale: 'fr-FR' });
  const { page, errors } = await open(ctx);
  await page.locator('.px-langoffer .act').filter({ hasText: 'Non, rester en anglais' }).click();
  check('fr browser, No: the offer is gone and English stands', (await page.locator('.px-langoffer').count()) === 0 && same(await door(page, 'new'), 'New Game'));
  check('fr browser, No: the account window follows the answer', await accountUp(page));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.px-menu button');
  check('fr browser, No, reloaded: nothing is offered again', (await page.locator('.px-langoffer').count()) === 0);
  check('fr browser, No: no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// 3. AN ENGLISH BROWSER: nothing offered, nothing fetched.
{
  const ctx = await browser.newContext({ locale: 'en-US' });
  const { page, errors, fetched } = await open(ctx);
  check('en browser: no offer', (await page.locator('.px-langoffer').count()) === 0);
  check('en browser: no locale file fetched', fetched.size === 0, [...fetched].join());
  check('en browser: English', same(await door(page, 'new'), 'New Game') && (await htmlLang(page)) === 'en');
  check('en browser: the account window is offered at once, as before', await accountUp(page));
  check('en browser: no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// 4. ?lang= FOR ONE VISIT: Japanese drawn and only Japanese fetched, the choice not remembered; the pseudo-locale.
{
  const ctx = await browser.newContext({ locale: 'en-US' });
  const { page, errors, fetched } = await open(ctx, '&lang=ja');
  check('?lang=ja: the rail is Japanese', (await door(page, 'new')) === 'はじめから', await door(page, 'new'));
  check('?lang=ja: the page is lang=ja', (await htmlLang(page)) === 'ja');
  check('?lang=ja: only Japanese was fetched', [...fetched].join() === 'ja', [...fetched].join());
  await page.goto(`${BASE}/play/?nointro`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.px-menu button');
  check('?lang=ja: one visit only', same(await door(page, 'new'), 'New Game'));
  const pseudo = await open(ctx, '&lang=qps-ploc');
  const word = await door(pseudo.page, 'new');
  check('?lang=qps-ploc: the rail is pseudo-localized', word.startsWith('[') && word.endsWith(']') && !same(word, '[New Game]'), word);
  check('?lang=qps-ploc: the page reads as English', (await htmlLang(pseudo.page)) === 'en');
  const unknown = await open(ctx, '&lang=xx');
  check('?lang=xx: English', same(await door(unknown.page, 'new'), 'New Game'));
  check('?lang=: no page errors', [...errors, ...pseudo.errors, ...unknown.errors].length === 0, [...errors, ...pseudo.errors, ...unknown.errors].join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
