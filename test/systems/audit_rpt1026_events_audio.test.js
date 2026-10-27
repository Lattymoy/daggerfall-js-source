// AUDIT RPT1026 (lane I, EVENTS) I2: THE PAGE'S OWN SOUNDS ALWAYS FIND A VOICE.
// RPT1026-EVENTS VOICE-CAP bounds the one-shots at REAL_VOICES (32): past the bound a shot plays only as loud at the ear as
// the quietest sounding, which it steals. Its record and its pin said a flat shot - a press, my own swing - always finds a
// voice; the pin's crowd was built by hand at volume 1. The crowd's real producer (net/remotePlayers.js _syncAttackSound,
// peerSound) plays a peer's swing at 1.1 through PEER_SOUND_PROFILE, whole inside six metres - louder at the ear than the
// blow that lands on me (PLAYER_HIT_VOLUME 1), my cry (playPlayerVoice, 1) and my steps (FOOTSTEP_VOLUME 0.7). Thirty-two
// peers swinging about me refused every one of mine. A flat one-shot (playOneShot - the page's own, at the ear) now always
// plays, the quietest stolen for it; a positional shot keeps the law. tools/mutants/audit_rpt1026_events.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine, REAL_VOICES, voiceRoom } from '../../src/systems/audio.js';
import { RemotePlayers, PEER_SOUND_PROFILE } from '../../src/net/remotePlayers.js';
import { PLAYER_HIT_VOLUME, hitSoundFor, SOUND } from '../../src/systems/soundClips.js';
import { FOOTSTEP_VOLUME } from '../../src/systems/footsteps.js';
import { playerPainVoice, playPlayerVoice } from '../../src/scenes/hostCombat.js';

/** A recording context (test/systems/rpt1026_events_audio.test.js's): every source it made, its clock. */
function engine() {
  const made = { sources: [] };
  const param = (v = 0) => ({ value: v, events: [], setValueAtTime(x, t) { this.events.push(['set', x, t]); this.value = x; }, linearRampToValueAtTime(x, t) { this.events.push(['ramp', x, t]); }, cancelScheduledValues(t) { this.events.push(['cancel', t]); } });
  const node = (o = {}) => ({ connect(n) { this.to = n; return n; }, disconnect() { this.gone = true; }, ...o });
  const ctx = {
    state: 'running', destination: node(), listener: { setPosition() {}, setOrientation() {} }, currentTime: 0,
    createBufferSource() { const src = node({ playbackRate: param(1), started: null, stopAt: null, start(w) { this.started = w ?? 0; }, stop(w) { this.stopAt = w ?? 0; } }); made.sources.push(src); return src; },
    createGain() { return node({ gain: param(1) }); },
    createPanner() { return node({ positionX: param(), positionY: param(), positionZ: param() }); },
    createBuffer(ch, len, rate) { const d = new Float32Array(len); return { numberOfChannels: ch, length: len, sampleRate: rate, duration: len / rate, getChannelData: () => d }; },
  };
  const e = new AudioEngine();
  e.ctx = ctx; e.enabled = true;
  e.setListener([0, 0, 0], [0, 0, -1]);
  const sounding = () => made.sources.filter((s) => s.started != null && s.stopAt == null);
  return { e, made, sounding };
}
/** Every clip a second long - the swings the crowd's producer picks, the hit, the cry and the step mine play. */
function clips(e) { for (let k = 0; k < 512; k++) e.registerSamples(k, new Float32Array(22050), 22050); }

test('AUDIT RPT1026 I2 THE CROWD AND ME: forty peers swinging within six metres - the crowd\'s own producer at its own volume and profile - fill the real voices; the blow that lands on me, my cry and my step each still sound, the quietest stolen for each, and never past the bound; a peer\'s far swing past the bound still never starts (mutants: the flat shot not flat; the law\'s flat unread; the take\'s flat dropped; every shot flat)', () => {
  const { e, made, sounding } = engine();
  clips(e);
  const rp = new RemotePlayers({ renderer: null, deps: { audio: e } });
  const toScene = (s) => [s.x, s.y, s.z];
  const peers = Array.from({ length: 40 }, (_, k) => ({ id: `peer${k}`, shown: { x: Math.sin(k) * 4, y: 0, z: Math.cos(k) * 4, an: 0, wd: 0 }, look: null }));
  for (const p of peers) rp._syncAttackSound(p, toScene, [0, 0, 0]);   // first sighting: nothing
  for (const p of peers) { p.shown.an++; rp._syncAttackSound(p, toScene, [0, 0, 0]); }   // the crowd swings
  assert.equal(PEER_SOUND_PROFILE.refDistance, 6, 'whole inside six metres');
  assert.equal(sounding().length, REAL_VOICES, 'the crowd fills the real voices');
  const crowd = new Set(sounding());
  // mine, at their own producers' volumes
  assert.ok(PLAYER_HIT_VOLUME < 1.1 && FOOTSTEP_VOLUME < 1.1, 'each quieter at the ear than a peer\'s swing inside its six metres');
  assert.equal(e.playOneShot(hitSoundFor(null, () => 0), PLAYER_HIT_VOLUME), 1, 'the blow that lands on me sounds');
  const cry = playerPainVoice({ race: 'Breton', gender: 'male', maxHealth: 100, health: 40, items: [] }, 60, () => 0);
  assert.ok(cry && cry.clip >= 0, 'the cry the producer chose');
  const before = made.sources.length;
  playPlayerVoice(e, cry);
  assert.equal(made.sources.length, before + 1, 'my cry made');
  assert.ok(sounding().includes(made.sources.at(-1)), 'and sounds');
  assert.equal(e.playOneShot(SOUND.FallHard, FOOTSTEP_VOLUME), 1, 'my step\'s sound (the stride\'s volume) sounds');
  assert.equal(sounding().length, REAL_VOICES, 'never past the bound');
  assert.equal([...crowd].filter((s) => s.stopAt != null).length, 3, 'a swing of the crowd stolen for each of mine - never one of mine for another');
  const mine = sounding().filter((s) => !crowd.has(s));
  assert.equal(mine.length, 3, 'all three of mine sounding');
  // the crowd swings again, as near: it takes the crowd's own voices, never mine
  for (const p of peers.slice(0, 8)) { p.shown.an++; rp._syncAttackSound(p, toScene, [0, 0, 0]); }
  assert.ok(mine.every((s) => s.stopAt == null), 'a peer\'s swing never steals a voice of mine');
  assert.equal(sounding().length, REAL_VOICES);
  // a peer's far swing past the bound: the law as it was
  const far = { id: 'peer-far', shown: { x: 0, y: 0, z: 25, an: 0, wd: 0 }, look: null };
  rp._syncAttackSound(far, toScene, [0, 0, 0]); far.shown.an++;
  const n0 = made.sources.length;
  rp._syncAttackSound(far, toScene, [0, 0, 0]);
  assert.equal(made.sources.length, n0, 'a far peer\'s swing, quieter than every one sounding, never starts');
});

test('AUDIT RPT1026 I2 THE LAW: at the bound a flat shot plays however quiet, stealing the quietest positional voice - a flat one only when every voice is flat; a positional shot plays only as loud as the quietest positional voice and never steals a flat one (mutants: the law\'s flat unread; a flat voice stealable)', () => {
  const live = Array.from({ length: REAL_VOICES }, (_, i) => ({ level: 1.1 - i / 1000 }));
  assert.deepEqual(voiceRoom(live, 0.01, REAL_VOICES, true), { play: true, steal: live[REAL_VOICES - 1] });
  assert.deepEqual(voiceRoom(live, 0.01), { play: false, steal: null });
  assert.deepEqual(voiceRoom(live.slice(1), 0.01, REAL_VOICES, true), { play: true, steal: null }, 'under the bound: no steal');
  const mixed = live.map((v, i) => (i % 2 ? { ...v, level: 0.2, flat: true } : v));   // half of them mine, quieter
  assert.equal(voiceRoom(mixed, 0.5, REAL_VOICES, true).steal, mixed[REAL_VOICES - 2], 'a flat shot steals the quietest positional voice, not a quieter one of mine');
  assert.equal(voiceRoom(mixed, 2).steal, mixed[REAL_VOICES - 2], 'a positional one too');
  const allMine = live.map((v) => ({ ...v, flat: true }));
  assert.deepEqual(voiceRoom(allMine, 5), { play: false, steal: null }, 'a positional shot never steals a voice of mine');
  assert.equal(voiceRoom(allMine, 0.01, REAL_VOICES, true).steal, allMine[REAL_VOICES - 1], 'every voice mine: a flat shot steals the quietest of them');
});
