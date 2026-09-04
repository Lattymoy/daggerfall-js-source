// ═══════════════════════════════════════════════════════════════════
// PH1 — THE RIDER: the host's half of the riding script. pegasRide.js
// is the LAW (the script's machine, pure); pegasHorses.js the HORSES
// (the world records); this is the glue a host mounts once - the
// activation pick, the mount with its gates and its saddle, the
// per-frame tick that hands the machine the keys and hands the motor
// the machine's answer, the sounds and messages, the ridden horse's
// draw, the dismount. world.js reaches it through six calls and owns
// nothing of the script.
//
// THE MOTOR IS THE HORSE'S BODY (Pegas-Arc decision 4): on mounting,
// the rider takes the horse's place - the motor's feet become the
// horse's feet - and the horse is drawn at the rider, `frontback`
// units behind the eye along its facing (the script places the RIDER
// 20 forward of the horse, :662-666; the port places the horse 20
// behind the rider, which is the same picture). The record's
// position and facing are written back every frame, so the horse is
// wherever the rider is the moment they dismount, exactly as the
// script's `hr_horsex/y/z` record it.
// ═══════════════════════════════════════════════════════════════════

import { EYE_HEIGHT } from '../player/motor.js';
import { pickActivatable } from '../player/activate.js';
import { horseModelMatrix } from './pegasHorse.js';
import { horseRecord } from './pegasHorses.js';
import { createPegasRide, mountGate, takeSaddle, giveSaddle, MSG, CLIP } from './pegasRide.js';

/** The volume the classic ride uses for its clops (riding.js), so the
 *  mod's hooves sit at the same level in the mix. */
export const PEGAS_VOLUME = 0.6;

/**
 * @param deps
 *   player      the PlayerMotor
 *   playerEntity the entity (race, items, fatigue)
 *   horses      createPegasHorses(...)
 *   renderer    for the ridden draw
 *   audio       playOneShot(key, vol) / setLoop(name, key|null, { volume })
 *   sounds      () => Set of registered `pegas:*` keys (MW-D42's registration)
 *   say         (line) => void - the HUD line (townTalk.say)
 *   openHeightMenu (onButton) => boolean - the host's three-button
 *     "Position Your Height" box; absent = the menu cancels with a line
 */
export function createPegasRider({ player, playerEntity, horses, renderer, audio, sounds = () => new Set(), say = () => {}, openHeightMenu = null }) {
  const ride = createPegasRide();
  let ridden = null;
  let activateEdge = false;
  let clipNow = null;
  let heightMenuOpen = false;

  function playKey(key) {
    if (typeof key !== 'string') return;
    if (sounds().has(key)) audio.playOneShot(key, PEGAS_VOLUME);
  }

  /**
   * The activation ladder's arm. Riding: the ride consumes ACTIVATE
   * (dismount, or free view under SNEAK - :753, :897) and answers
   * true. Standing: a horse under the ray takes the mount gates;
   * nothing under it answers false so the ladder goes on.
   */
  function tryActivate(eye, dir, collider, { sneaking = false } = {}) {
    if (ride.riding) { activateEdge = true; return true; }
    const key = pickActivatable(eye, dir, horses.targets(), collider);
    if (!key) return false;
    const h = horses.byKey(key);
    if (!h) return false;
    mount(h, { sneaking, yawDeg: null });
    return true;
  }

  /** :223-312 - the gates, the saddle, the seat. Answers the gate's
   *  refusal (with its message said) or null when mounted. */
  function mount(h, { sneaking = false, yawDeg = null } = {}) {
    const gate = mountGate({
      sneaking, horseDead: h.dead, horseUnderwater: false,   // PH1: the water arm (:255) waits on a water level for a standing horse
      ridingAnother: ride.riding, items: playerEntity.items,
    });
    if (gate) {
      if (gate.message) say(gate.message);
      // gate.menu (the dialog), gate.inventory (a dead horse's pack) are PH2's
      return gate;
    }
    takeSaddle(playerEntity.items);
    const m = ride.mount({ race: playerEntity.race, horse: horseRecord(h), yawDeg: yawDeg ?? h.yawDeg });
    ridden = h;
    h.ridden = true;
    // the rider takes the horse's place: the motor is the horse from here
    player.spawn(h.pos[0], h.pos[1], h.pos[2]);
    player.pegas = { forward: 0, speed: 0, gravityScale: 1, verticalVelocity: null, eyeHeight: m.riderUp + EYE_HEIGHT, fallDamage: false };
    for (const k of m.play) playKey(k);
    if (h.assembly) { h.assembly.setClip(CLIP.idle); clipNow = CLIP.idle; }
    return null;
  }

  /** One frame while riding. `yawDeg` is the camera's yaw in the
   *  motor's convention (fwd = sin, cos); `firstPerson` the view. */
  function tick({ dt, run, sneak, firstPerson = true, yawDeg, waterY = null, paused = false }) {
    if (!ride.riding || !ridden) return null;
    if (paused) { activateEdge = false; return null; }   // F-E1: paused rides do not advance
    const o = ride.tick({
      dt, run, sneak, activate: activateEdge, firstPerson, yawDeg,
      riderFatigue: playerEntity.fatigue, horseY: player.pos[1], waterY, horseDead: ridden.dead,
    });
    activateEdge = false;
    for (const line of o.messages) say(line);
    for (const p of o.play) {
      if (typeof p === 'string') playKey(p);
      else if (p && p.clipOnce && ridden.assembly) { ridden.assembly.setClip(p.clipOnce); clipNow = p.clipOnce; }
    }
    const loopKey = o.loop === 'trot' ? 'pegas:trot' : o.loop === 'gallop' ? 'pegas:gallop' : null;
    audio.setLoop('riding', loopKey && sounds().has(loopKey) ? loopKey : null, { volume: PEGAS_VOLUME });
    // the motor's bag for this frame
    player.pegas = {
      forward: o.moving ? 1 : 0, speed: o.speed, gravityScale: o.gravityScale, verticalVelocity: o.verticalVelocity,
      eyeHeight: o.riderUp + EYE_HEIGHT, fallDamage: o.fallDamage,
    };
    if (o.jumpStart) { player.pos[1] += o.jumpStart; player.grounded = false; }   // :812 the jump's first-frame lift, a setpos
    // the horse's record follows the rider (:667-669)
    const face = o.faceDeg * Math.PI / 180;
    ridden.pos[0] = player.pos[0] - Math.sin(face) * o.riderForward;
    ridden.pos[1] = player.pos[1];
    ridden.pos[2] = player.pos[2] - Math.cos(face) * o.riderForward;
    ridden.yawDeg = o.faceDeg;
    if (ridden.assembly && o.clip !== clipNow && !(clipNow === CLIP.special && o.gait === 'special')) {
      if (!ridden.assembly.setClip(o.clip)) ridden.assembly.setClip(CLIP.idle);
      clipNow = o.clip;
    }
    if (o.heightMenu && !heightMenuOpen) {
      heightMenuOpen = true;
      const opened = openHeightMenu ? openHeightMenu((button) => { ride.heightButton(button); heightMenuOpen = false; }) : false;
      if (!opened) { say(MSG.positionHeight); ride.heightButton(2); heightMenuOpen = false; }
    }
    if (o.dismount) dismount(o.dismount);
    return o;
  }

  /** :903-949 */
  function dismount(reason = 'activate') {
    if (!ride.riding) return;
    const d = ride.dismount(reason);
    for (const line of d.messages) say(line);
    for (const k of d.play) playKey(k);
    audio.setLoop('riding', null);
    giveSaddle(playerEntity.items);
    const h = ridden;
    ridden = null;
    if (h) {
      h.ridden = false;
      if (h.assembly) h.assembly.setClip(CLIP.idle);
    }
    player.pegas = null;
    clipNow = null;
  }

  /** The ridden horse, drawn at the rider through the character pass. */
  function drawRidden(dt, { paused = false } = {}) {
    if (!ridden || !ridden.assembly) return;
    ridden.assembly.advance(paused ? 0 : dt);
    renderer.drawCharacter(ridden.assembly.mesh, horseModelMatrix(ridden.pos, ridden.yawDeg * Math.PI / 180));
  }

  return {
    tryActivate, mount, tick, dismount, drawRidden,
    get riding() { return ride.riding; },
    get ridden() { return ridden; },
    get ride() { return ride; },
  };
}
