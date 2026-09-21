// SP1 (2026-09-21, a player: "my saves its all gone"; Mac: "we need
// parity between browser and the install"): SAVES MOVE BETWEEN THE
// WEBSITE AND THE APP. The carrier is pure over a storage-shaped object
// and a list of entries, so the round trip runs here: export to the
// app's own on-disk layout as one STORED zip, read it back with the
// port's own zip reader, import into an empty store, and every byte of
// every slot is where it was.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { slotsOf, exportEntries, exportSavesZip, zipStore, crc32, base64ToBytes, bytesToBase64, shotToFile, fileToShot, slotPathOf, collectSlots, importSlots,
  TRANSFER_SHOT_FILES, TRANSFER_DATA_FILE, TRANSFER_INFO_FILE, TRANSFER_DIR, TRANSFER_ZIP_NAME } from '../src/systems/saveTransfer.js';
import { readZipEntries } from '../src/scenes/dataSource.js';
import { SAVE_DATA_PREFIX, SAVE_INFO_PREFIX, SAVE_SHOT_PREFIX, enumerateSaves } from '../src/systems/saveSlots.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
/** localStorage's shape over a Map */
const memStore = () => { const m = new Map(); return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, _m: m }; };
const jpegBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 72, 0, 72, 0, 0, 0xFF, 0xD9]);
const card = (characterName, saveName, gameTime) => JSON.stringify({ saveVersion: 1, saveName, characterName, dateAndTime: { gameTime, realTime: 1700000000000 }, dfuVersion: 'test' });
const seed = (st) => {
  st.setItem(SAVE_DATA_PREFIX + 0, JSON.stringify({ v: 1, name: 'Aela', classicMinutes: 5000, position: [1, 2, 3] }));
  st.setItem(SAVE_INFO_PREFIX + 0, card('Aela', 'QuickSave', 5000));
  st.setItem(SAVE_SHOT_PREFIX + 0, `data:image/jpeg;base64,${bytesToBase64(jpegBytes)}`);
  st.setItem(SAVE_DATA_PREFIX + 3, JSON.stringify({ v: 1, name: 'Borin', classicMinutes: 9000 }));
  st.setItem(SAVE_INFO_PREFIX + 3, card('Borin', 'Before the crypt', 9000));
  st.setItem(SAVE_SHOT_PREFIX + 3, 'data:image/webp;base64,AAAA');   // a shot in a MIME the layout has no honest name for
  st.setItem('dagger.save.7', JSON.stringify({ v: 1 }));   // data with NO card: not a slot
  st.setItem('prefs', '{"x":1}');
};

test('SP1: the bytes - base64 both ways, the CRC, and a STORED zip the port’s own reader opens', async () => {
  for (const n of [0, 1, 2, 3, 4, 5, 22, 100]) {
    const b = new Uint8Array(n).map((_, i) => (i * 37 + 11) & 255);
    assert.deepEqual([...base64ToBytes(bytesToBase64(b))], [...b], `${n} bytes round-trip`);
    assert.equal(bytesToBase64(b), Buffer.from(b).toString('base64'), 'and it is the base64 every browser writes');
  }
  assert.equal(crc32(new TextEncoder().encode('abc')).toString(16), '352441c2');
  assert.equal(crc32(new Uint8Array(0)), 0);
  const zip = zipStore([{ name: 'a/b.txt', data: new TextEncoder().encode('hello') }, { name: 'c.bin', data: jpegBytes }]);
  const back = await readZipEntries(new Blob([zip]));
  assert.deepEqual(back.map((e) => e.name), ['a/b.txt', 'c.bin']);
  assert.equal(new TextDecoder().decode(back[0].data), 'hello');
  assert.deepEqual([...new Uint8Array(back[1].data)], [...jpegBytes]);
  assert.equal(zip[7], 0x08, 'general-purpose flag bit 11: the names are UTF-8');
});

test('SP1: the layout is the app’s own - the three spellings, the two files, the folder', () => {
  const fsrc = read('app/lib/fileStorage.cjs');
  for (const [name, mime] of TRANSFER_SHOT_FILES) assert.ok(fsrc.includes(`['${name}', ${mime ? `'${mime}'` : 'null'}]`), `fileStorage.cjs spells ${name}`);
  assert.ok(fsrc.includes(`const DATA_FILE = '${TRANSFER_DATA_FILE}';`) && fsrc.includes(`const INFO_FILE = '${TRANSFER_INFO_FILE}';`) && fsrc.includes(`const SAVES_DIR = '${TRANSFER_DIR}';`));
  assert.deepEqual(shotToFile(`data:image/jpeg;base64,${bytesToBase64(jpegBytes)}`), { name: 'Screenshot.jpg', data: jpegBytes }, 'a jpeg data URL is the jpeg’s own bytes');
  assert.equal(shotToFile('data:image/png;base64,AAAA').name, 'Screenshot.png');
  const odd = shotToFile('data:image/webp;base64,AAAA');
  assert.equal(odd.name, 'Screenshot.dataurl'); assert.equal(new TextDecoder().decode(odd.data), 'data:image/webp;base64,AAAA', 'anything else is kept verbatim, as the app keeps it');
  assert.equal(shotToFile(null), null);
  assert.equal(fileToShot('Screenshot.jpg', jpegBytes), `data:image/jpeg;base64,${bytesToBase64(jpegBytes)}`);
  assert.equal(fileToShot('Screenshot.dataurl', new TextEncoder().encode('data:x')), 'data:x');
  assert.equal(fileToShot('Screenshot.gif', jpegBytes), null);
  assert.deepEqual(slotPathOf('Saves/SAVE3/SaveData.txt'), { n: 3, file: 'SaveData.txt' });
  assert.deepEqual(slotPathOf('SAVE12/Screenshot.jpg'), { n: 12, file: 'Screenshot.jpg' });
  assert.deepEqual(slotPathOf('Roaming/Daggerfall Enhanced/Saves/SAVE0/SaveInfo.txt'), { n: 0, file: 'SaveInfo.txt' }, 'a whole userData folder can be picked, however deep the save sits in it');
  assert.equal(slotPathOf('Saves/SAVE03/SaveData.txt'), null, 'a hand-spelt slot number is not a slot (the app’s own law)');
  assert.equal(slotPathOf('Saves/README.txt'), null);
  assert.equal(TRANSFER_ZIP_NAME, 'DaggerfallEnhanced-Saves.zip');
});

test('SP1: the round trip - export a store, read the zip back, import into an empty store, every slot where it was', async () => {
  const a = memStore(); seed(a);
  assert.deepEqual(slotsOf(a).map((s) => s.key), [0, 3], 'slots are cards with data; data without a card is not one');
  const entries = exportEntries(a);
  assert.deepEqual(entries.map((e) => e.name), ['Saves/SAVE0/SaveData.txt', 'Saves/SAVE0/SaveInfo.txt', 'Saves/SAVE0/Screenshot.jpg', 'Saves/SAVE3/SaveData.txt', 'Saves/SAVE3/SaveInfo.txt', 'Saves/SAVE3/Screenshot.dataurl']);
  const zip = exportSavesZip(a);
  const back = await readZipEntries(new Blob([zip]));
  const slots = collectSlots(back);
  assert.deepEqual(slots.map((s) => s.n), [0, 3]);
  const b = memStore();
  const r = importSlots(slots, b);
  assert.deepEqual(r, { imported: [0, 3], skipped: 0, failed: 0 });
  for (const k of [SAVE_DATA_PREFIX + 0, SAVE_INFO_PREFIX + 0, SAVE_SHOT_PREFIX + 0, SAVE_DATA_PREFIX + 3, SAVE_INFO_PREFIX + 3, SAVE_SHOT_PREFIX + 3]) assert.equal(b.getItem(k), a.getItem(k), `${k} byte for byte`);
  assert.equal(b.getItem('dagger.save.7'), null, 'the cardless data did not travel'); assert.equal(b.getItem('prefs'), null, 'nor did anything but saves');
  assert.deepEqual([...enumerateSaves(b).info.keys()].sort(), [0, 3], 'the slot store enumerates them as its own');
  assert.equal(exportSavesZip(memStore()), null, 'an empty store exports nothing');
});

test('SP1: import never overwrites - a taken number moves to the first free one, a save already held is skipped, a card that fails stays out', () => {
  const src = memStore(); seed(src);
  const slots = collectSlots(exportEntries(src));
  const dst = memStore();
  dst.setItem(SAVE_DATA_PREFIX + 0, JSON.stringify({ v: 1, name: 'Cato' })); dst.setItem(SAVE_INFO_PREFIX + 0, card('Cato', 'QuickSave', 42));
  const r = importSlots(slots, dst);
  assert.deepEqual(r, { imported: [1, 3], skipped: 0, failed: 0 }, 'Aela’s slot 0 is taken by Cato, so it lands at 1; Borin keeps his 3');
  assert.equal(dst.getItem(SAVE_INFO_PREFIX + 0), card('Cato', 'QuickSave', 42), 'Cato untouched');
  assert.equal(dst.getItem(SAVE_INFO_PREFIX + 1), card('Aela', 'QuickSave', 5000));
  const again = importSlots(slots, dst);
  assert.deepEqual(again, { imported: [], skipped: 2, failed: 0 }, 'the same zip a second time doubles nothing');
  // a card that will not parse is not a slot; a store that throws on write leaves no half slot
  const junk = collectSlots([{ name: 'SAVE5/SaveData.txt', data: new TextEncoder().encode('{"v":1}') }, { name: 'SAVE5/SaveInfo.txt', data: new TextEncoder().encode('{not json') }]);
  assert.equal(junk.length, 0);
  const full = memStore(); let writes = 0;
  const throwing = { ...full, get length() { return full.length; }, setItem: (k, v) => { if (++writes > 1) throw new Error('quota'); full.setItem(k, v); } };
  const r2 = importSlots(slots.slice(0, 1), throwing);
  assert.deepEqual(r2, { imported: [], skipped: 0, failed: 1 });
  assert.equal(full.getItem(SAVE_DATA_PREFIX + 0), null, 'the data written before the throw is taken back - a slot is real only with its card');
  assert.equal(full.getItem(SAVE_INFO_PREFIX + 0), null, 'and no card landed before the data, or a half slot would enumerate');
});

test('SP1: the doors - the Load pane carries Export and both Imports, on the title and the pause menu alike', () => {
  const menu = read('src/ui/enhancedMenu.js');
  const pane = menu.slice(menu.indexOf('function paneLoad(body) {'), menu.indexOf('function transferCard('));
  assert.ok(pane.includes('body.append(transferCard(saves.length));'), 'the card rides the Load pane, after the slots');
  const cardSrc = menu.slice(menu.indexOf('function transferCard('), menu.indexOf('// ── SAVE GAME (pause only)'));
  assert.ok(cardSrc.includes("exportSavesZip(appStorage())") && cardSrc.includes("a.download = TRANSFER_ZIP_NAME;"), 'Export downloads the store’s zip under the one name');
  assert.ok(cardSrc.includes("readZipEntries(f, { pick: (names) => names.filter((n) => slotPathOf(n)) })"), 'a zip import inflates only the save files');
  assert.ok(cardSrc.includes('entriesFromFiles([...(dirIn.files ?? [])])') && cardSrc.includes("dirIn.setAttribute('webkitdirectory', '')"), 'a folder import walks a picked Saves folder');
  assert.ok(cardSrc.includes('importSlots(slots, appStorage())'), 'both write into the store under this build - the browser’s on the site, the file store in the app');
  assert.ok(cardSrc.includes('shell?.savesPath'), 'the app names where its files are');
  assert.ok(!cardSrc.includes('deleteSave') && !cardSrc.includes('removeItem'), 'the card deletes nothing');
});
