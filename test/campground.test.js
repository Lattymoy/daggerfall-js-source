// CAMP-GROUND (2026-09-22, Mac: "Did you tackle camping not working in
// the world because of flat tarren?") - THE PROBE ASKED THE WRONG DOOR.
//
// DragynDance reported camping kits that "don't work for me". The
// silent refusal was one half (CAMP-SILENT); this is the other, and it
// is the one that made camping impossible rather than merely mute.
//
// `collider.raycast` walks the TRIANGLE BUCKETS alone. Outside, the
// ground is not a mesh - it is `heightAt`, the terrain sampler applied
// to the capsule and nowhere else. So a ray cast straight down from a
// player standing in open country hits NOTHING, `campSpot` answered a
// null ground, and `campDecision` refused with "There is no level
// ground here" - on the flattest meadow in the Iliac Bay, everywhere
// outdoors, for every kit.
//
// THE DOOR THAT FIXES IT IS TWO DAYS OLD AND WAS BUILT FOR THE SAME
// MISTAKE: `surfaceHit` (MAC-BUG W5, Mac: "blood doesn't work
// outside"). Its own note names this caller without knowing it - "a
// caller that reads 'nothing' as 'no surface' is right indoors and
// silently wrong in the whole outdoors". Blood was moved onto it and
// camping was not, which is why this pin holds the CLASS and not just
// the one call site.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { campSpot, campDecision, CAMP_KIND, CAMP_TEXT, GROUND_PROBE } from '../src/systems/survival/camp.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FEET = [100, 20, 100];

/** A collider outdoors: buckets hold nothing, the terrain is a height. */
const meshOnlyProbe = () => Infinity;                       // raycast: no triangle under an open field
const terrainAwareProbe = (o) => o[1] - 20;                 // surfaceHit: the ground is at y=20

test('CAMP-GROUND: a mesh-only probe finds no ground outdoors, and that is what refused every camp', () => {
  const spot = campSpot(FEET, 0, meshOnlyProbe);
  assert.equal(spot.ground, null, 'nothing under an open field, because the field is not a mesh');
  const d = campDecision(CAMP_KIND.Fire, { ground: spot.ground });
  assert.equal(d.ok, false);
  assert.equal(d.text, CAMP_TEXT.noGround, 'the message players were getting, on flat ground');
});

test('CAMP-GROUND: the terrain-aware probe finds it, and the camp stands', () => {
  const spot = campSpot(FEET, 0, terrainAwareProbe);
  assert.ok(Number.isFinite(spot.ground), 'the terrain answers');
  assert.equal(spot.ground, 20, 'at the sampler height');
  assert.equal(campDecision(CAMP_KIND.Fire, { ground: spot.ground }).ok, true, 'and a fire may be lit');
  assert.equal(campDecision(CAMP_KIND.Tent, { ground: spot.ground }).ok, true, 'and a tent pitched');

  // The spot is still ahead of the feet, on the ground it found - the
  // fix changes WHICH surface is consulted, not where the camp goes.
  assert.equal(spot.pos[1], 20);
  assert.notDeepEqual([spot.pos[0], spot.pos[2]], [FEET[0], FEET[2]], 'placed ahead, as before');
});

test('CAMP-GROUND: too far down is still no ground - the fix does not make every spot campable', () => {
  // A cliff edge: the surface is further than the probe reaches.
  // (a DISTANCE beyond the probe's reach, which is what a real probe
  // answers - the first draft of this line returned a HEIGHT and so
  // handed campSpot a negative distance, which is not a thing any
  // collider produces: surfaceHit guards `!(d >= 0)` itself.)
  const farBelow = () => GROUND_PROBE + 50;
  const spot = campSpot(FEET, 0, farBelow);
  assert.equal(spot.ground, null, 'past the probe is past the probe, terrain or not');
  assert.equal(campDecision(CAMP_KIND.Fire, { ground: spot.ground }).text, CAMP_TEXT.noGround);
});

test('CAMP-GROUND: the host wires the door that sees terrain, and falls back rather than losing the probe', () => {
  const src = readFileSync(join(ROOT, 'src/scenes/camps.js'), 'utf8');
  assert.match(src, /col\?\.surfaceHit \? \(o, d, m\) => col\.surfaceHit\(o, d, m\)\.dist/,
    'the probe asks surfaceHit, which answers mesh OR terrain, whichever is nearer');
  // A collider without the newer door still gets the old one rather
  // than null, which would be a silent "no ground" for every host that
  // has not caught up.
  assert.match(src, /: \(col\?\.raycast \? \(o, d, m\) => col\.raycast\(o, d, m\) : null\)/,
    'and an older collider keeps the bucket probe');

  // THE CLASS, not the call site: blood was moved onto surfaceHit for
  // this exact reason two days earlier. Both outdoor placers use it now.
  const marks = readFileSync(join(ROOT, 'src/combat/bloodMarks.js'), 'utf8');
  assert.match(marks, /surfaceHit/, 'blood asks the same door (MAC-BUG W5)');
});

// ── NOTICE-SPAM: A TOAST SYSTEM DOES NOT SAY THE SAME LINE TWICE ──
//
// Mac: "the enhanced notification spam". DragynDance had a column of
// the same line over and over while a deathloop turned under him.
//
// The classic column SCROLLS, so a repeat there costs a row and goes
// by; the enhanced skin draws a PLATE per row (ENH-NOTICE3), so ten
// copies of one line are ten plates stacked up the screen and nothing
// else can be read. DEATHLOOP2 closed the loop that was producing
// them; this closes the ring that was willing to draw them.
test('NOTICE-SPAM: an immediate repeat refreshes the row it would have duplicated', async () => {
  const { HudText } = await import('../src/ui/hudText.js');
  const h = new HudText();

  h.add('You are freezing.');
  h.add('You are freezing.');
  h.add('You are freezing.');
  assert.equal(h.frame().rows.length, 1, 'one plate, not three');
  assert.deepEqual(h.frame().rows, ['You are freezing.']);

  // ...and the row is still there: a collapse must not swallow the
  // message, only the copies.
  assert.ok(h.lines.length === 1 && h.lines[0].text === 'You are freezing.');

  // THE ROW KEEPS ITS IDENTITY. ENH-NOTICE3 draws a plate per row and
  // tracks it by `id` across frames, so a collapse that destroyed the
  // row and pushed a fresh one would make the plate flicker out and
  // back on every repeat - a different spam, from the same cause. The
  // repeat REFRESHES the row it matched; it does not replace it.
  const h2 = new HudText();
  h2.add('You are freezing.');
  const firstId = h2.frame().ids[0];
  h2.add('You are freezing.');
  assert.equal(h2.frame().ids[0], firstId, 'the same plate, refreshed - not a new one');
  assert.equal(h2.lines.length, 1);

  // and the dwell is extended rather than left to run out under the
  // repeat, which is the whole point of refreshing it
  const h3 = new HudText();
  h3.add('Burning.', 1);
  h3.tick(0.9);
  const before = h3.timer;
  h3.add('Burning.', 4);
  assert.ok(h3.timer > before, 'a repeat buys the row more time on screen');
});

test('NOTICE-SPAM: only the IMMEDIATE repeat collapses - two real events both stand', async () => {
  const { HudText } = await import('../src/ui/hudText.js');
  const h = new HudText();

  // "You are hit" twice with something between them is two blows, and
  // a player who cannot see the second one has lost information. Only
  // the back of the queue is compared, on purpose.
  h.add('You are hit.');
  h.add('The rat bites you.');
  h.add('You are hit.');
  assert.deepEqual(h.frame().rows, ['You are hit.', 'The rat bites you.', 'You are hit.'],
    'a repeat with another line between it is two events, not spam');

  // and the empty-row gate from INFO1 still stands in front of all of it
  const before = h.lines.length;
  h.add('');
  h.add('   ');
  assert.equal(h.lines.length, before, 'a nameless row is still no row');
});
