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
  'bip01 head',
  'bip01 neck',
  'bip01 spine2',
  'bip01 pelvis',
  'bip01 l upperarm',
  'bip01 r upperarm',
  'bip01 l forearm',
  'bip01 r forearm',
  'bip01 l hand',
  'bip01 r hand',
  'bip01 l thigh',
  'bip01 r thigh',
  'bip01 l calf',
  'bip01 r calf',
  'bip01 l foot',
  'bip01 r foot',
]);
/** The pose's points, in the order a pose's `pts` holds them (three floats each). */
export const POSE_POINTS = Object.freeze([
  'head',
  'crown',
  'neck',
  'chest',
  'pelvis',
  'shL',
  'shR',
  'elL',
  'elR',
  'waL',
  'waR',
  'hipL',
  'hipR',
  'knL',
  'knR',
  'ftL',
  'ftR',
]);
/** A point's index in `pts` (times three). */
export const POSE_AT = Object.freeze(Object.fromEntries(POSE_POINTS.map((n, i) => [n, i * 3])));
/** How far the crown stands over the head's middle (m). */
export const CROWN_ABOVE = 0.13;
/** How far the head's middle stands under the top of its picture's head (the sets' pixels: the joint at 96, its middle a
 *  hand over it, the helm's top at 108). */
export const HEAD_TOP_PX = 7;

/** THE REST POSE - a standing body 1.8 m tall, arms at the sides (render/auraPreview.js PREVIEW_FIGURE's, and a body that
 *  gives no points): [right, up, forward] m about the feet, in POSE_POINTS' order. */
export const REST_POINTS = Object.freeze([
  0,
  1.64,
  0.01,
  0,
  1.64 + CROWN_ABOVE,
  0.01,
  0,
  1.49,
  0,
  0,
  1.2,
  0.12,
  0,
  0.92,
  0,
  -0.21,
  1.4,
  0,
  0.21,
  1.4,
  0,
  -0.25,
  1.1,
  0,
  0.25,
  1.1,
  0,
  -0.25,
  0.82,
  0.02,
  0.25,
  0.82,
  0.02,
  -0.09,
  0.9,
  0,
  0.09,
  0.9,
  0,
  -0.09,
  0.46,
  0.02,
  0.09,
  0.46,
  0.02,
  -0.09,
  0.06,
  0,
  0.09,
  0.06,
  0,
]);

/** WOLF-KIT (2026-10-30, mob: "get the feet chest and arm and hand cosmetic to work on werewolf form"): how much thicker
 *  than a person's the wolf's limbs and chest stand - a turned wearer's pose scale (poseFromBones' `beast`), each piece's
 *  rings and decals that much wider round the fur. */
export const ARMORY_BEAST_FIT = 1.35;
/** WOLF-KIT (mob: "chest need more center"): the wolf's chest, hunched and turned in its idle - centred between its
 *  shoulders, not on its spine's bone (which leans to one side), its face this far forward of them (m; a person's a hand
 *  forward of the spine, 0.12), `down` m under the spine's bone, and its back this far behind the face (`back`, m - the
 *  chest's back piece; a person's the pass's own). */
export const ARMORY_BEAST_CHEST = Object.freeze({ face: 0.08, back: 0.55, down: 0.1 });
/** WOLF-KIT (mob: "they clip through on the arms"): the wolf's arms thicker again than its fit - a band's rings `arm`
 *  times wider round them. They stop at the wrist (mob: "the wrist stick out to far"): the claws wear the weapon glow. */
export const ARMORY_BEAST_ARM = Object.freeze({ arm: 1.25 });

/** THE SPRITE'S POINTS BY THE PIXEL - a sprite figure's rows over the frame's foot (EOTB_FIGURE's own for the shoulder,
 *  neck and head; the rest measured off the sets' idle frames - 112364, 112365, 112370, 112372 front and back) and how
 *  far out from its axis each stands, in the sets' pixels. Its chest stands forward of the axis by `chestFwd` m. */
export const SPRITE_ROWS = Object.freeze({
  chest: 78,
  pelvis: 52,
  elbow: 67,
  wrist: 50,
  hip: 48,
  knee: 29,
  ankle: 6,
  elbowOut: 13,
  wristOut: 17,
  hipOut: 5,
  chestFwd: 0.1,
});
const SPRITE_ROWS_CHEST = SPRITE_ROWS.chest,
  SPRITE_ROWS_PELVIS = SPRITE_ROWS.pelvis;

/** A fresh pose - its points the rest pose's; `dx` each point's offset along a sprite card's right (m), 0 on a rig. */
export function newPose() {
  return {
    pts: Float32Array.from(REST_POINTS),
    dx: new Float32Array(POSE_POINTS.length),
    card: false,
    limbs: 'full',
    sunk: false,
    scale: 1,
    armsTurned: false,
    bands: null,
    flank: null,
    chestSpan: null,
    back: 0,
    arm: 1,
    hock: false,
  };
}

/** THE ROWS a picture's marks are read at, in the sets' pixels over the frame's foot (EOTB_FIGURE's and SPRITE_ROWS'). */
const MARK_ROWS = Object.freeze({
  head: [EOTB_FIGURE.neck, EOTB_FIGURE.head + 6],
  chest: [SPRITE_ROWS_CHEST - 3, SPRITE_ROWS_CHEST + 3],
  pelvis: [SPRITE_ROWS_PELVIS - 4, SPRITE_ROWS_PELVIS + 4],
});
/** The narrowest run a head is (px) - a blade, a staff or a bowstring held over it is a pixel or three - and how far off
 *  the picture's middle the body may stand (px). */
const HEAD_MIN_PX = 5,
  BODY_OFF_PX = 16;
/** THE ARMS IN A PICTURE, in the sets' pixels: an arm's half-width, how far its outer edge moves in a row before what is
 *  there is something held over it (a shield, a sack, a blade's guard) and no longer the arm, and how far out from the
 *  body's middle an arm reaches. Read at the sets' rows (EOTB_FIGURE.shoulder, SPRITE_ROWS' elbow and wrist): a
 *  figure's top is its helmet's, its hood's or its horns', no measure of where its shoulders stand. */
export const ARM_PX = Object.freeze({ half: 3.5, step: 3, reach: 34 });
/** ARMORY-MIRROR (the owner: "Guild patch is still wrong"): WHERE A BAND IS WORN ON A PICTURE'S ARM - `at` of the way
 *  from the shoulder row to the elbow's, or the first row under it, to `last` of the way, where the arm's own run stands
 *  clear of the body; as wide as that run, `min` to `max` of the sets' pixels. A painted arm is 3 to 6 px, often hidden
 *  by a strap or a shadow at the shoulder; half an arm in from its edge stood the Insignia Armlet on the chest. Never
 *  clear of the body, the arm ends where its colour steps by `step` (of 255). */
export const ARM_BAND = Object.freeze({ at: 0.36, last: 0.8, min: 4, max: 10, step: 40 });
/** Whether a view's arms are read from its picture: a side view's outer edges are its chest and its back, so its arms
 *  stay the sets' rows turned with the body (eotbSprite.js spriteFor's `view`, 2 the side). Pure. */
export const spriteArmsSeen = (/** @type {number|undefined} */ view) => view !== 2;
/** The rows the legs stand in over the frame's foot - the shins and the feet, or a robe's hem - and the narrowest run a
 *  leg is (px): a staff's shaft beside them is narrower, and in these rows nothing else is held. */
const LEG_ROWS = 30,
  LEG_MIN_PX = 5;

/**
 * WHERE THE BODY STANDS IN A SPRITE'S OWN PICTURE (`colors` its color32 pixels, bottom-up as uploaded - mirrored already
 * where it draws mirrored - `w` by `h`): the head's, the chest's and the pelvis's middle across, in pixels off the
 * picture's middle, and the head's top row over the frame's foot - read off its alpha in the rows each stands in, the
 * opaque run nearest the middle (an arm, a sword or a staff to the side is a run of its own). A painting is not centred
 * on its feet - its sword arm out, its staff beside it - so a piece hung at the picture's middle hangs beside the head.
 * `beast` the same at a beast's rows (EOTB_FIGURE.beast). Null where nothing stands. Pure.
 */
export function spriteMarks(
  /** @type {ArrayLike<number>} */ colors,
  /** @type {number} */ w,
  /** @type {number} */ h,
  { arms = true, art = 1 } = {},
) {
  if (!colors || !(w > 0) || !(h > 0) || colors.length < w * h) return null;
  const mid = (w - 1) / 2;
  // a record drawn at another scale (eotbSprite.js spriteArtScale) is read at the sets' rows and widths scaled by it
  const A = art > 0 ? art : 1,
    sc = (/** @type {number} */ n) => Math.max(1, Math.round(n * A));
  const legRows = sc(LEG_ROWS),
    legMin = sc(LEG_MIN_PX),
    headMin = sc(HEAD_MIN_PX),
    bodyOff = BODY_OFF_PX * A;
  const solid = (/** @type {number} */ x, /** @type {number} */ r) =>
    x >= 0 && x < w && r >= 0 && r < h && ((colors[r * w + x] >>> 24) & 255) > 127;
  /** Every opaque run of row `r`, [first, last] column - each row read once, the arms, legs and shafts asking again. */
  const rowRuns = /** @type {number[][][]} */ ([]);
  const runsAt = (/** @type {number} */ r) => {
    if (r < 0 || r >= h) return [];
    if (rowRuns[r]) return rowRuns[r];
    const out = [];
    for (let x = 0, start = -1; x <= w; x++) {
      const on = x < w && solid(x, r);
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        out.push([start, x - 1]);
        start = -1;
      }
    }
    return (rowRuns[r] = out);
  };
  // THE BODY'S AXIS: the middle of its legs, every run a leg's width in their rows weighed by its width - a picture is
  // as wide as what it holds, so a sword or a mace held out stands the body far off its middle (a side view's most)
  let legSum = 0,
    legW = 0;
  for (let r = 0; r < Math.min(h, legRows); r++)
    for (const [x0, x1] of runsAt(r)) {
      const wd = x1 - x0 + 1;
      if (wd >= legMin) {
        legSum += ((x0 + x1) / 2) * wd;
        legW += wd;
      }
    }
  const axis = legW ? legSum / legW : mid;
  /** Row `r`'s run at least `minW` wide nearest the axis, within BODY_OFF_PX of it: { c its middle, wd its width } - or null. */
  const runAt = (/** @type {number} */ r, minW = 1) => {
    let best = null;
    for (const [x0, x1] of runsAt(r)) {
      const c = (x0 + x1) / 2,
        wd = x1 - x0 + 1;
      if (wd >= minW && Math.abs(c - axis) <= bodyOff && (!best || Math.abs(c - axis) < Math.abs(best.c - axis)))
        best = { c, wd };
    }
    return best;
  };
  const across = (/** @type {number[]} */ rows, k = 1, minW = 1) => {
    let sum = 0,
      n = 0;
    for (let r = Math.round(rows[0] * k); r <= Math.round(rows[1] * k); r++) {
      const run = runAt(r, minW);
      if (run) {
        sum += run.c;
        n++;
      }
    }
    return n ? sum / n - mid : null;
  };
  /** BACK-HOLSTER: half the body's run over `rows`, as `across` picks it (px) - how far the painted torso reaches either
   *  side of its middle; a side view's depth to its back. */
  const halfOf = (/** @type {number[]} */ rows, k = 1) => {
    let sum = 0,
      n = 0;
    for (let r = Math.round(rows[0] * k); r <= Math.round(rows[1] * k); r++) {
      const run = runAt(r);
      if (run) {
        sum += run.wd / 2;
        n++;
      }
    }
    return n ? sum / n : null;
  };
  /** The head's top: up from the neck the run over the body's middle, each row the run most over the last - never the
   *  orb of a staff or the tip of a blade beside it, on runs of their own; a run three rows under 3 px is a shaft. */
  const topOf = (/** @type {number} */ k) => {
    const r0 = Math.round(EOTB_FIGURE.neck * k),
      first = runAt(r0, headMin);
    if (!first) return null;
    let a = Math.round(first.c - (first.wd - 1) / 2),
      b = a + first.wd - 1,
      top = r0,
      thin = 0;
    for (let r = r0 + 1; r < h; r++) {
      let best = null,
        most = 0;
      for (const [x0, x1] of runsAt(r)) {
        const over = Math.min(b, x1) - Math.max(a, x0) + 1;
        if (over > most) {
          most = over;
          best = [x0, x1];
        }
      }
      if (!best) break;
      thin = best[1] - best[0] + 1 < 3 ? thin + 1 : 0;
      if (thin >= 3) break;
      [a, b] = best;
      if (!thin) top = r;
    }
    return top;
  };
  /** ONE ARM (`s` its side, -1 the picture's left), its outer edge followed down from the shoulder row by row: each row
   *  the run on that side whose edge stands nearest the last row's, within ARM_PX.step - and under something held over
   *  it (the run reaching past the arm's edge) the edge goes on as it went. Its shoulder, elbow and wrist, half an arm in
   *  from the edge: { sh, el, wa } columns off the picture's middle at `rows` [shoulder, elbow, wrist] - or null. And its
   *  `band` (ARM_BAND): { row (the sets'), c, wd } where the arm stands clear of the body, or null where it never does. */
  const armOf = (/** @type {number} */ s, /** @type {number} */ cx) => {
    const at0 = /** @type {number[]} */ ([EOTB_FIGURE.shoulder, SPRITE_ROWS.elbow, SPRITE_ROWS.wrist]),
      rows = at0.map((r) => Math.round(r * A)); // the sets' rows, and the picture's
    const reach = ARM_PX.reach * A,
      step = ARM_PX.step * A,
      half = ARM_PX.half * A,
      out = (/** @type {number} */ x) => s * (x - cx);
    const c0 = Math.round(cx);
    let x = c0;
    if (!solid(x, rows[0])) return null;
    while (out(x + s) <= reach && (solid(x + s, rows[0]) || solid(x + 2 * s, rows[0]))) x += s; // out along the shoulder's row, over a one-pixel gap
    const edge = new Map([[rows[0], x]]),
      seen = [x],
      held = new Map(); // ARMORY-MIRROR: `held` each row's run the edge was
    let e = x,
      slope = 0;
    for (let r = rows[0] - 1; r >= rows[2]; r--) {
      let near = null;
      for (const [x0, x1] of runsAt(r)) {
        const hi = s > 0 ? x1 : x0,
          lo = s > 0 ? Math.max(x0, c0) : Math.min(x1, c0);
        if (out(hi) < 0 || out(hi) > reach) continue; // the other side's, or past an arm's reach
        const spans = out(lo) <= out(e) && out(e) <= out(hi),
          d = Math.abs(hi - e);
        if ((spans || d <= step) && (!near || d < near.d)) near = { hi, d, run: [x0, x1] };
      }
      if (!near) break;
      // a thing held over the arm: the arm goes on under it as its last few rows went (a pixel staircase's mean)
      if (near.d <= step) {
        e = near.hi;
        held.set(r, near.run);
        seen.push(e);
        if (seen.length > 7) seen.shift();
        slope = Math.max(-step, Math.min(step, (e - seen[0]) / Math.max(1, seen.length - 1)));
      } else e += slope;
      edge.set(r, e);
    }
    const last = [...edge.values()].pop() ?? x,
      at = (/** @type {number} */ r) => (edge.get(r) ?? last) - s * half - mid;
    // the band: from ARM_BAND.at down, the first row whose run is the arm's alone - its inner end past the body's middle
    let band = null;
    const fromRow = Math.round(rows[0] + (rows[1] - rows[0]) * ARM_BAND.at),
      toRow = Math.round(rows[0] + (rows[1] - rows[0]) * ARM_BAND.last);
    for (let r = fromRow; r >= toRow && !band; r--) {
      const run = held.get(r);
      if (!run || out(s > 0 ? run[0] : run[1]) <= 0 || run[1] - run[0] + 1 > ARM_BAND.max * A) continue;
      band = { row: r / A, c: (run[0] + run[1]) / 2 - mid, wd: Math.max(ARM_BAND.min * A, run[1] - run[0] + 1) };
    }
    // never clear of the body (a three-quarter back view's near arm against its back): where the arm's colour ends, the
    // strongest step 3 to 12 px in from its edge, when most rows agree on a steady width
    if (!band) {
      const lum = (/** @type {number} */ x, /** @type {number} */ r) => {
        const c = colors[r * w + x];
        return (c & 255) * 0.3 + ((c >>> 8) & 255) * 0.59 + ((c >>> 16) & 255) * 0.11;
      };
      const found = [];
      for (let r = fromRow; r >= toRow; r--) {
        const run = held.get(r);
        if (!run) continue;
        const e0 = s > 0 ? run[1] : run[0];
        let best = 0,
          inner = -1;
        for (let k = Math.round(3 * A); k <= Math.round(12 * A); k++) {
          const x = e0 - s * k;
          if (!solid(x, r) || !solid(x - s, r)) break;
          const d = Math.abs(lum(x, r) - lum(x - s, r));
          if (d > best) {
            best = d;
            inner = x;
          }
        }
        if (best >= ARM_BAND.step) found.push({ r, c: (e0 + inner) / 2, wd: Math.abs(inner - e0) + 1 });
      }
      const wds = found.map((f) => f.wd).sort((p, q) => p - q),
        md = wds[wds.length >> 1];
      if (
        found.length >= (fromRow - toRow + 1) * 0.6 &&
        wds[wds.length - 1] - wds[0] <= 2 * A &&
        md <= ARM_BAND.max * A
      ) {
        const f = found.find((g) => g.wd === md) ?? found[0];
        band = { row: f.r / A, c: f.c - mid, wd: Math.max(ARM_BAND.min * A, md) };
      }
    }
    return { sh: at(rows[0]), el: at(rows[1]), wa: at(rows[2]), rows: at0, band };
  };
  /** A shaft, not a leg: a staff's run is as narrow a dozen rows over or under it, where a leg has its shin or thigh. */
  const shaft = (/** @type {number} */ r, /** @type {number} */ x0, /** @type {number} */ x1) =>
    [r - sc(12), r + sc(12)].some(
      (q) => q >= 0 && q < h && !runsAt(q).some(([a, b]) => b >= x0 && a <= x1 && b - a + 1 >= legMin),
    );
  /** THE LEGS at a row: the two runs a leg's width nearest the axis, their middles - or one robe, or legs one before
   *  the other, split at its quarters when it is two legs wide - as [left, right] columns off the picture's middle. */
  const legsAt = (/** @type {number} */ r) => {
    const runs = runsAt(r)
      .filter(([x0, x1]) => x1 - x0 + 1 >= 3 && Math.abs((x0 + x1) / 2 - axis) <= bodyOff + 8 * A && !shaft(r, x0, x1))
      .sort((p, q) => Math.abs((p[0] + p[1]) / 2 - axis) - Math.abs((q[0] + q[1]) / 2 - axis));
    if (!runs.length) return null;
    if (runs.length > 1) {
      const [a, b] = [runs[0], runs[1]].sort((p, q) => p[0] - q[0]);
      return [(a[0] + a[1]) / 2 - mid, (b[0] + b[1]) / 2 - mid];
    }
    const [x0, x1] = runs[0],
      wd = x1 - x0 + 1;
    return wd >= 2 * legMin + 2
      ? [x0 + wd / 4 - 0.5 - mid, x1 - wd / 4 + 0.5 - mid]
      : [(x0 + x1) / 2 - mid, (x0 + x1) / 2 - mid];
  };
  /** ARMORY-MIRROR: the body's run's two edges about the sets' row `row`, two rows either side: { row, lo, hi } columns off
   *  the picture's middle - or null. */
  const flankAt = (/** @type {number} */ row) => {
    let lo = 0,
      hi = 0,
      n = 0;
    for (let r = Math.round((row - 2) * A); r <= Math.round((row + 2) * A); r++) {
      const run = runAt(r);
      if (run) {
        lo += run.c - (run.wd - 1) / 2;
        hi += run.c + (run.wd - 1) / 2;
        n++;
      }
    }
    return n ? { row, lo: lo / n - mid, hi: hi / n - mid } : null;
  };
  const read = (/** @type {number} */ k) => ({
    top: topOf(k),
    head: across(MARK_ROWS.head, k, headMin),
    chest: across(MARK_ROWS.chest, k),
    pelvis: across(MARK_ROWS.pelvis, k),
  });
  const own = read(A);
  if (own.chest === null && own.head === null) return null;
  // the arms of a standing figure (a beast's are its own, and wear nothing)
  const cx = mid + (own.chest ?? own.head ?? 0),
    L = arms ? armOf(-1, cx) : null,
    R = arms ? armOf(1, cx) : null;
  const knee = legsAt(Math.round(SPRITE_ROWS.knee * A)),
    ankle = legsAt(Math.round(SPRITE_ROWS.ankle * A));
  // ARMORY-MIRROR: arms not read (a side view) - the body's two edges at the band's row: its near arm hangs at its back
  const flankRow = EOTB_FIGURE.shoulder + (SPRITE_ROWS.elbow - EOTB_FIGURE.shoulder) * ARM_BAND.at,
    flank = arms ? null : flankAt(flankRow);
  return {
    ...own,
    chestHalf: halfOf(MARK_ROWS.chest, A),
    arms: L && R ? { L, R } : null,
    legs: knee && ankle ? { knee, ankle } : null,
    beast: read(EOTB_FIGURE.beast * A),
    art: A,
    flank,
  };
}

const set = (/** @type {Float32Array} */ pts, /** @type {string} */ name, /** @type {ArrayLike<number>} */ v) => {
  const i = POSE_AT[name];
  pts[i] = v[0];
  pts[i + 1] = v[1];
  pts[i + 2] = v[2];
};

/**
 * THE POSE OFF A RIG'S BONES (`bones` as fpArm.thirdBones answers: each bone's origin [right, up, forward] m about the
 * feet, null where its skeleton lacks one), written into `out` - or false when the head or a shoulder is missing, and
 * `out` is left as it was. A bone's origin is its joint: upper arm = shoulder, forearm = elbow, hand = wrist, thigh =
 * hip, calf = knee, foot = ankle. A missing limb bone is the rest pose's point, moved with its shoulder or hip.
 * WOLF-KIT: `beast` - Bloodmoon's wolf has every bone, but thicker limbs and chest: the pose's scale is
 * ARMORY_BEAST_FIT, so a band, a greave and the chest piece sit on the fur, not inside it. Pure but for `out`.
 */
export function poseFromBones(/** @type {any} */ bones, /** @type {any} */ out, beast = false) {
  const H = bones?.['bip01 head'],
    L = bones?.['bip01 l upperarm'],
    R = bones?.['bip01 r upperarm'];
  if (!H || !L || !R) return false;
  const pts = out.pts,
    N = bones['bip01 neck'];
  const ux = N ? H[0] - N[0] : 0,
    uy = N ? H[1] - N[1] : 1,
    uz = N ? H[2] - N[2] : 0,
    ul = Math.hypot(ux, uy, uz) || 1;
  set(pts, 'head', [
    H[0] + (ux / ul) * CLOAK_HEAD_ABOVE,
    H[1] + (uy / ul) * CLOAK_HEAD_ABOVE,
    H[2] + (uz / ul) * CLOAK_HEAD_ABOVE,
  ]);
  set(pts, 'crown', [
    pts[POSE_AT.head] + (ux / ul) * CROWN_ABOVE,
    pts[POSE_AT.head + 1] + (uy / ul) * CROWN_ABOVE,
    pts[POSE_AT.head + 2] + (uz / ul) * CROWN_ABOVE,
  ]);
  set(pts, 'neck', N ?? [(L[0] + R[0]) / 2, (L[1] + R[1]) / 2 + 0.06, (L[2] + R[2]) / 2]);
  set(pts, 'shL', L);
  set(pts, 'shR', R);
  const spine = bones['bip01 spine2'];
  const k = beast ? ARMORY_BEAST_FIT : 1,
    face = beast ? ARMORY_BEAST_CHEST.face : 0.12;
  const drop = beast ? ARMORY_BEAST_CHEST.down : 0;
  set(
    pts,
    'chest',
    beast && spine
      ? [(L[0] + R[0]) / 2, spine[1] - drop, (L[2] + R[2]) / 2 + face]
      : spine
        ? [spine[0], spine[1] - drop, spine[2] + face]
        : [(L[0] + R[0]) / 2, (L[1] + R[1]) / 2 - 0.2, (L[2] + R[2]) / 2 + face],
  ); // the chest's face, a hand forward of the spine (WOLF-KIT: the wolf's deeper)
  const hang = (
    /** @type {string} */ name,
    /** @type {any} */ v,
    /** @type {string} */ from,
    /** @type {ArrayLike<number>} */ root,
  ) => {
    if (v) {
      set(pts, name, v);
      return;
    }
    const r = POSE_AT[from],
      i = POSE_AT[name];
    set(pts, name, [
      root[0] + REST_POINTS[i] - REST_POINTS[r],
      root[1] + REST_POINTS[i + 1] - REST_POINTS[r + 1],
      root[2] + REST_POINTS[i + 2] - REST_POINTS[r + 2],
    ]);
  };
  hang('elL', bones['bip01 l forearm'], 'shL', L);
  hang('elR', bones['bip01 r forearm'], 'shR', R);
  hang('waL', bones['bip01 l hand'], 'shL', L);
  hang('waR', bones['bip01 r hand'], 'shR', R);
  const pelvis = bones['bip01 pelvis'];
  set(
    pts,
    'pelvis',
    pelvis ?? [REST_POINTS[POSE_AT.pelvis], REST_POINTS[POSE_AT.pelvis + 1], REST_POINTS[POSE_AT.pelvis + 2]],
  );
  const pv = [pts[POSE_AT.pelvis], pts[POSE_AT.pelvis + 1], pts[POSE_AT.pelvis + 2]];
  hang('hipL', bones['bip01 l thigh'], 'pelvis', pv);
  hang('hipR', bones['bip01 r thigh'], 'pelvis', pv);
  hang('knL', bones['bip01 l calf'], 'pelvis', pv);
  hang('knR', bones['bip01 r calf'], 'pelvis', pv);
  hang('ftL', bones['bip01 l foot'], 'pelvis', pv);
  hang('ftR', bones['bip01 r foot'], 'pelvis', pv);
  out.card = false;
  out.limbs = 'full';
  out.sunk = false;
  out.scale = k;
  out.back = beast ? ARMORY_BEAST_CHEST.back : 0;
  out.arm = beast ? ARMORY_BEAST_ARM.arm : 1;
  out.hock = beast;
  out.dx.fill(0);
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
  const art = fig.marks?.art > 0 ? fig.marks.art : 1; // a record drawn at another scale: the sets' rows in its pixels (spriteMarks)
  const m = fig.mpp * (fig.beast === true ? EOTB_FIGURE.beast : 1) * art,
    at = (/** @type {number} */ px) => fig.base + px * m,
    x = (/** @type {number} */ px) => px * m;
  const R = SPRITE_ROWS,
    pts = out.pts,
    half = (CLOAK_SHOULDER_HALF * m) / EOTB_FIGURE.mpp; // the shoulders as the cape's are (auraSpriteBones)
  // the picture's own marks (spriteMarks), where they were read: the head's top and the body's middle across the card
  const mk = fig.marks ? (fig.beast === true ? fig.marks.beast : fig.marks) : null,
    k = (fig.beast === true ? EOTB_FIGURE.beast : 1) * art;
  const headY = Number.isFinite(mk?.top)
    ? fig.base + (mk.top / k - HEAD_TOP_PX) * m
    : at(EOTB_FIGURE.head) + (CLOAK_HEAD_ABOVE * m) / EOTB_FIGURE.mpp;
  set(pts, 'head', [0, headY, 0.01]);
  set(pts, 'crown', [0, pts[POSE_AT.head + 1] + (CROWN_ABOVE * m) / EOTB_FIGURE.mpp, 0.01]);
  set(pts, 'neck', [0, at(EOTB_FIGURE.neck), 0]);
  set(pts, 'chest', [0, at(R.chest), (R.chestFwd * m) / EOTB_FIGURE.mpp]);
  set(pts, 'pelvis', [0, at(R.pelvis), 0]);
  set(pts, 'shL', [-half, at(EOTB_FIGURE.shoulder), 0]);
  set(pts, 'shR', [half, at(EOTB_FIGURE.shoulder), 0]);
  set(pts, 'elL', [-x(R.elbowOut), at(R.elbow), 0]);
  set(pts, 'elR', [x(R.elbowOut), at(R.elbow), 0]);
  set(pts, 'waL', [-x(R.wristOut), at(R.wrist), 0.02]);
  set(pts, 'waR', [x(R.wristOut), at(R.wrist), 0.02]);
  set(pts, 'hipL', [-x(R.hipOut), at(R.hip), 0]);
  set(pts, 'hipR', [x(R.hipOut), at(R.hip), 0]);
  set(pts, 'knL', [-x(R.hipOut) * 1.1, at(R.knee), 0.02]);
  set(pts, 'knR', [x(R.hipOut) * 1.1, at(R.knee), 0.02]);
  set(pts, 'ftL', [-x(R.hipOut) * 1.1, at(R.ankle), -0.02]);
  set(pts, 'ftR', [x(R.hipOut) * 1.1, at(R.ankle), -0.02]);
  const shift = Number.isFinite(fig.shift) ? fig.shift : 0,
    off = (/** @type {number|null|undefined} */ v) =>
      shift + (Number.isFinite(v) ? /** @type {number} */ (v) * fig.mpp : 0);
  const head = off(mk?.head),
    chest = off(mk?.chest ?? mk?.head),
    pelvis = off(mk?.pelvis ?? mk?.chest);
  for (const n of POSE_POINTS)
    out.dx[POSE_AT[n] / 3] = ['head', 'crown', 'neck'].includes(n)
      ? head
      : ['chest', 'shL', 'shR', 'elL', 'elR', 'waL', 'waR'].includes(n)
        ? chest
        : pelvis;
  // the arms where the picture draws them (spriteMarks' arms - a beast's marks carry none): across the card, as the
  // picture is seen from any side
  const arms = mk?.arms;
  if (arms) {
    for (const S of /** @type {const} */ (['L', 'R'])) {
      const a = arms[S];
      set(pts, `sh${S}`, [0, at(a.rows[0]), 0]);
      set(pts, `el${S}`, [0, at(a.rows[1]), 0]);
      set(pts, `wa${S}`, [0, at(a.rows[2]), 0.02]);
      out.dx[POSE_AT[`sh${S}`] / 3] = off(a.sh);
      out.dx[POSE_AT[`el${S}`] / 3] = off(a.el);
      out.dx[POSE_AT[`wa${S}`] / 3] = off(a.wa);
    }
  }
  // the knees and the feet where the picture stands them, a stride's front leg and back leg included
  const legs = mk?.legs;
  if (legs) {
    ['L', 'R'].forEach((S, i) => {
      set(pts, `kn${S}`, [0, at(R.knee), 0.02]);
      set(pts, `ft${S}`, [0, at(R.ankle), -0.02]);
      out.dx[POSE_AT[`kn${S}`] / 3] = off(legs.knee[i]);
      out.dx[POSE_AT[`ft${S}`] / 3] = off(legs.ankle[i]);
    });
  }
  out.card = true;
  out.limbs = 'upper';
  out.sunk = at(EOTB_FIGURE.shoulder) < CLOAK_SHOULDER_Y * 0.4;
  out.scale = m / EOTB_FIGURE.mpp;
  out.back = 0;
  out.arm = 1;
  out.hock = false;
  out.armsTurned = !arms; // ARMORY-MIRROR: no arms read - the sets' rows turned with the body, its own sides (armoryPass.js armletSide)
  // ARMORY-MIRROR: each arm's band where the picture paints it clear of the body: its height, its offset across, its width (m)
  const bandOf = (/** @type {any} */ b) => (b ? { y: at(b.row), dx: off(b.c), w: b.wd * fig.mpp } : null);
  out.bands = arms ? { L: bandOf(arms.L.band), R: bandOf(arms.R.band) } : null;
  // and a side view's: half an arm in from each edge of the body, the near arm at whichever is its back (armoryPass.js)
  const fl = arms ? null : mk?.flank,
    armHalf = ARM_PX.half * art;
  out.flank = fl ? { y: at(fl.row), lo: off(fl.lo + armHalf), hi: off(fl.hi - armHalf) } : null;
  // AUDIT AURA-PIXEL D2: the body's run across the card at the chest's rows, its two edges (m) - the back's span
  out.chestSpan = mk?.chest != null && mk?.chestHalf != null ? [off(mk.chest - mk.chestHalf), off(mk.chest + mk.chestHalf)] : null;
  return true;
}

/** THE REST POSE written into `out`, pressed down to `crouch` (the body's height over its standing height, 1 standing)
 *  and lifted onto a saddle for a rider. Pure but for `out`. */
export function poseAtRest(/** @type {any} */ out, crouch = 1, mounted = false) {
  const k = Number.isFinite(crouch) ? Math.max(0.4, Math.min(1, crouch)) : 1,
    lift = mounted ? AURA_SADDLE_M : 0;
  for (let i = 0; i < REST_POINTS.length; i += 3) {
    out.pts[i] = REST_POINTS[i];
    out.pts[i + 1] = REST_POINTS[i + 1] * k + lift;
    out.pts[i + 2] = REST_POINTS[i + 2];
  }
  out.card = false;
  out.limbs = 'full';
  out.sunk = false;
  out.scale = k;
  out.back = 0;
  out.arm = 1;
  out.hock = false;
  out.dx.fill(0);
  return out;
}

/** A pose's point in the world: the wearer's feet `at` and facing `yaw` (forward (sin, cos) in x, z - the aura's own
 *  law, auraRing.js auraWingLights) and, on a sprite, its offset along the card's right (`right`, the billboard's) -
 *  into `o` at `o3`. Pure but for `o`. */
export function poseWorld(
  /** @type {any} */ pose,
  /** @type {string} */ name,
  /** @type {ArrayLike<number>} */ at,
  /** @type {number} */ yaw,
  /** @type {Float32Array|number[]} */ o,
  o3 = 0,
  /** @type {ArrayLike<number>|null} */ right = null,
) {
  const i = POSE_AT[name],
    p = pose.pts,
    c = Math.cos(yaw),
    s = Math.sin(yaw),
    d = right && pose.dx ? pose.dx[i / 3] : 0;
  o[o3] = at[0] + c * p[i] + s * p[i + 2] + (d ? right[0] * d : 0);
  o[o3 + 1] = at[1] + p[i + 1];
  o[o3 + 2] = at[2] - s * p[i] + c * p[i + 2] + (d ? right[2] * d : 0);
  return o;
}
