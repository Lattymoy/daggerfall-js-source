// @ts-check
// SERPENT2 (2026-10-04, the owner: "the discord integration needs to happen"): THE SERPENT'S HERALD - what the relay's hub
// posts to the world events' Discord channel for the sea serpent, and when: DISCORD-GATES' law at sea (net/gate/gateHerald.js).
// The bells - fifteen real minutes before it rises - pinging the opt-in role, and the kill, once a serpent day.
//
// PURE, and the relay's (server/src/index.js - the hub posts, off its alarm): this imports serpentLaw.js, gateHerald.js
// and wire.js, all three the relay's already. Nothing here fetches; the hub hands Discord what these build.
//
// - THE DOOR: the gate's channel (GATE_DISCORD_WEBHOOK). The role the bells ping is SERPENT_DISCORD_ROLE when the
//   operator names one, else the gate's own (GATE_DISCORD_ROLE).
// - WHEN: the bells at their own instant (serpentLaw.js SERPENT_OMEN_MINUTE), posted late while the serpent has not risen
//   yet (a hub asleep through the instant, a deploy), never after; the kill when a cell tells the hub, once a serpent day,
//   while it is still news.
// - WHERE, AND WHICH KILL: the relay holds no map, so the site is the players' word, as the gate's is - each online game
//   says the site it found (`serpent` `site`, wire.js), one word an account a day, and the site named is the one the most
//   accounts said once GATE_SITE_AGREE of them agree (gateHerald.js foldGateSite and agreedGateSite - one law for both,
//   the site's native point to the whole unit in the gate's pixel slots). A cell keeps a fight for every site named to
//   it, a forged one too (AUDIT SERPENT S1), so the channel hears the kill AT THE AGREED SITE alone: a forged site's
//   fight, however it ends, never reaches it. Until a site is agreed the bells name no place (it is ringed on every map)
//   and a kill waits.
// - SAFE TO POST: gateHerald.js's law - the one role named in `allowed_mentions`, a name or a place held to letters,
//   digits, spaces and a little punctuation.
// - HERALD-CARDS (2026-10-22): each post is a card (net/herald/heraldCard.js) - the family The Sea Serpent, in its ring's
//   colour, the moment's title and its facts as fields.
//
// Not a DFU member: Daggerfall has no other players and no Discord. Ledger A (SERPENT2).
import { serpentDayAt, isSerpentDay, serpentAt, serpentTimes, serpentBossOf, sameSerpentSite, SERPENT_EVERY_DAYS, SERPENT_DIVE_MS } from './serpentLaw.js';
import { agreedGateSite, HERALD_FELL_KEEP_MS, GATE_SITE_SKEW_MS } from '../gate/gateHerald.js';
import { heraldCard, heraldName, heraldStamp, heraldWhen, heraldWho, heraldRole } from '../herald/heraldCard.js';   // HERALD-CARDS: the one card
import { SERPENT_TOP_MAX } from '../wire.js';

/** The role the serpent's bells ping: its own, when the operator names one, else the gate's - or null, none pinged. */
export const serpentHeraldRole = (own, gate) => heraldRole(own) ?? heraldRole(gate);

/**
 * THE BELLS' POST: where it is sighted, when it rises and when it dives (SERPENT4: its waters open till then) - the role
 * pinged first. HERALD-CARDS: the card - its title the sighting and its text the hunt, in the chat's words (serpentLaw.js
 * sightingLine), its fields when it rises, when it dives and where; the content the role and how soon.
 * @param {{day: number, place?: string|null, role?: string|null}} o
 */
export function serpentOmenPost({ day, place = null, role = null }) {
  const t = serpentTimes(day), boss = serpentBossOf(day);
  const off = place ? heraldName(place) : '';
  return heraldCard({
    family: 'serpent', moment: 'Bells', role,
    title: `A great serpent is sighted ${off ? `off ${off}` : 'on the packet lanes'}`,
    ping: `${boss.name} rises ${heraldStamp(t.riseAt, 'R')}.`,
    text: `Bells ring in the harbors. ${boss.name}, ${boss.nick}, hunts until it dives, and every ship may join until then. One ship alone cannot bring it down: sail out together.`,
    fields: [['Rises', heraldWhen(t.riseAt)], ['Dives', heraldStamp(t.soundAt, 't')], ['Where', off ? `Off ${off}` : 'Ringed on your map']],
  });
}

/**
 * THE KILL'S POST: the serpent slain, where, and by whom - its top dealers and how many more fought. Pings nobody.
 * HERALD-CARDS: the card - its title the kill, its fields where and by whom, its text the hoard (the chat's own
 * sentence's parts, serpentLaw.js slainLine).
 * @param {{day: number, place?: string|null, top?: ReadonlyArray<string>, n?: number}} o
 */
export function serpentFellPost({ day, place = null, top = [], n = 0 }) {
  const boss = serpentBossOf(day);
  const off = place ? heraldName(place) : '';
  return heraldCard({
    family: 'serpent', moment: 'Slain',
    title: `${boss.name} is slain`,
    text: 'Its hoard goes to the ships that fought it.',
    fields: [['Where', off ? `Off ${off}` : null], ['Slain by', heraldWho((Array.isArray(top) ? top : []).slice(0, SERPENT_TOP_MAX), n)]],
  });
}

/**
 * The bells the herald owes next: `{day, at}` - the first serpent whose bells are not posted (`postedDay` and before are)
 * and which has not risen yet, due at its bells (now, once they have rung). A serpent that rose unposted is let go.
 * @param {number} nowMs relay clock
 * @param {number} [postedDay] the last serpent day whose bells were posted
 */
export function serpentHeraldOmenDue(nowMs, postedDay = -1) {
  const today = serpentDayAt(nowMs);
  const posted = Number.isSafeInteger(postedDay) && postedDay <= today ? postedDay : -1;   // a day not yet come is no post made
  for (let d = Math.max(0, today); d <= today + SERPENT_EVERY_DAYS; d++) {
    if (!isSerpentDay(d) || d <= posted) continue;
    const t = serpentTimes(d);
    if (t.riseAt <= nowMs) continue;
    return { day: d, at: Math.max(nowMs, t.omenAt) };
  }
  return null;
}

/** Is a serpent day's kill still news at `nowMs` - a serpent day, and its waters not long gone quiet? */
export const serpentHeraldFellLive = (day, nowMs) => isSerpentDay(day) && nowMs < serpentTimes(day).soundAt + SERPENT_DIVE_MS + HERALD_FELL_KEEP_MS;

/** Does the hub take a word of day `day`'s site at `nowMs` - the serpent the clock is about, or the next one a moment
 *  before the turn? */
export const serpentSiteDayOk = (day, nowMs) => Number.isSafeInteger(day) && (day === serpentAt(nowMs).day || day === serpentAt(nowMs + GATE_SITE_SKEW_MS).day);

/** The site the hub's record agrees on for day `day`, as `{sx, sz, place}` (the gate's record's pixel slots hold the
 *  serpent's native point), or null. */
export function agreedSerpentSite(rec, day) {
  const a = agreedGateSite(rec, day);
  return a ? { sx: a.px, sz: a.py, place: a.pl } : null;
}

/**
 * THE KILL THE HERALD OWES, read off the hub's kept kills (`{d, list}` - one a site, server _serpentFellsOf) and its site
 * record: `{day, place, top, n}` for the kill AT THE AGREED SITE of the newest serpent day not yet posted while it is
 * news; `{wait: true}` while a kill of that day is kept and no agreed site's is (no agreement yet, or only a forged
 * site's fell); else null.
 * @param {{d: number, list: any[]}|null} fells @param {any} rec @param {number} postedDay @param {number} nowMs
 */
export function serpentHeraldKill(fells, rec, postedDay, nowMs) {
  if (!fells || !Number.isSafeInteger(fells.d) || fells.d <= postedDay || !serpentHeraldFellLive(fells.d, nowMs)) return null;
  const site = agreedSerpentSite(rec, fells.d);
  const f = site ? (Array.isArray(fells.list) ? fells.list : []).find((g) => sameSerpentSite(g, site)) : null;
  return f ? { day: fells.d, place: site.place, top: f.top, n: f.n } : { wait: true };
}
