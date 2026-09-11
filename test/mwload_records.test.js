// MW-LOAD: THE ARM RECORDS, EXTRACTED ONCE.
//
// buildFpArm asked six questions of every stored master - bodies,
// races, armors, clothes, weapons, one GMST - and each was its own full
// walk of the file, on every page load. extractArmRecords answers all
// six in ONE pass and its answer is plain data, so dataSource can keep
// it in the derived store against the file and never read the .esm
// bytes again. These pins hold the one-pass answer to the six readers
// and hold the store door to its envelope.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractArmRecords, isArmRecords, ARM_RECORDS_VERSION, ARM_GMST_IDS, GMST_SNEAK_DELTA,
  bodyParts, raceRecords, armorRecords, clothingRecords, weaponRecords, gmstValue,
} from '../src/formats/mwFirstPerson.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const fixture = (n) => new Uint8Array(readFileSync(join(ROOT, 'test/fixtures/mw', n)));

// A hand-built ESM the way fparm.test.js builds them: every record
// kind the extractor dispatches, plus a GMST the build does not ask for
// and a duplicate RACE id (last wins) and a duplicate GMST (first wins).
const enc = (str) => Array.from(str, (c) => c.charCodeAt(0));
const u32 = (n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
const sub = (name, payload) => [...enc(name), ...u32(payload.length), ...payload];
const rec = (type, subs) => { const body = subs.flat(); return [...enc(type), ...u32(body.length), 0, 0, 0, 0, 0, 0, 0, 0, ...body]; };
const z = (s2) => [...enc(s2), 0];
const radt = (flags, h = [1.5, 1.25], w = [1.1, 0.9]) => {
  const b = new Uint8Array(140);
  const dv = new DataView(b.buffer);
  dv.setFloat32(120, h[0], true); dv.setFloat32(124, h[1], true);
  dv.setFloat32(128, w[0], true); dv.setFloat32(132, w[1], true);
  dv.setInt32(136, flags, true);
  return Array.from(b);
};
const wpdt = (type, speed) => {
  const b = new Uint8Array(32);
  const dv = new DataView(b.buffer);
  dv.setInt16(8, type, true); dv.setFloat32(12, speed, true);
  return Array.from(b);
};
const handBuilt = () => new Uint8Array([
  ...rec('TES3', [sub('HEDR', new Array(300).fill(0))]),
  ...rec('GMST', [sub('NAME', z('fSomethingElse')), sub('FLTV', u32(0))]),
  ...rec('GMST', [sub('NAME', z('i1stPersonSneakDelta')), sub('INTV', u32(10))]),
  ...rec('GMST', [sub('NAME', z('i1stPersonSneakDelta')), sub('INTV', u32(99))]),   // first wins
  ...rec('BODY', [sub('NAME', z('b_n_breton_m_hand.1st')), sub('MODL', [...enc('b'), 0x5c, ...z('hand.nif')]), sub('FNAM', z('Breton')), sub('BYDT', [0, 0, 0, 0])]),
  ...rec('RACE', [sub('NAME', z('Breton')), sub('RADT', radt(1))]),
  ...rec('RACE', [sub('NAME', z('Argonian')), sub('RADT', radt(3))]),
  ...rec('RACE', [sub('NAME', z('Breton')), sub('RADT', radt(1, [2, 2], [2, 2]))]),   // last wins
  ...rec('RACE', [sub('RADT', radt(1))]),   // nameless: dropped
  ...rec('ARMO', [sub('NAME', z('Iron_Cuirass')), sub('MODL', [...enc('a'), 0x5c, ...z('ir_cuirass.nif')]), sub('INDX', [3]), sub('BNAM', z('a_iron_cuirass'))]),
  ...rec('ARMO', [sub('NAME', z('modelless'))]),   // no MODL: dropped
  ...rec('CLOT', [sub('NAME', z('common_shirt_01')), sub('MODL', [...enc('c'), 0x5c, ...z('shirt.nif')]), sub('CTDT', [...u32(2), ...u32(0), 0, 0, 0, 0]), sub('INDX', [3]), sub('CNAM', z('c_shirt_f'))]),
  ...rec('WEAP', [sub('NAME', z('iron_dagger')), sub('MODL', [...enc('w'), 0x5c, ...z('dag.nif')]), sub('WPDT', wpdt(1, 1.25))]),
  ...rec('LAND', [sub('DATA', [1, 2, 3])]),   // a kind nobody asks about
]);

const sixWays = (bytes) => ({
  version: ARM_RECORDS_VERSION,
  parts: bodyParts(bytes),
  races: [...raceRecords(bytes).entries()],
  armors: armorRecords(bytes),
  clothes: clothingRecords(bytes),
  weapons: weaponRecords(bytes),
  gmst: Object.fromEntries(ARM_GMST_IDS.map((id) => [id, gmstValue(bytes, id)]).filter(([, v]) => v !== null)),
});

test('MW-LOAD: extractArmRecords equals the six per-kind readers on every fixture master', () => {
  for (const name of ['armfp.esm', 'armparts.esm', 'fixture.esm']) {
    const bytes = fixture(name);
    assert.deepEqual(extractArmRecords(bytes), sixWays(bytes), `${name}: the one pass and the six walks disagree`);
  }
  const hand = handBuilt();
  const one = extractArmRecords(hand);
  assert.deepEqual(one, sixWays(hand), 'hand-built: the one pass and the six walks disagree');
  // the rules the six readers carry, visible in the one answer
  assert.deepEqual(one.parts.map((p) => p.id), ['b_n_breton_m_hand.1st']);
  assert.deepEqual(one.races.map(([id]) => id), ['breton', 'argonian'], 'insertion order, nameless dropped');
  assert.deepEqual(one.races[0][1].height, [2, 2], 'last RACE with the id wins');
  assert.equal(one.races[1][1].beast, true);
  assert.deepEqual(one.armors.map((a) => a.id), ['iron_cuirass'], 'a modelless ARMO is dropped');
  assert.deepEqual(one.armors[0].parts, [{ part: 3, male: 'a_iron_cuirass', female: null }]);
  assert.deepEqual(one.clothes.map((c) => [c.id, c.type]), [['common_shirt_01', 2]]);
  assert.deepEqual(one.weapons.map((w) => [w.id, w.type, w.speed]), [['iron_dagger', 1, 1.25]]);
  assert.deepEqual(one.gmst, { [GMST_SNEAK_DELTA]: 10 }, 'the FIRST GMST wins (gmstValue’s rule) and unasked ids are not carried');
});

test('MW-LOAD: the answer survives JSON whole, and the envelope is refused when it is not this shape', () => {
  const hand = handBuilt();
  const one = extractArmRecords(hand);
  const back = JSON.parse(JSON.stringify(one));
  assert.deepEqual(back, one, 'plain data - no Map, no typed array, no NaN');
  assert.ok(isArmRecords(back));
  assert.equal(new Map(back.races).get('breton').beast, false, 'the races rehydrate as the Map the build reads');
  assert.equal(isArmRecords(null), false);
  assert.equal(isArmRecords({ ...back, version: ARM_RECORDS_VERSION + 1 }), false, 'another version is not readable');
  assert.equal(isArmRecords({ ...back, weapons: undefined }), false, 'a torn set is not readable');
  assert.equal(isArmRecords({ ...back, gmst: null }), false);
  // a master that carries nothing the build asks for still answers the shape
  const empty = extractArmRecords(new Uint8Array([...rec('TES3', [sub('HEDR', new Array(300).fill(0))])]));
  assert.ok(isArmRecords(empty));
  assert.deepEqual(empty, { version: ARM_RECORDS_VERSION, parts: [], races: [], armors: [], clothes: [], weapons: [], gmst: {} });
  // the GMST list is the build's, spelled once
  assert.deepEqual([...ARM_GMST_IDS], [GMST_SNEAK_DELTA]);
});

test('MW-LOAD: the per-kind readers ride the same per-record functions as the one pass', () => {
  // ONE HOME: bodyParts/raceRecords/armorRecords/clothingRecords/
  // weaponRecords/gmstValue and extractArmRecords cannot disagree
  // because each kind has exactly one reader, called from both.
  const src = rd('src/formats/mwFirstPerson.js');
  for (const [kind, reader, walker] of [
    ['BODY', 'readBodyPart', 'bodyParts'], ['RACE', 'readRace', 'raceRecords'],
    ['ARMO', 'readArmor', 'armorRecords'], ['CLOT', 'readClothing', 'clothingRecords'],
    ['WEAP', 'readWeapon', 'weaponRecords'], ['GMST', 'readGmst', 'gmstValue'],
  ]) {
    assert.match(src, new RegExp(`case '${kind}': \\{?[\\s\\S]{0,40}?${reader}\\(bytes, rec\\)`), `${kind}: the one pass calls ${reader}`);
    const fn = src.slice(src.indexOf(`export function ${walker}(`));
    assert.match(fn.slice(0, fn.indexOf('\n}\n')), new RegExp(`${reader}\\(bytes, rec\\)`), `${walker} calls ${reader}`);
    assert.equal(src.split(`function ${reader}(bytes, rec)`).length, 2, `${reader} is declared once`);
  }
});

test('MW-LOAD: dataSource keeps the record sets in the derived store, keyed to the file and refused by envelope', () => {
  const src = rd('src/scenes/dataSource.js');
  const door = src.slice(src.indexOf('export const loadMorrowindArmRecords = async (fileName) =>'));
  assert.ok(door.length > 100, 'the door exists');
  assert.match(door, /const blob = await assetBlob\(MW_STORE, fileName\);/, 'the file is a Blob handle - its size is free, its bytes are not read for a hit');
  assert.match(door, /await import\('\.\.\/formats\/mwFirstPerson\.js'\)/, 'the reader is imported at the door, not at boot');
  assert.match(door, /`\$\{ARM_RECORDS_PREFIX\}:v\$\{ARM_RECORDS_VERSION\}:\$\{fileName\}:\$\{blob\.size\}:\$\{await sampleStamp\(blob\)\}`/,
    'the key names the reader version, the file, its size and its sample stamp');
  assert.match(door, /const cached = await loadDerivedJson\(key\);\s*\n\s*let records = isArmRecords\(cached\) \? cached : null;/,
    'a stored set is read only when its own envelope carries this key and this shape');
  const json = src.slice(src.indexOf('export async function loadDerivedJson(key)'));
  assert.match(json.slice(0, json.indexOf('\n}\n')), /env && env\.key === key && Object\.hasOwn\(env, 'value'\) \? env\.value : null/,
    'the envelope is the key: another key\'s value is null');
  assert.match(door, /const bytes = new Uint8Array\(await blob\.arrayBuffer\(\)\);\s*\n\s*const t1 = performance\.now\(\);\s*\n\s*records = extractArmRecords\(bytes\);/,
    'a miss reads the file once and extracts in one pass');
  assert.match(door, /await storeDerivedJson\(key, records\);/, 'and keeps it');
  assert.match(door, /_mwRecordsCache\.files\.set\(fileName, records\);/, 'and memoises for the session');
  // the memo drops with the attach generation, like every swap cache
  assert.match(src, /_mwGeneration\+\+; _mwEsm = undefined; _mwArchiveCache = null; _mwFileCache = null; _mwRecordsCache = null; \}/,
    'a new attach drops the record memo with the other swap caches');
  const clear = src.slice(src.indexOf('export const clearStoredMorrowind = async () =>'));
  assert.match(clear.slice(0, clear.indexOf('\n};')), /await clearDerivedPrefix\(ARM_RECORDS_PREFIX\);/,
    'clearing the Morrowind store sweeps its derived record sets');
  // the stamp is two range reads, never the whole file
  const stamp = src.slice(src.indexOf('async function sampleStamp(blob)'));
  assert.match(stamp.slice(0, stamp.indexOf('\n}\n')), /blob\.slice\(0, span\)[\s\S]*blob\.slice\(blob\.size - span, blob\.size\)/,
    'head and tail by range');
  // the header says who the consumer is
  assert.match(src, /ITS ONE CONSUMER IS MW-LOAD's arm record sets/);
});

test('MW-LOAD: the attach fingerprint carries the stored SIZES, so a same-name re-attach is a change', () => {
  // THE DEFECT the browser probe showed: a second Morrowind.esm stored
  // over the first moved no name, so the generation stood, the record
  // memo answered for the old file, and the persistent set made the
  // stale answer visible. Every swap cache rode the same gap.
  const src = rd('src/scenes/dataSource.js');
  assert.match(src, /const mwFingerprint = \(names, sizes = \[\]\) => \[\.\.\.names\]\.sort\(\)\.map\(\(n, i\) => `\$\{n\}\\t\$\{sizes\[i\] \?\? ''\}`\)\.join\('\\n'\);/,
    'name and size per row, in sorted order');
  const sizes = src.slice(src.indexOf('async function storedMorrowindSizes(names)'));
  // AUDIT 65 XL-6: off a PLAIN GET, not assetBlob. Both stored shapes
  // answer their own size (a Blob's `.size`, a legacy ArrayBuffer's
  // `.byteLength`); assetBlob would MIGRATE every legacy record - a
  // structured clone and a readwrite put per file - just to measure it.
  assert.match(sizes.slice(0, sizes.indexOf('\n}\n')), /for \(const n of \[\.\.\.names\]\.sort\(\)\) \{\s*\n\s*const v = await assetValue\(MW_STORE, n\);\s*\n\s*out\.push\(v == null \? -1 : \(v\.size \?\? v\.byteLength \?\? -1\)\);/,
    'the sizes walk the same sorted order off a plain get - no bytes read, and nothing written');
  assert.doesNotMatch(sizes.slice(0, sizes.indexOf('\n}\n')), /assetBlob/, 'measuring a set never migrates it');
  const reg = src.slice(src.indexOf('export async function registerMorrowindData()'));
  assert.match(reg, /const sizes = await storedMorrowindSizes\(names\);\s*\n\s*const print = mwFingerprint\(names, sizes\);/);
});


// ── the build, through the door ──────────────────────────────────────
import { buildFpArm, armRecordsOf, fpSkeletonPath, FP_CLIP_PATH } from '../src/combat/fpArm.js';
import { FACE_MATCH_VERSION } from '../src/formats/mwFaceMatch.js';

const fixtureArchive = () => {
  const files = new Map([
    [fpSkeletonPath({}), fixture('armfp.nif')],
    [FP_CLIP_PATH, fixture('armfpidle.kf')],
    ['meshes/fixture/armfphand.nif', fixture('armfphand.nif')],
    ['meshes/fixture/armfparm.nif', fixture('armfparm.nif')],
    ['textures/tx_fixture.dds', fixture('fixture.dds')],
  ]);
  return { has: (p) => files.has(p), get: (p) => files.get(p) };
};

test('MW-LOAD: buildFpArm takes its records through the derived door and never reads the master\'s bytes', async () => {
  const esm = fixture('armfp.esm');
  const viaBytes = await buildFpArm({
    race: 'fprace',
    deps: {
      loadMorrowindArchives: async () => [fixtureArchive()],
      storedMorrowindNames: async () => ['armfp.esm'],
      loadMorrowindFile: async () => esm,
    },
  });
  assert.equal(viaBytes.ok, true, viaBytes.error);
  let bytesAsked = 0;
  const records = JSON.parse(JSON.stringify(extractArmRecords(esm)));   // as the store hands it back
  const viaDoor = await buildFpArm({
    race: 'fprace',
    deps: {
      loadMorrowindArchives: async () => [fixtureArchive()],
      storedMorrowindNames: async () => ['armfp.esm'],
      loadMorrowindFile: async () => { bytesAsked++; return esm; },
      loadMorrowindArmRecords: async (n) => (n === 'armfp.esm' ? records : null),
    },
  });
  assert.equal(viaDoor.ok, true, viaDoor.error);
  assert.equal(bytesAsked, 0, 'the master was never read');
  for (const k of ['rows', 'sources', 'sourcePaths', 'groups', 'skeletonPath', 'settingsSkeleton', 'notes', 'pieces', 'mwType', 'weapon']) {
    assert.deepEqual(viaDoor[k], viaBytes[k], `${k}: the door and the walk built different arms`);
  }
  // a file the door cannot answer for walks its bytes as before
  let asked = 0;
  const mixed = await buildFpArm({
    race: 'fprace',
    deps: {
      loadMorrowindArchives: async () => [fixtureArchive()],
      storedMorrowindNames: async () => ['armfp.esm'],
      loadMorrowindFile: async () => { asked++; return esm; },
      loadMorrowindArmRecords: async () => null,
    },
  });
  assert.equal(mixed.ok, true);
  assert.equal(asked, 1, 'null from the door is the bytes path');
});

test('MW-LOAD: armRecordsOf answers each walk kind in the walk\'s own shape, and a kind it lacks by name', () => {
  const hand = handBuilt();
  const records = JSON.parse(JSON.stringify(extractArmRecords(hand)));
  assert.deepEqual(armRecordsOf(records, 'parts'), bodyParts(hand));
  const races = armRecordsOf(records, 'races');
  assert.ok(races instanceof Map, 'races come back as raceRecords’ Map');
  assert.deepEqual([...races.entries()], [...raceRecords(hand).entries()]);
  assert.equal(armRecordsOf(records, 'races'), races, 'made once per set');
  assert.deepEqual(armRecordsOf(records, 'armors'), armorRecords(hand));
  assert.deepEqual(armRecordsOf(records, 'clothes'), clothingRecords(hand));
  assert.deepEqual(armRecordsOf(records, 'weapons'), weaponRecords(hand));
  assert.deepEqual(armRecordsOf(records, 'gmst-sneak'), { v: gmstValue(hand, GMST_SNEAK_DELTA) });
  assert.deepEqual(armRecordsOf({ ...records, gmst: {} }, 'gmst-sneak'), { v: null }, 'an absent GMST is the walk’s null');
  assert.throws(() => armRecordsOf(records, 'npcs'), /no derived answer for walk kind "npcs"/);
});

test('MW-LOAD: the face verdict is kept in the derived store against the set, the identity and the matcher version', async () => {
  const esm = fixture('armfp.esm');
  const kept = { head: 'b_n_fprace_m_head_01', hair: 'b_n_fprace_m_hair_02', reasons: [] };
  const stores = [];
  let arena2Asked = 0;
  const deps = {
    loadMorrowindArchives: async () => [fixtureArchive()],
    storedMorrowindNames: async () => ['armfp.esm'],
    loadMorrowindFile: async () => esm,
    morrowindDataGeneration: () => 7,
    morrowindDataFingerprint: () => 'armfp.esm\t1234',
    fetchArena2Bytes: async () => { arena2Asked++; throw new Error('no ARENA2 here'); },
    loadDerivedJson: async (key) => (key.startsWith(`mw-face-match:v${FACE_MATCH_VERSION}:fprace:m:3:`) ? kept : null),
    storeDerivedJson: async (key, value) => { stores.push([key, value]); },
  };
  const res = await buildFpArm({ race: 'fprace', faceIndex: 3, deps });
  assert.equal(res.ok, true, res.error);
  assert.deepEqual(res.face, kept, 'the kept verdict is the build’s face');
  assert.equal(arena2Asked, 0, 'and the portrait was never measured');
  assert.deepEqual(stores, [], 'a kept verdict is not written again');
  // an identity the store has no verdict for measures - and here the
  // measuring fails (no portrait), which is NOT kept: a miss is not a verdict
  const res2 = await buildFpArm({ race: 'fprace', faceIndex: 4, deps });
  assert.equal(res2.ok, true);
  assert.equal(res2.face.head, null);
  assert.ok(res2.face.reasons.includes('the walk stands'), 'measured on this data, and the walk stands');
  assert.deepEqual(stores, [], 'a walk-stands verdict is never kept');
  // source pins: the key and the guard
  const src = rd('src/combat/fpArm.js');
  assert.match(src, /`mw-face-match:v\$\{FACE_MATCH_VERSION\}:\$\{race\}:\$\{female \? 'f' : 'm'\}:\$\{faceIndex \| 0\}:\$\{fnv\(print\)\}`/,
    'the key names the matcher version, the identity and the set');
  assert.match(src, /if \(kept && \(kept\.head \|\| kept\.hair\)\) \{ faceMatch = kept; FACE_MATCH_CACHE\.set\(fkey, kept\); \}/);
  assert.match(src, /if \(dkey && \(faceMatch\.head \|\| faceMatch\.hair\)\) \{\s*\n\s*try \{ await d\.storeDerivedJson\(dkey, faceMatch\); \}/);
  // the measurement decodes level 0 only
  const measure = src.slice(src.indexOf('async function measurePart('));
  assert.match(measure.slice(0, measure.indexOf('\n}\n')), /decodeTextureImage\(tpath, tarc\.get\(tpath\)\.slice\(\), \{ levels: 1 \}\)/);
  // the esm loop takes the door first, the bytes second
  assert.match(src, /const records = typeof d\.loadMorrowindArmRecords === 'function' \? await d\.loadMorrowindArmRecords\(n\) : null;\s*\n\s*esmBytes\.push\(records \? \{ name: n, records \} : \{ name: n, bytes: await d\.loadMorrowindFile\(n\) \}\);/);
  assert.match(src, /if \(e\.records\) return armRecordsOf\(e\.records, kind\);/);
});
