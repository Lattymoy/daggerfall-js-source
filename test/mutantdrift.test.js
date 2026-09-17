// AUDIT QS6 F7 - A STALE MUTANT IS A CHECK THAT RETIRED WITHOUT SAYING SO.
//
// A mutant record names the exact source text it replaces. When that text
// moves, `tools/mutate.mjs` cannot apply it and prints "did not apply" at the
// end of the run - and the law that mutant was the only killer of is now
// checked by nothing at all. Nothing fails. The slice still reports "N dead,
// 0 survived", because a record that never applied is not a survivor.
//
// QS6 found this the way these things are always found: eight of its own
// neighbours' records had gone stale under it (five actions where there had
// been four, a `blocked` decline added to two host ladders, a tap guard given
// a name), and two more in `relayversion` had been stale for waves - their
// anchor, `export { RELAY_VERSION };` in `server/src/index.js`, left that file
// some time ago. Ten laws unchecked, and every suite green.
//
// So the records are swept here, the way `test/citedrift.test.js` sweeps the
// cites: every `old` must still be findable in the file it names. It is the
// same claim in both files - a reference into source is a claim like any
// other, and it rots.
//
// THE CARRIED LIST below is what this sweep found ALREADY stale on the day it
// was written, in arcs that had long since merged. They are named and dated
// rather than fixed here, because re-aiming twelve records across four
// unrelated arcs inside a quickslot change is how a diff stops being
// reviewable. The list can only SHRINK: a record taken off it is fixed, and
// nothing may be added without a reason written beside it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Stale on 2026-09-17, in arcs merged before QS6. Each is a law whose only
 *  killer no longer applies; each is owed a re-aim BY CONTENT in its own
 *  arc's next pass, not a positional bump. */
const CARRIED = new Set([
  'ba1.json::reverb-tail-no-decay',
  'ba1.json::host-dungeon-flat-ambient',
  'if1.json::host-world-ungated',
  'soc1.json::S3-target-both-admitted',
  'soc1.json::S13-seen-stamped-on-first-tab',
  'soc1.json::S35-acct-swept-with-the-looks',
  'soc1.json::S36-party-kept-for-ever',
  'soc1.json::S37-picture-before-the-welcome',
  'soc1.json::S38-version-not-bumped',
  'soc2.json::C5-made-up-kind-sent',
  'soc2.json::C6-act-without-account',
  'soc2.json::C13-stale-invite-after-joining',
]);

test('AUDIT QS6 F7: every mutant record still names source that is there - a record that cannot apply is a law nobody checks', () => {
  const dir = join(ROOT, 'tools/mutants');
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  assert.ok(files.length > 20, 'the slices are where this pin looks');
  const cache = new Map();
  const read = (p) => {
    if (!cache.has(p)) cache.set(p, existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), 'utf8') : null);
    return cache.get(p);
  };
  const stale = [];
  const fixed = [];
  let total = 0;
  for (const f of files) {
    const recs = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    assert.ok(Array.isArray(recs), `${f} is a list of records`);
    for (const r of recs) {
      total++;
      const id = `${f}::${r.name}`;
      assert.ok(r.name && r.file && typeof r.old === 'string' && typeof r.new === 'string',
        `${id} is missing a field a mutant needs`);
      assert.ok(Array.isArray(r.tests) && r.tests.length, `${id} names no test to run`);
      // A mutant that changes nothing is a mutant that cannot die.
      assert.notEqual(r.old, r.new, `${id} replaces its text with itself`);
      const src = read(r.file);
      const ok = src != null && src.includes(r.old);
      if (!ok && !CARRIED.has(id)) stale.push(`${id}  ->  ${r.file}`);
      if (ok && CARRIED.has(id)) fixed.push(id);
    }
  }
  assert.ok(total > 800, `the sweep really read the records (${total})`);
  assert.deepEqual(stale, [],
    'these mutant records no longer apply, so the laws they are the only killer of are checked by NOTHING - re-aim them BY CONTENT (a positional bump moves a wrong anchor by the right offset)');
  // The list can only shrink.
  assert.deepEqual(fixed, [],
    'these were carried as already-stale and now apply again - take them off CARRIED, which is the only direction it moves');
  // ...and every record a test names must exist, or the mutant is run
  // against a file the runner cannot find.
  for (const f of files) {
    for (const r of JSON.parse(readFileSync(join(dir, f), 'utf8'))) {
      for (const t of r.tests) assert.ok(existsSync(join(ROOT, t)), `${f}::${r.name} names ${t}, which is not there`);
    }
  }
});
