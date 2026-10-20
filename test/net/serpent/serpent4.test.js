// SERPENT4 (2026-10-11, the players' thread "Serpent boss fight" in feature-feedback - "too slow and boring", "the snake
// is way too strong for the small amount of people who do it", "make the wind go crazy where the serpent stands", "let
// players on the ship be able to hurt it", "make it huge", "The fact they block ships getting in after a while is
// stupid", "the game just pushed me away from the snake ... like sailing through molasse", "ships need some kind of
// larger invisible box aura", "Rewards based on party or individual damage should be given on death"): THE SERPENT
// REWORKED (bible/11-Multiplayer/Sea-Serpent.md section 16). Its waters open until it dives; a sixth off its health; its
// throws and the canvas they tear halved; its girth SERPENT_GIRTH times; a part dealt earns, a quarter of the fight
// stood earns, and a party shares a dealer's kill; its gale; the ships' bumpers; a hand's own weapons on its hide. Each
// pin failed on the build before it. tools/mutants/serpent4.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  newSerpentFight, joinSerpentFight, applySerpentHit, serpentEarned, serpentEarnedBy, serpentKinOf, serpentStateOf, SHIP_REF,
  SERPENT_TTK_S, SERPENT_RECEIPT_SHARE, SERPENT_PART_SHARE, SERPENT_STOOD_SHARE, SERPENT_STAND_R, SERPENT_HAND_REF, SERPENT_HAND_REACH_M,
  SERPENT_HAND_SHARE, SERPENT_BUCKET_RATE_X, SERPENT_ATTACK_TABLE, ZONES, GUN_REACH_M, SERPENT_POSE_SLACK, CRUSH,
} from '../../../src/net/serpent/serpentBrain.js';
import { LEG, MODE, RADII, SERPENT_GIRTH, radiusAt, bodyAt, segmentBox, nearestExposed } from '../../../src/net/serpent/serpentBody.js';
import { serpentTimes, serpentAdmits, serpentCountdown, serpentPhase, SERPENT_BRAIN_V } from '../../../src/net/serpent/serpentLaw.js';
import { shoveOf, shipHurt, crushHurt, SERPENT_THROW_X, SERPENT_CANVAS_X } from '../../../src/systems/serpent/serpentStrike.js';
import { createSerpentLink } from '../../../src/net/serpent/serpentLink.js';
import { createSerpentHost, SERPENT_GALE, SERPENT_NEAR_M, GALE_LINE } from '../../../src/scenes/serpentHost.js';
import { bumperDrift, flatHull, BUMPER_M, BUMPER_GAIN, BUMPER_V_MAX } from '../../../src/scenes/naval/navalHost.js';
import { ArrowFlight } from '../../../src/combat/arrowFlight.js';
import { mintSerpentReceipt, readSerpentReceipt } from '../../../src/net/serpent/serpentReceipt.js';
import { validSerpentIn, validSerpentOut, SOCIAL_ROOM, SERPENT_RC_PREFIX } from '../../../src/net/wire.js';
import { HULL, hullBuild } from '../../../src/systems/naval/navalShips.js';
import { WIND_RATED } from '../../../src/systems/helmWay.js';
import { scene } from '../../csaScene.mjs';
import { fakeRooms } from '../../fakeRoom.mjs';

const T0 = 10_000_000;
const SOUND = T0 + 25 * 60_000;
const near = (a, b, eps, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} vs ${b} (±${eps})`);
const src = (p) => readFileSync(new URL(`../../../src/${p}`, import.meta.url), 'utf8');
/** A fight joined by `hls`' ships (or hands, -1) as s1, s2 ... */
function fightOf(hls) {
  const f = newSerpentFight(363, T0, SOUND, 'sethrakul', 0, 0, 0.4);
  hls.forEach((hl, i) => assert.ok(joinSerpentFight(f, `s${i + 1}`, `P${i + 1}`, 20, hl, T0, true)));
  return f;
}
/** Up and swimming round its heart (a round 60 m west), its blows held off. */
function surfaced(f, t = T0) {
  f.legs = [{ k: LEG.arc, at: t - 30_000, x: -60, z: 0, yw: 0, v: 11, r: 60, sd: 1, j: 1 }];
  f.modes = [{ at: t - 30_000, m: MODE.cruise }];
  f.openUntil = t; f.nextAt = Infinity; f.lastTickAt = t; f.shieldUntil = 0;
  return f;
}

// ═══ ITS WATERS OPEN UNTIL IT DIVES ════════════════════════════════════════════════════════════════

test('SERPENT4 its waters open until it dives ("The fact they block ships getting in after a while is stupid"): a newcomer is admitted from the rising through the storm\'s breaking to its dive and never after; the countdown counts to the dive from the rising (mutants: admission closed at the storm; admission past the dive; the countdown to the storm)', () => {
  const t = serpentTimes(363);
  assert.equal(serpentAdmits(363, t.sealAt + 1), true, 'past the storm: admitted');
  assert.equal(serpentAdmits(363, t.soundAt - 1), true, 'a breath before its dive: admitted');
  assert.equal(serpentAdmits(363, t.soundAt), false, 'diving: no more');
  assert.equal(serpentPhase(t, t.sealAt + 1), 'late', 'the storm\'s phase stands - its words say a ship may still join');
  for (const at of [t.riseAt + 1, t.sealAt - 1, t.sealAt + 1]) assert.deepEqual(serpentCountdown(t, at), { to: 'sound', ms: t.soundAt - at });
  const f = fightOf([HULL.SmallShip]);
  assert.ok(joinSerpentFight(f, 'late', 'L', 20, HULL.Carrack, t.sealAt + 1, serpentAdmits(363, t.sealAt + 1)), 'the late ship joins');
});

// ═══ A SIXTH OFF ITS HEALTH, ITS THROWS AND THE CANVAS THEY TEAR HALVED ════════════════════════════════════

test('SERPENT4 a sixth off its health ("the snake is way too strong") - each ship brings SERPENT_TTK_S (150) seconds of her reference broadside; its throws are half (SERPENT_THROW_X) and the canvas its blows and its crush tear half (SERPENT_CANVAS_X) - "pushed me away from the snake ... like sailing through molasse" (mutants: the old health; the whole throw; the whole canvas)', () => {
  assert.equal(SERPENT_TTK_S, 150);
  const f = fightOf([HULL.SmallShip, HULL.Carrack]);
  near(f.max, 150 * (SHIP_REF[HULL.SmallShip] + SHIP_REF[HULL.Carrack]), 1e-9);
  assert.equal(SERPENT_THROW_X, 0.5);
  assert.equal(SERPENT_CANVAS_X, 0.5);
  const boat = { x: 0, z: 0, yw: 0, hl: 20, hw: 5 };
  for (const A of [SERPENT_ATTACK_TABLE.lash, SERPENT_ATTACK_TABLE.ram, SERPENT_ATTACK_TABLE.breach, SERPENT_ATTACK_TABLE.roar]) {
    const v = shoveOf({ a: A.id, tg: [[0, -30], [0, 30]], yw: 0 }, { ...boat, x: 4 });
    near(Math.hypot(v[0], v[1]), A.shove / 2, 1e-9, `${A.key}: half its throw`);
  }
  const whole = { maxHull: 1000, maxSail: 400 };
  assert.equal(shipHurt(SERPENT_ATTACK_TABLE.roar, whole).sail, Math.round(SERPENT_ATTACK_TABLE.roar.sail * 400 / 2));
  assert.equal(crushHurt(whole).sail, Math.round(CRUSH.sail * 400 / 2));
  assert.equal(shipHurt(SERPENT_ATTACK_TABLE.roar, whole).hull, Math.round(SERPENT_ATTACK_TABLE.roar.hull * 1000 + SERPENT_ATTACK_TABLE.roar.base), 'its hull as it was');
});

// ═══ ITS GIRTH ════════════════════════════════════════════════════════════════════════════════════

test('SERPENT4 its girth ("make it huge", "hitting with slow projectiles + lag is a challenge"): every radius its first build\'s times SERPENT_GIRTH (1.6) - the great coils 12.5 m through - and every segment\'s box as wide as its radius, so a ball meets it a girth farther off; its length is as it was (mutants: the old girth; the box its old width)', () => {
  assert.equal(SERPENT_GIRTH, 1.6);
  assert.deepEqual(RADII.map(([s, r]) => [s, r]), [[0, 3.52], [4, 5.44], [9, 4.8], [14, 4.64], [40, 6.24], [90, 5.44], [140, 3.04], [168, 1.12]]);
  near(radiusAt(40) * 2, 12.48, 1e-9);
  const pts = bodyAt({ legs: [{ k: LEG.line, at: 0, x: 0, z: 0, yw: 0, v: 11 }], modes: [{ at: 0, m: MODE.cruise }] }, 60_000);
  const box = segmentBox(pts, 6, 0);
  near(box.h[0], Math.max(pts[6].r, pts[7].r), 1e-9);
  assert.ok(box.h[0] > 6, 'the great coils\' box half as wide as a galleon\'s beam and more');
  assert.equal(SERPENT_BRAIN_V, 3, 'a game before it aims at the old body - told to reload');
});

// ═══ WHO EARNS ════════════════════════════════════════════════════════════════════════════════════

test('SERPENT4 who earns ("it sucks doing damage to the serpent and getting nothing from it if your not near the snake when it dies"): a part dealt (SERPENT_PART_SHARE of her share) earns a stander\'s hoard and SERPENT_RECEIPT_SHARE a dealer\'s, wherever she is at the kill; a quarter of the fight stood within SERPENT_STAND_R (600 m) earns; and the fight\'s kin - who came and earned nothing - are named for the hub (mutants: the dealer\'s bar for a stander; the old stand; the kin counting an earner)', () => {
  assert.deepEqual([SERPENT_PART_SHARE, SERPENT_RECEIPT_SHARE, SERPENT_STOOD_SHARE, SERPENT_STAND_R], [0.025, 0.06, 0.25, 600]);
  const f = fightOf([HULL.SmallShip, HULL.Carrack, -1, HULL.LargeBoat]);
  f.fell = { at: T0 + 100_000, top: [], n: 4 }; f.liveMs = 100_000;
  f.players.s1.dealt = SERPENT_PART_SHARE * f.players.s1.share;   // thrown off after her first volleys, far off at the kill
  f.players.s2.dealt = SERPENT_RECEIPT_SHARE * f.players.s2.share;
  f.players.s3.stoodMs = SERPENT_STOOD_SHARE * f.liveMs;   // the hand stood a quarter of it
  f.players.s4.stoodMs = 1000;   // the Large Boat came, and did nothing worth a hoard
  assert.equal(serpentEarned(f, 's1'), true); assert.equal(serpentEarnedBy(f, 's1'), 'stood');
  assert.equal(serpentEarned(f, 's2'), true); assert.equal(serpentEarnedBy(f, 's2'), 'dealt');
  assert.equal(serpentEarned(f, 's3'), true);
  assert.equal(serpentEarned(f, 's4'), false);
  assert.deepEqual(serpentKinOf(f), [['s4', HULL.LargeBoat, 20]], 'the kin: who came and earned nothing');
  f.players.s1.dealt = SERPENT_PART_SHARE * f.players.s1.share * 0.99;
  assert.equal(serpentEarned(f, 's1'), false, 'a hair short of a part');
  assert.deepEqual(serpentKinOf(f).map((k) => k[0]), ['s1', 's4']);
  assert.deepEqual(serpentKinOf({ ...f, fell: null }), [], 'nobody before the fall');
});

test('SERPENT4 a party shares its kill ("Rewards based on party or individual damage should be given on death"): the hub mints a stander\'s receipt for each of the fight\'s kin whose party - as the hub keeps it - holds a dealer\'s receipt of this kill, keeps it as the cell\'s own are kept and hands it to her newest socket; none for kin of a party with no dealer, nor for one with no party (mutants: the party unread; a stander\'s receipt counted a dealer\'s; the kin share left out)', async () => {
  const DAY = 363, T = serpentTimes(DAY), realNow = Date.now;
  let clock = T.riseAt + 120_000;
  try {
    Date.now = () => clock;
    const world = fakeRooms({ now: () => clock });
    const hub = world.room(SOCIAL_ROOM);
    const sx = 205.5 * 32768, sz = 285.5 * 32768;
    const nowS = Math.floor(clock / 1000);
    const kp = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    hub.env.GATE_SIGNING_KEY = Buffer.from(await crypto.subtle.exportKey('pkcs8', kp.privateKey)).toString('base64');
    const mint = (s, x) => mintSerpentReceipt({ d: DAY, b: 'sethrakul', s, c: 7, x, h: 4, l: 20 }, kp.privateKey, { subtle: crypto.subtle, nowS });
    const kin = hub.connect(); await hub.hello(kin, 'peer-0007');
    // the hub's own records, written after her hello (which sweeps what it finds of a party then)
    for (const [id, name, party] of [['acct-deal', 'D', 'pty-a'], ['acct-peer-0007', 'K', 'pty-a'], ['acct-stand', 'S', 'pty-b'], ['acct-kin2', 'K2', 'pty-b'], ['acct-lone', 'L', null]]) {
      await hub.room._putAcct(id, { ...((await hub.room._acct(id)) ?? {}), name, party });
    }
    await hub.room._putParty({ id: 'pty-a', leader: 'acct-deal', members: ['acct-deal', 'acct-peer-0007'], invites: [], away: {}, at: clock });
    await hub.room._putParty({ id: 'pty-b', leader: 'acct-stand', members: ['acct-stand', 'acct-kin2'], invites: [], away: {}, at: clock });
    const rc = [['acct-deal', await mint('acct-deal', 'dealt')], ['acct-stand', await mint('acct-stand', 'stood')]];
    const body = { d: DAY, b: 'sethrakul', at: clock - 1000, top: ['D'], n: 5, sx, sz, rc, here: [], kin: [['acct-peer-0007', -1, 20], ['acct-kin2', 2, 18], ['acct-lone', 3, 9]] };
    const res = await hub.room._serpentFellInternal(new Request('https://relay.internal/', { method: 'POST', body: JSON.stringify(body) }));
    assert.equal(res.status, 200);
    const got = hub.store.get(`${SERPENT_RC_PREFIX}acct-peer-0007`);
    assert.ok(got, 'the dealer\'s party-mate keeps a receipt');
    const c = readSerpentReceipt(got.r);
    assert.deepEqual([c.s, c.d, c.x, c.h, c.l, c.b], ['acct-peer-0007', DAY, 'stood', -1, 20, 'sethrakul'], 'a stander\'s, her hull and level the cell\'s word');
    assert.equal(hub.store.has(`${SERPENT_RC_PREFIX}acct-kin2`), false, 'a party with no dealer shares nothing');
    assert.equal(hub.store.has(`${SERPENT_RC_PREFIX}acct-lone`), false, 'no party, no share');
    assert.ok(kin.sent.some((m) => m.t === 'serpent' && m.k === 'rcpt' && readSerpentReceipt(m.r)?.s === 'acct-peer-0007'), 'handed to her socket');
  } finally { Date.now = realNow; }
  // the cell says its kin with the kill
  assert.ok(readFileSync(new URL('../../../server/src/index.js', import.meta.url), 'utf8').includes('kin: serpentBrain.serpentKinOf(f)'));
});

// ═══ ITS GALE ═════════════════════════════════════════════════════════════════════════════════════

/** Her helm taken (a galleon), a wind of the rated strength blowing `off` degrees round from her bow's own way. */
function helmOn({ off = 90, gale = null } = {}) {
  const s = scene();
  s.deps.handling = () => 'responsive';
  s.deps.gale = () => gale;
  const boat = s.helm(s.place(HULL.SmallShip, 0));
  const rad = (d) => (d * Math.PI) / 180;
  const w = [-1.5 * Math.sin(rad(off)), 0, -1.5 * Math.cos(rad(off))];
  const hold = () => { s.rt.state.windVectorCurrent = [...w]; s.rt.state.windVectorTarget = [...w]; };
  hold();
  s.rt.RaiseSails();
  const run = (secs) => { for (let t = 0; t < secs - 1e-9; t += 0.25) { hold(); s.frame(); } };
  return { s, boat, run, way: () => Math.hypot(...s.rt.state.MoveVectorCurrent) };
}

test('SERPENT4 its gale ("make the wind go crazy where the serpent stands so we can sail faster an turn faster"): under the responsive helm a ship in it sails as on her quarter on every heading - into the wind as fast as off it - in SERPENT_GALE.wind of the rated wind, her helm SERPENT_GALE.turn times quicker; the host gives it to my ship at her helm within SERPENT_NEAR_M of its waters while it swims unslain, and says its line once (mutants: the point of sail kept; the wind unraised; the helm unquickened; the gale off her helm)', () => {
  assert.deepEqual({ ...SERPENT_GALE }, { wind: 1.15, turn: 1.5 });
  const ways = {};
  for (const off of [0, 45, 90, 135, 180]) {
    const plain = helmOn({ off }), galed = helmOn({ off, gale: SERPENT_GALE });
    plain.run(40); galed.run(40);
    ways[off] = [plain.way(), galed.way()];
  }
  const plainWays = Object.values(ways).map((w) => w[0]), galeWays = Object.values(ways).map((w) => w[1]);
  assert.ok(Math.max(...plainWays) / Math.min(...plainWays) > 1.5, `the plain wind: her worst heading well short of her best ${plainWays}`);
  for (const w of galeWays) near(w, galeWays[0], galeWays[0] * 0.01, 'in the gale every heading alike');
  near(galeWays[0] / Math.max(...plainWays), SERPENT_GALE.wind, 0.03, 'and at the gale\'s wind over her best in the rated');
  const t0 = helmOn(), t1 = helmOn({ gale: SERPENT_GALE });
  t0.run(1); t1.run(1);
  near(t1.s.rt.properties.turnSpeed() / t0.s.rt.properties.turnSpeed(), SERPENT_GALE.turn, 1e-6, 'her helm');
  near(t1.s.rt.properties.turnAccel() / t0.s.rt.properties.turnAccel(), SERPENT_GALE.turn, 1e-6);
  assert.ok(WIND_RATED > 0);
  // the host: my ship at her helm, in its waters, while it swims unslain
  const R = clientRig();
  R.host.frame();
  R.hear(stateOf(R.at()));
  R.step(100);
  assert.equal(R.host.gale(R.ship.boat), SERPENT_GALE);
  assert.equal(R.host.gale(R.ship.boat), SERPENT_GALE);
  assert.deepEqual(R.mids.filter((m) => m === GALE_LINE).length, 1, 'its line once');
  assert.equal(R.host.gale({ id: 'another' }), null, 'another boat');
  R.board({ ...R.ship, atHelm: false });
  assert.equal(R.host.gale(R.ship.boat), null, 'off her helm');
  R.board('mine');
  R.feetAt([SERPENT_NEAR_M + 50, 1, 0]);
  assert.equal(R.host.gale(R.ship.boat), null, 'out of its waters');
});

// ═══ THE SHIPS' BUMPERS ═══════════════════════════════════════════════════════════════════════════

test('SERPENT4 the ships\' bumpers ("ships need some kind of larger invisible box aura around them while this fight is in effect so they bounce off each other"): two hulls whose bumpers (BUMPER_M out on every side) meet push my ship off along the shallowest way out at BUMPER_GAIN a second of how deep they meet, BUMPER_V_MAX at most; apart, nothing; the naval host adds them to the drift seam in its waters alone (mutants: the bumper the hull\'s own size; the push into her; no cap; bumpers everywhere)', () => {
  assert.deepEqual([BUMPER_M, BUMPER_GAIN, BUMPER_V_MAX], [10, 1.5, 30]);
  const b = hullBuild(HULL.SmallShip), beam = 2 * b.halfWidth;
  const me = flatHull([0, 0, 0], 0, HULL.SmallShip);
  // abeam of her, her side 10 m clear of mine: the hulls apart, the bumpers 10 m into each other
  const gap = 10, other = flatHull([beam + gap, 0, 0], 0, HULL.SmallShip);
  const v = bumperDrift(me, [other]);
  assert.ok(v, 'the bumpers meet with clear water between the hulls');
  near(v[0], -(2 * BUMPER_M - gap) * BUMPER_GAIN, 1e-9, 'pushed off her, away');
  near(v[2], 0, 1e-9);
  assert.equal(bumperDrift(me, [flatHull([beam + 2 * BUMPER_M + 1, 0, 0], 0, HULL.SmallShip)]), null, 'apart: nothing');
  const deep = bumperDrift(me, [flatHull([0.5, 0, 0], 0, HULL.SmallShip), flatHull([1, 0, 0], 0, HULL.SmallShip)]);
  near(Math.hypot(deep[0], deep[2]), BUMPER_V_MAX, 1e-9, 'never past its cap');
  const naval = src('scenes/naval/navalHost.js');
  assert.ok(naval.includes('drift: (boat) => (enabled ? withBumpers(boat, deps.serpent?.drift?.(boat) ?? null) : null)'));
  assert.ok(/function withBumpers\(boat, d\) \{\n {4}if \(!deps\.serpent\?\.near\?\.\(\)\) return d;/.test(naval), 'in its waters alone');
});

// ═══ A HAND'S OWN WEAPONS ═════════════════════════════════════════════════════════════════════════

test('SERPENT4 a hand\'s own weapons ("also let players on the ship be able to hurt it"): a player aboard no ship of her own strikes it with her shafts and spells on a hand\'s purse (SERPENT_HAND_REF), from within SERPENT_HAND_REACH_M; on her own ship a hand\'s blow is not heard (her purse is her guns); her part is measured against SERPENT_HAND_SHARE; the wire carries the word\'s `r` (mutants: a hand\'s blow on the ship\'s purse; a captain\'s arrows heard; the hand\'s reach a gun\'s; a hand\'s part unmeasured)', () => {
  const f = surfaced(fightOf([HULL.SmallShip, -1]));
  const hand = f.players.s2;
  assert.equal(hand.share, 0, 'a hand brings no health');
  // her purse fills as a ship's does, at her own reference - empty at her first blow
  applySerpentHit(f, 's2', 5000, ZONES.body, { x: -60, z: 60 }, T0 + 10_000, true);
  near(hand.dealt, Math.min(10 * SERPENT_BUCKET_RATE_X * SERPENT_HAND_REF, 14 * SERPENT_HAND_REF), 1e-6, 'ten seconds of a hand\'s purse');
  near(hand.hd, hand.dealt, 1e-9);
  const was = f.players.s1.dealt;
  applySerpentHit(f, 's1', 50, ZONES.body, { x: -60, z: 60 }, T0 + 10_200, true);
  assert.equal(f.players.s1.dealt, was, 'a captain on her own ship: her arrows not heard');
  applySerpentHit(f, 's1', 50, ZONES.body, { x: -60, z: 60 }, T0 + 10_400);
  assert.ok(f.players.s1.dealt > was, 'her guns are');
  // the reach: a hand's shaft flies SERPENT_HAND_REACH_M, a gun's ball GUN_REACH_M
  assert.ok(SERPENT_HAND_REACH_M < GUN_REACH_M);
  const g = surfaced(fightOf([HULL.SmallShip, -1]));   // a ship brings its health - a hand none
  // a pose due west of its waters' heart, `want` metres off the nearest of its hide above the sea at `t`
  const off = (want, t) => { for (let R = 0; R < 2000; R++) { const n = nearestExposed(bodyAt(g, t), -R, 0); if (n && n.d >= want) return { x: -R, z: 0 }; } return null; };
  const dealt = () => g.players.s2.dealt;
  applySerpentHit(g, 's2', 10, ZONES.body, off(SERPENT_HAND_REACH_M + SERPENT_POSE_SLACK + 20, T0 + 30_000), T0 + 30_000, true);
  assert.equal(dealt(), 0, 'past a shaft\'s flight');
  applySerpentHit(g, 's2', 10, ZONES.body, off(SERPENT_HAND_REACH_M - 20, T0 + 31_000), T0 + 31_000, true);
  assert.ok(dealt() > 0, 'within it');
  applySerpentHit(g, 's2', 10, ZONES.body, off(GUN_REACH_M - 20, T0 + 32_000), T0 + 32_000, true);
  near(dealt(), 10, 1e-9, 'a hand\'s shaft never flies a gun\'s reach');
  // her part
  assert.equal(SERPENT_HAND_SHARE, SERPENT_TTK_S * SHIP_REF[HULL.SmallShip]);
  g.fell = { at: T0 + 60_000, top: [], n: 1 }; g.liveMs = 600_000;
  g.players.s2.dealt = g.players.s2.hd = SERPENT_PART_SHARE * SERPENT_HAND_SHARE * 0.99;
  assert.equal(serpentEarned(g, 's2'), false);
  g.players.s2.dealt = g.players.s2.hd = SERPENT_RECEIPT_SHARE * SERPENT_HAND_SHARE;
  assert.deepEqual([serpentEarned(g, 's2'), serpentEarnedBy(g, 's2')], [true, 'dealt']);
  // the wire
  assert.deepEqual(validSerpentIn({ k: 'hit', d: 12, z: 0, r: 1 }), { k: 'hit', d: 12, z: 0, r: 1 });
  assert.deepEqual(validSerpentIn({ k: 'hit', d: 12, z: 0 }), { k: 'hit', d: 12, z: 0 });
  assert.equal(validSerpentIn({ k: 'hit', d: 12, z: 0, r: 2 }), null);
  assert.ok(src('../server/src/index.js').includes('SERPENT_SEAM.hit(f, a.sub, m.d, m.r, pose, now, null, { z: m.z })'), 'the relay hears its `r`');   // PIN MOVED (EG-H3, EG3): through THE BOSS SEAM (net/bossSeam.js - the brain's own law, its frames byte for byte: test/net/eliteGates/egseam_law.test.js)
  assert.ok(src('../src/net/bossSeam.js').includes('applySerpentHit(f, sub, d, o.z, pose, now, r === 1)'), 'the seam hands the brain the word\'s `r` 1 as a hand\'s own weapons');
});

test('SERPENT4 a hand\'s weapons on the client: its segments are a hand\'s marks only while no ship of my own is under me; a blow of mine on one is gathered into its own word of its zone (`r` 1), never into the guns\'; a shaft of mine whose step passes through a box stops in it and is handed to the host - an enemy\'s is not; a harmful missile of mine meets a box mark (mutants: the marks to a captain; the hand\'s word without its `r`; the shaft flying through; an enemy shaft handed)', () => {
  const R = clientRig({ online: true });
  R.host.frame();
  R.hear(stateOf(R.at()));
  R.step(8000);   // surfaced and cruising, its humps out of the sea
  assert.deepEqual(R.host.handBoxes(), [], 'at my own ship\'s helm: none');
  R.board(null);
  const boxes = R.host.handBoxes();
  assert.ok(boxes.length > 0 && boxes.every((b) => b.box && b.id.startsWith('serpent:')), 'a hand: its segments');
  R.host.handStruck(boxes.find((b) => b.id !== 'serpent:0' && b.id !== 'serpent:1'), 30);
  R.host.struck(5, 40);   // a ball of mine too, were I at guns
  R.step(600);
  const hits = R.said.filter((m) => m.k === 'hit');
  assert.deepEqual(hits.map((m) => [m.d, m.r ?? 0]).sort(), [[30, 1], [40, 0]], 'a hand\'s word and a gun\'s, each its own');
  // the shaft
  const flight = new ArrowFlight({ getGpuMesh: () => null });
  const box = { c: [0, 2, 20], ax: [1, 0, 0], ay: [0, 1, 0], az: [0, 0, 1], h: [5, 5, 5] };
  flight.fire([0, 2, 0], [0, 0, 1], { fromPlayer: true });
  flight.fire([0, 2, 0], [0, 0, 1], { enemy: true });
  const handed = [];
  for (let i = 0; i < 60; i++) flight.update(1 / 30, { boxTargets: [{ id: 'serpent:4', box }], onPlayerArrowHitBox: (m, t) => handed.push([m.fromPlayer, t.id]) });
  assert.deepEqual(handed, [[true, 'serpent:4']], 'mine stopped in it, the enemy\'s flew on');
  // the missile: the engine's own branch
  const magic = src('scenes/hostMagic.js');
  assert.ok(/if \(m\.duel\) \{\n {8}const hitBox = boxMarksFor\(m\.spell\)\.find\(\(q\) => missileInBox\(m\.pos, q\.box\)\);/.test(magic));
  const world = src('scenes/world.js');
  for (const wired of ['boxMarks: () => serpentHost?.handBoxes?.() ?? null,', 'castAtBox: (sp, q, caster) => serpentSpell.cast(sp, q, caster),', 'boxTargets: serpentHost?.handBoxes?.() ?? null,', 'onPlayerArrowHitBox: (m, t) => serpentArrowOn(m, t),']) assert.ok(world.includes(wired), wired);   // PIN MOVED (AUDIT SCHOOLS L2 F4): and the cast's wrapper, for the paths' riders; PIN MOVED (FIELD BUGS 2026-10-19f BOSS-DOT): the door in scenes/gate/standInSpell.js createSerpentSpell
});

// ═══ the client rig ═══════════════════════════════════════════════════════════════════════════════

function clientRig({ online = false } = {}) {
  let now = 50_000_000, feet = [60, 1, 0];
  const said = [], mids = [];
  const sw = { day: 363, site: { sx: 0, sz: 0 }, phase: 'hunt', t: { soundAt: now + 25 * 60_000 } };
  const link = createSerpentLink({ now: () => now, site: () => ({ day: 363, sx: 0, sz: 0 }) });
  const ship = { boat: { id: 'mine' }, hull: HULL.Carrack, root: [60, 0], pos: [60, 0, 0], yaw: 0, hl: 25, hw: 7, maxHull: 1200, maxSail: 600, atHelm: true, wrecked: false };
  let mine = ship;
  const host = createSerpentHost({
    now: () => now, link, omen: { swimming: () => sw },
    online: { ready: () => online, send: (m) => { said.push(m); return true; }, acct: () => 'acct-0001' },
    toScene: (sx, sz, x, z) => [x, z], toSite: (sx, sz, x, z) => [x, z], seaY: () => 0,
    feet: () => feet, level: () => 20, boat: () => mine,
    strike: () => {}, hurt: () => {}, say: () => {}, mid: (m) => mids.push(m), sound: () => {}, fx: () => {},
  });
  const hear = (w) => { const v = validSerpentOut(w.k === 'st' ? w : { ...w, sx: 0, sz: 0 }); assert.ok(v, `the wire passes ${w.k}`); link.word(v); };
  return {
    host, said, mids, ship, hear, at: () => now, step: (ms) => { now += ms; return host.frame(); },
    board: (b) => { mine = b === 'mine' ? ship : b; }, feetAt: (p) => { feet = p; },
  };
}
function stateOf(now) {
  const f = newSerpentFight(363, now, now + 25 * 60_000, 'sethrakul', 0, 0, 0);
  joinSerpentFight(f, 'acct-0001', 'Ama', 20, 4, now, true);
  return validSerpentOut(serpentStateOf(f));
}
