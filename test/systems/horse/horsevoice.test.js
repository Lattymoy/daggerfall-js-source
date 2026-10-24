// HORSE-VOICE (2026-10-24, the owner: "more varied horse sounds"; bible/08-Audio/Audio.md HORSE-VOICE,
// bible/06-Systems/Horse-Care.md): THE HORSE HEARD (systems/horse/horseVoice.js) - the enhanced skin's own, behind the
// port's own sounds (ES1). The clips (tools/horseSfx.mjs: fifteen, DAGGER.SND's format, the hoof loops on the classic
// clops' own lengths and cadence, the tool writing the shipped bytes); the ground's table off the stride's kind and the
// riding loop's clip on it (DFU's clop on hard ground, a cart, a kind not known, a loop not loaded); the voices - the
// mount's whinny, the moods and their weights, no clip twice, the gallop's breath once a stride past its first seconds
// and harder as it runs on, the blown horse's breaths after a long gallop, the spook on foes coming into sight with its
// neigh on its heels and its cooldown, a pause holding all of it, a dismount dropping what is not yet said; the rig -
// the switch off is DFU's neigh and clop exactly, on the hooves follow the ground; the install asked again when the bus
// would not take it; the two hosts and the peers' hooves from their own text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  HORSE_SFX, HORSE_SFX_FILES, hoofSurface, hoofClipFor, horseMood, pickKind, pickOther, createHorseVoice, HORSE_MOODS,
  NEIGH_PITCHES, MOUNT_WHINNY_PITCH, SPOOK_NEIGH_PITCH, SPOOK_NEIGH_LAG_S, SPOOK_COOLDOWN_S, FOE_SAMPLE_S, GALLOP_BREATH_AFTER_S,
  GALLOP_BREATH_S, GALLOP_BREATH_GAIN, GALLOP_EFFORT_S, BREATH_TIRED, RECOVER_SHARE, RECOVER_MAX_S, TIRED_BREATH_S, BLOW_EVERY, VOICE_GAIN,
  ALARM_SNORT_PITCH, installHorseSounds, horseSoundReady, _resetHorseSounds, INSTALL_RETRY_MS,
} from '../../../src/systems/horse/horseVoice.js';
import { CLIPS, HOOF_CADENCE, bakeTo, loudest50 } from '../../../tools/horseSfx.mjs';
import { readWav } from '../../../tools/sndify.mjs';
import { FOOTSTEP_KIND } from '../../../src/systems/footsteps.js';
import { SOUND } from '../../../src/systems/soundClips.js';
import { RIDING_SOUND, RIDING_VOLUME_SCALE } from '../../../src/systems/riding.js';
import { createMountRig } from '../../../src/player/mountRig.js';
import { TRANSPORT_MODES } from '../../../src/systems/transport.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');
const all = () => true;
/** A roll that answers the given values in turn, then the last again. */
const rollsOf = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const ride = { clip: RIDING_SOUND.horseFast, moving: true, ready: all };
/** `n` frames of `dt` through a voice, every shot said with the time it was said at. */
function run(voice, n, dt, ctx) {
  const out = [];
  for (let i = 0; i < n; i++) for (const s of voice.update(dt, typeof ctx === 'function' ? ctx(i) : ctx)) out.push({ ...s, t: voice.now });
  return out;
}

// ── the clips ─────────────────────────────────────────────────────────

test('HORSE-VOICE THE CLIPS: fifteen, each a key on the bus and a horse-*.wav in public/sfx in DAGGER.SND\'s own format (11025 Hz unsigned 8-bit mono); the hoof loops the classic clops\' own lengths (HorseClop 1.508 s, HorseClop2 2.606 s), every fall of their cadence where the classic clip has it; each clip at its loudness target; the tool writes the shipped bytes (mutants: a clip unlisted; a cadence moved; a loop the wrong length)', () => {
  const keys = Object.keys(HORSE_SFX_FILES);
  assert.equal(keys.length, 15);
  assert.deepEqual(keys.map((k) => HORSE_SFX_FILES[k]).sort(), CLIPS.map(([name]) => `${name}.wav`).sort(), 'the tool bakes what the runtime asks for');
  for (const [key, file] of Object.entries(HORSE_SFX_FILES)) {
    assert.equal(file, `${key.replace(':', '-')}.wav`);
    const path = join(ROOT, 'public/sfx', file);
    assert.ok(existsSync(path), file);
    const w = readWav(new Uint8Array(readFileSync(path)));
    assert.equal(w.rate, 11025, file);
    assert.equal(w.data.length, 1, `${file}: mono`);
    assert.equal(readFileSync(path).readUInt16LE(34), 8, `${file}: 8-bit`);
  }
  assert.deepEqual(HOOF_CADENCE.slow.falls.map(([t]) => t), [0.37, 0.65, 1.09, 1.39]);
  assert.deepEqual(HOOF_CADENCE.fast.falls.filter(([, a]) => a > 0.5).map(([t]) => t), [0.03, 0.3, 0.56, 0.82, 1.07, 1.32, 1.59, 1.87, 2.13, 2.38]);
  for (const ground of ['soft', 'snow', 'water']) {
    for (const [gait, len] of [['slow', 1.508], ['fast', 2.606]]) {
      const w = readWav(new Uint8Array(readFileSync(join(ROOT, 'public/sfx', `horse-${ground}-${gait}.wav`))));
      assert.ok(Math.abs(w.data[0].length - len * 11025) <= 1, `${ground}-${gait}: the classic clip's own length`);
      // the loudest 10 ms of each fall stands where the cadence lays it
      const env = (t) => { const i = Math.round(t * 11025), n = 110; let a = 0; for (let j = i; j < i + n && j < w.data[0].length; j++) a += w.data[0][j] ** 2; return Math.sqrt(a / n); };
      const loud = HOOF_CADENCE[gait].falls.filter(([, a]) => a >= 0.45);
      for (const [t] of loud) assert.ok(env(t) > 4 * env(t - 0.12 > 0 ? t - 0.12 : t + 0.13) || env(t) > 0.05, `${ground}-${gait}: a fall at ${t}`);
    }
  }
  for (const [name, , target] of CLIPS) {
    const pcm = new Uint8Array(readFileSync(join(ROOT, 'public/sfx', `${name}.wav`))).subarray(44);
    assert.ok(Math.abs(loudest50(pcm) - target) < 0.6, `${name}: ${loudest50(pcm).toFixed(1)} dBFS against ${target}`);
  }
  for (const name of ['horse-breath-1', 'horse-soft-slow']) {
    const [, make, target] = CLIPS.find(([n]) => n === name);
    assert.deepEqual(bakeTo(make(), target), new Uint8Array(readFileSync(join(ROOT, 'public/sfx', `${name}.wav`))).subarray(44), `${name}: the tool writes the shipped bytes`);
  }
});

// ── the ground ────────────────────────────────────────────────────────

test('HORSE-VOICE THE GROUND: the stride\'s kind is the hooves\' - the open ground soft, snow snow, the water\'s two arms water, and a path, a road, a street, a bridge (Stone), a floor (Wood) and any kind not known DFU\'s own hard ground (mutants: snow heard as grass; the shallows dry; a path softened)', () => {
  const table = Object.fromEntries(Object.entries(FOOTSTEP_KIND).map(([name, k]) => [name, hoofSurface(k)]));
  assert.deepEqual(table, { Outside: 'soft', Snow: 'snow', Wood: 'hard', Stone: 'hard', Submerged: 'water', Shallow: 'water' });
  for (const k of [undefined, null, -1, 6, 99, 'Outside']) assert.equal(hoofSurface(k), 'hard', String(k));
});

test('HORSE-VOICE THE HOOVES\' CLIP: DFU\'s clop on hard ground, the gait\'s loop on the others once loaded - slow for the slow clop, fast for the fast - the cart\'s rattle always, and DFU\'s clop for a loop not loaded (mutants: the gaits crossed; the cart on grass; a loop played unloaded)', () => {
  const { horseSlow: slow, horseFast: fast, cart } = RIDING_SOUND;
  for (const k of [FOOTSTEP_KIND.Stone, FOOTSTEP_KIND.Wood, null]) {
    assert.equal(hoofClipFor(slow, k, all), SOUND.HorseClop);
    assert.equal(hoofClipFor(fast, k, all), SOUND.HorseClop2);
  }
  assert.equal(hoofClipFor(slow, FOOTSTEP_KIND.Outside, all), 'horse:soft-slow');
  assert.equal(hoofClipFor(fast, FOOTSTEP_KIND.Outside, all), 'horse:soft-fast');
  assert.equal(hoofClipFor(slow, FOOTSTEP_KIND.Snow, all), 'horse:snow-slow');
  assert.equal(hoofClipFor(fast, FOOTSTEP_KIND.Snow, all), 'horse:snow-fast');
  assert.equal(hoofClipFor(slow, FOOTSTEP_KIND.Shallow, all), 'horse:water-slow');
  assert.equal(hoofClipFor(fast, FOOTSTEP_KIND.Submerged, all), 'horse:water-fast');
  for (const k of Object.values(FOOTSTEP_KIND)) assert.equal(hoofClipFor(cart, k, all), SOUND.HorseAndCart, 'the cart keeps its own');
  assert.equal(hoofClipFor(fast, FOOTSTEP_KIND.Outside, () => false), SOUND.HorseClop2, 'not loaded: DFU\'s');
  assert.equal(hoofClipFor(fast, FOOTSTEP_KIND.Outside, (k) => k === 'horse:soft-slow'), SOUND.HorseClop2, 'its own gait\'s loop, not another\'s');
});

// ── the voices ────────────────────────────────────────────────────────

test('HORSE-VOICE THE NUMBERS THE RECORD STATES (AUDIT SOUNDSCAPE P6): each pinned to its literal, where the laws\' tests read each back - the whinny at 1.08, the neighs at 0.94, 1, 1.05 and 1.1, the spook\'s high neigh 1.14 on its heels (0.38 s), never again within 30 s, foes asked four times a second, the gallop\'s breath past 8 s, horse care\'s breath short under 0.4, the blown breaths every 2.2 to 3.4 s, a blow one in three (mutants: any of them moved)', () => {
  assert.deepEqual([MOUNT_WHINNY_PITCH, [...NEIGH_PITCHES], SPOOK_NEIGH_PITCH, SPOOK_NEIGH_LAG_S, SPOOK_COOLDOWN_S, FOE_SAMPLE_S], [1.08, [0.94, 1, 1.05, 1.1], 1.14, 0.38, 30, 0.25]);
  assert.deepEqual([GALLOP_BREATH_AFTER_S, GALLOP_BREATH_S, [...GALLOP_BREATH_GAIN], GALLOP_EFFORT_S, BREATH_TIRED, RECOVER_SHARE, RECOVER_MAX_S, [...TIRED_BREATH_S], BLOW_EVERY, ALARM_SNORT_PITCH], [8, 0.52, [0.45, 0.8], 20, 0.4, 0.4, 14, [2.2, 3.4], 3, 1.08]);
  assert.deepEqual({ ...VOICE_GAIN }, { neigh: 1, snort: 0.85, blow: 0.8, spook: 1 });
});

test('HORSE-VOICE THE MOODS: foes in sight the alarm, before blown, before the gallop, before a walk or standing (calm), else riding on; every mood\'s weights a whole; a voice picked by its weights over the kinds loaded, the neigh always there; no clip twice while another is there (mutants: the alarm under the tired; a weight unbalanced; a repeat allowed)', () => {
  assert.equal(horseMood({ alarm: true, tired: true, galloping: true }), 'alarm');
  assert.equal(horseMood({ tired: true, galloping: true }), 'tired');
  assert.equal(horseMood({ galloping: true, slow: true }), 'gallop');
  assert.equal(horseMood({ slow: true }), 'calm');
  assert.equal(horseMood({ moving: false }), 'calm');
  assert.equal(horseMood({}), 'ride');
  for (const [mood, w] of Object.entries(HORSE_MOODS)) assert.ok(Math.abs(Object.values(w).reduce((a, b) => a + b, 0) - 1) < 1e-9, mood);
  assert.deepEqual(HORSE_MOODS.alarm, { neigh: 0.5, snort: 0.5 });
  assert.equal(pickKind('calm', 0), 'snort');
  assert.equal(pickKind('calm', 0.449), 'snort');
  assert.equal(pickKind('calm', 0.451), 'blow');
  assert.equal(pickKind('calm', 0.81), 'neigh');
  assert.equal(pickKind('tired', 0.1, (k) => k !== 'blow'), 'snort', 'a kind not loaded is left out and the weights close over it');
  assert.equal(pickKind('tired', 0.99, () => false), 'neigh', 'the neigh is DFU\'s own: always there');
  for (let i = 0; i < 50; i++) assert.notEqual(pickOther(['a', 'b', 'c'], 'b', i / 50), 'b');
  assert.equal(pickOther(['a'], 'a', 0.7), 'a', 'one alone repeats');
});

test('HORSE-VOICE DFU\'S CLOCK: the first moment after a mount is the whinny (the neigh at MOUNT_WHINNY_PITCH, full); every later one the mood\'s voice - a neigh at one of NEIGH_PITCHES, never the same twice running, a snort or a blow the port\'s; none between the moments (mutants: the whinny never due; the whinny every time; a neigh pitch repeated)', () => {
  const v = createHorseVoice({ rolls: rollsOf(0.1, 0.2, 0.1, 0.2) });
  v.mount(true);
  assert.deepEqual(v.update(0.1, { ...ride, neigh: false }), []);
  assert.deepEqual(v.update(0.1, { ...ride, neigh: true }), [{ clip: SOUND.AnimalHorse, volume: VOICE_GAIN.neigh, pitch: MOUNT_WHINNY_PITCH }]);
  // riding on (fast, not running): roll 0.1 -> the neigh (its weights neigh 0.4, snort 0.4, blow 0.2), its pitch by the next roll
  const a = v.update(0.1, { ...ride, neigh: true });
  assert.equal(a.length, 1);
  assert.equal(a[0].clip, SOUND.AnimalHorse);
  assert.ok(NEIGH_PITCHES.includes(a[0].pitch) && a[0].pitch !== MOUNT_WHINNY_PITCH);
  const b = v.update(0.1, { ...ride, neigh: true });
  assert.equal(b[0].clip, SOUND.AnimalHorse);
  assert.notEqual(b[0].pitch, a[0].pitch, 'never the same pitch twice running');
  const calm = createHorseVoice({ rolls: rollsOf(0, 0, 0) });
  calm.mount(false);
  const s = calm.update(0.1, { ...ride, clip: RIDING_SOUND.horseSlow, neigh: true });
  assert.deepEqual(s, [{ clip: HORSE_SFX.snort[0], volume: VOICE_GAIN.snort, pitch: 1 }], 'not a mount: the calm walk\'s snort, at once');
  const t = calm.update(0.1, { ...ride, clip: RIDING_SOUND.horseSlow, neigh: true });
  assert.notEqual(t[0].clip, s[0].clip, 'never the same snort twice running');
});

test('HORSE-VOICE THE GALLOP\'S BREATH: nothing in a gallop\'s first GALLOP_BREATH_AFTER_S, then an exhale once a stride (GALLOP_BREATH_S, a little uneven), from GALLOP_BREATH_GAIN\'s first level toward its second over GALLOP_EFFORT_S more; at once for a horse galloping short of breath; never off the gallop - a ride not running, the slow clop, standing (mutants: the wait gone; the stride halved; the effort never rising; a ride breathing)', () => {
  assert.equal(GALLOP_BREATH_AFTER_S, 8);
  assert.equal(GALLOP_BREATH_S, 0.52);
  const gallop = { ...ride, running: true };
  const v = createHorseVoice({ rolls: () => 0.5 });
  v.mount(false);
  const early = run(v, Math.round(7.9 * 60), 1 / 60, gallop);
  assert.deepEqual(early, [], 'its first seconds: no breath');
  const later = run(v, 10 * 60, 1 / 60, gallop);
  assert.ok(later.every((s) => HORSE_SFX.breath.includes(s.clip)));
  assert.ok(later.length >= 18 && later.length <= 20, `once a stride: ${later.length} in 10 s`);
  for (let i = 1; i < later.length; i++) assert.ok(Math.abs(later[i].t - later[i - 1].t - GALLOP_BREATH_S) < 0.04);
  for (let i = 1; i < later.length; i++) assert.notEqual(later[i].clip, later[i - 1].clip);
  // AUDIT SOUNDSCAPE H3: a gallop plays the fast clop at DFU's 1.2 - its stride is the clop's, not pitch 1's
  const lifted = createHorseVoice({ rolls: () => 0.5 });
  lifted.mount(false);
  const at12 = run(lifted, 18 * 60, 1 / 60, { ...gallop, pitch: 1.2 }).filter((s) => s.t > GALLOP_BREATH_AFTER_S + 1);
  for (let i = 1; i < at12.length; i++) assert.ok(Math.abs(at12[i].t - at12[i - 1].t - GALLOP_BREATH_S / 1.2) < 0.04, `at 1.2: ${(at12[i].t - at12[i - 1].t).toFixed(3)}`);
  assert.ok(later[0].volume >= GALLOP_BREATH_GAIN[0] && later[0].volume < GALLOP_BREATH_GAIN[0] + 0.02);
  assert.ok(later.at(-1).volume > later[0].volume + 0.1, 'harder as it runs on');
  const long = run(v, (GALLOP_EFFORT_S + 1) * 60, 1 / 60, gallop);
  assert.ok(Math.abs(long.at(-1).volume - GALLOP_BREATH_GAIN[1]) < 1e-9, 'held at its top');
  const short = createHorseVoice({ rolls: () => 0.5 });
  short.mount(false);
  const blown = run(short, 60, 1 / 60, { ...gallop, breath: 0.1 });
  assert.ok(blown.length >= 1 && blown.every((s) => HORSE_SFX.breath.includes(s.clip)), 'short of breath: in the stride at once');
  assert.ok(blown[0].volume > GALLOP_BREATH_GAIN[0] + 0.25, 'the breath that is gone, heard');
  for (const off of [{ ...ride }, { ...gallop, clip: RIDING_SOUND.horseSlow }, { ...gallop, moving: false }]) {
    const w = createHorseVoice({ rolls: () => 0.5 });
    w.mount(false);
    assert.deepEqual(run(w, 30 * 60, 1 / 60, off), [], 'off the gallop, no breath');
  }
});

test('HORSE-VOICE THE BLOWN HORSE: a gallop past GALLOP_BREATH_AFTER_S leaves RECOVER_SHARE of its length (at most RECOVER_MAX_S) of heavy breaths at the walk or standing, every TIRED_BREATH_S, one in BLOW_EVERY a blow; a short gallop none; horse care\'s breath under BREATH_TIRED the same for as long as it is short (mutants: a short gallop blown; the recovery unbounded; no blow among them)', () => {
  const gallop = { ...ride, running: true };
  const v = createHorseVoice({ rolls: () => 0 });
  v.mount(false);
  run(v, 20 * 60, 1 / 60, gallop);
  run(v, 1, 1 / 60, { ...ride, clip: RIDING_SOUND.horseSlow });
  assert.ok(Math.abs(v.recover - Math.min(RECOVER_MAX_S, 20 * RECOVER_SHARE)) < 0.05, `recover ${v.recover}`);
  const after = run(v, 12 * 60, 1 / 60, { ...ride, clip: RIDING_SOUND.horseSlow });
  const n = Math.floor((20 * RECOVER_SHARE) / TIRED_BREATH_S[0]);
  assert.equal(after.length, n, `every ${TIRED_BREATH_S[0]} s for its ${20 * RECOVER_SHARE} s`);
  assert.equal(after.filter((s) => HORSE_SFX.blow.includes(s.clip)).length, Math.floor(n / BLOW_EVERY));
  assert.ok(after.every((s) => HORSE_SFX.breath.includes(s.clip) || HORSE_SFX.blow.includes(s.clip)));
  const long = createHorseVoice({ rolls: () => 0 });
  long.mount(false);
  run(long, 120 * 60, 1 / 60, gallop);
  run(long, 1, 1 / 60, ride);
  assert.ok(long.recover <= RECOVER_MAX_S && long.recover > RECOVER_MAX_S - 0.05, 'at most RECOVER_MAX_S');
  const brief = createHorseVoice({ rolls: () => 0 });
  brief.mount(false);
  run(brief, 5 * 60, 1 / 60, gallop);
  run(brief, 1, 1 / 60, ride);
  assert.equal(brief.recover, 0, 'a short gallop leaves nothing to recover');
  assert.deepEqual(run(brief, 20 * 60, 1 / 60, ride), [], 'and no blowing');
  const care = createHorseVoice({ rolls: () => 0 });
  care.mount(false);
  assert.ok(run(care, 10 * 60, 1 / 60, { ...ride, breath: BREATH_TIRED - 0.01 }).length >= 3, 'short of breath at the walk: blowing');
  const fresh = createHorseVoice({ rolls: () => 0 });
  fresh.mount(false);
  assert.deepEqual(run(fresh, 10 * 60, 1 / 60, { ...ride, breath: BREATH_TIRED }), [], 'its breath back: quiet');
});

test('HORSE-VOICE THE SPOOK: foes coming into sight (asked every FOE_SAMPLE_S) - the alarm snort at once and a neigh at SPOOK_NEIGH_PITCH SPOOK_NEIGH_LAG_S after; foes still there no more; gone and back inside SPOOK_COOLDOWN_S none, past it again; in sight the clock\'s voices are the alarm\'s; a pause holds it all; a dismount drops the neigh not yet said (mutants: no cooldown; the neigh never queued; foes asked every frame; the pause ignored)', () => {
  let near = false, asked = 0;
  const foesNear = () => { asked++; return near; };
  const v = createHorseVoice({ rolls: () => 0 });
  v.mount(false);
  run(v, 60, 1 / 60, { ...ride, foesNear });
  assert.ok(asked >= 1 / FOE_SAMPLE_S && asked <= 1 / FOE_SAMPLE_S + 1, `asked ${asked} times in a second`);
  near = true;
  const spook = run(v, 60, 1 / 60, { ...ride, foesNear });
  assert.equal(spook.length, 2);
  assert.deepEqual({ clip: spook[0].clip, volume: spook[0].volume }, { clip: HORSE_SFX.spook, volume: VOICE_GAIN.spook });
  assert.deepEqual({ clip: spook[1].clip, pitch: spook[1].pitch }, { clip: SOUND.AnimalHorse, pitch: SPOOK_NEIGH_PITCH });
  assert.ok(Math.abs(spook[1].t - spook[0].t - SPOOK_NEIGH_LAG_S) < 0.02);
  assert.deepEqual(run(v, 5 * 60, 1 / 60, { ...ride, foesNear }), [], 'still in sight: no more');
  const alarm = v.update(1 / 60, { ...ride, foesNear, neigh: true });
  assert.deepEqual(alarm, [{ clip: SOUND.AnimalHorse, volume: VOICE_GAIN.neigh, pitch: NEIGH_PITCHES.at(-1) }], 'in sight: the alarm\'s neigh, at the top of its range');
  const snorting = createHorseVoice({ rolls: () => 0.75 });
  snorting.mount(false);
  run(snorting, 2, 1 / 60, { ...ride, foesNear: () => true });
  assert.deepEqual(snorting.update(1 / 60, { ...ride, foesNear: () => true, neigh: true }).filter((s) => s.clip !== SOUND.AnimalHorse), [{ clip: HORSE_SFX.snort[2], volume: VOICE_GAIN.snort, pitch: ALARM_SNORT_PITCH }], 'and its snort, lifted');
  near = false; run(v, 60, 1 / 60, { ...ride, foesNear });
  near = true;
  assert.deepEqual(run(v, 60, 1 / 60, { ...ride, foesNear }), [], 'back inside the cooldown: none');
  near = false; run(v, Math.round(SPOOK_COOLDOWN_S * 60), 1 / 60, { ...ride, foesNear });
  near = true;
  assert.equal(run(v, 60, 1 / 60, { ...ride, foesNear }).filter((s) => s.clip === HORSE_SFX.spook).length, 1, 'past it: again');
  // a pause holds the clock and the foes go unasked
  const p = createHorseVoice({ rolls: () => 0 });
  p.mount(false);
  let pAsked = 0;
  assert.deepEqual(run(p, 120, 1 / 60, { ...ride, paused: true, neigh: true, foesNear: () => (pAsked++, true) }), []);
  assert.equal(p.now, 0);
  assert.equal(pAsked, 0);
  // AUDIT SOUNDSCAPE H4: and a moment of the clock's that fell in it is said on the first frame after - held, not dropped
  assert.equal(p.update(1 / 60, ride).length, 1, 'the held moment, said');
  assert.deepEqual(run(p, 60, 1 / 60, ride), [], 'once');
  // a dismount drops the spook's neigh not yet said
  const d = createHorseVoice({ rolls: () => 0 });
  d.mount(true);
  near = true;
  assert.equal(d.update(1 / 60, { ...ride, foesNear: () => true }).length, 1);
  assert.equal(d.pending, 1);
  d.mount(false);
  assert.deepEqual(run(d, 60, 1 / 60, ride), [], 'the neigh not said');
  // AUDIT SOUNDSCAPE H1: a ride heard on DFU's sounds a while owes nothing when the voices come back - a mount's whinny
  // (the mount was on DFU's), a spook's neigh, a long gallop's blowing
  const h = createHorseVoice({ rolls: () => 0 });
  h.mount(true);
  h.hush();
  assert.notEqual(h.update(1 / 60, { ...ride, neigh: true })[0]?.pitch, MOUNT_WHINNY_PITCH, 'no whinny for a mount long gone');
  h.update(1 / 60, { ...ride, foesNear: () => true });
  assert.equal(h.pending, 1);
  h.hush();
  assert.equal(h.pending, 0, 'the spook\'s neigh let go');
  run(h, 20 * 60, 1 / 60, { ...ride, running: true });
  h.hush();
  assert.equal(h.recover, 0);
  assert.deepEqual(run(h, 10 * 60, 1 / 60, { ...ride, clip: RIDING_SOUND.horseSlow }), [], 'and no blowing for a gallop long gone');
  // the spook asks for its own clip: not loaded, no spook
  const n = createHorseVoice({ rolls: () => 0 });
  n.mount(false);
  assert.deepEqual(n.update(1 / 60, { ...ride, foesNear: () => true, ready: () => false }), []);
});

// ── the rig ───────────────────────────────────────────────────────────

/** A recording bus, a rider and the rig over them. */
function rig({ soundsOn, surfaceKind = () => FOOTSTEP_KIND.Outside, running = true, horseBreath, foesNear, ridingVolumeScale, paused } = {}) {
  const calls = { shots: [], loops: [] };
  const audio = {
    playOneShot: (...a) => { calls.shots.push(a); },
    setLoop: (name, clip, o) => { calls.loops.push([name, clip, o]); },
  };
  const player = {
    grounded: true, transportMode: TRANSPORT_MODES.Foot, standing: false, isRunning: running, movingLessThanHalfSpeed: false, pos: null,
    setTransportMode(m) { this.transportMode = m; },
  };
  const r = createMountRig({
    renderer: {}, canvas: null, fetchBytes: async () => { throw new Error('no ARENA2 here'); }, palette: null,
    audio, player, playerEntity: { items: [] }, showOverlay: () => {}, soundsOn, surfaceKind,
    ...(horseBreath ? { horseBreath } : {}), ...(foesNear ? { foesNear } : {}), ...(ridingVolumeScale ? { ridingVolumeScale } : {}), ...(paused ? { paused } : {}),
  });
  r.setMode(TRANSPORT_MODES.Horse);
  calls.loops.length = 0;
  return { calls, player, frames: (n) => { for (let i = 0; i < n; i++) r.frame(1 / 60); } };
}

test('HORSE-VOICE THE RIG: the switch off is DFU\'s TransportManager exactly - every voice AnimalHorse at RidingVolumeScale, the loop DFU\'s clop whatever the ground; on, with the clips loaded, the hooves on the ground under the rider and the voices DFU\'s scale on top (mutants: the switch ignored; the ground ignored on; the voices louder than DFU\'s scale)', async () => {
  const off = rig({ soundsOn: () => false });
  off.frames(90 * 60);
  assert.ok(off.calls.shots.length >= 2, 'the neigh, on DFU\'s clock');
  for (const s of off.calls.shots) assert.deepEqual(s, [SOUND.AnimalHorse, RIDING_VOLUME_SCALE]);
  assert.ok(off.calls.loops.length > 0 && off.calls.loops.every(([n, c]) => n === 'riding' && c === SOUND.HorseClop2), 'DFU\'s clop on the grass');
  _resetHorseSounds();
  const n = await installHorseSounds({ registerSound: async () => true }, { fetchBytes: async () => new Uint8Array(4) });
  assert.equal(n, 15);
  const on = rig({ soundsOn: () => true });
  on.frames(90 * 60);
  assert.ok(on.calls.loops.length > 0 && on.calls.loops.every(([n, c]) => n === 'riding' && c === 'horse:soft-fast'), 'on: the gallop in the grass');
  assert.ok(on.calls.shots.length >= 2);
  for (const [, v] of on.calls.shots) assert.ok(v <= RIDING_VOLUME_SCALE + 1e-9, 'never over DFU\'s scale');
  assert.ok(on.calls.shots.some(([c]) => typeof c === 'string'), 'the port\'s own voices among them');
  const road = rig({ soundsOn: () => true, surfaceKind: () => FOOTSTEP_KIND.Stone });
  road.frames(60);
  assert.ok(road.calls.loops.every(([, c]) => c === SOUND.HorseClop2), 'on a road: DFU\'s own clop');
  _resetHorseSounds();
});

test('HORSE-VOICE THE INSTALL: the fifteen registered once; a bus that would not take them (no context before the first gesture) is asked again no sooner than INSTALL_RETRY_MS on, each clip\'s bytes fetched once; what stands is ready, what does not is DFU\'s (mutants: never retried; refetched every try)', async () => {
  _resetHorseSounds();
  let take = false, registered = 0, fetched = 0, t = 1000;
  const audio = { registerSound: async () => (take ? (registered++, true) : false) };
  const opts = { fetchBytes: async () => (fetched++, new Uint8Array(4)), now: () => t };
  assert.equal(await installHorseSounds(audio, opts), 0);
  assert.equal(horseSoundReady('horse:soft-fast'), false);
  take = true;
  t += INSTALL_RETRY_MS - 1;
  assert.equal(await installHorseSounds(audio, opts), 0, 'not yet asked again');
  t += 1;
  assert.equal(await installHorseSounds(audio, opts), 15);
  assert.equal(fetched, 15, 'each clip fetched once');
  assert.equal(registered, 15);
  assert.equal(horseSoundReady('horse:soft-fast'), true);
  assert.equal(await installHorseSounds(audio, opts), 15);
  assert.equal(registered, 15, 'all in: never asked again');
  _resetHorseSounds();
});

// ── the hosts ─────────────────────────────────────────────────────────

test('HORSE-VOICE THE HOSTS: the two that ride (world.js, exterior.js) hand the rig the ground (the stride\'s kind), foes in sight and horse care\'s breath; exterior.js takes the kind off the very ctx its stride\'s set is picked from; the rig keeps DFU\'s neigh and clop as its switch-off arm; another player\'s hooves take their pose\'s ground behind the same switch (mutants: a host unwired; the bench\'s kind off another ctx; the peers on DFU\'s clop whatever)', () => {
  const W = src('src/scenes/world.js'), X = src('src/scenes/exterior.js');
  assert.ok(W.includes('surfaceKind: () => _lastFootstepKind, foesNear: () => areEnemiesNearby([...cityGuards.guards, ...exteriorFoes.foes]), horseBreath: () => upkeep.bar(player.transportMode),'));
  assert.ok(X.includes('surfaceKind: () => _townFootstepKind, foesNear: () => areEnemiesNearby([...cityGuards.guards, ...exteriorFoes.foes]), horseBreath: () => upkeep.bar(player.transportMode),'));
  assert.ok(X.includes('}, pickFootstepSet(_fsCtx));\n        _townFootstepKind = pickFootstepKind(_fsCtx);'));
  const R = src('src/player/mountRig.js');
  assert.ok(R.includes("        if (r.neigh) audio.playOneShot(SOUND.AnimalHorse, RIDING_VOLUME_SCALE);"));
  assert.ok(R.includes("        voice.hush();   // AUDIT SOUNDSCAPE H1"), 'the switch-off arm lets the voices\' debts go');
  assert.ok(R.includes("running: player.isRunning, pitch: r.pitch, paused: ridePaused,"), 'the gallop\'s breath on the loop\'s own pitch (H3)');
  assert.ok(R.includes("else audio.setLoop('riding', r.playing ? SOUND[r.clip] : null, { volume: r.volume, pitch: r.pitch });"));
  assert.ok(R.includes("if (voiced) audio.setLoop('riding', r.playing ? hoofClipFor(r.clip, surfaceKind?.()) : null, { volume: r.volume, pitch: r.pitch });"));
  const P = src('src/net/remotePlayers.js');
  assert.ok(P.includes('const clop = out.playing && heard ? SOUND[out.clip] : null;'));
  assert.ok(P.includes('clop != null && voiced ? hoofClipFor(out.clip, peer.shown.fk) : clop'));
  assert.ok(P.includes('const voiced = heard && enhancedSoundsOn();'));
});

test('HORSE-VOICE THE RIG\'S READS (AUDIT SOUNDSCAPE P5): the rig run on the shapes their producers make - horse care\'s `bar` ({ amount, low }) short of breath, blowing at the walk; foes about, the spook; a Travel Options journey (ridingVolumeScale 0), every voice silent; a pause, none said and the clock\'s moment held; the peers\' hooves load the clips themselves (mutants: the breath unread; the foes unread; the journey not silencing; the pause unread; the peers never loading)', async () => {
  _resetHorseSounds();
  assert.equal(await installHorseSounds({ registerSound: async () => true }, { fetchBytes: async () => new Uint8Array(4) }), 15);
  const blown = rig({ soundsOn: () => true, running: false, horseBreath: () => ({ amount: 0.2, low: true }) });
  blown.frames(12 * 60);
  assert.ok(blown.calls.shots.filter(([c]) => HORSE_SFX.breath.includes(c) || HORSE_SFX.blow.includes(c)).length >= 3, 'short of breath at the walk: blowing');
  const fresh = rig({ soundsOn: () => true, running: false, horseBreath: () => ({ amount: 0.9, low: false }) });
  fresh.frames(12 * 60);
  // a calm horse's moments on DFU's clock may say a blow (HORSE_MOODS.calm) - the blown horse's heavy breaths are its own
  assert.equal(fresh.calls.shots.filter(([c]) => HORSE_SFX.breath.includes(c)).length, 0, 'its breath whole: no heavy breaths');
  const spooked = rig({ soundsOn: () => true, foesNear: () => true });
  spooked.frames(60);
  assert.ok(spooked.calls.shots.some(([c]) => c === HORSE_SFX.spook), 'foes about: the spook');
  const journey = rig({ soundsOn: () => true, foesNear: () => true, ridingVolumeScale: () => 0 });
  journey.frames(90 * 60);
  assert.ok(journey.calls.shots.length >= 2, 'the voices still said...');
  assert.ok(journey.calls.shots.every(([, v]) => v === 0), '...and silent through a journey');
  let held = true;
  const still = rig({ soundsOn: () => true, foesNear: () => true, paused: () => held });
  still.frames(90 * 60);
  assert.deepEqual(still.calls.shots, [], 'under a pause: nothing said');
  held = false;
  still.frames(2);
  assert.ok(still.calls.shots.length >= 1, 'the pause over: its held moment said');
  _resetHorseSounds();
  const P = src('src/net/remotePlayers.js');
  assert.ok(P.includes('if (voiced) installHorseSounds(audio);'), 'a peer heard on my sounds loads the clips');
});
