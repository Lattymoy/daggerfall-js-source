// SEA-SCORE (2026-10-24, the owner: "different music and ambience sounds for sailing"): THE SEA'S MUSIC
// (systems/soundscape/seaScore.js) - six songs written as notes for the game's own player and FM bank, and the law of which
// plays at a helm. The songs: their names beside MIDI.BSA's and every made score's, their tempos, bars and lengths, whole
// bars that loop on their bar line with nothing past the end; every voice's program, level and place at their start;
// one note a key a moment; the voices and the kit the songs carry, inside the player's ranges; made once. The tunes: every
// bar whole, each in its mode (the still sea's Dorian sixth, the shanty's flat seventh, the storm's Aeolian, the night's
// Dorian, landfall's D major) over its harmony; the arrangements' landmarks. The law: no helm, no score; a fight, a
// storm, a port, the night, a drift or a fog, the open sea - each arm and its boundary. The hold: a song kept, a fight
// and a storm through it at once, a fight's tail, a helm let go at once and a new helm afresh.
// Measured through the real player in a browser, beside Daggerfall's own outdoor songs: tools/seaScoreProbe.mjs.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  seaScoreSongs, seaScoreFor, createSeaScore, tune, SEA_SONGS, SEA_SCORE_SILENCE, SEA_CALM_WAY, SEA_SCORE_HOLD_MS,
  SEA_FIGHT_TAIL_MS, SEA_SCORE_SETTLE_MS, seaSongMs, SEA_SHAPE, SEA_PROGRAMS, SEA_CHANNELS, SEA_MIX, SEA_KIT_LEVEL, SEA_VOICES, SEA_KIT, SEA_LEVEL,
  SEA_TUNES, SEA_CHORDS,
} from '../../../src/systems/soundscape/seaScore.js';
import { gateScoreSongs, midiNote, SCORE_TPQ } from '../../../src/systems/gate/gateScore.js';
import { sdScoreSongs } from '../../../src/systems/superDungeon/sdScore.js';
import { arenaScoreSongs } from '../../../src/systems/arena/arenaScore.js';
import { SPIRE_SONGS } from '../../../src/systems/eliteGates/egScore.js';
import { SONG_FILES, songFileToRecordName } from '../../../src/systems/song/songFiles.js';
import { songVoices, songKit, songLevel } from '../../../src/systems/song/songPlayer.js';

const KEYS = ['calm', 'open', 'storm', 'night', 'port', 'fight'];
const notesOf = (song) => song.events.filter((e) => e.type === 'noteOn');
const onChannel = (song, voice) => notesOf(song).filter((e) => e.channel === SEA_CHANNELS[voice]);
const barTicks = (key) => SEA_SHAPE[key].beats * SCORE_TPQ;
const pcs = (bars) => new Set(bars.flat().filter(([n]) => n !== null).map(([n]) => n % 12));
const scale = (...names) => new Set(names.map((n) => midiNote(`${n}4`) % 12));

// ── the songs ─────────────────────────────────────────────────────────

test('SEA-SCORE THE SONGS: six, by their own names - eight and three, beside every MIDI.BSA song\'s and every made score\'s; at their tempos, bars and lengths; whole bars that loop on their bar line, nothing past the end, in tick order; at their own levels, no press; made once, the same notes every time (mutants: a song unmade; a tempo moved; a bar\'s length lost; the end unclamped; a level moved)', () => {
  const songs = seaScoreSongs();
  assert.equal(seaScoreSongs(), songs, 'made once');
  assert.deepEqual(Object.keys(songs), KEYS);
  assert.deepEqual({ ...SEA_SONGS }, { calm: 'SEACALM.HMI', open: 'SEAOPEN.HMI', storm: 'SEASTORM.HMI', night: 'SEANIGHT.HMI', port: 'SEAPORT.HMI', fight: 'SEAFIGHT.HMI' });
  const taken = new Set([
    ...SONG_FILES.map((n) => songFileToRecordName(n)),
    ...Object.values(gateScoreSongs()).map((s) => s.name), ...Object.values(sdScoreSongs()).map((s) => s.name),
    ...Object.values(arenaScoreSongs()).map((s) => s.name), ...Object.values(SPIRE_SONGS),
  ]);
  assert.deepEqual({ ...SEA_SHAPE }, {
    calm: { bpm: 84, bars: 64, beats: 3 }, open: { bpm: 100, bars: 48, beats: 4 }, storm: { bpm: 126, bars: 48, beats: 4 },
    night: { bpm: 66, bars: 32, beats: 3 }, port: { bpm: 156, bars: 64, beats: 3 }, fight: { bpm: 144, bars: 48, beats: 4 },
  });
  assert.deepEqual({ ...SEA_LEVEL }, { calm: 2.8, open: 2, storm: 2.1, night: 2.4, port: 2.1, fight: 1.95 });
  const names = new Set();
  for (const k of KEYS) {
    const s = songs[k], { bpm, bars, beats } = SEA_SHAPE[k];
    assert.equal(s.name, SEA_SONGS[k]);
    assert.match(s.name, /^SEA[A-Z]{4,5}\.HMI$/, 'eight and three, as the game\'s own');
    assert.ok(!taken.has(s.name), `${s.name} is nobody else's`);
    names.add(s.name);
    assert.equal(s.beatsPerMinute, bpm, `${k}'s tempo`);
    assert.equal(s.durationTicks, bars * beats * SCORE_TPQ, `${k}: whole bars`);
    assert.ok(Math.abs(s.secondsPerTick - 60 / (bpm * SCORE_TPQ)) < 1e-12);
    assert.equal(s.seamless, true, 'loops on its bar line');
    assert.equal(s.press, null, 'unpressed: a helm\'s songs stand where the day songs stand, not over them');
    assert.equal(songLevel(s), SEA_LEVEL[k], `${k}'s level, inside the player's range`);
    const n = notesOf(s);
    assert.ok(n.every((e) => e.tick >= 0 && e.tick < s.durationTicks && e.tick + e.duration <= s.durationTicks), `${k}: nothing past its end`);
    assert.ok(n.every((e) => e.velocity >= 1 && e.velocity <= 127 && e.duration >= 1 && e.note >= 0 && e.note <= 127));
    for (let i = 1; i < s.events.length; i++) assert.ok(s.events[i].tick >= s.events[i - 1].tick, `${k}: in tick order`);
    const secs = s.durationTicks * s.secondsPerTick;
    assert.ok(secs >= 60 && secs <= 150, `${k}: a minute to two and a half (${secs.toFixed(1)} s)`);
  }
  assert.equal(names.size, 6);
  // the harp lets the calm's last chord ring past the seam: the clamp is what stops it there
  const calm = songs.calm, lastHarp = onChannel(calm, 'harp').filter((e) => e.tick >= calm.durationTicks - barTicks('calm'));
  assert.ok(lastHarp.some((e) => e.tick + e.duration === calm.durationTicks), 'the last bar\'s ring stops at the seam');
});

test('SEA-SCORE THE BAND: fifteen voices and the kit, one a channel, the kit on GM\'s own channel 9; every voice\'s program, level and place at tick 0 of every song, before its first note, and the kit\'s level; one note a key a moment, and a key struck again ending the note before it (AUDIT SOUNDSCAPE M5); the drive\'s bow spoken and stopped inside a sixteenth of the storm; the voices and the drums the songs carry, every field inside the player\'s range (mutants: a voice unset; a doubled note-on struck twice; a key re-struck under its own note; the drive on the cello\'s slow bow; the fiddle on GM\'s plucked fiddle; the accordion\'s reeds in tune)', () => {
  assert.deepEqual({ ...SEA_PROGRAMS }, {
    fiddle: 40, flute: 73, whistle: 78, accordion: 21, harp: 46, pizz: 45, strings: 48, cello: 42, bass: 43, choir: 52, horn: 60, brass: 61, timpani: 47, bells: 14, drive: 42,
  });
  assert.equal(SEA_CHANNELS.drive, 15);
  const d = SEA_VOICES.drive;
  assert.ok(d.attack + d.decay <= 60 / SEA_SHAPE.storm.bpm / 4 - 0.02 && d.release <= 0.06, 'the drive speaks and stops inside the storm\'s sixteenth');
  assert.equal(SEA_CHANNELS.kit, 9, 'GM\'s own drum channel');
  assert.equal(new Set(Object.values(SEA_CHANNELS)).size, Object.keys(SEA_CHANNELS).length, 'one voice a channel');
  assert.deepEqual(Object.keys(SEA_MIX), Object.keys(SEA_PROGRAMS));
  assert.equal(SEA_VOICES.accordion.unison, 2); assert.ok(SEA_VOICES.accordion.cents >= 10, 'the musette\'s beat');
  for (const k of KEYS) {
    const s = seaScoreSongs()[k];
    for (const [voice, program] of Object.entries(SEA_PROGRAMS)) {
      const ch = SEA_CHANNELS[voice];
      const at0 = s.events.filter((e) => e.tick === 0 && e.channel === ch && e.type !== 'noteOn');
      assert.ok(at0.some((e) => e.type === 'programChange' && e.program === program), `${k}: ${voice}'s program`);
      assert.ok(at0.some((e) => e.controller === 7 && e.value === SEA_MIX[voice][0]), `${k}: ${voice}'s level`);
      assert.ok(at0.some((e) => e.controller === 10 && e.value === SEA_MIX[voice][1]), `${k}: ${voice}'s place`);
      const first = s.events.findIndex((e) => e.channel === ch && e.type === 'noteOn');
      const prog = s.events.findIndex((e) => e.channel === ch && e.type === 'programChange');
      if (first >= 0) assert.ok(prog < first, `${k}: ${voice}'s program before its first note`);
    }
    assert.ok(s.events.some((e) => e.tick === 0 && e.channel === 9 && e.controller === 7 && e.value === SEA_KIT_LEVEL), `${k}: the kit's level`);
    const seen = new Set();
    for (const e of notesOf(s)) {
      const key = `${e.tick}:${e.channel}:${e.note}`;
      assert.ok(!seen.has(key), `${k}: one note a key a moment (${key})`);
      seen.add(key);
    }
    const byKey = new Map();
    for (const e of notesOf(s)) if (e.channel !== 9) { const kk = e.channel * 128 + e.note; byKey.set(kk, [...(byKey.get(kk) ?? []), e]); }
    for (const list of byKey.values()) {
      list.sort((a, b) => a.tick - b.tick);
      for (let i = 0; i + 1 < list.length; i++) assert.ok(list[i].tick + list[i].duration <= list[i + 1].tick, `${k}: channel ${list[i].channel} key ${list[i].note} struck again under itself at ${list[i + 1].tick}`);
    }
    // the voices as the player reads them: every field the score asks for held as asked (inside the range)
    const v = songVoices(s);
    assert.ok(v, `${k} carries its voices`);
    for (const [voice, spec] of Object.entries(SEA_VOICES)) assert.deepEqual(v[SEA_CHANNELS[voice]], { ...spec }, `${k}: ${voice}'s voice`);
    const kit = songKit(s);
    assert.ok(kit, `${k} carries its drums`);
    for (const [key, spec] of Object.entries(SEA_KIT)) assert.deepEqual(kit.get(Number(key)), { ...spec }, `${k}: drum ${key}`);
  }
});

// ── the tunes ─────────────────────────────────────────────────────────

test('SEA-SCORE THE TUNES: every bar of every tune whole in its song\'s bar, a chord a bar beside it; each in its mode - the still sea\'s Dorian (B natural, never B-flat), the shanty\'s flat seventh (F natural over its F chord, F sharp only over D), the storm\'s Aeolian (B-flat, never B), the night\'s Dorian (F sharp, never F), landfall in D major; the sea fight\'s Andalusian fall; the harmony as written (mutants: the Dorian sixth flattened; the shanty\'s seventh sharpened; the storm\'s B natural; the night\'s F natural; a beat lost from a bar; a chord moved)', () => {
  const songOf = { calmA: 'calm', calmB: 'calm', openA: 'open', openB: 'open', storm: 'storm', night: 'night', portA: 'port', portB: 'port', fightA: 'fight', fightB: 'fight' };
  assert.deepEqual(Object.keys(SEA_TUNES), Object.keys(songOf));
  for (const [t, bars] of Object.entries(SEA_TUNES)) {
    const beats = SEA_SHAPE[songOf[t]].beats;
    bars.forEach((bar, i) => assert.ok(Math.abs(bar.reduce((a, [, b]) => a + b, 0) - beats) < 1e-9, `${t} bar ${i + 1} is ${beats} beats`));
    assert.equal(SEA_CHORDS[t].length, bars.length, `${t}: a chord a bar`);
  }
  const inMode = (bars, mode) => [...pcs(bars)].every((p) => mode.has(p));
  assert.ok(inMode([...SEA_TUNES.calmA, ...SEA_TUNES.calmB], scale('D', 'E', 'F', 'G', 'A', 'B', 'C')) && pcs(SEA_TUNES.calmA).has(11), 'D Dorian, its sixth sounding');
  assert.ok(inMode([...SEA_TUNES.storm], scale('D', 'E', 'F', 'G', 'A', 'Bb', 'C')) && pcs(SEA_TUNES.storm).has(10), 'D Aeolian, its flat sixth sounding');
  assert.ok(inMode(SEA_TUNES.night, scale('A', 'B', 'C', 'D', 'E', 'F#', 'G')) && pcs(SEA_TUNES.night).has(6), 'A Dorian, its sixth sounding');
  assert.ok(inMode([...SEA_TUNES.portA, ...SEA_TUNES.portB], scale('D', 'E', 'F#', 'G', 'A', 'B', 'C#')), 'D major');
  // the shanty: G Mixolydian's F natural over the F chord, the F sharp only where the chord is D
  const open = [...SEA_TUNES.openA, ...SEA_TUNES.openB], openChords = [...SEA_CHORDS.openA, ...SEA_CHORDS.openB];
  open.forEach((bar, i) => {
    for (const [n] of bar) {
      if (n === null) continue;
      if (n % 12 === 6) assert.equal(openChords[i], 'D', `the F sharp only over D (bar ${i + 1})`);
      if (n % 12 === 5) assert.equal(openChords[i], 'F', `the F natural over its F chord (bar ${i + 1})`);
    }
  });
  assert.ok(open.flat().some(([n]) => n !== null && n % 12 === 5), 'the flat seventh sounds');
  assert.deepEqual([...SEA_CHORDS.fightA], ['Dm', 'C', 'Bb', 'A', 'Dm', 'C', 'Bb', 'A'], 'i - VII - VI - V');
  assert.deepEqual({ ...SEA_CHORDS }, {
    calmA: ['Dm', 'G', 'Dm', 'C', 'F', 'C', 'G', 'Am', 'Dm', 'G', 'Dm', 'C', 'F', 'C', 'G', 'Dm'],
    calmB: ['F', 'C', 'G', 'Dm', 'F', 'C', 'Am', 'Am', 'F', 'G', 'Em', 'Am', 'F', 'C', 'G', 'Dm'],
    openA: ['G', 'C', 'G', 'D', 'G', 'F', 'D', 'G'], openB: ['C', 'G', 'C', 'D', 'Em', 'C', 'D', 'G'],
    storm: ['Dm', 'Bb', 'C', 'Dm', 'Dm', 'Gm', 'Bb', 'A'], stormB: ['F', 'C', 'Dm', 'Bb', 'Gm', 'Dm', 'A', 'A'],
    night: ['Am', 'G', 'D', 'Am', 'C', 'G', 'Em', 'Am', 'C', 'G', 'Am', 'Em', 'D', 'C', 'Em', 'Am'],
    portA: ['D', 'G', 'D', 'A', 'D', 'G', 'A', 'D'], portB: ['D', 'G', 'D', 'A', 'Bm', 'G', 'A', 'D'],
    fightA: ['Dm', 'C', 'Bb', 'A', 'Dm', 'C', 'Bb', 'A'], fightB: ['F', 'C', 'Gm', 'A', 'Dm', 'Bb', 'A', 'Dm'],
  });
  // the tune parser: a name and a length, a rest, bars by the bar line; a note with no length refused
  assert.deepEqual(tune('A4:1.5 r:.5 | D5:3').map((b) => b.map((x) => [...x])), [[[69, 1.5], [null, 0.5]], [[74, 3]]]);
  assert.throws(() => tune('A4 D5:1'), /no length/);
});

test('SEA-SCORE THE ARRANGEMENTS: the still sea\'s harp rolling six eighths a bar under all of it, its strings from the second pass and its choir from the fourth; the open sea\'s accordion on two and four and its horns under the second pass alone; the storm\'s drive in eighths in every bar; the night\'s two bells, far off, at the head of each half; landfall\'s fiddle a diatonic third under the whistle the second time through; the sea fight\'s snare on two and four (mutants: the strings early; the harp\'s roll thinned; the third a second; a bell rung loud; the snare\'s backbeat moved)', () => {
  const s = seaScoreSongs();
  const bar = (key, n) => n * barTicks(key);
  // SEACALM
  const harp = onChannel(s.calm, 'harp');
  for (let b = 0; b < SEA_SHAPE.calm.bars; b++) assert.equal(harp.filter((e) => e.tick >= bar('calm', b) && e.tick < bar('calm', b + 1)).length, 6, `calm bar ${b}: the harp's six`);
  assert.equal(Math.min(...onChannel(s.calm, 'strings').map((e) => e.tick)), bar('calm', 16), 'the strings from the second pass');
  assert.equal(Math.min(...onChannel(s.calm, 'choir').map((e) => e.tick)), bar('calm', 48), 'the choir from the fourth');
  // SEAOPEN
  const acc = onChannel(s.open, 'accordion').filter((e) => e.tick < bar('open', 16));
  assert.ok(acc.length > 0 && acc.every((e) => [1, 3].includes((e.tick % barTicks('open')) / SCORE_TPQ)), 'the accordion on two and four the first time');
  const horn = onChannel(s.open, 'horn');
  assert.ok(horn.length > 0 && horn.every((e) => e.tick >= bar('open', 16) && e.tick < bar('open', 32)), 'the horns under the second pass alone');
  // SEASTORM
  const drive = onChannel(s.storm, 'drive').filter((e) => e.note < 60);   // the low eighths (the unrest's sixteenths ride the same bow, high)
  for (let b = 0; b < SEA_SHAPE.storm.bars; b++) assert.equal(drive.filter((e) => e.tick >= bar('storm', b) && e.tick < bar('storm', b + 1)).length, 8, `storm bar ${b}: the drive's eight`);
  // SEANIGHT
  assert.deepEqual(onChannel(s.night, 'bells').map((e) => [e.tick, e.note, e.velocity]), [[0, midiNote('A3'), 40], [bar('night', 16), midiNote('E4'), 36]]);
  // SEAPORT: the second time, every whistle note has the fiddle a diatonic third (three or four semitones) under it
  const whistle = onChannel(s.port, 'whistle').filter((e) => e.tick >= bar('port', 32));
  const fiddle = onChannel(s.port, 'fiddle').filter((e) => e.tick >= bar('port', 32));
  assert.ok(whistle.length > 100);
  for (const e of whistle) {
    const f = fiddle.find((x) => x.tick === e.tick);
    assert.ok(f && [3, 4].includes(e.note - f.note), `the third under at ${e.tick}`);
  }
  // SEAFIGHT
  const snare = notesOf(s.fight).filter((e) => e.channel === 9 && e.note === 38);
  for (let b = 0; b < SEA_SHAPE.fight.bars; b++) {
    const beats = snare.filter((e) => e.tick >= bar('fight', b) && e.tick < bar('fight', b + 1) && e.velocity >= 90).map((e) => (e.tick - bar('fight', b)) / SCORE_TPQ);
    assert.deepEqual(beats, [1, 3], `fight bar ${b}: the backbeat`);
  }
});

// ── the law ───────────────────────────────────────────────────────────

test('SEA-SCORE THE LAW: no helm, no score - the director stands; at a helm a fight first, then a thunderstorm, then a port\'s approach, then the night, then a drift (under SEA_CALM_WAY, or no way at all) or a fog, else the open sea - rain, snow and a sandstorm at sea the open sea\'s, never the storm\'s (mutants: the port before the storm; the calm line moved; the fog unheard; the rain a storm; the night before the port)', () => {
  assert.equal(SEA_CALM_WAY, 2.5);
  assert.equal(SEA_SCORE_SILENCE, 'silence');
  const S = SEA_SONGS;
  const at = (o) => seaScoreFor({ sailing: true, weather: 'sunny', way: 6, ...o });
  assert.equal(seaScoreFor(null), null);
  assert.equal(seaScoreFor(undefined), null);
  assert.equal(seaScoreFor({ sailing: false, fight: true, weather: 'thunder', nearPort: true }), null, 'no helm, no score');
  assert.equal(seaScoreFor({ sailing: false, aboard: true, fight: true }), S.fight, 'AUDIT SOUNDSCAPE M1: aboard off the helm in a sea fight - a boarding - the fight\'s');
  assert.equal(seaScoreFor({ sailing: false, aboard: true, weather: 'thunder' }), null, 'aboard off the helm with no fight: the director\'s');
  const table = [
    [{}, S.open],
    [{ fight: true, weather: 'thunder', nearPort: true, night: true, way: 0 }, S.fight],
    [{ weather: 'thunder', nearPort: true, night: true, way: 0 }, S.storm],
    [{ weather: 'rain', way: 8 }, S.open], [{ weather: 'snow', way: 8 }, S.open], [{ weather: 'sandstorm', way: 8 }, S.open],
    [{ weather: 'overcast', way: 8 }, S.open], [{ weather: 'cloudy', way: 8 }, S.open],
    [{ nearPort: true, night: true, weather: 'fog', way: 0 }, S.port],
    [{ night: true, weather: 'fog', way: 0 }, S.night], [{ night: true, way: 9 }, S.night],
    [{ way: SEA_CALM_WAY - 0.01 }, S.calm], [{ way: SEA_CALM_WAY }, S.open], [{ way: NaN }, S.calm], [{ way: undefined }, S.calm], [{ way: 0 }, S.calm],
    [{ weather: 'fog', way: 9 }, S.calm], [{ weather: 'rain', way: 1 }, S.calm],
  ];
  assert.deepEqual(table.map(([o]) => at(o)), table.map(([, want]) => want));
});

test('SEA-SCORE THE HOLD (AUDIT SOUNDSCAPE M1, M3): the law\'s song played whole - its own length, never under SEA_SCORE_HOLD_MS - and changed only once the law has wanted another SEA_SCORE_SETTLE_MS on end; a storm and a fight through it at once; a storm, once in, kept its hold; a fight ended keeps its song SEA_FIGHT_TAIL_MS from its last word, then the law\'s song at once - aboard off the helm too, then none; the helm let go ashore is null at once, and the next helm hears its own law at once (mutants: the song cut at the timer; the settle unread; the storm held out; the fight\'s tail cut; the tail lost off the helm; the helm\'s memory kept)', () => {
  assert.deepEqual([SEA_SCORE_HOLD_MS, SEA_SCORE_SETTLE_MS, SEA_FIGHT_TAIL_MS], [90_000, 20_000, 20_000]);
  const S = SEA_SONGS, T0 = 1_800_000_000_000;
  assert.deepEqual(Object.values(S).map((n) => Math.round(seaSongMs(n))), [137143, 115200, 91429, 87273, 73846, 80000]);
  assert.equal(seaSongMs('nope'), 0);
  const ctx = (o) => ({ sailing: true, weather: 'sunny', way: 6, ...o });
  const h = createSeaScore();
  assert.equal(h.want(ctx({ way: 0 }), T0), S.calm, 'the first song the law\'s');
  assert.equal(h.want(ctx({}), T0 + 1000), S.calm, 'making way: the still sea kept');
  assert.equal(h.want(ctx({}), T0 + SEA_SCORE_HOLD_MS), S.calm, 'at the old timer\'s 90 s: still the still sea - its choir is to come');
  const calmMs = seaSongMs(S.calm);
  assert.equal(h.want(ctx({}), T0 + calmMs - 1), S.calm);
  assert.equal(h.want(ctx({}), T0 + calmMs), S.open, 'played whole, the law\'s song');
  const t0 = T0 + calmMs;
  // the law at the calm line, back and forth: no change until it settles
  const openMs = seaSongMs(S.open);
  assert.equal(h.want(ctx({ way: 0 }), t0 + openMs), S.open, 'the law turns; not settled yet');
  assert.equal(h.want(ctx({}), t0 + openMs + 10_000), S.open);
  assert.equal(h.want(ctx({ way: 0 }), t0 + openMs + 15_000), S.open, 'turned again: its settling begins again');
  assert.equal(h.want(ctx({ way: 0 }), t0 + openMs + 15_000 + SEA_SCORE_SETTLE_MS - 1), S.open);
  assert.equal(h.want(ctx({ way: 0 }), t0 + openMs + 15_000 + SEA_SCORE_SETTLE_MS), S.calm, 'settled: the still sea');
  const t1 = t0 + openMs + 15_000 + SEA_SCORE_SETTLE_MS + 5_000;
  assert.equal(h.want(ctx({ weather: 'thunder' }), t1), S.storm, 'a storm through the hold at once');
  assert.equal(h.want(ctx({}), t1 + 5_000), S.storm, 'the storm kept its hold when the sky cleared');
  assert.equal(h.want(ctx({}), t1 + seaSongMs(S.storm) - 1), S.storm, 'played whole');
  assert.equal(h.want(ctx({}), t1 + seaSongMs(S.storm)), S.open);
  const t2 = t1 + seaSongMs(S.storm) + 1_000;
  assert.equal(h.want(ctx({ fight: true }), t2), S.fight, 'a fight through the hold at once');
  assert.equal(h.want(ctx({}), t2 + 30_000), S.fight, 'the fight over: its tail begins');
  assert.equal(h.want(ctx({}), t2 + 30_000 + SEA_FIGHT_TAIL_MS - 1), S.fight, 'the tail still sounding');
  assert.equal(h.want(ctx({}), t2 + 30_000 + SEA_FIGHT_TAIL_MS), S.open, 'the tail spent: the law\'s song at once');
  assert.equal(h.want(ctx({ way: 0 }), t2 + 30_000 + SEA_FIGHT_TAIL_MS + 1_000), S.open, 'and held');
  assert.equal(h.current, S.open);
  assert.equal(h.want({ sailing: false }, t2 + 60_000), null, 'the helm let go ashore: null at once');
  assert.equal(h.current, null);
  assert.equal(h.want(ctx({ night: true }), t2 + 61_000), S.night, 'a new helm hears its own law at once');
  assert.equal(h.want(ctx({}), t2 + 62_000), S.night);
  assert.equal(h.want(ctx({}), t2 + 61_000 + SEA_SCORE_HOLD_MS - 1), S.night, 'a song shorter than the hold keeps the hold');
  assert.equal(h.want(ctx({}), t2 + 61_000 + SEA_SCORE_HOLD_MS), S.open);
  // a fight that flares again inside its tail is the fight still
  const f = createSeaScore();
  f.want(ctx({ fight: true }), T0);
  f.want(ctx({}), T0 + 1_000);
  assert.equal(f.want(ctx({ fight: true }), T0 + 5_000), S.fight);
  assert.equal(f.want(ctx({}), T0 + 6_000 + SEA_FIGHT_TAIL_MS - 1), S.fight, 'the tail counted from the fight\'s last word');
  // a boarding: the helm let go in the fight, the deck fight the fight's; won aboard, its tail, then the director's
  const b = createSeaScore();
  b.want(ctx({ fight: true }), T0);
  assert.equal(b.want({ sailing: false, aboard: true, fight: true }, T0 + 2_000), S.fight, 'boarding: the fight held');
  assert.equal(b.want({ sailing: false, aboard: true, fight: false }, T0 + 60_000), S.fight, 'won aboard: its tail');
  assert.equal(b.want({ sailing: false, aboard: true, fight: false }, T0 + 60_000 + SEA_FIGHT_TAIL_MS), null, 'the tail spent off the helm: the director\'s');
});
