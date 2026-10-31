// @ts-check
// COMPANION-PORTAL (2026-10-02, Mac: "Companions when playing catch up, spawning in, or spawning out should use a unique
// portal animation instead of just popping in and out") - THE PORTAL. A swirling violet gate that tears open where a
// companion steps through, holds while it gathers out of the light (systems/dissolve.js, on its own sprite) or burns
// into it, and seals shut behind it.
//
//  - DRAWN BY THE PLACE'S OWN POOL (scenes/exteriorFoes.js - the street and a building - and scenes/dungeonContext.js):
//    each owns a set (createPortalSet) and hands its portals over with its foes' batches, so every host that draws the
//    pool's batches draws them - no host of its own.
//  - SELF-LIT: its frames are their own emission (a white-keyed emission map), so it glows the same at noon, at
//    midnight and underground, and it is drawn in the blended pass (`conceal` mode 3: plain opacity), behind the body
//    stepping through it - a short step back along the line from the eye.
//  - ITS ART IS MADE HERE, once per renderer: PORTAL_FRAMES frames of a vortex in the art's own chunky pixels, a hot
//    rim, spiral arms turning inward, a dark heart (`portalFrame`, pure - the tests read it).
//  - ITS LIFE: it opens (PORTAL_MS.open, a tear widening), holds, and closes (PORTAL_MS.close); a `short` one (the far
//    end of a catch-up's jump) holds less. A sound (the magic school's cast, the classic SPELL_CAST_SOUND's) as it opens.

import { portalSkinOf, dressPlace } from './portalSkins.js';   // STOREFRONT: a wearer's portal skin - its frames and what stands about it
import { playerDoor } from '../systems/playerDoor.js';   // STOREFRONT: a skin's bursts, through the running host's magic engine
import { ownEffects } from '../systems/ownGlyphs.js';   // STOREFRONT: my own portals wear my skin
import { effectWorn } from '../net/effectLaw.js';
import { playStorefrontSound } from '../systems/storefrontSounds.js';   // STOREFRONT: a skin's own sound

export const PORTAL_ARCHIVE = 'fxportal';
export const PORTAL_FRAMES = 12;
export const PORTAL_FPS = 14;
export const PORTAL_TEX = Object.freeze({ w: 48, h: 72 });
/** Its size at full open (metres): a person's height and more. */
export const PORTAL_SIZE = Object.freeze({ w: 1.6, h: 2.5 });
/** How long it opens, holds and closes (ms); a short one's hold. */
export const PORTAL_MS = Object.freeze({ open: 360, hold: 700, close: 420, shortHold: 260 });
/** How far behind the body (from the eye) it stands, so the body is seen in front of it. */
export const PORTAL_BACK = 0.35;
/** The magic school's cast (DAGGER.SND - systems/enemySpells.js SPELL_CAST_SOUND's last). */
export const PORTAL_SOUND = 349;
/** QUIET-COMPANIONS (FIELD BUGS 2026-10-04b): the least time between two portal sounds of one set (ms). The whole
 *  party arrives at every door, each through its own portal, and three casts rang over each other; now one rings,
 *  the portals all still open. */
export const PORTAL_SOUND_GAP_MS = 1500;

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const NONE = Object.freeze([]);   // no portal standing: the frame's batches() allocates nothing

/**
 * One frame of the vortex as RGBA rows from the BOTTOM up (a world billboard's color32 order, v = 0 its foot) -
 * pure, for the upload and the tests. `k` the frame, of `n`.
 * @returns {{ width: number, height: number, colors: Uint8ClampedArray }}
 */
export function portalFrame(k, n = PORTAL_FRAMES, w = PORTAL_TEX.w, h = PORTAL_TEX.h) {
  const out = new Uint8ClampedArray(w * h * 4);
  const phase = (k / n) * Math.PI * 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // the oval in -1..1, a touch taller than wide
      const u = ((x + 0.5) / w) * 2 - 1, v = ((y + 0.5) / h) * 2 - 1;
      const r = Math.hypot(u, v);
      const o = (y * w + x) * 4;
      if (r > 1) continue;   // outside: clear
      const a = Math.atan2(v, u);
      // spiral arms turning inward, and a hot rim
      const arms = 0.5 + 0.5 * Math.sin(a * 3 + r * 9 - phase * 2);
      const rim = clamp01((r - 0.78) / 0.14) * (1 - clamp01((r - 0.94) / 0.06));
      const core = clamp01(1 - r / 0.32);
      const swirl = clamp01(arms * (0.35 + 0.65 * r));
      // deep violet heart, bright lilac arms, a white-hot rim flickering with the turn
      const flick = 0.85 + 0.15 * Math.sin(a * 7 + phase * 3);
      let R = 40 + 120 * swirl + 215 * rim * flick;
      let G = 14 + 70 * swirl + 190 * rim * flick;
      let B = 80 + 150 * swirl + 175 * rim * flick;
      R *= 1 - 0.65 * core; G *= 1 - 0.75 * core; B *= 1 - 0.45 * core;
      out[o] = R; out[o + 1] = G; out[o + 2] = B;
      out[o + 3] = Math.round(255 * clamp01(0.55 + 0.45 * Math.max(swirl, rim) + 0.25 * core) * clamp01((1 - r) / 0.05));
    }
  }
  return { width: w, height: h, colors: out };
}

const _uploaded = new WeakSet();
/** STOREFRONT: the skins' frames, uploaded once a renderer a skin - its vortex and each piece that stands about it. */
const _skinsUp = new WeakMap();
export function ensureSkinArt(/** @type {any} */ renderer, /** @type {string} */ skin) {
  const look = portalSkinOf(skin);
  if (!look || !renderer || typeof renderer.uploadTexture !== 'function') return;
  let done = _skinsUp.get(renderer);
  if (!done) { done = new Set(); _skinsUp.set(renderer, done); }
  if (done.has(skin)) return;
  done.add(skin);
  const up = (/** @type {string} */ archive, /** @type {any} */ paint, /** @type {number} */ n, /** @type {{ w: number, h: number }} */ tex) => {
    for (let k = 0; k < n; k++) {
      const c32 = paint(k, n, tex.w, tex.h);
      renderer.uploadTexture(archive, String(k), c32);
      renderer.uploadEmissionTexture?.(archive, String(k), c32, { white: true });
    }
  };
  up(look.archive, look.paint, look.frames, look.tex);
  for (const d of look.dress) up(d.archive, d.paint, d.frames, d.tex);
}
/** STOREFRONT: the portal skin I wear now (net/effectLaw.js), or null - my companions' portals and my gate wear it. */
export const ownPortalSkin = () => effectWorn(ownEffects(), 'portal');
/** The frames, uploaded once per renderer - albedo and the same picture as its emission (self-lit). */
export function ensurePortalArt(renderer) {
  if (!renderer || _uploaded.has(renderer) || typeof renderer.uploadTexture !== 'function') return;
  _uploaded.add(renderer);
  for (let k = 0; k < PORTAL_FRAMES; k++) {
    const c32 = portalFrame(k);
    renderer.uploadTexture(PORTAL_ARCHIVE, String(k), c32);
    renderer.uploadEmissionTexture?.(PORTAL_ARCHIVE, String(k), c32, { white: true });
  }
}

/** How open a portal stands `t` ms into its life (0 shut .. 1 wide) - a tear widening with a little overshoot, held,
 *  sealing; and whether it is done. PORTAL1: `holdMs` a hold of its own (a Portal Stone's - scenes/portalGates.js).
 *  STOREFRONT: written into `out` where one is handed (a frame's tick allocates nothing). */
export function portalOpenAt(t, { short = false, holdMs = null } = {}, out = { open: 0, done: false }) {
  const hold = Number.isFinite(holdMs) ? Math.max(0, holdMs) : short ? PORTAL_MS.shortHold : PORTAL_MS.hold;
  const c = (t - PORTAL_MS.open - hold) / PORTAL_MS.close, x = t / PORTAL_MS.open;
  out.open = t < 0 ? 0 : t < PORTAL_MS.open ? Math.min(1.06, 1 - Math.pow(1 - x, 3) * (1 - 0.4 * x) + 0.06 * Math.sin(x * Math.PI))
    : t < PORTAL_MS.open + hold ? 1 : c >= 1 ? 0 : 1 - c * c;
  out.done = c >= 1;
  return out;
}
/** A portal's whole life (ms). */
export const portalLife = ({ short = false, holdMs = null } = {}) => PORTAL_MS.open + (Number.isFinite(holdMs) ? Math.max(0, holdMs) : short ? PORTAL_MS.shortHold : PORTAL_MS.hold) + PORTAL_MS.close;

/** STOREFRONT (AUDIT STOREFRONT RENDER L1): THE CAMERA'S LEVEL BASIS AT A PORTAL, into `out` - `right` across it as the
 *  billboards face (the view's own right, negated: dungeonContext's axis) and `back` away from the eye. Read off the
 *  frame's `view`, so no pool can forget to hand it: the gate's ticked with none and stood its cogs on world X. Before
 *  a frame, the line from `eye` to `mid`; with neither, world X. */
export function portalBasis(/** @type {ArrayLike<number>|null} */ view, /** @type {ArrayLike<number>|null} */ eye, /** @type {ArrayLike<number>} */ mid, /** @type {{ right: number[], back: number[] }} */ out) {
  let rx = 1, rz = 0;
  if (view) { rx = -view[0]; rz = -view[8]; }
  else if (eye) { rx = mid[2] - eye[2]; rz = eye[0] - mid[0]; }
  const L = Math.sqrt(rx * rx + rz * rz);   // never Math.hypot a frame: a call it does not inline boxes its numbers
  if (L > 1e-6) { rx /= L; rz /= L; } else { rx = 1; rz = 0; }
  out.right[0] = rx; out.right[1] = 0; out.right[2] = rz;
  out.back[0] = -rz; out.back[1] = 0; out.back[2] = rx;
  return out;
}

/**
 * A pool's portals. `now()` ms; `audio` its 3D voice (optional).
 * @param {{ renderer: any, audio?: any, now?: () => number }} deps
 */
export function createPortalSet({ renderer, audio = null, now = () => performance.now() }) {
  /** @type {{ at: number, feet: number[], short: boolean, holdMs: number | null, when: { short: boolean, holdMs: number | null }, life: number, fixed: boolean, batch: any, origin: number[], look?: any, dress?: any[], breath?: number }[]} */
  const list = [];
  let eye = null;
  let soundAt = -Infinity;   // QUIET-COMPANIONS: the set's last portal sound
  // STOREFRONT (AUDIT STOREFRONT RENDER L6): a frame's scratch - the basis, the middles, a piece's place, the batches
  const basis = { right: [1, 0, 0], back: [0, 0, 1] }, mid = [0, 0, 0], archMid = [0, 0, 0], placed = { at: [0, 0, 0], scale: 0, spin: 0 }, opened = { open: 0, done: false };
  /** @type {any[]} */
  const drawn = [];
  /** The eye the portals stand by: the pool's, else the frame's camera (a pool that hands none). */
  const eyeNow = () => eye ?? renderer?._camPos ?? null;
  /** PORTAL1: `holdMs` a hold of its own; `fixed` stands it where it opened (a gate in the world, not a body's back).
   *  STOREFRONT: `skin` the wearer's portal skin (scenes/portalSkins.js), null for the violet vortex. */
  function open(feet, { short = false, quiet = false, holdMs = null, fixed = false, skin = null } = {}) {
    if (!renderer?.createBillboardBatch || !feet) return null;
    ensurePortalArt(renderer);
    const look = portalSkinOf(skin);
    if (look) ensureSkinArt(renderer, /** @type {string} */ (skin));
    const at = [feet[0], feet[1] - 0.05, feet[2]];
    const size = { w: PORTAL_SIZE.w, h: PORTAL_SIZE.h };
    const batch = renderer.createBillboardBatch(look ? look.archive : PORTAL_ARCHIVE, '0', size, [[0, 0, 0]], { dynamic: true });
    batch.size = size;   // the set's own record, rewritten in place each frame (L6)
    batch.origin = [at[0], at[1], at[2]];
    batch.noShadow = true;
    batch.conceal = { mode: 3, alpha: 0, t: 0, phase: 0 };
    const when = { short, holdMs: Number.isFinite(holdMs) ? holdMs : null };
    const p = { at: now(), feet: at, short, holdMs: when.holdMs, when, life: portalLife(when), fixed, batch, origin: batch.origin, look, dress: look ? dressOf(look) : [], breath: 0 };
    list.push(p);
    if (look) { try { playerDoor()?.burst?.(look.open, [at[0], at[1] + 0.05, at[2]], { h: PORTAL_SIZE.h, w: PORTAL_SIZE.w, dir: facing(at) }); } catch { /* no burst here */ } }
    if (!quiet && look && p.at - soundAt >= PORTAL_SOUND_GAP_MS) { soundAt = p.at; playStorefrontSound(audio, look.sound, at, 0.9, { maxDistance: 24 }); }   // STOREFRONT: a skin's own
    if (!quiet && p.at - soundAt >= PORTAL_SOUND_GAP_MS) { soundAt = p.at; try { audio?.play3dId?.(PORTAL_SOUND, at, 0.9, { maxDistance: 24 }); } catch { /* silent */ } }   // a sound ID (DAGGER.SND's), not an index - AUDIT 58's law
    return p;
  }
  /** STOREFRONT: the pieces a skin stands about its portal, each its own billboard, hidden until placed. */
  function dressOf(/** @type {any} */ look) {
    const out = [];
    for (const d of look.dress) for (let i = 0; i < d.count; i++) {
      const size = { w: d.size.w, h: d.size.h };
      const b = renderer.createBillboardBatch(d.archive, '0', size, [[0, 0, 0]], { dynamic: true });
      b.size = size;
      b.origin = [0, -1e4, 0]; b.noShadow = true; b.conceal = { mode: 3, alpha: 0, t: 0, phase: 0 };
      out.push({ d, i, batch: b, phase: (i * 0.37) % 1 });
    }
    return out;
  }
  function dropDress(/** @type {any} */ p) { for (const q of p.dress ?? []) { try { renderer.destroyBillboardBatch(q.batch); } catch { /* gone */ } } p.dress = []; }
  /** STOREFRONT: the camera's basis at a portal standing on `foot` (portalBasis), into the set's scratch. */
  function basisAt(/** @type {number[]} */ foot) {
    mid[0] = foot[0]; mid[1] = foot[1] + PORTAL_SIZE.h * 0.5; mid[2] = foot[2];
    return portalBasis(renderer?._view ?? null, eyeNow(), mid, basis);
  }
  /** STOREFRONT: a burst's facing for a portal on `foot` - away from the eye ([x, z], render/killFx.js `dir`). */
  const facing = (/** @type {number[]} */ foot) => { const b = basisAt(foot).back; return [b[0], b[2]]; };
  /** STOREFRONT: a skinned portal's frame and the pieces about it, `age` ms into its life, `k` how open it stands. */
  function tickSkin(/** @type {any} */ p, /** @type {number} */ age, /** @type {number} */ k) {
    const look = p.look;
    p.batch.record = String(Math.floor((age / 1000) * look.fps) % look.frames);
    const { right, back } = basisAt(p.origin);
    archMid[0] = mid[0] + back[0] * 0.08; archMid[1] = mid[1]; archMid[2] = mid[2] + back[2] * 0.08;
    const closing = age > p.life - PORTAL_MS.close;
    for (const q of p.dress) {
      const pl = dressPlace(q.d, q.i, age / 1000, k, q.d.place === 'arch' ? archMid : mid, right, closing, placed);
      q.batch.origin[0] = pl.at[0]; q.batch.origin[1] = pl.at[1]; q.batch.origin[2] = pl.at[2];
      q.batch.size.w = q.d.size.w * pl.scale * (pl.spin < 0 ? -1 : 1); q.batch.size.h = q.d.size.h * pl.scale;
      q.batch.record = String(Math.floor((age / 1000 + q.phase) * q.d.fps) % q.d.frames);
      q.batch.conceal.alpha = clamp01(pl.scale * 1.2);
    }
    if (look.ambient && k > 0.8 && !closing && age - p.breath >= look.ambient.every * 1000) {
      p.breath = age;
      try { playerDoor()?.burst?.(look.ambient.recipe, [p.origin[0], p.origin[1] + 0.05, p.origin[2]], { h: PORTAL_SIZE.h, w: PORTAL_SIZE.w, dir: [back[0], back[2]] }); } catch { /* no breath here */ }
    }
  }
  /** One frame: each portal's size, frame and glow; the closed ones freed. `viewEye` the camera (it stands behind); a pool
   *  that hands none stands them by the frame's own (eyeNow), and the pieces always face it (portalBasis). */
  function tick(viewEye = null) {
    if (viewEye) eye = viewEye;
    const t = now(), from = eyeNow();
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      const age = t - p.at;
      const { open: k, done } = portalOpenAt(age, p.when, opened);
      if (done) { dropDress(p); try { renderer.destroyBillboardBatch(p.batch); } catch { /* gone */ } list.splice(i, 1); continue; }   // STOREFRONT: and the pieces about it
      const w = PORTAL_SIZE.w * Math.max(0.04, Math.min(1, k * 1.25 - 0.1)), hgt = PORTAL_SIZE.h * Math.max(0.12, Math.min(1.06, 0.35 + k * 0.7));
      p.batch.size.w = w; p.batch.size.h = hgt;
      p.batch.record = String(Math.floor((age / 1000) * PORTAL_FPS) % PORTAL_FRAMES);
      p.batch.conceal.alpha = clamp01(k * 1.15);
      // stand a step behind the body, along the line from the eye
      if (p.fixed) { p.origin[0] = p.feet[0]; p.origin[2] = p.feet[2]; }   // PORTAL1: a gate stands where it opened
      else if (from) {
        const dx = p.feet[0] - from[0], dz = p.feet[2] - from[2], L = Math.sqrt(dx * dx + dz * dz) || 1;
        p.origin[0] = p.feet[0] + (dx / L) * PORTAL_BACK; p.origin[2] = p.feet[2] + (dz / L) * PORTAL_BACK;
      }
      p.origin[1] = p.feet[1] + (PORTAL_SIZE.h - hgt) * 0.5;   // it opens about its middle
      if (p.look) tickSkin(p, age, k);   // STOREFRONT: its own frames, and what stands about it - placed off this frame's origin
    }
  }
  return {
    open,
    tick,
    /** STOREFRONT: a portal of MINE - my companions', my spared revenant's - in the skin I wear. */
    openMine: (/** @type {number[]} */ feet, /** @type {any} */ o = {}) => open(feet, { ...o, skin: ownPortalSkin() }),
    /** The portals' batches, drawn with the pool's - STOREFRONT: and the pieces a skin stands about each; one list,
     *  refilled (its takers copy it the frame they ask). */
    batches: () => {
      if (!list.length) return NONE;
      let n = 0;   // written by index: a length set to 0 lets the list's room go, and the pushes after it take it again
      for (const p of list) { drawn[n++] = p.batch; for (const q of p.dress ?? NONE) drawn[n++] = q.batch; }
      drawn.length = n;
      return drawn;
    },
    /** The floating origin moved: every portal with it (exteriorFoes.js offsetAll). */
    offsetAll(o) { for (const p of list) { p.feet[0] += o[0]; p.feet[1] += o[1]; p.feet[2] += o[2]; for (const q of p.dress ?? []) { q.batch.origin[0] += o[0]; q.batch.origin[1] += o[1]; q.batch.origin[2] += o[2]; } } },
    /** PORTAL1: one portal out at once, its batch freed (a gate whose word was replaced or ran out). */
    remove(p) { const i = list.indexOf(p); if (i < 0) return; dropDress(p); try { renderer.destroyBillboardBatch(p.batch); } catch { /* gone */ } list.splice(i, 1); },
    /** How many stand (tests, the pool's sweep). */
    get count() { return list.length; },
    clear() { for (const p of list) { dropDress(p); try { renderer.destroyBillboardBatch(p.batch); } catch { /* gone */ } } list.length = 0; },
  };
}
