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
// 2. ALIGNBILLBOARDTOGROUND (GameObjectHelper.cs:335-345), which
//    AddQuestNPC calls with distance 4, was absent from BOTH arms.
//    AUDIT 26 F068 corrected this header: AddQuestItem does NOT call
//    it - it never rays at all (:1128-1141) - so the two resources
//    are stood by different laws and only the NPC aligns.
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

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');

test('questflatanchor: a DUNGEON quest flat drops half a height, a BUILDING one does not', () => {
  const s = rd('src/scenes/worldModes.js');
  // The anchor rides a parameter, so the two curried stands cannot
  // drift apart or silently share the wrong one.
  assert.match(s, /function standQuestFlatIn\(list, getCtx, toScene, inDungeon, /);
  // F068: the half-height anchor is the NPC arm's; an ITEM takes
  // AddQuestItem's flat -0.5 marker shift instead.
  assert.match(s, /by = inDungeon \? y - size\.h \/ 2 : y;/,
    'the dungeon NPC arm takes the half-height shift the building arm must not');
  assert.match(s, /by = inDungeon \? y - QUEST_ITEM_MARKER_SHIFT : y;/,
    'and an ITEM takes the constant treasure-marker shift');
  assert.match(s, /const QUEST_ITEM_MARKER_SHIFT = 0\.5;/,
    '-(randomTreasureMarkerDim / 2) * GlobalScale = -(40 / 2) * 0.025');
  assert.match(s, /standQuestFlatIn\(questFlats, \(\) => interiorCtx, \(ctx, p\) => ctx\.parentPt\(p\.x, p\.y, p\.z\), false,/,
    'the interior stand is NOT in a dungeon');
  assert.match(s, /standQuestFlatIn\(dungeonQuestFlats, \(\) => dungeonCtx, \(_ctx, p\) => \[p\.x, p\.y, p\.z\], true,/,
    'and the dungeon stand is');
  // The shift is the same one the scene's own static flats take.
  const d = rd('src/scenes/dungeonContext.js');
  assert.match(d, /const based = centers\.map\(\(\[x, y, z\]\) => \[x, y - size\.h \/ 2, z\]\);/,
    "the dungeon's RDB flats shift by the same half height - a quest flat in the same scene cannot differ");
});

test('questflatanchor: AlignBillboardToGround runs on the NPC stand, distance 4, with the 2% lift', () => {
  const s = rd('src/scenes/worldModes.js');
  // Ray from 0.2 above the billboard's CENTRE (:339), distance 4 as
  // AddQuestNPC passes it. AUDIT 26 F069: the port rayed from the
  // BASE + 0.2, half a sprite lower, so a tall dungeon NPC could
  // start below a surface DFU clears and miss the snap entirely.
  assert.match(s, /const origin = by \+ size\.h \/ 2 \+ 0\.2;/);
  assert.match(s, /collider\?\.raycast\?\.\(\[x, origin, z\], \[0, -1, 0\], 4\)/);
  // On a hit the CENTRE goes to hit.y + size.y * 0.52 (:344), so a
  // bottom-anchored base sits size.y * 0.02 above the floor.
  assert.match(s, /if \(Number\.isFinite\(drop\)\) by = \(origin - drop\) \+ size\.h \* 0\.02;/);
  // ...and the ray is the NPC arm's ALONE - an item never reaches it.
  assert.match(s, /if \(isItem\) \{/, 'the two laws are split by resource');
  assert.equal((s.match(/standQuestFlat\(t\.worldTextureArchive[^\n]*true\)/g) ?? []).length, 1);
  assert.equal((s.match(/standDungeonQuestFlat\(t\.worldTextureArchive[^\n]*true\)/g) ?? []).length, 1);
  // No floor within 4 -> C# returns without moving anything. The
  // guard, not a fallback, is what expresses that.
  assert.doesNotMatch(s, /Number\.isFinite\(drop\) \?[^\n]*:\s*0/,
    'a miss leaves the marker position standing, it does not zero the height');
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
