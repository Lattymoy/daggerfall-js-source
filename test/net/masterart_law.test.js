// MASTER-ART (2026-10-27; bible/06-Systems/Professions-Arc.md section 57) - THE LAW OF A MASTER'S WORK, ALONE: which
// recipes take one, the lines a piece may be given, the refusals, the roll in the Legendary band (never past its top -
// POWER-CEILING), the catalysts' one table, the record's `l`, the mint, the item law and the item maker's refusal.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

import {
  MASTER_RANK, MASTER_LINES, MASTER_PROCS_MAX, MASTER_KINDS, MASTER_CATALYSTS, masterRecipe, masterOptions, masterLineOf, masterChoiceRefusal,
  masterBand, rollMasterLines, isMasterWork, masterSignature, masterGroupOf, masterTrackOf, masterDayOf,
  masterRecordLines, masterRecordLinesValid, masterLinesOfRecord, masterKeyOf,
} from '../../src/net/masterLaw.js';
import { RECIPES, recipeById, MASTERWORK, makerMark } from '../../src/net/recipeLaw.js';
import { HEARTWOOD, PEARL, ARCANE_ESSENCE, PROF_RANK_MAX, minedMaterial, NO_PACK_FORM } from '../../src/net/professionLaw.js';
import { haulFinds, treeFinds } from '../../src/net/nodeLaw.js';
import { mintProductRecord, readProductRecord, productRecordValid, PRODUCT_RECORD_MAX, MINT_V_MASTER, MINT_VERSION, masterLinesOf } from '../../src/net/productRecord.js';
import { AFFIX_RANGES, AFFIX_KINDS, affixesWorth } from '../../src/systems/loot/lootRarity.js';
import { mintPiece, asMinted } from '../../src/systems/smithItems.js';
import { itemFindings } from '../../src/systems/item/itemLaw.js';
import { keptEnchantments } from '../../src/systems/enchanting.js';
import { itemMakerFilter } from '../../src/ui/item/itemMakerWindow.js';
import { temperRefusal, reforgeEssence } from '../../src/net/temperLaw.js';
import { itemBaseValue } from '../../src/systems/item/itemTemplates.js';
import { salvageShards } from '../../src/systems/reforge.js';

const { subtle } = webcrypto;
const SWORD = recipeById('longsword:daedric');
const LINES = ['damage', 'stat:strength', 'elemental:fire'];
/** The lines as the service signs them at seed 4242 (AUDIT HORIZONTAL B1: rolled once, the values in the record). */
const SIGNED = masterRecordLines(rollMasterLines(SWORD, LINES, 4242));

test('MASTER-ART WHICH PIECES: every recipe of the nine kinds that wear a tier - the smith\'s weapons and armour, the workbench\'s staves and bows, the loom\'s leather and garments, the jeweller\'s pieces - but the Wand, which no slot takes; never a tool, kit, arrow, furniture, dish or siege work; at Master in its craft\'s track (mutants: a kind dropped; the Wand let in; the rank below Master)', () => {
  assert.deepEqual(MASTER_KINDS, ['weapon', 'staff', 'bow', 'plate', 'shield', 'chain', 'leather', 'garment', 'jewel']);
  assert.equal(MASTER_RANK, PROF_RANK_MAX);
  const taken = RECIPES.filter(masterRecipe);
  assert.equal(taken.length, 1076);   // PIN MOVED (SMITH-RRI): the Light Flail and the Archer's Axe at eleven metals
  assert.deepEqual([...new Set(RECIPES.filter((r) => MASTER_KINDS.includes(r.kind) && !masterRecipe(r)).map((r) => r.product))], ['wand'], 'the Wand alone, of the nine kinds');
  assert.deepEqual([...new Set(RECIPES.filter((r) => !MASTER_KINDS.includes(r.kind)).filter(masterRecipe))], []);
  assert.deepEqual(['dagger:iron', 'cuirass:steel', 'staff:pine', 'longbow:pine', 'leather-cuirass:cured', 'garment-141:linen', 'ring:silver'].map((id) => masterGroupOf(recipeById(id))),
    ['Weapons', 'Armor', 'Weapons', 'Weapons', 'Armor', 'MensClothing', 'Jewellery']);
  assert.deepEqual(['dagger:iron', 'staff:pine', 'leather-cuirass:cured', 'ring:silver'].map((id) => masterTrackOf(recipeById(id))), ['smithing', 'building', 'outfitting', 'smithing'], 'CRAFT3\'s merged tracks: a Ring\'s Smithing');
});

test('MASTER-ART THE LINES A PIECE MAY BE GIVEN are the ladder\'s for its group - every number, then every line that does something, each param the kind names on the piece; a garment\'s attribute Personality alone; never a technique (mutants: a proc offered as a number; the garment\'s every attribute; the technique let in)', () => {
  const keys = (id) => masterOptions(recipeById(id)).map((o) => o.key);
  const skills = Array.from({ length: 35 }, (_, i) => `skill:${i}`);
  const stats = ['strength', 'intelligence', 'willpower', 'agility', 'endurance', 'personality', 'speed', 'luck'].map((s) => `stat:${s}`);
  const resists = ['fire', 'frost', 'shock', 'poison', 'magic'].map((e) => `resist:${e}`);
  assert.deepEqual(keys('longsword:daedric'), ['damage', ...stats, ...skills, 'elemental:fire', 'elemental:frost', 'elemental:shock', 'leech', 'slayer:undead', 'slayer:daedra', 'slayer:humanoid', 'slayer:animal', 'castSpeed', 'potency']);
  assert.deepEqual(keys('cuirass:ebony'), ['armor', 'weight', ...stats, ...resists, ...skills, 'thorns']);
  assert.deepEqual(keys('ring:gold:ruby'), ['weight', ...stats, ...resists, ...skills, 'focus', 'castSpeed', 'potency', 'wellspring']);
  assert.deepEqual(keys('garment-141:linen'), ['stat:personality', ...skills, 'standing:commoners', 'standing:merchants', 'standing:scholars', 'standing:nobility', 'standing:underworld', 'warmth', 'dry']);
  assert.equal(masterOptions(recipeById('longsword:daedric')).filter((o) => o.proc).every((o) => AFFIX_KINDS[o.id].proc === true), true);
  assert.equal(keys('longsword:daedric').some((k) => k.startsWith('technique')), false);
  assert.deepEqual(masterLineOf(SWORD, 'skill:29'), { id: 'skill', param: 29, key: 'skill:29', proc: false });
  assert.deepEqual(masterOptions(recipeById('kit:iron')), []);
});

test('MASTER-ART A CHOICE IS REFUSED where the piece takes none, it is not three lines, a line is not the piece\'s, one is chosen twice, or more than one does something (mutants: the count read as at most three; a repeat let through; two effects let through)', () => {
  assert.deepEqual([MASTER_LINES, MASTER_PROCS_MAX], [3, 1]);
  const cases = [
    [recipeById('kit:iron'), LINES, 'recipe'], [SWORD, LINES.slice(0, 2), 'count'], [SWORD, [...LINES, 'leech'], 'count'], [SWORD, 'damage', 'count'],
    [SWORD, ['damage', 'armor', 'stat:strength'], 'line'], [SWORD, ['damage', 'stat:strength', 'stat:moxie'], 'line'], [SWORD, ['damage', 'stat:strength', 7], 'line'],
    [SWORD, ['damage', 'stat:strength', 'damage'], 'twice'], [SWORD, ['damage', 'leech', 'elemental:fire'], 'procs'], [SWORD, LINES, null],
    [SWORD, ['stat:strength', 'stat:agility', 'stat:speed'], null], [recipeById('garment-141:linen'), ['stat:strength', 'warmth', 'dry'], 'line'],
  ];
  for (const [r, lines, why] of cases) assert.equal(masterChoiceRefusal(r, lines), why, JSON.stringify(lines));
});

test('MASTER-ART THE ROLL: each line in its Legendary band off the seed, in the order chosen, the same for every client; over four thousand seeds every value lies in the band and each end is reached - no line past the band\'s top (POWER-CEILING) (mutants: the top past by one; the band\'s floor dropped; the Rare band read)', () => {
  const ring = recipeById('ring:gold:ruby');
  const lines = ['stat:luck', 'resist:magic', 'focus'];
  assert.deepEqual(rollMasterLines(ring, lines, 77), rollMasterLines(ring, lines, 77), 'one seed, one roll');
  assert.equal(rollMasterLines(ring, ['stat:luck', 'focus', 'wellspring'], 77), null, 'a refused choice rolls nothing');
  assert.equal(rollMasterLines(ring, lines, 1.5), null);
  for (const [r, ks] of [[SWORD, ['damage', 'skill:29', 'slayer:undead']], [ring, lines], [recipeById('garment-141:linen'), ['standing:nobility', 'warmth', 'dry']], [recipeById('cuirass:ebony'), ['armor', 'weight', 'thorns']]]) {
    const seen = ks.map(() => new Set());
    for (let seed = 0; seed < 4000; seed++) {
      const got = rollMasterLines(r, ks, seed * 2654435761 >>> 0);
      got.forEach((a, i) => {
        const [lo, hi] = AFFIX_RANGES[a.id].legendary;
        assert.ok(a.value >= lo && a.value <= hi, `${a.id} ${a.value} in [${lo}, ${hi}]`);
        seen[i].add(a.value);
      });
    }
    ks.forEach((k, i) => {
      const [lo, hi] = masterBand(masterLineOf(r, k).id);
      assert.deepEqual([Math.min(...seen[i]), Math.max(...seen[i])], [lo, hi], `${k} reaches both ends`);
    });
  }
  assert.deepEqual(masterBand('damage'), [20, 40]);
  assert.equal(masterSignature([{ id: 'damage', value: 31 }, { id: 'skill', param: 29, value: 22 }]), 'damage::31|skill:29:22');
  assert.equal(masterDayOf(86_400 * 3 + 5), 3);
});

test('MASTER-ART THE CATALYSTS ARE ONE TABLE, three pursuits: Logging\'s rarest find (Heartwood, on witnessed ground alone), the sea\'s own (a Pearl, a haul at sea alone) and Enchanting\'s Arcane Essence - each a registered material, a later one a row (mutants: a row\'s count moved; the Pearl found ashore)', () => {
  assert.deepEqual(MASTER_CATALYSTS.map((c) => ({ ...c })), [
    { key: HEARTWOOD.key, n: 2, pursuit: 'gathering' }, { key: PEARL.key, n: 3, pursuit: 'sea' }, { key: ARCANE_ESSENCE.key, n: 10, pursuit: 'enchanting' },
  ]);
  assert.equal(new Set(MASTER_CATALYSTS.map((c) => c.pursuit)).size, MASTER_CATALYSTS.length, 'every catalyst its own pursuit');
  for (const c of MASTER_CATALYSTS) assert.ok(minedMaterial(c.key), c.key);
  const always = () => 0;
  assert.equal(haulFinds({ sea: false, confirmed: true }, always).pearl, null, 'no Pearl from a river or a lake');
  assert.equal(haulFinds({ sea: true, confirmed: true }, always).pearl, PEARL.key, 'a Pearl at sea, on witnessed ground');
  assert.equal(treeFinds({ cuts: 4, confirmed: false }, always).heartwood, null, 'no Heartwood on unwitnessed ground');
  assert.equal(treeFinds({ cuts: 4, confirmed: true }, always).heartwood, HEARTWOOD.key);
  assert.ok(NO_PACK_FORM.includes(ARCANE_ESSENCE.key), 'the Essence stays in the Stores - its count is the service\'s alone');
});

test('MASTER-ART THE RECORD names the lines (`l`) only for a Masterwork at the master\'s mint version; AUDIT HORIZONTAL B1: it signs their values, `[kind, value]` or `[kind, value, param]`, held to their shape and never to today\'s pool; the widest the law signs still fits its bound (mutants: `l` on a Superior; on the craft\'s version; the bound back at 512 or 640; two lines let through; a line twice let through)', async () => {
  const base = { p: 'a1b2c3d4e5f60718', s: 'acct-0001', h: 'char-0001', r: SWORD.id, q: MASTERWORK, m: 'Mac', c: 4242, i: 1, v: MINT_V_MASTER, l: SIGNED };
  assert.deepEqual(SIGNED, [['damage', SIGNED[0][1]], ['stat', SIGNED[1][1], 'strength'], ['elemental', SIGNED[2][1], 'fire']]);
  assert.equal(productRecordValid(base), true);
  assert.equal(MINT_V_MASTER, MINT_VERSION + 1, 'the next mint version');
  assert.equal(productRecordValid({ ...base, q: 3 }), false);
  assert.equal(productRecordValid({ ...base, v: MINT_VERSION }), false);
  assert.equal(productRecordValid({ ...base, v: undefined }), false);
  assert.equal(productRecordValid({ ...base, l: undefined }), true, 'a Masterwork of the master\'s version without lines is the old shape');
  // the shape: three lines, each a kind's word, a whole value and a param (a word or a whole number) or none, none twice
  for (const l of [LINES, SIGNED.slice(0, 2), [...SIGNED, ['leech', 8]], [SIGNED[0], SIGNED[1], SIGNED[1]], [['damage', 31.5], SIGNED[1], SIGNED[2]],
    [['damage', '31'], SIGNED[1], SIGNED[2]], [['damage'], SIGNED[1], SIGNED[2]], [SIGNED[0], ['stat', 12, 'Str ength'], SIGNED[2]],
    [SIGNED[0], ['skill', 22, -1], SIGNED[2]], [SIGNED[0], ['stat', 12, 'strength', 1], SIGNED[2]], 'damage']) {
    assert.equal(productRecordValid({ ...base, l }), false, JSON.stringify(l));
  }
  assert.equal(masterRecordLinesValid([['damage', 31], ['skill', 22, 29], ['slayer', 25, 'undead']]), true, 'a skill\'s param a number');
  // the law of the day it was made was the service's: a line today's pool gives no sword is still the record's word
  assert.equal(masterChoiceRefusal(SWORD, ['armor', 'stat:strength', 'elemental:fire']), 'line');
  assert.equal(productRecordValid({ ...base, l: [['armor', 15], SIGNED[1], SIGNED[2]] }), true, 'history, not today\'s pool');
  const rec = await mintProductRecord({ ...base, i: undefined }, null, { subtle, nowS: 1 });
  assert.deepEqual(masterLinesOf(rec), SIGNED);
  assert.deepEqual(masterLinesOfRecord(masterLinesOf(rec)), rollMasterLines(SWORD, LINES, 4242), 'read back as the piece carries them');
  assert.deepEqual(masterLinesOfRecord(masterLinesOf(rec)).map(masterKeyOf), LINES, 'and the keys the station chose');
  assert.equal(masterLinesOf(await mintProductRecord({ ...base, l: null, i: undefined }, null, { subtle, nowS: 1 })), null);
  // the widest: the longest master recipe, its three widest lines at their bands' tops, the longest ids, and a mark of 32
  // three-byte letters (makerMark keeps them; it strips a control character)
  let worst = null;
  const wide = (o) => JSON.stringify(masterRecordLines([{ id: o.id, param: o.param, value: masterBand(o.id)[1] }])[0]).length;
  for (const r of RECIPES.filter(masterRecipe)) {
    const nums = masterOptions(r).filter((o) => !o.proc).sort((a, b) => wide(b) - wide(a)).slice(0, 3);
    const len = r.id.length + nums.reduce((n, o) => n + wide(o), 0);
    if (!worst || len > worst.len) worst = { len, r, nums };
  }
  assert.equal(masterChoiceRefusal(worst.r, worst.nums.map((o) => o.key)), null);
  const l = masterRecordLines(worst.nums.map((o) => ({ id: o.id, param: o.param, value: masterBand(o.id)[1] })));
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const widest = await mintProductRecord({ p: 'f'.repeat(16), s: 'S'.repeat(40), h: 'H'.repeat(64), r: worst.r.id, q: MASTERWORK, m: makerMark('中'.repeat(40)), c: 0xffffffff, a: true,
    u: worst.r.kind === 'garment' ? 9 : null, v: MINT_V_MASTER, l }, kp.privateKey, { subtle, nowS: 9_999_999_999 });
  assert.ok(widest.length > 640 && widest.length <= PRODUCT_RECORD_MAX, `${widest.length}`);
  assert.deepEqual(readProductRecord(widest).l, l, 'and read back whole');
  assert.equal(PRODUCT_RECORD_MAX, 704);
});

test('MASTER-ART THE MINT: a Master\'s record makes a Legendary of exactly its lines at the values it signs - its maker\'s mark its name, no record, no enchantment, its worth its lines\'; the same record without its lines makes the Masterwork it always did; the market takes it as minted; no temper, no Reforge, no item maker (mutants: the lines laid at another version; the Rare roll laid over them; a Legendary let into the item maker; AUDIT HORIZONTAL B1: the values read at today\'s band)', () => {
  const made = { recipe: SWORD.id, quality: MASTERWORK, seed: 4242, maker: 'Mac', marked: true, version: MINT_V_MASTER, lines: SIGNED };
  const sword = mintPiece(made, 'a1b2c3d4e5f60718');
  const lines = rollMasterLines(SWORD, LINES, 4242);
  assert.deepEqual([sword.rarity, sword.affixes, sword.legendary, sword.enchantments ?? [], sword.isIdentified], ['legendary', lines, undefined, [], true]);
  // AUDIT HORIZONTAL B1: the values are the record's, never the seed's roll under today's bands - a record signed under
  // another band (its values not what this seed rolls now) mints what it signed
  const signedElsewhere = [['damage', 23], ['stat', 11, 'strength'], ['elemental', 7, 'fire']];
  assert.notDeepEqual(masterLinesOfRecord(signedElsewhere), lines);
  assert.deepEqual(mintPiece({ ...made, lines: signedElsewhere }, 'a1b2c3d4e5f60718').affixes, [{ id: 'damage', value: 23 }, { id: 'stat', param: 'strength', value: 11 }, { id: 'elemental', param: 'fire', value: 7 }]);
  assert.equal(mintPiece({ ...made, lines: LINES }, 'a1b2c3d4e5f60718').rarity, 'rare', 'keys of no value are no Master\'s record: the Masterwork\'s Rare roll');
  assert.equal(sword.name, 'Longsword', 'a Masterwork\'s mark is its name (itemNameParts)');
  assert.equal(sword.value, itemBaseValue(sword) + affixesWorth(lines, sword));
  assert.equal(isMasterWork(sword), true);
  assert.equal(asMinted(sword), true);
  assert.deepEqual(itemFindings(sword), []);
  const plain = mintPiece({ ...made, lines: null }, 'a1b2c3d4e5f60718');
  assert.equal(plain.rarity, 'rare', 'no lines: the Masterwork\'s Rare roll');
  const before = mintPiece({ ...made, version: MINT_VERSION }, 'a1b2c3d4e5f60718');
  assert.equal(before.rarity, 'rare', 'lines on a record of the craft\'s version are not laid');
  const unmarked = mintPiece({ ...made, maker: null }, 'a1b2c3d4e5f60718');
  assert.match(unmarked.name, /^Slayer's Longsword of the Titan$/, 'no mark: the name its lines give, at the Legendary band');
  const gl = masterRecordLines(rollMasterLines(recipeById('garment-141:linen'), ['standing:nobility', 'warmth', 'dry'], 9));
  const garment = mintPiece({ recipe: 'garment-141:linen', quality: MASTERWORK, seed: 9, maker: 'Mac', version: MINT_V_MASTER, lines: gl, dye: 3 }, 'b1b2c3d4e5f60718');
  assert.deepEqual([garment.rarity, garment.affixes.map((a) => a.id), garment.dye], ['legendary', ['standing', 'warmth', 'dry'], 3], 'a garment\'s too, whatever the switch');
  assert.equal(temperRefusal(sword), 'rarity', 'no temper - law 7\'s tiers');
  assert.equal(salvageShards(sword), 0, 'no shards - a made piece breaks at the Enchanting Station alone');
  assert.equal(reforgeEssence(sword.rarity), null, 'no Reforge with Essence');
  assert.equal(keptEnchantments(sword), null, 'the item maker refuses a Legendary');
  assert.equal(itemMakerFilter(sword, 'WeaponsAndArmor'), false);
  assert.equal(itemMakerFilter(mintPiece({ ...made, lines: null }, 'c1b2c3d4e5f60718'), 'WeaponsAndArmor'), true, 'a Masterwork Rare still goes in (MAKER-RARE)');
});

test('MASTER-ART THE ITEM LAW holds a Master\'s work to its shape - a made Legendary of no record, a Masterwork, three lines in the Legendary band, one effect at most, nothing laid on after; a found Legendary keeps its record\'s law (mutants: the count unread; a line past the band let through; an enchantment let through; the quality unread)', () => {
  const sword = mintPiece({ recipe: SWORD.id, quality: MASTERWORK, seed: 4242, maker: 'Mac', marked: true, version: MINT_V_MASTER, lines: SIGNED }, 'a1b2c3d4e5f60718');
  const top = AFFIX_RANGES.damage.legendary[1];
  const cases = [
    [{}, []],
    [{ affixes: [{ id: 'damage', value: top + 1 }, ...sword.affixes.slice(1)] }, ['affixes', 'shape']],   // past every band: the field's own shape too
    [{ affixes: [{ id: 'damage', value: 19 }, ...sword.affixes.slice(1)] }, ['affixes']],
    [{ affixes: sword.affixes.slice(0, 2) }, ['legendary']],
    [{ affixes: [...sword.affixes, { id: 'leech', value: 8 }] }, ['legendary']],
    [{ affixes: [sword.affixes[0], { id: 'leech', value: 8 }, sword.affixes[2]] }, ['legendary']],
    [{ quality: 3 }, ['legendary']],
    [{ enchantments: [{ type: 1, param: 1 }] }, ['enchantments']],
    [{ exalted: true }, ['legendary']],
    [{ honed: 1 }, ['legendary']],
  ];
  for (const [over, want] of cases) assert.deepEqual(itemFindings({ ...sword, ...over }), want, JSON.stringify(over));
  const found = { ...sword, provenance: undefined, quality: undefined, maker: undefined, recipe: undefined };
  assert.deepEqual(itemFindings(found), ['legendary'], 'no provenance: a Legendary of no record is no Legendary at all');
});
