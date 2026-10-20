// @ts-check
// OW-DUNGEONS (2026-10-08, Mac: "with dungeons on the overworld it doesnt show a dungeon model"; asked where: "Overworld
// view"; which: "Check it all"; asked the look: "Its own model, enlarged"; bible/06-Systems/Travel-View.md OW-DUNGEONS):
// EACH DUNGEON'S OWN MODEL, ENLARGED, UNDER THE OVERWORLD. A dungeon's exterior is a block or four of Daggerfall's -
// most often one small ruin, crypt or tower - and from the view's eye, about 450 m up, its entrance is a speck; past
// the streamed grid nothing stands at all, only TV6's plate or its "?". Now the dungeons about the traveller each stand
// as their own entrance model - the model of their exterior's blocks that carries DFU's dungeon-entrance door - where
// it stands, grown to one height in the world (OW-DUNGEON-SIZE: it grew with the eye's distance until 2026-10-19): a
// Mount & Blade map's icons.
//
// The law here is pure: which dungeons, which model, how much it grows and the matrix it is drawn by. The host's half
// (scenes/travelViewDungeonModels.js, moved out of scenes/world.js - HOST-SPLIT) lays each one's blocks, loads its model in
// its climate, finds its ground and draws.
// Not a DFU member: DFU has no raised travel camera (Travel-View.md "Enhanced lane only").
import { multiply, trs } from '../../world/mat4.js';
import { subMeshDoorType, DOOR_TYPE } from '../../world/meshReader.js';

/** How many dungeons stand as models at once - the nearest, as TV6 marks twelve. */
export const TV_DUNGEON_MODELS_MAX = 12;
/** OW-DUNGEON-SIZE (2026-10-19, the owner: "shrink dungeons slightly, and ensure their size doesnt grow or shrink based
 *  on distance"): THE HEIGHT EVERY DUNGEON'S MODEL STANDS AT, metres - one size in the world, as the land is. It was
 *  TV_DUNGEON_ICON_K (0.09) of the eye's distance, so a dungeon stood the same size on the screen at every zoom and grew
 *  as the eye drew back from it: about 30 m at the view's default (260 m up at 52 degrees, 330 m from the traveller -
 *  player/travelCamera.js), 51 m at its top (450 m up at the default tilt; AUDIT OW-REVISITED L5-9). Four fifths of that
 *  default: a dungeon stands slightly smaller there, and from then on reads nearer as the view zooms in and farther as it
 *  draws back, as everything round it does. The one exception is the cap below (AUDIT OW-REVISITED L5-8): a door model
 *  under 2 m tall - every keep's (model 43600, 0.58 m: 123 of the game's 4,238 dungeons) - stops at twelve times itself,
 *  short of the 24 m; the grown size never varies with the eye either way. */
export const TV_DUNGEON_ICON_M = 24;
/** Never more than OW-BIG's twelve times its own size (player/travelCamera.js TV_OWN_GROW_MAX). */
export const TV_DUNGEON_GROW_MAX = 12;

/**
 * THE SET - the dungeons about the traveller that stand as models: nearest first, at most `max`. `list` is TV6's own
 * law's (travelDungeons.js nearDungeons, uncapped, with no dungeon left to TV2's grid - a found one there is a speck from
 * the eye too), each `{ key, d, ... }`; ties go by key, so one list is one set.
 * @template {{ key: string, d: number }} T
 * @param {Iterable<T>} list
 * @param {number} [max]
 * @returns {T[]}
 */
export function dungeonModelSet(list, max = TV_DUNGEON_MODELS_MAX) {
  return [...(list ?? [])].sort((a, b) => a.d - b.d || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)).slice(0, Math.max(0, max));
}

/** TV-BURST (FIELD BUGS 2026-10-09, Shabalako: "The first time I open the overworld travel the game has a big freeze"):
 *  how many dungeons' models START loading in one frame. A load lays its location's blocks and reads their ARCH3D meshes
 *  on the frame it starts, then builds its model and uploads its pictures and its climate's - and the view's first frame
 *  started all twelve at once, inside its draw. */
export const TV_DUNGEON_LOADS_PER_FRAME = 1;

/**
 * TV-BURST: THE LOADS THIS FRAME STARTS - the nearest of the set (`list`, dungeonModelSet's, nearest first) that `held`
 * (the host's loads by key: a Map, or anything with `has`) does not hold yet, handed to `start` one by one, at most
 * `max`; none while the view is not fully up (`up` false - rising, when the land is first drawn, or coming down). The
 * set itself is untouched: what is held is drawn and what left it is let go, every frame. Answers how many it started.
 * @template {{ key: string }} T
 * @param {Iterable<T>} list
 * @param {{ has: (key: string) => boolean }} held
 * @param {boolean} up
 * @param {(g: T) => void} start
 * @param {number} [max]
 */
export function startDungeonLoads(list, held, up, start, max = TV_DUNGEON_LOADS_PER_FRAME) {
  if (!up) return 0;
  let n = 0;
  for (const g of list ?? []) {
    if (n >= max) break;
    if (held.has(g.key)) continue;
    start(g);
    n++;
  }
  return n;
}

/**
 * Whether an ARCH3D mesh (Arch3dFile.getMesh) carries a dungeon entrance - DFU's own door law (world/meshReader.js
 * subMeshDoorType: archive 56, or 331 past its stone record), on a submesh with a plane to be the door.
 * @param {{ subMeshes?: Array<{ textureArchive: number, textureRecord: number, planes?: any[] }> } | null | undefined} dfMesh
 */
export function meshHasDungeonEntrance(dfMesh) {
  for (const sm of dfMesh?.subMeshes ?? []) {
    if (sm.planes?.length && subMeshDoorType(sm.textureArchive, sm.textureRecord) === DOOR_TYPE.DUNGEON_ENTRANCE) return true;
  }
  return false;
}

/**
 * THE MODEL - a location's dungeon-entrance model among its laid blocks (world/locationLayout.js layoutLocation's
 * `blocks`): the first placed model, in the blocks' order and each block's own, whose mesh carries a dungeon entrance;
 * with none, the one of the most triangles (the exterior's main structure). Its matrix is the pixel build's own
 * (scenes/world.js buildPixelNow: the location's tile origin `locX`/`locZ`, the block's origin, the model's own) with
 * the location's level at 0. `meshOf(id)` answers the model's ARCH3D mesh, or null where the player's ARCH3D carries
 * none; an enhanced-only model (WM2f's mill companion) stands only on the enhanced skin, as the build has it.
 * @param {Array<{ originX: number, originZ: number, layout?: { models?: Array<{ modelIdNum: number, matrix: Float32Array|number[], enhancedOnly?: boolean }> } }>} blocks
 * @param {number} locX
 * @param {number} locZ
 * @param {(id: number) => ({ subMeshes?: any[], totalTriangles?: number } | null | undefined)} meshOf
 * @param {boolean} [enhanced]
 * @returns {{ modelIdNum: number, local: Float32Array, entrance: boolean } | null}
 */
export function dungeonEntranceModel(blocks, locX, locZ, meshOf, enhanced = true) {
  let best = null, most = -1;
  for (const b of blocks ?? []) {
    for (const placed of b.layout?.models ?? []) {
      if (placed.enhancedOnly && !enhanced) continue;
      const mesh = meshOf(placed.modelIdNum);
      if (!mesh) continue;
      const entrance = meshHasDungeonEntrance(mesh);
      const tris = mesh.totalTriangles ?? 0;
      if (!entrance && tris <= most) continue;
      const local = multiply(trs(locX + b.originX, 0, locZ + b.originZ, 0, 0, 0), placed.matrix);
      if (entrance) return { modelIdNum: placed.modelIdNum, local, entrance: true };
      most = tris;
      best = { modelIdNum: placed.modelIdNum, local, entrance: false };
    }
  }
  return best;
}

/**
 * HOW MUCH IT GROWS - the times its own size a dungeon's model of its own height `h` metres is drawn: to
 * TV_DUNGEON_ICON_M tall, never smaller than itself and never past TV_DUNGEON_GROW_MAX - the same at every distance
 * from the eye (OW-DUNGEON-SIZE). `blend` is the view's own (scenes/travelView.js frame `blend`: 0 the head, 1 the sky):
 * the model grows from the world's own as the view rises and shrinks back to it as the view comes down to play, so it
 * never stands grown over a traveller on the ground. Smooth, unlike OW-BIG's whole steps - a mesh drawn by a matrix
 * makes no batch again.
 * @param {number} h
 * @param {number} [blend]
 */
export function owDungeonGrow(h, blend = 1) {
  if (!(h > 0)) return 1;   // NaN, none or below: itself (Infinity grows to the floor of itself below)
  const b = Number.isFinite(blend) ? Math.max(0, Math.min(1, blend)) : 1;
  const full = Math.max(1, Math.min(TV_DUNGEON_GROW_MAX, TV_DUNGEON_ICON_M / h));
  return 1 + (full - 1) * b;
}

/**
 * THE MATRIX it is drawn by - `local` grown `g` times about its foot: the middle of its box (`box`, pixel-local
 * [minX, minY, minZ, maxX, maxY, maxZ] under `local`) on the location's level, which stands on `at` (the scene point of
 * that foot - over the built ground the real model's own level, past it the far ring's). So its base stays where the
 * real one stands, and the real one stands inside it: T(at) S(g) T(-foot) local, written into `out` with nothing made -
 * `local` is a placement (affine, its last row 0 0 0 1), so the product is its turn grown and its offset from the foot
 * grown (a frame's draw makes no garbage, PERF's law).
 * @param {Float32Array|number[]} local
 * @param {number[]} box
 * @param {number[]} at
 * @param {number} g
 * @param {Float32Array} [out]
 */
export function grownModelMatrix(local, box, at, g, out = new Float32Array(16)) {
  const fx = (box[0] + box[3]) / 2, fz = (box[2] + box[5]) / 2;
  for (let c = 0; c < 3; c++) {
    out[4 * c] = g * local[4 * c]; out[4 * c + 1] = g * local[4 * c + 1]; out[4 * c + 2] = g * local[4 * c + 2]; out[4 * c + 3] = 0;
  }
  out[12] = g * (local[12] - fx) + at[0];
  out[13] = g * local[13] + at[1];
  out[14] = g * (local[14] - fz) + at[2];
  out[15] = 1;
  return out;
}

/** A model grown no more than this over a BUILT pixel is the world's own drawn twice - left to it: the view rising or
 *  falling near the ground, where the two would fight for the same surfaces. Past the grid nothing stands under it. */
export const TV_DUNGEON_GROWN_MIN = 1.05;
/** Whether a dungeon's model is drawn at grow `g` - always past the built grid, over it only once grown past the world's. */
export const owDungeonDrawn = (g, built) => !built || g > TV_DUNGEON_GROWN_MIN;

/** The foot of a model's box - the middle of its plan, pixel-local, on the location's level (0). */
export const modelFoot = (box) => [(box[0] + box[3]) / 2, 0, (box[2] + box[5]) / 2];
