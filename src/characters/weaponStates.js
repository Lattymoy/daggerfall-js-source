// DFU-verbatim weapon state machine + timing data. Sources:
//   Game/WeaponManager.cs, Game/FPSWeapon.cs,
//   Game/Formulas/FormulaHelper.cs (Interkarma/daggerfall-unity master)
// Attack patterns and hold states match Daggerfall 1:1: the rig's
// clips are the VISUAL for these frames - all timing, hit moments,
// hold/draw/cooldown behavior comes from this module. 2D-sprite
// fields (Alignment/Offset) do not apply to a 3D rig and are the
// only WeaponBasics fields not carried.

// FPSWeapon.cs: WeaponStates (index = WeaponBasics record index)
export const WEAPON_STATES = ['Idle', 'StrikeDown', 'StrikeDownLeft', 'StrikeLeft', 'StrikeRight', 'StrikeDownRight', 'StrikeUp'];

// FormulaHelper.cs verbatim
export const CLASSIC_FRAME_UPDATE = 980;           // const int classicFrameUpdate
export const CLASSIC_UPDATE_INTERVAL = 0.0625;     // GameManager.classicUpdateInterval (classic 16Hz); bow anim tick
export function getMeleeWeaponAnimTime(liveSpeed, ctx = null) {
  const o = _animTimeOverride?.(liveSpeed, ctx, CLASSIC_FRAME_UPDATE);   // TryGetOverride("GetMeleeWeaponAnimTime") - RRI2's weaponBalance registers one
  if (o != null) return o;
  // SWING-LAW: a wielder the port knows (`ctx.entity` - the player's machine, the Weapon Widget's clone, the third-person
  // body) swings on the port's own law; one it does not (a foe's machine, a peer's walker at PEER_SWING_SPEED, the
  // viewers) keeps DFU's line - which DFU never asks for a foe at all (characters/enemyAttack.js).
  if (ctx?.entity) {
    const w = _swingReader?.(ctx) ?? null;
    return swingFrameSeconds(liveSpeed, {
      heft: w ? swingHeft(w.weight, w.strength) : 1,
      handling: swingHandling(ctx.weaponType, !!w?.twoHanded),
    });
  }
  return (3 * (115 - liveSpeed)) / CLASSIC_FRAME_UPDATE;   // seconds per anim frame
}

// ── SWING-LAW (2026-09-28, Mac: "swing speed is insane", then "Do whatever is the most detailed. I dont care about
// departure, especially if we can do it better"): THE PLAYER'S SWING IS THE PORT'S OWN LAW. ──────────────────────────
// DFU's line, `3 * (115 - Speed) / 980` a frame, is a hyperbola in the swing RATE: a second a swing at Speed 50, a
// quarter of one at 100 - four swings a second. DISC28-D (2026-09-28) gave the rig the player's live Speed, which it had
// never read (every player had swung at 50), and a lycanthrope's +40 Speed put anyone with a base of 60 or more on the
// cap. The law below keeps Speed meaning something and bounds it, and reads the weapon in the hand:
//   time a frame = DFU's frame at Speed 50 x TEMPO(Speed) x HEFT(weight, Strength) x HANDLING(weapon, hands),
// bounded to [SWING_FRAME_MIN, SWING_FRAME_MAX]. A frame is never 0 (DFU's line was at 115, and the machine's loop
// then never ended - Online-Arc "Recorded, not paid"). Roleplay & Realism's weaponSpeed and Items' weaponBalance keep
// their own weight-and-Strength arithmetic as the Speed they read, and answer through this curve and this handling
// (systems/rrRealism.js, systems/rriRealism.js). A declared departure: Ledger A (SWING-LAW).
/** DFU's frame at Speed 50 - the swing every player had before DISC28-D, and this law's middle. */
export const SWING_BASE_FRAME = (3 * (115 - 50)) / CLASSIC_FRAME_UPDATE;
/** The TEMPO at Speed 0 and at 100: a straight line through 1 at 50 - each point of Speed takes the same 0.8% off the
 *  swing, so Speed 100 swings 1.67 times as often as 50 and Speed 0 takes 1.4 times as long, where DFU's line runs
 *  7.7 times from end to end. */
export const SWING_TEMPO_AT_0 = 1.4;
export const SWING_TEMPO_AT_100 = 0.6;
/** The tempo at a Speed (held to 0..100; a Speed that is no number reads as 50). */
export function swingTempo(speed) {
  const s = Math.max(0, Math.min(100, Number.isFinite(speed) ? speed : 50));
  return 1 + ((50 - s) / 100) * (SWING_TEMPO_AT_0 - SWING_TEMPO_AT_100);   // pivoted on 50, so the middle is DFU's frame exactly
}
/** THE HEFT: a weapon's base weight as the arm feels it - `(150 - Strength)%` of it (Items' weaponBalance scaling: all
 *  of it at 50, half at 100, half again at 0) - costs SWING_HEFT_PER_KG of the swing a kilogram past the
 *  SWING_HEFT_FREE_KG any arm carries lightly, to at most SWING_HEFT_MAX. A shortsword costs an average arm nothing; a
 *  claymore (7.5 kg) a fifth at Strength 50 and a tenth at 90. */
export const SWING_HEFT_FREE_KG = 2.5;
export const SWING_HEFT_PER_KG = 0.045;
export const SWING_HEFT_MAX = 0.35;
export function swingHeft(weightKg, strength) {
  const w = Math.max(0, Number.isFinite(weightKg) ? weightKg : 0);
  const str = Math.max(0, Math.min(100, Number.isFinite(strength) ? strength : 50));
  const load = (w * (150 - str)) / 100;
  return 1 + Math.min(SWING_HEFT_MAX, Math.max(0, (load - SWING_HEFT_FREE_KG) * SWING_HEFT_PER_KG));
}
/** THE HANDLING: each weapon's own tempo apart from its weight, by DFU's WeaponTypes (combat/fpsWeapon.js WEAPON_TYPES -
 *  pinned equal; this module is a leaf): a dagger, bare hands and a beast's claws are quick; a sword is the measure; a
 *  mace, a flail, an axe and a warhammer come round a little slower; a staff sweeps quicker than the other two-handers
 *  (every staff takes both hands: 0.97 x 1.06, against a claymore's 1.06 and a warhammer's 1.06 x 1.06 - a sword's
 *  1.0 is still quicker). A two-handed weapon takes SWING_TWO_HANDED on top of its kind. Anything else (the bow's draw,
 *  the port's own gun, which keep their own clocks) reads 1. (AUDIT PRE-MERGE 0929 S2: this said a staff was "a little
 *  quicker", and the table's dagger row "and the tanto" - DFU draws the tanto as a long blade, fpsWeapon.js, and it
 *  handles as one.) */
export const SWING_HANDLING = Object.freeze({
  0: 1, 1: 1,           // LongBlade (every sword the sprites draw as one: the tanto and the shortsword to the dai-katana)
  2: 0.97, 3: 0.97,     // Staff
  4: 0.9, 5: 0.9,       // Dagger
  6: 1.03, 7: 1.03,     // Mace
  8: 1.05, 9: 1.05,     // Flail
  10: 1.06, 11: 1.06,   // Warhammer
  12: 1.05, 13: 1.05,   // Battleaxe (every axe)
  15: 0.9,              // Melee - bare hands
  16: 0.9,              // Werecreature - the beast's claws
});
export const SWING_TWO_HANDED = 1.06;
export const swingHandling = (weaponType, twoHanded = false) => (SWING_HANDLING[weaponType] ?? 1) * (twoHanded ? SWING_TWO_HANDED : 1);
/** The bounds of a frame: no swing is quicker than 0.45 s (five frames) or slower than 2 s, whatever a mod reads. */
export const SWING_FRAME_MIN = 0.09;
export const SWING_FRAME_MAX = 0.4;
/** Seconds a frame of a melee swing at an effective Speed, with the weapon's heft and handling (both 1 by default). */
export function swingFrameSeconds(speed, { heft = 1, handling = 1 } = {}) {
  return Math.max(SWING_FRAME_MIN, Math.min(SWING_FRAME_MAX, SWING_BASE_FRAME * swingTempo(speed) * heft * handling));
}
/** The weapon in the hand as the law reads it - `(ctx) => {weaponType, weight, strength, twoHanded}` or null - from a
 *  module that can read the equip table (combat/swingLaw.js, which registers it as it loads - combat/weaponRig.js
 *  imports it: AUDIT PRE-MERGE 0929 S5); this module is a leaf. Without one the
 *  law reads no heft, and the handling off `ctx.weaponType` alone. */
let _swingReader = null;
export function registerSwingReader(fn) { _swingReader = typeof fn === 'function' ? fn : null; }
/** FormulaHelper.RegisterOverride("GetMeleeWeaponAnimTime"): the C# takes
 *  (player, weaponType, weaponHands); the port's callers pass the live
 *  speed and, where they have one, `ctx` = { entity, weaponType,
 *  usingRightHand } so an override can read the strength and the held
 *  weapon. Answers seconds per frame, or null for DFU's line. This
 *  module is a leaf, so the override is registered. */
let _animTimeOverride = null;
export function registerMeleeWeaponAnimTime(fn) { _animTimeOverride = typeof fn === 'function' ? fn : null; }
export function getBowCooldownTime(liveSpeed) {
  return (10 * (100 - liveSpeed) + 800) / CLASSIC_FRAME_UPDATE;
}

// WeaponManager.cs verbatim
export const MAX_GESTURE_SECONDS = 1.0;
export const MAX_BOW_HELD_DRAWN_SECONDS = 10;
export const BOW_SWITCH_DIVISOR = 1.7;
export const RESET_JOYSTICK_SWING_RADIUS = 0.4;
export const ATTACK_THRESHOLD = 0.05;              // gesture travel / longest screen dim
// AUDIT 23 (characters-14/combat-13): SWING_WEAPON_FATIGUE_LOSS and
// ARROW_MOVEMENT_SPEED were duplicates of the live single sources
// (hostCombat.js's constant; spellcast.js's MISSILE_SPEED = the same
// DaggerfallMissile.MovementSpeed) - deleted per ONE DFU MEMBER, ONE
// EXPORT. ArmLength stays as the one home for its member (no live
// consumer yet - the arrow paths launch from the eye).
export const ARROW_ARM_LENGTH = 0.9;        // DaggerfallMissile.ArmLength - cast-origin distance
export const EQUIP_DELAY_TIMES = [500, 700, 1200, 900, 900, 1800, 1600, 1700, 1700, 3000, 3400, 2000, 2200, 2000, 2200, 2000, 4000, 5000];

// WeaponBasics.cs verbatim: melee strikes are 5 frames, idle 1, all
// at 10 fps native (the native rate is replaced at runtime by the
// SPD-driven tick above, exactly as FPSWeapon.GetAnimTickTime does).
export const MELEE_NUM_FRAMES = { Idle: 1, StrikeDown: 5, StrikeDownLeft: 5, StrikeLeft: 5, StrikeRight: 5, StrikeDownRight: 5, StrikeUp: 5 };
// FPSWeapon.cs verbatim hit frames: damage lands when
// currentFrame == GetHitFrame().
export const HIT_FRAME_MELEE = 2;
export const HIT_FRAME_BOW = 5;
export const BOW_SOUND_FRAME = 4;                  // swing sound fires here
export const BOW_DRAWN_HOLD_FRAME = 3;             // fully drawn; drawback holds here
// WeaponBasics.cs BowWeaponAnims, read off the table: row 0 (Idle)
// NumFrames 1, rows 1-5 (every strike) 7, row 6 (StrikeUp, the draw)
// 4. AUDIT 18: StrikeDown had been RECONSTRUCTED as 6 from the
// mechanics rather than read, which cut frame 6 off every release and
// started the bow cooldown one classic tick early.
export const BOW_NUM_FRAMES = { Idle: 1, StrikeUp: 4, StrikeDown: 7 };
/** The Dwarven Thunderlock's, the port's own weapon: one trigger pull
 *  is six frames - flash, flash, smoke, smoke, wisp - on every strike
 *  direction, because a gun does not care which way you dragged. */
export const THUNDERLOCK_NUM_FRAMES = Object.freeze({
  Idle: 1, StrikeDown: 6, StrikeDownLeft: 6, StrikeLeft: 6, StrikeRight: 6, StrikeDownRight: 6, StrikeUp: 6,
});

// FPSWeapon.cs:71 verbatim: the unarmed strike-to-the-LEFT plays its
// own eight-tick frame list - up and back down again - instead of the
// generic 5-frame increment. FPSWeapon.AnimateWeapon:500-511 takes
// this arm FIRST, for WeaponTypes.Melee and Werecreature only, and
// cannot end before the eighth tick.
export const LEFT_UNARMED_ANIMS = Object.freeze([0, 1, 2, 3, 4, 2, 1, 0]);

/** WeaponManager.cs:343 - Random.Range((int)UpRight, (int)DownRight + 1)
 *  over MouseDirections {None, UpLeft, Up, UpRight, Left, Right,
 *  DownLeft, Down, DownRight}: indices 3..8. The swing-mode click's draw (combat/playerWeapon.js, which re-exports
 *  it) and the touch Attack button's (ui/touchButtons.js attackStroke) - one table. */
export const CLICK_ATTACK_DIRECTIONS = Object.freeze(['UpRight', 'Left', 'Right', 'DownLeft', 'Down', 'DownRight']);

// WeaponManager.TrackMouseAttack verbatim: 15deg radial sections.
// Note gesture tracking emits only SIX directions (UpLeft/UpRight
// exist solely for the click-attack random roll).
export function gestureDirection(angleDeg) {
  let a = angleDeg % 360; if (a < 0) a += 360;
  const s = Math.ceil(a / 15);
  if (s <= 1 || s === 24 || s === 0) return 'Right';       // 345-15
  if (s <= 11) return 'Up';                                 // 15-165 (diagonal-up folds into Up)
  if (s <= 13) return 'Left';                               // 165-195
  if (s <= 17) return 'DownLeft';                           // 195-255
  if (s <= 19) return 'Down';                               // 255-285
  return 'DownRight';                                       // 285-345
}

// FPSWeapon.OnAttackDirection verbatim interrupt rule: a one-shot in
// progress cannot be replaced, EXCEPT the bow release (StrikeUp ->
// StrikeDown while drawn).
export function canChangeState(isBow, currentState, nextState) {
  if (currentState === 'Idle') return true;
  return isBow && currentState === 'StrikeUp' && nextState === 'StrikeDown';
}

// The frame engine, distilled from FPSWeapon.AnimateWeapon +
// WeaponManager's bow block. step(machine, dt) advances ticks;
// events collect hit/sound/loose moments for the caller.
/** `isUnarmed` = the FPSWeapon.AnimateWeapon gate WeaponType ==
 *  Melee || Werecreature. It is the PLAYER's screen weapon only, and
 *  the caller must re-read it every step - a sheathed sword flips the
 *  rig between armed and bare-handed while the machine lives on. */
export function createWeaponMachine(isBow, isUnarmed = false) {
  // `ranged` and `frames` are the port's own two fields (the Dwarven
  // Thunderlock): a weapon that pays the bow's cooldown without
  // drawing like one, and one whose cycle is not five frames. Both
  // default to the classic answer, so a machine that never sets them
  // is the machine that has always been here.
  // FIELD-GUN7: `tick`, `cooldown` and `hitFrame` join `ranged` and
  // `frames` as the port's own fields. Null in every one of them is
  // "ask the classic formula", which is what a machine that never
  // sets them has always done.
  return { isBow, isUnarmed, ranged: isBow, frames: null, tick: null, cooldown: null, hitFrame: null, state: 'Idle', frame: 0, ticks: 0, acc: 0, cooldownUntil: 0, now: 0, bowIdleDrawn: false, animIndex: 0, damageDone: false };
}

export function machineAttack(m, strikeState) {
  if (m.now < m.cooldownUntil) return false;
  if (!canChangeState(m.isBow, m.state, strikeState)) return false;
  m.state = strikeState;
  // ChangeWeaponState verbatim: bows keep frames unless going Idle
  if (!m.isBow || strikeState === 'Idle') { m.frame = 0; m.ticks = 0; }
  m.acc = 0;
  m.animIndex = 0; m.damageDone = false;   // leftUnarmedAnimIndex / isDamageFinished
  return true;
}

/** ActivateCenterObject / the hold cap: un-draw WITHOUT releasing an
 *  arrow (WeaponManager.cs:355-357). AUDIT 24 combat: the un-draw
 *  leaves isAttacking TRUE, so the very next Update takes the
 *  not-attacking reset block and charges the FULL bow cooldown -
 *  `if (WeaponType == Bow && isAttacking) cooldownTime = Time.time +
 *  GetBowCooldownTime(playerEntity)` (:220-222). A cancelled draw
 *  costs exactly what a loosed arrow costs; the port let the next draw
 *  start on the following frame. */
export function machineCancelBowDraw(m, liveSpeed = 50) {
  if (m.isBow && m.state === 'StrikeUp') {
    m.state = 'Idle'; m.frame = 0; m.ticks = 0; m.acc = 0;
    m.cooldownUntil = m.now + getBowCooldownTime(liveSpeed);
    return true;
  }
  return false;
}

/**
 * MW-PACE1 (2026-10-07, Mac: "Morrowind attack animations don't scale with attack speed/multiple attacks when attack
 * speed is high"): THE BLOW'S CLOCK, SAID AHEAD OF TIME - when the strike this machine has just begun lands its hit,
 * and when it is done, in seconds from its first frame. The Morrowind arm is a picture of this machine (rule 24's note,
 * Morrowind-Rules.md: the hit frame is FPSWeapon's, not the .kf's), and a picture paced by the WEAP record's own speed
 * drew one blow while the machine struck two - the second refused, the hit landing mid-wind-up. The caller that starts
 * the arm's wind-up reads this at the strike's first frame (combat/weaponRig.js fpAttack) and the arm fits each section
 * of its blow into it (combat/fpArm.js blowRate).
 *
 * The machine steps ONCE per frame and drops the remainder (ARROW2, machineStep below), so a tick lasts the whole
 * frames it takes to cover it: given the frame's `dt`, a step is ceil(tick / dt) frames. Without one, the nominal tick.
 * The unarmed strike to the left is FPSWeapon's eight-tick list, its hit the first visit to frame 2. Null for Idle and
 * for a ranged machine - the bow's hit waits for the arm's own "shoot release" (MW-D42), and its arm keeps the record's
 * pace.
 * @returns {{ seconds: number, hitAt: number, step: number } | null}
 */
export function blowSchedule(m, liveSpeed, animCtx = null, dt = 0) {
  if (!m || m.state === 'Idle' || (m.ranged ?? m.isBow)) return null;
  const tick = m.tick ?? getMeleeWeaponAnimTime(liveSpeed, animCtx);
  if (!(tick > 0) || !Number.isFinite(tick)) return null;
  const step = dt > 0 ? Math.max(1, Math.ceil(tick / dt - 1e-9)) * dt : tick;
  if (m.isUnarmed && m.state === 'StrikeLeft') {
    return { seconds: LEFT_UNARMED_ANIMS.length * step, hitAt: (LEFT_UNARMED_ANIMS.indexOf(HIT_FRAME_MELEE) + 1) * step, step };
  }
  const frames = (m.frames ?? MELEE_NUM_FRAMES)[m.state] ?? 5;
  return { seconds: frames * step, hitAt: (m.hitFrame ?? HIT_FRAME_MELEE) * step, step };
}

export function machineStep(m, dt, liveSpeed, animCtx = null) {   // AUDIT-RR F1: the rig's { entity, weaponType, usingRightHand } for a registered GetMeleeWeaponAnimTime override
  m.now += dt;
  const events = [];
  if (m.state === 'Idle') {
    // ARROW2: FPSWeapon.AnimateWeapon's idle arm for a bow (FPSWeapon.cs:
    // 527-537): the one-frame Idle runs off its end every tick and lands
    // on frame 3 with BowDrawback off - the drawn, nocked bow the instant
    // shot looses FROM (ChangeWeaponState keeps a bow's frame, :261-262,
    // so StrikeDown steps 4 the twang, 5 the shaft) - and on frame 0 with
    // it on. The port's idle sat at 0 whatever the setting, so the
    // default instant shot played the whole draw first and loosed at +5
    // ticks where DFU looses at +2: the widget's clone, which starts at
    // 3 as the IL does, let its sprite arrow go ~170 ms before the 3D
    // shaft existed. Not while cooling: AnimateWeapon does not step a
    // bow it has hidden (:497, `ShowWeapon`).
    const rest = m.isBow && m.bowIdleDrawn ? BOW_DRAWN_HOLD_FRAME : 0;
    if (m.isBow && m.frame !== rest && m.now >= m.cooldownUntil) {
      m.acc += dt;
      if (m.acc >= CLASSIC_UPDATE_INTERVAL) { m.acc = 0; m.frame = rest; }
    }
    return events;
  }
  // `m.frames` is the ONE departure this file carries: a weapon whose
  // animation is not five melee frames or the bow's draw-and-loose.
  // The Dwarven Thunderlock's fire cycle is six (combat/thunderlockArt.js
  // slices them off one sheet), and a machine that does not set it
  // reads exactly the two classic tables it always did.
  const frames = (m.frames ?? (m.isBow ? BOW_NUM_FRAMES : MELEE_NUM_FRAMES))[m.state] ?? 5;
  // FIELD-GUN7 (Mac, from play: "It still doesn't feel like the proto
  // at all"). THE FRAME CLOCK IS THE FEEL, and this was the largest of
  // the three numbers the lab settled and the game ignored. Both
  // classic clocks are SPD-DRIVEN - a melee frame is
  // `3 * (115 - speed) / 980`, which at an average 50 is 0.199s, about
  // FIVE frames a second - and the lab's gun runs at fourteen. The
  // port's own weapon was playing its cycle at a third of the speed it
  // was tuned at, which no amount of recoil or shake on top can
  // disguise: it IS the difference.
  //
  // A gun's mechanism does not care how agile you are. Drawing a
  // bowstring does, and swinging a blade does, so both classic
  // formulas stay exactly where they were for everything else.
  const tick = m.tick ?? (m.isBow ? CLASSIC_UPDATE_INTERVAL : getMeleeWeaponAnimTime(liveSpeed, animCtx));   // AUDIT-RR F1: FPSWeapon's own animTickTime asks FormulaHelper's override (FormulaHelper.cs:830-838); without the ctx the two mods' arms were inert on the swing that lands
  m.acc += dt;
  while (m.acc >= tick) {
    // ARROW2: ONE step per resume, the remainder dropped - FPSWeapon.
    // AnimateWeapon steps once and then `yield return new WaitForSeconds
    // (animTickTime)` (:545), and a coroutine resumes on the first frame
    // past its wait, never twice in one. Carrying the remainder let the
    // machine take several ticks in a frame and run ahead of the weapon
    // widget's clone (the IL's own coroutine, weaponWidget.js), which
    // then missed the bow's hit frame and never set its cooldown; and a
    // single long frame on the release ran StrikeDown to Idle at once.
    // The port's own gun (`m.tick`, FIELD-GUN7's lab clock) is no
    // FPSWeapon and keeps its clock.
    m.acc = m.tick == null ? 0 : m.acc - tick;
    if (m.isUnarmed && m.state === 'StrikeLeft') {
      // FPSWeapon.AnimateWeapon's FIRST arm: the frame comes from
      // leftUnarmedAnims, never from an increment, and the swing ends
      // only when the index runs off the end. The damageDone latch is
      // WeaponManager.cs:381's isDamageFinished - without it the
      // list's SECOND visit to frame 2 would fire a hit DFU never fires.
      m.frame = LEFT_UNARMED_ANIMS[m.animIndex++];
      if (m.frame === HIT_FRAME_MELEE && !m.damageDone) { events.push('hit'); m.damageDone = true; }
      if (m.animIndex >= LEFT_UNARMED_ANIMS.length) {
        m.state = 'Idle'; m.frame = 0; m.ticks = 0; m.animIndex = 0; m.damageDone = false;
        events.push('done');
        break;
      }
    } else if (m.isBow && m.state === 'StrikeUp') {
      if (m.frame < frames - 1) m.frame++;             // draw to the hold frame, then hold
      m.ticks++;                                        // held-time keeps counting (GetAnimTime)
      if (m.ticks * tick > MAX_BOW_HELD_DRAWN_SECONDS) { machineCancelBowDraw(m, liveSpeed); events.push('undraw'); break; }
    } else {
      m.frame++;
      if (m.frame === (m.isBow ? BOW_SOUND_FRAME : -1)) events.push('bowSound');
      // FIELD-GUN7: the lab lands the shot on frame 1 - the muzzle
      // flash - and the melee hit frame is 2, so the damage arrived a
      // frame after the flash it is supposed to BE.
      if (m.frame === (m.hitFrame ?? (m.isBow ? HIT_FRAME_BOW : HIT_FRAME_MELEE))) events.push('hit');
      if (m.frame >= frames) {
        m.state = 'Idle'; m.frame = 0; m.ticks = 0;
        events.push('done');
        // AUDIT-THUNDERLOCK F2: `m.ranged`, not `m.isBow`. A bow and
        // the port's own weapon both pay the ranged cooldown at the
        // end of a shot; only the bow DRAWS. Written as `?? m.isBow`
        // so a machine minted before this field existed - every
        // classic one - still reads exactly as it did.
        // FIELD-GUN7: `m.cooldown` is the lab's fixed 1.7s reload.
        // getBowCooldownTime is `(10 * (100 - speed) + 800) / 980` -
        // 1.33s at an average 50 - so the gun was reloading faster
        // than the prototype AND at a speed that moved with the
        // character, which is the one thing a mechanism does not do.
        if (m.ranged ?? m.isBow) m.cooldownUntil = m.now + (m.cooldown ?? getBowCooldownTime(liveSpeed));
        break;
      }
    }
  }
  return events;
}
