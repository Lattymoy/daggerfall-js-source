// HOST-SPLIT (2026-10-15, bible/01-Overview/Host-Split.md) - THE HOSTS DO NOT GROW.
//
// Each host keeps its whole state in ONE function's scope, and that scope grew
// faster than anyone could take it apart: world.js went from 8,897 lines to
// 36,374 in the month to 2026-10-14, nearly all of it bootWorld. Moving code out
// of a scope that grows ~850 lines a day is a race that cannot be won, so the
// hosts get ceilings: new behaviour goes into a module the host wires (fishHost.js,
// merchantYardsHost.js - a module that owns its state, constructed once), and the
// host's own function does not lengthen. Measured with tools/hostScope.mjs's own
// finder, so the ceiling and the map read the same function.
//
// AUDIT HOST-SPLIT 0 (2026-10-15), two laws of the ceiling's own:
// - IT COUNTS CODE. A line of comment is no weight - a third of bootWorld is the
//   bible's own explanation, and a ceiling on raw lines made deleting it the
//   cheapest way to make room.
// - IT GATES A CHANGE, NEVER A DEPLOY. Every open pull request is measured
//   against the base it last saw, so two that each fit can land together and
//   overflow; on the push that deploys them that is no reason to hold the
//   deploy (deploy.yml and relay-deploy.yml run the suite). The ceiling holds
//   on a pull request (GITHUB_EVENT_NAME pull_request*) and on a contributor's
//   own machine (no GITHUB_EVENT_NAME) - an overflow on main is the next pull
//   request's to fix, by moving code out or by a raise with its reason.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseModuleWithComments, findHostFunction, codeLines } from '../tools/hostScope.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const EVENT = process.env.GITHUB_EVENT_NAME;
const GATED = !EVENT || EVENT.startsWith('pull_request');
const SKIP = GATED ? false : `the ceiling gates a change, never a deploy (${EVENT})`;

/** The room a ceiling leaves above its host, in code lines - a fix's worth, not a feature's. */
const ROOM = 250;
/** Where new code goes instead, by the host's shape. */
const MODULE = 'a module the host wires (src/scenes/fishHost.js is the shape)';
const METHOD = 'a Room method of its own (the SCALE5 arms\' shape)';
/** Each host's one-scope function and its ceiling in code lines: its length when measured (2026-10-15, main at
 *  HOST-SPLIT 0's last merge), plus ROOM. A slice that moves code OUT lowers its ceiling in the same change (the
 *  second test makes it). Raise one only with the reason written beside it: the ceiling is the line between wiring a
 *  module in and growing the knot. */
const CEILINGS = [
  ['src/scenes/world.js', 'bootWorld', 21_676, MODULE],   // HOST-SPLIT 1: travelViewMarks out (21,589 -> 21,445 code lines). LOWERED 21,679 -> 21,676 at INSTANCES (2026-10-15): its ten wiring lines in (the door constructed once - scenes/instanceDoor.js holds the feature - the room key's `instance`, the party pose's `ins`), homeYardWallet out (scenes/homeYards.js, nine lines that read only the player) and the door's deps on two lines - the ceiling where it now stands, no room. LOWERED 21,741 -> 21,679 at FIELD BUGS 2026-10-15c's merge of main (2026-10-15): PVP-ESCROW's handoff out of bootWorld (scenes/wildEscrowHost.js; 21,750 -> 21,688 code lines on its branch, 21,695 its ceiling there) on top of main's own lowering below - the ceiling where it now stands, no room. LOWERED 21,750 -> 21,741 at AUDIT WORLD-REWARDS's merge of main (2026-10-15): SERPENT5's one wiring line in, glassPadWords out (scenes/glassPad.js, ten lines that read nothing of the host's) - the ceiling where it now stands, no room. RAISED 21,695 -> 21,750 at FB1015's merge of main (2026-10-15): main itself stood at 21,750 - ten field-bug merges that each fit landed together (the header's own case) - and FB1015 adds no line to bootWorld; raised by the overflow alone, no room, so the next pull request that grows it moves code out
  ['src/scenes/worldModes.js', 'createWorldModes', 7_159, MODULE],
  ['src/scenes/dungeonContext.js', 'buildDungeonContext', 5_446, MODULE],
  ['src/scenes/exterior.js', 'bootExterior', 3_446, MODULE],
  ['server/src/index.js', '_message', 1_093, METHOD],   // the relay's Room is 473 methods already - its knot is the one dispatcher
];

const sizes = new Map();
/** A host function's code lines (each file parsed once for both tests). */
const measure = (file, fn) => {
  const key = `${file}#${fn}`;
  if (!sizes.has(key)) {
    const src = readFileSync(join(ROOT, file), 'utf8');
    const { ast, comments } = parseModuleWithComments(src);
    const host = findHostFunction(ast, fn);
    assert.ok(host, `${file} has no function ${fn} - renamed or taken apart: move or remove its ceiling in test/hostceiling.test.js`);
    sizes.set(key, codeLines(src, host.fn, comments));
  }
  return sizes.get(key);
};

test('HOST-SPLIT THE HOSTS DO NOT GROW: bootWorld, createWorldModes, buildDungeonContext, bootExterior and the relay\'s _message each stay under their ceiling in code lines - new behaviour goes into a module the host wires (a Room method, on the relay), not into the host\'s own scope; on a pull request and on a contributor\'s machine, never on a deploy (mutants: a ceiling under its host; comments counted)', { skip: SKIP }, () => {
  const over = [];
  for (const [file, fn, ceiling, instead] of CEILINGS) {
    const n = measure(file, fn);
    if (n > ceiling) over.push(`${file} ${fn}: ${n} code lines, over its ceiling ${ceiling} by ${n - ceiling}. Put the new code in ${instead} (bible/01-Overview/Host-Split.md, THE HOSTS DO NOT GROW) - or, for a fix that cannot live elsewhere, raise its ceiling in test/hostceiling.test.js with the reason beside it`);
  }
  assert.deepEqual(over, []);
});

test('HOST-SPLIT A CEILING COMES DOWN WITH ITS HOST: no ceiling stands more than twice ROOM over its host - a slice that moves code out lowers the ceiling in the same change, or the room it freed becomes room to grow back into (mutants: a ceiling left high)', { skip: SKIP }, () => {
  const slack = [];
  for (const [file, fn, ceiling] of CEILINGS) {
    const n = measure(file, fn);
    if (ceiling - n > 2 * ROOM) slack.push(`${file} ${fn}: ${n} code lines under a ceiling of ${ceiling} - lower it to ${n + ROOM} in test/hostceiling.test.js`);
  }
  assert.deepEqual(slack, []);
});
