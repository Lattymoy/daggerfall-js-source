// COMBAT-FEEL (2026-10-17, the owner: "Improve and polish combat and visuals"; bible/03-World/Naval-Refit.md COMBAT-FEEL)
// - the sea fight felt at my rail: gun smoke carried by the air (systems/naval/navalEffects.js SMOKE-WIND), a ball's
// fall a spout grown for the eye far off (SPLASH-SPOUT), a near fall drenching her and a near pass whistling
// (systems/naval/navalShots.js NEAR-MISS, scenes/naval/navalFeel.js DRENCH), the side a blow came from on her plate and
// her hull bar's loss (HULL-BLOW), a burning ship's magazine as she founders and the air boiling up off her (MAGAZINE,
// FOUNDER-BOIL), my battered boat's smoke in a fight (MY-SMOKE), her card's men and my volley's count of them
// (CARD-CREW), and each battery's seconds to load (RELOAD-SECS) - the law, the module and the real naval host over the
// real pool (test/navalSea.mjs). tools/mutants/combatfeel.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createNavalEffects, WIND_MPS, GUN_SMOKE_LIFE, GUN_SMOKE_SWELL, SPOUT_UP, DRENCH_N, BOIL_RATE } from '../../../src/systems/naval/navalEffects.js';
import { createShotField, NEAR_MISS_M, boxGap, segmentNearBox } from '../../../src/systems/naval/navalShots.js';
import {
  createNavalFeel, blowSide, magazineOf, seedShare, deckLine, NEAR_SPLASH_M, NEAR_SHAKE, BLOW_S, MAGAZINE_CHANCE, MAGAZINE_DELAY, MAGAZINE_SHAKE_M, MAGAZINE_SHAKE, MY_SMOKE_FROM,
} from '../../../src/scenes/naval/navalFeel.js';
import { NAVAL_SFX, navalSoundRange } from '../../../src/systems/naval/navalSounds.js';
import { HULL } from '../../../src/systems/naval/navalShips.js';
import { navalHudText, drawNavalHud } from '../../../src/ui/naval/navalHud.js';
import { sea, knowAll } from '../../navalSea.mjs';
import { hullBoxOf } from '../../../src/scenes/naval/navalHost.js';
import { quatAngleAxis } from '../../../src/world/quat.js';

const seeded = (seed = 1) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} ~ ${b}`);
const of = (fx, kind) => fx.drawList().filter((p) => p.kind === kind);
const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

// ── the smoke, the splash, the founder ─────────────────────────────────────────────────────────────────────────────

test('COMBAT-FEEL SMOKE-WIND gun smoke is carried by the air: it slows from the muzzle to the WIND\'s speed (Come Sail Away\'s strength at WIND_MPS a unit) and goes downwind, whatever way it left; a broadside\'s smoke hangs GUN_SMOKE_LIFE and swells to GUN_SMOKE_SWELL, a hit\'s puff stays short; nothing else rides the wind (mutants: dragged to rest, the wind\'s speed unscaled, the hang dropped)', () => {
  assert.deepEqual([WIND_MPS, GUN_SMOKE_LIFE, GUN_SMOKE_SWELL], [4, [9, 14], [6, 10]]);
  const fx = createNavalEffects({ random: () => 0.5, wind: () => [1.5, 0, 0] });
  fx.smoke([0, 0, 0], [-1, 0, 0], 1, 1);   // out of a muzzle facing upwind
  fx.timber([0, 0, 0], 1);
  const plank = of(fx, 'timber')[0].pos[0];
  for (let i = 0; i < 60; i++) fx.step(0.1);
  const p = fx.drawList().find((x) => x.kind === 'smoke');
  const before = p.pos[0];
  fx.step(0.1);
  near((fx.drawList().find((x) => x.kind === 'smoke').pos[0] - before) / 0.1, 1.5 * WIND_MPS, 0.15, 'the wind\'s own speed, downwind');
  assert.ok(Math.abs(of(fx, 'timber')[0].pos[0] - plank) < 2, 'a plank afloat is not blown along');
  const calm = createNavalEffects({ random: () => 0.5 });
  calm.smoke([0, 0, 0], [1, 0, 0], 1, 1);
  for (let i = 0; i < 60; i++) calm.step(0.1);
  const c0 = calm.drawList()[0].pos[0];
  calm.step(0.1);
  near((calm.drawList()[0].pos[0] - c0) / 0.1, 0, 0.01, 'in a calm it hangs');
  // a broadside's smoke against a hit's puff
  const gun = createNavalEffects({ random: () => 0.5 });
  gun.muzzle([0, 0, 0], [1, 0, 0], 1);
  gun.hit([0, 0, 20], [1, 0, 0]);
  const swell = (of(gun, 'smoke').length);
  assert.equal(swell, 8 + 3);
  for (let i = 0; i < 89; i++) gun.step(0.1);   // 8.9 s: a hit's puff (4 to 8.5 s) gone, the broadside's (9 to 14 s) standing
  const left = of(gun, 'smoke');
  assert.equal(left.length, 8, 'the broadside\'s alone');
  const life = GUN_SMOKE_LIFE[0] + 0.5 * (GUN_SMOKE_LIFE[1] - GUN_SMOKE_LIFE[0]);
  const s1 = (GUN_SMOKE_SWELL[0] + 0.5 * (GUN_SMOKE_SWELL[1] - GUN_SMOKE_SWELL[0]));
  near(left[0].size, 1.1 + (s1 - 1.1) * Math.sqrt(8.9 / life), 1e-6, 'its swell over its own life');
  // a burning hull's smoke leans down the wind too
  const fire = createNavalEffects({ random: seeded(3), wind: () => [0, 0, 2] });
  for (let i = 0; i < 40; i++) { fire.burn([0, 0, 0], 0.1); fire.step(0.1); }
  const plume = of(fire, 'smoke');
  assert.ok(plume.length > 3 && plume.reduce((s, q) => s + q.pos[2], 0) / plume.length > 3, 'her plume downwind of her');
});

test('COMBAT-FEEL SPLASH-SPOUT a ball\'s fall throws a spout over its column - a heavy ball\'s higher - none for grape\'s bag; the whole grown for an eye far off (the host\'s burst scale); DRENCH a sheet thrown over a rail; FOUNDER-BOIL the air boiling up off a ship going down (mutants: the spout dropped, the scale unread, the drench\'s way, the boil)', () => {
  assert.deepEqual([SPOUT_UP, DRENCH_N, BOIL_RATE], [{ big: 14, small: 10 }, 16, 14]);
  const up = (fx) => Math.max(...of(fx, 'spray').map((p) => p.pos[1]));
  const small = createNavalEffects({ random: seeded(4) });
  small.shotSplash([0, 0, 0], false, 'round');
  assert.equal(of(small, 'spray').length, 12 + 4, 'the column and its spout');
  const big = createNavalEffects({ random: seeded(4) });
  big.shotSplash([0, 0, 0], true, null);
  assert.equal(of(big, 'spray').length, 22 + 6);
  const column = createNavalEffects({ random: seeded(4) });
  column.splash([0, 0, 0], false);
  for (const fx of [small, column]) fx.step(0.5);
  assert.ok(up(small) > up(column) + 1.5, `the spout stands over the column: ${up(small)} vs ${up(column)}`);
  const grape = createNavalEffects({ random: seeded(4) });
  grape.shotSplash([0, 0, 0], false, 'grape', 3);
  assert.equal(of(grape, 'spray').length, 18, 'grape\'s spatter, no spout');
  const far = createNavalEffects({ random: seeded(4) });
  far.shotSplash([0, 0, 0], false, 'round', 3);
  assert.equal(of(far, 'spray').length, Math.round(12 * 2) + 4, 'a few more drops for an eye far off');
  assert.ok(Math.min(...of(far, 'spray').map((p) => p.size)) >= 0.6 * 3 - 1e-9, 'each three times the size');
  assert.equal(of(far, 'foam')[0].size, 3, 'its ring too');
  // the drench
  const d = createNavalEffects({ random: seeded(5) });
  d.drench([10, 0, 0], [0, 2, 0], 1);
  const sheet = of(d, 'spray');
  assert.equal(sheet.length, DRENCH_N);
  d.step(0.4);
  assert.ok(of(d, 'spray').reduce((s, p) => s + p.pos[0], 0) / DRENCH_N < 9, 'thrown toward her');
  const light = createNavalEffects({ random: seeded(5) });
  light.drench([10, 0, 0], [0, 2, 0], 0);
  assert.equal(of(light, 'spray').length, DRENCH_N / 2, 'a fall at the edge throws half');
  // the founder's boil
  const f = createNavalEffects({ random: seeded(6) });
  for (let i = 0; i < 50; i++) f.founder([0, 0, 0], 0.1, 6);
  const pops = of(f, 'spray');
  assert.ok(pops.length >= 3 * 30, `a rate per second: ${pops.length}`);
  assert.ok(pops.every((p) => p.size <= 0.5 + 1e-9), 'small drops');
  assert.ok(of(f, 'foam').length > 30, 'and the rings they leave with her foam');
});

// ── the near miss ──────────────────────────────────────────────────────────────────────────────────────────────────

const BOX = { c: [0, 0, 0], ax: [1, 0, 0], ay: [0, 1, 0], az: [0, 0, 1], h: [1, 1.5, 3] };

test('COMBAT-FEEL NEAR-MISS a ball going by a ship that hears it within NEAR_MISS_M is a \'pass\' - once a ball, told at its nearest; never a ship that does not hear, never its own shooter, never in the piece it strikes her (mutants: the ear, the shooter, the strike, once, the reach)', () => {
  assert.equal(NEAR_MISS_M, 8);
  assert.equal(boxGap(BOX, [3, 0, 0]), 2);
  assert.equal(boxGap(BOX, [0.5, 0, 1]), 0, 'inside');
  near(boxGap(BOX, [4, 0, 7]), Math.hypot(3, 4), 1e-9);
  const n = segmentNearBox([5, 0, -10], [5, 0, 10], BOX);
  near(n.gap, 4, 1e-6); near(n.u, 0.5, 0.2);
  assert.ok(n.point[2] >= -3 - 1e-6 && n.point[2] <= 3 + 1e-6, 'its nearest over her');
  near(segmentNearBox([5, 0, -10], [5, 0, 10], BOX, 0.25).gap, Math.hypot(4, 2), 1e-6, 'to where it stops');
  const run = (targets, launch, shooter = 'pirate:1') => {
    const events = [];
    const f = createShotField({ seaY: () => -5, targets: () => targets, onEvent: (e) => events.push(e), random: () => 0.5 });
    f.fireVolley({ id: 'v', shooter, launches: [{ gun: 'long', p0: launch.p0, v0: launch.v0, delay: 0 }] });
    for (let i = 0; i < 12; i++) f.step(0.1);
    return events;
  };
  const by = { p0: [5, 0, -60], v0: [0, 0, 200] };   // by her side, 4 m off her planking
  let ev = run([{ id: 'mine', box: BOX, ear: true }], by);
  const pass = ev.filter((e) => e.type === 'pass');
  assert.equal(pass.length, 1, 'once');
  assert.equal(pass[0].target, 'mine');
  near(pass[0].gap, 4, 0.2);
  assert.ok(Math.abs(pass[0].point[2]) < 4, 'told where it went by');
  assert.equal(run([{ id: 'mine', box: BOX }], by).filter((e) => e.type === 'pass').length, 0, 'a ship that does not hear');
  assert.equal(run([{ id: 'mine', box: BOX, ear: true }], by, 'mine').filter((e) => e.type === 'pass').length, 0, 'never its own shooter');
  assert.equal(run([{ id: 'mine', box: BOX, ear: true }], { p0: [12, 0, -60], v0: [0, 0, 200] }).filter((e) => e.type === 'pass').length, 0, 'past NEAR_MISS_M: unheard');
  assert.equal(run([{ id: 'mine', box: BOX, ear: true }], { p0: [1 + NEAR_MISS_M + 1.5, 0, -60], v0: [0, 0, 200] }).filter((e) => e.type === 'pass').length, 0, 'within her sphere\'s reach, past NEAR_MISS_M of her planking: unheard');
  ev = run([{ id: 'mine', box: BOX, ear: true }], { p0: [0, 0, -9], v0: [0, 0, 200] });
  assert.deepEqual(ev.filter((e) => e.type !== 'muzzle').map((e) => e.type), ['hit'], 'struck, not passed');
});

// ── the module ─────────────────────────────────────────────────────────────────────────────────────────────────────

function feelWith(o = {}) {
  const log = { sounds: [], shakes: [], drench: [], blast: [], smolder: [] };
  const effects = { drench: (...a) => log.drench.push(a), blast: (p) => log.blast.push(p), smolder: (...a) => log.smolder.push(a) };
  const feel = createNavalFeel({
    effects, sound: (k, p, v) => log.sounds.push([k, p, v]), shake: (k) => log.shakes.push(k), feet: () => [0, 0, 0],
    mine: (s) => s === 'boat:1' || String(s).startsWith('peer:'), myHulls: () => [{ id: 'boat:1', box: BOX }], ...o,
  });
  return { feel, log };
}

test('COMBAT-FEEL the feel: a ship\'s ball going by whistles, louder the nearer - mine and another player\'s never; a fall within NEAR_SPLASH_M drenches her and jars her, harder alongside; a blow\'s side - bow, stern, either beam - off its way against her heading, shown BLOW_S (mutants: whose ball, the loudness, the reach, the jar, the side\'s turn, the time)', () => {
  assert.deepEqual([NEAR_SPLASH_M, NEAR_SHAKE, BLOW_S], [6, 0.7, 1.4]);
  const { feel, log } = feelWith();
  feel.passed({ shooter: 'pirate:1', point: [4, 0, 0], gap: 0 });
  feel.passed({ shooter: 'pirate:1', point: [4, 0, 0], gap: NEAR_MISS_M });
  feel.passed({ shooter: 'boat:1', point: [4, 0, 0], gap: 0 });
  feel.passed({ shooter: 'peer:ann', point: [4, 0, 0], gap: 0 });
  assert.deepEqual(log.sounds.map(([k, , v]) => [k, +v.toFixed(3)]), [[NAVAL_SFX.whistle, 1], [NAVAL_SFX.whistle, 0.55]]);
  assert.deepEqual(navalSoundRange(NAVAL_SFX.whistle), { refDistance: 8, maxDistance: 90 });
  assert.equal(feel.splashed([1 + NEAR_SPLASH_M + 0.5, 0, 0]), false, 'past NEAR_SPLASH_M');
  assert.equal(feel.splashed([1 + 3, 0, 0]), true);
  assert.equal(feel.splashed([1, 0, 0]), true, 'alongside');
  assert.deepEqual(log.drench.map(([p, to, k]) => [p[0], to, +k.toFixed(3)]), [[4, BOX.c, 0.5], [1, BOX.c, 1]]);
  assert.deepEqual(log.shakes.map((k) => +k.toFixed(3)), [+(NEAR_SHAKE * 0.7).toFixed(3), NEAR_SHAKE]);
  // the blow's side, heading +z (her starboard +x)
  const fwd = [0, 0, 1];
  assert.deepEqual([[0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0], [-1, 0, -0.5]].map((d) => blowSide(fwd, d)), ['bow', 'stern', 'starboard', 'port', 'starboard']);
  assert.deepEqual([[0, 0, 1], [0, 0, -1]].map((d) => blowSide([1, 0, 0], d)), ['starboard', 'port'], 'heading east: her starboard to the south');
  assert.equal(feel.blow(), null);
  feel.struck(fwd, [-1, 0, 0]);
  assert.equal(feel.blow(), 'starboard');
  feel.frame(BLOW_S - 0.1);
  assert.equal(feel.blow(), 'starboard');
  feel.frame(0.2);
  assert.equal(feel.blow(), null, 'shown BLOW_S');
});

test('COMBAT-FEEL MAGAZINE a ship going down afire may blow her magazine - by her own seed, the same on every machine - once, MAGAZINE_DELAY in, at her middle, jarring a boat of mine near; never one not afire, nor one gone; MY-SMOKE my battered boat smokes along her deck in a fight (mutants: the chance, the seed, the delay, the burning gate, the gone ship, the jar\'s reach, the fight, the hurt)', () => {
  assert.deepEqual([MAGAZINE_CHANCE, MAGAZINE_DELAY, MAGAZINE_SHAKE_M, MAGAZINE_SHAKE, MY_SMOKE_FROM], [0.55, [1.5, 4.5], 160, 2.4, 0.6]);
  let blows = 0;
  for (let s = 1; s <= 4000; s++) {
    const m = magazineOf(s);
    assert.equal(magazineOf(s), m, 'her seed\'s, every time');
    if (m != null) { blows++; assert.ok(m >= MAGAZINE_DELAY[0] && m <= MAGAZINE_DELAY[1]); }
  }
  near(blows / 4000, MAGAZINE_CHANCE, 0.03, 'her share');
  assert.ok(seedShare(7, 1) >= 0 && seedShare(7, 1) < 1 && seedShare(7, 1) !== seedShare(7, 2));
  const seed = [...Array(200).keys()].find((s) => magazineOf(s) != null);
  const after = magazineOf(seed);
  const { feel, log } = feelWith();
  const e = { id: 'ship:1' };
  feel.sinking(e, seed, true);
  feel.sinking(e, seed, true);
  const at = [40, 1.5, 0];
  feel.frame(after - 0.2, () => at);
  assert.equal(log.blast.length, 0, 'not yet');
  feel.frame(0.4, () => at);
  assert.deepEqual(log.blast, [at], 'once, at her middle');
  assert.deepEqual(log.sounds.map(([k]) => k), [NAVAL_SFX.blast]);
  near(log.shakes[0], MAGAZINE_SHAKE * (1 - 40 / MAGAZINE_SHAKE_M), 1e-9, 'a jar by her distance');
  feel.frame(10, () => at);
  assert.equal(log.blast.length, 1);
  const cold = feelWith();
  cold.feel.sinking({ id: 'x' }, seed, false);
  cold.feel.frame(10, () => at);
  assert.equal(cold.log.blast.length, 0, 'not afire: none');
  const gone = feelWith();
  gone.feel.sinking({ id: 'y' }, seed, true);
  gone.feel.frame(10, () => null);
  gone.feel.frame(10, () => at);
  assert.equal(gone.log.blast.length, 0, 'gone before it went up: forgotten');
  const farOff = feelWith();
  farOff.feel.sinking({ id: 'z' }, seed, true);
  farOff.feel.frame(10, () => [500, 1.5, 0]);
  assert.deepEqual([farOff.log.blast.length, farOff.log.shakes.length], [1, 0], 'seen afar, not felt');
  // MY-SMOKE
  const pose = { position: [0, 0, 0], rotation: [0, 0, 0, 1] }, build = { deck: 1, aftZ: -6, bowZ: 6 };
  const line = deckLine(pose, build);
  assert.deepEqual([...line.a, ...line.b].map((v) => Math.round(v * 1e9) / 1e9), [0, 1.5, -3.6, 0, 1.5, 3.6]);
  let boats = [{ pose, build, hull: 0.3, fighting: true }];
  const mine = feelWith({ myBoats: () => boats });
  mine.feel.frame(0.1);
  assert.equal(mine.log.smolder.length, 1);
  assert.deepEqual([mine.log.smolder[0][2], +mine.log.smolder[0][3].toFixed(3)], [0.1, 0.5], 'her hurt past MY_SMOKE_FROM');
  boats = [{ pose, build, hull: 0.3, fighting: false }, { pose, build, hull: 0.7, fighting: true }];
  mine.feel.frame(0.1);
  assert.equal(mine.log.smolder.length, 1, 'not out of a fight, nor whole enough');
});

// ── over the real naval host ───────────────────────────────────────────────────────────────────────────────────────

test('COMBAT-FEEL over the real naval host: a pirate\'s ball by my side whistles and its fall drenches her; one into her starboard is shown on her plate from starboard; her hull bar\'s loss breaks a piece off; each battery says its seconds to load; a ship made out shows her men on her card, and my volley\'s tally counts the men it took (mutants: the ear, the drench\'s wiring, the blow\'s wiring, the seconds, the card\'s men, the tally\'s men)', async () => {
  const h = await sea({ hull: HULL.SmallShip, settings: { ShipsAtSea: 'off', Boarders: false } });
  const e = h.host._sea.get(h.host.spawnShip('pirateBrig', { range: 300, bearing: Math.PI / 2 }));
  e.ship.pos = [300, 0, 0];
  h.run(0.2);
  const fire = (p0, v0) => { h.host._shots.fireVolley({ id: `t${Math.random()}`, shooter: e.id, launches: [{ gun: 'long', p0, v0, delay: 0 }] }); };
  h.log.sounds.length = 0; h.log.shake.length = 0;
  const box = hullBoxOf(h.boat, h.pool.models);
  const side = box.c[0] + Math.abs(box.ax[0]) * box.h[0] + Math.abs(box.ay[0]) * box.h[1] + Math.abs(box.az[0]) * box.h[2];   // her starboard planking
  fire([side + 4, 2, -80], [0, 0, 220]);   // by her starboard side, aft to fore
  h.run(0.6);
  assert.ok(h.log.sounds.some(([k]) => k === NAVAL_SFX.whistle), 'heard going by');
  const spray = h.host._effects.drawList().filter((p) => p.kind === 'spray').length;
  fire([side + 2, 6, 0], [0, -25, 0]);   // into the sea 2 m off her side
  h.run(0.4);
  assert.ok(h.host._effects.drawList().filter((p) => p.kind === 'spray').length > spray + 12, 'her rail drenched');
  near(h.log.shake.at(-1), NEAR_SHAKE * (0.4 + 0.6 * (1 - 2 / NEAR_SPLASH_M)), 0.05, 'and a jar, by how near');
  fire([side + 30, 1, 0], [-220, 0, 0]);   // into her starboard side
  h.run(0.3);
  const m = h.host.hudModel();
  assert.equal(m.ship.blow, 'starboard');
  assert.equal(navalHudText(m).plate.blow, 'starboard');
  // her heading read: turned east, her starboard is to the south
  h.run(BLOW_S + 0.2);
  assert.equal(h.host.hudModel().ship.blow, null);
  h.boat.GameObject.rotation = quatAngleAxis(90, [0, 1, 0]);
  h.run(0.1);
  const turned = hullBoxOf(h.boat, h.pool.models);
  const south = turned.c[2] - (Math.abs(turned.ax[2]) * turned.h[0] + Math.abs(turned.ay[2]) * turned.h[1] + Math.abs(turned.az[2]) * turned.h[2]);
  const shakes = h.log.shake.length;
  fire([turned.c[0], 1, south - 30], [0, 0, 220]);
  h.run(0.3);
  assert.ok(h.log.shake.slice(shakes).some((k) => k >= 1.6), `it struck her: ${h.log.shake.slice(shakes)}`);
  assert.equal(h.host.hudModel().ship.blow, 'starboard', 'from the south, heading east: her starboard');
  assert.ok(m.batteries.every((b) => Number.isFinite(b.left)), 'each battery\'s seconds');
  const text = navalHudText({ ...m, batteries: m.batteries.map((b) => ({ ...b, ready: false, loaded: false, left: 4.2 })) });
  assert.deepEqual(text.plate.batteries.map((b) => b.secs), m.batteries.map((b) => (b.gun === 'barrel' ? '' : '5s')), 'a gun\'s whole seconds - a barrel none');
  assert.ok(m.batteries.some((b) => b.gun !== 'barrel'));
  assert.equal(navalHudText({ ...m, batteries: m.batteries.map((b) => ({ ...b, ready: true, loaded: true, left: 0 })) }).plate.batteries[0].secs, '');
  assert.deepEqual(navalHudText({ ...m, batteries: m.batteries.map((b) => ({ ...b, ready: true, loaded: true, left: 3 })) }).plate.batteries.map((b) => b.secs), m.batteries.map(() => ''), 'a loaded side says none, whatever its clock');
  // her plate drawn: the side, her bar's loss
  const doc = fakeDoc();
  drawNavalHud(m, { doc, dt: 0.016 });
  const all = (n, out = []) => { for (const c of n.children ?? []) { out.push(c); all(c, out); } return out; };
  const nodes = all(doc.body);
  assert.ok(nodes.some((n) => /dfnaval-rose.* blow-starboard/.test(n.className)), 'that side of her little ship');
  assert.ok(nodes.some((n) => /dfnaval-gun starboard.* struck/.test(n.className)), 'and her starboard battery');
  drawNavalHud({ ...m, ship: { ...m.ship, hull: m.ship.hull - 0.2 } }, { doc, dt: 0.016 });
  assert.ok(all(doc.body).some((n) => /dfnaval-track hull.*hit-[ab]/.test(n.className)), 'her bar flashes as a piece breaks off');
  assert.ok(all(doc.body).some((n) => /dfnaval-chunk f[ab]/.test(n.className)));
  // AUDIT 2026-10-17: the plate's bar is the boat behind it - the helm taken on another starts whole at hers, no bite read
  assert.equal(m.ship.id, h.boat.uid, 'the plate says whose boat it is');
  const bitten = (d) => all(d.body).some((n) => /dfnaval-track hull.*hit-[ab]/.test(n.className));
  drawNavalHud({ ...m, ship: { ...m.ship, id: 1, hull: 1 } }, { doc, dt: 0.016 });
  drawNavalHud({ ...m, ship: { ...m.ship, id: 2, hull: 0.4 } }, { doc, dt: 0.016 });
  assert.equal(bitten(doc), false, 'another boat at the helm: no bite');
  drawNavalHud({ ...m, ship: { ...m.ship, id: 2, hull: 0.2 } }, { doc, dt: 0.016 });
  assert.equal(bitten(doc), true, 'her own bite');
  // her men on the card, and my volley's count of them
  const g = await sea({ hull: HULL.SmallShip, settings: { ShipsAtSea: 'off', Boarders: false } });
  const prey = g.host._sea.get(g.host.spawnShip('merchantCarrack', { range: 70, bearing: Math.PI / 2 }));
  prey.ship.pos = [68, 0, 0]; prey.ship.yaw = 0;
  knowAll(g.host);
  g.run(0.2);
  const lookAt = (p) => { const o = [0, 12.6, 0]; const d = [p[0] - o[0], p[1] - o[1], p[2] - o[2]]; const l = Math.hypot(...d); g.view.look = { origin: o, dir: d.map((v) => v / l) }; };
  lookAt([72, 0, 0]);
  near(g.host.hudModel().target.crew, 1, 1e-9, 'her men whole');
  const men = prey.ship.damage.crew;
  g.host.attackInput(true); g.host.frame(0.05); g.host.attackInput(false); g.host.frame(0.05);
  g.run(2);
  const t = g.host.hudModel().tally;
  assert.equal(t.men, men - prey.ship.damage.crew, 'the men my volley took');
  assert.ok(t.men > 0);
  near(g.host.hudModel().target.crew, prey.ship.damage.crewShare(), 1e-9);
  assert.match(navalHudText(g.host.hudModel()).tally.rest, new RegExp(` - ${t.men} crew down`));
  const cardMen = navalHudText(g.host.hudModel()).card.crew;
  assert.ok(typeof cardMen === 'number' && cardMen < 100, `her card's men thinned: ${cardMen}`);
});

test('COMBAT-FEEL the wiring: the host hears a pass, drenches on a splash, scales the fall, feels the blow, counts the men, lights the magazine, and steps the feel each frame (mutants: each line)', () => {
  const host = rd('src/scenes/naval/navalHost.js');
  assert.match(host, /if \(e\.type === 'pass'\) \{ feel\.passed\(e\); return; \}/);
  assert.match(host, /effects\.shotSplash\(\[e\.point\[0\], seaY, e\.point\[2\]\], e\.gun === 'heavy', e\.shot, burstScale\(e\.point\)\);/);
  assert.match(host, /feel\.splashed\(\[e\.point\[0\], seaY, e\.point\[2\]\]\);/);
  assert.match(host, /if \(box\) out\.push\(\{ id: myBoatId\(b\), box, rig: rigBoxesOf\(b\), boat: b, ear: true \}\);/);
  assert.match(host, /feel\.sinking\(entry, s\.seed, s\.damage\.fire > 0 \|\| \(entry\.fires \?\? \[\]\)\.some\(\(f\) => !f\.out\)\);/);
  assert.match(host, /feel\.frame\(total, \(en\) => \(sea\.get\(en\.id\) === en && en\.ship\.damage\.state === SHIP_STATES\.sinking \?/);
});

/** A document enough for the HUD's draw. */
function fakeDoc() {
  const mk = (tag) => {
    const kids = [];
    const e = {
      tagName: tag.toUpperCase(), children: kids, style: { setProperty() {} }, className: '', textContent: '', attrs: {},
      append: (...n) => kids.push(...n), prepend: (...n) => kids.unshift(...n), appendChild: (n) => kids.push(n), setAttribute: (k, v) => { e.attrs[k] = v; },
      addEventListener() {}, remove() {}, getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 20, width: 100, height: 20 }),
    };
    return e;
  };
  const body = mk('body'), head = mk('head');
  return { createElement: mk, body, head, getElementById: () => null, querySelector: () => null, defaultView: { innerWidth: 1280, innerHeight: 760, getComputedStyle: () => ({ visibility: 'visible' }) } };
}
