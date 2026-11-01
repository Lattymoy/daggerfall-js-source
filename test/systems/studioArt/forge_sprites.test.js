// The sprite forge's class sprites: TEXTURE.488 rendered from the forge's own 3D fighter, worn through the studio and
// snapped to the player's palette.
//
//   - the spec: Daggerfall's medium fighter's table - walk, attack, hurt, idle, bow in five views, 80 frames
//   - the folder: one picture for each frame the spec names, at its record's canvas, its edges hard
//   - the install: a forge picture is snapped to the player's palette as it decodes; another artist's is worn as drawn
//   - the snap: grain 0 snaps only - a colour goes to one palette colour wherever it sits
//   - the reference tool writes outside the repo only: the outlines it takes are game data
//   - the fit: one adjustment a frame, of the kinds a pose takes, within bounds
//   - the colour: every tint a finite positive factor, every grade curve rising within 0-255
//   - (ARENA2) the spec's canvases and frame counts are TEXTURE.488's own
//
// The install test's pictures are its own, written by tools/pngIO.mjs: no game data.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writePng, readPng } from '../../../tools/pngIO.mjs';
import { setValue } from '../../../src/systems/settings/settings.js';
import {
  clearVendorTextures, clearTextureReplacements, decodedTexture, preloadTextureArchive, setBundleTextures,
  setTextureDeriveContext,
} from '../../../src/systems/textureReplacement.js';
import {
  installStudioArt, studioUrl, _resetStudioArt, STUDIO_INDEX, isForgeRender, FORGE_FOLDER,
} from '../../../src/systems/studioArt/studioArt.js';
import { dfLook, setDfLookPalette } from '../../../src/world/dfLook.js';
import { TextureFile, texName } from '../../../src/formats/textureFile.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const spec = JSON.parse(readFileSync(join(root, 'tools/sprite-forge/specs/488.json'), 'utf8'));
const folder = join(root, 'public/art/studio', FORGE_FOLDER, '488');
const ARENA2 = process.env.ARENA2_PATH;
const ANIMS = [['walk', 4], ['attack', 6], ['hurt', 1], ['idle', 1], ['bow', 4]];

test('F1: the spec is the medium fighter\'s table - five animations in five views, 80 frames', () => {
  assert.equal(spec.archive, 488);
  assert.equal(spec.records.length, 25);
  spec.records.forEach((rec, r) => {
    const [anim, frames] = ANIMS[Math.floor(r / 5)];
    assert.equal(rec.anim, anim, `record ${r}`);
    assert.equal(rec.view, r % 5, `record ${r}`);
    assert.equal(rec.frames, frames, `record ${r}`);
    assert.ok(rec.canvas.every((n) => Number.isInteger(n) && n > 0), `record ${r} canvas`);
    assert.ok(rec.place.every(Number.isInteger), `record ${r} place`);
  });
  assert.equal(spec.records.reduce((n, rec) => n + rec.frames, 0), 80);
});

test('F2: the folder holds one picture a frame, each at its record\'s canvas, its edges hard, its feet on the last row', () => {
  const want = spec.records.flatMap((rec, r) => Array.from({ length: rec.frames }, (_, f) => `488_${r}-${f}.png`));
  assert.deepEqual(readdirSync(folder).sort(), want.sort());
  spec.records.forEach((rec, r) => {
    let grounded = false;
    for (let f = 0; f < rec.frames; f++) {
      const p = readPng(readFileSync(join(folder, `488_${r}-${f}.png`)));
      assert.deepEqual([p.width, p.height], rec.canvas, `488_${r}-${f}`);
      let opaque = 0;
      for (let i = 3; i < p.data.length; i += 4) {
        assert.ok(p.data[i] === 0 || p.data[i] === 255, `488_${r}-${f}: alpha ${p.data[i]}`);
        if (p.data[i]) opaque++;
      }
      assert.ok(opaque > 500, `488_${r}-${f} draws the body`);
      const last = (p.height - 1) * p.width * 4;
      for (let x = 0; x < p.width; x++) if (p.data[last + x * 4 + 3]) grounded = true;
    }
    assert.ok(grounded, `record ${r}: a frame stands on the canvas's last row`);
  });
});

/** A picture of the test's own: `w` x `h`, every texel `rgb`. */
const picture = (w, h, rgb) => writePng({ width: w, height: h, data: Uint8Array.from({ length: w * h * 4 }, (_, i) => (i % 4 === 3 ? 255 : rgb[i % 4])) });
/** A palette of the test's own: index i is (i, i, i) for the even indices, black for the odd ones. */
const greys = { getRed: (i) => (i % 2 ? 0 : i), getGreen: (i) => (i % 2 ? 0 : i), getBlue: (i) => (i % 2 ? 0 : i) };

test('F3: a forge picture is snapped to the player\'s palette as it decodes; another artist\'s is worn as drawn', async () => {
  const reset = () => {
    _resetStudioArt(); clearVendorTextures(); clearTextureReplacements(); setBundleTextures([]);
    setValue('Enhancements', 'AssetInjection', 'True');
    setTextureDeriveContext({ classicRgba: async () => null });
  };
  reset();
  setDfLookPalette(greys);
  try {
    assert.equal(isForgeRender('forge/488/488_0-0.png'), true);
    assert.equal(isForgeRender('maya/forge/488_0-0.png'), false, 'the artist is the first folder');
    const files = { 'forge/488/488_0-0.png': picture(4, 4, [91, 30, 30]), 'maya/488_1-0.png': picture(4, 4, [91, 30, 30]) };
    const fetch = async (url) => {
      if (url === studioUrl(STUDIO_INDEX)) return new Response(JSON.stringify({ studio: 1, files: Object.keys(files) }), { status: 200 });
      for (const [path, bytes] of Object.entries(files)) if (url === studioUrl(path)) return new Response(Uint8Array.from(bytes), { status: 200 });
      return new Response('not here', { status: 404 });
    };
    assert.equal(await installStudioArt({ fetch, decode: async (b) => readPng(b) }), 2);
    await preloadTextureArchive(488, { decode: async (b) => readPng(b) });
    const forged = decodedTexture(488, 0).colors;
    const drawn = decodedTexture(488, 1).colors;
    assert.deepEqual([...drawn.subarray(0, 3)], [91, 30, 30], 'another artist\'s picture as drawn');
    const [r, g, b] = forged.subarray(0, 3);
    assert.ok(r === g && g === b && r % 2 === 0, `the forge's snapped to a palette colour, not (${r}, ${g}, ${b})`);
    for (let i = 0; i < forged.length; i += 4) assert.equal(forged[i], r, `texel ${i / 4}: snapped, never grained`);
  } finally {
    setDfLookPalette(null);
    reset();
  }
});

test('F4: grain 0 snaps only - one colour goes to one palette colour wherever it sits', () => {
  setDfLookPalette(greys);
  try {
    const w = 16, h = 16;
    const data = Uint8Array.from({ length: w * h * 4 }, (_, i) => (i % 4 === 3 ? 255 : [121, 120, 119][i % 4]));
    const out = dfLook({ width: w, height: h, data }, 1234, 0).data;
    for (let i = 0; i < out.length; i += 4) assert.deepEqual([...out.subarray(i, i + 4)], [...out.subarray(0, 4)], `texel ${i / 4}`);
    const grained = dfLook({ width: w, height: h, data }, 1234).data;
    assert.ok(grained.some((v, i) => i % 4 !== 3 && v !== out[i]), 'the default still grains');
  } finally { setDfLookPalette(null); }
});

test('F5: the reference tool will not write its outlines into the repo', () => {
  let code = 0, said = '';
  try {
    execFileSync(process.execPath, [join(root, 'tools/sprite-forge/reference.mjs'), '488', join(root, 'ref.json')], {
      env: { ...process.env, ARENA2_PATH: '/nowhere' }, stdio: 'pipe',
    });
  } catch (e) { code = e.status; said = String(e.stderr); }
  assert.equal(code, 2);
  assert.match(said, /outside the repo/);
});

test('F7: the fit holds one adjustment a frame the spec names - joint turns, the body\'s turn, the axe\'s grip - none past its bounds', () => {
  const fit = JSON.parse(readFileSync(join(root, 'tools/sprite-forge/specs/488-fit.json'), 'utf8'));
  const want = spec.records.flatMap((rec) => Array.from({ length: rec.frames }, (_, f) => `${rec.anim}:${rec.view}:${f}`));
  assert.deepEqual(Object.keys(fit).sort(), [...new Set(want)].sort());
  for (const [key, adj] of Object.entries(fit)) {
    for (const kind of Object.keys(adj)) assert.ok(['rot', 'turn', 'roll', 'slide', 'elbow_L', 'elbow_R', 'grip', 'haft', 'fist', 'head'].includes(kind), `${key}: ${kind}`);
    if ('turn' in adj) assert.ok(Math.abs(adj.turn) <= 90, `${key}: turn ${adj.turn}`);
    for (const [joint, r] of Object.entries(adj.rot ?? {})) {
      assert.equal(r.length, 3, `${key} ${joint}`);
      for (const v of r) assert.ok(Math.abs(v) <= 75, `${key} ${joint}: ${v} degrees`);
    }
    for (const kind of ['grip', 'fist', 'head']) for (const v of adj[kind] ?? []) assert.ok(Math.abs(v) <= 0.5, `${key} ${kind}: ${v} m`);
  }
});

test('F8: the colour tables - each tint three finite positive factors, each grade curve rising within 0-255', () => {
  const tints = JSON.parse(readFileSync(join(root, 'tools/sprite-forge/specs/488-colour.json'), 'utf8'));
  for (const [name, f] of Object.entries(tints)) {
    assert.equal(f.length, 3, name);
    for (const v of f) assert.ok(Number.isFinite(v) && v > 0, `${name}: ${v}`);
  }
  const grade = JSON.parse(readFileSync(join(root, 'tools/sprite-forge/specs/488-grade.json'), 'utf8'));
  assert.ok(Object.keys(grade).length > 0);
  for (const [name, g] of Object.entries(grade)) {
    const curves = g.rgb ?? [g.lum];
    assert.ok(curves.length === 3 || (g.lum && curves.length === 1), name);
    for (const [src, dst] of curves) {
      assert.equal(src.length, dst.length, name);
      for (const side of [src, dst]) {
        for (let i = 0; i < side.length; i++) {
          assert.ok(side[i] >= 0 && side[i] <= 255, `${name}: ${side[i]}`);
          if (i) assert.ok(side[i] >= side[i - 1], `${name}: falls at ${i}`);
        }
      }
    }
  }
});

test('F6 (ARENA2): the spec\'s canvases and frame counts are TEXTURE.488\'s own', { skip: !ARENA2 && 'ARENA2_PATH is not set' }, () => {
  const tf = new TextureFile();
  tf.load(new Uint8Array(readFileSync(join(ARENA2, texName(488)))), texName(488));
  assert.equal(tf.recordCount, spec.records.length);
  spec.records.forEach((rec, r) => {
    assert.equal(tf.getFrameCount(r), rec.frames, `record ${r}`);
    const { width, height } = tf.getSize(r);
    assert.deepEqual([width, height], rec.canvas, `record ${r}`);
  });
});
