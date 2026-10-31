// @ts-check
// ETHER-CROSSING (2026-10-11, the owner: "Sail far enough and you are prompted to travel into the open sea";
// bible/03-World/Eltheric-Ocean.md ETHER-CROSSING) - THE CROSSING: when it is offered, what it asks, what it takes. Pure: the
// world host (scenes/world.js) asks it of the helm's pixel and sails the voyage.
//
// OFFERED at a helm, under way or not, with no enemy near and no other player aboard: OUT in the crossing waters on
// every row (world/ethericSea.js crossingWaters: west of CROSS_X, CROSS_LAND_PX pixels from land and CROSS_SEA_PX from
// the sea the world sails, `createCrossSea`) - and HOME in the Veil. Refused, a way is not asked again until the ship
// has left its waters (`createCrossingGate`); waters a journey sails into are its own, asked only where it arrives.
//
// THE VOYAGE takes CROSS_DAYS (the clock's, as a journey's), and carries the captain, the ship at whose helm they stand,
// her crew and her hold: out to the open water off Veilhaven's quay, her bow on it; home to the Bay's waters the last
// crossing out set sail from (the ledger's), or the open Abecean off the Bay's mouth.

import {
  crossingWaters,
  inVeil,
  inEtherLaw,
  landfall,
  HOME_WATERS,
  ETHER_WORD,
  ETHER_SEA_NAME,
  CROSS_LAND_PX,
  CROSS_SEA_PX,
} from '../../world/ethericSea.js';
import { NATIVE_PIXEL } from '../seaRaiders.js'; // SEA-ROWS: a lane's way is in native units
import { t } from '../textManager.js'; // ETHER-WILD: the open sea's warning, in the player's language (L10N4)
import { inBay } from '../../world/tamriel/tamrielFrame.js'; // AUDIT FB1029g SEA F9: the words name the Bay only in it

/** The voyage, either way (days). */
export const CROSS_DAYS = 3;
/** How often the helm's waters are asked (s). */
export const CROSS_CHECK_S = 0.5;

/**
 * A MAP PIXEL'S DISTANCE TO THE NEAREST LAND (Chebyshev, map pixels), out to `reach` (CROSS_LAND_PX; Infinity past it) - by
 * the map's one water law (`seaPixel(x, y)`: scenes/world.js's), each ring of pixels about it in turn; the last pixel's
 * answer kept (the helm asks the same pixel every CROSS_CHECK_S). HOST-SPLIT (SEA VENTURES, 2026-10-22): out of bootWorld
 * whole. Answers `(px, py) => distance`.
 */
export function createCrossLand(seaPixel, reach = CROSS_LAND_PX) {
  let at = null;
  return (px, py) => {
    const key = `${px},${py}`;
    if (at?.key === key) return at.d;
    let d = Infinity;
    ring: for (let r = 0; r <= reach; r++) {
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) === r && !seaPixel(px + dx, py + dy)) {
            d = r;
            break ring;
          }
        }
    }
    at = { key, d };
    return d;
  };
}
/** How long one check of the sailed sea may walk lanes' ways no check has asked for (ms) - one at the least. */
export const CROSS_WALK_MS = 4;
/**
 * THE SEA THE WORLD SAILS (SEA-ROWS): a map pixel's distance (pixels, from its middle) to the nearest lane's way or the
 * serpent's ring, Infinity past `reach` - `lanes()` the world's lanes' book (scenes/naval/worldLanes.js), `site()` the
 * day's serpent site or null. Null (not measured) until the book is `settled` and every lane whose bound holds the pixel
 * (`near`, padded by the reach) has its way: a way walked cold is the lanes' own search, so a check walks CROSS_WALK_MS
 * of them and the next the rest. The last pixel's answer kept. Answers `(px, py) => distance | null`.
 */
export function createCrossSea(lanes, site, reach = CROSS_SEA_PX, now = () => performance.now()) {
  const walked = new WeakSet();
  let at = null;
  return (px, py) => {
    const book = lanes(),
      s = site() ?? null;
    if (!book?.settled()) return null;
    const list = book.all();
    if (at?.px === px && at.py === py && at.s === s && at.list === list) return at.d;
    const x = px + 0.5,
      y = py + 0.5,
      here = { x: px, y: py },
      t0 = now();
    let d = s?.ring ? Math.max(0, Math.hypot(x - s.ring.cx, y - s.ring.cy) - s.ring.r) : Infinity,
      whole = true,
      fresh = 0;
    for (const lane of list) {
      if (!book.near(lane, here, reach + 1)) continue;
      if (!walked.has(lane)) {
        if (fresh++ && now() - t0 > CROSS_WALK_MS) {
          whole = false;
          continue;
        }
        walked.add(lane);
      }
      const pts = book.way(lane)?.pts ?? [];
      for (let i = 1; i < pts.length; i++) d = Math.min(d, segmentPx(x, y, pts[i - 1], pts[i]));
    }
    if (!whole) return null;
    at = { px, py, s, list, d: d > reach ? Infinity : d };
    return at.d;
  };
}
/** A point's distance (map pixels; y south, a pixel's middle at +0.5) to a way's leg between two native points. */
function segmentPx(x, y, a, b) {
  const ax = a.x / NATIVE_PIXEL,
    ay = 500 - a.z / NATIVE_PIXEL,
    dx = b.x / NATIVE_PIXEL - ax,
    dy = 500 - b.z / NATIVE_PIXEL - ay;
  const t = dx || dy ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}
/** The way a helm's waters offer: 'out' (the crossing waters), 'home' (the Veil), or null - undefined while the sea
 *  they lie in is not yet measured (no word: the gate keeps what it knew). `landPx` the pixel's distance to the nearest
 *  land, `seaPx` to the sea the world sails, or its measure (createCrossSea's) - asked only where the land allows. */
export function crossingWayAt(px, py, landPx, seaPx) {
  if (inVeil(px, py)) return 'home';
  if (!crossingWaters(px, py, landPx, Infinity)) return null;
  const sea = typeof seaPx === 'function' ? seaPx(px, py) : seaPx;
  if (sea === null) return undefined;
  return crossingWaters(px, py, landPx, sea) ? 'out' : null;
}

/** THE GATE: `offer(way, journey)` answers whether to ask now - a way not asked since the ship came into its waters;
 *  `asked(way)` remembers it asked until the waters are left (`offer(null)` - or another way's waters - forgets it).
 *  X1: the host marks it asked only when the box shows; `refused(way)` whether a refusal is said - once in its waters.
 *  SEA-ROWS: told the waters at every check (undefined, unmeasured: nothing); `journey` is Travel Options, null when off.
 *  Waters she comes into under way are the journey's, marked asked; when its `arrived` count moves there, she is asked. */
export function createCrossingGate() {
  let asked = null,
    ours = false,
    said = null,
    arrivals = null;
  return {
    offer(way, journey = null) {
      if (way === undefined) return false;
      const under = !!journey?.isTravelActive,
        n = journey?.arrived ?? 0;
      if (way !== said) said = null;
      if (way !== asked || (ours && n !== arrivals)) {
        asked = null;
        ours = false;
      } // left them, or a journey arrived in them
      arrivals = n;
      if (under && way && asked == null) {
        asked = way;
        ours = true;
      }
      return !!way && asked == null;
    },
    asked(way) {
      asked = way ?? null;
      ours = false;
    },
    refused(way) {
      if (said === way) return false;
      said = way;
      return true;
    },
    get pending() {
      return asked;
    },
  };
}

/** Where a voyage makes landfall: out, off Veilhaven; home, the Bay's waters she set sail from, else the open Abecean
 *  (AUDIT CAPTAIN'S SEA X2: never a way out that lies in the Eltheric Ocean's own law). */
export function crossingTarget(way, from = null) {
  if (way === 'out') return landfall();
  return from && Number.isFinite(from.px) && Number.isFinite(from.py) && !inEtherLaw(from.px, from.py)
    ? { px: from.px, py: from.py }
    : { px: HOME_WATERS.px, py: HOME_WATERS.py };
}

/** A sentence in the question's rows: broken at spaces into lines of at most `width` characters (the rows above are as
 *  wide), a word longer than a line standing alone - so one key carries a whole sentence in every language. */
export function questionRows(text, width = ROW_CHARS) {
  const rows = [];
  let row = '';
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    if (row && row.length + 1 + word.length > width) {
      rows.push(row);
      row = word;
    } else row = row ? `${row} ${word}` : word;
  }
  if (row) rows.push(row);
  return rows;
}
/** The widest row of the question's own (its first lines' measure). */
export const ROW_CHARS = 56;
/** AUDIT FB1029g SEA F9: whether the words may name the Bay - `at` (the helm's waters out, the landfall's home) is on the
 *  Bay's own map. The crossing is asked west of Sumurset too, and the way home lands where it set out. */
const bayAt = (at) => !at || inBay(at.px ?? at.x, at.py ?? at.y);
/** The question, in rows (ui/yesNoBox.js). ETHER-WILD (2026-10-21): `pvp` - online, where the open sea past Veilhaven's
 *  peace is an open PvP zone (systems/wild/etherWild.js) - says so before the way out is taken. `at`: SEA F9's. */
export function crossingRows(way, { days = CROSS_DAYS, pvp = false } = {}, at = null) {
  const time = `${days} ${days === 1 ? 'day' : 'days'}`;
  return way === 'out'
    ? [
        `The ${bayAt(at) ? 'Abecean' : t('sea.cross.openSea', 'open sea')} runs empty to every horizon, and the stars`,
        'hang strangely low over the water. Sailors say that past',
        `here the sea is no longer the sea, but the ${ETHER_WORD}.`,
        '',
        `Set a course into the open sea? (${time}. Your ship,`,
        'its crew and hold go with you.)',
        ...(pvp
          ? [
              '',
              ...questionRows(
                t(
                  'sea.wild.crossWarn',
                  "Past Veilhaven's peace the open sea is an open PvP zone. Other players may attack you there.",
                ),
              ),
            ]
          : []),
      ]
    : [
        'Ahead the Veil thins, and through it, faint as a memory,',
        bayAt(at)
          ? 'lie the gray waters of the Iliac Bay.'
          : t('sea.cross.homeRow', 'lie the gray waters you set out from.'),
        '',
        `Set a course for home? (${time})`,
      ];
}
/** What the screen says at the landfall (`at`, SEA F9's: where she comes out). */
export const crossingWords = (way, at = null) =>
  way === 'out'
    ? `Three days out of sight of land, and then the stars came down to meet the sea. You have crossed into ${ETHER_SEA_NAME}. Veilhaven lies ahead.`
    : bayAt(at)
      ? 'The Veil closes astern, and the air smells of salt and tar again. The Iliac Bay, and home.'
      : t(
          'sea.cross.landfall',
          'The Veil closes astern, and the air smells of salt and tar again. You are back in the waters you set out from.',
        );
/** Why a crossing is not asked (said once in those waters; AUDIT CAPTAIN'S SEA X1: asked as soon as the deck is clear,
 *  as the words promise - the refusal once marked the way asked, and the question never came back in those waters). */
export const CROSS_REFUSED = Object.freeze({
  // VEIL-PARTY: her captain's party crosses with her (scenes/naval/veilParty.js); a stranger aboard holds her back - AUDIT
  // HORIZONTAL C7: and the words say so (it waited for "no one else", where her party may stay aboard)
  get passengers() {
    return t(
      'ether.cross.passengers',
      'Only your party can cross the Veil with you. The crossing waits until only your party is aboard.',
    );
  },
  hostile: 'Not with an enemy at your heels.',
});
/** AUDIT CAPTAIN'S SEA X2: a Yes to a question the waters no longer ask (a load, a new helm, waters left) - said, and no
 *  voyage. */
export const CROSS_STALE = 'The moment has passed. Return to the crossing waters to be asked again.';
/** AUDIT CAPTAIN'S SEA X9: a voyage that could not be made - the ship and her captain where they set out. */
export const CROSS_FAILED = 'The crossing failed. You are back where you started.';
