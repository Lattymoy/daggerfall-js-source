// FIELD BUGS 2026-09-29h (BOUNTY-LAIR) - "Bounty targets can spawn in inaccessible parts of dungeons" (a door between
// two torches, and the automap's small room the corridor never reaches).
//
// A dungeon hunt's pack stands round an anchor 25 to 90 metres from the hunter (BOUNTY1). The anchor was any of the
// dungeon's own foes - and a foe stands at every enemy marker of every block (RDBLayout's 199.15/16), in sealed rooms,
// under water and past doors held beyond any pick, none of which the game ever asks a player to reach. Daggerfall's own
// answer to "a target in this dungeon" is the QUEST SPAWN MARKER (199.11): EnumerateDungeonQuestMarkers (Place.cs:1522)
// collects them and a quest's foe is stood at one (markerScenePosition). The lair is one of those now, and a foe's place
// only in a dungeon that has none.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dungeonQuestSpawnSpots } from '../../src/systems/quest/place.js';

const W = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
const DC = readFileSync(new URL('../../src/scenes/dungeonContext.js', import.meta.url), 'utf8');

/** A laid-out block as world/rdbLayout.js hands it (archive-199 markers carry no archive; a treasure flat its 216). */
const block = (originX, originZ, markers) => ({ originX, originZ, layout: { markers } });

test('BOUNTY-LAIR: the quest spawn markers, in the scene\'s frame - 199.11 alone, under each block\'s origin', () => {
  const blocks = [
    block(0, 0, [
      { record: 11, x: 3, y: -1, z: 4 },          // a quest spawn marker
      { record: 16, x: 9, y: -1, z: 9 },          // a fixed enemy - where a foe stands, not a quest
      { record: 15, x: 7, y: -1, z: 7 },          // a random enemy
      { record: 18, x: 5, y: -1, z: 5 },          // a quest ITEM marker - an item's place, not a foe's
      { record: 10, x: 1, y: 0, z: 1 },           // the start marker
      { record: 11, archive: 216, x: 2, y: 0, z: 2 },   // a treasure flat sharing the record's number (AUDIT 39 #19)
    ]),
    block(51.2, -51.2, [{ record: 11, x: 1, y: -2, z: 2 }]),
  ];
  assert.deepEqual(dungeonQuestSpawnSpots(blocks), [[3, -1, 4], [52.2, -2, -49.2]]);
  assert.deepEqual(dungeonQuestSpawnSpots(null), [], 'no dungeon, no spots');
  assert.match(DC, /\n\s*questSpawnSpots: \(\) => dungeonQuestSpawnSpots\(dungeon\.blocks\),/, 'the dungeon context answers them for its own blocks');
});

/** The host's own `_standBountyDungeonPack`, lifted off world.js, over a dungeon context of the test's making. */
function standPack(d, feet) {
  const m = /\n {2}(const _standBountyDungeonPack = \(\{ mobileType, count \}\) => \{\n[\s\S]*?\n {2}\};)\n/.exec(W);
  assert.ok(m, '_standBountyDungeonPack moved');
  // eslint-disable-next-line no-new-func
  const make = new Function('_dungeonPool', 'enchantFeet', 'exteriorFoes', 'placeFoeEnv', 'entityOccupancy', 'LOOSE_FOE_PLACE_ATTEMPTS', 'placeFoeFreely', 'ENEMY_BASICS',
    `${m[1]}\nreturn _standBountyDungeonPack;`);
  return make(() => d, () => feet, { newCampId: () => 7 }, (o) => o, () => () => false, 3,
    (env) => ({ x: env.playerFeet[0] + 1, y: env.playerFeet[1] - 0.9, z: env.playerFeet[2] }), {});
}
const pool = (foeFeet, spots) => ({
  collider: {}, spawnLooseFoe: async () => ({ entity: {} }),
  foes: foeFeet.map((f) => ({ ai: { feet: f } })),
  ...(spots ? { questSpawnSpots: () => spots } : {}),
});

test('BOUNTY-LAIR: the lair stands at a quest spawn marker in the band, never at a foe\'s place in a sealed room (mutant: the layout foes first)', () => {
  const feet = [0, 0, 0];
  const sealed = [40, 0, 0];      // a foe 40 m off, in a room no corridor reaches - the old anchor's only choice in the band
  const spot = [0, 0, 60];        // the dungeon's quest spawn marker, 60 m off
  for (let i = 0; i < 20; i++) {  // the pick in the band is random: every draw must be the marker
    const got = standPack(pool([sealed], [spot]), feet)({ mobileType: 1, count: 2 });
    assert.deepEqual([got.dx, got.dz], [0, 60], 'anchored on the quest marker');
  }
});

test('BOUNTY-LAIR: past the band the farthest marker; and a dungeon with no quest markers keeps its foes\' places (the old law)', () => {
  const feet = [0, 0, 0];
  const banded = standPack(pool([[30, 0, 0]], [[0, 0, 150], [0, 0, 60], [0, 0, 10]]), feet)({ mobileType: 1, count: 1 });
  assert.deepEqual([banded.dx, banded.dz], [0, 60], 'one in 25-90 m: that one, never the farther');
  const far = standPack(pool([[30, 0, 0]], [[0, 0, 10], [0, 0, 150], [5, 0, 0]]), feet)({ mobileType: 1, count: 1 });
  assert.deepEqual([far.dx, far.dz], [0, 150], 'none in 25-90 m: the farthest marker');
  const none = standPack(pool([[30, 0, 0]], []), feet)({ mobileType: 1, count: 1 });
  assert.deepEqual([none.dx, none.dz], [30, 0], 'no quest markers (dungeon types 17-18): a foe\'s place, as BOUNTY1 had it');
  const older = standPack(pool([[0, 0, 35]], null), feet)({ mobileType: 1, count: 1 });
  assert.deepEqual([older.dx, older.dz], [0, 35], 'a context with no answer: the foes');
  assert.equal(standPack(pool([], []), feet)({ mobileType: 1, count: 1 }), null, 'nothing anywhere: no pack');
});
