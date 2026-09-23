// @ts-check
// WEATHER3 slice D (2026-09-22, the world weather map's storms at a
// distance): A THUNDERSTORM ON THE HORIZON FLASHES ITS OWN CLOUD, AND
// ITS THUNDER ARRIVES LATE AND QUIET.
//
// The storm overhead is DFU's own: LightningPlayer's strobe and the
// ambience's thunder one-shots, on the worn word (world/weather.js,
// systems/ambientEffects.js). Every OTHER thunderstorm the world weather
// map stands near the player (systems/weatherMap.js) was dark and silent
// - a tower on the ridge that never lit. Now each strikes on its own
// schedule: seeded by the storm and the game minute, so every client
// under the shared clock sees the same strikes, and a storm at the height
// of its life strikes more often than one being born or dying. A strike
// lights the cloud in the storm's direction (the clouds' composite, one
// bolt at a time - the march writes a stripe a frame and a flash cannot
// ride it), and its thunder is heard DISTANCE / THE SPEED OF SOUND later
// - a storm ten kilometres off, half a minute after its flash - softer
// the further off, a crack near and a roll far, and not at all past
// THUNDER_AUDIBLE_M.
//
// PURE but for the small scheduler the hosts keep: the strikes are a
// function of the storm and the minute; the queue of thunder not yet
// heard is the only state.

import { seededRng } from './wind.js';
import { AMBIENT_SOUNDS } from './ambientEffects.js';
import { envelope, SYSTEM_TYPES } from './weatherMap.js';

/** Metres a second - thunder's pace through the air. */
export const SPEED_OF_SOUND = 343;
/** Past this a storm is seen and not heard. */
export const THUNDER_AUDIBLE_M = 25000;
/** Nearer than this, the crack; further, the roll. */
export const THUNDER_CRACK_M = 4000;
/** A storm at the height of its life strikes this often, per game minute -
 *  about twice a real minute at the default TimeScale of 12 (a game minute
 *  is five real seconds), so a horizon with a few storms on it flickers
 *  now and then rather than strobing. */
export const STRIKES_PER_MINUTE = 0.15;
/** Real seconds a strike's light stays on the cloud, falling away. */
export const BOLT_SECONDS = 0.35;
/** Thunder due longer ago than this when a frame next runs was not heard. */
export const THUNDER_LATE_SECONDS = 1;
/** A jump in the game clock longer than this plays no backlog of strikes. */
export const STRIKE_BACKLOG_MINUTES = 5;
const [, CLIP_THUNDER, CLIP_ROLL] = AMBIENT_SOUNDS.storm;   // LightningThunder, ThunderRoll (SoundClips)

/** A string's hash for the seed (the storm's id is its lattice address). */
function hashId(id) {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/**
 * The strikes a thunderstorm throws in (m0, m1] game minutes: each whole
 * minute draws a Poisson count at STRIKES_PER_MINUTE x its envelope then,
 * placed within the minute, from a generator keyed on the storm and the
 * minute - the same strikes whenever and whoever asks. `envAt(minute)` is
 * the storm's envelope at that minute. Answers the strikes' minutes, in
 * order.
 */
export function strikesIn(id, m0, m1, envAt) {
  const out = [];
  if (!(m1 > m0)) return out;
  const seed = hashId(id);
  for (let k = Math.floor(m0); k <= Math.floor(m1); k++) {
    const r = seededRng((seed ^ Math.imul(k, 0x9e3779b1)) >>> 0);
    const lambda = STRIKES_PER_MINUTE * Math.max(0, envAt(k + 0.5));
    let n = 0;
    for (let p = r(), limit = Math.exp(-lambda); p > limit; p *= r()) n++;
    const at = Array.from({ length: n }, () => k + r()).sort((a, b) => a - b);
    for (const t of at) if (t > m0 && t <= m1) out.push(t);
  }
  return out;
}

/** The thunder of a strike `distance` metres off: when it is heard (real
 *  seconds after the flash), how loud (0..1), and which clip - or null
 *  past hearing. */
export function thunderOf(distance) {
  const d = Math.max(0, distance);
  if (d >= THUNDER_AUDIBLE_M) return null;
  const v = 1 - d / THUNDER_AUDIBLE_M;
  return { delay: d / SPEED_OF_SOUND, volume: v * v, clip: d < THUNDER_CRACK_M ? CLIP_THUNDER : CLIP_ROLL };
}

/** Where a distant storm's thunder is played from: THUNDER_SOURCE_M out
 *  from the camera toward the storm (host metres, `cam` [x, y, z], the
 *  storm at (x, z)), a little above it - so it comes from the storm's
 *  side at the volume `thunderOf` gave it (the one-shot's reference
 *  distance is this). Pure. */
export const THUNDER_SOURCE_M = 13;
export function thunderSourceAt(cam, x, z) {
  const dx = x - cam[0], dz = z - cam[2], l = Math.hypot(dx, dz) || 1;
  return [cam[0] + (dx / l) * THUNDER_SOURCE_M, cam[1] + 6, cam[2] + (dz / l) * THUNDER_SOURCE_M];
}

/**
 * The hosts' scheduler. `tick({ systems, at, minutes, seconds })` once an
 * exterior frame: `systems` the map's systems near the player this minute
 * (weatherSim currentMapSystems), `at` the player in field metres,
 * `minutes` the fractional game clock, `seconds` real seconds, `ground`
 * the map's ground law (weatherSim mapGround) - a storm over snow ground
 * is a snow squall and strikes nothing. Answers
 * `{ bolt, sounds }`: the strike lighting a cloud now (`{ x, z, r,
 * strength }` in field metres, or null) and the thunder due this frame
 * (`[{ clip, volume, x, z }]`, the strike's place). A thunderstorm the
 * player stands under the core of is DFU's, not this: the strobe and the
 * ambience have it.
 */
export function createDistantStorms() {
  let last = null;
  let bolt = null;       // { x, z, r, strength, at } - the latest strike's light
  const heard = [];      // thunder on its way: { due, clip, volume, x, z }
  return {
    tick({ systems = [], at, minutes, seconds, ground = null }) {
      if (last === null || minutes < last || minutes - last > STRIKE_BACKLOG_MINUTES) last = minutes;   // a boot, a load, a rest: no backlog
      for (const s of systems) {
        if (s.type !== 'thunder') continue;
        if (ground && ground('thunder', s.x, s.z, minutes) !== 'thunder') continue;   // AUDIT WEATHER3 R1: over a snow ground the storm is a snow squall (the sky's cell says so) - no lightning, no thunder
        const d = Math.hypot(s.x - at[0], s.z - at[1]);
        if (d < s.bands[0][0]) continue;   // under its heart: DFU's own storm
        const envAt = (m) => envelope(SYSTEM_TYPES.thunder, (m - s.bornAt) / s.life);   // weatherMap's own envelope, at the strike's minute
        for (const t of strikesIn(s.id, last, minutes, envAt)) {
          bolt = { x: s.x, z: s.z, r: s.bands[0][0], strength: envAt(t), at: seconds };
          const th = thunderOf(d);
          if (th) heard.push({ due: seconds + th.delay, clip: th.clip, volume: th.volume * envAt(t), x: s.x, z: s.z });
        }
      }
      last = minutes;
      const sounds = [];
      // due now is heard; due long ago was not - the frames stopped (a building, a window, a pause) and the thunder
      // passed unheard, so it is dropped rather than played in one burst on the first frame back (AUDIT WEATHER3 R5)
      for (let i = heard.length - 1; i >= 0; i--) {
        if (heard[i].due > seconds) continue;
        const [h] = heard.splice(i, 1);
        if (seconds - h.due <= THUNDER_LATE_SECONDS) sounds.push(h);
      }
      sounds.reverse();
      const age = bolt ? seconds - bolt.at : Infinity;
      const lit = age >= 0 && age < BOLT_SECONDS ? { x: bolt.x, z: bolt.z, r: bolt.r, strength: bolt.strength * (1 - age / BOLT_SECONDS) } : null;
      return { bolt: lit, sounds: sounds.map(({ clip, volume, x, z }) => ({ clip, volume, x, z })) };
    },
    /** The thunder still on its way (tests, and a scene's teardown). */
    pending() { return heard.length; },
    /** A jump (a load, a travel landing): the storms heard are the old place's. */
    reset() { last = null; bolt = null; heard.length = 0; },
  };
}
