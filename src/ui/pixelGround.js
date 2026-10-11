// THE PIXEL GROUND (PX1, Mac's call 2026-08-27: "this is it"). The
// Bayer-dithered night sky behind the enhanced menu's pixel face - a
// vertical gradient quantized to a six-step ramp through 4x4 Bayer
// thresholds, two fog blobs mixed the same way, stars scattered on a
// seeded LCG so every load and every screenshot sees the same sky.
//
// Prototyped in menu-redesign.html / menu-pixel.html; this module is
// the ONE HOME the moment a second screen wants the ground (the pause
// door will). All art procedural - no game data, per Port-Doctrine.
//
// THE PIXEL IS SQUARE BY CONSTRUCTION: the backing store is derived
// from the caller's viewport at 1/SCALE, never a fixed size - the
// prototype's first phone shot drew every star as a vertical streak
// because a 480x270 canvas was stretched over a portrait screen.

const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

// The ramp, deep night up top to a low horizon glow. Kept here rather
// than in the stylesheet: these are QUANTIZATION STEPS, not theme
// colours - a token edit that added a seventh stop would change the
// dither texture, which is a drawing decision, not a palette one.
const RAMP = ['#07080d', '#0b0d14', '#10141d', '#161c27', '#1e2632', '#28313f'];

const SCALE = 6;     // one art pixel = 6 css pixels before DPR (vastly reduces CPU burden)
const OVER = 1.5;    // the canvas overdraws 150% so the drift never shows an edge

const hx = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const RAMP_RGB = RAMP.map(hx);
// Pre-packed 32-bit color table (little-endian: 0xAABBGGRR) for fast 32-bit pixel writes
const RAMP_32 = new Uint32Array(RAMP_RGB.map(([r, g, b]) => (255 << 24) | (b << 16) | (g << 8) | r));

let _cachedImg = null;
let _cachedW = 0;
let _cachedH = 0;
let _cachedData32 = null;

/** Draw the sky into `canvas`, sized for a viewport of w x h css px.
 *  `t` is seconds; it LIVES the sky - the fog blobs orbit their homes
 *  and a quarter of the stars twinkle on their own seeded phases. The
 *  default 0 draws the same still frame every prior caller got. The
 *  caller owns the clock: this module never schedules anything. */
export function drawPixelGround(canvas, w, h, t = 0) {
  const W = Math.max(4, Math.ceil((w * OVER) / SCALE));
  const H = Math.max(4, Math.ceil((h * OVER) / SCALE));
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const g = canvas.getContext('2d');
  if (!_cachedImg || _cachedW !== W || _cachedH !== H) {
    _cachedImg = g.createImageData(W, H);
    _cachedW = W;
    _cachedH = H;
    _cachedData32 = new Uint32Array(_cachedImg.data.buffer);
  }
  const img = _cachedImg;
  const data32 = _cachedData32;

  let seed = 0xda66e4;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000;
  // The blobs drift in slow ellipses around their homes - different
  // periods so the pair never repeats together.
  const r0 = H * 0.55;
  const r1 = H * 0.45;
  const fogs = [
    { x: W * (0.30 + 0.05 * Math.sin(t / 41)), y: H * (0.72 + 0.03 * Math.cos(t / 53)), r: r0, rSq: r0 * r0, k: 1.4 },
    { x: W * (0.78 + 0.06 * Math.cos(t / 47)), y: H * (0.35 + 0.04 * Math.sin(t / 59)), r: r1, rSq: r1 * r1, k: 0.9 },
  ];
  for (let y = 0; y < H; y++) {
    const yBayer = BAYER[y & 3];
    const yRow = y * W;
    const vBase = y / H;
    for (let x = 0; x < W; x++) {
      let v = vBase;                        // 0 top .. 1 bottom
      for (const f of fogs) {
        const dx = x - f.x;
        const dy = y - f.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < f.rSq) {
          const d = Math.sqrt(distSq) / f.r;
          v += (1 - d) * (1 - d) * 0.22 * f.k;
        }
      }
      v = Math.max(0, Math.min(1, v));
      const tVal = v * (RAMP.length - 1);
      const i0 = Math.floor(tVal);
      const th = (yBayer[x & 3] + 0.5) / 16;
      data32[yRow + x] = RAMP_32[Math.min(RAMP.length - 1, i0 + (tVal - i0 > th ? 1 : 0))];
    }
  }
  // Stars: upper half, density by area, two brightnesses, same seed
  // every draw - a sky that reshuffles on every resize flickers.
  const n = Math.round((W * H) / 1440);
  for (let i = 0; i < n; i++) {
    const x = (rnd() * W) | 0, y = (rnd() * H * 0.55) | 0;
    const bright = rnd() < 0.25;
    const phase = rnd() * Math.PI * 2;
    let b = bright ? 200 : 120;
    // A quarter twinkle: brightness stepped by a slow seeded sine -
    // STEPPED, because a pixel star fades in levels, not a ramp.
    if (bright) b = [140, 170, 200, 230][Math.floor(2 + 1.99 * Math.sin(t / 1.7 + phase))];
    data32[y * W + x] = (255 << 24) | ((b - 10) << 16) | (b << 8) | b;
  }
  g.putImageData(img, 0, 0);
}
