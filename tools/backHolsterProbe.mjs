// BACK-HOLSTER (bible/06-Systems/Eye-Of-The-Beholder.md): the weapon on a sprite's back in the REAL renderer, from all
// eight views, on a skin's idle (112364) and on Layered Gearing's (male, leather). Each weapon's picture is read from the
// player's ARENA2 (ARENA2_PATH) and stood up by the game's own law. Each view is drawn with and without the weapon; what
// changed must lean to the right shoulder from behind, stand upright from the side and hide behind the body in front.
// --shots writes a sheet of the crops - a render of game data, so never into the repo.
//     ARENA2_PATH=... node tools/backHolsterProbe.mjs [--shots DIR]
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { TextureFile, texName } from '../src/formats/textureFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';
import { changeMask } from '../src/formats/baseImageFile.js';
import { uprightWeaponPicture } from '../src/player/eyeOfTheBeholder/eotbHolster.js';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const PORT = 5231;
const SHOTS = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const A2 = process.env.ARENA2_PATH;
if (!A2) { console.error('ARENA2_PATH is not set: sh tools/fetch-data.sh, then point it at the arena2 folder'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); };

// the weapons' paper-doll pictures (TEXTURE.234), stood up in node by the game's law
const pal = new DFPalette();
pal.load(new Uint8Array(readFileSync(join(A2, 'ART_PAL.COL'))), 'ART_PAL.COL');
const tf = new TextureFile();
tf.load(new Uint8Array(readFileSync(join(A2, texName(234)))), texName(234), pal);
const WEAPONS = { longsword: 12, claymore: 4, waraxe: 24, longbow: 11, staff: 21 };
const pics = {};
for (const [name, rec] of Object.entries(WEAPONS)) {
  const c = tf.getColor32(changeMask(tf.getDFBitmap(rec, 0)), 0);
  const p = uprightWeaponPicture({ width: c.width, height: c.height, colors: new Uint8Array(c.colors.buffer, c.colors.byteOffset, c.colors.byteLength) });
  pics[name] = { width: p.width, height: p.height, w: p.w, h: p.h, colors: Buffer.from(p.colors).toString('base64'), mirror: Buffer.from(p.mirror).toString('base64') };
}

const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), server: { port: PORT, strictPort: true, hmr: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });   // PW_CHROMIUM: a browser another Playwright installed
const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(`http://127.0.0.1:${PORT}/LICENSE`, { waitUntil: 'domcontentloaded', timeout: 180000 });   // a page at the origin, nothing of its own to boot
const W = 240, H = 320;
const shots = await page.evaluate(async ({ pics, W, H }) => {
  const [{ Renderer }, m4, Hs, bb, sp, ap] = await Promise.all([
    import('/src/render/renderer.js'), import('/src/world/mat4.js'), import('/src/player/eyeOfTheBeholder/eotbHolster.js'),
    import('/src/player/eyeOfTheBeholder/eotbBillboard.js'), import('/src/player/eyeOfTheBeholder/eotbSprite.js'), import('/src/render/armoryPose.js'),
  ]);
  const cv = document.createElement('canvas');
  Object.assign(cv.style, { position: 'fixed', left: '0', top: '0', width: `${W}px`, height: `${H}px` });
  document.body.append(cv);
  const r = new Renderer(cv);
  const gl = r.gl;
  const b64 = (s) => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0));
  const toB64 = (u8) => { let t = ''; for (let i = 0; i < u8.length; i += 0x8000) t += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(t); };
  const arts = {};
  for (const [name, p] of Object.entries(pics)) {
    const archive = Hs.holsterArtArchive(`probe-${name}`);
    r.uploadTexture(archive, 0, { width: p.width, height: p.height, colors: b64(p.colors) });
    r.uploadTexture(archive, 1, { width: p.width, height: p.height, colors: b64(p.mirror) });
    arts[name] = { archive, w: p.w, h: p.h };
  }
  /** a PNG as color32 (row 0 the bottom), mirrored by its columns when asked */
  async function color32(url, mirror) {
    const img = await createImageBitmap(await (await fetch(url)).blob());
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d')); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, img.width, img.height).data, out = new Uint8Array(d.length), w = img.width;
    for (let y = 0; y < img.height; y++) for (let i = 0; i < w; i++) {
      const s = (y * w + i) * 4, o = ((img.height - 1 - y) * w + (mirror ? w - 1 - i : i)) * 4;
      out[o] = d[s]; out[o + 1] = d[s + 1]; out[o + 2] = d[s + 2]; out[o + 3] = d[s + 3];
    }
    return { width: img.width, height: img.height, colors: out };
  }
  const BODIES = {
    skin: { archive: 112364, url: (rec) => `/vendor/eye-of-the-beholder/Textures/112364/112364_${rec}-0.png`, base: 0 },
    layered: { archive: 1700, url: (rec) => `/vendor/layered-armor/male/leather_leather_leather/${rec}-0.png`, base: 15 },
  };
  const out = [];
  for (const [bodyName, body] of Object.entries(BODIES)) {
    for (const weapon of Object.keys(arts)) {
      for (let o = 0; o < 8; o++) {
        const rec = body.base + bb.RECORD_OFFSETS[o], mirror = bb.MIRRORED[o];
        const pic = await color32(body.url(rec), mirror);
        const key = `${bodyName}-${rec}${mirror ? 'm' : ''}`;
        r.uploadTexture('probe-body', key, pic);
        const xml = sp.spriteOffset(body.archive, rec), size = sp.spriteSize(pic.width, pic.height, {}, xml.scale);
        // the camera at view o of a figure at the origin facing +Z, a hair off the views' edges
        const a = o * Math.PI / 4 + 0.05, eye = [3.6 * Math.sin(a), 1.4, 3.6 * Math.cos(a)];
        const yaw = Math.atan2(-eye[0], -eye[2]), right = [Math.cos(yaw), 0, -Math.sin(yaw)];
        const proj = m4.mirrorProjectionX(m4.perspective(50 * Math.PI / 180, W / H, 0.1, 50)), view = m4.lookAt(eye, [0, 0.95, 0], [0, 1, 0]);   // the game's HANDEDNESS (mat4.js)
        const x = (xml.x / xml.scale) * (mirror ? -1 : 1), base = xml.y / xml.scale;
        const u32 = new Uint32Array(pic.colors.buffer);
        const fig = { base, mpp: size.h / pic.height, marks: ap.spriteMarks(u32, pic.width, pic.height, { arms: o % 4 !== 2, art: sp.spriteArtScale(body.archive, rec) }), shift: x };
        const frame = (withWeapon) => {
          r.beginFrame(proj, view, new Float32Array([0.3, -0.9, 0.2]));
          const bodyBatch = r.createBillboardBatch('probe-body', key, size, [[0, 0, 0]]);
          bodyBatch.origin = [right[0] * x, base, right[2] * x];
          r.drawBillboards([bodyBatch], right, [0, 1, 0]);
          let l = null;
          if (withWeapon) {
            l = Hs.hangSpriteHolster(Hs.createSpriteHolster(), fig, o, [0, 0, 0], eye, right, arts[weapon]);
            Hs.mintSpriteHolster(l, r);
            r.drawBillboards(l.list, l.right, l.up);
          }
          const px = new Uint8Array(cv.width * cv.height * 4);
          gl.readPixels(0, 0, cv.width, cv.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
          r.destroyBillboardBatch(bodyBatch);
          if (l) Hs.dropSpriteHolster(l, r);
          return px;
        };
        const plain = frame(false), worn = frame(true);
        const diff = new Uint8Array(cv.width * cv.height);
        for (let i = 0; i < diff.length; i++) diff[i] = plain[i * 4] !== worn[i * 4] || plain[i * 4 + 1] !== worn[i * 4 + 1] || plain[i * 4 + 2] !== worn[i * 4 + 2] ? 1 : 0;
        out.push({ body: bodyName, weapon, o, w: cv.width, h: cv.height, worn: toB64(worn), diff: toB64(diff) });
      }
    }
  }
  return out;
}, { pics, W, H });
await browser.close();
await server.close();

for (const s of shots) { s.worn = Buffer.from(s.worn, 'base64'); s.diff = Buffer.from(s.diff, 'base64'); }
// what the weapon changed, per view: how much, and its top and bottom fifths' mean column (row 0 the bottom)
for (const s of shots) {
  const ys = [], xs = [];
  for (let i = 0; i < s.diff.length; i++) if (s.diff[i]) { ys.push(Math.floor(i / s.w)); xs.push(i % s.w); }
  s.n = ys.length;
  if (!s.n) continue;
  const lo = Math.min(...ys), hi = Math.max(...ys), band = (hi - lo) / 5;
  const mean = (f) => { let t = 0, k = 0; for (let i = 0; i < ys.length; i++) if (f(ys[i])) { t += xs[i]; k++; } return k ? t / k : NaN; };
  s.lean = mean((y) => y >= hi - band) - mean((y) => y <= lo + band);
  s.tall = hi - lo;
}
const by = (body, weapon) => shots.filter((s) => s.body === body && s.weapon === weapon);
for (const body of ['skin', 'layered']) {
  for (const weapon of Object.keys(WEAPONS)) {
    const v = by(body, weapon);
    const n = v.map((s) => s.n), lean = v.map((s) => (s.n ? s.lean.toFixed(0) : '-'));
    check(`${body} ${weapon}: drawn from the back and its diagonals, leaning to the right shoulder`, [3, 4, 5].every((o) => v[o].n > 30 && v[o].lean > 2), `px ${n.join(',')} lean ${lean.join(',')}`);
    check(`${body} ${weapon}: from the side it stands upright`, [2, 6].every((o) => v[o].n > 0 && Math.abs(v[o].lean) < v[o].tall * 0.15));
    check(`${body} ${weapon}: from the front it is mostly behind the body`, v[0].n < v[4].n * 0.6, `front ${v[0].n} px against the back's ${v[4].n}`);
  }
}
if (SHOTS) {
  // one sheet: a row a body and weapon, the eight views across, each crop the figure's middle
  const cw = 150, ch = 230, rows = shots.length / 8;
  const sheet = new PNG({ width: cw * 8, height: ch * rows });
  shots.forEach((s, i) => {
    const row = Math.floor(i / 8), col = s.o, x0 = Math.floor((s.w - cw) / 2), y0 = Math.floor((s.h - ch) / 2);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const sy = s.h - 1 - (y0 + y), sx = x0 + x, si = (sy * s.w + sx) * 4, di = ((row * ch + y) * sheet.width + col * cw + x) * 4;
      for (let k = 0; k < 3; k++) sheet.data[di + k] = s.worn[si + k];
      sheet.data[di + 3] = 255;
    }
  });
  writeFileSync(join(SHOTS, 'back-holster.png'), PNG.sync.write(sheet));
  console.log(`sheet: ${join(SHOTS, 'back-holster.png')} (rows: ${shots.filter((s) => s.o === 0).map((s) => `${s.body} ${s.weapon}`).join(', ')}; views 0-7 across)`);
}
const failed = results.filter((ok) => !ok).length;
console.log(`${results.length - failed}/${results.length} ok`);
process.exit(failed ? 1 : 0);
