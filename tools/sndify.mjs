// THE DAGGERFALL BAKE: any sound, in the game's own format.
//
// DAGGER.SND holds every classic effect as RAW UNSIGNED 8-BIT MONO PCM
// AT 11025 Hz - src/formats/sndFile.js:3 states it, SndFile.cs is where
// it came from, and that is the whole of the "Daggerfall aesthetic" as
// far as a sound file is concerned. A 48kHz 16-bit stereo shotgun
// dropped into this game does not sound like this game; the same
// recording through this pipe does.
//
// So: decode, mix to mono, filter, decimate to 11025, quantise to
// 8-bit. The quantisation noise is not a defect to dither away - it is
// the texture every classic effect has, and a dithered bake sounds
// cleaner AND more wrong.
//
//     node tools/sndify.mjs in.wav out.wav [--gain=1] [--peak=0.89]
//                                        [--max=0] [--no-trim]
//
// WAV in, WAV out, no dependencies. For an mp3 or ogg (what a
// Freesound preview is), convert it first - `ffmpeg -i in.mp3 in.wav` -
// because a pure-JS mp3 decoder is a lot of code to carry for a step
// every machine already has a tool for.

import { readFileSync, writeFileSync } from 'node:fs';
import { isMain } from './lib/isMain.mjs';

export const DF_RATE = 11025;   // SndFile.cs / sndFile.js SAMPLE_RATE

/** RIFF/WAVE reader: PCM 8/16/24/32-bit and 32-bit float, any channel
 *  count, any rate. Answers { rate, channels, data: Float32Array[] }. */
export function readWav(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (o) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('not a RIFF/WAVE file');
  let fmt = null, dataAt = -1, dataLen = 0;
  for (let p = 12; p + 8 <= bytes.length;) {
    const id = tag(p), size = dv.getUint32(p + 4, true);
    if (id === 'fmt ') {
      fmt = {
        format: dv.getUint16(p + 8, true),
        channels: dv.getUint16(p + 10, true),
        rate: dv.getUint32(p + 12, true),
        bits: dv.getUint16(p + 22, true),
      };
    } else if (id === 'data') { dataAt = p + 8; dataLen = size; }
    p += 8 + size + (size & 1);   // chunks are word aligned
  }
  if (!fmt || dataAt < 0) throw new Error('WAVE is missing fmt or data');
  const { channels, bits, format } = fmt;
  const bytesPer = bits >> 3;
  const frames = Math.floor(dataLen / (bytesPer * channels));
  const out = Array.from({ length: channels }, () => new Float32Array(frames));
  for (let f = 0; f < frames; f++) {
    for (let c = 0; c < channels; c++) {
      const o = dataAt + (f * channels + c) * bytesPer;
      let v;
      if (format === 3 && bits === 32) v = dv.getFloat32(o, true);
      else if (bits === 8) v = (bytes[o] - 128) / 128;            // unsigned, as the classic files are
      else if (bits === 16) v = dv.getInt16(o, true) / 32768;
      else if (bits === 24) v = ((bytes[o] | (bytes[o + 1] << 8) | (dv.getInt8(o + 2) << 16))) / 8388608;
      else if (bits === 32) v = dv.getInt32(o, true) / 2147483648;
      else throw new Error(`unsupported sample width ${bits}`);
      out[c][f] = v;
    }
  }
  return { rate: fmt.rate, channels, data: out };
}

/** 8-bit unsigned mono WAV - the classic file, byte for byte in shape. */
export function writeWav8(samples, rate = DF_RATE) {
  const n = samples.length;
  const buf = new Uint8Array(44 + n);
  const dv = new DataView(buf.buffer);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) buf[o + i] = s.charCodeAt(i); };
  str(0, 'RIFF'); dv.setUint32(4, 36 + n, true); str(8, 'WAVE');
  str(12, 'fmt '); dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);        // PCM
  dv.setUint16(22, 1, true);        // mono
  dv.setUint32(24, rate, true);
  dv.setUint32(28, rate, true);     // byte rate = rate * 1 * 1
  dv.setUint16(32, 1, true);        // block align
  dv.setUint16(34, 8, true);        // bits
  str(36, 'data'); dv.setUint32(40, n, true);
  buf.set(samples, 44);
  return buf;
}

/** Down to mono, the way a mixdown does - the average, not the sum. */
export const toMono = (channels) => {
  if (channels.length === 1) return channels[0];
  const n = channels[0].length, out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (const c of channels) s += c[i];
    out[i] = s / channels.length;
  }
  return out;
};

/** One-pole lowpass, run FORWARDS THEN BACKWARDS so it adds no phase
 *  smear - cheap, and enough to keep what is above 5.5kHz from folding
 *  back down as an alias when the rate drops to 11025. Skipping this is
 *  the difference between "old" and "broken": aliased cymbal fizz turns
 *  into a warble that no amount of 8-bit grit explains. */
export function lowpass(x, cutoff, rate) {
  const a = Math.exp(-2 * Math.PI * cutoff / rate);
  const out = new Float32Array(x.length);
  let y = 0;
  for (let i = 0; i < x.length; i++) { y = (1 - a) * x[i] + a * y; out[i] = y; }
  y = 0;
  for (let i = x.length - 1; i >= 0; i--) { y = (1 - a) * out[i] + a * y; out[i] = y; }
  return out;
}

/** Linear resample. The band above the new Nyquist is already gone. */
export function resample(x, from, to) {
  if (from === to) return x;
  const n = Math.max(1, Math.round(x.length * to / from));
  const out = new Float32Array(n);
  const step = (x.length - 1) / Math.max(1, n - 1);
  for (let i = 0; i < n; i++) {
    const p = i * step, j = Math.floor(p), t = p - j;
    out[i] = x[j] + (x[Math.min(j + 1, x.length - 1)] - x[j]) * t;
  }
  return out;
}

/** To peak, then to 8-bit unsigned. No dither: the quantisation noise
 *  IS the texture (see the header). `peak` stops short of full scale
 *  because 8-bit clipping is ugly and a classic effect never sits on
 *  the rail. */
export function quantise8(x, peak = 0.89) {
  let max = 0;
  for (const v of x) max = Math.max(max, Math.abs(v));
  const g = max > 0 ? peak / max : 1;
  const out = new Uint8Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const v = Math.max(-1, Math.min(1, x[i] * g));
    out[i] = Math.max(0, Math.min(255, Math.round(v * 127 + 128)));
  }
  return out;
}

/** Strip the silence off both ends.
 *
 *  THE LEADING END IS THE ONE THAT MATTERS. A field recording of a gun
 *  routinely carries 50-400ms of room before the shot, and a trigger
 *  that answers 200ms late does not feel late - it feels BROKEN, and
 *  no amount of animation tuning fixes it, because the ear is the part
 *  that noticed. The measurements in tools/sfxBake.mjs exist largely
 *  to find this.
 *
 *  `head` keeps a couple of milliseconds before the first sample over
 *  the threshold, so the attack still starts from zero rather than on
 *  a vertical edge - a step is a click. */
export function trimSilence(x, rate, { threshold = 0.004, head = 0.002, tail = 0.01 } = {}) {
  let a = 0, b = x.length - 1;
  while (a < x.length && Math.abs(x[a]) < threshold) a++;
  while (b > a && Math.abs(x[b]) < threshold) b--;
  if (a >= b) return x;
  a = Math.max(0, a - Math.round(head * rate));
  b = Math.min(x.length - 1, b + Math.round(tail * rate));
  return x.subarray(a, b + 1);
}

/** The whole pipe: float mono at any rate -> the classic file's bytes. */
export function bake(mono, rate, { gain = 1, peak = 0.89, trim = true, maxSeconds = 0 } = {}) {
  let x = trim ? trimSilence(mono, rate) : mono;
  if (maxSeconds > 0 && x.length > maxSeconds * rate) {
    // a hard length cap, faded out over its last 30ms so the cut is not
    // a click - for a recording whose tail is somebody else's reverb
    const n = Math.round(maxSeconds * rate);
    const cut = new Float32Array(x.subarray(0, n));
    const fade = Math.min(n, Math.round(0.03 * rate));
    for (let i = 0; i < fade; i++) cut[n - fade + i] *= 1 - i / fade;
    x = cut;
  }
  const gained = gain === 1 ? x : x.map((v) => v * gain);
  const filtered = lowpass(gained, DF_RATE * 0.45, rate);
  return quantise8(resample(filtered, rate, DF_RATE), peak);
}

export function bakeFile(inPath, outPath, opts = {}) {
  const wav = readWav(readFileSync(inPath));
  const pcm = bake(toMono(wav.data), wav.rate, opts);
  writeFileSync(outPath, writeWav8(pcm));
  return { frames: pcm.length, seconds: pcm.length / DF_RATE, from: wav.rate, channels: wav.channels };
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const files = args.filter((a) => !a.startsWith('--'));
  const opt = (k, d) => {
    const hit = args.find((a) => a.startsWith(`--${k}=`));
    return hit ? Number(hit.split('=')[1]) : d;
  };
  if (files.length !== 2) {
    console.error('usage: node tools/sndify.mjs in.wav out.wav [--gain=1] [--peak=0.89]');
    process.exit(2);
  }
  const r = bakeFile(files[0], files[1], {
    gain: opt('gain', 1), peak: opt('peak', 0.89),
    maxSeconds: opt('max', 0), trim: !args.includes('--no-trim'),
  });
  console.log(`${files[0]} (${r.from}Hz x${r.channels}) -> ${files[1]}  ${DF_RATE}Hz 8-bit mono, ${r.frames} samples, ${r.seconds.toFixed(3)}s`);
}
