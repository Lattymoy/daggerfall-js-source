// OWN-WORDS1 (2026-10-31, bible/06-Systems/Own-Words.md; the owner: "We plan on moving away from arena so whatever works
// for future proofing"). Daggerfall Unity's MIT data carries Daggerfall's own words (Own-Work.md, NO-BETHESDA): its quest
// scripts' messages and TEXT.RSC's rows. tools/bethesdaWords.mjs counts what the game still reads of them, and
// tools/bethesdaWordsBaseline.json holds the counts, which only go down: a quest in our own words lowers them, and the
// baseline is written lower in the same change (node tools/bethesdaWords.mjs --lower).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { measure, verdict, lowered, PARTS, BASELINE, RSC_TABLE, ROOT } from '../../tools/bethesdaWords.mjs';
import { ownQuestNames, splitQuest, rawMessages, DFU_DIR } from '../../tools/ownQuestCheck.mjs';

const base = JSON.parse(readFileSync(join(ROOT, BASELINE), 'utf8'));
const none = Object.fromEntries(PARTS.map((p) => [p, 0]));

test('BETHESDA-WORDS nothing of Bethesda\'s words grows, and a count a rewrite lowered is written lower (node tools/bethesdaWords.mjs --lower)', () => {
  const { over, stale } = verdict(measure(), base);
  assert.deepEqual(over, [], 'more of DFU\'s words read than the baseline allows - write the quest in our own words (tools/ownQuestCheck.mjs)');
  assert.deepEqual(stale, [], 'fewer of DFU\'s words read - lower the baseline: node tools/bethesdaWords.mjs --lower');
});

test('BETHESDA-WORDS the baseline is the three counts, each a whole number, and TEXT.RSC\'s 1,448 rows are unchanged in OWN-WORDS1', () => {
  assert.deepEqual(Object.keys(base), [...PARTS]);
  for (const p of PARTS) assert.ok(Number.isSafeInteger(base[p]) && base[p] >= 0, p);
  assert.equal(base.internalRsc, 1448);
  assert.equal(RSC_TABLE, 'vendor/dfu-text/Internal_RSC.csv');
});

test('BETHESDA-WORDS the count is DFU\'s quests that carry messages, less ours: an own file takes its quest and every message off (mutants: own files uncounted; a quest of no message counted)', () => {
  const own = new Set(ownQuestNames());
  let quests = 0, messages = 0, withWords = 0, ownMessages = 0;
  for (const f of readdirSync(join(ROOT, DFU_DIR))) {
    if (!f.endsWith('.txt')) continue;
    const n = rawMessages(splitQuest(readFileSync(join(ROOT, DFU_DIR, f), 'utf8').replace(/\r\n?/g, '\n')).qrc).length;
    if (!n) continue;
    withWords++;
    if (own.has(f.slice(0, -4))) { ownMessages += n; continue; }
    quests++; messages += n;
  }
  assert.equal(withWords, 264, 'DFU\'s 265 scripts, __DEMO01 alone with no message');
  assert.ok(own.size >= 20 && ownMessages >= 311, 'OWN-WORDS1\'s twenty, and their 311 messages');
  assert.deepEqual(measure(), { quests, messages, internalRsc: 1448 });
  assert.equal(quests, withWords - own.size);
});

test('BETHESDA-WORDS the verdict: a count past the baseline is over; one lower than written is stale until lowered; lowering never raises (mutants: a rise let through; a fall unread; a raise on --lower)', () => {
  assert.deepEqual(verdict({ ...none, quests: 3 }, { ...none, quests: 2 }), { over: ['quests: 3 (allowed 2)'], stale: [] });
  assert.deepEqual(verdict({ ...none, messages: 9 }, { ...none, messages: 10 }), { over: [], stale: ['messages: 9 (baseline 10)'] });
  assert.deepEqual(verdict({ ...none, internalRsc: 5 }, { ...none, internalRsc: 5 }), { over: [], stale: [] });
  assert.deepEqual(lowered({ quests: 5, messages: 50, internalRsc: 7 }, { quests: 4, messages: 60, internalRsc: 7 }), { quests: 4, messages: 50, internalRsc: 7 });
});

test('BETHESDA-WORDS the open items are written where a contributor reads them: Own-Words.md names TEXT.RSC\'s table and DFU\'s tables of names', () => {
  const page = readFileSync(join(ROOT, 'bible/06-Systems/Own-Words.md'), 'utf8');
  for (const t of ['Internal_RSC.csv', 'Internal_Locations.csv', 'Internal_Factions.csv', 'Internal_Items.csv', 'Internal_Strings.csv', 'tools/bethesdaWordsBaseline.json', 'tools/ownQuestCheck.mjs']) {
    assert.ok(page.includes(t), `Own-Words.md names ${t}`);
  }
});

test('BETHESDA-WORDS every quest still in DFU\'s words has its batch in Own-Words.md\'s table, once (mutants: a quest left out)', () => {
  const page = readFileSync(join(ROOT, 'bible/06-Systems/Own-Words.md'), 'utf8');
  const listed = page.split('\n').filter((l) => /^\| \d+ \|/.test(l)).flatMap((l) => l.split('|')[3].trim().split(/\s+/));
  assert.deepEqual(listed.filter((n, i) => listed.indexOf(n) !== i), [], 'no quest in two batches');
  const own = new Set(ownQuestNames());
  for (const f of readdirSync(join(ROOT, DFU_DIR))) {
    const n = f.slice(0, -4);
    if (!f.endsWith('.txt') || own.has(n) || !rawMessages(splitQuest(readFileSync(join(ROOT, DFU_DIR, f), 'utf8').replace(/\r\n?/g, '\n')).qrc).length) continue;
    assert.ok(listed.includes(n), `${n} has a batch`);
  }
});
