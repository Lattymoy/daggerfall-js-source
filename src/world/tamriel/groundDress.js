// @ts-check
// TESA-LANDS (bible/03-World/Tamriel-Lands.md, "The ground"): THE GROUND'S DRESS - a zone's own colours laid over the
// ground set the game draws (the classic records, or the pack worn over them), keeping the set's grain, its tiles' shapes
// and its transitions. A texel's class (DFU's four bases and the town's paving) is read off THIS set's solid records,
// softly where a transition blends them; a dressed class is a gradient map of the zone's ramp at the texel's own light.
// Water, its alpha and the paving are never dressed. Pure: layers in, layers out, a record a step for the build's
// breather; the dress is made on the player's machine and nothing of it ships.

/** The classes, in prototype order: DFU's four tile bases and the town's paving. */
export const DRESS_CLASSES = Object.freeze(['water', 'dirt', 'grass', 'stone', 'paving']);
/** Each class's solid record in a ground set (TerrainHelper's bases 0-3; 46 the town's paving - DFU's road tile). */
export const CLASS_RECORDS = Object.freeze([0, 1, 2, 3, 46]);
/** Records the town's paving is painted in, and the only classes their texels are of (46 the paving whole, 47 a dirt
 *  edge on it, 55 a grass edge - world/terrain/terrainTiles.js's road records, render/labGrass.js grassRecordsOf's). */
export const PAVED_RECORDS = Object.freeze({
  46: Object.freeze([4]),
  47: Object.freeze([1, 4]),
  55: Object.freeze([2, 4]),
});
/** THE DIALS (one place) - why each stands where it does: bible/03-World/Tamriel-Lands.md, "The ground". */
export const DRESS_DIALS = Object.freeze({
  contrast: 1, // a texel's luminance over its class's mean, to this power, is its luminance over the ramp's middle
  reach: Object.freeze([0.55, 1.6]), // past the ramp's ends its end colour, scaled on within these
  keep: 0.22, // the share of the texel's own colour noise kept over the ramp's - the set's mottle through it
  soft: 0.5,
  softMin: 0.02, // a class share is a Gaussian of colour distance this share of the nearest prototypes' gap wide
  blur: 0.045, // then blurred over this share of the record (a transition's shape is half a tile, a grain a texel)
  crisp: 0.15, // then under this none, over 1 less it whole: a transition's inside its class's, as the solid record is
  present: 0.02, // a class nearest to fewer of a record's texels than this is not asked there
  fleckTexels: 1,
  fleckBlend: 0.8, // a fleck's cell at a 128-texel record, and how much of its own colour it takes
  albedo: 0.7, // the ramps are lit screenshot colours and a set an albedo: the classic grass 65 against 99 sampled
  vivid: 1.25, // the screenshots' haze undone: a ramp's colours moved this much further from their grey
});

/** How many rows of a 256-texel record a step dresses (dressRecordSteps): the build's breather gives the frame back
 *  between steps (scenes/groundSets.js), so a step must be a slice of a frame, never a record whole. */
export const DRESS_BAND = 32;

/** How finely a ramp's luminance is read (compileDress) - the inverse's resolution. */
export const RAMP_STEPS = 64;

/** '#rrggbb' (or [r, g, b]) as [r, g, b], 0..255. */
export function hexRgb(h) {
  if (Array.isArray(h)) return [h[0], h[1], h[2]];
  const v = parseInt(String(h).replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** A material's ramp at `t` (0 its darkest stop, 1 its lightest - its stops evenly spaced), written into `out`. */
export function rampAt(stops, t, out = [0, 0, 0]) {
  const n = stops.length - 1;
  if (n <= 0) {
    out[0] = stops[0][0];
    out[1] = stops[0][1];
    out[2] = stops[0][2];
    return out;
  }
  const f = Math.min(n, Math.max(0, t * n)),
    i = Math.min(n - 1, Math.floor(f)),
    u = f - i,
    a = stops[i],
    b = stops[i + 1];
  out[0] = a[0] + (b[0] - a[0]) * u;
  out[1] = a[1] + (b[1] - a[1]) * u;
  out[2] = a[2] + (b[2] - a[2]) * u;
  return out;
}

const lumOf = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

/**
 * A SET'S PROTOTYPES: for each class (DRESS_CLASSES' order) its solid record's mean colour `rgb` (0..255), its
 * luminance's mean `lum` and spread `sd` - null for a class whose record the set does not carry. Pure.
 * @param {ReadonlyArray<{ width: number, height: number, colors: ArrayLike<number> }>} layers
 */
export function setPrototypes(layers) {
  return CLASS_RECORDS.map((rec) => {
    const l = layers[rec];
    const n = l ? l.width * l.height : 0;
    if (!n) return null;
    let r = 0,
      g = 0,
      b = 0,
      s = 0,
      s2 = 0;
    for (let k = 0; k < n; k++) {
      const R = l.colors[k * 4],
        G = l.colors[k * 4 + 1],
        B = l.colors[k * 4 + 2],
        L = lumOf(R, G, B);
      r += R;
      g += G;
      b += B;
      s += L;
      s2 += L * L;
    }
    const lum = s / n;
    return Object.freeze({
      rgb: Object.freeze([r / n, g / n, b / n]),
      lum,
      sd: Math.sqrt(Math.max(0, s2 / n - lum * lum)),
    });
  });
}

/** A fleck cell's hash, 0..1 (murmur3's finaliser over the cell, the record and the salt) - the same in every engine. */
export function fleckDraw(cx, cy, record, salt) {
  let h =
    Math.imul(cx | 0, 0x9e3779b1) ^
    Math.imul(cy | 0, 0x85ebca77) ^
    Math.imul((record | 0) + 0x27d4eb2f, 0xc2b2ae3d) ^
    Math.imul(salt | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * A DRESS MADE READY: its materials' ramps and flecks as numbers, by class (DRESS_CLASSES' index; null a class it leaves
 * as the set paints it - water and paving always). `dress` a zone's (world/tamriel/tamrielLands.js LANDS' `ground`):
 * `{ dirt?, grass?, stone? }`, each `{ ramp: hex[], keep?, contrast?, fleck?: { colors: hex[], share } }` - its ramp's
 * luminance read at RAMP_STEPS points (made monotone), its middle's beside it.
 * @param {any} dress
 */
export function compileDress(dress) {
  return DRESS_CLASSES.map((name, c) => {
    const m = c === 0 || c === 4 ? null : dress?.[name];
    if (!m?.ramp?.length) return null;
    const stops = m.ramp.map((h) => {
      const c = hexRgb(h),
        L = lumOf(c[0], c[1], c[2]);
      return c.map((v) => L + (v - L) * DRESS_DIALS.vivid);
    });
    const lum = new Float64Array(RAMP_STEPS + 1),
      at = [0, 0, 0];
    for (let i = 0; i <= RAMP_STEPS; i++) {
      rampAt(stops, i / RAMP_STEPS, at);
      lum[i] = Math.max(i ? lum[i - 1] : 0, lumOf(at[0], at[1], at[2]));
    }
    return Object.freeze({
      stops,
      lum,
      mid: lum[RAMP_STEPS >> 1],
      keep: m.keep ?? DRESS_DIALS.keep,
      contrast: m.contrast ?? DRESS_DIALS.contrast,
      fleck:
        m.fleck?.share > 0
          ? Object.freeze({ colors: m.fleck.colors.map(hexRgb), share: m.fleck.share, salt: c * 131 + 7 })
          : null,
    });
  });
}

/** The classes a record's texels may be of, among those whose prototypes stand: the paving's own (PAVED_RECORDS), a
 *  ground's solid record its own class alone (its texels' spread is its grain, never another class - CLASS_RECORDS),
 *  else the four grounds - each kept where it is nearest to `present` of the record's texels. */
function recordClasses(layer, record, protos) {
  const solid = record < 4 ? [record] : null;
  const pool = (PAVED_RECORDS[/** @type {keyof typeof PAVED_RECORDS} */ (record)] ?? solid ?? [0, 1, 2, 3]).filter(
    (c) => protos[c],
  );
  if (pool.length <= 1) return pool;
  const m = pool.length,
    P = pool.map((c) => protos[c].rgb),
    near = new Array(m).fill(0),
    n = layer.width * layer.height,
    src = layer.colors;
  for (let k = 0, o = 0; k < n; k++, o += 4) {
    const R = src[o],
      G = src[o + 1],
      B = src[o + 2];
    let best = 0,
      bd = Infinity;
    for (let i = 0; i < m; i++) {
      const p = P[i],
        dr = R - p[0],
        dg = G - p[1],
        db = B - p[2],
        d = dr * dr + dg * dg + db * db;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    near[best]++;
  }
  const kept = pool.filter((_, i) => near[i] >= n * DRESS_DIALS.present);
  return kept.length ? kept : [pool[near.indexOf(Math.max(...near))]];
}

/** Where on a ramp (its monotone luminance `lum`, RAMP_STEPS + 1 of it) a luminance `target` falls: `t`, and `k` the end
 *  colour's scale past either end (within DRESS_DIALS.reach) - so a texel brighter than the ramp's lightest is its lightest
 *  colour lit on, never clipped flat. */
export function rampFor(lum, target) {
  const N = lum.length - 1;
  if (target <= lum[0]) return { t: 0, k: Math.max(DRESS_DIALS.reach[0], target / Math.max(lum[0], 1e-3)) };
  if (target >= lum[N]) return { t: 1, k: Math.min(DRESS_DIALS.reach[1], target / Math.max(lum[N], 1e-3)) };
  let lo = 0,
    hi = N;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (lum[mid] <= target) lo = mid;
    else hi = mid;
  }
  const span = lum[hi] - lum[lo];
  return { t: (lo + (span > 0 ? (target - lum[lo]) / span : 0)) / N, k: 1 };
}

/** How finely a class's transform is tabled over a texel's luminance (0-256): its ramp is read exactly at each step and
 *  between steps along the line - a fraction of a level, and monotone as the ramp is. */
const LUT_STEPS = 2048;
/**
 * A CLASS'S TRANSFORM, TABLED (null for a class left as the set paints it): a texel's colour is its ramp's at its
 * luminance (laid at `light`) - `r`, `g`, `b` and where on the ramp it fell, `t`, read off the table at its luminance -
 * plus its own colour noise about the class's prototype (`pr`, `pg`, `pb`, `lum`) at `keep`. AUDIT (the dress's cost): a
 * Map of every colour the record held, a pack's true colour flooding it, was a third of a set's 1.4 s.
 */
function classLut(m, p, light) {
  if (!m) return null;
  const N = LUT_STEPS,
    r = new Float32Array(N + 1),
    g = new Float32Array(N + 1),
    b = new Float32Array(N + 1),
    t = new Float32Array(N + 1),
    ramp = [0, 0, 0];
  for (let j = 0; j <= N; j++) {
    const L = (j * 256) / N,
      at = rampFor(m.lum, m.mid * Math.pow(Math.max(L, 1) / Math.max(p.lum, 1), m.contrast));
    rampAt(m.stops, at.t, ramp);
    r[j] = ramp[0] * at.k * light;
    g[j] = ramp[1] * at.k * light;
    b[j] = ramp[2] * at.k * light;
    t[j] = at.t;
  }
  return { r, g, b, t, scale: N / 256, keep: m.keep, pr: p.rgb[0], pg: p.rgb[1], pb: p.rgb[2], lum: p.lum };
}

/** A share map blurred in place by a box `r` texels each way, rows then columns, clamped at the edges (`tmp` scratch) -
 *  a running sum along each line, so its cost is the map's, whatever the box. */
export function boxBlur(a, w, h, r, tmp) {
  const k = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    for (let d = -r; d <= r; d++) sum += a[row + Math.min(w - 1, Math.max(0, d))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum * k;
      sum += a[row + Math.min(w - 1, x + r + 1)] - a[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let d = -r; d <= r; d++) sum += tmp[Math.min(h - 1, Math.max(0, d)) * w + x];
    for (let y = 0; y < h; y++) {
      a[y * w + x] = sum * k;
      sum += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
}

/**
 * A TRANSITION'S SHARES: for each class a record may hold, how much of each texel is that class - a Gaussian of its
 * distance to each prototype, BLURRED (a set's grain within a class is as far from its prototype as the next class is,
 * so a texel alone cannot say which side of the shape it stands on - its neighbourhood can), normalised, made CRISP.
 * A step a band of DRESS_BAND rows, then a step a class's blur (dressRecordSteps walks it).
 */
function* transitionShares(layer, classes, protos) {
  let near = Infinity;
  for (let i = 0; i < classes.length; i++)
    for (let j = i + 1; j < classes.length; j++) {
      const a = protos[classes[i]].rgb,
        b = protos[classes[j]].rgb;
      near = Math.min(near, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / 255);
    }
  const width = Math.max(DRESS_DIALS.softMin, near * DRESS_DIALS.soft),
    inv2 = 1 / (2 * width * width * 255 * 255);
  const { width: w, height: h, colors: src } = layer,
    n = w * h,
    nc = classes.length,
    P = classes.map((c) => protos[c].rgb);
  const maps = classes.map(() => new Float32Array(n)),
    tmp = new Float32Array(n),
    rows = Math.max(1, Math.round((DRESS_BAND * 256) / w));
  for (let y = 0; y < h; y += rows) {
    if (y) yield;
    shareRows(src, w * Math.min(h, y + rows), y * w, P, inv2, maps);
  }
  const r = Math.max(1, Math.round(w * DRESS_DIALS.blur));
  for (const m of maps) {
    yield;
    boxBlur(m, w, h, r, tmp);
  }
  yield;
  for (let k = 0; k < n; k++) {
    let sum = 0;
    for (let i = 0; i < nc; i++) sum += maps[i][k];
    if (!(sum > 0)) continue;
    let crisp = 0;
    for (let i = 0; i < nc; i++) crisp += crispShare(maps[i][k] / sum);
    for (let i = 0; i < nc; i++) maps[i][k] = crisp > 0 ? crispShare(maps[i][k] / sum) / crisp : maps[i][k] / sum; // every share under the floor (many classes evenly): as they were
  }
  return maps;
}
/** A blurred share made crisp (DRESS_DIALS.crisp): none under the dial, whole over 1 less it, stretched between. */
const crispShare = (s) => Math.min(1, Math.max(0, (s - DRESS_DIALS.crisp) / (1 - 2 * DRESS_DIALS.crisp)));

/** transitionShares' texels `from` to `to` (a band of rows - a plain function, so the engine optimises its loop as it
 *  does not a generator's): each class's Gaussian, normalised. */
function shareRows(src, to, from, P, inv2, maps) {
  const nc = P.length;
  for (let k = from, o = from * 4; k < to; k++, o += 4) {
    const R = src[o],
      G = src[o + 1],
      B = src[o + 2];
    let best = 0,
      bd = Infinity,
      sum = 0;
    for (let i = 0; i < nc; i++) {
      const p = P[i],
        dr = R - p[0],
        dg = G - p[1],
        db = B - p[2],
        d = dr * dr + dg * dg + db * db;
      if (d < bd) {
        bd = d;
        best = i;
      }
      sum += maps[i][k] = Math.exp(-d * inv2);
    }
    if (!(sum > 1e-12)) {
      for (let i = 0; i < nc; i++) maps[i][k] = 0;
      maps[best][k] = 1;
      sum = 1;
    } // past every prototype's reach: its nearest class whole
    for (let i = 0; i < nc; i++) maps[i][k] /= sum;
  }
}

/**
 * ONE RECORD DRESSED: a new layer (alpha whole), or the layer itself where no class it holds is dressed. `mats` a
 * compiled dress (compileDress), `protos` the set's (setPrototypes), `light` the ramps' share as they are laid (the
 * albedo's, times the set's exposure). A solid record is its own class whole; a transition's texels take each class's
 * transform by their shares (transitionShares).
 * @param {{ width: number, height: number, colors: ArrayLike<number> }} layer @param {number} record
 * @param {ReturnType<typeof compileDress>} mats @param {ReturnType<typeof setPrototypes>} protos @param {number} [light]
 */
export function dressRecord(layer, record, mats, protos, light = DRESS_DIALS.albedo) {
  const steps = dressRecordSteps(layer, record, mats, protos, light);
  for (;;) {
    const r = steps.next();
    if (r.done) return r.value;
  }
}

/**
 * dressRecord a band of rows at a time (DRESS_BAND rows of a 256-texel record's: a step a few milliseconds), its shares
 * first - its value the dressed layer.
 * @param {{ width: number, height: number, colors: ArrayLike<number> }} layer @param {number} record
 * @param {ReturnType<typeof compileDress>} mats @param {ReturnType<typeof setPrototypes>} protos @param {number} [light]
 */
export function* dressRecordSteps(layer, record, mats, protos, light = DRESS_DIALS.albedo) {
  if (!layer?.width || !layer.height) return layer;
  const classes = recordClasses(layer, record, protos);
  if (!classes.some((c) => mats[c])) return layer;
  const { width: w, height: h } = layer,
    src = layer.colors,
    out = new Uint8Array(w * h * 4);
  const shares = classes.length > 1 ? yield* transitionShares(layer, classes, protos) : null;
  if (shares) yield;
  const band = Math.max(1, Math.round((DRESS_BAND * 256) / w)); // DRESS_BAND rows of a 256-wide record's texels a step
  const luts = classes.map((c) => classLut(mats[c], protos[c], light)),
    flecks = classes.map((c) => mats[c]?.fleck ?? null);
  for (let y = 0; y < h; y += band) {
    if (y) yield;
    dressRows(src, out, w, y, Math.min(h, y + band), shares, luts, flecks, record, light);
  }
  return { ...layer, colors: out };
}

/** dressRecordSteps' rows `y0` to `y1` (a plain function: the engine optimises its loop as it does not a generator's). */
function dressRows(src, out, w, y0, y1, shares, luts, flecks, record, light) {
  const nc = luts.length,
    cell = Math.max(1, Math.round((DRESS_DIALS.fleckTexels * w) / 128));
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < w; x++) {
      const k = y * w + x,
        o = k * 4,
        R = src[o],
        G = src[o + 1],
        B = src[o + 2],
        L = lumOf(R, G, B);
      let r = 0,
        g = 0,
        b = 0,
        fShare = 0,
        fi = -1,
        fT = 0.5;
      for (let i = 0; i < nc; i++) {
        const wi = shares ? shares[i][k] : 1;
        if (!(wi > 0)) continue;
        const t = luts[i];
        if (!t) {
          r += R * wi;
          g += G * wi;
          b += B * wi;
          continue;
        }
        const f = L * t.scale,
          j = f | 0,
          u = f - j,
          dl = L - t.lum;
        r += (t.r[j] + (t.r[j + 1] - t.r[j]) * u + (R - t.pr - dl) * t.keep) * wi;
        g += (t.g[j] + (t.g[j + 1] - t.g[j]) * u + (G - t.pg - dl) * t.keep) * wi;
        b += (t.b[j] + (t.b[j + 1] - t.b[j]) * u + (B - t.pb - dl) * t.keep) * wi;
        if (flecks[i] && wi > fShare) {
          fShare = wi;
          fi = i;
          fT = t.t[j] + (t.t[j + 1] - t.t[j]) * u;
        }
      }
      if (fi >= 0 && fShare > 0.5) {
        const f = /** @type {any} */ (flecks[fi]),
          cx = Math.floor(x / cell),
          cy = Math.floor(y / cell);
        if (fleckDraw(cx, cy, record, f.salt) < f.share) {
          const col = f.colors[Math.floor(fleckDraw(cx, cy, record, f.salt + 1) * f.colors.length)],
            lift = light * (0.85 + 0.3 * (fT - 0.5));
          const kk = DRESS_DIALS.fleckBlend * fShare;
          r += (col[0] * lift - r) * kk;
          g += (col[1] * lift - g) * kk;
          b += (col[2] * lift - b) * kk;
        }
      }
      out[o] = r < 0 ? 0 : r > 255 ? 255 : Math.round(r);
      out[o + 1] = g < 0 ? 0 : g > 255 ? 255 : Math.round(g);
      out[o + 2] = b < 0 ? 0 : b > 255 ? 255 : Math.round(b);
      out[o + 3] = src[o + 3];
    }
  }
}

/** A set's land luminance: the mean of its dirt's, grass's and stone's prototypes' (0 where none stands). */
export function landLuminance(protos) {
  const land = [1, 2, 3].map((c) => protos[c]).filter(Boolean);
  return land.length ? land.reduce((a, p) => a + /** @type {any} */ (p).lum, 0) / land.length : 0;
}
/** A drawn set's EXPOSURE: its land's luminance over the classic set's (`classic` the player's own records of the same
 *  archive) - 1 for the classic set itself, or where either has no land. */
export function setExposure(layers, classic) {
  const a = landLuminance(setPrototypes(layers)),
    b = classic ? landLuminance(setPrototypes(classic)) : 0;
  return a > 0 && b > 0 ? a / b : 1;
}

/**
 * A SET DRESSED, a record a step (yields between records; its value the dressed layers) - the build's breather walks it
 * (world/puddleMask.js stepsBreathing). `layers` the set as it is drawn (its puddles marked in alpha), `dress` a zone's,
 * `exposure` the drawn set's against the classic (setExposure).
 * @param {ReadonlyArray<{ width: number, height: number, colors: ArrayLike<number> }>} layers @param {any} dress
 * @param {number} [exposure]
 */
export function* dressLayersSteps(layers, dress, exposure = 1) {
  const mats = compileDress(dress),
    protos = setPrototypes(layers);
  const out = layers.slice();
  if (!mats.some(Boolean)) return out;
  const light = DRESS_DIALS.albedo * exposure;
  for (let r = 0; r < layers.length; r++) {
    out[r] = yield* dressRecordSteps(layers[r], r, mats, protos, light);
    yield;
  }
  return out;
}

/** dressLayersSteps run through (the pins' and the probes' door). */
export function dressLayers(layers, dress, exposure = 1) {
  const steps = dressLayersSteps(layers, dress, exposure);
  for (;;) {
    const r = steps.next();
    if (r.done) return r.value;
  }
}
