import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { reliefFromSprite, projectRelief } from '../src/characters/spriteRelief.js';
import { ImgFile } from '../src/formats/imgFile.js';
import { TextureFile } from '../src/formats/textureFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

test('relief: synthetic identity witness + watertight z + normals', () => {
  const W = 6, H = 3;
  const data = new Uint8Array(W * H);
  // A 4-wide run and a lone pixel.
  for (let x = 1; x <= 4; x++) data[1 * W + x] = 0x70 + x;
  data[2 * W + 0] = 0x4a;
  const opts = { offsetX: 10, offsetY: 20, canvasH: 200 };
  const faces = reliefFromSprite(data.length ? { width: W, height: H, data } : null, opts);
  assert.equal(faces.length, 5);
  assert.deepEqual([...projectRelief(faces, W, H, opts)], [...data]);
  // Shared-edge z: face(px=2) right z == face(px=3) left z.
  const f2 = faces.find((f) => f.px === 2), f3 = faces.find((f) => f.px === 3);
  assert.ok(Math.abs(f2.p[5] - f3.p[2]) < 1e-12);
  // Run centre bulges deepest; edges shallow.
  const f1 = faces.find((f) => f.px === 1);
  assert.ok(f2.p[5] > f1.p[2]);
  // Normals unit + front-facing.
  for (const f of faces) {
    assert.ok(Math.abs(Math.hypot(...f.n) - 1) < 1e-9);
    assert.ok(f.n[2] > 0);
  }
});

test('relief: the classic body round-trips whole', { skip: skipReal }, () => {
  const pal = new DFPalette();
  pal.load(readFileSync(join(ARENA2, 'ART_PAL.COL')), 'ART_PAL.COL');
  const img = new ImgFile();
  img.load(readFileSync(join(ARENA2, 'BODY00I0.IMG')), 'BODY00I0.IMG', pal);
  const bmp = img.getDFBitmap();
  const off = img.imageOffset;
  const opts = { offsetX: off.x, offsetY: off.y };
  const faces = reliefFromSprite(bmp, opts);
  let opaque = 0;
  for (const i of bmp.data) if (i !== 0) opaque++;
  assert.equal(faces.length, opaque);
  assert.deepEqual([...projectRelief(faces, bmp.width, bmp.height, opts)],
    [...bmp.data]);
});

test('relief: body + cuirass share the canvas by classic offsets', { skip: skipReal }, () => {
  const pal = new DFPalette();
  pal.load(readFileSync(join(ARENA2, 'ART_PAL.COL')), 'ART_PAL.COL');
  const img = new ImgFile();
  img.load(readFileSync(join(ARENA2, 'BODY00I0.IMG')), 'BODY00I0.IMG', pal);
  const bodyOff = img.imageOffset;
  const tex = new TextureFile();
  tex.load(readFileSync(join(ARENA2, 'TEXTURE.251')), 'TEXTURE.251', pal);
  const pieceOff = tex.getOffset(4);
  assert.deepEqual(bodyOff, { x: 222, y: 41 });
  assert.deepEqual(pieceOff, { x: 237, y: 44 });
  // The cuirass relief lands INSIDE the body's canvas span - same
  // space, zero fitting.
  const body = reliefFromSprite(img.getDFBitmap(), { offsetX: bodyOff.x, offsetY: bodyOff.y });
  const piece = reliefFromSprite(tex.getDFBitmap(4, 0), { offsetX: pieceOff.x, offsetY: pieceOff.y, zBias: 1.5 });
  const xs = (fs) => fs.reduce((m, f) => [Math.min(m[0], f.p[0]), Math.max(m[1], f.p[3])], [1e9, -1e9]);
  const [bx0, bx1] = xs(body);
  const [px0, px1] = xs(piece);
  assert.ok(px0 >= bx0 - 2 && px1 <= bx1 + 2, `piece x [${px0},${px1}] inside body x [${bx0},${bx1}]`);
});
