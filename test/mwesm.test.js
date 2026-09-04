import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseEsm, MW_BODY_PARTS, BODY_TYPE } from '../src/formats/mwEsmFile.js';
import { assembleNpc, indexSkins, PART_BONES } from '../src/formats/mwNpc.js';
import { MwBsaFile, normalizeBsaPath } from '../src/formats/mwBsaFile.js';

// fixture.esm is written by test/fixtures/mw/generate.py - an
// independent struct-level TES3 writer, values pinned here verbatim.
const ESM = new Uint8Array(readFileSync(new URL('./fixtures/mw/fixture.esm', import.meta.url)));

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test('mwesm: header, record walk, and the skip census', () => {
  const esm = parseEsm(ESM);
  assert.ok(near(esm.header.version, 1.3, 1e-5));
  assert.equal(esm.header.company, 'fixture');
  assert.match(esm.header.description, /generate\.py/);
  assert.equal(esm.recordCount, 9);
  // Unknown types are skipped BY SIZE and counted - nothing silent.
  assert.deepEqual([...esm.skipped], [['JUNK', 1]]);
});

test('mwesm: BODY records decode part/sex/kind and the race they fit', () => {
  const esm = parseEsm(ESM);
  assert.equal(esm.bodies.size, 4);
  const chest = esm.bodies.get('b_test_chest');
  assert.equal(chest.race, 'testrace');
  assert.equal(MW_BODY_PARTS[chest.part], 'chest');
  assert.equal(chest.kind, BODY_TYPE.skin);
  assert.equal(chest.female, false);
  assert.equal(chest.model, 'fixture\\part.nif');
  assert.equal(esm.bodies.get('b_test_chest_f').female, true);
  assert.equal(MW_BODY_PARTS[esm.bodies.get('b_test_hair').part], 'hair');
});

test('mwesm: RACE height/weight land past the 120-byte stat block; flags read', () => {
  const race = parseEsm(ESM).races.get('testrace');
  assert.ok(near(race.height[0], 1.0) && near(race.height[1], 0.95));
  assert.ok(near(race.weight[1], 0.9));
  assert.equal(race.playable, true);
  assert.equal(race.beast, false);
});

test('mwesm: NPC_ names its head and hair, flags split female/autocalc', () => {
  const esm = parseEsm(ESM);
  const m = esm.npcs.get('test npc');
  assert.equal(m.name, 'Test NPC');
  assert.equal(m.race, 'testrace');
  assert.equal(m.head, 'b_test_head');
  assert.equal(m.hair, 'b_test_hair');
  assert.equal(m.female, false);
  assert.equal(m.autocalc, true);
  assert.equal(m.level, 1);
  assert.equal(esm.npcs.get('test npc f').female, true);
});

test('mwnpc: assembly - named head/hair, sex-matched skins, honest missing list', () => {
  const esm = parseEsm(ESM);
  const idx = indexSkins(esm.bodies);
  const a = assembleNpc(esm, 'Test NPC', idx);
  const bySlot = Object.fromEntries(a.parts.map((p) => [p.slot, p]));
  assert.equal(bySlot.head.model, 'meshes\\fixture\\mesh.nif');
  assert.deepEqual(bySlot.head.attachBones, ['head']);
  assert.deepEqual(bySlot.hair.attachBones, ['head']);
  assert.equal(bySlot.chest.bodyId, 'b_test_chest');
  assert.equal(a.animFile, 'meshes\\base_anim.nif');
  // The fixture ships only chest skins: every other slot is REPORTED
  // (tail excepted - a non-beast race owns no tail and that's the data
  // being right).
  assert.ok(a.missing.includes('neck: no testrace skin'));
  assert.ok(!a.missing.some((m) => m.startsWith('tail')));
  // Sex matching: the female NPC takes the female chest; paired-limb
  // slots carry both bones for the attach that mirrors them.
  const f = assembleNpc(esm, 'test npc f', idx);
  assert.equal(f.parts.find((p) => p.slot === 'chest').bodyId, 'b_test_chest_f');
  assert.deepEqual(PART_BONES.hand, ['left hand', 'right hand']);
});

test('mwnpc: an unknown NPC or race throws with the name', () => {
  const esm = parseEsm(ESM);
  assert.throws(() => assembleNpc(esm, 'nobody'), /no NPC_ "nobody"/);
  esm.npcs.get('test npc').race = 'ghosts';
  assert.throws(() => assembleNpc(esm, 'test npc'), /unknown race "ghosts"/);
});

// ---------------------------------------------------------------------------
// Real-data validation - MW_DATA_PATH gate. The strongest claim in the
// slice: every mesh path the assembler emits for a retail NPC must
// EXIST in the retail archive.
// ---------------------------------------------------------------------------

const MW = process.env.MW_DATA_PATH;
const retailEsm = MW ? join(MW, 'Morrowind.esm') : null;
const skipReal =
  !retailEsm || !existsSync(retailEsm)
    ? 'MW_DATA_PATH not set or Morrowind.esm missing - real-data validation skipped'
    : false;

test('mwesm: retail Morrowind.esm parses; fargoth assembles to meshes that exist', { skip: skipReal }, () => {
  const esm = parseEsm(new Uint8Array(readFileSync(retailEsm)));
  assert.match(esm.header.company, /Bethesda/);
  assert.ok(esm.npcs.size > 2500, `npcs ${esm.npcs.size}`);
  assert.ok(esm.bodies.size > 1000, `bodies ${esm.bodies.size}`);
  assert.ok(esm.races.has('dark elf'));
  const fargoth = esm.npcs.get('fargoth');
  assert.ok(fargoth && fargoth.race === 'wood elf');
  const a = assembleNpc(esm, 'fargoth');
  assert.ok(a.parts.length >= 10, `parts ${a.parts.length}`);
  const bsa = new MwBsaFile(new Uint8Array(readFileSync(join(MW, 'Morrowind.bsa'))));
  const absent = a.parts.filter((p) => !bsa.has(normalizeBsaPath(p.model)));
  assert.deepEqual(
    absent.map((p) => `${p.slot}=${p.model}`),
    [],
    'every assembled mesh path exists in the retail archive',
  );
  assert.equal(a.animFile, 'meshes\\base_anim.nif');
  // And a beast race walks its own skeleton.
  const beastNpc = [...esm.npcs.values()].find((n) => esm.races.get(n.race)?.beast && !n.model);
  assert.ok(beastNpc, 'retail has beast NPCs');
  assert.equal(assembleNpc(esm, beastNpc.id).animFile, 'meshes\\base_animkna.nif');
});


// MW7's four pins are GONE, deliberately. They asserted the ".1st law" -
// that a first-person part is the same mesh filename with ".1st" spliced
// before the extension - and that rule is wrong in kind. The engine looks
// up a RECORD whose id ends in "1st"; retail proves it, since the Nord
// male hand record is `b_n_nord_m_handS.1st`, plural. The replacement
// pins live in test/mwinspect.test.js and are checked against real data.
// A pin that asserts a disproven rule is worse than no pin at all.
