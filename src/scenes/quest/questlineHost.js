// @ts-check
// QL12 (bible/06-Systems/Questlines-Arc.md section 7): THE QUESTLINES' SEAM WITH THE PAGE - what the line runner
// (systems/questlines/qlLineRunner.js) needs of the world outside the machine, made once by the quest bridge
// (scenes/quest/questBridge.js, THE ONE CONSTRUCTION SEAM) so no host builds or carries it: the account service's door
// for the endgame lines' claims, on an online page alone (net/accountClient.js accountQuestlines). Offline, and on a
// page with no service, null - the endgame lines then wait, and the introductions run as ever.
import { isOnlinePage } from '../../systems/online/onlineLane.js';
import { accountQuestlines } from '../../net/accountClient.js';
import { appStorage } from '../../systems/appStorage.js';

/**
 * The service's door, or null off an online page. `fetch` and `storage` are the page's own unless a caller hands them.
 * @param {{ search?: string, fetch?: any, storage?: any }} [opts]
 */
export function questlineService({ search, fetch, storage } = {}) {
  if (!isOnlinePage(search)) return null;
  return accountQuestlines({ fetch: fetch ?? ((u, i) => globalThis.fetch(u, i)), storage: storage ?? appStorage() });
}

/** Is a line's service there to ask - an online page with an account signed in? */
export const serviceReady = (service) => !!service && !!service.account?.();
