// C6i: IN-HOUSE back derivation (no AI generation - Mac's mandate).
// Everything derives from data we already own:
//   MATERIAL - the mirrored front supplies each pixel's palette RAMP
//     (ART_PAL is organized in shading ramps; a pixel's ramp = its
//     material, its position = its lit level).
//   SHADING - our own back-shell geometry: normals from the distance
//     field's gradient, lit by one fixed key, quantized back into the
//     SAME ramp. Front-baked forms (pecs, face, breastplate design)
//     vanish because levels are recomputed, not copied.
//   DETAIL - procedural features parameterized from landmarks detected
//     in the front sprite itself: hair fill (the front's own hair
//     ramp) over the head region, a spine line + scapula highlights on
//     the torso, and for armor a center ridge + lame lines at the rows
//     where the FRONT's real design changes level.
// Deterministic, classic-palette, dye-band safe (armor stays in
// 0x70-0x7F because relighting never leaves the source ramp).
// Usage: ARENA2_PATH=... node tools/derive-back.mjs [body|cuirass ...]
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { ImgFile } from '../src/formats/imgFile.js';
import { TextureFile } from '../src/formats/textureFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';
import { distanceField, DEPTH_RATIO } from '../src/characters/spriteRelief.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_JSON = resolve(ROOT, 'src/characters/backs');
const OUT_DRAFT = resolve(ROOT, 'back-drafts');
mkdirSync(OUT_JSON, { recursive: true });
mkdirSync(OUT_DRAFT, { recursive: true });

const A = process.env.ARENA2_PATH;
if (!A) { console.error('ARENA2_PATH required'); process.exit(1); }
const pal = new DFPalette();
pal.load(readFileSync(`${A}/ART_PAL.COL`), 'ART_PAL.COL');

// ── ART_PAL ramp decomposition ───────────────────────────────────────
// A ramp is a maximal contiguous index run of similar hue with
// monotonically decreasing luminance (classic ramps run light -> dark).
const lum = (i) => { const c = pal.get(i); return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b; };
const hue = (i) => { const c = pal.get(i); const mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b); if (mx === mn) return -1; let h; if (mx === c.r) h = (c.g - c.b) / (mx - mn); else if (mx === c.g) h = 2 + (c.b - c.r) / (mx - mn); else h = 4 + (c.r - c.g) / (mx - mn); return ((h * 60) + 360) % 360; };
const hueDist = (a, b) => (a < 0 || b < 0) ? 0 : Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
const RAMP = new Array(256).fill(null);
{
  let start = 1;
  for (let i = 2; i <= 256; i++) {
    const breaks = i === 256
      || lum(i) > lum(i - 1) + 6            // luminance rises = new ramp
      || hueDist(hue(i), hue(i - 1)) > 40;  // hue jump = new ramp
    if (breaks) {
      for (let j = start; j < i; j++) RAMP[j] = { start, len: i - start };
      start = i;
    }
  }
}
const BACK_BIAS = 0.14;        // the back turns from the key: darker overall
const hash2 = (x, y) => {      // deterministic dither for hair texture
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
};
const relit = (srcIdx, shade) => { // shade 0 = brightest .. 1 = darkest
  const r = RAMP[srcIdx];
  if (!r || r.len < 2) return srcIdx;
  return r.start + Math.min(r.len - 1, Math.max(0, Math.round(shade * (r.len - 1))));
};

// ── back-surface shading from our own geometry ───────────────────────
const KEY = (() => { const v = [-0.35, 0.55, -0.75]; const l = Math.hypot(...v); return v.map((x) => x / l); })();
function backShade(field, W, H, x, y) {
  const f = (xx, yy) => (xx < 0 || yy < 0 || xx >= W || yy >= H) ? 0 : field[yy * W + xx];
  const z = (xx, yy) => DEPTH_RATIO * Math.sqrt(f(xx, yy));
  const dzdx = (z(x + 1, y) - z(x - 1, y)) / 2;
  const dzdy = (z(x, y + 1) - z(x, y - 1)) / 2;
  // Back surface: z is negated -> normal [dz/dx, -dz/dy(y-up flip), -1]
  let nx = dzdx, ny = -dzdy, nz = -1;
  const nl = Math.hypot(nx, ny, nz);
  nx /= nl; ny /= nl; nz /= nl;
  const d = nx * KEY[0] + ny * KEY[1] + nz * KEY[2];
  return 1 - Math.max(0, Math.min(1, d * 0.5 + 0.5)); // 0 bright .. 1 dark
}

// ── per-row runs (landmarks in the front's own pixels) ───────────────
function rowRuns(data, W, H) {
  const rows = [];
  for (let y = 0; y < H; y++) {
    const runs = []; let s = -1;
    for (let x = 0; x <= W; x++) {
      const on = x < W && data[y * W + x] !== 0;
      if (on && s < 0) s = x;
      if (!on && s >= 0) { runs.push([s, x - 1]); s = -1; }
    }
    rows.push(runs);
  }
  return rows;
}

// The torso run on a row = the run holding the silhouette centreline
// (arm-gap rows put the arm first or last depending on side).
function torsoRun(runs, cx) {
  if (!runs.length) return null;
  let best = runs[0], bd = Infinity;
  for (const r of runs) {
    const d = cx >= r[0] && cx <= r[1] ? 0 : Math.min(Math.abs(cx - r[0]), Math.abs(cx - r[1]));
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}

const TARGETS = {
  body: {
    json: 'body00i0.json',
    load: () => { const img = new ImgFile(); img.load(readFileSync(`${A}/BODY00I0.IMG`), 'BODY00I0.IMG', pal); return img.getDFBitmap(); },
    features: (grid, mir, W, H, field) => {
      const rows = rowRuns(mir, W, H);
      let armpit = 0;
      for (let y = 0; y < H; y++) if (rows[y].length >= 2) { armpit = y; break; }
      // Hair ramp + its LEVEL DISTRIBUTION from the front's own hair
      // pixels (top 6 rows): the back of the head must read as HAIR,
      // not a blank skin-toned blob - textured dither over the darker
      // half of the observed level range.
      const count = new Map();
      let lvSum = 0, lvN = 0;
      for (let y = 0; y < Math.min(6, H); y++) for (let x = 0; x < W; x++) {
        const i = mir[y * W + x];
        if (i && RAMP[i]) {
          count.set(RAMP[i].start, (count.get(RAMP[i].start) || 0) + 1);
          lvSum += (i - RAMP[i].start) / Math.max(1, RAMP[i].len - 1); lvN++;
        }
      }
      const hairStart = [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const hairRamp = { start: hairStart, len: RAMP[hairStart].len };
      const hairBase = Math.min(0.85, (lvSum / Math.max(1, lvN)) + 0.15);
      let neck = armpit - 1, neckW = Infinity;
      for (let y = Math.max(0, armpit - 14); y < armpit; y++) {
        if (rows[y].length !== 1) continue;
        const w = rows[y][0][1] - rows[y][0][0] + 1;
        if (w <= neckW) { neckW = w; neck = y; }
      }
      // Hair covers the whole head DOWN THROUGH the neck pinch + 2 (a
      // back shows more hair), dithered two-tone; a darkest hairline
      // edge row terminates it.
      const hairEnd = Math.min(H - 1, neck + 2);
      for (let y = 0; y <= hairEnd; y++) for (let x = 0; x < W; x++) {
        if (!mir[y * W + x]) continue;
        const sh = backShade(field, W, H, x, y);
        const tex = hash2(x, y) > 0.5 ? 0.12 : -0.08;
        const lv = y === hairEnd ? 1 : Math.min(1, Math.max(0, hairBase + tex + sh * 0.3));
        grid[y * W + x] = hairRamp.start + Math.min(hairRamp.len - 1, Math.round(lv * (hairRamp.len - 1)));
      }
      // Skin unification below the hair: cross-ramp painted accents
      // (nipples/navel/face leftovers) are FRONT features - remap any
      // skin-hue ramp to the region's dominant skin ramp, then those
      // forms cannot survive.
      const skinCount = new Map();
      for (let y = hairEnd + 1; y < H; y++) for (let x = 0; x < W; x++) {
        const i = mir[y * W + x];
        if (i && RAMP[i]) skinCount.set(RAMP[i].start, (skinCount.get(RAMP[i].start) || 0) + 1);
      }
      const domSkin = [...skinCount.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const domHue = hue(domSkin + ((RAMP[domSkin].len / 2) | 0));
      for (let y = hairEnd + 1; y < H; y++) for (let x = 0; x < W; x++) {
        const src = mir[y * W + x];
        if (!src || !RAMP[src] || RAMP[src].start === domSkin) continue;
        const h = hue(src);
        if (hueDist(h, domHue) < 30) {
          const sh = Math.min(1, backShade(field, W, H, x, y) + BACK_BIAS);
          grid[y * W + x] = domSkin + Math.min(RAMP[domSkin].len - 1, Math.round(sh * (RAMP[domSkin].len - 1)));
        }
      }
      const midX = (W - 1) / 2;
      let crotch = H - 1;
      for (let y = armpit; y < H; y++) {
        const r = rows[y];
        if (r.length === 2 && r[0][1] < midX && r[1][0] > midX) { crotch = y; break; }
      }
      const lastTorso = crotch - 1;
      const spineTop = armpit + 2;
      const level = (i) => (i && RAMP[i]) ? (i - RAMP[i].start) / Math.max(1, RAMP[i].len - 1) : 0;
      // Spine v2: a real groove - 1px highlight beside a 2px shadow,
      // strongest between the scapulae, easing toward the waist.
      for (let y = spineTop; y <= lastTorso; y++) {
        const run = torsoRun(rows[y], midX);
        if (!run) continue;
        const cx = Math.round((run[0] + run[1]) / 2);
        const ease = 0.5 + 0.5 * (1 - (y - spineTop) / Math.max(1, lastTorso - spineTop));
        for (const [dx, d] of [[-1, -0.22 * ease], [0, 0.5 * ease], [1, 0.32 * ease]]) {
          const i = grid[y * W + cx + dx];
          if (i && RAMP[i]) grid[y * W + cx + dx] = relit(i, Math.min(1, Math.max(0, level(i) + d)));
        }
      }
      // Scapulae v2: larger two-tone plates (top-lit, under-shadowed).
      const scapY = spineTop + Math.round((lastTorso - spineTop) * 0.16);
      const torso = torsoRun(rows[scapY], midX);
      const tw = torso[1] - torso[0] + 1;
      for (const side of [-1, 1]) {
        const cx = Math.round((torso[0] + torso[1]) / 2 + side * tw * 0.27);
        const rx = Math.max(2, Math.round(tw * 0.16)), ry = rx * 2;
        for (let dy = -ry; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++) {
          if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) > 1) continue;
          const x = cx + dx, y = scapY + dy;
          const i = grid[y * W + x];
          if (!i || !RAMP[i]) continue;
          const d = dy < 0 ? -0.3 : 0.22; // lit plate above, shadow under
          grid[y * W + x] = relit(i, Math.min(1, Math.max(0, level(i) + d)));
        }
      }
      // Lower-back dip: a shaded band just above the crotch.
      for (let y = lastTorso - 3; y <= lastTorso; y++) {
        const run = torsoRun(rows[y], midX);
        if (!run) continue;
        for (let x = run[0] + 1; x < run[1]; x++) {
          const i = grid[y * W + x];
          if (i && RAMP[i]) grid[y * W + x] = relit(i, Math.min(1, level(i) + 0.15));
        }
      }
      return { hairStart, hairEnd, neck, armpit, spineTop, lastTorso, domSkin };
    },
  },
  cuirass: {
    json: 'cuirass-251-4.json',
    load: () => { const t = new TextureFile(); t.load(readFileSync(`${A}/TEXTURE.251`), 'TEXTURE.251', pal); return t.getDFBitmap(4, 0); },
    features: (grid, mir, W, H, field) => {
      const rows = rowRuns(mir, W, H);
      const level = (i) => (i && RAMP[i]) ? (i - RAMP[i].start) / Math.max(1, RAMP[i].len - 1) : 0;
      const midX = (W - 1) / 2;
      // A backplate does NOT echo the front's design (v1 defect - it
      // read as the front). Plain relit plate + leather cross-straps
      // with buckles: the real construction of a cuirass rear, and an
      // immediate silhouette-independent back tell. Straps stay
      // leather under every metal dye (material-honest).
      const LEATHER = 0x40; // classic leather band
      const lramp = RAMP[LEATHER + 4] || { start: LEATHER, len: 16 };
      let top = 0;
      while (top < H && !rows[top].length) top++;
      let bottom = H - 1;
      while (bottom > 0 && !rows[bottom].length) bottom--;
      const strap = (x0, y0, x1, y1, w) => {
        const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const cx = Math.round(x0 + (x1 - x0) * t);
          const cy = Math.round(y0 + (y1 - y0) * t);
          for (let dx = -w; dx <= w; dx++) {
            const x = cx + dx, y = cy;
            if (x < 0 || x >= W || y < 0 || y >= H || !mir[y * W + x]) continue;
            const sh = Math.min(1, backShade(field, W, H, x, y) + BACK_BIAS);
            const edge = Math.abs(dx) === w ? 0.25 : 0;
            grid[y * W + x] = lramp.start + Math.min(lramp.len - 1, Math.round(Math.min(1, sh * 0.6 + 0.25 + edge) * (lramp.len - 1)));
          }
        }
      };
      const span = bottom - top;
      const ly = top + Math.round(span * 0.12), by = top + Math.round(span * 0.78);
      const shoulderRuns = rows[top + Math.round(span * 0.15)];
      const run1 = torsoRun(rows[top + Math.round(span * 0.75)], midX);
      // The gorget top splits into two shoulder runs around the neck
      // gap - anchor one strap on each; a single wide run anchors at
      // its edges.
      let lx, rx;
      if (shoulderRuns.length >= 2) {
        const L = shoulderRuns[0], R = shoulderRuns[shoulderRuns.length - 1];
        lx = Math.round((L[0] + L[1]) / 2);
        rx = Math.round((R[0] + R[1]) / 2);
      } else {
        const r0 = shoulderRuns[0];
        lx = r0[0] + 2; rx = r0[1] - 2;
      }
      strap(lx, ly, Math.round((run1[0] + run1[1]) / 2) + 4, by, 1);
      strap(rx, ly, Math.round((run1[0] + run1[1]) / 2) - 4, by, 1);
      // Buckles: darkest-metal 2x2 where the straps meet the plate edge.
      const buckle = (x, y) => {
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
          const i = mir[(y + dy) * W + x + dx];
          if (i) grid[(y + dy) * W + x + dx] = 0x7e;
        }
      };
      buckle(lx - 1, ly); buckle(rx - 1, ly);
      // Centre ridge (kept from v1).
      for (let y = top; y <= bottom; y++) {
        if (!rows[y].length) continue;
        const run = torsoRun(rows[y], midX);
        const cx = Math.round((run[0] + run[1]) / 2);
        const hi = grid[y * W + cx];
        if (hi && RAMP[hi] && RAMP[hi].start === 0x70) grid[y * W + cx] = relit(hi, Math.max(0, level(hi) - 0.25));
        const sh = grid[y * W + cx + 1];
        if (sh && RAMP[sh] && RAMP[sh].start === 0x70) grid[y * W + cx + 1] = relit(sh, Math.min(1, level(sh) + 0.2));
      }
      return { straps: [[lx, ly], [rx, ly]], top, bottom };
    },
  },
};

function derive(name) {
  const T = TARGETS[name];
  const bmp = T.load();
  const { width: W, height: H } = bmp;
  // Rear-view space: mirror the front.
  const mir = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) mir[y * W + x] = bmp.data[y * W + (W - 1 - x)];
  const mbmp = { width: W, height: H, data: mir };
  const field = distanceField(mbmp);
  // Base: material from the mirror, level from OUR geometry.
  const grid = new Array(W * H).fill(0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const src = mir[y * W + x];
    if (!src) continue;
    grid[y * W + x] = relit(src, Math.min(1, backShade(field, W, H, x, y) + BACK_BIAS));
  }
  const params = T.features(grid, mir, W, H, field);
  writeFileSync(resolve(OUT_JSON, T.json),
    JSON.stringify({ width: W, height: H, rearViewSpace: true, derivation: 'inhouse-v1', params, data: grid }));
  const draft = new PNG({ width: W * 4, height: H * 4 });
  for (let y = 0; y < H * 4; y++) for (let x = 0; x < W * 4; x++) {
    const idx = grid[((y / 4) | 0) * W + ((x / 4) | 0)];
    const c = idx === 0 ? { r: 34, g: 34, b: 38 } : pal.get(idx);
    const o = (y * W * 4 + x) * 4;
    draft.data[o] = c.r; draft.data[o + 1] = c.g; draft.data[o + 2] = c.b; draft.data[o + 3] = 255;
  }
  writeFileSync(resolve(OUT_DRAFT, `${name}-back.png`), PNG.sync.write(draft));
  console.log(`${name}: inhouse back derived (${JSON.stringify(params).slice(0, 120)})`);
}

const targets = process.argv.slice(2).length ? process.argv.slice(2) : ['body', 'cuirass'];
for (const t of targets) {
  if (!TARGETS[t]) { console.error(`unknown target: ${t}`); process.exit(1); }
  derive(t);
}
