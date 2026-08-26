// U59 - THE AVATAR IN THE ENHANCED PACK, in a real browser.
//
// The pack showed what you CARRY and turned what you WEAR into
// twenty-seven 7px circles. This probe covers the two halves of the
// answer: the paperdoll panel, and the worn list that replaced the
// dots.
//
// WHAT IS SYNTHETIC AND WHAT IS NOT. There is no ARENA2 here, so the
// COMPOSITOR cannot run - `_setPaperDollPixelsForTests` stands up a
// finished buffer instead. That makes this a proof of the DOM PATH
// (composite -> data URL -> <img> -> the right pixels on screen) and
// NOT of PaperDollRenderer's layer order, dyes or offsets, which are
// pinned against real records in paperdoll.test.js under ARENA2_PATH.
// Said plainly because a probe that lies is worse than no probe.
//
// The one thing neither half proves is CLICKING THE DOLL to unequip:
// GetEquipIndex walks the compositor's real item layers, and a
// synthetic buffer has none. It is wired and it is unproven here.
//
//     npx vite --port 5199 &
//     node tools/enhancedDollProbe.mjs
import { chromium, devices } from 'playwright';

const BASE = process.env.PROBE_BASE ?? 'http://127.0.0.1:5199';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};
const browser = await chromium.launch();

/** main.js's failed boot assigns document.body.textContent, which
 *  removes every child of body. See enhancedPackProbe for the story. */
async function bootSettled(page) {
  await page.waitForFunction(
    () => document.body.textContent.includes('boot failed'), null, { timeout: 15000 },
  ).catch(() => { /* a successful boot never says it */ });
}

async function toGamePage(page) {
  await page.goto(`${BASE}/?skin=enhanced`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#enhanced-menu .railbtn', { timeout: 20000 });
  await page.locator('#enhanced-menu .railbtn', { hasText: 'New Game' }).first().click();
  await page.getByRole('button', { name: 'Begin', exact: true }).click();
  await page.waitForSelector('#enhanced-menu', { state: 'detached', timeout: 20000 });
  await bootSettled(page);
}

/** THE SYNTHETIC COMPOSITE: a red left half and a green right half at
 *  the panel's own 110x184. Two flat halves rather than a picture,
 *  because what has to be proven is that the buffer reaches the screen
 *  UNSCRAMBLED - a channel swap or a row-stride slip shows up as the
 *  wrong colour on the wrong side, and a pretty test image would hide
 *  both. */
async function openPack(page, { doll = true } = {}) {
  await page.evaluate(async (withDoll) => {
    const { createInventoryWindow } = await import('/src/ui/inventoryDoor.js');
    const { ITEM_TEMPLATES } = await import('/src/characters/paperdoll.js');
    const pd = await import('/src/ui/paperDoll.js');
    if (withDoll) {
      const W = 110, H = 184;
      const px = new Uint8Array(W * H * 4);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const o = (y * W + x) * 4;
          const left = x < W / 2;
          px[o] = left ? 220 : 0;
          px[o + 1] = left ? 0 : 200;
          px[o + 2] = 0;
          px[o + 3] = 255;
        }
      }
      pd._setPaperDollPixelsForTests(px, W, H);
    } else {
      pd._setPaperDollPixelsForTests(null);
    }
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
    e.items = [mk('Longsword'), mk('Dagger'), mk('Cuirass', 'Armor'), mk('Helm', 'Armor'),
      mk('Boots', 'Armor')].filter(Boolean);
    globalThis.__ent = e;
    globalThis.__slot = createInventoryWindow({ entity: e, items: () => e.items, wagonItems: () => [] });
  }, doll);
  await page.waitForSelector('#enhanced-inventory .wornrow', { timeout: 20000 });
}

const pack = (page) => page.evaluate(() => JSON.parse(globalThis.__pack()));
const localRow = (page, name) =>
  page.locator('#enhanced-inventory .packcol:not(.packremote) .itemrow', { hasText: name }).first();
const act = (page, label) =>
  page.locator('#enhanced-inventory .acts button', { hasText: label }).first();
async function closeSheet(page) {
  const lid = page.locator('#enhanced-inventory .packdetail .sheet-close');
  if (await lid.isVisible()) await lid.click();
}
async function wear(page, name) {
  await localRow(page, name).click();
  const w = act(page, 'Wear');
  if (await w.count()) await w.click();
  await closeSheet(page);
}

async function run(label, opts) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await toGamePage(page);
  await openPack(page, { doll: true });

  // ── 1. THE COMPOSITE REACHES THE SCREEN, UNSCRAMBLED ───────────
  let p = await pack(page);
  check(`${label}: the panel draws the DOLL when there are pixels`, p.figure === 'doll', p.figure);
  const img = page.locator('#enhanced-inventory .figure-doll img');
  const shot = await img.screenshot();
  const px = await page.evaluate(async (b64) => {
    const im = new Image();
    im.src = `data:image/png;base64,${b64}`;
    await im.decode();
    const c = document.createElement('canvas');
    c.width = im.width; c.height = im.height;
    const g = c.getContext('2d');
    g.drawImage(im, 0, 0);
    const at = (fx, fy) => [...g.getImageData(Math.floor(im.width * fx), Math.floor(im.height * fy), 1, 1).data];
    return { w: im.width, h: im.height, left: at(0.25, 0.5), right: at(0.75, 0.5) };
  }, shot.toString('base64'));
  // RED left, GREEN right - a channel swap or a stride slip fails here
  check(`${label}: the left half is the RED the buffer put there`,
    px.left[0] > 180 && px.left[1] < 60, JSON.stringify(px.left));
  check(`${label}: the right half is the GREEN`,
    px.right[1] > 160 && px.right[0] < 60, JSON.stringify(px.right));
  // ...and it is drawn at the panel's 110:184 aspect, not squashed
  const box = await img.boundingBox();
  const aspect = box.width / box.height;
  check(`${label}: the avatar keeps its 110x184 aspect`,
    Math.abs(aspect - 110 / 184) < 0.02, `${box.width.toFixed(0)}x${box.height.toFixed(0)} = ${aspect.toFixed(3)}`);
  check(`${label}: and it is ON the screen`,
    box.y >= 0 && box.y < (opts.viewport?.height ?? 900), `y=${box.y.toFixed(0)}`);

  // ── 2. THE WORN LIST IS A LIST, NOT DOTS ───────────────────────
  check(`${label}: every slot has a row`, p.wornRows === 25,
    `${p.wornRows} rows (25 = 27 slots less DFU's two unnamed)`);
  check(`${label}: and nothing is worn yet`, p.wornFilled === 0, `${p.wornFilled} filled`);
  await wear(page, 'Helm');
  await wear(page, 'Cuirass');
  await wear(page, 'Boots');
  p = await pack(page);
  check(`${label}: wearing three things NAMES them in the list`,
    p.wornFilled === 3 && p.wornNames.includes('Helm') && p.wornNames.includes('Cuirass'),
    p.wornNames.join(', '));
  // the ORDER is the body's - the helm reads above the boots
  check(`${label}: the list runs head to feet`,
    p.wornNames.indexOf('Helm') < p.wornNames.indexOf('Boots'), p.wornNames.join(' -> '));
  // and worn items are GONE from the pack list (FilterLocalItems)
  const inPack = await page.$$eval('#enhanced-inventory .packcol:not(.packremote) .itemrow .itemname span',
    (ns) => ns.map((n) => n.textContent));
  check(`${label}: ...and out of the pack list, where DFU puts them`,
    !inPack.includes('Helm'), inPack.join(', '));

  // ── 3. A ROW SELECTS; THE DETAIL TAKES IT OFF ──────────────────
  // The slot map's node unequipped on the spot. A named row has a
  // panel behind it, so a mis-click costs nothing.
  await page.locator('#enhanced-inventory .wornrow', { hasText: 'Cuirass' }).first().click();
  check(`${label}: a worn row opens the item, it does not undress you`,
    (await pack(page)).wornFilled === 3);
  check(`${label}: the detail offers Take off`, (await act(page, 'Take off').count()) === 1);
  // ...and NOT a way to drop it: filterByTab means DFU's Remove click
  // can never reach an equipped item
  for (const verb of ['Drop', 'Stow in wagon', 'Put back']) {
    check(`${label}: a worn item offers no "${verb}"`, (await act(page, verb).count()) === 0);
  }
  await act(page, 'Take off').click();
  await closeSheet(page);
  p = await pack(page);
  check(`${label}: Take off empties the slot`, p.wornFilled === 2, `${p.wornFilled} filled`);
  check(`${label}: ...and the item is back in the pack`,
    (await localRow(page, 'Cuirass').count()) === 1);

  // ── 4. EVERY TOUCH TARGET IS A TARGET ──────────────────────────
  // An empty slot is NOT a control, so it must not be a button: the
  // first draft disabled twenty-two 24px buttons and the pack probe
  // failed on exactly this.
  const tags = await page.$$eval('#enhanced-inventory .wornrow.wornempty', (ns) => ns.map((n) => n.tagName));
  check(`${label}: empty slots are not buttons`,
    tags.length > 0 && tags.every((t) => t !== 'BUTTON'), `${tags.length} rows, ${[...new Set(tags)].join('/')}`);
  const small = await page.$$eval('#enhanced-inventory .wornrow button, #enhanced-inventory button.wornrow',
    (ns) => ns.filter((n) => n.getBoundingClientRect().height < 44).length);
  check(`${label}: and every real one is 44px`, small === 0, `${small} under`);

  check(`${label}: no page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

/** NO DOLL, WHICH IS EVERY BUILD WITHOUT ARENA2. The schematic is the
 *  fallback precisely because it needs no game data - a player with
 *  none still gets a picture of their kit. */
async function runFallback() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await toGamePage(page);
  await openPack(page, { doll: false });
  const p = await pack(page);
  check('fallback: no composite means the SCHEMATIC', p.figure === 'schematic', p.figure);
  check('fallback: and no broken image in its place',
    (await page.locator('#enhanced-inventory .figure-doll').count()) === 0);
  check('fallback: the worn list is there either way', p.wornRows === 25, `${p.wornRows} rows`);
  check('fallback: the schematic still draws its nodes', p.nodes === 25, `${p.nodes} nodes`);
  check('fallback: no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await run('desktop', { viewport: { width: 1440, height: 900 } });
await run('phone', { ...devices['Pixel 5'] });
await runFallback();

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} checks passed`);
console.log('NOTE: the composite here is SYNTHETIC. The layer order, dyes and offsets');
console.log('      of the real paperdoll are pinned in paperdoll.test.js under ARENA2_PATH,');
console.log('      and clicking the doll to unequip needs a real compose - it is wired');
console.log('      and NOT proven here.');
process.exit(bad.length ? 1 : 0);
