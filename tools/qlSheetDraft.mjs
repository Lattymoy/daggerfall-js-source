#!/usr/bin/env node
// QL1 (bible/06-Systems/Questlines-Arc.md section 2.2): A QUEST'S BRIEF, FOR ITS SHEET'S WRITER - what the script holds
// that a sheet may name, read the way the game reads it (test/qlSources.mjs: the port's patches and, `--on`, the
// questlines' branch): its list row, its resources by kind, every task with its lines and whether anything can set it,
// every journal step with its words, the prompts, the rewards and the ends - and a first draft of the sheet, an objective
// a journal step, to be read and corrected (its words are a placeholder: write each objective as the player should read
// it - an order, short, naming the script's own resources by DFU's macros: `_x_` a name, `__x_` a building or dungeon,
// `___x_` its town).
//
//   node tools/qlSheetDraft.mjs <QUEST>            the brief and the draft
//   node tools/qlSheetDraft.mjs <QUEST> --on       ...read with its branch patched in
//   node tools/qlSheetDraft.mjs --family <Name>    every quest of a family, briefly (name, title, size, steps)
import { isMain } from './lib/isMain.mjs';
import { QUEST_FILES, parsedQuest, packMachine, questSource, classicRows, loadTables } from '../test/qlSources.mjs';
import { globalVarsTable } from '../src/systems/quest/tables.js';
import { settable } from './qlSheetLaw.mjs';
import { LIST_GROUP_FAMILY, UNLISTED_FAMILY } from '../src/systems/questlines/qlFamilies.js';
import { lineStepOf } from '../src/systems/questlines/qlLines.js';
import { familyQuests } from './qlCheck.mjs';

/** The messages a script's QRC holds: id -> its lines (header words kept for the fixed ones). */
export function qrcMessages(lines) {
  const out = new Map();
  let id = null, buf = [], inQrc = false;
  const flush = () => { if (id != null) out.set(id, buf.join('\n').trim()); id = null; buf = []; };
  for (const l of lines) {
    if (/^\s*QRC:/i.test(l)) { inQrc = true; continue; }
    if (/^\s*QBN:/i.test(l)) { flush(); break; }
    if (!inQrc) continue;
    const m = /^\s*(?:Message|[A-Za-z]+):\s*\[?(\d+)\]?\s*$/.exec(l);
    if (m) { flush(); id = Number(m[1]); continue; }
    if (/^\s*--/.test(l)) continue;
    if (id != null) buf.push(l.replace(/<ce>\s*/g, '').trim());
  }
  flush();
  return out;
}

/** The QBN's tasks as written: name -> its lines (the startup block is `(startup)`). AUDIT QUESTLINES LAW-13: a task
 *  linked to a global variable is a header too - `LiftedCurse _S.09_`, its first word a Quests-GlobalVars name, as the
 *  parser reads it (quest/parser.js _getGlobalReference, task.js GLOBAL_VAR_HEADER) - or its lines are filed under the
 *  task before it (S0000003's draft bound its reward to `_no_`). */
export function qbnTasks(lines) {
  loadTables();
  const out = new Map();
  let cur = null, inQbn = false;
  for (const l of lines) {
    if (/^\s*QBN:/i.test(l)) { inQbn = true; cur = '(startup)'; out.set(cur, []); continue; }
    if (!inQbn) continue;
    const head = /^\s*(_[A-Za-z0-9.]+_)\s+task:|^\s*until\s+(_[A-Za-z0-9.]+_)\s+performed:|^\s*variable\s+(_[A-Za-z0-9.]+_)/.exec(l);
    const linked = /^\s*([A-Za-z0-9_.]+)\s+(_[A-Za-z0-9.]+_)\s*$/.exec(l);
    if (!head && linked && globalVarsTable().hasValue(linked[1])) { cur = linked[2]; out.set(cur, []); continue; }
    if (head?.[3]) { out.set(`variable ${head[3]}`, []); cur = null; continue; }
    if (head) { cur = head[1] ?? `until ${head[2]}`; out.set(cur, []); continue; }   // AUDIT QUESTLINES DOC-35: a `variable` is above - no third arm
    if (cur && l.trim() && !/^\s*--/.test(l)) out.get(cur).push(l.trim());
  }
  return out;
}

const familyOf = (name) => {
  const row = classicRows().find((r) => r.name.toUpperCase() === name.toUpperCase());
  if (row) return LIST_GROUP_FAMILY[row.group];
  for (const [fam, list] of Object.entries(UNLISTED_FAMILY)) if (list.includes(name.toUpperCase())) return fam;
  if (/^S0000|^_BRISIEN$/i.test(name)) return 'MainQuest';
  if (name.toUpperCase() === 'CUSTOM01') return 'FightersGuild';
  if (lineStepOf(name)) return 'Questlines';   // QL12-QL16: a line's step
  return 'Mods';
};

export function brief(name, { on = false } = {}) {
  const f = QUEST_FILES.get(name.toUpperCase());
  if (!f) return `${name}: the pack holds no such quest`;
  const lines = questSource(name, on);
  const parsed = parsedQuest(name, packMachine(), on);
  const quest = parsed?.quest;
  const msgs = qrcMessages(lines);
  const tasks = qbnTasks(lines);
  const row = classicRows().find((r) => r.name.toUpperCase() === name.toUpperCase());
  const out = [];
  out.push(`# ${f.name} - ${quest?.displayName ?? '(no display name)'}  [${familyOf(f.name)}]${row ? `  row: ${row.group} ${row.membership} minReq ${row.minReq} flag ${row.flag}` : ''}`);
  out.push('', '## resources');
  for (const r of quest?.resources?.values?.() ?? []) {
    const kind = r.isPlace ? 'Place' : r.isPerson ? 'Person' : r.isItem ? 'Item' : r.isFoe ? 'Foe' : r.isClock ? 'Clock' : 'Other';
    out.push(`  ${kind.padEnd(6)} _${r.symbol.name}_`);
  }
  out.push('', '## tasks (S = something can set it)');
  for (const [t, body] of tasks) {
    const nm = t.replace(/^variable /, '').replace(/^until /, '').replace(/^_|_$/g, '');
    const can = quest?.tasks?.has?.(nm) ? (settable(quest, nm, lines) ? 'S' : '-') : ' ';
    out.push(`  [${can}] ${t}`);
    for (const l of body) out.push(`        ${l}`);
  }
  out.push('', '## journal steps');
  for (const [t, body] of tasks) for (const l of body) {
    const m = /\blog\s+(\d+)\s+step\s+(\d+)/i.exec(l);
    if (m) out.push(`  step ${m[2]} (msg ${m[1]}, in ${t}): ${(msgs.get(Number(m[1])) ?? '?').replace(/\s+/g, ' ').slice(0, 300)}`);
  }
  out.push('', '## prompts, rewards, ends');
  for (const [t, body] of tasks) for (const l of body) {
    if (/^(prompt|promptmulti|ask|give pc|end quest|change repute|pick one of|start quest|run quest|outcome|legal repute)/i.test(l)) out.push(`  ${t}: ${l}`);
  }
  for (const [t, body] of tasks) for (const l of body) {
    const m = /^prompt\s+(\d+)/i.exec(l);
    if (m) out.push(`  prompt ${m[1]} says: ${(msgs.get(Number(m[1])) ?? '?').replace(/\s+/g, ' ').slice(0, 300)}`);
  }
  out.push('', '## offer (1000)', `  ${(msgs.get(1000) ?? '').replace(/\s+/g, ' ').slice(0, 400)}`);
  // the draft: an objective a step, opening on its step and done on the next (the last on the reward)
  const steps = [];
  for (const [, body] of tasks) for (const l of body) { const m = /\blog\s+\d+\s+step\s+(\d+)/i.exec(l); if (m && !steps.includes(Number(m[1]))) steps.push(Number(m[1])); }
  steps.sort((a, b) => a - b);
  const rewardTask = [...tasks].find(([, body]) => body.some((l) => /^give pc/i.test(l)))?.[0] ?? null;
  const draft = {
    quest: f.name,
    objectives: steps.map((s, i) => ({ id: `step${s}`, text: `TODO step ${s}`, open: { step: s }, done: steps[i + 1] != null ? { step: steps[i + 1] } : rewardTask ? { task: rewardTask } : { ended: true } })),
    outcomes: [
      ...(rewardTask ? [{ id: 'done', text: 'TODO', on: { task: rewardTask }, pay: 'standard' }] : []),
      { id: 'failed', text: 'TODO', on: { ended: true }, pay: 'none', failure: true },
    ],
  };
  out.push('', '## draft', JSON.stringify(draft, null, 2));
  return out.join('\n');
}

export function familyBrief(family) {
  const out = [];
  // AUDIT QUESTLINES DOC-27: the family's quests as the checker counts them (qlCheck.mjs familyQuests) - familyOf's
  // fall-through filed every unlisted quest (the demos, Foraging's tools, the sea's event) under Mods
  const want = familyQuests(family);
  for (const f of [...QUEST_FILES.values()].sort((a, b) => a.name.localeCompare(b.name))) {
    if (!want.has(f.name.toUpperCase())) continue;
    const lines = questSource(f.name, false);
    const steps = lines.filter((l) => /\blog\s+\d+\s+step\s+\d+/i.test(l)).length;
    const dn = (lines.find((l) => /^\s*DisplayName:/i.test(l)) ?? '').replace(/^\s*DisplayName:\s*/i, '');
    out.push(`${f.name.padEnd(12)} ${String(lines.length).padStart(5)} lines  ${String(steps).padStart(2)} steps  ${dn}`);
  }
  return out.join('\n');
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args[0] === '--family') console.log(familyBrief(args[1]));
  else if (args[0] && !QUEST_FILES.has(args[0].toUpperCase())) { console.error(`${args[0]}: the pack holds no such quest`); process.exit(1); }   // DOC-35
  else if (args[0]) console.log(brief(args[0], { on: args.includes('--on') }));
  else { console.error('usage: node tools/qlSheetDraft.mjs <QUEST> [--on] | --family <Name>'); process.exit(1); }
}
