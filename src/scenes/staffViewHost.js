// @ts-check
// STAFF-VIEW1 (2026-10-23, mob: "np player esp in staff panel?", "i need staff panel to have esp", "i told you to add the
// opther parts to the menu?", "wtf u had all this build"; design doc "DFO Staff Panel: design", In game: the staff view -
// "Shift+M switches between the Overworld view and the ground view. In the Overworld every player has a name tag, and
// crowded tags group", "Tags show the player's name and their most urgent flag ... Admins also see the monsters each
// player owns, with lines to their owner. Moderators see report flags and WATCH on players they watch", "Clicking a tag
// follows that player at once, invisibly (Invisible follow), and opens a small card") - THE STAFF VIEW, out of bootWorld
// (HOST-SPLIT: THE HOSTS DO NOT GROW). The Overworld is the game's own travel view (mob: "lets use my tools overworld
// system to have as a base in game"), entered and left with Shift+M; the ground view is wherever the staff member stands,
// indoors and in dungeons too.
//
// WHO IS TAGGED. Every player the game receives - the followed room's while a follow is locked (the host has left its
// own room then, so its session holds nobody), else the game's own room's - through walls and past sight: nothing here
// asks the sight ray, the "Other players" distance or NAME_RANGE. The concealed and the open zone's Strangers wear their
// true names with a small 'concealed' (nothing is sent to them, so they cannot tell). On the ground the tags reach the
// nameplate distance (Your settings, 50/100/200/350 m) and the nearest STAFF_TAGS_MAX stand, the rest a "+N"; on the
// Overworld every one the travel view has, and every one it cut, is a tag too (STAFF-OW-TAGS). Under all of it the relay's
// own reach holds - poses only within its range, and its nearest rosters.
//
// WHAT A TAG SAYS. The name, then the panel's most urgent flag for that account (net/staffHook.js validTags - the account
// service filters the flags by role, so a Moderator's are reports and WATCH), asked when the view turns on, on Shift+M and
// every STAFF_TAGS_ASK_MS while it is on; and for an Admin (`dev`) alone the monsters that player's game stands here (the
// game's own puppets, keyed by their sender), with lines to their owner on the Overworld. No level: a peer's `lv` is their
// Renown, never their level.
//
// A TAG CLICK FOLLOWS AT ONCE, GAME SIDE, as a /tp's follow-on does (so the panel's old word that nothing acts without a
// press in the panel holds for the panel, not for this): the player's account is looked up by their socket - the room's
// own word, the chat links', the region's travellers, then the hub's search matched by socket - never by name, and
// followed (another tag switches the follow at once). Only a follow that took posts the panel the act that opens its
// card, to this page's own origin. The follow's tokens are the panel's to mint, audited and capped there. With no account
// found it says so and follows nobody.
//
// PLAYERS PAY ONE BOOLEAN A FRAME: with no Staff Panel spoken on the page nothing below runs, no element is made, and
// their Shift+M is the automap's as ever.
import { staffLineActs } from './chatSafetyHost.js';
import { ID_RE } from '../net/identityToken.js';
import { HUB_FIND_Q_MAX } from '../net/hubShards.js';
import { POSE_FAN_MAX } from '../net/wire.js';
import { NAMEPLATE_DIST } from '../net/staffHook.js';
import { projectToScreen } from '../player/tapRay.js';
import { worldViewportRect } from '../ui/hud/hudLarge.js';
import { multiply } from '../world/mat4.js';
import { STAFF_LINE, createStaffTags } from '../ui/staffTags.js';
import { createStaffFlatMapHost } from './staffFlatMapHost.js';   // STAFF-FLATMAP: Shift+N
import { t } from '../systems/textManager.js';

/** The ground view's tags at most, nearest first - the relay's own fan (every pose only for the nearest POSE_FAN_MAX). */
export const STAFF_TAGS_MAX = POSE_FAN_MAX;
/** STAFF-OW-TAGS: the Overworld's tags at most, nearest the eye first - a region's travellers (the welcome's own cap). */
export const STAFF_OW_TAGS_MAX = 256;
/** How often the panel's flags are asked again while the view is on (ms) - the panel's worker keeps its answer as long. */
export const STAFF_TAGS_ASK_MS = 60_000;
/** How long a tag click waits for the hub's search before it says no account was found (ms). */
export const STAFF_FIND_WAIT_MS = 5000;
/** An Admin's monster lines at most, a frame. */
export const STAFF_LINES_MAX = 200;
/** Tags this near one another on the screen are one box (px). */
export const STAFF_CROWD_PX = 28;
/** A tag stands this far over a player's feet (m) - over the tallest body's head. */
export const STAFF_TAG_HEAD_M = 2.1;
/** The accounts the hub's search found, kept by socket at most this many. */
const KNOWN_MAX = 256;

/** `peer:<id>` and `trav:<id>`, the travel view's player marks - the socket id, else null. @param {unknown} key */
const markId = (key) => { const m = typeof key === 'string' ? /^(?:peer|trav):(.+)$/.exec(key) : null; return m ? m[1] : null; };
/** A peer magically concealed, by their pose's `cv` (systems/combatVisuals.js peerDraw's bits). @param {any} d */
const concealedPose = (d) => ((d?.shown?.cv | 0) & 7) !== 0;
/** CROWD-CHIPS: a tag's box on the screen, as ui/staffTags.js draws it (12 px pixel font, a padded plate) - a crowd a
 *  count's chip, a lone tag its name over its words - estimated, never measured (no layout read in the frame). */
const TAG_CHAR_PX = 7, TAG_LINE_PX = 15, TAG_PAD_PX = 12, CROWD_WORDS_CHARS = 13;   // the head's words after the count, as English writes them
/** @param {{ members: Array<{ name?: string, line?: string }> }} g */
function tagBox(g) {
  if (g.members.length > 1) return { w: TAG_CHAR_PX * (String(g.members.length).length + CROWD_WORDS_CHARS) + TAG_PAD_PX, h: TAG_LINE_PX + 6 };
  const m = g.members[0];
  return { w: TAG_CHAR_PX * Math.max(String(m.name ?? '').length, String(m.line ?? '').length) + TAG_PAD_PX, h: TAG_LINE_PX * (m.line ? 2 : 1) + 6 };
}
/** Whether two tags' boxes would touch - each stands centred over its point, its bottom on it. @param {any} a @param {any} b */
function touching(a, b) {
  const A = tagBox(a), B = tagBox(b);
  return Math.abs(a.x - b.x) * 2 < A.w + B.w && Math.abs((a.y - A.h / 2) - (b.y - B.h / 2)) * 2 < A.h + B.h;
}
/** Tags this near one another on the screen as one box, in the order given (the nearest first leads) - and CROWD-CHIPS
 *  (2026-10-24, mob: "to many ocerlapping how would we clean thaT UP"; the card's pick "Merge close boxes, count only"):
 *  boxes that would still touch merged into the one that leads, until none does, so no two overlap.
 *  @param {Array<{ p: { x: number, y: number }, m: { id: string } }>} tagged */
export function crowded(tagged) {
  /** @type {Array<{ key: string, x: number, y: number, members: any[] }>} */
  const groups = [];
  for (const { p, m } of tagged) {
    const g = groups.find((o) => Math.hypot(o.x - p.x, o.y - p.y) <= STAFF_CROWD_PX);
    if (g) g.members.push(m);
    else groups.push({ key: m.id, x: p.x, y: p.y, members: [m] });
  }
  // a pass merges every box that touches the one that leads, then the next; a merge grows a lone tag to a chip, so
  // passes run until one merges nothing (a few at most: each takes boxes away)
  for (let merged = true; merged;) {
    merged = false;
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        if (!touching(groups[i], groups[j])) continue;
        groups[i].members.push(...groups[j].members);
        groups.splice(j--, 1);
        merged = true;
      }
    }
  }
  for (const g of groups) if (g.members.length > 1) g.key = `crowd:${g.key}`;
  return groups;
}
/** A tag's words under the name. @param {{ level: string|null, why: string, watch: boolean }|null} flag @param {number} monsters @param {boolean} concealed */
export function staffTagWords(flag, monsters, concealed) {
  return [flag?.level ? flag.why : '', flag?.watch ? 'WATCH' : '', monsters > 0 ? `${monsters} monster${monsters === 1 ? '' : 's'}` : '', concealed ? 'concealed' : '']
    .filter(Boolean).join(' · ');
}
const noAccount = (/** @type {string} */ name) => (name ? t('net.staffView.noAccount', 'Staff view: no account found for {name} - not followed.', { name })
  : t('net.staffView.noAccountAnon', 'Staff view: no account found for that player - not followed.'));

/** FLAG-DISMISS: the most dismissed flags one browser keeps, and where. */
export const DISMISSED_FLAGS_MAX = 500;
const DISMISSED_KEY = 'dfo.staffDismissedFlags';
/** What a flag says, as one string - a dismissal holds while it says the same. @param {{ level: string|null, why: string, watch: boolean }} f */
export const staffFlagKey = (f) => `${f.level ?? ''}|${f.watch ? 1 : 0}|${f.why ?? ''}`;
/** FLAG-DISMISS: the dismissed flags this browser keeps (account -> staffFlagKey); none when storage is unreadable.
 *  @param {any} win @returns {Map<string, string>} */
export function loadDismissedFlags(win) {
  /** @type {Map<string, string>} */
  const m = new Map();
  try {
    const o = JSON.parse(win?.localStorage?.getItem?.(DISMISSED_KEY) ?? 'null');
    if (Array.isArray(o)) for (const e of o.slice(-DISMISSED_FLAGS_MAX)) if (Array.isArray(e) && typeof e[0] === 'string' && ID_RE.test(e[0]) && typeof e[1] === 'string') m.set(e[0], e[1]);
  } catch { /* private mode, or a value not ours: none kept */ }
  return m;
}
/** @param {any} win @param {Map<string, string>} m */
export function saveDismissedFlags(win, m) {
  while (m.size > DISMISSED_FLAGS_MAX) m.delete(/** @type {string} */ (m.keys().next().value));
  try { win?.localStorage?.setItem?.(DISMISSED_KEY, JSON.stringify([...m])); } catch { /* storage full or blocked: kept for this page only */ }
}

/**
 * `follow` the page's follow (scenes/staffFollowHost.js staffFollowOnPage), `glyphs()` mine as the service last issued
 * them, `links()` the chat's sessions (a Map, or null before the chat), `book` the region's travellers, `foes` the open
 * air's pool (its puppets), `overworld()` the travel view's key, `up()` whether it is up, `canvas` the game's, `say(t)`
 * the notice line.
 * @param {{ follow: any, glyphs: () => unknown, links: () => any, book: any, foes: any, overworld: () => void, up: () => boolean, canvas: any, say: (t: string) => void, politicAt?: ((x: number, y: number) => number) | null, acts?: ((p: { id: string, sub: string, name: string }, onFollow: (sub: string) => void) => any[]) | null, win?: any, doc?: any, now?: () => number, makeTags?: typeof createStaffTags }} deps
 */
export function createStaffViewHost({ follow, glyphs, links, book, foes, overworld, up, canvas, say, acts = null, politicAt = null, win = globalThis.window, doc = globalThis.document, now = () => Date.now(), makeTags = createStaffTags }) {
  let layer = /** @type {ReturnType<typeof createStaffTags>|null} */ (null);
  let wasOn = false, askedAt = -Infinity;
  /** A tag click waiting on the hub's search. @type {{ id: string, name: string, q: string, hub: any, was: any, at: number }|null} */
  let finding = null;
  /** @type {Map<string, string>} */
  const known = new Map();
  /** STAFF-OW-TAGS: the Overworld's players this frame, as marks() found them (`kind` their flag's line, STAFF-FLAG-LINES). @type {Array<{ id: string, at: number[], name: string, line: string, level: string, kind: number|null }>} */
  let owTags = [];
  /** THE GATE: a Staff Panel spoke on this page (a player's page: false, and nothing more is asked), and my glyphs are an
   *  Admin's or a Moderator's (chatSafetyHost.js staffLineActs: dev, mod or Shadow Fang, never a Dungeon Master) - the true
   *  glyphs, which the issue keeps while Hide me is on. */
  const on = () => !!follow.panel() && staffLineActs(glyphs()).length > 0;
  const admin = () => { const g = glyphs(); return Array.isArray(g) && g.includes('dev'); };
  /** Every player the game receives: the followed room's while a follow is locked, else my own room's. */
  const source = () => /** @type {any[]} */ (follow.locked() ? follow.peers() : follow.main()?.drawable?.() ?? []);
  /** The region's travellers by socket (their marks keep the account the bus named). @returns {Map<string, any>} */
  const travellers = () => { const by = new Map(); for (const t of book?.live?.(Date.now()) ?? []) if (t?.id) by.set(t.id, t); return by; };
  const ask = () => { askedAt = now(); follow.askTags(); };
  const okSub = (/** @type {unknown} */ s) => (typeof s === 'string' && ID_RE.test(s) ? s : null);
  /** A socket's account, as far as this page already knows it, in this order: the room's own word (a channel's hello
   *  names it; a place room's never does), then each chat link's - its room, then the hub's list of everyone - then the
   *  region's traveller marks, then a search answered before. @param {string} id @param {any} d @param {Map<string, any>} tv */
  function subOf(id, d, tv) {
    const own = okSub(d?.sub);
    if (own) return own;
    for (const l of links()?.values?.() ?? []) {
      const s = okSub(l?.peers?.get?.(id)?.sub) ?? okSub(l?.hubOnline?.get?.(id)?.sub);
      if (s) return s;
    }
    return okSub(tv.get(id)?.sub) ?? known.get(id) ?? null;
  }
  /** STAFF-TAG-MENU (2026-10-24, mob: "when u lcick on someon", "i mean the pop up"): a picked player's menu - the chat
   *  line menu's staff acts (`acts`, scenes/chatSafetyHost.js playerActions), its Follow this view's own (`go`, which
   *  opens the panel's card); with no acts on this page, the follow at once, as before. */
  function chosen(/** @type {string} */ id, /** @type {string} */ sub, /** @type {string} */ name, /** @type {{ x: number, y: number } | null} */ where = null) {
    const hint = groundOf(id);
    const rows = [...(acts?.({ id, sub, name }, (/** @type {string} */ s) => { go(s, name, s === sub ? hint : null); }) ?? []), ...(acts ? dismissRow(sub) : [])];
    if (rows.length && layer) layer.menu(name || sub, rows, ...(where ? [where] : []));
    else go(sub, name, hint);
  }
  /** FOLLOW-GROUND-HINT (mob: "following from ground does not work"): a player drawn on my own ground stands in my own
   *  room - its key, its layer and their socket there, for the follow to go to at once - else null (a traveller's mark,
   *  the flat map's dot, or the followed room's while a follow is locked: the hub says where those are). @param {string} id */
  function groundOf(id) {
    if (follow.locked()) return null;
    const m = follow.main?.();
    if (typeof m?.room !== 'string' || !(m.drawable?.() ?? []).some((/** @type {any} */ p) => p?.id === id)) return null;
    return { room: m.room, id, ly: m.layer ?? 0 };
  }
  /** Follow the account at once, and only when that took, hand the panel its card - to this page's own origin, never '*'. */
  function go(/** @type {string} */ sub, /** @type {string} */ name, /** @type {any} */ hint = null) {
    if (!follow.follow(sub, hint)) return;
    const origin = win?.location?.origin;
    if (typeof origin !== 'string' || !origin || origin === 'null' || typeof win.postMessage !== 'function') return;
    win.postMessage({ dfoStaff: 'act', act: 'follow', sub, name: (name || sub).slice(0, 64) }, origin);
  }
  /** The hub's search has answered the click waiting on it: true once it is settled (followed, or said not found). A yes
   *  counts from any answer to the name; a no only from one that came after the ask. */
  function answered() {
    const f = finding?.hub?.hubFound;
    if (!f || String(f.q ?? '').toLowerCase() !== finding.q) return false;
    const row = (Array.isArray(f.l) ? f.l : []).find((r) => r?.id === finding.id);
    const sub = okSub(row?.sub);
    if (!sub && f === finding.was) return false;
    const { id, name } = finding;
    finding = null;
    if (!sub) { say(noAccount(name)); return true; }
    if (known.size >= KNOWN_MAX) known.clear();
    known.set(id, sub);
    chosen(id, sub, name);
    return true;
  }
  /** The last door: the hub's search by the name they wear, its row matched by their socket - the search box's own ask
   *  (net/online.js askFind: its answer the hub's `hubFound`, never a line, and its own clock bounds it, so a run of
   *  clicks never floods the relay's search bucket). An ask it refused is waited on all the same: an answer the box
   *  already has on its way lands, and none says no account found when the wait is out. False when no search can go. */
  function search(/** @type {string} */ id, /** @type {string} */ name) {
    const hub = links()?.get?.('world'), q = name.trim().slice(0, HUB_FIND_Q_MAX).trim();   // askFind's own cut, so its answer names the same query
    if (!q || typeof hub?.askFind !== 'function') return false;
    finding = { id, name, q: q.toLowerCase(), hub, was: hub.hubFound ?? null, at: now() };
    if (!answered()) hub.askFind(q);
    return true;
  }
  /** A tag's click: the player's account, then the follow. @param {string} id */
  function pick(id) {
    const d = source().find((p) => p?.id === id) ?? null;
    const tv = travellers();
    const name = String(d?.name || tv.get(id)?.name || '');
    const sub = subOf(id, d, tv);
    if (sub) { chosen(id, sub, name); return; }
    if (!search(id, name)) say(noAccount(name));
  }
  /** The monsters each player's game stands here, by their socket - the open air's puppets (`dev` only). */
  function monstersBy() {
    /** @type {Map<string, number>} */
    const by = new Map();
    // shortcut: every live puppet counts, a companion or a watchman too - a hostile-only count once the server watch flags a spawner
    for (const f of foes?.foes ?? []) if (f?.puppet && !f.dead) by.set(f.puppet, (by.get(f.puppet) ?? 0) + 1);
    return by;
  }
  /** STAFF-FLATMAP: the flat map, made the first time Shift+N opens it (a page with no map link has none). */
  let flat = /** @type {ReturnType<typeof createStaffFlatMapHost>|null} */ (null);
  const flatMap = () => {
    if (flat || !follow.map || typeof politicAt !== 'function') return flat;
    flat = createStaffFlatMapHost({
      map: follow.map, politicAt, pixel: () => follow.pixel?.() ?? null, flagOf, words: (f) => staffTagWords(f, 0, false), doc,
      choose: (id, sub, name, where) => { const s = okSub(sub) ?? subOf(id, null, travellers()); if (s) chosen(id, s, name, where); else if (!search(id, name)) say(noAccount(name)); },
    });
    return flat;
  };
  /** FLAG-DISMISS (mob, 2026-10-24: "need a dismiss button on players name plates for flags"; the card's pick "Hide it for
   *  me only"): a flag this staff member dismissed is left off their own tags, lines and flat map - by what it says
   *  (`staffFlagKey`), so a new flag on that player shows again. Kept in this browser alone (nothing is sent: the flag stands
   *  for every other staff member), DISMISSED_FLAGS_MAX at most, the oldest let go first. */
  const dismissed = loadDismissedFlags(win);
  const flagOf = (/** @type {string|null} */ sub) => {
    const f = sub ? follow.tags()?.flags?.get(sub) ?? null : null;
    return f && dismissed.get(/** @type {string} */ (sub)) === staffFlagKey(f) ? null : f;
  };
  /** FLAG-DISMISS: the tag menu's row for a flagged player. @param {string} sub */
  const dismissRow = (sub) => {
    const f = flagOf(sub);
    return f ? [{ label: t('net.staffView.dismissFlag', 'Dismiss flag'), run: () => { dismissed.delete(sub); dismissed.set(sub, staffFlagKey(f)); saveDismissedFlags(win, dismissed); } }] : [];
  };
  /** STAFF-FLAG-LINES: a flag's line - a report waiting on review (any level) red, a watch alone gold, else none. @param {any} flag */
  const lineOf = (flag) => (flag?.level ? STAFF_LINE.review : flag?.watch ? STAFF_LINE.watch : null);
  /** STAFF-FLAG-LINES (2026-10-24, mob: "need to port over my watch lines and review lines for flags in staff esp",
   *  "helps flag bad players"): a line from the screen's middle to each flagged player in front of the eye, however far
   *  (the tags stop at the nameplate distance; a flag's line does not), STAFF_LINES_MAX at most with the others.
   *  @param {number[][]} segs @param {Array<{ at: number[], kind: number|null }>} who @param {(p: number[]) => any} at @param {number} w @param {number} h */
  function flagLines(segs, who, at, w, h) {
    for (const { at: q, kind } of who) {
      if (segs.length >= STAFF_LINES_MAX) break;
      if (kind === null) continue;
      const p = at(q);
      if (p.front) segs.push([w / 2, h / 2, p.x, p.y, kind]);
    }
  }
  return {
    /** THE FRAME (the host's names pass, every mode): the flags asked when due, a search's answer read, and on the ground
     *  the tags; on the Overworld an Admin's monster lines (its tags are the travel view's marks). `covered` a window
     *  over the HUD. @param {any} proj @param {any} view @param {number[]} eye @param {boolean} [covered] */
    frame(proj, view, eye, covered = false) {
      if (!on()) { if (wasOn) { wasOn = false; layer?.hide(); if (flat?.isOpen()) flat.toggle(); } return; }
      flat?.frame();   // STAFF-FLATMAP: the sheet over everything while it is open
      if (!wasOn) { wasOn = true; ask(); } else if (now() - askedAt >= STAFF_TAGS_ASK_MS) ask();
      if (finding && !answered() && now() - finding.at >= STAFF_FIND_WAIT_MS) { const { name } = finding; finding = null; say(noAccount(name)); }
      layer ??= makeTags({ doc, onPick: pick });
      const w = canvas?.clientWidth ?? 0, h = canvas?.clientHeight ?? 0;
      if (covered || !proj || !view || !eye || !(w > 0) || !(h > 0)) { layer.hide(); return; }
      const rect = worldViewportRect(w, h), pv = multiply(proj, view);
      const at = (/** @type {number[]} */ p) => projectToScreen(p, w, h, proj, view, rect, false, pv);
      const peers = source();
      if (up()) {
        // STAFF-OW-TAGS: the Overworld's players as tags (marks() kept them this frame), nearest the eye first, crowds boxed
        const ow = [];
        for (const m of owTags) { const p = at(m.at); if (p.front) ow.push({ m, p, r: Math.hypot(m.at[0] - eye[0], m.at[1] - eye[1], m.at[2] - eye[2]) }); }
        ow.sort((a, b) => a.r - b.r || (a.m.id < b.m.id ? -1 : a.m.id > b.m.id ? 1 : 0));
        layer.render(crowded(ow.slice(0, STAFF_OW_TAGS_MAX)), Math.max(0, ow.length - STAFF_OW_TAGS_MAX));
        const segs = [];
        if (admin()) {
          const owners = new Map();
          for (const d of peers) if (d?.shown) owners.set(d.id, d);
          for (const f of foes?.foes ?? []) {
            if (segs.length >= STAFF_LINES_MAX) break;
            const o = f?.puppet && !f.dead && f.ai?.feet ? owners.get(f.puppet) : null;
            const q = o ? follow.toScene(o.shown) : null;
            if (!q) continue;
            const a = at(f.ai.feet), b = at(q);
            if (a.front && b.front) segs.push([a.x, a.y, b.x, b.y]);
          }
        }
        flagLines(segs, owTags.map((m) => ({ at: m.at, kind: m.kind })), at, w, h);
        layer.strokes(segs, w, h);
        return;
      }
      const dist = follow.tags()?.dist ?? NAMEPLATE_DIST;
      const tv = travellers(), mons = admin() ? monstersBy() : null;
      const near = [], flagged = [];
      for (const d of peers) {
        if (!d?.shown || typeof d.id !== 'string') continue;
        const f = follow.toScene(d.shown);
        if (!f) continue;
        const head = [f[0], f[1] + STAFF_TAG_HEAD_M, f[2]];
        const kind = lineOf(flagOf(subOf(d.id, d, tv)));
        if (kind !== null) flagged.push({ at: head, kind });
        const r = Math.hypot(head[0] - eye[0], head[1] - eye[1], head[2] - eye[2]);
        if (r <= dist) near.push({ d, head, r });
      }
      near.sort((a, b) => a.r - b.r || (a.d.id < b.d.id ? -1 : a.d.id > b.d.id ? 1 : 0));
      const segs = /** @type {number[][]} */ ([]);
      flagLines(segs, flagged, at, w, h);
      layer.strokes(segs, w, h);
      const tagged = [];
      for (const { d, head } of near.slice(0, STAFF_TAGS_MAX)) {
        const p = at(head);
        if (!p.front || p.depth < 1) continue;   // behind the eye, or the eye's own (a follow's target, whose eyes the camera is)
        const flag = flagOf(subOf(d.id, d, tv));
        tagged.push({ p, m: { id: d.id, name: String(d.name ?? ''), line: staffTagWords(flag, mons?.get(d.id) ?? 0, concealedPose(d)), level: flag?.level ?? '' } });
      }
      layer.render(crowded(tagged), Math.max(0, near.length - STAFF_TAGS_MAX));
    },
    /** THE OVERWORLD'S MARKS (the travel view's `marks`, scenes/travelViewMarks.js): a player's list goes back untouched.
     *  Staff's player marks leave the travel view's canvas for the staff tags (frame, `owTags`) - STAFF-OW-TAGS (2026-10-24,
     *  mob: "overworl map is missing alot?", "like it show enemy to player but no players", "no esp no clickable tags", "no
     *  menu pop up"): on the canvas the player's own Travellers and who switches hid them, and a crowd of them was one
     *  unclickable "N travellers"; as tags every player stands whatever those switches say, wears their true name (a
     *  Stranger's too) and the flag, and a crowd is a box with a row a player, each a click. The players the travel view
     *  cut (past NAME_RANGE, concealed, veiled, hidden by the open zone) are tagged as well. @param {any[]} list */
    marks(list) {
      if (!on()) return list;
      const peers = source(), tv = travellers(), mons = admin() ? monstersBy() : null;
      const byId = new Map();
      for (const d of peers) if (d?.id) byId.set(d.id, d);
      const seen = new Set(), out = [];
      owTags = [];
      for (const m of list ?? []) {
        const id = markId(m?.key);
        if (id == null) { out.push(m); continue; }
        if (seen.has(id) || !Array.isArray(m.at)) continue;
        seen.add(id);
        const d = byId.get(id) ?? null, t = tv.get(id) ?? null;
        const flag = flagOf(subOf(id, d, tv));
        owTags.push({ id, at: m.at, name: String(d?.name ?? t?.name ?? m.label ?? ''), line: staffTagWords(flag, mons?.get(id) ?? 0, concealedPose(d) || /^stranger\b/.test(m.kind ?? '')), level: flag?.level ?? '', kind: lineOf(flag) });
      }
      for (const d of peers) {
        if (!d?.shown || typeof d.id !== 'string' || seen.has(d.id)) continue;
        const f = follow.toScene(d.shown);
        if (!f) continue;
        const flag = flagOf(subOf(d.id, d, tv));
        owTags.push({ id: d.id, at: [f[0], f[1] + STAFF_TAG_HEAD_M, f[2]], name: String(d.name ?? ''), line: staffTagWords(flag, mons?.get(d.id) ?? 0, concealedPose(d)), level: flag?.level ?? '', kind: lineOf(flag) });
      }
      return out;
    },
    /** A travel view mark's click: a player's is the staff view's (true), anything else the view's own. @param {unknown} key */
    mark(key) {
      const id = markId(key);
      if (id == null || !on()) return false;
      pick(id);
      return true;
    },
    /** SHIFT+M (a trusted press, no other modifier): the Overworld up or down, and the flags asked - true when it was
     *  the staff view's. A player's, and indoors (where the Overworld cannot come up), is the automap's as ever. Not an
     *  InputManager action: a default combo would make Shift a combo modifier for every player. @param {any} e */
    key(e) {
      // STAFF-FLATMAP: Shift+N, anywhere (the sheet needs no world under it) - open on the region stood in, or close
      if (e?.code === 'KeyN' && e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && e.isTrusted === true && on() && flatMap()) {
        if (!e.repeat) { flat?.toggle(); ask(); }
        return true;
      }
      if (e?.code !== 'KeyM' || !e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.isTrusted !== true || !on()) return false;
      if (!up() && follow.mode() !== 'exterior') return false;
      if (!e.repeat) { overworld(); ask(); }
      return true;
    },
  };
}
