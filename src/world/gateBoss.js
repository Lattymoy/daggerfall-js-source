// @ts-check
// WB4 (2026-09-25, Mac: "a large boss arena with an oversized enemy with telegraphed attacks (like wind ups, etc)"):
// THE BOSS AS HE IS SEEN AND HEARD - where he stands and what he is doing at a moment of the relay's clock, the frame
// of Daggerfall's own sprite that shows it, the glow on him and the words of his voice. Design:
// bible/11-Multiplayer/World-Bosses.md section 5 ("On him: the sprite holds its attack frame's first half through the
// wind-up, glows the attack's colour, and his voice gives the wind-up's cue; at the landing the attack frames play out").
//
// PURE. The court's state (net/gateLink.js, the relay's words folded) and a clock in; a pose, a light, a cue out. The
// court's driver (scenes/gateCourt.js) turns them into a billboard, a light in the court's channel and sounds.
//
// HIS BODY is the mobile the look names (a Daedra Lord for Valkynaz Ruhn - archive 286, the frames every client
// already has) drawn at BOSS_SCALE times its size, the orientation tables and clip rates its own (characters/
// mobileUnit.js). The frames an attack shows are the attack clip's (records 5-9): its first two HELD through the
// wind-up - the raise, the second from half way - and the rest played at the clip's own 10 a second from the landing.
// The charge is run on the walk's frames at a run's pace, his body carried down the lane as the brain carries it.
//
// Not a DFU member. Ledger A (WB).
import { ATTACK_BY_ID, ATTACKS, BOSS_H } from '../net/gateBrain.js';
import { bossAt } from '../net/gateLink.js';
import { telegraphAt, chargeHead } from '../net/gateStrike.js';
import {
  MOVE_ANIMS, PRIMARY_ATTACK_ANIMS, HURT_ANIMS, IDLE_ANIMS, mobileOrientation,
  MOVE_ANIM_SPEED, IDLE_ANIM_SPEED, PRIMARY_ATTACK_ANIM_SPEED,
} from '../characters/mobileUnit.js';
import { ENEMY_BASICS } from '../characters/enemyBasics.js';
import { courtToDungeon } from './gateArena.js';

/** Each boss's look, by its id (net/gateLaw.js GATE_BOSSES): the mobile whose sprite he wears, and how many times its
 *  size he stands (BOSS_H is the body the blows are measured against - three Daedra Lords tall). */
export const BOSS_LOOKS = Object.freeze({ ruhn: Object.freeze({ mobile: 31, scale: 3 }) });
export const bossLookOf = (id) => BOSS_LOOKS[id] ?? BOSS_LOOKS.ruhn;

/** The charge's run on the walk's frames, frames a second (the walk's own is MOVE_ANIM_SPEED). */
export const RUN_ANIM_SPEED = 14;
/** A blow of mine lands: he flinches this long (only while he does nothing else - a wind-up is never broken). */
export const FLINCH_MS = 450;
/** The fall: the hurt frames played slowly this long, and then he is gone (WB5's spoils spill at the fall). */
export const FALL_MS = 2400;

/** The attacks' colours - the telegraph's on the ground and the glow on him - display-encoded (a foreign pass draws into
 *  an 8-bit display-encoded frame, render/duelWall.js). The ward's gold, and the ember he always carries. */
export const ATTACK_COLORS = Object.freeze({
  cleave: Object.freeze([1.0, 0.3, 0.12]),
  slam: Object.freeze([1.0, 0.52, 0.1]),
  charge: Object.freeze([1.0, 0.16, 0.08]),
  hellfire: Object.freeze([1.0, 0.64, 0.14]),
  nova: Object.freeze([1.0, 0.8, 0.28]),
  wrath: Object.freeze([0.9, 0.06, 0.03]),
});
export const WARD_COLOR = Object.freeze([1.0, 0.86, 0.5]);
export const EMBER_COLOR = Object.freeze([0.9, 0.32, 0.1]);

/** Where he stands at `now`, in the court's frame: down the lane while the charge runs and at its end after (the brain
 *  carries him so, net/gateBrain.js stepBrain - the next word finds him there), else his walk from the last word. */
export function bossPlace(s, now) {
  const atk = s?.atk;
  if (atk && ATTACK_BY_ID[atk.a] === ATTACKS.charge && now >= atk.at) {
    const head = chargeHead(atk, Math.min(now, atk.at + ATTACKS.charge.active));
    if (head) return head;
  }
  return bossAt(s, now);
}

/**
 * WHAT HE IS DOING at `now`: `act` one of gone, fall, windup, strike, run, walk, flinch, idle; `anims` the orientation
 * table that shows it; `frame` the frame index within the record (held frames are indices, a loop's a count to wrap);
 * `loop` whether it wraps; `atk` the attack's key while one is shown; `t` its wind-up's share.
 * @param {any} s the court's state (net/gateLink.js GateState) @param {number} now the relay's clock
 * @param {number} [hurtAt] when a blow of mine last landed on him
 */
export function bossAct(s, now, hurtAt = -Infinity) {
  if (!s || s.day === null) return { act: 'gone', anims: IDLE_ANIMS, frame: 0, loop: false, atk: null, t: 0 };
  if (s.fell) {
    const since = now - s.fell.at;
    if (since >= FALL_MS) return { act: 'gone', anims: HURT_ANIMS, frame: 0, loop: false, atk: null, t: 1 };
    return { act: 'fall', anims: HURT_ANIMS, frame: Math.max(0, Math.floor((since / FALL_MS) * 5)), loop: false, atk: null, t: since / FALL_MS };
  }
  const atk = s.atk, A = atk ? ATTACK_BY_ID[atk.a] : null;
  if (A) {
    const tel = telegraphAt(atk, s.phase, now);
    if (tel && now < atk.at) return { act: 'windup', anims: PRIMARY_ATTACK_ANIMS, frame: tel.t < 0.5 ? 0 : 1, loop: false, atk: A.key, t: tel.t };
    if (A === ATTACKS.charge && now < atk.at + A.active) {
      return { act: 'run', anims: MOVE_ANIMS, frame: Math.floor(((now - atk.at) / 1000) * RUN_ANIM_SPEED), loop: true, atk: A.key, t: 1 };
    }
    const played = Math.floor(((now - atk.at) / 1000) * PRIMARY_ATTACK_ANIM_SPEED);
    if (A !== ATTACKS.charge && played < 3) return { act: 'strike', anims: PRIMARY_ATTACK_ANIMS, frame: 2 + played, loop: false, atk: A.key, t: 1 };
  }
  const at = s.move && s.move.v > 0 ? bossAt(s, now) : null;
  const walking = !!at && Math.hypot(s.move.tx - at[0], s.move.tz - at[1]) > 0.05;
  if (now - hurtAt >= 0 && now - hurtAt < FLINCH_MS) return { act: 'flinch', anims: HURT_ANIMS, frame: Math.floor(((now - hurtAt) / FLINCH_MS) * 2), loop: false, atk: null, t: 0 };
  if (walking) return { act: 'walk', anims: MOVE_ANIMS, frame: Math.floor((now / 1000) * MOVE_ANIM_SPEED), loop: true, atk: null, t: 0 };
  return { act: 'idle', anims: IDLE_ANIMS, frame: Math.floor((now / 1000) * IDLE_ANIM_SPEED), loop: true, atk: null, t: 0 };
}

/**
 * The frame that shows an act to an eye at `cam` (the dungeon's frame): the record by the orientation his facing turns
 * to it, mirrored where the table mirrors, the frame index held at the record's last or wrapped by its count.
 * @param {ReturnType<typeof bossAct>} act @param {number} yaw @param {number[]} feet @param {number[]} cam
 * @param {(record: number) => number} frameCount
 */
export function bossFrame(act, yaw, feet, cam, frameCount) {
  const o = mobileOrientation(yaw, feet, cam && cam.length === 3 ? cam : feet);
  const a = act.anims[o] ?? act.anims[0];
  const n = Math.max(1, frameCount(a.record) | 0);
  const frame = act.loop ? ((act.frame % n) + n) % n : Math.max(0, Math.min(n - 1, act.frame));
  return { record: a.record, frame, flip: !!a.flip };
}

/** The light's chest height on him, and its reaches: at rest, through a wind-up, and at a landing. */
export const GLOW_UP = BOSS_H * 0.55;
export const GLOW_RANGE = Object.freeze({ ember: 7, windup: 12, landing: 18 });

/**
 * THE GLOW ON HIM: a light at his chest in the court's own channel (`{ x, y, z, range, color }`, colour times
 * intensity - world/gateArena.js withCourtLights), the attack's colour climbing through its wind-up and flaring at the
 * landing, gold while the ward stands, a low ember otherwise; null when he is gone.
 */
export function bossGlow(s, now) {
  if (!s || s.day === null) return null;
  if (s.fell && now - s.fell.at >= FALL_MS) return null;
  const [cx, cz] = bossPlace(s, now);
  const [x, y, z] = courtToDungeon(cx, GLOW_UP, cz);
  const lit = (color, k, range) => ({ x, y, z, range, color: color.map((c) => c * k) });
  if (s.fell) return lit(EMBER_COLOR, 2.2 * (1 - (now - s.fell.at) / FALL_MS), GLOW_RANGE.landing);
  const atk = s.atk, A = atk ? ATTACK_BY_ID[atk.a] : null;
  if (A) {
    const tel = telegraphAt(atk, s.phase, now);
    if (tel && !tel.over) {
      const color = ATTACK_COLORS[A.key] ?? EMBER_COLOR;
      if (tel.landing) return lit(color, 2.4, GLOW_RANGE.landing);
      return lit(color, 0.35 + 1.25 * tel.t * tel.t, GLOW_RANGE.windup);
    }
    if (tel && tel.since < Math.max(A.active, 1) + 350) return lit(ATTACK_COLORS[A.key] ?? EMBER_COLOR, 2.4 * (1 - (tel.since - Math.max(A.active, 1)) / 350), GLOW_RANGE.landing);
  }
  if (now < s.shieldUntil) return lit(WARD_COLOR, 0.9 + 0.3 * Math.sin(now / 90), GLOW_RANGE.windup);
  return lit(EMBER_COLOR, 0.45, GLOW_RANGE.ember);
}

/** HIS VOICE - DAGGER.SND records by index (`clip`: his own mobile's bark and attack, enemyBasics.js, pitched down for
 *  his size) or sound IDs (`id`: the fire's cast, played through audio.play3dId - systems/enemySpells.js's law), with
 *  the loudness and the reach the court needs (the floor is 48 m across). `at` says where: at him, or at each of the
 *  attack's targets. */
const B = ENEMY_BASICS[31];
const voice = (clip, pitch, volume = 1.3) => Object.freeze({ clip, pitch, volume, reach: 60, at: 'him' });
export const BURNING = 420;   // systems/soundClips.js SOUND.Burning
export const FIRE_CAST_ID = 352;   // systems/enemySpells.js SPELL_CAST_SOUND[0], the fire's
export const BOSS_CUES = Object.freeze({
  windup: Object.freeze({
    cleave: voice(B.barkSound, 0.78),
    slam: voice(B.barkSound, 0.66),
    charge: voice(B.moveSound, 0.7),
    hellfire: Object.freeze({ id: FIRE_CAST_ID, pitch: 0.8, volume: 1.3, reach: 60, at: 'him' }),
    nova: Object.freeze({ id: FIRE_CAST_ID, pitch: 0.62, volume: 1.4, reach: 60, at: 'him' }),
    wrath: voice(B.barkSound, 0.45, 1.8),
  }),
  land: Object.freeze({
    cleave: voice(B.attackSound, 0.8),
    slam: voice(B.attackSound, 0.6, 1.6),
    charge: voice(B.attackSound, 0.72),
    hellfire: Object.freeze({ clip: BURNING, pitch: 0.9, volume: 1.2, reach: 40, at: 'targets' }),
    nova: Object.freeze({ clip: BURNING, pitch: 0.7, volume: 1.8, reach: 60, at: 'him' }),
    wrath: Object.freeze({ clip: BURNING, pitch: 0.5, volume: 2, reach: 120, at: 'him' }),
  }),
  roar: voice(B.barkSound, 0.5, 1.8),
  fall: voice(B.barkSound, 0.4, 1.8),
});
