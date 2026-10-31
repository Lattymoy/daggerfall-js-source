// ARMORY-MIRROR (2026-10-30, the owner: "New guild arm band isnt correct on the sprite. Head aura doesnt allign on the
// sprite", then "Only worry about the layered system"; bible/01-Overview/bugs/Field-Bugs-2026-10-30e.md) - THE AURA
// ARMORY ON LAYERED GEARING IN THE REAL RENDERER, under the game's own mirrored lens (world/mat4.js mirrorProjectionX),
// from all eight views: each body composed as the world composes it (eotbSprite.js spriteFor, decodeSprite, flipRows),
// drawn along the billboards' camRight, the pass after it. Each head piece must stand over the painted head, the Insignia
// Armlet on the painted left upper arm and no wider than it, or hidden where the picture hides that arm.
// --shots writes a sheet per body (CLOSE=1: close up at the arm) - a render of game data, so never into the repo.
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
const CLOSE = process.env.CLOSE === '1', SETS = process.env.SETS === '1', ONLY = process.env.ONLY ?? '';
const [ANIM, FRAME] = (process.env.ANIM ?? 'Idle:0').split(':');   // AUDIT AURA-PIXEL C1: a walk's frames too (ANIM=Move:2)
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
const W = SETS ? 300 : CLOSE ? 400 : 240, H = SETS ? 500 : CLOSE ? 300 : 320;
const out = await page.evaluate(async ({ W, H, CLOSE, SETS, ONLY, ANIM, FRAME }) => {
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
  // Layered Gearing as the world wears it (layeredArmor.js outfit codes: helmet, chest, legs; `~dye` a cloak)
  const BODIES = {
    'male leather': { gender: 'male', outfit: 'lll' }, 'male chain': { gender: 'male', outfit: 'lcl' }, 'male plate': { gender: 'male', outfit: 'p6p6p6' },
    'female leather': { gender: 'female', outfit: 'lll' }, 'female chain': { gender: 'female', outfit: 'lcl' }, 'female plate': { gender: 'female', outfit: 'p3p3p3' },
    'male cloak': { gender: 'male', outfit: 'lcl~2' }, 'female cloak': { gender: 'female', outfit: 'lll~5' },
  };
  const ARMS = { heraldry: { field: 'crimson', border: 'gold', device: 'dragon', division: 'quarterly', field2: 'sable' }, logo: null };
  // SETS=1: every body piece of both lines alone, and each line whole
  const KITS = SETS ? { crown: 'a0000', halo: 'b0000', heart: '0a000', sigil: '0b000', ashbound: '00a00', armlets: '00b00', cinder: '000a0', greaves: '000b0', dagonfire: 'aaaa0', eternal: 'bbbb0' }
    : CLOSE ? { armlet: '00c00' } : { crown: 'a0000', halo: 'b0000', armlet: '00c00', heart: '0a000', greaves: '000b0' };
  const rows = [];
  for (const [bodyName, who] of Object.entries(BODIES).filter(([n]) => !ONLY || ONLY.split('|').includes(n))) {
    const look = { onFoot: 0, wornArmour: true, ...who };
    for (let o = 0; o < 8; o++) {
      const s = sp.spriteFor(ANIM, o, +FRAME || 0, look);
      if (!s) { rows.push({ body: bodyName, o, missing: true }); continue; }
      const raw = await sp.decodeSprite(sp.eotbSpriteUrl(s.key));
      const colors = s.mirror ? sp.flipRows(raw.colors, raw.width, raw.height) : raw.colors;   // eotbBody.js ensure()'s
      const key = `${bodyName}-${o}`;
      r.uploadTexture('probe-body', key, { width: raw.width, height: raw.height, colors: new Uint8Array(colors.buffer, colors.byteOffset, colors.byteLength) });
      const xml = sp.spriteOffset(s.archive, s.record), size = sp.spriteSize(raw.width, raw.height, {}, xml.scale);
      // the camera at view o of a figure at the origin facing +Z, a hair off the views' edges, as eotbBody stands it
      const a = o * Math.PI / 4 + 0.05, d = SETS ? 2.6 : CLOSE ? 1.2 : 2.4, eye = [d * Math.sin(a), 1.6, d * Math.cos(a)];
      const yaw = Math.atan2(-eye[0], -eye[2]), right = [Math.cos(yaw), 0, -Math.sin(yaw)];   // eotbBody's camRight
      const proj = m4.mirrorProjectionX(m4.perspective(50 * Math.PI / 180, W / H, 0.1, 50)), view = m4.lookAt(eye, [0, SETS ? 1.1 : CLOSE ? 1.35 : 1.2, 0], [0, 1, 0]);   // the game's HANDEDNESS (mat4.js)
      const x = (xml.x / xml.scale) * (s.mirror ? -1 : 1), base = xml.y / xml.scale;
      const marks = ap.spriteMarks(new Uint32Array(colors.buffer, colors.byteOffset, raw.width * raw.height), raw.width, raw.height, { arms: ap.spriteArmsSeen(s.view), art: sp.spriteArtScale(s.archive, s.record) });
      const fig = { base, mpp: size.h / raw.height, marks, shift: x };
      const pose = ap.newPose(); ap.poseFromFigure(fig, pose);
      const faced = bb.portrayedYaw(o, [eye[0], 0, eye[2]]);
      const frame = (kit) => {
        r.beginFrame(proj, view, new Float32Array([0.3, -0.9, 0.2]));
        const batch = r.createBillboardBatch('probe-body', key, size, [[0, 0, 0]]);
        batch.origin = [right[0] * x, base, right[2] * x];
        r.drawBillboards([batch], right, [0, 1, 0]);
        if (kit) pass.draw([{ at: [0, 0, 0], yaw: faced, kit, pose, seed: 0.37, kindle: 1, torn: -1, mounted: false, _d: d, arms: ARMS }], proj, view, new Float32Array(eye), 5.3, null, true);
        const px = new Uint8Array(cv.width * cv.height * 4);
        gl.readPixels(0, 0, cv.width, cv.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
        r.destroyBillboardBatch(batch);
        return px;
      };
      const vp = m4.multiply(proj, view);
      /** the screen column (0 the left) a world point lands on under the game's lens */
      const colOf = (pt) => { const c = [0, 1, 2, 3].map((i) => vp[i] * pt[0] + vp[4 + i] * pt[1] + vp[8 + i] * pt[2] + vp[12 + i]); return (c[0] / c[3] * 0.5 + 0.5) * cv.width; };
      /** and the readback's row (0 the bottom) */
      const rowOf = (pt) => { const c = [0, 1, 2, 3].map((i) => vp[i] * pt[0] + vp[4 + i] * pt[1] + vp[8 + i] * pt[2] + vp[12 + i]); return (c[1] / c[3] * 0.5 + 0.5) * cv.height; };
      /** a picture's column (px off its middle) at height `y` where the billboard draws it: along camRight from the card's middle */
      const along = (px, y) => { const dd = x + px * fig.mpp; return [right[0] * dd, y, right[2] * dd]; };
      const yOf = (n) => pose.pts[ap.POSE_AT[n] + 1];
      /** screen px a picture's pixel is wide at height `y` - the tolerances are the picture's pixels */
      const pxAt = (y) => Math.abs(colOf(along(1, y)) - colOf(along(0, y)));
      const plain = frame(null);
      const row = { body: bodyName, o, w: cv.width, h: cv.height, plain: toB64(plain), pieces: {} };
      const mk = fig.marks, fwd = [Math.sin(faced), 0, Math.cos(faced)];
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
        // comet and its spark run round the ring and pull its mean); the armlet on the left upper arm where the picture
        // paints it clear of the body and no wider (a side view's at the body's back edge, where its near arm hangs); the
        // heart on the chest seen square on; the greaves between the painted knees and feet
        let want = null, tol = 1.8, span = null, y = 1.2;
        if (name === 'crown' || name === 'halo') { y = yOf('head'); want = mk?.head != null ? colOf(along(mk.head, y)) : null; }
        const side = name === 'armlet' ? apass.armletSide(pose, fwd, [0, 1.2, 0], eye) : null;
        if (side && mk?.arms) {
          const arm = mk.arms[side], b = arm.band, k = apass.ARMORY_ARMLET.at;
          y = b ? pose.bands[side].y : yOf(`sh${side}`) + (yOf(`el${side}`) - yOf(`sh${side}`)) * k;
          want = colOf(along(b ? b.c : arm.sh + (arm.el - arm.sh) * k, y)); tol = 1.5;
          if (b) span = [colOf(along(b.c - b.wd / 2, y)), colOf(along(b.c + b.wd / 2, y))].sort((p, q) => p - q);
        } else if (side && mk?.flank && o === 6) {   // the left side seen: its near arm, at its back edge
          const back = fwd[0] * right[0] + fwd[2] * right[2] < 0 ? mk.flank.hi - ap.ARM_PX.half * mk.art : mk.flank.lo + ap.ARM_PX.half * mk.art;
          y = pose.flank.y; want = colOf(along(back, y)); tol = 1.5;
        }
        // CHEST-CENTRE: the heart from the front and the three-quarters, the sigil from those and straight behind - on the
        // picture's chest (AUDIT AURA-PIXEL D2: from behind and to a side that mark takes in the near arm, so there the
        // Sigil's back is read clear of the arm instead, after the views)
        if (((name === 'heart' && [0, 1, 7].includes(o)) || (name === 'sigil' && [0, 1, 4, 7].includes(o))) && mk?.chest != null) { y = yOf('chest'); want = colOf(along(mk.chest, y)); }
        if (name === 'greaves' && mk?.legs) { y = (yOf('knL') + yOf('ftL')) / 2; want = colOf(along((mk.legs.knee[0] + mk.legs.knee[1] + mk.legs.ankle[0] + mk.legs.ankle[1]) / 4, y)); tol = o % 4 === 2 ? 3 : 1.8; }
        const unit = pxAt(y);
        // the arms' pieces, each arm (armSide): none over an arm the picture hides (from behind, its line where it would
        // stand); on one it shows clear, at the band's row no wider than the painted arm
        const armChecks = [];
        if ((name === 'ashbound' || name === 'armlets') && mk?.arms) {
          const strong = (i) => Math.abs(worn[i * 4] - plain[i * 4]) + Math.abs(worn[i * 4 + 1] - plain[i * 4 + 1]) + Math.abs(worn[i * 4 + 2] - plain[i * 4 + 2]) > 90;
          for (const arm of ['left', 'right']) {
            const sd = apass.armWornSide(pose, fwd, [0, 1.2, 0], eye, arm);
            if (!sd) {
              const ps = (arm === 'left') === (fwd[0] * eye[0] + fwd[2] * eye[2] > 0) ? 'R' : 'L', A = mk.arms[ps], yy = yOf(`sh${ps}`) + (yOf(`el${ps}`) - yOf(`sh${ps}`)) * 0.45;
              const c0 = colOf(along(A.sh + (A.el - A.sh) * 0.45, yy)), u = pxAt(yy), r0 = Math.round(rowOf(along(A.sh + (A.el - A.sh) * 0.45, yy)));
              let hits = 0;
              for (let rr = r0 - Math.round(4 * u); rr <= r0 + Math.round(4 * u); rr++) for (let cc = Math.round(c0 - 2 * u); cc <= Math.round(c0 + 2 * u); cc++) if (rr >= 0 && rr < cv.height && cc >= 0 && cc < cv.width && strong(rr * cv.width + cc)) hits++;
              armChecks.push({ what: `the ${arm} arm hidden: nothing over it`, ok: hits === 0, detail: `${hits} px at its line` });
              continue;
            }
            const b = mk.arms[sd]?.band;
            if (!b) continue;
            const yy = pose.bands[sd].y, u = pxAt(yy), c0 = colOf(along(b.c, yy)), sp = [colOf(along(b.c - b.wd / 2, yy)), colOf(along(b.c + b.wd / 2, yy))].sort((p, q) => p - q);
            const r0 = Math.round(rowOf(along(b.c, yy)));
            let l2 = Infinity, h2 = -Infinity;
            for (let rr = r0 - Math.round(u); rr <= r0 + Math.round(u); rr++) for (let cc = Math.round(c0 - b.wd * u); cc <= Math.round(c0 + b.wd * u); cc++) if (rr >= 0 && rr < cv.height && cc >= 0 && cc < cv.width && strong(rr * cv.width + cc)) { l2 = Math.min(l2, cc); h2 = Math.max(h2, cc); }   // a chain's dark links leave a row bare
            armChecks.push({ what: `the ${arm} arm's band: on it, no wider`, ok: l2 <= h2 && l2 >= sp[0] - u && h2 <= sp[1] + u, detail: `${l2}..${h2} px, the arm ${sp[0].toFixed(1)}..${sp[1].toFixed(1)}` });
          }
          // ARM-BEHIND: both arms shown - nothing of the pieces between their inner edges, over the body. AUDIT AURA-PIXEL C1/C2:
          // every arm, its band read or not, its edge along the arm as the pose stands it (moved across onto its band)
          const shown = ['left', 'right'].map((arm) => apass.armWornSide(pose, fwd, [0, 1.2, 0], eye, arm)).filter(Boolean);
          if (shown.length === 2 && mk.chest != null) {
            const innerAt = (sd, yy) => {
              const A = mk.arms[sd], b = A.band, y0 = yOf(`sh${sd}`), y1 = yOf(`el${sd}`), t = (yy - y0) / ((y1 - y0) || 1);
              let c = A.sh + (A.el - A.sh) * t;
              if (b) { const tb = (pose.bands[sd].y - y0) / ((y1 - y0) || 1); c += b.c - (A.sh + (A.el - A.sh) * tb); }
              const half = b ? b.wd / 2 : ap.ARM_PX.half * mk.art;
              return colOf(along(c + Math.sign(mk.chest - c) * half, yy));
            };
            let hits = 0, rows = 0;
            const y0 = Math.max(yOf('elL'), yOf('elR')), y1 = Math.min(yOf('shL'), yOf('shR'));
            for (let q = 0; q <= 16; q++) {
              const yy = y0 + (y1 - y0) * q / 16, rr = Math.round(rowOf(along(0, yy))), [c0, c1] = [innerAt('L', yy), innerAt('R', yy)].sort((p, q2) => p - q2), u = pxAt(yy);
              rows++;
              for (let cc = Math.ceil(c0 + 1.5 * u); cc <= Math.floor(c1 - 1.5 * u); cc++) if (rr >= 0 && rr < cv.height && cc >= 0 && cc < cv.width && strong(rr * cv.width + cc)) hits++;
            }
            armChecks.push({ what: 'nothing over the body between the arms', ok: hits === 0, detail: `${hits} px over ${rows} rows` });
          }
        }
        const col = name === 'halo' ? (hi >= lo ? (lo + hi) / 2 : null) : n ? sum / n : null;
        row.pieces[name] = { n, col, onBody: n ? onBody / n : 0, want, tol: tol * unit, unit, span, lo, hi, armChecks, worn: toB64(worn) };
      }
      rows.push(row);
    }
  }
  return rows;
}, { W, H, CLOSE, SETS, ONLY, ANIM, FRAME });

for (const row of out) {
  if (row.missing) { check(`${row.body} view ${row.o}: a picture`, false); continue; }
  for (const [name, p] of Object.entries(row.pieces)) {
    if (name === 'armlet' && (row.o === 2 || row.o === 3)) {   // the right side seen, or behind and to the right: the left arm is behind the body
      check(`${row.body} view ${row.o} armlet: the left arm behind the body, hidden`, p.n < 20, `${p.n} px changed`);
      continue;
    }
    for (const c of p.armChecks ?? []) check(`${row.body} view ${row.o} ${name}: ${c.what}`, c.ok, c.detail);
    if (p.want == null) continue;   // the heart from behind or the side: not measured here (tools/armoryProbe.mjs)
    if (p.col == null) { check(`${row.body} view ${row.o} ${name}: drawn`, false, 'nothing changed'); continue; }
    const off = Math.abs(p.col - p.want);
    check(`${row.body} view ${row.o} ${name}: over its painted part`, off <= p.tol, `its middle ${p.col.toFixed(1)} px, the picture's ${p.want.toFixed(1)}, ${off.toFixed(1)} off of ${p.tol.toFixed(1)} (${Math.round(p.onBody * 100)}% on the body)`);
    if (p.span) check(`${row.body} view ${row.o} ${name}: no wider than the painted arm`, p.lo >= p.span[0] - p.unit && p.hi <= p.span[1] + p.unit, `${p.lo}..${p.hi} px, the arm ${p.span[0].toFixed(1)}..${p.span[1].toFixed(1)}, a pixel ${p.unit.toFixed(1)}`);
  }
}
// AUDIT AURA-PIXEL D2: from behind and to a side, the Sigil's back clear of the near arm - read against where the Eternal
// Armlets draw on that arm, never against the chest mark the Sigil is placed by
for (const row of out) {
  const sg = row.pieces?.sigil, am = row.pieces?.armlets;
  if ((row.o === 3 || row.o === 5) && sg && am && sg.hi >= sg.lo && am.hi >= am.lo) check(`${row.body} view ${row.o} sigil: clear of the near arm`, sg.hi < am.lo || sg.lo > am.hi, `the sigil ${sg.lo}..${sg.hi} px, the armlet ${am.lo}..${am.hi}`);
}
check('no page error', !errors.length, errors.join(' / '));
if (SHOTS) {
  // a sheet per body: its eight views, the plain picture over each piece worn
  for (const body of [...new Set(out.map((r) => r.body))]) {
    const these = out.filter((r) => r.body === body && !r.missing);
    if (!these.length) continue;
    const names = ['plain', ...Object.keys(these[0].pieces)], w = these[0].w, h = these[0].h;
    const sheet = new PNG({ width: w * these.length, height: h * names.length });
    these.forEach((r, ci) => names.forEach((n, ri) => {
      const px = Buffer.from(n === 'plain' ? r.plain : r.pieces[n].worn, 'base64');
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const s = ((h - 1 - y) * w + x) * 4, d = ((ri * h + y) * sheet.width + ci * w + x) * 4;   // readPixels' rows are bottom-up
        sheet.data[d] = px[s]; sheet.data[d + 1] = px[s + 1]; sheet.data[d + 2] = px[s + 2]; sheet.data[d + 3] = 255;
      }
    }));
    writeFileSync(join(SHOTS, `armory_${body.replace(/ /g, '_')}.png`), PNG.sync.write(sheet));
  }
  console.log(`sheets in ${SHOTS}`);
}
await browser.close();
await server.close();
const failed = results.filter((x) => !x).length;
console.log(`${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
