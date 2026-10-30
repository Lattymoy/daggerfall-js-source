// ARMORY-MIRROR (2026-10-30, the owner: "New guild arm band isnt correct on the sprite. Head aura doesnt allign on the
// sprite"; bible/04-Characters/Aura-Armory.md section 7) - THE AURA ARMORY ON A SPRITE IN THE REAL RENDERER, under the
// game's own mirrored lens (world/mat4.js mirrorProjectionX), from all eight views: the picture drawn as the world draws
// it (renderer.js createBillboardBatch, along the billboards' camRight), the pass after it. Each head piece must stand
// over the painted head, the Insignia Armlet on the painted upper arm. tools/armoryProbe.mjs draws its own card under an
// unmirrored lens, where the view's first row is the screen's right; the world's is its left, and it never saw that.
// --shots writes a sheet - a render of the mod's pictures, so never into the repo.
//     node tools/armorySpriteProbe.mjs [--shots DIR]
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const PORT = 5233;
const SHOTS = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); };

const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), server: { port: PORT, strictPort: true, hmr: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://127.0.0.1:${PORT}/LICENSE`, { waitUntil: 'domcontentloaded', timeout: 180000 });
const W = 240, H = 320;
const out = await page.evaluate(async ({ W, H }) => {
  const [{ Renderer }, m4, bb, sp, ap, apass] = await Promise.all([
    import('/src/render/renderer.js'), import('/src/world/mat4.js'), import('/src/player/eyeOfTheBeholder/eotbBillboard.js'),
    import('/src/player/eyeOfTheBeholder/eotbSprite.js'), import('/src/render/armoryPose.js'), import('/src/render/armoryPass.js'),
  ]);
  const cv = document.createElement('canvas');
  Object.assign(cv.style, { position: 'fixed', left: '0', top: '0', width: `${W}px`, height: `${H}px` });
  document.body.append(cv);
  const r = new Renderer(cv);
  const gl = r.gl;
  const pass = new apass.ArmoryRenderer(gl);
  const toB64 = (u8) => { let t = ''; for (let i = 0; i < u8.length; i += 0x8000) t += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(t); };
  /** a PNG as color32 (row 0 the bottom), mirrored by its columns when asked */
  async function color32(url, mirror) {
    const img = await createImageBitmap(await (await fetch(url)).blob());
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d')); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, img.width, img.height).data, o = new Uint8Array(d.length), w = img.width;
    for (let y = 0; y < img.height; y++) for (let i = 0; i < w; i++) {
      const s = (y * w + i) * 4, t = ((img.height - 1 - y) * w + (mirror ? w - 1 - i : i)) * 4;
      o[t] = d[s]; o[t + 1] = d[s + 1]; o[t + 2] = d[s + 2]; o[t + 3] = d[s + 3];
    }
    return { width: img.width, height: img.height, colors: o };
  }
  const BODIES = {
    skin: { archive: 112364, url: (rec) => `/vendor/eye-of-the-beholder/Textures/112364/112364_${rec}-0.png`, base: 0 },
    layered: { archive: 1700, url: (rec) => `/vendor/layered-armor/male/leather_leather_leather/${rec}-0.png`, base: 15 },
  };
  const ARMS = { heraldry: { field: 'crimson', border: 'gold', device: 'dragon', division: 'quarterly', field2: 'sable' }, logo: null };
  const KITS = { crown: 'a0000', halo: 'b0000', armlet: '00c00', heart: '0a000', greaves: '000b0' };
  const rows = [];
  for (const [bodyName, body] of Object.entries(BODIES)) {
    for (let o = 0; o < 8; o++) {
      const rec = body.base + bb.RECORD_OFFSETS[o], mirror = bb.MIRRORED[o], key = `${bodyName}-${rec}${mirror ? 'm' : ''}`;
      const pic = await color32(body.url(rec), mirror);
      r.uploadTexture('probe-body', key, pic);
      const xml = sp.spriteOffset(body.archive, rec), size = sp.spriteSize(pic.width, pic.height, {}, xml.scale);
      // the camera at view o of a figure at the origin facing +Z, a hair off the views' edges, as eotbBody stands it
      const a = o * Math.PI / 4 + 0.05, eye = [2.4 * Math.sin(a), 1.6, 2.4 * Math.cos(a)];
      const yaw = Math.atan2(-eye[0], -eye[2]), right = [Math.cos(yaw), 0, -Math.sin(yaw)];   // eotbBody's camRight
      const proj = m4.mirrorProjectionX(m4.perspective(50 * Math.PI / 180, W / H, 0.1, 50)), view = m4.lookAt(eye, [0, 1.2, 0], [0, 1, 0]);   // the game's HANDEDNESS (mat4.js)
      const x = (xml.x / xml.scale) * (mirror ? -1 : 1), base = xml.y / xml.scale;
      const fig = { base, mpp: size.h / pic.height, marks: ap.spriteMarks(new Uint32Array(pic.colors.buffer), pic.width, pic.height, { arms: ap.spriteArmsSeen(o % 4 === 2 ? 2 : 0), art: sp.spriteArtScale(body.archive, rec) }), shift: x };
      const pose = ap.newPose(); ap.poseFromFigure(fig, pose);
      const faced = bb.portrayedYaw(o, [eye[0], 0, eye[2]]);
      const frame = (kit) => {
        r.beginFrame(proj, view, new Float32Array([0.3, -0.9, 0.2]));
        const batch = r.createBillboardBatch('probe-body', key, size, [[0, 0, 0]]);
        batch.origin = [right[0] * x, base, right[2] * x];
        r.drawBillboards([batch], right, [0, 1, 0]);
        if (kit) pass.draw([{ at: [0, 0, 0], yaw: faced, kit, pose, seed: 0.37, kindle: 1, torn: -1, mounted: false, _d: 2.6, arms: ARMS }], proj, view, new Float32Array(eye), 5.3, null, true);
        const px = new Uint8Array(cv.width * cv.height * 4);
        gl.readPixels(0, 0, cv.width, cv.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
        r.destroyBillboardBatch(batch);
        return px;
      };
      const vp = m4.multiply(proj, view);
      /** the screen column (0 the left) a world point lands on under the game's lens */
      const colOf = (pt) => { const c = [0, 1, 2, 3].map((i) => vp[i] * pt[0] + vp[4 + i] * pt[1] + vp[8 + i] * pt[2] + vp[12 + i]); return (c[0] / c[3] * 0.5 + 0.5) * cv.width; };
      /** a picture's column (px off its middle) where the billboard draws it: along camRight from the card's middle */
      const along = (px) => { const d = x + px * fig.mpp; return [right[0] * d, 1.2, right[2] * d]; };
      const plain = frame(null);
      const row = { body: bodyName, o, w: cv.width, h: cv.height, plain: toB64(plain), marks: fig.marks, pieces: {} };
      const mk = fig.marks;
      for (const [name, kit] of Object.entries(KITS)) {
        const worn = frame(kit);
        let n = 0, sum = 0, onBody = 0, lo = Infinity, hi = -Infinity;
        const bg = [plain[0], plain[1], plain[2]];
        for (let i = 0; i < cv.width * cv.height; i++) {
          if (plain[i * 4] === worn[i * 4] && plain[i * 4 + 1] === worn[i * 4 + 1] && plain[i * 4 + 2] === worn[i * 4 + 2]) continue;
          n++; sum += i % cv.width;
          if (plain[i * 4] !== bg[0] || plain[i * 4 + 1] !== bg[1] || plain[i * 4 + 2] !== bg[2]) onBody++;
          if (Math.abs(worn[i * 4] - plain[i * 4]) + Math.abs(worn[i * 4 + 1] - plain[i * 4 + 1]) + Math.abs(worn[i * 4 + 2] - plain[i * 4 + 2]) > 90) { lo = Math.min(lo, i % cv.width); hi = Math.max(hi, i % cv.width); }
        }
        // where it must stand, read off the picture: a head piece over the painted head (the halo by its ring's ends - its
        // comet and its spark run round the ring and pull its mean); the armlet on the body's left upper arm, the picture's
        // side that faces the eye - a side view's arms are the body's own, so its left arm's; the heart on the chest seen
        // square on (its point stands forward of the axis, toward the facing); the greaves between the painted knees and
        // feet (a side view's stand a hair forward and back of the card)
        let want = null, tol = 5;
        const fwd = [Math.sin(faced), 0, Math.cos(faced)];
        if (name === 'crown' || name === 'halo') want = mk?.head != null ? colOf(along(mk.head)) : null;
        const side = name === 'armlet' && mk?.arms ? apass.armletSide(pose, fwd, [0, 1.2, 0], eye) : null;
        if (side) {
          const arm = mk.arms[side];
          want = colOf(along(arm.sh + (arm.el - arm.sh) * apass.ARMORY_ARMLET.at)); tol = 4;
        } else if (name === 'armlet' && o === 6) {   // the left side seen: the near arm, the left
          const p = (n) => ap.poseWorld(pose, n, [0, 0, 0], faced, [0, 0, 0], 0, right), sh = p('shL'), el = p('elL'), k = apass.ARMORY_ARMLET.at;
          want = colOf([sh[0] + (el[0] - sh[0]) * k, 1.2, sh[2] + (el[2] - sh[2]) * k]); tol = 4;
        }
        if (name === 'heart' && o === 0 && mk?.chest != null) want = colOf(along(mk.chest));
        if (name === 'greaves' && mk?.legs) { want = colOf(along((mk.legs.knee[0] + mk.legs.knee[1] + mk.legs.ankle[0] + mk.legs.ankle[1]) / 4)); tol = o % 4 === 2 ? 7 : 5; }
        const col = name === 'halo' ? (hi >= lo ? (lo + hi) / 2 : null) : n ? sum / n : null;
        row.pieces[name] = { n, col, onBody: n ? onBody / n : 0, want, tol, worn: toB64(worn) };
      }
      rows.push(row);
    }
  }
  return rows;
}, { W, H });

const crop = (b64, w, h) => Buffer.from(b64, 'base64');
for (const row of out) {
  for (const [name, p] of Object.entries(row.pieces)) {
    if (name === 'armlet' && (row.o === 2 || row.o === 3)) {   // the right side seen, or behind and to the right: the left arm is behind the body
      check(`${row.body} view ${row.o} armlet: the left arm behind the body, hidden`, p.n < 20, `${p.n} px changed`);
      continue;
    }
    if (p.want == null) continue;   // the heart from behind or the side: not measured here (tools/armoryProbe.mjs)
    if (p.col == null) { check(`${row.body} view ${row.o} ${name}: drawn`, false, 'nothing changed'); continue; }
    const off = Math.abs(p.col - p.want);
    check(`${row.body} view ${row.o} ${name}: over its painted part`, off <= p.tol, `its middle ${p.col.toFixed(1)} px, the picture's ${p.want.toFixed(1)}, ${off.toFixed(1)} off of ${p.tol.toFixed(1)} (${Math.round(p.onBody * 100)}% on the body)`);
  }
}
check('no page error', !errors.length, errors.join(' / '));
if (SHOTS) {
  // a sheet: each body a row of its eight views, each view the plain picture over each piece worn
  const names = ['plain', 'crown', 'halo', 'armlet', 'heart', 'greaves'];
  for (const body of ['skin', 'layered']) {
    const these = out.filter((r) => r.body === body), w = these[0].w, h = these[0].h;
    const sheet = new PNG({ width: w * these.length, height: h * names.length });
    these.forEach((r, ci) => names.forEach((n, ri) => {
      const px = crop(n === 'plain' ? r.plain : r.pieces[n].worn, w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const s = ((h - 1 - y) * w + x) * 4, d = ((ri * h + y) * sheet.width + ci * w + x) * 4;   // readPixels' rows are bottom-up
        sheet.data[d] = px[s]; sheet.data[d + 1] = px[s + 1]; sheet.data[d + 2] = px[s + 2]; sheet.data[d + 3] = 255;
      }
    }));
    writeFileSync(join(SHOTS, `armory_sprite_${body}.png`), PNG.sync.write(sheet));
  }
  console.log(`sheets in ${SHOTS}`);
}
await browser.close();
await server.close();
const failed = results.filter((x) => !x).length;
console.log(`${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
