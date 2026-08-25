// X11a probe: the four newly-live effects, driven through the REAL
// dungeon host with real ARENA2 data.
//
// The V-lane lesson, again: the suite does not boot a host or draw a
// frame, and every bug this project has found by playing rather than
// by testing lived exactly in that gap. Four things here can only be
// checked in a live scene:
//   - the magic candle reaching the RENDERER's point-light array (the
//     effect landing is a unit test; the light arriving is not)
//   - the candle FOLLOWING the player as they turn and walk
//   - Disintegrate killing a real foe through the real damage door
//   - Spell Reflection bouncing a real foe's spell back at it
//
// Run: ARENA2_PATH=/path/to/arena2 node tools/x11Probe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';

const SHOTS = process.env.SHOTS || null;
const PORT = 5231;
const server = await createServer({
  root: '/home/user/project-dagger',
  server: { port: PORT, strictPort: true, hmr: false, watch: null },
});
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(m.text()); });
page.on('requestfailed', (r) => pageErrors.push(`requestfailed ${r.url()}`));
page.on('response', (r) => { if (r.status() >= 400) pageErrors.push(`HTTP ${r.status()} ${r.url()}`); });

const out = { steps: {}, failures: [] };
const check = (name, ok, detail) => {
  out.steps[name] = { ok, ...detail };
  if (!ok) out.failures.push(name);
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? `  ${JSON.stringify(detail)}` : ''}`);
};
const shot = async (name) => {
  if (!SHOTS) return;
  try { await page.screenshot({ path: `${SHOTS}/${name}.png`, timeout: 120000 }); }
  catch (e) { console.log(`  [note] screenshot ${name} timed out (${e.name})`); }
};
const frames = (n = 2) => page.evaluate((k) => new Promise((r) => {
  let i = 0;
  const step = () => (++i >= k ? r() : requestAnimationFrame(step));
  requestAnimationFrame(step);
}), n);

await page.goto(`http://localhost:${PORT}/?shot&class=0`);
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 240000 });

// The shipped maker builds every record, in the page, so the probe
// cannot drift from the real packing.
const mkSpell = (slots, rangeType) => page.evaluate(async ([s, rt]) => {
  const { buildCustomSpell, blankEffectSettings } = await import('/src/systems/spellMaker.js');
  return buildCustomSpell({
    slots: s.map((x) => ({ type: x.type, subType: x.subType, settings: { ...blankEffectSettings(), ...x.settings } })),
    rangeType: rt,
  });
}, [slots, rangeType]);

const candle = async () => JSON.parse(await page.evaluate(() => window.__candle()));
const kinds = () => page.evaluate(() => (window.__playerEntity.activeEffects ?? []).filter((a) => !a.ended).map((a) => a.kind));

// ---- Light: the candle reaches the shader --------------------------
{
  const dark = await candle();
  check('no Light cast, no candle', dark.light === null, { first: dark.first, lights: dark.count });
  await shot('01-unlit');

  const spell = await mkSpell([{ type: 15, subType: 255, settings: { durationBase: 40 } }], 0);
  await page.evaluate((sp) => window.__combat.applySpellToPlayer(sp, 5), spell);
  check('Light lands on the player', (await kinds()).includes('light'), { kinds: await kinds() });

  await frames(4);
  const lit = await candle();
  check('the host hangs a candle', lit.light !== null, { light: lit.light });
  // THE POINT: the host builds the array, but the RENDERER is what the
  // shader reads. An effect that lands and a light that draws are two
  // different claims and only one of them is unit-testable.
  const first = lit.first;
  check('and it reaches the renderer, FIRST in the array',
    // The tolerance is the WOBBLE, not slack: the host sets the light
    // array where it draws and the engine ticks the candle later in the
    // same frame, so the renderer holds the previous frame's jitter -
    // documented, and under 0.02 units at 60fps.
    lit.light !== null && Math.abs(first[0] - lit.light.x) < 0.05
      && Math.abs(first[1] - lit.light.y) < 0.05
      && Math.abs(first[2] - lit.light.z) < 0.05 && first[3] === 15,
    { first, light: lit.light });

  await shot('02-lit');
  // it must be roughly 1.4 units from the player, in front of them
  const geom = await page.evaluate(() => {
    const c = JSON.parse(window.__candle()).light;
    const p = window.__player.pos;
    return c ? { d: Math.hypot(c.x - p[0], c.z - p[2]), dy: c.y - p[1] } : null;
  });
  check('at DFU\'s own arm\'s length', geom && geom.d > 1.2 && geom.d < 1.6 && geom.dy > 0.3 && geom.dy < 0.6, geom);

  // AND IT FOLLOWS. A candle baked at the cast position would pass
  // every check above and be wrong the moment the player moved.
  const before = (await candle()).light;
  await page.evaluate(() => { const [x, y, z] = window.__player.pos; window.__player.warp(x + 4, y, z); });
  await frames(4);
  const after = (await candle()).light;
  check('the candle follows the player',
    before && after && Math.hypot(after.x - before.x, after.z - before.z) > 2,
    { moved: before && after ? Number(Math.hypot(after.x - before.x, after.z - before.z).toFixed(2)) : null });

  // and it goes out when the effect does
  await page.evaluate(() => { window.__playerEntity.activeEffects = []; });
  await frames(4);
  const outNow = await candle();
  check('and it goes out when the effect ends', outNow.light === null, { first: outNow.first });
}

// ---- Disintegrate: a real foe, through the real damage door --------
{
  const target = await page.evaluate(() => {
    const live = window.__liveFoeRecords() ?? [];
    if (!live.length) return null;
    const t = live[0];
    window.__player.warp(t.pos[0] + 2, t.pos[1] + 1, t.pos[2]);
    return { type: t.mobileType, health: t.ref.entity.health };
  });
  await frames(2);
  const before = JSON.parse(await page.evaluate(() => window.__foes())).filter((f) => !f.dead).length;
  const spell = await mkSpell([{ type: 5, subType: 255, settings: { chanceBase: 100 } }], 2);
  // The SAVE is a real second gate behind the chance one, and a monster
  // makes it roughly half the time - so one cast proves nothing either
  // way. Cast until it lands, and report how many saves it took: that
  // is the law working, not noise to be hidden. (The first run of this
  // probe asserted a single cast and failed on a made save, with
  // Disintegrate behaving perfectly.)
  const killed = await page.evaluate(async (sp) => {
    const live = window.__liveFoeRecords() ?? [];
    if (!live.length) return null;
    const rec = live[0].ref;
    const h0 = rec.entity.health;
    const out = { h0, casts: 0, saved: 0, disintegrated: 0, chanceFailed: 0 };
    for (let i = 0; i < 12 && !rec.dead; i++) {
      const r = window.__castAtFoe(sp, rec, { entity: window.__playerEntity });
      out.casts++;
      out.saved += r?.saved ?? 0;
      out.chanceFailed += r?.chanceFailed ?? 0;
      out.disintegrated += r?.disintegrated ?? 0;
    }
    out.h1 = rec.entity.health;
    out.dead = !!rec.dead;
    out.corpse = !!rec.corpseBatch;
    return out;
  }, spell);
  out.steps.disintegrateTarget = target;
  const after = JSON.parse(await page.evaluate(() => window.__foes())).filter((f) => !f.dead).length;
  check('Disintegrate kills a live foe outright, in ONE landed cast',
    killed && killed.dead === true && killed.h1 <= 0 && killed.disintegrated === 1
      && after === before - 1 && killed.chanceFailed === 0,
    { ...killed, before, after });
  // and it is a KILL, not a Destroy: the corpse is there to loot, which
  // is what separates this from X9's dispel. spawnCorpse AWAITS a
  // texture, so the corpse is not there on the frame of the kill - the
  // V4 lesson, and reading it synchronously is how a working port looks
  // broken.
  let corpse = false;
  for (let i = 0; i < 60 && !corpse; i++) {
    await frames(2);
    corpse = await page.evaluate(() => {
      const dead = JSON.parse(window.__foes()).filter((f) => f.dead);
      return dead.some((f) => f.corpse);
    });
  }
  check('and it leaves a corpse (a kill, not X9\'s Destroy)', corpse === true, { corpse });
}

// ---- Spell Reflection: a foe's spell comes back at it --------------
{
  const spell = await mkSpell([{ type: 21, subType: 255, settings: { durationBase: 40, chanceBase: 100 } }], 0);
  await page.evaluate((sp) => window.__combat.applySpellToPlayer(sp, 5), spell);
  check('Spell Reflection lands on the player', (await kinds()).includes('spellReflection'), { kinds: await kinds() });

  // A reflected bundle arrives at its caster and runs THEIR usual
  // processes - including the saving throw, which a monster makes
  // about half the time. So the claim is not "one cast, one wound":
  // it is that over N casts the PLAYER never bleeds and the FOE
  // sometimes does. Asserting a single cast would have been a coin
  // flip dressed as a test (the first run of this probe failed exactly
  // that way, with the reflection working perfectly).
  const bounced = await page.evaluate(async () => {
    const { buildCustomSpell, blankEffectSettings } = await import('/src/systems/spellMaker.js');
    const live = (window.__liveFoeRecords() ?? []);
    if (!live.length) return { skip: 'no foes' };
    const rec = live[0].ref;
    const hit = buildCustomSpell({
      slots: [{ type: 4, subType: 0, settings: { ...blankEffectSettings(), magnitudeBaseLow: 8, magnitudeBaseHigh: 8 } }],
      rangeType: 2,
    });
    const sinks = window.__foeSinksFor(rec);
    const out = { casts: 0, playerHurt: 0, foeHurt: 0, reflected: 0, foeDamage: 0 };
    for (let i = 0; i < 12; i++) {
      if (rec.dead || rec.entity.health <= 0) break;
      const php = window.__playerEntity.health;
      const fh = rec.entity.health;
      const r = window.__combat.applySpellToPlayer(hit, 5, { entity: rec.entity, sinks });
      out.casts++;
      out.reflected += r?.reflected ?? 0;
      if (window.__playerEntity.health < php) out.playerHurt++;
      if (rec.entity.health < fh) { out.foeHurt++; out.foeDamage += fh - rec.entity.health; }
    }
    return out;
  });
  check('every cast is reflected, and none of them touches the player',
    !bounced.skip && bounced.casts > 0 && bounced.reflected === bounced.casts && bounced.playerHurt === 0, bounced);
  check('and the damage lands on the FOE that cast it',
    !bounced.skip && bounced.foeHurt > 0 && bounced.foeDamage > 0, bounced);
}

// The data set on this machine has no CURSOR.IMG (it is not in the
// fetch-data diet), and src/ui/cursor.js is explicit that a missing one
// leaves the OS cursor in charge - "NEVER TRAPS". It is an environment
// fact, not a defect, so it is named rather than silently filtered.
const BENIGN_404 = /\/arena2\/CURSOR\.IMG|Failed to load resource/;
const realErrors = pageErrors.filter((e) => !BENIGN_404.test(e));
if (pageErrors.length !== realErrors.length) console.log('  [note] CURSOR.IMG is absent from this ARENA2 set; the OS cursor stands in (handled)');
check('zero page errors', realErrors.length === 0, { errors: realErrors.slice(0, 4) });

console.log('\n=================================================');
console.log(out.failures.length ? `X11 PROBE FAILURES: ${out.failures.join(', ')}` : 'X11 PROBE: all green');
await browser.close();
await server.close();
process.exit(out.failures.length ? 1 : 0);
