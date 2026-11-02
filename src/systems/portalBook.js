// @ts-check
// PORTAL-BOOK (2026-10-31): the house doors a character's Portal Stones
// open on (bible/06-Systems/Portal-Stone.md PORTAL-BOOK). A spot is kept from inside a house the player could walk into -
// their home, their guild's hall, a friend's home - and is the front door outside it. One stone opens a portal there
// (scenes/portalStoneHost.js openToSpot). The spots are the character's (`portalBook` on the save), never the item's.
// Pure: no clock, no DOM, no network. Not a DFU member - Ledger A.
import { PORTAL_BOOK_TEMPLATE } from './gate/gateSpoils.js';
import { registerItemUseHandler } from './item/itemTemplates.js';
import { t } from './textManager.js';
import { POSE_BOUND, POSE_Y_BOUND, worldPixelOk } from '../net/wire.js';

/** The most spots one book keeps. */
export const PORTAL_BOOK_MAX = 10;
/** The kinds of house a spot is kept at. */
export const PORTAL_BOOK_KINDS = Object.freeze(['home', 'hall', 'friend']);
/** The longest name and town a spot carries. */
export const PORTAL_SPOT_NAME_MAX = 60;
export const PORTAL_SPOT_TOWN_MAX = 40;
/** World units per map pixel (MapsFile.WorldMapTerrainDim x 128, streamingWorld.js NATIVE_PIXEL). */
const NATIVE_PIXEL = 32768;

/** Whether a native [x, y, z] (the camps' wire frame) stands on map pixel `d` - streamingWorld.js worldCoordToMapPixel. */
export const nativeOnPixel = (/** @type {number[]} */ a, /** @type {number[]} */ d) => Math.floor(a[0] / NATIVE_PIXEL) === d[0] && 499 - Math.floor(a[2] / NATIVE_PIXEL) === d[1];
/** Whether `a` is a native point of the wire's law. */
export const nativePointOk = (/** @type {unknown} */ a) => Array.isArray(a) && a.length === 3 && a.every(Number.isFinite)
  && Math.abs(a[0]) <= POSE_BOUND && Math.abs(a[2]) <= POSE_BOUND && Math.abs(a[1]) <= POSE_Y_BOUND;

const textOk = (/** @type {unknown} */ s, /** @type {number} */ max, empty = false) => typeof s === 'string' && (empty || s.length > 0) && s.length <= max && !/[\u0000-\u001f]/.test(s);
const uint = (/** @type {unknown} */ v) => Number.isSafeInteger(v) && /** @type {number} */ (v) >= 0 && /** @type {number} */ (v) <= 0xffffffff;

/**
 * A kept spot, or null when any field is outside its law: `k` its kind, `n` whose (a friend's handle, another guild's
 * name; empty for my own home and my guild's hall), `t` its town, `m` the
 * town's map id and `b` the building's key (one spot a house), `d` the map pixel, `a` the landing outside the front door
 * (native, on that pixel), `w` the facing.
 * @param {any} s
 */
export function readPortalSpot(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return null;
  if (!PORTAL_BOOK_KINDS.includes(s.k) || !textOk(s.n, PORTAL_SPOT_NAME_MAX, s.k !== 'friend') || (s.k === 'home' && s.n !== '') || !textOk(s.t, PORTAL_SPOT_TOWN_MAX)) return null;
  if (!uint(s.m) || !uint(s.b)) return null;
  if (!Array.isArray(s.d) || s.d.length !== 2 || !s.d.every(Number.isInteger) || !worldPixelOk(s.d[0]) || !worldPixelOk(s.d[1])) return null;
  if (!nativePointOk(s.a) || !nativeOnPixel(s.a, s.d) || !Number.isFinite(s.w)) return null;
  return { k: s.k, n: s.n, t: s.t, m: s.m, b: s.b, d: [s.d[0], s.d[1]], a: [s.a[0], s.a[1], s.a[2]], w: s.w };
}
/** A book as a save holds it: its lawful spots, one a house, at most PORTAL_BOOK_MAX. */
export function readPortalBook(/** @type {unknown} */ raw) {
  const out = [];
  for (const s of Array.isArray(raw) ? raw : []) {
    const spot = readPortalSpot(s);
    if (spot && !out.some((o) => o.m === spot.m && o.b === spot.b) && out.length < PORTAL_BOOK_MAX) out.push(spot);
  }
  return out;
}

/**
 * The spot of the house the player stands in, or null - none to keep: not inside a house, or one no player owns.
 * `home` the online home the visit holds (onlineHomes.js homeAt: `own`, `owner`, `hall`), `deed` whether a Daggerfall
 * deed in this save owns the building; `town` its name; `at` the landing outside its front door (native) and `yaw`.
 * @param {{ home?: any, deed?: boolean, mapId: number, buildingKey: number, town: string, pixel: { x: number, y: number }, at: number[], yaw: number }} p
 */
export function portalSpotOf({ home = null, deed = false, mapId, buildingKey, town, pixel, at, yaw }) {
  const k = home?.hall ? 'hall' : home?.own || (!home && deed) ? 'home' : home ? 'friend' : null;
  if (!k) return null;
  const n = k === 'hall' ? (home.member ? '' : String(home.hall.name ?? '')) : k === 'home' ? '' : String(home.owner ?? '');
  return readPortalSpot({ k, n: n.slice(0, PORTAL_SPOT_NAME_MAX), t: String(town ?? '').slice(0, PORTAL_SPOT_TOWN_MAX), m: mapId >>> 0, b: buildingKey >>> 0, d: [pixel?.x, pixel?.y], a: at, w: yaw });
}

/** A spot as the book lists it, in the player's language: "Your home in Daggerfall". */
export function portalSpotLabel(/** @type {any} */ s) {
  const town = s.t, name = s.n;
  if (s.k === 'home') return t('portal.book.home', 'Your home in {town}', { town });
  if (s.k === 'friend') return t('portal.book.friend', "{name}'s home in {town}", { name, town });
  return name ? t('portal.book.hall', "{name}'s hall in {town}", { name, town }) : t('portal.book.myHall', "Your guild's hall in {town}", { town });
}

/**
 * THE KEEP: `spot` written into `book` (a copy - the book is never changed in place). The same house again moves its
 * spot where it was in the list. Answers `{ book, again }`, or `{ refused }`: 'spot' (outside its law), 'full'.
 * @param {any[]} book @param {any} spot
 */
export function keepPortalSpot(book, spot) {
  const s = readPortalSpot(spot);
  if (!s) return { refused: 'spot' };
  const list = readPortalBook(book);
  const i = list.findIndex((o) => o.m === s.m && o.b === s.b);
  if (i >= 0) { list[i] = s; return { book: list, again: true }; }
  if (list.length >= PORTAL_BOOK_MAX) return { refused: 'full' };
  return { book: [...list, s], again: false };
}
/** The book without its `i`th spot (a copy). */
export const forgetPortalSpot = (/** @type {any[]} */ book, /** @type {number} */ i) => readPortalBook(book).filter((_, j) => j !== i);

/** The book's words, in the player's language. */
export const PORTAL_BOOK_TEXT = Object.freeze({
  title: () => t('portal.book.title', 'Portal Book'),
  stones: (/** @type {number} */ n) => t('portal.book.stones', '{n, plural, one {You carry # Portal Stone.} other {You carry # Portal Stones.}}', { n }),
  empty: () => t('portal.book.empty', 'No spots kept. Open the book inside a house to keep its door.'),
  keep: () => t('portal.book.keep', 'K - keep this house'),
  forget: () => t('portal.book.forget', 'F - forget a spot'),
  forgetWhich: () => t('portal.book.forgetWhich', 'Forget which spot?'),
  close: () => t('portal.book.close', 'Esc - close'),
  kept: (/** @type {string} */ spot) => t('portal.book.kept', 'Kept: {spot}.', { spot }),
  moved: (/** @type {string} */ spot) => t('portal.book.moved', 'Spot moved: {spot}.', { spot }),
  forgot: (/** @type {string} */ spot) => t('portal.book.forgot', 'Forgot: {spot}.', { spot }),
  full: () => t('portal.book.full', 'The book is full. Forget a spot first ({max} at most).', { max: PORTAL_BOOK_MAX }),
  noHouse: () => t('portal.book.noHouse', "Keep a spot from inside your home, your guild hall or a friend's home."),
  noStone: () => t('portal.book.noStone', 'You have no Portal Stone. Buy them at any shop.'),
  indoors: () => t('portal.book.indoors', 'Go outside to open a portal. Keep this house with K.'),
});
/** The book's lines on its item card. */
export const portalBookLines = () => [
  t('portal.book.line1', 'Keeps up to {max} house doors.', { max: PORTAL_BOOK_MAX }),
  t('portal.book.line2', 'Use it inside a house to keep its door.'),
  t('portal.book.line3', 'One Portal Stone opens a portal to a kept door.'),
];

/** The pack's Use: the book handed to the host's portal door, as the stone is (the readers route 'openPortal'). */
registerItemUseHandler(PORTAL_BOOK_TEMPLATE, (item) => ({ kind: 'openPortal', item }));
