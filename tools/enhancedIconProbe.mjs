// U54 - A TEXTURE RECORD ALL THE WAY TO AN <img>, WITH NO ARENA2.
//
// The pack draws real item icons now, and the chain behind that is
// five links: getBytes fetches TEXTURE.###, TextureFile parses it,
// getDFBitmap decodes a record, bitmapCanvas paints it, and
// toDataURL hands the DOM something an <img> can carry. Four of those
// five are already proven elsewhere - TextureFile against the real
// corpus, bitmapCanvas by the chargen faces since U50 - and the new
// link is ui/textureCanvas.js, the middle.
//
// THIS CONTAINER HAS NO GAME DATA, so the archive is SYNTHETIC: a
// valid, minimal, uncompressed TEXTURE file built here to the format
// the reader parses, served by intercepting the fetch. That is the
// same device the chargen tests use ("synthetic pickers so it is
// provable with no game data") and it touches no ARENA2 content - it
// proves the PLUMBING, which is what this slice added.
//
// WHAT IT DOES NOT PROVE, and cannot here: that a REAL archive record
// decodes to the right picture. That needs a run with ARENA2_PATH set
// and eyes on the screen. Stated rather than implied.
//
//     npx vite --port 5199 &
//     node tools/enhancedIconProbe.mjs
import { chromium } from 'playwright';

const BASE = process.env.PROBE_BASE ?? 'http://127.0.0.1:5199';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

const W = 8, H = 8, STRIDE = 256;

/** A 768-byte ART_PAL: index i is a flat grey ramp, except index 1,
 *  which is a colour distinctive enough to find in the output. */
function synthPalette() {
  const b = Buffer.alloc(768);
  for (let i = 0; i < 256; i++) { b[i * 3] = i; b[i * 3 + 1] = i; b[i * 3 + 2] = i; }
  b[3] = 200; b[4] = 40; b[5] = 30;   // index 1 = a red nobody could mistake for grey
  return b;
}

/** A minimal uncompressed TEXTURE archive with `count` identical
 *  records, each an 8x8 image whose left half is palette index 1 and
 *  whose right half is index 0 - the CUTOUT, so the transparency law
 *  is exercised too. Built to formats/textureFile.js's own reader:
 *  16-bit record count, a 24-byte description, 20-byte record headers
 *  from offset 26, then 28-byte record bodies with their rows on a
 *  fixed 256-byte stride. */
function synthArchive(count) {
  const bodySize = 28 + H * STRIDE;
  const headersEnd = 26 + 20 * count;
  const buf = Buffer.alloc(headersEnd + bodySize * count);
  buf.writeInt16LE(count, 0);
  buf.write('SYNTHETIC', 2, 'ascii');
  for (let r = 0; r < count; r++) {
    const bodyAt = headersEnd + bodySize * r;
    const hAt = 26 + 20 * r;
    buf.writeInt16LE(0, hAt);              // type1
    buf.writeInt32LE(bodyAt, hAt + 2);     // recordPosition
    buf.writeInt16LE(0, hAt + 6);          // type2
    buf.writeInt32LE(0, hAt + 8);          // unknown1
    buf.writeInt16LE(0, bodyAt);           // offsetX
    buf.writeInt16LE(0, bodyAt + 2);       // offsetY
    buf.writeInt16LE(W, bodyAt + 4);
    buf.writeInt16LE(H, bodyAt + 6);
    buf.writeInt16LE(0, bodyAt + 8);       // compression: Uncompressed
    buf.writeUInt32LE(bodySize - 28, bodyAt + 10);   // recordSize
    buf.writeUInt32LE(28, bodyAt + 14);              // dataOffset, from the body
    buf.writeInt16LE(1, bodyAt + 18);      // isNormal
    buf.writeUInt16LE(1, bodyAt + 20);     // frameCount
    for (let y = 0; y < H; y++) {
      const row = bodyAt + 28 + y * STRIDE;
      for (let x = 0; x < W; x++) buf[row + x] = x < W / 2 ? 1 : 0;
    }
  }
  return buf;
}

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

const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

// COUNT THE FETCHES. The cache's whole job is that a repainting screen
// asks once, and a MISS is remembered as a miss.
const fetched = [];
await page.route('**/arena2/**', async (route) => {
  const url = route.request().url();
  const name = url.split('/').pop();
  fetched.push(name);
  if (name === 'ART_PAL.COL') return route.fulfill({ status: 200, body: synthPalette() });
  if (/^TEXTURE\.\d+$/.test(name)) return route.fulfill({ status: 200, body: synthArchive(64) });
  return route.fulfill({ status: 404, body: '' });
});

await page.goto(`${BASE}/?skin=enhanced`, { waitUntil: 'networkidle' });
await page.waitForSelector('#enhanced-menu .railbtn', { timeout: 20000 });
await page.locator('#enhanced-menu .railbtn', { hasText: 'New Game' }).first().click();
await page.getByRole('button', { name: 'Begin', exact: true }).click();
await page.waitForSelector('#enhanced-menu', { state: 'detached', timeout: 20000 });
await bootSettled(page);

// ── 1. THE MIDDLE LINK, ON ITS OWN ─────────────────────────────────
const one = await page.evaluate(async () => {
  const { loadIcon } = await import('/src/ui/textureCanvas.js');
  const url = await loadIcon(234, 3, { scale: 1 });
  if (!url) return { url: null };
  // read the pixels back, which is the only way to know the cutout
  // and the palette survived the trip
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const cx = c.getContext('2d');
  cx.drawImage(img, 0, 0);
  const d = cx.getImageData(0, 0, img.width, img.height).data;
  return {
    url, w: img.width, h: img.height,
    left: [d[0], d[1], d[2], d[3]],
    right: [d[(img.width - 1) * 4], d[(img.width - 1) * 4 + 1],
      d[(img.width - 1) * 4 + 2], d[(img.width - 1) * 4 + 3]],
  };
});
check('a record becomes a data URL', (one.url ?? '').startsWith('data:image/png;base64,'),
  (one.url ?? 'null').slice(0, 30));
check('...at the record\'s own size', one.w === 8 && one.h === 8, `${one.w}x${one.h}`);
check('...with the palette colour on the painted half',
  JSON.stringify(one.left) === JSON.stringify([200, 40, 30, 255]), JSON.stringify(one.left));
check('...and index 0 TRANSPARENT, which is the port\'s cutout law',
  one.right?.[3] === 0, `alpha ${one.right?.[3]}`);

// ── 2. THE CACHE ───────────────────────────────────────────────────
const mark = fetched.length;
await page.evaluate(async () => {
  const { loadIcon } = await import('/src/ui/textureCanvas.js');
  for (let i = 0; i < 8; i++) await loadIcon(234, i, { scale: 1 });
});
const since = fetched.slice(mark);
check('eight more records from that archive cost NO further fetch',
  since.length === 0, since.join(', ') || 'none');
// The whole-session ART_PAL count is not this module's to hold -
// scenes/world.js fetches it for the renderer's own palette, so a
// session count measures other people's work. What is pinned is that
// this module's own repeats are free, which the window above shows.
check('...and one archive was fetched in total, for the first call',
  fetched.filter((n) => /^TEXTURE/.test(n)).length === 1,
  fetched.filter((n) => /^TEXTURE/.test(n)).join(', '));

// ── 3. A RECORD PAST THE END IS A MISS, NOT A THROW ────────────────
const past = await page.evaluate(async () => {
  const { loadIcon } = await import('/src/ui/textureCanvas.js');
  return await loadIcon(234, 9999, { scale: 1 });
});
check('a record past the end of the archive answers null', past === null, String(past));

// ── 4. THE PACK SHOWS THE REAL THING ───────────────────────────────
const addr = await page.evaluate(async () => {
  const { createInventoryWindow } = await import('/src/ui/inventoryDoor.js');
  const { ITEM_TEMPLATES } = await import('/src/characters/paperdoll.js');
  const { inventoryItemImage } = await import('/src/systems/itemTemplates.js');
  const t = (n) => ITEM_TEMPLATES.find((x) => x.name === n);
  const mk = (n, g = 'Weapons') => {
    const tp = t(n);
    return tp && { name: tp.name, templateIndex: tp.index, group: g, stackCount: 1,
      currentCondition: tp.hitPoints ?? 50, maxCondition: tp.hitPoints ?? 50 };
  };
  const e = { name: 'Aelwyn', career: { name: 'Spellsword' }, stats: { strength: 50, endurance: 48 }, items: [] };
  e.items = [mk('Longsword'), mk('Dagger'), mk('Buckler', 'Armor')].filter(Boolean);
  globalThis.__ent = e;
  globalThis.__slot = createInventoryWindow({ entity: e, items: () => e.items, wagonItems: () => [] });
  return inventoryItemImage(e.items[0], e);
});
await page.waitForSelector('#enhanced-inventory .itemrow', { timeout: 20000 });
await page.waitForSelector('#enhanced-inventory .tile.has-icon img', { timeout: 20000 });
const tiles = await page.$$eval('#enhanced-inventory .tile', (ns) => ns.map((n) => ({
  icon: !!n.querySelector('img'), src: n.querySelector('img')?.src ?? '',
  text: n.textContent.trim(),
})));
check('every row draws its picture rather than its initials',
  tiles.length > 0 && tiles.every((t) => t.icon && t.src.startsWith('data:image/png')),
  tiles.map((t) => (t.icon ? 'img' : t.text)).join(', '));
check('the address came from inventoryItemImage',
  Number.isInteger(addr?.archive) && Number.isInteger(addr?.record),
  JSON.stringify(addr));

// ── THE REPAINT MUST SETTLE ────────────────────────────────────────
// Every cold icon repaints the screen when it lands, which is what
// makes the letters give way to the picture. A cache that forgot an
// in-flight record would ask again on that repaint, land again, and
// repaint again - a loop running at whatever rate a decode takes,
// invisible except as a hot fan. So: let it settle, then prove it HAS.
const settled = await page.evaluate(() => JSON.parse(globalThis.__pack()).repaints);
await page.waitForTimeout(1200);
const later = await page.evaluate(() => JSON.parse(globalThis.__pack()).repaints);
check('the screen stops repainting once its icons have landed',
  later === settled, `${settled} -> ${later}`);
// THE COUNT IS THE PIN, not just the stability. Three items means
// about three landings plus the mount; a cache that forgot its
// in-flight records decodes each icon once per repaint until the
// first lands and the count DOUBLES - which is what it measured at
// before the marker existed, and the only way that waste is visible.
check('...and each icon was decoded once, not once per repaint',
  settled <= 5, `${settled} repaints for 3 items`);

// the detail draws it larger
await page.locator('#enhanced-inventory .itemrow').first().click();
check('the detail draws it larger', (await page.locator('#enhanced-inventory .bigicon img').count()) === 1);
check('...and drops the address note, which was the no-picture explanation',
  (await page.locator('#enhanced-inventory .iconnote').count()) === 0);

check('no page errors', errors.length === 0, errors.join(' | '));
await ctx.close();

// ── 5. NO DATA AT ALL: THE INITIALS COME BACK ──────────────────────
{
  const c2 = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const p2 = await c2.newPage();
  const errs2 = [];
  p2.on('pageerror', (e) => errs2.push(e.message));
  await p2.route('**/arena2/**', (route) => route.fulfill({ status: 404, body: '' }));
  await p2.goto(`${BASE}/?skin=enhanced`, { waitUntil: 'networkidle' });
  await p2.waitForSelector('#enhanced-menu .railbtn', { timeout: 20000 });
  await p2.locator('#enhanced-menu .railbtn', { hasText: 'New Game' }).first().click();
  await p2.getByRole('button', { name: 'Begin', exact: true }).click();
  await p2.waitForSelector('#enhanced-menu', { state: 'detached', timeout: 20000 });
  await bootSettled(p2);
  await p2.evaluate(async () => {
    const { createInventoryWindow } = await import('/src/ui/inventoryDoor.js');
    const { ITEM_TEMPLATES } = await import('/src/characters/paperdoll.js');
    const tp = ITEM_TEMPLATES.find((x) => x.name === 'Longsword');
    const e = { name: 'A', career: { name: 'Spellsword' }, stats: { strength: 50, endurance: 48 },
      items: [{ name: tp.name, templateIndex: tp.index, group: 'Weapons', stackCount: 1,
        currentCondition: 50, maxCondition: 50 }] };
    globalThis.__slot = createInventoryWindow({ entity: e, items: () => e.items, wagonItems: () => [] });
  });
  await p2.waitForSelector('#enhanced-inventory .itemrow', { timeout: 20000 });
  await p2.waitForTimeout(600);
  const fallback = await p2.$$eval('#enhanced-inventory .tile', (ns) => ns.map((n) => ({
    icon: !!n.querySelector('img'), text: n.textContent.trim(), title: n.title,
  })));
  check('with no ARENA2 the tile falls back to initials, and does not blank',
    fallback.length > 0 && fallback.every((t) => !t.icon && t.text.length > 0),
    JSON.stringify(fallback[0]));
  check('...and the tile still names the record it wants',
    (fallback[0]?.title ?? '').includes('TEXTURE.'), fallback[0]?.title ?? '');
  await p2.locator('#enhanced-inventory .itemrow').first().click();
  check('...and the detail explains the absence instead of showing a gap',
    (await p2.locator('#enhanced-inventory .iconnote').count()) === 1);
  check('no page errors with no data', errs2.length === 0, errs2.join(' | '));
  await c2.close();
}

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} checks passed`);
console.log('NOTE: the archive here is SYNTHETIC. That a real ARENA2 record decodes to the');
console.log('      right picture needs a run with ARENA2_PATH set - it is not proven here.');
process.exit(bad.length ? 1 : 0);
