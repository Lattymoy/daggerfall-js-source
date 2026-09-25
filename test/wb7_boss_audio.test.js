// WB7 (2026-09-25, Mac: "Proper boss audio during the boss fight"): THE WARDEN'S VOICE AND HIS MUSIC, DRIVEN. The score
// (four songs made in code, in the shape the song player plays: tick-ordered, set up at tick 0, whole bars, in range;
// the harmony each claims - D minor at war, the Neapolitan in his wrath, D major at his fall; the tempos rising); the
// law of which plays (his phase, the Wrath's last minute, the fall's fanfare then quiet); the music service's door for
// a song made in code (played by name, the archive never asked); his body heard in the court's driver (a step each
// stride, a growl between his attacks and never during one, a grunt when he is hurt, the ground's shock under his heavy
// landings, thunder over his roar, his body meeting the floor); and the seams by source. tools/gateScoreProbe.mjs plays
// the score through the game's own player in a real browser and measures it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  gateScoreSongs, courtScoreFor, midiNote, GATE_SONGS, SCORE_SILENCE, SCORE_STING_MS, SCORE_WRATH_WARN_MS, SCORE_TPQ,
  SCORE_PROGRAMS, SCORE_CHANNELS,
} from '../src/systems/gateScore.js';
import { eventsInWindow } from '../src/systems/songPlayer.js';
import { MusicService } from '../src/systems/music.js';
import { ATTACKS } from '../src/net/gateBrain.js';
import { BOSS_CUES, BOSS_STRIDE_M, GROWL_EVERY_MS, HURT_GAP_MS, HURT_SHARE, QUAKE_ON, THUD_AT_MS, FALL_MS } from '../src/world/gateBoss.js';
import { createGateCourt } from '../src/scenes/gateCourt.js';
import { destroyGateBossBar } from '../src/ui/gateBossBar.js';
import { GATE_STATE_EMPTY } from '../src/net/gateLink.js';
import { courtToDungeon } from '../src/world/gateArena.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const BAR = 4 * SCORE_TPQ;

test('WB7 the score\'s shape: four songs by their own names, each the shape the song player plays - tick-ordered with every voice set up at tick 0 (its program, level and place) before a note sounds, whole bars, every note inside the song and in range, the kit on GM\'s channel 9; made once, the same notes every time (mutants: a voice left on the piano; a note past the song\'s end; the events out of order)', () => {
  const songs = gateScoreSongs();
  assert.equal(gateScoreSongs(), songs, 'made once');
  assert.deepEqual(Object.values(songs).map((s) => s.name).sort(), Object.values(GATE_SONGS).sort());
  for (const song of Object.values(songs)) {
    assert.ok(song.durationTicks > 0 && song.durationTicks % BAR === 0, `${song.name}: whole bars`);
    assert.ok(Math.abs(song.secondsPerTick - 60 / (song.beatsPerMinute * SCORE_TPQ)) < 1e-12, 'one tempo, the HMI clock\'s');
    for (let i = 1; i < song.events.length; i++) assert.ok(song.events[i].tick >= song.events[i - 1].tick, `${song.name}: tick-ordered at ${i}`);
    const first = song.events.findIndex((e) => e.type === 'noteOn');
    const setup = song.events.slice(0, first);
    for (const [voice, ch] of Object.entries(SCORE_CHANNELS)) {
      if (voice !== 'kit') assert.ok(setup.some((e) => e.type === 'programChange' && e.channel === ch && e.program === SCORE_PROGRAMS[voice]), `${song.name}: ${voice} set to its program before a note`);
      assert.ok(setup.some((e) => e.type === 'controller' && e.channel === ch && e.controller === 7), `${song.name}: ${voice}'s level set`);
    }
    for (const e of song.events.filter((x) => x.type === 'noteOn')) {
      assert.ok(e.note >= 0 && e.note <= 127 && e.velocity >= 1 && e.velocity <= 127 && e.duration >= 1, `${song.name}: in range`);
      assert.ok(e.tick + e.duration <= song.durationTicks, `${song.name}: inside the song at ${e.tick}`);
    }
    assert.ok(song.events.some((e) => e.type === 'noteOn' && e.channel === 9), 'the kit on channel 9');
    assert.equal(eventsInWindow(song.events, 0, song.durationTicks + 1).length, song.events.length, 'the player\'s own window takes all of it');
  }
  assert.equal(midiNote('C4'), 60); assert.equal(midiNote('A4'), 69); assert.equal(midiNote('Bb1'), 34); assert.equal(midiNote('C#5'), 73);
  assert.throws(() => midiNote('H2'));
});

test('WB7 the score\'s music: D minor at war (the harmonic minor\'s C# on the dominant), the Neapolitan Eb in his wrath alone, D major at his fall (its F#), the tempos rising with his phases, the war songs a minute each and the fall\'s fanfare done inside SCORE_STING_MS (mutants: the fall left in minor; the wrath without its Eb)', () => {
  const s = gateScoreSongs();
  const pcs = (song, ch = null) => new Set(song.events.filter((e) => e.type === 'noteOn' && e.channel !== 9 && (ch === null || e.channel === ch)).map((e) => e.note % 12));
  for (const war of [s.war1, s.war2]) {
    const p = pcs(war);
    for (const pc of [2, 5, 9, 1]) assert.ok(p.has(pc), `${war.name}: D, F, A and the dominant's C#`);
    assert.ok(!p.has(6), `${war.name}: never F# - it is minor`);
  }
  // the Neapolitan is a HARMONY: an Eb major chord, its root in the bass - in the wrath alone (the Gm bars' ostinato
  // and the wrath's theme touch an Eb as a colour; only the wrath stands on one)
  assert.ok(pcs(s.war3, SCORE_CHANNELS.bass).has(3), 'the wrath\'s bass stands on the Neapolitan Eb');
  assert.ok(!pcs(s.war1, SCORE_CHANNELS.bass).has(3) && !pcs(s.war2, SCORE_CHANNELS.bass).has(3), 'the war before it never does');
  assert.ok(!pcs(s.war1).has(8) && pcs(s.war3).has(8), 'the tritone Ab tolled in the wrath alone');
  const fall = pcs(s.fell);
  assert.ok(fall.has(6) && !fall.has(5), 'D major at his fall: F#, never F');
  assert.ok(s.war1.beatsPerMinute < s.war2.beatsPerMinute && s.war2.beatsPerMinute < s.war3.beatsPerMinute, 'faster as he grows desperate');
  for (const war of [s.war1, s.war2, s.war3]) { const secs = war.durationTicks * war.secondsPerTick; assert.ok(secs > 45 && secs < 70, `${war.name}: ${secs.toFixed(1)} s a pass`); }
  const lastNote = Math.max(...s.fell.events.filter((e) => e.type === 'noteOn').map((e) => (e.tick + e.duration) * s.fell.secondsPerTick));
  assert.ok(lastNote + 1 < SCORE_STING_MS / 1000, `the fanfare done in its time: ${lastNote.toFixed(1)} s`);
  // the brass carries the theme: every war song gives it bars of its own
  for (const war of [s.war1, s.war2, s.war3]) assert.ok(war.events.filter((e) => e.type === 'noteOn' && e.channel === SCORE_CHANNELS.brass).length > 60, `${war.name}: the Warden's theme on the brass`);
});

test('WB7 the law of the court\'s music: no fight no score (the director\'s); the war song of his phase; the third in the Wrath\'s last minute at any phase; his fall\'s fanfare for SCORE_STING_MS, then quiet; quiet once the Wrath has landed (mutants: the fall\'s fanfare forever; the Wrath\'s warning dropped)', () => {
  const st = (o = {}) => ({ ...GATE_STATE_EMPTY, day: 9, phase: 1, wrathAt: 10_000_000, ...o });
  assert.equal(courtScoreFor(null, 0), null);
  assert.equal(courtScoreFor(GATE_STATE_EMPTY, 0), null, 'no fight on this screen');
  assert.equal(courtScoreFor(st(), 0), GATE_SONGS.war1);
  assert.equal(courtScoreFor(st({ phase: 2 }), 0), GATE_SONGS.war2);
  assert.equal(courtScoreFor(st({ phase: 3 }), 0), GATE_SONGS.war3);
  assert.equal(courtScoreFor(st({ wrathAt: 100000 }), 100000 - SCORE_WRATH_WARN_MS - 1), GATE_SONGS.war1);
  assert.equal(courtScoreFor(st({ wrathAt: 100000 }), 100000 - SCORE_WRATH_WARN_MS), GATE_SONGS.war3, 'the last minute before the Wrath');
  assert.equal(courtScoreFor(st({ wrath: 100000 }), 100100), SCORE_SILENCE, 'nothing plays over the Wrath');
  const fell = st({ phase: 3, fell: { at: 50000, top: [], n: 1 } });
  assert.equal(courtScoreFor(fell, 50000), GATE_SONGS.fell);
  assert.equal(courtScoreFor(fell, 50000 + SCORE_STING_MS - 1), GATE_SONGS.fell);
  assert.equal(courtScoreFor(fell, 50000 + SCORE_STING_MS), SCORE_SILENCE, 'then the court is the Deadlands\' air alone');
});

test('WB7 the music service\'s door for a song made in code: registered by its own name, played by the same player with the same rise, never asked of MIDI.BSA; junk refused (mutants: the archive asked for a made song; junk registered)', () => {
  const log = [];
  const svc = new MusicService();
  svc._unsubscribe();
  svc.enabled = true;
  svc.archive = { getSongIndex: (n) => { log.push(`archive ${n}`); return -1; }, getSong: () => { throw new Error('not asked'); } };
  svc.player = { playing: false, song: null, play(song) { this.song = song; this.playing = true; log.push(`play ${song.name}`); return true; }, stop() { this.playing = false; this.song = null; }, fadeTo() {} };
  const war1 = gateScoreSongs().war1;
  assert.equal(svc.registerSong(war1.name, war1), true);
  assert.equal(svc.registerSong('', war1), false);
  assert.equal(svc.registerSong('JUNK', { events: 'no' }), false);
  assert.equal(svc.registerSong('JUNK', { events: [], secondsPerTick: 0 }), false);
  assert.equal(svc.playSong(war1.name), true);
  assert.deepEqual(log, [`play ${war1.name}`], 'played, and the archive never asked');
  assert.equal(svc.player.song, war1);
  assert.equal(svc.current, war1.name);
  svc.stop();
  log.length = 0;
  assert.equal(svc.playSong('JUNK'), false, 'an unregistered name is the archive\'s to answer');
  assert.deepEqual(log, ['archive JUNK']);
});

/** The court's driver over fakes (test/wb4_gate_boss.test.js's harness), with a fixed rng for the growls. */
function court() {
  const link = { st: GATE_STATE_EMPTY, state() { return this.st; } };
  const clock = { t: 0 };
  const sounds = [];
  const c = createGateCourt({
    renderer: null, gl: null, audio: { play3d: (clip, p, v, o) => sounds.push([clip, p, v, o]), play3dId: (id, p, v, o) => sounds.push([`id${id}`, p, v, o]) },
    link, now: () => clock.t, cam: () => courtToDungeon(0, 1.7, 20), feet: () => null, player: () => null, rng: () => 0.5,
  });
  return { c, link, clock, sounds };
}
const state = (over = {}) => ({ ...GATE_STATE_EMPTY, day: 700, boss: 'ruhn', hp: 1000, max: 1000, fighters: 3, wrathAt: 10_000_000, ...over });
const W = (key, over = {}) => ({ i: 1, a: ATTACKS[key].id, at: 10000, x: 0, z: 0, yw: 0, tg: [], ...over });
const tick = (h, t, st) => { if (st) h.link.st = st; h.clock.t = t; h.c.frame(); };
const clips = (h) => h.sounds.map((s) => s[0]);

test('WB7 his body in the court: a step at his feet each stride he walks, none standing; a growl between his attacks after its time, never while he strikes; a grunt when a share of his health goes, no closer than HURT_GAP_MS and none for a scratch (mutants: steps while he stands; a growl mid-strike; a grunt for every point)', () => {
  destroyGateBossBar();
  const h = court();
  // he walks 11 m at 3.2 m/s from (0, 0)
  const walk = { x: 0, z: 0, tx: 11, tz: 0, v: 3.2, at: 1000 };
  tick(h, 1000, state({ move: walk }));
  for (let t = 1100; t <= 4400; t += 100) tick(h, t);
  const steps = h.sounds.filter((s) => s[0] === BOSS_CUES.step.clip && s[3].pitch === BOSS_CUES.step.pitch);
  assert.equal(steps.length, Math.floor(11 / BOSS_STRIDE_M), `a step each ${BOSS_STRIDE_M} m`);
  assert.ok(steps.every((s) => s[1][1] === courtToDungeon(0, 2.5, 0)[1]), 'at him');
  const before = h.sounds.length;
  for (let t = 4500; t <= 5500; t += 100) tick(h, t, state({ x: 11, z: 0 }));
  assert.equal(h.sounds.filter((s) => s[0] === BOSS_CUES.step.clip).length, steps.length, 'no step standing');
  // the growl: first due GROWL_EVERY_MS's middle after he was first seen (rng 0.5)
  const due = 1000 + (GROWL_EVERY_MS[0] + GROWL_EVERY_MS[1]) / 2;
  h.sounds.length = 0;
  for (let t = 5600; t < due; t += 200) tick(h, t);
  assert.deepEqual(clips(h), [], 'not before its time');
  tick(h, due);
  assert.deepEqual(clips(h), [BOSS_CUES.growl.clip], 'a growl');
  assert.equal(h.sounds[0][3].pitch, BOSS_CUES.growl.pitch);
  // striking: no growl however long it has been
  h.sounds.length = 0;
  const cleave = W('cleave', { i: 3, at: due + 20000 });
  for (let t = due + 17000; t <= due + 20000 + ATTACKS.cleave.active + 1400; t += 250) tick(h, t, t === due + 17000 ? state({ x: 11, atk: cleave }) : undefined);
  assert.ok(h.sounds.some((s) => s[3].pitch === BOSS_CUES.windup.cleave.pitch), 'the strike was heard');
  assert.equal(h.sounds.filter((s) => s[3].pitch === BOSS_CUES.growl.pitch).length, 0, 'never while he strikes, however long since the last');
  // hurt: a share of his health
  const g = court();
  tick(g, 1000, state({ hp: 1000 }));
  tick(g, 1100, state({ hp: 1000 - HURT_SHARE * 1000 * 0.5 }));
  assert.equal(g.sounds.filter((s) => s[3]?.pitch === BOSS_CUES.hurt.pitch).length, 0, 'none for a scratch');
  tick(g, 1200, state({ hp: 990 }));
  assert.equal(g.sounds.filter((s) => s[3]?.pitch === BOSS_CUES.hurt.pitch).length, 1, 'a grunt');
  tick(g, 1300, state({ hp: 970 }));
  assert.equal(g.sounds.filter((s) => s[3]?.pitch === BOSS_CUES.hurt.pitch).length, 1, `none closer than ${HURT_GAP_MS} ms`);
  tick(g, 1200 + HURT_GAP_MS, state({ hp: 950 }));
  assert.equal(g.sounds.filter((s) => s[3]?.pitch === BOSS_CUES.hurt.pitch).length, 2, 'and again after');
  assert.ok(before > 0);
});

test('WB7 his weight and his end: the ground\'s shock under a slam, a charge, a nova and the Wrath - not a cleave or the hellfire, and not for a landing heard late; thunder, then his roar, as a phase turns (and none for the phase first heard); his body meeting the floor THUD_AT_MS into his fall, once, inside the fall (mutants: every landing quaking; the thunder on first sight; the thud twice)', () => {
  destroyGateBossBar();
  for (const key of Object.keys(ATTACKS)) {
    const h = court();
    const atk = W(key, { i: 4, at: 10000 });
    tick(h, 9000, state({ atk }));
    tick(h, 10001);
    const quaked = h.sounds.some((s) => s[0] === BOSS_CUES.quake.clip && s[3].pitch === BOSS_CUES.quake.pitch);
    assert.equal(quaked, QUAKE_ON.includes(key), `${key}: ${QUAKE_ON.includes(key) ? 'the ground shakes' : 'no quake'}`);
  }
  const late = court();
  tick(late, 20000, state({ atk: W('slam', { i: 9, at: 10000 }) }));
  assert.ok(!late.sounds.some((s) => s[3]?.pitch === BOSS_CUES.quake.pitch), 'a landing heard late is not shaken');
  const p = court();
  tick(p, 1000, state({ phase: 2 }));
  assert.deepEqual(clips(p), [], 'no thunder for the phase first heard');
  tick(p, 2000, state({ phase: 3 }));
  assert.deepEqual(p.sounds.map((s) => [s[0], s[3].pitch]), [[BOSS_CUES.thunder.clip, BOSS_CUES.thunder.pitch], [BOSS_CUES.roar.clip, BOSS_CUES.roar.pitch]], 'thunder, then his roar');
  const f = court();
  tick(f, 5000, state({ fell: { at: 5000, top: [], n: 1 } }));
  tick(f, 5000 + THUD_AT_MS - 1);
  assert.ok(!f.sounds.some((s) => s[3]?.pitch === BOSS_CUES.thud.pitch), 'not before');
  tick(f, 5000 + THUD_AT_MS);
  tick(f, 5000 + THUD_AT_MS + 100);
  assert.equal(f.sounds.filter((s) => s[3]?.pitch === BOSS_CUES.thud.pitch).length, 1, 'once');
  assert.ok(THUD_AT_MS < FALL_MS, 'inside his fall');
});

test('WB7 the seams, by source: the world host lets the court hold the music while it stands - the songs registered the first time, the law\'s song played (the war song before the fight\'s first word), quiet stopped - and lets it go the frame the court is gone, stopped so the director\'s next frame plays its own; the director fed only when the court does not hold it, still before the modal return (mutants: the director fed over the court; the court\'s song left playing outside)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /const gateScoreFrame = \(\) => \{\n\s+if \(modes\?\.gateArenaDay\?\.\(\) == null\) \{\n\s+if \(_scoreHeld\) \{ _scoreHeld = false; music\.stop\(\); \}\n\s+return false;\n\s+\}/);
  assert.match(w, /if \(!_scoreMade\) \{ _scoreMade = true; for \(const song of Object\.values\(gateScoreSongs\(\)\)\) music\.registerSong\(song\.name, song\); \}/);
  assert.match(w, /const want = courtScoreFor\(gateLink\?\.state\?\.\(\) \?\? null, Date\.now\(\) \+ _sharedOffsetMs\) \?\? GATE_SONGS\.war1;/);
  assert.match(w, /if \(want === SCORE_SILENCE\) \{ if \(music\.current !== null\) music\.stop\(\); \} else music\.playSong\(want\);/);
  const feed = w.indexOf('    if (!gateScoreFrame()) musicDirector.update({');
  const modal = w.indexOf('if (modes.frame(dt, now)) {');
  assert.ok(feed > 0 && feed < modal, 'the director fed when the court does not hold the music, before the modal return');
});
