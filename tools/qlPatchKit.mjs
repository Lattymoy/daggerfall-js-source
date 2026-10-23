#!/usr/bin/env node
// QL4 (bible/06-Systems/Questlines-Arc.md section 2.3): THE HAND-IN BRANCH, MADE EXACT. A flagship quest whose story
// holds no decision of its own is given one where its reward is handed over: the questor asks how the player will be
// paid, and the two answers end it differently (the sheet's outcomes - its own pay, standing, legal). The kit reads the
// reward task's text exactly as the game reads the script (the port's patches first - test/qlSources.mjs baseText) and
// writes the three patches (systems/questlines/qlPatches.js), each checked to occur exactly once in that text before it
// is written (AUDIT QUESTLINES DOC-32: the first - the reward task's header and trigger - is counted too):
//
//   1. the reward task waits for the first answer - its trigger line becomes `when _qlkeep_`;
//   2. the question and the two answers, messages QL_MESSAGE_BASE.. before `QBN:` - the question wrapped to ASK_ROW
//      characters a row, one `<ce>` line each, as DFU's own centred rows run (the classic skin's box grows to its widest
//      row and never wraps - ui/messageBox.js layoutMessageBox); an answer of more than CHOICE_CHARS refused (the classic
//      pick list is 138 px wide - ui/listPicker.js);
//   3. at the script's end: `_qlask_` asks when the reward task's own condition holds; `_qlkeep_` and `_qlalt_` are the
//      answers; `_qlaltpath_` is the second answer's ending - the reward task's own lines that end the quest, without
//      its gold or comments, behind `ql paid` (the quest a success and its outcome's gear waiting, without the
//      QuestComplete box: over a `give pc _gold_` that box hands over the reward the player just turned down) - or, where
//      the reward task's own pay is `give pc nothing`, behind that same `give pc nothing`, its box and all (AUDIT
//      QUESTLINES BRANCH-6: there the box is the questor's last words and pays nothing, so both answers keep them).
//
// AUDIT QUESTLINES BRANCH-4: a reward task another task READS (`when _map_ and _victory_` - M0B50Y09's map to a second
// dungeon, given with the fee) would be lost on the second answer, which never sets it. The kit refuses such a quest
// and names the readers; `--readers copy` gives the second answer a copy of each (`_qlalt<reader>_ task:`, its `when`
// reading `_qlalt_` where it read the reward task, its lines without any `give pc`) - a reader it cannot copy (one that
// reads the reward task through `or` or `not`) is refused still, for a branch written by hand.
// AUDIT QUESTLINES BRANCH-15: a quest that already carries a branch (qlPatches.js hasQuestlinePatch) is refused - its
// filed patches are not replaced unless `--replace` says so.
//
//   node tools/qlPatchKit.mjs handin <QUEST> <_rewardTask_> --ask "<question>" --keep "<answer 1>" --alt "<answer 2>"
//       [--readers copy] [--replace] [--family <Name>] [--write]
//                                         print the patches (and, --write, merge them into patches/<family>.json)
//
// A reward task whose trigger is not one `when` line is refused - that quest's branch is written by hand.
//
// A FILED BRANCH IS NOT ALWAYS THE KIT'S. Of the 17 the kit cut (Questlines-Arc.md section 2.3, pattern C), only
// M0B50Y09's is pinned to be exactly what the kit cuts today (test/systems/questlines/ql4_branches.test.js); the others
// were edited by hand after the kit - B0B40Y09, B0B70Y16, R0C11Y03, P0A01L00 and P0B10L08 from the start (DOC-32), and in
// AUDIT QUESTLINES every one's words re-wrapped and reworded to the classic skin (BRANCH-8, BRANCH-16), the four knights'
// "take it" given its gold (BRANCH-5) and the refusals whose box was the story given their own words (BRANCH-6). The
// pins hold every branch to what it must do, whoever cut it (ql1_sheets.test.js, ql4_branches.test.js).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMain } from './lib/isMain.mjs';
import { baseText, ROOT } from '../test/qlSources.mjs';
import { QL_MESSAGE_BASE, hasQuestlinePatch } from '../src/systems/questlines/qlPatches.js';
import { formatFamily } from './qlFormat.mjs';

const count = (hay, needle) => hay.split(needle).length - 1;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The width a question's row is wrapped to (DFU's centred rows: half run 33 characters or fewer, nine in ten 44). */
export const ASK_ROW = 44;
/** The longest answer the classic pick list holds (138 px of FONT0003 - ui/listPicker.js's list rect). */
export const CHOICE_CHARS = 30;

/** `text` as rows of at most `width` characters, greedily by words (a `\n` in it ends a row where the writer wants one;
 *  a word longer than the width stands on a row of its own). */
export function wrapRows(text, width = ASK_ROW) {
  const rows = [];
  for (const para of String(text).split('\n')) {
    let row = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      if (row && row.length + 1 + word.length > width) { rows.push(row); row = word; } else row = row ? `${row} ${word}` : word;
    }
    if (row) rows.push(row);
  }
  return rows;
}

/** The message lines of one answer or question: DFU's own form (a spoken question `<ce>` centred, a row a line). */
const messageBlock = (id, text, centred) => [`Message:  ${id}`, ...(centred ? wrapRows(text).map((l) => `<ce> ${l}`) : [String(text).trim()]), ''].join('\n');

/** The tasks of `text` (its QBN's `_x_ task:` blocks): `[{ name, lines }]`, each block's lines trimmed, blanks dropped. */
function taskBlocks(text) {
  const out = [];
  let cur = null;
  for (const raw of text.split('\n')) {
    const head = /^\s*(_[A-Za-z0-9.]+_)\s+task:/.exec(raw);
    if (head) { cur = { name: head[1], lines: [] }; out.push(cur); continue; }
    if (/^\s*(variable\s|until\s|[A-Za-z]+\s+_[A-Za-z0-9.]+_\s*$)/.test(raw)) { cur = null; continue; }
    if (cur && raw.trim()) cur.lines.push(raw.trim());
  }
  return out;
}

/**
 * The hand-in patches for `quest`'s reward task `task` - `[{ old, new, count }]` - or throws with why not.
 * `readers`: 'refuse' (the default) throws on a task that reads the reward task; 'copy' gives the second answer a copy of
 * each. `replace`: cut the branch of a quest that already carries one.
 * @param {string} quest @param {string} task @param {{ ask: string, keep: string, alt: string }} words
 * @param {{ readers?: 'refuse'|'copy', replace?: boolean }} [opts]
 */
export function handinPatches(quest, task, { ask, keep, alt }, { readers = 'refuse', replace = false } = {}) {
  const text = (baseText(quest) ?? '').replace(/\r\n?/g, '\n');
  if (!text) throw new Error(`${quest}: the pack holds no such quest`);
  // AUDIT QUESTLINES BRANCH-15: the guard reads the FILED patches - baseText is the script before them, so a guard on its
  // text never fired, and --write replaced a quest's branch without a word
  if (hasQuestlinePatch(quest) && !replace) throw new Error(`${quest}: already carries a questlines branch (patches/<family>.json) - --replace to cut it again`);
  if (!ask || !keep || !alt) throw new Error('--ask, --keep and --alt are each required');
  for (const [k, v] of [['keep', keep], ['alt', alt]]) if (String(v).trim().length > CHOICE_CHARS) throw new Error(`--${k}: "${v}" is over ${CHOICE_CHARS} characters - the classic pick list is 138 px wide`);
  const head = new RegExp(`(^|\\n)(${esc(task)} task:[^\\n]*\\n)([^\\n]*\\bwhen\\b[^\\n]*)\\n`);
  const m = head.exec(text);
  if (!m) throw new Error(`${quest}: no "${task} task:" whose first line is a "when" - write this branch by hand`);
  const header = m[2], whenLine = m[3];
  if (count(text, `${header}${whenLine}\n`) !== 1) throw new Error(`${quest}: "${task} task:" and its trigger are not on lines of their own once - write this branch by hand`);
  const cond = whenLine.replace(/^\s*when\s+/, '').trimEnd();
  // the task's body after its trigger, up to the next task header or blank line
  const start = m.index + m[0].length;
  const rest = text.slice(start);
  const stop = rest.search(/\n\s*\n|\n(?=_[A-Za-z0-9.]+_ task:)|\n(?=variable )|\n(?=until )/);
  const body = (stop < 0 ? rest : rest.slice(0, stop)).split('\n').map((l) => l.trim()).filter(Boolean);
  if (body.some((l) => /^(when|clicked|killed|toting|pc at|injured|daily)\b/i.test(l))) throw new Error(`${quest}: ${task} has more than one trigger - write this branch by hand`);
  const ending = body.filter((l) => !/^give pc\b/i.test(l) && !/^--/.test(l));
  const gives = body.filter((l) => /^give pc\b/i.test(l));
  if (!gives.length) throw new Error(`${quest}: ${task} gives nothing - no hand-in to branch`);
  // AUDIT QUESTLINES BRANCH-6: DFU's own `give pc nothing` pays nothing to turn down - the second answer says it too
  const paid = gives.every((l) => /^give pc nothing\b/i.test(l)) ? 'give pc nothing' : 'ql paid';
  // AUDIT QUESTLINES BRANCH-4: every other task that reads the reward task - the second answer must not lose it
  const sym = new RegExp(`(^|[^A-Za-z0-9_.])${esc(task)}($|[^A-Za-z0-9_.])`);
  const found = taskBlocks(text).filter((t) => t.name !== task && t.lines.some((l) => /^when\b/i.test(l) && sym.test(l)));
  const copies = [];
  if (found.length && readers !== 'copy') throw new Error(`${quest}: ${task} is read by ${found.map((t) => `${t.name} ("${t.lines.find((l) => sym.test(l))}")`).join(', ')} - the second answer would lose it; --readers copy, or write this branch by hand`);
  for (const r of found) {
    const when = r.lines.find((l) => /^when\b/i.test(l) && sym.test(l));
    if (r.lines.filter((l) => /^when\b/i.test(l)).length !== 1 || /\bor\b/i.test(when) || new RegExp(`\\bnot\\s+${esc(task)}`).test(when)) throw new Error(`${quest}: ${r.name} reads ${task} as "${when}" - not a copy the kit can make; write this branch by hand`);
    copies.push('', `_qlalt${r.name.replace(/[_.]/g, '')}_ task:`, `\t${when.replace(sym, '$1_qlalt_$2')}`, ...r.lines.filter((l) => l !== when && !/^give pc\b/i.test(l) && !/^--/.test(l)).map((l) => `\t${l}`));
  }
  const [q, a, b] = [QL_MESSAGE_BASE, QL_MESSAGE_BASE + 1, QL_MESSAGE_BASE + 2];
  // 1. the reward task waits for the first answer
  const p1 = { old: `${header}${whenLine}\n`, new: `${header}\twhen _qlkeep_\n`, count: 1 };
  // 2. the words, before QBN:
  if (count(text, '\nQBN:') !== 1) throw new Error(`${quest}: "QBN:" is not on one line alone`);
  const words = [messageBlock(q, ask, true), messageBlock(a, keep, false), messageBlock(b, alt, false)].join('\n');
  const p2 = { old: '\nQBN:', new: `\n${words}\nQBN:`, count: 1 };
  // 3. the tasks, at the end - anchored on the script's last two lines
  const trimmed = text.replace(/\s+$/, '');
  const tailLines = trimmed.split('\n').slice(-2).join('\n');
  if (count(text, tailLines) !== 1) throw new Error(`${quest}: its last two lines are not unique - write this branch by hand`);
  const tasks = [
    '', '', '_qlask_ task:', `\twhen ${cond}`, `\task ${q} choices ${a} _qlkeep_ ${b} _qlalt_`,
    '', 'variable _qlkeep_', 'variable _qlalt_',
    '', '_qlaltpath_ task:', '\twhen _qlalt_', `\t${paid}`, ...ending.map((l) => `\t${l}`),
    ...copies,
  ].join('\n');
  const p3 = { old: tailLines, new: `${tailLines}${tasks}`, count: 1 };
  return [p1, p2, p3];
}

/** Merge `patches` for `quest` into `family`'s file (one quest's patches replace any it had). */
export function writePatches(family, quest, patches) {
  const file = join(ROOT, 'src/systems/questlines/patches', `${family[0].toLowerCase()}${family.slice(1)}.json`);
  const data = JSON.parse(readFileSync(file, 'utf8'));
  if (data.family !== family) throw new Error(`${file} is ${data.family}'s`);
  data.patches[quest] = patches;
  writeFileSync(file, formatFamily(data, 'patches'));
  return file;
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
  if (args[0] !== 'handin' || !args[1] || !args[2]) {
    console.error('usage: node tools/qlPatchKit.mjs handin <QUEST> <_rewardTask_> --ask "..." --keep "..." --alt "..." [--readers copy] [--replace] [--family <Name>] [--write]');
    process.exit(1);
  }
  const patches = handinPatches(args[1], args[2], { ask: opt('ask'), keep: opt('keep'), alt: opt('alt') }, { readers: opt('readers') === 'copy' ? 'copy' : 'refuse', replace: args.includes('--replace') });
  if (args.includes('--write')) {
    const fam = opt('family');
    if (!fam) { console.error('--write needs --family'); process.exit(1); }
    console.log(`written: ${writePatches(fam, args[1], patches)}`);
  } else console.log(JSON.stringify({ [args[1]]: patches }, null, 2));
  console.log(`sheet: branches [{ "id": "payment", "text": <the question>, "choices": [{ "id": "keep", "text": <answer 1>, "sets": "_qlkeep_" }, { "id": "alt", "text": <answer 2>, "sets": "_qlalt_" }] }]`);
  console.log('       outcomes bound { "task": "_qlkeep_" } and { "task": "_qlalt_" }, each with its own pay or standing, before the failure.');
}
