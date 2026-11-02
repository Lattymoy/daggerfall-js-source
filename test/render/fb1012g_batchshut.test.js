// FIELD BUGS 2026-10-12g BATCH-SHUT - "Keep turning invisible, horses and any MW models": "models are disappearing
// including myself ... when I reload it shows my MW models for a second but then disappears"; "my character, enemy and
// npc sometimes (often) turn invisible, restarting the client seems to fix it for some minutes". horseCartPool's
// drawVeiled3d (a concealed peer's 3D horses, AUDIT COATS3D A5) opened the renderer's one body batch for a horse and
// flushed it only if one drew: a horse out of view left it open, and two opens met one flush. Every later body pass
// joined the open batch and no Morrowind picture drew again. The real batch doors, drawRigSpriteBox, the horse rig and
// the pool; GL alone is stubbed. bible/01-Overview/bugs/Field-Bugs-2026-10-12g.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { Renderer } from '../../src/render/renderer.js';
import { drawRigSpriteBox } from '../../src/render/characterSprite.js';
import { createHorseRig } from '../../src/world/horseRig.js';
import { createHorseCartPool } from '../../src/scenes/horseCartPool.js';
import { HORSE_SPRITE_WIDTH, HORSE_SPRITE_HEIGHT } from '../../src/systems/horse/horseCartLaw.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

async function stage(horses) {
  const r = Object.create(Renderer.prototype);
  r._spriteBatch = { items: [], open: false, depth: 0 };
  r.stats = { spriteBinds: 0 };
  const seen = { quads: 0 };
  r._renderCharacterSpriteTiles = () => ({});
  r.drawCharacterSpriteQuad = () => { seen.quads++; };
  r.renderCharacterSprite = () => ({});
  Object.defineProperty(r, 'retroImageSpan', { value: null });
  Object.defineProperty(r, 'worldImageSize', { value: null });   // BODY-CROP: no canvas behind this renderer - the picture reads the probe's
  let n = 0;
  Object.assign(r, {
    createSkinnedCharacterMesh: (s, o) => ({ vao: {}, vbo: {}, count: s.length / o.floats, floats: o.floats, skin: r.createSkinPalette(o) }),
    createSkinPalette: (o) => ({ tex: { id: ++n }, ...o }),
    releaseCharacterSkin: (m) => { if (m?.skin) m.skin.tex = null; },
    createCharacterTexture: () => ({ id: ++n }), releaseCharacterTexture: () => {},
    updateSkinPalette: () => {}, drawScreenOverlayQuad: () => {},
    uploadTexture: (a, b, px) => px, evictTexture: () => true, createBillboardBatch: (archive, record) => ({ archive, record, origin: [0, 0, 0] }),
    destroyBillboardBatch() {}, createMesh: () => ({}),
  });
  const rig = createHorseRig({
    renderer: r,
    fetchJson: async () => JSON.parse(rd('src/assets/horse/courser.json')),
    fetchBytes: async (u) => new Uint8Array(readFileSync(new URL(u))),
    decode: async (b) => { const p = PNG.sync.read(Buffer.from(b)); return { width: p.width, height: p.height, data: new Uint8Array(p.data) }; },
  });
  await rig.load();
  assert.ok(rig.ready(), `the rig: ${rig.failure?.()}`);
  const decode = async () => ({ width: HORSE_SPRITE_WIDTH, height: HORSE_SPRITE_HEIGHT, data: new Uint8ClampedArray(HORSE_SPRITE_WIDTH * HORSE_SPRITE_HEIGHT * 4).fill(200) });
  const pool = createHorseCartPool({ renderer: r, meshes: null, collider: () => null, now: () => 0, fetchFn: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }), decode, horses3d: () => rig, log: { warn() {} } });
  pool.attach({ view: () => ({ state: { HorseName: '' }, moving: null, deployed: null, horse: null, teamFollowing: false, horseFollowing: false, persistence: true }), lateUpdate() {}, rebase() {} });
  pool.presentation.horseArt.ensureStationary();
  for (let i = 0; i < 8; i++) await new Promise((res) => setTimeout(res, 0));
  pool.setPeerLook(() => ({ mode: 1, alpha: 0.3, t: 0, phase: 0 }));   // a peer under Chameleon: their horses are the veiled pass's
  horses.forEach((z, i) => pool.applyOwner(`peer-${i}`, { h: [0, 0, z, 0, 1, 0] }));
  return { r, rig, pool, seen };
}

const canvas = { clientWidth: 1280, clientHeight: 720 };
const f = 1 / Math.tan(Math.PI / 6);
const proj = new Float32Array([f / (1280 / 720), 0, 0, 0, 0, f, 0, 0, 0, 0, -1.002, -1, 0, 0, -0.2002, 0]);
const view = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);   // the eye at the origin, looking down -z
const me = { vao: {}, ranges: [] };

// one host frame: the body pass (world.js - begin, the player's own body, the pool's 3D horses, finally flush), then
// the opaque world, then the veiled pass
function frame({ r, rig, pool, seen }) {
  rig.tick();
  pool.frame(1 / 60, [0, 1.7, 0]);
  const q0 = seen.quads;
  r.beginCharacterSpriteBatch();
  try {
    drawRigSpriteBox(r, canvas, me, view, { center: [0, 1, -5], halfW: 0.5, halfH: 1 }, proj, view, [0, 0, 0], 3);
    pool.draw3d(canvas, { proj, view, eye: [0, 0, 0] });
  } finally { r.flushCharacterSpriteBatch(); }
  const mine = seen.quads - q0;
  const veiled = pool.drawVeiled3d();
  return { me: mine, veiled, open: r.characterSpriteBatchOpen };
}

test('BATCH-SHUT a concealed peer\'s horse behind the camera leaves no batch open, and the player\'s own body draws every frame after (mutants: the flush only when a horse drew; the flush out of the finally)', async () => {
  const s = await stage([12]);   // behind the eye: out of view
  for (let i = 1; i <= 4; i++) {
    const out = frame(s);
    assert.equal(out.veiled, 0, `frame ${i}: the horse is out of view`);
    assert.equal(out.open, false, `frame ${i}: the batch is shut`);
    assert.equal(out.me, 1, `frame ${i}: the player's body drew - it was 0 from the second frame on`);
  }
  assert.equal(s.r._spriteBatch.items.length, 0, 'and nothing piles up undrawn');
});

test('BATCH-SHUT one horse out of view and one in view: one open, one flush, the batch shut (mutants: an open for every horse until one draws)', async () => {
  const s = await stage([12, -8]);   // the first behind, the second ahead
  for (let i = 1; i <= 3; i++) {
    const out = frame(s);
    assert.ok(out.veiled > 0, `frame ${i}: the one in view drew`);
    assert.equal(out.open, false, `frame ${i}: shut - two opens met one flush and left depth 1`);
    assert.equal(out.me, 1, `frame ${i}: the player's body drew`);
  }
});

test('BATCH-SHUT the frame\'s start shuts a batch any pass left open, once said (mutants: the reset gone; its depth or queue kept)', () => {
  const src = rd('src/render/renderer.js');
  const begin = src.slice(src.indexOf('  beginFrame(proj, view, lightDir, opts = null) {'));
  const head = begin.slice(0, begin.indexOf('\n  }\n'));
  assert.match(head, /const sb = this\._spriteBatch;\n    if \(sb\?\.open\) \{\n      sb\.open = false; sb\.depth = 0; sb\.items\.length = 0;\n/, 'beginFrame lets a left batch go');
  assert.match(head, /if \(!this\._spriteBatchLeft\) \{ this\._spriteBatchLeft = true; console\.warn\(/, 'and says so once');
});
