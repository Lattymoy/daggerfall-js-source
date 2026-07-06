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
export function getMeleeWeaponAnimTime(liveSpeed) {
  return (3 * (115 - liveSpeed)) / CLASSIC_FRAME_UPDATE;   // seconds per anim frame
}
export function getBowCooldownTime(liveSpeed) {
  return (10 * (100 - liveSpeed) + 800) / CLASSIC_FRAME_UPDATE;
}

// WeaponManager.cs verbatim
export const MAX_GESTURE_SECONDS = 1.0;
export const MAX_BOW_HELD_DRAWN_SECONDS = 10;
export const BOW_SWITCH_DIVISOR = 1.7;
export const RESET_JOYSTICK_SWING_RADIUS = 0.4;
export const ATTACK_THRESHOLD = 0.05;              // gesture travel / longest screen dim
export const SWING_WEAPON_FATIGUE_LOSS = 11;       // per DF Chronicles, verified in classic
// DaggerfallMissile.cs verbatim
export const ARROW_MOVEMENT_SPEED = 25.0;   // MovementSpeed - world units/second
export const ARROW_ARM_LENGTH = 0.9;        // ArmLength - cast-origin distance
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
// Bow frame span reconstructed FROM the verbatim mechanics (single
// record; StrikeUp caps at NumFrames-1=3 for the draw-hold, release
// continues 4..5 with sound@4 and arrow@5): draw entry 4 frames,
// release entry 6.
export const BOW_NUM_FRAMES = { Idle: 1, StrikeUp: 4, StrikeDown: 6 };

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
export function createWeaponMachine(isBow) {
  return { isBow, state: 'Idle', frame: 0, ticks: 0, acc: 0, cooldownUntil: 0, now: 0 };
}

export function machineAttack(m, strikeState) {
  if (m.now < m.cooldownUntil) return false;
  if (!canChangeState(m.isBow, m.state, strikeState)) return false;
  m.state = strikeState;
  // ChangeWeaponState verbatim: bows keep frames unless going Idle
  if (!m.isBow || strikeState === 'Idle') { m.frame = 0; m.ticks = 0; }
  m.acc = 0;
  return true;
}

export function machineCancelBowDraw(m) {   // ActivateCenterObject / hold-cap path
  if (m.isBow && m.state === 'StrikeUp') { m.state = 'Idle'; m.frame = 0; m.ticks = 0; m.acc = 0; return true; }
  return false;
}

export function machineStep(m, dt, liveSpeed) {
  m.now += dt;
  const events = [];
  if (m.state === 'Idle') return events;
  const frames = (m.isBow ? BOW_NUM_FRAMES : MELEE_NUM_FRAMES)[m.state] ?? 5;
  const tick = m.isBow ? CLASSIC_UPDATE_INTERVAL : getMeleeWeaponAnimTime(liveSpeed);
  m.acc += dt;
  while (m.acc >= tick) {
    m.acc -= tick;
    if (m.isBow && m.state === 'StrikeUp') {
      if (m.frame < frames - 1) m.frame++;             // draw to the hold frame, then hold
      m.ticks++;                                        // held-time keeps counting (GetAnimTime)
      if (m.ticks * tick > MAX_BOW_HELD_DRAWN_SECONDS) { machineCancelBowDraw(m); events.push('undraw'); break; }
    } else {
      m.frame++;
      if (m.frame === (m.isBow ? BOW_SOUND_FRAME : -1)) events.push('bowSound');
      if (m.frame === (m.isBow ? HIT_FRAME_BOW : HIT_FRAME_MELEE)) events.push('hit');
      if (m.frame >= frames) {
        m.state = 'Idle'; m.frame = 0; m.ticks = 0;
        events.push('done');
        if (m.isBow) m.cooldownUntil = m.now + getBowCooldownTime(liveSpeed);
        break;
      }
    }
  }
  return events;
}
