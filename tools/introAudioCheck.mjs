// Decode the ACTUAL shipped recording and measure its onset, independently of
// the cue sheet. No mux correction is allowed to manufacture a passing result.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TITLE_IMPACT_TIME, CLOUD_REVEAL_TIME } from '../src/ui/introCue.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const track = `${root}src/assets/intro/theme.mp3`;
const rate = 12000, size = 1024, hop = 128;
function magnitude(samples, start) {
  const real = new Float64Array(size), imag = new Float64Array(size);
  for (let i = 0; i < size; i++) real[i] = samples[start + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1)));
  for (let i = 1, j = 0; i < size; i++) {
    let bit = size >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [real[i], real[j]] = [real[j], real[i]];
  }
  for (let n = 2; n <= size; n <<= 1) {
    const angle = -2 * Math.PI / n;
    for (let i = 0; i < size; i += n) {
      for (let j = 0; j < n / 2; j++) {
        const a = i + j, b = a + n / 2, c = Math.cos(angle * j), s = Math.sin(angle * j);
        const r = real[b] * c - imag[b] * s, v = real[b] * s + imag[b] * c;
        real[b] = real[a] - r; imag[b] = imag[a] - v; real[a] += r; imag[a] += v;
      }
    }
  }
  return real.slice(0, size / 2 + 1).map((r, i) => Math.hypot(r, imag[i]));
}
const bytes = execFileSync('ffmpeg', ['-v', 'error', '-i', track, '-t', '32', '-ac', '1', '-ar', String(rate), '-f', 'f32le', 'pipe:1'], { maxBuffer: 8e6 });
const pcm = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const count = 1 + Math.floor((pcm.length - size) / hop);
const flux = new Float64Array(count);
let previous = null;
for (let i = 0; i < count; i++) {
  const m = magnitude(pcm, i * hop);
  if (previous) for (let k = 0; k < m.length; k++) flux[i] += Math.max(0, m[k] - previous[k]);
  previous = m;
}
const radius = Math.floor(0.5 * rate / hop);
const normalized = flux.map((f, i) => {
  let sum = 0;
  for (let j = Math.max(0, i - radius); j <= Math.min(flux.length - 1, i + radius); j++) sum += flux[j];
  return f / Math.max(1e-9, sum / (radius * 2 + 1));
});
function peakBetween(from, to) {
  let peak = -1;
  for (let i = 0; i < count; i++) {
    const time = (i * hop + size / 2) / rate;
    if (time >= from && time <= to && (peak < 0 || normalized[i] > normalized[peak])) peak = i;
  }
  return { time: (peak * hop + size / 2) / rate, strength: normalized[peak], analysisSample: peak * hop + size / 2 };
}
const title = peakBetween(20.7, 21.35), clouds = peakBetween(11.45, 11.95);
const report = {
  sha256: createHash('sha256').update(readFileSync(track)).digest('hex'),
  method: 'Positive spectral flux; Hann 1024; hop 128; mono 12000 Hz; local mean ±0.5 s; peak centre',
  resolutionMs: hop / rate * 1000, title, clouds,
  titleErrorMs: (TITLE_IMPACT_TIME - title.time) * 1000,
  cloudErrorMs: (CLOUD_REVEAL_TIME - clouds.time) * 1000,
};
console.log(JSON.stringify(report, null, 2));
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n');
if (Math.abs(report.titleErrorMs) > 1 || Math.abs(report.cloudErrorMs) > 1) process.exitCode = 1;
