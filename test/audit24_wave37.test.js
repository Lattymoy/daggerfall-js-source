// AUDIT 24, wave 37: the live crash out of the deployed build -
//     TypeError: can't access property "pointerdown", it is undefined
// Both browser hosts install pointer and wheel listeners ~600 lines
// above `var modes = createWorldModes({...})`. The `var` is deliberate
// and load-bearing: it hoists, so the closures reach a binding that
// EXISTS and reads undefined instead of a TDZ ReferenceError. What was
// missing is the other half - the guard has to be on the OBJECT.
// `modes.pointerdown?.(e)` optional-calls the METHOD, so it reads like
// a guard and is not one, and ?world's one await in that window
// (`await loadQuestPack()`) is wide enough for a real click to land.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Mutation campaign: 13 reintroductions, 13 killed. Both hosts'
// pointerdown and wheel lines back to the method guard (the shipped
// bug); either declaration back to `const`; the five other
// above-declaration derefs stripped of their `?.` one at a time; the
// why-record at the declaration losing its pointer here; a second
// hoisted `var` appearing in a host.
// Two EQUIVALENT mutants, recorded rather than dressed up as kills:
// putting a `?.` on `modes.frame(dt, now)` and turning
// `modes.installShotProbes()` into an optional call both SURVIVE. They
// are below the declaration, where the binding is assigned and the two
// forms are the same program. The gate is about reachability, not
// style, so it says nothing about them - correctly.

const HOSTS = ['src/scenes/world.js', 'src/scenes/exterior.js'];
const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
// Only comments are stripped: prose says "modes" constantly ("F1-F4
// modes;"), and a gate that trips on a sentence is noise, not a gate.
const decomment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const line = (src, n) => src.split('\n')[n - 1];

/** The whole registration STATEMENT starting at `needle`, however many
 *  lines it spans. U43 made the pointerdown listener multi-line (the
 *  large HUD's panels have to be offered the click before the relock),
 *  and a gate that could only read a one-liner would have gone quiet
 *  on the exact edit that reopens the crash. Brace-balanced rather
 *  than line-counted, so it follows the law and not the formatting. */
function statementAt(src, needle) {
  const lines = src.split('\n');
  const start = lines.findIndex((l) => l.includes(needle));
  assert.ok(start >= 0, `no registration line matching ${needle}`);
  let depth = 0, out = [];
  for (let i = start; i < lines.length; i++) {
    const l = lines[i];
    out.push(l);
    for (const ch of decomment(l)) {
      if (ch === '(' || ch === '{' || ch === '[') depth++;
      else if (ch === ')' || ch === '}' || ch === ']') depth--;
    }
    if (depth <= 0 && out.length) return out.join('\n');
  }
  assert.fail(`unbalanced statement at ${needle}`);
  return '';
}

/** Runs one shipped listener registration with `modes` in exactly the
 *  state the crash happened in: hoisted, declared, unassigned. */
function fireListener(lineSrc, event = {}) {
  const seen = [];
  const canvas = {
    addEventListener: (type, fn) => seen.push({ type, fn }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 200 }),
    width: 320, height: 200,
  };
  const townTalk = { pointerdown: () => false, wheel: () => false, overlayActive: false };
  const requestLook = () => seen.push({ type: 'requestLook' });
  // U43: the bar is off in this harness, which is the state that must
  // still reach requestLook - a HUD that swallowed the click when it
  // is not even drawn would be the same class of bug as the crash.
  const routeLargeHudClick = () => false;
  const hudCtx = {};
  new Function('canvas', 'townTalk', 'requestLook', 'routeLargeHudClick', 'hudCtx',
    `var modes; ${lineSrc}`)(canvas, townTalk, requestLook, routeLargeHudClick, hudCtx);
  assert.equal(seen.length, 1, 'one listener registered');
  seen[0].fn({ preventDefault: () => seen.push({ type: 'preventDefault' }), button: 0, clientX: 0, clientY: 0, ...event });
  return seen.map((s) => s.type);
}

test('audit24 wave37: the crashing shape really does crash, and the shipped one does not', () => {
  // The bug, verbatim, reintroduced: the ONLY edit is `?.` -> `.` on the
  // object. It throws the exact TypeError the deployed build reported.
  const crashing = "canvas.addEventListener('pointerdown', (e) => { if (townTalk.pointerdown(e)) return; if (modes.pointerdown?.(e)) return; requestLook(canvas); });";
  assert.throws(() => fireListener(crashing), (err) => {
    assert.ok(err instanceof TypeError, `a TypeError, got ${err?.constructor?.name}`);
    assert.match(err.message, /pointerdown/, 'and it names the property');
    return true;
  }, 'the optional CALL never guarded the object');

  // And each shipped line survives the same undefined and falls through
  // to its own default arm.
  for (const host of HOSTS) {
    const src = rd(host);
    const pd = statementAt(src, "addEventListener('pointerdown'");
    const wh = statementAt(src, "addEventListener('wheel'");
    assert.deepEqual(fireListener(pd), ['pointerdown', 'requestLook'], `${host}: a click before the mode machine exists still grabs the pointer`);
    assert.deepEqual(fireListener(wh), ['wheel'], `${host}: and a scroll is simply not eaten`);
  }
});

test('audit24 wave37: every reference above the declaration is guarded on the OBJECT', () => {
  for (const host of HOSTS) {
    const src = decomment(rd(host));
    const declAt = src.indexOf('var modes = createWorldModes({');
    assert.ok(declAt > 0, `${host}: the declaration is found`);

    const above = src.slice(0, declAt);
    // A plain `modes.x` or `modes[x]` above the assignment is the bug.
    // Short-circuit safety (`modes?.mode === 'interior' && modes.x`)
    // is real but unprovable by eye, and a gate with an exception list
    // has a blind spot - so the rule is mechanical: all or nothing.
    const unguarded = [...above.matchAll(/\bmodes\s*(?!\?)[.[]/g)]
      .map((m) => above.slice(Math.max(0, m.index - 70), m.index + 30).replace(/\s+/g, ' '));
    assert.deepEqual(unguarded, [], `${host}: unguarded dereference above the declaration`);
    // and the gate is not vacuous - there really are references up there
    assert.ok((above.match(/\bmodes\?\./g) ?? []).length >= 5, `${host}: references above the declaration`);
  }
});

test('audit24 wave37: the declaration stays a var - const would make the guard useless', () => {
  for (const host of HOSTS) {
    const src = rd(host);
    assert.match(src, /^\s*var modes = createWorldModes\(\{/m, `${host}: var, not const or let`);
    assert.equal((src.match(/\bmodes = createWorldModes\(/g) ?? []).length, 1, `${host}: exactly one mode machine`);
    // the comment at the declaration says WHY, and names this file
    const declAt = src.indexOf('var modes = createWorldModes({');
    const why = src.slice(Math.max(0, declAt - 500), declAt);
    assert.match(why, /VAR, not const/, `${host}: the reason is recorded at the line`);
    assert.match(why, /audit24_wave37/, `${host}: and points at this gate`);
  }

  // WHY it is load-bearing: `?.` does not save a TDZ read. Same closure,
  // same guard, `const` instead of `var` - and the click throws again,
  // this time a ReferenceError.
  const tdz = () => {
    const townTalk = { pointerdown: () => false };
    // The click has to land INSIDE the dead zone, so the harness fires
    // the handler from the same body, above the declaration - exactly
    // where ?world's `await loadQuestPack()` puts a real one.
    new Function('townTalk', `
      let fire = null;
      const canvas = { addEventListener: (t, fn) => { fire = fn; } };
      const requestLook = () => {};
      canvas.addEventListener('pointerdown', (e) => { if (townTalk.pointerdown(e)) return; if (modes?.pointerdown?.(e)) return; requestLook(canvas); });
      fire({});
      const modes = {};
    `)(townTalk);
  };
  assert.throws(tdz, ReferenceError, 'optional chaining does not reach into the temporal dead zone');
});

test('audit24 wave37: the crash shape is gone from every scene host', () => {
  // Not just the two hosts - the whole scene layer. `X.method?.(` where
  // X is a hoisted var is the shape; `modes` is the only var in here.
  const scenes = ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/shared.js'];
  for (const host of scenes) {
    const src = decomment(rd(host));
    assert.doesNotMatch(src, /\bmodes\.\w+\?\.\(/, `${host}: an optional CALL on an unguarded object`);
  }
  // and no second hoisted binding has quietly appeared to repeat it
  const vars = HOSTS.flatMap((h) => [...decomment(rd(h)).matchAll(/^\s*var\s+(\w+)/gm)].map((m) => m[1]));
  assert.deepEqual([...new Set(vars)], ['modes'], 'the only var in the scene hosts is the deliberate one');
});


// U45 added a fourth gate here for the `say` crash - a line-based
// walk of each host boot's own body. It is GONE, and deliberately: the
// session that found the same crash from the other side wrote
// test/tdz.test.js, which parses every file in src/ to an AST and
// reports a reference evaluated in the SAME execution scope as a
// declaration it precedes. That is the law, done properly, over the
// whole tree rather than three functions - and two gates for one law
// is the second copy this project keeps deleting. The pin follows the
// law to its home; this file goes back to watching `modes`.
