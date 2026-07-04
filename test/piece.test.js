import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { shellFromSprite, projectFront, resolvePiece } from '../src/characters/pieceFromSprite.js';
import { DAGGER_SPEC } from '../src/characters/daggerBodySpec.js';
import { torsoProfile } from '../src/characters/rewrite/bodySpec.js';
import { getTemplate } from '../src/characters/paperdoll.js';
import { resolvePaperdollRecord, armorVariant, MATERIAL_FAMILY } from '../src/characters/paperdollArt.js';
import { DYE_COLORS, DYE_TARGETS, METAL_TABLES, applyDyeToIndex } from '../src/characters/dyes.js';
import { TextureFile } from '../src/formats/textureFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

test('piece: synthetic shell round-trips through geometry', () => {
  const W = 5, H = 4;
  const data = new Uint8Array(W * H);
  data[1 * W + 2] = 0x72;
  data[2 * W + 0] = 0x7b;
  data[3 * W + 4] = 0x40;
  const faces = shellFromSprite({ width: W, height: H, data });
  assert.equal(faces.length, 3);
  const grid = projectFront(faces, W, H);
  assert.deepEqual([...grid], [...data]);
  // Geometry sanity: quads sit on the ellipse, outward normals.
  for (const f of faces) {
    for (let i = 0; i < 4; i++) {
      const x = f.p[i * 3], z = f.p[i * 3 + 2];
      const e = (x / 0.34) ** 2 + (z / 0.22) ** 2;
      assert.ok(Math.abs(e - 1) < 1e-9, `on-ellipse ${e}`);
    }
    assert.ok(f.n[2] > -1e-9, 'front arc faces never point backward');
  }
});

test('piece: 1:1 witness on the real plate cuirass', { skip: skipReal }, () => {
  const pal = new DFPalette();
  pal.load(readFileSync(join(ARENA2, 'ART_PAL.COL')), 'ART_PAL.COL');
  const tex = new TextureFile();
  tex.load(readFileSync(join(ARENA2, 'TEXTURE.251')), 'TEXTURE.251', pal);
  const tpl = getTemplate(102);
  const rec = resolvePaperdollRecord(tpl, armorVariant(102, MATERIAL_FAMILY.Plate, 1));
  const bmp = tex.getDFBitmap(rec, 0);
  const faces = shellFromSprite(bmp);
  // One face per opaque pixel - nothing invented, nothing dropped.
  let opaque = 0;
  for (const i of bmp.data) if (i !== 0) opaque++;
  assert.equal(faces.length, opaque);
  // Geometric front projection reproduces the sprite EXACTLY.
  const grid = projectFront(faces, bmp.width, bmp.height);
  assert.deepEqual([...grid], [...bmp.data]);
  // Dye resolve: Steel is the identity band; Iron follows its table.
  const steel = resolvePiece(faces, DYE_COLORS.Steel, DYE_TARGETS.WeaponsAndArmor, pal, applyDyeToIndex);
  const iron = resolvePiece(faces, DYE_COLORS.Iron, DYE_TARGETS.WeaponsAndArmor, pal, applyDyeToIndex);
  const f0 = faces.find((f) => f.idx >= 0x70 && f.idx <= 0x7f);
  const i0 = faces.indexOf(f0);
  const cSteel = pal.get(f0.idx);
  const cIron = pal.get(METAL_TABLES.Iron[f0.idx - 0x70]);
  assert.deepEqual(steel[i0].c, [cSteel.r, cSteel.g, cSteel.b]);
  assert.deepEqual(iron[i0].c, [cIron.r, cIron.g, cIron.b]);
});


test('piece: profile mode round-trips through the body profile', () => {
  const W = 4, H = 6;
  const data = new Uint8Array(W * H);
  data[0 * W + 1] = 0x71; data[3 * W + 2] = 0x74; data[5 * W + 0] = 0x7c;
  const opts = {
    profile: (y) => { const r = torsoProfile(DAGGER_SPEC, y); return { rx: r.rx + 0.03, rz: r.rz + 0.03 }; },
    yTop: DAGGER_SPEC.chest.y1 + 0.02,
    yBottom: DAGGER_SPEC.pelvis.y0,
    arc: Math.PI * 0.9,
  };
  const faces = shellFromSprite({ width: W, height: H, data }, opts);
  assert.equal(faces.length, 3);
  const grid = projectFront(faces, W, H, opts);
  assert.deepEqual([...grid], [...data]);
  // Rows land in absolute rig space, radii vary with height.
  for (const f of faces) assert.ok(f.p[1] >= DAGGER_SPEC.pelvis.y0 - 1e-9 && f.p[1] <= DAGGER_SPEC.chest.y1 + 0.02 + 1e-9);
});

test('piece: DAGGER_SPEC v2 pins (full resculpt)', () => {
  assert.equal(DAGGER_SPEC.pelvisY, 0.9743);
  assert.equal(DAGGER_SPEC.chest.y1, 1.478);
  assert.equal(DAGGER_SPEC.torsoRows.length, 48); // slab rows; merged rows keep the full run (no carve - C6m fix), split rows exact
  assert.equal(DAGGER_SPEC.head.scale, 1.115);
  // Bones reach the plant: thigh + calf == pelvisY - 0.06.
  assert.equal(+(DAGGER_SPEC.leg.thigh + DAGGER_SPEC.leg.calf).toFixed(4), +(DAGGER_SPEC.pelvisY - 0.06).toFixed(4));
});
