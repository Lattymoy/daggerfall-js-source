// @ts-check
// RVN-ERRAND (2026-10-17, the owner: "Add the ability to send revnants off on timed missions to anywhere within tamriel
// (They disappear and come back brining rewards like loot, crafting materials, currency, etc)") - A SWORN ONE ABROAD.
// From the Companions page (ui/companionRoster.js) the player sends a sworn revenant on an errand to one of Tamriel's
// nine provinces (world/tamriel/tamrielGeography.js PROVINCES - a city of it named for the errand, drawn on its seed),
// for one of three ventures: PLUNDER (loot first), FORAGE (crafting materials first) or SELL-SWORD (gold first). It
// leaves through its portal, is gone the province's days, and comes back with its haul into the player's purse, pack and
// Materials Bag. The law is here; the acts are systems/revenant/revenantCompanions.js (sendOnErrand, recallFromErrand, the
// party's wake).
//  - ITS CLOCK. Offline the one clock (DFU's own: a rest's day is a day). ONLINE IT KEEPS THE WORLD'S TIME (OFFLINE-ROAD,
//    FIELD BUGS 2026-10-21, the Discord: "I'd like to see them at least progress on the real time bar when offline"):
//    its `due` is the world's minute it is back (worldTick.js worldMinutes, the event clock - the wall's own, whoever
//    plays), and each wake writes its minute on the character's own clock from it (errandOnWorld). So time away carries
//    it on, and a rest, a Loiter or a journey - a raise of the character's own clock alone (worldTick.js raisedMinutes) -
//    never does: AUDIT RVN F1's faucet (QCLOCK-WORLD's law, quest/clock.js chargeSeconds: "the lived step, never the
//    raise"; Lived-Time.md) stays shut. The world's reading is held to the monotonic time since the relay's clock was
//    last heard (AUDIT FB1021 L3-1, errandWorldMinute: a machine clock set forward moved it), and until it is first heard
//    the LIVED STEP carries an errand (errandStep: a raise pushes its minute back by as much, and so does a step past
//    ERRAND.STEP_MAX), which the first trusted wake takes onto the world's clock as it left it (AUDIT FB1021 L3-2).
//
//  - THE PLACES (ERRAND_PLACES): the Bay's own two a day off, the far shores four; each a DANGER (1-5) and the goods
//    its land gives - Skyrim's orichalcum and pelts, Morrowind's ebony and the Dwemer's metal, Black Marsh's venom.
//  - ITS ODDS (errandOdds): its rank and its kit (revenantGear.js gearPower) against the place's danger, ODDS.BASE +
//    ODDS.PER a point over it, within ODDS.MIN..ODDS.MAX, a Devoted one ODDS.DEVOTED more. Won, its whole haul and
//    WON_LOYALTY; HARD-WON, HARD_SHARE of it, and it comes back hurt - resting (revenantCompanions.js REVENANT_REST_MIN).
//    Never lost: an errand is no way to lose a companion - abroad, no day's desertion is rolled for it (revenant.js
//    revenantFester; RVN11b's runs again once it is back).
//  - THE HAUL (errandHaul): drawn on the errand's own seed when it comes back - a reload of a save made while it was
//    abroad draws the same dice (its odds and the haul's scale read at the return: the player's level, Loot rarity, its
//    kit - which no act changes while it is abroad). Gold by the player's level, the days, the danger and its rank;
//    units of the place's goods, the cheaper more often and at most UNITS.FINE_A_DAY a day of tier UNITS.FINE_TIER and
//    up; pieces minted as an elite's are (eliteFoes.js tieredGear), a tier each (Common with Loot rarity off).
//  - BALANCED (AUDIT RVN, measured - Revenants.md section 42): at most ERRAND.MAX abroad at once a character; online a
//    few hundredths of the wealth budget's hour a character (server-account/src/budget.js - measured on lived time, which
//    the world's real time is, an hour for an hour; since OFFLINE-ROAD every character's run while another is played -
//    AUDIT FB1021 L3-4); a piece a day wherever it goes, so a
//    far errand's better goods are its danger's tier odds and its gold; a Legendary per piece under the loot ladder's
//    own cap.
//  - INVENTORY AS ITS PACK IS: an errand is the save's (revenant.js ensureMirror) - the mirror never brings back an errand
//    begun after the save, and a save made while it was abroad sends it abroad again (a record that has since left the
//    player comes back as the save had it, as one with a pack does), to return as it would have.
//  - RVN-STARS (Revenants.md section 44): its sky's Road - `odds` more strength abroad (errandPower), `haul` a share more
//    of the gold and the goods (never the pieces), `road` a share off the days (errandMinutes), `bold` a hard road bringing
//    back nothing (Fortune's Road). AUDIT RVN-STARS S2, S3: taken onto the errand as it sets out (`e.sky` -
//    revenantStars.js rvnErrandSky), so the clamp holds it to its own road (errandUntil - the Vigil's longer road was cut
//    back to the place's days at the first wake) and a sky set at home after a save made abroad moves neither its odds nor
//    its haul; S14: a piece and a fine good a day of its own road, not the place's.

import { PROVINCES, CITIES } from '../../world/tamriel/tamrielGeography.js';
import { idStream, isDevoted } from './revenantFeud.js';
import { gearPower } from './revenantGear.js';
import { rvnErrandSky, rvnErrandSkyOf } from './revenantStars.js';   // RVN-STARS: its Road's stars, taken onto an errand
import { tieredGear } from '../eliteFoes.js';
import { lootRarityOn } from '../loot/lootRarity.js';
import { materialOf } from '../../net/professionLaw.js';
import { materialCountLabel } from '../professions/profItems.js';   // AUDIT RVN D5: the Materials Bag's own names
import { addGoldPieces, addItem } from '../inventory.js';
import { giveCarried } from '../materialsBag.js';
import { MINUTES_PER_DAY } from '../gameDate.js';
import { ONLINE_MINUTES_PER_MS } from '../../net/wire.js';   // AUDIT FB1021 L3-1, L3-5: the wire's rate, an event minute to the real ms
import { t } from '../textManager.js';   // L10N4: the page's and the card's words through the text core

/** Every number. MAX abroad at once; WON_LOYALTY for an errand won; GOLD per level a day (a range); DANGER_GOLD and
 *  RANK_HAUL the haul's rise a danger and a rank past the first; ODDS its chance (BASE + PER a point of strength over the
 *  danger, MIN..MAX, DEVOTED more); HARD_SHARE a hard-won errand's share; UNITS a day (BASE + PER_DANGER a danger; at most
 *  FINE_A_DAY a day of tier FINE_TIER and up - AUDIT RVN F4: the hunt's and the mine's bounds on the finest); TIERS a
 *  piece's (MAGIC its chance, else Common; RARE and LEGENDARY each [base, a danger, a rank past the first] - AUDIT RVN F2:
 *  a Legendary at most 3.7% a piece, under the loot ladder's 4.5%); STEP_MAX the most minutes one wake carries an errand
 *  on by the lived step (quest/clock.js PLAYED_STEP_MAX_SECONDS's, in minutes - the rest is time away, forgiven): online
 *  before the relay's clock is heard alone, since OFFLINE-ROAD. */
export const ERRAND = Object.freeze({
  MAX: 2,
  WON_LOYALTY: 4,
  GOLD: Object.freeze([10, 18]),
  DANGER_GOLD: 0.25,
  RANK_HAUL: 0.1,
  ODDS: Object.freeze({ BASE: 0.55, PER: 0.1, MIN: 0.3, MAX: 0.95, DEVOTED: 0.05 }),
  HARD_SHARE: 0.5,
  UNITS: Object.freeze({ BASE: 3, PER_DANGER: 2, FINE_TIER: 5, FINE_A_DAY: 1 }),
  TIERS: Object.freeze({ MAGIC: 0.5, RARE: Object.freeze([0.06, 0.03, 0.02]), LEGENDARY: Object.freeze([0.005, 0.004, 0.003]) }),
  STEP_MAX: 30,
});

/** The ventures: each its haul's lean - `gold` and `units` shares of the whole, `items` a piece's chance (a number) or
 *  PLUNDER's many (a piece a day - AUDIT RVN F3: never more a day for the nearer shore). */
export const VENTURES = Object.freeze({
  plunder: Object.freeze({ get label() { return t('rvn.errand.venture.plunder', 'Plunder'); }, get blurb() { return t('rvn.errand.venture.plunderBlurb', 'Loot first'); }, gold: 0.4, units: 0.35, items: 'many' }),
  forage: Object.freeze({ get label() { return t('rvn.errand.venture.forage', 'Forage'); }, get blurb() { return t('rvn.errand.venture.forageBlurb', 'Crafting materials first'); }, gold: 0.15, units: 1, items: 0.2 }),
  contract: Object.freeze({ get label() { return t('rvn.errand.venture.contract', 'Sell-sword'); }, get blurb() { return t('rvn.errand.venture.contractBlurb', 'Gold first'); }, gold: 1, units: 0, items: 0.25 }),
});
export const VENTURE_KEYS = Object.freeze(Object.keys(VENTURES));
export const isVenture = (v) => typeof v === 'string' && Object.prototype.hasOwnProperty.call(VENTURES, v);

/** AUDIT RVN D6: each province's name in the player's language (the map's own English, tamrielGeography.js PROVINCES). */
export const PLACE_NAMES = Object.freeze({
  get HighRock() { return t('rvn.errand.place.highRock', 'High Rock'); }, get Hammerfell() { return t('rvn.errand.place.hammerfell', 'Hammerfell'); },
  get Imperial() { return t('rvn.errand.place.imperial', 'Imperial Province'); }, get Skyrim() { return t('rvn.errand.place.skyrim', 'Skyrim'); },
  get Valenwood() { return t('rvn.errand.place.valenwood', 'Valenwood'); }, get Sumurset() { return t('rvn.errand.place.sumurset', 'Sumurset Isle'); },
  get Elsweyr() { return t('rvn.errand.place.elsweyr', 'Elsweyr'); }, get Morrowind() { return t('rvn.errand.place.morrowind', 'Morrowind'); },
  get BlackMarsh() { return t('rvn.errand.place.blackMarsh', 'Black Marsh'); },
});
const place = (key, days, danger, goods) => {
  const p = PROVINCES.find((x) => x.key === key);
  return Object.freeze({ key, get name() { return PLACE_NAMES[key] ?? p?.name ?? key; }, days, danger, goods: Object.freeze(goods) });
};
/** THE PLACES: Tamriel's nine provinces - how many days there and back, how dangerous, and what its land gives. */
export const ERRAND_PLACES = Object.freeze([
  place('HighRock', 1, 1, ['log:oak', 'metal:iron', 'ingot:steel', 'cloth:wool', 'hide:bear', 'gem:jade']),
  place('Hammerfell', 1, 2, ['metal:copper', 'metal:sulphur', 'gem:amber', 'hide:scorpion', 'cloth:linen', 'metal:gold']),
  place('Imperial', 2, 2, ['metal:silver', 'metal:gold', 'cloth:silk', 'log:cherry', 'gem:emerald', 'ingot:steel']),
  place('Skyrim', 2, 3, ['metal:iron', 'ore:orichalcum', 'hide:bear', 'hide:tiger', 'log:pine', 'gem:sapphire']),
  place('Valenwood', 2, 3, ['hide:spider', 'wood:heartwood', 'part:venom', 'hide:bat', 'wood:resin', 'gem:jade']),
  place('Sumurset', 3, 3, ['ore:moonstone', 'ingot:moonstone', 'gem:pearl', 'gem:malachite', 'cloth:silk', 'ingot:mithril']),
  place('Elsweyr', 3, 3, ['cloth:silk', 'gem:amber', 'hide:tiger', 'metal:gold', 'gem:turquoise', 'part:tooth']),
  place('Morrowind', 3, 4, ['ore:ebony', 'ore:dwarven', 'ingot:dwarven', 'hide:dreugh', 'gem:diamond', 'cloth:silk']),
  place('BlackMarsh', 4, 5, ['hide:slaughterfish', 'part:venom', 'part:stinger', 'wood:resin', 'log:ghostwood', 'gem:pearl']),
]);
export const errandPlace = (key) => ERRAND_PLACES.find((p) => p.key === key) ?? null;

/** RVN-STARS: an errand's sky - the one it set out with (AUDIT RVN-STARS S3), else its record's now (the page's offer, or an
 *  errand older than the stars). */
const skyOf = (r, e) => e?.sky ?? rvnErrandSky(r);
/** The days of a road to `p` under `sky` - the place's, less its `road` share (AUDIT RVN-STARS S14). */
const roadDays = (p, sky) => p.days * (1 - (sky?.road ?? 0));
/** Its strength abroad: its rank, its kit's weight and its stars' (RVN-STARS `odds` - errand `e`'s own, when it has one). */
export const errandPower = (r, e = null) => Math.max(1, r?.rank | 0) + gearPower(r) + skyOf(r, e).odds;
/** RVN-STARS: how many minutes its errand to `p` takes - the place's days, less its Road's `road` share. */
export const errandMinutes = (r, p) => Math.round((p?.days ?? 0) * MINUTES_PER_DAY * (1 - rvnErrandSky(r).road));
/** Its chance to come back with the whole haul from `p` (a place) - on errand `e`, the sky it set out with. */
export function errandOdds(r, p, e = null) {
  if (!p) return 0;
  const O = ERRAND.ODDS;
  const odds = O.BASE + O.PER * (errandPower(r, e) - p.danger) + (isDevoted(r?.companion?.loyalty) ? O.DEVOTED : 0);
  return Math.round(Math.max(O.MIN, Math.min(O.MAX, odds)) * 1000) / 1000;
}
/** The odds' kind - 'good', 'fair' or 'grim' (the page's chip). */
export const oddsKind = (odds) => (odds >= 0.75 ? 'good' : odds >= 0.5 ? 'fair' : 'grim');
/** The odds in the page's words. */
export function oddsWord(odds) {
  const k = oddsKind(odds);
  return k === 'good' ? t('rvn.errand.odds.good', 'Good odds') : k === 'fair' ? t('rvn.errand.odds.fair', 'Fair odds') : t('rvn.errand.odds.grim', 'Grim odds');
}

/** A new errand for `r` to place `key` on venture `venture`, from minute `now` - its city drawn on `seed` (a whole number
 *  the caller draws). Null for an unknown place or venture. OFFLINE-ROAD: `world`, the world's trusted minute online
 *  (NaN: none), gives it its `due` - the world's minute it is back. */
export function newErrand(r, key, venture, now, seed, world = NaN) {
  const p = errandPlace(key);
  if (!p || !isVenture(venture) || !Number.isFinite(now)) return null;
  const s = Number.isInteger(seed) && seed >= 0 ? seed >>> 0 : 0;
  const cities = CITIES.filter((c) => c.province === key);
  const city = cities.length ? cities[Math.min(cities.length - 1, Math.floor(idStream(`${r?.id}`, `errand-city:${s}`)() * cities.length))].name : null;
  const sky = rvnErrandSky(r);   // AUDIT RVN-STARS S2, S3: its sky as it sets out - its road, its odds, its haul
  const len = Math.round(roadDays(p, sky) * MINUTES_PER_DAY);
  return { place: key, venture, city, at: Math.floor(now), until: Math.floor(now) + len, seed: s, sky: { ...sky }, ...(Number.isFinite(world) ? { due: Math.floor(world) + len } : {}) };
}
/** An errand read back (a save, the mirror): its place and venture known, its minutes whole and in order, its sky within
 *  the stars' bounds (none: an errand older than the stars), else none. */
export function sanitizeErrand(e) {
  if (!e || typeof e !== 'object' || !errandPlace(e.place) || !isVenture(e.venture)) return null;
  if (!Number.isInteger(e.at) || !Number.isInteger(e.until) || e.until < e.at) return null;
  const sky = rvnErrandSkyOf(e.sky);
  return { place: e.place, venture: e.venture, city: typeof e.city === 'string' && e.city ? e.city.slice(0, 40) : null, at: e.at, until: e.until, seed: Number.isInteger(e.seed) && e.seed >= 0 ? e.seed >>> 0 : 0, ...(sky ? { sky: { ...sky } } : {}), ...(Number.isInteger(e.due) ? { due: e.due } : {}) };   // OFFLINE-ROAD: its world's minute
}
/** When it is back - never more than its own road's days from `now` (an older clock under the record reads its days as
 *  more, as a rest's would - revenantCompanions.js restUntil, whose wake writes the clamp back: AUDIT RVN F5; AUDIT
 *  RVN-STARS S2: its own road, the sky it set out with - the place's days cut the Vigil's longer road back at once). */
export function errandUntil(e, now) {
  const p = errandPlace(e?.place);
  if (!p || !Number.isFinite(e?.until)) return now;
  const most = Math.round(roadDays(p, e.sky) * MINUTES_PER_DAY);
  return Number.isFinite(now) && e.until - now > most ? now + most : e.until;
}
/** AUDIT RVN F1: the minutes one wake's step pushes every errand's return back - `own` the own clock's movement since the
 *  last wake, `raised` the raises' (worldTick.js raisedMinutes; a count that went back - a new session's - is none). Online
 *  before the relay's clock is heard only the lived part carries an errand on, STEP_MAX at most: the raise and any time
 *  away are pushed (once it is heard the world's time carries it - errandOnWorld, OFFLINE-ROAD); offline nothing is
 *  (DFU's one clock). Never negative. */
export function errandStep(own, raised, online) {
  if (!online || !(own > 0)) return 0;
  const lived = Math.min(Math.max(own - (raised > 0 ? raised : 0), 0), ERRAND.STEP_MAX);
  return own - lived;
}

/** AUDIT FB1021 L3-1: the event minutes a wake's world reading may run past the monotonic clock's (a frame's rounding,
 *  never an hour). */
export const ERRAND_WORLD_SLACK = 1;
/** AUDIT FB1021 L3-1: THE WORLD'S MINUTE AN ERRAND MAY READ - `world` (the trusted reading: this machine's wall clock
 *  through the relay's offset) no further than the relay's clock as last heard (`heard`, worldTick.js sharedClockHeardMark:
 *  its world minute and the monotonic ms then) run on by the monotonic clock since (`perf`, the same clock's ms) at the
 *  wire's rate, ERRAND_WORLD_SLACK more. A machine clock set forward after a welcome reads as no more time than passed
 *  (the lived step's STEP_MAX had held it, and the world's reading followed it whole); the next welcome hears the true
 *  clock, and an errand's `due` is absolute, so time a paused monotonic clock missed (a machine asleep) is paid then, never
 *  lost. NaN with no reading or no hearing. Pure. */
export function errandWorldMinute(world, heard, perf) {
  if (!Number.isFinite(world) || !Number.isFinite(heard?.world) || !Number.isFinite(heard?.perf) || !Number.isFinite(perf)) return NaN;
  return Math.min(world, heard.world + Math.max(0, perf - heard.perf) * ONLINE_MINUTES_PER_MS + ERRAND_WORLD_SLACK);
}
/** OFFLINE-ROAD: ONLINE, ERRAND `e` ON THE WORLD'S TIME - `world` the world's trusted minute, `own` the character's (the
 *  minute the party's wake compares `until` against). Its `due`: its own where it has one, else its minutes left now from
 *  the world's now (an errand sent before the relay's clock was heard, or before OFFLINE-ROAD), held to its own road's
 *  days from the world's now (errandUntil's clamp, on the world's clock). Its `until`: as many minutes past `own` as the
 *  world has left to `due` - never before it set out. Answers both. Pure. */
export function errandOnWorld(e, own, world) {
  const p = errandPlace(e?.place), w = Math.floor(world);
  const most = p ? Math.round(roadDays(p, e.sky) * MINUTES_PER_DAY) : 0;
  const due = Math.min(Number.isInteger(e?.due) ? e.due : w + Math.max(0, e.until - Math.floor(own)), w + most);
  return { due, until: Math.max(e.at, Math.floor(own) + Math.max(0, due - w)) };
}

/** A material's tier (1 where none is known). */
const goodsTier = (key) => materialOf(key, () => 1)?.tier ?? 1;
/** A material's draw weight - the cheaper more often (one over its tier). */
const goodsWeight = (key) => 1 / Math.max(1, goodsTier(key));
/** A draw from `goods` on `rolls`, the cheaper more often. */
function drawGoods(goods, rolls) {
  const weights = goods.map(goodsWeight), total = weights.reduce((a, b) => a + b, 0);
  let x = rolls() * total;
  for (let j = 0; j < goods.length; j++) { if ((x -= weights[j]) < 0) return goods[j]; }
  return goods[goods.length - 1];
}
/** One piece's tier, on `rolls`: Legendary, Rare, Magic or Common by the place's danger and its rank. */
function pieceTier(danger, rank, rolls) {
  const T = ERRAND.TIERS, x = rolls(), up = Math.max(0, rank - 1);
  const leg = T.LEGENDARY[0] + T.LEGENDARY[1] * danger + T.LEGENDARY[2] * up;
  const rare = T.RARE[0] + T.RARE[1] * danger + T.RARE[2] * up;
  if (x < leg) return 'legendary';
  if (x < leg + rare) return 'rare';
  return x < leg + rare + T.MAGIC ? 'magic' : 'common';
}

/**
 * THE HAUL of `r`'s errand `e`, drawn on its seed: `{ won, gold, units: [[key, n], ...], items }` - won on its odds, else
 * hard-won (HARD_SHARE of each). `level` the player's (the haul's scale); `rarity` Loot rarity's switch (off: Common).
 * @param {any} r @param {any} e @param {{ level?: number, rarity?: boolean }} [o]
 */
export function errandHaul(r, e, { level = 1, rarity = lootRarityOn() } = {}) {
  const p = errandPlace(e?.place), v = VENTURES[e?.venture];
  if (!p || !v) return { won: false, gold: 0, units: [], items: [] };
  const rolls = idStream(`${r?.id}`, `errand:${e.seed >>> 0}`);
  const rank = Math.max(1, Math.min(5, r?.rank | 0)), lv = Math.max(1, level | 0);
  const sky = skyOf(r, e), road = roadDays(p, sky);   // AUDIT RVN-STARS S3: the sky it set out with
  // AUDIT RVN-STARS S14: a piece and a fine good a day of its own road - a part day's by its share, drawn on a stream of its
  // own (no dice moved; a road of whole days, every errand without stars, draws none): rounded, Morrowind's 2.55 days kept 3
  const whole = Math.floor(road + 1e-9), days = whole + (road - whole > 1e-9 && idStream(`${r?.id}`, `errand-part:${e.seed >>> 0}`)() < road - whole ? 1 : 0);
  const won = rolls() < errandOdds(r, p, e);
  const share = won ? 1 : sky.bold ? 0 : ERRAND.HARD_SHARE;   // AUDIT RVN-STARS S5: Fortune's Road - a hard road brings back nothing
  const more = 1 + Math.max(0, sky.haul);   // RVN-STARS: its Road's haul - the gold and the goods, never the pieces
  const scale = (1 + ERRAND.DANGER_GOLD * (p.danger - 1)) * (1 + ERRAND.RANK_HAUL * (rank - 1));
  const [lo, hi] = ERRAND.GOLD;
  const gold = Math.floor(lv * p.days * (lo + rolls() * (hi - lo)) * scale * v.gold * share * more);
  const U = ERRAND.UNITS;
  const goods = (U.BASE + U.PER_DANGER * p.danger) * p.days * v.units * share;
  const cheap = p.goods.filter((k) => goodsTier(k) < U.FINE_TIER);
  let fine = Math.floor(U.FINE_A_DAY * days);   // AUDIT RVN F4: the finest at most so many - past them, the cheaper goods (AUDIT RVN-STARS S14: a day of its own road)
  /** @type {Map<string, number>} */
  const counts = new Map();
  const draw = (n) => {
    for (let i = 0; i < n; i++) {
      let k = drawGoods(p.goods, rolls);
      if (goodsTier(k) >= U.FINE_TIER && fine-- <= 0) { if (!cheap.length) continue; k = drawGoods(cheap, rolls); }
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  };
  draw(Math.floor(goods));
  const want = v.items === 'many' ? days : rolls() < Number(v.items) ? 1 : 0;   // AUDIT RVN-STARS S14: a piece a day of its own road
  const pieces = Math.round(want * share);   // hard-won: half, a lone piece kept (a half rounds up)
  const items = [];
  for (let i = 0; i < pieces; i++) {
    const tier = rarity ? pieceTier(p.danger, rank, rolls) : 'common';
    const it = tieredGear(lv, tier, rolls);
    if (it) items.push(it);
  }
  draw(Math.floor(goods * more) - Math.floor(goods));   // RVN-STARS: its haul's more goods, drawn after the pieces - its stars never move a piece's dice
  return { won, gold, units: [...counts.entries()], items };
}

/** Its haul into the player's hands: gold to the purse, pieces to the pack, materials to the Materials Bag (then the
 *  pack - any overflow forced in, as a writ's are: nothing brought back is left on the road). Answers the haul. */
export function deliverHaul(player, haul) {
  if (!player || !haul) return haul;
  if (haul.gold > 0) addGoldPieces(player, haul.gold);
  player.items ??= [];
  for (const it of haul.items ?? []) addItem(player.items, it);
  for (const [key, n] of haul.units ?? []) { try { giveCarried(player, key, n); } catch { /* a unit with no pack form is nobody's loss to report */ } }
  return haul;
}

/** The haul in words - "412 gold, 6 Orichalcum Ore, 2 Bear Hide and 2 pieces of gear" - or "nothing". */
export function errandHaulWords(haul) {
  const parts = [];
  if (haul?.gold > 0) parts.push(t('rvn.errand.haul.gold', '{n} gold', { n: haul.gold }));
  for (const [key, n] of haul?.units ?? []) parts.push(t('rvn.errand.haul.goods', '{n} {what}', { n, what: materialCountLabel(key, n) }));   // AUDIT RVN D5: the bag's names, counted
  const k = haul?.items?.length ?? 0;
  if (k) parts.push(t('rvn.errand.haul.pieces', '{k, plural, one {a piece of gear} other {# pieces of gear}}', { k }));
  if (!parts.length) return t('rvn.errand.haul.nothing', 'nothing');
  return parts.length === 1 ? parts[0] : t('rvn.errand.haul.list', '{most} and {last}', { most: parts.slice(0, -1).join(', '), last: parts[parts.length - 1] });
}
/** AUDIT FB1021 L3-5: the real hours a day abroad takes online (the wire's rate - two). */
export const ERRAND_REAL_HOURS_A_DAY = MINUTES_PER_DAY / (ONLINE_MINUTES_PER_MS * 3_600_000);
/** How long yet, in the page's words. AUDIT FB1021 L3-5: `real` (online) in real time - the road keeps it there, and the
 *  game's hours were the event clock's, a twelfth of the sky clock the HUD shows ("back in about 24 hours" was two real
 *  hours, and forty-eight on the HUD's clock). */
export function errandLeftWords(until, now, real = false) {
  if (real) {
    const m = Math.max(1, Math.ceil(Math.max(0, until - now) / (ONLINE_MINUTES_PER_MS * 60_000)));
    if (m < 60) return t('rvn.errand.left.realMinutes', 'back in about {m, plural, one {# real minute} other {# real minutes}}', { m });
    return t('rvn.errand.left.realHours', 'back in about {h, plural, one {# real hour} other {# real hours}}', { h: Math.round(m / 60) });
  }
  const h = Math.ceil(Math.max(0, until - now) / 60);
  if (h <= 1) return t('rvn.errand.left.hour', 'back within the hour');
  if (h < 48) return t('rvn.errand.left.hours', 'back in about {h} hours', { h });
  return t('rvn.errand.left.days', 'back in about {d} days', { d: Math.round(h / 24) });
}
/** Where it is, in the page's words - "In Solitude, Skyrim (Plunder) - back in about 9 hours" (`real`: online, in real
 *  time - AUDIT FB1021 L3-5). */
export function errandWords(e, now, real = false) {
  const p = errandPlace(e?.place);
  if (!p) return t('rvn.errand.abroad', 'Abroad');
  const where = e.city ? t('rvn.errand.cityOf', '{city}, {province}', { city: e.city, province: p.name }) : p.name;
  return t('rvn.errand.where', 'In {where} ({venture}), {left}', { where, venture: VENTURES[e.venture]?.label ?? e.venture, left: errandLeftWords(errandUntil(e, now), now, real) });
}
