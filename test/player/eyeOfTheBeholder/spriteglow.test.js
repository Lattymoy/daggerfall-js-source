// BACK-HOLSTER GLOW (2026-10-30, Mac: "if the weapon has an effect, like the shock effect or an equipped weapon aura,
// does it show?" - then "Do this and yes to #2"). The law (player/eyeOfTheBeholder/eotbGlow.js), my sprite's and the
// walkers' lists of what they drew, the world picture's glow in the renderer (drawBillboardGlow, its field's world arm),
// the shaders' bottom-up rows, and the wiring: the rig's hand, the aura host's last draw.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { myWeaponGlow, peerWeaponGlow, createSpriteGlow, setSpriteGlow, drawSpriteGlows, heldGlowPx, heldGlowRecord, evictHeld, HELD_SUFFIX } from '../../../src/player/eyeOfTheBeholder/eotbGlow.js';
import { uprightWeaponPicture, HOLSTER_LEFT_SLOT, holsterItemOfLook } from '../../../src/player/eyeOfTheBeholder/eotbHolster.js';
import * as WG from '../../../src/systems/weaponGlow.js';
import * as GL from '../../../src/render/weaponGlowGlsl.js';
import { armoryKitOf } from '../../../src/net/armoryLaw.js';
import { EQUIP_SLOTS } from '../../../src/systems/equip.js';
import { Renderer } from '../../../src/render/renderer.js';
import { createEotbBody } from '../../../src/player/eyeOfTheBeholder/eotbBody.js';
import { createPeerWalkers, createEotbArt } from '../../../src/net/peer/peerRiders.js';
import { spriteArtScale, worldOrderLayered } from '../../../src/player/eyeOfTheBeholder/eotbSprite.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const settle = (ms = 5) => new Promise((res) => setTimeout(res, ms));
const SWORD = { templateIndex: 120, group: 'Weapons', equipSlot: 19, material: 1 };
const SHOCK = { ...SWORD, glowSet: 'shock3' };   // law 9: a set glow reads the same in every hand
const BRAND = armoryKitOf({ weapon: 'breachbrand' });

test('BACK-HOLSTER GLOW the law: my weapon wears the weapon glow\'s own answer - meshGlow, so an enchanted one with no element is arcane (a paper-doll picture has no enchanted sheet); a bare fist its Hand Wraps\', else nothing of mine here; a peer\'s its look\'s word, a bare fist its kit\'s piece; none with the switch off (mutants: spriteGlow asked; the word ignored; the kit ignored; the switch ignored)', () => {
  assert.equal(myWeaponGlow(SHOCK, true), WG.glowSpec('shock', 3));
  const enchanted = { ...SWORD, enchantments: [{ type: 1 }] };
  assert.equal(myWeaponGlow(enchanted, true), WG.glowSpec('arcane', WG.ARCANE_LEVEL), 'law 5 - the classic hand would swing its WEAPO1xx sheet; a sprite has none');
  assert.equal(WG.spriteGlow(enchanted, { on: true }), null, 'which spriteGlow would not say');
  assert.equal(myWeaponGlow(SWORD, true), null, 'a plain weapon: none');
  assert.equal(myWeaponGlow(SHOCK, false), null, 'the switch off: none');
  assert.equal(myWeaponGlow(null, true, { templateIndex: 9999, glowSet: 'frost2' }), WG.glowSpec('frost', 2), 'a bare fist: its wraps\'');
  assert.equal(peerWeaponGlow({ ...SWORD, glow: 'shock3' }, null, true), WG.glowSpec('shock', 3), 'a peer\'s word');
  assert.equal(peerWeaponGlow({ ...SWORD, glow: 'nonsense' }, null, true), null, 'a word the wire would not take: none');
  assert.equal(peerWeaponGlow(null, BRAND, true), WG.glowSpec('brand', WG.ARMORY_LEVEL), 'a peer\'s bare fist: their kit\'s weapon piece');
  assert.equal(peerWeaponGlow({ ...SWORD, glow: 'shock3' }, BRAND, false), null, 'MY switch off: none');
  // the hand in use: a look's left hand with the pose's `lh`
  const left = { ...SWORD, equipSlot: HOLSTER_LEFT_SLOT };
  assert.equal(HOLSTER_LEFT_SLOT, EQUIP_SLOTS.LeftHand);
  assert.equal(holsterItemOfLook([SWORD, left], true), left);
  assert.equal(holsterItemOfLook([SWORD, left], false), SWORD);
});

test('BACK-HOLSTER GLOW the entries: one glow is a key (its archive and record), a look, its owner and the quad as the billboard stands, written in place; drawSpriteGlows draws each list through drawBillboardGlow - those whose owner `keep` takes - and counts those that drew (mutants: a list skipped; a lookless entry drawn; the owner ignored; the key never rewritten)', () => {
  const g = createSpriteGlow('p1'), o = [1, 2, 3];
  assert.equal(setSpriteGlow(g, 'a', 0, WG.glowSpec('fire', 1), o, [0, 0, 1], [0, 1, 0], 0.4, 1.4, 22, 74), g);
  o[0] = 9;
  assert.deepEqual([g.owner, g.key, g.origin, g.right, g.up, g.w, g.h, g.art], ['p1', 'a_0', [1, 2, 3], [0, 0, 1], [0, 1, 0], 0.4, 1.4, [22, 74]], 'copied, never held');
  setSpriteGlow(g, 'a', 1, WG.glowSpec('fire', 1), o, [0, 0, 1], [0, 1, 0], 0.4, 1.4, 22, 74);
  assert.equal(g.key, 'a_1', 'another record, another key');
  setSpriteGlow(g, 'a', 0, WG.glowSpec('fire', 1), o, [0, 0, 1], [0, 1, 0], 0.4, 1.4, 22, 74);
  const drew = [];
  const r = { drawBillboardGlow: (key, glow, q) => { drew.push([key, glow.look, q]); return key !== 'gone_0'; } };
  const h = setSpriteGlow(createSpriteGlow('p2'), 'gone', 0, WG.glowSpec('shock', 2), o, [1, 0, 0], [0, 1, 0], 1, 2, 3, 4);
  const none = createSpriteGlow();
  assert.equal(drawSpriteGlows(r, null, [g], [h, none], undefined), 1, 'the one that drew');
  assert.deepEqual(drew.map((d) => d.slice(0, 2)), [['a_0', 'fire'], ['gone_0', 'shock']], 'both owners\' lists, never an entry with no look');
  assert.equal(drew[0][2], g);
  drew.length = 0;
  assert.equal(drawSpriteGlows(r, (k) => k === 'p1', [g], [h, none]), 1);
  assert.deepEqual(drew.map((d) => d[0]), ['a_0'], 'only the owner `keep` takes');
  assert.equal(drawSpriteGlows(null, null, [g]), 0);
});

/** A WebGL2 stub that RECORDS (test/systems/weaponglow1.test.js's): every call's name and arguments, an enum its name. */
function loggingRenderer() {
  const log = [];
  let id = 0;
  const stub = new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (p, name) => ({ uniform: name, program: p });
      if (k === 'getAttribLocation') return () => 0;
      if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: ++id, kind: k });
      if (k === 'drawingBufferWidth') return 800;
      if (k === 'drawingBufferHeight') return 600;
      if (typeof k === 'string' && k.toUpperCase() === k) return k;
      return (...args) => { log.push([k, ...args]); };
    },
  });
  const canvas = { getContext: () => stub, clientWidth: 800, clientHeight: 600, width: 800, height: 600 };
  return { r: new Renderer(canvas), log };
}
const I = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const TENTH = () => new Float32Array([0.1, 0, 0, 0, 0, 0.1, 0, 0, 0, 0, 0.1, 0, 0, 0, 0, 1]);   // the world a tenth: the quads in the clip cube

test('BACK-HOLSTER GLOW drawBillboardGlow: the world picture\'s outline - its field baked once, whole (a pad under its foot, nothing cut, its rows bottom-up), then one quad standing as the billboard stands; depth tested and written nowhere, culling off for its quad, everything handed back; never a smear for a picture with no cells (mutants: the bottom cut; the rows read top-down; depth written; LEQUAL kept; culling left off; the sheet\'s list taken)', () => {
  const { r, log } = loggingRenderer();
  const spec = WG.glowSpec('shock', 3), [wx, up, down] = GL.GLOW_SPRITE_WINDOW.shock;
  const q = { origin: [1, 2, 3], right: [0, 0, 1], up: [0, 1, 0], w: 0.4, h: 1.4, art: [22, 74] };
  assert.equal(r.drawBillboardGlow('k_0', spec, q), false, 'before a frame: no camera, nothing');
  r.beginFrame(I(), TENTH(), new Float32Array([0, 1, 0]));
  assert.equal(r.drawBillboardGlow('k_0', spec, q), false, 'no such texture: nothing');
  r.textures.set('k_0', { id: 'picture' });
  for (const bad of [{ ...q, art: [0, 74] }, { ...q, art: [22, 0] }, { ...q, w: 0 }, null]) assert.equal(r.drawBillboardGlow('k_0', spec, bad), false, 'no cells, no size: no smear');
  assert.equal(r.drawBillboardGlow('k_0', null, q), false);
  r._ensureScreenQuadProgram();
  // AUDIT A8: off the view - nothing baked, nothing drawn; the switch that turns the billboards' cull off turns it off
  log.length = 0;
  const away = { ...q, origin: [40, 2, 3] };
  assert.equal(r.drawBillboardGlow('k_0', spec, away), false, 'off the view: nothing');
  assert.equal(log.filter((c) => c[0] === 'drawElements' || c[0] === 'texImage2D').length, 0, 'not even its field baked');
  assert.equal(r.drawBillboardGlow('k_0', spec, { ...q, origin: [-10.9, 2, 3] }), true, 'its pad on the view: drawn');
  r._glowWorldFieldList.length = 0; r._glowFields = new WeakMap();
  r._open2D(r._screenQuadVao);   // a 2D run left open - the glow must hand the world's state back before it draws
  log.length = 0;
  assert.equal(r.drawBillboardGlow('k_0', spec, q), true);
  const draws = log.flatMap((c, i) => (c[0] === 'drawElements' ? [i] : []));
  assert.equal(draws.length, 2, 'the bake, then the outline');
  const [bake, draw] = draws;
  const uniAt = (name, from, to) => log.slice(from, to).filter((c) => c[1]?.uniform === name).at(-1);
  assert.deepEqual(log.find((c) => c[0] === 'texImage2D').slice(3, 6), ['RGBA8', 22 + 2 * wx, 74 + down + up], 'the field: the picture, the window either side, over its head AND under its foot');
  assert.deepEqual(uniAt('uFieldPad', 0, bake).slice(2), [wx, down, wx, up]);
  assert.deepEqual(uniAt('uCut', 0, bake).slice(2), [0, 0, 0], 'nothing cut - a picture standing in the world is whole');
  assert.equal(uniAt('uFlipY', 0, bake)[2], 1, 'its rows bottom-up');
  const cullOff = log.findIndex((c) => c[0] === 'disable' && c[1] === 'CULL_FACE');
  assert.ok(cullOff >= 0 && cullOff < bake, 'culling off before the bake and the quad (the mirrored lens turns a quad over)');
  assert.ok(log.slice(bake, draw).some((c) => c[0] === 'useProgram' && c[1] === r.weaponGlowWorldProgram), 'its own program');
  assert.deepEqual(uniAt('uOrigin', bake, draw).slice(2), [1, 2, 3]);
  assert.deepEqual(uniAt('uRight', bake, draw).slice(2), [0, 0, 1]);
  assert.deepEqual(uniAt('uUp', bake, draw).slice(2), [0, 1, 0]);
  assert.deepEqual(uniAt('uSize', bake, draw).slice(2), [0.4, 1.4]);
  assert.deepEqual(uniAt('uPad', bake, draw).slice(2), [wx, down, wx, up], 'grown by the window on every side');
  assert.deepEqual(uniAt('uArt', bake, draw).slice(2), [22, 74]);
  assert.deepEqual(uniAt('uFieldAt', bake, draw).slice(2), [wx, down]);
  assert.deepEqual([uniAt('uLook', bake, draw)[2], uniAt('uLevel', bake, draw)[2], uniAt('uReachMax', bake, draw)[2]], [WG.GLOW_CODE.shock, 3, GL.GLOW_REACH_MAX.shock]);
  assert.ok(uniAt('uVP', bake, draw), 'the frame\'s camera');
  assert.ok(uniAt('uFogMode', bake, draw)?.[1].program === r.weaponGlowWorldProgram, 'AUDIT A7: the frame\'s fog, on its own program');
  const before = log.slice(bake, draw);
  assert.ok(before.some((c) => c[0] === 'depthMask' && c[1] === false), 'written nowhere');
  assert.ok(before.some((c) => c[0] === 'depthFunc' && c[1] === 'LEQUAL'), 'passing on the picture\'s own card');
  assert.ok(before.some((c) => c[0] === 'blendFunc' && c[1] === 'ONE' && c[2] === 'ONE_MINUS_SRC_ALPHA'), 'premultiplied');
  const after = log.slice(draw).map((c) => c.slice(0, 2).join(' '));
  for (const want of ['depthFunc LESS', 'depthMask true', 'disable BLEND', 'enable CULL_FACE']) assert.ok(after.includes(want), `${want} given back`);
  assert.ok(!r._2dVao, 'the 2D run closed first');
  const close = log.findIndex((c) => c[0] === 'enable' && c[1] === 'DEPTH_TEST');
  assert.ok(close >= 0 && close < bake, 'the depth test handed back before anything drew');
  assert.equal(r._glowWorldFieldList.length, 1, 'kept in the world\'s list');
  assert.equal(r._glowFieldList.length, 0, 'never the first-person sheet\'s');
  // the next frame of the same picture reads the field it baked
  log.length = 0;
  r.drawBillboardGlow('k_0', spec, q);
  assert.equal(log.filter((c) => c[0] === 'drawElements').length, 1, 'one draw: the field kept');
  // the same picture under the sheet's own outline is another field - its rows the other way, its bottom cut
  log.length = 0;
  r.drawScreenQuadGlow(r.textures.get('k_0'), { x: 100, y: 50, w: 300, h: 240 }, undefined, spec, { art: [22, 74], view: [800, 600] });
  assert.equal(log.filter((c) => c[0] === 'drawElements').length, 2, 'never the world\'s field');
  // and the classic sheet's bake still reads its rows top-down, its bottom cut
  log.length = 0;
  r.drawScreenQuadGlow({ id: 'frame' }, { x: 100, y: 50, w: 300, h: 240 }, undefined, spec, { art: [60, 48], view: [800, 600] });
  const b2 = log.findIndex((c) => c[0] === 'drawElements');
  assert.equal(uniAt('uFlipY', 0, b2)[2], 0, 'the sheet\'s rows as they are');
  assert.deepEqual(uniAt('uCut', 0, b2).slice(2), [0, 0, 1]);
});

test('BACK-HOLSTER GLOW the world program at its build: bottom-up rows (uFlipY 1), read from the top (uSrc 0 1 1 0), a hair toward the eye (GLOW_CHARGE_PULL), its picture on unit 0 and its field on unit 1', () => {
  const { r, log } = loggingRenderer();
  r._ensureScreenQuadProgram();
  r._ensureWeaponGlowQuadProgram();
  const of = (name) => log.filter((c) => c[1]?.uniform === name && c[1]?.program === r.weaponGlowWorldProgram).at(-1)?.slice(2);
  assert.deepEqual(of('uFlipY'), [1]);
  assert.deepEqual(of('uSrc'), [0, 1, 1, 0]);
  assert.deepEqual(of('uPull'), [GL.GLOW_CHARGE_PULL]);
  assert.deepEqual([of('uTex'), of('uField')], [[0], [1]]);
});

test('BACK-HOLSTER GLOW the shaders: the field and the outline read a world picture\'s bottom-up rows counted from its top, as the sheet\'s are; the world quad grows by its pad and stands on the billboard\'s basis (mutants: either flip dropped; the quad\'s rows the wrong way)', () => {
  assert.match(GL.GLOW_FIELD_FS, /if \(a\.x < 0 \|\| a\.y < 0 \|\| a\.x >= uArt\.x \|\| a\.y >= uArt\.y\) return false;\n  if \(uFlipY == 1\) a\.y = uArt\.y - 1 - a\.y;/, 'the field: flipped after its bounds, before its fetch');
  assert.match(GL.GLOW_SPRITE_FS, /ivec2 a = ivec2\(floor\(uv \* vec2\(uArt\)\)\);\n  if \(uFlipY == 1\) a\.y = uArt\.y - 1 - a\.y;/, 'the outline: its cell flipped, its texel read as the uv says');
  assert.match(GL.GLOW_WORLD_VS, /vec2 q = mix\(-uPad\.xy \/ art, 1\.0 \+ uPad\.zw \/ art, vec2\(p\.x, 1\.0 - p\.y\)\);/, 'top-down, grown by the pad');
  assert.match(GL.GLOW_WORLD_VS, /return uOrigin \+ uRight \* \(\(q\.x - 0\.5\) \* uSize\.x\) \+ uUp \* \(\(1\.0 - q\.y\) \* uSize\.y\);/, 'on the billboard\'s basis, its foot the origin');
  assert.match(GL.GLOW_WORLD_VS, /vWorld = gwWorld\(q\);\n  gl_Position = uVP \* vec4\(vWorld, 1\.0\);/);
  // AUDIT A7: fogged to nothing at its place in the world, as the auras are
  const fs = GL.glowWorldFs(GL.GLOW_SPRITE_FS, 'FOG');
  assert.match(fs, /out vec4 outColor;\nin vec3 vWorld;\nuniform int uFogMode;\nuniform float uFogDensity;\nuniform vec2 uFogRange;\nuniform vec3 uCamPos;\nFOG/);
  assert.match(fs, /void gwPaint\(\) \{/);
  assert.match(fs, /float gwFog\(\) \{ return fogFactorAt\(vWorld\); \}\nvoid main\(\) \{\n  gwPaint\(\);\n  outColor \*= gwFog\(\);\n\}$/);
  assert.equal(fs.split('void main()').length, 2, 'one main');
  assert.throws(() => GL.glowWorldFs('void main() {}', 'FOG'), /needs one/);
  assert.match(GL.GLOW_WORLD_VS, /gl_Position\.z \+= uPull \* gl_Position\.w;/);
  assert.equal(GL.GLOW_WORLD_FIELDS_MAX, 256);
});

// ── my sprite ─────────────────────────────────────────────────────────────────────────────────────────────────────
const PIC = uprightWeaponPicture((() => {
  const W = 40, H = 64, colors = new Uint8Array(W * H * 4);
  for (let y = 0; y <= 60; y++) for (let x = 19; x <= 21; x++) colors[(y * W + x) * 4 + 3] = 255;
  for (let y = 44; y <= 58; y++) for (let x = 21; x <= 34; x++) colors[(y * W + x) * 4 + 3] = 255;
  return { width: W, height: H, colors };
})());
function recordingRenderer() {
  return {
    uploads: [], batches: [], draws: [], destroyed: [], textures: new Map(),
    uploadTexture(archive, rec, img) { this.uploads.push({ archive, rec, img }); this.textures.set(`${archive}_${rec}`, img); },
    evictTexture(key) { this.textures.delete(key); },
    createBillboardBatch(archive, record, size) { const b = { archive, record, size: { ...size }, origin: [0, 0, 0] }; this.batches.push(b); return b; },
    destroyBillboardBatch(b) { this.destroyed.push(b); },
    drawBillboards(batches, right, up) { this.draws.push({ batch: batches[0], right: [...right], up: [...up] }); },
  };
}
function cameraFor(o, feet, nudge = 0.05) {
  const a = o * Math.PI / 4 + nudge, tc = [Math.sin(a), 0, Math.cos(a)];
  const yaw = Math.atan2(-tc[0], -tc[2]);
  return { eye: [feet[0] + 2 * tc[0], feet[1] + 1.5, feet[2] + 2 * tc[2]], yaw, right: [Math.cos(yaw), 0, -Math.sin(yaw)] };
}
async function liveBody(opts = {}, walk = true) {
  const r = recordingRenderer();
  const b = createEotbBody({
    count: () => 3035, urlFor: (k) => `/art/${k}.png`,
    decode: async () => ({ width: 53, height: 110, colors: new Uint32Array(53 * 110) }),
    loadLantern: async () => null, loadHolster: async () => PIC, glowOn: true, ...opts,
  });
  b.attach(r, () => ({}));
  await settle();
  b.toggle(true, false);
  const behind = cameraFor(4, [0, 0, 0], 0);
  for (let i = 0; walk && i < 12; i++) b.tick(1 / 60, { motion: { forward: 1, standing: false, speed: 5, grounded: true, height: 1.8 }, feet: [0, 0, 0], yaw: behind.yaw, cameraPos: behind.eye });
  return { b, r };
}
function viewFrom(b, o, extra = {}) {
  const cam = cameraFor(o, [0, 0, 0]);
  for (let i = 0; i < 12; i++) b.tick(1 / 60, { motion: { forward: 0, standing: true, speed: 0, grounded: true, height: 1.8 }, feet: [0, 0, 0], yaw: cam.yaw, cameraPos: cam.eye, ...extra });
  b.draw(null, { eye: cam.eye, feet: [0, 0, 0], yaw: cam.yaw });
  return b.state().glows;
}

test('BACK-HOLSTER GLOW (my sprite): sheathed, the weapon on its back glows - its holster\'s picture and quad; drawn, the glow stands round the whole sprite - the body\'s picture and quad, in its own pixels; the rig\'s hand in use is the weapon asked; none concealed, in first person, in the saddle, as a beast, for a plain weapon, with the switch off (mutants: the hand glow on a sheathed body; the back glow drawn; the rig\'s hand ignored; the cells not the picture\'s)', async () => {
  const { b, r } = await liveBody();
  viewFrom(b, 4, { handItem: SHOCK }); await settle(); viewFrom(b, 4, { handItem: SHOCK });
  let g = viewFrom(b, 4, { handItem: SHOCK });
  assert.equal(g.length, 1, 'sheathed: one glow, on its back');
  const h = b.state().holster;
  assert.ok(g[0].key.startsWith('eotb-holster:') && g[0].key.endsWith('_0'), `the holster's picture, as drawn from behind (${g[0].key})`);
  assert.equal(g[0].look, 'shock');
  assert.deepEqual([g[0].w, g[0].h, g[0].up], [h.w, h.h, h.up], 'its quad as the holster stands');
  assert.deepEqual(g[0].art, [PIC.width, PIC.height], 'in the weapon picture\'s own pixels');
  assert.equal(viewFrom(b, 0, { handItem: SHOCK })[0].key.slice(-2), '_1', 'from the front its mirrored face');
  // drawn: the whole sprite
  g = viewFrom(b, 4, { handItem: SHOCK, sheathed: false, weaponReady: true });
  assert.equal(g.length, 1, 'drawn: one glow, round the body');
  const body = r.batches.filter((x) => typeof x.archive === 'number').at(-1);
  assert.equal(g[0].key, `${body.archive}_${body.record}`, 'the body\'s own picture');
  assert.deepEqual([g[0].origin, g[0].w, g[0].h], [body.origin, body.size.w, body.size.h], 'its quad as the body stands');
  const art = spriteArtScale(body.archive, Number(String(body.record).split('_')[0]) || 0);
  assert.deepEqual(g[0].art.map(Math.round), [Math.round(53 / art), Math.round(110 / art)], 'in the sprite\'s own pixels');
  assert.deepEqual(g[0].up, [0, 1, 0]);
  // the hand in use is the rig's: a left-hand weapon glows and goes on the back, the right hand's plain one does not
  g = viewFrom(b, 4, { handItem: { ...SHOCK, equipSlot: 21, glowSet: 'frost2' } });
  assert.equal(g[0]?.look, 'frost', 'the rig\'s hand, not the equip table\'s right');
  // none
  for (const [why, extra] of [
    ['concealed', { handItem: SHOCK, concealment: { invisible: true } }],
    ['a plain weapon', { handItem: SWORD }],
    ['in the saddle', { handItem: SHOCK, sheathed: false, riding: true }],
    ['a beast', { handItem: SHOCK, sheathed: false, transformed: true, lycanthropyType: 1 }],
    ['drawn, concealed', { handItem: SHOCK, sheathed: false, concealment: { shade: true } }],
  ]) assert.equal(viewFrom(b, 4, extra).length, 0, why);
  assert.equal(viewFrom(b, 4, { handItem: SHOCK }).length, 1);
  b.standDown();
  assert.equal(b.glowsDrawn().length, 0, 'the Morrowind body takes the frame: its list emptied');
  assert.equal(viewFrom(b, 4, { handItem: SHOCK }).length, 1);
  b.toggle(false);
  assert.equal(b.glowsDrawn().length, 0, 'the body put away: its list emptied, never drawn over the next frame');
  b.toggle(true, true);
  assert.equal(viewFrom(b, 4, { handItem: SHOCK, sheathed: false }).length, 0, 'first person');
  const off = await liveBody({ glowOn: false });
  viewFrom(off.b, 4, { handItem: SHOCK }); await settle();
  assert.equal(viewFrom(off.b, 4, { handItem: SHOCK }).length, 0, 'the switch off');
});

test('AUDIT BACK-HOLSTER A5 (my sprite): the weapon drawn, its ready picture still uploading, the last picture stands - and the glow round it is keyed to it, in its pixels, never to the picture asked (mutants: keyed to the picture asked)', async () => {
  const { b, r } = await liveBody({}, false);   // standing from the first: the idle picture
  const bodies = () => r.batches.filter((x) => typeof x.archive === 'number');
  const sheathed = { handItem: SHOCK, sheathed: true, weaponReady: false };
  viewFrom(b, 4, sheathed); await settle(); viewFrom(b, 4, sheathed);
  const standing = bodies().at(-1);
  for (const k of [...r.textures.keys()]) if (k !== `${standing.archive}_${standing.record}`) r.textures.delete(k);   // let go by another store (PEER-ART): uploaded again
  const drawn = { handItem: SHOCK, sheathed: false, weaponReady: true };
  const g = viewFrom(b, 4, drawn);   // the ready stance asked, its picture not up
  assert.equal(bodies().at(-1), standing, 'the last picture stands');
  assert.equal(g[0]?.key, `${standing.archive}_${standing.record}`, 'and its glow is on it');
  await settle();
  const g2 = viewFrom(b, 4, drawn), now = bodies().at(-1);
  assert.ok(now !== standing && g2[0]?.key === `${now.archive}_${now.record}`, `the ready picture up: its glow with it ${bodies().map((x) => x.record).join(' ')} ${g[0]?.key} ${g2[0]?.key}`);
});

test('BACK-HOLSTER GLOW (the others): a walker\'s weapon on its back glows by its look\'s word; its weapon drawn, round the whole walker - the hand in use (`lh`), a bare fist\'s kit piece; none at a gathering act, concealed, or by the word of a plain weapon (mutants: the walkers never list; the hand in use ignored; the kit ignored)', async () => {
  const rr = recordingRenderer();
  const art = createEotbArt({ renderer: rr, urlFor: (k) => `u:${k}`, decode: async () => ({ width: 50, height: 110, colors: new Uint32Array(50 * 110) }), loadHolster: async () => PIC });
  const w = createPeerWalkers({ art });
  const FEET = [4, 0, 9];
  const pose = (o = {}) => ({ x: FEET[0], y: FEET[1], z: FEET[2], yaw: 0, pitch: 0, mv: 0, wd: 0, an: 0, sr: 0, cn: 0, ar: 0, ...o });
  const walker = (o = {}, items = [{ ...SWORD, glow: 'shock3' }], ak = null) => ({ id: 'p1', look: { eo: 2, gender: 'male', race: 'Breton', items }, ak, shown: pose(o) });
  const frame = (peer, o = 4) => { const cam = cameraFor(o, FEET); w.sync([peer], (p) => [p.x, p.y, p.z], { eye: cam.eye, right: cam.right, dt: 1 / 60 }); return { glows: w.glowsDrawn(), cam }; };
  frame(walker()); await settle(); frame(walker()); await settle();
  let { glows } = frame(walker());
  assert.equal(glows.length, 1, 'sheathed: on its back');
  const l = w.walkers.get('p1').holster;
  assert.deepEqual([glows[0].key, glows[0].glow?.look, glows[0].art], [`${l.archive}_${l.mirror ? 1 : 0}`, 'shock', [PIC.width, PIC.height]]);
  let cam;
  ({ glows, cam } = frame(walker({ wd: 1 })));
  assert.equal(glows.length, 1, 'drawn: round the walker');
  const r0 = w.walkers.get('p1');
  assert.deepEqual([glows[0].key, glows[0].origin, glows[0].right, glows[0].up, glows[0].w, glows[0].h], [`${r0.batch.archive}_${r0.batch.record}`, r0.batch.origin, cam.right, [0, 1, 0], r0.size.w, r0.size.h]);
  assert.deepEqual(glows[0].art, [50, 110]);
  // the hand in use
  ({ glows } = frame(walker({ wd: 1, lh: 1 }, [{ ...SWORD, glow: 'shock3' }, { ...SWORD, equipSlot: 21, glow: 'frost2' }])));
  assert.equal(glows[0]?.glow?.look, 'frost', 'the left hand, with `lh`');
  // a bare fist: the kit's piece
  ({ glows } = frame(walker({ wd: 1 }, [], BRAND)));
  assert.equal(glows[0]?.glow?.look, 'brand', 'their kit\'s weapon piece');
  ({ glows } = frame(walker({ wd: 1 }, [], null)));
  assert.equal(glows.length, 0, 'a bare fist and no kit: none');
  ({ glows } = frame(walker({ wd: 1 }, [SWORD])));
  assert.equal(glows.length, 0, 'a plain weapon\'s look carries no word');
  ({ glows } = frame(walker({ wd: 1, ga: 1 })));
  assert.equal(glows.length, 0, 'at a gathering act its hands hold a tool');
  const veiled = (peer) => { const c = cameraFor(4, FEET); w.sync([peer], (p) => [p.x, p.y, p.z], { eye: c.eye, right: c.right, dt: 1 / 60, conceal: () => ({ mode: 3, alpha: 0.4 }) }); return w.glowsDrawn(); };
  assert.equal(veiled(walker({ wd: 1 })).length, 0, 'concealed, drawn: none');
  assert.equal(veiled(walker()).length, 0, 'concealed, sheathed: none');
});

test('BACK-HOLSTER GLOW the wiring: the rig says the hand in use and its wraps; my body hands them on; the aura host draws them every frame - a body wearing no aura before the auras, a wearer\'s after its own (AUDIT A2) - and the armory over them (mutants: the host never draws them; a bare body\'s after the auras)', () => {
  const rig = read('src/combat/weapon/weaponRig.js');
  assert.match(rig, /handItem: playerWeapon\.handItem\(playerWeapon\.leadHand\),/);
  assert.match(rig, /handWraps: playerWeapon\.wrapsOf\(playerWeapon\.leadHand\),/);
  const host = read('src/scenes/auraHost.js');
  const bare = host.indexOf('if (proj && view) backs.drawBare(worn);'), capes = host.indexOf('drawAurasThenBacks(auraDraw,'), armory = host.indexOf('drawArmory(armoryOver');
  assert.ok(bare > 0 && capes > bare && armory > capes, 'the bare before the auras, the wearers\' with them, the armory after');
  assert.match(host, /if \(pass\) for \(const w of auraDraw\) worn\.add\(w\.id\);/, 'a wearer is one whose aura draws');
});

// ── LAYERED-GLOW ───────────────────────────────────────────────────────────────────────────────────────────────────────
test('LAYERED-GLOW (2026-10-30, the owner: "ensure all third person weapons get the glow on equip (a prior change kinda did this but for the whole body)"): a worn-armour picture\'s weapon px, as uploaded - row 0 the bottom, mirrored as the body; its own picture uploaded once beside the body\'s, the weapon alone; none this frame, no glow; none of its own, the whole sprite (mutants: rows top-down; the mirror ignored; uploaded every frame; the body\'s px in it; the empty frame glows)', () => {
  const W = 4, H = 3, colors = Uint32Array.from({ length: W * H }, (_, i) => 100 + i), held = new Uint8Array(W * H);
  held[1] = 1;   // the top row, x 1
  const h = heldGlowPx(colors, held, W, H);
  assert.deepEqual([...h.idx], [(H - 1) * W + 1], 'the top row is the last uploaded');
  assert.deepEqual([...h.col], [colors[(H - 1) * W + 1]]);
  assert.deepEqual([...heldGlowPx(colors, held, W, H, true).idx], [(H - 1) * W + 2], 'mirrored as the body');
  assert.equal(heldGlowPx(colors, null, W, H), null, 'a skin: none of its own');
  assert.equal(heldGlowPx(colors, new Uint8Array(5), W, H), null, 'a mask not the picture\'s size: none');
  const r = recordingRenderer();
  assert.equal(heldGlowRecord(r, 1700, 'lll@ls1_2-1', null, W, H), null, 'none of its own: the whole sprite');
  assert.equal(heldGlowRecord(r, 1700, 'lll@ls1_2-1', heldGlowPx(colors, new Uint8Array(W * H), W, H), W, H), '', 'none this frame: no glow');
  assert.equal(r.uploads.length, 0);
  assert.equal(heldGlowRecord(r, 1700, 'lll@ls1_2-1', h, W, H), `lll@ls1_2-1${HELD_SUFFIX}`);
  assert.equal(heldGlowRecord(r, 1700, 'lll@ls1_2-1', h, W, H), `lll@ls1_2-1${HELD_SUFFIX}`);
  assert.equal(r.uploads.length, 1, 'uploaded once');
  const up = r.uploads[0];
  assert.deepEqual([up.archive, up.rec, up.img.width, up.img.height], [1700, `lll@ls1_2-1${HELD_SUFFIX}`, W, H], 'the sprite\'s size, beside its record');
  assert.deepEqual([...up.img.colors], [...colors].map((c, i) => (i === (H - 1) * W + 1 ? c : 0)), 'the weapon alone');
  r.textures.clear();
  heldGlowRecord(r, 1700, 'lll@ls1_2-1', h, W, H);
  assert.equal(r.uploads.length, 2, 'let go by a store: uploaded again');
  // the decoders carry the compose's px with the picture they turn
  const o = worldOrderLayered({ width: 2, height: 1, data: Uint8Array.from([1, 2, 3, 255, 4, 5, 6, 255]), held: Uint8Array.from([0, 1]) });
  assert.deepEqual([o.width, o.height, o.colors.length, [...o.held]], [2, 1, 2, [0, 1]]);
  assert.equal(worldOrderLayered({ width: 1, height: 1, data: new Uint8Array(4) }).held, null);
  assert.match(read('src/player/eyeOfTheBeholder/eotbSprite.js'), /isLayeredKey\(url\)\) return worldOrderLayered\(await decodeLayered\(/);
  assert.match(read('src/net/peer/peerRiders.js'), /isLayeredKey\(url\)\) return worldOrderLayered\(await decodeLayered\(/);
});

test('LAYERED-GLOW (my sprite, the others): drawn, a worn-armour body\'s glow stands round its weapon - its own picture, the body\'s quad and pixels; a frame that hides the weapon glows not at all; my outfit let go, its weapon picture goes too (mutants: the whole sprite kept; the empty frame glows; the weapon picture left in the renderer)', async () => {
  const W = 53, H = 110, held = new Uint8Array(W * H);
  for (let y = 40; y < 60; y++) held[y * W + 30] = 1;
  const pic = (mask) => async () => ({ width: W, height: H, colors: new Uint32Array(W * H).fill(0xff203040), held: mask });
  const drawn = { handItem: SHOCK, sheathed: false, weaponReady: true };
  const { b, r } = await liveBody({ decode: pic(held) });
  viewFrom(b, 4, drawn); await settle();
  const g = viewFrom(b, 4, drawn), body = r.batches.filter((x) => typeof x.archive === 'number').at(-1);
  assert.equal(g.length, 1);
  assert.equal(g[0].key, `${body.archive}_${body.record}${HELD_SUFFIX}`, 'round the weapon\'s own picture');
  assert.deepEqual([g[0].origin, g[0].w, g[0].h], [body.origin, body.size.w, body.size.h], 'on the body\'s quad');
  assert.equal([...r.textures.get(g[0].key).colors].filter(Boolean).length, 20, 'the weapon\'s px alone');
  const none = await liveBody({ decode: pic(new Uint8Array(W * H)) });
  viewFrom(none.b, 4, drawn); await settle();
  assert.equal(viewFrom(none.b, 4, drawn).length, 0, 'the frame hides the weapon: no glow');
  // the others: a walker's decode carrying its weapon's px
  const rr = recordingRenderer();
  const art = createEotbArt({ renderer: rr, urlFor: (k) => `u:${k}`, decode: async () => ({ width: 50, height: 110, colors: new Uint32Array(50 * 110).fill(1), held: Uint8Array.from({ length: 50 * 110 }, (_, i) => (i % 50 === 20 && i < 50 * 30 ? 1 : 0)) }), loadHolster: async () => PIC });
  const w = createPeerWalkers({ art }), FEET = [4, 0, 9];
  const peer = { id: 'p1', look: { eo: 2, gender: 'male', race: 'Breton', items: [{ ...SWORD, glow: 'shock3' }] }, ak: null, shown: { x: FEET[0], y: FEET[1], z: FEET[2], yaw: 0, pitch: 0, mv: 0, wd: 1, an: 0, sr: 0, cn: 0, ar: 0 } };
  const frame = () => { const cam = cameraFor(4, FEET); w.sync([peer], (p) => [p.x, p.y, p.z], { eye: cam.eye, right: cam.right, dt: 1 / 60 }); return w.glowsDrawn(); };
  frame(); await settle(); frame(); await settle();
  const wg = frame(), r0 = w.walkers.get('p1');
  assert.equal(wg[0]?.key, `${r0.batch.archive}_${r0.batch.record}${HELD_SUFFIX}`, 'a walker\'s round its weapon');
  assert.equal([...rr.textures.get(wg[0].key).colors].filter(Boolean).length, 30);
  // let go with the look: the body's picture and its weapon's - where one was uploaded
  for (const src of [read('src/player/eyeOfTheBeholder/eotbBody.js'), read('src/net/peer/peerRiders.js')]) {
    // the release itself: the body's picture let go and its weapon's beside it (the retry's evictHeld is another door)
    assert.match(src, /evictTexture\?\.\((?:k|key)\.replace\(':', '_'\)\);(?:\s*\/\/[^\n]*\n\s*|\s*)evictHeld\(renderer, (?:k|key)\.replace\(':', '_'\)\)/, 'the weapon\'s picture goes with the body\'s');
  }
  const gone = [];
  const kept = { textures: new Map([[`1700_a${HELD_SUFFIX}`, {}]]), evictTexture(k) { gone.push(k); this.textures.delete(k); } };
  evictHeld(kept, '1700_a'); evictHeld(kept, '1700_b');
  assert.deepEqual(gone, [`1700_a${HELD_SUFFIX}`], 'only one that was uploaded');
});
