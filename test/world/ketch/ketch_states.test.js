// KETCH-LOOK KL3 (bible/11-Multiplayer/Sky-Ketch-Look.md "Her three states", "The shared kit", "The PVS"): ONE LAW UNDER
// EVERYTHING (world/ketch/ketchStates.js ketchStatesOf) read over a whole voyage sailed in a test (test/net/ketch/
// ketchSim.mjs - the director's own frames through the wire, folded as the page folds them): asleep until the engine is fed,
// awake from its waking, singing while the Warden's fight lives, awake again after its fall; the cells, the engine's
// appetite, the lift, the hazards, the ring, the song, each as the room says it - one kept record, nothing built a frame.
// And THE PVS: the groups each zone sees, held past its edge, both sides at an opening. tools/mutants/ketch_look_law.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ketchStatesOf, ketchStatesRecord, KT_SHIP, KT_LIFT_PART, KT_PVS, KT_PVS_DOORS, KT_PVS_DOOR_M, pvsGroupsAt, pvsViewOf } from '../../../src/world/ketch/ketchStates.js';
import { foldKetch, KT_EMPTY } from '../../../src/net/ketch/ketchLink.js';
import { KT_STAGE } from '../../../src/net/ketch/ketchLaw.js';
import { KT_LIFT, KT_LIFT_CYCLE, KT_HAMMER } from '../../../src/net/ketch/ketchDeck.js';
import { validKetchOut } from '../../../src/net/wire.js';
import { KT_CRADLE_BACK_MS } from '../../../src/net/ketch/ketchBrain.js';
import { sailWhole, T0 } from '../../net/ketch/ketchSim.mjs';

const whole = sailWhole(4);
/** The page of mem0 through the voyage: at each frame its folded state and the law's record, cloned. */
function walk() {
  let s = KT_EMPTY;
  const rec = ketchStatesRecord(), seen = [];
  for (const f of whole.frames) {
    if (f.to != null && f.to !== 'mem0') continue;
    const { now, to: _to, ...x } = f;
    s = foldKetch(s, validKetchOut(x), now);
    ketchStatesOf(s, now / 1000, now, { owed: 0 }, rec);
    seen.push({ now, s, ship: rec.ship, sg: rec.sg, appetite: rec.appetite, banked: rec.banked, need: rec.need, sockets: [...rec.sockets], cradles: [...rec.cradles], wakeAge: rec.wakeAge, liftRuns: rec.lift.runs, forksN: rec.forksN, res: [...rec.resonators], stun: rec.stunUntil, fell: rec.fellAt, secGone: [...rec.secGone], secWarn: [...rec.secWarn] });
  }
  return seen;
}
const seen = walk();

test('KETCH-LOOK KL3 HER THREE STATES OVER A WHOLE VOYAGE: asleep from the first word until the engine is fed, awake from its waking, singing from the Warden\'s opening while its fight lives, awake again after its fall - in that order, never back (mutants: awake from the hello; singing after the fall)', () => {
  const order = [];
  for (const x of seen) if (order.at(-1) !== x.ship) order.push(x.ship);
  assert.deepEqual(order, [KT_SHIP.asleep, KT_SHIP.awake, KT_SHIP.singing, KT_SHIP.awake]);
  for (const x of seen) {
    if (x.sg < KT_STAGE.sailwalk) assert.equal(x.ship, KT_SHIP.asleep, `asleep at stage ${x.sg}`);
    if (x.fell) assert.equal(x.ship, KT_SHIP.awake, 'awake after the fall');
    if (x.ship === KT_SHIP.singing) assert.ok(x.s.ws && x.now >= x.s.ws.op, 'singing only once the fight opens');
  }
});

test('KETCH-LOOK KL3 THE CELLS AND THE ENGINE AS THE ROOM SAYS THEM: every socket set is the room\'s, the appetite its banked over its need, rising one cell at a time to whole; a cradle taken refills over its wait; the waking\'s age from the Sailwalk\'s word; the lift runs from it (mutants: the appetite of the need alone; a taken cradle full)', () => {
  let last = 0, sawRefill = false;
  for (const x of seen) {
    if (x.s.cl) {
      assert.equal(x.sockets.reduce((a, v) => a + v, 0), x.s.cl.sk.filter(Boolean).length);
      assert.ok(Math.abs(x.appetite - (x.need > 0 ? x.banked / x.need : 0)) < 1e-12);
      assert.ok(x.appetite >= last - 1e-12, 'the appetite never falls');
      last = x.appetite;
      x.s.cl.cr.forEach((v, j) => assert.ok(Math.abs(x.cradles[j] - (v === 1 ? 1 : Math.max(0, Math.min(1, 1 - (v - x.now) / KT_CRADLE_BACK_MS)))) < 1e-6, `cradle ${j}: full, or refilling over its wait`));
      if (x.s.cl.cr.some((v) => v !== 1 && v > x.now + 1000)) sawRefill = true;
    }
    if (x.sg >= KT_STAGE.sailwalk) { assert.ok(x.wakeAge >= 0, 'the waking aged'); assert.ok(x.liftRuns); } else { assert.equal(x.wakeAge, -1); assert.equal(x.liftRuns, false); }
  }
  assert.equal(last, 1, 'fed whole');
  assert.ok(sawRefill, 'a cradle seen refilling');
});

test('KETCH-LOOK KL3 THE SONG AS THE ROOM SAYS IT: the resonators the fight\'s, a fork\'s health its share of the song\'s, a section gone from its moment to its return and warned before it, the stun, the fall (mutants: the forks unread; a section warned while gone)', () => {
  let sawSong = false, sawStun = false, sawGone = false, sawWarn = false;
  for (const x of seen) {
    const ws = x.s.ws;
    if (ws?.rs) assert.deepEqual(x.res, ws.rs.map((v) => (v ? 1 : 0)));
    if (ws?.fk) { sawSong = true; assert.equal(x.forksN, ws.fk.c.length); }
    if (ws?.su > x.now) { sawStun = true; assert.equal(x.stun, ws.su); }
    for (let k = 0; k < 8; k++) { if (x.secGone[k]) { sawGone = true; assert.equal(x.secWarn[k], 0, 'never warned while gone'); } if (x.secWarn[k] > 0) sawWarn = true; }
  }
  assert.ok(sawSong && sawStun, 'the Last Note sung and broken');
  assert.ok(sawGone || sawWarn || !seen.some((x) => x.s.ws?.sec?.length), 'the ring as said');
  assert.equal(seen.at(-1).fell, whole.V.fell.at);
});

test('KETCH-LOOK KL3 THE CLOCK\'S OWN: the lift through its round - at the foot, rising, at the top, falling - its gates open only where it stands; each hammer\'s share of its draw-up 0 at rest and climbing to its slam; nothing of a voyage not begun (mutants: the lift\'s part off its round)', () => {
  const V = { ...seen.find((x) => x.sg >= KT_STAGE.sailwalk).s };
  const r = ketchStatesRecord();
  const parts = [];
  for (let t = 0; t < KT_LIFT_CYCLE; t += 0.5) {
    ketchStatesOf(V, t, T0, null, r);
    if (parts.at(-1) !== r.lift.part) parts.push(r.lift.part);
    if (r.lift.gateHold) assert.ok(r.lift.y <= KT_LIFT.y0 + 0.05);
    if (r.lift.gateTop) assert.ok(r.lift.y >= KT_LIFT.y1 - 0.05);
  }
  assert.deepEqual(parts, [KT_LIFT_PART.foot, KT_LIFT_PART.rising, KT_LIFT_PART.top, KT_LIFT_PART.falling]);
  for (let t = 0; t < KT_HAMMER.cycle; t += 0.05) { ketchStatesOf(V, t, T0, null, r); assert.ok(r.hammers.every((v) => v >= 0 && v <= 1)); }
  ketchStatesOf(null, 10, T0, null, r);
  assert.equal(r.ship, KT_SHIP.asleep); assert.equal(r.n, -1); assert.equal(r.crew, 0); assert.equal(r.lift.runs, false);
});

test('KETCH-LOOK KL3 ONE KEPT RECORD: the record handed in is the record answered, every array its own, a frame after a frame', () => {
  const r = ketchStatesRecord(), arrays = [r.cradles, r.bcradles, r.sockets, r.loose, r.hammers, r.steam, r.arcs, r.secWarn, r.secGone, r.secBack, r.resonators, r.forks];
  for (const x of seen.slice(-50)) {
    assert.equal(ketchStatesOf(x.s, x.now / 1000, x.now, null, r), r);
    [r.cradles, r.bcradles, r.sockets, r.loose, r.hammers, r.steam, r.arcs, r.secWarn, r.secGone, r.secBack, r.resonators, r.forks].forEach((a, i) => assert.equal(a, arrays[i]));
  }
});

test('KETCH-LOOK THE PVS HOLDS NO ZONE OUT OF ITS OWN SIGHT: a view held past its edge, the zone the eye stands in seen with it - off the lift west into the hold with the decks\' view held, the hold and its gun deck drawn (AUDIT SHIP A2; mutants: the held view alone)', () => {
  const g = new Set();
  for (const p of [[2.5, -12, 58], [7, -12, 65]]) {   // beside the lift's tower (its door), and past its door's reach
    assert.equal(pvsGroupsAt(p, 'decks', g), 'decks', `the decks' view held at ${p}`);
    assert.ok(g.has('hold') && g.has('gundeck'), `${p}: ${[...g].join()}`);
  }
});

test('KETCH-LOOK KL3 THE PVS: each zone its view\'s groups - the decks never the gun deck\'s, below never the bridge\'s; held past its edge; both sides\' groups within an opening\'s reach (mutants: the hatch one-sided; no hold at the edge)', () => {
  const g = new Set();
  assert.equal(pvsGroupsAt([0, 0, 30], null, g), 'decks');
  assert.ok(g.has('decks') && !g.has('gundeck') && !g.has('hold') && !g.has('cabin'));
  assert.equal(pvsGroupsAt([0, -12, 100], null, g), 'below');
  assert.ok(g.has('hold') && g.has('gundeck') && !g.has('bridge') && !g.has('decks'));
  assert.equal(pvsGroupsAt([0, 0, 200], null, g), 'bridge');
  assert.ok(g.has('bridge') && !g.has('hold'));
  // the Watch hatch: within its reach both the decks' and below's
  const H = KT_PVS_DOORS[0].at;
  pvsGroupsAt([H[0], 0, H[2] - KT_PVS_DOOR_M + 1], null, g);
  assert.ok(g.has('decks') && g.has('gundeck'), 'both sides at the hatch');
  for (const v of Object.keys(KT_PVS)) assert.ok(KT_PVS[v].length > 0);
  assert.equal(pvsViewOf('waist'), 'decks'); assert.equal(pvsViewOf('hold'), 'below'); assert.equal(pvsViewOf(null), null);
  // held: a foot off the waist's floor onto nothing still the decks'; a step into the cabin's doorway still the bridge's,
  // and the cabin's once the bridge's floor is past the hold
  assert.equal(pvsGroupsAt([13.5, 0, 30], 'decks', g), 'decks');
  assert.equal(pvsGroupsAt([0, 0, 225], 'bridge', g), 'bridge', 'held at the edge');
  assert.equal(pvsGroupsAt([0, 0, 225], null, g), 'cabin', 'the cabin\'s, come to fresh');
  assert.equal(pvsGroupsAt([0, 0, 230], 'bridge', g), 'cabin', 'past the hold');
});
