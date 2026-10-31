// CANOPY-SEE (bible/06-Systems/Travel-View.md) - THE WINDOW THROUGH THE TREES, IN A REAL BROWSER. The node pins run the
// shader's text in JS; this compiles both lanes' billboard programs in a real WebGL2 (SwiftShader) and draws, on a
// synthetic scene (no ARENA2): a red traveller under a 3D crown on the trees' slot, seen from the travel view's default
// eye. It counts the traveller's red pixels with no focus (hidden) and with the focus (seen through the crown), and a
// second crown off the sight line, which must stay whole.
//
//   node tools/canopySeeProbe.mjs        (OUT=/tmp/canopysee for the PNGs - synthetic, no game data; CHROMIUM a browser
//                                          other than the pinned Playwright's, /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join } from 'node:path';

const OUT = process.env.OUT || '/tmp/canopysee';
mkdirSync(OUT, { recursive: true });
const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, (h - 1 - y) * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const server = await createServer({ server: { port: 5232, strictPort: true }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const failures = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failures.push(msg); };
try {
  const W = 640, H = 400;
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e.message)));
  page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(m.text()); });
  await page.goto('http://localhost:5232/play/');
  const r = await page.evaluate(async ({ W, H }) => {
    const { Renderer, WORLD_FRAME } = await import('/src/render/renderer.js');
    const { EL_LANE } = await import('/src/render/enhancedLighting.js');
    const { LowPolyTreesGpu } = await import('/src/render/lowPolyTreesRender.js');
    const { perspective, lookAt, mirrorProjectionX, identity } = await import('/src/world/mat4.js');
    const { eyeFor, rightOf, TV_TILT_DEFAULT } = await import('/src/player/travelCamera.js');
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    document.body.appendChild(canvas);
    const rr = new Renderer(canvas);
    const gl = rr.gl;
    const tex = (w, h, f) => { const colors = new Uint8Array(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) colors.set(f(x, y), (y * w + x) * 4); return { width: w, height: h, colors }; };
    rr.uploadTexture(1, 1, tex(16, 16, () => [200, 200, 200, 255]));   // the ground
    rr.uploadTexture(1, 2, tex(16, 16, () => [230, 20, 20, 255]));     // the traveller: red
    rr.uploadTexture(210, 1, tex(4, 4, () => [0, 0, 0, 0]));           // a clear flat, so the flats' call runs
    const P = [], N = [], UV = [], IDX = [], subs = [];
    const quad = (a, b, c, d, n) => { const base = P.length / 3; for (const v of [a, b, c, d]) P.push(...v); for (let k = 0; k < 4; k++) N.push(...n); UV.push(0, 0, 1, 0, 1, 1, 0, 1); IDX.push(base, base + 1, base + 2, base, base + 2, base + 3); };
    const boxQ = (q, x0, y0, z0, x1, y1, z1) => {
      q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]); q([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
      q([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]); q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
      q([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]);
    };
    const sub = (rec, build) => { const start = IDX.length; build(); subs.push({ textureArchive: 1, textureRecord: rec, startIndex: start, primitiveCount: (IDX.length - start) / 3 }); };
    sub(1, () => quad([-1500, 0, 1500], [1500, 0, 1500], [1500, 0, -1500], [-1500, 0, -1500], [0, 1, 0]));
    sub(2, () => boxQ(quad, -3, 0, -3, 3, 18, 3));   // the traveller, grown as the Overworld draws it (OW-BIG)
    const mesh = rr.createMesh({ positions: new Float32Array(P), normals: new Float32Array(N), uvs: new Float32Array(UV), indices: new Uint32Array(IDX), subMeshes: subs });
    const flat = rr.createBillboardBatch(210, 1, { w: 1, h: 1 }, [[500, 0.5, 500]]);
    // THE CROWN: one 3D tree, a slab of leaves 60 x 12 x 60 m from 40 m up, in Low Poly Trees' own buffers (f32 x 8, u16)
    const tv = [], tq = (a, b, c, d, n) => { for (const [v, uv] of [[a, [0, 0]], [b, [1, 0]], [c, [1, 1]], [a, [0, 0]], [c, [1, 1]], [d, [0, 1]]]) tv.push(...v, ...n, ...uv); };
    boxQ(tq, -30, 40, -30, 30, 52, 30);
    tq([-30, 40, -30], [30, 40, -30], [30, 40, 30], [-30, 40, 30], [0, -1, 0]);   // its underside
    const nV = tv.length / 8, vf = new Float32Array(tv), idx = Uint16Array.from({ length: nV }, (_, i) => i);
    const bin = new Uint8Array(vf.byteLength + idx.byteLength); bin.set(new Uint8Array(vf.buffer), 0); bin.set(new Uint8Array(idx.buffer), vf.byteLength);
    const gpu = new LowPolyTreesGpu(gl, { vertexBytes: vf.byteLength, meshes: [{ vertex: 0, vertices: nV, index: 0, subs: [[0, nV]] }] }, bin);
    const leaf = rr.createAtlasTexture(4, 4, 1);
    rr.uploadAtlasRows(leaf, 0, 0, 4, new Uint8Array(64).map((_, i) => [30, 150, 40, 255][i % 4]));
    // the crown over the traveller, and one 140 m east of the sight line
    gpu.setInstances(new Float32Array([0, 0, 0, 0, 1, 140, 0, 0, 0, 1]), 2);
    const run = { run: { handle: null }, scale: [1, 1, 1], size: [60, 52], sway: 0, windfall: 0, subs: [{ offset: gpu.subs[0][0][0], count: gpu.subs[0][0][1], tex: leaf, alpha: 0, color: [1, 1, 1], cull: 2 }], drawStart: 0, drawCount: 2 };
    const slot = { eye: [0, 0, 0], radius: 1e9, band: 1, gpu, runs: [run], sunLift: 0 };
    const feet = [0, 0, 0], head = [0, 1.7, 0];
    const yaw = 0, { eye, fwd } = eyeFor(feet, yaw, TV_TILT_DEFAULT, 260);
    const proj = mirrorProjectionX(perspective(Math.PI / 3, W / H, 0.2, 6000));
    const view = lookAt(eye, [eye[0] + fwd[0], eye[1] + fwd[1], eye[2] + fwd[2]], [0, 1, 0]);
    const I = identity();
    const project = (p) => { const v = [0, 1, 2].map((k) => view[k] * p[0] + view[4 + k] * p[1] + view[8 + k] * p[2] + view[12 + k]);
      const cx = proj[0] * v[0] + proj[4] * v[1] + proj[8] * v[2] + proj[12], cy = proj[1] * v[0] + proj[5] * v[1] + proj[9] * v[2] + proj[13], cw = proj[3] * v[0] + proj[7] * v[1] + proj[11] * v[2] + proj[15];
      return [Math.round((cx / cw * 0.5 + 0.5) * W), Math.round((cy / cw * 0.5 + 0.5) * H)]; };
    const read = () => { const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
    const frame = ({ focus, lane, trees = true }) => {
      rr.setLightingLane(lane ? EL_LANE : null);
      rr.setAir(false);
      rr.setClearColor([0.35, 0.4, 0.5, 1]);
      rr.setLighting(new Float32Array([0.5, 0.5, 0.5]), 0.9, new Float32Array([1, 0.95, 0.85]));
      rr.setFog('off', 0, 0, 0, new Float32Array([0.35, 0.4, 0.5]));
      rr.setPointLights(new Float32Array(0), new Float32Array(0));
      let px = null;
      for (let f = 0; f < 3; f++) {
        rr.setFocus(focus);
        rr.setLowPolyTrees(trees ? slot : null, 2);
        rr.beginFrame(proj, view, new Float32Array([0.6, 0.55, 0.2]), WORLD_FRAME);
        rr.drawMesh(mesh, I, null);
        rr.drawBillboards([flat], new Float32Array(rightOf(yaw)), new Float32Array([0, 1, 0]));
        rr.resolveFrame();
        px = read();
      }
      return px;
    };
    // counts in a box of the screen: the traveller's red, and the crown's green
    const count = (px, [cx, cy], half, test) => { let n = 0; for (let y = cy - half; y <= cy + half; y++) for (let x = cx - half; x <= cx + half; x++) { const i = (y * W + x) * 4; if (test(px[i], px[i + 1], px[i + 2])) n++; } return n; };
    const red = (r, g, b) => r > 90 && g < 60 && b < 60, green = (r, g, b) => g > r + 30 && g > b + 30;
    const travellerPx = project([0, 9, 0]), sidePx = project([140, 52, 0]);
    const out = { travellerPx, sidePx, glErr: gl.getError() };
    for (const lane of [false, true]) {
      const bare = frame({ focus: head, lane, trees: false }), off = frame({ focus: null, lane }), on = frame({ focus: head, lane });
      out[lane ? 'enhanced' : 'classic'] = {
        redBare: count(bare, travellerPx, 20, red), redOff: count(off, travellerPx, 20, red), redOn: count(on, travellerPx, 20, red),
        crownOff: count(off, sidePx, 6, green), crownOn: count(on, sidePx, 6, green), box: 13 * 13,
      };
      out[`png_${lane ? 'enhanced' : 'classic'}_off`] = Array.from(off);
      out[`png_${lane ? 'enhanced' : 'classic'}_on`] = Array.from(on);
    }
    out.glErrAfter = gl.getError();
    return out;
  }, { W, H });
  for (const k of Object.keys(r).filter((k) => k.startsWith('png_'))) { writeFileSync(join(OUT, `${k.slice(4)}.png`), png(W, H, new Uint8Array(r[k]))); delete r[k]; }
  console.log(JSON.stringify(r));
  for (const lane of ['classic', 'enhanced']) {
    const c = r[lane];
    check(c.redBare > 40, `${lane}: the traveller drawn bare (${c.redBare} red)`);
    check(c.redOff < c.redBare * 0.5, `${lane}: no focus - the crown hides the traveller (${c.redOff} of ${c.redBare} red)`);
    check(Math.abs(c.redOn / c.redBare - 0.75) < 0.1, `${lane}: the travel view's focus - three quarters of the traveller seen through it (${c.redOn} of ${c.redBare} red)`);
    check(c.crownOn === c.crownOff && c.crownOn > c.box * 0.9, `${lane}: the crown off the sight line whole (${c.crownOn} / ${c.crownOff} green)`);
  }
  check(r.glErr === 0 && r.glErrAfter === 0, `no GL error (${r.glErr}, ${r.glErrAfter})`);
  check(pageErrors.length === 0, `no page errors (${pageErrors.slice(0, 3).join(' | ')})`);
} finally {
  await browser.close();
  await server.close();
}
console.log(failures.length ? `\n${failures.length} FAILED` : '\nOK');
process.exit(failures.length ? 1 : 0);
