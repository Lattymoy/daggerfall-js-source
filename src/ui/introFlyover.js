// ═══════════════════════════════════════════════════════════════════
// THE INTRO FLYOVER — the Iliac Bay from the air, drawn the way 1996
// would have drawn it.
//
// ── WHY VOXEL SPACE AND NOT A MESH ───────────────────────────────
//
// This could have been a WebGL heightfield. It is a VOXEL-SPACE ray
// walk instead - the Comanche/Magic Carpet technique - for four reasons
// and the last one is the real one:
//
//   1. It needs no renderer. The enhanced door is DOM and CSS and mounts
//      before anything WebGL exists; ui/pixelGround.js already draws the
//      menu's sky into a 2D canvas and this is the same shape of thing.
//   2. It is O(columns x steps) with no geometry, no upload, no shader
//      compile - so it costs nothing at boot, which is the one moment
//      the player is actually waiting.
//   3. Its output is ALREADY the aesthetic. A per-column span fill on a
//      low-resolution buffer is chunky by construction; a mesh has to be
//      talked into looking like this.
//   4. Daggerfall shipped in 1996 and this is what flying over terrain
//      looked like in 1996. The port rebuilds classic's presentation on
//      our own stack everywhere else; here the period technique IS the
//      presentation, and choosing it is the same kind of call as scoring
//      the menu with an FM bank because the game was written for OPL.
//
// ── HOW IT DRAWS ─────────────────────────────────────────────────
//
// Back to front, far to near, with a per-column Y-BUFFER holding the
// highest pixel written in that column. For each distance step the ray
// pair's endpoints are interpolated across the screen's width; each
// column samples the map, projects its height to a screen row, and
// fills from there UP to the y-buffer. Nearer steps overwrite less
// because the buffer has already climbed - that is the whole hidden
// surface algorithm, and it is why this runs on a phone.
//
// ── FOUR DEFECTS THE FIRST BUILD HAD, AND WHAT EACH ONE WAS ──────
//
// Recorded because three of them are inherent to the technique and the
// next person to touch this will meet them again.
//
// THE PICKET FENCE. Ridges at distance grew vertical spikes. The step
// grows with z, so a far step strides several map cells and takes
// whichever peak it lands on - a point sample of a field with detail
// finer than the sample spacing, which is aliasing and not a drawing
// bug. The cure is the MIP PYRAMID below: pick the level whose cells
// are about the size of the step and the ridge line is resolved rather
// than sampled.
//
// THE CURTAINS. Vertical smears of mountain colour down one side. The
// camera was INSIDE the terrain - the map's peaks reach past 240 and
// the path asked for 120 - so a cell one step away projected across the
// whole screen. `clearedZ` is the fix, and it is also just true: a
// flyover flies over.
//
// THE PLAID. The sea read as a tablecloth. Two crossed sines at fixed
// world frequencies ARE a grid, and no tuning of their amplitudes
// changes that. The sea is drawn from the SPECULAR GEOMETRY now - from
// where the mirrored sun actually falls - and the waves only break that
// path up.
//
// THE COST. 82 ms a frame, and almost none of it was the ray walk: it
// was a Math.hypot per pixel for the sun's glow and a per-pixel sky
// fill. The sky is one colour per ROW copied across, and the glow runs
// in a bounding box on squared distance. MEASURE BEFORE OPTIMISING -
// the ray walk was never the problem and rewriting it would have cost a
// day and bought nothing.
//
// ── DITHER THEN QUANTISE, NEVER ONE WITHOUT THE OTHER ────────────
//
// The final colour is posterised to LEVELS steps per channel through a
// 4x4 Bayer threshold keyed to SCREEN position. An ordered dither's job
// is pushing a pixel ACROSS a band boundary so a small palette buys a
// big range - with no quantisation under it it is only noise, and with
// no dither over it the sky bands. Both, or neither.
// ═══════════════════════════════════════════════════════════════════

import { SEA_LEVEL } from './introMap.js';

/** One art pixel is this many CSS pixels. Same idea as pixelGround's
 *  SCALE, one step finer because this buffer carries a horizon and a
 *  4-pixel stair on a coastline is visible where it is not on a fog
 *  blob. THE PIXEL IS SQUARE BY CONSTRUCTION: the backing store is
 *  derived from the viewport, never a fixed size. */
export const SCALE = 3;

/** Posterisation steps per channel, and the Bayer matrix over them. */
export const LEVELS = 11;
export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** The ray walk. NEAR is under the camera, FAR is the fog wall, and the
 *  step multiplies by STEP_GROWTH each iteration so the sample count is
 *  logarithmic in distance rather than linear. */
export const NEAR = 1.0;
export const FAR = 2600;
export const STEP_NEAR = 0.55;
export const STEP_GROWTH = 1.018;

/** How far above the ground the camera is held, in height units. The
 *  path asks for an altitude; this is the floor under that ask. */
export const CLEARANCE = 26;

/** How much of its own colour the furthest land keeps. */
export const FOG_MAX = 0.66;

/** Where the haze starts, as a multiple of the camera's height above
 *  the sea, and how far past that it takes to saturate.
 *
 *  A MULTIPLE, NOT A DISTANCE, and this is the second time this
 *  renderer has been caught measuring the wrong thing. With a fixed
 *  start the low half of the flight looked right and every frame from
 *  the climb onward came back a flat warm wash - because from altitude
 *  EVERYTHING visible is far away, so a distance-keyed fog puts the
 *  entire picture past its own saturation point. Haze is optical depth
 *  through the lower air: climb, and you look through less of it. */
export const FOG_START_K = 2.6;
export const FOG_SPAN_K = 3.4;

/** And the FLOORS under those multiples, for the low run.
 *
 *  The first pair was 90 and 140, which sounds generous until you work
 *  out what `eye` actually is down there: the flight crosses the bay at
 *  z 34-44 against a sea floor of 46, so clearedZ holds it at 72 and
 *  the eye is TWENTY-SIX units above the water. The multiples are far
 *  below the floors at that height, so the floors ARE the fog - and at
 *  90/140 the haze saturated 230 units out, which is the middle of the
 *  picture. Both shores went the colour of the sky and the flight lost
 *  every green it had. */
export const FOG_START_MIN = 165;
export const FOG_SPAN_MIN = 260;

/** ...and CEILINGS over them, for the top of the climb.
 *
 *  The altitude-relative model is right for looking DOWN and wrong for
 *  the long shallow slant a wide-angle camera takes at 600 units up:
 *  eye * 2.6 puts the haze start at 1500, past most of what is on
 *  screen, and the final reveal came back with a two-thousand-unit view
 *  in perfectly crisp air. Real distance is what carries scale in that
 *  shot, so the multiple is allowed to raise the start but not to
 *  switch the haze off. */
export const FOG_START_MAX = 420;
export const FOG_SPAN_MAX = 700;

/** How far past the map's edge the land takes to sink and vanish, in
 *  cells.
 *
 *  THE STREAKS. Clamping is right at the west edge, where the repeated
 *  cell is deep ocean and the Eltheric simply continues - but at the
 *  NORTH and SOUTH edges the repeated cell is mountain, and a whole
 *  scanline of one mountain cell is a horizontal BAND. The wide reveal
 *  came back with the Iliac Bay correct in the middle and bright
 *  snow-coloured stripes filling both thirds of the frame.
 *
 *  So beyond the map the land TAPERS to the sea floor and the haze
 *  closes over it. That is not a claim that High Rock ends there - it
 *  is the honest statement that this generator has nothing further to
 *  say, drawn as distance rather than as a wall or a stripe. */
export const EDGE_TAPER = 260;

/** What the world outside the map is made of. The height taper alone
 *  sank the land to the sea floor and left it wearing the EDGE CELL'S
 *  COLOUR - so the province came back ringed by a flat tan plane of
 *  mountain-coloured water. Colour has to taper with height or only
 *  half the surface has been changed. */
export const OCEAN = [24, 50, 76];

/**
 * How far a sample outside the map has faded to open sea: 0 on the
 * edge, 1 at EDGE_TAPER world units beyond it.
 *
 * `over` is in the CURRENT MIP LEVEL's cells and `sc` is that level's
 * world-to-cell scale (1/2^level), so the conversion to world units
 * DIVIDES by sc. Pulled out as its own function because getting that
 * backwards is exactly what happened - multiplying made the taper
 * eight times too weak at the coarse levels, which is precisely where
 * the streaks live, so the fix looked like it had done nothing and the
 * bands came back identical. Pure, and pinned at a coarse level on
 * purpose.
 */
export function edgeFade(over, sc, taper = EDGE_TAPER) {
  if (over <= 0) return 0;
  const k = (over / sc) / taper;
  return k >= 1 ? 1 : k;
}

/** The sun, as a compass bearing in radians and an elevation (rise over
 *  run, not an angle). Low and in the east: the intro is a DAWN, which
 *  is the hour that gives the bay its glitter path and puts every ridge
 *  in relief.
 *
 *  THE ELEVATION AND THE ALTITUDE ARE ONE DIAL, NOT TWO. The sun's
 *  image sits at distance eye/SUN_ELEVATION, so at 0.15 with a camera
 *  130 above the sea the glitter path is 870 units out - past FAR, off
 *  the picture, and the sea came back a flat wash with the code working
 *  exactly as written. Raising the sun brings the path INTO frame; the
 *  camera path (introCue.js) flies low for the same reason. Change
 *  either and check the other. */
export const SUN_BEARING = 0.18;
export const SUN_ELEVATION = 0.26;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) => a + (b - a) * t;

// ── THE WAVE TABLE ─────────────────────────────────────────────────
//
// The sea's swell was three sines and a cosine PER WATER PIXEL, and on
// the frames where the bay fills the screen that was ~500,000
// transcendentals a frame and 29 of the frame's 30 ms. The waves are a
// function of world position and time only, and they TILE - so they are
// a table, rebuilt once a frame at WAVE_N^2 cost and read with two ands
// and an index after that.
//
// The table's period must be an INTEGER number of cycles of every wave
// in it or the join shows as a seam marching across the water. WAVE_K
// is that period in world units, and the frequencies below are whole
// multiples of 2*PI/WAVE_K by construction rather than by tuning.
export const WAVE_N = 128;
/** World units the tile spans. 128 put the whole repeat inside a
 *  single shot and the sea read as a lava lamp - the same soft blob
 *  three times across the bay. 384 moves the repeat outside any frame
 *  the flight actually holds; the detail that costs is bought back by
 *  sampling the SAME table twice at different scales (see WAVE_DETAIL),
 *  which is an extra array read rather than a bigger table. */
export const WAVE_K = 384;
/** The second, finer sample's scale. Irrational-ish on purpose: a whole
 *  multiple would put both samples' repeats on top of each other and
 *  reinstate the pattern it is here to break. */
export const WAVE_DETAIL = 3.37;

/** The wave spectrum: integer (kx, ky) pairs so every component wraps
 *  the tile, an amplitude and a speed.
 *
 *  EVERY PAIR IS DIAGONAL, AND THAT IS THE WHOLE POINT. The first
 *  build used sin(x)*cos(y) - a SEPARABLE product, which is not a wave
 *  at all, it is a CHECKERBOARD, and the sea came back as a tablecloth
 *  twice before the reason was read rather than re-tuned. A travelling
 *  wave is sin(kx*x + ky*y - w*t) with kx and ky both non-zero, and a
 *  sea is a sum of them at incommensurate angles. */
export const WAVE_SPECTRUM = Object.freeze([
  { kx: 3, ky: 1, amp: 1.00, spd: 1.7 },
  { kx: -2, ky: 3, amp: 0.62, spd: 1.15 },
  { kx: 5, ky: -2, amp: 0.40, spd: 2.30 },
  { kx: 1, ky: 4, amp: 0.30, spd: 0.85 },
  { kx: 7, ky: 3, amp: 0.20, spd: 3.10 },
]);

/** Fill `out` (WAVE_N^2 floats) with the swell at time `t`, normalised
 *  to roughly -1..1. Exported so a test can pin that it TILES - the
 *  last column must join the first, or the sea has a seam marching
 *  across it. */
export function waveTable(out, t) {
  const s = (2 * Math.PI) / WAVE_N;
  let norm = 0;
  for (const c of WAVE_SPECTRUM) norm += c.amp;
  const inv = 1 / norm;
  for (let j = 0; j < WAVE_N; j++) {
    const y = j * s;
    for (let i = 0; i < WAVE_N; i++) {
      const x = i * s;
      let v = 0;
      for (const c of WAVE_SPECTRUM) v += c.amp * Math.sin(c.kx * x + c.ky * y - c.spd * t);
      out[j * WAVE_N + i] = v * inv;
    }
  }
  return out;
}

/** exp(-u) for u in 0..8, as a table. The glitter's falloff is the only
 *  exp left in the inner loop and it is called once per lit water
 *  pixel. 512 entries is finer than the posteriser can show. */
const EXP_N = 512, EXP_MAX = 8;
const EXP_TAB = new Float32Array(EXP_N + 1);
for (let i = 0; i <= EXP_N; i++) EXP_TAB[i] = Math.exp(-(i / EXP_N) * EXP_MAX);
const expNeg = (u) => (u >= EXP_MAX ? 0 : EXP_TAB[(u * (EXP_N / EXP_MAX)) | 0]);

const WAVE = new Float32Array(WAVE_N * WAVE_N);
/** Per-row sky reflection, rebuilt each frame. Grown on demand so a
 *  resize does not reallocate every frame. */
let REFL = new Float32Array(3 * 1080);

/** The sky, top to horizon, at dawn. Three stops rather than a ramp
 *  table: this is one moment of one day, not a clock. */
export const SKY_TOP = [22, 34, 70];
export const SKY_MID = [92, 100, 132];
export const SKY_HORIZON = [222, 172, 126];
export const SUN_GLOW = [255, 220, 158];

/**
 * The sky colour for a screen row, before dither.
 * `v` is 0 at the top of the buffer and 1 at the horizon row; beyond
 * the horizon it clamps, which is what the sea reflects.
 * Pure, so it is pinned directly.
 */
export function skyColour(v, out = [0, 0, 0]) {
  const t = clamp01(v);
  if (t < 0.62) {
    const k = t / 0.62;
    out[0] = mix(SKY_TOP[0], SKY_MID[0], k);
    out[1] = mix(SKY_TOP[1], SKY_MID[1], k);
    out[2] = mix(SKY_TOP[2], SKY_MID[2], k);
  } else {
    // Cubed, not linear: the warm band has to HUG the horizon or the
    // whole upper sky washes and it reads as a sunset instead of a dawn.
    const k = (t - 0.62) / 0.38;
    const kk = k * k * k;
    out[0] = mix(SKY_MID[0], SKY_HORIZON[0], kk);
    out[1] = mix(SKY_MID[1], SKY_HORIZON[1], kk);
    out[2] = mix(SKY_MID[2], SKY_HORIZON[2], kk);
  }
  return out;
}

/**
 * The camera's basis in world space, from its yaw.
 *
 * THESE TWO VECTORS ARE THE RAY WALK'S OWN, DERIVED FROM IT AND NOT
 * RESTATED. The scanline's midpoint at distance z is
 *   ( -sin(yaw)*halfW*z + x , -cos(yaw)*halfW*z + y )
 * so FORWARD is (-sin, -cos) and RIGHT is (cos, -sin).
 *
 * They exist because the first build placed the sun's disc with
 * `tan(yaw - SUN_BEARING)`, which is a DIFFERENT ANGLE CONVENTION from
 * the one the walk uses - so the drawn sun and the sun the water and
 * the hillsides were lit by were two different suns, tens of degrees
 * apart. Every glitter-path symptom chased before that was found was a
 * symptom of it: the path was being computed correctly, for a sun that
 * was not where the picture said it was. One basis, both uses.
 */
export function basis(yaw) {
  const s = Math.sin(yaw), c = Math.cos(yaw);
  return { fx: -s, fy: -c, rx: c, ry: -s };
}

/**
 * Where a world DIRECTION lands on screen, in buffer pixels, or null
 * when it is behind the camera. Pure, and pinned against basis().
 */
export function projectDirection(dx, dy, yaw, W, scaleH) {
  const { fx, fy, rx, ry } = basis(yaw);
  const ahead = dx * fx + dy * fy;
  if (ahead <= 1e-4) return null;                 // behind, or on the edge
  return W * 0.5 + ((dx * rx + dy * ry) / ahead) * scaleH;
}

/**
 * Fit the camera's projection to the buffer.
 * `fov` is the horizontal half-angle; the vertical scale follows from
 * the buffer's WIDTH so the picture does not stretch when the window
 * does - the law ui/pixelGround.js learned on a portrait phone.
 */
export function projection(W, H, fov = DEFAULT_FOV) {
  const halfW = Math.tan(fov);
  return { halfW, scaleH: (W * 0.5) / halfW };
}

/** The default half-angle, and the one the whole low run flies at. */
export const DEFAULT_FOV = 0.62;

// ── THE MIP PYRAMID ────────────────────────────────────────────────

/**
 * Build averaged half-resolution levels of the heightmap and colourmap.
 * Level 0 is the map itself; each further level is a 2x2 box average.
 *
 * AVERAGED, NOT MAXED, and the difference is visible: a max pyramid
 * GROWS distant ridges - every level takes the tallest peak in its cell,
 * so a range gets taller the further away it is, which is the picket
 * fence again wearing a different face.
 *
 * Call ONCE per map; drawFlyover then allocates nothing per frame.
 */
export function prepareMap(map, levels = 5) {
  const mips = [{ w: map.w, h: map.h, height: map.height, colour: map.colour }];
  for (let l = 1; l < levels; l++) {
    const p = mips[l - 1];
    const w = Math.max(1, p.w >> 1), h = Math.max(1, p.h >> 1);
    const height = new Uint8Array(w * h);
    const colour = new Uint8Array(w * h * 3);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const a = (y * 2) * p.w + x * 2, b = a + 1, c = a + p.w, d = c + 1;
        height[y * w + x] = (p.height[a] + p.height[b] + p.height[c] + p.height[d] + 2) >> 2;
        for (let k = 0; k < 3; k++) {
          colour[(y * w + x) * 3 + k] =
            (p.colour[a * 3 + k] + p.colour[b * 3 + k] + p.colour[c * 3 + k] + p.colour[d * 3 + k] + 2) >> 2;
        }
      }
    }
    mips.push({ w, h, height, colour });
  }
  return { levels: mips, w: map.w, h: map.h };
}

/** The mip level whose cells are about the size of the ray's step.
 *  Pure and pinned: this is the whole picket-fence cure in one line. */
export function mipFor(step, count) {
  let l = 0;
  while (l < count - 1 && step > 1.5 * (1 << l)) l++;
  return l;
}

/** The ground height under a world point, from level 0. */
export function groundAt(prepared, x, y) {
  const m = prepared.levels[0];
  const mx = Math.max(0, Math.min(m.w - 1, x | 0));
  const my = Math.max(0, Math.min(m.h - 1, y | 0));
  return m.height[my * m.w + mx];
}

/** The camera's actual altitude: what the path asked for, or the rock
 *  under it plus CLEARANCE, whichever is higher. */
export function clearedZ(prepared, cam) {
  return Math.max(cam.z, groundAt(prepared, cam.x, cam.y) + CLEARANCE);
}

/**
 * Draw one frame.
 *
 * `prepared` from prepareMap()
 * `cam`      { x, y, z, yaw, horizon }
 *
 * `horizon` is the horizon line's row as a fraction of the buffer
 * height, and it is THE PITCH CONTROL: smaller looks down (more
 * ground), larger looks up (more sky). It is not clamped to 0..1 and
 * must not be - a value below 0 puts the horizon off the top of the
 * frame, which is a legitimate near-vertical look down.
 * `t`        seconds - drives the water only; the land is static
 * `target`   an ImageData-like { data, width, height }
 */
export function drawFlyover(target, prepared, cam, t = 0) {
  const W = target.width, H = target.height;
  const px = target.data;
  if (REFL.length < H * 3) REFL = new Float32Array(H * 3);
  // ONE WORD PER PIXEL, NOT FOUR BYTES. The buffer is a
  // Uint8ClampedArray, and every store through it costs a clamp; the
  // sky pass and the span fills together write about a quarter of a
  // million pixels a frame, which was a million clamped stores. A
  // Uint32Array over the SAME memory writes each pixel once, unclamped,
  // and the colours are clamped ONCE where they are computed instead of
  // four times where they are stored. Little-endian byte order is
  // 0xAABBGGRR, which is why the packing looks backwards.
  const u32 = new Uint32Array(px.buffer, px.byteOffset, W * H);
  // THE FIELD OF VIEW IS THE CAMERA'S, NOT A CONSTANT, AND IT IS WHAT
  // MAKES THE FINAL REVEAL POSSIBLE. Altitude alone cannot show a whole
  // province in a shear-pitched renderer: climbing pushes the near
  // ground off the BOTTOM of the frame as fast as it brings the far
  // ground down from the top, so a very high camera sees an annulus of
  // one distance, not everything below it. Widening the angle is what
  // actually pulls the world into frame - scaleH falls, every sy
  // collapses toward the horizon, and the visible depth goes from a few
  // hundred units to a few thousand.
  const { halfW, scaleH } = projection(W, H, cam.fov ?? DEFAULT_FOV);
  const horizonY = cam.horizon * H;
  const camZ = clearedZ(prepared, cam);

  // ── THE SKY, drawn FIRST and whole ──────────────────────────────
  // The ray walk only ever writes upward from the y-buffer, so a column
  // whose land never rises would keep the previous frame. Sky first is
  // one pass and removes the whole class.
  //
  // ONE COLOUR PER ROW, copied across: the sky is a function of the row
  // alone, so a per-pixel evaluation did W times the work for the same
  // answer - which was half this renderer's frame cost.
  const sky = [0, 0, 0];
  for (let y = 0; y < H; y++) {
    const mv = clamp01(1 - (y - horizonY) / Math.max(1, H - horizonY) * 0.5);
    skyColour(mv, sky);
    REFL[y * 3] = sky[0]; REFL[y * 3 + 1] = sky[1]; REFL[y * 3 + 2] = sky[2];
  }

  for (let y = 0; y < H; y++) {
    // ABOVE the horizon, the sky's own ramp. BELOW it, the HAZE ramp -
    // which is not the same thing and had been clamping to one colour.
    // In the wide reveal the horizon line sits five pixels from the top
    // of the frame, so `y / horizonY` exceeds 1 almost everywhere and
    // the clamp painted a flat tan rectangle across everything the ray
    // walk could not reach past FAR. Continuing REFL's ramp instead
    // makes that region indistinguishable from very distant hazy sea,
    // which is what it is.
    if (y <= horizonY) skyColour(y / Math.max(1, horizonY), sky);
    else { sky[0] = REFL[y * 3]; sky[1] = REFL[y * 3 + 1]; sky[2] = REFL[y * 3 + 2]; }
    const word = 0xff000000 | ((sky[2] & 255) << 16) | ((sky[1] & 255) << 8) | (sky[0] & 255);
    u32.fill(word, y * W, y * W + W);
  }

  // The sun: a bright core in a wide flattened haze, ADDED rather than
  // mixed so it reads as light. Bounded box, squared distance, no
  // hypot - a hypot per pixel here cost more than the entire ray walk.
  const sunX = projectDirection(Math.cos(SUN_BEARING), Math.sin(SUN_BEARING), cam.yaw, W, scaleH);
  if (sunX !== null) {
    const sunY = horizonY - SUN_ELEVATION * scaleH;
    const glowR = W * 0.32, coreR = W * 0.030;
    const glowR2 = glowR * glowR, coreR2 = coreR * coreR;
    const gy0 = Math.max(0, (sunY - glowR) | 0), gy1 = Math.min(H, (sunY + glowR) | 0);
    const gx0 = Math.max(0, (sunX - glowR) | 0), gx1 = Math.min(W, (sunX + glowR) | 0);
    for (let y = gy0; y < gy1; y++) {
      const dy = (y - sunY) * 1.55;              // haze spreads sideways
      const dy2 = dy * dy;
      for (let x = gx0; x < gx1; x++) {
        const dx = x - sunX;
        const d2 = dx * dx + dy2;
        if (d2 >= glowR2) continue;
        const f = 1 - d2 / glowR2;
        // Quartic, and the CORE IS A RAMP not a step - a flat white
        // disc on a dithered sky reads as a hole punched in the
        // picture, which is what the first build looked like.
        // THE CORE IS BIG AND ITS EDGE IS SOFT. At a 6-pixel radius
        // and full strength the sun read as a stuck pixel cluster - the
        // eye needs a disc with a bloom, not a dot with a gradient
        // behind it. sqrt on the falloff keeps the middle flat and lets
        // it go at the rim, which is what a bright disc through haze
        // actually does.
        let k = f * f * f * f * 0.50 + f * f * 0.16;
        const core = d2 < coreR2 ? Math.sqrt(1 - d2 / coreR2) * 0.95 : 0;
        k += core;
        const o = (y * W + x) * 4;
        // The core is held back in BLUE. Adding a warm colour at full
        // strength still clips to pure white once every channel
        // saturates, and a white disc at dawn reads as a moon - the
        // warmth has to survive the clip, so blue takes less of it.
        px[o] = px[o] + SUN_GLOW[0] * k;
        px[o + 1] = px[o + 1] + SUN_GLOW[1] * k - core * 26;
        px[o + 2] = px[o + 2] + SUN_GLOW[2] * k - core * 74;
      }
    }
  }

  // ── THE RAY WALK ────────────────────────────────────────────────
  // (REFL - the per-row sky, which the sea reflects and the haze is
  // made of - is built above, before the sky fill that now needs it.)
  const yBuf = new Int32Array(W).fill(H);
  // How many columns still have sky in them. FAR had to triple for the
  // final reveal, and walking every step to 1800 on the LOW shots -
  // where a ridge two hundred units out fills the screen - would be
  // paying for the wide shot on every frame that is not the wide shot.
  // When no column has room left, nothing further away can be seen and
  // the walk is over.
  let openCols = W;
  const sinY = Math.sin(cam.yaw), cosY = Math.cos(cam.yaw);
  const nLevels = prepared.levels.length;
  const sunCos = Math.cos(SUN_BEARING), sunSin = Math.sin(SUN_BEARING);
  // THE FOG COLOUR IS PER-ROW, NOT ONE COLOUR. Hazing everything
  // toward SKY_HORIZON is right AT the horizon and wrong everywhere
  // else, and the wide reveal is where that stops being a subtlety:
  // with the horizon line near the top of the frame, almost the whole
  // picture is far-away sea, and a single warm fog colour turned the
  // Eltheric into a flat tan plane. Aerial perspective takes the
  // colour of the light scattered along the path, which is warm toward
  // the sun's horizon and cool looking down - which is exactly the
  // ramp REFL already holds, so the fog reads out of the same table
  // the water reflects.
  const eye = camZ - SEA_LEVEL;
  waveTable(WAVE, t);
  const waveScale = WAVE_N / WAVE_K;
  const waveScale2 = waveScale * WAVE_DETAIL;
  const fogStart = Math.min(FOG_START_MAX, Math.max(FOG_START_MIN, eye * FOG_START_K));
  const fogSpan = Math.min(FOG_SPAN_MAX, Math.max(FOG_SPAN_MIN, eye * FOG_SPAN_K));

  let z = NEAR, step = STEP_NEAR;
  while (z < FAR) {
    const lvl = mipFor(step, nLevels);
    const m = prepared.levels[lvl];
    const mw = m.w, mh = m.h, mhh = m.height, mc = m.colour;
    const sc = 1 / (1 << lvl);                    // world -> this level's cells

    const lx = (-cosY - sinY) * halfW * z + cam.x;
    const ly = (sinY - cosY) * halfW * z + cam.y;
    const rx = (cosY - sinY) * halfW * z + cam.x;
    const ry = (-sinY - cosY) * halfW * z + cam.y;
    const dx = (rx - lx) / W, dy = (ry - ly) / W;
    let wx = lx, wy = ly;

    const invZ = scaleH / z;
    // FOG STARTS LATE AND NEVER CLOSES. Beginning at 0.28*FAR and
    // saturating at 1.0 put the entire second half of the flight -
    // every frame the title sits over - inside a flat warm wash, with
    // the ranges dissolved and the bay invisible. Haze should carry
    // DEPTH, which means the far ridge must still read as a ridge:
    // FOG_MAX leaves it 18% of its own colour, which is the difference
    // between distance and a curtain.
    const fog = clamp01((z - fogStart) / fogSpan);
    const fogK = fog * fog * FOG_MAX;

    // THE MIRROR DISTANCE. Flat water reflects the view ray about the
    // vertical, so a ray from an eye `eye` above the sea at distance z
    // leaves at elevation eye/z - and that equals the sun's elevation at
    // exactly ONE distance. That distance is where the sun's image sits,
    // and it is the SPINE of the glitter path.
    const mirrorMiss = eye / z - SUN_ELEVATION;
    const onSpine = Math.exp(-mirrorMiss * mirrorMiss * 22);

    for (let x = 0; x < W; x++, wx += dx, wy += dy) {
      const top = yBuf[x];
      if (top <= 0) continue;

      // CLAMP the sample, never wrap. Wrapping was the first build's
      // answer and it built THE WALL: the camera opens near the west
      // edge over ocean, a sample one step further west wrapped to the
      // EAST edge, which is inland mountain, and a 240-high cell one
      // step from the eye fills the screen. A torus is the wrong
      // topology for a coastline. Clamping repeats the edge cell
      // outward instead - and the west edge is deep ocean, so the
      // Eltheric simply continues, which is also what is actually
      // there.
      let mx = (wx * sc) | 0, my = (wy * sc) | 0;
      let over = 0;
      if (mx < 0) { over = -mx; mx = 0; } else if (mx >= mw) { over = mx - mw + 1; mx = mw - 1; }
      if (my < 0) { const o2 = -my; if (o2 > over) over = o2; my = 0; }
      else if (my >= mh) { const o2 = my - mh + 1; if (o2 > over) over = o2; my = mh - 1; }
      const mi = my * mw + mx;
      let hgt = mhh[mi];

      // Outside the map the land sinks to the sea floor over EDGE_TAPER
      // cells, and the haze closes over it at the same rate.
      const edgeK = over > 0 ? edgeFade(over, sc) : 0;
      if (edgeK > 0) hgt = SEA_LEVEL + (hgt - SEA_LEVEL) * (1 - edgeK);

      let sy = ((camZ - hgt) * invZ + horizonY) | 0;
      if (sy >= top) continue;
      if (sy < 0) sy = 0;

      // The surface's own colour, tapered to open ocean outside the map
      // in step with the height.
      let cr = mc[mi * 3], cg = mc[mi * 3 + 1], cb = mc[mi * 3 + 2];
      if (edgeK > 0) {
        cr = mix(cr, OCEAN[0], edgeK);
        cg = mix(cg, OCEAN[1], edgeK);
        cb = mix(cb, OCEAN[2], edgeK);
      }

      let r, g, b;
      if (hgt <= SEA_LEVEL) {
        // ── THE SEA ────────────────────────────────────────────────
        // Fresnel by grazing angle: at the horizon the sea is a mirror,
        // underfoot it is water.
        const graze = clamp01(z / 100);
        const refl = 0.13 + 0.58 * graze * graze;

        // What it reflects: the sky ABOVE the horizon at the mirrored
        // row. Not a flat tint - that is what makes a still sea read as
        // a painted floor.
        const ro = sy * 3;
        r = mix(cr, REFL[ro], refl);
        g = mix(cg, REFL[ro + 1], refl);
        b = mix(cb, REFL[ro + 2], refl);

        // THE SWELL. Every wave shades, not just the lit ones - a sea
        // with texture ONLY in the glitter path is a flat floor with a
        // stripe painted on it. Scaled by `graze` so the near water
        // moves and the far water settles into the fog rather than
        // boiling (a constant-amplitude swell aliases into static the
        // moment a wave is smaller than a pixel).
        const wi = ((((wx * waveScale) | 0) & (WAVE_N - 1))
                 + ((((wy * waveScale) | 0) & (WAVE_N - 1)) << 7));
        const wj = ((((wx * waveScale2) | 0) & (WAVE_N - 1))
                 + ((((wy * waveScale2) | 0) & (WAVE_N - 1)) << 7));
        const sw = WAVE[wi] + 0.45 * WAVE[wj];
        // AND DAMPED BY THE SAMPLING RATE, WHICH IS THE ACTUAL
        // CRITERION. The first attempt damped on raw distance and the
        // checkerboard survived it, because distance is not what
        // decides whether a wave aliases - the WORLD UNITS PER PIXEL
        // does, and that is z/scaleH, which a wide angle triples at the
        // same distance. Past a few units per pixel the table is being
        // point-sampled below its own detail and the swell has to go.
        const perPx = z / scaleH;
        const swell = sw * 9 * (1 - graze * 0.80) * clamp01(1 - perPx * 0.25);
        r += swell; g += swell; b += swell * 0.8;

        // THE GLITTER PATH. It exists where the mirror geometry puts it
        // (onSpine) AND where we are looking along the sun's bearing -
        // narrow across, long down, which is what makes it a PATH and
        // not a disc. The waves break it up; they do not create it.
        if (onSpine > 0.004) {
          const vx = wx - cam.x, vy = wy - cam.y;
          const inv = 1 / Math.max(1e-6, Math.sqrt(vx * vx + vy * vy));
          const aln = (vx * inv) * sunCos + (vy * inv) * sunSin;
          if (aln > 0.55) {
            const across = (aln - 1) * 6;
            const glit = onSpine * expNeg(across * across)
                       * clamp01(0.35 + sw * 0.65 * clamp01(1 - perPx * 0.25));
            r += SUN_GLOW[0] * glit;
            g += SUN_GLOW[1] * glit;
            b += SUN_GLOW[2] * glit;
          }
        }
      } else {
        // ── THE LAND ───────────────────────────────────────────────
        // Lambert off the map's own gradient, read at THIS mip level -
        // a level-0 gradient under a level-3 height is two different
        // surfaces and it shimmers.
        const xR = mx + 1 < mw ? mx + 1 : mx, xL = mx > 0 ? mx - 1 : mx;
        const yD = my + 1 < mh ? my + 1 : my, yU = my > 0 ? my - 1 : my;
        const hR = mhh[my * mw + xR];
        const hL = mhh[my * mw + xL];
        const hD = mhh[yD * mw + mx];
        const hU = mhh[yU * mw + mx];
        const gx = (hR - hL) * 0.5 * sc, gy = (hD - hU) * 0.5 * sc;
        // Normal is (-gx, -gy, 1) unnormalised; the sun is low, so the
        // horizontal term dominates and ridges throw real shadow sides.
        const nl = (-gx * sunCos - gy * sunSin) * 0.20 + SUN_ELEVATION * 4.4;
        const lam = clamp01(0.26 + nl * 0.58);
        r = cr * lam;
        g = cg * lam;
        b = cb * lam;
      }

      // FOG STAYS DISTANCE-KEYED, and the edge taper does not touch it.
      // Forcing haze wherever the map ran out hazed the NEAR
      // out-of-bounds water as hard as the far, and since the fog
      // colour is the horizon's warm band that painted a tan plane
      // across the bottom two corners of the widest shot. There is
      // nothing bright left out there to hide - the height and the
      // colour have both already gone to ocean - so distance alone is
      // right, and it is what makes the surround read as sea rather
      // than as a wall the picture stops at.
      const fo = sy * 3;
      r = mix(r, REFL[fo], fogK);
      g = mix(g, REFL[fo + 1], fogK);
      b = mix(b, REFL[fo + 2], fogK);

      const word = 0xff000000
        | ((b < 0 ? 0 : b > 255 ? 255 : b) << 16)
        | ((g < 0 ? 0 : g > 255 ? 255 : g) << 8)
        | (r < 0 ? 0 : r > 255 ? 255 : r);
      for (let o = sy * W + x, e = top * W + x; o < e; o += W) u32[o] = word;
      yBuf[x] = sy;
      if (sy === 0) openCols--;
    }
    if (openCols <= 0) break;
    z += step;
    step *= STEP_GROWTH;
  }

  posterise(target);
  return target;
}

/**
 * DITHER THEN QUANTISE. Posterise every channel to LEVELS steps with a
 * 4x4 Bayer threshold keyed to SCREEN position, so the pattern sits
 * still on the buffer rather than crawling with the camera.
 */
export function posterise(target, levels = LEVELS) {
  const { data, width: W, height: H } = target;
  const q = 255 / (levels - 1);
  const inv = 1 / q;
  for (let y = 0; y < H; y++) {
    const row = (y & 3) * 4;
    let o = y * W * 4;
    for (let x = 0; x < W; x++, o += 4) {
      const th = ((BAYER[row + (x & 3)] + 0.5) / 16 - 0.5) * q;
      for (let c = 0; c < 3; c++) {
        const s = Math.round((data[o + c] + th) * inv) * q;
        data[o + c] = s < 0 ? 0 : s > 255 ? 255 : s;
      }
    }
  }
  return target;
}
