// MACRO-7 (2026-09-22, the macro audit): THE GATE - NO RAW TOKEN BACK.
// Mac: "a recurring issue with a lot of things". It recurred because
// nothing stopped a new window reading a TEXT.RSC record and drawing it
// without a macro walk (MACRO-3's four boxes), and nothing stopped a
// record carrying a token no source answers (MACRO-4/5/6).
//
// Two halves:
//   1. THE READ-SITE CENSUS. Every place in src/ that reads a TEXT.RSC
//      record is found by pattern, and each must carry a verdict here:
//        walk  - a macro walk sits in the same statement (checked: the
//                walk's name is within four lines of the read);
//        seam  - the rows are handed to a consumer that walks them
//                (checked: the consumer file calls a walk);
//        plain - drawn raw because the records carry no token (checked
//                against DFU's own table when the clone is present), or
//                raw in DFU too (cited).
//      A new site with no verdict fails, so whoever adds one decides
//      how it is walked. A verdict whose site is gone fails too.
//   2. THE TOKEN LEDGER. Every token in DFU's TEXT.RSC either has a row
//      in the ONE macro table, or is named below with who consumes it -
//      so a record whose token nothing answers is a decision, not a leak.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { macroTableCoverage } from '../src/systems/quest/questMacros.js';
import { spellMakerDescriptionId, SPELLBOOK_DESCRIPTION_IDS } from '../src/systems/spellEffects.js';
import { REST_TEXT } from '../src/systems/restSession.js';
import { EXHAUSTED_SAFE_TEXT_ID, EXHAUSTED_ENEMIES_TEXT_ID } from '../src/systems/rest.js';
import { NOT_SATED_TEXT_ID } from '../src/systems/vampirism.js';
import { dfuFile, missingDfu } from './dfuRoot.mjs';

const ROOT = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');

// the reads: the host seam (townTalk.lines / rows), the parser's own
// readers, and the plainLines flattening every raw ActionTextBox takes
const READ = /\b(?:townTalk\??\.)?(?:lines|rows)\?\.\(|\.lines\(|\bplainLines\(|\.variantTokens\(|\.linesById\(|\.variantLinesById\(|\.plainText\(|\.randomTextById\(/;
const WALKS = /\b(?:expandRowValues|expandMacroValues|expandGuildRows|expandGuildMacros|expandMessageBoxTokens|expandTalkMacros|statDescriptionRows|macroRows|expandAnswerRecord|expandMacros|expandRecord|expandQuestMessage|expandCommonTokens|courtLines)\(/;

function census() {
  const walk = (d) => readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : [];
  });
  const out = [];
  for (const f of walk(new URL('src', ROOT).pathname)) {
    const rel = f.slice(f.indexOf('/src/') + 1);
    if (rel === 'src/formats/textRsc.js') continue;   // the parser itself
    const lines = readFileSync(f, 'utf8').split('\n');
    lines.forEach((l, i) => {
      const t = l.trim();
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
      // READS: record reads on the line - plainLines only flattens one,
      // so it counts when it is the line's only hit (a draw off a seam).
      // A verdict covers ONE read; a second read on a classified line is
      // a new site and needs its own say.
      if (!READ.test(l)) return;
      const reads = (l.match(new RegExp(READ.source, 'g')) ?? []).filter((m) => m !== 'plainLines(').length;
      out.push({ file: rel, line: i + 1, code: t, lines, reads: Math.max(1, reads) });
    });
  }
  return out;
}

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const RACES = range(2000, 2007), CLASSES = range(2100, 2117);
const CHARGEN_TEXT = [300, 301, 302, 303, 306, ...range(2400, 2407)];
// the rest boxes, off the constants the rest law speaks them from
const REST_BOXES = [...Object.values(REST_TEXT), EXHAUSTED_SAFE_TEXT_ID, EXHAUSTED_ENEMIES_TEXT_ID, NOT_SATED_TEXT_ID];

// [file, a substring unique to the site's line, verdict, detail]
//   walk:  detail unused (the walk must be within four lines)
//   seam:  detail = the consumer file that walks what it is handed
//   plain: detail = { ids } checked token-free, or { dfu } the DFU cite
//          where the same text is drawn raw
const SITES = [
  // ── dungeonContext.js ──
  ['src/scenes/dungeonContext.js', 'textAt: (id) => textRsc?.plainText(id)', 'seam', 'src/scenes/shared.js'],
  ['src/scenes/dungeonContext.js', 'rows: (id) => textRsc?.variantLinesById(id) ?? [],', 'seam', 'src/ui/spellbookWindow.js'],
  ['src/scenes/dungeonContext.js', '// AUDIT 22 F2', 'seam', 'src/ui/nativeInventory.js'],
  ['src/scenes/dungeonContext.js', 'const v = textRsc?.plainText(id);', 'walk'],
  ['src/scenes/dungeonContext.js', 'rows: (id, pick) => textRsc?.variantLinesById(id, pick ?? Math.random) ?? [],\n', 'seam', 'src/ui/nativeTrade.js'],
  ['src/scenes/dungeonContext.js', 'randomText: (id) => textRsc?.randomTextById(', 'plain', { ids: [8999] }],
  ['src/scenes/dungeonContext.js', "the eight attribute popups'", 'seam', 'src/ui/charsheet.js'],
  // ── exterior.js ──
  ['src/scenes/exterior.js', 'textAt: (id) => townTalk.lines(id),', 'seam', 'src/scenes/shared.js'],
  ['src/scenes/exterior.js', 'endLines: (id) => townTalk.lines(id),', 'seam', 'src/scenes/shared.js'],
  ['src/scenes/exterior.js', 'plainLines(townTalk.lines(rb.textId))', 'plain', { ids: REST_BOXES }],
  ['src/scenes/exterior.js', 'plainLines(townTalk.lines(d.textId))', 'plain', { ids: REST_BOXES }],
  ['src/scenes/exterior.js', 'plainLines(townTalk.lines(ANCHOR_MUST_BE_SET))', 'plain', { ids: [4001] }],
  ['src/scenes/exterior.js', '// U25: the real item info', 'seam', 'src/ui/nativeInventory.js'],
  ['src/scenes/exterior.js', 'swapQuickslot({', 'seam', 'src/systems/quickslots.js'],
  ['src/scenes/exterior.js', 'rows: (id, pick) => townTalk.lines(id, pick),\n', 'seam', 'src/ui/spellbookWindow.js'],
  ['src/scenes/exterior.js', "the eight attribute popups'", 'seam', 'src/ui/charsheet.js'],
  ['src/scenes/exterior.js', 'lines: (id) => townTalk.lines(id),', 'seam', 'src/systems/healthStatus.js'],
  ['src/scenes/exterior.js', 'textLines: (id) => townTalk.lines(id),', 'plain', { ids: [1069] }],
  ['src/scenes/exterior.js', 'const lines = plainLines(townTalk.lines(id));', 'plain', { ids: [20, 32] }],
  ['src/scenes/exterior.js', 'expandMessageBoxTokens(townTalk.recordTokens(id)', 'walk'],
  // ── questBridge.js / shared.js ──
  ['src/scenes/questBridge.js', "case 'fail': return [{ rows: rows?.(step.textId)", 'plain', { ids: [600] }],
  ['src/scenes/shared.js', 'announceMastery(id', 'walk'],
  ['src/scenes/shared.js', 'const lines = plainLines(textAt?.(id));', 'plain', { ids: [401] }],
  ['src/scenes/shared.js', 'endLines: (id) => plainLines(rest.endLines?.(id)),', 'plain', { ids: REST_BOXES }],
  // ── townTalk.js ──
  ['src/scenes/townTalk.js', 'const v = id ? textRsc?.plainText(id) : null;', 'plain', { ids: [475, 476, 477] }],
  ['src/scenes/townTalk.js', "const textVariants = (id) => textRsc?.plainText(id) ?? [''];", 'seam', 'src/systems/talkSession.js'],
  ['src/scenes/townTalk.js', 'const v = textRsc?.plainText(id);', 'seam', 'src/scenes/townTalk.js'],
  ['src/scenes/townTalk.js', 'const t = textRsc?.randomTextById(id, rolls);', 'plain', { ids: range(201, 208) }],
  ['src/scenes/townTalk.js', 'lines: (id, pick = rolls) => textRsc?.variantLinesById(id, pick)', 'seam', 'src/scenes/townTalk.js'],
  ['src/scenes/townTalk.js', "randomText: (id) => textRsc?.randomTextById(id, rolls) ?? '',", 'plain', { ids: [256, 8999] }],
  // ── world.js ──
  ['src/scenes/world.js', 'textAt: (id) => townTalk.lines(id),', 'seam', 'src/scenes/shared.js'],
  ['src/scenes/world.js', 'const lines = plainLines(townTalk.lines(id));', 'plain', { ids: [20, 32] }],
  ['src/scenes/world.js', 'rows: (id, pick) => townTalk.lines(id, pick),\n', 'seam', 'src/ui/spellbookWindow.js'],
  ['src/scenes/world.js', 'swapQuickslot({', 'seam', 'src/systems/quickslots.js'],
  ['src/scenes/world.js', '// U25: the real item info', 'seam', 'src/ui/nativeInventory.js'],
  ['src/scenes/world.js', "the eight attribute popups'", 'seam', 'src/ui/charsheet.js'],
  ['src/scenes/world.js', 'endLines: (id) => townTalk.lines(id),', 'seam', 'src/scenes/shared.js'],
  ['src/scenes/world.js', 'plainLines(townTalk.lines(rb.textId))', 'plain', { ids: REST_BOXES }],
  ['src/scenes/world.js', 'plainLines(townTalk.lines(d.textId))', 'plain', { ids: REST_BOXES }],
  ['src/scenes/world.js', 'lines: (id) => townTalk.lines(id),', 'seam', 'src/scenes/shared.js'],
  ['src/scenes/world.js', 'textLines: (id) => townTalk.lines(id),', 'plain', { ids: [1069] }],
  ['src/scenes/world.js', 'getRandomTokens: (textId) => townTalk.variantTokens(textId),', 'seam', 'src/systems/quest/questMacros.js'],
  ['src/scenes/world.js', 'expandRandomTextRecord: (id) => townTalk.lines(id)', 'plain', { ids: [1457] }],
  ['src/scenes/world.js', 'randomTokens: (id) => townTalk.variantTokens(id),', 'seam', 'src/systems/talkMacros.js'],
  ['src/scenes/world.js', 'expandMessageBoxTokens(tokens, talkMcp())', 'walk'],
  ['src/scenes/world.js', 'const r = townTalk.lines(id)?.[0];', 'plain', { ids: [475, 476, 477] }],
  ['src/scenes/world.js', 'expandMessageBoxTokens(townTalk.recordTokens(id), talkMcp())', 'walk'],
  // ── worldModes.js ──
  ['src/scenes/worldModes.js', 'textAt: (id) => townTalk?.lines?.(id) ?? null,', 'seam', 'src/scenes/shared.js'],
  ['src/scenes/worldModes.js', 'rows: (id, pick) => townTalk?.lines?.(id, pick) ?? [],', 'seam', 'src/ui/nativeTrade.js'],
  ['src/scenes/worldModes.js', 'questBridge.offerBoxes(step, (id) => townTalk?.lines?.(id) ?? [])', 'plain', { ids: [600] }],
  ['src/scenes/worldModes.js', 'const rawRows = (id) => townTalk?.lines?.(id) ?? [];', 'walk'],
  ['src/scenes/worldModes.js', 'const rows = (id) => expandGuildRows(', 'walk'],
  ['src/scenes/worldModes.js', 'const spyRows = rows?.(SPYMASTER_GREETING_TEXT_ID)', 'seam', 'src/scenes/worldModes.js'],
  ['src/scenes/worldModes.js', 'const refusal = rows?.(decision.textId)', 'seam', 'src/scenes/worldModes.js'],
  ['src/scenes/worldModes.js', 'const say = (id, d = daedra) => expandRowValues(', 'walk'],
  ['src/scenes/worldModes.js', ': (rows?.(decision.textId ?? decision.result)', 'seam', 'src/scenes/worldModes.js'],
  ['src/scenes/worldModes.js', "return { rows: rows?.(decision.textId) ?? [{ text: 'I have a house for you.'", 'seam', 'src/scenes/worldModes.js'],
  ['src/scenes/worldModes.js', 'const rows = (id) => townTalk?.lines?.(id) ?? [];', 'plain', { ids: [24, 33] }],
  ['src/scenes/worldModes.js', '(townTalk?.lines?.(greet.textId) ?? [])', 'plain', { ids: [266, 267, 268, 269, 270] }],
  ['src/scenes/worldModes.js', '_rowsText(townTalk?.lines?.(PRIVATE_PROPERTY_TEXT_ID)', 'plain', { ids: [37] }],
  ['src/scenes/worldModes.js', 'endLines: (id) => townTalk?.lines?.(id) ?? null,', 'seam', 'src/scenes/shared.js'],
  ['src/scenes/worldModes.js', 'textLines: (id) => townTalk?.lines?.(id) ?? null,', 'plain', { ids: [1069] }],
  ['src/scenes/worldModes.js', 'lines: (id) => townTalk?.lines?.(id) ?? [],', 'seam', 'src/systems/healthStatus.js'],
  ['src/scenes/worldModes.js', 'plainLines(townTalk?.lines?.(rb.textId))', 'plain', { ids: REST_BOXES }],
  ['src/scenes/worldModes.js', 'plainLines(townTalk?.lines?.(d.textId))', 'plain', { ids: REST_BOXES }],
  // ── systems ──
  ['src/systems/biography.js', "const firstLine = (id) => textRsc.linesById(id)?.[0]?.text ?? '';", 'seam', 'src/systems/biography.js'],
  ['src/systems/biography.js', 'const rows = textRsc.linesById(backstoryId)', 'walk'],
  ['src/systems/classQuestions.js', 'textRsc.plainText(CLASS_QUESTIONS_TEXT_ID)', 'plain', { ids: [9000] }],
  ['src/systems/itemPowers.js', 'lines?.(ARTIFACT_POWERS_TEXT_BASE', 'plain', { ids: range(8700, 8724) }],
  // ── ui ──
  ['src/ui/bankWindow.js', '(this.hooks.rows?.(result) ?? [])', 'walk'],
  ['src/ui/chargenArt.js', 'linesById(CLASS_DESCRIPTION_TEXT_ID + classIndex)', 'plain', { ids: CLASSES }],
  ['src/ui/chargenArt.js', 'const rows = _art?.textRsc?.linesById(id) ?? [];', 'plain', { ids: CHARGEN_TEXT }],
  ['src/ui/chargenArt.js', 'return t.linesById(race.descriptionId);', 'plain', { ids: RACES }],
  ['src/ui/chargenArt.js', 'linesById(REFLEX_INFO_TEXT_ID)', 'plain', { ids: [307] }],
  // record 35's %r1..%r5 are the reputation-change macros the chargen summary fills itself (chargenArt's repChangeStr)
  ['src/ui/chargenArt.js', 'return textRsc.linesById(35).map(', 'plain', { dfu: 'CreateCharSummary: %r1..%r5 replaced by the window, not MacroHelper' }],
  ['src/ui/chargenArt.js', 'linesById(SUMMARY_BONUS_TEXT_ID)', 'plain', { ids: [14] }],
  ['src/ui/charsheet.js', 'rows?.(NO_AFFILIATIONS_TEXT_ID)', 'plain', { ids: [19] }],
  ['src/ui/charsheet.js', 'statDescriptionRows(this.hooks.rows?.(', 'walk'],
  ['src/ui/enhancedChargen.js', 'f.describeRace = ', 'plain', { ids: RACES }],
  ['src/ui/enhancedChargen.js', 'f.describeClass = ', 'plain', { ids: CLASSES }],
  ['src/ui/enhancedChargen.js', 'f.describeText = ', 'plain', { ids: CHARGEN_TEXT }],
  ['src/ui/enhancedChargen.js', 'f.bonusPointsRows = ', 'plain', { ids: [14] }],
  ['src/ui/enhancedTrade.js', 'return (deps.rows?.(id) ?? []).map(', 'walk'],
  ['src/ui/messageBox.js', 'box.rows ??= rows?.(box.textId) ?? [];', 'seam', 'src/scenes/worldModes.js'],
  ['src/ui/nativeInventory.js', 'rows: expandRowValues(this.hooks.rows?.(ITEM_BROKEN_TEXT_ID)', 'walk'],
  ['src/ui/nativeInventory.js', 'rows: this.hooks.rows?.(FORBIDDEN_EQUIPMENT_TEXT_ID)', 'plain', { ids: [1068] }],
  ['src/ui/nativeInventory.js', 'lines: expandRowValues(this.hooks.rows?.(GOLD_TO_DROP_TEXT_ID)', 'walk'],
  ['src/ui/nativeTrade.js', 'return (this.hooks.rows?.(id) ?? []).map(', 'walk'],
  // DaggerfallEffectSettingsEditorWindow puts SpellMakerDescription on a label with SetText (:262-268) - no MacroHelper pass
  ['src/ui/spellMakerWindow.js', 'return this.deps.rows?.(id) ?? [];', 'plain', { ids: [...SPELLBOOK_DESCRIPTION_IDS.keys()].map(spellMakerDescriptionId) }],
  ['src/ui/spellMakerWindow.js', 'const live = this.rows?.(id);', 'plain', { ids: [1702, 1703, 1704, 1705, 1707, 1708] }],
  ['src/ui/spellbookWindow.js', 'sourceValues(effectMacroSource(e))', 'walk'],
  ['src/ui/spellbookWindow.js', 'const raw = this.deps.rows?.(id) ?? [];', 'walk'],
];

/** A needle claims a site when it sits in the line at an IDENTIFIER
 *  BOUNDARY - `lines: (id) =>` must not claim `endLines: (id) =>` - or,
 *  ending in a newline, when it IS the whole line. */
const atBoundary = (hay, needle) => {
  for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + 1)) {
    if (i === 0 || !/[\w$]/.test(hay[i - 1])) return true;
  }
  return false;
};
const siteOf = (sites, [file, needle]) => sites.filter((s) => s.file === file
  && (needle.endsWith('\n') ? s.code === needle.slice(0, -1).trim() : atBoundary(s.lines[s.line - 1], needle)));

test('MACRO-7: every TEXT.RSC read site in src/ carries a verdict, and no verdict outlives its site', () => {
  const sites = census();
  const claimed = new Map();
  for (const entry of SITES) {
    const hit = siteOf(sites, entry);
    assert.ok(hit.length, `stale verdict - no read site in ${entry[0]} matches ${JSON.stringify(entry[1])}`);
    for (const s of hit) {
      const key = `${s.file}:${s.line}`;
      assert.ok(!claimed.has(key), `${key} is claimed by two verdicts: ${JSON.stringify(claimed.get(key))} and ${JSON.stringify(entry[1])}`);
      claimed.set(key, entry[1]);
      assert.equal(s.reads, 1, `${key} reads ${s.reads} records on one line - split it so each read has its own verdict`);
    }
  }
  const unclassified = sites.filter((s) => !claimed.has(`${s.file}:${s.line}`)).map((s) => `${s.file}:${s.line}  ${s.code}`);
  assert.deepEqual(unclassified, [],
    'a new TEXT.RSC read with no verdict - walk it (expandRowValues and the rest), hand it to a consumer that does, '
    + 'or show its records carry no token, and say which in test/macro7_gate.test.js');
});

test('MACRO-7: a WALK verdict has the walk in its statement, and a SEAM’s consumer walks', () => {
  const sites = census();
  for (const entry of SITES) {
    const [file, , verdict, detail] = entry;
    if (verdict === 'walk') {
      for (const s of siteOf(sites, entry)) {
        const near = s.lines.slice(Math.max(0, s.line - 5), s.line + 4).join('\n');
        assert.match(near, WALKS, `${file}:${s.line} is marked walk but no walk sits beside it`);
      }
    } else if (verdict === 'seam') {
      assert.match(read(detail), WALKS, `${file}: the consumer ${detail} does not walk what it is handed`);
    }
  }
});

// ── the DFU side: the plain verdicts and the token ledger ──────────
const RSC_EN = 'Assets/Localization/StringTables/Internal_RSC_en.asset';
const RSC_SHARED = 'Assets/Localization/StringTables/Internal_RSC Shared Data.asset';

/** record id -> text, off DFU's own string table (m_Key is the record
 *  id, m_Id the entry; the text is YAML-quoted and may wrap). */
function rscRecords() {
  const keys = new Map();
  for (const m of readFileSync(dfuFile(RSC_SHARED), 'utf8').matchAll(/m_Id: (\d+)\s*\n\s*m_Key: (\d+)/g)) keys.set(m[1], Number(m[2]));
  const out = new Map();
  const en = readFileSync(dfuFile(RSC_EN), 'utf8');
  const entries = [...en.matchAll(/- m_Id: (\d+)\s*\n\s*m_Localized: /g)];
  entries.forEach((m, i) => {
    const end = i + 1 < entries.length ? entries[i + 1].index : en.length;
    const id = keys.get(m[1]);
    if (id != null) out.set(id, en.slice(m.index + m[0].length, end));
  });
  return out;
}

test('MACRO-7: every PLAIN verdict’s records carry no token - checked against DFU’s TEXT.RSC', (t) => {
  if (missingDfu(RSC_EN, RSC_SHARED)) { t.skip('no DFU checkout (see test/dfuRoot.mjs)'); return; }
  const records = rscRecords();
  assert.ok(records.size > 1000, 'the table parsed');
  for (const [file, needle, verdict, detail] of SITES) {
    if (verdict !== 'plain' || !detail.ids) continue;
    for (const id of detail.ids) {
      const text = records.get(id);
      if (text == null) continue;   // a record DFU does not carry is never shown
      assert.doesNotMatch(text, /%\w+/, `${file} (${needle.trim()}) draws record ${id} raw, and it carries ${text.match(/%\w+/)?.[0]}`);
    }
  }
});

/** Tokens TEXT.RSC carries that the ONE table has no row for (or C#'s
 *  null row) - each one's consumer, so none is a silent leak. */
const TOKEN_LEDGER = {
  '%tcn': 'the travel window: DaggerfallTravelMapWindow Replace("%tcn") on record 31 (ui/travelMapWindow.js)',
  '%dbp': '5292, the Dark Brotherhood codeword - no MacroHelper row in DFU either',
  '%dts': '3503-3509, classic summoning records DFU never shows (it speaks 480-484)',
  '%dfs': '3509, the same unshown summoning set',
  '%dn': '8204-8214, name-generator stems DFU does not read',
  '%on': '8201-8213, the same name-generator stems',
  '%vn': '8200-8208, the same name-generator stems',
  '%1hn': '853, book-title stems DFU does not read',
  '%2hn': '852, book-title stems DFU does not read',
  '%3hn': '852, book-title stems DFU does not read',
  '%hol': '1411, a rumor set DFU does not draw from',
  '%hrg': '1073, the house deed - C# null row, and DFU names the deed off the item instead',
  '%htwn': '1073, the house deed (as %hrg)',
  '%key2': '7224, the classic two-subject question DFU never asks',
  '%mit': '1002, classic misc-item info - DFU builds that box from its own ItemHelper',
  '%wpn': '1005/1006, the poisoned-weapon line - C# null row',
  '%pdg': '8052, a court box DFU never shows',
  '%prn': '8060, the execution sentence - unreachable in DFU and here (court.js F7)',
  '%plq': '2500, the classic notebook line - DFU writes notes its own way',
  '%pnq': '2500, as %plq',
  '%qot': '2500, as %plq',
  '%ptm': '1476, a rumor set DFU does not draw from',
};

test('MACRO-7: every token in DFU’s TEXT.RSC has a table row or a named consumer', (t) => {
  if (missingDfu(RSC_EN)) { t.skip('no DFU checkout (see test/dfuRoot.mjs)'); return; }
  // column-zero %YAML/%TAG are the file's own directives, not text
  const text = readFileSync(dfuFile(RSC_EN), 'utf8').replace(/^%\w+.*$/gm, '');
  const tokens = new Set(text.match(/%\w+/g));
  const { handled } = macroTableCoverage();
  const rowless = [...tokens].filter((tok) => !handled.includes(tok)).sort();
  assert.deepEqual(rowless, Object.keys(TOKEN_LEDGER).sort(),
    'a token with no row and no consumer - give it a source, or record who answers it and why');
  assert.match(read('src/ui/travelMapWindow.js'), /%tcn/, '%tcn’s consumer still does its Replace');
});

test('MACRO-7: the gate’s own net - the census finds the read shapes it claims to', () => {
  assert.ok(existsSync(new URL('src/scenes/townTalk.js', ROOT)));
  const sites = census();
  assert.ok(sites.length >= 90, `the census found ${sites.length} read sites`);
  for (const shape of ['townTalk.lines(', '.linesById(', '.variantLinesById(', 'rows?.(', 'plainLines(']) {
    assert.ok(sites.some((s) => s.code.includes(shape)), `the census reads ${shape}`);
  }
});
