import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { arrowCountLabel, BOW_TEMPLATES, REAL_ARROWS_COLOR, CONJURED_ARROWS_COLOR } from '../src/ui/hud.js';
import { EQUIP_SLOTS } from '../src/systems/equip.js';
import { ARROW_TEMPLATE } from '../src/systems/inventory.js';
import { setValue, resetToDefaults, LIVE } from '../src/systems/settings.js';

// AUDIT 28 - W2a: THE ARROW COUNTER (DaggerfallHUD.cs:270-292), a
// default-ON DFU feature the port never had. With a bow drawn, the
// arrow stack count sits left of the compass, grey for real arrows and
// the translucent blue for conjured ones, and "0" when the quiver is
// empty. Three gates in DFU's order: the setting, the weapon drawn, a
// bow in the bow hand (BowLeftHandWithSwitching picks the hand).

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const bow = (t = 129) => ({ group: 'Weapons', templateIndex: t, name: 'Short Bow' });
const arrows = (n, summoned = false) => ({ group: 'Weapons', templateIndex: ARROW_TEMPLATE, stackCount: n, timeForItemToDisappear: summoned ? 1000 : 0 });
const entity = ({ hand = 'right', held = bow(), items = [] } = {}) => ({
  equip: { slots: { [hand === 'right' ? EQUIP_SLOTS.RightHand : EQUIP_SLOTS.LeftHand]: held } },
  items,
});

test('AUDIT 28 W2a: the three gates, in DFU\'s order - setting, drawn, a bow in the bow hand', () => {
  resetToDefaults();
  assert.deepEqual(BOW_TEMPLATES, [129, 130], 'Short_Bow 129, Long_Bow 130');
  const e = entity({ items: [arrows(12)] });
  assert.equal(arrowCountLabel(e, false).text, '12');
  assert.equal(arrowCountLabel(e, true), null, 'sheathed: no counter');
  assert.equal(arrowCountLabel(e, false, { enabled: false }), null, 'EnableArrowCounter off: no counter');
  assert.equal(arrowCountLabel(entity({ held: { group: 'Weapons', templateIndex: 120 }, items: [arrows(12)] }), false), null, 'a longsword is not a bow');
  assert.equal(arrowCountLabel(entity({ held: { group: 'Armor', templateIndex: 129 }, items: [arrows(12)] }), false), null, 'the group is checked, not just the index');
  assert.equal(arrowCountLabel(entity({ held: null, items: [arrows(12)] }), false), null, 'bare hands');
  assert.equal(arrowCountLabel(entity({ held: bow(130), items: [arrows(3)] }), false).text, '3', 'the long bow too');
  // The setting is read live by default.
  setValue('GUI', 'EnableArrowCounter', false);
  assert.equal(arrowCountLabel(e, false), null);
  resetToDefaults();
});

test('AUDIT 28 W2a: BowLeftHandWithSwitching picks the hand the bow is looked for in (:275)', () => {
  const left = entity({ hand: 'left', items: [arrows(5)] });
  assert.equal(arrowCountLabel(left, false), null, 'a left-hand bow is not seen by default');
  assert.equal(arrowCountLabel(left, false, { leftHand: true }).text, '5');
  const right = entity({ hand: 'right', items: [arrows(5)] });
  assert.equal(arrowCountLabel(right, false, { leftHand: true }), null, 'and with the setting on, the right hand is not looked at');
  setValue('Enhancements', 'BowLeftHandWithSwitching', true);
  assert.equal(arrowCountLabel(left, false).text, '5', 'read live');
  resetToDefaults();
});

test('AUDIT 28 W2a: the count is GetItem(Arrow, allowQuestItem false, priorityToConjured true), "0" when empty, conjured in blue', () => {
  assert.equal(arrowCountLabel(entity({ items: [] }), false).text, '0', 'no arrows: "0", not nothing');
  const real = arrowCountLabel(entity({ items: [arrows(7)] }), false);
  assert.equal(real.text, '7'); assert.deepEqual([...real.color], [...REAL_ARROWS_COLOR]);
  // A conjured stack is counted FIRST even when it is listed second.
  const mixed = arrowCountLabel(entity({ items: [arrows(7), arrows(20, true)] }), false);
  assert.equal(mixed.text, '20'); assert.deepEqual([...mixed.color], [...CONJURED_ARROWS_COLOR]);
  // A quest arrow stack is not counted.
  const quest = arrowCountLabel(entity({ items: [{ ...arrows(99), questItem: true }] }), false);
  assert.equal(quest.text, '0');
  assert.deepEqual([...REAL_ARROWS_COLOR], [0.6, 0.6, 0.6, 1]);
  assert.deepEqual([...CONJURED_ARROWS_COLOR], [0.18, 0.32, 0.48, 0.5]);
});

test('AUDIT 28 W2a: drawn left of the compass, centred on its height, under the large-HUD gate; every host hands the drawn state, and the interior frame a font', () => {
  const hud = read('src/ui/hud.js');
  // :281-284 - x = width - compass.w - label.w - 8; y = height - compass.h/2 - label.h/2.
  // F-A3: the 8 is raw screen pixels (:282 adds it after the scaled
  // sizes), so it must NOT carry `* s`.
  assert.match(hud, /const x = canvas\.width - compass\.bw - w - 8;/);
  assert.match(hud, /const y = canvas\.height - compass\.bh \/ 2 - h \/ 2;/);
  // The draw sits in the classic-compass arm, which the large-HUD branch
  // returns before (:273's !largeHUDEnabled).
  const largeAt = hud.indexOf('if (largeHud?.art) {');
  const drawAt = hud.indexOf('drawArrowCount(renderer, canvas, font, vitals, weaponSheathed');
  assert.ok(largeAt > 0 && drawAt > largeAt, 'the counter draws in the classic arm, after the large-HUD branch');
  for (const [host, expr] of [
    ['src/scenes/world.js', 'weaponRig.playerWeapon.sheathed'],
    ['src/scenes/exterior.js', 'weaponRig.playerWeapon.sheathed'],
    ['src/scenes/worldModes.js', 'interiorWeapon.playerWeapon.sheathed'],
    ['src/scenes/dungeonContext.js', 'playerWeapon.sheathed'],
  ]) {
    assert.match(read(host), new RegExp(`weaponSheathed: !!${expr.replace(/\\./g, '\\\\.')} \\}\\);`), `${host}: drawHud is not told whether the weapon is drawn`);
  }
  // AUDIT 39 moved this pin off the ADJACENCY it used to read
  // (`font:` immediately above `weaponSheathed:`): the enhanced HUD's
  // two hand plaques now ride the same bag and sit between them. The
  // law was never the neighbour - it is that the interior frame hands
  // a font at all, because without one nothing text-shaped on the
  // classic HUD could draw indoors.
  const interiorBag = read('src/scenes/worldModes.js');
  const bagAt = interiorBag.indexOf('drawHud(renderer, canvas, hudArt');
  assert.match(interiorBag.slice(bagAt, interiorBag.indexOf('});', bagAt)),
    /font: townTalk\?\.font \?\? null,/, 'the interior frame draws no text without a font');
  assert.equal(LIVE['GUI/EnableArrowCounter'], 'src/ui/hud.js');
  assert.equal(LIVE['Enhancements/BowLeftHandWithSwitching'], 'src/ui/hud.js');
});
