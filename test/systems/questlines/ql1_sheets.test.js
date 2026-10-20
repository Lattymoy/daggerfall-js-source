// QL1/QL5-QL10 (bible/06-Systems/Questlines-Arc.md sections 2.5 and 3): THE SHEETS AND THE BRANCHES, HELD TO THEIR
// SCRIPTS. Every sheet is checked against the quest it names, parsed as the game reads it (test/qlSources.mjs, the pack
// loader's node twin): a binding of a kind the law reads, a task, item, clock or foe the script holds, a step it logs, a
// choice task something in it can set (tools/qlSheetLaw.mjs sheetProblems). And the sets are exact: every quest a player can be
// given has one sheet, in its family's file; every flagship quest (the rule, section 3) has a branch whose ways give the
// player different things (flagshipProblem - by effect, not by the pay's name); every branch patch applies, numbers its
// words from QL_MESSAGE_BASE and names its tasks `_ql..._`, names only messages its script has, fits the classic skin's
// boxes, and reads as DFU's with the switch off. AUDIT QUESTLINES: the law's own refusals, each pinned on a real script.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SHEETS, SHEET_FAMILIES } from '../../../src/systems/questlines/qlSheets.js';
import { sheetProblems, flagshipProblem, outcomeEffect, NAMED_BASES } from '../../../tools/qlSheetLaw.mjs';
import { patchMessageProblems, patchWidthProblems, ROW_CHARS } from '../../../tools/qlCheck.mjs';
import { CHOICE_CHARS } from '../../../tools/qlPatchKit.mjs';
import { qbnTasks, brief } from '../../../tools/qlSheetDraft.mjs';
import { QL_FAMILY_NAMES, LIST_GROUP_FAMILY, UNLISTED_FAMILY } from '../../../src/systems/questlines/qlFamilies.js';
import { lineQuestNames } from '../../../src/systems/questlines/qlLines.js';
import { QL_PATCHES, QL_MESSAGE_BASE } from '../../../src/systems/questlines/qlPatches.js';
import { QUEST_FILES, packMachine, parsedQuest, questSource, baseText, classicRows } from '../../qlSources.mjs';

/** The quests the pack holds that no one gives - each named, with why it has no sheet. */
const EXCLUDED = Object.freeze({
  // DFU's own: not offered
  ...Object.fromEntries([...QUEST_FILES.values()].filter((f) => /^__DEMO/i.test(f.name)).map((f) => [f.name.toUpperCase(), 'a DFU demo script, offered by nothing'])),
  _TUTOR__: 'DFU\'s tutorial, retired by TUT1 (questBridge.js RETIRED_TUTORIAL_QUEST)',
  K0C00Y06: 'disabled in QuestList-Classic.txt (its `-` row)',
  R0C11Y27: 'a duplicate of R0C10Y17 (its `-` row)',
  // the mods' mechanics
  ...Object.fromEntries([...QUEST_FILES.values()].filter((f) => f.dir === 'foraging' && !/^FetchWood/i.test(f.name)).map((f) => [f.name.toUpperCase(), 'a Foraging tool\'s bonus roll - no journal entry, nothing paid, no one gives it'])),
  ...Object.fromEntries([...QUEST_FILES.values()].filter((f) => f.dir === 'warm-ashes-ships').map((f) => [f.name.toUpperCase(), 'the sea\'s own event (warmAshesShips.js), run by the world - no journal entry'])),
});

/** Every quest a player can be given, by family. */
function reachable() {
  const fam = new Map();
  const add = (name, family) => fam.set(name.toUpperCase(), family);
  for (const r of classicRows()) add(r.name, LIST_GROUP_FAMILY[r.group]);
  add('CUSTOM01', 'FightersGuild');   // QuestList-DFU.txt's one row: FightersGuild
  for (const [family, names] of Object.entries(UNLISTED_FAMILY)) for (const n of names) add(n, family);
  for (const f of QUEST_FILES.values()) {
    if (f.dir === 'dfu' && (/^S0000/i.test(f.name) || f.name.toUpperCase() === '_BRISIEN')) add(f.name, 'MainQuest');
    if (f.dir === 'roleplay-realism' || (f.dir === 'foraging' && /^FetchWood/i.test(f.name))) add(f.name, 'Mods');
  }
  for (const n of lineQuestNames()) add(n, 'Questlines');   // QL12-QL16: each line's steps, started by its runner
  return fam;
}

/** The flagship rule (section 3): a listed quest that asks a `prompt`, one offered at rank 4 or above, a one-time one. */
function flagship() {
  const set = new Set();
  for (const r of classicRows()) {
    const text = baseText(r.name) ?? '';
    const qbn = text.slice(Math.max(0, text.search(/^\s*QBN:/im)));
    if (/^\s*prompt /im.test(qbn) || (r.minReq >= 4 && r.minReq < 10) || r.flag === '1') set.add(r.name.toUpperCase());
  }
  return set;
}

test('QL1 the families: one file of sheets each, in qlFamilies.js\'s order, and every sheet in its own family\'s file', () => {
  assert.deepEqual(SHEET_FAMILIES.map((f) => f.family), [...QL_FAMILY_NAMES]);
  const fam = reachable();
  const wrong = [];
  for (const f of SHEET_FAMILIES) {
    for (const s of f.sheets) {
      const want = fam.get(String(s.quest).toUpperCase());
      if (want && want !== f.family) wrong.push(`${s.quest} is ${want}'s, filed in ${f.family}`);
    }
  }
  assert.deepEqual(wrong, []);
  const twice = [];
  const seen = new Set();
  for (const f of SHEET_FAMILIES) for (const s of f.sheets) { const k = String(s.quest).toUpperCase(); if (seen.has(k)) twice.push(s.quest); seen.add(k); }
  assert.deepEqual(twice, [], 'one sheet a quest');
});

for (const family of QL_FAMILY_NAMES) {
  test(`QL1 the ${family} sheets: each names only what its script has - every binding, mark and choice`, () => {
    const machine = packMachine();
    const file = SHEET_FAMILIES.find((f) => f.family === family);
    const problems = [];
    for (const sheet of file.sheets) {
      const parsed = parsedQuest(sheet.quest, machine);
      if (!parsed) { problems.push(`${sheet.quest}: the pack holds no such quest`); continue; }
      problems.push(...sheetProblems(sheet, parsed));
    }
    assert.deepEqual(problems, []);
  });
}

test('QL1 the set is exact: every quest a player can be given has its sheet, and nothing else has one', () => {
  const fam = reachable();
  for (const name of fam.keys()) assert.ok(QUEST_FILES.has(name), `${name}: a quest the lists offer that the pack does not hold`);
  const missing = [...fam.keys()].filter((n) => !SHEETS.has(n)).sort();
  const extra = [...SHEETS.keys()].filter((n) => !fam.has(n)).sort();
  assert.deepEqual(extra, [], 'a sheet for a quest no one gives');
  assert.deepEqual(missing, [], `${missing.length} of ${fam.size} quests have no sheet yet`);
  // every quest the pack holds is either given or named here with why not
  const unaccounted = [...QUEST_FILES.values()].filter((f) => f.dir !== 'questlines' && !fam.has(f.name.toUpperCase()) && !EXCLUDED[f.name.toUpperCase()]).map((f) => f.name);
  assert.deepEqual(unaccounted, []);
  assert.equal([...fam.values()].filter((f) => f !== 'Questlines').length, 248, 'the scope (Questlines-Arc.md decision 3)');
  assert.equal([...fam.values()].filter((f) => f === 'Questlines').length, lineQuestNames().length, 'and the questlines\' own, every step of every line');
});

test('QL1 the flagship set is the rule\'s 66, and each has a branch whose ways give the player different things - an ask\'s answers pairwise, a prompt\'s ends by two at least (mutants: compared by the pay\'s name; the gold a path gives not read; the script\'s own repute not read)', () => {
  const set = flagship();
  assert.equal(set.size, 66, 'the rule, read off the list and the scripts');
  const machine = packMachine();
  const thin = [];
  for (const name of [...set].sort()) {
    const sheet = SHEETS.get(name);
    if (!sheet) { thin.push(`${name}: no sheet`); continue; }
    const parsed = parsedQuest(name, machine);
    const why = flagshipProblem(sheet, parsed.quest, parsed.lines);
    if (why) thin.push(`${name}: ${why}`);
  }
  assert.deepEqual(thin, []);
  // AUDIT QUESTLINES BRANCH-5 / REWARD-4: B0B40Y09 as the lanes read it - "take the purse" paid DFU's `give pc nothing`, and
  // the two answers moved the same local repute: `standard` and `lesser` by name, the same by what the player got
  const b = parsedQuest('B0B40Y09', machine);
  const was = b.quest.getTask({ name: 'success' }).actions.find((a) => a.typeName === 'GivePc');
  const repute = b.quest.getTask({ name: 'qlaltpath' }).actions.find((a) => a.typeName === 'ChangeReputeWith');
  assert.equal(flagshipProblem(SHEETS.get('B0B40Y09'), b.quest, b.lines), null, 'as shipped: the purse is gold, the refusal is not');
  was.isNothing = true;
  repute.amount = 4;
  assert.match(String(flagshipProblem(SHEETS.get('B0B40Y09'), b.quest, b.lines)), /"keep" \(paid\) and "alt" \(refused\) give the player the same/);
  const [paid, refused] = ['paid', 'refused'].map((id) => SHEETS.get('B0B40Y09').outcomes.find((o) => o.id === id));
  assert.notEqual(paid.pay, refused.pay, 'their pays\' names still differ - the names were never what the player got');
  assert.equal(outcomeEffect(paid, b.quest), outcomeEffect(refused, b.quest));
});

test('QL4 the branch patches: each a flagship quest\'s, each applies, its words numbered from QL_MESSAGE_BASE, its tasks `_ql..._`, every line claimed - and the switch off reads DFU\'s script', () => {
  const set = flagship();
  const machine = packMachine();
  const problems = [];
  for (const [name, patches] of QL_PATCHES) {
    if (!set.has(name)) problems.push(`${name}: patched, but no flagship quest`);
    const base = baseText(name);
    if (base == null) { problems.push(`${name}: the pack holds no such quest`); continue; }
    const on = questSource(name, true), off = questSource(name, false);
    if (off.join('\n') !== base.split(/\r?\n/).join('\n')) problems.push(`${name}: the switch off does not read the script as shipped`);
    if (on.join('\n') === off.join('\n')) { problems.push(`${name}: a patch that changes nothing (or did not apply)`); continue; }
    for (const p of patches) {
      for (const m of p.new.matchAll(/Message:\s+(\d+)/g)) if (!p.old.includes(m[0]) && Number(m[1]) < QL_MESSAGE_BASE) problems.push(`${name}: a new message ${m[1]} below ${QL_MESSAGE_BASE}`);
      for (const m of p.new.matchAll(/(?:^|\s)(_[a-zA-Z0-9.]+_)\s+task:/gm)) if (!p.old.includes(m[1]) && !/^_ql/.test(m[1])) problems.push(`${name}: a new task ${m[1]} not named _ql..._`);
    }
    const parsed = parsedQuest(name, machine);
    if (!parsed) { problems.push(`${name}: does not parse patched`); continue; }
    const pending = [...parsed.quest.tasks.values()].flatMap((t) => t.pendingActionLines.map((l) => l.trim())).filter(Boolean);
    const shipped = parsedQuest(name, machine, false);
    const before = new Set([...shipped.quest.tasks.values()].flatMap((t) => t.pendingActionLines.map((l) => l.trim())));
    for (const l of pending) if (!before.has(l)) problems.push(`${name}: the patch says a line no template claims - "${l}"`);
  }
  assert.deepEqual(problems, []);
});

test('QL4 the branch patches name only messages their scripts have, and take no id a script already has - an ask naming none asks nothing and its reward waits for ever (mutants: an ask\'s answer renumbered; a `say` of a message cut; a patch word on a DFU id)', () => {
  const machine = packMachine();
  const problems = [];
  for (const [name, patches] of QL_PATCHES) problems.push(...patchMessageProblems(name, patches, parsedQuest(name, machine), parsedQuest(name, machine, false)));
  assert.deepEqual(problems, []);
  // AUDIT QUESTLINES BRANCH-9: the lane's probe - M0B60Y10's ask names 1909, which no message is
  const patches = QL_PATCHES.get('M0B60Y10').map((p) => ({ ...p, new: p.new.replace('ask 1900 choices 1901 _qlkeep_ 1902 _qlalt_', 'ask 1900 choices 1901 _qlkeep_ 1909 _qlalt_') }));
  const lines = parsedQuest('M0B60Y10', machine).lines.map((l) => l.replace('ask 1900 choices 1901 _qlkeep_ 1902 _qlalt_', 'ask 1900 choices 1901 _qlkeep_ 1909 _qlalt_'));
  const quest = machine.parseQuestForLists(lines, 0, { rolls: () => 0, headless: true });
  assert.deepEqual(patchMessageProblems('M0B60Y10', patches, { quest, lines }, parsedQuest('M0B60Y10', machine, false)), ['M0B60Y10: names message 1909, which the patched script does not have']);
  // and a patch word on an id the script has (A0C01Y13's 2000) is refused
  const onDfu = QL_PATCHES.get('A0C01Y13').map((p) => ({ ...p, new: p.new.replace('Message:  1903', 'Message:  2000') }));
  assert.ok(patchMessageProblems('A0C01Y13', onDfu, parsedQuest('A0C01Y13', machine), parsedQuest('A0C01Y13', machine, false)).some((x) => /take message 2000/.test(x)));
});

test(`QL4 the branch patches fit the classic skin, which never wraps: every row of their words at most ${ROW_CHARS} characters (the box grows to its widest row), every answer one line of at most ${CHOICE_CHARS} (the 138-px pick list) (mutants: a question on one line; an answer of the old length)`, () => {
  const problems = [];
  for (const [name, patches] of QL_PATCHES) problems.push(...patchWidthProblems(name, patches));
  assert.deepEqual(problems, []);
  // AUDIT QUESTLINES BRANCH-8: the lane's two - M0B60Y10's question on one row, B0B50Y11's answer at its old 114 characters
  const oneRow = QL_PATCHES.get('M0B60Y10').map((p) => ({ ...p, new: p.new.replace(/(Message: {2}1900\n)<ce> ([^\n]+)\n<ce> ([^\n]+)\n<ce> ([^\n]+)\n/, '$1<ce> $2 $3 $4\n') }));
  assert.match(patchWidthProblems('M0B60Y10', oneRow).join(), /message 1900's row/);
  const long = QL_PATCHES.get('B0B50Y11').map((p) => ({ ...p, new: p.new.replace('Make it a well, with no name.', 'Let it bear no name of mine. Raise it as a well for the common folk - the deed was the order\'s duty, not my glory.') }));
  assert.match(patchWidthProblems('B0B50Y11', long).join(), /answer 1902/);
});

/** A sheet of `quest`'s with `edit` applied to a deep copy - a probe the law must refuse. */
const probe = (quest, edit) => { const s = JSON.parse(JSON.stringify(SHEETS.get(quest))); edit(s); return s; };

test('QL1 the law refuses an `outcome _x_` its sheet has no row for - the quest would end with no outcome at all: no standing, no gear, nothing filed (mutants: the outcome lines unread)', () => {
  const machine = packMachine();
  // AUDIT QUESTLINES BRANCH-10: QLBD05's script says `outcome _guild_`; a sheet that calls the row `guilds` is refused
  const parsed = parsedQuest('QLBD05', machine);
  assert.deepEqual(sheetProblems(SHEETS.get('QLBD05'), parsed), []);
  const renamed = probe('QLBD05', (s) => { s.outcomes.find((o) => o.id === 'guild').id = 'guilds'; });
  assert.ok(sheetProblems(renamed, parsed).some((x) => /says "outcome _guild_" - the sheet has no such outcome/.test(x)));
});

test('QL1 the law refuses a standing that names no individual faction of Quests-Factions.txt - an occupation\'s row (p2 0 and above) moves a Prince, a misspelt name nothing (mutants: the check dropped; p2 read first, as the old factionIdOf did)', () => {
  // AUDIT QUESTLINES REWARD-12: the lane's `Noble` (an occupation; its p3, 16, is Azura's id) and `The_Mage_Guild` (no row)
  const parsed = parsedQuest('M0B00Y06', packMachine());
  const bad = probe('M0B00Y06', (s) => { s.outcomes[0].standing = { Noble: 5, The_Mage_Guild: 5, The_Mages_Guild: 2 }; });
  assert.deepEqual(sheetProblems(bad, parsed).filter((x) => /standing/.test(x)), [
    'M0B00Y06 outcomes[0].standing.Noble: no individual faction of Quests-Factions.txt (a p2 -1 row)',
    'M0B00Y06 outcomes[0].standing.The_Mage_Guild: no individual faction of Quests-Factions.txt (a p2 -1 row)',
  ]);
});

test('QL1 the law: a named piece names its base - a template the reward\'s roll makes for its kind (mutants: no base checked; a base of another kind let by)', () => {
  // AUDIT QUESTLINES REWARD-5: "Oathkeeper's Dragon Helm" is a Helm, never the Gauntlets the roll happened to draw
  assert.deepEqual([NAMED_BASES.weapon.length, NAMED_BASES.armor.length, NAMED_BASES.jewel.length], [18, 11, 7], 'CreateRandomWeapon\'s 18 (no arrow), CreateRandomArmor\'s 11, the Jewellery a slot takes (no Wand)');
  assert.ok(NAMED_BASES.armor.includes('Helm') && NAMED_BASES.weapon.includes('Katana') && NAMED_BASES.jewel.includes('Amulet') && !NAMED_BASES.jewel.includes('Wand'));
  const named = SHEET_FAMILIES.flatMap((f) => f.sheets).flatMap((s) => s.outcomes.filter((o) => o.named).map((o) => [s.quest, o]));
  assert.ok(named.length >= 20, 'the questlines\' named pieces');
  const s = probe(named[0][0], (x) => { const o = x.outcomes.find((y) => y.named); o.named = { ...o.named, base: undefined }; });
  assert.ok(sheetProblems(s).some((x) => /named\.base: "undefined"/.test(x)));
  const wrong = probe(named[0][0], (x) => { const o = x.outcomes.find((y) => y.named); o.named = { ...o.named, base: o.named.kind === 'jewel' ? 'Helm' : 'Amulet' }; });
  assert.ok(sheetProblems(wrong).some((x) => /named\.base/.test(x)));
});

test('QL1 the law refuses a gear-paying outcome on a script that cannot pay it - nothing in it pays (give pc, ql paid, train pc), or the task the outcome waits on ends the quest unpaid; a start-up that pays pays every way (mutants: the whole-script check dropped; the path check dropped; the start-up exemption dropped)', () => {
  const machine = packMachine();
  // AUDIT QUESTLINES REWARD-6 / LAW-3: S0000016's endings pay nothing - its seven were `standard`
  const mq = parsedQuest('S0000016', machine);
  assert.deepEqual(sheetProblems(SHEETS.get('S0000016'), mq), []);
  assert.ok(sheetProblems(probe('S0000016', (s) => { s.outcomes[0].pay = 'standard'; }), mq).some((x) => /nothing in the script pays/.test(x)));
  // K0C00Y09's `slain` is paid by `get item` in a task that ends the quest - no GivePc, no success, no gear
  const k = parsedQuest('K0C00Y09', machine);
  assert.ok(sheetProblems(probe('K0C00Y09', (s) => { s.outcomes.find((o) => o.id === 'slain').pay = 'standard'; }), k).some((x) => /on "_S\.06_", which ends the quest unpaid/.test(x)));
  // A0C41Y18 pays at its start-up (`give pc nothing`), so `destroyed` on the mummy's death is paid
  assert.deepEqual(sheetProblems(SHEETS.get('A0C41Y18'), parsedQuest('A0C41Y18', machine)), []);
});

test('QL1 the law: a sheet whose quest can end a success no row is sure to hold for names its success fallback - `success` or a `done` - and never a failure, a betrayal or a choice (mutants: the requirement dropped; a betrayal let by; a choice\'s task let by)', () => {
  const machine = packMachine();
  // AUDIT QUESTLINES LAW-1: M0B11Y18 - the Queen pays at `_S.18_`, which no row names; its fallback is the loyal end
  const m = parsedQuest('M0B11Y18', machine);
  assert.equal(SHEETS.get('M0B11Y18').success, 'loyal');
  assert.deepEqual(sheetProblems(SHEETS.get('M0B11Y18'), m), []);
  assert.ok(sheetProblems(probe('M0B11Y18', (s) => { delete s.success; }), m).some((x) => /names no success fallback/.test(x)));
  assert.ok(sheetProblems(probe('M0B11Y18', (s) => { s.success = 'betrayed'; })).some((x) => /pays a betrayal/.test(x)), 'the old rule\'s pick');
  assert.ok(sheetProblems(probe('M0B11Y18', (s) => { s.success = 'outrun'; }), m).some((x) => /waits on a task a choice sets/.test(x)), '`_S.18_` is the Queen\'s prompt\'s yes');
  assert.ok(sheetProblems(probe('M0B11Y18', (s) => { s.success = 'failed'; })).some((x) => /is a failure/.test(x)));
  assert.ok(sheetProblems(probe('M0B11Y18', (s) => { s.success = 'nobody'; })).some((x) => /names no outcome of the sheet/.test(x)));
  // a quest QL4's hand-in branches is covered: both answers are rows of a choice's task, which stays set
  const h = parsedQuest('B0B40Y09', machine);
  assert.equal(SHEETS.get('B0B40Y09').success, undefined);
  assert.deepEqual(sheetProblems(SHEETS.get('B0B40Y09'), h), []);
});

test('QL1 the sheet draft reads the QBN\'s tasks as the parser does - `_x_ task:`, `variable`, and a task linked to a global variable (`LiftedCurse _S.09_`), so S0000003\'s draft binds its reward, not `_no_` (mutants: the global-variable header unread; the task header unread)', () => {
  // AUDIT QUESTLINES LAW-13
  const tasks = qbnTasks(questSource('S0000003', false));
  assert.ok(tasks.has('_S.09_') && tasks.has('_S.10_'), 'LiftedCurse _S.09_ and MedoraGotHorn _S.10_ are headers');
  assert.ok(tasks.get('_S.10_').some((l) => /^give pc _magicitem_/.test(l)), 'the reward filed under its own task');
  assert.ok(!tasks.get('_no_')?.some((l) => /^give pc/.test(l)), 'and not under the task before it');
  assert.deepEqual(qbnTasks(questSource('M0B50Y09', false)).get('_victory_'), ['when _S.01_ and _qgclicked_', 'give pc _gold_', 'start timer _end_'], 'a plain `_x_ task:` header');
  const draft = JSON.parse(brief('S0000003').split('## draft\n')[1]);
  assert.deepEqual(draft.outcomes[0].on, { task: '_S.10_' });
});

