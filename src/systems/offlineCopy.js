// AUDIT LIVED1 E (S3/R5, and S5/U4's card): COPY TO OFFLINE CHANGES LANES, AND THE OFFLINE LANE HAS ONE CLOCK.
//
// An online save holds stamps on two clocks (LIVED1, bible/06-Systems/Lived-Time.md). The CHARACTER's - every
// personal marker: a room, a loan, a disease's day, a curse, the needs - sit on their own clock, which is the
// envelope's `classicMinutes`. The WORLD's - a quest clock's last sample, a CreateFoe's last wave, a PlaySound's last
// play, a guard's anchor, a quest's start and tombstone, the rumours' time limits, the spawned dungeons' ledger, a
// campfire's hours - sit on the shared clock, whose minute at the save rides beside it as `worldMinutes`. [AUDIT
// LIVED1b R3, D2, R1: and a journal step's date, a cached building's stock days and the raids' schedule - the first
// two rebased with the rest, the third the shared day's alone and dropped on the way out.]
//
// Offline there is ONE clock, and the load sets it from `classicMinutes`. The character's markers are in tune with it
// by construction; the world's are not - online the two clocks stand days or months apart (a real day away is twelve
// of the world's), and offline a quest clock charges its raw gap: a character four days ahead failed every timed
// quest on the first frame, one half a year behind gave every running clock half a year more, and a fire lit for
// eight hours burned for months. So the copy rebases the world's stamps onto the character's clock ONCE, by the
// distance between the two at the save - a quest's three days stay three days, a fire keeps its hours - and the
// envelope then says nothing of a world it no longer belongs to (`worldMinutes` goes, so every card reads the one
// clock the copy will play on). A snap with no `worldMinutes` (an offline save, or one from before LIVED1, whose two
// clocks were one) is returned as a plain copy.
//
// TIME3 (bible/06-Systems/Online-Time-Arc.md 6.3): a quest's COUNTDOWNS left the world's clock for the character's -
// a Clock's sample, a sound's and a wave's last, a guard's arrival, a tombstone (quest/questStamps.js) - so a quest
// envelope taken since then carries `ownSecondsAt` and its countdowns cross a door unmoved: the character's clock is
// the one clock offline. The journal's dates stay the world's and move as before; an envelope taken before TIME3 moves
// whole, as LIVED1 moved it. Each door marks what it hands on as standing on the character's clock.
//
// Pure JSON in, JSON out - no module state read.

import { QUEST_OWN_SECOND_KEYS, QUEST_WORLD_SECOND_KEYS, shiftQuestStamps, markOwnClock } from './quest/questStamps.js';
import { LEGACY_VENDOR } from './legacy/family.js';

/** AUDIT LIVED1b F3 (S4): a save's clock - classic minutes, an unsigned count below 2^31 (4,000 years of the calendar;
 *  DFU's is a uint) - or null for anything else. The doors and the load (save.js restorePlayer) read the envelope's
 *  clocks through it: a tampered 1e14 stood the character's clock still in play (a frame's minutes under half an ulp),
 *  2^53 froze the page in the calendar loop, a string or a null loaded an online character at minute 0. */
export const SAVE_CLOCK_MAX = 2 ** 31;
export const saneSaveClock = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < SAVE_CLOCK_MAX ? v : null);

// The quest system's stamps by clock, in SECONDS - the character's (TIME3: the countdowns) and the world's (the
// journal's dates; AUDIT LIVED1b R3 (O2): each logged step's `time` with them, DFU's LogEntry.dateTime, which %qdt reads)
// - and the walk that moves them (quest/questStamps.js). Zero is each one's "never" and stays zero.
export { QUEST_OWN_SECOND_KEYS, QUEST_WORLD_SECOND_KEYS };

/** AUDIT LIVED1b D2 (R2, O4, S3): a cached building's stock days are the WORLD's online (worldModes stockedToday reads
 *  the world's calendar) - DFU's `year * 1000 + dayOfYear` (shopStock createStockedDate), 360 days a year. Moved by
 *  whole days: a shelf stocked today was dated months ahead of a copy's calendar and never restocked (needsRestock is
 *  `stockedDate < today`) until the character's calendar passed it. 0 ("never stocked") and an owned house's 1 stay. */
const STOCK_DAYS_PER_YEAR = 360;
const stockDayIndex = (d) => Math.floor(d / 1000) * STOCK_DAYS_PER_YEAR + (d % 1000) - 1;
const stockDateOf = (i) => Math.floor(i / STOCK_DAYS_PER_YEAR) * 1000 + (i % STOCK_DAYS_PER_YEAR) + 1;
const shiftStockDate = (d, days) => (Number.isFinite(d) && d > 1 ? stockDateOf(stockDayIndex(Math.floor(d)) + days) : d);

/** Every WORLD-clock stamp in the envelope moved by `delta` classic minutes (in place); `days` is the distance between
 *  the two clocks' calendar days, for the stamps that are days. `questOwn` says which quest countdowns stood on the
 *  world's clock: 'legacy' (a copy leaving the world - those of envelopes taken before TIME3) or none (a copy joining
 *  it - offline every countdown is on the one clock, which is the character's). */
function rebaseWorldStamps(copy, delta, days, { questOwn = false } = {}) {
  if (!delta) return copy;
  if (copy.quest) shiftQuestStamps(copy.quest, delta * 60, { own: questOwn, world: true });
  for (const r of copy.talk?.listRumorMill ?? []) if (r && Number.isFinite(r.timeLimit) && r.timeLimit > 0) r.timeLimit += delta;   // a quest rumour's 0 is "no limit"
  if (Array.isArray(copy.spawns)) {
    copy.spawns = copy.spawns.map((row) => (Array.isArray(row) ? row.map((v, i) => (i > 0 && Number.isFinite(v) ? v + delta : v)) : row));   // [key, seen, cleared?]
  }
  for (const c of copy.world?.camps ?? []) {
    if (c && Number.isFinite(c.litUntil)) c.litUntil += delta;
    if (c && Number.isFinite(c.placedAt)) c.placedAt += delta;
  }
  // AUDIT REST III D1: A HELD BOUNTY'S DAY is the world's online (bountyHost.js reads the shared clock) and the
  // character's offline, so it moves with the lane as a camp's fire does - Bring online lapsed every bounty a ledger of
  // this build held on its first online tick, kills and all (AUDIT REST II Q3's re-stamp is the older ledgers' alone,
  // and the world runs months ahead of a new offline calendar); and the minute each was paid, which a mate's clear is
  // read against (bountyClearPays). Never below the calendar's start.
  const ledger = copy.modData?.[BOUNTY_RECORD_VENDOR];
  for (const h of Array.isArray(ledger?.held) ? ledger.held : []) if (h && Number.isFinite(h.takenAt)) h.takenAt = Math.max(0, h.takenAt + delta);
  const paidAt = ledger?.paidAt && typeof ledger.paidAt === 'object' ? ledger.paidAt : {};
  for (const k of Object.keys(paidAt)) if (Number.isSafeInteger(paidAt[k])) paidAt[k] = Math.max(0, paidAt[k] + delta);
  if (days) {
    for (const scene of copy.sceneCache?.scenes ?? []) {
      for (const c of scene?.lootContainers ?? []) {
        if (!c || typeof c !== 'object') continue;
        c.stockedDate = shiftStockDate(c.stockedDate, days);
        c.openedOn = shiftStockDate(c.openedOn, days);   // UXB1-O: the searched lid is the stock's own day, and moves with it
      }
    }
  }
  return copy;
}
const daysBetween = (to, from) => Math.floor(Math.floor(to) / 1440) - Math.floor(Math.floor(from) / 1440);

/** AUDIT LIVED1b R1 (A2, O3, S3): World Events - Raiding Parties' record (raidingParties.js RAIDING_PARTIES_VENDOR) is the
 *  SHARED day's roll online - its `lastSelectedDay` and every raid's day and minutes on the world's clock - and the mod
 *  rolls only on a LATER day offline: a copy a hundred and fifty days behind the world met no raid until its calendar
 *  caught the world's. The world's schedule has no meaning on another clock, so the copy takes the mod's NewSaveData
 *  (the load hands a mod with no record its new one - modSaveData.js restoreModSaveRecords) and rolls its own. */
export const RAID_RECORD_VENDOR = 'world-events-raiding-parties';

/** AUDIT LEGACY II H1: A COPY BETWEEN THE LANES IS A NEW CHARACTER, AND A NEW CHARACTER IS OF NO HOUSE YET. Project
 *  Legacy's record (`modData.ProjectLegacy`) names the people of a line by their character ids; carried across, the
 *  copy (a new id) played as the ORIGINAL's person - its tolls aged them, its death or retirement wrote them dead in
 *  the store both lanes share in one browser, and the remains' purses came into the realm uncounted by customs. The
 *  copy founds its own house on its first load (legacyHost.js found). Both doors drop it, whatever the clocks say. */
function dropLineage(copy) {
  if (copy.modData && typeof copy.modData === 'object') delete copy.modData[LEGACY_VENDOR];
}
/** AUDIT REST III D1: the bounty board's record (bountyBoard.js BOUNTY_VENDOR - pinned equal, test/auditrest3.test.js;
 *  this module stays off the board's graph, as it does off the raid mod's). */
export const BOUNTY_RECORD_VENDOR = 'bountyBoard';

/** The copy an offline slot keeps: the world's stamps rebased onto the character's clock, `worldMinutes` dropped. */
export function offlineCopyOf(snap) {
  const copy = JSON.parse(JSON.stringify(snap ?? null));
  if (!copy || typeof copy !== 'object') return copy;
  dropLineage(copy);
  const own = saneSaveClock(copy.classicMinutes), world = saneSaveClock(copy.worldMinutes);
  delete copy.worldMinutes;
  delete copy.joinFresh;
  delete copy.realmHeld;   // AUDIT RESCUE-SAVE A1: the realm's spoils records (systems/realmSaves.js REALM_HELD_FIELD) - a new character holds none
  if (own === null || world === null) return copy;
  if (copy.modData && typeof copy.modData === 'object') delete copy.modData[RAID_RECORD_VENDOR];   // AUDIT LIVED1b R1
  rebaseWorldStamps(copy, Math.floor(own) - Math.floor(world), daysBetween(own, world), { questOwn: 'legacy' });   // classic minutes: the character's clock less the world's
  if (copy.quest) markOwnClock(copy.quest, Math.floor(own) * 60);   // TIME3: every countdown is on the character's clock now
  return copy;
}

/** AUDIT LIVED1 G (R6, and the mirror of E): BRING ONLINE is the other door between the lanes. An offline envelope's
 *  world stamps sit on its one clock, which becomes the CHARACTER's; online they are read against the WORLD's, so they
 *  move by the distance to the world's minute now (`worldNow`, the shared clock's reading at customs). And the envelope
 *  says it left the world at that minute - it has never been away, so the first join's absence arm (TM-1's recovery,
 *  SURV7's fresh start) walks no span the character never lived, where a missing `worldMinutes` read the whole
 *  distance from the offline calendar to the world's as time away. */
export function onlineCopyOf(snap, worldNow) {
  const copy = JSON.parse(JSON.stringify(snap ?? null));
  if (!copy || typeof copy !== 'object') return copy;
  dropLineage(copy);
  if (!Number.isFinite(worldNow)) return copy;
  const own = saneSaveClock(copy.classicMinutes);
  copy.worldMinutes = Math.floor(worldNow);
  // AUDIT LIVED1b P2: ...and that is the minute THIS machine's clock said at the click - the menu has no relay to
  // correct it by - so an OS clock set a year back at the menu bought a year of TM-1's recovery at the first join (a
  // legal reputation of -80 came in at -41). The envelope says it joins fresh: its first load pays no absence at all
  // (save.js), whatever the stamp, and the next save the realm keeps is composed without the flag.
  copy.joinFresh = true;
  if (own === null) return copy;
  rebaseWorldStamps(copy, Math.floor(worldNow) - Math.floor(own), daysBetween(worldNow, own));   // TIME3: the countdowns stay - the one clock is the character's
  if (copy.quest) markOwnClock(copy.quest, Math.floor(own) * 60);
  return copy;
}
