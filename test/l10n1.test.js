// L10N1 (2026-09-27, the request: "a proper localization/translation integration for our game ... for as many
// languages as we possibly can and do this right"). DFU's text core, ported: TextManager's lookups, lists and name
// helpers, StringTableCSVParser's reader (quirks and all - every DFU translation pack is authored against it),
// StringTablePatcher's merge and the grammar hook; and the port's locales on top - a chain per locale, the constants
// the port holds as the English, its own strings in an ICU MessageFormat subset, and a pseudo-locale. Driven over
// fixtures, the vendored master Internal_RSC.csv, and (when a checkout is present) DFU's own C#.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dfuFile, missingDfu } from './dfuRoot.mjs';
import * as tm from '../src/systems/textManager.js';
import { parseRscCsv, INTERNAL_RSC, parseRscMarkup } from '../src/formats/rscTable.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
beforeEach(() => tm._resetTextManagerForTests());

test('L10N1 CSV: StringTableCSVParser verbatim - the header dropped only when exactly Key,Value, quoted values keep commas, newlines and doubled quotes, an UNQUOTED value is cut at its first comma, keys and values lose \\r\\n at both ends', () => {
  const rows = tm.parseStringTableCsv('Key,Value\nsaveGame,Save Game\nlist,"a\nb, c""d"""\nunq,cut, here\r\ncrlf,value\r\n\r\n,blank key\n');
  assert.deepEqual(rows, [['saveGame', 'Save Game'], ['list', 'a\nb, c"d"'], ['unq', 'cut'], ['crlf', 'value'], ['', 'blank key']]);
  assert.deepEqual(tm.parseStringTableCsv('key,value\na,b'), [['key', 'value'], ['a', 'b']], 'a header in another case is a row');
  assert.deepEqual(tm.parseStringTableCsv('Key,Other\na,b'), [['Key', 'Other'], ['a', 'b']], 'only Key,Value is a header');
  assert.deepEqual(tm.parseStringTableCsv('"quoted,key",v\nk"x,v2\nok,v3'), [['ok', 'v3']], 'a line whose key holds a quote is no row at all - the pattern is anchored at line starts');
  assert.deepEqual(tm.loadStringTableCsv('\uFEFFKey,Value\na,b'), [['a', 'b']], 'the BOM a StreamReader strips, stripped - else the header survived as a row');
  assert.equal(tm.loadStringTableCsv(''), null, 'an empty file is no patch');
  assert.equal(tm.loadStringTableCsv(null), null);
  assert.deepEqual([...tm.loadStringTableDictionary('a,1\nb,2')], [['a', '1'], ['b', '2']]);
  assert.throws(() => tm.loadStringTableDictionary('a,1\na,2'), /same key/, 'Dictionary.Add throws on a second key');
});

test('L10N1 CSV: the vendored master Internal_RSC.csv reads as DFU reads it - 1,448 rows, the named rows kept, the numeric ones the carried table\'s source (parseRscCsv now rides the one CSV law)', () => {
  const text = rd('vendor/dfu-text/Internal_RSC.csv');
  const rows = tm.loadStringTableCsv(text);
  assert.equal(rows.length, 1448);
  assert.equal(rows.filter(([k]) => /^9000\.\d+$/.test(k)).length, 40, 'record 9000 split into 9000.1..9000.40 (a named row, not a record id)');
  const numeric = parseRscCsv(text);
  assert.equal(numeric.size, 1408);
  assert.deepEqual(parseRscMarkup(numeric.get(7333)), [...INTERNAL_RSC[7333]], 'the carried directions row, read through the one law');
  assert.equal(numeric.get(1800), "Changes the spell's icon[/record]", 'a trailing newline trimmed, as DFU trims it');
});

test('L10N1 lookup: GetLocalizedText reads the runtime collection, then the default one, then errors or throws; the flats collection misses into Internal_Strings (DFU\'s switch has no TextFlats default); a runtime redirect is read first', () => {
  tm.patchLocaleTable('en', 'Internal_Strings', [['saveGame', 'Save Game'], ['sharedKey', 'from strings']]);
  tm.patchLocaleTable('en', 'Internal_Flats', [['22400', 'Tavern sign']]);
  assert.equal(tm.getLocalizedText('saveGame'), 'Save Game');
  assert.equal(tm.getLocalizedText('missing'), tm.LOCALIZED_TEXT_LOOKUP_ERROR);
  assert.equal(tm.LOCALIZED_TEXT_LOOKUP_ERROR, '<LocaleText-NotFound>');
  assert.throws(() => tm.getLocalizedText('missing', tm.TextCollections.Internal, true), /collection='Internal', key='missing'/);
  assert.equal(tm.getLocalizedText('22400', tm.TextCollections.TextFlats), 'Tavern sign');
  assert.equal(tm.getLocalizedText('sharedKey', tm.TextCollections.TextFlats), 'from strings', 'a flats miss falls back to Internal_Strings');
  assert.equal(tm.defaultCollectionName(tm.TextCollections.TextFlats), 'Internal_Strings');
  assert.equal(tm.defaultCollectionName(tm.TextCollections.TextRSC), 'Internal_RSC');
  assert.equal(tm.runtimeCollectionName('NoSuchCollection'), 'Internal_Strings', 'an unknown collection is Internal\'s');
  assert.equal(tm.getLocalizedTextWithReversion('missing', tm.TextCollections.Internal, false, 'reverted'), 'reverted');
  assert.equal(tm.getLocalizedTextWithReversion('missing', tm.TextCollections.Internal, false, ''), tm.LOCALIZED_TEXT_LOOKUP_ERROR, 'an EMPTY reversion is no reversion (string.IsNullOrEmpty)');
  tm.patchLocaleTable('en', 'Mod_Strings', [['saveGame', 'Save It']]);
  tm.setRuntimeCollectionName(tm.TextCollections.Internal, 'Mod_Strings');
  assert.equal(tm.getLocalizedText('saveGame'), 'Save It', 'the runtime collection first');
  assert.equal(tm.getLocalizedText('sharedKey'), 'from strings', 'then the default');
  assert.throws(() => tm.setRuntimeCollectionName('Nope', 'X'), /unknown text collection/);
});

test('L10N1 locales: a lookup walks the locale\'s chain - its tag, each shorter tag, then en - and patches lay over what a table holds (StringTablePatcher)', () => {
  assert.deepEqual(tm.localeChain('pt-BR'), ['pt-BR', 'pt', 'en']);
  assert.deepEqual(tm.localeChain('zh-Hant-TW'), ['zh-Hant-TW', 'zh-Hant', 'zh', 'en']);
  assert.deepEqual(tm.localeChain('en'), ['en']);
  tm.patchLocaleTable('pt', 'Internal_Strings', [['saveGame', 'Salvar jogo'], ['loadGame', 'Carregar jogo']]);
  tm.patchLocaleTable('pt-BR', 'Internal_Strings', [['saveGame', 'Salvar partida']]);
  tm.setLocale('pt-BR');
  assert.equal(tm.getLocalizedText('saveGame'), 'Salvar partida', 'the region first');
  assert.equal(tm.getLocalizedText('loadGame'), 'Carregar jogo', 'then the language');
  assert.equal(tm.localizedText('quitGame', 'Quit'), 'Quit', 'then the constant the port holds');
  const table = tm.localeTable('pt', 'Internal_Strings');
  assert.equal(tm.patchStringTable(table, new Map([['loadGame', 'Abrir jogo'], ['newKey', 'Novo']])), 2);
  assert.equal(table.get('loadGame'), 'Abrir jogo', 'an existing entry overwritten');
  assert.equal(table.get('newKey'), 'Novo', 'a new one added');
  assert.equal(tm.localeTable('xx', 'Internal_Strings'), null);
  tm.clearLocaleTables('pt');
  assert.equal(tm.getLocalizedText('loadGame'), tm.LOCALIZED_TEXT_LOOKUP_ERROR);
});

test('L10N1 English is byte-identical: under en the port\'s constants come back untouched - an empty one stays empty - and a table\'s own empty value is still the table\'s word', () => {
  for (const s of ['Save Game', '', "You don't know.", '%pcn, the %ra', '  padded  ', 'a{b}c', '1,000']) assert.equal(tm.localizedText('k', s), s);
  assert.deepEqual(tm.localizedTextList('months', ['Morning Star', 'Sun\'s Dawn']), ['Morning Star', 'Sun\'s Dawn']);
  tm.patchLocaleTable('fr', 'Internal_Strings', [['blank', '']]);
  tm.setLocale('fr');
  assert.equal(tm.localizedText('blank', 'English'), '', 'a pack may blank a string');
});

test('L10N1 lists: GetLocalizedTextList splits on \\r\\n, \\r or \\n after trimming trailing newlines, reads the RUNTIME collection only, throws by default, and its cache is cleared by a switch and by a patch (DFU never clears it)', () => {
  assert.deepEqual(tm.splitTextList('a\r\nb\rc\nd\n\n'), ['a', 'b', 'c', 'd']);
  assert.deepEqual(tm.splitTextList('a\n\nb'), ['a', '', 'b'], 'an inner empty line is an item');
  tm.patchLocaleTable('de', 'Internal_Strings', [['monthNames', 'Morgenstern\nSonnenaufgang\n']]);
  assert.throws(() => tm.getLocalizedTextList('monthNames'), /array text not found/, 'not in en');
  assert.equal(tm.getLocalizedTextList('monthNames', tm.TextCollections.Internal, false), null);
  assert.deepEqual(tm.getLocalizedTextList('monthNames', tm.TextCollections.Internal, false, ['Morning Star']), ['Morning Star'], 'the port\'s English list');
  tm.setLocale('de');
  assert.deepEqual(tm.getLocalizedTextList('monthNames'), ['Morgenstern', 'Sonnenaufgang']);
  tm.patchLocaleTable('de', 'Internal_Strings', [['monthNames', 'Morgenstern\nSonnenaufgang\nErste Saat']]);
  assert.equal(tm.getLocalizedTextList('monthNames').length, 3, 'a patch clears the cache');
  tm.patchLocaleTable('en', 'Internal_Strings', [['monthNames', 'A\nB']]);
  tm.setLocale('en');
  assert.deepEqual(tm.getLocalizedTextList('monthNames'), ['A', 'B'], 'a switch clears it');
  tm.patchLocaleTable('en', 'Internal_Strings', [['k1', 'one'], ['k2', 'two']]);
  assert.deepEqual(tm.getLocalizedTextListFromKeyArray(['k1', 'k2']), ['one', 'two']);
  assert.throws(() => tm.getLocalizedTextListFromKeyArray(['k1', 'k3']), /k3 not found/);
  assert.equal(tm.getLocalizedTextListFromKeyArray(['k1', 'k3'], tm.TextCollections.Internal, false), null);
  assert.throws(() => tm.getLocalizedTextListFromKeyArray([]), /null or empty/);
});

test('L10N1 name helpers: location, spell, item, magic item and faction by id from their own collections, else the caller\'s fallback; a region by the regionNames list, else the canonical name', () => {
  tm.patchLocaleTable('fr', 'Internal_Locations', [['382613', 'Daguefilante']]);
  tm.patchLocaleTable('fr', 'Internal_Spells', [['1', 'Lumière']]);
  tm.patchLocaleTable('fr', 'Internal_Items', [['0', 'Pomme']]);
  tm.patchLocaleTable('fr', 'Internal_MagicItems', [['2', 'Anneau']]);
  tm.patchLocaleTable('fr', 'Internal_Factions', [['40', 'Les Sorcières']]);
  tm.patchLocaleTable('fr', 'Internal_Strings', [['regionNames', 'Baie Iliaque\nDaguefilante']]);
  tm.setLocale('fr');
  assert.equal(tm.getLocalizedLocationName(382613, 'Daggerfall'), 'Daguefilante');
  assert.equal(tm.getLocalizedLocationName(1, 'Somewhere'), 'Somewhere');
  assert.equal(tm.getLocalizedSpellName(1, 'Light'), 'Lumière');
  assert.equal(tm.getLocalizedSpellName(9, 'Shock'), 'Shock');
  assert.equal(tm.getLocalizedItemName(0, 'Apple'), 'Pomme');
  assert.equal(tm.getLocalizedMagicItemName(2, 'Ring'), 'Anneau');
  assert.equal(tm.getLocalizedFactionName(40, 'The Witches'), 'Les Sorcières');
  assert.equal(tm.getLocalizedFactionName(41, 'Other'), 'Other');
  const canonical = (i) => `canon-${i}`;
  assert.equal(tm.getLocalizedRegionName(1, canonical), 'Daguefilante');
  assert.equal(tm.getLocalizedRegionName(2, canonical), 'canon-2', 'one past the list\'s end');
  assert.equal(tm.getLocalizedRegionName(-1, canonical), 'canon--1', 'before its start');
  tm.setLocale('en');
  assert.equal(tm.getLocalizedRegionName(1, canonical), 'canon-1', 'no list');
});

test('L10N1 the port\'s own strings: t() formats ICU patterns - plurals and ordinals by each language\'s own rules, select, numbers, apostrophes as ICU\'s default mode; an English pattern prints what the old template did', () => {
  const items = '{n, plural, one {# item} other {# items}}';
  assert.equal(tm.t('inv.items', items, { n: 1 }), '1 item');
  assert.equal(tm.t('inv.items', items, { n: 0 }), '0 items');
  assert.equal(tm.t('inv.items', items, { n: 1000 }), '1000 items', '# is the plain number, as `${n}` printed it');
  const ord = '{n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}';
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101].map((n) => tm.t('ord', ord, { n })), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st']);
  assert.equal(tm.t('k', "You don't have {count, number} gold.", { count: 12345 }), "You don't have 12,345 gold.");
  assert.equal(tm.t('k', "Quote '{'this'}' and it''s fine", {}), "Quote {this} and it's fine");
  assert.equal(tm.t('k', '{g, select, male {He} female {She} other {They}} left.', { g: 'female' }), 'She left.');
  assert.equal(tm.t('k', '{g, select, male {He} female {She} other {They}} left.', { g: 'x' }), 'They left.');
  assert.equal(tm.t('k', '{n, plural, =0 {none} one {one {what}} other {# {what}s}}', { n: 3, what: 'rat' }), '3 rats', 'an argument inside a branch');
  assert.equal(tm.t('k', 'Hello {name}', {}), 'Hello {name}', 'a missing argument shows its name');
  const ru = '{n, plural, one {# яблоко} few {# яблока} many {# яблок} other {# яблока}}';
  tm.patchLocaleTable('ru', 'Port_Strings', [['apples', ru]]);
  tm.setLocale('ru');
  assert.deepEqual([1, 2, 5, 21, 22, 25].map((n) => tm.t('apples', '{n} apples', { n })), ['1 яблоко', '2 яблока', '5 яблок', '21 яблоко', '22 яблока', '25 яблок']);
  assert.equal(tm.t('k', '{count, number}', { count: 1234.5 }), '1 234,5', 'numbers in the locale\'s own separators');
  tm.patchLocaleTable('ar', 'Port_Strings', [['days', '{n, plural, zero {لا أيام} one {يوم} two {يومان} few {# أيام} many {# يومًا} other {# يوم}}']]);
  tm.setLocale('ar');
  assert.deepEqual([0, 1, 2, 3, 11, 100].map((n) => tm.t('days', '', { n })), ['لا أيام', 'يوم', 'يومان', '3 أيام', '11 يومًا', '100 يوم']);
});

test('L10N1 a malformed pattern is answered as it stands (text is never worth a crash); parseMessage throws, for the catalog checks', () => {
  const quiet = console.error; console.error = () => {};
  try {
    assert.equal(tm.formatMessage('Broken {n, plural, one {x}', { n: 1 }), 'Broken {n, plural, one {x}');
    assert.equal(tm.formatMessage('stray } brace'), 'stray } brace');
  } finally { console.error = quiet; }
  assert.throws(() => tm.parseMessage('{n, plural, one {x}}'), /without an 'other' option/);
  assert.throws(() => tm.parseMessage('{n, date}'), /unknown argument type 'date'/);
  assert.throws(() => tm.parseMessage('a } b'), /unmatched/);
  assert.throws(() => tm.parseMessage('{}'), /without a name/);
});

test('L10N1 pseudo-locale: routed text is accented, lengthened and bracketed once; DFU macros, {0}, [/markup], quest symbols, <ce> codes and every argument\'s value pass whole; the constant is what gets pseudo-localized, a table\'s word is not', () => {
  assert.equal(tm.pseudoLocalize('Hello %pcn, see [/center] _ghost_ =qgiver_ and {0} <ce>.'), '[Ĥééļļöö %pcn, šéééé [/center] _ghost_ =qgiver_ ååñð {0} <ce>.]');
  assert.equal(tm.pseudoLocalize(''), '');
  tm.setLocale(tm.PSEUDO_LOCALE);
  assert.equal(tm.localizedText('k', 'Save'), '[Šååṽéé]');
  assert.deepEqual(tm.localizedTextList('k', ['A', 'b']), ['[ÅÅ]', '[ƀ]']);
  assert.equal(tm.t('k', 'Hi {name}, {n, plural, one {# day} other {# days}}', { name: 'Bob', n: 2 }), '[Ĥîî Bob, 2 ðååýš]', 'the argument untouched, one bracket');
  tm.patchLocaleTable(tm.PSEUDO_LOCALE, 'Internal_Strings', [['k', 'from a table']]);
  assert.equal(tm.localizedText('k', 'Save'), 'from a table');
  assert.equal(tm.intlLocale(), 'en', 'the pseudo-locale formats numbers and plurals as English');
});

test('L10N1 registry and listeners: a locale\'s description (ltr and community unless said), a switch tells every listener once and a throwing one does not stop the rest', () => {
  const info = tm.registerLocale({ code: 'fr', name: 'Français', englishName: 'French' });
  assert.equal(info.dir, 'ltr');
  assert.equal(info.source, 'community');
  tm.registerLocale({ code: 'fr', source: 'mixed' });
  assert.equal(tm.localeInfo('fr').name, 'Français', 'a second registration merges');
  assert.equal(tm.localeInfo('fr').source, 'mixed');
  assert.throws(() => tm.registerLocale({ name: 'x' }), /needs a code/);
  const heard = [];
  const quiet = console.error; console.error = () => {};
  try {
    tm.onLocaleChange(() => { throw new Error('boom'); });
    const off = tm.onLocaleChange((c) => heard.push(c));
    assert.equal(tm.setLocale('fr'), true);
    assert.equal(tm.setLocale('fr'), false, 'no change, no word');
    off();
    tm.setLocale('en');
  } finally { console.error = quiet; }
  assert.deepEqual(heard, ['fr']);
  assert.equal(tm.currentLocale(), 'en');
});

test('L10N1 grammar and fonts: the identity processor until a language\'s rules replace it; a localized font registered per font and locale forces SDF on', () => {
  assert.equal(tm.processGrammar('{.le} texte'), '{.le} texte');
  class Upper extends tm.GrammarRules { processGrammar(text) { return text.toUpperCase(); } }
  tm.GrammarManager.grammarProcessor = new Upper();
  assert.equal(tm.processGrammar('abc'), 'ABC');
  let forced = 0;
  tm.setSdfForcer(() => { forced++; });
  const font = { name: 'NotoSansJP' };
  tm.registerLocalizedFont('ja', 'FONT0003', font);
  assert.equal(forced, 1);
  assert.equal(tm.hasLocalizedFont('FONT0003', 'ja'), true);
  assert.equal(tm.hasLocalizedFont('FONT0003'), false, 'not in the current locale (en)');
  assert.equal(tm.getLocalizedFont('FONT0003', 'ja'), font);
  assert.equal(tm.getLocalizedFont('FONT0001', 'ja'), null);
  const quiet = console.error; console.error = () => {};
  try { tm.registerLocalizedFont(null, 'FONT0003', font); } finally { console.error = quiet; }
  assert.equal(forced, 1, 'a null locale registers nothing');
});

test('L10N1 parity with DFU\'s C#: the collection names, the error string and the CSV line pattern are DFU\'s own', { skip: missingDfu('Assets/Scripts/Game/TextManager.cs', 'Assets/Scripts/Game/StringTableCSVParser.cs') && 'no DFU checkout (DFU_PATH)' }, () => {
  const cs = readFileSync(dfuFile('Assets/Scripts/Game/TextManager.cs'), 'utf8');
  const names = Object.fromEntries([...cs.matchAll(/public static string defaultInternal(\w+)CollectionName = "(\w+)";/g)].map((m) => [m[1], m[2]]));
  assert.deepEqual(Object.values(names).sort(), Object.entries(tm.DEFAULT_COLLECTION_NAMES).filter(([k]) => k !== 'Port').map(([, v]) => v).sort());
  assert.match(cs, /const string localizedTextLookupError = "<LocaleText-NotFound>";/);
  const parser = readFileSync(dfuFile('Assets/Scripts/Game/StringTableCSVParser.cs'), 'utf8');
  const pattern = /const string linePattern = "(.*)";/.exec(parser)[1].replace(/\\\\/g, '\\').replace(/\\"/g, '"');
  assert.equal(pattern, '(?:\\n|^)([^",\\n]*),((?:"[^"]*")+|[^",\\n]*)');
  assert.ok(rd('src/systems/textManager.js').includes('const CSV_LINE = /(?:\\n|^)([^",\\n]*),((?:"[^"]*")+|[^",\\n]*)/g;'), 'the port\'s pattern is the same text');
});
