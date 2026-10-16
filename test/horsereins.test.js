// HORSE-REINS (2026-10-16, from Discord - Redclaw, reskinning the horse: "are there reins that chunk out like this
// towards the back?"; the owner: "You can fix this. Also for the animated reigns we designed, ensure proper connection
// with the sprites and morrowind models"): the mod's rein mended as its pictures decode (systems/horseReins.js), and the
// harness's rope ends where the drawn horse is - the billboard's pose turned as its picture is
// (scenes/horseCartPool.js pictureTurn), the 3D horse's bones (world/horseRig.js tack).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PNG } from 'pngjs';
import {
  mendHorseReins, REIN_MENDS, REIN_LEATHER, REIN_LEATHER_LIT, REIN_LEATHER_UNDER, REIN_LOOP_DEPTH, REIN_RING, openAir,
  lineRow, pommelOf, reinPixels, reinPath, billboardBit, sideViewOf,
} from '../src/systems/horseReins.js';
import { recolorHorse, horseLookCode, isCoatPixel } from '../src/systems/horseCoats.js';
import { createHorseCartPool, pictureTurn } from '../src/scenes/horseCartPool.js';
import { calculateHorseOrientation, HORSE_SPRITE_WIDTH, HORSE_SPRITE_HEIGHT, HORSE_WALK_SPRITE_HEIGHT } from '../src/systems/horseCartLaw.js';
import { GLOBAL_SCALE } from '../src/player/activate.js';
import { toColor32 } from '../src/formats/color32Order.js';
import { createHorseRig, HORSE_TACK, tackSkins } from '../src/world/horseRig.js';
import { horseGait, stepHorseGait, writeHorsePalette, horsePaletteShape, horsePoseScratch } from '../src/world/horseModel.js';
import { TEAM, DRIVER_FIST } from '../src/world/wagonModels.js';

const T = 'vendor/horse-cart-and-cargo/Textures/';
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url));
const picture = (f) => { const p = PNG.sync.read(rd(T + f)); return { width: p.width, height: p.height, data: new Uint8Array(p.data) }; };
const px = (img, x, y) => { const o = (y * img.width + x) * 4; return [img.data[o], img.data[o + 1], img.data[o + 2], img.data[o + 3]]; };
const ALL = readdirSync(new URL(`../${T}`, import.meta.url)).filter((f) => f.endsWith('.png')).sort();
/** The transparent pixels the air never reaches about a throat line - its columns, within the loop's depth of it (the
 *  mane's own gaps, far over it, are the art's). */
const gaps = (img, line) => {
  const air = openAir(img.data, img.width, img.height), x0 = line[0][0], x1 = line[line.length - 1][0];
  let n = 0;
  for (let x = x0 + 1; x < x1; x++) { const e = lineRow(line, x); for (let y = Math.max(0, e - REIN_LOOP_DEPTH); y <= Math.min(img.height - 1, e + REIN_LOOP_DEPTH); y++) if (!img.data[(y * img.width + x) * 4 + 3] && !air[y * img.width + x]) n++; }
  return n;
};

test('HORSE-REINS the mend\'s table: every picture that draws a rein is named - the front\'s nine, both three-quarters\' and the side\'s - and the back\'s nine are not (no rein shows); every point inside its picture (mutants: a mend dropped)', () => {
  assert.equal(ALL.length, 45);
  const named = Object.keys(REIN_MENDS).sort();
  assert.equal(named.length, 36);
  assert.deepEqual(ALL.filter((f) => !REIN_MENDS[f]).sort(), ['Walk.4-1.png', 'Walk.4-2.png', 'Walk.4-3.png', 'Walk.4-4.png', 'Walk.4-5.png', 'Walk.4-6.png', 'Walk.4-7.png', 'Walk.4-8.png', 'horse5.png'], 'the back\'s pictures alone are drawn as the mod drew them');
  for (const f of named) {
    const m = REIN_MENDS[f], img = picture(f);
    const inside = ([x, y]) => x >= 0 && y >= 0 && x < img.width && y < img.height;
    for (const q of [...(m.throat ?? []), ...(m.bit ? [m.bit] : [])]) assert.ok(inside(q), `${f}: ${q} inside`);
    for (const [a, b, c, d] of m.drop ?? []) assert.ok(inside([a, b]) && inside([c, d]) && a <= c && b <= d, `${f}: its drop box`);
    if (m.throat) for (let k = 1; k < m.throat.length; k++) assert.ok(m.throat[k][0] > m.throat[k - 1][0], `${f}: the throat runs left to right`);
    const v = Number(/^Walk\.(\d)/.exec(f)?.[1] ?? Number(/horse(\d)/.exec(f)[1]) - 1);
    assert.equal(!!m.bit, v >= 1 && v <= 3, `${f}: a bit where the view shows the head's side`);
    assert.equal(!!m.drop, v === 0, `${f}: drops from the front`);
  }
  const back = picture('horse5.png');
  assert.equal(mendHorseReins('horse5.png', back), back, 'a picture with no mend is itself, no pass at all');
});

test('HORSE-REINS Redclaw\'s picture (horse3.png, the side): the loop slung under the throat is gone - no gap the air cannot reach is left under the jaw - and one rein runs from the bit to the pommel\'s front in the bridle\'s leather (mutants: the loop kept, the gaps left open, the rein undrawn, the lit leather everywhere)', () => {
  const img = picture('horse3.png'), m = REIN_MENDS['horse3.png'];
  const x0 = m.throat[0][0], x1 = m.throat[m.throat.length - 1][0];
  assert.ok(gaps(img, m.throat) >= 12, `the mod's loop holds the sky in steps under the throat (${gaps(img, m.throat)} pixels)`);
  const out = mendHorseReins('horse3.png', img);
  assert.notEqual(out, img); assert.deepEqual(img.data, picture('horse3.png').data, 'the decode is not written: a new picture');
  assert.equal(gaps(out, m.throat), 0, 'no gap left under the jaw');
  // nothing hangs under the throat's line but the new rein
  const rein = new Set(reinPath(m, [pommelOf(img.data, img.width, img.height)[0] - 1, pommelOf(img.data, img.width, img.height)[1] + 1]).map(([x, y]) => `${x},${y}`));
  for (let x = x0 + 1; x < x1; x++) for (let y = lineRow(m.throat, x) + 1; y <= lineRow(m.throat, x) + REIN_LOOP_DEPTH; y++) if (!rein.has(`${x},${y}`)) assert.equal(px(out, x, y)[3], 0, `${x},${y}: under the throat, open`);
  // the rein: bit to pommel, each pixel touching the last, every one the bridle's leather
  const path = reinPath(m, [...pommelOf(img.data, img.width, img.height)].map((v, i) => v + (i ? 1 : -1)));
  // under the throat it lies along the throat's new underside - a pixel under it, never a sliver of sky between
  for (const [x, y] of path) if (x > x0 && x < x1) assert.ok(y <= lineRow(m.throat, x) + 1, `${x},${y}: on the throat`);
  assert.ok(reinPixels(m.bit, path[path.length - 1], m.sag).some(([x, y]) => x > x0 && x < x1 && y > lineRow(m.throat, x) + 1), 'where the straight strap would have hung under it');
  assert.deepEqual(path[0], m.bit, 'from the bit');
  assert.deepEqual(pommelOf(img.data, img.width, img.height), [57, 30], 'the saddle\'s front, read off its leather');
  assert.deepEqual(path[path.length - 1], [56, 31], 'to the pommel\'s front');
  for (let k = 1; k < path.length; k++) assert.ok(Math.max(Math.abs(path[k][0] - path[k - 1][0]), Math.abs(path[k][1] - path[k - 1][1])) === 1, `${path[k]}: touching the last`);
  let lit = 0, dark = 0;
  const cleared = mendHorseReins('horse3.png', img, { 'horse3.png': { throat: m.throat } });   // the loop let go, no rein yet
  for (const [x, y] of path) {
    const [r, g, b, a] = px(out, x, y), was = px(cleared, x, y);
    assert.equal(a, 255);
    const under = was[3] && Math.max(was[0], was[1], was[2]) / 255 < REIN_LEATHER_UNDER;
    assert.deepEqual([r, g, b], [...(under ? REIN_LEATHER_LIT : REIN_LEATHER)], `${x},${y}: the bridle's leather - lit over the throat's shadow`);
    if (under) lit++; else dark++;
  }
  assert.ok(lit > 3 && dark > 15, `both leathers drawn (${lit} lit, ${dark} dark)`);
  // one pixel wide on the diagonal: no L-corners
  for (let k = 1; k < path.length - 1; k++) assert.equal(Math.max(Math.abs(path[k - 1][0] - path[k + 1][0]), Math.abs(path[k - 1][1] - path[k + 1][1])), 2, `${path[k]}: no L-corner`);
});

test('HORSE-REINS every mended picture: the gaps closed, only its own places touched - the throat\'s columns within the loop\'s depth, the rein, the drop boxes - and the drops empty (mutants: the depth unbounded, a drop missed)', () => {
  for (const [f, m] of Object.entries(REIN_MENDS)) {
    const img = picture(f), out = mendHorseReins(f, img);
    const rein = new Set();
    if (m.bit) { const p = pommelOf(img.data, img.width, img.height); for (const [x, y] of reinPath(m, [p[0] - 1, p[1] + 1])) rein.add(`${x},${y}`); }
    const x0 = m.throat?.[0][0], x1 = m.throat?.[m.throat.length - 1][0];
    if (m.throat) assert.equal(gaps(out, m.throat), 0, `${f}: no gap left under the jaw`);
    for (const [a, b, c, d] of m.drop ?? []) for (let y = b; y <= d; y++) for (let x = a; x <= c; x++) assert.equal(px(out, x, y)[3], 0, `${f}: ${x},${y} dropped`);
    for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
      const was = px(img, x, y), now = px(out, x, y);
      if (was.every((v, i) => v === now[i]) || (!was[3] && !now[3])) continue;
      const inThroat = m.throat && x > x0 && x < x1 && Math.abs(y - lineRow(m.throat, x)) <= REIN_LOOP_DEPTH;
      const inDrop = (m.drop ?? []).some(([a, b, c, d]) => x >= a && x <= c && y >= b && y <= d);
      assert.ok(inThroat || inDrop || rein.has(`${x},${y}`), `${f}: ${x},${y} changed outside its mend`);
    }
  }
});

test('HORSE-REINS the rein is leather on every coat: the dye\'s tack rule spares both leathers, so a grey horse keeps a brown rein - and the mend\'s rule is the dye\'s own (mutants: a leather outside the rule)', () => {
  for (const c of [REIN_LEATHER, REIN_LEATHER_LIT]) {
    assert.ok(isCoatPixel(c[0], c[1], c[2], false), 'warm enough to be hide but for the rule');
    assert.ok(!isCoatPixel(c[0], c[1], c[2], true), 'the tack rule\'s leather');
  }
  const f = 'horse3.png', m = REIN_MENDS[f];
  const out = mendHorseReins(f, picture(f));
  const grey = recolorHorse({ width: out.width, height: out.height, colors: out.data }, horseLookCode({ coat: 3, pattern: 0, legs: 0, seed: 5 }), { bottomFirst: false });
  const g = new Uint8Array(grey.colors.buffer, grey.colors.byteOffset, grey.colors.byteLength);
  const p = pommelOf(out.data, out.width, out.height);
  for (const [x, y] of reinPath(m, [p[0] - 1, p[1] + 1])) {
    const o = (y * out.width + x) * 4;
    assert.deepEqual([g[o], g[o + 1], g[o + 2]], [out.data[o], out.data[o + 1], out.data[o + 2]], `${x},${y}: kept on the grey`);
  }
  // pommelOf finds the saddle by the same rule the dye spares it by - swept over the colours
  for (let r = 0; r < 256; r += 17) for (let gg = 0; gg < 256; gg += 17) for (let b = 0; b < 256; b += 17) {
    const one = { width: 1, height: 1, data: new Uint8Array([r, gg, b, 255]) };
    assert.equal(!!pommelOf(one.data, 1, 1), isCoatPixel(r, gg, b, false) && !isCoatPixel(r, gg, b, true), `${r},${gg},${b}`);
  }
});

test('HORSE-REINS the pool mends what it decodes: the standing view uploaded is the mended picture, the vendored file the assembly\'s untouched (mutants: the mend unwired)', async () => {
  const uploads = new Map();
  const renderer = { uploadTexture: (a, rec, p) => { uploads.set(`${a}_${rec}`, p); return p; } };
  const decode = async (b) => { const p = PNG.sync.read(Buffer.from(b)); return { width: p.width, height: p.height, data: new Uint8Array(p.data) }; };
  const fetchFn = async (u) => ({ ok: true, arrayBuffer: async () => { const b = readFileSync(new URL(u)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); } });
  const pool = createHorseCartPool({ renderer, meshes: null, collider: () => null, now: () => 0, fetchFn, decode });
  pool.presentation.horseArt.ensureStationary();
  for (let i = 0; i < 50 && uploads.size < 5; i++) await new Promise((r) => setTimeout(r, 5));
  assert.equal(uploads.size, 5);
  const side = uploads.get('hcc_h2');
  const want = toColor32(mendHorseReins('horse3.png', picture('horse3.png')));
  assert.deepEqual(side.colors, want.colors, 'the side view as mended');
  assert.notDeepEqual(side.colors, toColor32(picture('horse3.png')).colors);
});

test('HORSE-REINS the billboard\'s bit: each pose\'s own, read off its side view - the standing horse\'s at its mouth, 1.31 m up, not WAGONS3\'s 1.7 at the brow - and REIN_RING out on its side; the collar measured on the chest (mutants: the height off the top, the side unread)', () => {
  const still = { width: HORSE_SPRITE_WIDTH, height: HORSE_SPRITE_HEIGHT, scale: GLOBAL_SCALE }, walk = { ...still, height: HORSE_WALK_SPRITE_HEIGHT };
  assert.equal(sideViewOf(null), 'horse3.png'); assert.equal(sideViewOf(4), 'Walk.2-5.png');
  const b = billboardBit(null, 1, still);
  assert.deepEqual(b.map((v) => +v.toFixed(4)), [REIN_RING, 1.3125, 1.175], 'horse3.png\'s bit (13, 41): 47 pixels before the middle, 52.5 over the foot');
  assert.deepEqual(billboardBit(null, -1, still), [-REIN_RING, b[1], b[2]]);
  const heights = Array.from({ length: 8 }, (_, f) => billboardBit(f, 1, walk)[1]);
  assert.ok(Math.max(...heights) - Math.min(...heights) > 0.15, `the head rises and falls through the walk (${heights.map((v) => v.toFixed(2))})`);
  assert.deepEqual([...TEAM.collar], [0.24, 1.24, 0.62], 'the collar on the chest\'s front (horse3.png column 36, row 44)');
});

test('HORSE-REINS pictureTurn: a point of the horse turned as its picture is - on the view\'s own bearing it stands where it is; off it, never more than half a view\'s step; and from every side its place across the picture is the drawn view\'s own, so the rein meets the bit the picture shows (mutants: the turn\'s sign, the view unread)', () => {
  const h = { position: [3, 0, -2], forward: [Math.sin(0.4), 0, Math.cos(0.4)] };
  const P = [REIN_RING, 1.31, 1.18];
  const right = [h.forward[2], 0, -h.forward[0]];
  for (let k = 0; k < 64; k++) {
    const a = (k / 64) * 2 * Math.PI + 0.003;   // the eye's bearing round the horse, world
    const eye = [h.position[0] + Math.sin(a) * 9, 2, h.position[2] + Math.cos(a) * 9];
    const q = pictureTurn(h, P, eye);
    assert.equal(+q[1].toFixed(9), P[1], 'the height its own');
    const turn = Math.acos(Math.max(-1, Math.min(1, (q[0] * P[0] + q[2] * P[2]) / Math.hypot(P[0], P[2]) / Math.hypot(q[0], q[2]))));
    assert.ok(turn <= Math.PI / 8 + 1e-9, `never past half a view's step (${turn})`);
    // the picture: the view's bearing phi (calculateHorseOrientation's 45 degree step), its right r(phi) on the horse's frame
    const o = calculateHorseOrientation(eye, h.position, h.forward), phi = (o * Math.PI) / 4;
    const uPicture = P[0] * -Math.cos(phi) + P[2] * -Math.sin(phi);
    // the drawn card faces the eye: its right is across the line of sight
    const w = [h.position[0] + right[0] * q[0] + h.forward[0] * q[2], 0, h.position[2] + right[2] * q[0] + h.forward[2] * q[2]];
    const d = [h.position[0] - eye[0], 0, h.position[2] - eye[2]], dl = Math.hypot(d[0], d[2]);
    const cardRight = [d[2] / dl, 0, -d[0] / dl];
    const uWorld = (w[0] - h.position[0]) * cardRight[0] + (w[2] - h.position[2]) * cardRight[2];
    assert.ok(Math.abs(uWorld - uPicture) < 1e-9, `bearing ${a.toFixed(2)}: across the card where the picture draws it (${uWorld} vs ${uPicture})`);
  }
  // the eye on the view's own bearing: no turn at all
  const behind = [h.position[0] - h.forward[0] * 9, 2, h.position[2] - h.forward[2] * 9];
  assert.deepEqual(pictureTurn(h, P, behind).map((v) => +v.toFixed(9)), P);
  assert.deepEqual(pictureTurn(h, P, null), P, 'no eye: as it is');
});

test('HORSE-REINS the 3D horse\'s tack: the bit at the mouth\'s corner and the collar at the shoulder\'s point, each skinned as the mesh is there - the bit rides the head down through the gallop; either side the mirror (mutants: the bones unread, the side unmirrored)', () => {
  const bake = JSON.parse(rd('src/assets/horse/courser.json').toString('utf8'));
  const skins = tackSkins(bake);
  assert.deepEqual(Object.keys(HORSE_TACK), ['bit', 'collar']);
  for (const part of ['bit', 'collar']) for (const side of [1, -1]) {
    const s = skins[part][side];
    assert.ok(Math.abs(s.reduce((a, [, w]) => a + w, 0) - 1) < 1e-12, `${part} ${side}: its weights one`);
  }
  assert.ok(skins.collar[-1].some(([b]) => bake.bones[b].name === 'Fore.R.Scapula') && skins.collar[1].some(([b]) => bake.bones[b].name === 'Fore.L.Scapula'), 'each side its own shoulder');
  const shape = horsePaletteShape(bake), pal = new Float32Array(shape.width * shape.height * 4), sc = horsePoseScratch(bake);
  const at = (part, side) => { const q = [0, 0, 0]; for (const [b, w, l] of skins[part][side]) { const o = b * 12, W = sc.world; for (let r = 0; r < 3; r++) q[r] += w * (W[o + r * 4] * l[0] + W[o + r * 4 + 1] * l[1] + W[o + r * 4 + 2] * l[2] + W[o + r * 4 + 3]); } return q; };
  const g = horseGait();
  stepHorseGait(g, bake, 0, 0, 1, true); writeHorsePalette(bake, g, pal, sc);
  const bit = at('bit', 1), collar = at('collar', 1);
  assert.ok(Math.abs(bit[0] - 0.07) < 0.01 && Math.abs(bit[1] - 1.42) < 0.03 && Math.abs(bit[2] - 1.41) < 0.08, `standing, the bit at the mouth (${bit.map((v) => v.toFixed(3))})`);
  assert.ok(Math.abs(collar[1] - 0.8) < 0.03 && Math.abs(collar[2] - 1.22) < 0.05, `the collar at the shoulder (${collar.map((v) => v.toFixed(3))})`);
  assert.ok(Math.abs(at('bit', -1)[0] + bit[0]) < 0.02, 'the left ring the right\'s mirror');
  let lo = Infinity, hi = -Infinity;
  for (let k = 0; k < 60; k++) { stepHorseGait(g, bake, 10.3, 1 / 30, 1, true); writeHorsePalette(bake, g, pal, sc); const z = at('bit', 1)[2]; lo = Math.min(lo, z); hi = Math.max(hi, z); }
  assert.ok(hi - lo > 0.25, `the gallop carries the bit down and up with the head (${lo.toFixed(2)}..${hi.toFixed(2)})`);
});

test('HORSE-REINS the rig answers its tack in the world: placed, turned and grown as the horse is (mutants: the model unread)', async () => {
  const r = { createSkinnedCharacterMesh: (s, o) => ({ vao: {}, vbo: {}, count: 1, floats: o.floats, skin: { tex: {} } }), createSkinPalette: () => ({ tex: {} }), releaseCharacterSkin: () => {}, createCharacterTexture: () => ({}), releaseCharacterTexture: () => {}, updateSkinPalette: () => {} };
  const rig = createHorseRig({ renderer: r, fetchJson: async () => JSON.parse(rd('src/assets/horse/courser.json').toString('utf8')), fetchBytes: async (u) => new Uint8Array(readFileSync(new URL(u))), decode: async (b) => { const p = PNG.sync.read(Buffer.from(b)); return { width: p.width, height: p.height, data: new Uint8Array(p.data) }; } });
  await rig.load();
  const h = rig.horse(1);
  assert.equal(rig.tack(h, 'bit', 1), null, 'not before it stands');
  rig.step(h, { feet: [10, 2, 30], yaw: 0, speed: 0, dt: 0 });
  const a = rig.tack(h, 'bit', 1);
  assert.ok(Math.abs(a[0] - 10.07) < 0.02 && Math.abs(a[2] - 31.42) < 0.05 && Math.abs(a[1] - 3.41) < 0.08, `ahead of the feet, on its right (${a.map((v) => v.toFixed(3))})`);
  rig.place(h, [10, 2, 30], Math.PI / 2, 2);
  const b = rig.tack(h, 'bit', 1);
  assert.ok(Math.abs(b[0] - 12.84) < 0.1 && Math.abs(b[2] - 29.86) < 0.05, `turned to +x and grown twice (${b.map((v) => v.toFixed(3))})`);
  assert.equal(rig.tack(h, 'girth', 1), null, 'no such tack');
});

test('HORSE-REINS the driver holds the rein in the fist - a palm along the fingers past the wrist the seat is solved to (mutants: the wrist)', () => {
  assert.equal(DRIVER_FIST, 0.08);
  const src = rd('src/scenes/horseCartPool.js').toString('utf8');
  assert.match(src, /const fist = \(hd\) => \[hd\.at\[0\] \+ hd\.fingers\[0\] \* DRIVER_FIST, hd\.at\[1\] \+ hd\.fingers\[1\] \* DRIVER_FIST, hd\.at\[2\] \+ hd\.fingers\[2\] \* DRIVER_FIST\];/);
  assert.match(src, /hands: \[grown\(fist\(hands\.L\)\), grown\(fist\(hands\.R\)\)\]/);
});
