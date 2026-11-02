// L10N6 (2026-10-03): THE TRANSLATIONS IN THE CREDITS. Mac's decisions (Localization-Arc.md): the game says which
// languages are machine-translated, a person's translation outranks a draft, and a pack is bundled only on its authors'
// terms. The About pane credits them as it credits the works (ui/credits.js translationCredits): one row a language the
// game holds text for - its own name; Claude's drafts said to be drafts, "checked and corrected by" the people who did
// (`locales/<tag>/translators.json`, read by scenes/localeData.js into the language's record); a bundled pack's name,
// authors, licence, terms and source. English and the pseudo-locale are the game's own and have no row.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import * as tm from '../../src/systems/textManager.js';
import * as store from '../../src/scenes/translationStore.js';
import * as data from '../../src/scenes/localeData.js';
import { translationCredits } from '../../src/ui/credits.js';
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

test('L10N6 a language\'s row: Claude\'s drafts said to be drafts, the people who checked them by name, a bundled pack\'s authors, licence, terms and source; English, the pseudo-locale and a hidden language have none', () => {
  const rows = translationCredits([
    { code: 'en', name: 'English', source: 'machine' },
    { code: 'qps-ploc', name: 'Pseudo', source: 'machine' },
    { code: 'xx', name: 'Hidden', source: 'machine', hidden: true },
    { code: 'fr', name: 'Français', source: 'machine', translators: [], bundled: null },
    { code: 'de', name: 'Deutsch', source: 'machine', translators: ['Anna', 'Bernd'] },
    { code: 'it', name: 'Italiano', source: 'community', translators: ['Carla'], bundled: { ...PACK, name: 'Pacchetto', source: 'a forum post' } },
    { code: 'es', name: 'Español', source: 'community' },
  ]);
  assert.deepEqual(rows.map((r) => r.code), ['fr', 'de', 'it', 'es']);
  const [fr, de, it, es] = rows;
  assert.equal(fr.title, 'Français', 'the language by its own name');
  assert.equal(fr.author, 'Claude (Anthropic)');
  assert.match(fr.what, /Machine translation by Claude, still being checked/);
  assert.equal(fr.terms, undefined);
  assert.equal(fr.link, undefined);
  assert.equal(de.author, 'Anna and Bernd', 'the people who checked it, as the language lists names');
  assert.match(de.what, /Machine translation by Claude, checked and corrected by Anna and Bernd\./);
  assert.equal(it.author, 'A. Traducteur, B. Relecteur, and Carla', 'the pack\'s authors, then the translators');
  assert.match(it.what, /^Translated by Carla\. Daggerfall’s original text is Pacchetto, used with its authors’ permission\.$/);
  assert.equal(it.terms, 'CC-BY-4.0: bundling allowed with credit (2026-10-01)');
  assert.equal(it.link, undefined, 'a source that is no address is no link');
  assert.match(es.what, /Translated by the community/);
  assert.ok(Object.isFrozen(fr));
});

test('L10N6 the translators reach the language\'s record: `locales/<tag>/translators.json` read by the loader, names only, none for English; a bundled pack beside them; the row in the language itself', async () => {
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
  const rows = translationCredits();
  assert.ok(!rows.some((r) => r.code === 'en'));
  const fr = rows.find((r) => r.code === 'fr');
  assert.equal(fr.title, 'Français');
  assert.equal(fr.link, 'https://example.org/fr');
  assert.match(fr.author, /^A\. Traducteur, B\. Relecteur, Chloé et Didier$/, 'listed as French lists names');
  assert.equal(fr.terms, 'CC-BY-4.0\u00a0: bundling allowed with credit (2026-10-01)', 'the pattern in French - its space before the colon (L10N6: the French drafts hold the row)');
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

test('L10N6 by source: the About pane\'s credits render the translations as a third group, after the works and the mods, through the same row renderer - and only when a language is offered', () => {
  const menu = rd('src/ui/enhanced/enhancedMenu.js');
  const fn = menu.slice(menu.indexOf('function creditsCard()'), menu.indexOf('// ── SHELL'));
  assert.match(fn, /group\(t\('menu\.credits\.mods', 'Mods'\), CREDITS\.mods\);\s*\n\s*const languages = translationCredits\(\);[^\n]*\n\s*if \(languages\.length\) group\(t\('menu\.credits\.translations', 'Translations'\), languages\);\s*\n\s*return c;/);
});
