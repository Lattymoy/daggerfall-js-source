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
import * as songManager from '../src/systems/songManager.js';
import { SONG_FILES, isSongFileDefined, songFileToRecordName } from '../src/systems/songFiles.js';

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

// --- SongFiles.cs and EnumToFilename -------------------------------------

test('SongFiles: the enum is the SET Enum.IsDefined answers for, song_none included', () => {
  // PlaySong.cs:47-52 throws behind Enum.IsDefined, so the membership
  // test IS the law. song_none is a member (the -1 sentinel) and DFU's
  // Play(SongFiles) never special-cases it, so "play song song_none"
  // parses in DFU and must parse here.
  assert.equal(SONG_FILES.length, 133, 'SongFiles.cs:20-154 declares 133 members');
  assert.equal(isSongFileDefined('song_none'), true);
  assert.equal(isSongFileDefined('song_dungeon5'), true);
  assert.equal(isSongFileDefined('song_5strong'), true);
  assert.equal(isSongFileDefined('song_tavern'), true);
  assert.equal(isSongFileDefined('song_dungeon4'), false, 'the enum jumps dungeon..dungeon5');
  assert.equal(isSongFileDefined('song_14'), false, 'the numbered songs are not contiguous');
  assert.equal(isSongFileDefined('dungeon5'), false, 'the prefix is part of the member name');
  // Enum.IsDefined compares ORDINALLY. Every member is lower case, so a
  // shouted name is undefined in C# too.
  assert.equal(isSongFileDefined('SONG_TAVERN'), false);
  assert.equal(isSongFileDefined('Song_Tavern'), false);
  assert.equal(new Set(SONG_FILES).size, SONG_FILES.length, 'no member typed twice');
});

test('SongFiles: EnumToFilename is strip song_, upper-case, .HMI', () => {
  // C#: enumName.Remove(0, "song_".Length) + ".mid", against Unity
  // Resources. The port asks MIDI.BSA, whose records are upper case
  // with a .HMI extension - same stem, different wrapper.
  assert.equal(songFileToRecordName('song_gday___d'), 'GDAY___D.HMI', 'underscores survive');
  assert.equal(songFileToRecordName('song_5strong'), '5STRONG.HMI', 'a digit-leading stem');
  assert.equal(songFileToRecordName('song_02fm'), '02FM.HMI');
  assert.equal(songFileToRecordName('song_fm_sqr_2'), 'FM_SQR_2.HMI', 'only the FIRST song_ goes');
  assert.equal(songFileToRecordName('song_d10'), 'D10.HMI');
  assert.equal(songFileToRecordName('song_fsnow__b'), 'FSNOW__B.HMI');
  // The sentinel resolves to a name like any other; the archive is what
  // says no, exactly as DFU's LoadSong does.
  assert.equal(songFileToRecordName('song_none'), 'NONE.HMI');
  assert.equal(new Set(SONG_FILES.map(songFileToRecordName)).size, SONG_FILES.length,
    'the mapping is injective - no two members claim one record');
});

test('SongFiles: the enum and the playlists are ONE set under two spellings', () => {
  // songManager's tables were typed in the ARCHIVE's spelling and
  // SongFiles in DFU's. If songFileToRecordName is the bridge between
  // them, every name any playlist carries must be reachable from some
  // enum member - otherwise one of the two tables has a typo that only
  // the ARENA2-gated pin below would catch, and only on a machine that
  // has the data.
  const reachable = new Set(SONG_FILES.map(songFileToRecordName));
  const playlists = Object.entries(songManager).filter(([label, v]) => Array.isArray(v) && /_SONGS(_FM)?$/.test(label));
  // Guard the sweep itself: songManager names every playlist *_SONGS,
  // and a pin that silently swept nothing would pass forever.
  assert.ok(playlists.length >= 30, `found ${playlists.length} playlists to sweep`);
  const unreachable = [];
  for (const [label, list] of playlists) {
    for (const name of list) {
      if (!reachable.has(name)) unreachable.push(`${label}: ${name}`);
    }
  }
  assert.deepEqual(unreachable, [], 'every playlist entry is some SongFiles member');
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
    // Song lists only - the module also exports MUSIC_ENVIRONMENTS, which
    // is a list of environment NAMES, not records.
    if (!Array.isArray(list) || !list.length || !/\.HMI$/.test(list[0])) continue;
    for (const name of list) {
      const i = bsa.getSongIndex(name);
      if (i === null || i === undefined || i < 0) missing.push(`${label}: ${name}`);
    }
  }
  assert.deepEqual(missing, [], 'every exported playlist resolves against the real archive');
});

test('AUDIT 19 1:1: every host feeds the ONE music director', () => {
  // The port used to call music.playFrom at moments each host chose. DFU
  // has a SongManager.Update() that rebuilds a context every frame and
  // reacts to the difference, so the port now has one director and the
  // hosts only feed it. This sweep is what stops the four of them drifting
  // apart again - the shape every previous audit found.
  const wm = readFileSync('src/scenes/worldModes.js', 'utf8');
  assert.match(wm, /musicContext\(\)/, 'the mode host reports its half of the context');
  assert.match(wm, /insideDungeon: true/, 'including whether the player is in a dungeon');
  assert.match(wm, /dungeonKey: dungeonCtx\?\.musicSeed/, 'and the dungeon selection seed');
  assert.ok(!/music\.playFrom\(/.test(wm),
    'the mode host must NOT start songs itself - the director decides');

  for (const host of ['src/scenes/exterior.js', 'src/scenes/world.js']) {
    const text = readFileSync(host, 'utf8');
    assert.match(text, /createMusicDirector\(\)/, `${host} has no music director`);
    assert.match(text, /musicDirector\.update\(/, `${host} never feeds it`);
    assert.match(text, /modes\?\.musicContext\?\.\(\)/,
      `${host} must merge the mode host's half of the context`);
    assert.match(text, /gameDays: gameDaysNow\(\)/,
      `${host} must feed the CUMULATIVE day count`);
    assert.ok(!/music\.playFrom\(/.test(text),
      `${host} must not start songs directly any more`);
  }

  // The dungeon context supplies the seed and no longer plays.
  const dc = readFileSync('src/scenes/dungeonContext.js', 'utf8');
  assert.match(dc, /musicSeed: dungeonKey\(/, 'the dungeon context exposes its selection seed');
  assert.ok(!/music\.playFrom\(/.test(dc), 'and does not start songs itself');

  // ALL FOUR HOSTS. Removing dungeonContext's own playFrom without giving
  // scenes/dungeon.js a director left ?dungeon silent - the host gap, made
  // by the very pass that was closing it. Sweeping three hosts is what let
  // that through, so the list is the whole set.
  for (const host of ['src/scenes/exterior.js', 'src/scenes/world.js', 'src/scenes/dungeon.js']) {
    const text = readFileSync(host, 'utf8');
    assert.match(text, /createMusicDirector\(\)/, `${host} has no music director`);
    assert.match(text, /musicDirector\.update\(/, `${host} never feeds it`);
  }
  const dh = readFileSync('src/scenes/dungeon.js', 'utf8');
  assert.match(dh, /dungeonKey: ctx\.musicSeed/,
    'the dungeon host must feed the SEED, or its songs fall back to the day roll');
});



// ---------------------------------------------------------------------------
// AUDIT 19. Three lessons, pinned.
//
// 1. THE MEMO MUST BE BEHAVIOURAL, NOT TEXTUAL. `ensure` was rewritten to
//    memoise the boot PROMISE, and a pin asserted the source read
//    `this._booted ??= this._boot(`. It did. It was also completely dead:
//    the constructor initialised `_booted = false`, and `??=` assigns only
//    over null/undefined, so _boot NEVER RAN and ensure() returned the
//    boolean - which Promise.all accepts, so every host believed music had
//    booted. 990 tests passed. A live boot probe caught it.
// 2. The GM PERCUSSION KEY MAP is spec, not taste.
// 3. MIDI has SIXTEEN channels - also spec.
// ---------------------------------------------------------------------------

test('AUDIT 19: ensure() boots ONCE and every caller awaits the same load', async () => {
  const { MusicService } = await import('../src/systems/music.js');

  let fetches = 0;
  let release;
  const gate = new Promise((r) => { release = r; });
  const fetchBytes = async () => { fetches++; await gate; throw new Error('no archive in this test'); };

  const svc = new MusicService();
  const a = svc.ensure(fetchBytes);
  const b = svc.ensure(fetchBytes);

  // Both callers get a REAL promise, and the same one.
  assert.ok(a instanceof Promise, 'ensure must return a promise, not a flag');
  assert.equal(a, b, 'the second caller gets the SAME boot, not a fresh one');

  // And crucially: the second caller must NOT have resolved yet. The old
  // flag-and-return let it through while the archive was still loading,
  // which is how the exterior host went silent.
  let bSettled = false;
  b.then(() => { bSettled = true; });
  for (let i = 0; i < 5; i++) await Promise.resolve();
  assert.equal(bSettled, false, 'the second caller must WAIT for the first boot');

  release();
  await a; await b;
  assert.equal(fetches, 1, 'the archive is fetched exactly once');
  assert.equal(svc.enabled, false, 'a failed load disables music rather than throwing');
});

test('AUDIT 19: a successful ensure() actually ENABLES music', async () => {
  // The dead-memo bug left `enabled` false forever while every pin passed,
  // so the happy path is pinned too, not just the failure path.
  const { MusicService } = await import('../src/systems/music.js');
  const bytes = skipReal ? null : new Uint8Array(readFileSync(join(ARENA2, 'MIDI.BSA')));
  if (!bytes) return;                       // corpus-gated half
  const svc = new MusicService();
  await svc.ensure(async () => bytes);
  assert.equal(svc.enabled, true, 'a real archive enables music');
  assert.equal(svc.bootError ?? null, null);
  assert.ok(svc.archive.getSongIndex('DUNGEON.HMI') >= 0);
});

test('AUDIT 19: the GM PERCUSSION KEY MAP is spec, and is held to it', async () => {
  const { percussionSpec } = await import('../src/systems/gmSynth.js');
  // General MIDI Level 1 Percussion Key Map. These are published note
  // numbers every GM file is authored against - not our choice. The TIMBRE
  // of each drum (hz/decay/gain) is ours and stays unpinned; the KEY each
  // one answers to is law. Move 38 and every snare in every song plays the
  // wrong drum, which is what used to pass silently.
  const GM = {
    35: 'acoustic bass drum', 36: 'bass drum 1', 38: 'acoustic snare',
    40: 'electric snare', 42: 'closed hi-hat', 45: 'low tom',
    46: 'open hi-hat', 47: 'low-mid tom', 49: 'crash cymbal 1',
    50: 'high tom', 51: 'ride cymbal 1',
  };
  for (const key of Object.keys(GM).map(Number)) {
    const d = percussionSpec(key);
    assert.equal(d.note, key,
      `GM key ${key} (${GM[key]}) must map to ITSELF, not to a neighbour`);
  }
  // The kicks are TONES and the cymbals/hats are NOISE - the one timbre
  // distinction that is structural rather than taste.
  for (const k of [35, 36, 45, 47, 50]) assert.equal(percussionSpec(k).kind, 'tone', `key ${k}`);
  for (const k of [38, 40, 42, 46, 49, 51]) assert.equal(percussionSpec(k).kind, 'noise', `key ${k}`);
  // Hi-hats: closed must ring SHORTER than open, or the groove inverts.
  assert.ok(percussionSpec(42).decay < percussionSpec(46).decay, 'closed hat is shorter than open');

  // AUDIT 2026-08-25: THE MAP RUNS 35..87, and the whole point is that
  // no note inside it resolves to a NEIGHBOUR. It used to stop at 51,
  // and percussionSpec resolves by nearest neighbour, so every key
  // above it answered as the ride cymbal - measured over the real
  // archive, 25 of the 30 drum notes in use and 14,000+ hits were one
  // sound. Each key owning ITSELF is the law; what it sounds like is
  // still ours.
  for (let k = 35; k <= 87; k++) {
    assert.equal(percussionSpec(k).note, k, `GM key ${k} must own itself, not borrow a neighbour`);
  }
  // ...and OUTSIDE the map the nearest-neighbour fallback still stands,
  // because a key with no sound is worse than an approximate one.
  assert.equal(percussionSpec(34).note, 35);
  assert.equal(percussionSpec(120).note, 87);
});

test('AUDIT 2026-08-25: the archive\'s own drums land on 30 SOUNDS, not one', { skip: skipReal }, () => {
  // THE MEASUREMENT THAT FOUND THE DEFECT, kept as the pin that proves
  // it stays fixed. A synthetic fixture cannot see this: the map looked
  // reasonable in isolation and only the real archive shows that
  // Daggerfall's percussion sits almost entirely ABOVE where the table
  // used to stop. Before: 30 notes in use, 5 distinct sounds, and 25 of
  // them - 14,000+ hits - all the ride cymbal.
  const archive = new MidiBsaFile();
  assert.equal(archive.load(new Uint8Array(readFileSync(join(ARENA2, 'MIDI.BSA')))), true);

  const notes = new Map();
  for (let i = 0; i < archive.count; i++) {
    let song;
    try { song = archive.getSong(i); } catch { continue; }
    for (const e of song.events) {
      if (e.type === 'noteOn' && e.channel === PERCUSSION_CHANNEL) {
        notes.set(e.note, (notes.get(e.note) ?? 0) + 1);
      }
    }
  }
  assert.ok(notes.size >= 25, `the archive should use a wide kit, saw ${notes.size} notes`);

  // Group by SOUND - dropping `key`, which carries the note identity and
  // would make every spec unique whatever it resolved to. That mistake
  // is why the first measurement of this reported 30 sounds when there
  // were 5, so the pin spells it out.
  const groups = new Map();
  for (const note of notes.keys()) {
    const { key, ...spec } = percussionSpec(note);
    const id = JSON.stringify(spec);
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(note);
  }
  const collided = [...groups.values()].filter((g) => g.length > 1);
  assert.deepEqual(collided, [],
    `these notes share one sound: ${collided.map((g) => g.join('+')).join(', ')}`);
  assert.equal(groups.size, notes.size, 'every note the archive plays has a sound of its own');
});

test('AUDIT 2026-08-25: articulation beats family, where the two disagree', async () => {
  const { fmSpec } = await import('../src/systems/gmSynth.js');
  // fmSpec resolves a family with `program >> 3`, so eight programs
  // share one voice. That is a fair BASE - GM groups mostly by timbre -
  // but it collapsed pairs whose articulation is opposite, and
  // articulation is what the ear names an instrument by. Harp and
  // timpani both sat in `strings` and came out bowed: one is plucked and
  // rings, the other is struck and thuds.
  //
  // The pin is STRUCTURAL, as this module requires: not "a harp sounds
  // like X" but "a plucked thing must not have a bowed envelope".
  const bowed = fmSpec(40);          // violin - the family's own shape
  for (const p of [45, 46, 47]) {    // pizzicato, harp, timpani
    const v = fmSpec(p);
    assert.equal(v.family, 'strings', `${p} is still IN the strings family`);
    assert.ok(v.attack < bowed.attack / 10, `${p} must start immediately, not swell like a bow`);
    assert.ok(v.sustain < bowed.sustain / 5, `${p} must decay away, not hold like a bow`);
  }
  const pad = fmSpec(48);            // string ensemble - a slow pad
  const hit = fmSpec(55);            // orchestra hit - a stab
  assert.ok(hit.attack < pad.attack / 10 && hit.sustain < pad.sustain / 5, 'a hit is not a pad');

  // The one envelope that runs BACKWARDS stays backwards.
  const reverse = fmSpec(119);
  assert.ok(reverse.attack > reverse.decay, 'a reverse cymbal swells rather than strikes');

  // An override REPLACES only what it restates - a listed program keeps
  // every other field from its family, or each override becomes a
  // partial voice with holes in it.
  const harp = fmSpec(46);
  assert.equal(harp.car, fmSpec(40).car);
  assert.equal(harp.gain, fmSpec(40).gain, 'gain was never overridden for 46');

  // EVERY program still resolves to a complete, finite voice - the
  // override merge must not be able to emit NaN into the audio graph.
  for (let p = 0; p < 128; p++) {
    const v = fmSpec(p);
    for (const k of ['car', 'mod', 'index', 'idxDecay', 'attack', 'decay', 'sustain', 'release', 'gain']) {
      assert.ok(Number.isFinite(v[k]), `program ${p} has a non-finite ${k}`);
    }
    assert.ok(v.attack >= 0 && v.decay > 0 && v.release > 0);
    assert.ok(v.sustain >= 0 && v.sustain <= 1);
    assert.ok(v.gain > 0 && v.gain <= 1);
  }
});

test('AUDIT 2026-08-25: the SUSTAIN PEDAL, which was being dropped entirely', async () => {
  const { sustainIntervals, sustainedDuration } = await import('../src/systems/songPlayer.js');
  const cc = (tick, value, channel = 0) => ({ type: 'controller', controller: 64, tick, value, channel });

  // MIDI's threshold is 64: below is up, 64 and above is down. Not 63,
  // not 65 - a wrong threshold makes half the pedal marks read backwards.
  assert.deepEqual([...sustainIntervals([cc(0, 64), cc(10, 63)]).get(0)], [[0, 10]]);
  assert.deepEqual([...sustainIntervals([cc(0, 63), cc(10, 0)]).values()], [], 'a 63 never presses');
  assert.deepEqual([...sustainIntervals([cc(0, 127), cc(10, 0)]).get(0)], [[0, 10]]);

  // A repeated press does NOT restart the interval - the pedal is already
  // down, and re-opening it would cut the notes it is holding.
  assert.deepEqual([...sustainIntervals([cc(0, 127), cc(5, 127), cc(10, 0)]).get(0)], [[0, 10]]);

  // Left down at the end, it rings to the loop rather than being cut by
  // an up that never comes. Without a song length there is nowhere to
  // close it but Infinity, which is why the player passes one.
  assert.deepEqual([...sustainIntervals([cc(0, 127)]).get(0)], [[0, Infinity]]);
  // AUDIT 39: given the song's length, the open pedal closes THERE.
  assert.deepEqual([...sustainIntervals([cc(0, 127)], 480).get(0)], [[0, 480]]);
  assert.deepEqual([...sustainIntervals([cc(500, 127)], 480).get(0)], [[500, 500]],
    'a pedal pressed past the end closes on itself - never a negative ring');

  // ONLY CC64 IS THE PEDAL. Every fixture above is made of pedal events,
  // so none of them could tell whether the controller number was checked
  // at all - a mutation that treated EVERY controller as a pedal
  // survived them. The archive sends 60,920 CC7s and 54,851 CC10s, so
  // getting this wrong would make almost every volume and pan change
  // press the sustain pedal.
  const noisy = sustainIntervals([
    { type: 'controller', controller: 7, tick: 0, value: 127, channel: 0 },
    { type: 'controller', controller: 10, tick: 5, value: 100, channel: 0 },
    { type: 'controller', controller: 1, tick: 8, value: 64, channel: 0 },
    { type: 'programChange', tick: 9, program: 40, channel: 0 },
  ]);
  assert.equal(noisy.size, 0, 'nothing but CC64 presses the pedal');

  // Channels are independent - one player's pedal is not another's.
  const two = sustainIntervals([cc(0, 127, 1), cc(4, 127, 2), cc(8, 0, 1), cc(12, 0, 2)]);
  assert.deepEqual([...two.get(1)], [[0, 8]]);
  assert.deepEqual([...two.get(2)], [[4, 12]]);

  // THE EXTENSION. A note whose own end falls while the pedal is down
  // rings until it lifts; one that ends outside is untouched.
  const held = [[100, 200]];
  assert.equal(sustainedDuration(90, 20, held), 110, 'ends at 110, inside - rings to 200');
  assert.equal(sustainedDuration(90, 5, held), 5, 'ends at 95, before the pedal - untouched');
  assert.equal(sustainedDuration(210, 10, held), 10, 'ends after the pedal lifted - untouched');

  // The boundaries, which is where an off-by-one would hide: a note
  // ending exactly ON the press is caught, one ending exactly on the
  // release is not - the pedal is already up by then.
  assert.equal(sustainedDuration(50, 50, held), 150, 'end == down is inside');
  assert.equal(sustainedDuration(100, 100, held), 100, 'end == up is outside, and unchanged');

  // THE PEDAL NEVER SHORTENS - and the pin has to test the case that
  // actually reaches the decision. A first draft used a note so long it
  // ended past the pedal entirely, which returns early and proves
  // nothing; a mutation that dropped the length guard survived it. The
  // real law is that a note ending OUTSIDE the interval is returned
  // untouched, whether it is longer or shorter than the pedal.
  assert.equal(sustainedDuration(90, 500, held), 500, 'a note outstaying the pedal keeps its length');
  assert.equal(sustainedDuration(0, 1000, held), 1000, 'and so does one that spans it entirely');
  // Inside the interval the note always GROWS - `end < up` guarantees
  // `up - startTick` exceeds the note's own duration, which is why the
  // implementation needs no max().
  for (const [st, d] of [[90, 20], [50, 50], [120, 10]]) {
    const out = sustainedDuration(st, d, held);
    assert.ok(out > d, `note at ${st} for ${d} must lengthen, got ${out}`);
    assert.equal(out, 200 - st, 'and it rings to exactly where the pedal lifts');
  }

  // No pedal at all, and a channel with none, both leave the note alone.
  assert.equal(sustainedDuration(0, 42, undefined), 42);
  assert.equal(sustainedDuration(0, 42, []), 42);

  // ...and the scheduler must actually USE it, computed ONCE per song
  // rather than per lookahead window.
  const src = readFileSync(new URL('../src/systems/songPlayer.js', import.meta.url), 'utf8');
  assert.match(src, /sustainedDuration\(e\.tick, e\.duration \|\| 0, this\._sustain\?\.get\(e\.channel\)\)/);
  // AUDIT 39: the pin moved with the law - the pedal map is built with
  // the SONG'S LENGTH, so an unlifted pedal closes there instead of at
  // Infinity (see the pump pin below).
  assert.match(src, /this\._sustain = sustainIntervals\(song\.events,/);
  const play = src.slice(src.indexOf('  play(song) {'), src.indexOf('  stop() {'));
  assert.match(play, /_sustain = sustainIntervals/, 'built in play(), not in the pump');
});

test('AUDIT 2026-08-25: pitched percussion HOLDS its note', () => {
  // The tone path ramps pitch down to `hz * drop` over the decay, and a
  // falling pitch is exactly what makes a drum read as a drum. It is
  // also what stops a triangle reading as a triangle: struck metal and
  // wood do not swoop. So `drop` is 1 for those and the kit keeps the
  // full octave it always had.
  for (const k of [53, 56, 67, 68, 71, 72, 75, 76, 77, 80, 81, 83]) {
    assert.equal(percussionSpec(k).drop, 1, `key ${k} is struck metal or wood - it must hold pitch`);
  }
  for (const k of [35, 36, 41, 45, 47, 50]) {
    assert.equal(percussionSpec(k).drop, 0.5, `key ${k} is a drum - it falls the full octave`);
  }
  // hand drums fall, but less than the kit
  for (const k of [60, 61, 62, 63, 64]) {
    const d = percussionSpec(k).drop;
    assert.ok(d > 0.5 && d < 1, `key ${k} is a skinned hand drum - it falls a little`);
  }
  // EVERY key has one, in range, or the ramp emits NaN into the graph
  for (let k = 0; k < 128; k++) {
    const d = percussionSpec(k).drop;
    assert.ok(Number.isFinite(d) && d > 0 && d <= 1, `key ${k} drop out of range: ${d}`);
  }
  // and the player must actually READ it - a table nothing consults is
  // the dead-data shape this project keeps finding
  const src = readFileSync(new URL('../src/systems/songPlayer.js', import.meta.url), 'utf8');
  assert.match(src, /spec\.hz \* spec\.drop/);
  assert.match(src, /if \(spec\.drop !== 1\)/, 'a held pitch schedules no ramp at all');
});

test('AUDIT 19: MIDI has sixteen channels, and percussion is one of them', async () => {
  const { freshChannelState } = await import('../src/systems/songPlayer.js');
  const { PERCUSSION_CHANNEL } = await import('../src/systems/gmSynth.js');
  const s = freshChannelState();
  assert.deepEqual(Object.keys(s).map(Number).sort((a, b) => a - b),
    Array.from({ length: 16 }, (_, i) => i),
    'exactly 16 channels, 0..15 - MIDI spec, not a buffer size');
  assert.ok(s[PERCUSSION_CHANNEL], 'channel 9 exists, or every drum track is silent');
  for (const c of Object.values(s)) {
    assert.deepEqual(c, { program: 0, volume: 1, pan: 0, bend: 0 });
  }
});

test('AUDIT 19 F13: EVERY playlist is pinned WHOLE, not just the sampled ones', async () => {
  // 12 of 24 lists had no content pin at all: the audit reversed
  // DUNGEON_SONGS_FM and swapped SUNNY_SONGS entirely and the suite stayed
  // green, because only the duplicate COUNTS were checked. A count survives
  // any reordering, and order is what the modulo indexes into.
  const sm = await import('../src/systems/songManager.js');
  const EXPECT = {
    DUNGEON_SONGS_FM: ['FM_DNGN1.HMI', 'FM_DNGN1.HMI', 'FM_DNGN2.HMI', 'FM_DNGN3.HMI',
      'FM_DNGN4.HMI', 'FM_DNGN5.HMI', 'FDNGN10.HMI', 'FDNGN11.HMI', 'FDUNGN4.HMI',
      'FDUNGN9.HMI', '04FM.HMI', '05FM.HMI', '07FM.HMI', '15FM.HMI', '15FM.HMI'],
    SUNNY_SONGS: ['GDAY___D.HMI', 'SWIMMING.HMI', 'GSUNNY2.HMI', 'SUNNYDAY.HMI',
      '02.HMI', '03.HMI', '22.HMI'],
    SUNNY_SONGS_FM: ['FDAY___D.HMI', 'FM_SWIM2.HMI', 'FM_SUNNY.HMI', '02FM.HMI',
      '03FM.HMI', '22FM.HMI'],
    CLOUDY_SONGS: ['GDAY___D.HMI', 'SWIMMING.HMI', 'GSUNNY2.HMI', 'SUNNYDAY.HMI',
      '02.HMI', '03.HMI', '22.HMI', '29.HMI', '12.HMI'],
    CLOUDY_SONGS_FM: ['FDAY___D.HMI', 'FM_SWIM2.HMI', 'FM_SUNNY.HMI', '02FM.HMI',
      '03FM.HMI', '22FM.HMI', '29FM.HMI', '12FM.HMI'],
    OVERCAST_SONGS_FM: ['29FM.HMI', '12FM.HMI', '13FM.HMI', 'FPALAC.HMI', 'FMOVER_C.HMI'],
    RAIN_SONGS_FM: ['FMOVER_C.HMI', 'FM_RAIN.HMI', '08FM.HMI'],
    SNOW_SONGS_FM: ['20FM.HMI', 'FSNOW__B.HMI', 'FMOVER_S.HMI'],
    SNEAKING_SONGS: ['GSNEAK2.HMI', 'SNEAKING.HMI', 'SNEAKNG2.HMI', '16.HMI', '09.HMI',
      '25.HMI', '30.HMI'],
    SNEAKING_SONGS_FM: ['FSNEAK2.HMI', 'FMSNEAK2.HMI', 'FSNEAK2.HMI', '16FM.HMI',
      '09FM.HMI', '25FM.HMI', '30FM.HMI'],
    DAY_SONGS_FM: ['FDAY___D.HMI', 'FM_SWIM2.HMI', 'FM_SUNNY.HMI', '02FM.HMI', '03FM.HMI',
      '22FM.HMI', '29FM.HMI', '12FM.HMI', '13FM.HMI', 'FPALAC.HMI'],
    NIGHT_SONGS_FM: ['11FM.HMI', 'FCURSE.HMI', 'FEERIE.HMI', 'FRUINS.HMI', '18FM.HMI', '21FM.HMI'],
    TEMPLE_GOOD_SONGS_FM: ['FGOOD.HMI'],
    TEMPLE_NEUTRAL_SONGS_FM: ['FNEUT.HMI'],
    TEMPLE_BAD_SONGS_FM: ['FBAD.HMI'],
    // AUDIT 19: the sixteen lists the first pass never ported at all.
    CASTLE_SONGS: ['GPALAC.HMI'],            CASTLE_SONGS_FM: ['FPALAC.HMI'],
    COURT_SONGS: ['11.HMI'],                 COURT_SONGS_FM: ['11FM.HMI'],
    SHOP_SONGS: ['GSHOP.HMI'],               SHOP_SONGS_FM: ['FM_SQR_2.HMI'],
    MAGES_GUILD_SONGS: ['GMAGE_3.HMI', 'MAGIC_2.HMI'],
    MAGES_GUILD_SONGS_FM: ['FM_NITE3.HMI'],  // a different record, not a MAGIC_2 twin
    INTERIOR_SONGS: ['23.HMI'],              INTERIOR_SONGS_FM: ['23FM.HMI'],
    KNIGHT_SONGS: ['17.HMI'],                KNIGHT_SONGS_FM: ['17FM.HMI'],
    PALACE_SONGS: ['06.HMI'],                PALACE_SONGS_FM: ['06FM.HMI'],
    TAVERN_SONGS_FM: ['FM_SQR_2.HMI'],       // ONE record where GM has five
  };
  for (const [name, expected] of Object.entries(EXPECT)) {
    assert.deepEqual([...sm[name]], expected, `${name} drifted from SongManager.cs`);
  }
  // And nothing exported is left without a whole-list pin: every string
  // array this module exports must be named above or in the earlier pin.
  const PINNED_ELSEWHERE = new Set(['DUNGEON_SONGS', 'OVERCAST_SONGS', 'RAIN_SONGS',
    'SNOW_SONGS', 'TAVERN_SONGS', 'NIGHT_SONGS', 'TEMPLE_GOOD_SONGS',
    'TEMPLE_NEUTRAL_SONGS', 'TEMPLE_BAD_SONGS']);
  const unpinned = Object.entries(sm)
    .filter(([, v]) => Array.isArray(v) && /\.HMI$/.test(v[0] ?? ''))
    .map(([k]) => k)
    .filter((k) => !(k in EXPECT) && !PINNED_ELSEWHERE.has(k));
  assert.deepEqual(unpinned, [], `these playlists have no whole-list pin:\n${unpinned.join('\n')}`);
});

test('AUDIT 19 F14: the day seed is pinned where it actually DISCRIMINATES', async () => {
  const { selectSong, DUNGEON_SONGS } = await import('../src/systems/songManager.js');
  // The old pin used gameDays 93 against a 5-entry list, where
  // srand(93)%5 === srand(94)%5 - so seeding with gameDays+1 passed. Pick a
  // day and list where the neighbours genuinely differ, and assert BOTH
  // that the day maps to its own index and that its neighbours do not.
  const day = 35;   // neighbours land on 11 / 4 / 5 - genuinely distinct
  const here = selectSong(DUNGEON_SONGS, { gameDays: day }).index;
  const before = selectSong(DUNGEON_SONGS, { gameDays: day - 1 }).index;
  const after = selectSong(DUNGEON_SONGS, { gameDays: day + 1 }).index;
  assert.notEqual(here, before, 'an off-by-one seed must change the song');
  assert.notEqual(here, after, 'an off-by-one seed must change the song');

  // Re-derive the expected index from DFRandom directly, so the pin states
  // the LAW rather than echoing selectSong back at itself.
  srand(day);
  assert.equal(here, rand() % DUNGEON_SONGS.length);
});

// ---------------------------------------------------------------------------
// AUDIT 19 F7/F8: the scheduler's two time faults. Both need a controllable
// clock, so the AudioContext is a stub and _voice is replaced with a recorder
// - everything under test here is the scheduling arithmetic, which is ours
// and is the part that can silently ruin a song.
// ---------------------------------------------------------------------------

const fakeCtx = () => ({ currentTime: 0, sampleRate: 44100 });

/** A SongPlayer whose voices are recorded rather than sounded, and whose
 *  pump WE drive - play() arms a real setInterval, which would keep the
 *  test process alive and pump against a clock that never moves. */
async function recordingPlayer(song) {
  const { SongPlayer } = await import('../src/systems/songPlayer.js');
  const ctx = fakeCtx();
  const p = new SongPlayer(ctx);
  p._ensureMaster = () => {};
  const scheduled = [];
  p._voice = (e, when) => scheduled.push({ tick: e.tick, when });
  const start = () => {
    p.play(song);
    clearInterval(p._timer);          // we pump by hand from here
    p._timer = null;
  };
  return { p, ctx, scheduled, start };
}

/** A synthetic song: one note every 480 ticks at 1ms/tick. */
const syntheticSong = (notes = 200) => ({
  secondsPerTick: 0.001,
  durationTicks: notes * 480,
  events: Array.from({ length: notes }, (_, i) => ({
    tick: i * 480, type: 'noteOn', channel: 0, note: 60, velocity: 100, duration: 240,
  })),
});

test('AUDIT 19 F8: a stalled tab never schedules a note IN THE PAST', async () => {
  const song = syntheticSong();
  const { p, ctx, scheduled, start } = await recordingPlayer(song);

  start();
  const before = scheduled.length;
  assert.ok(before > 0, 'the first window scheduled something');

  // The tab is throttled for a full second - far beyond the 0.25s lookahead.
  ctx.currentTime += 1.0;
  p._pump();

  // WebAudio fires a start time that has already passed IMMEDIATELY, so a
  // scheduler that walked the gap would dump ~75 notes into one instant.
  // Only the notes scheduled AFTER the stall are under test - the ones
  // from before it were correctly in the future when they were queued.
  const late = scheduled.slice(before).filter((s) => s.when < ctx.currentTime - 1e-9);
  assert.deepEqual(late, [], `${late.length} notes were scheduled in the past`);

  // And it must not silently stop playing either - it resumes at "now".
  assert.ok(scheduled.length > before, 'it kept scheduling after the stall');
  p.stop();
});

test('AUDIT 19 F7: the loop seam is scheduled AHEAD, not squashed', async () => {
  const song = syntheticSong(6);                       // ends at tick 2880
  const { p, ctx, scheduled, start } = await recordingPlayer(song);
  start();

  // Past the end AND past the ring-out grace (the rewind waits one full
  // second after the last tick so a held note can finish).
  ctx.currentTime += song.durationTicks * song.secondsPerTick + 1.2;
  const before = scheduled.length;
  p._pump();

  // The rewind re-pumps immediately, so the first notes of the repeat are
  // scheduled with lead - not at a time that has already gone.
  const repeat = scheduled.slice(before);
  assert.ok(repeat.length > 0, 'the repeat scheduled notes');
  assert.equal(repeat[0].tick, 0, 'and it restarted at the top of the song');
  const late = repeat.filter((s) => s.when < ctx.currentTime - 1e-9);
  assert.deepEqual(late, [], 'no note of the repeat lands in the past');
  p.stop();
});

test('AUDIT 19 F6: control events do NOT reach back over notes in their window', async () => {
  // The scheduler used to apply EVERY control event in a window and then
  // voice its notes, so a program change late in the window changed notes
  // earlier in the same window - 20,808 notes across the shipped archive
  // were voiced with state from their own future. The window is a
  // scheduling convenience, not a unit of time.
  const { SongPlayer } = await import('../src/systems/songPlayer.js');
  const ctx = { currentTime: 0, sampleRate: 44100 };
  const p = new SongPlayer(ctx);
  p._ensureMaster = () => {};

  const voiced = [];
  // Record the program the note WOULD have been sounded with.
  p._voice = (e) => voiced.push({ tick: e.tick, program: p._state[e.channel].program });

  // Everything below lands inside one 0.25s lookahead window.
  const song = {
    secondsPerTick: 0.001, durationTicks: 200,
    events: [
      { tick: 0, type: 'programChange', channel: 0, program: 40 },
      { tick: 10, type: 'noteOn', channel: 0, note: 60, velocity: 100, duration: 5 },
      { tick: 20, type: 'programChange', channel: 0, program: 73 },
      { tick: 30, type: 'noteOn', channel: 0, note: 62, velocity: 100, duration: 5 },
    ],
  };
  p.play(song);
  clearInterval(p._timer); p._timer = null;

  assert.equal(voiced.length, 2, 'both notes were voiced in the one window');
  assert.equal(voiced[0].program, 40, 'the FIRST note keeps the program in force when it sounds');
  assert.equal(voiced[1].program, 73, 'and the second takes the change that precedes it');
  p.stop();
});

test('AUDIT 19 F7: the loop lead is non-zero, so the seam is never "now"', async () => {
  const { LOOP_LEAD_SECONDS, LOOKAHEAD_SECONDS } = await import('../src/systems/songPlayer.js');
  // A start time of exactly `now` is what WebAudio treats as immediate, so
  // the lead has to be strictly positive - and strictly SMALLER than the
  // lookahead, or the re-pumped window is empty and the repeat starts late.
  assert.ok(LOOP_LEAD_SECONDS > 0, 'a zero lead schedules the repeat AT now');
  assert.ok(LOOP_LEAD_SECONDS < LOOKAHEAD_SECONDS,
    'a lead of a full lookahead makes the re-pumped window exactly empty');
});

test('AUDIT 19 F2: AssignPlaylist, every arm (SongManager.cs:573-660)', async () => {
  const sm = await import('../src/systems/songManager.js');
  const { playlistForEnvironment: pick } = sm;

  // ARRESTED wins over the environment entirely - the court check is the
  // first statement in AssignPlaylist, before the switch.
  assert.equal(pick('shop', { arrested: true }), sm.COURT_SONGS);
  assert.equal(pick('dungeonInterior', { arrested: true }), sm.COURT_SONGS);
  assert.equal(pick('city', { arrested: true, night: true }), sm.COURT_SONGS);

  // City and Wilderness share the outdoor rule.
  assert.equal(pick('city', { weather: 'rain' }), sm.RAIN_SONGS);
  assert.equal(pick('wilderness', { night: true }), sm.NIGHT_SONGS);

  // THE ARM THAT LOOKS LIKE THE CLOCK AND IS NOT: a dungeon exterior and a
  // graveyard take NIGHT songs at any hour. Reading this as the day/night
  // gate is the easy mistake, so it is pinned at NOON.
  assert.equal(pick('dungeonExterior', { night: false, weather: 'sunny' }), sm.NIGHT_SONGS);
  assert.equal(pick('graveyard', { night: false, weather: 'sunny' }), sm.NIGHT_SONGS);

  assert.equal(pick('castle'), sm.CASTLE_SONGS);
  assert.equal(pick('dungeonInterior'), sm.DUNGEON_SONGS);
  assert.equal(pick('magesGuild'), sm.MAGES_GUILD_SONGS);
  assert.equal(pick('fighterTrainers'), sm.KNIGHT_SONGS);
  assert.equal(pick('palace'), sm.PALACE_SONGS);
  assert.equal(pick('shop'), sm.SHOP_SONGS);
  assert.equal(pick('tavern'), sm.TAVERN_SONGS);
  assert.equal(pick('templeGood'), sm.TEMPLE_GOOD_SONGS);
  assert.equal(pick('templeNeutral'), sm.TEMPLE_NEUTRAL_SONGS);
  assert.equal(pick('templeBad'), sm.TEMPLE_BAD_SONGS);
  assert.equal(pick('interior'), sm.INTERIOR_SONGS);
  // DFU's `default` arm: anything unrecognised is a plain interior, never
  // silence. An unmapped environment must still play something.
  assert.equal(pick('somewhere-new'), sm.INTERIOR_SONGS);
  assert.equal(pick(undefined), sm.INTERIOR_SONGS);

  // Every arm has an FM twin and they are DIFFERENT records.
  for (const env of sm.MUSIC_ENVIRONMENTS) {
    const gm = pick(env, { fm: false });
    const fm = pick(env, { fm: true });
    assert.ok(gm.length && fm.length, `${env} resolves both ways`);
    assert.notEqual(gm, fm, `${env}: the FM arm must not return the GM list`);
  }
});

test('AUDIT 19 F2: the building arm folds the way DFU folds it', async () => {
  const { environmentForBuilding, MAGES_GUILD_FACTION, FIGHTERS_GUILD_FACTION } =
    await import('../src/systems/songManager.js');
  const { BUILDING_TYPES: B } = await import('../src/world/buildingNames.js');

  // Eleven mercantile types fold to ONE Shop environment (:465-476).
  for (const t of [B.Alchemist, B.Armorer, B.Bank, B.Bookseller, B.ClothingStore,
    B.FurnitureStore, B.GemStore, B.GeneralStore, B.Library, B.PawnShop, B.WeaponSmith]) {
    assert.equal(environmentForBuilding(t), 'shop', `building type ${t} is a shop`);
  }
  assert.equal(environmentForBuilding(B.Tavern), 'tavern');
  assert.equal(environmentForBuilding(B.Palace), 'palace');

  // A GuildHall is the Mages Guild ONLY when its faction says so (:481-489).
  assert.equal(environmentForBuilding(B.GuildHall, { factionId: MAGES_GUILD_FACTION }), 'magesGuild');
  assert.equal(environmentForBuilding(B.GuildHall, { factionId: 999 }), 'interior');
  assert.equal(environmentForBuilding(B.GuildHall), 'interior', 'no faction is not the Mages Guild');

  // A Temple is FighterTrainers for the Fighters Guild, else its alignment.
  assert.equal(environmentForBuilding(B.Temple, { factionId: FIGHTERS_GUILD_FACTION }), 'fighterTrainers');
  assert.equal(environmentForBuilding(B.Temple, { templeAlignment: 'good' }), 'templeGood');
  assert.equal(environmentForBuilding(B.Temple, { templeAlignment: 'bad' }), 'templeBad');
  // AUDIT 21 (music lane, F4) CORRECTED THIS ASSERTION. It read
  // `assert.equal(environmentForBuilding(B.Temple), 'interior')` with the
  // note "the port has no temple-faction table yet (FLAGGED)" - and the
  // table was in songManager.js all along, so the note was a doc lie AND the
  // behaviour was wrong. SongManager.cs:494-518 has NO else on the temple
  // arm: currentContext.environment is a struct field that persists, so an
  // unresolvable temple leaves the previous environment standing. null is
  // "DFU writes nothing"; holdEnvironment is the caller side.
  assert.equal(environmentForBuilding(B.Temple), null,
    'DFU writes NOTHING for an unresolved temple - it does not write Interior');

  // Houses and anything else are DFU's `default` (:521-523).
  for (const t of [B.House1, B.House6, B.Ship, B.Town4, B.None, 12345]) {
    assert.equal(environmentForBuilding(t), 'interior', `building type ${t} is a plain interior`);
  }
});

test('AUDIT 19 F12: stop() clears the PENDING request, not just the player', async () => {
  const { MusicService } = await import('../src/systems/music.js');
  const svc = new MusicService();
  svc.enabled = true;
  svc.archive = { getSongIndex: () => 0, getSong: () => ({ events: [{ tick: 0 }] }) };

  // No AudioContext yet, so the request is remembered for the gesture hook.
  assert.equal(svc.playSong('DUNGEON.HMI'), false);
  assert.equal(svc._pending, 'DUNGEON.HMI', 'the request is armed for the first gesture');

  svc.stop();
  assert.equal(svc._pending, null,
    'stop() must disarm it - otherwise the next click restarts what was just stopped');
  assert.equal(svc.current, null);
});

// ---------------------------------------------------------------------------
// AUDIT 19, THE 1:1 PASS: SongManager's ENGINE, not just its tables.
//
// The port had the playlists and none of the loop. DFU rebuilds a context
// every frame (UpdateSong, SongManager.cs:198-231) and reacts to the
// difference, and three of its behaviours cannot exist without that:
//   - a new DAY or a new LOCATION re-picks even when the playlist is IDENTICAL
//   - locationIndex is part of the context at all
//   - a finished song re-evaluates the context before the next is chosen
// ---------------------------------------------------------------------------

const CTX = {
  environment: 'city', weather: 'sunny', night: false,
  gameDays: 3, locationIndex: 7, arrested: false,
};

test('AUDIT 19 1:1: an unchanged context does NOT restart the song', async () => {
  const { SongManager } = await import('../src/systems/songManager.js');
  const played = [];
  const sm = new SongManager({ play: (n) => played.push(n) });
  sm.update(CTX);
  for (let i = 0; i < 20; i++) sm.update(CTX);
  assert.equal(played.length, 1, 'twenty identical frames, one song start');
});

test('AUDIT 19 1:1: a NEW DAY re-picks even when the playlist is identical', async () => {
  const { SongManager, SUNNY_SONGS } = await import('../src/systems/songManager.js');
  const played = [];
  const sm = new SongManager({ play: (n) => played.push(n) });
  sm.update(CTX);
  const first = sm.currentPlaylist;
  sm.update({ ...CTX, gameDays: 4 });
  assert.equal(sm.currentPlaylist, first, 'same playlist - still a sunny city');
  assert.equal(sm.currentPlaylist, SUNNY_SONGS);
  assert.equal(played.length, 2, 'and yet the song was re-picked');
  // This is the law a playlist-only comparison cannot express: the lists
  // are the same object, so nothing about them says "choose again".
});

test('AUDIT 19 1:1: a NEW LOCATION re-picks; locationIndex is in the context', async () => {
  const { SongManager, contextEquals } = await import('../src/systems/songManager.js');
  const played = [];
  const sm = new SongManager({ play: (n) => played.push(n) });
  sm.update(CTX);
  const firstSong = sm.currentSong;
  sm.update({ ...CTX, locationIndex: 9 });
  // The selection RE-RUNS - but outside a dungeon the seed is the day, so
  // the same day yields the same song and DFU's PlayCurrentSong guard
  // refuses to restart it. Faithful: walking between two towns on one day
  // does not restart the music. What proves the re-pick happened is that
  // the manager took the branch at all, which a changed DAY makes audible.
  assert.equal(sm.currentSong, firstSong, 'same day, same seed, same song');
  assert.equal(played.length, 1, 'and it is NOT restarted');
  // Change the day too and the re-pick becomes audible.
  sm.update({ ...CTX, locationIndex: 9, gameDays: 4 });
  assert.equal(played.length, 2);

  // And the context equality is DFU's six fields, no more and no fewer.
  const a = { ...CTX };
  assert.equal(contextEquals(a, { ...a }), true);
  for (const field of ['environment', 'weather', 'night', 'gameDays', 'locationIndex', 'arrested']) {
    const b = { ...a, [field]: field === 'night' || field === 'arrested' ? true : 'CHANGED' };
    assert.equal(contextEquals(a, b), false, `${field} must be part of the context`);
  }
  // dungeonKey is NOT part of it - DFU reads it inside SelectCurrentSong,
  // not from the context, so it must not by itself force a re-pick.
  assert.equal(contextEquals(a, { ...a, dungeonKey: 1234 }), true);
});

test('AUDIT 19 1:1: a finished song re-evaluates the context first', async () => {
  const { SongManager } = await import('../src/systems/songManager.js');
  const played = [];
  const sm = new SongManager({ play: (n) => played.push(n) });
  sm.update(CTX);
  assert.equal(played.length, 1);
  // Same context, but the song ended: DFU replays rather than falling silent.
  sm.update(CTX, { songEnded: true });
  assert.equal(played.length, 2, 'the song is replayed, not dropped');
});

test('AUDIT 19 1:1: the playback controls are DFU\'s', async () => {
  const { SongManager, DUNGEON_SONGS } = await import('../src/systems/songManager.js');
  const played = [];
  let stops = 0;
  const sm = new SongManager({ play: (n) => played.push(n), stop: () => stops++ });
  sm.update({ ...CTX, environment: 'dungeonInterior', dungeonKey: 0x1234 });
  const startIndex = sm.currentSongIndex;

  // PlayNextSong / PlayPreviousSong walk the list and WRAP.
  sm.playNextSong();
  assert.equal(sm.currentSongIndex, (startIndex + 1) % DUNGEON_SONGS.length);
  sm.currentSongIndex = DUNGEON_SONGS.length - 1;
  sm.playNextSong();
  assert.equal(sm.currentSongIndex, 0, 'next wraps to the top');
  sm.playPreviousSong();
  assert.equal(sm.currentSongIndex, DUNGEON_SONGS.length - 1, 'previous wraps to the end');

  // StopPlaying silences and LATCHES - a stopped manager must not resume
  // itself on the next context change.
  sm.stopPlaying();
  assert.equal(stops, 1);
  const before = played.length;
  sm.update({ ...CTX, environment: 'tavern', gameDays: 99 });
  assert.equal(played.length, before, 'a stopped manager stays stopped');

  // TogglePlay brings it back, and StartPlaying FORCES - it restarts the
  // song even though currentSong never changed.
  sm.togglePlay();
  assert.ok(played.length > before, 'toggling play resumes');
});

test('AUDIT 19 1:1: the dungeon seed is the header field, over real data', { skip: skipReal }, async () => {
  const { dungeonKey, selectSong, DUNGEON_SONGS } = await import('../src/systems/songManager.js');
  const { MapsFile } = await import('../src/formats/mapsFile.js');
  const B = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const maps = new MapsFile();
  maps.load(B('MAPS.BSA'), B('CLIMATE.PAK'), B('POLITIC.PAK'));

  // SelectCurrentSong seeds DFRandom with the dungeon record header's
  // Unknown2 XOR the region byte. An earlier pass recorded this as
  // "unavailable"; it is not - mapsFile parses unknown2 onto the same
  // header the dungeon host already reads locationId from.
  const spread = {};
  let dungeons = 0;
  const keys = new Set();
  for (let region = 0; region < 62; region++) {
    const reg = maps.getRegion(region);
    if (!reg?.locationCount) continue;
    for (let i = 0; i < reg.locationCount; i++) {
      const loc = maps.getLocation(region, i);
      const h = loc?.hasDungeon ? loc.dungeon?.recordElement?.header : null;
      if (!h) continue;
      dungeons++;
      const key = dungeonKey(h.unknown2 & 0xffff, region);   // DFU casts to ushort
      keys.add(key);
      const pick = selectSong(DUNGEON_SONGS, { dungeonKey: key });
      spread[pick.name] = (spread[pick.name] ?? 0) + 1;
    }
  }
  assert.equal(dungeons, 4232, 'every dungeon in the archive');
  assert.equal(keys.size, 3769, 'and the seeds are genuinely distinct');
  // A near-uniform spread is what a correct seed produces; a broken one
  // collapses onto a handful of songs.
  assert.equal(Object.keys(spread).length, DUNGEON_SONGS.length, 'every dungeon song is reachable');
  const counts = Object.values(spread);
  assert.ok(Math.min(...counts) > 200 && Math.max(...counts) < 360,
    `the spread collapsed: ${JSON.stringify(spread)}`);
});

test('AUDIT 19 1:1: UpdatePlayerMusicEnvironment, every location type', async () => {
  const { musicEnvironment, LOCATION_TYPES: L, MUSIC_ENV: E } =
    await import('../src/systems/songManager.js');
  const out = (locationType) => musicEnvironment({ inLocationRect: true, locationType });

  // SongManager.cs:414-438, the WHOLE switch. Sampling it lets a drifted
  // row through, and one row here is genuinely surprising: HomePoor sits
  // with the DUNGEON EXTERIORS, not with the towns. That reads like a
  // mistake and is not - it is what DFU does, so it is pinned by name.
  assert.equal(out(L.DungeonKeep), E.DungeonExterior);
  assert.equal(out(L.DungeonLabyrinth), E.DungeonExterior);
  assert.equal(out(L.DungeonRuin), E.DungeonExterior);
  assert.equal(out(L.Coven), E.DungeonExterior);
  assert.equal(out(L.HomePoor), E.DungeonExterior, 'HomePoor is DUNGEON music in DFU');
  assert.equal(out(L.Graveyard), E.Graveyard);
  for (const t of [L.HomeFarms, L.HomeWealthy, L.Tavern, L.TownCity, L.TownHamlet,
    L.TownVillage, L.ReligionTemple]) {
    assert.equal(out(t), E.City, `location type ${t} is City music`);
  }
  // DFU's default arm: ReligionCult, HomeYourShips and anything unmapped.
  assert.equal(out(L.ReligionCult), E.Wilderness);
  assert.equal(out(L.HomeYourShips), E.Wilderness);
  assert.equal(out(L.None), E.Wilderness);
  assert.equal(out(9999), E.Wilderness);

  // OUTSIDE a location rect is Wilderness whatever the location says -
  // the rect test comes first (:411-443).
  assert.equal(musicEnvironment({ inLocationRect: false, locationType: L.TownCity }), E.Wilderness);
  assert.equal(musicEnvironment({ inLocationRect: false, locationType: L.Graveyard }), E.Wilderness);

  // Dungeons are checked BEFORE building types, and a castle is its own
  // environment (:448-457).
  assert.equal(musicEnvironment({ inside: true, insideDungeon: true }), E.DungeonInterior);
  assert.equal(musicEnvironment({ inside: true, insideDungeon: true, insideDungeonCastle: true }), E.Castle);

  // And the temple faction tables resolve through the same call.
  const { BUILDING_TYPES } = await import('../src/world/buildingNames.js');
  assert.equal(musicEnvironment({ inside: true, buildingType: BUILDING_TYPES.Temple, factionId: 0x52 }),
    E.TempleGood, 'Arkay is a good temple');
  assert.equal(musicEnvironment({ inside: true, buildingType: BUILDING_TYPES.Temple, factionId: 0x54 }),
    E.TempleBad, "Z'en is a bad temple");
  assert.equal(musicEnvironment({ inside: true, buildingType: BUILDING_TYPES.Temple, factionId: 0x5C }),
    E.TempleNeutral, 'Akatosh is neutral');
});

test('AUDIT 19 1:1: the temple/god faction tables are DFU\'s, whole', async () => {
  const { TEMPLE_FACTIONS, GOD_FACTIONS, TEMPLE_ALIGNMENTS, getTempleIndex, templeAlignment } =
    await import('../src/systems/songManager.js');
  // SongManager.cs:306-320 - two parallel id lists sharing one alignment
  // table by index, which is why GetTempleIndex searches the second only
  // after the first misses.
  assert.deepEqual([...TEMPLE_FACTIONS], [0x52, 0x54, 0x58, 0x5C, 0x5E, 0x62, 0x6A, 0x24]);
  assert.deepEqual([...GOD_FACTIONS], [0x15, 0x16, 0x18, 0x1A, 0x1B, 0x1D, 0x21, 0x23]);
  assert.deepEqual([...TEMPLE_ALIGNMENTS],
    ['good', 'bad', 'good', 'neutral', 'bad', 'good', 'bad', 'neutral']);

  // The two lists agree index for index - a god resolves to its temple's
  // alignment, which is the whole point of the parallel arrays.
  for (let i = 0; i < 8; i++) {
    assert.equal(getTempleIndex(TEMPLE_FACTIONS[i]), i);
    assert.equal(getTempleIndex(GOD_FACTIONS[i]), i);
    assert.equal(templeAlignment(TEMPLE_FACTIONS[i]), templeAlignment(GOD_FACTIONS[i]),
      `god ${GOD_FACTIONS[i]} must align with temple ${TEMPLE_FACTIONS[i]}`);
  }
  assert.equal(getTempleIndex(0), -1);
  assert.equal(templeAlignment(999), null, 'an unknown faction has no alignment');
  // DFU casts to (byte), so an id above 255 takes its low byte.
  assert.equal(getTempleIndex(0x152), getTempleIndex(0x52), 'the (byte) cast is DFU\'s');
});

test('AUDIT 19 1:1: the temple and guild arms resolve on REAL buildings', { skip: skipReal }, async () => {
  const { musicEnvironment, MUSIC_ENV: E } = await import('../src/systems/songManager.js');
  const { MapsFile } = await import('../src/formats/mapsFile.js');
  const { BUILDING_TYPES } = await import('../src/world/buildingNames.js');
  const B = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const maps = new MapsFile();
  maps.load(B('MAPS.BSA'), B('CLIMATE.PAK'), B('POLITIC.PAK'));

  // Two audit passes recorded the building faction id as "not available",
  // which routed every temple and guild hall to the plain-interior default.
  // It IS available - blocksFile parses factionId onto the building record
  // and buildingDataForDoor spreads it through. Measured over the real
  // archive so the claim cannot rot back.
  const seen = {};
  let temples = 0, guilds = 0, scanned = 0;
  outer:
  for (let r = 0; r < 62; r++) {
    const reg = maps.getRegion(r);
    if (!reg?.locationCount) continue;
    for (let i = 0; i < reg.locationCount; i++) {
      const buildings = maps.getLocation(r, i)?.exterior?.buildings;
      if (!buildings) continue;
      for (const b of buildings) {
        scanned++;
        if (b.buildingType !== BUILDING_TYPES.Temple && b.buildingType !== BUILDING_TYPES.GuildHall) continue;
        if (b.buildingType === BUILDING_TYPES.Temple) temples++; else guilds++;
        const env = musicEnvironment({ inside: true, buildingType: b.buildingType, factionId: b.factionId });
        seen[env] = (seen[env] ?? 0) + 1;
      }
      if (scanned > 60000) break outer;
    }
  }
  assert.ok(temples > 500, `expected the temple corpus, saw ${temples}`);
  assert.ok(guilds > 200, `expected the guild corpus, saw ${guilds}`);
  // All three alignments occur, and so does the Fighters Guild arm - if
  // factionId were being dropped, EVERY one of these would be 'interior'.
  for (const env of [E.TempleGood, E.TempleNeutral, E.TempleBad, E.FighterTrainers, E.MagesGuild]) {
    assert.ok(seen[env] > 0, `no real building resolved to ${env} - factionId is not reaching the fold`);
  }
  assert.ok(seen[E.MagesGuild] > 100, 'about half the guild halls are the Mages Guild');
});

test('AUDIT 19: a bend or CC7 during a HELD note reaches it', async () => {
  const { SongPlayer } = await import('../src/systems/songPlayer.js');
  const { bendCents, volumeGain } = await import('../src/systems/gmSynth.js');

  // The archive has 15,017 controller events landing inside a sounding
  // note. Channel state alone is read at note START, so folding them into
  // state made every one of them inaudible until the next note began.
  const detuneWrites = [];
  const gainWrites = [];
  const param = (sink) => ({ value: 0, setValueAtTime: (v, t) => sink.push({ v, t }) });
  const osc = () => ({ type: '', frequency: { value: 0 }, detune: param(detuneWrites),
    connect: () => {}, start: () => {}, stop: () => {} });
  const ctx = {
    currentTime: 0, sampleRate: 44100,
    createOscillator: osc,
    createGain: () => ({ gain: Object.assign(param(gainWrites), {
      setValueAtTime: (v, t) => gainWrites.push({ v, t }),
      linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {},
      cancelScheduledValues: () => {},   // AUDIT 39: stop() cancels the channel automation
    }), connect: () => {} }),
    createStereoPanner: null, destination: {},
  };
  const p = new SongPlayer(ctx);
  p._master = { connect: () => {} };
  p._ensureMaster = () => {};

  const song = {
    secondsPerTick: 0.001, durationTicks: 400,
    events: [
      { tick: 0, type: 'noteOn', channel: 0, note: 60, velocity: 100, duration: 300 },
      { tick: 100, type: 'pitchBend', channel: 0, value: 12288 },
      { tick: 150, type: 'controller', channel: 0, controller: 7, value: 40 },
    ],
  };
  p.play(song);
  clearInterval(p._timer); p._timer = null;

  // The bend must be scheduled AT ITS OWN TIME on the sounding voice, not
  // dropped and not applied at the note's start.
  const bent = detuneWrites.filter((w) => Math.abs(w.v - bendCents(12288)) < 1e-6);
  assert.ok(bent.length >= 1, 'the bend never reached the sounding note');
  assert.ok(bent.every((w) => w.t > 0), 'and it is scheduled at its own tick, not at note-on');

  // CC7 must land on the CHANNEL, so it affects everything sounding on it
  // and cannot fight the per-note envelope.
  const vol = gainWrites.filter((w) => Math.abs(w.v - volumeGain(40)) < 1e-6);
  assert.ok(vol.length >= 1, 'CC7 never reached the channel gain');
  p.stop();
});

/** A WebIDL-FAITHFUL AudioContext double: AudioParam methods take
 *  restricted doubles and AudioScheduledSourceNode.stop() a double, so a
 *  non-finite time is a TypeError in a real browser and must be one
 *  here. The suite's older doubles accept anything, which is why the
 *  hanging-pedal throw below went unseen. */
function strictCtx() {
  const finite = (t) => {
    if (!Number.isFinite(t)) throw new TypeError('non-finite value provided for a restricted double');
    return t;
  };
  const cancels = [];
  const param = () => ({
    value: 0,
    setValueAtTime(v, t) { finite(t); this.value = v; },
    linearRampToValueAtTime(v, t) { finite(t); },
    exponentialRampToValueAtTime(v, t) { finite(t); },
    cancelScheduledValues(t) { finite(t); cancels.push(t); },
  });
  const osc = () => ({
    type: '', frequency: param(), detune: param(),
    connect: () => {}, start: (t) => finite(t), stop: (t) => { if (t !== undefined) finite(t); },
  });
  return {
    currentTime: 0, sampleRate: 44100, destination: {}, cancels,
    createOscillator: osc,
    createGain: () => ({ gain: param(), connect: () => {} }),
    createBufferSource: () => ({ buffer: null, connect: () => {}, start: (t) => finite(t), stop: (t) => { if (t !== undefined) finite(t); } }),
    createBiquadFilter: () => ({ type: '', frequency: param(), Q: param(), connect: () => {} }),
    createBuffer: (ch, n) => ({ getChannelData: () => new Float32Array(n) }),
    createStereoPanner: null,
  };
}

test('AUDIT 39: a pedal left down at the end does not take the pump with it', async () => {
  const { SongPlayer } = await import('../src/systems/songPlayer.js');
  // The pedal map used to close an unlifted CC64 at Infinity, so
  // sustainedDuration returned Infinity for the hanging chord and _voice
  // handed setValueAtTime/stop a non-finite time. That throws out of the
  // `for (const e of window)` loop BEFORE `this._cursorTick = toTick`, so
  // the same window was re-voiced on every pump - a burst of repeated
  // notes - and the hanging chord never sounded at all, on every loop of
  // that song.
  const ctx = strictCtx();
  const p = new SongPlayer(ctx);
  const song = {
    secondsPerTick: 0.001, durationTicks: 400,
    events: [
      { tick: 0, type: 'controller', channel: 0, controller: 64, value: 127 },   // pedal down, never lifted
      { tick: 10, type: 'noteOn', channel: 0, note: 60, velocity: 100, duration: 20 },
      { tick: 20, type: 'noteOn', channel: 9, note: 36, velocity: 100, duration: 20 },
    ],
  };
  assert.equal(p.play(song), true);
  clearInterval(p._timer); p._timer = null;
  assert.ok(p._cursorTick > 0, 'the cursor advanced - the window was scheduled, not thrown out of');
  assert.deepEqual([...p._sustain.get(0)], [[0, 400]], 'the pedal closes at the song end');
  p.stop();

  // ...and the graph is guarded at the boundary too: a note handed a
  // non-finite length falls back to the same default a missing one gets.
  const q = new SongPlayer(strictCtx());
  q._state = { 0: { program: 0, volume: 1, pan: 0, bend: 0 } };
  q._ensureMaster();
  assert.doesNotThrow(() => q._voice({ tick: 0, type: 'noteOn', channel: 0, note: 60, velocity: 100 }, 0, Infinity));
});

test('AUDIT 39: a song change CANCELS the channel automation it is leaving behind', async () => {
  const { SongPlayer } = await import('../src/systems/songPlayer.js');
  const { volumeGain } = await import('../src/systems/gmSynth.js');
  // _control schedules CC7 at absolute future times up to a full
  // lookahead ahead, and setValueAtTime only INSERTS an event - it does
  // not clear later ones. Without a cancel, a CC7 from the song being
  // left behind fires after the new song's tick-0 CC7 (whose origin is
  // only currentTime + 0.06) and holds that channel at the old volume.
  const ctx = strictCtx();
  const p = new SongPlayer(ctx);
  const song = (vol) => ({
    secondsPerTick: 0.001, durationTicks: 400,
    events: [
      { tick: 0, type: 'noteOn', channel: 0, note: 60, velocity: 100, duration: 10 },
      { tick: 100, type: 'controller', channel: 0, controller: 7, value: vol },   // inside the first lookahead, scheduled AHEAD
    ],
  });
  p.play(song(20));
  clearInterval(p._timer); p._timer = null;
  const g = p._chGains[0];
  assert.ok(g, 'the channel gain node exists');
  assert.ok(Math.abs(g.gain.value - volumeGain(20)) < 1e-9, 'the old song scheduled its CC7 ahead');

  ctx.cancels.length = 0;
  p.play(song(100));
  clearInterval(p._timer); p._timer = null;
  assert.ok(ctx.cancels.length >= 1, 'the reset cancelled the pending automation first');
  assert.equal(p._chGains[0], g, 'the nodes outlive the song - which is why they must be cancelled');

  // stop() leaves none behind either.
  ctx.cancels.length = 0;
  p.stop();
  assert.ok(ctx.cancels.length >= 1, 'a stopped song leaves no automation on the graph');
});

// ---------------------------------------------------------------------------
// AUDIT 21: the constants the mutation campaign found unpinned. All three are
// DFU LAW read out of C# enums, not port choices - and an unpinned constant is
// right only until someone edits it.
// ---------------------------------------------------------------------------

test('AUDIT 21: the guild faction ids are FactionFile\'s', async () => {
  const { MAGES_GUILD_FACTION, FIGHTERS_GUILD_FACTION, environmentForBuilding, MUSIC_ENV } =
    await import('../src/systems/songManager.js');
  const { BUILDING_TYPES } = await import('../src/world/buildingNames.js');
  // FactionFile.cs:89-90. These select the Mages Guild and FighterTrainers
  // music arms, so a wrong id silently routes both to the plain interior.
  assert.equal(MAGES_GUILD_FACTION, 40);
  assert.equal(FIGHTERS_GUILD_FACTION, 41);
  // And they must be the ids the fold actually tests against.
  assert.equal(environmentForBuilding(BUILDING_TYPES.GuildHall, { factionId: 40 }), MUSIC_ENV.MagesGuild);
  assert.equal(environmentForBuilding(BUILDING_TYPES.GuildHall, { factionId: 41 }), MUSIC_ENV.Interior);
  assert.equal(environmentForBuilding(BUILDING_TYPES.Temple, { factionId: 41 }), MUSIC_ENV.FighterTrainers);
  // AUDIT 21 (music lane, F4): a Temple whose faction resolves to no
  // alignment takes DFU's no-op else, not Interior - see the F2 pin above.
  assert.equal(environmentForBuilding(BUILDING_TYPES.Temple, { factionId: 40 }), null);
});

test('AUDIT 21: LOCATION_TYPES is DFRegion\'s enum, whole', async () => {
  const { LOCATION_TYPES } = await import('../src/systems/songManager.js');
  // DFRegion.cs - the values the environment switch indexes on. Pinned
  // WHOLE: a drifted value silently moves a location into another arm, and
  // the switch is written by name so nothing else would notice.
  assert.deepEqual({ ...LOCATION_TYPES }, {
    TownCity: 0, TownHamlet: 1, TownVillage: 2, HomeFarms: 3,
    DungeonLabyrinth: 4, ReligionTemple: 5, Tavern: 6, DungeonKeep: 7,
    HomeWealthy: 8, ReligionCult: 9, DungeonRuin: 10, HomePoor: 11,
    Graveyard: 12, Coven: 13, HomeYourShips: 14, None: 0xffff,
  });
});

test('AUDIT 21: the manager routes the TAVERN arm, and only for taverns', async () => {
  const { SongManager, TAVERN_SONGS } = await import('../src/systems/songManager.js');
  const played = [];
  const sm = new SongManager({ play: (n) => played.push(n) });

  // The tavern arm is `gameDays % length` with NO generator, so consecutive
  // days walk the list in sequence. Nothing else does that - if the manager
  // stopped routing it, the day seed would scatter instead.
  const seen = [];
  for (let d = 0; d < TAVERN_SONGS.length * 2; d++) {
    sm.update({ environment: 'tavern', weather: 'sunny', night: false,
      gameDays: d, locationIndex: 1, arrested: false });
    seen.push(sm.currentSongIndex);
  }
  assert.deepEqual(seen, [...TAVERN_SONGS.keys(), ...TAVERN_SONGS.keys()],
    'taverns walk the list in sequence, twice around');

  // And a non-tavern environment must NOT take that arm.
  const sm2 = new SongManager({ play: () => {} });
  const walk = [];
  for (let d = 0; d < 8; d++) {
    sm2.update({ environment: 'city', weather: 'sunny', night: false,
      gameDays: d, locationIndex: 1, arrested: false });
    walk.push(sm2.currentSongIndex);
  }
  assert.notDeepEqual(walk, [...walk.keys()].map((i) => i % 7),
    'a city must not walk in sequence - it takes the day SEED');
});

test('AUDIT 21: playPrevious wraps at the boundary, not near it', async () => {
  const { SongManager, DUNGEON_SONGS } = await import('../src/systems/songManager.js');
  const sm = new SongManager({ play: () => {} });
  sm.update({ environment: 'dungeonInterior', weather: 'sunny', night: false,
    gameDays: 1, locationIndex: 1, arrested: false, dungeonKey: 7 });

  // From 1 it must step to 0, NOT wrap. Testing only from 0 leaves the
  // boundary comparison free to be `< 1` - which the mutation campaign
  // found surviving.
  sm.currentSongIndex = 1;
  sm.playPreviousSong();
  assert.equal(sm.currentSongIndex, 0, 'index 1 steps down to 0');
  sm.playPreviousSong();
  assert.equal(sm.currentSongIndex, DUNGEON_SONGS.length - 1, 'and 0 wraps to the end');
  // Likewise the top boundary.
  sm.currentSongIndex = DUNGEON_SONGS.length - 2;
  sm.playNextSong();
  assert.equal(sm.currentSongIndex, DUNGEON_SONGS.length - 1, 'steps up to the last');
  sm.playNextSong();
  assert.equal(sm.currentSongIndex, 0, 'and then wraps');
});

test('AUDIT 21: a manager starts PLAYING, and stop latches', async () => {
  const { SongManager } = await import('../src/systems/songManager.js');
  const sm = new SongManager({ play: () => {}, stop: () => {} });
  // DFU's `playSong` initialises TRUE - a manager that started false would
  // be silent until something toggled it, which nothing does on boot.
  assert.equal(sm.playSong, true);
  sm.stopPlaying();
  assert.equal(sm.playSong, false);
  sm.startPlaying();
  assert.equal(sm.playSong, true);
});

test('AUDIT 21 F1: the music context is fed BEFORE the modal return', () => {
  // worldModes.frame() consumes the frame and returns TRUE for interior and
  // dungeon; worldModes.musicContext() returns null ONLY for exterior. They
  // are the same predicate - so with the director fed AFTER the early
  // return it ran exclusively on frames where the overlay was guaranteed
  // null. Entering a tavern kept the street song, entering a dungeon kept
  // the sunny outdoor track, and once that song ended nothing fed
  // `songEnded` so it fell silent for the rest of the visit.
  //
  // This is a SOURCE-ORDER pin and that is a weak instrument - this very
  // audit found regex pins passing while code was dead. It is here because
  // these hosts have no execution coverage in node at all. The real proof
  // is tools/musicHostProbe.mjs, which drives a browser into a building and
  // reads the resolved environment on both sides:
  //     outdoors GDAY___D.HMI / city     -> inside 23.HMI / interior
  // and with the ordering reverted, inside stays city and the song never
  // changes. Run it when touching either host's frame loop.
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const text = readFileSync(host, 'utf8');
    const feed = text.indexOf('musicDirector.update(');
    const modal = text.indexOf('if (modes.frame(dt, now)) {');
    assert.ok(feed > 0 && modal > 0, `${host}: both seams must exist`);
    assert.ok(feed < modal,
      `${host}: the music context must be fed BEFORE the modal early return - `
      + 'after it, the mode host\'s overlay is always null and interior music is dead code');
  }
});
