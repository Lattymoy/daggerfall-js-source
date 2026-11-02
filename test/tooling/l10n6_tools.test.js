// L10N6 (2026-10-03): TRANSLATIONS SHIPPED - the three tools around the drafts, over fixtures. THE COVERAGE REPORT
// (tools/l10nCoverage.mjs): each language's share of the English catalog, the machine's rows from a person's by the
// pipeline's own ownership law, what is owed and what a person must review because its English moved, and a bundled
// pack's tables against DFU's masters. THE REVIEW FILE (tools/l10nReview.mjs): a language exported as a sheet and a
// filled sheet imported - each fix held to the placeholder law, a stale row refused, every applied fix a person's from
// then on. THE BUNDLED PACK (tools/l10nPack.mjs): PACK.json must name its authors, source, licence and terms, its
// licence text must stand beside it, and nothing that is not text the game reads may ride along.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { languageCoverage, coverageMarkdown } from '../../tools/l10nCoverage.mjs';
import { exportReview, importReview, parseCsv, REVIEW_COLUMNS } from '../../tools/l10nReview.mjs';
import { readBundledPack, packMetaProblems } from '../../tools/l10nPack.mjs';
import { hash } from '../../tools/translate.mjs';
import { formatStringTableCsv } from '../../src/systems/textManager.js';

const EN = [['a.hello', 'Hello'], ['a.gold', '{n, plural, one {# gold piece} other {# gold pieces}}'], ['a.name', 'Hello, {name}.'], ['a.new', 'Brand new']];
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'l10n6-'));
  const put = (p, text) => { mkdirSync(join(root, p, '..'), { recursive: true }); writeFileSync(join(root, p), text); };
  put('locales/en/Port_Strings.csv', formatStringTableCsv(EN));
  // fr: a.hello the machine's, a.gold edited by a person after the draft, a.name a person's whose English since moved, a.new owed
  put('locales/fr/Port_Strings.csv', formatStringTableCsv([['a.hello', 'Bonjour'], ['a.gold', '{n, plural, one {# pièce d\'or} other {# pièces d\'or}}'], ['a.name', 'Salut, {name}.']]));
  put('locales/fr/Port_Strings.meta.json', JSON.stringify({
    'a.hello': { en: hash('Hello'), tr: hash('Bonjour'), by: 'claude-in-session' },
    'a.gold': { en: hash(EN[1][1]), tr: hash('a different draft'), by: 'claude-in-session' },
    'a.name': { en: hash('Hi, {name}.'), tr: hash('Salut, {name}.'), by: 'human' },
  }));
  put('vendor/dfu-text/Internal_Strings.csv', 'Key,Value\nyes,Yes\nno,No\nok,OK\n');
  return { root, put };
}

test('L10N6 coverage: a language\'s share of the catalog - the machine\'s rows, a person\'s (edited after the draft, or recorded so), what is owed, a person\'s row whose English moved; a bundled pack\'s tables against DFU\'s masters', () => {
  const { root, put } = fixture();
  try {
    assert.deepEqual(languageCoverage('fr', root).port, { total: 4, have: 3, machine: 1, person: 2, owed: 1, stale: 1 });
    assert.equal(languageCoverage('fr', root).bundled, null);
    put('locales/fr/pack/PACK.json', JSON.stringify({ name: 'Test pack', authors: ['A'], source: 'https://example.org', license: 'CC-BY-4.0', terms: 'credit' }));
    put('locales/fr/pack/LICENSE', 'licence text');
    put('locales/fr/pack/Text/Internal_Strings.csv', 'Key,Value\nyes,Oui\nno,Non\n');
    put('locales/fr/pack/Text/Quests/S0000977-LOC.txt', 'Quest: S0000977\n');
    const c = languageCoverage('fr', root);
    assert.deepEqual(c.bundled, { name: 'Test pack', license: 'CC-BY-4.0', tables: { Internal_Strings: { rows: 2, of: 3 } }, quests: 1, books: 0 });
    const md = coverageMarkdown([{ ...c, name: 'French', own: 'Français' }]);
    assert.match(md, /\| French \(Français\) \| fr \| 3\/4 \(75%\) \| 1 \| 2 \| 1 \| 1 \| Test pack \(CC-BY-4\.0\): Internal_Strings 2\/3, 1 quests \|/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('L10N6 review: the sheet holds every key in the catalog\'s order with its owner; a filled fix is applied under the placeholder law and is a person\'s from then on; a stale or broken fix is refused and changes nothing', () => {
  const { root } = fixture();
  try {
    const sheet = exportReview('fr', root);
    const rows = parseCsv(sheet);
    assert.deepEqual(rows[0], [...REVIEW_COLUMNS]);
    assert.deepEqual(rows.slice(1).map((r) => [r[0], r[3]]), [['a.hello', 'machine'], ['a.gold', 'person'], ['a.name', 'person'], ['a.new', 'missing']]);
    assert.deepEqual(parseCsv(exportReview('fr', root, { machineOnly: true })).slice(1).map((r) => r[0]), ['a.hello']);
    const filled = rows.map((r, i) => (i === 0 ? r : [...r.slice(0, 4), { 'a.hello': 'Salut', 'a.new': 'Tout "neuf",\nenfin', 'a.gold': '{count} pièces' }[r[0]] ?? '']));
    filled.push(['a.name', 'Hi, {name}.', '', 'person', 'Coucou, {name}.']);   // exported against old English: stale
    filled.push(['a.gone', 'Gone', '', 'missing', 'Parti']);   // a key the catalog no longer holds
    const csv = filled.map((r) => r.map((x) => (/[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x)).join(',')).join('\n');
    const r = importReview('fr', csv, root);
    assert.deepEqual(r.applied, ['a.hello', 'a.new']);
    assert.equal(r.refused.length, 3);
    assert.match(r.refused.join('\n'), /a\.gold: /);
    assert.match(r.refused.join('\n'), /a\.name: stale/);
    assert.match(r.refused.join('\n'), /a\.gone: not in the English catalog/);
    const out = readFileSync(join(root, 'locales/fr/Port_Strings.csv'), 'utf8');
    assert.equal(out, formatStringTableCsv([['a.hello', 'Salut'], ['a.gold', '{n, plural, one {# pièce d\'or} other {# pièces d\'or}}'], ['a.name', 'Salut, {name}.'], ['a.new', 'Tout "neuf",\nenfin']]), 'a quoted cell with a comma and a line break read whole');
    const meta = JSON.parse(readFileSync(join(root, 'locales/fr/Port_Strings.meta.json'), 'utf8'));
    assert.deepEqual(meta['a.hello'], { en: hash('Hello'), tr: hash('Salut'), by: 'human' });
    assert.deepEqual(languageCoverage('fr', root).port, { total: 4, have: 4, machine: 0, person: 4, owed: 0, stale: 1 });
    assert.throws(() => importReview('en', csv, root), /not a language/);
    assert.throws(() => importReview('fr', 'nope,nothing\n', root), /no key\/english\/fix column/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('L10N6 bundled pack: PACK.json names its authors, source, licence and terms; the licence text stands beside it; anything that is not text the game reads is refused (a pack\'s textures are Bethesda\'s)', () => {
  assert.deepEqual(packMetaProblems({ name: 'P', authors: ['A'], source: 's', license: 'MIT', terms: 'ok' }), []);
  assert.deepEqual(packMetaProblems({ name: 'P', authors: [], source: '', license: 'MIT' }), ['PACK.json has no source', 'PACK.json has no terms', 'PACK.json names no authors']);
  const { root, put } = fixture();
  try {
    assert.equal(readBundledPack('fr', root), null);
    put('locales/fr/pack/PACK.json', JSON.stringify({ name: 'P', authors: ['A'], source: 's', license: 'MIT', terms: 'ok' }));
    put('locales/fr/pack/Text/Books/BOK00001-LOC.txt', 'Title: x\n');
    put('locales/fr/pack/Fonts/FONT0003-SDF.ttf', 'font bytes');
    put('locales/fr/pack/Textures/TEXTURE.001', 'art');
    put('locales/fr/pack/README.md', 'notes');
    const p = readBundledPack('fr', root);
    assert.equal(p.books, 1);
    assert.equal(p.fonts, 1);
    assert.deepEqual(p.problems, ['no LICENSE - the pack\'s own licence text is bundled beside it', 'Textures/TEXTURE.001: not text the game reads (a pack\'s textures and videos are Bethesda\'s, never bundled)']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('L10N6 the tree: every bundled pack is complete and clean (there are none until an author\'s permission is in hand - Mac, 2026-10-03)', async () => {
  const { bundledPacks } = await import('../../tools/l10nPack.mjs');
  for (const [code, p] of Object.entries(bundledPacks())) assert.deepEqual(p.problems, [], `locales/${code}/pack`);
});
