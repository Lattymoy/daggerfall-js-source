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
// EMPTY, and it stays that way. The twelve records this sweep found stale
// on the day it was written were carried named-and-dated rather than
// re-aimed inside a quickslot change; two came back on the very next
// merge (ba1's, whose anchors main restored) and the other ten were
// re-aimed BY CONTENT the moment there was a pass whose subject they
// were. A record here is a law nobody checks, so the right size of this
// list is nought and the pin below asserts BOTH directions: nothing new
// may rot in, and nothing that applies again may linger.
const CARRIED = new Set([]);

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

// MUT-AIM (2026-09-23, the community arc's mutation rerun after JOURNAL1) -
// A RECORD WHOSE TEXT STANDS TWICE MUTATES WHICHEVER COPY COMES FIRST.
//
// `tools/mutate.mjs` replaces the FIRST occurrence of `old`. A record whose
// text stands at two sites in its file is aimed at whichever is higher up,
// and a copy added ABOVE the one it was written for takes its mutant
// without a word. The record still applies, so the sweep above passes it.
// The law it was written for is then checked by nothing, and a run notices
// only by luck: as a survivor when the copy it now hits is one its tests
// never reach, and not at all when they do reach it.
//
// MOD1-10 is how it was found. The chat's mute line was repeated by DICE1's
// roll arm below it and by JOURNAL1's page arm ABOVE it, so the record
// muted the page's check and survived. AUDIT4-A8 had been the same for a
// day: NOTICE-SPAM's repeat branch put the HUD line's exact text above the
// push branch the record was written for, and this arc had carried its
// survivor as older than the arc. AUDIT-F4 names the billboard's tint and
// mutated the flats'. All three are aimed now by a line only their own site has, and
// die. CHAT-CHAN's two sendChat records, which sendRoll's copy of the line
// followed, are aimed the same way. DICE1 gains the two records sendRoll's
// channel check never had.
//
// So every record names ONE site. THE CARRIED MAP is the records that
// already named more than one on the day this was written, each with its
// number of sites. A copy added anywhere, or one taken away, fails here
// too, because either can change which copy is first. Each is owed a
// re-aim BY CONTENT in its own arc's next pass. Two are known to need more
// than an aim:
// - el2's point guard is pinned by a regex over the whole shader, which the
//   other copy satisfies whichever one is mutated.
// - MAC-BUG-W5-13 is named for the pool's gate and mutates the drip's. Its
//   tests fail the old door only at place(), never at the drip, the
//   footprint or the pool.
// - The SEVENTH MERGE brought three of main's records that name two sites on main
//   itself (DISC13-A's two torch/flash lines, one per lit path; WEATHER3a's
//   birth gate, written twice in weatherMap.js). They are carried as they came,
//   for their authors to re-aim; the rule that nothing new joins stands for
//   this branch's own records.
// The map can only shrink.
const CARRIED_AIM = new Map([
  ['disc13.json::DISC13-A-world-hands-the-torch-the-stepped-feet', 2],
  ['disc13.json::DISC13-A-worldModes-hands-the-flash-the-stepped-feet', 2],
  ['weather3a.json::WEATHER3a-births-ignore-the-hour', 2],
  ['acc1d.json::ACC1d-12-a-signed-out-player-asks-anyway', 2],
  ['auditsoc.json::B9-any-tab-speaks-for-the-seat', 2],
  ['auditsoc.json::B8-panel-clock-never-ticks', 2],
  ['auditwod.json::WOD6-quickload-no-onload', 2],
  ['blood1.json::BLOOD1a-the-decal-pass-turns-the-depth-test-off', 3],
  ['blood1.json::BLOOD1a-the-mark-size-reads-a-second-copy-of-the-ladder', 2],
  ['blood1.json::BLOOD1b-the-flying-quads-are-rebuilt-every-frame', 2],
  ['blood1.json::BLOOD1b-the-quads-do-not-follow-the-chunks', 2],
  ['blood1.json::AUDIT-the-flight-builds-a-centre-list-every-frame', 2],
  ['box1.json::guild-popup-reads-per-draw', 2],
  ['box1.json::coven-reads-per-draw', 2],
  ['el2.json::glsl-point-off-dark', 2],
  ['el5.json::glsl-face-sign', 2],
  ['el5.json::storage-six-layers', 2],
  ['hcc.json::HCC-disabled-still-shows', 2],
  ['macbugw5.json::MAC-BUG-W5-13-the-pools-gate-still-asks-for-the-door-it-no-longer-knocks-on', 4],
  ['orl1.json::the-interior-hosts-FIRST-last-resort-skips-the-door', 2],
  ['perfsun.json::PERF-SUN1-the-sampler-stops-comparing-so-one-tap-really-is-one-texel', 2],
  ['perfsun.json::PERF-SUN1-the-sun-map-samples-NEAREST-so-a-single-tap-is-no-longer-a-2x2', 2],
  ['perfsun.json::PERF-SUN2-the-gate-drops-the-n-dot-L-half-so-every-wall-facing-away-still-pays', 3],
  ['perfsun.json::PERF-SUN2-the-gate-drops-the-uniform-half-so-dusk-and-night-still-pay', 3],
  ['perfsun.json::PERF-SUN2-the-gated-branch-answers-ONE-instead-of-zero-so-an-unlit-face-is-fully-lit', 3],
  ['perfsun.json::TREES1-the-terrain-pays-for-a-kernel-its-own-neighbours-already-give-it', 3],
  ['rr3b.json::RR3b-10-a-variant-block-with-no-file-is-cached-as-none', 2],
  ['soc1.json::S32-room-budget-missing', 2],
]);

test('MUT-AIM: every mutant record names ONE site - mutate.mjs takes the first copy of `old`, so a copy added above a record takes its mutant without a word', () => {
  const dir = join(ROOT, 'tools/mutants');
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  const cache = new Map();
  const read = (p) => {
    if (!cache.has(p)) cache.set(p, existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), 'utf8') : null);
    return cache.get(p);
  };
  const sites = (src, old) => {
    if (!old) return Infinity;   // an empty text stands at every position
    let n = 0;
    for (let i = src.indexOf(old); i !== -1; i = src.indexOf(old, i + 1)) n++;
    return n;
  };
  const twice = [];
  const moved = [];
  const fixed = [];
  const seen = new Set();
  let total = 0;
  for (const f of files) {
    for (const r of JSON.parse(readFileSync(join(dir, f), 'utf8'))) {
      total++;
      const src = read(r.file);
      if (src == null || !src.includes(r.old)) continue;   // stale: the sweep above names it
      const id = `${f}::${r.name}`;
      const n = sites(src, r.old);
      if (CARRIED_AIM.has(id)) {
        seen.add(id);
        if (n === 1) fixed.push(id);
        else if (n !== CARRIED_AIM.get(id)) moved.push(`${id}: ${CARRIED_AIM.get(id)} sites, now ${n}`);
      } else if (n > 1) twice.push(`${id}  ->  ${n} sites in ${r.file}`);
    }
  }
  assert.ok(total > 800, `the sweep really read the records (${total})`);
  assert.deepEqual(twice, [],
    'these records name more than one site, and mutate.mjs mutates the FIRST - aim each at ONE by content, with a line beside it that only its own site has');
  assert.deepEqual(moved, [],
    'a carried record\'s copies changed in number, so its first copy may no longer be the one it was written for - re-aim it by content and take it off CARRIED_AIM');
  assert.deepEqual(fixed, [],
    'these were carried as naming more than one site and now name one - take them off CARRIED_AIM, which is the only direction it moves');
  assert.deepEqual([...CARRIED_AIM.keys()].filter((id) => !seen.has(id)), [],
    'a carried record that is gone, or no longer applies, comes off CARRIED_AIM too');
});
