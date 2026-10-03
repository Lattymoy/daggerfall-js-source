// L10N1b (2026-09-27, Mac: "for as many languages as we possibly can and do this right"): THE LANGUAGE SETTING. The
// catalog of languages the port offers and its pure laws (the saved choice resolved, the browser's own list matched,
// a build path read), the English catalog read off the source and in step with it, every language's draft file held
// to the English one (DFU's format, every key, every argument, every pattern readable), the rail's English unchanged
// through `t`, the boot's language laws run over files fed off the disk (scenes/localeData.js), and the boot's order,
// the menu's language row and the first-run offer by source (tools/languageProbe.mjs drives them in a browser).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import * as tm from '../src/systems/textManager.js';
import { LOCALE_CATALOG, catalogLocale, localeFileOf, resolveLocale, localeForBrowser } from '../src/systems/localeCatalog.js';
import { extractPortStrings, catalogCsv, CATALOG_PATH, PORT_KEY } from '../tools/l10nExtract.mjs';
import { PREF_DEFAULTS, getPref, setPref, _resetForTests as resetPrefs } from '../src/systems/uiPrefs.js';
import * as data from '../src/scenes/localeData.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const exists = (p) => existsSync(new URL('../' + p, import.meta.url));
beforeEach(() => { tm._resetTextManagerForTests(); resetPrefs(); });

/** Every argument a pattern names, in order of first use. */
function argNames(pattern) {
  const out = [];
  const walk = (nodes) => { for (const n of nodes) if (typeof n === 'object' && n.arg) { if (!out.includes(n.arg)) out.push(n.arg); if (n.options) for (const b of n.options.values()) walk(b); } };
  walk(tm.parseMessage(pattern));
  return out.sort();
}

test('L10N1b catalog: every language once, by a well-formed tag, its own name and its English one, a script and a source; English first and the port\'s own; the rest by English name; the pseudo-locale hidden and last', () => {
  const codes = LOCALE_CATALOG.map((l) => l.code);
  assert.equal(new Set(codes).size, codes.length);
  for (const l of LOCALE_CATALOG) {
    assert.match(l.code, /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?$|^qps-ploc$/, `${l.code} is a BCP 47 tag`);
    assert.ok(l.name && l.englishName && l.script, `${l.code} is described`);
    assert.equal(l.dir, 'ltr', 'the right-to-left scripts wait for L10N7');
  }
  assert.equal(LOCALE_CATALOG[0].code, 'en');
  assert.equal(LOCALE_CATALOG[0].source, 'base');
  const middle = LOCALE_CATALOG.slice(1, -1);
  assert.deepEqual(middle.map((l) => l.englishName), [...middle.map((l) => l.englishName)].sort(), 'by English name');
  assert.ok(middle.every((l) => l.source === 'machine'), 'every language is Claude\'s draft until a human one lands');
  const pseudo = LOCALE_CATALOG.at(-1);
  assert.equal(pseudo.code, tm.PSEUDO_LOCALE);
  assert.equal(pseudo.hidden, true);
  assert.ok(LOCALE_CATALOG.length >= 26, 'as many as the port can offer');
  assert.equal(catalogLocale('fr').name, 'Français');
  assert.equal(catalogLocale('xx'), null);
});

test('L10N1b the pure laws: a saved choice resolves to itself only when the catalog knows it and its text is present; the browser\'s list is matched exact, folded, then by language - and a browser that reads English first is offered nothing; a build path names its locale and table', () => {
  assert.equal(resolveLocale('fr'), 'fr');
  assert.equal(resolveLocale('fr', () => false), 'en', 'no text, no French');
  assert.equal(resolveLocale('xx'), 'en');
  assert.equal(resolveLocale(null), 'en');
  assert.equal(localeForBrowser(['fr-CA', 'en']), 'fr');
  assert.equal(localeForBrowser(['en-US', 'fr']), null);
  assert.equal(localeForBrowser(['zh-TW']), 'zh-Hant');
  assert.equal(localeForBrowser(['zh-HK']), 'zh-Hant');
  assert.equal(localeForBrowser(['zh-Hant-SG']), 'zh-Hant');
  assert.equal(localeForBrowser(['zh-CN']), 'zh-Hans');
  assert.equal(localeForBrowser(['zh']), 'zh-Hans');
  assert.equal(localeForBrowser(['nn-NO']), 'nb');
  assert.equal(localeForBrowser(['no']), 'nb');
  assert.equal(localeForBrowser(['pt-PT']), 'pt-BR');
  assert.equal(localeForBrowser(['pt-BR']), 'pt-BR');
  assert.equal(localeForBrowser(['xx', 'de-AT']), 'de');
  assert.equal(localeForBrowser(['de'], (c) => c !== 'de'), null, 'a language without text is not offered');
  assert.equal(localeForBrowser(['qps-ploc']), null, 'nor the pseudo-locale');
  assert.equal(localeForBrowser([]), null);
  assert.deepEqual(localeFileOf('../../locales/pt-BR/Port_Strings.csv'), { code: 'pt-BR', table: 'Port_Strings' });
  assert.deepEqual(localeFileOf('/src/../locales/fr/Internal_RSC.csv'), { code: 'fr', table: 'Internal_RSC' });
  assert.equal(localeFileOf('locales/fr/README.md'), null);
  assert.equal(localeFileOf('vendor/x/Port_Strings.csv'), null);
});

test('L10N1b the English catalog is read off the source and in step with it: every call a literal dotted key and a literal English the ICU subset reads, one English a key', () => {
  const { strings, problems } = extractPortStrings();
  assert.deepEqual(problems, []);
  assert.ok(strings.size >= 20);
  assert.equal(rd(CATALOG_PATH), catalogCsv(strings), 'locales/en/Port_Strings.csv is not what the source says - node tools/l10nExtract.mjs');
  for (const k of strings.keys()) assert.match(k, PORT_KEY);
  assert.equal(strings.get('menu.rail.new').en, 'New Game');
  assert.equal(strings.get('lang.offer').en, 'Play in English?', 'tIn\'s key is read too');
});

test('L10N1b every language\'s file: DFU\'s format as the port writes it, the English catalog\'s keys exactly, every value a readable pattern naming the English\'s arguments - and every visible catalog language has one, and no folder is outside the catalog', () => {
  const en = new Map(tm.parseStringTableCsv(rd(CATALOG_PATH)));
  const dirs = readdirSync(new URL('../locales/', import.meta.url), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  for (const d of dirs) assert.ok(catalogLocale(d), `locales/${d} is not a catalog language`);
  for (const l of LOCALE_CATALOG.filter((x) => x.source === 'machine')) {
    const path = `locales/${l.code}/Port_Strings.csv`;
    assert.ok(exists(path), `${l.code} has no ${path}`);
    const text = rd(path);
    const rows = tm.parseStringTableCsv(text);
    assert.equal(tm.formatStringTableCsv(rows), text, `${path} is in the port's own form (the writer's)`);
    const map = new Map(rows);
    assert.deepEqual([...map.keys()].sort(), [...en.keys()].sort(), `${l.code} covers the catalog`);
    for (const [k, v] of map) {
      assert.ok(v.trim(), `${l.code} ${k} is empty`);
      assert.doesNotThrow(() => tm.parseMessage(v), `${l.code} ${k} is not a readable pattern`);
      assert.deepEqual(argNames(v), argNames(en.get(k)), `${l.code} ${k} names other arguments than the English`);
    }
  }
});

test('L10N1b executed: a language\'s file patched in speaks through t(); tIn asks in another language while English stands; the rail\'s English reads back as itself', () => {
  tm.patchLocaleTable('fr', 'Port_Strings', tm.loadStringTableCsv(rd('locales/fr/Port_Strings.csv')));
  tm.patchLocaleTable('ja', 'Port_Strings', tm.loadStringTableCsv(rd('locales/ja/Port_Strings.csv')));
  assert.equal(tm.t('menu.rail.new', 'New Game'), 'New Game', 'English stands');
  assert.equal(tm.tIn('ja', 'lang.offer', 'Play in English?'), '日本語でプレイしますか？', 'the offer, in the language it offers');
  tm.setLocale('fr');
  assert.equal(tm.t('menu.rail.new', 'New Game'), 'Nouvelle partie');
  assert.equal(tm.t('settings.language.name', 'Language'), 'Langue');
  // the menu's own table, read off its source: each entry's English is the label whose id it answers
  const menu = rd('src/ui/enhancedMenu.js');
  const entries = [...menu.matchAll(/^ {2}(\w+): \(\) => t\('menu\.rail\.(\w+)', '([^']+)'\),$/gm)];
  assert.equal(entries.length, 13);
  const labels = new Set();
  for (const m of menu.matchAll(/^const SECTIONS_(?:BOOT|CLASSIC|PAUSE) = \[([^\]]+)\];/gm)) for (const q of m[1].matchAll(/'([^']+)'/g)) labels.add(q[1]);
  const idOf = (label) => label.toLowerCase().split(' ')[0];
  for (const label of labels) {
    const e = entries.find((m) => m[1] === idOf(label));
    assert.ok(e, `the rail's ${label} has a translation entry`);
    assert.equal(e[3], label, `${label} reads back as itself in English`);
    assert.equal(e[2], e[1], `${label}'s key is its id`);
  }
});

test('L10N1b the boot, run: the saved choice, ?lang= for one visit, only the chosen language\'s chain fetched and each file once, English never fetched, a language without text is English, the offer\'s language fetched while English stands and never once answered, and a failed load forgotten with English left standing', async () => {
  const calls = [];
  let jaFails = false;
  const glob = {
    '../../locales/fr/Port_Strings.csv': async () => { calls.push('fr'); return rd('locales/fr/Port_Strings.csv'); },
    '../../locales/ja/Port_Strings.csv': async () => { calls.push('ja'); if (jaFails) throw new Error('offline'); return rd('locales/ja/Port_Strings.csv'); },
    '../../locales/pt-BR/Port_Strings.csv': async () => { calls.push('pt-BR'); return 'Key,Value\nmenu.rail.new,"Novo jogo"\n'; },
    '../../locales/pt/Port_Strings.csv': async () => { calls.push('pt'); return 'Key,Value\nmenu.rail.new,"Jogo novo"\nmenu.rail.load,"Carregar jogo"\n'; },
    '../../locales/en/Port_Strings.csv': async () => { calls.push('en'); throw new Error('English is the code\'s'); },
    '../../locales/fr/README.md': async () => { calls.push('readme'); return ''; },
  };
  const fresh = () => { tm._resetTextManagerForTests(); resetPrefs(); data._useLocaleFilesForTests(glob); calls.length = 0; jaFails = false; };
  const q = (s) => new URLSearchParams(s);

  fresh();
  assert.deepEqual([data.hasLocaleText('fr'), data.hasLocaleText('pt-BR'), data.hasLocaleText('de'), data.hasLocaleText('en'), data.hasLocaleText('qps-ploc')], [true, true, false, true, true]);
  setPref('language', 'fr');
  assert.equal(await data.initLocale(q(''), { languages: ['de-DE'] }), 'fr', 'the saved choice');
  assert.equal(tm.currentLocale(), 'fr');
  assert.equal(tm.t('menu.rail.new', 'New Game'), 'Nouvelle partie');
  assert.equal(await data.switchLocale('fr'), 'fr');
  assert.deepEqual(calls, ['fr'], 'only French, and once');
  assert.ok(tm.availableLocales().some((l) => l.code === 'fr') && !tm.availableLocales().some((l) => l.code === 'de'), 'the languages the build holds, registered');

  fresh();
  assert.equal(await data.initLocale(q('lang=fr'), { languages: ['ja'] }), 'fr', '?lang=');
  assert.equal(getPref('language'), 'en', 'for one visit: the choice is not written');
  assert.deepEqual(calls, ['fr'], 'and nothing offered under ?lang=');

  fresh();
  assert.equal(await data.switchLocale('pt-BR'), 'pt-BR');
  assert.deepEqual([...calls].sort(), ['pt', 'pt-BR'], 'the chain: pt-BR, then pt');
  assert.equal(tm.t('menu.rail.new', 'New Game'), 'Novo jogo', 'the tag\'s own word first');
  assert.equal(tm.t('menu.rail.load', 'Load Game'), 'Carregar jogo', 'then the shorter tag\'s');
  assert.equal(await data.switchLocale('de'), 'en', 'no text, no German');
  assert.equal(tm.currentLocale(), 'en');

  fresh();
  assert.equal(await data.initLocale(q(''), { languages: ['ja-JP', 'en'] }), 'en', 'English stands until the player answers');
  assert.deepEqual(calls, ['ja'], 'the offer\'s language fetched, so the offer can ask in it');
  assert.equal(tm.localeTable('ja', 'Port_Strings')?.get('lang.offer'), '日本語でプレイしますか？');
  fresh();
  setPref('languageOffered', true);
  assert.equal(await data.initLocale(q(''), { languages: ['ja-JP'] }), 'en');
  assert.deepEqual(calls, [], 'answered once, never fetched again');
  fresh();
  assert.equal(await data.initLocale(q('lang=en'), { languages: ['ja-JP'] }), 'en');
  assert.equal(await data.initLocale(q(''), { languages: ['en-GB', 'ja'] }), 'en');
  assert.deepEqual(calls, [], 'nothing offered under ?lang=, nor to a reader of English');
  fresh();
  jaFails = true;
  assert.equal(await data.initLocale(q(''), { languages: ['ja'] }), 'en', 'an offer that fails to load is only a warning');

  fresh();
  await data.switchLocale('fr');
  jaFails = true;
  setPref('language', 'ja');
  assert.equal(await data.initLocale(q('')), 'en', 'a language that fails to load leaves English standing');
  assert.equal(tm.currentLocale(), 'en', 'English, not the language that stood before');
  jaFails = false;
  assert.equal(await data.switchLocale('ja'), 'ja', 'the failed load was forgotten');
  assert.deepEqual(calls.filter((c) => c === 'ja').length, 2, 'and fetched again');
  assert.ok(!calls.includes('en') && !calls.includes('readme'), 'English and a non-table file never fetched');

  const html = {};
  globalThis.document = { documentElement: html };
  try {
    data.applyDocumentLanguage('ja');
    assert.deepEqual(html, { lang: 'ja', dir: 'ltr' });
    data.applyDocumentLanguage('qps-ploc');
    assert.equal(html.lang, 'en', 'the pseudo-locale reads as English');
  } finally { delete globalThis.document; }
  data._useLocaleFilesForTests({});
});

test('L10N1b by source: the boot loads the language behind a door before every other door, the prefs carry the choice, the menu routes both rails, offers the language row on the front door alone and the first-run offer on its boot face', () => {
  const main = rd('src/main.js');
  const boot = main.indexOf('async function boot()');
  const lang = main.indexOf("await import('./scenes/localeData.js').then(({ initLocale }) => initLocale(params))");
  assert.ok(lang > boot, 'the boot loads the language');
  for (const door of ["if (params.has('music')", "if (params.has('interior'))", "if (params.has('world'))", 'runCinematicFrontDoor(']) {
    const at = main.indexOf(door, boot);
    assert.ok(at > lang, `the language is in before ${door}`);
  }
  assert.doesNotMatch(main, /^import .*localeData/m, 'behind a door - BOOT2\'s ceiling on the entry\'s static graph');
  assert.equal(PREF_DEFAULTS.language, 'en');
  assert.equal(PREF_DEFAULTS.languageOffered, false);
  const menu = rd('src/ui/enhancedMenu.js');
  assert.match(menu, /document\.createTextNode\(railLabel\(label\)\)/, 'the front door\'s buttons');
  assert.match(menu, /b\.append\(el\('span', 'rk', railLabel\(label\)\)\);/, 'the shell rail');
  assert.match(menu, /if \(!pause\) out\.push\(languageRow\(\)\);/, 'the language row on the front door alone');
  assert.match(menu, /const offer = languageOffer\(\);\n\s+if \(offer\) home\.append\(offer\);/, 'the offer on the boot face');
  assert.match(menu, /if \(!code \|\| !localeTable\(code, 'Port_Strings'\)\?\.has\('lang\.offer'\)\) return null;/, 'never an offer in English');
  assert.match(menu, /if \(!offer && !accountOpen && !accountOffered && !signedIn\(\)\) \{ accountOffered = true; accountOpen = true; \}/, 'the account window waits while the language is asked (tools/languageProbe.mjs found it covering the offer)');
  assert.doesNotMatch(menu, /^import .*localeData/m, 'the menu loads the browser-only module behind a door (node tests import the menu)');
  const data = rd('src/scenes/localeData.js');
  assert.match(data, /import\.meta\.glob\('\.\.\/\.\.\/locales\/\*\/\*\.csv', \{ query: '\?raw', import: 'default' \}\)/, 'every file its own lazy chunk');
  assert.match(data, /if \(!f \|\| f\.code === BASE_LOCALE\) continue;/, 'English is the code\'s, never loaded');
  assert.match(data, /setLocale\(BASE_LOCALE\);\n\s+applyDocumentLanguage\(BASE_LOCALE\);\n\s+return BASE_LOCALE;/, 'a failure leaves English standing');
});

test('L10N1b the writer: every file the port writes reads back through DFU\'s parser unchanged, and what the parser cannot hold is refused', () => {
  const rows = [['a.b', 'He said "hi", then left.\nNext line'], ['c.d', '{n, plural, one {# x} other {# xs}}'], ['e.f', 'plain']];
  assert.deepEqual(tm.parseStringTableCsv(tm.formatStringTableCsv(rows)), rows);
  assert.throws(() => tm.formatStringTableCsv([['a,b', 'x']]), /cannot hold/);
  assert.throws(() => tm.formatStringTableCsv([['a"b', 'x']]), /cannot hold/);
  assert.throws(() => tm.formatStringTableCsv([['a.b', '\nleading']]), /line break/);
  assert.throws(() => tm.formatStringTableCsv([['a.b', 'trailing\n']]), /line break/);
});
