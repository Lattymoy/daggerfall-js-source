// DQ1 - A QUEST NPC OR ITEM STANDING IN A DUNGEON COULD NOT BE CLICKED.
//
// B2 mounted quest stands underground: `standDungeonQuestFlat` builds
// them through the SAME factory as the interior's, into the same record
// shape, and the frame draws and updates them. What never landed was
// the ray. `tryExitDungeon` walked exit doors, action objects and loot
// targets, plus a separate `pickQuestFoe` pass for quest FOES - and
// nothing else. So underground, `clicked npc` and `clicked item` never
// fired. Only kills did, which is why the gap survived: a dungeon quest
// that asks you to kill something works, and one that asks you to pick
// something up silently does not.
//
// DFU has no scene gate here at all. PlayerActivate's quest-resource
// arm (:326-339) runs on whatever the ray hit, wherever the player is
// standing; the only thing that differs underground is `buildingKey`,
// which StaticNPC reads from the runtime data (:299-306) and which is
// 0 in a dungeon exactly as `mapID` is 0 in both.
//
// So the fix is a ray entry and a click route - and, because the
// interior arm already had forty lines of both, ONE HOME for each
// rather than a second copy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const wm = () => readFileSync(join(ROOT, 'src/scenes/worldModes.js'), 'utf8');

test('DQ1: the target walk and the click each have ONE home', () => {
  const s = wm();
  assert.equal([...s.matchAll(/const questFlatTargets = \(list\) => \{/g)].length, 1);
  assert.equal([...s.matchAll(/const clickQuestFlat = \(s, buildingKey\) => \{/g)].length, 1);
  // and no host builds the aabb itself any more
  assert.equal([...s.matchAll(/key: `questflat:\$\{i\}`/g)].length, 1,
    'the questflat target key is minted in exactly one place');
  assert.equal([...s.matchAll(/setLastNPCClicked\(questBridge\.layoutNpcData\(/g)].length, 1,
    'and the NPCData stamp likewise');
});

test('DQ1: BOTH rays offer the stands, each from its own list', () => {
  const s = wm();
  const interior = s.slice(s.indexOf('function tryExit()'), s.indexOf('function tryExitDungeon') > 0
    ? s.indexOf('function tryExitDungeon') : s.length);
  assert.match(s, /targets\.push\(\.\.\.questFlatTargets\(questFlats\)\);/, 'the interior ray');
  assert.match(s, /targets\.push\(\.\.\.questFlatTargets\(dungeonQuestFlats\)\);/, 'and the dungeon ray');
  assert.ok(interior.length > 0);
});

test('DQ1: BOTH clicks route through the one body, with the buildingKey each host has', () => {
  const s = wm();
  assert.match(s, /clickQuestFlat\(questFlats\[Number\(key\.split\(':'\)\[1\]\)\], interiorBuilding\?\.buildingKey \?\? 0\);/,
    'the interior passes its building');
  assert.match(s, /clickQuestFlat\(dungeonQuestFlats\[Number\(key\.split\(':'\)\[1\]\)\], 0\);/,
    'the dungeon has none, so 0 - StaticNPC reads it from the runtime data');
});

test('DQ1: a PERSON keeps the static-NPC reach; anything else takes half of it', () => {
  // PlayerActivate.cs:326-332 gates the quest-resource arm on
  // `!(TargetResource is Person)` and then measures against
  // DefaultActivationDistance (128), half a static NPC's 256 - so a
  // quest ITEM on the floor must not have twice DFU's reach. A
  // behaviour with NO target resource takes the 128 arm too
  // (`!(null is Person)` is true).
  const body = wm();
  const walk = body.slice(body.indexOf('const questFlatTargets = (list) => {'), body.indexOf('const clickQuestFlat ='));
  assert.match(walk, /const isPerson = s\.behaviour\?\.targetResource\?\.isPerson === true;/);
  assert.match(walk, /distance: isPerson \? STATIC_NPC_ACTIVATION_DISTANCE : DEFAULT_ACTIVATION_DISTANCE,/);
  // an unfilled, inactive or destroyed stand is not a target
  assert.match(walk, /if \(!s\.width \|\| !s\.active \|\| s\.dead\) return;/);
});

test('DQ1: the click stamps LastNPCClicked BEFORE DoClick, and only for a Person', () => {
  const body = wm();
  const click = body.slice(body.indexOf('const clickQuestFlat = (s, buildingKey) => {'), body.indexOf('const questAdapter = {'));
  const stamp = click.indexOf('setLastNPCClicked');
  const doClick = click.indexOf('s.behaviour?.doClick()');
  assert.ok(stamp > 0 && doClick > stamp, 'StaticNPCClick:1521 stamps first');
  assert.match(click, /if \(questBridge && person\?\.isPerson\) \{/, 'an ITEM stamps nothing');
  // the hash is the TRUNCATED marker ints, not the stood position
  assert.match(click, /positionHash\(Math\.trunc\(s\.marker\.x\), Math\.trunc\(s\.marker\.y\), Math\.trunc\(s\.marker\.z\)\)/);
  assert.match(click, /nameSeed: person\.nameSeed \?\? -1,/, '-1 falls back to the hash');
  assert.match(click, /mapID: 0,/, 'never written by SetLayoutData');
  // DoClick's bool is kept, not dropped
  assert.match(click, /const foundInActiveQuest = s\.behaviour\?\.doClick\(\) \?\? false;/);
});

test('DQ1: the dungeon note is retired, not annotated', () => {
  const s = wm();
  assert.doesNotMatch(s, /clicks on dungeon quest NPC\/item flats pend the dungeon/);
  assert.doesNotMatch(s, /"clicked npc\/item" at a dungeon site does not fire yet/);
  assert.match(s, /DQ1 closed the note that stood here/);
});

test('DQ1: the quest FOE pass is untouched - it was never the gap', () => {
  // Quest foes have always been clickable underground through their own
  // pass; DQ1 adds the flats beside it and must not disturb it.
  const s = wm();
  assert.match(s, /const qf = pickQuestFoe\(eye, dir, dungeonCtx\.foes, dungeonCtx\.collider\);/);
  assert.match(s, /if \(qf\) qf\.questBehaviour\.doClick\(\);/);
});
