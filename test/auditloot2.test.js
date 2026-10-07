// AUDIT LOOT II (2026-10-07; bible/06-Systems/Loot-II-Arc.md section 15, "AUDIT LOOT II"; Mac: "Lets go all in. Rake
// your time and be as detailed as possible"): THE LOOT ARC II READ AGAIN before its merge - three cold reads (the laws
// and the balance; the windows and the hosts; the wire, the saves and the servers) beside the whole suite - and every
// finding that held fixed here, one block a finding, each driven through the real code:
//   A1 the Long Road's fall dead below ground (the dungeon billed its own);   A2 the Wayfarer's Robes chilled a cold night;
//   A4 a gem's line took a kind from the piece's own;   A5 the compare set a row a line against their whole;
//   A6 a curse's drawback undid a line of its piece;   A7 a line minted past the roll drew evenly over every skill;
//   A8 an Aetheric line and a rolled one made a body immune;   A9 the ladder off was not DFU (the cap's rank, the craft);
//   A10 every shirt filled the drought;   B1 (A3) a quest's gem set in a socket;   B2 the Scry page's rows unreadable;
//   B3 "Sell junk (1)" that sold nothing;   B4 an ask's question outlived it;   B5 the cap's note read a hidden line;
//   B6 the card compared a wear twice;   C1 a hone lost to the market;   C5 a sold piece still junk on the shelf.

import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import * as LR from '../src/systems/lootRarity.js';
import '../src/systems/lootPowers.js';   // the kit registers its folds at import - the robes' degrees among them
import * as RF from '../src/systems/reforge.js';
import { ENCHANTMENT_TYPES as T } from '../src/formats/magicDef.js';
import { CLIMATES } from '../src/formats/mapsFile.js';
import { mintCondition, setItemFields } from '../src/systems/itemTemplates.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { equipItem } from '../src/systems/equip.js';
import { computeEntityMods, entityResistMod } from '../src/systems/entityMods.js';
import { AETHERIC_RECORDS, mintAetheric } from '../src/systems/aetheric.js';
import { feltTemperature, wardrobeCtx } from '../src/systems/survival/temperature.js';
import { playerFallDamage, applyFallLanding, WARDROBE_FALL_MOST } from '../src/scenes/shared.js';
import { FALL_DAMAGE_THRESHOLD, FALL_HP_PER_METRE } from '../src/player/motor.js';
import { mintPiece, asMinted } from '../src/systems/smithItems.js';
import { MASTERWORK } from '../src/net/recipeLaw.js';
import { capLootList } from '../src/systems/foeLootCap.js';
import { POTION_TEMPLATE_INDEX } from '../src/systems/loot.js';
import { goldStack, isGoldPieces } from '../src/systems/inventory.js';
import { noteTaken, droughtOf, _setDroughtForTests } from '../src/systems/lootDrought.js';
import { mountEnhancedTrade } from '../src/ui/enhancedTrade.js';
import { mountReforgeWindow, EVERY_MAGIC_ASK, UNSET_ASK, GEMS_NONE } from '../src/ui/reforgeWindow.js';
import { REFORGE_CSS } from '../src/ui/enhancedPlusStyle.js';
import { lineCompareBlock, wearComparison } from '../src/ui/armourCard.js';
import { withDom } from './invdrag.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const on = () => { _resetForTests(); setPref('lootRarity', true); LR._setSocketForTests(null); LR._setCurseForTests(null); };
const off = () => { _resetForTests(); setPref('lootRarity', false); };
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const known = (it) => Object.assign(it, { isIdentified: true });
const sword = () => createWeapon(120, 1);
const garment = (templateIndex) => mintCondition({ group: templateIndex >= 182 ? 'WomensClothing' : 'MensClothing', templateIndex, name: 'garment', flags: 0, variant: 0 });
const jewel = (rarity, affixes) => known({ ...mintCondition({ group: 'Jewellery', templateIndex: 135, name: 'Ring', flags: 0 }), rarity, affixes });
const gem = (id) => mintCondition(setItemFields({ group: 'Gems', templateIndex: LR.GEM_IDS.indexOf(id) }));
const socketed = (seed) => { const it = known(LR.applyRarity(sword(), 'rare', lcg(seed))); it.socket = LR.SOCKET_EMPTY; return it; };
const player = (items = []) => ({ isPlayer: true, items, goldPieces: 0, stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, skills: new Array(35).fill(30), skillUses: new Array(35).fill(0), level: 5, career: {}, activeEffects: [], reactionMods: [0, 0, 0, 0, 0], health: 100, maxHealth: 100 });
const wear = (e, ...pieces) => { for (const p of pieces) { e.items.push(p); equipItem(e, p); } computeEntityMods(e); return e; };
const kids = (n, cls) => (n?.children ?? []).flatMap((c) => [...(c.classList?.contains(cls) ? [c] : []), ...kids(c, cls)]);
const one = (n, cls) => kids(n, cls)[0] ?? null;
const textOf = (n) => `${n.textContent ?? ''}${(n.children ?? []).map(textOf).join('')}`;
const press = { stopPropagation() {} };

test('AUDIT LOOT II A1: a player\'s fall is billed in one home - DFU\'s bill, the Long Road off it, below ground as above', () => {
  on();
  const walker = { isPlayer: true, _mods: {} }, pilgrim = { isPlayer: true, _mods: { fallLess: 50 } };
  for (const d of [6, 9.5, 14, 30]) {
    const dfu = Math.trunc(FALL_HP_PER_METRE * (d - FALL_DAMAGE_THRESHOLD));
    assert.equal(playerFallDamage(walker, d), dfu, `DFU's own at ${d} m`);
    assert.equal(playerFallDamage({ isPlayer: true }, d), dfu, 'nothing folded: DFU\'s');
    assert.equal(playerFallDamage(pilgrim, d), Math.trunc(FALL_HP_PER_METRE * (d - FALL_DAMAGE_THRESHOLD) * 0.5));
    assert.equal(playerFallDamage({ _mods: { fallLess: 400 } }, d), Math.trunc(FALL_HP_PER_METRE * (d - FALL_DAMAGE_THRESHOLD) * (1 - WARDROBE_FALL_MOST / 100)), 'at most its cap');
  }
  let billed = 0;
  applyFallLanding(pilgrim, 14, { hurt: (n) => { billed += n; }, sound: () => {} });
  assert.equal(billed, playerFallDamage(pilgrim, 14), 'the three hosts\' landing bills it');
  // the dungeon's own landing (dungeonContext.js reportActivity) reads it - before, it billed DFU's inline and the
  // Pilgrim's Sandals did nothing below ground
  const d = read('src/scenes/dungeonContext.js');
  const arm = d.slice(d.indexOf('if (fell > FALL_DAMAGE_THRESHOLD) {'));
  assert.match(arm.slice(0, 200), /const _fallDmg = playerFallDamage\(playerEntity, fell\);/);
  assert.equal(/FALL_HP_PER_METRE \* \(fell/.test(d), false, 'no bill of its own');
});

test('AUDIT LOOT II A2: a Legendary garment\'s degrees come off the felt number on their own side alone, never past comfortable - the Wayfarer\'s Robes never chill a cold night', () => {
  on();
  const COLD = { climateIndex: CLIMATES.Mountain, month: 0, hour: 2, weather: 'snow', insideBuilding: false };
  const HOT = { climateIndex: CLIMATES.Desert, month: 6, hour: 13, weather: 'sunny', insideBuilding: false, inSunlight: true };
  const felt = (env, ctx = {}, worn = null) => feltTemperature(env, worn, ctx).felt;
  assert.ok(felt(COLD) < -20 && felt(HOT) > 20, `${felt(COLD)}, ${felt(HOT)}`);
  assert.equal(felt(COLD, { heatDegrees: 20 }), felt(COLD), 'the heat\'s twenty in the cold: nothing');
  assert.equal(felt(HOT, { coldDegrees: 20 }), felt(HOT), 'the cold\'s in the heat: nothing');
  assert.equal(felt(HOT, { heatDegrees: 20 }), felt(HOT) - 20);
  assert.equal(felt(COLD, { coldDegrees: 20 }), felt(COLD) + 20);
  // never past comfortable: a heat under twenty is felt as none
  const r = [...Array(120).keys()].find((x) => { const f = felt(HOT, { fireResist: x }); return f > 0 && f < 20; });
  assert.ok(r !== undefined, 'a heat under twenty');
  assert.equal(felt(HOT, { fireResist: r, heatDegrees: 20 }), 0);
  // the real robes, worn, on the auditor's night: the outfit's own warmth is resisted as heat, so laid on the fire
  // resistance the robes' twenty cut it (the Alik'r at 02:00 in January: -33 read -45)
  const rec = LR.WARDROBE_LEGENDARIES.find((x) => x.id === 'alikr-robes');
  const robes = () => LR.applyRarity(garment(rec.templates[0]), 'legendary', () => 0, [rec]);
  const robed = wear(player(), robes()), twin = wear(player(), { ...robes(), legendary: null });
  const night = { climateIndex: CLIMATES.Desert, month: 0, hour: 2, weather: 'sunny', insideBuilding: false };
  const worn = (e, env) => felt(env, wardrobeCtx({}, e._mods), e.equip.slots);
  assert.ok(worn(twin, night) < 0, 'a desert night is cold');
  assert.equal(worn(robed, night), worn(twin, night), 'the robes leave it as it was');
  assert.equal(worn(robed, HOT), Math.max(0, worn(twin, HOT) - 20), 'and take their twenty off the noon');
});

test('AUDIT LOOT II B1 (A3): a quest\'s gem is never a loose gem - the Sockets page never offers it and the setting never takes it', () => {
  on();
  const questRuby = Object.assign(gem('ruby'), { questItem: true });
  const piece = socketed(3);
  const me = player([piece, questRuby]);
  me.goldPieces = 1000;
  assert.equal(RF.gemsHeld(me.items).ruby, 0);
  assert.equal(RF.setGemRefusal(piece, 'ruby', me), 'nogem');
  assert.deepEqual(RF.setGemPiece(piece, 'ruby', me), { ok: false, reason: 'nogem' });
  assert.equal(RF.takeGem(me.items, 'ruby'), false);
  assert.ok(me.items.includes(questRuby), 'the ruby its giver waits for stays');
  withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    const view = mountReforgeWindow(host, {
      page: 'sockets', items: () => me.items, payer: () => me, gold: () => me.goldPieces, picture: () => null, nameOf: (it) => it.name,
      reforge: () => ({ ok: false }), salvage: () => ({ ok: false }), setGem: (it, g) => RF.setGemPiece(it, g, me), unsetGem: (it) => RF.unsetGemPiece(it, me),
    });
    try { assert.ok(textOf(one(one(host, 'reforge-shell'), 'socket-card')).includes(GEMS_NONE), 'the page offers no gem'); } finally { view.unmount(); }
  });
  // a loose ruby beside it is the one taken
  const loose = gem('ruby');
  me.items.push(loose);
  assert.equal(RF.gemsHeld(me.items).ruby, 1);
  assert.equal(RF.setGemPiece(piece, 'ruby', me).ok, true);
  assert.deepEqual([me.items.includes(questRuby), me.items.includes(loose)], [true, false]);
});

test('AUDIT LOOT II A4: a gem\'s line takes no kind from the piece - a Rare blade\'s damage line reforges with a Diamond set, the gem\'s line standing', () => {
  on();
  let tried = 0;
  for (let seed = 1; seed < 80; seed++) {
    const it = socketed(seed);
    const idx = it.affixes.findIndex((a) => a.id === 'damage');
    if (idx < 0) continue;
    LR.setGem(it, 'diamond');
    const gemLine = it.affixes.at(-1);
    assert.deepEqual([gemLine.id, gemLine.gem], ['damage', 'diamond']);
    assert.ok(LR.reforgeableLines(it).includes(idx), 'the press offered');
    assert.ok(LR.reforgeAffix(it, idx, lcg(seed + 100)), `seed ${seed}: and it does what it offers`);
    assert.equal(it.affixes.at(-1), gemLine, 'the gem\'s line untouched');
    tried++;
  }
  assert.ok(tried >= 5, `${tried} blades with a damage line`);
});

test('AUDIT LOOT II A5: the line compare is a row a kind - a gem\'s line summed with the piece\'s own against what it replaces', () => {
  on();
  const worn = known(LR.applyRarity(sword(), 'rare', lcg(1)));
  worn.affixes = [{ id: 'damage', value: 13 }, { id: 'stat', param: 'strength', value: 4 }];
  const next = known(LR.applyRarity(sword(), 'rare', lcg(2)));
  next.affixes = [{ id: 'damage', value: 24 }, { id: 'damage', value: 6, gem: 'diamond' }];
  next.socket = 'diamond';
  const e = wear(player(), worn);
  e.items.push(next);
  const cmp = LR.lineComparison(e, next, [worn]);
  assert.equal(cmp.rows.length, 1, 'one row for the kind, never one a line');
  assert.equal(cmp.rows[0].delta, 17, '30 against 13 - up, where two rows read +11 and -7');
  assert.ok(cmp.rows[0].text.includes('30'), cmp.rows[0].text);
  assert.equal(cmp.lost.length, 1, 'the strength it would lose');
});

test('AUDIT LOOT II A6: a curse\'s drawback never undoes a line of its piece - a standing with the group it would sour, a slayer\'s against the kind it would weaken, its own reward line among them', () => {
  on();
  const BAD = LR.CURSE_DRAWBACKS.find((r) => r.type === T.BadRepWith), LOW = LR.CURSE_DRAWBACKS.find((r) => r.type === T.LowDamageVs);
  assert.deepEqual(LR.STANDING_GROUPS, ['commoners', 'merchants', 'scholars', 'nobility', 'underworld'], 'DFU\'s groups, in DFU\'s order');
  assert.deepEqual(LR.SLAYER_FOES, ['undead', 'daedra', 'humanoid', 'animal'], 'DFU\'s kinds, in DFU\'s order');
  const gown = known(LR.applyRarity(garment(195), 'rare', lcg(3)));
  gown.affixes = [{ id: 'standing', param: 'merchants', value: 4 }, { id: 'warmth', value: 3 }];
  assert.deepEqual(LR.curseParams(BAD, gown), [0, 2, 3, 4], 'never the Merchants');
  const blade = known(LR.applyRarity(sword(), 'rare', lcg(4)));
  blade.affixes = [{ id: 'damage', value: 12 }, { id: 'slayer', param: 'undead', value: 15 }];
  blade.enchantments = [];   // its flavour set aside - a Potent Vs is the old rule's
  assert.deepEqual(LR.curseParams(LOW, blade), [1, 2, 3], 'never the undead');
  let gowns = 0, blades = 0;
  for (let seed = 1; seed < 1500; seed++) {
    const g = LR.applyRarity(garment(195), 'rare', mulberry(seed));
    if (g.rarity === 'rare' && LR.cursePiece(g, mulberry(seed + 90000)) && g.cursed.type === T.BadRepWith) {
      gowns++;
      assert.ok(!g.affixes.some((a) => a.id === 'standing' && a.param === LR.STANDING_GROUPS[g.cursed.param]), `seed ${seed}: a gown's standing soured`);
    }
    const w = LR.applyRarity(sword(), 'rare', mulberry(seed));
    w.affixes = [...w.affixes, { id: 'slayer', param: LR.SLAYER_FOES[seed % 4], value: 15 }];
    if (LR.cursePiece(w, mulberry(seed + 90000)) && w.cursed.type === T.LowDamageVs) {
      blades++;
      assert.notEqual(w.cursed.param, seed % 4, `seed ${seed}: a blade's slayer weakened`);
    }
  }
  assert.ok(gowns > 30 && blades > 30, `${gowns} gowns, ${blades} blades soured where they could be`);
});

test('AUDIT LOOT II A7: a line minted past the roll leans as its rolled lines do - a cursed garment\'s skill to the street\'s, an Exalted garment\'s too; armour\'s Exalted line the even draw its seeded spoils keep', () => {
  on();
  const lean = (make, mint, kinOf) => {
    let kin = 0, all = 0;
    for (let seed = 1; seed < 6000 && all < 300; seed++) {
      const it = make(seed);
      if (!it) continue;
      const n = it.affixes.length;
      if (!mint(it, mulberry(seed + 70000)) || it.affixes.length !== n + 1 || it.affixes[n].id !== 'skill') continue;
      all++;
      if (kinOf(it).includes(it.affixes[n].param)) kin++;
    }
    return { kin, all };
  };
  const street = (g) => LR.skillKin(g).kin;
  const cursed = lean((s) => { const g = LR.applyRarity(garment(195), 'rare', mulberry(s)); return g.rarity === 'rare' ? g : null; }, LR.cursePiece, street);
  assert.ok(cursed.all >= 50 && cursed.kin / cursed.all > 0.6, `a cursed gown's skill the street's ${cursed.kin} in ${cursed.all} (an even draw: 7 in 35)`);
  // an Exalted garment's: a Legendary whose lines carry every kind but a skill (the six records carry one already, so
  // their Exalted line is another kind - a standing on the same lean when it is one)
  const recs = LR.WARDROBE_LEGENDARIES;
  const full = (s) => {
    const r = recs[s % recs.length];
    const g = LR.applyRarity(garment(r.templates[0]), 'legendary', () => 0, [r]);
    g.affixes = [{ id: 'warmth', value: 30 }, { id: 'dry', value: 45 }, { id: 'stat', param: 'personality', value: 12 }, ...LR.STANDING_GROUPS.map((p) => ({ id: 'standing', param: p, value: 6 }))];
    return g;
  };
  const exalted = lean(full, LR.exaltLegendary, street);
  assert.ok(exalted.all >= 100 && exalted.kin / exalted.all > 0.6, `an Exalted garment's skill the street's ${exalted.kin} in ${exalted.all}`);
  // armour's and jewellery's the even draw the seeded spoils keep (the gate's, a raid's, a serpent's exalt them through
  // lastPass): a cuirass's Exalted skill is the body's twelve about twelve times in thirty-five, never the lean's 85
  const cuirass = () => mintCondition({ group: 'Armor', templateIndex: 102, material: 0x0201, name: 'Cuirass', flags: 0 });
  const plated = lean((s) => LR.applyRarity(cuirass(), 'legendary', mulberry(s)), LR.exaltLegendary, (c) => LR.skillKin(c).kin);
  assert.ok(plated.all >= 100 && plated.kin / plated.all < 0.5, `a cuirass's ${plated.kin} in ${plated.all} - the even draw`);
});

test('AUDIT LOOT II A8: the cap is the gear\'s whole - the rolled lines fill to 45 beside an Aetheric piece\'s own and never past it; a line its arc set whole stands', () => {
  on();
  const rec = (id) => AETHERIC_RECORDS.find((r) => r.id === id);
  assert.equal(rec('oath-helm').affixes.find((a) => a.param === 'magic').value, 35);
  assert.equal(rec('ruhn-gate-shield').affixes.find((a) => a.param === 'magic').value, 50);
  const ring = () => jewel('rare', [{ id: 'resist', param: 'magic', value: 20 }]);
  const e = wear(player(), known(mintAetheric(rec('oath-helm'))), ring());
  assert.equal(entityResistMod(e, ['magic']), 45, 'the helm\'s 35 and ten of the ring\'s 20 - never the 55 that turned every Magic throw');
  assert.deepEqual(LR.rolledResistOf(e, 'magic'), { worn: 20, counts: 10 }, 'the card says so');
  const e2 = wear(player(), known(mintAetheric(rec('ruhn-gate-shield'))));
  assert.equal(entityResistMod(e2, ['magic']), 50, 'the Gate-Shield\'s 50, its arc\'s, whole');
  wear(e2, ring());
  assert.equal(entityResistMod(e2, ['magic']), 50, 'and no rolled line tops it up');
  assert.deepEqual(LR.rolledResistOf(e2, 'magic'), { worn: 20, counts: 0 });
  const e3 = wear(player(), ring(), ring());
  assert.equal(entityResistMod(e3, ['magic']), 40, 'rolled alone, under the cap, as they were');
});

test('AUDIT LOOT II A9: the ladder off is DFU exactly - a garment ranks at the cap as it always did and is made plain; a blade\'s eligibility its own', () => {
  const potion = { name: 'potion', group: 'UselessItems1', templateIndex: POTION_TEMPLATE_INDEX, potionRecipeKey: 4975678, value: 50 };
  const shirt = () => ({ ...garment(141), name: 'shirt', enchantments: [{ type: 0, param: 5 }], value: 300 });   // DFU's own magic shirt
  const capped = () => { const list = [shirt(), potion, goldStack(5)]; capLootList(list, 2); return list.map((i) => (isGoldPieces(i) ? 'gold' : i.name)); };
  const PROV = '0123456789abcdef';
  const made = () => mintPiece({ recipe: 'garment-155:wool', quality: MASTERWORK, seed: 5 }, PROV);
  off();
  try {
    assert.deepEqual(capped(), ['shirt', 'gold'], 'off: DFU\'s magic shirt over the potion, as before the arc');
    assert.equal(LR.rarityEligible(garment(155)), false);
    assert.equal(made().rarity, undefined, 'off: a Masterwork garment is DFU\'s');
    assert.equal(LR.rarityEligible(sword()), true, 'a blade\'s is its own, as it always was');
  } finally { on(); }
  assert.deepEqual(capped(), ['potion', 'gold'], 'on: LOOT14\'s rank - the supply over a Magic garment');
  assert.equal(LR.rarityEligible(garment(155)), true);
  assert.equal(made().rarity, 'rare');
});

test('AUDIT LOOT II A10: the drought counts a garment only if it could have been a Legendary - the mark cleared all the same', () => {
  on();
  _setDroughtForTests(0);
  try {
    const plainCut = Object.assign(garment(141), { untaken: true });
    assert.equal(LR.legendariesFor(plainCut).length, 0, 'no wardrobe Legendary is cut on it');
    assert.equal(noteTaken(plainCut), false);
    assert.equal(plainCut.untaken, undefined, 'the door\'s mark cleared');
    assert.equal(droughtOf(), 0);
    const robeCut = Object.assign(garment(155), { untaken: true });
    assert.ok(LR.legendariesFor(robeCut).length > 0);
    assert.equal(noteTaken(robeCut), true);
    assert.equal(droughtOf(), 1);
    assert.equal(noteTaken(Object.assign(sword(), { untaken: true })), true, 'a blade as ever');
    assert.equal(droughtOf(), 2);
  } finally { _setDroughtForTests(0); }
});

test('AUDIT LOOT II B2: the Scry page\'s rows read - a family\'s words over the picture column, its haunts whole', () => {
  assert.match(REFORGE_CSS, /\.broker-offer\.scry-row > \.broker-offer-body \{ grid-column: 1 \/ span 2; \}/);
  assert.match(REFORGE_CSS, /\.broker-offer\.scry-row \.broker-set \{ white-space: normal; \}/);
  on();
  withDom((dom) => {
    const me = player([]);
    const host = dom.mk('div');
    dom.body.append(host);
    const view = mountReforgeWindow(host, {
      page: 'scry', items: () => me.items, payer: () => me, gold: () => 0, picture: () => null, nameOf: (it) => it.name,
      reforge: () => ({ ok: false }), salvage: () => ({ ok: false }), scry: () => ({ ok: false }), scryWhere: () => null,
    });
    try {
      const rows = kids(one(host, 'reforge-shell'), 'scry-row');
      assert.ok(rows.length > 0);
      for (const r of rows) assert.ok(r.children[0].classList.contains('broker-offer-body'), 'its words first - the cell the rule spans');
    } finally { view.unmount(); }
  });
});

const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };
const tradeHooks = (mode, bag) => ({
  mode, shelfItems: () => [], packItems: () => bag, entity: { items: bag }, accepts: () => true, enchanted: () => true,
  priceCtx: () => ({ quality: 10, skills: { mercantile: 50, personality: 50 } }), gold: () => 100000,
  rows: (id) => [{ text: `#${id}`, center: true }], weight: () => ({ carriedWeightKg: 0, maxEncumbranceKg: 1e9 }),
  commit: () => {}, icons: ICONS, isEquipped: (it) => it?.equipSlot != null,
});

test('AUDIT LOOT II B3: Sell junk counts what it lays - a summoned piece marked junk is never counted, and alone offers no press', () => {
  on();
  const summoned = () => Object.assign(garment(155), { junk: true, timeForItemToDisappear: 4000 });
  withDom((dom) => {
    const a = Object.assign(sword(), { junk: true }), conjured = summoned();
    const bag = [a, conjured];
    const host = dom.mk('div');
    dom.body.append(host);
    const view = mountEnhancedTrade(host, tradeHooks('Sell', bag));
    try {
      const btn = () => host.querySelectorAll('.sell-junk')[0] ?? null;
      assert.equal(btn()?.textContent, 'Sell junk (1)', 'the one it lays');
      btn().onclick();
      assert.deepEqual(bag, [conjured], 'laid; the conjured robe stays');
      assert.equal(btn(), null);
    } finally { view.unmount(); }
  });
  withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    const view = mountEnhancedTrade(host, tradeHooks('Sell', [summoned()]));
    try { assert.equal(host.querySelectorAll('.sell-junk').length, 0, 'no press that does nothing'); } finally { view.unmount(); }
  });
});

test('AUDIT LOOT II B4: an ask let go takes its question with it - another page, another piece; any other word stays', () => {
  on();
  withDom((dom) => {
    const magic = (s) => known(LR.applyRarity(sword(), 'magic', lcg(s)));
    const me = player([magic(1), magic(2), magic(3)]);
    const host = dom.mk('div');
    dom.body.append(host);
    const view = mountReforgeWindow(host, { page: 'salvage', items: () => me.items, payer: () => me, gold: () => 0, picture: () => null, nameOf: (it) => it.name, reforge: () => ({ ok: false }), salvage: () => ({ ok: false }) });
    try {
      const shell = one(host, 'reforge-shell');
      const note = () => one(shell, 'broker-note');
      one(shell, 'every-magic').onclick(press);
      assert.equal(note().textContent, EVERY_MAGIC_ASK(3, 3));
      kids(shell, 'reforge-tab').find((t) => t.dataset.page === 'reforge').onclick(press);
      assert.equal(note().textContent, '', 'another page: the question gone');
      kids(shell, 'reforge-tab').find((t) => t.dataset.page === 'salvage').onclick(press);
      one(shell, 'every-magic').onclick(press);
      assert.equal(note().textContent, EVERY_MAGIC_ASK(3, 3));
      me.items.splice(1);   // the pack changed under it - two of the three gone
      view.repaint();
      assert.equal(note().textContent, '', 'an ask lapsed under it: its question drawn away the same render');
    } finally { view.unmount(); }
  });
  withDom((dom) => {
    const p1 = socketed(21), p2 = socketed(22);
    LR.setGem(p1, 'ruby');
    LR.setGem(p2, 'diamond');
    const me = player([p1, p2]);
    const host = dom.mk('div');
    dom.body.append(host);
    const view = mountReforgeWindow(host, {
      page: 'sockets', items: () => me.items, payer: () => me, gold: () => 0, picture: () => null, nameOf: (it) => it.name,
      reforge: () => ({ ok: false }), salvage: () => ({ ok: false }), setGem: () => ({ ok: false }), unsetGem: () => ({ ok: false }),
    });
    try {
      const shell = one(host, 'reforge-shell');
      const note = () => one(shell, 'broker-note');
      one(one(shell, 'socket-card'), 'unset-press').onclick(press);
      assert.equal(note().textContent, UNSET_ASK('ruby'));
      kids(shell, 'socket-row')[1].onclick(press);
      assert.equal(note().textContent, '', 'another piece: the question gone');
    } finally { view.unmount(); }
  });
});

test('AUDIT LOOT II B5: the cap\'s note reads the pieces the wearer knows - a worn piece not yet identified is set aside, its points still folded', () => {
  on();
  const hidden = { ...jewel('rare', [{ id: 'resist', param: 'fire', value: 25 }]), enchantments: [{ type: 0, param: 5 }], isIdentified: false };
  const e = wear(player(), hidden, jewel('rare', [{ id: 'resist', param: 'fire', value: 15 }]));
  assert.deepEqual(LR.rolledResistOf(e, 'fire'), { worn: 15, counts: 15 }, 'the known ring\'s alone');
  assert.equal(entityResistMod(e, ['fire']), 40, 'the fold reads both, as it always did');
});

test('AUDIT LOOT II B6: the card makes one comparison for both its blocks, and the line block none with the ladder off', () => {
  on();
  const cuirass = () => mintCondition({ group: 'Armor', templateIndex: 102, material: 0x0201, name: 'Cuirass', flags: 0 });
  const worn = known(LR.applyRarity(cuirass(), 'rare', lcg(5)));
  const next = known(LR.applyRarity(cuirass(), 'rare', lcg(6)));
  const e = wear(player(), worn);
  e.items.push(next);
  withDom(() => {
    assert.ok(lineCompareBlock(e, next, wearComparison(e, next)), 'the comparison handed in');
    assert.equal(lineCompareBlock(e, next, { replaces: [], parts: [] }), null, 'and read: a wear that replaces nothing has no lines to set');
    off();
    try {
      const untouched = { get replaces() { throw new Error('compared with the ladder off'); } };
      assert.equal(lineCompareBlock(e, next, untouched), null, 'off: none, and nothing compared');
    } finally { on(); }
  });
  const card = read('src/ui/enhancedInventory.js');
  assert.equal((card.match(/wearComparison\(/g) ?? []).length, 1, 'one comparison a card');
  assert.match(card, /compareBlock\(deps\.entity, picked, \(it\) => itemLongName\(it, \{ getQuest: deps\.getQuest \?\? null \}\), wear\)/);
});

test('AUDIT LOOT II C1: a honed made piece is no longer what its record mints - the market carries it whole, never minted back to its roll', () => {
  on();
  const mw = mintPiece({ recipe: 'longsword:mithril', quality: MASTERWORK, seed: 9, maker: 'Silverthorn' }, '0123456789abcdef');
  assert.equal(mw.rarity, 'rare');
  assert.equal(asMinted(mw), true, 'as made');
  const i = LR.honeableLines(mw)[0];
  assert.ok(LR.honeAffix(mw, i, lcg(1)));
  assert.equal(mw.honed, 1);
  assert.equal(asMinted(mw), false, 'honed: the record mints the roll, not the hone');
});

test('AUDIT LOOT II C5: a sold piece\'s junk mark ends at the shelf - both of the host\'s sales', () => {
  const wm = read('src/scenes/worldModes.js');
  const pushes = [...wm.matchAll(/shelf\.items\.push\(it\);[^\n]*\n\s*setJunk\(it, false\);/g)];
  assert.equal(pushes.length, 2, 'the counter\'s sale and the keyed shelf\'s');
  assert.match(wm, /import \{ setJunk \} from '\.\.\/systems\/itemJunk\.js';/);
});
