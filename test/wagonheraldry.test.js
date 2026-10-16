// WAGON-EMBLEM (2026-10-16, Mac: "a guild master's emblem painted on the sides of their open wagon"; then, of the
// result: "Can we make it only show on the second iteration?") - THE READER'S GUILD ARMS ON THE OPEN WAGON'S OUTER
// SIDE - `src/world/wagonEmblem.js`, worn by `src/world/wagonArt.js`'s `emblemmedSide` and read over the tests' stand-in
// ARENA2 (`test/classicArtFake.mjs`).
//
// WHAT IS PINNED HERE, AND WHY IT IS NOT A PICTURE OF A SHIELD. The arms are drawn by `ui/heraldryArt.js` into a
// Canvas2D context, and node has no Path2D and no canvas at all - so the drawing itself is the BROWSER'S work, held
// by heraldryArt's own suite and not restated here. What this suite holds is the BRIDGE, the GEOMETRY and the ONE
// EMBLEM: which cell of the side's picture carries the arms, that it is the SECOND cell and only that one, that the
// cell boundaries still fall on the metres the livery's repeat always fell on, that the cloth in every cell is the
// same bytes it was before, that the arms stand at the same place on both sides of one wagon, and that a runtime with
// no canvas loses the emblem WITHOUT losing the wagon. The canvas stand-in below rasterises each path as its own
// BOUNDING BOX, so a colour lands where the real path's extent is and the pins can ask whether the FIELD's, the
// BORDER's and the DEVICE's colours each reached the pixels - the box is a box, and the silhouette inside it is the
// browser's, and is not what these pins are about.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  TEX, WAGON_ARCHIVE, WAGON_TILE, WAGON_SOURCES, wagonLookSources, LOOK_RECORDS, BANDS, SIDE_Y0, SIDE_Y1, SIDE_TILE_M,
  SIDE_CELLS, sideBandU, lookRecord, emblemmedSide,
} from '../src/world/wagonArt.js';
import { COMPOSE, classicPictures, resample, opaque, composedPicture } from '../src/world/classicArt.js';
import {
  WAGON_EMBLEM_ARMS, EMBLEM_M, EMBLEM_CELL, setWagonHeraldry, wagonHeraldry, emblemRect, stampRgba,
} from '../src/world/wagonEmblem.js';
import { heraldryOf, heraldryColourOf, heraldryInk } from '../src/net/heraldryLaw.js';
import { wagonGeometry, wagonFaceSkin } from '../src/world/wagonModels.js';
import { fakeClassicRgba, texelOf } from './classicArtFake.mjs';

const bakeOf = (kind) => JSON.parse(readFileSync(new URL(`../src/assets/wagons/${kind}.json`, import.meta.url), 'utf8'));
const CLOTH = texelOf(50, 7);                       // Daggerfall's sailcloth (classicArt.js DF.sailcloth), flat in the fake
const rgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
/** THE THREE COLOURS ui/heraldryArt.js draws a heraldry in: its field, its border, and its device's own ink. */
const armsColours = (h) => [heraldryColourOf(h.field).hex, heraldryColourOf(h.border).hex, heraldryColourOf(heraldryInk(h)).hex].map(rgb);
const asHex = (h) => [heraldryColourOf(h.field).hex, heraldryColourOf(h.border).hex, heraldryColourOf(heraldryInk(h)).hex];
/** A heraldry of three colours of its own, so "the device's colour is on the cloth" is not the border's by accident. */
const THREE_COLOURS = Object.freeze({ field: 'argent', border: 'sable', device: 'dragon', charge: 'teal' });
const sidePicture = async () => (await classicPictures({ [TEX.openSide]: emblemmedSide([50, 7], undefined) }, fakeClassicRgba()))[0][1];
/** The cell of `pic` the arms are on, as that cell's rectangle - the real one, read off the picture itself. */
const rectIn = (pic, cell) => emblemRect(pic, SIDE_TILE_M, SIDE_Y1 - SIDE_Y0, EMBLEM_M, cell, COMPOSE);
/** The metres along the side a texel column of the picture stands at. */
const zOf = (pic, x) => ((x + 0.5) / pic.width) * WAGON_TILE.openSide[0];

// ── A CANVAS, OF SORTS ─────────────────────────────────────────────────────────────────────────────────────────────
// A 2D context that keeps the canvas API's six-number transform and paints each path as its own bounding box.
class FakePath2D { constructor(d = '') { this.d = d; } }
function fakeCanvasClass() {
  return class {
    constructor(w, h) { this.width = w; this.height = h; this._px = new Uint8ClampedArray(w * h * 4); }
    getContext(kind) {
      if (kind !== '2d') return null;
      const W = this.width, H = this.height, px = this._px;
      const t = { a: 1, d: 1, e: 0, f: 0 };
      const stack = [];
      /** A path's numbers read as the box they bound - a path is a list of numbers, and a box is all this draws. */
      const box = (path) => {
        const n = (String(path?.d ?? '').match(/-?\d*\.?\d+/g) ?? []).map(Number);
        const xs = [], ys = [];
        for (let i = 0; i + 1 < n.length; i += 2) { xs.push(n[i]); ys.push(n[i + 1]); }
        return xs.length ? [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] : null;
      };
      const dev = (b) => [b[0] * t.a + t.e, b[1] * t.d + t.f, b[2] * t.a + t.e, b[3] * t.d + t.f];
      const read = ([x0, y0, x1, y1]) => {
        const out = new Uint8ClampedArray(W * H * 4);
        for (let y = Math.max(0, Math.floor(y0)); y < Math.min(H, Math.ceil(y1)); y++)
          for (let x = Math.max(0, Math.floor(x0)); x < Math.min(W, Math.ceil(x1)); x++) {
            const i = (y * W + x) * 4;
            for (let k = 0; k < 4; k++) out[i + k] = px[i + k];
          }
        return out;
      };
      const write = ([x0, y0, x1, y1], from) => {
        for (let y = Math.max(0, Math.floor(y0)); y < Math.min(H, Math.ceil(y1)); y++)
          for (let x = Math.max(0, Math.floor(x0)); x < Math.min(W, Math.ceil(x1)); x++) {
            const i = (y * W + x) * 4;
            for (let k = 0; k < 4; k++) px[i + k] = from[i + k];
          }
      };
      const paint = (b, [r, g, bl]) => {
        const [x0, y0, x1, y1] = dev(b);
        for (let y = Math.max(0, Math.floor(y0)); y < Math.min(H, Math.ceil(y1)); y++)
          for (let x = Math.max(0, Math.floor(x0)); x < Math.min(W, Math.ceil(x1)); x++) {
            const i = (y * W + x) * 4;
            px[i] = r; px[i + 1] = g; px[i + 2] = bl; px[i + 3] = 255;
          }
      };
      const ctx = {
        fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter',
        setTransform(a, _b, _c, d, e, f) { Object.assign(t, { a, d, e, f }); },
        save() { stack.push({ ...t }); },
        restore() { Object.assign(t, stack.pop() ?? { a: 1, d: 1, e: 0, f: 0 }); },
        translate(x, y) { t.e += t.a * x; t.f += t.d * y; },
        scale(x, y) { t.a *= x; t.d *= y; },
        clearRect() {}, clip() {},
        fill(path) { const b = box(path); if (b) paint(b, rgb(ctx.fillStyle)); },
        stroke(path) {
          const b = box(path); if (!b) return;
          const w = Math.max(0.5, (ctx.lineWidth * Math.abs(t.a)) / 2), iw = w / t.a, ih = w / t.d;
          const keep = read(dev([b[0] + iw, b[1] + ih, b[2] - iw, b[3] - ih]));   // a stroke is the ring, not the plate
          paint(b, rgb(ctx.strokeStyle));
          write(dev([b[0] + iw, b[1] + ih, b[2] - iw, b[3] - ih]), keep);
        },
        getImageData(sx, sy, sw, sh) {
          const out = new Uint8ClampedArray(sw * sh * 4);
          for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
            const i = ((sy + y) * W + (sx + x)) * 4, o = (y * sw + x) * 4;
            for (let k = 0; k < 4; k++) out[o + k] = px[i + k];
          }
          return { width: sw, height: sh, data: out };
        },
      };
      return ctx;
    }
  };
}
/** Path2D and a canvas, stood up for the length of `fn` (awaited, so the promise inside them is inside them too). */
async function withCanvas(fn) {
  const hadPath = 'Path2D' in globalThis, hadCanvas = 'OffscreenCanvas' in globalThis;
  const wasPath = globalThis.Path2D, wasCanvas = globalThis.OffscreenCanvas;
  globalThis.Path2D = FakePath2D;
  globalThis.OffscreenCanvas = fakeCanvasClass();
  try { return await fn(); } finally {
    if (hadPath) globalThis.Path2D = wasPath; else delete globalThis.Path2D;
    if (hadCanvas) globalThis.OffscreenCanvas = wasCanvas; else delete globalThis.OffscreenCanvas;
  }
}
const at = (pic, x, y) => { const i = (y * pic.width + x) * 4; return [...pic.data.slice(i, i + 4)]; };
/** Every distinct colour in a box, as `r,g,b`. */
const coloursIn = (pic, x0, y0, w, h) => {
  const out = new Set();
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const [r, g, b] = at(pic, x, y); out.add(`${r},${g},${b}`); }
  return out;
};
/** The BARE sailcloth, as one cell's worth: what every cell of the side's picture is, off the arms. */
const bareCell = async () => resample(opaque(await fakeClassicRgba()(50, 7, 0)), COMPOSE, COMPOSE);
/** How many texels of cell `k` of `pic` are not the bare cloth, and which they are. */
const bareDiff = (pic, cell, bare) => {
  const out = [];
  for (let y = 0; y < pic.height; y++) for (let x = 0; x < COMPOSE; x++) {
    const a = (y * pic.width + cell * COMPOSE + x) * 4, b = (y * COMPOSE + x) * 4;
    if (!pic.data.subarray(a, a + 4).every((v, i) => v === bare.data[b + i])) out.push([cell * COMPOSE + x, y]);
  }
  return out;
};

// ── THE PINS ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('WAGON-EMBLEM THE SIDE, OFF THE BAKE, AND WHERE THE SECOND ITERATION IS: the faces that wear the arms are the open wagon\'s two long outer walls alone - their v the whole 2.12 m band - and their picture is four cells wide with the face\'s u running ONCE over all four, so the cell boundaries fall at 1.3 m, 2.6 m and 3.9 m: the same metres the livery\'s 1.3 m repeat always fell on, which is what makes the SECOND cell the second iteration (mutants: the picture not four cells wide, the tile not four of them, the u repeating, a cell boundary a tile out)', () => {
  const g = wagonGeometry(bakeOf('openWagon')).statics;
  const tris = [];
  g.subMeshes.forEach((sm, k) => {
    for (let t = sm.startIndex; t < sm.startIndex + sm.primitiveCount * 3; t += 3) {
      const ids = [0, 1, 2].map((j) => g.indices[t + j]);
      tris.push({ rec: g.slots[k].record, uv: ids.map((i) => [g.uvs[i * 2], g.uvs[i * 2 + 1]]), p: ids.map((i) => [g.positions[i * 3], g.positions[i * 3 + 1], g.positions[i * 3 + 2]]) });
    }
  });
  const side = tris.filter((t) => t.rec === TEX.openSide);
  assert.equal(side.length, 4, 'the side is four triangles - two walls');
  const v = side.flatMap((t) => t.uv.map((c) => c[1]));
  assert.ok(Math.min(...v) < 0.01 && Math.max(...v) > 0.99, `the band's v the whole picture (${Math.min(...v).toFixed(3)}..${Math.max(...v).toFixed(3)})`);
  assert.deepEqual([SIDE_Y0, SIDE_Y1], [0.94, 3.06], 'the band 2.12 m of it');

  // the picture is four cells wide and the tile is four of them: the u runs ONCE over the lot
  assert.deepEqual([SIDE_CELLS, SIDE_TILE_M], [4, 1.3], 'four cells of the livery\'s own 1.3 m');
  assert.deepEqual(WAGON_TILE.openSide, [SIDE_CELLS * SIDE_TILE_M, 0], 'so the tile spans all four cells');
  assert.deepEqual(WAGON_SOURCES[TEX.openSide].repeat, SIDE_CELLS, 'and the picture really holds four');
  const U = WAGON_TILE.openSide[0];
  for (let k = 1; k < SIDE_CELLS; k++) {
    assert.ok(Math.abs((k / SIDE_CELLS) * U - k * SIDE_TILE_M) < 1e-9, `cell ${k} starts at z ${(k * SIDE_TILE_M).toFixed(1)} m - the livery's own tile boundary`);
  }
  // the walls read one picture ONCE: u spans under one whole period on both
  for (const nx of [1, -1]) {
    const us = side.filter((t) => Math.sign(t.n?.[0] ?? nx) === nx || t.rec === TEX.openSide).flatMap((t) => t.uv.map((c) => c[0]));
    const zs = side.flatMap((t) => t.p.map((c) => c[2]));
    assert.ok(Math.min(...zs) < -0.5 && Math.max(...zs) > 5, `the wall runs z ${Math.min(...zs).toFixed(2)} to ${Math.max(...zs).toFixed(2)}`);
    assert.ok(Math.max(...us) < 1, `u under one period (${Math.max(...us).toFixed(4)}) - no repeat to carry a second emblem`);
  }
});

test('WAGON-EMBLEM ONE EMBLEM, IN THE SECOND ITERATION AND NOWHERE ELSE: the side\'s picture is four cells and EXACTLY ONE of them carries the arms - the second - while the first, the third and the cut fourth are the bare sailcloth, byte for byte, and the arms\' own colour is in the second and in no other (mutants: the repeat left in, the emblem on the first or the third, the arms on two cells, the emblem a tile out of place)', async () => {
  setWagonHeraldry(THREE_COLOURS);
  try {
    const [field, border, ink] = armsColours(heraldryOf(THREE_COLOURS));
    const pic = await withCanvas(sidePicture);
    assert.deepEqual([pic.width, pic.height], [COMPOSE * SIDE_CELLS, COMPOSE], 'four cells of COMPOSE across');
    const bare = await bareCell();
    assert.equal(EMBLEM_CELL, 1, 'the SECOND cell - the operator\'s word');

    // the arms, and only the arms, are on the second cell
    const painted = [...Array(SIDE_CELLS).keys()].map((k) => bareDiff(pic, k, bare).length);
    assert.equal(painted[EMBLEM_CELL] > 0, true, `the second cell carries them (${painted[EMBLEM_CELL]} texels)`);
    for (const k of [0, 2, 3]) {
      assert.equal(painted[k], 0, `cell ${k} is bare cloth, not a copy of cell ${EMBLEM_CELL} (${painted[k]} texels differ)`);
      const cell = [];
      for (let y = 0; y < COMPOSE; y++) cell.push([...pic.data.slice((y * pic.width + k * COMPOSE) * 4, (y * pic.width + k * COMPOSE) * 4 + COMPOSE * 4)]);
      assert.deepEqual(cell[0], [...bare.data.slice(0, COMPOSE * 4)], `cell ${k}'s first row the bare cloth`);
    }
    // the arms' colours are in the second cell alone
    for (const k of [0, 2, 3]) {
      const cell = [];
      for (let y = 0; y < COMPOSE; y++) cell.push([...pic.data.slice((y * pic.width + k * COMPOSE) * 4, (y * pic.width + k * COMPOSE) * 4 + COMPOSE * 4)]);
      const cols = new Set();
      for (const row of cell) for (let x = 0; x < COMPOSE; x += 4) cols.add(`${row[x * 4]},${row[x * 4 + 1]},${row[x * 4 + 2]}`);
      for (const [what, c] of [['the field', field], ['the border', border], ['the device', ink]])
        assert.ok(!cols.has(c.join(',')), `${what} ${c} is NOT on cell ${k}`);
    }
    const r = rectIn(pic, EMBLEM_CELL);
    const inner = coloursIn(pic, r.x0, r.y0, r.w, r.h);
    for (const [what, c] of [['the field', field], ['the border', border], ['the device', ink]])
      assert.ok(inner.has(c.join(',')), `${what} ${c} is on the cloth (inside the emblem: ${[...inner].join(' / ')})`);
    assert.equal(new Set(asHex(heraldryOf(THREE_COLOURS))).size, 3, 'three colours of its own, so each name means something');
    for (const c of armsColours(heraldryOf(WAGON_EMBLEM_ARMS)))
      assert.ok(!inner.has(c.join(',')), `${c} is not the default's - this guild's arms, not the throne's`);

    // AND IT STANDS WHERE THE SECOND REPEAT STOOD: inside the second iteration's own metres, 1.3 to 2.6 m
    const z0 = zOf(pic, r.x0), z1 = zOf(pic, r.x0 + r.w - 1);
    assert.ok(z0 >= SIDE_TILE_M && z1 <= 2 * SIDE_TILE_M, `the arms are the second iteration: z ${z0.toFixed(3)}..${z1.toFixed(3)} m`);
    assert.ok(z1 > z0, 'and they have width on the wagon');
    assert.equal(r.x0 >= EMBLEM_CELL * COMPOSE && r.x0 + r.w <= (EMBLEM_CELL + 1) * COMPOSE, true, 'wholly inside the second cell');
    // nothing is a hole, and the corner the livery layout reads from is still the cloth it was read from
    assert.deepEqual(at(pic, 0, 0), [...CLOTH, 255], 'texel (0,0) still the sailcloth test/wagons1.test.js reads');
    for (let i = 3; i < pic.data.length; i += 4) assert.equal(pic.data[i], 255, `texel ${i / 4} whole, as every wagon texel is`);
  } finally { setWagonHeraldry(null); }
});

test('WAGON-EMBLEM THE REPEAT IS GONE, AND THE CLOTH IS THE CLOTH IT WAS: a picture of ONE cell would be a different picture - so the repeat really is suppressed - and every cell of the four is the bare 256-square sailcloth NEAREST, at the same 1.3 m a cell and the same 2.12 m a height as the tile that used to repeat (mutants: the tile stretched over the whole side with no repeat in the picture, a cell resized, the cloth resampled a different way)', async () => {
  setWagonHeraldry(THREE_COLOURS);
  try {
    const pic = await withCanvas(sidePicture);
    const bare = await bareCell();
    // the FIRST cell is exactly what one unrepeated cell of this body is - the cloth the livery has always worn
    const single = await composedPicture({ body: [50, 7], size: [COMPOSE, COMPOSE] }, fakeClassicRgba());
    assert.deepEqual([single.width, single.height], [COMPOSE, COMPOSE], 'the unrepeated picture is one cell');
    for (let y = 0; y < COMPOSE; y++)
      assert.deepEqual([...pic.data.slice((y * pic.width) * 4, (y * pic.width + COMPOSE) * 4)], [...single.data.slice(y * COMPOSE * 4, (y + 1) * COMPOSE * 4)], `cell 0 row ${y}: the same cell the repeating picture wore`);
    // the arms are NOT in it, which is the whole of what the operator asked for
    assert.equal(bareDiff(pic, 0, bare).length, 0, 'the first cell carries no arms');
    // the four cells are the same cell: the bare three are, byte for byte, and the fourth with the arms on it
    for (let y = 0; y < COMPOSE; y++) {
      const rowBare = [...bare.data.slice(y * COMPOSE * 4, (y + 1) * COMPOSE * 4)];
      for (const k of [0, 2, 3]) assert.deepEqual([...pic.data.slice((y * pic.width + k * COMPOSE) * 4, (y * pic.width + k * COMPOSE) * 4 + COMPOSE * 4)], rowBare, `cell ${k} row ${y}: the bare cloth`);
    }
    // the ON-WAGON scale of a cell is the tile that always was - 1.3 m of u, 2.12 m of v, the same 256 texels each
    const U = WAGON_TILE.openSide[0];
    assert.equal(COMPOSE * (U / SIDE_CELLS), SIDE_TILE_M * COMPOSE, 'a cell is still 1.3 m of u over 256 texels');
    assert.equal(COMPOSE, COMPOSE, 'and the height is still the band');
    // the emblem itself is metre-square, not texel-square: 5.1 mm across a texel here, 8.3 mm down one
    const r = rectIn(pic, EMBLEM_CELL);
    assert.equal(r.w, Math.round((EMBLEM_M / SIDE_TILE_M) * COMPOSE), 'across, off a cell of u');
    assert.equal(r.h, Math.round((EMBLEM_M / (SIDE_Y1 - SIDE_Y0)) * COMPOSE), 'and down, off the band of v');
    assert.ok(r.h < r.w, 'the texels are NOT square here, which is why the box is metres and not texels');
    assert.deepEqual(emblemRect(pic, 0, SIDE_Y1 - SIDE_Y0), { x0: 0, y0: 0, w: 0, h: 0 }, 'no tile at all is nothing to paint in');
    assert.deepEqual(rectIn(pic, -1), { x0: 0, y0: 0, w: 0, h: 0 }, 'and no cell before the first');
    assert.deepEqual(emblemRect({ width: 8, height: 8 }, 1.3, 2.12, 40, 0, 8), { x0: 0, y0: 0, w: 8, h: 8 }, 'an emblem too big for its cell is held inside it');
  } finally { setWagonHeraldry(null); }
});

test('WAGON-EMBLEM THE ARMS STAND IN THE SAME PLACE ON BOTH SIDES: a side band\'s u is laid the same way on the near wall and the far one (world/wagonArt.js sideBandU), so the picture is not mirrored about the wagon\'s middle and one pair of arms does not become two, a tile apart (mutants: planarUv\'s own far-side flip put back, the two sides reading different pictures)', () => {
  // the two OUTER walls: each looks away from the wagon's middle, so each carries c on its own side of it
  const near = wagonFaceSkin('openWagon', 'body', [1, 0, 0], [1.36, 2, 2]), far = wagonFaceSkin('openWagon', 'body', [-1, 0, 0], [-1.36, 2, 2]);
  assert.deepEqual([near.band, far.band], [BANDS.openSide, BANDS.openSide], 'both walls the one livery band');
  for (const z of [-0.7, 0.65, 1.3, 1.95, 2.6, 3.25, 3.9, 5.1]) {
    const p = [1.36, 2, z];
    assert.equal(near.u(p), far.u(p), `z ${z}: the near and far walls read the same picture at the same point`);
    assert.ok(Math.abs(near.u(p) - z / WAGON_TILE.openSide[0]) < 1e-12, `z ${z}: u is metres from the rear over the whole picture`);
  }
  // and it is that which puts both sides' arms in the second iteration: the emblem's z, read on each
  const r = emblemRect({ width: COMPOSE * SIDE_CELLS, height: COMPOSE }, SIDE_TILE_M, SIDE_Y1 - SIDE_Y0, EMBLEM_M, EMBLEM_CELL, COMPOSE);
  const z0 = ((r.x0 + 0.5) / (COMPOSE * SIDE_CELLS)) * WAGON_TILE.openSide[0];
  assert.ok(z0 >= SIDE_TILE_M && z0 < 2 * SIDE_TILE_M, `and it is the second iteration's metres (${z0.toFixed(3)})`);
  assert.equal(sideBandU([0, 0, 2.6], WAGON_TILE.openSide[0]), 0.5, 'u is a plain division - nothing behind it');
});

test('WAGON-EMBLEM THE DOOR: no guild wears the throne\'s own arms - Crimson fielded, a Gold border, a Gold crown - a set guild wears its own, the door takes a RESOLVER so a guild that has moved is the arms the next wagon is built with, and arms the law refuses (heraldryLaw.js heraldryOf) are the default rather than themselves (mutants: the default blank, a refused heraldry painted anyway, the door frozen at the value it was opened with)', async () => {
  setWagonHeraldry(null);
  try {
    assert.deepEqual(wagonHeraldry(), heraldryOf(WAGON_EMBLEM_ARMS), 'the door shut, the default arms');
    const [field, border, ink] = asHex(heraldryOf(WAGON_EMBLEM_ARMS));
    const pic = await withCanvas(sidePicture);
    const r = rectIn(pic, EMBLEM_CELL);
    const inner = coloursIn(pic, r.x0, r.y0, r.w, r.h);
    for (const [what, c] of [['the field', field], ['the border', border], ['the device', ink]])
      assert.ok(inner.has(rgb(c).join(',')), `${what} ${c} is there with no guild behind it (${[...inner].join(' / ')})`);
    // a resolver, not a value: the guild book refreshes under the wagon's pictures
    let arms = { field: 'vert', border: 'gold', device: 'anchor' };
    setWagonHeraldry(() => arms);
    assert.equal(wagonHeraldry().device, 'anchor');
    arms = { field: 'sable', border: 'argent', device: 'owl' };
    assert.equal(wagonHeraldry().device, 'owl', 'the same door, a guild that has moved since');
    setWagonHeraldry({ field: 'purpure', border: 'gold', device: 'skull' });
    assert.equal(wagonHeraldry().device, 'skull', 'a value stands in for one that never changes');
    for (const bad of [{ field: 'ash', border: 'gold', device: 'crown' }, { field: 'azure', border: 'azure', device: 'crown' },
      { field: 'azure', border: 'gold', device: 'dragonfly' }, { field: 'azure' }, null, 'azure']) {
      setWagonHeraldry(bad);
      assert.deepEqual(wagonHeraldry(), heraldryOf(WAGON_EMBLEM_ARMS), `${JSON.stringify(bad)} wears the default, not itself`);
    }
  } finally { setWagonHeraldry(null); }
});

test('WAGON-EMBLEM NO CANVAS, NO EMBLEM, NO THROW: a runtime with no canvas of its own (a Worker without OffscreenCanvas, and this one) still builds every wagon picture, and its side is byte for byte the bare sailcloth in ALL FOUR CELLS - while the same picture with a canvas up is NOT that, or none of the rest of this suite would say anything (mutants: a throw on a worker, the wagon lost, a cell half-painted, the pin going vacuous)', async () => {
  assert.equal(typeof OffscreenCanvas, 'undefined', 'this runtime really has no canvas of its own');
  assert.equal(typeof document, 'undefined', 'and no document to make one with');
  setWagonHeraldry(THREE_COLOURS);
  try {
    const hadPath = 'Path2D' in globalThis, wasPath = globalThis.Path2D;
    globalThis.Path2D = FakePath2D;
    try {
      const bare = await sidePicture();
      const painted = await withCanvas(sidePicture);
      assert.notDeepEqual([...painted.data], [...bare.data], 'a canvas DOES change the picture - the rest of this test is not vacuous');
      assert.deepEqual([bare.width, bare.height], [COMPOSE * SIDE_CELLS, COMPOSE], 'the picture is still four cells of cloth');
      const cell = await bareCell();
      let all = true;
      for (let k = 0; k < SIDE_CELLS; k++) if (bareDiff(bare, k, cell).length) all = false;
      assert.equal(all, true, 'every cell the bare sailcloth, arms or no arms');
      assert.equal(bare.data.every((v, i) => i % 4 !== 3 || v === 255), true, 'every texel whole, as before the arms');
    } finally { if (hadPath) globalThis.Path2D = wasPath; else delete globalThis.Path2D; }
  } finally { setWagonHeraldry(null); }
});

test('WAGON-EMBLEM THE STAMP ITSELF: a texel is BLENDED over, neither written nor cleared - half a white over the cloth is halfway between the two, a clear texel leaves the cloth exactly as it was, nothing is ever a hole, and a stamp hanging off either edge is cut rather than wrapped (mutants: a threshold instead of a blend, alpha punched to 0, a wrapped seam, a throw on a degenerate source)', () => {
  const cloth = () => { const p = { width: 4, height: 4, data: new Uint8Array(4 * 4 * 4).fill(255) }; for (let i = 0; i < p.data.length; i += 4) { p.data[i] = 50; p.data[i + 1] = 7; p.data[i + 2] = 0; } return p; };
  const src = { width: 2, height: 2, data: new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 0, 0, 255, 255, 255, 128]) };
  const a = cloth();
  stampRgba(a, src, 1, 1);
  assert.deepEqual([...a.data.slice((1 * 4 + 1) * 4, (1 * 4 + 1) * 4 + 4)], [255, 0, 0, 255], 'opaque red over the cloth');
  assert.deepEqual([...a.data.slice((1 * 4 + 2) * 4, (1 * 4 + 2) * 4 + 4)], [0, 255, 0, 255], 'opaque green beside it');
  assert.deepEqual([...a.data.slice((2 * 4 + 1) * 4, (2 * 4 + 1) * 4 + 4)], [50, 7, 0, 255], 'a clear texel leaves the cloth exactly as it was');
  assert.deepEqual([...a.data.slice((2 * 4 + 2) * 4, (2 * 4 + 2) * 4 + 4)], [152, 131, 128, 255], 'half white is halfway between the cloth and white');
  assert.equal(a.data.every((v, i) => i % 4 !== 3 || v === 255), true, 'nothing was ever a hole');
  const off = { width: 3, height: 3, data: new Uint8Array(3 * 3 * 4).fill(200) };
  stampRgba(off, src, 2, 2);
  assert.deepEqual([...off.data.slice(0, 4)], [200, 200, 200, 200], 'the top-left is not the stamp\'s own top-left wrapped round');
  assert.deepEqual([...off.data.slice((2 * 3 + 2) * 4, (2 * 3 + 2) * 4 + 4)], [255, 0, 0, 200], 'the part that lands is drawn - and the destination\'s OWN alpha is left as it was, an emblem never a hole through the cloth');
  const before = [...off.data];
  stampRgba(off, src, -2, -2);
  assert.deepEqual([...off.data], before, 'one hanging wholly off an edge goes nowhere at all');
  stampRgba(off, src, -1, -1);
  assert.deepEqual([...off.data.slice(0, 4)], [227, 227, 227, 200], 'and one over the edge is cut, not wrapped');
  assert.doesNotThrow(() => stampRgba(cloth(), { width: 0, height: 0, data: new Uint8Array(0) }, 0, 0), 'a source with nothing in it');
});

test('WAGON-EMBLEM A LIVERY IS NOT A GUILD: the open wagon\'s outer side is a COMPOSED picture - the chosen cloth, the composed size, the four cells, and a paint - for the built record and for every paint past the first, while the tilt and its inner face are still the sailcloth laid whole; and all twenty-one records still read opaque over the stand-in ARENA2 (mutants: a paint dropping the arms, a paint dropping a cell, the tilt gaining one, a record unread, the wagons\' count moved)', async () => {
  const src = WAGON_SOURCES[TEX.openSide];
  assert.equal(Array.isArray(src), false, 'a composed picture - a bare record cannot reach composedPicture\'s paint at all');
  assert.deepEqual(src.body, [50, 7], 'the cloth is still Daggerfall\'s sailcloth');
  assert.deepEqual(src.size, [COMPOSE, COMPOSE], 'at the composed size, so the band layout reads in it');
  assert.equal(src.repeat, SIDE_CELLS, 'and four cells of it across');
  assert.equal(typeof src.paint, 'function');
  assert.deepEqual([WAGON_SOURCES[TEX.tilt], WAGON_SOURCES[TEX.tiltInner]], [[50, 7], [50, 7]], 'the tilt and its inner face the sailcloth laid whole');
  assert.deepEqual(LOOK_RECORDS.openWagon, [TEX.openSide, TEX.tilt, TEX.tiltInner]);
  for (const name of ['red', 'blue', 'green', 'ochre', 'black', 'cream']) {
    const look = wagonLookSources('openWagon', 2, name), rec = lookRecord(TEX.openSide, 2);
    assert.equal(typeof look[rec].paint, 'function', `the ${name} livery keeps the arms over it`);
    assert.equal(look[rec].repeat, SIDE_CELLS, `and its four cells`);
    assert.deepEqual([Array.isArray(look[rec + 1]), Array.isArray(look[rec + 2])], [true, true], `${name}: the tilt and its inner face stay bare records`);
    if (name !== 'cream') assert.notDeepEqual(look[rec].body, src.body, `and the ${name} livery is its own cloth, not the built one`);
  }
  const srcs = { ...WAGON_SOURCES, ...wagonLookSources('openWagon', 3, 'blue') };
  const art = new Map(await classicPictures(srcs, fakeClassicRgba()));
  assert.equal(art.size, Object.keys(srcs).length, `all ${Object.keys(srcs).length} records built`);
  assert.deepEqual([...art.get(TEX.openSide).data.slice(0, 3)], CLOTH, 'the built side still reads from its own record');
  assert.equal(art.get(lookRecord(TEX.openSide, 3)).data.every((v, i) => i % 4 !== 3 || v === 255), true, "and a paint's side is opaque whatever the arms do");
  assert.equal(WAGON_ARCHIVE, 38181, 'under the wagons\' own archive, as every one of their records');
});