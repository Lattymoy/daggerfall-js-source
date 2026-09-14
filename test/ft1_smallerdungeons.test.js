// FT1 - SMALLER DUNGEONS, THE FIRST ROW ON THE FEATURES HOME
// (2026-09-14, Mac: "smaller dungeons should be a genuine enhanced
// feature that we can build on instead of being hidden in the settings
// menu ... go one by one, ensure proper detail and development").
//
// The 1:1 port (AUDIT 28 W4, audit28_smallerdungeons.test.js) was read
// again against its consumers and two things were wrong at the seams:
// the save stamp and the load warp were two enum LITERALS in the
// dungeon host instead of the module's export, and the stamp recorded
// the raw SETTING where the port builds a different size from it -
// online (AUDIT WORLD34 B2) and under a quest's frozen state. Both are
// the module's law now; the stamp is the BUILD (a recorded departure,
// Ledger A). Then the row moved: the registry carries it, the settings
// pane points at the home, and the home's switch face toggles it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SMALLER_DUNGEONS_STATE, generateSmallerDungeon, dungeonLocationFor,
  isSmallerDungeon, smallerDungeonsStamp, needsStartWarp,
} from '../src/world/smallerDungeons.js';
import { FEATURES, checkFeature, featureForControl } from '../src/systems/features.js';
import { setValue, resetToDefaults } from '../src/systems/settings.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const PRIVATEERS_HOLD = 187853213;   // a main-story dungeon (dungeonTextures.js)
const block = (name) => ({ blockName: name, x: 9, z: 9, isStartingBlock: false });
const loc = (names, mapId = 777) => ({ name: 'T', hasDungeon: true, mapTableData: { mapId }, dungeon: { blocks: names.map(block) } });
const BIG = ['N0000000.RDB', 'N0000001.RDB', 'W0000002.RDB', 'B0000003.RDB', 'B0000004.RDB', 'b0000005.RDB', 'B0000006.RDB'];
const SMALL = ['N0000000.RDB', 'B0000003.RDB', 'B0000004.RDB'];
const { NotSet, Disabled, Enabled } = SMALLER_DUNGEONS_STATE;

test('FT1: the clone says it is small; the source, a small dungeon and anything else say no', () => {
  const big = loc(BIG);
  const plus = generateSmallerDungeon(big);
  assert.equal(isSmallerDungeon(plus), true);
  assert.equal(plus.dungeon.blocks.length, 5);
  assert.equal(isSmallerDungeon(big), false, 'the source is untouched (non-mutating)');
  assert.equal(big.dungeon.blocks.length, 7);
  assert.equal(isSmallerDungeon(generateSmallerDungeon(loc(SMALL))), false, 'at or under the threshold the location itself comes back');
  assert.equal(isSmallerDungeon(null), false);
  assert.equal(isSmallerDungeon({ dungeon: { smaller: 'yes' } }), false, 'the flag is the boolean the clone writes, nothing looser');
});

test('FT1: the stamp is the BUILD - Enabled for the plus, Disabled for anything else', () => {
  assert.equal(smallerDungeonsStamp(generateSmallerDungeon(loc(BIG))), Enabled);
  assert.equal(smallerDungeonsStamp(loc(BIG)), Disabled);
  assert.equal(smallerDungeonsStamp(loc(SMALL)), Disabled);
  assert.equal(smallerDungeonsStamp(null), Disabled);
  assert.equal(Enabled, 2); assert.equal(Disabled, 1); assert.equal(NotSet, 0);   // DFU's order (F-B3) - the save format
});

test('FT1: the departure, driven - online builds full whatever the setting says, and the stamp says full', () => {
  resetToDefaults();
  setValue('Experimental', 'SmallerDungeons', 'True');
  try {
    const big = loc(BIG);
    const offline = dungeonLocationFor(big);
    const online = dungeonLocationFor(big, { online: true });
    assert.equal(isSmallerDungeon(offline), true, 'the setting on: small');
    assert.equal(isSmallerDungeon(online), false, 'AUDIT WORLD34 B2: online, the whole dungeon');
    assert.equal(smallerDungeonsStamp(online), Disabled, 'the stamp records the full build, NOT the setting');
    // ...so the offline load of that save warps: the position was saved
    // in the full layout and this build is the plus.
    assert.equal(needsStartWarp(smallerDungeonsStamp(online), offline), true, 'the case DFU\'s raw-setting stamp missed');
    assert.equal(needsStartWarp(smallerDungeonsStamp(offline), offline), false, 'and a save made offline loads offline without a warp');
  } finally { resetToDefaults(); }
});

test('FT1: needsStartWarp - the truth table (SerializablePlayer.cs:462-472)', () => {
  const plus = generateSmallerDungeon(loc(BIG));
  const full = loc(BIG);
  // the layouts differ: warp, both ways
  assert.equal(needsStartWarp(Enabled, full), true, 'saved small, built full');
  assert.equal(needsStartWarp(Disabled, plus), true, 'saved full, built small');
  // the layouts agree: never
  assert.equal(needsStartWarp(Enabled, plus), false);
  assert.equal(needsStartWarp(Disabled, full), false);
  // an old envelope (no field / NotSet): never
  assert.equal(needsStartWarp(NotSet, plus), false);
  assert.equal(needsStartWarp(undefined, plus), false);
  assert.equal(needsStartWarp(null, full), false);
  // a main-story dungeon: never (:466-468), whatever the stamp says
  const story = loc(BIG, PRIVATEERS_HOLD);
  assert.equal(needsStartWarp(Enabled, story), false);
  assert.equal(needsStartWarp(Disabled, story), false);
});

test('FT1: the dungeon host stamps and warps through the two exports, and holds no enum literal of its own', () => {
  const ctx = read('src/scenes/dungeonContext.js');
  assert.match(ctx, /import \{ smallerDungeonsStamp, needsStartWarp \} from '\.\.\/world\/smallerDungeons\.js';/);
  assert.match(ctx, /smallerDungeonsState: smallerDungeonsStamp\(dfLocation\),/, 'the stamp');
  assert.match(ctx, /if \(extras\.locationKey === _locationKey && setPlayerPos && needsStartWarp\(extras\.smallerDungeonsState, dfLocation\)\) \{/, 'the warp');
  assert.ok(!/getBool\('Experimental', 'SmallerDungeons'\)/.test(ctx), 'the host no longer reads the raw setting for either');
  assert.ok(!/smallerDungeonsState === 2|\? 2 : 1/.test(ctx), 'ONE DFU MEMBER, ONE EXPORT - no literal 2 for Enabled');
  // and the departure is RECORDED where the doctrine gate looks
  assert.match(read('src/world/smallerDungeons.js'), /DEPARTURE \(recorded, Ledger A: THE\s*\*?\s*SMALLER-DUNGEON SAVE STAMP IS THE BUILD\)/);
  const ledger = read('bible/01-Overview/Port-Ledger.md');
  assert.match(ledger, /\| \*\*THE SMALLER-DUNGEON SAVE STAMP IS THE BUILD \(FT1, 2026-09-14\)\*\*[^\n]*smallerDungeons\.js[^\n]*dungeonContext\.js/, 'the section A row names both files');
});

test('FT1: the registry row - DFU Classic, over the settings key, sound', () => {
  const f = FEATURES.find((x) => x.id === 'smaller-dungeons');
  assert.ok(f, 'the row is on the home');
  assert.deepEqual(f.kinds, ['classic'], 'DFU\'s own feature; it wears Enhanced too the day the port builds on it');
  assert.deepEqual(f.control, { store: 'settings', key: 'Experimental/SmallerDungeons' });
  assert.equal(f.title, 'Smaller dungeons');
  assert.match(f.note, /five blocks/); assert.match(f.note, /Main-story dungeons never shrink/); assert.match(f.note, /online every dungeon is full size/);
  assert.match(f.effect, /next dungeon you enter/);
  assert.deepEqual(checkFeature(f), []);
  assert.equal(featureForControl('settings', 'Experimental/SmallerDungeons'), f);
  assert.equal(featureForControl('settings', 'Experimental/CustomBooksImport'), null, 'a key not on the home');
  assert.equal(featureForControl('prefs', 'Experimental/SmallerDungeons'), null, 'the store is part of the address');
});

test('FT1: the settings pane never draws a moved key as a second switch (FT13: nor as a pointer), and the home\'s switch face toggles', () => {
  const menu = read('src/ui/enhancedMenu.js');
  assert.match(menu, /function settingRow\(key, \{ compact = false, home = false \} = \{\}\) \{[\s\S]{0,900}?if \(!home\) \{\s*const moved = featureForControl\('settings', key\);\s*if \(moved\) return movedRow\(moved\);\s*\}/, 'every settingRow call site asks the registry first - one home per idea');
  assert.match(menu, /function movedRow\(_f\) \{ return null; \}/, 'FT13: a moved key draws nothing here - the pointer row is gone (Mac, 2026-09-14)');
  assert.doesNotMatch(menu, /On the Features page\.|function goFeatures/, 'no pointer, no walk');
  assert.match(menu, /row = settingRow\(c\.key, \{ compact: true, home: true \}\);/, 'the home itself is the one caller that gets the real row');
  assert.match(menu, /if \(widgetFor\(c\.key\) === 'switch'\) \{\s*const \[sec, k\] = c\.key\.split\('\/'\);\s*main\.onclick = \(\) => write\(c\.key, stepValue\(c\.key, effective\(\)\[sec\]\?\.\[k\], 1\)\);/, 'the face toggles, as prefRow\'s does - the home has no help sheet to open');
  // the key stays in its settings category: the map is total and pinned
  assert.match(read('src/ui/settingsMap.js'), /"Experimental\/SmallerDungeons",/);
});
