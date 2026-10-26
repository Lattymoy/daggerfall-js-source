// CRAFT-WRITS (2026-10-22) - THE LAW OF THE GUILDS' ASKS OF A CRAFTER (src/net/craftWritLaw.js): what a writ may ask and
// who asks it, the day's three drawn within a character's ranks, the pay its goods' cost earns, the goods a pack gives
// (the plain bottles before the Potent, a crafted piece by its provenance) and the card's words.
// bible/06-Systems/Professions-Arc.md section 49.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CRAFT_WRITS_PER_DAY, CRAFT_WRIT_SLOTS, CRAFT_PAY_PCT, CRAFT_PAY_FLOOR, CRAFT_WRIT_PAY_MAX, NOVICE_YIELD, CRAFT_KINDS, CRAFT_GUILDS, WRIT_POTIONS, WRIT_KITS,
  craftProductOf, craftWritBaseQty, craftWorth, craftWritXp, craftWritRenown, craftWritOf, craftWritId, CRAFT_WRIT_ID_RE, craftWritChoices, craftWritsFor,
  pieceAnswers, writPotionKey, craftGoodsPick, craftGoodsHeld, takeCraftGoods, craftCountText, craftGuildName, craftNeedText, craftMadeText, craftPayText,
  craftHeldText, craftShortText, craftFilledText, CRAFT_WRIT_QTY_MAX, CRAFT_WRIT_SEED_RE,
} from '../../src/net/craftWritLaw.js';
import { POTIONS, potionById, brewCount } from '../../src/net/alchemyLaw.js';
import { MARKS_FAUCETS, MARKS_KINDS } from '../../src/net/marksLaw.js';
import { renownRate } from '../../src/net/renown.js';
import { writXp } from '../../src/net/professionLaw.js';
import { DIVINES, GUILD_FACTION_IDS } from '../../src/systems/guild/guildFactions.js';
import { GROUP_TEMPLATE_INDICES } from '../../src/systems/item/itemTemplatesData.js';

const BOTTLE = GROUP_TEMPLATE_INDICES.UselessItems1[1];

test('CRAFT-WRITS law: the numbers - three a day an account (the faucet\'s own cap), three drawn an account a day, half again its gathered goods\' cost, 20 a tier at least, 200 at most; a Novice\'s brew two (alchemyLaw\'s own), a dish one, a kit one; Provisioning makes potions and dishes, Smithing kits; a `craft-writ` line a mint (mutants: the share; the floor; the cap; the yield - the day\'s counts held by this deepEqual alone, AUDIT CRAFT-WRITS T5)', () => {
  assert.deepEqual([CRAFT_WRITS_PER_DAY, MARKS_FAUCETS.craftWrit, CRAFT_WRIT_SLOTS, CRAFT_PAY_PCT, CRAFT_PAY_FLOOR, CRAFT_WRIT_PAY_MAX], [3, { perDay: 3 }, 3, 150, 20, 200]);
  assert.deepEqual({ ...NOVICE_YIELD }, { potion: 2, dish: 1, kit: 1 });
  assert.equal(NOVICE_YIELD.potion, brewCount(0), 'the yield the pay counts is the Novice brew\'s own');
  assert.deepEqual({ ...CRAFT_KINDS }, { potion: 'provisioning', dish: 'provisioning', kit: 'smithing' });
  assert.equal(MARKS_KINDS['craft-writ'], 'mint');
  assert.equal(craftWritXp(156), writXp(156), 'twice the pay, the Court writ\'s own law');
  assert.equal(craftWritRenown(156), renownRate(312));
});

test('CRAFT-WRITS law: the potions a writ asks - DFU\'s twenty less the two made wholly of the Apothecaries\' goods (Water Breathing, Levitation: silver in, silver out); every kit of a metal something yields - never the Daedric, AUDIT CRAFT-WRITS E4 (mutants: the counter\'s two let in; the unyielded let in)', () => {
  assert.deepEqual(POTIONS.filter((p) => !WRIT_POTIONS.includes(p)).map((p) => p.id), ['waterBreathing', 'levitation']);
  assert.equal(craftProductOf('potion:levitation'), null);
  assert.deepEqual(WRIT_KITS.map((r) => r.id), ['kit:iron', 'kit:steel', 'kit:silver', 'kit:moonstone', 'kit:dwarven', 'kit:mithril', 'kit:adamantium', 'kit:ebony', 'kit:orichalcum']);
  for (const bad of [null, 'potion:', 'potion:nothing', 'dish:bread', 'kit:wood', 'kit:daedric', 'longsword:steel', 42]) assert.equal(craftProductOf(bad), null, String(bad));
});

test('CRAFT-WRITS law: who asks - the Mages Guild most potions, the Temple of Stendarr the five remedies, the Fighters Guild Orc Strength, Stamina, the stew, the supper and the kits, the Temple of Mara the tart and the feast; named as a hall writ names them (mutants: a guild moved)', () => {
  const by = (keys) => keys.map((k) => craftGuildName(/** @type {any} */ (craftProductOf(k)).faction));
  assert.deepEqual(by(['potion:healing', 'potion:healTrue', 'potion:cureDisease', 'potion:curePoison', 'potion:purification']), Array(5).fill('Temple of Stendarr'));
  assert.deepEqual(by(['potion:orcStrength', 'potion:stamina', 'dish:stew', 'dish:supper', 'kit:steel']), Array(5).fill('Fighters Guild'));
  assert.deepEqual(by(['dish:tart', 'dish:feast']), ['Temple of Mara', 'Temple of Mara']);
  assert.deepEqual(by(['potion:restorePower', 'potion:resistFire', 'potion:invisibility', 'potion:freeAction']), Array(4).fill('Mages Guild'));
  assert.deepEqual([CRAFT_GUILDS.potionDefault, CRAFT_GUILDS.kit, CRAFT_GUILDS.dish.feast, CRAFT_GUILDS.potion.healing], [GUILD_FACTION_IDS.MagesGuild, GUILD_FACTION_IDS.FightersGuild, DIVINES.Mara, DIVINES.Stendarr]);
});

test('CRAFT-WRITS law: THE PAY TABLE - every product\'s writ, its count fitted under 200 (potions 4/3/2 by tier, dishes 3 and the feast 1, kits 3/2/1), its pay its goods\' cost over a Novice\'s yield - the gathered half again, the counter\'s at cost (AUDIT CRAFT-WRITS E2) - never under 20 a tier, the floor most writs pay: Restore Power four for 108, Healing four for 32, Purification two for 140, a feast for 120, three stews for 20 (mutants: the share; the counter at cost; the yield; the floor; the cap; the counts; the count\'s bound)', () => {
  const table = (keys) => keys.map((k) => { const w = /** @type {any} */ (craftWritOf(k)); return [k, w.tier, w.qty, w.pay]; });
  assert.deepEqual(table(WRIT_POTIONS.map((p) => `potion:${p.id}`)), [
    ['potion:resistFire', 2, 4, 68], ['potion:resistFrost', 2, 4, 40], ['potion:resistShock', 2, 4, 40], ['potion:resistPoison', 4, 3, 80],
    ['potion:slowFalling', 3, 3, 60], ['potion:chameleonForm', 5, 2, 100], ['potion:invisibility', 6, 2, 120], ['potion:shadowForm', 5, 2, 100],
    ['potion:cureDisease', 3, 3, 60], ['potion:purification', 7, 2, 140], ['potion:curePoison', 5, 2, 100], ['potion:orcStrength', 1, 4, 21],
    ['potion:freeAction', 4, 3, 80], ['potion:stamina', 1, 4, 20], ['potion:healing', 1, 4, 32], ['potion:healTrue', 3, 3, 76],
    ['potion:restorePower', 2, 4, 108], ['potion:waterWalking', 1, 4, 22],
  ]);
  assert.deepEqual(table(['dish:stew', 'dish:supper', 'dish:tart', 'dish:feast']), [['dish:stew', 1, 3, 20], ['dish:supper', 1, 3, 20], ['dish:tart', 2, 3, 40], ['dish:feast', 6, 1, 120]]);
  assert.deepEqual(table(WRIT_KITS.map((r) => r.id)), [
    ['kit:iron', 1, 3, 20], ['kit:steel', 2, 3, 40], ['kit:silver', 3, 3, 60], ['kit:moonstone', 4, 2, 80], ['kit:dwarven', 4, 2, 80],
    ['kit:mithril', 5, 2, 100], ['kit:adamantium', 6, 1, 120], ['kit:ebony', 6, 1, 120], ['kit:orichalcum', 6, 1, 120],
  ]);
  // the worth: one make's inputs at their Marks values over a Novice's yield - Restore Power's cauldron 52, 48 of it the
  // Apothecaries' reagents at cost and 4 of mined Silver half again: (48 + 6) x 4 / 2
  const rp = /** @type {any} */ (craftProductOf('potion:restorePower'));
  assert.deepEqual([rp.cost, rp.bought, craftWorth(rp, 4)], [52, 48, 108]);
  assert.equal(craftWorth({ ...rp, bought: 0 }, 4), 156, 'every input half again: the E2 audit\'s silver in, more silver out');
  assert.deepEqual([craftProductOf('dish:stew')?.bought, craftProductOf('kit:iron')?.bought], [0, 0], 'a dish\'s food and a kit\'s metal and leather are gathered');
  assert.equal(craftWorth(/** @type {any} */ (craftProductOf('dish:stew')), 3), 20, 'three stews (cost 4) floor at a tier\'s 20');
  // the count fitted under the cap before the pay is cut: Restore Power asked eight is fitted to seven (189); a count past
  // the table's CHECK is bounded (E6)
  assert.deepEqual([craftWritOf('potion:restorePower', 8)?.qty, craftWritOf('potion:restorePower', 8)?.pay], [7, 189]);
  assert.deepEqual([CRAFT_WRIT_QTY_MAX, craftWritOf('dish:stew', 500)?.qty, craftWritOf('potion:stamina', 21)?.qty], [20, 20, 20]);
  for (const k of [...WRIT_POTIONS.map((p) => `potion:${p.id}`), 'dish:feast', 'kit:orichalcum']) {
    const w = /** @type {any} */ (craftWritOf(k, 20));
    assert.ok(w.pay <= CRAFT_WRIT_PAY_MAX && w.pay >= CRAFT_PAY_FLOOR * w.tier && w.qty <= CRAFT_WRIT_QTY_MAX, k);
    assert.deepEqual([w.xp, w.renown], [2 * w.pay, renownRate(2 * w.pay)], k);
  }
  assert.deepEqual([craftWritBaseQty({ kind: 'potion', tier: 2 }), craftWritBaseQty({ kind: 'potion', tier: 3 }), craftWritBaseQty({ kind: 'potion', tier: 5 }), craftWritBaseQty({ kind: 'dish', tier: 6 }), craftWritBaseQty({ kind: 'kit', tier: 4 }), craftWritBaseQty({ kind: 'kit', tier: 6 })], [4, 3, 2, 1, 2, 1]);
});

test('CRAFT-WRITS law: THE DAY\'S THREE - an ACCOUNT\'s (AUDIT CRAFT-WRITS E1: its own dice, never a character\'s): a potion and a dish of Provisioning\'s, and a kit of Smithing\'s where it has smithed (else a second potion, another than the first), within its ranks and no more than two tiers below its best; the same account, day and ranks always the same three; none for a seed that is no account id (mutants: the reach; the two tiers; the second potion\'s difference; the dice\'s salt; the dice\'s seed)', () => {
  const C = 'AbCdEfGhIjKlMnOpQrStUv-_';
  assert.deepEqual(craftWritChoices('potion', 0), ['potion:orcStrength', 'potion:stamina', 'potion:healing', 'potion:waterWalking']);
  assert.deepEqual(craftWritChoices('dish', 0), ['dish:stew', 'dish:supper']);
  assert.deepEqual(craftWritChoices('dish', 100), ['dish:feast'], 'a Master is asked a Master\'s work');
  assert.deepEqual(craftWritChoices('potion', 100).map((k) => craftProductOf(k)?.tier).sort(), [5, 5, 5, 6, 7]);
  assert.deepEqual(craftWritChoices('kit', 10), ['kit:iron', 'kit:steel']);
  for (let day = 20_000; day < 20_060; day++) {
    const ws = craftWritsFor(day, C, { provisioning: 30 });
    assert.deepEqual(ws.map((w) => w.slot), [0, 1, 2]);
    assert.deepEqual(ws.map((w) => w.kind), ['potion', 'dish', 'potion']);
    assert.notEqual(ws[0].product, ws[2].product, `${day}: two potions, two products`);
    for (const w of ws) assert.ok((craftProductOf(w.product)?.rank ?? 99) <= 30, `${day}: ${w.product} within reach`);
    const smith = craftWritsFor(day, C, { provisioning: 30, smithing: 40, smithed: true });
    assert.equal(smith[2].kind, 'kit');
    assert.ok(craftWritChoices('kit', 40).includes(smith[2].product));
    assert.deepEqual(craftWritsFor(day, C, { provisioning: 30 }), ws, 'the same three');
  }
  const days = new Set(Array.from({ length: 40 }, (_, i) => craftWritsFor(20_000 + i, C, { provisioning: 30 })[0].product));
  assert.ok(days.size >= 4, 'the days differ');
  const D = 'BbCdEfGhIjKlMnOpQrStUv-_';
  const differ = Array.from({ length: 40 }, (_, i) => 20_000 + i).filter((d) => craftWritsFor(d, C, { provisioning: 30 })[0].product !== craftWritsFor(d, D, { provisioning: 30 })[0].product);
  assert.ok(differ.length >= 10, `each account its own dice (${differ.length} of 40 days differ)`);
  // one day's three, as the dice fall - the salt and the slots' rolls their own
  assert.deepEqual(craftWritsFor(20_383, C, { provisioning: 30 }).map((w) => w.product), ['potion:resistFrost', 'dish:supper', 'potion:slowFalling']);
  assert.deepEqual(craftWritsFor(20_383, C, { provisioning: 100, smithing: 70, smithed: true }).map((w) => w.product), ['potion:chameleonForm', 'dish:feast', 'kit:dwarven']);
  for (const bad of ['char-mac', '', null, 'r123', 'a'.repeat(65), 'AbCdEfGhIjKlMnOp QrSt']) assert.deepEqual(craftWritsFor(20_000, bad, {}), []);
  assert.ok(CRAFT_WRIT_SEED_RE.test(C));
  assert.deepEqual(craftWritsFor(20_383, C, null), craftWritsFor(20_383, C, {}), 'E6: no ranks read as none');
  const R = 'r0123456789abcdef0123';
  assert.equal(craftWritId(20_383, R, 2), `k:20383:${R}:2`);
  assert.ok(CRAFT_WRIT_ID_RE.test(craftWritId(20_383, R, 2)) && !CRAFT_WRIT_ID_RE.test(`k:20383:${R}:3`) && !CRAFT_WRIT_ID_RE.test('c:1:17:0'));
});

test('CRAFT-WRITS law: THE GOODS - a potion writ\'s bottles of its recipe, the plain before the Potent, a stack giving part of itself, never a worn, quest or bound one; a dish\'s or kit\'s pieces by provenance, exactly its count, each once, of an answering recipe; the take moves nothing where the pack is short (mutants: the plain first; the tradeable law; the count)', () => {
  const key = writPotionKey('potion:healing');
  assert.equal(key, potionById('healing')?.key);
  assert.equal(writPotionKey('dish:stew'), null);
  const bottle = (n, extra = {}) => ({ group: 'UselessItems1', templateIndex: BOTTLE, potionRecipeKey: key, stackCount: n, ...extra });
  const save = { items: [bottle(3, { potent: 25 }), { name: 'Torch', templateIndex: 1 }, bottle(1, { equipSlot: 4 }), bottle(2), bottle(5, { potionRecipeKey: 1 })], lightSourceIndex: 1, goldPieces: 7 };
  assert.equal(craftGoodsHeld(save.items, { product: 'potion:healing' }), 5, 'the worn bottle and another recipe\'s are none');
  // AUDIT CRAFT-WRITS E3: a recipe sheet of the potion names its key and is no potion; C3: a locked bottle stays in the pack
  const sheet = { group: 'MiscItems', templateIndex: 99, potionRecipeKey: key };
  assert.equal(craftGoodsHeld([sheet, { ...sheet, group: 'UselessItems1' }, bottle(4, { locked: true })], { product: 'potion:healing' }), 0);
  assert.equal(craftGoodsPick([bottle(4, { locked: true }), sheet], { product: 'potion:healing', qty: 1 }), null);
  assert.deepEqual(craftGoodsPick(save.items, { product: 'potion:healing', qty: 4 }), [{ at: 3, n: 2 }, { at: 0, n: 2 }]);
  assert.equal(craftGoodsPick(save.items, { product: 'potion:healing', qty: 6 }), null);
  const before = JSON.stringify(save);
  assert.equal(takeCraftGoods(save, { product: 'potion:healing', qty: 6 }, null), null);
  assert.equal(JSON.stringify(save), before, 'short: nothing moved');
  const moved = takeCraftGoods(save, { product: 'potion:healing', qty: 4 }, null);
  assert.deepEqual(moved?.map((r) => [r.stackCount, r.potent ?? 0]), [[2, 0], [2, 25]]);
  assert.deepEqual([save.items.map((r) => [r.name ?? r.potionRecipeKey, r.stackCount ?? 1]), save.lightSourceIndex, save.goldPieces], [[[key, 1], ['Torch', 1], [key, 1], [1, 5]], 1, 7]);
  // pieces
  const dish = (pv, recipe = 'stew:north') => ({ templateIndex: 685, provenance: pv, recipe });
  const P = ['0123456789abcdef', '1123456789abcdef', '2123456789abcdef'];
  const pack = [dish(P[0]), dish(P[1], 'stew:south'), dish(P[2], 'supper:north'), { ...dish('3123456789abcdef'), questItem: true }];
  assert.deepEqual([craftGoodsHeld([{ ...dish(P[0]), locked: true }], { product: 'dish:stew' }), craftGoodsPick([{ ...dish(P[0]), locked: true }, dish(P[1])], { product: 'dish:stew', qty: 2 }, [P[0], P[1]])], [0, null], 'C3: a locked serving stays');
  assert.ok(pieceAnswers('dish:stew', 'stew:south') && !pieceAnswers('dish:stew', 'supper:north') && pieceAnswers('kit:steel', 'kit:steel') && !pieceAnswers('kit:steel', 'kit:iron') && !pieceAnswers('potion:healing', 'stew:north'));
  assert.equal(craftGoodsHeld(pack, { product: 'dish:stew' }), 2, 'the supper is no stew; the quest\'s stays');
  assert.deepEqual(craftGoodsPick(pack, { product: 'dish:stew', qty: 2 }, [P[0], P[1]]), [{ at: 0, n: 1 }, { at: 1, n: 1 }]);
  for (const pieces of [[P[0]], [P[0], P[0]], [P[0], P[2]], [P[0], '3123456789abcdef'], [P[0], 'nothex'], null]) assert.equal(craftGoodsPick(pack, { product: 'dish:stew', qty: 2 }, pieces), null, JSON.stringify(pieces));
  const s2 = { items: pack.slice() };
  assert.deepEqual(takeCraftGoods(s2, { product: 'dish:stew', qty: 2 }, [P[1], P[0]])?.map((r) => r.provenance), [P[1], P[0]]);
  assert.deepEqual(s2.items.map((r) => r.provenance), [P[2], '3123456789abcdef']);
});

test('CRAFT-WRITS law: the card\'s words - the ask, what fills it, the pay, what is held, why Deliver waits, and the thanks (mutants: each)', () => {
  const w = { product: 'potion:restorePower', qty: 4, faction: GUILD_FACTION_IDS.MagesGuild, pay: 156, xp: 312, renown: 234, track: 'provisioning', kind: 'potion' };
  assert.equal(craftNeedText(w), 'The Mages Guild asks you for 4 Potions of Restore Power');
  assert.deepEqual([craftCountText('potion:healing', 1), craftCountText('dish:stew', 3), craftCountText('dish:feast', 1), craftCountText('kit:steel', 2), craftCountText('kit:steel', 1)],
    ['a Potion of Healing', '3 servings of Hunter\'s Stew', 'a Feast of the Hearth', '2 Steel Repair Kits', 'one Steel Repair Kit']);
  assert.equal(craftCountText('kit:ebony', 1), 'one Ebony Repair Kit', 'AUDIT CRAFT-WRITS C5: never "a Ebony"');
  assert.deepEqual(['potion:healing', 'dish:stew', 'kit:iron'].map(craftMadeText), [
    'Of your own brewing - the bottles leave your pack.', 'Of your own cooking, never sold - the servings leave your pack.', 'Of your own make, never sold - the kits leave your pack.']);
  assert.equal(craftPayText(w), 'Pays 156 silver, 312 Provisioning experience, 234 Renown and standing with the Mages Guild');
  assert.equal(craftPayText({ ...w, track: 'smithing', faction: GUILD_FACTION_IDS.FightersGuild }), 'Pays 156 silver, 312 Smithing experience, 234 Renown and standing with the Fighters Guild');
  assert.equal(craftHeldText(w, { pack: 5, made: 3 }), '3 brewed by you, 5 in your pack');
  assert.equal(craftHeldText({ kind: 'dish' }, { pack: 3, made: 2 }), '2 of your own in your pack');
  assert.equal(craftShortText(w, { pack: 5, made: 3 }), 'Brew 1 more yourself at an alchemy station - found or bought bottles do not count');
  assert.equal(craftShortText(w, { pack: 1, made: 4 }), 'Carry 3 more of these bottles in your pack');
  assert.equal(craftShortText({ kind: 'kit', qty: 3 }, { pack: 3, made: 1 }), 'Make 2 more yourself - pieces you bought or sold do not count');
  assert.equal(craftFilledText(w, { pay: 156, xp: 300, renown: { credited: 234 } }), 'The Mages Guild thanks you: 156 silver, 300 Provisioning experience and 234 Renown.');
  assert.equal(craftFilledText(w, undefined), 'Delivered to the Mages Guild.', 'a landed act, its answer lost');
});
