// COATS3D LIVE PROOF: THE 3D HORSE DRAWS THROUGH THE REAL RENDERER - its bake, its pictures, its looks, its gaits.
//
// test/formats/morrowind/coats3d_horse3d.test.js holds the horse's law in node: the bake against its FBX, the stream, the gait, the
// palette's pose against the skin's bind, the texel map, the 3D dye against the sprites' dye, the saddle solved on
// retail's biped. What node cannot do is run the GLSL. This does, on one Renderer in a real page: the rig loads the
// committed bake and both pictures over the dev server (world/horseRig.js, the hosts' own door), dyes three looks on
// its frame budget (DYE_ROWS a tick), and draws the horse through the character sprite pass under an ortho camera from
// either side and from the front, standing and at each gait - and reads every picture back:
//   - the horse covers its picture (the skin's palette posed it inside the camera, not at the origin or the sky);
//   - its mane and tail are drawn (the alpha cards cut, not dropped: dark pixels along the top line);
//   - a look's picture is not the bay's, and a pinto's left flank is not its right's mirror (each flank its own texels);
//   - every gait's picture differs from the stand (the gait's bones reach the shader);
//   - no GL error, no page error.
// The pictures are written to `outDir` for the eye.
//
// What it canNOT see, stated so nobody mistakes green for finished: no rider (the Morrowind body needs the player's
// own Data Files), no world around the horse, and SwiftShader is not a GPU.
//
// Usage: node tools/horse3dProbe.mjs [outDir]
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const outDir = process.argv[2] || 'scratch/horse3d';
mkdirSync(outDir, { recursive: true });
const fails = [];
const ok = (cond, label) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}`); if (!cond) fails.push(label); };

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
/** RGBA rows bottom first (GL's) as a PNG, top first. */
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { const src = (h - 1 - y) * w * 4; raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + src, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const server = await createServer({ server: { port: 5241, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
const crashes = [];
page.on('pageerror', (e) => crashes.push(String(e.message)));

try {
  await page.goto('http://localhost:5241/mw-inspect.html');
  const looks = { bay: 0, pinto: 1 + 7 * (1 + 5 * (1 + 3 * 321)), leopard: 0 + 7 * (2 + 5 * (0 + 3 * 1201)) };
  const out = await page.evaluate(async ({ looks }) => {
    const [{ Renderer }, rigMod, m] = await Promise.all([import('/src/render/renderer.js'), import('/src/world/horseRig.js'), import('/src/world/mat4.js')]);
    const cv = document.createElement('canvas');
    cv.style.width = '640px'; cv.style.height = '480px'; cv.width = 640; cv.height = 480;
    document.body.append(cv);
    const r = new Renderer(cv);
    const rig = rigMod.horseRigFor(r);
    await rig.load();
    if (!rig.ready()) return { error: rig.failure() ?? 'not ready' };
    for (const c of Object.values(looks)) rig.lookTex(c);
    for (let i = 0; i < 64 && rig.kept().length < 3; i++) rig.tick();
    const h = rig.horse(1);
    const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    const pw = 200, ph = 200;
    const shot = (look, yaw, { gait = null, t = 0, eyeDir = [1, 0.25, 0] } = {}) => {
      rig.step(h, { feet: [0, 0, 0], yaw, speed: 0, dt: 0, look });
      if (gait) { h.gait.gait = gait; h.gait.from = null; h.gait.fade = 1; h.gait.clock[gait] = t; rig.step(h, { feet: [0, 0, 0], yaw, speed: { walk: 0.67, trot: 1.9, gallop: 10.3 }[gait] ?? 0, dt: 0, look }); }
      r.beginFrame(I, I, new Float32Array([0.3, 0.8, 0.5]));
      const c = [0, 1.0, 0], half = 1.45;
      const l = Math.hypot(...eyeDir);
      const eye = [c[0] + eyeDir[0] / l * 5, c[1] + eyeDir[1] / l * 5, c[2] + eyeDir[2] / l * 5];
      r.renderCharacterSprite(h.mesh, h.model, m.ortho(half, half, 0.1, 12), m.lookAt(eye, c, [0, 1, 0]), pw, ph);
      const gl = r.gl, cs = r._charSpriteRT();
      gl.bindFramebuffer(gl.FRAMEBUFFER, cs.fbo);
      const px = new Uint8Array(pw * ph * 4);
      gl.readPixels(0, 0, pw, ph, gl.RGBA, gl.UNSIGNED_BYTE, px);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return Array.from(px);
    };
    // yaw PI/2 faces +x: the camera at +x sees its face end-on - so the flanks are taken from +z and -z
    const shots = {
      bayRight: shot(looks.bay, Math.PI / 2, { eyeDir: [0, 0.25, -1] }), bayLeft: shot(looks.bay, Math.PI / 2, { eyeDir: [0, 0.25, 1] }),
      pintoRight: shot(looks.pinto, Math.PI / 2, { eyeDir: [0, 0.25, -1] }), pintoLeft: shot(looks.pinto, Math.PI / 2, { eyeDir: [0, 0.25, 1] }),
      leopard: shot(looks.leopard, Math.PI / 2, { eyeDir: [0, 0.25, -1] }), front: shot(looks.pinto, Math.PI / 2, { eyeDir: [1, 0.3, 0.2] }),
      walk: shot(looks.bay, Math.PI / 2, { gait: 'walk', t: 0.4, eyeDir: [0, 0.25, -1] }), trot: shot(looks.bay, Math.PI / 2, { gait: 'trot', t: 0.3, eyeDir: [0, 0.25, -1] }),
      gallop: shot(looks.bay, Math.PI / 2, { gait: 'gallop', t: 0.2, eyeDir: [0, 0.25, -1] }),
    };
    return { pw, ph, shots, kept: rig.kept(), err: r.gl.getError() };
  }, { looks });
  if (out.error) throw new Error(out.error);
  const { pw, ph, shots } = out;
  for (const [k, px] of Object.entries(shots)) writeFileSync(`${outDir}/${k}.png`, png(pw, ph, Uint8Array.from(px)));
  const cover = (px) => { let n = 0; for (let i = 3; i < px.length; i += 4) if (px[i] > 8) n++; return n / (px.length / 4); };
  const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 30) n++; return n / (a.length / 4); };
  const mirror = (px) => { const o = new Array(px.length); for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) for (let k = 0; k < 4; k++) o[(y * pw + x) * 4 + k] = px[(y * pw + (pw - 1 - x)) * 4 + k]; return o; };
  const darkTop = (px) => { let n = 0; for (let y = Math.floor(ph * 0.55); y < ph; y++) for (let x = 0; x < pw; x++) { const i = (y * pw + x) * 4; if (px[i + 3] > 8 && px[i] + px[i + 1] + px[i + 2] < 120) n++; } return n; };
  console.log('cover', Object.fromEntries(Object.entries(shots).map(([k, p]) => [k, cover(p).toFixed(3)])));
  ok(out.err === 0, `no GL error (${out.err})`);
  ok(out.kept.length >= 3, `three looks dyed and kept on the frame budget (${out.kept})`);
  ok(Object.values(shots).every((p) => cover(p) > 0.06 && cover(p) < 0.8), 'the horse covers every picture - posed inside the camera (the front view a tenth: a horse is narrow)');
  ok(darkTop(shots.bayRight) > 60, `the mane and tail are drawn - the alpha cards cut, not dropped (${darkTop(shots.bayRight)} dark texels up top)`);
  ok(diff(shots.pintoRight, shots.bayRight) > 0.05, `a look is its own picture (${(diff(shots.pintoRight, shots.bayRight) * 100).toFixed(1)}% of texels off the bay)`);
  ok(diff(shots.leopard, shots.bayRight) > 0.05 && diff(shots.leopard, shots.pintoRight) > 0.05, 'and the leopard is neither');
  ok(diff(mirror(shots.pintoLeft), shots.pintoRight) > 0.04, `a pinto's left flank is not its right one's mirror (${(diff(mirror(shots.pintoLeft), shots.pintoRight) * 100).toFixed(1)}%)`);
  ok(diff(mirror(shots.bayLeft), shots.bayRight) < diff(mirror(shots.pintoLeft), shots.pintoRight), 'the bay\'s two flanks are nearer mirrors than the pinto\'s (one painting, two halves)');
  for (const g of ['walk', 'trot', 'gallop']) ok(diff(shots[g], shots.bayRight) > 0.03, `${g}: the gait's bones reach the shader (${(diff(shots[g], shots.bayRight) * 100).toFixed(1)}% moved)`);
} catch (e) {
  fails.push(String(e?.message ?? e));
  console.log('FAIL', e?.message ?? e);
} finally {
  if (crashes.length) { console.log('pageerrors:', crashes.join(' | ')); fails.push('page errors'); }
  await browser.close();
  await server.close();
}
console.log(fails.length ? `HORSE3D PROBE: ${fails.length} FAILURE(S)` : 'HORSE3D PROBE: ALL GREEN');
process.exit(fails.length ? 1 : 0);
