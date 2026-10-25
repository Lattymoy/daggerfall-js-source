// @ts-check
// STAFF-PANEL5-FOLLOW (2026-10-22, design doc "DFO Staff Panel: design", Invisible follow, In game: the staff view, and
// the weak spots "The panel must not lean on game internals that change between builds" and "No camera looks through the
// player's eyes yet") - THE GAME'S STAFF HOOK. Small, versioned, and the only door the Staff Panel uses into the game.
//
// It carries no combat and no movement code: it follows one player, by their account, and lets go. Following, it holds
// two sockets of its own - a hub link and, once the hub has said where, a link to the target's room - both on follow
// tokens the Staff Panel mints on its staff session (server-account/src/staffFollow.js, the claims `hd` and `fo`), never
// on the player's own login. Nothing it holds shows the staff member: the relay keeps a hidden spectator out of every
// list, count and fan (the hidden builder's half), and the host leaves its own room while the follow is locked
// (scenes/world.js). The camera copies the target only after the hub itself said `on` to this hook's hub link - the
// relay-checked flag: a token the relay did not verify as a follow is never told `on`, so a page script calling
// follow() moves no camera.
//
// THE PANEL'S DOOR (the extension's content script cannot reach this page's objects, so it is window messages, same
// window and origin only):
//   { dfoStaff: 'hook?' }                          -> { dfoStaff: 'hook', v: STAFF_HOOK_VERSION }  (an unknown v: the
//                                                     panel switches itself off with a clear message)
//   { dfoStaff: 'follow', sub }                    follow that account at once (another pick switches to it)
//   { dfoStaff: 'unlock' }                         let go
//   the hook asks { dfoStaff: 'token', sub, room } and the panel answers { dfoStaff: 'token', sub, room, tok } - a
//   follow token for that room (a token opens each room once), or tok null when the staff session refuses it.
//   { dfoStaff: 'relink' }                         STAFF-HIDE-TOGGLE (2026-10-23, mob: "need hide to be a toggle"): Hide
//                                                  me or Show myself was just pressed - the game leaves every room it holds
//                                                  and opens each again on a fresh token (scenes/staffFollowHost.js
//                                                  relinkGame), so the switch holds from now, not from its next connection.
//                                                  At most once a STAFF_RELINK_GAP_MS (a page script may post it too, and
//                                                  every relink is a mint and a hello a room); one asked inside the gap
//                                                  runs at its end. No new version: a hook before it ignores the word.
//   the game asks { dfoStaff: 'hide', on: false } and the panel answers { dfoStaff: 'hide', on: false, ok } - Hide me
//   turned off on the staff session, the panel's own Show myself (STAFF-CHAT-RED, `staffShowMe` below). Optional: a
//   panel older than it ignores the ask, and the game hears no answer.
// STAFF-VIEW1 (2026-10-23, mob: "np player esp in staff panel?", "i need staff panel to have esp"; design doc, In game:
// the staff view - the staff tags, scenes/staffViewHost.js). Two more, and no version bump: an existing message keeps
// its meaning, and a panel that does not know these leaves them unanswered (tags then name the player alone):
//   the hook asks { dfoStaff: 'tags?' }            when the staff view turns on, on Shift+M and every 60 s while on
//   and the panel answers { dfoStaff: 'tags', dist, list: [{ sub, level, why, watch }] } - kept as validTags reads it:
//                                                  known fields only, ID_RE subs, TAGS_MAX rows, a why of TAG_WHY_MAX
//   the host posts { dfoStaff: 'act', act: 'follow', sub, name } after a tag click followed - the chat menu's act shape,
//   so the panel opens its card on the player the game follows (the panel acts on nothing it carries)
// STAFF-MAP (2026-10-24, mob: "also need the map done as well cant see players far"; net/staffMap.js). Two more, no version
// bump, as STAFF-VIEW1's:
//   { dfoStaff: 'regions?' }                       -> { dfoStaff: 'regions', names } - the politic map's region names, in order
// STAFF-EVENT (net/staffPlaces.js): the Events page's place picker - `places?` a region's named places, `here?` where I stand
//   { dfoStaff: 'places?', region }                -> { dfoStaff: 'places', region, name, list }
//   { dfoStaff: 'here?' }                          -> { dfoStaff: 'here', region, name, loc, place, px, py }
//   { dfoStaff: 'map?', region }                   watch that region (an index into names), or stop (null); the game answers
//                                                  { dfoStaff: 'map', region, name, state, list: [{ id, sub, name, px, py,
//                                                  way, road, ageS }] } on each change, at most once a STAFF_MAP_SEND_MS -
//                                                  state 'open' when its hidden link is in, 'hide' when Hide me is off
import { OnlineSession, peerId, peerSecret } from './online.js';
import { SOCIAL_ROOM, cellRoomOfWire, isCellRoom, isChatRoom, isSocialRoom } from './wire.js';
import { ID_RE, TOKEN_MAX_CHARS } from './identityToken.js';
import { noteRoom } from './staffFollow.js';
import { notePlace } from './staffTeleport.js';
import { staffPlaces, staffHere } from './staffPlaces.js';   // STAFF-EVENT: the Events page's place picker

/** The hook's version - the panel reads it and refuses a build it does not know. */
export const STAFF_HOOK_VERSION = 1;
/** STAFF-VIEW1: the panel's tags answer, as the game keeps it - rows at most, a flag's words at most, the urgencies, and
 *  the nameplate distances Your settings offers (m), 100 when the answer names none of them. */
export const TAGS_MAX = 200;
export const TAG_WHY_MAX = 80;
export const TAG_LEVELS = Object.freeze(['high', 'medium', 'low']);
export const NAMEPLATE_DISTS = Object.freeze([50, 100, 200, 350]);   // 350: mob 2026-10-24, "add esp for player to 350m", "its max"
export const NAMEPLATE_DIST = 100;
/** How long the hook waits for the panel's token before its link counts the room refused. */
export const STAFF_TOKEN_WAIT_MS = 5000;
/** STAFF-HIDE-TOGGLE: the least time between two relinks - AURA-LIVE's own gap between two hellos again (online.js
 *  REHELLO_GAP_MS). */
export const STAFF_RELINK_GAP_MS = 3000;
/** The name a follow's sockets say - the relay shows them to nobody, and the token's own name is the service's. */
const SPECTATOR = 'Spectator';
/** FOLLOW-GROUND-HINT: the longest room key or socket id a pick's hint may carry. */
const ROOM_HINT_MAX = 128;

/** STAFF-PANEL5-FOLLOW-FIX (the relay review's finding 18): a WebSocket class whose every room asks a hidden seat
 *  (`?hd=1`, server/src/staffHidden.js hiddenAsked) - the reserve over a full layer's cap, so the eye joins the target's
 *  layer rather than being walked to another, and a hello without its hidden token there is closed, never shown. Only
 *  the eye's: the reserve is HIDDEN_RESERVE seats a room however empty, and the hub holds every hidden staff game's link.
 *  @param {any} WS */
export const hiddenSeat = (WS) => WS && class extends WS {
  /** @param {string} url @param {any[]} more */
  constructor(url, ...more) { super(`${url}${url.includes('?') ? '&' : '?'}hd=1`, ...more); }
};

/** FOLLOW-OWN-ID (2026-10-24, mob: "need the follow dropping me to stop" - a follow put the staff member's own game
 *  offline, "online in another tab" on its room and its World tab): A FOLLOW'S LINKS ARE PEERS OF THEIR OWN. A session
 *  given no id takes the TAB's (online.js peerId, kept in the tab's storage) and its secret with it - the game's own
 *  links' - so the hook's hub link said hello on the hub with the game's id and the relay replaced the game's World tab
 *  (CLOSE_REPLACED, a reconnect's rule), and its eye did the same to the game's room wherever the two met; a game shown
 *  had the hidden eye refused instead (`id taken`, server/src/staffHidden.js), so a follow worked only hidden. Each link
 *  now mints a fresh id and secret no storage keeps (`peerId(null)`). */
const ownId = () => ({ id: peerId(null), secret: peerSecret(null) });

/** THE FOLLOW. `main()` the game's presence session (its relay's address) or null offline; `askToken(sub, room)` a
 *  follow token for a room, from the panel. Pure of any scene: the host reads `locked`, `view` and `place`.
 *  @param {{ main: () => any, askToken: (sub: string, room: string) => Promise<string|null>, Session?: any, WS?: any }} deps */
export function createStaffHook({ main, askToken, Session = OnlineSession, WS = globalThis.WebSocket }) {
  /** @type {string|null} */ let target = null;
  let on = false, note = /** @type {any} */ (null), room = /** @type {string|null} */ (null), ly = 0, seen = /** @type {any} */ (null);
  /** STAFF-PANEL5-FOLLOW-R2: the room `seen` was taken in - a pose is in its room's frame (an interior has its own, every
   *  cell shares the world's). @type {string|null} */
  let seenIn = null;
  let hub = /** @type {any} */ (null), eye = /** @type {any} */ (null);
  /** STAFF-PANEL5-FOLLOW-FIX (finding 1): the target's socket id, as a room said it (`in`) - a place room's roster names
   *  no account, so this is the one name its peers know them by. @type {string|null} */
  let pid = null;
  const close = () => { hub?.leave(); eye?.leave(); hub = null; eye = null; on = false; note = null; room = null; ly = 0; seen = null; pid = null; };
  const mint = (/** @type {string} */ sub) => (/** @type {string} */ r) => (sub === target ? askToken(sub, r) : Promise.resolve(null));
  /** The hub's word (net/staffFollow.js validFollowOut), for this follow's target alone. @param {any} f */
  function heard(f) {
    if (!f || f.sub !== target) return;
    if (f.k === 'on') on = true;
    // STAFF-PANEL5-FOLLOW-R2: the hub's newer word on their room wins over the pose seen before it (a fast travel, a door
    // out) - a pose seen after it leads again (tick)
    // STAFF-PANEL5-FOLLOW-R3: but a word naming the room that pose was seen in is no newer than it - the eye's own `in`
    // from the cell it just left, or a note sent before the crossing; dropping the pose on it sent the eye back while it
    // was on its way (a seam: two cells, every few frames, a token and a hello each). A note still wins once the eye's
    // new room has welcomed it and not shown them (gone back by a recall, say)
    else if (f.k === 'note') { note = f.p; const r = noteRoom(f.p); if (r) { room = r.room; ly = r.ly; if (r.room !== seenIn || eye?.welcomed) seen = null; } }
    else if (f.k === 'in') { room = f.room; ly = f.ly ?? 0; pid = f.id ?? pid; if (f.room !== seenIn) seen = null; }
    else if (f.k === 'gone') { room = null; seen = null; pid = null; }   // offline: the follow stands, and waits for their next note
    // 'out': the room keeps its socket until the hub's next note says where they went
  }
  /** The target as the room I watch from shows them, or null. */
  function peer() {
    if (!eye) return null;
    for (const p of eye.peers?.values?.() ?? []) if (p && (p.sub === target || (pid && p.id === pid))) return p.shown ?? p.pose ?? null;
    return null;
  }
  return {
    version: STAFF_HOOK_VERSION,
    /** Follow `sub` at once - another pick lets the last go. False for no account. FOLLOW-GROUND-HINT (2026-10-24, mob:
     *  "following from ground does not work", "panel open said locked never moved"): a pick off the staff member's own
     *  ground knows the room the target stands in and their socket there (`hint`), so the eye goes there at once instead
     *  of waiting on the hub's word of where they are - which never comes for a room a note cannot name (a dungeon, a
     *  building), nor before the target's game sends its first note. The hub's later word leads as ever.
     *  @param {unknown} sub @param {{ room?: unknown, id?: unknown, ly?: unknown } | null} [hint] */
    follow(sub, hint = null) {
      if (typeof sub !== 'string' || !ID_RE.test(sub)) return false;
      if (sub !== target) {
        close(); target = sub;
        const r = hint?.room;
        if (typeof r === 'string' && r.length > 0 && r.length <= ROOM_HINT_MAX && !isSocialRoom(r) && !isChatRoom(r)) {
          room = r; ly = Number.isInteger(hint?.ly) && /** @type {number} */ (hint?.ly) > 0 ? /** @type {number} */ (hint?.ly) : 0;
          pid = typeof hint?.id === 'string' && hint.id.length <= ROOM_HINT_MAX ? hint.id : null;
        }
      }
      return true;
    },
    /** FOLLOW-GROUND-HINT: whether the follow knows where the target is yet (a room to watch from). */
    where: () => room,
    /** Let go. */
    unlock() { close(); target = null; },
    /** Whether the camera is the target's: a follow the hub said `on` to. */
    locked: () => !!target && on,
    target: () => target,
    /** The room the follow watches from (a cell's or a world room's), or null while the hub has not said. */
    room: () => room,
    /** The target's pose (net/wire.js validPose) while their room shows them to me, else null. */
    view: () => (target && on ? peer() : null),
    /** Where the target's last note puts staff (net/staffTeleport.js notePlace) - the host's "spectator enter". */
    place: () => (target && on && note ? notePlace({ ...note, ...(room ? { rk: room } : {}) }) : null),
    /** The hub's word, as a session hands it (online.js onFollow). */
    heard,
    /** STAFF-VIEW1: the players the room I watch from draws - while a follow is locked the host has left its own room
     *  (its session's peers cleared), so these are the only players the staff view can tag. */
    peers: () => eye?.drawable?.() ?? [],
    /** FOLLOW-BODIES (mob, 2026-10-24: "cant see other players bodys"): the players around the target, for the scene to
     *  draw while the follow is locked - the room's draw less the target, whose eyes the camera is. */
    others: () => (eye?.drawable?.() ?? []).filter((/** @type {any} */ p) => !(p?.sub === target || (pid && p?.id === pid))),
    /** Every frame: the hub link held, and the room link where the hub says, standing on the target for range. */
    tick() {
      const m = main?.();
      if (!target || !m?.url) { if (hub || eye) close(); return; }
      if (!hub) {
        const h = hub = new Session({ url: m.url, name: SPECTATOR, ...ownId(), presence: false, mintToken: mint(target), WebSocketImpl: WS });
        h.onFollow = heard;
        // STAFF-PANEL5-FOLLOW-FIX (the relay review's finding 5): the hub's lease, kept on its link and handed to the eye
        // (as chatSafetyHost does for the game's own links) - with leaseDoor on, a lease room hears nothing else from it
        h.onLease = (/** @type {string} */ l) => { h.sendLease(l); eye?.sendLease(l); };
      }
      // STAFF-FOLLOW-SHARD (mob, 2026-10-23: "follow does not work"): the bus hops a hub link to its own shard
      // (net/hubShards.js), and a link on its shard is the hub's - asked back to the bus each frame, it hopped and came back
      // for ever, a token a hop, and was never told `on`
      if (!isSocialRoom(hub.room)) hub.join(SOCIAL_ROOM, null);
      hub.tick();
      if (!on) return;
      const v = peer();
      // STAFF-PANEL5-FOLLOW-R2: a pose leads only in the frame of the room the hub names (an interior's own pose names no
      // outdoor cell), and only while they stand in the room I saw them in - gone from it, the hub's word leads
      if (v && (eye.room === room || (isCellRoom(eye.room) && isCellRoom(room)))) { seen = v; seenIn = eye.room; }
      else if (!v && eye?.room === seenIn) seen = null;
      // outdoors the target's own pose names the next cell before their note does (a crossing is not a door)
      const want = seen && room && isCellRoom(room) ? cellRoomOfWire(seen.x, seen.z) ?? room : room;
      if (!want) return;
      if (!eye) { eye = new Session({ url: m.url, name: SPECTATOR, ...ownId(), presence: true, mintToken: mint(target), WebSocketImpl: hiddenSeat(WS) }); eye.leaseFrom(hub); }
      const at = seen ?? (Number.isFinite(note?.wx) ? { x: note.wx, y: note.wy, z: note.wz, yaw: 0, pitch: 0, mv: 0 } : null);
      if (eye.room !== want) { eye.layerHint = ly; eye.join(want, at); } else if (at) eye.sendPose(at);
      eye.tick();
    },
  };
}

/** STAFF-VIEW1: THE PANEL'S TAGS ANSWER, AS THE GAME KEEPS IT - known fields only, read strictly: the nameplate distance
 *  one Your settings offers (else NAMEPLATE_DIST), and for each account the most urgent flag the rows give it (the
 *  highest level wins, with its words) and whether a watch names it. A row with an account that is no account id, a
 *  level that is none of TAG_LEVELS, or nothing to show is dropped; past TAGS_MAX rows nothing is read; words that are
 *  not a string of TAG_WHY_MAX at most are no words. Null for an answer with no list. STAFF-VIEW-SWITCH (mob, 2026-10-25:
 *  "need option in setting to turn of monster lines and player esp to play normal"): Your settings' two switches, `esp`
 *  (the tags and the flag lines) and `lines` (an Admin's monster lines) - each on unless the answer says false, so a panel
 *  older than them changes nothing.
 *  @param {any} m @returns {{ dist: number, esp: boolean, lines: boolean, flags: Map<string, { level: string|null, why: string, watch: boolean }> }|null} */
export function validTags(m) {
  if (!Array.isArray(m?.list)) return null;
  /** @type {Map<string, { level: string|null, why: string, watch: boolean }>} */
  const flags = new Map();
  const rank = (/** @type {string|null} */ l) => (l ? TAG_LEVELS.indexOf(l) : TAG_LEVELS.length);
  for (const r of m.list.slice(0, TAGS_MAX)) {
    if (typeof r?.sub !== 'string' || !ID_RE.test(r.sub)) continue;
    const level = TAG_LEVELS.includes(r.level) ? r.level : null;
    const watch = r.watch === true;
    if (!level && !watch) continue;
    const why = level && typeof r.why === 'string' && r.why.length <= TAG_WHY_MAX ? r.why : '';
    const had = flags.get(r.sub);
    if (!had) { flags.set(r.sub, { level, why, watch }); continue; }
    if (rank(level) < rank(had.level)) { had.level = level; had.why = why; }
    had.watch = had.watch || watch;
  }
  return { dist: NAMEPLATE_DISTS.includes(m.dist) ? m.dist : NAMEPLATE_DIST, esp: m.esp !== false, lines: m.lines !== false, flags };
}

/** THE PANEL'S DOOR on a window (above) - `hookOf()` the follow; answers the panel's `hook?`, takes its `follow`,
 *  `unlock`, `relink` (STAFF-HIDE-TOGGLE: the host's `relink()`) and `tags` (STAFF-VIEW1), and hands back `askToken` for the follow's links and
 *  `panel()`, whether a panel has spoken on this page (a /tp follows on only then - with no panel no token comes, and its
 *  links would knock for nothing). Messages from another window or origin are not the panel's.
 *  STAFF-MAP: and `map?` and `regions?` for the region map (`mapOf()`, net/staffMap.js), whose answers go out by `post`.
 *  STAFF-EVENT: and `places?` and `here?` for the Events page, off `placesOf()` - the game's maps and my map pixel.
 *  @param {any} win @param {() => any} hookOf @param {{ setTimer?: typeof setTimeout, clearTimer?: typeof clearTimeout, relink?: (() => void) | null, now?: () => number, mapOf?: () => any, placesOf?: () => any }} [t] */
export function staffHookDoor(win, hookOf, { setTimer = setTimeout, clearTimer = clearTimeout, relink = null, now = () => Date.now(), mapOf = () => null, placesOf = () => null } = {}) {
  /** @type {Map<string, (tok: string|null) => void>} */
  const waiting = new Map();
  let seen = false;
  // STAFF-HIDE-TOGGLE: when the last relink ran, and the one waiting for the gap's end (one at most: it remakes every link)
  let relinkAt = -Infinity, relinkWait = /** @type {any} */ (null);
  const relinkNow = () => { relinkWait = null; relinkAt = now(); relink?.(); };
  /** STAFF-VIEW1: the panel's last tags answer (validTags), or null while it has given none. */
  let tags = /** @type {ReturnType<typeof validTags>} */ (null);
  const origin = win?.location?.origin;
  const post = (/** @type {object} */ m) => win.postMessage(m, origin);
  win?.addEventListener?.('message', (/** @type {any} */ e) => {
    const m = e?.data;
    if (e?.source !== win || e?.origin !== origin || !m || typeof m.dfoStaff !== 'string') return;
    const hook = hookOf();
    if (m.dfoStaff === 'hook?') { seen = true; post({ dfoStaff: 'hook', v: STAFF_HOOK_VERSION }); }
    else if (m.dfoStaff === 'follow') { seen = true; hook?.follow(m.sub); }
    else if (m.dfoStaff === 'unlock') hook?.unlock();
    else if (m.dfoStaff === 'relink' && relink && !relinkWait) { const wait = relinkAt + STAFF_RELINK_GAP_MS - now(); if (wait > 0) relinkWait = setTimer(relinkNow, wait); else relinkNow(); }
    else if (m.dfoStaff === 'token' && 'tok' in m) waiting.get(`${m.sub}|${m.room}`)?.(typeof m.tok === 'string' && m.tok.length <= TOKEN_MAX_CHARS ? m.tok : null);
    else if (m.dfoStaff === 'tags') tags = validTags(m) ?? tags;   // STAFF-VIEW1: an answer with no list keeps the last
    else if (m.dfoStaff === 'map?') { seen = true; mapOf()?.pick(m.region); }   // STAFF-MAP: a region to watch, or null
    else if (m.dfoStaff === 'regions?') post({ dfoStaff: 'regions', names: mapOf()?.regions() ?? [] });
    else if (m.dfoStaff === 'places?') post(staffPlaces(placesOf()?.maps, m.region));   // STAFF-EVENT: a region's places
    else if (m.dfoStaff === 'here?') post(staffHere(placesOf()?.maps, placesOf()?.pixel ?? null));   // STAFF-EVENT: where I stand
  });
  /** @param {string} sub @param {string} room @returns {Promise<string|null>} */
  const askToken = (sub, room) => new Promise((resolve) => {
    const k = `${sub}|${room}`;
    waiting.get(k)?.(null);
    const done = (/** @type {string|null} */ tok) => { if (waiting.get(k) === done) waiting.delete(k); clearTimer(timer); resolve(tok); };
    const timer = setTimer(() => done(null), STAFF_TOKEN_WAIT_MS);
    waiting.set(k, done);
    post({ dfoStaff: 'token', sub, room });
  });
  // STAFF-VIEW1: `tags()` the panel's last answer, `askTags()` the ask - to this page's own origin, as every word here
  return { askToken, panel: () => seen, tags: () => tags, askTags: () => post({ dfoStaff: 'tags?' }), post };
}

/** STAFF-CHAT-RED (2026-10-23, mob: "give me a option next to chat to chat as /red or myself at all times"): THE GAME'S
 *  ASK THAT HIDE ME GO OFF - an Admin hidden by the Staff Panel picked Me on the chat's switch (net/chatVoice.js) and
 *  said yes, and only the panel holds the staff session that can say Show myself (/v1/staff/hide { on: false }). Posted
 *  on this window to its own origin, as the door's own words are; the panel answers { dfoStaff: 'hide', on: false, ok }
 *  once the service has. Resolves the panel's ok - false when the service refused, or when no answer came in
 *  STAFF_TOKEN_WAIT_MS: no panel on this page, or one older than this ask, which ignores it.
 *  @param {any} [win] @param {{ setTimer?: typeof setTimeout, clearTimer?: typeof clearTimeout }} [t] @returns {Promise<boolean>} */
export function staffShowMe(win = globalThis.window, t = {}) { return staffHide(false, win, t); }

/** STAFF-HIDE-IN-GAME (2026-10-24, mob: "when i ment hide button for chat i ment for invisble", "and hide me and unlock
 *  button?"): Hide me ON or OFF asked from the game (its staff bar, ui/staffFollowBar.js), as staffShowMe asks it off -
 *  the panel's worker says it on the staff session (/v1/staff/hide { on }), audited there, and every game tab relinks.
 *  Resolves the panel's ok. @param {boolean} on @param {any} [win] @param {{ setTimer?: typeof setTimeout, clearTimer?: typeof clearTimeout }} [t] @returns {Promise<boolean>} */
export function staffHide(on, win = globalThis.window, { setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  const origin = win?.location?.origin;
  if (typeof origin !== 'string' || !origin || origin === 'null' || typeof win.postMessage !== 'function') return Promise.resolve(false);
  const want = on === true;
  return new Promise((resolve) => {
    const heard = (/** @type {any} */ e) => {
      const m = e?.data;
      if (e?.source === win && e?.origin === origin && m?.dfoStaff === 'hide' && m.on === want && 'ok' in m) done(m.ok === true);
    };
    const done = (/** @type {boolean} */ ok) => { clearTimer(timer); win.removeEventListener?.('message', heard); resolve(ok); };
    const timer = setTimer(() => done(false), STAFF_TOKEN_WAIT_MS);
    win.addEventListener?.('message', heard);
    win.postMessage({ dfoStaff: 'hide', on: want }, origin);
  });
}
