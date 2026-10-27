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
// stones STACK (systems/gate/gateSpoils.js), so a purse is counted over its
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

import { seededRng } from '../wind/wind.js';
import { gateHash } from '../../net/gate/gateLaw.js';
import { setItemFields, mintCondition } from '../item/itemTemplates.js';
import { ARMOR_MATERIAL } from '../armorMaterials.js';
import { WEAPON_MATERIALS } from '../../characters/weapons.js';
import { createWeapon } from '../../combat/enemyEquipment.js';
import { applyRarity, LEGENDARIES } from '../loot/lootRarity.js';
import { SIGIL_BANDS } from './sigil.js';
import { WORLD_SET_IDS, setById } from './sigilSets.js';
import { REGALIA, mintAetheric } from '../aetheric.js';
import { SIGIL_STONE_TEMPLATE, isSigilStone, sigilStone } from '../gate/gateSpoils.js';
import { registerModSaveData } from '../modSaveData.js';
import { isLocked } from '../item/itemLock.js';
import { addItem } from '../inventory.js';
import { isEquipped } from '../equip.js';   // SS5: a worn ware is taken off before it is dismantled
import { EG_SINK_EMBERS, EG_PANOPLY_IDS } from '../../net/eliteGates/egPay.js';   // EG-E1: the Panoply sink's price and its pieces
import { BROKER_RID_RE, mintBrokerRid, insigniaById } from '../../net/insignia.js';   // AUDIT FB1024 (BROKER-RID): a press's request id, an owed insignia's price
import { t } from '../textManager.js';   // BROKER-RID: the owed sale's word, in the player's language

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
  takeFromPack(items, sale.take);
  addItem(items, sale.give);
  markBrokerBought(offer);
  return { ok: true, item: sale.give };
}

/**
 * WB9g: THE INSIGNIA'S PRICE, TAKEN (net/insignia.js - the title and the aura the account keeps): `price` unlocked Sigil
 * Stones out of the pack (`items`, the list itself), first records first - a stack the price empties gone, one it
 * draws on at what it keeps - all of it or none of it. Answers whether it was taken. The account service's sale is the
 * other half, and comes first: a sale the service refused takes nothing here.
 * @param {any[]} items @param {number} price
 */
export function spendStones(items, price) {
  if (!Array.isArray(items) || !(price > 0)) return false;
  const spendable = spendableStonesIn(items);
  if (stoneCount(spendable) < price) return false;
  takeFromPack(items, stonesToTake(spendable, price));
  return true;
}

/**
 * DAEDRIC-SMELT (bible/06-Systems/Professions-Arc.md section 53): THE PACK'S HALF OF A WORK THAT SPENDS EMBERS - the
 * Daedric smelt's (net/professionLaw.js workEmbers) - on the insignia's own law (insigniaSale): `held()` the unlocked
 * embers the pack (`entity()`'s items) holds, `take(n)` n of them out, all of them or none (spendStones), with the
 * `back` that puts them back as one stack (the service refused the work, or its answer never came - net/profBook.js
 * smelt gives them back on every answer but the work's own). `changed` the host's checkpoint, asked on every move - the
 * Broker's `save`. The account service's purse is the other half, and the bound (server-account/src/professions.js
 * smeltAtForge): no pack spends an ember its purse does not hold. `entity` the player (its `items` read at each call).
 * @param {any} entity @param {() => void} [changed]
 */
export function emberHands(entity, changed = () => {}) {
  const items = () => (Array.isArray(entity?.items) ? entity.items : null);
  return Object.freeze({
    held: () => stoneCount(spendableStonesIn(items() ?? [])),
    take: (/** @type {number} */ n) => {
      const list = items();
      if (!list || !spendStones(list, n)) return { taken: 0, back: () => {} };
      changed();
      let given = false;   // the take put back once, however many doors ask it
      return { taken: n, back: () => { if (given) return; given = true; addItem(list, Object.assign(sigilStone(), { stackCount: n })); changed(); } };
    },
  });
}

/** AUDIT WB9 (insignia F2): an answer from the account service that may have been WRITTEN all the same - the service
 *  unreached (no status: `offline`), or failing (5xx) where its UPDATE may already have run. A 4xx is its own refusal:
 *  nothing was written. AUDIT FB1024 (lane C M1): nor is `no-session` - the door sent nothing. */
export const insigniaUnheard = (r) => !r?.ok && r?.error !== 'no-session' && !(Number.isFinite(r?.status) && r.status < 500);

/**
 * AUDIT WB9 (insignia F1, F2): THE INSIGNIA'S SALE, BOTH HALVES. The pack's price is taken FIRST, so nothing spent while
 * the service is asked - a ware bought, a stack dropped or locked - can leave it untaken (the service's half came first,
 * and a pack short by its answer paid nothing); then the account service's sale (`buy(id, rid)`). A sale the service holds
 * is kept and `save`d at once - its half is already written, and a page closed before the next checkpoint kept the stones
 * as well; one it refused gives the stones back. AUDIT FB1024 (BROKER-RID): the press carries its own request id, and one
 * whose answer was lost (insigniaUnheard) is asked after BY THAT ID (`settle`, the service's /v1/broker/settle): held, it
 * is the sale; fenced, the stones come back, and the press can never land after; not heard either, the sale is OWED
 * (settleOwedSales). Answers `{ ok: true, data }` (the service's wardrobe) or `{ ok: false, error }` ('stones': the pack
 * short; 'unheard': owed, or the owed list full).
 * @param {{ id: string, price: number }} offer
 * @param {{ items: any[], buy: (id: string, rid: string) => Promise<any>, settle: (body: any) => Promise<any>, save: () => void, account: string|null, rid?: string }} io
 */
export async function insigniaSale(offer, { items, buy, settle, save, account, rid = mintBrokerRid() }) {
  if (_owed.length >= OWED_MAX) return { ok: false, error: 'unheard' };   // what is owed settles first - nothing taken
  if (!spendStones(items, offer?.price)) return { ok: false, error: 'stones' };
  let r;
  try { r = await buy(offer.id, rid); } catch { r = { ok: false, error: 'offline' }; }
  if (insigniaUnheard(r)) {
    const s = await askAfter(settle, rid);
    if (!s) return oweSale({ kind: 'insignia', id: offer.id, embers: offer.price, rid, account }, items, save);
    if (s.held) r = { ok: true, data: s };   // the settle carries the wardrobe (/v1/broker/settle)
  }
  if (!r?.ok) {
    addItem(items, Object.assign(sigilStone(), { stackCount: offer.price }));   // the stones back: the service holds no sale
    return { ok: false, error: typeof r?.error === 'string' ? r.error : 'offline' };
  }
  save();
  return { ok: true, data: r.data };
}

/**
 * EG-E1 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 19, THE SINK): THE
 * BROKER'S PANOPLY PIECE, BOTH HALVES - one piece of the buyer's choosing (`piece`, one of EG_PANOPLY_IDS), once an account
 * an arena week, for EG_SINK_EMBERS - the insignia's sale's own order (insigniaSale): the piece minted first (`mint` - the
 * host's, off the Panoply's records: a piece it cannot make is never paid for), the embers taken from the pack, then the
 * account service's sale (`buy(piece, rid)` - server-account/src/egEconomy.js egSink); one it refused gives the embers
 * back; one whose answer was lost is asked after by its request id, as the insignia's is (AUDIT FB1024, BROKER-RID): held
 * and this ask the first, the piece; fenced, the embers back; not heard, owed. A sale held adds the piece and is `save`d at
 * once. The piece carries no `stonesPaid`: it is not the day's stock, and no dismantle pays its embers back (itemLaw.js's
 * Broker price check). Answers `{ ok: true, data, item }` or `{ ok: false, error }` ('piece': not a piece the host can
 * mint; 'stones': the pack short; 'unheard': owed, or the owed list full).
 * @param {string} piece
 * @param {{ items: any[], buy: (piece: string, rid: string) => Promise<any>, settle: (body: any) => Promise<any>, mint: (piece: string) => any, save: () => void, account: string|null, rid?: string }} io
 */
export async function panoplySale(piece, { items, buy, settle, mint, save, account, rid = mintBrokerRid() }) {
  if (!EG_PANOPLY_IDS.includes(piece)) return { ok: false, error: 'piece' };
  if (_owed.length >= OWED_MAX) return { ok: false, error: 'unheard' };   // what is owed settles first - nothing taken
  let item = null;
  try { item = mint(piece); } catch { item = null; }
  if (!item) return { ok: false, error: 'piece' };
  if (!spendStones(items, EG_SINK_EMBERS)) return { ok: false, error: 'stones' };
  let r;
  try { r = await buy(piece, rid); } catch { r = { ok: false, error: 'offline' }; }
  if (insigniaUnheard(r)) {
    const s = await askAfter(settle, rid);
    if (!s) return oweSale({ kind: 'panoply', id: piece, embers: EG_SINK_EMBERS, rid, account }, items, save);
    if (s.held && !s.mine) return { ok: false, error: 'unheard' };   // another ask took the piece first: never twice
    if (s.held) r = { ok: true, data: { ok: true, piece, week: s.week } };
  }
  if (!r?.ok) {
    addItem(items, Object.assign(sigilStone(), { stackCount: EG_SINK_EMBERS }));   // the embers back: the service holds no sale
    return { ok: false, error: typeof r?.error === 'string' ? r.error : 'offline' };
  }
  delete item.stonesPaid;
  addItem(items, item);
  save();
  return { ok: true, data: r.data, item };
}

/** The stones out of the pack (`items`, the list itself), as `take` names them (`{ item, count }` each): a stack the
 *  count empties gone, one it draws on at what it keeps (SS1). The sale's and the insignia's one hand. */
function takeFromPack(items, take) {
  for (const { item, count } of take) {
    const have = Math.max(1, item.stackCount ?? 1);
    if (count >= have) items.splice(items.indexOf(item), 1);
    else item.stackCount = have - count;
  }
}

// ── BROKER-RID (AUDIT FB1024, 2026-10-25, the owner: "Audit this", of FIELD BUGS 2026-10-24's EMBERS-OWED - #bug-reports:
// "the transaction never went through, the embers were not taken out and I didn't get the piece ... I now have 52 deadlands
// embers on me, and it will not let me buy the aura, it says I have too few") ──
// A sale is two ledgers: the pack's embers, and the account's purse the service spends. A sale whose answer was lost and
// whose question after went unheard too had its embers given back while the service had written it - the pack 20 over
// what the account would ever spend. EMBERS-OWED owed such a sale and settled it by asking what the account held that
// week; the audit's lanes broke that three ways (an earlier honest sale answering for a press that never landed - pieces
// without end; the week turning between the press and its question; a save loaded again minting the piece again). So a
// press carries a request id (src/net/insignia.js BROKER_RID_RE) and is asked after by it alone: the service answers the
// sale that id wrote, or fences the id so the press can never land after (server-account/src/brokerSales.js). An owed
// sale is `{ kind, id, embers, rid, account }`, rides the save (`SigilBrokerOwed`), and is settled by the Broker's next
// open under the account that made it: held, the piece - if this page's ask was the FIRST (`by`), so a save loaded again
// is told it was handed out; an insignia's is the account's already; fenced, the embers back. At most OWED_MAX; past it a
// press is refused before anything is taken.
export const OWED_MAX = 8;
export const BROKER_OWED_VENDOR = 'SigilBrokerOwed';
/** What the Broker says of a sale owed, in the player's language. */
export const BROKER_OWED_TEXT = 'No answer from the account service. Your embers are held, and the Broker settles the sale on your next visit.';
export const brokerOwedText = () => t('broker.owed', BROKER_OWED_TEXT);
let _owed = [];
/** The request ids a settle is on the wire for (never two asks of one sale at once). */
const _asking = new Set();
/** This page's asks whose answers were lost, by request id - each its nonce: the first ask may have been one of them. */
const _lost = new Map();
const owedPrice = (kind, id) => (kind === 'panoply' ? (EG_PANOPLY_IDS.includes(id) ? EG_SINK_EMBERS : 0) : (insigniaById(id)?.price ?? 0));
const owedRow = (o) => ({ kind: o.kind, id: o.id, embers: o.embers, rid: o.rid, account: o.account });
const validOwedRow = (o) => !!o && typeof o === 'object' && (o.kind === 'insignia' || o.kind === 'panoply') && typeof o.id === 'string'
  && o.embers > 0 && o.embers === owedPrice(o.kind, o.id) && typeof o.rid === 'string' && BROKER_RID_RE.test(o.rid)
  && typeof o.account === 'string' && o.account.length > 0 && o.account.length <= 64;
/** A save's owed list, or none: each row whole, priced as its sale is, one a request id, at most OWED_MAX. */
export function validOwed(r) {
  if (!Array.isArray(r)) return [];
  const seen = new Set();
  return r.filter((o) => validOwedRow(o) && !seen.has(o.rid) && seen.add(o.rid)).slice(-OWED_MAX).map(owedRow);
}
/** The sales owed now. */
export const brokerOwed = () => _owed.map(owedRow);
registerModSaveData(BROKER_OWED_VENDOR, {
  newSaveData: () => [],
  getSaveData: () => brokerOwed(),
  restoreSaveData: (r) => { _owed = validOwed(r); },
});
/** A sale whose answer and question after were both lost: owed, under the account that made it - or, signed out (no
 *  account to ask under), refused as the door refused it, the embers back. */
function oweSale(row, items, save) {
  if (!row.account) { addItem(items, Object.assign(sigilStone(), { stackCount: row.embers })); return { ok: false, error: 'no-session' }; }
  _owed = [..._owed, row];
  save();
  return { ok: false, error: 'unheard' };
}
const lostAsk = (rid, nonce) => _lost.set(rid, [...(_lost.get(rid) ?? []), nonce].slice(-OWED_MAX));
/** Ask the service after a press by its request id, with this ask's own nonce. Answers its settle - `{ held, kind, item,
 *  week?, mine, ...wardrobe }`, `mine` where the FIRST ask was this one or one of this page's lost ones - or null where it
 *  was not heard (a lost answer's nonce kept: it may have been the first). */
async function askAfter(settle, rid) {
  const nonce = mintBrokerRid();
  let a = null;
  try { a = await settle({ rid, nonce }); } catch { a = null; }
  if (!a?.ok || typeof a.data?.held !== 'boolean') {
    if (insigniaUnheard(a)) lostAsk(rid, nonce);
    return null;
  }
  const mine = a.data.by === nonce || (_lost.get(rid) ?? []).includes(a.data.by);
  return { ...a.data, mine };
}
/**
 * THE BROKER'S NEXT OPEN - every owed sale of the signed-in account (`account()`) asked after by its request id, one ask a
 * sale at once: fenced, the embers back into the pack as it stands NOW (`items()` - a save loaded while it was asked is
 * the pack that is owed); a Panoply sale held and first asked here, the piece (`mint`); held and handed out to an ask
 * elsewhere (a save loaded again), nothing more; an insignia held, the account's. Each settled one is struck and saved.
 * @param {{ settle: (body: any) => Promise<any>, account: () => string|null, items: () => any[], save: () => void, mint: (piece: string) => any }} io
 */
export async function settleOwedSales({ settle, account, items, save, mint }) {
  const me = account();
  for (const row of _owed.filter((o) => o.account === me && !_asking.has(o.rid))) {
    _asking.add(row.rid);
    try {
      const s = await askAfter(settle, row.rid);
      if (!s) continue;
      const live = _owed.find((o) => o.rid === row.rid);
      if (s.held && s.kind === 'panoply' && s.mine) {
        let it = null;
        try { it = live ? mint(live.id) : null; } catch { it = null; }
        if (!it) { lostAsk(row.rid, s.by); continue; }   // the piece still owed to this page's first ask
        delete it.stonesPaid;
        addItem(items(), it);
      } else if (!s.held && live) addItem(items(), Object.assign(sigilStone(), { stackCount: live.embers }));
      if (!live) continue;
      _owed = _owed.filter((o) => o.rid !== row.rid);
      _lost.delete(row.rid);
      save();
    } finally { _asking.delete(row.rid); }
  }
}
/**
 * The host's one door to the Broker's two sales and the owed ones (HOST-SPLIT: one statement there): `insignia(offer,
 * buy)` and `panoply(piece, buy)` each a sale with this pack, the save, the settle door (`settleDoor(ioOf(), body)`) and
 * the account `ioOf()` names; `settled(ask)` settles what is owed, then answers `ask()` for the window's own use.
 * @param {{ items?: any[] }} entity @param {{ changed: () => void }} saver @param {(piece: string) => any} mint
 * @param {() => ({ account?: string|null } | null)} ioOf @param {(io: any, body: any) => Promise<any>} settleDoor
 */
export function brokerOwedDoor(entity, saver, mint, ioOf, settleDoor) {
  const items = () => (entity.items ??= []);
  const save = () => saver.changed();
  const settle = (body) => settleDoor(ioOf(), body);
  const account = () => ioOf()?.account ?? null;
  return {
    insignia: (offer, buy) => insigniaSale(offer, { items: items(), buy, settle, save, account: account() }),
    panoply: (piece, buy) => panoplySale(piece, { items: items(), buy, settle, mint, save, account: account() }),
    settled: async (ask) => { await settleOwedSales({ settle, account, items, save, mint }); return ask(); },
  };
}
/** Tests: the owed list and this page's asks cleared. */
export function _resetOwed() { _owed = []; _asking.clear(); _lost.clear(); }

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
/** A count of stones in the Broker's words - "1 Deadlands Ember", "4 Deadlands Embers" (his window's purse and sale,
 *  the dismantle's; WB12a - the Sigil Stone's new name). */
export const stonesText = (n) => `${n} Deadlands Ember${n === 1 ? '' : 's'}`;
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
/** AUDIT FB1025i A8: A WARE BY ITS NAME AND ITS SET - a Legendary wears its base record's name, so two days' offers can
 *  share one ("The Warden" was Malacath's on 2026-10-22 and Mora's on 2026-10-25), and a dismantle asked of "The Warden"
 *  could not say which. "The Warden (Mora's Mantle)"; a piece of no set, its name. */
export const wareName = (name, item) => { const set = setById(item?.sigil?.set)?.name; return set ? `${name} (${set})` : name; };
export const dismantleAsk = (name, n) => [`Dismantle ${name}?`, `You get ${stonesText(n)} back. This cannot be undone.`];   // WB13b: the gain, then the warning
export const DISMANTLE_INSTEAD = (n) => `Dismantle it for ${stonesText(n)} instead?`;
export const DISMANTLE_WORN = (name) => `Take off ${name} before dismantling it.`;
export const DISMANTLED = (name, n) => `Dismantled: ${name}, for ${stonesText(n)}.`;

/** The words a refused offer wears, and the set an offer belongs to by name. FIELD BUGS 2026-10-25i BOUGHT-YOURS
 *  (#bug-reports, "Can't buy this piece": "I did dismantle the other chest i bought days ago, but still i cant buy this
 *  one"): 'bought' says whose sale it was and that it is the day's. "Bought today" read as "you have one already" - a
 *  Legendary wears its base record's name, so another day's offer comes back under it (2026-10-22's Warden was
 *  Malacath's, 2026-10-25's Mora's), and a press just after a sale said it over the sale's own word. */
export const BROKER_REFUSALS = Object.freeze({ bought: 'You bought this one today. You can buy each piece once a day.', stones: 'Not enough Deadlands Embers', gone: 'No longer in stock', heavy: 'Too heavy to carry' });
export const offerSetName = (offer) => setById(offer?.set)?.name ?? '';
export { SIGIL_STONE_TEMPLATE };
/** Tests only: forget the record. */
export function _resetBrokerForTests() { _bought = NO_RECORD(); }
