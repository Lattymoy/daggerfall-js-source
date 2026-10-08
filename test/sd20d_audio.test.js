// SD20d (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md "SD20 - AUDIT SD III"): THE HOUR
// HEARD, AUDITED A THIRD TIME - each finding reproduced on the arc's own scripts first. A Rift's step played the street's
// song between the Hollow's and the hall's, cut both ways; the Hour's End sounded whole every two seconds for half a
// minute; the beds were one-shots re-armed as each pass ended, a gap at every seam, and the void's one moan came round
// every 5.8 s; every score let go by a cut; the war played on over the dead, the Remnant growling at them; a page back
// from a tab put away heard every turn it missed at once; the Rift's bell was asked for once; two crashes struck as one;
// the Hour's works ticked the Beat's own clunk at the Beat's own pitch on another clock; the songs flickered at the
// arena's reach, and the Steps and the hall played their own to the End's last toll; with no context the works were
// built anew every frame; the Hearts a landed Reset took went in silence while they burst in its light.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AudioEngine } from '../src/systems/audio.js';
import { createSdAir, buildVoidWind, buildArenaGears, SD_AIR_VOID, SD_AIR_WORKS, SD_AIR_HUM, SD_AIR_GEARS, SD_AIR_RATE, SD_VOID_SECONDS, SD_GEARS_SECONDS, SD_WORKS_TICK } from '../src/scenes/sdAir.js';
import { createDeadlandsAir, AIR_WIND, AIR_SEA } from '../src/scenes/deadlandsAir.js';
import { lowpass, lowpassLoop, rms } from '../src/systems/arenaSound.js';
import { createSdRemnantVoice, SD_VOICE_CUES, SD_VOICE_AWAY_MS } from '../src/scenes/sdRemnantVoice.js';
import { createSdRemnantBlows, SD_BLOW_CUES, SD_HEART_LATE_MS } from '../src/scenes/sdRemnantBlows.js';
import { sdEndAgain } from '../src/net/sdFightLink.js';
import { SD_BLOWS, SD_BODY, SD_END_EVERY_MS, SD_LOST_MS } from '../src/net/sdRemnant.js';
import { BOSS_CUES } from '../src/world/gateBoss.js';
import { createSdEnd, SD_BELL_ASK_MS } from '../src/scenes/sdEnd.js';
import { RIFT_BELL_KEY, RIFT_BELL_RECORDS } from '../src/systems/sdRiftSound.js';
import { gateScoreSongs } from '../src/systems/gateScore.js';
import { sdScoreSongs, sdScorePlace, hourScoreFor, createHourScore, HOUR_SONGS, SD_SCORE_SILENCE, SD_SCORE_HOLD_M, SD_SCORE_ENDS_WARN_MS } from '../src/systems/sdScore.js';
import { SD_STEPS_SOUNDS } from '../src/scenes/sdSteps.js';
import { SD_HALL_SOUNDS } from '../src/scenes/sdHall.js';
import { SD_CHECKPOINTS } from '../src/world/sdSteps.js';
import { SD_ARENA, SD_ORRERY, realmToDungeon, dungeonToRealm } from '../src/net/sdBrain.js';
import { SD_BAR_NEAR_M } from '../src/ui/sdRemnantBar.js';
import { SD_FIRST_STEP } from '../src/world/sdHall.js';
import { sdPhase } from '../src/net/sdLaw.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const W = read('src/scenes/world.js');
const T0 = 1_800_000_000_000;
const voice = (n, hz = 440, rate = 11025) => Float32Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * hz * i) / rate) * (0.6 + 0.4 * Math.sin((2 * Math.PI * i) / n)));
const fight = (over = {}) => ({ fi: 2, ph: 1, op: T0 - 60_000, ou: 0, su: 0, h: 1000, m: 1000, rem: { x: 0, z: 0, yw: 0, mv: null, atk: null }, ec: null, clk: null, cx: null, fell: null, lost: 0, ends: T0 + 9e6, ended: 0, ...over });

// ── the world host's score, from its own text ──────────────────────────
const fnText = (name) => {
  const at = W.indexOf(`  const ${name} = () => {`);
  assert.ok(at > 0, name);
  return W.slice(at, W.indexOf('\n  };\n', at) + 5);
};
/** world.js's Hour score frame over a music, a mode machine, a player and a fight the test holds. */
function scoreHost() {
  const log = [];
  let current = null;
  const music = {
    registerSong: () => {}, playSong: (n) => { if (current !== n) { current = n; log.push(['play', n]); } },
    stop: () => { current = null; log.push('stop'); }, fadeOut: () => { log.push('fade'); current = null; }, get current() { return current; },
  };
  const st = { mode: 'exterior', loc: null, slot: null, pos: [0, 0, 0], fight: null, rec: null, now: T0, hp: 100, stepping: false, transitioning: false };
  const env = {
    modes: { get mode() { return st.mode; }, get dungeonLocation() { return st.loc; }, sdRealmSlot: () => st.slot, get stepping() { return st.stepping; }, get transitioning() { return st.transitioning; } },
    player: { get pos() { return st.pos; } }, playerEntity: { get health() { return st.hp; } }, sdDungeonToRealm: dungeonToRealm, sdScorePlace, sdScoreSongs, createHourScore, SD_SCORE_SILENCE, music,
    sdFightLink: { state: () => st.fight, now: () => st.now }, sdHost: { record: () => st.rec }, sdPhase, _sharedOffsetMs: 0,
  };
  const body = `let _hourScoreHeld = false, _hourScoreMade = false, _hourPlace = null;\nconst _hourScore = createHourScore();\n${fnText('sdScoreWhere')}\n${fnText('hourScoreFrame')}\nreturn hourScoreFrame;`;
  return { frame: new Function(...Object.keys(env), body)(...Object.values(env)), log, st };
}

test('SD20d THE HOUR\'S SONG HELD THROUGH THE VEIL (A1): a Rift\'s step forces the world outside while it walks to the Hollow\'s pixel and builds the realm - and the Hour let the music go there: the street\'s song came up between the Hollow\'s and the hall\'s, cut both ways. While a step through the fire (worldModes.js `stepping`) or a door\'s build (`transitioning`) moves the world, the Hour holds the music; then the hall\'s song takes it, as one song takes another (mutants: let go under the veil; the stepping flag unsaid)', () => {
  const h = scoreHost(), { st, log } = h;
  st.mode = 'dungeon'; st.loc = { superTier: true, sdSlot: 4 };
  assert.equal(h.frame(), true);
  assert.deepEqual(log.at(-1), ['play', HOUR_SONGS.hollow]);
  // the step: outside at the Hollow's pixel under the veil, the realm building
  st.stepping = true; st.mode = 'exterior'; st.loc = null;
  const n = log.length;
  for (let f = 0; f < 30; f++) assert.equal(h.frame(), true, 'held - the director never fed');
  assert.equal(log.length, n, 'nothing let go, nothing played');
  st.stepping = false; st.transitioning = true;
  assert.equal(h.frame(), true, 'a door\'s build too');
  st.transitioning = false; st.mode = 'dungeon'; st.loc = { sdRealm: 4 }; st.slot = 4; st.pos = realmToDungeon(0, 1, SD_ORRERY.z);
  assert.equal(h.frame(), true);
  assert.deepEqual(log.slice(n), [['play', HOUR_SONGS.hall]], 'the hall\'s song takes the Hollow\'s');
  // a step that lands outside for good: let go once it is over - faded
  st.stepping = true; st.mode = 'exterior'; st.loc = null; st.slot = null;
  assert.equal(h.frame(), true);
  st.stepping = false;
  assert.equal(h.frame(), false);
  assert.equal(log.at(-1), 'fade');
  const modes = read('src/scenes/worldModes.js');
  assert.match(modes, /get stepping\(\) \{ return _stepping; \},/);
  assert.match(modes, /if \(_stepping\) return false;\n\s+_stepping = true;/);
});

test('SD20d EVERY SCORE LET GO BY A FADE (A4): the Hour\'s, the court\'s and the arena\'s - each cut its song at its level the frame it let the music go (music.stop()); now each fades it (music.fadeOut, MUSIC_FADE_OUT_S) and the director\'s song comes up as the fade ends (mutants: each cut again)', () => {
  const h = scoreHost(), { st, log } = h;
  st.mode = 'dungeon'; st.loc = { superTier: true, sdSlot: 4 };
  h.frame();
  st.mode = 'exterior'; st.loc = null;
  assert.equal(h.frame(), false);
  assert.equal(log.at(-1), 'fade');
  assert.ok(!log.includes('stop'), 'never cut');
  assert.match(fnText('gateScoreFrame'), /if \(_scoreHeld\) \{ _scoreHeld = false; music\.fadeOut\(\); \}/);
  assert.match(fnText('arenaScoreFrame'), /if \(_arenaScoreHeld\) \{ _arenaScoreHeld = false; music\.fadeOut\(\); \}/);
  for (const f of ['hourScoreFrame', 'gateScoreFrame', 'arenaScoreFrame']) assert.ok(!fnText(f).includes('music.stop()'), `${f}: no cut`);
});

test('SD20d NO WAR OVER THE DEAD (A5): one life a Hollow, and as I lay dead in its arena the war song played on and the Remnant growled, stepped and barked at my body; the score fades to nothing while I am dead and the Remnant\'s voice is framed for the living alone (mutants: the war over the dead; the voice to the dead)', () => {
  const h = scoreHost(), { st, log } = h;
  st.mode = 'dungeon'; st.loc = { sdRealm: 4 }; st.slot = 4; st.pos = realmToDungeon(0, 1, SD_ARENA.z - 5); st.fight = fight({ ph: 2 });
  h.frame();
  assert.deepEqual(log.at(-1), ['play', HOUR_SONGS.war2]);
  st.hp = 0;
  assert.equal(h.frame(), true, 'the Hour holds the music still');
  assert.equal(log.at(-1), 'fade', 'silent over the dead');
  assert.match(W, /if \(inRealm && playerEntity\.health > 0\) \{ try \{ sdRemVoice\?\.frame\(\); \}/);
});

test('SD20d THE PLACE\'S SONG HOLDS PAST ITS EDGE, AND THE HOUR\'S END IS THE WHOLE HOUR\'S (A10): at the arena\'s reach (its bar\'s, SD_BAR_NEAR_M past its rim) a step back and forth switched the war and the Steps\' song every few strides - the arena\'s holds SD_SCORE_HOLD_M past it, the Steps\' as far back toward the hall; and the last minute and the End reach the Steps and the hall too - they played their own songs to the last toll (mutants: no hold; the Steps\' song over the End)', () => {
  const R = SD_ARENA.r + SD_BAR_NEAR_M;
  const atD = (d) => [SD_ARENA.x, SD_ARENA.z - d];
  assert.equal(sdScorePlace(...atD(R + 1)), 'steps', 'coming in: the Steps\' until the reach');
  assert.equal(sdScorePlace(...atD(R - 0.5)), 'arena');
  assert.equal(sdScorePlace(...atD(R + 1), 'arena'), 'arena', 'going out: held');
  assert.equal(sdScorePlace(...atD(R + SD_SCORE_HOLD_M - 0.1), 'arena'), 'arena');
  assert.equal(sdScorePlace(...atD(R + SD_SCORE_HOLD_M + 0.1), 'arena'), 'steps');
  const edge = SD_FIRST_STEP.z - SD_FIRST_STEP.r;
  assert.equal(sdScorePlace(0, edge - 1), 'hall');
  assert.equal(sdScorePlace(0, edge - 1, 'steps'), 'steps', 'back toward the hall: held');
  assert.equal(sdScorePlace(0, edge - SD_SCORE_HOLD_M - 0.1, 'steps'), 'hall');
  // the whole Hour's end
  const f = fight({ ends: T0 + SD_SCORE_ENDS_WARN_MS - 1000 });
  for (const place of ['steps', 'hall', 'arena']) assert.equal(hourScoreFor(place, f, T0), HOUR_SONGS.last, `${place}: its last minute`);
  for (const place of ['steps', 'hall', 'arena']) assert.equal(hourScoreFor(place, fight({ ended: T0 - 1 }), T0), SD_SCORE_SILENCE, `${place}: the End, nothing over it`);
  assert.equal(hourScoreFor('steps', fight({ ends: T0 + SD_SCORE_ENDS_WARN_MS + 1 }), T0), HOUR_SONGS.steps, 'before it: its own');
  assert.equal(hourScoreFor('hall', fight({ lost: T0 - 1 }), T0), HOUR_SONGS.hall, 'a lost fight ends nothing in the hall');
  assert.equal(hourScoreFor('hollow', fight({ ended: T0 - 1 }), T0), HOUR_SONGS.hollow, 'the Hollow outside is no Hour');
  // the host remembers where I stood
  const h = scoreHost(), { st, log } = h;
  st.mode = 'dungeon'; st.loc = { sdRealm: 4 }; st.slot = 4; st.fight = fight();
  const at = (d) => realmToDungeon(SD_ARENA.x, 1, SD_ARENA.z - d);
  st.pos = at(R - 1); h.frame();
  assert.deepEqual(log.at(-1), ['play', HOUR_SONGS.war1]);
  const n = log.length;
  for (const d of [R + 1, R - 0.5, R + 2, R + 1.5]) { st.pos = at(d); h.frame(); }
  assert.equal(log.length, n, 'no song switched at the edge');
  st.pos = at(R + SD_SCORE_HOLD_M + 1); h.frame();
  assert.deepEqual(log.at(-1), ['play', HOUR_SONGS.steps]);
});

/** The blows and the voice over a fight the test turns: every cue each plays. */
function hearing(s0) {
  let t = T0;
  const s = { ...s0 }, plays = [];
  const audio = { play3d: (clip, at, volume, o) => { plays.push({ t, clip, volume, pitch: o?.pitch }); return 1; } };
  const link = { state: () => s, now: () => t, counted: () => false };
  const voice = createSdRemnantVoice({ audio, link, feet: () => null });
  const blows = createSdRemnantBlows({ audio, link, feet: () => null, player: () => null });
  voice.frame(); blows.frame();
  return { s, plays, at: () => t, step: (ms = 16) => { t += ms; voice.frame(); blows.frame(); } };
}
const cueIs = (p, c) => p.clip === c.clip && p.pitch === c.pitch;

test('SD20d THE END HEARD WHOLE ONCE, THEN ITS KNELL (A2): after its first landing (the fight\'s `ended`) the law strikes the whole arena every SD_END_EVERY_MS until the fight is lost, half a minute - and each strike sounded whole, its roll, its toll and its fire: forty-five cues. The first is heard whole; each strike after it a knell, a third of its toll (net/sdFightLink.js sdEndAgain) (mutants: every strike whole; the knell silent; the first a knell)', () => {
  const endAt = T0 + 2500;
  const r = hearing(fight({ ph: 3, h: 500, op: T0 - 600_000 }));
  const endAtk = (i, at) => ({ k: 'atk', b: SD_BODY.hour, i, a: SD_BLOWS.end.id, at, x: 0, z: 0, yw: 0, tg: [] });
  r.s.clk = endAtk(100, endAt); r.s.ended = endAt;
  let next = endAt, i = 100;
  for (; r.at() < endAt + SD_LOST_MS; r.step(16)) {
    if (r.at() >= next + 50) { next += SD_END_EVERY_MS; r.s.clk = endAtk(++i, next); }   // each landing seen, then the next strike's word
  }
  const strikes = i - 100 + 1;
  assert.ok(strikes >= 15, `${strikes} strikes`);
  const count = (c) => r.plays.filter((p) => cueIs(p, c)).length;
  assert.equal(count(SD_BLOW_CUES.windup.end), 1, 'its roll once');
  assert.equal(r.plays.filter((p) => cueIs(p, SD_VOICE_CUES.release.end) && p.volume === SD_VOICE_CUES.release.end.volume).length, 1, 'its toll once');
  assert.equal(count(SD_BLOW_CUES.land.end), 1, 'its fire once');
  const knells = r.plays.filter((p) => p.clip === SD_VOICE_CUES.knell.clip && p.pitch === SD_VOICE_CUES.knell.pitch && p.volume === SD_VOICE_CUES.knell.volume);
  assert.ok(knells.length >= strikes - 2 && knells.length <= strikes, `a knell each strike after (${knells.length} of ${strikes - 1})`);
  assert.equal(r.plays.filter((p) => cueIs(p, SD_VOICE_CUES.growl)).length, 0, 'it stands still and silent under the knell');
  assert.ok(r.plays.length <= strikes + 2, `${r.plays.length} cues - it was ${strikes * 3} and its growls`);
  assert.ok(SD_VOICE_CUES.knell.volume <= SD_VOICE_CUES.release.end.volume / 2);
  assert.equal(sdEndAgain(endAtk(1, endAt), { ended: endAt }), false, 'the first');
  assert.equal(sdEndAgain(endAtk(2, endAt + SD_END_EVERY_MS), { ended: endAt }), true);
  assert.equal(sdEndAgain({ ...endAtk(3, endAt + 9999), a: SD_BLOWS.pulse.id }, { ended: endAt }), false, 'the End alone');
  assert.equal(sdEndAgain(endAtk(4, endAt + 9999), { ended: 0 }), false, 'no End yet');
});

test('SD20d A PAGE AWAY HEARS NOTHING IT MISSED (A6): a tab put away while the fight turned - the Dragon Break, the Last Moment, the stun - sounded every turn at once on its first frame back; a fight unheard SD_VOICE_AWAY_MS is taken again as it stands, in silence, and its next turn heard as it happens; a hitch shorter than that still hears its turns (mutants: the away heard; every hitch silent)', () => {
  const r = hearing(fight());
  r.step();
  r.plays.length = 0;
  // away twenty seconds: the realm folds the fight on meanwhile
  r.s.ph = 3; r.s.ou = r.at() + 20_000 + 4000; r.s.su = r.at() + 20_000 + 3000;
  r.step(20_000);
  assert.deepEqual(r.plays.filter((p) => [SD_VOICE_CUES.last, SD_VOICE_CUES.lastRoll, SD_VOICE_CUES.stunned, SD_VOICE_CUES.stunRing, SD_VOICE_CUES.back].some((c) => cueIs(p, c))), [], 'nothing of what it passed');
  r.step(3100);
  assert.equal(r.plays.filter((p) => cueIs(p, SD_VOICE_CUES.recover)).length, 1, 'its next turn, as it happens');
  // a hitch: two seconds, the stun's turn heard
  const h = hearing(fight());
  h.step();
  h.s.su = h.at() + 1000;
  h.step(Math.min(2000, SD_VOICE_AWAY_MS - 1));
  assert.equal(h.plays.filter((p) => cueIs(p, SD_VOICE_CUES.stunned)).length, 0, 'a stun already over when seen: not heard as begun');
  h.s.su = h.at() + 5000; h.step(1500);
  assert.equal(h.plays.filter((p) => cueIs(p, SD_VOICE_CUES.stunned)).length, 1, 'a turn across a hitch: heard');
  assert.ok(SD_VOICE_AWAY_MS > 2000);
});

test('SD20d THE HEARTS A LANDED RESET TAKES ARE HEARD GOING (A12): a Reset that lands breaks no Heart (SD11d) - and the ones left standing went in silence while they burst in its light (SD20c, V10); each rings low as it goes, live (the crystal\'s ring, never its shatter); a stun\'s word heard late still shatters nothing (mutants: the taken unheard; the taken shattered)', () => {
  const resetAt = T0 + 1000;
  const r = hearing(fight({ ph: 3, rem: { x: 0, z: 0, yw: 0, mv: null, atk: { k: 'atk', b: SD_BODY.remnant, i: 7, a: SD_BLOWS.reset.id, at: resetAt, x: 0, z: 0, yw: 0, tg: [] } } }));
  r.s.cx = { i: 7, m: 500, c: [[6, 0, 50], [-6, 0, 0], [0, 6, 50]] };
  r.step(16);
  r.plays.length = 0;
  for (; r.at() < resetAt; r.step(100));
  r.s.cx = null;   // the Reset landed: the Hearts taken
  r.step(16);
  const rings = r.plays.filter((p) => cueIs(p, BOSS_CUES.crystalRing)), shatters = r.plays.filter((p) => p.clip === BOSS_CUES.crystalBreak.clip);
  assert.equal(rings.length, 2, 'the two left standing ring');
  assert.equal(shatters.length, 0, 'none shattered');
  // a landed Reset seen long after (a tab put away): nothing
  const away = hearing(fight({ ph: 3, rem: { x: 0, z: 0, yw: 0, mv: null, atk: { k: 'atk', b: SD_BODY.remnant, i: 9, a: SD_BLOWS.reset.id, at: resetAt, x: 0, z: 0, yw: 0, tg: [] } } }));
  away.s.cx = { i: 9, m: 500, c: [[6, 0, 50]] };
  away.step(16);
  away.plays.length = 0;
  away.step(resetAt - away.at() + SD_HEART_LATE_MS + 500);
  away.s.cx = null;
  away.step(16);
  assert.equal(away.plays.filter((p) => cueIs(p, BOSS_CUES.crystalRing)).length, 0, 'heard live alone');
  // the stun's word heard late: nothing
  const late = hearing(fight({ ph: 3, rem: { x: 0, z: 0, yw: 0, mv: null, atk: { k: 'atk', b: SD_BODY.remnant, i: 8, a: SD_BLOWS.reset.id, at: T0 + 6000, x: 0, z: 0, yw: 0, tg: [] } } }));
  late.s.cx = { i: 8, m: 500, c: [[6, 0, 50]] };
  late.step(16);
  late.plays.length = 0;
  late.s.stunAt = late.at(); late.s.su = late.at() + 100; late.s.cx = null;
  late.step(9000);
  assert.equal(late.plays.filter((p) => cueIs(p, BOSS_CUES.crystalRing) || p.clip === BOSS_CUES.crystalBreak.clip).length, 0);
});

// ── the beds ──────────────────────────────────────────────────────────
/** A context that keeps what it is asked: its sources, each one's loop, rate, start and stop, its gains' ramps. */
function fakeContext() {
  const made = { sources: [], gains: [], panners: [] };
  let now = 0;
  const param = (v = 0) => ({ value: v, events: [], setValueAtTime(x, t) { this.events.push(['set', x, t]); this.value = x; }, linearRampToValueAtTime(x, t) { this.events.push(['ramp', x, t]); }, cancelScheduledValues(t) { this.events.push(['cancel', t]); } });
  const node = (o = {}) => ({ connect(n) { return n; }, disconnect() { this.gone = true; }, ...o });
  const ctx = {
    state: 'running', destination: node(), get currentTime() { return now; }, set time(t) { now = t; },
    createBufferSource() { const s = node({ context: ctx, loop: false, playbackRate: param(1), started: null, stopAt: null, start(w) { this.started = w ?? now; }, stop(w) { this.stopAt = w ?? now; } }); made.sources.push(s); return s; },
    createGain() { const g = node({ gain: param(1), context: ctx }); made.gains.push(g); return g; },
    createPanner() { const p = node({ positionX: param(), positionY: param(), positionZ: param() }); made.panners.push(p); return p; },
    createBuffer(ch, len, rate) { const d = new Float32Array(len); return { numberOfChannels: ch, length: len, sampleRate: rate, duration: len / rate, getChannelData: () => d }; },
  };
  return { ctx, made };
}
function bedEngine() {
  const { ctx, made } = fakeContext(), e = new AudioEngine();
  e.ctx = ctx; e.enabled = true;
  e.registerSamples('bed:a', new Float32Array(2000), 22050);
  e.registerSamples('bed:b', new Float32Array(3000), 22050);
  return { e, ctx, made };
}

test('SD20d THE BEDS ARE LOOPS THE ENGINE RUNS (A3): systems/audio.js setBed and setBed3d - one buffer looping sample-true (`loop`), where setLoop\'s channel re-armed a one-shot from its `ended` (DFU\'s riding clop, a gap of the main thread\'s dispatch at every seam); the same call each frame keeps the one source, its volume and pitch live; it rises from nothing as it begins and fades to nothing as it is let go or swapped, BED_FADE_S - a bed cut at its level pops (mutants: a one-shot; restarted each frame; cut)', () => {
  const { e, ctx, made } = bedEngine();
  e._out();   // the bus stands first, as in a page that has played anything
  const g0 = made.gains.length, a = e.setBed('air', 'bed:a', { volume: 0.3, pitch: 0.8 });
  const vol = made.gains[g0], fade = made.gains[g0 + 1];
  assert.equal(made.sources.length, 1);
  const src = made.sources[0];
  assert.equal(src.loop, true, 'looped by the engine');
  assert.equal(src.playbackRate.value, 0.8);
  assert.deepEqual(fade.gain.events.map((x) => x[0]), ['set', 'ramp'], 'rising from nothing');
  assert.equal(fade.gain.events[1][1], 1);
  for (let f = 0; f < 10; f++) { ctx.time = f / 60; assert.equal(e.setBed('air', 'bed:a', { volume: 0.3 + f / 100, pitch: 0.8 }), a); }
  assert.equal(made.sources.length, 1, 'one source, kept');
  assert.ok(Math.abs(vol.gain.value - 0.39) < 1e-9, 'its volume live');
  // swapped: the old fades as the new rises
  ctx.time = 1;
  e.setBed('air', 'bed:b', { volume: 0.3 });
  assert.equal(made.sources.length, 2);
  assert.ok(src.stopAt > 1 && src.stopAt <= 1.5, `the old stopped after its fade (${src.stopAt})`);
  assert.deepEqual(fade.gain.events.slice(-1)[0].slice(0, 2), ['ramp', 0]);
  // let go: faded, then stopped
  ctx.time = 2;
  assert.equal(e.setBed('air', null), null);
  assert.ok(made.sources[1].stopAt > 2 && made.sources[1].stopAt <= 2.5);
  assert.equal(e.setBed('air', null), null, 'nothing twice');
  // positional, moved each call
  const b3 = e.setBed3d('hum', 'bed:a', [1, 2, 3], { volume: 0.5, refDistance: 4, maxDistance: 9, distanceModel: 'linear' });
  assert.ok(b3 && made.sources.at(-1).loop);
  assert.equal(e.setBed3d('hum', 'bed:a', [4, 5, 6], { volume: 0.5 }), b3);
  const pan = made.panners.at(-1);
  assert.deepEqual([pan.positionX.value, pan.positionY.value, pan.positionZ.value], [4, 5, -6], 'moved where it is said (the audio frame\'s z)');
  // the riding loop keeps its own shape
  e.setLoop('riding', 'bed:a', { volume: 1 });
  assert.equal(made.sources.at(-1).loop, false, 'setLoop: the clop re-armed as DFU\'s is');
  // the Rift bell's loop3d fades too
  const bell = e.loop3d('bed:a', [0, 0, 0], 1, {});
  ctx.time = 3; bell.fadeStop();
  assert.ok(made.sources.at(-1).stopAt > 3);
});

test('SD20d THE HOUR\'S BEDS MADE TO LOOP (A3, A11): the void\'s wind the deep moan laid over itself at a spread of low pitches round SD_VOID_SECONDS (the one moan looped came round every 5.8 s, the same swell in the same place), the arena\'s gears the grind the same way round SD_GEARS_SECONDS; every made loop darkened as a loop (arenaSound.js lowpassLoop - begun from nought, a darkened loop stepped at its seam each pass); all four on named beds, made once, the build never asked again when only the registration fails (with no context the works and the hum were built anew every frame, 2.2 ms) (mutants: the one moan; the seam stepped; a bed unmade; the build every frame)', () => {
  const moan = voice(11025 * 3, 180), grind = voice(11025, 90);
  const v = buildVoidWind(moan);
  assert.equal(v.length, Math.round(SD_AIR_RATE * SD_VOID_SECONDS));
  assert.ok(Math.abs(rms(v) - rms(moan)) / rms(moan) < 0.05, 'the moan\'s own level');
  // not the one moan round again: one pass of it (pitched) against the next
  const L = Math.round((moan.length / 11025 / SD_AIR_VOID.pitch) * SD_AIR_RATE);
  let dot = 0, n1 = 0, n2 = 0;
  for (let i = 0; i < L; i++) { dot += v[i] * v[i + L]; n1 += v[i] * v[i]; n2 += v[i + L] * v[i + L]; }
  assert.ok(Math.abs(dot / Math.sqrt(n1 * n2)) < 0.5, `two passes alike: ${(dot / Math.sqrt(n1 * n2)).toFixed(3)}`);
  const g = buildArenaGears(grind);
  assert.equal(g.length, Math.round(SD_AIR_RATE * SD_GEARS_SECONDS));
  assert.ok(rms(g) > 0);
  assert.deepEqual([...buildVoidWind(null)].every((x) => x === 0), true);
  // the seam: a loop's start takes up where its end left off
  const raw = Float32Array.from({ length: 4000 }, (_, i) => 0.5 + 0.1 * Math.sin((2 * Math.PI * 8 * i) / 4000)), plain = lowpass(raw.slice(), 22050, 700), looped = lowpassLoop(raw.slice(), 22050, 700);
  const step = (x) => Math.abs(x[0] - x[x.length - 1]), inner = (x) => Math.max(...Array.from({ length: x.length - 1 }, (_, i) => Math.abs(x[i + 1] - x[i])));
  assert.ok(step(plain) > 4 * inner(plain), 'begun from nought: a step at the seam');
  assert.ok(step(looped) <= inner(looped) + 1e-6, 'the loop\'s seam no steeper than its own steps');
  // the four on beds, made once; the build once however often the registration is refused
  let reads = 0, registered = 0, open = false;
  const beds = new Map(), beds3 = new Map();
  const eng = {
    setBed: (name, clip, o) => { if (clip == null) beds.delete(name); else beds.set(name, { clip, ...o }); },
    setBed3d: (name, clip, pos, o) => { if (clip == null) beds3.delete(name); else beds3.set(name, { clip, pos, ...o }); },
    play3d: () => {}, samplesOf: (i) => { reads++; return voice(4000, 100 + i); }, registerSamples: () => { registered++; return open; },
  };
  const air = createSdAir(eng);
  for (let f = 0; f < 20; f++) air.frame(10 + f / 60, [0, 1, 0]);
  assert.equal(reads, 4, 'built once - no context to make them on yet');
  assert.equal(beds.size + beds3.size, 0);
  open = true;
  air.frame(11, [0, 1, 0]); air.frame(11.1, [0, 1, 0]);
  assert.equal(reads, 4);
  assert.deepEqual([...beds.keys()].sort(), [SD_AIR_VOID.loop, SD_AIR_WORKS.loop].sort());
  assert.deepEqual([...beds3.keys()].sort(), [SD_AIR_GEARS.loop, SD_AIR_HUM.loop].sort());
  assert.deepEqual([beds.get(SD_AIR_VOID.loop).clip, beds.get(SD_AIR_WORKS.loop).clip, beds3.get(SD_AIR_HUM.loop).clip, beds3.get(SD_AIR_GEARS.loop).clip], [SD_AIR_VOID.clip, SD_AIR_WORKS.clip, SD_AIR_HUM.clip, SD_AIR_GEARS.clip], 'every one made');
  air.stop();
  assert.equal(beds.size + beds3.size, 0, 'let go');
  // the Deadlands' beds the same way
  const dl = new Map(), dl3 = new Map();
  const dla = createDeadlandsAir({ setBed: (n, c, o) => { if (c == null) dl.delete(n); else dl.set(n, { c, ...o }); }, setBed3d: (n, c) => { if (c == null) dl3.delete(n); else dl3.set(n, c); }, play3d() {} });
  dla.frame(5, [0, 0, 0], [[1, 0, 1]]);
  assert.deepEqual([...dl.keys()].sort(), [AIR_SEA.loop, AIR_WIND.loop].sort());
  assert.equal(dl3.size, 1);
  dla.stop();
  assert.equal(dl.size + dl3.size, 0);
});

test('SD20d THE WORKS UNDER THE BEAT (A9): the Hour\'s works ticked the Steps\' own clunk at the Beat\'s own pitch (1.6), a second apart where the Beat\'s half beat is 1.8 s - a second clock over the one a jump is timed by. Its tick and tock are its own pitches now, under the Beat\'s and apart from the hall\'s turns, and on the Beat\'s span the works duck to SD_AIR_WORKS.duck, eased in and out (mutants: the Beat\'s pitch; never ducked)', () => {
  const beat = 1.6, hall = [1, 0.85, 1.25];
  assert.equal(SD_STEPS_SOUNDS.tick, SD_HALL_SOUNDS.clunk, 'the one clunk');
  for (const p of SD_WORKS_TICK) {
    assert.ok(p < beat * 0.75, `the works' ${p} well under the Beat's ${beat}`);
    for (const q of hall) assert.ok(Math.abs(Math.log2(p / q)) > 1 / 12, `${p} a semitone at least from the hall's ${q}`);
  }
  const beds = new Map();
  const eng = { setBed: (n, c, o) => beds.set(n, o), setBed3d: () => {}, play3d: () => {}, samplesOf: () => voice(2000), registerSamples: () => true };
  const air = createSdAir(eng);
  const span = (k) => realmToDungeon(0, 1, SD_CHECKPOINTS[k].z);
  for (let f = 0; f < 120; f++) air.frame(20 + f / 60, span(1));
  assert.ok(Math.abs(beds.get(SD_AIR_WORKS.loop).volume - SD_AIR_WORKS.volume * SD_AIR_WORKS.duck) < 0.01, 'ducked on the Beat');
  air.frame(22.02, span(2));
  assert.ok(beds.get(SD_AIR_WORKS.loop).volume < SD_AIR_WORKS.volume * 0.5, 'eased out, not stepped');
  for (let f = 0; f < 120; f++) air.frame(22.04 + f / 60, span(2));
  assert.ok(Math.abs(beds.get(SD_AIR_WORKS.loop).volume - SD_AIR_WORKS.volume) < 0.01, 'whole off it');
});

test('SD20d THE RIFT\'S BELL ASKED FOR UNTIL IT STANDS (A7): the bell was asked for once, as the Rift stood - a Rift stood before the archive was read or a context stood (no gesture yet) stood silent for good; it is asked again each SD_BELL_ASK_MS while the Rift stands without one, its toll built once; let go by a fade (mutants: asked once; built every ask; cut)', () => {
  let t = 0, reads = 0, open = false, loops = 0, faded = 0;
  const audio = {
    samplesOf: (i) => { if (i === RIFT_BELL_RECORDS.bell) reads++; return voice(3000, 300); },
    registerSamples: (key) => key === RIFT_BELL_KEY && open,
    loop3d: () => { loops++; return { stop() {}, fadeStop() { faded++; } }; },
  };
  const end = createSdEnd({ audio, now: () => t });
  end.stand({ rift: { at: [0, 0, 0], size: 5 } });
  assert.equal(loops, 0, 'no context: no bell');
  for (; t < 5000; t += 16) end.frame(null);
  assert.equal(loops, 0);
  assert.equal(reads, 1, 'its toll built once');
  open = true;
  for (let k = 0; k < (SD_BELL_ASK_MS + 100) / 16; k++) { t += 16; end.frame(null); }
  assert.equal(loops, 1, 'it stands');
  for (let k = 0; k < 200; k++) { t += 16; end.frame(null); }
  assert.equal(loops, 1, 'once');
  end.clear();
  assert.equal(faded, 1, 'faded as the dungeon goes');
});

test('SD20d NO NOTE STRUCK TWICE AS ONE (A8): the Last Moment\'s and the last minute\'s war kit crashed on the songs\' own crashes, and a theme\'s note fell on its bar\'s own chord tone - thirty-three doubled note-ons in the Hour\'s nine songs, twenty-five in the Warden\'s war; no song of either strikes the same note on the same channel at the same tick twice, the one note its loudest and longest (mutants: the kit\'s crash under the song\'s; the writer\'s merge undone)', () => {
  const merged = sdScoreSongs().war3.events.filter((e) => e.type === 'noteOn' && e.channel === 9 && e.note === 49 && e.tick === 0);
  assert.equal(merged.length, 1);
  for (const [k, s] of [...Object.entries(sdScoreSongs()), ...Object.entries(gateScoreSongs()).map(([n, x]) => [`gate ${n}`, x])]) {
    const seen = new Set();
    let dup = 0;
    for (const e of s.events) {
      if (e.type !== 'noteOn') continue;
      const key = `${e.tick}:${e.channel}:${e.note}`;
      if (seen.has(key)) dup++;
      seen.add(key);
    }
    assert.equal(dup, 0, `${k}: ${dup} doubled`);
  }
});
