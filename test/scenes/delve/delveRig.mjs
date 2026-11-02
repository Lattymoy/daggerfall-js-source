// DELVE II: THE ROOM THE HOST'S PINS STAND A DUNGEON IN - one block, a 40 m room, the context's doors as fakes (the
// pedestal, the weight and the chest among its models), shared by test/scenes/delve/dlv4_host.test.js and dlv3_online.test.js.
import { createDelveHost } from '../../../src/scenes/delve/delveHost.js';
import { DELVE_PEDESTAL_MODEL, DELVE_WEIGHT_MODEL } from '../../../src/scenes/delve/delveProps.js';
import { DELVE_CHEST_MODEL } from '../../../src/scenes/delve/delvePieces.js';
import { siteKinds } from '../../../src/world/dungeon/delveSites.js';
import { DUNGEON_TYPES } from '../../../src/formats/mapsFile.js';
import { Collider } from '../../../src/player/collider.js';
import { RDB_SIDE } from '../../../src/world/rdbLayout.js';

/** Settled: the stands a frame asked for let land. */
export const flush = () => new Promise((r) => setImmediate(r));
/** One block, a 40 m room in it, and the context's doors as fakes - the pedestal and the weight among its models. */
export function dungeonOf(seed, dungeonType = DUNGEON_TYPES.Crypt, more = {}) {
  const c = new Collider(() => -Infinity);
  const v = [], idx = [], H = 20, cx = RDB_SIDE / 2, T = 4;
  const quad = (a, b, cc, d) => { const n = v.length / 3; v.push(...a, ...b, ...cc, ...d); idx.push(n, n + 1, n + 2, n, n + 2, n + 3); };
  const at = (x, y, z) => [cx + x, y, cx + z];
  quad(at(-H, 0, -H), at(-H, 0, H), at(H, 0, H), at(H, 0, -H));
  quad(at(-H, T, -H), at(H, T, -H), at(H, T, H), at(-H, T, H));
  quad(at(-H, 0, -H), at(H, 0, -H), at(H, T, -H), at(-H, T, -H)); quad(at(-H, 0, H), at(H, 0, H), at(H, T, H), at(-H, T, H));
  quad(at(-H, 0, -H), at(-H, 0, H), at(-H, T, H), at(-H, T, -H)); quad(at(H, 0, -H), at(H, 0, H), at(H, T, H), at(H, T, -H));
  c.addMesh('dungeon', v, idx, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const start = { record: 10, x: cx - 17, y: 0.5, z: cx - 17 };
  const blocks = [{ name: 'N0000001.RDB', originX: 0, originZ: 0, isStartingBlock: true, layout: { waterLevel: 10000, markers: [start], startMarkers: [start] } }];
  const stood = [], removed = [], pool = [], hud = [];
  let targets = null;
  const api = {
    collider: c, dynamicDraws: [], foes: pool, billboardBatches: [], flatAnims: { remove() {} },
    spawnLooseFoe: async (type, p, opts) => { const f = { type, at: p, opts, dead: false, ai: {}, entity: { maxHealth: 50, health: 50 } }; stood.push(f); pool.push(f); return f; },
    removeLooseFoe: (f) => { removed.push(f); f.dead = true; f._gone = true; const k = pool.indexOf(f); if (k >= 0) pool.splice(k, 1); return true; },
    hudSay: (t) => { hud.push(t); }, openLootList: () => true,
    addActivationTargets: (fn) => { targets = fn; return () => { targets = null; }; },
    addActivationNamer: () => () => {},
  };
  const location = { hasDungeon: true, mapTableData: { dungeonType, mapId: 7 }, dungeon: { recordElement: { header: { locationId: seed } } } };
  const me = { level: 6, items: [], goldPieces: 0, stats: { strength: 50 }, health: 100, maxHealth: 100 };
  const box = { positions: [-0.4, 0, -0.4, 0.4, 0.8, 0.4], indices: [0, 1, 0] };
  const deps = { getGpuMesh: async () => ({ gpu: 1 }), cpuModels: new Map([[DELVE_CHEST_MODEL, box], [DELVE_PEDESTAL_MODEL, box], [DELVE_WEIGHT_MODEL, box]]) };
  const host = createDelveHost({ api, deps, location, blocks, player: () => me, rollPile: () => [{ name: 'Silver Mace', group: 'Weapons', templateIndex: 121 }], ...more });
  return { host, api, me, stood, removed, pool, hud, collider: c, get targets() { return targets; } };
}
export const seedFor = (kind) => { for (let s = 1; s < 2000; s++) if (siteKinds(1, s)[0] === kind) return s; return -1; };
/** Frames of `ms` at `feet` (100 ms each), the stands let land. */
export async function run(D, ms, feet, yaw = 0, pw = null) { for (let k = 0; k < ms; k += 100) D.host.frame(0.1, feet, yaw, pw); await flush(); }
