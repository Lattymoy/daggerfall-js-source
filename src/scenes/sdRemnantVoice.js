// @ts-check
// SD14a (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 10 and section 16's SD14a;
// Mac: "The detail needs to exceed that of the oblivion gates"): THE BRASS REMNANT'S VOICE - its body and its Echoes
// heard. The Warden speaks in 48 cues (world/gateBoss.js BOSS_CUES); the Remnant had its blows' wind-ups and landings
// and its fall's thud (scenes/sdRemnantBlows.js SD_BLOW_CUES) and nothing of its body: no step, no wake, no turn of its
// phases, no Echo rising or broken, no stun, no loss. Here, read off the fight this page holds each frame:
//
//   ITS BODY - Daggerfall's own Iron Atronach (ENEMY_BASICS row 36: its move 222, bark 223, attack 224), pitched down
//     for a colossus of brass: a stride on the stone every SD_STRIDE_M walked; a growl while it does not strike, every
//     SD_GROWL_MS and a seeded part more; a grunt as it is hurt (SD_HURT_FRAC of its health, SD_HURT_GAP_MS apart); its
//     wake (the bark, the Hour's bell under it); its turn to the Dragon Break (the Rift's chime, low - it steps outside
//     time) and to the Last Moment (its deepest bark, the storm's roll over it); its return from outside time (the
//     gears grinding back together); a stun (its bark cut short, a ring) and its recovery (the gears again); once, the
//     gears slipping as it falls under a fifth of its health; its cry at its fall; the Hour's bell, lowest, when the
//     fight is lost.
//   ITS ECHOES - each its own pitch, gold's under silver's: rising (the chime), each stride, each hurt, broken (the
//     shatter).
//   ITS BLOWS' RELEASE - WB13d's law: SD_RELEASE_MS before each blow lands, the weight of it coming (the Stomp's body,
//     the Hand's swing, the Volley's gears loosed, the Pulse's roll, the Reset's ring, the End's bell).
//   AIMED AT ME - a Volley's mark under my own feet at its word: the parry's ring, high and sharp, at my feet (WB13e).
//
// A turn is heard as it happens: what this page first sees already turned (a late join, a reload) is taken as it
// stands, never sounded late. Pure of the scene but for the engine's play3d; the fight's own clock (net/sdFightLink.js
// `now`). Not a DFU member. Ledger A (SUPER-DUNGEONS).

import { SD_ARENA, realmToDungeon, dungeonToRealm } from '../net/sdBrain.js';
import { SD_BLOW_BY_ID, SD_BLOWS, SD_BODY } from '../net/sdRemnant.js';
import { sdBodyAt, sdEndAgain } from '../net/sdFightLink.js';
import { BODY_FALL, THUNDER_ROLL, SWING_LOW, CRYSTAL_CLIPS } from '../world/gateBoss.js';

/** The Iron Atronach's voice (characters/enemyBasics.js row 36: moveSound, barkSound, attackSound). */
export const SD_IRON = Object.freeze({ move: 222, bark: 223, attack: 224 });
/** DAGGER.SND's own besides (the Rift's bell 107, the Orrery's chime 364, the gears' grind 68). */
const TOLL = 107, CHIME = 364, GRIND = 68;
const cue = (clip, pitch, volume, reach, at = 'body') => Object.freeze({ clip, pitch, volume, reach, at });
/** ITS VOICE: every cue, each a clip, its pitch (down for its size), its volume and how far it carries (m). */
export const SD_VOICE_CUES = Object.freeze({
  step: cue(SD_IRON.move, 0.5, 1.2, 50),
  growl: cue(SD_IRON.bark, 0.42, 0.9, 60),
  hurt: cue(SD_IRON.bark, 0.6, 0.9, 40),
  wake: cue(SD_IRON.bark, 0.36, 2.0, 160),
  wakeToll: cue(TOLL, 0.5, 1.6, 160, 'arena'),
  outside: cue(CHIME, 0.5, 1.8, 160),
  last: cue(SD_IRON.bark, 0.32, 2.1, 160),
  lastRoll: cue(THUNDER_ROLL, 0.55, 1.6, 180, 'arena'),
  back: cue(GRIND, 0.55, 1.6, 120),
  stunned: cue(SD_IRON.bark, 0.7, 1.8, 120),
  stunRing: cue(CRYSTAL_CLIPS.hit, 0.5, 1.4, 80),
  recover: cue(GRIND, 0.8, 1.3, 80),
  slip: cue(GRIND, 0.4, 1.6, 120),
  slipBark: cue(SD_IRON.bark, 0.34, 1.6, 120),
  fallCry: cue(SD_IRON.bark, 0.3, 2.0, 160),
  lost: cue(TOLL, 0.38, 1.8, 200, 'arena'),
  echoRise: Object.freeze([cue(CHIME, 0.9, 1.4, 80), cue(CHIME, 1.2, 1.4, 80)]),
  echoFall: Object.freeze([cue(CRYSTAL_CLIPS.shatter, 0.8, 1.6, 90), cue(CRYSTAL_CLIPS.shatter, 1.05, 1.6, 90)]),
  echoStep: Object.freeze([cue(SD_IRON.move, 0.8, 0.7, 30), cue(SD_IRON.move, 0.95, 0.7, 30)]),
  echoHurt: Object.freeze([cue(SD_IRON.bark, 0.95, 0.6, 30), cue(SD_IRON.bark, 1.15, 0.6, 30)]),
  release: Object.freeze({
    stomp: cue(BODY_FALL, 0.5, 1.4, 50), hand: cue(SWING_LOW, 0.4, 1.5, 50), volley: cue(GRIND, 1.6, 1.3, 60),
    pulse: cue(THUNDER_ROLL, 0.8, 1.2, 120, 'arena'), reset: cue(CRYSTAL_CLIPS.hit, 0.42, 1.5, 120, 'arena'), end: cue(TOLL, 0.3, 2.0, 200, 'arena'),
  }),
  sting: cue(CRYSTAL_CLIPS.hit, 2.2, 1.3, 20, 'feet'),
  // AUDIT SD III (A2): the End struck again (net/sdFightLink.js sdEndAgain) - a third of its toll, the clock's knell
  knell: cue(TOLL, 0.3, 0.7, 200, 'arena'),
});
/** A stride's length, the Remnant's and an Echo's (m); a jump past this between frames is a body put somewhere, not
 *  walked. */
export const SD_STRIDE_M = 3.2;
export const SD_ECHO_STRIDE_M = 2.2;
const JUMP_M = 6;
/** The growl's least wait and how much more a seeded draw adds (ms). */
export const SD_GROWL_MS = 7000;
export const SD_GROWL_MORE_MS = 6000;
/** A grunt for each SD_HURT_FRAC of its health lost, never closer than SD_HURT_GAP_MS. */
export const SD_HURT_FRAC = 0.004;
export const SD_HURT_GAP_MS = 1400;
/** The release: this long before a blow lands (WB13d). */
export const SD_RELEASE_MS = 350;
/** A turn heard this late at most (ms) - a wake, a fall. */
export const SD_TURN_LATE_MS = 1500;
/** AUDIT SD III (A6): a page that heard nothing of its fight this long (ms) was away - what it passed is not heard. */
export const SD_VOICE_AWAY_MS = 4000;
/** The gears slip once, under this share of its health. */
export const SD_SLIP_FRAC = 0.2;
/** A Volley's mark this near my feet is aimed at me (m). */
export const SD_STING_M = 2;

/** A seeded draw a fight (its number), 0..1 - every screen growls on its own beat, the same each run. */
const lcg = (seed) => { let x = (seed * 2654435761) >>> 0 || 1; return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; }; };
const frac = (h, m) => (m > 0 ? Math.max(0, Math.min(1, h / m)) : 1);

/**
 * The Remnant's voice on this screen. `audio` the engine (play3d), `link` the fight's (net/sdFightLink.js), `feet()`
 * mine in the dungeon's frame (null out of the Hour).
 * @param {{ audio?: any, link: any, feet?: () => (number[] | null) }} deps
 */
export function createSdRemnantVoice({ audio = null, link, feet = () => null }) {
  /** what this page knows of the fight it last heard - null until it is seen */
  let k = null;
  const play = (c, at) => { if (!c || !audio || !at) return; try { audio.play3d?.(c.clip, at, c.volume, { maxDistance: c.reach, distanceModel: 'linear', pitch: c.pitch }); } catch { /* a sound is never the fight */ } };
  const arena = () => realmToDungeon(SD_ARENA.x, 4, SD_ARENA.z);
  const placeOf = (B, t, y) => { const [x, z] = sdBodyAt(B, t); return realmToDungeon(SD_ARENA.x + x, y, SD_ARENA.z + z); };
  const sound = (c, at) => play(c, c.at === 'arena' ? arena() : c.at === 'feet' ? feet() : at);
  const blowsOf = (s) => {
    const out = [];
    if (s.rem?.atk) out.push([SD_BODY.remnant, s.rem.atk]);
    (s.ec ?? []).forEach((E, i) => { if (E.h > 0 && E.atk) out.push([SD_BODY.gold + i, E.atk]); });
    if (s.clk) out.push([SD_BODY.hour, s.clk]);
    return out;
  };
  /** What a fight is now, as this page will remember it. */
  const seen = (s, t) => ({
    fi: s.fi, t, ph: s.ph, awake: t >= s.op, ou: t < s.ou, stun: t < s.su, fell: !!s.fell, lost: !!s.lost,
    hp: frac(s.h, s.m), hurtHp: frac(s.h, s.m), hurtAt: -Infinity, slipped: frac(s.h, s.m) < SD_SLIP_FRAC,
    growlAt: t + SD_GROWL_MS, rng: lcg(s.fi), walked: 0, at: s.rem ? sdBodyAt(s.rem, t) : null,
    ec: (s.ec ?? []).map((E) => ({ up: E.h > 0, hp: frac(E.h, E.m), hurtAt: -Infinity, walked: 0, at: sdBodyAt(E, t) })),
    blows: new Map(blowsOf(s).map(([, a]) => [a.i, { released: t >= a.at - SD_RELEASE_MS, stung: true }])),
  });
  /** A body's strides since the last frame - a step heard for each `stride` walked. */
  function strides(m, B, t, stride, c, y) {
    if (!B) return;
    const at = sdBodyAt(B, t);
    if (m.at) {
      const d = Math.hypot(at[0] - m.at[0], at[1] - m.at[1]);
      if (d > JUMP_M) m.walked = 0;
      else { m.walked += d; if (m.walked >= stride) { m.walked %= stride; play(c, realmToDungeon(SD_ARENA.x + at[0], y, SD_ARENA.z + at[1])); } }
    }
    m.at = at;
  }

  return {
    /** One frame: every turn since the last heard, where it happens. */
    frame() {
      const s = link?.state?.(), t = link?.now?.();
      if (!s || !(s.fi > 0) || !Number.isFinite(t)) { k = null; return; }
      if (!k || k.fi !== s.fi) { k = seen(s, t); return; }   // a fight first seen is taken as it stands
      // AUDIT SD III (A6): and a fight unheard SD_VOICE_AWAY_MS (a tab put away, the page asleep) - taken again as it
      // stands, in silence: every turn it passed sounded at once on the first frame back
      if (!(t - k.t <= SD_VOICE_AWAY_MS)) { k = seen(s, t); return; }
      const rem = (y = 3) => (s.rem ? placeOf(s.rem, t, y) : arena());
      // its end, and the fight lost
      if (s.fell && !k.fell) { k.fell = true; if (t - s.fell.at < SD_TURN_LATE_MS) play(SD_VOICE_CUES.fallCry, rem(4)); }
      if (s.lost && !k.lost) { k.lost = true; sound(SD_VOICE_CUES.lost); }
      if (s.fell || s.lost) { k.t = t; return; }
      // its wake, its turns, outside time and back
      const awake = t >= s.op;
      if (awake && !k.awake && t - s.op < SD_TURN_LATE_MS) { play(SD_VOICE_CUES.wake, rem(4)); sound(SD_VOICE_CUES.wakeToll); k.growlAt = t + SD_GROWL_MS; }
      k.awake = awake;
      if (s.ph !== k.ph) {
        if (s.ph === 2) play(SD_VOICE_CUES.outside, rem(4));
        else if (s.ph === 3) { play(SD_VOICE_CUES.last, rem(4)); sound(SD_VOICE_CUES.lastRoll); }
        k.ph = s.ph;
      }
      const ou = t < s.ou;
      if (ou && !k.ou) play(SD_VOICE_CUES.back, rem(3));
      k.ou = ou;
      const outside = s.ph === 2 || ou;
      // stunned, and up again
      const stun = t < s.su;
      if (stun && !k.stun) { play(SD_VOICE_CUES.stunned, rem(4)); play(SD_VOICE_CUES.stunRing, rem(3)); }
      else if (!stun && k.stun) play(SD_VOICE_CUES.recover, rem(3));
      k.stun = stun;
      // hurt, and the gears slipping once
      const hp = frac(s.h, s.m);
      // AUDIT SD IV (A1): and none outside time - an Echo's blow comes off the whole, and nothing stands where it is
      // heard; the count follows, so no grunt is banked for its return
      if (outside) k.hurtHp = hp;
      else if (k.hurtHp - hp >= SD_HURT_FRAC && t - k.hurtAt >= SD_HURT_GAP_MS) { play(SD_VOICE_CUES.hurt, rem(4)); k.hurtAt = t; k.hurtHp = hp; }
      if (hp > k.hurtHp) k.hurtHp = hp;   // a share joined: the count from where it stands
      if (hp < SD_SLIP_FRAC && !k.slipped) { k.slipped = true; play(SD_VOICE_CUES.slip, rem(3)); play(SD_VOICE_CUES.slipBark, rem(4)); }
      k.hp = hp;
      // its strides, and a growl while it does not strike
      if (!outside) strides(k, s.rem, t, SD_STRIDE_M, SD_VOICE_CUES.step, 0.5);
      else k.at = null;
      const striking = !!s.rem?.atk && t < s.rem.atk.at + 1500;
      // AUDIT SD III (A2): and none once the Hour has ended - it stands still under the End's knell (it growled through it)
      if (awake && !outside && !stun && !striking && !(s.ended > 0) && t >= k.growlAt) { play(SD_VOICE_CUES.growl, rem(4)); k.growlAt = t + SD_GROWL_MS + k.rng() * SD_GROWL_MORE_MS; }
      else if (striking && k.growlAt < t + 2000) k.growlAt = t + 2000;
      // its Echoes: risen, striding, hurt, broken
      (s.ec ?? []).forEach((E, i) => {
        const m = (k.ec[i] ??= { up: false, hp: 1, hurtAt: -Infinity, walked: 0, at: null });
        const up = E.h > 0, at = (y) => placeOf(E, t, y);
        if (up && !m.up) { play(SD_VOICE_CUES.echoRise[i] ?? SD_VOICE_CUES.echoRise[0], at(2)); m.hp = frac(E.h, E.m); }
        else if (!up && m.up) play(SD_VOICE_CUES.echoFall[i] ?? SD_VOICE_CUES.echoFall[0], at(2));
        m.up = up;
        if (!up) { m.at = null; return; }
        const f = frac(E.h, E.m);
        if (m.hp - f >= SD_HURT_FRAC * 4 && t - m.hurtAt >= SD_HURT_GAP_MS) { play(SD_VOICE_CUES.echoHurt[i] ?? SD_VOICE_CUES.echoHurt[0], at(2)); m.hurtAt = t; m.hp = f; }
        if (f > m.hp) m.hp = f;
        strides(m, E, t, SD_ECHO_STRIDE_M, SD_VOICE_CUES.echoStep[i] ?? SD_VOICE_CUES.echoStep[0], 0.5);
      });
      if (!s.ec) k.ec = [];
      // the blows: each one's release, a Volley's mark at my feet. AUDIT SD IV (A4): the ground's shock under the Stomp
      // is its landing (scenes/sdRemnantBlows.js SD_BLOW_CUES.land.stomp) - a quake here was the same thud a second time
      const mine = feet(), me = mine ? dungeonToRealm(mine[0], mine[1], mine[2]) : null;
      for (const [b, a] of blowsOf(s)) {
        const A = SD_BLOW_BY_ID[a.a];
        if (!A) continue;
        let m = k.blows.get(a.i);
        if (!m) {
          m = { released: t >= a.at - SD_RELEASE_MS, stung: false };
          k.blows.set(a.i, m);
          if (k.blows.size > 32) k.blows.delete(k.blows.keys().next().value);
        }
        const where = b === SD_BODY.remnant ? rem(3) : b === SD_BODY.hour ? arena() : placeOf(s.ec?.[b - SD_BODY.gold], t, 2);
        if (!m.stung) {
          m.stung = true;
          if (A === SD_BLOWS.volley && me && t < a.at && (a.tg ?? []).some((q) => Math.hypot(SD_ARENA.x + q[0] - me[0], SD_ARENA.z + q[1] - me[2]) <= SD_STING_M)) sound(SD_VOICE_CUES.sting);
        }
        if (!m.released && t >= a.at - SD_RELEASE_MS) { m.released = true; if (t < a.at) sound(sdEndAgain(a, s) ? SD_VOICE_CUES.knell : SD_VOICE_CUES.release[A.key], where); }
      }
      k.t = t;
    },
    /** Out of the Hour: forgotten - the next fight heard is taken as it stands. */
    leave() { k = null; },
  };
}
