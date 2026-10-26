// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LOCKPICK (2026-10-26, the owner: "I want to build a detailed lock picking minigame and introduce a lockpick item";
// bible/06-Systems/Lockpicking.md) - A LOCK PICKED, ONE HOME. The module a host wires (HOST-SPLIT: fishHost.js's shape):
// a host hands it its player, the slot its windows go into and its ear, and calls `begin` where DFU rolled the pick -
//
//   scenes/worldModes.js     - a building's front door in Steal mode (PlayerActivate.ActivateStaticDoor's pick, :543-566);
//                              the street's slot (townTalk). A building's own doors are never locked (none picks there).
//   scenes/dungeonContext.js - a dungeon's door in Steal mode (DaggerfallActionDoor.AttemptLockpicking, through
//                              world/actionSystem.js onLockpickAttempt) and a locked chest or crate (SEARCH1's pick);
//                              the dungeon's slot.
//   scenes/world.js          - wires neither: its doors are worldModes' and its dungeons dungeonContext's.
//   scenes/exterior.js       - the fixed city: its building doors are worldModes' too (createWorldModes), so it picks as
//                              the street does.
//
// `begin` asks the pack for a LOCKPICK (systems/lockpick/lockpickItem.js) - none, and the lock says so and nothing is
// rolled, tallied or spent - and opens the lock's window (ui/lockpickDoor.js) over the tumblers (systems/lockpick/
// lockpickAct.js), DFU's chance for that lock at that site its tolerance. A pick that snaps is gone from the pack and
// tallies Lockpicking once (DFU's one tally an attempt - an attempt ends in a snap or an open); the last one gone ends the
// attempt. The lock opened tallies once more, the window shows the plug turn and shuts, and THEN the host's `onOpen` runs -
// DFU's success tail at each site (the chime, the line, the door opened, the building entered, the chest searched).
// Leaving costs nothing. DFU's retry gate (FailedSkillLevel, LastLockpickAttempt - "the skill must rise past the last
// failure") is not read here: a snapped pick is what a retry costs now (Ledger A, LOCKPICK).
// ═══════════════════════════════════════════════════════════════════
import { createLockpickAct } from '../systems/lockpick/lockpickAct.js';
import { lockSeed, lockBand } from '../systems/lockpick/lockpickLaw.js';
import { lockpickCount, spendLockpick } from '../systems/lockpick/lockpickItem.js';
import { createLockEar } from '../systems/lockpick/lockpickSounds.js';
import { createLockpickOverlay } from '../ui/lockpickDoor.js';
import { lookAtLockText, exteriorLockpickingChance, interiorLockpickingChance, LOCKPICKING_SUCCESS_TEXT } from '../world/actionSystem.js';
import { tallyCrimeGuildRequirements } from '../systems/crimeGuilds.js';
import { playerEntity, surfacePlayer } from '../characters/playerEntity.js';
import { setMidScreenText } from '../ui/midScreenText.js';
import { audio as bus } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import { tallySkill, skillValue, SKILLS } from '../systems/skills.js';
import { liveStat } from '../systems/statMods.js';
import { getPref } from '../systems/uiPrefs.js';
import { t } from '../systems/textManager.js';

/** How long the opened lock's plug is seen turning before its window shuts and the host's success tail runs (ms). */
export const OPEN_HOLD_MS = 650;

/** The words the host says outside the window (L10N4: read when said). */
export const LOCKPICK_HOST_WORDS = Object.freeze({
  need: () => t('lock.need', 'You need a lockpick to pick this lock.'),
  door: () => t('lock.what.door', 'the door'),
  /** A locked searchable - SEARCH1's lockable kinds, a chest or a crate - each its own words (searchables.js's names are
   *  English, and a name set into a sentence cannot take its language's article or case). */
  container: (/** @type {string} */ kind) => (kind === 'crate' ? t('lock.what.crate', 'the crate') : t('lock.what.chest', 'the chest')),
});

/**
 * @param {{ talk?: any, mount?: (overlay: any) => any, line?: (line: string) => void, player?: any, say?: (line: string) => void,
 *   audio?: any, changed?: () => void, gentle?: () => boolean, reduced?: () => boolean, rolls?: () => number,
 *   overlay?: (deps: any) => any }} deps
 *   `talk` the street's townTalk, whose slot and popup line the two below default to; `mount` hands the window to the
 *   host's slot; `line` the host's popup line (a front door's success); `player` the
 *   character (the one entity); `say` the mid-screen line (the refusal); `changed` the pack moved (a pick snapped);
 *   `overlay` the door (a test's stand-in)
 */
export function createLockpickHost({ talk = null, mount = (w) => talk?.showOverlay?.(w), line = (l) => talk?.say?.(l), player = playerEntity, say = setMidScreenText, audio = bus, changed = surfacePlayer,
  gentle = () => getPref('gentleActs') === true, reduced = defaultReduced, rolls = () => Math.random(), overlay = createLockpickOverlay }) {   // `rolls` read at the roll, not at the host's making
  let ear = null, dead = false;
  /** @type {any} */
  let open = null;
  const host = {
    /**
     * A LOCK MET IN STEAL MODE. `lock` its value; `chance` DFU's for it here (interiorLockpickingChance underground,
     * exteriorLockpickingChance at a front door); `exterior` a front door (the Auto attempt's roll its own); `key` the
     * lock's name, the same every visit (its pins bind the same way); `what` what it locks, as the window says it;
     * `onOpen` DFU's success tail. Answers true - the press is spent, whether the window opened or the lock refused.
     * @param {{ lock: number, chance: number, key: string, what?: string, exterior?: boolean, onOpen?: () => void }} o
     */
    begin({ lock, chance, key, what = LOCKPICK_HOST_WORDS.door(), exterior = false, onOpen = () => {} }) {
      if (dead || (open && !open.done)) return true;   // one lock at a time
      if (lockpickCount(player?.items) < 1) { say(LOCKPICK_HOST_WORDS.need()); return true; }
      const skill = skillValue(player, SKILLS.Lockpicking);
      const seed = lockSeed(key);
      const act = createLockpickAct({ lock, chance, seed, band: lockBand(liveStat(player, 'agility')), skill, exterior, rng: rolls });
      ear ??= createLockEar({ audio });
      let opened = false;
      const ov = overlay({
        act, what, seed, skill, gentle: gentle(), reduced,
        gone: () => player?.health <= 0,   // AUDIT LOCKPICK A3/A4: dead under it - the interior's slot is overwritten, never disposed
        difficulty: lookAtLockText(lock, player.level, skill),
        picks: () => lockpickCount(player?.items),
        onAnswer: (/** @type {string} */ a) => {
          ear.cue(a);
          if (a === 'break') {
            spendLockpick(player);
            tallySkill(player, SKILLS.Lockpicking, 1);   // TallySkill(Lockpicking, 1) - an attempt, ended by a snap
            changed();
            if (lockpickCount(player?.items) < 1) ov?.out?.();
          } else if (a === 'open') {
            opened = true;
            tallySkill(player, SKILLS.Lockpicking, 1);   // ...or by the lock opening
            setTimeout(() => ov?.shut?.(), OPEN_HOLD_MS);
          }
        },
        // AUDIT LOCKPICK A3: the success tail only when the window shut itself or by the player's hand - a death screen
        // (or any window) replacing it in its hold ran the tail under it: a corpse walked into the house
        onClose: (/** @type {boolean} */ self) => { if (open === ov) open = null; if (opened && self && !dead && !(player?.health <= 0)) onOpen(); },
      });
      if (!ov) return true;
      open = ov;
      mount(ov);
      return true;
    },
    /**
     * A BUILDING'S FRONT DOOR (worldModes.js activateStaticDoor's pick, PlayerActivate.cs:543-566): DFU's exterior chance
     * for its `lock` at `skill` Lockpicking; opened, CG2's tally lands BEFORE the success text and the unlock sound, as
     * PlayerActivate.cs:552 has it - a picked exterior lock IS a break-in and counts one toward the Thieves Guild's ten (a
     * window left broke into nothing, and tallies nothing) - and `enter` activates the door again, picked.
     * @param {{ lock: number, skill: number, key: string, enter: () => void }} o
     */
    frontDoor({ lock, skill, key, enter }) {
      return host.begin({
        lock, chance: exteriorLockpickingChance(lock, skill), exterior: true, key,
        onOpen: () => { tallyCrimeGuildRequirements(player, true, 1); line(LOCKPICKING_SUCCESS_TEXT); audio?.playOneShot?.(SOUND.ActivateLockUnlock, 1); enter(); },
      });
    },
    /**
     * A LOCK UNDERGROUND - a dungeon's door, a chest or a crate: DFU's interior chance (CalculateInteriorLockpickingChance)
     * at the character's level and its live Lockpicking. `begin`'s own `lock`, `key`, `what` and `onOpen`.
     * @param {{ lock: number, key: string, what?: string, onOpen?: () => void }} o
     */
    inside({ lock, key, what, onOpen }) {
      return host.begin({ lock, chance: interiorLockpickingChance(player.level, lock, skillValue(player, SKILLS.Lockpicking)), key, what, onOpen });
    },
    /**
     * AN ACTION GRAPH'S LOCKED DOORS (world/actionSystem.js onLockpickAttempt - the magic arm stays the roll's): each picked
     * in the window at DFU's interior chance; opened, swung through the graph's own seam (`lockpicked`: WORLD3's change, and
     * never a door a peer swung first) and DFU's success said - the graph's own `onLockpickResult` where it has one (the
     * dungeon's), else the host's line and chime (a building's). `place` names the graph: a door's lock is `place:key`. AUDIT LOCKPICK A4: a
     * building's doors a Lock spell locked were never pickable - the graph had no hook, and DFU's roll it fell to read a
     * Lockpicking of 0 against a retry gate of 0.
     * @param {any} actions @param {string} place
     */
    wire(actions, place) {
      if (!actions) return;
      actions.onLockpickAttempt = (o) => host.inside({ lock: o.currentLockValue, key: `${place}:${o.key}`, onOpen: () => {
        if (!actions.lockpicked(o)) return;
        if (actions.onLockpickResult) actions.onLockpickResult(o, true);
        else { line(LOCKPICKING_SUCCESS_TEXT); audio?.playOneShot?.(SOUND.ActivateLockUnlock, 1); }
      } });
    },
    /** Whether a lock's window is up. */
    get busy() { return !!open && !open.done; },
    /** The host's end: a lock's window still up is shut, its success tail never run. */
    dispose() { dead = true; const o = open; open = null; o?.dispose?.(); },
  };
  return host;
}

/** The system's reduced motion (the professions' own reading - ui/professions/profHud.js). */
function defaultReduced() {
  try { return !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches; } catch { return false; }
}
