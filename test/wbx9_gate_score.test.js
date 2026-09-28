// WBX9 (2026-09-26, Mac: "The music needs to be louder and more intense"): THE WARDEN'S SCORE, LOUDER AND HARDER.
// Louder: every voice's level raised and each song played at its own level over the player's (systems/songPlayer.js
// `song.level` - one gain between the channels and the fader; every song MIDI.BSA holds carries none and plays at 1).
// More intense: nothing waits - the strings, the brass stabs and the whole kit from the first bar, the choir from the
// ninth, then from the first; the ostinato driving in sixteenths as the phases turn; the third song's choir chanting on
// the beat. What it SOUNDS like - the loudness, and the peaks under the clip at the highest MusicVolume - is measured
// through the real player by tools/gateScoreProbe.mjs. Design: bible/11-Multiplayer/World-Bosses.md section 12.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gateScoreSongs, SCORE_LEVEL, SCORE_TPQ, SCORE_CHANNELS } from '../src/systems/gateScore.js';
import { SongPlayer, songLevel, SONG_LEVEL_MAX } from '../src/systems/songPlayer.js';

const BAR = 4 * SCORE_TPQ;
const notes = (song, ch) => song.events.filter((e) => e.type === 'noteOn' && e.channel === ch);
const inBar = (list, bar) => list.filter((e) => e.tick >= bar * BAR && e.tick < (bar + 1) * BAR);
const level = (song, ch) => song.events.find((e) => e.type === 'controller' && e.channel === ch && e.controller === 7 && e.tick === 0)?.value;

test('WBX9 a song\'s own level: a number over nothing, clamped to SONG_LEVEL_MAX; a song with none - every song MIDI.BSA holds - plays at exactly 1 (mutants: the level ignored; a missing one taken as 0)', () => {
  assert.equal(songLevel(undefined), 1);
  assert.equal(songLevel({}), 1, 'MIDI.BSA\'s songs carry none');
  assert.equal(songLevel({ level: 1.6 }), 1.6);
  for (const bad of [0, -2, NaN, Infinity, '2']) assert.equal(songLevel({ level: bad }), bad === Infinity ? 1 : 1, `${bad}: the player's own`);
  assert.equal(songLevel({ level: 40 }), SONG_LEVEL_MAX, 'never past the most');
});

test('WBX9 the level in the player\'s graph: every channel runs through the song\'s level, the level through the fader; a song sets it as it starts and the next song without one puts it back at 1 (mutants: the channels past the level; the level left over from the last song)', () => {
  const param = () => ({ value: 0, setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime() {}, cancelScheduledValues() {}, cancelAndHoldAtTime() {}, exponentialRampToValueAtTime() {} });
  const ctx = { currentTime: 5, destination: {}, createGain() { return { gain: param(), to: [], connect(x) { this.to.push(x); return x; } }; } };
  const p = new SongPlayer(ctx);
  p._ensureMaster();
  assert.deepEqual(p._level.to, [p._fader], 'the level runs into the fader (the fades stay the fader\'s)');
  assert.equal(p._level.gain.value, 1);
  p._state = [];
  assert.deepEqual(p._channelGain(0).to, [p._level], 'every channel through the level');
  const song = (lvl) => ({ events: [{ tick: 0, type: 'controller', channel: 0, controller: 7, value: 100 }], secondsPerTick: 0.01, durationTicks: 100, ...(lvl === undefined ? {} : { level: lvl }) });
  try {
    assert.equal(p.play(song(1.6)), true);
    assert.equal(p._level.gain.value, 1.6, 'the score\'s level as it starts');
    p.stop();
    p.play(song(undefined));
    assert.equal(p._level.gain.value, 1, 'the next song\'s own - 1');
  } finally { p.stop(); }
});

test('WBX9 the score carries its level - over the player\'s own, the war growing with his phases, the fall\'s fanfare over them - and every voice louder than it was (mutants: a song without its level; the war\'s levels upside down)', () => {
  const s = gateScoreSongs();
  for (const key of ['war1', 'war2', 'war3', 'fell']) {
    assert.equal(s[key].level, SCORE_LEVEL[key], `${key}: its own level`);
    assert.ok(s[key].level > 1 && s[key].level <= SONG_LEVEL_MAX, `${key}: over the player's own`);
  }
  assert.ok(SCORE_LEVEL.war1 <= SCORE_LEVEL.war2 && SCORE_LEVEL.war2 <= SCORE_LEVEL.war3, 'the war grows');
  assert.ok(SCORE_LEVEL.fell >= SCORE_LEVEL.war1);
  // WB7's levels, the floor every voice now stands over
  const was = { ostinato: 108, bass: 90, strings: 92, brass: 114, choir: 100, organ: 62, timpani: 106, hit: 100, bells: 92 };
  for (const song of Object.values(s)) for (const [voice, v] of Object.entries(was)) assert.ok(level(song, SCORE_CHANNELS[voice]) > v, `${song.name}: ${voice} louder than it was`);
});

test('WBX9 nothing waits and the drive grows: the first song\'s strings, brass stabs, timpani and kit from its first bar, its choir from the ninth; the second\'s and third\'s choir from the first; the ostinato in sixteenths through a bar\'s last beat in the first song, every other bar\'s second half in the second, every bar in the third - which chants its choir on every beat (mutants: the first song\'s strings held back; the third\'s drive lost)', () => {
  const { war1, war2, war3 } = gateScoreSongs();
  for (const voice of ['strings', 'brass', 'timpani', 'kit', 'ostinato', 'bass', 'organ']) assert.ok(inBar(notes(war1, SCORE_CHANNELS[voice]), 0).length > 0, `war1: ${voice} in the first bar`);
  assert.equal(Math.min(...notes(war1, SCORE_CHANNELS.choir).map((e) => e.tick)), 8 * BAR, 'war1: the choir from the ninth bar');
  for (const war of [war2, war3]) assert.equal(Math.min(...notes(war, SCORE_CHANNELS.choir).map((e) => e.tick)), 0, `${war.name}: the choir from the first`);
  const ost = (song, bar) => inBar(notes(song, SCORE_CHANNELS.ostinato), bar).length;
  assert.equal(ost(war1, 0), 8, 'war1: eighths...');
  assert.equal(ost(war1, 3), 10, '...and sixteenths through the fourth bar\'s last beat');
  assert.equal(ost(war2, 0), 10, 'war2: its last beat in sixteenths...');
  assert.equal(ost(war2, 1), 12, '...and every other bar\'s second half');
  for (let bar = 0; bar < 32; bar++) assert.equal(ost(war3, bar), 16, `war3: sixteenths through bar ${bar}`);
  const choirBeats = new Set(inBar(notes(war3, SCORE_CHANNELS.choir), 5).map((e) => (e.tick - 5 * BAR) / SCORE_TPQ));
  for (const b of [0, 1, 2, 3]) assert.ok(choirBeats.has(b), `war3: the choir on beat ${b + 1}`);
});
