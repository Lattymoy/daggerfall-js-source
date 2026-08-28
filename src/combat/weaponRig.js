// The FP-weapon HOST RIG (C9): one bundle of the classic-weapon
// surface for hosts that own a motor but had NO weapon - the interior
// mode and both exterior walk hosts (the weapon-audit follow-up: "the
// voxel path was dungeon-only too"). Every law here mirrors the
// AUDITED dungeon implementation (dungeonContext.js) verbatim:
// WeaponManager's sheathe/ShowWeapons legs, FPSWeapon's bow guards,
// the drag-to-swing gesture seam, the swing-sound edge, and the
// WeaponEnvDamage swing ray. dungeonContext keeps its own inline copy
// FOR NOW - that file is the parallel FP lane's active surface and
// has conflicted on every merge today; folding it onto this rig is a
// recorded residual (Combat.md), not an accident.
//
// Hosts without foes still get the full classic feel: ready/sheathe
// on Z (DrawWeapon 78 on unsheathing a real weapon), RMB drag or
// click to swing with the pitch-matched swing sound, bows consuming
// an Arrow per loose with the zero-arrow auto-sheathe, and the
// optional environment-attack ray (interiors: bash/Receive on action
// objects; open exteriors have nothing in reach).

import { PlayerWeapon, WEAPON_REACH } from './playerWeapon.js';
import { racialFpsWeapon } from '../systems/lycanthropy.js';   // V4: the transformed rig's claws
import { EQUIP_SLOTS } from '../systems/equip.js';   // AUDIT 17e F17
import { loadFpsWeaponArt, drawFpsWeapon, weaponTypeForItem, WEAPON_TYPES } from './fpsWeapon.js';
import { worldAabb, rayAabb } from '../player/activate.js';
import { SOUND } from '../systems/soundClips.js';
import { equipSoundFor } from '../characters/weapons.js';   // F023: GetEquipSound

/**
 * @param deps {
 *   renderer, canvas, fetchBytes, palette, audio,
 *     (canvas may be the element OR a () => element - the dungeon
 *      context only holds a canvas per frame, C10),
 *   entity          - the player entity (arrow stock reads it),
 *   say(line)       - the classic-message sink ('You have no arrows.');
 *                     hosts without a HUD text layer pass console
 *                     (FLAGGED at the call sites - their HUD pends),
 *   spellArmed()    - optional: WeaponManager's HasReadySpell leg
 *                     (hosts without casting omit it),
 * }
 */
export function createWeaponRig({ renderer, canvas, fetchBytes, palette, audio, entity, say = () => {}, spellArmed = () => false, bindWorn = true }) {
  const playerWeapon = new PlayerWeapon({});
  // AUDIT 17e F17 / THE FOUR HOSTS RULE: U8h bound the worn weapon in
  // the two EXTERIOR hosts by hand, so the interior host (which owns
  // its own rig) kept swinging the interim dagger inside every
  // building, and the dungeon host was flagged but unwired. The bind
  // belongs to the rig: every host that passes an entity inherits it.
  // bindWorn:false is for rigs that manage their own weapon (the
  // dungeon's scripted bow demo).
  const syncWorn = () => {
    if (!bindWorn || !entity) return;
    // V4: SetFPSWeapon (LycanthropyEffect.cs:332-345) - while
    // transformed the rig IS the wereclaws, whatever the hand holds;
    // the per-frame sync makes the swap live the moment of the morph.
    const claws = racialFpsWeapon(entity);
    if (claws) { playerWeapon.weapon = claws; return; }
    if (!entity.equip?.slots) return;
    playerWeapon.weapon = entity.equip.slots[EQUIP_SLOTS.RightHand] ?? null;
  };
  const cv = typeof canvas === 'function' ? canvas : () => canvas;
  const cache = new Map();   // `${type}:${material}` -> art (null while loading)
  let _dx = 0, _dy = 0, _held = false;

  function artFor(item) {
    if (!palette) return null;
    const type = weaponTypeForItem(item);
    if (type === WEAPON_TYPES.None) return null;
    const key = `${type}:${item?.material ?? 0}`;
    if (!cache.has(key)) {
      cache.set(key, null);
      loadFpsWeaponArt(fetchBytes, palette, renderer, type, item?.material ?? 0)
        .then((art) => cache.set(key, art))
        .catch((e) => console.warn('[weaponRig] art load failed', key, e));
    }
    return cache.get(key);
  }

  /** WeaponManager.Update's ShowWeapons legs, verbatim order.
   *  FX1 (F024/F025) rebuilt both clocks:
   *  - the bow COOLDOWN is an EARLY RETURN (:230-233), leaving
   *    ShowWeapon at its prior value - the bow stays DRAWN through
   *    the ~1.3s cooldown instead of blinking out and popping back.
   *    The latch below is that "prior value".
   *  - a running EQUIP countdown shows EMPTY HANDS (:275-281) - the
   *    port drew the new weapon while silently refusing attacks,
   *    which was the block half without its cue. */
  let _lastShown = false;
  function shown() {
    const m = playerWeapon.machine;
    if (m.isBow && m.now < m.cooldownUntil) return _lastShown;   // F024: the early return freezes the state
    let v = true;
    if (spellArmed()) v = false;                               // HasReadySpell / IsPlayingAnim
    else if ((entity?.equipCountdown ?? 0) > 0) v = false;     // F025: empty hands while equipping
    else if (playerWeapon.sheathed) v = false;
    _lastShown = v;
    return v;
  }

  /** FPSWeapon.UpdateWeapon's bow guard: an UNsheathed bow with zero
   *  Arrows auto-sheathes with the classic line. */
  function bowArrowGuard() {
    if (playerWeapon.sheathed) return;
    if (weaponTypeForItem(playerWeapon.weapon) !== WEAPON_TYPES.Bow) return;
    if (entity.items?.some((it) => it.templateIndex === 131 && (it.stackCount ?? 1) > 0)) return;
    playerWeapon.sheathed = true;
    say('You have no arrows.');
  }

  return {
    playerWeapon,
    /** Host mouse events buffer here (sheathed = no attack processing).
     *  CH3 (characters-13): a running SWAP PAUSE blocks the attack
     *  the same way (WeaponManager.cs:276-278 returns before the
     *  swing while the used hand's countdown runs). */
    attackInput(dx, dy, held) {
      if (playerWeapon.sheathed || (entity?.equipCountdown ?? 0) > 0) return;
      _dx += dx; _dy += dy; _held = held;
    },
    /** ClickToAttack for the touch button. */
    clickAttack() { if (!playerWeapon.sheathed && (entity?.equipCountdown ?? 0) <= 0) playerWeapon.clickAttack(); },
    /** ToggleSheath + the draw sound on unsheathing a real weapon.
     *  AUDIT 26 F023: the clip is the WEAPON's own GetEquipSound
     *  (WeaponManager.SetWeapon :780 overwrites DrawWeaponSound with
     *  it on every applied weapon, and FPSWeapon.ToggleSheath :295
     *  plays that field) - eight clips by weapon type, not the 78
     *  default, which no applied weapon ever reaches. A weapon with
     *  no equip clip of its own falls back to 78. */
    toggleSheath() {
      syncWorn();
      // V4: the claws draw silently (DrawWeaponSound = None, :338)
      if (playerWeapon.toggleSheath() && !playerWeapon.weapon?.werecreatureClaws) {
        audio.playOneShot(equipSoundFor(playerWeapon.weapon) ?? SOUND.DrawWeapon);
      }
    },
    /**
     * Per-frame: gesture consume, the swing-sound edge, machine step.
     * @returns the machine's events ('hit' on the strike frame) - the
     *   host resolves them (or ignores them where nothing is in reach).
     */
    frame(dt, { paralyzed = false } = {}) {
      syncWorn();   // AUDIT 17e F17: the rig owns the worn-weapon bind
      // CH3 (characters-13): the swap pause drains at the classic
      // approximation - dt x 980 units/second, clamped at 0
      // (WeaponManager.cs:677-693).
      if (entity && (entity.equipCountdown ?? 0) > 0) {
        entity.equipCountdown = Math.max(0, entity.equipCountdown - dt * 980);
      }
      const c = cv();
      if (!paralyzed && c) playerWeapon.gesture(_dx, _dy, _held, dt, Math.max(c.clientWidth, c.clientHeight));
      _dx = 0; _dy = 0;
      // AUDIT 23 (C9): the strike-ENTRY whoosh is gone - DFU plays the
      // swing sound at the HIT FRAME of a swing that hit no enemy
      // (WeaponManager.cs:1059 else-arm) and at bow frame 4 (:376-380),
      // both of which ride the machine's events at the hosts now.
      return paralyzed ? [] : playerWeapon.update(dt);
    },
    /** The overlay draw, LAST in the host's frame (composites over the
     *  scene; any HUD draws over it). Runs the bow guard first. */
    draw({ paralyzed = false } = {}) {
      bowArrowGuard();
      if (paralyzed || !shown()) return;
      const c = cv();
      const art = c && artFor(playerWeapon.weapon);
      if (art) drawFpsWeapon(renderer, c, art, playerWeapon.machine.state, playerWeapon.machine.frame);
    },
  };
}

/**
 * WeaponEnvDamage's swing ray, verbatim shape (mirrors the audited
 * dungeon site): the nearest action object along the look within
 * weapon reach, world geometry occluding; a DOOR hit is BASHED and
 * consumes the swing, any other action object gets Receive(Attack)
 * (the gate table filters) and the swing continues in DFU - with no
 * foes in these hosts there is nothing further to resolve.
 */
export function envAttack(actions, collider, eye, lookDir, rolls = Math.random) {
  let best = null, bestD = Infinity;
  for (const o of actions.objects.values()) {
    const box = o.aabb ?? (o.cpu ? worldAabb(o.cpu.positions, o.matrix) : null);
    if (!box) continue;
    const d = rayAabb(eye, lookDir, box);
    if (d === null || d > WEAPON_REACH || d >= bestD) continue;
    const wall = collider.raycast(eye, lookDir, d - 0.05);
    if (Number.isFinite(wall) && wall < d - 0.05) continue;   // occluded
    best = o; bestD = d;
  }
  if (!best) return false;
  // FX1 (F182): Receive(player, Attack) fires on ANY struck object
  // carrying an action FIRST - an action door is one GameObject with
  // both components in DFU (WeaponManager.cs:458-465) - and only THEN
  // a door bashes (:467-472). The old door-only branch meant an
  // Attack- or MultiTrigger-flagged door record (Castle Wayrest's
  // doors are MultiTrigger) never fired on a weapon hit, because the
  // bash path passes the Door trigger alone, which those records
  // reject.
  actions.receive(best, 'Attack');
  if (best.kind === 'door') { actions.attemptBash(best, rolls()); return true; }
  return false;
}
