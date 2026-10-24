// @ts-check
// LOST-SPOILS (2026-10-22, the owner: "I want to utilize the mailbox as a way to obtain lost items/loot if not picked up
// from a boss"; asked, "Mail the leftovers"): THE LOST AND FOUND, AS THIS CLIENT SEES IT - the one route a floor's
// leftovers are sent by, and the door the spoils pools are handed (scenes/spoilsPool.js `mail`): the gate's court and the
// Hour's pool (the Brass Remnant's arena and a breach's Redoubts). The law is net/lostLaw.js; the service's half,
// server-account/src/lostSpoils.js.
//
// The box (net/serverPost.js PostBox) is the mailbox's own: it says whether post can be taken now (`ready` - a registered
// account, looked at), carries the session a send goes on, and is told to look again when a send lands, so the envelope
// counts the pieces and the world tab says them as any post. A box that is not ready - a guest, signed out, not yet
// looked at - sends nothing, and the pool gives the floor to the pack, as it always did.
import { call } from './accountClient.js';
import { LOST_FINAL } from './lostLaw.js';

/** Send a floor's leftovers: `{ day, pieces: [{ i, item }] }` - `{ ok, sent, kept }`. */
export const lostCall = (io, { day, pieces }) => call(io, '/v1/post/lost', { day, pieces });

/** What an answer means to the pool: 'ok', 'refused' (it will never be a yes - net/lostLaw.js LOST_FINAL) or 'later'.
 *  @returns {'ok'|'refused'|'later'} */
export const lostAnswerOf = (/** @type {any} */ r) => (r?.ok ? 'ok' : LOST_FINAL.includes(r?.error) ? 'refused' : 'later');

/**
 * THE POOLS' DOOR TO THE LOST AND FOUND (scenes/spoilsPool.js `mail`).
 * @param {{ box: () => any, say?: (text: string) => void }} o  `box` the host's PostBox (or null), `say` where the pools'
 *   lines about it go (the chat, beside the post's own notices)
 */
export function lostSpoilsMail({ box, say = () => {} }) {
  return {
    ready: () => box()?.state === 'ready',
    /** @param {{ day: any, pieces: Array<{ i: number, item: any }> }} o */
    async send(o) {
      const io = box()?.ioOf?.() ?? null;
      if (!io?.secret) return /** @type {'later'} */ ('later');
      return lostAnswerOf(await lostCall(io, o));
    },
    sent: () => { box()?.refresh?.()?.catch?.(() => {}); },
    say,
  };
}
