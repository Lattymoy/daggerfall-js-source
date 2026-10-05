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
// stands in its dungeon (TTL1's own law for a spawn), and goes when they leave.
//
// Pure but for its seams, which the world host hands in (scenes/world.js). Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { sdPhase, sdStands, sdFoundLine, sdFellLine, sdFadeLine, SD_FOUND_NEAR_M, SD_FOUND_RESEND_MS } from '../net/sdLaw.js';
import { findSdSite, pickSdTemplate, sdHollowLocation } from '../systems/sdSite.js';
import { worldRoom } from '../net/wire.js';

/** A line the scan has not been able to place yet is said with the region's name after this long, never lost. */
export const SD_LINE_WAIT_MS = 30_000;

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
 * }} o
 */
export function createSdHost({ now, scan, warmScan = () => {}, cities, templates, where, stand, unstand, inside, door, feet, sendFound, say, regionName = () => '' }) {
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
    if (rec.ph === 'gone' && rec.fellAt == null && was && was.s === rec.s && was.ph !== 'gone') owed.push({ kind: 'fade', rec, at: t });
  }

  /** The lines owed, said once the Hollow's place is known - or, past SD_LINE_WAIT_MS, with the region's name. */
  function sayOwed(t) {
    while (owed.length) {
      const o = owed[0];
      const h = hollowOf(o.rec);
      if (!h && t - o.at < SD_LINE_WAIT_MS && !(memo && memo.s === o.rec.s && memo.none)) return;
      owed.shift();
      const near = h?.site?.cityName || regionName(o.rec.r) || 'the Iliac Bay';
      const name = h?.loc?.name || 'a Super Dungeon';
      if (o.kind === 'found') say(sdFoundLine({ who: o.rec.fb || 'Someone', near }));
      else if (o.kind === 'fell') say(sdFellLine({ top: o.rec.top || 'Someone', n: o.rec.n ?? 1, name }));
      else say(sdFadeLine({ name }));
    }
  }

  /** ONE FRAME: the Hollow stood or taken down as its record's phase says, the find said at its door, the owed lines. */
  function frame() {
    const t = now();
    const phase = sdPhase(rec, t);
    const h = sdStands(phase) ? hollowOf(rec) : null;
    // what stood and should not: down - unless the player stands in it (the ground is never pulled from under them)
    if (stood && (!h || h.s !== stood.s) && !inside(stood.loc)) { unstand(stood.key); stood = null; }
    if (h && !stood) { stand(h.key, h.loc); stood = { s: h.s, key: h.key, loc: h.loc }; }
    // the find: at its door, while the record says risen - again every SD_FOUND_RESEND_MS until the hub's word moves it
    if (phase === 'risen' && stood && stood.s === rec?.s && (foundSentS !== stood.s || t - foundSentAt >= SD_FOUND_RESEND_MS)) {
      const d = door(stood.key), f = feet();
      if (d && f && Math.hypot(f[0] - d[0], f[2] - d[2]) <= SD_FOUND_NEAR_M) {
        const [px, py] = stood.key.split(',').map(Number);
        if (sendFound({ s: stood.s, px, py }, worldRoom(px, py))) { foundSentAt = t; foundSentS = stood.s; }
      }
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
  };
}
