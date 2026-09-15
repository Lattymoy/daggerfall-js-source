// AUDIT-QUEST - THE THREE MUTANTS THE WHOLE SUITE LET LIVE (2026-09-15).
//
// The campaign: 77 mutants over the 21 modules of `src/systems/quest`,
// the file list DERIVED (AUDIT-TALK's harness took a hand-written
// twelve-file list, reported thirteen survivors, and deriving gave
// eighty-seven files and caught eleven of them as artefacts of the
// harness rather than gaps in the port - that audit recorded a finding
// against itself for it).
//
// 66 of 77 died against a 65-file quest subset. Eleven survived; seven
// of those are guards over states the tests cannot reach, base-class
// defaults, or genuinely equivalent; one - `isResidence`'s bounds - was
// killed by a test OUTSIDE the subset, which is why a subset is a FILTER
// and the whole suite is the arbiter.
//
// THREE SURVIVED THE ENTIRE SUITE. Each is a law with a DFU citation
// that no assertion in 7,671 tests was reading. They are pinned here.
//
// THE HARNESS LIED TWICE BEFORE IT TOLD THE TRUTH, and both are worth
// writing down because both were caught the same way - by asking whether
// the number was believable:
//   1. It piped `node --test` through `tail` and read the PIPELINE's
//      exit status, which is tail's and always 0. Verdict: 77 of 84
//      mutants "survived". That is not a result about a port.
//   2. Re-reading the counters instead, it called `execSync('npm test')`
//      and read the returned stdout. The full suite prints tens of
//      megabytes; execSync's default maxBuffer is 1 MB, so it threw
//      ENOBUFS and handed back TRUNCATED output with no `# fail` line -
//      which the harness scored as a kill. All four candidates came back
//      "killed", and four real findings would have been retired.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EndQuest } from '../src/systems/quest/actions.js';
import { Foe } from '../src/systems/quest/foe.js';

test('AUDIT-QUEST M1: EndQuest says nothing when there is nothing to say (EndQuest.cs:Update)', () => {
  // `end quest saying 1011` pops that message; a bare `end quest` has
  // textId 0 and pops NOTHING. DFU guards it `if (textId != 0)`, and
  // inverting that comparison survived the whole suite: a bare end
  // would have shown message 0, and every `saying` would have shown
  // none.
  const shown = [];
  const quest = () => ({
    showMessagePopup: (id) => shown.push(id),
    questBreak: false,
    endQuest() { this.ended = true; },
    ended: false,
  });

  const bare = quest();
  const a = new EndQuest(bare);
  assert.ok(a.createNew('end quest', bare), 'the bare form parses');
  const parsedBare = a.createNew('end quest', bare);
  parsedBare.update(null);
  assert.deepEqual(shown, [], 'a bare `end quest` shows NO popup - textId is 0 and DFU tests it');
  assert.equal(bare.questBreak, true, '...and still breaks the quest');
  assert.equal(bare.ended, true, '...and still ends it');

  const saying = quest();
  const b = new EndQuest(saying).createNew('end quest saying 1011', saying);
  b.update(null);
  assert.deepEqual(shown, [1011], '`saying 1011` shows exactly that message');
});

test('AUDIT-QUEST M2: Foe.expandMacro answers FALSE for a macro it does not carry (Foe.cs:153-177)', () => {
  // `_symbol_` is the type name and `=symbol_` the display name - the
  // inversion is C#'s own - and every OTHER macro type is not this
  // resource's to answer. Returning true instead survived the whole
  // suite, which would have had a Foe claim it had expanded a macro it
  // never touched.
  const quest = { lastResourceReferenced: null };
  const foe = new Foe(quest);
  foe.typeName = 'Rat';
  foe.displayName = 'a rat';

  assert.equal(foe.expandMacro(1), 'Rat', 'NameMacro1 is the TYPE name');
  assert.equal(foe.expandMacro(5), 'a rat', 'DetailsMacro is the DISPLAY name');
  assert.strictEqual(quest.lastResourceReferenced, foe, 'and the foe becomes the quest\'s last reference, for pronouns');

  for (const other of [0, 2, 3, 4, 6, 7]) {
    assert.strictEqual(foe.expandMacro(other), false,
      `macro type ${other} is not a Foe's to answer - it must say FALSE, not claim success`);
  }
});

test('AUDIT-QUEST M3: a message id is bracketed only when BOTH brackets are there (Parser.cs)', async () => {
  // `QuestComplete: [1004]` takes its id from the static-messages table;
  // `Message: 1011` parses the number. The test is a PAIR - starts with
  // `[` AND ends with `]` - and loosening it to `||` survived the whole
  // suite, so a half-bracketed field would have been read as a table
  // lookup and its number thrown away.
  const { loadQuestTables } = await import('../src/systems/quest/tables.js');
  const { readFileSync, readdirSync } = await import('node:fs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const TD = join(root, 'vendor/dfu-quests/Tables');
  const tbl = {};
  for (const f of readdirSync(TD)) tbl[f.replace(/\.txt$/, '')] = readFileSync(join(TD, f), 'utf8');
  loadQuestTables(tbl);
  const { Parser } = await import('../src/systems/quest/parser.js');

  // _parseQRC is the reader that carries the law; drive it directly
  // with a quest stub, which is what the parser hands it in play.
  const parser = new Parser();
  const stubQuest = { messages: new Map(), addMessage(id, m) { this.messages.set(id, m); }, questName: 'M3' };
  const block = (idField) => [`QuestComplete:  ${idField}`, '', '<ce> done', ''];

  // the well-formed bracketed form resolves through the static table
  parser._parseQRC(stubQuest, block('[1004]'));
  assert.ok(stubQuest.messages.size >= 1, 'the bracketed form parses to a message');

  // ...and each HALF-bracketed form is not bracketed at all, so it has
  // to parse as a NUMBER - and neither of these is one.
  for (const half of ['[1004', '1004]']) {
    assert.throws(() => parser._parseQRC({ ...stubQuest, messages: new Map() }, block(half)), /Expected message ID value/,
      `"${half}" is not a bracketed id: only one bracket is there, so it must fail as a number`);
  }
});
