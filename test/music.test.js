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

test('A5b/AUDIT 19: every host reaches music through ITS OWN seam', () => {
  // A source sweep, stated honestly: these hosts have no execution coverage
  // in node. AUDIT 19 also showed how weak a text sweep is - a regex pin let
  // a completely dead memo ship - so this asserts STRUCTURE that a defect
  // would actually have to break, and the behavioural half lives in
  // tools/bootProbe.mjs, which drives a real boot and reports whether music
  // is playing.
  const wm = readFileSync('src/scenes/worldModes.js', 'utf8');
  // AUDIT 19: EVERY building arm, not only the tavern - shops, palaces,
  // the Mages Guild and the temple alignments each have their own list.
  assert.match(wm, /environmentForBuilding\(interiorBuilding\.buildingType/,
    'entering a building resolves its music ENVIRONMENT');
  assert.match(wm, /playlistForEnvironment\(env\)/, 'and takes that environment\'s list');
  assert.match(wm, /tavern: env === 'tavern'/,
    'the tavern keeps the DIRECT gameDays arm - it is the one list DFU indexes that way');
  assert.match(wm, /if \(interiorBuilding\) resumeOutdoorMusic/,
    'leaving ANY interior resumes the street, not just a tavern');
  // BOTH exits hand the street back its song. F3 found the dungeon exit had
  // no caller at all, so dungeon music looped over the sunlit city forever.
  const resumes = wm.match(/resumeOutdoorMusic\?\.\(\)/g) ?? [];
  assert.equal(resumes.length, 2,
    'the interior exit AND the dungeon exit must both resume outdoor music');

  for (const host of ['src/scenes/exterior.js', 'src/scenes/world.js']) {
    const text = readFileSync(host, 'utf8');
    assert.match(text, /outdoorPlaylist\(\{ night, weather \}\)/,
      `${host} never picks an outdoor playlist`);
    assert.match(text, /resumeOutdoorMusic: startOutdoorMusic/,
      `${host} must hand worldModes the SAME seam it uses itself`);
    // AUDIT 19 F4: gameDays must come from the CUMULATIVE clock. minuteNow()
    // ends in `% 1440`, so deriving it there is structurally zero forever.
    assert.match(text, /playerTicker\.classicMinutes \/ 1440/,
      `${host} must take gameDays from the cumulative clock`);
    assert.ok(!/Math\.floor\(minuteNow\(\) \/ 1440\)/.test(text),
      `${host}: gameDays from minuteNow() is identically 0`);
    // F5: nightfall must re-pick, or night never brings night music.
    assert.match(text, /updateOutdoorMusic\(\)/, `${host} never re-evaluates at nightfall`);
  }
  // And the dungeon host takes the dungeon list, not an outdoor one.
  const dc = readFileSync('src/scenes/dungeonContext.js', 'utf8');
  assert.match(dc, /music\.playFrom\(DUNGEON_SONGS/, 'the dungeon host plays dungeon music');
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
  // An unresolved temple falls to Interior rather than inventing an
  // alignment - the port has no temple-faction table yet (FLAGGED).
  assert.equal(environmentForBuilding(B.Temple), 'interior');

  // Houses and anything else are DFU's `default` (:521-523).
  for (const t of [B.House1, B.House6, B.Ship, B.Town4, B.None, 12345]) {
    assert.equal(environmentForBuilding(t), 'interior', `building type ${t} is a plain interior`);
  }
});
