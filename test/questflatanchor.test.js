// TWO PARITY DETAILS B1-B7 MISSED, caught by the AUDIT 25 lane's
// reading of the same C# and folded back after the merge.
//
// 1. THE DUNGEON QUEST-FLAT ANCHOR. AddQuestNPC raises the billboard
//    by half its height `if (!inDungeon)` (GameObjectHelper.cs:
//    1032-1036). DFU's billboard is CENTRE-anchored, so that puts the
//    base ON the marker inside a building and half a height BELOW it
//    inside a dungeon. This port's shader is BOTTOM-anchored (position
//    = base - the C11 law stated at dungeonContext.js:1325, learned
//    when a centre-anchor holdover floated every corpse), so the same
//    visual result needs the shift on the DUNGEON side. It is the very
//    shift the dungeon's own RDB flats already take
//    (dungeonContext.js:1243) and that a building's flats correctly do
//    not (interiorContext.js passes its centers through).
//
//    B2 stood dungeon quest flats at the raw marker y, so every quest
//    NPC and item in a dungeon hung half a sprite too high. Nothing
//    caught it because nothing pinned the anchor - and a distant
//    screenshot passes a half-height float exactly as it passed a
//    vertically flipped billboard for six milestones.
//
// 2. ALIGNBILLBOARDTOGROUND (GameObjectHelper.cs:336-346), which
//    AddQuestNPC and AddQuestItem both call with distance 4, was
//    absent from BOTH arms.
//
// 3. THE TALK WINDOW'S CATEGORY GATE. All four category handlers open
//    with `if (selectedTalkOption == TalkOption.WhereIs)` and play the
//    click sound INSIDE that gate (:1465-1498) - so while
//    Tell-me-about is selected those buttons do nothing AND make no
//    sound. B5-6 fired them unconditionally. The sound's placement is
//    the tell that DFU treats them as genuinely disabled, not merely
//    unhelpful.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NativeTalkWindow, TALK_RECTS } from '../src/ui/nativeTalk.js';
import { questFlatStandY } from '../src/scenes/worldModes.js';
import { RANDOM_TREASURE_MARKER_DIM } from '../src/systems/loot.js';
import { GLOBAL_SCALE } from '../src/world/meshReader.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');

test('questflatanchor: a DUNGEON quest flat drops half a height, a BUILDING one does not', () => {
  // Driven, not grepped. AddQuestNPC raises the CENTRE by half a height
  // `if (!inDungeon)` (GameObjectHelper.cs:1032-1036); this port's
  // shader is BOTTOM-anchored, so the same picture is the BASE dropping
  // by half a height in a dungeon and standing on the marker in a
  // building. With no collider there is no align to confuse it - C#'s
  // "no floor within 4" leaves the anchor exactly as placed.
  const MARKER_Y = 10;
  for (const sizeH of [0.4, 1.6, 3.25]) {
    const building = questFlatStandY({ y: MARKER_Y, sizeH, inDungeon: false });
    const dungeon = questFlatStandY({ y: MARKER_Y, sizeH, inDungeon: true });
    assert.equal(building, MARKER_Y,
      'a building quest NPC stands ON the marker - interiorContext passes its centers through');
    assert.equal(dungeon, MARKER_Y - sizeH / 2,
      'the dungeon arm takes the half-height shift the building arm must not');
    assert.equal(+(building - dungeon).toFixed(10), +(sizeH / 2).toFixed(10),
      'the two arms differ by EXACTLY half a sprite, whatever the sprite is');
  }
  // The shift is the same one the scene's own static flats take - a
  // quest flat in the same dungeon block cannot differ from the RDB
  // flats standing beside it (dungeonContext.js:1243).
  const d = rd('src/scenes/dungeonContext.js');
  assert.match(d, /centers\.map\(\(\[x, y, z\]\) => \[x, y - size\.h \/ 2, z\]\)/,
    "the dungeon's RDB flats shift by the same half height");
  // And the anchor rides a PARAMETER, so the two curried stands cannot
  // silently share the wrong one. STRUCTURE, not spelling: find the
  // `inDungeon` slot in the shared body's parameter list, then read
  // what each wrapper passes into that slot.
  const s = rd('src/scenes/worldModes.js');
  const params = s.slice(s.indexOf('function standQuestFlatIn('))
    .match(/^function standQuestFlatIn\(([^)]*)\)/)[1]
    .split(',').map((t) => t.trim().split('=')[0].trim());
  const slot = params.indexOf('inDungeon');
  assert.ok(slot >= 0, `the anchor must ride a parameter; standQuestFlatIn takes ${params.join(', ')}`);
  const argsOf = (list) => {
    const m = s.match(new RegExp(`standQuestFlatIn\\(${list},([^\\n]*)\\)`));
    assert.ok(m, `no standQuestFlatIn call for ${list}`);
    // split on top-level commas only - the toScene arrows carry their own
    let depth = 0;
    const out = [list];
    let cur = '';
    for (const ch of m[1]) {
      if ('([{'.includes(ch)) depth++;
      else if (')]}'.includes(ch)) depth--;
      if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    out.push(cur.trim());
    return out;
  };
  assert.equal(argsOf('questFlats')[slot], 'false', 'the interior stand is NOT in a dungeon');
  assert.equal(argsOf('dungeonQuestFlats')[slot], 'true', 'and the dungeon stand is');
});

test('questflatanchor: AlignBillboardToGround runs on the stand, distance 4, with the 2% lift', () => {
  const sizeH = 1.6;
  const rays = [];
  const hitAt = (groundY) => (origin, dir, distance) => {
    rays.push({ origin: [...origin], dir: [...dir], distance });
    return origin[1] - groundY;          // the collider answers a DISTANCE
  };
  // A building stand: anchor 10, floor at 9.4.
  const aligned = questFlatStandY({ x: 3, y: 10, z: -7, sizeH, raycast: hitAt(9.4) });
  // The ray is AddQuestNPC's: from 0.2 above the position, straight
  // down, distance 4 (GameObjectHelper.cs:340, and :1040 passes 4).
  assert.equal(rays.length, 1, 'the NPC arm rays exactly once');
  assert.deepEqual(rays[0], { origin: [3, 10.2, -7], dir: [0, -1, 0], distance: 4 });
  // On a hit the CENTRE goes to hit.y + size.y * 0.52 (:345), so a
  // bottom-anchored base sits size.y * 0.02 above the floor.
  assert.equal(+aligned.toFixed(10), +(9.4 + sizeH * 0.02).toFixed(10),
    'the align puts the base 2% of a height clear of the floor it found');
  // The DUNGEON arm rays from its own shifted anchor, and lands on the
  // same floor - the align is what makes the two agree once there IS one.
  rays.length = 0;
  const alignedInDungeon = questFlatStandY({ x: 3, y: 10, z: -7, sizeH, inDungeon: true, raycast: hitAt(9.4) });
  assert.deepEqual(rays[0].origin, [3, 10 - sizeH / 2 + 0.2, -7]);
  assert.equal(+alignedInDungeon.toFixed(10), +aligned.toFixed(10));

  // No floor within 4 -> C# returns without moving anything. A miss is
  // the marker position standing, NOT a zeroed height.
  const miss = questFlatStandY({ y: 10, sizeH, inDungeon: true, raycast: () => Infinity });
  assert.equal(miss, 10 - sizeH / 2, 'a miss leaves the anchor exactly where it was');
  assert.equal(questFlatStandY({ y: 10, sizeH, raycast: () => null }), 10);
  // ...and a scene with no collider at all is the same "no floor".
  assert.equal(questFlatStandY({ y: 10, sizeH, inDungeon: true, raycast: null }), 10 - sizeH / 2);
});

test('questflatanchor: a quest ITEM takes AddQuestItem\'s law - the marker dim, and no align at all', () => {
  // AddQuestItem (:1116-1160) never calls AlignBillboardToGround, and
  // its dungeon shift is the CONSTANT -randomTreasureMarkerDim / 2 *
  // MeshReader.GlobalScale (:1135-1136) - not the sprite's own half
  // height. DaggerfallLoot.cs:33 dim = 40, GlobalScale 0.025.
  assert.equal(RANDOM_TREASURE_MARKER_DIM, 40);
  assert.equal(GLOBAL_SCALE, 0.025);
  const SHIFT = (RANDOM_TREASURE_MARKER_DIM / 2) * GLOBAL_SCALE;
  assert.equal(SHIFT, 0.5);
  for (const sizeH of [0.4, 1.6, 3.25]) {
    assert.equal(questFlatStandY({ y: 10, sizeH, isItem: true, inDungeon: false }), 10,
      'a building quest item stands ON its marker');
    assert.equal(questFlatStandY({ y: 10, sizeH, isItem: true, inDungeon: true }), 10 - SHIFT,
      'and a dungeon one drops by the fixed marker dim, never by its own height');
  }
  // The item arm must not ray: an item on a table, a shelf or a cage
  // marker stays where the quest put it instead of being snapped to
  // the floor beneath.
  let rayed = 0;
  const spy = () => { rayed++; return 5; };
  assert.equal(questFlatStandY({ y: 10, sizeH: 1.6, isItem: true, raycast: spy }), 10);
  assert.equal(questFlatStandY({ y: 10, sizeH: 1.6, isItem: true, inDungeon: true, raycast: spy }), 10 - SHIFT);
  assert.equal(rayed, 0, 'AddQuestItem never calls AlignBillboardToGround');
  // The NPC arm on the same inputs DOES ray - which is the whole
  // difference between the two members.
  questFlatStandY({ y: 10, sizeH: 1.6, raycast: spy });
  assert.equal(rayed, 1);
});

/** A window over recording hooks; clicks are in native 320x200 space. */
function makeWindow() {
  const sounds = [];
  const w = new NativeTalkWindow('Greetings.', {
    categories: () => [{ label: 'Taverns', buildings: [{ label: 'The Rusty Dagger', listItem: {} }] }],
    tellMeAboutTopics: () => [{ label: 'Any news?', listItem: {} }],
    peopleTopics: () => [{ label: 'Brisienna', listItem: {} }],
    thingsTopics: () => [],
    workQuestion: () => 'Any work?',
    question: (r) => `Q:${r.label ?? 'work'}`,
    answer: (r) => `A:${r.label ?? 'work'}`,
    tone: () => 1, setTone: () => {}, onClose: () => {},
  });
  w._sounds = sounds;
  return w;
}
const clickAt = (w, [x, y, cw, ch]) => w.click(x + Math.floor(cw / 2), y + Math.floor(ch / 2));

test('questflatanchor: a category click while Tell-me-about is selected changes nothing', () => {
  const w = makeWindow();
  clickAt(w, TALK_RECTS.tellMeAbout);
  const before = { mode: w.topicMode, rows: w.topics.map((t) => t.label), cat: w._lastCategory };
  for (const rect of [TALK_RECTS.categoryLocation, TALK_RECTS.categoryPeople,
    TALK_RECTS.categoryThings, TALK_RECTS.categoryWork]) {
    assert.equal(clickAt(w, rect), true, 'the window still swallows the click');
  }
  assert.equal(w.topicMode, before.mode, 'the page did not change');
  assert.deepEqual(w.topics.map((t) => t.label), before.rows, 'nor the rows');
  assert.equal(w._lastCategory, before.cat, 'nor the remembered category');
});

test('questflatanchor: the gate is SILENT - the click sound sits inside it', () => {
  // C# plays SoundClips.ButtonClick INSIDE the
  // `selectedTalkOption == TalkOption.WhereIs` branch in all four
  // handlers (:1465-1498). A gate that returns AFTER the sound would
  // still be wrong: the buttons are greyed out, and greyed-out buttons
  // in this window are silent.
  const s = rd('src/ui/nativeTalk.js');
  const gates = [...s.matchAll(/if \(this\._talkOption !== 'whereIs'\) return true;[^\n]*\n\s*audio\.playOneShot/g)];
  assert.equal(gates.length, 4, 'all four category buttons gate BEFORE the sound');
  // ...and Tell-me-about and Where-is themselves are never gated -
  // they are the two options, not categories.
  assert.match(s, /inRect\(R\.tellMeAbout, vx, vy\)\) \{ audio\.playOneShot/);
  assert.match(s, /inRect\(R\.whereIs, vx, vy\)\) \{ audio\.playOneShot/);
});

test('questflatanchor: Where-is re-enables the categories, and restores the one last used', () => {
  const w = makeWindow();
  clickAt(w, TALK_RECTS.categoryPeople);
  assert.equal(w._lastCategory, 'people');
  clickAt(w, TALK_RECTS.tellMeAbout);
  assert.equal(w._talkOption, 'tellMeAbout');
  clickAt(w, TALK_RECTS.whereIs);
  assert.equal(w._talkOption, 'whereIs', 'Where-is puts the option back');
  assert.deepEqual(w.topics.map((t) => t.label), ['Brisienna'],
    'and SetTalkCategory(selectedTalkCategory) returns to People, not Location');
  // The categories answer again.
  clickAt(w, TALK_RECTS.categoryLocation);
  assert.equal(w.topicMode, 'categories', 'the gate is open once more');
});
