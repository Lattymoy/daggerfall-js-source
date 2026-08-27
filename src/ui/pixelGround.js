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

const SCALE = 4;     // one art pixel = 4 css pixels before DPR
const OVER = 1.5;    // the canvas overdraws 150% so the drift never shows an edge

const hx = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];

/** Draw the sky into `canvas`, sized for a viewport of w x h css px. */
export function drawPixelGround(canvas, w, h) {
  const W = (canvas.width = Math.max(4, Math.ceil((w * OVER) / SCALE)));
  const H = (canvas.height = Math.max(4, Math.ceil((h * OVER) / SCALE)));
  const g = canvas.getContext('2d');
  const img = g.createImageData(W, H);
  let seed = 0xda66e4;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000;
  const fogs = [
    { x: W * 0.30, y: H * 0.72, r: H * 0.55, k: 1.4 },
    { x: W * 0.78, y: H * 0.35, r: H * 0.45, k: 0.9 },
  ];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = y / H;                        // 0 top .. 1 bottom
      for (const f of fogs) {
        const d = Math.hypot(x - f.x, y - f.y) / f.r;
        if (d < 1) v += (1 - d) * (1 - d) * 0.22 * f.k;
      }
      v = Math.max(0, Math.min(1, v));
      const t = v * (RAMP.length - 1);
      const i0 = Math.floor(t);
      const th = (BAYER[y & 3][x & 3] + 0.5) / 16;
      const c = hx(RAMP[Math.min(RAMP.length - 1, i0 + (t - i0 > th ? 1 : 0))]);
      const o = (y * W + x) * 4;
      img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
    }
  }
  // Stars: upper half, density by area, two brightnesses, same seed
  // every draw - a sky that reshuffles on every resize flickers.
  const n = Math.round((W * H) / 1440);
  for (let i = 0; i < n; i++) {
    const x = (rnd() * W) | 0, y = (rnd() * H * 0.55) | 0;
    const b = rnd() < 0.25 ? 200 : 120;
    const o = (y * W + x) * 4;
    img.data[o] = b; img.data[o + 1] = b; img.data[o + 2] = b - 10;
  }
  g.putImageData(img, 0, 0);
}
