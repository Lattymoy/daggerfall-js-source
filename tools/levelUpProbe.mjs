// LV1 — THE ASCENSION, IN A REAL BROWSER, WITH NO ARENA2.
//
// The claim a source sweep cannot make: the enhanced level-up window
// DRAWS, its stars spend the pool the law rolled, it refuses every way
// out while a point is unspent, and the commit that ends it moves the
// entity by exactly one level - in all three lanes, at four viewport
// sizes, by pointer and by keyboard alone.
//
// Run against a dev server (no game data needed):
//     npx vite --port 5199 &
//     node tools/levelUpProbe.mjs
//
// It drives levelup.html (src/tools/levelUpLab.js), which mounts the
// SHIPPING window over a made-up character. The window and both
// rollout laws under it are the game's own modules; only the entity is
// the lab's.
//
// IT MEASURES BOXES, NOT WORDS. The first run of this probe found the
// whole column sized at 1776px inside a 1400px window - the ribbon's
// min-content width had escaped its grid row - so the race cell and
// the Ascend button were both drawn past the right-hand edge. Every
// text assertion passed while that was true.
import { chromium } from 'playwright';

const BASE = process.env.PROBE_BASE ?? 'http://127.0.0.1:5199';
const shots = process.env.PROBE_SHOTS ?? '/tmp';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

const browser = await chromium.launch();

/** One page on the lab, with page errors collected. `lane` is the
 *  lab's own query door. */
async function open(lane, viewport) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/levelup.html?lane=${lane}`, { waitUntil: 'load' });
  await page.waitForSelector('.lv-star', { timeout: 20000 });
  await page.waitForTimeout(250);
  return { ctx, page, errors };
}

/** What the window is showing, off its own model seam - the reading
 *  the window paints from, not a re-parse of the pixels. */
const model = (page) => page.evaluate(() => globalThis.__lv.view.model());
const stats = (page) => page.evaluate(() => ({ ...globalThis.__lv.entity.stats }));
const entity = (page) => page.evaluate(() => {
  const e = globalThis.__lv.entity;
  return { level: e.level, maxHealth: e.maxHealth, ready: !!e.readyToLevelUp, oghma: !!e.oghmaLevelUp };
});

/** Every band, and the two controls a player must be able to reach. */
async function boxes(page) {
  return page.evaluate(() => {
    const r = (s) => { const n = document.querySelector(s); if (!n) return null; const b = n.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, r: b.right, b: b.bottom }; };
    const stars = [...document.querySelectorAll('.lv-star')].map((n) => { const b = n.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, r: b.right, b: b.bottom }; });
    return {
      vw: window.innerWidth, vh: window.innerHeight,
      crown: r('.lv-crown'), plate: r('.lv-plate'), figure: r('.lv-figure'),
      pick: r('.lv-pick'), ribbon: r('.lv-ribbonwrap'), foot: r('.lv-foot'),
      ok: r('.lv-ok'), plus: r('.lv-press:last-of-type'), stars,
      scrollW: document.documentElement.scrollWidth, scrollH: document.documentElement.scrollHeight,
    };
  });
}

// ── 1. THE WINDOW DRAWS, AND IT DRAWS THE LAW ────────────────────
{
  const { ctx, page, errors } = await open('classic', { width: 1400, height: 900 });
  const m = await model(page);
  check('classic: the window draws with no ARENA2', (await page.locator('.lv-star').count()) === 8, `${m.rows.length} rows`);
  check('classic: the pool is FormulaHelper.BonusPool, 4..6', m.pool >= 4 && m.pool <= 6, `pool ${m.pool}`);
  check('classic: no page errors', errors.length === 0, errors.join(' | '));
  check('classic: the crown names the level it is offering', m.crown.to === m.crown.from + 1, `${m.crown.from} -> ${m.crown.to}`);
  check('classic: the ribbon leads with a skill that actually rose', m.ribbon[0]?.risen === true, m.ribbon[0]?.name);
  // THE SUM'S OWN LAW, on screen: a primary counts, a misc does not.
  const primary = m.ribbon.find((s) => s.group === 'Primary');
  check('classic: a primary skill says it counts', /counts toward your next level/.test(primary?.note ?? ''), primary?.name);

  // ── 2. GEOMETRY ────────────────────────────────────────────────
  const b = await boxes(page);
  check('geometry: nothing is drawn past the right edge', b.scrollW <= b.vw + 1, `scrollW ${b.scrollW} vs ${b.vw}`);
  check('geometry: nothing is drawn past the bottom edge', b.scrollH <= b.vh + 1, `scrollH ${b.scrollH} vs ${b.vh}`);
  for (const [name, box] of Object.entries({ crown: b.crown, plate: b.plate, figure: b.figure, pick: b.pick, ribbon: b.ribbon, foot: b.foot, ok: b.ok })) {
    check(`geometry: ${name} is on screen`, box && box.x >= 0 && box.r <= b.vw + 1 && box.y >= 0 && box.b <= b.vh + 1,
      box ? `${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.w)}x${Math.round(box.h)}` : 'missing');
  }
  check('geometry: the Ascend button is a thumb target', b.ok.h >= 44, `${Math.round(b.ok.h)}px tall`);
  check('geometry: every star is a thumb target', b.stars.every((s) => s.h >= 44), b.stars.map((s) => Math.round(s.h)).join(','));
  // NO TWO STARS OVERLAP. The figure is authored in normalized
  // coordinates and stretched to the stage, so a short window is the
  // case that could collide them - and a star under another star is a
  // point spent on the wrong attribute.
  const overlap = b.stars.some((a, i) => b.stars.some((c, j) => j > i && a.x < c.r && c.x < a.r && a.y < c.b && c.y < a.b));
  check('geometry: no two stars overlap', !overlap);

  // ── 3. A CLICK SPENDS EXACTLY ONE POINT ───────────────────────
  const before = await model(page);
  await page.locator('.lv-star').nth(0).click();
  const after = await model(page);
  check('press: a click on a star spends one point', after.pool === before.pool - 1 && after.rows[0].delta === 1, `${before.pool} -> ${after.pool}`);
  check('press: and the star says so', (await page.locator('.lv-star.raised').count()) === 1);
  check('press: the stats are NOT written until the commit',
    (await stats(page)).strength === before.rows[0].base, 'the law writes at confirm, never at a press');
  await page.locator('.lv-press').first().click();   // the minus
  check('press: the minus takes it back', (await model(page)).pool === before.pool);

  // ── 4. EVERY WAY OUT IS REFUSED WHILE A POINT IS UNSPENT ──────
  // THE REFUSAL MUST BE REACHABLE. A `disabled` button cannot be
  // pressed, so its refusal can never be read - this probe's first run
  // timed out here against exactly that, which is how the not-yet
  // paint replaced the attribute.
  check('refuse: the Ascend button is pressable while it refuses',
    (await page.locator('.lv-ok').isEnabled()) && (await page.locator('.lv-ok.notyet').count()) === 1);
  check('refuse: ...and carries the reason before it is pressed',
    /distribute all bonus points/i.test((await page.getAttribute('.lv-ok', 'title')) ?? ''),
    await page.getAttribute('.lv-ok', 'title'));
  await page.locator('.lv-ok').click();
  check('refuse: Ascend with points left keeps the window up', (await page.locator('.lv-star').count()) === 8);
  check('refuse: ...and SAYS why', /distribute all bonus points/i.test((await page.textContent('.lv-refuse')) ?? ''),
    await page.textContent('.lv-refuse'));
  await page.keyboard.press('Escape');
  check('refuse: Escape is the same refusal, not an exit', (await page.locator('.lv-star').count()) === 8);
  await page.keyboard.press('Tab');
  check('refuse: PX28 Tab cannot put a level-up away', (await page.locator('.lv-star').count()) === 8);
  await page.keyboard.press('Tab');
  check('refuse: ...and Tab still cannot, twice (the registry put itself back)', (await page.locator('.lv-star').count()) === 8);

  await page.screenshot({ path: `${shots}/levelup-classic.png` });

  // ── 5. THE COMMIT ─────────────────────────────────────────────
  const start = await entity(page);
  const m2 = await model(page);
  const spend = m2.pool;
  for (let i = 0; i < spend; i++) await page.locator('.lv-star').nth(i % 8).click();
  const full = await model(page);
  check('commit: the pool spends to zero', full.pool === 0 && full.canAscend, `pool ${full.pool}`);
  check('commit: and the button stops saying not-yet', (await page.locator('.lv-ok.notyet').count()) === 0);
  check('commit: the deltas add up to the pool the law rolled',
    full.rows.reduce((a, r) => a + r.delta, 0) === spend, `${full.rows.map((r) => r.delta).join(',')} vs ${spend}`);
  await page.locator('.lv-ok').click();
  await page.waitForTimeout(150);
  const end = await entity(page);
  check('commit: the window is gone', (await page.locator('.lv-star').count()) === 0);
  check('commit: ONE level, never a jump', end.level === start.level + 1, `${start.level} -> ${end.level}`);
  check('commit: the health roll landed', end.maxHealth > start.maxHealth, `${start.maxHealth} -> ${end.maxHealth}`);
  check('commit: readyToLevelUp is cleared', end.ready === false);
  const st = await stats(page);
  check('commit: and the points are in the stats',
    Object.keys(st).reduce((a, k) => a + st[k], 0) === Object.values(m2.rows).reduce((a, r) => a + r.base, 0) + spend,
    JSON.stringify(st));
  await ctx.close();
}

// ── 6. THE OGHMA ARM PROMISES NO LEVEL ───────────────────────────
{
  const { ctx, page, errors } = await open('oghma', { width: 1400, height: 900 });
  const m = await model(page);
  check('oghma: the book’s pool is a fixed thirty', m.pool === 30, `pool ${m.pool}`);
  check('oghma: the crown does NOT promise a level', m.crown.to === m.crown.from && /Oghma/.test(await page.textContent('.lv-jump')));
  const start = await entity(page);
  for (let i = 0; i < 30; i++) await page.locator('.lv-star').nth(i % 8).click();
  check('oghma: thirty points spend', (await model(page)).pool === 0);
  await page.locator('.lv-ok').click();
  await page.waitForTimeout(150);
  const end = await entity(page);
  check('oghma: no Level++', end.level === start.level, `${start.level} -> ${end.level}`);
  check('oghma: no health roll', end.maxHealth === start.maxHealth);
  check('oghma: both flags clear together', end.ready === false && end.oghma === false);
  check('oghma: no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ── 7. THE MOD'S LANE, BY ITS OWN RULES ──────────────────────────
{
  const { ctx, page, errors } = await open('virtue', { width: 1400, height: 900 });
  const m = await model(page);
  check('virtue: the purse is counted in the mod’s own words', /virtue/i.test(m.poolLabel), m.poolLabel);
  check('virtue: the window is the mod’s lane', m.lane === 'virtue');
  // Luck is priced differently from the rest (attributeOffset), and the
  // window must say so rather than let a player discover it by pressing.
  const luck = m.rows.find((r) => r.key === 'luck');
  check('virtue: Luck carries its own price', luck.cost >= 1, `${luck.cost} per point`);
  await page.screenshot({ path: `${shots}/levelup-virtue.png` });
  // Spend the purse the way a player would - into the row the window
  // offers - until nothing is legal, then commit.
  for (let i = 0; i < 40; i++) {
    const cur = await model(page);
    if (cur.pool === 0) break;
    const row = cur.rows.find((r) => r.canRaise);
    if (!row) break;
    await page.locator('.lv-star').nth(row.index).click();
  }
  const spent = await model(page);
  check('virtue: the purse spends to zero under the mod’s caps', spent.pool === 0, `left ${spent.pool}`);
  const raised = spent.rows.filter((r) => r.delta > 0).length;
  check('virtue: at most the mod’s number of attributes moved', raised > 0 && raised <= 3, `${raised} attributes`);
  const start = await entity(page);
  await page.locator('.lv-ok').click();
  await page.waitForTimeout(150);
  const end = await entity(page);
  check('virtue: the commit is the mod’s commit', end.level === start.level + 1 && end.ready === false, `${start.level} -> ${end.level}`);
  check('virtue: no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ── 8. THE KEYBOARD ALONE ────────────────────────────────────────
{
  const { ctx, page } = await open('classic', { width: 1400, height: 900 });
  const m = await model(page);
  await page.keyboard.press('ArrowRight');
  check('keys: an arrow moves the focus', (await model(page)).focus !== m.focus);
  for (let i = 0; i < m.pool; i++) { await page.keyboard.press('Equal'); await page.keyboard.press('ArrowRight'); }
  check('keys: the pool spends from the keyboard', (await model(page)).pool === 0);
  await page.keyboard.press('ArrowDown');
  check('keys: up and down walk the ribbon', (await page.locator('.lv-sk.on').count()) === 1);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  check('keys: Enter commits when the pool is spent', (await page.locator('.lv-star').count()) === 0);
  await ctx.close();
}

// ── 9. THE SMALL SCREENS ─────────────────────────────────────────
for (const [label, viewport] of [
  ['phone', { width: 390, height: 844 }],
  ['short laptop', { width: 1024, height: 600 }],
  ['classic 4:3', { width: 800, height: 600 }],
]) {
  const { ctx, page, errors } = await open('classic', viewport);
  const b = await boxes(page);
  check(`${label}: no horizontal overflow`, b.scrollW <= b.vw + 1, `scrollW ${b.scrollW} vs ${b.vw}`);
  check(`${label}: no vertical overflow`, b.scrollH <= b.vh + 1, `scrollH ${b.scrollH} vs ${b.vh}`);
  check(`${label}: the Ascend button is on screen`, b.ok && b.ok.b <= b.vh + 1 && b.ok.r <= b.vw + 1,
    b.ok ? `${Math.round(b.ok.x)},${Math.round(b.ok.y)}` : 'missing');
  check(`${label}: the presses stay thumb-sized`, b.ok.h >= 44 && b.stars.every((s) => s.h >= 44));
  const overlap = b.stars.some((a, i) => b.stars.some((c, j) => j > i && a.x < c.r && c.x < a.r && a.y < c.b && c.y < a.b));
  check(`${label}: no two stars overlap`, !overlap);
  // A POINT STILL GOES IN. A screen that draws and cannot be used is
  // the failure this probe exists to catch on a phone.
  const before = await model(page);
  await page.locator('.lv-star').nth(3).click();
  check(`${label}: a star still takes a point`, (await model(page)).pool === before.pool - 1);
  check(`${label}: no page errors`, errors.length === 0, errors.join(' | '));
  await page.screenshot({ path: `${shots}/levelup-${label.replace(/\W+/g, '-')}.png` });
  await ctx.close();
}

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
