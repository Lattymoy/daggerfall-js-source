// T1: THE PLAYER'S TORCH - EnablePlayerTorch.Update (MIT, Daggerfall
// Workshop). U25 shipped the LightSource slot, its four messages and
// its save field; this is the component that made any of it visible,
// and it had no port at all. Until now a lit torch was a HUD line and
// a saved index: it burned no fuel, it never died, and it lit nothing.

import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import {
  tickPlayerTorch, playerTorchLight, torchRange,
  TORCH_TICK_SECONDS, GUTTERING_CONDITION, ITEM_BASED_TORCH_INTENSITY,
  TORCH_OFFSET, LIGHT_DIES_TEXT, LANTERN_TEMPLATE,
} from '../src/systems/playerTorch.js';
import { withPlayerLights } from '../src/scenes/magicCandle.js';
import { useItem } from '../src/systems/useItem.js';
import { tickPlayerMinutes } from '../src/systems/worldTick.js';
import { LIVE, setValue, getBool } from '../src/systems/settings.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');

const TORCH = 247, LANTERN = 248, CANDLE = 253, HOLY_CANDLE = 269;
const light = (templateIndex, condition, over = {}) => ({
  group: templateIndex === HOLY_CANDLE ? 'ReligiousItems' : 'UselessItems2',
  templateIndex, name: { 247: 'Torch', 248: 'Lantern', 253: 'Candle', 269: 'Holy Candle' }[templateIndex],
  currentCondition: condition, maxCondition: condition, ...over,
});
const player = (over = {}) => ({
  stats: { luck: 50, willpower: 50, strength: 50 }, skills: [], activeEffects: [],
  level: 1, health: 30, maxHealth: 30, items: [], lightSource: null, ...over,
});
/** The tick with the setting forced ON - the arm this lane ports. */
const tick = (e, dt, opts = {}) => tickPlayerTorch(e, dt, { fromItems: true, ...opts });

test('T1 range: the light radius IS the item template\'s capacityOrTarget', () => {
  // Real shipping data, not a constant: Torch 14, Lantern 16, Holy
  // Candle 10, Candle 8. DFU re-reads it every frame (:64).
  assert.equal(torchRange(light(TORCH, 50)), 14);
  assert.equal(torchRange(light(LANTERN, 100)), 16);
  assert.equal(torchRange(light(HOLY_CANDLE, 20)), 10);
  assert.equal(torchRange(light(CANDLE, 16)), 8);
  assert.equal(torchRange(null), 0);
});

test('T1 the gate: no setting, no source, or a non-light source, and nothing lights', () => {
  const t = light(TORCH, 50);
  // the whole arm is behind PlayerTorchFromItems (:59)
  const off = player({ lightSource: t });
  assert.deepEqual(tickPlayerTorch(off, 1, { fromItems: false }), { lit: false, range: 0, died: null });
  assert.equal(playerTorchLight(off, [0, 0, 0], 0), null);
  // nothing lit
  assert.equal(tick(player(), 1).lit, false);
  // ...and a saved slot holding something that is NOT a light source
  const bogus = player({ lightSource: { group: 'Weapons', templateIndex: 113 } });
  assert.equal(tick(bogus, 1).lit, false);
});

test('T1 lit: a healthy torch burns at exactly its template radius', () => {
  const t = light(TORCH, 50);
  const e = player({ lightSource: t, items: [t] });
  const r = tick(e, 0.016);
  assert.equal(r.lit, true);
  assert.equal(r.range, 14, 'above the guttering threshold the band is a steady 1.25, normalised to 1');
  assert.equal(t.currentCondition, 50, 'and 16ms burns no fuel');
  // the light the hosts draw
  const l = playerTorchLight(e, [10, 2, 30], 0);
  assert.equal(l.range, 14);
});

test('T1 fuel: ONE condition per 20 REAL seconds, not per game minute', () => {
  const t = light(TORCH, 5);
  const e = player({ lightSource: t, items: [t] });
  // nineteen seconds of frames burn nothing
  for (let i = 0; i < 19; i++) tick(e, 1);
  assert.equal(t.currentCondition, 5, 'tickTimeInterval is 20 (:26)');
  tick(e, 1);   // 20.0 exactly - DFU's test is `>` , so this is still not past it
  assert.equal(t.currentCondition, 5, 'the test is `tickTimeBuffer > 20`, strictly');
  tick(e, 0.1);
  assert.equal(t.currentCondition, 4, 'past it, one point');
  // and the accumulator resets, so the next point is another 20s away
  for (let i = 0; i < 19; i++) tick(e, 1);
  assert.equal(t.currentCondition, 4);
});

test('T1 death: the line, the cleared slot, and the item CONSUMED - unless it is a lantern', () => {
  const said = [];
  const t = light(TORCH, 1);
  const e = player({ lightSource: t, items: [t] });
  const r = tick(e, TORCH_TICK_SECONDS + 1, { say: (s) => said.push(s) });
  assert.equal(r.lit, false);
  assert.equal(r.died, t);
  assert.deepEqual(said, ['Your Torch flickers and dies.'], '%it is the item name');
  assert.equal(e.lightSource, null, 'the slot clears itself');
  assert.deepEqual(e.items, [], 'and a burnt-out torch is gone');
  assert.equal(playerTorchLight(e, [0, 0, 0], 0), null, 'and it lights nothing');
  // A LANTERN survives its own death - it is the one oil can refill
  const said2 = [];
  const lan = light(LANTERN, 1);
  const e2 = player({ lightSource: lan, items: [lan] });
  tick(e2, TORCH_TICK_SECONDS + 1, { say: (s) => said2.push(s) });
  assert.deepEqual(said2, ['Your Lantern flickers and dies.']);
  assert.equal(e2.lightSource, null);
  assert.deepEqual(e2.items, [lan], 'the lantern stays in the pack');
});

test('T1 death: a source SWAPPED during the tick is not the one that dies', () => {
  // DFU re-tests CompareItems(playerEntity.LightSource, lightSource)
  // before killing it (:75). Here the reference IS the identity.
  const a = light(TORCH, 1);
  const b = light(LANTERN, 40);
  const e = player({ lightSource: a, items: [a, b] });
  // burn `a` down to zero while it is the live source
  tick(e, TORCH_TICK_SECONDS + 1, { say: () => {} });
  assert.equal(a.currentCondition, 0);
  assert.deepEqual(e.items, [b]);
  // now light `b`; `a` is gone and cannot be killed twice
  e.lightSource = b;
  const r = tick(e, 1);
  assert.equal(r.lit, true);
  assert.equal(r.range, 16);
});

test('T1 guttering: under condition 3 the light PULSES, and it is bounded', () => {
  const t = light(TORCH, 2);
  const e = player({ lightSource: t, items: [t] });
  // the band is 0.85 + cos(g) * 0.2 -> 0.65 .. 1.05, normalised
  // against the steady 1.25. So a guttering torch is between 52% and
  // 84% of its radius, and never its full one.
  const lo = 14 * (0.65 / ITEM_BASED_TORCH_INTENSITY);
  const hi = 14 * (1.05 / ITEM_BASED_TORCH_INTENSITY);
  const seen = new Set();
  let n = 0;
  const rolls = () => { n = (n + 0.37) % 1; return n; };
  for (let i = 0; i < 300; i++) {
    const r = tick(e, 0.016, { rolls });
    if (!r.lit) break;
    assert.ok(r.range >= lo - 1e-9 && r.range <= hi + 1e-9, `range ${r.range} outside [${lo}, ${hi}]`);
    assert.ok(r.range < 14, 'a guttering torch is never at full radius');
    seen.add(r.range.toFixed(4));
  }
  assert.ok(seen.size > 20, 'and it actually moves - a pulse, not a dimming');
  // AT the threshold it is steady again
  const t2 = light(TORCH, GUTTERING_CONDITION);
  const e2 = player({ lightSource: t2, items: [t2] });
  assert.equal(tick(e2, 0.016).range, 14, '`< 3` is the test, so 3 itself is steady');
});

test('T1 position: left hand, 1.2 up, 0.2 forward - and it turns with the player, not the pitch', () => {
  assert.deepEqual({ ...TORCH_OFFSET }, { left: 0.3, up: 1.2, forward: 0.2 });
  const t = light(TORCH, 50);
  const e = player({ lightSource: t, items: [t] });
  tick(e, 0.016);
  const at = (yaw) => {
    const l = playerTorchLight(e, [0, 0, 0], yaw);
    return [l.x, l.y, l.z].map((v) => Math.round(v * 1e6) / 1e6);
  };
  // yaw 0: forward is +Z, right is +X, so the torch is at (-0.3, 1.2, 0.2)
  assert.deepEqual(at(0), [-0.3, 1.2, 0.2]);
  // a half turn puts it on the other side and behind
  assert.deepEqual(at(Math.PI), [0.3, 1.2, -0.2]);
  // the HEIGHT never changes - a torch in your hand does not swing up
  // when you look at the ceiling, which is why the basis is yaw only
  for (const y of [0, 1, 2, 3, 4, 5, 6]) assert.equal(playerTorchLight(e, [0, 0, 0], y).y, 1.2);
  // and it rides the player's feet
  const moved = playerTorchLight(e, [10, 2, 30], 0);
  assert.deepEqual([moved.x, moved.y, moved.z], [9.7, 3.2, 30.2]);
});

test('T1 the channel: the player\'s lights go FIRST, both of them, inside the 16 cap', () => {
  const base = new Float32Array(16 * 4).fill(7);
  const torch = { x: 1, y: 2, z: 3, range: 14 };
  const candle = { x: 4, y: 5, z: 6, range: 15 };
  const both = withPlayerLights(base, candle, torch);
  assert.equal(both.length, 16 * 4, 'the renderer takes 16 vec4s and no more');
  assert.deepEqual([...both.subarray(0, 8)], [4, 5, 6, 15, 1, 2, 3, 14], 'in the order given');
  assert.equal(both[8], 7, 'then the scene lights');
  // a host with only one of them
  assert.deepEqual([...withPlayerLights(new Float32Array(0), null, torch)], [1, 2, 3, 14]);
  assert.deepEqual([...withPlayerLights(new Float32Array(0), candle, null)], [4, 5, 6, 15]);
  // neither: the array is handed back untouched, not copied
  assert.equal(withPlayerLights(base, null, null), base);
});

test('T1 wiring: the tick rides the REAL clock, and every draw path carries the torch', () => {
  const wt = src('src/systems/worldTick.js');
  // OUTSIDE the per-minute block: DFU accumulates Time.deltaTime, so a
  // torch burns on the wall clock. Inside it, a 20-second timer fed
  // once a minute would burn a point every twenty MINUTES.
  const band = wt.slice(wt.indexOf("if (Math.floor(next) !== Math.floor(classicMinutes))"));
  const close = band.indexOf('\n  }');
  assert.ok(band.indexOf('tickPlayerTorch') > close,
    'the torch tick is inside the per-minute block - it must ride dt');
  assert.ok(/tickPlayerTorch\(entity, dt,/.test(wt), 'and it must be fed REAL seconds');
  // THE FOUR HOSTS RULE: every host that draws a scene prepends it
  const sites = {
    'src/scenes/worldModes.js': 2,   // the ?world dungeon and interior branches
    'src/scenes/world.js': 2,        // the exterior, lanterns on AND off
    'src/scenes/exterior.js': 1,
    'src/scenes/dungeon.js': 1,
  };
  for (const [f, n] of Object.entries(sites)) {
    const hits = (src(f).match(/playerTorchLight\(/g) || []).length;
    assert.equal(hits, n, `${f} draws the torch at ${n} light site(s), found ${hits}`);
  }
  // and the setting names its REAL consumer now
  assert.equal(LIVE['Enhancements/PlayerTorchFromItems'], 'src/systems/playerTorch.js');
});

test('T1 end to end: use a torch, walk, and watch it burn down and die', () => {
  // Through the SHIPPED use door and the SHIPPED player tick - no
  // fixture stands in for either.
  const sinks = {
    hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {},
    restoreFatigue() {}, drainFatigue() {}, say() {},
  };
  const said = [];
  const t = light(TORCH, 2);
  const e = player({
    lightSource: null, items: [t], chargenDone: true,
    skillUses: new Array(35).fill(0), skills: 30, fatigue: 3200, lastSkillCheckTime: 0,
  });
  // The setting is the gate, so the end-to-end walk turns it ON
  // through the REAL store - which is also what proves the gate is
  // wired to the store and not to a parameter.
  setValue('Enhancements', 'PlayerTorchFromItems', 'True');
  assert.equal(getBool('Enhancements', 'PlayerTorchFromItems'), true);
  const lit = useItem(t, e.items, { entity: e });
  assert.equal(lit.kind, 'lit');
  assert.equal(e.lightSource, t, 'UseItem fills the slot');
  // ...and now the world ticks. 45 real seconds is two 20-second
  // burns, which takes a condition-2 torch to zero.
  for (let i = 0; i < 45; i++) {
    tickPlayerMinutes({ entity: e, classicMinutes: i * 0.2, dt: 1, sinks, rolls: () => 0.5, say: (s) => said.push(s) });
  }
  assert.equal(e.lightSource, null, 'it burned out');
  assert.deepEqual(e.items, [], 'and it is gone from the pack');
  assert.ok(said.includes('Your Torch flickers and dies.'), `the HUD said so - got ${JSON.stringify(said)}`);
  assert.equal(playerTorchLight(e, [0, 0, 0], 0), null);
  setValue('Enhancements', 'PlayerTorchFromItems', 'False');   // leave the store as it was found
});

test('T1 end to end: the setting really gates it, through the real tick', () => {
  // The default is False, so the untouched store must burn nothing.
  const sinks = {
    hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {},
    restoreFatigue() {}, drainFatigue() {}, say() {},
  };
  const t = light(TORCH, 5);
  const e = player({
    lightSource: t, items: [t], chargenDone: true,
    skillUses: new Array(35).fill(0), skills: 30, fatigue: 3200, lastSkillCheckTime: 0,
  });
  for (let i = 0; i < 45; i++) {
    tickPlayerMinutes({ entity: e, classicMinutes: i * 0.2, dt: 1, sinks, rolls: () => 0.5 });
  }
  assert.equal(getBool('Enhancements', 'PlayerTorchFromItems'), false, 'the shipped default');
  assert.equal(t.currentCondition, 5, 'PlayerTorchFromItems defaults to False, so nothing burns');
  assert.equal(playerTorchLight(e, [0, 0, 0], 0), null, 'and nothing lights');
  assert.equal(LIGHT_DIES_TEXT, 'Your %it flickers and dies.');
  assert.equal(LANTERN_TEMPLATE, LANTERN);
});
