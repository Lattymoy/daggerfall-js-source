// AUDIT NAV1 (2026-09-29) - the naval audit suites' one sea: createNavalHost over Come Sail Away's real pool (the
// vendored hulls, a stand-in renderer and pipeline - test/nav_h_host.test.js's), every other seam a recording stand-in.
// Its own module so the audit's suites (test/navaudit_*.test.js) stand the same sea.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createNavalHost } from '../src/scenes/navalHost.js';
import { createComeSailAwayPool } from '../src/scenes/comeSailAwayPool.js';
import { Boat } from '../src/systems/comeSailAwayBoat.js';

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
export const seeded = (seed = 1) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

let _pool = null;
export async function readyPool() {
  if (_pool) return _pool;
  _pool = await freshPool();
  return _pool;
}
/**
 * SHIPS-2 (2026-10-07): THE MOD'S OWN SHIPS FALLEN BACK - a pool whose new carrack's and new large boat's models do not
 * load, so hulls 4 and 1 are Come Sail Away's own Carrack and Large Boat, as the game stands them then
 * (systems/comeSailAwayModels.js) - the hulls the deck's and the boarding's laws were found on (the Carrack's cargo
 * doors, her forecastle's stair, her five doors). Its preload stands the builds with it (navalShips.js setShipStanding);
 * `restore()` stands the new ships' again. A pool of its own, never the shared one.
 */
export async function modShipsPool() {
  const { CARRACK_MODEL_URL, LARGE_BOAT_MODEL_URL } = await import('../src/systems/comeSailAwayModels.js');
  const { setShipStanding } = await import('../src/systems/naval/navalShips.js');
  const fetchFn = async (url) => (url === CARRACK_MODEL_URL || url === LARGE_BOAT_MODEL_URL ? { ok: false, status: 404 } : fileFetch(url));
  const pool = createComeSailAwayPool({ renderer: standInRenderer(), pipeline: standInPipeline(), fetchFn, log: { warn() {} } });
  assert.equal(await pool.preload(), true);
  return { pool, restore: () => { setShipStanding(4, true); setShipStanding(1, true); } };
}
/** A pool of its own - one client's, in a room of several (test/navalRoom.mjs). */
export async function freshPool() {
  const pool = createComeSailAwayPool({ renderer: standInRenderer(), pipeline: standInPipeline(), fetchFn: fileFetch, log: { warn() {} } });
  assert.equal(await pool.preload(), true);
  return pool;
}

/**
 * A sea: `hull` the player's boat at a helm (null: on foot), `water(x, z)` the land test, `wind`, `settings`, `level`,
 * `raidQuest(name)` the quest a raid starts (none: refused), `save` a save to restore first, `online` the room's seam
 * (none: offline), `pool` a client's own pool (freshPool; else the suites' shared one, emptied), `where` the waters'
 * fields over the harness's own, `peerBoats` the other players' boats at their helms (Come Sail Away's peers),
 * `harbourBook` the world's harbour book (systems/naval/harbourBook.js; none: the host's own).
 * Answers `{ host, pool, boat, runtime, view, log, deps, run(seconds, dt) }`.
 */
export async function sea(o = {}) {
  const pool = o.pool ?? await readyPool();
  if (!o.pool) pool.destroyAll();
  const log = { say: [], mid: [], sounds: [], foes: [], removed: [], placed: [], raids: [], ended: [], plunder: [], given: [], hits: [], shake: [], spent: [], helm: [], left: 0 };
  const boat = o.hull == null ? null : pool.spawnNow(Object.assign(new Boat(o.hull, 0), { uid: 42 }), { position: [0, 0, 0], rotation: [0, 0, 0, 1] });
  const runtime = boat ? {
    sailing: true, state: { CurrentBoat: boat, AllBoats: [boat], velocityCurrent: [0, 0, 0], windVectorCurrent: o.wind ?? [0.6, 0, 0.8], sailPosition: 0 },
    isSailing() { return this.sailing; }, StopSailing() { this.sailing = false; }, LowerSails() {},
  } : null;
  const view = { look: { origin: [0, 5, 0], dir: [1, -0.05, 0] }, feet: [0, 0, 0] };
  const deps = {
    pool, csa: () => runtime, seaY: () => 0, isWater: (x, z) => (o.water ? o.water(x, z) : true), feet: () => view.feet, look: () => view.look, level: () => o.level ?? 5,
    where: () => ({ px: 100, py: 100, region: 23, day: 1, nearPort: false, capitals: [{ region: 23, x: 100, y: 100 }], cityLights: false, night: false, ...o.where }),
    say: (t) => log.say.push(t), mid: (t) => log.mid.push(t),
    audio: { play3d: (k, p, v, opts) => log.sounds.push([k, opts]), loop3d: () => ({ move() {}, stop() {} }) },
    flame: () => ({ move() {}, retire() {} }),
    law: { crime() {}, legal() {}, faction() {} },
    board: {
      leaveHelm: () => { log.left++; if (runtime) runtime.sailing = false; },
      placePlayer: (p, y) => log.placed.push([p, y]),
      deckSpots: (_b, n) => Array.from({ length: n }, (_, i) => [[i, 5, 0], 0]),
      spawnFoe: (mobile, pos, yaw, side, opts) => { const h = { mobile, side, dead: false, pos, name: opts?.name ?? null, team: opts?.team ?? null, boat: opts?.boat ?? null }; log.foes.push(h); return h; },   // DECK-WALK: the crew's one team, the deck it stands on
      foeDown: (h) => h.dead, removeFoe: (h) => log.removed.push(h), standDown: (h) => { h.yielded = true; },
      takeHelm: (b) => { log.helm.push(b); if (runtime && b === boat) runtime.sailing = true; },
      startRaid: (name) => { log.raids.push(name); return o.raidQuest?.(name) ?? null; },
      endRaid: (quest, opts) => log.ended.push([quest, opts]),
      openPlunder: (m) => { log.plunder.push(m); return true; },
      giveItems: (items, b) => { log.given.push([items.length, b]); return { left: [] }; },
    },
    hold: (key, tier) => [{ name: `${key}@${tier}` }],
    online: o.online ?? null, setting: (k) => (o.settings ?? { ShipsAtSea: 'off' })[k], random: seeded(o.seed ?? 5), shake: (a) => log.shake.push(a),
    peerBoats: () => o.peerBoats?.() ?? [],
    sendHit: (d) => !!o.online?.sendHit?.(d),   // the world's hit retry queue, stood in for by the room's own door
    raiderSpent: (id) => log.spent.push(id),
    harbourBook: o.harbourBook ?? null,   // HARBOUR-BOOK: the world's book (none: the host keeps its own)
  };
  const host = createNavalHost(deps);
  if (o.save) host.restoreSaveData(o.save);
  const run = (seconds, dt = 0.1) => { for (let t = 0; t < seconds - 1e-9; t += dt) host.frame(dt); };
  return { host, pool, boat, runtime, view, log, deps, run };
}
