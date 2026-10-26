// HORSE-VOL, ANIMAL-VOL, SOUND-LIVE (2026-10-23): the Audio tab's Horse Volume and Animal Volume
// (systems/animalVolume.js) on every horse and animal the game plays, and the Sound Volume slider heard by the sounds
// already playing (systems/audio.js _relevel). Design: bible/08-Audio/Audio.md, "HORSE-VOL, ANIMAL-VOL, SOUND-LIVE".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { horseVolume, animalVolume } from '../../src/systems/animalVolume.js';
import { createAnimalAmbience } from '../../src/systems/animalAmbience.js';
import { CLASSIC_UPDATE_INTERVAL } from '../../src/characters/weaponStates.js';
import { createMountRig } from '../../src/player/mountRig.js';
import { installHorseSounds, _resetHorseSounds } from '../../src/systems/horse/horseVoice.js';
import { FOOTSTEP_KIND } from '../../src/systems/footsteps.js';
import { RemotePlayers } from '../../src/net/remotePlayers.js';
import { AudioEngine } from '../../src/systems/audio.js';
import { RIDING_VOLUME_SCALE } from '../../src/systems/riding.js';
import { SOUND } from '../../src/systems/soundClips.js';
import { TRANSPORT_MODES } from '../../src/systems/transport.js';
import { PREF_DEFAULTS, setPref, _resetForTests as resetPrefs } from '../../src/systems/uiPrefs.js';
import { setValue, _resetForTests as resetSettings } from '../../src/systems/settings/settings.js';
import { portPool } from '../../src/ui/enhanced/enhancedMenu.js';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);

/** Run `fn` with Horse Volume and Animal Volume set, the shelf as it was after. */
function withVolumes(horse, animal, fn) {
  resetPrefs();
  try { setPref('horseVolume', horse); setPref('animalVolume', animal); return fn(); } finally { resetPrefs(); }
}

/** The real engine over a context that plays nothing, every call it is asked to make recorded. */
function recordingEngine() {
  const param = () => ({ value: 0 });
  const e = new AudioEngine();
  e.ctx = {
    state: 'running', destination: { connect(n) { return n; } },
    listener: { positionX: param(), positionY: param(), positionZ: param(), forwardX: param(), forwardY: param(), forwardZ: param(), upX: param(), upY: param(), upZ: param() },
    createGain: () => ({ gain: param(), connect(n) { return n; }, disconnect() {} }),
    createPanner: () => ({ positionX: param(), positionY: param(), positionZ: param(), connect(n) { return n; }, disconnect() {} }),
    createBufferSource: () => ({ buffer: null, playbackRate: param(), loop: false, connect(n) { return n; }, start() {}, stop() {}, disconnect() {} }),
  };
  e.enabled = true;
  e._ensureCtx = () => {};
  for (const k of [SOUND.HorseClop2, SOUND.HorseClop, SOUND.HorseAndCart, SOUND.AnimalHorse]) e.buffers.set(k, { duration: 0.5 });
  const calls = [];
  for (const m of ['playOneShot', 'play3d', 'setLoop', 'setLoop3d']) {
    const real = e[m].bind(e);
    e[m] = (...args) => { calls.push([m, ...args]); return real(...args); };
  }
  return { e, calls };
}

test('HORSE-VOL, ANIMAL-VOL: each row reads its own pref, 1 by default, clamped to 0..1, and 0 is a value - a muted row, not an unset one (mutants: the clamp dropped; 0 read as unset)', () => {
  resetPrefs();
  try {
    assert.equal(PREF_DEFAULTS.horseVolume, 1);
    assert.equal(PREF_DEFAULTS.animalVolume, 1);
    assert.deepEqual([horseVolume(), animalVolume()], [1, 1], 'the shelf as shipped: DFU\'s levels');
    setPref('horseVolume', 0.35); setPref('animalVolume', 0.6);
    assert.deepEqual([horseVolume(), animalVolume()], [0.35, 0.6], 'each its own key');
    setPref('horseVolume', 0);
    assert.equal(horseVolume(), 0, 'muted is muted');
    setPref('horseVolume', 4); setPref('animalVolume', -1);
    assert.deepEqual([horseVolume(), animalVolume()], [1, 0], 'clamped');
    setPref('horseVolume', 'loud');
    assert.equal(horseVolume(), 1, 'a value that is no number reads the default');
  } finally { resetPrefs(); }
});

test('HORSE-VOL, ANIMAL-VOL: a town\'s horse flat neighs at Horse Volume and every other animal flat calls at Animal Volume (mutants: the two swapped; a horse on Animal Volume; the volume back to 1)', () => {
  withVolumes(0.25, 0.5, () => {
    const played = [];
    const sources = [SOUND.AnimalHorse, SOUND.AnimalDog, SOUND.AnimalCat, SOUND.AnimalPig, SOUND.AnimalCow].map((sound) => ({ pos: [0, 0, 0], sound }));
    const amb = createAnimalAmbience({ play3d: (clip, pos, volume) => played.push([clip, volume]) }, () => sources, () => 0);
    amb.update(CLASSIC_UPDATE_INTERVAL, [1, 0, 0]);
    assert.deepEqual(played, [[SOUND.AnimalHorse, 0.25], [SOUND.AnimalDog, 0.5], [SOUND.AnimalCat, 0.5], [SOUND.AnimalPig, 0.5], [SOUND.AnimalCow, 0.5]]);
  });
});

/** A rider on my own mount over a recording bus (horsevoice.test.js's rig), `soundsOn` the port's own sounds' switch: a gallop
 *  in the grass. */
function mounted(soundsOn) {
  const calls = { shots: [], loops: [] };
  const audio = { playOneShot: (...a) => { calls.shots.push(a); }, setLoop: (name, clip, o) => { if (clip != null) calls.loops.push([name, clip, o]); } };
  const player = {
    grounded: true, transportMode: TRANSPORT_MODES.Foot, standing: false, isRunning: true, movingLessThanHalfSpeed: false, pos: null,
    setTransportMode(m) { this.transportMode = m; },
  };
  const rig = createMountRig({
    renderer: {}, canvas: null, fetchBytes: async () => { throw new Error('no ARENA2 here'); }, palette: null,
    audio, player, playerEntity: { items: [] }, showOverlay: () => {}, soundsOn, surfaceKind: () => FOOTSTEP_KIND.Outside,
  });
  rig.setMode(TRANSPORT_MODES.Horse);
  return { calls, rig };
}

test('HORSE-VOL: my own mount, DFU\'s sounds - the neigh and the riding loop both at Horse Volume, and at 0 a ride is silent (mutants: the neigh or the loop left at full)', () => {
  withVolumes(0.5, 1, () => {
    const { calls, rig } = mounted(() => false);
    rig.frame(5);   // past the mount's 1-4 s neigh
    assert.deepEqual(calls.shots.map((s) => s[0]), [SOUND.AnimalHorse], 'the mount\'s neigh');
    near(calls.shots[0][1], RIDING_VOLUME_SCALE * 0.5, 'the neigh at Horse Volume');
    const loop = calls.loops.at(-1);
    assert.equal(loop[1], SOUND.HorseClop2, 'the fast clop');
    near(loop[2].volume, RIDING_VOLUME_SCALE * 0.5, 'the hooves at Horse Volume');
    setPref('horseVolume', 0);
    rig.frame(1 / 60);
    assert.equal(calls.loops.at(-1)[2].volume, 0, 'muted: the hooves silent');
  });
});

test('HORSE-VOL: my own mount, the port\'s own sounds (HORSE-VOICE) - every voice (the mount\'s whinny, the snorts, the breath, a spook) and the hooves on the ground at Horse Volume: at 0 nothing a horse says is heard (mutants: the voices or the voiced hooves left at full)', async () => {
  _resetHorseSounds();
  assert.equal(await installHorseSounds({ registerSound: async () => true }, { fetchBytes: async () => new Uint8Array(4) }) > 0, true, 'the clips in');
  try {
    for (const [horse, top] of [[0, 0], [0.5, RIDING_VOLUME_SCALE * 0.5]]) {
      withVolumes(horse, 1, () => {
        const { calls, rig } = mounted(() => true);
        for (let i = 0; i < 90 * 60; i++) rig.frame(1 / 60);
        assert.ok(calls.shots.length >= 2, `Horse Volume ${horse}: the voices said`);
        assert.ok(calls.shots.some(([c]) => typeof c === 'string'), 'the port\'s own voices among them');
        for (const [c, v] of calls.shots) assert.ok(v <= top + 1e-9, `Horse Volume ${horse}: ${String(c)} at ${v}`);
        if (horse) assert.ok(calls.shots.some(([, v]) => v > 0), 'and heard when the row is up');
        assert.ok(calls.loops.length > 0 && calls.loops.every(([, c]) => c === 'horse:soft-fast'), 'the hooves in the grass');
        for (const [, , o] of calls.loops) near(o.volume, (o.volume > 0 ? top : 0), `Horse Volume ${horse}: the hooves`);
        if (horse) assert.ok(calls.loops.some(([, , o]) => o.volume > 0));
      });
    }
  } finally { _resetHorseSounds(); }
});

test('HORSE-VOL: a peer\'s mount - their hooves and their neigh at my Horse Volume, as my own are (mutants: either left at full)', () => {
  withVolumes(0.4, 1, () => {
    const { e, calls } = recordingEngine();
    const rp = new RemotePlayers({ renderer: {}, deps: { fetchBytes: async () => null, palette: null, audio: e }, compose: async () => null });
    const rider = { id: 'bob-0001', name: 'bob', shown: { x: 1, y: 0, z: 4, yaw: 0, pitch: 0, mv: 1, wd: 0, an: 0, fk: 0, rd: 1, rv: 0 }, look: null };
    rp.sync([rider], (p) => [p.x, p.y, p.z], { bodyHeight: () => 2, eye: [0, 1.7, 0], dt: 40 });   // past the 2-39 s neigh
    const loop = calls.find((c) => c[0] === 'setLoop3d' && c[2] != null);
    assert.equal(loop[2], SOUND.HorseClop2);
    near(loop[4].volume, RIDING_VOLUME_SCALE * 0.4, 'the hooves at Horse Volume');
    const neigh = calls.find((c) => c[0] === 'play3d' && c[1] === SOUND.AnimalHorse);
    assert.ok(neigh, 'the neigh');
    near(neigh[3], RIDING_VOLUME_SCALE * 0.4, 'the neigh at Horse Volume');
  });
});

test('HORSE-VOL: the Wagon Warden\'s heave is the lifted team\'s neigh, on Horse Volume; its throw and its landing are not a horse\'s (mutant: the heave at full)', () => {
  const src = rd('src/scenes/world.js');
  assert.match(src, /const WARDEN_CLIPS = \{ heave: SOUND\.AnimalHorse,/);
  assert.match(src, /audio\.playOneShot\(WARDEN_CLIPS\[what\], 0\.7 \* \(1 - d \/ 120\) \* \(what === 'heave' \? horseVolume\(\) : 1\)\)/);
});

test('HORSE-VOL, ANIMAL-VOL: the Audio tab\'s Volume section draws both rows after Monster Volume, each a step of 5% (20% with Shift) on its own pref (mutants: a row dropped; a row writing another\'s key)', () => {
  // org2_options.test.js's document: just enough for the port's row builders
  const doc = () => {
    const make = (tag) => {
      const n = {
        tag, children: [], className: '', textContent: '', title: '', type: '', disabled: false, style: {}, dataset: {}, attrs: {},
        append(...cs) { for (const c of cs) n.children.push(c); }, prepend(...cs) { n.children.unshift(...cs); },
        setAttribute(k, v) { n.attrs[k] = v; }, addEventListener() {}, querySelectorAll: () => [],
        classList: {
          add: (c) => { n.className = `${n.className} ${c}`.trim(); },
          toggle: (c, on) => { const has = n.className.split(/\s+/).includes(c); if (on ?? !has) { if (!has) n.classList.add(c); } else n.className = n.className.split(/\s+/).filter((x) => x !== c).join(' '); },
          contains: (c) => n.className.split(/\s+/).includes(c),
        },
      };
      return n;
    };
    return { createElement: make, createTextNode: (t) => ({ textContent: t }), querySelectorAll: () => [], getElementById: () => null };
  };
  globalThis.document = doc();
  globalThis.window = { location: { search: '?touch=1' }, navigator: { maxTouchPoints: 5 }, ontouchstart: null, matchMedia: () => ({ matches: true }) };
  resetPrefs();
  try {
    const pool = portPool();
    for (const [key, name] of [['monsterVolume', 'Monster Volume'], ['horseVolume', 'Horse Volume'], ['animalVolume', 'Animal Volume']]) {
      const row = pool.get(key);
      assert.ok(row, `${key}: drawn`);
      assert.equal(row.dataset.pref, key);
      const main = row.children[0], ctl = row.children[1];
      assert.equal(main.children[0].textContent, name);
      assert.ok(main.title.length > 0, `${key}: its note`);
      const [val, less, more] = ctl.children;
      assert.equal(val.textContent, '100%');
      less.onclick({ shiftKey: false });
      less.onclick({ shiftKey: true });
      assert.equal(val.textContent, '75%');
      more.onclick({ shiftKey: false });
      assert.equal(val.textContent, '80%');
    }
    assert.deepEqual([horseVolume(), animalVolume()], [0.8, 0.8], 'each row wrote its own pref');
  } finally { resetPrefs(); delete globalThis.document; delete globalThis.window; }
  assert.match(rd('src/ui/settings/settingsMap.js'), /"port:monsterVolume", "port:companionVolume", "port:horseVolume", "port:animalVolume"\]/);
});

test('SOUND-LIVE: writing Sound Volume re-levels the master at once over 50 ms, so a loop already playing hears the slider; a context with no automation takes the value outright (mutants: the setting unwatched; another key heard; no ramp)', () => {
  resetSettings();
  try {
    const events = [];
    const ctx = { state: 'running', currentTime: 3, sampleRate: 48000, resume() {} };
    const node = (extra) => ({ context: ctx, connect(x) { return x; }, disconnect() {}, ...extra });
    ctx.destination = node({});
    const autoParam = () => ({ value: 1, cancelScheduledValues: (t) => events.push(['cancel', t]), setValueAtTime: (v, t) => events.push(['set', v, t]), linearRampToValueAtTime: (v, t) => events.push(['ramp', v, t]) });
    ctx.createGain = () => node({ gain: autoParam() });
    const a = new AudioEngine();
    a.ctx = ctx; a._ensureCtx = () => {};
    a._out();
    events.length = 0;
    setValue('Controls', 'MusicVolume', 0.3);
    assert.deepEqual(events, [], 'the music\'s slider is the music\'s');
    setValue('Controls', 'SoundVolume', 0.2);
    assert.equal(events.length, 3, 'one re-level');
    assert.deepEqual(events[0], ['cancel', 3]);
    assert.equal(events[1][0], 'set');
    assert.equal(events[2][0], 'ramp');
    near(events[2][1], 0.2, 'to the new level');
    near(events[2][2], 3.05, 'over 50 ms');
    // an old context: no automation on its params
    const plain = { state: 'running', currentTime: 0, sampleRate: 48000, resume() {} };
    plain.destination = { context: plain, connect(x) { return x; }, disconnect() {} };
    plain.createGain = () => ({ context: plain, gain: { value: 1 }, connect(x) { return x; }, disconnect() {} });
    const b = new AudioEngine();
    b.ctx = plain; b._ensureCtx = () => {};
    const master = b._out();
    setValue('Controls', 'SoundVolume', 0.65);
    near(master.gain.value, 0.65, 'set outright');
  } finally { resetSettings(); }
});
