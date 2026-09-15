// HARD4 - THE VENDORED-WORK REGISTRY (2026-09-15, Mac: "make everything
// clean, hardened and not spaghetti ... I think i want to take a break
// of additions and do this right").
//
// The fourth slice of `01-Overview/Hardening.md`. Fourteen directories
// under `vendor/` carry other people's work - four mods ported 1:1, four
// data drops from Daggerfall Unity itself, a font glyph, a set of
// meshes, a road network, and Mac's own book - and until now each one's
// provenance lived in its own README and nowhere else.
//
// WHAT PUTTING THE ROWS SIDE BY SIDE FOUND. Six of the fourteen READMEs
// carry an UNFILLED permission line: a literal `[Mac: paste the text of
// the permission, or the link to it, here.]`, sitting directly under a
// sentence that says permission was granted. Read one README and it
// reads as settled. Read six and the pattern is obvious: the placeholder
// is a prompt that nothing ever asked again.
//
// That is not a licence problem - Mac's word that the authors gave
// permission is what settles whether the port may carry the files, and
// every one of the six says so with a date. It is a RECORD problem, of
// exactly the shape this program keeps finding: a rule (write the
// permission down) enforced by whoever remembers it. So the registry
// carries a `RECORD OPEN` mark, and this gate holds the mark and the
// placeholder in step IN BOTH DIRECTIONS - fill a permission line and
// forget the row, or mark a row open whose README is complete, and it
// goes red.
//
// The other find is a row, not a defect: PCAAO's port is built from the
// shipped 1.44 bundle, decompiled, while the last single-file source in
// its repository is 1.40. The README says so; the registry is where a
// maintainer would look for it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const REGISTRY = 'bible/01-Overview/Mod-Registry.md';

/** Every directory under vendor/ - the row list, derived. */
const vendorDirs = () => readdirSync(join(ROOT, 'vendor'), { withFileTypes: true })
  .filter((e) => e.isDirectory()).map((e) => e.name).sort();

/** The registry's rows, by vendor key, as {cells}. */
function rows() {
  const out = new Map();
  for (const line of read(REGISTRY).split('\n')) {
    const m = /^\| `([^`]+)` \|(.*)\|\s*$/.exec(line);
    if (!m) continue;
    const cells = m[2].split(' | ').map((c) => c.trim());
    if (cells.length !== 8) continue;   // the deviations list is not a row
    const [takes, upstream, version, readFrom, permission, slice, parity, bible] = cells;
    out.set(m[1], { takes, upstream, version, readFrom, permission, slice, parity, bible, line });
  }
  return out;
}

/** The one manifest a vendor directory ships, if it ships one. */
function manifest(dir) {
  const f = readdirSync(join(ROOT, 'vendor', dir)).find((n) => n.endsWith('.dfmod.json'));
  return f ? JSON.parse(read(`vendor/${dir}/${f}`)) : null;
}

/** The unfilled-permission prompt, as all six of them are written. */
const PLACEHOLDER = /\[Mac: (?:paste|record)/;

test('HARD4: every vendored directory has a row, and every row a directory', () => {
  const dirs = vendorDirs();
  const reg = rows();
  assert.ok(dirs.length >= 14, `vendor/ has ${dirs.length} directories - the registry covers all of them`);
  assert.deepEqual(dirs.filter((d) => !reg.has(d)), [],
    'these carry someone else\'s work and the registry does not name them. Add a row to\n'
    + `${REGISTRY}: what the port takes, upstream, version, what it was read from, the licence\n`
    + 'or permission, the port slice, the parity date and the bible page.');
  assert.deepEqual([...reg.keys()].filter((k) => !dirs.includes(k)), [],
    'these rows name a vendor/ directory that is gone - the registry has outlived its subject');

  // and every directory still carries its long form
  for (const d of dirs) assert.ok(existsSync(join(ROOT, 'vendor', d, 'README.md')), `vendor/${d}/README.md is missing`);
});

test('HARD4: a row\'s version and author are the shipped manifest\'s, not a memory of them', () => {
  // Seven of the fourteen ship a `.dfmod.json`. Where one exists it is
  // the authority - a bundle refreshed to a new upstream version without
  // the registry being touched is the exact drift this row prevents, and
  // it is the kind nobody notices, because the port keeps working.
  const reg = rows();
  const checked = [];
  for (const [dir, row] of reg) {
    const mf = manifest(dir);
    if (!mf) continue;
    checked.push(dir);
    assert.equal(row.version, mf.ModVersion,
      `${dir}: the registry says version ${row.version}, the vendored manifest says ${mf.ModVersion}`);
    const surname = mf.ModAuthor.split(/\s+and\s+|,\s*/)[0];
    assert.ok(row.upstream.includes(surname),
      `${dir}: the manifest's author is "${mf.ModAuthor}" and the row's upstream cell does not name them`);
  }
  assert.ok(checked.length >= 7, `only ${checked.length} manifests were found to check against`);
});

test('HARD4: an unfilled permission line shows as RECORD OPEN, and a filled one does not', () => {
  // THE INVERSION THIS SLICE EXISTS FOR. Before it, an unfilled
  // permission line was invisible: buried at line 15 of a README that
  // reads as finished, in a directory nobody opens twice. It is a row
  // now, and the two cannot disagree.
  //
  // Note which way each failure reads. A README that still prompts and a
  // row that does not says the registry is claiming a receipt that is
  // not there. A README that has been filled in and a row still marked
  // open says somebody did the work and the record did not catch up.
  // Both are worth a red test; neither is a reason to delete the mark.
  const reg = rows();
  const open = [];
  const stale = [];
  for (const dir of vendorDirs()) {
    const prompts = PLACEHOLDER.test(read(`vendor/${dir}/README.md`));
    const marked = /RECORD OPEN/.test(reg.get(dir)?.permission ?? '');
    if (prompts && !marked) open.push(`vendor/${dir}/README.md still prompts for the permission and its row does not say RECORD OPEN`);
    if (!prompts && marked) stale.push(`vendor/${dir}/README.md has its permission recorded - take RECORD OPEN off its row`);
  }
  assert.deepEqual(open, [], 'an unrecorded permission is not shown as one');
  assert.deepEqual(stale, [], 'a recorded permission is still shown as open');

  // ...and the page must keep SAYING what the mark means, because a mark
  // whose meaning is lost reads as an accusation. It is not one: the
  // permission was given, and what is missing is the evidence of it.
  const page = read(REGISTRY);
  assert.match(page, /It does \*\*not\*\* mean the work is used without permission/,
    'the registry must keep explaining what RECORD OPEN means');
});

test('HARD4: every row names a bible page that exists, and every player-visible mod is registered', () => {
  const reg = rows();
  const missing = [];
  for (const [dir, row] of reg) {
    const page = row.bible.replace(/`/g, '').trim();
    if (page && page !== '-' && !existsSync(join(ROOT, 'bible', page))) missing.push(`${dir} -> bible/${page}`);
  }
  assert.deepEqual(missing, [], 'these rows point at a bible page that is not there');

  // The last derivation, and the one that matters for a NEW mod: a
  // vendor key the player can switch on in the Mods pane is a piece of
  // someone else's work the port is shipping, so it must be registered.
  // `systems/modSettings.js` is where that becomes true, so that is what
  // is read.
  const ms = read('src/systems/modSettings.js');
  const keys = [...ms.matchAll(/^ {2}'([a-zA-Z][\w-]*)':\s*Object\.freeze\(\{/gm)].map((m) => m[1]);
  assert.ok(keys.length >= 8, `only ${keys.length} vendor keys were read out of modSettings.js`);
  assert.deepEqual(keys.filter((k) => !reg.has(k)), [],
    'these mods are switchable by the player and carry no registry row - a mod cannot become\n'
    + 'player-visible without its provenance being written down');
});
