// AUDIT GALLEON-2 (2026-10-03, the second audit of the new galleon) - HER AT SEA AND IN HARBOUR: what the first audit's
// G4, G6, R5 and D3 left undone, each pin seen to fail on the code as it stood (57baee705) before its fix:
//   GN1  her draft (G6's 4.7 m) against harbours sounded for the Carrack's 3.2: every berth was land to her keel, and
//        every merchant galleon, navy cutter and pirate brig stood at one lay frozen there for good - a harbour's berths
//        are sounded now for the deepest keel that berths (shipLife.js findHarbour, draftOf);
//   PF6  her draft a hard 4.7 whatever stood for hull 2 - read off her keel now (draftOf), the mod's galleon's fallen back;
//   PF2  the captains' dead zones and hit shares sounded once a hull for good - hull 2's build switches (G4);
//   RG3  her rig's boxes tore canvas furled or hidden - each box hers rides its own sail now (rigBoxesOf);
//   RG4  her canvas lost "highest first" by each sail NODE's height - her jib's node is at her origin: by its canvas now;
//   RG6  a sea ship's fore-and-aft canvas bellied to starboard whichever side the wind was on.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import * as LIFE from '../src/systems/naval/shipLife.js';
import * as AI from '../src/systems/naval/navalAI.js';
import { HULL, HULL_BUILDS, hullBuild, setGalleonStanding, batteryOf } from '../src/systems/naval/navalShips.js';
import { rigBoxesOf, sailsShown } from '../src/scenes/navalHost.js';
import { segmentBoxEntry } from '../src/systems/naval/navalBallistics.js';
import { animatorOf } from '../src/systems/comeSailAwayBoat.js';
import { stowSail } from '../src/systems/comeSailAway.js';
import { sampleDepthMeters } from '../src/world/deepBathymetry.js';
import { sea } from './navalSea.mjs';
import { scene } from './csaScene.mjs';

const WORLD = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const { findHarbour, createWaterGrid, footprintClear } = LIFE;
/** Iliac Puddle No More's carved shelf (world/deepBathymetry.js, the mod's default depth) off a straight coast - land at
 *  x <= 0 - at `k`'s place along its noise; and world.js navalIsWater's law over it: a floor her draft under the sea. */
const shelf = (k) => (x, z) => (x <= 0 ? -1 : sampleDepthMeters(431_000 + k * 3170 + x, 212_000 + k * 1930 + z, 165, x, null));
const lawOver = (depth) => (x, z, hull = 0) => { const d = depth(x, z); return d > 0 && d > (hull < 0 ? 0.05 : LIFE.draftOf(hull)); };
const TOWN = { minX: -260, maxX: -40, minZ: -120, maxZ: 120 };
/** The hulls a harbour stands or takes in: the coaster and sloop, the galleon (merchant, cutter, brig), the carrack. */
const BERTHERS = [HULL.LargeBoat, HULL.SmallShip, HULL.Carrack];

test('AUDIT GALLEON-2 GN1: a harbour off a carved shelf berths the deepest keel that berths - at every berth her footprint floats each hull that may take it (the galleon\'s 4.7 m too, and the mod\'s galleon\'s fallen back), and each has her way out to the mouth and in again (the berths were sounded for the Carrack\'s 3.2: none of 240 floated hull 2, and none had a way out)', (t) => {
  const bad = [], offs = [];
  let n = 0;
  for (const standing of [true, false]) {
    setGalleonStanding(standing);
    try {
      for (let k = 0; k < 10; k++) {
        const depth = shelf(k), isWater = lawOver(depth);
        const h = findHarbour({ rect: TOWN, isWater });
        assert.ok(h && h.berths.length >= 3, `a harbour at place ${k} (${standing ? 'her' : 'the mod\'s galleon'})`);
        const grids = new Map(), grid = (hull) => grids.get(hull) ?? (grids.set(hull, createWaterGrid({ isWater, hull })), grids.get(hull));
        for (const b of h.berths) {
          n++;
          offs.push(b.pos[0]);
          for (const hull of BERTHERS) {
            if (!footprintClear(b.pos, b.yaw, hull, isWater)) bad.push(`place ${k} berth ${b.pos.map((v) => v.toFixed(0))} (${depth(b.pos[0], b.pos[1]).toFixed(2)} m): hull ${hull} aground`);
            else if (!grid(hull).path(b.pos, h.mouth) || !grid(hull).path(h.mouth, b.pos)) bad.push(`place ${k} berth ${b.pos.map((v) => v.toFixed(0))}: hull ${hull} has no way out and in`);
          }
        }
      }
    } finally { setGalleonStanding(true); }
  }
  t.diagnostic(`${n} berths, ${Math.min(...offs).toFixed(0)}-${Math.max(...offs).toFixed(0)} m off the shore`);
  assert.deepEqual(bad.slice(0, 6), [], `every berth floats and sails every hull that berths (${bad.length} of ${n * BERTHERS.length})`);
});

test('AUDIT GALLEON-2 GN1: the naval host\'s harbour over a carved shelf - its moored galleons (merchantmen and the crown\'s cutters) put out when their dwell is done, as its coasters and carracks do (they lay frozen at their berths, 0.0 m from them after 240 s, their errands given up)', async () => {
  const depth = (x, z) => (z >= 200 ? -1 : sampleDepthMeters(431_000 + x, 212_000 + z, 165, 200 - z, null));
  const h = await sea({ hull: null, settings: { ShipsAtSea: 'few' }, seed: 9 });
  h.deps.isWater = (x, z, hull = 0) => { const d = depth(x, z); return d > 0 && d > (hull < 0 ? 0.05 : LIFE.draftOf(hull)); };
  h.view.feet = [0, 0, 300];
  h.deps.harbourNear = () => ({ key: 'port:1', rect: { minX: -100, maxX: 100, minZ: 220, maxZ: 420 } });
  h.run(1);
  const moored = [...h.host._sea.values()].filter((e) => e.ship.errand?.kind === 'moored');
  assert.ok(moored.some((e) => e.ship.hull === HULL.SmallShip), `a galleon among the port's ships (${moored.map((e) => e.ship.cls.id)})`);
  const start = new Map(moored.map((e) => [e.id, [...e.ship.pos]]));
  for (const e of moored) e.ship.errand.until = 0;   // every dwell done
  h.view.feet = [0, 0, 330];
  h.run(150, 0.1);
  const held = [];
  for (const e of moored) {
    const s = start.get(e.id), live = h.host._sea.get(e.id);
    if (!live) continue;   // sailed out of the world
    const moved = Math.hypot(live.ship.pos[0] - s[0], live.ship.pos[2] - s[2]);
    if (moved < 60 || !live.ship.errand) held.push(`${e.ship.cls.id} (hull ${e.ship.hull}): ${moved.toFixed(1)} m from her berth, errand ${live.ship.errand?.kind ?? 'none'}`);
  }
  assert.deepEqual(held, [], 'every one under way on her errand');
});

test('AUDIT GALLEON-2 PF6: a hull\'s draft (shipLife.js draftOf - world.js navalIsWater\'s) is read off hull 2\'s keel as she stands: the new galleon\'s 4.7 over her 4.64 m keel, the mod\'s galleon\'s 3.41 over its 3.35 fallen back (she was kept out of the 3.4-4.7 m water she can sail); the other hulls\' the table\'s', () => {
  assert.equal(typeof LIFE.draftOf, 'function', 'shipLife.js draftOf');
  try {
    for (const standing of [true, false]) {
      setGalleonStanding(standing);
      const keel = -hullBuild(HULL.SmallShip).keel, d = LIFE.draftOf(HULL.SmallShip);
      assert.ok(d >= keel && d - keel <= 0.1, `${standing ? 'her' : 'the mod\'s galleon\'s'} draft ${d} over her keel ${keel}`);
    }
    setGalleonStanding(true); assert.ok(Math.abs(LIFE.draftOf(HULL.SmallShip) - 4.7) < 1e-9, 'standing: 4.7');
    setGalleonStanding(false); assert.ok(Math.abs(LIFE.draftOf(HULL.SmallShip) - 3.41) < 1e-9, 'fallen back: 3.41');
  } finally { setGalleonStanding(true); }
  assert.deepEqual([HULL.Rowboat, HULL.LargeBoat, HULL.LargeGalley].map(LIFE.draftOf), [0.8, 1.4, 2.8], 'the others as they were');
  // PIN MOVED (SHIPS-2, 2026-10-07): hull 4 is Mac's carrack - her draft her keel's as the galleon's is (4.65 over her
  // 4.59 m keel), the mod's Carrack's 3.2 fallen back (test/ships2_carrack.test.js holds both)
  assert.ok(Math.abs(LIFE.draftOf(HULL.Carrack) - (LIFE.DRAFT_SPARE - hullBuild(HULL.Carrack).keel)) < 1e-9, 'the Carrack\'s her keel\'s');
  // world.js asks it when it sounds - no frozen table of its own
  const law = WORLD.slice(WORLD.indexOf('const navalIsWater = '), WORLD.indexOf('let _navalCapitals'));
  assert.match(law, /draftOf\(hull\)/i, 'navalIsWater reads draftOf');
  assert.doesNotMatch(WORLD, /NAVAL_DRAFT = Object\.freeze/, 'no frozen draft table in world.js');
});

test('AUDIT GALLEON-2 PF2: the captains\' dead zones (layMin) and hit shares (hitShare) follow hull 2\'s build when it switches - each reckoned while the new galleon stands, then fallen back to the mod\'s galleon, answers the mod\'s galleon\'s own (they kept hers: her broadside\'s dead zone on a Large Boat 11 m against its 26)', async () => {
  const cold = await import('../src/systems/naval/navalAI.js?pf2-cold');   // a captains' module asked only of the mod's galleon
  const asks = {
    'layMin(her broadside, a Large Boat)': (ai) => ai.layMin(HULL.SmallShip, 'starboard', HULL.LargeBoat),
    'layMin(her chasers, a Carrack)': (ai) => ai.layMin(HULL.SmallShip, 'bow', HULL.Carrack),
    'hitShare(a galley\'s great guns, her)': (ai) => ai.hitShare(batteryOf(HULL.LargeGalley, 'bow'), 0.3, HULL.SmallShip),
  };
  try {
    for (const [what, ask] of Object.entries(asks)) {   // each on its own: one asked first empties nothing for another
      setGalleonStanding(true);
      const hers = ask(AI);
      setGalleonStanding(false);
      const theirs = ask(cold);
      assert.notEqual(theirs, hers, `${what}: the mod's galleon's is not hers`);
      assert.equal(ask(AI), theirs, `${what}: fallen back, the mod's galleon's own`);
      setGalleonStanding(true);
      assert.equal(ask(AI), hers, `${what}: standing again, hers`);
    }
  } finally { setGalleonStanding(true); }
});

/** Her boat placed (every sail stowed, as a boat stands), its sails set by `set` (each its animator's Stowed). */
function herBoat() {
  const s = scene();
  const boat = s.place(HULL.SmallShip, 0, [12, 0, -30], [0.6, 0, 0.8]);
  const setAll = (on) => { for (const sail of boat.Sails) stowSail(animatorOf(sail), !on); };
  return { s, boat, setAll };
}

test('AUDIT GALLEON-2 RG3: her rig\'s boxes are her canvas where it hangs - each rides its own sail (`sail`, the k-th of her Sails) and goes with it furled or hidden; set, all seven; the other hulls\' boxes stand whatever their sails do (all five furled, her seven boxes stood and a ball 1.7 m under the main topsail\'s furled roll tore it; a hidden topsail\'s box took balls)', () => {
  const { boat, setAll } = herBoat();
  const rig = hullBuild(HULL.SmallShip).rig;
  // each box names its sail: a boom's box the sail on that boom, the jib's three the jib
  for (const box of rig) {
    const b = /** @type {any} */ (box);
    assert.ok(Number.isInteger(b.sail), 'each of her boxes names its sail');
    const want = b.boom != null ? boat.Booms[b.boom].children[0] : boat.Sails.find((x) => /Jib/.test(x.name));
    assert.equal(boat.Sails[b.sail], want, `box on ${b.boom != null ? boat.Booms[b.boom].name : 'the forestay'}: ${boat.Sails[b.sail]?.name}`);
  }
  assert.ok(boat.Sails.every((x) => animatorOf(x).GetBool('Stowed')), 'placed: all furled');
  assert.equal(rigBoxesOf(boat).length, 0, 'furled: no canvas, no box');
  setAll(true);
  const all = rigBoxesOf(boat);
  assert.equal(all.length, rig.length, 'set: every box');
  // the main topsail hidden (her sail share): its box gone, a ball through where it stood misses her rig
  const k = rig.findIndex((b) => /** @type {any} */ (b).sail === boat.Sails.findIndex((x) => /MainTopsail/.test(x.name)));
  const c = all[k].c, a = [c[0] - 30, c[1], c[2]], z = [c[0] + 30, c[1], c[2]];
  assert.ok(segmentBoxEntry(a, z, all[k], 0.1), 'set, the ball tears it');
  boat.Sails.find((x) => /MainTopsail/.test(x.name)).setActive(false);
  const less = rigBoxesOf(boat);
  assert.equal(less.length, rig.length - 1, 'hidden: its box gone');
  assert.ok(!less.some((bx) => segmentBoxEntry(a, z, bx, 0.1)), 'and the ball meets none of hers');
  // one furled: its box alone gone
  boat.Sails.find((x) => /MainTopsail/.test(x.name)).setActive(true);
  stowSail(animatorOf(boat.Sails.find((x) => /ForeCourse/.test(x.name))), true);
  assert.equal(rigBoxesOf(boat).length, rig.length - 1, 'the fore course furled: its box gone');
  // the other hulls: their boxes as they stood, furled or set. PIN MOVED (SHIPS-2, 2026-10-07): hulls 4 and 1 are Mac's
  // carrack and Tiny Ship - their boxes each a sail's of theirs, as hers are (the large boat's of her plan's): furled
  // none, set every one of hers (test/ships2_carrack.test.js, test/ships2_largeboat.test.js)
  const theirs = [HULL.Carrack, HULL.LargeBoat];
  for (const b of HULL_BUILDS.filter((x) => x.hull !== HULL.SmallShip && !theirs.includes(x.hull))) for (const box of b.rig) assert.equal(/** @type {any} */ (box).sail, undefined, `hull ${b.hull}'s boxes name no sail`);
  for (const hull of theirs) for (const box of hullBuild(hull).rig) assert.ok(Number.isInteger(/** @type {any} */ (box).sail), `hull ${hull}'s boxes each name a sail`);
  for (const hull of [HULL.LargeBoat, HULL.LargeGalley, HULL.Carrack]) {
    const o = scene().place(hull, 0, [0, 0, 0], [0.6, 0, 0.8]);
    const mine = hullBuild(hull).rig.filter((b) => /** @type {any} */ (b).variant == null || /** @type {any} */ (b).variant === 0);
    const furled = rigBoxesOf(o).length;
    for (const sail of o.Sails) stowSail(animatorOf(sail), false);
    assert.equal(furled, theirs.includes(hull) ? 0 : mine.length, `hull ${hull} furled: ${theirs.includes(hull) ? 'no box' : 'every box'}`);
    assert.equal(rigBoxesOf(o).length, mine.length, `hull ${hull} set: every box of hers`);
  }
});

test('AUDIT GALLEON-2 RG4: a sea galleon loses her highest canvas first - by where each sail\'s canvas hangs, not its node (her jib\'s node is at her origin, her gaff\'s at its boom\'s foot): the main topsail, the fore topsail, the jib, the gaff sail, the fore course - and at four tenths of her canvas she keeps her two lowest; the other hulls\' order as it was (her jib went last, and at 0.4 she kept the gaff and the jib, losing her fore course)', async () => {
  for (const sailsAt of [1, 0]) {   // launched under sail, and moored (her sails stowed at her first pose)
    const h = await sea({ hull: null, wind: [0, 0, 0] });
    const id = h.host.spawnShip('merchantGalleon', { range: 300, bearing: 0, yaw: 0 });
    const e = h.host._sea.get(id);
    e.ship.sails = sailsAt; e.ship.sailsWant = sailsAt;
    h.host.frame(0.1);
    const names = e.sailsByHeight.map((s) => s.name.replace(/Square|Small|Large|Stay|Sail/g, ''));
    assert.deepEqual(names, ['MainTopsail', 'ForeTopsail', 'Jib', 'MainGaff', 'ForeCourse'], `highest first (sails ${sailsAt})`);
    const d = e.ship.damage;
    d.apply({ hull: 0, sail: d.maxSail - Math.floor(d.maxSail * 0.4), crew: 0 }, 0);
    h.host.frame(0.1);
    assert.equal(sailsShown(5, d.sailShare()), 2);
    assert.deepEqual(e.boat.Sails.filter((s) => s.activeSelf).map((s) => s.name).sort(), ['ForeCourseSquareSail', 'MainGaffLargeSail'], 'her two lowest kept');
  }
  // PIN MOVED (SHIPS-2, 2026-10-07): a merchant carrack is Mac's carrack - by where each canvas of hers hangs, as the
  // galleon's: her main topsail, her lateen mizzen, her main course, her fore course, her spritsail
  {
    const h = await sea({ hull: null, wind: [0, 0, 0] });
    const e = h.host._sea.get(h.host.spawnShip('merchantCarrack', { range: 300, bearing: 0, yaw: 0 }));
    h.host.frame(0.1);
    assert.deepEqual(e.sailsByHeight.map((s) => s.name), ['MainTopsailSquareSail', 'MizzenLateenSail', 'MainCourseSquareLargeSail', 'ForeCourseSquareLargeSail', 'SpritsailSquareSmallSail'], 'merchantCarrack: highest canvas first');
  }
  // the mod's hulls: by each sail node's height, as they stood (a pirate sloop is Mac's Tiny Ship on her first plan:
  // one lateen)
  for (const cls of ['pirateSloop', 'pirateGalley']) {
    const h = await sea({ hull: null, wind: [0, 0, 0] });
    const e = h.host._sea.get(h.host.spawnShip(cls, { range: 300, bearing: 0, yaw: 0 }));
    h.host.frame(0.1);
    const want = [...e.boat.Sails].sort((p, q) => q.worldMatrix()[13] - p.worldMatrix()[13]);
    assert.deepEqual(e.sailsByHeight.map((s) => s.name), want.map((s) => s.name), `${cls}: by her nodes`);
  }
});

test('AUDIT GALLEON-2 RG6: a sea ship\'s fore-and-aft canvas bellies to the side the wind blows it to - her gaff sail and jib, a Carrack\'s lateen - each Wind signed as Come Sail Away\'s sailWind signs it; her square canvas full either way (every Wind was min(1, wind): her gaff and jib bellied to starboard in a wind blowing to port)', async () => {
  const windOf = async (cls, W) => {
    const h = await sea({ hull: null, wind: W });
    h.deps.csa = () => ({ state: { windVectorCurrent: W, AllBoats: [] }, isSailing: () => false });
    const e = h.host._sea.get(h.host.spawnShip(cls, { range: 300, bearing: 0, yaw: 0 }));
    e.ship.pos = [0, 0, 300]; e.ship.yaw = 0;
    e.ship.sails = 1; e.ship.sailsWant = 1;
    h.host.frame(0.1);
    e.ship.yaw = 0;
    h.host.frame(0.1);
    const out = {};
    for (const s of e.boat.Sails) out[s.name] = animatorOf(s).GetFloat('Wind');
    return { out, boat: e.boat };
  };
  for (const [W, sign] of [[[-1.2, 0, 0.3], -1], [[1.2, 0, 0.3], 1]]) {
    const { out, boat } = await windOf('merchantGalleon', W);
    for (const s of [...boat.SailsGaff, ...boat.SailsStay]) assert.equal(Math.sign(out[s.name]), sign, `${s.name} in a wind to ${sign > 0 ? 'starboard' : 'port'}: ${out[s.name]}`);
    for (const s of boat.SailsSquare) assert.ok(out[s.name] > 0, `${s.name} full: ${out[s.name]}`);
    const c = await windOf('merchantCarrack', W);
    for (const s of c.boat.SailsLateen) assert.equal(Math.sign(c.out[s.name]), -sign, `the Carrack's ${s.name} (sailWind's lateen sign): ${c.out[s.name]}`);
  }
});
