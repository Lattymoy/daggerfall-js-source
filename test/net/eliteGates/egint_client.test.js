// EG-H1 (EG8d, 2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 21, 10.8, 13.2 and
// 15): WHAT THE RELAY JUDGES, THIS SCREEN'S HALF (scenes/eliteGates/egClient.js, scenes/eliteGates/egFight.js, net/eliteGates/egLink.js, net/online.js) - the
// shared clock corrected (the room's `clk` pinged, its median taken, the breach's link and fight on it, the delay said with
// each ping), the relay's count's fall of me (`bd` - in the Spire a fall, never a death), my body in my own word (`vt` at
// INT15's pace), RIDDEN POSES (my `pl` on a moving piece; a peer drawn on its piece at my clock), Watchfire's early outline
// (`tell`, `untell`) and a blow's WIND only past FEINT_AT, uncut.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEgClient, EG_COUNT_FELL_TEXT } from '../../../src/scenes/eliteGates/egClient.js';
import { createEgFight, EG_WIND_GRACE_MS } from '../../../src/scenes/eliteGates/egFight.js';
import { foldEg, egBodyOf, EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { egBreachNew, egEnter, egStateOf } from '../../../src/net/eliteGates/egBrain.js';
import { egHallOf, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { EG_FEINT_AT } from '../../../src/net/eliteGates/egBodies.js';
import { egPieceAt } from '../../../src/net/eliteGates/egSpanLaw.js';
import { validEgOut, validPose } from '../../../src/net/wire.js';
import { realmToDungeon, dungeonToRealm } from '../../../src/net/superDungeon/sdBrain.js';
import { egClockHalfRtt } from '../../../src/net/eliteGates/egClock.js';
import { BODY_SAY_MS } from '../../../src/net/bossBody.js';
import { hostCue } from '../../../src/world/gate/gateBoss.js';

const T0 = 1_800_000_000_000;
const ME = 'acct-0';
const SEED = 12345;

/** A client inside a breach of two at hall `h`'s trial (a span's, by default), its words the director's own - with this
 *  machine's wall clock held (`wall`). */
function inBreach({ h = 2 } = {}) {
  const realNow = Date.now;
  let clock = T0 + EG_SEALED_MS + 60_000, wall = clock - 4000;
  Date.now = () => wall;
  const co = [[ME, 'Mac', 1], ['acct-1', 'Ann', 2]];
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: ME, o: 'Mac', ew: 0, rh: 0, seed: SEED, op: T0, co, site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 30, clock);
  B.h = h; B.sg = 'trial'; B.wk = clock - 1000; B.cnt = { left: 1_500_000, at: clock - 1000 };
  const sent = [], mids = [];
  const entity = { level: 30, health: 80, maxHealth: 100, magicka: 10, maxMagicka: 50, fatigue: 0, stats: {}, items: [] };
  const player = { pos: realmToDungeon(0, 0, 0), height: 1.8, grounded: true, jumping: false, freezeMotor: 0, collider: { move: () => {} } };
  let inSpire = true;
  const modes = { mode: 'dungeon', egHallBreach: () => (inSpire ? B.b : null), egHallCircle: () => 1, egPlace: (at) => { player.pos = [...at]; return true; }, egLeave: () => true, egHallReturn: () => null, dungeonCtx: { exitDoors: [] } };
  const online = { welcomes: 1, terminal: false, poseRide: null, rideAt: null, sendEg: (k, f = {}) => { sent.push({ k, ...f }); return true; } };
  const client = createEgClient({ modes: () => modes, online: () => online, hub: () => null, account: { me: () => ME, guest: () => false, keys: async () => ({ ok: false }) }, now: () => clock, entity, player, cam: { pos: [0, 0, 0] },
    say: () => {}, mid: (t) => mids.push(t), site: () => ({}), wire: () => null, landAt: () => true, hurt: () => {} });
  const tell = (w) => { const v = validEgOut(JSON.parse(JSON.stringify(w))); assert.ok(v, `the wire refuses ${w.k}`); client.word(v); };
  tell(egStateOf(B, clock));
  const spec = egHallOf(SEED, h, 0);
  player.pos = realmToDungeon(spec.x0 + spec.arrive.x, 0, spec.arrive.z);
  return { client, B, entity, player, online, sent, mids, tell, spec, step: (ms) => { clock += ms; wall += ms; }, now: () => clock, wall: () => wall, leave: () => { inSpire = false; }, done: () => { Date.now = realNow; } };
}

test('EG-H1 THE SHARED CLOCK CORRECTED, ON THIS SCREEN (section 10.8): in the Spire the client pings the room (`clk`) in a burst, folds each answer, and once it has one reads the relay\'s clock as this machine\'s plus their median - the breach\'s link, its fight and every time it keeps on it; each ping says the one-way delay it measured, so the room places my poses at the instant I sent them; before an answer, the host\'s clock (mutants: the answer never folded; the link on the host\'s clock; no delay said)', () => {
  const P = inBreach();
  try {
    const { client, sent, step } = P;
    assert.equal(client.clockOffset(), null, 'no answer yet');
    assert.equal(client.sharedNow(), P.now(), 'the host\'s clock until then');
    const skew = 5000, oneWay = 100;
    for (let k = 0; k < 12; k++) {
      client.frame();
      for (const w of sent.splice(0).filter((x) => x.k === 'clk')) {
        const relayAt = P.wall() + oneWay + skew;   // the room answers as the ping reaches it
        step(2 * oneWay);
        client.word({ k: 'clk', c: w.c, now: relayAt });
      }
      step(250);
    }
    assert.ok(Math.abs(client.clockOffset() - skew) <= 1, `the offset is the relay's (${client.clockOffset()})`);
    assert.ok(Math.abs(client.sharedNow() - (P.wall() + skew)) <= 1, 'the shared clock is the corrected one');
    assert.equal(client.link.now(), client.sharedNow(), 'the breach\'s link reads it');
    client.frame();
    step(30_000); client.frame();
    const ping = sent.find((x) => x.k === 'clk');
    assert.ok(ping && ping.h === oneWay, `the next burst says its delay (${ping?.h})`);
    const fight = createEgFight({ link: client.link, now: () => 0 });
    assert.equal(fight.countText(1000), '0:01');
    void egClockHalfRtt;
  } finally { P.done(); }
});

test('EG-H1 THE RELAY\'S COUNT\'S FALL OF ME (`bd`, section 21 - the Hour\'s bossCountFell\'s twin): in the Spire a fall, never a death - its words said, the witness begun, nothing said back (the room made it the breach\'s fall); heard outside the Spire, nothing (mutants: a death screen; the room told twice; a fall outside the Spire)', () => {
  const P = inBreach();
  try {
    const { client, sent, mids } = P;
    P.tell({ k: 'bd' });
    assert.ok(mids.includes(EG_COUNT_FELL_TEXT), 'its words');
    assert.equal(client.witnessing(), true, 'the witness begins');
    assert.equal(sent.filter((w) => w.k === 'fell').length, 0, 'nothing said back');
    assert.ok(P.entity.health >= 1, 'no death');
    P.tell({ k: 'bd' });
    assert.equal(mids.filter((t) => t === EG_COUNT_FELL_TEXT).length, 1, 'once');
  } finally { P.done(); }
  const Q = inBreach();
  try {
    Q.leave();
    Q.tell({ k: 'bd' });
    assert.equal(Q.client.witnessing(), false, 'outside the Spire, nothing');
  } finally { Q.done(); }
});

test('EG-H1 MY BODY IN MY OWN WORD (`vt` - net/bossBody.js bodySayer, INT15\'s pace): in the Spire, admitted and alive, the client says its body\'s share in thousandths - at once when it moves, never faster than BODY_SAY_MS; a witness says nothing (mutants: the word never said; said every frame; said by a witness)', () => {
  const P = inBreach();
  try {
    const { client, sent, entity, step } = P;
    client.frame();
    assert.deepEqual(sent.filter((w) => w.k === 'vt').map((w) => w.v), [800]);
    entity.health = 60; client.frame();
    assert.equal(sent.filter((w) => w.k === 'vt').length, 1, 'never faster than its pace');
    step(BODY_SAY_MS); client.frame();
    assert.deepEqual(sent.filter((w) => w.k === 'vt').map((w) => w.v), [800, 600]);
    client.fallSave();
    step(BODY_SAY_MS); entity.health = 30; client.frame();
    assert.equal(sent.filter((w) => w.k === 'vt').length, 2, 'a witness says nothing');
  } finally { P.done(); }
});

test('EG-H1 RIDDEN POSES ON THIS SCREEN (section 10.8): standing on a moving piece my pose carries its `pl` (net/online.js lays it on each pose through `poseRide`), off one nothing; a peer\'s ridden pose is drawn on its piece at my shared clock plus its offset (`rideAt` on the peer\'s drawn place), a peer in another hall left alone; the presence link\'s two hooks set in the Spire and taken away outside it (mutants: the ride never said; a peer drawn at its raw pose; the hooks left on)', () => {
  const P = inBreach();
  try {
    const { client, player, online, spec } = P;
    // PIN MOVED (EG-PERFECT's audit, 2026-10-18): the hall's first Drift, not its first piece - spec law 10 breaks the bridge
    // before its spans, so its first piece is a still slab of that break
    const s0 = spec.steps.find((s) => s.kind === 'drift'), tS = P.now() / 1000, q = egPieceAt(s0, tS);
    player.pos = realmToDungeon(spec.x0 + s0.x + q.dx + 0.5, s0.y, s0.z + q.dz);
    client.frame();
    assert.equal(typeof online.poseRide, 'function', 'the hook set in the Spire');
    const pl = online.poseRide();
    assert.deepEqual(pl, [s0.i, 0.5, 0, 0], 'on the Drift: its index and my offset from its top');
    assert.ok(validPose({ x: 1, y: 0, z: 1, yaw: 0, pitch: 0, pl }).pl, 'the wire carries it');
    player.pos = realmToDungeon(spec.x0 + spec.arrive.x, 0, spec.arrive.z);
    assert.equal(online.poseRide(), null, 'on the plate: no ride');
    // a peer riding: drawn at the piece's place on MY clock plus its offset, whatever its raw place said
    const peer = { ...poseOf(spec, 30, s0.z), pl: [s0.i, -0.4, 0, 0.2] };
    online.rideAt(peer);
    const [sx, , sz] = dungeonToRealm(peer.x, peer.y, peer.z), qn = egPieceAt(s0, P.now() / 1000);
    assert.ok(Math.abs(sx - spec.x0 - (s0.x + qn.dx - 0.4)) < 1e-6 && Math.abs(sz - (s0.z + 0.2)) < 1e-6, 'drawn on its piece');
    const away = { ...poseOf(egHallOf(SEED, 3, 0), 0, 10), pl: [0, 0, 0, 0] }, before = { ...away };
    online.rideAt(away);
    assert.deepEqual([away.x, away.z], [before.x, before.z], 'a peer in another hall is left where it is');
    P.leave(); client.frame();
    assert.equal(online.poseRide, null, 'outside the Spire, the hooks gone');
    assert.equal(online.rideAt, null);
  } finally { P.done(); }
  // net/online.js: the pose laid with the ride, and the peer's drawn place moved onto it (the hooks' other ends)
  const O = readFileSync(new URL('../../../src/net/online.js', import.meta.url), 'utf8');
  // PIN MOVED (DECK-POSE, test/net/peer/deckpose.test.js): and a place aboard a boat beside it, through its own hook
  // PIN MOVED (AUDIT WORLD-EVENTS L1-4): and a body lying down for a raise says where it lies, still, dying - no ride
  assert.match(O, /const pl = this\.poseRide\?\.\(\) \?\? null;[^\n]*\n\s*const ab = this\.poseAboard\?\.\(\) \?\? null;[^\n]*\n\s*const dn = this\.poseDown\?\.\(\) \?\? null;[^\n]*\n\s*const out = \{ \.\.\.pose, \.\.\.\(dn \? \{ x: dn\[0\], y: dn\[1\], z: dn\[2\], mv: 0, dd: 1 \} : \{\}\), \.\.\.\(pl && !dn \? \{ pl \} : \{\}\), \.\.\.\(ab \? \{ ab \} : \{\}\), ts: this\._stampTs\(\) \};/, 'sendPose lays the ride on the pose');
  assert.match(O, /if \(s\.pl && this\.rideAt\) \{ const r = \{ \.\.\.s \}; this\.rideAt\(r\); p\.shown = r; \}/, 'the peer walk draws a ride on its piece');
});
/** A Spire-frame point (hall `spec`'s own x) as a pose in the dungeon's frame. */
function poseOf(spec, x, z, y = 0) { const [px, py, pz] = realmToDungeon(spec.x0 + x, y, z); return { x: px, y: py, z: pz, yaw: 0, pitch: 0 }; }

test('EG-H1 WATCHFIRE\'S EARLY OUTLINE AND A BLOW\'S WIND (sections 15 and 13.2): a `tell` folds into the fight\'s told blows until its `eb` or its `untell` takes it off (a new hall\'s fight forgets them); the fight draws each told blow as an outline from its lead; a blow\'s WIND sounds once it is past FEINT_AT of its wind-up and still uncut - a feint, cut at FEINT_AT, never glints in the ear (mutants: the tell never folded; the untell ignored; the WIND at the wind-up\'s start; a cut blow\'s WIND)', async () => {
  const now = T0;
  const blow = { i: 5, o: 1, s: [['d', 0, 30, 3]], at: now + 1400, wu: 1000, p: 0.3, b: 0, el: null, nm: 'Cleave', ch: 0, pu: 0, sp: 0 };
  let s = foldEg({ ...EG_STATE_EMPTY, h: 1 }, validEgOut({ k: 'efs', h: 1, wk: now, b: [], bl: [], tx: [], mk: [], pg: {} }), now);
  s = foldEg(s, validEgOut({ k: 'tell', ...blow, sh: 350 }), now);
  assert.deepEqual(s.fight.told.map((b) => [b.i, b.sh]), [[5, 350]], 'told');
  assert.deepEqual(foldEg(s, validEgOut({ k: 'untell', i: 5 }), now).fight.told, [], 'untold');
  const said = foldEg(s, validEgOut({ k: 'eb', ...blow }), now);
  assert.deepEqual([said.fight.told.length, said.fight.blows.length], [0, 1], 'its word takes the outline over');
  assert.deepEqual(foldEg(s, validEgOut({ k: 'efs', h: 2, wk: now, b: [], bl: [], tx: [], mk: [], pg: {} }), now).fight.told, [], 'a new hall forgets them');
  // the fight: a lord winding a blow up, its outline told; the WIND past FEINT_AT
  const spec = egHallOf(SEED, 1, 0);
  let t = now + 100;   // inside the told blow's lead: from its wind-up less its lead shown, until its landing
  const lord = egBodyOf([1, 0, 13, 0, 0, 28, 900, 1000, 0, 0, 28, 0, 0], now);
  const E = { b: '0123456789abcdef', h: 1, sg: 'trial', seed: SEED, geo: 0, end: null, hw: now - 5000, fight: { ...s.fight, bodies: [lord], blows: [] } };
  const calls = [];
  const audio = { play3d: (clip, at, vol, o) => calls.push([clip, vol, o.pitch]), play3dId: () => {} };
  const renderer = { createBillboardBatch: (archive, record, size) => ({ archive, record, size, origin: [0, 0, 0], bounds: [0, 0, 0, 0] }), destroyBillboardBatch: () => {} };
  const getTexture = async () => ({ getSize: () => ({ width: 40, height: 70 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 1 });
  const fight = createEgFight({ renderer, getTexture, audio, link: { state: () => E }, now: () => t, feet: () => realmToDungeon(spec.x0, 0, 60), player: () => ({ health: 100, maxHealth: 100 }), me: () => ME });
  fight.frame(); await new Promise((r) => setTimeout(r, 0));
  fight.frame();
  const drawnTold = fight.state().shapes;
  E.fight = { ...E.fight, told: [] };
  fight.frame();
  assert.ok(drawnTold > fight.state().shapes, 'the told blow drawn as its outline');
  const cue = hostCue('windup', 0), wind = () => calls.filter((c) => c[1] === cue.volume && c[2] === cue.pitch).length;   // the wind-up's cue (world/gate/gateBoss.js hostCue - volume and pitch its own)
  E.fight = { ...E.fight, blows: [blow] };
  const from = blow.at - blow.wu;
  t = from + 0.3 * blow.wu; fight.frame();
  assert.equal(wind(), 0, 'no WIND before FEINT_AT');
  t = from + EG_FEINT_AT * blow.wu + EG_WIND_GRACE_MS; fight.frame();
  assert.equal(wind(), 1, 'the WIND past FEINT_AT, uncut');
  const feint = { ...blow, i: 6, cut: from + EG_FEINT_AT * blow.wu };
  E.fight = { ...E.fight, blows: [feint] };
  t = from + 0.8 * blow.wu; fight.frame();
  assert.equal(wind(), 1, 'a feint, cut, never glints in the ear');
});
