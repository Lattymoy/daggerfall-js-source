// DISC19 (2026-09-24, Mac, five in one message). bible/01-Overview/Field-Bugs-2026-09-23.md, DISC19.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';

import { modSetting, setModSetting, _resetModSettings, SWITCH_RESETS, KEY_MIGRATIONS, MOD_SETTINGS } from '../src/systems/modSettings.js';
import { diverseWeaponsPresetOn } from '../src/combat/diverseWeapons.js';
import {
  LAB_GRASS_HEAD, LAB_GRASS_FS, GAME_GRASS_FS, GAME_GRASS_VS, GRASSPX_FS_EDITS, GRASSFOG_FS_EDITS, GRASSFOG_VS_EDITS,
  FOG_FACTOR_GLSL, applyGrassEdits,
} from '../src/render/labGrass.js';
import { glslFunctions } from './glsl.mjs';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// ── DISC19-A: "Grass isnt affected by fog" ──
/** The grass fragment stage's colour for a blade `d` metres from the eye under `fog` (mode 0 none, 1 linear, 2 exp,
 *  3 exp2), run on the stage's own text through test/glsl.mjs - smooth (uPixel 0) or the pixel tuft (uPixel 1, a
 *  solid tip texel from the sheet). */
function bladeColour(fs, { d, fog = { mode: 0, density: 0, range: [0, 1] }, pixel = 0 }) {
  const binds = {
    vT: 0.8, vTint: 0.5, vFade: 1, vLam: 0.6, vSnow: 0, vWet: 0, vGround: [0.3, 0.28, 0.2], vMoonLam: 0,
    vUV: [0.5, 0.5], vVar: 0, vWorld: [0, 0, d],
    uAmb: [0.4, 0.4, 0.45], uSunCol: [1, 0.95, 0.85], uMoonCol: [0.2, 0.2, 0.3], uDim: 1, uSunScale: 1, uMoonScale: 0,
    uPixel: pixel, uPxSteps: 8, uPxVariants: 4, uPxTintBands: 4,
    uFogColor: [0.6, 0.62, 0.66], uFogMode: fog.mode, uFogDensity: fog.density, uFogRange: fog.range, uCamPos: [0, 0, 0],
    gl_FragCoord: [3, 5, 0.5, 1], o: [0, 0, 0, 0],
    texture: () => [3 / 4, 0.9, 0.5, 1],
  };
  const f = glslFunctions(LAB_GRASS_HEAD + fs, binds);
  f.main();
  return f.globals.o.slice(0, 3);
}
const near = (a, b, e) => a.every((v, i) => Math.abs(v - b[i]) <= e);

test('DISC19-A: a blade fogs as the ground under it does - heavy fog swallows it at 100 m, rain thins it, a clear day barely touches it; smooth and pixel alike, and with no fog the picture is the unfogged stage\'s own (mutants: the blend dropped; the blend before the pixel ramp; the world point not handed down)', () => {
  const unfogged = applyGrassEdits(LAB_GRASS_FS, GRASSPX_FS_EDITS);   // the stage as it compiled before DISC19
  for (const pixel of [0, 1]) {
    const clear = bladeColour(unfogged, { d: 100, pixel });
    assert.deepEqual(bladeColour(GAME_GRASS_FS, { d: 100, pixel }), clear, `${pixel ? 'pixel' : 'smooth'}: no fog, the same picture`);
    // heavy fog, exp 0.05: e^-5 of the blade is left at 100 m - the fog's colour to a percent
    const heavy = bladeColour(GAME_GRASS_FS, { d: 100, pixel, fog: { mode: 2, density: 0.05, range: [0, 0] } });
    assert.ok(near(heavy, [0.6, 0.62, 0.66], 0.01), `${pixel ? 'pixel' : 'smooth'}: 100 m into heavy fog is the fog (${heavy.map((v) => v.toFixed(3))})`);
    // the blend is exactly the terrain's: mix(fog, lit, e^-(density d))
    for (const [fog, d] of [[{ mode: 2, density: 0.003, range: [0, 0] }, 60], [{ mode: 1, density: 0, range: [0, 2400] }, 150], [{ mode: 3, density: 0.01, range: [0, 0] }, 80]]) {
      const k = fog.mode === 1 ? (2400 - d) / 2400 : fog.mode === 3 ? Math.exp(-((0.01 * d) ** 2)) : Math.exp(-fog.density * d);
      const lit = bladeColour(unfogged, { d, pixel });
      const want = lit.map((c, i) => [0.6, 0.62, 0.66][i] * (1 - k) + c * k);
      assert.ok(near(bladeColour(GAME_GRASS_FS, { d, pixel, fog }), want, 1e-9), `${pixel ? 'pixel' : 'smooth'}, mode ${fog.mode} at ${d} m`);
    }
  }
});

test('DISC19-A: the grass\'s fog is the terrain\'s - its fogFactorAt is TERRAIN_FS\'s text, its five uniforms looked up and set from the frame\'s fog, the world point handed down, and the world host hands the ground\'s fog from the view\'s eye (mutant: the host hands no fog)', () => {
  const terrain = rd('src/render/renderer.js');
  const at = terrain.indexOf('float fogFactorAt(vec3 worldPos) {', terrain.indexOf('const TERRAIN_FS = `'));
  const body = terrain.slice(at, terrain.indexOf('\n}\n', at) + 3);
  assert.equal(FOG_FACTOR_GLSL, body, 'the terrain\'s own function, verbatim');
  assert.ok(GAME_GRASS_VS.includes('out vec3 vWorld;') && GAME_GRASS_VS.includes('  vWorld = p;'), 'the world point handed down');
  assert.equal(GRASSFOG_VS_EDITS.length, 2); assert.equal(GRASSFOG_FS_EDITS.length, 2);
  const blend = GAME_GRASS_FS.indexOf('  c = mix(uFogColor, c, fogFactorAt(vWorld));');
  assert.ok(blend > GAME_GRASS_FS.indexOf('GRASS-PX: the ramp') && blend < GAME_GRASS_FS.indexOf('  o = vec4(c,'), 'after the pixel ramp, right before the colour is written');
  const grass = rd('src/render/labGrass.js');
  for (const n of ['uFogColor', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos']) assert.ok(grass.includes(`'${n}'`), `${n} is looked up`);
  assert.match(grass, /gl\.uniform1i\(u\.uFogMode, fog \? fog\.mode : 0\);/, 'no fog handed, mode 0 - the lab\'s picture');
  assert.match(rd('src/scenes/world.js'), /\{ fog: \{ mode: renderer\._fogMode, density: renderer\._fogDensity, range: renderer\._fogRange, color: renderer\._fogColor, camPos: renderer\._camPos \},/);
});

// ── DISC19-E: "The weapon widget default toggle under diverse weapons should be set to off by default" ──
test('DISC19-E: Diverse Weapons\' Weapon Widget Preset ships off, and a value saved before this reset is let go once - the shipped off applies - while a choice made after it is kept across reloads (mutants: no reset; the reset every load; the stamp never written)', () => {
  const prevLs = globalThis.localStorage;
  const K = 'dfjs-mod-settings', V = 'diverse-weapons', P = 'WeaponWidgetPreset';
  try {
    let store = new Map();
    globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
    assert.equal(MOD_SETTINGS[V].keys[P].default, false, 'the shipped default is off');
    // a file from before the reset: the preset saved on (DW-CLIP shipped it on), the mod's own switch beside it
    _resetModSettings();
    store.set(K, JSON.stringify({ [V]: { [P]: true, Enabled: true }, pcaao: { Enabled: false } }));
    assert.equal(modSetting(V, P), false, 'the saved on is let go: the shipped off applies');
    assert.equal(diverseWeaponsPresetOn(), false, 'and the weapon reads it off');
    assert.equal(modSetting(V, 'Enabled'), true, 'the mod\'s own switch is the player\'s');
    const written = JSON.parse(store.get(K));
    assert.deepEqual(written[V], { Enabled: true }, 'written back without it');
    assert.deepEqual(written.pcaao, { Enabled: false }, 'every other mod untouched');
    // the player turns it on AFTER the reset: stamped, and kept through a reload
    setModSetting(V, P, true);
    const saved = store.get(K);
    _resetModSettings(); store.set(K, saved);   // a reload: the memory dropped (the reset clears the fake's key, so the file is laid back)
    assert.equal(modSetting(V, P), true, 'a choice made after the reset stands');
    assert.equal(diverseWeaponsPresetOn(), true);
    const after = JSON.parse(store.get(K));
    assert.equal(after[V][P], true); assert.equal(after[V][SWITCH_RESETS[0].stamp], true, 'the stamp rides with it');
    // and off again, still the player's
    setModSetting(V, P, false);
    const saved2 = store.get(K);
    _resetModSettings(); store.set(K, saved2);
    assert.equal(modSetting(V, P), false);
    // a file that never mentioned the mod is not grown one
    _resetModSettings();
    store = new Map([[K, JSON.stringify({ pcaao: { Enabled: false } })]]);
    assert.equal(modSetting(V, P), false);
    assert.deepEqual(Object.keys(JSON.parse(store.get(K))), ['pcaao']);
    // the one entry, beside the value migrations
    assert.deepEqual(SWITCH_RESETS.map((r) => `${r.vendor}/${r.key}`), [`${V}/${P}`]);
    assert.equal(KEY_MIGRATIONS.length, 3, 'the value migrations are untouched');
  } finally {
    _resetModSettings();
    if (prevLs === undefined) delete globalThis.localStorage; else globalThis.localStorage = prevLs;
  }
});

// ── DISC19-D: "Lightning can be seen even when its not storming" ──
test('DISC19-D: a storm cell strikes only where it is drawn - wholly outside its front\'s core it strikes nothing, half outside it strikes only inside, unclipped it strikes as ever; and a sunny afternoon in the swamp that 248 strikes lit is dark (mutant: the clip gate dropped)', async () => {
  const { createDistantStorms } = await import('../src/systems/distantStorms.js');
  const { insideClip } = await import('../src/systems/weatherMap.js');
  const CIRCLE = Object.freeze([1, 0, 0, 0, 0, 0, 0]);
  const cell = (clip) => ({ type: 'thunder', id: 'thunder:9:9:9:0', x: 20000, z: 0, r: 5000, reach: 5000, env: 1, bornAt: 300, life: 2000, bands: [[5000, 'thunder']], clip, shape: CIRCLE });
  const run = (s) => {
    const ds = createDistantStorms();
    const out = { strikes: [], sounds: 0, lit: 0 };
    for (let f = 0; f <= 600 * 5; f++) {   // 600 game minutes, a frame a real second
      const r = ds.tick({ systems: [s], at: [0, 0], minutes: 1000 + f / 5, seconds: f });
      out.strikes.push(...r.strikes); out.sounds += r.sounds.length; if (r.bolt) out.lit++;
    }
    return out;
  };
  const free = run(cell(null));
  assert.ok(free.strikes.length > 20 && free.sounds > 0 && free.lit > 0, `an unclipped storm strikes as it always did (${free.strikes.length})`);
  const gone = run(cell([80000, 0, 8000, CIRCLE]));   // its front's core far from it: the cell paints nothing
  assert.deepEqual([gone.strikes.length, gone.sounds, gone.lit], [0, 0, 0], 'a cell that paints nothing strikes nothing - no bolt, no light, no thunder');
  const half = cell([15000, 0, 5000, CIRCLE]);   // the core covers the cell's west half
  const h = run(half);
  assert.ok(h.strikes.length > 0 && h.strikes.length < free.strikes.length, `half its strikes (${h.strikes.length} of ${free.strikes.length})`);
  for (const s of h.strikes) assert.ok(insideClip(half, s.x, s.z), 'every one where the cell is drawn');

  // the report's own afternoon, measured: a swamp everywhere, the player's word sunny, 18 clipped cells in range
  const { systemsNear, weatherAt } = await import('../src/systems/weatherMap.js');
  const { mapGround } = await import('../src/systems/weatherSim.js');
  const { FIELD_RANGE_M } = await import('../src/systems/weatherField.js');
  const { CLIMATES } = await import('../src/formats/mapsFile.js');
  const swamp = () => CLIMATES.Swamp, ground = mapGround(swamp), at = [522000, 618000], m0 = 210181980;
  assert.equal(weatherAt(at[0], at[1], m0, swamp).word, 'sunny');
  const ds = createDistantStorms();
  let strikes = 0, sounds = 0;
  for (let f = 0; f <= 20 * 60; f++) {   // twenty real minutes
    const minutes = m0 + f / 5;
    const r = ds.tick({ systems: systemsNear(at[0], at[1], Math.floor(minutes), swamp, FIELD_RANGE_M + 250), at, minutes, seconds: f, ground });
    strikes += r.strikes.length; sounds += r.sounds.length;
  }
  assert.deepEqual([strikes, sounds], [0, 0], 'no lightning and no thunder under a sunny sky with no storm drawn (248 strikes and 43 claps before)');
});

// ── DISC19-B: "Sometimes when music tracks switch, its very abrupt instead of seamlessly fading in between tracks" ──
/** A MusicService on fake players (SongPlayer's play/stop/playing/song contract, fades logged) and a manual clock. */
async function fadingService() {
  const { MusicService } = await import('../src/systems/music.js');
  const log = [];
  const songs = ['DAY', 'NIGHT', 'RAIN', 'TAVERN'].map((name) => ({ name, events: [1] }));
  const player = (tag) => ({
    playing: false, song: null,
    play(song) { if (this.playing && this.song === song) return true; this.stop(); this.song = song; this.playing = true; log.push(`${tag} play ${song.name}`); return true; },
    stop() { if (this.song) log.push(`${tag} stop`); this.playing = false; this.song = null; },   // a stop that silences something
    fadeTo(level, s) { log.push(`${tag} fade ${level} ${s}`); },
  });
  const svc = new MusicService();
  svc._unsubscribe();
  svc.enabled = true;
  svc.archive = { getSongIndex: (n) => songs.findIndex((s) => s.name === n), getSong: (i) => songs[i] };
  svc.player = player('midi');
  const timers = [];
  svc._later = (fn, ms) => timers.push({ fn, ms, off: false });
  svc._cancelLater = (id) => { timers[id - 1].off = true; };
  const flush = () => { for (const t of timers.splice(0)) if (!t.off) t.fn(); };
  return { svc, log, timers, flush, player };
}

test('DISC19-B: a song that follows another fades the first out, then rises in - the old song is not cut and the new one does not start at full; a first song and a song that ended rise in at once (mutants: the switch without its fade; the start without its rise)', async () => {
  const { MUSIC_FADE_OUT_S, MUSIC_FADE_IN_S } = await import('../src/systems/music.js');
  const { svc, log, timers, flush } = await fadingService();
  assert.equal(svc.playSong('DAY'), true);
  assert.deepEqual(log.splice(0), ['midi play DAY', 'midi fade 0 0', `midi fade 1 ${MUSIC_FADE_IN_S}`], 'the first song rises in, at once');
  assert.equal(timers.length, 0);
  assert.equal(svc.playSong('DAY'), true);
  assert.deepEqual(log.splice(0), [], 'the song already sounding is left alone');
  assert.equal(svc.playSong('NIGHT'), true);
  assert.deepEqual(log.splice(0), [`midi fade 0 ${MUSIC_FADE_OUT_S}`], 'the old song fades - nothing stops, nothing starts');
  assert.equal(timers.length, 1);
  assert.equal(timers[0].ms, MUSIC_FADE_OUT_S * 1000, 'the next starts when the fade has reached nothing');
  assert.ok(svc.playing, 'the fade is still a song playing - the director does not read it as one that ended');
  assert.equal(svc.current, 'NIGHT', 'the service answers for the song it is going to');
  flush();
  assert.deepEqual(log.splice(0), ['midi stop', 'midi play NIGHT', 'midi fade 0 0', `midi fade 1 ${MUSIC_FADE_IN_S}`], 'cut at silence, then the next rises in');
  assert.ok(MUSIC_FADE_OUT_S >= 1 && MUSIC_FADE_OUT_S <= 3 && MUSIC_FADE_IN_S >= 0.5 && MUSIC_FADE_IN_S <= 2, 'a fade, not a pause');
  // a song that ended starts the next straight away, rising
  svc.player.playing = false; svc.player.song = null;   // a song's end: SongPlayer's own stop
  assert.equal(svc.playSong('RAIN'), true);
  assert.deepEqual(log.splice(0), ['midi play RAIN', 'midi fade 0 0', `midi fade 1 ${MUSIC_FADE_IN_S}`]);
  assert.equal(timers.length, 0);
});

test('DISC19-B: during a fade the latest request is the one that plays, the song fading out asked for again turns round without a restart, and a stop starts nothing after it (mutants: the flip-back dropped; the stop leaves the switch armed)', async () => {
  const { MUSIC_FADE_IN_S, MUSIC_FADE_OUT_S } = await import('../src/systems/music.js');
  const { svc, log, timers, flush } = await fadingService();
  svc.playSong('DAY'); log.length = 0;
  svc.playSong('NIGHT'); svc.playSong('RAIN');
  assert.equal(timers.length, 1, 'one fade, however many requests');
  flush();
  assert.deepEqual(log.splice(0), [`midi fade 0 ${MUSIC_FADE_OUT_S}`, 'midi stop', 'midi play RAIN', 'midi fade 0 0', `midi fade 1 ${MUSIC_FADE_IN_S}`], 'the latest request plays, the one between never does');
  // the flip-back: out of the town and straight back in
  svc.playSong('TAVERN');
  svc.playSong('RAIN');
  assert.equal(svc.current, 'RAIN');
  flush();
  assert.deepEqual(log.splice(0), [`midi fade 0 ${MUSIC_FADE_OUT_S}`, `midi fade 1 ${MUSIC_FADE_IN_S}`], 'RAIN turns round where its fade stands - never stopped, never restarted');
  assert.ok(svc.playing && svc.player.song.name === 'RAIN');
  // a stop mid-fade
  svc.playSong('DAY');
  svc.stop();
  flush();
  assert.deepEqual(log.splice(0), [`midi fade 0 ${MUSIC_FADE_OUT_S}`, 'midi stop'], 'stopped, and nothing starts after the stop');
  assert.equal(svc.current, null);
  assert.equal(svc.playing, false);
  // a song that will not start after its fade claims nothing
  svc.playSong('DAY'); log.length = 0;
  const warn = console.warn; console.warn = () => {};
  try { svc.playSong('NO_SUCH_SONG'); flush(); } finally { console.warn = warn; }
  assert.equal(svc.current, null, 'the director asks again rather than waiting on a song that never came');
  assert.equal(svc.playing, false);
});

test('DISC19-B: a music pack\'s track rises in the same way, and a switch fades whichever player sounds (mutant: the pack\'s start without its rise)', async () => {
  const { MUSIC_FADE_IN_S, MUSIC_FADE_OUT_S } = await import('../src/systems/music.js');
  const { setMusicReplacements, clearMusicReplacements } = await import('../src/systems/musicReplacement.js');
  const { setValue } = await import('../src/systems/settings.js');
  const { audio } = await import('../src/systems/audio.js');
  const { svc, log, timers, flush, player } = await fadingService();
  svc._audio = player('pack');
  svc._audio.play = function (buffer) { this.stop(); this.song = buffer; this.playing = true; log.push(`pack play ${buffer.name}`); return true; };
  const prevCtx = audio.ctx;
  setValue('Enhancements', 'AssetInjection', 'True');
  setMusicReplacements(['NIGHT.ogg'], async () => new Uint8Array([1, 2, 3]));
  audio.ctx = { decodeAudioData: async () => ({ name: 'NIGHT.ogg' }) };
  try {
    svc.playSong('DAY'); log.length = 0;
    svc.playSong('NIGHT');
    assert.deepEqual(log.splice(0), [`midi fade 0 ${MUSIC_FADE_OUT_S}`]);
    flush();
    for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));   // the pack's load and decode
    assert.deepEqual(log.splice(0), ['midi stop', 'pack play NIGHT.ogg', 'pack fade 0 0', `pack fade 1 ${MUSIC_FADE_IN_S}`]);
    svc.playSong('DAY');
    assert.deepEqual(log.splice(0), [`pack fade 0 ${MUSIC_FADE_OUT_S}`], 'the pack\'s track is the one faded');
    flush();
    assert.deepEqual(log.splice(0), ['pack stop', 'midi play DAY', 'midi fade 0 0', `midi fade 1 ${MUSIC_FADE_IN_S}`]);
    assert.equal(timers.length, 0);
  } finally {
    audio.ctx = prevCtx;
    clearMusicReplacements();
    setValue('Enhancements', 'AssetInjection', 'False');
  }
});

test('DISC19-B: the fader - the song runs through a gain of its own under the volume, a fade ramps from wherever it stands, and the volume slider and the video mute write the master, never the fader (mutants: the song bypasses the fader; the ramp jumps from its old start)', async () => {
  const { SongPlayer, AudioSongPlayer, rampFader } = await import('../src/systems/songPlayer.js');
  const calls = [];
  const param = (tag) => ({
    value: 0,
    setValueAtTime(v, t) { calls.push([tag, 'set', v, t]); this.value = v; },
    linearRampToValueAtTime(v, t) { calls.push([tag, 'ramp', v, t]); },
    cancelScheduledValues(t) { calls.push([tag, 'cancel', t]); },
    cancelAndHoldAtTime(t) { calls.push([tag, 'hold', t]); },
  });
  let n = 0;
  const ctx = {
    currentTime: 20, destination: { tag: 'out' },
    createGain() { const tag = `g${n++}`; return { tag, gain: param(tag), to: [], connect(x) { this.to.push(x); return x; } }; },
    createBufferSource() { return { to: [], connect(x) { this.to.push(x); return x; }, start() {}, stop() {} }; },
  };
  for (const P of [SongPlayer, AudioSongPlayer]) {
    const p = new P(ctx);
    p._ensureMaster();
    assert.ok(p._fader && p._fader !== p._master, `${P.name}: a fader of its own`);
    assert.deepEqual(p._fader.to, [p._master], `${P.name}: the fader runs into the volume`);
    assert.equal(p._fader.gain.value, 1, 'at full until a fade');
    calls.length = 0;
    p.fadeTo(0, 1.5);
    assert.deepEqual(calls, [[p._fader.tag, 'hold', 20], [p._fader.tag, 'ramp', 0, 21.5]], `${P.name}: held where it stands, ramped from there`);
    calls.length = 0;
    p.resyncGain();
    assert.ok(calls.length > 0 && calls.every((c) => c[0] === p._master.tag), `${P.name}: the volume writes the master alone - a fade under way is not cancelled`);
  }
  const sp = new SongPlayer(ctx); sp._ensureMaster(); sp._state = [];
  assert.deepEqual(sp._channelGain(0).to, [sp._fader], 'every channel of the synth runs through the fader');
  const ap = new AudioSongPlayer(ctx);
  ap.play({ duration: 60 });
  assert.deepEqual(ap._source.to, [ap._fader], 'a pack\'s track runs through the fader');
  // a zero length sets at once; a browser without cancelAndHoldAtTime holds by hand
  const g = { gain: param('z') };
  calls.length = 0;
  rampFader(ctx, g, 0, 0);
  assert.deepEqual(calls, [['z', 'cancel', 20], ['z', 'set', 0, 20]]);
  assert.equal(g.gain.value, 0);
  const old = { gain: { ...param('ff'), value: 0.4 } };
  delete old.gain.cancelAndHoldAtTime;
  calls.length = 0;
  rampFader(ctx, old, 1, 1);
  assert.deepEqual(calls, [['ff', 'cancel', 20], ['ff', 'set', 0.4, 20], ['ff', 'ramp', 1, 21]], 'from where it stood, not from where the last ramp began');
  rampFader(null, g, 1, 1); rampFader(ctx, null, 1, 1);   // no context, no fader: nothing, never a throw
});
