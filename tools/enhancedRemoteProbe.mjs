// U58 - THE REMOTE PANE, in a real browser.
//
// The pack's second list, which is what every flow the enhanced screen
// could not answer actually was: the wagon, a corpse, a guild's reward
// tray, and dropping anything at all. The LAW under it is DFU's and is
// pinned headless (itemTransfer, inventorySession, enhancedInventory);
// what only a browser can answer is whether the pane is an INTERFACE -
// do both lists fit at once, does the wagon toggle, does a stow land
// where the label said it would, and does the drop pile survive the
// window closing.
//
// The last one is the one that matters most and is the least visible:
// AUDIT B-C1's mint. A drop that never becomes a world pile looks
// exactly like a player misremembering, and no screenshot shows it.
//
//     npx vite --port 5199 &
//     node tools/enhancedRemoteProbe.mjs
import { chromium, devices } from 'playwright';

const BASE = process.env.PROBE_BASE ?? 'http://127.0.0.1:5199';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};
const browser = await chromium.launch();

/** main.js's failed boot assigns document.body.textContent, which
 *  removes every child of body - an overlay opened before that lands
 *  is racing a page wipe. See enhancedPackProbe for the whole story. */
async function bootSettled(page) {
  await page.waitForFunction(
    () => document.body.textContent.includes('boot failed'), null, { timeout: 15000 },
  ).catch(() => { /* a successful boot never says it */ });
}

async function toGamePage(page) {
  await page.goto(`${BASE}/play/?skin=enhanced`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#enhanced-menu .railbtn', { timeout: 20000 });
  await page.locator('#enhanced-menu .railbtn', { hasText: 'New Game' }).first().click();
  await page.getByRole('button', { name: 'Begin', exact: true }).click();
  await page.waitForSelector('#enhanced-menu', { state: 'detached', timeout: 20000 });
  await bootSettled(page);
}

/** Opens the pack with a bag, a wagon list and whatever remote target
 *  the case wants. Everything is built from the port's OWN templates,
 *  so the weights and names on screen are the game's numbers. */
async function openPack(page, mode = 'ground') {
  await page.evaluate(async (m) => {
    const { createInventoryWindow } = await import('/src/ui/inventoryDoor.js');
    const { ITEM_TEMPLATES } = await import('/src/characters/paperdoll.js');
    const t = (n) => ITEM_TEMPLATES.find((x) => x.name === n);
    const mk = (n, group = 'Weapons', stackCount = 1) => {
      const tp = t(n);
      return tp && {
        name: tp.name, templateIndex: tp.index, group, stackCount,
        currentCondition: tp.hitPoints ?? 50, maxCondition: tp.hitPoints ?? 50,
      };
    };
    const cart = t('Small cart') ?? t('Small Cart');
    const e = {
      name: 'Aelwyn', career: { name: 'Spellsword' },
      stats: { strength: 50, endurance: 48 }, items: [],
    };
    e.items = [mk('Longsword'), mk('Dagger'), mk('Cuirass', 'Armor'), mk('Boots', 'Armor'),
      { name: cart.name, templateIndex: cart.index, group: 'Transportation' },
      { name: 'Gold Pieces', templateIndex: 276, group: 'Currency', stackCount: 1287 }].filter(Boolean);
    const wagon = [];
    const pile = [mk('Battle Axe'), mk('Helm', 'Armor')].filter(Boolean);
    const reward = [mk('Claymore'), mk('Broadsword')].filter(Boolean);
    globalThis.__ent = e;
    globalThis.__wagon = wagon;
    globalThis.__pile = pile;
    globalThis.__minted = null;
    globalThis.__chose = null;
    const extra = m === 'container' ? { loot: { items: () => pile } }
      : m === 'reward' ? { chooseOne: { items: reward, onChoose: (it) => { globalThis.__chose = it.name; } } }
        : {};
    globalThis.__slot = createInventoryWindow({
      entity: e, items: () => e.items, wagonItems: () => wagon,
      onDrop: (items) => { globalThis.__minted = items.map((i) => i.name); },
      ...extra,
    });
  }, mode);
  await page.waitForSelector('#enhanced-inventory .packremote', { timeout: 20000 });
}

const pack = (page) => page.evaluate(() => JSON.parse(globalThis.__pack()));
const localRow = (page, name) =>
  page.locator('#enhanced-inventory .packcol:not(.packremote) .itemrow', { hasText: name }).first();
const remoteRow = (page, name) =>
  page.locator('#enhanced-inventory .packremote .itemrow', { hasText: name }).first();
const act = (page, label) =>
  page.locator('#enhanced-inventory .acts button', { hasText: label }).first();
async function closeSheet(page) {
  const lid = page.locator('#enhanced-inventory .packdetail .sheet-close');
  if (await lid.isVisible()) await lid.click();
}

async function run(label, opts) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await toGamePage(page);
  await openPack(page, 'ground');

  // ── 1. BOTH LISTS ARE ON THE SCREEN AT ONCE ────────────────────
  // The whole point of the pane. Two lists that need scrolling past
  // each other are one list with extra steps, so this measures where
  // they actually landed rather than trusting the grid.
  let p = await pack(page);
  check(`${label}: the remote pane is the GROUND by default`, p.remoteKind === 'ground', p.remoteKind);
  const boxes = await page.evaluate(() => {
    const l = document.querySelector('#enhanced-inventory .packcol:not(.packremote):not(.packdetail)');
    const r = document.querySelector('#enhanced-inventory .packremote');
    const b = (n) => { const x = n.getBoundingClientRect(); return { x: Math.round(x.x), y: Math.round(x.y), w: Math.round(x.width), h: Math.round(x.height) }; };
    return { l: b(l), r: b(r), vh: innerHeight, vw: innerWidth };
  });
  check(`${label}: both lists have real width`, boxes.l.w > 120 && boxes.r.w > 120,
    `${boxes.l.w} / ${boxes.r.w}`);
  check(`${label}: the remote list starts on the screen`,
    boxes.r.y >= 0 && boxes.r.y < boxes.vh && boxes.r.x >= 0 && boxes.r.x < boxes.vw,
    `x=${boxes.r.x} y=${boxes.r.y} of ${boxes.vw}x${boxes.vh}`);
  // side by side on a desktop, stacked on a phone - either is fine,
  // OVERLAPPING is not
  const sideBySide = boxes.r.x >= boxes.l.x + boxes.l.w - 2;
  const stacked = boxes.r.y >= boxes.l.y + boxes.l.h - 2;
  check(`${label}: the two lists do not overlap`, sideBySide || stacked,
    sideBySide ? 'side by side' : stacked ? 'stacked' : `l=${JSON.stringify(boxes.l)} r=${JSON.stringify(boxes.r)}`);

  // ── 2. DROPPING PUTS IT ON THE GROUND, AND THE LABEL SAID SO ───
  await localRow(page, 'Dagger').click();
  const dropLabel = await act(page, 'Drop').count();
  check(`${label}: the stow verb names the destination`, dropLabel === 1, 'Drop');
  await act(page, 'Drop').click();
  await closeSheet(page);
  p = await pack(page);
  check(`${label}: the dropped item is on the ground`, p.remoteCount === 1 && p.dropped === 1,
    `remote ${p.remoteCount}, dropped ${p.dropped}`);
  const gone = await localRow(page, 'Dagger').count();
  check(`${label}: ...and out of the pack`, gone === 0);

  // ── 3. AND TAKING IT BACK WORKS FROM THE OTHER SIDE ────────────
  await remoteRow(page, 'Dagger').click();
  check(`${label}: a remote pick offers Take, not Wear`,
    (await act(page, 'Take').count()) === 1 && (await act(page, 'Wear').count()) === 0);
  await act(page, 'Take').click();
  await closeSheet(page);
  p = await pack(page);
  check(`${label}: taking it back empties the ground`, p.remoteCount === 0, `${p.remoteCount} left`);
  check(`${label}: ...and the pack tab followed it`, p.tab === 'weapons', p.tab);

  // ── 4. THE WAGON TOGGLES, AND IT IS A DIFFERENT LIST ───────────
  await page.locator('#enhanced-inventory .remoteacts button', { hasText: 'Wagon' }).click();
  p = await pack(page);
  check(`${label}: the wagon button shows the wagon`, p.usingWagon && p.remoteKind === 'wagon',
    p.remoteKind);
  const cap = await page.textContent('#enhanced-inventory .remotewho .meta');
  check(`${label}: and the wagon shows its 750kg limit`, /\/ 750 kg/.test(cap), cap.trim());
  await localRow(page, 'Longsword').click();
  check(`${label}: the verb changed with the destination`,
    (await act(page, 'Stow in wagon').count()) === 1);
  await act(page, 'Stow in wagon').click();
  await closeSheet(page);
  p = await pack(page);
  check(`${label}: stowing lands in the WAGON, not the ground`,
    p.remoteCount === 1 && p.dropped === 0, `remote ${p.remoteCount}, dropped ${p.dropped}`);
  const inWagon = await page.evaluate(() => globalThis.__wagon.map((i) => i.name));
  check(`${label}: ...and the host's own wagon list has it`, inWagon.includes('Longsword'),
    inWagon.join(', '));

  // ── 5. THE CART CANNOT BE STOWED IN ITS OWN WAGON ──────────────
  // AUDIT 24 ui. TransferItem's transport block is SILENT, so a button
  // that could only be silently refused is not drawn at all - the U53
  // rule about controls that can only do nothing.
  await page.locator('#enhanced-inventory .packtab', { hasText: 'Clothing' }).click();
  const cartRow = page.locator('#enhanced-inventory .packcol:not(.packremote) .itemrow', { hasText: 'cart' }).first();
  if (await cartRow.count()) {
    await cartRow.click();
    check(`${label}: the cart offers no way into its own wagon`,
      (await act(page, 'Stow in wagon').count()) === 0);
    check(`${label}: ...but is still a normal item otherwise`, (await act(page, 'Use').count()) === 1);
    await closeSheet(page);
  } else {
    check(`${label}: the cart row is findable`, false, 'no cart row');
  }

  // ── 6. GOLD IS ITS OWN CONTROL ─────────────────────────────────
  await page.locator('#enhanced-inventory .remoteacts button', { hasText: 'Gold' }).click();
  const field = page.locator('#enhanced-inventory .goldfield input');
  check(`${label}: the gold button opens a numeric field`, (await field.count()) === 1);
  await field.fill('400');
  await page.locator('#enhanced-inventory .goldfield button').click();
  p = await pack(page);
  check(`${label}: 400 gold left the purse`, p.gold === 887, `${p.gold} gold`);
  const wagonGold = await page.evaluate(() =>
    globalThis.__wagon.find((i) => i.group === 'Currency')?.stackCount ?? 0);
  check(`${label}: ...and landed in the wagon`, wagonGold === 400, `${wagonGold} in the wagon`);
  // AND AN OUT-OF-RANGE AMOUNT IS REFUSED OUTRIGHT, not clamped
  await page.locator('#enhanced-inventory .remoteacts button', { hasText: 'Gold' }).click();
  await page.locator('#enhanced-inventory .goldfield input').fill('99999');
  await page.locator('#enhanced-inventory .goldfield button').click();
  p = await pack(page);
  check(`${label}: an amount above the purse moves nothing`, p.gold === 887, `${p.gold} gold`);

  check(`${label}: no page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

/** THE MINT, which is the invisible one. A session drop must become a
 *  world pile when the window goes (AUDIT B-C1) - and the door reads
 *  it out of the view, so only a real mount proves the wiring. */
async function runMint() {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await toGamePage(page);
  await openPack(page, 'ground');
  await localRow(page, 'Dagger').click();
  await act(page, 'Drop').click();
  await closeSheet(page);
  await page.keyboard.press('Escape');
  await page.waitForSelector('#enhanced-inventory', { state: 'detached', timeout: 10000 });
  const minted = await page.evaluate(() => globalThis.__minted);
  check('mint: closing the pack MINTS the session drop pile',
    Array.isArray(minted) && minted.includes('Dagger'), JSON.stringify(minted));
  const doneFlag = await page.evaluate(() => globalThis.__slot.done);
  check('mint: and the overlay reports done only once the DOM is down', doneFlag === true);
  check('mint: no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

/** A CORPSE, and a guild's REWARD TRAY - the two flows U53 handed to
 *  the classic window and U58 took back. */
async function runTargets() {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await toGamePage(page);

  await openPack(page, 'container');
  let p = await pack(page);
  check('loot: a pile opens as the remote side', p.remoteKind === 'container' && p.remoteCount === 2,
    `${p.remoteKind} ${p.remoteCount}`);
  await remoteRow(page, 'Battle Axe').click();
  await act(page, 'Take').click();
  await closeSheet(page);
  p = await pack(page);
  check('loot: taking from a pile leaves it', p.remoteCount === 1, `${p.remoteCount} left`);
  const pile = await page.evaluate(() => globalThis.__pile.map((i) => i.name));
  check("loot: ...and the HOST's pile is the one that shrank", !pile.includes('Battle Axe'),
    pile.join(', '));
  await page.evaluate(() => globalThis.__slot.dispose());
  await page.waitForSelector('#enhanced-inventory', { state: 'detached', timeout: 10000 });

  await openPack(page, 'reward');
  p = await pack(page);
  check('reward: a choose-one tray opens as the remote side',
    p.remoteKind === 'reward' && p.remoteCount === 2, `${p.remoteKind} ${p.remoteCount}`);
  await localRow(page, 'Longsword').click();
  check('reward: nothing of the player\'s can go INTO the tray (G6)',
    (await act(page, 'Stow').count()) === 0);
  await closeSheet(page);
  await remoteRow(page, 'Claymore').click();
  check('reward: the label says taking one is the whole choice',
    (await act(page, 'Take this one').count()) === 1);
  await act(page, 'Take this one').click();
  // G6 (:1585-1591): the claim and the taking are ONE event
  await page.waitForSelector('#enhanced-inventory', { state: 'detached', timeout: 10000 });
  const chose = await page.evaluate(() => globalThis.__chose);
  check('reward: taking one closes the window AND fires the callback', chose === 'Claymore', String(chose));
  check('reward: no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

/** THE STACK ORDER, which only a phone has. Stacked, the list you came
 *  for must be the one at the top - and the 46vh schematic must not be
 *  above either of them, which is how the remote list ended up at
 *  y=781 in a 727px viewport on the first draft of this pane. */
async function runPhoneOrder() {
  const ctx = await browser.newContext(devices['Pixel 5']);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await toGamePage(page);
  const where = async () => page.evaluate(() => {
    const b = (sel) => { const n = document.querySelector(sel); const r = n.getBoundingClientRect(); return Math.round(r.y); };
    return {
      local: b('#enhanced-inventory .packcol:not(.packremote):not(.packdetail)'),
      remote: b('#enhanced-inventory .packremote'),
      doll: b('#enhanced-inventory .wornmap'),   // PX19d: the worn map took the schematic's job
      vh: innerHeight,
    };
  });

  await openPack(page, 'ground');
  let w = await where();
  check('phone order: the pack list is at the top when the ground is the target',
    w.local < w.remote && w.local < w.vh, JSON.stringify(w));
  check('phone order: and the remote list is on the screen too', w.remote < w.vh, `y=${w.remote}`);
  check('phone order: the schematic is BELOW both lists', w.doll > w.remote, `doll y=${w.doll}`);
  await page.evaluate(() => globalThis.__slot.dispose());
  await page.waitForSelector('#enhanced-inventory', { state: 'detached', timeout: 10000 });

  await openPack(page, 'container');
  w = await where();
  check('phone order: a CORPSE puts its own list first',
    w.remote < w.local && w.remote < w.vh, JSON.stringify(w));
  check('phone order: no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await run('desktop', { viewport: { width: 1440, height: 900 } });
await run('phone', { ...devices['Pixel 5'] });
await runMint();
await runTargets();
await runPhoneOrder();

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} checks passed`);
process.exit(bad.length ? 1 : 0);
