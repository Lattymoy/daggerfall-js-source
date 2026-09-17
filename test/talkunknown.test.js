// ---------------------------------------------------------------------------
// TALK-UNKNOWN - A DEBUG SENTINEL IN A TAVERN (2026-09-17, Mac, with the
// screenshot: "Listen up. Know anything about work possibilities
// %2com[undefined]?").
//
// `%2com` is CLASSIC's macro, not the port's invention and not DFU's.
// MacroHelper.cs's dictionary carries `%1com` (:44, GreetingOrFollowUpText)
// and has NO row for its sibling - 217 rows, diffed cell for cell against
// the C# by test/macrocoverage.test.js, with `%2com` in neither the
// handled set nor the null one. So GetValue takes its outermost else
// (:526-527) and answers `symbolStr + "[undefined]"`, and TEXT.RSC 7212 -
// the Work question, `%1com ... %key %2com?` - puts that in the player's
// own mouth. Daggerfall Unity, handed the same TEXT.RSC, does the same
// thing: this is not a place the port drifted, and the walk is not what
// gets fixed.
//
// What gets fixed is the ONE step between the expansion and the player.
// E7 moved this walk off the empty string and onto the sentinel
// deliberately, and was right to - with a 26-row table the empty string
// deleted ~190 macros DFU renders for real. But E7's argument ("the table
// is all 217 rows now, so the shape is safe to speak") holds only for
// macros DFU has heard of, and the coverage gate is precisely what makes
// `[undefined]` mean ONLY "classic wrote a macro Daggerfall Unity never
// implemented". A tavern is not a debugger.
//
// So: the walk stays verbatim, all four sentinels included; `speakable`
// drops an `[undefined]` from SPOKEN text and collapses the whitespace
// around it; and the other three sentinels speak, because each of them
// names a context the port could actually be getting wrong.
// ---------------------------------------------------------------------------
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  speakable, unknownTalkMacros, resetUnknownTalkMacros,
  expandRandomTextRecord, expandMessageBoxTokens, expandTalkMacros,
} from '../src/systems/talkMacros.js';
import { macroTableCoverage } from '../src/systems/quest/questMacros.js';

const t = (text) => ({ text, formatting: 1 });

test('TALK-UNKNOWN: the table is DFU’s, and that is what makes [undefined] readable', () => {
  const { handled, nulls } = macroTableCoverage();
  const all = new Set([...handled, ...nulls]);
  assert.equal(all.size, 217, 'MacroHelper.cs’s whole dictionary');
  assert.equal(all.has('%1com'), true, 'the sibling DFU DOES carry (MacroHelper.cs:44)');
  assert.equal(all.has('%2com'), false, 'and the one it does not - so the sentinel can mean nothing else');
});

test('TALK-UNKNOWN: the sentence Mac was shown, and the one he should have been', () => {
  resetUnknownTalkMacros();
  assert.equal(
    speakable('Listen up. Know anything about work possibilities %2com[undefined]?'),
    'Listen up. Know anything about work possibilities?',
    'the macro AND the space before it go - "possibilities ?" would be its own defect');
  assert.deepEqual(unknownTalkMacros(), ['%2com'], 'and the symbol is written down rather than lost');
});

test('TALK-UNKNOWN: the whitespace law, in each of the three places a macro can sit', () => {
  resetUnknownTalkMacros();
  assert.equal(speakable('a %xx[undefined] b'), 'a b', 'between two words, ONE space survives');
  assert.equal(speakable('%xx[undefined] Foo'), 'Foo', 'at the head, nothing is left in front');
  assert.equal(speakable('Foo %xx[undefined]'), 'Foo', 'at the tail, no trailing space');
  assert.equal(speakable('Foo%xx[undefined]bar'), 'Foobar', 'and with no space either side, none is invented');
});

test('TALK-UNKNOWN: the OTHER three sentinels still speak - they name a context, not a missing row', () => {
  resetUnknownTalkMacros();
  for (const s of ['%oth[nullMCP]', '%hol[unhandled]', '%str[srcDataUnknown]']) {
    assert.equal(speakable(`a ${s} b`), `a ${s} b`, `${s} is the port's own diagnosis and must survive`);
  }
  assert.deepEqual(unknownTalkMacros(), [], 'and none of them is logged as an unknown macro');
  // ...and BESIDE an unknown one, which is the case the early-out hides:
  // a record carrying both must lose only the unknown row. (A mutant that
  // widened the sentinel class to `[a-zA-Z]+` survived every line above,
  // because none of them got past `includes('[undefined]')`.)
  assert.equal(speakable('%2com[undefined] and %oth[nullMCP]'), 'and %oth[nullMCP]');
  assert.equal(speakable('%hol[unhandled] then %zz[undefined] then %str[srcDataUnknown]'),
    '%hol[unhandled] then then %str[srcDataUnknown]');
  assert.deepEqual(unknownTalkMacros(), ['%2com', '%zz']);
});

test('TALK-UNKNOWN: the WALK is untouched - ExpandMacros still produces every sentinel verbatim', () => {
  const tokens = [t('a %nosuchmacro b')];
  expandTalkMacros(tokens, { '%n': () => 'x' });
  assert.equal(tokens[0].text, 'a %nosuchmacro[undefined] b',
    'the expansion is C#’s; the departure is the step after it');
});

test('TALK-UNKNOWN: both player-facing doors take the step', () => {
  resetUnknownTalkMacros();
  const ctx = {
    randomTokens: () => [t('Know anything about work %2com?')],
    pipeline: {}, entity: {},
  };
  assert.equal(expandRandomTextRecord(0, ctx), 'Know anything about work?',
    'ExpandRandomTextRecord - the door every talk answer comes through');
  const rows = expandMessageBoxTokens([t('Know anything about work %2com?')], ctx);
  assert.equal(rows[0].text, 'Know anything about work?',
    'and DaggerfallMessageBox’s null-mcp pass, the other door a player reads');
  assert.deepEqual(unknownTalkMacros(), ['%2com']);
});

test('TALK-UNKNOWN: a symbol is warned ONCE, however often it is spoken', () => {
  resetUnknownTalkMacros();
  const warn = console.warn;
  const lines = [];
  console.warn = (l) => lines.push(l);
  try {
    for (let i = 0; i < 5; i++) speakable('x %2com[undefined] y');
    speakable('x %zzz[undefined] y');
  } finally { console.warn = warn; }
  assert.equal(lines.length, 2, 'once per SYMBOL, not once per line of dialogue');
  assert.match(lines[0], /%2com/);
  assert.deepEqual(unknownTalkMacros(), ['%2com', '%zzz']);
});
