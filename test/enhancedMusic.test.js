// EM1 - ENHANCED MUSIC: the composer, the palette, the door.
//
// Mac's call (2026-08-27): "for the enhanced version I'd like to put my
// own twists on things - implementing a procedural music system in
// addition to my own custom tracks", switched by the enhanced skin.
// This is OURS - Daggerfall has no generative music and DFU nothing to
// port - so the pins are about STRUCTURE and LAW, never about taste:
// a piece is deterministic, in its mode, in its registers, in the
// scheduler's own shape; the classic path is untouched; the gate is the
// skin. What it sounds like is Mac's ear and the palette record.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  seededRandom, hashSeed, SCALE_MODES, degreeToPitch, inMode, chordOnDegree, fitRegister, voiceLead, pickWeighted,
} from '../src/systems/enhancedMusic/theory.js';
import { MUSIC_PALETTES, paletteFor, TICKS_PER_BEAT, TICKS_PER_BAR, BARS_PER_SECTION } from '../src/systems/enhancedMusic/palettes.js';
import { composeScore } from '../src/systems/enhancedMusic/composer.js';
import { enhancedScore, cueSeed } from '../src/systems/enhancedMusic/index.js';
import { SongManager, MUSIC_ENV } from '../src/systems/songManager.js';
import { MusicService } from '../src/systems/music.js';
import { sustainIntervals, eventsInWindow } from '../src/systems/songPlayer.js';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const D = MUSIC_PALETTES.dungeonInterior;
const notesOf = (song) => song.events.filter((e) => e.type === 'noteOn');

// ── THEORY ────────────────────────────────────────────────────────
test('EM1 theory: the PRNG is seeded and ours, the modes are the modes', () => {
  const a = seededRandom(7), b = seededRandom(7), c = seededRandom(8);
  const ra = [a(), a(), a()], rb = [b(), b(), b()], rc = [c(), c(), c()];
  assert.deepEqual(ra, rb, 'same seed, same stream');
  assert.notDeepEqual(ra, rc);
  for (const r of ra) assert.ok(r >= 0 && r < 1);
  assert.equal(hashSeed('Privateer', 'Hold'), hashSeed('Privateer', 'Hold'));
  assert.notEqual(hashSeed('Privateer', 'Hold'), hashSeed('Hold', 'Privateer'), 'order matters');
  assert.notEqual(hashSeed('dungeon', 5), hashSeed('dungeon', 6));
  assert.deepEqual(SCALE_MODES.phrygian, [0, 1, 3, 5, 7, 8, 10]);
  assert.deepEqual(SCALE_MODES.aeolian, [0, 2, 3, 5, 7, 8, 10]);
  assert.equal(degreeToPitch(45, 'aeolian', 0), 45);
  assert.equal(degreeToPitch(45, 'aeolian', 7), 57, 'degree seven is the octave');
  assert.equal(degreeToPitch(45, 'aeolian', -1), 45 - 2, 'negative degrees wrap down');
  assert.deepEqual(chordOnDegree(45, 'aeolian', 0), [45, 48, 52], 'the minor triad on i');
  assert.deepEqual(chordOnDegree(45, 'aeolian', 5), [53, 57, 60], 'the major triad on VI');
  assert.deepEqual(chordOnDegree(45, 'aeolian', 0, { seventh: true }), [45, 48, 52, 55]);
  assert.ok(inMode(45, 'aeolian', 57 + 12) && !inMode(45, 'aeolian', 46));
  assert.equal(fitRegister(20, 40, 59), 44);
  assert.equal(fitRegister(80, 40, 59), 56);
  // Voice leading keeps common tones and moves the rest by the least.
  const prev = [45, 48, 52];
  const led = voiceLead(prev, [41, 45, 48], 40, 59);   // iv chord: F A C over A C E
  assert.deepEqual(led, [41, 45, 48]);
  const led2 = voiceLead([57, 60, 64], [45, 48, 52], 40, 59);
  for (const p of led2) assert.ok(p >= 40 && p <= 59, 'stays in the register');
  // Weighted pick honours zero weight.
  const r0 = seededRandom(1);
  for (let i = 0; i < 20; i++) assert.equal(pickWeighted(r0, [{ value: 'a', weight: 0 }, { value: 'b', weight: 1 }]), 'b');
});

// ── THE PALETTE IS A RECORD ───────────────────────────────────────
test('EM1 palette: one record per place, keyed by the director\'s own environment names', () => {
  assert.equal(paletteFor(MUSIC_ENV.DungeonInterior), D, 'the dungeon has a record');
  assert.equal(paletteFor(MUSIC_ENV.City), null, 'a place without one keeps its classic song');
  assert.equal(paletteFor('nonsense'), null);
  assert.equal(TICKS_PER_BEAT, 60, 'the HMI clock, so the scheduler needs no second time base');
  assert.equal(TICKS_PER_BAR, 240);
  assert.equal(BARS_PER_SECTION, 8);
  for (const [name, layer] of Object.entries(D.layers)) {
    assert.ok(layer.program >= 0 && layer.program <= 127, `${name} program is GM`);
    assert.ok(layer.register[0] < layer.register[1] && layer.register[1] - layer.register[0] >= 11, `${name} register spans an octave`);
    assert.ok(layer.velocity[0] >= 1 && layer.velocity[1] <= 127, `${name} velocity is MIDI`);
    assert.ok(layer.channel >= 0 && layer.channel <= 15 && layer.channel !== 9, `${name} is not on the percussion channel`);
  }
  const channels = Object.values(D.layers).map((l) => l.channel);
  assert.equal(new Set(channels).size, channels.length, 'one channel per layer');
  for (const [mode, rows] of Object.entries(D.progressions)) {
    assert.ok(SCALE_MODES[mode], `progressions for ${mode} name a mode`);
    for (const row of rows) assert.equal(row.length, BARS_PER_SECTION / D.barsPerChord, 'a row fills a section');
  }
  for (const m of D.modes) assert.ok(D.progressions[m.value], `${m.value} has progressions`);
  assert.doesNotMatch(read('src/systems/enhancedMusic/composer.js'), /'dungeonInterior'|dungeonInterior:/,
    'the composer knows no place by name - places are records');
});

// ── THE PIECE ─────────────────────────────────────────────────────
test('EM1 composer: the same seed composes the same piece; another seed another', () => {
  const seed = hashSeed('dungeon', 12345);
  const a = composeScore(D, seed), b = composeScore(D, seed);
  assert.deepEqual(a.events, b.events);
  assert.deepEqual(a.meta, b.meta);
  assert.equal(a.name, `enhanced:dungeonInterior:${seed >>> 0}`);
  const c = composeScore(D, hashSeed('dungeon', 12346));
  assert.notDeepEqual(c.events, a.events);
  // Pinned key/tempo, when a scored place hands its track's, are honoured.
  const pinned = composeScore(D, seed, { bpm: 60, root: 43, mode: 'aeolian' });
  assert.equal(pinned.meta.bpm, 60); assert.equal(pinned.meta.root, 43); assert.equal(pinned.meta.mode, 'aeolian');
  assert.throws(() => composeScore(D, seed, { mode: 'blues' }), /unknown mode/);
});

test('EM1 composer: every piece is the scheduler\'s shape, in its mode, in its registers - 200 seeds', () => {
  for (let i = 0; i < 200; i++) {
    const song = composeScore(D, hashSeed('sweep', i));
    const { root, mode, bpm } = song.meta;
    assert.ok(bpm >= D.tempo[0] && bpm <= D.tempo[1]);
    assert.ok(D.modes.some((m) => m.value === mode));
    assert.ok(root >= D.roots[0] && root <= D.roots[1]);
    assert.equal(song.secondsPerTick, 1 / bpm, 'the HMI clock: one tick is 1/BPM');
    assert.equal(song.durationTicks, TICKS_PER_BAR * BARS_PER_SECTION * D.form.length, 'the loop is the form');
    // The scheduler's own helpers accept it as they accept an archive song.
    assert.ok(sustainIntervals(song.events));
    assert.ok(eventsInWindow(song.events, 0, song.durationTicks).length > 0);
    // Sorted, program before note at a tick, every note legal and inside the loop.
    let last = -1;
    for (const e of song.events) { assert.ok(e.tick >= last); last = e.tick; }
    const byChannel = {};
    for (const n of notesOf(song)) {
      assert.ok(n.note >= 0 && n.note <= 127 && n.velocity >= 1 && n.velocity <= 127 && n.duration > 0);
      assert.ok(n.tick + n.duration <= song.durationTicks, 'no note runs past the loop');
      assert.ok(inMode(root, mode, n.note), `${n.note} is in ${mode} on ${root}`);
      const layer = Object.values(D.layers).find((l) => l.channel === n.channel);
      assert.ok(layer, 'every note is on a layer channel');
      assert.ok(n.note >= layer.register[0] && n.note <= layer.register[1], `in ${layer.program}'s register`);
      (byChannel[n.channel] ??= []).push(n);
    }
    for (const layer of Object.values(D.layers)) {
      assert.ok(song.events.some((e) => e.type === 'programChange' && e.channel === layer.channel && e.program === layer.program && e.tick === 0),
        'each layer declares its program at the top');
      assert.ok(byChannel[layer.channel]?.length > 0, 'each layer plays');
    }
    // The bass says the chord root on every downbeat, and the bed holds every chord.
    const bars = BARS_PER_SECTION * D.form.length;
    for (let bar = 0; bar < bars; bar++) {
      assert.ok(byChannel[D.layers.bass.channel].some((n) => n.tick === bar * TICKS_PER_BAR), `bass on bar ${bar}'s downbeat`);
    }
    const chordStarts = new Set(byChannel[D.layers.bed.channel].map((n) => n.tick));
    assert.equal(chordStarts.size, bars / D.barsPerChord, 'one voicing per chord');
    // The motif rests: it does not speak on every chord.
    const motifStarts = new Set(byChannel[D.layers.motif.channel].map((n) => Math.floor(n.tick / (TICKS_PER_BAR * D.barsPerChord))));
    assert.ok(motifStarts.size < bars / D.barsPerChord, 'silence is a layer');
    // The bell turns B and the last section, on the root.
    const bells = byChannel[D.layers.color.channel];
    assert.equal(bells.length, 2);
    for (const b of bells) assert.equal(((b.note - root) % 12 + 12) % 12, 0, 'the bell is the tonic');
  }
});

// ── THE DOOR ──────────────────────────────────────────────────────
test('EM1 door: the enhanced skin composes for a place with a palette, and nothing else changes', () => {
  const dungeon = { environment: MUSIC_ENV.DungeonInterior, dungeonKey: 4242, gameDays: 3, locationIndex: 7 };
  const city = { environment: MUSIC_ENV.City, gameDays: 3, locationIndex: 7, dungeonKey: null };
  assert.equal(enhancedScore(dungeon, { enhanced: false }), null, 'classic skin: null, the classic song plays');
  assert.equal(enhancedScore(city, { enhanced: true }), null, 'no palette, no track yet: null, the classic song plays');
  assert.equal(enhancedScore(null, { enhanced: true }), null);
  const s = enhancedScore(dungeon, { enhanced: true });
  assert.ok(s?.song?.events?.length, 'enhanced skin + a palette: a composed piece');
  assert.equal(s.track?.id, 'dungeon', '...and the dungeon has Mac\'s track (EM2c)');
  // The seed law: a dungeon composes on its own key across days and visits...
  assert.equal(cueSeed(dungeon), cueSeed({ ...dungeon, gameDays: 99, locationIndex: 1 }));
  assert.notEqual(cueSeed(dungeon), cueSeed({ ...dungeon, dungeonKey: 4243 }));
  // ...everywhere else on the place and the day (DFU's daily song).
  assert.equal(cueSeed(city), cueSeed({ ...city }));
  assert.notEqual(cueSeed(city), cueSeed({ ...city, gameDays: 4 }), 'a new day, a new piece');
  assert.notEqual(cueSeed(city), cueSeed({ ...city, locationIndex: 8 }), 'a new town, a new piece');
});

test('EM1 door: the director asks the enhanced side through its play sink, with the manager\'s context', () => {
  // The manager decides the cue as before; the sink sees the context it
  // decided for. Driven the way shared.createMusicDirector wires it.
  const played = [];
  let manager = null;
  manager = new SongManager({
    play: (name) => {
      const score = enhancedScore(manager.currentContext, { enhanced: true });
      played.push(score ? `${score.track?.id ?? '-'}+${score.song?.name ?? '-'}` : `classic:${name}`);
    },
    stop: () => played.push('stop'),
  });
  manager.update({ environment: MUSIC_ENV.DungeonInterior, dungeonKey: 77, gameDays: 1, locationIndex: 3 });
  assert.match(played[0], /^dungeon\+enhanced:dungeonInterior:\d+$/, 'in a dungeon: Mac\'s track with the piece under it');
  manager.update({ environment: MUSIC_ENV.City, gameDays: 1, locationIndex: 3, dungeonKey: null });
  assert.match(played[1], /^classic:/, 'in the city the classic song plays - no palette yet');
  assert.match(read('src/scenes/shared.js'), /const score = enhancedScore\(manager\?\.currentContext\);/, 'the real sink does this');
  assert.match(read('src/scenes/shared.js'), /score \? music\.playEnhanced\(score\) : music\.playFrom\(\[name\], \{ gameDays: 0 \}\)/);
});

test('EM1 service: playScore plays a composed song through the one scheduler, and needs no archive', () => {
  const svc = new MusicService();
  const calls = [];
  svc.player = { play: (song) => { calls.push(song.name); return true; }, stop: () => calls.push('stop'), playing: false };
  svc._audio = { stop: () => calls.push('audio-stop'), playing: false };
  const song = composeScore(D, hashSeed('svc'));
  assert.equal(svc.enabled, false, 'no MIDI.BSA loaded');
  assert.equal(svc.playScore(song), true, 'a composed piece does not consult the archive');
  assert.deepEqual(calls, ['audio-stop', song.name], 'the replacement player is silenced, the scheduler plays');
  assert.equal(svc.current, song.name);
  svc.player.playing = true;
  assert.equal(svc.playScore(song), true);
  assert.equal(calls.length, 2, 'idempotent per piece');
  assert.equal(svc.playScore(null), false);
  assert.equal(svc.playScore({ events: [] }), false);
  // No context yet: pended, and the gesture hook knows a song from a name.
  const cold = new MusicService();
  assert.equal(cold.playScore(song), false);
  assert.equal(cold._pending, song);
  assert.match(read('src/systems/music.js'), /if \(typeof p === 'string'\) \{ if \(this\.playSong\(p\)\) this\._pending = null; return; \}/);
  assert.match(read('src/systems/music.js'), /if \(p\.file\) \{ this\.playTrack\(p\)/, 'a pending TRACK is replayed too (EM2a)');
  assert.match(read('src/systems/music.js'), /if \(this\.playScore\(p\)\) this\._pending = null;/);
});

// ── EM2a: THE TITLE THEME - Mac's first track, streamed ────────────
import { TrackPlayer, DEFAULT_FADE_SECONDS } from '../src/systems/enhancedMusic/trackPlayer.js';
import { TITLE_THEME, PLACE_SCORES, scoreFor } from '../src/systems/enhancedMusic/scores.js';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

/** A fake AudioContext: gain nodes that record their ramps, a media
 *  source that records connections, a clock. */
function fakeCtx() {
  const log = [];
  const param = (name) => ({
    value: 0,
    setValueAtTime(v, t) { log.push([name, 'set', v, t]); this.value = v; },
    linearRampToValueAtTime(v, t) { log.push([name, 'ramp', v, t]); this.value = v; },
    cancelScheduledValues(t) { log.push([name, 'cancel', t]); },
  });
  return {
    currentTime: 10, destination: { id: 'dest' }, log,
    createGain() { const g = { gain: param('gain'), connect: (to) => log.push(['gain->', to.id ?? 'node']) }; return g; },
    createMediaElementSource(el) { log.push(['source', el.src]); return { connect: (to) => log.push(['source->gain']), disconnect: () => log.push(['source-disconnect']) }; },
  };
}
const fakeElement = (behaviour = 'plays') => (src) => ({
  src, loop: false, paused: true, preload: '',
  play() { if (behaviour === 'refuses') return Promise.reject(new Error('NotAllowedError: gesture')); this.paused = false; return Promise.resolve(); },
  pause() { this.paused = true; },
});

test('EM2a scores: the title theme is Mac\'s file, tracked, allow-listed, reachable from the game page', () => {
  assert.equal(TITLE_THEME.id, 'title');
  assert.equal(TITLE_THEME.loop, true, 'the door\'s theme loops until the game takes over');
  assert.match(TITLE_THEME.file, /^\.\.\/music\/enhanced\/[\w-]+\.mp3$/, 'relative to /play/, one directory under the site root, MP3');
  const onDisk = 'public/' + TITLE_THEME.file.replace(/^\.\.\//, '');
  assert.ok(existsSync(new URL('../' + onDisk, import.meta.url)), `${onDisk} exists`);
  const tracked = execFileSync('git', ['ls-files', 'public/music'], { encoding: 'utf8' }).split('\n');
  assert.ok(tracked.includes(onDisk), `${onDisk} is tracked`);
  assert.ok(read('test/doctrine.test.js').includes(`['${onDisk}', "OURS - `), 'and on the doctrine allow-list as OURS');
  // EM2c: every scored place is a tracked, allow-listed MP3 reachable from /play/.
  for (const [env, rec] of Object.entries(PLACE_SCORES)) {
    assert.ok(MUSIC_ENV[Object.keys(MUSIC_ENV).find((k) => MUSIC_ENV[k] === env)], `${env} is a director environment`);
    assert.match(rec.file, /^\.\.\/music\/enhanced\/[\w-]+\.mp3$/);
    const f = 'public/' + rec.file.replace(/^\.\.\//, '');
    assert.ok(tracked.includes(f), `${f} is tracked`);
    assert.ok(read('test/doctrine.test.js').includes(`['${f}', "OURS - `), `${f} is allow-listed as OURS`);
    if (rec.root !== undefined) assert.ok(rec.root >= 0 && rec.root <= 127 && SCALE_MODES[rec.mode], `${env} names a real key`);
  }
  assert.equal(scoreFor(MUSIC_ENV.DungeonInterior)?.id, 'dungeon');
  assert.equal(scoreFor(MUSIC_ENV.City), null);
});

test('EM2a track player: streams through a media source into a ramped gain, fades under, never throws', async () => {
  const ctx = fakeCtx();
  const tp = new TrackPlayer(ctx, { gain: () => 0.5, createElement: fakeElement() });
  assert.equal(await tp.play(TITLE_THEME), true);
  assert.equal(tp.playing, true);
  assert.equal(tp.element.loop, true);
  assert.equal(tp.element.paused, false, 'the element plays');
  assert.deepEqual(ctx.log.filter((l) => l[0] === 'source'), [['source', TITLE_THEME.file]], 'one media source, on the file');
  assert.ok(ctx.log.some((l) => l[0] === 'gain' && l[1] === 'ramp' && l[2] === 1), 'the LAYER ramps to the record gain (the master carries the setting)');
  assert.equal(tp.master.gain.value, 0.5, 'the master is the setting');
  assert.equal(await tp.play(TITLE_THEME), true, 'idempotent per track');
  assert.equal(ctx.log.filter((l) => l[0] === 'source').length, 1, 'no second source');
  const el = tp.element;
  tp.fadeOut(0);
  assert.equal(tp.playing, false);
  assert.equal(el.paused, true, 'faded out at 0s pauses now');
  assert.equal(tp.element, null);
  assert.ok(ctx.log.some((l) => l[0] === 'gain' && l[1] === 'ramp' && l[2] === 0), 'the fade is a ramp to zero on the layer, never the element');
  assert.equal(tp.master.gain.value, 0.5, 'the master did not move for a fade');
  assert.equal(DEFAULT_FADE_SECONDS, 3);
  // The gesture rule: a refused play leaves the element armed and reports false.
  const shy = new TrackPlayer(fakeCtx(), { gain: () => 1, createElement: fakeElement('refuses') });
  assert.equal(await shy.play(TITLE_THEME), false);
  assert.equal(shy.playing, false);
  assert.ok(shy.element, 'still armed');
  // No context: nothing to do, no throw.
  assert.equal(await new TrackPlayer(null).play(TITLE_THEME), false);
});

test('EM2a service: playTrack needs a clock and no archive, pends on refusal, and the game\'s music fades it under', async () => {
  const svc = new MusicService();
  // Node has no window: no clock, so the request is refused honestly.
  assert.equal(await svc.playTrack(TITLE_THEME), false);
  assert.equal(svc.enabled, false, 'MIDI.BSA was never consulted');
  // With a track sounding, the composed piece fades it under rather than cutting it.
  const fades = [];
  svc._track = { playing: true, fadeOut: (s) => fades.push(s ?? 'default'), stop: () => fades.push('stop') };
  svc.player = { play: () => true, stop: () => {}, playing: false, setTrim: () => {} };
  assert.equal(svc.playScore(composeScore(D, hashSeed('x'))), true);
  assert.deepEqual(fades, ['default'], 'faded, with the default fade');
  assert.equal(svc.playing, true, 'a sounding track counts as playing for the director');
  svc.stop();
  assert.ok(fades.includes('stop'), 'stop stops the track too');
  // The wiring: the enhanced door plays it before the menu, un-awaited.
  const main = read('src/main.js');
  assert.match(main, /music\.playEnhanced\(\{ track: TITLE_THEME, song: null \}\);\s*\n\s*status\('main menu'\);/, 'the theme is asked for before the menu shows, alone');
  assert.match(read('src/systems/audio.js'), /ensureClock\(\) \{/, 'a clock without the archives');
  const src = read('src/systems/music.js');
  for (const door of ['  _playBuiltIn(name) {', '  async _startReplacement(name) {', '  playScore(song, { under = false } = {}) {']) {
    const at = src.indexOf(door);
    assert.ok(at >= 0, `${door.trim()} exists`);
    assert.match(src.slice(at, at + 1600), /this\._fadeTrackUnder\(\);/, `${door.trim()} fades the track under`);
  }
});

// ── EM2b: THE LEVEL, AND THE SETTING THAT MOVES IT ────────────────
// Mac, on the menu: "the menu music is too low with audio and needs to
// work with the settings option." Two roots: the track took the FM
// synth's trim (MUSIC_GAIN 0.22, there because raw oscillators sum hot)
// on top of the setting - a mastered theme at a ninth of its level -
// and MusicVolume was LIVE only in tier: read once per player, never
// again, so a looping theme never heard the slider.
import { setValue, onSettingChange, _resetForTests } from '../src/systems/settings.js';
import { musicGain, trackGain, MUSIC_GAIN, SongPlayer, AudioSongPlayer } from '../src/systems/songPlayer.js';

test('EM2b level: a track takes the setting alone; the synth keeps its trim', () => {
  _resetForTests();
  setValue('Controls', 'MusicVolume', 0.5);
  assert.equal(trackGain(), 0.5, 'the setting, straight');
  assert.equal(musicGain(), MUSIC_GAIN * 0.5, 'the classic songs keep MUSIC_GAIN under the setting');
  assert.ok(trackGain() / musicGain() > 4, 'the theme is no longer a ninth of itself');
  assert.match(read('src/systems/music.js'), /new TrackPlayer\(ctx, \{ gain: trackGain \}\)/, 'the service builds the track player on trackGain');
  _resetForTests();
});

test('EM2b live: a settings write is published once, and the service re-levels every player', () => {
  _resetForTests();
  const seen = [];
  const off = onSettingChange((sec, key, str) => seen.push(`${sec}/${key}=${str}`));
  setValue('Controls', 'MusicVolume', 0.8);
  assert.deepEqual(seen, ['Controls/MusicVolume=0.8']);
  setValue('Controls', 'MusicVolume', 0.5);   // back to the default: still published, as the default's string
  assert.equal(seen[1], 'Controls/MusicVolume=0.5');
  off();
  setValue('Controls', 'MusicVolume', 0.3);
  assert.equal(seen.length, 2, 'unsubscribed');
  // A listener that throws is skipped, and the write still lands.
  const off2 = onSettingChange(() => { throw new Error('bad listener'); });
  setValue('Controls', 'MusicVolume', 0.4);
  assert.equal(trackGain(), 0.4);
  off2();

  // The service: three players, one setting, one ramp each.
  const svc = new MusicService();
  const calls = [];
  svc.player = { resyncGain: () => calls.push('song') };
  svc._audio = { resyncGain: () => calls.push('replacement') };
  svc._track = { resyncGain: () => calls.push('track') };
  setValue('Controls', 'MusicVolume', 0.6);
  assert.deepEqual(calls, ['song', 'replacement', 'track']);
  setValue('Controls', 'SoundVolume', 0.9);
  assert.equal(calls.length, 3, 'another key does not touch the music');
  svc._unsubscribe();
  _resetForTests();
});

test('EM2b live: each player\'s resyncGain ramps its master to the setting now', () => {
  _resetForTests();
  const ctx = fakeCtx();
  // The scheduler's master is created on _ensureMaster; ramp to musicGain.
  const sp = new SongPlayer(ctx); sp._ensureMaster();
  setValue('Controls', 'MusicVolume', 0.7);
  sp.resyncGain();
  const last = ctx.log.filter((l) => l[0] === 'gain' && l[1] === 'ramp').pop();
  assert.ok(Math.abs(last[2] - MUSIC_GAIN * 0.7) < 1e-9, 'the scheduler ramps to MUSIC_GAIN x the setting (trim 1 alone)');
  assert.ok(last[3] - ctx.currentTime <= 0.06, 'a short ramp, not a zipper');
  const ap = new AudioSongPlayer(ctx); ap._ensureMaster(); ap.resyncGain();
  assert.ok(Math.abs(ctx.log.filter((l) => l[0] === 'gain' && l[1] === 'ramp').pop()[2] - 0.7) < 1e-9, 'a replacement pack takes the setting alone (EM2c, "fix it also")');
  // The track: the setting times the record's gain, no trim.
  const tp = new TrackPlayer(ctx, { gain: trackGain, createElement: fakeElement() });
  return tp.play({ id: 't', file: 'x.mp3', gain: 0.9 }).then(() => {
    setValue('Controls', 'MusicVolume', 1);
    tp.resyncGain();
    const l = ctx.log.filter((x) => x[0] === 'gain' && x[1] === 'ramp').pop();
    assert.ok(Math.abs(l[2] - 1) < 1e-9, 'the master ramps to the setting; the layer keeps the record gain');
    _resetForTests();
  });
});

// ── EM2c: THE DUNGEON TRACK, THE UNDERSCORE, THE CROSSFADE ────────
import { UNDERSCORE_TRIM } from '../src/systems/enhancedMusic/scores.js';

test('EM2c door: a scored place composes its piece IN THE TRACK\'S KEY; a track without a key plays alone', () => {
  const dungeon = { environment: MUSIC_ENV.DungeonInterior, dungeonKey: 9, gameDays: 1, locationIndex: 2 };
  const s = enhancedScore(dungeon, { enhanced: true });
  assert.equal(s.track.id, 'dungeon');
  assert.equal(s.song.meta.root, s.track.root, 'the piece is composed on the track\'s root');
  assert.equal(s.song.meta.mode, s.track.mode, '...and in its mode');
  assert.ok(notesOf(s.song).every((n) => inMode(s.track.root, s.track.mode, n.note)), 'every underscore note is in the track\'s key');
  // The seed law still holds under a track: same dungeon, same piece.
  const again = enhancedScore({ ...dungeon, gameDays: 40 }, { enhanced: true });
  assert.deepEqual(again.song.events, s.song.events);
});

test('EM2c service: playEnhanced plays the track with the piece trimmed under it, or either alone', () => {
  const svc = new MusicService();
  const log = [];
  svc.player = { play: (song) => { log.push(`song:${song.name}`); svc.player.playing = true; return true; }, stop: () => log.push('song-stop'), playing: false, setTrim: (t) => log.push(`trim:${t}`) };
  svc._audio = { stop: () => {}, playing: false };
  // no clock in node: playTrack refuses, but the underscore half still runs; drive the track through a fake player instead
  svc._track = { playing: false, track: null, play: async (t) => { log.push(`track:${t.id}`); svc._track.playing = true; svc._track.track = t; return true; }, fadeOut: () => log.push('track-fade'), stop: () => {} };
  const song = composeScore(D, hashSeed('u'));
  // Since playTrack needs audio.ensureClock (no window here), assert the composition of the call through a subclass hook.
  svc.playTrack = async (t) => svc._track.play(t);
  assert.equal(svc.playEnhanced({ track: { id: 'dungeon', file: 'x.mp3' }, song }), true);
  assert.deepEqual(log, ['track:dungeon', `trim:${UNDERSCORE_TRIM}`, `song:${song.name}`], 'track first, then the piece under it at the underscore trim');
  assert.ok(!log.includes('track-fade'), 'the piece under a track does NOT fade the track');
  log.length = 0;
  assert.equal(svc.playEnhanced({ track: { id: 'dungeon', file: 'x.mp3' }, song }), true);
  assert.deepEqual(log, ['track:dungeon', `trim:${UNDERSCORE_TRIM}`], 'idempotent: the same track and piece do not restart');
  log.length = 0;
  svc._current = null;
  assert.equal(svc.playEnhanced({ track: null, song }), true);
  assert.deepEqual(log, ['track-fade', 'trim:1', `song:${song.name}`], 'a piece alone fades the track out and plays at full trim');
  log.length = 0;
  assert.equal(svc.playEnhanced({ track: { id: 'title', file: 't.mp3' }, song: null }), true);
  assert.deepEqual(log, ['track:title', 'song-stop'], 'a track alone stops the scheduler');
  assert.equal(svc.playEnhanced(null), false);
  assert.ok(UNDERSCORE_TRIM > 0 && UNDERSCORE_TRIM < 1);
});

test('EM2c player: a second track crossfades - the old layer ramps out, the new ramps in, the master stays', async () => {
  const ctx = fakeCtx();
  const timers = [];
  const tp = new TrackPlayer(ctx, { gain: () => 0.6, createElement: fakeElement(), schedule: (fn, ms) => timers.push([fn, ms]) });
  await tp.play({ id: 'a', file: 'a.mp3', gain: 1 });
  const first = tp.element;
  ctx.log.length = 0;
  await tp.play({ id: 'b', file: 'b.mp3', gain: 0.8 }, { fadeIn: 2 });
  assert.equal(tp.track.id, 'b');
  assert.equal(tp.playing, true);
  assert.equal(first.paused, false, 'the old element keeps playing while it fades');
  assert.equal(tp.retiring, 1, 'one layer retiring');
  const ramps = ctx.log.filter((l) => l[0] === 'gain' && l[1] === 'ramp').map((l) => l[2]);
  assert.deepEqual(ramps, [0, 0.8], 'the old layer to 0, the new layer to its record gain');
  assert.ok(!ctx.log.some((l) => l[0] === 'gain' && l[1] === 'ramp' && l[2] === 0.6), 'the master (the setting) is not ramped by a crossfade');
  assert.equal(ctx.log.filter((l) => l[0] === 'source').length, 1, 'one new media source');
  assert.equal(timers.length, 1);
  assert.equal(timers[0][1], DEFAULT_FADE_SECONDS * 1000 + 50, 'the old layer is torn down after its fade');
  timers[0][0]();
  assert.equal(first.paused, true, '...and then paused');
  assert.equal(tp.retiring, 0);
});
