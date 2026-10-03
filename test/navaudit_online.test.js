// AUDIT NAV1 (2026-09-29, Mac: "Lets do a deep comprehensive audit and ensure this is perfection. I want ship movement
// and combat to flow perfectly, just like assisins creed black flag"; of the arc: "directly integrate into online mode")
// - ONLINE, the audit's sixth lens (bible/03-World/Naval-Combat.md "Online"): several players' hosts over Come Sail
// Away's real pool and a stand-in relay (test/navalRoom.mjs) - the sea handed on when its stander goes, a ship another
// stands boarded in one world, no twins, a ship's names the same to everyone, another's ship sailing on between words.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { room } from './navalRoom.mjs';
import { sea, freshPool } from './navalSea.mjs';
import { SHIP_FADE_S, OWNER_SWEEP_S, OWNER_STALE_S, ORPHAN_S, PREDICT_MAX_S, PUPPET_SNAP_M, GRAPPLE_CLAIM_S, PEER_VOLLEYS_MAX, CLAIM_AGAIN_S, CLAIM_WAIT_S, GRANT_KEEP_S, claimBeats, idSalt, hullBoxOf, rigBoxesOf } from '../src/scenes/navalHost.js';
import { seedBaseOf, SEED_SALT, createNavalDirector, DENSITY } from '../src/systems/naval/navalDirector.js';
import { NAVAL_GEN_MAX, NAVAL_SHARE_RADIUS, NAVAL_WIRE_VOLLEYS, NAVAL_VOLLEY_KEEP_MS, navalWireRecord, validNavalRecord, navalHitData } from '../src/systems/naval/navalWire.js';
import { SHIP_STATES } from '../src/systems/naval/navalDamage.js';
import { GRAPPLE_S } from '../src/systems/naval/navalBoarding.js';
import { CROWNS } from '../src/systems/naval/navalShips.js';
import { NAVY_HUNTS, WRECK_SPARE_S } from '../src/systems/naval/navalAI.js';
import { NAVAL_SFX } from '../src/systems/naval/navalSounds.js';
import { BARREL_ARM, BALL_STEP_S, createShotField } from '../src/systems/naval/navalShots.js';
import { shotPosition } from '../src/systems/naval/navalBallistics.js';

const bySeed = (c, seed) => [...c.s.host._sea.values()].find((e) => e.ship.seed === seed) ?? null;
const flat = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
/** A ship the player stands, placed where the test wants her. */
function stand(c, classId, pos, yaw = 0) {
  const e = c.s.host._sea.get(c.s.host.spawnShip(classId, { range: Math.hypot(pos[0], pos[2]) || 1, bearing: Math.atan2(pos[0], pos[2]), yaw }));
  e.ship.pos = [...pos];
  e.ship.yaw = yaw;
  return e;
}

test('AUDIT NAV1 (online) THE CLAIM: a ship\'s seed is who she is in every sea, and of two claims on her the greater handover count holds her, on a tie the lower id - the stander law\'s own; a stander\'s traffic salted with its id, the waters\' own seeds offline (mutants: the tie to the higher id, the count unread, no salt, a salt offline)', () => {
  assert.equal(claimBeats(1, 'z', 0, 'a'), true, 'taken over beats the first claim, whoever\'s id');
  assert.equal(claimBeats(0, 'a', 1, 'z'), false);
  assert.equal(claimBeats(2, 'b', 2, 'c'), true, 'a tie: the lower id');
  assert.equal(claimBeats(2, 'c', 2, 'b'), false);
  assert.equal(claimBeats(0, 'a', 0, 'a'), false, 'no claim beats itself');
  assert.equal(idSalt('local'), 0);
  assert.equal(idSalt(null), 0);
  assert.notEqual(idSalt('a-player'), idSalt('b-player'));
  assert.equal(idSalt('a-player'), idSalt('a-player'));
  assert.equal(seedBaseOf(100, 100, 1, SEED_SALT ^ idSalt('local')), seedBaseOf(100, 100, 1), 'offline: the waters\' own seeds');
  assert.notEqual(seedBaseOf(100, 100, 1, SEED_SALT ^ idSalt('a-player')), seedBaseOf(100, 100, 1, SEED_SALT ^ idSalt('b-player')));
  assert.equal(NAVAL_GEN_MAX, 255);
});

test('AUDIT NAV1 (online #2) THE SEA HANDED ON: a stander gone from the cell took every ship with it, mid-fight - now the player who would stand the sea without them takes them over where they lie (the same hulls, one past their count) and sails them on; anyone else keeps them ORPHAN_S for that heir\'s word, which claims the same entries; one no word claims is let go (mutants: dropped at once, the heir unread, adopted by all, the orphan never let go)', async () => {
  const r = await room([{ id: 'a', hull: 2 }, { id: 'b', hull: 2 }, { id: 'c', hull: 2 }]);
  const A = r.get('a'), B = r.get('b'), C = r.get('c');
  const brig = stand(A, 'pirateBrig', [260, 0, 160]);
  const galleon = stand(A, 'merchantGalleon', [-300, 0, 250], 1);
  r.run(1.5);
  const onB = bySeed(B, brig.ship.seed), onC = bySeed(C, brig.ship.seed), galleonB = bySeed(B, galleon.ship.seed);
  assert.ok(onB?.boat && onC?.boat && galleonB, 'a stands them: on every screen');
  assert.deepEqual([onB.owner, onB.gen, onC.owner], ['a', 0, 'a']);
  const hullB = onB.boat;
  A.present = false;   // a goes indoors: out of the cell
  r.run(OWNER_SWEEP_S + 0.6);
  assert.equal(onB.owner, null, 'b, the lowest id left, takes her over');
  assert.equal(onB.gen, 1, 'one past her count');
  assert.equal(B.s.host._sea.get(onB.id), onB, 'the same entry');
  assert.equal(onB.boat, hullB, 'the same hull - never rebuilt');
  assert.equal(galleonB.owner, null);
  assert.deepEqual([onC.owner, onC.gen], ['b', 1], 'c keeps her for b\'s word, which claims the same entry');
  assert.equal(bySeed(C, brig.ship.seed), onC);
  assert.equal([...C.s.host._sea.values()].filter((e) => e.ship.seed === brig.ship.seed).length, 1, 'one of her');
  const at = [...onB.ship.pos];
  r.run(4);
  assert.ok(flat(onB.ship.pos, at) > 3, `she sails on under b's captain (${flat(onB.ship.pos, at).toFixed(1)} m)`);
  assert.ok(flat(onC.ship.pos, onB.ship.pos) < 3, 'and on c\'s screen where b says she is');
  // no heir's word: a player who is not the heir lets them go ORPHAN_S on
  const q = await room([{ id: 'a', hull: 2 }, { id: 'b', hull: 2 }, { id: 'c', hull: 2 }]);
  const qa = q.get('a'), qb = q.get('b'), qc = q.get('c');
  const lone = stand(qa, 'merchantGalleon', [200, 0, 200]);
  q.run(1.5);
  const loneC = bySeed(qc, lone.ship.seed);
  assert.ok(loneC);
  qb.quiet = true;   // b is the heir, but says nothing
  qa.present = false;
  q.run(OWNER_SWEEP_S + 0.6);
  assert.ok(loneC.orphan != null && loneC.owner === 'a', 'c holds her for the heir');
  q.run(ORPHAN_S + SHIP_FADE_S + 0.5);   // SHIP-FADE (2026-10-02) PIN MOVED: let go, she fades
  assert.ok(bySeed(qc, lone.ship.seed) === null, 'no word claimed her: let go');
  assert.ok(bySeed(qb, lone.ship.seed)?.owner === null, 'the heir has her, all the same');
});

test('AUDIT NAV1 (online) A QUIET STANDER: in the cell but saying nothing past OWNER_STALE_S (a tab put away), their ships are the heir\'s as a departed one\'s; when they speak again their first claim yields to the heir\'s - their own copies become the heir\'s ships on their screen, the same entries - and no one holds two of her (mutants: the stale owner never released, the old claim kept)', async () => {
  const r = await room([{ id: 'a', hull: 2 }, { id: 'b', hull: 2 }]);
  const A = r.get('a'), B = r.get('b');
  const brig = stand(A, 'pirateBrig', [200, 0, 220]);
  r.run(1.5);
  const onB = bySeed(B, brig.ship.seed);
  A.quiet = true;
  r.run(OWNER_STALE_S + OWNER_SWEEP_S + 0.5);
  assert.deepEqual([onB.owner, onB.gen], [null, 1], 'quiet past OWNER_STALE_S: taken over');
  A.quiet = false;
  r.run(1.5);
  assert.deepEqual([brig.owner, brig.gen], ['b', 1], 'a hears the stronger claim: her own copy is b\'s ship now');
  assert.equal(bySeed(A, brig.ship.seed), brig, 'the same entry');
  for (const c of [A, B]) assert.equal([...c.s.host._sea.values()].filter((e) => e.ship.seed === brig.ship.seed).length, 1, `${c.id}: one of her`);
  assert.equal(onB.owner, null, 'b keeps her');
});

test('AUDIT NAV1 (online #3, #1) BOARDING ANOTHER\'S SHIP, IN ONE WORLD: the boarder hauled his copy 17 m while her stander\'s lay at 40, then after the win she slid 20 m from under him, and her scuttling burned on his screen alone - now he takes her over at the grapple: the haul, the fight, the prize and her fate are his world, her stander\'s copy follows his word, and her fire and her sinking reach every screen (mutants: no takeover at the grapple, the claim yielded back, the prize adrift in two worlds)', async () => {
  const r = await room([{ id: 'a', hull: 2 }, { id: 'b', hull: 2 }]);
  const A = r.get('a'), B = r.get('b');
  A.s.view.feet = [0, 0, -400];
  const ship = stand(A, 'merchantGalleon', [40, 0, 0]);
  ship.ship.damage.apply({ hull: Math.ceil(ship.ship.damage.maxHull * 0.8), sail: 0, crew: 0 });
  r.run(1);
  const mine = bySeed(B, ship.ship.seed);
  assert.equal(mine.ship.damage.state, SHIP_STATES.struck);
  assert.equal(B.s.host.hudModel().board?.kind, 'board');
  assert.equal(B.s.host.activate(), true);
  assert.deepEqual([mine.owner, mine.gen], [null, 1], 'taken over at the grapple');
  let apart = 0;
  for (let t = 0; t < GRAPPLE_S + 0.3; t += 1 / 30) {
    r.tick(1 / 30);
    if (t > 0.6) apart = Math.max(apart, flat(ship.ship.pos, mine.ship.pos));
  }
  assert.equal(B.s.host.boarding?.phase, 'fight');
  assert.deepEqual([ship.owner, ship.gen], ['b', 1], 'her stander\'s copy is the boarder\'s ship now');
  // the haul draws her sideways with no way of her own on her word: her stander's copy follows a word behind (it was
  // 23 m apart for good)
  assert.ok(apart < 8, `the haul followed (${apart.toFixed(2)} m apart at most)`);
  r.run(0.5);
  assert.ok(flat(ship.ship.pos, mine.ship.pos) < 0.5, `alongside, one world (${flat(ship.ship.pos, mine.ship.pos).toFixed(2)} m)`);
  for (const f of B.s.log.foes) f.dead = true;
  r.run(0.3);
  assert.equal(mine.ship.damage.state, SHIP_STATES.prize);
  const deck = B.s.log.placed.at(-1)[0];
  const under = flat(mine.ship.pos, deck);
  r.run(1.5);
  assert.ok(Math.abs(flat(mine.ship.pos, deck) - under) < 0.5, 'the prize stays under his feet');
  assert.ok(flat(ship.ship.pos, mine.ship.pos) < 1, 'and where he says she is');
  B.s.log.plunder.at(-1).fate('scuttle');
  r.run(3);
  assert.equal(ship.ship.damage.state, SHIP_STATES.sinking, 'her stander sees her go down');
  assert.ok(ship.ship.damage.fire > 0 && ship.fires?.some((f) => !f.out), 'burning');
  assert.ok(Math.abs(ship.boat.GameObject.position[1] - mine.boat.GameObject.position[1]) < 0.3, 'settling with his');
});

test('AUDIT NAV1 (online #5, #8, #6c) NO TWINS, ONE NUMBER, ONE NAME: two standers in the same waters on the same day launched the same three ships side by side - now each one\'s traffic is salted with its id; a ship launched while the socket was away (`local:n`) takes a peer\'s blow by her number; and a navy ship is her stander\'s crown\'s to everyone (the same cutter was Wayrest\'s to one player and Daggerfall\'s to one a pixel over) - her names drawn in the region her word carries (mutants: the salt dropped, the blow by her id, the reader\'s own region)', async () => {
  const r = await room([{ id: 'a', hull: 2, settings: { ShipsAtSea: 'many' } }, { id: 'b', hull: 2, settings: { ShipsAtSea: 'many' } }]);
  const A = r.get('a'), B = r.get('b');
  B.s.view.feet = [3000, 0, 0];   // apart: each stands its own sea
  r.run(150, 0.1);
  const own = (c) => [...c.s.host._sea.values()].filter((e) => !e.owner).map((e) => e.ship.seed);
  const [sa, sb] = [own(A), own(B)];
  assert.ok(sa.length >= 2 && sb.length >= 2, `both launched (${sa.length}, ${sb.length})`);
  assert.equal(sa.filter((x) => sb.includes(x)).length, 0, 'no ship twice');
  // a ship minted under `local:n` takes a peer's blow by her number
  const q = await room([{ id: 'a', hull: 2 }, { id: 'b', hull: 2 }]);
  const qa = q.get('a');
  qa.offline = true;
  const early = stand(qa, 'merchantGalleon', [150, 0, 100]);
  assert.match(early.id, /^local:/);
  qa.offline = false;
  q.run(1);
  const hull0 = early.ship.damage.hull;
  assert.equal(qa.s.host.applyPeerHit('b', { to: 'a', nv: { n: early.n, h: 40, s: 0, c: 0, f: 0, z: 0 } }), true);
  assert.equal(early.ship.damage.hull, hull0 - 40, 'by her number');
  // one name: a reader in another crown's waters calls her what her stander calls her
  const n = await room([{ id: 'a', hull: 2 }, { id: 'b', hull: 2, where: { region: 17, capitals: [{ region: 17, x: 100, y: 100 }] } }]);
  const cutter = stand(n.get('a'), 'navyCutter', [200, 0, 200]);
  n.run(1);
  const seen = bySeed(n.get('b'), cutter.ship.seed);
  assert.equal(cutter.ship.names.crown, 'Wayrest');
  assert.deepEqual(seen.ship.names, cutter.ship.names, 'her name, her captain, her crown');
  assert.equal(seen.region, CROWNS.find((c) => c.name === 'Wayrest').region);
  // an older word without her region: the reader's own, as before
  const old = navalWireRecord({ ships: [{ n: 9, classId: 'navyCutter', variant: 0, pos: [300, 0, 0], yaw: 0, speed: 0, sails: 1, hull: 1, sail: 1, crew: 1, state: 'afloat', heel: 0, seed: 77, fire: false }] }).s[0].slice(0, 17);
  n.get('b').s.host.applyWord('z', { s: [old], v: [], b: [] }, (p) => p);
  assert.equal(n.get('b').s.host._sea.get('z:9').ship.names.crown, 'Daggerfall');
  assert.ok(validNavalRecord({ s: [old] }));
});

test('AUDIT NAV1 (online) ANOTHER\'S SHIP BETWEEN WORDS sails on along her course at her way (PREDICT_MAX_S at most), eased as ever: a brig at 7 m/s stepped from word to word, a word and more behind - now she stands where her stander has her; a word gone quiet, she stops PREDICT_MAX_S on, never sailing off on a guess (mutants: no prediction, unbounded)', async () => {
  const r = await room([{ id: 'a', hull: 2 }, { id: 'b', hull: 2 }]);
  const A = r.get('a'), B = r.get('b');
  const brig = stand(A, 'pirateBrig', [200, 0, -300], Math.PI / 2);
  brig.ship.course = [1e6, -300];   // a course held (NAV-R's hook): she sails on, fighting no one
  brig.ship.cls = { ...brig.ship.cls, faction: 'merchant' };
  r.run(20);
  const copy = bySeed(B, brig.ship.seed);
  assert.ok(brig.ship.speed > 3, `under way (${brig.ship.speed.toFixed(1)} m/s)`);
  let worst = 0;
  for (let i = 0; i < 90; i++) { r.tick(1 / 30); worst = Math.max(worst, flat(copy.ship.pos, brig.ship.pos)); }
  const lag = brig.ship.speed * 0.28;   // a word's interval and the relay's latency, unpredicted
  assert.ok(worst < Math.max(1.2, lag * 0.5), `where her stander has her (${worst.toFixed(2)} m at worst; ${lag.toFixed(2)} m a word behind)`);
  // her stander falls quiet: she sails on PREDICT_MAX_S at most, then stops
  A.quiet = true;
  const at = [...copy.ship.pos];
  r.run(PREDICT_MAX_S + 2);
  const went = flat(copy.ship.pos, at);
  assert.ok(went <= brig.ship.speed * PREDICT_MAX_S + 1 && went > brig.ship.speed * PREDICT_MAX_S * 0.5, `on her course, then no further (${went.toFixed(1)} m)`);
  const still = [...copy.ship.pos];
  r.run(1);
  assert.ok(flat(copy.ship.pos, still) < 0.05, 'stopped');
  assert.ok(PUPPET_SNAP_M > brig.ship.speed * PREDICT_MAX_S);
});

test('AUDIT NAV1 (online #2) TWO STANDERS MEET: the one who stops standing kept its ships for good and the sea doubled - now the stander counts the whole shared sea near it against the density and launches nothing past it, and every player lets its own ships go out of sight, standing or not, launching none (mutants: the peers\' ships uncounted, the non-stander never letting go, the non-stander launching)', async () => {
  const r = await room([{ id: 'a', hull: 2, settings: { ShipsAtSea: 'some' } }, { id: 'b', hull: 2, settings: { ShipsAtSea: 'some' } }]);
  const A = r.get('a'), B = r.get('b');
  B.s.view.feet = [400, 0, 0];
  stand(A, 'merchantGalleon', [300, 0, 600], 1);
  stand(B, 'merchantGalleon', [-300, 0, 600], 2);
  stand(B, 'merchantCoaster', [100, 0, -700], 3);
  const far = stand(B, 'merchantCoaster', [2600, 0, 2600]);   // past DESPAWN_BEYOND of both
  const count = (c) => [...c.s.host._sea.values()].filter((e) => !e.owner).length;
  r.run(1);
  assert.equal(B.s.host._sea.has(far.id), false, 'b lets its own go out of sight - not standing');
  // a director with nothing to launch lets its own go and draws nothing on the stream (the host's own - a roll that
  // could launch nothing shifted every later draw)
  let draws = 0;
  const idle = createNavalDirector({ random: () => { draws++; return 0.5; } });
  const ctx = (density) => ({ density, player: [0, 0, 0], players: [[0, 0, 0]], ships: [], isOpenWater: () => true, seedBase: 1, seaY: 0 });
  for (let t = 0; t < 200; t++) idle.step(1, ctx(0));
  assert.equal(draws, 0, 'density 0: no roll, no draw');
  for (let t = 0; t < 200; t++) idle.step(1, ctx(3));
  assert.ok(draws > 0);
  const away = { id: 'z:1', pos: [5000, 0, 0], classId: 'merchantGalleon', theirs: true, afloat: true };
  assert.deepEqual(idle.step(1, { ...ctx(3), ships: [away, { ...away, id: 'mine', theirs: false }] }).despawn, ['mine'], 'another\'s ship is never mine to let go');
  r.run(90, 0.1);   // the first roll and two more, the traders still near
  assert.ok([...B.s.host._sea.values()].filter((e) => !e.owner).every((e) => flat(e.ship.pos, A.s.view.feet) < 1900), 'b\'s two still near a');
  assert.equal(count(A), 1, 'the shared sea holds three ("some"): a launches none');
  assert.equal(count(B), 2, 'b launches none');
  // the sea short near them both: only the stander launches
  const q = await room([{ id: 'a', hull: 2, settings: { ShipsAtSea: 'some' } }, { id: 'b', hull: 2, settings: { ShipsAtSea: 'some' } }]);
  q.get('b').s.view.feet = [400, 0, 0];
  q.run(90, 0.1);
  assert.ok(count(q.get('a')) >= 1, 'a launches');
  assert.equal(count(q.get('b')), 0, 'b never does');
});

test('AUDIT NAV1 (online) A RAIDER TAKEN OVER is known by her seed: the heir marks her its raider (held on its word, spent by its law) and stands no second copy beside another\'s; mid-boarding, a lower id\'s Overworld hold never takes her from under the fight (mutants: the seed unread, a second copy stood, the hold dropping a boarding)', async () => {
  const r = await room([{ id: 'a', hull: 2 }, { id: 'b', hull: 2 }]);
  const A = r.get('a'), B = r.get('b');
  const R = { id: 'r16.16.1', seed: 0x51f00d, pos: [700, 0, 0], yaw: Math.PI / 2, ahead: [900, 0, 0] };
  A.s.host.raiders([R], { sight: 0, spent: new Set() });
  r.run(1);
  const copy = bySeed(B, R.seed);
  assert.ok(copy && copy.owner === 'a');
  B.s.host.raiders([R], { sight: 0, spent: new Set() });
  assert.equal([...B.s.host._sea.values()].filter((e) => e.ship.seed === R.seed).length, 1, 'no second copy beside a\'s');
  A.present = false;
  r.run(OWNER_SWEEP_S + 0.6);
  assert.equal(copy.owner, null);
  B.s.host.raiders([R], { sight: 0, spent: new Set() });
  assert.equal(copy.raider?.id, R.id, 'her raider, by her seed');
  assert.deepEqual(B.s.host.raiderHeld().map((h) => h.id), [R.id], 'held on b\'s word');
  // taken over from me in turn by a stronger claim: no raider of mine to hold or spend
  B.s.host.applyWord('c', { s: [[...navalWireRecord({ ships: [{ n: 7, classId: copy.ship.cls.id, variant: 0, pos: copy.ship.pos, yaw: 0, speed: 0, sails: 1, hull: 1, sail: 1, crew: 1, state: 'afloat', heel: 0, seed: R.seed, fire: false, gen: 2, region: 23 }] }).s[0]]], v: [], b: [] }, (p) => p);
  assert.deepEqual([copy.owner, copy.gen, copy.raider], ['c', 2, null], 'yielded: hers, not my raider');
  assert.deepEqual(B.s.host.raiderHeld(), []);
});

test('AUDIT NAV1 (online) A NUMBER SAID AGAIN for another ship (her stander\'s numbers come round after 65,536 launches): the one I had under it is gone at once, even going down - left sinking under the key the new ship takes, her hull was never let go (mutants: the old one let go to finish)', async () => {
  const h = await sea({ hull: 2 });
  const word = (seed, state) => ({ s: [navalWireRecord({ ships: [{ n: 5, classId: 'merchantGalleon', variant: 0, pos: [200, 0, 100], yaw: 0, speed: 0, sails: 1, hull: 1, sail: 1, crew: 1, state, heel: 0, seed, fire: false }] }).s[0]], v: [], b: [] });
  h.host.applyWord('z', word(11, 'sinking'), (p) => p);
  h.run(0.3);
  const old = h.host._sea.get('z:5');
  assert.ok(old?.boat);
  const removed = h.pool.remove.bind(h.pool);
  let gone = null;
  h.pool.remove = (b) => { if (b === old.boat) gone = b; return removed(b); };
  h.host.applyWord('z', word(12, 'afloat'), (p) => p);
  assert.equal(gone, old.boat, 'her hull let go');
  assert.equal(h.host._sea.get('z:5').ship.seed, 12, 'the number is the new ship\'s');
  assert.equal([...h.host._sea.values()].filter((e) => e.ship.seed === 11).length, 0);
});

/** A player's boat moved where the test wants it, and their feet with it. */
const moor = (c, pos) => { c.s.boat.GameObject.position = [...pos]; c.s.view.feet = [...pos]; };

test('AUDIT NAV1 (online #6) THE LAW BY EACH PLAYER\'S OWN: the navy another player stands hunted everyone by that player\'s notoriety - it sailed past a wanted peer and engaged a lawful one when its stander was the wanted - and a peer\'s piracy beside a navy provoked no one; now each player\'s word says their own notoriety, the captains judge each by it, and any player\'s blow on a lawful ship provokes the navy that saw it (mutants: the stander\'s law for all, the peer\'s word unread, the witness the stander\'s alone)', async () => {
  const r = await room([{ id: 'a', hull: 2 }, { id: 'b', hull: 2 }]);
  const A = r.get('a'), B = r.get('b');
  moor(B, [150, 0, 0]);
  const navy = stand(A, 'navyCutter', [80, 0, 350]);
  assert.equal(navy.ship.names.crown, 'Wayrest');
  B.s.host.notoriety.add('Wayrest', NAVY_HUNTS);
  r.run(3);
  assert.deepEqual([navy.ship.mode, navy.ship.target], ['engage', 'b'], 'the wanted peer, by their own word');
  const q = await room([{ id: 'a', hull: 2 }, { id: 'b', hull: 2 }]);
  moor(q.get('b'), [0, 0, 300]);
  const qn = stand(q.get('a'), 'navyCutter', [20, 0, 380]);
  q.get('a').s.host.notoriety.add('Wayrest', NAVY_HUNTS);
  q.run(3);
  assert.equal(qn.ship.target, 'a', 'the wanted stander');
  q.run(10);
  assert.notEqual(qn.ship.target, 'b', 'never the lawful peer beside her');
  // a peer's blow on a lawful ship, a navy looking on: provoked by them
  const w = await room([{ id: 'a', hull: 2 }, { id: 'b', hull: 2 }]);
  moor(w.get('b'), [0, 0, 300]);
  const trader = stand(w.get('a'), 'merchantGalleon', [60, 0, 420]);
  const witness = stand(w.get('a'), 'navyCutter', [-60, 0, 460]);
  w.run(1);
  assert.equal(w.get('a').s.host.applyPeerHit('b', { to: 'a', nv: { n: trader.n, h: 30, s: 0, c: 0, f: 0, z: 0 } }), true);
  assert.ok(witness.ship.provoked.has('b'), 'the navy saw b fire on her');
});

test('AUDIT NAV1 (online #7) A PIRATE\'S BARREL under another player\'s boat blew with no hurt to them (the barrel\'s word named no ship, so it read as a player\'s) and lay on floating on her stander\'s screen - now her barrel says her number: it blows under any player\'s boat and their own client takes it; a player\'s own barrel still never hurts another; and on her stander\'s screen it blows too, the victim alone judging it; her own barrel, dropped by her captain, the whole road (mutants: the shooter unsaid, read as a player\'s, another\'s boat passed through)', async () => {
  const r = await room([{ id: 'a', hull: 2 }, { id: 'b', hull: 2 }]);
  const A = r.get('a'), B = r.get('b');
  moor(B, [0, 0, 250]);
  const brig = stand(A, 'pirateBrig', [200, 0, 400]);
  r.run(1);
  const hullOf = (c) => c.s.host.hudModel()?.ship?.hull;
  const hull0 = hullOf(B);
  assert.equal(hull0, 1);
  const word = (shooter) => ({ ...A.s.host.word((p) => p), b: [[77 + shooter, 0, 0, 250, shooter]] });
  B.s.host.applyWord('a', word(-1), (p) => p);
  for (let t = 0; t < BARREL_ARM + 1; t += 0.1) B.s.host.frame(0.1);
  assert.equal(hullOf(B), hull0, 'the owner\'s own barrel: never mine to take');
  B.s.host.applyWord('a', word(brig.n), (p) => p);
  for (let t = 0; t < BARREL_ARM + 1; t += 0.1) B.s.host.frame(0.1);
  assert.ok(hullOf(B) < hull0, `her barrel blew under me (${hullOf(B).toFixed(3)})`);
  // her stander's screen: her barrel blows under b's boat too - the blast heard, the barrel gone; a player's never meets b
  A.s.host._shots.dropBarrel({ id: 'mine', shooter: 'me:42', pos: [0, 0, 250], resolve: true });
  A.s.host._shots.dropBarrel({ id: 'hers', shooter: brig.id, pos: [0, 0, 250], resolve: true });
  const heard = A.s.log.sounds.length;
  for (let t = 0; t < BARREL_ARM + 1; t += 0.1) A.s.host.frame(0.1);
  const left = A.s.host._shots.floaters().map((f) => f.id);
  assert.ok(!left.includes('hers') && left.includes('mine'), `hers blew, mine floats on (${left})`);
  assert.ok(A.s.log.sounds.slice(heard).some(([k]) => k === NAVAL_SFX.blast), 'the blast heard');
  // the whole road: her own barrel, dropped as her captain drops one for a pursuer close under her stern, said with her
  // number, and blowing under b's boat on b's own client
  const q = await room([{ id: 'a', hull: 2 }, { id: 'b', hull: 2 }]);
  moor(q.get('a'), [0, 0, -700]);
  moor(q.get('b'), [0, 0, 250]);
  const chaser = stand(q.get('a'), 'pirateBrig', [0, 0, 285]);
  q.run(0.2, 0.1);
  assert.deepEqual(q.get('a').s.host.word((p) => p).b.map((w) => w[4]), [chaser.n], 'her barrel said with her number');
  q.run(2.5, 0.1);
  assert.ok(hullOf(q.get('b')) < 1, `it blew under b (${hullOf(q.get('b'))?.toFixed(3)})`);
  assert.ok(q.get('b').s.log.sounds.some(([k]) => k === NAVAL_SFX.blast), 'heard on b\'s own screen');
});

test('AUDIT NAV1 (online #10) ANOTHER PLAYER\'S WRECK: a pirate beside a peer\'s wreck sat at 76 m for two minutes and never boarded - the peer could neither travel nor rest - and pirates grappled their stander alone; now each player\'s word says their boat\'s hurt and whether they let pirates board them: she comes alongside another\'s wreck as her stander\'s, and her grapple goes to them - they take her over and fight her boarders on their own deck; a player who does not let pirates board is spared (mutants: the peer never boarded, the grapple unsaid, the claim refused, the setting unread)', async () => {
  const wreck = { v: 1, boats: { 42: { hull: 0, sail: 0, crew: 0, fire: 0, state: 'wrecked', barrels: 0 } }, notoriety: {}, day: 1, raids: [] };
  const r = await room([{ id: 'a', hull: 2 }, { id: 'b', hull: 2, save: wreck }]);
  const A = r.get('a'), B = r.get('b');
  moor(A, [0, 0, -700]);
  const brig = stand(A, 'pirateBrig', [70, 0, 30]);
  let t = 0;
  for (; t < 90 && !B.s.host.boarding; t += 0.1) r.tick(0.1);
  assert.equal(B.s.host.boarding?.kind, 'repel', `her grapple came to b, who fights her boarders (${t.toFixed(0)} s)`);
  const hers = bySeed(B, brig.ship.seed);
  assert.deepEqual([hers.owner, hers.gen], [null, 1], 'b took her over at the grapple');
  r.run(1);
  assert.deepEqual([brig.owner, brig.gen], ['b', 1], 'a\'s copy is b\'s now');
  // b does not let pirates board: spared
  const q = await room([{ id: 'a', hull: 2 }, { id: 'b', hull: 2, save: wreck, settings: { ShipsAtSea: 'off', Boarders: false } }]);
  moor(q.get('a'), [0, 0, -700]);
  const spare = stand(q.get('a'), 'pirateBrig', [70, 0, 30]);
  q.run(20, 0.1);
  assert.notEqual(spare.ship.mode, 'board', 'never comes to board');
  assert.equal(q.get('b').s.host.boarding, null);
  q.run(WRECK_SPARE_S + 5, 0.1);
  assert.notEqual(spare.ship.target, 'b', 'and leaves the wreck be');
});

test('AUDIT NAV1 (online #6, #10) A PLAYER AS THE CAPTAINS SEE THEM is their own last word: their hull, a wreck, whether they let pirates board them and their notoriety by crown; a boat at a helm whose word has not come is whole, lawful and not to be boarded (mutants: each field unread, a silent boat boarded)', async () => {
  const r = await room([{ id: 'a', hull: 2 }, { id: 'b', hull: 2 }]);
  const A = r.get('a'), B = r.get('b');
  moor(B, [0, 0, 200]);
  const peerOf = () => A.s.host._contacts().find((c) => c.id === 'b');
  let c = peerOf();
  assert.ok(c?.peer, 'b at her helm: a contact');
  assert.deepEqual([c.hullShare, c.crippled, c.boarders, c.notoriety('Wayrest')], [1, false, false, 0], 'no word yet');
  const wayrest = CROWNS.findIndex((k) => k.name === 'Wayrest');
  assert.equal(A.s.host.applyWord('b', { p: [20, 1, 1], n: [[wayrest, 60]] }, (p) => p), true);
  c = peerOf();
  assert.deepEqual([c.hullShare, c.crippled, c.boarders, c.notoriety('Wayrest'), c.notoriety('Sentinel')], [0.2, true, true, 60, 0]);
  A.s.host.applyWord('b', { p: [90, 0, 0] }, (p) => p);
  c = peerOf();
  assert.deepEqual([c.hullShare, c.crippled, c.boarders, c.notoriety('Wayrest')], [0.9, false, false, 0], 'each word whole: what it no longer says is gone');
  // b's own word, as b's client says it: her hull, her setting, her notoriety - and a wreck
  const hurt = { v: 1, boats: { 42: { hull: 100, sail: 50, crew: 10, fire: 0, state: 'afloat', barrels: 0 } }, notoriety: {}, day: 1, raids: [] };
  const q = await room([{ id: 'a', hull: 2 }, { id: 'b', hull: 2, save: hurt, settings: { ShipsAtSea: 'off', Boarders: false } }]);
  moor(q.get('b'), [0, 0, 200]);
  q.get('b').s.host.notoriety.add('Sentinel', 30);
  q.run(0.5);
  const share = q.get('b').s.host.hudModel().ship.hull;
  assert.ok(share > 0 && share < 1, `b hurt (${share})`);
  c = q.get('a').s.host._contacts().find((k) => k.id === 'b');
  assert.deepEqual([c.hullShare, c.crippled, c.boarders, c.notoriety('Sentinel')], [Math.round(share * 100) / 100, false, false, 30]);
  const wreck = { v: 1, boats: { 42: { hull: 0, sail: 0, crew: 0, fire: 0, state: 'wrecked', barrels: 0 } }, notoriety: {}, day: 1, raids: [] };
  const w = await room([{ id: 'a', hull: 2 }, { id: 'b', hull: 2, save: wreck }]);
  moor(w.get('b'), [0, 0, 200]);
  w.run(0.5);
  c = w.get('a').s.host._contacts().find((k) => k.id === 'b');
  assert.deepEqual([c.hullShare, c.crippled, c.boarders], [0, true, true], 'a wreck who lets pirates board');
});

test('AUDIT NAV1 (online #10) THE GRAPPLE\'S WORD is said to the victim every GRAPPLE_CLAIM_S while she lies alongside - never a frame\'s flood - and the victim alone takes her: at their helm, not already fighting, their own Boarders setting on, and only a pirate afloat (mutants: the cadence, each refusal)', async () => {
  const wreck = { v: 1, boats: { 42: { hull: 0, sail: 0, crew: 0, fire: 0, state: 'wrecked', barrels: 0 } }, notoriety: {}, day: 1, raids: [] };
  const settings = { ShipsAtSea: 'off', Boarders: true };
  const r = await room([{ id: 'a', hull: 2 }, { id: 'b', hull: 2, save: wreck, settings }, { id: 'c', hull: null }]);
  const A = r.get('a'), B = r.get('b'), C = r.get('c');
  moor(A, [0, 0, -700]);
  const brig = stand(A, 'pirateBrig', [70, 0, 30]);
  const claims = [];
  const take = B.s.host.applyPeerHit;
  B.s.host.applyPeerHit = (from, body) => { if (body.nv?.g) { claims.push(r.t); return false; } return take(from, body); };
  for (let t = 0; t < 90 && !claims.length; t += 0.1) r.tick(0.1);
  assert.ok(claims.length, 'alongside, her grapple said');
  r.run(10, 0.1);
  const n = claims.length - 1;
  assert.ok(n >= Math.floor(10 / GRAPPLE_CLAIM_S) - 1 && n <= Math.ceil(10 / GRAPPLE_CLAIM_S) + 1, `${n} claims in 10 s`);
  B.s.host.applyPeerHit = take;
  const grapple = (e) => ({ to: 'b', nv: { n: e.n, h: 0, s: 0, c: 0, f: 0, z: 0, g: 1 } });
  settings.Boarders = false;
  assert.equal(B.s.host.applyPeerHit('a', grapple(brig)), false, 'b does not let pirates board');
  settings.Boarders = true;
  const trader = stand(A, 'merchantGalleon', [-120, 0, 60]);
  r.run(0.6);
  assert.equal(B.s.host.applyPeerHit('a', grapple(trader)), false, 'a merchantman boards no one');
  assert.equal(B.s.host.applyPeerHit('a', { to: 'b', nv: { n: 999, h: 0, s: 0, c: 0, f: 0, z: 0, g: 1 } }), false, 'no such ship');
  assert.equal(C.s.host.applyPeerHit('a', { ...grapple(brig), to: 'c' }), false, 'c is at no helm');
  const struck = stand(A, 'pirateSloop', [-150, 0, 90]);
  r.run(0.6);
  const hers = bySeed(B, struck.ship.seed);
  hers.ship.damage.restore({ ...hers.ship.damage.snapshot(), state: SHIP_STATES.struck });
  assert.equal(B.s.host.applyPeerHit('a', grapple(struck)), false, 'her colours struck: she boards no one');
  assert.equal(B.s.host.applyPeerHit('a', grapple(brig)), true, 'b takes her over');
  assert.equal(B.s.host.boarding?.kind, 'repel');
  const second = stand(A, 'pirateSloop', [-60, 0, -40]);
  r.run(0.6);
  assert.equal(B.s.host.applyPeerHit('a', grapple(second)), false, 'one fight at a time');
});

test('AUDIT NAV1 (online #6) THE WATERS DRAW THE NAVY after the most notorious player in them - the stander\'s director weighed its own notoriety alone (mutants: the stander\'s alone, the peers\' unread)', async () => {
  const r = await room([{ id: 'a', hull: 2 }, { id: 'b', hull: 2 }]);
  const A = r.get('a'), B = r.get('b');
  const seen = [];
  const director = A.s.host.directorState, step = director.step;
  director.step = (d, ctx) => { seen.push(ctx.notoriety); return step.call(director, d, ctx); };
  r.run(1);
  assert.equal(seen.at(-1), 0);
  B.s.host.notoriety.add('Wayrest', 70);
  r.run(3);
  assert.equal(seen.at(-1), 70, 'b\'s, the most notorious');
  A.s.host.notoriety.add('Wayrest', 80);
  r.run(1);
  assert.equal(seen.at(-1), 80, 'a\'s own when it is the most');
});

test('AUDIT NAV1 (online) ANOTHER PLAYER\'S BOAT STOPS A SHIP\'S BALL on the stander\'s screen, and tears on her canvas - it flew through her as through the air, splinters and all unseen - and a player\'s ball passes her by, mine or another\'s (no fight between players at sea) (mutants: her boat no target, a player\'s ball stopped - mine, a peer\'s, any - the ball\'s law and the canvas\'s unread)', async () => {
  const r = await room([{ id: 'a', hull: 2 }, { id: 'b', hull: 2 }]);
  const A = r.get('a'), B = r.get('b');
  moor(A, [0, 0, -700]);
  moor(B, [0, 0, 250]);
  const brig = stand(A, 'pirateBrig', [300, 0, 600]);
  r.run(0.5);
  const c = hullBoxOf(B.s.boat, A.s.pool.models).c, canvas = rigBoxesOf(B.s.boat)[0].c;
  const shots = A.s.host._shots;
  const fly = (shooter, at = c) => {
    shots.clear();
    shots.fireVolley({ id: `t-${shooter}`, shooter, resolve: true, launches: [{ gun: 'long', index: 0, p0: [at[0], at[1], at[2] - 60], v0: [0, 0.981, 300], delay: 0 }] });
    for (let t = 0; t < 0.4; t += 1 / 60) A.s.host.frame(1 / 60);
    return shots.inFlight;
  };
  const struck = (from) => A.s.log.sounds.slice(from).some(([k]) => k === NAVAL_SFX.hit);
  let heard = A.s.log.sounds.length;
  assert.equal(fly('me:42'), 1, 'a player\'s ball passes her by');
  assert.equal(fly('peer:c'), 1, 'another player\'s too');
  assert.equal(fly('me:42', canvas), 1);
  assert.ok(!struck(heard), 'no splinter, no torn canvas');
  heard = A.s.log.sounds.length;
  assert.equal(fly(brig.id, canvas), 1, 'a ship\'s ball tears through her canvas and flies on');
  assert.ok(struck(heard), 'heard through her canvas');
  heard = A.s.log.sounds.length;
  assert.equal(fly(brig.id), 0, 'and stops on her hull');
  assert.ok(struck(heard), 'heard striking her');
});

test('AUDIT NAV1 (online #15) A VOLLEY HEARD LATE landed late by the word\'s cadence - by a word and more when a later one first carried it - where her mark no longer lay; now each volley says its age and a reader flies it from as far along as it is, in step with her shooter\'s (mutants: the age unsaid, unread, the balls started at their fire)', async () => {
  const online = { id: () => 'b-player', peers: () => [{ id: 'a-player', feet: [0, 0, 0] }], sendHit: () => true };
  const prompt = await sea({ hull: 2, online, pool: await freshPool() });
  const late = await sea({ hull: 2, online, pool: await freshPool() });
  const word = (age) => ({ s: [], v: [[9, -1, 2, 0, 0, 3, 400, Math.PI, 0, 0, 0.05, 4242, 0.6, age]], b: [] });
  prompt.host.applyWord('a-player', word(0), (p) => p);
  for (let i = 0; i < 18; i++) prompt.host.frame(1 / 30);
  late.host.applyWord('a-player', word(600), (p) => p);   // the word that first carried her, 600 ms after she fired
  prompt.host.frame(0.2); late.host.frame(0.2);
  const at = (h) => h.host._shots.balls().map((b) => b.pos.map((v) => +v.toFixed(3)));
  assert.ok(at(prompt).length >= 4, 'her balls in flight');
  assert.deepEqual(at(late), at(prompt), 'the late reader\'s balls where the prompt one\'s are');
  // and my own word says each volley's age as it stands
  const h = await sea({ hull: 2, online: { id: () => 'a-player', peers: () => [], sendHit: () => true }, pool: await freshPool() });
  h.host.attackInput(true); h.host.frame(0.1); h.host.attackInput(false);
  h.host.frame(0.25);
  assert.deepEqual(h.host.word((p) => p).v.map((v) => v[13]), [250]);
});

test('AUDIT NAV1 (online #15) A LATE BALL FLIES ITS ARC: a flight the step came to late - a peer\'s volley heard after she fired, a hitched frame - is walked BALL_STEP_S at a time, so it strikes what its arc passes through, never only what the chord between its ends does (mutants: the chord across the arc)', () => {
  const p0 = [0, 5, 0], v0 = [0, 3, 60], back = 0.6;
  const mid = shotPosition(p0, v0, back / 2, undefined, [0, 0, 0]), end = shotPosition(p0, v0, back, undefined, [0, 0, 0]);
  const chordY = (p0[1] + end[1]) / 2;
  assert.ok(mid[1] - chordY > 0.4, `the arc stands over its chord (${(mid[1] - chordY).toFixed(2)} m)`);
  // a plank across the arc's middle, clear of the chord by more than a ball's radius
  const lo = chordY + 0.2, hi = mid[1] + 0.2;
  const plank = { id: 'plank', box: { c: [mid[0], (lo + hi) / 2, mid[2]], ax: [1, 0, 0], ay: [0, 1, 0], az: [0, 0, 1], h: [3, (hi - lo) / 2, 0.5] } };
  const struck = (fly) => {
    const events = [];
    const field = createShotField({ seaY: () => 0, targets: () => [plank], onEvent: (e) => events.push(e), random: () => 0.5 });
    fly(field);
    return events.some((e) => e.type === 'hit' && e.target === 'plank');
  };
  const launch = [{ gun: 'long', index: 0, p0, v0, delay: 0 }];
  assert.equal(struck((f) => { f.fireVolley({ id: 'v', shooter: 'ship', launches: launch, since: back }); f.step(0.01); }), true, 'heard late');
  assert.equal(struck((f) => { f.fireVolley({ id: 'v', shooter: 'ship', launches: launch }); f.step(0); f.step(back + 0.01); }), true, 'a hitched frame');
  assert.ok(BALL_STEP_S <= 0.1);
});

test('AUDIT NAV1 (online #15) MY WORD AFTER THE WORLD MOVED: the volleys and barrels it keeps were said where they were fired in the frame before an origin shift - an origin\'s move away, for as long as it kept them; now they move with the world (mutants: the volleys left behind, the barrels left behind)', async () => {
  const h = await sea({ hull: 2, online: { id: () => 'a-player', peers: () => [], sendHit: () => true }, pool: await freshPool() });
  h.host.attackInput(true); h.host.frame(0.1); h.host.attackInput(false);
  h.view.look = { origin: [0, 5, 0], dir: [0, -0.2, -1] };
  h.host.attackInput(true); h.host.frame(0.1); h.host.attackInput(false);
  const said = () => { const w = h.host.word((p) => p); return [...w.v.map((v) => v.slice(4, 7)), ...w.b.map((b) => b.slice(1, 4))]; };
  const before = said();
  assert.equal(before.length, 2, 'a volley and a barrel');
  h.host.offsetAll([100, 0, -50]);
  assert.deepEqual(said(), before.map(([x, y, z]) => [+(x + 100).toFixed(2), y, +(z - 50).toFixed(2)]));
});

test('AUDIT NAV1 (online #15) ONE SEA, ONE TRAFFIC: the stander sailed everyone\'s sea at its own Ships at sea - a player who chose few met its many - now each word says its player\'s and a shared sea is sailed at the lowest of those who share it; a player out of reach counts for nothing (mutants: the stander\'s alone, a peer\'s unread, the unsaid default misread, the reach unbounded)', async () => {
  const bSet = { ShipsAtSea: 'few' };
  const r = await room([{ id: 'a', hull: 2, settings: { ShipsAtSea: 'many' } }, { id: 'b', hull: 2, settings: bSet }]);
  const A = r.get('a'), B = r.get('b');
  const seen = [];
  const director = A.s.host.directorState, step = director.step;
  director.step = (d, ctx) => { seen.push(ctx.density); return step.call(director, d, ctx); };
  r.run(1);
  assert.equal(seen.at(-1), DENSITY.few, 'b chose few: the shared sea sails at few');
  bSet.ShipsAtSea = 'some';
  r.run(1);
  assert.equal(seen.at(-1), DENSITY.some, 'b\'s word says nothing of it now: the default');
  moor(B, [0, 0, NAVAL_SHARE_RADIUS + 400]);
  bSet.ShipsAtSea = 'few';
  r.run(1);
  assert.equal(seen.at(-1), DENSITY.many, 'b out of reach: a\'s own');
});

test('AUDIT NAV1 (online #14) A PEER\'S VOLLEYS BOUNDED: a word says NAVAL_WIRE_VOLLEYS and nothing bounded how many of them were new - word after word of them flew here; now at most PEER_VOLLEYS_MAX of one player\'s are flown in NAVAL_VOLLEY_KEEP_MS, the rest seen and never flown (mutants: the bound unread, the window never emptied)', async () => {
  const h = await sea({ hull: 2, online: { id: () => 'b-player', peers: () => [{ id: 'a-player', feet: [0, 0, 0] }], sendHit: () => true }, pool: await freshPool() });
  let flown = 0;
  const fire = h.host._shots.fireVolley;
  h.host._shots.fireVolley = (v) => { flown++; return fire(v); };
  const word = (k) => ({ s: [], v: Array.from({ length: NAVAL_WIRE_VOLLEYS }, (_, i) => [k * 100 + i, -1, 2, 0, 0, 3, 400, Math.PI, 0, 0, 0.05, 4242 + i, 0.6]), b: [] });
  for (let k = 0; k < 5; k++) { h.host.applyWord('a-player', word(k), (p) => p); h.host.frame(0.2); }
  assert.equal(flown, PEER_VOLLEYS_MAX);
  h.host.applyWord('a-player', word(0), (p) => p);
  assert.equal(flown, PEER_VOLLEYS_MAX, 'the ones seen are never flown later');
  h.host.frame(NAVAL_VOLLEY_KEEP_MS / 1000);
  h.host.applyWord('a-player', word(9), (p) => p);
  assert.equal(flown, PEER_VOLLEYS_MAX + NAVAL_WIRE_VOLLEYS, 'the window past, a word\'s worth flies again');
});

/** A ship of a's sunk by b's blows, her casks afloat in a's sea. */
function sinkFor(r, classId = 'merchantGalleon', pos = [0, 0, 100]) {
  const A = r.get('a');
  const e = stand(A, classId, pos);
  r.run(0.5);
  for (let i = 0; i < 40 && e.ship.damage.state !== SHIP_STATES.sinking; i++) { A.s.host.applyPeerHit('b', navalHitData('a', { n: e.n, hull: 400 })); r.run(0.5); }
  assert.equal(e.ship.damage.state, SHIP_STATES.sinking);
  return e;
}
const casksOf = (c, owner = null) => c.s.host._shots.floaters().filter((f) => f.kind === 'flotsam' && f.owner === owner);

test('AUDIT NAV1 (online #15) A SUNK SHIP\'S CASKS, EVERY PLAYER\'S TO HAUL: her casks floated in her stander\'s sea alone - a peer who sank her saw none - now they ride the stander\'s word, every player sees them where they float, and any player\'s boat hauls one in, claimed of their owner and drawn on the answer: one cask, one haul, whoever else reached it (mutants: the casks unsaid, unread, a peer\'s cask drawn unclaimed, the claim unanswered, answered twice, the answer unread, a cask gone from the word kept)', async () => {
  const r = await room([{ id: 'a', hull: 2 }, { id: 'b', hull: 2 }, { id: 'c', hull: 2 }]);
  const A = r.get('a'), B = r.get('b'), C = r.get('c');
  moor(A, [0, 0, -700]); moor(B, [0, 0, 300]); moor(C, [0, 0, 500]);
  sinkFor(r);
  const afloat = casksOf(A);
  assert.ok(afloat.length >= 1, 'what floats free of her, in a\'s sea');
  r.run(0.5);
  for (const X of [B, C]) assert.deepEqual(casksOf(X, 'a').map((f) => f.id).sort(), afloat.map((f) => `a:${f.id}`).sort(), 'every player sees them, a\'s');
  const near = (X, f) => Math.hypot(X.s.host._shots.floater(`a:${f.id}`).pos[0] - f.pos[0], X.s.host._shots.floater(`a:${f.id}`).pos[2] - f.pos[2]);
  assert.ok(afloat.every((f) => near(B, f) < 0.8), 'where a says they float');
  A.s.host._shots.floater(afloat[0].id).pos[0] += 6;   // her sea's drift, not mine
  r.run(0.5);
  assert.ok(near(B, afloat[0]) < 0.8, 'and where a says it drifted');
  // b and c sail through them at once
  moor(B, afloat[0].pos); moor(C, afloat[0].pos);
  r.run(1);
  const hauled = B.s.log.given.length + C.s.log.given.length;
  assert.equal(hauled, afloat.length - casksOf(A).length, 'each cask hauled once, whoever reached it');
  assert.ok(hauled >= 1);
  assert.equal(A.s.log.given.length, 0, 'never drawn by their owner');
  r.run(1);
  for (const X of [B, C]) assert.equal(casksOf(X, 'a').length, casksOf(A).length, 'a cask hauled is gone from every screen');
});

test('AUDIT NAV1 (online #15) A CASK\'S CLAIM HELD TO ITS END: an answer lost is answered again on the claim said again, and drawn once whatever answers come; a departed owner\'s casks are their heir\'s, the same casks said in the heir\'s word; an owner\'s empty word never leaves a cask for an heir to raise again (mutants: the claim said once, answered twice, the heir\'s own new casks, the empty word\'s casks kept)', async () => {
  const r = await room([{ id: 'a', hull: 2 }, { id: 'b', hull: 2 }, { id: 'c', hull: 2 }]);
  const A = r.get('a'), B = r.get('b'), C = r.get('c');
  moor(A, [0, 0, -700]); moor(B, [0, 0, 300]); moor(C, [0, 0, 500]);
  sinkFor(r);
  r.run(0.5);
  const cask = casksOf(A)[0], before = casksOf(A).length;
  // the first answer to b lost on the wire
  const take = B.s.host.applyPeerHit;
  let lost = null;
  B.s.host.applyPeerHit = (from, body) => { if (body.nv?.a && !lost) { lost = body; return false; } return take(from, body); };
  moor(B, cask.pos);
  r.run(0.5);
  const answered = before - casksOf(A).length;
  assert.ok(lost && answered >= 1, 'answered');
  assert.equal(B.s.log.given.length, answered - 1, 'the answer lost: that cask not drawn yet');
  r.run(CLAIM_AGAIN_S + 0.5);
  assert.equal(B.s.log.given.length, answered, 'the claim said again, answered again: drawn');
  B.s.host.applyPeerHit = take;
  assert.equal(B.s.host.applyPeerHit('a', lost), false, 'the lost answer come late: never drawn twice');
  assert.equal(B.s.log.given.length, answered);
  assert.ok(CLAIM_WAIT_S > CLAIM_AGAIN_S);
  // a's answer kept GRANT_KEEP_S for b's claim said again - and forgotten after
  const claim = { to: 'a', nv: { ...lost.nv } };
  delete claim.nv.a;
  assert.equal(A.s.host.applyPeerHit('b', claim), true, 'b\'s claim said again: answered again');
  r.run(GRANT_KEEP_S + 1);
  assert.equal(A.s.host.applyPeerHit('b', claim), false, 'forgotten');
  // a claim that never reaches its owner: the cask kept from my screen while the claim waits, back when it is given up
  const w = await room([{ id: 'a', hull: 2 }, { id: 'b', hull: 2 }]);
  moor(w.get('a'), [0, 0, -700]); moor(w.get('b'), [0, 0, 300]);
  sinkFor(w);
  w.run(0.5);
  const lone = casksOf(w.get('a'))[0];
  const hear = w.get('a').s.host.applyPeerHit;
  w.get('a').s.host.applyPeerHit = (from, body) => (body.nv?.k != null ? false : hear(from, body));
  moor(w.get('b'), lone.pos);
  w.run(0.5);
  moor(w.get('b'), [0, 0, 300]);
  w.run(CLAIM_WAIT_S - 2);
  assert.equal(w.get('b').s.host._shots.floater(`a:${lone.id}`), null, 'claimed: not stood again from a\'s word while it waits');
  w.run(3);
  assert.ok(w.get('b').s.host._shots.floater(`a:${lone.id}`), 'given up: back where a says it floats');
  assert.equal(w.get('b').s.log.given.length, 0);
  // a departed: their casks the heir's - the same casks, said in b's word, c's own copies taken over
  const h = await room([{ id: 'a', hull: 2 }, { id: 'b', hull: 2 }, { id: 'c', hull: 2 }]);
  moor(h.get('a'), [0, 0, -700]); moor(h.get('b'), [0, 0, 300]); moor(h.get('c'), [0, 0, 500]);
  const sunk = sinkFor(h);
  for (let t = 0; t < 60 && h.get('a').s.host._sea.has(sunk.id); t += 1) h.run(1);
  assert.equal(h.get('a').s.host._sea.has(sunk.id), false, 'her hull gone: a\'s sea is her casks alone');
  h.run(0.5);
  const left = casksOf(h.get('a')).map((f) => f.id);
  assert.ok(left.length >= 1, 'her casks afloat');
  h.get('a').present = false;
  h.run(OWNER_SWEEP_S + 1);
  assert.deepEqual(casksOf(h.get('b')).map((f) => f.id).sort(), [...left].sort(), 'b takes them over where they float');
  assert.deepEqual(casksOf(h.get('c'), 'b').map((f) => f.id).sort(), left.map((id) => `b:${id}`).sort(), 'c\'s the same casks, b\'s now');
  assert.equal(casksOf(h.get('c'), 'a').length, 0);
  // no heir's word: a non-heir's orphans let go after ORPHAN_S
  const o = await room([{ id: 'a', hull: 2 }, { id: 'b', hull: 2 }, { id: 'c', hull: 2 }]);
  moor(o.get('a'), [0, 0, -700]); moor(o.get('b'), [0, 0, 300]); moor(o.get('c'), [0, 0, 500]);
  sinkFor(o);
  o.run(0.5);
  assert.ok(casksOf(o.get('c'), 'a').length >= 1);
  o.get('b').quiet = true;
  o.get('a').present = false;
  o.run(OWNER_SWEEP_S + 1);
  assert.ok(casksOf(o.get('c'), 'a').length >= 1, 'kept for the heir\'s word');
  o.run(ORPHAN_S + OWNER_SWEEP_S);
  assert.equal(casksOf(o.get('c'), 'a').length, 0, 'no word came: let go');
  // an empty word: nothing of theirs afloat, never a cask for their heir to raise
  const q = await room([{ id: 'a', hull: null, settings: { ShipsAtSea: 'some' } }, { id: 'b', hull: 2 }]);
  moor(q.get('b'), [0, 0, 300]);
  const gone = sinkFor(q);
  for (let t = 0; t < 60 && q.get('a').s.host._sea.has(gone.id); t += 1) q.run(1);
  q.run(1);
  assert.deepEqual(Object.keys(q.get('a').s.host.word((p) => p)).filter((k) => q.get('a').s.host.word((p) => p)[k]?.length), ['f', 'w'], 'a\'s word: her casks and her wreckage alone');   // PIN MOVED (SALVAGE): her wreckage on `w`
  assert.ok(casksOf(q.get('b'), 'a').length >= 1);
  for (const f of casksOf(q.get('a'))) q.get('a').s.host._shots.removeFloater(f.id);   // hauled in by a's own
  assert.equal(q.get('a').s.host.word((p) => p), null, 'a says nothing now');
  q.run(1);
  assert.equal(casksOf(q.get('b'), 'a').length, 0, 'gone from b\'s screen');
  assert.equal(casksOf(q.get('b')).length, 0, 'and never b\'s to raise');
});
