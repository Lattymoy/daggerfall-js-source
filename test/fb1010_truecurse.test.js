// FIELD BUGS 2026-10-10 (bible/01-Overview/Field-Bugs-2026-10-10.md), TRUE-CURSE - the Discord's "True cursed item
// experience": "a super powerful sword that drains a ton of your hp ... cannot have their curse lifted". A DAMNED piece:
// one cursed Legendary weapon in DAMNED_IN, its curse line at the very top of its band, its drawback DFU's Health Leech:
// Whenever Used (8 health a strike, 16 a use), and no temple lifts it. Taking it off ends the bite, as any curse's.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import * as LR from '../src/systems/lootRarity.js';
import { liftRefusal, liftCurse, cursedKnown } from '../src/systems/lootCurse.js';
import { ENCHANTMENT_TYPES } from '../src/formats/magicDef.js';
import { mintCondition } from '../src/systems/itemTemplates.js';
import { PAYLOAD, doItemEnchantmentPayloads, LEECH_WEAPON_AMOUNT } from '../src/systems/enchantments.js';
import { itemFindings } from '../src/systems/itemLaw.js';
import { validLootItem } from '../src/systems/loot.js';
import { LIFT_REFUSALS, reforgeLabel, mountReforgeWindow } from '../src/ui/reforgeWindow.js';
import { hurtPlayer } from '../src/characters/playerEntity.js';
import { withDom } from './invdrag.mjs';
import { seedTestLoot } from '../src/systems/testRoom.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { readFileSync } from 'node:fs';

const T = ENCHANTMENT_TYPES;
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const on = () => { _resetForTests(); setPref('lootRarity', true); LR._setCurseForTests(null); LR._setExaltedForTests(null); };
const WEAPON = LR.LEGENDARIES.find((r) => r.group === 'Weapons');
const ARMOUR = LR.LEGENDARIES.find((r) => r.group === 'Armor');
const known = (it) => Object.assign(it, { isIdentified: true });
/** A Legendary of the record, CHOSEN through the door (applyRarity's one-record pool, as the Test Room mints them). */
const legendaryWeapon = () => LR.applyRarity(createWeapon(120, 1), 'legendary', () => 0, [WEAPON]);
const legendaryArmour = () => LR.applyRarity(mintCondition({ group: 'Armor', templateIndex: ARMOUR.templates?.[0] ?? 102, material: 0x0201, name: 'Cuirass', flags: 0 }), 'legendary', () => 0, [ARMOUR]);
/** Every draw `v`. */
const all = (v) => () => v;
const lineBand = (it) => LR.AFFIX_RANGES[it.affixes.at(-1).id].legendary;

test('TRUE-CURSE: the damning\'s pass damns a cursed Legendary weapon whose draw falls in the top quarter - its curse line raised to the top of its band, its worth with it, Health Leech: Whenever Used in the drawback\'s place', () => {
  on();
  assert.equal(LR.DAMNED_IN, 4);
  const cursed = () => { const it = legendaryWeapon(); assert.equal(LR.cursePiece(it, all(0.5)), true); return it; };
  const it = cursed();
  const before = { line: { ...it.affixes.at(-1) }, value: it.value, n: it.enchantments.length, own: it.enchantments.slice(0, -1) };
  assert.deepEqual(LR.damnPass([it], all(0.75)), [it]);
  assert.deepEqual(it.cursed, { type: T.HealthLeech, param: 0 });
  assert.equal(LR.isDamned(it), true);
  assert.equal(it.affixes.at(-1).id, before.line.id, 'the curse\'s own line');
  assert.equal(it.affixes.at(-1).value, lineBand(it)[1], 'at the very top of its band');
  assert.equal(it.value, before.value - LR.affixesWorth([before.line], it) + LR.affixesWorth([it.affixes.at(-1)], it), 'its worth with it');
  assert.deepEqual(it.enchantments, [...before.own, { type: T.HealthLeech, param: 0 }], 'the drawback in the curse\'s place, its own enchantment kept');
  assert.deepEqual(LR.damnPass([it], all(0.99)), [], 'never twice');
  assert.deepEqual(LR.damnPass([cursed()], all(0.74)), [], 'below the top quarter: a curse as LOOT16\'s');
  for (const make of [() => { const a = legendaryArmour(); LR.cursePiece(a, all(0.5)); return a; },
    () => { const r = LR.applyRarity(mintCondition({ group: 'Weapons', templateIndex: 116, material: 0, name: 'Shortsword', flags: 0 }), 'rare', all(0.75)); LR.cursePiece(r, all(0.5)); return r; },
    () => legendaryWeapon()]) {
    const piece = make();
    assert.deepEqual(LR.damnPass([piece], all(0.99)), [], `${piece.rarity} ${piece.group}${LR.isCursed(piece) ? '' : ' uncursed'}: never damned - a cursed Legendary weapon alone`);
  }
  const plain = legendaryWeapon();
  LR.cursePiece(plain, all(0.99));
  assert.equal(LR.isDamned(plain), false, 'the curse itself never damns: its draws are LOOT16\'s');
  const forced = legendaryWeapon();
  LR.cursePiece(forced, all(0), { damned: true });
  assert.equal(LR.isDamned(forced), true, 'the caller may damn it (the Test Room)');
  _resetForTests(); setPref('lootRarity', false);
  assert.deepEqual(LR.damnPass([cursed()], all(0.99)), [], 'off: nothing damned');
});

test('TRUE-CURSE: one cursed Legendary weapon in four, over the pass\'s own draws', () => {
  on();
  LR._setCurseForTests(1);
  let damned = 0, n = 0, a = 7;
  const mulberry = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = 0; i < 4000; i++) {
    const it = legendaryWeapon();
    if (!LR.cursePass([it], mulberry).length) continue;
    n++;
    if (LR.damnPass([it], mulberry).length) damned++;
  }
  LR._setCurseForTests(null);
  assert.ok(n > 3900, 'every pass cursed');
  assert.ok(Math.abs(damned / n - 1 / LR.DAMNED_IN) < 0.03, `a quarter damned (${damned} of ${n})`);
});

test('TRUE-CURSE (AUDIT FB1010 E3): the damning is each door\'s LAST draw (law 9) - after the curse\'s, the socket\'s and the late finds\' - so every other draw a door makes is the one it made before', () => {
  const lr = read('src/systems/lootRarity.js');
  const door = lr.slice(lr.indexOf('export function rollLootRarity'), lr.indexOf('\n}\n', lr.indexOf('export function rollLootRarity')));
  assert.match(door, /items\.push\(\.\.\.\(_gemFind\?\.\(\{ \.\.\.source, luck \}, rolls\) \?\? \[\]\)\);[^\n]*\n  damnPass\(minted, rolls\);[^\n]*\n  return items;$/, 'the loot door: last of all, after GEM2\'s gem find');
  assert.ok(door.indexOf('rollLateFinds(') < door.indexOf('weaponSocketPass(') && door.indexOf('weaponSocketPass(') < door.indexOf('damnPass('), '...after the late finds and GEM1\'s weapon sockets');
  const kit = read('src/systems/foeLootCap.js');
  assert.match(kit, /weaponSocketPass\(kit, opts\.rolls \?\? Math\.random\);[^\n]*\n  damnPass\(kit, opts\.rolls \?\? Math\.random\);[^\n]*\n  return kit;/, 'a body\'s kit: last of all, after GEM1\'s weapon sockets');
  assert.doesNotMatch(lr.slice(lr.indexOf('export function cursePiece'), lr.indexOf('export function damnPiece')), /DAMNED_IN/, 'the curse draws nothing for the damning');
});

test('TRUE-CURSE: the law stands behind a damned Legendary weapon, and behind no other piece carrying its row', () => {
  on();
  const damned = legendaryWeapon();
  LR.cursePiece(damned, all(0.9), { damned: true });
  assert.equal(LR.validCurse(damned), true);
  assert.ok(validLootItem(damned), 'a door\'s piece');
  assert.deepEqual(itemFindings(damned), [], 'the item law (online, and the account service) finds nothing');
  const onArmour = legendaryArmour();
  LR.cursePiece(onArmour, all(0.5));
  Object.assign(onArmour, { cursed: { type: T.HealthLeech, param: 0 }, enchantments: [...onArmour.enchantments.filter((e) => e !== onArmour.cursed), { type: T.HealthLeech, param: 0 }] });
  assert.equal(LR.validCurse(onArmour), false, 'a damned row on armour is no curse the pass makes');
  const bare = { ...damned, enchantments: damned.enchantments.filter((e) => !(e.type === T.HealthLeech && e.param === 0)) };
  assert.equal(LR.validCurse(bare), false, 'a damned mark with no bite carried');
});

test('TRUE-CURSE: it bites every blow - the wielder pays 8 health a strike - and no temple lifts it; known, it is "Damned Legendary"', () => {
  on();
  const damned = legendaryWeapon();
  LR.cursePiece(damned, all(0.9), { damned: true });
  let bitten = 0;
  doItemEnchantmentPayloads(PAYLOAD.Strikes, damned, { entity: { isPlayer: true }, target: { mobileType: 0 }, damage: 20, ctx: { hurtSelf: (n) => { bitten += n; } } });
  assert.equal(bitten, LEECH_WEAPON_AMOUNT);
  assert.equal(LEECH_WEAPON_AMOUNT, 8, 'HealthLeech.cs:30');
  const payer = { isPlayer: true, items: [damned], goldPieces: 1_000_000 };
  assert.equal(liftRefusal(damned, payer), 'unknown', 'unknown, it is said to be nothing');
  assert.equal(LR.tierLabel(damned), 'Legendary');
  known(damned);
  assert.equal(LR.tierLabel(damned), 'Damned Legendary');
  assert.deepEqual(cursedKnown(payer.items), [damned], 'the temple sees it...');
  assert.equal(liftRefusal(damned, payer), 'damned', '...and will not lift it');
  assert.deepEqual(liftCurse(damned, payer), { ok: false, reason: 'damned' });
  assert.equal(LR.isDamned(damned), true, 'the curse stands');
  assert.equal(payer.goldPieces, 1_000_000, 'and nothing is taken');
  assert.equal(LIFT_REFUSALS.damned, 'Damned - no temple can lift this curse');
  assert.equal(reforgeLabel('damned', { shards: 0, gold: 0 }, { shards: 0, gold: 0 }, 'Lift'), 'Damned');
  const plain = known(legendaryWeapon());
  LR.cursePiece(plain, all(0.5));
  assert.equal(LR.tierLabel(plain), 'Cursed Legendary', 'a curse as LOOT16\'s keeps its word');
  assert.equal(liftRefusal(plain, payer), null, 'and the temple lifts it');
});

test('TRUE-CURSE: the Test Room lays a damned Legendary weapon, known, after every draw it made - its cursed Legendary stays LOOT16\'s', () => {
  on();
  const entity = { items: [], equipTable: {} };
  seedTestLoot(entity, all(0.9));
  const damned = entity.items.filter((it) => LR.isDamned(it));
  assert.equal(damned.length, 1);
  assert.equal(damned[0].group, 'Weapons');
  assert.equal(LR.tierLabel(damned[0]), 'Damned Legendary', 'known');
  assert.equal(entity.items.at(-1), damned[0], 'last');
  assert.ok(entity.items.some((it) => LR.isCursed(it) && it.rarity === 'legendary' && !LR.isDamned(it)), 'the cursed Legendary beside it');
});

test('TRUE-CURSE (AUDIT FB1010 D1): on the arena\'s sand the bite holds the wielder at 1, as every blow there - both hosts\' enchantment sinks hand the bout\'s spare to the one damage door', () => {
  on();
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const src = read(host);
    const ctx = src.slice(src.indexOf('setDefaultEnchantCtx(createEnchantCtx({'));
    assert.match(ctx.slice(0, ctx.indexOf('playerSpellSinks')), /hurt: \(n\) => \{ if \(n > 0\) hurtPlayer\(playerEntity, n, arenaBouts\.playerSpare\(\) \?\? \{\}\); \},/, `${host}: the bout's spare`);
  }
  // the door the sinks reach, with a live bout's spare: a damned blade's strike at 8 health leaves 1, and the bout hears it
  const damned = legendaryWeapon();
  LR.cursePiece(damned, all(0.5), { damned: true });
  const me = { isPlayer: true, health: 8, maxHealth: 50 };
  let fell = 0;
  const spare = { spare: () => { fell++; } };
  doItemEnchantmentPayloads(PAYLOAD.Strikes, damned, { entity: me, target: { mobileType: 0 }, damage: 20, ctx: { hurtSelf: (n) => hurtPlayer(me, n, spare) } });
  assert.deepEqual([me.health, fell], [1, 1], 'held at the breath of life, the fall the bout\'s');
});

test('TRUE-CURSE (AUDIT FB1010 D2): the temple\'s page shows a damned piece with no price and its press refused - "Damned"', () => {
  on();
  withDom((dom) => {
    const damned = known(legendaryWeapon());
    LR.cursePiece(damned, all(0.5), { damned: true });
    const me = { isPlayer: true, items: [damned], goldPieces: 100000 };
    const host = dom.mk('div');
    dom.body.append(host);
    const view = mountReforgeWindow(host, {
      pages: ['lift'], page: 'lift', items: () => me.items, payer: () => me, gold: () => me.goldPieces, picture: () => null, nameOf: (it) => it.name,
      reforge: () => ({ ok: false }), salvage: () => ({ ok: false }), lift: (it) => liftCurse(it, me),
    });
    try {
      const all2 = (n, cls) => { const out = []; const walk = (x) => { for (const c of x.children ?? []) { if (String(c.className ?? '').split(/\s+/).includes(cls)) out.push(c); walk(c); } }; walk(n); return out; };
      const [row] = all2(host, 'lift-row');
      assert.ok(row, 'the temple sees it');
      assert.equal(all2(row, 'broker-set')[0].textContent, `Damned Legendary · ${LR.curseLine(damned)}`);
      assert.equal(all2(row, 'broker-price')[0].textContent, '-', 'no price for what no temple lifts');
      const press = all2(row, 'lift-press')[0];
      assert.deepEqual([press.textContent, press.attrs.disabled, press.attrs.title], ['Damned', '', LIFT_REFUSALS.damned]);
    } finally { view.unmount(); }
  });
});
