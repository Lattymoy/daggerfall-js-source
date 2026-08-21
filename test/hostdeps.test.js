// THE DEPS A HOST HANDS OVER MUST COVER WHAT THE CONTEXT UNPACKS.
//
// Reported from play as `d is not a function` with a minified stack.
// The chain had three links and only the middle one was ever checked
// by anything:
//
//   world.js / exterior.js   build `pipeline: { ... }` for worldModes
//   worldModes.js            destructures that, and hands a bag on
//   dungeonContext.js        destructures THAT, and calls what it got
//
// uploadRecordFrame was missing from the first link. It arrived as
// undefined, travelled two hops without complaint, and threw on the
// first enemy frame in a dungeon entered from the world - while the
// standalone ?dungeon scene, which spreads the whole pipeline, was
// fine. Nothing failed at build time: a missing PROPERTY is not a
// missing export, so rollup had nothing to say.
//
// A seam is a contract. These pins read both ends of each one and
// assert the caller covers the callee, so the next omission fails
// here instead of in a player's dungeon.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

/** The identifiers a `const { a, b, c } = <source>;` statement unpacks. */
function destructuredFrom(src, source) {
  const re = new RegExp(String.raw`const\s*\{([^}]*)\}\s*=\s*${source}\s*;`, 'g');
  const keys = new Set();
  for (const m of src.matchAll(re)) {
    for (const raw of m[1].split(',')) {
      const name = raw.split(':')[0].split('=')[0].trim();
      if (name && /^[A-Za-z_$][\w$]*$/.test(name)) keys.add(name);
    }
  }
  return keys;
}

/** The keys of an object literal written as `<label>: { a, b, c }` or
 *  passed as a first argument `fn(\n  { a, b, c },`. */
function literalKeys(src, opener) {
  const i = src.indexOf(opener);
  assert.ok(i >= 0, `could not find ${opener}`);
  const open = src.indexOf('{', i);
  // brace-balanced, so a nested object in the bag cannot end the scan
  let depth = 0, close = open;
  for (; close < src.length; close++) {
    if (src[close] === '{') depth++;
    else if (src[close] === '}' && --depth === 0) break;
  }
  const body = src.slice(open + 1, close);
  // top-level commas only
  const parts = [];
  let d = 0, start = 0;
  for (let k = 0; k < body.length; k++) {
    const c = body[k];
    if (c === '{' || c === '(' || c === '[') d++;
    else if (c === '}' || c === ')' || c === ']') d--;
    else if (c === ',' && d === 0) { parts.push(body.slice(start, k)); start = k + 1; }
  }
  parts.push(body.slice(start));
  return new Set(parts
    .map((raw) => raw.replace(/\/\/[^\n]*/g, '').split(':')[0].trim())
    .filter((n) => /^[A-Za-z_$][\w$]*$/.test(n)));
}

const missing = (needed, given) => [...needed].filter((k) => !given.has(k));

test('worldModes unpacks nothing from `pipeline` that its hosts do not hand it', () => {
  const modes = read('src/scenes/worldModes.js');
  const needed = destructuredFrom(modes, 'pipeline');
  assert.ok(needed.size >= 5, 'the destructure was found at all');
  assert.ok(needed.has('uploadRecordFrame'), 'the one that was missing is in the contract');
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const given = literalKeys(read(host), 'pipeline: {');
    assert.deepEqual(missing(needed, given), [],
      `${host} must supply every key worldModes unpacks from pipeline`);
  }
});

test('buildDungeonContext gets every dep it unpacks, from BOTH of its callers', () => {
  const ctx = read('src/scenes/dungeonContext.js');
  const needed = destructuredFrom(ctx, 'deps');
  assert.ok(needed.has('uploadRecordFrame'), 'the crash site-s own dep');
  // the world-mode caller writes the bag out by hand
  const modes = read('src/scenes/worldModes.js');
  const given = literalKeys(modes, 'await buildDungeonContext(');
  assert.deepEqual(missing(needed, given), [],
    'worldModes must hand buildDungeonContext every dep it unpacks');
  // the standalone scene spreads the whole pipeline, which is why it
  // never showed the bug - assert it still does
  assert.match(read('src/scenes/dungeon.js'), /buildDungeonContext\(\s*\n?\s*\{\s*\.\.\.pipeline/,
    'the standalone dungeon scene spreads the pipeline whole');
});

test('buildInteriorContext gets every dep it unpacks', () => {
  const ctx = read('src/scenes/interiorContext.js');
  const needed = destructuredFrom(ctx, 'deps');
  const given = literalKeys(read('src/scenes/worldModes.js'), 'await buildInteriorContext(');
  assert.deepEqual(missing(needed, given), [],
    'worldModes must hand buildInteriorContext every dep it unpacks');
});

test('the data pipeline actually exports every name the hosts unpack from it', () => {
  const pipeline = read('src/scenes/dataPipeline.js');
  const returned = literalKeys(pipeline, 'return { textureFiles');
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const needed = destructuredFrom(read(host), 'pipeline');
    assert.deepEqual(missing(needed, returned), [],
      `${host} unpacks only what createDataPipeline returns`);
  }
});
