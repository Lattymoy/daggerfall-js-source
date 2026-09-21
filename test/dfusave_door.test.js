// DFUSAVE3 (2026-09-20) - the import door (systems/dfuSaveDoor.js and
// the start menu's picker, scenes/menu.js): a picked Daggerfall Unity
// Saves folder becomes port SLOTS, one per SAVE<n>, listed and loaded by
// the ordinary Load window from then on. Driven over an in-memory
// storage with DFU-shaped fixtures; the picker's DOM is pinned at the
// source, as the classic picker's is.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importDfuSaves, importSummary, bytesToDataUrl } from '../src/systems/dfuSaveDoor.js';
import { buildDfuSaveFiles } from './dfuSaveFixture.mjs';
import { enumerateSaves, loadSlot, restorableSlot, screenshotOf, saveInfoOf, SAVE_DATA_PREFIX } from '../src/systems/saveSlots.js';
import { SAVE_VERSION } from '../src/systems/save.js';
import { BUILD_TAG } from '../src/buildTag.js';
import { collectDfuSaveFiles } from '../src/formats/dfuSave.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');

function mockStorage() {
  const m = new Map();
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    _map: m,
  };
}

/** The collector's shape over fixture files: file-likes with arrayBuffer(). */
function collected(index, files, folder = `Saves/SAVE${index}`) {
  const out = {};
  for (const [name, text] of Object.entries(files)) {
    const bytes = typeof text === 'string' ? new TextEncoder().encode(text) : text;
    out[name] = { name, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  }
  return [{ index, folder, files: out }];
}
/** SaveInfo_v1.dateAndTime.realTime is DateTime.Ticks: 100ns intervals since 0001-01-01T00:00:00Z (DateTime.MinValue). The fixture's 638000000000000000 is 22:13:20 into 2022-09-28. */
const FIXTURE_REAL_MS = 638000000000000000 / 1e4 - 62135596800000;

test('DFUSAVE3: a DFU save becomes a port slot - the envelope, the card (name, character, the clock in classic minutes, the build), the screenshot as a data URL', async () => {
  const storage = mockStorage();
  const files = buildDfuSaveFiles({ name: 'Ysolda', bio: 'Born at sea.\n' });
  files['SCREENSHOT.JPG'] = Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 1, 2, 3);
  const results = await importDfuSaves(collected(3, files), { storage, now: 777 });
  assert.equal(results.length, 1);
  const r = results[0];
  assert.equal(r.ok, true); assert.equal(r.index, 3); assert.equal(r.folder, 'Saves/SAVE3'); assert.equal(r.characterName, 'Ysolda'); assert.equal(r.saveName, 'Quick'); assert.equal(r.error, null);
  assert.ok(r.key >= 0, 'a slot key');
  const { info, characterSaves } = enumerateSaves(storage);
  assert.deepEqual([...characterSaves.keys()], ['Ysolda']);
  // the card's realTime is the SAVE's own (DFU's DateTime ticks, converted), so the Load window orders and dates it as DFU did - not the import's clock (AUDIT-DFUSAVE R4)
  assert.deepEqual(info.get(r.key), { saveVersion: SAVE_VERSION, saveName: 'Quick', characterName: 'Ysolda', dateAndTime: { gameTime: 523530 + 120, realTime: FIXTURE_REAL_MS }, dfuVersion: BUILD_TAG });
  // the .NET epoch constant checked against JS's own calendar (Date.UTC maps years 0-99 to 1900+, so set the year explicitly)
  const dotnetEpoch = new Date(0); dotnetEpoch.setUTCFullYear(1, 0, 1); dotnetEpoch.setUTCHours(0, 0, 0, 0);
  assert.equal(-dotnetEpoch.getTime(), 62135596800000);
  assert.equal(new Date(FIXTURE_REAL_MS).toISOString(), '2022-09-28T22:13:20.000Z');
  const snap = loadSlot(r.key, storage);
  assert.equal(snap.v, SAVE_VERSION); assert.equal(snap.name, 'Ysolda'); assert.deepEqual(snap.backStory, ['Born at sea.']);
  assert.ok(restorableSlot(r.key, storage), 'this build can restore it (the F2 law)');
  assert.equal(screenshotOf(r.key, storage), 'data:image/jpeg;base64,' + Buffer.from(files['SCREENSHOT.JPG']).toString('base64'));
  assert.equal(saveInfoOf(r.key, storage).characterName, 'Ysolda');
});

test('DFUSAVE3: several slots import in index order into free keys, a broken one is reported and skipped, and the summary says what came over and what did not', async () => {
  const storage = mockStorage();
  const saves = [
    ...collected(0, buildDfuSaveFiles({ name: 'A', modInfoData: [{ title: 'Roads', fileName: 'roads.dfmod' }] })),
    ...collected(2, { 'SAVEINFO.TXT': '{"saveVersion":1,"saveName":"x","characterName":"C"}', 'SAVEDATA.TXT': 'not json' }),
    ...collected(5, buildDfuSaveFiles({ name: 'B', worldContext: 'Dungeon', insideDungeon: true })),
  ];
  const results = await importDfuSaves(saves, { storage, now: 1 });
  assert.deepEqual(results.map((r) => [r.index, r.ok]), [[0, true], [2, false], [5, true]]);
  assert.match(results[1].error, /JSON|token|Unexpected/i);
  assert.equal(results[0].key, 0); assert.equal(results[2].key, 1, 'the next free key, not the DFU index');
  assert.deepEqual(results[0].warnings, ['mod "Roads" was loaded; its own saved state does not come over']);
  assert.ok(results[2].warnings.includes('the save was made inside a dungeon: you start outside it'));
  const s = importSummary(results);
  assert.match(s, /^imported 2 Daggerfall Unity saves: A - Quick; B - Quick\. 1 could not be read: Saves\/SAVE2 \(/, 'the FOLDER is named - two SAVE2s under two parents are two saves');
  assert.match(s, /not carried: mod "Roads" was loaded; its own saved state does not come over; the save was made inside a dungeon: you start outside it$/);
  assert.equal(importSummary([]), '');
  // a second import of the same character+name OVERWRITES its slot (saveSlot's own identity law)
  const again = await importDfuSaves(collected(0, buildDfuSaveFiles({ name: 'A', level: 9 })), { storage, now: 2 });
  assert.equal(again[0].key, 0); assert.equal(loadSlot(0, storage).level, 9);
  assert.equal(storage._map.size, 4, 'still two slots (data + info each, no screenshots) - the broken SAVE2 never wrote one');
});

test('DFUSAVE3: the pre-loaded arm and the storage-less arm', async () => {
  const files = buildDfuSaveFiles({ name: 'D' });
  const results = await importDfuSaves([{ index: 1, files }], { storage: mockStorage(), now: 1, loaded: true });
  assert.equal(results[0].ok, true); assert.equal(results[0].folder, 'SAVE1');
  const none = await importDfuSaves([{ index: 1, files }], { storage: null, now: 1, loaded: true });
  assert.equal(none[0].ok, false); assert.equal(none[0].error, 'the slot could not be written');
  assert.equal(bytesToDataUrl(Uint8Array.of(1, 2, 3), 'image/png'), 'data:image/png;base64,AQID');
  const big = new Uint8Array(70000).fill(65);
  assert.equal(bytesToDataUrl(big).length, 'data:image/jpeg;base64,'.length + Math.ceil(70000 / 3) * 4, 'a chunked encode of a JPEG-sized buffer');
});

test('DFUSAVE3: the picker is ONE door for both formats, and an import ends in the slot window', () => {
  const menu = rd('src/scenes/menu.js');
  assert.match(menu, /import \{ collectDfuSaveFiles, dfuSaveFilesFromZip \} from '\.\.\/formats\/dfuSave\.js';/);
  assert.match(menu, /import \{ importDfuSaves, importSummary \} from '\.\.\/systems\/dfuSaveDoor\.js';/);
  assert.match(menu, /const dfu = collectDfuSaveFiles\(files\);\s*const saves = collectClassicSaveFiles\(files\);/, 'BOTH collectors walk the same pick (AUDIT-DFUSAVE R3)');
  assert.match(menu, /imported = await importDfuSaves\(dfu\);/);
  assert.match(menu, /msg\.textContent = importSummary\(imported\);/, 'the player reads what came over');
  assert.match(menu, /if \(!indexes\.length\) \{\s*if \(imported\.some\(\(r\) => r\.ok\)\) setTimeout\(\(\) => finish\(\{ imported \}\), 1500\);\s*return;\s*\}/, 'with no classic saves beside them the import ends the picker');
  assert.match(menu, /Object\.defineProperty\(saves, 'imported', \{ value: imported, enumerable: false \}\)/, 'with classic saves too, the classic list still opens, the import already done');
  assert.match(menu, /if \(saves\.imported && !Object\.keys\(saves\)\.length\) \{ status\('daggerfall unity saves imported'\); return 'imported'; \}/);
  assert.match(menu, /const entries = \[\.\.\.e\.dataTransfer\.items\]\.map\(\(item\) => item\.webkitGetAsEntry\?\.\(\)\)\.filter\(Boolean\);/, 'the drop harvests every entry before the first await (AUDIT-DFUSAVE R5)');
  assert.match(menu, /catch \(err\) \{ msg\.textContent = `drop failed: \$\{err\.message\}`; \}/, 'and a failed drop says so');
  assert.match(menu, /let closed = false;\s*const finish = \(result\) => \{ if \(closed\) return; closed = true;/, 'the overlay resolves once');
  assert.match(menu, /if \(r === 'imported'\) \{[\s\S]*?const key = await runSaveLoadWindow\(canvas, renderer, status\);[\s\S]*?_pickedLoadKey = key; resolved = 'load';/, 'the slot window opens over the imported saves and a pick boots the ordinary load arm');
  assert.match(menu, /dfuSaveFilesFromZip\(readZipEntries, f\)/g, 'OT1\'s zip arm feeds both collectors');
  assert.equal((menu.match(/dfuSaveFilesFromZip\(readZipEntries, f\)/g) || []).length, 2, 'the zip input and the drop');
  assert.match(menu, /Load Classic or Daggerfall Unity Save/);
  // the door is the ONE importer of the converter
  const importers = [];
  const walk = (d) => { for (const f of readdirSyncSafe(join(ROOT, d))) { const p = join(d, f); if (f.endsWith('.js') && /dfuSaveToSnapshot\(/.test(rd(p))) importers.push(p); else if (!f.includes('.')) walk(p); } };
  walk('src');
  assert.deepEqual(importers.sort(), ['src/systems/dfuSaveDoor.js', 'src/systems/dfuSaveImport.js']);
  // the collector drops a folder without SaveInfo; the door never sees it
  assert.deepEqual(collectDfuSaveFiles([{ webkitRelativePath: 'Saves/SAVE4/SaveData.txt', arrayBuffer: async () => new ArrayBuffer(0) }]), []);
  assert.equal(SAVE_DATA_PREFIX, 'dagger.save.');
});

import { readdirSync } from 'node:fs';
function readdirSyncSafe(d) { try { return readdirSync(d); } catch { return []; } }
