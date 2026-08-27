// U52 - THE ENHANCED CHARACTER SHEET, in a real browser.
//
// WHAT ONLY A BROWSER CAN PROVE HERE is the CHILD CONTRACT. The sheet
// is not a leaf: its four navigation buttons push a window, the port's
// hosts hold one overlay slot so the sheet owns that child and
// delegates to it, and the child is a CANVAS window living underneath
// an opaque DOM div. Every claim in that sentence is a real object
// interacting with a real layout, and node has neither.
//
// So this drives the actual push: a hook that hands back a fake child,
// a click on the real button, and then the questions that matter -
// did the div go hidden, does every arm of the contract reach the
// child, does a finished child pop, does the sheet come BACK, and does
// it re-read the pack it may have been changed by. U42 is why the arm
// list is exhaustive: the classic sheet forwarded four of five and the
// spellbook lost its highlight and its tooltips, silently, for a
// slice.
//
// The arithmetic is NOT here - it is pure and pinned in node against
// ui/charsheet.js's own expressions (test/enhancedCharSheet.test.js).
//
// Run against a dev server with NO arena2 on disk:
//     npx vite --port 5199 &
//     node tools/enhancedSheetProbe.mjs
import { chromium, devices } from 'playwright';

const BASE = process.env.PROBE_BASE ?? 'http://127.0.0.1:5199';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};
const browser = await chromium.launch();

/** THE BOOT MUST SETTLE BEFORE AN IN-GAME SCREEN OPENS.
 *
 *  main.js's top-level catch does `document.body.textContent = ...` on
 *  a failed boot, and assigning textContent REMOVES EVERY CHILD OF
 *  BODY - including an enhanced overlay opened a moment earlier. With
 *  no ARENA2 on disk the world boot always fails here, so a probe that
 *  opens a screen before that lands is racing a page wipe. It won that
 *  race often enough to look reliable, which is the worst kind: this
 *  repo has a commit called "the verifier said TIMEOUT four times
 *  against good deploys". So: wait for it.
 *
 *  A boot that SUCCEEDS never writes that text, so the wait times out
 *  and that is the correct outcome - hence the swallowed rejection. */
async function bootSettled(page) {
  await page.waitForFunction(
    () => document.body.textContent.includes('boot failed'), null, { timeout: 15000 },
  ).catch(() => { /* a successful boot never says it - nothing to wait for */ });
}


/** Drive the front door to the moment a game starts, so the boot menu
 *  unmounts through runEnhancedMenu's own resolve and what is left is
 *  the game's real page. */
async function toGamePage(page) {
  await page.goto(`${BASE}/play/?skin=enhanced`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#enhanced-menu .railbtn', { timeout: 20000 });
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await page.getByRole('button', { name: 'Begin', exact: true }).click();
  await page.waitForSelector('#enhanced-menu', { state: 'detached', timeout: 20000 });
  await bootSettled(page);
}

/** Open the sheet with a chosen set of hooks. `withChild` names the
 *  hooks that hand back a FAKE canvas child - a plain object answering
 *  the window contract and recording which arms reached it. */
async function openSheet(page, withChild = ['inventory', 'spellbook']) {
  await page.evaluate(async (which) => {
    const { createCharSheetWindow } = await import('/src/ui/charSheetDoor.js');
    globalThis.__calls = [];
    globalThis.__child = {
      done: false,
      input: () => globalThis.__calls.push('input'),
      click: () => globalThis.__calls.push('click'),
      wheel: () => globalThis.__calls.push('wheel'),
      hover: () => globalThis.__calls.push('hover'),
      tick: () => globalThis.__calls.push('tick'),
      draw: () => { globalThis.__calls.push('draw'); return 'drew'; },
      dispose: () => globalThis.__calls.push('dispose'),
    };
    const deps = {
      entity: {
        name: 'Aelwyn', race: 'Redguard', level: 4,
        career: { name: 'Spellsword', primarySkills: [0, 1], majorSkills: [2, 3], minorSkills: [4, 5, 6] },
        stats: {
          strength: 50, intelligence: 62, willpower: 40, agility: 55,
          endurance: 48, personality: 33, speed: 51, luck: 44,
        },
        skills: { 0: 41, 1: 38, 2: 27, 3: 22, 4: 15, 5: 11, 6: 9 },
        health: 41, maxHealth: 58, magicka: 20, maxMagicka: 44, fatigue: 3200,
        items: [{ name: 'Gold Pieces', group: 'Currency', stackCount: 1287 }],
      },
    };
    for (const w of which) deps[w] = () => globalThis.__child;
    globalThis.__slot = createCharSheetWindow(deps);
  }, withChild);
  await page.waitForSelector('#enhanced-charsheet .skillrow', { timeout: 20000 });
}

const calls = (page) => page.evaluate(() => globalThis.__calls);
const done = (page) => page.evaluate(() => globalThis.__slot?.done ?? null);
const visible = (page) => page.evaluate(() =>
  getComputedStyle(document.getElementById('enhanced-charsheet')).visibility);

async function run(label, opts) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await toGamePage(page);
  await openSheet(page);

  // ── 1. THE SCREEN ──────────────────────────────────────────────
  check(`${label}: F5's screen is the enhanced one`,
    (await page.locator('#enhanced-charsheet').count()) === 1);
  check(`${label}: the host is holding it`, (await done(page)) === false);
  check(`${label}: it names the character`,
    (await page.locator('#enhanced-charsheet .sheet-id h2').textContent()) === 'Aelwyn');
  check(`${label}: eight attributes, every one on a track`,
    (await page.locator('#enhanced-charsheet .sheetcol').first().locator('.meter').count()) === 8);

  // ── 2. THE DENSITY ARGUMENT ────────────────────────────────────
  // The classic sheet shows NINE skills at a time behind keys 1-4
  // (_drawSkillPage's ids.slice(0, 9)). This shows the seven career
  // skills at once and the rest one press away - disclosure, not
  // deletion, which is the whole reason this screen exists.
  const career = await page.locator('#enhanced-charsheet .skillrow').count();
  check(`${label}: the career skills are all on the screen at once`, career === 7, `${career} rows`);
  await page.locator('#enhanced-charsheet button.more').click();
  const all = await page.locator('#enhanced-charsheet .skillrow').count();
  check(`${label}: and the whole catalogue is one press away`, all === 35, `${all} rows`);
  check(`${label}: ...and the press is reversible`,
    (await page.locator('#enhanced-charsheet button.more').textContent()).includes('Hide'));
  await page.locator('#enhanced-charsheet button.more').click();
  check(`${label}: back to the career skills`,
    (await page.locator('#enhanced-charsheet .skillrow').count()) === 7);

  // ── 3. A BUTTON ONLY WHERE THE HOST HANDED A FACTORY ───────────
  const nav = await page.$$eval('#enhanced-charsheet .sheet-nav button', (ns) => ns.map((n) => n.textContent));
  // HISTORY IS ALWAYS DRAWN and that is charSheetNav.js's own law: it
  // needs nothing but the entity, so every host can open it. The
  // LOGBOOK is withheld here because this call hands no quest source,
  // which is the standalone ?dungeon page's real situation - and an
  // empty journal would tell a player they have no quests when the
  // truth is that this screen cannot see them.
  check(`${label}: the host-specific windows are drawn, the refused one is not`,
    JSON.stringify(nav) === JSON.stringify(['Inventory', 'Spellbook', 'History']), nav.join('/'));
  check(`${label}: ...and History is there whatever the host hands`, nav.includes('History'));
  check(`${label}: ...and the Logbook is not, with no quest source`, !nav.includes('Logbook'));

  // ── 4. THE PUSH: the div hides, the child takes the contract ───
  await page.locator('#enhanced-charsheet .sheet-nav button', { hasText: 'Inventory' }).click();
  check(`${label}: pushing a canvas child HIDES the opaque sheet`,
    (await visible(page)) === 'hidden',
    'the child draws underneath it - a visible sheet makes the child invisible');
  const forwarded = await page.evaluate(() => {
    const w = globalThis.__slot;
    w.input('back'); w.click(1, 2); w.wheel(1); w.hover(3, 4); w.tick(0.016);
    const drew = w.draw({}, {}, {}, 1);
    return { calls: globalThis.__calls, drew };
  });
  for (const arm of ['input', 'click', 'wheel', 'hover', 'tick', 'draw']) {
    check(`${label}: ${arm} reaches the child`, forwarded.calls.includes(arm),
      forwarded.calls.join(','));
  }
  check(`${label}: draw RETURNS the child's draw - it is the canvas half`,
    forwarded.drew === 'drew');
  check(`${label}: the sheet is still the host's one overlay`, (await done(page)) === false);

  // ── 5. THE POP: a finished child gives the sheet back ──────────
  await page.evaluate(() => { globalThis.__child.done = true; globalThis.__slot.tick(0.016); });
  check(`${label}: a finished child pops and the sheet returns`, (await visible(page)) === 'visible');
  check(`${label}: ...and the popped child was disposed`,
    (await calls(page)).includes('dispose'));
  check(`${label}: ...and the sheet is still readable`,
    (await page.locator('#enhanced-charsheet .skillrow').count()) === 7);
  check(`${label}: the host never saw the sheet finish`, (await done(page)) === false);

  // ── 6. A REFUSED WINDOW SAYS SO ────────────────────────────────
  await page.evaluate(() => globalThis.__slot.dispose());
  await openSheet(page, ['inventory']);
  const nav2 = await page.$$eval('#enhanced-charsheet .sheet-nav button', (ns) => ns.map((n) => n.textContent));
  check(`${label}: a host that hands no spellbook draws no Spellbook button`,
    !nav2.includes('Spellbook') && nav2.includes('Inventory'), nav2.join('/'));

  // ── 7. THE KEYS THAT OPENED IT CLOSE IT ────────────────────────
  await page.keyboard.press('Escape');
  await page.waitForSelector('#enhanced-charsheet', { state: 'detached', timeout: 10000 });
  check(`${label}: Escape closes the sheet`, (await done(page)) === true);
  await openSheet(page);
  await page.keyboard.press('F5');
  await page.waitForSelector('#enhanced-charsheet', { state: 'detached', timeout: 10000 });
  check(`${label}: F5 closes it too - and did NOT reload the page`,
    (await done(page)) === true && (await page.evaluate(() => !!globalThis.__slot)),
    'an unclaimed F5 destroys the session');

  // ── 8. THE PHONE LESSON, APPLIED IN ADVANCE ────────────────────
  await openSheet(page);
  const small = await page.$$eval('#enhanced-charsheet button', (ns) => ns
    .map((n) => ({ t: (n.textContent ?? '').trim().slice(0, 20), r: n.getBoundingClientRect() }))
    .filter(({ r }) => r.height > 0 && r.height < 44)
    .map(({ t, r }) => `${t}@${Math.round(r.height)}`));
  check(`${label}: every target a finger has to hit is 44px`, small.length === 0, small.join(', '));
  const off = await page.$$eval('#enhanced-charsheet .sheet-nav button', (ns) => ns
    .map((n) => ({ t: (n.textContent ?? '').trim(), r: n.getBoundingClientRect() }))
    .filter(({ r }) => r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1)
    .map(({ t }) => t));
  check(`${label}: every navigation button is ON the screen`, off.length === 0, off.join(', '));

  check(`${label}: no page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await run('desktop', { viewport: { width: 1280, height: 800 } });
await run('phone', devices['Pixel 5']);

// ── THE BARE ENTITY, and the classic skin ────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await toGamePage(page);
  // Every host can open this before a character exists. A sheet that
  // throws takes the host's overlay slot with it.
  const bare = await page.evaluate(async () => {
    const { createCharSheetWindow } = await import('/src/ui/charSheetDoor.js');
    const { playerEntity } = await import('/src/characters/playerEntity.js');
    const w = createCharSheetWindow({ entity: playerEntity });
    return !!w && w.done === false;
  });
  await page.waitForSelector('#enhanced-charsheet .sheet-id', { timeout: 20000 });
  check('bare: the real playerEntity opens a sheet rather than throwing', bare);
  check('bare: no page errors', errors.length === 0, errors.join(' | '));
  await page.evaluate(() => document.getElementById('enhanced-charsheet')?.remove());

  // A PAGE OF ITS OWN. ?skin= answers for the page load and OUTRANKS
  // the stored choice (systems/uiSkin.js), so setUiSkin('classic') on
  // a page loaded with ?skin=enhanced changes nothing - which is the
  // property that keeps the 25 classic-geometry probes in tools/
  // honest, and it caught this probe writing the test wrong.
  await page.goto(`${BASE}/play/?skin=classic`, { waitUntil: 'domcontentloaded' });
  const kind = await page.evaluate(async () => {
    const { createCharSheetWindow } = await import('/src/ui/charSheetDoor.js');
    const w = createCharSheetWindow({ entity: { name: 'x', stats: {} } });
    return { name: w?.constructor?.name, dom: document.querySelectorAll('#enhanced-charsheet').length };
  });
  check('classic: F5 still opens the canvas sheet', kind.name === 'CharSheet', kind.name);
  check('classic: and no enhanced sheet is mounted', kind.dom === 0);
  await ctx.close();
}

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} checks passed`);
process.exit(bad.length ? 1 : 0);
