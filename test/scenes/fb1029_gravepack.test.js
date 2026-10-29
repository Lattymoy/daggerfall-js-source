// FB1029 GRAVE-PACK (bible/01-Overview/bugs/Field-Bugs-2026-10-29b.md; "Bounty targets in crypt" - "The Daedroths don't
// seem to spawn inside the crypt or in the overworld around it"): a graveyard's hunt stands its pack in the open air, and
// the camp's stand refused every spot in any location's rect - the graveyard's own, a block past its walls each side -
// so from its door or its grounds nothing ever stood, and from a fast travel's arrival one try in six. The hunt's own place is never refused now, every other
// location's rect still is, and a pack stood outside is not forgotten while its hunter is down in the crypt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Collider } from '../../src/player/collider.js';
import { placeFoeEnv, entityOccupancy } from '../../src/scenes/quest/questFoeHost.js';
import { placeFoeFreely } from '../../src/systems/quest/sceneMount.js';
import { campAnchorSpot, PACK_SPACING, PACK_ALERT_RADIUS, CAMP_SIGHT_RADIUS } from '../../src/systems/campEncounters.js';
import { CAMP_ROAD_CLEAR_M } from '../../src/world/road/roadClearance.js';
import { LOOSE_FOE_PLACE_ATTEMPTS } from '../../src/scenes/hostEnchant.js';
import { createBountyHost } from '../../src/scenes/bountyHost.js';

const world = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
const slice = (from, to) => { const a = world.indexOf(from), b = world.indexOf(to, a); assert.ok(a > 0 && b > a, from); return world.slice(a, b); };
const rectSrc = slice('  const _inAnyLocationRect =', '  // F062: PlayerGPS.isPlayerInLocationRect');
const campSrc = slice('  const _standCampEncounter =', '  // BOUNTY1: A BOUNTY\'S PACK');
// PIN MOVED (STOREFRONT HOST-SPLIT): the dungeon's pack moved out of bootWorld (scenes/bountyDungeonPack.js), so the
// overworld pack ends where the loose foe's stand begins
const packSrc = slice('  const _standBountyPack =', '  const _standLooseFoe =');

const PX = 819.2;
/** world.js's own rect test over `locs` ({'x,y': half width of its rect, metres, round its pixel's middle}). */
function rectLaw(locs) {
  const deps = {
    state: { worldCoords: (p) => ({ x: p[0], z: p[2] }) },
    worldCoordToMapPixel: (x, z) => ({ x: Math.floor(x / PX + 0.5), y: Math.floor(z / PX + 0.5) }),
    locationIndex: new Map(Object.entries(locs).map(([k, half]) => [k, { exterior: { exteriorData: {} }, half }])),
    locationWorldRect: (loc, px, py) => ({ x0: px * PX - loc.half, x1: px * PX + loc.half, z0: py * PX - loc.half, z1: py * PX + loc.half }),
    isInLocationRect: (x, z, r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1,
  };
  return new Function(...Object.keys(deps), `${rectSrc}\nreturn _inAnyLocationRect;`)(...Object.values(deps));
}

test('FB1029 GRAVE-PACK the rect law: a spot in a location\'s rect is refused, the hunt\'s own place is not - over its edge into the next pixel too - and every other location\'s rect still is (mutants: the own place unread; the skip any pixel\'s; the skip every location\'s)', () => {
  const inRect = rectLaw({ '0,0': 153.6, '1,0': 153.6 });
  const own = { px: 0, py: 0 };
  assert.equal(inRect([30, 0, 0]), true, 'the graveyard\'s rect, no place handed');
  assert.equal(inRect([30, 0, 0], own), false, 'its own hunt stands there');
  assert.equal(inRect([PX - 100, 0, 0]), true, 'the next location\'s rect');
  assert.equal(inRect([PX - 100, 0, 0], own), true, 'another location\'s rect is refused still');
  assert.equal(inRect([30, 0, 0], { px: 1, py: 0 }), true, 'another place\'s hunt is refused in this one');
  const wide = rectLaw({ '0,0': 600 });
  assert.equal(wide([PX - 300, 0, 0]), true, 'its rect reaches over its pixel\'s edge');
  assert.equal(wide([PX - 300, 0, 0], own), false, 'its hunt stands there too: the skip is the place\'s, not the spot\'s pixel');
  const lone = rectLaw({ '0,0': 153.6 });
  assert.equal(lone([30, 0, 0], { px: 0, py: 1 }), true, 'the skip is the place\'s own pixel, not its column');
  assert.equal(lone([500, 0, 0], own), false, 'past every rect');
});

test('FB1029 GRAVE-PACK the stand from the crypt\'s door: the camp\'s own stand, the graveyard\'s rect a block past its walls - refused on every try with no place, standing on every try with the hunt\'s own (mutants: the anchor\'s rect test unhanded; a member\'s; the bounty stand drops the place)', async () => {
  let seed = 1029;
  const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const run = (place) => {
    const spawned = [];
    const deps = { collider: new Collider(() => 0), player: { feetAt: () => [30, 0, 0] }, bountyFarms: { inBuilding: () => false }, _inRock: () => false,
      cam: { yaw: 0 }, fieldOfView: () => Math.PI / 2, campAnchorSpot, LOOSE_FOE_PLACE_ATTEMPTS,
      _inAnyLocationRect: rectLaw({ '0,0': 153.6 }), _nearRoad: () => false, _overDeepWater: () => false,
      CAMP_ROAD_CLEAR_M, PACK_SPACING, PACK_ALERT_RADIUS, CAMP_SIGHT_RADIUS,
      campMembers: (a) => a, placeFoeEnv, placeFoeFreely, entityOccupancy, _placingPool: () => spawned,
      ENEMY_BASICS: { 0: { behaviour: 'General' } }, BOUNTY_GROUP_REACH_M: 150, _bountyTrailSpot: () => null,
      exteriorFoes: { newCampId: () => 1, spawnFoe: async (mobileType, p) => { const f = { mobileType, ai: { feet: p }, entity: {} }; spawned.push(f); return f; } } };
    const stand = new Function(...Object.keys(deps), `${campSrc}\n${packSrc}\nreturn _standBountyPack;`)(...Object.values(deps));
    const old = Math.random;
    Math.random = rand;
    try { return { stood: stand({ id: 'grave', mobileType: 0, count: 3, place }), spawned }; } finally { Math.random = old; }
  };
  for (let i = 0; i < 40; i++) {
    assert.equal(run(null).stood, null, 'the report: no place handed, nothing stands at the graveyard');
    const { stood, spawned } = run({ px: 0, py: 0 });
    assert.ok(stood, 'the hunt\'s own place: the pack stands');
    await stood.foes;
    assert.equal(spawned.length, 3, 'all three');
    for (const f of spawned) assert.ok(Math.hypot(f.ai.feet[0] - 30, f.ai.feet[2]) < 110 + PACK_SPACING + 1, 'round the hunter, as any pack');
  }
});

const TOWN = { px: 300, py: 200, name: 'Eastcastle' };
const GRAVE = '305,199', CAVE = '293,206';
const DUNG = { [GRAVE]: 'The Crypts of Wickfield', [CAVE]: 'The Dark Hollow' };

/** A board at Eastcastle with the graveyard and a cave in reach; the street's pool and the crypt's apart, as world.js's
 *  foePool answers them (`open`: the street's in every mode). */
function eastcastle() {
  const h = { outdoor: [], crypt: [], asked: [], below: [], outside: null, under: null, board: null, entity: { goldPieces: 0, items: [] } };
  const foes = (n, into) => { const list = Array.from({ length: n }, () => ({ dead: false, entity: { health: 5 } })); into.push(...list); return list; };
  h.host = createBountyHost({
    now: () => 900 * 1440 + 60, level: () => 20, entity: () => h.entity, townName: () => TOWN.name, siteOk: () => true,
    dungeonAt: (x, y) => DUNG[`${x},${y}`] ?? null, graveyardAt: (x, y) => (`${x},${y}` === GRAVE ? DUNG[GRAVE] : null),
    playerPixel: () => h.outside, dungeonPixel: () => h.under, canStand: () => true, canStandDungeon: () => true,
    standPack: (o) => { h.asked.push(o); return { foes: Promise.resolve(foes(o.count, h.outdoor)), dx: 0, dz: 80 }; },
    standDungeonPack: (o) => { h.below.push(o); return { foes: Promise.resolve(foes(o.count, h.crypt)), dx: 30, dz: 0 }; },
    foePool: (open) => (h.under && !open ? h.crypt : h.outdoor), say: () => {}, showNotice: () => true, openBoardWindow: (d) => { h.board = d; },
  });
  h.host.openBoard(TOWN);
  h.posts = h.board.rows().map((r) => r.posting);
  h.at = (p) => { h.outside = { x: p.target.px, y: p.target.py }; h.under = null; };
  h.down = (p) => { h.outside = null; h.under = { x: p.target.px, y: p.target.py }; };
  h.standing = (id) => (h.host.poseField().bq ?? []).some((r) => r.i === id && r.a === 1);
  return h;
}
const settle = async () => { for (let i = 0; i < 3; i++) await Promise.resolve(); };

test('FB1029 GRAVE-PACK the board\'s host: a graveyard\'s hunt hands its own pixel to the stand, any other none; its beasts carry the place (WILD-ALERT\'s rect reads it); a pack stood outside is kept while its hunter is down in the crypt, and its kills pay (mutants: the place unhanded; handed for every hunt; the beasts untagged; the pack judged by the crypt\'s pool)', async () => {
  const h = eastcastle();
  const grave = h.posts.find((p) => p.graveyard), field = h.posts.find((p) => p.kind === 'field');
  assert.ok(grave && field, 'a graveyard\'s hunt and the open ground\'s on the board');
  assert.equal(`${grave.target.px},${grave.target.py}`, GRAVE);

  h.board.take(field.id);
  h.at(field);
  h.host.tick(1);
  await settle();
  assert.equal(h.asked.length, 1);
  assert.equal(h.asked[0].place, null, 'the open ground\'s hunt hands no place: every rect refused as before');
  assert.ok(h.outdoor.every((f) => f.bountyPlace === null), 'its beasts carry none');
  h.host.drop(field.id);

  h.board.take(grave.id);
  h.at(grave);
  h.host.tick(1);
  const mine = h.asked.filter((o) => o.id === grave.id);
  assert.equal(mine.length, 1);
  assert.deepEqual(mine[0].place, grave.target, 'the graveyard\'s own pixel');
  await settle();
  const pack = h.outdoor.slice(-grave.count);
  for (const f of pack) assert.deepEqual(f.bountyPlace, grave.target, 'its beasts carry it');
  h.down(grave);
  h.host.tick(1);
  assert.equal(h.standing(grave.id), true, 'below, its beasts still stand on the street: the pose says so');
  h.at(grave);
  h.host.tick(1);
  assert.equal(h.asked.filter((o) => o.id === grave.id).length, 1, 'kept through the crypt: never stood a second time');
  for (const f of pack) { f.dead = true; f.corpse = true; }
  h.host.tick(1);
  assert.equal(h.entity.goldPieces, grave.gold, 'its kills pay');
});

test('FB1029 GRAVE-PACK AUDIT B1: a pack handed off at the crypt\'s door (online, a peer in sight) is gone from the street\'s pool - gone from the hunt at once, below, so the pose no longer holds the party\'s hunt, and it stands again on the way out (mutant: judged outdoors alone)', async () => {
  const h = eastcastle();
  const grave = h.posts.find((p) => p.graveyard);
  h.board.take(grave.id);
  h.at(grave);
  h.host.tick(1);
  await settle();
  assert.equal(h.standing(grave.id), true);
  h.down(grave);
  h.outdoor.length = 0;   // exteriorFoes.handOver -> dropOwnLive: my pool keeps none of them
  h.host.tick(1);
  assert.equal(h.standing(grave.id), false, 'below, the hunt is free for a mate at the graveyard');
  h.at(grave);
  h.host.tick(1);
  assert.equal(h.asked.filter((o) => o.id === grave.id).length, 2, 'out again, a pack stands');
});

test('FB1029 GRAVE-PACK AUDIT C-S2: an open-ground hunt\'s pack is the street\'s too - kept while its hunter is down in another dungeon, gone when its beasts are (mutant: the street\'s pool the graveyard\'s alone)', async () => {
  const h = eastcastle();
  const field = h.posts.find((p) => p.kind === 'field');
  h.board.take(field.id);
  h.at(field);
  h.host.tick(1);
  await settle();
  h.outside = null; h.under = { x: 1, y: 1 };   // below somewhere else: the crypt's pool is not its
  h.host.tick(1);
  assert.equal(h.standing(field.id), true, 'kept below');
  h.outdoor.length = 0;
  h.host.tick(1);
  assert.equal(h.standing(field.id), false, 'gone with its beasts');
});

test('FB1029 GRAVE-PACK AUDIT B2: a dungeon\'s hunt is judged by the dungeon\'s pool - kept while its beasts stand below, stood again when a load took them (mutants: every pack judged by the street\'s pool; by the mode\'s)', async () => {
  const h = eastcastle();
  const cave = h.posts.find((p) => p.kind === 'dungeon' && !p.graveyard);
  assert.ok(cave, 'the cave\'s hunt on the board');
  h.board.take(cave.id);
  h.down(cave);
  h.host.tick(1);
  await settle();
  assert.equal(h.below.length, 1);
  h.host.tick(1);
  assert.equal(h.below.length, 1, 'its beasts stand below: never stood twice');
  h.crypt.length = 0;
  h.host.tick(1);
  assert.equal(h.below.length, 2, 'a load took them: the pack stands again');
});

test('FB1029 GRAVE-PACK the host\'s wiring: the pool asked is the street\'s for an open-air pack in every mode, and WILD-ALERT\'s three rect tests read a beast\'s place - its mark, the gate and the stealth check (mutants: the pool the mode\'s; a test unhanded)', () => {
  assert.ok(world.includes("foePool: (open = false) => (!open && (modes?.mode ?? 'exterior') === 'dungeon' ? (modes?.dungeonCtx?.foes ?? []) : exteriorFoes.foes),"), 'the pool asked');
  const marks = slice('  function wildMarksFrame(', '\n  }\n'), gate = slice('  const wildGated = (f) =>', '\n'), step = slice('  function wildFoesFrame(', '\n  }\n');
  for (const [name, src] of [['the mark', marks], ['the gate', gate], ['the stealth check', step]]) {
    assert.ok(src.includes('_inAnyLocationRect(f.ai.feet, f.bountyPlace)'), name);
    assert.ok(!/_inAnyLocationRect\(f\.ai\.feet\)/.test(src), `${name}: no rect test without the place`);
  }
});
