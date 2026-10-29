// FB1029 GRAVE-PACK (bible/01-Overview/bugs/Field-Bugs-2026-10-29.md; "Bounty targets in crypt" - "The Daedroths don't
// seem to spawn inside the crypt or in the overworld around it"): a graveyard's hunt stands its pack in the open air, and
// the camp's stand refused every spot in any location's rect - the graveyard's own, a block past its walls each side -
// so from its door, its grounds or its arrival nothing ever stood. The hunt's own place is never refused now, every other
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
const packSrc = slice('  const _standBountyPack =', '  // BOUNTY1 (Mac: "Dungeon bounties');

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

test('FB1029 GRAVE-PACK the board\'s host: a graveyard\'s hunt hands its own pixel to the stand, any other none; a pack stood outside it is kept while its hunter is down in the crypt, and its kills pay (mutants: the place unhanded; handed for every hunt; the pack judged by the crypt\'s pool)', async () => {
  const outdoor = [], crypt = [], asked = [];
  let outside = null, below = null, board = null;
  const entity = { goldPieces: 0, items: [] };
  const host = createBountyHost({
    now: () => 900 * 1440 + 60, level: () => 20, entity: () => entity, townName: () => TOWN.name, siteOk: () => true,
    dungeonAt: (x, y) => DUNG[`${x},${y}`] ?? null, graveyardAt: (x, y) => (`${x},${y}` === GRAVE ? DUNG[GRAVE] : null),
    playerPixel: () => outside, dungeonPixel: () => below, canStand: () => true, canStandDungeon: () => true,
    standPack: (o) => { asked.push(o); const foes = Array.from({ length: o.count }, () => ({ dead: false, entity: { health: 5 } })); outdoor.push(...foes); return { foes: Promise.resolve(foes), dx: 0, dz: 80 }; },
    standDungeonPack: () => null,
    foePool: () => (below ? crypt : outdoor), say: () => {}, showNotice: () => true, openBoardWindow: (d) => { board = d; },
  });
  host.openBoard(TOWN);
  const posts = board.rows().map((r) => r.posting);
  const grave = posts.find((p) => p.graveyard), field = posts.find((p) => p.kind === 'field');
  assert.ok(grave && field, 'a graveyard\'s hunt and the open ground\'s on the board');
  assert.equal(`${grave.target.px},${grave.target.py}`, GRAVE);

  board.take(field.id);
  outside = { x: field.target.px, y: field.target.py };
  host.tick(1);
  assert.equal(asked.length, 1);
  assert.equal(asked[0].place, null, 'the open ground\'s hunt hands no place: every rect refused as before');
  host.drop(field.id);

  board.take(grave.id);
  outside = { x: grave.target.px, y: grave.target.py };
  host.tick(1);
  const mine = asked.filter((o) => o.id === grave.id);
  assert.equal(mine.length, 1);
  assert.deepEqual(mine[0].place, grave.target, 'the graveyard\'s own pixel');
  await Promise.resolve(); await Promise.resolve();
  const pack = outdoor.slice(-grave.count);
  outside = null; below = { x: grave.target.px, y: grave.target.py };
  host.tick(1);
  outside = { x: grave.target.px, y: grave.target.py }; below = null;
  host.tick(1);
  assert.equal(asked.filter((o) => o.id === grave.id).length, 1, 'kept through the crypt: never stood a second time');
  for (const f of pack) { f.dead = true; f.corpse = true; }
  host.tick(1);
  assert.equal(entity.goldPieces, grave.gold, 'its kills pay');
});
