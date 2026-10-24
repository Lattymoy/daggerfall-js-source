// @ts-check
// ROCKET1 (2026-10-23): THE ROCKET IN THE STREAMING WORLD - world/rocketEvent.js's cycle, mounds, horses and farts,
// heard and drawn round the traveller. Design: bible/11-Multiplayer/Rocket-Event.md. The host (scenes/world.js) wires
// it in four lines, as the Starfall's (scenes/starfall/starfallHost.js): the hub's word (`set`, beside the dread's and
// the sun baby's), the exterior frame (`frame`: the weight, the line owed, the sounds), and the draw (`draw`, after the
// world's, the same eye and fog as the Starfall's sky).
//
// THE FOUR HOSTS (Home.md 17e): scenes/world.js wires it, and the three others stand no show by design, as the dread
// and the sun baby stand none there: scenes/exterior.js (the fixed city) holds no hub link, so no live event reaches it;
// scenes/worldModes.js (interiors) and scenes/dungeonContext.js (dungeons) have no sky and no ground of the world's
// under a roof - their frames return before the exterior's, and the show keeps its place on the shared clock.
//
// Not a DFU member. Ledger A (ROCKET).
import { audio as engine } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import { RocketPassRenderer } from '../render/rocketPass.js';
import {
  createRocket, rocketMounds, rocketFlights, rocketSky, rocketSounds, rocketJetScale, rocketFartSamples,
  ROCKET_FART_RATE, ROCKET_FART_VARIANTS, ROCKET_JET_CHUNKS, ROCKET_MOUND_CELL_M, ROCKET_RAIN_N, ROCKET_RAIN_SPEED,
} from '../world/rocketEvent.js';

/** The made farts' keys in the audio engine (registerSamples), one a variant. */
export const ROCKET_FART_KEYS = Object.freeze(ROCKET_FART_VARIANTS.map((_, i) => `rocket:fart${i}`));
/** Seconds between the mounds' asking the ground again (the land streams in under them). */
export const ROCKET_REGROUND_S = 2;
/** The most farts the sky is heard to make in a second - the frenzy's herd would make a dozen. */
export const ROCKET_FARTS_HZ = 8;
/** Seconds between a mound's splash near the traveller while the jets are up, and in the frenzy; how near (metres). */
export const ROCKET_SPLASH_EVERY_S = Object.freeze([0.6, 0.25]);
export const ROCKET_SPLASH_NEAR_M = 45;
/** How far out along its way a horse's sound is placed, metres - it pans as it crosses, at full loudness. */
export const ROCKET_SKY_EAR_M = 50;

/** Each kind of horse's voice: its neigh's pitch range and loudness, its farts' pitch range, loudness and variant. */
const VOICE = Object.freeze({
  great: Object.freeze({ neigh: [0.78, 0.82], nv: 1.8, fart: [0.55, 0.7], fv: 1.6, kind: 1 }),
  foal: Object.freeze({ neigh: [1.5, 1.9], nv: 1.1, fart: [1.4, 2.0], fv: 1.0, kind: 0 }),
  herd: Object.freeze({ neigh: [0.85, 1.8], nv: 0.9, fart: [0.7, 1.9], fv: 0.65, kind: 2 }),
});

/**
 * The Rocket's host. `renderer` the frame's (its gl, its light and fog), `ground(x, z)` the height there (the host's
 * terrain, or the feet's where nothing is streamed), `state` the streaming world (worldCoords - where the scene's origin
 * stands in the world, so the mounds stay put through a recentre). `opts.audio` / `opts.Pass` stand in for the engine's
 * and the pass's under a test.
 * @param {any} renderer @param {((x: number, z: number) => number) | null} ground @param {any} state
 * @param {{ audio?: any, Pass?: any }} [opts] the engine (systems/audio.js) and the pass, as a test stands them in
 */
export function createRocketHost(renderer, ground, state, { audio = engine, Pass = RocketPassRenderer } = {}) {
  const rocket = createRocket();
  /** @type {any} */
  let pass = null;
  let passTried = false;
  /** @type {null | {t: number, cycle: number, rise: number, jet: number, frenzy: number, since: number}} */
  let shown = null;   // this frame's show, null while there is none
  let flights = [], flightKey = '';
  let mounds = [], moundKey = '', moundAge = Infinity, moundsDirty = false;
  /** @type {number | null} */
  let lastT = null;   // the cycle's second last framed - the sounds between it and this frame's are heard
  let fartBudget = ROCKET_FARTS_HZ, splashIn = 0;
  const stand = [0, 0, 0];

  /** Where the scene's origin stands in the world, in metres (0, 0 with no streaming world). */
  const anchor = () => {
    const o = state?.worldCoords?.([0, 0, 0]), u = state?.worldCoords?.([1, 0, 1]);
    if (!o || !u) return [0, 0];
    const ux = u.x - o.x || 1, uz = u.z - o.z || 1;
    return [o.x / ux, o.z / uz];
  };
  const groundAt = (x, z) => { const h = ground?.(x, z); return Number.isFinite(h) ? h : stand[1]; };

  /** The mounds round the traveller, asked again when they cross a cell, the origin moves, or the land may have. */
  const placeMounds = (dt) => {
    const [ox, oz] = anchor(), ax = stand[0] + ox, az = stand[2] + oz;
    const key = `${Math.floor(ax / ROCKET_MOUND_CELL_M)},${Math.floor(az / ROCKET_MOUND_CELL_M)},${Math.round(ox)},${Math.round(oz)}`;
    moundAge += dt;
    if (key === moundKey && moundAge < ROCKET_REGROUND_S) return;
    moundKey = key; moundAge = 0;
    mounds = rocketMounds(ax, az).map((m) => { const x = m.x - ox, z = m.z - oz; return { ...m, x, z, y: groundAt(x, z) }; });
    moundsDirty = true;
  };

  const made = [];   // the made farts' samples, a variant once - handed again until the engine's context stands
  const fart = (v, pos, volume, pitch) => {
    const key = ROCKET_FART_KEYS[v];
    try {
      if (!audio?.registerSamples?.(key, made[v] ??= rocketFartSamples(v), ROCKET_FART_RATE)) return;
      audio.play3d?.(key, pos, volume, { refDistance: ROCKET_SKY_EAR_M, maxDistance: 2000, pitch });
    } catch { /* a sound never stops the show */ }
  };
  const near = (d) => [stand[0] + d[0] * ROCKET_SKY_EAR_M, stand[1] + d[1] * ROCKET_SKY_EAR_M, stand[2] + d[2] * ROCKET_SKY_EAR_M];
  const pick = ([a, b]) => a + (b - a) * Math.random();

  /** The sky's farts and neighs since the last frame, and a mound's splash near the traveller now and then. */
  const hear = (dt, t) => {
    fartBudget = Math.min(ROCKET_FARTS_HZ, fartBudget + dt * ROCKET_FARTS_HZ);
    if (lastT !== null && t > lastT) {
      for (const s of rocketSounds(flights, lastT, t)) {
        const v = VOICE[s.who] ?? VOICE.herd;
        if (s.kind === 'neigh') { try { audio?.play3d?.(SOUND.AnimalHorse, near(s.dir), v.nv, { refDistance: ROCKET_SKY_EAR_M, maxDistance: 2000, pitch: pick(v.neigh) }); } catch { /* as above */ } }
        else if (fartBudget >= 1 || s.who !== 'herd') { fartBudget -= 1; fart(v.kind, near(s.dir), v.fv, pick(v.fart)); }
      }
    }
    if (!shown || shown.jet < 0.2 || !mounds.length) return;
    splashIn -= dt;
    if (splashIn > 0) return;
    splashIn = shown.frenzy > 0.5 ? ROCKET_SPLASH_EVERY_S[1] : ROCKET_SPLASH_EVERY_S[0];
    const close = mounds.filter((m) => Math.hypot(m.x - stand[0], m.z - stand[2]) < ROCKET_SPLASH_NEAR_M);
    if (!close.length) return;
    const m = close[Math.floor(Math.random() * close.length)], at = [m.x, m.y + m.h, m.z];
    try { audio?.play3d?.(SOUND.SplashLarge, at, 1.1, { refDistance: 6, maxDistance: 90, pitch: pick([0.45, 0.65]) }); } catch { /* as above */ }
    if (Math.random() < 0.5) fart(2, at, 0.8, pick([0.8, 1.3]));
  };

  return {
    /** The hub's word (the dread's and the sun baby's door, net/online.js onEvent). */
    set(ev, o) { rocket.set(ev, o); lastT = null; },
    /** The exterior frame: the weight walked, the line owed said (`talk.say`), the mounds placed round `at` (the
     *  traveller), the sounds heard - at `sharedMs` on the shared clock. */
    frame(dt, sharedMs, at, talk) {
      const w = rocket.tick(dt);
      const f = rocket.frame(sharedMs);
      if (f.line) talk?.say?.(f.line);
      if (!(w > 0) || !Array.isArray(at) || !at.every(Number.isFinite)) { shown = null; lastT = null; return; }
      stand[0] = at[0]; stand[1] = at[1]; stand[2] = at[2];
      const key = `${f.at}:${f.cycle}`;
      if (key !== flightKey) { flightKey = key; flights = rocketFlights(f.at, f.cycle); lastT = null; }
      shown = { t: f.t, cycle: f.cycle, rise: f.rise * w, jet: rocketJetScale(f.jet, f.frenzy) * w, frenzy: f.frenzy * w, since: Math.max(0, (sharedMs - f.at) / 1000) };
      placeMounds(Math.max(0, dt || 0));
      if (f.cue === 'rise' || f.cue === 'frenzy') fart(1, [stand[0], stand[1] - 2, stand[2]], f.cue === 'rise' ? 1.4 : 2.2, f.cue === 'rise' ? 0.5 : 0.35);   // the earth's own rumble, and the frenzy's
      if (rocket.on) hear(Math.max(0, dt || 0), f.t);
      lastT = rocket.on ? f.t : null;
    },
    /** The show, drawn after the world's (the Starfall's sky's place) - its sky round the camera's `eye`. True when it
     *  drew, the renderer told its programs moved. A failed build costs the show, never the frame. */
    draw(proj, view, eye) {
      if (!shown || !renderer?.gl) return false;
      if (!pass && !passTried) {
        passTried = true;
        try { pass = new Pass(renderer.gl); pass.setRain(ROCKET_RAIN_N, ROCKET_RAIN_SPEED); moundsDirty = true; } catch (e) { console.warn('[rocket] the pass could not be built', e); pass = null; }
      }
      if (!pass) return false;
      if (moundsDirty) { pass.setMounds(mounds, ROCKET_JET_CHUNKS); moundsDirty = false; }
      const E = new Float32Array(eye), sky = rocketSky(flights, shown.t, E);
      const n = pass.draw({ ...shown, horses: sky.horses, puffs: sky.puffs }, proj, view, E, shown.since,
        { dir: renderer._lightDir, ambient: renderer._ambient, sun: renderer._sunScale },
        { mode: renderer._fogMode, density: renderer._fogDensity, range: renderer._fogRange, color: renderer._fogColor, camPos: renderer._camPos, focus: renderer._focus, haze: renderer._haze });
      if (n) renderer.markForeignPass?.();
      return n > 0;
    },
    /** Whether there is a show this frame. */
    showing() { return shown !== null; },
    get on() { return rocket.on; },
    /** EVERY ALLOCATION HAS AN OWNER: the pass. */
    dispose() { const p = pass; pass = null; passTried = false; p?.dispose(); },
  };
}
