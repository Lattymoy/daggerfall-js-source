// STAFF-PANEL5-MESSAGE (2026-10-22, mob, 04:14Z: a message in the middle of one player's screen; design doc "DFO Staff
// Panel: design", Message on screen) - THE HUB'S HALF: a staff message's nudge, to one account's own sockets.
//
// The account service stores the message first and posts a signed order of its own kind ('smsg': the account `s` and the
// message's id `mi`, never its words) to the relay's door (index.js lawDoor), which hands it to the hub. Only that order
// makes the frame `{t:'smsg', mi}`: no socket's frame becomes one (wire.js parseClient knows no such frame in), and the
// game marks the message from the frame type alone, then reads its words off the service with its own session.
//
// FOUND BY ACCOUNT, as /tp @NAME finds a player by id (staffTeleport.js): the hub's sockets whose VERIFIED account is
// the order's (`sub`, the token's `s`) - on the bus every shard's too (each ShardSocket's attachment is its shard's).
// A socket on a build without the box (its hello said no `sm`) is counted and not sent (design doc, Weak spots: "Old
// game builds show no freeze screen or message box ... Message on screen reports 'old game, not shown'").
import { verifyOrder } from '../../src/net/identityToken.js';

/**
 * A staff message's order taken at the hub's door - answers `{ ok, n, old }`: whether it was an order this room believes,
 * the sockets handed the nudge, and the account's sockets on a build that cannot show it (the service's count, through
 * the Worker's answer - AUDIT SAFE RELAY-13a: the door's word is the hub's).
 * @param {any} room the hub (a Room) @param {unknown} order @param {number} now
 * @returns {Promise<{ ok: boolean, n?: number, old?: number }>}
 */
export async function takeStaffMessage(room, order, now) {
  if (typeof order !== 'string' || !order || order.length > 1024) return { ok: false };
  await room._loadKey();
  if (!room._verifyKey) return { ok: false };
  const r = await verifyOrder(order, room._verifyKey, { subtle: crypto.subtle, nowS: Math.floor(now / 1000), kind: 'smsg' });
  if (!r.ok) return { ok: false };
  const frame = JSON.stringify({ t: 'smsg', mi: r.claims.mi });
  let n = 0, old = 0;
  for (const ws of [...(room._bySub().get(r.claims.s) ?? [])]) {
    const a = room._attach(ws);
    if (!a.id || room._dead.has(ws) || room._gone.has(ws)) continue;
    if (a.sm !== 1) old++;
    else if (room._send(ws, frame)) n++;
  }
  return { ok: true, n, old };
}
