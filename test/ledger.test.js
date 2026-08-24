// L2: the Port-Ledger's DERIVABLE figures, gated.
//
// The 2026-08-24 re-sweep found twenty stale rows in section C, and
// FOUR of them were wrong in their NUMBERS rather than their substance:
// "seventeen unbuilt guild service windows" when the real answer was
// two, "thirty unported effects" when it was six, "the only trace of
// banking is a weight constant" against a 419-line module. Prose has no
// way to notice that kind of drift, and it is the kind that most
// misleads - someone reading "seventeen windows to build" plans a very
// different week than someone reading "two".
//
// Every figure below is computable from a module. Stating it once in
// the ledger and pinning it here means the two cannot disagree
// silently: change the code and this fails until the doc is updated,
// and vice versa. That is the same contract manifest.test.js already
// holds over Testing.md's suite count.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPELL_MAKER_EFFECTS } from '../src/systems/spellEffects.js';
import { SERVICE_DESTINATION } from '../src/systems/guildServiceFlow.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LEDGER = readFileSync(join(ROOT, 'bible/01-Overview/Port-Ledger.md'), 'utf8');

/** Read a "- <label>: **N**" bullet out of the gated block. */
function figure(label) {
  const m = LEDGER.match(new RegExp(`- ${label.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}: \\*\\*(\\d+)\\*\\*`));
  assert.ok(m, `Port-Ledger.md is missing the gated figure "${label}"`);
  return Number(m[1]);
}

test('L2 ledger: the gated block exists and names its own test', () => {
  // If the block is renamed or dropped, the figures below stop being
  // gated silently - so the block's own presence is pinned first.
  assert.match(LEDGER, /### Derived figures \(GATED - `test\/ledger\.test\.js`\)/);
  assert.match(LEDGER, /Rows above may quote these figures but must not\s+restate them independently/,
    'the block states the rule that keeps rows from re-introducing drift');
});

test('L2 ledger: the effect catalog figures match the module', () => {
  const total = SPELL_MAKER_EFFECTS.length;
  const inert = SPELL_MAKER_EFFECTS.filter((e) => !e.ported).length;
  assert.equal(figure('SPELL_MAKER_EFFECTS rows'), total,
    `the ledger says ${figure('SPELL_MAKER_EFFECTS rows')} catalog rows, the module has ${total}`);
  assert.equal(figure('\\.\\.\\.of which still inert \\(no runtime arm\\)'), inert,
    `the ledger's inert count and the module's disagree (module: ${inert})`);
  // a sanity floor: the gate is worthless if it pins zero against zero
  assert.ok(total > 50 && inert >= 0 && inert < total, 'the figures are a real subset');
});

test('L2 ledger: the guild service figures match the module', () => {
  const all = Object.entries(SERVICE_DESTINATION);
  const open = all.filter(([, v]) => !v);
  assert.equal(figure('SERVICE_DESTINATION guild services'), all.length);
  assert.equal(figure('\\.\\.\\.of which still unbuilt \\(destination null\\)'), open.length,
    `the ledger's unbuilt count and the module's disagree (module: ${open.length} -> ${open.map(([k]) => k).join(', ')})`);
  assert.ok(all.length >= 20, 'DoGuildService has twenty arms; the map should not shrink');
});

test('L2 ledger: a superseded figure may be QUOTED but never left standing', () => {
  // The drift this gate exists to stop came from rows carrying their
  // own copy of a number that nothing checked. But a re-swept row
  // legitimately QUOTES the old figure while correcting it - "the
  // title said SEVENTEEN until the re-sweep" is history, not a claim.
  //
  // So the rule is per LINE (each table row is one line): a line that
  // mentions a superseded figure must ALSO carry a correction marker,
  // which is what turns a claim into a record. A blunt phrase ban
  // could not tell those apart and flagged the corrections themselves.
  const SUPERSEDED = [
    /SEVENTEEN/,
    /the port expands eleven/,
    /for 22 -/,
    /thirty/i,
  ];
  const MARKERS = /RE-SWEPT|STALE|Original text|re-sweep|~~/;
  const offenders = [];
  for (const line of LEDGER.split('\n')) {
    if (!line.startsWith('|')) continue;
    for (const re of SUPERSEDED) {
      if (re.test(line) && !MARKERS.test(line)) {
        offenders.push(`${String(re)} :: ${line.slice(0, 90)}`);
      }
    }
  }
  assert.deepEqual(offenders, [],
    'a superseded figure is stated without any marker saying it was corrected');
});
