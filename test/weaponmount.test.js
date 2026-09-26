// WEAPON-MOUNT (2026-09-26, Mac: "weapons dont show in houses properly"): DECOR2c hangs a weapon or a shield on the
// decal pass as its pack picture, under a white tint - and the decal pass is the BLOOD's. Both of its programs read
// the texel's red as a film's thickness and paint the tint through it (BLOOD3), so a hung sword came out a pale lit
// silhouette of itself: the picture's colours thrown away. A mount is a PICTURE now - the pass's own program with its
// switch on (`uPicture`): the texel is the colour, flat, no film, no relief. The real-GL proof is
// tools/bloodProbe.mjs's WEAPON-MOUNT rows (a green picture comes back green on both sets; drawn as a mark, white).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDecorRoom } from '../src/scenes/decorRoom.js';
import { settle } from './decorFakes.mjs';
import { Renderer } from '../src/render/renderer.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('WEAPON-MOUNT: the room draws its mounts as PICTURES - drawDecalPicture, never the blood\'s drawDecals where the picture door stands', async () => {
  const calls = [];
  const textures = new Map();
  const tex = { recordCount: 40, getSize: () => ({ width: 16, height: 48 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 1 };
  const pool = createDecorRoom({
    meshes: { getGpuMesh: async () => null, cpuModels: new Map() },
    renderer: {
      textures,
      createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, drawMesh: () => {},
      createDecalBatch: () => ({ id: 'mount' }), writeDecalSlot: () => true, destroyDecalBatch: () => {},
      drawDecals: (b, t) => calls.push(['film', b.id, t]),
      drawDecalPicture: (b, t) => calls.push(['picture', b.id, t]),
    },
    getTexture: async () => tex,
    uploadRecord: (a, r) => { textures.set(`${a}_${r}#ui`, `tex:${a}.${r}`); return '#ui'; },
    collider: () => null, origin: () => [0, 0, 0], roomLights: () => [],
  });
  pool.put({ id: 'm1', model: null, flat: [234, 12], item: { t: 120, g: 3, m: 7, v: null, a: null, p: null }, pos: [0, 1, 0], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0 });
  await settle();
  assert.equal(pool.drawMounts(), 1);
  assert.deepEqual(calls, [['picture', 'mount', 'tex:234.12']], 'a picture, not a film');
});

test('WEAPON-MOUNT: the renderer\'s picture door is the decal pass with its switch on for that one draw', () => {
  const seen = [];
  const fake = { _decalPicture: false, drawDecals(b, t) { seen.push([b, t, this._decalPicture]); } };
  Renderer.prototype.drawDecalPicture.call(fake, 'batch', 'tex');
  assert.deepEqual(seen, [['batch', 'tex', true]], 'on for the draw');
  assert.equal(fake._decalPicture, false, 'and off after it - a blood mark drawn next is a film');
  const thrower = { _decalPicture: false, drawDecals() { throw new Error('lost context'); } };
  assert.throws(() => Renderer.prototype.drawDecalPicture.call(thrower, 'b', 't'));
  assert.equal(thrower._decalPicture, false, 'off again even when the draw throws');
  const r = rd('src/render/renderer.js');
  const fn = r.slice(r.indexOf('  drawDecals(batch, tex, ranges = null) {'), r.indexOf('\n  }\n', r.indexOf('  drawDecals(batch, tex, ranges = null) {')));
  assert.match(fn, /gl\.uniform1f\(d\.picture, this\._decalPicture \? 1 : 0\);/, 'every decal draw says which it is');
  assert.match(r, /picture: gl\.getUniformLocation\(P, 'uPicture'\),/, 'on whichever decal program is installed');
});

test('WEAPON-MOUNT: both decal programs draw a picture\'s texel as its colour - the classic straight, the lane decoded and flat - and a mark is untouched', () => {
  const r = rd('src/render/renderer.js');
  const classic = r.slice(r.indexOf('const DECAL_FS = `'), r.indexOf('`;', r.indexOf('const DECAL_FS = `')));
  assert.match(classic, /uniform float uPicture;/);
  assert.match(classic, /if \(uPicture > 0\.5\) rgb = t\.rgb \* vColor\.rgb \* lightAcc;/, 'the texel is the colour');
  assert.ok(classic.indexOf('if (uPicture > 0.5) rgb') > classic.indexOf('vec3 rgb = vColor.rgb * exp('), 'after the film, overriding it for a picture alone');
  const el = rd('src/render/enhancedLighting.js');
  const lane = el.slice(el.indexOf('export const EL_DECAL_FS = `'), el.indexOf('`;', el.indexOf('export const EL_DECAL_FS = `')));
  assert.match(lane, /uniform float uPicture;/);
  assert.match(lane, /if \(uPicture > 0\.5\) \{ albedo = elDecode\(t\.rgb \* vColor\.rgb\); thick = 0\.0; \}/, 'the texel decoded as every lane texel is, and no film');
  assert.match(lane, /if \(uPicture > 0\.5\) duv = vec2\(0\.0\);/, 'and no relief off its red channel');
  assert.ok(lane.indexOf('if (uPicture > 0.5) duv') < lane.indexOf('if (dot(c, c) > 1e-12 && abs(uvDet)'), 'before the meniscus reads it');
});

test('WEAPON-MOUNT: the placement ghost is the picture it will hang as, and only the decorator\'s mounts take the door', () => {
  assert.match(rd('src/scenes/decorTool.js'), /\(r\?\.drawDecalPicture \?\? r\?\.drawDecals\)\?\.call\(r, p\.decal, p\.art\.tex\);/);
  assert.match(rd('src/scenes/decorRoom.js'), /\(r\?\.drawDecalPicture \?\? r\?\.drawDecals\)\?\.call\(r, e\.mount\.batch, e\.mount\.tex\);/);
  for (const f of ['src/combat/bloodMarks.js', 'src/combat/bloodDecals.js']) {
    assert.doesNotMatch(rd(f), /drawDecalPicture/, `${f}: a blood mark is a film`);
  }
});
