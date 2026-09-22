// @ts-check
// ═══════════════════════════════════════════════════════════════════
// GRASS-PX (2026-09-21, Mac: "with the grass model, is there a way we
// can turn the grass into a pixel art design ... Let's see how detailed
// you can be").
//
// THE TUFT IS A SPRITE, AS EVERY OTHER LIVING THING IN THIS WORLD IS.
// Daggerfall draws its trees, its people and its monsters as hand-set
// pixel flats, and the lab's grass - a million smooth, tapered,
// gradient-lit blades - is the one thing outdoors that does not look
// drawn by the same hand. The pixel style keeps the whole of the lab's
// field (the placer, the packed lanes, the cells, the host-paid fade,
// the wind, the time of day) and changes only what a blade LOOKS like:
// the quad carries a tuft sprite instead of a tapered blade, the sprite
// is four flat tones instead of a gradient, the distance fade is an
// ordered dither instead of a transparency, and the lit colour is
// snapped to a short ramp so the day's light reads as bands, the way a
// paletted screen banded it. The SWAY is the lab's, smooth, in both
// styles (GRASS-PX3: it was stepped at first, and Mac missed the way
// the grass flowed with the wind - the one thing in the field that
// should never look drawn frame by frame).
//
// THE SHEET IS BUILT HERE, AT BOOT, FROM A SEED - not loaded, not drawn
// by hand in a file. Eight tufts, each eight texels wide and sixteen
// tall (GRASS-PX4; sixteen by thirty-two until 2026-09-22, and that
// size still builds through `buildTuftSheet({ w: 16, h: 32 })`), each
// three to five blades laid as one-texel stalks
// that curve with their own lean the way the lab's stalks bend (the
// sideways travel goes as height squared). Every texel is either a
// blade or nothing: the alpha is 0 or 255 and never between, because a
// soft edge is the one thing a pixel sprite must not have. The texel
// carries three more things the fragment stage reads: WHICH TONE it is
// (root, mid, tip, or the one tip highlight that catches the sun's rim),
// HOW FAR UP ITS OWN BLADE it sits (so the lab's root-to-tip lighting
// law runs along the drawn stalk rather than up the quad), and WHICH
// BLADE of the tuft it belongs to (so the blades of one tuft are not
// all the same shade).
//
// THE MIP CHAIN IS BUILT HERE TOO, AND IT IS NOT AN AVERAGE. A sprite
// that is a quarter blade texels and three-quarters air averages to an
// alpha under a half at the first mip level, and an alpha test then
// throws the whole tuft away: the field would vanish a few cells out.
// Each level takes the MAX alpha of its block and the tone of the texel
// that carried it, so a tuft far off is a solid pixel of the right
// colour rather than nothing. The GPU picks the level; the chain is
// what makes the pick safe.
//
// Everything below is pure and deterministic: the pins compare two
// builds byte for byte, and a sheet that changed by a texel is a pin
// that failed.

/** how many tufts the sheet holds, side by side */
export const PX_VARIANTS = 8;
/** one tuft's texel size: eight across, sixteen up - the quad is half
 *  its drawn height wide (labGrass.js GRASSPX_VS_EDITS), so a texel is
 *  square on every blade, buried or not.
 *
 *  GRASS-PX4 (2026-09-22, Mac: "have grass have larger pixels"): it
 *  was sixteen by thirty-two. A texel of that sheet on a blade half a
 *  metre tall is a centimetre and a half - three screen pixels at a
 *  few metres, under one past ten - while every character in this
 *  world is pixelized to CHAR_PIXEL (9) blocks and the Morrowind arm
 *  to MW_ARM_PIXEL (3). The tuft was drawn by a finer hand than the
 *  people standing in it. Halving the sheet doubles the texel on the
 *  same quad; nothing about the field's placement, count, sway or
 *  light moves. EVERY LAW BELOW IS WRITTEN OFF THESE TWO NUMBERS, not
 *  off literals that happened to equal them at 16x32: the edge
 *  margin, the shortest blade, the lean, the highlight's threshold -
 *  so the sheet is one function of its size, and the pins hold the
 *  laws at any size rather than the numbers at one. */
export const PX_TUFT_W = 8;
export const PX_TUFT_H = 16;
/** THE LAWS AS FUNCTIONS OF THE TUFT'S SIZE (GRASS-PX4). Each was a
 *  literal at 16x32; the fraction is what it always meant. AUDIT
 *  GRASS-PX4 F1/F4: ONE function each, read by the constants below AND
 *  by layTuft/paintTuft - the first cut wrote the fraction twice, and a
 *  sheet built from a second copy is pinned by neither.
 *   - a blade's root stands at least `tuftMarginFor(w)` texels in from
 *     either edge column, so no tuft touches its neighbour (3 of 16)
 *   - the shortest blade is `bladeMinFor(h)`: the height law is
 *     floor(h * (0.45 + rnd * 0.55)), so its floor is floor(0.45 h) -
 *     7 of 16, 14 of 32. AUDIT GRASS-PX4 F2: the constant used to say
 *     "a quarter of the tuft" and clamp the height to it, and the clamp
 *     never fired at either size; the constant is the law's own floor
 *     now and the pins hold that a blade reaches it and none goes under
 *   - the tip's sideways travel is two to six sixteenths of the width
 *     (2..6 texels of 16)
 *   - the highlight lands only on a blade tall enough to clear the
 *     sward: `highlightMinFor(h)`, five eighths of the tuft (20 of 32) */
export const tuftMarginFor = (w) => Math.max(1, Math.round(w * 3 / 16));
export const bladeMinFor = (h) => Math.floor(h * 0.45);
export const highlightMinFor = (h) => Math.round(h * 20 / 32);
export const PX_TUFT_MARGIN = tuftMarginFor(PX_TUFT_W);
export const PX_BLADE_MIN = bladeMinFor(PX_TUFT_H);
export const PX_HIGHLIGHT_MIN = highlightMinFor(PX_TUFT_H);
/** the tones a texel can be, in the R channel: 0 nothing, 1 root,
 *  2 mid, 3 tip, 4 the tip highlight. Stored as tone * 64 (255 for 4)
 *  and read back as floor(R * 4 + 0.5). */
export const PX_TONES = 4;
/** the lit colour is snapped to this many luminance steps */
export const PX_RAMP_STEPS = 8;
/** the patch tint is snapped to this many bands */
export const PX_TINT_BANDS = 4;
/** the sheet's seed - the sheet is the same on every machine, every boot */
export const PX_SEED = 0x9e3779b1;
/** GRASS AUDIT 1: a tuft stands in for THIS many of the lab's blades.
 *  The placer emits one instance per lab blade; a tuft is three to five
 *  blades on a quad half its height wide, so drawing one per blade was
 *  several times the field's visual density. The host submits half of
 *  each cell's blades in the pixel style (the placer's order is random,
 *  so the first half is a uniform half). A third was tried and read
 *  sparse at the feet, where a tuft is one-texel stalks over open
 *  ground; half is the lab's sward, at half the fill. */
export const PX_BLADES_PER_TUFT = 2;

/** mulberry32: a small, fast, seedable generator with no state outside
 *  its closure, so a sheet is a function of its seed and nothing else */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** the byte a tone is stored as: 0, 64, 128, 192, 255 */
export const toneByte = (tone) => tone >= PX_TONES ? 255 : tone * 64;

/**
 * One tuft's blades, as the placer's own laws would lay them if they
 * were texels. `w` x `h` texels, row 0 the base. Returns the blades so
 * the pins can hold the laws, and paints them into `out` at column
 * offset `x0` of a sheet `stride` texels wide.
 *
 * @param {() => number} rnd
 * @param {number} w
 * @param {number} h
 */
export function layTuft(rnd, w = PX_TUFT_W, h = PX_TUFT_H) {
  const blades = [];
  const n = 3 + Math.floor(rnd() * 3);            // three to five blades
  // GRASS-PX4: the laws at THIS size - the margin and the lean are the
  // sheet's fractions (the functions beside the constants), scaled to
  // whatever w and h a caller hands in, so a tuft laid for a pin at
  // 16x32 and the shipped 8x16 are the same tuft at two scales.
  const margin = tuftMarginFor(w);
  for (let b = 0; b < n; b++) {
    const x0 = margin + Math.floor(rnd() * (w - 2 * margin));   // never on the edge columns, so no tuft touches its neighbour
    const height = Math.floor(h * (0.45 + rnd() * 0.55));   // bladeMinFor(h)..h: 7..16 of 16
    let lean = (rnd() * 2 - 1) * (2 + rnd() * 4) * (w / 16);   // sideways travel at the tip, either way, in texels of THIS width
    lean = Math.max(1 - x0, Math.min(w - 2 - x0, lean));   // ...but the tip stays inside the tuft: a blade cut off by the sheet's edge is a flat line, not a blade
    const wide = rnd() < 0.5;                     // half the blades carry a two-texel base
    const head = height >= h * 0.8 && rnd() < 0.4;   // a tall blade may carry a seed head
    // AUDIT GRASS-PX4 F3: the head is two texels wide and sits to the tip's RIGHT, so a headed tip one column
    // short of the edge painted the edge column - on 6% of tufts at 8x16 (3% at 16x32), none of them the shipped
    // seeds', which is why "no tuft on its edge column" passed as a pin and was not a law. The head stays inside
    // the tuft the way the tip does.
    if (head) lean = Math.min(w - 3 - x0, lean);
    blades.push({ x0, height, lean, wide, head, ordinal: n > 1 ? b / (n - 1) : 0 });
  }
  return blades;
}

/**
 * The tone of a texel `f` of the way up its blade: the root third is
 * root, the middle is mid, the top quarter is tip, and the very last
 * texel of a blade tall enough to stand clear of the sward is the
 * highlight the sun's rim lands on.
 */
export function toneAt(f, isTip, height, highlightMin = PX_HIGHLIGHT_MIN) {
  if (isTip && height >= highlightMin) return 4;
  return f < 0.35 ? 1 : f < 0.75 ? 2 : 3;
}
/** GRASS AUDIT 1: the highlight is the top TWO texels of a tall blade,
 *  not one - one was overpainted by a later blade or the blade's own
 *  seed head half the time, and twelve highlight texels in a sheet of
 *  771 is a rim nobody sees. `r` is the texel's row, `top` the blade's.
 *  GRASS-PX4: "tall" is five eighths of the tuft, whatever the tuft's
 *  height - `highlightMin` is PX_HIGHLIGHT_MIN for the shipped sheet
 *  and the same fraction of any other size paintTuft is handed. */
export const isHighlightRow = (r, top, height, highlightMin = PX_HIGHLIGHT_MIN) => height >= highlightMin && r >= top - 1;

/**
 * Paint one tuft into a sheet. Later blades paint over earlier ones,
 * as a painter would lay them.
 *
 * @param {Uint8Array} out RGBA texels, row 0 first
 * @param {number} stride the sheet's width in texels
 * @param {number} ox the tuft's first column
 * @param {ReturnType<typeof layTuft>} blades
 */
export function paintTuft(out, stride, ox, blades, w = PX_TUFT_W, h = PX_TUFT_H) {
  const highlightMin = highlightMinFor(h);   // GRASS-PX4: the sheet's fraction, at this height - the ONE function (AUDIT GRASS-PX4 F1)
  const put = (x, y, tone, f, ordinal) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const i = ((y * stride) + ox + x) * 4;
    out[i] = toneByte(tone);
    out[i + 1] = Math.round(f * 255);
    out[i + 2] = Math.round(ordinal * 255);
    out[i + 3] = 255;
  };
  for (const bl of blades) {
    const top = bl.height - 1;
    if (bl.head) {
      // a seed head: a 2x2 cap of mid tone straddling the tip, the way a
      // grass flower sits heavier than the stalk that holds it. GRASS
      // AUDIT 1: painted BEFORE the stalk, so the stalk's own highlight
      // texel lands on top of it and not under it.
      const xt = bl.x0 + Math.round(bl.lean);
      for (const [dx, dy] of [[0, -1], [1, -1], [0, 0], [1, 0]]) put(xt + dx, top + dy, 2, 1, bl.ordinal);
    }
    for (let r = 0; r <= top; r++) {
      const f = top > 0 ? r / top : 1;
      // the stalk's curve is the lab's: the tip travels, the root does
      // not, and the travel goes as height squared
      const x = bl.x0 + Math.round(bl.lean * f * f);
      const tone = isHighlightRow(r, top, bl.height, highlightMin) ? 4 : toneAt(f, r === top, bl.height, highlightMin);
      put(x, r, tone, f, bl.ordinal);
      if (bl.wide && f < 0.2) put(x + (bl.lean >= 0 ? -1 : 1), r, 1, f, bl.ordinal);   // the base's second texel sits on the side the blade leans AWAY from, and only the bottom fifth carries it - wider and the bases read as blocks
    }
  }
}

/**
 * The whole sheet: `variants` tufts side by side, each from its own
 * stream of the seed. Returns the level-0 texels and the sheet's size.
 */
export function buildTuftSheet({ variants = PX_VARIANTS, w = PX_TUFT_W, h = PX_TUFT_H, seed = PX_SEED } = {}) {
  const width = variants * w, height = h;
  const data = new Uint8Array(width * height * 4);
  for (let v = 0; v < variants; v++) {
    const rnd = mulberry32((seed ^ Math.imul(v + 1, 0x85ebca6b)) >>> 0);
    paintTuft(data, width, v * w, layTuft(rnd, w, h), w, h);
  }
  return { width, height, data, variants };
}

/**
 * One mip level down, PRESERVING COVERAGE. GRASS AUDIT 1: the first
 * chain took the MAX alpha of every block, which kept a far tuft from
 * vanishing and also made it a solid rectangle by the third level (19%
 * of the sheet covered at level 0, 88% at level 3, 100% from level 4)
 * of the ROOT tone (the tie-break took the lowest row) - a far field
 * that was a wall of dark blocks three blade-widths wide. An average
 * goes the other way and the tuft is gone by level 1.
 *
 * The right answer is the alpha-test mip law (Castano): a level keeps
 * the FRACTION of covered texels the base level had, so a tuft at any
 * distance is as dense as it was up close - the blocks with the most
 * covered texels are kept, the rest are air, and the alpha stays 0 or
 * 255. Each kept block takes the tone of its HIGHEST covered texel (by
 * height along the blade, the tip winning over the highlight on a
 * tie), because what the eye sees of a distant blade is its tip, which
 * is GR4's law for the smooth blade too. Two floors: every tuft keeps
 * at least one texel while it is still a texel wide, and once a texel
 * spans more than one tuft (the last three levels, under two pixels on
 * screen) the level is fully covered (the per-tuft floor does that on
 * its own), because a mark that is there is better than a mark that
 * flickers.
 *
 * Sizes halve and floor at one, which is the chain WebGL wants.
 */
export function downsampleCoverage(level, { targetFrac, variants = PX_VARIANTS }) {
  const { width, height, data } = level;
  const w2 = Math.max(1, width >> 1), h2 = Math.max(1, height >> 1);
  const out = new Uint8Array(w2 * h2 * 4);
  const blocks = [];
  for (let y = 0; y < h2; y++) {
    for (let x = 0; x < w2; x++) {
      let count = 0, bi = -1, bg = -1, bt = 9;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const sx = Math.min(width - 1, x * 2 + dx), sy = Math.min(height - 1, y * 2 + dy);
          const i = (sy * width + sx) * 4;
          if (!data[i + 3]) continue;
          count++;
          const g = data[i + 1], t = data[i];
          if (g > bg || (g === bg && t < bt)) { bg = g; bt = t; bi = i; }
        }
      }
      const o = (y * w2 + x) * 4;
      if (bi >= 0) { out[o] = data[bi]; out[o + 1] = data[bi + 1]; out[o + 2] = data[bi + 2]; }
      blocks.push({ x, y, count, g: bg, o });
    }
  }
  const tuftAt = w2 / variants;   // this level's texels per tuft, across
  const covered = blocks.filter((b) => b.count > 0);
  covered.sort((a, b) => b.count - a.count || b.g - a.g || b.y - a.y || a.x - b.x);
  const keep = Math.min(covered.length, Math.max(1, Math.round(targetFrac * w2 * h2)));
  for (let k = 0; k < keep; k++) out[covered[k].o + 3] = 255;
  // the per-tuft floor: a tuft still a texel wide keeps at least one
  // texel - and once a texel spans more than one tuft, every tuft's
  // claim on it fills the whole level, which is the "always grass" law
  // for the last three levels stated once rather than twice
  for (let v = 0; v < variants; v++) {
    const x0 = Math.floor(v * tuftAt), x1 = Math.floor((v + 1) * tuftAt);
    const mine = covered.filter((b) => b.x >= x0 && b.x < x1);
    if (mine.length && !mine.some((b) => out[b.o + 3])) out[mine[0].o + 3] = 255;
  }
  return { width: w2, height: h2, data: out };
}

/** the covered fraction of a level */
export function coverageOf(level) {
  let n = 0;
  for (let i = 3; i < level.data.length; i += 4) if (level.data[i]) n++;
  return n / (level.width * level.height);
}

/** the full chain, level 0 first, down to 1x1 - a chain that stops
 *  short is an INCOMPLETE texture, which samples black */
export function buildTuftMips(sheet = buildTuftSheet()) {
  /** @type {{ width: number, height: number, data: Uint8Array, variants?: number }[]} */
  const levels = [sheet];
  const targetFrac = coverageOf(sheet);
  while (levels[levels.length - 1].width > 1 || levels[levels.length - 1].height > 1) {
    levels.push(downsampleCoverage(levels[levels.length - 1], { targetFrac, variants: sheet.variants ?? PX_VARIANTS }));
  }
  return levels;
}

/** the style the pref names: anything that is not the word `smooth` is
 *  the row's default, pixel - the same fallback the settings pane draws
 *  for a value that is no tier (enhancedMenu.js, BLOOD AUDIT 5) */
export const pixelGrass = (style) => style !== 'smooth';
