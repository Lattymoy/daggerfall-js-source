// @ts-check
// TIMERS1 (2026-10-02, Mac: "we need to create a new unique UI element for reset times like the Sunday wars, oblivion
// gates, town raids, and anything else so the player can keep track of when things are and watch countdowns").
//
// THE SCHEDULE, AS ROWS. Every shared moment of the online world is already a pure function of the relay's clock in
// its own law - the gate's day (net/gateLaw.js), the seat week's Reckoning and Turning (net/townSeatLaw.js), a game
// day's turnover and the UTC day's - or a fact the client already holds (the week's battles in the seats list, the
// day's raids the mod rolled). This module derives nothing of its own: it asks those laws and lays their answers out
// as one list a window can draw, each row either LIVE (running now, counting down to its end) or COMING (counting down
// to its start). It reads no globals; the host hands in the relay's now and what it holds.
//
// A row: { id, kind, title, where, detail, live, at, until }
//   at     the moment the countdown runs to (ms, relay clock): the start of a coming row, the end of a live one
//   until  a live row's end; null on a coming row
import { gateAt, gateTimes, gatePhase, GATE_EVERY_DAYS, gameDayAt, GATE_DAY_MINUTES } from '../net/gateLaw.js';
import { wallMsForClassicMinutes } from '../net/wire.js';
import { seatWeekOf, seatWeekStartMs, seatPhaseOf, SEAT_RECKONING_MS, seasonOf, seatSeasonName, battleLengthMs, SIGN_CLOSES_MS, guildWords } from '../net/townSeatLaw.js';
import { serpentAt, serpentTimes, serpentPhase, serpentBossOf, SERPENT_EVERY_DAYS } from '../net/serpentLaw.js';   // SERPENT-TIMERS: the sea serpent's day
import { sdPhase, SD_COLLAPSE_MS } from '../net/sdLaw.js';   // SD2c: the Super dungeon's record, once it is news

const DAY_MS = 86_400_000;

/** The battle kinds in the words a seat's own tab uses for them. */
const BATTLE_TITLE = Object.freeze({ siege: (n) => `Siege of ${n}`, tourney: (n) => `Tourney at ${n}`, revolt: (n) => `Revolt at ${n}` });

const capital = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * @param {{ now: number,
 *           gate?: { place?: string|null, fellAt?: (day: number) => (number|null) } | null,
 *           serpent?: { place?: string|null, fellAt?: (day: number) => (number|null) } | null,
 *           sd?: { rec: any, name?: string|null, place?: string|null } | null,
 *           seatsOpen?: boolean, seats?: Array<any> | null, zero?: number | null, region?: string | null,
 *           raids?: Array<{ name: string, region?: string, type?: string, startMs: number, endMs: number, done?: boolean }> | null }} src
 */
export function eventTimerRows(src) {
  const now = Number(src?.now);
  if (!Number.isFinite(now)) return [];
  /** @type {Array<{id: string, kind: string, title: string, where: string|null, detail: string|null, live: boolean, at: number, until: number|null}>} */
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
  else if (phase === 'open') live(`gate:${t.day}`, 'gate', 'Dagon\'s Breach open', t.sealAt, place, 'Seals when this runs out - get inside');
  else if (phase === 'closed') live(`gate:${t.day}`, 'gate', 'Dagon\'s Breach sealed', t.wrathAt, place, 'Collapses when this runs out');
  // ...and the gate after it, once this one is under way
  if (phase !== 'quiet') coming(`gate:${t.day + GATE_EVERY_DAYS}`, 'gate', 'Next Dagon\'s Breach opens', gateTimes(t.day + GATE_EVERY_DAYS).openAt);

  // ── THE SEA SERPENT (serpentLaw: every other game day at the dawn watch - every four real hours: the bells, the
  // rising, the storm closing its waters, its dive) ── SERPENT-TIMERS (2026-10-04, the owner: "This needs to happen" -
  // the serpent was the one shared event the window did not count). Where it lies is said from its bells on, as the
  // chat says it; the next serpent's rising stands beside it once this one is under way.
  const s = serpentAt(now);
  const sPhase = serpentPhase(s, now, src?.serpent?.fellAt?.(s.day) ?? null);
  const sName = serpentBossOf(s.day).name;
  const off = src?.serpent?.place ? `Off ${src.serpent.place}` : null;
  if (sPhase === 'quiet') coming(`serpent:${s.day}`, 'serpent', `${sName} rises`, s.riseAt, null, 'The harbour bells ring 15 minutes before');
  else if (sPhase === 'omen') coming(`serpent:${s.day}`, 'serpent', `${sName} rises`, s.riseAt, off, 'The harbour bells are ringing - its waters are ringed on your map');
  else if (sPhase === 'rising' || sPhase === 'hunt') live(`serpent:${s.day}`, 'serpent', `${sName} hunts`, s.sealAt, off, 'A storm closes its waters when this runs out - sail out to join');
  else if (sPhase === 'late') live(`serpent:${s.day}`, 'serpent', `${sName}'s waters are closed`, s.soundAt, off, 'It dives when this runs out');
  if (sPhase !== 'quiet') {
    const nextDay = s.day + SERPENT_EVERY_DAYS;
    coming(`serpent:${nextDay}`, 'serpent', 'Next sea serpent rises', serpentTimes(nextDay).riseAt);
  }

  // ── THE SUPER DUNGEON (net/sdLaw.js: the hub's one record) ── SD2c (bible/11-Multiplayer/Super-Dungeons.md section
  // 4): a row once it is FOUND - news, by the finder's word - and none before (a Hollow that has only risen is a find:
  // its omen in the sky and a word in its city's taverns, never a countdown that says one stands); its fading unbeaten
  // while it stands, its collapse after the kill. Where it stands is the host's (`place`, its city), and its name.
  const sdRec = src?.sd?.rec ?? null;
  const sdNow = sdPhase(sdRec, now);
  const sdName = src?.sd?.name || 'The Abyss Dungeon';
  const sdWhere = src?.sd?.place ? `Near ${src.sd.place}` : null;
  if (sdNow === 'found') live(`sd:${sdRec.s}`, 'super', `${sdName} stands`, sdRec.until, sdWhere, 'Found - it fades unbroken when this runs out');
  else if (sdNow === 'fell') live(`sd:${sdRec.s}`, 'super', `${sdName} collapses`, sdRec.fellAt + SD_COLLAPSE_MS, sdWhere, 'Its Hour is broken - it folds in on itself when this runs out');

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
  coming('gameday', 'reset', 'New bounty hunts and raids', nextDay, null, 'The bounty board posts a new day\'s hunts; new town raids are rolled');

  // ── THE UTC DAY (the daily caps the service counts on its UTC day) ──
  // AUDIT TIMERS1 D10: the caps as they are - the Watch's only where the seats are open
  coming('daily', 'reset', 'Daily reset', (Math.floor(now / DAY_MS) + 1) * DAY_MS, '00:00 UTC',
    `The day's nodes stand anew; rare hides, Marks and Court writs${src?.seatsOpen ? ', and the Watch' : ''}: their daily limits start again`);   // CAP-OFF: gathering, hides and hauls keep no day's limit

  // ── THE SEAT WEEK (Muster, Reckoning, the Turning - Sunday 18:00 UTC) ──
  // AUDIT TIMERS1 D5: the seats' rows for an account the seats are open to (the service says, `seatBook.open`)
  const week = seatWeekOf(now);
  const turningAt = seatWeekStartMs(week + 1);
  const reckoningAt = turningAt - SEAT_RECKONING_MS;
  if (src?.seatsOpen) {
    if (seatPhaseOf(now) === 'muster') coming('reckoning', 'seat', 'The Reckoning', reckoningAt, 'Friday 18:00 UTC', 'Pledges lock until the Turning');
    else live('reckoning', 'seat', 'The Reckoning', turningAt, 'Pledges are locked', 'Ends at the Turning');
    coming('turning', 'seat', 'The Turning', turningAt, 'Sunday 18:00 UTC', 'Seats change hands; the Officers\' writ budget, the weekly caps and the Tides start again');
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
