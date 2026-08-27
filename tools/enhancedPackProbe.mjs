// U53 - THE ENHANCED PACK AND ITS SLOT MAP, in a real browser.
//
// Most of this screen's law runs headless and is pinned there
// (test/enhancedInventory.test.js actually wears things and reads the
// map). What only a browser can answer is whether the SCHEMATIC works
// as an interface: are twenty-five nodes laid out without collisions
// at a real size, does a filled node read differently from an empty
// one, can a finger hit one, and does clicking a node take the item
// off. A node that is drawn, correct, and 6px wide on a phone is the
// AUDIT 24 shape again.
//
// The items are built from the port's OWN templates, so the weights,
// materials and conditions on screen are the game's numbers - no
// ARENA2 is needed for that, because ITEM_TEMPLATES is ported data in
// the repo rather than game data on disk.
//
//     npx vite --port 5199 &
//     node tools/enhancedPackProbe.mjs
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


async function toGamePage(page, skin = 'enhanced') {
  await page.goto(`${BASE}/play/?skin=${skin}`, { waitUntil: 'load' });
  if (skin !== 'enhanced') return;
  await page.waitForSelector('#enhanced-menu .railbtn', { timeout: 20000 });
  await page.locator('#enhanced-menu .railbtn', { hasText: 'New Game' }).first().click();
  await page.getByRole('button', { name: 'Begin', exact: true }).click();
  await page.waitForSelector('#enhanced-menu', { state: 'detached', timeout: 20000 });
  await bootSettled(page);
}

async function openPack(page, extra = {}) {
  await page.evaluate(async (ex) => {
    const { createInventoryWindow } = await import('/src/ui/inventoryDoor.js');
    const { ITEM_TEMPLATES } = await import('/src/characters/paperdoll.js');
    const t = (n) => ITEM_TEMPLATES.find((x) => x.name === n);
    const mk = (n, group = 'Weapons') => {
      const tp = t(n);
      return tp && {
        name: tp.name, templateIndex: tp.index, group, stackCount: 1,
        currentCondition: tp.hitPoints ?? 50, maxCondition: tp.hitPoints ?? 50,
      };
    };
    const e = {
      name: 'Aelwyn', career: { name: 'Spellsword' },
      stats: { strength: 50, endurance: 48 }, items: [],
    };
    e.items = [mk('Longsword'), mk('Dagger'), mk('Buckler', 'Armor'), mk('Cuirass', 'Armor'),
      mk('Boots', 'Armor'), mk('Helm', 'Armor'), mk('Gauntlets', 'Armor'), mk('Greaves', 'Armor'),
      { name: 'Gold Pieces', templateIndex: 276, group: 'Currency', stackCount: 1287 }].filter(Boolean);
    globalThis.__ent = e;
    globalThis.__slot = createInventoryWindow({
      entity: e, items: () => e.items, wagonItems: () => [], ...ex,
    });
  }, extra);
  await page.waitForSelector('#enhanced-inventory .itemrow', { timeout: 20000 });
}

const pack = (page) => page.evaluate(() => JSON.parse(globalThis.__pack()));

/** The detail column is a SHEET only on a phone; on a desktop it is
 *  the third column and its close control is display:none, because a
 *  column that is always there has nothing to close. So the sheet
 *  dance is conditional, and the condition is the control's own
 *  visibility rather than a viewport guess. */
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
  await openPack(page);

  // ── 1. THE SCHEMATIC IS DRAWN, WHOLE ───────────────────────────
  let p = await pack(page);
  check(`${label}: F6's screen is the enhanced pack`,
    (await page.locator('#enhanced-inventory').count()) === 1);
  check(`${label}: every named slot has a node`, p.nodes === 25, `${p.nodes} nodes`);
  check(`${label}: and none is filled on a bare character`, p.filled === 0);

  // ── 2. THE NODES ARE REAL TARGETS AT A REAL SIZE ───────────────
  // A schematic whose nodes collide or shrink to nothing is not an
  // interface. Measured in LAYOUT pixels, which is what a finger hits.
  const nodes = await page.$$eval('#enhanced-inventory .node circle', (ns) => ns.map((n) => {
    const r = n.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width };
  }));
  const tooSmall = nodes.filter((n) => n.w < 6);
  check(`${label}: no node is drawn smaller than 6px`, tooSmall.length === 0,
    `${tooSmall.length} of ${nodes.length}`);
  let collisions = 0;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y) < 8) collisions++;
    }
  }
  check(`${label}: no two nodes overlap on screen`, collisions === 0, `${collisions} pairs`);

  // ── 3. THE DETAIL, AND THE SHEET IT BECOMES ────────────────────
  // Three columns do not fit one phone, so there the detail RISES over
  // the list when an item is picked - the settings pane's own answer
  // to the same problem - and it must go back down, or the list is
  // unreachable for the rest of the session. This is the check the
  // desktop cannot make: the whole screen was perfect at 1400px while
  // every phone had the Wear button 101% below the fold, because the
  // column had been given the class `detail`, which the settings
  // sheet already owned in the same stylesheet.
  await page.locator('#enhanced-inventory .itemrow').first().click();
  const sheet = await page.$eval('#enhanced-inventory .packdetail', (n) => ({
    open: n.classList.contains('open'),
    y: Math.round(n.getBoundingClientRect().y),
    lid: getComputedStyle(n.querySelector('.sheet-close')).display,
  }));
  check(`${label}: the picked item's detail is ON the screen`,
    sheet.y >= 0 && sheet.y < (opts.viewport?.height ?? 900), `y=${sheet.y}`);
  if (sheet.lid !== 'none') {
    check(`${label}: it is a sheet here, and it rose`, sheet.open);
    await closeSheet(page);
    check(`${label}: and closing it gives the list back`,
      (await page.$eval('#enhanced-inventory .packdetail', (n) => n.classList.contains('open'))) === false);
  } else {
    check(`${label}: it is a column here, with no lid to close`, sheet.lid === 'none');
  }

  // ── 4. WEARING LIGHTS THE MAP ──────────────────────────────────
  // The sheet is closed between picks, which is what a finger does:
  // it covers the list on purpose while it is up.
  for (const name of ['Longsword', 'Buckler', 'Cuirass', 'Boots', 'Helm']) {
    const row = page.locator('#enhanced-inventory .itemrow', { hasText: name }).first();
    if (await row.count()) {
      await row.click();
      const wear = page.locator('#enhanced-inventory .acts button', { hasText: 'Wear' });
      if (await wear.count()) await wear.click();
      await closeSheet(page);
    }
  }
  p = await pack(page);
  check(`${label}: wearing five things lights five nodes`, p.filled === 5 && p.worn === 5,
    `filled ${p.filled}, worn ${p.worn}`);
  const lit = await page.$$eval('#enhanced-inventory .node.filled circle', (ns) => ns.map((n) => ({
    r: n.getBoundingClientRect().width, fill: getComputedStyle(n).fill,
  })));
  const empty = await page.$$eval('#enhanced-inventory .node:not(.filled) circle',
    (ns) => ns[0] && { r: ns[0].getBoundingClientRect().width, fill: getComputedStyle(ns[0]).fill });
  check(`${label}: a filled node reads differently from an empty one`,
    lit.length > 0 && empty && lit[0].r > empty.r && lit[0].fill !== empty.fill,
    `filled ${lit[0]?.r.toFixed(1)}px ${lit[0]?.fill} vs empty ${empty?.r.toFixed(1)}px ${empty?.fill}`);

  // ── 5. WORN ITEMS LEAVE THE LIST (FilterLocalItems) ────────────
  const namesLeft = await page.$$eval('#enhanced-inventory .itemrow .itemname span',
    (ns) => ns.map((n) => n.textContent));
  check(`${label}: worn items are gone from the list, not badged in it`,
    !namesLeft.some((n) => ['Longsword', 'Buckler', 'Cuirass'].includes(n)),
    namesLeft.join(', '));

  // ── 6. CLICKING A NODE TAKES IT OFF ────────────────────────────
  await page.locator('#enhanced-inventory .node.filled').first().click();
  p = await pack(page);
  check(`${label}: clicking a filled node takes the item off`, p.filled === 4, `${p.filled} filled`);
  const back = await page.$$eval('#enhanced-inventory .itemrow .itemname span',
    (ns) => ns.map((n) => n.textContent));
  check(`${label}: ...and it comes back to the list`, back.length > namesLeft.length);

  // ── 7. A REFUSAL IS REPORTED, NEVER SWALLOWED ──────────────────
  await page.evaluate(() => {
    const d = globalThis.__ent.items.find((i) => i.name === 'Dagger');
    d.currentCondition = 0;
  });
  await page.locator('#enhanced-inventory .itemrow', { hasText: 'Dagger' }).first().click();
  await page.locator('#enhanced-inventory .acts button', { hasText: 'Wear' }).click();
  p = await pack(page);
  check(`${label}: a broken item refuses, and says so`,
    (p.notice ?? '').includes('broken'), p.notice ?? 'no notice');
  await closeSheet(page);   // the sheet covers the list while it is up, on purpose

  // ── 8. THE FOUR TAB PAGES ──────────────────────────────────────
  await page.locator('#enhanced-inventory .packtab', { hasText: 'Ingredients' }).click();
  check(`${label}: the tabs are DFU's four pages`,
    (await page.locator('#enhanced-inventory .packtab').count()) === 4);
  check(`${label}: ...and an empty page says so rather than looking broken`,
    (await page.locator('#enhanced-inventory .packempty').count()) >= 1);
  await page.locator('#enhanced-inventory .packtab', { hasText: 'Weapons' }).click();

  // ── 8b. USE ────────────────────────────────────────────────────
  // The law is systems/useItem.js's and is pinned there; what a
  // browser proves is that the button reaches it, that a host's hook
  // is actually called, and that the window is OUT of the host's one
  // overlay slot before the hook takes it (AUDIT B-C1).
  await page.evaluate(() => globalThis.__slot.dispose());
  const openUsePack = (kind) => page.evaluate(async (k) => {
    const { createInventoryWindow } = await import('/src/ui/inventoryDoor.js');
    const { ITEM_TEMPLATES } = await import('/src/characters/paperdoll.js');
    const { TEMPLATES } = await import('/src/systems/useItem.js');
    const t = (n) => ITEM_TEMPLATES.find((x) => x.name === n);
    const book = t('Book') ?? ITEM_TEMPLATES.find((x) => x.name?.includes('Book'));
    const e = { name: 'Aelwyn', career: { name: 'Spellsword' }, stats: { strength: 50, endurance: 48 }, items: [] };
    // A SPELLBOOK WITH NO SPELLS IN IT DOES NOT OPEN - useItem's
    // `noSpells` arm answers TEXT.RSC 12 instead, which is DFU's own
    // law and is what this probe hit first. To exercise the OPEN, the
    // character has to know something.
    if (k === 'spellbook') e.spells = [{ name: 'Fireball' }];
    e.items = k === 'spellbook'
      ? [{ name: 'Spellbook', templateIndex: TEMPLATES.Spellbook, group: 'MiscItems',
        stackCount: 1, currentCondition: 50, maxCondition: 50 }]
      : [{ name: book?.name ?? 'Book', templateIndex: book?.index ?? 0, group: 'Books',
        stackCount: 1, currentCondition: 50, maxCondition: 50, message: 1 }];
    globalThis.__log = [];
    globalThis.__ent = e;
    const where = (n) => `${n}:${document.getElementById('enhanced-inventory') ? 'window-up' : 'window-down'}`;
    globalThis.__slot = createInventoryWindow({
      entity: e, items: () => e.items, wagonItems: () => [],
      rows: () => [{ text: 'the rows the host reads' }],
      openBook: () => globalThis.__log.push(where('openBook')),
      openSpellbook: () => globalThis.__log.push(where('openSpellbook')),
    });
  }, kind);
  await openUsePack('book');
  // A BOOK IS NOT A WEAPON. filterByTab's default branch is the
  // CLOTHING page - DFU's fourth bucket is everything that is not a
  // weapon, not enchanted and not an ingredient - so the pack opens on
  // Weapons with nothing on it, correctly, and the probe goes to the
  // page the book is actually on.
  await page.waitForSelector('#enhanced-inventory .packtab', { timeout: 20000 });
  await page.locator('#enhanced-inventory .packtab', { hasText: 'Clothing' }).click();
  await page.waitForSelector('#enhanced-inventory .itemrow', { timeout: 20000 });
  await page.locator('#enhanced-inventory .itemrow').first().click();
  check(`${label}: every item offers Use, as the classic window's Use mode does`,
    (await page.locator('#enhanced-inventory .acts button', { hasText: 'Use' }).count()) === 1);
  await page.locator('#enhanced-inventory .acts button', { hasText: 'Use' }).click();
  const bookLog = await page.evaluate(() => globalThis.__log);
  check(`${label}: Use reached the host's own hook`, bookLog.some((l) => l.startsWith('openBook')),
    bookLog.join(',') || 'nothing');
  // THE TWO HAND-OFFS RUN IN OPPOSITE ORDERS, and this is where that
  // gets proven rather than asserted from a reading. The READER takes a
  // failure callback and reports on this window while it is still the
  // live overlay, so the book hands over with the window UP...
  check(`${label}: the book hands over while this window is still up`,
    bookLog.includes('openBook:window-up'), bookLog.join(','));
  check(`${label}: ...and the window is gone once the reader has it`,
    (await page.locator('#enhanced-inventory').count()) === 0);

  // ...and the SPELLBOOK has no callback, so it frees the slot first.
  await openUsePack('spellbook');
  await page.waitForSelector('#enhanced-inventory .packtab', { timeout: 20000 });
  await page.locator('#enhanced-inventory .packtab', { hasText: 'Magic' }).click();
  await page.locator('#enhanced-inventory .itemrow').first().click();
  await page.locator('#enhanced-inventory .acts button', { hasText: 'Use' }).click();
  const spellLog = await page.evaluate(() => globalThis.__log);
  check(`${label}: the spellbook frees the slot BEFORE the host takes it`,
    spellLog.includes('openSpellbook:window-down'), spellLog.join(',') || 'nothing');

  // put the ordinary pack back for the checks below
  await page.evaluate(() => globalThis.__slot?.dispose?.());
  await openPack(page);

  // ── 9. TARGETS AND REACH ───────────────────────────────────────
  const small = await page.$$eval('#enhanced-inventory button', (ns) => ns
    .map((n) => ({ t: (n.textContent ?? '').trim().slice(0, 18), r: n.getBoundingClientRect() }))
    .filter(({ r }) => r.height > 0 && r.height < 44).map(({ t, r }) => `${t}@${Math.round(r.height)}`));
  check(`${label}: every button target is 44px`, small.length === 0, small.join(', '));
  const off = await page.$$eval('#enhanced-inventory .packtab', (ns) => ns
    .filter((n) => { const r = n.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1; })
    .map((n) => n.textContent));
  check(`${label}: every tab is ON the screen`, off.length === 0, off.join(', '));

  // ── 10. THE KEY THAT OPENS IT CLOSES IT ─────────────────────────
  await page.keyboard.press('F6');
  await page.waitForSelector('#enhanced-inventory', { state: 'detached', timeout: 10000 });
  check(`${label}: F6 closes the pack, and did NOT reload the page`,
    (await page.evaluate(() => globalThis.__slot?.done)) === true
    && (await page.evaluate(() => !!globalThis.__ent)));

  check(`${label}: no page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await run('desktop', { viewport: { width: 1400, height: 900 } });
await run('phone', devices['Pixel 5']);

// ── THE BOUNDARY, AND THE CLASSIC SKIN ───────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await toGamePage(page);
  // U58: A LOOT PILE IS THE ENHANCED PANE NOW. U53 handed it to the
  // classic window and pinned that as a boundary; U56 and U57 moved
  // the law it was protecting, so the boundary went with it.
  const kind = await page.evaluate(async () => {
    const { createInventoryWindow } = await import('/src/ui/inventoryDoor.js');
    const w = createInventoryWindow({
      entity: { items: [], stats: {} }, items: () => [], wagonItems: () => [],
      loot: { items: () => [] },
    });
    await new Promise((r) => setTimeout(r, 400));
    const out = { name: w?.constructor?.name, dom: document.querySelectorAll('#enhanced-inventory').length };
    w.dispose();
    return out;
  });
  check('boundary: a loot pile opens the ENHANCED pane on the enhanced skin',
    kind.name !== 'NativeInventoryWindow', kind.name);
  check('boundary: and the pane really mounted', kind.dom === 1, `${kind.dom} mounted`);
  check('boundary: no page errors', errors.length === 0, errors.join(' | '));

  await page.goto(`${BASE}/play/?skin=classic`, { waitUntil: 'domcontentloaded' });
  const classic = await page.evaluate(async () => {
    const { createInventoryWindow } = await import('/src/ui/inventoryDoor.js');
    const w = createInventoryWindow({ entity: { items: [], stats: {} }, items: () => [], wagonItems: () => [] });
    return { name: w?.constructor?.name, dom: document.querySelectorAll('#enhanced-inventory').length };
  });
  check('classic: F6 still opens the canvas window', classic.name === 'NativeInventoryWindow', classic.name);
  check('classic: and no enhanced pack is mounted', classic.dom === 0);
  await ctx.close();
}

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} checks passed`);
process.exit(bad.length ? 1 : 0);
