// SD13 (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 16; Mac: "The detail needs to
// exceed that of the oblivion gates"): THE SCORE OF THE HOUR (systems/sdScore.js) - nine songs written as notes for
// the game's own player and FM bank, and the law of which plays where. The songs: their names, tempos and lengths,
// whole bars looping on their bar line with nothing past the end; every voice's program, level and place at their
// start; the broken chime (its fourth change on the tritone) and the mended (home); the Dragon Break's canon (silver
// two beats behind gold, an octave down); more notes than the Warden's four songs and more voices; the war's levels and
// presses growing with the phases. The law: the Hollow's walk, the hall's, the Steps' (and the arena before its
// fight's first word), the war of the fight's phase, its last minute, silence from the End and on a lost fight, the
// fall's song from its own first note then the collapse's - which the Hollow plays too. The world host from its own
// text: the Hour's score holds the music before the court's and the arena's, let go the frame I stand in neither.
// Measured through the real player in a browser: tools/sdScoreProbe.mjs.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  sdScoreSongs, hourScoreFor, createHourScore, sdScorePlace, HOUR_SONGS, HOUR_PROGRAMS, HOUR_CHANNELS, HOUR_LEVEL, HOUR_PRESS,
  HOUR_CHIME, HOUR_CHIME_MENDED, SD_SCORE_SILENCE, SD_SCORE_ENDS_WARN_MS, SD_SCORE_STING_MS,
} from '../src/systems/sdScore.js';
import { gateScoreSongs, midiNote, SCORE_TPQ, SCORE_STING_LEAD_MS } from '../src/systems/gateScore.js';
import { SD_ARENA, SD_ORRERY, dungeonToRealm, realmToDungeon } from '../src/net/sdBrain.js';
import { SD_FIRST_STEP } from '../src/world/sdHall.js';
import { SD_BAR_NEAR_M } from '../src/ui/sdRemnantBar.js';
import { sdPhase } from '../src/net/sdLaw.js';

const W = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const constOf = (name) => { const at = W.indexOf(`\n  const ${name} = `); assert.ok(at > 0, name); return W.slice(at + 1, W.indexOf('\n  };\n', at) + 5); };
const notesOf = (song) => song.events.filter((e) => e.type === 'noteOn');
const T0 = 1_800_000_000_000;

// ── the songs ─────────────────────────────────────────────────────────

test('SD13 THE SONGS: nine, by their own names beside MIDI.BSA\'s and the Warden\'s, at their tempos and lengths; whole bars that loop on their bar line, nothing laid past the end (the silver Echo\'s canon wraps round the seam); every voice\'s program, level and place at their start; more notes than the Warden\'s four songs and more voices; made once, the same notes every time (mutants: a song unmade; a voice unset; the canon past the end)', () => {
  const songs = sdScoreSongs();
  assert.equal(sdScoreSongs(), songs, 'made once');
  assert.deepEqual(Object.keys(songs), ['hollow', 'hall', 'steps', 'war1', 'war2', 'war3', 'last', 'fell', 'gone']);
  const gate = new Set(Object.values(gateScoreSongs()).map((s) => s.name));
  const shape = { hollow: [84, 32], hall: [96, 32], steps: [120, 32], war1: [136, 32], war2: [142, 32], war3: [152, 32], last: [160, 16], fell: [88, 12], gone: [72, 24] };
  let total = 0;
  const channels = new Set();
  for (const [k, s] of Object.entries(songs)) {
    assert.equal(s.name, HOUR_SONGS[k]);
    assert.match(s.name, /^HOUR[A-Z0-9]{4}\.HMI$/, 'eight and three, as the game\'s own');
    assert.ok(!gate.has(s.name));
    assert.equal(s.beatsPerMinute, shape[k][0], `${k}'s tempo`);
    assert.equal(s.durationTicks, shape[k][1] * 4 * SCORE_TPQ, `${k}: whole bars`);
    assert.ok(Math.abs(s.secondsPerTick - 60 / (s.beatsPerMinute * SCORE_TPQ)) < 1e-12);
    assert.equal(s.seamless, true, 'loops on its bar line');
    assert.equal(s.level, HOUR_LEVEL[k]); assert.equal(s.press, HOUR_PRESS[k]);
    const n = notesOf(s);
    assert.ok(n.every((e) => e.tick >= 0 && e.tick < s.durationTicks && e.tick + e.duration <= s.durationTicks), `${k}: nothing past its end`);
    assert.ok(n.every((e) => e.velocity >= 1 && e.velocity <= 127 && e.duration >= 1 && e.note >= 0 && e.note <= 127));
    for (let i = 1; i < s.events.length; i++) assert.ok(s.events[i].tick >= s.events[i - 1].tick, `${k}: in tick order`);
    for (const [voice, ch] of Object.entries(HOUR_CHANNELS)) {
      if (voice === 'kit') continue;
      const at0 = s.events.filter((e) => e.tick === 0 && e.channel === ch && e.type !== 'noteOn');
      assert.ok(at0.some((e) => e.type === 'programChange' && e.program === HOUR_PROGRAMS[voice]), `${k}: ${voice}'s program`);
      assert.ok(at0.some((e) => e.controller === 7) && at0.some((e) => e.controller === 10), `${k}: ${voice}'s level and place`);
      const first = s.events.findIndex((e) => e.channel === ch && e.type === 'noteOn');
      const prog = s.events.findIndex((e) => e.channel === ch && e.type === 'programChange');
      if (first >= 0) assert.ok(prog < first, `${k}: ${voice}'s program before its first note`);
    }
    total += n.length;
    n.forEach((e) => channels.add(e.channel));
  }
  const gateNotes = Object.values(gateScoreSongs()).reduce((a, s) => a + notesOf(s).length, 0);
  assert.ok(total > 9000 && total > gateNotes, `${total} notes, against the Warden's ${gateNotes}`);
  assert.ok(channels.size >= 14 && channels.has(HOUR_CHANNELS.kit), `${channels.size} channels sounding - thirteen voices and the kit`);
  assert.equal(Object.keys(HOUR_PROGRAMS).length, 13);
  assert.equal(HOUR_CHANNELS.kit, 9, 'GM\'s own drum channel');
  assert.equal(new Set(Object.values(HOUR_CHANNELS)).size, Object.keys(HOUR_CHANNELS).length, 'one voice a channel');
});

test('SD13 THE HOUR\'S SOUND: the chime\'s four quarters in C minor, BROKEN - its fourth change on F sharp, the tritone, where the hour should strike - and MENDED in C major, the fourth ending home; the hall and the war strike the broken one, the fall and the collapse the mended; the fall struck in C major, the hour struck at last; the Dragon Break\'s canon - silver two beats behind gold on the strings an octave down; the escapement on the harpsichord and the tick and tock on the woods in every song but the fall (mutants: the chime mended in the fight; the fall in the minor; the canon on the beat)', () => {
  const songs = sdScoreSongs();
  assert.equal(HOUR_CHIME.length, 4); assert.equal(HOUR_CHIME_MENDED.length, 4);
  assert.deepEqual(HOUR_CHIME[3], ['G4', 'D5', 'Eb5', 'F#5'], 'the broken quarter');
  assert.equal((midiNote('F#5') - midiNote('C5') + 12) % 12, 6, 'a tritone from home');
  assert.equal(HOUR_CHIME_MENDED[3][3], 'C5', 'mended: home');
  for (let q = 0; q < 3; q++) assert.deepEqual(HOUR_CHIME[q].map((n) => n.replace('Eb', 'E')), HOUR_CHIME_MENDED[q], 'the same quarters, the third lowered');
  const at = (s, ch) => notesOf(s).filter((e) => e.channel === ch);
  const ch = HOUR_CHANNELS;
  // the hall strikes the broken change on the music box, and the bell at the break
  const hallChime = at(songs.hall, ch.chime).filter((e) => e.tick < 16 * SCORE_TPQ).map((e) => e.note);
  assert.deepEqual(hallChime, HOUR_CHIME.flat().map(midiNote), 'the hall\'s riddle: the four quarters, broken');
  assert.ok(at(songs.hall, ch.bells).some((e) => e.note === midiNote('F#4')), 'the broken hour struck');
  // the fall: C major, its four mended quarters on the bells, the hour struck at last - no E-flat in it
  const fellNotes = notesOf(songs.fell).filter((e) => e.channel !== ch.kit);
  assert.ok(fellNotes.every((e) => e.note % 12 !== 3 && e.note % 12 !== 6), 'no E-flat and no F sharp: mended');
  assert.deepEqual(at(songs.fell, ch.bells).slice(0, 16).map((e) => e.note), HOUR_CHIME_MENDED.flat().map(midiNote), 'the four quarters, whole');
  assert.equal(at(songs.fell, ch.bells).at(-1).note, midiNote('C5'), 'the hour, struck');
  assert.ok(notesOf(songs.gone).filter((e) => e.channel !== ch.kit).every((e) => e.note % 12 !== 3), 'the collapse mended too');
  // the wars strike the broken one
  for (const k of ['war1', 'war3', 'last']) assert.ok(notesOf(songs[k]).some((e) => e.note === midiNote('F#5') || e.note === midiNote('F#4') || e.note === midiNote('F#3')), `${k}: the broken change`);
  // the canon: each of gold's notes in the first eight bars answered by silver two beats behind, an octave down
  const gold = at(songs.war2, ch.brass).filter((e) => e.tick < 32 * SCORE_TPQ && e.velocity >= 112);
  const silver = new Set(at(songs.war2, ch.strings).map((e) => `${e.tick}:${e.note}`));
  const answered = gold.filter((e) => silver.has(`${e.tick + 2 * SCORE_TPQ}:${e.note - 12}`)).length;
  assert.ok(answered >= 30 && answered === gold.length, `silver echoes gold (${answered} of ${gold.length})`);
  // the clock: the harpsichord and the woods
  assert.equal(HOUR_PROGRAMS.clock, 6, 'the harpsichord');
  for (const k of ['hollow', 'steps', 'war1', 'war2', 'war3', 'last', 'gone']) {
    const kit = at(songs[k], ch.kit).map((e) => e.note);
    assert.ok(kit.includes(76) && kit.includes(77), `${k}: the tick and the tock`);
  }
  for (const k of ['hall', 'steps', 'war1', 'war2', 'war3', 'last']) assert.ok(at(songs[k], ch.clock).length >= 128, `${k}: the escapement`);
});

test('SD13 THE LEVELS: the war over the places, growing with the phases, the last minute and the fall over them; each pressed under a ceiling a decibel under the clip, its drive growing with the war (mutants: the war levelled; a ceiling at the clip)', () => {
  const L = HOUR_LEVEL, P = HOUR_PRESS;
  assert.ok(L.war1 < L.war2 && L.war2 < L.war3 && L.war3 < L.last && L.last <= L.fell, 'the war grows');
  for (const k of ['hollow', 'hall', 'gone', 'steps']) assert.ok(L[k] < L.war1, `${k} under the fight`);
  for (const p of Object.values(P)) { assert.equal(p.ceiling, -1); assert.equal(p.ratio, 4); assert.ok(p.out > 4 && p.out < 6); }
  assert.ok(P.war1.out <= P.war2.out && P.war2.out < P.war3.out && P.war3.out <= P.last.out);
  assert.ok(Math.max(P.hollow.out, P.hall.out, P.gone.out) < P.war1.out);
});

// ── the law ───────────────────────────────────────────────────────────

const fight = (over = {}) => ({ fi: 3, ph: 1, op: T0 - 1000, ends: T0 + 10 * 60_000, ended: 0, lost: 0, fell: null, ...over });

test('SD13 WHERE I STAND: the arena as near as its bar is heard, the Steps from the first step\'s near edge, else the hall - the Threshold, the Orrery and the bridge; no number, nowhere (mutants: the arena by its rim alone; the Steps from the hall)', () => {
  assert.equal(sdScorePlace(0, 0), 'hall', 'the Threshold');
  assert.equal(sdScorePlace(SD_ORRERY.x, SD_ORRERY.z), 'hall', 'the Orrery');
  assert.equal(sdScorePlace(0, SD_FIRST_STEP.z - SD_FIRST_STEP.r - 0.1), 'hall', 'the bridge');
  assert.equal(sdScorePlace(0, SD_FIRST_STEP.z - SD_FIRST_STEP.r), 'steps', 'the first step');
  assert.equal(sdScorePlace(0, 150), 'steps');
  assert.equal(sdScorePlace(SD_ARENA.x, SD_ARENA.z), 'arena');
  assert.equal(sdScorePlace(0, SD_ARENA.z - SD_ARENA.r - SD_BAR_NEAR_M + 0.5), 'arena', 'as near as its bar');
  assert.equal(sdScorePlace(0, SD_ARENA.z - SD_ARENA.r - SD_BAR_NEAR_M - 0.5), 'steps');
  assert.equal(sdScorePlace(NaN, 3), null);
});

test('SD13 THE LAW: no Hollow and no Hour - the director; the Hollow\'s walk; the hall\'s; the Steps\', and the arena\'s before its fight\'s first word; the war of the fight\'s phase, its last minute, silence from the End (its word or its time) and on a lost fight; the fall\'s song for SD_SCORE_STING_MS, then the collapse\'s - in the Hour wherever I stand, and the Hollow\'s while it collapses (mutants: the war by phase alone; no last minute; music over the End; the Hollow\'s walk through its collapse; the fall forever)', () => {
  assert.equal(hourScoreFor(null, fight(), T0), null, 'the director stands');
  assert.equal(hourScoreFor('hollow', null, T0), HOUR_SONGS.hollow);
  assert.equal(hourScoreFor('hollow', null, T0, true), HOUR_SONGS.gone, 'the Hollow collapsing');
  assert.equal(hourScoreFor('hall', fight(), T0), HOUR_SONGS.hall, 'the hall, whatever the arena does');
  assert.equal(hourScoreFor('steps', fight({ ph: 3 }), T0), HOUR_SONGS.steps);
  assert.equal(hourScoreFor('arena', null, T0), HOUR_SONGS.steps, 'before the fight\'s first word');
  assert.equal(hourScoreFor('arena', { fi: 0 }, T0), HOUR_SONGS.steps);
  assert.equal(hourScoreFor('arena', fight({ op: T0 + 5000 }), T0), HOUR_SONGS.war1, 'it stirs');
  assert.equal(hourScoreFor('arena', fight({ ph: 2 }), T0), HOUR_SONGS.war2);
  assert.equal(hourScoreFor('arena', fight({ ph: 3 }), T0), HOUR_SONGS.war3);
  assert.equal(hourScoreFor('arena', fight({ ends: T0 + SD_SCORE_ENDS_WARN_MS }), T0), HOUR_SONGS.last, 'its last minute');
  assert.equal(hourScoreFor('arena', fight({ ph: 2, ends: T0 + SD_SCORE_ENDS_WARN_MS + 1 }), T0), HOUR_SONGS.war2);
  assert.equal(hourScoreFor('arena', fight({ ended: T0 - 1 }), T0), SD_SCORE_SILENCE, 'the End: nothing over it');
  assert.equal(hourScoreFor('arena', fight({ ends: T0 }), T0), SD_SCORE_SILENCE, 'the End by its time');
  assert.equal(hourScoreFor('arena', fight({ lost: T0 - 5 }), T0), SD_SCORE_SILENCE, 'a lost fight');
  const fell = fight({ fell: { at: T0, top: ['A'], n: 2 } });
  assert.equal(hourScoreFor('arena', fell, T0 + 1000), HOUR_SONGS.fell);
  assert.equal(hourScoreFor('steps', fell, T0 + 1000), HOUR_SONGS.fell, 'the fall heard on the Steps too');
  assert.equal(hourScoreFor('hall', fell, T0 + SD_SCORE_STING_MS), HOUR_SONGS.gone, 'then the collapse, anywhere in the Hour');
  assert.equal(hourScoreFor('steps', fight(), T0, true), HOUR_SONGS.gone, 'a collapse this page\'s fight never told it');
});

test('SD13 THE FALL PLAYED WHOLE (the gate\'s AUDIT WB D2, WBX W3): the fall\'s song from its own first note - SCORE_STING_LEAD_MS after it is asked - for SD_SCORE_STING_MS, a late word of the kill never cutting it short; a fall first heard after its song\'s time goes straight to the collapse\'s; the next Hollow\'s fall starts fresh; standing nowhere forgets it (mutants: the sting from the kill; the late fall stung; one sting a session)', () => {
  const h = createHourScore();
  const fell = (at, fi = 3) => fight({ fi, fell: { at, top: ['A'], n: 1 } });
  assert.equal(h.want('arena', fight({ ph: 3 }), T0), HOUR_SONGS.war3);
  // its word came 10 s late: the law alone would give it 6.5 s; the page gives it its whole time from its first note
  const t1 = T0 + 10_000;
  assert.equal(h.want('arena', fell(T0), t1), HOUR_SONGS.fell);
  assert.equal(h.want('arena', fell(T0), t1 + SCORE_STING_LEAD_MS + SD_SCORE_STING_MS - 1), HOUR_SONGS.fell, 'whole');
  assert.equal(h.want('arena', fell(T0), t1 + SCORE_STING_LEAD_MS + SD_SCORE_STING_MS), HOUR_SONGS.gone);
  assert.equal(h.want('steps', fell(T0), t1 + 60_000), HOUR_SONGS.gone);
  // a fall heard long after: the collapse's at once
  const g = createHourScore();
  assert.equal(g.want('hall', fell(T0), T0 + SD_SCORE_STING_MS + 1), HOUR_SONGS.gone, 'no fanfare for a fall long done');
  assert.equal(g.want('hall', fell(T0), T0 + SD_SCORE_STING_MS + 900), HOUR_SONGS.gone);
  // the next Hollow's: fresh
  const T1 = T0 + 9 * 3_600_000;
  assert.equal(g.want('arena', fell(T1, 1), T1 + 100), HOUR_SONGS.fell, 'the next fall, its own fanfare');
  // standing nowhere, then back to the same fall: its time is its own
  assert.equal(g.want(null, null, T1 + 200), null);
  assert.equal(g.want('arena', fell(T1, 1), T1 + 300), HOUR_SONGS.fell);
});

// ── the host ──────────────────────────────────────────────────────────

/** world.js's Hour score frame, from its own text, over a music, a mode machine and a fight link the test holds. */
function scoreHost() {
  const log = [];
  let current = null;
  const music = {
    registerSong: (name) => log.push(['reg', name]), playSong: (n) => { if (current !== n) { current = n; log.push(['play', n]); } },
    stop: () => { current = null; log.push('stop'); }, fadeOut: () => { log.push('fade'); current = null; }, get current() { return current; },
  };
  const st = { mode: 'exterior', loc: null, slot: null, pos: [0, 0, 0], fight: null, rec: null, now: T0, hp: 100, stepping: false };
  const env = {
    modes: { get mode() { return st.mode; }, get dungeonLocation() { return st.loc; }, sdRealmSlot: () => st.slot, get stepping() { return st.stepping; }, get transitioning() { return false; } },
    player: { get pos() { return st.pos; } }, sdDungeonToRealm: dungeonToRealm, sdScorePlace, sdScoreSongs, createHourScore, SD_SCORE_SILENCE, music,
    sdFightLink: { state: () => st.fight, now: () => st.now }, sdHost: { record: () => st.rec }, sdPhase, _sharedOffsetMs: 0,
    playerEntity: { get health() { return st.hp; } },   // AUDIT SD III (A5, PIN MOVED): the living and the dead
  };
  const body = `let _hourScoreHeld = false, _hourScoreMade = false, _hourPlace = null;\nconst _hourScore = createHourScore();\n${constOf('sdScoreWhere')}\n${constOf('hourScoreFrame')}\nreturn hourScoreFrame;`;   // AUDIT SD III (A10, PIN MOVED): where I stood last
  return { frame: new Function(...Object.keys(env), body)(...Object.values(env)), log, st };
}

test('SD13 THE HOST, from the world host\'s own text: outside, nothing held; in a Hollow its walk - its songs made once; through the Rift the hall\'s, the Steps\', the arena\'s war; the End faded, not cut; the Hollow collapsing, its collapse\'s; out of both, the music let go once (the director\'s next frame plays its own); the Hour\'s score asked before the court\'s and the arena\'s (mutants: the score never let go; the Hollow unheard; the collapse by another slot\'s record; the court first)', () => {
  const h = scoreHost(), { st, log } = h;
  assert.equal(h.frame(), false, 'outside: the director');
  assert.deepEqual(log, []);
  st.mode = 'dungeon'; st.loc = { superTier: true, sdSlot: 4 };
  assert.equal(h.frame(), true);
  assert.equal(log.filter((x) => x[0] === 'reg').length, 9, 'made once');
  assert.deepEqual(log.at(-1), ['play', HOUR_SONGS.hollow]);
  h.frame(); h.frame();
  assert.equal(log.filter((x) => x[0] === 'reg').length, 9);
  // the Hollow collapsing - its own slot's record; another slot's says nothing
  st.rec = { s: 5, ph: 'found', fellAt: T0 - 1000, until: T0 + 9e6 };
  h.frame();
  assert.deepEqual(log.at(-1), ['play', HOUR_SONGS.hollow], 'another slot\'s record');
  st.rec = { s: 4, ph: 'found', fellAt: T0 - 1000, until: T0 + 9e6 };
  h.frame();
  assert.deepEqual(log.at(-1), ['play', HOUR_SONGS.gone], 'its collapse');
  // through the Rift: the Hour, by where I stand
  st.rec = { s: 4, ph: 'found', until: T0 + 9e6 };
  st.loc = { sdRealm: 4 }; st.slot = 4;
  st.pos = realmToDungeon(0, 1, SD_ORRERY.z);
  h.frame(); assert.deepEqual(log.at(-1), ['play', HOUR_SONGS.hall]);
  st.pos = realmToDungeon(0, 1, 140);
  h.frame(); assert.deepEqual(log.at(-1), ['play', HOUR_SONGS.steps]);
  st.pos = realmToDungeon(0, 1, SD_ARENA.z - 5);
  st.fight = fight({ ph: 2 });
  h.frame(); assert.deepEqual(log.at(-1), ['play', HOUR_SONGS.war2]);
  st.fight = fight({ ended: T0 - 1 });
  h.frame(); assert.equal(log.at(-1), 'fade', 'the End: faded, never cut');
  // out of both: let go, once
  st.mode = 'exterior'; st.loc = null; st.slot = null;
  const before = log.length;
  assert.equal(h.frame(), false);
  assert.deepEqual(log.slice(before), ['fade'], 'let go, faded - never cut');   // AUDIT SD III (A4, PIN MOVED): it was stopped
  const n = log.length;
  h.frame(); h.frame();
  assert.equal(log.length, n, 'once');
  // a dungeon that is no Hollow: the director's
  st.mode = 'dungeon'; st.loc = { name: 'Castle Daggerfall' };
  assert.equal(h.frame(), false);
  assert.match(W, /if \(!hourScoreFrame\(\) && !gateScoreFrame\(\) && !arenaScoreFrame\(\)\) musicDirector\.update\(\{/, 'the Hour before the court and the arena');
});
