// BUFF-END (2026-09-27, Leafen on Discord: "Could there be a way to dispel magic for non-magic users? It's a bit of a
// buzzkill just having something on me that will take irl months of game time to wear off" - a Shield Group at 11397
// rounds; "Or maybe have a hard limit for the number of ticks"; Zerofyre: "An option to right click cancel buffs on
// yourself like most RPGs would be incredibly nice"). Never DFU's - its one way off is Dispel Magic - and the stacking
// law stands: a player ENDS a spell of theirs, with a right-click on its HUD icon (the mouse freed) on either skin, or
// the End on the pause window's Stats page, Effects. What may be ended is a spell of the kinds that only help.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { liveBundles, canEndBundle, endBundle, endedSpellText, ENDABLE_KINDS } from '../../../src/systems/mysticism.js';
import { BUFF_KINDS } from '../../../src/systems/effects.js';
import { statusTiles } from '../../../src/ui/hud/hudStatus.js';
import { activeSpellIcons, setHudPointer } from '../../../src/ui/hud/hudActiveSpells.js';
import { routeSpellIconClick } from '../../../src/ui/hud/hudLarge.js';
import { setCursorActive } from '../../../src/player/pointerLock.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const e = (bundleId, kind, extra = {}) => ({ kind, roundsRemaining: 11397, bundleId, bundleName: 'Shield Group', bundleType: 'Spell', bundleIcon: 3, bundleSelfCast: true, bundleAlly: false, ...extra });
const bundleOf = (entity, id) => liveBundles(entity).find((b) => b.bundleId === id);

test('BUFF-END: the player may end a spell of the kinds that only help - never an item\'s, a duel\'s, an armed door spell, or one with a harmful kind in it', () => {
  const entity = { activeEffects: [
    e(1, 'shield'), e(1, 'fortifyAttribute'),                       // mine: Shield and Fortify in one cast
    e(2, 'levitate', { bundleSelfCast: false, bundleAlly: true }),  // a party mate's gift
    e(3, 'shield', { bundleType: 'HeldMagicItem' }),                // a held item's
    e(4, 'shield', { bundleDuel: true }),                           // a duel's
    e(5, 'shield'), e(5, 'drainAttribute', { bundleSelfCast: false }),   // a foe's Drain merged into my cast's incumbent
    e(6, 'openArmed', { permanent: true }),                          // an armed Open
    e(7, 'silenced', { bundleSelfCast: false }),                     // a Wraith's Silence
  ] };
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map((id) => canEndBundle(bundleOf(entity, id))), [true, true, false, false, false, false, false]);
  assert.equal(canEndBundle(null), false);
  assert.equal(canEndBundle({ bundleType: 'Spell', entries: [] }), false, 'a bundle of nothing is nothing to end');
  // the kinds: every duration buff but Silence, and the eight lasting helps
  for (const k of Object.values(BUFF_KINDS)) assert.equal(ENDABLE_KINDS.has(k), k !== 'silenced', k);
  for (const k of ['drainAttribute', 'damageHealth', 'continuousDamage', 'paralyze', 'transferHealth', 'soulTrap', 'disease', 'poison']) {
    assert.equal(ENDABLE_KINDS.has(k), false, `${k} is never the player's to end`);
  }
});

test('BUFF-END: ending takes every entry of that one bundle and nothing else, says its name - and a refusal takes nothing', () => {
  const entity = { activeEffects: [e(1, 'shield', { bundleName: '!Shield Group' }), e(1, 'fortifyAttribute', { bundleName: '!Shield Group' }), e(2, 'regenerate', { bundleName: 'Mend' }), e(3, 'shield', { bundleType: 'HeldMagicItem' })] };
  assert.equal(endBundle(entity, 1), 'Shield Group', 'the name, its leading ! dropped as the HUD drops it');
  assert.deepEqual(entity.activeEffects.map((a) => a.bundleId), [2, 3]);
  assert.equal(endBundle(entity, 3), null, 'a held item\'s is refused');
  assert.equal(endBundle(entity, 99), null, 'a bundle gone is nothing');
  assert.deepEqual(entity.activeEffects.map((a) => a.bundleId), [2, 3], 'and nothing moved');
  assert.equal(endedSpellText('Mend'), 'Mend ends.');
});

test('BUFF-END: both HUDs carry the bundle and whether it may be ended - the enhanced tile, the classic icon', async () => {
  const { effectRows } = await import('../../../src/ui/enhanced/enhancedHud.js');
  const entity = { activeEffects: [e(1, 'shield'), e(3, 'shield', { bundleType: 'HeldMagicItem', bundleName: 'Ring' })] };
  const rows = effectRows(entity);
  assert.deepEqual(rows.map((r) => [r.name, r.bundleId, r.endable]), [['Shield Group', 1, true], ['Ring', 3, false]]);
  const tiles = statusTiles({ spells: rows });
  assert.deepEqual(tiles.map((t) => [t.bundle, t.endable]), [[1, true], [3, false]]);
  assert.deepEqual(statusTiles({ spells: [{ name: 'x', endable: true }] }).map((t) => [t.bundle, t.endable]), [[null, false]], 'no bundle, nothing to end');
  const { self } = activeSpellIcons(entity);
  assert.deepEqual(self.map((i) => [i.displayName, i.bundleId, i.endable]), [['Shield Group', 1, true], ['Ring', 3, false]]);
});

test('BUFF-END: the classic right-click - the freed mouse over an icon the player may end ends it; the look held, the left button or an item\'s icon take nothing', () => {
  const entity = { activeEffects: [e(1, 'shield'), e(3, 'shield', { bundleType: 'HeldMagicItem' })] };
  const placed = [{ bundleId: 1, endable: true, rect: [10, 10, 16, 16] }, { bundleId: 3, endable: false, rect: [30, 10, 16, 16] }];
  try {
    setHudPointer(12, 12);
    setCursorActive(false);
    assert.equal(routeSpellIconClick(2, { entity, placed }), false, 'the look held: the press is the world\'s');
    setCursorActive(true);
    assert.equal(routeSpellIconClick(0, { entity, placed }), false, 'the left button is the world\'s');
    assert.equal(routeSpellIconClick(2, { entity, placed, windowUp: true }), false, 'a window up: the window\'s');
    setHudPointer(32, 12);
    assert.equal(routeSpellIconClick(2, { entity, placed }), false, 'an item\'s icon is not the player\'s to end');
    setHudPointer(12, 12);
    assert.equal(routeSpellIconClick(2, { entity, placed }), true);
    assert.deepEqual(entity.activeEffects.map((a) => a.bundleId), [3], 'the Shield Group is gone');
  } finally { setCursorActive(false); setHudPointer(-1, -1); }
  const large = rd('src/ui/hud/hudLarge.js');
  assert.match(large, /if \(routeSpellIconClick\(button, \{ windowUp \}\)\) \{ event\?\.preventDefault\?\.\(\); return true; \}/, 'the icon\'s press raises no mousedown - no swing, no armed cast');
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeon.js']) {
    assert.match(rd(host), /routeLargeHudClick\([\s\S]{0,260}?event: e \}\)\) return/, `${host} hands the click door its event`);
  }
});

test('BUFF-END: the enhanced widget takes the pointer only with the mouse freed, and the Stats page lists every spell with an End on the ones that may be ended', () => {
  const hud = rd('src/ui/enhanced/enhancedHud.js');
  assert.match(hud, /const ending = cursorActive\(\) && !overlayOpen\(\) && !controllerLook\(\);/);
  assert.match(hud, /const g = endingGesture\(cellOf, \(bundle\) => \{\n\s*const name = endBundle\(last\.statEntity, bundle\);/);
  assert.match(hud, /stat\.addEventListener\('contextmenu', g\.menu\);/);
  // AUDIT 27h B1: the press is the widget's - no swing under it - and so is ITS release, and only its (test/ui/enhanced/audit27h.test.js runs the gesture)
  assert.match(hud, /stat\.addEventListener\('mousedown', g\.down\);\n\s*stat\.addEventListener\('mouseup', g\.up\);/);
  assert.match(rd('src/ui/enhanced/enhancedStyle.js'), /\.hud-stat\.ending \.hst-cell\.can-end \{ pointer-events: auto; cursor: pointer; \}/);
  const menu = rd('src/ui/enhanced/enhancedMenu.js');
  assert.match(menu, /\['effects', 'Effects'\],/);
  const at = menu.indexOf('function statsEffects(detail) {');
  const fn = menu.slice(at, menu.indexOf('\n}\n', at));
  assert.match(fn, /if \(canEndBundle\(b\)\) \{/);
  assert.match(fn, /end\.onclick = \(\) => \{ endBundle\(playerEntity, b\.bundleId\); render\(\); \};/);
});
