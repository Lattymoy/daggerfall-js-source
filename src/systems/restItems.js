// @ts-check
// ═══════════════════════════════════════════════════════════════════
// REST6 (2026-10-03, bible/06-Systems/Rest-Arc.md section 6; Mac: "introduce other type of consumables that can fill
// in the gaps when a campfire isn't available"): THE SEVEN THAT FILL THE GAPS. Each answers one gap and none replaces
// the fire. Port templates in their own block, 1700-1706, in DFU's miscellany (UselessItems2) as Foraging's are,
// registered at import - and imported by the save (systems/save.js), so a saved one always has its name, its picture
// and its weight in every scene.
//
//   1700 Bedroll            a rough rest point anywhere a camp could stand, dungeons too; 10 nights; a 10 s channel
//   1701 Ember Jar          a one-night fire where a Campfire could stand: a camp rest point and a cooking fire for
//                           180 world minutes; never picked up
//   1702 Firewood           +3 nights of fuel to a Campfire (to its 8): your placed one in reach first, else the pack's
//   1703 Restorative Tonic  at once: +40% fatigue; with Climates & Calories the sleep need 4 hours lighter
//   1704 Meditation Candle  a 6 s kneel (the rest's channel - the rest key, once lit): +50% magicka; 3 uses
//   1705 Waking Salts       an hour of the character's clock with the sleep need's penalties held off; the debt
//                           keeps growing, and 2 hours more land when it ends; 3 uses
//   1706 Sleeping Draught   the next night sleeps as a bed: full yield, no stiffness, the bed's sleep rate
//
// THE PLACED THREE (Bedroll, Ember Jar, Firewood) answer the inventory's placing kinds ('pitchCamp', 'placeFire'), so
// every host's pack hands them to its own ground (scenes/camps.js placeItem), as the Campfire and the tent are.
//
// SHIP BEFORE ANYONE CAN SEE ONE (section 6's last rule). An older client drops an item its build has no template for
// (loot.js validLootItem), so online the templates land a release before any shelf, pile, foe or recipe carries one:
// REST_ITEMS_ONLINE is that release's switch. Offline there is no older client to meet one: they are on now, with
// Climates & Calories, as its provisions are.
// ═══════════════════════════════════════════════════════════════════
import { registerCustomTemplates, registerItemUseHandler, templateByIndex, mintCondition, setItemFields } from './itemTemplates.js';
import { ICON_TWIGS } from '../net/professionLaw.js';
import { isOnlinePage } from './onlineLane.js';
import { survivalOn } from './survival/switch.js';
import { survivalOf, sleepStage, wakingHeld, WAKING_DEBT_HOURS } from './survival/needs.js';
import { ownMinutes } from './worldTick.js';
import { maxFatigue } from './statMods.js';
import { registerTabledLootHandler, registerEnemyLootExtra } from './loot.js';

/** The block (Rest-Arc.md section 6: 1700-1709, the last three spare). */
export const REST_ITEM = Object.freeze({ Bedroll: 1700, EmberJar: 1701, Firewood: 1702, Tonic: 1703, Candle: 1704, Salts: 1705, Draught: 1706 });
export const REST_ITEM_GROUP = 'UselessItems2';
/** The online sources' switch (shelves, piles, foes, recipes) - false for the release the templates ship in. */
export const REST_ITEMS_ONLINE = false;
/** Whether a source may mint one here: offline with Climates & Calories (the survival arc they belong to, as the
 *  provisions shelf is); online once REST_ITEMS_ONLINE is on. */
export const restItemsAvailable = (online = isOnlinePage()) => (online ? REST_ITEMS_ONLINE : survivalOn());

export const BEDROLL_NIGHTS = 10;
export const BEDROLL_CHANNEL_SECONDS = 10;
export const EMBER_JAR_MINUTES = 180;
export const FIREWOOD_NIGHTS = 3;
export const TONIC_FATIGUE = 0.4;
export const TONIC_SLEEP_HOURS = 4;
export const CANDLE_MAGICKA = 0.5;
export const CANDLE_USES = 3;
export const SALTS_MINUTES = 60;
export const SALTS_DEBT_HOURS = WAKING_DEBT_HOURS;   // the law's (survival/needs.js landWakingDebt)
export const SALTS_USES = 3;
export const DRAUGHT_SPENT_MINUTES = 60;   // AUDIT REST F3: an hour's rest under it spends it - a stopped channel keeps it

const row = (index, name, baseWeight, hitPoints, basePrice, rarity, icon, stackable) => Object.freeze({
  index, name, baseWeight, hitPoints, capacityOrTarget: 0, basePrice, enchantmentPoints: 0, rarity, variants: 0,
  drawOrderOrEffect: 0, isBluntWeapon: false, isLiquid: false, isOneHanded: false, isIngredient: false,
  worldTextureArchive: icon[0], worldTextureRecord: icon[1], playerTextureArchive: 0, playerTextureRecord: 0, stackable,
});
/** The rows, in DFU's ItemTemplates.txt columns - charges as hitPoints (mintCondition), stacking unless they carry
 *  charges. The pictures are DFU's own: the camping bundle, the Clay Jar, the twigs, the Glass Bottle, the Candle, the
 *  Glass Jar, the Holy Water's flask. */
export const REST_ITEM_ROWS = Object.freeze([
  row(REST_ITEM.Bedroll, 'Bedroll', 2.5, BEDROLL_NIGHTS, 80, 1, [204, 8], false),
  row(REST_ITEM.EmberJar, 'Ember Jar', 0.5, 1, 15, 1, [218, 0], true),
  row(REST_ITEM.Firewood, 'Firewood', 1.5, 1, 8, 1, ICON_TWIGS, true),
  row(REST_ITEM.Tonic, 'Restorative Tonic', 0.2, 1, 30, 2, [205, 11], true),
  row(REST_ITEM.Candle, 'Meditation Candle', 0.3, CANDLE_USES, 35, 3, [210, 3], false),
  row(REST_ITEM.Salts, 'Waking Salts', 0.1, SALTS_USES, 40, 3, [205, 3], false),
  row(REST_ITEM.Draught, 'Sleeping Draught', 0.2, 1, 45, 3, [211, 49], true),
]);
registerCustomTemplates(REST_ITEM_ROWS);

const INDICES = new Set(Object.values(REST_ITEM));
export const isRestItem = (item) => !!item && INDICES.has(item.templateIndex);
export const isBedroll = (item) => item?.templateIndex === REST_ITEM.Bedroll;
export const isEmberJar = (item) => item?.templateIndex === REST_ITEM.EmberJar;
export const isFirewood = (item) => item?.templateIndex === REST_ITEM.Firewood;

/** One of the seven, minted as a shelf or a pile mints (its name and value, its charges). */
export function createRestItem(templateIndex, { stackCount = 1 } = {}) {
  const t = templateByIndex(templateIndex);
  if (!t || !INDICES.has(templateIndex)) return null;
  const it = mintCondition(setItemFields({ group: REST_ITEM_GROUP, templateIndex }));
  if (t.stackable && stackCount > 1) it.stackCount = Math.trunc(stackCount);
  return it;
}

export const REST_ITEM_TEXT = Object.freeze({
  tonic: 'You drink the tonic. Your weariness lifts.',
  tonicSleep: 'You drink the tonic. Your weariness lifts, and sleep can wait a while longer.',
  candleLit: 'You light the candle. Rest to kneel and meditate by it.',
  meditated: 'You meditate by the candle. Your mind clears.',
  candleOut: 'The candle burns down to nothing.',
  salts: 'The salts sting your nose awake. Weariness can wait an hour.',
  saltsNotTired: 'You are not weary enough to need the salts.',
  saltsArcOff: 'The salts sting your nose. You were not tired.',
  saltsEnd: 'The salts wear off, and your weariness comes back all at once.',
  saltsHeld: 'The last of the salts is still in you.',   // AUDIT REST-PARTY B6
  draught: 'You drink the draught. Tonight you will sleep as soundly as in a bed.',
  draughtHeld: 'You have already taken a draught for tonight.',
  // the placed three (scenes/camps.js)
  bedrollLaid: 'You lay out your bedroll.',
  bedrollWorn: 'Your bedroll is worn through.',
  emberLit: 'You tip out the embers and they catch.',
  firewoodFed: (n) => `You feed the fire. It has ${n} ${n === 1 ? 'night' : 'nights'} of fuel.`,
  firewoodFull: 'Your Campfire has all the fuel it can take.',
  firewoodNone: 'You have no Campfire to feed.',
  notOnline: 'This cannot be used in the realm yet.',   // AUDIT REST-PARTY B4
});

/** Each item's card lines (systems/itemInfo.js builds the name and the weight around them). */
export function restItemLines(item) {
  const n = item?.currentCondition ?? 0;
  switch (item?.templateIndex) {
    case REST_ITEM.Bedroll: return [`${n} ${n === 1 ? 'night' : 'nights'} left`, 'A rough night anywhere a camp could stand.'];
    case REST_ITEM.EmberJar: return ['A fire for one night - it cannot be carried on.'];
    case REST_ITEM.Firewood: return [`Feeds a Campfire ${FIREWOOD_NIGHTS} nights.`];
    case REST_ITEM.Tonic: return [`Restores ${Math.round(TONIC_FATIGUE * 100)}% of your fatigue.`, `With Climates & Calories, sleep can wait ${TONIC_SLEEP_HOURS} hours more.`];
    case REST_ITEM.Candle: return [`${n} ${n === 1 ? 'use' : 'uses'} left`, `Meditate by it to restore ${Math.round(CANDLE_MAGICKA * 100)}% of your magicka.`];
    case REST_ITEM.Salts: return [`${n} ${n === 1 ? 'use' : 'uses'} left`, 'Holds weariness off for an hour; it lands after.'];
    case REST_ITEM.Draught: return ['Your next night sleeps as a bed.'];
    default: return [];
  }
}

// ---- the uses -----------------------------------------------------------
/** One off a stack, or the item off the list. */
function takeOne(item, list) {
  if ((item.stackCount ?? 1) > 1) { item.stackCount -= 1; return; }
  const i = Array.isArray(list) ? list.indexOf(item) : -1;
  if (i >= 0) list.splice(i, 1);
}
/** One charge off a charged item; the item off the list at none. Answers whether it is gone. */
export function spendCharge(item, list) {
  item.currentCondition = Math.max(0, (item.currentCondition ?? 1) - 1);
  if (item.currentCondition > 0) return false;
  const i = Array.isArray(list) ? list.indexOf(item) : -1;
  if (i >= 0) list.splice(i, 1);
  return true;
}

/** THE TONIC: fatigue at once; with the arc on, the sleep debt lighter. */
export function useTonic(item, list, entity, now = ownMinutes()) {
  if (!entity) return { kind: 'text', text: REST_ITEM_TEXT.tonic };
  const max = maxFatigue(entity);
  entity.fatigue = Math.min(max, (entity.fatigue ?? 0) + Math.round(max * TONIC_FATIGUE));
  let sleep = false;
  if (survivalOn()) {
    const s = survivalOf(entity, now);
    sleep = (s.sleepDebt ?? 0) > 0;
    s.sleepDebt = Math.max(0, (s.sleepDebt ?? 0) - TONIC_SLEEP_HOURS);
  }
  takeOne(item, list);
  return { kind: 'text', text: sleep ? REST_ITEM_TEXT.tonicSleep : REST_ITEM_TEXT.tonic };
}

/** THE SALTS: the penalties held an hour of the character's clock; the debt lands when it ends (needs.js). */
export function useSalts(item, list, entity, now = ownMinutes()) {
  if (!survivalOn() || !entity) return { kind: 'text', text: REST_ITEM_TEXT.saltsArcOff };
  const s = survivalOf(entity, now);
  if (sleepStage(s.sleepDebt ?? 0) === 'rested') return { kind: 'text', text: REST_ITEM_TEXT.saltsNotTired };   // AUDIT REST F9: the stage, not the debt
  if (wakingHeld(s, now)) return { kind: 'text', text: REST_ITEM_TEXT.saltsHeld };   // AUDIT REST-PARTY B6: one hour at a time - three taken at once held three hours and landed ONE hour's debt (needs.js landWakingDebt lands once), and at the debt's cap none
  s.wakingUntil = Math.max(s.wakingUntil ?? 0, now) + SALTS_MINUTES;
  spendCharge(item, list);
  return { kind: 'text', text: REST_ITEM_TEXT.salts };
}
/** THE DRAUGHT: the next night a bed's (scenes/shared.js setResting reads and spends it). */
export function useDraught(item, list, entity, now = ownMinutes()) {
  if (!entity) return { kind: 'text', text: REST_ITEM_TEXT.draught };
  const s = survivalOf(entity, now);
  if (s.draught) return { kind: 'text', text: REST_ITEM_TEXT.draughtHeld };
  s.draught = true;
  takeOne(item, list);
  return { kind: 'text', text: REST_ITEM_TEXT.draught };
}
/** shared.js: a draught taken, whatever the tier (the arc off, every rest is a bed's already). */
export const draughtTaken = (entity) => !!entity?.survival?.draught;
export const spendDraught = (entity) => { if (entity?.survival) entity.survival.draught = false; };

// ---- THE CANDLE: lit from the pack, knelt by through the rest key -------------------------------------------------
let _candle = null;   // { item, list } - the candle lit, waiting for the rest's channel (createRestDeps' restAct)
/** The candle the next rest kneels by, or null - AUDIT REST F4: only while it is still in `entity`'s pack (sold, dropped,
 *  stored or a load since, it is out). */
export const litCandle = (entity = null) => (_candle && (!entity || (entity.items ?? []).includes(_candle.item)) ? _candle : null);
export function useCandle(item, list) {
  _candle = { item, list };
  return { kind: 'text', text: REST_ITEM_TEXT.candleLit, closesWindow: true };
}
/** The kneel held to its end: magicka, one use. Answers the wake text. */
export function meditate(entity) {
  const c = litCandle(entity);
  _candle = null;
  if (!c || !entity) return null;
  const max = entity.maxMagicka ?? 0;
  entity.magicka = Math.min(max, (entity.magicka ?? 0) + Math.round(max * CANDLE_MAGICKA));
  const gone = spendCharge(c.item, c.list);
  return gone ? `${REST_ITEM_TEXT.meditated} ${REST_ITEM_TEXT.candleOut}` : REST_ITEM_TEXT.meditated;
}
/** A kneel stopped, or another rest begun: the candle goes back to the pack unspent. */
export const snuffCandle = () => { _candle = null; };

/** AUDIT REST-PARTY B4: ONLINE, NONE IS USED WHILE ITS SOURCES ARE SHUT (REST_ITEMS_ONLINE). Customs keeps them offline
 *  now (realmCustoms.js), but a door customs never closed - an older realm save, a trade from a build that sold them -
 *  had them in hand and working online: a laid Bedroll a rest point, a Tonic a draught. The card offers no Use
 *  (`usable`, useItem.js usableItem) and a hotbar press is told why; offline as ever. */
const restItemsShut = () => isOnlinePage() && !REST_ITEMS_ONLINE;
const offlineUse = (fn) => {
  const h = (item, list, ctx) => (restItemsShut() ? { kind: 'text', text: REST_ITEM_TEXT.notOnline } : fn(item, list, ctx));
  h.usable = () => !restItemsShut();
  return h;
};
registerItemUseHandler(REST_ITEM.Bedroll, offlineUse((item) => ({ kind: 'pitchCamp', item })));
registerItemUseHandler(REST_ITEM.EmberJar, offlineUse((item) => ({ kind: 'placeFire', item })));
registerItemUseHandler(REST_ITEM.Firewood, offlineUse((item) => ({ kind: 'placeFire', item })));
registerItemUseHandler(REST_ITEM.Tonic, offlineUse((item, list, ctx) => useTonic(item, list, ctx?.entity)));   // AUDIT REST-PARTY T1: the ladder's ctx (useItem.js), as foragingInstall.js reads it - a `{}` default typed the deploy's tsc red
registerItemUseHandler(REST_ITEM.Candle, offlineUse((item, list) => useCandle(item, list)));
registerItemUseHandler(REST_ITEM.Salts, offlineUse((item, list, ctx) => useSalts(item, list, ctx?.entity)));
registerItemUseHandler(REST_ITEM.Draught, offlineUse((item, list, ctx) => useDraught(item, list, ctx?.entity)));

// ---- the shelves and the piles -------------------------------------------------------------------------------------
/** A General Store's and an Alchemist's REST shelf: the counts (inclusive ranges), a better shop a few more. */
export const REST_SHELVES = Object.freeze({
  GeneralStore: Object.freeze([[REST_ITEM.Bedroll, 0, 1], [REST_ITEM.EmberJar, 1, 3], [REST_ITEM.Firewood, 2, 5], [REST_ITEM.Tonic, 0, 2]]),
  Alchemist: Object.freeze([[REST_ITEM.Tonic, 1, 3], [REST_ITEM.Salts, 0, 2], [REST_ITEM.Draught, 1, 2], [REST_ITEM.Candle, 1, 2]]),
});
/** The shelf's rest items for a shop kind ('GeneralStore' | 'Alchemist'), quality 1-20 - empty where the sources are
 *  not yet on. */
export function restItemsStock(kind, quality = 10, rolls = Math.random, { online = isOnlinePage() } = {}) {
  if (!restItemsAvailable(online)) return [];
  const out = [];
  for (const [t, lo, hi] of REST_SHELVES[kind] ?? []) {
    const n = lo + Math.floor(rolls() * (hi - lo + 1)) + (quality >= 15 && hi > 0 ? 1 : 0);
    for (let i = 0; i < n; i++) { const it = createRestItem(t); if (it) out.push(it); }
  }
  return out;
}
/** A dungeon pile's (keys J-O) and a looting foe's chances, in percent. */
export const REST_PILE_CHANCES = Object.freeze([[REST_ITEM.EmberJar, 4], [REST_ITEM.Tonic, 4]]);
export const REST_FOE_CHANCES = Object.freeze([[REST_ITEM.EmberJar, 2]]);
/** A pile's or a foe's roll: each item at its chance, minted into `items`. */
export function rollRestLoot(items, chances, rolls = Math.random, { online = isOnlinePage() } = {}) {
  if (!Array.isArray(items) || !restItemsAvailable(online)) return items;
  for (const [t, pct] of chances) if (rolls() * 100 < pct) { const it = createRestItem(t); if (it) items.push(it); }
  return items;
}
/** The J-O window of LootTables.GenerateLoot (loot.js addPileLootExtras' own). */
export const isDeepPileKey = (key) => { const a = String(key ?? '').charCodeAt(0) - 64; return a >= 10 && a <= 15; };
/** The piles' and the foes' hooks, subscribed last (scenes/shared.js, after Foraging's): a draw taken here is after
 *  every other subscriber's, so none of theirs moves. */
export function installRestItemLoot() {
  registerTabledLootHandler('REST', ({ key, items, rolls }) => { if (isDeepPileKey(key)) rollRestLoot(items, REST_PILE_CHANCES, rolls); });
  registerEnemyLootExtra('REST', ({ items, rolls }) => { rollRestLoot(items, REST_FOE_CHANCES, rolls); });
}
