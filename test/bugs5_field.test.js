// THE FIELD'S FIVE (2026-09-17, Mac's bug list): F2 things on the ground
// cast no standing card, F3 the light in the hand casts nothing and a
// surface the previous frame did not see is not marched, F4 the glare's
// band is a quarter unit, F5 the far cascade skips its small casters and
// the contact march stops at seven tenths of a range. F1 (the thrust) is
// pinned beside the widget's own pins (ww1_weaponwidget.test.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SHADOW_CASTER_MIN_DISTANCE, SHADOW_NO_CAST_ARCHIVES, SHADOW_FLAT_MIN_HEIGHT, SHADOW_CASCADE_MIN_RADIUS_TEXELS, SHADOW_LIGHT_FLATS,
  pickShadowCasters, sunTexelWorld, SHADOW_CASCADES,
} from '../src/render/shadowPass.js';
import { AIR_GLARE_SLACK, AIR_GLARE_MIN_DISTANCE, AIR_CONTACT_STEPS, AIR_CONTACT_RANGE_FRACTION } from '../src/render/airPass.js';
import { EL_LANE } from '../src/render/enhancedLighting.js';
import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

function recordingGl() {
  const calls = [];
  let ids = 0;
  const consts = { TEXTURE0: 1000, DEPTH_BUFFER_BIT: 256, COLOR_BUFFER_BIT: 16384, DEPTH_ATTACHMENT: 36096, TRIANGLES: 4 };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray'
        || k === 'createTexture' || k === 'createFramebuffer' || k === 'createRenderbuffer' || k === 'createQuery') return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (k === 'getExtension') return () => null;
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return (...args) => { calls.push([k, ...args.map((a) => (ArrayBuffer.isView(a) ? Float32Array.from(a) : a))]); };
    },
  });
  const canvas = { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 };
  return { gl, calls, canvas };
}
/** A one-triangle mesh of the given radius about the origin, with real bounds. */
const tri = (radius) => ({
  positions: new Float32Array([-radius, 0, 0, radius, 0, 0, 0, radius, 0]), normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
  uvs: new Float32Array([0, 0, 1, 0, 0, 1]), indices: new Uint32Array([0, 1, 2]),
  subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 1 }],
});
function rig() {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE);
  for (const k of ['1_1', '5_1', '216_1', '9_1']) r.textures.set(k, { id: `t${k}` });
  return { r, calls, sp: r.shadows };
}

test('F2/F3/F4/F5: the constants - the hand\'s distance, the archives and height that cast nothing, the far cascade\'s texel rule, the glare\'s band, the march\'s steps and share', () => {
  assert.equal(SHADOW_CASTER_MIN_DISTANCE, 1.5, 'F3: the light in the hand (0.8 from the eye) takes no caster slot');
  assert.equal(SHADOW_CASTER_MIN_DISTANCE, AIR_GLARE_MIN_DISTANCE, 'one hand distance for the glare and the shadows');
  assert.ok(SHADOW_NO_CAST_ARCHIVES.has(216) && SHADOW_NO_CAST_ARCHIVES.size === 1, 'F2: the treasure archive');
  assert.ok(!SHADOW_NO_CAST_ARCHIVES.has(SHADOW_LIGHT_FLATS), 'the flame flats have their own law (EL6: never from a lantern, still from the sun)');
  assert.equal(SHADOW_FLAT_MIN_HEIGHT, 0.5);
  assert.equal(SHADOW_CASCADE_MIN_RADIUS_TEXELS, 2);
  assert.ok(Math.abs(SHADOW_CASCADE_MIN_RADIUS_TEXELS * sunTexelWorld(2) - 0.46875) < 1e-9, 'the far cascade skips a caster under 47 cm');
  assert.ok(SHADOW_CASCADE_MIN_RADIUS_TEXELS * sunTexelWorld(0) < 0.03, 'the near one skips nothing a player could see');
  assert.equal(AIR_GLARE_SLACK, 0.25, 'F4: a quarter unit');
  assert.equal(AIR_CONTACT_STEPS, 4); assert.equal(AIR_CONTACT_RANGE_FRACTION, 0.7);
  // F3: the picker
  const eye = [0, 1.7, 0];
  const hand = [0.34, 1.0, -0.25, 6];   // Handheld Torches' flame: left, below, ahead - 0.8 away
  const lantern = [3, 2, 0, 10];
  assert.deepEqual(pickShadowCasters(new Float32Array([...hand, ...lantern]), eye), [1], 'the hand\'s light is passed over, the lantern takes the slot');
  assert.deepEqual(pickShadowCasters(new Float32Array([...hand, ...lantern]), eye, 6, 0.25), [0, 1], 'at the old quarter unit it was the nearest caster of all');
  assert.deepEqual(pickShadowCasters(new Float32Array([1.6, 1.7, 0, 8]), eye), [0], 'a lantern you stand beside, a unit and a half off, still casts');
  assert.match(rd('src/systems/handheldTorches.js'), /torch: \{ left: 0\.34, up: 0\.9, forward: 0\.25 \}/, 'the offset the law was measured against');
  assert.match(rd('src/scenes/droppedLoot.js'), /pile\.batch\.noShadow = true;/); assert.match(rd('src/scenes/droppedLoot.js'), /p\.batch\.noShadow = true;/);
});

test('F2: on the fake GL - a loot pile, a marked batch and a short flat are not replayed into a lantern\'s map; a standing flat is (mutant: any of the three tests dropped)', () => {
  const draws = (batches) => {
    const { r, sp } = rig();
    r.setLighting(new Float32Array([0.1, 0.1, 0.1]), 0, new Float32Array([1, 1, 1]));   // no sun: the cube map
    r.setPointLights(new Float32Array([3, 1, 0, 10]), new Float32Array([1, 1, 1]));
    const frame = () => { r.beginFrame(I, I, new Float32Array([0, 1, 0]), WORLD_FRAME); r.drawBillboards(batches, new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0])); r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 }); };
    frame(); frame();
    return sp.stats.pointDraws;
  };
  const mk = (r, archive, size, extra = {}) => Object.assign(r.createBillboardBatch(archive, 1, size, [[0, size.h / 2, -3]]), extra);
  const { r } = rig();
  const standing = mk(r, 5, { w: 1, h: 2 });
  const one = draws([standing]);
  assert.ok(one > 0, 'a standing flat casts into the lantern\'s faces');
  assert.equal(draws([standing, mk(r, 216, { w: 1, h: 2 })]), one, 'F2: a loot pile (archive 216) adds nothing');
  assert.equal(draws([standing, mk(r, 5, { w: 1, h: 2 }, { noShadow: true })]), one, 'F2: a batch its host marked adds nothing');
  assert.equal(draws([standing, mk(r, 5, { w: 1, h: 0.3 })]), one, 'F2: a flat under half a unit tall adds nothing');
  assert.ok(draws([standing, mk(r, 9, { w: 1, h: 2 })]) > one, 'a second standing flat draws');
});

test('F5: on the fake GL - the far cascade skips a caster under two of its texels, the near and mid ones take it; a big one is in all three (mutant: the cull dropped, or applied to every cascade)', () => {
  const sunDraws = (radius) => {
    const { r, sp } = rig();
    r.setLighting(new Float32Array([0.5, 0.5, 0.5]), 0.9, new Float32Array([1, 1, 1]));
    const mesh = r.createMesh(tri(radius));
    const frame = () => { r.beginFrame(I, I, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME); r.drawMesh(mesh, I, null); r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 }); };
    frame(); frame();   // the second frame replays; its far cascade is drawn (never drawn before)
    assert.equal(sp.kind, 'sun'); assert.equal(sp.stats.cascadesDrawn, 3);
    return sp.stats.sunDraws;
  };
  assert.equal(sunDraws(2), 3, 'a two-unit caster: one replay per cascade');
  assert.equal(sunDraws(0.1), 2, 'a ten-centimetre caster: the near and mid cascades alone');
  assert.equal(SHADOW_CASCADES.length, 3);
  // and a flat by its batch bounds (mutant: the batch cull dropped)
  const flatDraws = (size) => {
    const { r, sp } = rig();
    r.setLighting(new Float32Array([0.5, 0.5, 0.5]), 0.9, new Float32Array([1, 1, 1]));
    const b = r.createBillboardBatch(5, 1, size, [[0, size.h / 2, -3]]);
    const frame = () => { r.beginFrame(I, I, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME); r.drawBillboards([b], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0])); r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 }); };
    frame(); frame();
    assert.equal(sp.stats.cascadesDrawn, 3);
    return sp.stats.sunDraws;
  };
  // WEEDS1 (2026-09-19) TOOK THIS CASE OVER, and the record says so rather
  // than leaving a pin that passes for a reason it no longer holds. F5's
  // sphere test used to cull this flat from the far cascade; the SPRITE
  // test culls it now, and it culls strictly more (a flat's radius is
  // hypot(w, h) / 2, so F5 could only ever fire where the height test
  // already had). F5's batch line is gone and this is its law's new home -
  // the mesh case above is where F5 itself is still proved.
  assert.equal(flatDraws({ w: 2, h: 2 }), 3, 'a two-unit flat: every cascade');
  assert.equal(flatDraws({ w: 0.6, h: 0.6 }), 2, 'a flat 0.6 tall, under the far cascade\'s 0.94: the near and mid alone (WEEDS1)');
  assert.equal(flatDraws({ w: 3, h: 0.6 }), 2, 'and a WIDE short one too - its sphere clears F5 easily, which is the case F5 could never catch');
});
