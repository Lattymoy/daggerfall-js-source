// HARD1 - THE LIFETIME GATE, GENERATIVE (2026-09-14, Mac: "I really want
// to focus on making everything clean, hardened and not spaghetti ...
// I think i want to take a break of additions and do this right").
//
// WHY THIS FILE EXISTS, AND WHY audit24_lifetimes.test.js WAS NOT ENOUGH.
//
// "EVERY ALLOCATION HAS AN OWNER" is one of the port's standing laws and
// it is written in eighteen places. AUDIT 24 built a gate for it - and
// that gate names the five leaks AUDIT 24 itself found. It is an
// ENUMERATION. It protects the past. Nothing in it can see a sixth
// allocation, so when HT1 added a torch pool to the dungeon context two
// audits later, the pool was missing from that context's teardown and
// every pin in the suite stayed green (AUDIT 66 F5). The same week the
// same shape was found in the interior host's quest-teleport exit (F6)
// and in the weapon rig's own component (F8).
//
// A rule enforced by an enumeration is a rule enforced by memory, which
// is the failure mode the whole codebase keeps showing: a correct system
// delivered incorrectly by its caller. So this gate is DERIVED. It reads
// the source, finds every thing a session-lifetime context builds, and
// requires each one to be either torn down by that context or DECLARED
// resource-free with a reason. It fails closed: a new pool added to a
// context fails this file until someone makes a decision about its end.
//
// THE FIRST THING IT CAUGHT, AND WHAT THAT COST. It named
// `dungeonContext`'s hit-effects pool, and the first pass read that as a
// LEAK and gave destroy() a `hitEffects.clear()`. AUDIT-HARD proved it
// was neither: the pool HANDS every batch away as it is born
// (`onSpawn: (b) => billboardBatches.push(b)`), the list is freed at
// :6093, and the added line freed each live splash a SECOND time.
//
// Three lessons are wired into this file because of it:
//   - the gate offers three answers and they are EXCLUSIVE, so there is
//     now a pin that says a hand-off must not also be ended by hand;
//   - the ownership check used to read COMMENTS, which is how the wrong
//     fix stayed green while explaining itself - it reads code now;
//   - and the thing that misled the fix was a stale comment in the host
//     ("that list is the static layout art"), true until HE1 wired the
//     onSpawn and never corrected. A gate cannot read intent, so the
//     comment was corrected too.
//
// The genuine leaks this file is built on are still AUDIT 66's F5, F6
// and F8 - and it names all three without being told they exist.
//
// SCOPE. A "session-lifetime" context is one built and destroyed while
// the page lives. The four top-level hosts are NOT that: scenes switch
// by `location.reload()` (main.js), so a host's own allocations end with
// the page and its teardown is the browser's. What IS session-lifetime
// is everything a host builds and rebuilds inside itself - the dungeon
// context, the interior context, and the interior mode's pools - which
// is exactly where every lifetime finding so far has lived.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/** The brace-matched body that follows `src[from]`. */
function bodyFrom(src, from) {
  const open = src.indexOf('{', from);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  throw new Error('unbalanced braces');
}

/** The body of a teardown declared as `destroy() {` / `dispose() {` at the start of a line. */
function teardownBody(src, name) {
  // a method shorthand (`destroy() {`), a declaration (`function tryExit() {`)
  // or a method with arguments (`forceExitToExterior({ cacheScene = true } = {}) {`)
  const re = new RegExp(`^\\s*(?:async\\s+)?(?:function\\s+)?${name}\\(`, 'm');
  const m = re.exec(src);
  assert.ok(m, `${name}() not found`);
  // Walk the PARAMETER LIST to its closing paren before looking for the
  // body's brace. `forceExitToExterior({ cacheScene = true } = {})` opens
  // two braces of its own, and taking the first one reads a default value
  // as the function body - audit24_lifetimes.test.js met the same trap on
  // `senses = {}`, which is a fair warning about how this tree is written.
  let i = m.index + m[0].length - 1;
  for (let depth = 0; i < src.length; i++) {
    if (src[i] === '(') depth += 1;
    else if (src[i] === ')' && (depth -= 1) === 0) break;
  }
  return bodyFrom(src, i);
}

/**
 * The CODE of a body, with its comments taken out.
 *
 * AUDIT-HARD found this gate passing on PROSE. The ownership check below
 * asks two questions of every line that names a binding - does it name
 * it, and does it end it - and a COMMENT answers both. A teardown with
 * zero code lines mentioning a pool stayed green because a sentence in it
 * said the words `hitEffects.clear()` while explaining why that line was
 * wrong. A gate a comment can switch off is worse than an enumeration:
 * an enumeration only fails to grow, this one actively lies.
 */
function codeOf(body) {
  let out = '', i = 0, quote = null;
  while (i < body.length) {
    const c = body[i], d = body[i + 1];
    if (quote) {
      if (c === '\\') { out += body.slice(i, i + 2); i += 2; continue; }
      if (c === quote) quote = null;
      out += c; i += 1; continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; out += c; i += 1; continue; }
    if (c === '/' && d === '/') { while (i < body.length && body[i] !== '\n') i += 1; continue; }
    if (c === '/' && d === '*') { const e = body.indexOf('*/', i + 2); i = e < 0 ? body.length : e + 2; continue; }
    out += c; i += 1;
  }
  return out;
}

/** Anything that reads as "and this is how it ends". */
const ENDS_IT = /\.(destroy|dispose|destroyAll|teardown|shutdown|release|clear|clearLive|stop|reset|restorePiles)\b|=\s*null|\.length = 0/;

// ── THE SESSION-LIFETIME CONTEXTS ──────────────────────────────────────
//
// Each entry: the file, the teardown that ends it, and the factories
// whose product holds NOTHING that needs freeing - each with the reason,
// because "it needs no teardown" is a claim about a module's contents
// and the next person deserves to see why it was believed.
const CONTEXTS = [
  {
    file: 'src/scenes/dungeonContext.js',
    teardowns: ['destroy'],
    // AUDIT-HARD's correction. HARD1's first pass read this pool as a
    // LEAK and had destroy() call `hitEffects.clear()`. It is not a leak
    // and that was a DOUBLE FREE: the pool is built with `onSpawn: (b) =>
    // billboardBatches.push(b)`, so every splash it mints joins the list
    // destroy() already frees, and clear() retired each one into a second
    // `destroyBillboardBatch` of the same GL handles. Proven by driving
    // the real pool with a counting renderer: two live splashes, two
    // frees each.
    //
    // The wrong answer was reachable because the gate OFFERS three and I
    // took the first without asking which was true - and because the
    // host's own comment at :6097 still said `billboardBatches` was "the
    // static layout art", which stopped being so when HE1 wired the
    // onSpawn. The same shape as `hostMagic`'s `impacts`, four lines
    // down this very list.
    handedOff: {
      hitEffects: ['the pool is built with `onSpawn: (b) => billboardBatches.push(b)`, so every splash it mints joins the list destroy() frees',
        /onSpawn: \(b\) => billboardBatches\.push\(b\)/, /for \(const b of billboardBatches\) renderer\.destroyBatch\(b\)/],
    },
    declared: {
      animalAmbience: 'createAnimalAmbience returns { update } alone - it plays one-shots off the world clock and holds no handle',
      detectFeed: 'createDetectFeed returns { tick } over a plain marker list - no GPU batch, no loop',
      _restDeps: 'a bag of thunks handed to the rest window; it owns nothing',
      win: 'a window, owned by the window stack that pushed it, not by the context',
    },
  },
  {
    file: 'src/scenes/hostMagic.js',
    teardowns: ['destroy'],
    // NOT a leak and NOT resource-free: a HAND-OFF. The pool mints
    // batches and gives each one away as it is born, so the owner is
    // the list, and the list is freed. The proof is required below.
    handedOff: {
      impacts: ['the pool is built with `onSpawn: (b) => batches.push(b)`, so every batch it mints joins the list destroy() frees',
        /onSpawn: \(b\) => batches\.push\(b\)/, /for \(const b of batches\) \{[^}]*destroyBillboardBatch\(b\)/],
    },
  },
  {
    // THE PLURAL TEARDOWN, which is where AUDIT 66 F6 lived. This host
    // builds its interior pools ONCE (they are page-lifetime like the
    // host) but RESETS them on every way out of a building, and it has
    // two ways out: the door, and the forced exit a quest teleport or a
    // load takes. F6 was a pool that had joined the first list and not
    // the second. Both paths are checked, so a pool can no longer be
    // half-remembered.
    file: 'src/scenes/worldModes.js',
    teardowns: ['tryExit', 'forceExitToExterior'],
    only: /^interior/,
    declared: {
      interiorWeapon: 'the weapon rig is built once and lives with the HOST, not the building - it has no per-interior state to reset (its own component ends at the page, as every host-scope thing does)',
      interiorTicker: 'the host\'s clock subscription, built once and running for the page',
      interiorRestDeps: 'a bag of thunks handed to the rest window - the same shape as the dungeon context\'s, and it owns nothing',
    },
  },
];

test('HARD1: every thing a session-lifetime context BUILDS is ended on EVERY one of its teardown paths, or declared with a reason', () => {
  const unowned = [];
  for (const { file, teardowns, declared = {}, handedOff = {}, only } of CONTEXTS) {
    const src = read(file);
    const built = [...src.matchAll(/(?:const|let)\s+(\w+)\s*=\s*(create[A-Z]\w*)\s*\(/g)];
    for (const path of teardowns) {
      const body = codeOf(teardownBody(src, path));   // AUDIT-HARD: prose does not own anything
      for (const [, binding, factory] of built) {
        if (declared[binding] || handedOff[binding] || (only && !only.test(binding))) continue;
        const lines = body.split('\n').filter((l) => new RegExp(`\\b${binding}\\b`).test(l));
        if (!lines.length) unowned.push(`${file}: ${binding} = ${factory}() is never named in ${path}()`);
        else if (!lines.some((l) => ENDS_IT.test(l))) unowned.push(`${file}: ${binding} = ${factory}() is named in ${path}() but nothing ends it`);
      }
    }
  }
  assert.deepEqual(unowned, [],
    'EVERY ALLOCATION HAS AN OWNER. Each line above is a thing a context builds and never ends.\n'
    + 'Either end it on that path, or add the BINDING to that context\'s `declared` with the reason it\n'
    + 'needs no ending - a sentence naming what it holds and who frees it.');
});

test('HARD1: a declaration stays honest - the thing it speaks for still exists, and still holds nothing', () => {
  // A declaration is a claim about a module's contents, and modules
  // grow. Each one is re-checked against the factory it names: if the
  // binding is gone the declaration is stale, and if its factory has
  // since learned to mint a batch, a mesh or a loop, this file goes red
  // rather than the memory of whoever wrote the line.
  const MINTS = /\.createBillboardBatch\(|\.createBatch\(|\.createMesh\(|\bloop3d\(|\baudio\.loop\(/;
  const homes = new Map();
  // AUDIT-HARD: this walked nine named directories, one level deep. A
  // declared binding whose factory lived anywhere else - `src/formats`,
  // `src/ai`, or any of the four nested directories the list never knew
  // about - got `homes.get()` undefined, and the MINTS check below is
  // guarded by `if (home && ...)`, so it was SILENTLY SKIPPED. A check
  // that quietly does nothing is the worst kind. The whole of src/ now.
  for (const f of jsUnder('src')) {
    const src = read(f);
    for (const m of src.matchAll(/export function (create[A-Z]\w*)\s*\(/g)) homes.set(m[1], { path: f, src });
  }
  const grown = [];
  for (const { file, declared } of CONTEXTS) {
    const ctxSrc = read(file);
    for (const [binding, reason] of Object.entries(declared ?? {})) {
      const built = new RegExp(`(?:const|let)\\s+${binding}\\s*=\\s*(create[A-Z]\\w*)\\s*\\(`).exec(ctxSrc);
      assert.ok(built, `${file}: ${binding} is declared and no longer built there - the declaration has outlived its binding`);
      assert.ok(reason.length > 24, `${binding}: the reason must be a sentence naming what it holds, not a shrug`);
      const home = homes.get(built[1]);
      if (home && MINTS.test(home.src)) grown.push(`${file}: ${binding} = ${built[1]}() (${home.path}) now mints a batch, a mesh or a loop`);
    }
  }
  assert.deepEqual(grown, [],
    'a declared binding has grown a resource; end it on every teardown path and take it off `declared`');

  // A hand-off is only a hand-off while BOTH halves are still written:
  // the giving away, and the freeing of what was given. Either half
  // deleted and this is a leak with a comment on it.
  for (const { file, teardowns, handedOff = {} } of CONTEXTS) {
    const src = read(file);
    for (const [binding, [reason, gives, frees]] of Object.entries(handedOff)) {
      assert.ok(reason.length > 24, `${binding}: the reason must name who takes it`);
      assert.match(src, gives, `${file}: ${binding} is declared a hand-off and no longer hands anything over`);
      assert.ok(teardowns.some((t) => frees.test(teardownBody(src, t))),
        `${file}: ${binding}'s batches are handed to a list that no teardown frees any more`);
    }
  }
});

test('HARD1: a HAND-OFF is not also ended by hand - that is a double free, not a belt and braces', () => {
  // THE GATE AUDIT-HARD ASKED FOR, and the one that would have caught its
  // own finding. When a pool gives each batch away as it is born, the
  // list it gave them to is the owner. A teardown that frees the list AND
  // ends the pool frees every live batch TWICE.
  //
  // It is benign today only by luck of the platform: deleting a deleted
  // WebGL object is specified as a no-op, not an error, so the mistake
  // makes no noise at all. Pool the handles, or move to a backend that
  // checks, and it becomes a crash on every dungeon exit.
  //
  // Read as a rule rather than as an incident: END IT WHERE IT IS OWNED,
  // ONCE. The three answers HARD1 offers - ends it, holds nothing, hands
  // it off - are EXCLUSIVE, and this is the pin that says so.
  const doubled = [];
  for (const { file, teardowns, handedOff = {} } of CONTEXTS) {
    const src = read(file);
    for (const binding of Object.keys(handedOff)) {
      for (const path of teardowns) {
        const body = codeOf(teardownBody(src, path));
        const ends = body.split('\n').filter((l) => new RegExp(`\\b${binding}\\b`).test(l) && ENDS_IT.test(l));
        for (const l of ends) doubled.push(`${file}: ${binding} is declared a hand-off AND ended in ${path}() - "${l.trim()}"`);
      }
    }
  }
  assert.deepEqual(doubled, [],
    'a hand-off pool is ALSO being ended by hand. Its batches are freed by the list it hands them to;\n'
    + 'ending the pool here frees each of them a second time. Delete the line - or, if the pool really\n'
    + 'does own something the list does not, it is not a hand-off and the declaration is what is wrong.');
});

test('HARD1: a context that frees a GPU batch is a context this gate knows about', () => {
  // The gate above is only as wide as CONTEXTS, so CONTEXTS itself is
  // derived: any teardown in scenes/ that frees a batch is a
  // session-lifetime context by definition, and must be listed here.
  // Adding a fifth context to the tree fails this file until it joins.
  const known = new Set(CONTEXTS.map((c) => c.file));
  const missing = [];
  for (const f of readdirSafe('src/scenes')) {
    const path = `src/scenes/${f}`;
    const src = read(path);
    if (!/^\s{2,}(?:async\s+)?destroy\(\)\s*\{/m.test(src)) continue;
    const body = teardownBody(src, 'destroy');
    if (/destroyBillboardBatch\(|destroyBatch\(|destroyMesh\(/.test(body) && !known.has(path)) missing.push(path);
  }
  assert.deepEqual(missing, [],
    'these files free GPU batches in a destroy() and are not in CONTEXTS - the gate cannot see what they build');
});

function readdirSafe(dir) {
  return readdirSync(join(ROOT, dir)).filter((f) => f.endsWith('.js'));
}

/** Every .js under a directory, at any depth (AUDIT-HARD - see `homes`). */
function jsUnder(dir) {
  const out = [];
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    if (e.isDirectory()) out.push(...jsUnder(`${dir}/${e.name}`));
    else if (e.name.endsWith('.js')) out.push(`${dir}/${e.name}`);
  }
  return out;
}
