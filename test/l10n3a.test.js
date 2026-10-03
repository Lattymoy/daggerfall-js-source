// L10N3a (2026-09-27): TEXT.RSC IN A TRANSLATION'S OWN WORDS. DFU asks the string table Internal_RSC for a record's id
// before it opens TEXT.RSC (TextProvider.GetRSCTokens), and a pack patches its rows over that table. A row is text in
// the importer's markup, which no byte shape can hold ('ü' is JustifyLeft's 0xFC), so it is read as DFU reads it -
// into tokens (ConvertStringToRSCTokens) - and every reader answers from them by its byte arm's own law. Pinned: the
// importer's law; each reader over a French row, letters whole; English and a key the table lacks on the file as
// before; the carried row (7333) beneath a translation's; a runtime collection a mod redirects; the class questions
// DFU keys apart (9000.1-9000.40).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as tm from '../src/systems/textManager.js';
import { TextRsc, RSC, TOKEN_TEXT, RSC_CUSTOM, markupTokens, localeRscRow } from '../src/formats/textRsc.js';
import { parseQuestionLibrary } from '../src/systems/classQuestions.js';

beforeEach(() => tm._resetTextManagerForTests());

/** A TEXT.RSC of `records` ({ id: byte[] }), each ended by EndOfRecord. */
function rscFile(records) {
  const ids = Object.keys(records).map(Number);
  const headerLength = 6 * (ids.length + 1);
  const bodies = ids.map((id) => [...records[id], RSC.EndOfRecord]);
  const size = 2 + ids.length * 6 + bodies.reduce((n, b) => n + b.length, 0);
  const bytes = new Uint8Array(size);
  const v = new DataView(bytes.buffer);
  v.setUint16(0, headerLength, true);
  let at = 2 + ids.length * 6;
  ids.forEach((id, i) => {
    v.setUint16(2 + i * 6, id, true);
    v.setUint32(4 + i * 6, at, true);
    bytes.set(bodies[i], at);
    at += bodies[i].length;
  });
  return bytes;
}
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));
const T = (text) => ({ formatting: TOKEN_TEXT, text, x: 0, y: 0 });
const F = (formatting, x = 0, y = 0) => ({ formatting, text: '', x, y });

test('L10N3a the importer\'s law (ConvertStringToRSCTokens): a newline is editor air, each [/...] run one markup, the prefixed ones parsed and text when they do not match, an unknown markup text, the custom codes, nothing for an empty value', () => {
  assert.deepEqual(markupTokens('FORCE[/center]\nLa force détermine[/left]'), [T('FORCE'), F(RSC.JustifyCenter), T('La force détermine'), F(RSC.JustifyLeft)]);
  assert.deepEqual(markupTokens('[/pos:x=20,y=3]%dam[/font=4]x[/newline][/input][/record]b[/end]'), [F(RSC.PositionPrefix, 20, 3), T('%dam'), F(RSC.FontPrefix, 4), T('x'), F(RSC.NewLine), F(RSC.InputCursorPositioner), F(RSC.SubrecordSeparator), T('b'), F(RSC.EndOfRecord)]);
  assert.deepEqual(markupTokens('[/pos:nope]'), [T('[/pos:nope]')], 'a prefixed markup that does not match is text');
  assert.deepEqual(markupTokens('a[/wat]b'), [T('a'), T('[/wat]'), T('b')], 'unhandled markup is a text token of itself');
  assert.deepEqual(markupTokens('[/color=ff00aa][/scale=1.5][/image=ICON.IMG]'), [{ formatting: RSC_CUSTOM.Color, text: 'ff00aa', x: 0, y: 0 }, { formatting: RSC_CUSTOM.Scale, text: '1.5', x: 0, y: 0 }, { formatting: RSC_CUSTOM.Image, text: 'ICON.IMG', x: 0, y: 0 }]);
  assert.deepEqual(markupTokens('a [/ b'), [T('a [/ b')], 'no closing bracket: text');
  assert.deepEqual(markupTokens(''), []);
});

test('L10N3a every reader answers a translation\'s row by its byte arm\'s law, every letter whole; English, and a record the table lacks, read the file as before', () => {
  const file = rscFile({
    100: [...ascii('Strength'), RSC.JustifyCenter, ...ascii('Your strength is %str.'), RSC.JustifyLeft],
    101: [...ascii('one'), RSC.SubrecordSeparator, ...ascii('two'), RSC.SubrecordSeparator],
    102: [...ascii('only English')],
    105: [...ascii('x')],
  });
  const rsc = new TextRsc().load(file);
  const english = { plain: rsc.plainText(100), lines: rsc.linesById(100), tokens: rsc.tokensById(100), count: rsc.variantCount(101) };
  tm.patchLocaleTable('fr', 'Internal_RSC', [
    ['100', 'Force[/center]\nVotre force de %str vous classe comme %ark.[/left][/pos:x=20,y=0]%dam de dégâts[/left]'],
    ['101', 'un[/record]deux[/record]'],
    ['103', 'Ça n\'existe qu\'en français'],
    ['105', 'a[/record]b[/record]c'],
    ['106', 'ligne[/left][/left]'],
  ]);
  assert.equal(localeRscRow(100), undefined, 'English stands: no row is asked for');
  assert.deepEqual(rsc.plainText(100), english.plain);
  tm.patchLocaleTable('en', 'Internal_RSC', [['102', 'an English table row']]);
  assert.deepEqual(rsc.plainText(102), ['only English'], 'English never asks a table: its text is the file\'s (and the carried rows\')');
  tm.clearLocaleTables('en');
  tm.setLocale('fr');
  assert.deepEqual(rsc.plainText(100), ['Force\nVotre force de %str vous classe comme %ark.\n%dam de dégâts\n']);
  assert.deepEqual(rsc.linesById(100), [{ text: 'Force', center: true }, { text: 'Votre force de %str vous classe comme %ark.', center: false }, { text: '%dam de dégâts', center: false }]);
  assert.deepEqual(rsc.tokensById(100).filter((t) => t.formatting === TOKEN_TEXT).map((t) => t.text), ['Force', 'Votre force de %str vous classe comme %ark.', '%dam de dégâts']);
  assert.equal(rsc.tokensById(100).find((t) => t.formatting === RSC.PositionPrefix).x, 20, 'the position markup is its token, as the byte arm\'s prefix is');
  assert.equal(rsc.variantCount(101), 3, 'a trailing [/record] mints an empty variant, as 0xFF 0xFE does');
  assert.deepEqual(rsc.variantLinesById(101, () => 0), [{ text: 'un', center: false }]);
  assert.deepEqual(rsc.variantLinesById(101, () => 0.99), [{ text: 'deux', center: false }], 'the empty last variant steps back (TextProvider.cs:231)');
  assert.deepEqual(rsc.variantTokensById(101, () => 0.99).map((t) => t.text), ['deux']);
  let drew = 0;
  rsc.variantTokensById(100, () => { drew++; return 0; });
  assert.equal(drew, 1, 'a one-variant row still draws (R13)');
  assert.ok(['un', 'deux'].includes(rsc.randomTextById(101, () => 0.6)));
  assert.equal(rsc.randomTextById(101, () => 0), 'un', 'GetRandomText\'s flat pool');
  assert.deepEqual(rsc.plainText(102), ['only English'], 'a record the table lacks: the file');
  assert.equal(rsc.hasRecord(103), true, 'a row only the translation has is a record');
  assert.deepEqual(rsc.plainText(103), ['Ça n\'existe qu\'en français']);
  assert.equal(rsc.hasRecord(104), false);
  assert.equal(rsc.variantCount(105), 3, 'the row\'s variants, not the file\'s one');
  assert.deepEqual(rsc.variantLinesById(105, () => 0.99), [{ text: 'c', center: false }], 'the row\'s last variant is not empty, so no step back');
  assert.deepEqual(rsc.linesById(106), [{ text: 'ligne', center: false }], 'the trailing empty row drops, as the byte arm drops it');
  tm.setLocale('en');
  assert.deepEqual({ plain: rsc.plainText(100), lines: rsc.linesById(100), tokens: rsc.tokensById(100), count: rsc.variantCount(101) }, english, 'back to English: the file, byte for byte');
});

test('L10N3a the chain and the runtime collection: pt-BR falls to pt\'s row; a row stops at [/end]; the carried 7333 lies beneath a translation\'s; a mod\'s RuntimeRSCStrings is the table asked', () => {
  const rsc = new TextRsc().load(rscFile({ 7333: ascii('%di of here') }));
  tm.patchLocaleTable('pt', 'Internal_RSC', [['7333', '%di daqui[/end]lixo']]);
  tm.setLocale('pt-BR');
  assert.deepEqual(rsc.plainText(7333), ['%di daqui'], 'pt\'s row for pt-BR, and nothing after [/end]');
  assert.deepEqual(rsc.tokensById(7333).map((t) => t.text), ['%di daqui']);
  assert.equal(rsc.randomTextById(7333, () => 0.99), '%di daqui', 'the flat pool ends at [/end] too');
  tm.setLocale('fr');
  assert.equal(rsc.plainText(7333).length, 9, 'no French row: the carried DFU row, its nine hints');
  tm.patchLocaleTable('fr', 'Mod_RSC', [['7333', 'd\'un mod']]);
  tm.setRuntimeCollectionName(tm.TextCollections.TextRSC, 'Mod_RSC');
  assert.deepEqual(rsc.plainText(7333), ['d\'un mod'], 'RuntimeRSCStrings redirected');
});

test('L10N3a the class questions: a translation keys the forty apart (9000.1-9000.40) and DFU\'s own loop reads them, token by token; without them the classic record is split at its braces', () => {
  const classic = rscFile({ 9000: ascii(Array.from({ length: 40 }, (_, i) => `{${i + 1}. Q${i + 1} a) x b) y c) z`).join('')) });
  const rsc = new TextRsc().load(classic);
  const en = parseQuestionLibrary(rsc);
  assert.equal(en.length, 40);
  assert.equal(en[0], ' Q1 a) x b) y c) z');
  const rows = [['9000', 'Deprecated record.']];
  for (let q = 1; q <= 40; q++) rows.push([`9000.${q}`, `${q}. Vous trouvez une bourse.[/left]a) La rendre.[/left]b) La garder.[/left]c) Partager.`]);
  tm.patchLocaleTable('fr', 'Internal_RSC', rows);
  tm.setLocale('fr');
  const fr = parseQuestionLibrary(rsc);
  assert.equal(fr.length, 40);
  assert.deepEqual(fr[0].split('\n').filter(Boolean), [' Vous trouvez une bourse.', 'a) La rendre.', 'b) La garder.', 'c) Partager.'], 'the number-dot split, a line a token');
  assert.equal(rsc.localeTokensByKey('9000.41'), null, 'a string key has no file to fall to');
});
