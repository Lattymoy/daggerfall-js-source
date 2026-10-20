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
//
// Not a DFU member: Daggerfall has no other players and no Discord. Ledger A (DISCORD-GATES).
import { gameDayAt, isGateDay, gateAt, gateTimes, gateBossOf, gateModsOf, gatePortentsOf, portentsLine, GATE_EVERY_DAYS, GATE_COLLAPSE_MS } from './gateLaw.js';
import { GATE_TOP_MAX, NAME_MAX } from '../wire.js';
import { readGateMods } from './gateMods.js';   // WB8c: tonight's marks in the omen's post
import { RITE_OMEN_LINE } from './gateRite.js';

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

const WEBHOOK_RE = /^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api(?:\/v\d{1,2})?\/webhooks\/\d{1,20}\/[A-Za-z0-9_-]{1,128}$/;
const ROLE_RE = /^\d{15,21}$/;

/** The channel's webhook, or null - anything that is not a Discord webhook's URL is none (a secret put wrong posts
 *  nowhere else). */
export const heraldWebhook = (raw) => { const s = String(raw ?? '').trim(); return WEBHOOK_RE.test(s) ? s : null; };
/** The role the omen pings (a Discord id), or null - none pinged. */
export const heraldRole = (raw) => { const s = String(raw ?? '').trim(); return ROLE_RE.test(s) ? s : null; };

/** A name as a post says it: letters, digits, spaces, apostrophes and hyphens (a name is sanitizeName's already - this
 *  keeps Discord's markdown, links and mentions out of it), or '' for none. */
export const heraldName = (n) => String(n ?? '').replace(/[^A-Za-z0-9 '-]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim();

/** A relay-clock instant as Discord draws it in each reader's own time: `R` "in 15 minutes", `t` "14:32" (SERPENT2: the
 *  serpent's herald's too). */
export const heraldStamp = (ms, style) => `<t:${Math.floor(ms / 1000)}:${style}>`;
/** "Ann", "Ann and Bran", "Ann, Bran and Cid". */
export const heraldList = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0] ?? '');

/**
 * THE OMEN'S POST: where the sky burns, when the gate opens and seals, and who holds it - the role pinged first. WB8c:
 * and the marks he comes under tonight (net/gate/gateLaw.js gateModsOf - the words are the tables', never a player's).
 * WB14b: and the night's portents, after the marks (gateLaw.js portentsLine - nothing on a plain night).
 * @param {{day: number, place?: string|null, role?: string|null}} o
 */
export function omenPost({ day, place = null, role = null }) {
  const t = gateTimes(day), boss = gateBossOf(day), { aspect, trials } = readGateMods(gateModsOf(day));
  const ping = role ? `<@&${role}> ` : '';
  const where = place ? `near ${place}` : 'over the wilds';
  const map = place ? '' : ' It is marked on your map.';
  // WB13b: two sentences for the two times, and the marks in the chat's own sentence (net/gate/gateLaw.js marksLine)
  const marks = ` ${boss.name} comes **${aspect.epithet}** tonight${trials.length ? `, ${heraldList(trials.map((x) => x.name))}` : ''}.`;
  const pt = portentsLine(gatePortentsOf(day));   // WB14b: and the night's portents after them, the chat's own line (bible Breach-Portents.md section 6)
  return {
    content: `${ping}**The sky burns ${where}.** Dagon's faithful open a breach ${heraldStamp(t.openAt, 'R')} (${heraldStamp(t.openAt, 't')}). The Covenant seals it at ${heraldStamp(t.sealAt, 't')}.${map} ${RITE_OMEN_LINE}${marks}${pt ? ` ${pt}` : ''}`,   // WB12d: the rite - AUDIT WB12d (D3): the chat's own sentences, right after the breach they say is near
    allowed_mentions: role ? { roles: [role] } : { parse: [] },
  };
}

/**
 * THE KILL'S POST: the boss fallen, where, and by whom - the court's top dealers and how many more fought. Pings nobody.
 * @param {{day: number, place?: string|null, top?: ReadonlyArray<string>, n?: number}} o
 */
export function fellPost({ day, place = null, top = [], n = 0 }) {
  const boss = gateBossOf(day);
  const names = (Array.isArray(top) ? top : []).slice(0, GATE_TOP_MAX).map(heraldName).filter(Boolean);
  const others = Number.isSafeInteger(n) ? Math.max(0, n - names.length) : 0;
  const by = names.length ? `, struck down by ${heraldList([...names, ...(others ? [`${others} other${others === 1 ? '' : 's'}`] : [])])}` : '';   // WB13b: the chat's kill line's sentence
  return {
    content: `**${boss.name} has fallen** at Dagon's Breach ${place ? `near ${place}` : 'in the wilds'}${by}. The breach collapses.`,
    allowed_mentions: { parse: [] },
  };
}

/**
 * WB12d: THE RITE'S POST - the faithful's rite broken before the breach opened, where, and by whom. Pings nobody.
 * AUDIT WB12d (D4): the kill's own sentence (fellPost) - the event, the place, the first few who broke it and how many
 * more (`n`, the hub's count of them).
 * @param {{day?: number, place?: string|null, by?: ReadonlyArray<string>, n?: number}} o
 */
export function ritePost({ place = null, by = [], n = 0 }) {
  const names = (Array.isArray(by) ? by : []).slice(0, GATE_TOP_MAX).map(heraldName).filter(Boolean);
  const others = Number.isSafeInteger(n) ? Math.max(0, n - names.length) : 0;
  const who = names.length ? `, by ${heraldList([...names, ...(others ? [`${others} other${others === 1 ? '' : 's'}`] : [])])}` : '';
  return {
    content: `**The faithful's rite is broken** ${place ? `near ${place}` : 'in the wilds'}${who}.`,
    allowed_mentions: { parse: [] },
  };
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
