// AUDIT NAV2 (2026-09-30) - THE LIVING CREW, SECOND PASS (slice D: Mac, "Crew members shouldnt be the static sprites and
// instead the enemy type sprites with multiple animations, they should navigate the deck, talk with each other, blurb,
// sing chantys, etc" and "Boarding scenarios should be seamless, with crew naturally getting into position and fighting
// enemies"). The crew, online and frame lenses' findings, each pinned on the real code:
//
//   THE BRAIN (systems/naval/crewLife.js) on the real hulls' decks and their own flats' places (Come Sail Away's pool):
//   the muster dealt fore to aft (F40) along her main deck's rail (F62, F40 after F34's raised decks), no two men on one
//   spot and a walker yielding to a walker (F41), the mood under the guns and struck (F46), the chanty's edges (F47), the
//   walks' edges (F48), a station taken onto her deck (F35), a Bard among any two (F51).
//   THE HOST (scenes/naval/navalCrew.js) over a stand-in renderer: a re-keyed ship and a hold let go (F6), a crew grown back and
//   emptied (F42), a concealed owner's crew (F50), first sight's cost (F58), no garbage a crewman (F59).
//   THE SEA (scenes/naval/navalHost.js crewShips/myCrew) and THE WORLD (scenes/world.js navalCrewFrame, lifted from its own
//   text): the muster called at boarding range in the real flows (F40), a ship going down (F45), a struck crew (F46),
//   one crew for every player in a room (F9), the arc off (F52), a window over the world (F53), the room's re-key (F6), a
//   Warm Ashes raid on my deck (F43).
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { asleepHour } from '../../../src/systems/naval/shipWatch.js';   // SHIP-WATCH: the crews' night
import { hourOf } from '../../../src/world/worldClock.js';
import * as crewLife from '../../../src/systems/naval/crewLife.js';
import * as navalCrewMod from '../../../src/scenes/naval/navalCrew.js';
import { buildDeck, intoDeck, DECK_STEP } from '../../../src/systems/naval/navalDeck.js';
import { boxColliderTriangles } from '../../../src/world/prefabColliders.js';
import { MOBILE, GRAPPLE_S, HANDS_MAX } from '../../../src/systems/naval/navalBoarding.js';
import { classById, hullBuild } from '../../../src/systems/naval/navalShips.js';
import { SHIP_STATES } from '../../../src/systems/naval/navalDamage.js';
import { Boat, spawnBoat } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { OWNER_SWEEP_S } from '../../../src/scenes/naval/navalHost.js';
import { ctxFor } from '../../csaScene.mjs';
import { sea, readyPool } from '../../navalSea.mjs';
import { room } from '../../navalRoom.mjs';

const { createCrewLife, crewRoster, crewCount, deckExtentZ, sung, CREW_BLURBS, CREW_TALKS, CHANTIES, CHANTY_S, CREW_BLOCKED_S, CREW_SHOWN, PLAYER_CREW } = crewLife;
const { createNavalCrew, peopleFlatsOf, mainLevel, CREW_RANGE, CREW_KEEP } = navalCrewMod;
const WORLD = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
const SRC = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

const DT = 1 / 30;
const settle = () => new Promise((r) => setTimeout(r, 0));
const pirate = classById('pirateBrig');
/** A plain deck: a flat 8 m by 24 m at 2 m (her frame) with a mast amidships (livingcrew.test.js's). */
const plainDeck = () => buildDeck([
  { positions: [-4, 2, -12, 4, 2, -12, 4, 2, 12, -4, 2, 12], indices: [0, 1, 2, 0, 2, 3] },
  boxColliderTriangles({ m_Center: { x: 0, y: 6, z: 0 }, m_Size: { x: 1.2, y: 8, z: 1.2 } }),
], { minX: -6, maxX: 6, minZ: -14, maxZ: 14 });
/** A hull built at rest, as the pool builds one. */
const hullOf = (hull) => { const b = new Boat(hull, 0); spawnBoat(b, ctxFor({ position: [0, 0, 0], rotation: [0, 0, 0, 1] })); return b; };
/** Her flats' places on and above her main deck - the host's own hand-in (navalCrew.js sync). */
const placesOf = (boat, deck) => peopleFlatsOf(boat).filter((f) => f.feet[1] >= mainLevel(deck) - DECK_STEP).map((f) => f.feet);
/** The flats on and above her main deck, and how many of them stand. */
const deckFlats = (boat, deck) => peopleFlatsOf(boat).filter((f) => f.feet[1] >= mainLevel(deck) - DECK_STEP);
const shown = (flats) => flats.filter((f) => f.renderer.m_Enabled !== false).length;
/** The host over a stand-in renderer and textures (livingcrew.test.js's): its batches, the keys it probed. */
function host() {
  const made = [], destroyed = [], probed = [];
  const textures = new Map();
  textures.has = (k) => { probed.push(k); return Map.prototype.has.call(textures, k); };
  const renderer = { createBillboardBatch: (archive, record, size) => { const b = { archive, record, size }; made.push(b); return b; }, destroyBillboardBatch: (b) => destroyed.push(b), textures };
  const tex = { getFrameCount: () => 4, getSize: () => ({ width: 40, height: 80 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 20 };
  const crew = createNavalCrew({ renderer, getTexture: async () => tex, uploadRecordFrame: (a, r, f) => Map.prototype.set.call(textures, `${a}_${r}#${f}`, {}), rand: () => 0.3 });
  return { crew, made, destroyed, probed, textures };
}
const entry = (boat, deck, o = {}) => ({ key: 'ship:1', boat, deck, count: 6, rosterOf: () => crewRoster({ hull: 2, seed: 3, shipClass: pirate }), seed: 3, faction: 'pirate', battle: false, ...o });

/**
 * scenes/world.js's navalCrewFrame, lifted from its own text with the block of helpers above it (`let _crewBoarding` on),
 * over the world's doors `s` stands in: the pool (`csa`), the modes, the naval host, the crew host, the eye, the player,
 * the arc's switch, the room and Come Sail Away's runtime.
 */
function liftCrewFrame(s) {
  const from = WORLD.indexOf('  let _crewBoarding = null;');
  const at = WORLD.indexOf('\n  function navalCrewFrame(dt) {', from);
  assert.ok(from > 0 && at > from, 'the crews\' frame in the world');
  const end = WORLD.indexOf('\n  }\n', at) + 5;
  // PIN MOVED (SHIP-WATCH): the crews' night - the world's hour (noon unless a test says), read through the watch's law
  const names = ['csa', 'modes', 'naval', 'navalCrew', 'cam', 'walkMode', 'playerSpawned', 'player', 'hullBuild', 'crewCount', 'crewRoster', 'intoDeck', 'CREW_KEEP', 'CREW_RANGE', 'navalOn', 'online', 'csaRuntime', 'asleepHour', 'hourOf', 'minuteNow'];
  // eslint-disable-next-line no-new-func
  return new Function('s', `const { ${names.join(', ')} } = s;\n${WORLD.slice(from, end)}\nreturn { navalCrewFrame };`)({
    modes: null, walkMode: false, playerSpawned: false, player: null, cam: { pos: [0, 5, 0] }, online: null, csaRuntime: null, navalOn: () => true,
    hullBuild, crewCount, crewRoster, intoDeck, CREW_KEEP, CREW_RANGE, asleepHour, hourOf, minuteNow: () => 12 * 60, ...s,
  });
}
/** The world's crews over a sea (navalSea.mjs): my crewed boat, the real crew host fed by the lifted frame, and the
 *  board door `crewOf` wired as the world wires it - each crew's walkers' states noted as the fight takes them. */
async function crewedSea(o = {}) {
  const h = await sea({ hull: 2, ...o });
  h.boat.crewed = true;
  const { crew } = host();
  const taken = [];
  h.deps.board.crewOf = (boat, n, opts) => {
    const ship = crew.ships().find((x) => x.boat === boat);
    if (ship) taken.push({ whose: boat === h.boat ? 'mine' : 'hers', walkers: ship.life.members.filter((m) => !m.gone && !m.station).map((m) => m.state) });
    return crew.takeByBoat(boat, n, opts);
  };
  const w = liftCrewFrame({ csa: { deckOf: (hull, v) => h.pool.deckOf(hull, v), boats: h.pool.boats, peerBoats: [] }, naval: h.host, navalCrew: crew, csaRuntime: h.runtime });
  const step = (seconds, dt = 0.1) => { for (let t = 0; t < seconds - 1e-9; t += dt) { h.host.frame(dt); w.navalCrewFrame(dt); } };
  return { h, crew, taken, w, step };
}
/** Each crew taken into the fight: how many of its walkers stood ready at the rail, of how many. */
const readyShare = (taken) => taken.map((t) => ({ whose: t.whose, ready: t.walkers.filter((s) => s === 'ready').length, of: t.walkers.length }));

// ── F6: a re-keyed ship, a hold let go ──────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV2 F6 THE RE-KEYED SHIP: a hand-over keeps her hull under a new key (online rekey/adopt/yieldTo) - her crew moves to it, one crew with the same men, every flat on her deck kept down; out of the list, every flat back (was: a second crew stood beside flats the first switched back on, and down for good once she left)', async () => {
  const pool = await readyPool();
  const deck = pool.deckOf(2, 0);
  const boat = hullOf(2);
  const flats = deckFlats(boat, deck);
  assert.ok(flats.length >= 4);
  const h = host();
  h.crew.sync([entry(boat, deck, { key: 'a:1' })]);
  const men = h.crew.ships()[0].life.members;
  assert.equal(shown(flats), 0);
  h.crew.sync([entry(boat, deck, { key: 'b:1' })]);
  assert.equal(shown(flats), 0, 're-keyed: her flats stay down');
  assert.equal(h.crew.ships().length, 1, 'one crew on her');
  assert.equal(h.crew.ships()[0].key, 'b:1');
  assert.equal(h.crew.ships()[0].life.members, men, 'the same men');
  assert.equal(h.crew.has('a:1'), false);
  h.crew.sync([entry(boat, deck, { key: 'b:1' })]);
  assert.equal(shown(flats), 0);
  h.crew.sync([]);
  assert.equal(shown(flats), flats.length, 'stood down: every flat back');
  h.crew.sync([entry(boat, deck, { key: 'c:1' })]);
  assert.equal(shown(flats), 0, 'and down again the next time she stands');
  h.crew.clear();
  assert.equal(shown(flats), flats.length);
});

test('AUDIT NAV2 F6 THE HOLD LET GO: a crew held off her deck (a room\'s boarding, her men the fight\'s) stands again whole when the hold ends while she stays in range - her flats down throughout (was: `held` never cleared, her deck empty for good)', async () => {
  const pool = await readyPool();
  const deck = pool.deckOf(2, 0);
  const boat = hullOf(2);
  const flats = deckFlats(boat, deck);
  const h = host();
  h.crew.sync([entry(boat, deck)]);
  await settle();
  h.crew.takeByBoat(boat, Infinity);
  h.crew.sync([entry(boat, deck, { hold: true })]);
  assert.equal(h.crew.ships()[0].life.standing(), 0, 'held: nobody');
  for (let i = 0; i < 30; i++) { h.crew.sync([entry(boat, deck, { hold: false })]); h.crew.frame(0.1, [0, 10, 0]); }
  assert.equal(h.crew.ships().length, 1);
  assert.equal(h.crew.ships()[0].life.standing(), 6, 'the hold over: her crew stands whole');
  assert.equal(shown(flats), 0, 'her flats down throughout');
  // first seen held (a prize's, another's fight) and let go the same way
  const fresh = hullOf(2);
  h.crew.sync([{ ...entry(fresh, deck, { hold: true }), key: 'ship:2' }]);
  assert.equal(h.crew.ships()[0].life.standing(), 0);
  h.crew.sync([{ ...entry(fresh, deck, { hold: false }), key: 'ship:2' }]);
  assert.equal(h.crew.ships()[0].life.standing(), 6);
  assert.equal(shown(deckFlats(fresh, deck)), 0);
});

test('AUDIT NAV2 F6 IN A ROOM: her stander leaves the cell and I take her over (navalHost releaseOwner -> adopt -> rekey, the same hull under my key) - my crew host, fed by the world\'s own frame, keeps one crew on her and her flats down; my eye gone, every flat back (was: 5 of 5 flats up beside the crew, then 0 of 5 for good)', async () => {
  const r = await room([{ id: 'a', hull: 2 }, { id: 'b', hull: 2 }]);
  const A = r.get('a'), B = r.get('b');
  const e = A.s.host._sea.get(A.s.host.spawnShip('merchantGalleon', { range: 70, bearing: 0.8, yaw: 0 }));
  e.ship.pos = [50, 0, 50];
  const { crew } = host();
  const cam = { pos: [0, 5, 0] };
  const w = liftCrewFrame({ csa: { deckOf: (hull, v) => B.s.pool.deckOf(hull, v), boats: [], peerBoats: [] }, naval: B.s.host, navalCrew: crew, cam });
  const tick = async (s) => { for (let t = 0; t < s; t += DT) { r.tick(DT); w.navalCrewFrame(DT); } await settle(); };
  await tick(1.5);
  const onB = [...B.s.host._sea.values()].find((x) => x.ship.seed === e.ship.seed);
  assert.ok(onB?.boat && crew.has(onB.id) && onB.owner === 'a', 'a stands her; her crew stands in my world');
  const flats = deckFlats(onB.boat, B.s.pool.deckOf(onB.boat.hull, 0));
  assert.equal(shown(flats), 0);
  const was = onB.id;
  A.present = false;
  await tick(OWNER_SWEEP_S + 0.6);
  assert.notEqual(onB.id, was, 'handed over: her key is mine now');
  assert.equal(shown(flats), 0, 'her flats stay down');
  assert.equal(crew.ships().filter((x) => x.boat === onB.boat).length, 1, 'one crew on her');
  assert.equal(crew.ships()[0].life.standing(), crewCount({ hull: 2, shipClass: onB.ship.cls, crewShare: onB.ship.damage.crewShare() }));
  cam.pos = [500, 5, 500];
  await tick(0.2);
  assert.equal(crew.ships().length, 0);
  assert.equal(shown(flats), flats.length, 'out of range: every flat back');
});

// ── F40: the muster, called at boarding range and dealt fore to aft ──────────────────────────────────────────────

test('AUDIT NAV2 F40 THE MUSTER CALLED AT BOARDING RANGE, a repel in the real flow: a pirate closing to board my crippled boat calls both crews to the rail before her grapples fly - her men to the side my boat will lie once she is alongside, however she comes up - at the fight\'s start every walker of mine stands ready at the rail, mustered since she closed within CREW_MUSTER_M, and half of hers and more (was: the grapple\'s 2.2 s alone, nobody but the stations ready)', async () => {
  for (const [cls, range, bearing] of [['pirateBrig', 200, 2.5], ['pirateBrig', 260, Math.PI / 2], ['pirateGalley', 260, Math.PI / 2]]) {
    const { h, taken, step } = await crewedSea({ save: { v: 1, boats: { 42: { hull: 0, sail: 0, crew: 24, fire: 0, state: 'wrecked', barrels: 4 } }, notoriety: {}, day: 1, raids: [] } });
    const id = h.host.spawnShip(cls, { range, bearing });
    const e = h.host._sea.get(id);
    let t = 0;
    for (; t < 180 && h.host.boarding?.phase !== 'fight'; t += 0.1) step(0.1);
    assert.equal(h.host.boarding?.kind, 'repel', `${cls} from ${range} m: she boarded me (${e.ship.mode}, ${t.toFixed(1)} s)`);
    const shares = readyShare(taken);
    assert.deepEqual(shares.map((x) => x.whose).sort(), ['hers', 'mine'], 'both crews taken into the fight');
    for (const x of shares) assert.ok(x.of > 0 && (x.whose === 'mine' ? x.ready === x.of : x.ready * 2 >= x.of), `${cls} from ${range} m - ${x.whose}: ${x.ready} of ${x.of} walkers ready at the fight's start`);
  }
});

test('AUDIT NAV2 F40 THE MUSTER CALLED AT BOARDING RANGE, my boarding in the real flow: a struck ship lying in my reach calls both crews to the rail before I throw the grapples - her to starboard or to port, at the fight\'s start every walker of either crew stands ready at the rail (was: 0 of 4 and 0 of 2, the grapple\'s 2.2 s alone)', async () => {
  for (const [cls, side] of [['merchantGalleon', 1], ['merchantCarrack', -1]]) {
    const { h, taken, step } = await crewedSea();
    const id = h.host.spawnShip(cls, { range: 30, bearing: side * Math.PI / 2, yaw: 0 });
    const e = h.host._sea.get(id);
    e.ship.pos = [side * (hullBuild(e.ship.hull).beam + hullBuild(2).beam + 12), 0, 0];
    step(3);   // both crews at their work
    e.ship.damage.apply({ hull: Math.ceil(e.ship.damage.maxHull * 0.8), sail: 0, crew: 0 });
    step(4);   // she strikes, lying in my reach a heave-to's few seconds; the board is pressed
    assert.equal(e.ship.damage.state, SHIP_STATES.struck);
    assert.equal(h.host.activate(), true);
    step(GRAPPLE_S + 0.3);
    assert.equal(h.host.boarding?.phase, 'fight');
    const shares = readyShare(taken);
    assert.deepEqual(shares.map((x) => x.whose).sort(), ['hers', 'mine']);
    for (const x of shares) assert.ok(x.of > 0 && x.ready === x.of, `${cls}: ${x.whose}: ${x.ready} of ${x.of} walkers ready at the fight's start`);
  }
});

test('AUDIT NAV2 F40 THE MUSTER\'S RANGE: a boarding at hand calls her crew to the rail within CREW_MUSTER_M of her, never from further off - the host keeps its point for the world\'s frame, and none when none is at hand', async () => {
  const pool = await readyPool();
  const deck = pool.deckOf(2, 0);
  const boat = hullOf(2);
  const h = host();
  const R = crewLife.CREW_MUSTER_M;
  assert.ok(R >= 100 && R < CREW_KEEP, 'the muster called while her crew stands in sight');
  h.crew.sync([entry(boat, deck, { toward: [R + 15, 0, 0] })]);
  assert.equal(h.crew.ships()[0].toward, null, 'further off: at their work');
  const at = [R - 15, 0, 0];
  h.crew.sync([entry(boat, deck, { toward: at })]);
  assert.equal(h.crew.ships()[0].toward, at, 'within it: to the rail');
  h.crew.sync([entry(boat, deck)]);
  assert.equal(h.crew.ships()[0].toward, null);
});

test('AUDIT NAV2 F40 THE RAIL DEALT FORE TO AFT: the muster\'s rail slots go to the men in the order they stand fore and aft - after a muster from a crew spread over her deck their order along the rail is their order before it, on the Small Ship and the Galley (was: dealt by roster index - walks across the whole deck, 190.9 m a muster on the galley)', async () => {
  const pool = await readyPool();
  for (const [hull, cls] of [[2, 'pirateBrig'], [3, 'navyGalley']]) {
    const deck = pool.deckOf(hull, 0);
    const places = placesOf(hullOf(hull), deck);
    for (let seed = 1; seed <= 6; seed++) {
      const life = createCrewLife({ deck, roster: crewRoster({ hull, seed, shipClass: classById(cls) }), seed, places, faction: classById(cls).faction });
      for (let f = 0; f < 45 / DT; f++) life.step(DT, {});   // at their work: spread fore and aft
      const walkers = life.members.filter((m) => !m.gone && !m.station);
      const before = [...walkers].sort((a, b) => a.pos[2] - b.pos[2] || a.i - b.i);
      const side = seed % 2 ? 1 : -1;
      let t = 0;
      for (; t < 40 && !walkers.every((m) => m.state === 'ready'); t += DT) life.step(DT, { muster: side });
      assert.ok(walkers.every((m) => m.state === 'ready'), `${cls} ${seed}: all at the rail (${t.toFixed(1)} s)`);
      assert.ok(walkers.every((m) => Math.abs(m.pos[0]) > 1.5 && Math.sign(m.pos[0]) === side), `${cls} ${seed}: at her ${side > 0 ? 'starboard' : 'port'} rail`);
      // the rail's places are the walkers' - a station keeps his post and takes none (her captain's and her helmsman's
      // on the Small Ship's poop sent her walkers to the forward half of it)
      // PIN MOVED (GALLEON, 2026-10-01): her main deck's rail - the new galleon's castle aft of it, up its flights
      const ext = deckExtentZ(deck, mainLevel(deck)), aft = Math.min(...walkers.map((m) => m.pos[2]));
      assert.ok(aft <= ext[0] + (ext[1] - ext[0]) / walkers.length + 0.5, `${cls} ${seed}: her aftmost walker at the rail's aftmost place (${aft.toFixed(1)})`);
      for (let k = 1; k < before.length; k++) {
        assert.ok(before[k - 1].pos[2] <= before[k].pos[2] + 1e-6, `${cls} ${seed}: the order fore and aft kept - #${before[k - 1].i} then #${before[k].i}: ${before.map((m) => `${m.i}@${m.pos[2].toFixed(1)}`).join(' ')}`);
      }
    }
  }
});

test('AUDIT NAV2 F62 THE MUSTER ON HER MAIN DECK (F40 after F34, found at the merge): F34 made her raised decks deck - the mod galleon\'s forecastle stair and top then, the new galleon\'s castle up its two flights now - and a muster dealt along the whole deck put a walker on them; her rail is her main deck\'s, on its own side of her centreline, on every hull, and a muster of eight hands on the new galleon\'s real deck stands its aftmost abreast her flights on her main deck, never a tread (was: a starboard muster\'s foremost man at 0.68 m to port on her forecastle\'s top row, a port muster\'s at 0.82 m to starboard beside her stair) (mutants: the rail asked at no level)', async () => {
  const pool = await readyPool();
  for (const hull of [1, 2, 3, 4]) {
    const deck = pool.deckOf(hull, 0);
    if (!deck.count) continue;
    const main = mainLevel(deck), [aft, fore] = deckExtentZ(deck);
    for (let z = aft; z <= fore + 1e-6; z += deck.cell) {
      for (const side of [1, -1]) {
        const r = deck.rail(side, z);
        assert.ok(r[0] * side >= 0, `hull ${hull}: her ${side > 0 ? 'starboard' : 'port'} rail at z ${z.toFixed(2)} on her ${side > 0 ? 'starboard' : 'port'} side (${r[0].toFixed(2)})`);
        const m = deck.rail(side, z, undefined, main);
        assert.ok(m[0] * side >= 0 && Math.abs(m[1] - main) <= DECK_STEP, `hull ${hull}: her main deck's ${side > 0 ? 'starboard' : 'port'} rail at z ${z.toFixed(2)}: ${m.map((v) => v.toFixed(2))}`);
      }
    }
    const [mAft, mFore] = deckExtentZ(deck, main);
    assert.ok(mAft >= aft && mFore <= fore, `hull ${hull}: her main deck's extent within her deck's`);
  }
  // the Small Ship's, through her crew's own muster: every walker ready at her main deck's rail on the side asked
  const deck = pool.deckOf(2, 0), main = mainLevel(deck);
  // PIN MOVED (GALLEON, 2026-10-01): the new galleon's raised deck is her castle, aft, up its two flights
  assert.ok(deckExtentZ(deck)[0] < deckExtentZ(deck, main)[0] - 5, 'her castle is her deck, aft of her main deck');
  for (let seed = 1; seed <= 6; seed++) {
    const life = createCrewLife({ deck, roster: crewRoster({ hull: 2, seed, shipClass: pirate }), seed, places: placesOf(hullOf(2), deck), faction: 'pirate' });
    for (let f = 0; f < 45 / DT; f++) life.step(DT, {});
    const side = seed % 2 ? 1 : -1;
    const walkers = life.members.filter((m) => !m.gone && !m.station);
    for (let t = 0; t < 40 && !walkers.every((m) => m.state === 'ready'); t += DT) life.step(DT, { muster: side });
    for (const m of walkers) {
      assert.equal(m.state, 'ready');
      assert.ok(m.pos[0] * side > 1.5 && Math.abs(m.pos[1] - main) <= DECK_STEP, `seed ${seed}: #${m.i} at her main deck's ${side > 0 ? 'starboard' : 'port'} rail: ${m.pos.map((v) => v.toFixed(2))}`);
    }
  }
  // AUDIT GALLEON T2 (2026-10-02): her own crews never reach her raised deck's rows - a hull-2 class stands six, her
  // officer and her coxswain at their stations on her castle, and four walkers' slots lie forward of her flights (her
  // main deck's extent ends at z -9.16; eight hands' aftmost slot, -7.44, falls on her flights' foot tread, a step up
  // and her main deck's band either way) - so the rail asked at no level survived on every hull. A muster of twelve
  // hands (no stations) on her real deck: the aftmost's slot (z -8.01) lies abreast her flights' second tread, 0.56 m
  // up - her rail's outermost cell at no level there; at her main level, her main deck between her flights
  const twelve = createCrewLife({ deck, roster: Array.from({ length: 12 }, () => ({ mobile: MOBILE.Warrior, gender: 'male' })), seed: 3, places: [] });
  for (const side of [1, -1]) {
    for (let t = 0; t < 40 && !twelve.members.every((m) => m.state === 'ready'); t += DT) twelve.step(DT, { muster: side });
    const aft = Math.min(...twelve.members.map((m) => m.pos[2]));
    assert.ok(aft < -7.9, `the aftmost hand abreast her flights (${aft.toFixed(2)})`);
    for (const m of twelve.members) assert.ok(m.state === 'ready' && m.pos[0] * side > 0 && Math.abs(m.pos[1] - main) <= DECK_STEP, `twelve hands, ${side > 0 ? 'starboard' : 'port'}: #${m.i} at her main deck's rail ${m.pos.map((v) => v.toFixed(2))}`);
    twelve.step(DT, {});   // the muster called off
  }
});

// ── F41: no two on one spot ───────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV2 F41 NO TWO ON ONE SPOT: ten minutes on the Galley\'s deck and the Carrack\'s, her own crew and a player\'s, six ships each - no two men standing within 0.3 m of each other for more than a second (was: two walked to the one spot and stood merged in one sprite up to 72 s, a talk begun on top of each other talked in place; AUDIT GALLEON: the Carrack\'s lookout walked onto a hand idling at her bow, now on her main deck, and a walk ended on a man who stopped beside its end) - and a walker who must let a shipmate by never waits standing on a man he is passing over (mutants: he stops on a man, the bow walked onto a man, a walk\'s end on a man kept)', async () => {
  const pool = await readyPool();
  let worst = 0, where = '';
  for (const [hull, who] of [[3, 'navyGalley'], [3, null], [4, 'pirateFlagship'], [4, null]]) {
    const deck = pool.deckOf(hull, 0);
    const places = placesOf(hullOf(hull), deck);
    for (let seed = 1; seed <= 6; seed++) {
      const roster = who ? crewRoster({ hull, seed, shipClass: classById(who) }) : crewRoster({ hull, seed, crew: 60 });
      const life = createCrewLife({ deck, roster, seed, places, faction: who ? classById(who).faction : null });
      const on = new Map();
      for (let f = 0; f < 600 / DT; f++) {
        life.step(DT, {});
        const ms = life.members;
        for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) {
          const a = ms[i], b = ms[j], k = i * 16 + j;
          if (!a.gone && !b.gone && !a.moving && !b.moving && Math.hypot(a.pos[0] - b.pos[0], a.pos[2] - b.pos[2]) < 0.3) {
            const s = (on.get(k) ?? 0) + DT;
            on.set(k, s);
            if (s > worst) { worst = s; where = `hull ${hull} ${who ?? 'player'} ${seed}: ${i}/${j} (${a.state}, ${b.state}) at ${(f * DT).toFixed(1)} s`; }
          } else on.delete(k);
        }
      }
    }
  }
  assert.ok(worst <= 1, `two stood on one spot ${worst.toFixed(1)} s - ${where}`);
  // AUDIT GALLEON T2 (2026-10-02): the passing-over rule pinned on its own - the real hulls' runs reach it by chance of
  // their spots (the Carrack's changed with her cargo hatch, and it went unreached). On the plain deck: #6 stands
  // still at (-2.25, -2); #5 walks fore along x -2.25 through him; #3, before him in the roster, walks the same line
  // 1.3 m ahead of the point where #5 passes over #6 and is held there by someone in his own way (`avoid`, the player)
  // - #5 passes over #6 without stopping (never waiting on a man he stands over), then lets #3 by just past him
  const deck = plainDeck();
  const life = createCrewLife({ deck, roster: Array.from({ length: 8 }, () => ({ mobile: MOBILE.Warrior, gender: 'male' })), seed: 6 });
  for (const m of life.members) { m.pos = [3.25, 2, -11 + m.i * 1.3]; m.state = 'ready'; m.path = null; }
  const [man, b, c] = [life.members[6], life.members[5], life.members[3]];
  man.pos = [-2.25, 2, -2];
  // (a stride of 0.06 m a step: he would let #3 by from 0.26 m short of the man, and does from 0.34 m past him)
  b.pos = [-2.25, 2, -2.62]; b.state = 'walk'; b.path = [[-2.25, 2, -2.62], [-2.25, 2, 8]]; b.leg = 1; b.speed = 1.2;
  c.pos = [-2.25, 2, -0.7]; c.state = 'walk'; c.path = [[-2.25, 2, -0.7], [-2.25, 2, 8]]; c.leg = 1; c.speed = 1.2;
  const avoid = [-2.25, 2, 0.7];
  let onHim = 0, longest = 0, passed = false;
  for (let t = 0; t < 4; t += 0.05) {
    life.step(0.05, { avoid });
    const d = Math.hypot(b.pos[0] - man.pos[0], b.pos[2] - man.pos[2]);
    onHim = d < 0.3 && !b.moving ? onHim + 0.05 : 0;
    longest = Math.max(longest, onHim);
    passed ||= b.pos[2] > man.pos[2] + 0.3;
  }
  assert.ok(passed, `he passed over him (${b.pos[2].toFixed(2)})`);
  assert.ok(longest < 0.1, `he stood on a man ${longest.toFixed(2)} s, waiting on a shipmate`);
  // AUDIT GALLEON T2: a walk's end free when he chose it, a man stopped 0.24 m beside it while he walked (a talk ended
  // on its way - the Carrack's two stood merged 2.5 s once her cargo hatch changed her spots): he goes on at once
  const l2 = createCrewLife({ deck, roster: Array.from({ length: 8 }, () => ({ mobile: MOBILE.Warrior, gender: 'male' })), seed: 7 });
  for (const m of l2.members) { m.pos = [3.25, 2, -11 + m.i * 1.3]; m.state = 'ready'; m.path = null; }
  const [walker, there] = [l2.members[4], l2.members[6]];
  there.pos = [-2.25, 2, 3.27];
  walker.pos = [-2.25, 2, 1]; walker.state = 'walk'; walker.path = [[-2.25, 2, 1], [-2.25, 2, 3.51]]; walker.leg = 1; walker.speed = 1.2;
  let merged = 0, most = 0, arrived = false;
  for (let t = 0; t < 8; t += 0.05) {
    l2.step(0.05, {});
    arrived ||= Math.hypot(walker.pos[0] + 2.25, walker.pos[2] - 3.51) < 1e-6;
    merged = Math.hypot(walker.pos[0] - there.pos[0], walker.pos[2] - there.pos[2]) < 0.3 && !walker.moving ? merged + 0.05 : 0;
    most = Math.max(most, merged);
  }
  assert.ok(arrived, 'he came to his walk\'s end');
  assert.ok(most < 0.2, `he stood on the man at it ${most.toFixed(2)} s`);
});

test('AUDIT NAV2 F41 A TALK BEGUN ON ONE SPOT, AND A SHIPMATE IN THE WAY: two men on one point - the one who comes over stands off to talk, never in place; a walker waits while a shipmate who walks before him crosses his next step, and goes on after (was: they talked merged, both facing the bow; walkers passed through each other; AUDIT GALLEON D-wall: and a talk\'s place never a third man\'s) (mutants: the place on a third man)', () => {
  const deck = plainDeck();
  // the talk: every man but two stood at the rail aft (a muster's `ready` - nothing moves him), the two on one point
  const life = createCrewLife({ deck, roster: crewRoster({ hull: 3, seed: 2, shipClass: pirate }), seed: 2 });
  for (const m of life.members) { m.pos = [-3.25, 2, -11 + m.i * 1.3]; m.state = 'ready'; m.path = null; }
  // PIN MOVED (AUDIT WK-W1): her lookout (#1 here) stands from her first step and nobody talks with him - the man
  // talked to is #2
  const [a, , b] = life.members;
  assert.notEqual(b, life.lookout());
  b.pos = [2, 2, -5]; b.state = 'idle'; b.t = 1e9;
  let tries = 0;
  while (!a.mate && tries++ < 400) { a.pos = [2, 2, -5]; a.path = null; a.state = 'idle'; a.t = 0; life.step(0.01, {}); }
  assert.ok(a.mate === b, 'a talk begun');
  const standOff = a.path ? a.path.at(-1) : a.pos;
  assert.ok(Math.hypot(standOff[0] - b.pos[0], standOff[2] - b.pos[2]) > 1, `he stands off to talk: ${standOff}`);
  // across a wide hatch: the place on his side of her, clamped back off the hatch, fell on the far man's toes
  const hatch = buildDeck([
    { positions: [-4, 2, -12, 4, 2, -12, 4, 2, 12, -4, 2, 12], indices: [0, 1, 2, 0, 2, 3] },
    boxColliderTriangles({ m_Center: { x: 0, y: 2.5, z: 0 }, m_Size: { x: 4, y: 1, z: 4 } }),
  ], { minX: -6, maxX: 6, minZ: -14, maxZ: 14 });
  const l3 = createCrewLife({ deck: hatch, roster: crewRoster({ hull: 3, seed: 3, shipClass: pirate }), seed: 3 });
  for (const m of l3.members) { m.pos = [-3.25, 2, -11 + m.i * 1.3]; m.state = 'ready'; m.path = null; }
  const [c, , e] = l3.members;   // PIN MOVED (AUDIT WK-W1): #2, never her lookout
  assert.notEqual(e, l3.lookout());
  e.pos = [0, 2, -3.25]; e.state = 'idle'; e.t = 1e9;   // just aft of the hatch; he comes from forward of it
  tries = 0;
  while (!c.mate && tries++ < 400) { c.pos = [0, 2, 3.25]; c.path = null; c.state = 'idle'; c.t = 0; l3.step(0.01, {}); }
  assert.ok(c.mate === e && c.path, 'a talk across the hatch');
  assert.ok(Math.hypot(c.path.at(-1)[0] - e.pos[0], c.path.at(-1)[2] - e.pos[2]) > 0.9, `a place of his own: ${c.path.at(-1)}`);
  // AUDIT GALLEON D-wall (2026-10-02): a third man's place pinned on its own - the real hulls' ten-minute runs reached
  // it by chance of their spots (the Carrack's moved with her deck's walls, and it went unreached): a third man stands
  // where the talk's first place falls (CREW_TALK_REACH fore of the man talked to) - the place is the next turn's
  const l4 = createCrewLife({ deck, roster: crewRoster({ hull: 3, seed: 2, shipClass: pirate }), seed: 2 });
  for (const m of l4.members) { m.pos = [-3.25, 2, -11 + m.i * 1.3]; m.state = 'ready'; m.path = null; }
  const [f, , g, third] = l4.members;
  assert.ok(g !== l4.lookout() && third !== l4.lookout(), 'never her lookout');
  g.pos = [2, 2, -5]; g.state = 'idle'; g.t = 1e9;
  third.pos = [2, 2, -3.4];
  tries = 0;
  while (!f.mate && tries++ < 400) { f.pos = [2, 2, -5]; f.path = null; f.state = 'idle'; f.t = 0; l4.step(0.01, {}); }
  assert.ok(f.mate === g, 'a talk begun');
  const place = f.path ? f.path.at(-1) : f.pos;
  assert.ok(Math.hypot(place[0] - third.pos[0], place[2] - third.pos[2]) > 0.6 && Math.hypot(place[0] - g.pos[0], place[2] - g.pos[2]) > 1, `never on the third man: ${place.map((v) => v.toFixed(2))}`);
  // the shipmate in the way: #3 walks fore along x = 0.8; #1 (before him in the roster) crosses his line at z = -6.8
  // just as he comes to it
  const l2 = createCrewLife({ deck, roster: crewRoster({ hull: 3, seed: 4, shipClass: pirate }), seed: 4 });
  for (const m of l2.members) { m.pos = [-3.25, 2, 4 + m.i * 1.3]; m.state = 'ready'; m.path = null; }
  const m3 = l2.members[3], m1 = l2.members[1];
  m3.pos = [0.8, 2, -8]; m3.state = 'walk'; m3.path = [[0.8, 2, -8], [0.8, 2, 8]]; m3.leg = 1; m3.speed = 1.2;
  m1.pos = [2, 2, -6.8]; m1.state = 'walk'; m1.path = [[2, 2, -6.8], [-3, 2, -6.8]]; m1.leg = 1; m1.speed = 1.2;
  let waited = 0, closest = Infinity;
  for (let t = 0; t < 8; t += 0.05) {
    const z = m3.pos[2];
    l2.step(0.05, {});
    if (m3.state === 'walk' && m3.pos[2] === z) waited += 0.05;
    closest = Math.min(closest, Math.hypot(m3.pos[0] - m1.pos[0], m3.pos[2] - m1.pos[2]));
  }
  assert.ok(waited > 0.3, `he let his shipmate by (${waited.toFixed(2)} s)`);
  assert.ok(closest > 0.5, `never through him (${closest.toFixed(2)} m)`);
  assert.ok(m3.pos[2] > -5, `and went on (${m3.pos[2].toFixed(2)})`);
});

// ── F42: my crew grows back, and empties ──────────────────────────────────────────────────────────────────────────

test('AUDIT NAV2 F42 MY CREW GROWS BACK, AND EMPTIES: my boat\'s crew mended in range stands back up to her count - first seen at one, then four - the men the guns took first; every hand down, nobody stands and no sprite is drawn; the men a fight took stay gone until the fight\'s end brings them home (was: `sync` only trimmed, and `trim` never took her first man)', async () => {
  const pool = await readyPool();
  const deck = pool.deckOf(2, 0);
  const boat = hullOf(2);
  const mine = (crew) => ({ key: boat, boat, deck, count: crewCount({ hull: 2, crew }), rosterOf: () => crewRoster({ hull: 2, seed: 42, crew }), seed: 42, faction: null, battle: false });
  assert.equal(crewCount({ hull: 2, crew: 6 }), 1);
  assert.equal(crewCount({ hull: 2, crew: 24 }), 4);
  const h = host();
  h.crew.sync([mine(6)]);
  const ship = h.crew.ships()[0];
  assert.equal(ship.life.standing(), 1);
  h.crew.sync([mine(24)]);
  assert.equal(ship.life.standing(), 4, 'grown: 1 -> 4');
  assert.deepEqual(ship.life.members.map((m) => m.mobile), crewRoster({ hull: 2, seed: 42, crew: 24 }).map((r) => r.mobile), 'her roster\'s men');
  await settle();
  h.crew.frame(0.05, [0, 10, 0]);
  assert.equal(h.crew.batches().length, 4, 'each a sprite');
  h.crew.sync([mine(6)]);
  h.crew.frame(0.05, [0, 10, 0]);
  assert.equal(ship.life.standing(), 1);
  h.crew.sync([mine(24)]);
  assert.equal(ship.life.standing(), 4, 'the guns\' men back');
  await settle();
  h.crew.frame(0.05, [0, 10, 0]);
  assert.equal(h.crew.batches().length, 4);
  // a fight's: my hands over the rail stay over it
  assert.equal(h.crew.takeByBoat(boat, 2).length, 2);
  h.crew.sync([mine(24)]);
  assert.equal(ship.life.standing(), 2, 'the men a fight took stay gone');
  h.crew.reset(boat);
  h.crew.sync([mine(24)]);
  assert.equal(h.crew.ships()[0].life.standing(), 4, 'home at the fight\'s end');
  // every hand down
  h.crew.sync([mine(0)]);
  await settle();
  h.crew.frame(0.05, [0, 10, 0]);
  assert.equal(h.crew.ships()[0].life.standing(), 0, 'every hand down: nobody');
  assert.equal(h.crew.batches().length, 0, 'no sprite');
  h.crew.sync([mine(24)]);
  assert.equal(h.crew.ships()[0].life.standing(), 4, 'and back');
});

// ── F35: a station taken ──────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV2 F35 A STATION TAKEN STANDS ON HER DECK: a fight takes her men with their feet on her deck - a captain at a wheel on a poop off her walkable deck (the mod galleon\'s then; no station of the current hulls\' stands off her deck - the new galleon\'s officer and coxswain on her castle\'s roof, her deck now - so pinned on the plain deck\'s poop) answered at the deck point nearest him; every man within a tread of her deck\'s height where he is put, on every hull (was: his post off it, and the leash snapped him 7 m onto her main deck) (mutants: the station taken off her deck)', async () => {
  const pool = await readyPool();
  for (const [hull, cls] of [[2, 'pirateBrig'], [3, 'navyGalley'], [4, 'pirateFlagship']]) {
    const deck = pool.deckOf(hull, 0);
    const places = placesOf(hullOf(hull), deck);
    for (let seed = 1; seed <= 4; seed++) {
      const life = createCrewLife({ deck, roster: crewRoster({ hull, seed, shipClass: classById(cls) }), seed, places });
      for (let f = 0; f < 5 / DT; f++) life.step(DT, {});
      const where = life.members.map((m) => [...m.pos]);
      const taken = life.take(Infinity);
      assert.equal(taken.length, life.members.length);
      for (const [i, t] of taken.entries()) {
        const y = deck.heightAt(t.pos[0], t.pos[2]);
        assert.ok(Math.abs(t.pos[1] - y) <= DECK_STEP, `${cls} ${seed} #${i}: feet ${t.pos.map((v) => v.toFixed(2))} on her deck (${y})`);
        assert.ok(Math.hypot(t.pos[0] - where[i][0], t.pos[2] - where[i][2]) < (life.members[i].station ? 12 : 0.5), 'where he stood, or the deck point nearest his post');
      }
    }
  }
  // AUDIT GALLEON T2 (2026-10-02): the station off her deck, on the plain deck - her captain's post on a poop 5.5 m out
  // and 1.2 m over her deck: taken, his feet on her deck's point nearest it, never on the air at his post
  const plain = plainDeck();
  const lp = createCrewLife({ deck: plain, roster: crewRoster({ hull: 3, seed: 2, shipClass: pirate }), seed: 2, places: [[5.5, 3.2, -11]] });
  for (let f = 0; f < 5 / DT; f++) lp.step(DT, {});
  assert.ok(lp.members[0].station && !plain.walkable(5.5, -11), 'her captain at his post, off her deck');
  const [captain] = lp.take(1);
  assert.ok(plain.walkable(captain.pos[0], captain.pos[2]) && Math.abs(captain.pos[1] - plain.heightAt(captain.pos[0], captain.pos[2])) <= DECK_STEP, `taken onto her deck: ${captain.pos.map((v) => v.toFixed(2))}`);
  assert.ok(Math.hypot(captain.pos[0] - 5.5, captain.pos[2] + 11) < 2.5, `the deck point nearest his post: ${captain.pos.map((v) => v.toFixed(2))}`);
});

// ── F45, F46: a ship going down, a struck crew, the guns ──────────────────────────────────────────────────────────

test('AUDIT NAV2 F45 A SHIP GOING DOWN KEEPS HER CREW: the sea\'s crews list a ship sinking (struck), and the world\'s frame keeps her living crew aboard to the end with her flats down - gone only once she is sunk (was: dropped at the sinking, the mod\'s static flats stood in their place)', async () => {
  const h = await sea({ hull: 2 });
  const { crew } = host();
  const w = liftCrewFrame({ csa: { deckOf: (hull, v) => h.pool.deckOf(hull, v), boats: [], peerBoats: [] }, naval: h.host, navalCrew: crew });
  const id = h.host.spawnShip('merchantGalleon', { range: 40, bearing: Math.PI / 2, yaw: 0 });
  const e = h.host._sea.get(id);
  e.ship.pos = [40, 0, 0];
  for (let i = 0; i < 10; i++) { h.host.frame(0.1); w.navalCrewFrame(0.1); }
  const flats = deckFlats(e.boat, h.pool.deckOf(e.boat.hull, 0));
  assert.ok(crew.has(id) && shown(flats) === 0);
  e.ship.damage.apply({ hull: e.ship.damage.maxHull * 5, sail: 0, crew: 0 });
  for (let i = 0; i < 20; i++) { h.host.frame(0.1); w.navalCrewFrame(0.1); }
  assert.equal(e.ship.damage.state, SHIP_STATES.sinking);
  const c = h.host.crewShips().find((x) => x.key === id);
  assert.ok(c && c.struck === true && c.battle === false, 'listed going down, her colours down');
  assert.ok(crew.has(id) && crew.ships()[0].life.standing() > 0, 'her crew aboard');
  assert.equal(shown(flats), 0, 'her flats kept down');
  for (let i = 0; i < 400 && h.host._sea.has(id); i++) { h.host.frame(0.25); w.navalCrewFrame(0.25); }
  assert.equal(h.host._sea.has(id), false, 'sunk and gone');
  assert.equal(crew.has(id), false, 'her crew with her');
});

test('AUDIT NAV2 F46 THE GUNS END THE TALK: her guns run out (battle) and every talk ends that step - no talk\'s line said under the guns, none begun (was: 5 to 13 talk lines under the guns a run - only the muster ended talks)', () => {
  const deck = plainDeck();
  const life = createCrewLife({ deck, roster: crewRoster({ hull: 3, seed: 21, crew: 60 }), seed: 21 });
  let t = 0;
  while (!life.members.some((m) => m.state === 'talk' && m.talk?.line >= 0) && t < 400) { life.step(0.05, {}); t += 0.05; }
  assert.ok(life.members.some((m) => m.mate), 'a talk under way');
  life.step(0.05, { battle: true });
  assert.ok(life.members.every((m) => !m.mate && !m.talk), 'the guns out: every talk ended');
  const said = [];
  for (let s = 0; s < 90; s += 0.05) { life.step(0.05, { battle: true }); for (const l of life.speech()) if (l.member.line.t > crewLife.CREW_LINE_S - 0.051) said.push(l.text); }   // a line said this step
  assert.ok(said.length > 3, 'the battle\'s words');
  assert.deepEqual(said.filter((x) => CREW_TALKS.some((c) => c.includes(x))), [], 'no talk\'s line under the guns');
});

test('AUDIT NAV2 F46 A STRUCK CREW GOES QUIET: a ship that struck her colours is listed struck by the sea (a prize and a ship going down too), and over three minutes after, through the world\'s own frame, her crew sings no song and says no calm or trade\'s word - a surrender\'s few at most (was: 2856 frames of chanty and "Gold, lads" after she struck)', async () => {
  const h = await sea({ hull: 2 });
  const { crew } = host();
  const w = liftCrewFrame({ csa: { deckOf: (hull, v) => h.pool.deckOf(hull, v), boats: [], peerBoats: [] }, naval: h.host, navalCrew: crew });
  const id = h.host.spawnShip('pirateBrig', { range: 60, bearing: Math.PI / 2, yaw: 0 });
  const e = h.host._sea.get(id);
  e.ship.pos = [60, 0, 0];
  h.host.frame(0.1);
  e.ship.damage.apply({ hull: Math.ceil(e.ship.damage.maxHull * 0.8), sail: 0, crew: 0 });
  h.host.frame(0.1);
  assert.equal(e.ship.damage.state, SHIP_STATES.struck);
  assert.equal(h.host.crewShips().find((x) => x.key === id)?.struck, true, 'listed struck');
  w.navalCrewFrame(0.1);
  await settle();   // her men's sprites stood - the words are theirs over their heads
  const said = new Set();
  let sang = 0;
  for (let s = 0; s < 180; s += 0.1) {
    e.ship.pos = [60, 0, 0];
    h.host.frame(0.1); w.navalCrewFrame(0.1);
    for (const l of crew.speech()) { said.add(l.text); if (l.kind === 'sing') sang++; }
  }
  assert.ok(crew.has(id), 'her crew stands');
  assert.equal(sang, 0, 'no song');
  const calm = [...said].filter((x) => CREW_BLURBS.calm.includes(x) || CREW_BLURBS.pirate.includes(x) || CREW_TALKS.some((c) => c.includes(x)));
  assert.deepEqual(calm, [], 'no calm, trade\'s or talk\'s word');
  assert.ok([...said].some((x) => CREW_BLURBS.struck.includes(x)), `a surrender's few words: ${[...said]}`);
});

// ── F43: a raid on my deck ──────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV2 F43 A RAID ON MY DECK: a pirate boards my crewed boat with Warm Ashes on and its raid is fought by the quest\'s own `_ally_`, my crew (AUDIT NAV1 B2) - through the world\'s own frame my living crew are held off my deck for the whole raid, no man of them walking or singing among the raiders and no flat standing in their place, and the raid won they stand again whole (was: the fight took my hands and fielded none, and the rest walked, talked and sang among the raiders)', async () => {
  let won = false;
  const quest = { uid: 777, name: 'raid', tasks: new Map([['winner', { getTriggerValue: () => won }]]) };
  // the Galley (hull 3): her whole crew stands eight, more than the four hands a fight takes over (HANDS_MAX)
  const { h, crew, step } = await crewedSea({ hull: 3, raidQuest: () => quest, save: { v: 1, boats: { 42: { hull: 0, sail: 0, crew: 60, fire: 0, state: 'wrecked', barrels: 4 } }, notoriety: {}, day: 1, raids: [] } });
  const flats = deckFlats(h.boat, h.pool.deckOf(h.boat.hull, 0));
  // and a second boat of mine lying off, crewed - no raid on her deck
  const other = h.pool.spawnNow(Object.assign(new Boat(3, 0), { uid: 43, crewed: true }), { position: [-40, 0, 0], rotation: [0, 0, 0, 1] });
  h.runtime.state.AllBoats.push(other);
  const id = h.host.spawnShip('pirateBrig', { range: 200, bearing: 2.5 });
  step(0.5);
  await settle();
  const before = crew.ships().find((x) => x.boat === h.boat);
  assert.ok(before && before.life.standing() > HANDS_MAX && shown(flats) === 0, `my crew stands at her work before the raid (${before?.life.standing()})`);
  const otherCount = crew.ships().find((x) => x.boat === other)?.life.standing();
  assert.ok(otherCount > 0, 'and hers on the other');
  for (let t = 0; t < 180 && h.host.boarding?.phase !== 'fight'; t += 0.1) step(0.1);
  assert.equal(h.host.boarding?.quest, quest, `the pirate's boarding is Warm Ashes' raid (${h.host._sea.get(id)?.ship.mode})`);
  step(20);
  const mine = crew.ships().find((x) => x.boat === h.boat);
  assert.ok(mine, 'her crew\'s place kept');
  assert.equal(mine.life.standing(), 0, 'nobody of my crew on my deck while the raid is fought');
  assert.equal([...mine.sprites.values()].filter(Boolean).length, 0, 'none drawn');
  assert.equal(shown(flats), 0, 'no flat of the mod\'s standing in their place');
  assert.equal(crew.ships().find((x) => x.boat === other)?.life.standing(), otherCount, 'the other boat\'s crew at her work - the raid is not on her deck');
  won = true;
  step(0.5);
  assert.equal(h.host.boarding, null, 'the raid won');
  step(0.5);
  const home = crew.ships().find((x) => x.boat === h.boat);
  const count = crewCount({ hull: h.boat.hull, crew: h.host.myCrew(h.boat).crew });
  assert.ok(count > 0);
  assert.equal(home?.life.standing(), count, 'home whole');
  assert.equal(shown(flats), 0);
});

// ── F47: the chanty's edges ───────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV2 F47 THE CHANTY\'S EDGES: her song\'s leader taken mid-song - the next waits CHANTY_S, never a breath later; the leader takes no talk while he sings, and never sings a verse over his own talk (was: the next song 0.03 s later; 8 to 34 verses said over the leader\'s talk a run)', () => {
  const deck = plainDeck();
  const roster = crewRoster({ hull: 3, seed: 21, crew: 60 });
  roster[1] = { mobile: MOBILE.Bard, gender: 'female' };
  const life = createCrewLife({ deck, roster, seed: 21 });
  let t = 0;
  while (!life.singing() && t < 400) { life.step(DT, {}); t += DT; }
  for (let i = 0; i < 60; i++) life.step(DT, {});
  assert.ok(life.singing(), 'a song');
  life.take(2);   // her first two over the rail - the Bard among them
  let after = 0;
  while (!life.singing() && after < 400) { life.step(DT, {}); after += DT; }
  assert.ok(after >= CHANTY_S[0] - 1e-6, `the next song ${after.toFixed(2)} s after (CHANTY_S ${CHANTY_S})`);
  // a song a muster cuts short: the next one CHANTY_S after it too
  for (let i = 0; i < 60; i++) life.step(DT, {});
  assert.ok(life.singing(), 'a song again');
  for (let i = 0; i < 30; i++) life.step(DT, { muster: 1 });
  assert.equal(life.singing(), false, 'the muster ends it');
  after = 0;
  while (!life.singing() && after < 400) { life.step(DT, {}); after += DT; }
  assert.ok(after >= CHANTY_S[0] - 1e-6, `after the muster, the next song ${after.toFixed(2)} s after`);
  // a long run, a Bard aboard: never a verse over the leader's own talk
  for (const seed of [21, 22, 23]) {
    const r = crewRoster({ hull: 3, seed, crew: 60 });
    const l = createCrewLife({ deck, roster: r, seed });
    let verses = 0, over = 0;
    for (let f = 0; f < 900 / DT; f++) {
      l.step(DT, {});
      for (const x of l.speech()) {
        if (x.kind !== 'sing' || x.member.line.t < crewLife.CREW_LINE_S - DT * 1.5 || CHANTIES.some((c) => sung(c.chorus) === x.text)) continue;
        verses++;
        if (x.member.mate) over++;
      }
    }
    assert.ok(verses >= 4, `songs sung (${verses} verses)`);
    assert.equal(over, 0, `${seed}: a verse over the leader's own talk`);
  }
});

// ── F48: the walks' edges ─────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV2 F48 THE WALKS\' EDGES: a walk to a talk or to the muster held by the player gives up after CREW_BLOCKED_S as a plain walk does - the talk given up, the muster stood to where he is; and a walk starts from where he stands to the first corner of the deck\'s own line, never across a cell of no deck - a hand off his cell\'s centre beside the plain deck\'s mast, and every walk on the new galleon (was: 23 to 29 s waiting on the player; a walk from the Quartermaster\'s place crossed a hole) (mutants: the first leg from off a corner)', async () => {
  const deck = plainDeck();
  // the talk
  const life = createCrewLife({ deck, roster: crewRoster({ hull: 3, seed: 8, shipClass: pirate }), seed: 8 });
  for (const m of life.members) { m.pos = [-3.5, 2, 9 + m.i * 0.3]; m.state = 'wait'; m.t = 1e9; }
  const a = life.members[2], o = life.members[3];
  a.pos = [0, 2, -8]; o.pos = [0, 2, 8]; o.state = 'wait'; o.path = null;
  a.state = 'toTalk'; a.path = [[0, 2, -8], [0, 2, 6.4]]; a.leg = 1; a.speed = 1.2;
  a.mate = o; o.mate = a; a.talk = { script: CREW_TALKS[0], line: -1, t: 0, lead: true }; o.talk = { script: CREW_TALKS[0], line: -1, t: 0, lead: false };
  const avoid = [0, 2, -7.4];
  for (let t = 0; t < CREW_BLOCKED_S + 0.5; t += 0.05) life.step(0.05, { avoid });
  assert.ok(a.state !== 'toTalk' && !a.mate && !o.mate, `the talk given up (${a.state})`);
  // the muster
  const l2 = createCrewLife({ deck, roster: crewRoster({ hull: 3, seed: 9, shipClass: pirate }), seed: 9 });
  for (const m of l2.members) { m.pos = [2.5, 2, -10 + m.i * 2.5]; m.path = null; m.state = 'idle'; }
  l2.step(0.05, { muster: -1 });
  const m = l2.members.find((x) => x.state === 'toMuster' && x.path);
  assert.ok(m, 'a man bound for the rail');
  const next = m.path.slice(m.leg).find((q) => Math.hypot(q[0] - m.pos[0], q[2] - m.pos[2]) > 0.2), d = Math.hypot(next[0] - m.pos[0], next[2] - m.pos[2]);
  const block = [m.pos[0] + (next[0] - m.pos[0]) / d * 0.5, 2, m.pos[2] + (next[2] - m.pos[2]) / d * 0.5];
  for (let t = 0; t < CREW_BLOCKED_S + 0.5; t += 0.05) l2.step(0.05, { muster: -1, avoid: block });
  assert.equal(m.state, 'ready', 'the muster stood to where he is');
  // AUDIT GALLEON T2 (2026-10-02): the first leg pinned on its own - a lone hand on the plain deck off his cell's
  // centre at (-1, 2), mustered to her starboard rail: his walk's second corner lies across her mast's hole from where
  // he stands, so a walk straight at it (its first corner skipped) strides off her deck
  const l3 = createCrewLife({ deck, roster: [{ mobile: MOBILE.Warrior, gender: 'male' }], seed: 1 });
  const lone = l3.members[0];
  lone.pos = [-1, 2, 2]; lone.path = null; lone.state = 'idle'; lone.t = 1e9;
  for (let t = 0; t < 8 && lone.state !== 'ready'; t += 0.05) {
    const p = [...lone.pos];
    l3.step(0.05, { muster: 1 });
    const dd = Math.hypot(lone.pos[0] - p[0], lone.pos[2] - p[2]);
    for (let q = 0, n = Math.ceil(dd / 0.02); q <= n; q++) {
      const k = n ? q / n : 1;
      assert.ok(deck.walkable(p[0] + (lone.pos[0] - p[0]) * k, p[2] + (lone.pos[2] - p[2]) * k), `a stride off her deck: ${p.map((v) => v.toFixed(2))} -> ${lone.pos.map((v) => v.toFixed(2))}`);
    }
  }
  assert.equal(lone.state, 'ready', 'at her starboard rail');
  assert.ok(lone.pos[0] > 3, `her starboard rail: ${lone.pos.map((v) => v.toFixed(2))}`);
  // the first leg: every walk on the Small Ship from the flats' places - never a stride off her deck (twelve seeds: on
  // her deck of every level, F34's - the mod galleon's first leg from off a corner strayed first at the seventh; the
  // new galleon's walks from her flats' places never start off a corner that would stray, the plain deck's above does)
  const pool = await readyPool();
  const ship = pool.deckOf(2, 0);
  const places = placesOf(hullOf(2), ship);
  for (let seed = 1; seed <= 12; seed++) {
    const l = createCrewLife({ deck: ship, roster: crewRoster({ hull: 2, seed, shipClass: pirate }), seed, places, faction: 'pirate' });
    for (let f = 0; f < 60 / DT; f++) {
      const before = l.members.map((x) => [...x.pos]);
      l.step(DT, {});
      for (const x of l.members) {
        if (x.gone || x.station) continue;
        const p = before[x.i], dd = Math.hypot(x.pos[0] - p[0], x.pos[2] - p[2]);
        for (let q = 0, n = Math.ceil(dd / 0.05); q <= n; q++) {
          const k = n ? q / n : 1;
          assert.ok(ship.walkable(p[0] + (x.pos[0] - p[0]) * k, p[2] + (x.pos[2] - p[2]) * k), `seed ${seed} #${x.i} at ${(f * DT).toFixed(2)} s: a stride off her deck (${p.map((v) => v.toFixed(2))} -> ${x.pos.map((v) => v.toFixed(2))})`);
        }
      }
    }
  }
});

// ── F50, F51: a concealed owner's crew; a Bard among them ─────────────────────────────────────────────────────────

test('AUDIT NAV2 F50 A CONCEALED OWNER\'S CREW: a room\'s boat under a concealed owner at her helm (comeSailAwayPeers: `boat.conceal`, AUDIT PRE-MERGE 0928 O4) - her living crew wear his look as the pool\'s flats did; plain again when he is not (was: the living crew\'s batches never concealed)', async () => {
  const pool = await readyPool();
  const deck = pool.deckOf(2, 0);
  const boat = hullOf(2);
  const h = host();
  h.crew.sync([entry(boat, deck)]);
  await settle();
  const look = { mode: 2, alpha: 0.4, t: 0, phase: 0 };
  boat.conceal = look;
  h.crew.frame(0.05, [0, 10, 0]);
  assert.equal(h.crew.batches().length, 6);
  assert.ok(h.crew.batches().every((b) => b.conceal === look), 'his look');
  boat.conceal = null;
  h.crew.frame(0.05, [0, 10, 0]);
  assert.ok(h.crew.batches().every((b) => b.conceal == null), 'plain');
});

test('AUDIT NAV2 F51 A BARD AMONG ANY TWO: a player\'s shown crew of two or more has her Bard to lead the song, whatever her seed; a longer roster begins as the shorter one does (was: four starts of PLAYER_CREW\'s eight had none among the first few)', () => {
  let without = 0;
  for (let seed = 0; seed < 64; seed++) {
    for (const hull of [2, 3, 4]) {
      let prev = null;
      for (let n = 1; n <= CREW_SHOWN[hull]; n++) {
        const r = crewRoster({ hull, seed, crew: n * 6 });
        assert.equal(r.length, n);
        assert.ok(r.every((x) => PLAYER_CREW.includes(x.mobile)));
        if (n >= 2 && !r.some((x) => x.mobile === MOBILE.Bard)) without++;
        if (prev) assert.deepEqual(r.slice(0, prev.length), prev, 'a longer roster begins as the shorter');
        prev = r;
      }
    }
  }
  assert.equal(without, 0, 'every crew of two or more has her Bard');
});

// ── F52, F53: the arc off, a window over the world ────────────────────────────────────────────────────────────────

test('AUDIT NAV2 F52 THE ARC OFF: with the naval arc switched off the world\'s crews\' frame stands no living crew - Come Sail Away\'s own people flats stand as the mod stands them - and a crew standing when it turns off is stood down, her flats back (was: my crewed boat\'s flats replaced by the living crew with the arc off)', async () => {
  const pool = await readyPool();
  const boat = hullOf(2);
  boat.crewed = true;
  assert.equal(boat.GameObject.activeSelf, true);
  let on = false;
  const { crew } = host();
  const w = liftCrewFrame({ csa: { deckOf: (hull, v) => pool.deckOf(hull, v), boats: [boat], peerBoats: [] }, naval: { myCrew: () => ({ crew: 24, battle: false }), crewShips: () => [] }, navalCrew: crew, navalOn: () => on });
  const flats = deckFlats(boat, pool.deckOf(2, 0));
  w.navalCrewFrame(DT);
  assert.equal(crew.ships().length, 0, 'the arc off: no living crew');
  assert.equal(shown(flats), flats.length, 'the mod\'s flats stand');
  on = true;
  w.navalCrewFrame(DT);
  assert.equal(crew.ships().length, 1, 'on: her crew stands');
  assert.equal(shown(flats), 0);
  on = false;
  w.navalCrewFrame(DT);
  assert.equal(crew.ships().length, 0, 'off again: stood down');
  assert.equal(shown(flats), flats.length, 'her flats back');
});

test('AUDIT NAV2 F53 UNDER A WINDOW: the world holds the crews\' clock with the sea\'s under a pause - the frame is handed no time while a window is up, and a frame of none leaves every man where he stands and every line as it was (was: the ships stood still under a window while their crews walked and sang on)', async () => {
  assert.match(WORLD, /navalCrewFrame\(gamePaused\(\) \? 0 : foeDt\);/, 'the frame\'s clock held by a pause');
  const pool = await readyPool();
  const boat = hullOf(2);
  boat.crewed = true;
  const { crew } = host();
  const w = liftCrewFrame({ csa: { deckOf: (hull, v) => pool.deckOf(hull, v), boats: [boat], peerBoats: [] }, naval: { myCrew: () => ({ crew: 24, battle: false }), crewShips: () => [] }, navalCrew: crew });
  for (let i = 0; i < 300; i++) w.navalCrewFrame(DT);
  await settle();
  const snap = () => JSON.stringify(crew.ships()[0].life.members.map((m) => [m.pos, m.state, m.line?.text ?? null, m.line?.t ?? null]));
  const was = snap();
  for (let i = 0; i < 300; i++) w.navalCrewFrame(0);
  assert.equal(snap(), was, 'nobody moved, nothing said');
});

// ── F58, F59: first sight's cost, a crewman's frame ───────────────────────────────────────────────────────────────

test('AUDIT NAV2 F58 FIRST SIGHT\'S COST: a deck\'s main level is sorted once for the deck, never again at each crew\'s first sight; a hull\'s people flats are walked once for her rig and handed back after - walked again when her variant changes (was: a sort of every deck cell, 0.46 ms on the galley, and a walk of the whole hull at every stand)', async () => {
  const pool = await readyPool();
  const deck = pool.deckOf(3, 0);
  let reads = 0;
  const counted = new Proxy(deck, { get: (t, k) => { if (k === 'y') reads++; return t[k]; } });
  const level = mainLevel(counted);
  assert.ok(reads > 0);
  const once = reads;
  assert.equal(mainLevel(counted), level);
  assert.equal(reads, once, 'the second reading sorts nothing');
  const boat = hullOf(2);
  const first = peopleFlatsOf(boat);
  assert.ok(first.length >= 5);
  assert.equal(peopleFlatsOf(boat), first, 'walked once');
  boat.variant = 3;
  assert.notEqual(peopleFlatsOf(boat), first, 'her rig changed: walked again');
});

test('AUDIT NAV2 F59 NO GARBAGE A CREWMAN: a sprite\'s size is written through - the same object frame after frame - and its texture key is the one the uploader writes, memoised on its three numbers as the town\'s is (PERF-TOWN1); the motion asked of his unit is one object for the host (was: about 550 bytes a crewman a frame - a {moving}, two key strings, a {w,h})', async () => {
  const pool = await readyPool();
  const deck = pool.deckOf(2, 0);
  const boat = hullOf(2);
  const h = host();
  h.crew.sync([entry(boat, deck)]);
  await settle();
  h.crew.frame(0.05, [0, 10, 0]);
  const sizes = h.crew.batches().map((b) => b.size);
  h.probed.length = 0;
  h.crew.frame(0.05, [3, 10, 0]);
  h.crew.batches().forEach((b, i) => assert.equal(b.size, sizes[i], 'the same size object'));
  assert.ok(h.probed.length >= 6 && h.probed.every((k) => /^\d+_\d+#\d+$/.test(k)), `the uploader's own key: ${h.probed.slice(0, 3)}`);
  for (const b of h.crew.batches()) assert.ok(h.probed.includes(`${b.archive}_${b.record}`), 'the key of the record the batch stands');
  // the motion his unit is asked: one object, each man's own `moving` written into it before he is asked
  const ship = h.crew.ships()[0], asked = new Map();
  for (const [member, s] of ship.sprites) { const f = s.unit.update.bind(s.unit); s.unit.update = (dt, motion, ...rest) => { asked.set(member, { motion, moving: motion.moving }); return f(dt, motion, ...rest); }; }
  const walker = ship.life.members.find((m) => !m.station);
  walker.state = 'walk'; walker.path = [[...walker.pos], [walker.pos[0], walker.pos[1], walker.pos[2] + 0.5]]; walker.leg = 1; walker.speed = 1.2;
  h.crew.frame(0.05, [3, 10, 0]);
  assert.equal(asked.get(walker).moving, true, 'a walker asked walking');
  assert.ok(ship.life.members.filter((m) => m !== walker && !m.moving).every((m) => asked.get(m).moving === false), 'a man standing asked standing');
  assert.equal(new Set([...asked.values()].map((x) => x.motion)).size, 1, 'one motion object');
  const src = SRC('src/scenes/naval/navalCrew.js');
  assert.match(src, /createPersonTextureKeys\(\)/, 'the texture key memoised (PERF-TOWN1\'s)');
  assert.doesNotMatch(src, /s\.unit\.update\(dt, \{ moving: member\.moving \}/, 'no {moving} a crewman a frame');
  assert.doesNotMatch(src, /s\.batch\.size = \{/, 'no {w,h} a crewman a frame');
  assert.doesNotMatch(src, /renderer\.textures\?\.has\?\.\(`\$\{s\.archive\}_\$\{rkey\}`\)/, 'no key string a crewman a frame');
});

// ── F9: one crew for every player in a room ───────────────────────────────────────────────────────────────────────

test('AUDIT NAV2 F9 ONE CREW IN A ROOM: my boat\'s crew seeded as the room seeds her - `${whose}:${which}`, her place in my word - so her owner and every reader stand the same men; a reader counts her crew and her fight off the owner\'s word when the host says it (naval.peerBoat), her hull\'s whole crew at peace till then; offline, her own deed (was: the owner seeded by the deed\'s uid, a reader by the key - two crews for one boat)', async () => {
  const pool = await readyPool();
  const deck2 = (hull, v) => pool.deckOf(hull, v);
  const lists = [];
  const recorder = { sync: (l) => lists.push(l), frame() {}, has: () => false, clear() {}, reset() {} };
  // her owner: my second active boat (my word's slot 1 - a boat of mine standing nowhere is no place in it), my id p-7f3a
  const hidden = hullOf(2), first = hullOf(2), mine = hullOf(2);
  hidden.GameObject.setActive(false);
  Object.assign(first, { crewed: true, uid: 11 }); Object.assign(mine, { crewed: true, uid: 77 });
  let myCrew = { crew: 24, battle: false };
  const owner = liftCrewFrame({ csa: { deckOf: deck2, boats: [hidden, first, mine], peerBoats: [] }, naval: { myCrew: (b) => (b === mine ? myCrew : { crew: 24, battle: false }), crewShips: () => [] }, navalCrew: recorder, online: { id: 'p-7f3a' }, csaRuntime: { AllBoats: [hidden, first, mine] } });
  // a reader: her copy, stamped by comeSailAwayPeers as `${owner}:${slot}`
  const copy = hullOf(2);
  Object.assign(copy, { crewed: true, peerKey: 'p-7f3a:1' });
  let word = null;
  const reader = liftCrewFrame({ csa: { deckOf: deck2, boats: [], peerBoats: [copy] }, naval: { peerBoat: (id) => (id === 'p-7f3a' ? word : null), crewShips: () => [] }, navalCrew: recorder });
  const pair = () => { lists.length = 0; owner.navalCrewFrame(DT); reader.navalCrewFrame(DT); return [lists[0].find((x) => x.boat === mine), lists[1].find((x) => x.boat === copy)]; };
  let [o, r] = pair();
  assert.equal(o.seed, r.seed, 'one seed');
  assert.deepEqual(o.rosterOf(), r.rosterOf(), 'one crew');
  assert.equal(o.count, r.count);
  // her crew thinned and in a fight: the reader reads the owner's word
  myCrew = { crew: 12, battle: true };
  word = { crewShare: 12 / 24, battle: true };
  [o, r] = pair();
  assert.equal(o.count, r.count, 'her count off his word');
  assert.deepEqual(o.rosterOf(), r.rosterOf());
  assert.equal(r.battle, true, 'and his fight');
  // the host silent (today): her hull's whole crew, at peace
  word = null;
  [, r] = pair();
  assert.equal(r.count, crewCount({ hull: 2, crew: hullBuild(2).crew }));
  assert.equal(r.battle, false);
  // offline: her own deed
  const alone = liftCrewFrame({ csa: { deckOf: deck2, boats: [mine], peerBoats: [] }, naval: { myCrew: () => myCrew, crewShips: () => [] }, navalCrew: recorder, csaRuntime: { AllBoats: [mine] } });
  lists.length = 0; alone.navalCrewFrame(DT);
  assert.equal(lists[0][0].seed, 77);
});

// ── the world's wiring ────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV2 the world\'s wiring by source: the crews\' frame gated on the arc, its clock held by a pause; the sea\'s crews carry their colours and a boarding imminent into the frame; the muster\'s side from a grapple or a boarding imminent', () => {
  assert.match(WORLD, /function navalCrewFrame\(dt\) \{\n(?:\s*\/\/[^\n]*\n)*\s*if \(!navalOn\(\) \|\|[^\n]*\{ navalCrew\.clear\(\); return; \}/, 'gated on the arc');
  assert.match(WORLD, /const toward = other\?\.GameObject \? other\.GameObject\.position : ship\.toward;\n\s*if \(toward\) \{ intoDeck\(m, toward, _crewThem\);/, 'the muster\'s side');
  assert.match(WORLD, /navalCrewFrame\(gamePaused\(\) \? 0 : foeDt\);/);
  assert.match(WORLD, /struck: s\.struck/, 'her colours');
  assert.match(WORLD, /toward: s\.toward/, 'a boarding imminent');
});
