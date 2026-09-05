// THE 2026-09-04 DUNGEON SEAMS INCIDENT, pinned. Mac: "Dungeon interiors
// have some sort of see through line in its walls. Like it's not fully
// connected." Nothing was disconnected. Four laws had drifted from DFU
// at once, and each made the same one-texel line worse:
//
//   1. A MODEL texture was uploaded through the billboard's door -
//      getColor32(bitmap, 0), palette index 0 transparent - and the
//      model shader discarded alpha under 0.5. DFU's mesh material is
//      GetMaterial(archive, record) with alphaIndex -1 (MaterialReader
//      .cs:352, DaggerfallMesh.cs:141/:169) and DaggerfallDefault
//      .shader never clips. The mortar runs of a wall texture are
//      index 0, so every one became a slit into the next room.
//   2. Every host cleared to the Iliac Bay's sky blue, so what showed
//      through a slit was a glowing line. CameraClearManager.cs:23-25
//      clears an interior to BLACK.
//   3. No mip chain: TextureReader builds one on every classic texture
//      (:31 mipMaps = true, :264 Apply(true)) and samples it point
//      (MaterialReader.cs:104/:437). A one-texel line with no chain
//      keeps full contrast at any distance and shimmers.
//   4. One cache key for both uploads, so whichever of flat and mesh
//      asked first decided the pixels the other drew with.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { identity } from '../src/world/mat4.js';
import { Renderer, SKY_CLEAR, INTERIOR_CLEAR } from '../src/render/renderer.js';
import { TextureFile } from '../src/formats/textureFile.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');

/** The roadc_panelframe recording Proxy-GL. */
function recordingRenderer(log) {
  const stub = new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation' || k === 'getAttribLocation') return () => ({});
      if (k === 'createTexture' || k === 'createBuffer' || k === 'createVertexArray'
        || k === 'createProgram' || k === 'createShader' || k === 'createFramebuffer') return () => ({});
      if (k === 'getParameter') return () => new Float32Array([0, 0, 0, 0]);
      if (typeof k === 'string' && k.toUpperCase() === k) return k;   // GL enums answer their own name
      return (...args) => { log.push([k, ...args]); };
    },
  });
  const canvas = { getContext: () => stub, clientWidth: 640, clientHeight: 400, width: 640, height: 400 };
  const r = new Renderer(canvas);
  log.length = 0;
  return r;
}
const calls = (log, name) => log.filter((c) => c[0] === name);
const px = { colors: new Uint8ClampedArray(4), width: 1, height: 1 };

test('seams 1: alphaIndex -1 keeps palette index 0 opaque; 0 cuts it (MaterialReader.cs:352 vs the flat door)', () => {
  const t = new TextureFile();
  const bitmap = { width: 2, height: 1, data: new Uint8Array([0, 7]) };   // a mortar texel, then a stone one
  const opaque = t.getColor32(bitmap, -1);
  assert.deepEqual([opaque.colors[3], opaque.colors[7]], [255, 255], 'a mesh material has no cutout index');
  const cutout = t.getColor32(bitmap, 0);
  assert.deepEqual([cutout.colors[3], cutout.colors[7]], [0, 255], 'a flat cuts index 0');
});

test('seams 1: the pipeline uploads MESH materials opaque and flats as cutouts, through the one door', () => {
  const p = src('src/scenes/dataPipeline.js');
  assert.match(p, /const uploadRecord = \(archive, record, \{ opaque = false, mips \} = \{\}\) =>/);   // REVIEW 2026-09-05: + the icon door's mips opt-out
  assert.match(p, /const color32 = swap \?\? t\.getColor32\(bitmap, opaque \? -1 : 0\);/);
  assert.match(p, /renderer\.uploadTexture\(archive, record, color32, \{ opaque, mips \}\);/);
  // every sub-mesh upload asks for the opaque material
  const meshSites = [...p.matchAll(/uploadRecord\(sm\.textureArchive, sm\.textureRecord(, \{ opaque: true \})?\)/g)];
  assert.ok(meshSites.length >= 2, `the pipeline uploads sub-mesh textures at ${meshSites.length} sites`);
  for (const m of meshSites) assert.ok(m[1], `a sub-mesh upload without { opaque: true }: ${m[0]}`);
  // the two other mesh-texture doors
  assert.match(src('src/world/texRemap.js'), /uploadRecord\(swapped, sm\.textureRecord, \{ opaque: true \}\);/, 'the climate/season swap is a mesh material too');
  // REVIEW 2026-09-05 (PR #55 review): interiorContext has NO mesh door of
  // its own - its climate swap rides remapSubMeshes -> texRemap.js - and
  // its late-stood person is a FLAT (DaggerfallBillboard.cs:289-293,
  // alphaIndex 0). The first cut sent that flat through the mesh door
  // and the person never drew: drawBillboards reads the bare key only.
  assert.match(src('src/scenes/interiorContext.js'), /remapSubMeshes\(/, 'the interior swap goes through texRemap');
  assert.doesNotMatch(src('src/scenes/interiorContext.js'), /uploadRecord\([^)]*opaque/, 'no interior flat goes through the mesh door');
  // the flat/billboard door still cuts index 0
  assert.match(p, /const color32 = swapFrame \?\? t\.getColor32\(bitmap, 0\);/);
});

test('seams 1: the model shader carries no alpha clip; the billboard shader keeps its cutout', () => {
  const r = src('src/render/renderer.js');
  const model = r.slice(r.indexOf('const FS = `'), r.indexOf('const CHAR_FS = `'));
  assert.doesNotMatch(model, /tex\.a < 0\.5\) discard/, 'DaggerfallDefault.shader is Opaque with no clip()');
  assert.doesNotMatch(model, /if \(tex\.a[^\n]*discard/);
  const bb = r.slice(r.indexOf('const BB_FS = `'), r.indexOf('const WATER_FS = `'));
  assert.match(bb, /discard/, 'the billboard shader still cuts its transparent texels');
});

test('seams 4: the texture cache keys the opaque upload apart, and the mesh draw prefers it', () => {
  const log = [];
  const r = recordingRenderer(log);
  r.uploadTexture(7, 3, px);
  r.uploadTexture(7, 3, px, { opaque: true });
  assert.ok(r.textures.has('7_3') && r.textures.has('7_3#opaque'), 'two materials, two keys (DFU caches per alphaIndex)');
  assert.notEqual(r.textures.get('7_3'), r.textures.get('7_3#opaque'));
  const mesh = { vao: {}, subMeshes: [{ textureArchive: 7, textureRecord: 3, primitiveCount: 2, startIndex: 0 }] };
  r.drawMesh(mesh, identity());
  assert.equal(mesh.subMeshes[0]._evTex, r.textures.get('7_3#opaque'), 'a mesh draws the opaque material');
  // a mesh whose texture only ever came through the flat door still draws
  const r2 = recordingRenderer([]);
  r2.uploadTexture(7, 3, px);
  const mesh2 = { vao: {}, subMeshes: [{ textureArchive: 7, textureRecord: 3, primitiveCount: 2, startIndex: 0 }] };
  r2.drawMesh(mesh2, identity());
  assert.equal(mesh2.subMeshes[0]._evTex, r2.textures.get('7_3'), 'and falls back to the cutout upload');
});

test('seams 3: a classic upload builds a mip chain and samples it point; the smooth (UI) upload does not', () => {
  const log = [];
  const r = recordingRenderer(log);
  r.uploadTexture(7, 3, px);
  assert.equal(calls(log, 'generateMipmap').length, 1, 'TextureReader.cs:31 mipMaps = true, :264 Apply(true)');
  const min = calls(log, 'texParameteri').find((c) => c[2] === 'TEXTURE_MIN_FILTER');
  assert.equal(min[3], 'NEAREST_MIPMAP_NEAREST', 'FilterMode.Point over the chain (MaterialReader.cs:104/:437)');
  const mag = calls(log, 'texParameteri').find((c) => c[2] === 'TEXTURE_MAG_FILTER');
  assert.equal(mag[3], 'NEAREST');
  log.length = 0;
  r.uploadTexture(9, 0, px, { smooth: true });
  assert.equal(calls(log, 'generateMipmap').length, 0, 'the smooth upload keeps its single level');
  const smin = calls(log, 'texParameteri').find((c) => c[2] === 'TEXTURE_MIN_FILTER');
  assert.equal(smin[3], 'LINEAR');
});

test('seams 2: setClearColor is idempotent through the shadow, and the two colours are DFU\'s', () => {
  assert.deepEqual([...SKY_CLEAR], [0.53, 0.7, 0.92, 1]);
  assert.deepEqual([...INTERIOR_CLEAR], [0, 0, 0, 1], 'CameraClearManager.cs:25 Color.black');
  const log = [];
  const r = recordingRenderer(log);
  r.setClearColor(SKY_CLEAR);   // the constructor's colour already
  assert.equal(calls(log, 'clearColor').length, 0, 'no GL call when the shadow already holds it');
  r.setClearColor(INTERIOR_CLEAR);
  assert.deepEqual(calls(log, 'clearColor').pop().slice(1), [0, 0, 0, 1]);
  assert.deepEqual([...r._clearColor], [0, 0, 0, 1], 'the shadow follows (the panel bracket restores from it)');
  r.setClearColor(INTERIOR_CLEAR);
  assert.equal(calls(log, 'clearColor').length, 1, 'set once');
  r.setClearColor(SKY_CLEAR);
  assert.equal(calls(log, 'clearColor').length, 2);
});

test('seams 2: every host sets the clear colour - interiors black, the streaming hosts by mode', () => {
  assert.match(src('src/scenes/dungeon.js'), /renderer\.setClearColor\(INTERIOR_CLEAR\);/);
  assert.match(src('src/scenes/interior.js'), /renderer\.setClearColor\(INTERIOR_CLEAR\);/);
  // REVIEW 2026-09-05 (PR #55 review): the streaming hosts' own call sits
  // AFTER their `modes.frame` early return, so it only ever colours the
  // EXTERIOR frame; the world-hosted dungeon and interior frames are
  // begun in worldModes, and that is where they clear black.
  assert.match(src('src/scenes/world.js'), /renderer\.setClearColor\(SKY_CLEAR\);/);
  assert.match(src('src/scenes/exterior.js'), /renderer\.setClearColor\(SKY_CLEAR\);/);
  const wm = src('src/scenes/worldModes.js');
  const modeFrames = [...wm.matchAll(/renderer\.setClearColor\(INTERIOR_CLEAR\);[^\n]*\n\s+renderer\.setWorldViewport\([^\n]*\n\s+renderer\.beginFrame\(proj, view, INTERIOR_LIGHT_DIR\);/g)];
  assert.equal(modeFrames.length, 2, 'both mode frames (dungeon, interior) clear black above their viewport + beginFrame pair (E5 wants the rect immediately above the frame)');
  assert.equal([...wm.matchAll(/renderer\.beginFrame\(proj, view, INTERIOR_LIGHT_DIR\);/g)].length, 2, 'and those are the only two');
  // the mode-driven pair run BEFORE the frame they colour
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = src(f);
    const set = s.indexOf('renderer.setClearColor(');
    const begin = s.indexOf('renderer.beginFrame(', set);
    assert.ok(set > 0 && begin > set && begin - set < 2000, `${f}: setClearColor precedes the beginFrame it colours`);
  }
});

test('seams review: a billboard draws ONLY from the bare key - an opaque-only upload leaves it invisible', () => {
  // The law the late-stood interior person broke: drawBillboards looks
  // up `archive_record`, never `#opaque`.
  const I = identity();
  const log = [];
  const r = recordingRenderer(log);
  r.uploadTexture(182, 5, px, { opaque: true });
  const b = r.createBillboardBatch(182, 5, { w: 1, h: 2 }, [[0, 0, 0]]);
  log.length = 0;
  r.drawBillboards([b], I, I);
  assert.equal(calls(log, 'drawElements').length, 0, 'the opaque key is not a flat\'s texture');
  r.uploadTexture(182, 5, px);
  log.length = 0;
  r.drawBillboards([b], I, I);
  assert.equal(calls(log, 'drawElements').length, 1, 'the bare key draws it');
});

test('seams review: the mip chain is WORLD art\'s - a string-keyed UI upload keeps one NEAREST level; emission maps carry the chain', () => {
  const log = [];
  const r = recordingRenderer(log);
  r.uploadTexture('img', 'paint:1', px);   // ImageReader.cs:59 mipChain false
  assert.equal(calls(log, 'generateMipmap').length, 0, 'UI art has no chain');
  assert.equal(calls(log, 'texParameteri').find((c) => c[2] === 'TEXTURE_MIN_FILTER')[3], 'NEAREST');
  log.length = 0;
  r.uploadTexture(7, 4, px, { mips: false });
  assert.equal(calls(log, 'generateMipmap').length, 0, 'an explicit opt-out is honoured');
  log.length = 0;
  r.uploadEmissionTexture(7, 3, px);
  assert.equal(calls(log, 'generateMipmap').length, 1, 'TextureReader.cs:316/:328/:340 - the emission map is mipped like the albedo it is subtracted from');
  assert.equal(calls(log, 'texParameteri').find((c) => c[2] === 'TEXTURE_MIN_FILTER')[3], 'NEAREST_MIPMAP_NEAREST');
});

test('seams review 2: item icons are UI art - the icon door uploads a world archive un-mipped under its own key', () => {
  // ImageReader.cs:59 builds UI textures with mipChain false; the inventory
  // and scroller icons come from TEXTURE.nnn item archives (numeric), so
  // the world-art gate would have mipped them. `mips: false` keys apart.
  const log = [];
  const r = recordingRenderer(log);
  r.uploadTexture(233, 5, px, { mips: false });
  assert.equal(calls(log, 'generateMipmap').length, 0);
  assert.equal(calls(log, 'texParameteri').find((c) => c[2] === 'TEXTURE_MIN_FILTER')[3], 'NEAREST');
  assert.ok(r.textures.has('233_5#ui') && !r.textures.has('233_5'), 'the UI variant under its own key');
  log.length = 0;
  r.uploadTexture(233, 5, px);
  assert.equal(calls(log, 'generateMipmap').length, 1, 'the same record as WORLD art still gets its chain under the bare key');
  r.releaseTexture(233, 5);
  assert.ok(!r.textures.has('233_5#ui') && !r.textures.has('233_5'), 'a release frees every variant');
  for (const f of ['src/ui/nativeInventory.js', 'src/ui/itemScroller.js']) {
    assert.match(src(f), /icons\.uploadRecord\(img\.archive, img\.record, \{ mips: false \}\);/, `${f} asks for the UI variant`);
    assert.match(src(f), /icons\.textures\.get\(`\$\{key\}#ui`\)/, `${f} reads it back`);
  }
  assert.match(src('src/scenes/dataPipeline.js'), /renderer\.uploadTexture\(archive, record, color32, \{ opaque, mips \}\);/, 'the door forwards it');
});
