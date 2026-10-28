// @ts-check
// ARMORY (2026-10-28; bible/04-Characters/Aura-Armory.md section 5): WHERE A BODY'S PARTS ARE, for the Aura Armory's
// pieces. A pose is fifteen points in the body's own frame ([right, up, forward] metres about the feet): the head's
// middle and its crown, the neck, the chest, the pelvis, each shoulder, elbow, wrist, hip, knee and ankle. A Morrowind
// rig gives them off its posed bones; an Eye of the Beholder sprite off its figure, by the pixel (EOTB_FIGURE); a body
// with neither, the rest pose. A sprite's limbs past the shoulder and the hip are its rest pose's: a painting has no
// bones, so a sprite's pose says so (`limbs`), and a piece on a forearm or a weapon stands down on it. Pure.
import { EOTB_FIGURE, CLOAK_HEAD_ABOVE, CLOAK_SHOULDER_HALF, CLOAK_SHOULDER_Y, AURA_SADDLE_M } from './auraRing.js';

/** The rig's bones a pose reads (fpArm.thirdBones, peerBodies.bonesOf - lowercase, as the skeleton's byName keeps them). */
export const ARMORY_BONES = Object.freeze([
  'bip01 head', 'bip01 neck', 'bip01 spine2', 'bip01 pelvis',
  'bip01 l upperarm', 'bip01 r upperarm', 'bip01 l forearm', 'bip01 r forearm', 'bip01 l hand', 'bip01 r hand',
  'bip01 l thigh', 'bip01 r thigh', 'bip01 l calf', 'bip01 r calf', 'bip01 l foot', 'bip01 r foot',
]);
/** The pose's points, in the order a pose's `pts` holds them (three floats each). */
export const POSE_POINTS = Object.freeze(['head', 'crown', 'neck', 'chest', 'pelvis', 'shL', 'shR', 'elL', 'elR', 'waL', 'waR', 'hipL', 'hipR', 'knL', 'knR', 'ftL', 'ftR']);
/** A point's index in `pts` (times three). */
export const P = Object.freeze(Object.fromEntries(POSE_POINTS.map((n, i) => [n, i * 3])));
/** How far the crown stands over the head's middle (m). */
export const CROWN_ABOVE = 0.13;
/** How far the head's middle stands under the top of its picture's head (the sets' pixels: the joint at 96, its middle a
 *  hand over it, the helm's top at 108). */
export const HEAD_TOP_PX = 7;

/** THE REST POSE - a standing body 1.8 m tall, arms at the sides (render/auraPreview.js PREVIEW_FIGURE's, and a body that
 *  gives no points): [right, up, forward] m about the feet, in POSE_POINTS' order. */
export const REST_POINTS = Object.freeze([
  0, 1.64, 0.01, 0, 1.64 + CROWN_ABOVE, 0.01, 0, 1.49, 0, 0, 1.2, 0.12, 0, 0.92, 0,
  -0.21, 1.4, 0, 0.21, 1.4, 0, -0.25, 1.1, 0, 0.25, 1.1, 0, -0.25, 0.82, 0.02, 0.25, 0.82, 0.02,
  -0.09, 0.9, 0, 0.09, 0.9, 0, -0.09, 0.46, 0.02, 0.09, 0.46, 0.02, -0.09, 0.06, 0, 0.09, 0.06, 0,
]);

/** THE SPRITE'S POINTS BY THE PIXEL - a sprite figure's rows over the frame's foot (EOTB_FIGURE's own for the shoulder,
 *  neck and head; the rest measured off the sets' idle frames - 112364, 112365, 112370, 112372 front and back) and how
 *  far out from its axis each stands, in the sets' pixels. Its chest stands forward of the axis by `chestFwd` m. */
export const SPRITE_ROWS = Object.freeze({ chest: 78, pelvis: 52, elbow: 67, wrist: 50, hip: 48, knee: 29, ankle: 6, elbowOut: 13, wristOut: 17, hipOut: 5, chestFwd: 0.1 });
const SPRITE_ROWS_CHEST = SPRITE_ROWS.chest, SPRITE_ROWS_PELVIS = SPRITE_ROWS.pelvis;

/** A fresh pose - its points the rest pose's; `dx` each point's offset along a sprite card's right (m), 0 on a rig. */
export function newPose() {
  return { pts: Float32Array.from(REST_POINTS), dx: new Float32Array(POSE_POINTS.length), card: false, limbs: 'full', sunk: false, scale: 1 };
}

/** THE ROWS a picture's marks are read at, in the sets' pixels over the frame's foot (EOTB_FIGURE's and SPRITE_ROWS'). */
const MARK_ROWS = Object.freeze({ head: [EOTB_FIGURE.neck, EOTB_FIGURE.head + 6], chest: [SPRITE_ROWS_CHEST - 3, SPRITE_ROWS_CHEST + 3], pelvis: [SPRITE_ROWS_PELVIS - 4, SPRITE_ROWS_PELVIS + 4] });
/** The narrowest run a head is (px) - a blade, a staff or a bowstring held over it is a pixel or three - and how far off
 *  the picture's middle the body may stand (px). */
const HEAD_MIN_PX = 5, BODY_OFF_PX = 16;

/**
 * WHERE THE BODY STANDS IN A SPRITE'S OWN PICTURE (`colors` its color32 pixels, bottom-up as uploaded - mirrored already
 * where it draws mirrored - `w` by `h`): the head's, the chest's and the pelvis's middle across, in pixels off the
 * picture's middle, and the head's top row over the frame's foot - read off its alpha in the rows each stands in, the
 * opaque run nearest the middle (an arm, a sword or a staff to the side is a run of its own). A painting is not centred
 * on its feet - its sword arm out, its staff beside it - so a piece hung at the picture's middle hangs beside the head.
 * `beast` the same at a beast's rows (EOTB_FIGURE.beast). Null where nothing stands. Pure.
 */
export function spriteMarks(/** @type {ArrayLike<number>} */ colors, /** @type {number} */ w, /** @type {number} */ h) {
  if (!colors || !(w > 0) || !(h > 0) || colors.length < w * h) return null;
  const mid = (w - 1) / 2;
  const runAt = (/** @type {number} */ r, minW = 1) => {
    if (r < 0 || r >= h) return null;
    let best = null, start = -1;
    for (let x = 0; x <= w; x++) {
      const solid = x < w && ((colors[r * w + x] >>> 24) & 255) > 127;
      if (solid && start < 0) start = x;
      if (!solid && start >= 0) {
        const c = (start + x - 1) / 2, wd = x - start;
        if (wd >= minW && Math.abs(c - mid) <= BODY_OFF_PX && (!best || Math.abs(c - mid) < Math.abs(best.c - mid))) best = { c, wd };
        start = -1;
      }
    }
    return best;
  };
  const across = (/** @type {number[]} */ rows, k = 1, minW = 1) => {
    let sum = 0, n = 0;
    for (let r = Math.round(rows[0] * k); r <= Math.round(rows[1] * k); r++) { const run = runAt(r, minW); if (run) { sum += run.c; n++; } }
    return n ? sum / n - mid : null;
  };
  const topOf = (/** @type {number} */ k) => { for (let r = h - 1; r >= Math.round(EOTB_FIGURE.neck * k); r--) if (runAt(r, HEAD_MIN_PX)) return r; return null; };
  const read = (/** @type {number} */ k) => ({ top: topOf(k), head: across(MARK_ROWS.head, k, HEAD_MIN_PX), chest: across(MARK_ROWS.chest, k), pelvis: across(MARK_ROWS.pelvis, k) });
  const own = read(1);
  if (own.chest === null && own.head === null) return null;
  return { ...own, beast: read(EOTB_FIGURE.beast) };
}

const set = (/** @type {Float32Array} */ pts, /** @type {string} */ name, /** @type {ArrayLike<number>} */ v) => { const i = P[name]; pts[i] = v[0]; pts[i + 1] = v[1]; pts[i + 2] = v[2]; };

/**
 * THE POSE OFF A RIG'S BONES (`bones` as fpArm.thirdBones answers: each bone's origin [right, up, forward] m about the
 * feet, null where its skeleton lacks one), written into `out` - or false when the head or a shoulder is missing (the
 * wolf's skeleton), and `out` is left as it was. A bone's origin is its joint: the upper arm's the shoulder, the forearm's
 * the elbow, the hand's the wrist, the thigh's the hip, the calf's the knee, the foot's the ankle. A limb's missing bone is
 * the rest pose's point, moved with the shoulder or hip it hangs from. Pure but for `out`.
 */
export function poseFromBones(/** @type {any} */ bones, /** @type {any} */ out) {
  const H = bones?.['bip01 head'], L = bones?.['bip01 l upperarm'], R = bones?.['bip01 r upperarm'];
  if (!H || !L || !R) return false;
  const pts = out.pts, N = bones['bip01 neck'];
  const ux = N ? H[0] - N[0] : 0, uy = N ? H[1] - N[1] : 1, uz = N ? H[2] - N[2] : 0, ul = Math.hypot(ux, uy, uz) || 1;
  set(pts, 'head', [H[0] + (ux / ul) * CLOAK_HEAD_ABOVE, H[1] + (uy / ul) * CLOAK_HEAD_ABOVE, H[2] + (uz / ul) * CLOAK_HEAD_ABOVE]);
  set(pts, 'crown', [pts[P.head] + (ux / ul) * CROWN_ABOVE, pts[P.head + 1] + (uy / ul) * CROWN_ABOVE, pts[P.head + 2] + (uz / ul) * CROWN_ABOVE]);
  set(pts, 'neck', N ?? [(L[0] + R[0]) / 2, (L[1] + R[1]) / 2 + 0.06, (L[2] + R[2]) / 2]);
  set(pts, 'shL', L); set(pts, 'shR', R);
  const spine = bones['bip01 spine2'];
  set(pts, 'chest', spine ? [spine[0], spine[1], spine[2] + 0.12] : [(L[0] + R[0]) / 2, (L[1] + R[1]) / 2 - 0.2, (L[2] + R[2]) / 2 + 0.12]);   // the chest's face, a hand forward of the spine
  const hang = (/** @type {string} */ name, /** @type {any} */ v, /** @type {string} */ from, /** @type {ArrayLike<number>} */ root) => {
    if (v) { set(pts, name, v); return; }
    const r = P[from], i = P[name];
    set(pts, name, [root[0] + REST_POINTS[i] - REST_POINTS[r], root[1] + REST_POINTS[i + 1] - REST_POINTS[r + 1], root[2] + REST_POINTS[i + 2] - REST_POINTS[r + 2]]);
  };
  hang('elL', bones['bip01 l forearm'], 'shL', L); hang('elR', bones['bip01 r forearm'], 'shR', R);
  hang('waL', bones['bip01 l hand'], 'shL', L); hang('waR', bones['bip01 r hand'], 'shR', R);
  const pelvis = bones['bip01 pelvis'];
  set(pts, 'pelvis', pelvis ?? [REST_POINTS[P.pelvis], REST_POINTS[P.pelvis + 1], REST_POINTS[P.pelvis + 2]]);
  const pv = [pts[P.pelvis], pts[P.pelvis + 1], pts[P.pelvis + 2]];
  hang('hipL', bones['bip01 l thigh'], 'pelvis', pv); hang('hipR', bones['bip01 r thigh'], 'pelvis', pv);
  hang('knL', bones['bip01 l calf'], 'pelvis', pv); hang('knR', bones['bip01 r calf'], 'pelvis', pv);
  hang('ftL', bones['bip01 l foot'], 'pelvis', pv); hang('ftR', bones['bip01 r foot'], 'pelvis', pv);
  out.card = false; out.limbs = 'full'; out.sunk = false; out.scale = 1; out.dx.fill(0);
  return true;
}

/**
 * THE POSE OFF A SPRITE'S FIGURE (`fig` { base, mpp, beast } - eotbBody figure(), peerWalkers figureOf), written into
 * `out`, or false without one. Its points stand where the sets' frames draw them (SPRITE_ROWS), across by the frame's
 * metres a pixel; a beast's at EOTB_FIGURE.beast of them. `card` - a flat card through the feet, so a piece is drawn on
 * the eye's side of it (the card law: the pass lifts its points toward the eye); `limbs` 'upper' - past the shoulder and
 * the hip a painting has no measure, so a forearm's and a weapon's piece stand down; `sunk` - the shoulders below the
 * water's line. Pure but for `out`.
 */
export function poseFromFigure(/** @type {any} */ fig, /** @type {any} */ out) {
  if (!fig || !Number.isFinite(fig.base) || !(fig.mpp > 0)) return false;
  const m = fig.mpp * (fig.beast === true ? EOTB_FIGURE.beast : 1), at = (/** @type {number} */ px) => fig.base + px * m, x = (/** @type {number} */ px) => px * m;
  const R = SPRITE_ROWS, pts = out.pts, half = CLOAK_SHOULDER_HALF * m / EOTB_FIGURE.mpp;   // the shoulders as the cape's are (auraSpriteBones)
  // the picture's own marks (spriteMarks), where they were read: the head's top and the body's middle across the card
  const mk = fig.marks ? (fig.beast === true ? fig.marks.beast : fig.marks) : null, k = fig.beast === true ? EOTB_FIGURE.beast : 1;
  const headY = Number.isFinite(mk?.top) ? fig.base + (mk.top / k - HEAD_TOP_PX) * m : at(EOTB_FIGURE.head) + CLOAK_HEAD_ABOVE * m / EOTB_FIGURE.mpp;
  set(pts, 'head', [0, headY, 0.01]);
  set(pts, 'crown', [0, pts[P.head + 1] + CROWN_ABOVE * m / EOTB_FIGURE.mpp, 0.01]);
  set(pts, 'neck', [0, at(EOTB_FIGURE.neck), 0]);
  set(pts, 'chest', [0, at(R.chest), R.chestFwd * m / EOTB_FIGURE.mpp]);
  set(pts, 'pelvis', [0, at(R.pelvis), 0]);
  set(pts, 'shL', [-half, at(EOTB_FIGURE.shoulder), 0]); set(pts, 'shR', [half, at(EOTB_FIGURE.shoulder), 0]);
  set(pts, 'elL', [-x(R.elbowOut), at(R.elbow), 0]); set(pts, 'elR', [x(R.elbowOut), at(R.elbow), 0]);
  set(pts, 'waL', [-x(R.wristOut), at(R.wrist), 0.02]); set(pts, 'waR', [x(R.wristOut), at(R.wrist), 0.02]);
  set(pts, 'hipL', [-x(R.hipOut), at(R.hip), 0]); set(pts, 'hipR', [x(R.hipOut), at(R.hip), 0]);
  set(pts, 'knL', [-x(R.hipOut) * 1.1, at(R.knee), 0.02]); set(pts, 'knR', [x(R.hipOut) * 1.1, at(R.knee), 0.02]);
  set(pts, 'ftL', [-x(R.hipOut) * 1.1, at(R.ankle), -0.02]); set(pts, 'ftR', [x(R.hipOut) * 1.1, at(R.ankle), -0.02]);
  const shift = Number.isFinite(fig.shift) ? fig.shift : 0, off = (/** @type {number|null|undefined} */ v) => shift + (Number.isFinite(v) ? /** @type {number} */ (v) * fig.mpp : 0);
  const head = off(mk?.head), chest = off(mk?.chest ?? mk?.head), pelvis = off(mk?.pelvis ?? mk?.chest);
  for (const n of POSE_POINTS) out.dx[P[n] / 3] = ['head', 'crown', 'neck'].includes(n) ? head : ['chest', 'shL', 'shR', 'elL', 'elR', 'waL', 'waR'].includes(n) ? chest : pelvis;
  out.card = true; out.limbs = 'upper'; out.sunk = at(EOTB_FIGURE.shoulder) < CLOAK_SHOULDER_Y * 0.4; out.scale = m / EOTB_FIGURE.mpp;
  return true;
}

/** THE REST POSE written into `out`, pressed down to `crouch` (the body's height over its standing height, 1 standing)
 *  and lifted onto a saddle for a rider. Pure but for `out`. */
export function poseAtRest(/** @type {any} */ out, crouch = 1, mounted = false) {
  const k = Number.isFinite(crouch) ? Math.max(0.4, Math.min(1, crouch)) : 1, lift = mounted ? AURA_SADDLE_M : 0;
  for (let i = 0; i < REST_POINTS.length; i += 3) { out.pts[i] = REST_POINTS[i]; out.pts[i + 1] = REST_POINTS[i + 1] * k + lift; out.pts[i + 2] = REST_POINTS[i + 2]; }
  out.card = false; out.limbs = 'full'; out.sunk = false; out.scale = k; out.dx.fill(0);
  return out;
}

/** A pose's point in the world: the wearer's feet `at` and facing `yaw` (forward (sin, cos) in x, z - the aura's own
 *  law, auraRing.js auraWingLights) and, on a sprite, its offset along the card's right (`right`, the billboard's) -
 *  into `o` at `o3`. Pure but for `o`. */
export function poseWorld(/** @type {any} */ pose, /** @type {string} */ name, /** @type {ArrayLike<number>} */ at, /** @type {number} */ yaw, /** @type {Float32Array|number[]} */ o, o3 = 0, /** @type {ArrayLike<number>|null} */ right = null) {
  const i = P[name], p = pose.pts, c = Math.cos(yaw), s = Math.sin(yaw), d = right && pose.dx ? pose.dx[i / 3] : 0;
  o[o3] = at[0] + c * p[i] + s * p[i + 2] + (d ? right[0] * d : 0);
  o[o3 + 1] = at[1] + p[i + 1];
  o[o3 + 2] = at[2] - s * p[i] + c * p[i + 2] + (d ? right[2] * d : 0);
  return o;
}
