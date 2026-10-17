// AUDIT EG III (2026-10-13; bible/11-Multiplayer/Elite-Gates.md sections 17.1 and 17.2, lane1 #5's client halves): A SPIRE
// TONIC DRUNK, AND LONG STEP ON MY CRUMBLES. The Tonic the Sutler sells and the caches give was held and never drunk: now
// `/breach tonic` says the word (net/wire.js `tonic`), the room spends one of the run's and heals its member 25% through its
// one heal word (net/eliteGates/egBrain.js egWord - `eheal`, counted by the census, egCountHeals), and the member's screen restores the
// same share of magicka. Long Step's word to its user (`egot` `longstep`) gave a line and nothing more: now my crumbles wait
// half a second more for one span (systems/eliteGates/spireVestiges.js spireCrumbleWait, the holder's `ls`). Fixtures the producers':
// the breach from the director (egBreachNew, egEnter, egStateOf, egWord through the wire), the census its own.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { validEgIn, validEgOut, EG_KINDS } from '../../../src/net/wire.js';
import { egHallOf, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { EG_CRUMBLE_KINDS } from '../../../src/net/eliteGates/egSpanLaw.js';
import { egBreachNew, egEnter, egStateOf, egWord, egCountHeals } from '../../../src/net/eliteGates/egBrain.js';
import { egRunOf, EG_TONIC_MAX } from '../../../src/net/eliteGates/egRun.js';
import { bodyStruck } from '../../../src/net/bossBody.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { createEgClient, EG_TONIC_TEXT, EG_LONG_STEP_LOOK } from '../../../src/scenes/eliteGates/egClient.js';
import { spireCrumbleWait, spireHeld, EG_LONG_STEP_S, _resetSpireVestigesForTests } from '../../../src/systems/eliteGates/spireVestiges.js';
import { EG_VESTIGES } from '../../../src/net/eliteGates/egVestige.js';
import { egGive8 } from '../../egGive8.mjs';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins were written on spec law 8's ground (its courses along +z
// from the plate, its courts and its lords where law 8 lays them) and stand on it still - the halls they read are law 8's,
// given as a breach of law 8's are given to a client (test/egGive8.mjs); LAW 9's own ground is test/net/eliteGates/law9_height.test.js's and
// test/net/eliteGates/law9_rooms.test.js's. Given before every test (a client that leaves its breach forgets them)
beforeEach(() => {
  egGive8(77, [1, 2]);
});

const T0 = 1_800_000_000_000, ME = 'acct-0', BID = '0123456789abcdef';
const LINE = { depth: 1, perS: 0.05 };
const wire = (f) => { const { to: _to, ...rest } = f; const v = validEgOut(JSON.parse(JSON.stringify(rest))); assert.ok(v, `the wire refuses ${f.k}`); return v; };
const crumbly = (h) => (egHallOf(77, h, 0).steps ?? []).some((s) => EG_CRUMBLE_KINDS.includes(s.kind) || s.kind === 'sink');

function inBreach({ h = 2, sg = 'trial', tonics = 0 } = {}) {
  let clock = T0 + EG_SEALED_MS + 60_000;
  const co = [[ME, 'Mac', 1], ['acct-1', 'Ann', 2]];
  const B = egBreachNew({ b: BID, ez: 'z'.repeat(20), s: ME, o: 'Mac', ew: 0, rh: 0, seed: 77, op: T0, co, site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 30, clock);
  B.h = h; B.sg = sg; B.wk = clock - 1000; B.cnt = { left: 1_500_000, at: clock - 1000 };
  B.mem[ME].tonics = tonics;
  const sent = [], said = [];
  const entity = { level: 30, health: 40, maxHealth: 100, magicka: 10, maxMagicka: 80, fatigue: 0, stats: {}, items: [] };
  const player = { pos: realmToDungeon(0, 0, 0), height: 1.8, grounded: true, collider: { move: () => {} } };
  const modes = { mode: 'dungeon', egHallBreach: () => B.b, egHallCircle: () => Math.ceil(B.h / 5), egPlace: (at) => { player.pos = [...at]; return true; }, egLeave: () => true, egHallReturn: () => null, dungeonCtx: { exitDoors: [] }, stepThroughFire: async (go) => go(), enterEgHall: () => true };
  const online = { welcomes: 1, terminal: false, error: null, sendEg: (k, f = {}) => { sent.push({ k, ...f }); return true; } };
  const client = createEgClient({ modes: () => modes, online: () => online, hub: () => null, account: { me: () => ME, guest: () => false, keys: async () => ({ ok: false }) }, now: () => clock, entity, player, cam: { pos: [0, 0, 0], yaw: 0 },
    say: (t) => said.push(t), site: () => ({}), wire: () => null, landAt: () => true, hurt: () => {}, win: { innerWidth: 1280, innerHeight: 720, matchMedia: () => ({ matches: false }) } });
  const tell = (w) => client.word(wire(w));
  tell(egStateOf(B, clock));
  return { client, B, entity, sent, said, tell, now: () => clock, step: (ms) => { clock += ms; } };
}

test('AUDIT EG III lane1 #5 A SPIRE TONIC DRUNK (section 17.1: "restores 25% of health and of magicka, outside THE POTION LAW, held two at most"): the word is the wire\'s (`tonic`, nothing else carried); the room spends one of a living member\'s run and heals that member alone 25% through its one heal word, counted by the census - none held, a witness or a member out drinks nothing; the member\'s `/breach tonic` says the word only while its run holds one, and the room\'s heal on its screen restores 25% of health and of magicka (mutants: the word unknown to the wire; no tonic spent; the heal to the whole company; a tonic from nothing; the magicka unrestored; the word sent with none held)', () => {
  // the wire
  assert.ok(EG_KINDS.includes('tonic'));
  assert.deepEqual(validEgIn({ k: 'tonic', i: 7, p: 1 }), { k: 'tonic' });
  // the room
  const P = inBreach({ tonics: 2 });
  const m = P.B.mem[ME];
  bodyStruck(m, 0.5, P.now() - 1000, LINE);
  const v0 = m.bd.v;
  const out = egWord(P.B, ME, { k: 'tonic' }, null, P.now(), Math.random);
  assert.deepEqual(out, [{ k: 'eheal', p: 0.25, why: 'tonic', to: ME }, { k: 'run', r: egRunOf(ME, m) }]);
  assert.equal(m.tonics, 1, 'one spent');
  egCountHeals(P.B, out, P.now(), LINE, false);
  assert.ok(Math.abs(m.bd.v - Math.min(1, v0 + 0.25)) < 1e-9, `the census counts the heal: ${v0} -> ${m.bd.v}`);
  const ann = P.B.mem['acct-1'];
  assert.equal(ann.bd?.v ?? 1, 1, 'its member alone');
  egWord(P.B, ME, { k: 'tonic' }, null, P.now(), Math.random);
  assert.equal(m.tonics, 0);
  assert.deepEqual(egWord(P.B, ME, { k: 'tonic' }, null, P.now(), Math.random), [], 'none held: nothing');
  m.tonics = EG_TONIC_MAX; m.alive = 0;
  assert.deepEqual(egWord(P.B, ME, { k: 'tonic' }, null, P.now(), Math.random), [], 'a witness drinks nothing');
  assert.equal(m.tonics, EG_TONIC_MAX);
  // the screen
  const Q = inBreach({ tonics: 0 });
  Q.client.frame();
  Q.client.command('tonic');
  assert.deepEqual(Q.sent.filter((w) => w.k === 'tonic'), [], 'none held: no word');
  assert.equal(Q.said.at(-1), EG_TONIC_TEXT.none);
  Q.B.mem[ME].tonics = 1; Q.tell(egStateOf(Q.B, Q.now()));
  Q.client.command('tonic');
  assert.deepEqual(Q.sent.filter((w) => w.k === 'tonic'), [{ k: 'tonic' }], 'the word said');
  for (const f of egWord(Q.B, ME, { k: 'tonic' }, null, Q.now(), Math.random)) Q.tell(f);
  assert.deepEqual([Q.entity.health, Q.entity.magicka], [65, 30], '25% of each restored');
  Q.entity.magicka = 75;
  Q.B.mem[ME].tonics = 1;
  for (const f of egWord(Q.B, ME, { k: 'tonic' }, null, Q.now(), Math.random)) Q.tell(f);
  assert.equal(Q.entity.magicka, 80, 'never past its maximum');
  Q.tell({ k: 'eheal', p: 0.15, why: 'mending' });
  assert.equal(Q.entity.magicka, 80, 'the room\'s other heals restore no magicka');
});

test('AUDIT EG III lane1 #5 LONG STEP ON MY CRUMBLES (section 17.2: "your crumbles wait +0.5 s for one span (private, as crumbles are)"): the Cantrip\'s word to its user holds for one span - the hall it is used in when that hall lays a crumble, else the next of the breach that does - adding EG_LONG_STEP_S to the wait the spans read as my foot lands, on Featherstep\'s; once the company is past that span it is gone (mutants: the half second unapplied; the span never found; it never lapses; Featherstep replaced)', () => {
  _resetSpireVestigesForTests();
  try {
    assert.equal(EG_LONG_STEP_S, 0.5);
    assert.ok(EG_LONG_STEP_LOOK >= 5);
    assert.deepEqual([crumbly(2), crumbly(3), crumbly(7), crumbly(8)], [true, false, false, true], 'seed 77: a span at hall 2, the next crumbles at hall 8');
    const P = inBreach({ h: 3 });
    P.client.frame();
    assert.equal(spireCrumbleWait(), 0, 'none held');
    P.tell({ k: 'egot', to: ME, w: 'longstep' });
    P.client.frame();
    assert.equal(spireCrumbleWait(), EG_LONG_STEP_S, 'held from its word');
    for (const h of [5, 8]) { P.B.h = h; P.tell(egStateOf(P.B, P.now())); P.client.frame(); assert.equal(spireCrumbleWait(), EG_LONG_STEP_S, `hall ${h}: its span not behind the company`); }
    P.B.h = 9; P.tell(egStateOf(P.B, P.now())); P.client.frame();
    assert.equal(spireCrumbleWait(), 0, 'past its span: gone');
    // used in a span hall: that hall's; with Featherstep, on it
    const Q = inBreach({ h: 2 });
    const fs = EG_VESTIGES.find((V) => V.key === 'featherstep');
    Q.B.mem[ME].vs = [[fs.id, 3]]; Q.tell(egStateOf(Q.B, Q.now()));
    Q.client.frame();
    const feather = spireCrumbleWait();
    assert.ok(feather > 0, 'Featherstep held');
    Q.tell({ k: 'egot', to: ME, w: 'longstep' });
    Q.client.frame();
    assert.ok(Math.abs(spireCrumbleWait() - (feather + EG_LONG_STEP_S)) < 1e-9, 'on Featherstep\'s');
    assert.equal(spireHeld()?.ls, true);
    Q.B.h = 3; Q.tell(egStateOf(Q.B, Q.now())); Q.client.frame();
    assert.ok(Math.abs(spireCrumbleWait() - feather) < 1e-9, 'its span behind: Featherstep alone');
  } finally { _resetSpireVestigesForTests(); }
});
