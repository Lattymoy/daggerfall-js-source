#!/usr/bin/env node
// L10N6b (2026-09-27, Mac: "Both" - the port's own strings translated in-session, and the game's text through a
// pipeline on the Claude API that he runs with his key): THE TRANSLATION PIPELINE. It drafts a language's string
// table from its English source, a batch of rows a request, and writes it where the game reads it -
// `locales/<tag>/<table>.csv`, DFU's own string-table format, so a draft and a DFU translation pack are the same kind
// of file (scenes/localeData.js loads both).
//
// What it will not do:
// - Overwrite a person. Beside each table it keeps `<table>.meta.json`: for every row it wrote, a hash of the English
//   it read and of the text it wrote. A row whose text no longer matches what the pipeline wrote was edited by
//   someone, and is theirs from then on - kept, and marked `human`. A row whose English changed is drafted again,
//   unless a person owns it; then it is only reported, for them to review.
// - Lose a placeholder. Every draft is checked against its English before it is kept: the same ICU arguments for the
//   port's own strings, the same %macros, [/markup] tags, {n} arguments and quest symbols for Daggerfall's text. A
//   draft that breaks one is asked for again once, with the problem named, and left out if it is still wrong.
// - Guess the cost. `--dry-run` prints the batches and the prompt, and sends nothing.
//
//   ANTHROPIC_API_KEY=... node tools/translate.mjs --lang fr --table Port_Strings
//   node tools/translate.mjs --lang ja --table Internal_RSC --dry-run
//   options: --model <id> (default claude-opus-5-5; claude-sonnet-5 costs less), --batch <n> rows a request (40),
//            --jobs <n> requests at once (4), --limit <n> rows this run, --retranslate (draft every machine row again)
//
// A language's words for its names (places, people, factions) stay the same across batches only if they are told:
// `locales/<tag>/glossary.json` ({ "English": "theirs" }) goes into every request.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { loadStringTableCsv, formatStringTableCsv, parseMessage } from '../src/systems/textManager.js';
import { catalogLocale } from '../src/systems/localeCatalog.js';
import { isMain } from './lib/isMain.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_MODEL = 'claude-opus-5-5';
const API_URL = 'https://api.anthropic.com/v1/messages';

/** The English each table is drafted from, and what its rows are (told to the model). */
export const SOURCES = Object.freeze({
  Port_Strings: { path: 'locales/en/Port_Strings.csv', kind: 'icu', about: 'the web port\'s own interface: menus, settings, the online game. Values are ICU MessageFormat patterns.' },
  Internal_Strings: { path: 'vendor/dfu-text/Internal_Strings.csv', kind: 'dfu', about: 'Daggerfall\'s interface and game messages (FALL.EXE\'s strings and Daggerfall Unity\'s own).' },
  Internal_RSC: { path: 'vendor/dfu-text/Internal_RSC.csv', kind: 'dfu', about: 'TEXT.RSC: message boxes, dialogue, character creation, guild and shop text, in Daggerfall Unity\'s markup.' },
  Internal_Flats: { path: 'vendor/dfu-text/Internal_Flats.csv', kind: 'dfu', about: 'the names of people and creatures shown in the world.' },
  Internal_Locations: { path: 'vendor/dfu-text/Internal_Locations.csv', kind: 'dfu', about: 'place names, by map id.' },
  Internal_Settings: { path: 'vendor/dfu-text/Internal_Settings.csv', kind: 'dfu', about: 'the settings window\'s labels.' },
  Internal_Spells: { path: 'vendor/dfu-text/Internal_Spells.csv', kind: 'dfu', about: 'spell names.' },
  Internal_Items: { path: 'vendor/dfu-text/Internal_Items.csv', kind: 'dfu', about: 'item names.' },
  Internal_MagicItems: { path: 'vendor/dfu-text/Internal_MagicItems.csv', kind: 'dfu', about: 'the names of magic items and artifacts.' },
  Internal_Factions: { path: 'vendor/dfu-text/Internal_Factions.csv', kind: 'dfu', about: 'faction, guild, temple and noble house names.' },
});

// ─── the placeholders a draft must keep ────────────────────────────────────────────────────────────────────────────
/** The ICU arguments a pattern names, once each, sorted. Throws on a pattern parseMessage cannot read. */
function icuArguments(pattern) {
  const out = new Set();
  const walk = (nodes) => { for (const n of nodes) if (typeof n === 'object' && n.arg) { out.add(n.arg); if (n.options) for (const b of n.options.values()) walk(b); } };
  walk(parseMessage(pattern));
  return [...out].sort();
}
// Daggerfall's: a %macro (%s, %loc, %di, %1bs), a [/markup] tag, a {0} argument, a quest symbol (_x_, =x_, __x_, ___x_).
const DFU_TOKEN = /%[a-zA-Z0-9]+|\[\/[^\]]*\]|\{\d+\}|(?:={1,2}|_{1,3})[A-Za-z][A-Za-z0-9]*_/g;
/** The tokens a value must carry through translation, as a sorted multiset (a list with repeats). */
export function protectedTokens(value, kind) {
  const s = String(value ?? '');
  if (kind === 'icu') return icuArguments(s);
  return (s.match(DFU_TOKEN) ?? []).sort();
}

/** Whether `draft` keeps everything `english` must keep. Answers the problems (empty when it does). */
export function checkDraft(english, draft, kind) {
  const problems = [];
  if (typeof draft !== 'string' || !draft.trim()) return ['no text'];
  let want, got;
  try { want = protectedTokens(english, kind); } catch (err) { return [`the English does not read: ${err.message}`]; }
  try { got = protectedTokens(draft, kind); } catch (err) { return [`does not read as a pattern: ${err.message}`]; }
  const missing = [...want], extra = [];
  for (const t of got) { const i = missing.indexOf(t); if (i >= 0) missing.splice(i, 1); else extra.push(t); }
  if (missing.length) problems.push(`missing ${missing.join(' ')}`);
  if (extra.length) problems.push(`not in the English: ${extra.join(' ')}`);
  if (/^[\r\n]|[\r\n]$/.test(draft)) problems.push('begins or ends with a line break');
  return problems;
}

// ─── the rows owed ─────────────────────────────────────────────────────────────────────────────────────────────────
export const hash = (s) => createHash('sha1').update(String(s)).digest('hex').slice(0, 12);

/**
 * What a run owes, given the English rows, the language's rows and its meta. Every English key is one of:
 * `draft` (no row, a machine row whose English changed, or every machine row under `retranslate`), `human` (a row a
 * person wrote or edited - kept; `stale` when its English changed since), or `done`.
 * @returns {{ draft: string[], human: string[], stale: string[], done: string[], meta: object }} the meta with every
 *   person's edit marked
 */
export function planRun(english, rows, meta = {}, { retranslate = false } = {}) {
  const out = { draft: [], human: [], stale: [], done: [], meta: { ...meta } };
  for (const [key, en] of english) {
    const have = rows.get(key);
    const m = meta[key];
    if (have === undefined) { out.draft.push(key); continue; }
    const byPerson = m ? m.by === 'human' || hash(have) !== m.tr : true;   // a row the pipeline never wrote is a person's
    if (byPerson) {
      out.human.push(key);
      if (m && m.en !== hash(en)) out.stale.push(key);
      out.meta[key] = { en: m?.en ?? hash(en), tr: hash(have), by: 'human' };
      continue;
    }
    if (retranslate || m.en !== hash(en)) out.draft.push(key);
    else out.done.push(key);
  }
  return out;
}

/** The rows in batches of `size`. */
export const batchesOf = (keys, size) => Array.from({ length: Math.ceil(keys.length / size) }, (_, i) => keys.slice(i * size, (i + 1) * size));

// ─── the request ───────────────────────────────────────────────────────────────────────────────────────────────────
/** The system prompt for a language and table, with the glossary. */
export function systemPrompt({ code, table, glossary = {} }) {
  const loc = catalogLocale(code);
  const lang = loc ? `${loc.englishName} (${loc.name}, ${code})` : code;
  const src = SOURCES[table];
  const rules = [
    `You translate the text of The Elder Scrolls II: Daggerfall (1996), as it is played in Daggerfall Unity and its web port, from English into ${lang}.`,
    `These rows are ${src?.about ?? 'game text.'}`,
    'Write it as a published translation of the game would: natural, idiomatic, in the dark medieval-fantasy tone of the original; the forms of address and register a player of this genre expects in your language; interface labels short.',
    'Keep every placeholder exactly as written and in a place that reads naturally: %macros (%s, %loc, %di, %1bs...), [/markup] tags ([/left], [/center], [/newline], [/record], [/end], [/pos:x=..,y=..], [/font=..]), {0}-style arguments, and quest symbols (_name_, =name_, __name_, ___name_). Do not add any that are not in the English.',
    src?.kind === 'icu'
      ? 'Values are ICU MessageFormat patterns: keep every {argument} and its name; in {n, plural, ...}, {n, selectordinal, ...} and {x, select, ...} keep the keywords, translate only the words inside the branches, and use your language\'s own plural categories (zero, one, two, few, many, other - always other). Write a literal brace as \'{\'.'
      : 'Keep the markup\'s line structure: the same number of [/left], [/center] and [/newline] breaks, and [/record] between the same variants.',
    'Names of people, places, gods, factions and artifacts: use the form the glossary gives; otherwise keep them as they are in Latin-script languages, and transliterate them in others, the same way every time.',
    'Answer through the submit_translations tool: every key you were given, and no other.',
  ];
  const terms = Object.entries(glossary);
  if (terms.length) rules.push(`Glossary (English -> ${lang}):\n${terms.map(([a, b]) => `${a} -> ${b}`).join('\n')}`);
  return rules.join('\n\n');
}

export const TOOL = Object.freeze({
  name: 'submit_translations',
  description: 'Submit the translation of every row, by key.',
  input_schema: { type: 'object', properties: { translations: { type: 'object', additionalProperties: { type: 'string' } } }, required: ['translations'] },
});

/** One request to the Messages API: the system prompt cached (every batch of a run shares it), the tool forced.
 *  Retries a rate limit or an overload with backoff. Answers { key: text }. */
export async function callClaude({ apiKey, model, system, rows, fix = null, fetchImpl = globalThis.fetch, tries = 5 }) {
  const content = [`Translate these rows (key -> English):\n${JSON.stringify(Object.fromEntries(rows), null, 1)}`];
  if (fix) content.push(`Your previous answer for these rows broke a rule:\n${fix}\nKeep every placeholder of the English exactly.`);
  const body = {
    model, max_tokens: 16000,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    tools: [TOOL], tool_choice: { type: 'tool', name: TOOL.name },
    messages: [{ role: 'user', content: content.join('\n\n') }],
  };
  for (let attempt = 1; ; attempt++) {
    const res = await fetchImpl(API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      const use = data.content?.find((c) => c.type === 'tool_use' && c.name === TOOL.name);
      return use?.input?.translations ?? {};
    }
    if ((res.status === 429 || res.status >= 500) && attempt < tries) {
      await new Promise((f) => setTimeout(f, Math.min(60000, 2000 * 2 ** (attempt - 1))));
      continue;
    }
    throw new Error(`the API answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

// ─── a run ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const readJson = (p, fallback) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return fallback; } };
/** A table's rows as DFU loads them (LoadCSV: the BOM a StreamReader strips, stripped - DFU's masters and a pack's
 *  files carry one, and a kept BOM makes the header a row). */
const readRows = (p) => (existsSync(p) ? new Map(loadStringTableCsv(readFileSync(p, 'utf8')) ?? []) : new Map());
/** The parser trims a value's outer line breaks, so a written value never carries them. */
const tidy = (s) => String(s).replace(/^[\r\n]+|[\r\n]+$/g, '');

/**
 * Draft `table` for `code`. `model(rows, fix, system)` answers { key: text } for [key, english] rows (the API in a
 * real run, a stand-in in the tests). Writes the table and its meta unless `dryRun`. Answers the run's account.
 */
export async function translateTable({ code, table, root = ROOT, model, modelId = DEFAULT_MODEL, batch = 40, jobs = 4, limit = Infinity, retranslate = false, dryRun = false, log = () => {} }) {
  const src = SOURCES[table];
  if (!src) throw new Error(`no source for ${table} (known: ${Object.keys(SOURCES).join(', ')})`);
  if (!catalogLocale(code) || code === 'en' || catalogLocale(code).hidden) throw new Error(`${code} is not a language the catalog drafts`);
  const englishPath = join(root, src.path);
  if (!existsSync(englishPath)) throw new Error(`${src.path} is not there - the English source comes first`);
  const english = readRows(englishPath);
  const outPath = join(root, 'locales', code, `${table}.csv`);
  const metaPath = join(root, 'locales', code, `${table}.meta.json`);
  const rows = readRows(outPath);
  const plan = planRun(english, rows, readJson(metaPath, {}), { retranslate });
  const owed = plan.draft.slice(0, limit);
  const account = { table, code, rows: english.size, drafted: 0, kept: plan.human.length, stale: plan.stale, done: plan.done.length, owed: owed.length, rejected: [] };
  const system = systemPrompt({ code, table, glossary: readJson(join(root, 'locales', code, 'glossary.json'), {}) });
  const groups = batchesOf(owed, batch);
  if (dryRun) {
    log(system);
    groups.forEach((g, i) => log(`batch ${i + 1}/${groups.length}: ${g.length} rows (${g[0]} .. ${g.at(-1)})`));
    return account;
  }
  const meta = plan.meta;
  const drafted = new Map();
  const runOne = async (keys) => {
    const pairs = keys.map((k) => [k, english.get(k)]);
    let answer = await model(pairs, null, system);
    const bad = pairs.filter(([k, en]) => checkDraft(en, tidy(answer[k] ?? ''), src.kind).length);
    if (bad.length) {
      const fix = bad.map(([k, en]) => `${k}: ${checkDraft(en, tidy(answer[k] ?? ''), src.kind).join('; ')}`).join('\n');
      const again = await model(bad, fix, system);
      answer = { ...answer, ...again };
    }
    for (const [k, en] of pairs) {
      const text = tidy(answer[k] ?? '');
      const problems = checkDraft(en, text, src.kind);
      if (problems.length) { account.rejected.push(`${k}: ${problems.join('; ')}`); continue; }
      drafted.set(k, text);
      meta[k] = { en: hash(en), tr: hash(text), by: modelId };
    }
    log(`${table} ${code}: ${drafted.size}/${owed.length}`);
  };
  for (let i = 0; i < groups.length; i += jobs) await Promise.all(groups.slice(i, i + jobs).map(runOne));
  account.drafted = drafted.size;
  // the table in the English's own key order, a person's rows as they are
  const out = [];
  for (const key of english.keys()) {
    const v = drafted.get(key) ?? rows.get(key);
    if (v !== undefined) out.push([key, tidy(v)]);
  }
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, formatStringTableCsv(out));
  writeFileSync(metaPath, JSON.stringify(Object.fromEntries(Object.entries(meta).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))), null, 1) + '\n');
  return account;
}

// ─── the command ───────────────────────────────────────────────────────────────────────────────────────────────────
export function parseArgs(argv) {
  const o = { batch: 40, jobs: 4, limit: Infinity, model: DEFAULT_MODEL, retranslate: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--lang') o.code = argv[++i];
    else if (a === '--table') o.table = argv[++i];
    else if (a === '--model') o.model = argv[++i];
    else if (a === '--batch') o.batch = Math.max(1, Number(argv[++i]) | 0);
    else if (a === '--jobs') o.jobs = Math.max(1, Number(argv[++i]) | 0);
    else if (a === '--limit') o.limit = Math.max(0, Number(argv[++i]) | 0);
    else if (a === '--retranslate') o.retranslate = true;
    else if (a === '--dry-run') o.dryRun = true;
    else throw new Error(`unknown option ${a}`);
  }
  if (!o.code || !o.table) throw new Error('usage: node tools/translate.mjs --lang <tag> --table <table> [--model id] [--batch n] [--jobs n] [--limit n] [--retranslate] [--dry-run]');
  return o;
}

if (isMain(import.meta.url)) {
  try {
    const o = parseArgs(process.argv.slice(2));
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!o.dryRun && !apiKey) throw new Error('ANTHROPIC_API_KEY is not set (or pass --dry-run)');
    const model = (rows, fix, system) => callClaude({ apiKey, model: o.model, system, rows, fix });
    const account = await translateTable({ code: o.code, table: o.table, model, modelId: o.model, batch: o.batch, jobs: o.jobs, limit: o.limit, retranslate: o.retranslate, dryRun: o.dryRun, log: (s) => console.log(s) });
    console.log(JSON.stringify({ ...account, rejected: account.rejected.length }, null, 1));
    for (const r of account.rejected) console.error(`rejected ${r}`);
    for (const k of account.stale) console.error(`stale (a person's row; its English changed): ${k}`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
