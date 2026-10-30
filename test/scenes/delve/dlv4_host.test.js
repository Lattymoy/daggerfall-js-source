// DLV4 (bible/03-World/Delve-II.md section 5): THE FIVE MORE KINDS, STOOD AND WON IN A ROOM - offline, on a real
// collider's room and the context's doors as fakes: the Wellsprings' sources poured from and broken through the crystal
// seam, the Vigil's relic hunted and its light lost and kept, the Brazier Rite's flame carried with its burden and its
// weapon put up, the Weighing's weights taken and set and its plates held, the Seals broken in their window and sunk
// out of it; the pieces' looks, and the context's wiring. Pins held to fail under the mutations in tools/mutants/dlv4.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDelveHost, delveKeyWeight } from '../../../src/scenes/delve/delveHost.js';
import { delveCrystalC, delveCrystalOf, isDelveCrystal, dungeonCrystals, breakTargets, createStandIns, makeRelic, createDelveCarry, delveHuntSite, DELVE_CRYSTAL_C0 } from '../../../src/scenes/delve/delveBodies.js';
import { pieceCrystals, siteFlames, weightPlaces, sourceLook, DELVE_CRYSTAL_SCALE, DELVE_CRYSTAL_COLORS, DELVE_PEDESTAL_MODEL, DELVE_WEIGHT_MODEL, DELVE_PEDESTAL_TOP } from '../../../src/scenes/delve/delveProps.js';
import { siteShapes } from '../../../src/scenes/delve/delvePieces.js';
import { createHoldFoes } from '../../../src/scenes/delve/delveHold.js';
import { DELVE_CHEST_MODEL } from '../../../src/scenes/delve/delvePieces.js';
import {
  DP, FLAME, WEIGHT, HOLD_GATHER_MS, HOLD_CAPTAIN_MIN_MS, PUZZLE_RISE_MS, SPRING_POUR_MS, SPRING_ALIVE, VIGIL_REST_MS, DELVE_BURDEN,
  springSpots, springCount, sealSpots, brazierSpots, weighPlates, weightSpots, newDelveLedger, foldDelveWord, stepDelve, holdGates, driftSpots, DRIFT_EVERY_MS,
  DELVE_WEIGHT_HALF_M,
} from '../../../src/net/delve/delveLaw.js';
import { siteKinds } from '../../../src/world/dungeon/delveSites.js';
import { HIT_KINDS } from '../../../src/net/gate/gateBrain.js';
import { ktLeastMs } from '../../../src/net/ketch/ketchBrain.js';
import { DUNGEON_TYPES } from '../../../src/formats/mapsFile.js';
import { footSpeedMult } from '../../../src/player/motor.js';
import { hurtPlayer } from '../../../src/characters/playerEntity.js';
import { huntsStar } from '../../../src/characters/enemy/enemyTargets.js';
import { Collider } from '../../../src/player/collider.js';
import { RDB_SIDE } from '../../../src/world/rdbLayout.js';
import { _resetForTests } from '../../../src/systems/uiPrefs.js';
import { midScreenText } from '../../../src/ui/midScreenText.js';
import { dungeonOf, seedFor, run, flush } from './delveRig.mjs';

const rd = (p) => readFileSync(new URL('../../../' + p, import.meta.url), 'utf8');
const site = (o = {}) => ({ i: 0, kind: 'wellsprings', x: 10, y: 0, z: 20, r: 4, tier: 'regular', vault: [13.4, 0, 20], ...o });

const kill = (f) => { f.entity.health = 0; f.dead = true; };

test('DLV4 THE SEAM\'S NUMBERS: a piece\'s number past every court\'s crystals, sixteen a site, read back to its site and piece; nothing else is a delve\'s (mutants: the base; the site\'s stride)', () => {
  assert.equal(DELVE_CRYSTAL_C0, 1000);
  assert.equal(delveCrystalC(2, 3), 1035);
  assert.deepEqual(delveCrystalOf(1035), { i: 2, j: 3 });
  assert.deepEqual([999, 1000, 1255, 1256, 2.5, null].map(isDelveCrystal), [false, true, true, false, false, false]);
  assert.equal(delveHuntSite(4), 'delve:4');
});

test('DLV4 THE SEAM\'S LIST: the court\'s crystals and the encounters\' pieces both - outside a Reckoning the court answers an empty list (scenes/gate/gateCourt.js NONE), and the pieces still meet a blow (mutants: the first list that answers)', () => {
  const court = [{ c: 3 }], pieces = [{ c: delveCrystalC(0, 0) }, { c: delveCrystalC(0, 1) }];
  assert.deepEqual(dungeonCrystals(Object.freeze([]), pieces), pieces, 'the court\'s none outside a Reckoning: the pieces');
  assert.deepEqual(dungeonCrystals(null, pieces), pieces, 'no court at all');
  assert.deepEqual(dungeonCrystals(court, []), court);
  assert.deepEqual(dungeonCrystals(court, pieces).map((q) => q.c), [3, delveCrystalC(0, 0), delveCrystalC(0, 1)], 'both, numbered apart');
  assert.deepEqual(dungeonCrystals(undefined, undefined), []);
  assert.match(rd('src/scenes/gate/gateCourt.js'), /return !s \|\| s\.day === null \|\| s\.fell \|\| s\.wrath != null \? NONE : _targets;/, 'the court\'s answer outside a Reckoning is a list, never null');
});

test('DLV4 THE SOURCES\' LOOK: a cracked tomb where the dead lie, a pool in a cave, else a broken altar - each tinted its own; the crystals a room\'s size (mutants: a crypt\'s pool; the scale the Court\'s)', () => {
  assert.deepEqual([DUNGEON_TYPES.Crypt, DUNGEON_TYPES.Cemetery, DUNGEON_TYPES.VampireHaunt, DUNGEON_TYPES.DesecratedTemple].map(sourceLook), ['tomb', 'tomb', 'tomb', 'tomb']);
  assert.deepEqual([DUNGEON_TYPES.NaturalCave, DUNGEON_TYPES.Mine, DUNGEON_TYPES.DragonsDen, DUNGEON_TYPES.SpiderNest].map(sourceLook), ['pool', 'pool', 'pool', 'pool']);
  assert.deepEqual([DUNGEON_TYPES.OrcStronghold, DUNGEON_TYPES.Laboratory, DUNGEON_TYPES.Coven, undefined].map(sourceLook), ['altar', 'altar', 'altar', 'altar']);
  assert.deepEqual(DELVE_CRYSTAL_SCALE, { source: 0.42, seal: 0.4, relic: 0.32 });
  assert.notDeepEqual(DELVE_CRYSTAL_COLORS.tomb, DELVE_CRYSTAL_COLORS.pool);
  const s = site(), q = pieceCrystals(s, null, { look: 'pool', seed: 3 });
  assert.equal(q.length, springCount(3, 0), 'the sources stand from the first, their count the seed\'s');
  assert.deepEqual(q.map((c) => c.at), springSpots(s, springCount(3, 0)));
  assert.ok(q.every((c) => c.scale === DELVE_CRYSTAL_SCALE.source && c.color === DELVE_CRYSTAL_COLORS.pool && c.broke === -1 && c.hp === 1));
  assert.deepEqual(pieceCrystals(site({ kind: 'seals' }), null), [], 'the seals stand only while risen');
  const relic = pieceCrystals(site({ kind: 'vigil' }), { p: DP.wave, lt: 50 });
  assert.deepEqual([relic.length, relic[0].hp, relic[0].scale], [1, 0.5, DELVE_CRYSTAL_SCALE.relic], 'the relic\'s light its glow');
});

test('DLV4 THE WELLSPRINGS, WON IN A ROOM: the near line names its tombs; the sources pour on the clock, three alive each at most; the crystal seam meets them and the ledger breaks them; the last stands the captain; its fall opens the vault (mutants: the pour\'s clock; the alive cap; the seam unread; the captain unstood)', async () => {
  _resetForTests();
  const D = dungeonOf(seedFor('wellsprings')), { host } = D, s = host.sites[0];
  assert.equal(s.kind, 'wellsprings');
  const k = springCount(seedFor('wellsprings'), 0), feet = [s.x, s.y, s.z];
  host.frame(0.1, [s.x + s.r + 2 + 5, s.y, s.z]);
  assert.equal(midScreenText.text, `${k} cracked tombs stand round this floor. Step inside the circle to wake them.`);
  assert.deepEqual(host.breakables(), [], 'nothing to break before they wake');
  await run(D, HOLD_GATHER_MS + 100, feet);
  assert.equal(host.state()[0].p, DP.spring);
  assert.equal(midScreenText.text.startsWith('Foes pour from the sources'), true);
  const poured = () => D.stood.filter((f) => f._delve?.src != null);
  assert.equal(poured().length, k, 'each source pours one as they stand');
  assert.deepEqual(poured().map((f) => f._delve.src).sort(), [...Array(k).keys()]);
  await run(D, SPRING_POUR_MS, feet);
  assert.equal(poured().length, 2 * k, 'and one more each, 12 s on');
  await run(D, 2 * SPRING_POUR_MS, feet);
  assert.equal(poured().length, SPRING_ALIVE * k, 'three alive each, at most');
  await run(D, SPRING_POUR_MS, feet);
  assert.equal(poured().length, SPRING_ALIVE * k, 'no fourth while three stand');
  const targets = host.breakables();
  assert.equal(targets.length, k);
  assert.deepEqual(targets.map((q) => q.c), [...Array(k).keys()].map((j) => delveCrystalC(0, j)));
  assert.ok(targets.every((q) => q.entity?.crystal === true && q.entity.name === 'Wellspring'), 'a crystal\'s stand-in, named');
  for (let j = 0; j < k; j++) {
    for (let n = 0; host.state()[0].hp[j] > 0 && n < 300; n++) { await run(D, 300, springSpots(s, k)[j]); host.hit(delveCrystalC(0, j), 1e6, HIT_KINDS.Melee); }
    assert.equal(host.state()[0].hp[j], 0, `source ${j} broken`);
  }
  assert.equal(host.state()[0].p, DP.captain);
  await run(D, 300, feet);
  const cap = D.stood.find((f) => f._delve?.cap);
  assert.ok(cap, 'the captain stood');
  kill(cap);
  await run(D, HOLD_CAPTAIN_MIN_MS + 300, feet);
  assert.equal(host.state()[0].won, true);
  assert.equal(midScreenText.text, 'The sources are broken. The vault is open.');
  assert.ok(D.pool.every((f) => f.dead || f._delve == null), 'its foes crumble with the win');
  host.destroy();
});

test('DLV4 ONE WARD FOR WORDS, ACTS AND BLOWS: past the disc with a wall between me and the heart, my blow on a source and my press on a weight move nothing - as my word there keeps me out of the ward; in the ward they land (mutants: the blow\'s ward read without the line; the act\'s)', async () => {
  _resetForTests();
  const D = dungeonOf(seedFor('wellsprings')), { host } = D, s = host.sites[0];
  await run(D, HOLD_GATHER_MS + 200, [s.x, s.y, s.z]);
  const q = springSpots(s, host.state()[0].k)[0], dx = q[0] - s.x, dz = q[2] - s.z, d = Math.hypot(dx, dz), ux = dx / d, uz = dz / d;
  const out = [s.x + ux * (s.r + 1), s.y, s.z + uz * (s.r + 1)], hp0 = host.state()[0].hp[0];
  // a wall across the line, half a metre past the disc's edge (the layout's own bucket - the line reads it alone)
  const w = [s.x + ux * (s.r + 0.5), s.z + uz * (s.r + 0.5)], px = -uz * 3, pz = ux * 3;
  D.collider.addMesh('dungeon', [w[0] - px, -1, w[1] - pz, w[0] + px, -1, w[1] + pz, w[0] + px, 4, w[1] + pz, w[0] - px, 4, w[1] - pz], [0, 1, 2, 0, 2, 3], [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  await run(D, 100, out);
  assert.equal(host.hit(delveCrystalC(0, 0), 10, HIT_KINDS.Shaft), false, 'refused: said so (a spell keeps no rounds on it)');
  assert.equal(host.state()[0].hp[0], hp0, 'no line to the heart: out of the ward');
  await run(D, 100, [s.x, s.y, s.z]);
  assert.equal(host.hit(delveCrystalC(0, 0), 10, HIT_KINDS.Shaft), true, 'landed: said so');
  assert.equal(host.state()[0].hp[0], hp0 - 10, 'at the heart: it lands');
  host.destroy();
  // a weight at its home on a gate, pressed from past the disc behind a wall, then from the disc's side of it
  const G = dungeonOf(seedFor('weighing')), g = G.host.sites[0];
  await run(G, 300, [g.x, g.y, g.z]);
  const home = weightSpots(g)[0], hx = home[0] - g.x, hz = home[2] - g.z, hd = Math.hypot(hx, hz), vx = hx / hd, vz = hz / hd;
  const wall = [g.x + vx * (g.r + 0.2), g.z + vz * (g.r + 0.2)], qx = -vz * 3, qz = vx * 3;
  G.collider.addMesh('dungeon', [wall[0] - qx, -1, wall[1] - qz, wall[0] + qx, -1, wall[1] + qz, wall[0] + qx, 4, wall[1] + qz, wall[0] - qx, 4, wall[1] - qz], [0, 1, 2, 0, 2, 3], [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const past = [g.x + vx * (g.r + 0.6), g.y, g.z + vz * (g.r + 0.6)];
  assert.ok(Math.hypot(past[0] - home[0], past[2] - home[2]) <= 1.2, 'within a hand of the weight');
  await run(G, 100, past);
  G.host.press('delve:weight:0:0');
  assert.equal(G.host.state()[0].wt[0], WEIGHT.home, 'no line to the heart: left at home');
  await run(G, 100, home);
  G.host.press('delve:weight:0:0');
  assert.equal(G.host.state()[0].wt[0], WEIGHT.carried, 'in the ward: taken');
  G.host.destroy();
});

test('DLV4 MY FEET ARE MINE: the host keeps its own copy of the frame\'s feet - the motor\'s live Float32Array moves on after the frame, and a blow is judged where I stood in it (mutants: the motor\'s array kept)', async () => {
  _resetForTests();
  const D = dungeonOf(seedFor('wellsprings')), { host } = D, s = host.sites[0];
  const feet = new Float32Array([s.x, s.y, s.z]);
  for (let k = 0; k < HOLD_GATHER_MS + 200; k += 100) host.frame(0.1, feet);
  await flush();
  const hp0 = host.state()[0].hp[0];
  feet[0] = s.x + 40;   // the motor moved on after the frame
  assert.equal(host.hit(delveCrystalC(0, 0), 10, HIT_KINDS.Shaft), true, 'judged where I stood in the frame');
  assert.equal(host.state()[0].hp[0], hp0 - 10);
  host.destroy();
});

test('DLV4 THE VIGIL IN A ROOM: the relic is quarry its own foes hunt first while it runs; their blows on it take its light; the light gone, it rests a minute and wakes again to a step in (mutants: the mark unset; the relic hunted idle; the rest dropped)', async () => {
  _resetForTests();
  const D = dungeonOf(seedFor('vigil')), { host } = D, s = host.sites[0], feet = [s.x, s.y, s.z];
  assert.equal(s.kind, 'vigil');
  assert.deepEqual(host.wards(), [], 'a relic asleep is no quarry');
  await run(D, HOLD_GATHER_MS + 100, feet);
  const [relic] = host.wards();
  assert.ok(relic?.starWard && relic.site === 'delve:0');
  const foe = D.stood[0];
  assert.equal(foe.starSite, 'delve:0', 'its foes carry the relic\'s mark');
  const hostile = (starSite) => ({ starSite, ai: { isHostile: true }, entity: {} });
  assert.equal(huntsStar(hostile(foe.starSite), relic), true, 'a hostile of its own hunts it');
  assert.equal(huntsStar(hostile('delve:9'), relic), false, 'another site\'s does not');
  for (let n = 0; n < 30; n++) relic.hurtFromFoe();
  await run(D, 4_000, feet);
  assert.ok(host.state()[0].lt < 100, 'the foes\' blows drink its light');
  for (let n = 0; n < 200 && host.state()[0].p !== DP.idle; n++) { relic.hurtFromFoe(); relic.hurtFromFoe(); await run(D, 1_000, feet); }
  assert.equal(host.state()[0].p, DP.idle);
  assert.equal(midScreenText.text, 'The relic\'s light goes out. It wakes again in a minute.');
  assert.equal(host.state()[0].rest, true);
  await run(D, 300, [s.x + 20, s.y, s.z]);
  await run(D, 300, feet);
  assert.equal(host.state()[0].p, DP.idle, 'resting: a step back in wakes nothing');
  await run(D, VIGIL_REST_MS, [s.x + 20, s.y, s.z]);
  await run(D, 300, feet);
  assert.equal(host.state()[0].p, DP.gather, 'the minute run: it wakes');
  host.destroy();
});

test('DLV4 THE BRAZIER RITE IN A ROOM: the flame taken at the heart as I step on it, my step burdened and my weapon put up while I carry it, set to a brazier as I walk to it; a blow on me lets it fall, and it lies until I step off it and back; every brazier lit, won; the flames and the pedestals stood (mutants: the burden unregistered; the weapon left out; the blow ignored; a fallen flame taken up at once; a flame left burning at the heart)', async () => {
  _resetForTests();
  const D = dungeonOf(seedFor('brazier')), { host } = D, s = host.sites[0], heart = [s.x, s.y, s.z];
  assert.equal(s.kind, 'brazier');
  const pw = { sheathed: false };
  await run(D, PUZZLE_RISE_MS + 200, [s.x + 2, s.y, s.z], 0, pw);
  assert.equal(host.state()[0].p, DP.work);
  assert.equal(host.state()[0].k, 3, 'one in the ward: three braziers');
  assert.equal(footSpeedMult(), 1);
  await run(D, 200, heart, 0, pw);
  assert.equal(host.state()[0].fl, FLAME.carried, 'taken as I step on the heart');
  assert.equal(footSpeedMult(), DELVE_BURDEN, 'its burden on my step');
  assert.equal(pw.sheathed, true, 'my weapon put up');
  const b = brazierSpots(s, 3);
  for (let j = 0; j < 3; j++) {
    await run(D, 1_500, b[j], 0, pw);
    assert.equal(host.state()[0].lb & (1 << j), 1 << j, `brazier ${j} lit as I reach it`);
    if (j < 2) await run(D, 200, heart, 0, pw);
    if (j === 0) {
      hurtPlayer(D.me, 5);
      assert.equal(host.state()[0].fl, FLAME.lying, 'struck: it falls where I stand');
      await run(D, 500, [heart[0] + 0.3, heart[1], heart[2]], 0, pw);
      assert.equal(host.state()[0].fl, FLAME.lying, 'not taken up again while I stand over it - my hands are mine to fight with');
      assert.equal(pw.sheathed, true, 'put up as it fell, and left so');
      pw.sheathed = false;
      await run(D, 200, [heart[0] + 0.3, heart[1], heart[2]], 0, pw);
      assert.equal(pw.sheathed, false, 'readied again: nothing in my hands puts it up');
      await run(D, 100, [heart[0] + 2, heart[1], heart[2]], 0, pw);
      await run(D, 100, [heart[0] + 0.3, heart[1], heart[2]], 0, pw);
      assert.equal(host.state()[0].fl, FLAME.carried, 'stepped off and back: taken up');
    }
  }
  assert.equal(host.state()[0].won, true);
  assert.equal(footSpeedMult(), 1, 'the hands empty again');
  await flush();
  assert.equal(D.api.dynamicDraws.length, 1 + 3, 'the chest and three pedestals');
  host.destroy();
  assert.equal(D.api.dynamicDraws.length, 0);
  assert.equal(footSpeedMult(), 1);
});

test('DLV4 THE RITE\'S DRIFT IN A ROOM: a foe drifts in every 15 s while the rite is worked, off the rim\'s free axes - never onto a brazier\'s pedestal (AUDIT DLV4 F10; mutants: the drift from the gates)', async () => {
  _resetForTests();
  const D = dungeonOf(seedFor('brazier')), { host } = D, s = host.sites[0];
  const stand = [s.x + 1.8, s.y, s.z];   // in the disc, off the heart (no flame taken)
  await run(D, PUZZLE_RISE_MS + 200, stand);
  assert.equal(host.state()[0].p, DP.work);
  await run(D, DRIFT_EVERY_MS + 400, stand);
  const drifted = D.stood.filter((f) => f._delve?.drift);
  assert.ok(drifted.length >= 1, 'one drifted in');
  for (const f of drifted) assert.ok(driftSpots(s).some((p) => Math.hypot(p[0] - f.at[0], p[2] - f.at[2]) < 1e-6), 'off a rim spot of the law\'s');
  host.destroy();
});

test('DLV4 THE WEIGHING IN A ROOM: a weight pressed is taken, carried with its burden, set on the free plate I step onto; lifted off a plate, set back only when I step off and on; two set, and I stand on the third - held, then won (mutants: the press unread; the set on a taken plate; a lifted weight set straight back; my own plate unread)', async () => {
  _resetForTests();
  const D = dungeonOf(seedFor('weighing')), { host } = D, s = host.sites[0];
  assert.equal(s.kind, 'weighing');
  const homes = weightSpots(s), plates = weighPlates(s), pw = { sheathed: false };
  await run(D, 300, [s.x, s.y, s.z], 0, pw);
  assert.equal(host.state()[0].p, DP.work);
  const keys = D.targets().filter((t) => delveKeyWeight(t.key)).map((t) => t.key);
  assert.deepEqual(keys, ['delve:weight:0:0', 'delve:weight:0:1', 'delve:weight:0:2']);
  const box = D.targets().find((t) => t.key === 'delve:weight:0:0').aabb;
  assert.deepEqual([box.max[0] - box.min[0], box.max[2] - box.min[2], box.max[1] - box.min[1]].map((v) => Math.round(v * 100) / 100), [2 * DELVE_WEIGHT_HALF_M, 2 * DELVE_WEIGHT_HALF_M, 0.5], 'the box a press meets is the law\'s (DELVE_PRESS_M reads its half)');
  for (let j = 0; j < 2; j++) {
    await run(D, 200, homes[j], 0, pw);
    assert.equal(host.press(`delve:weight:0:${j}`), 1);
    assert.equal(host.state()[0].wt[j], WEIGHT.carried);
    await run(D, 100, homes[j], 0, pw);
    assert.equal(footSpeedMult(), DELVE_BURDEN, 'its burden from the next frame');
    if (j === 1) {   // long enough on it that the step law would believe a set there
      assert.ok(ktLeastMs(Math.hypot(plates[0][0] - homes[1][0], plates[0][2] - homes[1][2]), true) < 4_000);
      await run(D, 4_000, plates[0], 0, pw);
      assert.equal(host.state()[0].wt[1], WEIGHT.carried, 'a plate already weighed: kept in my hands, never let fall');
    }
    await run(D, 2_000, plates[j], 0, pw);
    assert.equal(host.state()[0].wt[j], WEIGHT.plate, `weight ${j} set on plate ${j}`);
  }
  // a weight lifted off its plate stays in my hands while I stand on it, and goes back on when I step off and on again
  assert.equal(host.press('delve:weight:0:1'), 1);
  await run(D, 300, plates[1], 0, pw);
  assert.equal(host.state()[0].wt[1], WEIGHT.carried, 'lifted off its plate: not set straight back on it');
  await run(D, 100, [plates[1][0] + 2, plates[1][1], plates[1][2]], 0, pw);
  await run(D, 2_000, plates[1], 0, pw);
  assert.equal(host.state()[0].wt[1], WEIGHT.plate, 'stepped off and on: set on it again');
  await run(D, 300, plates[2], 0, pw);
  assert.equal(midScreenText.text, 'All three plates are held. Keep them held.');
  await run(D, 3_200, plates[2], 0, pw);
  assert.equal(host.state()[0].won, true);
  host.destroy();
});

test('DLV4 THE SEALS IN A ROOM: they rise to a step in, the seam meets them, broken in their window the vault opens (mutants: the seam unread for seals; the rise unsaid)', async () => {
  _resetForTests();
  const D = dungeonOf(seedFor('seals')), { host } = D, s = host.sites[0], feet = [s.x, s.y, s.z];
  assert.equal(s.kind, 'seals');
  assert.deepEqual(s.vault, [s.x, s.y, s.z], 'the seals\' vault at the heart');
  await run(D, PUZZLE_RISE_MS + 200, feet);
  assert.equal(host.state()[0].p, DP.work);
  assert.equal(midScreenText.text, 'Break the 3 seals before they sink.');
  const spots = sealSpots(s, 3);
  assert.deepEqual(host.breakables().map((q) => q.feet), spots);
  for (let j = 0; j < 3; j++) for (let n = 0; host.state()[0].hp[j] > 0 && n < 100; n++) { await run(D, 300, spots[j]); host.hit(delveCrystalC(0, j), 1e6, HIT_KINDS.Melee); }
  assert.equal(host.state()[0].won, true);
  host.destroy();
});

test('DLV4 THE PIECES\' LOOKS: the flames at the heart and on each lit brazier\'s pedestal, one lying where it fell; the weights where they lie, none while carried; the marks of every kind on its floor (mutants: a lit brazier unlit; the pedestal\'s top; a carried weight drawn at home)', () => {
  const b = site({ kind: 'brazier', y: -2 });
  assert.deepEqual(siteFlames(b, null).map(([k]) => k), ['heart']);
  const spots = brazierSpots(b, 3);
  assert.equal(DELVE_PEDESTAL_TOP, 0.9, 'the pedestal model\'s top face, 36 units over its lowest point');
  assert.deepEqual(siteFlames(b, { p: DP.work, k: 3, lb: 0b101, fl: FLAME.carried }), [['b0', [spots[0][0], -1.1, spots[0][2]]], ['b2', [spots[2][0], -1.1, spots[2][2]]]]);
  assert.deepEqual(siteFlames(b, { p: DP.work, k: 3, lb: 0, fl: FLAME.lying, fx: [11, 0, 21] }), [['lying', [11, 0, 21]]]);
  assert.equal(siteFlames(b, null, true).length, 3, 'won: every brazier burns');
  const g = site({ kind: 'weighing' });
  assert.deepEqual(weightPlaces(g, null), weightSpots(g));
  const wt = [{ s: WEIGHT.carried }, { s: WEIGHT.plate, p: 1 }, { s: WEIGHT.floor, x: 9, y: 0, z: 19 }];
  assert.deepEqual(weightPlaces(g, { wt }), [null, weighPlates(g)[1], [9, 0, 19]]);
  for (const kind of ['wellsprings', 'vigil', 'brazier', 'weighing', 'seals']) {
    const sh = siteShapes(site({ kind }), null, [0, 0, 0], { seed: 3 });
    assert.ok(sh.length >= 2, `${kind}: its ring and its pieces`);
    assert.equal(sh[0].kind !== undefined, true);
  }
});

test('DLV4 THE CARRY ON ITS OWN: each carry its own registry name (one dungeon\'s teardown never takes the next one\'s burden); readied again, the piece let go (mutants: one shared name; the let-go unasked)', () => {
  const A = createDelveCarry(), B = createDelveCarry();
  B.set(true, () => true);
  A.destroy();
  assert.equal(footSpeedMult(), DELVE_BURDEN, 'A\'s teardown left B\'s burden');
  let dropped = 0;
  const pw = { sheathed: false };
  const C = createDelveCarry({ weapon: () => pw });
  C.set(true, () => { dropped++; return true; });
  C.frame(0);
  assert.equal(pw.sheathed, true);
  pw.sheathed = false;
  C.frame(10);
  assert.equal(dropped, 1, 'readied again: let go');
  C.set(true, () => { dropped++; return true; });
  C.frame(1_400);
  assert.equal(pw.sheathed, false, 'taken up again at once: the hands given back 1.5 s');
  C.frame(1_510);
  assert.equal(pw.sheathed, true, 'then put up again');
  B.destroy(); C.destroy();
  assert.equal(footSpeedMult(), 1);
});

test('DLV4 THE FOES\' MACHINE\'S POURS AND DRIFT: one at a time, each counted apart from the waves and from each other; a crumble takes them all (mutants: a pour counted a wave\'s; the drift unstamped)', async () => {
  const pool = [], host = { spawn: async (type, at) => { const f = { type, at, dead: false, ai: {}, entity: { health: 5 } }; pool.push(f); return f; }, remove: (f) => { f.dead = true; pool.splice(pool.indexOf(f), 1); }, pick: () => 3, elites: () => false, alive: () => true, foes: () => pool, now: () => 0 };
  const H = createHoldFoes(site(), host);
  H.pour(1, [1, 0, 1]); H.pour(1, [1, 0, 1]); H.drift([2, 0, 2]);
  assert.equal(H.sourceLive(1), 2, 'in flight, counted');
  await flush();
  H.frame();
  assert.deepEqual([H.sourceLive(0), H.sourceLive(1), H.driftLive()], [0, 2, 1]);
  assert.deepEqual(pool.map((f) => f._delve), [{ i: 0, g: 0, w: 0, cap: false, src: 1 }, { i: 0, g: 0, w: 0, cap: false, src: 1 }, { i: 0, g: 0, w: 0, cap: false, drift: true }]);
  assert.deepEqual(H.word(), { o: 1, kw: 0, kn: 0, wc: 0, cf: 0 }, 'no wave of theirs to clear');
  H.crumble();
  assert.equal(pool.length, 0);
});

test('DLV4 THE WIRING (HOST-SPLIT): the crystal seam reads the encounters\' pieces and sends their blows to the host, always on for a spell; the relic joins the foes\' quarry; the frame hands the facing and the weapon - no logical line added to the context (mutants: the seam\'s door; the quarry left out)', () => {
  const ctx = rd('src/scenes/dungeonContext.js');
  assert.match(ctx, /const list = sdRemnant \? sdRemnant\.heartTargets\(\) : dungeonCrystals\(opts\.gateCrystals\?\.\(\), delve\.breakables\(\)\);/);
  assert.match(ctx, /return isDelveCrystal\(cr\.crystal\) \? delve\.hit\(cr\.crystal, damage, r\) : sdRemnant/);
  assert.match(ctx, /crystalMarks: \(\) => gateCrystalBodies\(\)\.map\(/);
  assert.match(ctx, /: \[\]\)\), \.\.\.delve\.wards\(\)\] : null,/);
  assert.match(ctx, /delve\.frame\(dt, playerFeet, _fpYaw, playerWeapon\);/);
  const ceil = rd('test/scenes/hostceiling.test.js');
  const [, line, n] = /^(.*'src\/scenes\/dungeonContext\.js', 'buildDungeonContext', ([\d_]+), MODULE\].*)$/m.exec(ceil) ?? [];
  assert.ok(line && !/DLV[3-6]/.test(line), `the ceiling never raised for DLV4's kinds or after (${n})`);   // PIN MOVED (the merge of main, 2026-10-30): its ceiling rose to the sum of main's lines and DLV2's own wiring, said beside it
  const st = createStandIns();
  assert.equal(st(1000, 'seals'), st(1000, 'seals'), 'a stand-in made once');
  assert.equal(st(1000, 'seals').name, 'Seal');
  const out = breakTargets(site({ kind: 'seals' }), { p: DP.work, k: 3, hp: [0, 5, 5] }, st);
  assert.deepEqual(out.map((q) => q.c), [1001, 1002], 'a broken seal is no body');
  const r = makeRelic(site({ kind: 'vigil', i: 2 }), () => {});
  assert.deepEqual([r.site, r.ai.feet, r.entity.team], ['delve:2', [10, 0, 20], 'Civilian']);
  assert.deepEqual(holdGates(site()).length, 4);
  void newDelveLedger; void foldDelveWord; void stepDelve;
});
