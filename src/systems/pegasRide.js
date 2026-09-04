// ═══════════════════════════════════════════════════════════════════
// PH1 — THE RIDING SCRIPT. `hr_horse_script` (Madmax, 2004; 951
// lines) as a LAW MODULE: every constant is the script's, cited by
// line, and the machine below is its state machine - the RUN toggle,
// the SNEAK press/hold arms, the tired law, the slope watch, the four
// dismount doors, the messages and sounds - transcribed, not
// remembered. bible/13-Pegas/Pegas-Arc.md carries the reading.
//
// WHAT THE PORT CONVERTS, and only that (decisions 5 and 6):
//   - the script moves per FRAME (`setpos x + 10 * xmul` every tick).
//     Morrowind's script clock is its render clock, so the feel was
//     balanced at the frame rate of 2004: PEGAS_SCRIPT_HZ = 30 turns
//     "10 units a frame" into a 4.3 m/s trot (a real trot) rather
//     than the 8.6 m/s of 60 Hz. A recorded assumption, Mac's dial.
//   - Morrowind units to metres: MW_UNITS_PER_METER (69.99).
//   - `setpos` writes positions; the port's motor owns the feet. So
//     the machine answers SPEEDS and OFFSETS and the host's motor
//     walks them (pegasOverride below), through the collider.
//   - Slow Fall / Levitate are OpenMW's physics law: gravity x
//     (1 - min(1, magnitude x 0.005)) - SlowFall 300 is no fall at
//     all, SlowFall 50 is three-quarter gravity, Levitate is none.
//
// NOTHING HERE TOUCHES THE CLASSIC LANE: Daggerfall's own horse (the
// general store's item, the T key, the CFA sprite) is untouched and
// this module is reached only by the enhanced skin's world horses.
// ═══════════════════════════════════════════════════════════════════

import { MW_UNITS_PER_METER } from '../formats/mwFirstPerson.js';

/** Decision 5: the script's frame rate. */
export const PEGAS_SCRIPT_HZ = 30;
/** Script units -> metres. */
export const unitsToMetres = (u) => u / MW_UNITS_PER_METER;
/** A per-frame script quantity -> per second. */
export const perFrameToPerSecond = (perFrame) => perFrame * PEGAS_SCRIPT_HZ;

// ── the script's numbers ───────────────────────────────────────────
export const TROT_UNITS_PER_FRAME = 10;          // :634-635 "trot speed can be adjusted here"
export const FRONTBACK_POSITION = 20;            // :117 "position the player either front or back of the creature"
export const MOUNT_LIFT = 80;                    // :311 the rider set to horse z + pheight + 80 on mounting
export const ENDURANCE_DRAIN_GALLOP = 0.03;      // :643 per frame, while galloping
export const ENDURANCE_REGEN_RIDING = 0.02;      // :685 per frame, standing in the saddle
export const ENDURANCE_REGEN_DISMOUNTED = 0.05;  // :315 per frame, the horse standing on its own
export const JUMP_ENDURANCE_COST = 1;            // :828-832
export const SNEAK_HOLD_SECONDS = 1;             // :734 the hold that turns a toggle into a move
export const SPECIAL_MOVE_SECONDS = 1.5;         // :779
export const SPECIAL_MOVE_BACK = 55;             // :780-781 the rider 55 units BEHIND the horse
export const SPECIAL_MOVE_UP = 25;               // :782
export const JUMP_SECONDS = 1.8;                 // :823
export const JUMP_RISE_SECONDS = 0.5;            // :820
export const JUMP_RISE_INITIAL = 30;             // :812 the horse set 30 up on the jump's first frame
export const JUMP_RISE_PER_FRAME = 10;           // :821 then 10 a frame for the rise
export const JUMP_FORWARD_SPEED_DROP = 5;        // :836 forward at horsespeed - 5 through the whole jump
export const JUMP_RIDER_UP = 20;                 // :840 the rider 20 above pheight in the air
export const SLOPE_TROT_LIMIT = 8;               // :867-869 vertical units a frame
export const SLOPE_GALLOP_DROP = 5;              // :875-876 the gallop limit is horsespeed - 5
export const SLOPE_FRAMES = 3;                   // :884-889 three frames running
export const WATER_BELOW = 70;                   // :670 the rider's z under pheight - 70 = underwater
export const FACE_STEP_DEG = 10;                 // :519-599 the horse's facing, in tens of degrees
export const FACE_INTERVAL_SECONDS = 0.1;        // :517 re-issued every tenth of a second
export const FORWARD_STEP_DEG = 1;               // :352-490 the forward vector's one-degree table
export const LOAD_FIX_DISTANCE = 500;            // :203 a horse over 500 units off its recorded spot is put back

/** The spells the script adds and removes, as OpenMW's physics reads
 *  them (`1 - min(1, magnitude * 0.005)` on the fall). */
export const SLOW_FALL_RIDING = 300;             // hr_ridingspell: no fall damage in the saddle
export const LEVITATE_JUMP = 1000;               // hr_ridingspell2: the rise
export const SLOW_FALL_JUMP = 50;                // hr_ridingspell3: the descent
export const gravityScaleForSlowFall = (magnitude) => 1 - Math.min(1, magnitude * 0.005);

/** `hr_wear_ridinggear`: the rider's seat height by race, set once
 *  per session. Daggerfall's races, with the mod's numbers; a race the
 *  mod has no row for takes its `else` arm (68). */
export const RIDER_HEIGHT_BY_RACE = Object.freeze({
  Argonian: 60, Breton: 67, DarkElf: 68, HighElf: 60, Khajiit: 60, Nord: 65, Redguard: 65, WoodElf: 75,
});
export const RIDER_HEIGHT_DEFAULT = 68;
export const riderHeightForRace = (race) => RIDER_HEIGHT_BY_RACE[race] ?? RIDER_HEIGHT_DEFAULT;

/** The script's messageboxes, verbatim. */
export const MSG = Object.freeze({
  noSaddle: 'You do not have a saddle.',
  twoHorses: 'You are not allowed to ride two horses at the same time.....',
  lostInWater: 'The horse seems lost in the water. It seems to be following you......',
  tired: 'The horse is getting tired',
  gallop: 'GALLOP',
  trot: 'TROT',
  freeViewOn: 'Free View ON',
  freeViewOff: 'Free View OFF',
  tooSteepUp: 'The horse stops as the slope is too steep to climb',
  tooSteepDown: 'The horse stops as the slope is too steep to go down',
  dismount: 'Dismount',
  underwater: 'You cannot ride a horse underwater',
  cannotRemoveSaddle: 'You cannot remove the saddle now',
  positionHeight: 'Position Your Height',
});

/** The script's sounds by SOUN id, as the port registers them
 *  (`pegas:<name>`, MW-D42's door): idle2 the mount/dismount nicker,
 *  idle3 the stop-from-gallop, trot and runforward the loops, scream
 *  the special move's cut-off. */
export const PEGAS_SOUND = Object.freeze({
  idle2: 'pegas:idle', idle3: 'pegas:idle3', trot: 'pegas:trot', runforward: 'pegas:gallop', scream: 'pegas:scream',
});

/** The clip groups the script plays, the .kf's own names. */
export const CLIP = Object.freeze({ idle: 'Idle', trot: 'Walkforward', gallop: 'Runforward', special: 'Idle7' });

// ── the saddle ────────────────────────────────────────────────────
/** `hr_ridinggear` "Horse Saddle" (MISC: weight 5, value 1000). The
 *  port has no Daggerfall template for it, so it is its own group and
 *  an index past every Daggerfall row; the inventory names it by its
 *  own name and draws no Daggerfall image for it. */
export const PEGAS_ITEM_GROUP = 'PegasItems';
export const SADDLE_TEMPLATE = 1001;
export const SADDLE_WEIGHT_KG = 5;
export const SADDLE_VALUE = 1000;
export function mintSaddle() {
  return { group: PEGAS_ITEM_GROUP, templateIndex: SADDLE_TEMPLATE, name: 'Horse Saddle', weight: SADDLE_WEIGHT_KG, value: SADDLE_VALUE, flags: 0, maxCondition: 0, currentCondition: 0, stackCount: 1 };
}
export const isSaddle = (it) => !!it && it.group === PEGAS_ITEM_GROUP && it.templateIndex === SADDLE_TEMPLATE;
export const hasSaddle = (items = []) => (items ?? []).some(isSaddle);
/** :270 `player->removeitem "hr_ridinggear" 1` - one saddle leaves the pack to be worn. */
export function takeSaddle(items) {
  const i = (items ?? []).findIndex(isSaddle);
  if (i < 0) return false;
  const it = items[i];
  if ((it.stackCount ?? 1) > 1) it.stackCount -= 1; else items.splice(i, 1);
  return true;
}
/** `hr_remove_ridinggear`: the worn saddle comes back as the item. */
export function giveSaddle(items) {
  const have = (items ?? []).find(isSaddle);
  if (have) { have.stackCount = (have.stackCount ?? 1) + 1; return have; }
  const s = mintSaddle();
  items.push(s);
  return s;
}

/**
 * The mount gates (:223-273), in the script's order. Answers null to
 * mount, else the refusal - a message, or `{ follow: true }` for the
 * water arm, which is not a refusal so much as a different outcome.
 * `ctx`: { sneaking, horseDead, horseUnderwater, ridingAnother, items }.
 */
export function mountGate({ sneaking = false, horseDead = false, horseUnderwater = false, ridingAnother = false, items = [] } = {}) {
  if (sneaking) return { menu: true };                       // :225 the dialog menu instead
  if (horseDead) return { inventory: true };                 // :250 a dead horse opens its inventory
  if (horseUnderwater) return { follow: true, message: MSG.lostInWater };   // :255-258
  if (ridingAnother) return { message: MSG.twoHorses };      // :261-263
  if (!hasSaddle(items)) return { message: MSG.noSaddle };   // :266-268
  return null;
}

/**
 * THE RIDE. One machine per mounted horse. `mount({ race, horse })`
 * starts it; `tick(inputs)` runs one frame and answers what the host
 * must do; `dismount(reason)` ends it (the script's :903-949 tail).
 *
 * `horse`: { speed, endurance, stamina } - the record's speed and max
 * endurance, and its LIVE endurance (`countendure`), which the machine
 * writes back.
 *
 * tick inputs: { dt, run, sneak, activate, firstPerson, moving3rd?,
 *   riderFatigue, horseY, waterY, groundedDeltaY }
 *   run/sneak: the keys HELD this frame (the machine finds the edges);
 *   activate: the activation EDGE this frame;
 *   horseY: the horse's feet height this frame (for the slope watch);
 *   waterY: the water surface under the horse, or null.
 * tick output: { moving, gait, clip, speed (m/s), forwardUnitsPerFrame,
 *   riderForward (m), riderUp (m), gravityScale, verticalVelocity (m/s|null),
 *   messages, play (sound keys), loop ('trot'|'gallop'|null),
 *   dismount (null|'activate'|'fatigue'|'water'|'dead'), heightMenu }
 */
export function createPegasRide() {
  const st = {
    riding: false,
    horse: null,
    pheight: RIDER_HEIGHT_DEFAULT,
    running: false,          // :613-618 the RUN toggle
    gallop: false,           // walkrunmode
    pressed: 0,              // the SNEAK machine (:707-859)
    pressed2: 0,             // the RUN press tracker (:607-621)
    timer2: 0,
    faceTimer: 0,
    faceDeg: 0,              // the horse's quantised facing
    freeView: false,
    verticalCount: 0,
    lastY: null,
    doOnce: 1,               // :308, :673-681 the stop-from-gallop nicker
    heightMenu: false,
  };

  function mount({ race, horse, yawDeg = 0 }) {
    st.riding = true;
    st.horse = horse;
    st.pheight = riderHeightForRace(race);
    st.running = false; st.gallop = false; st.pressed = 0; st.pressed2 = 0; st.timer2 = 0;
    st.freeView = false; st.verticalCount = 0; st.lastY = null; st.doOnce = 1; st.faceTimer = 0;
    st.faceDeg = quantiseDeg(yawDeg, FACE_STEP_DEG);
    return { play: [PEGAS_SOUND.idle2], riderUp: unitsToMetres(st.pheight + MOUNT_LIFT), fallDamage: false };
  }

  /** :903-949 */
  function dismount(reason = 'activate') {
    const out = { play: [PEGAS_SOUND.idle2], loop: null, messages: [reason === 'water' ? MSG.underwater : MSG.dismount], clip: CLIP.idle };
    st.riding = false; st.running = false; st.gallop = false; st.pressed = 0; st.horse = null;
    return out;
  }

  function tick(inp) {
    const out = {
      moving: false, gait: 'stand', clip: CLIP.idle, speed: 0, forwardUnitsPerFrame: 0,
      riderForward: unitsToMetres(FRONTBACK_POSITION), riderUp: unitsToMetres(st.pheight),
      // the HORSE falls under its own physics (the script never touches
      // the creature's z outside the jump); hr_ridingspell's Slow Fall
      // 300 is on the RIDER and means no fall damage - `fallDamage`
      gravityScale: 1, verticalVelocity: null, fallDamage: false,
      messages: [], play: [], loop: null, dismount: null, heightMenu: false, freeView: st.freeView, faceDeg: st.faceDeg,
    };
    if (!st.riding || !st.horse) return out;
    const h = st.horse;
    const dt = Math.max(0, inp.dt ?? 0);
    const frames = dt * PEGAS_SCRIPT_HZ;   // how many script frames this frame is worth

    // :92-96 the rider's fatigue at zero dismounts
    if ((inp.riderFatigue ?? 1) <= 0) { out.dismount = 'fatigue'; return out; }
    if (inp.horseDead) { out.dismount = 'dead'; return out; }

    // :324-326 third person cancels free view
    if (inp.firstPerson === false) st.freeView = false;
    // :516-521 the horse faces the rider's yaw in tens of degrees, every 0.1 s
    if (!st.freeView) {
      st.faceTimer += dt;
      if (st.faceTimer > FACE_INTERVAL_SECONDS) { st.faceTimer = 0; st.faceDeg = quantiseDeg(inp.yawDeg ?? st.faceDeg, FACE_STEP_DEG); }
    }
    out.faceDeg = st.faceDeg; out.freeView = st.freeView;

    // :607-621 RUN press-and-release toggles the horse moving
    if (st.pressed2 === 0) { if (inp.run) st.pressed2 = 1; }
    else if (!inp.run) { st.running = !st.running; st.pressed2 = 0; }

    // :623-702 movement
    if (st.running && st.pressed < 4) {
      if (st.pressed === 3) { st.pressed = 0; out.play.push({ stop: PEGAS_SOUND.scream }); }   // :624-626
      else if (st.pressed === -1 && !inp.sneak) st.pressed = 0;                          // :627-631
      if (!st.gallop) {
        out.gait = 'trot'; out.clip = CLIP.trot; out.loop = 'trot';
        out.forwardUnitsPerFrame = TROT_UNITS_PER_FRAME;                                  // :633-638
      } else if (st.pressed <= 3) {
        if (h.stamina > 0) {
          h.stamina = Math.max(0, h.stamina - ENDURANCE_DRAIN_GALLOP * frames);          // :642-643
          out.gait = 'gallop'; out.clip = CLIP.gallop; out.loop = 'gallop';
          out.forwardUnitsPerFrame = h.speed;                                             // :650-655
        } else {
          out.messages.push(MSG.tired); st.gallop = false;                                // :645-648
          out.play.push({ stop: PEGAS_SOUND.runforward });
          return finish(out);
        }
      }
      out.moving = true;
      st.doOnce = 2;                                                                       // :673
    } else if (st.pressed < 4) {
      if (st.doOnce === 0) { if (st.gallop) out.play.push(PEGAS_SOUND.idle3); st.doOnce = 1; } // :675-679
      else if (st.doOnce === 2) st.doOnce = 0;                                            // :680-682
      if (st.pressed <= 1) {
        if (h.stamina < h.endurance) h.stamina = Math.min(h.endurance, h.stamina + ENDURANCE_REGEN_RIDING * frames);   // :684-686
        out.clip = CLIP.idle; out.loop = null;                                            // :687-689
      }
    }

    // :707-859 the SNEAK machine
    if (st.pressed === -1 && !inp.sneak) st.pressed = 0;
    if (st.pressed === 0) {
      if (inp.sneak) { st.timer2 = 0; st.pressed = 1; }
    } else if (st.pressed === 1) {
      st.timer2 += dt;
      if (!inp.sneak) {
        if (st.running) {                                                                 // :721-729 the toggle, on release
          st.gallop = !st.gallop;
          out.messages.push(st.gallop ? MSG.gallop : MSG.trot);
        }
        out.play.push({ stop: PEGAS_SOUND.runforward }, { stop: PEGAS_SOUND.trot });
        st.pressed = 0;
      } else if (st.timer2 > SNEAK_HOLD_SECONDS) {                                        // :734-751 the hold
        out.play.push({ stop: PEGAS_SOUND.runforward }, { stop: PEGAS_SOUND.trot });
        st.timer2 = 0;
        if (!st.gallop) { st.running = false; st.pressed = 2; out.clip = CLIP.special; out.play.push({ clipOnce: CLIP.special }); }   // :738-741 the special move
        else if (!st.running) st.pressed = 0;                                             // :743-744
        else { st.pressed = 4; out.play.push(PEGAS_SOUND.idle2); }                              // :745-750 the jump
      } else if (inp.activate) {                                                          // :753-771 SNEAK + ACTIVATE
        if (inp.firstPerson !== false) {
          st.freeView = !st.freeView;
          out.messages.push(st.freeView ? MSG.freeViewOn : MSG.freeViewOff);
          st.pressed = -1;
        } else if (!st.running) { out.heightMenu = true; st.pressed = 100; }
        else st.pressed = -1;
      }
    } else if (st.pressed === 2) {                                                        // :774-793 the special move's 1.5 s
      if (!inp.sneak) st.pressed = 0;
      else {
        st.timer2 += dt;
        if (st.timer2 < SPECIAL_MOVE_SECONDS) {
          out.gait = 'special'; out.clip = CLIP.special;
          out.riderForward = -unitsToMetres(SPECIAL_MOVE_BACK); out.riderUp = unitsToMetres(st.pheight + SPECIAL_MOVE_UP);
        } else { st.pressed = 3; out.clip = CLIP.idle; }
      }
    } else if (st.pressed === 3) {                                                        // :794-808 held after the move: seated, idle
      if (!inp.sneak) st.pressed = 0;
    } else if (st.pressed === 4) {                                                        // :809-817 the jump's first frame
      out.play.push({ stop: PEGAS_SOUND.runforward });
      out.gravityScale = gravityScaleForSlowFall(LEVITATE_JUMP) * 0;                      // Levitate: no gravity
      out.verticalVelocity = unitsToMetres(perFrameToPerSecond(JUMP_RISE_PER_FRAME));     // the rise, from 30 up
      out.jumpStart = unitsToMetres(JUMP_RISE_INITIAL);
      st.pressed = 5; st.timer2 = 0;
      jumpFrame(out);
    } else if (st.pressed === 5) {                                                        // :818-848 the jump
      st.timer2 += dt;
      if (st.timer2 < JUMP_RISE_SECONDS) {
        out.gravityScale = 0;
        out.verticalVelocity = unitsToMetres(perFrameToPerSecond(JUMP_RISE_PER_FRAME));
      } else if (st.timer2 > JUMP_SECONDS) {
        st.pressed = -1; st.timer2 = 0;
        h.stamina = Math.max(0, h.stamina - JUMP_ENDURANCE_COST);                         // :828-832
        out.gravityScale = 1;                                                              // ridingspell3 off: the horse's own fall
      } else {
        out.gravityScale = gravityScaleForSlowFall(SLOW_FALL_JUMP);                       // :834 ridingspell2 off, ridingspell3 on
      }
      jumpFrame(out);
    } else if (st.pressed === 100) {                                                      // :849-858 the height menu waits on its button
      out.heightMenu = true;
    }

    // :864-892 the slope watch
    if (st.pressed < 4 && inp.horseY != null) {
      if (st.lastY != null) {
        const dz = (inp.horseY - st.lastY) * MW_UNITS_PER_METER / Math.max(frames, 1e-6);   // units per script frame
        const up = st.gallop ? h.speed - SLOPE_GALLOP_DROP : SLOPE_TROT_LIMIT;
        if (dz > up) st.verticalCount += 1;
        else if (dz < -up) st.verticalCount -= 1;
        else st.verticalCount = 0;
        if (st.verticalCount === SLOPE_FRAMES) { out.messages.push(MSG.tooSteepUp); st.running = false; st.verticalCount = 0; }
        else if (st.verticalCount === -SLOPE_FRAMES) { out.messages.push(MSG.tooSteepDown); st.running = false; st.verticalCount = 0; }
      }
      st.lastY = inp.horseY;
    }

    // :670-672 water: the horse's feet more than 70 units under the surface
    if (out.moving && inp.waterY != null && inp.horseY != null && (inp.horseY - inp.waterY) * MW_UNITS_PER_METER < -WATER_BELOW) {
      out.dismount = 'water';
    }
    // :897-901 ACTIVATE, not sneaking, dismounts
    if (inp.activate && !inp.sneak && st.pressed !== 100) out.dismount = 'activate';
    return finish(out);

    function jumpFrame(o) {
      o.moving = true; o.gait = 'jump'; o.clip = CLIP.gallop;
      o.forwardUnitsPerFrame = Math.max(0, h.speed - JUMP_FORWARD_SPEED_DROP);            // :836-837
      o.riderUp = unitsToMetres(st.pheight + JUMP_RIDER_UP);                              // :840
    }
    function finish(o) {
      o.speed = unitsToMetres(perFrameToPerSecond(o.forwardUnitsPerFrame));
      return o;
    }
  }

  /** :852-856 the height menu's answer: 0 higher, 1 lower, else cancel. */
  function heightButton(button) {
    if (st.pressed !== 100) return st.pheight;
    if (button === 0) st.pheight += 1; else if (button === 1) st.pheight -= 1;
    st.pressed = 0;
    return st.pheight;
  }

  return {
    mount, dismount, tick, heightButton,
    get riding() { return st.riding; },
    get horse() { return st.horse; },
    get running() { return st.running; },
    get gallop() { return st.gallop; },
    get freeView() { return st.freeView; },
    get pheight() { return st.pheight; },
    get faceDeg() { return st.faceDeg; },
    /** probes and tests */
    _state: st,
  };
}

/** :339-351 / :519-599: a yaw in degrees to the script's step. */
export function quantiseDeg(deg, step) {
  return Math.round(deg / step) * step;
}

/** :314-316: the horse standing on its own regenerates faster. Called
 *  by the pool for every horse nobody rides. */
export function regenStanding(horse, dt) {
  if (horse.stamina < horse.endurance) horse.stamina = Math.min(horse.endurance, horse.stamina + ENDURANCE_REGEN_DISMOUNTED * dt * PEGAS_SCRIPT_HZ);
  return horse.stamina;
}
