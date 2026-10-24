#!/usr/bin/env node
// L10N6 (2026-10-03): THE COVERAGE REPORT, LANGUAGE BY LANGUAGE.
//
// Mac's second decision (Localization-Arc.md): "The game says which languages are machine translated, and fixes come in
// through a review file or PRs. A human pack always outranks a draft." This says, for every language the catalog
// offers, how much of the game a player reads in it and whose words they are:
//   - THE PORT'S OWN WORDS (Port_Strings): the English catalog's keys the language has a row for, split into the
//     machine's (the pipeline's or an in-session draft, recorded in `Port_Strings.meta.json` and unedited since) and a
//     person's (a row nobody drafted, or one edited after - tools/translate.mjs planRun's own ownership law), the rows
//     still owed, and a person's rows whose English has moved since (stale, theirs to review);
//   - A BUNDLED PACK (locales/<tag>/pack/, L10N6): its string tables' rows against Daggerfall Unity's English masters
//     (vendor/dfu-text), and its quests and books - the text a player would otherwise install from their own files.
// A pack a player installs is theirs and never in the tree, so it is not counted here; the game's Language row says
// it has one.
//
//   node tools/l10nCoverage.mjs             the report, as a Markdown table
//   node tools/l10nCoverage.mjs --json      the same numbers as JSON
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseStringTableCsv } from '../src/systems/textManager.js';
import { LOCALE_CATALOG } from '../src/systems/localeCatalog.js';
import { planRun } from './translate.mjs';
import { readBundledPack } from './l10nPack.mjs';
import { isMain } from './lib/isMain.mjs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TABLE = 'Port_Strings';

const readCsv = (p) => (existsSync(p) ? new Map(parseStringTableCsv(readFileSync(p, 'utf8'))) : new Map());
const readJson = (p, fallback) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return fallback; } };

/** DFU's English masters' row counts, by table (vendor/dfu-text/<Table>.csv). */
export function masterCounts(root = ROOT) {
  const dir = join(root, 'vendor/dfu-text');
  const out = {};
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.csv'))) out[f.slice(0, -4)] = readCsv(join(dir, f)).size;
  return out;
}

/** One language's numbers. */
export function languageCoverage(code, root = ROOT, { english = readCsv(join(root, 'locales/en', `${TABLE}.csv`)), masters = masterCounts(root) } = {}) {
  const dir = join(root, 'locales', code);
  const rows = readCsv(join(dir, `${TABLE}.csv`));
  const meta = readJson(join(dir, `${TABLE}.meta.json`), {});
  const plan = planRun(english, rows, meta);
  const person = plan.human.length;
  const owed = plan.draft.filter((k) => !rows.has(k)).length;
  const port = { total: english.size, have: english.size - owed, machine: english.size - owed - person, person, owed, stale: plan.stale.length };
  const pack = readBundledPack(code, root);
  const bundled = pack ? {
    name: pack.meta.name, license: pack.meta.license,
    tables: Object.fromEntries(Object.entries(pack.tables).map(([t, n]) => [t, { rows: n, of: masters[t] ?? null }])),
    quests: pack.quests, books: pack.books,
  } : null;
  return { code, port, bundled };
}

/** Every offered language (the catalog's, English and hidden ones aside). */
export function coverage(root = ROOT) {
  const english = readCsv(join(root, 'locales/en', `${TABLE}.csv`));
  const masters = masterCounts(root);
  return LOCALE_CATALOG.filter((l) => l.code !== 'en' && !l.hidden && existsSync(join(root, 'locales', l.code)) && statSync(join(root, 'locales', l.code)).isDirectory())
    .map((l) => ({ ...languageCoverage(l.code, root, { english, masters }), name: l.englishName, own: l.name }));
}

const pct = (n, d) => (d ? `${Math.floor((n / d) * 1000) / 10}%` : '-');

/** The report as Markdown. */
export function coverageMarkdown(report) {
  const out = ['| Language | Tag | The port\'s own words | Machine | A person\'s | Owed | Stale | Bundled pack |', '|---|---|---|---|---|---|---|---|'];
  for (const r of report) {
    const p = r.port;
    const pack = r.bundled ? `${r.bundled.name} (${r.bundled.license}): ${Object.entries(r.bundled.tables).map(([t, v]) => `${t} ${v.rows}${v.of ? `/${v.of}` : ''}`).join(', ')}${r.bundled.quests ? `, ${r.bundled.quests} quests` : ''}${r.bundled.books ? `, ${r.bundled.books} books` : ''}` : '-';
    out.push(`| ${r.name} (${r.own}) | ${r.code} | ${p.have}/${p.total} (${pct(p.have, p.total)}) | ${p.machine} | ${p.person} | ${p.owed} | ${p.stale} | ${pack} |`);
  }
  return `${out.join('\n')}\n`;
}

if (isMain(import.meta.url)) {
  const report = coverage();
  if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 1));
  else process.stdout.write(coverageMarkdown(report));
}
