// @ts-check
// ═══════════════════════════════════════════════════════════════════
// OW-FILTER - WHAT THE OVERWORLD SHOWS (bible/06-Systems/Travel-View.md).
//
// The player's ask (2026-09-29): "all the locations show cause a lot of clutters add a filers to the bottom right
// segments". Five groups, each a switch in the view's corner (ui/travelViewHud.js), kept on the device as the path
// mode is:
//   towns      - the places in the grid, their plates (kind 'place')
//   distant    - the far places held at the edge with their distance (kind 'far', not a dungeon)
//   dungeons   - the unfound lairs and the found dungeons far off ('lair', 'far dungeon')
//   enemies    - the roaming bands, the camps and packs, the raiders' sails ('band', 'camp', 'raider ...')
//   travellers - the other players ('traveller ...')
//   gathering  - GATHER-OW: each profession's group of nodes on the land near me ('gather <profession>')
// NEVER HIDDEN, whatever the switches say: the journey's end ('dest', 'target'), anything giving chase (a threat is
// never filtered off the screen), and my party.
//
// OW-WHO and OW-NODE-KM (FIELD BUGS 2026-10-04e, Discord: "Add a distance filter so players can decide how many km away
// they hide nodes"; "Change name colors of players in your guild or friend list"; "More filters for players in general
// (filter by guild, friend, level etc), both in Overworld map and travel map"). Beside the six switches, the WHO -
// kept on the device under its own key, as the switches are, and read by both maps (ui/travelViewHud.js, ui/heldMap.js):
//   friends / guild / others - the players by who they are to me (`travellerKin`: a friend, one of my guild, anyone
//                              else); a player who is both is a friend
//   renown                   - the least Renown (online's level, the number boxed beside a name) a player shows at
//   nodeKm                   - how far off a gathering group still shows, km (null: as far as they are gathered)
// A player is shown while the Travellers switch is on, their kin's switch is on and their Renown reaches the floor.
// ═══════════════════════════════════════════════════════════════════
import { appStorage } from './appStorage.js';
import { FRIEND_CSS } from '../net/social.js';   // OW-KIN: the friends' blue is the chat's own

export const TV_FILTER_GROUPS = Object.freeze(['towns', 'distant', 'dungeons', 'enemies', 'travellers', 'gathering']);
export const TV_FILTER_STORE_KEY = 'dfjs.overworld.filters';

/** The switches' words. */
export const TV_FILTER_TEXT = Object.freeze({
  title: 'Show',
  towns: 'Towns',
  distant: 'Distant',
  dungeons: 'Dungeons',
  enemies: 'Enemies',
  travellers: 'Travellers',
  gathering: 'Gathering',
  tip: (label, on) => `${on ? 'Hide' : 'Show'} ${label.toLowerCase()} on the overworld`,
});

/**
 * The group a mark's kind belongs to, or null for a mark that is never filtered.
 * @param {string} kind
 */
export function markGroup(kind = '') {
  const words = String(kind).split(' ');
  const k = words[0];
  if (words.includes('chase')) return null;   // a threat coming at me stays on the screen
  if (k === 'place') return 'towns';
  if (k === 'far') return words.includes('dungeon') ? 'dungeons' : 'distant';
  if (k === 'lair') return 'dungeons';
  if (k === 'band' || k === 'camp' || k === 'raider') return 'enemies';
  if (k === 'traveller' || k === 'wayfarer') return 'travellers';   // LW3: the living world's parties beside the players
  if (k === 'gather') return 'gathering';   // GATHER-OW
  return null;   // dest, target, party - always drawn
}

let shown = null;
const listeners = new Set();

function read() {
  const all = Object.fromEntries(TV_FILTER_GROUPS.map((g) => [g, true]));
  let raw = null;
  try { raw = appStorage()?.getItem(TV_FILTER_STORE_KEY) ?? null; } catch { raw = null; }
  if (raw) {
    try {
      const v = JSON.parse(raw);
      for (const g of TV_FILTER_GROUPS) if (typeof v?.[g] === 'boolean') all[g] = v[g];
    } catch { /* a bad word: all on */ }
  }
  return all;
}

/** The switches now, { group: on }. */
export function travelViewFilters() {
  shown ??= read();
  return shown;
}

/** Flip one group; kept on the device, told to whoever listens. Returns its new state. */
export function toggleTravelViewFilter(group) {
  if (!TV_FILTER_GROUPS.includes(group)) return false;
  const next = { ...travelViewFilters(), [group]: !travelViewFilters()[group] };
  shown = next;
  try { appStorage()?.setItem(TV_FILTER_STORE_KEY, JSON.stringify(next)); } catch { /* held for the session */ }
  for (const fn of [...listeners]) { try { fn(next); } catch { /* a listener's own fault */ } }
  return next[group];
}

/** Hear a change; returns the way to stop hearing it. */
export function onTravelViewFilters(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ── OW-WHO / OW-NODE-KM ─────────────────────────────────────────────
export const TV_WHO_STORE_KEY = 'dfjs.overworld.who';
/** The players' kin switches, in the panels' order. */
export const TV_WHO_GROUPS = Object.freeze(['friends', 'guild', 'others']);
/** The Renown floor's steps, and the node reach's (km; null is no limit - GATHER-OW groups reach 3 km). */
export const TV_RENOWN_STEPS = Object.freeze([0, 5, 10, 20, 40]);
export const TV_NODE_KM_STEPS = Object.freeze([null, 0.5, 1, 2]);
export const TV_WHO_TEXT = Object.freeze({
  title: 'Players',
  friends: 'Friends',
  guild: 'Guild',
  others: 'Others',
  renown: (n) => (n > 0 ? `Renown ${n}+` : 'Any renown'),
  nodeKm: (km) => (km == null ? 'Nodes: any km' : `Nodes: ${km} km`),
  tip: (label, on) => `${on ? 'Hide' : 'Show'} ${label.toLowerCase()} on the maps`,
  renownTip: 'The least Renown a player shows at - press for the next',
  nodeTip: 'How far off a gathering group still shows - press for the next',
});
/** OW-KIN: a player's names are coloured by who they are to me - my party's green stays the party's (net/social.js). */
export const TV_KIN_COLORS = Object.freeze({
  friend: FRIEND_CSS,   // the chat's and the roster's friend blue, one home
  guild: '#c9a6ff',    // a guild-mate's violet - none of the party's green, the friends' blue, the tag's steel or the renown's amber
});
/** OW-KIN: the legend's words for the two colours. */
export const TV_KIN_LEGEND = Object.freeze({ friend: 'Friend', guild: 'Guild-mate' });
const WHO_DEFAULT = Object.freeze({ friends: true, guild: true, others: true, renown: 0, nodeKm: null });
let who = null;

function readWho() {
  const w = { ...WHO_DEFAULT };
  let raw = null;
  try { raw = appStorage()?.getItem(TV_WHO_STORE_KEY) ?? null; } catch { raw = null; }
  if (raw) {
    try {
      const v = JSON.parse(raw);
      for (const g of TV_WHO_GROUPS) if (typeof v?.[g] === 'boolean') w[g] = v[g];
      if (TV_RENOWN_STEPS.includes(v?.renown)) w.renown = v.renown;
      if (TV_NODE_KM_STEPS.includes(v?.nodeKm ?? null)) w.nodeKm = v?.nodeKm ?? null;
    } catch { /* a bad word: the defaults */ }
  }
  return w;
}
/** The who now: { friends, guild, others, renown, nodeKm }. */
export function travelViewWho() {
  who ??= readWho();
  return who;
}
function setWho(next) {
  who = next;
  try { appStorage()?.setItem(TV_WHO_STORE_KEY, JSON.stringify(next)); } catch { /* held for the session */ }
  for (const fn of [...listeners]) { try { fn(travelViewFilters()); } catch { /* a listener's own fault */ } }
  return next;
}
/** Flip one kin switch. Returns its new state. */
export function toggleTravelViewWho(group) {
  if (!TV_WHO_GROUPS.includes(group)) return false;
  return setWho({ ...travelViewWho(), [group]: !travelViewWho()[group] })[group];
}
/** The next Renown floor (round to none again). Returns it. */
export function cycleTravelViewRenown() {
  const at = TV_RENOWN_STEPS.indexOf(travelViewWho().renown);
  return setWho({ ...travelViewWho(), renown: TV_RENOWN_STEPS[(at + 1) % TV_RENOWN_STEPS.length] }).renown;
}
/** The next node reach (round to no limit again). Returns it. */
export function cycleTravelViewNodeKm() {
  const at = TV_NODE_KM_STEPS.indexOf(travelViewWho().nodeKm);
  return setWho({ ...travelViewWho(), nodeKm: TV_NODE_KM_STEPS[(at + 1) % TV_NODE_KM_STEPS.length] }).nodeKm;
}
/**
 * OW-KIN: who a player is to me - 'friend', 'guild' (their tag is my guild's), or null. Pure.
 * @param {{ friend?: boolean, gt?: string | null } | null | undefined} p @param {string | null} [myTag]
 */
export function travellerKin(p, myTag = null) {
  if (p?.friend) return 'friend';
  if (myTag && p?.gt && String(p.gt).toUpperCase() === String(myTag).toUpperCase()) return 'guild';
  return null;
}
/**
 * OW-WHO: is a player of this kin and Renown shown under the who? Pure. (The Travellers switch is markShown's.)
 * @param {{ kin?: string | null, lv?: number | null } | null | undefined} p
 */
export function playerShown(p, w = travelViewWho()) {
  const g = p?.kin === 'friend' ? 'friends' : p?.kin === 'guild' ? 'guild' : 'others';
  if (w[g] === false) return false;
  return !(w.renown > 0) || (Number(p?.lv) || 0) >= w.renown;
}

/** Is this mark drawn under these switches? OW-WHO: a traveller under the who too; OW-NODE-KM: a gathering group within
 *  the reach (`dist`, km - the group's own, gatherHost.js overworldGroups). */
export function markShown(m, f = travelViewFilters(), w = travelViewWho()) {
  const g = markGroup(m?.kind);
  if (g != null && f[g] === false) return false;
  if (g === 'travellers' && !playerShown(m, w)) return false;
  if (g === 'gathering' && w.nodeKm != null && Number.isFinite(m?.dist) && m.dist > w.nodeKm) return false;
  return true;
}

/** How many marks of each group there are (drawn or not) - the switches' counts. */
export function countGroups(marks) {
  const n = Object.fromEntries(TV_FILTER_GROUPS.map((g) => [g, 0]));
  for (const m of marks ?? []) { const g = markGroup(m?.kind); if (g) n[g] += 1; }
  return n;
}

/** Pins: back to the device's word. */
export function _resetTravelViewFilters() { shown = null; who = null; listeners.clear(); }
