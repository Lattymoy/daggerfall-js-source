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
  assert.equal(enhancedScore(city, { enhanced: true }), null, 'no palette yet: null, the classic song plays');
  assert.equal(enhancedScore(null, { enhanced: true }), null);
  const s = enhancedScore(dungeon, { enhanced: true });
  assert.ok(s?.events?.length, 'enhanced skin + a palette: a composed piece');
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
      played.push(score ? score.name : `classic:${name}`);
    },
    stop: () => played.push('stop'),
  });
  manager.update({ environment: MUSIC_ENV.DungeonInterior, dungeonKey: 77, gameDays: 1, locationIndex: 3 });
  assert.match(played[0], /^enhanced:dungeonInterior:\d+$/, 'in a dungeon the piece is composed');
  manager.update({ environment: MUSIC_ENV.City, gameDays: 1, locationIndex: 3, dungeonKey: null });
  assert.match(played[1], /^classic:/, 'in the city the classic song plays - no palette yet');
  assert.match(read('src/scenes/shared.js'), /const score = enhancedScore\(manager\?\.currentContext\);/, 'the real sink does this');
  assert.match(read('src/scenes/shared.js'), /score \? music\.playScore\(score\) : music\.playFrom\(\[name\], \{ gameDays: 0 \}\)/);
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
  assert.match(read('src/systems/music.js'), /typeof p === 'string' \? this\.playSong\(p\) : this\.playScore\(p\)/);
});
