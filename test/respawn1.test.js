// RESPAWN1 - A DUNGEON'S DEAD STOOD BACK UP, AND THE DOOR WAS WHY.
//
// Mac, 2026-09-17, forwarding a patch: a dungeon's kills did not persist.
// Every other part of the pipeline was right - the kill was stamped
// (`died`, the relay's clock), collected (`collectWorld`), sent, stored
// and served back - and then the RESTORE threw the whole memory away,
// because `validSharedFoe` asked for `team` and `mobileTeam` as NUMBERS
// and this port carries them as the MobileTeams NAME. Every foe has a
// team, so every record was refused whole and `.filter(Boolean)` dropped
// the lot.
//
// The pin that should have caught it passed `team: 2` - it encoded the
// same misreading as the code, which is the shape of a bug that survives
// a green suite. So the pin below is not another example: it takes the
// PUBLISHER's own field list out of the source, builds the record that
// publisher would really write, and asserts the DOOR admits it. A field
// added to the record with a law the door does not share fails here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validSharedFoe, TEAM_NAME_MAX } from '../src/net/wire.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** AUDIT QS6 F5 - THE MEMORY'S PUBLISHER IS `sharedWorld`, NOT `collectWorld`.
 *
 *  This pin read `collectWorld`'s keys and called them "the record the dungeon
 *  really publishes". They are not: `sharedWorld` takes that record and STRIPS
 *  it before the memory is sent - `for (const f of w.foes) delete f.items;`,
 *  because a corpse's loot is the room's `loot` half and not the foe's (AUDIT
 *  WORLD4 D4/B3). So the pin was carrying a field the door is RIGHT to refuse,
 *  and claiming the door was wrong to be silent about it.
 *
 *  Read off the source, so a sixth deletion joins here by itself. */
function strippedFoeKeys() {
  const src = read('src/scenes/dungeonContext.js');
  const at = src.indexOf('    sharedWorld() {');
  assert.ok(at > 0, 'sharedWorld no longer opens where this pin looks');
  const end = src.indexOf('\n    },', at);
  const body = src.slice(at, end);
  return new Set([...body.matchAll(/for \(const f of w\.foes\) delete f\.(\w+);/g)].map((m) => m[1]));
}

/** The keys `collectWorld`'s foe record really writes, read off the
 *  source - so this pin follows the publisher rather than a copy of it. */
function publishedFoeKeys() {
  const src = read('src/scenes/dungeonContext.js');
  const at = src.indexOf('      foes: foes.map((f) => ({');
  assert.ok(at > 0, 'collectWorld no longer opens its foe record where this pin looks');
  const end = src.indexOf('\n      })),', at);
  assert.ok(end > at, 'the foe record no longer closes where this pin looks');
  // the opening `foes: foes.map(...)` line is the wrapper, not a field
  const body = src.slice(src.indexOf('\n', at), end);
  const keys = new Set();
  for (const line of body.split('\n')) {
    const bare = line.replace(/\/\/.*$/, '');   // a trailing comment carries `WORLD8:` and other colons
    for (const m of bare.matchAll(/(?:^|[{,]|\s)([a-zA-Z_][\w]*)\s*:/g)) keys.add(m[1]);
  }
  return keys;
}

/** What the publisher would really put in each of those fields, off the
 *  live types: the entity's team is a MobileTeams NAME, the flats are
 *  booleans, the feet are the pose's three numbers. */
const REAL = {
  health: 12, dead: true, died: 1_700_000_000_000, feet: [10.5, 2, -3.25], yaw: 0.75, anchor: 1,
  items: [], hostile: true, encountered: true, magicka: 4, mobileType: 21, gender: 'female',
  maxHealth: 30, fatigue: 64, activeEffects: [{ name: 'Paralysis', rounds: 2 }],
  team: 'PlayerEnemy', mobileTeam: 'PlayerEnemy', wabbajackActive: false, specialTransformationCompleted: false,
};

test('RESPAWN1: the door admits the record the dungeon really publishes - every field, by the type the publisher writes', () => {
  const keys = publishedFoeKeys();
  // The publisher and this pin have to be talking about the same record.
  for (const k of ['health', 'dead', 'died', 'feet', 'yaw', 'team', 'mobileTeam', 'mobileType']) {
    assert.ok(keys.has(k), `collectWorld no longer publishes ${k} - this pin is stale`);
  }
  const unknown = [...keys].filter((k) => !(k in REAL));
  assert.deepEqual(unknown, [], 'collectWorld publishes a field this pin has no real value for - add one, and check the door has an arm for it');

  // AUDIT QS6 F5: the MEMORY's record is the stripped one.
  const stripped = strippedFoeKeys();
  assert.ok(stripped.has('items'), 'sharedWorld still strips the corpse\'s loot - the room\'s `loot` half carries it');
  const memoryKeys = [...keys].filter((k) => !stripped.has(k));
  const record = Object.fromEntries(memoryKeys.map((k) => [k, REAL[k]]));
  const out = validSharedFoe(record);
  assert.ok(out, 'THE WHOLE RECORD IS REFUSED - which is what dropped every dungeon memory this port ever wrote');

  // The kill itself has to survive: this is the thing that did not stick.
  assert.equal(out.dead, true);
  assert.equal(out.died, REAL.died);
  assert.equal(out.health, 12);
  // ...and the team pair, the field that refused it.
  assert.equal(out.team, 'PlayerEnemy');
  assert.equal(out.mobileTeam, 'PlayerEnemy');

  // AUDIT QS6 F5, THE SECOND HALF: ADMITTED IS NOT CARRIED. This loop used to
  // assert only that a record carrying one field came back TRUTHY - and it
  // always did, because `health: 1` rode beside it. A field the door has no
  // law for is DROPPED in silence, which is the exact shape of the bug this
  // file exists for, so the claim is `k in out` now.
  for (const k of memoryKeys) {
    const one = validSharedFoe({ health: 1, [k]: REAL[k] });
    assert.ok(one, `a record carrying only ${k} is refused - the door's law for it is not the publisher's`);
    assert.ok(k in one, `${k} is ADMITTED AND THEN DROPPED - the memory would carry it home and lose it at the door`);
  }
  // ...and the other way: what the publisher will not say, the door will not
  // hear. A stripped field offered anyway is not carried.
  for (const k of stripped) {
    const one = validSharedFoe({ health: 1, [k]: REAL[k] });
    assert.ok(one && !(k in one), `${k} is stripped by sharedWorld, so the door must not admit it either`);
  }
});

test('RESPAWN1: the team pair is a NAME, not an ordinal - DFU writes the number, this port does not', () => {
  const base = { health: 5, feet: [0, 0, 0] };
  for (const team of ['PlayerEnemy', 'PlayerAlly', 'Vermin', 'Criminals', 'Undead', 'Daedra', 'KnightsAndMages']) {
    assert.equal(validSharedFoe({ ...base, team, mobileTeam: team })?.team, team, `${team} rides through`);
  }
  // DFU's serializer writes `(int)entity.Team + 1`; a record carrying
  // that is not this port's and is refused, as every off-law value is.
  assert.equal(validSharedFoe({ ...base, team: 2 }), null, 'an ordinal is not a team here');
  assert.equal(validSharedFoe({ ...base, team: null }), null);
  assert.equal(validSharedFoe({ ...base, team: {} }), null);
  assert.equal(validSharedFoe({ ...base, team: 'x'.repeat(TEAM_NAME_MAX + 1) }), null, 'and the string is bounded like every other');
  assert.ok(validSharedFoe({ ...base, team: 'x'.repeat(TEAM_NAME_MAX) }), 'up to the bound');
  // The port's own source is where the type comes from, not a guess.
  assert.match(read('src/characters/enemyEntity.js'), /team: basics\.team \?\? 'PlayerEnemy',/);
  assert.match(read('src/combat/playerWeapon.js'), /foe\?\.entity\?\.team === 'PlayerAlly'/);
});

test('RESPAWN1: the restore projects the foes through that door, and a refusal drops the record whole', () => {
  const d = read('src/scenes/dungeonContext.js');
  // The one line the bug was fatal at: a null from the door is filtered
  // out, so a door that refuses everything restores nothing at all.
  assert.match(d, /const sfoes = Array\.isArray\(shared\.world\.foes\) \? shared\.world\.foes\.slice\(0, _layoutFoes\)\.map\(validSharedFoe\)\.filter\(Boolean\) : \[\];/);
  assert.match(d, /applyWorld\(\{ \.\.\.shared\.world, piles: undefined, actions: acts, foes: sfoes \}/);
});
