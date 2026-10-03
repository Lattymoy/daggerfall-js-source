// L10N4 (2026-09-28): THE DOOR IN-SESSION DRAFTS COME IN BY (tools/l10nInSession.mjs). Every machine-made language
// covers the English Port_Strings catalog exactly (test/l10n1b.test.js) and records each row as the machine's
// (test/l10n6b.test.js); the port's own strings grow a batch at a time, and each batch's drafts are merged through this
// tool. Pinned over a fixture tree: a good draft written in the catalog's order and recorded as `claude-in-session`; a
// draft that loses an argument, and one for a key the catalog lacks, refused; a row a person edited kept, never
// replaced; a row the catalog no longer has dropped with its record; what each language still owes; and a merge with
// nothing in it changing no byte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mergeDrafts, owed, draftLanguages, IN_SESSION } from '../tools/l10nInSession.mjs';
import { hash } from '../tools/translate.mjs';
import { formatStringTableCsv, parseStringTableCsv } from '../src/systems/textManager.js';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'l10ninsession-'));
  mkdirSync(join(root, 'locales/en'), { recursive: true });
  mkdirSync(join(root, 'locales/fr'), { recursive: true });
  mkdirSync(join(root, 'locales/de'), { recursive: true });
  const en = [['menu.a', 'Load Game'], ['menu.b', '{n, plural, one {# save} other {# saves}}'], ['menu.c', 'Hello, {name}']];
  writeFileSync(join(root, 'locales/en/Port_Strings.csv'), formatStringTableCsv(en));
  // fr: menu.a the machine's; menu.c edited by a person after the machine wrote it; menu.old gone from the catalog
  writeFileSync(join(root, 'locales/fr/Port_Strings.csv'), formatStringTableCsv([['menu.a', 'Charger'], ['menu.c', 'Salut, {name} !'], ['menu.old', 'Vieux']]));
  writeFileSync(join(root, 'locales/fr/Port_Strings.meta.json'), JSON.stringify({
    'menu.a': { en: hash('Load Game'), tr: hash('Charger'), by: IN_SESSION },
    'menu.c': { en: hash('Hello, {name}'), tr: hash('Bonjour, {name}'), by: IN_SESSION },
    'menu.old': { en: hash('Old'), tr: hash('Vieux'), by: IN_SESSION },
  }, null, 1) + '\n');
  writeFileSync(join(root, 'locales/de/Port_Strings.csv'), formatStringTableCsv([]));
  return root;
}
const rows = (root, code) => parseStringTableCsv(readFileSync(join(root, 'locales', code, 'Port_Strings.csv'), 'utf8'));
const meta = (root, code) => JSON.parse(readFileSync(join(root, 'locales', code, 'Port_Strings.meta.json'), 'utf8'));

test('L10N4 in-session drafts: a good draft written in the catalog\'s order and recorded as the machine\'s; a lost argument and an unknown key refused; a person\'s row kept; a row the catalog dropped dropped', () => {
  const root = fixture();
  try {
    assert.deepEqual(draftLanguages(root), ['de', 'fr']);
    assert.deepEqual(owed(root).fr, { 'menu.b': '{n, plural, one {# save} other {# saves}}' }, 'fr owes the row it has none for');
    const r = mergeDrafts({
      fr: {
        'menu.b': '{n, plural, one {# sauvegarde} many {# de sauvegardes} other {# sauvegardes}}',   // a category English lacks: allowed
        'menu.c': 'Bonjour, {name}',                // a person's row: kept
        'menu.x': 'Inconnu',                        // no such key
      },
      de: { 'menu.a': 'Spiel laden', 'menu.c': 'Hallo!' },   // menu.c loses {name}
    }, root);
    assert.deepEqual(r.written, { fr: 1, de: 1 });
    assert.deepEqual(r.refused, ['fr menu.x: not in the English catalog', 'de menu.c: missing name']);
    assert.deepEqual(r.kept, ['fr menu.c']);
    assert.deepEqual(r.dropped, ['fr menu.old']);
    assert.deepEqual(r.owed, { de: 2 }, 'de still owes menu.b and menu.c');
    assert.deepEqual(rows(root, 'fr'), [['menu.a', 'Charger'], ['menu.b', '{n, plural, one {# sauvegarde} many {# de sauvegardes} other {# sauvegardes}}'], ['menu.c', 'Salut, {name} !']],
      'the catalog\'s order; the person\'s words untouched');
    const m = meta(root, 'fr');
    assert.deepEqual(Object.keys(m), ['menu.a', 'menu.b', 'menu.c']);
    assert.deepEqual(m['menu.b'], { en: hash('{n, plural, one {# save} other {# saves}}'), tr: hash(rows(root, 'fr')[1][1]), by: IN_SESSION });
    assert.equal(m['menu.c'].by, 'human', 'a person\'s row is marked theirs');
    assert.deepEqual(rows(root, 'de'), [['menu.a', 'Spiel laden']]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('L10N4 in-session drafts: a merge with nothing in it changes no byte of a language already whole', () => {
  const root = fixture();
  try {
    mergeDrafts({ fr: { 'menu.b': '{n, plural, one {# sauvegarde} other {# sauvegardes}}' } }, root);
    const before = [readFileSync(join(root, 'locales/fr/Port_Strings.csv'), 'utf8'), readFileSync(join(root, 'locales/fr/Port_Strings.meta.json'), 'utf8')];
    const r = mergeDrafts({ fr: {} }, root);
    assert.deepEqual(r.written, { fr: 0 });
    assert.deepEqual([readFileSync(join(root, 'locales/fr/Port_Strings.csv'), 'utf8'), readFileSync(join(root, 'locales/fr/Port_Strings.meta.json'), 'utf8')], before);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
