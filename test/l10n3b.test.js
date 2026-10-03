// L10N3b (2026-09-27, Mac: "Install + bundle allowed"): A DFU TRANSLATION PACK, INSTALLED FROM THE PLAYER'S OWN FILES.
// What a pack holds, by the folders DFU reads it from (systems/translationPacks.js); the store that keeps it in the
// browser and nowhere else (scenes/translationStore.js, over an in-memory IndexedDB); and the language loader putting
// it to use (scenes/localeData.js) - its tables patched over the machine drafts, so a person's translation outranks a
// machine's, its quests', books' and name banks' text kept for their readers, its fonts registered as DFU's are; a
// removal that leaves the drafts standing; and the Settings row, by source.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as tm from '../src/systems/textManager.js';
import { classifyPackFile, packContents, isTranslationPack, packNameOf, PACK_KIND } from '../src/systems/translationPacks.js';
import * as store from '../src/scenes/translationStore.js';
import * as data from '../src/scenes/localeData.js';
import { _resetForTests as resetPrefs } from '../src/systems/uiPrefs.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

/** An IndexedDB in memory: open with its upgrade, transactions over named stores, get/put/delete/getAll/getAllKeys
 *  answering on the next turn, a transaction completing after its requests. */
function memoryIdb() {
  const dbs = new Map();
  const later = (fn) => setTimeout(fn, 0);
  return {
    open(name) {
      const req = {};
      later(() => {
        let db = dbs.get(name);
        const fresh = !db;
        if (fresh) {
          const stores = new Map();
          db = {
            stores,
            objectStoreNames: { contains: (n) => stores.has(n) },
            createObjectStore: (n) => { stores.set(n, new Map()); },
            transaction(names) {
              const tx = { pending: 0 };
              const settle = () => { if (--tx.pending === 0) later(() => tx.oncomplete?.()); };
              const request = (fn) => { const r = {}; tx.pending++; later(() => { r.result = fn(); r.onsuccess?.(); settle(); }); return r; };
              tx.objectStore = (n) => {
                const map = stores.get(n);
                return {
                  get: (k) => request(() => map.get(k)),
                  put: (v, k) => request(() => { map.set(k, structuredClone(v)); }),
                  delete: (k) => request(() => { map.delete(k); }),
                  getAll: () => request(() => [...map.values()]),
                  getAllKeys: () => request(() => [...map.keys()]),
                };
              };
              later(() => { if (tx.pending === 0) tx.oncomplete?.(); });
              void names;
              return tx;
            },
          };
          dbs.set(name, db);
        }
        req.result = db;
        if (fresh) req.onupgradeneeded?.();
        req.onsuccess?.();
      });
      return req;
    },
  };
}

beforeEach(() => {
  tm._resetTextManagerForTests();
  resetPrefs();
  store._resetTranslationStoreForTests();
  globalThis.indexedDB = memoryIdb();
  data._useLocaleFilesForTests({ '../../locales/fr/Port_Strings.csv': async () => rd('locales/fr/Port_Strings.csv') });
});

/** A pack as a folder pick hands it: each path, and its bytes. */
const entries = (files) => Object.entries(files).map(([path, v]) => ({ path, read: async () => (typeof v === 'string' ? new TextEncoder().encode(v) : v) }));
const FRENCH = {
  'French files for DFU 1.2/Text/Internal_Strings.csv': '\uFEFFKey,Value\nsaveGame,Sauvegarder la partie\nthingJustDied,%s vient de mourir.\n',
  'French files for DFU 1.2/Text/Internal_RSC.csv': 'Key,Value\n7333,"%di d\'ici[/record]par là, %di"\n',
  'French files for DFU 1.2/Text/Quests/S0000977-LOC.txt': '\uFEFFQuest: S0000977\nDisplayName: La malédiction de Daggerfall\nQRC:\n',
  'French files for DFU 1.2/Text/Books/BOK00000-LOC.txt': 'Title: Le Premier Parchemin de Baan Dar\n',
  'French files for DFU 1.2/Text/NameGen.txt': '{"Breton":{}}',
  'French files for DFU 1.2/Text/MainMenu.txt': 'schema: *key,text\nplay, Jouer\n',
  'French files for DFU 1.2/Fonts/FONT0003-SDF.ttf': new Uint8Array([0, 1, 0, 0]),
  'French files for DFU 1.2/README.md': '# not text the game reads',
  'Tools for DFU/translate_locations.pl': 'perl',
};

test('L10N3b what a pack holds: each file by the folder DFU reads it from - the last Text or Fonts on its path, any case, either slash - and the rest left; one file a kind and name; the pack\'s name off its folder', () => {
  assert.deepEqual(classifyPackFile('French files for DFU 1.2/Text/Internal_RSC.csv'), { kind: PACK_KIND.TABLE, name: 'Internal_RSC' });
  assert.deepEqual(classifyPackFile('x\\StreamingAssets\\Text\\Quests\\s0000977-loc.TXT'), { kind: PACK_KIND.QUEST, name: 'S0000977' });
  assert.deepEqual(classifyPackFile('Text/Books/BOK00000-LOC.txt'), { kind: PACK_KIND.BOOK, name: 'BOK00000' });
  assert.deepEqual(classifyPackFile('p/Text/NameGen.txt'), { kind: PACK_KIND.NAMEGEN, name: 'NameGen' });
  assert.deepEqual(classifyPackFile('p/Text/MainMenu.txt'), { kind: PACK_KIND.TEXT_TABLE, name: 'MainMenu' });
  assert.deepEqual(classifyPackFile('p/fonts/font0003-sdf.otf'), { kind: PACK_KIND.FONT, name: 'FONT0003' });
  assert.deepEqual(classifyPackFile('p/Fonts/FONT0003-SDF.txt'), { kind: PACK_KIND.FONT_CHARS, name: 'FONT0003' });
  assert.deepEqual(classifyPackFile('Text/Français/Text/Internal_RSC.csv'), { kind: PACK_KIND.TABLE, name: 'Internal_RSC' }, 'the LAST Text on the path is the one DFU reads');
  for (const p of ['p/Fonts/FONT0005-SDF.ttf', 'p/Text/Quests/S0000977.txt', 'p/Text/Quests/deep/X-LOC.txt', 'p/README.md', 'Text', 'p/Text/a b.csv', 'p/Textures/Img/X.png', '']) assert.equal(classifyPackFile(p), null, p);
  const { files, counts } = packContents([...Object.keys(FRENCH), 'Other/Text/Internal_Strings.csv']);
  assert.deepEqual(counts, { table: 2, quest: 1, book: 1, nameGen: 1, textTable: 1, font: 1, fontChars: 0 });
  assert.equal(files.find((f) => f.kind === PACK_KIND.TABLE && f.name === 'Internal_Strings').path, 'Other/Text/Internal_Strings.csv', 'a later path of the same kind and name replaces the earlier');
  assert.equal(isTranslationPack(counts), true);
  assert.equal(isTranslationPack(packContents(['p/Fonts/FONT0003-SDF.ttf', 'p/Text/NameGen.txt']).counts), false, 'fonts and name banks alone are no translation');
  assert.equal(packNameOf(Object.keys(FRENCH)), 'French files for DFU 1.2');
  assert.equal(packNameOf(['Mod/StreamingAssets/Text/Internal_RSC.csv']), 'Mod', 'a StreamingAssets tree names its own folder');
  assert.equal(packNameOf(['Text/Internal_RSC.csv'], 'pack.zip'), 'pack.zip');
});

test('L10N3b the store: only the files the game reads are kept, text decoded and a font kept as bytes; a pack replaces its language\'s last; anything not a translation is refused and changes nothing; a removal takes the files and the record', async () => {
  const rec = await store.installPack('fr', entries(FRENCH));
  assert.equal(rec.name, 'French files for DFU 1.2');
  assert.deepEqual(rec.counts, { table: 2, quest: 1, book: 1, nameGen: 1, textTable: 1, font: 1, fontChars: 0 });
  const files = await store.packFiles('fr');
  assert.equal(files.length, 7, 'the README and the tools are left');
  assert.equal(files.find((f) => f.kind === 'quest').data.slice(0, 7), 'Quest: ', 'text decoded as UTF-8, the BOM stripped as a StreamReader strips it');
  assert.ok(files.find((f) => f.kind === 'font').data instanceof Uint8Array, 'a font kept as bytes');
  assert.deepEqual([...(await store.installedPacks()).keys()], ['fr']);
  await store.installPack('de', entries({ 'DE/Text/Internal_Strings.csv': 'Key,Value\nsaveGame,Speichern\n' }));
  assert.deepEqual((await store.packFiles('de')).map((f) => f.name), ['Internal_Strings'], 'a language\'s files, and no other language\'s');
  assert.equal((await store.packFiles('fr')).length, 7);
  await store.removePack('de');
  await store.installPack('fr', entries({ 'Mine/Text/Internal_Strings.csv': 'Key,Value\nsaveGame,Sauver\n' }), { name: 'Mine' });
  assert.equal((await store.packFiles('fr')).length, 1, 'the new pack replaces the old one whole');
  assert.equal((await store.installedPacks()).get('fr').name, 'Mine');
  await assert.rejects(store.installPack('fr', entries({ 'x/README.md': 'hi', 'x/Fonts/FONT0003-SDF.ttf': new Uint8Array(4) })), /no string table, quest or book/);
  assert.equal((await store.installedPacks()).get('fr').name, 'Mine', 'a refused pick changes nothing');
  assert.equal(await store.removePack('fr'), true);
  assert.deepEqual([...(await store.installedPacks()).keys()], []);
  assert.deepEqual(await store.packFiles('fr'), []);
  assert.equal(await store.removePack('fr'), false);
  delete globalThis.indexedDB;
  store._resetTranslationStoreForTests();
  assert.deepEqual([...(await store.installedPacks()).keys()], [], 'no IndexedDB: nothing installed, and no throw');
  assert.deepEqual(await store.packFiles('fr'), []);
});

test('L10N3b the pack at work: its tables over the machine drafts (a person\'s word outranks a machine\'s), its other text for the readers that ask, pt-BR reading pt\'s pack, the language told the pack is there; removed, the drafts stand again; no FontFace, no font - the language\'s own face stands', async () => {
  const draft = tm.parseStringTableCsv(rd('locales/fr/Port_Strings.csv'));
  const draftWord = new Map(draft).get('menu.rail.new');
  await data.initLocale(new URLSearchParams('lang=fr'), { languages: [] });
  assert.equal(tm.currentLocale(), 'fr');
  assert.equal(tm.localeInfo('fr').pack, null);
  const packed = { ...FRENCH, 'French files for DFU 1.2/Text/Port_Strings.csv': 'Key,Value\nmenu.rail.new,"Nouvelle aventure"\n' };
  const rec = await data.installTranslationPack('fr', entries(packed));
  assert.equal(rec.counts.table, 3);
  assert.equal(tm.t('menu.rail.new', 'New Game'), 'Nouvelle aventure', 'the pack\'s word over the draft\'s');
  assert.equal(tm.t('menu.rail.load', 'Load Game'), new Map(draft).get('menu.rail.load'), 'a key the pack lacks keeps its draft');
  assert.equal(tm.getLocalizedText('saveGame'), 'Sauvegarder la partie', 'Internal_Strings, BOM and all');
  assert.equal(tm.tryGetLocalizedText(tm.TextCollections.TextRSC, '7333'), '%di d\'ici[/record]par là, %di');
  assert.match(data.localePackText(PACK_KIND.QUEST, 'S0000977'), /La malédiction de Daggerfall/);
  assert.match(data.localePackText(PACK_KIND.BOOK, 'BOK00000'), /Baan Dar/);
  assert.equal(data.localePackText(PACK_KIND.NAMEGEN, 'NameGen'), '{"Breton":{}}');
  assert.equal(data.localePackText(PACK_KIND.QUEST, 'S0000001'), null);
  assert.equal(tm.localeInfo('fr').pack.name, 'French files for DFU 1.2', 'the language row\'s record');
  assert.equal(data.installedPackFor('fr').counts.quest, 1);
  assert.equal(tm.getLocalizedFont('FONT0003'), null, 'no FontFace under node: the pack\'s font is not registered (the language\'s own face stands)');
  tm.setLocale('en');
  assert.equal(data.localePackText(PACK_KIND.QUEST, 'S0000977'), null, 'English reads no pack');
  tm.setLocale('fr');
  assert.equal(await data.removeTranslationPack('fr'), true);
  assert.equal(tm.t('menu.rail.new', 'New Game'), draftWord, 'the draft stands again');
  assert.equal(tm.tryGetLocalizedText(tm.TextCollections.Internal, 'saveGame'), undefined, 'and the pack\'s tables are gone');
  assert.equal(data.localePackText(PACK_KIND.QUEST, 'S0000977'), null);
  assert.equal(tm.localeInfo('fr').pack, null);
  await data.installTranslationPack('pt-BR', entries({ 'Adaga/Text/Internal_Strings.csv': 'Key,Value\nsaveGame,Salvar jogo\n' }));
  await data.switchLocale('pt-BR');
  assert.equal(tm.getLocalizedText('saveGame'), 'Salvar jogo');
  // a pack stored for a shorter tag lies beneath the language's own, as its tables do (pt beneath pt-BR)
  await store.installPack('pt', entries({ 'PT/Text/Quests/S0000977-LOC.txt': 'Quest: S0000977\nDisplayName: A maldição\n' }));
  await data.refreshPacks();
  await data.reloadLocaleText('pt');
  assert.match(data.localePackText(PACK_KIND.QUEST, 'S0000977'), /A maldição/, 'pt-BR reads pt\'s pack text through its chain');
  await assert.rejects(data.installTranslationPack('en', entries(FRENCH)), /not a language a pack can be installed for/);
  await assert.rejects(data.installTranslationPack('qps-ploc', entries(FRENCH)), /not a language/);
});

test('L10N3b the pack\'s font, where a browser can load it: registered for its language and font as RegisterLocalizedFont registers one, ahead of the language\'s own face', async () => {
  const loaded = [];
  globalThis.FontFace = class { constructor(family, bytes) { this.family = family; this.bytes = bytes; } async load() { loaded.push(this.family); return this; } };
  const was = globalThis.OffscreenCanvas;
  globalThis.OffscreenCanvas = function (w, h) { const ctx = { font: '', measureText: () => ({ width: 10 }), fillText() {}, getImageData: () => ({ data: new Uint8ClampedArray(w * h * 4) }) }; return { width: w, height: h, getContext: () => ctx }; };
  try {
    await data.installTranslationPack('fr', entries(FRENCH));
    await data.switchLocale('fr');
    assert.deepEqual(loaded, ['dfu-pack-fr-FONT0003']);
    assert.equal(tm.getLocalizedFont('FONT0003').family, '"dfu-pack-fr-FONT0003"', 'the pack\'s face, not the system fonts\'');
    assert.match(tm.getLocalizedFont('FONT0000').family, /Segoe UI/, 'a font the pack did not bring keeps the language\'s own face');
  } finally {
    delete globalThis.FontFace;
    if (was === undefined) delete globalThis.OffscreenCanvas; else globalThis.OffscreenCanvas = was;
  }
});

test('L10N3b by source: the pack row under the language row on the front door alone, none for English; the picker reads a folder or a zip through the one classifier', () => {
  const menu = rd('src/ui/enhancedMenu.js');
  assert.match(menu, /if \(!pause\) \{ const packRow = translationPackRow\(\); if \(packRow\) out\.push\(packRow\); \}/);
  assert.match(menu, /if \(!info \|\| cur === BASE_LOCALE \|\| info\.hidden\) return null;/, 'English has no pack: English is the game\'s own');
  const ds = rd('src/scenes/dataSource.js');
  assert.match(ds, /zip: \(name\) => !!classifyPackFile\(name\),/, 'a zip inflates only what the game reads');
  assert.match(ds, /const record = await installTranslationPack\(code, packEntriesFromFiles\(files\)\);/);
  const ld = rd('src/scenes/localeData.js');
  assert.match(ld, /\.then\(\(\) => applyPack\(tag\)\)/, 'the pack after the drafts');
  assert.match(ld, /_packs = await packStore\.installedPacks\(\);   \/\/ L10N3b: before anything is registered/);
});
