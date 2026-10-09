// CARDS9 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 32; Mac: "Lets build every inch of this. Dont forget
// about a card needing to come from the abyss dungeon also"): WHERE CARDS COME FROM, AND WHAT ONE IS WORTH. A card's
// worth is its tier's (net/cardWorthLaw.js); the realm's customs bound the cards a character brings, on the client's
// copy and at the service's first save; a tavern keeper sells packs of five, the last rare or better; a foe drops its
// own card at its death through every body door, and the cap keeps it; a guild quest pays one of its guild's cards; and
// the Gate's Warden, the Sea Serpent and the Abyss Dungeon's Brass Remnant each draw for their own card LAST in their
// hoard, so every roll before it is what it was.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ILIAC_CARDS, ILIAC_LOCATIONS, STARTER_DECK, cardById, ILIAC_TIERS } from '../src/net/iliacCards.js';
import { CARD_WORTH, cardWorth, cardWorthOf, isCardRecord, cardRecordWorth, STARTER_DECK_WORTH, customsCardAllowance, CUSTOMS_CARD_WORTH_PER_LEVEL, ILIAC_CARD_TEMPLATE as LAW_TEMPLATE } from '../src/net/cardWorthLaw.js';
import { ILIAC_CARD_TEMPLATE, CARD_PACK_TEMPLATE, mintIliacCard, mintCardPack, isCardPack, cleanBinders, giveBinderAtChargen, CARD_PACK_ROW } from '../src/systems/iliacItems.js';
import {
  FOE_CARDS, FOE_CARD_PER_MILLE, TITLED_FOE_CARD_MULT, foeCardRoll, dropFoeCard, CARD_DROP_HANDLER,
  GUILD_CARDS, guildNameOfFaction, guildCardRoll, GUILD_CARD_PER_MILLE,
  CARD_PACK_SIZE, PACK_POOL, PACK_SLOT_TIERS, PACK_TOP_TIERS, rollPackCards, openCardPack, buyCardPack, cardPackPrice, CARD_PACK_BASE_PRICE, packOpenedText,
  BOSS_CARDS, BOSS_CARD_IDS, BOSS_CARD_PER_MILLE, bossCardRoll,
} from '../src/systems/cardSources.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';
import { DIVINES, ORDERS } from '../src/systems/guildVariants.js';
import { GUILDS } from '../src/systems/guilds.js';
import { templateByIndex, itemUseHandler } from '../src/systems/itemTemplates.js';
import { raiseEnemyDeath } from '../src/scenes/corpseMarker.js';
import { capLootList, CARD_CAP_RANK } from '../src/systems/foeLootCap.js';
import { calculateTradePrice, shopBuysItem } from '../src/systems/shopStock.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { rollSpoils } from '../src/systems/gateSpoils.js';
import { spoilsList } from '../src/scenes/spoilsPool.js';
import { rollSerpentSpoils, serpentSpoilsList } from '../src/systems/serpentSpoils.js';
import { rollSdSpoils, sdSpoilsList } from '../src/systems/sdSpoils.js';
import { cardCustoms, applyCustoms, customsLines } from '../src/systems/realmCustoms.js';
import { firstSaveRefusal } from '../server-account/src/realm.js';
import { validLootItem } from '../src/systems/loot.js';
import { goodRefusal } from '../src/net/marketLaw.js';
import { tradeableRecord } from '../src/net/realmTradeLaw.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
/** A source that answers `vals` in turn, then `rest`, and counts its draws. */
const script = (vals, rest = 0.99) => { let i = 0; const f = () => (i < vals.length ? vals[i++] : rest); f.n = () => i; return f; };
const lcg = (s0) => { let s = s0 >>> 0; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return (s >>> 8) / 0x1000000; }; };

test('CARDS9 the worth: a card is worth its tier (CARD_WORTH), minted so and refreshed on a load; the law\'s template is the item\'s; no shop buys a card still (mutants: the tier\'s worth; the mint\'s value; the load\'s refresh)', () => {
  assert.deepEqual({ ...CARD_WORTH }, { common: 5, magic: 20, rare: 75, legendary: 300, aetheric: 1200, artifact: 2500, gilded: 5000 });
  assert.deepEqual(Object.keys(CARD_WORTH), [...ILIAC_TIERS], 'a worth for every rung, in its order');
  for (let i = 1; i < ILIAC_TIERS.length; i++) assert.ok(CARD_WORTH[ILIAC_TIERS[i]] > CARD_WORTH[ILIAC_TIERS[i - 1]], 'dearer up the ladder');
  assert.equal(LAW_TEMPLATE, ILIAC_CARD_TEMPLATE, 'one number for the card');
  assert.equal(cardWorth('rat'), 5);
  assert.equal(cardWorth('brass-remnant'), 1200);
  assert.equal(cardWorth('nothing'), 0);
  const lich = mintIliacCard('lich', 3);
  assert.equal(lich.value, 75, 'the mint gives it its worth');
  assert.equal(cardRecordWorth(lich), 225, 'the stack counts');
  assert.ok(isCardRecord(lich) && !isCardRecord({ templateIndex: 581 }) && !isCardRecord(mintCardPack()));
  // a card minted before CARDS9 carried a coin's worth; the load makes it its tier's
  const old = mintIliacCard('giant'); old.value = 1;
  cleanBinders([old]);
  assert.equal(old.value, 75);
  for (const shop of [BUILDING_TYPES.GeneralStore, BUILDING_TYPES.PawnShop]) {
    assert.equal(shopBuysItem(shop, lich), false, 'AUDIT CARDS-5 C2 kept: no counter turns a card into gold');
    assert.equal(shopBuysItem(shop, mintCardPack()), false, 'nor a sealed pack');
  }
  assert.ok(validLootItem(JSON.parse(JSON.stringify(lich))), 'a card off the wire');
  assert.equal(goodRefusal(JSON.parse(JSON.stringify(lich))), null, 'the market takes a card');
  assert.equal(tradeableRecord(JSON.parse(JSON.stringify(lich))), true, 'and the realm\'s trade');
  assert.equal(STARTER_DECK_WORTH, STARTER_DECK.reduce((s, id) => s + CARD_WORTH[cardById(id).tier], 0));
  assert.equal(STARTER_DECK_WORTH, 285);
});

test('CARDS9 the pack: template 583, stackable, weightless, its lines; five cards, the last rare or better, never a holding or a boss\'s own, two draws a card; its Use opens one off the stack into the list it came from (mutants: the size; the top slot; the pool\'s bosses; the stack)', () => {
  const row = templateByIndex(CARD_PACK_TEMPLATE);
  assert.equal(CARD_PACK_TEMPLATE, 583);
  assert.deepEqual([row.name, row.stackable, row.hasNoEncumbrance, row.basePrice], ['Card Pack', true, true, CARD_PACK_BASE_PRICE]);
  assert.equal(CARD_PACK_ROW.index, CARD_PACK_TEMPLATE);
  const pack = mintCardPack(2);
  assert.ok(isCardPack(pack) && pack.stackCount === 2);
  assert.ok(validLootItem(JSON.parse(JSON.stringify(pack))), 'a pack off the wire (it trades)');
  assert.equal(CARD_PACK_SIZE, 5);
  assert.deepEqual(Object.values(PACK_SLOT_TIERS).reduce((a, b) => a + b, 0), 1000);
  assert.deepEqual(Object.values(PACK_TOP_TIERS).reduce((a, b) => a + b, 0), 1000);
  const pooled = Object.values(PACK_POOL).flat();
  for (const id of BOSS_CARD_IDS) assert.ok(!pooled.includes(id), `${id} is found, never in a pack`);
  for (const loc of ILIAC_LOCATIONS) assert.ok(!pooled.includes(loc.id), 'no holding');
  assert.equal(pooled.length, ILIAC_CARDS.length - BOSS_CARD_IDS.length, 'every other card can come in one');
  // the draws: a tier, then a card - the first four from the common and magic table, the fifth from the top
  const s = script([0.1, 0, 0.9, 0, 0.1, 0.999, 0.75, 0.5, 0.5, 0]);
  const ids = rollPackCards(s);
  assert.equal(s.n(), 10, 'two draws a card');
  assert.deepEqual(ids.map((id) => cardById(id).tier), ['common', 'magic', 'common', 'magic', 'rare']);
  assert.equal(ids[0], PACK_POOL.common[0]);
  assert.equal(ids[2], PACK_POOL.common.at(-1), 'a draw at the top of [0,1) is the pool\'s last');
  let top = { rare: 0, legendary: 0, aetheric: 0, artifact: 0 };
  const r = lcg(9);
  for (let k = 0; k < 4000; k++) { const p = rollPackCards(r); top[cardById(p[4]).tier]++; for (const id of p.slice(0, 4)) assert.ok(['common', 'magic'].includes(cardById(id).tier)); }
  assert.ok(Math.abs(top.rare / 4000 - 0.85) < 0.03 && top.legendary > 300 && top.aetheric + top.artifact > 20, JSON.stringify(top));
  // the Use: one pack off the stack, five cards in
  const list = [mintCardPack(2)];
  const out = itemUseHandler(CARD_PACK_TEMPLATE)(list[0], list, { rolls: lcg(3) });
  assert.equal(out.kind, 'cardpack');
  assert.equal(out.ids.length, 5);
  assert.equal(list[0].stackCount, 1, 'one pack off the stack');
  assert.equal(list.filter((x) => isCardRecord(x)).reduce((n, x) => n + x.stackCount, 0), 5);
  assert.equal(out.text, packOpenedText(out.ids));
  assert.match(out.text, /^You open the pack: [^,]+(, [^,]+){4}\.$/);
  const last = [mintCardPack()];
  openCardPack(last[0], last, { rolls: lcg(4) });
  assert.ok(!last.some(isCardPack), 'the last pack is gone once opened');
  assert.equal(openCardPack(mintIliacCard('rat'), [], {}), null, 'a card is no pack');
});

test('CARDS9 the counter: a pack\'s price is the counter\'s (DFU\'s CalculateTradePrice of CARD_PACK_BASE_PRICE at the tavern\'s quality, the haggle\'s skills); bought, the gold goes and the pack comes; short, nothing moves (mutants: the price; the purse; the refusal)', () => {
  const skills = { mercantile: 40, personality: 60 };
  assert.equal(cardPackPrice(12, skills, { online: false }), calculateTradePrice(CARD_PACK_BASE_PRICE, 12, skills, false, { online: false }));
  assert.ok(cardPackPrice(18, { mercantile: 5, personality: 5 }, { online: false }) > cardPackPrice(3, { mercantile: 90, personality: 90 }, { online: false }), 'a fine house and a poor haggler pay more');
  const e = { goldPieces: 100, items: [] };
  const price = cardPackPrice(10, skills, { online: false });
  const got = buyCardPack(e, { quality: 10, skills, online: false });
  assert.deepEqual(got, { ok: true, price });
  assert.equal(e.goldPieces, 100 - price);
  assert.equal(e.items.filter(isCardPack).length, 1);
  const poor = { goldPieces: price - 1, items: [] };
  assert.deepEqual(buyCardPack(poor, { quality: 10, skills, online: false }), { ok: false, price, why: 'gold' });
  assert.deepEqual([poor.goldPieces, poor.items.length], [price - 1, 0]);
  // the doors: the Enhanced tavern's row and the card table's panel (CARDS10, scenes/worldModes.js)
  const tav = read('src/ui/enhancedTavern.js');
  assert.match(tav, /const pack = el\('button', 'act tavern-act', `Card pack \(\$\{packPrice\(\)\} gold\)`\);\s*pack\.onclick = buyPack;/);
  assert.match(tav, /wrap\.append\(room, talkBtn, food, pack, exit\);/);
  assert.match(tav, /const r = buyCardPack\(deps\.entity, \{ quality: deps\.quality\?\.\(\) \?\? 10, skills: deps\.skills\?\.\(\) \?\? \{\} \}\);\s*if \(!r\.ok\) \{ say\(rows\(NOT_ENOUGH_GOLD_ID, \{ amount: r\.price \}\)\); return; \}/);
  assert.doesNotMatch(read('src/ui/tavernWindow.js'), /buyCardPack/, 'the classic window keeps DFU\'s four buttons');
});

test('CARDS9 the foes: a creature drops its own card - one draw at its card\'s tier\'s chance, twice it titled; none for a kind with no card, a revenant or a world boss; through the real death door, and the cap keeps it as a Magic piece (mutants: the map; the chance; the titled share; the handler; the cap\'s rank)', () => {
  assert.equal(FOE_CARDS[MOBILE_TYPES.Rat], 'rat', 'a rat drops a rat');
  assert.equal(FOE_CARDS[MOBILE_TYPES.AncientLich], 'ancient-lich');
  assert.equal(FOE_CARDS[MOBILE_TYPES.Lamia], 'lamia');
  for (const [mt, id] of Object.entries(FOE_CARDS)) {
    const c = cardById(id);
    assert.ok(c && c.kind === 'unit', `${mt}: ${id} is a unit`);
    assert.ok(!BOSS_CARD_IDS.includes(id), 'no foe drops a boss\'s own');
    assert.ok(FOE_CARD_PER_MILLE[c.tier] > 0, `${id}: a chance for its tier`);
  }
  for (const none of ['GrizzlyBear', 'Spider', 'Mummy', 'FrostDaedra', 'FireDaedra', 'Knight_CityWatch', 'Slaughterfish']) assert.equal(FOE_CARDS[MOBILE_TYPES[none]], undefined, `${none}: no card`);
  assert.deepEqual({ ...FOE_CARD_PER_MILLE }, { common: 16, magic: 11, rare: 7, legendary: 3 });
  assert.equal(TITLED_FOE_CARD_MULT, 2);
  const rat = { mobileType: MOBILE_TYPES.Rat, items: [] };
  assert.equal(foeCardRoll(rat, script([0.0159])), 'rat');
  assert.equal(foeCardRoll(rat, script([0.016])), null, 'at its chance, nothing');
  assert.equal(foeCardRoll({ ...rat, eliteFoe: true }, script([0.0319])), 'rat', 'a titled foe twice as often');
  assert.equal(foeCardRoll({ ...rat, eliteFoe: true }, script([0.032])), null);
  assert.equal(foeCardRoll({ ...rat, revenant: true }, () => 0), null);
  assert.equal(foeCardRoll({ ...rat, worldBoss: true }, () => 0), null);
  assert.equal(foeCardRoll({ mobileType: MOBILE_TYPES.Spider, items: [] }, () => 0), null);
  const lich = { mobileType: MOBILE_TYPES.Lich, items: [] };
  assert.equal(foeCardRoll(lich, script([0.0069])), 'lich');
  assert.equal(foeCardRoll(lich, script([0.0071])), null, 'a rare card, a rare draw');
  // THE DOOR: raiseEnemyDeath runs the handler - a body at its death carries its card
  const body = { mobileType: MOBILE_TYPES.Zombie, items: [] };
  raiseEnemyDeath(body, { rolls: () => 0 });
  assert.deepEqual(body.items.filter(isCardRecord).map((c) => c.card), ['zombie']);
  assert.equal(dropFoeCard({ mobileType: MOBILE_TYPES.Rat, items: null }, { rolls: () => 0 }), null, 'a body with no list takes none');
  assert.match(read('src/systems/cardSources.js'), /registerEnemyDeathHandler\(CARD_DROP_HANDLER, \(entity, opts = \{\}\) => \{ dropFoeCard\(entity, opts\); \}\);/);
  assert.equal(CARD_DROP_HANDLER, 'iliac-card');
  assert.match(read('src/systems/worldTick.js'), /^import '\.\/cardSources\.js';/m, 'the app carries the import (AUDIT-THUNDERLOCK F1\'s wire)');
  // THE CAP keeps it: three Common pieces and a card, capped to three - the card stays
  const commons = [0, 1, 2].map((i) => ({ group: 'Weapons', templateIndex: 115 + i, value: 300 }));
  const items = [...commons, mintIliacCard('rat')];
  capLootList(items, 3);
  assert.equal(items.filter(isCardRecord).length, 1, 'the card outranks a common blade');
  assert.equal(CARD_CAP_RANK, 2);
});

test('CARDS9 the guilds: a guild quest done pays one of its guild\'s cards one time in three, the best its quester\'s rank reaches; the guild by the quest\'s faction - the four, the eight temples, the five orders that wear a card; the host pays once a quest (mutants: the chance; the rank\'s ladder; the faction map; the once)', () => {
  assert.equal(GUILD_CARD_PER_MILLE, 334);
  assert.equal(guildNameOfFaction(GUILDS.MagesGuild.factionId), 'MagesGuild');
  assert.equal(guildNameOfFaction(GUILDS.FightersGuild.factionId), 'FightersGuild');
  assert.equal(guildNameOfFaction(GUILDS.ThievesGuild.factionId), 'ThievesGuild');
  assert.equal(guildNameOfFaction(GUILDS.DarkBrotherhood.factionId), 'DarkBrotherhood');
  for (const [d, id] of Object.entries(DIVINES)) assert.equal(guildNameOfFaction(id), `Temple:${d}`);
  for (const [o, id] of Object.entries(ORDERS)) assert.equal(guildNameOfFaction(id), `Order:${o}`);
  assert.equal(guildNameOfFaction(1), null);
  for (const [name, ladder] of Object.entries(GUILD_CARDS)) {
    assert.ok(ladder.length && ladder[0][0] === 0, `${name}: a card from rank 0`);
    for (const [, id] of ladder) assert.ok(cardById(id)?.kind === 'unit', `${name}: ${id}`);
  }
  assert.equal(guildCardRoll(40, 0, script([0.333])), 'mages-guild-apprentice');
  assert.equal(guildCardRoll(40, 4, script([0.333])), 'mages-guild-battlemage');
  assert.equal(guildCardRoll(40, 9, script([0.333])), 'mages-guild-archmage');
  assert.equal(guildCardRoll(40, 9, script([0.334])), null, 'two quests in three pay none');
  assert.equal(guildCardRoll(DIVINES.Arkay, 0, () => 0), 'priest-of-arkay');
  assert.equal(guildCardRoll(ORDERS.Flame, 2, () => 0), 'knight-of-the-flame');
  assert.equal(guildCardRoll(ORDERS.Owl, 9, () => 0), null, 'an order with no card');
  assert.equal(guildCardRoll(108, 6, () => 0), 'dark-brotherhood-assassin');
  const w = read('src/scenes/world.js');
  assert.match(w, /if \(!q\?\.questSuccess \|\| !\(q\.factionId > 0\)\) return;\s*const key = String\(q\.uid \?\? q\.questName \?\? ''\);\s*if \(!key \|\| cardQuestPaid\.has\(key\)\) return;\s*cardQuestPaid\.add\(key\);/);
  assert.match(w, /const rank = Object\.values\(activeMemberships\(playerEntity\)\)\.find\(\(m\) => m\?\.guild === name\)\?\.rank \?\? 0;\s*const id = guildCardRoll\(q\.factionId, rank, Math\.random\);/);
  assert.match(w, /renownQuestEnded\?\.\(q\);[^\n]*\n\s*cardQuestEnded\(q\);/, 'beside the Renown payout, in the quest machine\'s one end hook');
});

test('CARDS9 THE BOSSES\' OWN: the Warden\'s, Sethrakul\'s and the Brass Remnant\'s aetheric cards - one draw, always, LAST in each hoard, so every roll before it is what it was; kept beside the pieces and thrown after them; a Serpent stander finds none (mutants: the chance; the draw\'s place; a stander\'s card)', () => {
  assert.deepEqual({ ...BOSS_CARDS }, { gate: 'valkynaz-ruhn', serpent: 'sethrakul', abyss: 'brass-remnant' });
  for (const id of BOSS_CARD_IDS) assert.equal(cardById(id).tier, 'aetheric');
  assert.deepEqual({ ...BOSS_CARD_PER_MILLE }, { gate: 200, serpent: 250, abyss: 250 });
  const yes = script([0.1999]), no = script([0.2]);
  assert.equal(bossCardRoll('gate', yes).card, 'valkynaz-ruhn');
  assert.equal(bossCardRoll('gate', no), null);
  assert.deepEqual([yes.n(), no.n()], [1, 1], 'one draw whatever it answers');
  // LAST: the hoard with its card's draw is the hoard without it, plus that one draw - the same pieces and gold
  let gate = 0, serpent = 0, abyss = 0, stood = 0;
  for (let seed = 1; seed <= 600; seed++) {
    const k = (seed * 2654435761) >>> 0;
    const g = rollSpoils(k, 10), s = rollSerpentSpoils(k, 10, 'dealt'), a = rollSdSpoils(k, 10), st = rollSerpentSpoils(k, 10, 'stood');
    if (g.card) { gate++; assert.equal(g.card.card, 'valkynaz-ruhn'); }
    if (s.card) { serpent++; assert.equal(s.card.card, 'sethrakul'); }
    if (a.card) { abyss++; assert.equal(a.card.card, 'brass-remnant'); }
    if (st.card) stood++;
    for (const h of [g, s, a]) assert.ok(!h.pieces.some((p) => isCardRecord(p.item)), 'never among the pieces');
  }
  assert.ok(Math.abs(gate / 600 - 0.2) < 0.05 && Math.abs(serpent / 600 - 0.25) < 0.05 && Math.abs(abyss / 600 - 0.25) < 0.05, `${gate} ${serpent} ${abyss}`);
  assert.equal(stood, 0, 'a ship that stood never finds the Serpent\'s card');
  // the lists: the card after the pieces, before the embers (the Gate's, the Serpent's) or the gold (the Abyss's)
  for (let seed = 1; seed <= 60; seed++) {
    const k = (seed * 40503) >>> 0;
    const gl = spoilsList(k, 10), g = rollSpoils(k, 10);
    assert.equal(gl.filter((p) => p.kind === 'item' && isCardRecord(p.item)).length, g.card ? 1 : 0);
    if (g.card) assert.equal(gl[g.pieces.length].item.card, 'valkynaz-ruhn', 'the Warden\'s card right after the pieces');
    const sl = serpentSpoilsList(k, 10, 'dealt'), s = rollSerpentSpoils(k, 10, 'dealt');
    if (s.card) assert.deepEqual([sl[s.pieces.length].item.card, sl[s.pieces.length].tier], ['sethrakul', 'aetheric']);
    const al = sdSpoilsList(k, 10), a = rollSdSpoils(k, 10);
    if (a.card) { assert.equal(al.at(-2).item.card, 'brass-remnant'); assert.ok(validLootItem(JSON.parse(JSON.stringify(al.at(-2).item))), 'the crash record\'s door takes it'); }
  }
  // by source: each draw sits after the hoard's last piece's
  assert.match(read('src/systems/gateSpoils.js'), /lastPass\(pieces\.map\(\(p\) => p\.item\), rolls\);\s*(\/\/[^\n]*\n\s*)*const card = bossCardRoll\('gate', rolls\);\s*return \{ gold, pieces, sigil: sigilStone\(\), card \};/);
  assert.match(read('src/systems/serpentSpoils.js'), /if \(coil\) pieces\.push\(\{ item: coil, tier: coil\.rarity \}\);\s*(\/\/[^\n]*\n\s*)*const card = dealt \? bossCardRoll\('serpent', rolls\) : null;/);
  assert.match(read('src/systems/sdSpoils.js'), /if \(hourlock\) pieces\.push\(\{ item: hourlock, tier: hourlock\.rarity \}\);\s*(\/\/[^\n]*\n\s*)*const card = bossCardRoll\('abyss', rolls\);/);
});

test('CARDS9 THE CUSTOMS: a character brings cards worth the starter deck\'s and CUSTOMS_CARD_WORTH_PER_LEVEL a level; customs takes the dearest past it, one card at a time; the service holds a customs first save to it (\'customs-cards\') and a born one to the starter deck (\'realm-birth\'); the report says it (mutants: the allowance; the order; the service\'s bound; the birth\'s)', () => {
  assert.equal(CUSTOMS_CARD_WORTH_PER_LEVEL, 150);
  assert.equal(customsCardAllowance(1), STARTER_DECK_WORTH + 150);
  assert.equal(customsCardAllowance(10), STARTER_DECK_WORTH + 1500);
  assert.equal(customsCardAllowance(0), customsCardAllowance(1), 'a level under 1 is 1');
  const born = { level: 1, goldPieces: 100, items: [] };
  giveBinderAtChargen(born);
  assert.equal(cardWorthOf(born), STARTER_DECK_WORTH, 'the gift is the starter deck\'s worth');
  assert.equal(firstSaveRefusal(JSON.stringify(born), { origin_id: null }), null, 'a born character with its gift crosses');
  born.items.push(mintIliacCard('rat'));
  assert.deepEqual(firstSaveRefusal(JSON.stringify(born), { origin_id: null }), { error: 'realm-birth' }, 'one card more than the gift');
  // a customs character at level 2: the gift, then a Giant (75) in a chest and a Lich stack (2 x 75) in the pack and an
  // Ancient Lich (300) on the wagon - 285 + 75 + 150 + 300 = 810 against 285 + 300 = 585
  const snap = { level: 2, goldPieces: 0, items: [], wagonItems: [mintIliacCard('ancient-lich')], sceneCache: { scenes: [{ lootContainers: [{ items: [mintIliacCard('giant')] }] }] } };
  giveBinderAtChargen(snap);
  snap.items.push(mintIliacCard('lich', 2));
  assert.equal(cardWorthOf(snap), 810, 'every list counts: the stashes, the wagon, the pack');
  const row = { origin_id: 'o1', summary: JSON.stringify({ level: 2 }) };
  assert.deepEqual(firstSaveRefusal(JSON.stringify(snap), row), { error: 'customs-cards' });
  const copy = structuredClone(snap);
  const done = cardCustoms(copy);
  assert.deepEqual(done, { kept: 1, worth: 810, allowance: 585 }, 'the Ancient Lich alone was past it');
  assert.equal(copy.wagonItems.length, 0, 'the dearest went first');
  assert.equal(cardWorthOf(copy), 510);
  assert.equal(firstSaveRefusal(JSON.stringify(copy), row), null, 'what customs left, the service takes');
  // one card at a time off a stack: a level-1 character with six Giants (450) and thirty Rats (150) against its 435 -
  // three Giants off the stack (600 to 375), the Rats untouched
  const six = { level: 1, goldPieces: 0, items: [mintIliacCard('giant', 6), mintIliacCard('rat', 30)] };
  assert.deepEqual(cardCustoms(six), { kept: 3, worth: 600, allowance: 435 });
  assert.deepEqual(six.items.map((c) => [c.card, c.stackCount]), [['giant', 3], ['rat', 30]]);
  assert.deepEqual(cardCustoms({ level: 1, items: [mintIliacCard('rat', 30)] }), { kept: 0, worth: 150, allowance: 435 }, 'within it, nothing');
  // the whole customs says it
  const full = structuredClone(snap);
  const rep = applyCustoms(full);
  assert.equal(rep.cardsKept, 1);
  assert.ok(customsLines(rep).some((l) => /^Your cards are worth 810 gold; the realm lets a character of this level bring 585\. 1 card, the dearest, stayed with your offline character\.$/.test(l)), customsLines(rep).join(' | '));
  assert.ok(customsLines(rep, { before: true }).some((l) => /will stay with your offline character/.test(l)));
  assert.match(read('src/net/accountClient.js'), /'customs-cards': 'That character carries more cards than customs lets in\. Bring it online again\.'/);
});
