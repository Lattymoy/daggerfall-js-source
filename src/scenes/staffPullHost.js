// @ts-check
// STAFF-PULL (2026-10-28) - BRING A PLAYER TO ME, out of bootWorld (HOST-SPLIT).
// Staff side: my own place (the /tp capture) goes to the hub with the player named (net/staffTeleport.js `pull`).
// Player side: the hub's `pull` lands me there through the /tp loader, and my game answers the hub. The relay
// (server/src/staffTeleport.js routeStaffPull) lets only an Admin or the Shadow Fang ask.
import { staffPullLine, staffPulledLine, staffPullAllowed } from '../net/staffTeleport.js';
import { t } from '../systems/textManager.js';

/** `client()` the hub's staff TP client; `glyphs()` mine; `here()` my place as `{ dest }` or `{ error }`; `prepare(d,
 *  allowed)` and `place(d)` the /tp loader; `why()` why I cannot be moved now (a STAFF_TP_ERRORS word) or null;
 *  `alive()` whether the landing may go on once begun; `hold(on)` the motor; `fade` the black screen; `say(line)` a
 *  system line to every tab.
 *  @param {{ client: () => any, glyphs: () => string[], here: () => any, prepare: (d: any, allowed: () => boolean) => Promise<any>, place: (d: any) => void, why: () => string | null, alive: () => boolean, hold: (on: boolean) => void, fade: any, say: (line: string) => void }} deps */
export function createStaffPull({ client, glyphs, here, prepare, place, why, alive, hold, fade, say }) {
  return {
    /** Staff: /tpa <player>, its lines to the typer (`tell`). @param {string} player @param {(line: string) => void} tell */
    command(player, tell) {
      if (!staffPullAllowed(glyphs())) {
        tell(t('net.staffPull.denied', 'Only an admin or the Shadow Fang may bring a player.'));
        return;
      }
      this.pull({ name: player }).then(tell, (e) =>
        tell(e?.message || t('net.staffPull.failed', 'The player could not be brought.')),
      );
    },
    /** Staff: bring `target` (`{ id }`, `{ acct }` or `{ name }`) to where I stand. Resolves the line to say. */
    async pull(/** @type {any} */ target) {
      const c = client();
      if (!c) throw new Error('Bringing a player requires an online connection.');
      const mine = here();
      if (!mine?.dest) throw new Error('Your own position cannot be sent from here.');
      return staffPullLine(await c.pull(target, mine.dest));
    },
    /** Player: the hub's pull. Resolves `{}` once landed, or `{ error }`. @param {any} dest */
    async land(dest) {
      const no = why();
      if (no) return { error: no };
      hold(true);
      fade.smashHUDToBlack();
      try {
        await prepare(dest, alive);
        if (!alive()) throw new Error('cancelled');
        place(dest);
        say(staffPulledLine());
        return {};
      } catch (e) {
        console.warn('[staff] pull landing:', /** @type {any} */ (e)?.message ?? e);
        return { error: 'unavailable' };
      } finally {
        hold(false);
        fade.fadeHUDFromBlack();
      }
    },
  };
}
