// ═══════════════════════════════════════════════════════════════════
// ROAD-G G5 - THE INVENTORY'S DROP ICONS.
//
// AUDIT 58's windows lane drew the two 55x34 target-icon panels and
// RECORDED the two arms of UpdateRemoteTargetIcon it could not reach
// (:875-884) plus the three cycling handlers behind them (:2104-2146),
// because the port's loot hook was `{ items() }` and carried no flat
// identity at all. This file is that record closed: the pile hands
// DaggerfallLoot's own fields now, so the archive/record the panel
// draws, the three clicks that change them, and the icon's survival on
// the pile through the save envelope are all law and all pinned.
//
// Every test below was run RED under a named mutant before it was
// kept; the mutant is written beside the assertion it kills.
// ═══════════════════════════════════════════════════════════════════
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DROP_ICON_IDXS, DROP_ICON_ARCHIVES, RANDOM_TREASURE_ARCHIVE, RANDOM_TREASURE_ICONS,
} from '../src/systems/lootDataTables.js';
import {
  openDropIcon, canChangeDropIcon, cycleDropIcon, dropIconRecord, nextDropArchive,
  remoteTargetType, REMOTE_TARGET_TYPES, closeSession,
} from '../src/systems/inventorySession.js';
import { NativeInventoryWindow, INV_RECTS } from '../src/ui/nativeInventory.js';
import { createDroppedLoot, droppedLootHooks, containerDropPos } from '../src/scenes/droppedLoot.js';
import { createSceneCache, cacheScene, restoreCachedScene, snapshotSceneCache, restoreSceneCache } from '../src/systems/sceneCache.js';
import { audio } from '../src/systems/audio.js';
import { SOUND } from '../src/systems/soundClips.js';
import {
  dropIconImage, drawTargetIconPanel, preloadContainerIconArt,
  _resetDropIconsForTests, _setDropIconForTests, _setContainerIconsForTests,
  CONTAINER_IMAGES, REMOTE_TARGET_ICON_RECT,
} from '../src/ui/targetIconPanel.js';
import { nativeMetrics } from '../src/ui/nativePanel.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel) => readFileSync(join(root, 'src', rel), 'utf8');
const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };

/** Every audio id the body played, with the module put back. */
function withAudio(fn) {
  const played = [];
  const orig = audio.playOneShot;
  audio.playOneShot = (i) => { played.push(i); return 0.1; };
  try { fn(); } finally { audio.playOneShot = orig; }
  return played;
}

// ── the table ────────────────────────────────────────────────────
test('G5: dropIconIdxs is DaggerfallLootDataTables.cs:37-45, verbatim and IN ORDER', () => {
  // MUTANT: drop `19` from the boxesNbottles row (:39). RED here.
  assert.deepEqual([...DROP_ICON_IDXS.keys()], [204, 205, 207, 209, 211, 216],
    'the KEY ORDER is load-bearing - GetNextArchive walks it');
  assert.deepEqual([...DROP_ICON_IDXS.get(204)], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual([...DROP_ICON_IDXS.get(205)],
    [1, 11, 12, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23, 24, 25, 26, 31, 32, 33, 34, 35, 36, 42, 43, 44]);
  assert.deepEqual([...DROP_ICON_IDXS.get(207)], [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16]);
  assert.deepEqual([...DROP_ICON_IDXS.get(209)], [0, 1, 2, 3, 5, 6, 7, 8, 10]);
  assert.deepEqual([...DROP_ICON_IDXS.get(211)], [2, 49, 51, 57]);
  assert.deepEqual([...DROP_ICON_IDXS.get(216)],
    [0, 1, 3, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 36, 37, 38, 39, 40, 43, 44, 45, 46, 47],
    'the RANDOM TREASURE list here is NOT randomTreasureIconIndices - 30 entries against 20');
  assert.notDeepEqual([...DROP_ICON_IDXS.get(216)], [...RANDOM_TREASURE_ICONS]);
  // the five named archives (:21-25) and the sixth that is the default
  assert.deepEqual({ ...DROP_ICON_ARCHIVES },
    { clothing: 204, boxesNbottles: 205, combat: 207, academic: 209, misc: 211, randomTreasure: 216 });
  assert.equal(RANDOM_TREASURE_ARCHIVE, 216);
  // ...and the tables are their own module, importing nothing - the
  // cycle that broke module init when they were read off loot.js.
  assert.equal(/^import /m.test(src('systems/lootDataTables.js')), false,
    'lootDataTables.js must stay a leaf');
});

test('G5: GetNextArchive (:2148-2157) steps the keys and WRAPS to the first', () => {
  // MUTANT: `return DROP_ICON_IDXS.keys().next().value` -> `return archive`.
  // RED on the 216 and the unknown-archive cases below.
  assert.equal(nextDropArchive(204), 205);
  assert.equal(nextDropArchive(211), 216);
  assert.equal(nextDropArchive(216), 204, 'the LAST key falls out of the loop to .Keys.First()');
  assert.equal(nextDropArchive(999), 204, 'and so does an archive that is not a key at all');
});

test('G5: dropIconIdxs[archive][texture] - the record a cycling index names', () => {
  // MUTANT: drop the `texture < 0` guard. RED on the -1 case, and the
  // OnPop comparison below stops being able to say "icon changed".
  assert.equal(dropIconRecord(205, 0), 1);
  assert.equal(dropIconRecord(205, 8), 19);
  assert.equal(dropIconRecord(211, 3), 57);
  assert.equal(dropIconRecord(216, -1), null, 'OnPush\'s "nothing picked" index has no record');
  assert.equal(dropIconRecord(216, 30), null, 'and neither does one past the end');
  assert.equal(dropIconRecord(999, 0), null);
});

// ── OnPush's seed ────────────────────────────────────────────────
test('G5: OnPush seeds the drop icon (:593-631) - the three arms, in order', () => {
  // MUTANT: swap the chooseOne arm's 11 for 0. RED on the first pair.
  assert.deepEqual(openDropIcon({}, { items: [] }), { archive: 207, texture: 11 },
    'a choose-one reward list opens on combatArchive icon 11 (:595-599)');
  assert.deepEqual(openDropIcon({}), { archive: 216, texture: -1 },
    'everything else opens on randomTreasureArchive with NO icon picked (:601-606)');
  // MUTANT: drop `loot.playerOwned` from the guard. RED on the shelf case.
  const owned = { playerOwned: true, textureArchive: 205, textureRecord: 22 };
  assert.deepEqual(openDropIcon({ loot: owned }), { archive: 205, texture: 11 },
    'a pile you own recovers the INDEX of its record (dropIconIdxs[205][11] === 22)');
  assert.equal(dropIconRecord(205, 11), 22);
  assert.deepEqual(openDropIcon({ loot: { playerOwned: true, textureArchive: 205, textureRecord: 99 } }),
    { archive: 205, texture: -1 },
    'a record the list does not carry leaves the index where the arm above put it');
  assert.deepEqual(openDropIcon({ loot: { playerOwned: false, textureArchive: 205, textureRecord: 22 } }),
    { archive: 216, texture: -1 }, 'a SHELF is not player-owned and claims nothing');
  assert.deepEqual(openDropIcon({ loot: { playerOwned: true, textureArchive: 0 } }),
    { archive: 216, texture: -1 }, 'TextureArchive > 0 is the gate DFU writes');
});

// ── CanChangeDropIcon ────────────────────────────────────────────
test('G5: remoteTargetType and CanChangeDropIcon (:2140-2144) - who may cycle', () => {
  // MUTANT: `t === Loot && !!deps.loot?.playerOwned` -> `t === Loot`.
  // RED on the shelf row.
  const T = REMOTE_TARGET_TYPES;
  assert.deepEqual({ ...T }, { Dropped: 0, Wagon: 1, Loot: 2, Merchant: 3 });
  assert.equal(remoteTargetType({}, {}), T.Dropped);
  assert.equal(remoteTargetType({}, { usingWagon: true }), T.Wagon);
  assert.equal(remoteTargetType({}, { chooseOne: { items: [] } }), T.Merchant);
  assert.equal(remoteTargetType({ loot: { items: () => [] } }, {}), T.Loot);
  // the wagon outranks a loot target, exactly as remoteTarget's list does
  assert.equal(remoteTargetType({ loot: { items: () => [] } }, { usingWagon: true }), T.Wagon);

  assert.equal(canChangeDropIcon({}, {}), true, 'the session\'s own dropped pile');
  assert.equal(canChangeDropIcon({ loot: { items: () => [], playerOwned: true } }, {}), true);
  assert.equal(canChangeDropIcon({ loot: { items: () => [] } }, {}), false, 'a shop shelf refuses');
  assert.equal(canChangeDropIcon({}, { usingWagon: true }), false, 'the wagon refuses');
  assert.equal(canChangeDropIcon({}, { chooseOne: { items: [] } }), false, 'a reward list refuses');
});

// ── the cycling arithmetic ───────────────────────────────────────
test('G5: the three handlers\' arithmetic (:2104-2138) - up wraps, down wraps, middle steps the archive', () => {
  // MUTANT: `if (by > 0 && t >= len) t = 0` -> `t = len - 1`. RED below.
  assert.deepEqual(cycleDropIcon({ archive: 211, texture: 0 }, 1), { archive: 211, texture: 1 });
  assert.deepEqual(cycleDropIcon({ archive: 211, texture: 3 }, 1), { archive: 211, texture: 0 },
    'past the end is 0, not a clamp (:2122-2123)');
  // MUTANT: `t = len - 1` -> `t = 0` on the down arm. RED here.
  assert.deepEqual(cycleDropIcon({ archive: 211, texture: 0 }, -1), { archive: 211, texture: 3 },
    'below 0 is the LAST icon (:2135-2136)');
  // the -1 seed steps to 0 going up and to len-1 going down, with no
  // special case: `-1 + 1 = 0`, `-1 - 1 = -2 < 0`
  assert.deepEqual(cycleDropIcon({ archive: 211, texture: -1 }, 1), { archive: 211, texture: 0 });
  assert.deepEqual(cycleDropIcon({ archive: 211, texture: -1 }, -1), { archive: 211, texture: 3 });
  // MUTANT: drop `texture: 0` from the middle arm (keep the archive).
  // RED here - DFU resets the icon with the archive (:2109-2110).
  assert.deepEqual(cycleDropIcon({ archive: 211, texture: 3 }, 0), { archive: 216, texture: 0 });
  assert.deepEqual(cycleDropIcon({ archive: 216, texture: 7 }, 0), { archive: 204, texture: 0 });
});

// ── the window ───────────────────────────────────────────────────
const win = (hooks = {}) => new NativeInventoryWindow({ items: () => [], icons: ICONS, ...hooks });
const PANEL = INV_RECTS.remoteTargetIcon;   // [263, 12, 55, 34]
const AT = [PANEL[0] + 2, PANEL[1] + 2];

test('G5: the WINDOW seeds through openDropIcon (:593-631), not a constant of its own', () => {
  // MUTANT: `this.dropIcon = openDropIcon(hooks, this.chooseOne);` ->
  // `this.dropIcon = { archive: 216, texture: -1 };` in
  // src/ui/nativeInventory.js. RED on both rows below - and ONLY on
  // them: every other window fixture in this file opens on a target
  // whose correct seed IS that constant, which is exactly why the
  // window could be cut loose from the seed with the suite green.
  assert.deepEqual(win({ chooseOne: { items: [] } }).dropIcon, { archive: 207, texture: 11 },
    'a reward list reaches the WINDOW on combatArchive icon 11 (:595-599)');
  assert.deepEqual(
    win({ loot: { items: () => [], playerOwned: true, textureArchive: 205, textureRecord: 22 } }).dropIcon,
    { archive: 205, texture: 11 },
    'and a pile you own recovers its INDEX through the window (:616-631)');
  // ...and the seed the window recovered is the one the cycling moves
  const owned = win({ loot: { items: () => [], playerOwned: true, textureArchive: 205, textureRecord: 22 } });
  withAudio(() => owned.click(AT[0], AT[1]));
  assert.deepEqual(owned.dropIcon, { archive: 205, texture: 12 }, 'one step up from the recovered index');
});

test('G5: the remote panel takes all three buttons, and only the two that DFU sounds', () => {
  assert.deepEqual([...PANEL], [263, 12, 55, 34], 'remoteTargetIconRect (:50) stands');
  const w = win();
  assert.deepEqual(w.dropIcon, { archive: 216, texture: -1 });
  // MUTANT: `this._cycleDropIcon(middle ? 0 : (right ? -1 : 1))` ->
  // `... (right ? 1 : 1)`. RED on the right-click row.
  const a = withAudio(() => { assert.equal(w.click(AT[0], AT[1]), true); });
  assert.deepEqual(w.dropIcon, { archive: 216, texture: 0 }, 'left cycles UP');
  assert.deepEqual(a, [SOUND.ButtonClick], 'OnMouseClick plays one click (:2117)');
  withAudio(() => w.click(AT[0], AT[1], true));
  assert.deepEqual(w.dropIcon, { archive: 216, texture: 29 }, 'right cycles DOWN, wrapping to the last');
  // MUTANT: play the click on the middle arm too. RED here - the
  // middle handler (:2104-2113) plays NOTHING.
  const c = withAudio(() => w.click(AT[0], AT[1], false, true));
  assert.deepEqual(w.dropIcon, { archive: 204, texture: 0 }, 'middle steps the archive and resets the icon');
  assert.deepEqual(c, [], 'OnMiddleMouseClick is silent');
  // ...and a click on the panel is CONSUMED whatever it does
  assert.equal(win().click(PANEL[0] + PANEL[2] - 1, PANEL[1] + PANEL[3] - 1), true);
  assert.equal(win().click(PANEL[0] - 1, PANEL[1] - 1), false, 'one pixel off it is not the panel\'s');
});

test('G5: the click SOUNDS before CanChangeDropIcon is asked, and a shelf changes nothing', () => {
  // MUTANT: move `audio.playOneShot` below the CanChangeDropIcon guard.
  // RED here - DFU sounds first (:2117-2118, :2130-2131).
  const shelf = win({ loot: { items: () => [] } });
  const before = { ...shelf.dropIcon };
  const played = withAudio(() => shelf.click(AT[0], AT[1]));
  assert.deepEqual(played, [SOUND.ButtonClick], 'the panel still clicks over a shop shelf');
  assert.deepEqual(shelf.dropIcon, before, 'and the icon does not move');
  const silent = withAudio(() => shelf.click(AT[0], AT[1], false, true));
  assert.deepEqual(silent, [], 'the middle button stays silent even when refused');
});

test('G5: UpdateRemoteTargetIcon\'s ladder (:865-890) - chosen flat, then the target\'s flat, then the container', () => {
  // The two flat arms differ ONLY in which (archive, record) they hand
  // dropIconImage, so the pictures have to be registered or the pair is
  // interchangeable: `'image' in x` is true for `{ image: null }`, which
  // is what an unregistered reader answers.
  _resetDropIconsForTests();
  const CHOSEN_IMG = { tex: 'chosen', w: 8, h: 8 };
  const PILE_IMG = { tex: 'pile', w: 8, h: 8 };
  _setDropIconForTests(211, 57, CHOSEN_IMG);   // dropIconIdxs[211][3] === 57
  _setDropIconForTests(216, 22, PILE_IMG);
  try {
    // MUTANT: put the container arm ahead of the chosen-flat arm. RED on
    // the first case: a picked icon must beat the Ground picture.
    const plain = win();
    assert.equal(plain._remoteTargetIcon().container, 2, 'Ground with nothing picked (InventoryContainerImages.Ground)');
    assert.equal(plain._remoteTargetIcon().image, undefined);
    plain.dropIcon = { archive: 211, texture: 3 };
    const chosen = plain._remoteTargetIcon();
    assert.equal(chosen.container, undefined, 'the chosen flat replaces the container picture entirely');
    // MUTANT: `return null;` as dropIconImage's first statement
    // (src/ui/targetIconPanel.js). RED here - the key-presence check
    // this replaces was satisfied by `{ image: null }`.
    assert.equal(chosen.image, CHOSEN_IMG, 'the CHOSEN flat is dropIconIdxs[211][3] = record 57 (:875-879)');
    assert.equal(chosen.label, '', 'the remote label is empty outside wagon mode');
    // the SECOND arm: a loot target with a flat of its own and no pick
    const pile = win({ loot: { items: () => [], textureArchive: 216, textureRecord: 22 } });
    assert.equal(pile._remoteTargetIcon().image, PILE_IMG, 'the container\'s own world flat (:880-884)');
    // MUTANT: swap the two flat arms - run the loot-flat arm before the
    // chosen-flat one. RED only here: this is the ONE state that
    // separates them, and DFU asks `dropIconTexture > -1` FIRST (:875).
    const both = win({ loot: { items: () => [], textureArchive: 216, textureRecord: 22 } });
    both.dropIcon = { archive: 211, texture: 3 };
    assert.equal(both._remoteTargetIcon().image, CHOSEN_IMG,
      'the icon you just picked outranks the pile\'s own flat (:875-879 before :880-884)');
    // ...and a loot target with NO flat still falls to the container image
    const shelf = win({ loot: { items: () => [] } });
    assert.equal(shelf._remoteTargetIcon().container, 2);
    // A CORPSE is the loot kind that reaches arm 2 most often:
    // CreateLootableCorpseMarker hands ReverseCorpseTexture's
    // archive/record to CreateLootContainer (GameObjectHelper.cs:812-828,
    // written on at :697-698), so TextureArchive is never 0 and the body
    // draws its own flat. MUTANT: the dungeon's corpse arm without its
    // `lootHooks` (the shipped code before this fix) - `{ items() }`
    // alone falls to the Ground picture, which is what this row was.
    const ct = ENEMY_BASICS[0].corpseTexture;
    assert.deepEqual(ct, { archive: 401, record: 1 }, 'ReverseCorpseTexture (EnemyBasics.cs:2227-2231) is never 0');
    _setDropIconForTests(ct.archive, ct.record, { tex: 'corpse', w: 8, h: 8 });
    const body = win({ loot: { items: () => [], textureArchive: ct.archive, textureRecord: ct.record } });
    assert.deepEqual(body._remoteTargetIcon().image, { tex: 'corpse', w: 8, h: 8 },
      'a corpse marker draws its OWN world flat, not InventoryContainerImages.Ground');
    assert.equal(canChangeDropIcon({ loot: { items: () => [], textureArchive: ct.archive } }, {}), false,
      'and it is not playerOwned (GameObjectHelper.cs:833), so nothing cycles it');
    // the seam that feeds it: the dungeon's corpse arm derives the pair
    // from the SAME corpseTexture read spawnCorpse takes
    const arm = src('scenes/dungeonContext.js');
    const corpseArm = arm.slice(arm.indexOf("} else if (kind === 'corpse') {"),
      arm.indexOf("} else if (kind.startsWith('droppedLoot')) {"));
    assert.match(corpseArm, /const ct = f\.mobile\?\.basics\?\.corpseTexture \?\? ENEMY_BASICS\[f\.mobileType\]\?\.corpseTexture;/,
      'the corpse arm reads the STRUCT COPY first, as EnemyDeath.cs:86-92 does');
    assert.match(corpseArm, /if \(ct\) lootHooks = \{ textureArchive: ct\.archive, textureRecord: ct\.record \};/,
      'and hands the window DaggerfallLoot\'s flat identity');
    assert.equal(/playerOwned:/.test(corpseArm), false, 'and never sets playerOwned - a corpse is not the player\'s');
    // MUTANT: drop the `rti.image` argument from the draw call. The pin
    // is the SOURCE, because the window's panel is a GL draw; what the
    // panel then DOES with the flat is pinned behaviourally below.
    assert.match(src('ui/nativeInventory.js'),
      /drawTargetIconPanel\(renderer, m, font, INV_RECTS\.remoteTargetIcon, rti\.container, rti\.label, rti\.image\);/,
      'the flat reaches the panel');
    assert.match(src('ui/targetIconPanel.js'), /const icon = image \?\? _icons\?\.get\(containerType\) \?\? null;/,
      'and lays out through the SAME ScaleToFit path the container picture takes');
  } finally { _resetDropIconsForTests(); }
});

test('G5: dropIconImage IS the picture (:875-884) - guarded, asked once, and it reaches the panel', async () => {
  _resetDropIconsForTests();
  let fetches = 0;
  const deps = {
    renderer: { uploadTexture: (kind, name) => `tex:${name}` },
    palette: {},
    fetchBytes: async (name) => { fetches++; throw new Error(`no ${name}`); },
  };
  // preloadContainerIconArt registers the reader's deps before its own
  // early return; the CIF miss here is the not-fatal arm.
  await preloadContainerIconArt(deps);
  fetches = 0;
  try {
    // MUTANT: `if (!(archive > 0) || !(record >= 0)) return null;` ->
    // `if (!(record >= 0)) return null;`. RED here.
    assert.equal(dropIconImage(0, 5), null, 'archive 0 is no archive');
    assert.equal(dropIconImage(216, -1), null, 'and -1 is OnPush\'s "nothing picked"');
    assert.equal(fetches, 0, 'a guarded ask never touches ARENA2');
    // SYNCHRONOUS by design: the first ask starts the load and answers
    // null, exactly as paintingImage's cache-in-front does.
    assert.equal(dropIconImage(216, 22), null);
    assert.equal(fetches, 1, 'one ask, one read');
    for (let i = 0; i < 8; i++) await Promise.resolve();
    // MUTANT: drop `_flats.set(key, null)` from the catch. RED here -
    // a missing archive would be re-read on every draw pass.
    assert.equal(dropIconImage(216, 22), null);
    assert.equal(fetches, 1, 'the MISS is asked and answered - never retried');
    // MUTANT: `return null;` as dropIconImage's first statement. RED here.
    const IMG = { tex: 'T', w: 40, h: 20 };
    _setDropIconForTests(205, 19, IMG);
    assert.equal(dropIconImage(205, 19), IMG, 'a warm record answers its picture');
    assert.equal(fetches, 1, 'and a HIT never reads again');
  } finally { _resetDropIconsForTests(); }
});

test('G5: the flat the window chose is what the 55x34 panel DRAWS, ScaleToFit', () => {
  // MUTANT: `const icon = image ?? _icons?.get(containerType) ?? null;`
  // -> `const icon = _icons?.get(containerType) ?? null;`. RED here:
  // the container picture would be drawn over the chosen flat.
  _setContainerIconsForTests(new Map([[CONTAINER_IMAGES.Ground, { tex: 'C', w: 11, h: 11 }]]));
  try {
    const quads = [];
    const renderer = { drawScreenQuad: (tex, rect) => quads.push({ tex, ...rect }) };
    const m = nativeMetrics({ width: 320, height: 200 });
    const FONT = { fnt: { fixedHeight: 7, fixedWidth: 5, glyphWidth: () => 4 }, tex: 'font' };
    assert.equal(drawTargetIconPanel(renderer, m, FONT, REMOTE_TARGET_ICON_RECT,
      CONTAINER_IMAGES.Ground, '', { tex: 'F', w: 40, h: 20 }), true);
    assert.deepEqual(quads.map((q) => q.tex), ['F'], 'the FLAT is drawn, and the container picture is not');
    // ScaleToFit: min(55/40, 34/20) = 1.375 -> 55x27.5, centred in the rect
    const [rx, ry, rw, rh] = REMOTE_TARGET_ICON_RECT;
    assert.equal(quads[0].w, 55 * m.s);
    assert.equal(quads[0].h, 27.5 * m.s);
    assert.equal(quads[0].x, m.ox + rx * m.s);
    assert.equal(quads[0].y, m.oy + (ry + (rh - 27.5) / 2) * m.s);
    assert.equal(rw, 55); assert.equal(rh, 34);
  } finally { _setContainerIconsForTests(null); }
});

// ── OnPop ────────────────────────────────────────────────────────
test('G5: OnPop (:689-712) - a changed icon re-mints the pile, an unchanged one does not', () => {
  const mint = [];
  const loot = { items: () => items, playerOwned: true, textureArchive: 216, textureRecord: 22, pos: [7, 1, 9] };
  let items = [{ n: 'sword' }, { n: 'shield' }];
  const deps = { loot, onDrop: (d, icon, at) => mint.push({ n: d.length, icon, at }), onClose: () => {} };
  // dropIconIdxs[216][7] === 22 - the icon the pile already wears
  assert.equal(dropIconRecord(216, 7), 22);
  // MUTANT: drop the `loot.textureRecord !== dropIconRecord(...)` half
  // of the condition. RED here - an unchanged icon must transfer nothing.
  closeSession(deps, { dropped: [], dropIcon: { archive: 216, texture: 7 } });
  assert.deepEqual(mint, [], 'the icon did not change, so nothing moves and nothing mints');
  assert.equal(items.length, 2, 'the pile keeps its items');

  // now cycle it one step - dropIconIdxs[216][8] === 23
  const dropped = [];
  closeSession(deps, { dropped, dropIcon: { archive: 216, texture: 8 } });
  assert.equal(items.length, 0, 'TransferAll EMPTIES the old container (:693)');
  assert.equal(mint.length, 1);
  assert.equal(mint[0].n, 2, 'both items ride into the new pile');
  assert.deepEqual(mint[0].icon, { archive: 216, record: 23 }, 'minted with the CHOSEN archive/record (:701-705)');
  assert.deepEqual(mint[0].at, [7, 1, 9], 'and at the old container\'s position (:710-714)');

  // MUTANT: drop the `loot.playerOwned` half of the guard in
  // closeSession. RED here. DaggerfallInventoryWindow.cs:690 asks
  // playerOwned FIRST, and the dungeon's RDB treasure pile is
  // deliberately not the player's (dungeonContext's takeLoot) while the
  // session's default seed is {216,-1}, whose record is null - so
  // without the term the comparison is ALWAYS true and every close of a
  // treasure pile would TransferAll it onto the floor.
  const rdbItems = [{ n: 'gem' }, { n: 'gold' }];
  const rdb = { items: () => rdbItems, textureArchive: 216, textureRecord: 34, pos: [10, 2, 20] };
  const rdbMint = [];
  assert.equal(dropIconRecord(216, -1), null, 'no pick means no record to compare against');
  closeSession({ loot: rdb, onDrop: (d, ic, at) => rdbMint.push({ d, ic, at }), onClose: () => {} },
    { dropped: [], dropIcon: openDropIcon({ loot: rdb }) });
  assert.equal(rdbItems.length, 2, 'a pile the player does not own is never re-minted (:690, playerOwned)');
  assert.deepEqual(rdbMint, [], 'and nothing drops on the floor');

  // MUTANT: `record == null ? null : {...}` -> always the object. RED
  // here: with nothing picked DFU takes the BARE CreateDroppedLootContainer
  // call, which ROLLS a randomTreasureIconIndices record.
  const bare = [];
  closeSession({ onDrop: (d, icon) => bare.push(icon) }, { dropped: [{ n: 'coin' }], dropIcon: { archive: 216, texture: -1 } });
  assert.deepEqual(bare, [null], 'no pick, no icon - the mint rolls its own');
  // an ordinary drop with no loot target moves at all
  const at = [];
  closeSession({ onDrop: (d, icon, a) => at.push(a) }, { dropped: [{ n: 'coin' }], dropIcon: { archive: 216, texture: 0 } });
  assert.deepEqual(at, [null], 'no loot target, no re-position');
});

test('G5: containerDropPos (:710-714) keeps the old container\'s X and Z and takes the new Y', () => {
  // MUTANT: `[at[0], at[1], at[2]]`. RED here.
  assert.deepEqual(containerDropPos([7, 90, 9], [1, 2, 3]), [7, 2, 9]);
  assert.deepEqual(containerDropPos(null, [1, 2, 3]), [1, 2, 3]);
});

// ── the pile carries it ──────────────────────────────────────────
/** The pool RECORDS what the renderer and the uploader are handed -
 *  five sites read the pile's archive and a fixture that throws the
 *  arguments away can only pin two of them by source text. The flat is
 *  ANIMATED (four frames) because armFlatAnim returns before it ever
 *  looks at the archive when the count is 1. */
const pool = () => {
  const made = [], built = [], uploads = [];
  return {
    made, built, uploads,
    p: createDroppedLoot({
      renderer: {
        createBillboardBatch: (archive, record, size, centers) => {
          const b = { archive, record, size, centers };
          built.push(b);
          return b;
        },
        destroyBillboardBatch: () => {},
      },
      getTexture: async (a) => { made.push(a); return { getSize: () => ({ width: 1, height: 1 }), getScale: () => ({ x: 0, y: 0 }), getFrameCount: () => 4 }; },
      uploadRecordFrame: (a, r, f) => uploads.push([a, r, f]),
      pick: () => 0,
    }),
  };
};

test('G5: a pile carries its ARCHIVE beside its record, from the drop to the flat', async () => {
  const { p } = pool();
  // MUTANT: `const archive = RANDOM_TREASURE_ARCHIVE;` in dropPile. RED here.
  const rolled = p.dropPile([{ n: 1 }], [0, 0, 0]);
  assert.equal(rolled.archive, 216, 'the default is randomTreasureArchive');
  assert.equal(rolled.record, RANDOM_TREASURE_ICONS[0], 'and the record is still rolled off the 20-entry list');
  const picked = p.dropPile([{ n: 2 }], [1, 2, 3], null, { archive: 205, record: 19 });
  assert.equal(picked.archive, 205);
  assert.equal(picked.record, 19, 'a chosen icon skips the roll (GameObjectHelper.cs:743-748)');
  // the two SHAPE pins - what the call sites read
  assert.match(src('scenes/droppedLoot.js'), /getTexture\(pile\.archive\)\.then/,
    'the flat warms the PILE\'s archive, not the constant');
  assert.match(src('scenes/droppedLoot.js'), /renderer\.createBillboardBatch\(pile\.archive, pile\.record,/);
  // ...and the five reads BEHAVIOURALLY, because a regex naming two of
  // them leaves the other three free to revert to the 216 constant. A
  // pool of its own, so the only flat in it is the one the player chose.
  const { p: q, made, built, uploads } = pool();
  q.dropPile([{ n: 3 }], [1, 2, 3], null, { archive: 205, record: 19 });
  for (let i = 0; i < 8; i++) await Promise.resolve();   // the warm settles
  // MUTANT: `getTexture(RANDOM_TREASURE_ARCHIVE)` in mount(). RED here.
  assert.equal(made.at(-1), 205, 'mount warms the PILE\'s archive');
  // MUTANT: `uploadRecordFrame(216, pile.record, 0)` in mount(). RED here.
  assert.deepEqual(uploads[0], [205, 19, 0], 'and the frame it warms is the pile\'s own record');
  // MUTANT: `renderer.createBillboardBatch(216, ...)` in mount(). RED here.
  assert.equal(built.at(-1).archive, 205);
  // MUTANT: `armFlatAnim(pile.batch, t, 216, pile.record, ...)`. RED
  // here - armFlatAnim uploads EVERY frame under the archive it is
  // handed (flatAnimation.js) and registers the animator under it.
  assert.deepEqual(uploads.map(([a]) => a), [205, 205, 205, 205, 205],
    'the animation frames ride the pile\'s archive too');
  // MUTANT: `createBillboardBatch(216, p.record, p.size, ...)` in
  // offsetAll. RED here - a floating-origin recenter must not re-icon a
  // pile the player chose the flat for.
  q.offsetAll([-819.2, 0, 0]);
  assert.equal(built.at(-1).archive, 205, 'the recenter rebuild keeps the pile\'s archive');
  assert.deepEqual(built.at(-1).centers[0], [1 - 819.2, 2, 3], 'at the shifted centre');
});

test('G5: the archive survives every envelope a pile rides', () => {
  const { p } = pool();
  p.dropPile([{ n: 1 }], [1, 2, 3], '5,6', { archive: 207, record: 16 });
  // the WORLD envelope (world.js)
  const w = p.snapshotWorld((pos) => ({ x: pos[0], z: pos[2] }));
  // MUTANT: drop `archive: p.archive` from snapshotWorld. RED here.
  assert.equal(w[0].archive, 207);
  p.restoreWorld(w, (nx, nz) => [nx, nz]);
  assert.equal(p._piles[0].archive, 207, 'and comes back on the restore');
  assert.equal(p._piles[0].record, 16);
  // a save written before G5 has no archive at all and must still load
  p.restoreWorld([{ nativeX: 0, nativeZ: 0, y: 0, record: 22, items: [{ n: 1 }] }], (nx, nz) => [nx, nz]);
  assert.equal(p._piles[0].archive, 216, 'a legacy pile was always 216');

  // the DUNGEON/INTERIOR envelope (restorePiles)
  p.restorePiles([{ pos: [0, 0, 0], archive: 211, record: 57, items: [{ n: 1 }] }]);
  assert.equal(p._piles[0].archive, 211);
  assert.equal(p._piles[0].record, 57, 'a restore must not reroll the icon');
});

test('G5: the interior scene cache and the save envelope carry the archive', () => {
  const c = createSceneCache();
  const scene = 'DaggerfallInterior [MapID=1, BuildingKey=2]';
  const pile = { pos: [1, 2, 3], archive: 204, record: 9, items: [{ n: 1 }] };
  cacheScene(c, scene, { droppedPiles: [pile] });
  // MUTANT: `copyPiles` -> `piles.map((p) => ({ pos: [...p.pos], record: p.record, items: ... }))`.
  // RED on both rows below.
  const snap = snapshotSceneCache(c);
  assert.equal(snap.scenes[0].droppedPiles[0].archive, 204, 'GetSceneCache writes it');
  const fresh = restoreSceneCache(createSceneCache(), JSON.parse(JSON.stringify(snap)));
  assert.equal(restoreCachedScene(fresh, scene).droppedPiles[0].archive, 204, 'and RestoreSceneCache reads it');
  // and the producer that fills it
  assert.match(readFileSync(join(root, 'src/scenes/worldModes.js'), 'utf8'),
    /\.map\(\(pile\) => \(\{ pos: \[\.\.\.pile\.pos\], archive: pile\.archive, record: pile\.record,/,
    'the interior host builds the pair');
  assert.match(readFileSync(join(root, 'src/scenes/dungeonContext.js'), 'utf8'),
    /pos: \[\.\.\.p\.pos\], archive: p\.archive, record: p\.record,/,
    'and so does the dungeon host');
});

// ── the four hosts ───────────────────────────────────────────────
test('G5: all FOUR hosts hand the pile\'s identity down and take the icon back', () => {
  // MUTANT: revert any ONE host's onDrop to `(items) => ...dropPile(items, feet)`.
  // RED on that host's row.
  const HOSTS = ['scenes/world.js', 'scenes/exterior.js', 'scenes/worldModes.js', 'scenes/dungeonContext.js'];
  for (const h of HOSTS) {
    const s = src(h);
    assert.match(s, /onDrop: \(items, icon = null, at = null\)/, `${h}: OnPop's icon and position reach the pool`);
    assert.match(s, /containerDropPos\(at, /, `${h}: and the re-position is the shared law`);
    assert.match(s, /droppedLootHooks/, `${h}: the pile hands DaggerfallLoot's own fields`);
  }
  // the middle button reaches the window through every overlay channel
  assert.match(src('scenes/townTalk.js'), /e\.button === 2, e\.button === 1\)/, 'world + exterior');
  const wm = src('scenes/worldModes.js');
  assert.equal([...wm.matchAll(/e\.button === 2, e\.button === 1\)/g)].length, 2,
    'worldModes routes it to BOTH its interior slot and the dungeon context');
  assert.match(src('scenes/dungeon.js'), /e\.button === 2, e\.button === 1\)/, 'the standalone dungeon page');
  assert.match(src('scenes/dungeonContext.js'), /activeOverlay\.click\(vx, vy, right, middle\);/);
  // ONE identity shape, so a fifth call site cannot ship a partial one
  assert.match(src('scenes/droppedLoot.js'),
    /export const droppedLootHooks = \(pile\) => \(\{[\s\S]*?playerOwned: true,[\s\S]*?textureArchive: pile\.archive,[\s\S]*?textureRecord: pile\.record,/);
  // ...and the dungeon's RDB treasure flat is NOT player-owned: it gets
  // UpdateRemoteTargetIcon's second arm and no cycling.
  const dc = src('scenes/dungeonContext.js');
  assert.match(dc, /lootHooks = \{ textureArchive: RANDOM_TREASURE_ARCHIVE, textureRecord: p\.record \};/);
  assert.equal(/lootHooks = \{ playerOwned: true, textureArchive: RANDOM_TREASURE_ARCHIVE/.test(dc), false,
    'a dungeon treasure pile is not the player\'s to re-icon');
});
