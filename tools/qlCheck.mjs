#!/usr/bin/env node
// QL5-QL10: ONE FAMILY'S SHEETS AND BRANCHES, CHECKED - what test/systems/questlines/ql1_sheets.test.js holds, for one
// family alone, so a wave's writer reads only their own quests' problems: each sheet against its script (as the game
// reads it, the branch patched in), each quest of the family that has no sheet, each flagship quest of it with no branch
// or whose branch gives the player alike (tools/qlSheetLaw.mjs flagshipProblem - by what each way gives, not by its
// pay's name), and each of its branch patches - applies, words from QL_MESSAGE_BASE, tasks `_ql..._`, every message it
// names one the script has (patchMessageProblems), its words the classic skin's width (patchWidthProblems).
//
//   node tools/qlCheck.mjs <Family>        problems, one a line; exit 1 if any
import { isMain } from './lib/isMain.mjs';
import { SHEETS, SHEET_FAMILIES } from '../src/systems/questlines/qlSheets.js';
import { sheetProblems, flagshipProblem } from './qlSheetLaw.mjs';
import { CHOICE_CHARS } from './qlPatchKit.mjs';
import { LIST_GROUP_FAMILY, UNLISTED_FAMILY } from '../src/systems/questlines/qlFamilies.js';
import { lineQuestNames } from '../src/systems/questlines/qlLines.js';
import { QL_PATCH_FAMILIES, QL_MESSAGE_BASE } from '../src/systems/questlines/qlPatches.js';
import { QUEST_FILES, packMachine, parsedQuest, questSource, baseText, classicRows } from '../test/qlSources.mjs';

export function familyQuests(family) {
  const out = new Set();
  for (const r of classicRows()) if (LIST_GROUP_FAMILY[r.group] === family) out.add(r.name.toUpperCase());
  if (family === 'FightersGuild') out.add('CUSTOM01');
  for (const n of UNLISTED_FAMILY[family] ?? []) out.add(n);
  if (family === 'Questlines') for (const n of lineQuestNames()) out.add(n);
  for (const f of QUEST_FILES.values()) {
    if (family === 'MainQuest' && f.dir === 'dfu' && (/^S0000/i.test(f.name) || f.name.toUpperCase() === '_BRISIEN')) out.add(f.name.toUpperCase());
    if (family === 'Mods' && (f.dir === 'roleplay-realism' || (f.dir === 'foraging' && /^FetchWood/i.test(f.name)))) out.add(f.name.toUpperCase());
  }
  return out;
}

export function flagshipOf(family) {
  const set = new Set();
  for (const r of classicRows()) {
    if (LIST_GROUP_FAMILY[r.group] !== family) continue;
    const text = baseText(r.name) ?? '';
    const qbn = text.slice(Math.max(0, text.search(/^\s*QBN:/im)));
    if (/^\s*prompt /im.test(qbn) || (r.minReq >= 4 && r.minReq < 10) || r.flag === '1') set.add(r.name.toUpperCase());
  }
  return set;
}

export function checkFamily(family) {
  const out = [];
  const file = SHEET_FAMILIES.find((f) => f.family === family);
  if (!file) return [`${family}: no such family`];
  const machine = packMachine();
  for (const sheet of file.sheets) {
    const parsed = parsedQuest(sheet.quest, machine);
    if (!parsed) { out.push(`${sheet.quest}: the pack holds no such quest`); continue; }
    out.push(...sheetProblems(sheet, parsed));
  }
  const want = familyQuests(family);
  for (const n of [...want].sort()) if (!SHEETS.has(n)) out.push(`${n}: no sheet yet`);
  for (const s of file.sheets) if (!want.has(String(s.quest).toUpperCase())) out.push(`${s.quest}: not a ${family} quest`);
  for (const n of [...flagshipOf(family)].sort()) {
    const sheet = SHEETS.get(n);
    if (!sheet) continue;
    const parsed = parsedQuest(n, machine);
    const why = parsed ? flagshipProblem(sheet, parsed.quest, parsed.lines) : 'does not parse';
    if (why) out.push(`${n}: flagship, ${why}`);
  }
  const fam = QL_PATCH_FAMILIES.find((f) => f.family === family);
  for (const [name, patches] of Object.entries(fam?.patches ?? {})) {
    const base = baseText(name);
    if (base == null) { out.push(`${name}: patched, but the pack holds no such quest`); continue; }
    if (!flagshipOf(family).has(name.toUpperCase())) out.push(`${name}: patched, but no flagship quest`);
    const on = questSource(name, true);
    if (on.join('\n') === base.split(/\r?\n/).join('\n')) out.push(`${name}: the patch did not apply (see the warning above)`);
    for (const p of patches) {
      for (const m of p.new.matchAll(/Message:\s+(\d+)/g)) if (!p.old.includes(m[0]) && Number(m[1]) < QL_MESSAGE_BASE) out.push(`${name}: a new message ${m[1]} below ${QL_MESSAGE_BASE}`);
      for (const m of p.new.matchAll(/(?:^|\s)(_[a-zA-Z0-9.]+_)\s+task:/gm)) if (!p.old.includes(m[1]) && !/^_ql/.test(m[1])) out.push(`${name}: a new task ${m[1]} not named _ql..._`);
    }
    const parsed = parsedQuest(name, machine);
    const shipped = parsedQuest(name, machine, false);
    if (!parsed) { out.push(`${name}: does not parse patched`); continue; }
    out.push(...patchMessageProblems(name, patches, parsed, shipped), ...patchWidthProblems(name, patches));
    const before = new Set([...shipped.quest.tasks.values()].flatMap((t) => t.pendingActionLines.map((l) => l.trim())));
    for (const t of parsed.quest.tasks.values()) for (const l of t.pendingActionLines) if (l.trim() && !before.has(l.trim())) out.push(`${name}: the patch says a line no template claims - "${l.trim()}"`);
  }
  return out;
}

/**
 * AUDIT QUESTLINES BRANCH-9: every message a patch's own lines name - an `ask`'s question and answers, a `say`, a `log`, a
 * `saying` - is one the patched script holds (an ask naming none asks nothing, and the reward waiting on its answer waits
 * for ever - qlActions.js QlAsk), and its words take no id the script already has (QL_MESSAGE_BASE's band).
 * @param {string} name @param {{ old: string, new: string }[]} patches @param {{ quest: any, lines: string[] }} parsed
 * @param {{ quest: any, lines: string[] } | null} shipped
 */
export function patchMessageProblems(name, patches, parsed, shipped) {
  const out = [];
  const before = new Set((shipped?.lines ?? []).map((l) => l.trim()));
  const named = new Set();
  let inQbn = false;
  for (const l of parsed.lines) {
    if (/^\s*QBN:/i.test(l)) { inQbn = true; continue; }
    if (!inQbn || before.has(l.trim())) continue;   // the patch's own lines alone
    for (const m of l.matchAll(/^\s*(?:say|log)\s+(\d+)|\bsaying\s+(\d+)/g)) named.add(Number(m[1] ?? m[2]));
    const ask = /^\s*ask\s+(\d+)\s+choices((?:\s+\d+\s+_[^\s]+_)+)/.exec(l);
    if (ask) { named.add(Number(ask[1])); for (const x of ask[2].matchAll(/(\d+)\s+_/g)) named.add(Number(x[1])); }
  }
  for (const id of [...named].sort((a, b) => a - b)) if (!parsed.quest.getMessage?.(id)) out.push(`${name}: names message ${id}, which the patched script does not have`);
  for (const p of patches) {
    for (const m of p.new.matchAll(/Message:\s+(\d+)/g)) if (!p.old.includes(m[0]) && shipped?.quest?.getMessage?.(Number(m[1]))) out.push(`${name}: its words take message ${m[1]}, which the script already has`);
  }
  return out;
}

/** The longest centred row a patch's message may have, in characters (DFU's own run 33 to the half, 48 to nineteen in twenty). */
export const ROW_CHARS = 50;
/**
 * AUDIT QUESTLINES BRANCH-8: a patch's words fit the classic skin, which never wraps: the message box grows to its widest
 * row (ui/messageBox.js layoutMessageBox - past 300 px it runs off the 320-px screen), and the pick list draws each answer
 * from x 86 across its 138-px list (ui/listPicker.js). Every row of a patch's messages at most ROW_CHARS characters, and
 * every answer an `ask` offers at most CHOICE_CHARS (tools/qlPatchKit.mjs).
 * @param {string} name @param {{ old: string, new: string }[]} patches
 */
export function patchWidthProblems(name, patches) {
  const out = [];
  const text = patches.map((p) => p.new).join('\n');
  const answers = new Set([...text.matchAll(/\bask\s+\d+\s+choices((?:\s+\d+\s+_[^\s]+_)+)/g)].flatMap((m) => [...m[1].matchAll(/(\d+)\s+_/g)].map((x) => Number(x[1]))));
  let id = null;
  let rows = [];
  const flush = () => {
    if (id == null) return;
    if (answers.has(id)) {
      const label = rows.join(' ').trim();
      if (rows.length !== 1 || label.length > CHOICE_CHARS) out.push(`${name}: answer ${id} "${label}" - one line of at most ${CHOICE_CHARS} characters`);
    } else {
      for (const r of rows) { const t = r.replace(/^<ce>\s*/, '').trim(); if (t.length > ROW_CHARS) out.push(`${name}: message ${id}'s row "${t}" is over ${ROW_CHARS} characters`); }
    }
    id = null; rows = [];
  };
  for (const l of text.split('\n')) {
    const m = /^Message:\s+(\d+)/.exec(l);
    if (m) { flush(); id = Number(m[1]); continue; }
    if (!l.trim()) { flush(); continue; }
    if (id != null) rows.push(l);
  }
  flush();
  return out;
}

if (isMain(import.meta.url)) {
  const family = process.argv[2];
  if (!family) { console.error('usage: node tools/qlCheck.mjs <Family>'); process.exit(1); }
  const problems = checkFamily(family);
  console.log(problems.length ? problems.join('\n') : `${family}: clean (${SHEET_FAMILIES.find((f) => f.family === family)?.sheets.length ?? 0} sheets, ${flagshipOf(family).size} flagship)`);
  process.exit(problems.length ? 1 : 0);
}
