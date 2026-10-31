// @ts-check
// FIRM1 (2026-10-13; bible/06-Systems/Firmament.md) - THE FIRMAMENT IN FORCE: the one place this page holds the tree it
// plays under, and whether it plays online. A LEAF beside the law (it imports nothing else), so the gathering acts
// (herbAct.js, fishAct.js), the sail (comeSailAway.js) and the powers (firmamentPowers.js) all read the same tree
// without any of them reaching the others' graphs.
//
// The tree is the ACCOUNT SERVICE's (server-account/src/firmament.js) - the host hands in what its book last heard
// (net/firmament/firmamentBook.js) - and it is in force ONLINE ALONE: offline the character is the save's, Daggerfall's, with no
// sky at all, as Renown's layer is (systems/renownLayer.js). The combat channels sleep further still (in a refereed fight
// - firmamentPowers.js awake). MENTOR2 (bible/06-Systems/Mentor-Mode.md): while mentoring the combat stars act at the
// mentor's power scale and the life stars act whole - it had put the whole sky to sleep (AUDIT UICALM-FIRM1 L1 L2).

import { treeStats, statDef, EMPTY_TREE } from '../net/firmament/firmamentLaw.js';

/** @type {Readonly<Record<string, number>>} */
const NONE = Object.freeze({});
let _tree = /** @type {{ start: string|null, keys: readonly string[] }} */ (EMPTY_TREE);
let _stats = NONE;
let _online = false;
let _mentorScale = 1;
/** The combat channels at a scale, by scale - remade when the tree or the scale moves. */
let _scaled = new Map();
const _listeners = new Set();
const tell = () => {
  for (const fn of _listeners) {
    try {
      fn();
    } catch {
      /* a listener is not the tree's problem */
    }
  }
};

/** The host's word: the tree this character plays under (the book's), or null for none. */
export function setFirmamentTree(tree) {
  _tree = tree?.start ? { start: tree.start, keys: [...(tree.keys ?? [])] } : EMPTY_TREE;
  _stats = treeStats(_tree);
  _scaled = new Map();
  for (const fn of _listeners) {
    try {
      fn();
    } catch {
      /* a listener is not the tree's problem */
    }
  }
}
/** The host's word: this page plays online (the tree in force) or not. */
export function setFirmamentOnline(on) {
  const was = _online;
  _online = !!on;
  if (was !== _online)
    for (const fn of _listeners) {
      try {
        fn();
      } catch {
        /* as above */
      }
    }
}
/** MENTOR2: the host's word - the share the combat stars act at while I mentor (mentorMode.js mentorPowerScale), 1
 *  when I do not. The fold and the layer move at once (AUDIT UICALM-FIRM1 L1 L2: never a round late). */
export function setFirmamentMentorScale(k) {
  const v = Number.isFinite(k) && k > 0 && k < 1 ? k : 1;
  if (_mentorScale === v) return;
  _mentorScale = v;
  tell();
}
/** The share the combat stars act at now (1 when not mentoring). */
export const firmamentMentorScale = () => _mentorScale;
/** One channel's value at scale `k`: a life channel whole, a combat channel at its whole share of `k`. */
const atScale = (key, v, k) => (k === 1 || statDef(key)?.kind === 'life' ? v : Math.round(v * k));
/** Told whenever the tree or the online word changes (the powers fold the entity again, the layer moves). */
export function onFirmamentChange(fn) {
  if (typeof fn === 'function') _listeners.add(fn);
  return () => _listeners.delete(fn);
}

/** The tree as the host last handed it in. */
export const firmamentTree = () => _tree;
/** Whether the tree is in force: online, with a sign chosen. */
export const firmamentInForce = () => _online && !!_tree.start;
/** Every channel's capped total while the tree is in force; none otherwise. */
export const firmamentStats = () => (firmamentInForce() ? _stats : NONE);
/** MENTOR2: every channel with the combat ones at scale `k` (mentorMode.js mentorPowerScale) - the tree's own at 1. */
export function firmamentStatsAt(k) {
  const all = firmamentStats();
  if (all === NONE || !(k > 0 && k < 1)) return all;
  let got = _scaled.get(k);
  if (!got) {
    got = Object.freeze(Object.fromEntries(Object.entries(all).map(([key, v]) => [key, atScale(key, v, k)])));
    if (_scaled.size > 8) _scaled.clear();
    _scaled.set(k, got);
  }
  return got;
}
/** One channel's capped total while the tree is in force (a combat one at the mentor's scale), else 0. */
export const firmStat = (key) => (firmamentInForce() ? atScale(key, _stats[key] ?? 0, _mentorScale) : 0);
/** A gathering act's window, widened (or narrowed) by its `act.<profession>` channel: a multiplier, 1 with no tree. */
export const firmActMult = (profession) => 1 + firmStat(`act.${profession}`) / 100;

/**
 * Whether my stars act now, and the first reason they do not - what the Firmament window says above its sums. A player
 * whose stars slept had no way to tell: the side panel sums the stars held whether or not they act. FIRM-STATUS.
 *   'seat'       the page is offline: another tab or device holds the online seat
 *   'unread'     the book has no answer from the service yet, so no tree is in force
 *   'no-sign'    the service answered, and no birthsign is accepted
 *   'mentoring'  while mentoring the combat stars act at a share (firmamentMentorScale), the life stars whole
 *   'duel'       a duel or an Arena bout: the combat stars sleep, the crafting and trade stars act
 *   'active'     every accepted star acts
 * The duel is handed in (sigil.js sigilDueling, the word firmamentPowers.js firmamentAwake sleeps on), so this module
 * stays a leaf and the window that asks does not load the powers' graph.
 * @typedef {'seat'|'unread'|'no-sign'|'mentoring'|'duel'|'active'} FirmamentStatus
 * @param {{ read: boolean, dueling: boolean }} o `read` - whether the book has had the service's answer (its
 *   `state.open`); `dueling` - whether a duel or an Arena bout stands
 * @returns {FirmamentStatus}
 */
export function firmamentStatus({ read, dueling }) {
  if (!_online) return 'seat';
  if (!_tree.start) return read ? 'no-sign' : 'unread';
  if (dueling) return 'duel'; // MENTOR2: the duel first - it puts the combat stars to sleep, mentoring only scales them
  if (_mentorScale < 1) return 'mentoring';
  return 'active';
}

/** Tests only: no tree, offline, no listeners. */
export function _resetFirmamentLiveForTests() {
  _tree = EMPTY_TREE;
  _stats = NONE;
  _online = false;
  _mentorScale = 1;
  _scaled = new Map();
  _listeners.clear();
}
