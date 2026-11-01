// @ts-check
// OWN-WORK4 (2026-10-31): THE TWO SOUND MODS' CLIPS, OURS. Immersive Footsteps 1.01 asks for 105 clips by name in each of
// two qualities and Better Ambience 0.1.4 for 29; each name here answers with a clip our synth makes (steps.js, rain.js)
// - the same name, the same length, the same rate as the clip it stands for, and nothing of that clip but its name and
// its length. The two mods' laws (systems/immersiveFootsteps.js, systems/betterAmbience.js) are unchanged.
import { inTurn, mulberry32, seedOf } from './dsp.js';
import { stepSound } from './steps.js';
import { rainEaves, rainLoop, rainLoopInTurns, RAIN_EAVES, RAIN_LOOP } from './rain.js';

/** @typedef {{ samples: Float32Array, rate: number }} Clip */

/** An Immersive Footsteps clip, made in its turn (dsp.js inTurn): one a task. @param {string} name */
export const immersiveFootstepsClipInTurn = (name) => inTurn(() => immersiveFootstepsClip(name));

/** Immersive Footsteps' two qualities: High at 44.1 kHz, Low (Retro) at 22.05 kHz and 8 bits (steps.js RETRO). */
export const IF_RATE = Object.freeze({ HQ: 44100, LQ: 22050 });
/** Each clip's length in ms, as the mod's own clips run - set by set, clips 1 to 6 (a sway 1-4, a landing 1-2). */
export const IF_CLIP_MS = Object.freeze({
  Chainmail_Footstep: [496, 444, 522, 366, 366, 340],
  Chainmail_Hard_Landing: [784, 784],
  Chainmail_Swaying: [653, 470, 601, 549],
  Deep_Water_Footstep: [496, 444, 522, 496, 522, 549],
  Grass_Footstep: [470, 470, 522, 549, 522, 549],
  Gravel_Footstep: [366, 313, 392, 444, 392, 340],
  Leather_Footstep: [496, 392, 418, 418, 418, 470],
  Leather_Hard_Landing: [418, 601],
  Leather_Swaying: [549, 418, 444, 470],
  Mud_Footstep: [418, 418, 418, 496, 366, 522],
  Path_Footstep: [313, 313, 340, 235, 340, 313],
  Plate_Footstep: [470, 496, 470, 418, 470, 392],
  Plate_Hard_Landing: [575, 601],
  Plate_Swaying: [261, 418, 340, 366],
  Sand_Footstep: [522, 418, 392, 705, 496, 470],
  Shallow_Water_Footstep: [313, 235, 366, 366, 366, 366],
  Snow_Footstep: [496, 418, 470, 418, 522, 549],
  Tile_Footstep: [261, 261, 209, 183, 287, 313],
  Unarmored_Footstep: [470, 418, 522, 392, 444, 470],
  Unarmored_Hard_Landing: [496, 601],
  Water_Landing: [914],
  Wood_Footstep: [313, 340, 261, 287, 340, 366],
});
/** The family each footstep set is made of. */
const IF_STEP_FAMILY = Object.freeze({
  Chainmail: 'chainmail',
  Leather: 'leather',
  Plate: 'plate',
  Unarmored: 'unarmored',
  Deep_Water: 'deepWater',
  Grass: 'grass',
  Gravel: 'gravel',
  Mud: 'mud',
  Path: 'path',
  Sand: 'sand',
  Shallow_Water: 'shallowWater',
  Snow: 'snow',
  Tile: 'tile',
  Wood: 'wood',
});
const IF_SWAY_FAMILY = Object.freeze({ Chainmail: 'swayChain', Leather: 'swayLeather', Plate: 'swayPlate' });

/** How loud each kind is made (dsp.js loudnessOf, dB). The mod plays a step and a sway at 1 and a landing at 4 (12 dB
 *  up, LANDING_VOLUME_SCALE), so a step sits at the top of Daggerfall's own stride (DAGGER.SND 309-334 heard at 0.7:
 *  -32.5 to -39.8), a landing near its falls (91 and 92: -12.4 and -19.4) and the sways under the steps. */
export const IF_LOUDNESS = Object.freeze({
  step: -32,
  wade: -30,
  swim: -24,
  sway: -38,
  landing: -33,
  hurtLanding: -28,
  waterLanding: -30,
});
/** Each clip's own level, up to this many dB either side of its kind's, from its seed: no two steps of a set are
 *  struck alike. */
export const LEVEL_SPREAD_DB = 1.5;
const spread = (/** @type {number} */ seed) => (mulberry32(seed ^ 0x5bd1e995)() * 2 - 1) * LEVEL_SPREAD_DB;

/** Which of IF_LOUDNESS a clip takes. @param {string} stem @param {number} n */
function ifLoudnessKind(stem, n) {
  if (stem === 'Water_Landing') return 'waterLanding';
  if (stem.endsWith('_Hard_Landing')) return n === 2 ? 'hurtLanding' : 'landing';
  if (stem.endsWith('_Swaying')) return 'sway';
  return stem === 'Deep_Water_Footstep' ? 'swim' : stem === 'Shallow_Water_Footstep' ? 'wade' : 'step';
}

/** What an Immersive Footsteps name is made of, or null for a name the mod never asks for. @param {string} name */
export function immersiveFootstepsRecipe(name) {
  const match = /^(HQ|LQ)_(.+)_(\d)$/.exec(String(name));
  if (!match) return null;
  const [, quality, stem, digit] = match;
  const n = Number(digit);
  const lengthMs = /** @type {Record<string, number[]>} */ (IF_CLIP_MS)[stem]?.[n - 1];
  if (!lengthMs) return null;
  let family = null,
    heavy = false;
  const step = /^(.+)_Footstep$/.exec(stem),
    sway = /^(.+)_Swaying$/.exec(stem),
    land = /^(.+)_Hard_Landing$/.exec(stem);
  if (step) family = /** @type {Record<string, string>} */ (IF_STEP_FAMILY)[step[1]];
  else if (sway) family = /** @type {Record<string, string>} */ (IF_SWAY_FAMILY)[sway[1]];
  else if (land) [family, heavy] = [`landing:${land[1]}`, n === 2]; // [1] is the fall that hurt (CheckToUseHardFallSounds)
  else if (stem === 'Water_Landing') family = 'waterLanding';
  if (!family) return null;
  const seed = seedOf(`if:${stem}_${n}`);
  return {
    family,
    heavy,
    seconds: lengthMs / 1000,
    rate: quality === 'HQ' ? IF_RATE.HQ : IF_RATE.LQ,
    retro: quality === 'LQ',
    seed,
    loudness: IF_LOUDNESS[ifLoudnessKind(stem, n)] + spread(seed),
  };
}

/** An Immersive Footsteps clip by the name LoadAudio asks for; null for one it never asks for. @param {string} name @returns {Clip | null} */
export function immersiveFootstepsClip(name) {
  const recipe = immersiveFootstepsRecipe(name);
  return recipe ? { samples: stepSound(recipe.family, recipe), rate: recipe.rate } : null;
}

/** Better Ambience's lists: each stem's family, its rate, its clips' lengths in ms (`_000` on) and its loudness (dsp.js
 *  loudnessOf). The water list's `_001` never was (the mod's list plays five), so it is no clip here either. Each list
 *  plays at its own volume times 0.7 (LIST_VOLUME, BA_FOOTSTEP_VOLUME_SCALE), which brings a step to -33, the water to
 *  -30 and the armour's clank to -38, under the step it rides on. */
export const BA_CLIPS = Object.freeze({
  sfx_footstep_wood: Object.freeze({ family: 'wood', rate: 44100, ms: [321, 436, 475, 377], loudness: -21.9 }),
  sfx_footstep_stone: Object.freeze({ family: 'stone', rate: 44100, ms: [145, 174, 184, 188], loudness: -19.4 }),
  sfx_footstep_armor_light: Object.freeze({
    family: 'armorLight',
    rate: 44100,
    ms: [771, 397, 406, 406, 519, 452, 474, 504, 467, 704, 489],
    loudness: -26.9,
  }),
  'sfx_footstep_crunchy-grass': Object.freeze({
    family: 'crunchyGrass',
    rate: 44100,
    ms: [740, 777, 685, 606],
    loudness: -13.4,
  }),
  sfx_footstep_water: Object.freeze({ family: 'wade', rate: 22050, ms: [963, null, 1068, 1253, 836, 1172], loudness: -18.9 }),
});
export const BA_RAIN_CLIP = 'AmbientRaining';
/** The rain loop's layers (rain.js RAIN_EAVES): the mod's clip and the eaves' drips, ours, played together. */
export const BA_RAIN_LAYERS = Object.freeze([BA_RAIN_CLIP, `${BA_RAIN_CLIP}/eaves`]);

/** A Better Ambience clip by the name TryImportAudioClips asks for; null for a miss. @param {string} name @returns {Clip | null} */
export function betterAmbienceClip(name) {
  if (name === BA_RAIN_CLIP) return { samples: rainLoop(), rate: RAIN_LOOP.rate };
  if (name === BA_RAIN_LAYERS[1]) return { samples: rainEaves(), rate: RAIN_EAVES.rate };
  const match = /^(.+)_(\d{3})$/.exec(String(name));
  const list = match
    ? /** @type {Record<string, { family: string, rate: number, ms: (number | null)[], loudness: number }>} */ (BA_CLIPS)[
        match[1]
      ]
    : null;
  const lengthMs = list?.ms[Number(match?.[2])];
  if (!list || !lengthMs) return null;
  const rate = list.rate;
  const seed = seedOf(`ba:${name}`);
  const samples = stepSound(list.family, { seed, seconds: lengthMs / 1000, rate, loudness: list.loudness + spread(seed) });
  return { samples, rate };
}

/** A Better Ambience clip, made in its turn: one a task, the rain loop a step a task (rain.js rainLoopInTurns).
 *  @param {string} name @returns {Promise<Clip | null>} */
export async function betterAmbienceClipInTurn(name) {
  if (name === BA_RAIN_CLIP) return { samples: await rainLoopInTurns(), rate: RAIN_LOOP.rate };
  return inTurn(() => betterAmbienceClip(name));
}
