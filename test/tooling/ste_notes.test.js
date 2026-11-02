// STE-NOTES (2026-10-26, the owner: "The law for patch notes is now
// ASD-STE100 Simplified Technical English (STE)") - A PULL REQUEST'S PATCH
// NOTES ARE WRITTEN IN STE. scripts/steNotes.mjs reads a description's notes
// as the release reads them (patchNotesOf) and reports each place they break
// a rule of STE a machine can read; .github/workflows/ste-notes.yml runs it
// on every description. Each rule is pinned both ways here: a sentence that
// breaks it is found, and its STE twin is clean.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { steFindings, steWords, steSentences, STE_SENTENCE_MAX, STE_INSTRUCTION_MAX, STE_PARAGRAPH_MAX, NOT_A_VERB } from '../../scripts/steNotes.mjs';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
/** A description whose notes are `body`, with a reviewers' section after them that the check never reads. */
const pr = (body) => `## Patch notes: The Sea\n\n${body}\n\n## What changed\n\nRewrote it; the reviewers' part is not notes, so nothing here counts.`;
/** The rules a description's notes break, in order. */
const rules = (body) => steFindings(pr(body)).map((f) => f.rule);
/** `n` words, with no full stop. */
const run = (n, first = 'Ships') => [first, ...Array.from({ length: n - 1 }, () => 'sail')].join(' ');
/** A sentence of `n` words. */
const words = (n, first = 'Ships') => `${run(n, first)}.`;

test('STE-NOTES: the limits are STE\'s - 25 words in a sentence, 20 in an instruction, six sentences in a paragraph', () => {
  assert.deepEqual([STE_SENTENCE_MAX, STE_INSTRUCTION_MAX, STE_PARAGRAPH_MAX], [25, 20, 6]);
});

test('STE-NOTES: words are counted as STE counts them - a hyphenated word, a number with its unit and a marked name are each one word', () => {
  assert.deepEqual(steWords('The high-refresh screen reloads in 60 s, or 1.36s.'), ['the', 'high-refresh', 'screen', 'reloads', 'in', '60', 'or', '1.36s']);
  assert.deepEqual(steWords('Bows hit 35 % harder → and faster.'), ['bows', 'hit', '35', 'harder', 'and', 'faster'], 'a bare arrow is no word, a percent sign is the number\'s');
  // a name in **bold**, `code` or "quotes" is one word, however many it holds
  assert.deepEqual(rules(`- ${run(22)} **Settings Gameplay Climbing and gathering** \`resource-highlights on\` "E: board".`), [], 'three names, 25 words');
  assert.deepEqual(rules(`- ${run(22)} Settings Gameplay Climbing and Fishing.`), ['length'], 'five words unmarked, 27');
});

test('STE-NOTES: a sentence of 25 words passes and one of 26 does not; an instruction stops at 20, after any condition put first', () => {
  assert.deepEqual(rules(`- ${words(25)}`), []);
  assert.deepEqual(rules(`- ${words(26)}`), ['length']);
  assert.deepEqual(rules(`- ${words(20, 'Select')}`), []);
  assert.deepEqual(rules(`- ${words(21, 'Select')}`), ['length']);
  const found = steFindings(pr(`- ${words(21, 'Select')}`));
  assert.match(found[0].message, /^an instruction of 21 words - STE allows 20: "Select sail/);
  // STE puts a condition first: "If ..., <command>" is an instruction
  assert.deepEqual(rules('- If another player kills you in the zone, select the item and choose Insure to keep your gear for the next fight.'), ['length']);
  assert.deepEqual(rules('- If another player kills you in the zone, nothing drops from your bag and your cart stays with your horse today.'), [],
    'a condition before a statement is no instruction - 22 words is a sentence');
});

test('STE-NOTES: a paragraph - a list item or a block of prose - holds six sentences at most', () => {
  const six = Array.from({ length: 6 }, () => 'Bows hit harder.').join(' ');
  assert.deepEqual(rules(`- ${six}`), []);
  assert.deepEqual(rules(`- ${six} Arrows fly faster.`), ['paragraph']);
  assert.deepEqual(rules(`${six}\nArrows fly faster.`), ['paragraph'], 'a block of prose over two lines is one paragraph');
  assert.deepEqual(rules(`- ${six}\n  Arrows fly faster.`), ['paragraph'], 'an item\'s indented line is the item\'s');
  assert.deepEqual(rules(`- ${six}\n- Arrows fly faster.`), [], 'a new item is a new paragraph');
  assert.deepEqual(rules(`${six}\n\nArrows fly faster.`), [], 'and so is a block after a blank line');
  // a full stop inside a number or after "e.g." ends no sentence
  assert.deepEqual(steSentences('The reload is 1.36s now. Tools, e.g. the Sickle, wear less.'), ['The reload is 1.36s now.', 'Tools, e.g. the Sickle, wear less.']);
});

test('STE-NOTES: no semicolon - STE writes two sentences', () => {
  assert.deepEqual(rules('- Bows hit harder; arrows fly faster.'), ['semicolon']);
  assert.deepEqual(rules('- Bows hit harder. Arrows fly faster.'), []);
  assert.deepEqual(rules('- The Mages Guild &amp; the Temple sell it. Set `a; b` in the console.'), [], 'an entity\'s and a name\'s are not the writer\'s');
});

test('STE-NOTES: no -ing form of a verb, except in a technical name', () => {
  assert.deepEqual(rules('- Picking a lock is now a game.'), ['ing'], 'at the head of a sentence the capital is the sentence\'s, not a name\'s');
  assert.deepEqual(rules('- You now pick a lock in a game, including chests.'), ['ing']);
  assert.deepEqual(rules('- Other players are heard on high-refresh screens while gathering.'), ['ing']);
  assert.deepEqual(rules('- Bows are hard-hitting.'), ['ing'], 'each part of a hyphenated word is read');
  assert.deepEqual(rules('- You now pick a lock in a game. This includes chests.'), []);
  // a name keeps its capital mid-sentence, or is marked
  assert.deepEqual(rules('- Your Lockpicking skill sets the window. The **Fishing-Net** tugs. Set `resource-highlights` to Glint.'), []);
  // nouns that only end in -ing, and plurals, which are never verb forms
  assert.deepEqual(rules('- Nothing drops. A new setting is in Settings. Rings, buildings and key bindings stay. Rain falls during a storm.'), []);
  for (const w of ['thing', 'ring', 'setting', 'during', 'king']) assert.ok(NOT_A_VERB.has(w), w);
  // a heading is a title: its capitals are names, its lowercase words are read
  assert.deepEqual(steFindings('## Patch notes: Lockpicking and Climbing\n\n### Gathering\n\n- Locks open.'), []);
  assert.deepEqual(steFindings('## Patch notes: Boarding without ramming\n\n- Ships board.').map((f) => f.message.slice(0, 32)), ['"ramming" is an -ing form - STE ']);
  // text in a code fence is not prose
  assert.deepEqual(rules('```\nrunning, picking; can\'t\n```\n\n- Locks open.'), []);
});

test('STE-NOTES: no contraction - STE writes both words', () => {
  assert.deepEqual(rules('- The gear doesn\'t drop.'), ['contraction']);
  assert.deepEqual(rules('- It\'s safe now.'), ['contraction']);
  assert.deepEqual(rules('- You can’t store it.'), ['contraction'], 'a curly apostrophe too');
  assert.deepEqual(rules('- The gear does not drop. The player\'s gear stays.'), [], 'a possessive is no contraction');
});

test('STE-NOTES: no helping verb that makes a complex verb - the simple present, the simple past or the future', () => {
  assert.deepEqual(rules('- The policy has been used up.'), ['helping-verb']);
  assert.deepEqual(rules('- We have fixed a bug.'), ['helping-verb']);
  assert.deepEqual(rules('- The pull has now taken the ship alongside.'), ['helping-verb']);
  assert.deepEqual(rules('- The bug has changed.'), ['helping-verb']);
  assert.deepEqual(rules('- We fixed a bug. The policy is used up. The ship will come alongside.'), []);
  // an -ed word before a noun is an adjective, and some participles are game words
  assert.deepEqual(rules('- Some chests have enchanted items. Ships have hit points. Dungeons have hidden doors. Swords have built-in sigils.'), []);
});

test('STE-NOTES: only the patch notes are read - the reviewers\' sections, the template and a description without notes are not', () => {
  const template = rd('.github/pull_request_template.md');
  assert.deepEqual(steFindings(template), [], 'the template as it stands is no notes');
  assert.deepEqual(steFindings('## What changed\n\nIt\'s rewritten; having been broken.'), []);
  assert.deepEqual(steFindings(null), []);
  // a report quotes the writer's own words, names and all
  const [f] = steFindings(pr('- Select **Insure**; the policy holds.'));
  assert.equal(f.message, 'a semicolon - STE uses none, write two sentences: "Select **Insure**; the policy holds."');
});

test('STE-NOTES: the check runs as a program - 1 with the findings named, 0 when the notes keep the rules or there are none', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ste-notes-'));
  try {
    const run = (body) => {
      writeFileSync(join(dir, 'd.md'), body);
      return spawnSync(process.execPath, [fileURLToPath(new URL('../../scripts/steNotes.mjs', import.meta.url)), join(dir, 'd.md')], { encoding: 'utf8' });
    };
    const bad = run(pr('- Picking a lock doesn\'t cost anything.'));
    assert.equal(bad.status, 1);
    assert.match(bad.stdout, /break STE in 2 places/);
    assert.match(bad.stdout, /"Picking" is an -ing form/);
    assert.match(bad.stdout, /"doesn't" is a contraction/);
    const good = run(pr('- You now pick a lock in a game. A pick that breaks is gone.'));
    assert.equal(good.status, 0, good.stdout);
    const none = run(rd('.github/pull_request_template.md'));
    assert.equal(none.status, 0);
    assert.match(none.stdout, /no patch notes/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('STE-NOTES: the pull request\'s ste-notes check reads every description - opened, edited, pushed - as data, with a read-only token', () => {
  const wf = rd('.github/workflows/ste-notes.yml');
  assert.match(wf, /\non:\n {2}pull_request:\n {4}types: \[opened, edited, reopened, synchronize\]\n/, 'an edited description is read again');
  assert.doesNotMatch(wf.replace(/^\s*#.*$/gm, ''), /pull_request_target/, 'the pull request\'s own script, never with the repository\'s token');
  assert.match(wf, /\npermissions:\n {2}contents: read\n/);
  assert.match(wf, /persist-credentials: false/);
  assert.match(wf, /\n {10}DESCRIPTION: \$\{\{ github\.event\.pull_request\.body \}\}\n/, 'the description reaches the script through the environment');
  assert.equal(wf.match(/\$\{\{ github\.event\.pull_request\.body \}\}/g).length, 1, 'and is pasted nowhere else');
  assert.match(wf, /\n {10}set -o pipefail\n[\s\S]*node scripts\/steNotes\.mjs "\$RUNNER_TEMP\/description\.md" \| tee -a "\$GITHUB_STEP_SUMMARY"\n/,
    'a finding fails the step through the tee');
  // the job checks out only what its sparse list names - and the check runs from that alone
  const sparse = /\n {10}sparse-checkout: \|\n((?: {12}\S+\n)+)/.exec(wf)?.[1].trim().split(/\s+/) ?? [];
  assert.ok(sparse.includes('scripts'), 'the sparse checkout holds the check');
  const dir = mkdtempSync(join(tmpdir(), 'ste-sparse-'));
  try {
    for (const d of sparse) cpSync(fileURLToPath(new URL(`../../${d}`, import.meta.url)), join(dir, d), { recursive: true });
    writeFileSync(join(dir, 'd.md'), pr('- Picking a lock is a game.'));
    const got = spawnSync(process.execPath, [join(dir, 'scripts/steNotes.mjs'), join(dir, 'd.md')], { encoding: 'utf8' });
    assert.equal(got.status, 1, `a sparse checkout runs the check: ${got.stderr}`);
    assert.match(got.stdout, /"Picking" is an -ing form/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  // the template tells the writer the law before the check does
  const template = rd('.github/pull_request_template.md');
  assert.match(template, /ASD-STE100 Simplified Technical English/);
  assert.match(template, /scripts\/steNotes\.mjs/);
});
