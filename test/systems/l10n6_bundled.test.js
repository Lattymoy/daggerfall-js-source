// L10N6 (2026-10-03, Mac: "build it, bundle nothing"): A PACK THE TREE BUNDLES, AT WORK. Where an author's terms allow
// it, `locales/<tag>/pack/` holds their Daggerfall Unity pack as a player would install it (tools/l10nPack.mjs checks
// what it must carry). The language loader (scenes/localeData.js) lays it over the machine drafts and beneath a pack the
// player installs: drafts < bundled < installed, table by table and document by document - the player's own choice is
// the last word, a person's translation outranks a machine's. A bundled pack alone offers its language; a folder with no
// PACK.json is no pack (nothing credits it, so nothing loads it); English has none.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as tm from '../../src/systems/textManager.js';
import { PACK_KIND } from '../../src/systems/translationPacks.js';
import * as store from '../../src/scenes/translationStore.js';
import * as data from '../../src/scenes/localeData.js';
import { _resetForTests as resetPrefs } from '../../src/systems/uiPrefs.js';
import { memoryIdb } from '../memoryIdb.mjs';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const DRAFTS = { '../../locales/fr/Port_Strings.csv': async () => rd('locales/fr/Port_Strings.csv') };
const META = { name: 'Fichiers français', authors: ['A. Traducteur'], source: 'https://example.org/fr', license: 'CC-BY-4.0', terms: 'bundling allowed with credit (2026-10-01)' };
const BUNDLED = {
  text: {
    '../../locales/fr/pack/Text/Port_Strings.csv': async () => 'Key,Value\nmenu.rail.new,Partie neuve\nmenu.rail.load,Charger une aventure\n',
    '../../locales/fr/pack/Text/Internal_Strings.csv': async () => '﻿Key,Value\nsaveGame,Enregistrer\n',
    '../../locales/fr/pack/Text/Quests/S0000977-LOC.txt': async () => 'Quest: S0000977\nDisplayName: La malédiction (fournie)\n',
    '../../locales/fr/pack/Text/Books/BOK00000-LOC.txt': async () => 'Title: Le Premier Parchemin (fourni)\n',
    '../../locales/fr/pack/Textures/X.csv': async () => 'not text the game reads',
    '../../locales/de/pack/Text/Internal_Strings.csv': async () => 'Key,Value\nsaveGame,Speichern\n',
    '../../locales/it/pack/Text/Internal_Strings.csv': async () => 'Key,Value\nsaveGame,Salva\n',
    '../../locales/en/pack/Text/Internal_Strings.csv': async () => 'Key,Value\nsaveGame,Keep\n',
  },
  fonts: { '../../locales/fr/pack/Fonts/FONT0003-SDF.ttf': async () => '/assets/FONT0003-SDF.ttf' },
  meta: {
    '../../locales/fr/pack/PACK.json': META,
    '../../locales/de/pack/PACK.json': { ...META, name: 'Deutsche Dateien' },
    '../../locales/en/pack/PACK.json': { ...META, name: 'English?' },
  },
};

beforeEach(() => {
  tm._resetTextManagerForTests();
  resetPrefs();
  store._resetTranslationStoreForTests();
  globalThis.indexedDB = memoryIdb();
  data._useLocaleFilesForTests(DRAFTS, BUNDLED);
});

const entries = (files) => Object.entries(files).map(([path, v]) => ({ path, read: async () => new TextEncoder().encode(v) }));

test('L10N6 what the tree bundles: a pack by its PACK.json, each file by the folder DFU reads it from, a font only from the font glob; no PACK.json, no pack; English none', () => {
  const packs = data.indexBundledPacks(BUNDLED);
  assert.deepEqual([...packs.keys()], ['fr', 'de'], 'it has no PACK.json, and English is the game\'s own');
  const fr = packs.get('fr');
  assert.equal(fr.meta.name, 'Fichiers français');
  assert.deepEqual(fr.files.map((f) => `${f.kind}:${f.name}:${f.font}`), ['table:Port_Strings:false', 'table:Internal_Strings:false', 'quest:S0000977:false', 'book:BOK00000:false', 'font:FONT0003:true'], 'Textures/ is left');
  assert.deepEqual(data.indexBundledPacks({ text: { '../../locales/fr/pack/Fonts/FONT0003-SDF.ttf': async () => '' }, meta: { '../../locales/fr/pack/PACK.json': META } }).get('fr').files, [], 'a font read as text is no font');
  assert.equal(data.indexBundledPacks({ meta: { '../../locales/fr/pack/PACK.json': null } }).size, 0, 'a PACK.json that says nothing');
  assert.deepEqual(data.indexBundledPacks().size, 0);
  assert.equal(data.bundledPackFor('fr').license, 'CC-BY-4.0');
  assert.equal(data.bundledPackFor('it'), null);
  assert.equal(data.hasLocaleText('de'), true, 'a bundled pack alone offers its language');
  assert.equal(data.hasLocaleText('it'), false);
});

test('L10N6 drafts < bundled < installed: the bundled pack over the machine drafts, the player\'s pack over both, its documents too; the player\'s removed, the bundled pack stands again; a bundled language with no drafts loads its pack', async () => {
  const draft = new Map(tm.parseStringTableCsv(rd('locales/fr/Port_Strings.csv')));
  const fetched = [], wasFetch = globalThis.fetch;
  globalThis.fetch = async (url) => { fetched.push(url); return { arrayBuffer: async () => new ArrayBuffer(4) }; };
  try { await data.initLocale(new URLSearchParams('lang=fr'), { languages: [] }); } finally { globalThis.fetch = wasFetch; }
  assert.equal(tm.currentLocale(), 'fr');
  assert.deepEqual(fetched, [], 'no FontFace, no font fetched');
  assert.equal(tm.localeInfo('fr').bundled.name, 'Fichiers français', 'the language row\'s record of what the build bundles');
  assert.equal(tm.localeInfo('fr').pack, null);
  assert.equal(tm.t('menu.rail.new', 'New Game'), 'Partie neuve', 'the bundled pack\'s word over the draft\'s');
  assert.equal(tm.t('menu.rail.load', 'Load Game'), 'Charger une aventure');
  assert.equal(tm.t('menu.rail.about', 'About'), draft.get('menu.rail.about'), 'a key the pack lacks keeps its draft');
  assert.equal(tm.getLocalizedText('saveGame'), 'Enregistrer');
  assert.match(data.localePackText(PACK_KIND.QUEST, 'S0000977'), /fournie/);
  assert.match(data.localePackText(PACK_KIND.BOOK, 'BOK00000'), /fourni/);

  await data.installTranslationPack('fr', entries({
    'Mine/Text/Port_Strings.csv': 'Key,Value\nmenu.rail.new,À moi\n',
    'Mine/Text/Quests/S0000977-LOC.txt': 'Quest: S0000977\nDisplayName: La mienne\n',
  }));
  assert.equal(tm.t('menu.rail.new', 'New Game'), 'À moi', 'the player\'s pack over the bundled one');
  assert.equal(tm.t('menu.rail.load', 'Load Game'), 'Charger une aventure', 'a row the player\'s pack lacks keeps the bundled pack\'s');
  assert.equal(tm.getLocalizedText('saveGame'), 'Enregistrer', 'and a table it lacks');
  assert.match(data.localePackText(PACK_KIND.QUEST, 'S0000977'), /La mienne/, 'its documents over the bundled pack\'s');
  assert.match(data.localePackText(PACK_KIND.BOOK, 'BOK00000'), /fourni/, 'a document it lacks keeps the bundled pack\'s');
  assert.equal(tm.localeInfo('fr').pack.name, 'Mine');
  assert.equal(tm.localeInfo('fr').bundled.name, 'Fichiers français', 'both records stand');

  await data.removeTranslationPack('fr');
  assert.equal(tm.t('menu.rail.new', 'New Game'), 'Partie neuve', 'the bundled pack stands again, not the draft');
  assert.match(data.localePackText(PACK_KIND.QUEST, 'S0000977'), /fournie/);

  assert.equal(await data.switchLocale('de'), 'de', 'German has no drafts here, only its bundled pack');
  assert.equal(tm.getLocalizedText('saveGame'), 'Speichern');
  assert.equal(await data.switchLocale('it'), 'en', 'a pack folder with no PACK.json offers nothing');
});

test('L10N6 a bundled pack\'s font, where a browser can load it: its bytes fetched from the build\'s URL and registered for its language, ahead of the language\'s own face', async () => {
  const loaded = [], fetched = [];
  globalThis.FontFace = class { constructor(family, bytes) { this.family = family; this.bytes = bytes; } async load() { loaded.push([this.family, this.bytes.byteLength]); return this; } };
  const wasCanvas = globalThis.OffscreenCanvas, wasFetch = globalThis.fetch;
  globalThis.OffscreenCanvas = function (w, h) { const ctx = { font: '', measureText: () => ({ width: 10 }), fillText() {}, getImageData: () => ({ data: new Uint8ClampedArray(w * h * 4) }) }; return { width: w, height: h, getContext: () => ctx }; };
  globalThis.fetch = async (url) => { fetched.push(url); return { arrayBuffer: async () => new ArrayBuffer(4) }; };
  try {
    await data.switchLocale('fr');
    assert.deepEqual(fetched, ['/assets/FONT0003-SDF.ttf']);
    assert.deepEqual(loaded, [['dfu-pack-fr-FONT0003', 4]]);
    assert.equal(tm.getLocalizedFont('FONT0003').family, '"dfu-pack-fr-FONT0003"');
    assert.match(tm.getLocalizedFont('FONT0000').family, /Segoe UI/, 'a font the pack did not bring keeps the language\'s own face');
    tm._resetTextManagerForTests();
    data._useLocaleFilesForTests(DRAFTS, BUNDLED);
    globalThis.fetch = async () => { throw new Error('offline'); };
    assert.equal(await data.switchLocale('fr'), 'fr', 'a font that will not fetch leaves the language standing');
    assert.equal(tm.t('menu.rail.new', 'New Game'), 'Partie neuve', 'its text loaded');
    assert.equal(tm.getLocalizedFont('FONT0003').family, tm.getLocalizedFont('FONT0000').family, 'and its own face, as a font the pack did not bring');
  } finally {
    delete globalThis.FontFace;
    if (wasCanvas === undefined) delete globalThis.OffscreenCanvas; else globalThis.OffscreenCanvas = wasCanvas;
    globalThis.fetch = wasFetch;
  }
});
