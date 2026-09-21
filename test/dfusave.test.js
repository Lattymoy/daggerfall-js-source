// DFUSAVE1 (2026-09-20) - the Daggerfall Unity save-game reader
// (src/formats/dfuSave.js): Full Serializer's envelope stripped once at
// the door, 64-bit integers kept whole, the folder walk and the version
// gate. Synthetic fixtures are written in the shape fsSerializer prints
// ($version/$content, $type, $id/$ref, Key/Value dictionaries, enum
// NAMES) and pinned against literals. Real-save validation is gated on
// DFU_SAVES_PATH (a DFU `Saves` folder) and skips without it; the file
// roster is regenerated from SaveLoadManager.cs when the reference clone
// is present (PY1's DFU_PATH convention).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseFsJson, unwrapFs, dictEntries, enumValue,
  readDfuSaveInfo, readDfuSave, dfuSaveSlot, collectDfuSaveFiles, loadDfuSaveFiles, dfuSaveFilesFromZip,
  DFU_LATEST_SAVE_VERSION, DFU_SAVE_FILES, DFU_SAVE_INFO, DFU_SAVE_DATA, DFU_BIO_FILE, DFU_SCREENSHOT,
  DFU_MOD_DATA_PREFIX,
} from '../src/formats/dfuSave.js';
import { dfuFile, missingDfu } from './dfuRoot.mjs';

/** Wrap as `[fsObject("v1")]` prints it. */
const v1 = (content, extra = {}) => ({ $version: 'v1', $content: content, ...extra });

/** A minimal SaveInfo_v1 + SaveData_v1 pair in fsSerializer's shape. */
function fixture({ saveVersion = 1, name = 'Tester' } = {}) {
  const info = v1({
    saveVersion, saveName: 'Quick', characterName: name,
    dateAndTime: v1({ gameTime: 12566016000 + 8640000, realTime: 638000000000000000 }),
    dfuVersion: '1.1.1',
  });
  const data = v1({
    header: v1({ description: 'Daggerfall Unity Save Game v1' }),
    currentUID: 33554440,
    dateAndTime: v1({ gameTime: 12566016000 + 8640000, realTime: 638000000000000000 }),
    playerData: v1({
      playerEntity: v1({ name, gender: 'Female', level: 3, goldPieces: 120 }),
      guildMemberships: [{ Key: 11, Value: v1({ rank: 2, lastRankChange: 5, variant: 0, flags: 0 }) }],
      transportMode: 'Foot',
    }),
    enemyData: [v1({ loadID: '@BIG@', isDead: false })],   // the digits are spliced in below - a JS literal would round before the reader saw it
  });
  return {
    'SAVEINFO.TXT': JSON.stringify(info),
    'SAVEDATA.TXT': JSON.stringify(data).replace('"@BIG@"', '18446744073709551000'),
  };
}

// ---------------------------------------------------------------- the JSON

test('DFUSAVE1: a 64-bit integer survives the parse as a decimal string; everything under 2^53 is still a number', () => {
  const j = parseFsJson('{"a":12345678901234567890,"b":-98765432109876543210,"c":123,"d":1.5e3,"e":1234567890123456.5,"s":"x1234567890123456789y","n":[1234567890123456,123456789012345]}');
  assert.deepEqual(j, {
    a: '12345678901234567890', b: '-98765432109876543210', c: 123, d: 1500, e: 1234567890123456.5,
    s: 'x1234567890123456789y', n: ['1234567890123456', 123456789012345],
  });
  // The threshold is SIXTEEN digits: 15 is below 2^53 (9,007,199,254,740,992).
  assert.equal(parseFsJson('[999999999999999]')[0], 999999999999999);
  assert.equal(parseFsJson('[1000000000000000]')[0], '1000000000000000');
  // An escaped quote inside a string does not end the string.
  assert.deepEqual(parseFsJson('{"s":"a\\"1234567890123456789","t":1234567890123456789}'), { s: 'a"1234567890123456789', t: '1234567890123456789' });
});

test('DFUSAVE1: the envelope collapses at every depth - $version/$content gone, $type kept, $id/$ref one object', () => {
  const u = unwrapFs({
    $version: 'v1', $content: {
      p: { $id: '1', $version: 'v1', $content: { x: 1, deep: [v1({ y: 2 })] } },
      q: { $ref: '1' },
      first: { $ref: '2' },                                  // a $ref BEFORE its $id
      e: { $type: 'DaggerfallWorkshop.T', $version: 'v1', $content: { z: 3 } },
      later: { $id: '2', k: 'v' },
      arr: [{ $ref: '1' }, 5, 'str', null],
      plain: { a: { b: { c: 1 } } },
    },
  });
  assert.deepEqual(JSON.parse(JSON.stringify(u)), {
    p: { x: 1, deep: [{ y: 2 }] }, q: { x: 1, deep: [{ y: 2 }] }, first: { k: 'v' },
    e: { z: 3, $type: 'DaggerfallWorkshop.T' }, later: { k: 'v' },
    arr: [{ x: 1, deep: [{ y: 2 }] }, 5, 'str', null], plain: { a: { b: { c: 1 } } },
  });
  assert.equal(u.p, u.q, 'a $ref resolves to the SAME object, not a copy');
  assert.equal(u.arr[0], u.p);
  assert.equal(u.first, u.later);
  assert.throws(() => unwrapFs({ a: { $ref: '9' } }), /\$ref 9 has no \$id/);
});

test('DFUSAVE1: a dictionary reads both ways fsSerializer writes one, and an enum by name, number, numeric string or flags list', () => {
  assert.deepEqual(dictEntries([{ Key: 11, Value: 'a' }, { Key: 3, Value: 'b' }]), [[11, 'a'], [3, 'b']]);
  assert.deepEqual(dictEntries({ 11: 'a', x: 'b' }), [['11', 'a'], ['x', 'b']]);
  assert.deepEqual(dictEntries(null), []);
  assert.throws(() => dictEntries('no'), /not a dictionary/);
  const G = { Male: 0, Female: 1 };
  assert.equal(enumValue('Female', G), 1);
  assert.equal(enumValue(1, G), 1);
  assert.equal(enumValue('1', G), 1);
  assert.equal(enumValue('A, C', { A: 1, B: 2, C: 4 }), 5);
  assert.equal(enumValue('A,C', { A: 1, B: 2, C: 4 }), 5, 'fsEnumConverter joins with a bare comma');
  assert.equal(enumValue('', { None: 0, A: 1 }), 0, 'a ZERO [Flags] value prints as the empty string (AUDIT-DFUSAVE R6)');
  assert.throws(() => enumValue('Other', G), /unknown enum name "Other"/);
  assert.throws(() => enumValue(null, G), /enum expected/);
});

// --------------------------------------------------------------- the files

test('DFUSAVE1: a save opens from its files - info gated, data unwrapped, the optional files null, bio lines, mod data, the screenshot bytes', () => {
  const files = fixture();
  files['BIO.TXT'] = 'Line one\r\nLine two\n';
  files['MOD_ROADS.DFMOD.TXT'] = JSON.stringify(v1({ on: true }));
  files['SCREENSHOT.JPG'] = Uint8Array.of(0xff, 0xd8, 0xff);
  const s = readDfuSave(4, files);
  assert.equal(s.index, 4);
  assert.deepEqual(s.info, {
    saveVersion: 1, saveName: 'Quick', characterName: 'Tester',
    dateAndTime: { gameTime: 12574656000, realTime: '638000000000000000' }, dfuVersion: '1.1.1',
  });
  assert.equal(s.saveData.header.description, 'Daggerfall Unity Save Game v1');
  assert.equal(s.saveData.playerData.playerEntity.gender, 'Female');
  assert.deepEqual(dictEntries(s.saveData.playerData.guildMemberships), [[11, { rank: 2, lastRankChange: 5, variant: 0, flags: 0 }]]);
  assert.equal(s.saveData.enemyData[0].loadID, '18446744073709551000', 'a LoadID past 2^53 is a string');
  for (const k of ['factionData', 'questData', 'discoveryData', 'conversationData', 'notebookData', 'worldVariationData', 'automapData', 'containerData', 'questExceptions']) {
    assert.equal(s[k], null, `${k} absent -> null`);
  }
  assert.deepEqual(s.backStory, ['Line one', 'Line two'], 'ReadLine: no terminator, and a trailing newline is not a line');
  assert.deepEqual([...s.modData.entries()], [['ROADS.DFMOD', { on: true }]]);
  assert.deepEqual(s.screenshot, Uint8Array.of(0xff, 0xd8, 0xff));
});

test('DFUSAVE1: the gates - no SaveInfo, a newer saveVersion, a SaveData that is not one, a SaveInfo that is not one', () => {
  const files = fixture();
  assert.throws(() => readDfuSave(0, { 'SAVEDATA.TXT': files['SAVEDATA.TXT'] }), /SAVE0: no SaveInfo\.txt/);
  assert.throws(() => readDfuSave(2, fixture({ saveVersion: DFU_LATEST_SAVE_VERSION + 1 })), /SAVE2: save version 2 is newer than 1/);
  assert.throws(() => readDfuSave(1, { ...files, 'SAVEDATA.TXT': '[1,2]' }), /SAVE1: SaveData\.txt is not a SaveData_v1/);
  assert.throws(() => readDfuSave(3, { 'SAVEINFO.TXT': files['SAVEINFO.TXT'] }), /SAVE3: no SaveData\.txt/, 'a missing file is named as missing, not as malformed (AUDIT-DFUSAVE R9)');
  assert.throws(() => readDfuSave(1, { ...files, 'SAVEDATA.TXT': JSON.stringify(v1({ noHeader: 1 })) }), /not a SaveData_v1/);
  assert.throws(() => readDfuSaveInfo('{"saveName":"x"}'), /not a SaveInfo_v1/);
  // The map's keys are the walk's UPPERCASE names; a text arrives as text or bytes.
  const asBytes = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, new TextEncoder().encode(v)]));
  assert.equal(readDfuSave(0, asBytes).info.characterName, 'Tester');
});

test('DFUSAVE1: the folder walk - a SAVE<n> segment of any index, the roster case-folded, ModData_*, and no SaveInfo means no save', async () => {
  assert.deepEqual(dfuSaveSlot('Saves/SAVE12/SaveData.txt'), { index: 12, name: 'SAVEDATA.TXT', folder: 'Saves/SAVE12' });
  assert.deepEqual(dfuSaveSlot('x/save3/mod_foo.dfmod.txt'), { index: 3, name: 'MOD_FOO.DFMOD.TXT', folder: 'x/save3' });
  assert.deepEqual(dfuSaveSlot('SAVE0/bio.txt'), { index: 0, name: 'BIO.TXT', folder: 'SAVE0' });
  assert.equal(dfuSaveSlot('SAVE1/other.txt'), null, 'a name off the roster');
  assert.equal(dfuSaveSlot('Saves/SAVE1/sub/SaveData.txt'), null, 'a file must sit directly in the slot');
  assert.equal(dfuSaveSlot('Backup/SaveData.txt'), null);
  assert.equal(dfuSaveSlot('SAVETREE.DAT'), null);
  const f = (p) => ({ webkitRelativePath: p, arrayBuffer: async () => new TextEncoder().encode(p).buffer });
  const saves = collectDfuSaveFiles([
    f('Saves/SAVE0/SaveInfo.txt'), f('Saves/SAVE0/SaveData.txt'), f('Saves/SAVE0/Screenshot.jpg'),
    f('Saves/SAVE7/SaveData.txt'),                                      // no SaveInfo -> not a save (:751)
    { name: 'SAVE2/SaveInfo.txt', arrayBuffer: async () => new ArrayBuffer(0) },   // a bare name works too
    f('Saves/Backup/MAPS.BSA'),
    f('Saves_backup/SAVE0/SaveInfo.txt'), f('Saves_backup/SAVE0/SaveData.txt'),   // a SECOND SAVE0 under another parent: a second save, never merged (AUDIT-DFUSAVE R2)
  ]);
  assert.deepEqual(saves.map((e) => [e.index, e.folder]), [[0, 'Saves/SAVE0'], [0, 'Saves_backup/SAVE0'], [2, 'SAVE2']], 'one entry per FOLDER, index order then folder order');
  assert.deepEqual(Object.keys(saves[0].files).sort(), ['SAVEDATA.TXT', 'SAVEINFO.TXT', 'SCREENSHOT.JPG']);
  assert.equal(saves[1].files['SAVEDATA.TXT'].webkitRelativePath, 'Saves_backup/SAVE0/SaveData.txt', 'the backup\'s own file, not the live one\'s');
  const loaded = await loadDfuSaveFiles(saves[0].files);
  assert.equal(loaded['SAVEINFO.TXT'], 'Saves/SAVE0/SaveInfo.txt', 'a .txt arrives as text');
  assert.ok(loaded['SCREENSHOT.JPG'] instanceof Uint8Array, 'the screenshot as bytes');
});

test('DFUSAVE1: OT1\'s phone path - only the roster under a SAVE<n> segment inflates from the zip, in the collector\'s shape', async () => {
  let picked = null;
  const readZipEntries = async (_file, { pick }) => {
    picked = pick(['Saves/SAVE1/SaveInfo.txt', 'Saves/SAVE1/SaveData.txt', 'Saves/SAVE1/notes.txt', 'arena2/MAPS.BSA', 'Saves/SAVE4/mod_X.txt']);
    return picked.map((name) => ({ name, data: Uint8Array.of(name.length) }));
  };
  const files = await dfuSaveFilesFromZip(readZipEntries, {});
  assert.deepEqual(picked, ['Saves/SAVE1/SaveInfo.txt', 'Saves/SAVE1/SaveData.txt', 'Saves/SAVE4/mod_X.txt']);
  assert.deepEqual(files.map((x) => x.webkitRelativePath), picked);
  assert.deepEqual(new Uint8Array(await files[0].arrayBuffer()), Uint8Array.of('Saves/SAVE1/SaveInfo.txt'.length));
  const saves = collectDfuSaveFiles(files);
  assert.deepEqual(saves.map((e) => e.index), [1], 'SAVE4 has no SaveInfo and drops');
});

// -------------------------------------------------------------- the source

const SLM = 'Assets/Scripts/Game/Serialization/SaveLoadManager.cs';
test('DFUSAVE1: the roster and the version ARE SaveLoadManager.cs\'s (regenerated from the reference clone)', { skip: missingDfu(SLM) && 'no DFU checkout (DFU_PATH)' }, () => {
  const cs = readFileSync(dfuFile(SLM), 'utf8');
  const names = [...cs.matchAll(/const string \w*[Ff]ile[Nn]ame = "([^"]+)";/g)].map((m) => m[1]);
  assert.ok(names.length >= 12, `the constants block: ${names.length}`);
  for (const n of names) assert.ok(DFU_SAVE_FILES.has(n.toUpperCase()), `${n} is on the port's roster`);
  assert.equal(DFU_SAVE_FILES.size, names.length, 'and nothing on the roster is not in DFU');
  assert.equal(Number(/const int latestSaveVersion = (\d+);/.exec(cs)[1]), DFU_LATEST_SAVE_VERSION);
  assert.match(cs, /Path\.Combine\(directory, saveInfoFilename\)/, 'a folder is a save only WITH SaveInfo.txt');
  assert.equal(DFU_SAVE_INFO, 'SaveInfo.txt'); assert.equal(DFU_SAVE_DATA, 'SaveData.txt');
  assert.equal(DFU_BIO_FILE, 'bio.txt'); assert.equal(DFU_SCREENSHOT, 'Screenshot.jpg');
  assert.match(cs, new RegExp(`string\\.Format\\("${DFU_MOD_DATA_PREFIX}\\{0\\}\\.txt", mod\\.FileName\\)`), 'the mod data name is mod_<file>.txt');
});

// ---------------------------------------------------------- real corpus

const SAVES = process.env.DFU_SAVES_PATH;
const realSaves = [];
if (SAVES && existsSync(SAVES)) {
  for (const entry of readdirSync(SAVES)) {
    if (/^SAVE\d+$/i.test(entry) && existsSync(join(SAVES, entry, 'SaveInfo.txt'))) realSaves.push(join(SAVES, entry));
  }
}
test('corpus: every real DFU save opens - the info, the header, the player, the envelope rules hold', { skip: realSaves.length === 0 && 'no DFU Saves folder (DFU_SAVES_PATH) - real-save validation skipped' }, () => {
  for (const dir of realSaves) {
    const files = {};
    for (const f of readdirSync(dir)) {
      const up = f.toUpperCase();
      if (!DFU_SAVE_FILES.has(up) && !/^MOD_.+\.TXT$/.test(up)) continue;
      files[up] = up === 'SCREENSHOT.JPG' ? new Uint8Array(readFileSync(join(dir, f))) : readFileSync(join(dir, f), 'utf8');
    }
    const s = readDfuSave(Number(/\d+$/.exec(dir)[0]), files);
    assert.ok(s.info.saveVersion <= DFU_LATEST_SAVE_VERSION, dir);
    assert.equal(typeof s.saveData.header.description, 'string', dir);
    assert.equal(typeof s.saveData.playerData.playerEntity.name, 'string', dir);
    assert.equal(typeof s.saveData.dateAndTime.gameTime, 'number', `${dir}: gameTime under 2^53`);
    const text = JSON.stringify(s.saveData);
    assert.ok(!/"\$(content|version|id|ref)"/.test(text), `${dir}: no envelope key survives the door`);
  }
});
