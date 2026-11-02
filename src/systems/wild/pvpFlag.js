// @ts-check
// PVP-FLAG (the PvP rework, 2026-10-28/29 - the owner: "green to be no flag flagging gives a skull above your head and
// villians get a red skull", "need to be instant", "make it a min", "u flag and un flag instanly", "u cant flag on a party
// member", "flaggin is so yu dont hit a player when ur trying to kill a monster"): unflagged, my blows touch no player; the
// flag never shields its bearer. The flag goes up at once (Caps Lock or the HUD
// button) from level 30; it comes down at once, but never within PVP_FLAG.lockMs of the last PvP blow given or taken. A
// party member stays kin (net/wild/wildRef.js wildKin). The relay holds the same lock (wildRef.js wildZone). Pure. A
// departure: DFU has no PvP.
import { t } from '../textManager.js';

/** The lock after a PvP blow (a flagged fighter's aggro, its skull gold), the level the flag is open from, and how often
 *  the referee says a fighter's aggro again while its blows go on. */
export const PVP_FLAG = Object.freeze({ lockMs: 60_000, level: 30, sayMs: 10_000 });

/** Why the flag may not go to `on` now, or null. `level` my level; `fightAt` my last PvP blow given or taken; `red` I am
 *  a villain (systems/wild/villainLaw.js). */
export function pvpFlagRefusal({ on, level = 1, fightAt = -Infinity, now = 0, red = false }) {
  if (on) return level >= PVP_FLAG.level ? null : t('pvp.flag.level', 'PvP opens at level {n}.', { n: PVP_FLAG.level });
  if (red) return t('pvp.flag.villain', 'You are a villain. Your PvP flag stays on.'); // PVP-VILLAIN: always in aggro
  const left = PVP_FLAG.lockMs - (now - fightAt);
  return left > 0
    ? t('pvp.flag.locked', 'You are in combat. You can turn PvP off in {s} s.', { s: Math.ceil(left / 1000) })
    : null;
}

/** May the flag come down, by the relay's clock? Its last fight `fightAt`. */
export const pvpFlagCanDrop = (fightAt, now) => !(now - fightAt < PVP_FLAG.lockMs);

/** The aggro left on a fighter, ms (0 none): its last PvP blow given or taken `fightAt`. */
/** PVP-30: is a character at `cl` (the level its token signs) too young for PvP - no blow given or taken? A token with no
 *  level is not judged here; the game's own flag refuses it (pvpFlagRefusal). */
export const pvpYoung = (cl) => Number.isSafeInteger(cl) && cl < PVP_FLAG.level;

export const pvpAggroLeft = (fightAt, now) => Math.max(0, Math.min(PVP_FLAG.lockMs, PVP_FLAG.lockMs - (now - fightAt)));
