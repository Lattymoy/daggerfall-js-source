import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseEsm, MW_BODY_PARTS, BODY_TYPE } from '../src/formats/mwEsmFile.js';
import {
  assembleNpc, indexSkins, PART_BONES,
  firstPersonModel, firstPersonArmParts, mwRaceId, FIRST_PERSON_SLOTS,
} from '../src/formats/mwNpc.js';
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

// ── MW7: the first-person arms ─────────────────────────────────────
//
// THE DEFECT THIS CLOSES: slice 5 built a first-person rig and slice 6
// built body assembly, and nothing joined them. On RETAIL data the rig
// loaded meshes\base_anim.1st.nif - Morrowind's first-person SKELETON
// and animation carrier, which holds no body geometry - found nothing
// skinned, and fell back to the classic sprite for ever. Reported as
// "I upload my files, everything is enabled, it still shows me only
// the 2d sprite ingame", and that is exactly what the code did.

test('MW7: the .1st law - the same part with 1st before the extension', () => {
  // OpenMW performs this same insert when it dresses the first-person
  // body, and it is why every Morrowind body part ships a .1st twin.
  assert.equal(firstPersonModel('b\\B_N_Nord_M_Hand.nif'), 'b\\B_N_Nord_M_Hand.1st.nif');
  assert.equal(firstPersonModel('b\\B_N_Dark Elf_F_Forearm.NIF'), 'b\\B_N_Dark Elf_F_Forearm.1st.NIF');
  // a path whose DIRECTORIES carry dots must not be cut at one of them
  assert.equal(firstPersonModel('a.b\\c.nif'), 'a.b\\c.1st.nif');
  // and a name with no extension still answers something usable
  assert.equal(firstPersonModel('hand'), 'hand.1st');
  assert.equal(firstPersonModel(null), null);
});

test('MW7: every Daggerfall race is a Morrowind race - a spelling change, not a mapping', () => {
  // All eight of Daggerfall's races also exist in Morrowind, so the
  // body parts are there to be found; the port writes 'DarkElf' and
  // the ESM writes 'dark elf'.
  assert.equal(mwRaceId('Breton'), 'breton');
  assert.equal(mwRaceId('Redguard'), 'redguard');
  assert.equal(mwRaceId('Nord'), 'nord');
  assert.equal(mwRaceId('DarkElf'), 'dark elf');
  assert.equal(mwRaceId('HighElf'), 'high elf');
  assert.equal(mwRaceId('WoodElf'), 'wood elf');
  assert.equal(mwRaceId('Khajiit'), 'khajiit');
  assert.equal(mwRaceId('Argonian'), 'argonian');
  assert.equal(mwRaceId(null), null);
});

test('MW7: the arm chain - slots, order, sex match, and BOTH mesh names', () => {
  // Hand-built body records: the fixture ESM carries head/hair/chest
  // only, and the logic under test is which SLOTS an arm is made of.
  const body = (id, part, female, model) => ({ id, part, female, model, kind: BODY_TYPE.skin, race: 'nord', vampire: 0 });
  const bodies = new Map(Object.entries({
    hand_m: body('hand_m', MW_BODY_PARTS.indexOf('hand'), false, 'b\\hand_m.nif'),
    hand_f: body('hand_f', MW_BODY_PARTS.indexOf('hand'), true, 'b\\hand_f.nif'),
    wrist_m: body('wrist_m', MW_BODY_PARTS.indexOf('wrist'), false, 'b\\wrist_m.nif'),
    // forearm is MALE ONLY - retail does this constantly, and a female
    // character must fall back to it rather than lose the limb
    fore_m: body('fore_m', MW_BODY_PARTS.indexOf('forearm'), false, 'b\\fore_m.nif'),
    // a CHEST is in the set and must NOT be dragged into first person
    chest_m: body('chest_m', MW_BODY_PARTS.indexOf('chest'), false, 'b\\chest_m.nif'),
  }));
  const idx = indexSkins(bodies);

  const male = firstPersonArmParts(idx, 'nord', false);
  assert.deepEqual(male.map((p) => p.slot), ['hand', 'wrist', 'forearm'],
    'the arm chain, outermost first - and no chest, which would only clip the camera');
  assert.equal(male[0].model, 'meshes\\b\\hand_m.1st.nif', 'the first-person twin');
  assert.equal(male[0].thirdPersonModel, 'meshes\\b\\hand_m.nif',
    'and the plain mesh, so a missing twin costs a slightly wrong arm rather than the whole layer');
  assert.deepEqual(male[0].attachBones, PART_BONES.hand, 'both hands');

  const female = firstPersonArmParts(idx, 'nord', true);
  assert.equal(female[0].bodyId, 'hand_f', 'sex-matched where the race ships a female part');
  assert.equal(female[2].bodyId, 'fore_m', 'and falls back to male where it does not');

  // a race with no parts at all is empty, not an exception
  assert.deepEqual(firstPersonArmParts(idx, 'khajiit', false), []);
  assert.deepEqual(firstPersonArmParts(null, 'nord', false), []);
  // the slot list is the contract
  assert.deepEqual([...FIRST_PERSON_SLOTS], ['hand', 'wrist', 'forearm', 'upperarm']);
});

test('MW7: the FP layer actually ASKS for them - the two slices are joined', () => {
  const fp = readFileSync(new URL('../src/combat/mwFpArms.js', import.meta.url), 'utf8')
    .split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.match(fp, /import \{ indexSkins, firstPersonArmParts, mwRaceId \}/, 'slice 6 reaches slice 5');
  assert.match(fp, /createMwFpView\(renderer, playerEntity = null\)/, 'the view knows whose arms to build');
  assert.match(fp, /if \(!skinnedSets\.length && playerEntity\) \{/,
    'and only when the base carried none - explicit mwfparms still wins, so the probe keeps working');
  assert.match(fp, /file\(part\.model\) \|\| file\(part\.thirdPersonModel\)/, 'first-person twin, then the plain mesh');
  assert.match(fp, /playerEntity\.gender === 'female'/, 'sex-matched');
  // each failure says which piece is missing rather than going quiet
  for (const said of ['no Morrowind.esm attached', 'no player race to choose arms for', 'body parts in the ESM']) {
    assert.ok(fp.includes(said), `the status names the missing piece: ${said}`);
  }
  // and the rig hands the player in
  const rig = readFileSync(new URL('../src/combat/weaponRig.js', import.meta.url), 'utf8');
  assert.match(rig, /createMwFpView\(renderer, entity\)/, 'the weapon rig passes its entity');
});
