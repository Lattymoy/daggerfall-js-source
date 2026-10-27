// RPT1026-EVENTS VOICE-CAP (a private report from a crowded Dagon's Breach: the sound failed, and stayed silent for minutes
// after the event ended): THE REAL VOICES.
// DFU's Unity project sounds at most 32 voices at once (ProjectSettings/AudioManager.asset m_RealVoiceCount) and
// makes the rest virtual, the least audible first; the port bounded nothing, and a one-shot's source, gain and HRTF panner
// stayed wired into the bus after it ended. The real engine (systems/audio.js) over a recording AudioContext: a crowd's
// blows played round the ear, the voices sounding counted, the quietest stolen, and every chain let go at its end.
// tools/mutants/rpt1026_events.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine, REAL_VOICES, voiceRoom, distanceGain, VOICE_FADE_S } from '../../src/systems/audio.js';

/** A recording context (test/systems/audit_gatherfeel.test.js's): every source, gain and panner it made, its clock. */
function engine() {
  const made = { sources: [], gains: [], panners: [] };
  const clock = { now: 0 };
  const param = (v = 0) => ({ value: v, events: [], setValueAtTime(x, t) { this.events.push(['set', x, t]); this.value = x; }, linearRampToValueAtTime(x, t) { this.events.push(['ramp', x, t]); }, cancelScheduledValues(t) { this.events.push(['cancel', t]); } });
  const node = (o = {}) => ({ connect(n) { this.to = n; return n; }, disconnect() { this.gone = true; }, ...o });
  const ctx = {
    state: 'running', destination: node(), listener: { setPosition() {}, setOrientation() {} }, get currentTime() { return clock.now; },
    createBufferSource() { const src = node({ context: ctx, playbackRate: param(1), started: null, stopAt: null, start(w) { this.started = w ?? clock.now; }, stop(w) { this.stopAt = w ?? clock.now; } }); made.sources.push(src); return src; },
    createGain() { const g = node({ gain: param(1), context: ctx }); made.gains.push(g); return g; },
    createPanner() { const p = node({ positionX: param(), positionY: param(), positionZ: param() }); made.panners.push(p); return p; },
    createBuffer(ch, len, rate) { const d = new Float32Array(len); return { numberOfChannels: ch, length: len, sampleRate: rate, duration: len / rate, getChannelData: () => d }; },
  };
  const e = new AudioEngine();
  e.ctx = ctx; e.enabled = true;
  e.registerSamples('blow', new Float32Array(22050), 22050);   // a second's clip
  e.setListener([0, 0, 0], [0, 0, -1]);
  /** The sources still sounding: started, never stopped, never ended. */
  const sounding = () => made.sources.filter((s) => s.started != null && s.stopAt == null && !s.ended);
  return { e, made, clock, sounding };
}

test('RPT1026-EVENTS VOICE-CAP THE LAW: under the real voices a shot plays; at them it plays only as loud as the quietest sounding or louder, stealing that one (the oldest of the quietest); the distance models are the Web Audio spec\'s (mutants: the bound off; the quietest never stolen)', () => {
  assert.equal(REAL_VOICES, 32, 'DFU\'s m_RealVoiceCount');
  const live = Array.from({ length: REAL_VOICES }, (_, i) => ({ level: 0.5 + i / 100 }));
  assert.deepEqual(voiceRoom(live.slice(0, 31), 0.01), { play: true, steal: null }, 'room under the bound');
  assert.deepEqual(voiceRoom(live, 0.4), { play: false, steal: null }, 'quieter than every one sounding: not started');
  assert.deepEqual(voiceRoom(live, 0.9), { play: true, steal: live[0] }, 'louder: the quietest stolen');
  const tie = [{ level: 0.3, n: 1 }, { level: 0.3, n: 2 }];
  assert.equal(voiceRoom(tie, 0.3, 2).steal, tie[0], 'a tie takes the oldest');
  // the spec's three models
  assert.equal(distanceGain(0.5, { refDistance: 1 }), 1, 'inside the reference: whole');
  assert.equal(distanceGain(3, { refDistance: 1 }), 1 / 3, 'inverse: ref / (ref + (d - ref))');
  assert.equal(distanceGain(8, { refDistance: 1, maxDistance: 16, distanceModel: 'linear' }), 1 - 7 / 15, 'linear');
  assert.equal(distanceGain(40, { refDistance: 1, maxDistance: 16, distanceModel: 'linear' }), 0, 'linear past its end: nothing');
  assert.equal(distanceGain(4, { refDistance: 2, distanceModel: 'exponential' }), 0.5, 'exponential');
});

test('RPT1026-EVENTS VOICE-CAP THE CROWD: forty players\' blows round my ear sound at most REAL_VOICES at once - each new near one fades the farthest out, a far one past the bound never starts - and a flat shot (a press, my own swing) always finds a voice (mutants: the bound off; a stolen voice left sounding; the distance not read)', () => {
  const { e, made, sounding } = engine();
  // a crowd of forty in a ring 4 to 40 m out, the far ones first
  const played = [];
  for (let k = 0; k < 40; k++) {
    const d = 40 - k * 0.9, a = k * 2.4;
    played.push(e.play3d('blow', [Math.sin(a) * d, 0, Math.cos(a) * d], 1, { refDistance: 2, maxDistance: 60 }));
    assert.ok(sounding().length <= REAL_VOICES, `never past the real voices (${sounding().length} after ${k + 1})`);
  }
  assert.equal(sounding().length, REAL_VOICES, 'the bound held, full');
  assert.ok(played.every((p) => p === 1), 'each nearer one found a voice');
  const stolen = made.sources.filter((s) => s.stopAt != null);
  assert.equal(stolen.length, 40 - REAL_VOICES, 'the farthest stolen for them');
  for (const s of stolen) {
    const g = s.to;
    assert.ok(g.gain.events.some((v) => v[0] === 'ramp' && v[1] === 0), 'faded to nothing, never cut at its level');
    assert.ok(s.stopAt >= VOICE_FADE_S, 'then stopped');
  }
  // one far off now, quieter than every one sounding: nothing starts, nothing is made
  const before = made.sources.length;
  assert.equal(e.play3d('blow', [0, 0, 58], 1, { refDistance: 2, maxDistance: 60 }), undefined, 'a far blow past the bound is not started');
  assert.equal(made.sources.length, before, 'and no chain made for it');
  // a press of mine, flat at its own volume: the loudest thing there is
  assert.equal(e.playOneShot('blow', 1), 1, 'a flat shot always finds a voice');
  assert.ok(sounding().length <= REAL_VOICES);
});

test('RPT1026-EVENTS VOICE-CAP THE CHAIN LET GO: a positional shot\'s source, gain and panner and a flat shot\'s source and gain are disconnected from the bus as each ends, and its voice freed - before, play3d\'s and playOneShot\'s chains stayed wired into the bus for the page\'s life (mutants: the chain kept; the voice never freed)', () => {
  const { e, made, sounding, clock } = engine();
  e.play3d('blow', [3, 0, 4], 1, { refDistance: 2 });
  e.playOneShot('blow', 0.8);
  const [s3, s2] = made.sources, g3 = s3.to, p3 = g3.to, g2 = s2.to;
  assert.equal(p3, made.panners[0], 'a panner on the positional shot');
  s3.onended(); s3.ended = true;
  s2.onended(); s2.ended = true;
  assert.ok(s3.gone && g3.gone && p3.gone, 'the positional chain let go');
  assert.ok(s2.gone && g2.gone, 'the flat chain let go');
  assert.equal(sounding().length, 0);
  // a voice freed is room again: REAL_VOICES more shots all sound
  clock.now = 10;
  for (let k = 0; k < REAL_VOICES; k++) assert.equal(e.play3d('blow', [0, 0, 50], 0.1, { refDistance: 2 }), 1, `shot ${k}`);
  assert.equal(e.play3d('blow', [0, 0, 55], 0.1, { refDistance: 2 }), undefined, 'and the next quieter one waits for a voice');
  for (const s of made.sources.slice(2, 2 + REAL_VOICES)) { s.onended(); s.ended = true; }
  assert.equal(e.play3d('blow', [0, 0, 55], 0.1, { refDistance: 2 }), 1, 'its voice found once they end');
});
