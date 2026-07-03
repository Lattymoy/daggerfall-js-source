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
      // Head region: rows above the first arm separation, up to a neck
      // pinch - fill with the front's own hair ramp (dominant ramp of
      // the top 6 rows), shaded by geometry.
      let armpit = 0;
      for (let y = 0; y < H; y++) if (rows[y].length >= 2) { armpit = y; break; }
      const count = new Map();
      for (let y = 0; y < Math.min(6, H); y++) for (let x = 0; x < W; x++) {
        const i = mir[y * W + x];
        if (i && RAMP[i]) count.set(RAMP[i].start, (count.get(RAMP[i].start) || 0) + 1);
      }
      const hairStart = [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const hairRamp = { start: hairStart, len: RAMP[hairStart].len };
      // Neck = min single-run width in the 14 rows above the armpit.
      let neck = armpit - 1, neckW = Infinity;
      for (let y = Math.max(0, armpit - 14); y < armpit; y++) {
        if (rows[y].length !== 1) continue;
        const w = rows[y][0][1] - rows[y][0][0] + 1;
        if (w <= neckW) { neckW = w; neck = y; }
      }
      for (let y = 0; y < neck; y++) for (let x = 0; x < W; x++) {
        if (!mir[y * W + x]) continue;
        const sh = backShade(field, W, H, x, y);
        grid[y * W + x] = hairRamp.start + Math.min(hairRamp.len - 1, Math.round(sh * (hairRamp.len - 1)));
      }
      // Spine: darken the torso-run centreline from below the neck to
      // the crotch (first row whose two runs BOTH sit inside the torso
      // band = legs); scapulae: lighten two ellipses.
      const midX = (W - 1) / 2; // 0-indexed silhouette centreline
      let crotch = H - 1;
      for (let y = armpit; y < H; y++) {
        const r = rows[y];
        // Legs are the only 2-run rows whose inter-run gap straddles
        // the centreline (arm gaps sit off to one side).
        if (r.length === 2 && r[0][1] < midX && r[1][0] > midX) { crotch = y; break; }
      }
      const lastTorso = crotch - 1;
      const spineTop = armpit + 2;
      for (let y = spineTop; y <= lastTorso; y++) {
        const run = torsoRun(rows[y], midX);
        if (!run) continue;
        const cx = Math.round((run[0] + run[1]) / 2);
        for (const sx of [cx]) {
          const i = grid[y * W + sx];
          if (i && RAMP[i]) grid[y * W + sx] = relit(i, Math.min(1, (i - RAMP[i].start) / (RAMP[i].len - 1) + 0.34));
        }
      }
      const scapY = spineTop + Math.round((lastTorso - spineTop) * 0.18);
      const torso = torsoRun(rows[scapY], midX);
      const tw = torso[1] - torso[0] + 1;
      for (const side of [-1, 1]) {
        const cx = Math.round((torso[0] + torso[1]) / 2 + side * tw * 0.26);
        for (let dy = -2; dy <= 3; dy++) for (let dx = -2; dx <= 2; dx++) {
          if ((dx * dx) / 6 + (dy * dy) / 12 > 1) continue;
          const x = cx + dx, y = scapY + dy;
          const i = grid[y * W + x];
          if (i && RAMP[i]) grid[y * W + x] = relit(i, Math.max(0, (i - RAMP[i].start) / (RAMP[i].len - 1) - 0.2));
        }
      }
      return { hairStart, neck, armpit, spineTop, lastTorso };
    },
  },
  cuirass: {
    json: 'cuirass-251-4.json',
    load: () => { const t = new TextureFile(); t.load(readFileSync(`${A}/TEXTURE.251`), 'TEXTURE.251', pal); return t.getDFBitmap(4, 0); },
    features: (grid, mir, W, H, field) => {
      const rows = rowRuns(mir, W, H);
      // Lame lines: rows where the FRONT's mean level jumps - the real
      // design's plate edges, reproduced on the backplate.
      const level = (i) => (i && RAMP[i]) ? (i - RAMP[i].start) / Math.max(1, RAMP[i].len - 1) : 0;
      const rowMean = [];
      for (let y = 0; y < H; y++) {
        let s = 0, n = 0;
        for (let x = 0; x < W; x++) { const i = mir[y * W + x]; if (i) { s += level(i); n++; } }
        rowMean.push(n ? s / n : 0);
      }
      const lames = [];
      for (let y = 2; y < H - 1; y++) {
        if (Math.abs(rowMean[y] - rowMean[y - 1]) > 0.07 && (!lames.length || y - lames[lames.length - 1] > 3)) lames.push(y);
      }
      for (const y of lames) {
        for (let x = 0; x < W; x++) {
          const i = grid[y * W + x];
          if (i && RAMP[i]) grid[y * W + x] = relit(i, Math.min(1, level(i) + 0.4));
        }
      }
      // Centre ridge: 1px highlight + adjacent shadow down the torso run.
      for (let y = 0; y < H; y++) {
        if (!rows[y].length) continue;
        const run = rows[y][0];
        const cx = Math.round((run[0] + run[1]) / 2);
        const hi = grid[y * W + cx];
        if (hi && RAMP[hi]) grid[y * W + cx] = relit(hi, Math.max(0, level(hi) - 0.25));
        const sh = grid[y * W + cx + 1];
        if (sh && RAMP[sh]) grid[y * W + cx + 1] = relit(sh, Math.min(1, level(sh) + 0.2));
      }
      return { lames };
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
    grid[y * W + x] = relit(src, backShade(field, W, H, x, y));
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
