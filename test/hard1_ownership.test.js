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
// The first thing it caught was not ours. `dungeonContext`'s hit-effects
// pool mints a billboard batch per blood splash and its teardown never
// retired them, while the interior host has called `clear()` on its own
// copy of that pool since HE1. One line, in code that predates the
// torches by months.
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
      const body = teardownBody(src, path);
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
  for (const dir of ['src/systems', 'src/scenes', 'src/combat', 'src/ui', 'src/world', 'src/characters', 'src/net', 'src/render', 'src/player']) {
    for (const f of readdirSafe(dir)) {
      const src = read(`${dir}/${f}`);
      for (const m of src.matchAll(/export function (create[A-Z]\w*)\s*\(/g)) homes.set(m[1], { path: `${dir}/${f}`, src });
    }
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
