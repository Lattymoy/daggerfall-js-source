// @ts-check
// DISCORD-GATES (2026-09-28): THE GATE'S HERALD - what the relay's hub posts to a Discord channel, and when. The field's
// player: "add a discord channel that tells the gates in real time itll create hype and make more join"; Mac: "Discord
// live gates?", then the moments - "Omen (15 min before), Boss slain" - and "Ping an opt-in role" (on the omen alone),
// and for the place, "What do you need for discord": the players' own games say where the gate stands.
//
// PURE, and the relay's (server/src/index.js - the hub posts, off its alarm): this imports gateLaw.js and wire.js
// alone, both already the relay's. Nothing here fetches; the hub hands Discord what these build.
//
// - THE DOOR: a channel's webhook (GATE_DISCORD_WEBHOOK, a Worker SECRET - its URL is the key to the channel) and the
//   role the omen pings (GATE_DISCORD_ROLE, a var - a role's id is no secret). No webhook, no herald: the relay posts
//   nothing and keeps nothing for it.
// - WHEN: the omen at its own instant (gateLaw.js GATE_OMEN_MINUTE - fifteen real minutes before the gate opens), posted
//   late while the gate has not opened yet (a hub asleep through the instant, a deploy), never after; the kill when a
//   gate's object tells the hub (`_gateFellInternal`), once a day, while it is still news.
// - WHERE: the relay holds no map file, so the place is the players' word - each online game says where it found the
//   gate the clock is about (`gate` `site`, wire.js), one word an account a day, and the place is the one the most
//   accounts said, once at least GATE_SITE_AGREE of them agree: one lying client names nothing. Until then the post
//   says no place (the gate is on every map).
// - SAFE TO POST: every mention is the one role the operator named (`allowed_mentions` - Discord pings nothing else,
//   whatever the text holds), and the words a player can reach - the place, a fighter's name - are held to letters,
//   digits, spaces and a little punctuation, so no markdown, no link and no mention rides them.
// - HERALD-CARDS (2026-10-22): each post is a card (net/herald/heraldCard.js) - the family Dagon's Breach, the moment's
//   title, its facts as fields. The door and the safe words moved there with it, and are said again here for the
//   heralds and the hub that read them from this file.
//
// Not a DFU member: Daggerfall has no other players and no Discord. Ledger A (DISCORD-GATES).
import { gameDayAt, isGateDay, gateAt, gateTimes, gateBossOf, gateModsOf, gatePortentsOf, portentsLine, GATE_EVERY_DAYS, GATE_COLLAPSE_MS } from './gateLaw.js';
import { GATE_TOP_MAX } from '../wire.js';
import { readGateMods } from './gateMods.js';   // WB8c: tonight's marks in the omen's post
import { RITE_OMEN_LINE } from './gateRite.js';
import { heraldCard, heraldStamp, heraldWhen, heraldWho, heraldList } from '../herald/heraldCard.js';   // HERALD-CARDS: the one card

// HERALD-CARDS: the door and the safe words, the card's own now - said again here, where the heralds and the hub read them
export { heraldWebhook, heraldRole, heraldName, heraldStamp, heraldList } from '../herald/heraldCard.js';

/** How soon a post Discord did not take is posted again, ms. */
export const HERALD_RETRY_MS = 30_000;
/** How long one post may take before it is given up (and posted again), ms. */
export const HERALD_TIMEOUT_MS = 8_000;
/** How long after a gate's collapse its kill is still posted (a hub told late), ms. */
export const HERALD_FELL_KEEP_MS = 15 * 60_000;
/** A place is named once this many ACCOUNTS say it - one lying client names nothing. */
export const GATE_SITE_AGREE = 2;
/** A day's record's bounds: the places said, and the accounts counted for one. */
export const GATE_SITE_CANDIDATES_MAX = 8;
export const GATE_SITE_VOTES_MAX = 16;
/** A word for the NEXT gate is taken this far before the turn (a client's clock a moment ahead of the relay's), ms. */
export const GATE_SITE_SKEW_MS = 60_000;

/**
 * THE OMEN'S POST: where the sky burns, when the gate opens and seals, and who holds it - the role pinged first. WB8c:
 * and the marks he comes under tonight (net/gate/gateLaw.js gateModsOf - the words are the tables', never a player's).
 * WB14b: and the night's portents, after the marks (gateLaw.js portentsLine - nothing on a plain night).
 * HERALD-CARDS: the card - its title where the sky burns, its text the rite and the marks (the chat's own sentences),
 * its fields when it opens, when it seals and where; the content the role and how soon it opens.
 * @param {{day: number, place?: string|null, role?: string|null}} o
 */
export function omenPost({ day, place = null, role = null }) {
  const t = gateTimes(day), boss = gateBossOf(day), { aspect, trials } = readGateMods(gateModsOf(day));
  // WB13b: the marks in the chat's own sentence (net/gate/gateLaw.js marksLine)
  const marks = `${boss.name} comes **${aspect.epithet}** tonight${trials.length ? `, ${heraldList(trials.map((x) => x.name))}` : ''}.`;
  const pt = portentsLine(gatePortentsOf(day));   // WB14b: and the night's portents after them, the chat's own line (bible Breach-Portents.md section 6)
  return heraldCard({
    family: 'gate', moment: 'Omen', role,
    title: `The sky burns ${place ? `near ${place}` : 'over the wilds'}`,
    ping: `Dagon's Breach opens ${heraldStamp(t.openAt, 'R')}.`,
    text: `${RITE_OMEN_LINE} ${marks}${pt ? ` ${pt}` : ''}`,   // WB12d: the rite - AUDIT WB12d (D3): the chat's own sentences, before the marks
    fields: [['Opens', heraldWhen(t.openAt)], ['Seals', heraldStamp(t.sealAt, 't')], ['Where', place ? `Near ${place}` : 'Marked on your map']],
  });
}

/**
 * THE KILL'S POST: the boss fallen, where, and by whom - the court's top dealers and how many more fought. Pings nobody.
 * HERALD-CARDS: the card - its title the fall, its fields where and by whom (WB13b: the chat's kill line's facts), its
 * text the breach's collapse.
 * @param {{day: number, place?: string|null, top?: ReadonlyArray<string>, n?: number, w?: number, cs?: number}} o
 */
export function fellPost({ day, place = null, top = [], n = 0, w = 0, cs = 0 }) {
  const boss = gateBossOf(day);
  return heraldCard({
    family: 'gate', moment: 'Slain',
    title: cs > 1 ? `${boss.name} has fallen in ${w} of ${cs} courts` : `${boss.name} has fallen`,   // GATE-COURTS: one card a night - the courts that won, of the courts it held (net/gate/gateCourts.js nightWord)
    text: 'The breach collapses.',
    fields: [['Where', place ? `Near ${place}` : 'In the wilds'], ['Struck down by', heraldWho((Array.isArray(top) ? top : []).slice(0, GATE_TOP_MAX), n)]],
  });
}

/**
 * WB12d: THE RITE'S POST - the faithful's rite broken before the breach opened, where, and by whom. Pings nobody.
 * AUDIT WB12d (D4): the kill's own card (fellPost) - the event, the place, the first few who broke it and how many
 * more (`n`, the hub's count of them).
 * @param {{day?: number, place?: string|null, by?: ReadonlyArray<string>, n?: number}} o
 */
export function ritePost({ place = null, by = [], n = 0 }) {
  return heraldCard({
    family: 'gate', moment: 'Rite broken',
    title: 'The faithful\'s rite is broken',
    fields: [['Where', place ? `Near ${place}` : 'In the wilds'], ['Broken by', heraldWho((Array.isArray(by) ? by : []).slice(0, GATE_TOP_MAX), n)]],
  });
}

/**
 * The omen the herald owes next: `{day, at}` - the first gate whose omen is not posted (`postedDay` and before are) and
 * whose gate has not opened yet, due at its omen (now, once that has passed). A gate that opened unposted is let go.
 * @param {number} nowMs relay clock
 * @param {number} [postedDay] the last day whose omen was posted
 */
export function heraldOmenDue(nowMs, postedDay = -1) {
  const today = gameDayAt(nowMs);
  const posted = Number.isSafeInteger(postedDay) && postedDay <= today ? postedDay : -1;   // a day not yet come is no post made
  for (let d = Math.max(0, today); d <= today + GATE_EVERY_DAYS; d++) {
    if (!isGateDay(d) || d <= posted) continue;
    const t = gateTimes(d);
    if (t.openAt <= nowMs) continue;
    return { day: d, at: Math.max(nowMs, t.omenAt) };
  }
  return null;
}

/** Is a day's kill still news at `nowMs` - its gate a gate, and not long collapsed? */
export const heraldFellLive = (day, nowMs) => isGateDay(day) && nowMs < gateTimes(day).wrathAt + GATE_COLLAPSE_MS + HERALD_FELL_KEEP_MS;

/** Does the hub take a word of day `day`'s site at `nowMs` - the gate the clock is about, or the next one a moment
 *  before the turn? */
export const gateSiteDayOk = (day, nowMs) => Number.isSafeInteger(day) && (day === gateAt(nowMs).day || day === gateAt(nowMs + GATE_SITE_SKEW_MS).day);

/**
 * THE HUB'S RECORD OF WHERE THE GATE STANDS, with one account's word folded in: `{d, c}` - the day, and each place said
 * as `[px, py, pl, subs]` in the order it was first said. One word an account a day (its first stands); a newer day's
 * word starts the record again, an older day's is nothing. Answers the SAME record when nothing changed, so the caller
 * writes only a change.
 * @param {any} rec the record so far (storage's), or null
 * @param {number} day @param {string} sub the verified account @param {number} px @param {number} py @param {string} pl
 */
export function foldGateSite(rec, day, sub, px, py, pl) {
  const cur = rec && typeof rec === 'object' && Number.isSafeInteger(rec.d) && Array.isArray(rec.c) ? rec : null;
  if (cur && cur.d > day) return rec;
  const c = cur && cur.d === day ? cur.c.slice() : [];
  if (c.some((e) => e[3].includes(sub))) return rec;
  const i = c.findIndex((e) => e[0] === px && e[1] === py && e[2] === pl);
  if (i >= 0) {
    if (c[i][3].length >= GATE_SITE_VOTES_MAX) return rec;
    c[i] = [px, py, pl, [...c[i][3], sub]];
  } else {
    if (c.length >= GATE_SITE_CANDIDATES_MAX) return rec;
    c.push([px, py, pl, [sub]]);
  }
  return { d: day, c };
}

/** The place the record names for day `day`: the one the most accounts said, at least GATE_SITE_AGREE of them (the
 *  first said wins a tie), as `{px, py, pl}` - or null. */
export function agreedGateSite(rec, day) {
  if (!rec || typeof rec !== 'object' || rec.d !== day || !Array.isArray(rec.c)) return null;
  let best = null;
  for (const e of rec.c) if (e[3].length >= GATE_SITE_AGREE && (!best || e[3].length > best[3].length)) best = e;
  return best ? { px: best[0], py: best[1], pl: best[2] } : null;
}
