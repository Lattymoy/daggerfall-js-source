// SHADOW-FANG (2026-09-26, Mac): "Wants a custom morrowind werewolf skin (skin base but blacker amd like crimson red
// thru out the edging in the fur, red eyes)" - for SirMcMobdon, whose title and glyph are Shadow Fang
// (ui/playerBadge.js). The werewolf is Bloodmoon's (WEREWOLF1: combat/fpArm.js builds it from the player's own
// Bloodmoon data), so its textures are the player's own files and never this repo's: the skin cannot be a painted
// texture shipped with the build. It is a LAW over the texture's pixels, applied on the way to the GPU, to a copy -
// the decoded texture cache is shared by every rig on the page (the local body and every peer's).
//
// ═══ WHO WEARS IT ══════════════════════════════════════════════════
//
// The holder of the Shadow Fang GLYPH. A glyph is TRUE of a player and rides the identity token the relay verifies,
// so every client in a room reads the same grant off the same signature: the peer who is SirMcMobdon is drawn in it
// on everybody's screen, and nobody can type themselves into it. The player's own screen reads the glyphs the
// account service last stated for this device (net/accountClient.js keeps them on the stored session; systems/
// ownGlyphs.js reads them), so the skin is theirs offline too - a local read of a cosmetic, which only that player sees.
// This module is the LAW alone and imports nothing: the rig (combat/fpArm.js) takes it without the storage.
//
// ═══ THE LAW ═══════════════════════════════════════════════════════
//
// AUDIT F (2026-09-26, the audit before the merge) remade it - bible/04-Characters/Werewolf-Body.md, "AUDIT".
//
// ON THE TEXTURE'S FIRST LEVEL, and the rest of its chain is that level box-filtered down, each level keeping its own
// alpha (AUDIT F4: the law run on every level apart faded the edging with distance and grew a cut's fringe a texel a
// level - the colour popped as the wolf walked away). Per texel (alpha is kept; a texel of alpha 0 is left alone, and
// any other is dressed):
//   THE EYES burn red, WHERE THE EYES ARE: every texel of a texture - or a shape - that names an eye, and on the HEAD's
//   own texture a small, compact blob that glows (bright and saturated in the yellow-to-cyan hues, or a hot red) well
//   above the texels round it. Never a colour alone and never the body's fur (AUDIT F2: golden, wheat, amber and
//   auburn fur burned red by colour, in blotches). An eye's own dark - a pupil - keeps its dark.
//   THE BASE is the skin's own colour, blacker: 0.3 of its light, 40% of its colour drained toward its grey - so the
//   wolf is still its own wolf, in shadow.
//   THE EDGING is crimson, through the fur: a strand lighter than the fur round it (the texel's light over its 5x5
//   neighbourhood's), the lit tips - the lightest of THIS texture's own texels (AUDIT F3: a fixed brightness turned a
//   blond or a cream wolf red all over) - and, on an ALPHA-TESTED card alone, the fringe beside a cut (AUDIT F6: an
//   opaque texture's UV padding is no fur's edge, and no texel is its own fringe). Its weight is the strongest of the
//   three, the crimson lit by the texel's own light. The neighbourhood and the fringe wrap as the texture does.

/** The skins that exist, and the glyph that dresses a werewolf in each. */
export const WEREWOLF_SKINS = Object.freeze(['shadowfang']);
export const SKIN_GLYPH = Object.freeze({ shadowfang: 'shadowfang' });

/** The skin a player's glyphs dress their werewolf in, or null. */
export function werewolfSkinOf(glyphs) {
  if (!Array.isArray(glyphs)) return null;
  for (const s of WEREWOLF_SKINS) if (glyphs.includes(SKIN_GLYPH[s])) return s;
  return null;
}

/** Shadow Fang's constants, in one place: the base's light and drain, the three edging rules, the two reds, and what
 *  an eye blob on the head's texture must be. */
export const SHADOW_FANG = Object.freeze({
  dark: 0.3,                                  // the base keeps this share of its light
  drain: 0.4,                                 // and loses this share of its colour toward its grey
  strand: Object.freeze([0.04, 0.15, 0.85]),  // a strand: its light over the neighbourhood's, low to high, and its weight
  tip: Object.freeze([0.85, 0.97, 0.6]),      // the lit tips: the texture's own light at these two quantiles, and the weight
  tipSpan: 0.04,                              // quantiles closer than this are a flat colour: it has no tips
  fringe: 0.65,                               // an alpha-cut card's fringe
  crimson: Object.freeze([196, 18, 48]),      // #c41230
  eye: Object.freeze([255, 34, 46]),          // #ff222e - the glyph's own eye (ui/playerBadge.js GLYPH_DETAIL)
  // an eye on the head's texture: at least `min` texels, at most `share` of the texture's, filling `fill` of its box,
  // no longer than `aspect` times its width, `lift` brighter (its brightest channel) than the texels round it, and
  // ALONE there - no more than `crowd` of the texels round it another blob's eye colour
  eyeBlob: Object.freeze({ min: 6, share: 1 / 256, fill: 0.25, aspect: 4, lift: 0.3, crowd: 0.1 }),
});

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Is this texture (or shape) an eye's, by its name - Morrowind names its eye textures so (tx_*eye*). */
export const isEyeTexture = (file) => /eye/i.test(String(file || ''));

/** A texel that glows the way an eye does: bright and saturated in the yellow-to-cyan hues (a beast's eye), or a hot,
 *  saturated red (an eye already red). A CANDIDATE only - on the head's texture an eye is also a small blob standing
 *  above its ring (eyeBlobs); the colour alone takes golden fur for an eye. */
export function looksLikeEye(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!mx || !d) return false;
  const s = d / mx, v = mx / 255;
  let hue = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hue = (hue * 60 + 360) % 360;
  return (v > 0.7 && s > 0.55 && hue >= 40 && hue <= 200) || (v > 0.8 && s > 0.7 && (hue >= 350 || hue <= 10));
}

/** Which rules a texture takes where a piece of the body wears it: the eyes ('all' - the texture or the shape names
 *  an eye; 'colour' - the head's own texture, where an eye is found; 'none' - the fur), whether its range is
 *  alpha-tested (a cut, whose fringe is edged), and its NiTexturingProperty clamp (3 wraps both ways). The piece is
 *  mwFirstPerson's: `slot` 'head' for WerewolfHead (or 'head (werewolfrobe)' for a robe's), `material`, the shape's
 *  name on `shape` or its batch. */
export function skinUseOf(piece, file = '') {
  const m = piece?.material ?? null;
  const shape = piece?.shape ?? piece?.batch?.name ?? '';
  const head = /^head(\s|$)/i.test(String(piece?.slot ?? ''));
  return {
    file,
    eyes: isEyeTexture(file) || isEyeTexture(shape) ? 'all' : head ? 'colour' : 'none',
    cut: !!(m && m.alphaTest),
    clamp: m && Number.isInteger(m.clampMode) ? m.clampMode & 3 : 3,
  };
}

/** The key a skinned copy is kept under: one texture may be worn under several uses. */
export const skinUseKey = (skin, use) => `${skin}|${use?.eyes ?? 'none'}|${use?.cut ? 1 : 0}|${(use?.clamp ?? 3) & 3}`;

/** Each index's 2r+1 taps along an axis of `size`, wrapped or clamped (-1: off the edge) - built once a pass, so no
 *  tap pays a modulo. */
function tapsOf(size, r, wrap) {
  const n = 2 * r + 1, t = new Int32Array(size * n);
  for (let x = 0; x < size; x++) {
    for (let d = -r; d <= r; d++) {
      const j = x + d;
      t[x * n + d + r] = wrap ? ((j % size) + size) % size : (j < 0 || j >= size ? -1 : j);
    }
  }
  return t;
}

/** The 5x5 mean light of every texel over its opaque neighbours, wrapping as the texture does - two 5-tap passes over
 *  precomputed taps (a row, then a column). */
function neighbourhoodLight(L, A, w, h, wrapS, wrapT) {
  const R = 2, N = 2 * R + 1;
  const cx = tapsOf(w, R, wrapS), cy = tapsOf(h, R, wrapT);
  const sumH = new Float32Array(w * h), cntH = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let s = 0, c = 0;
      for (let t = x * N, e = t + N; t < e; t++) {
        const xx = cx[t];
        if (xx < 0) continue;
        const j = row + xx;
        if (A[j] >= 128) { s += L[j]; c++; }
      }
      sumH[row + x] = s; cntH[row + x] = c;
    }
  }
  const mean = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0, c = 0;
      for (let t = y * N, e = t + N; t < e; t++) {
        const yy = cy[t];
        if (yy < 0) continue;
        const j = yy * w + x;
        s += sumH[j]; c += cntH[j];
      }
      const i = y * w + x;
      mean[i] = c ? s / c : L[i];
    }
  }
  return mean;
}

/** Every texel with a transparent (alpha under 128) texel among its eight neighbours or itself - a 3x3 dilation of
 *  the holes, a row then a column, wrapping as the texture does. */
function besideACut(A, w, h, wrapS, wrapT) {
  const cx = tapsOf(w, 1, wrapS), cy = tapsOf(h, 1, wrapT);
  const row = new Uint8Array(w * h), near = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const o = y * w;
    for (let x = 0; x < w; x++) {
      for (let t = x * 3, e = t + 3; t < e; t++) { const xx = cx[t]; if (xx >= 0 && A[o + xx] < 128) { row[o + x] = 1; break; } }
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let t = y * 3, e = t + 3; t < e; t++) { const yy = cy[t]; if (yy >= 0 && row[yy * w + x]) { near[y * w + x] = 1; break; } }
    }
  }
  return near;
}

/** The texture's own light at two quantiles, over its opaque texels (a 256-bin histogram). */
function lightQuantiles(L, A, qLo, qHi) {
  const hist = new Uint32Array(256);
  let n = 0;
  for (let i = 0; i < L.length; i++) if (A[i] >= 128) { hist[Math.min(255, (L[i] * 255) | 0)]++; n++; }
  if (!n) return [0, 0];
  const at = (q) => {
    const want = q * n;
    let acc = 0;
    for (let b = 0; b < 256; b++) { acc += hist[b]; if (acc >= want) return (b + 0.5) / 255; }
    return 1;
  };
  return [at(qLo), at(qHi)];
}

/** The eyes on a head's texture: the 8-connected blobs of eye-coloured opaque texels that are small (SHADOW_FANG
 *  eyeBlob `min` to `share` of the texture), compact (filling `fill` of their box, no longer than `aspect` times
 *  their width), glowing (`lift` brighter, by the brightest channel - a red eye is bright and dark in luminance at
 *  once - than the opaque texels within two of their box) and alone (`crowd`). A fur of the eye's colour is one great
 *  blob, or strands and specks crowded by their kind and no brighter than the fur round them - none of them an eye. */
function eyeBlobs(rgba, A, w, h, isEye) {
  const k = SHADOW_FANG.eyeBlob;
  const n = w * h;
  const cand = new Uint8Array(n), V = new Float32Array(n);
  let any = false;
  for (let i = 0, o = 0; i < n; i++, o += 4) {
    V[i] = Math.max(rgba[o], rgba[o + 1], rgba[o + 2]) / 255;
    if (A[i] >= 128 && isEye(rgba[o], rgba[o + 1], rgba[o + 2])) { cand[i] = 1; any = true; }
  }
  const eye = new Uint8Array(n);
  if (!any) return eye;
  const most = Math.max(k.min, Math.floor(n * k.share));
  const blob = new Int32Array(n).fill(-1);
  const stack = [], members = [];
  for (let i0 = 0; i0 < n; i0++) {
    if (!cand[i0] || blob[i0] >= 0) continue;
    stack.length = 0; members.length = 0;
    stack.push(i0); blob[i0] = i0;
    let x0 = w, x1 = -1, y0 = h, y1 = -1, sum = 0;
    while (stack.length) {
      const i = stack.pop();
      members.push(i); sum += V[i];
      const x = i % w, y = (i - x) / w;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const j = yy * w + xx;
          if (cand[j] && blob[j] < 0) { blob[j] = i0; stack.push(j); }
        }
      }
    }
    const area = members.length;
    if (area < k.min || area > most) continue;
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    if (area / (bw * bh) < k.fill || Math.max(bw, bh) > k.aspect * Math.min(bw, bh)) continue;
    let rs = 0, rc = 0, crowd = 0;
    for (let y = Math.max(0, y0 - 2); y <= Math.min(h - 1, y1 + 2); y++) {
      for (let x = Math.max(0, x0 - 2); x <= Math.min(w - 1, x1 + 2); x++) {
        const j = y * w + x;
        if (A[j] < 128) continue;
        if (cand[j]) { if (blob[j] !== i0) crowd++; continue; }
        rs += V[j]; rc++;
      }
    }
    if (!rc || crowd > k.crowd * (rc + crowd) || sum / area - rs / rc < k.lift) continue;
    for (const i of members) eye[i] = 1;
  }
  return eye;
}

/**
 * SHADOW FANG over one level's RGBA texels (row-major, 4 bytes a texel). Answers a NEW array; the input is never
 * written - it is the shared cache's.
 * @param {Uint8Array} rgba
 * @param {number} w
 * @param {number} h
 * @param {{ eyes?: 'all'|'colour'|'none', cut?: boolean, wrapS?: boolean, wrapT?: boolean,
 *   isEye?: (r: number, g: number, b: number) => boolean }} [opts]
 */
export function shadowFangPixels(rgba, w, h, { eyes = 'none', cut = true, wrapS = true, wrapT = true, isEye = looksLikeEye } = {}) {
  const k = SHADOW_FANG;
  const n = w * h;
  const out = new Uint8Array(n * 4);
  if (!n) return out;
  const L = new Float32Array(n), A = new Uint8Array(n);
  for (let i = 0, o = 0; i < n; i++, o += 4) {
    L[i] = (0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2]) / 255;
    A[i] = rgba[o + 3];
  }
  const allEye = eyes === 'all';
  const eye = eyes === 'colour' ? eyeBlobs(rgba, A, w, h, isEye) : null;
  const mean = allEye ? null : neighbourhoodLight(L, A, w, h, wrapS, wrapT);
  const [tipLo, tipHi] = allEye ? [0, 0] : lightQuantiles(L, A, k.tip[0], k.tip[1]);
  const tips = tipHi - tipLo >= k.tipSpan;
  const near = cut && !allEye ? besideACut(A, w, h, wrapS, wrapT) : null;
  for (let i = 0, o = 0; i < n; i++, o += 4) {
    const r = rgba[o], g = rgba[o + 1], b = rgba[o + 2], a = rgba[o + 3];
    out[o + 3] = a;
    if (!a) { out[o] = r; out[o + 1] = g; out[o + 2] = b; continue; }
    const l = L[i];
    if (allEye || (eye && eye[i])) {
      const q = 0.25 + 0.75 * Math.min(1, l / 0.6);   // the eye's light: its glow burns, its pupil stays dark
      out[o] = (k.eye[0] * q + 0.5) | 0; out[o + 1] = (k.eye[1] * q + 0.5) | 0; out[o + 2] = (k.eye[2] * q + 0.5) | 0;
      continue;
    }
    const grey = l * 255;
    const br = (r * (1 - k.drain) + grey * k.drain) * k.dark;
    const bg = (g * (1 - k.drain) + grey * k.drain) * k.dark;
    const bb = (b * (1 - k.drain) + grey * k.drain) * k.dark;
    const strand = smooth(k.strand[0], k.strand[1], l - mean[i]) * k.strand[2];
    const tip = tips ? smooth(tipLo, tipHi, l) * k.tip[2] : 0;
    const fringe = near && a >= 128 && near[i] ? k.fringe : 0;
    const wgt = Math.min(1, Math.max(strand, tip, fringe));
    const lit = 0.5 + 0.7 * l;
    out[o] = (br * (1 - wgt) + k.crimson[0] * lit * wgt + 0.5) | 0;
    out[o + 1] = (bg * (1 - wgt) + k.crimson[1] * lit * wgt + 0.5) | 0;
    out[o + 2] = (bb * (1 - wgt) + k.crimson[2] * lit * wgt + 0.5) | 0;
  }
  return out;
}

/** One level box-filtered to the next one's size: each colour the alpha-weighted mean of its footprint (a cut
 *  texel's own colour lends nothing to the fur), the alpha the plain mean. */
export function downsampleLevel(src, sw, sh, dw, dh) {
  const out = new Uint8Array(dw * dh * 4);
  for (let y = 0; y < dh; y++) {
    const y0 = Math.floor((y * sh) / dh), y1 = Math.max(y0 + 1, Math.floor(((y + 1) * sh) / dh));
    for (let x = 0; x < dw; x++) {
      const x0 = Math.floor((x * sw) / dw), x1 = Math.max(x0 + 1, Math.floor(((x + 1) * sw) / dw));
      let r = 0, g = 0, b = 0, a = 0, rw = 0, gw = 0, bw = 0, c = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const o = (yy * sw + xx) * 4, al = src[o + 3];
          r += src[o]; g += src[o + 1]; b += src[o + 2]; a += al; c++;
          rw += src[o] * al; gw += src[o + 1] * al; bw += src[o + 2] * al;
        }
      }
      const o = (y * dw + x) * 4;
      if (a) { out[o] = (rw / a + 0.5) | 0; out[o + 1] = (gw / a + 0.5) | 0; out[o + 2] = (bw / a + 0.5) | 0; }
      else { out[o] = (r / c + 0.5) | 0; out[o + 1] = (g / c + 0.5) | 0; out[o + 2] = (b / c + 0.5) | 0; }
      out[o + 3] = (a / c + 0.5) | 0;
    }
  }
  return out;
}

/**
 * A decoded texture's mips in a skin: the law on the FIRST level, and every later level that one box-filtered down,
 * keeping the level's own alpha (its cut is the texture's). Each level is its own copy; a skin nobody has - or a level
 * whose texels do not fill its size - is the mips as they are.
 * @param {Array<{width: number, height: number, rgba: Uint8Array}>} mips
 * @param {string|null} skin
 * @param {{file?: string, eyes?: 'all'|'colour'|'none', cut?: boolean, clamp?: number}|string} [use] skinUseOf's
 *   answer, or a file name alone (its eyes by name, a cut assumed, wrapping both ways)
 */
export function skinMips(mips, skin, use = {}) {
  if (skin !== 'shadowfang' || !Array.isArray(mips) || !mips.length) return mips;
  const u = typeof use === 'string' ? { file: use } : (use ?? {});
  if (mips.some((m) => !m?.rgba || m.rgba.length < m.width * m.height * 4)) return mips;
  const clamp = Number.isInteger(u.clamp) ? u.clamp & 3 : 3;
  const opts = { eyes: u.eyes ?? (isEyeTexture(u.file) ? 'all' : 'none'), cut: u.cut ?? true, wrapS: !!(clamp & 2), wrapT: !!(clamp & 1) };
  const top = mips[0];
  const out = [{ ...top, rgba: shadowFangPixels(top.rgba, top.width, top.height, opts) }];
  for (let lv = 1; lv < mips.length; lv++) {
    const prev = out[lv - 1], m = mips[lv];
    const rgba = downsampleLevel(prev.rgba, prev.width, prev.height, m.width, m.height);
    for (let i = 3; i < rgba.length; i += 4) rgba[i] = m.rgba[i];
    out.push({ ...m, rgba });
  }
  return out;
}
