#!/usr/bin/env node
// OWN-WORDS1 (2026-10-31; bible/06-Systems/Own-Words.md): THE RATCHET ON BETHESDA'S WORDS. Daggerfall Unity's MIT data
// carries Daggerfall's own text (Own-Work.md, NO-BETHESDA). This counts what the game still reads of it: DFU's quest
// scripts read with DFU's messages, those messages, and Internal_RSC.csv's rows (TEXT.RSC). The counts are held to
// tools/bethesdaWordsBaseline.json, which only goes down (test/tooling/bethesdawords.test.js).
//   node tools/bethesdaWords.mjs           report what is past the baseline, and what could be lowered
//   node tools/bethesdaWords.mjs --lower   rewrite the baseline to today's counts (never raises one)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseStringTableCsv } from '../src/systems/textManager.js';
import { ROOT, DFU_DIR, ownQuestNames, splitQuest, rawMessages } from './ownQuestCheck.mjs';
import { isMain } from './lib/isMain.mjs';

export { ROOT };
export const BASELINE = 'tools/bethesdaWordsBaseline.json';
export const RSC_TABLE = 'vendor/dfu-text/Internal_RSC.csv';
/** The baseline's counts: DFU's quests the game reads in DFU's words, their messages, and TEXT.RSC's rows. */
export const PARTS = Object.freeze(['quests', 'messages', 'internalRsc']);

const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '').replace(/\r\n?/g, '\n');

/** Today's counts. A DFU quest with no message carries no words; one we carry in our own words is ours. */
export function measure(root = ROOT) {
  const own = new Set(ownQuestNames(root));
  let quests = 0, messages = 0;
  for (const f of readdirSync(join(root, DFU_DIR)).sort()) {
    if (!f.endsWith('.txt') || own.has(f.slice(0, -4))) continue;
    const parts = splitQuest(read(join(root, DFU_DIR, f)));
    const n = parts ? rawMessages(parts.qrc).length : 0;
    if (n) { quests++; messages += n; }
  }
  return { quests, messages, internalRsc: parseStringTableCsv(read(join(root, RSC_TABLE))).length };
}

/** Against `base`: a count past its baseline, and a count now lower than written. */
export function verdict(now, base) {
  const over = [], stale = [];
  for (const p of PARTS) {
    if ((now[p] ?? 0) > (base[p] ?? 0)) over.push(`${p}: ${now[p]} (allowed ${base[p] ?? 0})`);
    else if ((now[p] ?? 0) < (base[p] ?? 0)) stale.push(`${p}: ${now[p]} (baseline ${base[p]})`);
  }
  return { over, stale };
}

/** The baseline lowered to `now`, never raised. */
export const lowered = (base, now) => Object.fromEntries(PARTS.map((p) => [p, Math.min(base[p] ?? 0, now[p] ?? 0)]));

if (isMain(import.meta.url)) {
  const path = join(ROOT, BASELINE);
  const base = JSON.parse(readFileSync(path, 'utf8'));
  const now = measure();
  if (process.argv.includes('--lower')) {
    writeFileSync(path, `${JSON.stringify(lowered(base, now), null, 1)}\n`);
    console.log('baseline lowered');
  } else {
    const { over, stale } = verdict(now, base);
    for (const o of over) console.log(`OVER  ${o}`);
    for (const s of stale) console.log(`LOWER ${s}`);
    if (!over.length && !stale.length) console.log(`Bethesda's words: ${now.quests} quests (${now.messages} messages) and ${now.internalRsc} TEXT.RSC rows, at the baseline`);
    process.exitCode = over.length || stale.length ? 1 : 0;
  }
}
