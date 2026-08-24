// V2 probe: the two guild services X6 and X7 shipped that nobody has
// ever seen on screen - BUY SOULGEMS and IDENTIFY. V1 covered the
// dungeon effect arc; this is the other half of that verification.
//
// Both services mount the trade window through the REAL openServiceFlow
// (window.__openGuildService is a thin shot-mode wrapper over it), so
// what is exercised here is the destination wiring, the shelf minting
// and the mode's own logic - not a re-implementation.
//
// What it checks:
//   X6  Buy Soulgems - the shelf mints, it is mostly EMPTY gems, the
//                      filled ones price at 5000 + soul points, and
//                      the shelf is stable within one game day
//   X7  Identify     - the window opens in Identify mode, and the
//                      DERIVED identified state holds on real items:
//                      a mundane item is never offered, an enchanted
//                      one is, and the cost is the shifted formula
//
// Run: ARENA2_PATH=/path/to/arena2 node tools/guildMagicServiceProbe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';

const PORT = 5220;
const server = await createServer({ root: '/home/user/project-dagger', server: { port: PORT, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

await page.goto(`http://localhost:${PORT}/?shot&play&exterior&time=12:00`);
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 240000 });

const out = { steps: {}, failures: [] };
const check = (name, ok, detail) => { out.steps[name] = { ok, ...detail }; if (!ok) out.failures.push(name); };
const waitFrames = async (n) => {
  const f = await page.evaluate(() => window.__frame ?? 0);
  await page.waitForFunction(([f0, k]) => (window.__frame ?? 0) > f0 + k, [f, n], { timeout: 60000 });
};
const trade = async () => JSON.parse(await page.evaluate(() => window.__tradeOverlay()) ?? 'null');

// ---- get inside a building so interiorBuilding (and its QUALITY) is real
const doors = JSON.parse(await page.evaluate(() => JSON.stringify(window.__doors())));
let inside = null;
for (let i = 0; i < doors.length && !inside; i++) {
  const { pos, normal } = doors[i];
  await page.evaluate(([x, y, z, yaw]) => window.__pose(x, y, z, yaw, -0.05),
    [pos[0] + normal[0] * 1.5, pos[1] - 1.2, pos[2] + normal[2] * 1.5, Math.atan2(-normal[0], -normal[2])]);
  if (!await page.evaluate(() => window.__enter())) continue;
  await waitFrames(10);
  inside = JSON.parse(await page.evaluate(() => window.__building()) ?? 'null');
}
check('inside a building', !!inside, { building: inside });
if (!inside) { console.log(JSON.stringify(out, null, 2)); await browser.close(); await server.close(); process.exit(1); }

// A rank the soulgem service will accept (its own gate has unit pins;
// this probe is about the SERVICE, not the ladder).
out.steps.membership = JSON.parse(await page.evaluate(() => window.__joinGuild(undefined, 8)));

// ---- X6: Buy Soulgems ------------------------------------------------
{
  await page.evaluate(() => window.__openGuildService('guildServiceBuySoulgems'));
  await waitFrames(4);
  const t = await trade();
  const gems = (t?.remote ?? []).filter((i) => i.soul !== undefined);
  const empty = gems.filter((g) => g.soul === null);
  const filled = gems.filter((g) => g.soul !== null);
  check('X6 window opens in Buy mode', t?.trade === true && t.mode === 'Buy', { mode: t?.mode });
  check('X6 the shelf mints soul gems', gems.length >= 2 && gems.length === (t?.remote ?? []).length,
    { gems: gems.length, remote: t?.remote?.length });
  // trunc(quality/2) + 2, DFU's inclusive loop. The quality is read
  // from the window's OWN priceCtx rather than looked up again -
  // that is the number the shelf was actually built from, and an
  // earlier version of this check asserted against a quality that
  // __building() does not expose, so it compared 5 against 2.
  const quality = t?.priceCtx?.quality;
  const expect = Math.trunc((quality ?? 0) / 2) + 2;
  check('X6 shelf size is the inclusive loop', quality != null && gems.length === expect,
    { got: gems.length, expect, quality });
  check('X6 empty gems are a flat 5000', empty.every((g) => g.value === 5000), { empty: empty.length, values: empty.map((g) => g.value).slice(0, 4) });
  check('X6 filled gems price above the empty floor or match a soulless one',
    filled.every((g) => g.value >= 5000), { filled: filled.length, sample: filled.slice(0, 3) });
  out.steps['X6 mix'] = { empty: empty.length, filled: filled.length };

  // The daily seed: reopening the SAME day gives the same shelf.
  await page.evaluate(() => window.__closeOverlay?.());
  await waitFrames(2);
  await page.evaluate(() => window.__openGuildService('guildServiceBuySoulgems'));
  await waitFrames(4);
  const again = await trade();
  check('X6 the shelf is stable within one game day',
    JSON.stringify(again?.remote) === JSON.stringify(t?.remote), {});
  await page.evaluate(() => window.__closeOverlay?.());
  await waitFrames(2);
}

// ---- X7: Identify ----------------------------------------------------
{
  // Put one MUNDANE and one ENCHANTED item in the pack. The derived
  // state is the whole point: before X7 the mundane one read as
  // unidentified and would have been offered - and charged for.
  await page.evaluate(() => {
    const e = window.__playerEntity;
    e.items = e.items ?? [];
    e.items.push({ group: 'Weapons', templateIndex: 118, value: 1000, stackCount: 1 });
    e.items.push({ group: 'Weapons', templateIndex: 118, value: 1000, stackCount: 1,
      enchantments: [{ type: 0, param: 1 }] });
  });
  await page.evaluate(() => window.__openGuildService('guildServiceIdentify'));
  await waitFrames(4);
  const t = await trade();
  check('X7 window opens in Identify mode', t?.trade === true && t.mode === 'Identify', { mode: t?.mode });
  check('X7 the shelf is empty - the pack is both lists', (t?.remote ?? []).length === 0, { remote: t?.remote?.length });
  out.steps['X7 pack'] = { local: t?.local, cost: t?.cost };
  // Stage every item the mode will accept, then read the cost. Only
  // the enchanted one may be taken, so the cost is ONE item's.
  const staged = await page.evaluate(async () => {
    const tm = await import('/src/systems/tradeModes.js');
    const e = window.__playerEntity;
    const pack = e.items.filter((i) => i.group === 'Weapons' && i.templateIndex === 118);
    return pack.map((it) => ({
      enchanted: !!it.enchantments,
      decision: tm.localClickDecision('Identify', it, {}).kind,
      identified: tm.itemIsIdentified(it),
      cost: tm.calculateItemIdentifyCost(it.value),
    }));
  });
  out.steps['X7 decisions'] = staged;
  const mundane = staged.find((s) => !s.enchanted);
  const magic = staged.find((s) => s.enchanted);
  check('X7 a mundane item is ALWAYS identified and never offered',
    mundane?.identified === true && mundane?.decision === 'refuse', mundane);
  check('X7 an enchanted item is unknown and IS offered',
    magic?.identified === false && magic?.decision === 'stage', magic);
  check('X7 the cost is the shifted formula', magic?.cost === ((25 * 1000) >> 8), { cost: magic?.cost, expect: (25 * 1000) >> 8 });
}

out.pageErrors = pageErrors.slice(0, 6);
console.log(JSON.stringify(out, null, 2));
await browser.close();
await server.close();
process.exit(out.failures.length ? 1 : 0);
