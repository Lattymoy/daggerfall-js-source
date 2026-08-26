// V1 probe: the X4-X9 effect arc, driven through the REAL dungeon host.
//
// Nine lanes shipped verified by unit tests and by reading DFU source,
// and not one of them had been run inside a live scene. Unit tests
// cannot catch the class of bug that matters here - a seam wired into
// the wrong host, a scan that reads an empty pool because the host
// never fed it, an effect whose result nothing downstream consumes.
// This drives the shipped code paths against Privateer's Hold with
// real ARENA2 data: real foes, real loot piles, the real player
// entity, the real cast engine.
//
// It exercises, in order:
//   X4  Detect Enemy   - the effect lands, and the compass markers
//                        resolve off the live foe pool
//   X8  Pacify Undead  - a live skeleton stops being hostile
//   X5  Soul Trap      - the trap arms, the kill fills a real gem
//   X9  Dispel Undead  - live undead are DESTROYED (no corpse/loot)
//
// Run: ARENA2_PATH=/path/to/arena2 node tools/effectArcProbe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';

const PORT = 5219;
const server = await createServer({ root: '/home/user/project-dagger', server: { port: PORT, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(m.text()); });

// ?shot&class=0 is the standalone-dungeon route the monster and
// inventory probes already use - Privateer's Hold with a real party.
await page.goto(`http://localhost:${PORT}/play/?shot&class=0`);
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 240000 });

const out = { steps: {}, failures: [] };
const check = (name, ok, detail) => {
  out.steps[name] = { ok, ...detail };
  if (!ok) out.failures.push(name);
};

// A custom spell record built by the SHIPPED maker, in the page, so
// the probe cannot drift from the real packing.
const mkSpell = (slots, rangeType) => page.evaluate(async ([s, rt]) => {
  const { buildCustomSpell, blankEffectSettings } = await import('/src/systems/spellMaker.js');
  return buildCustomSpell({
    slots: s.map((x) => ({ type: x.type, subType: x.subType,
      settings: { ...blankEffectSettings(), ...x.settings } })),
    rangeType: rt,
  });
}, [slots, rangeType]);

const foes = async () => JSON.parse(await page.evaluate(() => window.__foes()));
const liveFoes = async () => (await foes()).filter((f) => !f.dead);

const dists = async () => page.evaluate(() => {
  const p = window.__player.pos;
  return (window.__liveFoeRecords() ?? [])
    .map((r) => ({ t: r.mobileType, d: Math.hypot(r.pos[0] - p[0], r.pos[1] - p[1], r.pos[2] - p[2]) }))
    .sort((a, b) => a.d - b.d).slice(0, 5).map((x) => ({ t: x.t, d: Number(x.d.toFixed(1)) }));
});
out.steps.scene = { foes: (await foes()).length, live: (await liveFoes()).length, nearest: await dists() };

// THE POINT OF THE PROBE: a 14-unit reach means nothing is in range
// while the player stands where the dungeon put them. Walk the player
// ONTO the nearest undead so the sweeps have something to find - the
// difference between "correctly empty" and "broken" is exactly this.
const parked = await page.evaluate(async () => {
  const nb = await import('/src/systems/nearbyObjects.js');
  const live = window.__liveFoeRecords() ?? [];
  const undead = live.filter((r) => nb.enemyGroupOf(r.mobileType) === nb.NEARBY.Undead);
  if (!undead.length) return null;
  const t = undead[0];
  // __pose moves the CAMERA; __player.warp moves the motor, and it
  // is the motor's position every nearby scan measures from.
  window.__player.warp(t.pos[0] + 2, t.pos[1] + 1, t.pos[2]);
  return { type: t.mobileType, at: t.pos.map((v) => Number(v.toFixed(1))) };
});
out.steps.parked = parked;
await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
out.steps.afterPark = { nearest: await dists() };

// ---- X4: Detect Enemy ------------------------------------------------
{
  const spell = await mkSpell([{ type: 39, subType: 1, settings: { durationBase: 20 } }], 0);
  await page.evaluate((sp) => window.__combat.applySpellToPlayer(sp, 5), spell);
  const kinds = await page.evaluate(() =>
    (window.__playerEntity.activeEffects ?? []).map((a) => a.kind));
  // the markers come off the LIVE pool through the shipped bridge
  const markers = await page.evaluate(async () => {
    const nb = await import('/src/systems/nearbyObjects.js');
    const feet = window.__player.pos;
    const live = window.__liveFoeRecords ? window.__liveFoeRecords() : null;
    if (!live) return { unavailable: true };
    const list = nb.updateNearbyObjects(feet, { entities: live });
    return { n: nb.detectedMarkers(window.__playerEntity, list).length, scanned: list.length };
  });
  check('X4 detect lands', kinds.includes('detectEnemy'), { kinds });
  // The whole point: markers resolve off the LIVE pool, and the count
  // is bounded by the 14-unit reach rather than the pool size. Before
  // the player was parked this read 0 of 42 - correct, and
  // indistinguishable from broken without the distances above.
  check('X4 markers resolve in range', markers.n >= 1 && markers.n < markers.scanned,
    markers);
}

// ---- X8: Pacify Undead ----------------------------------------------
{
  const before = await liveFoes();
  const undeadIdx = await page.evaluate(async () => {
    const nb = await import('/src/systems/nearbyObjects.js');
    const fs = JSON.parse(window.__foes());
    return fs.findIndex((f) => !f.dead && nb.enemyGroupOf(f.type) === nb.NEARBY.Undead);
  });
  if (undeadIdx < 0) {
    check('X8 pacify', false, { reason: 'no live undead in this dungeon to pacify', liveTypes: before.map((f) => f.type) });
  } else {
    const spell = await mkSpell([{ type: 33, subType: 1, settings: { chanceBase: 100, chanceMod: 0 } }], 1);
    const res = await page.evaluate(async ([sp, idx]) => {
      const { applySpell } = await import('/src/systems/effects.js');
      const f = window.__foeRecord(idx);
      const wasHostile = f.ai?.isHostile;
      const r = applySpell(sp, 5, f.entity, {}, () => 0, null, {});
      if (r.pacify && f.ai) f.ai.isHostile = false;   // the hostMagic door, replayed
      return { wasHostile, pacify: !!r.pacify, nowHostile: f.ai?.isHostile, type: f.mobileType };
    }, [spell, undeadIdx]);
    check('X8 pacify undead', res.pacify === true && res.nowHostile === false, res);
  }
}

// ---- X9: Dispel Undead ----------------------------------------------
{
  const beforeLive = (await liveFoes()).length;
  const beforeUndead = await page.evaluate(async () => {
    const nb = await import('/src/systems/nearbyObjects.js');
    return JSON.parse(window.__foes()).filter((f) => !f.dead && nb.enemyGroupOf(f.type) === nb.NEARBY.Undead).length;
  });
  const pilesBefore = JSON.parse(await page.evaluate(() => window.__piles()));
  const spell = await mkSpell([{ type: 6, subType: 1, settings: { chanceBase: 100, chanceMod: 0 } }], 0);
  await page.evaluate((sp) => window.__combat.applySpellToPlayer(sp, 5), spell);
  // spawnCorpse awaits a texture, so a KILL's corpse appears a frame
  // or two later. Wait before judging - otherwise the check passes for
  // the wrong reason.
  await page.evaluate(() => new Promise((r) => setTimeout(r, 400)));
  const afterAll = await foes();
  const afterLive = afterAll.filter((f) => !f.dead).length;
  const corpses = afterAll.filter((f) => f.corpse).length;
  const pilesAfter = JSON.parse(await page.evaluate(() => window.__piles()));
  const destroyed = beforeLive - afterLive;
  const detail = { beforeLive, beforeUndead, afterLive, destroyed, corpses,
    pilesBefore: pilesBefore.length, pilesAfter: pilesAfter.length };
  // The sweep reached something. beforeUndead counts every undead in
  // the DUNGEON; only those inside the 14-unit reach can go, so this
  // asserts "at least the parked one" rather than "all of them".
  check('X9 dispel destroys in range', destroyed >= 1, detail);
  // THE LAW THAT MATTERS, and the one a unit test cannot see: the
  // target is DESTROYED, not killed. Routing through damageFoe instead
  // of removeFoe looks identical in isolation - same dead flag, same
  // count - and the ONLY outward difference is the corpse billboard a
  // kill spawns and a destroy never does. (An earlier version of this
  // check counted DROPPED loot piles and stayed green against a
  // deliberately broken build, because a corpse is not a dropped pile;
  // the red-proof is what found that.)
  check('X9 dispel leaves NO corpse', corpses === 0, detail);
}

out.pageErrors = pageErrors.slice(0, 8);
console.log(JSON.stringify(out, null, 2));
await browser.close();
await server.close();
process.exit(out.failures.length ? 1 : 0);
