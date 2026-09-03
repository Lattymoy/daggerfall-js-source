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
import { flagLines } from '../tools/flagSites.mjs';   // IN1: the ONE definition of an open-flag site

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
  // ...and the sweep is reading a REAL population, not an empty tree:
  assert.ok(SRC.filter(carriesFlag).length > 10,
    'the tree still carries flags, so the delegation guard has something to resolve against');
});

test('FS1: the record-22 delegation is retired, and ST1 really did ship it', () => {
  assert.equal(/FLAGGED in systems\/healthStatus\.js/.test(read('src/scenes/world.js')), false);
  // the claim was that the record-22 text pends macro producers. It
  // does not: statusInfoRows lives in that file and world.js calls it
  // with the macro context the bridge hands down.
  assert.match(read('src/systems/healthStatus.js'), /export function statusInfoRows\(/);
  assert.match(read('src/scenes/world.js'), /new ActionTextBox\(statusInfoRows\(rows, questBridge\?\.machine\?\.macroContext\?\.\(\) \?\? null\)\)/);
});

// ROAD-F GS2: THE THIRD KIND OF STALENESS - a retirement RECORD that
// answers the grep. FS1 catches a flag that delegates to a file with
// no flag in it; the bible's own Port-Status list carries a third
// case it could only file under "neither, and the list cannot tell":
// a sentence whose WORK IS DONE and which mentions the marker in order
// to say so. tools/flagSites.mjs will not guess at tense (its header
// says why - a wrong count is worse than a known-incomplete one), so
// the fix is Home.md's own law applied to the record: say the same
// thing without the token.
test('ROAD-F GS2: the acrobatics retirement record no longer answers the flag grep', () => {
  const skills = read('src/systems/skills.js');
  // the sentence still says exactly what it said - a placeholder zero,
  // behind a flag that blamed a decode which had already shipped
  assert.match(skills, /the \+10% used to be a hard 0 behind a placeholder flag/);
  assert.match(skills, /blaming a decode that had ALREADY SHIPPED in U20b/);
  assert.match(skills, /CLASS09 \(Acrobat\)/);
  // ...and the work it records really is in the file: D9's nested
  // ImprovedAthleticism term off AcrobatMotor.cs:96-101.
  assert.match(skills, /improvedAthleticism/);
  // ...but the file is no longer an OPEN-FLAG SITE, so bible/Home.md's
  // list stops carrying a closed departure.
  assert.deepEqual(flagLines(skills), [],
    'src/systems/skills.js is back on the open-flag list - the record answers the marker again');
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

test('FS1: the enchant ctx is MOUNTED by every host that owes it', () => {
  // WAVE D closed this. The flag's own claim was load-bearing and
  // checkable - "setDefaultEnchantCtx has exactly ONE caller in the
  // tree, world.js" - and it is the thing that changed: the standalone
  // dungeon host mounts it too, through the SAME body, so the two
  // cannot diverge.
  const dc = read('src/scenes/dungeonContext.js');
  assert.equal(/FLAGGED \(THE FOUR HOSTS RULE\): THE ENCHANT CTX IS NOT\n\s*\/\/ MOUNTED HERE/.test(dc), false,
    'the flag is retired where it stood');
  // AUDIT 54 (f2/hosts): THE THIRD HOST. This list read as the law and
  // was only the shape - `scenes/exterior.js` is a full combat host
  // that mints starting gear, opens the native inventory, buys off shop
  // shelves through its own mode machine and takes dungeon loot, and it
  // mounted nothing, so `_defaultCtx` was null for that whole session
  // and every payload optional-chained into silence. It also builds
  // createWorldModes, which passes `enchantCtx: false` on the premise
  // that an outer host owns the mount - so the dungeons and shops
  // entered from ?exterior inherited the hole. The predicate is "every
  // host that can hold an enchanted item" (hostEnchant.js:1-2), not
  // "the two that happen to mount it".
  const callers = SRC.filter((f) => f !== 'src/systems/enchantments.js'
    && /setDefaultEnchantCtx\(/.test(TEXT.get(f)));
  assert.deepEqual(callers.sort(), ['src/scenes/dungeonContext.js', 'src/scenes/exterior.js', 'src/scenes/world.js'],
    'every host that can hold an enchanted item mounts it, and no other file does');
  // ...and the two outer hosts that build the mode machine both mount,
  // which is what makes worldModes' `enchantCtx: false` premise true.
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(TEXT.get(f), /createWorldModes\(\{/, `${f} builds the mode machine`);
    assert.ok(callers.includes(f), `${f} owns the ctx the machine's dungeons decline to mount`);
  }
  // ...through ONE body. A host that hand-rolled a ctx object would be
  // the shape the flag was written about, one host later.
  for (const f of callers) {
    assert.match(TEXT.get(f), /setDefaultEnchantCtx\(createEnchantCtx\(\{/,
      `${f} mounts the shared body rather than a second copy of it`);
  }
  // and world.js no longer claims the flag lives somewhere it did not
  const world = read('src/scenes/world.js');
  assert.equal(/FLAGGED\n\s*\/\/ there with the rest of its enchant wiring/.test(world), false);
  // ...nor states the RETIRED half in the present tense. world.js's E2
  // mount header is the first file a reader of this mount opens, and
  // it went on asserting "setDefaultEnchantCtx has exactly one caller
  // in the tree" - and "the flag now exists where the work does",
  // pointing at a flag this wave retired - after the second mount
  // shipped. dungeonContext.js:1587 and hostEnchant.js:8 both say
  // "had"; the sentence a reader meets first must too.
  assert.equal(/setDefaultEnchantCtx has\n\s*\/\/ exactly one caller/.test(world), false,
    'the E2 header states the one-caller claim as HISTORY, not as present fact');
  assert.equal(/The flag now exists where the\n\s*\/\/ work does/.test(world), false,
    'the flag it pointed at was retired at the mount');
  assert.match(world, /WAVE D closed it: the body is scenes\/hostEnchant\.js\n\s*\/\/ and dungeonContext\.js:1703 mounts the same one/,
    'and the header names the shipped shape instead');
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
    // ROAD-E E1: the OVERLAY KEY/MOUSE-UP SEAM exists now, in every host
    // that owns a slot, so every sentence that said it did not is a
    // retired claim. Four windows carried one - the two automaps, the
    // rest window and the pause window - and each may QUOTE what it
    // retired (the unquote rule above), but none may assert it.
    /overlay seam carries no key-up route/,
    /overlay key seam delivers key DOWNS only/,
    /overlay seam delivers keydown and no keyup/,
    /overlay seam has no (?:key-)?down\/(?:key-)?up split/,
    /overlay channel\n?\s*(?:\/\/\s*)?delivers keydowns/,
  ];
  const offenders = [];
  for (const f of SRC) {
    const bare = TEXT.get(f).replace(/"[^"]*"/g, '""');
    for (const claim of RETIRED) if (claim.test(bare)) offenders.push(`${f}: ${claim}`);
  }
  assert.deepEqual(offenders, [], 'a retired sentence survives nowhere in src/ as an assertion');
});
