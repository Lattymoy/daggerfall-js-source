// @ts-check
// QUEST-AUDIT IV C2, AUDIT QA4 B1 (bible/01-Overview/audits/Quest-Audit-IV.md): WHETHER AN ACCOUNT'S CLIMB ONLINE IS OVER -
// the Grand Champion beaten, as its Arena board last said. The Herald's Call waits on a bout the Herald still offers
// (systems/questlines/qlLineRunner.js NEED_CHECKS). Kept by account and on the device, so a page knows it before the
// board is asked and another account signed in never reads it; an account never heard here reads as a bout left.
// The client's alone: the relay and the account service read systems/arena/arenaLadder.js, never this.
import { nextLadderBout } from './arenaLadder.js';
import { appStorage } from '../appStorage.js';

/** The device's accounts whose climb is over: `{ [account]: 1 }`. */
export const LADDER_DONE_KEY = 'arena.ladderDone';
/** @type {Map<string, boolean>} */
const _heard = new Map();

/** @returns {Record<string, number>} */
function kept() {
  try { const v = JSON.parse(appStorage()?.getItem(LADDER_DONE_KEY) ?? 'null'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}

/** An account's board heard: its climb (`board.me.ladder`). @param {any} L @param {?string} account */
export function noteLadderDone(L, account) {
  if (typeof account !== 'string' || !account) return;
  const done = L != null && nextLadderBout(L) == null;
  _heard.set(account, done);
  const all = kept();
  if (done === (all[account] === 1)) return;
  if (done) all[account] = 1; else delete all[account];
  try { appStorage()?.setItem(LADDER_DONE_KEY, JSON.stringify(all)); } catch { /* the page's own memory holds it */ }
}

/** Is `account`'s climb over, as last heard (this page, else the device)? @param {?string} account */
export function ladderDoneFor(account) {
  if (typeof account !== 'string' || !account) return false;
  return _heard.get(account) ?? kept()[account] === 1;
}

/** Tests: the page's memory forgotten. */
export function _forgetLaddersForTests() { _heard.clear(); }
