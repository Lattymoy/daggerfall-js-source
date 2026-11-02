// AUDIT QUESTLINES VOICE-QL (2026-10-20): THE QUESTLINES' OWN TEXT IN THE GAME'S VOICE - main's bible/10-UI/Voice.md
// (VOICE1, VOICE2) arrived after this branch was cut, and the house brings a branch's text into it at the merge (that
// page's "At the merge onto main"). What the overhaul wrote is held here to the page's rules:
// - rule 8, American spelling, in every sheet's text and named piece (systems/questlines/sheets/*.json), every
//   questline script's messages (systems/questlines/quests/QL*.txt, above QBN: - never a symbol, a macro or an id: an
//   outcome's id `favour`, a `_harbour_` symbol, a `ql.journal.armour` key stay what saves and catalogs hold), and every
//   line's words (qlLines.js). A monster's own name keeps its spelling: the sheet's "sabretooth" (DFU's Sabretooth Tiger,
//   M0B00Y17's `Foe _tiger_ is Sabretooth_tiger`), as the page keeps the monster names;
// - rule 5, no dash aside, in a sheet's text - an objective, a branch, a choice, an outcome. The scripts' messages are
//   speech and letters (the page exempts spoken lines), so their dashes stay;
// - the t() lines the lane mended: the share's two refusals (rule 5), the service's closed door ("are not"), the
//   Features row's promise of gear (true since UI-4/REWARD-6: some quests, not each), the Tutorials page's plain words.
//   The witnessed steps' places (rule 3: never "an endgame place") are held where they are drawn, ql2_journal.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../../qlSources.mjs';
import { SHEET_FAMILIES } from '../../../src/systems/questlines/qlSheets.js';
import { QL_LINES } from '../../../src/systems/questlines/qlLines.js';
import { SHARE_REFUSAL_TEXT, RECEIVER_REFUSAL_TEXT } from '../../../src/systems/quest/questShare.js';
import { REFUSALS } from '../../../src/net/accountClient.js';
import { FEATURES } from '../../../src/systems/features.js';
import { QL_PATCHES, QL_MESSAGE_BASE } from '../../../src/systems/questlines/qlPatches.js';
import { tutorialById } from '../../../src/systems/tutorials.js';

/** A British spelling, as a whole word of text (never inside a `_symbol_`, an `=macro_` or a `%code`). */
const BRITISH = /(?<![_=%A-Za-z0-9])((?:armour|harbour|colour|honour|favour|valour|rumour|labour|neighbour|behaviour|vigour|splendour|odour|clamour|grey|catalogue|travell|jewell|offence|defence|licence|pretence|centre|metre|theatre|sombre|spectre|lustre|sabre|anaesth|libell|marvell|counsell)[a-z]*|(?:realis|recognis|organis|apologis|terroris|specialis|civilis|sympathis|criticis|memoris)(?:e|ed|es|ing|ation)|whilst|amongst|learnt|spelt)(?![_A-Za-z0-9])/gi;
/** The monster names the voice page keeps as their own (Sabretooth Tiger). */
const OWN_NAMES = new Set(['sabretooth']);
const british = (s) => [...String(s).matchAll(BRITISH)].map((m) => m[1]).filter((w) => !OWN_NAMES.has(w.toLowerCase()));

/** Every text a sheet shows the player: an objective's, a branch's, a choice's, an outcome's, a named piece's name. */
function sheetTexts() {
  const out = [];
  const walk = (o, at) => {
    if (Array.isArray(o)) o.forEach((x, i) => walk(x, `${at}[${x?.id ?? i}]`));
    else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) {
      if ((k === 'text' || k === 'name') && typeof v === 'string') out.push([`${at}.${k}`, v]);
      else walk(v, `${at}.${k}`);
    }
  };
  for (const f of SHEET_FAMILIES) for (const s of f.sheets) walk(s, s.quest);
  return out;
}

/** Every message line of the questlines' scripts: above QBN:, never a `--` comment or the `Quest:` id. */
function scriptLines() {
  const dir = join(ROOT, 'src/systems/questlines/quests');
  const out = [];
  for (const name of readdirSync(dir).filter((n) => /^QL.*\.txt$/.test(n)).sort()) {
    const lines = readFileSync(join(dir, name), 'utf8').split('\n');
    const qbn = lines.findIndex((l) => /^\s*QBN:/i.test(l));
    lines.slice(0, qbn).forEach((l, i) => { if (!l.trimStart().startsWith('--') && !l.startsWith('Quest:')) out.push([`${name}:${i + 1}`, l]); });
  }
  return out;
}

/** Every line of the branch patches' own messages (19xx - QL_MESSAGE_BASE and after; DFU's own are DFU's words). */
function patchLines() {
  const out = [];
  for (const [quest, edits] of QL_PATCHES) for (const e of edits) {
    for (const m of String(e.new ?? '').matchAll(/Message:\s+(\d+)\n([\s\S]*?)(?=\n\s*Message:|\nQBN:|$)/g)) {
      if (Number(m[1]) >= QL_MESSAGE_BASE) m[2].split('\n').forEach((l, i) => out.push([`${quest}:${m[1]}.${i + 1}`, l]));
    }
  }
  return out;
}

test('AUDIT QUESTLINES VOICE-QL rule 8: American spelling in the questlines\' own text - every sheet\'s text and named piece, every questline script\'s messages, every branch patch\'s own messages (19xx), every line\'s title, lead, giver and step - and never an id, a symbol or a key moved (mutants: a harbourmaster back in a sheet; Colours back in QLIS03\'s DisplayName; an armourer back as a line\'s giver; the honour back in a patch\'s message)', () => {
  const sheets = sheetTexts();
  assert.ok(sheets.length > 1700, `only ${sheets.length} sheet texts - the walk is reading the wrong tree`);
  const scripts = scriptLines();
  assert.ok(scripts.length > 1000, `only ${scripts.length} script lines`);
  const lines = QL_LINES.flatMap((l) => [[`${l.id}.title`, l.title()], [`${l.id}.lead`, l.lead()], [`${l.id}.giver`, l.giver()], ...l.steps.map((s) => [`${s.quest}.title`, s.title()])]);
  const patches = patchLines();
  assert.ok(patches.length > 200, `only ${patches.length} patch message lines`);   // 97 messages, 256 lines
  const found = [...sheets, ...scripts, ...lines, ...patches].flatMap(([at, s]) => british(s).map((w) => `${at}: ${w}`));
  assert.deepEqual(found, [], 'a British spelling in the questlines\' own text');
  // the words moved, the names under them kept: an outcome's id (saves and `outcome _x_` lines hold it), a script's symbols
  const n0b17 = SHEET_FAMILIES.flatMap((f) => f.sheets).find((s) => s.quest === 'N0B00Y17');
  assert.ok(n0b17.outcomes.some((o) => o.id === 'favour') && n0b17.branches.some((b) => b.id === 'favour'), 'N0B00Y17\'s ids stay');
  const qlis03 = readFileSync(join(ROOT, 'src/systems/questlines/quests/QLIS03.txt'), 'utf8');
  assert.match(qlis03, /^DisplayName: Strike Your Colors$/m);
  assert.equal(QL_LINES.find((l) => l.id === 'introSea').steps[2].title(), 'Strike Your Colors', 'the step\'s title is its DisplayName (ql12_lines)');
  assert.deepEqual(british('the runaway sabretooth'), [], 'a monster\'s own name keeps its spelling');
  assert.deepEqual(british('_harbour_ and =harbour_ and __harbour_'), [], 'a symbol is never a word');
});

test('AUDIT QUESTLINES VOICE-QL rule 5: no dash aside in a sheet\'s text - an objective, a branch, a choice, an outcome says it in a second sentence, or a comma or a colon (mutants: an aside back in a sheet)', () => {
  const asides = sheetTexts().filter(([, s]) => / - |—|–/.test(s)).map(([at, s]) => `${at}: ${s}`);
  assert.deepEqual(asides, [], 'a dash aside in a sheet');
  const all = SHEET_FAMILIES.flatMap((f) => f.sheets);
  const at = (quest, pick) => pick(all.find((s) => s.quest === quest));
  // the package's own example, and one of each kind
  assert.equal(at('B0B60Y12', (s) => s.objectives.find((o) => o.id === 'rest').text), 'Burn the corpse of _nobleman_\'s ancestor in ___dungeon_. Destroy it if it walks.');
  assert.equal(at('QLCH03', (s) => s.branches[0].text), 'The Guild gives a house one Weir Key. Keep it, or let the Order of the Hour seal it away?');
  assert.equal(at('QLCH03', (s) => s.branches[0].choices.find((c) => c.id === 'keep').text), 'Keep it, for a key is meant to be turned');
  assert.equal(at('M0B00Y07', (s) => s.outcomes.find((o) => o.id === 'done').text), 'The animal is dead and the client is safe, for now.');
});

test('AUDIT QUESTLINES VOICE-QL the t() lines: the share\'s refusals in two sentences (the receiver\'s still read after "... but you"), the closed door\'s "are not", the Features row\'s gear promised only of some quests, the Tutorials page\'s plain words (mutants: the share\'s dash back; the receiver\'s; "aren\'t" back; "each one finished offers"; "quest after quest")', () => {
  assert.equal(SHARE_REFUSAL_TEXT.questline, 'A questline is your own road. Its steps cannot be shared.');
  assert.equal(RECEIVER_REFUSAL_TEXT.questline, 'cannot be given a step of a questline. Each player walks their own.', 'a fragment said after "... but you", then a sentence');
  assert.equal(REFUSALS['ql-closed'], 'The questlines\' rewards are not available to you right now.');
  const note = FEATURES.find((f) => f.id === 'questlines').note;
  assert.doesNotMatch(note, /each one finished|each one offers|every quest offers/i, 'not every quest pays gear (AUDIT QUESTLINES UI-4/REWARD-6: the row\'s `gear`)');
  assert.match(note, /^Every quest shows its objectives, some let you choose how they end, some offer a piece of gear fitted to you when done, and /);
  assert.equal(note.split(/\. /).length, 2, 'two sentences, as every Features note (features.test.js FT15)');
  assert.match(note, /Off is the classic journal and its rewards, and online it is always on\.$/, 'the Features rows\' own way of saying Off');
  const page = tutorialById('questlines').body.join(' ');
  assert.doesNotMatch(page, /quest after quest/);
  assert.match(page, /Questlines are longer stories told in several quests, one after another\. The same tab lists them\./);
  for (const s of [SHARE_REFUSAL_TEXT.questline, RECEIVER_REFUSAL_TEXT.questline, REFUSALS['ql-closed'], note, page]) {
    assert.doesNotMatch(s, / - /, `a dash aside: ${s}`);
    assert.deepEqual(british(s), [], s);
  }
});
