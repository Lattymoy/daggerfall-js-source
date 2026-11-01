#!/usr/bin/env node
// OWN-WORDS1 (2026-10-31; the owner, asked whether quest text should come from the player's ARENA2: "We plan on moving
// away from arena so whatever works for future proofing"). A quest in DFO's own words is src/systems/quest/own/NAME.txt,
// read in place of DFU's file of its name: DFU's QBN verbatim, our own messages. This holds each one to DFU's logic, so
// a rewrite can never break a quest (bible/06-Systems/Own-Words.md).
//   node tools/ownQuestCheck.mjs [NAME ...]        check every own quest, or the named ones
//   node tools/ownQuestCheck.mjs --scaffold NAME   start one: DFU's header and QBN, each message's id and what it keeps
//   node tools/ownQuestCheck.mjs --wrap NAME       wrap each message's lines to the width of DFU's message
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadQuestTables, staticMessagesTable } from '../src/systems/quest/tables.js';
import { Parser, splitField } from '../src/systems/quest/parser.js';
import { getMacro, MACRO_TYPES } from '../src/systems/quest/questMacros.js';
import { applyQuestPatches, applyTextPatches, QUEST_PATCHES } from '../src/systems/quest/questPatches.js';
import { applyQuestlinePatches, hasQuestlinePatch } from '../src/systems/questlines/qlPatches.js';
import { stringBreach } from './plainText.mjs';
import { isMain } from './lib/isMain.mjs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const OWN_DIR = 'src/systems/quest/own';
export const DFU_DIR = 'vendor/dfu-quests/Quests';
const TABLES_DIR = 'vendor/dfu-quests/Tables';
/** The header line every own quest carries: whose logic it runs, whose words it speaks. */
// CREDITS-OUT (Mac, 2026-11-01): the header names no one; the MIT notice ships in LICENSE.txt
export const OWN_CREDIT = '-- OWN-WORDS: the QBN is MIT-licensed (its notice ships in LICENSE.txt), verbatim. The messages are DFO Online\'s own words.';
/** A run of this many words that DFU's quest text also has is a kept sentence. */
export const SHARED_RUN = 6;
/** The widest a line may be, and the least a message may use: centred popups, and the journal's and letters' lines. */
export const WIDTH = Object.freeze({ max: 60, centre: 40, plain: 34 });
/** Macros that read the last Person or Foe named before them; `%di` reads the last Place. */
const PRONOUNS = new Set(['%g', '%g1', '%g2', '%g2self', '%g3', '%g4', '%vcn', '%hrn']);
/** TAMRIEL-WIDE: names a quest that can run in any province never says. A quest set there says why in a `-- BAY-OWN:` line. */
const BAY_NAMES = /\b(Iliac|the Bay|Daggerfall|High Rock|Hammerfell)\b/i;
const MACRO_ANY = /____[a-zA-Z0-9.]+_|___[a-zA-Z0-9.]+_|__[a-zA-Z0-9.]+_|_[a-zA-Z0-9.]+_|==[a-zA-Z0-9.]+_|=#[a-zA-Z0-9.]+_|=[a-zA-Z0-9.]+_|%\w+/g;

const norm = (t) => String(t).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
const read = (p) => norm(readFileSync(p, 'utf8'));
/** `%G` and `%g` read the same person: the capital is the sentence's, not the macro's. */
const fold = (token) => (/^%[gG]/.test(token) ? token.toLowerCase() : token);

function ensureTables() {
  try { staticMessagesTable(); return; } catch { /* not loaded yet */ }
  const sources = {};
  for (const f of readdirSync(join(ROOT, TABLES_DIR))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = read(join(ROOT, TABLES_DIR, f));
  loadQuestTables(sources);
}

/** A script's three parts: the header's lines, the QRC's lines, and the QBN as text from its `QBN:` line on. */
export function splitQuest(text) {
  const lines = norm(text).split('\n');
  const qrc = lines.findIndex((l) => /^qrc:/i.test(l.trim()));
  const qbn = lines.findIndex((l) => /^qbn:/i.test(l.trim()));
  if (qrc < 0 || qbn < qrc) return null;
  // `qbn` is compared trimmed; `qbnRaw` is written back as it stands - a questline patch may anchor on DFU's last line's
  // trailing space (patches/nobility.json, R0C11Y16's `\tend quest `)
  const tail = lines.slice(qbn).join('\n');
  return { header: lines.slice(0, qrc), qrc: lines.slice(qrc + 1, qbn), qbn: tail.replace(/\s+$/, ''), qbnRaw: tail.endsWith('\n') ? tail : `${tail}\n` };
}

/** The QRC's messages as written, by the parser's own rules (parser.js _parseQRC): header line, id and body lines. */
export function rawMessages(qrc) {
  ensureTables();
  const table = staticMessagesTable();
  const out = [];
  const endsAt = (i) => i + 1 >= qrc.length || qrc[i + 1].includes(':') || qrc[i + 1].startsWith('-') || !qrc[i + 1].trim();
  for (let i = 0; i < qrc.length; i++) {
    if (qrc[i].startsWith('-') || !qrc[i].trim()) continue;
    const parts = splitField(qrc[i]);
    if (!table.hasValue(parts[0])) throw new Error(`not a message header: "${qrc[i]}"`);
    const fixed = parts[1].startsWith('[') && parts[1].endsWith(']');
    const start = i, body = [];
    for (;;) {
      if (i + 1 >= qrc.length) break;
      const line = qrc[++i];
      if (!line) { if (!endsAt(i)) { body.push(line); continue; } break; }
      body.push(line);
    }
    out.push({ header: qrc[start], id: fixed ? table.getInt('id', parts[0]) : Number(parts[1]), start, body });
  }
  return out;
}

const lineText = (line) => (line.startsWith('<ce>') ? line.slice(4).trim() : line.replace(/\s+$/, ''));
/** The width DFU's message was written to, held between the floor for its kind and the most a line may be. */
function widthOf(body) {
  const centred = body.some((l) => l.startsWith('<ce>'));
  const most = Math.max(0, ...body.filter((l) => !l.includes('<--->')).map((l) => lineText(l).length));
  return Math.min(WIDTH.max, Math.max(most, centred ? WIDTH.centre : WIDTH.plain));
}

/** One message's shape: its layout, and per variant its words, macro tokens and what each pronoun and place points at. */
function shapeOf(quest, message) {
  const lines = message.getSaveData().lines;
  const variants = [[]];
  for (const l of lines) if (l.includes('<--->')) variants.push([]); else variants[variants.length - 1].push(l);
  const text = lines.filter((l) => l.trim() && !l.includes('<--->'));
  const centred = text.filter((l) => l.startsWith('<ce>')).length;
  const shape = { layout: centred === 0 ? 'plain' : centred === text.length ? 'centre' : 'mixed', variants: [], tokens: new Set(), pairs: new Set(), last: new Set(), doubled: [] };
  for (const v of variants) {
    const words = v.flatMap((l) => l.replace(/<ce>/g, ' ').split(/\s+/)).filter(Boolean);
    // `named` is what a pronoun reads (a Person or a Foe), `place` what %di reads (a Place, or a Person's own place);
    // the journal's way and its moved site read the last Place and the last Person
    let named = '', place = '', lastPlace = '', lastPerson = '';
    for (const w of words) {
      const m = getMacro(w);
      if (m.type === MACRO_TYPES.None) continue;
      if ((w.match(MACRO_ANY) ?? []).length > 1) shape.doubled.push(w);
      shape.tokens.add(fold(m.token));
      if (m.type === MACRO_TYPES.ContextMacro) {
        if (PRONOUNS.has(fold(m.token))) shape.pairs.add(`${fold(m.token)} after ${named || 'nobody named here'}`);
        else if (m.token === '%di') shape.pairs.add(`%di after ${place || 'no place named here'}`);
        continue;
      }
      const r = quest.getResource({ name: m.symbol });
      if (r?.isPerson || r?.isFoe) named = m.symbol;
      if (r?.isPerson) { place = `${m.symbol}'s place`; lastPerson = m.symbol; }
      if (r?.isPlace) { place = m.symbol; lastPlace = m.symbol; }
    }
    shape.last.add(`last place ${lastPlace || 'none'}, last person ${lastPerson || 'none'}, last named ${named || 'none'}`);
    shape.variants.push({ lines: v, words });
  }
  return shape;
}

const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
const diff = (a, b) => [...a].filter((x) => !b.has(x));
/** A word as the shared-run test reads it: no case, no punctuation; the journal's date stamp is no word. */
const normWord = (w) => { const n = w.toLowerCase().replace(/<ce>/g, '').replace(/[^a-z0-9_%=#.]/g, '').replace(/^\.+|\.+$/g, ''); return n === '%qdt' ? '' : n; };

let _dfuRuns = null;
/** Every run of SHARED_RUN words in DFU's quest messages (the whole corpus, so no Bethesda sentence comes back) and,
 *  where ARENA2_PATH is set (`sh tools/fetch-data.sh`), in ARENA2's own QRC files: 303 of them, where DFU converted 265. */
function dfuRuns() {
  if (_dfuRuns) return _dfuRuns;
  _dfuRuns = new Set();
  const add = (text) => {
    const words = text.split(/\s+/).map(normWord).filter(Boolean);
    for (let i = 0; i + SHARED_RUN <= words.length; i++) _dfuRuns.add(words.slice(i, i + SHARED_RUN).join(' '));
  };
  for (const f of readdirSync(join(ROOT, DFU_DIR))) {
    const parts = f.endsWith('.txt') ? splitQuest(read(join(ROOT, DFU_DIR, f))) : null;
    if (parts) for (const m of rawMessages(parts.qrc)) add(m.body.join(' '));
  }
  const arena2 = process.env.ARENA2_PATH;
  if (arena2 && existsSync(arena2)) {
    for (const f of readdirSync(arena2)) if (/\.QRC$/i.test(f)) add(readFileSync(join(arena2, f)).toString('latin1').replace(/[^\x20-\x7e]+/g, ' '));
  }
  return _dfuRuns;
}

/** OWN-WORDS2: the runs of SHARED_RUN words `text` shares with DFU's quest messages (and ARENA2's QRC files, where
 *  ARENA2_PATH is set) - the questline patches' own messages are held to it beside the own files. */
export function sharedRunsIn(text) {
  const runs = dfuRuns(), words = text.split(/\s+/).map(normWord).filter(Boolean), out = [];
  for (let i = 0; i + SHARED_RUN <= words.length; i++) { const r = words.slice(i, i + SHARED_RUN).join(' '); if (runs.has(r)) out.push(r); }
  return out;
}

const parse = (text) => { ensureTables(); return new Parser().parse(norm(text).split('\n'), 0, { rolls: () => 0.5 }); };

/**
 * What is wrong with `ownText` as the own words of DFU's quest `name` (`dfuText`, its file): a list of problems, empty
 * when the rewrite keeps everything the parser, the machine, the journal and the patches read.
 */
export function checkText(name, ownText, dfuText) {
  const problems = [];
  const own = splitQuest(ownText), dfu = splitQuest(dfuText);
  if (!own) return [`${name}: no QRC: and QBN: sections`];
  // the logic is DFU's, byte for byte, and so are the header's fields
  if (own.qbn !== dfu.qbn) {
    const a = own.qbn.split('\n'), b = dfu.qbn.split('\n');
    const at = a.findIndex((l, i) => l !== b[i]);
    problems.push(`QBN differs from DFU's at its line ${at + 1}: "${a[at] ?? '(end)'}" where DFU has "${b[at] ?? '(end)'}"`);
  }
  const fields = (h) => h.filter((l) => l.trim() && !l.trim().startsWith('-')).map((l) => l.trim());
  if (fields(own.header).join('\n') !== fields(dfu.header).join('\n')) problems.push('the header\'s fields (Messages:, Quest:, DisplayName:) differ from DFU\'s');
  if (!own.header.includes(OWN_CREDIT)) problems.push('the header has no OWN-WORDS credit line (OWN_CREDIT)');
  const bayOwn = own.header.some((l) => l.startsWith('-- BAY-OWN:'));
  let oq, dq;
  try { oq = parse(ownText); } catch (e) { problems.push(`does not parse: ${e.message}`); return problems; }
  dq = parse(dfuText);
  if (oq.questName !== dq.questName || oq.displayName !== dq.displayName) problems.push('a message line reads as a header field (Quest: or DisplayName:)');
  // the messages: the same ids, each with the same layout, variants, macros, pronouns and last-named place and person
  const missing = [...dq.messages.keys()].filter((id) => !oq.messages.has(id));
  const extra = [...oq.messages.keys()].filter((id) => !dq.messages.has(id));
  if (missing.length) problems.push(`messages missing: ${missing.join(', ')}`);
  if (extra.length) problems.push(`messages DFU's script does not have: ${extra.join(', ')}`);
  const widths = new Map(rawMessages(dfu.qrc).map((m) => [m.id, widthOf(m.body)]));
  const letters = new Map([...dfu.qbn.matchAll(/^\s*Item\s+(\S+)\s+letter\s+used\s+(\d+)/gim)].map((m) => [Number(m[2]), m[1]]));
  const runs = dfuRuns();
  for (const [id, dm] of dq.messages) {
    const om = oq.messages.get(id);
    if (!om) continue;
    const d = shapeOf(dq, dm), o = shapeOf(oq, om);
    const at = `message ${id}`;
    if (o.layout !== d.layout) problems.push(`${at}: layout ${o.layout}, DFU's is ${d.layout} (keep <ce> where DFU centres, and only there)`);
    if (o.variants.length !== d.variants.length) problems.push(`${at}: ${o.variants.length} variants, DFU's has ${d.variants.length} (<--->)`);
    if (!sameSet(o.tokens, d.tokens)) {
      const lost = diff(d.tokens, o.tokens), added = diff(o.tokens, d.tokens);
      problems.push(`${at}: macros ${lost.length ? `dropped ${lost.join(' ')}` : ''}${lost.length && added.length ? ', ' : ''}${added.length ? `added ${added.join(' ')}` : ''}`);
    }
    if (!sameSet(o.pairs, d.pairs)) problems.push(`${at}: a pronoun or %di reads someone else - DFU's: ${[...d.pairs].join('; ') || 'none'}; ours: ${[...o.pairs].join('; ') || 'none'}`);
    if (!sameSet(o.last, d.last)) problems.push(`${at}: the journal's way points elsewhere - DFU's: ${[...d.last].join('; ')}; ours: ${[...o.last].join('; ')}`);
    for (const w of o.doubled) problems.push(`${at}: "${w}" holds two macros in one word - only the first expands`);
    if (letters.has(id)) {
      const tail = (s) => new Set(s.variants.at(-1).lines.filter((l) => l.replace('<ce>', '').trim()).at(-1)?.split(/\s+/).map((w) => getMacro(w).token).filter(Boolean) ?? []);
      if (!sameSet(tail(o), tail(d))) problems.push(`${at}: ${letters.get(id)}'s last line names the letter - keep DFU's signer (${[...tail(d)].join(' ') || 'no macro'})`);
    }
    const width = widths.get(id) ?? WIDTH.max;
    for (const v of o.variants) {
      const words = v.words;
      if (!words.length && d.variants[0].words.length) problems.push(`${at}: a variant with no words`);
      const said = words.join(' ');
      const breach = stringBreach(said);
      if (breach) problems.push(`${at}: past PLAIN-TEXT - ${breach.words} words (40 at most), a sentence of ${breach.sentence} (25 at most)${breach.padding.length ? `, padding ${breach.padding.join(' ')}` : ''}`);
      if (!bayOwn && BAY_NAMES.test(said)) problems.push(`${at}: names the Bay's own places ("${BAY_NAMES.exec(said)[0]}") - TAMRIEL-WIDE, or a -- BAY-OWN: header line with why`);
      if (/TODO/.test(said)) problems.push(`${at}: still says TODO`);
      for (const l of v.lines) if (lineText(l).length > width) problems.push(`${at}: a line of ${lineText(l).length} characters (${width} at most): "${lineText(l)}"`);
      const nw = words.map(normWord).filter(Boolean);
      for (let i = 0; i + SHARED_RUN <= nw.length; i++) {
        const run = nw.slice(i, i + SHARED_RUN).join(' ');
        if (runs.has(run)) { problems.push(`${at}: keeps DFU's words "${run}"`); break; }
      }
    }
  }
  // the port's patches over DFU's quest, and the questlines' branch, still find their text in ours
  let patched = norm(ownText);
  if (QUEST_PATCHES[name]) {
    try { patched = applyQuestPatches(name, patched); } catch (e) { problems.push(e.message); }
  }
  if (hasQuestlinePatch(name)) {
    try { parse(applyQuestlinePatches(name, patched)); } catch (e) { problems.push(e.message); }
  }
  return problems;
}

/** The own quests on disk, by name. */
export function ownQuestNames(root = ROOT) {
  const dir = join(root, OWN_DIR);
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.txt')).map((f) => f.slice(0, -4)).sort() : [];
}

/** OWN-WORDS2: a port fix of DFU's words that an own file carries itself, its patch gone from questPatches.js
 *  (Own-Words.md, "The next batches"). DFU's file is read with the fix, so the rewrite keeps the fixed macro. */
export const CARRIED_FIXES = Object.freeze({
  // QUEST-AUDIT III DUEL-TOWN: the duel's journal (1003) names the inn's own town, not the questor's
  A0C00Y10: [{ old: ' _inn_ in ___giver_ in six hours.', new: ' _inn_ in ___inn_ in six hours.', count: 1 }],
});

/** DFU's file of the quest `name` as its own file answers to it: with its carried fix, where it has one. */
export function dfuSource(name, root = ROOT) {
  const text = read(join(root, DFU_DIR, `${name}.txt`));
  return CARRIED_FIXES[name] ? applyTextPatches('OWN-CARRIED', name, CARRIED_FIXES[name], text) : text;
}

/** Problems with the own quest `name` (none when it holds); a name DFU's pack does not have is one. */
export function checkOwnQuest(name, root = ROOT) {
  const dfuPath = join(root, DFU_DIR, `${name}.txt`);
  if (!existsSync(dfuPath)) return [`${name}: DFU's pack has no quest of this name - an own file replaces one of DFU's`];
  return checkText(name, read(join(root, OWN_DIR, `${name}.txt`)), dfuSource(name, root));
}

/** A starting file for DFU's quest `name`: the credit, DFU's header and QBN, and for each message its header and a TODO
 *  line naming the macros it must keep (each variant its own). */
export function scaffold(name, root = ROOT) {
  const dfuText = dfuSource(name, root);
  const dfu = splitQuest(dfuText);
  const quest = parse(dfuText);
  const out = [OWN_CREDIT, ...dfu.header, 'QRC:', ''];
  for (const m of rawMessages(dfu.qrc)) {
    const s = shapeOf(quest, quest.getMessage(m.id));
    out.push(m.header);
    s.variants.forEach((v, i) => {
      if (i) out.push('<--->');
      const dated = v.lines[0]?.trim() === '%qdt:';
      const keep = [...new Set(v.words.map((w) => getMacro(w)).filter((x) => x.type !== MACRO_TYPES.None).map((x) => x.token))].filter((t) => !dated || t !== '%qdt');
      if (dated) out.push('%qdt:');
      out.push(`${s.layout === 'centre' ? '<ce>' : ''} TODO ${keep.join(' ')}`.replace(/\s+$/, ''));
    });
    out.push('');
  }
  return `${[...out, ''].join('\n')}\n${dfu.qbnRaw}`;
}

/** A message's body wrapped to `width`. Lines of one kind flow together: `<ce>` lines, lines with no lead, lines led by
 *  one space. Two or more spaces start a new paragraph. `<--->`, `%qdt:`, a bare `<ce>`, a line of spaces and a centred
 *  line of names alone (a letter's signature) stay as they are. */
export function wrapBody(body, width) {
  const out = [];
  let para = null;
  const end = () => {
    if (!para) return;
    // greedy at `w`; a plain line's lead is part of its width - its own on the first line, one space on the rest
    const greedy = (w) => {
      let line = '';
      const lines = [];
      const room = () => w - (para.kind === 'ce' ? 0 : lines.length ? Math.min(1, para.lead.length) : para.lead.length);
      for (const word of para.words) {
        if (line && line.length + 1 + word.length > room()) { lines.push(line); line = word; } else line = line ? `${line} ${word}` : word;
      }
      if (line) lines.push(line);
      return lines;
    };
    // as few lines as the width allows, then as even as they can be: no word left alone on the last line
    const most = greedy(width).length;
    let even = width;
    while (even > 1 && greedy(even - 1).length === most) even--;
    greedy(even).forEach((l, i) => out.push(para.kind === 'ce' ? `<ce> ${l}` : `${i && para.lead ? ' ' : para.lead}${l}`));
    para = null;
  };
  for (const line of body) {
    const t = line.trim();
    if (t.includes('<--->') || (t === '%qdt:' && !para) || t === '<ce>' || !t) { end(); out.push(t.includes('<--->') ? '<--->' : line); continue; }
    if (line.startsWith('<ce>')) {
      // a centred line of names alone is a signature's line, and keeps its own line
      if (t.slice(4).trim().split(/\s+/).every((w) => getMacro(w).type !== MACRO_TYPES.None)) { end(); out.push(`<ce> ${t.slice(4).trim()}`); continue; }
      if (para?.kind !== 'ce') { end(); para = { kind: 'ce', words: [] }; }
      para.words.push(...t.slice(4).trim().split(/\s+/));
      continue;
    }
    const lead = /^ */.exec(line)[0];
    const kind = lead ? 'plain' : 'bare';
    if (para?.kind !== kind || lead.length > 1) { end(); para = { kind, lead, words: [] }; }
    para.words.push(...t.split(/\s+/));
  }
  end();
  return out;
}

/** The own quest's text with every message wrapped to its DFU message's width; nothing else moves. */
export function wrapped(name, root = ROOT) {
  const text = read(join(root, OWN_DIR, `${name}.txt`));
  const own = splitQuest(text);
  const widths = new Map(rawMessages(splitQuest(read(join(root, DFU_DIR, `${name}.txt`))).qrc).map((m) => [m.id, widthOf(m.body)]));
  const qrc = [...own.qrc];
  for (const m of rawMessages(own.qrc).reverse()) qrc.splice(m.start + 1, m.body.length, ...wrapBody(m.body, widths.get(m.id) ?? WIDTH.max));
  return `${[...own.header, text.split('\n').find((l) => /^qrc:/i.test(l.trim())), ...qrc].join('\n')}\n${own.qbnRaw}`;
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = args.find((a) => a.startsWith('--'));
  const names = args.filter((a) => !a.startsWith('--'));
  if (flag === '--scaffold') {
    for (const n of names) {
      const path = join(ROOT, OWN_DIR, `${n}.txt`);
      if (existsSync(path)) { console.log(`KEPT  ${n}: ${OWN_DIR}/${n}.txt is there already`); continue; }
      writeFileSync(path, scaffold(n));
      console.log(`WROTE ${OWN_DIR}/${n}.txt - replace each TODO with our own words`);
    }
  } else if (flag === '--wrap') {
    for (const n of names) { writeFileSync(join(ROOT, OWN_DIR, `${n}.txt`), wrapped(n)); console.log(`WRAPPED ${n}`); }
  } else {
    let bad = 0;
    for (const n of names.length ? names : ownQuestNames()) {
      const problems = checkOwnQuest(n);
      if (problems.length) bad++;
      for (const p of problems) console.log(`FAIL  ${n}: ${p}`);
      if (!problems.length) console.log(`OK    ${n}`);
    }
    process.exitCode = bad ? 1 : 0;
  }
}
