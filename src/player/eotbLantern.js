// HT-WAIST-BACK (2026-09-24, Mac, looking at screenshots of the lantern hung at the sprite's right hip - seen from
// the front, the side, walking and behind: "Just have it show on the back of the sprite, not all angles. Make sure
// all the eye of the Beholder sprites get this change"): THE LANTERN ON AN EYE OF THE BEHOLDER SPRITE, ONE HOME.
//
// HT-WAIST hung Daggerfall's lantern picture from the local sprite's right hip (player/eotbBody.js). DISC23-B draws
// the other players on foot as the EOTB set they chose (net/peerRiders.js createPeerWalkers), and HT-WAIST-NET put
// the lantern on their pose (`hl`). Two kinds of sprite hang the same lantern, so everything they share is stated
// here, once, and both call it - a second copy is how the player's own sprite and everyone else's would come to
// show it differently:
//
//   THE REAR-VIEW RULE (`isRearView`). The picture is drawn only while the viewer sees the sprite's BACK. EOTB's
//   wheel (player/eotbBillboard.js RECORD_OFFSETS, [0, 1, 2, 3, 4, 3, 2, 1]; orientationFor's 0 is the camera in
//   front, 4 the camera behind) draws five records from front to back, and the vendored art says which of them is
//   a back: record +0 is the face, +1 the front three-quarter, +2 the profile, +3 the back three-quarter (the
//   shoulder blades, the seat, the heels) and +4 the back - read off archives 112364 (idle 0-4, walk 5-9, armed
//   walk 20-24) and 112372 (idle 0-4), which every on-foot set shares by the wheel. So the rear views are those
//   whose record is +3 or more: orientation 4, straight behind, and the back diagonals 3 (record +3, mirrored) and
//   5 (record +3). The front, the front diagonals and the sides - 0, 1, 2, 6, 7 - draw no lantern. The rule reads
//   the view the sprite is DRAWN from this frame (the local body's painted orientation; a peer's viewOf), so the
//   lantern and the picture under it always agree.
//
//   THE ART (`loadLanternArt`, `createLanternArt`). The Lantern template's own world texture, from the player's
//   ARENA2, uploaded under its own key (`LANTERN_ART_KEY`). Each sprite layer keeps a store (the body its own, the
//   peers' one shared through createEotbArt, as their sprites are), and the renderer caches the texture under the
//   key - a second upload of it is a cache hit.
//
//   THE HANG (`hangSpriteLantern`). By its top from the sprite's right hip in the sprite's facing frame, a nudge
//   toward the eye, tilted in the view plane by the swing and shortened as it swings along the line of sight.
//
//   THE SWING'S DRIVE (`stepSpriteLantern`, `spriteStride`). systems/lanternSwing.js's law, one state per sprite,
//   fed that sprite's walk: its speed along its facing, its facing's turn, and its walk clip's phase.
//
//   THE BATCH (`mintSpriteLantern`, `dropSpriteLantern`). Minted the first time it is drawn, at its full height (the
//   renderer's cull sphere is the batch's own), again when the scale moves it, and freed by its owner's teardown.
//
// NOT HERE, on purpose: whether the lantern hangs at all (the local body's own gates - lit at the waist, third
// person, on foot, alive, in your own form; a peer's `hl` on a walker), and the LIGHT, which is the local player's
// alone (setPlayerWaistLightOverride, eotbBody.js). A peer's lantern is drawn and lights nothing: no peer's light,
// held or hung, lights the scene (a peer casts none - the light is the player torch's own; Handheld-Torches.md
// HT-WAIST-NET), and this adds none.
//
// Allocation-free once minted: every function writes into the state object it is handed, and takes numbers, not
// option bags, so the per-frame paths build nothing.

import { RECORD_OFFSETS, ORIENTATIONS } from './eotbBillboard.js';
import { createLanternSwing, stepLanternSwing, lanternSwingDown } from '../systems/lanternSwing.js';
import { LANTERN_TEMPLATE } from '../systems/playerTorch.js';
import { templateByIndex } from '../systems/itemTemplates.js';
import { wrapAngle } from '../world/mat4.js';   // ONCRASH1: the one angle wrap

/** The first record of EOTB's wheel that shows the sprite's back (+3 the back three-quarter, +4 the back). */
export const REAR_RECORD = 3;
/** HT-WAIST-BACK: is `orientation` a view of the sprite's back - 3, 4 or 5 on EOTB's wheel? Anything else, and
 *  anything that is not an orientation, is not. */
export function isRearView(orientation) {
  if (!Number.isInteger(orientation)) return false;
  return RECORD_OFFSETS[((orientation % ORIENTATIONS) + ORIENTATIONS) % ORIENTATIONS] >= REAR_RECORD;
}

/** The hook, off the sprite: a fraction of the quad's height above its base, the hip's side out along the
 *  facing's right (scaled with the sprite), and a nudge toward the eye so it never shares the body's depth. */
export const HIP_LANTERN_SPRITE = Object.freeze({ heightFraction: 0.5, side: 0.2, towardEye: 0.06, height: 0.3, minLength: 0.6 });
/** The renderer's key for the picture: its own, so no world flat of the same record is ever replaced by it. */
export const LANTERN_ART_KEY = 'htwaist-lantern';

/** The default art door: the Lantern template's world texture from the player's own ARENA2, palette-mapped and
 *  its 0xFF mask cut out (ItemHelper's GetInventoryImage), in the world billboards' row order - the shape
 *  `renderer.uploadTexture` takes. Null when the data is not there; never throws. */
export async function loadLanternArt() {
  const t = templateByIndex(LANTERN_TEMPLATE);
  const archive = t?.worldTextureArchive, record = t?.worldTextureRecord;
  if (!Number.isInteger(archive) || !Number.isInteger(record)) return null;
  try {
    const [{ TextureFile, texName }, { DFPalette }, { changeMask }, { getBytes }] = await Promise.all([
      import('../formats/textureFile.js'), import('../formats/dfPalette.js'), import('../formats/baseImageFile.js'), import('../scenes/dataSource.js'),
    ]);
    const pal = new DFPalette();
    pal.load(await getBytes('ART_PAL.COL'), 'ART_PAL.COL');
    const file = new TextureFile();
    file.load(await getBytes(texName(archive)), texName(archive), pal);
    return file.getColor32(changeMask(file.getDFBitmap(record, 0)), 0);
  } catch (e) {
    console.warn('[eotb] the lantern picture is unavailable; the lantern at the waist lights without being drawn', e);
    return null;
  }
}

/**
 * One layer's store of the picture: `ensure()` answers `{ w, h }` once it is uploaded under LANTERN_ART_KEY, else
 * null - not asked yet (the ask starts it), in flight (asked once, never twice: ASYNC NEVER DROPS), or failed (no
 * data - not asked again). `getRenderer` is read at the ask and at the landing, so a layer whose renderer arrives
 * later asks then.
 * @param {() => any} getRenderer
 * @param {() => Promise<{width: number, height: number, colors: any}|null>} [load]
 */
export function createLanternArt(getRenderer, load = loadLanternArt) {
  let art;   // undefined: not asked; a Promise in flight; { w, h } uploaded; null: none
  return {
    ensure() {
      if (art !== undefined || !getRenderer()) return art && !(art instanceof Promise) ? art : null;
      const p = Promise.resolve().then(() => load()).then((img) => {
        const renderer = getRenderer();
        if (!img || !renderer) { art = null; return; }
        renderer.uploadTexture(LANTERN_ART_KEY, 0, { width: img.width, height: img.height, colors: img.colors });
        art = { w: img.width, h: img.height };
      }, () => { art = null; });
      art = p;
      return null;
    },
  };
}

const REST = Object.freeze(createLanternSwing());

/** One sprite's lantern: its swing, last frame's facing, its batch, and the scratch its placement is written to. */
export function createSpriteLantern() {
  return {
    swing: createLanternSwing(),
    yaw: null,                        // last frame's facing, for the turn's pull
    motion: { forward: 0, side: 0, yawRate: 0, stride: null },   // what stepLanternSwing is handed
    batch: null, batchH: 0,           // the billboard, and the full height it was minted at
    list: [],                         // [batch]: the one-element list drawBillboards takes, kept rather than built
    d: [0, 0, -1], hook: [0, 0, 0], right: [0, 0, 0], up: [0, 0, 0], origin: [0, 0, 0], mid: [0, 0, 0],
    w: 0, h: 0, fullH: 0,             // the quad as drawn this frame, and at full length
  };
}

/** Plumb and still, the turn forgotten - in place. */
export function restSpriteLantern(l) {
  Object.assign(l.swing, REST);
  l.yaw = null;
  return l;
}

/** The walk clip's phase (0..1) while a walk plays: the frame, plus how far the frame's clock has run. Null when
 *  the sprite is not walking - standing, a one-frame table, or no speed. */
export function spriteStride(moving, speed, frame, timer, tick, frames) {
  if (!moving || !(frames > 1) || !(speed > 0)) return null;
  return (frame + Math.min(1, tick > 0 ? timer / tick : 0)) / frames;
}

/**
 * One frame of the swing off the sprite's own walk: `speed` along its facing (`fx`, `fz` - the facing's unit
 * [x, z]), the facing's turn since last frame, and the walk clip's phase (`spriteStride`).
 */
export function stepSpriteLantern(l, dt, fx, fz, speed, stride) {
  const yaw = Math.atan2(fx, fz);
  const m = l.motion;
  m.yawRate = l.yaw != null && dt > 0 ? wrapAngle(yaw - l.yaw) / dt : 0;
  l.yaw = yaw;
  m.forward = speed || 0; m.side = 0; m.stride = stride;
  stepLanternSwing(l.swing, dt, m);
  return l;
}

/**
 * Where the lantern hangs this frame, written into `l`: the hook (up the sprite's quad from its `base` by its
 * height `spriteH`, out along the facing's right, a nudge from the `feet` toward the `eye`), the view plane's
 * right and up tilted by the swing (the camera's right is [cos camYaw, 0, -sin camYaw]), the quad's width and
 * drawn height (`art`'s proportions at `scale`, shortened as it swings along the line of sight), the origin that
 * keeps its top on the hook, and its middle.
 */
export function hangSpriteLantern(l, base, spriteH, fx, fz, eye, feet, camYaw, scale, art) {
  const L = HIP_LANTERN_SPRITE;
  const h = L.height * scale, w = h * art.w / art.h;
  const rx = fz, rz = -fx;   // right = [cos y, 0, -sin y] for forward [sin y, 0, cos y]
  const ex = eye[0] - feet[0], ez = eye[2] - feet[2];
  const el = Math.hypot(ex, ez) || 1;
  const side = L.side * scale;
  const hook = l.hook;
  hook[0] = base[0] + rx * side + ex / el * L.towardEye;
  hook[1] = base[1] + spriteH * L.heightFraction;
  hook[2] = base[2] + rz * side + ez / el * L.towardEye;
  // the swing, from the facing frame into the view plane: the tilt, and the shortening toward or away
  const d = lanternSwingDown(l.swing, l.d);
  const wx = rx * d[0] + fx * d[1], wy = d[2], wz = rz * d[0] + fz * d[1];
  const crx = Math.cos(camYaw), crz = -Math.sin(camYaw);
  const dx = wx * crx + wz * crz;
  const len = Math.hypot(dx, wy);
  const sin = len > 1e-6 ? dx / len : 0, cos = len > 1e-6 ? -wy / len : 1;
  const right = l.right, up = l.up;
  right[0] = crx * cos; right[1] = sin; right[2] = crz * cos;
  up[0] = -crx * sin; up[1] = cos; up[2] = -crz * sin;
  const drawnH = h * Math.max(L.minLength, Math.min(1, len));
  l.w = w; l.h = drawnH; l.fullH = h;
  l.origin[0] = hook[0] - up[0] * drawnH; l.origin[1] = hook[1] - up[1] * drawnH; l.origin[2] = hook[2] - up[2] * drawnH;
  l.mid[0] = hook[0] - up[0] * drawnH * 0.5; l.mid[1] = hook[1] - up[1] * drawnH * 0.5; l.mid[2] = hook[2] - up[2] * drawnH * 0.5;
  return l;
}

/** The batch, placed where `hangSpriteLantern` put it: minted at the full height the first time it is drawn, and
 *  again (the old one freed) when the scale moves that height. Answers the batch; `l.list` is `[batch]`. */
export function mintSpriteLantern(l, renderer) {
  if (l.batch && l.batchH !== l.fullH) dropSpriteLantern(l, renderer);
  if (!l.batch) {
    l.batch = renderer.createBillboardBatch(LANTERN_ART_KEY, 0, { w: l.w, h: l.fullH }, [[0, 0, 0]]);
    l.batch.origin = [0, 0, 0];
    l.batchH = l.fullH;
    l.list[0] = l.batch;
  }
  const b = l.batch;
  b.size.w = l.w; b.size.h = l.h;
  b.origin[0] = l.origin[0]; b.origin[1] = l.origin[1]; b.origin[2] = l.origin[2];
  return b;
}

/** EVERY ALLOCATION HAS AN OWNER: the batch freed; the picture stays in the renderer's cache under its key, as
 *  every EOTB sprite's does. Safe on a lantern never drawn. */
export function dropSpriteLantern(l, renderer) {
  if (!l?.batch) return;
  renderer?.destroyBillboardBatch?.(l.batch);
  l.batch = null;
  l.list.length = 0;
}
