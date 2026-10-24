#!/usr/bin/env node
// L10N6 (2026-10-03): THE REVIEW FILE - how a person who reads a language fixes its machine draft without a code editor.
//
// Mac's second decision (Localization-Arc.md): "fixes come in through a review file or PRs. A human pack always
// outranks a draft." A pull request that edits `locales/<tag>/Port_Strings.csv` is one door (the pipeline already sees
// the edit and keeps the row the person's). This is the other: a language's rows exported as a spreadsheet - the key,
// the English, the current translation, whose it is, and an empty `fix` column - and the filled sheet imported back.
// Each fix is held to the pipeline's own placeholder law (tools/translate.mjs checkDraft: every `{argument}` the
// English names, a language's own plural categories) and recorded in `Port_Strings.meta.json` as a person's
// (`by: "human"`), so neither a session's drafts nor the pipeline ever writes over it. A row whose English moved since
// the sheet was exported is refused as stale: the fix was for other words.
//
//   node tools/l10nReview.mjs --export fr > fr-review.csv            every row (add --machine for the machine's alone)
//   node tools/l10nReview.mjs --import fr fr-review.csv              apply the filled `fix` cells (exit 1 if any refused)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseStringTableCsv, formatStringTableCsv } from '../src/systems/textManager.js';
import { catalogLocale } from '../src/systems/localeCatalog.js';
import { checkDraft, hash, planRun } from './translate.mjs';
import { isMain } from './lib/isMain.mjs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TABLE = 'Port_Strings';
export const REVIEW_COLUMNS = Object.freeze(['key', 'english', 'translation', 'owner', 'fix']);

const cell = (v) => (/[",\r\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
/** RFC 4180 rows, as a spreadsheet writes them (quotes doubled, a cell may hold a line break). */
export function parseCsv(text) {
  const rows = [];
  let row = [], cur = '', q = false;
  const s = String(text).replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((x) => x !== ''));
}

function readLanguage(root, code) {
  const csv = join(root, 'locales', code, `${TABLE}.csv`), metaPath = join(root, 'locales', code, `${TABLE}.meta.json`);
  const rows = new Map(existsSync(csv) ? parseStringTableCsv(readFileSync(csv, 'utf8')) : []);
  const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {};
  return { csv, metaPath, rows, meta };
}
const englishOf = (root) => new Map(parseStringTableCsv(readFileSync(join(root, 'locales/en', `${TABLE}.csv`), 'utf8')));
const assertLanguage = (code) => { if (code === 'en' || !catalogLocale(code)) throw new Error(`${code} is not a language the catalog drafts`); };

/** The review sheet for `code`: every catalog key in the catalog's order (or the machine's rows alone). */
export function exportReview(code, root = ROOT, { machineOnly = false } = {}) {
  assertLanguage(code);
  const en = englishOf(root);
  const { rows, meta } = readLanguage(root, code);
  const people = new Set(planRun(en, rows, meta).human);
  const lines = [REVIEW_COLUMNS.join(',')];
  for (const [key, english] of en) {
    const owner = !rows.has(key) ? 'missing' : people.has(key) ? 'person' : 'machine';
    if (machineOnly && owner !== 'machine') continue;
    lines.push([key, english, rows.get(key) ?? '', owner, ''].map(cell).join(','));
  }
  return `${lines.join('\n')}\n`;
}

/** Apply a filled sheet's `fix` cells to `code`. Answers { applied: [key], refused: [reason] }. */
export function importReview(code, sheet, root = ROOT) {
  assertLanguage(code);
  const [head, ...body] = parseCsv(sheet);
  const col = Object.fromEntries((head ?? []).map((h, i) => [h.trim().toLowerCase(), i]));
  if (col.key === undefined || col.english === undefined || col.fix === undefined) throw new Error(`the sheet has no ${['key', 'english', 'fix'].filter((c) => col[c] === undefined).join('/')} column`);
  const en = englishOf(root);
  const { csv, metaPath, rows, meta } = readLanguage(root, code);
  const report = { applied: [], refused: [] };
  for (const r of body) {
    const key = r[col.key], fix = r[col.fix] ?? '';
    if (!key || fix.trim() === '') continue;
    if (!en.has(key)) { report.refused.push(`${key}: not in the English catalog`); continue; }
    if (r[col.english] !== en.get(key)) { report.refused.push(`${key}: stale - its English changed since the sheet was exported`); continue; }
    const problems = checkDraft(en.get(key), fix, 'icu');
    if (problems.length) { report.refused.push(`${key}: ${problems.join('; ')}`); continue; }
    rows.set(key, fix);
    meta[key] = { en: hash(en.get(key)), tr: hash(fix), by: 'human' };
    report.applied.push(key);
  }
  if (report.applied.length) {
    writeFileSync(csv, formatStringTableCsv([...en.keys()].filter((k) => rows.has(k)).map((k) => [k, rows.get(k)])));
    writeFileSync(metaPath, `${JSON.stringify(Object.fromEntries([...en.keys()].filter((k) => meta[k]).map((k) => [k, meta[k]])), null, 1)}\n`);
  }
  return report;
}

if (isMain(import.meta.url)) {
  const [mode, code, file] = process.argv.slice(2).filter((a) => !a.startsWith('--machine'));
  try {
    if (mode === '--export' && code) process.stdout.write(exportReview(code, ROOT, { machineOnly: process.argv.includes('--machine') }));
    else if (mode === '--import' && code && file) {
      const r = importReview(code, readFileSync(file, 'utf8'));
      console.log(`${code}: ${r.applied.length} fixes applied, each now a person's row`);
      for (const x of r.refused) console.error(`refused  ${x}`);
      process.exit(r.refused.length ? 1 : 0);
    } else {
      console.error('usage: node tools/l10nReview.mjs --export <lang> [--machine] | --import <lang> <sheet.csv>');
      process.exit(2);
    }
  } catch (err) { console.error(err.message); process.exit(2); }
}
