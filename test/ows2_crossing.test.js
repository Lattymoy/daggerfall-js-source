// OWS2 (2026-09-28, the player's ask: "You should transition to your boat if traveling across water then back onto
// land when hitting land") - THE CROSSING. An Overworld journey whose route puts to sea walks to the shore, launches
// the boat (a packable one's parts put on the water, or the boat at whose helm the traveller stands, or theirs moored
// within reach), sails its sea legs through Come Sail Away's own keys, and at the landfall leaves the helm, steps ashore
// and packs a packable boat.
//
// Pinned here: the planner's sea layers (systems/travelRoute.js - a launch, sailed steps, a landfall; the boat to hand
// again when it packs, left behind when it does not; a spot on the water reached afloat; never through a corner of
// the land; the coast's dearer steps), the journey's hand on the helm (systems/seaHelm.js - the course, the beat and the
// tack, the oars that turn a boat and take it ashore, the calm, the stall, the land ahead, a crew's faster oars), the
// mod's OWN runtime sailing real hulls to a mark in every wind through those keys alone, the runtime's two doors for the
// Overworld (LaunchFromParts, nodeReadingAt) and the pool's rig, Travel Options' stops afloat and its sailed legs'
// squares, and the world host's wiring by source.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { planRoute, routeLegs, roadShare, crossesWater, dryLine, SEA_COST, SEA_KINDS } from '../src/systems/travelRoute.js';
import { seaHelmStep, createSeaHelm, SEA_HELM, foldDeg, headingOf, squareOnly } from '../src/systems/seaHelm.js';
import { comeSailAwayModels } from '../src/systems/comeSailAwayModels.js';
import { spawnBoat, Boat } from '../src/systems/comeSailAwayBoat.js';
import { createComeSailAwayRuntime, NO_WATER_LEVEL, BOAT_ACTIONS, HANDLING, WATER_LEVEL } from '../src/systems/comeSailAway.js';
import { createComeSailAwayPool } from '../src/scenes/comeSailAwayPool.js';
import { createTravelOptions, SEA_LEG_SIZE, SEA_LEG_LO, SEA_SPOT_SIZE } from '../src/systems/travelOptions.js';
import { TRAVEL_VIEW_TEXT, travelTripLine } from '../src/scenes/travelView.js';
import { quatRotate } from '../src/world/quat.js';

// PIN MOVED (AUDIT OW5 G2): the Overworld's own lines are said through tvSay - held at the scale they are said at
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// ── THE PLANNER'S SEA ───────────────────────────────────────────────────────────────────────────────────────────────

const W = 40, H = 20;
const channel = (x) => x >= 12 && x <= 24;   // a sound thirteen pixels wide, bank to bank

test('OWS2 route: with no boat the sea is refused as ever; with the parts in the pack the route LAUNCHES at the shore, SAILS the water and makes its LANDFALL, each a leg of its own', () => {
  const opts = { isWater: (x) => channel(x), width: W, height: H };
  assert.equal(planRoute({ x: 5, y: 5 }, { x: 30, y: 5 }, opts), null, 'no bridge, no boat: no route');
  const r = planRoute({ x: 5, y: 5 }, { x: 30, y: 5 }, { ...opts, sea: { start: 'land', again: true } });
  assert.ok(r);
  const firstSea = r.kinds.indexOf('embark');
  assert.ok(firstSea > 0 && r.kinds[firstSea + 1] === 'sea', 'the launch, then the water sailed');
  assert.equal(r.kinds.filter((k) => k === 'embark').length, 1);
  assert.equal(r.kinds.filter((k) => k === 'landfall').length, 1);
  assert.ok(r.pixels.slice(firstSea + 1, r.kinds.indexOf('landfall') + 1).every((p) => channel(p.x)), 'afloat only on the water');
  assert.deepEqual(routeLegs(r.pixels, r.kinds).map((l) => l.kind), ['open', 'embark', 'sea', 'landfall', 'open'], 'each crossing step its own leg - the sailed run folded');
  assert.equal(crossesWater(r.kinds), true);
  assert.equal(crossesWater(['road', 'open']), false);
  assert.deepEqual([...SEA_KINDS], ['sea', 'embark', 'landfall']);
  assert.equal(roadShare(['road', 'sea', 'sea', 'embark']), 0.25, 'a sailed step is on no road');
  // the cost: the land walked (open), the launch (a sailed step and the shore's), the landfall (a step up the beach and
  // the shore's), the water sailed - the last step, beside the far bank, the coast's
  const open = r.kinds.filter((k) => k === 'open').length;
  const sea = r.kinds.filter((k) => k === 'sea').length;
  assert.ok(Math.abs(r.cost - (open * 3.5 + (SEA_COST.sea + SEA_COST.shore) + (3.5 + SEA_COST.shore) + (sea - 1) * SEA_COST.sea + SEA_COST.coast)) < 1e-9, `the steps' own costs (${r.cost})`);
});

test('OWS2 route: a boat that packs launches again at the next water; one left where it landed (a crewed ship) does not - and afloat at the start, the route begins at sea', () => {
  const two = (x) => (x >= 8 && x <= 12) || (x >= 20 && x <= 24);
  const opts = { isWater: two, width: W, height: H };
  const packs = planRoute({ x: 2, y: 5 }, { x: 30, y: 5 }, { ...opts, sea: { start: 'land', again: true } });
  assert.equal(packs.kinds.filter((k) => k === 'embark').length, 2, 'packed at the first landfall, launched again at the second water');
  assert.equal(planRoute({ x: 2, y: 5 }, { x: 30, y: 5 }, { ...opts, sea: { start: 'land', again: false } }), null, 'a boat left at the first landfall crosses no second water');
  const afloat = planRoute({ x: 10, y: 5 }, { x: 16, y: 5 }, { ...opts, sea: { start: 'sea', again: false } });
  assert.equal(afloat.kinds[0], 'sea', 'at the helm: the first step is sailed');
  assert.ok(afloat.kinds.includes('landfall') && !afloat.kinds.includes('embark'));
  const bay = planRoute({ x: 13, y: 5 }, { x: 13, y: 5 }, { ...opts, sea: { start: 'sea', again: false } });
  assert.ok(bay.kinds.includes('landfall') && !bay.kinds.includes('embark'), 'afloat in a land pixel\'s bay, its own pixel asked: the landfall is still made');
  assert.deepEqual(bay.pixels.at(-1), { x: 13, y: 5 });
  assert.equal(planRoute({ x: 10, y: 5 }, { x: 10, y: 5 }, { ...opts, sea: { start: 'sea', again: false } }), null, 'afloat mid-water, the water asked as a land goal: no shore there');
});

test('OWS2 route: a spot on the water is reached AFLOAT - even one in a land pixel\'s bay; a boat never sails through a corner of the land; the route keeps off the coast where the sea is wide', () => {
  const opts = { isWater: (x) => channel(x), width: W, height: H };
  const spot = planRoute({ x: 5, y: 5 }, { x: 18, y: 12 }, { ...opts, sea: { start: 'land', again: true, goal: 'sea' } });
  assert.deepEqual(spot.pixels.at(-1), { x: 18, y: 12 });
  assert.ok(!spot.kinds.includes('landfall') && spot.kinds.at(-1) === 'sea', 'ends at sea');
  const bay = planRoute({ x: 5, y: 5 }, { x: 11, y: 5 }, { ...opts, sea: { start: 'land', again: true, goal: 'sea' } });
  assert.ok(bay && ['sea', 'embark'].includes(bay.kinds.at(-1)), 'a spot on the water of a land pixel is sailed to, never walked to');
  assert.equal(planRoute({ x: 5, y: 5 }, { x: 11, y: 5 }, { ...opts, sea: { start: 'land', again: false, goal: 'sea' } })?.kinds.at(-1) === 'open', false);
  // the corner: water on x + y <= 10 and x + y >= 12 (a solid diagonal isthmus of land on x + y = 11)
  const isthmus = (x, y) => x + y !== 11;
  const c = planRoute({ x: 2, y: 2 }, { x: 9, y: 9 }, { isWater: isthmus, width: 20, height: 20, sea: { start: 'sea', again: false, goal: 'sea' } });
  assert.equal(c, null, 'a solid diagonal of land is a wall afloat - a boat that cannot land (no `again`, a spot at sea) has no way round');
  if (c) {
    for (let i = 1; i < c.pixels.length; i++) {
      const a = c.pixels[i - 1], b = c.pixels[i];
      if (c.kinds[i - 1] !== 'sea' || a.x === b.x || a.y === b.y) continue;
      assert.ok(isthmus(b.x, a.y) || isthmus(a.x, b.y), 'no diagonal between two land pixels');
    }
  }
  // the coast's dearer steps: along a wide sea's shore or a pixel off it, the route stands off
  const wide = (x, y) => y >= 3;   // the land a strip along the top
  const along = planRoute({ x: 2, y: 5 }, { x: 30, y: 5 }, { isWater: wide, width: W, height: H, sea: { start: 'sea', again: false, goal: 'sea' } });
  assert.ok(along.pixels.slice(1, -1).every((p) => p.y >= 4), 'never the row against the land where the row beyond is as short');
  assert.equal(SEA_COST.sea, 1.2);
  assert.ok(SEA_COST.coast > SEA_COST.sea && SEA_COST.shore > SEA_COST.coast);
});

test('OWS2 route: the dry line - AUDIT DEEP T2-1\'s law in one home, the resume\'s and the Overworld spot walk\'s', () => {
  const sea = (x) => x === 10;
  assert.equal(dryLine({ x: 5, y: 3 }, { x: 15, y: 3 }, sea), false);
  assert.equal(dryLine({ x: 5, y: 3 }, { x: 9, y: 9 }, sea), true);
  assert.match(rd('src/systems/travelOptions.js'), /return dryLineOf\(a, b, deps\.isWater\);/);
});

// ── THE JOURNEY'S HAND ON THE HELM ──────────────────────────────────────────────────────────────────────────────────

/** A frame's ask: the bow north, the wind from the west (blowing east), sails down, making no way. */
const ask = (o = {}) => ({ heading: 0, bearing: 0, wind: [1.5, 0], hasSails: true, sailsUp: false, canSail: true, way: 0, dt: 0.25, ...o });

test('OWS2 helm: off the wind the course is the mark\'s bearing - the rudder held toward it past the dead band, the sails raised when the boat can sail, never the oars', () => {
  assert.equal(foldDeg(190), -170);
  assert.equal(foldDeg(-180), 180);
  assert.equal(headingOf(1, 0), 90);
  const st = createSeaHelm();
  const a = seaHelmStep(st, ask({ bearing: 20, heading: 0 }));
  assert.deepEqual([a.turn, a.sails, a.row, a.course], [1, 'raise', false, 20]);
  assert.equal(seaHelmStep(st, ask({ bearing: 3, heading: 0, sailsUp: true, way: 2 })).turn, 0, 'within the dead band: let go');
  assert.equal(seaHelmStep(st, ask({ bearing: -20, heading: 0, sailsUp: true, way: 2 })).turn, -1);
  assert.equal(seaHelmStep(createSeaHelm(), ask({ canSail: false })).sails, null, 'obstructed: not raised (RaiseSails would refuse)');
  assert.equal(SEA_HELM.deadDeg, 4);
});

test('OWS2 helm: a mark in the no-go cone is BEATEN up to - the course the eye plus or minus the rig\'s angle, the tack held until the mark swings past the eye by the lane, then about; square sails alone beat wider', () => {
  const st = createSeaHelm();
  const wind = [0, -1.5];   // blowing south: the eye due north
  const b = seaHelmStep(st, ask({ wind, bearing: 10, heading: 45, sailsUp: true, way: 2 }));
  assert.equal(b.course, SEA_HELM.noGoFore, 'the mark 10 right of the eye: the right tack, 35 off it');
  assert.equal(st.tack, 1);
  assert.equal(seaHelmStep(st, ask({ wind, bearing: -15, heading: 35, sailsUp: true, way: 2 })).course, 35, 'the mark 15 past the eye: the tack held');
  const about = seaHelmStep(st, ask({ wind, bearing: -(SEA_HELM.laneDeg + 1), heading: 35, sailsUp: true, way: 2 }));
  assert.equal(about.course, -35, 'past the lane: about');
  assert.equal(st.tack, -1);
  const sq = createSeaHelm();
  assert.equal(seaHelmStep(sq, ask({ wind, bearing: 0, heading: 60, squareOnly: true, sailsUp: true, way: 2 })).course, SEA_HELM.noGoSquare);
  assert.equal(seaHelmStep(createSeaHelm(), ask({ wind, bearing: 90, heading: 90 })).course, 90, 'a beam reach is sailed straight');
  assert.equal(squareOnly({ Sails: [1], SailsSquare: [1] }), true);
  assert.equal(squareOnly({ Sails: [1, 2], SailsSquare: [1] }), false, 'a lateen aboard beats close');
  assert.equal(squareOnly({ Sails: [], SailsSquare: [] }), false);
});

test('OWS2 helm: the oars - to turn the boat more than the sails can (the sails lowered meanwhile), in a calm, for a spell after the sails made no way, to take the boat in to a landfall, away from land ahead, and whenever a crew rows the faster', () => {
  const turning = seaHelmStep(createSeaHelm(), ask({ bearing: 90, heading: 0, sailsUp: true, way: 2 }));
  assert.deepEqual([turning.row, turning.sails, turning.turn], [true, 'lower', 1], 'ninety off: the oars bring it round');
  assert.equal(seaHelmStep(createSeaHelm(), ask({ wind: [0.2, 0] })).row, true, 'a calm fills no sail');
  const st = createSeaHelm();
  let cmd = null;
  for (let t = 0; t < SEA_HELM.stallS + 0.5; t += 0.25) cmd = seaHelmStep(st, ask({ sailsUp: true, way: 0.1 }));
  assert.deepEqual([cmd.row, cmd.sails], [true, 'lower'], 'no way made under sail: the oars');
  for (let t = 0; t < SEA_HELM.oarsS - 1; t += 0.25) cmd = seaHelmStep(st, ask({ sailsUp: false, way: 2 }));
  assert.equal(cmd.row, true, 'for the spell');
  for (let t = 0; t < 2; t += 0.25) cmd = seaHelmStep(st, ask({ sailsUp: false, way: 2 }));
  assert.deepEqual([cmd.row, cmd.sails], [false, 'raise'], 'then the sails again');
  const coming = seaHelmStep(createSeaHelm(), ask({ landfall: true, landAhead: SEA_HELM.rowInM, sailsUp: true, way: 3 }));
  assert.deepEqual([coming.row, coming.sails], [true, 'lower'], 'a landfall\'s shore near: rowed in');
  const off = seaHelmStep(createSeaHelm(), ask({ landAhead: 60, freer: -1, sailsUp: true, way: 3 }));
  assert.deepEqual([off.row, off.turn, off.course], [true, -1, -90], 'land ahead: hard over to the freer hand, under oars');
  assert.equal(seaHelmStep(createSeaHelm(), ask({ landAhead: 60, landfall: true })).course, 0, 'a landfall goes on at its shore');
  const crew = seaHelmStep(createSeaHelm(), ask({ crewed: true, oarWay: 8, sailWay: 4.5 }));
  assert.equal(crew.row, true, 'the Large Galley\'s crew rows at eight against its sail\'s four and a half');
  assert.equal(seaHelmStep(createSeaHelm(), ask({ crewed: true, oarWay: 1, sailWay: 3 })).row, false, 'the Small Ship sails');
  assert.equal(seaHelmStep(createSeaHelm(), ask({ oarWay: 2, sailWay: 1 })).row, false, 'a lone rower pays the fatigue: a crewless boat sails');
  assert.equal(seaHelmStep(createSeaHelm(), ask({ hasSails: false })).row, true, 'no sails: the oars');
});

// ── THE MOD'S OWN HELM, SAILED BY THOSE KEYS ALONE ──────────────────────────────────────────────────────────────────

const DIR = new URL('../vendor/come-sail-away/Models/', import.meta.url);
const json = (f) => JSON.parse(readFileSync(new URL(f, DIR), 'utf8'));
const MODELS = comeSailAwayModels({ prefabs: json('prefabs.json'), meshes: json('meshes.json'), bin: new Uint8Array(readFileSync(new URL('meshes.bin', DIR))), materials: json('materials.json'), animation: json('animation.json') });
const ctxFor = (player) => ({ models: MODELS, player: () => player, billboardSize: () => [0.8, 1.6], modelBounds: () => ({ min: [-1, 0, -1], max: [1, 1, 1] }) });
const openWater = () => ({ mapPixelX: 10, mapPixelY: 20, position: [0, 0, 0], tileMap: new Uint8Array(128 * 128), sampleHeight: () => 20 });

/** csa_sailing's scripted scene, trimmed: open water everywhere, the keys held as a set, a quarter second a frame. */
function sea({ ipnm = false, heights = () => 20 } = {}) {
  const held = new Set(), started = new Set();
  const player = { position: [1, 2, 3], yaw: 0, frozen: 0 };
  const t = { ...openWater(), sampleHeight: heights };
  const input = { has: (a) => held.has(a), started: (a) => started.has(a), horizontal: () => 0, vertical: () => 0, toggleAutorun: false };
  const out = { hud: [], fatigue: 0, packed: [], removed: [] };
  const rt = createComeSailAwayRuntime({
    pool: { models: MODELS, ready: () => true, spawnNow: (boat, p) => { spawnBoat(boat, ctxFor(p)); return boat; }, remove: (b) => out.removed.push(b) },
    player: () => ({ position: [...player.position], rotation: [0, Math.sin((player.yaw * Math.PI) / 360), 0, Math.cos((player.yaw * Math.PI) / 360)] }),
    camera: () => ({ position: [0, 50, 0], forward: [0, -1, 0] }),
    currentMapPixel: () => ({ X: 10, Y: 20 }), isPlayerInside: () => false, blockWaterLevel: () => NO_WATER_LEVEL, iliacPuddleNoMore: () => ipnm,
    raycast: () => null, playerTerrain: () => t, terrainAt: () => t, terrains: () => [t], heightMapValue: () => 255, worldCompensation: () => [0, 0, 0],
    hudText: (s) => out.hud.push(s), midScreenText: () => {}, log: () => {}, random: { range: (min) => min }, time: () => 0, persistentDungeonBoats: () => false,
    packedItems: { serialize: (i) => i, deserialize: (r) => r }, dt: () => 0.25, setting: (key) => ({ 'Waves.Enable': false })[key], input,
    helm: { setPlayerPosition: (p) => { player.position = [...p]; }, setFacing: (y) => { player.yaw = y; }, turnPlayer: (d) => { player.yaw += d; }, freeze: (s) => { player.frozen = s; }, frozen: () => player.frozen > 0, stopRunning: () => {}, footsteps: () => {}, alignToGround: () => {} },
    transport: { isFoot: () => true, setFoot: () => {}, hasHorse: () => false, hasCart: () => false },
    ship: { owns: () => true, assign: () => {}, removePermanentScene: () => {} },
    entity: { isFemale: () => false, carriedWeight: () => 10, wagonWeight: () => 0, decreaseFatigue: (n) => { out.fatigue += n; } },
    cargoWeight: () => 0, sphereCastAll: () => [], enemies: () => [], timeScale: () => 1, setTimeScale: () => {}, messageBox: () => {},
    items: { create: (templateIndex) => ({ templateIndex, UID: 900 + out.packed.length, message: 0 }), addToPlayer: (item) => out.packed.push(item) },
  });
  return { rt, held, started, input, out, player, terrain: t };
}

/** The journey's hand at the mod's helm: the keys the helm says, pressed as the host presses them, until the boat is
 *  within 60 m of a mark `dist` metres off `markDeg`, the wind blowing toward `windDeg`. The game's seconds it took. */
function sailTo(hull, windDeg, markDeg, { dist = 600, windLen = 1.5, maxS = 1500 } = {}) {
  const s = sea();
  const boat = s.rt.PlaceBoat([0, 34, 0], [0, 0, 1], hull, 0, null);
  s.rt.StartSailing(boat);
  const wr = (windDeg * Math.PI) / 180, mr = (markDeg * Math.PI) / 180;
  const mark = [Math.sin(mr) * dist, Math.cos(mr) * dist];
  const st = createSeaHelm();
  const dt = 0.25;
  for (let t = 0; t < maxS; t += dt) {
    s.rt.state.windVectorTarget = [Math.sin(wr) * windLen, 0, Math.cos(wr) * windLen];
    s.rt.state.windVectorCurrent = [...s.rt.state.windVectorTarget];
    const p = boat.GameObject.position, fw = quatRotate(boat.GameObject.rotation, [0, 0, 1]);
    if (Math.hypot(mark[0] - p[0], mark[1] - p[2]) < 60) return { t, fatigue: s.out.fatigue };
    const v = s.rt.state.velocityCurrent ?? [0, 0, 0], w = s.rt.state.windVectorCurrent, cargo = s.rt.state.boatCargoMod;
    const cmd = seaHelmStep(st, {
      heading: headingOf(fw[0], fw[2]), bearing: headingOf(mark[0] - p[0], mark[1] - p[2]), wind: [w[0], w[2]], hasSails: boat.Sails.length > 0,
      squareOnly: squareOnly(boat), sailsUp: s.rt.state.sailPosition > 0, canSail: s.rt.CanSail(boat), way: v[2], dt,
      crewed: boat.crewed, oarWay: HANDLING.moveSpeedOar * boat.modifierMoveSpeedOar * cargo, sailWay: HANDLING.moveSpeedSail * boat.modifierMoveSpeedSail * cargo * Math.hypot(w[0], w[2]),
    });
    s.held.clear(); s.started.clear();
    if (cmd.turn > 0) s.held.add('MoveRight'); else if (cmd.turn < 0) s.held.add('MoveLeft');
    s.input.toggleAutorun = cmd.row;
    if (cmd.sails) s.started.add(BOAT_ACTIONS.toggleSail);
    s.rt.endOfFrame(); s.rt.fixedUpdate(); s.rt.update(); s.rt.lateUpdate();
  }
  return null;
}

test('OWS2 at the mod\'s own helm: the Large Boat (a lateen, no crew) reaches a mark 600 m off in every wind - before it, across it, and dead into it by beating - by the rudder, the sail and the oars\' keys alone; the Large Galley\'s crew rows it there in any', () => {
  for (const windDeg of [0, 90, 135, 180]) {
    const r = sailTo(1, windDeg, 0);
    assert.ok(r, `the Large Boat, the wind blowing toward ${windDeg}: reached`);
    assert.ok(r.t < (windDeg === 180 ? 600 : 400), `...in ${r.t} s`);
    if (windDeg === 0) assert.equal(r.fatigue, 0, 'running before the wind: never an oar pulled');
  }
  const galley = sailTo(3, 180, 0);
  assert.ok(galley && galley.t < 150, `the galley rows into the wind at its crew's eight (${galley?.t} s)`);
  const ship = sailTo(2, 180, 0);
  assert.ok(ship && ship.t < 400, `the Small Ship beats up on its lateens (${ship?.t} s)`);
});

// ── THE RUNTIME'S DOORS AND THE POOL'S RIG ──────────────────────────────────────────────────────────────────────────

test('OWS2 runtime: LaunchFromParts is the placing click\'s terrain arm aimed by the journey - "Boat placed!", the hull and variant off the parts\' message, the bow along the direction, the parts\' UID on the boat, the parts spent; a deed is not parts', () => {
  const s = sea();
  const parts = { templateIndex: 1320, message: 1 * 10 + 2, UID: 4242 };
  const pack = [parts, { templateIndex: 9, UID: 7 }];
  const boat = s.rt.LaunchFromParts(parts, () => pack, [30, 34, -12], [1, 0, 0], s.terrain);
  assert.ok(boat, 'a boat');
  assert.deepEqual([boat.hull, boat.variant, boat.uid], [1, 2, 4242]);
  assert.deepEqual(boat.GameObject.position, [30, 34, -12]);
  const fw = quatRotate(boat.GameObject.rotation, [0, 0, 1]);
  assert.ok(Math.abs(fw[0] - 1) < 1e-6 && Math.abs(fw[2]) < 1e-6, 'its bow along the direction');
  assert.deepEqual(s.out.hud, ['Boat placed!']);
  assert.deepEqual(pack.map((i) => i.UID), [7], 'the parts spent from the pack as it stands');
  assert.equal(s.rt.state.placing, false);
  assert.ok(s.rt.AllBoats.includes(boat));
  assert.equal(s.rt.LaunchFromParts({ templateIndex: 1321, message: 30, UID: 1 }, () => [], [0, 34, 0], [0, 0, 1], s.terrain), null, 'a deed\'s boat stands where a port put it');
});

test('OWS2 runtime: nodeReadingAt is the one law the boats\' nodes and the launch probe read - the tile map\'s water, or under Iliac Puddle No More\'s line', () => {
  const s = sea();
  s.terrain.tileMap[5 * 128 + 5] = 3 << 2;   // one land tile
  assert.equal(s.rt.nodeReadingAt([5 * 6.4 + 1, 34, 5 * 6.4 + 1], s.terrain), 3);
  assert.equal(s.rt.nodeReadingAt([1, 34, 1], s.terrain), 0);
  const deep = sea({ ipnm: true, heights: (p) => (p[0] > 10 ? WATER_LEVEL + 1 : WATER_LEVEL - 1) });
  assert.equal(deep.rt.nodeReadingAt([5, 0, 0], deep.terrain), 0, 'the carved floor under the line: water');
  assert.equal(deep.rt.nodeReadingAt([15, 0, 0], deep.terrain), 1);
  assert.equal(deep.rt.nodeReadingAt([10, 0, 0], { sampleHeight: () => WATER_LEVEL }), 1, 'at the line: not under it');
});

test('OWS2 pool: a hull\'s rig, built once off SpawnBoat and never placed - its five nodes in its own frame, sails, crew, packing and Cargo modifier', async () => {
  const fileFetch = async (url) => { const bytes = readFileSync(fileURLToPath(url)); return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) }; };
  const pipeline = {
    textureFiles: new Map(), cpuModels: new Map(), gpuMeshes: new Map(), uploadRecord: () => {},
    getTexture: async () => ({ recordCount: 100, getSize: () => ({ width: 40, height: 64 }), getScale: () => ({ width: 0, height: 0 }) }),
    getGpuMesh: async (id) => ({ classic: id }),
  };
  const pool = createComeSailAwayPool({ renderer: { createMesh: () => ({}), drawMesh() {}, createBillboardBatch: () => ({}), destroyBillboardBatch() {}, destroyMesh() {} }, pipeline, fetchFn: fileFetch, log: { warn() {} } });
  assert.equal(pool.hullRig(1), null, 'before the models: nothing');
  assert.equal(await pool.preload(), true);
  const lb = pool.hullRig(1);
  // SHIPS-2: SpawnBoat over the pool's own models (its hull 1 Mac's Tiny Ship - this file's MODELS are the mod's alone)
  const b = new Boat(1, 0); spawnBoat(b, { ...ctxFor({ position: [0, 0, 0], rotation: [0, 0, 0, 1] }), models: pool.models });
  assert.deepEqual(lb.nodes, b.Nodes.map((n) => [...n.localPosition]), 'SpawnBoat\'s own nodes');
  assert.deepEqual([lb.sails, lb.crewed, lb.packable], [1, false, true], 'the Large Boat: one lateen, no crew, packs');
  assert.equal(pool.hullRig(1), lb, 'built once');
  assert.deepEqual([pool.hullRig(0).sails, pool.hullRig(3).crewed], [0, true], 'the Rowboat has no sail; the galley a crew');
  assert.equal(pool.hullRig(4).cargo, 0, 'the Carrack\'s Cargo modifier is none (it makes no way - kept)');
  assert.equal(pool.boats.length, 0, 'nothing placed');
  assert.equal(pool.hullRig(9), null);
});

// ── TRAVEL OPTIONS AFLOAT ───────────────────────────────────────────────────────────────────────────────────────────

test('OWS2 Travel Options: afloat, the mod\'s ocean stop and the walk\'s steering stand down; a sailed leg arrives in its water pixel\'s middle quarter, a spot on the water in its own square', () => {
  let atSea = false, steered = 0;
  const to = createTravelOptions({
    climateIndex: () => 223, atSea: () => atSea, steer: () => { steered++; return null; },
    worldPos: () => ({ x: 5 * 32768 + 100, z: 7 * 32768 + 100 }), mapPixel: () => ({ x: 5, y: 492 }),
    messageBox: () => {}, setTimeScale: () => {}, now: () => 0,
  });
  to.settings = { ...to.settings, avoidObstacles: true };
  to.beginTravelAlongRoute({ legs: [{ x: 6, y: 492, kind: 'sea' }, { x: 7, y: 492, kind: 'landfall' }], point: { pixel: { x: 9, y: 492 }, x: 9 * 32768, z: 7 * 32768 } });
  const rect = to.state.autopilot.destinationWorldRect;
  assert.equal(rect.xMax - rect.xMin, SEA_LEG_SIZE, 'the middle quarter');
  assert.equal(rect.xMin - 6 * 32768, SEA_LEG_LO);
  atSea = true;
  const r = to.update({ topWindowAllowsTravel: true });
  assert.notEqual(r.stopped, 'ocean', 'afloat: the sea stops no journey');
  assert.equal(steered, 0, 'afloat: the helm steers, not the walk');
  atSea = false;
  assert.equal(to.update({ topWindowAllowsTravel: true }).stopped, 'ocean', 'ashore in the ocean\'s climate: the mod\'s own stop');
  assert.equal(SEA_SPOT_SIZE, 2048);
  // a spot on the water as the journey's one leg: its square the sea's
  to.beginTravelAlongRoute({ legs: [{ x: 6, y: 492, kind: 'sea' }], point: { pixel: { x: 6, y: 492 }, x: 6 * 32768 + 900, z: 7 * 32768 + 900 } });
  const spot = to.state.autopilot.destinationWorldRect;
  assert.equal(spot.xMax - spot.xMin, SEA_SPOT_SIZE, 'a spot reached afloat: the sea\'s square');
  to.beginTravelAlongRoute({ legs: [{ x: 6, y: 492, kind: 'open' }], point: { pixel: { x: 6, y: 492 }, x: 6 * 32768 + 900, z: 7 * 32768 + 900 } });
  assert.equal(to.state.autopilot.destinationWorldRect.xMax - to.state.autopilot.destinationWorldRect.xMin, 512, 'one walked to: a path\'s width');
  assert.match(rd('src/systems/travelOptions.js'), /spotRect\(r\.point, SEA_LEG_KINDS\.includes\(r\.legs\.at\(-1\)\?\.kind\)\)/, 'a spot reached by sea arrives in the sea\'s square');
});

test('OWS2 words: the trip\'s line says a crossing; the refusals say why', () => {
  assert.equal(travelTripLine({ name: 'Wayrest', sea: true }), 'To Wayrest, by sea');
  assert.equal(travelTripLine({ spot: true, sea: true }), 'To the marked spot, by sea');
  assert.equal(travelTripLine({ name: 'Wayrest', share: 0.9 }), 'To Wayrest, by the road');
  assert.equal(TRAVEL_VIEW_TEXT.needBoat, 'There is no way there by land - a boat would carry you across the water.');
  for (const k of ['passenger', 'noLaunch', 'noWayAtSea', 'leftMoored', 'noBoat', 'aground']) assert.equal(typeof TRAVEL_VIEW_TEXT[k], 'string', k);
});

// ── THE WORLD HOST ──────────────────────────────────────────────────────────────────────────────────────────────────

test('OWS2 host wiring by source: the boat a journey crosses in; the plan asked with it; the frame before the mod\'s; the launch, the helm\'s keys through the one seam, the landfall, the step ashore and the pack', () => {
  const w = rd('src/scenes/world.js');
  // the means: at its helm, mine moored in reach, the parts in the pack - a boat that crosses
  assert.match(w, /const tvSeaCrosses = \(rig\) => !!rig && \(rig\.sails > 0 \|\| rig\.crewed\) && \(rig\.cargo > 0 \|\| !!csaRuntime\?\.helmResponsive\(\)\);/);   // PIN MOVED (AUDIT NAV2 F16): the Carrack crosses where the responsive helm sails her
  assert.match(w, /return tvSeaCrosses\(tvSeaRig\(b\)\) \? \{ start: 'sea', again: !!b\.packable, boat: b, how: 'helm' \} : null;/);
  assert.match(w, /if \(Math\.hypot\(p\[0\] - feet\[0\], p\[2\] - feet\[2\]\) <= TV_SEA_MOORED_M\) return \{ start: 'sea', again: !!b\.packable, boat: b, how: 'moored' \};/);
  assert.match(w, /return tvSeaParts\(\) \? \{ start: 'land', again: true, boat: null, how: 'parts' \} : null;/);
  assert.match(w, /it\?\.templateIndex === CSA_PARTS_TEMPLATE && tvSeaCrosses\(csa\.hullRig\?\.\(csaHullFromMessage\(it\.message \?\? 0\)\)\)/);
  // the plans
  // THE MERGE (OW4 x OWS2): the planner's ground is routeGround's (the sea and the peaks' law, read once), the boat beside it
  // PIN MOVED (AUDIT OW5 S3): a plan that never sails is planned again on land, the moored boat left where it lies
  assert.match(w, /let plan = planRoute\(from, summary\.pixel, \{ roads: net\?\.roads \?\? null, tracks: net\?\.tracks \?\? null, \.\.\.tvRouteGround\(\), sea: tvSeaAsk\(means, 'land'\) \}\);[^\n]*\n(?:\s*if \(!plan && !net && roadNet\)[^\n]*\n)?\s*const dry = tvMooredDry\(means, plan, [^\n]*\n\s*if \(dry\) \{ plan = dry; means = null; \}/);
  // PIN MOVED (AUDIT OW5 S3): a let - a plan that never sails drops the moored boat's ask
  assert.match(w, /let seaAsk = means && \(water \|\| means\.start === 'sea' \|\| !dryLine\(from, pix, tvWater\)\) \? tvSeaAsk\(means, water \? 'sea' : 'land'\) : null;\n\s*if \(water && !seaAsk\) \{ tvSeaNoWay\(from, pix, null, null, 'sea'\); return false; \}/);
  // PIN MOVED (AUDIT OW5 S3): a let
  assert.match(w, /let plan = planRoute\(from, pix, \{ roads: wnet\?\.roads \?\? null, tracks: wnet\?\.tracks \?\? null, \.\.\.tvRouteGround\(\), goalExempt: !!door, sea: seaAsk \}\);/);
  assert.match(w, /else if \(what\.kind === 'water'\) \{ if \(travelOptions\?\.settings\?\.targetCoordsAllowed === false\) tvSay\(TRAVEL_VIEW_TEXT\.placesOnly\); else travelViewWalkTo\(hit\.point, pix, \{ water: true \}\); \}/);
  assert.match(w, /if \(csaAboard\.aboard\) \{ tvSay\(TRAVEL_VIEW_TEXT\.passenger\); return false; \}/);
  // the frame, before the mod's own
  const sea = w.indexOf('tvSeaFrame(dt);   // OWS2'), mod = w.indexOf('const report = travelOptions.update({'), govern = w.indexOf('travelViewGovern(dt);   // TV2');
  assert.ok(sea >= 0 && govern > sea && mod > govern && mod - sea < 3000, 'the crossing\'s frame first, then the cap\'s, then the mod\'s own update');
  // the seam: the helm reads the journey's keys and oars beside the rest
  assert.match(w, /\|\| csaJourneyHelm\.held\.has\(action\)(?: \|\| \(!!HELM_RUDDER_ACTIONS\[action\] && helmTurnKeys\(\) && held\(keys, HELM_RUDDER_ACTIONS\[action\]\)\))?,/);   // HELM-KEYS: the turn keys beside it at a helm
  assert.match(w, /get toggleAutorun\(\) \{ return !!player\.toggleAutorun \|\| csaJourneyHelm\.row; \},/);
  // PIN MOVED (AUDIT OW5 S1): the crossing's alone - a mod journey at a helm meets the mod's own ocean stop
  assert.match(w, /atSea: \(\) => !!tvSea\.means && \(!!csaBoatUnderMe\(\) \|\| tvSea\.phase === 'landing'\),/, 'afloat, and coming ashore - on the crossing');
  // the launch, the landfall, ashore, the pack
  assert.match(w, /boat = csaRuntime\.LaunchFromParts\(parts, \(\) => playerEntity\.items, spot\.at, spot\.dir, csaTerrainOf\(csaPixelAt\(spot\.at\[0\], spot\.at\[2\]\)\)\);/);
  assert.match(w, /if \(boat\) csaCall\(\(\) => csaRuntime\.StartSailing\(boat\)\);/);
  assert.match(w, /if \(landfall && \(csaRuntime\.IsBeached\(boat\) \|\| \(landAhead <= TV_SEA_BEACH_M && Math\.abs\(v\[2\]\) < 0\.6\)\)\) \{ tvSeaLand\(boat\); return; \}/);
  assert.match(w, /csaHelmPress\(CSA_BOAT_ACTIONS\.disembark\);/);
  assert.match(w, /if \(csaRuntime\.state\.disembarking == null && !csaRuntime\.isSailing\(\)\) tvSeaAshore\(\);/);
  // SHIP-PACK (PIN MOVED): a ship packs at her landfall too - with her deed in the pack, else she is left moored
  // PIN MOVED (HOLD-WEIGHT, FIELD BUGS 2026-10-05c): and only parts her bearer can carry (test/fb1005c_holdweight.test.js)
  assert.match(w, /if \(tvSea\.means\?\.again && boat\.packable && csaPassengersOn\(boat\) === 0 && !csaRuntime\.deedMissing\(boat\) && !csaRuntime\.partsTooHeavy\(boat\)\) csaCall\(\(\) => csaRuntime\.PackBoat\(boat, true\)\);/);
  assert.match(w, /if \(!Number\.isFinite\(h\) \|\| h < tvSeaY\(\) \+ 0\.2\) continue;/);
  // the journey over: the hand off the helm, the sails down
  assert.match(w, /if \(csaRuntime\?\.isSailing\(\) && csaRuntime\.state\.sailPosition > 0\) csaHelmPress\(CSA_BOAT_ACTIONS\.toggleSail\);/);
  assert.match(w, /if \(tvSea\.means\?\.how === 'moored'\) csaCall\(\(\) => csaRuntime\.StartSailing\(tvSea\.means\.boat\)\);/);
  assert.match(w, /if \(deepWaters\) q\[1\] = Math\.max\(q\[1\], tvSeaY\(\) \+ 1\);/, 'the line over the water rides its top');
});

test('AUDIT OWS A1/A2 by source: a load takes the crossing\'s hand off the helm and forgets the crossing (declared above the load - BOOT-TDZ); a journey\'s end forgets a landing it left, so the ocean stop is never held down after it', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /csaJourneyHelm\.held\.clear\(\); csaJourneyHelm\.row = false; tvSea\.means = null; tvSea\.phase = null; tvSea\.boat = null; tvSea\.wasLive = false;   \/\/ AUDIT OWS A1/);
  const decl = w.indexOf('  const tvSea = { means: null,'), load = w.indexOf('tvSea.wasLive = false;   // AUDIT OWS A1'), reader = w.indexOf("atSea: () => !!tvSea.means && (!!csaBoatUnderMe() || tvSea.phase === 'landing'),");
  assert.ok(decl >= 0 && decl < load && decl < reader, 'BOOT-TDZ: the state above the load that clears it and the stop that reads it');
  assert.match(w, /tvSea\.wasLive = false;\n\s*tvSea\.phase = null; tvSea\.boat = null;   \/\/ AUDIT OWS A2/);
});
