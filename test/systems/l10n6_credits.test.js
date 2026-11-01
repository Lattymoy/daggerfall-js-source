// L10N6 (2026-10-03): THE TRANSLATIONS' RECORD. Mac's decisions (Localization-Arc.md): the game says which languages
// are machine-translated, a person's translation outranks a draft, and a pack is bundled only on its authors' terms.
// CREDITS-OUT (2026-11-01, the owner: "No more credits"): the About pane's translation rows are RETIRED with
// ui/credits.js; what stays is the record - `locales/<tag>/translators.json` and a bundled pack's PACK.json, read by
// scenes/localeData.js into the language's record.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import * as tm from '../../src/systems/textManager.js';
import * as store from '../../src/scenes/translationStore.js';
import * as data from '../../src/scenes/localeData.js';
import { _resetForTests as resetPrefs } from '../../src/systems/uiPrefs.js';
import { memoryIdb } from '../memoryIdb.mjs';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const PACK = { name: 'Fichiers français', authors: ['A. Traducteur', 'B. Relecteur'], source: 'https://example.org/fr', license: 'CC-BY-4.0', terms: 'bundling allowed with credit (2026-10-01)' };

beforeEach(() => {
  tm._resetTextManagerForTests();
  resetPrefs();
  store._resetTranslationStoreForTests();
  globalThis.indexedDB = memoryIdb();
});

test('L10N6 the translators reach the language\'s record: `locales/<tag>/translators.json` read by the loader, names only, none for English; a bundled pack beside them', async () => {
  data._useLocaleFilesForTests({ '../../locales/fr/Port_Strings.csv': async () => rd('locales/fr/Port_Strings.csv'), '../../locales/de/Port_Strings.csv': async () => rd('locales/de/Port_Strings.csv') }, {
    meta: { '../../locales/fr/pack/PACK.json': PACK },
    translators: {
      '../../locales/fr/translators.json': ['  Chloé ', '', 7, 'Didier'],
      '../../locales/de/translators.json': { not: 'a list' },
      '../../locales/en/translators.json': ['Nobody'],
    },
  });
  assert.deepEqual([...data.indexTranslators({ '../../locales/it/translators.json': [] }).keys()], [], 'an empty list credits nobody');
  await data.switchLocale('fr');
  assert.deepEqual(tm.localeInfo('fr').translators, ['Chloé', 'Didier']);
  assert.deepEqual(tm.localeInfo('de').translators, [], 'anything but a list of names is left');
  assert.deepEqual(tm.localeInfo('en').translators, [], 'English is the game\'s own: nobody translated it');
  assert.equal(tm.localeInfo('fr').bundled.name, 'Fichiers français');
  assert.deepEqual([...tm.localeInfo('fr').bundled.authors], ['A. Traducteur', 'B. Relecteur'], 'the pack\'s authors, as its PACK.json records them');
});

test('L10N6 the tree: every `locales/<tag>/translators.json` is a list of names, in a language folder the catalog drafts', () => {
  for (const code of readdirSync(new URL('../../locales/', import.meta.url))) {
    const p = `locales/${code}/translators.json`;
    if (!existsSync(new URL('../../' + p, import.meta.url))) continue;
    const names = JSON.parse(rd(p));
    assert.ok(Array.isArray(names) && names.every((n) => typeof n === 'string' && n.trim()), p);
    assert.notEqual(code, 'en', 'English is the game\'s own');
  }
});

