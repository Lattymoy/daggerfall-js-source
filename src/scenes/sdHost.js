// @ts-check
// SD2b (2026-10-05, Mac: "Super dungeons are random finds on the world map, and spawn where population is at its most.
// Only one can be active at a time. On discovery, Super dungeons have a a beginning and an end."; bible/11-Multiplayer/
// Super-Dungeons.md sections 2-4): THE HOLLOW IN THE WORLD - the world host's half of the Super dungeon. The hub's record
// (net/sdLaw.js, said by net/online.js onSd) comes in; the Hollow it names is found over this client's own map files
// (systems/sdSite.js - the city, the site by the gate's own scan, the template, the clone), the same on every client;
// it stands in the location index at its pixel while the record's phase says it stands, and the host builds it there as
// it builds any spawned dungeon; the first player at its door says so (`found`, to the cell its pixel is in, again every
// SD_FOUND_RESEND_MS while the record still says risen); and the chat says the moves everyone online should hear - the
// find, the kill, the fading. A rise is said to nobody: it is a find.
//
// THE GROUND IS NEVER PULLED FROM UNDER A PLAYER: a Hollow whose record says gone stays in the index while the player
// stands in its dungeon (TTL1's own law for a spawn), and goes when they leave. SD2d: and they do not stay - its end
// casts them out before its door once (`castOut`, the host's: the dungeon's own way out, the closing line), and the
// next frame finds them outside and takes it down.
//
// Pure but for its seams, which the world host hands in (scenes/world.js). Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { sdPhase, sdStands, sdFoundLine, sdFellLine, sdFadeLine, SD_FOUND_NEAR_M, SD_FOUND_RESEND_MS, SD_COLLAPSE_MS } from '../net/sdLaw.js';
import { countdownText } from '../net/gateLaw.js';   // SD10: the collapse's countdown, the gate's own words
import { findSdSite, pickSdTemplate, sdHollowLocation } from '../systems/sdSite.js';
import { worldRoom } from '../net/wire.js';
import { sdMapMark, sdOmenLight, sdRumor, sdMarksLine, sdHourLine, SD_HOUR_LEFT_MS } from '../systems/sdOmen.js';   // SD2c: the Hollow seen and heard of; SD19: its marks and its last hour said

/** A line the scan has not been able to place yet is said with the region's name after this long, never lost. */
export const SD_LINE_WAIT_MS = 30_000;

/** SD10 (2026-10-07, section 11's collapse): THE COLLAPSE'S READOUTS - whoever stands in the Hollow or its Hour while it
 *  collapses is told how long is left: at the fall (or the first frame they are inside during it), then as each of these
 *  is left, ms - each once a slot, never one already passed. */
export const SD_COLLAPSE_WARN_MS = Object.freeze([60_000, 30_000, 10_000]);
/** The readout owed now: the least mark at or above `left` - the whole collapse's first - when it is under the last one
 *  said (`said`, Infinity for none); else null. Pure. */
export function sdCollapseDue(left, said = Infinity) {
  if (!(left > 0)) return null;
  let due = SD_COLLAPSE_MS;
  for (const m of SD_COLLAPSE_WARN_MS) if (left <= m) due = m;
  return due < said ? due : null;
}
/** Its words: in the Hour, the way home named at the first; in the Hollow, the Hollow's. Pure. AUDIT SD II (L6 F2, F21):
 *  WB13b's - no dash asides; and the way home OPENS where it fell (it said "stands" four seconds before it rose). AUDIT
 *  SD III (T15): outside the Hour the player's word for the place, as everywhere else it is named - the Abyss Dungeon. */
export function sdCollapseLine(left, { hour = false, first = false } = {}) {
  const t = countdownText(left);
  if (hour) return first ? `The Hour collapses in ${t}. The way home opens where the Remnant fell.` : `The Hour collapses in ${t}.`;
  return first ? `The Hour is broken. The Abyss Dungeon collapses in ${t}.` : `The Abyss Dungeon collapses in ${t}.`;
}
/** AUDIT SD II (L6 F5): THE FADE'S READOUTS - a Hollow unbeaten closes at its `until` and casts out whoever stands in it
 *  or its Hour, mid-blow; whoever stands there is told as it nears, at each of these marks, ms (the first said with
 *  what is left whenever they are first inside it). */
export const SD_FADE_WARN_MS = Object.freeze([300_000, 60_000, 30_000, 10_000]);
/** The fade's readout owed now (sdCollapseDue's law over SD_FADE_WARN_MS), or null. Pure. */
export function sdFadeDue(left, said = Infinity) {
  if (!(left > 0) || left > SD_FADE_WARN_MS[0]) return null;
  let due = SD_FADE_WARN_MS[0];
  for (const m of SD_FADE_WARN_MS) if (left <= m) due = m;
  return due < said ? due : null;
}
/** Its words. Pure. AUDIT SD III (T15): the Abyss Dungeon FADES, as its ring, its banner and its note say it does (it
 *  "closed" here alone) - and the Hour inside it closes as it goes. */
export const sdFadeReadout = (left, { hour = false } = {}) => `${hour ? 'The Hour closes' : 'The Abyss Dungeon fades'} in ${countdownText(left)}.`;

/** @typedef {import('../net/wire.js').SdRecord} SdRecord */

/**
 * @param {{
 *   now: () => number,
 *   scan: () => any,
 *   warmScan?: () => void,
 *   cities: (r: number) => any[],
 *   templates: () => any[],
 *   where: (px: number, py: number) => object,
 *   stand: (key: string, loc: any) => void,
 *   unstand: (key: string) => void,
 *   inside: (loc: any) => boolean,
 *   door: (key: string) => (number[]|null),
 *   feet: () => (number[]|null),
 *   sendFound: (word: {s:number, px:number, py:number}, cell: string) => boolean,
 *   say: (text: string) => void,
 *   regionName?: (r: number) => string,
 *   castOut?: (key: string) => (boolean|void),
 *   warn?: (text: string) => void,
 *   inHour?: () => boolean,
 *   standing?: () => (number|null),
 * }} o SD10: `warn` the collapse's readouts (over the screen), `inHour` whether I stand in the Hour rather than the Hollow.
 *   AUDIT SD II (L1 F2, F3): `castOut` answers false when it could not act (the dead are the death's) - asked again the
 *   next frame; `standing` the slot of the Hollow or Hour I stand in, or null
 */
export function createSdHost({ now, scan, warmScan = () => {}, cities, templates, where, stand, unstand, inside, door, feet, sendFound, say, regionName = () => '', castOut = () => {}, warn = () => {}, inHour = () => false, standing = () => null }) {
  /** @type {SdRecord|null} */
  let rec = null;
  let heardAny = false;
  /** The Hollow of a slot, once found over the map files: `{ s, site, loc, key }`, or `{ s, none: true }` when the world
   *  offers none (no city with a suitable pixel, no template). */
  let memo = null;
  /** What stands in the index now: `{ s, key, loc }`. */
  let stood = null;
  /** The lines owed until the Hollow's place is known (its city's name): `{ kind, rec, at }`. */
  const owed = [];
  let foundSentAt = -Infinity, foundSentS = 0;
  /** SD2d: the slot whose Hollow this player was cast out of - once a slot. */
  let castOutS = 0;
  /** SD10: the collapse's last readout said - its slot and its mark. AUDIT SD II (L6 F5): and the fade's. */
  let warned = { s: 0, at: Infinity }, fadeWarned = { s: 0, at: Infinity };
  /** SD19: the slot whose last hour has been said (once a slot). */
  let hourSaidS = 0;

  /** The Hollow a record names, found once a slot; null while the scan is not ready (it is warmed). */
  function hollowOf(r) {
    if (!r || !r.s) return null;
    if (memo && memo.s === r.s) return memo.none ? null : memo;
    const sc = scan();
    if (!sc) { warmScan(); return null; }
    const site = findSdSite(r, sc, cities(r.r));
    const template = site ? pickSdTemplate(r.s, templates()) : null;
    const loc = site && template ? sdHollowLocation(r, site, template, where(site.px, site.py)) : null;
    if (!loc) { memo = { s: r.s, none: true }; console.warn(`[sd] slot ${r.s}: the world offers no Hollow (${site ? 'no template' : 'no site'})`); return null; }
    memo = { s: r.s, site, loc, key: `${site.px},${site.py}` };
    return memo;
  }

  /** A record the hub said: kept when it is this slot's or a later one's; a move after the first word owes its line. */
  function heard(w) {
    if (!w || !Number.isSafeInteger(w.s) || w.s < 1) return;
    if (rec && w.s < rec.s) return;   // an older slot's word: the hub moved on
    const was = rec;
    rec = { ...w };
    delete /** @type {any} */ (rec).k;
    const first = !heardAny;
    heardAny = true;
    if (first) return;   // the welcome's record: what happened while I was away is no news
    const t = now();
    if (rec.ph === 'found' && !(was && was.s === rec.s && (was.ph === 'found' || was.ph === 'fell'))) owed.push({ kind: 'found', rec, at: t });
    if (rec.ph === 'fell' && !(was && was.s === rec.s && was.ph === 'fell')) owed.push({ kind: 'fell', rec, at: t });
    if (rec.ph === 'gone' && rec.fellAt == null && rec.foundAt != null && was && was.s === rec.s && was.ph !== 'gone') owed.push({ kind: 'fade', rec, at: t });   // AUDIT SD II (L6): a FOUND Hollow's fade - one never found was news to nobody
  }

  /** The lines owed, said once the Hollow's place is known - or, past SD_LINE_WAIT_MS, with the region's name. */
  function sayOwed(t) {
    while (owed.length) {
      const o = owed[0];
      const h = hollowOf(o.rec);
      if (!h && t - o.at < SD_LINE_WAIT_MS && !(memo && memo.s === o.rec.s && memo.none)) return;
      owed.shift();
      const near = h?.site?.cityName || '', region = regionName(o.rec.r) || '';   // AUDIT SD III (T19): its region said as a region
      const name = h?.loc?.name || 'an Abyss Dungeon';
      if (o.kind === 'found') { say(sdFoundLine({ who: o.rec.fb || 'Someone', near, region })); const m = sdMarksLine({ name: h?.loc?.name, s: o.rec.s }); if (m) say(m); }   // SD19: and its marks
      else if (o.kind === 'fell') say(sdFellLine({ top: o.rec.top || 'Someone', n: o.rec.n ?? 1, name }));
      else say(sdFadeLine({ name }));
    }
  }

  /** ONE FRAME: the Hollow stood or taken down as its record's phase says, the find said at its door, the owed lines. */
  function frame() {
    const t = now();
    const phase = sdPhase(rec, t);
    const h = sdStands(phase) ? hollowOf(rec) : null;
    // what stood and should not: down - unless the player stands in it (the ground is never pulled from under them), and
    // then they are cast out before its door, once (SD2d); the next frame finds them outside
    let asked = false;
    if (stood && (!h || h.s !== stood.s)) {
      if (!inside(stood.loc)) { unstand(stood.key); stood = null; }
      // AUDIT SD II (L1 F2): latched once it ACTED - a player dead at the end and raised where they lay (a Resurrect) was
      // latched as cast out, and stood in an ended Hollow or Hour for good
      else if (castOutS !== stood.s) { asked = true; if (castOut(stood.key) !== false) castOutS = stood.s; }
    }
    // AUDIT SD II (L1 F3): THE END JUDGED WHERE I STAND, too - a step under the veil (into the Hour, or back into its
    // Hollow: a whole dungeon's build) could finish after the end had taken the Hollow down, and land me in a Hollow or an
    // Hour no frame would ever cast me out of. Judged once the hub has said its record (a page that has heard nothing
    // knows no end)
    const at = standing();
    if (!asked && at != null && rec && !(rec.s === at && sdStands(phase)) && castOutS !== at && castOut(`slot:${at}`) !== false) castOutS = at;
    if (h && !stood) { stand(h.key, h.loc); stood = { s: h.s, key: h.key, loc: h.loc }; }
    // SD10: THE COLLAPSE'S READOUTS - to whoever stands in it (the Hollow, or its Hour) while it collapses
    if (phase === 'fell' && stood && stood.s === rec?.s && rec.fellAt != null && inside(stood.loc)) {
      const left = rec.fellAt + SD_COLLAPSE_MS - t;
      const due = sdCollapseDue(left, warned.s === rec.s ? warned.at : Infinity);
      if (due != null) { const first = warned.s !== rec.s; warned = { s: rec.s, at: due }; warn(sdCollapseLine(left, { hour: inHour(), first })); }
    }
    // AUDIT SD II (L6 F5): THE FADE'S READOUTS - to whoever stands in a Hollow (or its Hour) its time is running out on
    if ((phase === 'risen' || phase === 'found') && stood && stood.s === rec?.s && Number.isFinite(rec.until) && inside(stood.loc)) {
      const left = rec.until - t;
      const due = sdFadeDue(left, fadeWarned.s === rec.s ? fadeWarned.at : Infinity);
      if (due != null) { fadeWarned = { s: rec.s, at: due }; warn(sdFadeReadout(left, { hour: inHour() })); }
    }
    // the find: at its door, while the record says risen - again every SD_FOUND_RESEND_MS until the hub's word moves it
    if (phase === 'risen' && stood && stood.s === rec?.s && (foundSentS !== stood.s || t - foundSentAt >= SD_FOUND_RESEND_MS)) {
      const d = door(stood.key), f = feet();
      if (d && f && Math.hypot(f[0] - d[0], f[2] - d[2]) <= SD_FOUND_NEAR_M) {
        const [px, py] = stood.key.split(',').map(Number);
        if (sendFound({ s: stood.s, px, py }, worldRoom(px, py))) { foundSentAt = t; foundSentS = stood.s; }
      }
    }
    // SD19: A FOUND HOLLOW'S LAST HOUR, said to the realm once (its place known - or the world offering none: the region's name)
    if (phase === 'found' && rec && hourSaidS !== rec.s && Number.isFinite(rec.until) && rec.until > t && rec.until - t <= SD_HOUR_LEFT_MS) {
      const hh = hollowOf(rec);
      if (hh || (memo && memo.s === rec.s && memo.none)) { hourSaidS = rec.s; say(sdHourLine({ name: hh?.loc?.name, near: hh?.site?.cityName || '', region: regionName(rec.r) || '' })); }
    }
    sayOwed(t);
  }

  return {
    heard,
    frame,
    /** The record as last heard (null before the hub's first word). */
    record: () => rec,
    /** The Hollow standing in the world now - `{ s, site, loc, key }` - or null. */
    hollow: () => (stood ? (memo && memo.s === stood.s ? memo : { s: stood.s, key: stood.key, loc: stood.loc }) : null),
    /** Is this location the Hollow (any slot's - a save from an older one is still a Hollow)? */
    isHollow: (loc) => !!loc?.superTier && Number.isSafeInteger(loc?.sdSlot),
    /** The phase of the record now (relay clock). */
    phase: () => sdPhase(rec, now()),
    /** SD2c: the held map's ring while the Hollow is news - found, or collapsing after the kill (systems/sdOmen.js
     *  sdMapMark) - or null: a Hollow that has only risen is a find. */
    mapMark: () => sdMapMark(rec, stood && memo && memo.s === stood.s ? memo : null, now()),
    /** SD2c: the omen's column over the Hollow standing now - `{ hollow, light }`, its light 0..1 (sdOmenLight) - or null. */
    omen() {
      const h = stood && memo && memo.s === stood.s && rec?.s === stood.s ? memo : null;
      const light = h ? sdOmenLight(rec, now()) : 0;
      return light > 0 ? { hollow: h, light } : null;
    },
    /** SD2c: "Any news?" asked at `here` (my map pixel) - the taverns' word of the Hollow in its city, or null (sdRumor). */
    rumor: (here, session, o) => sdRumor(rec, stood && memo && memo.s === stood.s ? memo : null, now(), here, session, o),
  };
}
