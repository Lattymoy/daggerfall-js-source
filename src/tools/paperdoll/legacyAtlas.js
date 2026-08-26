// Runtime migration for the committed pre-face-atlas skin assets.
//
// The exact baker is still the authority for NEW art. This exists for the case
// where the user cannot run the Python asset pipeline locally: take the skin
// texture and UVs that already ship with the repo, resample each rendered body
// quad into an isolated 8x8 tile, and keep the existing wrapped head cell.
//
// This does NOT invent better source correspondence. Any distortion already
// baked into the legacy atlas remains in the pixels. What it does guarantee is
// the new ownership rule inside the viewer: one body face == one atlas tile, so
// clothing/material deltas can compose with the texture without a local rebuild.

const TEX = 8;
const PAD = 1;
const STRIDE = TEX + PAD * 2;
const HEAD_PAD = 8;

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

function triUv(c, s, t) {
  // Same diagonal as TRI=[0,1,2,0,2,3]. A bilinear interpolation would sample a
  // surface the renderer never draws and can move detail across the diagonal.
  if (s >= t) {
    return [
      c[0][0] * (1 - s) + c[1][0] * (s - t) + c[2][0] * t,
      c[0][1] * (1 - s) + c[1][1] * (s - t) + c[2][1] * t,
    ];
  }
  return [
    c[0][0] * (1 - t) + c[2][0] * s + c[3][0] * (t - s),
    c[0][1] * (1 - t) + c[2][1] * s + c[3][1] * (t - s),
  ];
}

function copyPixel(src, sx, sy, dst, dx, dy) {
  const si = (sy * src.width + sx) * 4;
  const di = (dy * dst.width + dx) * 4;
  dst.data[di] = src.data[si];
  dst.data[di + 1] = src.data[si + 1];
  dst.data[di + 2] = src.data[si + 2];
  dst.data[di + 3] = src.data[si + 3] || 255;
}

function sampleNearest(src, u, v) {
  // Canvas image data is top-left; THREE UVs are bottom-left. floor(u*W) is the
  // texel selected by nearest filtering for the centre-normalised UVs used by
  // the old baker, with the edge clamped exactly as the GPU does.
  const x = clamp(Math.floor(u * src.width), 0, src.width - 1);
  const y = clamp(Math.floor((1 - v) * src.height), 0, src.height - 1);
  const i = (y * src.width + x) * 4;
  return [src.data[i], src.data[i + 1], src.data[i + 2], src.data[i + 3] || 255];
}

function setPixel(dst, x, y, c) {
  const i = (y * dst.width + x) * 4;
  dst.data[i] = c[0]; dst.data[i + 1] = c[1];
  dst.data[i + 2] = c[2]; dst.data[i + 3] = c[3];
}

/**
 * Repack a legacy group/cylinder atlas in memory.
 *
 * @param {{n:number,w:number,h:number,uv:number[],rigHash?:string}} uv
 * @param {object} lay legacy skin-layout.json
 * @param {{width:number,height:number,data:Uint8ClampedArray}} human
 * @param {{width:number,height:number,data:Uint8ClampedArray}|null} beast
 * @param {ArrayLike<number>} groups buildNeutralBody group ids (head === 1)
 * @returns {{uv:object,lay:object,human:object,beast:object|null}|null}
 */
export function repackLegacySkinAtlas(uv, lay, human, beast, groups) {
  if (!uv || !lay || !human || !groups || !lay.head) return null;
  if ((lay.body || {}).mode === 'face-atlas') return null;
  if (human.width !== uv.w || human.height !== uv.h) return null;
  if (!Array.isArray(uv.uv) || uv.uv.length !== uv.n * 8) return null;

  const bodyFaces = [];
  for (let f = 0; f < uv.n; f++) if ((groups[f] || 0) !== 1) bodyFaces.push(f);
  if (!bodyFaces.length) return null;

  const cols = Math.max(1, Math.ceil(Math.sqrt(bodyFaces.length)));
  const rows = Math.ceil(bodyFaces.length / cols);
  const bodyW = cols * STRIDE;
  const bodyH = rows * STRIDE;
  const oldHead = lay.head;
  const hx = bodyW + HEAD_PAD;
  const hy = Number.isFinite(oldHead.y) ? oldHead.y : HEAD_PAD;
  const newW = hx + oldHead.w;
  const newH = Math.max(bodyH, hy + oldHead.h + HEAD_PAD);

  const makeImage = (src) => {
    if (!src || src.width !== uv.w || src.height !== uv.h) return null;
    const dst = { width: newW, height: newH,
      data: new Uint8ClampedArray(newW * newH * 4) };

    for (let ti = 0; ti < bodyFaces.length; ti++) {
      const f = bodyFaces[ti];
      const o = f * 8;
      const corners = [
        [uv.uv[o], uv.uv[o + 1]], [uv.uv[o + 2], uv.uv[o + 3]],
        [uv.uv[o + 4], uv.uv[o + 5]], [uv.uv[o + 6], uv.uv[o + 7]],
      ];
      const tx = (ti % cols) * STRIDE;
      const ty = Math.floor(ti / cols) * STRIDE;
      for (let py = 0; py < STRIDE; py++) {
        const iy = clamp(py - PAD, 0, TEX - 1);
        const t = iy / (TEX - 1);
        for (let px = 0; px < STRIDE; px++) {
          const ix = clamp(px - PAD, 0, TEX - 1);
          const s = ix / (TEX - 1);
          const p = triUv(corners, s, t);
          setPixel(dst, tx + px, ty + py, sampleNearest(src, p[0], p[1]));
        }
      }
    }

    // The head stays a wrapped cell. Copy it byte-for-byte; only its atlas x
    // changes. Runtime face/head overlays therefore keep their existing contract.
    for (let y = 0; y < oldHead.h; y++) {
      const sy = oldHead.y + y;
      if (sy < 0 || sy >= src.height) continue;
      for (let x = 0; x < oldHead.w; x++) {
        const sx = oldHead.x + x;
        if (sx < 0 || sx >= src.width) continue;
        copyPixel(src, sx, sy, dst, hx + x, hy + y);
      }
    }
    return dst;
  };

  const outUv = new Array(uv.n * 8).fill(0);
  for (let ti = 0; ti < bodyFaces.length; ti++) {
    const f = bodyFaces[ti];
    const tx = (ti % cols) * STRIDE;
    const ty = Math.floor(ti / cols) * STRIDE;
    const x0 = tx + PAD + 0.5, x1 = tx + PAD + TEX - 0.5;
    const y0 = ty + PAD + 0.5, y1 = ty + PAD + TEX - 0.5;
    const c = [
      [x0 / newW, 1 - y0 / newH], [x1 / newW, 1 - y0 / newH],
      [x1 / newW, 1 - y1 / newH], [x0 / newW, 1 - y1 / newH],
    ];
    for (let i = 0; i < 4; i++) {
      const o = f * 8 + i * 2;
      outUv[o] = c[i][0]; outUv[o + 1] = c[i][1];
    }
  }

  // Head UVs already describe the correct wrapped head surface. Move those
  // pixel coordinates from the old head cell to the copied new one.
  for (let f = 0; f < uv.n; f++) {
    if ((groups[f] || 0) !== 1) continue;
    for (let i = 0; i < 4; i++) {
      const o = f * 8 + i * 2;
      const px = uv.uv[o] * uv.w;
      const py = (1 - uv.uv[o + 1]) * uv.h;
      const nx = hx + (px - oldHead.x);
      const ny = hy + (py - oldHead.y);
      outUv[o] = nx / newW;
      outUv[o + 1] = 1 - ny / newH;
    }
  }

  const newLay = {
    body: {
      x: 0, y: 0, w: bodyW, h: bodyH,
      mode: 'face-atlas', tile: TEX, pad: PAD, stride: STRIDE,
      columns: cols, faceCount: bodyFaces.length,
      profile: 'legacy-runtime-repack',
      note: 'viewer-only migration of committed legacy pixels; source correspondence unchanged',
    },
    head: { ...oldHead, x: hx, y: hy },
  };
  const newUv = { ...uv, w: newW, h: newH, uv: outUv };
  return { uv: newUv, lay: newLay, human: makeImage(human), beast: makeImage(beast) };
}
