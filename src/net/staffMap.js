// @ts-check
// STAFF-MAP (2026-10-24, mob: "were is the map too?", "also need the map done as well cant see players far", "need esp to be
// far as possible"; design doc "DFO Staff Panel: design", Flat map - mob 2026-10-22: "flat map work per region?", "then we
// can just select regions?") - THE STAFF PANEL'S REGION MAP, the game's half. The Staff Panel names one region; the game
// holds one more link, to that region's channel (net/wire.js chatRegionRoom), and hands the panel the travellers' marks
// the room keeps (TV3: a map pixel, its fraction, the way they go, the relay's name and account beside it).
//
// HIDDEN OR NOTHING. The link says hello only on a HIDDEN token - the game's own minter mints one while Hide me is on
// (server-account/src/staffHidden.js hiddenToken) - so a region's players never see a staff member arrive: the relay
// keeps a hidden socket out of the roster, the joins and the fan (server/src/staffHidden.js). A token that is not hidden
// is never sent (the link stays out, and the panel is told `hide`); the relay itself is unchanged.
//
// WHAT IT CANNOT SEE (said on the panel's page, never hidden): a mark is a traveller's own - a player indoors or in a
// dungeon sends none, a standing one refreshes every TRAV_KEEPALIVE_MS, and one alone in their region sends nothing
// until someone they can see arrives (wire.js TV3); a mark older than TRAV_STALE_MS is gone.
import { OnlineSession, peerId, peerSecret } from './online.js';
import { chatRegionRoom, CHAT_REGION_COUNT, TRAV_STALE_MS, TRAV_WELCOME_MAX, TRAV_MODES } from './wire.js';
import { tokenBodyOf, TOKEN_MAX_CHARS } from './identityToken.js';
import { REGION_NAMES } from '../formats/mapsTables.js';
import { hiddenSeat } from './staffHook.js';

/** The least time between two answers the panel is sent while marks move (ms). */
export const STAFF_MAP_SEND_MS = 1000;

/** Whether an identity token names a hidden staff socket (`hd: 1`) - read off its body alone; the relay verifies it.
 *  @param {unknown} tok */
export function tokenHidden(tok) {
  if (typeof tok !== 'string' || tok.length > TOKEN_MAX_CHARS) return false;
  try {
    const b = tokenBodyOf(tok).replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(globalThis.atob(b + '='.repeat((4 - (b.length % 4)) % 4)))?.hd === 1;
  } catch { return false; }
}

/** The game's own minter, handing on only a hidden token: one that is not is never sent, and the link's hello goes
 *  without (the relay refuses it) under a why the session reads as final (online.js tokenRetryable) - Hide me pressed
 *  later opens the link again (`relink`). `heard(hidden)` says which each mint was. Its keeping (`opened`, `unopened`,
 *  `holds`, `coolMs`) is the minter's own.
 *  @param {any} minter @param {(hidden: boolean) => void} heard */
export function hiddenOnly(minter, heard) {
  let why = /** @type {string|null} */ (null);
  const mint = async (/** @type {string|null} */ room) => {
    const tok = await minter(room);
    if (tokenHidden(tok)) { why = null; heard(true); return tok; }
    why = tok ? 'auth' : minter.lastWhy ?? 'refused';
    heard(!tok);   // no token at all is the service's refusal, not Hide me off
    return null;
  };
  return Object.defineProperties(mint, Object.getOwnPropertyDescriptors({   // descriptors: lastWhy read live, never copied once
    get lastWhy() { return why; },
    coolMs: () => minter.coolMs?.() ?? 0,
    holds: (/** @type {string|null} */ room) => !!minter.holds?.(room),
    opened: (/** @type {string|null} */ room, /** @type {string} */ tok) => minter.opened?.(room, tok),
    unopened: (/** @type {string|null} */ room, /** @type {string} */ tok) => minter.unopened?.(room, tok),
  }));
}

const NOTED = Symbol('staff-noted');

/** The game's own minter, every token handed on as it came, each one's hidden mark said to `heard` - so the game knows
 *  whether its links are hidden now (Hide me) without asking the panel. Marked, so it is wrapped once. Its keeping is the
 *  minter's own. @param {any} minter @param {(hidden: boolean) => void} heard */
export function noteHidden(minter, heard) {
  if (minter?.[NOTED]) return minter;
  const mint = async (/** @type {string|null} */ room) => { const tok = await minter(room); if (tok) heard(tokenHidden(tok)); return tok; };
  return Object.defineProperties(mint, Object.getOwnPropertyDescriptors({
    [NOTED]: true,
    get lastWhy() { return minter.lastWhy ?? null; },
    coolMs: () => minter.coolMs?.() ?? 0,
    holds: (/** @type {string|null} */ room) => !!minter.holds?.(room),
    opened: (/** @type {string|null} */ room, /** @type {string} */ tok) => minter.opened?.(room, tok),
    unopened: (/** @type {string|null} */ room, /** @type {string} */ tok) => minter.unopened?.(room, tok),
    ahead: (/** @type {string|null} */ room, /** @type {number} */ withinMs) => !!minter.ahead?.(room, withinMs),
    forget: () => minter.forget?.(),
  }));
}

/** A region index the politic map has, or null. @param {unknown} r */
export const regionOf = (r) => (Number.isInteger(r) && /** @type {number} */ (r) >= 0 && /** @type {number} */ (r) < CHAT_REGION_COUNT ? /** @type {number} */ (r) : null);

/**
 * THE MAP'S LINK. `main()` the game's presence session (its relay and its minter); `post(m)` hands the panel an answer.
 * @param {{ main: () => any, post: (m: object) => void, Session?: any, WS?: any, now?: () => number }} deps
 */
export function createStaffMap({ main, post, Session = OnlineSession, WS = globalThis.WebSocket, now = () => Date.now() }) {
  let region = /** @type {number|null} */ (null), link = /** @type {any} */ (null), shown = false;
  /** id -> { mark, at } - each mark with when it was taken (its age at the welcome counted in). */
  const book = new Map();
  let dirty = false, sentAt = -Infinity;
  const close = () => { link?.leave(); link = null; book.clear(); shown = false; dirty = true; };
  /** @param {any} f @param {number} ageS */
  const keep = (f, ageS = 0) => { if (f?.p) book.set(f.id, { f, at: now() - ageS * 1000 }); else if (f?.id) book.delete(f.id); dirty = true; };
  const open = (/** @type {number} */ r) => {
    const m = main();
    if (!m?.url || typeof m.mintToken !== 'function') return;
    link = new Session({ url: m.url, name: 'Spectator', id: peerId(null), secret: peerSecret(null), presence: false, wire2: true,
      mintToken: hiddenOnly(m.mintToken, (/** @type {boolean} */ h) => { if (shown === h) { shown = !h; dirty = true; } }),
      // the hidden seat (staffHook.js hiddenSeat): a hello without its hidden token there is closed, never shown
      WebSocketImpl: hiddenSeat(WS) });
    link.onTravellerRoom = (/** @type {any[]} */ list) => { book.clear(); for (const f of list.slice(0, TRAV_WELCOME_MAX)) keep(f, f.ag ?? 0); dirty = true; };
    link.onTraveller = (/** @type {any} */ f) => keep(f);
    link.onTravellerLeft = (/** @type {string} */ id) => { book.delete(id); dirty = true; };
    link.join(/** @type {string} */ (chatRegionRoom(r)));
  };
  const answer = () => {
    const t = now();
    const list = [];
    for (const [id, { f, at }] of book) {
      const age = t - at;
      if (age > TRAV_STALE_MS) { book.delete(id); continue; }
      const p = f.p;
      list.push({ id, sub: f.sub ?? null, name: f.name, px: p.px + p.fx / 256, py: p.py + p.fy / 256, way: TRAV_MODES[p.m] ?? 'foot', road: p.tv === 1, ageS: Math.floor(age / 1000) });
    }
    return { dfoStaff: 'map', region, name: region == null ? null : REGION_NAMES[region] ?? null, state: region == null ? 'off' : shown ? 'hide' : link?.status ?? 'off', list };
  };
  return {
    /** The panel's pick: a region index to watch, or null to stop. Another region switches. @param {unknown} r */
    pick(r) {
      const want = regionOf(r);
      if (want === region && (want === null || link)) { dirty = true; return; }
      close();
      region = want;
      if (want !== null) open(want);
    },
    /** The region names, in the politic map's order - the panel's list. */
    regions: () => REGION_NAMES.slice(0, CHAT_REGION_COUNT),
    /** Hide me or Show myself: the link opened again on a fresh token (a shown game's stays out). */
    relink() { const r = region; close(); if (r !== null) open(r); },
    /** The game's frame: the link ticked, and the panel told at most once a STAFF_MAP_SEND_MS what changed. */
    tick() {
      link?.tick();
      const t = now();
      if (region === null || (!dirty && t - sentAt < 10_000) || t - sentAt < STAFF_MAP_SEND_MS) return;
      dirty = false; sentAt = t;
      post(answer());
    },
    answer,
  };
}
