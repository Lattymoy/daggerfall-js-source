// QUICK-LOOT-FILTER (a player's ask): rarities and materials as boxes on the Quick loot row, a material filter that may bind
// Common gear alone, and a hover plaque that stays down for what the filter would leave - systems/quickLootFilter.js, the
// row's boxes (systems/features.js), takeAllLeaves (systems/quickLoot.js) and resolveHover (systems/worldHover.js).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { setPref, resetPrefs, _resetForTests } from '../../src/systems/uiPrefs.js';
import { FEATURES, resolveControl } from '../../src/systems/features.js';
import { RARITY_ORDER } from '../../src/systems/loot/lootRarity.js';
import { MATERIAL_NAMES } from '../../src/systems/item/itemInfo.js';
import { filterLeaves, hoverHidden, bodyHidden, bodyTarget, hoverVisible, regexIsSafe, nameLeaves, skipMatches, skipList, validSkipEntry, migrateQuickLootTier, _resetMigration, QL_SKIP, QL_RARITY_PREF, QL_MATERIAL_PREF, QL_MATERIAL_COMMON, QL_HIDE_EMPTY, QL_HIDE_DULL, QL_HIDE_DROPS, QL_HIDE_LEFT } from '../../src/systems/quickLootFilter.js';
import { takeAllLeaves } from '../../src/systems/quickLoot.js';
import { resolveHover, hoverItemAt, hoverLines } from '../../src/systems/worldHover.js';
import { ARMOR_MATERIAL } from '../../src/systems/armorMaterials.js';
import { WEAPON_MATERIALS, WEAPONS } from '../../src/characters/weapons.js';

beforeEach(() => { _resetForTests(); resetPrefs(); _resetMigration(); });

const sword = (material, rarity = 'common') => ({ group: 'Weapons', templateIndex: 3, material, rarity, name: 'Sword' });
const mail = (material, rarity = 'common') => ({ group: 'Armor', templateIndex: 4, material, rarity, name: 'Cuirass' });
const only = (names) => { for (const n of [...MATERIAL_NAMES, 'Leather', 'Chain']) setPref(QL_MATERIAL_PREF(n), names.includes(n)); };

test('QUICK-LOOT-FILTER boxes: the row lists a box for every tier the ladder has and every material an item can be, grouped, all ticked by default - the lists pinned to their homes (mutants: a tier missing; a material missing; a box that defaults off)', () => {
  const row = FEATURES.find((f) => f.id === 'quick-loot');
  const c = resolveControl(row);
  const parts = c.parts;
  const rarities = parts.filter((p) => p.group === 'Take these rarities');
  assert.deepEqual(rarities.map((p) => p.key), RARITY_ORDER.map((t) => QL_RARITY_PREF(t)), 'every tier, the ladder\'s order');
  const materials = parts.filter((p) => p.group === 'Take these materials' && p.key.startsWith('quickLootMat_'));
  assert.deepEqual(materials.map((p) => p.label).sort(), [...MATERIAL_NAMES, 'Leather', 'Chain'].sort(), 'every material');
  assert.ok(parts.some((p) => p.key === QL_MATERIAL_COMMON) && parts.some((p) => p.key === QL_HIDE_EMPTY) && parts.some((p) => p.key === QL_HIDE_DULL) && parts.some((p) => p.key === QL_HIDE_DROPS));
  const defaults = Object.fromEntries((c.also ?? []).map((a) => [a.key, a.initial]));
  for (const p of [...rarities, ...materials]) assert.equal(defaults[p.key], true, `${p.key} ticked`);
  for (const k of [QL_MATERIAL_COMMON, QL_HIDE_EMPTY, QL_HIDE_DULL, QL_HIDE_DROPS]) assert.equal(defaults[k], false, `${k} off`);
  assert.ok(!parts.some((p) => p.key === 'quickLootTier'), 'the old Take gear bar is no part of the row now');
  assert.ok((c.also ?? []).some((a) => a.key === 'quickLootTier'), '...its pref stands, to be carried over');
  assert.ok(parts.some((p) => p.key === 'quickLootSkip' && p.list), 'the skip list is a list part');
});

test('QUICK-LOOT-FILTER rarity: an unticked tier is left on the pile, a ticked one taken - by default nothing is left (mutants: the tier read off by one; the default leaving a tier)', () => {
  for (const t of RARITY_ORDER) assert.equal(takeAllLeaves(sword(0, t)), false, `${t} by default`);
  setPref(QL_RARITY_PREF('common'), false);
  assert.equal(takeAllLeaves(sword(0, 'common')), true, 'Common unticked: left');
  assert.equal(takeAllLeaves(sword(0, 'magic')), false, 'Magic still taken');
  setPref(QL_RARITY_PREF('magic'), false);
  setPref(QL_RARITY_PREF('rare'), true);
  assert.equal(takeAllLeaves(sword(0, 'magic')), true);
  assert.equal(takeAllLeaves(sword(0, 'rare')), false, 'a gap in the ladder is allowed');
  assert.equal(takeAllLeaves(mail(ARMOR_MATERIAL.Iron, 'magic')), true, 'armour too');
});

test('QUICK-LOOT-FILTER materials: every rarity ticked and only Daedric ticked leaves an iron piece of any tier; with the Common box it leaves Common iron alone (the player\'s own case; mutants: the Common box ignored; every tier bound when it is on)', () => {
  only(['Daedric']);
  assert.equal(takeAllLeaves(sword(WEAPON_MATERIALS.Iron)), true, 'Common iron: left');
  assert.equal(takeAllLeaves(sword(WEAPON_MATERIALS.Iron, 'rare')), true, 'Rare iron: left too, the filter binds every tier');
  assert.equal(takeAllLeaves(sword(WEAPON_MATERIALS.Daedric)), false, 'Common daedric: taken');
  assert.equal(takeAllLeaves(mail(ARMOR_MATERIAL.Daedric, 'rare')), false);
  assert.equal(takeAllLeaves(mail(ARMOR_MATERIAL.Leather)), true, 'leather armour: left');
  assert.equal(takeAllLeaves(mail(ARMOR_MATERIAL.Chain)), true, 'chain: left');
  setPref(QL_MATERIAL_COMMON, true);
  assert.equal(takeAllLeaves(sword(WEAPON_MATERIALS.Iron)), true, 'Common iron: still left');
  assert.equal(takeAllLeaves(sword(WEAPON_MATERIALS.Iron, 'magic')), false, 'Magic iron: taken now - the box binds Common alone');
  assert.equal(takeAllLeaves(sword(WEAPON_MATERIALS.Iron, 'legendary')), false);
  assert.equal(takeAllLeaves(sword(WEAPON_MATERIALS.Daedric)), false);
});

test('QUICK-LOOT-FILTER law: only gear is judged - gold, a quiver, a quest\'s item, a jewel with no material and DFU\'s own magic item are always taken; junk is still left (mutants: a quest item left; ammunition filtered; a jewel read as iron)', () => {
  only(['Daedric']);
  setPref(QL_RARITY_PREF('common'), false);
  assert.equal(takeAllLeaves({ group: 'Currency', name: 'Gold' }), false);
  assert.equal(takeAllLeaves({ ...sword(WEAPON_MATERIALS.Iron), questItem: true }), false, 'a quest\'s item');
  assert.equal(takeAllLeaves({ group: 'Weapons', templateIndex: WEAPONS.Arrow, material: WEAPON_MATERIALS.Iron, name: 'Arrow' }), false, 'ammunition is a supply');
  assert.equal(filterLeaves({ group: 'Jewellery', templateIndex: 0, rarity: 'magic', name: 'Ring' }), false, 'a jewel has no material');
  assert.equal(takeAllLeaves({ ...sword(WEAPON_MATERIALS.Daedric), junk: true }), true, 'junk is left whatever it is');
  assert.equal(filterLeaves(null), false);
  assert.equal(filterLeaves(sword(WEAPON_MATERIALS.Iron), false), false, 'not gear: not judged');
});

test('QUICK-LOOT-FILTER hiding: the plaque stays down for an empty body, a body whose every piece is left, and a piece on the ground that would be left - each its own switch, and only for those keys (mutants: a switch ignored; a body with one taken piece hidden; a chest hidden)', () => {
  const left = sword(WEAPON_MATERIALS.Iron), kept = sword(WEAPON_MATERIALS.Daedric);
  only(['Daedric']);
  const body = 'foeCorpse:7', drop = 'droppedLoot:2';
  assert.equal(hoverHidden(body, []), false, 'by default every plaque shows');
  assert.equal(hoverHidden(body, [left]), false);
  assert.equal(hoverHidden(drop, [left]), false);
  setPref(QL_HIDE_EMPTY, true);
  assert.equal(hoverHidden(body, []), true, 'an empty body');
  assert.equal(hoverHidden('corpse:1', []), true);
  assert.equal(hoverHidden(drop, []), false, 'an empty pile on the ground is not a body');
  assert.equal(hoverHidden(body, [left]), false, 'the switch is the empty ones\'');
  setPref(QL_HIDE_DULL, true);
  assert.equal(hoverHidden(body, [left, left]), true, 'every piece left');
  assert.equal(hoverHidden(body, [left, kept]), false, 'one piece I take: shown');
  assert.equal(hoverHidden(body, [left, { group: 'Currency', name: 'Gold' }]), false, 'gold is always taken');
  setPref(QL_HIDE_DROPS, true);
  assert.equal(hoverHidden(drop, [left]), true, 'a piece on the ground I would leave');
  assert.equal(hoverHidden('spoil:3', [left]), true, 'a boss\'s spoil too');
  assert.equal(hoverHidden(drop, [kept]), false);
  assert.equal(hoverHidden('container:5', []), false, 'a chest is no body');
  assert.equal(hoverHidden('loot:5', [left]), false, 'a dungeon pile is neither');
});

test('QUICK-LOOT-FILTER the plaque: resolveHover draws nothing for a hidden body and the frame for the rest - the real resolver over the real filter (mutants: the seam unregistered; the check after the frame)', () => {
  const hit = (key) => ({ key, distance: 1, reach: 3 });
  const named = { title: 'Mighty Ghost (dead)' };
  const hover = (key, items) => resolveHover(hit(key), { name: () => named, contents: () => items });
  assert.equal(hover('foeCorpse:1', [])?.key, 'foeCorpse:1', 'by default the empty body is drawn');
  setPref(QL_HIDE_EMPTY, true);
  assert.equal(hover('foeCorpse:1', []), null, 'hidden empty');
  assert.ok(hover('foeCorpse:1', [kept()]), 'a body with a piece is drawn');
  only(['Daedric']);
  setPref(QL_HIDE_DULL, true);
  assert.equal(hover('foeCorpse:1', [sword(WEAPON_MATERIALS.Iron)]), null, 'nothing the filter takes: hidden');
  assert.ok(hover('foeCorpse:1', [sword(WEAPON_MATERIALS.Daedric)]), 'a daedric piece: drawn');
  assert.equal(resolveHover(hit('foeCorpse:1'), { name: () => named, contents: () => null })?.key, 'foeCorpse:1', 'an unread list is no empty one');
  function kept() { return { group: 'Weapons', templateIndex: 3, material: 9, name: 'Sword' }; }
});

test('QUICK-LOOT-FILTER skip by name: contains, exact and regex, without regard to case - on ANY piece but a quest\'s, gear or not, ahead of the boxes; a bad pattern matches nothing (mutants: exact read as contains; a quest item left; non-gear passed over)', () => {
  const meat = { group: 'Plants', templateIndex: 1, name: 'Raw meat' };
  const helm = { group: 'Armor', templateIndex: 2, material: ARMOR_MATERIAL.Daedric, rarity: 'rare', name: 'Daedric Helmet' };
  assert.equal(takeAllLeaves(meat), false, 'by default nothing is skipped');
  setPref(QL_SKIP, [{ mode: 'exact', text: 'raw MEAT' }, { mode: 'contains', text: 'hemlet' }, { mode: 'regex', text: '^(\\w+) spaulder$' }, { mode: 'regex', text: '(' }]);
  assert.equal(takeAllLeaves(meat), true, 'Raw meat, exact and case-blind: a supply, left');
  assert.equal(takeAllLeaves({ ...meat, name: 'Raw meat strips' }), false, 'exact is not contains');
  assert.equal(takeAllLeaves(helm), false, '"hemlet" is not "Helmet"');
  setPref(QL_SKIP, [{ mode: 'contains', text: 'helmet' }]);
  assert.equal(takeAllLeaves(helm), true, 'contains: a Rare Daedric helmet is left by name, over every box');
  assert.equal(takeAllLeaves({ ...helm, questItem: true }), false, 'a quest item is never left');
  assert.equal(nameLeaves({ ...helm, questItem: true }), false, 'nor by the name word on its own');
  setPref(QL_SKIP, [{ mode: 'regex', text: '^(\\w+) spaulder$' }]);
  assert.equal(takeAllLeaves({ group: 'Armor', templateIndex: 5, material: ARMOR_MATERIAL.Leather, name: 'Right Spaulder' }), true, 'regex');
  assert.equal(nameLeaves({ name: 'Left Spaulder of Fire' }), false, 'the anchors hold');
  assert.deepEqual(skipList(), [{ mode: 'regex', text: '^(\\w+) spaulder$' }]);
  assert.equal(skipMatches({ mode: 'regex', text: '(' }, 'anything'), false, 'a bad pattern matches nothing');
  assert.equal(validSkipEntry({ mode: 'regex', text: '(' }), false);
  assert.equal(validSkipEntry({ mode: 'exact', text: '   ' }), false);
  assert.equal(validSkipEntry({ mode: 'fuzzy', text: 'x' }), false);
  assert.equal(validSkipEntry({ mode: 'contains', text: 'x'.repeat(61) }), false);
  setPref(QL_SKIP, 'garbage');
  assert.deepEqual(skipList(), [], 'a bad stored word reads as empty');
});

test('QUICK-LOOT-FILTER the old Take gear bar: a stored Magic+ or Rare+ is carried to the rarity boxes once and the bar set back to All, so no hidden setting leaves gear (mutants: carried twice; the bar left set; All touched)', () => {
  setPref('quickLootTier', 'rare');
  assert.equal(takeAllLeaves(sword(0, 'common')), true, 'the first ask carries it over: Common left');
  assert.equal(takeAllLeaves(sword(0, 'magic')), true, 'Magic too');
  assert.equal(takeAllLeaves(sword(0, 'rare')), false, 'Rare taken');
  _resetForTests(); resetPrefs(); _resetMigration();
  setPref('quickLootTier', 'magic');
  migrateQuickLootTier();
  assert.equal(takeAllLeaves(sword(0, 'common')), true);
  assert.equal(takeAllLeaves(sword(0, 'magic')), false, 'Magic+ only unticks Common');
  setPref(QL_RARITY_PREF('common'), true);   // the player ticks Common again
  assert.equal(takeAllLeaves(sword(0, 'common')), false, 'carried once - the box is the player\'s from then on');
  _resetMigration(); _resetForTests(); resetPrefs();
  migrateQuickLootTier();
  assert.equal(takeAllLeaves(sword(0, 'common')), false, 'All (the default) carries nothing');
});

test('QUICK-LOOT-FILTER the pick: a body whose plaque is down is no target - the ray passes to the next body of a pile - in the surface pools, by the real producer (mutants: the skip unread; a puppet\'s body hidden on a list it has not heard)', async () => {
  const { corpseLootTargets } = await import('../../src/scenes/corpseMarker.js');
  const { pickActivatableHit } = await import('../../src/player/activate.js');
  const lens = { isCorpse: (e) => e.dead, feetOf: (e) => e.feet };
  const iron = sword(WEAPON_MATERIALS.Iron), daedric = sword(WEAPON_MATERIALS.Daedric);
  const foes = [{ dead: true, feet: [0, 0, 3], items: [iron] }, { dead: true, feet: [0, 0, 6], items: [daedric] }, { dead: true, feet: [0, 0, 9], items: [], puppet: true }];
  const contents = (key) => foes[Number(key.split(':')[1])].items;
  const targets = () => corpseLootTargets(foes, 'foeCorpse', lens, (key) => bodyHidden(key, foes[Number(key.split(':')[1])].puppet ? null : contents(key)));
  const keyAt = () => pickActivatableHit([0, 0.3, 0], [0, 0, 1], targets(), { raycast: () => Infinity })?.key;   // no wall between
  assert.equal(keyAt(), 'foeCorpse:0', 'by default the nearest body');
  only(['Daedric']);
  setPref(QL_HIDE_DULL, true);
  assert.equal(keyAt(), 'foeCorpse:1', 'the iron body is no target: the ray goes on to the daedric one');
  setPref(QL_HIDE_EMPTY, true);
  foes[1].items = [];
  assert.equal(keyAt(), 'foeCorpse:2', 'an empty body too - and a puppet body whose list is not heard stays a target');
  assert.equal(bodyHidden('foeCorpse:2', null), false, 'an unheard list is never hidden');
  assert.equal(bodyHidden('foeCorpse:1', []), true);
});

test('QUICK-LOOT-FILTER the list: with "Filtered items inside the list" on, a body\'s plaque lists only what the take-all takes, the lit row IS the piece the take moves, an all-left pile says so and not "Empty", and a cupboard\'s glance is untouched (mutants: the take walking the full list; "Empty" over a full pile; a preview filtered)', () => {
  only(['Daedric']);
  const gold = { group: 'Currency', name: 'Gold Pieces', stackCount: 8 }, iron = sword(WEAPON_MATERIALS.Iron), daedric = sword(WEAPON_MATERIALS.Daedric);
  const hit = (key) => ({ key, distance: 1, reach: 3 });
  const named = { title: 'Stalwart Skeletal Warrior (dead)' };
  const frame = (key, items) => resolveHover(hit(key), { name: () => named, contents: () => items });
  const names = (f) => f.rows.map((r) => r.item);
  const pile = [gold, iron, daedric];
  assert.deepEqual(names(frame('foeCorpse:1', pile)), pile, 'by default every piece is listed');
  setPref(QL_HIDE_LEFT, true);
  assert.deepEqual(names(frame('foeCorpse:1', pile)), [gold, daedric], 'the iron piece the take-all would leave is not listed');
  assert.equal(hoverItemAt(pile, 1, Infinity), daedric, 'row 1 is the piece the take moves - not the iron one under it in the pack');
  assert.equal(hoverItemAt(pile, 0, Infinity), gold);
  assert.equal(hoverItemAt(pile, 2, Infinity), null, 'two rows');
  const dull = frame('foeCorpse:1', [iron, iron]);
  assert.deepEqual(dull.rows, [], 'no rows');
  assert.equal(dull.empty, false, 'a pile of left pieces is not an empty one');
  assert.ok(dull.subs.includes('Nothing you take'));
  assert.equal(frame('foeCorpse:1', [])?.empty, true, 'a really empty body still reads empty');
  assert.equal(frame('foeCorpse:1', [{ ...iron, junk: true }, daedric])?.rows.length, 1, 'junk leaves the list too');
  assert.deepEqual(hoverLines([iron, daedric], Infinity).shown.map((r) => r.item), [iron, daedric], 'a glance (a cupboard\'s peek) lists all of it');
  assert.deepEqual(frame('container:3', [iron, daedric])?.rows.map((r) => r.item) ?? [], [iron, daedric], 'a cupboard\'s peek is unfiltered');
  assert.equal(takeAllLeaves(iron), true, 'and the take-all still leaves it - the list only hides it');
});

test('QUICK-LOOT-FILTER off: with the Quick loot row off no plaque is hidden, no body is out of the pick and no row is dropped from a list - whatever the hiding switches say (mutants: hoverHidden ignores the row; hoverVisible ignores the row)', () => {
  const left = sword(WEAPON_MATERIALS.Iron);
  only(['Daedric']);
  for (const k of [QL_HIDE_EMPTY, QL_HIDE_DULL, QL_HIDE_DROPS, QL_HIDE_LEFT]) setPref(k, true);
  assert.equal(hoverHidden('foeCorpse:7', []), true, 'on: an empty body is hidden');
  assert.equal(hoverVisible([left]).length, 0, 'on: the row is dropped from the list');
  setPref('quickLoot', false);
  assert.equal(hoverHidden('foeCorpse:7', []), false, 'off: shown');
  assert.equal(hoverHidden('foeCorpse:7', [left, left]), false);
  assert.equal(hoverHidden('droppedLoot:2', [left]), false);
  assert.equal(bodyHidden('foeCorpse:7', [left]), false, 'off: the body stays in the pick');
  assert.deepEqual(hoverVisible([left]), [left], 'off: the list holds every row');
});

test('QUICK-LOOT-FILTER regex: a pattern that can stall the matcher is no pattern - a quantified group, a backreference, a lookaround (mutants: the group check dropped; the backreference check dropped; the lookaround check dropped; the name not cut)', () => {
  for (const bad of ['(a+)+$', '(a|aa)*b', '(a*)*', '(?:a+){2,}', '(a)\\1', '(?<x>a)\\k<x>', '(?=a)a', '(?!a)b', '(?<=a)b', '(?<!a)b', '(a|b)?c', 'helm(et)? of'])
    assert.equal(regexIsSafe(bad), false, `${bad} is refused`);
  for (const ok of ['^(\\w+) spaulder$', '^[a-z ]+ ring$', 'a{2,3}b', '\\(a+\\)+', '[(]+', 'sword|axe', 'helm(?:et|m) of', '(?:fire|frost) blade', '(?<n>fire) blade'])
    assert.equal(regexIsSafe(ok), true, `${ok} is allowed`);
  assert.equal(validSkipEntry({ mode: 'regex', text: '(a+)+$' }), false, 'the drawer will not add it');
  setPref(QL_SKIP, [{ mode: 'regex', text: '(a+)+$' }, { mode: 'regex', text: 'axe' }]);
  assert.deepEqual(skipList(), [{ mode: 'regex', text: 'axe' }], 'one stored by an earlier build is dropped from the list');
  const t0 = Date.now();
  assert.equal(skipMatches({ mode: 'regex', text: '(a+)+$' }, 'a'.repeat(60) + '!'), false, 'and matches nothing');
  assert.ok(Date.now() - t0 < 200, 'in no time');
  assert.equal(skipMatches({ mode: 'regex', text: 'z$' }, 'a'.repeat(300) + 'z'), false, 'a name is cut to NAME_MATCH_MAX before it is matched');
});

test('QUICK-LOOT-FILTER dungeon body: bodyTarget is a body whose skip follows the plaque - out of the pick when the list leaves nothing the take wants, in it otherwise, and the host\'s list read at each pick (mutants: the skip never true; the list read once)', () => {
  only(['Daedric']);
  setPref(QL_HIDE_DULL, true);
  let held = [sword(WEAPON_MATERIALS.Iron)];
  const t = bodyTarget('corpse:3', (key) => { assert.equal(key, 'corpse:3'); return held; });
  assert.equal(t.body, true);
  assert.equal(t.skip(), true, 'only a left piece: out of the pick');
  held = [sword(WEAPON_MATERIALS.Daedric)];
  assert.equal(t.skip(), false, 'the list changed: back in the pick');
  held = null;
  assert.equal(t.skip(), false, 'an unheard list is never hidden');
});
