// ═══════════════════════════════════════════════════════════════════
// MW-D35: THE FACE IS MATCHED, NOT WALKED.
//
// Mac's call: pair the classic portraits to Morrowind heads and hairs
// METICULOUSLY, and not by handing him a sheet to read. A likeness is
// a judgement about skin tone, hair colour, hair length and facial
// hair - and every one of those is MEASURABLE, on both sides, from the
// data the player already attached: the classic portrait is an
// indexed bitmap in FACE##I0.CIF, the Morrowind head and hair are DDS
// textures and a mesh with a height. So the pairing is computed from
// those measurements at build time, on the player's own data, for the
// player's own race, sex and portrait - deterministic, explainable
// (the card prints every distance), and never a guess about assets
// this repo cannot see. mwFaceTable.json still overrides it by hand;
// the modulo walk remains the floor when a measurement is missing.
//
// FEATURES (all colours are linear-ish 0..1 RGB means; distances are
// Euclidean over RGB, so 0.10 is a visible tone step and 0.30 is a
// different colour altogether):
//   portrait: skin (the face's centre), hair (the top band), length
//     (how much hair-coloured foreground sits in the lower half),
//     beard (how much hair-coloured foreground sits on the chin band),
//     bald (the top band is skin, not hair).
//   head:     skin (texture centre), beard (chin band darker than the
//     cheeks - Morrowind bakes beards into the head texture).
//   hair:     colour (alpha-weighted texture mean), length (the mesh's
//     vertical extent, rank-normalised within the pool).
// ═══════════════════════════════════════════════════════════════════

const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];

/** Mean RGB (0..1) over a pixel iterator; null when nothing qualified. */
function meanOf(iter) {
  let r = 0; let g = 0; let b = 0; let n = 0;
  for (const c of iter) { r += c[0]; g += c[1]; b += c[2]; n++; }
  return n ? [r / n, g / n, b / n] : null;
}

/**
 * The classic portrait's features. `bitmap` is a CifRciFile
 * getDFBitmap result ({width, height, data}) and `palette` answers
 * .get(index) -> {r,g,b} in 0..255. Index 0 is the transparent
 * background - the ONE thing that separates black hair from no hair.
 */
export function portraitFeatures(bitmap, palette) {
  const { width: w, height: h, data } = bitmap;
  if (!w || !h) return null;
  const rgb = (x, y) => { const c = palette.get(data[y * w + x]); return [c.r / 255, c.g / 255, c.b / 255]; };
  const fg = (x, y) => data[y * w + x] !== 0;
  // the foreground's own box, so a portrait drawn small in its frame
  // is measured on the face and not the frame.
  let top = h; let bot = -1; let left = w; let right = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!fg(x, y)) continue;
      if (y < top) top = y; if (y > bot) bot = y; if (x < left) left = x; if (x > right) right = x;
    }
  }
  if (bot < 0) return null;
  const H = bot - top + 1; const W = right - left + 1;
  const band = (y0, y1, x0, x1) => {
    const out = [];
    for (let y = Math.max(top, Math.floor(top + y0 * H)); y < Math.min(bot + 1, Math.ceil(top + y1 * H)); y++) {
      for (let x = Math.max(left, Math.floor(left + x0 * W)); x < Math.min(right + 1, Math.ceil(left + x1 * W)); x++) {
        if (fg(x, y)) out.push(rgb(x, y));
      }
    }
    return out;
  };
  const skin = meanOf(band(0.40, 0.68, 0.32, 0.68));
  const hairBand = band(0.00, 0.22, 0.00, 1.00);
  const hair = meanOf(hairBand);
  if (!skin || !hair) return null;
  const bald = dist3(hair, skin) < 0.12;
  // hair-coloured pixels are the ones nearer the hair mean than the
  // skin mean - the same rule finds long hair on the shoulders and a
  // beard on the chin.
  const hairish = (c) => !bald && dist3(c, hair) < dist3(c, skin);
  const lower = band(0.55, 1.00, 0.00, 1.00);
  const length = lower.length ? lower.filter(hairish).length / lower.length : 0;
  // the chin's CENTRE only - long hair falls beside the jaw, and a
  // wide band read every long-haired portrait as bearded.
  const chin = band(0.76, 0.96, 0.40, 0.60);
  const beard = chin.length ? chin.filter(hairish).length / chin.length : 0;
  return { skin, hair, bald, length, beard };
}

/** A Morrowind head texture's features from its RGBA level 0. */
export function headFeatures(rgba, w, h) {
  if (!rgba || !w || !h) return null;
  const px = (x, y) => { const o = (y * w + x) * 4; return [rgba[o] / 255, rgba[o + 1] / 255, rgba[o + 2] / 255]; };
  const band = (y0, y1, x0, x1) => {
    const out = [];
    for (let y = Math.floor(y0 * h); y < Math.ceil(y1 * h); y++) {
      for (let x = Math.floor(x0 * w); x < Math.ceil(x1 * w); x++) out.push(px(x, y));
    }
    return out;
  };
  const cheeks = meanOf(band(0.30, 0.55, 0.20, 0.80));
  const chin = meanOf(band(0.66, 0.90, 0.30, 0.70));
  if (!cheeks || !chin) return null;
  // a beard is a chin band a good step darker than the cheeks
  const beard = Math.max(0, Math.min(1, (lum(cheeks) - lum(chin)) / 0.25));
  return { skin: cheeks, beard };
}

/** A Morrowind hair's features: colour from its texture, length from
 *  its mesh height (raw; rank-normalised across the pool by the
 *  matcher, because "long" is relative to the race's other hairs). */
export function hairFeatures(rgba, w, h, extentZ) {
  if (!rgba || !w || !h) return null;
  const px = [];
  for (let i = 0; i < w * h; i++) {
    if (rgba[i * 4 + 3] < 128) continue;
    px.push([rgba[i * 4] / 255, rgba[i * 4 + 1] / 255, rgba[i * 4 + 2] / 255]);
  }
  const colour = meanOf(px);
  if (!colour) return null;
  return { colour, extentZ: Number.isFinite(extentZ) ? extentZ : 0 };
}

/**
 * THE MATCH. heads: [{id, f:headFeatures}], hairs: [{id, f:hairFeatures}]
 * (entries whose f is null are skipped and named in the reasons).
 * Returns {head, hair, reasons:string[]} with null where no candidate
 * had features - the caller falls back to the walk for that half.
 */
export function matchFace(portrait, heads, hairs, { female = false } = {}) {
  const reasons = [];
  if (!portrait) return { head: null, hair: null, reasons: ['portrait unreadable - the walk stands'] };
  let head = null; let best = Infinity;
  for (const h of heads ?? []) {
    if (!h.f) { reasons.push(`${h.id}: no texture to measure`); continue; }
    // a beard is a male cue; the female pools have none and the
    // portrait's chin band is hair beside the jaw, not on it.
    const d = dist3(portrait.skin, h.f.skin) + (female ? 0 : 0.35 * Math.abs(portrait.beard - h.f.beard));
    if (d < best) { best = d; head = h.id; }
  }
  if (head) reasons.push(`head ${head}: skin dist ${best.toFixed(2)}`);
  const measured = (hairs ?? []).filter((x) => x.f);
  for (const x of (hairs ?? [])) if (!x.f) reasons.push(`${x.id}: no texture to measure`);
  let hair = null;
  if (measured.length) {
    // rank-normalise mesh height so 'long' means long FOR THIS RACE
    const sorted = measured.map((x) => x.f.extentZ).sort((a, b) => a - b);
    const rank = (v) => (sorted.length > 1 ? sorted.indexOf(v) / (sorted.length - 1) : 0.5);
    let bestH = Infinity;
    for (const x of measured) {
      const want = portrait.bald ? 0 : portrait.length;
      const d = (portrait.bald ? 0 : 1.2 * dist3(portrait.hair, x.f.colour)) + 0.6 * Math.abs(want - rank(x.f.extentZ));
      if (d < bestH) { bestH = d; hair = x.id; }
    }
    reasons.push(`hair ${hair}: ${portrait.bald ? 'portrait is bald, shortest hair' : `colour+length dist ${bestH.toFixed(2)}`}`);
  }
  return { head, hair, reasons };
}
