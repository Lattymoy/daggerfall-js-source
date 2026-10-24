// MIDI-OUT1 (2026-10-11, a player asking for MIDI out): THE SONGS ON A MIDI DEVICE (systems/midiOut.js). The player
// is a SongPlayer whose voice is a Web MIDI output: the device is a fake that records what it is sent and when, the
// clock a number the test moves, so every pin reads the bytes and the timestamps a real device would be handed.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  midiMessage, scaledVolume, stateKey, channelResetMessages, channelQuietMessages, MidiOutSongPlayer,
  setMidiOut, midiOutName, midiOutputs, findMidiOutput, _resetMidiOutForTests, MIDI_GAP_S, nextMidiOut, onMidiOutChange,
} from '../../src/systems/midiOut.js';
import { setMusicMuted } from '../../src/systems/song/songPlayer.js';
import { setValue, _resetForTests as resetSettings } from '../../src/systems/settings/settings.js';
import { _resetForTests as resetPrefs } from '../../src/systems/uiPrefs.js';
import { gateScoreSongs } from '../../src/systems/gate/gateScore.js';
import { MusicService } from '../../src/systems/music.js';
import { whereIs, CATEGORIES } from '../../src/ui/settings/settingsMap.js';
import { restoreTabDefaults } from '../../src/ui/enhanced/enhancedMenu.js';

/** A device: every message as [bytes..., ms] (the ms to the microsecond, so sums of ticks compare). */
function fakeOutput(name = 'Synth A') {
  const log = [];
  return { id: name, name, state: 'connected', log, send(bytes, ts) { log.push([...bytes, Math.round(ts * 1000) / 1000]); } };
}
const clockAt = (t) => ({ currentTime: t });
const ms = (s) => Math.round(s * 1e6) / 1000;   // seconds -> the log's milliseconds
const players = [];
function playerOn(out, clock) { const p = new MidiOutSongPlayer(out, clock); players.push(p); return p; }
function fresh() {
  resetSettings(); resetPrefs(); setMusicMuted(false);
  for (const p of players.splice(0)) p.stop();
}
afterEach(() => { for (const p of players.splice(0)) p.stop(); });   // a failed pin must not leave a pump's interval holding the run open

/** An HMI song's shape (formats/hmiFile.js): tick-ordered, each note-on with its length and a paired note-off at its
 *  end ranked before a note-on on the same tick. 100 ticks a second. */
const SONG = Object.freeze({
  secondsPerTick: 0.01,
  durationTicks: 20,
  events: [
    { tick: 0, type: 'meta', channel: null, metaType: 0x51, data: [] },
    { tick: 0, type: 'programChange', channel: 0, program: 48 },
    { tick: 0, type: 'controller', channel: 0, controller: 7, value: 100 },
    { tick: 0, type: 'noteOn', channel: 0, note: 60, velocity: 90, duration: 10 },
    { tick: 10, type: 'noteOff', channel: 0, note: 60, velocity: 0 },
    { tick: 10, type: 'noteOn', channel: 0, note: 60, velocity: 80, duration: 5 },
    { tick: 12, type: 'pitchBend', channel: 0, value: 9000 },
    { tick: 15, type: 'noteOff', channel: 0, note: 60, velocity: 0 },
  ],
});

test('MIDI-OUT1 the vocabulary: each channel event as the bytes a device takes, clamped to seven bits; HMI\'s own, meta, sysex and a channel-less event not sent; the state a stall re-sends keyed by channel and control, never the channel-mode controllers (mutants: a status nibble wrong; the bend\'s bytes swapped; a velocity over 127 sent raw; a reset kept as state)', () => {
  assert.deepEqual(midiMessage({ type: 'noteOn', channel: 3, note: 60, velocity: 100 }), [0x93, 60, 100]);
  assert.deepEqual(midiMessage({ type: 'noteOff', channel: 9, note: 36, velocity: 0 }), [0x89, 36, 0]);
  assert.deepEqual(midiMessage({ type: 'polyPressure', channel: 1, note: 64, pressure: 20 }), [0xa1, 64, 20]);
  assert.deepEqual(midiMessage({ type: 'controller', channel: 15, controller: 91, value: 76 }), [0xbf, 91, 76]);
  assert.deepEqual(midiMessage({ type: 'programChange', channel: 2, program: 48 }), [0xc2, 48]);
  assert.deepEqual(midiMessage({ type: 'channelPressure', channel: 4, pressure: 9 }), [0xd4, 9]);
  assert.deepEqual(midiMessage({ type: 'pitchBend', channel: 0, value: 9000 }), [0xe0, 9000 & 0x7f, 9000 >> 7]);
  assert.deepEqual(midiMessage({ type: 'pitchBend', channel: 0, value: 8192 }), [0xe0, 0, 64], 'centre is 0x2000');
  assert.deepEqual(midiMessage({ type: 'noteOn', channel: 0, note: 60, velocity: 137 }), [0x90, 60, 127], 'an accent past 127 (gateScore adds them) is 127, not a status byte');
  assert.deepEqual(midiMessage({ type: 'pitchBend', channel: 0, value: 20000 }), [0xe0, 127, 127]);
  for (const e of [{ type: 'meta', channel: null }, { type: 'hmi', channel: null }, { type: 'sysEx', channel: null },
    { type: 'noteOn', channel: null, note: 1, velocity: 1 }, { type: 'noteOn', channel: 16, note: 1, velocity: 1 }]) {
    assert.equal(midiMessage(e), null, `${e.type} on ${e.channel} is not sent`);
  }
  assert.equal(scaledVolume(100, 0.25), 50, 'a gain under the square root: GM\'s CC7 is (v/127)^2, so a quarter of the power is half the CC7');
  assert.equal(scaledVolume(127, 0.5), 90, 'the default volume, -6 dB as the synth plays it - not 64, which a device plays at -12');
  assert.equal(scaledVolume(127, 4), 127, 'a song\'s own level never takes CC7 past 127');
  assert.equal(scaledVolume(100, NaN), 0);
  assert.equal(stateKey({ type: 'controller', channel: 2, controller: 7 }), 'c2:7');
  assert.equal(stateKey({ type: 'controller', channel: 2, controller: 121 }), null);
  assert.equal(stateKey({ type: 'programChange', channel: 2 }), 'programChange2');
  assert.equal(stateKey({ type: 'noteOn', channel: 2 }), null);
  assert.deepEqual(channelResetMessages(5), [[0xb5, 121, 0], [0xc5, 0], [0xb5, 10, 64], [0xe5, 0, 64]], 'freshChannelState\'s own: program 0, pan and bend centred');
  assert.deepEqual(channelQuietMessages(5), [[0xb5, 64, 0], [0xb5, 123, 0]]);
});

test('MIDI-OUT1 a song as the device hears it: every channel reset just before the origin, its volume scaled by the player\'s; then the song on its own ticks - the program, its CC7 under MusicVolume, the notes, the bend - each note released at its length, a note struck again on its own release released FIRST, the stream\'s note-offs not sent twice, the meta event not at all (mutants: the restrike cut by its own release; the stream note-offs sent; CC7 unscaled; the reset after the origin)', () => {
  fresh();
  const out = fakeOutput();
  const clock = clockAt(10);
  const p = playerOn(out, clock);
  assert.equal(p.play(SONG), true);
  const o = 10.06;   // the origin: 60 ms of lead
  const song = out.log.filter((m) => m[3] >= ms(o) || (m.length === 3 && m[2] >= ms(o)));
  const reset = out.log.filter((m) => m.at(-1) === ms(o - MIDI_GAP_S));
  assert.equal(reset.length, 16 * 5, 'five messages a channel, every channel');
  assert.deepEqual(reset.slice(0, 5), [[0xb0, 121, 0, ms(o - MIDI_GAP_S)], [0xc0, 0, ms(o - MIDI_GAP_S)], [0xb0, 10, 64, ms(o - MIDI_GAP_S)], [0xe0, 0, 64, ms(o - MIDI_GAP_S)], [0xb0, 7, 90, ms(o - MIDI_GAP_S)]],
    'CC7 full (127) under the default MusicVolume 0.5 is 90 (127 x sqrt 0.5)');
  assert.deepEqual(song, [
    [0xc0, 48, ms(o)],
    [0xb0, 7, 71, ms(o)],                 // 100 x sqrt 0.5
    [0x90, 60, 90, ms(o)],
    [0x80, 60, 0, ms(o + 0.1)],           // its length, released before...
    [0x90, 60, 80, ms(o + 0.1)],          // ...the same note struck on that tick
    [0xe0, 9000 & 0x7f, 9000 >> 7, ms(o + 0.12)],
    [0x80, 60, 0, ms(o + 0.15)],
  ]);
  p.stop();
});

test('MIDI-OUT1 the volume is CC7: the slider re-levels every channel at once, the video mute takes it to nothing, a fade lands where it stands and runs with the pumps, and a re-level is never queued under a CC7 the window already holds (mutants: resyncGain does nothing; the mute ignored; the fade\'s level the end\'s at once)', () => {
  fresh();
  const out = fakeOutput();
  const clock = clockAt(10);
  const p = playerOn(out, clock);
  p.play(SONG);
  const cc7 = (from) => out.log.slice(from).filter((m) => (m[0] & 0xf0) === 0xb0 && m[1] === 7);
  let mark = out.log.length;
  setValue('Controls', 'MusicVolume', 1);
  p.resyncGain();
  assert.deepEqual(cc7(mark).map((m) => [m[2], m[3]]).slice(0, 2), [[100, ms(10.06 + MIDI_GAP_S)], [127, ms(10.06 - MIDI_GAP_S + MIDI_GAP_S)]],
    'channel 0 at its own 100, after the song\'s CC7 at the origin; channel 1 at full, after its reset');
  assert.equal(cc7(mark).length, 16, 'every channel moved');
  mark = out.log.length;
  setMusicMuted(true);
  p.resyncGain();
  assert.ok(cc7(mark).length === 16 && cc7(mark).every((m) => m[2] === 0), 'the video mute: every channel to nothing');
  setMusicMuted(false);
  p.resyncGain();
  p.fadeTo(0, 1);   // over a second from 10.0
  mark = out.log.length;
  clock.currentTime = 10.5;
  p._pump();
  assert.deepEqual(cc7(mark).find((m) => m[0] === 0xb1), [0xb1, 7, 90, ms(10.5)], 'half way down a second: a full channel at half its power, 127 x sqrt 0.5');
  assert.deepEqual(cc7(mark).find((m) => m[0] === 0xb0), [0xb0, 7, 71, ms(10.5)], 'and the song\'s 100 the same');
  clock.currentTime = 11.2;
  p._pump();
  assert.ok(cc7(out.log.length - 16).every((m) => m[2] === 0), 'and at its end, nothing');
  p.stop();
});

test('MIDI-OUT1 a stop leaves the device silent: every note struck is released - one still queued just after its own note-on - the pedal up and all-notes-off on every channel, now and again after the last message queued; the next song begins after that (mutants: the queued note left hanging; the quiet sent once, before the queue; the next origin ignoring it)', () => {
  fresh();
  const out = fakeOutput();
  const clock = clockAt(10);
  const p = playerOn(out, clock);
  p.play(SONG);   // everything up to 10.27 is queued
  const mark = out.log.length;
  p.stop();
  const after = out.log.slice(mark);
  assert.ok(!after.some((m) => m[0] === 0x80), 'both notes were released inside the window that struck them - nothing owed');
  const quiet = after.filter((m) => m[1] === 123);
  assert.equal(quiet.length, 32, 'all-notes-off on every channel, twice');
  const last = Math.max(...out.log.slice(0, mark).map((m) => m.at(-1)));
  assert.ok(quiet.some((m) => m[3] > last), 'once after everything the song had queued');
  const pedal = after.filter((m) => m[1] === 64 && m[2] === 0);
  assert.equal(pedal.length, 32);
  const m2 = out.log.length;
  p.play(SONG);
  const resets = out.log.slice(m2).filter((m) => m[1] === 121);
  assert.equal(resets.length, 16);
  assert.ok(resets.every((m) => m[3] > last), 'the next song\'s reset lands after the stopped one\'s last message');
  assert.ok(out.log.slice(m2).some((m) => m[0] === 0x90 && m[3] > resets[0][3]), 'and its notes after that');
  p.stop();
});

test('MIDI-OUT1 a release that rounds past a re-strike of its note is still sent before it: at 1/120 s a tick, a note at tick 2 held six ticks ends 1.8e-15 s after tick 8 (mutant: MO1A-2, the overlap left to the earlier release)', () => {
  fresh();
  const sent = [];
  const out = { send(bytes, ts) { sent.push([bytes[0] & 0xf0, ts]); } };
  const p = playerOn(out, clockAt(10));
  const song = { secondsPerTick: 1 / 120, durationTicks: 20, events: [
    { tick: 2, type: 'noteOn', channel: 0, note: 60, velocity: 90, duration: 6 },
    { tick: 8, type: 'noteOn', channel: 0, note: 60, velocity: 90, duration: 6 },
  ] };
  assert.ok((10.06 + 2 / 120) + 6 / 120 > 10.06 + 8 / 120, 'the case is real');
  p.play(song);
  const notes = sent.filter(([k]) => k === 0x80 || k === 0x90);
  assert.deepEqual(notes.map(([k]) => k), [0x90, 0x80, 0x90, 0x80]);
  assert.ok(notes[1][1] <= notes[2][1], 'the release is due no later than the note struck again');
});

test('MIDI-OUT1 a note queued a window ahead is answered by its own release when the song stops before it sounds (mutant: the release sent at now, ahead of the note-on it answers)', () => {
  fresh();
  const out = fakeOutput();
  const clock = clockAt(10);
  const p = playerOn(out, clock);
  const song = { secondsPerTick: 0.01, durationTicks: 300, events: [{ tick: 10, type: 'noteOn', channel: 1, note: 70, velocity: 99, duration: 200 }] };
  p.play(song);   // the note-on at 10.16, its release two seconds on, not yet queued
  assert.ok(out.log.some((m) => m[0] === 0x91 && m[3] === ms(10.16)));
  assert.ok(!out.log.some((m) => m[0] === 0x81), 'a release past the window waits for its window');
  const mark = out.log.length;
  p.stop();
  assert.deepEqual(out.log[mark], [0x81, 70, 0, ms(10.16 + MIDI_GAP_S)], 'released just after its own note-on, not before it');
});

test('MIDI-OUT1 a song made in code (gateScore - note-ons with lengths and no note-offs) gets every note released at its length, and its own level in its volume (mutants: the stream\'s note-offs trusted; the song\'s level dropped)', () => {
  fresh();
  const out = fakeOutput();
  const clock = clockAt(10);
  const p = playerOn(out, clock);
  const war = Object.values(gateScoreSongs())[0];
  assert.ok(!war.events.some((e) => e.type === 'noteOff'), 'the producer mints no note-offs');
  p.loop = false;
  p.play(war);
  const end = 10.06 + war.durationTicks * war.secondsPerTick + 1.2;
  for (let t = 10; t < end; t += 0.1) { clock.currentTime = t; p._pump(); }
  const ons = out.log.filter((m) => (m[0] & 0xf0) === 0x90 && m[2] > 0);
  const offs = out.log.filter((m) => (m[0] & 0xf0) === 0x80);
  assert.ok(ons.length > 50, `the song sounded (${ons.length} notes)`);
  assert.equal(offs.length, ons.length, 'every note released, once');
  const kit = war.events.find((e) => e.type === 'controller' && e.controller === 7);
  const sent = out.log.find((m) => m[0] === (0xb0 | kit.channel) && m[1] === 7 && m[3] === ms(10.06));
  assert.equal(sent[2], scaledVolume(kit.value, 0.5 * war.level), 'its CC7 carries the song\'s own level');
});

test('MIDI-OUT1 a stalled tab: the gap is skipped as the synth skips it, and the device is told the state on its far side - the program and the volume (mutant: the skip only folded into the player\'s own state)', () => {
  fresh();
  const out = fakeOutput();
  const clock = clockAt(10);
  const p = playerOn(out, clock);
  const song = { secondsPerTick: 0.01, durationTicks: 1000, events: [
    { tick: 0, type: 'noteOn', channel: 0, note: 50, velocity: 90, duration: 5 },
    { tick: 400, type: 'programChange', channel: 0, program: 19 },
    { tick: 400, type: 'controller', channel: 0, controller: 7, value: 80 },
    { tick: 900, type: 'noteOn', channel: 0, note: 52, velocity: 90, duration: 5 },
  ] };
  p.play(song);
  const mark = out.log.length;
  clock.currentTime = 16;   // six seconds stalled: tick ~594
  p._pump();
  const told = out.log.slice(mark);
  assert.ok(told.some((m) => m[0] === 0xc0 && m[1] === 19 && m[2] === ms(16)), 'the program the gap held');
  assert.ok(told.some((m) => m[0] === 0xb0 && m[1] === 7 && m[2] === 57), 'and its volume, scaled (80 x sqrt 0.5)');
  assert.ok(!told.some((m) => m[0] === 0x90), 'no note from the past');
  p.stop();
});

test('MIDI-OUT1 the music service plays on the device picked: the pick moves a sounding song across, a device pulled out hands it back to the synth with the device left silent, and the latest pick wins over one the browser answered late (mutants: the pick not heard; the pulled device kept; the late answer winning)', async () => {
  fresh();
  _resetMidiOutForTests();
  const a = fakeOutput('Synth A'), b = fakeOutput('Synth B');
  const access = { outputs: new Map([[a.id, a], [b.id, b]]), onstatechange: null };
  let answer = null;
  const nav = { requestMIDIAccess: () => new Promise((res) => { answer = () => res(access); }) };
  const was = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true, writable: true });
  const svc = new MusicService();
  try {
    const war = Object.values(gateScoreSongs())[0];
    svc.registerSong('WAR', war);
    setMidiOut('Synth B');
    assert.equal(midiOutName(), 'Synth B');
    answer();   // the browser's answer, after the pick
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(svc.midiOut, b, 'the pick');
    assert.equal(svc.playSong('WAR'), true);
    const on = svc.player;
    assert.ok(on instanceof MidiOutSongPlayer && on.playing);
    assert.ok(b.log.some((m) => (m[0] & 0xf0) === 0x90), 'the song is on Synth B');
    const first = b.log.findIndex((m) => (m[0] & 0xf0) === 0x90 && m[2] > 0);
    assert.deepEqual([...new Set(b.log.slice(0, first).filter((m) => (m[0] & 0xf0) === 0xb0 && m[1] === 7).map((m) => m[2]))], [0],
      'it rises in: every channel at nothing before its first note, not struck at full and then dropped');
    setMidiOut('Synth A');
    setMidiOut('Synth B');   // a pick overtaken by the next before either is answered
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(svc.midiOut, b, 'the latest pick');
    assert.equal(a.log.length, 0, 'the overtaken pick never sounded');
    assert.equal(svc.player, on, 'and the song was never moved');
    b.state = 'disconnected';
    access.onstatechange({ port: { type: 'output' } });
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(svc.midiOut, null, 'pulled: the synth again');
    assert.ok(!(svc.player instanceof MidiOutSongPlayer));
    assert.ok(b.log.filter((m) => m[1] === 123).length >= 16, 'and the device left silent');
    assert.deepEqual((await midiOutputs()).map((o) => o.name), ['Synth A']);
    assert.equal(await findMidiOutput('Synth B'), null);
  } finally {
    svc.stop();
    svc._unsubscribeMidi();
    svc._unsubscribe();
    setMidiOut('');
    if (was) Object.defineProperty(globalThis, 'navigator', was); else delete globalThis.navigator;
    _resetMidiOutForTests();
  }
});

test('MIDI-OUT1 the row lives where a player looks for it - Settings > Audio > Music, after the instrument set (mutant: the row unmapped)', () => {
  const w = whereIs('port:midiOut');
  assert.deepEqual([w?.tab.id, w?.section.id], ['audio', 'music']);
  assert.deepEqual(w.section.items.slice(-2), ['Audio/SoundFont', 'port:midiOut']);
});

test('MIDI-OUT1 AUDIT: a key struck again while it still sounds is released just before the new strike, and the earlier note\'s own release is dropped - a note-off ends whichever note holds the key, so it would cut the later one (mutant: the overlap left to the earlier release)', () => {
  fresh();
  const out = fakeOutput();
  const p = playerOn(out, clockAt(10));
  p.play({ secondsPerTick: 0.01, durationTicks: 30, events: [
    { tick: 0, type: 'noteOn', channel: 2, note: 64, velocity: 90, duration: 20 },
    { tick: 5, type: 'noteOn', channel: 2, note: 64, velocity: 90, duration: 20 },
  ] });
  for (let t = 10; t < 10.6; t += 0.1) { p.ctx.currentTime = t; p._pump(); }
  const keys = out.log.filter((m) => m[0] === 0x92 || m[0] === 0x82).map((m) => [m[0], m[3]]);
  assert.deepEqual(keys, [[0x92, ms(10.06)], [0x82, ms(10.11)], [0x92, ms(10.11)], [0x82, ms(10.31)]],
    'on, released at the re-strike, struck, released at ITS end - not at the first note\'s 10.26');
  p.stop();
});

test('MIDI-OUT1 AUDIT: the row\'s next pick - each distinct device, then Off; two devices sharing a name do not trap the walk; a pick that is not connected steps to the first device that is (mutants: the walk by index; a pulled pick stepping to Off)', () => {
  const outs = [{ name: 'USB MIDI Interface' }, { name: 'USB MIDI Interface' }, { name: 'Synth B' }];
  assert.equal(nextMidiOut('', outs), 'USB MIDI Interface');
  assert.equal(nextMidiOut('USB MIDI Interface', outs), 'Synth B', 'past the second of the same name');
  assert.equal(nextMidiOut('Synth B', outs), '', 'then Off');
  assert.equal(nextMidiOut('Synth A', outs), 'USB MIDI Interface', 'a pulled pick steps to a device, not to Off');
  assert.equal(nextMidiOut('', []), '', 'nothing connected: Off stays Off');
  assert.equal(nextMidiOut('Synth A', []), '');
});

test('MIDI-OUT1 AUDIT: a stall re-sends each control\'s last value in the order those last values came - a bank select before the program it selects (mutant: the order each key was first seen)', () => {
  fresh();
  const out = fakeOutput();
  const clock = clockAt(10);
  const p = playerOn(out, clock);
  p.play({ secondsPerTick: 0.01, durationTicks: 1000, events: [
    { tick: 0, type: 'programChange', channel: 0, program: 1 },
    { tick: 300, type: 'controller', channel: 0, controller: 0, value: 8 },
    { tick: 301, type: 'programChange', channel: 0, program: 2 },
  ] });
  const mark = out.log.length;
  clock.currentTime = 16;
  p._pump();
  const told = out.log.slice(mark).filter((m) => m[0] === 0xc0 || (m[0] === 0xb0 && m[1] === 0)).map((m) => m.slice(0, -1));
  assert.deepEqual(told, [[0xb0, 0, 8], [0xc0, 2]]);
  p.stop();
});

test('MIDI-OUT1 AUDIT: a player with nothing sounding sends no quiet - its first song\'s own stop, or a second stop - and a stop after a song still does (mutant: the quiet burst on every stop)', () => {
  fresh();
  const out = fakeOutput();
  const p = playerOn(out, clockAt(10));
  p.play(SONG);
  assert.ok(!out.log.some((m) => m[1] === 123), 'the first play\'s stop silences nothing');
  p.stop();
  const once = out.log.filter((m) => m[1] === 123).length;
  assert.ok(once >= 16);
  p.stop();
  assert.equal(out.log.filter((m) => m[1] === 123).length, once, 'stopped twice is quieted once');
});

test('MIDI-OUT1 AUDIT: a song asked for before the first gesture plays as soon as a device is adopted - it waited for an AudioContext a device does not need - and a tab\'s Restore takes the pick back to Off through the door the music hears (mutants: the pending song left waiting; Restore writing the shelf alone)', async () => {
  fresh();
  _resetMidiOutForTests();
  const a = fakeOutput('Synth A');
  const access = { outputs: new Map([[a.id, a]]), onstatechange: null };
  const was = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: { requestMIDIAccess: async () => access }, configurable: true, writable: true });
  const svc = new MusicService();
  const heard = [];
  const off = onMidiOutChange((name) => heard.push(name));
  try {
    svc.registerSong('WAR', Object.values(gateScoreSongs())[0]);
    assert.equal(svc.playSong('WAR'), false, 'no context and no device: remembered');
    assert.equal(svc._pending, 'WAR');
    setMidiOut('Synth A');
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(svc._pending, null);
    assert.ok(svc.player instanceof MidiOutSongPlayer && svc.player.playing && a.log.some((m) => (m[0] & 0xf0) === 0x90), 'it plays on the device');
    heard.length = 0;
    globalThis.document = { createElement: () => { const n = { children: [], dataset: {}, classList: { add() {} }, append(...c) { n.children.push(...c); }, setAttribute() {} }; return n; } };
    try { restoreTabDefaults(CATEGORIES.find((c) => c.id === 'audio')); } finally { delete globalThis.document; }
    assert.equal(midiOutName(), '');
    assert.deepEqual(heard, [''], 'the music was told');
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(svc.midiOut, null, 'and left the device');
  } finally {
    off();
    svc.stop();
    svc._unsubscribeMidi();
    svc._unsubscribe();
    setMidiOut('');
    if (was) Object.defineProperty(globalThis, 'navigator', was); else delete globalThis.navigator;
    _resetMidiOutForTests();
  }
});
