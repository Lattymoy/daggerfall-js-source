// X2/X3 live probe: does exterior enemy ARCHERY and CASTING actually
// fire in a real browser? Spawns an Archer (141, a bow foe) and a
// Mage (128, a caster) through the world host's __spawnEncounter and
// watches the live pools: an enemy arrow record in flight, and a
// caster releasing (an engine missile, or the foe's magicka moving
// on a self/AoC release).
//
// Frame-synced (the process doctrine): SwiftShader crawls at a few
// fps with dt clamped at 0.1 - every wait below is in FRAMES via
// window.__frame.
//
// Usage: node tools/x23Probe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const server = await createServer({ server: { port: 5213, strictPort: true } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });
page.on('response', (r) => { if (r.status() === 404) errors.push(`[404] ${r.url()}`); });

await page.goto('http://localhost:5213/?world&nomenu&class=0&novideo&shot&play');
await page.waitForTimeout(Number(process.env.BOOT_WAIT ?? 15000));

const frame = () => page.evaluate(() => window.__frame ?? 0);
const waitFrames = async (n, cond = null, capMs = 240000) => {
  const f0 = await frame();
  const t0 = Date.now();
  for (;;) {
    if (Date.now() - t0 > capMs) return false;
    const f = await frame();
    if (cond) { const v = await cond(); if (v) return v; }
    else if (f - f0 >= n) return true;
    await page.waitForTimeout(400);
  }
};

// the world page needs its boot frames before the probe hooks exist
await waitFrames(5, async () => page.evaluate(() => !!window.__x23 && !!window.__spawnEncounter));
const x23 = async () => JSON.parse(await page.evaluate(() => window.__x23()));

let fails = 0;
const check = (ok, label) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`); if (!ok) fails++; };

// --- X2: the Archer ---
const archerType = await page.evaluate(() => window.__spawnEncounter(141, 15));
check(archerType === 141, `archer spawned (type ${archerType})`);
let s = await x23();
const archer = s.foes.find((f) => f.type === 141);
check(!!archer && archer.bow === true, `the archer ARMS as a bow foe (bow=${archer?.bow})`);

// wait for a live enemy arrow (the band roll + yaw turn take classic ticks)
const sawArrow = await waitFrames(0, async () => {
  const st = await x23();
  return st.enemyArrows > 0 ? st : null;
});
check(!!sawArrow, `an enemy arrow FLEW (enemyArrows=${sawArrow ? sawArrow.enemyArrows : 0})`);

// --- X3: the Mage ---
// the Mage's tier list (Ice Bolt 2 / Ice Storm 4) is ALL ranged - at
// melee it can never cast (faithful: DoTouchSpell picks 0/1 only).
// And DETECTION is faithful too: outside the 25-unit hearing radius
// an away-facing spawn never notices the player (the P13 stealth
// flow - the first probe draft spawned at 40 and the mage stood
// blind). Spawn INSIDE hearing (20) so detection fires, and watch
// the 20 -> 6 approach window (~86 classic ticks at 1/40).
const mageType = await page.evaluate(() => window.__spawnEncounter(128, 20));
check(mageType === 128, `mage spawned (type ${mageType})`);
s = await x23();
const mage = s.foes.find((f) => f.type === 128);
check(!!mage && mage.caster === true && mage.spells > 0,
  `the mage MINTS a caster with a spell list (caster=${mage?.caster}, spells=${mage?.spells})`);
const mp0 = mage?.mp ?? 0;

// a release shows as an engine missile OR the mage's magicka moving
// (self/AoC releases have no flight)
let retried = false;
const sawCast = await waitFrames(0, async () => {
  const st = await x23();
  const mages = st.foes.filter((f) => f.type === 128);
  if (!mages.length) return null;
  if (st.missiles > 0) return { via: 'missile', st };
  if (mages.some((m) => (m.mp ?? 0) < mp0)) return { via: 'magicka-spend', st };
  // the ~11% tail: a mage that reached melee undischarged can never
  // cast again (all-ranged list, faithful) - send one more through
  // the band
  if (!retried && mages.every((m) => m.dist < 7)) {
    retried = true;
    await page.evaluate(() => window.__spawnEncounter(128, 20));
  }
  return null;
});
if (!sawCast) {
  const st = await x23();
  console.log('  [diag] final state:', JSON.stringify(st.foes.find((f) => f.type === 128)), 'missiles:', st.missiles);
}
check(!!sawCast, `the mage RELEASED a cast (${sawCast ? sawCast.via : 'nothing in the window'})`);

// CURSOR.IMG is absent from this ARENA2 set and cursor.js degrades
// gracefully (its header: NEVER TRAPS) - the network 404 still logs,
// so that ONE known miss is filtered; anything else fails.
const realErrors = errors.filter((e) => !/CURSOR\.IMG|Failed to load resource/.test(e));
check(realErrors.length === 0, realErrors.length ? `page errors: ${realErrors.slice(0, 3).join(' | ')}` : 'zero page errors (the guarded CURSOR.IMG 404 filtered)');

await browser.close();
await server.close();
console.log(fails === 0 ? 'X2/X3 LIVE PROBE: ALL GREEN' : `X2/X3 LIVE PROBE: ${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
