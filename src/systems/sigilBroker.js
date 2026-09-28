// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SET7 (2026-09-26) — THE SIGIL BROKER: SIGIL STONES BUY THE DAY'S STOCK.
//
// Mac: "Sigil stones become a currency to trade for daily reset sigil
// items at a new NPC vendor that stands outside the oblivion gate".
// Design, and the record of every slice: bible/11-Multiplayer/
// Sigil-Sets.md section 7.
//
// ═══ THIS FILE IS THE LAW ══════════════════════════════════════════
//
// Pure: the day's stock, minted from the DAY ALONE, and what buying
// asks. Where the Broker stands, how he looks and the window he opens
// are the host's (scenes/world.js, ui/brokerWindow.js).
//
// THE DAY is the UTC day of the shared clock (the relay's), so every
// player in the Bay sees the same stock, and it turns over at midnight
// UTC. THE STOCK is minted from FIXED TABLES - the game's own templates
// and materials by index, never a roll over the registered custom
// pieces or the player's level (the WB5 spoils read the player's world;
// a shop every player shares must not) - on the day's own seeded
// stream: a piece of each of the four sets of the world (a body piece
// or a shield, Rare - Legendary one time in four, off the base game's
// own records), a set weapon, and one piece of Ruhn's Regalia. Every
// piece is KNOWN and fresh at Faint, won in a fight of one. THE PRICE
// is in Sigil Stones - the gate's own trophy, one a kill. SS1: the
// stones STACK (systems/gateSpoils.js), so a purse is counted over its
// stacks and a price drawn from them, first record first.
//
// ONE OF EACH A DAY, A PLAYER: an offer bought is marked for its day in
// the CHARACTER'S SAVE (systems/modSaveData.js, the save's own slot for
// a record beside the character) - never the device's: the record must
// travel with the pack it describes, so a save loaded from before a
// sale holds its stones AND its unmarked offer, and nothing is made
// twice; a cloud save carries it to another device. A new day's stock
// is a new list, so yesterday's marks buy nothing. Client-side, as
// every shop's law here is: no server checks a sale.
// ═══════════════════════════════════════════════════════════════════

import { seededRng } from './wind.js';
import { gateHash } from '../net/gateLaw.js';
import { setItemFields, mintCondition } from './itemTemplates.js';
import { ARMOR_MATERIAL } from './armorMaterials.js';
import { WEAPON_MATERIALS } from '../characters/weapons.js';
import { createWeapon } from '../combat/enemyEquipment.js';
import { applyRarity, LEGENDARIES } from './lootRarity.js';
import { SIGIL_BANDS } from './sigil.js';
import { WORLD_SET_IDS, setById } from './sigilSets.js';
import { REGALIA, mintAetheric } from './aetheric.js';
import { SIGIL_STONE_TEMPLATE, isSigilStone, sigilStone } from './gateSpoils.js';
import { registerModSaveData } from './modSaveData.js';
import { isLocked } from './itemLock.js';
import { addItem } from './inventory.js';
import { isEquipped } from './equip.js';   // SS5: a worn ware is taken off before it is dismantled

/** A day of the shared clock, in milliseconds - the stock's life. */
export const BROKER_DAY_MS = 86_400_000;
/** The stock's own salt on the day's seed ("SIGL"). */
const BROKER_SALT = 0x5349474c;
/** The day of a wall-clock time (the shared clock's: the relay's time, never this machine's). */
export const brokerDay = (nowMs) => Math.floor(Number(nowMs) / BROKER_DAY_MS);
/** The milliseconds until the stock turns over. */
export const brokerTurnsIn = (nowMs) => BROKER_DAY_MS - (((Number(nowMs) % BROKER_DAY_MS) + BROKER_DAY_MS) % BROKER_DAY_MS);

/** The prices, in Sigil Stones: a Rare set piece, a Legendary one, a set weapon, a piece of the Regalia. SS2 (2026-09-27,
 *  Mac: "raise the prices on the new boss vendor"): twice SET7's 2 / 3 / 3 / 6, the four in the same proportion. A
 *  receipt is a gate's and a gate opens every two hours - twelve stones a day to a player at every one, two thirds of
 *  SET7's whole stock; and the Regalia now costs twice the kills its own drop (a sixth of them) takes on average. */
export const BROKER_PRICES = Object.freeze({ rare: 4, legendary: 6, weapon: 6, regalia: 12 });
/** A Legendary among the four set pieces one time in this many. */
export const BROKER_LEGENDARY_IN = 4;
/** The armour the Broker sells, by the place it is worn - the seven body pieces, then the shield's place (one of the
 *  four shields) - so a shield is one place in eight, as it is on the body. The game's own template indices. */
export const BROKER_ARMOR_PLACES = Object.freeze([102, 103, 104, 105, 106, 107, 108, 'shield']);
export const BROKER_SHIELDS = Object.freeze([109, 110, 111, 112]);
/** The weapons: every classic blade, blunt and bow (never the arrow), by index. */
export const BROKER_WEAPONS = Object.freeze([113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130]);
/** The makes a Broker's goods come in - the finer half of the ladder, the same six for armour and weapons. */
export const BROKER_ARMOR_MATERIALS = Object.freeze([ARMOR_MATERIAL.Dwarven, ARMOR_MATERIAL.Mithril, ARMOR_MATERIAL.Adamantium, ARMOR_MATERIAL.Ebony, ARMOR_MATERIAL.Orcish, ARMOR_MATERIAL.Daedric]);
export const BROKER_WEAPON_MATERIALS = Object.freeze([WEAPON_MATERIALS.Dwarven, WEAPON_MATERIALS.Mithril, WEAPON_MATERIALS.Adamantium, WEAPON_MATERIALS.Ebony, WEAPON_MATERIALS.Orcish, WEAPON_MATERIALS.Daedric]);

const pick = (list, rolls) => list[Math.min(list.length - 1, Math.floor(rolls() * list.length))];
/** The base game's own Legendary records that fit an item - never a registered one (a mod's differs by machine). */
const baseLegendaries = (item) => LEGENDARIES.filter((l) => l.group === item.group && (!l.templates || l.templates.includes(item.templateIndex)));

/** A set's piece of armour or a shield: a Rare (a Legendary one time in BROKER_LEGENDARY_IN, when a record fits), known,
 *  its set's sigil fresh at Faint. */
function setArmour(set, rolls) {
  const place = pick(BROKER_ARMOR_PLACES, rolls);
  const templateIndex = place === 'shield' ? pick(BROKER_SHIELDS, rolls) : place;
  const item = mintCondition(setItemFields({ group: 'Armor', templateIndex, material: pick(BROKER_ARMOR_MATERIALS, rolls), flags: 0 }));
  const legendary = rolls() * BROKER_LEGENDARY_IN < 1 && baseLegendaries(item).length > 0;
  applyRarity(item, legendary ? 'legendary' : 'rare', rolls, legendary ? baseLegendaries(item) : null);
  item.isIdentified = true;
  item.sigil = { set, party: 1, xp: 0 };
  return item;
}
/** A set weapon: Rare, known, its blow from the Rare band and its set, fresh at Faint. */
function setWeapon(set, rolls) {
  const item = createWeapon(pick(BROKER_WEAPONS, rolls), pick(BROKER_WEAPON_MATERIALS, rolls), rolls);
  applyRarity(item, 'rare', rolls);
  item.isIdentified = true;
  const [lo, hi] = SIGIL_BANDS.rare;
  item.sigil = { power: lo + Math.floor(rolls() * (hi + 1 - lo)), set, party: 1, xp: 0 };
  return item;
}

/**
 * THE DAY'S STOCK: six offers, the same for every player that day - `{ id, day, slot, kind, set, price, item }`, `kind`
 * 'armour' (slots 0-3: Malacath's, Dagon's, Nocturnal's, Mora's), 'weapon' (slot 4, a set of the world's) or 'regalia'
 * (slot 5, Ruhn's). A fresh list of fresh items every call: a sale hands the buyer a copy of nothing shared.
 * @param {number} day
 */
export function brokerStock(day) {
  const d = Math.trunc(Number(day)) || 0;
  const rolls = seededRng(gateHash(d >>> 0, BROKER_SALT));
  const offers = [];
  // SS4 (Mac: "make the items sold by the oblivion vendor bound also"): every ware is BOUND - the shown piece and the
  // sale's fresh mint alike (the sale mints it off this same list) - so what the stones bought stays with its buyer;
  // SS5: and it carries its price (`stonesPaid`), what its dismantle gives a share of back
  const offer = (kind, set, price, item) => { item.bound = true; item.stonesPaid = price; offers.push({ id: `${d}:${offers.length}`, day: d, slot: offers.length, kind, set, price, item }); };
  for (const set of WORLD_SET_IDS) {
    const item = setArmour(set, rolls);
    offer('armour', set, item.rarity === 'legendary' ? BROKER_PRICES.legendary : BROKER_PRICES.rare, item);
  }
  const wset = pick(WORLD_SET_IDS, rolls);
  offer('weapon', wset, BROKER_PRICES.weapon, setWeapon(wset, rolls));
  offer('regalia', 'ruhn', BROKER_PRICES.regalia, mintAetheric(pick(REGALIA, rolls)));
  return offers;
}

/** The Sigil Stones' records in a list of items (SS1: a record may be a stack). */
export const stonesIn = (items) => (Array.isArray(items) ? items.filter((it) => isSigilStone(it)) : []);
/** SS1: how many Sigil Stones a list holds - a stack counts whole. */
export const stoneCount = (items) => stonesIn(items).reduce((n, it) => n + Math.max(1, it.stackCount ?? 1), 0);
/** SS1: the stones a price takes, first records first - `[{ item, count }]`, a stack giving what the price still asks
 *  of it (all of it, or the rest of the price). */
export function stonesToTake(items, price) {
  const take = [];
  let left = price;
  for (const item of stonesIn(items)) {
    if (left <= 0) break;
    const count = Math.min(left, Math.max(1, item.stackCount ?? 1));
    take.push({ item, count });
    left -= count;
  }
  return take;
}
/** The stones a sale may spend: the unlocked ones (LOCK1 - a locked piece is never dropped, sold or traded, and a stone
 *  spent is a stone sold). And the locked ones, which the purse names beside them. */
export const spendableStonesIn = (items) => stonesIn(items).filter((it) => !isLocked(it));
export const lockedStonesIn = (items) => stonesIn(items).filter((it) => isLocked(it));

/**
 * What an offer asks of a buyer now: `{ ok, reason, price, have }` - reason 'bought' (one of each a day), 'stones' (too
 * few), 'gone' (not today's), or null when it may be bought.
 * @param {{ id: string, day: number, price: number } | null} offer @param {{ items?: any[], bought?: Iterable<string>, day?: number }} state
 */
export function brokerOfferState(offer, { items = [], bought = [], day = null } = {}) {
  const have = stoneCount(items);
  if (!offer) return { ok: false, reason: 'gone', price: 0, have };
  const price = offer.price;
  if (day != null && offer.day !== day) return { ok: false, reason: 'gone', price, have };
  if (new Set(bought).has(offer.id)) return { ok: false, reason: 'bought', price, have };
  if (have < price) return { ok: false, reason: 'stones', price, have };
  return { ok: true, reason: null, price, have };
}

/**
 * THE SALE, planned: the stones it takes (`[{ item, count }]`, the first `price` Sigil Stones in the list, over its
 * stacks) and the item it gives - the offer's
 * piece MINTED AGAIN off its day (the stock is the day's alone, so the mint is the same piece), never the one the window
 * shows: the buyer's is theirs, and nothing they do to it reaches back into the list. Or `{ ok: false, reason }`.
 */
export function brokerSale(offer, state) {
  const s = brokerOfferState(offer, state);
  if (!s.ok) return { ok: false, reason: s.reason };
  // AUDIT SS: THE OFFER IS THE STOCK'S OWN - its id and price as the day minted them, or it is gone. The piece was minted
  // off the slot while the price and the mark were the caller's, so an offer written by hand (a console, a mod) bought
  // the Regalia for one stone, and since SS5 its dismantle paid back six
  const real = brokerStock(offer.day)[offer.slot] ?? null;
  if (!real || real.id !== offer.id || real.price !== offer.price) return { ok: false, reason: 'gone' };
  const give = real.item;
  return { ok: true, take: stonesToTake(state.items, offer.price), give };
}

/**
 * THE SALE, MADE, on a pack (`items`, the list itself): the spendable stones out, the piece in, the offer marked for its
 * day - in that order, and all of it or none of it. Refused (`{ ok: false, reason }`, nothing moved) as the law refuses
 * (bought, stones, gone), and 'heavy' when the host's carry gate - `canCarry(item, rest)`, the pack as the stones leave
 * it - says the piece is too much to carry (itemTransfer.js planTake, the pack's own). Answers `{ ok: true, item }`.
 * @param {any} offer @param {{ items: any[], day: number, canCarry?: (item: any, rest: any[]) => boolean }} at
 */
export function makeBrokerSale(offer, { items, day, canCarry = () => true }) {
  if (!Array.isArray(items)) return { ok: false, reason: 'gone' };
  const sale = brokerSale(offer, { items: spendableStonesIn(items), bought: brokerBought(day), day });
  if (!sale.ok) return sale;
  // the pack as the stones leave it (SS1): a stack the price empties gone, one it draws on at what it keeps
  const rest = [];
  for (const it of items) {
    const t = sale.take.find((e) => e.item === it);
    if (!t) rest.push(it);
    else if (t.count < Math.max(1, it.stackCount ?? 1)) rest.push({ ...it, stackCount: it.stackCount - t.count });
  }
  if (!canCarry(sale.give, rest)) return { ok: false, reason: 'heavy' };
  for (const { item, count } of sale.take) {
    const have = Math.max(1, item.stackCount ?? 1);
    if (count >= have) items.splice(items.indexOf(item), 1);
    else item.stackCount = have - count;
  }
  addItem(items, sale.give);
  markBrokerBought(offer);
  return { ok: true, item: sale.give };
}

// ── the record: what this character bought, and the day it bought it ──
/** The save's slot for the record (systems/modSaveData.js), under this name. */
export const BROKER_SAVE_VENDOR = 'SigilBroker';
const NO_RECORD = () => ({ day: -1, ids: [] });
let _bought = NO_RECORD();
/** A record off a save, or none: a whole day and at most a day's offers, each an id the stock could mint. */
export function validBrokerRecord(r) {
  if (!r || typeof r !== 'object' || !Number.isSafeInteger(r.day) || !Array.isArray(r.ids) || r.ids.length > 32) return NO_RECORD();
  if (!r.ids.every((x) => typeof x === 'string' && /^-?\d+:\d+$/.test(x))) return NO_RECORD();
  return { day: r.day, ids: [...new Set(r.ids)] };
}
/** The offers this character bought on `day` (none for any other day). */
export const brokerBought = (day) => (_bought.day === day ? [..._bought.ids] : []);
/** Mark an offer bought - a new day starts a new record. */
export function markBrokerBought(offer) {
  if (!offer) return;
  if (_bought.day !== offer.day) _bought = { day: offer.day, ids: [] };
  if (!_bought.ids.includes(offer.id)) _bought.ids.push(offer.id);
}
registerModSaveData(BROKER_SAVE_VENDOR, {
  newSaveData: NO_RECORD,
  getSaveData: () => ({ day: _bought.day, ids: [..._bought.ids] }),
  restoreSaveData: (r) => { _bought = validBrokerRecord(r); },
});

// ── SS5: the dismantle - a ware given back for stones ──
/** SS5 (2026-09-27, Mac: "The ability to dismantle in the inventory and recieve back sigil stones", the Broker's wares
 *  alone for now): the share of a ware's price its dismantle gives back - half, rounded down: a Rare piece's 4 give 2,
 *  a Legendary's or a weapon's 6 give 3, the Regalia's 12 give 6 - so a ware is never a free try of the day's stock. */
export const BROKER_DISMANTLE_SHARE = 0.5;
/** A count of stones in the Broker's words - "1 Sigil Stone", "4 Sigil Stones" (his window's purse and sale, the
 *  dismantle's). */
export const stonesText = (n) => `${n} Sigil Stone${n === 1 ? '' : 's'}`;
/** The stones a piece dismantles into: its share of what the Broker took for it (`stonesPaid`, marked at the mint -
 *  brokerStock), at least one; 0 for a piece the Broker never sold - a drop, or a ware bought before SS5. A ware is
 *  BOUND (SS4) as well as priced, and both marks are read: no list a peer hands over lands a bound piece
 *  (itemBound.js unbound), so a price a peer wrote on a piece of its own never pays out. */
export function dismantleStones(item) {
  const paid = item?.stonesPaid;
  return item?.bound === true && Number.isSafeInteger(paid) && paid > 0 ? Math.max(1, Math.floor(paid * BROKER_DISMANTLE_SHARE)) : 0;
}
/** Why a piece may not be dismantled now - 'not' (the Broker never sold it), 'worn' (taken off first), 'locked' (the
 *  player's own word, LOCK1 - it closes every way a piece could be lost for good) - or null. */
export function dismantleRefusal(item) {
  if (!dismantleStones(item)) return 'not';
  if (isEquipped(item)) return 'worn';
  if (isLocked(item)) return 'locked';
  return null;
}
/**
 * THE DISMANTLE, MADE, on a pack (`items`, the list itself): the ware out, its stones in - joining the pack's unlocked
 * stack (addItem: a locked stack takes only locked stones) - all of it or none of it. Refused (`{ ok: false, reason }`,
 * nothing moved) as dismantleRefusal refuses, and 'gone' for a piece that is not in the pack. The day's mark stays: a
 * ware dismantled is not bought again that day. Answers `{ ok: true, stones }`.
 * @param {any} item @param {{ items: any[] }} at
 */
export function dismantleWare(item, { items }) {
  if (!Array.isArray(items) || !items.includes(item)) return { ok: false, reason: 'gone' };
  const why = dismantleRefusal(item);
  if (why) return { ok: false, reason: why };
  const stones = dismantleStones(item);
  items.splice(items.indexOf(item), 1);
  addItem(items, Object.assign(sigilStone(), { stackCount: stones }));
  return { ok: true, stones };
}
/** The dismantle's words: the question (the enhanced pack's), the classic pack's offer where its drop was refused, the
 *  worn piece's refusal, and what was done (BROKER_SOLD's shape). */
export const dismantleAsk = (name, n) => [`Dismantle ${name}?`, `It is gone for good, and you get ${stonesText(n)} back.`];
export const DISMANTLE_INSTEAD = (n) => `Dismantle it for ${stonesText(n)} instead?`;
export const DISMANTLE_WORN = (name) => `Take off ${name} before dismantling it.`;
export const DISMANTLED = (name, n) => `Dismantled: ${name}, for ${stonesText(n)}.`;

/** The words a refused offer wears, and the set an offer belongs to by name. */
export const BROKER_REFUSALS = Object.freeze({ bought: 'Bought today', stones: 'Not enough Sigil Stones', gone: 'Gone with the day', heavy: 'Too heavy to carry' });
export const offerSetName = (offer) => setById(offer?.set)?.name ?? '';
export { SIGIL_STONE_TEMPLATE };
/** Tests only: forget the record. */
export function _resetBrokerForTests() { _bought = NO_RECORD(); }
