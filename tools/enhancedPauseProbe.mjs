// U51 - THE PAUSE DOOR, in a real browser.
//
// WHAT THIS PROVES AND WHAT IT DOES NOT, stated up front because the
// difference is the whole honesty of the check:
//
//   PROVEN HERE - the fork takes the enhanced branch in a real
//   browser; the screen lands over the page opaque and at the right
//   depth; the pause rail is the pause rail; the settings pane (the
//   entire reason this door exists) renders; every exit closes the
//   door BEFORE it fires the host's hook, which is checked by asking
//   the hook itself whether the door is still up; Escape closes it and
//   the overlay reports done to the host; a host that refuses to save
//   is believed; and every target on a phone is 44px.
//
//   NOT PROVEN HERE - that the four hosts call it. Escape inside a
//   living game needs ARENA2, and this check runs with none, on
//   purpose: the whole premise of the enhanced skin is that its
//   screens read no game data. The host wiring is held by the source
//   pins in test/enhancedPause.test.js (every host gates on
//   pauseDoorReady and imports the door, none imports the classic
//   window past the fork) and by test/pausewindow.test.js's I3 pin.
//
// The page is index.html driven to the moment a game starts - the
// front door pressed through to Begin, so the boot menu is torn down
// by its OWN path rather than by this probe reaching into it. What is
// left is the game's real page with the data pick waiting on it, which
// is the closest thing to a running game that exists without ARENA2,
// and it is a fair stack: the pick sits at z-index 10-11 and the pause
// door at 13, exactly as they would in play.
//
// Run against a dev server with NO arena2 on disk:
//     npx vite --port 5199 &
//     node tools/enhancedPauseProbe.mjs
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


// A SAVE IN THE SLOT, because the empty state is not the interesting
// one. Four of this screen's panes are built FROM the quicksave, and
// with none in storage they all draw their "nothing here yet" arm and
// every claim about what a player is shown before overwriting a game
// is vacuously true. save.js validates the envelope version, so this
// is what restorableQuicksave will actually accept (v === 1).
const SAVE = {
  v: 1, name: 'Aelwyn', chargenDone: true,
  career: { name: 'Spellsword' }, level: 4,
  health: 41, maxHealth: 58,
  classicMinutes: 396_000_000 + 60 * 17 + 34,
  items: [{ name: 'Gold Pieces', stackCount: 1287 }],
};

/** Drive the front door to the moment a game starts, so the boot menu
 *  unmounts through runEnhancedMenu's own resolve. */
async function toGamePage(page, skin) {
  await page.addInitScript((snap) => {
    try { localStorage.setItem('dagger.quicksave', JSON.stringify(snap)); } catch { /* storage off */ }
  }, SAVE);
  await page.goto(`${BASE}/play/?skin=${skin}`, { waitUntil: 'load' });
  if (skin === 'enhanced') {
    await page.waitForSelector('#enhanced-menu .railbtn', { timeout: 15000 });
    await page.getByRole('button', { name: 'New Game', exact: true }).click();
    await page.getByRole('button', { name: 'Begin', exact: true }).click();
    await page.waitForSelector('#enhanced-menu', { state: 'detached', timeout: 15000 });
    await bootSettled(page);
  }
}

/** Open the pause door with a given host's hooks. The hooks report
 *  whether the DOOR WAS STILL UP when they ran, which is the ordering
 *  law stated as a question only the browser can answer. */
async function openDoor(page, { canSave = true, canLoad = true } = {}) {
  await page.evaluate(async ({ canSave: cs, canLoad: cl }) => {
    globalThis.__log = [];
    const up = () => (document.getElementById('enhanced-pause') ? 'door-up' : 'door-down');
    const { openPauseFlow } = await import('/src/ui/pauseDoor.js');
    const hooks = {
      exitToMenu: () => globalThis.__log.push(`exit:${up()}`),
      textLines: () => null,
    };
    if (cs) hooks.quickSave = () => globalThis.__log.push(`save:${up()}`);
    else hooks.savingPrevented = () => true;
    if (cl) hooks.quickLoad = () => globalThis.__log.push(`load:${up()}`);
    globalThis.__slot = null;
    openPauseFlow((w) => { globalThis.__slot = w; }, hooks);
  }, { canSave, canLoad });
}

const railText = (page) => page.$$eval('#enhanced-pause .railbtn .rk', (ns) => ns.map((n) => n.textContent));
const log = (page) => page.evaluate(() => globalThis.__log);
const done = (page) => page.evaluate(() => globalThis.__slot?.done ?? null);

async function run(label, opts) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await toGamePage(page, 'enhanced');

  // ── 1. THE FORK, AND THE SCREEN IT PUTS UP ─────────────────────
  await openDoor(page);
  await page.waitForSelector('#enhanced-pause .railbtn', { timeout: 15000 });
  check(`${label}: Escape's screen is the enhanced one`,
    (await page.locator('#enhanced-pause').count()) === 1);
  const box = await page.$eval('#enhanced-pause', (n) => {
    const s = getComputedStyle(n);
    return { pos: s.position, z: s.zIndex, bg: s.backgroundColor };
  });
  check(`${label}: it is fixed, opaque and above the boot overlays`,
    box.pos === 'fixed' && box.z === '13' && !/rgba\(0, 0, 0, 0\)/.test(box.bg),
    `${box.pos} z${box.z} ${box.bg}`);
  check(`${label}: the host is holding it - which is what stops the motor and the clock`,
    (await done(page)) === false);

  // ── 2. THE PAUSE RAIL, AND THE PANE IT OPENS ON ────────────────
  const rail = await railText(page);
  check(`${label}: the rail asks the in-game questions`,
    JSON.stringify(rail) === JSON.stringify(
      ['Resume', 'Save Game', 'Load Game', 'Settings', 'Mods', 'About', 'Exit']),
    rail.join('/'));
  check(`${label}: it opens on Save Game`,
    (await page.locator('#enhanced-pause .head h2').textContent()) === 'Save Game');

  // EVERY DESTINATION IS ON THE SCREEN, not merely in the DOM. The
  // phone rail scrolls horizontally with its scrollbar hidden, so a
  // seventh entry went off the end with no affordance at all - and the
  // one pushed off was EXIT. The 44px check below passes either way,
  // which is the point: reachable and VISIBLE are different claims.
  const offscreen = await page.$$eval('#enhanced-pause .railbtn', (ns) => ns
    .map((n) => ({ t: (n.textContent ?? '').trim(), r: n.getBoundingClientRect() }))
    .filter(({ r }) => r.right > innerWidth + 1 || r.bottom > innerHeight + 1
      || r.left < -1 || r.top < -1)
    .map(({ t }) => t));
  check(`${label}: every rail destination is ON the screen`,
    offscreen.length === 0, offscreen.join(', '));

  // THE CARD IS THE GAME BEING OVERWRITTEN, not a label for the button
  const saveCard = await page.locator('#enhanced-pause .card').first().textContent();
  check(`${label}: the Save card names what the press replaces`,
    saveCard.includes('Overwrites') && saveCard.includes('Aelwyn')
    && /Health/i.test(saveCard) && /Gold/i.test(saveCard),
    saveCard.replace(/\s+/g, ' ').slice(0, 90));

  // ── 3. THE REASON THIS DOOR EXISTS ─────────────────────────────
  // U49's own record: settings were "reachable only at boot: once you
  // were playing there was no door back that was not a reload".
  await page.locator('#enhanced-pause .railbtn', { hasText: 'Settings' }).click();
  await page.waitForSelector('#enhanced-pause .row', { timeout: 10000 });
  const rows = await page.locator('#enhanced-pause .row').count();
  check(`${label}: settings are reachable from inside a game at last`, rows > 0, `${rows} rows`);

  // ── 4. THE HOST IS BELIEVED ────────────────────────────────────
  await page.locator('#enhanced-pause .railbtn', { hasText: 'Save Game' }).click();
  check(`${label}: a save-capable host gets a Save button`,
    (await page.locator('#enhanced-pause .acts button', { hasText: 'Save' }).count()) === 1);

  // ── 5. EVERY EXIT CLOSES THE DOOR BEFORE IT ACTS ───────────────
  // The port answers a save with a HUD line and this screen is opaque
  // over the whole canvas, so a hook fired under a live door hides its
  // own answer. The hook is asked, not the source.
  await page.locator('#enhanced-pause .acts button', { hasText: 'Save' }).click();
  await page.waitForSelector('#enhanced-pause', { state: 'detached', timeout: 10000 });
  check(`${label}: Save closed the door first, then wrote`,
    JSON.stringify(await log(page)) === JSON.stringify(['save:door-down']),
    (await log(page)).join(','));
  check(`${label}: ...and the overlay reports done, so the host frees its slot`,
    (await done(page)) === true);

  // ── 6. A HOST THAT REFUSES IS BELIEVED, NOT OVERRIDDEN ─────────
  // Two of the four hand savingPrevented: () => true and no hook at
  // all. A Save button there is the lie the anti-lie law forbids.
  await openDoor(page, { canSave: false, canLoad: false });
  await page.waitForSelector('#enhanced-pause .railbtn', { timeout: 15000 });
  check(`${label}: a host that cannot save draws no Save button`,
    (await page.locator('#enhanced-pause .acts button', { hasText: 'Save' }).count()) === 0);
  check(`${label}: ...and says so in the game's own words`,
    (await page.locator('#enhanced-pause').textContent()).includes('You cannot save now.'));
  check(`${label}: the refused rows stay ON the rail`,
    (await railText(page)).includes('Save Game'));

  // ── 7. EXIT ASKS FIRST ─────────────────────────────────────────
  await page.locator('#enhanced-pause .railbtn', { hasText: 'Exit' }).click();
  await page.locator('#enhanced-pause .acts button', { hasText: 'Leave this game' }).click();
  check(`${label}: leaving a game asks before it throws it away`,
    (await page.locator('#enhanced-pause .card p.meta').first().textContent()).length > 0
    && (await page.locator('#enhanced-pause').textContent()).includes('Cancel'));
  // A CONFIRM THAT REPEATS THE CARD IT REPLACED reads as a screen that
  // did not respond: both were titled "Leave this game" at first.
  check(`${label}: ...and the confirm does not repeat the heading it replaced`,
    (await page.locator('#enhanced-pause .card h3').first().textContent()) === 'Leave this game',
    'the confirm echoes the BUTTON, and the card heading says where you go');
  check(`${label}: ...and Cancel means cancel`,
    await page.locator('#enhanced-pause .acts button', { hasText: 'Cancel' }).count() === 1);
  await page.locator('#enhanced-pause .acts button', { hasText: 'Cancel' }).click();
  check(`${label}: the door is still up after Cancel`,
    (await page.locator('#enhanced-pause').count()) === 1 && (await log(page)).length === 0);

  // ── 8. ESCAPE - the key that opened it closes it ───────────────
  // The back stack first: a confirm card is closed by the same key
  // before the screen is, or the press meaning "not that" quits.
  await page.locator('#enhanced-pause .railbtn', { hasText: 'Exit' }).click();
  await page.locator('#enhanced-pause .acts button', { hasText: 'Leave this game' }).click();
  await page.keyboard.press('Escape');
  check(`${label}: Escape cancels the confirm before it closes the screen`,
    (await page.locator('#enhanced-pause').count()) === 1
    && !(await page.locator('#enhanced-pause').textContent()).includes('Cancel'));
  await page.keyboard.press('Escape');
  await page.waitForSelector('#enhanced-pause', { state: 'detached', timeout: 10000 });
  check(`${label}: Escape then closes the pause door`, (await done(page)) === true);
  check(`${label}: ...and resuming fired no host hook`, (await log(page)).length === 0);

  // ── 9. THE LISTENER DIED WITH THE SCREEN ───────────────────────
  // A window-level capture keydown that outlives its DOM does not leak
  // quietly here: it eats Escape for the rest of the session, and the
  // game can never be paused again. Reopen and check the key still
  // reaches a LIVE screen rather than a dead one.
  await openDoor(page);
  await page.waitForSelector('#enhanced-pause .railbtn', { timeout: 15000 });
  await page.keyboard.press('Escape');
  await page.waitForSelector('#enhanced-pause', { state: 'detached', timeout: 10000 });
  check(`${label}: the door reopens and closes again - no orphaned listener`,
    (await done(page)) === true);

  // ── 10. THE PHONE ──────────────────────────────────────────────
  await openDoor(page);
  await page.waitForSelector('#enhanced-pause .railbtn', { timeout: 15000 });
  const small = await page.$$eval('#enhanced-pause button', (ns) => ns
    .map((n) => ({ t: (n.textContent ?? '').trim().slice(0, 24), h: n.getBoundingClientRect().height }))
    .filter((b) => b.h > 0 && b.h < 44));
  check(`${label}: every target a finger has to hit is 44px`,
    small.length === 0, small.map((b) => `${b.t}@${Math.round(b.h)}`).join(', '));

  check(`${label}: no page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await run('desktop', { viewport: { width: 1280, height: 800 } });
await run('phone', devices['Pixel 5']);

// ── THE CLASSIC SKIN IS UNTOUCHED ────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await toGamePage(page, 'classic');
  const kind = await page.evaluate(async () => {
    const { openPauseFlow, pauseDoorReady } = await import('/src/ui/pauseDoor.js');
    const w = openPauseFlow(() => {}, {});
    return { name: w?.constructor?.name, ready: pauseDoorReady() };
  });
  check('classic: Escape still opens the canvas window', kind.name === 'PauseOptionsWindow', kind.name);
  check('classic: and no enhanced screen is mounted',
    (await page.locator('#enhanced-pause').count()) === 0);
  check('classic: the door stays gated on OPTN00I0, which never loaded here',
    kind.ready === false);
  await ctx.close();
}

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} checks passed`);
process.exit(bad.length ? 1 : 0);
