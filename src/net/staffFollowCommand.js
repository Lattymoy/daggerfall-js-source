// CHAT-FIND-FOLLOW (mob, 2026-10-24: "need to add follor to find a player in chat as well"): /follow <player>, the staff's
// chat line that finds a player as /tp @player does - by name, from the hub's where note where the relay has one - and
// follows them with no move: the follow host (scenes/staffFollowHost.js) enters their place once the follow is locked,
// which a Staff Panel over the game mints, as every staff follow. The `@` is welcome and not needed.
//
// Its own module, never net/staffCommands.js or net/staffTeleport.js: the relay reads both, and a byte changed in either
// is a new relay law (test/net/relayversion.test.js SLAM8) - a relay deploy that drops every player for a client line.
// Not a DFU member: Daggerfall has no other players.
import { t } from '../systems/textManager.js';

/** `/follow <player>` read: `{ cmd: 'follow', player }`, `{ error }` with no name, or null for any other line.
 *  @param {string} text */
export function parseFollowCommand(text) {
  const m = /^\/follow(?:\s+([\s\S]*))?$/i.exec(String(text ?? '').trim());
  if (!m) return null;
  const player = (m[1] ?? '').replace(/\s+/g, ' ').trim().replace(/^@\s*/, '');
  return player ? { cmd: 'follow', player } : { error: t('net.staffFollow.usage', 'Usage: /follow <player>.') };
}

/** The line `/staff` adds for it, in the player's language. */
export const followHelpLine = () => t('net.staffFollow.help', '/follow <player> - watch through their eyes, unseen (needs the Staff Panel)');

/** /tp @player's own ask, by name and from the hub's where note, and nothing moved.
 *  @param {{ ask: (target: any) => Promise<any> }} client @param {string} name */
export const findStaffPlayer = (client, name) => client.ask({ name, nt: 1 });

/** The line a /follow ends on - the player found, or found with no account to follow (a relay that names none).
 *  @param {{ name: string, acct?: string }} who */
export function staffFollowLine(who) {
  return who.acct ? t('net.staffFollow.found', 'Following {name}.', { name: who.name }) : t('net.staffFollow.noAccount', 'Found {name}, but the server did not say their account, so they cannot be followed.', { name: who.name });
}
