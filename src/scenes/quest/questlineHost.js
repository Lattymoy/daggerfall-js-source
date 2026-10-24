// @ts-check
// QL12 (bible/06-Systems/Questlines-Arc.md section 7): THE QUESTLINES' SEAM WITH THE PAGE - what the line runner
// (systems/questlines/qlLineRunner.js) needs of the world outside the machine, made once by the quest bridge
// (scenes/quest/questBridge.js, THE ONE CONSTRUCTION SEAM) so no host builds or carries it: the account service's door
// for the endgame lines' claims, on an online page alone (net/accountClient.js accountQuestlines). Offline, and on a
// page with no service, null - the endgame lines then wait, and the introductions run as ever.
//
// T-B (bible/06-Systems/Witches-Festival.md "The Starwarden's purse"): a claim's answer that paid a line's purse of Soul
// Cakes (`purse` - server-account/src/questlines.js QL_PURSES, onto the account's count) is heard at this door, whatever
// the runner makes of the rest: said as a find is, and the pack's Soul Cakes restacked through the festival's own door
// (systems/festival/festivalClient.js refreshFestival - its answer's count, soulCake.js restackSoulCakes).
import { isOnlinePage } from '../../systems/online/onlineLane.js';
import { accountQuestlines } from '../../net/accountClient.js';
import { appStorage } from '../../systems/appStorage.js';
import { refreshFestival, festivalDoors } from '../../systems/festival/festivalClient.js';
import { cakesFoundText } from '../../systems/festival/festivalWords.js';

/**
 * T-B: A CLAIM'S PURSE HEARD - `+30 Soul Cakes` said through the festival's doors and the account's count read again (the
 * pack restacked to it). Answers whether a purse was paid.
 * @param {any} answer the door's answer (`{ ok, data }`)
 * @param {{ say?: (line: string) => void, refresh?: () => Promise<any> }} [doors]
 */
export function hearPurse(answer, { say = (line) => festivalDoors().say(line), refresh = refreshFestival } = {}) {
  const n = answer?.ok ? answer.data?.purse : null;
  if (!Number.isSafeInteger(n) || n <= 0) return false;
  try { say(cakesFoundText(n)); } catch { /* a door's throw is not the claim's */ }
  refresh().catch(() => {});
  return true;
}

/**
 * The service's door, or null off an online page. `fetch` and `storage` are the page's own unless a caller hands them.
 * @param {{ search?: string, fetch?: any, storage?: any }} [opts]
 */
export function questlineService({ search, fetch, storage } = {}) {
  if (!isOnlinePage(search)) return null;
  const door = accountQuestlines({ fetch: fetch ?? ((u, i) => globalThis.fetch(u, i)), storage: storage ?? appStorage() });
  return { ...door, claim: async (body) => { const a = await door.claim(body); hearPurse(a); return a; } };
}

/** Is a line's service there to ask - an online page with an account signed in? */
export const serviceReady = (service) => !!service && !!service.account?.();
