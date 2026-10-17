// @ts-check
// FIRM1 (2026-10-13; bible/06-Systems/Firmament.md) - THE FIRMAMENT IN FORCE: the one place this page holds the tree it
// plays under, and whether it plays online. A LEAF beside the law (it imports nothing else), so the gathering acts
// (herbAct.js, fishAct.js), the sail (comeSailAway.js) and the powers (firmamentPowers.js) all read the same tree
// without any of them reaching the others' graphs.
//
// The tree is the ACCOUNT SERVICE's (server-account/src/firmament.js) - the host hands in what its book last heard
// (net/firmament/firmamentBook.js) - and it is in force ONLINE ALONE: offline the character is the save's, Daggerfall's, with no
// sky at all, as Renown's layer is (systems/renownLayer.js). The combat channels sleep further still (in a refereed fight
// - firmamentPowers.js awake); and the whole sky sleeps while mentoring, a life channel read here with it (AUDIT
// UICALM-FIRM1 L1 L2: the herb and fishing windows and the sail had kept it).

import { treeStats, EMPTY_TREE } from '../net/firmament/firmamentLaw.js';

/** @type {Readonly<Record<string, number>>} */
const NONE = Object.freeze({});
let _tree = /** @type {{ start: string|null, keys: readonly string[] }} */ (EMPTY_TREE);
let _stats = NONE;
let _online = false;
let _mentoring = false;
const _listeners = new Set();
const tell = () => { for (const fn of _listeners) { try { fn(); } catch { /* a listener is not the tree's problem */ } } };

/** The host's word: the tree this character plays under (the book's), or null for none. */
export function setFirmamentTree(tree) {
  _tree = tree?.start ? { start: tree.start, keys: [...(tree.keys ?? [])] } : EMPTY_TREE;
  _stats = treeStats(_tree);
  for (const fn of _listeners) { try { fn(); } catch { /* a listener is not the tree's problem */ } }
}
/** The host's word: this page plays online (the tree in force) or not. */
export function setFirmamentOnline(on) {
  const was = _online;
  _online = !!on;
  if (was !== _online) for (const fn of _listeners) { try { fn(); } catch { /* as above */ } }
}
/** The host's word: the character is mentoring (systems/mentorMode.js refreshMentor) - the whole sky sleeps, and the
 *  fold and the layer move at once (they had kept the sky until the next magic round). */
export function setFirmamentMentoring(on) {
  if (_mentoring === !!on) return;
  _mentoring = !!on;
  tell();
}
/** Told whenever the tree or the online word changes (the powers fold the entity again, the layer moves). */
export function onFirmamentChange(fn) { if (typeof fn === 'function') _listeners.add(fn); return () => _listeners.delete(fn); }

/** The tree as the host last handed it in. */
export const firmamentTree = () => _tree;
/** Whether the tree is in force: online, with a sign chosen. */
export const firmamentInForce = () => _online && !!_tree.start;
/** Every channel's capped total while the tree is in force; none otherwise. */
export const firmamentStats = () => (firmamentInForce() ? _stats : NONE);
/** One channel's capped total while the tree is in force, else 0. */
export const firmStat = (key) => (firmamentInForce() && !_mentoring ? _stats[key] ?? 0 : 0);
/** A gathering act's window, widened (or narrowed) by its `act.<profession>` channel: a multiplier, 1 with no tree. */
export const firmActMult = (profession) => 1 + firmStat(`act.${profession}`) / 100;

/** Tests only: no tree, offline, no listeners. */
export function _resetFirmamentLiveForTests() { _tree = EMPTY_TREE; _stats = NONE; _online = false; _mentoring = false; _listeners.clear(); }
