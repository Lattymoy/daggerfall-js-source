// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SEAT1 (2026-09-30, Mac: "Finish the seats"; "Or we could go ahead and
// do sieges") - THE SEATS' LAW, ONE HOME FOR EVERY END: the numbers of
// bible/11-Multiplayer/Seats-Arc.md Appendix B, the seat's shape as a
// client derives and reports it, the witnessed registry's rule (3.2),
// the Charter's and the arrival's words (3.3), the map's marks (3.3),
// and the seat week's clock (5.1). The record decided every number;
// balance is an edit here, pinned by its own tests, never a hunt (SEAT0:
// "Every number lives in ONE pure law module").
//
// THE WORD "SEAT" IS TAKEN IN THE CODE (ONE-SEAT, SEAT-HEAL, the party's
// kept seat): the player reads "seat", the code says `townSeat`.
//
// Pure: no clock, no DOM, no network. The account service
// (server-account/src/townSeats.js), the client's derivation
// (systems/townSeats.js) and its book (net/townSeatBook.js) read it.
// ═══════════════════════════════════════════════════════════════════
import { ONLINE_EPOCH_MS } from './wire.js';
import { KINGDOMS, MARCHES, kingdomOf, isMarch, isFreeLand } from './kingdomLaw.js';
import { TIDE_EFFECTS } from './tideLaw.js';   // SEASON1 part two: the Tides' numbers (9.3)
import { HERALDRY_COLOURS } from './heraldryLaw.js';
import { marksText } from './marksLaw.js';   // AUDIT-SEATS L7: "1,200 Drakes"
import { fortWork, revoltDue, REVOLT, marketHallTitheCap } from './fortLaw.js';   // SEAT2b: a work's name in the Chronicle; part two (c): a seat at Standing 0 revolts

/** A heraldry colour key's hex (heraldryLaw.js's palette), or null. */
const heraldryHex = (key) => HERALDRY_COLOURS.find((c) => c.key === key)?.hex ?? null;
/** AUDIT-SEATS L10: a count the law sums - a finite number at least nought, else nought (Math.max lets a NaN through). */
const amountOf = (x) => { const n = Number(x); return Number.isFinite(n) && n > 0 ? n : 0; };

/** A seat's tier: a crown (the three capitals) or a palace (every other location with a Palace) - SEAT0 3.1. */
export const SEAT_TIERS = Object.freeze(['palace', 'crown']);
/** The crown seats, by their region's index (REGION_NAMES) - Daggerfall, Wayrest, Sentinel (SEAT0 3.2: "Crown seats
 *  must also match: tier crown, name in HUB_CAPITALS, region index 17, 23 or 20"). */
export const CROWN_SEAT_REGIONS = Object.freeze({ 17: 'daggerfall', 23: 'wayrest', 20: 'sentinel' });

/** THE WITNESSED REGISTRY (SEAT0 3.2, Appendix B). A seat is witnessed as the professions' pixels are - ONE table
 *  (`world_witness`, the kind `seat`, keyed by the map id) and ONE law (net/nodeLaw.js witnessedFact and WITNESS: an
 *  account a week registered; three agreeing byte for byte confirm; two agreeing on another answer dispute). What is
 *  the seats' own: an account whose disagreements match nobody else's three times has its seat reports ignored for a
 *  week; 24 reports an account an hour; a client reports a seat town it stands in once a UTC day. */
export const SEAT_WITNESS_UNMATCHED_MAX = 3;
/** THE AUDIT (SEAT0 3.2: "a seat confirmed by exactly three witnesses whom nobody else ever joins"): a seat whose
 *  confirmation still rests on this many (WITNESS.confirm), no fourth ever agreeing, is listed for a person to read. */
export const SEAT_WITNESSES_AUDIT = 3;
export const SEAT_WITNESS_IGNORED_S = 7 * 86400;
export const SEAT_WITNESS_REPORTS_HOUR = 24;
export const SEAT_REPORT_EVERY_S = 86400;

/** The switch the service's config holds (SEATS_OPEN, SEAT0 18): off, dev (the developers alone), on. */
export const SEATS_SWITCH = Object.freeze(['off', 'dev', 'on']);
export const seatsSwitchOf = (v) => (SEATS_SWITCH.includes(v) ? v : 'off');

/** A seat's key: its location's MAPS.BSA map id, unsigned (regionHubs.js's key). */
export const seatKeyOk = (k) => Number.isSafeInteger(k) && k >= 0 && k <= 0xffffffff;
/** A region index MAPS.BSA holds (0-61). */
export const seatRegionOk = (r) => Number.isSafeInteger(r) && r >= 0 && r <= 61;
/** A map pixel (MAPS.BSA's 1000 x 500). */
const pixelOk = (p) => Array.isArray(p) && p.length === 2 && Number.isSafeInteger(p[0]) && Number.isSafeInteger(p[1])
  && p[0] >= 0 && p[0] < 1000 && p[1] >= 0 && p[1] < 500;
/** A location's name as MAPS.BSA spells it - printable, bounded. */
const nameOk = (n) => typeof n === 'string' && n.length >= 1 && n.length <= 48 && /^[\x20-\x7e]+$/.test(n) && n.trim() === n;

/**
 * A SEAT AS A CLIENT REPORTS IT, checked and CANONICAL - `{ key, name, region, tier, pixel: [x, y] }` in that key order,
 * so two witnesses who derived the same seat report the same bytes (seatReportText) - or null. A crown must stand in
 * its crown's region and bear its name (SEAT0 3.2); the rest is the shape.
 * @param {any} raw
 */
export function seatReportOf(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const { key, name, region, tier, pixel } = raw;
  if (!seatKeyOk(key) || !nameOk(name) || !seatRegionOk(region) || !SEAT_TIERS.includes(tier) || !pixelOk(pixel)) return null;
  // a crown stands in its crown's region and bears its name (SEAT0 3.2: "tier crown, name in HUB_CAPITALS, region index
  // 17, 23 or 20")
  if (tier === 'crown' && (!Object.prototype.hasOwnProperty.call(CROWN_SEAT_REGIONS, region) || name !== KINGDOMS[CROWN_SEAT_REGIONS[region]]?.name)) return null;
  return { key, name, region, tier, pixel: [pixel[0], pixel[1]] };
}
/** The report's bytes - what three witnesses must agree on, byte for byte. */
export const seatReportText = (seat) => JSON.stringify([seat.key, seat.name, seat.region, seat.tier, seat.pixel[0], seat.pixel[1]]);

/** A seat's report read back (witnessedFact's `parse`): the seat it names, or null for a report that is no seat's. */
export function parseSeatReport(text) {
  let a;
  try { a = JSON.parse(text); } catch { return null; }
  if (!Array.isArray(a) || a.length !== 6) return null;
  const seat = seatReportOf({ key: a[0], name: a[1], region: a[2], tier: a[3], pixel: [a[4], a[5]] });
  return seat && seatReportText(seat) === text ? { seat } : null;
}

/**
 * THE ACCOUNTS WHOSE SEAT REPORTS ARE IGNORED (SEAT0 3.2: "An account whose disagreements match nobody else's three times
 * has its reports ignored for a week"): over every seat's reports (`[{ key, account, report, at }]`) and each seat's
 * confirmed answer (`confirmed`: key -> text), an account that gave SEAT_WITNESS_UNMATCHED_MAX answers inside
 * SEAT_WITNESS_IGNORED_S that differ from the confirmed one and that no other account gave - ignored for
 * SEAT_WITNESS_IGNORED_S from the last of them (AUDIT-SEATS L8). Pure.
 * @param {{ key: string, account: string, report: string, at: number }[]} rows
 * @param {Map<string, string>} confirmed
 * @param {number} nowS
 */
export function seatIgnoredAccounts(rows, confirmed, nowS) {
  const givers = new Map();   // `${key}\n${report}` -> accounts
  for (const r of rows ?? []) {
    const k = `${r.key}\n${r.report}`;
    const set = givers.get(k) ?? new Set();
    set.add(r.account);
    givers.set(k, set);
  }
  const unmatched = new Map();   // account -> the times of its unmatched answers
  for (const r of rows ?? []) {
    const c = confirmed.get(r.key);
    if (c == null || r.report === c || r.at > nowS) continue;
    if ((givers.get(`${r.key}\n${r.report}`)?.size ?? 0) > 1) continue;
    const ts = unmatched.get(r.account) ?? [];
    ts.push(r.at);
    unmatched.set(r.account, ts);
  }
  // AUDIT-SEATS L8: "ignored for a week" FROM the third - each third unmatched answer inside a week ignores the account
  // until a week after it (a sliding count let the first answer age out a day later and lifted it)
  const n = SEAT_WITNESS_UNMATCHED_MAX;
  const out = new Set();
  for (const [a, ts] of unmatched) {
    ts.sort((x, y) => x - y);
    for (let i = n - 1; i < ts.length; i++) {
      if (ts[i] - ts[i - n + 1] <= SEAT_WITNESS_IGNORED_S && nowS < ts[i] + SEAT_WITNESS_IGNORED_S) { out.add(a); break; }
    }
  }
  return out;
}

/** A kingdom's name. */
export const kingdomName = (id) => KINGDOMS[id]?.name ?? null;

/** THE CHARTER (SEAT0 3.3): "the Charter of <Town>", or a crown's "the Crown Charter of <Kingdom>". */
export function charterName(seat) {
  if (seat?.tier === 'crown') return `the Crown Charter of ${kingdomName(CROWN_SEAT_REGIONS[seat.region]) ?? seat.name}`;
  return `the Charter of ${seat?.name ?? 'the town'}`;
}
/** A guild as the arrival line names it: "the Silver Hand <SH>". */
export const guildWords = (g) => `${/^the /i.test(g.name) ? `the ${g.name.slice(4)}` : g.name} <${g.tag}>`;   // SEAT2b part two: exported - the Watchtowers' word names a guild the Chronicle's way
/** CROWN2: the same, opening a sentence (SEAT2a's announcement too, which had opened one with "the"). */
const GuildWords = (g) => { const w = guildWords(g); return `${w[0].toUpperCase()}${w.slice(1)}`; };
/**
 * THE ARRIVAL LINE (SEAT0 3.3 - HUB1's five-second line, extended to every seat): "Anticlere. Its Charter is unheld."; a
 * held one "Anticlere, held by the Silver Hand <SH>."; a crown "Wayrest, capital of the Kingdom of Wayrest, held by the
 * Ebon Oath <EO>." (unheld: "... Its Crown Charter is unheld.").
 * @param {{ name: string, tier: string, region: number, holder?: any, battle?: any }} seat   AUDIT-SEATS G2: and the week's battle
 * @param {{ name: string, tag: string }|null} [holder]
 */
export function seatArrivalLine(seat, holder = seat?.holder?.guild ?? null, nowMs = Date.now()) {   // SEAT1c: a dressed seat names its own holder
  const siege = siegeCalledClause(seat?.battle, nowMs);
  if (seat.tier === 'crown') {
    const k = kingdomName(CROWN_SEAT_REGIONS[seat.region]) ?? seat.name;
    return (holder ? `${seat.name}, capital of the Kingdom of ${k}, held by ${guildWords(holder)}.` : `${seat.name}, capital of the Kingdom of ${k}. Its Crown Charter is unheld.`) + siege;
  }
  return (holder ? `${seat.name}, held by ${guildWords(holder)}.` : `${seat.name}. Its Charter is unheld.`) + siege;
}
/** AUDIT-SEATS G2 (3.3: "under siege this week: the line gains ' A siege is called for Wednesday at 20:00.' in the
 *  siege's own words"): the clause for a dressed seat's battle (`{ kind, startsAt, endsAt, state }`, seconds, as the
 *  service sends them) - a siege placed, not void and not yet over - or nothing. */
export function siegeCalledClause(battle, nowMs) {
  if (battle?.kind !== 'siege' || !Number.isFinite(battle.startsAt) || battle.state === 'void') return '';
  if (Number.isFinite(battle.endsAt) && nowMs >= battle.endsAt * 1000) return '';
  return ` A siege is called for ${battleWhenText(battle.startsAt * 1000)}.`;
}

/** The map's line for a seat, in its box: "The Charter of Anticlere: unheld" (SEAT1c: "held by the Silver Hand <SH>"). */
export function seatInfoLine(seat, holder = null) {
  const c = charterName(seat);
  return `${c[0].toUpperCase()}${c.slice(1)}: ${holder ? `held by ${guildWords(holder)}` : 'unheld'}`;
}

/** THE MAP'S MARKS (SEAT0 3.3): the unheld ring's stone grey; each crown's metal; a free land's green. */
// AUDIT-SEATS L10: the heraldry's own colours by name (Ash, Azure, Crimson, Gold, Vert), not their hex written twice
export const SEAT_RING_UNHELD = heraldryHex('ash');
export const KINGDOM_METALS = Object.freeze({ daggerfall: heraldryHex('azure'), wayrest: heraldryHex('crimson'), sentinel: heraldryHex('gold') });
export const FREE_LAND_RING = heraldryHex('vert');
/** The same metals as heraldry colours (net/heraldryLaw.js keys) - the kingdom's plain banner at an unheld seat. */
export const KINGDOM_BANNER_COLOURS = Object.freeze({ daggerfall: 'azure', wayrest: 'crimson', sentinel: 'gold' });
/**
 * How a seat is marked on the map - `{ ring, crown, second, fill, split, siege }`: the ring's colour (unheld stone grey;
 * a holder's border), the crown's metal over a crown seat (or null), and a thin second ring - a March's in both claiming
 * crowns' metals, a Free Land's green - or null; SEAT1c: the holder's field filling it, a Contested seat's two
 * contenders' fields splitting it, and whether a siege is called there this week.
 * @param {{ tier: string, region: number, holder?: any, battle?: any }} seat
 */
export function seatMapMark(seat) {
  const crown = seat.tier === 'crown' ? KINGDOM_METALS[CROWN_SEAT_REGIONS[seat.region]] ?? null : null;
  const second = isMarch(seat.region) ? MARCHES[seat.region].map((k) => KINGDOM_METALS[k])
    : isFreeLand(seat.region) ? [FREE_LAND_RING] : null;
  // SEAT1c (3.3): a held seat's ring filled with its holder's first colour and edged in its second; a Contested seat's
  // split in the two contenders' first colours; a siege week's edge burning
  const h = seat.holder?.guild?.heraldry ?? null;
  const fill = h ? heraldryHex(h.field) : null;
  const ring = h ? heraldryHex(h.border) ?? SEAT_RING_UNHELD : SEAT_RING_UNHELD;
  const b = seat.battle ?? null;
  const split = !seat.holder && b?.kind === 'tourney' ? [heraldryHex(b.guild?.heraldry?.field) ?? SEAT_RING_UNHELD, heraldryHex(b.against?.heraldry?.field) ?? SEAT_RING_UNHELD] : null;
  return { ring, crown, second, fill, split, siege: b?.kind === 'siege' };
}
/** A siege week's burning edge (SEAT0 3.3: "a slow orange-to-red pulse") - the paper map's, held at its orange. */
export const SEAT_RING_SIEGE = '#d9532b';
/**
 * THE BANNER A SEAT HANGS (SEAT0 3.4) - SEAT1c: a held seat's its holder's own heraldry; an unheld one's, or a holder
 * that has chosen none, the kingdom's plain banner (seatPlainBanner).
 * @param {{ region: number, holder?: any }} seat
 */
export const seatBannerOf = (seat) => seat?.holder?.guild?.heraldry ?? seatPlainBanner(seat);
/**
 * THE BANNER AN UNHELD SEAT HANGS (SEAT0 3.4: "An unheld seat's anchors carry the kingdom's plain banner (the crown's
 * metal, no device); a free land's carry nothing") - a heraldry `{ field, border, device: null }` in heraldryLaw.js's
 * colour keys, or null for none. A March's is its two claimants' metals, field and border.
 * @param {{ region: number }} seat
 */
export function seatPlainBanner(seat) {
  if (isFreeLand(seat.region)) return null;
  if (isMarch(seat.region)) {
    const [a, b] = MARCHES[seat.region];
    return { field: KINGDOM_BANNER_COLOURS[a], border: KINGDOM_BANNER_COLOURS[b], device: null };
  }
  const k = kingdomOf(seat.region);
  return k ? { field: KINGDOM_BANNER_COLOURS[k], border: KINGDOM_BANNER_COLOURS[k], device: null } : null;
}
/** How many banners a seat town hangs at most (SEAT0 3.4). */
export const SEAT_BANNERS_MAX = 8;

// ═══ THE SEAT WEEK (SEAT0 5.1) ══════════════════════════════════════
// A seat week is a real week; week n begins at ONLINE_EPOCH_MS + 6 days 18 hours + n weeks - the first Turning fell on
// Sunday 2026-09-20 at 18:00 UTC. The Reckoning is the last 48 hours of a week (Friday 18:00 to the Turning).
const H = 3600_000;
export const SEAT_WEEK_MS = 7 * 24 * H;
export const SEAT_WEEK0_MS = ONLINE_EPOCH_MS + 6 * 24 * H + 18 * H;
export const SEAT_RECKONING_MS = 2 * 24 * H;
/** The seat week holding the instant `ms` (-1 before the first Turning). */
export const seatWeekOf = (ms) => Math.floor((ms - SEAT_WEEK0_MS) / SEAT_WEEK_MS);
/** When seat week `n` begins (its Turning), ms. */
export const seatWeekStartMs = (n) => SEAT_WEEK0_MS + n * SEAT_WEEK_MS;
/** The week's phase at `ms`: the Muster, or the Reckoning (its last 48 hours, pledges locked). */
export const seatPhaseOf = (ms) => (ms - seatWeekStartMs(seatWeekOf(ms)) >= SEAT_WEEK_MS - SEAT_RECKONING_MS ? 'reckoning' : 'muster');

// ═══ SEAT1b: INFLUENCE (SEAT0 4.1-4.2, Appendix B) ═══════════════════
// Influence is counted per guild, per seat, per week. A guild PLEDGES each week to at most one seat a region, in at most
// five regions; an Officer or the guildmaster sets or moves a pledge until the Reckoning. What an account earns counts
// for the guild its account is BOUND to that week (the first guild one of its characters contributed to - per-account
// war), from a character 7 days in that guild, at that guild's pledged seat in the region it was earned in - and never
// more than ACCOUNT_SEAT_WEEK_CAP a seat a week from every source together.

/** A guild's reach: the regions it may pledge in a week (one seat each). */
export const SEAT_PLEDGE_REGIONS_MAX = 5;
/** What a rank may do of a guild's seats (guildLaw.js GUILD_POWERS's shape): pledge (an Officer's too), and Tribute -
 *  Marks out of the guild's Drake treasury - the guildmaster's, as every Marks withdrawal is. */
export const SEAT_POWERS = Object.freeze({ pledge: Object.freeze([0, 1]), tribute: Object.freeze([0]) });
export const seatMay = (rank, power) => (SEAT_POWERS[power] ?? []).includes(rank);
/** The Watch: a tick each WATCH_TICK_MS a socket stands in a town's cell room having moved in the last WATCH_MOVED_MS -
 *  1 influence a tick, at most WATCH_DAY_CAP an account a UTC day. The tick's rhythm lives beside its receipt
 *  (net/watchReceipt.js), so the relay's bundle holds the Watch's law and none of the rest of the seats'. */
export { WATCH_TICK_MS, WATCH_MOVED_MS, watchDue } from './watchReceipt.js';
export const WATCH_INFLUENCE = 1;
export const WATCH_DAY_CAP = 60;
/** A gate kill: 300 a receipt claimed in its own week, the region at least 3 of that game day's receipts agree on, at most
 *  900 an account a week (three receipts). */
export const GATE_INFLUENCE = 300;
export const GATE_WEEK_CAP = 900;
export const GATE_REGION_AGREE = 3;
/** AUDIT-SEATS S7 (4.2: "at most 900 an account a week (three receipts)"; "the Watch and Renown caps above are per account
 *  too"): the gate rows an ACCOUNT may write in a week, every seat together - asked in the write (seatInfluence.js
 *  creditGate), where the read's cap (accountSeatInfluence) sees one seat only. */
export const GATE_WEEK_RECEIPTS = GATE_WEEK_CAP / GATE_INFLUENCE;
/** A member's home in the seat's town: 25 a day, at most 5 homes a guild a seat. */
export const HOME_INFLUENCE_DAY = 25;
export const HOMES_SEAT_MAX = 5;
/** Renown earned in the seat's region: 1 per 20 XP, at most 400 an account a week. */
export const RENOWN_XP_PER_INFLUENCE = 20;
export const RENOWN_WEEK_CAP = 400;
/** AUDIT-SEATS S7 (4.2: "capped 400 an account a week"): the Renown XP an ACCOUNT may bank in a week, every region together
 *  (400 influence at 1 per 20) - asked in the write (seatInfluence.js creditRenown). */
export const RENOWN_WEEK_XP = RENOWN_WEEK_CAP * RENOWN_XP_PER_INFLUENCE;
/** A delivery to the seat's stockpile: 1 per Mark of the materials' own value (PROF0 4.8) - the deliverer's own units;
 *  bought units count at Tribute's rate, inside Tribute's cap. */
export const WRIT_INFLUENCE_PER_MARK = 1;
/** Tribute: 1 per 10 Marks, burnt, at most 20% of the guild's week at the seat. */
export const TRIBUTE_MARKS_PER_INFLUENCE = 10;
export const TRIBUTE_SHARE_MAX = 0.2;
/** One account's whole week at one seat, every source together. */
export const ACCOUNT_SEAT_WEEK_CAP = 2000;
/** A character new to its guild contributes nothing for this long. */
export const SEAT_MEMBER_WAIT_S = 7 * 86400;
/** Legacy: the share of a guild's influence at a seat that carries into the next week (SEAT1c's Turning). */
export const SEAT_LEGACY_SHARE = 0.1;

/**
 * How much Tribute a guild's week at a seat can still take, in influence: Tribute is at most TRIBUTE_SHARE_MAX of the
 * guild's whole week there, so at most a quarter of everything else - less what it has already paid.
 * @param {number} others the guild's influence at the seat from every other source
 * @param {number} tributeSoFar its Tribute there this week, influence
 */
export function tributeRoom(others, tributeSoFar = 0) {
  const cap = Math.floor((amountOf(others) * TRIBUTE_SHARE_MAX) / (1 - TRIBUTE_SHARE_MAX) + 1e-9);
  return Math.max(0, cap - amountOf(tributeSoFar));
}

/**
 * ONE ACCOUNT'S WEEK AT ONE SEAT, every source at its own cap and then all of them at ACCOUNT_SEAT_WEEK_CAP: `watch` its
 * ticks (each day's already at WATCH_DAY_CAP), `gates` the receipts that count, `renownXp` the XP earned in the seat's
 * region, `writ` the own units' value delivered, `homeDays` the days its counting homes stood this week (the guild's
 * HOMES_SEAT_MAX already chosen). CROWN1: `watchBonus` the Watch's share more (a Free Land's FREE_LAND_WATCH_BONUS, 4.3),
 * rounded down, before the account's cap. SEASON1 part two: `raid` an Orc Raid's camps' influence, at most 250 a week;
 * `tide` the week's Tide at the seat (a Plague's Watch, an Incursion's gates).
 * @param {{ watch?: number, gates?: number, renownXp?: number, writ?: number, homeDays?: number, raid?: number }} a
 * @param {number} [watchBonus]
 */
export function accountSeatInfluence({ watch = 0, gates = 0, renownXp = 0, writ = 0, homeDays = 0, raid = 0 } = {}, watchBonus = 0, tide = 'calm') {
  // CROWN1: a Free Land's tenth more; SEASON1 part two (9.3): a Plague's half
  // AUDIT-SEATS L10: every count through amountOf - a NaN is none, not a NaN total
  const w = Math.floor(amountOf(watch) * WATCH_INFLUENCE * (1 + amountOf(watchBonus)) * (tide === 'plague' ? TIDE_EFFECTS.plagueWatch : 1) + 1e-9);
  const g = Math.min(GATE_WEEK_CAP, amountOf(gates) * GATE_INFLUENCE) * (tide === 'daedra' ? TIDE_EFFECTS.daedraGates : 1);   // SEASON1 part two: a Daedric Incursion's double, past the cap
  const r = Math.min(RENOWN_WEEK_CAP, Math.floor(amountOf(renownXp) / RENOWN_XP_PER_INFLUENCE));
  const h = amountOf(homeDays) * HOME_INFLUENCE_DAY;
  const m = amountOf(writ) * WRIT_INFLUENCE_PER_MARK;
  const o = Math.min(TIDE_EFFECTS.orcsInfluenceWeek, amountOf(raid));   // SEASON1 part two (9.3): an Orc Raid's camps, a week's 250
  return Math.min(ACCOUNT_SEAT_WEEK_CAP, w + g + r + h + m + o);
}

/**
 * A GUILD'S WEEK AT A SEAT: its accounts' own influence (accountSeatInfluence each), then its Tribute (the Marks it
 * burnt, and bought units delivered, at TRIBUTE_MARKS_PER_INFLUENCE) inside tributeRoom. Answers `{ total, others,
 * tribute }`.
 * @param {number[]} accounts each account's accountSeatInfluence
 * @param {number} tributeMarks Marks of Tribute and bought units' value, together
 */
export function guildSeatInfluence(accounts, tributeMarks = 0) {
  const others = (accounts ?? []).reduce((n, v) => n + Math.max(0, v), 0);
  const tribute = Math.min(Math.floor(Math.max(0, tributeMarks) / TRIBUTE_MARKS_PER_INFLUENCE), tributeRoom(others));
  return { total: others + tribute, others, tribute };
}
/** The whole days a home stood in the week [weekStartS, nowS): from when it was bought (or the week's start), whole. */
export const homeDaysIn = (boughtAtS, weekStartS, nowS) => Math.max(0, Math.floor((nowS - Math.max(boughtAtS, weekStartS)) / 86400));
/** Pledges set or moved, an account an hour (Appendix B's rate limits). */
export const SEAT_PLEDGES_HOUR = 30;
/** The Watch's receipts one claim carries at most - what one request's 4 KiB (server-account service.js MAX_BODY_BYTES)
 *  holds with room to spare: a receipt runs to about 240 characters with the longest account id. 24 minutes of ticks. */
export const SEAT_WATCH_CLAIM_MAX = 12;


// ─── THE SEAT TAB'S WORDS (SEAT0 7.9: "the standings") ─────────────

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** A span of seconds as the tab says it: "2d 4h", "3h 20m", "12m". */
export function seatSpanWords(s) {
  const t = Math.max(0, Math.floor(s));
  const d = Math.floor(t / 86400), h = Math.floor((t % 86400) / 3600), m = Math.floor((t % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
/** The week's line: the Muster until the Reckoning, then the Reckoning until the Turning. */
export function seatWeekLine({ phase, reckoningAt, turningAt }, nowS) {
  return phase === 'reckoning'
    ? `The Reckoning: pledges are locked. The Turning comes Sunday 18:00 UTC, in ${seatSpanWords(turningAt - nowS)}.`
    : `The Muster: pledges close Friday 18:00 UTC, in ${seatSpanWords(reckoningAt - nowS)}.`;
}
/** A standing's row: "1. the Silver Hand <SH> - 8,393 influence". */
export const seatStandingLine = (s, i) => `${i + 1}. ${guildWords(s.guild)} - ${s.influence.toLocaleString('en-US')} influence${s.shrine > 0 ? ` (its Shrine's ${s.shrine.toLocaleString('en-US')})` : ''}`;   // SEAT2b part two: the holder's Shrine's part
/** No guild pledged here yet. */
export const seatNoStandingsLine = (seat) => `No guild has pledged to ${seat.name} this week.`;
/**
 * The reader's own guild at this seat (`mine` of the standings' answer): where it is pledged in the seat's region, and
 * whether this account's war and this character count here.
 * @param {{ name: string, key: number, region: number }} seat
 * @param {any} mine
 * @param {(key: number) => string|null} nameOf a seat's name by key (the client's derived seats)
 */
export function seatMineLines(seat, mine, nameOf = () => null) {
  if (!mine) return ['Join a guild to fight for a seat.'];
  const out = [];
  const here = mine.pledges.find((p) => p.region === seat.region);
  if (!here) out.push('Your guild has not pledged in this region this week.');
  else if (here.held && here.key === seat.key) out.push('Your guild holds this Charter, and is pledged to it.');   // SEAT1c
  else if (here.held) out.push(`Your guild holds ${nameOf(here.key) ?? 'another seat'} in this region, and is pledged to it.`);
  else if (here.key === seat.key) out.push(`Your guild is pledged to ${seat.name}.`);
  else out.push(`Your guild is pledged to ${nameOf(here.key) ?? 'another seat'} in this region.`);
  if (!mine.seasoned) out.push('You count for your guild after 7 days in it.');
  else if (mine.bound && mine.bound !== mine.guild) out.push('Your account fights for another guild this week.');
  else if (here?.key === seat.key) out.push(`Your influence here this week: ${mine.influence.toLocaleString('en-US')} of ${ACCOUNT_SEAT_WEEK_CAP.toLocaleString('en-US')}.`);   // BOARD-UI: what the number is
  return out;
}
/** What the pledge buttons say. */
export const SEAT_PLEDGE_WORDS = Object.freeze({
  pledge: (seat) => `Pledge to ${seat.name}`,
  move: (seat) => `Move the pledge to ${seat.name}`,
  drop: 'Take the pledge down',
  full: `Your guild has pledged in ${SEAT_PLEDGE_REGIONS_MAX} regions this week.`,
});
/** Tribute's line for the guildmaster: its room in silver. BOARD-UI: in plain words. */
export const seatTributeLine = (room) => (room > 0
  ? `Tribute: up to ${room.toLocaleString('en-US')} silver more this week, 1 influence per ${TRIBUTE_MARKS_PER_INFLUENCE} silver (the silver is spent).`
  : 'Tribute: no room left this week - it is at most a fifth of your guild\'s influence here.');

// ═══ SEAT1c: THE TURNING (SEAT0 5.2, Appendix B) ════════════════════
// The week settles the first time anything asks about any seat after its boundary - never a job that runs - in one
// transaction the service keys on the week (town_seat_weeks). The plan below is the whole decision, pure, in the order
// SEAT0 5.2 writes it, so nothing depends on which seat is read first.

/** The influence a guild needs at a seat to claim it, or to challenge its holder. */
export const CLAIM_THRESHOLD = Object.freeze({ palace: 6000, crown: 30000 });
/** What a Charter costs its first holder, in Drakes from the guild's treasury - burnt. */
export const CLAIM_FEE = Object.freeze({ palace: 8000, crown: 80000 });
/** The second claimant within this share of the first: nobody takes it - the seat is Contested. */
export const CONTESTED_MARGIN = 0.1;
/** A new Charter's Standing, its bounds, and what a Turning held unchallenged gives it. */
export const STANDING_START = 50;
export const STANDING_MAX = 100;
export const STANDING_UNCHALLENGED = 5;
/** What Standing does to the defence (SEAT0 7.3): +0.5% a point above 50, -1% a point below (100: +25%, 0: -50%). */
export const standingModifier = (s) => (s >= STANDING_START ? (s - STANDING_START) * 0.005 : (s - STANDING_START) * 0.01);
/** A guild's whole claim at a seat: this week's influence and the Legacy it carried in. */
export const claimTotal = (g) => amountOf(g.influence) + amountOf(g.legacy);
/** THE TIE ORDER (SEAT0 5.2 step 1): the greater total, then the higher Legacy, then the earlier pledge, then the lower
 *  guild id. */
export const bySeatStanding = (a, b) => claimTotal(b) - claimTotal(a) || (b.legacy ?? 0) - (a.legacy ?? 0)
  || (a.pledgedAt ?? Infinity) - (b.pledgedAt ?? Infinity) || (a.guild < b.guild ? -1 : a.guild > b.guild ? 1 : 0);
/** THE HOLDER'S DEFENCE (SEAT0 5.2 step 3): its own influence at the seat x (1 + Standing's modifier) x (1 - Overreach's
 *  cut, SEAT1d - `extra` its guild's) x 1.2 where it held its last siege or won it by forfeit (`held`, SEAT2a part
 *  three - the siege's aftermath), and its Legacy. A liege's reach comes with CROWN2. */
export const seatDefence = (own, standing, extra = 0, held = false, liegeReach = 0) => Math.floor(Math.max(0, own?.influence ?? 0) * (1 + standingModifier(standing)) * overreachDefence(extra) * (held ? SIEGE_DEFENCE_BONUS : 1) + 1e-9)
  + Math.floor(Math.max(0, own?.influence ?? 0) * Math.max(0, liegeReach) * FEALTY.reachShare + 1e-9)   // CROWN2 (5.2 step 4, 7.8): a vassal's - half its liege's reach on its own influence
  + Math.max(0, own?.legacy ?? 0);

/**
 * THE TURNING'S PLAN (SEAT0 5.2) - pure. `seats` every confirmed seat with anything at it this week: its tier, its
 * holder (`{ guild, standing, truceWeek }` or null - SEAT1d: its `tithe`, the upkeep it `owed` from a week in Neglect,
 * whether its own members kept the Watch there (`watched`), the `gates` felled in its region, its `writs` filled there,
 * and the `edict` proclaimed for the coming week, or null) and each guild's week there (`{ guild, influence, legacy,
 * pledgedAt }`, influence after its caps); `treasuries` each guild's Drake treasury; `active` the accounts that played
 * online in the week (the crown's scale). Answers what the settle writes:
 *   claims      an unheld seat's Charter taken (`{ key, guild, fee, total }`), in key order, each fee paid in turn;
 *   contested   an unheld seat whose two first claimants stand within 10% (`{ key, a, b }`) - a Tourney decides it;
 *   upkeep      SEAT1d: each held seat's week paid (`{ key, guild, amount, paid, owed, state }` - 'paid'; 'late', with
 *               the week in Neglect's arrears; 'neglect', its first short week; 'lapse', its second), in key order out
 *               of what the claims left - reckoned before the Rights, so a Charter that lapses is no siege's; SEAT2b part
 *               two (c): 'revolt' (nothing paid) where the holder's revolt this week was not put down (`revolted`);
 *   rights      a Right of Siege granted (`{ key, guild, total, defence }`) - one a guild and one a seat a week, the
 *               strongest first, a seat in truce (changed hands at the last Turning) never challenged; AUDIT-SEATS S3:
 *               a seat's `carried` Right (its siege void this week, 17) granted before any, `carried: true`;
 *   edicts      SEAT1d: the coming week's Edict at each held seat that keeps its Charter (`{ key, guild, edict, cost,
 *               state }` - 'law', its cost paid (a Bounty's the `setAside` its holder named, escrowed), or 'unpaid');
 *   standings   SEAT1d: every held seat's Standing after its week (`{ key, guild, standing, changes }`, standingWeek);
 *   held        a held seat no Right was granted against (`{ key, guild, standing }`), its Standing as standings says;
 *   legacy      what each guild carries into the next week at each seat (`{ key, guild, amount }`), 10% of its week;
 *   revolts     SEAT2b part two (c): a held seat no Right was granted against whose Standing after its week is nought
 *               (`{ key, guild }`) - it revolts at its holder's next siege window (7.7).
 * @param {{ week: number, seats: any[], treasuries: Map<string, number>, active?: number }} o
 */
export function turningPlan({ week, seats, treasuries, active = CROWN_SCALE.per }) {
  const purse = new Map(treasuries);
  const claims = [], contested = [], rights = [], held = [], legacy = [], upkeep = [], edicts = [], standings = [], revolts = [];
  const sorted = [...seats].sort((a, b) => a.key - b.key);
  for (const s of sorted) {
    for (const g of s.guilds) {
      const amount = Math.floor(Math.max(0, g.influence) * SEAT_LEGACY_SHARE);
      if (amount > 0) legacy.push({ key: s.key, guild: g.guild, amount });
    }
  }
  // 2. UNHELD SEATS, in key order
  for (const s of sorted) {
    if (s.holder) continue;
    const passed = s.guilds.filter((g) => claimTotal(g) >= CLAIM_THRESHOLD[s.tier]).sort(bySeatStanding);
    if (!passed.length) continue;
    if (passed.length > 1 && claimTotal(passed[1]) >= claimTotal(passed[0]) * (1 - CONTESTED_MARGIN)) {
      contested.push({ key: s.key, a: passed[0].guild, b: passed[1].guild });
      continue;
    }
    const fee = CLAIM_FEE[s.tier];
    const taker = passed.find((g) => (purse.get(g.guild) ?? 0) >= fee);
    if (!taker) continue;
    purse.set(taker.guild, (purse.get(taker.guild) ?? 0) - fee);
    claims.push({ key: s.key, guild: taker.guild, fee, total: claimTotal(taker) });
  }
  // 5. SEAT1d: THE UPKEEP (7.1) - each holder's Overreach over the seats it held this week
  const tiersOf = new Map();
  for (const s of sorted) if (s.holder) tiersOf.set(s.holder.guild, [...(tiersOf.get(s.holder.guild) ?? []), s.tier]);
  const extraOf = (guild) => overreachOf(tiersOf.get(guild) ?? []);
  const stateOf = new Map();
  for (const s of sorted) {
    if (!s.holder) continue;
    const g = s.holder.guild, owed = Math.max(0, s.holder.owed ?? 0);
    // SEAT2b part two (c) (7.7: "Fail, and the Charter lapses"): a Charter whose revolt this week was not put down lapses
    // here - reckoned no further (no upkeep, no Right, no Edict, no Standing), as a struck seat's (AUDIT-SEATS S4)
    if (s.holder.revolted) { stateOf.set(s.key, 'revolt'); upkeep.push({ key: s.key, guild: g, amount: 0, paid: 0, owed: 0, state: 'revolt' }); continue; }
    const amount = seatUpkeep(s.tier, extraOf(g), active), due = amount + owed, has = purse.get(g) ?? 0;
    const state = has >= due ? (owed > 0 ? 'late' : 'paid') : owed > 0 ? 'lapse' : 'neglect';
    if (state === 'paid' || state === 'late') purse.set(g, has - due);
    stateOf.set(s.key, state);
    upkeep.push({ key: s.key, guild: g, amount, paid: state === 'paid' || state === 'late' ? due : 0, owed: state === 'neglect' ? amount : 0, state });
  }
  const keeps = (s) => s.holder && stateOf.get(s.key) !== 'lapse' && stateOf.get(s.key) !== 'revolt';
  // AUDIT-SEATS S3 (17: "At that Turning the carried Right is the challenger's one Right of Siege (5.2 step 4 grants it no
  // other), and the seat is granted no other challenge"): `carried` a Right whose siege was void this week (`{ guild,
  // total, defence }` - the Right as it was granted), granted again first where the holder keeps its Charter
  const seatTaken = new Set(), guildTaken = new Set();
  for (const s of sorted) {
    if (!keeps(s) || !s.carried) continue;
    seatTaken.add(s.key); guildTaken.add(s.carried.guild);
    rights.push({ key: s.key, guild: s.carried.guild, total: s.carried.total, defence: s.carried.defence, carried: true });
  }
  // 3-4. HELD SEATS: the defence, every candidate, one pass - a challenger's influence at a seat in Unrest risen
  const candidates = [];
  for (const s of sorted) {
    if (!keeps(s) || s.holder.truceWeek === week) continue;
    const defence = seatDefence(s.guilds.find((g) => g.guild === s.holder.guild), s.holder.standing, extraOf(s.holder.guild), !!s.holder.bonus, s.holder.liegeReach ?? 0);
    for (const g of s.guilds) {
      if (g.guild === s.holder.guild || (s.barred ?? []).includes(g.guild)) continue;   // SEAT2a: a challenger that lost or forfeited its siege here
      const risen = { ...g, influence: unrestInfluence(g.influence, s.holder.standing) }, total = claimTotal(risen);
      // AUDIT-SEATS L2: ranked as risen (5.2 step 4, "highest first ... at its strongest seat") - not by the raw influence
      if (total >= CLAIM_THRESHOLD[s.tier] && total > defence) candidates.push({ ...risen, key: s.key, total, defence });
    }
  }
  candidates.sort((a, b) => bySeatStanding(a, b) || a.key - b.key);
  for (const c of candidates) {
    if (seatTaken.has(c.key) || guildTaken.has(c.guild)) continue;
    seatTaken.add(c.key); guildTaken.add(c.guild);
    rights.push({ key: c.key, guild: c.guild, total: c.total, defence: c.defence });
  }
  // SEAT1d: THE COMING WEEK'S EDICTS (7.6), paid after the upkeep; and every held seat's week of Standing (7.3)
  for (const s of sorted) {
    if (!keeps(s)) continue;
    const e = s.holder.edict ?? null;
    let law = null;
    if (e && edictOk(e)) {
      const cost = e === 'bounty' ? Math.max(0, s.holder.setAside ?? 0) : edictCost(e, s.tier, s.holder.tideNext), has = purse.get(s.holder.guild) ?? 0;   // SEASON1 part two: its week's Tide
      law = has >= cost ? e : null;
      if (law) purse.set(s.holder.guild, has - cost);
      edicts.push({ key: s.key, guild: s.holder.guild, edict: e, cost, state: law ? 'law' : 'unpaid' });
    }
    const unchallenged = !seatTaken.has(s.key);
    const w = standingWeek({
      tier: s.tier, titheCap: s.holder.titheCap ?? null, standing: s.holder.standing, tithe: s.holder.tithe ?? 0, watched: s.holder.watched ?? true, gates: s.holder.gates ?? 0,
      writs: s.holder.writs ?? 0, unchallenged, upkeep: stateOf.get(s.key), edict: law, conscripted: !!s.holder.conscripted, brokeFealty: !!s.holder.brokeFealty,
      tide: s.holder.tide ?? 'calm', shrine: s.holder.shrine ?? 0,   // SEAT2b part two: the Shrine's Standing
    });
    standings.push({ key: s.key, guild: s.holder.guild, standing: w.standing, changes: w.changes });
    if (unchallenged) held.push({ key: s.key, guild: s.holder.guild, standing: w.standing });
    // SEAT2b part two (c) (7.7: "A seat at Standing 0 revolts at its next siege window"): its Standing after the week at
    // nought - DECIDED: where a Right of Siege is granted at it the siege takes the window (a siege held would raise it)
    if (unchallenged && revoltDue(w.standing)) revolts.push({ key: s.key, guild: s.holder.guild });
  }
  return { claims, contested, upkeep, rights, edicts, standings, held, legacy, revolts };
}

// ─── THE CHRONICLE'S WORDS (SEAT0 9.2) ─────────────────────────────

/** The Chronicle's rows the Seat tab shows, newest first. */
export const SEAT_CHRONICLE_SHOWN = 8;
/** A seat week as the Chronicle names it. */
export const seatWeekName = (n) => `week ${n}`;
/**
 * A HISTORY ROW AS PROSE - `row` a `town_seat_history` row (`kind`, `week`, `data` parsed), `seat` the seat it is of.
 * The names in `data` are the guilds' as they were that day. Null for a kind with no words.
 */
export function chronicleLine(row, seat, zero = null) {
  const d = row?.data ?? {};
  const c = charterName(seat);
  const when = chronicleWhen(row?.week ?? 0, zero);   // SEASON1 part three: the Season's own words, where one is counted
  switch (row?.kind) {
    case 'claim': return `${when}, ${guildWords(d.guild)} took ${c} with ${Number(d.total ?? 0).toLocaleString('en-US')} influence.`;
    case 'contested': return `${when}, ${c} was Contested between ${guildWords(d.a)} and ${guildWords(d.b)}. A Tourney decides it.`;
    case 'right': return `${when}, ${guildWords(d.guild)} won a Right of Siege against ${guildWords(d.holder)} at ${seat.name}.`;
    case 'held': return `${when}, ${guildWords(d.guild)} held ${seat.name} unchallenged.`;
    // SEASON1 (9.1): a Season's end at every seat held through it
    case 'season-end': return `At the end of ${seatSeasonName(Number(d.season)) ?? 'the Season'}, ${guildWords(d.guild)} held ${seat.name}${d.kept ? ', as it had the whole Season through' : ''}.`;
    case 'relinquish': return `${when}, ${guildWords(d.guild)} gave up ${c}.`;
    // AUDIT-SEATS S4 (16: "the Charter voids, the claim fee is refunded ... if struck within the Season"): a held seat's
    // strike names the Charter it voided and the fee it refunded
    case 'strike': return d.guild
      ? `${when}, ${seat.name} was struck from the registry, and ${guildWords(d.guild)}'s Charter with it${Number(d.refund) > 0 ? ` - its claim fee of ${Number(d.refund).toLocaleString('en-US')} Marks refunded` : ''}.`
      : `${when}, ${seat.name} was struck from the registry.`;
    // AUDIT-SEATS S4: a Charter whose seat the registry no longer confirms, lapsed at the Turning
    case 'unregistered': return `${when}, ${c} lapsed - ${seat.name} is no longer confirmed in the registry.`;
    // SEAT1d: the upkeep's and the Edicts' rows
    case 'neglect': return `${when}, ${guildWords(d.guild)} could not pay the upkeep of ${c}. ${seat.name} is in Neglect.`;
    case 'late': return `${when}, ${guildWords(d.guild)} paid the upkeep it owed for ${c}.`;
    case 'lapse': return `${when}, ${c} lapsed - ${guildWords(d.guild)} could not pay its upkeep two weeks running.`;
    case 'edict': return `${when}, ${guildWords(d.guild)} proclaimed ${edictWords(d.edict) ?? 'an Edict'} at ${seat.name}.`;   // AUDIT-SEATS L7: its article
    case 'edict-unpaid': return `${when}, ${guildWords(d.guild)} could not pay for the ${EDICTS[d.edict]?.name ?? 'Edict'} it proclaimed at ${seat.name}.`;
    // SEAT2a: the schedule's two rows
    case 'battle-moved': return `${when}, the battle for ${seat.name} was moved to ${battleWhenText(Number(d.at ?? 0) * 1000)}, so that no guild fights twice at once.`;
    case 'battle-void': return `${when}, no hour of the week could hold the battle for ${seat.name}; it is void.`;
    // SEAT2a part three: a battle's end
    // AUDIT-SEATS (9.2: "stormed the gates of Anticlere and took its Charter from the Ebon Oath after thirty-one minutes"):
    // the siege's length where its row keeps one
    case 'siege-taken': return Number.isSafeInteger(d.minutes) && d.minutes > 0
      ? `${when}, ${guildWords(d.guild)} stormed the gates of ${seat.name} and took its Charter from ${guildWords(d.from)} after ${countWords(d.minutes)} ${d.minutes === 1 ? 'minute' : 'minutes'}.`
      : `${when}, ${guildWords(d.guild)} took ${c} by siege from ${guildWords(d.from)}.`;
    // AUDIT-SEATS T1 (9.2: "The Ebon Oath held Wayrest against the Iron Circle. The Throne was never reached."): the Throne's
    // line where the row keeps it (a row written before T1 keeps none, and says neither)
    case 'siege-held': return `${when}, ${guildWords(d.guild)} held ${seat.name} against the siege of ${guildWords(d.against)}${d.throne === 1 ? ', though its Throne was reached' : ''}.${d.throne === 0 ? ' The Throne was never reached.' : ''}`;
    case 'siege-forfeit': return `${when}, ${guildWords(d.against)} never came to the siege of ${seat.name}; ${guildWords(d.guild)} holds it by forfeit.`;
    case 'siege-absent': return `${when}, neither side came to the siege of ${seat.name}; ${guildWords(d.guild)} keeps it.`;
    case 'tourney-won': return `${when}, ${guildWords(d.guild)} won the Tourney for ${c}.`;
    case 'tourney-unheld': return `${when}, the Tourney for ${seat.name} was fought, but neither guild could pay for ${c}.`;
    // SEAT2b part two (c) (7.7; 9.2: "Anticlere rose against the Silver Hand. The rebel captain fell at the palace door,
    // and the Charter held."): a revolt due at the Turning, put down, or standing at its window's end (the Charter lapsed)
    case 'revolt': return `${when}, ${seat.name}'s Standing under ${guildWords(d.guild)} fell to nothing, and the town rose in revolt.`;
    case 'revolt-down': return `${when}, ${seat.name} rose against ${guildWords(d.guild)}. The rebel captain fell at the palace door, and the Charter held.`;
    case 'revolt-stood': return `${when}, ${seat.name} rose against ${guildWords(d.guild)}, and the rebel captain held the palace door. ${c} lapsed.`;
    // AUDIT-SEATS S3 (17: "voids the siege: the holder keeps the seat for now, and the challenger's Right carries to the
    // holder's window the next week"): a battle no result reached by its week's Turning
    case 'siege-void': return d.battle === 'tourney'
      ? `${when}, no result of the Tourney for ${seat.name} came; it is void, and ${c} stays unheld.`
      : d.carried
        ? `${when}, no result of the siege of ${seat.name} came; it is void, ${guildWords(d.holder)} keeps it for now, and ${guildWords(d.guild)}'s Right of Siege carries to the next week.`
        : `${when}, no result of the siege of ${seat.name} came; it is void, and ${guildWords(d.holder)} keeps it.`;
    // VOID (18: "Moderators (MOD1) may void a siege (`/siege void`) - a history row"): a battle of the week the Moderators
    // voided (server-account/src/seatSiege.js voidSiege) - and where a Charter it had moved went back, to whom
    case 'siege-voided': return `${when}, ${d.battle === 'tourney' ? `the Tourney for ${seat.name}` : d.battle === 'revolt' ? `the revolt at ${seat.name}` : `the siege of ${seat.name}`} was voided by the Moderators${d.restored ? `, and ${c} went back to ${guildWords(d.holder)}` : ''}.`;
    // CROWN1: Conscription paid (7.6) - at the crown, and at each seat that paid it
    // AUDIT-SEATS L7: in Drakes, the word every player-read sum says (DRAKES; marksLaw.js marksText)
    case 'conscription': return `${when}, the crown's Conscription brought ${guildWords(d.guild)} ${marksText(Number(d.marks ?? 0))} of its kingdom's Tithe.`;
    case 'conscripted': return `${when}, ${guildWords(d.guild)} paid ${marksText(Number(d.marks ?? 0))} of its Tithe to ${guildWords(d.crown)}'s Conscription.`;
    // CROWN1 part two: the Royal Tourney's end
    case 'royal-champion': return `${when}, ${d.name || 'a contender'} won the Royal Tourney at ${seat.name} with ${plural(Number(d.wins ?? 0), 'bout')} - Champion of ${kingdomName(d.kingdom) ?? seat.name}.`;   // AUDIT-SEATS L7: "1 bout"
    case 'royal-none': return `${when}, no bout of the Royal Tourney at ${seat.name} was won; its prize went home.`;
    // CROWN2: fealty (7.8)
    case 'fealty-sworn': return `${when}, ${guildWords(d.vassal)} swore fealty to ${guildWords(d.liege)}.`;
    case 'fealty-broken': return `${when}, ${guildWords(d.breaker)} broke the fealty between ${guildWords(d.vassal)} and ${guildWords(d.liege)}.`;
    case 'fealty-tribute': return `${when}, ${guildWords(d.vassal)} paid ${marksText(Number(d.marks ?? 0))} of tribute to ${guildWords(d.liege)}.`;
    case 'fealty-lapsed': return `${when}, the fealty between ${guildWords(d.vassal)} and ${guildWords(d.liege)} lapsed.`;
    // SEAT2b (7.5): a fortification's project begun, and its tier standing
    case 'fort-begun': return `${when}, ${guildWords(d.guild)} began raising ${seat.name}'s ${fortWork(d.work)?.name ?? 'works'} to ${theirOf(d.work)} ${TIER_WORDS[d.tier] ?? 'next'} tier.`;
    case 'walls-kept': return `${when}, a Fortifier's work kept ${seat.name}'s Walls standing as the seat was taken.`;
    case 'fort-raised': return `${when}, ${seat.name}'s ${fortWork(d.work)?.name ?? 'works'} stood at ${theirOf(d.work)} ${TIER_WORDS[d.tier] ?? 'next'} tier.`;
    default: return null;
  }
}
// ─── AUDIT-SEATS (2026-10-01, Mac: "We need to do a comprehensive audit on everything and finish the not done") ───
const ONES = Object.freeze(['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']);
const TENS = Object.freeze(['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']);
/** SEAT2b: a tier as the Chronicle names it. */
const TIER_WORDS = Object.freeze({ 1: 'first', 2: 'second', 3: 'third' });
/** SEAT2b: a work's pronoun - the Walls and the Watchtowers "their", the rest "its". */
const theirOf = (work) => (work === 'walls' || work === 'watchtowers' || !fortWork(work) ? 'their' : 'its');
/** A count in words, as the Chronicle reads one (9.2: "after thirty-one minutes") - 0 to 99; past it, its digits. */
export function countWords(n) {
  if (!Number.isSafeInteger(n) || n < 0) return String(n);
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '');
  return n.toLocaleString('en-US');
}
/** A siege's length, whole minutes (at least one), from its start to the end its receipt was signed at - or null. */
export const siegeMinutes = (startS, endS) => (Number.isFinite(startS) && Number.isFinite(endS) && endS >= startS ? Math.max(1, Math.round((endS - startS) / 60)) : null);

// ─── SEASON1 part three (2026-10-01, Mac: "Finish the seats"; "Continue"; "Hurry up"): THE HALL OF RECORDS (9.2) ───
/** The weeks of a Season in words, as the Hall of Records reads them - "the third week". */
const WEEK_ORDINALS = Object.freeze(['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth']);
/** WHEN A CHRONICLE ROW HAPPENED (9.2: "In the third week of the Season of Hearthfire, ..."): the week of its Season while
 *  one is counted (`zero` the week Season 0 began - seasonZeroOf's), else the seat week's number ("In week 12"). */
export function chronicleWhen(week, zero = null) {
  const s = seasonOf(week, zero);
  const nth = s ? WEEK_ORDINALS[week - s.start] : null;
  return nth ? `In the ${nth} week of ${seatSeasonName(s.n)}` : `In ${seatWeekName(week)}`;
}
/** The most of a seat's Chronicle the Hall of Records reads - its newest rows, the book's oldest first. */
export const HALL_OF_RECORDS_ROWS = 400;
/** The Hall of Records' title: "The Hall of Records of Anticlere". */
export const hallOfRecordsTitle = (seat) => `The Hall of Records of ${seat?.name ?? 'the seat'}`;
/** What an empty Hall of Records says. */
export const HALL_OF_RECORDS_EMPTY = 'Nothing is written here yet.';
/** THE HALL OF RECORDS' CHAPTERS (9.2): a seat's Chronicle rows (oldest first) as chronicleLine reads them, one chapter a
 *  Season - `{ heading, lines }`, the heading the Season's name (seatSeasonName's), or null for rows from no counted
 *  Season; a row the Chronicle has no words for is left out. */
export function hallOfRecordsChapters(rows, seat, zero = null) {
  const out = [];
  for (const r of rows ?? []) {
    const line = chronicleLine(r, seat, zero);
    if (!line) continue;
    const s = seasonOf(Number(r?.week), zero);
    const heading = s ? seatSeasonName(s.n) : null;
    const last = out.at(-1);
    if (last && last.heading === heading) last.lines.push(line);
    else out.push({ heading, lines: [line] });
  }
  return out;
}

/** STANDING-TREND (7.9: "Standing and its trend"): which way the holder's Standing moved since the last Turning began -
 *  its Standing now less the `was` the standings read names (seatInfluence.js standingWas) - or null where none is named. */
export function standingTrend(holder) {
  const now = Number(holder?.standing), was = holder?.was;
  return typeof was === 'number' && Number.isFinite(was) && Number.isFinite(now) ? now - was : null;
}
/** The trend in words, after the Standing: ", up 7 since the last Turning", ", down 3 ...", ", steady ..."; '' for none. */
export function standingTrendWords(trend) {
  if (trend == null) return '';
  return `, ${trend > 0 ? `up ${trend}` : trend < 0 ? `down ${0 - trend}` : 'steady'} since the last Turning`;
}
/** The Seat tab's holder line: "Held by the Silver Hand <SH> since week 3. Standing 55." - STANDING-TREND: and its trend
 *  where the read names one ("Standing 55, up 7 since the last Turning."). */
export const seatHolderLine = (holder) => (holder
  ? `Held by ${guildWords(holder.guild)} since ${seatWeekName(holder.since)}. Standing ${holder.standing}${standingTrendWords(standingTrend(holder))}.`
  : 'No guild holds this Charter.');
/** This week's battle at a seat, in words - a Contested seat's Tourney, or a Right of Siege - or null. */
export function seatBattleLine(battle) {
  if (!battle) return null;
  if (battle.kind === 'revolt') return `The town rises against ${guildWords(battle.against)} this week - a Rebel Captain holds the palace door.`;   // SEAT2b part two (c)
  if (battle.kind === 'tourney') return `${GuildWords(battle.guild)} and ${guildWords(battle.against)} meet in a Tourney for the Charter this week.`;
  return `${GuildWords(battle.guild)} has won a Right of Siege against ${guildWords(battle.against)} this week.`;
}
/**
 * SEAT-TIP (FIELD BUGS 2026-10-04e: "We need a hover tooltips for capturable cities/towns that show occupation"): A
 * SEAT'S CARD for a map's hover - the Overworld's plate and the held map's mark - `{ title, lines }` (the EVENT-TIP card,
 * ui/eventMapMarks.js readTip): the town, then its Charter and who holds it ("The Charter of Anticlere: held by the
 * Silver Hand <SH>"), how long and how firmly (seatHolderLine), the holder's rule (seatRuleLine), and this week's battle
 * and a called siege. `seat` a DRESSED seat (net/townSeatBook.js dressed - `holder`, `battle`), or null. Pure.
 */
export function seatTipOf(seat, nowMs = Date.now()) {
  if (!seat?.name) return null;
  const holder = seat.holder ?? null;
  const lines = [seatInfoLine(seat, holder?.guild ?? null)];
  if (holder?.guild) lines.push(seatHolderLine(holder));
  const rule = seatRuleLine(seat, holder);
  if (rule) lines.push(rule);
  const battle = seatBattleLine(seat.battle ?? null);
  if (battle) lines.push(battle);
  const siege = siegeCalledClause(seat.battle, nowMs).trim();
  if (siege) lines.push(siege);
  return { title: seat.name, lines };
}
/** What the relinquish button says - pressed once to arm, again to give the Charter up. */
export const SEAT_RELINQUISH_WORDS = Object.freeze({ arm: 'Give up the Charter', sure: 'Press again to give up the Charter' });
/** The claim line under the standings: the threshold an unheld seat's claimant must pass, or the holder's defence. */
export const seatClaimLine = (seat, defence = null) => (defence == null
  ? `To claim it at the Turning: ${CLAIM_THRESHOLD[seat.tier].toLocaleString('en-US')} influence, and ${CLAIM_FEE[seat.tier].toLocaleString('en-US')} silver from the guild's treasury.`
  : `To win a Right of Siege: more than the holder's defence of ${defence.toLocaleString('en-US')}, and at least ${CLAIM_THRESHOLD[seat.tier].toLocaleString('en-US')} influence.`);

// ─── SEAT1c: THE TITLES AND GLYPHS A CHARTER GIVES (SEAT0 7.4) ─────
// Derived, as every title is: held while the Charter is, gone from the next token when it is not. The token carries a
// generic id and a claim (net/identityToken.js SEAT_TITLES, `ts`: [the seat key, the Season]); the client words it.

/** A crown seat's glyph, by its kingdom - a crown in the kingdom's metal. */
export const SEAT_CROWN_GLYPHS = Object.freeze({ daggerfall: 'crownDF', wayrest: 'crownWR', sentinel: 'crownSN' });
/** The glyphs a guild's Charters give every member: `tower` for any palace seat it holds, and each crown's own -
 *  `holds` `[{ key, tier, region }]`, in the vocabulary's order. */
export function seatGlyphsOf(holds) {
  const out = new Set();
  for (const h of holds ?? []) {
    if (h.tier === 'crown') { const g = SEAT_CROWN_GLYPHS[CROWN_SEAT_REGIONS[h.region]]; if (g) out.add(g); } else out.add('tower');
  }
  return ['tower', 'crownDF', 'crownWR', 'crownSN'].filter((g) => out.has(g));
}
/** The title a guild's Charters give its guildmaster - "Protector of <Kingdom>" for a crown it holds (the lowest key),
 *  else "Warden of <Town>" for a palace seat (the lowest key) - `{ title, ts }`, or null for none. SEASON1: `season` the
 *  Season counted now (0 with none). */
export function seatTitleOf(holds, season = 0) {
  const by = (tier) => (holds ?? []).filter((h) => h.tier === tier).sort((a, b) => a.key - b.key)[0] ?? null;
  const crown = by('crown');
  if (crown) return { title: 'protector', ts: [crown.key, season] };
  const palace = by('palace');
  return palace ? { title: 'warden', ts: [palace.key, season] } : null;
}
/** A seat title in words, off its claim - `place(key)` the client's own seat by key (its name and region), or null:
 *  "Warden of Anticlere", "Protector of Wayrest"; null where the place is not this client's to name. */
/** AUDIT-SEATS L7: a title's Season as it reads - ", Season 3" - and nothing for a title won with none counted (a
 *  champion's before SEASON_ZERO_WEEK is set: seatRoyal.js keptTitleOf passes 0, and "Season 0" is the beta's name). */
const seasonTail = (n) => (Number.isSafeInteger(n) && n >= 1 ? `, Season ${n}` : '');
export function seatTitleText(title, ts, place) {
  if (!Array.isArray(ts)) return null;
  const seat = place?.(ts[0]) ?? null;
  const kingdom = seat ? kingdomName(CROWN_SEAT_REGIONS[seat.region] ?? kingdomOf(seat.region)) : null;
  switch (title) {
    case 'warden': return seat ? `Warden of ${seat.name}` : null;
    case 'protector': return kingdom ? `Protector of ${kingdom}` : null;
    case 'crowned': return `Crowned in Season ${ts[1]}`;
    case 'keeper': return seat ? `Keeper of ${seat.name}${seasonTail(ts[1])}` : null;
    case 'champion': return kingdom ? `Champion of ${kingdom}${seasonTail(ts[1])}` : null;   // CROWN1 part two: 7.6's words
    default: return null;
  }
}

// ═══ SEAT1d: HOLDING A SEAT (SEAT0 7.1-7.3, 7.6) ════════════════════
// What a Charter costs each week (upkeep, Overreach), what it pays (the Tithe across its bailiwick, the members'
// discount), the town's favour (Standing, every row of 7.3) and the holder's word (the Edicts). The Turning reckons
// every one of them in its one batch (server-account/src/seatTurning.js); the client prices its own shops off them.

/** A Charter's upkeep a week, in Drakes from the holder's treasury - burnt (SEAT0 7.1). */
export const SEAT_UPKEEP = Object.freeze({ palace: 2500, crown: 15000 });
/** The crown's scale: x min(1.5, max(0.4, active / 100)), `active` the accounts that played online in the week. */
export const CROWN_SCALE = Object.freeze({ least: 0.4, most: 1.5, per: 100 });
export const crownScale = (active) => Math.min(CROWN_SCALE.most, Math.max(CROWN_SCALE.least, Math.max(0, Number(active) || 0) / CROWN_SCALE.per));
/** OVERREACH (SEAT0 7.1): a palace weighs 1, a crown 3; a guild's extra is its seats' weight less its heaviest seat's;
 *  every seat it holds pays upkeep x (1 + 0.25 x extra) and defends at x (1 - 0.05 x extra) - added, not compounded. */
export const SEAT_WEIGHT = Object.freeze({ palace: 1, crown: 3 });
export const OVERREACH = Object.freeze({ upkeep: 0.25, defence: 0.05 });
/** A guild's Overreach extra over the tiers of the seats it holds. */
export function overreachOf(tiers) {
  const w = (tiers ?? []).map((t) => SEAT_WEIGHT[t] ?? 0);
  return w.length ? w.reduce((a, b) => a + b, 0) - Math.max(...w) : 0;
}
/** The defence's Overreach factor, never below nothing. */
export const overreachDefence = (extra) => Math.max(0, 1 - OVERREACH.defence * Math.max(0, extra));
/** ONE SEAT'S UPKEEP this week - its tier's, the crown's scale over `active`, Overreach's share.
 * @param {string} tier @param {number} [extra] @param {number} [active] */
export const seatUpkeep = (tier, extra = 0, active = CROWN_SCALE.per) =>
  Math.floor(SEAT_UPKEEP[tier] * (tier === 'crown' ? crownScale(active) : 1) * (1 + OVERREACH.upkeep * Math.max(0, extra)) + 1e-9);

/** THE TITHE (SEAT0 7.2): the holder's rate in whole percents, palace 0-10, crown 0-15, changed at most once a week. */
export const TITHE_CAP = Object.freeze({ palace: 10, crown: 15 });
export const titheOk = (tier, pct) => Number.isSafeInteger(pct) && pct >= 0 && pct <= (TITHE_CAP[tier] ?? -1);
/** A Tithe's share of an amount (a sale's price, a courier's fee), rounded down - marketLaw.js saleTithe's rule. */
export const titheOf = (amount, pct) => Math.floor((Math.max(0, amount) * Math.max(0, pct)) / 100);
/**
 * THE BAILIWICK (SEAT0 7.2): the seat a Notice Board belongs to - the seat of its region nearest it by map pixel (ties
 * to the lower key), or null in a region with none. `seats` the confirmed registry's (`{ key, region, pixel }`), `pixel`
 * the board's town (null: the region's lowest key - every board in a seated region is some seat's).
 * @param {Iterable<{ key: number, region: number, pixel: number[] }>} seats
 * @param {number} region
 * @param {number[]|null} [pixel]
 */
export function bailiwickOf(seats, region, pixel = null) {
  let best = null, bestD = Infinity;
  for (const s of seats) {
    if (s.region !== region) continue;
    const d = pixel ? (s.pixel[0] - pixel[0]) ** 2 + (s.pixel[1] - pixel[1]) ** 2 : 0;
    if (d < bestD || (d === bestD && s.key < best.key)) { best = s; bestD = d; }
  }
  return best;
}

/** THE MEMBERS' DISCOUNT (SEAT0 7.2) at the seat town's shops, and its rise while Standing is loved; Market Day's for
 *  everyone (7.6). Added, never compounded, and applied on the buyer's own client where the shop's price is reckoned. */
export const MEMBER_DISCOUNT = Object.freeze({ palace: 0.10, crown: 0.15 });
export const STANDING_LOVED = 80;
export const LOVED_DISCOUNT = 0.05;
export const MARKET_DAY_DISCOUNT = 0.10;
/**
 * WHAT A SEAT TOWN'S SHOPS ASK OF THIS PLAYER, as a factor of their price: 1 less the members' discount (a member of the
 * holder's guild) and Market Day's (anyone, while it is proclaimed). `seat` a dressed seat (`{ tier, holder }`, the
 * holder `{ guild: { id }, standing, edict }`), `guildId` the player's own guild or null.
 */
export function seatShopFactor(seat, guildId = null) {
  const h = seat?.holder;
  if (!h) return 1;
  const member = guildId != null && h.guild?.id === guildId;
  const off = (member ? (MEMBER_DISCOUNT[seat.tier] ?? 0) + (h.standing >= STANDING_LOVED ? LOVED_DISCOUNT : 0) : 0)
    + (h.edict === 'market-day' ? MARKET_DAY_DISCOUNT : 0);
  return Math.max(0, 1 - off);
}

/** STANDING (SEAT0 7.3): every row of its table. The siege's and the revolt's rows are SEAT2a's and SEAT2b's to apply. */
export const STANDING_CHANGES = Object.freeze({
  titheLow: 2, titheHigh: -3, unchallenged: STANDING_UNCHALLENGED, gate: 2, gateWeekMax: 6, noWatch: -5,
  siegeHeld: 15, throneReached: -5, festival: 10, neglect: -10, writ: 1, writWeekMax: 5, paidLate: -5,
  revoltTo: 20, curfew: -2, levy: -2, openGates: 3,
  conscripted: -5,   // CROWN1 (7.6): a seat that paid a crown's Conscription
  fealtyBroken: -10,   // CROWN2 (7.8): every seat of a guild that broke its fealty
  wedding: TIDE_EFFECTS.weddingStanding, taxRevolt: TIDE_EFFECTS.revoltStanding,   // SEASON1 part two (9.3): a Royal Wedding's week; a Tax Revolt's, its Tithe above 5%
});
/** UNREST (SEAT0 7.3): below 20 challengers earn +25% influence there, and the arrival line says so; at 0 it revolts. */
export const STANDING_UNREST = 20;
export const UNREST_BONUS = 0.25;
export const seatInUnrest = (standing) => standing != null && standing < STANDING_UNREST;
/** A challenger's influence at a seat in Unrest - the holder's own never rises. */
export const unrestInfluence = (influence, standing) => (seatInUnrest(standing) ? Math.floor(Math.max(0, influence) * (1 + UNREST_BONUS) + 1e-9) : influence);
/** The Tithe's rows: at or below half its cap +2 a week, above three quarters of it -3. AUDIT SEATS-2 L1: its cap the
 *  seat's own (`cap` - a Market Hall's point a tier, seatTitheCap), else the tier's. */
export function titheStanding(tier, pct, cap = TITHE_CAP[tier] ?? 0) {
  if (pct <= cap / 2) return STANDING_CHANGES.titheLow;
  if (pct > (cap * 3) / 4) return STANDING_CHANGES.titheHigh;
  return 0;
}

/**
 * THE EDICTS (SEAT0 7.6): one for the coming week, proclaimed on the board by the Guildmaster or an Officer; none two
 * weeks running but Market Day. `cost` Drakes from the treasury at the Turning that makes it law (palace, crown);
 * `standing` its row of 7.3. The crown's two (the Royal Tourney, Conscription) are CROWN1's.
 */
export const EDICTS = Object.freeze({
  'market-day': Object.freeze({ name: 'Market Day', standing: 0, cost: null, repeat: true }),
  'open-gates': Object.freeze({ name: 'Open Gates', standing: STANDING_CHANGES.openGates, cost: null, repeat: false }),
  curfew: Object.freeze({ name: 'Curfew', standing: STANDING_CHANGES.curfew, cost: null, repeat: false }),
  festival: Object.freeze({ name: 'Festival', standing: STANDING_CHANGES.festival, cost: Object.freeze({ palace: 2500, crown: 10000 }), repeat: false }),
  levy: Object.freeze({ name: 'Levy', standing: STANDING_CHANGES.levy, cost: null, repeat: false }),
  bounty: Object.freeze({ name: 'Bounty', standing: 0, cost: null, repeat: false }),
  // CROWN1 (SEAT0 7.6): a crown's alone - the kingdom's palace seats held by other guilds pay it a share of their Tithe
  conscription: Object.freeze({ name: 'Conscription', standing: 0, cost: null, repeat: false, crown: true }),
  // CROWN1 part two (7.6): a duel ladder all week at the crown, its prize escrowed at the Turning that makes it law
  'royal-tourney': Object.freeze({ name: 'Royal Tourney', standing: 0, cost: Object.freeze({ crown: 5000 }), repeat: false, crown: true }),
});
export const edictOk = (e) => typeof e === 'string' && Object.hasOwn(EDICTS, e);
/** AUDIT-SEATS L7: an Edict as a sentence names it (9.2: "proclaimed a Festival") - a Curfew, a Festival, a Levy, a
 *  Bounty, a Conscription, a Royal Tourney; Market Day and Open Gates bare - or null for none. */
export const edictWords = (e) => (edictOk(e) ? (e === 'market-day' || e === 'open-gates' ? EDICTS[e].name : `a ${EDICTS[e].name}`) : null);
/** The same at a sentence's start: "A Festival", "Market Day". */
const edictWordsCap = (e) => { const w = edictWords(e); return w && w[0].toUpperCase() + w.slice(1); };
/** CROWN1: whether `edict` may be proclaimed at a seat of `tier` - a crown's Edicts at a crown seat alone. */
export const edictForTier = (edict, tier) => edictOk(edict) && (!EDICTS[edict].crown || tier === 'crown');
/** Whether `edict` may be proclaimed for the week after one whose Edict was `last`. */
export const edictMayFollow = (edict, last) => edictOk(edict) && (edict !== last || EDICTS[edict].repeat);
/** What an Edict costs at a seat of `tier` (0 for most). */
export const edictCost = (edict, tier, tide = 'calm') => Math.floor((EDICTS[edict]?.cost?.[tier] ?? 0)
  * (edict === 'festival' ? (tide === 'plague' ? TIDE_EFFECTS.plagueFestival : tide === 'wedding' ? TIDE_EFFECTS.weddingFestival : 1) : 1));   // SEASON1 part two: the coming week's Tide on a Festival
/** The Levy's share of a gathering's yield (SEAT0 7.6), the Bounty's pay a camp and the camps an account a day. */
export const LEVY_SHARE = 0.1;
export const BOUNTY_MARKS = 20;
export const BOUNTY_CAMPS_DAY = 5;
/** The Festive buff (SEAT0 7.6): +5 to every attribute for a game day, in the town while the Festival is proclaimed. */
export const FESTIVE = Object.freeze({ attributes: 5, gameDays: 1 });
/** FESTIVAL-STAGE (7.6: "music, banners, lanterns"): whether a Festival rules at a seat this week - its holder's Edict
 *  as the seats' book dresses it (net/townSeatBook.js dressed). */
export const festivalRules = (seat) => seat?.holder?.edict === 'festival';
/** Edicts and Tithe changes an account may ask an hour (Appendix B: edicts 5). */
export const SEAT_EDICTS_HOUR = 5;
/** Who may set the Tithe and proclaim an Edict: the Guildmaster and the Officers (SEAT0 7.9: "for the holder's
 *  Officers: the levers"). */
export const SEAT_LEVER_RANKS = Object.freeze([0, 1]);

// ─── SEAT-HALL (Seats-Arc 7.2): THE PALACE AS THE HOLDER'S GUILD HALL ───
/** The Charter Room's pieces at most (7.2: "at most 100 pieces") - a palace's, over the whole seat. */
export const SEAT_HALL_DECOR_CAP = 100;
/** How far a piece in the Charter Room keeps from every person and quest marker the palace's layout places, metres (7.2:
 *  "the decor tool refuses a piece within 2 m of any NPC or quest marker"). */
export const SEAT_HALL_CLEAR_M = 2;
/** Whether the palace seat `seat` (`{ tier, holder }` as the seats' list dresses it) is the hall of the guild `guildId`:
 *  a palace seat (a crown's castle is its hall, and stands no decor - 7.2), held by that guild. */
export const seatHallOf = (seat, guildId) => !!seat && !!guildId && seat.holder?.guild?.id === guildId;
/** The Charter Room's words. */
export const SEAT_HALL_TEXT = Object.freeze({
  where: 'The Charter Room',
  clear: 'Too near someone of the court - keep two metres from every person and every quest mark.',
  room: 'The Charter Room is the palace\'s largest room - set the piece down there.',
});

/**
 * A HELD SEAT'S WEEK OF STANDING (SEAT0 7.3), in the table's order - `{ standing, changes }`, `changes` each row that
 * moved it (`[row, delta]`), the result held to 0-100. `o`: its tier and Standing; `tithe` its rate; `watched` whether
 * any of the holder's own members kept the Watch there; `gates` gates felled in its region; `writs` the holder's writs
 * filled there; `unchallenged` no Right granted against it; `upkeep` 'paid', 'late' (paid with the arrears) or
 * 'neglect'; `edict` the Edict the Turning makes law for the coming week (its row taken as it is proclaimed);
 * CROWN1: `conscripted` the seat paid a crown's Conscription this week (7.6); CROWN2: `brokeFealty` its holder broke its
 * fealty at this Turning (7.8). SEAT2b part two: `shrine` the Shrine's row (7.5: "Standing +1 a week" a tier - fortLaw.js
 * shrineStanding of its tier, the caller's: this law reads no works).
 */
export function standingWeek({ tier, titheCap = null, standing, tithe = 0, watched = true, gates = 0, writs = 0, unchallenged = false, upkeep = 'paid', edict = null, conscripted = false, brokeFealty = false, tide = 'calm', shrine = 0 }) {
  const changes = [];
  const add = (row, d) => { if (d) changes.push([row, d]); };
  const t = titheCap == null ? titheStanding(tier, tithe) : titheStanding(tier, tithe, titheCap);   // AUDIT SEATS-2 L1: the Market Hall's cap
  add(t > 0 ? 'titheLow' : 'titheHigh', t);
  if (unchallenged) add('unchallenged', STANDING_CHANGES.unchallenged);
  add('gate', Math.min(STANDING_CHANGES.gateWeekMax, STANDING_CHANGES.gate * Math.max(0, gates)));
  if (!watched) add('noWatch', STANDING_CHANGES.noWatch);
  add('writ', Math.min(STANDING_CHANGES.writWeekMax, STANDING_CHANGES.writ * Math.max(0, writs)));
  if (upkeep === 'neglect') add('neglect', STANDING_CHANGES.neglect);
  if (upkeep === 'late') add('paidLate', STANDING_CHANGES.paidLate);
  if (edict && EDICTS[edict]?.standing) add(edict, EDICTS[edict].standing);
  if (conscripted) add('conscripted', STANDING_CHANGES.conscripted);
  if (brokeFealty) add('fealtyBroken', STANDING_CHANGES.fealtyBroken);
  if (tide === 'wedding') add('wedding', STANDING_CHANGES.wedding);   // SEASON1 part two: the week's Tide in the seat's land
  if (tide === 'revolt' && tithe > TIDE_EFFECTS.revoltTithe) add('taxRevolt', STANDING_CHANGES.taxRevolt);
  add('shrine', Math.max(0, Math.trunc(Number(shrine) || 0)));   // SEAT2b part two (7.5): the Shrine's Standing a week, its tier's (fortLaw.js shrineStanding)
  const sum = changes.reduce((a, [, d]) => a + d, 0);
  return { standing: Math.max(0, Math.min(STANDING_MAX, standing + sum)), changes };
}

/** CURFEW (SEAT0 7.6): the town's guards stand this many levels stronger at night, and a crime there costs this many
 *  times the legal reputation - each player's own, on its own client. */
export const CURFEW = Object.freeze({ guardLevels: 5, crimeFactor: 2 });

/** What each Edict does, in the Seat tab's words. */
export const EDICT_WORDS = Object.freeze({
  'market-day': 'The town\'s shops ask a tenth less of everyone.',
  'open-gates': 'Every home in the town stands open to all. Standing +3.',
  curfew: 'The guards are stronger at night and every crime costs twice the reputation. Standing -2.',
  festival: 'Music and banners; everyone in the town is Festive, +5 to every attribute for a day. Standing +10.',
  levy: 'A tenth of what is gathered near the town goes to its stockpile. Standing -2.',
  bounty: 'Camps near the town yield double, and the treasury pays 20 silver a camp cleared, from what is set aside.',
  conscription: 'The kingdom\'s palace seats held by other guilds pay the crown 2% of their week\'s Tithe, a March\'s 1%. Standing -5 at every seat that pays.',
  'royal-tourney': 'A duel ladder all week at the castle\'s square, every blow refereed; the week\'s champion takes the prize and the title Champion of the kingdom for good.',
});
/** An Edict's line in the Seat tab, with its cost at a seat of `tier`. */
export function edictLine(edict, tier, tide = 'calm') {   // SEASON1 part two: `tide` the coming week's, a Festival's cost
  const e = EDICTS[edict];
  if (!e) return null;
  const cost = edictCost(edict, tier, tide);
  return `${e.name}: ${EDICT_WORDS[edict]}${cost ? ` Costs ${cost.toLocaleString('en-US')} silver.` : ''}`;
}
/**
 * THE HOLDER'S OWN LINES on the Seat tab, for its members (SEAT0 7.9) - `h` the standings answer's `holding`
 * (`{ standing, tithe, edict, next, upkeep, owed }`): the Edict proclaimed for next week, Unrest's cost, the upkeep the
 * Turning will ask, and Neglect's debt. (The Tithe and this week's Edict are everyone's - seatRuleLine.)
 */
/** AUDIT SEATS-2 L1 (7.5: "the Tithe's cap +1%" a Market Hall tier): a held seat's Tithe cap, its works as the seats'
 *  list dresses them (`forts.market`) - the service's titheCapAt, read on the client. */
export const seatTitheCap = (seat) => marketHallTitheCap(TITHE_CAP[seat?.tier] ?? 0, seat?.forts?.market ?? 0);
/** AUDIT SEATS-3 D3: THE TITHE A SALE POSTED AT A BOARD PAYS, as the seats' list (`seats`, the confirmed registry with
 *  each holder) says it - the board's bailiwick's holder's rate, never over its cap (the service's titheAt, read on the
 *  client); 0 where the seat is unheld or the region has none. */
export function boardTithePct(seats, region, pixel = null) {
  const seat = bailiwickOf(seats ?? [], region, pixel);
  const pct = Number(seat?.holder?.tithe ?? 0);
  return seat?.holder && pct > 0 ? Math.min(Math.trunc(pct), seatTitheCap(seat)) : 0;
}
export function seatHoldingLines(seat, h) {
  if (!h) return [];
  const out = [h.next ? `Proclaimed for next week: ${EDICTS[h.next]?.name ?? h.next}.` : 'No Edict is proclaimed for next week.'];
  if (seatInUnrest(h.standing)) out.push(`Unrest: challengers earn a quarter more influence at ${seat.name}.`);
  out.push(`Upkeep at the Turning: ${Number(h.upkeep ?? 0).toLocaleString('en-US')} silver from the treasury (the Tithe at most ${seatTitheCap(seat)}%).`);
  if (h.owed > 0) out.push(`Neglect: ${Number(h.owed).toLocaleString('en-US')} silver of upkeep is owed with it, or the Charter lapses.`);
  return out;
}
/** The Seat tab's line for everyone under the holder's (SEAT0 7.9: "Standing and its trend, the Tithe, this week's
 *  Edict"): "Tithe 6%. Market Day is proclaimed." - with Unrest where it is; null for an unheld seat. */
export function seatRuleLine(seat, holder) {
  if (!holder) return null;
  const e = holder.edict && EDICTS[holder.edict] ? `${edictWordsCap(holder.edict)} is proclaimed.` : 'No Edict rules this week.';
  return `Tithe ${holder.tithe ?? 0}%. ${e}${seatInUnrest(holder.standing) ? ` ${seat.name} is in Unrest.` : ''}`;
}
/** THE ARRIVAL'S NEWS after its line (SEAT0 7.3: "the arrival line says so"): a seat in Unrest, the Edict that rules -
 *  or null. */
export function seatArrivalNews(seat) {
  const h = seat?.holder;
  if (!h) return null;
  const parts = [];
  if (seatInUnrest(h.standing)) parts.push('The town is in Unrest.');
  if (h.edict && EDICTS[h.edict]) parts.push(`${edictWordsCap(h.edict)} is proclaimed.`);
  return parts.length ? parts.join(' ') : null;
}

/** A World of Daggerfall camp's id (src/world/wodShared.js wodSiteId: "px,py:objectID[.n]", or Privateer's Hold's
 *  "px,py:hold") - its map pixel, or null. */
export function bountySitePixel(site) {
  const m = /^(\d{1,3}),(\d{1,3}):(?:\d{1,10}(?:\.\d{1,3})?|hold)$/.exec(typeof site === 'string' ? site : '');
  if (!m) return null;
  const x = Number(m[1]), y = Number(m[2]);
  return x < 1000 && y < 500 ? [x, y] : null;
}

/** THE LEVY'S SHARE OF ONE HARVEST (SEAT0 7.6): a tenth of `qty`, its fraction kept or not by `roll` (0-1, the
 *  harvest's own) - so a harvest of 3 gives the seat one unit three times in ten, and the tenth holds on average. */
export const levyOf = (qty, roll) => {
  const whole = Math.round(Math.max(0, qty) * LEVY_SHARE * 1e6) / 1e6;   // 3 x 0.1 is 0.30000000000000004 in floats
  const n = Math.floor(whole + 1e-9);
  return n + (roll < whole - n ? 1 : 0);
};

// ═══ SEAT2a: THE BATTLES' WEEK - WINDOWS, THE SCHEDULE, THE SIDES (SEAT0 6.3-6.5) ═══
// The Turning names a Right of Siege (or a Tourney at a Contested seat) for the coming week; SEAT2a places each in the
// week and signs its two sides. The battle itself is the relay's (net/siegeRef.js, SEAT2a's next half).

/** THE HOLDER'S WINDOW (6.3, Mac: "Yes"): a day Wednesday to Saturday (0-3) and a start hour 16:00 to 02:00 UTC, two
 *  hours long - a start from 00:00 to 02:00 belongs to the night after its day ("Wednesday 01:00" is Thursday 01:00). */
export const SIEGE_WINDOW_DAYS = Object.freeze(['Wednesday', 'Thursday', 'Friday', 'Saturday']);
export const SIEGE_WINDOW_HOURS = Object.freeze([16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2]);
/** A holder that never set one gets Wednesday 20:00 UTC - a Tourney's own start too. */
export const SIEGE_WINDOW_DEFAULT = Object.freeze({ day: 0, hour: 20 });
export const siegeWindowOk = (day, hour) => Number.isSafeInteger(day) && day >= 0 && day < SIEGE_WINDOW_DAYS.length
  && Number.isSafeInteger(hour) && SIEGE_WINDOW_HOURS.includes(hour);
/** Wednesday 00:00 UTC of seat week `n`: its Turning (Sunday 18:00) and six hours to Monday, and two days. */
const WEDNESDAY_MS = 54 * H;
/** When a window opens in seat week `week`, ms - so the earliest, Wednesday 16:00, is exactly 70 hours after the Turning
 *  and the latest, Saturday 02:00 (Sunday 02:00), ends at 04:00. */
export const siegeStartMs = (week, day, hour) => seatWeekStartMs(week) + WEDNESDAY_MS + day * 24 * H + hour * H + (hour < 16 ? 24 * H : 0);
/** CROWN SIEGES (6.3, DECIDED): Saturday, Daggerfall at 20:00, Wayrest at 21:00, Sentinel at 22:00 - whatever the
 *  holder's window. */
export const CROWN_SIEGE_SLOT = Object.freeze({
  daggerfall: Object.freeze({ day: 3, hour: 20 }), wayrest: Object.freeze({ day: 3, hour: 21 }), sentinel: Object.freeze({ day: 3, hour: 22 }),
});
/** How long a battle runs (6.2, 6.7): a palace siege 30 minutes, a crown's 45, a Tourney 20. SEAT2b part two (c) (7.7:
 *  "inside the window's two hours"): a revolt its whole window (net/fortLaw.js REVOLT.windowMs). */
export const BATTLE_LENGTH_MS = Object.freeze({ palace: 30 * 60_000, crown: 45 * 60_000, tourney: 20 * 60_000, revolt: 2 * 3600 * 1000 });
export const battleLengthMs = (b) => (b.kind === 'tourney' || b.kind === 'revolt' ? BATTLE_LENGTH_MS[b.kind] : BATTLE_LENGTH_MS[b.tier] ?? BATTLE_LENGTH_MS.palace);
/** SEAT2b part two (c): a battle fought in the holder's siege window - a siege, and a revolt (6.3: "a revolt takes the
 *  holder's window"; 7.7: "at its next siege window" - DECIDED: a crown's is its Saturday slot, as its sieges' is). */
export const atSiegeWindow = (b) => b?.kind === 'siege' || b?.kind === 'revolt';
/** WHAT A BATTLE HOLDS OF ITS GUILDS' WEEK (6.3: "No guild fights twice at once") - DECIDED: a palace siege and a
 *  Tourney their two-hour window; a crown siege the hour its slot keeps from the next crown's (45 minutes and the 10 a
 *  side may arrive late), so a guild holding one crown and challenging another fights both. */
export const BATTLE_BLOCK_MS = 2 * H;
export const battleSpanMs = (b) => (b.kind === 'siege' && b.tier === 'crown' ? H : BATTLE_BLOCK_MS);
/** The battle's first start in its week: a crown siege's slot, a Tourney's Wednesday 20:00, a siege's frozen window. */
export function battlePreferredMs(week, b) {
  if (atSiegeWindow(b) && b.tier === 'crown' && CROWN_SIEGE_SLOT[b.kingdom]) { const s = CROWN_SIEGE_SLOT[b.kingdom]; return siegeStartMs(week, s.day, s.hour); }
  const w = atSiegeWindow(b) && b.window && siegeWindowOk(b.window.day, b.window.hour) ? b.window : SIEGE_WINDOW_DEFAULT;
  return siegeStartMs(week, w.day, w.hour);
}
/** Every start a battle may take in `week`, in time order: each window hour of Wednesday to Saturday. */
export function battleStarts(week) {
  const out = [];
  for (let d = 0; d < SIEGE_WINDOW_DAYS.length; d++) for (const h of SIEGE_WINDOW_HOURS) out.push(siegeStartMs(week, d, h));
  return out.sort((a, b) => a - b);
}
/**
 * THE SCHEDULE (5.2 step 8, 6.3): the week's battles placed in KEY ORDER, the crown sieges first (AUDIT-SEATS L5) -
 * each at its preferred start, or, where that would overlap another battle of either of its guilds, at the next two-hour
 * start in the Wednesday-Saturday range that clashes with nothing (`moved` says so). `battles` `{ key, kind: 'siege'|'tourney', tier, kingdom, attacker, defender,
 * window? }`. Answers `{ placed: [{ ...b, startsAt, endsAt, moved }], unplaced: [b] }` (ms) - a battle no start of the
 * week can hold is unplaced (DECIDED: void - the Chronicle says so; a guild would need some forty battles in one week).
 */
export function placeBattles(week, battles) {
  const allowed = new Set(battleStarts(week));
  const last = Math.max(...allowed);
  const placed = [], unplaced = [];
  const guildsOf = (b) => [b.attacker, b.defender].filter(Boolean);
  const clashes = (b, at) => placed.some((p) => guildsOf(p).some((g) => guildsOf(b).includes(g))
    && at < p.startsAt + battleSpanMs(p) && p.startsAt < at + battleSpanMs(b));
  // AUDIT-SEATS L5: the crown sieges first - their Saturday slots are fixed "whatever the holder's window" (6.3), and a
  // crown slot is among what the others move around - then the rest in key order
  const crownFirst = (b) => (atSiegeWindow(b) && b.tier === 'crown' && CROWN_SIEGE_SLOT[b.kingdom] ? 0 : 1);   // SEAT2b part two (c): a crown's revolt at its slot too
  for (const b of [...battles].sort((x, y) => crownFirst(x) - crownFirst(y) || x.key - y.key)) {
    const want = battlePreferredMs(week, b);
    let at = null;
    for (let t = want; t <= last; t += BATTLE_BLOCK_MS) if (allowed.has(t) && !clashes(b, t)) { at = t; break; }
    if (at == null) { unplaced.push(b); continue; }
    placed.push({ ...b, startsAt: at, endsAt: at + battleLengthMs(b), moved: at !== want });
  }
  return { placed, unplaced };
}

/** THE SIDES (6.4, DECIDED): ten against ten at a palace, twenty against twenty at a crown (6.1's measurement held them);
 *  up to two Sellswords a side at a palace, four at a crown, within the side. */
export const SIEGE_SIDE_MAX = Object.freeze({ palace: 10, crown: 20 });
export const SELLSWORDS_MAX = Object.freeze({ palace: 2, crown: 4 });
/** A side's roster is signed from the Turning until 10 minutes before the start. */
export const SIGN_CLOSES_MS = 10 * 60_000;
export const signOpen = (startsAtMs, nowMs) => nowMs < startsAtMs - SIGN_CLOSES_MS;
/** A Sellsword may not have fought for the other side's guild in the last four weeks. */
export const SELLSWORD_COOL_WEEKS = 4;
/** A Sellsword's fee, in Marks, escrowed from the hiring guild's treasury and paid at the battle's end - DECIDED: at most
 *  5,000 (a palace's upkeep twice: the fee is a contract's, not a way to move a treasury). */
export const SELLSWORD_FEE_MAX = 5000;
export const sellswordFeeOk = (n) => Number.isSafeInteger(n) && n >= 0 && n <= SELLSWORD_FEE_MAX;
/** The battle a side of `guild` fights, or null: the attacker's 'attack', the holder's 'defend' (6.4); a Tourney's two
 *  contenders 'attack' (its first) and 'defend' (its second), for the board's words only. */
export const sideOf = (battle, guild) => (battle?.attacker === guild ? 'attack' : battle?.defender === guild ? 'defend' : null);

// ─── what the Seat tab says of a battle ───
const two = (n) => String(n).padStart(2, '0');
/** A battle's start as the board says it: "Wednesday at 20:00 UTC" (a start after midnight named by its own day). */
export function battleWhenText(ms) {
  const d = new Date(ms);
  return `${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getUTCDay()]} at ${two(d.getUTCHours())}:${two(d.getUTCMinutes())} UTC`;
}
/** The window's words: "Wednesday 20:00 UTC" - a start after midnight said as the night after its day. */
export const siegeWindowText = (w) => (w && siegeWindowOk(w.day, w.hour)
  ? `${SIEGE_WINDOW_DAYS[w.day]} ${two(w.hour)}:00 UTC${w.hour < 16 ? ' (the night after)' : ''}` : null);
/** THE ANNOUNCEMENT (6.3), the Seat tab's battle line: who has won what, who holds it, when battle is joined. */
export function battleAnnouncement(b, seatName) {
  if (!b) return null;
  const when = battleWhenText(b.startsAt);
  const moved = b.moved ? ' (moved, so that no guild fights twice at once)' : '';
  if (b.kind === 'tourney') return `${GuildWords(b.attackerGuild)} and ${guildWords(b.defenderGuild)} meet in a Tourney for ${seatName}. Battle is joined ${when}${moved}.`;
  // SEAT2b part two (c) (7.7): a revolt - its holder must fell the Captain inside the window's two hours
  if (b.kind === 'revolt') return `${seatName} rises against ${guildWords(b.defenderGuild)}: a Rebel Captain and ${countWords(REVOLT.rebels)} rebels hold its palace door. The revolt begins ${when}${moved}: fell the Captain within two hours, or the Charter lapses.`;
  return `${GuildWords(b.attackerGuild)} has won the Right of Siege at ${seatName}. ${GuildWords(b.defenderGuild)} holds its Charter. Battle is joined ${when}${moved}.`;
}
/** A side's line: "Attackers: 7 of 10 signed (1 Sellsword)." */
export const sideLine = (label, n, max, swords) => `${label}: ${n} of ${max} signed${swords ? ` (${swords} Sellsword${swords === 1 ? '' : 's'})` : ''}.`;
/** Why the board will not sign a character, in its own words (the service's refusals, said by the Seat tab). */
export const SIGN_WHY = Object.freeze({
  'battle-none': 'No battle is named here this week.',
  'battle-not-side': 'Your guild fights on neither side of this battle.',
  'sign-closed': 'The rosters closed ten minutes before the battle.',
  'sign-new-member': 'Only members of seven days at the Turning may sign.',
  'sign-unbound': 'Only members whose account counted for the guild in the week that won the Right may sign.',
  'sign-bound-elsewhere': 'Your account fights for another guild this week.',
  'side-full': 'This side is full.',
  'sellswords-full': 'This side has hired all the Sellswords it may.',
  'sellsword-member': 'A Sellsword may belong to neither guild.',
  'sellsword-cooling': 'This Sellsword fought for the other side in the last four weeks.',
  'sign-twice': 'You are signed already.',
  // AUDIT-SEATS S10 (5.1: "Muster ... windows may move (6.3)"): the holder's window is the Muster's to move
  'window-reckoning': 'The window is locked from the Reckoning until the Turning, Sunday 18:00 UTC.',
});

// ─── SEAT2a (part three): THE PASS, THE FIELD, THE RESULT AND HONOURS (SEAT0 6.2, 6.5-6.8) ───
// The relay fights the battle (net/siegeRef.js); the service signs who may enter it and settles what it gave.

/** The field a client derives from the town, settled for a battle (DECIDED, part three): the first one an attacker and a
 *  defender submitted alike (two sides whose interests differ agreeing on it), else - once the battle is joined, a side
 *  absent - the one most submitted, the earliest first. `rows` `[{ side, field, at }]` (`field` its JSON), oldest
 *  first. Null while nothing settles it. SEAT2b part two (c): a revolt (`kind`) has the holder's side alone - its first
 *  defender's field settles it (DECIDED: no other side's interest to weigh it against; the rising is the relay's). */
export function settleField(rows, joined, kind = 'siege') {
  const seen = new Map();
  for (const r of rows ?? []) {
    const k = String(r.field);
    let v = seen.get(k);
    if (!v) seen.set(k, v = { field: k, attack: false, defend: false, n: 0, at: r.at });
    if (r.side === 'attack') v.attack = true; else if (r.side === 'defend') v.defend = true;
    v.n++;
    if (v.attack && v.defend) return k;
    if (kind === 'revolt' && v.defend) return k;   // SEAT2b part two (c): a revolt has one side - its first defender's
  }
  if (!joined || !seen.size) return null;
  return [...seen.values()].sort((a, b) => b.n - a.n || a.at - b.at)[0].field;
}
/** The room's window on a pass (`se`): the battle's block - two hours, a crown siege's one (battleSpanMs). */
export const passWindowEnds = (b) => b.starts_at + battleSpanMs({ kind: b.kind, tier: b.tier }) / 1000;
/** The pass's door opens as the rosters close (SIGN_CLOSES_MS before the start - net/siegeRef.js SIEGE_OPENS_MS). */
export const passOpens = (b) => b.starts_at - SIGN_CLOSES_MS / 1000;

/** WHAT A SIEGE GIVES (6.8): the holder's Standing for a held siege (only where a banner was raised) and for a forfeit,
 *  a new holder's Standing, and the next Turning's defence for the holder that held or won by forfeit (x1.2). */
export const SIEGE_STANDING = Object.freeze({ held: STANDING_CHANGES.siegeHeld, forfeit: 10 });   // AUDIT-SEATS L10: 7.3's row, written once
export const SIEGE_DEFENCE_BONUS = 1.2;
/** HONOURS (6.8): Marks and Renown XP on the winning side and the losing, and one roll on the Spoils of War. */
export const SIEGE_HONOURS = Object.freeze({ win: Object.freeze({ marks: 50, xp: 2000 }), lose: Object.freeze({ marks: 25, xp: 1000 }) });
/** THE SPOILS OF WAR (PROF0 4.7; professionLaw.js): the registered goods only war yields - the Warforged Steel Ingot,
 *  Standard-bearer's Silk and (AUDIT-SEATS, its template 678) the Siege-cracked Gem, a roll a third each. */
export const SIEGE_SPOILS = Object.freeze(['ingot:warforged', 'cloth:standard', 'gem:siege']);
/** A fighter's roll on the Spoils - its own, the same however often it is asked (FNV-1a over the battle and the account). */
export function spoilsOf(week, key, account) {
  let h = 0x811c9dc5;
  for (const ch of `${week}:${key}:${account}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return SIEGE_SPOILS[h % SIEGE_SPOILS.length];
}
/** THE ONCE-A-SEASON RULE (6.5, 6.8): the same two guilds earn Honours from battles with each other, and a forfeit by the
 *  same challenger gives Standing, once a Season - DECIDED (part three): until SEASON1 counts Seasons, once in any 8 weeks
 *  (a Season's length, 12.4). */
export const SIEGE_PAIR_WEEKS = 8;

/** Which side won (6.5-6.8): a taken seat the attackers', a held one, a forfeit and an absence the holder's; a
 *  Tourney's side with more banners - a dead heat the higher influence (`tie` with `higher` the side whose guild had
 *  more). Null where nobody won (a Tourney's tie with no higher). */
export function siegeWinner(result, higher = null) {
  if (result === 'attack') return 'attack';
  if (result === 'defend' || result === 'forfeit' || result === 'absent') return 'defend';
  if (result === 'tie') return higher === 'attack' || higher === 'defend' ? higher : null;
  return null;
}
/** What the Turning remembers of a siege (6.5, 6.8): `bonus` the holder defends at x1.2 at the next Turning, `barred` the
 *  challenger may not challenge the seat then, `standing` the holder's change, `taken` the seat changes hands. A
 *  Tourney's result is its winner's Charter alone. AUDIT-SEATS T1 (7.3: "A siege held only after the Throne was reached:
 *  -5"; Appendix B): `throne` the attackers reached the Throne (the receipt's `th`) - a held siege's +15 less 5, and only
 *  where a banner was raised, as the +15 is (a Throne reached with no banner raised is no receipt the relay signs). */
export function siegeAftermath(kind, result, raised, { forfeitPaid = false, throne = false } = {}) {
  if (kind !== 'siege') return { bonus: false, barred: false, standing: 0, taken: false };
  if (result === 'attack') return { bonus: false, barred: false, standing: 0, taken: true };
  if (result === 'defend') return { bonus: !!raised, barred: true, standing: raised ? SIEGE_STANDING.held + (throne ? STANDING_CHANGES.throneReached : 0) : 0, taken: false };
  if (result === 'forfeit') return { bonus: true, barred: true, standing: forfeitPaid ? 0 : SIEGE_STANDING.forfeit, taken: false };
  return { bonus: false, barred: false, standing: 0, taken: false };
}
/** Why the service will not let a character into a battle, or take its Honours, in its own words (a battle that is not
 *  there is SIGN_WHY's; a receipt that is not the relay's, or another account's, the gate's words). */
export const SIEGE_WHY = Object.freeze({
  'pass-early': 'The field opens ten minutes before the battle.',
  'pass-late': 'The battle\'s window has closed.',
  'field-bad': 'Your game could not work out this town\'s field.',
  'field-unsettled': 'Waiting for the other side\'s scouts to agree on the field - try again in a moment.',
  'honours-character': 'Honours go to the character who signed for this battle - play them to claim it.',   // AUDIT SEATS-3 A3
  'honours-twice': 'Your Honours from this battle are claimed already.',
  // AUDIT-SEATS S3 (17: a void siege): a receipt that reached the service after its week's Turning, which voided the battle;
  // VOID (18): or after the Moderators voided it (`/siege void`)
  'battle-void': 'That battle is void - at its Turning, or by the Moderators - and its result does not count.',   // VOID: a moderator's too
  // AUDIT 529 V5: a moderator's `/siege void` that reached the service after the battle's week was reckoned
  'battle-settled': 'That battle\'s week is settled - its Turning has reckoned it, and it can no longer be voided.',
  // AUDIT-SEATS S10 (8.1: "changing either ... is refused in a siege week")
  'heraldry-siege': 'Your guild fights a battle for a seat this week. Its heraldry may change after the Turning.',
});

// ─── CROWN1: THE CROWN TIER - REACH, THE MARCHES, THE FREE LANDS, CONSCRIPTION (SEAT0 4.3, 7.6) ───

/** KINGDOM REACH (4.3): a guild holding a crown earns a quarter more on every source but Tribute at that kingdom's palace
 *  seats; a March's claiming crowns an eighth each (a guild holding both, a quarter); the Free Lands no crown's - instead
 *  every guild's Watch there a tenth more. */
export const KINGDOM_REACH = 0.25;
export const MARCH_REACH = 0.125;
export const FREE_LAND_WATCH_BONUS = 0.1;
/** The kingdoms whose crown a guild holds, off its Charters (`[{ tier, region }]`). */
export const crownsHeld = (holds) => new Set((holds ?? []).filter((h) => h.tier === 'crown').map((h) => CROWN_SEAT_REGIONS[h.region]).filter(Boolean));
/** A guild's reach at a seat (`{ tier, region }`) holding the crowns `crowns` - a palace seat's alone (a crown seat is no
 *  kingdom's palace); a Free Land is no kingdom's and no March, so none reaches it. */
export function seatReach(seat, crowns) {
  if (seat?.tier !== 'palace' || !crowns?.size) return 0;
  if (isMarch(seat.region)) return MARCHES[seat.region].filter((k) => crowns.has(k)).length * MARCH_REACH;
  const k = kingdomOf(seat.region);
  return k && crowns.has(k) ? KINGDOM_REACH : 0;
}
/** A guild's week at a seat with its reach: every source but Tribute raised, rounded down (4.4's worked example:
 *  7,425 + 40 Tribute at a March held by one claiming crown is 8,393). */
export const withReach = (st, reach) => (reach > 0 ? { ...st, total: Math.floor(st.others * (1 + reach) + 1e-9) + st.tribute, reach } : { ...st, reach: 0 });

/** CONSCRIPTION (7.6): a crown's Edict - the kingdom's palace seats held by other guilds pay it 2% of their Tithe for
 *  the week, a March's 1% to each claiming crown that proclaims it; Standing -5 at every seat conscripted. */
export const CONSCRIPTION = Object.freeze({ kingdom: 0.02, march: 0.01, standing: STANDING_CHANGES.conscripted });
/**
 * WHAT A CROWN CONSCRIPTS - pure. `kingdom` the proclaiming crown's ('daggerfall' ...), `crownGuild` its holder, `holds`
 * every Charter (`[{ key, guild, tier, region }]`), `tithes` each guild's Tithe taken this week (Drakes). DECIDED (CROWN1):
 * the ledger names the guild a Tithe reached, not the seat it was taken at, so a guild's week of Tithe is shared over its
 * Charters - each conscripted seat pays its share of it at its rate. A Free Land is no crown's; a vassal of the crown's
 * (`vassals`, CROWN2) pays its fealty's tribute instead.
 * Answers `[{ guild, keys, amount }]`, a guild that holds nothing here never named.
 */
export function conscriptionDue({ kingdom, crownGuild, holds, tithes, vassals = new Set() }) {
  const by = new Map();
  for (const h of holds ?? []) { let l = by.get(h.guild); if (!l) by.set(h.guild, l = []); l.push(h); }
  const out = [];
  for (const [guild, seats] of by) {
    if (guild === crownGuild || vassals.has(guild)) continue;   // CROWN2 (7.6): "never a vassal's"
    const here = seats.filter((h) => h.tier === 'palace' && (isMarch(h.region) ? MARCHES[h.region].includes(kingdom) : kingdomOf(h.region) === kingdom));
    if (!here.length) continue;
    const rate = here.reduce((n, h) => n + (isMarch(h.region) ? CONSCRIPTION.march : CONSCRIPTION.kingdom), 0);
    const amount = Math.floor((Math.max(0, tithes?.get(guild) ?? 0) * rate) / seats.length + 1e-9);
    out.push({ guild, keys: here.map((h) => h.key).sort((a, b) => a - b), amount });
  }
  return out.sort((a, b) => (a.guild < b.guild ? -1 : a.guild > b.guild ? 1 : 0));
}


// ═══ CROWN1 part two: THE ROYAL TOURNEY (SEAT0 7.6) - the service's half ═══════════════════════════════════════════
// The bouts are the relay's (net/siegeRef.js royal*); the service counts each winner's receipt by the room's own rule
// and names the week's champion at the Turning.

/** The same two contenders' bouts counted a UTC day (net/siegeRef.js ROYAL_PAIR_DAY_MAX, pinned equal). */
export const ROYAL_PAIR_DAY = 3;
/** The ladder's rows the Seat tab shows. */
export const ROYAL_LADDER_ROWS = 10;
/** Why the service will not let a player into a Royal Tourney, or count its bout, in its own words. */
export const ROYAL_WHY = Object.freeze({
  'royal-none': 'No Royal Tourney is proclaimed here this week.',
  'royal-over': 'That week\'s Royal Tourney has its champion already.',
  'ring-unsettled': 'Waiting for another contender\'s scouts to agree on the ring - try again in a moment.',
});
/**
 * THE RING SETTLED - DECIDED (CROWN1 part two): a Royal Tourney has no sides, so where a siege's field waits on an
 * attacker's and a defender's agreeing (settleField), its ring waits on TWO DIFFERENT CONTENDERS' - the first point a
 * second account sent alike, its JSON. `rows` `[{ account, field, at }]` oldest first; null until two agree.
 */
export function settleRing(rows) {
  const seen = new Map();
  for (const r of rows ?? []) {
    const by = seen.get(r.field);
    if (by && by !== r.account) return r.field;
    seen.set(r.field, r.account);
  }
  return null;
}
/**
 * THE LADDER'S STANDINGS off a week's counted bouts (`[{ winner, loser, at }]`): each account's wins and losses, the most
 * wins first, then the fewest losses, then whoever reached its wins first (its last win the earlier), then the account -
 * the first is the week's champion (DECIDED: 7.6 names "the week's winner"; its ties are broken here).
 */
export function royalStandings(bouts) {
  const by = new Map();
  const row = (a) => { let r = by.get(a); if (!r) by.set(a, r = { account: a, wins: 0, losses: 0, last: 0 }); return r; };
  for (const b of bouts ?? []) {
    const w = row(b.winner);
    w.wins++; w.last = Math.max(w.last, Number(b.at) || 0);
    row(b.loser).losses++;
  }
  return [...by.values()].filter((r) => r.wins > 0 || r.losses > 0)
    .sort((x, y) => y.wins - x.wins || x.losses - y.losses || x.last - y.last || (x.account < y.account ? -1 : 1));
}
/** THE SEAT TAB'S ROYAL TOURNEY (7.6, 7.9): what is proclaimed and won, then the ladder - each row `1. Arden - 4 won, 1
 *  lost` - or that no bout is won yet. `r` the standings' `royal` (`{ prize, ladder }`), or null for none. */
export function royalTourneyLines(r) {
  if (!r) return [];
  const out = [`A Royal Tourney is proclaimed: a duel ladder all week at the castle's square, every blow refereed. The week's champion takes ${Number(r.prize ?? 0).toLocaleString('en-US')} silver and the title for good.`];
  const rows = (r.ladder ?? []).map((x, i) => `${i + 1}. ${x.name || 'Someone'} - ${x.wins} won, ${x.losses} lost`);
  return [...out, ...(rows.length ? rows : ['No bout has been won yet.'])];
}

// ═══ CROWN2: FEALTY AND PACTS (SEAT0 7.8) ═══════════════════════════════════════════════════════════════════════════
// Crown politics, kept by the account service (server-account/src/seatPolitics.js) and reckoned at the Turning.

/** FEALTY (7.8): a vassal pays its liege 5% of its week's Tithe; the liege adds half its reach at the vassal's seat to the
 *  vassal's defence; the side that breaks it loses STANDING_CHANGES.fealtyBroken at every seat it holds. */
export const FEALTY = Object.freeze({ tribute: 0.05, reachShare: 0.5, breakStanding: STANDING_CHANGES.fealtyBroken });
/**
 * WHETHER `vassal` MAY SWEAR TO `liege` - each guild's Charters (`[{ tier, region }]`): the liege holds a crown, the
 * vassal none, and the vassal a palace seat of that crown's kingdom or of a March it claims (never a Free Land's). The
 * crown's kingdom, or null. DECIDED: a crown holder is no one's vassal; a liege holding two crowns takes the first that
 * fits.
 */
export function fealtyKingdom(vassalHolds, liegeHolds) {
  if ((vassalHolds ?? []).some((h) => h.tier === 'crown')) return null;
  for (const k of crownsHeld(liegeHolds)) {
    if ((vassalHolds ?? []).some((h) => (isMarch(h.region) ? MARCHES[h.region].includes(k) : kingdomOf(h.region) === k))) return k;   // a palace: a crown holder returned above
  }
  return null;
}
/**
 * THE TURNING'S FEALTIES (7.8) - each standing pair (`{ vassal, liege, state, broken_by }`, 'sworn' or 'breaking') over
 * the Charters as they stand (`[{ guild, tier, region }]`): each pair as the Turning settles it - `{ vassal, liege,
 * broken, fits }` (`broken` its breaker, or null; a pair that no longer fits lapses); the breakers (their Standing row);
 * and `liegeReach(guild, seat)`, a vassal's liege's reach at a seat it holds (seatReach) - 0 for a guild with no liege,
 * a fealty breaking or one that no longer fits.
 */
export function fealtyReckoning(rows, charters) {
  const chartersOf = (g) => (charters ?? []).filter((h) => h.guild === g);
  const fealties = (rows ?? []).map((f) => ({ vassal: f.vassal, liege: f.liege, broken: f.state === 'breaking' ? f.broken_by : null, fits: !!fealtyKingdom(chartersOf(f.vassal), chartersOf(f.liege)) }));
  const liegeOf = new Map(fealties.filter((f) => f.fits && !f.broken).map((f) => [f.vassal, f.liege]));
  return {
    fealties,
    breakers: new Set(fealties.filter((f) => f.broken).map((f) => f.broken)),
    liegeReach: (guild, seat) => (liegeOf.has(guild) ? seatReach(seat, crownsHeld(chartersOf(liegeOf.get(guild)))) : 0),
  };
}
/** A vassal's tribute off its week's Tithe, rounded down. */
export const fealtyTribute = (tithe) => Math.floor(Math.max(0, Number(tithe) || 0) * FEALTY.tribute + 1e-9);
/** THE SEASON a Pact runs to (7.8: "for the rest of a Season") - the first week of the next Season (seasonOf), so a Pact
 *  signed in week `w` stands through the week before pactUntil(w, zero). DECIDED: with no Season counted (`zero` null, or
 *  before Season 0), a Season is each SEASON_WEEKS-week block of seat weeks from week 0. */
export const SEASON_WEEKS = 8;
export const pactUntil = (week, zero = null) => seasonOf(week, zero)?.end ?? (Math.floor(Math.max(0, week) / SEASON_WEEKS) + 1) * SEASON_WEEKS;   // SEASON1: the Season's own end, once one is counted
/** Whether guild `g` may pledge at a seat `holder` holds, its liege, vassals and Pact partners known - a reason, or null. */
export function pledgeBarred(g, holder, { liege = null, vassals = [], pacts = [] } = {}) {
  if (!holder || holder === g) return null;
  if (holder === liege || vassals.includes(holder)) return 'fealty-pledge';
  if (pacts.includes(holder)) return 'pact-pledge';
  return null;
}
/** The red line the whole server reads when a Pact is broken early (7.8). */
export const pactBrokenText = (breaker, other) => `${GuildWords(breaker)} has broken its Pact of non-aggression with ${guildWords(other)}.`;
/** How long the seats' list carries a red announcement, seconds. */
export const SEAT_RED_S = 24 * 3600;
/** Why the service will not swear, accept, break or pledge, in its own words. */
export const FEALTY_WHY = Object.freeze({
  'fealty-unfit': 'Fealty is sworn by a guild holding a palace of a crown\'s kingdom (or a March it claims) to that crown\'s holder.',
  'fealty-none': 'There is no such offer of fealty.',
  'fealty-sworn': 'Your guild is sworn already.',
  'fealty-pledged': 'One of you is pledged against the other\'s seat this week.',
  'fealty-pledge': 'Your guild may not pledge against its liege\'s or its vassal\'s seat.',
  'pact-none': 'There is no such Pact.',
  'pact-signed': 'A Pact stands between your guilds already.',
  'pact-self': 'A guild makes no Pact with itself.',
  'pact-pledged': 'One of you is pledged against the other\'s seat this week.',
  'pact-pledge': 'Your guild may not pledge against a seat its Pact partner holds.',
  'guild-unknown': 'There is no guild by that tag.',
});
/** THE POLITICS' LEVERS' WORDS on the Seat tab, by act. */
export const POLITICS_ACTS = Object.freeze({
  'fealty-accept': 'Accept', 'fealty-withdraw': 'Withdraw', 'fealty-break': 'Break fealty',
  'pact-accept': 'Sign', 'pact-withdraw': 'Withdraw', 'pact-break': 'Break the Pact',
  'fealty-decline': 'Decline', 'pact-decline': 'Decline',   // AUDIT-SEATS: an offer made to the guild, turned down
});
/**
 * A GUILD'S CROWN POLITICS AS THE SEAT TAB SAYS THEM (7.8) - the service's `politics` (seatPolitics.js politicsOf): one
 * row a fealty or Pact, `{ text, act, tag }` - `act` the lever an Officer may pull on it (POLITICS_ACTS) and `tag` the
 * other guild's, or `act` null; an offer made to the guild has a second lever, `alt` (its Decline). A fealty breaking ends at the Turning; a Pact signed runs to its week.
 */
export function politicsRows(p) {
  const rows = [];
  for (const f of p?.fealty ?? []) {
    const other = f.asVassal ? f.liege : f.vassal;
    if (f.state === 'sworn') {
      rows.push({ text: f.asVassal ? `Your guild is sworn to ${guildWords(f.liege)}.` : `${GuildWords(f.vassal)} is sworn to your guild.`, act: 'fealty-break', tag: other.tag });
    } else if (f.state === 'breaking') {
      rows.push({ text: `The fealty between ${guildWords(f.vassal)} and ${guildWords(f.liege)} ends at the Turning.`, act: null, tag: other.tag });
    } else if (f.mine) {
      rows.push({ text: f.asVassal ? `Your guild offers to swear fealty to ${guildWords(f.liege)}.` : `Your guild offers to take ${guildWords(f.vassal)} as its vassal.`, act: 'fealty-withdraw', tag: other.tag });
    } else {
      rows.push({ text: f.asVassal ? `${GuildWords(f.liege)} offers to take your guild as its vassal.` : `${GuildWords(f.vassal)} offers to swear fealty to your guild.`, act: 'fealty-accept', alt: 'fealty-decline', tag: other.tag });
    }
  }
  for (const c of p?.pacts ?? []) {
    if (c.state === 'signed') rows.push({ text: `A Pact of non-aggression with ${guildWords(c.with)}, until week ${c.until}. Breaking it early is announced to everyone.`, act: 'pact-break', tag: c.with.tag });
    else if (c.mine) rows.push({ text: `Your guild offers ${guildWords(c.with)} a Pact of non-aggression.`, act: 'pact-withdraw', tag: c.with.tag });
    else rows.push({ text: `${GuildWords(c.with)} offers your guild a Pact of non-aggression, until week ${c.until}.`, act: 'pact-accept', alt: 'pact-decline', tag: c.with.tag });
  }
  return rows;
}

// ═══ SEASON1: THE SEASONS (SEAT0 9.1, 18) ═══════════════════════════════════════════════════════════════════════════
// A Season is SEASON_WEEKS seat weeks; Season 0, the open beta, SEASON_ZERO_WEEKS, from the week the service's
// SEASON_ZERO_WEEK names - until it names one, no Season is counted (every Season-bound rule keeps its 8-week stand-in).

/** Season 0's length, weeks (18: "The first Season is a four-week open beta"). */
export const SEASON_ZERO_WEEKS = 4;
/** The months the Seasons are named for, in order (9.1). */
export const SEASON_MONTHS = Object.freeze(['Morning Star', 'Sun\'s Dawn', 'First Seed', 'Rain\'s Hand', 'Second Seed', 'Midyear', 'Sun\'s Height', 'Last Seed', 'Hearthfire', 'Frostfall', 'Sun\'s Dusk', 'Evening Star']);
/** The seat week Season 0 begins, off the service's `SEASON_ZERO_WEEK` (a whole week number) - or null: none counted. */
export const seasonZeroOf = (v) => (/^\d{1,7}$/.test(String(v ?? '').trim()) ? Number(String(v).trim()) : null);
/** THE SEASON seat week `week` falls in, Season 0 beginning at `zero` - `{ n, start, end }` (`end` the next Season's first
 *  week) - or null before Season 0, or with none counted. */
export function seasonOf(week, zero) {
  if (zero == null || !Number.isSafeInteger(week) || week < zero) return null;
  if (week < zero + SEASON_ZERO_WEEKS) return { n: 0, start: zero, end: zero + SEASON_ZERO_WEEKS };
  const n = 1 + Math.floor((week - zero - SEASON_ZERO_WEEKS) / SEASON_WEEKS);
  const start = zero + SEASON_ZERO_WEEKS + (n - 1) * SEASON_WEEKS;
  return { n, start, end: start + SEASON_WEEKS };
}
/** @type {Array<[number, string]>} */
const ROMAN = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
const roman = (k) => { let out = ''; for (const [v, s] of ROMAN) while (k >= v) { out += s; k -= v; } return out; };
/** A SEASON'S NAME (9.1): "Season 0" for the beta; then "the Season of Morning Star" ... "the Season of Evening Star", the
 *  names repeating with a numeral ("the Season of Morning Star II"). Null for no Season. */
export function seatSeasonName(n) {
  if (!Number.isSafeInteger(n) || n < 0) return null;
  if (n === 0) return 'Season 0';
  const round = Math.floor((n - 1) / SEASON_MONTHS.length) + 1;
  return `the Season of ${SEASON_MONTHS[(n - 1) % SEASON_MONTHS.length]}${round > 1 ? ` ${roman(round)}` : ''}`;
}
/** The Season `week` closes - its last week's Turning ends it - or null. */
export const seasonEndingAt = (week, zero) => { const s = seasonOf(week, zero); return s && s.end === week + 1 ? s : null; };
/** THE FIRST WEEK OF "THIS SEASON" for the once-a-Season rules (6.5, 6.8: Honours, a forfeit's Standing) - the Season's own
 *  first week, or, with none counted, the last SIEGE_PAIR_WEEKS weeks' first (their stand-in). */
export const seasonFloor = (week, zero) => seasonOf(week, zero)?.start ?? week - SIEGE_PAIR_WEEKS + 1;
/** THE SOFT RESET'S STANDING (9.1: "Standing moves halfway back toward 50") - rounded toward 50. */
export const seasonStanding = (standing) => STANDING_START + Math.trunc((Number(standing) - STANDING_START) / 2);
/**
 * THE SEASON'S TITLES (9.1) - at the Turning that ends Season `season` (`{ n, start }`), over the Charters standing
 * through its last week (`[{ key, guild, tier, since }]`, `since` the first week held): every crown's guild "Crowned in
 * Season N", every guild that held a seat the whole Season "Keeper of <Town>, Season N" - `[{ guild, title, key }]`, each
 * its guildmaster's. DECIDED: Season 0, the beta, crowns no one.
 */
export function seasonTitles(season, holds) {
  if (!season || season.n < 1) return [];
  const out = [];
  for (const h of [...(holds ?? [])].sort((a, b) => a.key - b.key)) {
    if (h.tier === 'crown') out.push({ guild: h.guild, title: 'crowned', key: h.key });
    if (keptWholeSeason(season, h.since)) out.push({ guild: h.guild, title: 'keeper', key: h.key });
  }
  return out;
}
/** WHETHER A CHARTER HELD `season` WHOLE (9.1's Keeper) - its `since` (the first week held) at the Season's first week.
 *  AUDIT-SEATS L1, DECIDED: Season 1's first week is no one's - Season 0's last Turning claims nothing (18: the seats are
 *  wiped), so its first Charters stand from the week after; a Charter from Season 1's first Turning held it whole. */
export const keptWholeSeason = (season, since) => !!season && Number(since) <= season.start + (season.n === 1 ? 1 : 0);
/** SEASON1 (9.1): THE BANNER RIBBON'S GUILDS at a Season's end - every guild a keeper's title names (it held a seat the
 *  whole Season), once each, in the titles' order. Its members at that Turning wear the ribbon through the next Season. */
export const seasonRibbons = (titles) => [...new Set((titles ?? []).filter((t) => t.title === 'keeper').map((t) => t.guild))];
/** The Season whose ribbons are worn in `season` (seasonOf's): the one before it - null with none counted or in Season 0. */
export const ribbonSeasonOf = (season) => (season && season.n >= 1 ? season.n - 1 : null);
/** The Seat tab's Season line off the standings' `season` (seasonOf's): "Week 3 of 8 of the Season of Morning Star." -
 *  or null for none counted. */
export const seasonLine = (week, s) => (s ? `Week ${week - s.start + 1} of ${s.end - s.start} of ${seatSeasonName(s.n)}.` : null);
