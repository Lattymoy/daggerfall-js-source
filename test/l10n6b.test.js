// L10N6b (2026-09-27, Mac: "Both"): THE TRANSLATION PIPELINE, tools/translate.mjs. The placeholders a draft must
// keep (the port's ICU arguments; Daggerfall's %macros, [/markup], {n} and quest symbols), whose row is whose (a person's
// edit kept and never drafted over, a machine row drafted again when its English moves), a whole run over a stand-in
// model (a broken draft asked for once more with its problem named, then left out; the table in the English's order;
// a second run owing nothing), a dry run that sends and writes nothing, the request the API is sent (the system prompt
// cached, the tool forced, a rate limit waited out), and the in-session drafts recorded as the machine's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseStringTableCsv, formatStringTableCsv, loadStringTableCsv } from '../src/systems/textManager.js';
import { protectedTokens, checkDraft, planRun, batchesOf, hash, systemPrompt, callClaude, translateTable, parseArgs, SOURCES, TOOL, DEFAULT_MODEL } from '../tools/translate.mjs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('L10N6b the placeholders: the port\'s ICU arguments by name (a language\'s own plural categories allowed), Daggerfall\'s %macros, [/markup], {n} and quest symbols as a multiset; a draft that drops, adds or breaks one is refused', () => {
  const icu = '{n, plural, one {# gold piece} other {# gold pieces}} for {name}';
  assert.deepEqual(protectedTokens(icu, 'icu'), ['n', 'name']);
  assert.deepEqual(checkDraft(icu, '{name}: {n, plural, one {# zlatý} few {# zlaté} many {# zlatého} other {# zlatých}}', 'icu'), [], 'Czech\'s own categories');
  assert.match(checkDraft(icu, '{n, plural, one {# or} other {# ors}}', 'icu').join(), /missing name/);
  assert.match(checkDraft(icu, '{n, plural, one {#} other {#}} {name} {who}', 'icu').join(), /not in the English: who/);
  assert.match(checkDraft(icu, '{n, plural, one {#}', 'icu').join(), /does not read/);
  const rsc = 'You see %s.[/left]Go %di of here, _qgiver_ says.[/center][/pos:x=20,y=0]{0} =enemy_ __place_';
  assert.deepEqual(protectedTokens(rsc, 'dfu'), ['%di', '%s', '=enemy_', '[/center]', '[/left]', '[/pos:x=20,y=0]', '_qgiver_', '__place_', '{0}'].sort());
  assert.deepEqual(checkDraft(rsc, '__place_ {0} [/pos:x=20,y=0]=enemy_ Vous voyez %s.[/left]_qgiver_ dit : allez %di d\'ici.[/center]', 'dfu'), [], 'order is the language\'s');
  assert.match(checkDraft(rsc, 'Vous voyez %s. Allez %di.[/center][/pos:x=20,y=0]{0} =enemy_ __place_ _qgiver_', 'dfu').join(), /missing \[\/left\]/);
  assert.match(checkDraft('%s died.', '%s est mort. %s', 'dfu').join(), /not in the English: %s/, 'a macro twice is one too many');
  assert.deepEqual(checkDraft('x', '', 'dfu'), ['no text']);
  assert.match(checkDraft('x', 'y\n', 'dfu').join(), /line break/);
});

test('L10N6b whose row is whose: a missing row drafted, a machine row kept until its English moves (or --retranslate), a row the pipeline never wrote or a person edited kept and marked theirs, and a person\'s row whose English moved reported stale', () => {
  const english = new Map([['a', 'Alpha'], ['b', 'Beta'], ['c', 'Gamma'], ['d', 'Delta'], ['e', 'Epsilon'], ['f', 'Zeta']]);
  const rows = new Map([['b', 'Bêta'], ['c', 'Gamma!'], ['d', 'Delta (edited)'], ['e', 'Epsilon fr'], ['f', 'Zêta']]);
  const meta = {
    b: { en: hash('Beta'), tr: hash('Bêta'), by: DEFAULT_MODEL },             // the machine's, current
    c: { en: hash('Gamma (old)'), tr: hash('Gamma!'), by: DEFAULT_MODEL },    // the machine's, English moved
    d: { en: hash('Delta'), tr: hash('Delta'), by: DEFAULT_MODEL },           // the machine wrote "Delta"; a person changed it
    f: { en: hash('Zeta (old)'), tr: hash('Zêta'), by: 'human' },             // a person's, English moved
  };
  const p = planRun(english, rows, meta);
  assert.deepEqual(p.draft, ['a', 'c']);
  assert.deepEqual(p.done, ['b']);
  assert.deepEqual(p.human, ['d', 'e', 'f'], 'edited, never written by the pipeline, a person\'s');
  assert.deepEqual(p.stale, ['f']);
  assert.equal(p.meta.d.by, 'human');
  assert.equal(p.meta.e.by, 'human');
  assert.deepEqual(planRun(english, rows, meta, { retranslate: true }).draft, ['a', 'b', 'c'], 'every machine row, never a person\'s');
  assert.deepEqual(batchesOf(['1', '2', '3', '4', '5'], 2), [['1', '2'], ['3', '4'], ['5']]);
});

function scratch() {
  const root = mkdtempSync(join(tmpdir(), 'l10n6b-'));
  mkdirSync(join(root, 'locales', 'en'), { recursive: true });
  mkdirSync(join(root, 'locales', 'fr'), { recursive: true });
  return root;
}

test('L10N6b a run: the owed rows batched to the model, a broken draft asked for once more with its problem named and left out if still broken, a person\'s row untouched, the table in the English\'s order with its meta, and a second run owing nothing', async () => {
  const root = scratch();
  writeFileSync(join(root, 'locales/en/Port_Strings.csv'), formatStringTableCsv([
    ['menu.a', 'Alpha'], ['menu.b', 'Beta {n, number}'], ['menu.c', 'Gamma {who}'], ['menu.d', 'Delta'], ['menu.e', 'Epsilon {x}'],
  ]));
  writeFileSync(join(root, 'locales/fr/Port_Strings.csv'), formatStringTableCsv([['menu.d', 'Delta (a person\'s)']]));
  const calls = [];
  const model = async (rows, fix, system) => {
    calls.push({ keys: rows.map(([k]) => k), fix, system });
    const out = {};
    for (const [k, en] of rows) {
      if (k === 'menu.c' && !fix) out[k] = 'Gamma';                  // drops {who}; fixed when asked again
      else if (k === 'menu.e') out[k] = 'Epsilon';                    // drops {x} both times
      else out[k] = `${en} (fr)`;
    }
    return out;
  };
  const acc = await translateTable({ code: 'fr', table: 'Port_Strings', root, model, batch: 2, jobs: 1 });
  assert.equal(acc.owed, 4);
  assert.equal(acc.drafted, 3);
  assert.equal(acc.kept, 1);
  assert.deepEqual(acc.rejected.map((r) => r.split(':')[0]), ['menu.e']);
  assert.deepEqual(calls.map((c) => c.keys), [['menu.a', 'menu.b'], ['menu.c', 'menu.e'], ['menu.c', 'menu.e']], 'two batches, the broken pair asked again');
  assert.match(calls[2].fix, /menu\.c: missing who/);
  assert.match(calls[0].system, /French \(Français, fr\)/);
  const table = parseStringTableCsv(readFileSync(join(root, 'locales/fr/Port_Strings.csv'), 'utf8'));
  assert.deepEqual(table, [['menu.a', 'Alpha (fr)'], ['menu.b', 'Beta {n, number} (fr)'], ['menu.c', 'Gamma {who} (fr)'], ['menu.d', 'Delta (a person\'s)']], 'the English\'s order; the person\'s row as it was; the rejected row left out');
  const meta = JSON.parse(readFileSync(join(root, 'locales/fr/Port_Strings.meta.json'), 'utf8'));
  assert.equal(meta['menu.a'].by, DEFAULT_MODEL);
  assert.equal(meta['menu.a'].tr, hash('Alpha (fr)'));
  assert.equal(meta['menu.d'].by, 'human');
  calls.length = 0;
  const again = await translateTable({ code: 'fr', table: 'Port_Strings', root, model, batch: 2, jobs: 1 });
  assert.deepEqual(calls.map((c) => c.keys), [['menu.e'], ['menu.e']], 'only the row still owed - asked, and asked again with its problem');
  assert.equal(again.done, 3);
  await assert.rejects(translateTable({ code: 'en', table: 'Port_Strings', root, model }), /not a language the catalog drafts/);
  await assert.rejects(translateTable({ code: 'fr', table: 'Internal_Nothing', root, model }), /no source/);
  await assert.rejects(translateTable({ code: 'fr', table: 'Internal_Spells', root, model }), /the English source comes first/);
});

test('L10N6b a dry run prints the prompt and the batches and sends and writes nothing', async () => {
  const root = scratch();
  writeFileSync(join(root, 'locales/en/Port_Strings.csv'), '\uFEFF' + formatStringTableCsv([['menu.a', 'Alpha'], ['menu.b', 'Beta']]));   // DFU's masters and a pack's files open with a BOM
  const lines = [];
  const acc = await translateTable({ code: 'ja', table: 'Port_Strings', root, model: () => { throw new Error('sent'); }, dryRun: true, log: (s) => lines.push(s) });
  assert.equal(acc.owed, 2, 'the BOM stripped as DFU\'s LoadCSV strips it - the header is no row to translate');
  assert.match(lines[0], /Japanese \(日本語, ja\)/);
  assert.match(lines[1], /batch 1\/1: 2 rows/);
  assert.equal(existsSync(join(root, 'locales/ja')), false);
});

test('L10N6b the request: the Messages API with the key, the version header, the system prompt cached, the tool forced; a rate limit waited out; any other failure said', async () => {
  const sent = [];
  let n = 0;
  const fetchImpl = async (url, init) => {
    sent.push({ url, init: { ...init, body: JSON.parse(init.body) } });
    if (++n === 1) return { ok: false, status: 429, text: async () => 'slow down' };
    return { ok: true, json: async () => ({ content: [{ type: 'text', text: 'here' }, { type: 'tool_use', name: TOOL.name, input: { translations: { a: 'A (fr)' } } }] }) };
  };
  const t0 = Date.now();
  const out = await callClaude({ apiKey: 'k', model: 'm', system: 'SYS', rows: [['a', 'A']], fetchImpl, tries: 2 });
  assert.deepEqual(out, { a: 'A (fr)' });
  assert.ok(Date.now() - t0 >= 1900, 'waited before asking again');
  assert.equal(sent.length, 2);
  const { url, init } = sent[0];
  assert.equal(url, 'https://api.anthropic.com/v1/messages');
  assert.equal(init.headers['x-api-key'], 'k');
  assert.equal(init.headers['anthropic-version'], '2023-06-01');
  assert.equal(init.body.model, 'm');
  assert.deepEqual(init.body.system, [{ type: 'text', text: 'SYS', cache_control: { type: 'ephemeral' } }]);
  assert.deepEqual(init.body.tool_choice, { type: 'tool', name: 'submit_translations' });
  assert.match(init.body.messages[0].content, /"a": "A"/);
  const failing = async () => ({ ok: false, status: 400, text: async () => 'bad request' });
  await assert.rejects(callClaude({ apiKey: 'k', model: 'm', system: 'S', rows: [], fetchImpl: failing }), /answered 400: bad request/);
});

test('L10N6b the command line, the sources, the prompt\'s rules; and the in-session drafts recorded as the machine\'s, so the pipeline redrafts them when their English moves and never mistakes them for a person\'s', () => {
  assert.deepEqual(parseArgs(['--lang', 'de', '--table', 'Internal_RSC', '--batch', '10', '--dry-run']).batch, 10);
  assert.throws(() => parseArgs(['--lang', 'de']), /usage/);
  assert.throws(() => parseArgs(['--lang', 'de', '--table', 'x', '--nope']), /unknown option/);
  assert.equal(SOURCES.Port_Strings.path, 'locales/en/Port_Strings.csv');
  // DFU's nine English masters, vendored (vendor/dfu-text), each read at its own row count as LoadCSV reads it
  const COUNTS = { Internal_Strings: 990, Internal_RSC: 1448, Internal_Flats: 226, Internal_Locations: 15251, Internal_Settings: 32, Internal_Spells: 88, Internal_Items: 288, Internal_MagicItems: 59, Internal_Factions: 366 };
  for (const [table, n] of Object.entries(COUNTS)) {
    assert.equal(SOURCES[table].kind, 'dfu', table);
    assert.equal(loadStringTableCsv(rd(SOURCES[table].path)).length, n, `${table} reads at DFU's ${n} rows`);
  }
  assert.deepEqual(Object.keys(SOURCES).sort(), ['Port_Strings', ...Object.keys(COUNTS)].sort(), 'every table has its source');
  const sys = systemPrompt({ code: 'ru', table: 'Internal_RSC', glossary: { Daggerfall: 'Даггерфолл' } });
  assert.match(sys, /Russian \(Русский, ru\)/);
  assert.match(sys, /\[\/left\]/);
  assert.match(sys, /Daggerfall -> Даггерфолл/);
  assert.match(systemPrompt({ code: 'fr', table: 'Port_Strings' }), /ICU MessageFormat/);
  const en = new Map(parseStringTableCsv(rd('locales/en/Port_Strings.csv')));
  const langs = readdirSync(new URL('../locales/', import.meta.url), { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== 'en').map((d) => d.name);
  assert.equal(langs.length, 25);
  for (const code of langs) {
    const rows = new Map(parseStringTableCsv(rd(`locales/${code}/Port_Strings.csv`)));
    const meta = JSON.parse(rd(`locales/${code}/Port_Strings.meta.json`));
    const plan = planRun(en, rows, meta);
    assert.deepEqual([plan.draft, plan.human], [[], []], `${code}: every row the machine's and current`);
    assert.ok(Object.values(meta).every((m) => m.by === 'claude-in-session'));
  }
});
