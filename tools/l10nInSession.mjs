#!/usr/bin/env node
// L10N4 (2026-09-28): THE PORT'S OWN STRINGS, DRAFTED IN-SESSION, WRITTEN WHERE THE GAME READS THEM.
//
// Mac's third decision: the port's own strings are translated in-session (the game's text goes through
// tools/translate.mjs on his key). Every language the catalog marks machine-made covers the English catalog exactly
// (test/l10n1b.test.js), and every row it holds is recorded in `<table>.meta.json` as the machine's
// (`claude-in-session`), so the pipeline redrafts it when its English moves and never mistakes it for a person's
// (test/l10n6b.test.js). This is the one door such drafts come in by: a JSON file of `{ "<lang>": { "<key>": "text" } }`
// is checked row by row with the pipeline's own placeholder law (checkDraft - the English's ICU arguments by name,
// a language's own plural categories allowed), merged into `locales/<lang>/Port_Strings.csv` in the catalog's order and
// the port's own CSV form, and recorded. A row a PERSON wrote or edited is never replaced: it is reported and kept. A
// key the English catalog no longer has is dropped, with its record. What a language still owes is said at the end.
//
//   node tools/l10nInSession.mjs drafts.json            merge, record, and list what is still owed (exit 1 if any)
//   node tools/l10nInSession.mjs --owed [lang ...]      the English each language still owes, as a drafts template
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseStringTableCsv, formatStringTableCsv } from '../src/systems/textManager.js';
import { checkDraft, hash, planRun } from './translate.mjs';
import { isMain } from './lib/isMain.mjs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const IN_SESSION = 'claude-in-session';
const TABLE = 'Port_Strings';

const catalogOf = (root) => new Map(parseStringTableCsv(readFileSync(join(root, 'locales/en', `${TABLE}.csv`), 'utf8')));
/** The languages with a Port_Strings table of their own (every folder but English's). */
export const draftLanguages = (root = ROOT) => readdirSync(join(root, 'locales'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== 'en' && existsSync(join(root, 'locales', d.name, `${TABLE}.csv`))).map((d) => d.name).sort();

function readLanguage(root, code) {
  const csv = join(root, 'locales', code, `${TABLE}.csv`), metaPath = join(root, 'locales', code, `${TABLE}.meta.json`);
  const rows = new Map(existsSync(csv) ? parseStringTableCsv(readFileSync(csv, 'utf8')) : []);
  const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {};
  return { csv, metaPath, rows, meta };
}

/** What each language owes: the catalog's keys it has no current machine row for (plan.draft), with the English. */
export function owed(root = ROOT, langs = draftLanguages(root)) {
  const en = catalogOf(root);
  const out = {};
  for (const code of langs) {
    const { rows, meta } = readLanguage(root, code);
    const plan = planRun(en, rows, meta);
    out[code] = Object.fromEntries(plan.draft.map((k) => [k, en.get(k)]));
  }
  return out;
}

/**
 * Merge `drafts` ({ lang: { key: text } }) into the languages' tables. Answers { written, refused, kept, dropped, owed }:
 * refused - drafts that failed the placeholder law or name no catalog key; kept - rows a person owns, left as they are.
 */
export function mergeDrafts(drafts, root = ROOT) {
  const en = catalogOf(root);
  const report = { written: {}, refused: [], kept: [], dropped: [], owed: {} };
  for (const [code, rowsIn] of Object.entries(drafts)) {
    if (code === 'en' || !/^[a-z]{2,3}(-[A-Za-z0-9]+)*$/.test(code)) { report.refused.push(`${code}: not a language folder`); continue; }
    const { csv, metaPath, rows, meta } = readLanguage(root, code);
    const plan = planRun(en, rows, meta);
    const people = new Set(plan.human);
    const nextMeta = { ...plan.meta };
    let n = 0;
    for (const [key, text] of Object.entries(rowsIn ?? {})) {
      if (!en.has(key)) { report.refused.push(`${code} ${key}: not in the English catalog`); continue; }
      if (people.has(key)) { report.kept.push(`${code} ${key}`); continue; }
      const problems = checkDraft(en.get(key), text, 'icu');
      if (problems.length) { report.refused.push(`${code} ${key}: ${problems.join('; ')}`); continue; }
      rows.set(key, text);
      nextMeta[key] = { en: hash(en.get(key)), tr: hash(text), by: IN_SESSION };
      n++;
    }
    for (const key of [...rows.keys()]) if (!en.has(key)) { rows.delete(key); delete nextMeta[key]; report.dropped.push(`${code} ${key}`); }
    const ordered = [...en.keys()].filter((k) => rows.has(k)).map((k) => [k, rows.get(k)]);
    writeFileSync(csv, formatStringTableCsv(ordered));
    const metaOrdered = Object.fromEntries([...en.keys()].filter((k) => nextMeta[k]).map((k) => [k, nextMeta[k]]));
    writeFileSync(metaPath, `${JSON.stringify(metaOrdered, null, 1)}\n`);
    report.written[code] = n;
  }
  report.owed = Object.fromEntries(Object.entries(owed(root)).map(([c, o]) => [c, Object.keys(o).length]).filter(([, k]) => k));
  return report;
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args[0] === '--owed') {
    const langs = args.slice(1).length ? args.slice(1) : draftLanguages();
    console.log(JSON.stringify(owed(ROOT, langs), null, 1));
  } else if (args[0]) {
    const r = mergeDrafts(JSON.parse(readFileSync(args[0], 'utf8')));
    for (const [c, n] of Object.entries(r.written)) console.log(`${c}: ${n} rows written`);
    for (const x of r.refused) console.error(`refused  ${x}`);
    for (const x of r.kept) console.log(`kept (a person's)  ${x}`);
    for (const x of r.dropped) console.log(`dropped (not in the catalog)  ${x}`);
    for (const [c, n] of Object.entries(r.owed)) console.error(`${c} still owes ${n}`);
    process.exit(r.refused.length || Object.keys(r.owed).length ? 1 : 0);
  } else {
    console.error('usage: node tools/l10nInSession.mjs <drafts.json> | --owed [lang ...]');
    process.exit(2);
  }
}
