// AUDIT NAV2 (2026-09-30, Mac: "Let's do a deep comprehensive audit on everything developed thus far") - ONLINE, of
// the sea's second pass (bible/01-Overview/audits/Audit-NAV2.md): what every client must read the same - a captain's temper,
// a peer's boat sized up as she sizes herself, a ship's guns out on every screen - and what a handover must keep - a
// prize to her victor, a boarding that left with its boarder. Several players' hosts over Come Sail Away's real pool
// and a stand-in relay (test/navalRoom.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { room } from '../../navalRoom.mjs';
import { OWNER_SWEEP_S, ORPHAN_S } from '../../../src/scenes/naval/navalHost.js';
import { temperOf, TEMPERS } from '../../../src/systems/naval/navalAI.js';
import { classById, hullBuild, HULL } from '../../../src/systems/naval/navalShips.js';
import { raiderClassOf } from '../../../src/systems/naval/navalRaiders.js';
import { SHIP_STATES } from '../../../src/systems/naval/navalDamage.js';
import { GRAPPLE_S } from '../../../src/systems/naval/navalBoarding.js';
import { navalWireRecord, validNavalRecord } from '../../../src/systems/naval/navalWire.js';
import { readFileSync } from 'node:fs';

const bySeed = (c, seed) => [...c.s.host._sea.values()].find((e) => e.ship.seed === seed) ?? null;
const flat = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
/** A pirate launched by hand whose own seed draws wary - her stander makes her bold (the Sea battle's foe, a
 *  console's); the rest are taken out of the sea again. */
function waryByHand(c, classId, opts) {
  for (let i = 0; i < 40; i++) {
    const e = c.s.host._sea.get(c.s.host.spawnShip(classId, opts));
    if (temperOf(classById(classId), e.ship.seed) === TEMPERS.wary) return e;
    c.s.pool.remove(e.boat);
    c.s.host._sea.delete(e.id);
  }
  throw new Error('no wary seed in 40 draws');
}

test('AUDIT NAV2 F1: a captain\'s temper is every client\'s - a Warm Ashes raider her stander makes bold reads bold on a peer\'s copy (the peer\'s own raider list never naming her) and on the heir\'s, and the peer she comes for is warned; a wary-seeded pirate launched by hand the same (mutants: the temper off the word, the word\'s temper unread, the raider\'s bold not said)', async () => {
  const r = await room([{ id: 'a', hull: null }, { id: 'b', hull: HULL.Carrack }]);
  const A = r.get('a'), B = r.get('b');
  A.s.view.feet = [0, 0, -150];
  let seed = 1;
  for (; seed < 5000; seed++) { const c = raiderClassOf(seed, 5); if (c.faction === 'pirate' && !c.flagship && temperOf(c, seed) === TEMPERS.wary) break; }
  const list = () => [{ id: 'raider-1', seed, pos: [250, 0, 250], yaw: Math.PI * 1.25, ahead: [0, 0, 0] }];
  for (let s = 0; s < 30; s++) { A.s.host.raiders(list(), { sight: 900 }); r.run(1); }   // b's world has no raiders (Warm Ashes off there)
  const onA = bySeed(A, seed), onB = bySeed(B, seed);
  assert.equal(onA.ship.temper, TEMPERS.bold, 'her stander makes a raider bold');
  assert.equal(onB?.owner, 'a');
  assert.equal(onB.ship.temper, TEMPERS.bold, 'the peer reads her as her stander does - not her seed\'s wary');
  assert.equal(onA.ship.target, 'b', 'she comes for b');
  assert.ok(flat(onB.ship.pos, [0, 0, 0]) < 700);
  assert.equal(B.s.host.hostileNear(), true, 'and b is warned: no rest, no journey while she closes');
  assert.ok(B.s.host.threats().length >= 1);

  // a pirate launched by hand, her seed wary: bold on both
  const byHand = waryByHand(A, 'pirateBrig', { range: 420, bearing: 0.3 });
  assert.equal(byHand.ship.temper, TEMPERS.bold);
  r.run(2);
  assert.equal(bySeed(B, byHand.ship.seed)?.ship.temper, TEMPERS.bold);

  // the heir keeps it: a leaves, b takes her over and she still comes for b
  A.present = false;
  r.run(OWNER_SWEEP_S + 0.6);
  assert.equal(onB.owner, null, 'b stands her now');
  assert.equal(onB.ship.temper, TEMPERS.bold, 'adopted, her temper is what it was');
  r.run(20);
  assert.equal(onB.ship.target, 'b', 'and she comes for b again on b\'s clock');
});

test('AUDIT NAV2 F2: a peer\'s boat is sized up as she sizes herself - a boat with no crew node loads single-handed on every client, so a wary pirate takes her on the stander\'s screen exactly when the peer is warned of it (mutants: the word\'s crew unread, the stander\'s full-crew guess kept)', async () => {
  const r = await room([{ id: 'a', hull: HULL.SmallShip }, { id: 'b', hull: HULL.LargeBoat }]);
  const A = r.get('a'), B = r.get('b');
  A.s.boat.GameObject.position = [-2000, 0, 0]; A.s.view.feet = [-2000, 0, 0];   // a far off - her own boat no prize for the sloop
  B.s.boat.GameObject.position = [0, 0, 0]; B.s.view.feet = [0, 0, 0];
  const e = A.s.host._sea.get(A.s.host.spawnShip('pirateSloop', { range: 2250, bearing: Math.PI / 2 - 0.2, temper: TEMPERS.wary }));
  e.ship.pos = [250, 0, 0];
  r.run(1);
  const own = B.s.host._contacts().find((c) => c.kind === 'player' && c.id === 'b')?.power;
  const seen = A.s.host._contacts().find((c) => c.kind === 'player' && c.id === 'b')?.power;
  // AUDIT NAV2 F25: the power is a measure now (navalAI.js fightingPower) - compared whole
  assert.ok(own && own.hull === HULL.LargeBoat && own.crewed === false, 'b sizes her own boat - no crew node, single-handed');
  assert.deepEqual(seen, own, 'a sizes b\'s boat as b does');
  r.run(40);
  assert.equal(e.ship.target === 'b', B.s.host.hostileNear(), 'b is warned exactly when the sloop comes for her');
  // a crewed boat's losses too: her word says her hands by count
  const r2 = await room([{ id: 'a', hull: HULL.SmallShip }, { id: 'c', hull: HULL.SmallShip }]);
  const C = r2.get('c');
  r2.get('a').s.boat.GameObject.position = [-2000, 0, 0]; r2.get('a').s.view.feet = [-2000, 0, 0];
  const build = hullBuild(HULL.SmallShip);
  C.s.host.restoreSaveData({ v: 1, boats: { 42: { hull: build.hullHp, sail: build.sailHp, crew: 9, fire: 0, state: 'afloat', barrels: 4 } }, notoriety: {}, day: 1, raids: [] });
  r2.run(1);
  const cOwn = C.s.host._contacts().find((c) => c.kind === 'player' && c.id === 'c')?.power;
  const cSeen = r2.get('a').s.host._contacts().find((c) => c.kind === 'player' && c.id === 'c')?.power;
  assert.ok(cOwn && cOwn.crew === 9 && cOwn.crewed === true);
  assert.deepEqual(cSeen, cOwn, 'a crewed boat 15 hands short sized so on both screens');
});

test('AUDIT NAV2 F4: a rider on another player\'s boat is aboard her and sized as she is - a wary pirate that would take her is the rider\'s enemy too, so the rider is warned exactly when her owner is (SEA-PEACE read the rider as ashore, and a player off every boat of their own as one no wary pirate can size up) (mutants: the ridden boat unsized, the rider not aboard)', async () => {
  // AUDIT NAV2 F25: the prize a wary pirate takes by the odds - PIN MOVED (GALLEON, 2026-10-01): a Large Galley to a
  // sloop, whose low hull her guns cannot lay on (the brig's broadside five guns now, Mac's galleon's ports: a crewless
  // Large Galley 1.10 to one, no prize of hers)
  const r = await room([{ id: 'a', hull: HULL.LargeGalley }, { id: 'b', hull: null }]);
  const A = r.get('a'), B = r.get('b');
  A.s.boat.crewed = false;
  A.s.boat.GameObject.position = [0, 0, 0]; A.s.view.feet = [0, 0, 0];
  B.s.view.feet = [0.5, 0, 0.5];
  B.s.deps.aboardPeer = () => A.s.boat;   // Come Sail Away's riding: b stands on a's boat
  const e = A.s.host._sea.get(A.s.host.spawnShip('pirateSloop', { range: 250, bearing: Math.PI / 2, temper: TEMPERS.wary }));
  e.ship.pos = [250, 0, 0];
  r.run(3);
  assert.equal(A.s.host.hostileNear(), true, 'she would take a\'s boat (a Large Galley cannot lay on a sloop)');
  assert.equal(B.s.host.hostileNear(), true, 'and so her rider is warned: no rest, no journey');
  B.s.deps.aboardPeer = () => null;
  assert.equal(B.s.host.hostileNear(), false, 'ashore, nobody at sea is an enemy of theirs');
});

test('AUDIT NAV2 F3: her guns out on every screen - a peer\'s copy of a ship her stander fights has her crew at battle (crewShips), and a peer\'s boat in a fight says so (peerBoat) (mutants: the battle bit unsaid, unread, the peer\'s boat battle unsaid)', async () => {
  const r = await room([{ id: 'a', hull: HULL.SmallShip }, { id: 'b', hull: HULL.SmallShip }]);
  const A = r.get('a'), B = r.get('b');
  B.s.view.feet = [0, 0, 60];
  const onA = A.s.host._sea.get(A.s.host.spawnShip('pirateBrig', { range: 350, bearing: 0.4 }));
  let seenBattle = false, aBattle = false;
  for (let s = 0; s < 30; s++) {
    r.run(1);
    const copy = bySeed(B, onA.ship.seed);
    const row = copy ? B.s.host.crewShips().find((x) => x.boat === copy.boat) : null;
    aBattle ||= !!A.s.host.crewShips().find((x) => x.key === onA.id)?.battle;
    if (aBattle && row?.battle) seenBattle = true;
  }
  assert.equal(aBattle, true, 'her stander has her at battle');
  assert.equal(seenBattle, true, 'and so does the peer\'s copy');
  const peer = B.s.host.peerBoat('a');
  assert.ok(peer, 'a\'s boat as a\'s word says her');
  assert.equal(peer.battle, true, 'a at her guns, a hostile near her');
  assert.ok(peer.crewShare > 0 && peer.crewShare <= 1);
  assert.equal(B.s.host.peerBoat('nobody'), null);
});

test('AUDIT NAV2 F5: a prize keeps her victor through a handover - a navy that made a pirate strike still lashes and fires her on the heir\'s clock (mutants: the victor unsaid, unread, the prize left unlinked)', async () => {
  const DEG = Math.PI / 180;
  const r = await room([{ id: 'a', hull: null }, { id: 'b', hull: null }]);
  const A = r.get('a'), B = r.get('b');
  B.s.view.feet = [0, 0, 30];
  const p = A.s.host._sea.get(A.s.host.spawnShip('pirateSloop', { range: 400, bearing: 0 }));
  const n = A.s.host._sea.get(A.s.host.spawnShip('navyCutter', { range: 700, bearing: 299 * DEG }));
  for (let t = 0; t < 600 && p.ship.damage.state === SHIP_STATES.afloat; t++) r.run(1);
  assert.equal(p.ship.damage.state, SHIP_STATES.struck);
  assert.equal(p.struck?.by, n.id, 'she struck to the navy');
  const P = bySeed(B, p.ship.seed), N = bySeed(B, n.ship.seed);
  A.present = false;
  r.run(OWNER_SWEEP_S + 0.6);
  assert.equal(P.owner, null);
  assert.equal(N.owner, null);
  assert.equal(P.struck?.by, N.id, 'on the heir she is the navy\'s prize still');
  let lashed = false;
  for (let s = 0; s < 150 && B.s.host._sea.has(P.id) && P.ship.damage.state === SHIP_STATES.struck; s++) { r.run(1); lashed ||= !!N.ship.lashed; }
  assert.equal(lashed, true, 'the navy grapples her');
  assert.notEqual(P.ship.damage.state, SHIP_STATES.struck, 'and she is taken, not left struck for good');
});

test('AUDIT NAV2 F7: a boarding that left with its boarder leaves her boardable - the heir\'s copy is no longer `boarded` and the heir may board her (mutants: adopt keeping the word\'s boarded)', async () => {
  const r = await room([{ id: 'a', hull: HULL.SmallShip }, { id: 'b', hull: HULL.SmallShip }]);
  const A = r.get('a'), B = r.get('b');
  B.s.view.feet = [0, 0, 60];
  const ship = A.s.host._sea.get(A.s.host.spawnShip('merchantGalleon', { range: 40, bearing: Math.PI / 2, yaw: 0 }));
  ship.ship.pos = [40, 0, 0];
  ship.ship.damage.apply({ hull: Math.ceil(ship.ship.damage.maxHull * 0.8), sail: 0, crew: 0 });
  r.run(1);
  assert.equal(A.s.host.activate(), true, 'a grapples her');
  r.run(GRAPPLE_S + 0.5);
  const onB = bySeed(B, ship.ship.seed);
  assert.equal(onB.ship.boarded, true, 'b sees a\'s boarding');
  A.present = false;   // a's tab closes mid-fight
  r.run(OWNER_SWEEP_S + 0.6);
  assert.equal(onB.owner, null);
  assert.equal(onB.ship.boarded, false, 'her boarder gone, the boarding with them');
  r.run(ORPHAN_S + 5);
  B.s.view.feet = [30, 0, 0];
  B.s.view.look = { origin: [30, 5, 0], dir: [1, -0.05, 0] };
  assert.equal(B.s.host.activate(), true, 'b may board her');
});

test('AUDIT NAV2 F1-F3 THE WORD: the captains\' key (k) and the boat\'s (m) round the door - a ship\'s temper, her captain\'s mode and the ship she struck to; the owner\'s boat crew, battle and hull - and an older build\'s word (neither key) reads none; a malformed key fails the word whole (mutants: a key dropped, a bound unchecked)', () => {
  const ships = [{ n: 3, classId: 'pirateBrig', variant: 0, pos: [1, 0, 2], yaw: 0, speed: 1, sails: 1, hull: 1, sail: 1, crew: 1, state: 'afloat', heel: 0, seed: 7, fire: false, runOut: 0, gen: 0, region: -1, temper: TEMPERS.bold, mode: 'board', struckTo: -1 }];
  const rec = navalWireRecord({ ships, me: { hull: 0.5, crippled: false, boarders: true, crew: 6, battle: true, boatHull: HULL.LargeBoat } });
  assert.deepEqual(rec.k, [[3, 2, 2, -1]]);
  assert.deepEqual(rec.m, [6, 1, HULL.LargeBoat]);
  const back = validNavalRecord(JSON.parse(JSON.stringify(rec)));
  assert.deepEqual(back.captains.get(3), { temper: TEMPERS.bold, mode: 'board', struckTo: -1 });
  assert.deepEqual(back.boat, { crew: 6, battle: true, hull: HULL.LargeBoat });
  const old = validNavalRecord({ s: rec.s });
  assert.equal(old.captains.size, 0, 'an older build\'s word: no captains said');
  assert.equal(old.boat, null);
  assert.equal(validNavalRecord({ ...rec, k: [[3, 9, 2, -1]] }), null, 'a temper past the codes');
  assert.equal(validNavalRecord({ ...rec, k: [[3, 2, 8, -1]] }), null, 'a mode past the codes');
  assert.deepEqual(navalWireRecord({ ships: [{ ...ships[0], mode: 'some-new-mode' }] }).k, [[3, 2, 0, -1]], 'a mode not listed is said as cruise');
  assert.equal(validNavalRecord({ ...rec, m: [6, 1, 9] }), null, 'a hull past the names');
  assert.equal(validNavalRecord({ ...rec, m: [6, 1] }), null, 'a field short');
  assert.deepEqual(validNavalRecord({ ...rec, m: [6, 1, HULL.LargeBoat, 7] }).boat, { crew: 6, battle: true, hull: HULL.LargeBoat }, 'a newer build\'s longer boat reads as its first fields');
  assert.deepEqual(validNavalRecord({ ...rec, k: [[3, 2, 2, -1, 9]] }).captains.get(3), { temper: TEMPERS.bold, mode: 'board', struckTo: -1 }, 'and a longer captain');
  assert.equal(validNavalRecord({ ...rec, k: 'x' }), null);
});

test('AUDIT NAV2 F10 (Mac: "Not in a sea fight"): the watch\'s stop waits out a sea fight - a hostile ship near a player aboard, or a boarding under way, holds it on the world host, as a foe on foot does (AUDIT REP F3\'s law); ashore, with no ship hostile to them, it stands (mutants: either arm dropped)', () => {
  const world = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
  const gate = world.match(/blocked: \(\) => townTalk\.overlayActive[^]*?\n\s*\}\);/)?.[0] ?? '';
  assert.match(gate, /\|\| duelEnemyNear\(\) \|\| areEnemiesNearby\(exteriorFoes\.foes\)/, 'the foot fight\'s arms stay');
  assert.match(gate, /!!naval\?\.hostileNear\?\.\(\)/, 'a hostile ship near a player aboard (SEA-PEACE: never one ashore)');
  assert.match(gate, /!!naval\?\.boarding\b/, 'a boarding under way');
});
