// @ts-check
// THE NEW ERA IN THE STREAMING WORLD: world/newEraEvent.js's show heard, felt and drawn round the traveller. The host
// (scenes/world.js) wires it as it wires the Rocket: the hub's word (`set`), the exterior frame (`frame`: the line,
// the sounds, the shake and the white canvas) and the draw (`draw`, after the world's). Interiors, dungeons and the
// fixed city stand no show; the show keeps its place on the clock and the canvas hides itself. The shake is the
// camera's one shaker, under the player's own setting; the voice is the browser's speech at the game's Sound Volume.
// Not a DFU member.
import { audio as engine } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import { AMBIENT_SOUNDS } from '../systems/ambientEffects.js';
import { betterAmbience } from '../systems/betterAmbience.js';
import { getFloat } from '../systems/settings/settings.js';
import { currentLocale } from '../systems/textManager.js';
import { NewEraPassRenderer, newEraModel, newEraFrameOf } from '../render/newEraPass.js';
import { createNewEraCanvas } from '../ui/newEraCanvas.js';
import {
  createNewEra,
  newEraPlane,
  newEraDrops,
  newEraBombAt,
  newEraFlash,
  newEraShake,
  newEraCloud,
  newEraDome,
  newEraSkyCracks,
  newEraShards,
  newEraSpoken,
  newEraRumbleSamples,
  newEraBoomSamples,
  newEraEngineSamples,
  newEraWhistleSamples,
  newEraCrackSamples,
  newEraTearSamples,
  newEraDroneSamples,
  NEWERA_RATE,
  NEWERA_AT,
  NEWERA_PHASES,
  NEWERA_PLANE,
  NEWERA_NEIGHS,
  NEWERA_FALL_S,
  NEWERA_BOMB_SCALE,
  NEWERA_GLOW_S,
  NEWERA_GROUND,
  NEWERA_VOICE,
  NEWERA_SCREEN_CRACK,
} from '../world/newEraEvent.js';

/** The made sounds' keys in the audio engine (registerSamples), and what makes each. */
export const NEWERA_SOUNDS = Object.freeze({
  rumble: Object.freeze({ key: 'newera:rumble', make: newEraRumbleSamples }),
  boom: Object.freeze({ key: 'newera:boom', make: newEraBoomSamples }),
  engine: Object.freeze({ key: 'newera:engine', make: newEraEngineSamples }),
  whistle: Object.freeze({ key: 'newera:whistle', make: newEraWhistleSamples }),
  crack: Object.freeze({ key: 'newera:crack', make: newEraCrackSamples }),
  tear: Object.freeze({ key: 'newera:tear', make: newEraTearSamples }),
  drone: Object.freeze({ key: 'newera:drone', make: newEraDroneSamples }),
});
/** The engines' bed's name in the audio engine (setBed3d). */
export const NEWERA_ENGINE_BED = 'newera:engines';
/** How far out along its way a sky sound is placed, metres: it pans as the thing crosses, at full loudness. */
export const NEWERA_EAR_M = 50;
/** Seconds between the camera's kicks while it shakes. */
export const NEWERA_KICK_S = 0.2;
/** The seconds into the show the ground and the sky crack aloud. */
export const NEWERA_CRACKS_HEARD = Object.freeze([48, 50.5, 53, 55.5, 58]);
/** The most tears a second as the shards peel. */
export const NEWERA_TEARS_HZ = 4;
/** Seconds between the ground's grid being laid again under the cracks as the land streams in. */
export const NEWERA_REGROUND_S = 3;
/** The deep voice: its pitch and its pace (the speech engine's own scales: 0..2, 0.1..10). */
export const NEWERA_SPEECH = Object.freeze({ pitch: 0, rate: 0.62 });
/** A speech engine's voice names that read deep, the first one found is taken. */
const DEEP_VOICES = /male|daniel|david|fred|george|james|alex|ralph|bruce|arthur|aaron|guy/i;

/** The browser's speech voice for `lang` (the player's language: `pt-BR` takes any `pt` voice) that reads deepest, or
 *  null for the engine's own voice for that language. Pure. */
export function newEraVoiceOf(voices, lang = 'en') {
  const base = String(lang || 'en')
    .split('-')[0]
    .toLowerCase();
  const spoken = (voices ?? []).filter(
    (voice) =>
      String(voice?.lang ?? '')
        .split(/[-_]/)[0]
        .toLowerCase() === base,
  );
  return spoken.find((voice) => DEEP_VOICES.test(voice.name ?? '')) ?? spoken[0] ?? null;
}

/**
 * Say `text` in the deep voice: the browser's speech in the player's language, as low and slow as it goes, at the
 * game's Sound Volume. False where there is no speech. `opts` stand in for the browser's under a test.
 * @param {string} text
 * @param {{ speech?: any, Utterance?: any, volume?: number, lang?: string }} [opts]
 */
export function speakDeep(
  text,
  {
    speech = globalThis.speechSynthesis,
    Utterance = globalThis.SpeechSynthesisUtterance,
    volume = getFloat('Controls', 'SoundVolume', 0, 1),
    lang = currentLocale(),
  } = {},
) {
  if (!speech || typeof Utterance !== 'function' || !text) return false;
  try {
    const said = new Utterance(text);
    said.pitch = NEWERA_SPEECH.pitch;
    said.rate = NEWERA_SPEECH.rate;
    said.volume = Math.max(0, Math.min(1, Number(volume) || 0));
    said.lang = lang;
    const voice = newEraVoiceOf(speech.getVoices?.(), lang);
    if (voice) said.voice = voice;
    speech.speak(said);
    return true;
  } catch {
    return false;
  }
}

const unit = (vec) => {
  const len = Math.hypot(vec[0], vec[1], vec[2]) || 1;
  return [vec[0] / len, vec[1] / len, vec[2] / len];
};
const pick = ([from, to]) => from + (to - from) * Math.random();

/**
 * The New Era's host. `renderer` the frame's (its gl, its light and fog), `ground(x, z)` the height there (the host's
 * terrain, or the feet's where nothing is streamed), `state` the streaming world (worldCoords: where the scene's origin
 * stands in the world, so a pinned blast stays put through a recentre). `opts` stand in for the engine, the pass, the
 * canvas, the shaker and the voice under a test.
 * @param {any} renderer @param {((x: number, z: number) => number) | null} ground @param {any} state
 * @param {{ audio?: any, Pass?: any, Canvas?: any, shake?: (k: number) => void, speak?: (text: string) => boolean, speech?: any }} [opts]
 */
export function createNewEraHost(
  renderer,
  ground,
  state,
  {
    audio = engine,
    Pass = NewEraPassRenderer,
    Canvas = createNewEraCanvas,
    shake = (k) => betterAmbience.weaponKick(k),
    speak = speakDeep,
    speech = globalThis.speechSynthesis,
  } = {},
) {
  const era = createNewEra();
  /** @type {any} */
  let pass = null,
    canvas = null;
  let passTried = false;
  /** @type {any} */
  let shown = null;
  let showAt = NaN;
  let drops = [],
    sky = null,
    shards = [];
  /** @type {Map<number, { eye: number[], ground: number }>} */
  const pins = new Map();
  /** @type {null | { ref: number[], origin: number[] }} */
  let cracks = null;
  let grid = null,
    gridAt = null,
    gridAge = Infinity,
    gridDirty = false;
  /** @type {number | null} */
  let lastT = null;
  let kickIn = 0,
    tears = NEWERA_TEARS_HZ,
    bedOn = false;
  const stand = [0, 0, 0];
  const made = new Map();

  /** Where the scene's origin stands in the world, in metres (0, 0 with no streaming world). */
  const anchor = () => {
    const origin = state?.worldCoords?.([0, 0, 0]),
      step = state?.worldCoords?.([1, 0, 1]);
    if (!origin || !step) return [0, 0];
    const perX = step.x - origin.x || 1,
      perZ = step.z - origin.z || 1;
    return [origin.x / perX, origin.z / perZ];
  };
  const groundAt = (x, z) => {
    const height = ground?.(x, z);
    return Number.isFinite(height) ? height : stand[1];
  };
  const near = (dir) => [
    stand[0] + dir[0] * NEWERA_EAR_M,
    stand[1] + dir[1] * NEWERA_EAR_M,
    stand[2] + dir[2] * NEWERA_EAR_M,
  ];
  /** A made sound's key, registered the first time it is asked for (null until the engine's context stands). */
  const keyOf = (name) => {
    const sound = NEWERA_SOUNDS[name];
    try {
      if (!made.has(name)) made.set(name, sound.make());
      return audio?.registerSamples?.(sound.key, made.get(name), NEWERA_RATE) ? sound.key : null;
    } catch {
      return null;
    }
  };
  const play3d = (clip, pos, volume, pitch = 1) => {
    if (clip == null) return;
    try {
      audio?.play3d?.(clip, pos, volume, { refDistance: NEWERA_EAR_M, maxDistance: 2000, pitch });
    } catch {
      /* a sound never stops the show */
    }
  };
  const playFlat = (clip, volume, pitch = 1) => {
    if (clip == null) return;
    try {
      audio?.playOneShot?.(clip, volume, pitch);
    } catch {
      /* as above */
    }
  };
  const releaseBed = () => {
    if (!bedOn) return;
    bedOn = false;
    try {
      audio?.setBed3d?.(NEWERA_ENGINE_BED, null, stand);
    } catch {
      /* as above */
    }
  };

  /** A drop's pin: where the eye stood in the world when it was first seen, and its ground zero's height. */
  const pinOf = (drop) => {
    if (!pins.has(drop.index)) {
      const [originX, originZ] = anchor();
      const eye = [stand[0] + originX, stand[1], stand[2] + originZ];
      pins.set(drop.index, { eye, ground: groundAt(stand[0] + drop.to[0], stand[2] + drop.to[1]) });
    }
    return pins.get(drop.index);
  };
  /** A pinned drop's start, its ground zero, in the scene now. */
  const placesOf = (drop) => {
    const pin = pinOf(drop),
      [originX, originZ] = anchor();
    const eyeX = pin.eye[0] - originX,
      eyeZ = pin.eye[2] - originZ;
    return {
      start: [eyeX + drop.from[0], pin.eye[1] + drop.from[1], eyeZ + drop.from[2]],
      zero: [eyeX + drop.to[0], pin.ground, eyeZ + drop.to[1]],
    };
  };

  /** The grid the ground's cracks are cut from, laid round the traveller on the ground the host reads. */
  const layGrid = () => {
    const { reach, cells } = NEWERA_GROUND,
      step = (2 * reach) / cells;
    const left = stand[0] - reach,
      top = stand[2] - reach;
    const heights = new Float32Array((cells + 1) * (cells + 1));
    for (let j = 0; j <= cells; j++)
      for (let i = 0; i <= cells; i++) heights[j * (cells + 1) + i] = groundAt(left + i * step, top + j * step) + 0.25;
    const out = [];
    const corner = (i, j) => [left + i * step, heights[j * (cells + 1) + i], top + j * step];
    for (let j = 0; j < cells; j++)
      for (let i = 0; i < cells; i++) {
        const midX = left + (i + 0.5) * step - stand[0],
          midZ = top + (j + 0.5) * step - stand[2];
        if (Math.hypot(midX, midZ) > reach + step) continue;
        const c00 = corner(i, j),
          c10 = corner(i + 1, j),
          c01 = corner(i, j + 1),
          c11 = corner(i + 1, j + 1);
        out.push(...c00, ...c01, ...c11, ...c00, ...c11, ...c10);
      }
    grid = new Float32Array(out);
    gridAt = [stand[0], stand[2], ...anchor()];
    gridAge = 0;
    gridDirty = true;
  };

  /** The sounds and the kicks between the last frame's second and this one's. */
  const hear = (dt, sec, weight, plane) => {
    const crossed = (mark) => lastT !== null && lastT < mark && sec >= mark;
    const planeDir = unit(plane.pos);
    if (crossed(NEWERA_AT.crack)) playFlat(keyOf('rumble'), 1.4 * weight, 0.8);
    for (const mark of NEWERA_NEIGHS) if (crossed(mark)) play3d(SOUND.AnimalHorse, near(planeDir), 2 * weight, 0.5);
    for (const drop of drops) {
      if (crossed(drop.dropAt)) play3d(keyOf('whistle'), near(planeDir), 1.0 * weight);
      if (crossed(drop.boomAt)) {
        const way = unit([drop.to[0], 0.15 * drop.dist, drop.to[1]]);
        playFlat(keyOf('boom'), 1.6 * weight);
        play3d(AMBIENT_SOUNDS.storm[1], near(way), 1.4 * weight, 0.45);
        play3d(AMBIENT_SOUNDS.storm[2], near(way), 1.2 * weight, 0.5);
      }
    }
    for (const mark of NEWERA_CRACKS_HEARD)
      if (crossed(mark)) {
        const around = Math.random() * 2 * Math.PI;
        play3d(keyOf('crack'), near([Math.sin(around), -0.3, Math.cos(around)]), 1.2 * weight, pick([0.7, 1.2]));
      }
    if (crossed(NEWERA_SCREEN_CRACK.at)) playFlat(keyOf('crack'), 1.3 * weight, 1.3);
    tears = Math.min(NEWERA_TEARS_HZ, tears + dt * NEWERA_TEARS_HZ);
    const peelS = NEWERA_PHASES.find((row) => row.phase === 'peel')?.s ?? 16;
    for (const shard of shards)
      if (crossed(NEWERA_AT.peel + shard.start * peelS) && tears >= 1) {
        tears -= 1;
        playFlat(keyOf('tear'), 0.7 * weight, pick([0.8, 1.3]));
      }
    for (const row of NEWERA_VOICE)
      if (crossed(row.at)) {
        playFlat(keyOf('drone'), 1.3 * weight);
        speak(newEraSpoken(row.line()));
      }
    kickIn -= dt;
    if (kickIn <= 0) {
      kickIn = NEWERA_KICK_S;
      const magnitude = newEraShake(sec, drops) * weight;
      if (magnitude > 0.3) {
        try {
          shake(magnitude);
        } catch {
          /* no shaker */
        }
      }
    }
  };

  /** The engines' bed, at the gunship's way and as loud as it is near, while it flies. */
  const hum = (weight, plane, world) => {
    if (!plane.on || !world) {
      releaseBed();
      return;
    }
    const key = keyOf('engine');
    if (!key) return;
    const away = Math.hypot(...plane.pos);
    try {
      audio?.setBed3d?.(NEWERA_ENGINE_BED, key, near(unit(plane.pos)), {
        volume: 1.6 * weight * Math.min(1, 1400 / away),
        pitch: 1,
        refDistance: NEWERA_EAR_M,
        maxDistance: 2000,
      });
      bedOn = true;
    } catch {
      /* as above */
    }
  };

  /** The canvas over the picture: the flash, the screen's cracks, the peel, the white and the words. */
  const paint = (frame, weight) => {
    const caption = NEWERA_VOICE.map((row, i) => ({ text: row.line(), alpha: frame.caption[i] }));
    const wanted =
      newEraFlash(drops, frame.t) > 0.002 ||
      frame.screenCrack > 0 ||
      frame.peel > 0 ||
      frame.white > 0 ||
      caption.some((phrase) => phrase.alpha > 0);
    if (!canvas && !wanted) return;
    try {
      canvas ??= Canvas();
      canvas?.draw?.({
        weight,
        flash: newEraFlash(drops, frame.t),
        screenCrack: frame.screenCrack,
        peel: frame.peel,
        white: frame.white,
        caption,
        seed: Math.floor(showAt / 1000),
      });
    } catch {
      /* the canvas never stops the frame */
    }
  };

  return {
    /** The hub's word (the live events' door, net/online.js onEvent). */
    set(word, opts) {
      const was = era.on;
      era.set(word, opts);
      lastT = null;
      if (was && !era.on) {
        try {
          speech?.cancel?.();
        } catch {
          /* no speech */
        }
      }
    },
    /** The exterior frame: the weight walked, the line owed said (`talk.say`), the sounds heard, the camera kicked, and
     *  the canvas painted - round `at` (the traveller) at `sharedMs` on the shared clock. */
    frame(dt, sharedMs, at, talk) {
      const weight = era.tick(dt);
      const frame = era.frame(sharedMs);
      if (frame.line) talk?.say?.(frame.line);
      if (!(weight > 0) || !Array.isArray(at) || !at.every(Number.isFinite) || frame.done) {
        shown = null;
        lastT = null;
        releaseBed();
        canvas?.hide?.();
        return;
      }
      stand[0] = at[0];
      stand[1] = at[1];
      stand[2] = at[2];
      if (frame.at !== showAt) {
        showAt = frame.at;
        drops = newEraDrops(showAt);
        sky = newEraSkyCracks(showAt);
        shards = newEraShards(Math.floor(showAt / 1000));
        pins.clear();
        cracks = null;
        grid = null;
        lastT = null;
      }
      const sec = frame.t,
        step = Math.max(0, dt || 0);
      const plane = newEraPlane(sec, showAt);
      if (frame.cue === 'rumble') playFlat(keyOf('rumble'), 1.5 * weight);
      if (era.on) hear(step, sec, weight, plane);
      hum(weight, plane, frame.world);
      paint(frame, weight);
      lastT = era.on ? sec : null;
      if (!frame.world) {
        shown = null;
        return;
      }
      for (const drop of drops) if (sec >= drop.dropAt) pinOf(drop);
      if (frame.crack > 0) {
        const [originX, originZ] = anchor();
        cracks ??= { ref: [originX, originZ], origin: [stand[0] + originX, stand[2] + originZ] };
        gridAge += step;
        const moved = gridAt && Math.hypot(stand[0] - gridAt[0], stand[2] - gridAt[1]) > NEWERA_GROUND.regridM;
        const shifted = gridAt && (Math.abs(originX - gridAt[2]) > 0.5 || Math.abs(originZ - gridAt[3]) > 0.5);
        if (!grid || moved || shifted || gridAge > NEWERA_REGROUND_S) layGrid();
      }
      shown = { sec, weight, burn: frame.burn * weight, crack: frame.crack * weight, plane: plane.on ? plane : null };
    },
    /** The show, drawn after the world's (the Rocket's place), its sky round the camera's `eye`. True when it drew,
     *  the renderer told its programs moved. A failed build costs the show, never the frame. */
    draw(proj, view, eye) {
      if (!shown || !renderer?.gl) return false;
      if (!pass && !passTried) {
        passTried = true;
        try {
          pass = new Pass(renderer.gl);
        } catch (error) {
          console.warn('[newera] the pass could not be built', error);
          pass = null;
        }
      }
      if (!pass) return false;
      if (gridDirty && grid) {
        pass.setGround(grid);
        gridDirty = false;
      }
      const { sec, weight } = shown;
      const bombs = [],
        domes = [],
        puffs = [],
        glows = [];
      for (const drop of drops) {
        if (sec < drop.dropAt) continue;
        const { start, zero } = placesOf(drop);
        if (sec < drop.landAt) {
          const bomb = newEraBombAt(start, zero, (sec - drop.dropAt) / NEWERA_FALL_S);
          const axes = newEraFrameOf(bomb.dir);
          bombs.push(newEraModel(bomb.pos, axes.left, axes.up, axes.forward, NEWERA_BOMB_SCALE));
          continue;
        }
        const age = sec - drop.landAt;
        for (const puff of newEraCloud(age, drop.seed))
          puffs.push({
            at: [zero[0] + puff.at[0], zero[1] + puff.at[1], zero[2] + puff.at[2]],
            size: puff.size,
            heat: puff.heat,
            alpha: puff.alpha * weight,
            seed: (drop.seed % 1000) / 1000,
          });
        const dome = newEraDome(age, drop.dist);
        if (dome.alpha > 0) domes.push({ at: zero, radius: dome.radius, alpha: dome.alpha * weight });
        glows.push({
          dir: unit([zero[0] - eye[0], zero[1] + 300 - eye[1], zero[2] - eye[2]]),
          k: Math.exp(-age / NEWERA_GLOW_S) * weight,
        });
      }
      let planeModel = null;
      if (shown.plane) {
        const { pos, left, up, forward } = shown.plane;
        planeModel = newEraModel(
          [eye[0] + pos[0], eye[1] + pos[1], eye[2] + pos[2]],
          left,
          up,
          forward,
          NEWERA_PLANE.scale,
        );
      }
      const [originX, originZ] = anchor();
      const groundShow = cracks
        ? {
            crack: shown.crack,
            anchor: [originX - cracks.ref[0], originZ - cracks.ref[1]],
            origin: [cracks.origin[0] - originX, cracks.origin[1] - originZ],
            reach: NEWERA_GROUND.reach,
            cell: NEWERA_GROUND.cellM,
          }
        : null;
      const drawn = pass.draw(
        {
          burn: shown.burn,
          glows,
          sky: { crack: shown.crack, from: sky?.from ?? [], offset: sky?.offset ?? [0, 0, 0] },
          ground: groundShow,
          plane: planeModel,
          bombs,
          domes,
          puffs,
        },
        proj,
        view,
        new Float32Array(eye),
        sec,
        { dir: renderer._lightDir, ambient: renderer._ambient, sun: renderer._sunScale },
        {
          mode: renderer._fogMode,
          density: renderer._fogDensity,
          range: renderer._fogRange,
          color: renderer._fogColor,
          camPos: renderer._camPos,
          focus: renderer._focus,
          haze: renderer._haze,
        },
      );
      if (drawn) renderer.markForeignPass?.();
      return drawn > 0;
    },
    /** Whether the world's part of the show stands this frame. */
    showing() {
      return shown !== null;
    },
    get on() {
      return era.on;
    },
    /** EVERY ALLOCATION HAS AN OWNER: the pass, the canvas and the engines' bed. */
    dispose() {
      const built = pass;
      pass = null;
      passTried = false;
      built?.dispose();
      canvas?.dispose?.();
      canvas = null;
      releaseBed();
    },
  };
}
