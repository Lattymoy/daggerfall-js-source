// MAC-M2 - THE BODY'S DRAG AND THE LOOT BAR, in a real browser.
//
// Its own probe rather than a block inside tools/enhancedPackProbe.mjs,
// because that one still hunts the `.node` dots PX19e retired (25 of
// them; the map has been eleven `.wornrow` family panels since) and
// dies on a timeout before it reaches anything this slice touched. The
// dots were gone long before MAC-M2 - recorded here, not repaired here.
//
// What only a browser can answer: whether a real mouse pressed on a
// real slot panel and dragged to the dock carries a ghost, reads the
// right verb over each region, and actually takes the piece off - and
// what the loot session's bar draws when the pane is really mounted.
//
//     npx vite --port 5199 &
//     node tools/macM2Probe.mjs
import { chromium } from 'playwright';

const BASE = process.env.PROBE_BASE ?? 'http://127.0.0.1:5199';
const out = [];
const check = (name, ok, detail = '') => {
  out.push(ok);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};
const browser = await chromium.launch();

async function bootSettled(page) {
  await page.waitForFunction(
    () => document.body.textContent.includes('boot failed'), null, { timeout: 15000 },
  ).catch(() => {});
}

async function toGamePage(page) {
  await page.goto(`${BASE}/play/?skin=enhanced`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#enhanced-menu .doorbtn', { timeout: 20000 });
  await page.locator('#enhanced-menu .doorbtn.door-new').first().click();
  await page.getByRole('button', { name: 'Begin', exact: true }).click();
  await page.waitForSelector('#enhanced-menu', { state: 'detached', timeout: 20000 });
  await bootSettled(page);
}

/** `wear` names a template to put on the body before the window opens;
 *  `loot` mints a container so the pane opens in LOOT mode. */
async function openPack(page, { wear = null, loot = false } = {}) {
  await page.evaluate(async ({ wear: w, loot: l }) => {
    const { createInventoryWindow } = await import('/src/ui/inventoryDoor.js');
    const { ITEM_TEMPLATES } = await import('/src/characters/paperdoll.js');
    const { equipItem } = await import('/src/systems/equip.js');
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
    e.items = [mk('Longsword'), mk('Dagger'), mk('Cuirass', 'Armor'),
      { name: 'Gold Pieces', templateIndex: 276, group: 'Currency', stackCount: 1287 }].filter(Boolean);
    if (w) equipItem(e, e.items.find((it) => it.name === w));
    globalThis.__ent = e;
    const pile = [mk('Dagger')];
    globalThis.__slot = createInventoryWindow({
      entity: e, items: () => e.items, wagonItems: () => [],
      ...(l ? { loot: { items: () => pile } } : {}),
    });
  }, { wear, loot });
  await page.waitForSelector('#enhanced-inventory .itemrow', { timeout: 20000 });
}

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await toGamePage(page);

// ── A: THE BODY DRAGS ────────────────────────────────────────────
await openPack(page, { wear: 'Cuirass' });
const panel = page.locator('#enhanced-inventory .wornrow:not(.wornempty)').first();
check('A: a filled slot panel is on the map', (await panel.count()) === 1);
const from = await panel.boundingBox();
const dock = await page.locator('#enhanced-inventory .pack-dock').boundingBox();
check('A: the pack dock is on screen', !!dock);

await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
await page.mouse.down();
await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2 + 20, { steps: 4 });
const ghost = page.locator('body > .dragghost');
check('A: the hold really carries the worn piece - a ghost on the BODY',
  (await ghost.count()) === 1);
// still over the MAP: the cancel gesture, so the ghost promises nothing
check('A: over the body it promises nothing - a release there is the cancel',
  (await ghost.locator('.ghostact').textContent()) === '',
  JSON.stringify(await ghost.locator('.ghostact').textContent()));

await page.mouse.move(dock.x + dock.width / 2, dock.y + dock.height / 2, { steps: 8 });
check('A: over the dock it says what the release will do',
  (await ghost.locator('.ghostact').textContent()) === 'Take off',
  JSON.stringify(await ghost.locator('.ghostact').textContent()));
check('A: the dock lights as the one target',
  await page.locator('#enhanced-inventory .pack-dock.dragover').count() === 1);
await page.mouse.up();
check('A: the ghost is gone on release', (await ghost.count()) === 0);
const afterDrag = await page.evaluate(() => ({
  worn: !!globalThis.__ent.items.find((i) => i.name === 'Cuirass')?.equipSlot,
  held: globalThis.__ent.items.some((i) => i.name === 'Cuirass'),
  rows: [...document.querySelectorAll('#enhanced-inventory .itemrow .itemname span')].map((n) => n.textContent),
}));
check('A: the piece came OFF', afterDrag.worn === false);
check('A: and is in the bag, not on the floor', afterDrag.held === true);
// the ARMOUR page, because a cuirass is not a weapon and the tab does
// not follow a take-off (only a take does - PX31)
const armourRows = await page.evaluate(() => {
  [...document.querySelectorAll('#enhanced-inventory .packtab')]
    .find((b) => b.textContent.startsWith('Armor') || b.textContent.startsWith('Armour'))?.click();
  return [...document.querySelectorAll('#enhanced-inventory .itemrow .itemname span')].map((n) => n.textContent);
});
check('A: so the pack list shows it again', armourRows.includes('Cuirass'),
  armourRows.join(', ') || afterDrag.rows.join(', '));
await page.evaluate(() => globalThis.__slot.dispose());

// ── A2: THE PLAIN CLICK IS UNTOUCHED ─────────────────────────────
await openPack(page, { wear: 'Cuirass' });
await page.locator('#enhanced-inventory .wornrow:not(.wornempty)').first().click();
check('A2: a plain click raises the card',
  (await page.locator('#enhanced-inventory .packtip').count()) === 1);
check('A2: and takes nothing off by itself',
  await page.evaluate(() => !!globalThis.__ent.items.find((i) => i.name === 'Cuirass')?.equipSlot));
await page.locator('#enhanced-inventory .packtip .act.primary').click();
check('A2: the card’s Take off still works',
  await page.evaluate(() => !globalThis.__ent.items.find((i) => i.name === 'Cuirass')?.equipSlot));
await page.evaluate(() => globalThis.__slot.dispose());

// ── B: THE LOOT BAR ──────────────────────────────────────────────
await openPack(page, { loot: true });
const bar = await page.$$eval('#enhanced-inventory .remoteacts .act', (ns) => ns.map((n) => n.textContent));
check('B: the loot frame is the only window', await page.locator('#enhanced-inventory .pack-win').count() === 0);
check('B: and its bar carries no Gold and no Pack', bar.length === 0, JSON.stringify(bar));
await page.evaluate(() => globalThis.__slot.dispose());

// ── B2: THE NORMAL PACK KEEPS GOLD ───────────────────────────────
await openPack(page);
const row = page.locator('#enhanced-inventory .itemrow').first();
const rb = await row.boundingBox();
await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2);
await page.mouse.down();
await page.mouse.move(20, 20, { steps: 8 });   // off the panel: a ground drop
await page.mouse.up();
const bar2 = await page.$$eval('#enhanced-inventory .remoteacts .act', (ns) => ns.map((n) => n.textContent));
check('B2: the normal pack’s ground frame still carries Gold', bar2.includes('Gold'), JSON.stringify(bar2));
check('B2: and never a Pack button', !bar2.includes('Pack'), JSON.stringify(bar2));

check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
const bad = out.filter((x) => !x).length;
console.log(`\n${out.length - bad}/${out.length} checks passed`);
process.exit(bad ? 1 : 0);
