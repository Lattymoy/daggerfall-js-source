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
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseModuleWithComments, findHostFunction, codeLines } from '../../tools/hostScope.mjs';

const ROOT = join(fileURLToPath(new URL('..', import.meta.url)), '..');
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
  ['src/scenes/world.js', 'bootWorld', 21_186, MODULE],   // HOST-SPLIT 2: buildPixelNow out (21,675 -> 20,936 code lines, main at 5d48ff13, whose own ceiling stood a line over its length); at the sixth merge of main into PR #800 (2026-10-16) the merged host stood at 21,162 and at the seventh (2026-10-17, GRAVE-PARTY's activateGrave out) at 21,124 - the Elite Breach's wiring (226 lines) under this ceiling, nothing raised, its cut into a module the host wires still owed (Elite-Gates.md section 31)
  ['src/scenes/worldModes.js', 'createWorldModes', 7_159, MODULE],   // HOST-SPLIT (EG-LOOK, 2026-10-15): the Spire's circle out to scenes/eliteGates/egCircleHost.js (7,263 -> 7,131 code lines on the arc's branch); at the fifth and sixth merges of main into PR #800 (2026-10-16) the merged host stood at 7,145, at the seventh (2026-10-17) 7,150, under main's own 7,159 - the arc's circle cut paid, nothing raised
  ['src/scenes/dungeonContext.js', 'buildDungeonContext', 5_446, MODULE],
  ['src/scenes/exterior.js', 'bootExterior', 3_446, MODULE],
  ['src/scenes/naval/navalHost.js', 'createNavalHost', 3_942, MODULE],   // HOST-SPLIT NAVAL: a *Host.js grown into a knot of its own (3,692 code lines)
  ['src/systems/comeSailAway/comeSailAway.js', 'createComeSailAwayRuntime', 2_315, MODULE],   // AUDIT HOST-SPLIT NAVAL: the Come Sail Away runtime, one scope of 2,065 code lines
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
    assert.ok(host, `${file} has no function ${fn} - renamed or taken apart: move or remove its ceiling in test/scenes/hostceiling.test.js`);
    sizes.set(key, codeLines(src, host.fn, comments));
  }
  return sizes.get(key);
};

test('HOST-SPLIT THE HOSTS DO NOT GROW: bootWorld, createWorldModes, buildDungeonContext, bootExterior, navalHost\'s createNavalHost, Come Sail Away\'s createComeSailAwayRuntime and the relay\'s _message each stay under their ceiling in code lines - new behaviour goes into a module the host wires (a Room method, on the relay), not into the host\'s own scope; on a pull request and on a contributor\'s machine, never on a deploy (mutants: a ceiling under its host; comments counted)', { skip: SKIP }, () => {
  const over = [];
  for (const [file, fn, ceiling, instead] of CEILINGS) {
    const n = measure(file, fn);
    if (n > ceiling) over.push(`${file} ${fn}: ${n} code lines, over its ceiling ${ceiling} by ${n - ceiling}. Put the new code in ${instead} (bible/01-Overview/Host-Split.md, THE HOSTS DO NOT GROW) - or, for a fix that cannot live elsewhere, raise its ceiling in test/scenes/hostceiling.test.js with the reason beside it`);
  }
  assert.deepEqual(over, []);
});

test('HOST-SPLIT A CEILING COMES DOWN WITH ITS HOST: no ceiling stands more than twice ROOM over its host - a slice that moves code out lowers the ceiling in the same change, or the room it freed becomes room to grow back into (mutants: a ceiling left high)', { skip: SKIP }, () => {
  const slack = [];
  for (const [file, fn, ceiling] of CEILINGS) {
    const n = measure(file, fn);
    if (ceiling - n > 2 * ROOM) slack.push(`${file} ${fn}: ${n} code lines under a ceiling of ${ceiling} - lower it to ${n + ROOM} in test/scenes/hostceiling.test.js`);
  }
  assert.deepEqual(slack, []);
});

/** A function this long is a knot of its own, whatever wires it (HOST-SPLIT NAVAL). */
const KNOT = 2_000;

/** Every source file under a folder. */
const sources = (dir) => readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? sources(`${dir}/${e.name}`) : /\.m?js$/.test(e.name) ? [`${dir}/${e.name}`] : [])).sort();

/** A module's OUTERMOST functions past `raw` lines, in any shape - a declaration, an arrow, a method, async or not -
 *  named as tools/hostScope.mjs names them. (A function inside another is the outer one's: its host's ceiling holds it.) */
const outermost = (ast, raw) => {
  const out = [];
  const isFn = (n) => /^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(n.type) && n.body?.type === 'BlockStatement';
  const visit = (n, name) => {
    if (!n || typeof n.type !== 'string') return;
    if (isFn(n)) { if (n.loc.end.line - n.loc.start.line + 1 > raw) out.push({ fn: n, name: n.id?.name ?? name }); return; }
    const nm = n.type === 'VariableDeclarator' ? n.id?.name
      : (n.type === 'MethodDefinition' || n.type === 'Property' || n.type === 'PropertyDefinition') && !n.computed ? n.key?.name : undefined;
    for (const k of Object.keys(n)) {
      if (k === 'loc') continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach((c) => visit(c, nm)); else if (v && typeof v.type === 'string') visit(v, nm);
    }
  };
  visit(ast);
  return out;
};

test('HOST-SPLIT NAVAL A MODULE THAT BECOMES A HOST GETS A CEILING: every function in src/ and the relay\'s server/src/ past KNOT code lines - a module the host wires that grew into one scope of its own, as navalHost\'s createNavalHost did unnoticed to 4,865 lines and Come Sail Away\'s runtime to 2,065 code lines - stands in CEILINGS; found by walking src/ and reading every outermost function, whatever its name or shape, not by a list (mutants: the naval ceiling dropped; the sail runtime\'s ceiling dropped; the knot never reached; the walk by the first create* export alone; the walk by declarations alone)', { skip: SKIP }, () => {
  // AUDIT HOST-SPLIT NAVAL, the second read: every shape the walk claims to read, read - the held knots are all
  // declarations, so a walk narrowed to declarations passed on them; a fixture of each shape holds the rest
  const shapes = 'function decl() {\n\n}\nasync function* gen() {\n\n}\nexport const arrow = async () => {\n\n};\nconst expr = function () {\n\n};\n'
    + 'class C {\n  method() {\n\n  }\n  field = () => {\n\n  };\n  #hidden() {\n\n  }\n}\nexport const o = {\n  objMethod() {\n\n  },\n  prop: function () {\n\n  },\n};\n'
    + 'export default function named() {\n\n}\n';
  assert.deepEqual(outermost(parseModuleWithComments(shapes).ast, 2).map((x) => x.name), ['decl', 'gen', 'arrow', 'expr', 'method', 'field', 'hidden', 'objMethod', 'prop', 'named'], 'the walk reads every shape a function takes');
  const held = new Set(CEILINGS.map(([file, fn]) => `${file}#${fn}`));
  const loose = [], knots = [];
  const files = [...sources('src'), ...sources('server/src')];   // the relay's Room too (AUDIT HOST-SPLIT NAVAL, the second read)
  for (const file of files) {
    const src = readFileSync(join(ROOT, file), 'utf8');
    if (src.split('\n').length <= KNOT) continue;   // shorter than the line: no function in it can reach it
    const { ast, comments } = parseModuleWithComments(src);
    for (const { fn, name } of outermost(ast, KNOT)) {
      const n = codeLines(src, fn, comments);
      if (n <= KNOT) continue;
      knots.push(`${file}#${name}`);
      if (!name) loose.push(`${file}: an unnamed function at line ${fn.loc.start.line}, ${n} code lines - name it (a declaration or a const) and give it a ceiling in CEILINGS`);
      else if (!held.has(`${file}#${name}`)) loose.push(`${file} ${name}: ${n} code lines and no ceiling - add ['${file}', '${name}', ${n + ROOM}, MODULE] to CEILINGS in test/scenes/hostceiling.test.js`);
    }
  }
  assert.ok(files.length >= 1000, `only ${files.length} source files under src/ - the walk is reading the wrong tree`);
  assert.ok(files.includes('server/src/index.js'), 'the walk reads the relay, whose Room is the next knot\'s home');
  // and the line reaches a function in the tree: a KNOT so high it reached none would hold nothing (when the last knot
  // is taken apart, this is the assertion to drop - say so in the change that does it)
  assert.ok(knots.length > 0, `KNOT (${KNOT}) reaches no function in src/ - drop this assertion if the last knot was taken apart`);
  // and the walk sees every knot the ceilings already hold, whatever its shape (an async declaration, a const arrow) -
  // a walk that read only one shape would pass on the knots it never met
  const unseen = CEILINGS.filter(([file, fn]) => (file.startsWith('src/') || file.startsWith('server/src/')) && measure(file, fn) > KNOT && !knots.includes(`${file}#${fn}`)).map(([file, fn]) => `${file}#${fn}`);
  assert.deepEqual(unseen, [], 'a held knot the walk did not reach');
  assert.deepEqual(loose, []);
});
