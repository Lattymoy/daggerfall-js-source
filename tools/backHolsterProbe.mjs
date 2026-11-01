// The weapon on a sprite's back in the REAL renderer, from all eight views, on a skin's idle (112364) and on Layered
// Gearing's (male, leather). Each weapon's picture is read from the player's ARENA2 (ARENA2_PATH) and stood up by the
// game's own law. Each view is drawn with and without the weapon; what changed must lean to the right shoulder from
// behind, stand upright from the side and hide behind the body in front. From the side no pixel of it lies over the body.
// Under the Shadow Cloak (the real aura pass, hung at the painted body as the aura host hangs it) the cape's mass is
// behind the body, and after the redraw no weapon pixel is tinted. BACK-HOLSTER GLOW: a shock and the Brand glow on the
// claymore on its back, and round the whole sprite drawn - seen from the back, hidden with the weapon from the front,
// animated, over the cape. --shots writes sheets of the crops - a render of game data, so never into the repo.
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
import { eotbPictures } from './lib/eotbPictures.mjs';

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
// QUIVER: the Arrow's own picture (TEXTURE.207 record 16), stood up by the same law
const tf207 = new TextureFile();
tf207.load(new Uint8Array(readFileSync(join(A2, texName(207)))), texName(207), pal);
const ac = tf207.getColor32(changeMask(tf207.getDFBitmap(16, 0)), 0);
const ap0 = uprightWeaponPicture({ width: ac.width, height: ac.height, colors: new Uint8Array(ac.colors.buffer, ac.colors.byteOffset, ac.colors.byteLength) });
const arrowPic = { width: ap0.width, height: ap0.height, colors: Buffer.from(ap0.colors).toString('base64') };
// The skin's five views are Daggerfall's own TEXTURE.481, built from the player's ARENA2 as the game builds them
const EOTB = eotbPictures({ arena2: A2 });
const skinUrls = Object.fromEntries(await Promise.all([0, 1, 2, 3, 4].map(async (rec) => [rec, await EOTB.dataUrl(`112364_${rec}-0`)])));

const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), server: { port: PORT, strictPort: true, hmr: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });   // PW_CHROMIUM: a browser another Playwright installed
const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(`http://127.0.0.1:${PORT}/LICENSE`, { waitUntil: 'domcontentloaded', timeout: 180000 });   // a page at the origin, nothing of its own to boot
const W = 240, H = 320;
const { out: shots, glowOut, quiverOut } = await page.evaluate(async ({ pics, arrowPic, skinUrls, W, H }) => {
  const [{ Renderer }, m4, Hs, bb, sp, ap, ar] = await Promise.all([
    import('/src/render/renderer.js'), import('/src/world/mat4.js'), import('/src/player/eyeOfTheBeholder/eotbHolster.js'),
    import('/src/player/eyeOfTheBeholder/eotbBillboard.js'), import('/src/player/eyeOfTheBeholder/eotbSprite.js'), import('/src/render/armoryPose.js'),
    import('/src/render/auraRing.js'),
  ]);
  const cv = document.createElement('canvas');
  Object.assign(cv.style, { position: 'fixed', left: '0', top: '0', width: `${W}px`, height: `${H}px` });
  document.body.append(cv);
  const r = new Renderer(cv);
  const gl = r.gl;
  const auras = new ar.AuraRingRenderer(gl);
  const b64 = (s) => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0));
  const toB64 = (u8) => { let t = ''; for (let i = 0; i < u8.length; i += 0x8000) t += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(t); };
  const arts = {};
  for (const [name, p] of Object.entries(pics)) {
    const archive = Hs.holsterArtArchive(`probe-${name}`);
    r.uploadTexture(archive, 0, { width: p.width, height: p.height, colors: b64(p.colors) });
    r.uploadTexture(archive, 1, { width: p.width, height: p.height, colors: b64(p.mirror) });
    arts[name] = { archive, w: p.w, h: p.h, pic: { width: p.width, height: p.height } };   // as the store holds it (eotbHolster.js createHolsterArt)
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
    skin: { archive: 112364, url: (rec) => skinUrls[rec], base: 0 },
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
        const frame = (withWeapon, cape = 0) => {   // cape: 1 the cloak drawn over, 2 and the holsters drawn again after it
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
          if (cape) {   // the aura host's own steps: hung on the sprite as drawn, moved to its painted body, the pass
            const w = { at: [0, 0, 0], seed: 0.37, kindle: 1, aura: 'shadowcloak', torn: -1, yaw: 0 };
            ar.auraCapeStep(w, { feet: [0, 0, 0], yaw: bb.portrayedYaw(o, [eye[0], 0, eye[2]]), bones: ar.auraSpriteBones(fig) });
            ar.auraMotionStep(w, 1);
            w.across = ar.auraSpriteAcross(fig);
            ar.auraShiftAcross([w], right, 1);
            auras.draw([w], proj, view, new Float32Array(eye), 1, null);
            ar.auraShiftAcross([w], right, -1);
            r.markForeignPass();
            if (cape === 2) Hs.redrawHolstersOver(r, null, l ? [l] : []);   // the aura host's redraw
          }
          const px = new Uint8Array(cv.width * cv.height * 4);
          gl.readPixels(0, 0, cv.width, cv.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
          r.destroyBillboardBatch(bodyBatch);
          if (l) Hs.dropSpriteHolster(l, r);
          return px;
        };
        const plain = frame(false), worn = frame(true);
        const caped = weapon === 'claymore' ? [frame(true, 1), frame(true, 2)] : null;
        const capeOnly = weapon === 'claymore' ? frame(false, 1) : null;
        // the screen column a world point lands on (the game's mirrored lens), and the painted body's middle
        const vp = new Float32Array(16);
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let t = 0; for (let q = 0; q < 4; q++) t += proj[q * 4 + i] * view[j * 4 + q]; vp[j * 4 + i] = t; }
        const colOf = (pt) => { const c = [0, 1, 2, 3].map((i) => vp[i] * pt[0] + vp[4 + i] * pt[1] + vp[8 + i] * pt[2] + vp[12 + i]); return (c[0] / c[3] * 0.5 + 0.5) * cv.width; };
        const acr = ar.auraSpriteAcross(fig), bodyCol = colOf([right[0] * acr, 1.2, right[2] * acr]), backCol = colOf([right[0] * acr, 1.2, right[2] * acr - 0.3]);
        const diff = new Uint8Array(cv.width * cv.height);
        for (let i = 0; i < diff.length; i++) diff[i] = plain[i * 4] !== worn[i * 4] || plain[i * 4 + 1] !== worn[i * 4 + 1] || plain[i * 4 + 2] !== worn[i * 4 + 2] ? 1 : 0;
        // over the weapon's own pixels: how many the cape changed, and how many are still changed after the redraw
        let tinted = 0, still = 0, shown = 0, onBody = 0, capeCol = 0, capeN = 0;
        const bg = [plain[0], plain[1], plain[2]];   // the clear colour, at a corner
        for (let i = 0; i < diff.length; i++) if (diff[i] && (plain[i * 4] !== bg[0] || plain[i * 4 + 1] !== bg[1] || plain[i * 4 + 2] !== bg[2])) onBody++;
        if (capeOnly) for (let i = 0; i < diff.length; i++) if (capeOnly[i * 4] !== plain[i * 4] || capeOnly[i * 4 + 1] !== plain[i * 4 + 1] || capeOnly[i * 4 + 2] !== plain[i * 4 + 2]) { capeCol += i % cv.width; capeN++; }
        if (caped) for (let i = 0; i < diff.length; i++) {
          if (!diff[i]) continue;
          shown++;
          const same = (px) => px[i * 4] === worn[i * 4] && px[i * 4 + 1] === worn[i * 4 + 1] && px[i * 4 + 2] === worn[i * 4 + 2];
          if (!same(caped[0])) tinted++;
          if (!same(caped[1])) still++;
        }
        out.push({ body: bodyName, weapon, o, w: cv.width, h: cv.height, worn: toB64(caped ? caped[1] : worn), diff: toB64(diff), onBody, cape: caped ? { shown, tinted, still, behind: capeN ? (capeCol / capeN - bodyCol) * Math.sign(backCol - bodyCol) : 0 } : null });
      }
    }
  }
  // BACK-HOLSTER GLOW: the weapon's glow on its back (the claymore) and round the whole sprite, in the real primitive
  const [wg] = await Promise.all([import('/src/systems/weaponGlow.js')]);
  const LOOKS = { shock: wg.glowSpec('shock', 3), brand: wg.glowSpec('brand', 2) };
  const glowOut = [];
  for (const [bodyName, body] of Object.entries(BODIES)) {
    for (let o = 0; o < 8; o++) {
      const rec = body.base + bb.RECORD_OFFSETS[o], mirror = bb.MIRRORED[o], key = `${bodyName}-${rec}${mirror ? 'm' : ''}`;
      const pic = await color32(body.url(rec), mirror);
      r.uploadTexture('probe-body', key, pic);
      const xml = sp.spriteOffset(body.archive, rec), size = sp.spriteSize(pic.width, pic.height, {}, xml.scale), art = sp.spriteArtScale(body.archive, rec);
      const a = o * Math.PI / 4 + 0.05, eye = [3.6 * Math.sin(a), 1.4, 3.6 * Math.cos(a)];
      const yaw = Math.atan2(-eye[0], -eye[2]), right = [Math.cos(yaw), 0, -Math.sin(yaw)];
      const proj = m4.mirrorProjectionX(m4.perspective(50 * Math.PI / 180, W / H, 0.1, 50)), view = m4.lookAt(eye, [0, 0.95, 0], [0, 1, 0]);
      const x = (xml.x / xml.scale) * (mirror ? -1 : 1), base = xml.y / xml.scale;
      const fig = { base, mpp: size.h / pic.height, marks: ap.spriteMarks(new Uint32Array(pic.colors.buffer), pic.width, pic.height, { arms: o % 4 !== 2, art }), shift: x };
      const origin = [right[0] * x, base, right[2] * x];
      const near = [eye[0] / 3, 0, eye[2] / 3];   // Another wearer a third of the way to the eye
      const frame = ({ back = false, look = null, hand = null, cape = false, other = false, fog = false } = {}) => {
        r.setFog(fog ? 'linear' : 'off', 0, 0.2, 0.5, new Float32Array([0.5, 0.5, 0.5]));   // Fog all the way, short of the sprite
        r.beginFrame(proj, view, new Float32Array([0.3, -0.9, 0.2]));
        const bodyBatch = r.createBillboardBatch('probe-body', key, size, [[0, 0, 0]]);
        bodyBatch.origin = origin.slice();
        r.drawBillboards([bodyBatch], right, [0, 1, 0]);
        let l = null;
        if (back) { l = Hs.hangSpriteHolster(Hs.createSpriteHolster(), fig, o, [0, 0, 0], eye, right, arts.claymore); Hs.mintSpriteHolster(l, r); r.drawBillboards(l.list, l.right, l.up); }
        const backGlow = () => { if (look && l) r.drawBillboardGlow(`${l.archive}_${l.mirror ? 1 : 0}`, LOOKS[look], { origin: l.origin, right: l.right, up: l.up, w: l.w, h: l.h, art: [l.cellW, l.cellH] }); };
        if (cape || other) {   // the aura host's order: farthest first, each wearer's back straight after its own aura
          const wearer = (at) => {
            const w = { at: at.slice(), seed: 0.37, kindle: 1, aura: 'shadowcloak', torn: -1, yaw: 0 };
            ar.auraCapeStep(w, { feet: at, yaw: bb.portrayedYaw(o, [eye[0], 0, eye[2]]), bones: ar.auraSpriteBones(fig) });
            ar.auraMotionStep(w, 1); w.across = ar.auraSpriteAcross(fig);
            return w;
          };
          const me = cape ? wearer([0, 0, 0]) : null, list = [other ? wearer(near) : null, me].filter(Boolean);   // nearest first
          ar.auraShiftAcross(list, right, 1);
          Hs.drawAurasThenBacks(list, (run) => { auras.draw(run, proj, view, new Float32Array(eye), 1, null); r.markForeignPass(); return auras.drawn; },
            (w) => w === me, () => { if (l) Hs.redrawHolstersOver(r, null, [l]); backGlow(); }, []);
          ar.auraShiftAcross(list, right, -1);
        } else backGlow();   // a body wearing none: the host draws its glows before every aura
        if (hand) r.drawBillboardGlow(`probe-body_${key}`, LOOKS[hand], { origin, right, up: [0, 1, 0], w: size.w, h: size.h, art: [pic.width / art, pic.height / art] });
        const px = new Uint8Array(cv.width * cv.height * 4);
        gl.readPixels(0, 0, cv.width, cv.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
        r.destroyBillboardBatch(bodyBatch);
        if (l) Hs.dropSpriteHolster(l, r);
        return px;
      };
      const plain = frame(), worn = frame({ back: true }), shock = frame({ back: true, look: 'shock' });
      await new Promise((res) => setTimeout(res, 260));   // the clock moves on: shock steps twelve times a second
      const shock2 = frame({ back: true, look: 'shock' }), brand = frame({ back: true, look: 'brand' });
      const caped = frame({ back: true, cape: true }), capedGlow = frame({ back: true, cape: true, look: 'shock' });
      const handGlow = frame({ hand: 'shock' });
      // A nearer wearer's cape over this one's weapon; A7: in full fog the glow is fogged to nothing; A8: culled
      const otherOnly = frame({ other: true }), both = frame({ back: true, cape: true, other: true });
      const wornFog = frame({ back: true, fog: true }), shockFog = frame({ back: true, look: 'shock', fog: true });
      r.setFog('off', 0, 0, 1, null);
      r.beginFrame(proj, view, new Float32Array([0.3, -0.9, 0.2]));
      const behind = [3 * eye[0], 0, 3 * eye[2]];
      const culled = !r.drawBillboardGlow(`probe-body_${key}`, LOOKS.shock, { origin: behind, right, up: [0, 1, 0], w: size.w, h: size.h, art: [pic.width / art, pic.height / art] })
        && r.drawBillboardGlow(`probe-body_${key}`, LOOKS.shock, { origin, right, up: [0, 1, 0], w: size.w, h: size.h, art: [pic.width / art, pic.height / art] });
      const same = (p, q, i) => p[i * 4] === q[i * 4] && p[i * 4 + 1] === q[i * 4 + 1] && p[i * 4 + 2] === q[i * 4 + 2];
      const bg = [plain[0], plain[1], plain[2]];
      const isBg = (p, i) => p[i * 4] === bg[0] && p[i * 4 + 1] === bg[1] && p[i * 4 + 2] === bg[2];
      const n = cv.width * cv.height;
      let glow = 0, glowOnBodyHidden = 0, moved = 0, brandN = 0, overCape = 0, handBand = 0, handOnBody = 0;
      let under = 0, untinted = 0, fogLeft = 0, fogged = 0;
      for (let i = 0; i < n; i++) {
        if (!same(worn, plain, i) && !same(otherOnly, plain, i)) { under++; if (same(both, caped, i)) untinted++; }
        if (!same(shockFog, wornFog, i)) fogLeft++;
        if (!same(wornFog, worn, i)) fogged++;
        const weapon = !same(worn, plain, i), bodyPx = !isBg(plain, i);
        if (!same(shock, worn, i)) { glow++; if (bodyPx && !weapon) glowOnBodyHidden++; }
        if (!same(shock, shock2, i)) moved++;
        if (!same(brand, worn, i)) brandN++;
        if (!same(capedGlow, caped, i)) overCape++;
        if (!same(handGlow, plain, i)) { if (bodyPx) handOnBody++; else handBand++; }
      }
      glowOut.push({ body: bodyName, o, w: cv.width, h: cv.height, glow, glowOnBodyHidden, moved, brandN, overCape, handBand, handOnBody, under, untinted, fogLeft, fogged, culled, shot: toB64(shock), hand: toB64(handGlow), cape: toB64(capedGlow), both: toB64(both) });
    }
  }
  // QUIVER: the long bow and its quiver - the quiver alone, the bow alone, both, and the quiver empty - eight views
  const Q = await import('/src/player/eyeOfTheBeholder/eotbQuiver.js');
  const arrowUp = { width: arrowPic.width, height: arrowPic.height, colors: b64(arrowPic.colors) };
  const quivers = {};
  for (const full of [true, false]) {
    const q = Q.quiverPicture(arrowUp, full), archive = Q.quiverArtArchive(full);
    r.uploadTexture(archive, 0, { width: q.width, height: q.height, colors: q.colors });
    r.uploadTexture(archive, 1, { width: q.width, height: q.height, colors: q.mirror });
    quivers[full ? 'full' : 'empty'] = { archive, w: q.w, h: q.h, pic: { width: q.width, height: q.height } };
  }
  const quiverOut = [];
  for (const [bodyName, body] of Object.entries(BODIES)) {
    for (let o = 0; o < 8; o++) {
      const rec = body.base + bb.RECORD_OFFSETS[o], mirror = bb.MIRRORED[o], key = `${bodyName}-${rec}${mirror ? 'm' : ''}`;
      const pic = await color32(body.url(rec), mirror);
      r.uploadTexture('probe-body', key, pic);
      const xml = sp.spriteOffset(body.archive, rec), size = sp.spriteSize(pic.width, pic.height, {}, xml.scale), art = sp.spriteArtScale(body.archive, rec);
      const a = o * Math.PI / 4 + 0.05, eye = [3.6 * Math.sin(a), 1.4, 3.6 * Math.cos(a)];
      const yaw = Math.atan2(-eye[0], -eye[2]), right = [Math.cos(yaw), 0, -Math.sin(yaw)];
      const proj = m4.mirrorProjectionX(m4.perspective(50 * Math.PI / 180, W / H, 0.1, 50)), view = m4.lookAt(eye, [0, 0.95, 0], [0, 1, 0]);
      const x = (xml.x / xml.scale) * (mirror ? -1 : 1), base = xml.y / xml.scale;
      const fig = { base, mpp: size.h / pic.height, marks: ap.spriteMarks(new Uint32Array(pic.colors.buffer), pic.width, pic.height, { arms: o % 4 !== 2, art }), shift: x };
      const frame = ({ bow = false, quiver = null } = {}) => {
        r.beginFrame(proj, view, new Float32Array([0.3, -0.9, 0.2]));
        const bodyBatch = r.createBillboardBatch('probe-body', key, size, [[0, 0, 0]]);
        bodyBatch.origin = [right[0] * x, base, right[2] * x];
        r.drawBillboards([bodyBatch], right, [0, 1, 0]);
        const hung = [];
        if (quiver) hung.push(Hs.hangSpriteHolster(Hs.createSpriteHolster(), fig, o, [0, 0, 0], eye, right, quivers[quiver], Q.BACK_QUIVER));
        if (bow) hung.push(Hs.hangSpriteHolster(Hs.createSpriteHolster(), fig, o, [0, 0, 0], eye, right, arts.longbow));
        for (const l of hung) { Hs.mintSpriteHolster(l, r); r.drawBillboards(l.list, l.right, l.up); }
        const px = new Uint8Array(cv.width * cv.height * 4);
        gl.readPixels(0, 0, cv.width, cv.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
        r.destroyBillboardBatch(bodyBatch);
        for (const l of hung) Hs.dropSpriteHolster(l, r);
        return px;
      };
      const plain = frame(), qOnly = frame({ quiver: 'full' }), bowOnly = frame({ bow: true }), both = frame({ bow: true, quiver: 'full' }), empty = frame({ quiver: 'empty' });
      const vp = new Float32Array(16);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let t = 0; for (let k = 0; k < 4; k++) t += proj[k * 4 + i] * view[j * 4 + k]; vp[j * 4 + i] = t; }
      const project = (pt) => { const c = [0, 1, 2, 3].map((i) => vp[i] * pt[0] + vp[4 + i] * pt[1] + vp[8 + i] * pt[2] + vp[12 + i]); return [(c[0] / c[3] * 0.5 + 0.5) * cv.width, (c[1] / c[3] * 0.5 + 0.5) * cv.height]; };
      const acr = ar.auraSpriteAcross(fig), bodyCol = project([right[0] * acr, 1.2, right[2] * acr])[0];
      const shoulderRow = project([right[0] * acr, base + ar.EOTB_FIGURE.shoulder * fig.mpp * (fig.marks?.art > 0 ? fig.marks.art : 1), right[2] * acr])[1];
      const n = cv.width * cv.height, bg = [plain[0], plain[1], plain[2]];
      const diff = (p, q, i) => p[i * 4] !== q[i * 4] || p[i * 4 + 1] !== q[i * 4 + 1] || p[i * 4 + 2] !== q[i * 4 + 2];
      let qn = 0, qTop = -1, qCol = 0, onBody = 0, overlap = 0, bowOver = 0, en = 0, bowTop = -1, bowTopCol = 0, bn = 0, bCol = 0;
      for (let i = 0; i < n; i++) {
        const row = Math.floor(i / cv.width), col = i % cv.width;
        const q = diff(qOnly, plain, i), b = diff(bowOnly, plain, i);
        if (q) { qn++; qCol += col; if (row > qTop) qTop = row; if (plain[i * 4] !== bg[0] || plain[i * 4 + 1] !== bg[1] || plain[i * 4 + 2] !== bg[2]) onBody++; }
        if (b) { bn++; bCol += col; if (row > bowTop) { bowTop = row; bowTopCol = col; } }
        if (q && b) { overlap++; if (!diff(both, bowOnly, i)) bowOver++; }
        if (diff(empty, plain, i)) en++;
      }
      quiverOut.push({ body: bodyName, o, w: cv.width, h: cv.height, qn, en, qTop, shoulderRow, side: qn && bn ? qCol / qn - bCol / bn : 0, bowSide: bn ? bowTopCol - bCol / bn : 0, onBody, overlap, bowOver, both: toB64(both) });
    }
  }
  return { out, glowOut, quiverOut };
}, { pics, arrowPic, skinUrls, W, H });
await browser.close();
await server.close();

for (const s of shots) { s.worn = Buffer.from(s.worn, 'base64'); s.diff = Buffer.from(s.diff, 'base64'); }
// what the weapon changed, per view: how much, and its top and bottom fifths' mean column (row 0 the bottom) - the
// side views' slant is the pins' (backholster.test.js): there a weapon is mostly behind the body, its lean unreadable
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
    check(`${body} ${weapon}: from the front it is mostly behind the body`, v[0].n < v[4].n * 0.6, `front ${v[0].n} px against the back's ${v[4].n}`);
  }
}
for (const body of ['skin', 'layered']) {
  for (const weapon of Object.keys(WEAPONS)) {
    const v = by(body, weapon);
    check(`${body} ${weapon}: from the side it shows past the back and no pixel of it lies over the body`, [2, 6].every((o) => v[o].n > 0 && v[o].onBody === 0), `shown ${v.map((s) => s.n).join(',')}; on the body ${v.map((s) => s.onBody).join(',')}`);
  }
  const c = by(body, 'claymore');
  check(`${body}: from the side the Shadow Cloak's mass is behind the painted body, not on its chest`, [2, 6].every((o) => c[o].cape.behind > 1), `px behind the body's middle ${c.map((s) => s.cape.behind.toFixed(1)).join(',')}`);
}
for (const body of ['skin', 'layered']) {
  const v = by(body, 'claymore');
  check(`${body} claymore under the Shadow Cloak: the cape glows over the weapon from behind, and after the redraw not one of its pixels`,
    [3, 4, 5].every((o) => v[o].cape.tinted > 20) && v.every((s) => s.cape.still === 0),
    `tinted ${v.map((s) => s.cape.tinted).join(',')}; still ${v.map((s) => s.cape.still).join(',')} of ${v.map((s) => s.cape.shown).join(',')}`);
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
// BACK-HOLSTER GLOW
for (const body of ['skin', 'layered']) {
  const v = glowOut.filter((g) => g.body === body);
  const list = (k) => v.map((g) => g[k]).join(',');
  check(`${body}: the shock glows round the weapon on the back from behind and its diagonals`, [3, 4, 5].every((o) => v[o].glow > 150), `glow px ${list('glow')}`);
  check(`${body}: from the front its glow hides with the weapon - not one glowing pixel over the body where the weapon is hidden`, [0, 1, 7].every((o) => v[o].glowOnBodyHidden === 0) && v[0].glow < v[4].glow * 0.6, `over the body ${list('glowOnBodyHidden')}`);
  check(`${body}: the glow lives - the shock's pixels change as its clock runs`, [3, 4, 5].every((o) => v[o].moved > 20), `changed ${list('moved')}`);
  check(`${body}: the Aura Armory's Brand glows on the back too`, [3, 4, 5].every((o) => v[o].brandN > 100), `brand px ${list('brandN')}`);
  check(`${body}: over the Shadow Cloak, drawn after it`, [3, 4, 5].every((o) => v[o].overCape > 150), `over the cape ${list('overCape')}`);
  check(`${body}: drawn, the glow stands round the whole sprite from every side`, v.every((g) => g.handBand > 150), `band ${list('handBand')}; rim ${list('handOnBody')}`);
  check(`${body}: AUDIT A2 - a nearer wearer's cape lies over this one's weapon, never under it`, [3, 4, 5].every((o) => v[o].under > 20 && v[o].untinted === 0), `under the nearer cape ${list('under')}; untouched by it ${list('untinted')}`);
  check(`${body}: AUDIT A7 - in full fog the glow is fogged to nothing`, v.every((g) => g.fogged > 500 && g.fogLeft === 0), `fogged ${list('fogged')}; glow left ${list('fogLeft')}`);
  check(`${body}: AUDIT A8 - a glow behind the eye is culled, one in view drawn`, v.every((g) => g.culled), list('culled'));
}
// QUIVER
for (const body of ['skin', 'layered']) {
  const v = quiverOut.filter((g) => g.body === body);
  const list = (k) => v.map((g) => (typeof g[k] === 'number' ? Math.round(g[k]) : g[k])).join(',');
  check(`${body}: QUIVER - drawn on the back from behind and its diagonals, its arrows over the shoulders`, [3, 4, 5].every((o) => v[o].qn > 40 && v[o].qTop > v[o].shoulderRow), `px ${list('qn')}; top ${list('qTop')} over the shoulder row ${list('shoulderRow')}`);
  check(`${body}: QUIVER - from behind it sits off the bow's middle toward the right shoulder, as the bow's upper end does`, [3, 4, 5].every((o) => Math.sign(v[o].side) === Math.sign(v[o].bowSide) && Math.abs(v[o].side) > 2), `off the bow's middle ${list('side')}; the bow's top ${list('bowSide')}`);
  check(`${body}: QUIVER - the bow lies over it from behind`, [3, 4, 5].every((o) => v[o].overlap === 0 || v[o].bowOver === v[o].overlap), `bow over ${list('bowOver')} of ${list('overlap')}`);
  check(`${body}: QUIVER - from the front mostly behind the body`, v[0].qn < v[4].qn * 0.6, `front ${v[0].qn} against the back's ${v[4].qn}`);
  check(`${body}: QUIVER - from the front, its diagonals and the side, not one pixel over the body`, [0, 1, 2, 6, 7].every((o) => v[o].onBody === 0), `over the body ${list('onBody')}`);
  check(`${body}: QUIVER - empty, no arrows over its mouth`, [3, 4, 5].every((o) => v[o].en < v[o].qn), `empty ${list('en')} against full ${list('qn')}`);
}
if (SHOTS) {
  const qcw = 150, qch = 230, qs = new PNG({ width: qcw * 8, height: qch * 2 });
  for (const g of quiverOut) {
    const px = Buffer.from(g.both, 'base64'), x0 = Math.floor((g.w - qcw) / 2), y0 = Math.floor((g.h - qch) / 2), row = g.body === 'skin' ? 0 : 1;
    for (let y = 0; y < qch; y++) for (let x = 0; x < qcw; x++) {
      const si = ((g.h - 1 - (y0 + y)) * g.w + x0 + x) * 4, di = ((row * qch + y) * qs.width + g.o * qcw + x) * 4;
      for (let k = 0; k < 3; k++) qs.data[di + k] = px[si + k];
      qs.data[di + 3] = 255;
    }
  }
  writeFileSync(join(SHOTS, 'back-quiver.png'), PNG.sync.write(qs));
  console.log(`quiver sheet: ${join(SHOTS, 'back-quiver.png')} (rows: skin, layered - the long bow and its quiver; views 0-7 across)`);
}
if (SHOTS) {
  const cw = 150, ch = 230, rows = 8;
  const sheet = new PNG({ width: cw * 8, height: ch * rows });
  const lay = (row, g, b64) => {
    const px = Buffer.from(b64, 'base64'), x0 = Math.floor((g.w - cw) / 2), y0 = Math.floor((g.h - ch) / 2);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const si = ((g.h - 1 - (y0 + y)) * g.w + x0 + x) * 4, di = ((row * ch + y) * sheet.width + g.o * cw + x) * 4;
      for (let k = 0; k < 3; k++) sheet.data[di + k] = px[si + k];
      sheet.data[di + 3] = 255;
    }
  };
  for (const g of glowOut) { const b = g.body === 'skin' ? 0 : 3; lay(b, g, g.shot); lay(b + 1, g, g.cape); lay(b + 2, g, g.hand); lay(6 + (g.body === 'skin' ? 0 : 1), g, g.both); }
  writeFileSync(join(SHOTS, 'back-holster-glow.png'), PNG.sync.write(sheet));
  console.log(`glow sheet: ${join(SHOTS, 'back-holster-glow.png')} (rows: skin shock on the back, under the cape, drawn; layered the same; then a nearer cape over each; views 0-7 across)`);
}
const failed = results.filter((ok) => !ok).length;
console.log(`${results.length - failed}/${results.length} ok`);
process.exit(failed ? 1 : 0);
