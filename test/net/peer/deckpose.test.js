// DECK-POSE (2026-10-23, the owner: "I notice with sailing. Players on board the ship jitter while sailing instead of
// staying put. Other players also slide when on board your ship/npc ships"). A player aboard a boat - a passenger on
// another's, or at their own helm, a booked passage's ship among them - was stood on her deck by the foes frame's `ab`
// alone (scenes/comeSailAway/comeSailAwayAboard.js glue): a word said at most five times a second (FOES_MS), only when it
// changed, kept to the full frames (once in two seconds) by a crowded cell's relay, and eased toward at CSA_ABOARD_EASE.
// Measured on the glue: a body walking a deck at 3 m/s was drawn lurching between 0.5 and 7.7 m/s five times a second,
// and slid on 0.4 s after it stopped (on the full frames alone, stood still, then ran 6 m at 33 m/s). Now the place
// rides every pose (net/wire.js validAboard, `ab` on the pose), the session plays it out with the walk it rides
// (net/online.js lerpPose, aboardAlong), and the glue stands the body where its drawn pose says.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeSocketClass } from '../../fakeSocket.mjs';
import { validPose, validAboard, slimPose, POSE_ABOARD_SLOTS, POSE_ABOARD_LOCAL_MAX, POSE_ABOARD_OWNER_MAX, PIXEL_UNITS, WORLD_CELL, POSE_TS_MOD } from '../../../src/net/wire.js';
import { OnlineSession, lerpPose, aboardAlong } from '../../../src/net/online.js';
import { createComeSailAwayAboard, validAboardWord, worldOf, localOf, CSA_ABOARD_LOCAL_MAX } from '../../../src/scenes/comeSailAway/comeSailAwayAboard.js';
import { CSA_WIRE_BOATS_MAX } from '../../../src/systems/comeSailAway/comeSailAwayWire.js';
import { quatAngleAxis } from '../../../src/world/quat.js';

const WORLD = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
const BASE = { x: 1, y: 2, z: 3, yaw: 0, pitch: 0 };

test('DECK-POSE THE DOOR: a pose carries its place aboard - `ab`, [owner, slot, x, y, z], the feet to the cm - kept on both of the relay\'s wires; out of any bound it is no place (never clamped) and the pose stands; ashore it is absent; the foes word\'s door is the same law (mutants: the field stripped; a bound off by one; the place unrounded)', () => {
  assert.deepEqual(validPose({ ...BASE, ab: ['ann-0001', 2, 1.234, -0.5, 3.456] }).ab, ['ann-0001', 2, 1.23, -0.5, 3.46], 'to the cm');
  assert.equal('ab' in validPose(BASE), false, 'ashore: absent, the bytes a pose always had');
  const atBounds = ['a'.repeat(POSE_ABOARD_OWNER_MAX), POSE_ABOARD_SLOTS - 1, POSE_ABOARD_LOCAL_MAX, -POSE_ABOARD_LOCAL_MAX, 0];
  assert.deepEqual(validPose({ ...BASE, ab: atBounds }).ab, atBounds, 'at every bound: a place');
  const bad = [
    [['ann', 2, 1, 2], 'four fields'], [['ann', 2, 1, 2, 3, 4], 'six'], [['', 2, 1, 2, 3], 'no owner'],
    [['a'.repeat(POSE_ABOARD_OWNER_MAX + 1), 2, 1, 2, 3], 'an owner past the bound'], [[7, 2, 1, 2, 3], 'an owner not a name'],
    [['ann', -1, 1, 2, 3], 'a place before the first'], [['ann', POSE_ABOARD_SLOTS, 1, 2, 3], 'a place past the word\'s boats'],
    [['ann', 1.5, 1, 2, 3], 'half a place'], [['ann', '1', 1, 2, 3], 'a place named'],
    [['ann', 2, POSE_ABOARD_LOCAL_MAX + 0.01, 2, 3], 'past the deck\'s bound'], [['ann', 2, 1, -POSE_ABOARD_LOCAL_MAX - 0.01, 3], 'under it'],
    [['ann', 2, 1, NaN, 3], 'NaN'], [['ann', 2, 1, 2, Infinity], 'Infinity'], [{ owner: 'ann' }, 'not a list'], [null, 'null'],
  ];
  for (const [ab, why] of bad) {
    const p = validPose({ ...BASE, ab });
    assert.ok(p, `${why}: the pose stands`);
    assert.equal('ab' in p, false, `${why}: no place aboard`);
    assert.equal(validAboardWord(ab), null, `${why}: nor through the foes word's door`);
  }
  assert.ok(Object.is(validAboard(['ann', 0, -0.001, 0, 0])[2], 0), 'never a -0 (a word compared by its bytes)');
  // SCALE5b: the second wire's slim pose keeps it whole
  const p = validPose({ ...BASE, ab: ['ann-0001', 3, 1.5, 4, -2] });
  assert.deepEqual(slimPose(p, 'world:3,12').ab, ['ann-0001', 3, 1.5, 4, -2]);
  // one law for the word and the pose: the foes word's door answers what the pose's does
  assert.deepEqual(validAboardWord(['ann', 2, 1.234, -0.5, 3.456]), { owner: 'ann', slot: 2, local: [1.23, -0.5, 3.46] });
  assert.equal(CSA_WIRE_BOATS_MAX, POSE_ABOARD_SLOTS);
  assert.equal(CSA_ABOARD_LOCAL_MAX, POSE_ABOARD_LOCAL_MAX);
});

test('DECK-POSE THE PLAY-OUT: between two poses on one deck the place is eased as the feet are; onto a deck, onto another (another owner or another of their boats) or from ashore the newer place whole; ashore none - and the drawn place is its own copy (mutants: the place dropped by lerpPose; taken whole on one deck; eased across two decks)', () => {
  const a = { ...BASE, ab: ['ann', 1, 0, 1, 0] };
  const b = { ...BASE, x: 9, ab: ['ann', 1, 2, 1, -4] };
  assert.deepEqual(lerpPose(a, b, 0.25).ab, ['ann', 1, 0.5, 1, -1], 'a quarter of the way along her deck');
  assert.deepEqual(lerpPose(a, b, 1).ab, b.ab);
  assert.notEqual(lerpPose(a, b, 1).ab, b.ab, 'a copy - the drawn place is never the pose\'s own list');
  assert.deepEqual(lerpPose(a, { ...b, ab: ['ann', 2, 2, 1, -4] }, 0.25).ab, ['ann', 2, 2, 1, -4], 'another of her boats: the newer whole');
  assert.deepEqual(lerpPose(a, { ...b, ab: ['bo', 1, 2, 1, -4] }, 0.25).ab, ['bo', 1, 2, 1, -4], 'another owner\'s: the newer whole');
  assert.deepEqual(lerpPose(BASE, b, 0.25).ab, b.ab, 'from ashore: the newer whole');
  assert.notEqual(lerpPose(BASE, b, 0.25).ab, b.ab, 'and its own copy there too');
  assert.equal('ab' in lerpPose(a, BASE, 0.25), false, 'ashore: none');
  assert.deepEqual(aboardAlong(undefined, b.ab, 0.5), b.ab);
});

/** Mac watching Eve walk a deck: a real session over a fake socket on a fake clock, ticked every 10 ms (a frame). Eve
 *  stands on a boat sailing +z at 6 m/s and walks her deck +x at 3 m/s for `walkMs`, then stands; each pose every 100 ms
 *  (POSE_HZ) carries her world feet and her place aboard (`deck` false: an older build's pose, none), reaching Mac
 *  40-90 ms after it was said, in order. Answers each frame's drawn place on Mac's copy of her boat - the glue's, over
 *  the session's drawn pose - in that boat's own frame, and the boat's pose each frame. `words` also hands the glue
 *  Eve's foes word as she says it (every FOES_MS, when it changed). */
function watchDeck({ deck = true, words = false, walkMs = 2000, totalMs = 3500 } = {}) {
  const { FakeWS, sockets } = fakeSocketClass();
  const clock = { now: 1_700_000_000_000 };
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => clock.now });
  const cellX = 25, cellZ = 15, U = PIXEL_UNITS;
  const origin = [(cellX * WORLD_CELL + 8) * U, 0, (cellZ * WORLD_CELL + 8) * U];
  const me = { x: origin[0], y: 0, z: origin[2], yaw: 0, pitch: 0, mv: 0 };
  s.join(`world:${cellX},${cellZ}`, me); sockets[0].open();
  const boatAt = (t) => ({ position: [origin[0], 0, origin[2] + 240 * (t / 1000)], rotation: quatAngleAxis(0, [0, 1, 0]) });   // 6 m/s at 40 units a metre
  const localAt = (t) => [0.5 + 3 * Math.min(t, walkMs) / 1000, 1.2, 2];
  // the boat's frame is in scene metres here, its root carried in units: one unit a metre for the glue's arithmetic
  const toWire = (p) => p;
  const feetAt = (t) => worldOf(boatAt(t), localAt(t));
  const f0 = feetAt(0);
  sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'eve-0003', name: 'Eve', look: null, pose: { ...me, x: f0[0], y: f0[1], z: f0[2], ...(deck ? { ab: ['ann', 0, ...localAt(0)] } : {}) } }], host: null, world: null });
  const aboard = createComeSailAwayAboard({ peers: { placeOf: () => null, shown: () => [] }, geometry: () => null, selfId: () => 'mac-0001' });
  let seed = 11;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const q = [];
  let tail = 0, lastWord = '';
  const drawn = [], poses = [];
  for (let t = 10; t <= totalMs; t += 10) {
    clock.now += 10;
    if (t % 100 === 0) {
      const f = feetAt(t);
      const p = { ...me, x: f[0], y: f[1], z: f[2], mv: t <= walkMs ? 1 : 0, ts: (5_000_000 + t) % POSE_TS_MOD, ...(deck ? { ab: ['ann', 0, ...localAt(t)] } : {}) };
      const at = Math.max(clock.now + 40 + rnd() * 50, tail); tail = at;
      q.push({ at, frame: { t: 'pose', id: 'eve-0003', p } });
    }
    if (words && t % 200 === 0) {
      const w = ['ann', 0, ...localAt(t).map((v) => Math.round(v * 100) / 100)], key = JSON.stringify(w);
      if (key !== lastWord) { lastWord = key; const at = clock.now + 40 + rnd() * 50; q.push({ at, word: w }); q.sort((a, b) => a.at - b.at); }
    }
    while (q.length && q[0].at <= clock.now) {
      const m = q.shift();
      if (m.frame) sockets[0].receive(m.frame); else aboard.applyRider('eve-0003', m.word, clock.now);
    }
    s.tick();
    const pose = boatAt(t);
    const [d] = aboard.glue(s.drawable(), { poseOf: (o, i) => (o === 'ann' && i === 0 ? pose : null), toWire, dt: 0.01 });
    drawn.push(d.shown.deckKey ? localOf(pose, [d.shown.x, d.shown.y, d.shown.z]) : null);
    poses.push(pose);
  }
  return { drawn, s };
}
/** The drawn pace across her deck each frame (m/s), from frame `from` to frame `to`. */
const paces = (drawn, from, to) => drawn.slice(from, to).map((p, i) => (p && drawn[from + i - 1] ? Math.hypot(p[0] - drawn[from + i - 1][0], p[2] - drawn[from + i - 1][2]) / 0.01 : null));

test('DECK-POSE ON THIS SCREEN: a player walking another\'s deck as it sails is drawn on that deck crossing it at her own even pace and standing where her walk stops - the place her drawn pose carries, played out by the session with her walk (the foes word alone lurched 0.5 to 7.7 m/s five times a second and slid on after the stop) (mutants: the session dropping the place; the place taken whole on one deck; the glue easing toward the word)', () => {
  const { drawn } = watchDeck({ deck: true, words: true });
  assert.ok(drawn.every(Boolean), 'on her deck every frame');
  // the walk, once the play-out has her (her first poses arrive by 90 ms; a cushion behind): 3 m/s and nothing else
  const walking = paces(drawn, 40, 180);
  const evenShare = (v) => v.filter((x) => Math.abs(x - 3) <= 0.6).length / v.length;
  assert.ok(evenShare(walking) >= 0.95 && Math.max(...walking) <= 3.6, `an even pace across the deck - ${(evenShare(walking) * 100).toFixed(0)}% of frames within a fifth of 3 m/s (a frame the play-out holds is its own law, on land as here), never past ${Math.max(...walking).toFixed(2)} m/s`);
  // the stop: her last place reached and held, no slide past it
  const end = [0.5 + 3 * 2, 1.2, 2];
  const last = drawn.at(-1);
  assert.ok(Math.hypot(last[0] - end[0], last[1] - end[1], last[2] - end[2]) < 0.011, `standing where her walk stopped (${last.map((v) => v.toFixed(3))})`);
  const settled = drawn.findIndex((p, i) => i > 200 && Math.abs(p[0] - end[0]) < 0.011);
  assert.ok(settled > 0 && settled <= 200 + 30, `stopped within a play-out's delay of her stop (frame ${settled})`);
  assert.ok(drawn.slice(settled).every((p) => Math.abs(p[0] - end[0]) < 0.011), 'and stands there');
  assert.ok(drawn.every((p) => Math.abs(p[1] - 1.2) < 1e-9 && Math.abs(p[2] - 2) < 1e-9), 'never off her line on the deck as the deck sails');
  // the measure the field report was: the foes word alone (an older sender) - the lurch the place on the pose ends
  const old = paces(watchDeck({ deck: false, words: true }).drawn, 60, 180).filter((v) => v != null);
  assert.ok(evenShare(old) < 0.5 && Math.max(...old) > 6, `the word alone lurches: ${(evenShare(old) * 100).toFixed(0)}% of frames near 3 m/s, ${Math.min(...old).toFixed(2)} to ${Math.max(...old).toFixed(2)} m/s`);
});

test('DECK-POSE THE GLUE: the drawn pose\'s place stands the body on that deck as drawn here, at once (no ease), with its pace\'s place; one whose poses have carried a place and is drawn without one is ashore though their last foes word said a deck; a sender whose poses never carry one (an older build, an older relay) is stood by the eased word as before; nothing drawn ashore is touched (mutants: the pose\'s place unread; the word trusted over a pose ashore; the word eased no longer)', () => {
  const aboard = createComeSailAwayAboard({ peers: { placeOf: () => null, shown: () => [] }, geometry: () => null, selfId: () => 'mac' });
  const deckPose = { position: [100, 5, -40], rotation: quatAngleAxis(90, [0, 1, 0]) };
  const host = { poseOf: (o, i) => (o === 'ann' && i === 1 ? deckPose : null), toWire: (p) => p, dt: 0.01 };
  // on the pose: stood at once where it says
  const at = [2, 1.5, -3];
  const [d] = aboard.glue([{ id: 'eve', shown: { x: 0, y: 0, z: 0, yaw: 0, ab: ['ann', 1, ...at] } }], host);
  const w = worldOf(deckPose, at);
  assert.deepEqual([d.shown.x, d.shown.y, d.shown.z], w, 'on her deck where the pose says, this frame');
  assert.deepEqual(d.shown.deck, at);
  assert.equal(d.shown.deckKey, 'ann:1');
  // a foes word still saying the deck, the pose saying ashore: ashore
  aboard.applyRider('eve', ['ann', 1, 9, 1.5, 9], 0);
  const ashore = { id: 'eve', shown: { x: 7, y: 0, z: 7, yaw: 0 } };
  const out = aboard.glue([ashore], host);
  assert.equal(out[0], ashore, 'her pose speaks for her: drawn as it came');
  // an older sender: the eased word, as before
  aboard.applyRider('old', ['ann', 1, 0, 1, 0], 0);
  aboard.applyRider('old', ['ann', 1, 4, 1, 0], 0);
  const [o1] = aboard.glue([{ id: 'old', shown: { x: 0, y: 0, z: 0, yaw: 0 } }], host);
  assert.ok(o1.shown.deck[0] > 0 && o1.shown.deck[0] < 0.5, `eased toward the word (${o1.shown.deck[0]})`);
  assert.equal(o1.shown.deckKey, 'ann:1');
  // gone from the room: forgotten with their word - one back under that id is heard by their word until their pose speaks
  aboard.sweepRiders(new Set(['old']), 0);
  aboard.applyRider('eve', ['ann', 1, 9, 1.5, 9], 0);
  assert.equal(aboard.glue([ashore], host)[0].shown.deckKey, 'ann:1', 'after a sweep, the word stands them again');
  aboard.glue([{ id: 'eve', shown: { x: 0, y: 0, z: 0, yaw: 0, ab: ['ann', 1, ...at] } }], host);
  // a clear forgets who spoke by their pose: the word is heard again
  aboard.clearRiders();
  aboard.applyRider('eve', ['ann', 1, 9, 1.5, 9], 0);
  assert.equal(aboard.glue([ashore], host)[0].shown.deckKey, 'ann:1', 'after a clear, the word stands her again until her pose speaks');
  // nothing aboard: the very list
  const none = [{ id: 'zed', shown: { x: 1, y: 2, z: 3, yaw: 0 } }];
  assert.equal(aboard.glue(none, host), none);
});

test('DECK-POSE THE SENDER: every pose I say carries my place aboard while the host names one, none ashore (net/online.js poseAboard); the world host hands it the one place its foes word says (world.js csaDeckWord) (mutants: the place never laid; the host\'s hook unset)', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  const clock = { now: 1_700_000_000_000 };
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => clock.now });
  const U = PIXEL_UNITS, me = { x: (25 * WORLD_CELL + 8) * U, y: 0, z: (15 * WORLD_CELL + 8) * U, yaw: 0, pitch: 0, mv: 0 };
  s.join('world:25,15', me); sockets[0].open();
  sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [], host: null, world: null });
  let place = ['ann', 1, 2, 1.5, -3];
  s.poseAboard = () => place;
  const said = () => sockets[0].sent.map((m) => JSON.parse(m)).filter((m) => m.t === 'pose').at(-1)?.p ?? null;
  clock.now += 500; s.sendPose({ ...me, x: me.x + 1 });
  assert.deepEqual(said().ab, ['ann', 1, 2, 1.5, -3], 'aboard: the place rides the pose');
  place = null;
  clock.now += 500; s.sendPose({ ...me, x: me.x + 2 });
  assert.equal('ab' in said(), false, 'ashore: none');
  assert.match(WORLD, /const csaDeckWord = \(\) => \(csaOn\(\) \? \(csaAboard\.word\(player\.pos\) \?\? csaHelmWord\(\) \?\? naval\?\.deckWord\?\.\(player\.pos\) \?\? null\) : null\);/);
  assert.match(WORLD, /online\.poseAboard = csaDeckWord;/);
});
