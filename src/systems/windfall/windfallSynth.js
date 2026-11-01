// @ts-check
// OWN-WORK4 (2026-10-31, the owner: "A proper 1 to 1 recreation for everything"): WINDFALL'S SOUNDS, MADE HERE. The 27
// clips Windfall 1.0.0 plays keep its names, rates and lengths (systems/windfallEffects.js WINDFALL_CLIP_TABLE), and each
// is synthesized from seeded noise. Nothing of the mod's audio is read. A gust is noise through a band that rises with its
// swell. A passage is a slow breath of wind: a whistle in it, or a low open roar. A ruffle is a shower of short, bright
// grains, as dry leaves give. The seed is the clip's name, so a clip is the same on every boot. Pure.
import { section, mulberry32 } from '../soundscape/bedDsp.js';

const TAU = Math.PI * 2;
/** How many samples share one setting of the slow parts (the filters' bands, the swells). */
const BLOCK = 64;
/** The level each family is made at: a gust and a ruffle by their peak, a passage ("ultrasoft") by its RMS. */
export const WINDFALL_SYNTH_LEVEL = Object.freeze({
  gustPeak: 0.8,
  passageRms: 0.05,
  passagePeak: 0.45,
  rufflePeak: 0.6,
});

/** A clip's family, read off its name. */
export function windfallVoiceFamily(name) {
  if (/^wind_gust_/.test(name)) return 'gust';
  if (/^wind_blowing_/.test(name)) return 'blowing';
  if (/^whistling_wind_/.test(name)) return 'whistling';
  if (/^open_wind_/.test(name)) return 'open';
  if (/^leaf_ruffle_/.test(name)) return 'ruffle';
  return null;
}

/** A clip's seed: FNV-1a over its name. */
export function windfallVoiceSeed(name) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) hash = Math.imul(hash ^ name.charCodeAt(i), 0x01000193) >>> 0;
  return hash;
}

const smooth = (value) => {
  const clamped = value < 0 ? 0 : value > 1 ? 1 : value;
  return clamped * clamped * (3 - 2 * clamped);
};

/** A second-order filter that carries its state from sample to sample; its band may be moved between samples. */
class Section {
  constructor() {
    this.b0 = this.b1 = this.b2 = this.a1 = this.a2 = 0;
    this.in1 = this.in2 = this.out1 = this.out2 = 0;
  }
  set(type, centreHz, resonance, rate) {
    [this.b0, this.b1, this.b2, this.a1, this.a2] = section(type, centreHz, resonance, rate);
  }
  run(input) {
    const out = this.b0 * input + this.b1 * this.in1 + this.b2 * this.in2 - this.a1 * this.out1 - this.a2 * this.out2;
    this.in2 = this.in1;
    this.in1 = input;
    this.out2 = this.out1;
    this.out1 = out;
    return out;
  }
}
const filter = () => new Section();

/** A slow wobble: three sines at seeded rates and phases, about 1. */
function wobble(random, depth, lowHz, highHz) {
  const parts = [0.55, 0.3, 0.15].map((share) => ({
    share: share * depth,
    hz: lowHz + (highHz - lowHz) * random(),
    phase: TAU * random(),
  }));
  return (seconds) => {
    let sum = 1;
    for (const part of parts) sum += part.share * Math.sin(TAU * part.hz * seconds + part.phase);
    return sum;
  };
}

/** A gust: a swell that rises to its top a third of the way in and dies away, its band rising with it. */
function gustVoice(rate, count, random) {
  const top = 0.25 + 0.2 * random();
  const lowHz = 170 + 120 * random(),
    highHz = 650 + 600 * random();
  const flutter = wobble(random, 0.35, 1.2, 4.5);
  const band = filter(),
    body = filter(),
    roof = filter();
  body.set('lowpass', 260, Math.SQRT1_2, rate);
  let gain = 0;
  return (index) => {
    if (index % BLOCK === 0) {
      const at = index / (count - 1);
      const swell = at < top ? smooth(at / top) : 1 - smooth((at - top) / (1 - top));
      band.set('bandpass', lowHz + (highHz - lowHz) * swell, 0.9, rate);
      roof.set('lowpass', 700 + 1100 * swell, Math.SQRT1_2, rate);
      gain = swell ** 1.4 * Math.max(0, flutter(index / rate));
    }
    const noise = random() * 2 - 1;
    return roof.run(band.run(noise) + 0.55 * body.run(noise)) * gain;
  };
}

/** A passage's breath: in over its first seconds, out over its last, and two or three swells between. */
function passageBreath(random, rate, count) {
  const seconds = count / rate;
  const fadeIn = 2 + random(),
    fadeOut = 2.5 + 1.5 * random();
  const swells = wobble(random, 0.45, 0.05, 0.22);
  return (index) => {
    const at = index / rate;
    const edge = smooth(at / fadeIn) * smooth((seconds - at) / fadeOut);
    return edge * Math.max(0.2, swells(at));
  };
}

/** A passage: the broad wind (blowing), the same with a thin whistle gliding in it (whistling), or a deep roar (open). */
function passageVoice(family, rate, count, random) {
  const breath = passageBreath(random, rate, count);
  const centreHz = family === 'open' ? 150 + 60 * random() : 380 + 180 * random();
  const drift = wobble(random, 0.25, 0.04, 0.12);
  const whistleHz = 820 + 430 * random();
  const glide = wobble(random, 0.12, 0.08, 0.2);
  const whistleFrom = 0.2 + 0.15 * random(),
    whistleTo = 0.6 + 0.2 * random();
  const band = filter(),
    roof = filter(),
    deep = filter(),
    whistle = filter();
  roof.set('lowpass', family === 'open' ? 420 : 900, Math.SQRT1_2, rate);
  deep.set('lowpass', 380, Math.SQRT1_2, rate);
  let gain = 0,
    whistleGain = 0;
  return (index) => {
    if (index % BLOCK === 0) {
      const at = index / rate;
      band.set('bandpass', centreHz * drift(at), family === 'open' ? 0.7 : 0.55, rate);
      gain = breath(index);
      if (family === 'whistling') {
        whistle.set('bandpass', whistleHz * glide(at), 22, rate);
        const share = index / (count - 1);
        whistleGain = 4 * smooth((share - whistleFrom) / 0.12) * smooth((whistleTo - share) / 0.12);
      }
    }
    const noise = random() * 2 - 1;
    let out = roof.run(band.run(noise));
    if (family === 'open') out = deep.run(out) * 1.6 + 0.4 * out;
    if (family === 'whistling') out = 0.8 * out + whistleGain * whistle.run(noise);
    return out * gain;
  };
}

/** A ruffle: grains of bright noise, each a few milliseconds long, thickest at the swell's top, over a soft hiss. */
function ruffleVoice(rate, count, random) {
  const top = 0.2 + 0.15 * random();
  const grainsPerSecond = 260 + 160 * random();
  const brightHz = 3200 + 1300 * random();
  const crisp = filter(),
    bright = filter(),
    hiss = filter();
  crisp.set('highpass', 1500, Math.SQRT1_2, rate);
  bright.set('bandpass', brightHz, 0.7, rate);
  hiss.set('bandpass', 900, 0.6, rate);
  let swell = 0,
    grain = 0,
    fall = 1;
  return (index) => {
    if (index % BLOCK === 0) {
      const at = index / (count - 1);
      swell = at < top ? smooth(at / top) : 1 - smooth((at - top) / (1 - top));
    }
    if (random() < (grainsPerSecond * swell) / rate) {
      grain += 0.35 + 0.65 * random();
      fall = Math.exp(-1 / ((0.0006 + 0.0019 * random()) * rate));
    }
    grain *= fall;
    const noise = random() * 2 - 1;
    return bright.run(crisp.run(noise * grain)) + 0.12 * swell * hiss.run(noise);
  };
}

function voiceOf(family, rate, count, random) {
  if (family === 'gust') return gustVoice(rate, count, random);
  if (family === 'ruffle') return ruffleVoice(rate, count, random);
  return passageVoice(family, rate, count, random);
}

/** The scale that brings `samples` to its family's level. */
function levelOf(family, samples) {
  let peak = 0,
    sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const value = samples[i];
    peak = Math.max(peak, Math.abs(value));
    sum += value * value;
  }
  if (peak <= 0) return 0;
  const level = WINDFALL_SYNTH_LEVEL;
  if (family === 'gust') return level.gustPeak / peak;
  if (family === 'ruffle') return level.rufflePeak / peak;
  return Math.min(level.passageRms / Math.sqrt(sum / samples.length), level.passagePeak / peak);
}

/**
 * A clip made a piece at a time, so a long passage never holds one frame: `step(count)` makes the next `count` samples
 * and answers true once the clip is whole and levelled in `samples`. `clip` { name, rate, samples } (the table's row).
 */
export function windfallClipMaker(clip) {
  const family = windfallVoiceFamily(clip.name) ?? 'blowing';
  const count = Math.max(2, Math.floor(clip.samples));
  const samples = new Float32Array(count);
  const voice = voiceOf(family, clip.rate, count, mulberry32(windfallVoiceSeed(clip.name)));
  let made = 0;
  return {
    samples,
    family,
    step(budget = count) {
      if (made >= count) return true;
      const end = Math.min(count, made + Math.max(1, Math.floor(budget)));
      for (; made < end; made++) samples[made] = voice(made);
      if (made < count) return false;
      const scale = levelOf(family, samples);
      for (let i = 0; i < count; i++) samples[i] *= scale;
      return true;
    },
  };
}

/** A whole clip at once: mono floats at the row's rate, its row's length. */
export function windfallClipSamples(clip) {
  const maker = windfallClipMaker(clip);
  maker.step();
  return maker.samples;
}
