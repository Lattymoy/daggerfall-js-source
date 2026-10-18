// AUDIT EG V (2026-10-15, the Elite Gates arc's fifth audit; bible/11-Multiplayer/Elite-Gates.md sections 9, 16.5, 22 and
// 27.7) - FIX GROUP A2, THE DIRECTOR'S RUN ON THE SCREEN. Findings pinned here:
//   L3-7   THE LAW PIN'S LOOK AND FIGHT - a circle's edge lines, streamers and mist, and the fight's hall, made again from the
//          breach's own halls once the room gives them (they were made once, from my own law's draw, and kept).
//   L3-12  THE DIGEST READ - the room's digest of the hall it stands in (`dg`) against my own draw of it: a hall my law drew
//          otherwise is asked of the room and the circle built from its bytes; the link keeps a digest only for its own hall.
//   L7-6   A REHEARSAL IS ONE LIFE ON THE SCREEN - its fall's card, the witness's line and the first-time lines say so.
// Fixtures from the producers: the halls from the law (egHallOf - another law's through its own `law`), the breach from the
// director (egBreachNew, egEnter, egStateOf, egFall) through the wire (validEgOut) into the link (foldEg, createEgLink), the
// screen's own modules (createEgLookDraw, createEgFight, createEgClient, ui/eliteGates/egSpireHud.js, ui/eliteGates/egBeats.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { validEgOut } from '../../../src/net/wire.js';
import { egHallOf, egCircleSpecs, egCircleOfHall, egSpecGive, egSpecForget, egSpecDigest, EG_SPEC, EG_SEALED_MS, EG_TEXT } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStateOf, egStageWord, egFall } from '../../../src/net/eliteGates/egBrain.js';
import { foldEg, createEgLink, EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { egCircleEdges } from '../../../src/world/eliteGates/egLook.js';
import { egFightFloors } from '../../../src/world/eliteGates/egTelegraph.js';
import { createEgLookDraw } from '../../../src/scenes/eliteGates/egLookDraw.js';
import { createEgFight } from '../../../src/scenes/eliteGates/egFight.js';
import { createEgClient, EG_LAW_TEXT } from '../../../src/scenes/eliteGates/egClient.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { egFallModel, egSpireHudModel, EG_FALL_SINK_MS, EG_FALL_TEXT } from '../../../src/ui/eliteGates/egSpireHud.js';
import { egBeatMemo, egBeatWatch } from '../../../src/ui/eliteGates/egBeats.js';

const T0 = 1_800_000_000_000, ME = 'acct-0', BID = '0123456789abcdef';
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const wire = (f) => { const { to: _to, ...rest } = f; const v = validEgOut(JSON.parse(JSON.stringify(rest))); assert.ok(v, `the wire refuses ${f.k}`); return v; };
/** The room's own bytes of hall `h` under spec law `law` - what its `spec` answer carries (net/eliteGates/egLaw.js egHallOf, drawn in that law). */
const roomHall = (seed, h, law) => JSON.parse(JSON.stringify(egHallOf(seed, h, 0, law)));
/** A breach of two on `seed` standing in hall `h` (stage `sg`), `rh` a Rehearsal. */
function breachAt(seed, h, { sg = 'arrive', rh = 0, egv = null } = {}) {
  const B = egBreachNew({ b: BID, ez: 'z'.repeat(20), s: ME, o: 'Mac', ew: 0, rh, seed, op: T0, co: [[ME, 'Mac', 1], ['acct-1', 'Ann', 2]], site: SITE, wg: [] });
  const t = T0 + EG_SEALED_MS + 60_000;
  for (const sub of [ME, 'acct-1']) assert.equal(egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 30, t), null);
  B.h = h; B.sg = sg; B.wk = t - 1000; B.hw = sg === 'trial' ? t - 1000 : 0; B.cnt = { left: 1_500_000, at: t - 1000 };
  if (egv != null) B.egv = egv;
  return { B, t };
}

// ── L3-7: THE LAW PIN'S LOOK AND FIGHT ──────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L3-7 THE LAW PIN\'S LOOK IS THE BREACH\'S OWN (section 22: "A client deployed ahead of the relay, or behind it, still draws the breach\'s own halls"): a circle\'s look made from my own law\'s draw is made again once the room has given its halls in the breach\'s law - THE EDGE LINE, the tracks, the Gust\'s streamers and the mist where the breach\'s platforms stand - and then kept while its halls are those (mutants: the look keyed on the circle alone)', () => {
  try {
    const look = createEgLookDraw();
    assert.equal(look.setCircle(1, 2, 0), true);
    const mine = look.state();
    assert.equal(mine.edges, egCircleEdges(1, 2, 0).edge.length / 6, 'my own law\'s draw');
    assert.equal(look.setCircle(1, 2, 0), false, 'kept');
    for (const sp of egCircleSpecs(1, 2, 0)) assert.equal(egSpecGive(roomHall(1, sp.h, EG_SPEC - 1)), true);
    const given = egCircleEdges(1, 2, 0);
    assert.equal(look.setCircle(1, 2, 0), true, 'made again from the halls given');
    assert.equal(look.state().edges, given.edge.length / 6);
    assert.notEqual(look.state().edges, mine.edges, 'the breach\'s law\'s edges, not mine');
    assert.equal(look.setCircle(1, 2, 0), false, 'and kept');
    look.release();
  } finally { egSpecForget(); }
});

test('AUDIT EG V L3-7 THE LAW PIN\'S FIGHT IS THE BREACH\'S OWN HALL (section 22): the fight\'s hall, read when the company stands in it - before the room\'s answer for a circle\'s first hall - is read again once the room gives that hall in the breach\'s law: its fight floors (a Deepway of seed 7, Hall 17: seven under my law, five under law 6) are the given hall\'s, in the same hall (mutants: the given hall never read)', () => {
  try {
    const OLD = 9;   // PIN MOVED (EG-PERFECT, spec law 10 - 2026-10-18: law 10 lays this Deepway's fight on seven floors as law 8 did - law 9's five part from it); PIN MOVED (AUDIT EG V, the merge of fix group F: spec law 8 lays this Deepway's floors as law 7 did - the law before them both, 6, still parts); PIN MOVED (THE ASCENT, LAW 9): law 9 lays this hall's fight on five floors, as law 6 did - law 8's seven part
    const { B, t } = breachAt(7, 17, { egv: OLD });
    const E = foldEg(EG_STATE_EMPTY, wire(egStateOf(B, t)), t);
    const fight = createEgFight({ link: { state: () => E, now: () => t }, now: () => t, me: () => ME });
    fight.frame();
    assert.equal(fight.state().hall, 17);
    assert.equal(fight.state().floors, egFightFloors(egHallOf(7, 17, 0)).length, 'drawn by my own law first');
    const old = roomHall(7, 17, OLD);
    assert.notEqual(egFightFloors(old).length, fight.state().floors, 'the two laws\' floors differ here');
    assert.equal(egSpecGive(old), true);
    fight.frame();
    assert.equal(fight.state().hall, 17);
    assert.equal(fight.state().floors, egFightFloors(old).length, 'the given hall\'s floors');
    fight.leave();
  } finally { egSpecForget(); }
});

// ── L3-12: THE DIGEST READ ──────────────────────────────────────────────────────────────────────────────────────────────
/** The breach client of a member (`acct-0`) of a breach of two (seed 77) in hall `h` under my own law, the mode machine's
 *  seams recorded (the step under the veil, the level entered, the asks sent). */
function inBreach(h) {
  let clock = T0 + EG_SEALED_MS + 60_000;
  const { B } = breachAt(77, h, { sg: 'trial' });
  const L = { sent: [], said: [], steps: 0, enter: [] };
  const entity = { level: 30, health: 80, maxHealth: 100, magicka: 10, maxMagicka: 50, fatigue: 0, stats: {}, items: [] };
  const player = { pos: realmToDungeon(0, 0, 0), height: 1.8, grounded: true, collider: { move: () => {} } };
  const st = { inside: true, circle: egCircleOfHall(h) };
  const modes = { get mode() { return st.inside ? 'dungeon' : 'exterior'; }, egHallBreach: () => (st.inside ? B.b : null), egHallCircle: () => (st.inside ? st.circle : null),
    egPlace: (at) => { player.pos = [...at]; return true; }, egLeave: () => { st.inside = false; return true; }, egHallReturn: () => null, dungeonCtx: { exitDoors: [] },
    stepThroughFire: async (go) => { L.steps++; return go(); }, enterEgHall: (r) => { L.enter.push(r); st.inside = true; st.circle = r.c; return true; },
    forceExitToExterior: () => { st.inside = false; }, egSwapDrop: () => {}, egBandsDown: () => 0, egPrebuild: () => 'building' };
  const online = { welcomes: 1, terminal: false, error: null, sendEg: (k, f = {}) => { L.sent.push({ k, ...f }); return true; } };
  const store = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => m.delete(k) }; })();
  const client = createEgClient({ modes: () => modes, online: () => online, hub: () => null, now: () => clock, entity, player, cam: { pos: [3, 1.6, 4], yaw: 0 },
    account: { me: () => ME, guest: () => false, keys: async () => ({ ok: false }) }, say: (t) => L.said.push(t), mid: () => {}, site: () => ({}), wire: () => null, landAt: () => true,
    hurt: () => {}, peers: () => [], store, renderer: null, startWindow: null, win: { innerWidth: 1280, innerHeight: 720, matchMedia: () => ({ matches: false }) } });
  const tell = (w) => client.word(wire(w));
  const spec = egHallOf(77, h, 0);
  player.pos = realmToDungeon(spec.x0 + spec.arrive.x, 0, spec.arrive.z);
  return { client, B, L, tell, step: (ms) => { clock += ms; }, now: () => clock };
}
const settle = () => new Promise((r) => setImmediate(r));

test('AUDIT EG V L3-12 THE DIGEST IS READ (section 9: "A client whose own spec disagrees asks {k:\'spec\'} and builds from the relay\'s bytes"): under the breach\'s own law, a hall whose room digest (`dg`) is my own draw\'s asks nothing; one the room digests otherwise has the five halls of its circle asked of the room - no word of another law said - and once they are given the circle is built again from them; a new hall\'s stage lets the last hall\'s digest go, so no hall is judged by another\'s (mutants: the digest never compared; a mismatch never kept for the breach; the link keeping the last hall\'s digest)', async () => {
  try {
    const P = inBreach(7);
    P.tell(egStateOf(P.B, P.now()));
    for (let k = 0; k < 3; k++) { P.step(500); P.client.frame(); }
    assert.equal(egStateOf(P.B, P.now()).dg, egSpecDigest(egHallOf(77, 7, 0)), 'the room\'s digest is my draw\'s');
    assert.deepEqual(P.L.sent.filter((w) => w.k === 'spec'), [], 'one law, one digest: nothing asked');
    // a new hall's stage, before its state: no hall judged by the last one's digest
    const sg = egStageWord({ ...P.B, h: 8 }, P.now());
    P.tell(sg);
    assert.equal(P.client.link.state().dg, 0, 'the last hall\'s digest let go');
    P.step(500); P.client.frame();
    assert.deepEqual(P.L.sent.filter((w) => w.k === 'spec'), [], 'still nothing asked');
    // the room's digest of hall 8 otherwise than mine
    P.B.h = 8;
    const st = egStateOf(P.B, P.now());
    P.tell({ ...st, dg: (st.dg + 1) >>> 0 });
    P.step(500); P.client.frame();
    assert.deepEqual(P.L.sent.filter((w) => w.k === 'spec').map((w) => w.h), [6, 7, 8, 9, 10], 'the circle\'s halls asked of the room');
    assert.ok(!P.L.said.includes(EG_LAW_TEXT), 'no word of another law');
    for (let h = 6; h <= 10; h++) P.tell({ k: 'spec', egv: EG_SPEC, h, sp: roomHall(77, h, EG_SPEC) });
    await settle();
    for (let k = 0; k < 4; k++) { P.step(500); P.client.frame(); await settle(); }
    assert.equal(P.L.enter.length, 1, 'built again from the room\'s bytes');
    // the breach is the room's for the rest: a later hall's digest that agrees asks nothing more of this circle
    P.tell(egStateOf(P.B, P.now()));
    const asked = P.L.sent.filter((w) => w.k === 'spec').length;
    P.step(500); P.client.frame();
    assert.equal(P.L.sent.filter((w) => w.k === 'spec').length, asked, 'the circle given: nothing asked again');
  } finally { egSpecForget(); }
});

// ── L7-6: A REHEARSAL IS ONE LIFE ON THE SCREEN ─────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L7-6 A REHEARSAL\'S FALL IS FINAL ON THE SCREEN (section 27.7: the Rehearsal\'s "one life"; section 16.5\'s card): a Rehearsal member\'s first fall reads *The Spire will not take you back.* on the FALLEN card, the witness\'s line promises no recall, and the first-time line *A Redoubt can call the fallen back once.* is not brought due; a keyed breach\'s first fall promises the recall as before (mutants: a Rehearsal\'s member entering with its recall)', () => {
  for (const rh of [1, 0]) {
    const { B, t } = breachAt(77, 2, { sg: 'trial', rh });
    const link = createEgLink({ now: () => t });
    link.word(wire(egStateOf(B, t)));
    const memo = egBeatMemo();
    egBeatWatch(memo, link.state(), ME);   // primed on the state before the fall
    const out = [];
    egFall(B, ME, t, out, { x: 0, z: 10 });
    for (const f of out) link.word(wire(f));
    const E = link.state(), fw = out.find((f) => f.k === 'fall');
    const card = egFallModel({ at: t, final: !!fw.fin, lost: 0 }, t + EG_FALL_SINK_MS + 10).card;
    const hud = egSpireHudModel(E, ME, t, { witness: true });
    const { firsts } = egBeatWatch(memo, E, ME);
    if (rh) {
      assert.equal(card.sub, EG_FALL_TEXT.final, 'a Rehearsal: the Spire will not take you back');
      assert.equal(hud.stage, `${EG_TEXT.fallen} Forsaking leaves for good.`, 'no recall promised');   // PIN MOVED (AUDIT EG V, the merge of fix groups C and A2: L7-20 words the witness's line for every input in hand)
      assert.ok(!firsts.includes('recall'), 'the recall\'s first-time line not brought due');
    } else {
      assert.equal(card.sub, EG_FALL_TEXT.first);
      assert.equal(hud.stage, 'You will be called back at Redoubt 1.');
      assert.ok(firsts.includes('recall'));
    }
  }
});
