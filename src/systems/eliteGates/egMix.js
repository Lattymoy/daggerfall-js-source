// @ts-check
// EG-G2 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 26 - THE SPIRE MIX,
// EG17): what the breach's screen hears first. The audio engine (systems/audio.js) has no voice cap, ducking or priority,
// and the gate stings only for a Meteor or a Leap on your ground (world/gate/gateBoss.js BOSS_CUES.sting): fourteen adds,
// eight players and the score would mask the cues that matter. So, in the Spire:
//   A PERSONAL STING, always, for a lord's blow or a CHECK on your feet - the gate's sting (the parry's ring at your feet);
//     for an add's, at most one each EG_MIX.addGapMs;
//   THE CRITICAL BUS (stings, a lord's wind-up and release, CHECKs) ducks the score by EG_MIX.duckDb for EG_MIX.duckMs and
//     is never culled (systems/music.js duck - the song's own level dipped, the fades left alone);
//   BARKS capped at EG_MIX.barksPerKind a kind a frame, nearest first (egBarkCull) - the legion's wind-up cues;
//   PEERS' sounds EG_MIX.peerDb down (EG-ZH: `peers(on)` hands the online layer's one scope over every peer sound -
//     net/peer/peerFx.js peerHeard - the engine's gain about it, systems/audio.js scaled), and WATCHFIRE's tell at
//     EG_MIX.watchfirePitch (EG-ZH: `tell(at)` - the gate's sting, lower, where the told blow will land, once a blow);
//   the reverb is the hall's (section 11.9 - systems/eliteGates/egReverb.js).
// The law is pure (egStingWanted, egBarkCull); `createSpireMix` is its seam over the engine and the music.
// EG-ZD (2026-10-12, Mac: "I said I want everything"; section 26, EG-G1's departure 9): THE BEATS ON THE CRITICAL BUS -
//   the HUD's beats (ui/eliteGates/egBeats.js EG_BEAT_SOUNDS: a door, a fall's low toll, a Redoubt's, the count's tolls, a rune's
//   chime, the recap's Rare chime) ride it too (`beat`): their one-shot through the engine, the score ducked, never culled.
//
// Not a DFU member. Ledger A (ELITE-GATES).
import { BOSS_CUES } from '../../world/gate/gateBoss.js';
import { setPeerSoundScope } from '../../net/peer/peerFx.js';   // EG-ZH: the peers' sounds' one scope

/** THE SPIRE MIX's numbers (section 26). */
export const EG_MIX = Object.freeze({ duckDb: 6, duckMs: 300, addGapMs: 1500, barksPerKind: 4, peerDb: -4, watchfirePitch: 1.4 });
/** A level in decibels as a gain. */
export const egDbGain = (db) => 10 ** (db / 20);
/** What rides THE CRITICAL BUS (never culled, ducks the score). */
export const EG_CRITICAL = Object.freeze(['sting', 'windup', 'release', 'check']);

/** Whether a personal sting sounds for a blow of `kind` ('lord', 'check', 'add') on my feet at `now`, the last add's sting
 *  at `lastAddAt` (ms). Pure. */
export const egStingWanted = (kind, now, lastAddAt = -Infinity) => kind === 'lord' || kind === 'check' || (kind === 'add' && now - lastAddAt >= EG_MIX.addGapMs);

/**
 * THE BARKS' CAP: of `barks` (`{ kind, at: [x, y, z] }`), at most `per` a kind, nearest `ear` first - the rest dropped this
 * frame. The critical bus is never culled: a bark marked `critical` always stays (and counts toward its kind). Pure; the
 * order kept is nearest first.
 */
export function egBarkCull(barks, ear, per = EG_MIX.barksPerKind) {
  const d2 = (b) => (ear && b.at ? (b.at[0] - ear[0]) ** 2 + (b.at[1] - ear[1]) ** 2 + (b.at[2] - ear[2]) ** 2 : 0);
  const sorted = [...barks].sort((a, b) => (b.critical ? 1 : 0) - (a.critical ? 1 : 0) || d2(a) - d2(b));
  const n = new Map(), out = [];
  for (const b of sorted) {
    const k = n.get(b.kind) ?? 0;
    if (k >= per && !b.critical) continue;
    n.set(b.kind, k + 1);
    out.push(b);
  }
  return out;
}

/** EG-ZH: WATCHFIRE'S TELL (section 26) - the gate's sting (the parry's ring, world/gate/gateBoss.js BOSS_CUES.sting) at
 *  EG_MIX.watchfirePitch, so an early outline is heard apart from a sting on your own feet (pitch 2.2); its volume and
 *  reach the sting's. */
export const EG_TELL_CUE = Object.freeze({ clip: BOSS_CUES.sting.clip, pitch: EG_MIX.watchfirePitch, volume: BOSS_CUES.sting.volume, reach: BOSS_CUES.sting.reach });

/**
 * THE MIX'S SEAM: `sting(kind, at)` (a personal sting at my feet, ducking the score), `critical()` (the duck alone),
 * `barks(list, ear, play)` (the cap, each kept bark played by `play`), `beat(S)` (EG-ZD: a HUD beat's one-shot on the
 * critical bus), `peerVolume(v)`; EG-ZH: `peers(on)` (every peer's sound EG_MIX.peerDb down while on) and `tell(at)`
 * (Watchfire's tell where a told blow will land).
 * @param {{ audio?: any, music?: any, now?: () => number }} deps
 */
export function createSpireMix({ audio = null, music = null, now = () => Date.now() } = {}) {
  let lastAdd = -Infinity, stings = 0, ducks = 0, tells = 0, peersOn = false;
  const mix = {
    /** THE CRITICAL BUS: the score ducked EG_MIX.duckDb for EG_MIX.duckMs. */
    critical() { ducks++; try { music?.duck?.(EG_MIX.duckDb, EG_MIX.duckMs / 1000); } catch { /* the score is never the fight */ } },
    /** A personal sting for a blow of `kind` on my feet, at `at` (the scene's frame). Answers whether it sounded. */
    sting(kind, at) {
      const t = now();
      if (!egStingWanted(kind, t, lastAdd)) return false;
      if (kind === 'add') lastAdd = t;
      stings++;
      const c = BOSS_CUES.sting;
      try { if (at) audio?.play3d?.(c.clip, at, c.volume, { maxDistance: c.reach, distanceModel: 'linear', pitch: c.pitch }); } catch { /* a sound is never the fight */ }
      mix.critical();
      return true;
    },
    /** The frame's barks, capped (egBarkCull) and each kept one handed to `play`. Answers how many sounded. */
    barks(list, ear, play) {
      if (!list.length) return 0;
      const kept = egBarkCull(list, ear);
      for (const b of kept) { try { play(b); } catch { /* never the fight */ } if (b.critical) mix.critical(); }
      return kept.length;
    },
    /** EG-ZD: A BEAT ON THE CRITICAL BUS - `S` its record, volume and pitch (ui/eliteGates/egBeats.js EG_BEAT_SOUNDS' shape), played as a
     *  one-shot (systems/audio.js playOneShot - the Hour's own way) and the score ducked under it. Never culled. Answers
     *  whether it was played. */
    beat(S) {
      if (!S || !Number.isInteger(S.rec)) return false;
      let played = false;
      try { if (audio?.playOneShot) { audio.playOneShot(S.rec, S.vol ?? 1, S.pitch ?? 1); played = true; } } catch { /* a sound is never the breach */ }
      mix.critical();
      return played;
    },
    /** A peer's sound's volume in the Spire. */
    peerVolume: (v) => v * egDbGain(EG_MIX.peerDb),
    /** EG-ZH: THE PEERS DOWN - while on, every peer's sound (net/peer/peerFx.js peerHeard) plays at `peerVolume` of itself through
     *  the engine's scope (systems/audio.js scaled); off, they are as they were. Idempotent; answers whether it is on. */
    peers(on) {
      const want = !!on;
      if (want === peersOn) return peersOn;
      peersOn = want;
      setPeerSoundScope(want ? (run) => (typeof audio?.scaled === 'function' ? audio.scaled(mix.peerVolume(1), run) : run()) : null);
      return peersOn;
    },
    /** EG-ZH: WATCHFIRE'S TELL - a told blow heard at `at` (the scene's frame), EG_TELL_CUE. Answers whether it sounded. */
    tell(at) {
      if (!at || !audio?.play3d) return false;
      tells++;
      try { audio.play3d(EG_TELL_CUE.clip, at, EG_TELL_CUE.volume, { maxDistance: EG_TELL_CUE.reach, distanceModel: 'linear', pitch: EG_TELL_CUE.pitch }); } catch { /* a sound is never the fight */ }
      return true;
    },
    /** What the mix has done (tests). */
    stats: () => ({ stings, ducks }),
    /** EG-ZH: the tells sounded and whether the peers are down (tests). */
    heard: () => ({ tells, peers: peersOn }),
  };
  return mix;
}
