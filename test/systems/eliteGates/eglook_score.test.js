// EG-G2 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 26 - EG17): THE SCORE OF
// THE SPIRE (systems/eliteGates/egScore.js) and THE SPIRE MIX (systems/eliteGates/egMix.js, systems/song/songPlayer.js's duck, scenes/eliteGates/egFight.js's
// stings and barks). The songs: their names, tempos and lengths as the page's table, whole bars looping on their bar line
// with nothing past the end, every voice set at the start, one note a key a moment; E Phrygian (the hymn in E major),
// the fanfare broken and mended, each band's motif in its yard's brass, each lord's four bars in its Court's songs, the
// halls' three variants in the seed's order, the Valkynaz rising, the end decaying. The law: THE PRIORITY TABLE pinned,
// the count replacing every song but a Valkynaz's and a Redoubt's, the gather and the closing silent, the end then the
// ambience; the host registering a context's songs and playing the law's. The mix: a sting always for a lord's blow or a
// CHECK on my feet and at most one each 1.5 s for an add's, each ducking the score 6 dB for 300 ms; the barks four a
// kind, nearest first; the duck's automation on the song's own level; the world host asking the Spire first.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  spireScoreSongs, spireScoreFor, spireScoreKey, spireVariantOrder, createSpireScoreHost, SPIRE_SONGS, SPIRE_BAND_SONGS, SPIRE_SCORE_SILENCE, SPIRE_COUNT_WARN_MS, SPIRE_WAKE_MS,
  SPIRE_END_MS, EG_SCORE_PRIORITY, SPIRE_PROGRAMS, SPIRE_CHANNELS, SPIRE_LEVEL, SPIRE_PRESS, EG_FANFARE, EG_FANFARE_BROKEN, EG_SCORE_BAND_MOTIFS, EG_SCORE_LORD_MOTIFS,
} from '../../../src/systems/eliteGates/egScore.js';
import { midiNote, SCORE_TPQ, SCORE_STING_LEAD_MS, gateScoreSongs } from '../../../src/systems/gate/gateScore.js';
import { sdScoreSongs } from '../../../src/systems/superDungeon/sdScore.js';
import { EG_LORDS } from '../../../src/net/eliteGates/egLaw.js';
import { createSpireMix, egStingWanted, egBarkCull, egDbGain, EG_MIX, EG_CRITICAL } from '../../../src/systems/eliteGates/egMix.js';
import { SongPlayer, EG_DUCK_BACK_S } from '../../../src/systems/song/songPlayer.js';
import { BOSS_CUES } from '../../../src/world/gate/gateBoss.js';
import { createEgFight } from '../../../src/scenes/eliteGates/egFight.js';
import { EG_FIGHT_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { egHallOf } from '../../../src/net/eliteGates/egLaw.js';
import { egHallCentre } from '../../../src/world/eliteGates/egHall.js';
import { EG_ROLE } from '../../../src/net/eliteGates/egBodies.js';

const notesOf = (song) => song.events.filter((e) => e.type === 'noteOn');
const PHRYGIAN = new Set([4, 5, 7, 9, 11, 0, 2]);   // E F G A B C D
const SHAPE = { hall: null, yard: [132, 32], set: [140, 8], wake: [138, 2], lord1: [138, 32], lord2: [144, 32], lord3: [152, 32], valk: [148, 48], redoubt: [72, 16], count: [160, 16], end: [70, 12] };
const HALL = [[100, 96], [88, 96], [92, 96], [110, 96]];
const melodyOf = (song, channel, bar0, bars) => notesOf(song).filter((e) => e.channel === channel && e.tick >= bar0 * 4 * SCORE_TPQ && e.tick < (bar0 + bars) * 4 * SCORE_TPQ).sort((a, b) => a.tick - b.tick || a.note - b.note);
const motifNotes = (bars, octave = 0) => bars.flat().map(([n]) => midiNote(n) + 12 * octave);

test('EG-G2 THE SONGS (section 26\'s table): the band\'s halls at 100, 88, 92 and 110 BPM for 96 bars; the yard 132 for 32, the set piece 140 for 8, the wake\'s swell 2 bars, the three Courts 138, 144 and 152, the Valkynaz 148 for 48, the Redoubt 72 for 16, the count 160 for 16, the end 70 for 12 - 8-character stems beside the Warden\'s and the Hour\'s; whole bars that loop on their bar line, nothing past the end, every voice\'s program, level and place at the start, one note a key a moment; made once for what they depend on (mutants: a tempo; a song a bar short; a note past the end; a voice unset)', () => {
  const others = new Set([...Object.values(gateScoreSongs()), ...Object.values(sdScoreSongs())].map((s) => s.name));
  for (let band = 0; band < 4; band++) {
    const songs = spireScoreSongs({ band, motif: band * 3, valk: band * 3 + 3, seed: 5 });
    assert.equal(spireScoreSongs({ band, motif: band * 3, valk: band * 3 + 3, seed: 5 }).hall, songs.hall, 'made once');
    assert.deepEqual(Object.keys(songs), ['hall', 'yard', 'set', 'wake', 'lord1', 'lord2', 'lord3', 'valk', 'redoubt', 'count', 'end']);
    for (const [k, s] of Object.entries(songs)) {
      const [bpm, bars] = k === 'hall' ? HALL[band] : SHAPE[k];
      assert.equal(s.name, k === 'hall' ? SPIRE_BAND_SONGS[band] : SPIRE_SONGS[k]);
      assert.match(s.name, /^[A-Z0-9]{8}\.HMI$/, 'eight and three'); assert.ok(!others.has(s.name));
      assert.equal(s.beatsPerMinute, bpm, `${k}'s tempo`); assert.equal(s.durationTicks, bars * 4 * SCORE_TPQ, `${k}: ${bars} whole bars`);
      assert.ok(Math.abs(s.secondsPerTick - 60 / (bpm * SCORE_TPQ)) < 1e-12); assert.equal(s.seamless, true);
      assert.equal(s.level, SPIRE_LEVEL[k]); assert.equal(s.press, SPIRE_PRESS[k]);
      const n = notesOf(s);
      assert.ok(n.length > 20, `${k} sounds`);
      assert.ok(n.every((e) => e.tick >= 0 && e.tick + e.duration <= s.durationTicks && e.velocity >= 1 && e.velocity <= 127 && e.note >= 0 && e.note <= 127), `${k}: nothing past its end`);
      for (let i = 1; i < s.events.length; i++) assert.ok(s.events[i].tick >= s.events[i - 1].tick);
      assert.equal(new Set(n.map((e) => `${e.tick}:${e.channel}:${e.note}`)).size, n.length, `${k}: one note a key a moment`);
      for (const [voice, ch] of Object.entries(SPIRE_CHANNELS)) {
        if (voice === 'kit') continue;
        const at0 = s.events.filter((e) => e.tick === 0 && e.channel === ch && e.type !== 'noteOn');
        assert.ok(at0.some((e) => e.type === 'programChange' && e.program === SPIRE_PROGRAMS[voice]) && at0.some((e) => e.controller === 7) && at0.some((e) => e.controller === 10), `${k}: ${voice} set`);
      }
    }
  }
  assert.equal(SPIRE_CHANNELS.kit, 9); assert.equal(new Set(Object.values(SPIRE_CHANNELS)).size, Object.keys(SPIRE_CHANNELS).length);
  assert.ok(SPIRE_LEVEL.lord1 < SPIRE_LEVEL.lord2 && SPIRE_LEVEL.lord2 < SPIRE_LEVEL.lord3 && SPIRE_LEVEL.hall < SPIRE_LEVEL.yard, 'the war louder by phase, the halls under the fights');
});

test('EG-G2 THE SPIRE\'S SOUND (section 26): E Phrygian - every bass note of the halls, the yard, the Courts, the count and the end in E F G A B C D, the Kyn\'s F against E in the war; the hymn in E major (G sharp, never G); the fanfare whole rises to the E, broken it falls on G natural and F; each band\'s motif in its yard\'s brass; each lord\'s four bars in its three Courts\' brass (the thirteen all their own), each Valkynaz\'s in its song; the halls\' three variants in an order the seed picks; the Valkynaz rising; the end decaying (mutants: a lord\'s motif shared; the hymn minor; the variants unseeded; the end swelling)', () => {
  const S = spireScoreSongs({ band: 0, motif: 1, valk: 3, seed: 2 });
  for (const k of ['hall', 'yard', 'lord1', 'lord2', 'lord3', 'valk', 'count', 'end']) for (const e of notesOf(S[k]).filter((q) => q.channel === SPIRE_CHANNELS.bass)) assert.ok(PHRYGIAN.has(e.note % 12), `${k}: its bass in E Phrygian (${e.note})`);
  assert.ok(notesOf(S.lord1).some((e) => e.channel === SPIRE_CHANNELS.bass && e.note % 12 === 5), 'the Kyn\'s F in the war');
  const hymn = notesOf(S.redoubt).filter((e) => e.channel === SPIRE_CHANNELS.strings || e.channel === SPIRE_CHANNELS.horn);
  assert.ok(hymn.some((e) => e.note % 12 === 8) && !hymn.some((e) => e.note % 12 === 7), 'the hymn in E major');
  assert.deepEqual(EG_FANFARE.map(([n]) => n), ['E4', 'E4', 'B4', 'G#4', 'E5']);
  assert.deepEqual(EG_FANFARE_BROKEN.map(([n]) => n).slice(-2), ['G4', 'F4'], 'broken: G natural, then the Kyn\'s F');
  for (let band = 0; band < 4; band++) {
    const y = spireScoreSongs({ band }).yard, m = motifNotes([EG_SCORE_BAND_MOTIFS[band]], band === 2 ? -1 : 0);
    assert.deepEqual(melodyOf(y, SPIRE_CHANNELS.brass, 4, 1).filter((e) => m.includes(e.note)).map((e) => e.note), m, `band ${band}: its motif in the yard's brass`);
  }
  assert.equal(EG_SCORE_LORD_MOTIFS.length, 13);
  const keys = EG_SCORE_LORD_MOTIFS.map((m) => JSON.stringify(m));
  assert.equal(new Set(keys).size, 13, 'thirteen motifs, each its own');
  assert.deepEqual(Object.values(EG_LORDS).map((L) => L.motif).sort((a, b) => a - b), [...Array(13).keys()], 'every lord names one');
  for (const motif of [0, 4, 10]) {
    const songs = spireScoreSongs({ motif }), m = EG_SCORE_LORD_MOTIFS[motif], oct = String(m[0][0][0]).endsWith('2') ? 1 : 0;
    for (const k of ['lord1', 'lord2', 'lord3']) assert.deepEqual(melodyOf(songs[k], SPIRE_CHANNELS.brass, 0, 4).map((e) => e.note).filter((n) => motifNotes(m, oct).includes(n)).slice(0, motifNotes(m, oct).length), motifNotes(m, oct), `motif ${motif} in ${k}'s brass`);
    const loud = (k) => { const n = melodyOf(songs[k], SPIRE_CHANNELS.brass, 0, 4).filter((e) => motifNotes(m, oct).includes(e.note)); return Math.max(...n.map((e) => e.velocity)); };
    assert.ok(loud('lord1') < loud('lord2') && loud('lord2') < loud('lord3'), `motif ${motif}: the brass harder each phase`);
  }
  const v = spireScoreSongs({ valk: 9 }).valk;
  assert.deepEqual(melodyOf(v, SPIRE_CHANNELS.brass, 0, 4).map((e) => e.note).filter((n) => motifNotes(EG_SCORE_LORD_MOTIFS[9]).includes(n)).slice(0, motifNotes(EG_SCORE_LORD_MOTIFS[9]).length), motifNotes(EG_SCORE_LORD_MOTIFS[9]), 'Seyth\'s own in its song');
  const vel = (song, b0, b1) => { const n = notesOf(song).filter((e) => e.channel === SPIRE_CHANNELS.hit && e.tick >= b0 * 4 * SCORE_TPQ && e.tick < b1 * 4 * SCORE_TPQ); return n.reduce((a, e) => a + e.velocity, 0) / n.length; };
  assert.ok(vel(v, 32, 48) > vel(v, 0, 16), 'the Valkynaz rises');
  const kick = (b0, b1) => notesOf(v).filter((e) => e.channel === 9 && e.tick >= b0 * 4 * SCORE_TPQ && e.tick < b1 * 4 * SCORE_TPQ).length;
  assert.ok(kick(32, 48) > kick(0, 16), 'the drums double');
  const end = notesOf(S.end), loud = (b0, b1) => { const n = end.filter((e) => e.tick >= b0 * 4 * SCORE_TPQ && e.tick < b1 * 4 * SCORE_TPQ); return n.reduce((a, e) => a + e.velocity, 0); };
  assert.ok(loud(0, 4) > loud(4, 8) && loud(4, 8) > loud(8, 12), 'the end decays in its time');
  // the variants
  assert.equal(new Set([0, 1, 2, 3, 4, 5].map((s) => spireVariantOrder(s).join())).size, 6, 'every order of three');
  const a = spireScoreSongs({ band: 1, seed: 0 }).hall, b = spireScoreSongs({ band: 1, seed: 1 }).hall;
  const block = (song, k) => JSON.stringify(notesOf(song).filter((e) => e.tick >= k * 32 * 4 * SCORE_TPQ && e.tick < (k + 1) * 32 * 4 * SCORE_TPQ).map((e) => [e.tick - k * 32 * 4 * SCORE_TPQ, e.channel, e.note]));
  assert.notEqual(block(a, 0), block(b, 0), 'another seed, another variant first');
  assert.equal(block(a, 1), block(b, 0), 'the same three variants, rotated (0-1-2 against 1-2-0)');
});

test('EG-G2 THE LAW (section 26): THE PRIORITY TABLE pinned - the end, a Valkynaz, a Redoubt, the count, a lord\'s wake, its phase, a set piece, a yard\'s or a rampart\'s trial, the band\'s halls, the ambience; the count\'s last two minutes replacing every song but a Valkynaz\'s and a Redoubt\'s; the gather and the closing silent (the count\'s two minutes aside); the wake\'s swell then SPIRLRD1; the end from its first note for SPIRE_END_MS, then the ambience; outside the Spire, nothing (mutants: the count over a Valkynaz; music in the gather; the end held for ever)', () => {
  assert.deepEqual([...EG_SCORE_PRIORITY], ['end', 'valk', 'redoubt', 'count', 'wake', 'lord', 'set', 'yard', 'hall', 'ambience']);
  assert.equal(spireScoreFor(null), null);
  const P = (o) => ({ band: 2, sg: 'trial', kind: 'span', lord: null, valk: false, phase: 1, countLeft: 600_000, set: false, sinceWake: 60_000, end: false, ...o });
  assert.equal(spireScoreFor(P({})), SPIRE_BAND_SONGS[2], 'the band\'s halls');
  assert.equal(spireScoreFor(P({ kind: 'yard' })), SPIRE_SONGS.yard); assert.equal(spireScoreFor(P({ kind: 'rampart' })), SPIRE_SONGS.yard);
  assert.equal(spireScoreFor(P({ set: true })), SPIRE_SONGS.set);
  assert.equal(spireScoreFor(P({ kind: 'court', sinceWake: 100 })), SPIRE_SONGS.wake);
  assert.equal(spireScoreFor(P({ kind: 'court', sinceWake: SPIRE_WAKE_MS + 1 })), SPIRE_SONGS.lord1);
  assert.equal(spireScoreFor(P({ kind: 'court', phase: 2 })), SPIRE_SONGS.lord2); assert.equal(spireScoreFor(P({ kind: 'court', phase: 3 })), SPIRE_SONGS.lord3);
  assert.equal(spireScoreFor(P({ kind: 'court', valk: true, sinceWake: 100 })), SPIRE_SONGS.valk, 'a Valkynaz from its wake');
  assert.equal(spireScoreFor(P({ kind: 'yard', valk: true })), SPIRE_SONGS.yard, 'a Valkynaz\'s song only in its Court');
  assert.equal(spireScoreFor(P({ sg: 'rest' })), SPIRE_SONGS.redoubt);
  assert.equal(spireScoreFor(P({ sg: 'gather' })), SPIRE_SCORE_SILENCE); assert.equal(spireScoreFor(P({ sg: 'arrive' })), SPIRE_SCORE_SILENCE); assert.equal(spireScoreFor(P({ sg: 'closing' })), SPIRE_SCORE_SILENCE);
  // the count
  const low = { countLeft: SPIRE_COUNT_WARN_MS - 1 };
  for (const o of [{}, { kind: 'yard' }, { set: true }, { kind: 'court' }, { kind: 'court', sinceWake: 10 }, { sg: 'closing' }]) assert.equal(spireScoreFor(P({ ...o, ...low })), SPIRE_SONGS.count, `the count replaces ${JSON.stringify(o)}`);
  assert.equal(spireScoreFor(P({ kind: 'court', valk: true, ...low })), SPIRE_SONGS.valk, 'never a Valkynaz');
  assert.equal(spireScoreFor(P({ sg: 'rest', ...low })), SPIRE_SONGS.redoubt, 'never a Redoubt');
  assert.equal(spireScoreFor(P({ countLeft: SPIRE_COUNT_WARN_MS + 1 })), SPIRE_BAND_SONGS[2], 'past two minutes, not yet');
  assert.equal(spireScoreFor(P({ countLeft: NaN })), SPIRE_BAND_SONGS[2], 'a count held (a rest) is no count');
  assert.equal(spireScoreFor(P({ sg: 'gather', ...low })), SPIRE_SCORE_SILENCE, 'the gather stays silent');
  // the end
  assert.equal(spireScoreFor(P({ end: true, sinceEnd: 0, kind: 'court', valk: true })), SPIRE_SONGS.end, 'the end over all');
  assert.equal(spireScoreFor(P({ end: true, sinceEnd: SPIRE_END_MS - 1 })), SPIRE_SONGS.end);
  assert.equal(spireScoreFor(P({ end: true, sinceEnd: SPIRE_END_MS })), SPIRE_SCORE_SILENCE, 'then the ambience');
  assert.equal(spireScoreKey(P({ sg: 'wait' })), 'ambience');
  // a song the law times never comes round again before it is let go (the player loops a song on its bar line)
  const S = spireScoreSongs({});
  assert.ok(SPIRE_END_MS < S.end.durationTicks * S.end.secondsPerTick * 1000, 'the end let go inside its twelve bars');
  assert.ok(SPIRE_WAKE_MS < S.wake.durationTicks * S.wake.secondsPerTick * 1000, 'the wake\'s swell inside its two');
});

test('EG-G2 THE HOST (world.js\'s hourScoreFrame asks it first): a context\'s songs registered under their names once, again when the band or the lord changes; the law\'s song played, the ambience faded to; the end from its own first note (the lead), then faded; outside the Spire let go by a fade - and answering whether it holds the music; the world host asks the Spire before the Hour (mutants: the songs never registered; the end timed from the word; held with no breach)', () => {
  const log = [], music = { current: null, registerSong: (n) => log.push(['reg', n]), playSong: (n) => { log.push(['play', n]); music.current = n; }, fadeOut: () => { log.push(['fade']); music.current = null; } };
  let t = 1_000_000;
  const host = createSpireScoreHost({ music, now: () => t });
  assert.equal(host.frame(null), false, 'no breach: not held');
  const view = (place, ctx = { band: 0, motif: 0, valk: 3, seed: 1 }) => ({ place: { band: 0, sg: 'trial', kind: 'span', countLeft: 900_000, sinceWake: 99_999, ...place }, ctx });
  assert.equal(host.frame(view({})), true);
  assert.equal(log.filter((q) => q[0] === 'reg').length, 11, 'eleven songs registered');
  assert.deepEqual(log.at(-1), ['play', SPIRE_SONGS.gal]);
  host.frame(view({}));
  assert.equal(log.filter((q) => q[0] === 'reg').length, 11, 'once a context');
  host.frame(view({ kind: 'court' }, { band: 0, motif: 2, valk: 3, seed: 1 }));
  assert.equal(log.filter((q) => q[0] === 'reg').length, 22, 'a new lord: its songs registered');
  assert.deepEqual(log.at(-1), ['play', SPIRE_SONGS.lord1]);
  host.frame(view({ sg: 'gather' }, { band: 0, motif: 2, valk: 3, seed: 1 }));
  assert.deepEqual(log.at(-1), ['fade'], 'the gather: the ambience alone');
  host.frame(view({ end: true }, { band: 0, motif: 2, valk: 3, seed: 1 }));
  assert.deepEqual(log.at(-1), ['play', SPIRE_SONGS.end]);
  t += SCORE_STING_LEAD_MS + SPIRE_END_MS - 100; host.frame(view({ end: true }, { band: 0, motif: 2, valk: 3, seed: 1 }));
  assert.deepEqual(log.at(-1), ['play', SPIRE_SONGS.end], 'its time counted from its own first note');
  t += 200; host.frame(view({ end: true }, { band: 0, motif: 2, valk: 3, seed: 1 }));
  assert.deepEqual(log.at(-1), ['fade'], 'then the ambience');
  music.current = 'X';
  assert.equal(host.frame(null), false);
  assert.deepEqual(log.at(-1), ['fade'], 'let go by a fade');
  assert.equal(host.held, false);
  const W = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
  const at = W.indexOf('\n  const hourScoreFrame = () => {\n');
  assert.ok(at > 0);
  assert.match(W.slice(at, at + 260), /^\n  const hourScoreFrame = \(\) => \{\n    if \(_spireScore\.frame\(egClient\?\.scoreView\?\.\(\) \?\? null\)\) return true;/, 'the Spire asked first');
});

test('EG-G2 THE SPIRE MIX (section 26): a personal sting always for a lord\'s blow or a CHECK, an add\'s at most one each 1.5 s, each the gate\'s sting at my feet and the score ducked 6 dB for 300 ms; the barks four a kind, nearest first, a critical one kept and ducking; a peer 4 dB down; the duck on the song\'s own level - down in 20 ms, held, back over EG_DUCK_BACK_S - and the music\'s duck handing it on (mutants: an add stinging every blow; the duck the wrong depth; five barks a kind)', () => {
  assert.deepEqual({ ...EG_MIX }, { duckDb: 6, duckMs: 300, addGapMs: 1500, barksPerKind: 4, peerDb: -4, watchfirePitch: 1.4 });
  assert.deepEqual([...EG_CRITICAL], ['sting', 'windup', 'release', 'check']);
  assert.ok(egStingWanted('lord', 0, 0) && egStingWanted('check', 0, 0));
  assert.ok(!egStingWanted('add', 1000, 0) && egStingWanted('add', 1500, 0) && egStingWanted('add', 0));
  const played = [], ducked = [];
  let t = 10_000;
  const mix = createSpireMix({ audio: { play3d: (clip, at, vol, o) => played.push({ clip, at, vol, o }) }, music: { duck: (db, s) => ducked.push([db, s]) }, now: () => t });
  assert.equal(mix.sting('lord', [1, 2, 3]), true);
  assert.deepEqual(played[0], { clip: BOSS_CUES.sting.clip, at: [1, 2, 3], vol: BOSS_CUES.sting.volume, o: { maxDistance: BOSS_CUES.sting.reach, distanceModel: 'linear', pitch: BOSS_CUES.sting.pitch } });
  assert.deepEqual(ducked[0], [6, 0.3]);
  assert.equal(mix.sting('add', [0, 0, 0]), true); t += 1000;
  assert.equal(mix.sting('add', [0, 0, 0]), false, 'an add\'s within 1.5 s: none');
  assert.equal(mix.sting('check', [0, 0, 0]), true, 'a CHECK always');
  t += 600; assert.equal(mix.sting('add', [0, 0, 0]), true);
  assert.deepEqual(mix.stats(), { stings: 4, ducks: 4 });
  const barks = [];
  for (let i = 0; i < 9; i++) barks.push({ kind: 'h', at: [i, 0, 0] });
  barks.push({ kind: 'l', at: [50, 0, 0], critical: true }, { kind: 'w', at: [2, 0, 0] });
  const kept = egBarkCull(barks, [0, 0, 0]);
  assert.deepEqual(kept.filter((b) => b.kind === 'h').map((b) => b.at[0]), [0, 1, 2, 3], 'four a kind, nearest first');
  assert.ok(kept.some((b) => b.kind === 'l') && kept.some((b) => b.kind === 'w'));
  const crit = egBarkCull([...Array(6)].map((_, i) => ({ kind: 'x', at: [i, 0, 0], critical: i === 5 })), [0, 0, 0]);
  assert.ok(crit.some((b) => b.critical), 'the critical bus never culled');
  assert.equal(egBarkCull([...Array(6)].map((_, i) => ({ kind: 'x', at: [i, 0, 0], critical: true })), [0, 0, 0]).length, 6, 'past the cap: every critical bark kept');
  const heard = [];
  assert.equal(mix.barks(barks, [0, 0, 0], (b) => heard.push(b)), kept.length);
  assert.equal(heard.length, 6); assert.equal(ducked.length, 5, 'the critical bark ducked');
  assert.ok(Math.abs(mix.peerVolume(1) - egDbGain(-4)) < 1e-12 && Math.abs(egDbGain(-6) - 0.501187) < 1e-6);
  // the duck's automation
  const calls = [];
  const param = { value: 1.45, cancelScheduledValues: (t0) => calls.push(['cancel', t0]), setValueAtTime: (v, t0) => calls.push(['set', +v.toFixed(6), +t0.toFixed(3)]), linearRampToValueAtTime: (v, t0) => calls.push(['ramp', +v.toFixed(6), +t0.toFixed(3)]) };
  const p = new SongPlayer(/** @type {any} */ ({ currentTime: 5 }));
  p._level = { gain: param }; p.song = { level: 1.45 };
  p.duck(6, 0.3);
  const low = +(1.45 * 10 ** (-6 / 20)).toFixed(6);
  assert.deepEqual(calls, [['cancel', 5], ['set', 1.45, 5], ['ramp', low, 5.02], ['set', low, 5.3], ['ramp', 1.45, +(5.3 + EG_DUCK_BACK_S).toFixed(3)]]);
  calls.length = 0; p.duck(0, 0.3); assert.equal(calls.length, 0, 'no depth, no duck');
  const M = readFileSync(new URL('../../../src/systems/music.js', import.meta.url), 'utf8');
  assert.match(M, /duck\(db, seconds\) \{ this\.player\?\.duck\?\.\(db, seconds\); \}/);
});

test('EG-G2 THE MIX IN THE FIGHT (scenes/eliteGates/egFight.js): a lord\'s blow on my feet stings once at its word and ducks the score, never again for that blow; an add\'s blow on my feet stings, a second add\'s within 1.5 s does not; a blow clear of my feet never stings; the legion\'s wind-up barks capped four a kind (mutants: a sting every frame; a blow clear of me stinging)', () => {
  let spec = null, seed = 0;
  for (seed = 1; seed < 50 && !spec; seed++) { const s = egHallOf(seed, 1, 0); if (s.kind === 'yard') spec = s; }
  seed--;
  const centre = egHallCentre(spec), me = [spec.fight?.x ?? 0, spec.fight?.z ?? 20];
  let t = 50_000;
  const body = (i, role, k, x, z) => ({ i, role, k, pt: 0, x, z, hp: 100, max: 100, fl: 0, mv: null, born: 0 });
  const blow = (i, o, at, s) => ({ i, o, at, wu: 1500, s: [s], ch: 0, el: null, p: 0.1, b: 0, nm: 'x', sp: 0, pu: 0 });
  const F = { ...EG_FIGHT_EMPTY, h: 1, bodies: [body(1, EG_ROLE.lord, 0, me[0] + 8, me[1]), body(2, EG_ROLE.add, 0, me[0] - 8, me[1]), body(3, EG_ROLE.add, 0, me[0] - 9, me[1])], blows: [] };
  const E = { b: '0123456789abcdef', h: 1, seed, geo: 0, sg: 'trial', end: null, hw: 1, fight: F, co: [] };
  const played = [], ducked = [];
  const fight = createEgFight({ link: { state: () => E }, now: () => t, feet: () => [centre[0] + me[0], centre[1], centre[2] + me[1]], player: () => ({ health: 100, maxHealth: 100 }), me: () => 'acct-mac',
    audio: { play3d: (clip, at) => played.push(clip) }, music: { duck: (db, s) => ducked.push([db, s]) } });
  F.blows = [blow(10, 1, t + 1000, ['d', me[0], me[1], 3])];
  fight.frame(); fight.frame();
  assert.equal(fight.state().mix.stings, 1, 'a lord\'s blow on me: one sting');
  assert.ok(played.includes(BOSS_CUES.sting.clip) && ducked.length >= 1);
  F.blows = [blow(11, 2, t + 1000, ['d', me[0], me[1], 3])]; fight.frame();
  assert.equal(fight.state().mix.stings, 2, 'an add\'s: stung');
  t += 500; F.blows = [blow(12, 3, t + 1000, ['d', me[0], me[1], 3])]; fight.frame();
  assert.equal(fight.state().mix.stings, 2, 'a second add\'s within 1.5 s: none');
  t += 2000; F.blows = [blow(13, 1, t + 1000, ['d', me[0] + 30, me[1], 3])]; fight.frame();
  assert.equal(fight.state().mix.stings, 2, 'clear of my feet: none');
  assert.ok(fight.shapes().some((s) => s.mine === false && s.fogFloor), 'the look laid on at the draw');
  // the wind-up barks: collected while the bodies draw, then handed to the mix's cap - never played one by one
  const SRC = readFileSync(new URL('../../../src/scenes/eliteGates/egFight.js', import.meta.url), 'utf8');
  assert.match(SRC, /_barks\.push\(\{ kind: look\.mobile, at: \[d\.at\[0\], d\.at\[1\], d\.at\[2\]\], cue: hostCue\('windup', look\.mobile\), critical: !!look\.lord \}\);/);
  assert.match(SRC, /mix\.barks\(_barks, cam\(\), \(b\) => play3\(b\.cue, b\.at\)\);/);
  assert.ok(!/play3\(hostCue\('windup'/.test(SRC), 'no wind-up played past the cap');
});
