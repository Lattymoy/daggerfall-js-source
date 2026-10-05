// NAV-H (2026-09-28, Mac: "enhance the newly integrated ships by adding proper naval combat with a huge reference to
// assassins creed black flag. Being able to aim and fire when viewing from the side ... actual sailing ships to the
// world that players can encounter and pillage ... integrate into the pirate quest system ... directly integrate into
// online mode") - THE HOST: the sea fight driven through real frames over Come Sail Away's real pool (the vendored
// hulls, a stand-in renderer and pipeline - test/csa_online.test.js's), every other seam a recording stand-in; then the
// world host's wiring, pinned (bible/03-World/Naval-Combat.md NAV-H).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createNavalHost, hullBoxOf, NAVAL_SAVE_VENDOR, NAVAL_SAVE_VERSION, NEAR_BOOM_M, GUN_KICK, MUZZLE_FLASH_S, SINK_CREDIT_S, OWNER_SWEEP_S } from '../src/scenes/navalHost.js';
import { createComeSailAwayPool } from '../src/scenes/comeSailAwayPool.js';
import { Boat } from '../src/systems/comeSailAwayBoat.js';
import { GRAPPLE_S, MUSTERS, HAND, WA_SMALLRAID } from '../src/systems/naval/navalBoarding.js';
import { NOTORIETY } from '../src/systems/naval/navalLaw.js';
import { SHIP_STATES } from '../src/systems/naval/navalDamage.js';
import { FIRST_ROLL_S } from '../src/systems/naval/navalDirector.js';
import { navalHitData, validNavalRecord } from '../src/systems/naval/navalWire.js';
import { CRIMES } from '../src/systems/crimes.js';
import { NAVAL_SFX } from '../src/systems/naval/navalSounds.js';
import { classById, hullBuild, firstBuildOf, NAVAL_FACTIONS } from '../src/systems/naval/navalShips.js';

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const fileFetch = async (url) => {
  const bytes = readFileSync(fileURLToPath(url));
  return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
};
function standInRenderer() {
  return {
    createMesh: (model) => ({ model, buffers: [{}, {}], bounds: [0, 0, 0, 0], subMeshes: model.subMeshes.map((s) => ({ ...s, _bounds: [0, 0, 0, 0] })) }),
    drawMesh() {}, updateMeshVertices() {}, createBillboardBatch: (archive, record, size, centers, opts) => ({ archive, record, size, centers, opts }),
    destroyBillboardBatch() {}, destroyMesh() {},
  };
}
function standInPipeline() {
  const texture = () => ({ recordCount: 100, getSize: () => ({ width: 40, height: 64 }), getScale: () => ({ width: 0, height: 0 }) });
  return { getTexture: async () => texture(), uploadRecord() {}, getGpuMesh: async (id) => ({ classic: id }) };
}
const seeded = (seed = 1) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

let _pool = null;
async function readyPool() {
  if (_pool) return _pool;
  _pool = createComeSailAwayPool({ renderer: standInRenderer(), pipeline: standInPipeline(), fetchFn: fileFetch, log: { warn() {} } });
  assert.equal(await _pool.preload(), true);
  return _pool;
}

/**
 * A host over the real pool. `hull` - the player's boat at a helm (null: on foot); every seam records into `log`.
 */
async function harness(o = {}) {
  const pool = await readyPool();
  pool.destroyAll();
  const log = { say: [], mid: [], sounds: [], loops: [], crimes: [], legal: [], faction: [], foes: [], removed: [], placed: [], raids: [], plunder: [], given: [], hits: [], shake: [], left: 0 };
  // the hull's own prefab says whether she is crewed (a ship's 'Crewed' node - the Small Ship, the galley, the carrack)
  const boat = o.hull == null ? null : pool.spawnNow(Object.assign(new Boat(o.hull, 0), { uid: 42 }), { position: [0, 0, 0], rotation: [0, 0, 0, 1] });
  const runtime = boat ? {
    sailing: true, state: { CurrentBoat: boat, AllBoats: [boat], velocityCurrent: [0, 0, 0], windVectorCurrent: [0.6, 0, 0.8], sailPosition: 0 },
    isSailing() { return this.sailing; }, StopSailing() { this.sailing = false; }, LowerSails() {},
  } : null;
  const view = { look: { origin: [0, 5, 0], dir: [1, -0.05, 0] }, feet: [0, 0, 0] };
  const deps = {
    pool, csa: () => runtime, seaY: () => 0, isWater: (x, z) => (o.water ? o.water(x, z) : true), feet: () => view.feet, look: () => view.look, level: () => o.level ?? 5,
    where: () => ({ px: 100, py: 100, region: 23, day: o.day?.() ?? 1, nearPort: false, capitals: [{ region: 23, x: 100, y: 100 }], cityLights: false }),
    say: (t) => log.say.push(t), mid: (t) => log.mid.push(t),
    audio: { play3d: (k, p, v, opts) => log.sounds.push([k, opts]), loop3d: (k) => { log.loops.push(k); return { move() {}, stop() {} }; } },
    flame: () => ({ move() {}, retire() {} }),
    law: { crime: (r, c) => log.crimes.push([r, c]), legal: (r, n) => log.legal.push([r, n]), faction: (id, n) => log.faction.push([id, n]) },
    board: {
      leaveHelm: () => { log.left++; if (runtime) runtime.sailing = false; },
      placePlayer: (p, y) => log.placed.push([p, y]),
      deckSpots: (_b, n) => Array.from({ length: n }, (_, i) => [[i, 5, 0], 0]),
      spawnFoe: (mobile, pos, yaw, side) => { const h = { mobile, side, dead: false }; log.foes.push(h); return h; },
      foeDown: (h) => h.dead, removeFoe: (h) => log.removed.push(h),
      startRaid: (name) => { log.raids.push(name); return o.raidQuest ? { uid: 777, name, tasks: new Map() } : null; },
      openPlunder: (m) => { log.plunder.push(m); return o.plunderOpens ?? true; },
      giveItems: (items, b) => { log.given.push([items.length, b]); return { left: [] }; },
    },
    hold: (key, tier) => [{ name: `${key}@${tier}` }],
    online: o.online ?? null, setting: (k) => o.settings?.[k], random: seeded(o.seed ?? 1), shake: (a) => log.shake.push(a),
    sendHit: (d) => !!o.online?.sendHit?.(d),   // the world's hit retry queue, stood in for by the room's own door
  };
  const host = createNavalHost(deps);
  if (o.save) host.restoreSaveData(o.save);
  return { host, pool, boat, runtime, log, deps, view };
}
const run = (host, seconds, opts = {}) => { for (let t = 0; t < seconds - 1e-9; t += 0.1) host.frame(0.1, opts); };
const entryOf = (host, id) => host._sea.get(id);

// ── the guns ────────────────────────────────────────────────────────────────────────────────────────────────────

test('NAV-H at an armed helm the attack is the broadside\'s: look to a side and hold it - the guns laid under the look, the aim on the readout - let go and they fire: the balls out of her own muzzles, the report heard over its own range, the flash lighting the scene, the shake, that side reloading; a rowboat\'s attack is her swing (mutants: the release never firing, the reload skipped, the swing eaten at a rowboat)', async () => {
  const { host, log, view } = await harness({ hull: 2 });
  assert.equal(host.atGuns, true);
  assert.equal(host.attackInput(true), true, 'held: the swing never runs');
  assert.equal(host.aiming, true);
  host.frame(0.1);
  const aimed = host.hudModel();
  assert.equal(aimed.aim.side, 'starboard', 'the side the look lays');
  assert.ok(aimed.aim.range > 60 && aimed.aim.range < 200, `laid for ${aimed.aim.range} m`);
  assert.equal(aimed.batteries.find((b) => b.side === 'starboard').active, true);
  assert.ok(host.drawFrame().aim.arcs.length > 0, 'the arcs drawn');
  assert.equal(host.attackInput(false), true);
  assert.equal(host.aiming, false);
  assert.ok(host._shots.inFlight >= 5, 'the whole broadside');   // PIN MOVED (GALLEON, 2026-10-01): five ports a side
  assert.deepEqual(log.shake, [], 'AUDIT NAV1 (the presentation): no kick at the release - each gun kicks as it goes');
  run(host, 0.6);
  const booms = log.sounds.filter(([k]) => k === NAVAL_SFX.cannon);
  assert.ok(booms.length >= 5, 'each gun heard');
  assert.equal(booms[0][1].refDistance, 30, 'over a long gun\'s own range');
  assert.equal(log.sounds.some(([k]) => k === NAVAL_SFX.cannonFar), false, 'my own guns, near: no far roll');
  assert.ok(NEAR_BOOM_M > 0);
  assert.deepEqual(log.shake, booms.map(() => GUN_KICK.long), 'a long gun\'s kick a gun, along the ripple');
  const hud = host.hudModel();
  assert.equal(hud.batteries.find((b) => b.side === 'starboard').ready, false, 'reloading');
  assert.equal(hud.batteries.find((b) => b.side === 'port').ready, true);
  host.attackInput(true); host.attackInput(false);
  assert.ok(log.say.some((t) => /^The starboard guns are reloading \(\d+\.\d s\)\.$/.test(t)), 'and how long yet (AUDIT NAV1)');
  // the brace: held, the guns stay silent
  view.look = { origin: [0, 5, 0], dir: [-1, -0.05, 0] };
  host.frame(0.1, { brace: true });
  host.attackInput(true);
  host.frame(0.1, { brace: true });
  const before = host._shots.inFlight;
  host.attackInput(false);
  assert.equal(host._shots.inFlight, before, 'braced behind the rail: no volley');
  // a window over the aim puts it down unfired
  host.attackInput(true);
  host.cancelAim();
  assert.equal(host.aiming, false);
  // a rowboat has no guns: the attack is her swing
  const row = await harness({ hull: 0 });
  assert.equal(row.host.atGuns, false);
  assert.equal(row.host.attackInput(true), false);
  assert.equal(row.host.aiming, false);
});

test('NAV-H the look lays the battery: over the bow the chasers, astern the fire barrels rolled over the side to float, a broadside to either beam; a muzzle\'s flash lights the scene for MUZZLE_FLASH_S (mutants: the bow laid as a broadside, a barrel flown)', async () => {
  const { host, view } = await harness({ hull: 2 });
  view.look = { origin: [0, 5, 0], dir: [0, -0.05, 1] };
  host.attackInput(true); host.frame(0.1);
  assert.equal(host.hudModel().aim.side, 'bow');
  host.attackInput(false);
  run(host, 0.2);
  assert.ok(host.lights().some((l) => l.range > 0), 'the muzzle lights the scene');
  run(host, MUZZLE_FLASH_S + 1);
  view.look = { origin: [0, 5, 0], dir: [0, -0.2, -1] };
  host.attackInput(true); host.frame(0.1);
  assert.equal(host.hudModel().aim.side, 'stern');
  assert.equal(host.hudModel().aim.barrel, true);
  host.attackInput(false);
  assert.ok(host._shots.floaters().some((f) => f.kind === 'barrel'), 'a barrel afloat');
  assert.equal(host.hudModel().batteries.find((b) => b.side === 'stern').barrels, 3, 'one of the four spent');
});

// ── the sea's ships ─────────────────────────────────────────────────────────────────────────────────────────────

test('NAV-H ships come over the horizon while the player is on the water: the director rolls after its first wait, the ship is built on Come Sail Away\'s own hull the next frame and stood at sea level; off the water nothing sails in; "off" keeps the sea empty (mutants: the traffic on land, the build never done)', async () => {
  const { host, pool } = await harness({ hull: 2, settings: { ShipsAtSea: 'many' } });
  run(host, FIRST_ROLL_S + 60);
  const ships = host.stat().ships;
  assert.ok(ships.length >= 1, 'a ship sailed in');
  assert.ok(ships.every((s) => s.built), 'each on her hull');
  assert.ok(pool.seaBoats.length === ships.length);
  const e = [...host._sea.values()][0];
  assert.deepEqual(e.boat.GameObject.position.map((v) => +v.toFixed(3)), [+e.ship.pos[0].toFixed(3), 0, +e.ship.pos[2].toFixed(3)], 'at sea level, where her record says');
  assert.ok(e.ship.names?.name && e.ship.names.captain, 'named, her captain too');
  assert.deepEqual(e.boat.flagColor, NAVAL_FACTIONS[e.ship.cls.faction].flag, 'her colours on her flag');
  assert.equal(host.collidable().length, host.stat().ships.filter((s) => Math.hypot(s.pos[0], s.pos[2]) < 180).length);
  const dry = await harness({ water: (x, z) => Math.hypot(x, z) > 100, settings: { ShipsAtSea: 'many' } });   // on the shore, the sea a hundred metres off
  run(dry.host, FIRST_ROLL_S + 30);
  assert.equal(dry.host.stat().ships.length, 0, 'on land: none');
  const off = await harness({ hull: 2, settings: { ShipsAtSea: 'off' } });
  run(off.host, FIRST_ROLL_S + 30);
  assert.equal(off.host.stat().ships.length, 0);
});

/** A ship stood where a test wants her, built, and settled a frame. */
function place(h, classId, pos, yaw = 0) {
  const id = h.host.spawnShip(classId, { range: Math.hypot(pos[0], pos[2]), bearing: Math.atan2(pos[0], pos[2]), yaw });
  const e = entryOf(h.host, id);
  e.ship.pos = [...pos];
  h.host.frame(0.1);
  assert.ok(e.boat, 'built');
  return e;
}
const shootAt = (h, e, height = 4) => {
  const box = hullBoxOf(e.boat, h.pool.models);
  const from = [box.c[0] - 40, height, box.c[2]];
  h.host._shots.fireVolley({ id: `t${Math.random()}`, shooter: 'me:42', launches: [{ gun: 'long', index: 0, p0: from, v0: [80, 0.4, 0], delay: 0 }] });
};

test('NAV-H the law, from the shot: the first ball of mine to land on a merchantman is Piracy in the crown\'s waters - DFU\'s own crime through the law\'s seam - and notoriety there; she remembers who struck her; a hostile ship near stands Come Sail Away\'s time scale down (mutants: every ball a crime, the crown\'s region, the shot uncounted)', async () => {
  const h = await harness({ hull: 2 });
  const e = place(h, 'merchantGalleon', [70, 0, 0], Math.PI / 2);
  const hull0 = e.ship.damage.hull;
  assert.equal(h.host.hostileNear(), false, 'a merchantman is no threat');
  shootAt(h, e);
  run(h.host, 1);
  assert.ok(e.ship.damage.hull < hull0, 'struck');
  assert.deepEqual(h.log.crimes, [[23, CRIMES.Piracy]], 'Wayrest\'s waters');
  assert.ok(h.log.say.some((t) => t.startsWith('Piracy!')));
  assert.equal(h.host.hudModel().notoriety.value, NOTORIETY.fire);
  shootAt(h, e);
  run(h.host, 1);
  assert.equal(h.log.crimes.length, 1, 'once a ship');
  assert.equal(h.host.hostileNear(), true, 'she answers who struck her');
});

test('NAV-H boarding at the helm: a struck ship alongside and the way off, Activate throws the grapples - she is hauled for GRAPPLE_S, the helm is left, the player goes over her rail and her muster stands, her captain first, with the player\'s hands from a crewed boat; her captain and her men down, she is TAKEN: Piracy again for a lawful ship, the prize window on her hold, the captor\'s one choice, her fate (mutants: the haul skipped, the captain not first, the prize never offered, two choices)', async () => {
  const h = await harness({ hull: 2 });
  assert.equal(h.boat.crewed, true, 'a ship with her crew');
  const e = place(h, 'merchantGalleon', [7.4 + 7.4 + 12, 0, 0], 0);
  e.ship.damage.apply({ hull: Math.ceil(e.ship.damage.maxHull * 0.8), sail: 0, crew: 0 });
  assert.equal(e.ship.damage.state, SHIP_STATES.struck);
  h.host.frame(0.1);
  assert.deepEqual(h.host.hudModel().board, { name: e.ship.names.name, kind: 'board' });
  assert.equal(h.host.activate(), true, 'the grapples');
  assert.equal(h.host.boarding.phase, 'grapple');
  assert.ok(h.log.sounds.some(([k]) => k === NAVAL_SFX.grapple));
  run(h.host, GRAPPLE_S / 2);
  assert.equal(h.host.boarding.phase, 'grapple', 'hauled alongside first');
  assert.equal(h.log.left, 0, 'still at the helm while she comes');
  run(h.host, GRAPPLE_S / 2 + 0.2);
  assert.equal(h.host.boarding.phase, 'fight');
  assert.equal(h.log.left, 1, 'the helm left');
  assert.equal(h.log.placed.length, 1, 'over her rail');
  const enemies = h.log.foes.filter((f) => f.side === 'enemy'), hands = h.log.foes.filter((f) => f.side === 'ally');
  assert.equal(enemies[0].mobile, MUSTERS.merchant.captain, 'her captain first');
  assert.equal(enemies.length, Math.max(3, Math.min(12, Math.round(classById('merchantGalleon').boarders * e.ship.damage.crewShare()))));
  assert.ok(hands.length > 0 && hands.every((f) => f.mobile === HAND), 'Warm Ashes\' hands with me');
  for (const f of enemies.slice(1)) f.dead = true;
  run(h.host, 0.3);
  assert.equal(h.host.boarding.phase, 'fight', 'her captain still stands');
  enemies[0].dead = true;
  run(h.host, 0.2);
  assert.equal(h.host.boarding, null);
  assert.equal(e.ship.damage.state, SHIP_STATES.prize);
  assert.deepEqual(h.log.crimes, [[23, CRIMES.Piracy]], 'taking a lawful ship is Piracy (she was struck by no shot of mine)');
  assert.deepEqual(h.log.removed, hands, 'my hands go home; her dead lie on her deck');
  const m = h.log.plunder.at(-1);
  assert.equal(m.name, e.ship.names.name);
  assert.equal(m.raid, false);
  assert.ok(m.items.length > 0, 'her hold, drawn');
  assert.equal(m.mine().name, 'Small Ship');
  assert.deepEqual(m.offers().map((x) => x.id), ['repair', 'powder', 'press', 'papers']);   // AUDIT NAV1 (B13)
  const took = m.takeAll();
  assert.equal(took.where, 'hold');
  assert.equal(h.log.given.at(-1)[1], h.boat, 'into my own ship\'s hold');
  assert.equal(m.items.length, 0);
  assert.equal(m.choose('press'), true);
  assert.equal(m.choose('repair'), false, 'one choice');
  assert.equal(m.chosen(), 'press');
  m.fate('scuttle');
  assert.equal(e.ship.damage.state, SHIP_STATES.sinking);
  assert.equal(m.fated(), 'scuttle');
  assert.ok(h.log.placed.length >= 2, 'back aboard my own deck');
});

test('NAV-H boarders: a pirate that grapples a crewed boat brings Warm Ashes\' own raid onto its deck - its quest\'s foes stood on the boarded deck; its "Leave Ship" is the sea fight\'s ("naval") and leaves her struck alongside; a boat with no crew meets the arc\'s own party; "Pirates board you" off keeps them off (mutants: the raid never started, the gate proceeding into the voyage home)', async () => {
  const wrecked = { v: 1, boats: { 42: { hull: 0, sail: 0, crew: 24, fire: 0, state: 'wrecked', barrels: 4 } }, notoriety: {}, day: 1, raids: [] };
  const h = await harness({ hull: 2, raidQuest: true, save: wrecked });
  const p = place(h, 'pirateSloop', [16, 0, 0], 0);
  run(h.host, 0.5);
  assert.equal(h.host.boarding?.kind, 'repel', 'a crippled boat is boarded at once');
  run(h.host, GRAPPLE_S + 0.2);
  assert.deepEqual(h.log.raids, [WA_SMALLRAID]);
  const quest = { uid: 777 };
  const raidQuest = [...h.log.raids].length && h.host.boarding?.quest;
  assert.ok(raidQuest, 'the raid is the fight');
  assert.ok(h.host.placeQuestFoe(raidQuest), 'its foes stand on my deck');
  assert.equal(h.host.leaveShipGate(raidQuest), 'naval');
  assert.equal(h.host.boarding, null);
  assert.equal(p.ship.damage.state, SHIP_STATES.struck, 'her boarders spent, she lies struck alongside');
  assert.equal(h.host.leaveShipGate(quest), 'wait', 'a raid of no boarding of mine is the voyage\'s: its raiders\' hold first');
  // no crew (the Large Boat's): the arc's own party
  const b = await harness({ hull: 1, raidQuest: true, save: wrecked });
  assert.equal(b.boat.crewed, false);
  place(b, 'pirateSloop', [16, 0, 0], 0);
  run(b.host, GRAPPLE_S + 0.8);
  assert.deepEqual(b.log.raids, []);
  assert.ok(b.log.foes.length >= 3 && b.log.foes.every((f) => f.side === 'enemy'));
  // the switch
  const off = await harness({ hull: 2, raidQuest: true, save: wrecked, settings: { Boarders: false } });
  place(off, 'pirateSloop', [16, 0, 0], 0);
  run(off.host, GRAPPLE_S + 0.8);
  assert.equal(off.host.boarding, null);
  assert.deepEqual(off.log.raids, []);
});

test('NAV-H Warm Ashes\' voyage raid, beaten: its "Leave Ship" waits while the raiders\' hold is open in the plunder window and sails on when the window says so; no window, or the switch off, and the voyage goes on at once (mutants: the voyage never waiting, waiting forever)', async () => {
  const h = await harness({ hull: 2 });
  const quest = { uid: 5 };
  assert.equal(h.host.leaveShipGate(quest), 'wait');
  const m = h.log.plunder.at(-1);
  assert.equal(m.raid, true);
  assert.ok(m.items.length > 0);
  assert.deepEqual(m.offers(), []);
  assert.equal(m.takeAll().where, 'pack');
  assert.equal(h.host.leaveShipGate(quest), 'wait');
  m.fate('sail');
  assert.equal(h.host.leaveShipGate(quest), 'proceed');
  const shut = await harness({ hull: 2, plunderOpens: false });
  assert.equal(shut.host.leaveShipGate({ uid: 6 }), 'proceed');
  const off = await harness({ hull: 2, settings: { RaidPrize: false } });
  assert.equal(off.host.leaveShipGate({ uid: 7 }), 'proceed');
  assert.deepEqual(off.log.plunder, []);
});

// ── the save ────────────────────────────────────────────────────────────────────────────────────────────────────

test('NAV-H the save: each boat of mine by its deed\'s UID (its hurts and barrels, waiting for the boat to stand again), notoriety crown by crown, the day it last faded, the raids a load must still call the sea fight\'s; a bad record dropped whole; the sea itself is never a save\'s (mutants: a boat keyed by nothing, the raids forgotten)', async () => {
  const h = await harness({ hull: 2, save: { v: 1, boats: { 42: { hull: 100, sail: 50, crew: 10, fire: 0, state: 'afloat', barrels: 1 }, x: { hull: 1 }, [-3]: { hull: 1 } }, notoriety: { Wayrest: 40, Atlantis: 9 }, day: 3, raids: [777, 'x', 1.5] } });
  h.host.frame(0.1);
  const d = h.host.getSaveData();
  assert.equal(d.v, NAVAL_SAVE_VERSION);
  assert.deepEqual(Object.keys(d.boats), ['42']);
  // PIN MOVED (SHIP-CREW, SEA-REPAIR): her crew as people (`mates`) and her store part-spent (`credit`) beside her hurts
  const { mates, credit, ...hurts } = d.boats[42];
  // PIN MOVED (TOUGHER-SHIPS): a boat is saved on her first build's scale, that whole said (navalHost.js savedRecord) - to
  // the hundredth, so her hands' first tenth of a second of mending shows
  const first = firstBuildOf(2);
  const { hull: hull1, sail: sail1, ...rest } = hurts;
  // PIN MOVED (TOUGHER-SHIPS + HOLDINGS' merge of main's #574): and her fires each and the crew's burn (the damage's saveData)
  // and `exact`: her hurts on her whole now, read back to the bit by this build (FG-05)
  const { exact, ...plain } = rest;
  assert.deepEqual(plain, { crew: 10, fire: 0, fires: [], crewBurn: 0, state: 'afloat', maxHull: first.hullHp, maxSail: first.sailHp, barrels: 1 });
  assert.deepEqual([exact.maxHull, exact.maxSail, exact.credit], [hullBuild(2).hullHp, hullBuild(2).sailHp, 0]);
  assert.ok(exact.hull > 100 && Math.abs(exact.hull / exact.maxHull - hull1 / first.hullHp) < 1e-4, 'the same share, unrounded');
  assert.ok(hull1 >= 100 && hull1 < 100.2 && sail1 >= 50 && sail1 < 50.2, `her hurts as saved, on her first build's scale (${hull1}, ${sail1})`);
  assert.equal(credit, 0);
  assert.equal(mates.hands.length, 2, 'her two hands on deck, named');
  assert.deepEqual(d.notoriety, { Wayrest: 40 });
  assert.deepEqual(d.raids, [777]);
  assert.ok(Math.abs(h.host.hudModel().ship.hull - 100 / firstBuildOf(2).hullHp) < 1e-3, 'her hurts as saved (AUDIT NAV1: her hands mending from there - test/navaudit_helm.test.js)');
  assert.equal(h.host.leaveShipGate({ uid: 777 }), 'naval', 'a raid of mine a load carried: thrown back, nothing sailed');
  assert.deepEqual(h.host.getSaveData().raids, []);
  assert.deepEqual(d.party, { party: [], resting: [] }, 'CREW-COMPANIONS: an older save carries no party - nobody ashore');
  assert.deepEqual(h.host.newSaveData(), { v: NAVAL_SAVE_VERSION, boats: {}, notoriety: {}, day: null, raids: [], party: { party: [], resting: [] } });   // PIN MOVED (CREW-COMPANIONS): the party ashore
  assert.equal(NAVAL_SAVE_VENDOR, 'NavalCombat');
  h.host.spawnShip('pirateBrig', { range: 300 });
  h.host.restoreSaveData(null);
  assert.equal(h.host.stat().ships.length, 0, 'a load empties the sea');
});

// ── online ──────────────────────────────────────────────────────────────────────────────────────────────────────

test('NAV-H online, the stander: the lowest id near stands the sea and says it; a peer\'s blow on a ship I stand lands here; AUDIT NAV1 (online): no claim marks her (a ship boarded is taken over at the grapple), and an owner gone from the room leaves their ships to the heir - here me, one past their handover count (mutants: a peer\'s blow ignored)', async () => {
  const peers = [{ id: 'b-player', feet: [30, 0, 0] }];
  const hits = [];
  const h = await harness({ hull: 2, online: { id: () => 'a-player', peers: () => peers, sendHit: (d) => { hits.push(d); return true; } } });
  const e = place(h, 'merchantGalleon', [120, 0, 0], 0);
  const rec = validNavalRecord(h.host.word((p) => p));
  assert.equal(rec.ships.length, 1, 'my sea, said');
  assert.equal(rec.ships[0].classId, 'merchantGalleon');
  const hull0 = e.ship.damage.hull;
  assert.equal(h.host.applyPeerHit('b-player', navalHitData('a-player', { n: e.n, hull: 40, zone: 'holed' })), true);
  assert.equal(e.ship.damage.hull, hull0 - 40);
  assert.equal(h.host.hostileNear(), false, 'she remembers b-player, not me');
  assert.equal(h.host.applyPeerHit('b-player', { to: 'a-player', nv: { n: e.n, h: 0, s: 0, c: 0, f: 0, z: 0, board: 1 } }), true, 'an older word\'s claim: a blow of nothing');
  assert.equal(e.ship.boarded, false, 'no claim marks her');
  assert.equal(h.host.applyPeerHit('b-player', { nv: { n: e.n, h: 9999 } }), false, 'through the door or not at all');
  // a peer's own ships go with them
  const theirs = { s: [[1, 0, 0, 500, 0, 500, 0, 0, 1, 100, 100, 100, 0, 0, 12345, 0]], v: [], b: [] };
  assert.equal(h.host.applyWord('b-player', theirs, (p) => p), true);
  assert.equal([...h.host._sea.values()].filter((x) => x.owner === 'b-player').length, 1);
  const theirShip = [...h.host._sea.values()].find((x) => x.owner === 'b-player');
  peers.length = 0;
  run(h.host, OWNER_SWEEP_S + 0.2);
  assert.equal([...h.host._sea.values()].filter((x) => x.owner === 'b-player').length, 0, 'b-player left the room');
  assert.ok(theirShip.owner === null && theirShip.gen === 1 && h.host._sea.get(theirShip.id) === theirShip, 'the heir takes her over - the same ship, one past her count');
});

test('NAV-H online, the striker: the stander\'s ships stand here as puppets eased toward their word; my blow on one goes to her stander as a hit frame, never landed here; she goes down in their word within SINK_CREDIT_S of my blow and the sinking is mine to answer for; a peer\'s volley flies here to be seen, never judged (mutants: my blow landed twice, the sink never charged)', async () => {
  const hits = [];
  const h = await harness({ hull: 2, online: { id: () => 'b-player', peers: () => [{ id: 'a-player', feet: [10, 0, 0] }], sendHit: (d) => { hits.push(d); return true; } } });
  run(h.host, FIRST_ROLL_S + 20);
  assert.equal([...h.host._sea.values()].filter((x) => !x.owner).length, 0, 'a-player stands the sea: I launch nothing');
  const cls = ['pirateSloop', 'pirateBrig', 'pirateGalley', 'pirateFlagship', 'merchantCoaster', 'merchantGalleon'].indexOf('merchantGalleon');
  const word = (state = 0, hull = 100) => ({ s: [[4, cls, 0, 70, 0, 0, Math.PI / 2, 0, 1, hull, 100, 100, state, 0, 999, 0]], v: [], b: [] });
  h.host.applyWord('a-player', word(), (p) => p);
  const e = entryOf(h.host, 'a-player:4');
  assert.ok(e, 'her puppet');
  run(h.host, 0.3);
  assert.ok(e.boat, 'on her hull');
  shootAt(h, e);
  run(h.host, 1);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].to, 'a-player');
  assert.equal(hits[0].nv.n, 4);
  assert.equal(e.ship.damage.hull, e.ship.damage.maxHull, 'her stander lands it, not I');
  assert.deepEqual(h.log.crimes, [[23, CRIMES.Piracy]], 'my own law for my own shot');
  h.host.applyWord('a-player', word(2, 0), (p) => p);   // she goes down in a-player's world
  assert.equal(h.host.hudModel().notoriety.value, NOTORIETY.fire + NOTORIETY.sink, 'her sinking is mine to answer for');
  // past the window it is not
  const late = await harness({ hull: 2, online: { id: () => 'b-player', peers: () => [{ id: 'a-player', feet: [10, 0, 0] }], sendHit: () => true } });
  late.host.applyWord('a-player', word(), (p) => p);
  const le = entryOf(late.host, 'a-player:4');
  run(late.host, 0.3);
  shootAt(late, le);
  run(late.host, 1);
  assert.equal(late.host.hudModel().notoriety.value, NOTORIETY.fire, 'my blow landed');
  for (let t = 0; t < SINK_CREDIT_S + 2; t++) { late.host.applyWord('a-player', word(0, 60), (p) => p); run(late.host, 1); }   // her owner's word, fresh all the while
  assert.equal(entryOf(late.host, 'a-player:4'), le, 'the same ship, never dropped');
  late.host.applyWord('a-player', word(2, 0), (p) => p);
  assert.equal(late.host.hudModel().notoriety.value, NOTORIETY.fire, 'too long after my last blow');
  // a peer's volley: flown and drawn here, its balls never my law's
  const v = { s: word().s, v: [[9, 4, 2, 0, 70, 0, 0, Math.PI / 2, 0, 0, 0.05, 31337, 0.6]], b: [] };
  const flying = h.host._shots.inFlight;
  h.host.applyWord('a-player', v, (p) => p);
  const flown = h.host._shots.inFlight;
  assert.ok(flown > flying, 'her broadside flies here');
  h.host.applyWord('a-player', v, (p) => p);
  assert.equal(h.host._shots.inFlight, flown, 'a volley seen once - the same word again flies nothing new');
  assert.equal(h.host.applyWord('b-player', v, (p) => p), false, 'my own word is never a peer\'s');
  h.host.clearPeers();
  assert.equal([...h.host._sea.values()].filter((x) => x.owner).length, 0);
});

// ── the world host's wiring ─────────────────────────────────────────────────────────────────────────────────────

test('NAV-H the world host: one naval host on Come Sail Away\'s pool, its record in the save\'s per-mod slot, its frame after the helm moved the boat and before the pool walks the hulls, the Activate ladder\'s own arm, its pass after the boats\' drops, its lights beside the Thunderlock\'s flash, the origin\'s move, every transition, the quest foes on a boarded deck, the raid\'s end and Warm Ashes\' gate, and (AUDIT NAV1, online #9) a blow or a claim to another player through the world\'s hit retry queue (mutants: a door unwired, a bare send)', () => {
  const w = src('scenes/world.js');
  assert.match(w, /naval = createNavalHost\(\{/);
  // AUDIT NAV1 (online #9): the sea's blows and grapples through AUDIT FOES FOE2's pending set - one the wire refused, or
  // sent while the socket was away, goes a frame later (a bare send threw the refusal away: a blow that never happened)
  assert.match(w, /\n\s+sendHit: \(data\) => hitSend\(data\),\n/);
  assert.match(w, /return \{ id: \(\) => online\?\.id \?\? null, peers: \(\) => peersNear\(\) \?\? \[\] \};/, 'the room\'s view carries no door of its own');
  assert.match(w, /registerModSaveData\(NAVAL_SAVE_VENDOR, naval\);/);
  assert.match(w, /cam\.pos = player\.eyeAt\(\);\n\s+navalFrame\(dt\);/, 'after the eye is taken');
  assert.ok(w.indexOf('navalFrame(dt);   // NAV-H') < w.indexOf('csaPoolFrame(dt);   // CSA-B/C'), 'before the pool walks the hulls it posed');
  assert.match(w, /else if \(!_race\.loot && !_race\.drop && naval\?\.activate\(\{ boatTrigger: !!_race\.boatWins \}\)\) \{/);   // PIN MOVED (AUDIT HOLDINGS Q4): her own trigger under the ray named, the gangway yielding to it
  assert.match(w, /csaDrawParticlesBlended\(\);[^\n]*\n(?:[^\n]*\n){0,3}\s*if \(naval\?\.enabled\) navalRender\.draw\(naval\.drawFrame\(\)\);/);
  assert.equal((w.match(/thunderlockMuzzleLight\(playerEntity, player\.feetAt\(\), cam\.yaw\), \.\.\.\(naval\?\.enabled \? naval\.lights\(\) : \[\]\), \.\.\.peerTorchLights\(\)/g) ?? []).length, 2, 'both light lists');
  // PIN MOVED (HARBOUR-BOOK): the world's harbours moved first, then the sea that reads them
  assert.match(w, /csaPeers\.rebase\(r\.offset\);[^\n]*\n\s+harbourBook\.offsetAll\(r\.offset\);[^\n]*\n\s+naval\?\.offsetAll\(r\.offset\); navalFlames\.offsetAll\(r\.offset\);/);
  assert.ok((w.match(/navalTransition\(\);/g) ?? []).length >= 4, 'every transition empties the sea');
  assert.match(w, /naval\?\.placeQuestFoe\(handle\.foe\?\.parentQuest \?\? null, /);   // AUDIT NAV1 (B10): and the held spots passed over (test/navaudit_boarding.test.js)
  assert.match(w, /naval\?\.raidEnded\(q\);/);
  assert.match(w, /leaveShipGate: \(quest\) => naval\?\.leaveShipGate\(quest\) \?\? 'proceed',/);
  assert.match(w, /const csaColliderBoats = \(\) => \(naval\?\.enabled \? \[\.\.\.csa\.boats, \.\.\.naval\.collidable\(\)\] : csa\.boats\);/, 'her deck walkable, her hull a thing to strike');
  // a hostile ship in reach is an enemy nearby wherever the game asks it outdoors, as DUEL1's opponent is
  assert.match(w, /const navalHostileNear = \(\) => !!naval\?\.hostileNear\(\);/);
  assert.match(w, /enemiesNearby: \(\) => areEnemiesNearby\([^\n]*\) \|\| navalHostileNear\(\),   \/\/ NAV-H: a hostile ship in reach holds the helm's time scale too/, 'no hurrying time with a hostile sail near');
  assert.match(w, /if \(duelEnemyNear\(\) \|\| areEnemiesNearby\(\[\.\.\.cityGuards\.guards, \.\.\.exteriorFoes\.foes\]\) \|\| navalHostileNear\(\)\) \{/, 'no travel map');
  assert.match(w, /\.\.\.exteriorFoes\.foes\]\) \|\| navalHostileNear\(\)\) return CANNOT_TRAVEL_ENEMIES_TEXT;/, 'no party trip');
  assert.match(w, /enemiesNearby: \(\) => duelEnemyNear\(\) \|\| areEnemiesNearby\(\[\.\.\.cityGuards\.guards, \.\.\.wildSeen\(exteriorFoes\.foes\)\]\) \|\| navalHostileNear\(\),/, 'no journey - the Overworld\'s sea legs stop for her (WILD-ALERT: the foes a fast traveller\'s stop counts)');
  assert.match(w, /\[\.\.\.cityGuards\.guards, \.\.\.exteriorFoes\.foes\], \{ resting: true \}\) \|\| navalHostileNear\(\),/, 'no rest');
});

test('NAV-H the attack\'s five doors: a readied spell eats the press first, the helm\'s guns take it second, the rig last; the release is never gated and fires the broadside as its own statement; at a helm with guns the drag and the look under a held attack are the aim\'s - the look never dropped there - and the pad and the finger hold it plainly (mutants: the guns before the spell, a gated release, the look settled while aiming)', () => {
  const w = src('scenes/world.js');
  assert.match(w, /\{ if \(gatherHost\?\.acting\(\)\) return; if \(magic\.interceptAttack\(true\)\) return; if \(naval\?\.attackInput\(true\)\) return; weaponRig\.attackInput\(0, 0, true\); \}/, 'mousedown (PROF1\'s act takes its own press first, main\'s)');
  assert.match(w, /if \(isSwingButton\(e\.button\) && walkMode && modeNow\(\) === 'exterior'\) weaponRig\.attackInput\(0, 0, false\); if \(isSwingButton\(e\.button\)\) navalRelease\(\);/, 'mouseup');
  assert.match(w, /if \(held && magic\.interceptAttack\(true\)\) return;[^\n]*\n\s+if \(held && naval\?\.attackInput\(true\)\) return;[^\n]*\n\s+if \(!held\) navalRelease\(\);[^\n]*\n\s+weaponRig\.attackInput\(dx, dy, held\);/, 'the finger and the pad');
  assert.match(w, /if \(!swingKey\) \{ weaponRig\.attackInput\(0, 0, false\); navalRelease\(\); \}[^\n]*\n\s+else if \(!townTalk\.overlayActive && walkMode && modeNow\(\) === 'exterior' && !gatherHost\?\.acting\(\) && !magic\.interceptAttack\(true\) && !naval\?\.attackInput\(true\)\) weaponRig\.attackInput\(0, 0, true\);/, 'the key latch');
  assert.match(w, /const drag = routed === 'swing' && naval\?\.atGuns \? 'look' : routed;/, 'the drag at the guns is a look');
  assert.match(w, /&& walkMode && modeNow\(\) === 'exterior' && !naval\?\.atGuns\) lookFilter\.settle\(\);/, 'the look never dropped at the guns');
  assert.match(w, /aimHold: \(\) => !!naval\?\.atGuns,/);
  assert.match(w, /function navalRelease\(\) \{\n\s+if \(!naval\?\.aiming\) return;\n\s+if \(townTalk\.overlayActive \|\| gamePaused\(\) \|\| modeNow\(\) !== 'exterior'\) naval\.cancelAim\(\);\n\s+else naval\.attackInput\(false\);/, 'a window over the aim puts it down unfired');
  assert.match(w, /brace: csaRuntime\.isSailing\(\) && \(held\(keys, 'Crouch'\) \|\| navalTouchBrace\(\)\)/, 'the brace is the Crouch action at the helm (AUDIT NAV1: or the plate\'s Brace under a finger)');
  const pad = src('ui/gamepadInput.js');
  assert.match(pad, /&& !hooks\.aimHold\?\.\(\);/, 'the pad holds RT plainly at the guns');
  assert.match(pad, /if \(swinging && !plus && !hooks\.aimHold\?\.\(\)\) hooks\.attack\?\./, 'and its right stick looks');
  const touch = src('ui/touch.js');
  assert.match(touch, /if \(swiping && hooks\.aimHold\?\.\(\)\) \{ hooks\.look\?\.\(ev\.dx \* TOUCH_LOOK_GAIN \* lookNorm\(\), ev\.dy \* TOUCH_LOOK_GAIN \* lookNorm\(\)\); continue; \}/, 'the finger\'s drag under the hold is a look');
});

test('NAV-H the switch: the Features row on the port\'s own prefs, forced on online, its three parts - the traffic, the boarders, a voyage raid\'s plunder - each the player\'s own; the host reads them through `setting` (mutants: the switch unread, a part unwired)', () => {
  const w = src('scenes/world.js');
  assert.match(w, /const navalOn = \(\) => !!csaRuntime && csaOn\(\) && getPref\('naval'\) !== false;/);
  for (const [k, pref] of [['ShipsAtSea', 'naval-ships'], ['RaidPrize', 'naval-raid-prize'], ['Boarders', 'naval-boarders']]) {
    assert.ok(w.includes(`'${k}'`) && w.includes(`'${pref}'`), `${k} reads ${pref}`);
  }
  const f = src('systems/features.js');
  assert.match(f, /id: 'naval-combat',\s+group: 'combat',\s+title: 'Naval Combat',/);
  assert.match(f, /control: Object\.freeze\(\{\s*store: 'prefs', key: 'naval', initial: true, online: true,/);
});
