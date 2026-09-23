// VC7b (2026-09-23): THE SUN IN THE HAZE, AND THE BEAMS THROUGH THE GAPS, ON A REAL GPU.
//
// Mac: "I really want to improve the volumetric cloud system to be more
// immersive" - light shafts. Two terms join EL3's shaft image, and no pin
// can see either (the pins run on a fake GL that draws nothing; the sky
// lab has no air pass). So: the real renderer on a real WebGL2 context
// (headless Chromium over SwiftShader), a wide ground under the game's own
// clear-day fog (linear to 2400), synthetic decks handed to
// `setCloudShadow` as both exterior hosts hand the real one, and the
// SHAFT IMAGE read back.
//
//     node tools/vc7bHazeProbe.mjs [outDir]
//
// THE HAZE (the march through the cloud shadow). It fails on: a program
// that will not compile; haze with no deck, or through `?haze=off`'s door
// (the door must shut it); no haze under a deck that is all light (the
// march would be dead and the rest vacuous); haze under a SOLID deck (the
// shade must take it - the square covers the whole reach, so nothing is
// read outside it); a STRIPED deck that does not stripe the air (against the
// same view under a lit deck, pixel by pixel, the ratio must swing - the
// shafts ARE that swing - where a uniform deck's ratio is one number) or whose mean does not sit
// between the solid and the lit; and a phase that does not favour the sun
// (the same lit air seen toward the sun must be brighter than away).
//
// THE BEAMS (the sky map in the mask). With the sun on screen and the
// player in full sun: a sky map that is all gap keeps the beams as they
// were with no sky map; one that is all cloud takes them away; a sky map
// half cloud in stripes leaves beams between the two.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const outDir = process.argv[2] || null;
if (outDir) mkdirSync(outDir, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); };

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {   // readPixels' rows are bottom-up
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { const src = (h - 1 - y) * w * 4; raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + src, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const server = await createServer({ server: { port: 5267, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 300)); });
await page.goto('http://localhost:5267/play/');

const W = 640, H = 400;
const out = await page.evaluate(async ({ W, H, keep }) => {
  const { Renderer, WORLD_FRAME } = await import('/src/render/renderer.js');
  const { EL_LANE } = await import('/src/render/enhancedLighting.js');
  const { perspective, lookAt, identity } = await import('/src/world/mat4.js');
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  document.body.appendChild(canvas);
  const r = new Renderer(canvas);
  const gl = r.gl;

  const grass = (() => {
    const w = 32, h = 32, colors = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) { const v = 90 + ((i * 7919) % 31); colors[i * 4] = v - 30; colors[i * 4 + 1] = v; colors[i * 4 + 2] = v - 45; colors[i * 4 + 3] = 255; }
    return { width: w, height: h, colors };
  })();
  r.uploadTexture(1, 1, grass);
  // A WIDE GROUND, so the view ray's reach is the haze's own (AIR_HAZE_REACH), not a wall's
  const E = 6000;
  const P = [-E, 0, -E, E, 0, -E, E, 0, E, -E, 0, E], N = [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], UV = [0, 0, 400, 0, 400, 400, 0, 400];
  const mesh = r.createMesh({ positions: new Float32Array(P), normals: new Float32Array(N), uvs: new Float32Array(UV), indices: new Uint32Array([0, 1, 2, 0, 2, 3]), subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 2 }] });

  const proj = perspective(Math.PI / 3, W / H, 0.5, 8000);
  const eye = [0, 2, 0];
  const I = identity();
  // a LOW sun from +z, 25 degrees up - the light that throws long shafts through a broken deck
  const el = 25 * Math.PI / 180;
  const lightDir = new Float32Array([0, Math.sin(el), Math.cos(el)]);
  const toward = lookAt(eye, [0, 2 + 0.25 * 1000, 1000], [0, 1, 0]);    // the sun in view
  const away = lookAt(eye, [0, 2 + 0.25 * 1000, -1000], [0, 1, 0]);     // the sun behind
  const side = lookAt(eye, [1000, 2 + 0.05 * 1000, 0], [0, 1, 0]);      // across the shafts

  const tex = (w, h, rgba, wrapS) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS ?? gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return t;
  };
  // A SHADOW MAP over a square that covers the whole reach from the eye (nothing read outside it): `fn(u, v)` the
  // transmittance at the square's (u, v); 128 texels over 16 km is VC4's own texel (~125 m)
  const SIDE = 16000, N0 = 128;
  const shadowOf = (fn) => {
    const b = new Uint8Array(N0 * N0 * 4);
    for (let y = 0; y < N0; y++) for (let x = 0; x < N0; x++) { const v = Math.round(fn((x + 0.5) / N0, (y + 0.5) / N0) * 255); const i = (y * N0 + x) * 4; b[i] = b[i + 1] = b[i + 2] = v; b[i + 3] = 255; }
    return tex(N0, N0, b);
  };
  const rect = [eye[0] - SIDE / 2, eye[2] - SIDE / 2, 1 / SIDE, 1];
  // STRIPES ACROSS THE SUN'S AZIMUTH: bands of cloud shadow 500 m wide, every kilometre, running along x - a
  // broken deck's lanes of light and shade, which the sun (from +z) throws across the view ray looking along x
  const striped = shadowOf((u, v) => (Math.floor((v * SIDE) / 500) % 2 === 0 ? 1 : 0.1));
  const lit = shadowOf(() => 1), solid = shadowOf(() => 0);
  // A SKY MAP (equirect, alpha = transmittance by direction): all gap, all cloud, or azimuth stripes of cloud
  const skyOf = (fn) => {
    const w = 64, h = 16, b = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; b[i] = b[i + 1] = b[i + 2] = 200; b[i + 3] = Math.round(fn(x / w, y / h) * 255); }
    return tex(w, h, b, gl.REPEAT);
  };
  const skyGap = skyOf(() => 1), skyCloud = skyOf(() => 0), skyStripes = skyOf((u) => (Math.floor(u * 64) % 2 === 0 ? 1 : 0));

  const shot = (view, deck, { haze = true, grab = false } = {}) => {
    r.setLightingLane(EL_LANE);
    r.setAir(true);
    r.setHaze(haze);
    if (r.air) r.air._now = () => 1000;
    r.setClearColor([0.55, 0.7, 0.9, 1]);
    r.setLighting(new Float32Array([0.35, 0.35, 0.4]), 0.9, new Float32Array([1, 0.95, 0.85]));
    r.setFog('linear', 0, 0, 2400, new Float32Array([0.62, 0.68, 0.78]));   // the clear day's own: Sunny/Overcast are linear fog to 2400
    r.setPointLights(new Float32Array([]), null);
    let stats = null, img = null, frame = null;
    for (let f = 0; f < 3; f++) {
      r.beginFrame(proj, view, lightDir, WORLD_FRAME);
      r.setCloudShadow(deck);   // AFTER beginFrame, as the hosts do
      r.drawMesh(mesh, I, null);
      r.resolveFrame();
      stats = { gl: gl.getError(), shafts: r.air?.stats.shafts, haze: r.air?.stats.haze };
      const T = r.air.targets.shaft;
      gl.bindFramebuffer(gl.FRAMEBUFFER, T.fbo);
      const b = new Uint8Array(T.w * T.h * 4);
      gl.readPixels(0, 0, T.w, T.h, gl.RGBA, gl.UNSIGNED_BYTE, b);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      // per column: the mean luminance down the column - a shaft is a column that differs from its neighbours
      const cols = new Float64Array(T.w);
      let sum = 0;
      for (let y = 0; y < T.h; y++) for (let x = 0; x < T.w; x++) { const i = (y * T.w + x) * 4; const l = b[i] + b[i + 1] + b[i + 2]; cols[x] += l / T.h; sum += l; }
      img = { w: T.w, h: T.h, sum, cols: Array.from(cols), lum: Array.from({ length: T.w * T.h }, (_, k) => b[k * 4] + b[k * 4 + 1] + b[k * 4 + 2]) };
      if (grab && f === 2) { const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); frame = Array.from(px); }
    }
    return { stats, img, frame };
  };

  const d = (map, sky = null) => ({ map, rect, sky });
  const res = {
    none: shot(side, null),
    door: shot(side, d(lit), { haze: false }),
    lit: shot(side, d(lit)),
    solid: shot(side, d(solid)),
    striped: shot(side, d(striped), { grab: keep }),
    stripedOff: shot(side, d(striped), { haze: false, grab: keep }),
    towardLit: shot(toward, d(lit)),
    awayLit: shot(away, d(lit)),
    beamsNoSky: shot(toward, d(lit), { haze: false }),
    beamsGap: shot(toward, d(lit, skyGap), { haze: false }),
    beamsCloud: shot(toward, d(lit, skyCloud), { haze: false }),
    beamsStripes: shot(toward, d(lit, skyStripes), { haze: false }),
    towardStriped: shot(toward, d(striped, skyStripes), { grab: keep }),
  };
  return { res, renderer: gl.getParameter(gl.RENDERER) };
}, { W, H, keep: !!outDir });

const R = out.res;
console.log('renderer:', out.renderer);
for (const [k, v] of Object.entries(R)) console.log(`  ${k.padEnd(13)} shafts ${v.stats.shafts} haze ${v.stats.haze} sum ${v.img.sum} gl ${v.stats.gl}`);
if (outDir) {
  for (const k of ['striped', 'stripedOff', 'towardStriped']) if (R[k].frame) writeFileSync(`${outDir}/vc7b-${k}.png`, png(W, H, Uint8Array.from(R[k].frame)));
  console.log('frames written to', outDir);
}
// HOW STRIPED an image is against the same view under a lit deck: per pixel the ratio of the two (the phase, the fog
// and the reach are the same in both and cancel), and that ratio's spread about its mean as a share of the mean. A
// uniform deck's ratio is one number everywhere; lanes of shade make it swing between them. Pixels too dim to divide
// (the byte's first few steps) are left out.
const stripes = (v, ref) => { const a = v.img.lum, b = ref.img.lum, q = []; for (let i = 0; i < a.length; i++) if (b[i] >= 24) q.push(a[i] / b[i]); const m = q.reduce((x, y) => x + y, 0) / q.length; return { n: q.length, cv: m > 0 ? Math.sqrt(q.reduce((x, y) => x + (y - m) ** 2, 0) / q.length) / m : 0 }; };

check('no page errors and no GL error', pageErrors.length === 0 && Object.values(R).every((v) => v.stats.gl === 0), pageErrors.join(' | '));
check('no deck, no haze - the classic skin and every interior are EL3 as they were', R.none.stats.haze === false && R.none.img.sum === 0, `sum ${R.none.img.sum}`);
check('`?haze=off` shuts the march', R.door.stats.haze === false && R.door.img.sum === 0, `sum ${R.door.img.sum}`);
check('the march runs: a deck that is all light fills the air with the sun', R.lit.stats.haze === true && R.lit.img.sum > 0, `sum ${R.lit.img.sum}`);
check('a SOLID deck takes the haze away - the shade reaches the air', R.solid.img.sum === 0, `sum ${R.solid.img.sum}`);
{
  const sLit = stripes(R.lit, R.lit), sStr = stripes(R.striped, R.lit);
  check('a STRIPED deck stripes the air - the lit lanes and the shaded ones are the shafts', sStr.n > 100 && sStr.cv > 0.25 && sLit.cv < 0.01, `the ratio to the lit deck swings ${(sStr.cv * 100).toFixed(1)}% over ${sStr.n} pixels (a lit deck against itself: ${(sLit.cv * 100).toFixed(1)}%)`);
  check('...and its light sits between the solid deck and the lit one', R.striped.img.sum > R.solid.img.sum && R.striped.img.sum < R.lit.img.sum, `${R.solid.img.sum} < ${R.striped.img.sum} < ${R.lit.img.sum}`);
}
check('the phase favours the sun: the same lit air is brighter looking toward it than away', R.towardLit.img.sum > 2 * R.awayLit.img.sum && R.awayLit.img.sum > 0, `toward ${R.towardLit.img.sum} against away ${R.awayLit.img.sum}`);
check('the beams run with the sun in view (the rest of the beam checks are not vacuous)', R.beamsNoSky.stats.shafts === true && R.beamsNoSky.img.sum > 0, `sum ${R.beamsNoSky.img.sum}`);
check('a sky map that is all gap keeps the beams as they were', Math.abs(R.beamsGap.img.sum - R.beamsNoSky.img.sum) <= Math.max(2, R.beamsNoSky.img.sum * 0.02), `${R.beamsGap.img.sum} against ${R.beamsNoSky.img.sum}`);
check('a sky map that is all cloud takes the beams away - even with the player in the sun', R.beamsCloud.img.sum === 0, `sum ${R.beamsCloud.img.sum}`);
check('a sky map half cloud leaves beams between the two - the gaps throw them', R.beamsStripes.img.sum > 0 && R.beamsStripes.img.sum < R.beamsGap.img.sum, `${R.beamsStripes.img.sum} between 0 and ${R.beamsGap.img.sum}`);

await browser.close();
await server.close();
const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
