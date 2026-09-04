// MW-D50 - THE VENDORED HORSE. Pegas Horse Ranch is carried verbatim
// under vendor/pegas-horse/ with the author's written consent, and the
// enhanced ride assembles it through the SAME archives seam as the
// player's own attach - ranked behind it. The pure half (which files
// one variant needs, the coat read out of the mesh, the archive) is
// pinned over the crafted fixture and a fake fetcher; the vendor tree
// itself is pinned to its manifest both ways and proven end to end
// over the real files, the way windmillmesh pins baked === vendored.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import {
  horseFiles, horseCoatPath, assembleVendoredArchive, loadPegasHorse,
  horseMeshPath, horseKfPath, HORSE_SOUNDS, HORSE_CLIPS,
} from '../src/systems/pegasHorse.js';

const ANIMATED = new Uint8Array(readFileSync(new URL('./fixtures/mw/animated.nif', import.meta.url)));
const VENDOR = 'vendor/pegas-horse';

function stubRenderer() {
  return {
    gl: { deleteVertexArray() {}, deleteBuffer() {}, deleteTexture() {} },
    createCharacterMesh: (packed) => ({ vao: {}, buffers: [{}], floats: packed.length }),
    createCharacterTexture: (mips) => ({ mips: mips.length }),
    updateCharacterMesh() {},
  };
}

/** A fetcher over a Map that records every path asked for. */
function fetcher(files, asked = []) {
  return { asked, fetchBytes: async (p) => { asked.push(p); return files.get(p) ?? null; } };
}

test('MW-D50: one variant is exactly the set the ride resolves - mesh, clips, then the four sounds', () => {
  assert.deepEqual(horseFiles(1), ['meshes/maxhorse/xhorse1.nif', 'meshes/maxhorse/xhorse1.kf', ...Object.values(HORSE_SOUNDS)]);
  assert.equal(horseFiles(20)[0], 'meshes/maxhorse/xhorse20.nif');
  assert.equal(horseFiles().length, 2 + Object.keys(HORSE_SOUNDS).length);
});

test('MW-D50: the coat is read out of the mesh, never guessed - and a miss is null, never a throw', () => {
  // the fixture's skinned shape names no texture
  assert.equal(horseCoatPath(ANIMATED, () => true), null);
  // garbage bytes
  assert.equal(horseCoatPath(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), () => true), null);
  assert.equal(horseCoatPath(new Uint8Array(0), () => true), null);
});

test('MW-D50: the vendored archive fetches only what one variant needs and the assembly cannot tell it from an attach', async () => {
  const files = new Map([
    [horseMeshPath(1), ANIMATED], [horseKfPath(1), ANIMATED],
    [horseMeshPath(2), ANIMATED], [horseKfPath(2), ANIMATED],
    [HORSE_SOUNDS.trot, new Uint8Array(4)], [HORSE_SOUNDS.roar, new Uint8Array(4)],
    ['textures/cait_horse1x.dds', new Uint8Array(4)],   // present, but no mesh names it
  ]);
  const f = fetcher(files);
  const arc = await assembleVendoredArchive({ manifest: files.keys(), fetchBytes: f.fetchBytes, variant: 1 });
  assert.ok(arc, 'the set assembles');
  // fetched: variant 1's mesh and clips, the two sounds that exist - never variant 2, never the unreferenced coat
  assert.deepEqual([...f.asked].sort(), [horseKfPath(1), horseMeshPath(1), HORSE_SOUNDS.roar, HORSE_SOUNDS.trot].sort());
  assert.ok(arc.has(horseMeshPath(1)) && arc.has(HORSE_SOUNDS.trot));
  assert.ok(!arc.has(horseMeshPath(2)), 'the other variant stays on the server');
  assert.ok(!arc.has(HORSE_SOUNDS.gallop), 'a sound the manifest lacks is not in the archive');
  assert.ok(arc.has('MESHES/maxhorse/XHORSE1.NIF'), 'the duck answers case-blind like the attach door');
  // the assembly rides it exactly as it rides the player's own
  const horse = loadPegasHorse({ renderer: stubRenderer(), archives: [arc], variant: 1 });
  assert.equal(horse.ok, true, `stage ${horse.stage}: ${horse.error ?? ''}`);
  assert.ok(horse.setClip(HORSE_CLIPS.still));
});

test('MW-D50: the never-throws law - a missing mesh or clips is null, a failing optional file is skipped', async () => {
  const meshOnly = new Map([[horseMeshPath(1), ANIMATED]]);
  assert.equal(await assembleVendoredArchive({ manifest: meshOnly.keys(), fetchBytes: fetcher(meshOnly).fetchBytes }), null, 'no clips, no horse');
  assert.equal(await assembleVendoredArchive({ manifest: [], fetchBytes: fetcher(new Map()).fetchBytes }), null, 'an empty tree is no horse');
  // the mesh is listed but the fetch dies
  const listed = [horseMeshPath(1), horseKfPath(1)];
  assert.equal(await assembleVendoredArchive({ manifest: listed, fetchBytes: async () => { throw new Error('HTTP 404'); } }), null, 'a dead mesh fetch answers null, never throws');
  // a sound that throws is skipped; the horse still stands
  const files = new Map([[horseMeshPath(1), ANIMATED], [horseKfPath(1), ANIMATED], [HORSE_SOUNDS.trot, new Uint8Array(4)]]);
  const arc = await assembleVendoredArchive({
    manifest: files.keys(),
    fetchBytes: async (p) => { if (p === HORSE_SOUNDS.trot) throw new Error('HTTP 500'); return files.get(p); },
  });
  assert.ok(arc && arc.has(horseMeshPath(1)) && !arc.has(HORSE_SOUNDS.trot), 'the failed sound degrades alone');
});

test('MW-D50: the host ranks the player\'s own attach AHEAD of the vendored set, through the one door', () => {
  const world = readFileSync('src/scenes/world.js', 'utf8');
  assert.ok(world.includes("import { loadVendoredPegas } from '../systems/pegasVendor.js';"));
  const attachedAt = world.indexOf('const attached = await loadMorrowindArchives();');
  const vendoredAt = world.indexOf('const vendored = await loadVendoredPegas();');
  assert.ok(attachedAt > 0 && vendoredAt > attachedAt, 'both sets are read inside tryLoadPegas');
  assert.ok(world.includes('const archives = vendored ? [...attached, vendored] : attached;'),
    'the attached set answers first - the engine\'s data-files-over-archive law; no vendor tree = the attach alone');
  assert.ok(world.includes('if (pegasWanted || !isEnhanced()) return;'), 'still once, still enhanced only');
  // the vendored loader is host-only: a build-time glob over the vendor tree, fetched lazily, cached, never throwing
  const vendor = readFileSync('src/systems/pegasVendor.js', 'utf8');
  assert.ok(vendor.includes("import.meta.glob('../../vendor/pegas-horse/**/*.{nif,kf,dds,tga,wav}', { query: '?url', import: 'default' })"));
  assert.ok(vendor.includes('assembleVendoredArchive({ manifest, fetchBytes, variant })'), 'the pure half lives in pegasHorse.js');
  assert.ok(vendor.includes('.catch((err) => {') && vendor.includes('return null; })'), 'a failed fetch answers null');
  assert.ok(!/parseNif|flattenNif|readFileSync/.test(vendor), 'no second mesh path, no node-only reads');
});

test('MW-D50: the vendor tree matches its manifest both ways - verbatim bytes, nothing unlisted - and rides end to end', () => {
  const manifestPath = join(VENDOR, 'manifest.json');
  if (!existsSync(manifestPath)) {
    // no horse vendored yet: then no asset may sit in the tree unlisted either
    const stray = existsSync(VENDOR) ? walk(VENDOR).filter((p) => /\.(nif|kf|dds|tga|wav)$/i.test(p)) : [];
    assert.deepEqual(stray, [], 'assets without a manifest');
    return;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assert.match(manifest.consent, /written consent/, 'the consent is recorded on the manifest');
  assert.ok(existsSync(join(VENDOR, 'README.md')), 'the permission record');
  const listed = new Map(manifest.files.map((f) => [f.path, f]));
  const onDisk = walk(VENDOR).filter((p) => /\.(nif|kf|dds|tga|wav)$/i.test(p)).map((p) => p.slice(VENDOR.length + 1).replace(/\\/g, '/'));
  assert.deepEqual(onDisk.sort(), [...listed.keys()].sort(), 'every vendored asset is listed and every listed asset exists');
  for (const [path, f] of listed) {
    const bytes = readFileSync(join(VENDOR, path));
    assert.equal(bytes.length, f.bytes, `${path}: size`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), f.sha256, `${path}: verbatim`);
    assert.equal(path, path.toLowerCase(), `${path}: canonical (lowercase) loose path`);
  }
  for (const r of manifest.readmes) assert.ok(existsSync(join(VENDOR, r)), `${r}: the mod's readme comes across whole`);
  // the real-data proof, in the suite now that the files are ours to carry
  for (const v of manifest.variants) {
    for (const p of [horseMeshPath(v), horseKfPath(v), ...Object.values(HORSE_SOUNDS)]) assert.ok(listed.has(p), `variant ${v}: ${p}`);
    const coat = horseCoatPath(new Uint8Array(readFileSync(join(VENDOR, horseMeshPath(v)))), (p) => listed.has(String(p).toLowerCase()));
    assert.ok(coat && listed.has(coat), `variant ${v}: the coat the mesh names is vendored (${coat})`);
  }
});

test('MW-D50: the vendored variant 1 stands with its coat hung and all three gaits, through the runtime path', async () => {
  if (!existsSync(join(VENDOR, 'manifest.json'))) return;
  const manifest = JSON.parse(readFileSync(join(VENDOR, 'manifest.json'), 'utf8'));
  const arc = await assembleVendoredArchive({
    manifest: manifest.files.map((f) => f.path),
    fetchBytes: async (p) => new Uint8Array(readFileSync(join(VENDOR, p))),
    variant: 1,
  });
  assert.ok(arc, 'assembles');
  for (const p of Object.values(HORSE_SOUNDS)) assert.ok(arc.has(p), `${p} rides along`);
  const horse = loadPegasHorse({ renderer: stubRenderer(), archives: [arc], variant: 1 });
  assert.equal(horse.ok, true, `stage ${horse.stage}: ${horse.error ?? ''}`);
  assert.deepEqual(horse.notes, [], 'no degrade - the coat hung');
  assert.ok(horse.mesh.ranges.every((r) => r.tex), 'every range textured');
  for (const clip of Object.values(HORSE_CLIPS)) assert.ok(horse.setClip(clip), `${clip} armed`);
  horse.advance(0.1);
});

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
