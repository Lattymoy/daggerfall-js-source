// GATHER-FEEL's rig, shared (GATHER-FEEL II, 2026-10-13): the gathering host (scenes/gatherHost.js) over the real kinds -
// one flat Woodlands pixel's veins, patches and trees, a real book whose door's harvest answers when released, and an ear
// with the sounds on over a bus of its own. test/systems/gatherfeel.test.js (GATHER-FEEL) and the GATHER-FEEL II pins
// (test/gf2_*.test.js) drive the one host through it. The doors a pin hands it - `feel` (BLOW-SHAKE's), `renderer`
// (VEIN-CRACKS' batches) - are the host's own deps; left out, the host is what GATHER-FEEL pinned.
import assert from 'node:assert/strict';
import { GATHER_SFX, createGatherEar } from '../src/systems/gatherSounds.js';
import { MINE_ACT } from '../src/net/professionLaw.js';
import { MELEE_HIT_SHARE } from '../src/characters/weaponStates.js';
import { treeKind } from '../src/scenes/treeHost.js';
import { mineKind } from '../src/scenes/mineHost.js';
import { herbKind } from '../src/scenes/herbHost.js';
import { createGatherHost, aimAt } from '../src/scenes/gatherHost.js';
import { createProfBook } from '../src/net/profBook.js';
import { veins, trees, utcDayOfMs } from '../src/net/nodeLaw.js';
import { setForagingHost } from '../src/systems/foraging/foragingInstall.js';
import { FT } from '../src/systems/foraging/foragingLaw.js';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../src/world/terrain/terrainSampler.js';

/** A dice that answers its numbers in turn, round and round. */
export const dice = (...seq) => { let i = 0; return () => seq[i++ % seq.length]; };
/** A bus that keeps what it was asked to play. */
export function bus() {
  const shots = [];
  return {
    shots,
    playOneShot(key, volume, pitch) { shots.push({ key, volume, pitch, at: null, ref: null }); return 0.2; },
    play3d(key, at, volume, o) { shots.push({ key, volume, pitch: o?.pitch, at: [...at], ref: o?.refDistance ?? null }); return 0.2; },
  };
}
/** The sound a clip's key is one of. */
export const sfxOf = (key) => Object.keys(GATHER_SFX).find((k) => GATHER_SFX[k].includes(key));

export const tick = () => new Promise((r) => setImmediate(r));
export const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
export const WOODS = 231, GLENUMBRA = 59, PX = 405;
export const NOON = 20500 * 86_400 + 43_200;
export const OUTDOORS = { inside: false, insideDungeon: false, insideCastle: false, locationType: 0xffff, inLocationRect: false, hour: 12, climate: WOODS, region: GLENUMBRA, enemiesNear: false, carriedWeight: 0, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' };

/** The renderer GATHER-FEEL stood its flats on: a batch is its archive, record and centres - and GATHER-FEEL II's chunks
 *  (VEIN-CRACKS) a dynamic one, its size kept. */
export const plainRenderer = () => ({ createBillboardBatch: (a, r, size, centers, o) => ({ archive: a, record: r, centers, size, dynamic: !!o?.dynamic }), destroyBatch: () => {}, moveBillboardBatch: () => true });

/** A host over one flat Woodlands pixel with its veins, patches and trees, its book a real one whose door's harvest
 *  answers when released, and an ear with the sounds on over a bus of its own.
 *  @param {{ answer?: ((b: any) => any)|null, feel?: any, renderer?: any, extra?: object, ranks?: Record<string, number> }} [o]
 *  `extra` - more of the host's own deps (a dungeon's `activeDungeon`, the chunks' `rand`); `ranks` - a profession's rank
 *  (its XP the rank's own, 10 n^2), 0 where none is named */
export async function rig({ answer = null, feel = undefined, renderer = plainRenderer(), extra = {}, ranks = {} } = {}) {
  setForagingHost({ world: () => OUTDOORS });
  const day = utcDayOfMs(NOON * 1000);
  const samples = new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.25), tilemap = new Uint8Array(128 * 128).fill(2);
  const law = veins({ x: PX, y: 150, day, climate: WOODS, region: GLENUMBRA });
  const rocks = law.map((v) => [v.u * TERRAIN_SIZE - 2, 0, v.v * TERRAIN_SIZE + 4, v.u * TERRAIN_SIZE + 2, 6, v.v * TERRAIN_SIZE + 8]);
  const flats = trees({ x: PX, y: 150, day, climate: WOODS }).map((t, i) => ({ id: i, group: '504_12', i, x: t.u * TERRAIN_SIZE + 1, y: 0, z: t.v * TERRAIN_SIZE }));
  const forest = { base: 504, archive: 504, trees: flats, groups: new Map([['504_12', { batch: { archive: 504, record: 12 }, centers: flats.map((f) => [f.x, f.y, f.z]), size: { w: 4, h: 8 } }]]) };
  const entry = { px: PX, py: 150, samples, tilemap, locationRect: null, batches: [], rocks, forest };
  const gate = { answers: /** @type {any[]} */ ([]) };
  const door = {
    account: () => 'acct-1',
    state: async () => ({ ok: true, data: { day, character: 'c1', tracks: ['mining', 'logging', 'herbalism'].map((profession) => ({ profession, xp: 10 * (ranks[profession] ?? 0) ** 2, rank: ranks[profession] ?? 0, specs: { 50: null, 100: null } })), today: {}, taken: [], stores: [], caps: { stores: 5000 } } }),
    pixels: async (c, px) => ({ ok: true, data: { pixels: px.map(([x, y]) => ({ x, y, state: 'none' })), dungeons: [] } }),
    harvest: (b) => new Promise((res) => gate.answers.push((r) => res(r ?? answer?.(b) ?? { ok: true, data: { node: b.node, kind: b.kind, material: 'metal:iron', qty: 3, xp: 22, track: { profession: 'mining', xp: 22, rank: 0 }, today: 1 } }))),
  };
  const clock = { ms: NOON * 1000 };
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c1', now: () => clock.ms, sleep: () => Promise.resolve() });
  const said = [];
  const hud = { setPrompt: () => {}, setMeter: () => {}, toast: (t) => said.push(t), banner: (t) => said.push(`BANNER ${t}`), setChip: () => {}, frame: () => {}, dispose: () => {} };
  const built = new Map([[`${PX},150`, entry]]);
  const entity = { items: [{ templateIndex: FT.PickAxe, currentCondition: 50, maxCondition: 50 }, { templateIndex: FT.WoodAxe, currentCondition: 50, maxCondition: 50 }, { templateIndex: FT.Basket, currentCondition: 50, maxCondition: 50 }], stats: {} };
  const feet = [0, 0, 0], view = { yaw: 0, pitch: 0 };
  const input = { v: { held: false, attack: false, choice: false } };
  const audio = bus();
  const e = createGatherEar({ audio, on: () => true, rand: dice(0.5), install: false });
  const host = createGatherHost({
    book, hud, ear: e, kinds: [herbKind({ book }), mineKind({ book }), treeKind({ book, renderer, getTexture: async () => ({ recordCount: 999 }), billboardSize: () => ({ w: 1, h: 0.4 }), uploadRecord: () => {}, flatBatchAabb: () => [0, 0, 0, 1, 1, 1] })],
    renderer, getTexture: async () => ({ recordCount: 999 }), uploadRecord: () => {},
    billboardSize: () => ({ w: 0.3, h: 0.3 }), flatBatchAabb: () => [0, 0, 0, 0, 0, 0],
    built: () => built, pixelTranslation: (x, y, out) => { out[0] = 0; out[1] = 0; out[2] = 0; return out; },
    pixelInfo: () => ({ climate: WOODS, region: GLENUMBRA }), nowMs: () => clock.ms,
    eye: () => ({ pos: [feet[0], feet[1] + 1.6, feet[2]], dir: [Math.sin((view.yaw * Math.PI) / 180) * Math.cos((view.pitch * Math.PI) / 180), Math.sin((view.pitch * Math.PI) / 180), Math.cos((view.yaw * Math.PI) / 180) * Math.cos((view.pitch * Math.PI) / 180)] }),
    view: () => view, feet: () => feet, entity: () => entity, keyLabel: () => 'E', input: () => input.v, active: () => true,
    ...(feel !== undefined ? { feel } : {}),
    ...extra,
  });
  await book.refresh();
  host.onBuilt(entry);
  for (let i = 0; i < 4; i++) await tick();
  const face = (node) => {
    const [x, y, z] = node.local;
    feet[0] = x; feet[1] = y; feet[2] = z - 1.5;
    const at = aimAt([feet[0], feet[1] + 1.6, feet[2]], [x, y + (node.lift ?? 0.3), z], { yaw: 0, pitch: 0 });
    view.yaw = -at.yaw; view.pitch = -at.pitch;
  };
  /** The flats a node's pixel stands for its kind's pictures (a vein's, a patch's - a tree is the forest's own) - never a
   *  blow's chunks (VEIN-CRACKS: a dynamic batch on the pixel's list, no node's flats). */
  const centers = () => entry.batches.reduce((a, b) => a + (b.dynamic ? 0 : b.centers?.length ?? 0), 0);
  return { host, book, said, entry, gate, clock, input, audio, e, face, centers, entity, feet, view };
}
/** Arrive at a node: the host's first frames there, and the witnessed ground its first frame asks after answered (a
 *  pixel's ask answers long before a vein is worked out in play; in the rig it would land under the last blow). */
export async function arrive(t, node) {
  t.face(node);
  t.host.tick(0.016);
  for (let i = 0; i < 6; i++) await tick();
}
/** Strike a vein to its last strike - the press of each, no more: the act ends on the last press. */
export function strikeOut(t, node) {
  t.face(node);
  t.host.tick(0.016);
  assert.equal(t.host.press(), true);
  for (let i = 0; i < 12 && t.host.acting(); i++) {
    t.input.v = { held: false, attack: false, choice: false };
    t.host.tick(MINE_ACT.swingS + 0.01);
    t.input.v = { held: false, attack: true, choice: false };
    t.host.tick(0.001);
  }
  t.input.v = { held: false, attack: false, choice: false };
  assert.equal(t.host.acting(), false, 'the act ended on its last press');
}
/** A strike's blow lands this long after its press (MELEE_HIT_SHARE of the pick's swing). */
export const lands = MINE_ACT.swingS * MELEE_HIT_SHARE;
