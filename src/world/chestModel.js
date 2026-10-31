// @ts-check
// CHEST3D (2026-10-31, the owner: "ensure any chests use this. Texture it with daggerfall textures"; bible/03-World/
// Chests.md): THE OWNER'S CHEST, baked by tools/bakeChest.mjs (a base, a lid, a hinge and a latch, shut and open), in
// Daggerfall's pictures - the classic chests' wood (TEXTURE.067), an iron hinge and a brass latch (TEXTURE.000's
// swatches) - each face laid on its picture where it stands, 40 texels a metre, the grain along the chest. Stood over
// ARCH3D's three chests on the model door (customModels.js), each inside its classic one's box, its latch to +z as
// Daggerfall's furniture faces. Not a DFU member. Ledger A (CHEST3D).
import CHEST from '../assets/chest/chest.json' with { type: 'json' };
import { registerCustomModel } from './customModels.js';
import { AURUM_COFFER_SIZE } from './aurumCofferArt.js';
import { GLOBAL_SCALE } from './meshReader.js';

/** ARCH3D's chests (the house containers' "Chest", systems/worldTooltips.js) - every one stands as this model. */
export const CHEST_MODELS = Object.freeze([41811, 41812, 41813]);
/** Each classic chest's box (metres, meshReader.js dfMeshToModel's frame - measured off ARCH3D.BSA, pinned there by
 *  test/world/chest_model.test.js): the new one stands on its floor, in its middle, inside it. */
export const CHEST_BOXES = Object.freeze({
  41811: Object.freeze({ min: Object.freeze([-0.325, -0.282, -0.325]), max: Object.freeze([0.325, 0.243, 0.325]) }),
  41812: Object.freeze({ min: Object.freeze([-0.325, -0.32, -0.333]), max: Object.freeze([0.325, 0.205, 0.342]) }),
  41813: Object.freeze({ min: Object.freeze([-0.308, -0.26, -0.309]), max: Object.freeze([0.308, 0.232, 0.306]) }),
});
/** Daggerfall's pictures, `[archive, record]`: each chest's wood as its classic one wears it (its body, its lid), and the
 *  swatches its iron and brass are. */
export const CHEST_LOOKS = Object.freeze({
  41811: Object.freeze({ body: Object.freeze([67, 0]), lid: Object.freeze([67, 0]) }),
  41812: Object.freeze({ body: Object.freeze([67, 0]), lid: Object.freeze([67, 1]) }),
  41813: Object.freeze({ body: Object.freeze([67, 0]), lid: Object.freeze([67, 3]) }),
});
export const CHEST_IRON = Object.freeze([0, 90]);
export const CHEST_BRASS = Object.freeze([0, 18]);
/** Daggerfall's density: a texel a classic unit, 40 a metre. The wood's records are 32 by 64 texels, the grain along
 *  the 64; a swatch is one colour, so its own size is moot. */
export const CHEST_TEXELS_M = 40;
const WOOD_PX = Object.freeze([32, 64]);

/** THE AURUM COFFER (scenes/aurumCacheHost.js): the chest in dark oak bound in gold - Daggerfall's darkest wood, its gold
 *  swatches for the hinge and the latch - in the box its picture stood in, on its foot. Shut, and emptied with its lid
 *  open: the port's own model ids. */
export const AURUM_COFFER_MODELS = Object.freeze({ shut: 864320, open: 864321 });
export const AURUM_COFFER_LOOK = Object.freeze({ body: Object.freeze([67, 3]), lid: Object.freeze([67, 3]), hinge: Object.freeze([0, 3]), latch: Object.freeze([0, 2]) });
const COFFER_HW = (AURUM_COFFER_SIZE.shut.w * GLOBAL_SCALE) / 2;
export const AURUM_COFFER_BOX = Object.freeze({ min: Object.freeze([-COFFER_HW, 0, -COFFER_HW]), max: Object.freeze([COFFER_HW, AURUM_COFFER_SIZE.shut.h * GLOBAL_SCALE, COFFER_HW]) });

/** DET's sea chest (world/detStandIns.js 45190): the box its stand-in filled, on its foot, in Daggerfall's darker wood. */
export const SEA_CHEST_BOX = Object.freeze({ min: Object.freeze([-0.46, 0, -0.27]), max: Object.freeze([0.46, 0.56, 0.27]) });
export const SEA_CHEST_LOOK = Object.freeze({ body: Object.freeze([67, 2]), lid: Object.freeze([67, 2]) });

/** Which picture each part wears, for a look - its own hinge and latch where it names them. */
const partPicture = (/** @type {string} */ part, /** @type {any} */ look) => (part === 'hinge' ? look.hinge ?? CHEST_IRON : part === 'latch' ? look.latch ?? CHEST_BRASS : part === 'lid' ? look.lid : look.body);

/** A face's place on its picture: the grain (the picture's v) along the chest's length (x), or along its depth (z) on
 *  an end; across it whichever axis the face leans least into. Pure. */
export function chestUv(/** @type {number[]} */ p, /** @type {number[]} */ n) {
  const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
  const k = CHEST_TEXELS_M;
  if (ax >= ay && ax >= az) return [(p[1] * k) / WOOD_PX[0], (p[2] * k) / WOOD_PX[1]];   // an end: the grain along z
  if (ay >= az) return [(p[2] * k) / WOOD_PX[0], (p[0] * k) / WOOD_PX[1]];                 // a top or a floor
  return [(p[1] * k) / WOOD_PX[0], (p[0] * k) / WOOD_PX[1]];                               // a front or a back
}

/** How much the bake is scaled to stand inside `box`: as large as its length, height and depth all fit. Pure. */
export function chestScale(/** @type {{ min: readonly number[], max: readonly number[] }} */ box) {
  const [x, y, z] = /** @type {number[]} */ (CHEST.size);
  return Math.min((box.max[0] - box.min[0]) / x, (box.max[1] - box.min[1]) / y, (box.max[2] - box.min[2]) / z);
}

/**
 * THE CHEST'S MODEL (renderer.createMesh's shape, and the collider's): the bake's parts, shut or `open`, scaled into
 * `box` and stood on its floor in its middle, each part on its picture. Pure.
 * @param {{ min: readonly number[], max: readonly number[] }} box
 * @param {{ body: readonly number[], lid: readonly number[], hinge?: readonly number[], latch?: readonly number[] }} look
 */
export function chestModel(box, look, open = false) {
  const s = chestScale(box);
  const at = [(box.min[0] + box.max[0]) / 2, box.min[1], (box.min[2] + box.max[2]) / 2];
  /** @type {Map<string, { pic: readonly number[], p: number[], n: number[], uv: number[] }>} */
  const groups = new Map();
  const parts = /** @type {any} */ (CHEST.parts), opened = /** @type {any} */ (CHEST.open);
  for (const part of ['base', 'lid', 'hinge', 'latch']) {
    const src = open && opened[part] ? opened[part] : parts[part];
    const pic = partPicture(part, look), key = pic.join(':');
    if (!groups.has(key)) groups.set(key, { pic, p: [], n: [], uv: [] });
    const g = /** @type {{ p: number[], n: number[], uv: number[] }} */ (groups.get(key));
    for (let t = 0; t < src.normals.length / 3; t++) {
      const n = [src.normals[t * 3], src.normals[t * 3 + 1], src.normals[t * 3 + 2]];
      for (let c = 0; c < 3; c++) {
        const o = t * 9 + c * 3, p = [src.positions[o] * s + at[0], src.positions[o + 1] * s + at[1], src.positions[o + 2] * s + at[2]];
        g.p.push(...p); g.n.push(...n); g.uv.push(...chestUv(p, n));
      }
    }
  }
  const count = [...groups.values()].reduce((m, g) => m + g.p.length / 3, 0);
  const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3), uvs = new Float32Array(count * 2);
  const indices = new Uint32Array(count);
  const subMeshes = [];
  let v = 0;
  for (const g of groups.values()) {
    const m = g.p.length / 3;
    positions.set(g.p, v * 3); normals.set(g.n, v * 3); uvs.set(g.uv, v * 2);
    for (let i = 0; i < m; i++) indices[v + i] = v + i;
    subMeshes.push({ textureArchive: g.pic[0], textureRecord: g.pic[1], startIndex: v, primitiveCount: m / 3 });
    v += m;
  }
  return { positions, normals, uvs, indices, subMeshes, doors: [] };
}

let _registered = false;
/** Once: the three classic chests and the coffer's two on the model door (scenes/dataPipeline.js asks it before ARCH3D). */
export function registerChestModels() {
  if (_registered) return;
  _registered = true;
  for (const id of CHEST_MODELS) {
    const box = CHEST_BOXES[/** @type {keyof typeof CHEST_BOXES} */ (id)], look = CHEST_LOOKS[/** @type {keyof typeof CHEST_LOOKS} */ (id)];
    registerCustomModel(id, () => chestModel(box, look), () => true, { climateFree: true });
  }
  registerCustomModel(AURUM_COFFER_MODELS.shut, () => chestModel(AURUM_COFFER_BOX, AURUM_COFFER_LOOK), () => true, { climateFree: true });
  registerCustomModel(AURUM_COFFER_MODELS.open, () => chestModel(AURUM_COFFER_BOX, AURUM_COFFER_LOOK, true), () => true, { climateFree: true });
}
