// FB1015 (2026-10-15, the owner: "When looting dead marrowind enemies, they turn to a sprite. The models also clip
// through geometry") - bible/04-Characters/Morrowind-NPCs.md section 29.
//
// LOOT-BODY: both dungeon hosts return before drawFoes under a window, and AUDIT MW-NPC C6 showed every corpse flat
// there - so the loot window, opened on a body, stood its classic corpse in its place. The window's frame now draws the
// lane's bodies as its last sync left them, frozen (characters/foeBodies.js drawBodiesUnderWindow).
//
// BODY-DEPTH: every body is a picture composited as one quad, depth-tested as a flat card through its middle - a corpse
// lying toward the eye sank its near half under the floor, a body at a wall was cut where the card crossed it. The quad
// now writes each texel's own depth off the picture's (render/characterSprite.js pictureDepth, renderer.js
// drawCharacterSpriteQuad `depth`).
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { drawBodiesUnderWindow } from '../../src/characters/foeBodies.js';
import { createNpcBodies } from '../../src/characters/npcBodies.js';
import { BODY_LINGER_MS } from '../../src/net/peer/peerBodies.js';
import { drawRigSpriteBox, pictureDepth, PICTURE_NEAR } from '../../src/render/characterSprite.js';
import { multiply, perspective, lookAt } from '../../src/world/mat4.js';
import { setPref } from '../../src/systems/uiPrefs.js';
import { Renderer } from '../../src/render/renderer.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => { setPref('mwBillboardLook', false); });

/** a stub body rig: built, third person once skinned, its steps and draws counted */
function stubRigs() {
  const log = { updates: 0, draws: 0 };
  const rig = () => {
    const r = { mode: 'first', skinned: false, dead: false,
      attach() {}, async build() { await flush(); return { ok: true }; },
      canThirdPerson: () => true, raceHeightScale: () => 1, setViewMode(m) { r.mode = m; return true; },
      thirdActive: () => r.mode === 'third' && r.skinned,
      update(dt, o) { log.updates++; if (o?.pose !== false) r.skinned = true; },
      drawThird() { log.draws++; return r.thirdActive(); }, unload() {}, setSheathed() {}, revive() { r.dead = false; }, die() { r.dead = true; } };
    return r;
  };
  return { rig, log };
}

/** a renderer that counts its body-pass batches */
const batching = () => { const r = { open: 0, flushed: 0 }; r.beginCharacterSpriteBatch = () => { r.open++; }; r.flushCharacterSpriteBatch = () => { r.flushed++; }; return r; };

test('FB1015 LOOT-BODY: under a window the lane\'s bodies are drawn FROZEN as its last sync left them - the dead\'s and the living\'s stand however long the window stays open (past the linger a sync of nobody would let them fall to), nothing steps, a corpse flat is cast-only where its body stands and shown where none does', async () => {
  let clock = 1000;
  const { rig, log } = stubRigs();
  const lane = createNpcBodies({ renderer: {}, tier: () => 'near', createRig: rig, now: () => clock });
  const look = { race: 'Breton', gender: 'male', faceIndex: 0, items: [] };
  const live = { id: 1, dead: false, batch: { castOnly: false } };
  const dead = { id: 2, dead: true, corpse: true, corpseBatch: { castOnly: false } };
  const other = { id: 3, dead: true, corpse: true, corpseBatch: { castOnly: true } };   // a corpse no body stood for (past the cut)
  const foes = [live, dead, other];
  const stood = [live, dead];
  // drawFoes' frames: the living and the dead offered, synced, skinned
  for (let i = 0; i < 12; i++) {
    lane.begin();
    lane.stand('foe', { id: 1, look, feet: [0, 0, -3], yaw: 0, dead: 0 });
    lane.stand('foe', { id: 2, look: { ...look, faceIndex: 1 }, feet: [1, 0, -3], yaw: 0, dead: 2 });
    lane.end(1 / 60, [0, 0, 0]);
    for (let k = 0; k < 4; k++) await flush();
    clock += 16;
  }
  assert.ok(lane.has('foe', 1) && lane.has('foe', 2), 'both bodies stand before the window');
  // the window: drawFoes is not reached; its frames run for longer than a body lingers
  const r = batching();
  const before = log.updates, drawsBefore = log.draws;
  for (let i = 0; i < 4; i++) {
    clock += BODY_LINGER_MS;
    assert.equal(drawBodiesUnderWindow(lane, foes, stood, { idOf: (f) => f.id, corpseFlat: (f) => f.corpseBatch, renderer: r, canvas: {}, proj: null, view: null, eye: [0, 0, 0] }), true);
  }
  assert.ok(lane.has('foe', 1), 'the living body still stands - never left to linger and fall under the window');
  assert.ok(lane.has('foe', 2), 'the body the loot window was opened on still stands - not its classic corpse');
  assert.equal(log.updates, before, 'frozen: no body stepped (dt 0)');
  assert.equal(log.draws - drawsBefore, 8, 'both bodies drawn on each of the four window frames');
  assert.deepEqual([r.open, r.flushed], [4, 4], 'in one body pass a frame, opened and flushed');
  assert.equal(dead.corpseBatch.castOnly, true, 'its corpse flat casts alone under its body');
  assert.equal(other.corpseBatch.castOnly, false, 'a corpse with no body standing shows its flat (AUDIT MW-NPC C6\'s law)');
  assert.equal(live.batch.castOnly, false, 'a living foe\'s billboard is not this pass\'s to mark');
  lane.destroy();
});

test('FB1015 LOOT-BODY: no lane, or a lane offered nothing at its last sync - every corpse flat shown, no pass drawn', () => {
  const flats = [{ castOnly: true }, { castOnly: true }];
  const foes = [{ dead: true, corpseBatch: flats[0] }, { dead: true, corpseBatch: flats[1] }, { dead: false }];
  const r = batching();
  const o = { idOf: (f) => f.id, corpseFlat: (f) => f.corpseBatch, renderer: r, canvas: {}, proj: null, view: null, eye: [0, 0, 0] };
  assert.equal(drawBodiesUnderWindow(null, foes, foes, o), false);
  assert.deepEqual(flats.map((b) => b.castOnly), [false, false]);
  flats[0].castOnly = true;
  let drawn = false;
  assert.equal(drawBodiesUnderWindow({ offered: 0, has: () => true, draw() { drawn = true; } }, foes, foes, o), false);
  assert.equal(flats[0].castOnly, false);
  assert.deepEqual([drawn, r.open], [false, 0]);
});

test('FB1015 LOOT-BODY (by source): both dungeon hosts draw the window\'s bodies just before the level\'s flats and ahead of the window\'s return; the context hands its own lane, foes and last offer to the one door (AUDIT MW-NPC C6 moved: it showed the flats alone)', () => {
  const ctx = rd('src/scenes/dungeonContext.js');
  assert.ok(ctx.includes("    drawWindowBodies: (canvas, { proj, view, eye }) => drawBodiesUnderWindow(_npcLane, foes, _npcStood, { idOf: foeId, corpseFlat: (f) => f.corpseBatch, renderer, canvas, proj, view, eye }),"));
  assert.ok(!ctx.includes('showBodyFlats'), 'the flats-only door is gone');
  for (const [file, show, draw, ret] of [
    ['src/scenes/worldModes.js', '      if (dungeonCtx.uiOverlayActive) dungeonCtx.drawWindowBodies?.(canvas, { proj, view, eye: cam.pos });', '      renderer.drawBillboards([...dungeonCtx.billboardBatches,', 'if (dungeonCtx.uiOverlayActive) { dungeonCtx.hideHudText?.();'],
    ['src/scenes/dungeon.js', '    if (ctx.uiOverlayActive) ctx.drawWindowBodies?.(canvas, { proj, view, eye: cam.pos });', '    renderer.drawBillboards([...ctx.billboardBatches,', 'ctx.hideHudText?.(); hideWorldPlaque(); ctx.tickOverlay(dt); ctx.drawOverlay(canvas);'],
  ]) {
    const s = rd(file), a = s.indexOf(show), b = s.indexOf(draw, a), c = s.indexOf(ret, b);
    assert.ok(a > 0 && b > a && b - a < 900 && !s.slice(a, b).includes('drawBillboards(') && c > b, `${file}: drawn just before the flats, ahead of the window's return`);
  }
});

// ---- BODY-DEPTH ----

const canvas = { clientWidth: 1600, clientHeight: 1000 };
const proj = perspective(Math.PI / 3, canvas.clientWidth / canvas.clientHeight, 0.05, 500);
const clip = (m, p) => { const o = [0, 1, 2, 3].map((r) => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]); return o.map((v) => v / o[3]); };

/** the picture's camera, its quad and its depth, by the lone pass or the batch's queue */
function capturing(batch) {
  const c = {};
  return {
    c,
    characterSpriteBatchOpen: batch,
    queueCharacterSprite: (it) => Object.assign(c, { op: it.proj, ov: it.view, at: it.quad.at, hw: it.quad.halfW, hh: it.quad.halfH, right: it.quad.right, up: it.quad.up, depth: it.quad.depth }),
    renderCharacterSprite: (mesh, model, op, ov) => { Object.assign(c, { op, ov }); return {}; },
    drawCharacterSpriteQuad: (tex, at, hw, hh, right, u1, v1, hitFlash, conceal, up, origin, fx, depth) => Object.assign(c, { at, hw, hh, right, up, depth }),
  };
}

const BOX = { center: [0, 0.9, 0], halfW: 0.45, halfH: 0.95, anchor: [0, 0.9, 0] };
const CORPSE = { center: [0.2, 0.25, 0.4], halfW: 1.0, halfH: 0.3, anchor: [0, 0.2, 0] };   // lying, its anchor off the box's middle
const EYES = [[0, 1.7, -3], [0, 4, -4], [5, 7, 3], [0.1, 1.1, -0.3]];   // level, raised, from the side and above, inside half a metre (the floored ray)

test('FB1015 BODY-DEPTH: a texel of the picture is written where its point stands - the quad\'s point moved along the picture\'s ray by near + d (far - near) - base lands on the world point the texel shows, for a standing body and a lying one, every eye, both doors (unfixed: every texel at the card\'s depth)', () => {
  for (const batch of [false, true]) {
    for (const box of [BOX, CORPSE]) {
      for (const eye of EYES) {
        const r = capturing(batch), c = r.c;
        const view = lookAt(eye, box.anchor ?? box.center, [0, 1, 0]);
        drawRigSpriteBox(r, canvas, null, null, box, proj, view, eye, 3);
        assert.ok(c.depth, `${eye}: a quad square to the ray says where its texels stand`);
        const mini = multiply(c.op, c.ov);
        for (const p of [[0.3, 0.1, 0.2], [-0.4, 1.6, -0.3], box.center, [0.9, 0.05, 0.6]]) {
          const [nx, ny, nz] = clip(mini, p);
          const d = nz * 0.5 + 0.5;   // the picture's window depth
          const q = [0, 1, 2].map((k) => c.at[k] + c.right[k] * c.hw * nx + c.up[k] * c.hh * ny);   // where the quad draws it
          const s = c.depth.near + d * c.depth.range - c.depth.base;
          const w = [0, 1, 2].map((k) => q[k] + c.depth.dir[k] * s);
          const err = Math.hypot(w[0] - p[0], w[1] - p[1], w[2] - p[2]);
          assert.ok(err < 1e-4, `${batch ? 'batch' : 'lone'}, eye ${eye}, point ${p}: written ${err.toFixed(6)} m from where it stands`);
        }
      }
    }
  }
});

test('FB1015 BODY-DEPTH: a card of its own vertical keeps its own depth - the travel view\'s lean and the Billboard Look\'s upright card; pictureDepth answers its planes and none for a ray of no length', () => {
  const eye = [0, 1.7, -3], view = lookAt(eye, BOX.center, [0, 1, 0]);
  const leaned = capturing(true);
  drawRigSpriteBox(leaned, canvas, null, null, { ...BOX, up: [0, 0.8, 0.6] }, proj, view, eye, 3);
  assert.equal(leaned.c.depth, null, 'the travel view\'s lean');
  setPref('mwBillboardLook', true);
  const card = capturing(false);
  drawRigSpriteBox(card, canvas, null, null, BOX, proj, view, eye, 3);
  assert.equal(card.c.depth, null, 'the Billboard Look');
  const p = pictureDepth([0, 0, -2], [0, 0, 0], [0, 0, -0.5], 4);
  assert.deepEqual(p, { dir: [0, 0, -1], near: PICTURE_NEAR, range: 8 - PICTURE_NEAR, base: 2 * 4 + 0.5 });
  assert.equal(pictureDepth([0, 0, 0], [0, 0, 0], [0, 0, 0], 4), null);
});

test('FB1015 BODY-DEPTH (by source): the sprite target\'s depth is a texture on its depth attachment; the quad binds it on unit 1 and writes every drawn fragment\'s depth - the body\'s texel, an outline\'s nearest silhouette texel, an ember the quad\'s own', () => {
  const r = rd('src/render/renderer.js');
  assert.ok(r.includes('gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT16, S, S, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);'));
  assert.ok(r.includes('gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);'));
  assert.ok(!r.includes('gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, CHAR_SPRITE_RT_SIZE, CHAR_SPRITE_RT_SIZE);'), 'no renderbuffer under the picture');
  assert.ok(r.includes('    if (dtex) { this._bindEmission(dtex); this._depthOnUnit1 = true; }'));
  assert.ok(r.includes('gl.uniform1i(c.depthTex, 1);'));
  assert.ok(r.includes('vec4 c = uProj * uView * vec4(vWorld + uDepthDir * (uDepthK.x + d * uDepthK.y - uDepthK.z), 1.0);'));
  assert.ok(r.includes('  gl_FragDepth = uDepthK.w > 0.5 ? bodyDepth(texelFetch(uDepthTex, bodyTexel(uv), 0).r) : gl_FragCoord.z;'));
  // every exit that draws writes it: the body, the glint's rim, the elite's rim, the ember
  const fs = r.slice(r.indexOf('float bodyDepth(float d)'), r.indexOf('this.charQuadProgram = this._buildProgram(vs, fs);'));
  const outs = fs.split('outColor =').length - 1, writes = fs.split('gl_FragDepth =').length - 1;
  assert.equal(outs, 4, 'four drawn exits');
  assert.equal(writes, 4, 'each writes its depth');
  assert.ok(r.includes("q.hitFlash, q.conceal, q.up, [it.tx / CHAR_SPRITE_RT_SIZE, it.ty / CHAR_SPRITE_RT_SIZE], q.fx, q.depth);"), 'the batch hands each quad its depth');
});

/** a GL that records every call (invislook.test.js's shape) - textures and units by id */
function recordingGl() {
  const calls = [];
  let ids = 0;
  const consts = { TEXTURE_2D: 3553, TEXTURE0: 33984, TEXTURE1: 33985, FRAMEBUFFER: 36160, DEPTH_ATTACHMENT: 36096, COLOR_ATTACHMENT0: 36064, VERTEX_SHADER: 35633, FRAGMENT_SHADER: 35632, ARRAY_BUFFER: 34962 };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (/^create/.test(String(k))) return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return (...args) => { calls.push([k, ...args]); };
    },
  });
  return { calls, canvas: { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 } };
}

test('FB1015 BODY-DEPTH: the quad samples the target\'s depth on unit 1, and unit 1 is let go before anything draws INTO the target again (never a feedback loop); a picture with no depth uploads none', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  const cs = r._charSpriteRT();
  const unit1 = () => { let u = null; const b = []; for (const c of calls) { if (c[0] === 'activeTexture') u = c[1]; if (c[0] === 'bindTexture' && u === 33985) b.push(c[2]); } return b; };
  calls.length = 0;
  r.drawCharacterSpriteQuad(cs.tex, [0, 0, -5], 1, 1, [1, 0, 0], 0.1, 0.1, 0, null, [0, 1, 0], [0, 0], null, { dir: [0, 0, -1], near: 0.1, range: 7.9, base: 4 });
  assert.deepEqual(unit1(), [cs.depth], 'the depth on unit 1 for the quad');
  assert.deepEqual(calls.find((c) => c[0] === 'uniform4f' && c[1] === 'uDepthK').slice(2), [0.1, 7.9, 4, 1], 'its planes, on');
  calls.length = 0;
  r._charSpriteRT();
  assert.deepEqual(unit1(), [null], 'let go before the target is drawn into');
  calls.length = 0;
  r._charSpriteRT();
  assert.deepEqual(unit1(), [], 'once - nothing to let go twice');
  calls.length = 0;
  r.drawCharacterSpriteQuad(cs.tex, [0, 0, -5], 1, 1, [1, 0, 0], 0.1, 0.1);
  assert.deepEqual(calls.find((c) => c[0] === 'uniform4f' && c[1] === 'uDepthK').slice(2), [0, 0, 0, 0], 'no depth handed: the quad\'s own');
});
