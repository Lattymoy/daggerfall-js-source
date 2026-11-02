// GATE-MIX (2026-10-20): the limiter every bus reaches the speakers through - systems/audio.js LIMITER, limiterCurve,
// AudioEngine._limiter. Design: bible/08-Audio/Audio.md, "GATE-MIX".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AudioEngine, LIMITER, LIMIT_LINEAR, LIMIT_CEILING, LIMIT_RANGE, limitAmplitude, limiterCurve, limiterTrim,
} from '../../src/systems/audio.js';

/** The Web Audio spec's WaveShaper read of `curve` at input `x` (linear between its points, its ends past [-1, 1]). */
function shape(curve, x) {
  const n = curve.length;
  if (x <= -1) return curve[0];
  if (x >= 1) return curve[n - 1];
  const v = ((n - 1) / 2) * (x + 1), k = Math.floor(v), f = v - k;
  return k + 1 < n ? (1 - f) * curve[k] + f * curve[k + 1] : curve[k];
}

function fakeCtx({ dynamics = true } = {}) {
  const ctx = { state: 'running', currentTime: 0, sampleRate: 48000, resume() {} };
  const param = (v) => ({ value: v });
  const mk = (kind) => ({ kind, context: ctx, out: new Set(), connect(x) { this.out.add(x); return x; }, disconnect() { this.out.clear(); } });
  ctx.destination = mk('destination');
  ctx.createGain = () => Object.assign(mk('gain'), { gain: param(1) });
  ctx.createBiquadFilter = () => Object.assign(mk('biquad'), { frequency: param(0), Q: param(NaN) });
  if (dynamics) {
    ctx.createDynamicsCompressor = () => Object.assign(mk('compressor'), { threshold: param(-24), knee: param(30), ratio: param(12), attack: param(0.003), release: param(0.25) });
    ctx.createWaveShaper = () => Object.assign(mk('shaper'), { curve: null, oversample: 'none' });
  }
  return ctx;
}
function engine(opts) {
  const ctx = fakeCtx(opts);
  const a = new AudioEngine();
  a.ctx = ctx; a._ensureCtx = () => {};
  a._out();
  return { a, ctx };
}

test('GATE-MIX: the soft ceiling - itself up to LIMIT_LINEAR, never past LIMIT_CEILING however far over full scale, rising and odd, its slope 1 where the shoulder begins (mutants: the shoulder from 0; the ceiling past 1; a hard clip)', () => {
  for (const s of [0, 0.1, 0.5, LIMIT_LINEAR, -0.3, -LIMIT_LINEAR]) assert.equal(limitAmplitude(s), s, `${s} passes untouched`);
  let last = -Infinity;
  for (let s = -8; s <= 8; s += 0.01) {
    const y = limitAmplitude(s);
    assert.ok(Math.abs(y) < LIMIT_CEILING + 1e-12, `${s.toFixed(2)} stays under the ceiling (${y})`);
    assert.ok(y >= last, 'rising');
    assert.ok(Math.abs(limitAmplitude(-s) + y) < 1e-12, 'odd');
    last = y;
  }
  assert.ok(LIMIT_CEILING < 1 && LIMIT_LINEAR < LIMIT_CEILING);
  const e = 1e-6, slope = (limitAmplitude(LIMIT_LINEAR + e) - limitAmplitude(LIMIT_LINEAR)) / e;
  assert.ok(Math.abs(slope - 1) < 1e-3, `the knee is not heard: slope ${slope}`);
  assert.ok(limitAmplitude(1) < 0.95 && limitAmplitude(1) > 0.9, `full scale bent, not cut: ${limitAmplitude(1)}`);
  assert.ok(limitAmplitude(2) > limitAmplitude(1.5), 'still rising past full scale (a hard clip would be flat)');
});

test('GATE-MIX: the curve as the WaveShaper reads it - the signal over LIMIT_RANGE in, the signal itself out under the shoulder, the ceiling over it, the ends at 12 dB over full scale (mutants: the range dropped from the read; the curve off by its scale)', () => {
  const c = limiterCurve();
  assert.equal(c, limiterCurve(), 'made once');
  assert.equal(LIMIT_RANGE, 4);
  for (const s of [0.01, 0.2, 0.5, 0.7, -0.6]) assert.ok(Math.abs(shape(c, s / LIMIT_RANGE) - s) < 1e-6, `${s} comes out as itself`);
  for (const s of [1, 1.6, 2.2, 3.9]) assert.ok(Math.abs(shape(c, s / LIMIT_RANGE) - limitAmplitude(s)) < 1e-4, `${s} on the shoulder`);
  assert.ok(Math.abs(c[c.length - 1] - limitAmplitude(LIMIT_RANGE)) < 1e-6 && c[c.length - 1] <= Math.fround(LIMIT_CEILING), 'its end the ceiling (to a float32)');
  assert.ok(Math.abs(c[0] + c[c.length - 1]) < 1e-7, 'odd');
});

test('GATE-MIX: the trim takes the spec\'s make-up gain back out - (1 / full-range gain)^0.6, the full-range gain threshold + (0 - threshold) / ratio dB with no knee - so under the threshold the stage is unity (mutants: the 0.6 power; the ratio ignored; the sign)', () => {
  const fullRange = LIMITER.threshold * (1 - 1 / LIMITER.ratio);   // dB
  const makeup = Math.pow(1 / 10 ** (fullRange / 20), 0.6);
  assert.ok(Math.abs(limiterTrim() * makeup - 1) < 1e-12);
  assert.ok(limiterTrim() < 1, 'the make-up raises, so its taking out lowers');
  assert.ok(Math.abs(limiterTrim({ threshold: -6, ratio: 20 }) - 10 ** ((0.6 * -6 * 0.95) / 20)) < 1e-12);
  assert.equal(LIMITER.knee, 0, 'the trim\'s law is the no-knee curve');
});

test('GATE-MIX: every bus reaches the speakers through the limiter - the listener into the compressor (LIMITER\'s settings), its trim, the ceiling, the speakers; the underwater low-pass hung before it and taken off back onto it; a context with neither node plays straight through (mutants: the listener to the speakers; the low-pass past the limiter; a setting unread)', () => {
  const { a, ctx } = engine();
  const bus = a.listenerBus();
  const { comp, trim, ceiling } = a._limiterNodes;
  assert.ok(bus.out.has(comp) && bus.out.size === 1, 'the listener feeds the limiter, and nothing else');
  assert.ok(a._master.out.has(bus), 'the effects bus into the listener');
  for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) assert.equal(comp[k].value, LIMITER[k], k);
  assert.ok(comp.out.has(trim) && trim.out.has(ceiling) && ceiling.out.has(ctx.destination), 'compressor, trim, ceiling, speakers');
  assert.ok(Math.abs(trim.gain.value - limiterTrim() / LIMIT_RANGE) < 1e-12);
  assert.equal(ceiling.curve, limiterCurve());
  assert.equal(ceiling.oversample, 'none');
  assert.ok(!bus.out.has(ctx.destination));
  a.setListenerLowPass(1000);
  const f = [...bus.out][0];
  assert.equal(f.kind, 'biquad');
  assert.ok(f.out.has(comp) && !f.out.has(ctx.destination), 'the muffled mix still through the limiter');
  a.setListenerLowPass(0);
  assert.ok(bus.out.has(comp) && bus.out.size === 1, 'off: back onto the limiter');
  const old = engine({ dynamics: false });
  assert.ok(old.a.listenerBus().out.has(old.ctx.destination), 'no compressor: the speakers, as before');
  assert.equal(old.a._limiterNodes, undefined);
});
