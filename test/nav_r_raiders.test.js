// NAV-R (2026-09-28, Mac, of main's Overworld raiders: "Definitely want them to appear as ships") - WARM ASHES' RAIDERS,
// STOOD AS SHIPS OF THE SEA: the pure law (systems/naval/navalRaiders.js - a raider's class off its seed, the plan of
// which stand and which go, one copy between two players), the host driving them through real frames over Come Sail
// Away's real pool (scenes/navalHost.js raiders, raiderShipOf, the captain's own sight and course), and the world
// host's wiring, pinned (bible/03-World/Naval-Combat.md NAV-R). THE MERGE with main's OW6 (the raiders' chase, shared on the
// cell's foes frames): a raider a peer holds is never stood here, the ships my sea stands are said as held, and a spent
// ship is spent through the Overworld's own spend - the law, the host and the world host run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { raiderClassOf, raiderPlan, RAIDER_STAND_M, RAIDER_DROP_M, RAIDER_SHIPS_MAX, RAIDER_LEAD_S } from '../src/systems/naval/navalRaiders.js';
import { createNavalHost, RAIDER_SHEER_M, HOSTILE_NEAR_M, SHIP_FADE_S } from '../src/scenes/navalHost.js';
import { createComeSailAwayPool } from '../src/scenes/comeSailAwayPool.js';
import { Boat } from '../src/systems/comeSailAwayBoat.js';
import { SHIP_CLASSES } from '../src/systems/naval/navalShips.js';
import { SHIP_STATES } from '../src/systems/naval/navalDamage.js';
import { ENGAGE_RANGE } from '../src/systems/naval/navalAI.js';
import { navalWireRecord } from '../src/systems/naval/navalWire.js';
import { RAIDER_SIGHT_M, RAIDER_SIGHT_NIGHT_M, RAIDER_SAIL_MPS, RAIDERS_WIRE_MAX, RAIDER_WORD_MS, RAIDER_CONTACT_M, RAIDER_CHASE_MPS, raiderWordOf } from '../src/systems/seaRaiders.js';

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

// ── the law ─────────────────────────────────────────────────────────────────────────────────────────────────────

test('NAV-R a raider\'s class: a pirate the player\'s level has met, drawn off the raider\'s own seed by the classes\' weights - never the flagship (the small raid\'s crew, not WAQ_SHIP_ATTACK_PIRATE\'s); one seed, one class for every player of a level (mutants: the flagship drawn, the level ungated, the seed unread)', () => {
  const seeds = Array.from({ length: 6000 }, (_, i) => (Math.imul(i + 1013, 73856093) ^ 0x52414944) >>> 0);
  for (const level of [1, 4, 7, 20]) {
    const count = {};
    for (const seed of seeds) {
      const c = raiderClassOf(seed, level);
      assert.equal(c.faction, 'pirate');
      assert.equal(c.flagship, false, 'never the flagship');
      assert.ok(c.minLevel <= level, `${c.id} at level ${level}`);
      assert.equal(raiderClassOf(seed, level), c, 'the seed decides');
      count[c.id] = (count[c.id] ?? 0) + 1;
    }
    const pool = SHIP_CLASSES.filter((c) => c.faction === 'pirate' && !c.flagship && c.minLevel <= level);
    const total = pool.reduce((s, c) => s + c.weight, 0);
    for (const c of pool) assert.ok(Math.abs(count[c.id] / seeds.length - c.weight / total) < 0.03, `${c.id} at level ${level}: ${count[c.id]}`);
    assert.equal(Object.keys(count).length, pool.length, 'every class the level has met is drawn');
  }
});

test('NAV-R the plan: a raider within RAIDER_STAND_M of me stands, the nearest first and RAIDER_SHIPS_MAX at most, never a spent one; one of mine past RAIDER_DROP_M goes unless it fights, and one whose life is over only once it is out of sight; AUDIT NAV1 (online): a peer\'s copy of the seed already in my sea is hers whoever\'s id is lower - never a second stood beside it - and one of mine is never dropped for it (the claim rule yields my copy into theirs, the same hull: navalHost.js claimBeats) (mutants: the range unread, the cap, a spent one stood, a fight let go of, a copy stood beside another\'s)', () => {
  const me = [0, 0, 0];
  const r = (id, seed, x) => ({ id, seed, pos: [x, 0, 0] });
  const empty = { me, myId: 'm', stood: new Map(), peers: new Map(), spent: new Set() };
  assert.deepEqual(raiderPlan({ ...empty, raiders: [r('a', 1, RAIDER_STAND_M + 5)] }), { stand: [], drop: [] }, 'out of reach');
  // SEA-EASE (PIN MOVED): one raider at a time (RAIDER_SHIPS_MAX was two) - the nearest
  assert.equal(RAIDER_SHIPS_MAX, 1);
  assert.deepEqual(raiderPlan({ ...empty, raiders: [r('far', 1, 1100), r('near', 2, 300), r('mid', 3, 800)] }).stand, ['near'], `the nearest ${RAIDER_SHIPS_MAX}`);
  assert.deepEqual(raiderPlan({ ...empty, raiders: [r('a', 1, 300)], spent: new Set(['a']) }).stand, [], 'spent for its life');
  // mine: kept while it fights, let go past the drop range, and one gone past its life only out of sight
  const stood = new Map([['a', { pos: [RAIDER_DROP_M + 10, 0, 0], engaged: false }], ['b', { pos: [RAIDER_DROP_M + 10, 0, 0], engaged: true }], ['c', { pos: [600, 0, 0], engaged: false }]]);
  const plan = raiderPlan({ ...empty, stood, raiders: [r('a', 1, RAIDER_DROP_M + 10), r('b', 2, RAIDER_DROP_M + 10), r('d', 4, 200)] });
  assert.deepEqual(plan.drop, ['a'], 'out of sight and fighting no one; `c` (its life over) sails on in sight');
  assert.deepEqual(plan.stand, [], `two already stand: ${RAIDER_SHIPS_MAX} at most`);
  // one copy between two players: a copy in my sea is hers, whoever's id is lower
  assert.deepEqual(raiderPlan({ ...empty, raiders: [r('a', 7, 300)], peers: new Map([[7, 'a-peer']]) }).stand, [], 'a lower id stands it: I do not');
  assert.deepEqual(raiderPlan({ ...empty, raiders: [r('a', 7, 300)], peers: new Map([[7, 'z-peer']]) }).stand, [], 'a higher id\'s copy (taken over, the stronger claim): never a second beside it');
  const kept = raiderPlan({ ...empty, raiders: [r('a', 7, 300)], stood: new Map([['a', { pos: [300, 0, 0], engaged: true }]]), peers: new Map([[7, 'a-peer']]) });
  assert.deepEqual(kept.drop, [], 'mine is never dropped for a copy - the claim rule yields it into theirs, the same hull');
});

// ── the host ────────────────────────────────────────────────────────────────────────────────────────────────────

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
async function harness(o = {}) {
  const pool = await readyPool();
  pool.destroyAll();
  const log = { spent: [], say: [] };
  const boat = pool.spawnNow(Object.assign(new Boat(o.hull ?? 2, 0), { uid: 42 }), { position: [0, 0, 0], rotation: [0, 0, 0, 1] });
  const runtime = {
    sailing: true, state: { CurrentBoat: boat, AllBoats: [boat], velocityCurrent: [0, 0, 0], windVectorCurrent: [0.6, 0, 0.8], sailPosition: 0 },
    isSailing() { return this.sailing; }, StopSailing() { this.sailing = false; }, LowerSails() {},
  };
  const view = { feet: [0, 0, 0] };
  const deps = {
    pool, csa: () => runtime, seaY: () => 0, isWater: () => true, feet: () => view.feet, look: () => ({ origin: [0, 5, 0], dir: [1, 0, 0] }), level: () => o.level ?? 5,
    where: () => ({ px: 100, py: 100, region: 23, day: 1, nearPort: false, capitals: [{ region: 23, x: 100, y: 100 }], cityLights: false }),
    say: (t) => log.say.push(t), mid() {}, audio: { play3d() {}, loop3d: () => ({ move() {}, stop() {} }) }, flame: () => ({ move() {}, retire() {} }),
    law: { crime() {}, legal() {}, faction() {} },
    board: { leaveHelm() {}, placePlayer() {}, deckSpots: (_b, n) => Array.from({ length: n }, (_, i) => [[i, 5, 0], 0]), spawnFoe: () => ({ dead: false }), foeDown: () => false, removeFoe() {}, startRaid: () => null, openPlunder: () => true, giveItems: () => ({ left: [] }) },
    hold: () => [], online: o.online ?? null, setting: (k) => o.settings?.[k], random: seeded(3), shake() {},
    sendHit: (d) => !!o.online?.sendHit?.(d),
    raiderSpent: (id) => log.spent.push(id),
  };
  const host = createNavalHost(deps);
  return { host, pool, boat, log, view, deps, runtime };
}
const run = (host, seconds) => { for (let t = 0; t < seconds - 1e-9; t += 0.1) host.frame(0.1); };
const raiderShips = (host) => [...host._sea.values()].filter((e) => e.raider);
/** A raider sailing +x at 900 m, its course where it is RAIDER_LEAD_S on. */
const RAIDER = { id: 'r16.16.100', seed: 0x51f00d, pos: [900, 0, 0], yaw: Math.PI / 2, ahead: [900 + RAIDER_SAIL_MPS * RAIDER_LEAD_S, 0, 0] };

test('NAV-R a raider near me at sea stands as a pirate of its seed\'s own class and name - her colours, her guns, her captain - steering the place its seeded course reaches RAIDER_LEAD_S on; she looks out as far as the raiders\' lookout sees (a night\'s 500 m) and, a day\'s 1,000 m sighting me, closes and fights as any pirate; the map finds her where she sails and that she chases (mutants: the course unread, the sight unread, the chase unsaid)', async () => {
  const { host, runtime } = await harness({ settings: { ShipsAtSea: 'off' } });
  runtime.state.velocityCurrent = [0, 0, 2];   // AUDIT NAV1: under way - a boat lying still draws her alongside to board instead (navaudit_captains)
  host.raiders([RAIDER], { sight: RAIDER_SIGHT_NIGHT_M, spent: new Set() });
  const [e] = raiderShips(host);
  assert.ok(e, 'stood');
  assert.equal(e.ship.seed, RAIDER.seed);
  assert.equal(e.ship.cls, raiderClassOf(RAIDER.seed, 5), 'her class off her seed at my level');
  assert.ok(e.ship.names?.name && e.ship.names?.captain, 'named, her captain too');
  assert.deepEqual(e.ship.pos, [900, 0, 0]);
  assert.equal(e.ship.sight, RAIDER_SIGHT_NIGHT_M);
  assert.deepEqual(e.ship.course, [RAIDER.ahead[0], RAIDER.ahead[2]]);
  assert.deepEqual(host.raiderShipOf(RAIDER.seed), { pos: e.ship.pos, chase: false });
  assert.equal(host.raiderShipOf(RAIDER.seed + 1), null);
  // at night I am past her lookout: she sails her course, away from me - down its line, not off on a waypoint of her own
  let offLine = 0;
  for (let t = 0; t < 40 && e.ship.pos[0] <= 960; t += 0.1) { host.frame(0.1); offLine = Math.max(offLine, Math.abs(e.ship.pos[2])); }   // (HELM-WAY: her way comes on in seconds - 40 s carried her past a day's sight)
  assert.equal(e.ship.mode, 'cruise');
  assert.ok(e.ship.pos[0] > 940 && offLine < 6, `on her course (${e.ship.pos.map((v) => v.toFixed(1))}, ${offLine.toFixed(1)} m off it)`);
  // by day her lookout sees me - further than the sea's own captains look (ENGAGE_RANGE)
  assert.ok(RAIDER_SIGHT_M > ENGAGE_RANGE);
  host.raiders([{ ...RAIDER, pos: e.ship.pos }], { sight: RAIDER_SIGHT_M, spent: new Set() });
  assert.equal(raiderShips(host).length, 1, 'the same ship, not a second');
  run(host, 2);
  assert.equal(e.ship.mode, 'engage');
  assert.equal(e.ship.target, 'local');
  assert.equal(host.raiderShipOf(RAIDER.seed).chase, true, 'the map says she chases');
  const d0 = Math.hypot(...e.ship.pos);
  run(host, 90);   // AUDIT NAV1: she wears round on her own turning circle first (a sloop in this sea's light wind)
  assert.ok(Math.hypot(...e.ship.pos) < d0 - 40, 'she closes');
});

test('NAV-R a raider is SPENT for its life - said once to the world host - when she sinks, strikes, is taken or boarded, and when she chased me and lost me: given the slip she sheers off RAIDER_SHEER_M away and looks for no one, and goes once out of sight; a spent raider is never stood again (mutants: the slip unspent, the sheer off, the sinking unspent, a spent one restood)', async () => {
  const { host, log, view, boat } = await harness({ settings: { ShipsAtSea: 'off' } });
  host.raiders([RAIDER], { sight: RAIDER_SIGHT_M, spent: new Set() });
  run(host, 2);
  const [e] = raiderShips(host);
  assert.equal(e.ship.mode, 'engage');
  // I slip away: far past her lookout in a moment (a fast travel, a crossing)
  boat.GameObject.position = [-6000, 0, 0];
  view.feet = [-6000, 0, 0];
  run(host, 1);
  assert.deepEqual(log.spent, [RAIDER.id], 'given the slip: spent');
  assert.equal(e.raider.spent, true);
  assert.equal(e.ship.sight, 0, 'she looks for no one');
  assert.ok(e.ship.course[0] > e.ship.pos[0] + RAIDER_SHEER_M * 0.9, 'she sheers off, away from me');
  run(host, 5);
  assert.equal(e.ship.mode, 'cruise');
  assert.deepEqual(log.spent, [RAIDER.id], 'said once');
  // the world host marks her spent; the next refresh never stands her again, and lets her go out of sight
  host.raiders([RAIDER], { sight: RAIDER_SIGHT_M, spent: new Set([RAIDER.id]) });
  run(host, SHIP_FADE_S + 0.5);   // SHIP-FADE (2026-10-02) PIN MOVED: she fades as she goes
  assert.equal(raiderShips(host).length, 0, 'out of sight, gone - and not stood again');
  // another: sunk
  const other = { ...RAIDER, id: 'r17.16.100', seed: 0x51f00e, pos: [-6000 + 600, 0, 0], ahead: [-6000 + 600, 0, 200] };
  host.raiders([other], { sight: RAIDER_SIGHT_M, spent: new Set() });
  const [s] = raiderShips(host);
  s.ship.damage.apply({ hull: s.ship.damage.maxHull * 2, sail: 0, crew: 0 }, 1);
  run(host, 0.2);
  assert.notEqual(s.ship.damage.state, SHIP_STATES.afloat);
  assert.deepEqual(log.spent, [RAIDER.id, other.id], 'going down: spent');
});

test('NAV-R the director stands a raider outside its despawns (the raider\'s own plan lets it go) but counts it in the density; one copy between two players - a peer\'s copy of the seed with the lower id keeps her, and mine goes (mutants: the director despawning her, the peer\'s copy unread)', async () => {
  const { host, view, boat } = await harness({ settings: { ShipsAtSea: 'few' } });
  host.raiders([RAIDER], { sight: RAIDER_SIGHT_NIGHT_M, spent: new Set() });
  // I sail far from her: the director would despawn a ship of its own this far out
  boat.GameObject.position = [-3000, 0, 0];
  view.feet = [-3000, 0, 0];
  run(host, 3);
  assert.equal(raiderShips(host).length, 1, 'the director never takes her');
  host.raiders([{ ...RAIDER, pos: raiderShips(host)[0].ship.pos }], { sight: RAIDER_SIGHT_NIGHT_M, spent: new Set() });
  assert.equal(raiderShips(host)[0]?.retiring, true, 'her own plan lets her go past RAIDER_DROP_M (SHIP-FADE: fading)');   // SHIP-FADE PIN MOVED
  run(host, SHIP_FADE_S + 0.5);
  assert.equal(raiderShips(host).length, 0, 'and gone');
  // online: a peer with the lower id already stands her seed
  const peerPlay = await harness({ settings: { ShipsAtSea: 'off' }, online: { id: () => 'm-me', peers: () => [{ id: 'a-peer', feet: [0, 0, 0] }], sendHit: () => true } });
  const rec = navalWireRecord({ ships: [{ n: 4, classId: raiderClassOf(RAIDER.seed, 5).id, variant: 0, pos: [900, 0, 0], yaw: 0, speed: 0, sails: 1, hull: 1, sail: 1, crew: 1, state: 'afloat', heel: 0, seed: RAIDER.seed, fire: false }], volleys: [], barrels: [] }, (p) => p);
  assert.equal(peerPlay.host.applyWord('a-peer', rec), true);
  peerPlay.host.raiders([RAIDER], { sight: RAIDER_SIGHT_M, spent: new Set() });
  assert.equal(raiderShips(peerPlay.host).length, 0, 'the lower id\'s copy is the one the room sees');
  assert.deepEqual(peerPlay.host.raiderShipOf(RAIDER.seed)?.pos, [900, 0, 0], 'the map finds the peer\'s copy');
});

// ── the world host ──────────────────────────────────────────────────────────────────────────────────────────────

test('NAV-R the world host: with the sea fight on the raiders are its ships - the Overworld\'s frame hands the naval host the raiders about the traveller each TV_RAID_LIST_MS, where each sails and where its course is RAIDER_LEAD_S on, with the lookout\'s reach tonight; ashore, none; the mod\'s carried-aboard raid and the old chase only with no sea fight; the map draws a raider where her ship sails; a spent ship marks the raider spent (mutants: the old chase run beside the ships, the course unsent, the marks at the seeded place, the spent word lost)', () => {
  const w = src('scenes/world.js');
  assert.match(w, /const navalRaidersOn = \(\) => navalOn\(\) && !!naval\?\.enabled && warmAshesOn\(\);/);
  const frame = w.slice(w.indexOf('  function raidFrame(dt) {'), w.indexOf('\n  }\n', w.indexOf('  function raidFrame(dt) {')));
  assert.match(frame, /if \(navalRaidersOn\(\)\) \{ tvRaid\.chase\.clear\(\); raidShips\(!!at\); return; \}\n\s+if \(!at\) \{/, 'the ships, before the old chase');
  const ships = w.slice(w.indexOf('  function raidShips(atSea) {'), w.indexOf('\n  }\n', w.indexOf('  function raidShips(atSea) {')));
  assert.match(ships, /if \(t - _raidShipsAt < TV_RAID_LIST_MS\) return;/);
  assert.match(ships, /if \(atSea\) \{/);
  assert.match(ships, /if \(tvRaid\.spent\.has\(r\.id\)\) continue;/);
  assert.match(ships, /const a = raiderAt\(r, ms \+ RAIDER_LEAD_S \* 1000, tvRaidSea\);/);
  assert.match(ships, /list\.push\(\{ id: r\.id, seed: r\.seed, pos: \[x, 0, z\], yaw: Math\.atan2\(ax - x, az - z\), ahead: \[ax, 0, az\] \}\);/);
  assert.match(ships, /naval\.raiders\(list, \{ sight: raiderSight\(isNight\(minuteNow\(\)\)\), spent: tvRaid\.spent, held \}\);/);
  assert.match(w, /const ship = navalRaidersOn\(\) \? naval\.raiderShipOf\(r\.seed\) : null;/);
  assert.match(w, /const at = ship \? state\.worldCoords\(ship\.pos\) : c \? c\.pos : \(seaRaidPeerChase\(r\.id\) \?\? r\);/);   // THE MERGE (OW6): else where a peer's chase says
  assert.match(w, /const chase = ship \? ship\.chase : !!c;/);
  assert.match(w, /raiderSpent: \(id\) => \{ seaRaidSpend\(id\); tvRaid\.chase\.delete\(id\); \},/);   // THE MERGE (OW6): spent through the Overworld's own spend - said and owed
});

// ── THE MERGE with main's OW6 (2026-09-29: the raiders' chase, shared) ──────────────────────────────────────────────

test('THE MERGE (OW6) the plan: a raider a peer\'s raider word holds - their Overworld chase, or their sea\'s ship - is never stood here, whoever\'s id is lower (OW6\'s "never a sail a peer\'s chase holds"); one already stood yields to a holder with the lower id - her life over or not, but (AUDIT NAV1, online) never from under a boarding - and keeps her from a higher; a copy in my sea is the claim rule\'s, the word the lower id\'s (mutants: the hold unread, the holder\'s id unread, the boarding let go of)', () => {
  const me = [0, 0, 0];
  const r = (id, seed, x) => ({ id, seed, pos: [x, 0, 0] });
  const empty = { me, myId: 'm', stood: new Map(), peers: new Map(), spent: new Set() };
  assert.deepEqual(raiderPlan({ ...empty, raiders: [r('a', 7, 300)] }).stand, ['a'], 'no word: as ever');
  assert.deepEqual(raiderPlan({ ...empty, raiders: [r('a', 7, 300)], held: new Map([['a', 'z-peer']]) }).stand, [], 'held by a peer - a higher id too: never mine to stand');
  assert.deepEqual(raiderPlan({ ...empty, raiders: [r('a', 7, 300), r('b', 8, 400)], held: new Map([['a', 'a-peer']]) }).stand, ['b'], 'the one nobody holds stands');
  const stood = new Map([['a', { pos: [300, 0, 0], engaged: true }]]);
  assert.deepEqual(raiderPlan({ ...empty, stood, raiders: [r('a', 7, 300)], held: new Map([['a', 'a-peer']]) }).drop, ['a'], 'both hold her: the lower id keeps her - mine goes, even mid-fight');
  assert.deepEqual(raiderPlan({ ...empty, stood, raiders: [], held: new Map([['a', 'a-peer']]) }).drop, ['a'], 'her life over (out of the list): the same');
  assert.deepEqual(raiderPlan({ ...empty, stood, raiders: [r('a', 7, 300)], held: new Map([['a', 'z-peer']]) }).drop, [], 'a higher id\'s hold yields to mine');
  assert.deepEqual(raiderPlan({ ...empty, stood, raiders: [r('a', 7, 300)], peers: new Map([[7, 'z-peer']]), held: new Map([['a', 'a-peer']]) }).drop, ['a'], 'a higher id\'s copy and a lower id\'s word: the lower id keeps her');
  const boarding = new Map([['a', { pos: [300, 0, 0], engaged: true, boarding: true }]]);
  assert.deepEqual(raiderPlan({ ...empty, stood: boarding, raiders: [r('a', 7, 300)], held: new Map([['a', 'a-peer']]) }).drop, [], 'never from under a boarding');
});

test('THE MERGE (OW6) the naval host: a raider a peer holds is not stood; the raiders it stands and has not spent are HELD (raiderHeld: her raider id and where she sails) - spent, held no more; a journey\'s threats are the hostile ships alone - by her lookout past the ring where a journey stops (HOSTILE_NEAR_M, NAV-H\'s enemy nearby) until she sights me, then that ring closing at her pace; none with the arc off (mutants: the hold unpassed to the plan, a spent one held, a friend a threat, the lookout unread, the chase unread)', async () => {
  const { host, view, boat } = await harness({ settings: { ShipsAtSea: 'off' } });
  host.raiders([RAIDER], { sight: RAIDER_SIGHT_M, spent: new Set(), held: new Map([[RAIDER.id, 'z-peer']]) });
  assert.equal(raiderShips(host).length, 0, 'a peer holds her: not stood here');
  assert.deepEqual(host.raiderHeld(), []);
  host.spawnShip('merchantCoaster', { range: 5000, bearing: Math.PI });   // far past any lookout: a trader, no one's threat
  host.raiders([RAIDER], { sight: RAIDER_SIGHT_M, spent: new Set() });
  const [e] = raiderShips(host);
  assert.deepEqual(host.raiderHeld(), [{ id: RAIDER.id, pos: e.ship.pos }], 'mine: held, where she sails');
  assert.ok(RAIDER_SIGHT_M > HOSTILE_NEAR_M);
  assert.deepEqual(host.threats(), [{ pos: e.ship.pos, reach: RAIDER_SIGHT_M, chasing: false, mps: e.ship.cls.speed }], 'the raider by her lookout; the trader none');
  run(host, 2);
  assert.equal(e.ship.mode, 'engage', 'she gives chase');
  assert.deepEqual(host.threats().map((t) => [t.reach, t.chasing]), [[HOSTILE_NEAR_M, true]], 'coming for me: the ring the journey stops at, closing');
  boat.GameObject.position = [-6000, 0, 0];
  view.feet = [-6000, 0, 0];
  run(host, 1);
  assert.equal(e.raider.spent, true, 'given the slip');
  assert.ok(raiderShips(host).length === 1, 'still on the water, sheering off');
  assert.deepEqual(host.raiderHeld(), [], 'spent: held no more - the word says her spent instead');
  assert.deepEqual(host.threats().map((t) => [t.reach, t.chasing]), [[HOSTILE_NEAR_M, false]], 'sheering off, her lookout shut: still a pirate within whose ring a journey stops');
  host.setEnabled(false);
  assert.deepEqual(host.threats(), [], 'the arc off: no sea');
});

test('THE MERGE (OW6) the world host, run: with the sea fight on my raider word says the ships my sea stands where they sail (the world\'s natives), and a ship sunk, taken or given the slip is spent through the Overworld\'s own spend - said to the cell\'s others and owed to its ledger; the raiders a peer\'s word holds reach the naval host; a journey slows for every hostile ship on either skin by the ring the naval host gives - a raider stood as a ship counted as the ship, never twice - and the map draws her where she sails; the sea fight off, the Overworld\'s own as ever (mutants: the ships unsaid, the spend unsaid, the hold unpassed, a raider ship counted twice, the sea unread by the journey, her closing unsaid, the marks at the seeded place)', () => {
  const w = src('scenes/world.js');
  const fn = (name) => { const m = new RegExp(`\\n  function ${name}\\([^)]*\\) \\{\\n[\\s\\S]*?\\n  \\}\\n`).exec(w); assert.ok(m, `${name} lifted`); return m[0]; };
  const spent = /\n    raiderSpent: (\(id\) => \{[^\n]*?\}),/.exec(w);
  assert.ok(spent, 'the naval host\'s raiderSpent lifted');
  const a = w.indexOf('    // AUDIT OW5b S8: none drawn where none can come'), b = w.indexOf('\n    return marks;', a);
  assert.ok(a > 0 && b > a, 'the raiders\' marks lifted');
  const d = {
    tvRaid: { chase: new Map(), spent: new Set(), spentAt: [], peer: new Map(), list: [], at: -Infinity, life: 5, clock: 0 },
    owed: [], owSaySpent: (id) => d.owed.push(id), RAIDERS_WIRE_MAX, RAIDER_WORD_MS, raiderWordOf,
    now: 1000, performance: { now: () => d.now },
    fight: true, navalRaidersOn: () => d.fight,
    held: [], handed: [], ships: new Map(),
    threats: [], naval: { raiderHeld: () => d.held, raiders: (list, o) => d.handed.push({ list, ...o }), raiderShipOf: (seed) => d.ships.get(seed) ?? null, threats: () => d.threats },
    state: { worldCoords: (p) => ({ x: p[0] + 100000, z: p[2] + 200000 }), localFromWorld: (x, z) => [x - 100000, z - 200000] },
    TV_RAID_LIST_MS: 500, raidNowMs: () => 0, list: [], travelViewRaiders: () => d.list, raiderAt: (r) => ({ x: r.x, z: r.z + 50 }), RAIDER_LEAD_S, tvRaidSea: () => true,
    raiderSight: (night) => (night ? RAIDER_SIGHT_NIGHT_M : RAIDER_SIGHT_M), isNight: () => false, minuteNow: () => 720,
    player: { feetAt: () => [0, 0, 0] }, getPref: () => false, playerEntity: {}, warmAshesOn: () => true, csaOn: () => true, raidQuarry: () => true,
    RAIDER_CONTACT_M, RAIDER_CHASE_MPS, exteriorFoes: { foes: [] }, foeHostile: () => false, SIGHT_RADIUS: 60,
    me: { x: 0, y: 0 }, marks: [], pixelOfNative: () => ({ x: 0, y: 0 }), tvSceneKept: (_h, x, z) => [x, 0, z], RAIDER_LABEL: 'Pirates',
    _wildStrangers: [],   // WILD3: out of the open zone no stranger slows a journey (wildStrangersFrame's list, empty off the zone)
  };
  d.state.terrainDistance = 3;
  const names = Object.keys(d);
  const h = new Function('d', `const { ${names.join(', ')} } = d;
    ${fn('seaRaidSpend')}\n${fn('seaRaidPeerChase')}\n${fn('seaRaidHeld')}\nlet _seaRaidWordKey = '';\n${fn('seaRaidWord')}\nlet _raidShipsAt = -Infinity;\n${fn('raidShips')}\n${fn('journeyThreats')}
    const raiderSpent = ${spent[1]};
    const drawRaiders = () => { ${w.slice(a, b)} };
    return { seaRaidWord, raiderSpent, raidShips, journeyThreats, drawRaiders };`)(d);
  // the ships my sea stands, said where they sail
  assert.equal(h.seaRaidWord(null, false), false, 'nothing held, nothing spent: nothing to say');
  d.held = [{ id: 'r1.1.5', pos: [10.4, 0, -20.6] }];
  assert.equal(h.seaRaidWord(null, false), true, 'a ship held asks for a frame - she moves');
  const f = {};
  h.seaRaidWord(f, false);
  assert.deepEqual(f.sr, [['r1.1.5', 100010, 199979, 1]], 'her place in the world\'s natives');
  // she is sunk: spent here, said, owed
  d.held = [];
  h.raiderSpent('r1.1.5');
  assert.ok(d.tvRaid.spent.has('r1.1.5'), 'spent for her life');
  assert.deepEqual(d.owed, ['r1.1.5'], 'owed to the cell\'s ledger (OW6L)');
  const g = {};
  h.seaRaidWord(g, false);
  assert.deepEqual(g.sr, [['r1.1.5', 0, 0, 2]], 'and said to the others');
  // the raiders a peer holds, handed to the naval host with the list
  d.list = [{ id: 'r1.1.5', seed: 8, x: 100100, z: 200000 }, { id: 'r2.2.5', seed: 9, x: 100300, z: 200000 }, { id: 'r3.3.5', seed: 10, x: 100600, z: 200000 }];
  d.tvRaid.peer.set('r3.3.5', { x: 1, z: 1, at: d.now, from: 'a-peer' });
  h.raidShips(true);
  assert.equal(d.handed.length, 1);
  assert.deepEqual(d.handed[0].list.map((r) => r.id), ['r2.2.5', 'r3.3.5'], 'the spent one never; the held one listed (her plan decides)');
  assert.deepEqual([...d.handed[0].held], [['r3.3.5', 'a-peer']], 'the peer\'s hold, with their id');
  // a journey: a raider stood as a ship is the sea's own threat - never her seeded sail beside it - and every hostile
  // ship by the ring the naval host gives, closing when she comes for me
  d.ships.set(9, { pos: [300, 0, 40], chase: true });
  d.ships.set(10, { pos: [600, 0, 0], chase: false });
  d.threats = [{ pos: [300, 0, 40], reach: HOSTILE_NEAR_M, chasing: true, mps: 7.6 }, { pos: [600, 0, 0], reach: RAIDER_SIGHT_M, chasing: false, mps: 4.6 }, { pos: [-900, 0, 50], reach: 750, chasing: false, mps: 8 }];
  assert.deepEqual(h.journeyThreats(true), [{ dx: 300, dz: 40, reach: HOSTILE_NEAR_M, chasing: true, mps: 7.6 }, { dx: 600, dz: 0, reach: RAIDER_SIGHT_M }, { dx: -900, dz: 50, reach: 750 }]);
  assert.deepEqual(h.journeyThreats(false), h.journeyThreats(true), 'the sea\'s ships on either skin');
  // the map: each where her ship sails - the one coming for me held at the edge; the spent one, shipless, never
  h.drawRaiders();
  assert.deepEqual(d.marks.map((m) => [m.key, m.at, m.kind, m.edge]), [['raid:r2.2.5', [100300, 0, 200040], 'raider ship chase', true], ['raid:r3.3.5', [100600, 0, 200000], 'raider ship', false]]);
  // the sea fight off: the Overworld's own - my chases said, the seeded sails and a peer's chase where they say
  d.fight = false;
  d.tvRaid.chase.set('r2.2.5', { pos: { x: 100250.2, z: 200000 } });
  const k = {};
  h.seaRaidWord(k, true);
  assert.deepEqual(k.sr, [['r2.2.5', 100250, 200000, 1], ['r1.1.5', 0, 0, 2]]);
  d.tvRaid.chase.clear();
  d.threats = [];   // the arc off: no sea (navalHost.js threats)
  assert.deepEqual(h.journeyThreats(true), [{ dx: 300, dz: 0, reach: RAIDER_SIGHT_M }, { dx: 1 - 100000, dz: 1 - 200000, reach: RAIDER_SIGHT_M }]);
});
