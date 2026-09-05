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
// a12: and the HAND. The rig is where WeaponManager's per-frame
// UpdateHands/ApplyWeapon pair lands (syncWorn) and where SwitchHand's
// release edge arrives (switchHand); the state and the laws themselves
// are playerWeapon's.
//
// Hosts without foes still get the full classic feel: ready/sheathe
// on Z (DrawWeapon 78 on unsheathing a real weapon), H to switch the
// swinging hand, RMB drag or
// click to swing with the pitch-matched swing sound, bows consuming
// an Arrow per loose with the zero-arrow auto-sheathe, and the
// optional environment-attack ray (interiors: bash/Receive on action
// objects; open exteriors have nothing in reach).

import { PlayerWeapon, WEAPON_REACH } from './playerWeapon.js';
import { racialFpsWeapon } from '../systems/lycanthropy.js';   // V4: the transformed rig's claws
import { EQUIP_SLOTS, equipTableOf } from '../systems/equip.js';   // AUDIT 17e F17; MW-D32 the worn read
import { dfWornEquipment } from '../formats/mwItemMap.js';   // MW-D32
import { ARMOR_ENUM } from './enemyEquipment.js';   // MW-D32
import { loadFpsWeaponArt, drawFpsWeapon, weaponTypeForItem, WEAPON_TYPES } from './fpsWeapon.js';
// ROAD-tail (FPSSpellCasting.cs): the classic spellcasting HANDS. A
// separate component in DFU and a separate module here, drawn by the
// same rig because this is the one surface every FPS-weapon host
// already mounts - so wiring it here wires all four at once.
import { fpsSpellCasting, loadSpellCastArt, drawSpellCastHands, magicAnimFilename } from './fpsSpellCasting.js';
// MW-D8: the classic sprite is still the DEFAULT and still the fallback,
// and runs untouched otherwise. The Morrowind arm below is an opt-in
// layer that either draws whole or does not draw at all - there is no
// state in which both reach the screen, and none in which neither does.
import { fpArm, hasDaggerfallArrows } from './fpArm.js';
import { mwRaceId } from '../formats/mwNpc.js';   // TR2: the one race-id spelling
import { morrowindDataGeneration } from '../scenes/dataSource.js';
import { worldAabb, rayAabb } from '../player/activate.js';
import { SOUND } from '../systems/soundClips.js';
import { equipSoundFor } from '../characters/weapons.js';   // F023: GetEquipSound

/**
 * TR2: THE ARMS-BUILD OPTS, ONE HOME. The pause card and the Test
 * Room boot both translate the LIVE ENTITY into fpArm.build's
 * options; two copies of that translation is how the card built one
 * character while the frame followed another. It lives here because
 * this module already owns the per-frame half of the same seam
 * (setWeapon/setWorn below read the same table).
 *
 * AND THE GENDER FIX: `gender` is the STRING 'male'/'female'
 * everywhere in this port (chargen.js applyCharacter,
 * classicSave.js:624), so the card's old `female: !!playerEntity
 * .gender` was TRUE FOR EVERYONE - every build asked for the female
 * skeleton and the female body columns, and the male-record fallback
 * fills made it look almost right. The test is the string compare,
 * the same one every other consumer makes.
 */
export function armBuildOptsOf(entity) {
  return {
    race: mwRaceId(entity.race),
    female: entity.gender === 'female',
    faceIndex: entity.faceIndex | 0,
    armor: dfWornEquipment(equipTableOf(entity), EQUIP_SLOTS, ARMOR_ENUM),
    weapon: entity.equip?.slots?.[EQUIP_SLOTS.RightHand] ?? null,
    hasAmmo: hasDaggerfallArrows(entity.items),
  };
}

/** The build itself, from the live entity - seconds long and
 *  synchronous (the BSA index, the ESM walk, every mesh parse), so
 *  callers run it at a pause or a boot, never per frame. */
export function buildArmsFor(entity) {
  return fpArm.build(armBuildOptsOf(entity));
}

/**
 * @param deps {
 *   renderer, canvas, fetchBytes, palette, audio,
 *     (canvas may be the element OR a () => element - the dungeon
 *      context only holds a canvas per frame, C10),
 *   entity          - the player entity (arrow stock reads it),
 *   say(line)       - the classic-message sink ('You have no arrows.').
 *                     The note that hosts without a HUD text layer
 *                     pass console is retired: every call site hands
 *                     over a real one - hudText.add
 *                     (dungeonContext.js:1958), townTalk.say
 *                     (exterior.js:1108, world.js:2049) and
 *                     worldModes' own interior sink (worldModes.js:347,
 *                     which warns to console only where a host mounts
 *                     no townTalk at all), so the empty default below
 *                     is unreached,
 *   spellArmed()    - optional: WeaponManager's HasReadySpell leg
 *                     (hosts without casting omit it),
 * }
 */
export function createWeaponRig({ renderer, canvas, fetchBytes, palette, audio, entity, camera = null, say = () => {}, spellArmed = () => false, bindWorn = true, activateHeld = () => false }) {   // AUDIT 28 W12: HasAction(ActivateCenterObject) - the drawn bow's un-draw
  const playerWeapon = new PlayerWeapon({});
  // MW-D8. `camera` is REQUIRED for the Morrowind arm and there is no
  // fallback: a host that does not pass one gets the classic sprite and
  // a named reason, never a plausible arm in the wrong place. An arm
  // drawn at the world origin while the player stands elsewhere is the
  // shape of failure this arc keeps shipping.
  //
  // AUDIT 39: AND THE BINDING FOLLOWS THE FRAME, not the constructor.
  // fpArm is a module SINGLETON and attach() is its only writer, so the
  // LAST rig built owned it: one dungeon visit rebound the arm to that
  // context's per-frame eye latch, and leaving never restored it - the
  // latch's closure keeps its last value, so afterwards the exterior
  // rig drove the arm off a frozen pose and the walk/run/sneak/jump
  // selection ran forever on whatever the player was doing on the last
  // dungeon frame. The reference re-derives the state from the live
  // actor every frame (character.cpp:2296-2330); here that is two field
  // writes, so the rig that is stepping the arm re-claims it first.
  const bindArm = () => fpArm.attach(renderer, camera);
  bindArm();
  // MWFIX 3, RESTORED. The reverted rig read hasStoredMorrowind() ONCE at
  // construction, so attaching data to a running game changed nothing
  // until a reload - which is what "after uploading does not work at
  // all" actually was. A monotonic generation is the cheapest honest
  // signal a live consumer can poll. The rig does not rebuild by itself
  // (the parse is seconds long and belongs behind a button); it drops a
  // stale arm, so what is on screen never outlives the data it was
  // built from.
  let _mwGen = morrowindDataGeneration();
  const fpRecheck = () => {
    const g = morrowindDataGeneration();
    if (g === _mwGen) return;
    _mwGen = g;
    fpArm.unload();
  };
  // AUDIT 17e F17 / THE FOUR HOSTS RULE: U8h bound the worn weapon in
  // the two EXTERIOR hosts by hand, so the interior host (which owns
  // its own rig) kept swinging the interim dagger inside every
  // building, and the dungeon host was flagged but unwired. The bind
  // belongs to the rig: every host that passes an entity inherits it.
  // bindWorn:false is for rigs that manage their own weapon (the
  // dungeon's scripted bow demo).
  //
  // a12: AND IT READS BOTH HANDS. This was the port's whole left-hand
  // gap: one line bound the RightHand slot, so a weapon in the left
  // hand could never be swung and a shield changed nothing. The body
  // is UpdateHands + ApplyWeapon (WeaponManager.cs:646-676, :731-757),
  // which playerWeapon owns; the rig's job is the per-frame read that
  // DFU's Update does, and the order is DFU's - the hands are cached
  // first (so the shield rule and both caches are current), then the
  // used hand is applied.
  const syncWorn = () => {
    if (!bindWorn || !entity) return;
    // V4: SetFPSWeapon (LycanthropyEffect.cs:332-345) - while
    // transformed the rig IS the wereclaws, whatever the hand holds;
    // the per-frame sync makes the swap live the moment of the morph.
    // It is ApplyWeapon's FIRST arm (:735-739), so it wins over both
    // hands without disturbing either cache.
    const claws = racialFpsWeapon(entity);
    const slots = entity.equip?.slots;
    if (!slots) { if (claws) playerWeapon.weapon = claws; return; }
    playerWeapon.updateHands(slots[EQUIP_SLOTS.RightHand] ?? null, slots[EQUIP_SLOTS.LeftHand] ?? null);
    playerWeapon.applyWeapon(claws);
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

  /**
   * SetCurrentAnims' cache (FPSSpellCasting.cs:145-149): "This happens
   * the first time a spell is cast and stored for re-casting. It's
   * likely player will use a wide variety of spell types in normal
   * play." Same shape as artFor above - the first ask starts the load
   * and draws nothing, every later one hits the map. The textures
   * themselves are keyed globally by renderer.uploadTexture, so four
   * rigs holding four maps still upload each archive once.
   */
  const spellCache = new Map();   // element -> art (null while loading)

  function spellArtFor(element) {
    if (!palette || !magicAnimFilename(element)) return null;
    if (!spellCache.has(element)) {
      spellCache.set(element, null);
      loadSpellCastArt(fetchBytes, palette, renderer, element)
        .then((art) => spellCache.set(element, art))
        .catch((e) => console.warn('[weaponRig] spell anim load failed', element, e));
    }
    return spellCache.get(element);
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
  // MW-D42: the bow's held 'hit', waiting on the arm's release key, and
  // the ceiling that keeps a silent arm from swallowing the shot. The
  // classic bow release is 7 frames at the machine's 0.0625 tick, so a
  // real release lands near 0.44s and always beats this.
  const HELD_HIT_MAX_S = 1.2;
  let _heldHit = false;
  // MW-D42d: the loose SOUND, held with the loose it belongs to.
  let _heldSound = false;
  let _heldHitAge = 0;
  let _lastShown = false;
  function shown() {
    const m = playerWeapon.machine;
    if (m.isBow && m.now < m.cooldownUntil) return _lastShown;   // F024: the early return freezes the state
    let v = true;
    // WeaponManager.cs:247 is `HasReadySpell || PlayerSpellCasting
    // .IsPlayingAnim` - BOTH legs. The second half had nothing to
    // read until the classic spellcasting hands existed, and the
    // comment on this line has claimed it since C9: a weapon sprite
    // drawn over the casting hands is the state DFU's own note says
    // never happens ("never mixed with weapons directly on screen at
    // same time").
    if (spellArmed() || fpsSpellCasting.isPlayingAnim) v = false;   // HasReadySpell / IsPlayingAnim
    else if ((entity?.equipCountdown ?? 0) > 0) v = false;     // F025: empty hands while equipping
    else if (playerWeapon.sheathed) v = false;
    _lastShown = v;
    return v;
  }

  /**
   * MW-D12: the swing reaches the Morrowind arm.
   *
   * The strike is Daggerfall's, the attack type is Morrowind's, and the
   * mapping between them is rule 11's recorded DIVERGENCE - by the shape
   * of the motion, because Daggerfall chooses by gesture where Morrowind
   * chooses from the weapon record's damage spread.
   *
   * `hold` is read off the machine rather than assumed from the weapon:
   * a bow that is drawn AND HOLDING is state StrikeUp, which is DFU's
   * BowDrawback-on arm. The in-game bow path fires StrikeDown instantly
   * (playerWeapon.gesture:105-111), so today this is always false and the
   * arm runs wind-up straight into release - which is what an uncharged
   * Daggerfall swing is. It becomes live the moment the drawback path
   * does, with nothing here to change.
   */
  function fpAttack(strike) {
    if (!fpArm.ready()) return;
    const m = playerWeapon.machine;
    // MW-D16: no `bow` flag. The arm derives "shoot" from its own
    // weapon CLASS, which is what the reference tests - and which also
    // catches MarksmanThrown, a type that shoots without being a bow.
    fpArm.attack(strike, { hold: m.isBow && m.state === 'StrikeUp' });
  }

  /** FPSWeapon.UpdateWeapon's bow guard: an UNsheathed bow with zero
   *  Arrows auto-sheathes with the classic line. */
  function bowArrowGuard() {
    if (playerWeapon.sheathed) return;
    if (weaponTypeForItem(playerWeapon.weapon) !== WEAPON_TYPES.Bow) return;
    if (hasDaggerfallArrows(entity.items)) return;
    playerWeapon.sheathed = true;
    say('You have no arrows.');
  }

  return {
    /** MW-D39: the host's cast moment runs the arm's spellcast release.
     *  One door, like setWeapon - the host never reaches into fpArm.
     *
     *  ROAD-tail: and the CLASSIC lane's hands come through the same
     *  door, because it is the same moment - EntityEffectManager
     *  .CastReadySpell (:434) calls PlayerSpellCasting.PlayOneShot with
     *  the readied spell's ElementType, and this port's hosts raise
     *  their cast moment there. The range picks the Morrowind arm's
     *  attack type; the element picks the classic archive. Exactly one
     *  of the two ever reaches the screen (see draw()).
     *
     *  ROAD-E6: the moment moved. This is now CastReadySpell's
     *  PlayOneShot (:430-435) rather than the release - the host calls
     *  it as the magicka is spent, hands the animation the engine's
     *  release handler, and gets back FPSSpellCasting's own answer:
     *  true when the hands actually started (and therefore when the
     *  spell's resolution is parked on frame 5), false when PlayOneShot
     *  refused - already playing, or an element with no CIF archive -
     *  in which case the engine resolves on the spot. */
    castSpellAnim: (rangeType, element, onRelease = null) => {
      fpArm.castSpell(rangeType);
      return fpsSpellCasting.playOneShot(element, onRelease);
    },
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
    clickAttack() {
      if (playerWeapon.sheathed || (entity?.equipCountdown ?? 0) > 0) return;
      const strike = playerWeapon.clickAttack();
      if (strike) fpAttack(strike);
    },
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
     * a12 - SwitchHand (H). WeaponManager.Update's own leg, :271-273:
     *
     *   if (!isAttacking && InputManager.Instance.ActionComplete(
     *       InputManager.Actions.SwitchHand))
     *       ToggleHand();
     *
     * TWO THINGS ARE LAW HERE and neither is decoration. The gate is
     * `!isAttacking` - the hand never changes mid-swing, or the strike
     * would finish with a different weapon than it started with. And
     * the edge is ActionComplete, the key's RELEASE (:634-637), not
     * ActionStarted like ReadyWeapon (:284) - so the hosts poll this
     * one on the falling edge, which is why every call site's latch
     * reads `!now && prev` where Z's reads `now && !prev`.
     *
     * syncWorn runs first because DFU's UpdateHands runs every frame
     * ahead of this: holdingShield has to be THIS frame's answer or
     * the shield refusal below is stale by one press.
     *
     * @returns true when the hand actually changed.
     */
    switchHand() {
      if (playerWeapon.machine.state !== 'Idle') return false;   // isAttacking
      syncWorn();
      // bindWorn:false rigs drive their own weapon (the dungeon's
      // scripted bow) - flip the hand, but do not let ApplyWeapon
      // overwrite a weapon no equip table ever supplied.
      const line = playerWeapon.toggleHand({ entity, apply: bindWorn });
      if (line === null) return false;   // :704-705, the shield refuses
      say(line);
      return true;
    },
    /**
     * Per-frame: gesture consume, the swing-sound edge, machine step.
     * @returns the machine's events ('hit' on the strike frame) - the
     *   host resolves them (or ignores them where nothing is in reach).
     */
    frame(dt, { paralyzed = false } = {}) {
      bindArm();    // AUDIT 39: the stepping rig owns the singleton (see above)
      syncWorn();   // AUDIT 17e F17: the rig owns the worn-weapon bind
      // FPSSpellCasting's AnimateSpellCast coroutine (:265-286). It is
      // a Start() coroutine, so it runs for the life of the component
      // - before the gesture, before the machine, and NOT under the
      // paralysis gate below: FPSSpellCasting is its own component and
      // WeaponManager.ShowWeapons(false) never touched it, so a cast
      // already in flight when paralysis lands finishes its motion.
      // Only the rig that owns the frame steps it (the hosts return
      // early on a modal mode), which is why one accumulator is safe
      // across four rigs.
      fpsSpellCasting.tick(dt);
      // CH3 (characters-13): the swap pause drains at the classic
      // approximation - dt x 980 units/second, clamped at 0
      // (WeaponManager.cs:677-693).
      if (entity && (entity.equipCountdown ?? 0) > 0) {
        entity.equipCountdown = Math.max(0, entity.equipCountdown - dt * 980);
      }
      const c = cv();
      // MW-D12: THE RETURN VALUE WAS BEING THROWN AWAY, and it is the
      // only signal that a blow has started. gesture() answers with the
      // strike the drag resolved to (playerWeapon.js:128-131) and
      // clickAttack() with the one the click rolled - the Morrowind arm
      // needs exactly that to pick rule 11's attack type.
      const strike = !paralyzed && c
        ? playerWeapon.gesture(_dx, _dy, _held, dt, Math.max(c.clientWidth, c.clientHeight), { cancelHeld: activateHeld() })   // AUDIT 28 W12
        : null;
      if (strike) fpAttack(strike);
      _dx = 0; _dy = 0;
      // AUDIT 23 (C9): the strike-ENTRY whoosh is gone - DFU plays the
      // swing sound at the HIT FRAME of a swing that hit no enemy
      // (WeaponManager.cs:1059 else-arm) and at bow frame 4 (:376-380),
      // both of which ride the machine's events at the hosts now.
      fpRecheck();
      // Paralysis freezes the arm as it freezes the swing - a clip that
      // keeps idling while the player cannot move is the animation
      // saying something the game does not mean.
      // MW-D9f: ready(), NOT active(). active() requires the GPU mesh
      // that update() is the only thing that creates, so gating the
      // update on it meant a built arm never ran a frame and never drew.
      if (!paralyzed && fpArm.ready()) {
        // MW-D12: THE STANCE IS SYNCED EVERY FRAME, not at the toggle.
        //
        // That is the reference's own shape - updateWeaponState compares
        // the live `weaptype` against `mWeaponType` on every call
        // (character.cpp:1382-1385) - and here it is also the only
        // correct one: playerWeapon.sheathed is written from THREE
        // places, and the bow's out-of-arrows auto-sheathe
        // (bowArrowGuard, in draw()) is not one of them that could ever
        // call a toggle hook. setSheathed is a no-op when nothing
        // changed, so this costs a comparison.
        //
        // Sheathed is rule 8's weapon type None: the bare "idle" group,
        // rule 10's endless loop, and no weapon in shot. Drawn plays the
        // equip section of the weapon's long group and raises "idle1h".
        fpArm.setSheathed(playerWeapon.sheathed);
        // MW-D19: THE WEAPON FOLLOWS THE HAND. syncWorn above already
        // reads the equip slot every frame for the classic sprite; the
        // Morrowind arm now rides the same read. setWeapon's fast path
        // is one key compare - the swap itself runs only when the item
        // in the hand actually changed.
        fpArm.setWeapon(playerWeapon.weapon, { hasAmmo: hasDaggerfallArrows(entity?.items) });
        // MW-D39: THE SPELL IS A STANCE. spellArmed() is already the
        // rig's own per-frame read (WeaponManager's HasReadySpell leg
        // above); the Morrowind arm rides the same one, and its fast
        // path is a boolean compare, so the stance re-composes only
        // when a spell is actually readied or let go.
        fpArm.readySpell(spellArmed());
        // MW-D32: THE BODY FOLLOWS THE EQUIP TABLE. The same per-frame
        // read that swaps the weapon now hands the rig its worn list;
        // setWorn's fast path is one key compare, and a change - a
        // cloak equipped, a gauntlet dropped - rebuilds the body in
        // those clothes. D29-D31 dressed the BUILD; this dresses the
        // GAME.
        if (entity) fpArm.setWorn(dfWornEquipment(equipTableOf(entity), EQUIP_SLOTS, ARMOR_ENUM));
        // The held draw comes up when the machine leaves StrikeUp - the
        // arrow is loosed, so the arm's wind-up must stop holding at max
        // attack and run to its release key.
        const m = playerWeapon.machine;
        if (!(m.isBow && m.state === 'StrikeUp')) fpArm.release();
        fpArm.update(dt);
      }
      if (paralyzed) return [];
      // MW-D42 (Mac: the bow "damages on click instead of following the
      // bow animation"): THE LOOSE WAITS FOR THE ARM. The machine's
      // 'hit' for a bow is frame 5 of the classic 7-frame release, and
      // when the Morrowind arm is the thing on screen that frame has
      // nothing to do with what the player is watching - the arrow left
      // while the bow was still being drawn.
      //
      // Morrowind-Rules.md:246-255 refused this and was half right: two
      // clocks must not disagree about when a blow lands. They still do
      // not. Daggerfall's machine remains the ONLY thing that decides a
      // hit happens, its damage, its skills, its cooldown; all that
      // moves is the moment it is allowed to announce one, and only for
      // a bow, and only while the arm is actually animating the shot.
      // The rule's own reason was the hit frame - it never argued the
      // arrow should leave before the string does.
      const evs = playerWeapon.update(dt);
      // MW-D42c (Mac: "in third person, clicking instantly triggers the
      // attack, unlike the changes we made to first person. Ensure
      // parity"): THE ARM IS ANIMATING IN EITHER VIEW. active() is the
      // FIRST-person predicate by construction - it ends in
      // `viewMode === 'first'` - so MW-D42's hold silently did nothing
      // the moment the wheel turned, and the classic frame-5 hit fired
      // straight through on the click exactly as it always had. The
      // question this asks is not "which view" but "is the arm the
      // thing on screen", and in third person that is thirdActive().
      // Same animation, same release key, same clock; only the pass
      // that draws it differs, and the pass is none of the loose's
      // business.
      if (!(fpArm.active() || fpArm.thirdActive()) || !playerWeapon.machine.isBow) {
        // The classic sprite path is untouched, and so is every melee
        // weapon on every path.
        if (_heldHit) _heldHit = false;
        _heldSound = false;
        return evs;
      }
      const out = [];
      for (const ev of evs) {
        if (ev === 'hit') { _heldHit = true; _heldHitAge = 0; continue; }
        // MW-D42d (Mac: "the sound affect plays before the arrow is
        // fired"): THE LOOSE SOUND RIDES WITH THE LOOSE. The machine
        // puts bowSound on frame 4 and the hit on frame 5 - one 0.0625
        // tick apart, which is the same instant to an ear. MW-D42 moved
        // the HIT to the arm's release key and let the sound through
        // untouched, so the two came apart by the whole length of the
        // draw and the string was heard before the arrow left. Holding
        // the arrow and not its sound is not half a fix, it is a new
        // defect, and it was mine.
        if (ev === 'bowSound') { _heldSound = true; continue; }
        out.push(ev);
      }
      if (_heldHit) {
        _heldHitAge += dt;
        // NEVER-TRAPS. If the arm's "shoot release" key never comes -
        // a .kf that does not carry it, an arm that loses its build
        // mid-shot - the shot is not swallowed. It lands late rather
        // than never, and HELD_HIT_MAX_S is generous enough that a real
        // release always wins the race: the whole classic bow release
        // is seven frames at a 0.0625 tick, about 0.44s.
        if (fpArm.takeShootRelease() || _heldHitAge >= HELD_HIT_MAX_S) {
          _heldHit = false;
          // SOUND FIRST, then the hit - the machine's own order across
          // frames 4 and 5, preserved rather than reinvented.
          if (_heldSound) { _heldSound = false; out.push('bowSound'); }
          out.push('hit');
        }
      }
      return out;
    },
    /** The overlay draw, LAST in the host's frame (composites over the
     *  scene; any HUD draws over it). Runs the bow guard first. */
    draw({ paralyzed = false } = {}) {
      bindArm();    // AUDIT 39: the DRAWING rig owns it too - the arm renders through it
      bowArrowGuard();
      const c = cv();
      // MW-D24: in THIRD PERSON nothing first-person draws at all - not
      // the arm (its predicate is view-gated) and not the classic
      // sprite either, or the player would wear a floating weapon
      // overlay while watching their own back. Morrowind's third person
      // has no viewmodel; the body carries the weapon. ROAD-tail HOISTED
      // it above the spellcasting hands below, which are first-person
      // art by exactly the same argument.
      if (fpArm.thirdActive()) return;
      // ROAD-tail: THE CLASSIC SPELLCASTING HANDS (FPSSpellCasting
      // .OnGUI :97-119). Three things about where this sits:
      //   - BEFORE the weapon, "Draw spell cast texture behind other
      //     HUD elements" (:113) and GUI.depth = 1 (:99);
      //   - NOT under shown() - the weapon is the thing shown() hides
      //     while these play (see the IsPlayingAnim leg there), and
      //     hiding the hands with it would leave a cast with nothing
      //     on screen at all;
      //   - NOT under paralyzed, for the reason frame()'s tick is not:
      //     DFU's spellcasting component is nobody's viewmodel.
      // The Morrowind lane draws its OWN cast through fpArm's casting
      // stance (MW-D39), so the two never composite - the same one
      // seam the weapon sprite has.
      if (c && !fpArm.active()) {
        drawSpellCastHands(renderer, c, spellArtFor(fpsSpellCasting.element), fpsSpellCasting.frameIndex);
      }
      if (paralyzed || !shown()) return;
      // THE ONE SEAM. The arm draws whole and RETURNS, or it is inactive
      // and the classic sprite draws exactly as it always has. The return
      // is load-bearing: without it both composite and the player sees a
      // weapon sprite pasted over a pair of hands.
      if (fpArm.active()) { fpArm.draw(c); return; }
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
