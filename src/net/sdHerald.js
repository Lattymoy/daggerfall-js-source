// @ts-check
// SD-HERALD (2026-10-09, the owner: "We need to add discord integration to abyss dungeons"): THE ABYSS DUNGEON'S HERALD -
// what the relay's hub posts to the world events' Discord channel for a Hollow, and when: DISCORD-GATES' law
// (net/gateHerald.js) and the serpent's (net/serpentHerald.js), given to the Abyss Dungeon. Four posts, one for each of a
// Hollow's moments, read off the hub's own record (net/sdLaw.js - the director's):
//
// - THE RISE, pinging the opt-in role: an Abyss Dungeon stands somewhere, and when it fades unfound. NEVER WHERE - it is
//   a find, with no map mark and no compass mark (Super-Dungeons.md section 4), and the Timers count the next one's
//   rise, never its place.
// - THE FIND, pinging the role again - the Rift is open: who found it and where, as the chat says it with no city
//   (net/sdLaw.js sdFoundLine - "in the Dwynnen region"). The relay holds no map, so the region is the record's own `r`
//   (the census's), named from MapsFile's own table (formats/mapsTables.js REGION_NAMES), and the city is never said.
// - THE FALL: who broke the Hour (the record's top fighter and how many more fought), and when the next may rise.
// - THE FADE: a FOUND Hollow the Hour closed over unbroken - one never found was news to nobody (the chat's own law,
//   scenes/sdHost.js).
//
// A Hollow's name is said where its slot's name needs no city (six of the eight - net/sdLaw.js SD_NAMES); the other two
// name the city every client finds for itself, so the post says "an Abyss Dungeon".
//
// PURE, and the relay's (server/src/index.js - the hub posts, off its alarm, after the director's beat): this imports
// sdLaw.js, gateHerald.js and formats/mapsTables.js (a verbatim table that imports nothing). Nothing here fetches; the
// hub hands Discord what these build.
//
// - THE DOOR: the gate's channel (GATE_DISCORD_WEBHOOK). The role the rise and the find ping is SD_DISCORD_ROLE when
//   the operator names one, else the gate's own (GATE_DISCORD_ROLE) - the serpent's law (serpentHeraldRole).
// - WHEN (sdHeraldDue): each moment once a slot, while it is still so - the rise while the record says risen, the find
//   while it says found and its time has not run, the fall and the fade until HERALD_FELL_KEEP_MS past the Hollow's
//   end. A moment that is no longer so is let go unposted (a Discord down through it, a herald given its webhook late).
// - SAFE TO POST: gateHerald.js's law - the one role named in `allowed_mentions`, and a name held to letters, digits,
//   spaces and a little punctuation (heraldName).
//
// Not a DFU member: Daggerfall has no other players and no Discord. Ledger A (SD-HERALD).
import { sdPhase, sdNameOf, sdNameIn, sdWhere, sdFoundLine, sdFadeLine, SD_COLLAPSE_MS, SD_FADE_GRACE_MS } from './sdLaw.js';
import { heraldName, heraldStamp, heraldList, HERALD_FELL_KEEP_MS } from './gateHerald.js';
import { REGION_NAMES } from '../formats/mapsTables.js';

/** @typedef {import('./wire.js').SdRecord} SdRecord */
/** @typedef {{ rise: number, found: number, end: number }} SdHeraldState */
/** @typedef {'rise'|'found'|'fell'|'fade'} SdHeraldKind */

/** The record's region as the chat names it - its name, or '' for the Bay's great cities (-1) and anything unknown. */
export const sdRegionName = (r) => (Number.isSafeInteger(r) && r >= 0 ? REGION_NAMES[r] ?? '' : '');

/** A slot's name as the herald may say it: its name when that needs no city, else null. The city is every client's own
 *  (systems/sdSite.js), so a name with one is asked of sdNameOf with a mark no name holds, and the mark found in it. */
export function sdHeraldName(s) {
  const named = sdNameOf(s, '\u0000');
  return named.includes('\u0000') ? null : named;
}

const ping = (role) => (role ? `<@&${role}> ` : '');
const mentions = (role) => (role ? { roles: [role] } : { parse: [] });

/**
 * THE RISE'S POST: an Abyss Dungeon stands somewhere, to be found - never where - and when it fades unfound. The role
 * pinged first.
 * @param {{ rec: SdRecord, role?: string|null }} o
 */
export function sdRisePost({ rec, role = null }) {
  return {
    content: `${ping(role)}**A bell rings where there is no bell: an Abyss Dungeon has risen.** A column of brass-gold light stands over it somewhere in the Iliac Bay, and the taverns of the city it stands by speak of it. No map shows it - the first to stand at its door finds it. Unfound, it fades ${heraldStamp(rec.until, 'R')}.`,
    allowed_mentions: mentions(role),
  };
}

/**
 * THE FIND'S POST: the chat's own line with no city (who found it, in its region), then the way in and when it fades.
 * The role pinged first.
 * @param {{ rec: SdRecord, role?: string|null }} o
 */
export function sdFoundPost({ rec, role = null }) {
  const name = sdHeraldName(rec.s);
  return {
    content: `${ping(role)}**${sdFoundLine({ who: heraldName(rec.fb) || 'Someone', near: '', region: sdRegionName(rec.r) })}** ${name ?? 'It'} is on every map now. Fight through it to the Rift at its end: the Shattered Hour waits beyond, one life each to break it before it fades ${heraldStamp(rec.until, 'R')}.`,
    allowed_mentions: mentions(role),
  };
}

/**
 * THE FALL'S POST: who broke the Hour - the top fighter and how many more fought (`n` counts every seat, the top's
 * among them) - where, and when the next may rise. Pings nobody.
 * @param {{ rec: SdRecord }} o
 */
export function sdFellPost({ rec }) {
  const others = Number.isSafeInteger(rec.n) ? Math.max(0, rec.n - 1) : 0;
  const by = heraldList([heraldName(rec.top) || 'Someone', ...(others ? [`${others} other${others === 1 ? '' : 's'}`] : [])]);
  const name = sdHeraldName(rec.s);
  return {
    content: `**${by} broke the Hour** in ${name ? sdNameIn(name) : 'an Abyss Dungeon'} ${sdWhere('', sdRegionName(rec.r))}. The Brass Remnant has fallen, and the Abyss Dungeon collapses. The next may rise ${heraldStamp(rec.next, 'R')}.`,
    allowed_mentions: { parse: [] },
  };
}

/**
 * THE FADE'S POST: the chat's own line (net/sdLaw.js sdFadeLine), where, and when the next may rise. Pings nobody.
 * @param {{ rec: SdRecord }} o
 */
export function sdFadePost({ rec }) {
  const name = sdHeraldName(rec.s);
  return {
    content: `**${sdFadeLine({ name: `${name ?? 'an Abyss Dungeon'} ${sdWhere('', sdRegionName(rec.r))}` })}** The next Abyss Dungeon may rise ${heraldStamp(rec.next, 'R')}.`,
    allowed_mentions: { parse: [] },
  };
}

/** The post for a moment the herald owes - the role the rise's and the find's alone. */
export function sdHeraldPost(kind, rec, role = null) {
  if (kind === 'rise') return sdRisePost({ rec, role });
  if (kind === 'found') return sdFoundPost({ rec, role });
  if (kind === 'fell') return sdFellPost({ rec });
  return sdFadePost({ rec });
}

/**
 * WHAT THE HERALD OWES for the hub's record at `now`, given the last slot whose rise, find and end it has posted or let
 * go (`st`): `{ kind, st }` - the moment owed now (null for none) and the state with every moment that is no longer so
 * let go. One moment at a time, in the Hollow's own order; nothing for slot 0, the hub's own first beat.
 * @param {SdRecord|null|undefined} rec the hub's record
 * @param {SdHeraldState} st
 * @param {number} now relay clock
 * @returns {{ kind: SdHeraldKind|null, st: SdHeraldState }}
 */
export function sdHeraldDue(rec, st, now) {
  const out = { rise: st.rise, found: st.found, end: st.end };
  if (!rec || !Number.isSafeInteger(rec.s) || rec.s < 1) return { kind: null, st: out };
  const s = rec.s, phase = sdPhase(rec, now);
  if (s > out.rise) {
    if (phase === 'risen') return { kind: 'rise', st: out };
    out.rise = s;
  }
  if (s > out.found && rec.foundAt != null) {
    if (phase === 'found') return { kind: 'found', st: out };
    out.found = s;
  }
  if (s > out.end) {
    if (rec.fellAt != null) {
      if (now < rec.fellAt + SD_COLLAPSE_MS + HERALD_FELL_KEEP_MS) return { kind: 'fell', st: out };
      out.end = s;
    } else if (rec.ph === 'gone') {
      // the hub says the fade SD_FADE_GRACE_MS past `until` (net/sdLaw.js sdDue) - and only a found Hollow's is news
      if (rec.foundAt != null && now < rec.until + SD_FADE_GRACE_MS + HERALD_FELL_KEEP_MS) return { kind: 'fade', st: out };
      out.end = s;
    }
  }
  return { kind: null, st: out };
}

/** The herald's state as storage holds it, each slot a whole number or -1 (nothing posted).
 *  @returns {SdHeraldState} */
export function readSdHeraldState(v) {
  const slot = (x) => (Number.isSafeInteger(x) && x >= -1 ? x : -1);
  return { rise: slot(v?.rise), found: slot(v?.found), end: slot(v?.end) };
}
