// A5 MUSIC. Two halves with two different standards of proof, and the
// split is the point.
//
// songManager.js is a PORT: SongManager.cs's playlists and
// SelectCurrentSong. Those pins assert DFU's arrays and DFU's algorithm,
// and they are as strict as any other port pin here.
//
// gmSynth.js is OURS: DFU ships its own SoundFont, so there is nothing to
// be right against. A pin asserting "program 48 is a sawtooth" would
// assert my own taste back at me - the vacuous-pin shape two audits have
// now caught in this repo. So the synth pins assert STRUCTURE instead:
// every GM program resolves, families land where General MIDI says, and
// nothing can put a NaN or an out-of-range value into the audio graph.
//
// songPlayer.js's scheduling math is pure and pinned directly; only
// _voice touches WebAudio and the suite has no AudioContext, so that is
// covered by tools/musicProbe.mjs (measures real RMS in a browser) and
// tools/musicRender.mjs (renders a WAV through the same _voice).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  noteToHz, voiceSpec, percussionSpec, velocityGain, panPosition, bendCents,
  GM_FAMILIES, PERCUSSION_CHANNEL,
} from '../src/systems/gmSynth.js';
import {
  DUNGEON_SONGS, DUNGEON_SONGS_FM, SUNNY_SONGS, OVERCAST_SONGS, RAIN_SONGS,
  SNOW_SONGS, TAVERN_SONGS, NIGHT_SONGS, SNEAKING_SONGS_FM,
  TEMPLE_GOOD_SONGS, TEMPLE_NEUTRAL_SONGS, TEMPLE_BAD_SONGS,
  selectSong, dungeonKey,
} from '../src/systems/songManager.js';
import {
  eventsInWindow, applyChannelEvents, freshChannelState, LOOKAHEAD_SECONDS, TICK_INTERVAL_MS,
} from '../src/systems/songPlayer.js';
import { MidiBsaFile } from '../src/formats/hmiFile.js';
import { srand, rand } from '../src/formats/dfRandom.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

// --- the PORT half -------------------------------------------------------

test('A5: SongManager playlists are DFU\'s arrays, in DFU\'s order', () => {
  // Spot-checked against SongManager.cs:666-881 whole, not sampled - a
  // sampled table pin lets a drifted row through, which is the 17d lesson.
  assert.deepEqual([...DUNGEON_SONGS], [
    'DUNGEON.HMI', 'DUNGEON5.HMI', 'DUNGEON6.HMI', 'DUNGEON7.HMI', 'DUNGEON8.HMI',
    'DUNGEON9.HMI', 'GDNGN10.HMI', 'GDNGN11.HMI', 'GDUNGN4.HMI', 'GDUNGN9.HMI',
    '04.HMI', '05.HMI', '07.HMI', '15.HMI', '28.HMI',
  ]);
  assert.deepEqual([...OVERCAST_SONGS], ['29.HMI', '12.HMI', '13.HMI', 'GPALAC.HMI', 'OVERCAST.HMI']);
  assert.deepEqual([...RAIN_SONGS], ['OVERLONG.HMI', 'RAINING.HMI', '08.HMI']);
  assert.deepEqual([...SNOW_SONGS], ['20.HMI', 'GSNOW__B.HMI', 'OVERSNOW.HMI', 'SNOWING.HMI']);
  assert.deepEqual([...TAVERN_SONGS], ['SQUARE_2.HMI', 'TAVERN.HMI', 'FOLK1.HMI', 'FOLK2.HMI', 'FOLK3.HMI']);
  assert.deepEqual([...NIGHT_SONGS], ['10.HMI', '11.HMI', 'GCURSE.HMI', 'GEERIE.HMI', 'GRUINS.HMI', '18.HMI', '21.HMI']);
  // The single-entry temple lists exist so the selection can be pinned
  // against a list of one, which must NOT touch the generator.
  assert.deepEqual([...TEMPLE_GOOD_SONGS], ['GGOOD.HMI']);
  assert.deepEqual([...TEMPLE_NEUTRAL_SONGS], ['GNEUT.HMI']);
  assert.deepEqual([...TEMPLE_BAD_SONGS], ['GBAD.HMI']);
});

test('A5: DFU\'s DUPLICATE entries are preserved - they change the odds', () => {
  // SongManager.cs:817-840 lists song_fm_dngn1 twice and song_15fm twice;
  // :873-881 lists song_fsneak2 twice. De-duplicating would silently
  // halve those songs' selection probability, so the duplicates are law.
  const count = (arr, name) => arr.filter((n) => n === name).length;
  assert.equal(count(DUNGEON_SONGS_FM, 'FM_DNGN1.HMI'), 2, 'FM_DNGN1 appears twice in DFU');
  assert.equal(count(DUNGEON_SONGS_FM, '15FM.HMI'), 2, '15FM appears twice in DFU');
  assert.equal(count(SNEAKING_SONGS_FM, 'FSNEAK2.HMI'), 2, 'FSNEAK2 appears twice in DFU');
  assert.equal(DUNGEON_SONGS_FM.length, 15);
  assert.equal(SNEAKING_SONGS_FM.length, 7);
});

test('A5: SelectCurrentSong is DFU\'s algorithm, arm by arm', () => {
  // TAVERN: gameDays modulo the length, DIRECTLY - no generator at all,
  // so taverns walk in sequence day to day (SongManager.cs:342-345).
  for (let d = 0; d < 12; d++) {
    assert.equal(selectSong(TAVERN_SONGS, { gameDays: d, tavern: true }).index,
      d % TAVERN_SONGS.length, `tavern day ${d} walks in sequence`);
  }

  // DUNGEON: DFRandom seeded with the block key (:353-357).
  const key = dungeonKey(0x1234, 17);
  srand(key);
  const expected = rand() % DUNGEON_SONGS.length;
  assert.equal(selectSong(DUNGEON_SONGS, { dungeonKey: key }).index, expected);

  // EVERYTHING ELSE: DFRandom seeded with gameDays (:369-374), so a
  // location's song is stable all day and changes at midnight.
  srand(93);
  const dayPick = rand() % OVERCAST_SONGS.length;
  assert.equal(selectSong(OVERCAST_SONGS, { gameDays: 93 }).index, dayPick);
  assert.equal(selectSong(OVERCAST_SONGS, { gameDays: 93 }).index, dayPick, 'stable within a day');

  // A LIST OF ONE returns index 0 WITHOUT consuming the generator - the
  // `currentPlaylist.Length > 1` guard (:368). If it seeded, entering a
  // temple would shift every later roll in the session.
  srand(5);
  const before = rand();
  srand(5);
  assert.equal(selectSong(TEMPLE_GOOD_SONGS, { gameDays: 999 }).index, 0);
  assert.equal(rand(), before, 'a one-song list left DFRandom untouched');
});

test('A5: selection never returns an out-of-range or absent song', () => {
  assert.equal(selectSong([], { gameDays: 3 }), null);
  assert.equal(selectSong(null, { gameDays: 3 }), null);
  for (const list of [DUNGEON_SONGS, SUNNY_SONGS, TAVERN_SONGS, NIGHT_SONGS]) {
    for (let d = 0; d < 200; d++) {
      const p = selectSong(list, { gameDays: d, tavern: list === TAVERN_SONGS });
      assert.ok(p.index >= 0 && p.index < list.length, `${d} in range`);
      assert.equal(p.name, list[p.index]);
    }
  }
});

test('A5: dungeonKey is unknown2 XOR (region << 8), verbatim', () => {
  assert.equal(dungeonKey(0, 0), 0);
  assert.equal(dungeonKey(0x00ff, 0), 0x00ff);
  assert.equal(dungeonKey(0, 1), 0x0100);
  assert.equal(dungeonKey(0x1234, 17), (0x1234 ^ (17 << 8)) >>> 0);
  // The region is masked to a BYTE, as DFU's (byte) cast does.
  assert.equal(dungeonKey(0, 0x101), dungeonKey(0, 1), 'region takes the low byte only');
});

test('A5: every playlist names songs that EXIST in MIDI.BSA', { skip: skipReal }, () => {
  // The tables were typed from DFU's enum spellings into the archive's
  // record names. A typo would be a song that silently never plays, so
  // every name in every list is resolved against the real archive.
  const bsa = new MidiBsaFile();
  bsa.load(new Uint8Array(readFileSync(join(ARENA2, 'MIDI.BSA'))));
  const lists = {
    DUNGEON_SONGS, DUNGEON_SONGS_FM, SUNNY_SONGS, OVERCAST_SONGS, RAIN_SONGS,
    SNOW_SONGS, TAVERN_SONGS, NIGHT_SONGS, SNEAKING_SONGS_FM,
    TEMPLE_GOOD_SONGS, TEMPLE_NEUTRAL_SONGS, TEMPLE_BAD_SONGS,
  };
  const missing = [];
  for (const [label, list] of Object.entries(lists)) {
    for (const name of list) {
      const i = bsa.getSongIndex(name);
      if (i === null || i === undefined || i < 0) missing.push(`${label}: ${name}`);
    }
  }
  assert.deepEqual(missing, [], 'every playlist entry resolves to a real record');
});

test('A5: the selected song actually DECODES', { skip: skipReal }, () => {
  // A name that resolves but whose song throws is the same silence as a
  // typo. Decode one pick from each list end to end.
  const bsa = new MidiBsaFile();
  bsa.load(new Uint8Array(readFileSync(join(ARENA2, 'MIDI.BSA'))));
  for (const list of [DUNGEON_SONGS, TAVERN_SONGS, NIGHT_SONGS, RAIN_SONGS]) {
    const picked = selectSong(list, { gameDays: 11, tavern: list === TAVERN_SONGS });
    const song = bsa.getSong(bsa.getSongIndex(picked.name));
    assert.ok(song.events.length > 0, `${picked.name} has events`);
    assert.ok(song.durationSeconds > 0, `${picked.name} has a duration`);
    assert.ok(song.secondsPerTick > 0 && Number.isFinite(song.secondsPerTick));
  }
});

// --- the SCHEDULER half --------------------------------------------------

test('A5: the lookahead window is HALF-OPEN, or every beat double-fires', () => {
  const ev = (tick) => ({ tick, type: 'noteOn', channel: 0, note: 60, velocity: 100, duration: 10 });
  const events = [ev(0), ev(480), ev(960), ev(1440)];

  // A note landing exactly on a boundary belongs to the LATER window and
  // to exactly one of them. At 480 PPQN that boundary is every beat, so a
  // closed interval would retrigger a quarter of the song.
  const a = eventsInWindow(events, 0, 480);
  const b = eventsInWindow(events, 480, 960);
  assert.deepEqual(a.map((e) => e.tick), [0]);
  assert.deepEqual(b.map((e) => e.tick), [480]);

  // Union over consecutive windows is the whole stream, each event ONCE.
  const seen = [...a, ...b, ...eventsInWindow(events, 960, 2000)].map((e) => e.tick);
  assert.deepEqual(seen, [0, 480, 960, 1440]);
});

test('A5: the lookahead window exceeds the wake interval', () => {
  // If the window were shorter than the interval, notes would fall in the
  // gap between wake-ups and the song would play with holes in it.
  assert.ok(LOOKAHEAD_SECONDS * 1000 > TICK_INTERVAL_MS,
    `lookahead ${LOOKAHEAD_SECONDS * 1000}ms must exceed the ${TICK_INTERVAL_MS}ms interval`);
});

test('A5: channel state FOLDS FORWARD - tick-0 setup survives into the song', () => {
  // Program changes and CC7 arrive at tick 0 and then rarely. A scheduler
  // that only read the current window would play the opening on the wrong
  // instrument at the wrong volume, then silently "fix itself".
  const state = freshChannelState();
  applyChannelEvents(state, [
    { tick: 0, type: 'programChange', channel: 3, program: 48 },
    { tick: 0, type: 'controller', channel: 3, controller: 7, value: 100 },
    { tick: 0, type: 'controller', channel: 3, controller: 10, value: 0 },
  ]);
  assert.equal(state[3].program, 48);
  assert.ok(state[3].volume > 0 && state[3].volume < 1);
  assert.equal(state[3].pan, panPosition(0));

  // A later window with no control events must NOT reset it.
  applyChannelEvents(state, [{ tick: 5000, type: 'noteOn', channel: 3, note: 60, velocity: 90 }]);
  assert.equal(state[3].program, 48, 'program survived a later window');

  // Channel-less events (the HMI meta blocks) are skipped, not crashed on.
  applyChannelEvents(state, [{ tick: 1, type: 'hmi', channel: null, subtype: 16, data: new Uint8Array(2) }]);
  assert.equal(state[3].program, 48);

  // Volume defaults to FULL: a song that never sends CC7 must not be mute.
  assert.equal(freshChannelState()[0].volume, 1);
});

// --- the OURS half: structure, not taste ---------------------------------

test('A5: every GM program resolves to a finite, ordered voice', () => {
  for (let p = 0; p < 128; p++) {
    const v = voiceSpec(p);
    assert.equal(v.program, p);
    assert.equal(v.family, GM_FAMILIES[p >> 3], `program ${p} lands in its GM family`);
    assert.ok(['sine', 'square', 'sawtooth', 'triangle'].includes(v.type), `program ${p} type`);
    for (const k of ['attack', 'decay', 'release', 'sustain', 'cutoff', 'q', 'gain']) {
      assert.ok(Number.isFinite(v[k]) && v[k] >= 0, `program ${p} ${k} is finite and non-negative`);
    }
    assert.ok(v.sustain <= 1, `program ${p} sustain is a level, not a gain`);
    assert.ok(v.attack > 0, `program ${p} attack is non-zero - a zero ramp clicks`);
  }
  assert.equal(GM_FAMILIES.length, 16);
});

test('A5: out-of-range programs and notes CLAMP rather than throw', () => {
  // The reader hands through whatever the bytes said. A corrupt program
  // change must not take the song down, and must not return undefined
  // into an oscillator's type.
  for (const bad of [-1, 128, 999, NaN, undefined, null, 'x']) {
    const v = voiceSpec(bad);
    assert.ok(GM_FAMILIES.includes(v.family), `${bad} still resolves`);
    assert.ok(Number.isFinite(v.gain));
  }
  for (const bad of [-5, 200, NaN, undefined]) {
    const d = percussionSpec(bad);
    assert.ok(Number.isFinite(d.hz) && d.hz > 0, `${bad} still resolves to a drum`);
  }
});

test('A5: percussion never leaves a key silent', () => {
  // An unmapped drum key takes the NEAREST mapped one; a kit with holes
  // reads as a broken song rather than a sparse kit.
  for (let n = 0; n < 128; n++) {
    const d = percussionSpec(n);
    assert.ok(['noise', 'tone'].includes(d.kind), `key ${n} has a kind`);
    assert.ok(d.hz > 0 && Number.isFinite(d.hz));
    assert.ok(d.decay > 0 && Number.isFinite(d.decay));
    assert.ok(d.gain > 0 && d.gain <= 1);
  }
  // Channel 9 is percussion in GM, always.
  assert.equal(PERCUSSION_CHANNEL, 9);
});

test('A5: the MIDI conversions are the real law and are exact', () => {
  // A440 at note 69 is the one piece of genuine spec here.
  assert.equal(noteToHz(69), 440);
  assert.ok(Math.abs(noteToHz(81) - 880) < 1e-9, 'an octave up doubles');
  assert.ok(Math.abs(noteToHz(57) - 220) < 1e-9, 'an octave down halves');
  assert.ok(Math.abs(noteToHz(60) - 261.6255653) < 1e-6, 'middle C');

  // Velocity is SQUARED, so quiet notes read as quiet.
  assert.equal(velocityGain(0), 0);
  assert.equal(velocityGain(127), 1);
  assert.ok(velocityGain(64) < 0.3, 'half velocity is well under half gain');

  // Pan: 64 is centre, and the ends reach the full -1..1 a panner wants.
  assert.equal(panPosition(64), 0);
  assert.ok(panPosition(0) <= -1 && panPosition(0) >= -1.02);
  assert.ok(panPosition(127) >= 0.99 && panPosition(127) <= 1);

  // Bend: 8192 is centre, +/-2 semitones = +/-200 cents at the extremes.
  assert.equal(bendCents(8192), 0);
  assert.ok(Math.abs(bendCents(16383) - 200) < 0.5);
  assert.equal(bendCents(0), -200);

  // Nothing can put a NaN into the graph.
  for (const f of [velocityGain, panPosition, bendCents]) {
    for (const bad of [NaN, undefined, null, 'x', Infinity, -Infinity]) {
      assert.ok(Number.isFinite(f(bad)), `${f.name}(${String(bad)}) is finite`);
    }
  }
  assert.ok(Number.isFinite(noteToHz(0)) && noteToHz(0) > 0);
});

// ---------------------------------------------------------------------------
// A5b: FM, and the outdoor/tavern playlists.
//
// The first bank was subtractive and sounded like nothing in particular.
// Daggerfall in 1996 played through AdLib/SoundBlaster - OPL2/OPL3, two-
// operator FM - which is why the archive carries an F*/FM* arrangement of
// nearly every song. There is NO OPL patch bank to read: it lived in HMI's
// sound driver, and ARENA2 has no .AD/.BNK/.OPL, no driver, and song headers
// that carry a device/channel map and zeros where patches would be (checked
// byte by byte). So the ratios and indices are OURS and are pinned for
// STRUCTURE, exactly as the subtractive specs were. What is NOT taste is the
// method: FM is the synthesis the score was written for.
// ---------------------------------------------------------------------------

test('A5b: every GM program resolves to a finite, sane FM voice', async () => {
  const { fmSpec, GM_FAMILIES } = await import('../src/systems/gmSynth.js');
  for (let p = 0; p < 128; p++) {
    const v = fmSpec(p);
    assert.equal(v.program, p);
    assert.equal(v.family, GM_FAMILIES[p >> 3], `program ${p} lands in its GM family`);
    for (const k of ['car', 'mod', 'index', 'idxDecay', 'attack', 'decay', 'sustain', 'release', 'gain']) {
      assert.ok(Number.isFinite(v[k]), `program ${p} ${k} is finite - a NaN ratio silences the voice`);
      assert.ok(v[k] >= 0, `program ${p} ${k} is non-negative`);
    }
    assert.ok(v.car > 0, `program ${p} carrier ratio must be positive - 0 Hz is silence`);
    assert.ok(v.mod > 0, `program ${p} modulator ratio must be positive`);
    assert.ok(v.attack > 0, `program ${p} attack is non-zero - a zero ramp clicks`);
    assert.ok(v.idxDecay > 0, `program ${p} index decay is non-zero - exponentialRamp needs it`);
    assert.ok(v.sustain <= 1, `program ${p} sustain is a level`);
  }
});

test('A5b: bad program numbers CLAMP into a real FM voice', async () => {
  const { fmSpec, GM_FAMILIES } = await import('../src/systems/gmSynth.js');
  for (const bad of [-1, 128, 9999, NaN, undefined, null, 'x']) {
    const v = fmSpec(bad);
    assert.ok(GM_FAMILIES.includes(v.family), `${String(bad)} still resolves`);
    assert.ok(Number.isFinite(v.index) && Number.isFinite(v.car) && v.car > 0);
  }
});

test('A5b: outdoor playlists are AssignPlaylist\'s arms, verbatim', async () => {
  const { outdoorPlaylist, SUNNY_SONGS, CLOUDY_SONGS, OVERCAST_SONGS, RAIN_SONGS,
    SNOW_SONGS, NIGHT_SONGS, NIGHT_SONGS_FM, SUNNY_SONGS_FM } =
    await import('../src/systems/songManager.js');

  // NIGHT overrides the weather entirely (SongManager.cs:608-611).
  assert.equal(outdoorPlaylist({ night: true, weather: 'snow' }), NIGHT_SONGS);
  assert.equal(outdoorPlaylist({ night: true, weather: 'sunny' }), NIGHT_SONGS);

  // By day the weather picks, with DFU's own foldings.
  assert.equal(outdoorPlaylist({ weather: 'sunny' }), SUNNY_SONGS);
  assert.equal(outdoorPlaylist({ weather: 'cloudy' }), CLOUDY_SONGS);
  assert.equal(outdoorPlaylist({ weather: 'overcast' }), OVERCAST_SONGS);
  assert.equal(outdoorPlaylist({ weather: 'fog' }), OVERCAST_SONGS, 'Fog folds in with Overcast (:540-541)');
  assert.equal(outdoorPlaylist({ weather: 'rain' }), RAIN_SONGS);
  assert.equal(outdoorPlaylist({ weather: 'thunder' }), RAIN_SONGS, 'Thunder folds in with Rain (:544-545)');
  assert.equal(outdoorPlaylist({ weather: 'snow' }), SNOW_SONGS);

  // Anything unrecognised falls to Sunny - that default is DFU's own
  // (:550-552), not a guess, so an unmapped weather is never silent.
  assert.equal(outdoorPlaylist({ weather: 'nonsense' }), SUNNY_SONGS);
  assert.equal(outdoorPlaylist({}), SUNNY_SONGS);

  // The FM arm reaches FM lists, and they are not the same objects.
  assert.equal(outdoorPlaylist({ fm: true }), SUNNY_SONGS_FM);
  assert.equal(outdoorPlaylist({ night: true, fm: true }), NIGHT_SONGS_FM);
  assert.notEqual(NIGHT_SONGS_FM, NIGHT_SONGS);
  // SIX FM entries against SEVEN GM ones, which is DFU's own asymmetry
  // and the point of their note at :818: general midi DUPLICATES song_10
  // into the night list, so the GM array carries both song_10 and
  // song_21; the FM array does not duplicate and starts at song_11fm.
  // There is no 10FM record in MIDI.BSA at all - the corpus pin caught an
  // earlier version of this list that had extrapolated one.
  assert.equal(NIGHT_SONGS_FM.length, 6);
  assert.equal(NIGHT_SONGS.length, 7);
  assert.equal(NIGHT_SONGS_FM[0], '11FM.HMI', 'the FM list starts at 11FM, not a 10FM that does not exist');
  assert.equal(NIGHT_SONGS[0], '10.HMI');
  assert.equal(NIGHT_SONGS_FM.at(-1), '21FM.HMI');
  assert.equal(NIGHT_SONGS.at(-1), '21.HMI');
});

test('A5b: every outdoor and FM playlist entry EXISTS in MIDI.BSA', { skip: skipReal }, async () => {
  const sm = await import('../src/systems/songManager.js');
  const bsa = new MidiBsaFile();
  bsa.load(new Uint8Array(readFileSync(join(ARENA2, 'MIDI.BSA'))));
  const missing = [];
  for (const [label, list] of Object.entries(sm)) {
    if (!Array.isArray(list) || !list.length || typeof list[0] !== 'string') continue;
    for (const name of list) {
      const i = bsa.getSongIndex(name);
      if (i === null || i === undefined || i < 0) missing.push(`${label}: ${name}`);
    }
  }
  assert.deepEqual(missing, [], 'every exported playlist resolves against the real archive');
});

test('A5b: the tavern arm reaches all four hosts through their own clocks', () => {
  // A source sweep, stated honestly: these hosts have no execution
  // coverage in node. What is checkable is that the wiring EXISTS in each
  // and that taverns take the sequence arm, not the seeded one - the
  // host-gap shape this project keeps finding.
  const wm = readFileSync('src/scenes/worldModes.js', 'utf8');
  assert.match(wm, /BUILDING_TYPES\.Tavern/, 'worldModes recognises a tavern');
  assert.match(wm, /TAVERN_SONGS, \{ gameDays: gameDaysNow\(\), tavern: true \}/,
    'taverns take the DIRECT gameDays arm, not the seeded one');
  assert.match(wm, /resumeOutdoorMusic\?\.\(\)/, 'leaving a tavern hands the street back its song');

  for (const host of ['src/scenes/exterior.js', 'src/scenes/world.js']) {
    const text = readFileSync(host, 'utf8');
    assert.match(text, /outdoorPlaylist\(\{ night: isNight\(minute\), weather \}\)/,
      `${host} never picks an outdoor playlist`);
    assert.match(text, /resumeOutdoorMusic:/, `${host} never feeds worldModes the resume closure`);
    assert.match(text, /gameDaysNow:/, `${host} never feeds worldModes its clock`);
  }
  // And the dungeon host takes the dungeon list, not an outdoor one.
  const dc = readFileSync('src/scenes/dungeonContext.js', 'utf8');
  assert.match(dc, /music\.playFrom\(DUNGEON_SONGS/, 'the dungeon host plays dungeon music');
});
