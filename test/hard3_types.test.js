// HARD3 - TYPES AT THE SEAMS THAT CRASH (2026-09-14, Mac: "make
// everything clean, hardened and not spaghetti ... refactor where
// absolutely needed").
//
// WHAT THIS SLICE IS, AND WHAT IT DELIBERATELY IS NOT.
//
// `01-Overview/Hardening.md` listed types THIRD, with the honest note
// that walking AUDIT 66's twelve findings against a type checker catches
// approximately none of them: ordering, omission, placement,
// reachability and unit convention are not shapes. That has not changed,
// and this file must not be read as the start of a repo-wide `strict`
// conversion. It is aimed at the three boundaries where a wrong SHAPE
// THROWS rather than misbehaves - the renderer's inputs, the save
// envelope, and the wire - because the Weapon Widget crash was exactly
// that, at exactly the first of them.
//
// SO THE CHECK IS OPT-IN. `tsconfig.json` sets `checkJs: false` and each
// seam file carries `// @ts-check` on its first line; everything else is
// PARSED (its exports give the seams their inference) and never reported.
//
// AND THE OPT-IN IS DERIVED, which is the whole point of this program.
// The three seam sets below are read out of the tree, not listed: every
// file in `render/`, every file in `net/`, and every module that knows
// the save envelope's VERSION. Add a file to any of them and this gate
// goes red until it opts in. That is the difference between a rule and a
// memory of a rule - `hard1_ownership.test.js` has the longer argument.
//
// WHAT IT FOUND, writing the three contracts down:
//   - `classicSave.js`'s no-Character arm returned four of the five
//     fields its own @returns promises, so `goldPieces` reached the save
//     envelope as `undefined`. The one production caller throws before
//     that arm can run; a test calls the function directly.
//   - `peerBodies.js` destructured two constructor parameters its JSDoc
//     never mentioned, and `remotePlayers.js`'s `bodyHeight` default took
//     no arguments while every call passes a peer id.
//   - `skyRenderer.js` named a `SkyFile` type that no import resolved.
//   - `saveSlots.js` read one `parse()` helper for TWO shapes, the slot
//     CARD and the save ENVELOPE, so neither had one.
//   - `activationRace.js` - HARD2's own file, a day old - documented five
//     @params for a function that takes one.
// None of those is an arithmetic error. All of them are a seam saying
// less than it should, which is this codebase's measured failure mode.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const jsIn = (dir) => readdirSync(join(ROOT, dir)).filter((f) => f.endsWith('.js')).map((f) => `${dir}/${f}`);

/**
 * THE THREE SEAMS, each DERIVED from the tree rather than listed.
 *
 * A directory is the right derivation for the first two because the
 * directory IS the boundary: everything in `render/` talks to the GL and
 * everything in `net/` talks to another machine. The save envelope has no
 * directory of its own, so it is derived from knowledge instead - a
 * module that knows SAVE_VERSION is a module that reads or writes the
 * envelope, and there is no way to join that set quietly.
 */
function seamFiles() {
  const render = jsIn('src/render');
  const net = jsIn('src/net');
  const save = jsIn('src/systems').filter((f) => /\bSAVE_VERSION\b/.test(read(f)));
  return { render, net, save, all: [...render, ...net, ...save] };
}

test('HARD3: the type run is part of the gate, and the config stays opt-in', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.scripts.types ?? '', /tsc -p tsconfig\.json/, 'npm run types runs the checker over the repo config');
  assert.match(pkg.scripts.check ?? '', /npm run types/,
    'npm run check RUNS it - a checker nobody runs is a checker that is always green');

  // The config's three load-bearing settings. `checkJs: false` is what
  // makes `@ts-check` mean something: flip it true and every file in the
  // tree reports at once, the seam sets stop being a decision, and the
  // 382 errors that produces get silenced with a blanket rather than
  // read. `noEmit` keeps the checker out of the build. And `include` has
  // to cover the whole of src/ - the seams need their imports PARSED to
  // infer anything, even though those imports are never reported.
  const ts = JSON.parse(read('tsconfig.json').replace(/^\s*\/\/.*$/gm, ''));
  assert.equal(ts.compilerOptions.checkJs, false, 'checkJs stays false: the opt-in IS the scope');
  assert.equal(ts.compilerOptions.allowJs, true);
  assert.equal(ts.compilerOptions.noEmit, true, 'the checker never writes output');
  assert.deepEqual(ts.include, ['src/**/*.js'], 'the whole of src/ is parsed, so a seam can see what it imports');
});

test('HARD3: every file at a seam opts in, and the seam sets are read out of the tree', () => {
  const { render, net, save, all } = seamFiles();
  // The derivations must not be able to evaporate. A refactor that empties
  // `net/`, or renames SAVE_VERSION, would otherwise leave this file green
  // and gating nothing at all.
  assert.ok(render.length >= 20, `the renderer seam is src/render/ - found ${render.length} files`);
  assert.ok(net.length >= 4, `the wire seam is src/net/ - found ${net.length} files`);
  assert.deepEqual(save.sort(), ['src/systems/classicSave.js', 'src/systems/save.js', 'src/systems/saveSlots.js'],
    'the save seam is every systems/ module that knows SAVE_VERSION; if this list grew, the new module opts in too');

  const missing = all.filter((f) => !/^\/\/ @ts-check\r?\n/.test(read(f)));
  assert.deepEqual(missing, [],
    'these files sit at a seam where a wrong SHAPE throws, and nothing checks what crosses them.\n'
    + 'Put `// @ts-check` on the first line and run `npm run types`: either it is clean, or it has\n'
    + 'just told you something true about the file.');
});

test('HARD3: no file buys its greenness with an escape hatch', () => {
  // The whole value of a shape gate is that the only way to green is to
  // WRITE THE SHAPE. `@ts-ignore` and `@ts-expect-error` silence one
  // line, `@ts-nocheck` silences a file that claims to be checked, and
  // any of the three turns this slice into decoration. There is no
  // allow-list on purpose: the day one is genuinely needed, the argument
  // for it belongs in a commit message and in this file, not in a
  // comment nobody reviews.
  const hatched = [];
  for (const dir of ['src', 'src/systems', 'src/scenes', 'src/render', 'src/net', 'src/ui', 'src/world',
    'src/player', 'src/combat', 'src/characters', 'src/formats', 'src/ai', 'src/tools']) {
    for (const f of jsIn(dir)) {
      const m = read(f).match(/@ts-(ignore|expect-error|nocheck)/);
      if (m) hatched.push(`${f}: ${m[0]}`);
    }
  }
  assert.deepEqual(hatched, [],
    'an escape hatch was used instead of a type. Write the shape, or widen the one that is wrong -\n'
    + 'HARD3 found two of its own typedefs too narrow that way (Color32 carries a Uint32Array view,\n'
    + 'and a SaveTree record\'s parsedData is a union), and both were the TYPE being wrong, not the code.');
});

test('HARD3: the renderer\'s contract is types only, and the shapes it names are the ones the renderer mints', () => {
  const c = read('src/render/contract.js');
  // A contract that can be imported for behaviour stops being a contract.
  assert.match(c, /^export \{\};$/m, 'contract.js exports nothing at runtime');
  assert.doesNotMatch(c, /^export (function|const|let|class)/m, 'and defines no value');
  for (const name of ['BillboardBatch', 'MeshBundle', 'Color32', 'RendererLike']) {
    assert.match(c, new RegExp(`@typedef \\{object\\} ${name}\\b`), `contract.js names ${name}`);
  }

  // The batch typedef is only worth having while it is the shape the
  // renderer actually returns, so it is checked against the mint. Every
  // field the factory writes must be declared, and the factory must say
  // it returns the contract rather than an anonymous object.
  const r = read('src/render/renderer.js');
  const mint = r.slice(r.indexOf('createBillboardBatch(archive, record, size, centers)'));
  assert.match(r, /@returns \{import\('\.\/contract\.js'\)\.BillboardBatch\}/,
    'createBillboardBatch declares the contract as its return');
  const returned = mint.slice(mint.indexOf('return {'), mint.indexOf('\n  }'));
  // the NAME of a @property is what follows its type, and a type can
  // carry braces of its own ({w, h}) - so read the name off the line's
  // tail rather than trying to match the braces.
  const declared = new Set([...c.matchAll(/@property \{.*\} \[?(\w+)\]?/g)].map((m) => m[1]));
  for (const field of [...returned.matchAll(/(?:^|[{,]\s*)(\w+)(?::|,|\s*})/g)].map((m) => m[1])) {
    assert.ok(declared.has(field), `the batch is minted with \`${field}\` and contract.js does not declare it`);
  }

  // ...and the CALLER-written fields are the reason this file exists:
  // eight modules outside render/ reach into a batch between frames, and
  // before HARD3 nothing said which fields were theirs to write.
  const writers = [];
  for (const dir of ['src/scenes', 'src/ui', 'src/net', 'src/systems']) {
    for (const f of jsIn(dir)) if (/\.(origin|sway|conceal|frame) = /.test(read(f))) writers.push(f);
  }
  assert.ok(writers.length >= 4, 'the batch is written by its callers, which is why its fields are declared optional');
});
