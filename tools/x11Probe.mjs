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

await page.goto(`http://localhost:${PORT}/play/?shot&class=0`);
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
    // same frame, so the renderer holds the PREVIOUS frame's jitter.
    // At 60fps that is ~0.02 units; under swiftshader a frame can eat a
    // whole leg of the lerp, so the bound is the jitter sphere's own
    // diameter (2 * 0.125) - which still pins the identity, because
    // nothing else in the array is within 25cm of the player's hand at
    // range exactly 15.
    lit.light !== null && first[3] === 15
      && Math.hypot(first[0] - lit.light.x, first[1] - lit.light.y, first[2] - lit.light.z) <= 0.25 + 1e-6,
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
// ---- X11b: Create Item, end to end in a live dungeon ---------------
{
  const spell = await mkSpell([{ type: 2, subType: 255, settings: { durationBase: 30 } }], 0);
  const before = await page.evaluate(() => (window.__playerEntity.items ?? []).length);
  await page.evaluate((sp) => window.__combat.applySpellToPlayer(sp, 5), spell);
  await frames(4);
  await shot('03-create-item-picker');
  const overlay = await page.evaluate(() => window.__overlay());
  check('casting Create Item opens the picker', /ListPicker/i.test(overlay ?? ''), { overlay: overlay?.slice(0, 90) });
  // AllowCancel is false: the magicka is spent, so Escape must not work
  await page.evaluate(() => window.__overlayKey('Escape'));
  await frames(2);
  const afterEsc = await page.evaluate(() => window.__overlay());
  check('and the picker refuses to be cancelled', /ListPicker/i.test(afterEsc ?? ''), { overlay: afterEsc?.slice(0, 90) });
  // pick the Steel Longsword (row 23)
  const made = await page.evaluate(async () => {
    const o = window.__overlayWindow();
    o.selectedIndex = 23;
    window.__overlayKey('Enter');
    const items = window.__playerEntity.items ?? [];
    const it = items[items.length - 1];
    return { overlay: window.__overlay(), n: items.length, name: it?.name, exp: it?.timeForItemToDisappear };
  });
  check('picking a row closes the picker and bags the item',
    made.overlay === null && made.n === before + 1 && made.name === 'Longsword', { ...made, before });
  check('and it carries a lifetime, so it reads as conjured', made.exp > 0, { exp: made.exp });

  // AND IT VANISHES. The live per-minute tick is what removes it, so
  // this runs the REAL clock forward rather than calling the sweep.
  const vanished = await page.evaluate(async ([expiry]) => {
    const wt = await import('/src/systems/worldTick.js');
    const before2 = (window.__playerEntity.items ?? []).length;
    const clock0 = wt.worldMinutes();
    // Push the world clock past the item's expiry, the way a rest or a
    // journey does. The sweep still needs the host's own tick to cross
    // a MINUTE afterwards - it lives inside DFU's `lastGameMinutes !=
    // gameMinutes` block - and at 12x that takes up to five real
    // seconds, so this polls rather than guessing a delay.
    wt.setWorldMinutes(expiry + 5);
    const t0 = performance.now();
    let after = before2;
    while (performance.now() - t0 < 20000) {
      await new Promise((r) => requestAnimationFrame(r));
      after = (window.__playerEntity.items ?? []).length;
      if (after < before2) break;
    }
    return { before2, after, clock0, clockNow: Math.floor(wt.worldMinutes()), waited: Math.round(performance.now() - t0) };
  }, [made.exp]);
  check('and the per-minute tick sweeps it away when its time is up',
    vanished.after === vanished.before2 - 1, vanished);
}

// ---- T1: the torch, in the dungeon it exists to light ---------------
{
  const before = await page.evaluate(() => JSON.parse(window.__candle()).count);
  const lit = await page.evaluate(async () => {
    const st = await import('/src/systems/settings.js');
    const ui = await import('/src/systems/useItem.js');
    const pt = await import('/src/systems/playerTorch.js');
    // the SHIPPED setting, the SHIPPED use door
    st.setValue('Enhancements', 'PlayerTorchFromItems', 'True');
    const e = window.__playerEntity;
    const torch = { group: 'UselessItems2', templateIndex: 247, name: 'Torch', currentCondition: 4, maxCondition: 50 };
    (e.items ??= []).push(torch);
    const r = ui.useItem(torch, e.items, { entity: e });
    return { kind: r.kind, text: r.text, slot: e.lightSource === torch, range: pt.torchRange(torch) };
  });
  check('using a torch lights it', lit.kind === 'lit' && lit.slot === true, lit);
  await frames(4);
  const inArray = await page.evaluate(() => {
    const c = JSON.parse(window.__candle());
    const p = window.__player.pos;
    // the torch's vec4 is the one at the player's own hand
    const near = [];
    for (let i = 0; i < c.count; i++) near.push(c.all.slice(i * 4, i * 4 + 4));
    const hit = near.find((v) => Math.hypot(v[0] - p[0], v[1] - (p[1] + 1.2), v[2] - p[2]) < 0.6);
    return { count: c.count, hit, feet: p.map((n) => Number(n.toFixed(2))) };
  });
  check('and the torch reaches the renderer, at the player\'s hand, at the template radius',
    !!inArray.hit && Math.abs(inArray.hit[3] - 14) < 1e-3, inArray);
  // THE CAMERA HAS TO BE WHERE THE PLAYER IS. Earlier steps warped the
  // player onto a foe forty units away while the fly-cam stayed at the
  // start - so a screenshot taken here showed an unlit corridor the
  // torch was nowhere near, which reads exactly like a broken torch.
  // The numeric check above is the proof; this makes the picture agree
  // with it.
  await page.evaluate(() => {
    const e = window.__player.eye;
    window.__pose(e[0], e[1], e[2], 0, 0);
  });
  await frames(3);
  await shot('04-torch-lit');
  await page.evaluate(async () => {
    const st = await import('/src/systems/settings.js');
    st.setValue('Enhancements', 'PlayerTorchFromItems', 'False');
    window.__playerEntity.lightSource = null;
  });
  await frames(3);
  await shot('05-torch-doused');
  await page.evaluate(async () => {
    const st = await import('/src/systems/settings.js');
    st.setValue('Enhancements', 'PlayerTorchFromItems', 'True');
    const e = window.__playerEntity;
    e.lightSource = (e.items ?? []).find((i) => i.templateIndex === 247) ?? null;
  });
  await frames(3);
  // it BURNS. 20 real seconds per point, and this torch has 4.
  const burned = await page.evaluate(async () => {
    const e = window.__playerEntity;
    const t0 = performance.now();
    const start = e.lightSource?.currentCondition ?? -1;
    // The host clamps its frame delta at 0.1s (dungeon.js:349), and
    // under swiftshader a frame takes far longer than that - so the
    // torch burns in CLAMPED frame time, roughly a third of the wall
    // clock here. That is the host's own guard, not the torch's, and
    // every other dt-driven law in this host lives with it; the probe
    // simply waits long enough rather than pretending otherwise.
    while (performance.now() - t0 < 150000 && (e.lightSource?.currentCondition ?? -1) === start) {
      await new Promise((r) => requestAnimationFrame(r));
    }
    return { start, now: e.lightSource?.currentCondition ?? null, waited: Math.round(performance.now() - t0),
      state: e._torch ? { buf: Number(e._torch.tickTimeBuffer.toFixed(2)), range: Number((e._torch.range ?? 0).toFixed(2)) } : null };
  });
  check('and it burns a point of fuel on the wall clock', burned.now === burned.start - 1, burned);
  await page.evaluate(async () => {
    const st = await import('/src/systems/settings.js');
    st.setValue('Enhancements', 'PlayerTorchFromItems', 'False');
  });
}

check('zero page errors', realErrors.length === 0, { errors: realErrors.slice(0, 4) });

console.log('\n=================================================');
console.log(out.failures.length ? `X11 PROBE FAILURES: ${out.failures.join(', ')}` : 'X11 PROBE: all green');
await browser.close();
await server.close();
process.exit(out.failures.length ? 1 : 0);
