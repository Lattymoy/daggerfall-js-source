// TIER1 (2026-10-05, Mac: "Along with this change will be a simplier addition, visible showing dungeons difficulty as
// Regular, Elite or Super"; bible/11-Multiplayer/Super-Dungeons.md section 12): A DUNGEON'S TIER, IN ONE WORD -
// and, with SD-ONLINE, its size beside it.
//
// One law (systems/dungeonTier.js, a leaf): 'super' for a Hollow, 'elite' for an Elite spawn, 'regular' for every
// other dungeon, null for a place with none. Its words are what every surface draws, online - where the tiers differ -
// and the size word is the BUILT dungeon's, by its block count, as the room builds it online (world/dungeonLabel.js,
// which gives no label to a place the port made: the court, the arena's floor, its undercroft). The surfaces: the
// mouth's plaque, the held map's label and I box (test/heldmap.test.js drives them), the overworld's plates, the
// sight line, and one line on entering. Offline the plaque keeps the World Tooltips mod's own "To <name>".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DUNGEON_TIERS, DUNGEON_TIER_TEXT, DUNGEON_SIZE_TEXT, dungeonTier, dungeonTierText, tierShown, tierPhrase,
} from '../src/systems/dungeonTier.js';
import { dungeonSizeClass, dungeonSizeOnline, dungeonTierLabel, madeDungeon } from '../src/world/dungeonLabel.js';
import { GATE_ARENA_LOCATION_ID } from '../src/world/gateArena.js';
import { ARENA_FLOOR_LOCATION_ID } from '../src/world/arenaFloor.js';
import { UNDERCROFT_LOCATION_ID } from '../src/world/arenaCity.js';
import { dungeonSightLine } from '../src/world/spawnedDungeons.js';
import { onlineDungeonSize, dungeonLocationFor } from '../src/world/smallerDungeons.js';
import { synthesizeDungeonLocation } from '../src/world/spawnedDungeons.js';
import { staticDoorName } from '../src/systems/worldTooltips.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const PRIVATEERS_HOLD = 187853213;
const SMALL_ID = 700, MEDIUM_ID = 701, LARGE_ID = 704;   // test/sdonline.test.js pins each to its size
const block = (name) => ({ blockName: name, x: 9, z: 9, isStartingBlock: false });
const loc = (n, mapId, extra = {}) => ({
  name: `Keep ${mapId}`, regionIndex: 17, hasDungeon: true, mapTableData: { mapId },
  dungeon: { blocks: Array.from({ length: n }, (_, i) => block(`${i % 3 === 0 ? 'B' : i % 3 === 1 ? 'N' : 'W'}00000${String(i).padStart(2, '0')}.RDB`)) },
  ...extra,
});

test('TIER1: the law - three tiers, their words, read off the location; null without a dungeon', () => {
  assert.deepEqual([...DUNGEON_TIERS], ['regular', 'elite', 'super']);
  assert.deepEqual({ ...DUNGEON_TIER_TEXT }, { regular: 'Regular Dungeon', elite: 'Elite Dungeon', super: 'Abyss Dungeon' });   // ABYSS-NAME (PIN MOVED): the player's word for the tier the code calls super
  assert.deepEqual({ ...DUNGEON_SIZE_TEXT }, { small: 'Small', medium: 'Medium', large: 'Large' });
  for (const t of [DUNGEON_TIERS, DUNGEON_TIER_TEXT, DUNGEON_SIZE_TEXT]) assert.ok(Object.isFrozen(t));
  assert.equal(dungeonTier(loc(10, 1)), 'regular');
  assert.equal(dungeonTier(loc(10, 1, { elite: true })), 'elite');
  assert.equal(dungeonTier(loc(10, 1, { superTier: true })), 'super');
  assert.equal(dungeonTier(loc(10, 1, { superTier: true, elite: true })), 'super', 'a Hollow is Super whatever else it is');
  assert.equal(dungeonTier(loc(10, 1, { elite: 'yes', superTier: 1 })), 'regular', 'the flags are the booleans the builders write, nothing looser');
  assert.equal(dungeonTier({ hasDungeon: false }), null, 'a town with no dungeon');
  assert.equal(dungeonTier(null), null);
  assert.equal(dungeonTierText(loc(10, 1, { elite: true })), 'Elite Dungeon');
  assert.equal(dungeonTierText({ hasDungeon: false }), null);
  assert.equal(tierShown(true), true);
  assert.equal(tierShown(false), false, 'offline every dungeon is DFU\'s');
  assert.equal(tierShown(1), false);
  // an Elite spawn as the builder makes it: its own flag, read here
  const template = { name: 'Old Ruin', regionIndex: 3, regionName: 'Alik\'r', hasDungeon: true, mapTableData: { mapId: 99, locationType: 9 }, dungeon: { blocks: [block('B0'), block('N1')], recordElement: { header: { locationId: 9 } } }, exterior: {} };
  assert.equal(dungeonTier(synthesizeDungeonLocation(template, { salt: 1, px: 10, py: 20, elite: true })), 'elite');
  assert.equal(dungeonTier(synthesizeDungeonLocation(template, { salt: 1, px: 10, py: 20, elite: false })), 'regular');
});

test('TIER1: the size - the BUILT dungeon\'s, by its block count, as the room builds it online', () => {
  assert.equal(dungeonSizeClass(loc(5, 1)), 'small');
  assert.equal(dungeonSizeClass(loc(6, 1)), 'medium');
  assert.equal(dungeonSizeClass(loc(8, 1)), 'medium');
  assert.equal(dungeonSizeClass(loc(9, 1)), 'large');
  assert.equal(dungeonSizeClass({ dungeon: { blocks: [] } }), null, 'a summary row carries no blocks');
  assert.equal(dungeonSizeClass(null), null);
  assert.equal(onlineDungeonSize(loc(20, SMALL_ID)), 'small');
  assert.equal(dungeonSizeOnline(loc(20, SMALL_ID)), 'small');
  assert.equal(dungeonSizeOnline(loc(20, MEDIUM_ID)), 'medium');
  assert.equal(dungeonSizeOnline(loc(20, LARGE_ID)), 'large');
  assert.equal(dungeonSizeOnline(loc(5, LARGE_ID)), 'small', 'a five-block dungeon is small whatever the world drew');
  assert.equal(dungeonSizeOnline(loc(20, PRIVATEERS_HOLD)), 'large', 'the main story is never re-laid: its own size');
  assert.equal(dungeonSizeOnline({ hasDungeon: true, dungeon: {} }), null);
  // the same question the host asks the size law
  for (const id of [SMALL_ID, MEDIUM_ID, LARGE_ID]) assert.equal(dungeonSizeOnline(loc(20, id)), dungeonSizeClass(dungeonLocationFor(loc(20, id), { online: true })));
  // kept per location: the second ask is the first's answer, frozen
  const l = loc(20, MEDIUM_ID, { elite: true });
  const a = dungeonTierLabel(l);
  assert.deepEqual({ ...a }, { tier: 'elite', text: 'Elite Dungeon', size: 'Medium' });
  assert.equal(dungeonTierLabel(l), a);
  assert.ok(Object.isFrozen(a));
  assert.equal(dungeonTierLabel({ hasDungeon: false }), null);
  assert.equal(tierPhrase(a), 'Elite Dungeon, Medium');
  assert.equal(tierPhrase({ text: 'Abyss Dungeon', size: null }), 'Abyss Dungeon', 'no size known: the tier alone');
  assert.equal(tierPhrase(null), '');
});

test('TIER1: the places the port made stand in the dungeon host and are no dungeon to tier - the court, the arena\'s floor, its undercroft', () => {
  const made = [
    loc(1, 1, { gate: 7, dungeon: { blocks: [block('N0')], recordElement: { header: { locationId: GATE_ARENA_LOCATION_ID } } } }),
    loc(1, 1, { arenaFloor: 'x1', dungeon: { blocks: [block('N0')], recordElement: { header: { locationId: ARENA_FLOOR_LOCATION_ID } } } }),
    loc(32, 1, { arenaUndercroft: true, dungeon: { blocks: loc(32, 1).dungeon.blocks, recordElement: { header: { locationId: UNDERCROFT_LOCATION_ID } } } }),
  ];
  for (const l of made) {
    assert.equal(madeDungeon(l), true);
    assert.equal(dungeonTier(l), 'regular', 'the leaf reads the flags it is given...');
    assert.equal(dungeonTierLabel(l), null, '...and the label refuses what the port made');
  }
  assert.equal(madeDungeon(loc(10, 1)), false);
  assert.equal(madeDungeon(loc(1, 1, { gate: 7 })), false, 'the flag alone is no court: its location id is the made level\'s');
});

test('TIER1: the words on the overworld - the sight line names the tier, the plates carry it under the name online, and one line is said on entering', () => {
  assert.equal(dungeonSightLine(410, 'North'), 'You see a Dungeon 410 metres to the North!');
  assert.equal(dungeonSightLine(410, 'North', 'regular'), 'You see a Dungeon 410 metres to the North!');
  assert.equal(dungeonSightLine(410, 'North', 'elite'), 'You see an Elite Dungeon 410 metres to the North!');
  assert.equal(dungeonSightLine(410, 'North', 'super'), 'You see an Abyss Dungeon 410 metres to the North!');
  const w = rd('src/scenes/world.js');
  assert.match(w, /tvSay\(dungeonSightLine\(Math\.hypot\(dx, dz\), _capitalize\(directionHintString\(dx, dz\)\), dungeonTier\(loc\)\), 5\);/);
  assert.match(w, /const tier = params\.has\('online'\) \? tierPhrase\(dungeonTierLabel\(p\.summary\.loc\)\) : '';[^\n]*\n\s*marks\.push\(\{ key: p\.key, at: tvSceneKept\(p, p\.x, p\.z, TV_PLACE_LIFT\), label: p\.summary\.name, \.\.\.\(tier \? \{ sub: tier \} : \{\}\), kind: 'place',/, 'a place plate: the tier under a dungeon\'s name, online');
  assert.match(w, /const tier = params\.has\('online'\) \? tierPhrase\(dungeonTierLabel\(g\.loc\)\) : '';[^\n]*\n\s*marks\.push\(\{ key: g\.key, [^\n]*sub: tier \? `\$\{tier\} - \$\{farDistanceText\(km\)\}` : farDistanceText\(km\),/, 'a far plate: the tier before the distance');
  assert.match(w, /tierAt: params\.has\('online'\) \? \(summary\) => \(summary \? dungeonTierLabel\(maps\.getLocation\(summary\.regionIndex, summary\.locationIndex \?\? summary\.mapIndex\)\) : null\) : null,/, 'the held map\'s seam: the whole location, online alone');
  // the entry line: the BUILT dungeon's word, online, said once on the transition
  assert.match(w, /onTransitionDungeonInterior: \(ctx\) => \{ navalStow\(\); ohAbyss\?\.onDungeonEntered\(ohDungeonOf\(ctx\)\); csaOnTransition\(\); navalTransition\(\); dungeonTierSay\(\); \},/);
  const say = w.slice(w.indexOf('function dungeonTierSay() {'), w.indexOf('\n  }\n', w.indexOf('function dungeonTierSay() {')));
  assert.match(say, /if \(!params\.has\('online'\)\) return;\s*const line = tierPhrase\(dungeonTierLabel\(modes\?\.dungeonLocation \?\? null\)\);\s*if \(line\) townTalk\.say\(line, 4\);/);
});

test('TIER1: the plaque - a named tier titles the mouth, the way in and the size beneath; no tier, the mod\'s own', () => {
  assert.deepEqual(staticDoorName('dungeonEntrance', { locationName: 'Privateer\'s Hold', tier: 'regular', size: 'Large' }), { title: 'Regular Dungeon', subs: ['To Privateer\'s Hold', 'Large'] });
  assert.deepEqual(staticDoorName('dungeonEntrance', { locationName: 'Elite Old Ruin (10,20)', tier: 'elite', size: 'Small' }), { title: 'Elite Dungeon', subs: ['To Old Ruin (10,20)', 'Small'] });
  assert.deepEqual(staticDoorName('dungeonEntrance', { locationName: 'The Brass Hollow', tier: 'super', size: null }), { title: 'Abyss Dungeon', subs: ['To The Brass Hollow'] });
  assert.deepEqual(staticDoorName('dungeonEntrance', { locationName: 'Privateer\'s Hold' }), { title: 'To\nPrivateer\'s Hold' }, 'offline: the mod\'s own');
  assert.deepEqual(staticDoorName('dungeonEntrance', { locationName: 'Privateer\'s Hold', tier: 'toString' }), { title: 'To\nPrivateer\'s Hold' }, 'a tier is one of the three, never the prototype\'s');
  assert.deepEqual(staticDoorName('buildingExit', { locationName: 'Daggerfall', tier: 'regular' }), { title: 'To\nDaggerfall' }, 'a tier is a dungeon mouth\'s alone');
  // the host names the tier online alone, and the undercroft's stair none
  const m = rd('src/scenes/worldModes.js');
  assert.match(m, /const label = tierShown\(host\.dungeonOnline\?\.\(\) \?\? false\) \? dungeonTierLabel\(entry\.dfLocation\) : null;\n\s*return staticDoorName\('dungeonEntrance', \{ locationName: currentLocationName\(\), tier: label\?\.tier \?\? null, size: label\?\.size \?\? null \}\);/);
  assert.match(m, /return staticDoorName\('dungeonEntrance', \{ locationName: ARENA_TEXT\.undercroft\.name \}\);/);
  assert.doesNotMatch(rd('src/systems/worldTooltips.js'), /elite = false/, 'the plaque\'s old `elite` flag is the tier now, not beside it');
});
