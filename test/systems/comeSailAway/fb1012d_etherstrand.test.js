// ETHER-STRAND (FIELD BUGS 2026-10-12b, the bug-reports channel: "Unable to sail any ship after leaving a fleet ship in
// the Etheric Ocean and returning to Iliac Bay"). The report's sequence, through the real modules: Come Sail Away's
// runtime over the vendored hulls (test/csaScene.mjs), the sea's host (scenes/naval/navalHost.js - every seam the helm reads
// of it: wayScale, sailRefused, brake, warp, drift, gale, postsWay), the Fleet's host (scenes/fleetHost.js - refit and
// the Summon) and world.js's own `veilApart` line, lifted from the source. Out across the Veil at the Carrack's helm,
// the helm left there and the captain gone east on foot, a second boat placed in the Veil and sailed home through it -
// and in the Bay that boat, and a rowboat, make way, while the Carrack's Summon is refused with the design's words.
// NOT REPRODUCED: nothing the crossing leaves holds the helm - no state of the crossing, the Fleet or the sea's host keys
// a ship's side of the Veil into Come Sail Away's motor. The one law that leaves every hull but the Carrack (and the
// Large Galley) dead in the water with her helm answering is the mod's cargo weight - the captain's own load on every
// hull's hold - pinned last, as the reading the reporter is asked about.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scene } from '../../csaScene.mjs';
import { readyPool } from '../../navalSea.mjs';
import { createNavalHost } from '../../../src/scenes/naval/navalHost.js';
import { createFleetHost } from '../../../src/scenes/fleetHost.js';
import { knowShip, _resetFleetForTests } from '../../../src/systems/fleet.js';
import { BOAT_ACTIONS, cargoModWords } from '../../../src/systems/comeSailAway/comeSailAway.js';
import { inEther, landfall, VEIL_X } from '../../../src/world/ethericSea.js';
import { crossingTarget } from '../../../src/systems/naval/etherCrossing.js';
import { TERRAIN_SIZE } from '../../../src/world/terrain/terrainSampler.js';

const WORLD = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
/** world.js's `veilApart` - the Fleet's side-of-the-Veil law - as the host hands it the Fleet's host. */
function liftVeilApart(playerTravelPixel) {
  const head = '    veilApart: (rec, boat) => ';
  const at = WORLD.indexOf(head);
  assert.ok(at >= 0, 'world.js hands the Fleet its veilApart');
  const line = WORLD.slice(at + head.length - '(rec, boat) => '.length, WORLD.indexOf('\n', at)).replace(/,\s*$/, '');
  return new Function('playerTravelPixel', 'inEther', 'etherSea', `return ${line};`)(playerTravelPixel, inEther, true);
}

const SEA = 34;   // Come Sail Away's WaterLevel, the sea the boats float on
const MIDDLE = TERRAIN_SIZE / 2;
/** A pixel's terrain, its corner the frame's origin (state.init's), every tile water. */
const waterAt = (px, py) => ({ mapPixelX: px, mapPixelY: py, position: [0, 0, 0], tileMap: new Uint8Array(128 * 128), sampleHeight: () => 20 });

/** THE WORLD'S HOST, as far as the helm reads it: the player's pixel, the frame's terrain, the sea's host, the Fleet's. */
async function harbour() {
  _resetFleetForTests();
  const pool = await readyPool();
  pool.destroyAll();
  const s = scene({ settings: { 'Waves.Enable': false } });
  const world = { px: 150, py: 300, terrain: waterAt(150, 300) };
  Object.assign(s.deps, {
    currentMapPixel: () => ({ X: world.px, Y: world.py }),
    playerTerrain: () => world.terrain,
    terrainAt: (x, y) => (x === world.px && y === world.py ? world.terrain : null),
    terrains: () => [world.terrain],
    handling: () => 'responsive',
  });
  let fleet = null;
  const naval = createNavalHost({
    pool, csa: () => s.rt, seaY: () => SEA, isWater: () => true, feet: () => s.player.position, look: () => ({ origin: s.player.position, dir: [1, 0, 0] }), level: () => 5,
    where: () => ({ px: world.px, py: world.py, region: 17, day: 1, nearPort: false, capitals: [], cityLights: false, night: false, ether: inEther(world.px, world.py) ? { band: 'shallows' } : null }),
    say: () => {}, mid: () => {}, audio: { play3d() {}, loop3d: () => ({ move() {}, stop() {} }) }, flame: () => ({ move() {}, retire() {} }),
    law: { crime() {}, legal() {}, faction() {} }, board: { giveItems: () => ({ left: [] }) }, setting: (k) => ({ ShipsAtSea: 'off' })[k], random: () => 0.5,
    refit: (b) => fleet?.refit(b) ?? null,
  });
  fleet = createFleetHost({
    csa: () => s.rt, naval: () => naval, pack: () => [], gold: () => 0, accounts: () => [],
    where: () => ({ inside: false, pixel: { X: world.px, Y: world.py }, feet: s.player.position }), nearPort: () => true,
    veilApart: liftVeilApart(() => ({ x: world.px, y: world.py })),
  });
  // world.js's Come Sail Away seams over the sea's host and the Fleet's (the runtime's `deps` read live)
  Object.assign(s.deps, {
    wayScale: (u) => naval.wayScale(u), sailRefused: () => naval.sailRefused(), brake: () => naval.brake(),
    warp: (b, o) => naval.warp(b, o), drift: (b) => naval.drift(b), gale: (b) => naval.gale?.(b) ?? null,
    refit: (b) => { const r = fleet.refit(b), k = naval.postsWay(b); return k === 1 ? r : { ...(r ?? {}), speed: (Number(r?.speed) || 1) * k }; },
  });
  const wind = () => { s.rt.state.windVectorCurrent = [1.5, 0, 0]; s.rt.state.windVectorTarget = [1.5, 0, 0]; };
  const frames = (n, o) => { for (let i = 0; i < n; i++) { s.frame(o); naval.frame(0.25); } };
  /** A boat of the player's placed (the mod's PlaceBoat) by her number, her record the Fleet's. */
  const place = (hull, uid, at) => { const b = s.rt.PlaceBoat([at[0], SEA, at[1]], [0, 0, 1], hull, 0, world.terrain); b.uid = uid; knowShip(uid, hull, 0); return b; };
  /** etherCross, step for step: the helm let go, the sea emptied (navalTransition), the frame re-anchored on the
   *  landfall's pixel carrying every boat (state.init, csaReanchor), the ship brought round onto its middle, her helm
   *  taken again. */
  const cross = (boat, to, dir) => {
    s.rt.StopSailing();
    naval.clear();
    const offset = [(world.px - to.px) * TERRAIN_SIZE, 0, -(world.py - to.py) * TERRAIN_SIZE];
    world.px = to.px; world.py = to.py; world.terrain = waterAt(to.px, to.py);
    s.rt.OnWorldReanchored(offset);
    s.rt.RepositionBoat(boat, [MIDDLE, SEA, MIDDLE], dir, world.terrain);
    s.rt.StartSailing(boat);
  };
  /** FloatingOrigin's recentre as the captain walks a pixel east (the pixel first - the player moved, then the shift). */
  const walkEast = (n) => { for (let i = 0; i < n; i++) { world.px += 1; world.terrain = waterAt(world.px, world.py); s.rt.OnPositionUpdate([-TERRAIN_SIZE, 0, 0]); } };
  /** Her way over `n` frames (metres) and her swing (degrees). */
  const way = (boat, n, o) => {
    const p = [...boat.GameObject.position], q = [...boat.GameObject.rotation];
    frames(n, o);
    const r = boat.GameObject.rotation;
    return { m: Math.hypot(boat.GameObject.position[0] - p[0], boat.GameObject.position[2] - p[2]), deg: (2 * Math.acos(Math.min(1, Math.abs(q[0] * r[0] + q[1] * r[1] + q[2] * r[2] + q[3] * r[3]))) * 180) / Math.PI };
  };
  return { s, world, naval, fleet, wind, frames, place, cross, walkEast, way };
}

/** The report, step for step: the Carrack out, her helm left past the Veil, the captain east on foot, a Large Boat
 *  placed in the Veil and sailed home. Answers the harbour, the Carrack and the boat that came home. */
async function theReport() {
  const h = await harbour();
  const { s, world } = h;
  const carrack = h.place(4, 4001, [MIDDLE, MIDDLE]);
  s.helm(carrack); h.wind(); h.frames(1, { press: [BOAT_ACTIONS.toggleSail] });
  assert.ok(h.way(carrack, 20).m > 1, 'the Carrack makes way in the Bay');
  h.cross(carrack, landfall(), [-1, 0, 0]);
  assert.ok(inEther(world.px, world.py), 'past the Veil');
  h.wind(); h.frames(1, { press: [BOAT_ACTIONS.toggleSail] });
  assert.ok(h.way(carrack, 20).m > 1, 'and past the Veil');
  // "abandoned ship to navigate to the veil on foot": the disembark key, its hold run out, and a walk east
  s.rt.StopSailingDelayed(); h.frames(1); s.player.frozen = 0; h.frames(2);
  assert.equal(s.rt.isSailing(), false, 'her helm left');
  h.walkEast(VEIL_X - world.px + 2);
  assert.ok(inEther(world.px, world.py) && world.px >= VEIL_X, 'in the Veil');
  // "I used a separate ship to trigger the warp back": a Large Boat placed there, sailed home through it
  const boat = h.place(1, 4002, [MIDDLE, MIDDLE]);
  s.helm(boat);
  h.cross(boat, crossingTarget('home', { px: 150, py: 300 }), [1, 0, 0]);
  assert.ok(!inEther(world.px, world.py), 'home in the Bay');
  return { h, carrack, boat };
}

test('ETHER-STRAND the report\'s sequence: home in the Bay on another boat, her helm answers - under sail, at her oars and to her rudder - and a rowboat rows; the Carrack across the Veil stands hidden, her own (mutants: the far boat shown, a hull\'s way gone)', async () => {
  const { h, carrack, boat } = await theReport();
  const { s } = h;
  assert.equal(carrack.GameObject.activeSelf, false, 'the Carrack left past the Veil stands hidden - nothing of her in the Bay\'s frame');
  assert.ok(inEther(carrack.MapPixel.X, carrack.MapPixel.Y), 'her pixel the sea\'s');
  assert.ok(s.rt.isSailing() && s.rt.state.CurrentBoat === boat, 'at the helm of the boat that came home');
  assert.deepEqual(boat.NodeTileMapIndices, [0, 0, 0, 0, 0], 'every node on water');
  h.wind(); h.frames(1, { press: [BOAT_ACTIONS.toggleSail] });
  assert.equal(s.rt.state.sailPosition, 1, 'her sail set');
  assert.ok(h.way(boat, 20).m > 1, 'she makes way under sail');
  s.held.add('MoveRight');
  assert.ok(h.way(boat, 8).deg > 1, 'she answers her rudder');
  s.held.delete('MoveRight');
  h.frames(1, { press: [BOAT_ACTIONS.toggleSail] });
  h.frames(12);   // her way off under struck canvas
  h.frames(1, { press: ['MoveForwards'] });
  assert.equal(s.rt.state.oarThrottle, 1, 'her oars pulling ahead');
  assert.ok(h.way(boat, 20).m > 1, 'she makes way at her oars');
  // "All other ships including rowboats": a rowboat beside her
  s.rt.StopSailing();
  const rowboat = h.place(0, 4003, [MIDDLE + 60, MIDDLE]);
  s.helm(rowboat);
  h.frames(1, { press: ['MoveForwards'] });
  assert.ok(h.way(rowboat, 20).m > 1, 'the rowboat rows');
  assert.ok(Number.isFinite(s.rt.state.boatCargoMod) && s.rt.state.boatCargoMod === 1, 'a light boat\'s full way');
});

test('ETHER-STRAND the design rule kept: the Carrack left past the Veil is no Fleet order\'s - her Summon in the Bay refused with the Veil\'s words, the boat on the Bay\'s side no Veil\'s; the save made so loads, the Carrack hidden, and the boat at the helm sails (mutants: the refusal\'s arm, the side law, the loaded far boat shown)', async () => {
  const { h, carrack, boat } = await theReport();
  const { s, fleet } = h;
  s.rt.StopSailing();
  const rows = fleet.model().ships;
  const row = (uid) => rows.find((r) => r.uid === uid);
  assert.equal(row(carrack.uid).where, 'away');
  assert.equal(row(carrack.uid).can.summon, 'This ship is on the other side of the Veil. Sail it across yourself.', 'the design\'s refusal, word for word');
  assert.equal(fleet.act(carrack.uid, 'summon').ok, false);
  assert.ok(carrack.GameObject.activeSelf === false && s.rt.AllBoats.includes(carrack), 'refused - she stays where she lies');
  assert.equal(row(boat.uid).can.summon, 'This ship is already here.', 'the boat of the Bay\'s side is no Veil\'s');
  // the reporter's save, made in the Bay with the Carrack past the Veil, loaded: her helm taken, her way on
  s.helm(boat);
  const rec = JSON.parse(JSON.stringify(s.rt.getSaveData()));
  s.rt.restoreSaveData(rec);
  s.rt.OnLoad();
  const again = s.rt.state.CurrentBoat;
  assert.ok(again && again.uid === boat.uid && s.rt.isSailing(), 'the loaded save at the helm');
  assert.equal(s.rt.AllBoats.find((b) => b.uid === carrack.uid).GameObject.activeSelf, false, 'the Carrack loads hidden past the Veil');
  h.wind(); h.frames(1, { press: [BOAT_ACTIONS.toggleSail] });
  assert.ok(h.way(again, 20).m > 1, 'and she makes way');
});

test('ETHER-STRAND the one law that sails the Carrack alone (the reading the reporter is asked about): the captain\'s own load - the player, the pack and its gold, the wagon (Come Sail Away\'s Cargo settings, on by default) - is weighed against every hull\'s hold; past twice its room she lies dead in the water, said once a helm, and the Carrack\'s hold (the Large Galley\'s, CARGO_HOLD_MISSING) is the largest (mutants: a hull\'s way gone)', async () => {
  const h = await harbour();
  const { s } = h;
  s.deps.entity.carriedWeight = () => 1925;   // with the player's 175: 2,100 kg on every hull
  const said = (from) => s.out.mid.slice(from).map(([t]) => t);
  const dead = [], sails = [];
  for (const [hull, uid] of [[0, 5000], [1, 5001], [2, 5002], [4, 5004]]) {
    const b = h.place(hull, uid, [MIDDLE + hull * 60, MIDDLE]);
    const from = s.out.mid.length;
    s.helm(b); h.wind();
    if (b.Sails.length) h.frames(1, { press: [BOAT_ACTIONS.toggleSail] }); else h.frames(1, { press: ['MoveForwards'] });
    (h.way(b, 20).m > 1 ? sails : dead).push(hull);
    if (hull !== 4) assert.deepEqual(said(from), ["You're going to need a bigger boat"], `hull ${hull}: the helm's word`);
    s.rt.StopSailing();
  }
  assert.deepEqual(dead, [0, 1, 2], 'the rowboat, the Large Boat and the Small Ship lie dead in the water');
  assert.deepEqual(sails, [4], 'the Carrack makes way');
});

test('ETHER-STRAND the crossing says her load beneath its words - the helm\'s line (3 s) was covered by the crossing\'s mid-screen words (7 s), so the boat that came home overladen never said why she would not move; now her load\'s word rides the HUD line beneath them, from the one home of the words (mutants: the line unsaid; the words in two homes)', () => {
  assert.equal(cargoModWords(0), "You're going to need a bigger boat");
  assert.equal(cargoModWords(0.49), "You're going to need a bigger boat");
  assert.equal(cargoModWords(0.5), 'The boat draws a little lower than usual');
  assert.equal(cargoModWords(0.99), 'The boat draws a little lower than usual');
  assert.equal(cargoModWords(1), null, 'a whole hold says nothing');
  const at = WORLD.indexOf('      setMidScreenText(crossingWords(way), 7);');
  assert.ok(at > 0, 'the crossing\'s words');
  const next = WORLD.slice(at, at + 600);
  assert.match(next, /\n      const heavy = cargoModWords\(csaRuntime\.state\.boatCargoMod\);[^\n]*\n      if \(heavy\) townTalk\.say\(heavy, 7\);/, 'her load said beneath them, on the HUD line, as long');
  const csa = readFileSync(new URL('../../../src/systems/comeSailAway/comeSailAway.js', import.meta.url), 'utf8');
  assert.equal((csa.match(/You're going to need a bigger boat/g) ?? []).length, 1, 'one home for the words');
});
