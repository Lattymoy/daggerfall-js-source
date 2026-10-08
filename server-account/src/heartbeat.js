// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SCALE4c (2026-10-08, Mac: "Do 1 2 and 3" - the scaling audit's "one heartbeat replacing the mail, beat and board
// polls", bible/11-Multiplayer/Scale-Arc.md): ONE REQUEST FOR THE THREE CLOCKS A PLAYER'S TAB KEEPS.
//
// A tab at play asked the service on three clocks of its own: the play beat every five minutes (/v1/account/played),
// the letterbox every three (/v1/mail/inbox), and the Notice Board of the town it stands in every minute
// (/v1/board/read, for the count that floats over its boards) - each its own request, each its own session to
// resolve. The client's heartbeat (src/net/heartbeat.js) now carries whichever of them is due in ONE request, and
// this answers each part EXACTLY as its own route answers it: the same function, the same body, the same refusal word
// (`{ error }` where the route would have said it with a status). Nothing a part answers depends on another riding with
// it, so a heartbeat is the three requests' answers under one session - and the three routes stand as they were, for
// the doors that ask them alone (a window's own read, an older client).
// ═══════════════════════════════════════════════════════════════════

import { creditPlay, accountKind } from './accounts.js';
import { inboxOf } from './letters.js';
import { readBoard } from './board.js';

/** The parts a heartbeat may carry - the body's own keys. */
export const HEARTBEAT_PARTS = Object.freeze(['beat', 'mail', 'board']);

/**
 * ONE HEARTBEAT: `beat: true` - a knock (/v1/account/played's `creditPlay`, the gap by this service's clock); `mail:
 * true` - a look at the box (/v1/mail/inbox's `inboxOf`, refused `mail-needs-account` to a guest as that route's door
 * refuses one); `board: <map>` - a town's Notice Board (/v1/board/read's `readBoard`, its refusals its own). A part the
 * body does not name is not answered; the order they are asked in is the routes' own, and none reads another's.
 * @param {{ db: any, nowS: number }} ctx @param {any} player @param {any} env @param {any} body
 */
export async function heartbeat(ctx, player, env, body) {
  /** @type {Record<string, any>} */
  const out = {};
  if (body?.beat === true) out.beat = await creditPlay(ctx, player.id);
  if (body?.mail === true) out.mail = accountKind(player) !== 'linked' ? { error: 'mail-needs-account' } : await inboxOf(ctx, player, env);
  if (body?.board !== undefined) out.board = await readBoard(ctx, player, env, body.board);
  return out;
}
