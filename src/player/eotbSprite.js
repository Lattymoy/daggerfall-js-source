// EOTB5: THE SPRITE ON SCREEN - the loading, the sizing and the frame
// clock that turn EOTB3's table into a body the world can draw.
//
// The logic lives in `eotbBillboard.js` (which table, which record,
// which way round, how long a frame lasts). This file is the part that
// touches the renderer: the mod's own art, uploaded once per sprite
// and drawn as one billboard at the player's feet.
//
// ═══ WHY THE URLs ARE EAGER AND THE PIXELS ARE NOT ════════════════
//
// The bundle ships 3035 sprites. A non-eager glob would make each one
// its own module, which is 3035 chunks in the build; an eager glob of
// the IMAGES would decode all of them at boot. Neither is a thing to
// do to a browser.
//
// `{ eager: true, query: '?url' }` is the middle: Vite resolves every
// path to a URL STRING at build time - one object, no chunks - and
// emits the PNGs as plain assets that are fetched only when an `Image`
// asks for one. So the cost at boot is a map of strings, and the cost
// of a sprite is one HTTP fetch the first time the player faces that
// way.
//
// IN NODE the glob is not taken at all (the same door `dynamicSkies
// Assets.js` uses): `import.meta.glob` is a Vite macro, and the pins
// drive this module through its seams rather than through the bundle.

import {
  ORIENTATIONS, stateFor, tableArchive, spriteKey, frameTime, FOOTSTEP_FRAMES,
} from './eotbBillboard.js';

const IN_BROWSER = typeof window !== 'undefined';
const URLS = IN_BROWSER
  ? import.meta.glob('../../vendor/eye-of-the-beholder/Textures/*/*.png', { eager: true, query: '?url', import: 'default' })
  : {};

/** `<archive>_<record>-<frame>` -> the built asset's URL. */
const BY_KEY = Object.fromEntries(
  Object.entries(URLS).map(([p, u]) => [p.split('/').pop().replace(/\.png$/, ''), u]),
);
// NAMED `eotbSpriteUrl`, not `spriteUrl`: `systems/handheldTorches.js`
// already exports a `spriteUrl` and it answers a different question
// (which torch sprite, out of the mod's own sheet). audit24's
// duplicate-declaration ratchet caught the collision - ONE DFU
// MEMBER, ONE EXPORT - and these two are genuinely different things,
// so the answer is a distinct name rather than a shared home.
export const eotbSpriteUrl = (key) => BY_KEY[key] ?? null;
/** How many sprites the build actually carries - for the probes, and
 *  so "the art is wired" is a number rather than a hope. */
export const spriteCount = () => Object.keys(BY_KEY).length;

/**
 * `get_sizeMod`: METRES PER TEXTURE PIXEL. The mod keeps two, and the
 * larger one covers both the saddle and the werewolf - a rider is a
 * taller thing than a man and the transformed forms are drawn at the
 * same reach, which is why one constant serves both.
 */
export const SIZE_ON_FOOT = 0.019;
export const SIZE_RIDING_OR_TRANSFORMED = 0.029;
export const sizeMod = ({ riding = false, transformed = false, scale = 1 } = {}) =>
  (riding || transformed ? SIZE_RIDING_OR_TRANSFORMED : SIZE_ON_FOOT) * scale;

/** The billboard's world size for a sprite of these pixel dimensions. */
export function spriteSize(w, h, state) {
  const m = sizeMod(state);
  return { w: w * m, h: h * m };
}

/** `scaleOffset` - what every per-sprite offset in `spriteInfo.json`
 *  is multiplied by before it moves the billboard. */
export const scaleOffset = ({ scale = 1, scaleOffsetMod = 1 } = {}) => scale * scaleOffsetMod;

/**
 * THE FRAME CLOCK, advanced by the host's dt. Returns the frame to
 * draw and whether a FOOTFALL landed on this advance - the mod fires
 * its step sound on frames 2 and 4 of the five-frame walk and on no
 * others, so the sound follows the picture instead of a timer of its
 * own (`SyncFootsteps`).
 *
 * `frames` is the state's own count where it declares one (the two
 * bow-ready loops pin 3) and the sprite's natural length otherwise.
 */
export function advanceFrame(clock, dt, { frames, riding = false, walkAnimSpeedMod = 1 } = {}) {
  const n = Math.max(1, frames | 0);
  const step = frameTime(riding, walkAnimSpeedMod);
  let { frame = 0, timer = 0 } = clock ?? {};
  timer += dt;
  let footfall = false;
  // a `while`, not an `if`: a long frame (a stall, a tab coming back)
  // must not silently eat animation, and the loop is bounded by the
  // cycle length so a huge dt costs one pass and not a hang
  let guard = n + 1;
  while (timer >= step && guard-- > 0) {
    timer -= step;
    frame = (frame + 1) % n;
    if (FOOTSTEP_FRAMES.includes(frame)) footfall = true;
  }
  if (guard <= 0) timer = 0;
  return { frame, timer, footfall };
}

/**
 * The sprite one state wants this frame: the archive, the record, the
 * frame index, and whether it is drawn flipped.
 *
 * `mirror` is answered rather than applied because a flipped sprite is
 * a DIFFERENT upload - the renderer's billboard batch has no flip - so
 * the caller uploads the mirrored pixels under their own key. Making
 * that explicit here is what stops a later reader assuming the draw
 * handles it.
 */
export function spriteFor(table, orientation, frame, look = {}, { flip = false } = {}) {
  const st = stateFor(table, orientation);
  if (!st) return null;
  const archive = tableArchive(table, look);
  // AUDIT-EOTB2: `flip` is the Mirror attack string's whole-clip flip
  // (Graphics.AttackStrings), laid OVER the wheel's own mirror - a
  // flipped left-facing frame is the unflipped right-facing pixels, so
  // the two cancel, and the cache key follows the pixels, not the state
  const mirror = st.mirror !== !!flip;
  return {
    archive,
    record: st.record,
    frame,
    mirror,
    key: spriteKey(archive, st.record, frame),
    /** what the renderer caches it under - the mirrored copy is its
     *  own record, because it is its own pixels */
    rec: `${st.record}-${frame}${mirror ? 'm' : ''}`,
  };
}

/** Every sprite key one table needs at a given frame - what a
 *  pre-load would fetch, and what the probes count. */
export function tableKeys(table, frame, look = {}) {
  const out = [];
  for (let o = 0; o < ORIENTATIONS; o++) out.push(spriteFor(table, o, frame, look).key);
  return [...new Set(out)];
}

/**
 * Decode one sprite to the renderer's upload shape, flipping it when
 * the state asks. Browser-only - the pins drive `flipRow` and the
 * sizing directly, because a decode needs a canvas.
 */
export function flipRows(colors, w, h) {
  const out = new Uint32Array(colors.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) out[y * w + (w - 1 - x)] = colors[y * w + x];
  }
  return out;
}
