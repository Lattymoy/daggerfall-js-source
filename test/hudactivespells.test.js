// U46 - HUDACTIVESPELLS: the buff and debuff icon rows. Everything
// pinned here was mutation-proven.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BLINK_INTERVAL, MAX_ICON_POOL, ICON_SCHEMES, iconScheme,
  maxRoundsRemaining, activeSpellIcons, alignIcons, iconVisible,
  createBlinkClock, setHudPointer, hudPointer, activeSpellAt,
} from '../src/ui/hudActiveSpells.js';
import { liveBundles } from '../src/systems/mysticism.js';

const src = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), 'utf8');

/** An entity carrying hand-stamped bundles - the shape effects.js
 *  mints, since applySpell needs a whole cast engine to reach. */
const ent = (...bundles) => ({
  activeEffects: bundles.flatMap((b, i) => (b.entries ?? [{ roundsRemaining: b.rounds ?? 5 }]).map((e) => ({
    kind: b.kind ?? 'fortify', roundsRemaining: 5, ...e,
    bundleId: b.id ?? (i + 1), bundleName: b.name ?? `spell${i}`,
    bundleType: b.type ?? 'Spell', bundleIcon: b.icon ?? 0,
    // ...and a bundle with NO `selfCast` key leaves the field ABSENT,
    // which is what an entry stamped before U46 (or by a path that
    // records no caster) really looks like.
    ...(b.selfCast === undefined ? {} : { bundleSelfCast: b.selfCast }),
  }))),
});

// ---------------------------------------------------------------
// 1. THE EIGHT SCHEMES
// ---------------------------------------------------------------

test('activeSpells: the eight layout schemes are InitIcons verbatim, and ZERO columns means no wrap', () => {
  assert.deepEqual(Object.keys(ICON_SCHEMES), [
    'classic', 'medium', 'small', 'smalldeckleft', 'smalldeckright',
    'smallvertleft', 'smallvertright', 'smallhorzbottom',
  ]);
  // classic: 16px icons, buffs from (27,16) wrapping DOWN, debuffs
  // from (27,177) wrapping UP, twelve to a row.
  assert.deepEqual(ICON_SCHEMES.classic.self, {
    iconSize: [16, 16], origin: [27, 16], columnStep: [24, 0], rowStep: [0, 24], iconColumns: 12,
  });
  assert.deepEqual(ICON_SCHEMES.classic.other.rowStep, [0, -24], 'the debuff row grows UPWARD');
  // SEVEN of the eight put the debuffs BELOW the buffs. The eighth
  // inverts it, and says so - "two rows at the bottom of screen,
  // DEBUFFS ABOVE BUFFS" - because both rows are at the bottom there
  // and neither wraps, so the only way to separate them is to stack.
  for (const [name, s] of Object.entries(ICON_SCHEMES)) {
    if (name === 'smallhorzbottom') {
      assert.ok(s.other.origin[1] < s.self.origin[1], 'smallhorzbottom alone puts debuffs ABOVE');
      continue;
    }
    assert.ok(s.other.origin[1] > s.self.origin[1], `${name}: debuffs start below buffs`);
  }
  // THE ZERO. `++column == iconColumns` with iconColumns 0 can never
  // match, which is exactly what DFU's comment says smallhorzbottom
  // does - "No wrapping". Its rowStep is [0,0] for the same reason.
  // RECORDED EQUIVALENT: `iconColumns && ++column >= iconColumns`
  // survives, and it is the same program - a counter that resets at
  // N can only ever REACH N, so `===` and a guarded `>=` agree for
  // every scheme, zero included. DFU wrote the bare `==`.
  assert.equal(ICON_SCHEMES.smallhorzbottom.self.iconColumns, 0);
  assert.deepEqual(ICON_SCHEMES.smallhorzbottom.self.rowStep, [0, 0]);
  const many = Array.from({ length: 30 }, (_, i) => ({ poolIndex: i, expiring: false, isItem: false }));
  const laid = alignIcons(many, ICON_SCHEMES.smallhorzbottom.self);
  assert.equal(laid.length, MAX_ICON_POOL, 'the pool caps it, not a wrap');
  assert.ok(laid.every((p) => p.rect[1] === 177), 'and every icon stays on one line');
  assert.equal(laid.at(-1).rect[0], 27 + 10 * (laid.length - 1), 'marching right for ever');
});

test('activeSpells: the scheme name is lowercased, and an unknown one falls to Classic', () => {
  assert.equal(iconScheme('classic'), ICON_SCHEMES.classic);
  assert.equal(iconScheme('smallvertright'), ICON_SCHEMES.smallvertright);
  // DFU's switch has no default and leaves BOTH positionings null,
  // which throws on the first icon; the port names Classic instead.
  assert.equal(iconScheme('nonsense'), ICON_SCHEMES.classic);
  assert.equal(iconScheme(''), ICON_SCHEMES.classic);
  assert.match(src('ui/hudActiveSpells.js'), /toLowerCase\(\)/, 'IconsPositioningScheme.ToLower');
});

// ---------------------------------------------------------------
// 2. THE SPLIT, THE POOL AND THE NAME
// ---------------------------------------------------------------

test('activeSpells: the caster sorts the row, and a bundle with NO caster is a debuff', () => {
  const e = ent(
    { name: 'Fortify', selfCast: true, icon: 3 },
    { name: 'Curse', selfCast: false, icon: 9 },
    { name: 'Trap', icon: 11 },   // no caster recorded at all
  );
  const { self, other } = activeSpellIcons(e);
  assert.deepEqual(self.map((i) => i.displayName), ['Fortify']);
  assert.deepEqual(other.map((i) => i.displayName), ['Curse', 'Trap']);
  // DFU: `caster == null || caster != player` -> other. An untagged
  // cast is a debuff, which is what a trap or an RDB action looks
  // like, and DFU says as much in its own comment.
  assert.deepEqual(self.map((i) => i.iconIndex), [3]);
  assert.deepEqual(other.map((i) => i.iconIndex), [9, 11]);
  // The third bundle carries NO bundleSelfCast field at all - an
  // entry stamped before U46, or by a path that records no caster -
  // and it must read as a DEBUFF, not as a buff. `selfCast === false
  // ? other : self` passes every other pin here and fails this one.
  assert.equal('bundleSelfCast' in e.activeEffects[2], false, 'the fixture really is untagged');
  assert.equal(liveBundles(e)[2].selfCast, false, 'and liveBundles reads it as not-self');
  // RECORDED EQUIVALENT: `bundle.selfCast === false ? other : self`
  // in activeSpellIcons survives every pin here, and it really is
  // equivalent - liveBundles has already normalised the field with
  // `!!`, so nothing undefined reaches this function. The pin that
  // matters is one layer down, on that `!!`, and it is above.
});

test('activeSpells: the pool index is ONE walk shared by both rows, and it caps the TOTAL', () => {
  // poolIndex++ runs before the split (:307), so the two rows
  // interleave in one numbering - and AlignIcons drops anything past
  // the pool while that icon has still CONSUMED its slot.
  const many = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, name: `s${i}`, selfCast: i % 2 === 0 }));
  const { self, other } = activeSpellIcons(ent(...many));
  assert.equal(self.length + other.length, 30, 'every bundle is listed');
  assert.deepEqual(self.map((i) => i.poolIndex).slice(0, 3), [0, 2, 4]);
  assert.deepEqual(other.map((i) => i.poolIndex).slice(0, 3), [1, 3, 5]);
  // ...and the drawn total is 24, split across the rows by whose
  // numbers happen to be low - NOT 24 per row.
  const drawn = alignIcons(self, ICON_SCHEMES.classic.self).length
    + alignIcons(other, ICON_SCHEMES.classic.other).length;
  assert.equal(drawn, MAX_ICON_POOL);
  // MUTATION: a per-row counter draws 30 and this fails twice.
});

test('activeSpells: the display name drops a LEADING bang and nothing else', () => {
  // "Non-vendor spells start with !, don't show this on the UI" -
  // TrimStart, so an interior bang survives.
  const { other } = activeSpellIcons(ent({ name: '!Wildfire' }, { name: 'Fire!Ball' }, { name: '!!Twice' }));
  assert.deepEqual(other.map((i) => i.displayName), ['Wildfire', 'Fire!Ball', 'Twice']);
});

test('activeSpells: ShowIcon is the DISPEL PICKER\'s law, read from one place', () => {
  // liveBundles carries DFU's per-BUNDLE ShowIcon, and this window's
  // ShowIcon (:177-190) is the same sentence - so an armed Open marker
  // is skipped here exactly as it is skipped there.
  const e = ent({ name: 'Open', kind: 'openArmed' }, { name: 'Levitate', kind: 'levitate' });
  assert.deepEqual(liveBundles(e).map((b) => b.showIcon), [false, true]);
  const { self, other } = activeSpellIcons(e);
  assert.deepEqual([...self, ...other].map((i) => i.displayName), ['Levitate']);
  // ...but an ITEM bundle shows whatever its kind, the
  // `|| fromEquippedItem != null` half.
  const held = ent({ name: 'Ring', kind: 'openArmed', type: 'HeldMagicItem' });
  assert.equal(liveBundles(held)[0].showIcon, true);
  assert.equal(activeSpellIcons(held).other[0].isItem, true);
});

// ---------------------------------------------------------------
// 3. EXPIRY AND THE BLINK
// ---------------------------------------------------------------

test('activeSpells: expiring is the bundle\'s LONGEST effect under two rounds', () => {
  // GetMaxRoundsRemaining: "a spell can have multiple effects with
  // different round durations" - the icon belongs to the whole cast,
  // so one long member keeps it solid.
  const e = ent(
    { name: 'Mixed', entries: [{ roundsRemaining: 1 }, { roundsRemaining: 9 }] },
    { name: 'Fading', entries: [{ roundsRemaining: 1 }, { roundsRemaining: 1 }] },
    { name: 'Two', entries: [{ roundsRemaining: 2 }] },
  );
  const [mixed, fading, two] = liveBundles(e);
  assert.equal(maxRoundsRemaining(mixed), 9);
  assert.equal(maxRoundsRemaining(fading), 1);
  const icons = activeSpellIcons(e).other;
  assert.deepEqual(icons.map((i) => i.expiring), [false, true, false]);
  assert.equal(maxRoundsRemaining(two), 2, 'the bound is `< 2`, so exactly two is NOT expiring');
});

test('activeSpells: an expiring icon blinks and an ITEM never does', () => {
  const spell = { expiring: true, isItem: false };
  const item = { expiring: true, isItem: true };
  const steady = { expiring: false, isItem: false };
  assert.equal(iconVisible(spell, false), false, 'a spell blinks OFF');
  assert.equal(iconVisible(spell, true), true);
  // "an equipped item's effect is not running out, it is just there"
  assert.equal(iconVisible(item, false), true, 'an item never blinks');
  assert.equal(iconVisible(steady, false), true);
  // Paused, everything shows - DFU's else arm sets the blink state
  // TRUE for both lists rather than skipping the call.
  assert.equal(iconVisible(spell, false, true), true);
});

test('activeSpells: the blink clock toggles ONCE per frame, DFU\'s `if` and not a drain', () => {
  const c = createBlinkClock();
  assert.equal(c.state, false);
  assert.equal(c.tick(0.1), false, 'under the interval, nothing');
  assert.equal(c.tick(0.2), true, 'past it, one toggle');
  assert.equal(c.tick(0.1), true, 'and the remainder is carried, not spent');
  assert.equal(c.tick(0.2), false);
  // A LONG frame toggles once and keeps the rest for the next one.
  const d = createBlinkClock();
  assert.equal(d.tick(2), true, 'eight intervals in one frame is still ONE toggle');
  assert.equal(d.tick(0), false, '...and the next frame spends the next');
  // MUTATION: a `while` drain answers true for both and strobes.
  assert.equal(BLINK_INTERVAL, 0.25);
});

// ---------------------------------------------------------------
// 4. THE LAYOUT WALK
// ---------------------------------------------------------------

test('activeSpells: AlignIcons steps by column and wraps by row', () => {
  const icons = Array.from({ length: 14 }, (_, i) => ({ poolIndex: i, expiring: false, isItem: false }));
  const laid = alignIcons(icons, ICON_SCHEMES.classic.self);
  assert.deepEqual(laid[0].rect, [27, 16, 16, 16]);
  assert.deepEqual(laid[1].rect, [27 + 24, 16, 16, 16], 'columnStep');
  assert.deepEqual(laid[11].rect, [27 + 24 * 11, 16, 16, 16], 'the twelfth is the last of the row');
  assert.deepEqual(laid[12].rect, [27, 16 + 24, 16, 16], 'the thirteenth starts the next row at the ORIGIN');
  assert.deepEqual(laid[13].rect, [27 + 24, 16 + 24, 16, 16]);
  // and the debuff row's rowStep is negative, so it climbs
  const up = alignIcons(icons, ICON_SCHEMES.classic.other);
  assert.equal(up[12].rect[1], 177 - 24);
});

test('activeSpells: the large HUD lifts an icon ONLY upward', () => {
  // AdjustIconPositionForLargeHUD: "Icon will remain in default
  // position unless it needs to avoid being drawn under HUD."
  const one = [{ poolIndex: 0, expiring: false, isItem: false }];
  const top = 154;   // the bar's top edge in virtual units
  const buffs = alignIcons(one, ICON_SCHEMES.classic.self, { largeHudTop: top });
  assert.equal(buffs[0].rect[1], 16, 'the buff row at y=16 is already clear and does not move');
  const debuffs = alignIcons(one, ICON_SCHEMES.classic.other, { largeHudTop: top });
  assert.equal(debuffs[0].rect[1], top - 18, 'the debuff row at y=177 is under the bar and lifts');
  assert.ok(debuffs[0].rect[1] < 177);
  // no bar, no lift
  assert.equal(alignIcons(one, ICON_SCHEMES.classic.other)[0].rect[1], 177);
  // MUTATION: dropping the `localY < startY` test drags the buff row
  // DOWN to the bar and this fails on the first assertion.
});

// ---------------------------------------------------------------
// 5. THE POINTER AND THE WIRING
// ---------------------------------------------------------------

test('activeSpells: the icon under the pointer is the tooltip\'s, and the store is one', () => {
  const placed = alignIcons(
    [{ poolIndex: 0, displayName: 'Levitate', expiring: false, isItem: false },
      { poolIndex: 1, displayName: 'Free Action', expiring: false, isItem: false }],
    ICON_SCHEMES.classic.self);
  assert.equal(activeSpellAt(placed, 30, 20).displayName, 'Levitate');
  assert.equal(activeSpellAt(placed, 27 + 24 + 1, 20).displayName, 'Free Action');
  assert.equal(activeSpellAt(placed, 27 + 16, 20), null, 'the gap between two 16px icons at a 24px step');
  assert.equal(activeSpellAt(placed, 30, 40), null);
  assert.equal(activeSpellAt(null, 0, 0), null);

  setHudPointer(-1, -1);
  assert.equal(hudPointer(), null, 'off-panel is null, not [-1,-1]');
  setHudPointer(12, 34);
  assert.deepEqual(hudPointer(), [12, 34]);
  setHudPointer(-1, -1);
});

test('activeSpells: the rows ride the ONE HUD call, on BOTH its branches, and all four hosts feed the pointer', () => {
  const hud = src('ui/hud.js');
  // DaggerfallHUD.cs:209 enables activeSpells from ShowActiveSpells
  // alone; the large-HUD block at :214-220 turns off the vitals, the
  // compass and the mode icon and never touches these - so the rows
  // are drawn on both branches, over the bar.
  assert.equal((hud.match(/drawSpellIconRows\(/g) ?? []).length, 3, 'defined once, called on both branches');
  const large = hud.indexOf('if (largeHud?.art) {');
  const ret = hud.indexOf('return;', large);
  assert.ok(hud.slice(large, ret).includes('drawSpellIconRows('), 'the large-HUD branch draws them too');
  assert.match(hud, /largeHudRect: lastLargeHudBar/, 'and hands them the bar to dodge');
  // the sheet loads with the rest of the HUD art, not with the
  // spellbook window that used to be its only consumer
  assert.match(hud, /preloadSpellIcons\(/);
  for (const host of ['scenes/world.js', 'scenes/exterior.js', 'scenes/worldModes.js', 'scenes/dungeon.js']) {
    assert.match(src(host), /trackHudPointer\(canvas, e\)/, `${host} feeds the pointer`);
  }
});
