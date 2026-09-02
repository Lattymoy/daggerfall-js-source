// FS1 - THE STALE-FLAG SWEEP (2026-08-29).
//
// Six times in one run a flag's blocker shipped and the sentence
// stayed: EF1b, EF1c, CQ1b, TP1, RP1, and now four at once in
// world.js. CQ1b's answer was a per-slice second-home pin, which
// catches the claim a slice is ABOUT. It cannot catch a claim no
// slice is looking at - and that is the whole population here.
//
// So FS1 adds the one form of staleness that is MECHANICALLY
// decidable. A flag that says "FLAGGED in <file>.js" is not making a
// judgement call; it is DELEGATING, and the delegation is checkable:
// the named file must carry a flag. world.js sent the reader to a
// flag in systems/healthStatus.js that ST1 had shipped away, and
// world.js:1373 sent them to one in dungeonContext.js that had never
// been written at all - which is the worse of the two, because the
// work is real and the ledger could not see it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

function walk(dir, out = []) {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (name.endsWith('.js')) out.push(rel);
  }
  return out;
}
const SRC = walk('src').sort();
const TEXT = new Map(SRC.map((f) => [f, read(f)]));
/** The tool's own marker test (tools/regenOpenFlags.mjs), per file. */
const carriesFlag = (f) => /FLAGGED|INTERIM/.test(TEXT.get(f) ?? '');

/** Every "FLAGGED in <file>.js" site in one file's lines, with the
 *  wrapped path resolved. Comments wrap, so the path routinely lands a
 *  line or two below the words, and a single-line regex reads the tree
 *  as almost empty. */
function scan(lines) {
  const out = [];
  lines.forEach((l, i) => {
    if (!/FLAGGED in\b/.test(l)) return;
    const win = lines.slice(i, i + 3).map((x) => x.replace(/^\s*(\/\/|\*)\s?/, '')).join(' ');
    const m = /FLAGGED in\s+[\w/.-]*?([A-Za-z0-9_]+\.js)/.exec(win);
    if (m) out.push({ line: i + 1, target: m[1] });
  });
  return out;
}
function delegations() {
  return SRC.flatMap((f) => scan(TEXT.get(f).split('\n')).map((d) => ({ from: f, ...d })));
}

test('FS1: a flag that delegates to another FILE must find a flag in that file', () => {
  // Only the "FLAGGED in <path>" form is pinned. "FLAGGED with the
  // palace blocks" delegates to an ARC, which is the board's to hold,
  // not a file's - and a guard that guessed at those would be
  // measuring prose. The narrow law is the one that can be true.
  const names = new Map();
  for (const f of SRC) names.set(basename(f), f);
  const dangling = [];
  for (const { from, line, target } of delegations()) {
    const resolved = names.get(target);
    if (!resolved) { dangling.push(`${from}:${line} -> ${target} (no such file in src/)`); continue; }
    if (!carriesFlag(resolved)) dangling.push(`${from}:${line} -> ${target} carries no flag`);
  }
  assert.deepEqual(dangling, [], 'every "FLAGGED in <file>" points at a file that really is flagged');
});

test('FS1: the extractor really reads the form, on a fixture', () => {
  // A guard over an empty population is a green light that means
  // nothing - PY1's lesson in a different shape - and this test used
  // to answer that by requiring the TREE to carry a delegation. CR-35
  // already showed why the tree is the wrong place to hold it: the
  // requirement was pinned to dungeonContext's restWindow
  // delegation, so a sentence B5 had retired could not be deleted
  // without failing this file, and a guard that PUNISHES retirement
  // is pointed backwards. The CLOSEOUT retired the last one -
  // regionConditions.js sent the reader to a banishment flag in
  // court.js, and the arrest arc had shipped both halves of it - so
  // the population is now zero and the pin goes where CR-35 said it
  // belongs: the extractor's reach is a property of the EXTRACTOR,
  // measured on a fixture, and the sweep above stays armed for the
  // next delegation anyone writes.
  assert.deepEqual(scan(["// ... a thing is FLAGGED in", "// ui/restWindow.js' header."]),
    [{ line: 1, target: 'restWindow.js' }],
    'the path that lands a line below the words is still resolved');
  // the single-line form, which the wrapped one must not have cost us
  assert.deepEqual(scan(['// the timer is FLAGGED in systems/guildServiceActions.js']),
    [{ line: 1, target: 'guildServiceActions.js' }]);
  // and a delegation the tree does carry would still be caught: a
  // dangling target fails the sweep above, which is the whole law.
  assert.deepEqual(scan(['// FLAGGED in nosuchmodule.js']), [{ line: 1, target: 'nosuchmodule.js' }]);
});

test('FS1: the record-22 delegation is retired, and ST1 really did ship it', () => {
  assert.equal(/FLAGGED in systems\/healthStatus\.js/.test(read('src/scenes/world.js')), false);
  // the claim was that the record-22 text pends macro producers. It
  // does not: statusInfoRows lives in that file and world.js calls it
  // with the macro context the bridge hands down.
  assert.match(read('src/systems/healthStatus.js'), /export function statusInfoRows\(/);
  assert.match(read('src/scenes/world.js'), /new ActionTextBox\(statusInfoRows\(rows, questBridge\?\.machine\?\.macroContext\?\.\(\) \?\? null\)\)/);
});

test('FS1: the F5/F6 arc is retired, and U43 really did route the table indoors', () => {
  const world = read('src/scenes/world.js');
  assert.equal(/Routing F5\/F6 into interiors is its own arc/.test(world), false);
  // U43's interior arm: the SAME ui/input.js table, over an interior
  // ctx that carries the doors those keys open.
  const modes = read('src/scenes/worldModes.js');
  assert.match(modes, /if \(mode === 'interior'\) \{\n\s*if \(routeKey\(e, interiorKeyCtx\)\) e\.preventDefault\(\);/);
  assert.match(modes, /toggleCharSheet\(\) \{ mountInterior\(host\.makeCharSheet\?\.\(\)\); \}/);
  for (const arm of ['CharacterSheet', 'Inventory', 'LogBook', 'NoteBook']) {
    assert.ok(read('src/ui/input.js').includes(`case '${arm}':`), `${arm} is in the one table`);
  }
});

test('FS1: the melee/arrow clauses are retired, and the tree contradicts them', () => {
  const world = read('src/scenes/world.js');
  assert.equal(/melee strike frames resolve to nothing/.test(world), false);
  assert.equal(/targets pend the RMB animal\/exterior-foe arc/.test(world), false);
  // a swing resolves against three pools, in this order
  const at = world.indexOf('const guardHitSound = (g) =>');
  const body = world.slice(at, at + 1400);
  const order = ['cityGuards.resolvePlayerHit(', 'exteriorFoes.resolvePlayerHit(', 'cityGuards.resolveCivilianHit('];
  let cursor = -1;
  for (const call of order) {
    const next = body.indexOf(call);
    assert.ok(next > cursor, `${call} resolves, and after the one before it`);
    cursor = next;
  }
  // and the arrow carries both live pools as targets
  assert.match(world, /foeTargets: \[\.\.\.exteriorFoes\.foes, \.\.\.cityGuards\.guards\]/);
  // the one clause that survived is the one that is still true
  assert.match(world, /open world still has no ACTION OBJECTS in melee reach/);
});

test('FS1: the enchant ctx has its flag in the file that owes the mount', () => {
  const dc = read('src/scenes/dungeonContext.js');
  assert.match(dc, /FLAGGED \(THE FOUR HOSTS RULE\): THE ENCHANT CTX IS NOT\n\s*\/\/ MOUNTED HERE/);
  // the claim is load-bearing and checkable: ONE caller, in world.js
  const callers = SRC.filter((f) => f !== 'src/systems/enchantments.js'
    && /setDefaultEnchantCtx\(\{/.test(TEXT.get(f)));
  assert.deepEqual(callers, ['src/scenes/world.js'],
    'the flag says setDefaultEnchantCtx has exactly one caller; a second host mounting it retires the flag');
  // and world.js no longer claims the flag lives somewhere it did not
  assert.equal(/FLAGGED\n\s*\/\/ there with the rest of its enchant wiring/.test(read('src/scenes/world.js')), false);
});

test('FS1: none of the retired claims has a second home', () => {
  // CQ1b's per-slice check, with EF1c's unquote rule so a correction
  // may quote what it retired.
  const RETIRED = [
    /FLAGGED in systems\/healthStatus\.js \(macro producers pend\)/,
    /Routing F5\/F6 into interiors is its own arc/,
    /so melee strike frames resolve to nothing/,
    /C13 - targets pend the RMB animal\/exterior-foe arc/,
    // CR-35: B5 retired restWindow's toggle-binding flag and BUILT the
    // facility, but two files still sent the reader to that flag - and
    // FS1's own delegation test could not see it, because restWindow
    // carries three unrelated flags and carriesFlag is whole-file.
    /toggle-close binding is FLAGGED in/,
    /the reason restWindow's own header flags its toggle-close/,
  ];
  const offenders = [];
  for (const f of SRC) {
    const bare = TEXT.get(f).replace(/"[^"]*"/g, '""');
    for (const claim of RETIRED) if (claim.test(bare)) offenders.push(`${f}: ${claim}`);
  }
  assert.deepEqual(offenders, [], 'a retired sentence survives nowhere in src/ as an assertion');
});
