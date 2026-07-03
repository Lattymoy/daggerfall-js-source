// C6h: invented back detail via Retro Diffusion img2img.
// The FRONT sprite conditions the generation ("back view" prompt at
// moderate strength keeps pose + silhouette); the result is then
// CLIPPED to the front's opaque mask (front/back z-fields share the
// front mask's distance field, so identical silhouettes make the seam
// watertight by construction), mask pixels the model missed fill from
// the mirrored front, and colors quantize to ART_PAL - armor forced
// into the 0x70-0x7F metal band so dyes still resolve. Emits committed
// JSON index grids (invented art, ours - never ARENA2 pixels).
// Usage: ARENA2_PATH=... RD_KEY=... node tools/gen-back.mjs [body|cuirass ...]
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { ImgFile } from '../src/formats/imgFile.js';
import { TextureFile } from '../src/formats/textureFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_JSON = resolve(ROOT, 'src/characters/backs');
const OUT_DRAFT = resolve(ROOT, 'back-drafts');
mkdirSync(OUT_JSON, { recursive: true });
mkdirSync(OUT_DRAFT, { recursive: true });

const A = process.env.ARENA2_PATH;
const KEY = process.env.RD_KEY;
if (!A || !KEY) { console.error('ARENA2_PATH and RD_KEY required'); process.exit(1); }
const STRENGTH = Number(process.env.STRENGTH || 0.78);
const STYLE = process.env.STYLE || 'rd_fast__game_asset';
const SCALE = 2; // RD works at 2x; nearest back down preserves pixels

const pal = new DFPalette();
pal.load(readFileSync(`${A}/ART_PAL.COL`), 'ART_PAL.COL');

const TARGETS = {
  body: {
    json: 'body00i0.json',
    prompt: 'back view of a shirtless muscular man standing, rear view, back muscles, '
      + 'spine, shoulder blades, back of head with short dark hair, bare feet, '
      + 'retro 90s game pixel art, warm skin tones, flat neutral background',
    band: null,
    load: () => {
      const img = new ImgFile();
      img.load(readFileSync(`${A}/BODY00I0.IMG`), 'BODY00I0.IMG', pal);
      return img.getDFBitmap();
    },
  },
  cuirass: {
    json: 'cuirass-251-4.json',
    prompt: 'back view of a steel plate armor cuirass backplate, rear view, '
      + 'articulated back plates, straps and buckles, polished steel, '
      + 'retro 90s game pixel art, grey metal tones, flat neutral background',
    band: [0x70, 0x7f],
    load: () => {
      const t = new TextureFile();
      t.load(readFileSync(`${A}/TEXTURE.251`), 'TEXTURE.251', pal);
      return t.getDFBitmap(4, 0);
    },
  },
};

const pad8 = (n) => Math.ceil(n / 8) * 8;

function frontToRgbBase64(bmp) {
  // Mirror horizontally: the back view of a figure facing the viewer
  // has left/right swapped relative to the front sprite.
  const W = bmp.width * SCALE, H = bmp.height * SCALE;
  const PW = pad8(W), PH = pad8(H);
  const png = new PNG({ width: PW, height: PH });
  for (let i = 0; i < PW * PH; i++) {
    png.data[i * 4] = 236; png.data[i * 4 + 1] = 236; png.data[i * 4 + 2] = 236; png.data[i * 4 + 3] = 255;
  }
  const ox = (PW - W) >> 1, oy = (PH - H) >> 1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const sx = bmp.width - 1 - ((x / SCALE) | 0);
    const sy = (y / SCALE) | 0;
    const idx = bmp.data[sy * bmp.width + sx];
    if (idx === 0) continue;
    const c = pal.get(idx);
    const o = ((oy + y) * PW + ox + x) * 4;
    png.data[o] = c.r; png.data[o + 1] = c.g; png.data[o + 2] = c.b;
  }
  return { b64: PNG.sync.write(png).toString('base64'), PW, PH, ox, oy };
}

function nearestIndex(r, g, b, band) {
  let best = 1, bd = Infinity;
  const lo = band ? band[0] : 1, hi = band ? band[1] : 255;
  for (let i = lo; i <= hi; i++) {
    const c = pal.get(i);
    const d = (c.r - r) ** 2 + (c.g - g) ** 2 + (c.b - b) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

async function generate(name) {
  const T = TARGETS[name];
  const bmp = T.load();
  const { b64, PW, PH, ox, oy } = frontToRgbBase64(bmp);
  const payload = {
    prompt: T.prompt,
    width: PW, height: PH, num_images: 1,
    prompt_style: STYLE,
    input_image: b64, strength: STRENGTH,
    seed: Number(process.env.SEED || 4200),
  };
  const res = await fetch('https://api.retrodiffusion.ai/v1/inferences', {
    method: 'POST', headers: { 'X-RD-Token': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data.base64_images?.length) {
    throw new Error(`${name}: ${res.status} ${JSON.stringify(data).slice(0, 200)}`);
  }
  const gen = PNG.sync.read(Buffer.from(data.base64_images[0], 'base64'));
  writeFileSync(resolve(OUT_DRAFT, `${name}-raw.png`), PNG.sync.write(gen));

  // Downscale (centre sample), clip to the FRONT mask, quantize; holes
  // fill from the mirrored front (identity-safe fallback).
  const W = bmp.width, H = bmp.height;
  const grid = new Array(W * H).fill(0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const frontIdx = bmp.data[y * W + (W - 1 - x)]; // mirrored mask
    if (frontIdx === 0) continue;
    const gx = ox + x * SCALE + (SCALE >> 1);
    const gy = oy + y * SCALE + (SCALE >> 1);
    let idx = 0;
    if (gx < gen.width && gy < gen.height) {
      const o = (gy * gen.width + gx) * 4;
      const r = gen.data[o], g = gen.data[o + 1], b = gen.data[o + 2];
      // Near-background pixels count as misses -> mirror fill.
      const bgd = (r - 236) ** 2 + (g - 236) ** 2 + (b - 236) ** 2;
      if (bgd > 900) idx = nearestIndex(r, g, b, T.band);
    }
    if (idx === 0) idx = frontIdx; // fallback: the mirrored front pixel
    grid[y * W + x] = idx;
  }
  writeFileSync(resolve(OUT_JSON, T.json),
    JSON.stringify({ width: W, height: H, mirroredOfFront: true, data: grid }));
  // Draft PNG of the quantized back at 4x for review.
  const draft = new PNG({ width: W * 4, height: H * 4 });
  for (let y = 0; y < H * 4; y++) for (let x = 0; x < W * 4; x++) {
    const idx = grid[((y / 4) | 0) * W + ((x / 4) | 0)];
    const c = idx === 0 ? { r: 34, g: 34, b: 38 } : pal.get(idx);
    const o = (y * W * 4 + x) * 4;
    draft.data[o] = c.r; draft.data[o + 1] = c.g; draft.data[o + 2] = c.b; draft.data[o + 3] = 255;
  }
  writeFileSync(resolve(OUT_DRAFT, `${name}-back.png`), PNG.sync.write(draft));
  console.log(`${name}: ${T.json} written (cost ${data.balance_cost}, balance ${data.remaining_balance?.toFixed(3)})`);
}

const targets = process.argv.slice(2).length ? process.argv.slice(2) : ['body', 'cuirass'];
for (const t of targets) {
  if (!TARGETS[t]) { console.error(`unknown target: ${t}`); process.exit(1); }
  await generate(t);
}
