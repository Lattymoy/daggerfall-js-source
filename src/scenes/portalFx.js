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
const NONE = Object.freeze([]); // no portal standing: the frame's batches() allocates nothing

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
      const u = ((x + 0.5) / w) * 2 - 1,
        v = ((y + 0.5) / h) * 2 - 1;
      const r = Math.hypot(u, v);
      const o = (y * w + x) * 4;
      if (r > 1) continue; // outside: clear
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
      R *= 1 - 0.65 * core;
      G *= 1 - 0.75 * core;
      B *= 1 - 0.45 * core;
      out[o] = R;
      out[o + 1] = G;
      out[o + 2] = B;
      out[o + 3] = Math.round(
        255 * clamp01(0.55 + 0.45 * Math.max(swirl, rim) + 0.25 * core) * clamp01((1 - r) / 0.05),
      );
    }
  }
  return { width: w, height: h, colors: out };
}

const _uploaded = new WeakSet();
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
 *  sealing; and whether it is done. PORTAL1: `holdMs` a hold of its own (a Portal Stone's - scenes/portalGates.js). */
export function portalOpenAt(t, { short = false, holdMs = null } = {}) {
  const hold = Number.isFinite(holdMs) ? Math.max(0, holdMs) : short ? PORTAL_MS.shortHold : PORTAL_MS.hold;
  if (t < 0) return { open: 0, done: false };
  if (t < PORTAL_MS.open) {
    const x = t / PORTAL_MS.open;
    return { open: Math.min(1.06, 1 - Math.pow(1 - x, 3) * (1 - 0.4 * x) + 0.06 * Math.sin(x * Math.PI)), done: false };
  }
  if (t < PORTAL_MS.open + hold) return { open: 1, done: false };
  const c = (t - PORTAL_MS.open - hold) / PORTAL_MS.close;
  if (c >= 1) return { open: 0, done: true };
  return { open: 1 - c * c, done: false };
}
/** A portal's whole life (ms). */
export const portalLife = ({ short = false, holdMs = null } = {}) =>
  PORTAL_MS.open +
  (Number.isFinite(holdMs) ? Math.max(0, holdMs) : short ? PORTAL_MS.shortHold : PORTAL_MS.hold) +
  PORTAL_MS.close;

/**
 * A pool's portals. `now()` ms; `audio` its 3D voice (optional).
 * @param {{ renderer: any, audio?: any, now?: () => number }} deps
 */
export function createPortalSet({ renderer, audio = null, now = () => performance.now() }) {
  /** @type {{ at: number, feet: number[], short: boolean, holdMs: number | null, fixed: boolean, batch: any, origin: number[] }[]} */
  const list = [];
  let eye = null;
  let soundAt = -Infinity; // QUIET-COMPANIONS: the set's last portal sound
  /** PORTAL1: `holdMs` a hold of its own; `fixed` stands it where it opened (a gate in the world, not a body's back). */
  function open(feet, { short = false, quiet = false, holdMs = null, fixed = false } = {}) {
    if (!renderer?.createBillboardBatch || !feet) return null;
    ensurePortalArt(renderer);
    const at = [feet[0], feet[1] - 0.05, feet[2]];
    const batch = renderer.createBillboardBatch(
      PORTAL_ARCHIVE,
      '0',
      { w: PORTAL_SIZE.w, h: PORTAL_SIZE.h },
      [[0, 0, 0]],
      { dynamic: true },
    );
    batch.origin = [at[0], at[1], at[2]];
    batch.noShadow = true;
    batch.conceal = { mode: 3, alpha: 0, t: 0, phase: 0 };
    const p = {
      at: now(),
      feet: at,
      short,
      holdMs: Number.isFinite(holdMs) ? holdMs : null,
      fixed,
      batch,
      origin: batch.origin,
    };
    list.push(p);
    if (!quiet && p.at - soundAt >= PORTAL_SOUND_GAP_MS) {
      soundAt = p.at;
      try {
        audio?.play3dId?.(PORTAL_SOUND, at, 0.9, { maxDistance: 24 });
      } catch {
        /* silent */
      }
    } // a sound ID (DAGGER.SND's), not an index - AUDIT 58's law
    return p;
  }
  /** One frame: each portal's size, frame and glow; the closed ones freed. `viewEye` the camera (it stands behind). */
  function tick(viewEye = null) {
    if (viewEye) eye = viewEye;
    const t = now();
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      const age = t - p.at;
      const { open: k, done } = portalOpenAt(age, { short: p.short, holdMs: p.holdMs });
      if (done) {
        try {
          renderer.destroyBillboardBatch(p.batch);
        } catch {
          /* gone */
        }
        list.splice(i, 1);
        continue;
      }
      const w = PORTAL_SIZE.w * Math.max(0.04, Math.min(1, k * 1.25 - 0.1)),
        hgt = PORTAL_SIZE.h * Math.max(0.12, Math.min(1.06, 0.35 + k * 0.7));
      p.batch.size = { w, h: hgt };
      p.batch.record = String(Math.floor((age / 1000) * PORTAL_FPS) % PORTAL_FRAMES);
      p.batch.conceal.alpha = clamp01(k * 1.15);
      // stand a step behind the body, along the line from the eye
      if (p.fixed) {
        p.origin[0] = p.feet[0];
        p.origin[2] = p.feet[2];
      } // PORTAL1: a gate stands where it opened
      else if (eye) {
        const dx = p.feet[0] - eye[0],
          dz = p.feet[2] - eye[2],
          L = Math.hypot(dx, dz) || 1;
        p.origin[0] = p.feet[0] + (dx / L) * PORTAL_BACK;
        p.origin[2] = p.feet[2] + (dz / L) * PORTAL_BACK;
      }
      p.origin[1] = p.feet[1] + (PORTAL_SIZE.h - hgt) * 0.5; // it opens about its middle
    }
  }
  return {
    open,
    tick,
    /** The portals' batches, drawn with the pool's. */
    batches: () => (list.length ? list.map((p) => p.batch) : NONE),
    /** The floating origin moved: every portal with it (exteriorFoes.js offsetAll). */
    offsetAll(o) {
      for (const p of list) {
        p.feet[0] += o[0];
        p.feet[1] += o[1];
        p.feet[2] += o[2];
      }
    },
    /** PORTAL1: one portal out at once, its batch freed (a gate whose word was replaced or ran out). */
    remove(p) {
      const i = list.indexOf(p);
      if (i < 0) return;
      try {
        renderer.destroyBillboardBatch(p.batch);
      } catch {
        /* gone */
      }
      list.splice(i, 1);
    },
    /** How many stand (tests, the pool's sweep). */
    get count() {
      return list.length;
    },
    clear() {
      for (const p of list) {
        try {
          renderer.destroyBillboardBatch(p.batch);
        } catch {
          /* gone */
        }
      }
      list.length = 0;
    },
  };
}
