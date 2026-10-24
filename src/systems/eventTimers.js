// @ts-check
// TIMERS1 (2026-10-02, Mac: "we need to create a new unique UI element for reset times like the Sunday wars, oblivion
// gates, town raids, and anything else so the player can keep track of when things are and watch countdowns").
//
// THE SCHEDULE, AS ROWS. Every shared moment of the online world is already a pure function of the relay's clock in
// its own law - the gate's day (net/gate/gateLaw.js), the seat week's Reckoning and Turning (net/townSeatLaw.js), a game
// day's turnover and the UTC day's - or a fact the client already holds (the week's battles in the seats list, the
// day's raids the mod rolled). This module derives nothing of its own: it asks those laws and lays their answers out
// as one list a window can draw, each row either LIVE (running now, counting down to its end) or COMING (counting down
// to its start). It reads no globals; the host hands in the relay's now and what it holds.
//
// A row: { id, kind, title, where, detail, live, at, until }
//   shut   AUDIT EVENTS1 A6: a live row of an event no one can join any more (the gate sealed, a Hollow collapsing) - the
//          window lists it, the event board leaves it out
//   at     the moment the countdown runs to (ms, relay clock): the start of a coming row, the end of a live one
//   until  a live row's end; null on a coming row
//   door   EG-ZM: on an Elite row where the host hands the boards' door (`doors.board`) - 'board', the window's button
//
// TIMERS2 (2026-10-22, the owner: "organize the timer system in the pause menu"): THE ROWS IN GROUPS. One list sorted by
// time put a gate beside a raid beside the UTC day, sixteen rows deep on a busy evening; the window now lays them out by
// what they are (TIMER_GROUPS: the world's events, the Battlespire, the raids, the seats and their battles, the resets),
// each group in the list's own order, and a player can show one group alone (ui/enhanced/enhancedTimers.js).
import { gateAt, gateTimes, gatePhase, GATE_EVERY_DAYS, gameDayAt, GATE_DAY_MINUTES } from '../net/gate/gateLaw.js';
import { wallMsForClassicMinutes } from '../net/wire.js';
import { seatWeekOf, seatWeekStartMs, seatPhaseOf, SEAT_RECKONING_MS, seasonOf, seatSeasonName, battleLengthMs, SIGN_CLOSES_MS, guildWords } from '../net/townSeatLaw.js';
import { serpentAt, serpentTimes, serpentPhase, serpentBossOf, SERPENT_EVERY_DAYS } from '../net/serpent/serpentLaw.js';   // SERPENT-TIMERS: the sea serpent's day
import { sdPhase, SD_COLLAPSE_MS } from '../net/superDungeon/sdLaw.js';   // SD2c: the Super dungeon's record, once it is news
import { egTimes } from '../net/eliteGates/egLaw.js';   // EG-F: an Elite Breach's clock - the company's own row
import { arenaSeasonOf, arenaSeasonEndsS } from '../net/arena/arenaLaw.js';   // EG-ZM: the Spire's boards keep the arena's season

const DAY_MS = 86_400_000;

/** TIMERS2: the window's groups, in the order it draws them - each row's kind belongs to one. */
export const TIMER_GROUPS = Object.freeze([
  Object.freeze({ id: 'world', kinds: Object.freeze(['gate', 'serpent', 'super', 'star']) }),
  Object.freeze({ id: 'spire', kinds: Object.freeze(['elite']) }),
  Object.freeze({ id: 'raids', kinds: Object.freeze(['raid']) }),
  Object.freeze({ id: 'seats', kinds: Object.freeze(['seat', 'battle']) }),
  Object.freeze({ id: 'resets', kinds: Object.freeze(['reset']) }),
]);
/** TIMERS2: a row's kind -> its group's id (a kind no group names stands with the resets, at the end). */
export const timerGroupOf = (kind) => TIMER_GROUPS.find((g) => g.kinds.includes(kind))?.id ?? 'resets';
/**
 * TIMERS2: the rows laid out by group - `[{ id, rows, live }]` in TIMER_GROUPS's order, each group's rows in the list's
 * own order (live first, soonest end first, then soonest start), `live` how many are under way; a group with no row left out.
 * @template {{ kind: string, live: boolean }} R
 * @param {ReadonlyArray<R>|null|undefined} rows
 * @returns {Array<{ id: string, rows: R[], live: number }>}
 */
export function timerGroups(rows) {
  return TIMER_GROUPS.map((g) => {
    const of = (rows ?? []).filter((r) => timerGroupOf(r.kind) === g.id);
    return { id: g.id, rows: of, live: of.filter((r) => r.live).length };
  }).filter((g) => g.rows.length);
}

/** The battle kinds in the words a seat's own tab uses for them. */
const BATTLE_TITLE = Object.freeze({ siege: (n) => `Siege of ${n}`, tourney: (n) => `Tourney at ${n}`, revolt: (n) => `Revolt at ${n}` });

const capital = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * @param {{ now: number,
 *           gate?: { place?: string|null, fellAt?: (day: number) => (number|null) } | null,
 *           serpent?: { place?: string|null, fellAt?: (day: number) => (number|null) } | null,
 *           sd?: { rec: any, name?: string|null, place?: string|null, site?: { cityName?: string, px?: number, py?: number } | null } | null,
 *           stars?: Array<{ id: string, kind: string, title: string, where: string|null, detail: string|null, live: boolean, at: number, until: number|null }> | null,
 *           elite?: { op: number, rh?: number, h?: number, until?: number|null, end?: string|null } | null,
 *           doors?: { board?: () => any } | null,
 *           seatsOpen?: boolean, seats?: Array<any> | null, zero?: number | null, region?: string | null,
 *           raids?: Array<{ name: string, region?: string, type?: string, startMs: number, endMs: number, done?: boolean }> | null }} src
 */
export function eventTimerRows(src) {
  const now = Number(src?.now);
  if (!Number.isFinite(now)) return [];
  /** @type {Array<{id: string, kind: string, title: string, where: string|null, detail: string|null, live: boolean, at: number, until: number|null, door?: string, shut?: boolean}>} */
  const rows = [];
  const coming = (id, kind, title, at, where = null, detail = null) => rows.push({ id, kind, title, where, detail, live: false, at, until: null });
  const live = (id, kind, title, until, where = null, detail = null) => rows.push({ id, kind, title, where, detail, live: true, at: until, until });

  // ── THE OBLIVION GATE (gateLaw: a gate every game day - omen, rise, open, seal, wrath) ──
  const t = gateAt(now);
  const fell = src?.gate?.fellAt?.(t.day) ?? null;
  const phase = gatePhase(t, now, fell);
  const place = src?.gate?.place ? `Near ${src.gate.place}` : null;
  // (gateLaw's words: 'sealed' is the risen gate not yet open, 'closed' the gate shut for the night)
  if (phase === 'quiet') coming(`gate:${t.day}`, 'gate', 'Dagon\'s Breach opens', t.openAt, null, 'Its omen burns in the sky 15 minutes before');
  else if (phase === 'omen' || phase === 'rising' || phase === 'sealed') coming(`gate:${t.day}`, 'gate', 'Dagon\'s Breach opens', t.openAt, place, 'The omen is in the sky');
  else if (phase === 'open') live(`gate:${t.day}`, 'gate', 'Dagon\'s Breach open', t.sealAt, place, 'Seals when this runs out. Get inside');
  else if (phase === 'closed') { live(`gate:${t.day}`, 'gate', 'Dagon\'s Breach sealed', t.wrathAt, place, 'Collapses when this runs out'); rows[rows.length - 1].shut = true; }   // AUDIT EVENTS1 A6: no one gets in - the event board leaves it out
  // ...and the gate after it, once this one is under way
  if (phase !== 'quiet') coming(`gate:${t.day + GATE_EVERY_DAYS}`, 'gate', 'Next Dagon\'s Breach opens', gateTimes(t.day + GATE_EVERY_DAYS).openAt);

  // ── THE SEA SERPENT (serpentLaw: every other game day at the dawn watch - every four real hours: the bells, the
  // rising, its dive) ── SERPENT-TIMERS (2026-10-04, the owner: "This needs to happen" -
  // the serpent was the one shared event the window did not count). Where it lies is said from its bells on, as the
  // chat says it; the next serpent's rising stands beside it once this one is under way.
  const s = serpentAt(now);
  const sPhase = serpentPhase(s, now, src?.serpent?.fellAt?.(s.day) ?? null);
  const sName = serpentBossOf(s.day).name;
  const off = src?.serpent?.place ? `Off ${src.serpent.place}` : null;
  if (sPhase === 'quiet') coming(`serpent:${s.day}`, 'serpent', `${sName} rises`, s.riseAt, null, 'The harbor bells ring 15 minutes before');
  else if (sPhase === 'omen') coming(`serpent:${s.day}`, 'serpent', `${sName} rises`, s.riseAt, off, 'The harbor bells are ringing. Its waters are circled on your map');
  // SERPENT4 (2026-10-11): its waters stand open until it dives - one row from its rising to its dive, the storm's breaking
  // no instant a ship sails against
  else if (sPhase === 'rising' || sPhase === 'hunt' || sPhase === 'late') live(`serpent:${s.day}`, 'serpent', `${sName} hunts`, s.soundAt, off, 'It dives when this runs out. Sail out to join the hunt');
  if (sPhase !== 'quiet') {
    const nextDay = s.day + SERPENT_EVERY_DAYS;
    coming(`serpent:${nextDay}`, 'serpent', 'Next sea serpent rises', serpentTimes(nextDay).riseAt);
  }

  // ── THE SUPER DUNGEON (net/superDungeon/sdLaw.js: the hub's one record) ── SD2c (bible/11-Multiplayer/Super-Dungeons.md section
  // 4): a row once it is FOUND - news, by the finder's word - and none before (a Hollow that has only risen is a find:
  // its omen in the sky and a word in its city's taverns, never a countdown that says one stands); its fading unbeaten
  // while it stands, its collapse after the kill. Where it stands is the host's (`place`, its city), and its name.
  const sdRec = src?.sd?.rec ?? null;
  const sdNow = sdPhase(sdRec, now);
  const sdName = src?.sd?.name || 'The Abyss Dungeon';
  const sdPlace = src?.sd?.place ?? src?.sd?.site?.cityName ?? null;   // AUDIT EVENTS1 A2: the host hands the site itself (its city and its pixel)
  const sdWhere = sdPlace ? `Near ${sdPlace}` : null;
  if (sdNow === 'found') live(`sd:${sdRec.s}`, 'super', `${sdName} stands`, sdRec.until, sdWhere, 'Found. It fades away unbeaten when this runs out');
  else if (sdNow === 'fell') { live(`sd:${sdRec.s}`, 'super', `${sdName} collapses`, sdRec.fellAt + SD_COLLAPSE_MS, sdWhere, 'Its Hour is broken. It collapses when this runs out'); rows[rows.length - 1].shut = true; }   // AUDIT EVENTS1 A6
  // SD19: the next one's rise, once this one is gone - never where (a Hollow risen is a find), only not before when
  else if (sdNow === 'gone' && Number.isFinite(sdRec?.next) && sdRec.next > now) coming(`sd:${(sdRec.s ?? 0) + 1}`, 'super', 'An Abyss Dungeon rises', sdRec.next, null, 'Not before this. Watch the Bay for its brass omen');

  // ── THE STARFALL (net/starfall/starfallLaw.js: three stars a night while the Witches' Festival runs) ── STAR6 (bible/11-Multiplayer/
  // Starfall.md section 8): the rows the star's own law lays (systems/starfall/starfallClient.js starTimerRows) - each
  // fallen star still undecided, to its deadline; the next fall, with the night's coven - handed in whole by the host, the
  // one that knows where the night's stars fall and which of them are held.
  for (const r of src?.stars ?? []) if (r?.kind === 'star' && typeof r.id === 'string' && Number.isFinite(r.at)) rows.push(r);

  // ── AN ELITE BREACH (net/eliteGates/egLaw.js egTimes: the call's opening, the open window, THE COUNT) ── EG-F (bible/11-Multiplayer/
  // Elite-Gates.md section 2, the Timers row): the company's alone (the host hands it only the call it holds) - a new kind
  // beside the gate's and the Abyss Dungeon's: "Elite Breach opens 4:12" while the arch stands sealed, then the window to
  // answer, then the hall the company stands in and what is left on the count (`until` its end, held or running).
  const el = src?.elite ?? null;
  if (el && Number.isFinite(el.op) && !el.end) {
    const T = egTimes({ openedAt: el.op }), what = el.rh ? 'Rehearsal' : 'Elite Breach';
    if ((el.h ?? 0) > 0 && Number.isFinite(el.until)) live(`elite:${el.op}`, 'elite', `Hall ${el.h}`, /** @type {number} */ (el.until), null, 'Time left');
    else if (now < T.openAt) coming(`elite:${el.op}`, 'elite', `${what} opens`, T.openAt, null, 'Your company is called');
    else if (now < T.admitUntil) live(`elite:${el.op}`, 'elite', `${what} open`, T.admitUntil, null, 'Answer the call before this runs out');
  }
  // EG-ZM (Elite-Gates.md section 20, THE BOARD WINDOW - "reached from the Timers row"): where the host hands the boards'
  // door, every Elite row carries it, and the boards' own season - the arena's eight weeks (net/arena/arenaLaw.js) - stands as an
  // Elite row of its own, so the door is there with no breach of mine: its end, when each Descent bracket's top ten are kept
  // as Spire Champions through the next season (AUDIT EG III: its words, section 20's own).
  if (typeof src?.doors?.board === 'function') {
    const season = arenaSeasonOf(Math.floor(now / 1000));
    coming(`elite:season:${season}`, 'elite', `The Spire's season ${season} ends`, arenaSeasonEndsS(season) * 1000, null, 'Each Descent bracket\'s top ten hold the title Spire Champion through the next season');
    for (const r of rows) if (r.kind === 'elite') r.door = 'board';
  }

  // ── THE TOWN RAIDS (the mod's day: each town's raid a two-hour classic window) ──
  // AUDIT TIMERS1 D3: the day rolls about twenty-two across the Iliac Bay - the window held them all, twenty-seven rows.
  // The player's own region's raids are listed whole; the rest are one row, the soonest of them, and how many more.
  const raidRow = (r) => {
    const where = r.region ? `In ${r.region}` : null;   // the title names the town
    const who = r.type ? capital(r.type) : null;
    if (r.startMs > now) coming(`raid:${r.name}:${r.startMs}`, 'raid', `Raid on ${r.name}`, r.startMs, where, who ? `${who} attack` : null);
    else live(`raid:${r.name}:${r.startMs}`, 'raid', `Raid on ${r.name}`, r.endMs, where, who ? `${who} withdraw when this runs out` : null);
  };
  const raids = (src?.raids ?? []).filter((r) => r && Number.isFinite(r.startMs) && Number.isFinite(r.endMs) && r.endMs > now && !r.done);
  const home = src?.region ?? null;
  const elsewhere = [];
  for (const r of raids) (home && r.region === home ? raidRow(r) : elsewhere.push(r));
  if (elsewhere.length) {
    // the soonest to matter: one under way (to its end), else the next to start
    const next = elsewhere.reduce((a, r) => ((r.startMs <= now ? r.endMs : r.startMs) < (a.startMs <= now ? a.endMs : a.startMs) ? r : a));
    const more = elsewhere.length - 1;
    const rest = more ? `${more} more today across the Iliac Bay` : null;
    const under = next.startMs <= now;
    const id = `raids:elsewhere`;
    const title = home ? `Raids elsewhere: ${next.name}` : `Next raid: ${next.name}`;
    if (under) live(id, 'raid', title, next.endMs, next.region ? `In ${next.region}` : null, rest);
    else coming(id, 'raid', title, next.startMs, next.region ? `In ${next.region}` : null, rest);
  }

  // ── THE RAID DAY (the event clock's day - two real hours: the bounty board's hunts and the raids roll with it) ──
  // AUDIT TIMERS1 D4: NOT the calendar's day - since TIME1 the sky's date turns every real hour - so it says what turns
  const nextDay = Math.round(wallMsForClassicMinutes((gameDayAt(now) + 1) * GATE_DAY_MINUTES));
  coming('gameday', 'reset', 'New bounty hunts and raids', nextDay, null, 'New hunts on the bounty board and new town raids');

  // ── THE UTC DAY (the daily caps the service counts on its UTC day) ──
  // AUDIT TIMERS1 D10: the caps as they are - the Watch's only where the seats are open
  coming('daily', 'reset', 'Daily reset', (Math.floor(now / DAY_MS) + 1) * DAY_MS, '00:00 UTC',
    `Gathering nodes come back. Daily limits reset for rare hides, silver and Court writs${src?.seatsOpen ? ', and the Watch' : ''}`);   // CAP-OFF: gathering, hides and hauls keep no day's limit

  // ── THE SEAT WEEK (Muster, Reckoning, the Turning - Sunday 18:00 UTC) ──
  // AUDIT TIMERS1 D5: the seats' rows for an account the seats are open to (the service says, `seatBook.open`)
  const week = seatWeekOf(now);
  const turningAt = seatWeekStartMs(week + 1);
  const reckoningAt = turningAt - SEAT_RECKONING_MS;
  if (src?.seatsOpen) {
    if (seatPhaseOf(now) === 'muster') coming('reckoning', 'seat', 'The Reckoning', reckoningAt, 'Friday 18:00 UTC', 'Pledges lock until the Turning');
    else live('reckoning', 'seat', 'The Reckoning', turningAt, 'Pledges are locked', 'Ends at the Turning');
    coming('turning', 'seat', 'The Turning', turningAt, 'Sunday 18:00 UTC', 'Seats change hands. The Officers\' writ budget, the weekly caps and the Tides reset');
    const season = seasonOf(week, src?.zero ?? null);
    if (season) {
      const name = seatSeasonName(season.n);
      if (name) coming(`season:${season.n}`, 'seat', `${capital(name)} ends`, seatWeekStartMs(season.end), 'At its last Turning');
    }
  }

  // ── THE WEEK'S BATTLES (the seats list the service sends: sieges, tourneys, revolts; the Royal Tourney) ──
  for (const s of src?.seats ?? []) {
    const name = s?.name ?? s?.key ?? 'a seat';
    const b = s?.battle;
    if (b && b.state === 'scheduled' && Number.isFinite(b.startsAt)) {
      const start = b.startsAt * 1000;
      const end = Number.isFinite(b.endsAt) ? b.endsAt * 1000 : start + battleLengthMs({ kind: b.kind, tier: s.tier });
      const title = (BATTLE_TITLE[b.kind] ?? BATTLE_TITLE.siege)(name);
      // AUDIT TIMERS1 D1: the service sends each side as the guild ({ id, name, tag, heraldry }), not a name - the first
      // cut printed "[object Object] against [object Object]". In the seat tab's own words; a revolt is the town's own
      // rising, against the holder alone.
      const side = (g) => (g && typeof g === 'object' && g.name ? guildWords(g) : (typeof g === 'string' ? g : null));
      const a = side(b.guild), d = side(b.against) ?? side(s?.holder?.guild);
      const sides = a && d ? `${capital(a)} against ${d}` : a ? capital(a) : d ? `Against ${d}` : null;
      // AUDIT TIMERS1 D2: an ended battle says nothing - but the seat's Royal Tourney below still does (a `continue`
      // here skipped it, from a crown's siege's end to the Turning)
      if (end > now) {
        if (start > now) coming(`battle:${s.key ?? name}`, 'battle', title, start, sides, `Rosters close ${Math.round(SIGN_CLOSES_MS / 60_000)} minutes before`);
        else live(`battle:${s.key ?? name}`, 'battle', title, end, sides, 'Under way');
      }
    }
    if (s?.holder?.edict === 'royal-tourney') live(`royal:${s.key ?? name}`, 'battle', `Royal Tourney at ${name}`, turningAt, null, 'The champion is named at the Turning');
  }

  // live first (soonest end first), then what is coming (soonest first)
  return rows.sort((a, b) => (a.live === b.live ? a.at - b.at : a.live ? -1 : 1));
}

/** A countdown in the window's words: "2d 04h" past a day, "1:05:09" past an hour, "4:07" under it, "0:00" at the end.
 *  AUDIT TIMERS1 D7: seconds round UP, as gateLaw's countdownText does - the window and the gate's banner say one time. */
export function timerText(ms) {
  const s = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
  const two = (n) => String(n).padStart(2, '0');
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `${d}d ${two(h)}h`;
  if (h > 0) return `${h}:${two(m)}:${two(sec)}`;
  return `${m}:${two(sec)}`;
}

const WEEKDAYS = Object.freeze(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
const MONTHS = Object.freeze(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
/** The moment in the player's own clock: "18:00" today, "Sun 18:00" within the week, "Sun 18 Oct 18:00" beyond it
 *  (AUDIT TIMERS1 D9: a weekday alone did not say which Sunday a Season's end, sixteen days out, meant). */
export function localWhenText(wallMs, todayMs = Date.now()) {
  const d = new Date(wallMs), t = new Date(todayMs);
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const sameDay = d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
  if (sameDay) return hm;
  return wallMs - todayMs < 6 * DAY_MS ? `${WEEKDAYS[d.getDay()]} ${hm}` : `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${hm}`;
}
