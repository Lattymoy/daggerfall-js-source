// AUDIT 58 (f3/input) - THE THREE UNREACHABLE ROWS.
//
// ui/input.js's overlayAction tests the typed-character class FIRST:
//   if (e.key.length === 1 && /[a-zA-Z0-9 '-]/.test(e.key)) return 'char:' + e.key;
// The trailing `-` inside that class is a LITERAL and r/R fall under
// a-zA-Z, so three of the table's ten rows below it - `'-': 'minus'`,
// `r: 'reroll'`, `R: 'reroll'` - could never be returned. '+' and '='
// are outside the class, so 'plus' DID arrive: the pair was asymmetric.
//
// ui/chargen.js worked around the '-' half locally at AUDIT 17k and
// left the root standing, so the OTHER consumer never got it:
// LevelUpScreen (ui/charsheet.js) declares no isChoiceWindow, both
// hosts hand it overlayAction's answer, and it has no click of its own
// - so a level-up point could be spent from the keyboard and never
// taken back, under a screen that prints '+/- assign'. StatsRollout.cs
// :255's down-spinner is the door that was unreachable. The 'reroll'
// half had no workaround at all: only ui/chargenArt.js:1449's mouse
// rect reached this.reroll(), while the screen drew 'R reroll'.
//
// The branches are NOT reordered - the table ahead of the class would
// starve every text field of '-', 'r' and 'R'. The consumers read
// 'char:<c>' beside their action name instead, and the dead rows are
// gone so the next reader is not misled.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { overlayAction, typedChar } from '../src/ui/input.js';
import { LevelUpScreen } from '../src/ui/charsheet.js';
import { ChargenFlow } from '../src/ui/chargen.js';

const src = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), 'utf8');
const STATS = { strength: 40, intelligence: 30, willpower: 35, agility: 45, endurance: 50, personality: 25, speed: 55, luck: 20 };

test('AUDIT 58 (f3/input): overlayAction can never answer "minus" or "reroll" - the table is honest now', () => {
  // Every printable single character, which is every key the branch
  // above the table can claim.
  const answers = new Set();
  for (let c = 0x20; c < 0x7f; c++) {
    const a = overlayAction({ key: String.fromCharCode(c) });
    if (a) answers.add(a);
  }
  assert.ok(!answers.has('minus'), 'no single key produces "minus"');
  assert.ok(!answers.has('reroll'), 'no single key produces "reroll"');
  assert.ok(answers.has('plus'), '"plus" is still reachable - "+" and "=" are outside the character class');
  // the three that fall to the typed-character branch, named
  assert.equal(overlayAction({ key: '-' }), 'char:-');
  assert.equal(overlayAction({ key: 'r' }), 'char:r');
  assert.equal(overlayAction({ key: 'R' }), 'char:R');
  assert.equal(overlayAction({ key: '+' }), 'plus');
  assert.equal(overlayAction({ key: '=' }), 'plus');
  // and the class still owns them for the text fields, which is why
  // the branches were not swapped
  assert.equal(typedChar(overlayAction({ key: '-' })), '-');
  assert.equal(typedChar(overlayAction({ key: 'r' })), 'r');
  // ...and the ROWS are gone from the table itself (read over the
  // returned literal alone - the note above it names them, as a
  // whole-file regex would happily match).
  const inp = src('ui/input.js');
  const fn = inp.slice(inp.indexOf('export function overlayAction(e) {'), inp.indexOf('export function typedChar('));
  const table = fn.slice(fn.indexOf('return ({'));
  assert.doesNotMatch(table, /'-': 'minus'/, 'the dead rows are gone from the table');
  assert.doesNotMatch(table, /reroll/);
  assert.match(fn, /^ {2}if \(e\.key\.length === 1 && \/\[a-zA-Z0-9 '-\]\/\.test\(e\.key\)\) return 'char:' \+ e\.key;$/m,
    'the typed-character branch still runs FIRST');
  assert.ok(fn.indexOf("return 'char:' + e.key;") < fn.indexOf('return ({'), 'and it is genuinely first');
});

test('AUDIT 58 (f3/input): a LevelUpScreen point spent with "+" comes back with "-"', () => {
  const s = new LevelUpScreen({ stats: { ...STATS }, pendingLevel: 2 }, () => 0);
  const pool0 = s.pool, str0 = s.working.strength;
  assert.ok(pool0 > 0, 'the rollout has a pool to spend');
  s.input('plus');
  assert.equal(s.working.strength, str0 + 1);
  assert.equal(s.pool, pool0 - 1);
  // THE KEY THE PLAYER ACTUALLY PRESSES - overlayAction's answer for
  // '-', which is what both hosts hand this screen.
  s.input(overlayAction({ key: '-' }));
  assert.equal(s.working.strength, str0, 'the point is off the stat again');
  assert.equal(s.pool, pool0, 'and back in the pool - StatsRollout.cs:255');
  // the spinner CLICK's own action still works (charsheet.js's rect
  // and its code table both produce the bare name)
  s.input('plus'); s.input('minus');
  assert.equal(s.pool, pool0, 'the bare "minus" arm is not retired - the mouse and the code table produce it');
  // ...and the screen's own promise is the one being kept
  assert.match(src('ui/charsheet.js'), /'\+\/- assign {3}ENTER when pool 0'/);
});

test('AUDIT 58 (f3/input): chargen’s R rerolls from the keyboard, as the screen has always claimed', () => {
  const f = new ChargenFlow([], () => 0);
  f.state = 'stats';
  let rolls = 0;
  f.reroll = () => { rolls++; };
  f.input(overlayAction({ key: 'r' }));
  assert.equal(rolls, 1, "the 'R reroll' hint drawn on the stats screen is true");
  f.input(overlayAction({ key: 'R' }));
  assert.equal(rolls, 2, 'shifted too');
  f.input('reroll');
  assert.equal(rolls, 3, "the bare name stays for chargenArt.js:1449's mouse rect");
  assert.match(src('ui/chargen.js'), /line\('\+\/- assign {3}R reroll {3}ENTER when pool 0', 10, dim\);/);
  assert.match(src('ui/chargen.js'), /else if \(action === 'reroll' \|\| action === 'char:r' \|\| action === 'char:R'\) this\.reroll\(\);/);
  assert.match(src('ui/charsheet.js'), /else if \(action === 'minus' \|\| action === 'char:-'\)/);
});
