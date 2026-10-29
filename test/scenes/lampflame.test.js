// FIELD BUGS 2026-10-29b LAMP-FLAME and CANDLE-DIM (#feature-feedback, "Housing feedback & suggestions after 20 hours
// of decorating", items 15 and 10): a placed lamp's light hangs at its flame, measured off TEXTURE.210, scaled with the
// piece - DFU's offsets left the short-chain lantern's and the "todo" records' lights in the chain or the post; and a
// yard's candle burns at its own colour and intensity, as a room's does, never as the street's lantern.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decorLightLift, DECOR_LAMP_FLAME } from '../../src/scenes/decor/decorRoom.js';
import { yardLampOf, yardLampRows, YARD_LAMP } from '../../src/scenes/homeYards.js';
import { collectInteriorLights, interiorLightProperties } from '../../src/world/interior/interiorLights.js';
import { interiorLightColor, EL_LANE } from '../../src/render/enhancedLighting.js';
import { TextureFile } from '../../src/formats/textureFile.js';
import { classicBillboardSize } from '../../src/world/rmbFlats.js';
import { exteriorFrame, streetColor, same } from '../yardLightRig.mjs';
import { ARENA2, skipReal } from '../lwRealTown.mjs';

const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test('LAMP-FLAME the law: a placed lamp in DECOR_LAMP_FLAME hangs its light at its flame\'s share of its drawn height, at any scale; any other TEXTURE.210 record where the room hangs its own, its offset scaled with the piece; any other flat at its middle, a model at its origin (mutants: LAMPFLAME-table-unread, LAMPFLAME-offset-unscaled, LAMPFLAME-any-flat)', () => {
  for (const k of [1, 2.5]) {
    const size = { w: 0.45 * k, h: 1.93 * k };
    assert.ok(close(decorLightLift({ flat: [210, 26], scale: k }, size), size.h * 0.23), `the short-chain lantern at its lantern, scale ${k}`);
  }
  const one = { w: 0.45, h: 4.55 };
  const [own] = collectInteriorLights([{ archive: 210, record: 24, x: 0, y: 0, z: 0 }], () => one);
  assert.ok(close(decorLightLift({ flat: [210, 24], scale: 1 }, one), own.y), 'the long-chain lantern where DFU hangs it');
  assert.ok(close(decorLightLift({ flat: [210, 24], scale: 2 }, { w: 0.9, h: 9.1 }), own.y * 2), 'and grown, its offset grown with it');
  assert.equal(decorLightLift({ flat: [211, 26], scale: 2 }, { w: 1, h: 3 }), 1.5, 'any other flat at its middle - never a lamp\'s share');
  assert.equal(decorLightLift({ model: 41000, flat: null, scale: 1 }, null), 0, 'a model at its origin');
  assert.equal(decorLightLift({ flat: [210, 26], scale: 1 }, null), null, 'a picture not stood yet');
  const [room] = collectInteriorLights([{ archive: 210, record: 26, x: 0, y: 0, z: 0 }], () => ({ w: 0.45, h: 1.93 }));
  assert.ok(close(room.y, 1.93 / 2), 'the room\'s own lantern stays DFU\'s (AddLight has no offset for 26) - the departure is a placed piece\'s');
});

test('LAMP-FLAME the yard: a yard\'s lamp hangs where a room hangs a placed one - the lantern at its lantern, the post at its lamp (mutant: LAMPFLAME-yard-at-top)', () => {
  const size = { w: 0.45, h: 1.93 };
  assert.ok(close(yardLampOf({ id: 'l', flat: [210, 26], scale: 1 }, size).lift, size.h * 0.23));
  const post = { w: 0.53, h: 4 };
  assert.ok(close(yardLampOf({ id: 'p', flat: [210, 29], scale: 1 }, post).lift, post.h * DECOR_LAMP_FLAME[29]));
});

/** The height share of a record's flame off the art: the bright texels' mean row over every frame, from the base. */
function flameShare(t, r) {
  const pal = new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), 'ART_PAL.COL'))).slice(8);
  let sy = 0, n = 0, h = 0;
  for (let f = 0; f < t.getFrameCount(r); f++) {
    const bm = t.getDFBitmap(r, f);
    h = bm.height;
    for (let y = 0; y < bm.height; y++) for (let x = 0; x < bm.width; x++) {
      const i = bm.data[y * bm.width + x];
      if (!i) continue;
      const [R, G, B] = [pal[i * 3], pal[i * 3 + 1], pal[i * 3 + 2]];
      if (0.3 * R + 0.59 * G + 0.11 * B > 170 && R > 180) { sy += y; n++; }
    }
  }
  return n >= 50 ? 1 - (sy / n + 0.5) / h : null;
}
/** The height share of a record's widest row - an unlit lamp's body. */
function widestShare(t, r) {
  const bm = t.getDFBitmap(r, 0);
  let best = -1, at = 0;
  for (let y = 0; y < bm.height; y++) {
    let n = 0;
    for (let x = 0; x < bm.width; x++) if (bm.data[y * bm.width + x]) n++;
    if (n > best) { best = n; at = y; }
  }
  return 1 - (at + 0.5) / bm.height;
}

test('LAMP-FLAME the table is the art\'s (ARENA2): each lit record\'s share is its flame\'s, measured off every frame of TEXTURE.210; the unlit chandeliers take their lit twins\' (the same picture, row for row, but the flames) and the unlit crystal lamp its body\'s widest row; and for 26, 28 and 29 DFU\'s light stood more than a quarter of the picture off the flame', { skip: skipReal }, () => {
  const t = new TextureFile();
  t.load(new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), 'TEXTURE.210'))), 'TEXTURE.210');
  for (const r of [16, 18, 19, 26, 28, 29]) {
    const f = flameShare(t, r);
    assert.ok(f != null && Math.abs(f - DECOR_LAMP_FLAME[r]) < 0.01, `record ${r}: the flame at ${f?.toFixed(3)}, the table ${DECOR_LAMP_FLAME[r]}`);
  }
  for (const [unlit, lit] of [[7, 23], [10, 9]]) {
    assert.equal(flameShare(t, unlit), null, `${unlit} burns nothing`);
    assert.equal(t.getDFBitmap(unlit, 0).height, t.getDFBitmap(lit, 0).height);
    assert.ok(Math.abs(flameShare(t, lit) - DECOR_LAMP_FLAME[unlit]) < 0.01, `${unlit} hangs at ${lit}'s flame`);
  }
  assert.ok(Math.abs(widestShare(t, 12) - DECOR_LAMP_FLAME[12]) < 0.01, 'the crystal lamp at its body');
  for (const r of [26, 28, 29]) {
    const s = classicBillboardSize(t, r);
    const [own] = collectInteriorLights([{ archive: 210, record: r, x: 0, y: 0, z: 0 }], () => s);
    assert.ok(Math.abs(own.y / s.h - flameShare(t, r)) > 0.25, `record ${r}: DFU's light ${(own.y / s.h).toFixed(2)} of the picture, its flame ${flameShare(t, r).toFixed(2)}`);
  }
});

test('CANDLE-DIM the rows: a yard\'s candle burns at its own colour x intensity as a room uploads it on the same lane (interiorLightColor), made once a lamp and lane; a lamp post keeps the street lantern\'s colour (mutants: CANDLEDIM-street-colour, CANDLEDIM-lane-unread, CANDLEDIM-tone-every-frame)', () => {
  const candle = yardLampOf({ id: 'c', flat: [210, 21], scale: 1 }, { w: 0.3, h: 2 });
  const post = yardLampOf({ id: 'p', flat: [210, 29], scale: 1 }, { w: 0.53, h: 4 });
  const p = interiorLightProperties(21);
  assert.equal(candle.light.candle, true);
  assert.equal(post.light.candle, undefined);
  const street = new Float32Array([0.9, 0.5, 0.2]);
  const ranges = new Float32Array(64).fill(18);
  const lamps = [{ x: 0, y: 1, z: 0, ...candle.light }, { x: 4, y: 3, z: 0, ...post.light }];
  for (const on of [false, true]) {
    const rows = [];
    const first = yardLampRows(lamps, rows, ranges, street, [], on);
    assert.deepEqual([...first[0].color].map((v) => Math.round(v * 1e6)), interiorLightColor(on, p.color, p.intensity).map((v) => Math.round(v * 1e6)), `lane ${on}: the room's candle`);
    assert.equal(first[1].color, street, 'the post: the street\'s');
    const tone = first[0].color;
    const again = yardLampRows(lamps, rows, ranges, street, [], on);
    assert.equal(again[0].color, tone, 'the same tone the next frame');
  }
  const classic = yardLampRows(lamps, [], ranges, street, [], false)[0].color;
  const lane = yardLampRows(lamps, [], ranges, street, [], true)[0].color;
  assert.notDeepEqual([...classic], [...lane], 'the lane asked');
  assert.ok(Math.max(...interiorLightColor(true, p.color, p.intensity)) < Math.max(...YARD_LAMP.color), 'dimmer than the lantern it burned as');
});

test('CANDLE-DIM the world host: by night a yard\'s candle reaches the renderer at the room\'s colour on both lanes, and a lamp post at the street\'s (mutant: CANDLEDIM-host-lane)', () => {
  const ranges = new Float32Array(64).fill(18);
  const candle = yardLampOf({ id: 'c', flat: [210, 21], scale: 1 }, { w: 0.3, h: 2 }).light;
  const post = yardLampOf({ id: 'p', flat: [210, 29], scale: 1 }, { w: 0.53, h: 4 }).light;
  const p = interiorLightProperties(21);
  for (const lane of [false, true]) {
    const lit = exteriorFrame({ lane, night: true, town: [], lamps: [{ x: 1, y: 1.6, z: 0, ...candle }, { x: 3, y: 3.4, z: 0, ...post }], eye: [0, 1.7, 0], ranges });
    const c = lit.find((l) => same(l.at, [1, 1.6, 0]));
    const q = lit.find((l) => same(l.at, [3, 3.4, 0]));
    const room = new Float32Array(interiorLightColor(lane, p.color, p.intensity));
    const want = lane ? [...EL_LANE.decode3(room, new Float32Array(3))] : [...room];
    assert.ok(c && same(c.color, want), `lane ${lane}: the candle ${c?.color} at the room's ${want}`);
    assert.ok(q && same(q.color, streetColor(lane)), `lane ${lane}: the post at the street's`);
  }
});
