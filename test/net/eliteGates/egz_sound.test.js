// EG-ZH (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 11.9 and 26): THE
// HALL'S SOUND. THE HALL'S REVERB (systems/eliteGates/egReverb.js): each hall heard in its fragments' space - every fragment kit's
// preset the engine's own, the hall's own open ground Quarry, a fragment's footprint its z-span and its reach across, a
// mouth crossed with 1 m of hysteresis; the engine's held zone (systems/audio.js holdReverb, reverbZone, reverbFade,
// releaseReverb) - Better Ambience's zone taken off and refused while it is held, two convolvers made once a hall, each
// preset's impulse made once for the hold, the 0.4 s crossfade, another's release refused, everything freed on the release;
// Better Ambience yielding and asserting its wish again after; the breach client holding it while I stand in the breach,
// building my feet's hall as it changes, turning at a mouth, letting go on every way out. THE SPIRE MIX's last two
// (systems/eliteGates/egMix.js, net/peer/peerFx.js, scenes/eliteGates/egFight.js): every peer's sound 4 dB down through the engine's scope while a
// hall's fight runs - the peers' blows, steps, swings, cries and climbs - and Watchfire's tell at pitch 1.4, once a told blow,
// where it will land.
import '../../modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  EG_REVERB_PRESETS, EG_REVERB_OPEN, EG_REVERB_FADE_S, EG_REVERB_HYST_M, EG_REVERB_OWNER, egReverbPreset, egHallReverb, egReverbZoneAt, createEgReverb,
} from '../../../src/systems/eliteGates/egReverb.js';
import { REVERB_PRESET } from '../../../src/systems/reverbPresets.js';
import { EG_FRAGS } from '../../../src/net/eliteGates/egFragLaw.js';
import { egHallOf, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { AudioEngine } from '../../../src/systems/audio.js';
import { createBetterAmbience, readBetterAmbienceSettings, BETTER_AMBIENCE_VENDOR } from '../../../src/systems/betterAmbience.js';
import { MOD_SETTINGS } from '../../../src/systems/modSettings.js';
import { createSpireMix, EG_MIX, EG_TELL_CUE, egDbGain } from '../../../src/systems/eliteGates/egMix.js';
import { peerHeard, setPeerSoundScope, createPeerFxPlayer } from '../../../src/net/peer/peerFx.js';
import { BOSS_CUES } from '../../../src/world/gate/gateBoss.js';
import { createEgFight, egToldAt } from '../../../src/scenes/eliteGates/egFight.js';
import { EG_FIGHT_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { egHallCentre } from '../../../src/world/eliteGates/egHall.js';
import { createEgClient } from '../../../src/scenes/eliteGates/egClient.js';
import { egBreachNew, egEnter, egStateOf } from '../../../src/net/eliteGates/egBrain.js';
import { validEgOut } from '../../../src/net/wire.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { egGive8 } from '../../egGive8.mjs';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins were written on spec law 8's ground (its courses along +z
// from the plate, its courts and its lords where law 8 lays them) and stand on it still - the halls they read are law 8's,
// given as a breach of law 8's are given to a client (test/egGive8.mjs); LAW 9's own ground is test/net/eliteGates/law9_height.test.js's and
// test/net/eliteGates/law9_rooms.test.js's. Given before every test (a client that leaves its breach forgets them)
beforeEach(() => {
  egGive8(77, [1, 2]);
  egGive8(2, [1]);
  egGive8(1, [1]);
});

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

// ── a Web Audio graph that records ─────────────────────────────────────────────────────────────────────────────────
function fakeCtx() {
  const log = { buffers: 0, convolvers: [], gains: [], sources: [] };
  let ctx = null;
  const node = (kind) => {
    const n = { kind, context: ctx, outs: [], dropped: 0, connect(to) { n.outs.push(to); return to; }, disconnect(to) { if (to) n.outs = n.outs.filter((o) => o !== to); else n.outs = []; n.dropped++; } };
    return n;
  };
  const param = (v) => { const p = { value: v, ramps: [], cancelScheduledValues() { p.ramps.length = 0; }, setValueAtTime(x) { p.value = x; }, linearRampToValueAtTime(x, at) { p.ramps.push([x, at]); p.value = x; } }; return p; };
  ctx = {
    state: 'running', currentTime: 10, sampleRate: 4000, destination: null,
    createGain() { const g = node('gain'); g.gain = param(1); log.gains.push(g); return g; },
    createConvolver() { const c = node('convolver'); c.buffer = null; log.convolvers.push(c); return c; },
    createBuffer(ch, len, rate) { if (ch === 2) log.buffers++; const data = Array.from({ length: ch }, () => new Float32Array(len)); return { numberOfChannels: ch, length: len, duration: len / rate, getChannelData: (i) => data[i] }; },
    createBufferSource() { const s = node('source'); s.buffer = null; s.playbackRate = { value: 1 }; s.start = () => {}; log.sources.push(s); return s; },
    createPanner() { const p = node('panner'); for (const k of ['positionX', 'positionY', 'positionZ', 'orientationX', 'orientationY', 'orientationZ']) p[k] = { value: 0 }; return p; },
  };
  ctx.destination = node('destination');
  return { ctx, log };
}
function engine() {
  const { ctx, log } = fakeCtx();
  const a = new AudioEngine();
  a.ctx = ctx; a.enabled = true;
  a._out();   // the bus stands first, so the last gain made is the shot's own
  return { a, ctx, log };
}
/** A hall of seed 77 with a fragment: hall 2, a span through the Fallen Stacks (Stoneroom). */
const STACKS = () => egHallOf(77, 2, 0);

test('EG-ZH THE HALL\'S REVERB, ITS LAW (section 11.9): every fragment kit\'s preset the engine\'s own (Cave in the caverns, Stoneroom in the Stacks and the Ossuary, Quarry in the open); a hall with no fragment its open ground\'s Quarry; a fragment\'s footprint its z-span and its cave\'s half width across (a chamber half its span); the likeliest second preset made beside the base; a mouth entered at its edge and left only 1 m past it (mutants: a kit\'s preset unmapped; the open ground not Quarry; the hysteresis on the way in; none on the way out; the reach across ignored)', () => {
  assert.deepEqual({ ...EG_REVERB_PRESETS }, { cave: 'Cave', stoneroom: 'Stoneroom', quarry: 'Quarry' });
  for (const name of Object.values(EG_REVERB_PRESETS)) assert.ok(REVERB_PRESET[name], `${name} is the engine's`);
  for (const [kit, F] of Object.entries(EG_FRAGS)) assert.ok(egReverbPreset(F.reverb), `${kit}'s ${F.reverb}`);
  assert.equal(egReverbPreset('cave'), 'Cave'); assert.equal(egReverbPreset('STONEROOM'), 'Stoneroom'); assert.equal(egReverbPreset('hall'), null); assert.equal(egReverbPreset(null), null);
  assert.equal(EG_REVERB_OPEN, 'Quarry'); assert.equal(EG_REVERB_FADE_S, 0.4); assert.equal(EG_REVERB_HYST_M, 1);
  // a hall of open ground
  const plain = egHallOf(77, 1, 0);
  assert.equal(plain.frags.length, 0);
  assert.deepEqual(egHallReverb(plain), { base: 'Quarry', zones: [], second: null });
  // the Stacks
  const spec = STACKS(), f = spec.frags[0], cave = spec.caves[0];
  const plan = egHallReverb(spec);
  assert.equal(plan.base, 'Quarry');
  assert.deepEqual(plan.zones, [{ x: f.x, half: cave.halfW, z0: f.z0, z1: f.z1, preset: 'Stoneroom' }]);
  assert.equal(plan.second, 'Stoneroom', 'the zone it will turn to, made at the swap');
  assert.equal(egHallReverb(egHallOf(2, 2, 0)).second, null, 'the Colonnade is open: Quarry is the base\'s own');
  const chamber = egHallOf(77, 6, 0), cz = egHallReverb(chamber).zones[0], cf = chamber.frags[0];
  assert.deepEqual([cz.preset, cz.half], ['Cave', (cf.z1 - cf.z0) / 2], 'a chamber: half its span across');
  // the mouth
  const Z = plan.zones, mid = (f.z0 + f.z1) / 2;
  assert.equal(egReverbZoneAt(Z, f.x, f.z0 - 5), -1, 'short of the mouth: the hall\'s own');
  assert.equal(egReverbZoneAt(Z, f.x, f.z0 + 0.01), 0, 'inside its edge');
  assert.equal(egReverbZoneAt(Z, f.x, f.z0 - 0.5, -1), -1, 'the hysteresis never pulls a body in');
  assert.equal(egReverbZoneAt(Z, f.x, f.z0 - 0.5, 0), 0, 'and keeps one in until a metre past');
  assert.equal(egReverbZoneAt(Z, f.x, f.z0 - 1.01, 0), -1, '...then lets it go');
  assert.equal(egReverbZoneAt(Z, f.x, f.z1 + 0.9, 0), 0, 'the far mouth the same');
  assert.equal(egReverbZoneAt(Z, f.x + cave.halfW + 0.5, mid, -1), -1, 'beside the walls is not inside them');
  assert.equal(egReverbZoneAt(Z, f.x + cave.halfW + 0.5, mid, 0), 0, 'within a metre of them, kept');
  assert.equal(egReverbZoneAt(Z, f.x + cave.halfW + 1.5, mid, 0), -1);
});

test('EG-ZH THE HELD ZONE (systems/audio.js): holding takes Better Ambience\'s zone off the send and refuses setReverb until the release; the zone\'s two convolvers made on each preset\'s impulse, once each for the hold, the live one heard and the idle silent; the crossfade ramps both over 0.4 s, a preset neither holds taking the idle slot on its cached impulse; another\'s release refused; the release frees both convolvers and every impulse, and setReverb rules again (mutants: setReverb heard under a hold; an impulse synthesised again; the fade cut; a release by anyone)', () => {
  const { a, log } = engine();
  assert.equal(a.setReverb('Stoneroom'), true, 'Better Ambience\'s zone');
  const ba = log.convolvers[0];
  assert.equal(a.reverbHeld(), null);
  assert.equal(a.holdReverb(null), false, 'no owner, no hold');
  assert.equal(a.holdReverb(EG_REVERB_OWNER), true);
  assert.equal(a.reverbHeld(), EG_REVERB_OWNER);
  assert.equal(a.reverbPreset, null, 'its zone off the bus');
  assert.equal(a._reverbIn.outs.includes(ba), false, '...off the send');
  assert.equal(a.setReverb('Cave'), false, 'refused while held');
  assert.equal(log.convolvers.length, 1);
  const built = log.buffers;
  assert.equal(a.reverbZone('Quarry', 'Stoneroom'), true);
  assert.equal(log.buffers - built, 2, 'two impulses');
  let z = a.reverbZoneState();
  assert.deepEqual(z, { presets: ['Quarry', 'Stoneroom'], live: 0 });
  const [q, s] = a._zone.slots;
  assert.equal(q.wet.gain.value, 1); assert.equal(s.wet.gain.value, 0);
  assert.ok(a._reverbIn.outs.includes(q.conv) && a._reverbIn.outs.includes(s.conv), 'both off the send');
  assert.ok(q.wet.outs.includes(a._listenerIn), 'into the listener, as every bus');
  // the crossfade
  assert.equal(a.reverbFade('Quarry'), false, 'already heard');
  assert.equal(a.reverbFade('Stoneroom', EG_REVERB_FADE_S), true);
  assert.deepEqual(s.wet.gain.ramps, [[1, 10.4]], 'the idle rises over 0.4 s');
  assert.deepEqual(q.wet.gain.ramps, [[0, 10.4]], 'the live falls');
  assert.deepEqual(a.reverbZoneState(), { presets: ['Quarry', 'Stoneroom'], live: 1 });
  assert.equal(a.reverbFade('Quarry', 0.4), true, 'and back');
  assert.equal(log.buffers - built, 2, 'nothing synthesised to turn');
  assert.equal(a.reverbFade('Cave', 0.4), true, 'a third preset takes the idle slot');
  assert.equal(log.buffers - built, 3, 'its impulse made once');
  z = a.reverbZoneState();
  assert.deepEqual(z, { presets: ['Quarry', 'Cave'], live: 1 });
  assert.ok(!a._reverbIn.outs.includes(s.conv), 'the slot it took freed');
  a.reverbFade('Quarry', 0.4); a.reverbFade('Cave', 0.4);
  assert.equal(log.buffers - built, 3, 'Cave cached for the hold');
  assert.equal(a.reverbFade('Stoneroom', 0.4), true, 'Stoneroom again, into the idle slot');
  assert.equal(log.buffers - built, 3, '...on its impulse made at the swap, never synthesised again');
  // a new hall: a slot already holding its preset kept, nothing made again
  const caveConv = a._zone.slots.find((x) => x.preset === 'Cave').conv, nConv = log.convolvers.length;
  assert.equal(a.reverbZone('Cave', 'Quarry'), true);
  assert.equal(a._zone.slots[0].conv, caveConv, 'the Cave slot kept as it stood');
  assert.equal(log.convolvers.length, nConv + 1, 'only the Quarry it lacked made (on its cached impulse)');
  assert.equal(log.buffers - built, 3);
  assert.deepEqual(a.reverbZoneState(), { presets: ['Cave', 'Quarry'], live: 0 });
  assert.equal(a._zone.slots[0].wet.gain.value, 1, 'kept, heard whole at once');
  // the release
  assert.equal(a.releaseReverb('someone'), false, 'another\'s word lets nothing go');
  assert.equal(a.reverbHeld(), EG_REVERB_OWNER);
  const live = a._zone.slots.map((x) => x.conv);
  assert.equal(a.releaseReverb(EG_REVERB_OWNER), true);
  assert.equal(a.reverbHeld(), null); assert.equal(a.reverbZoneState(), null); assert.equal(a._reverbBuffers, null, 'every impulse freed');
  for (const c of live) assert.ok(!a._reverbIn.outs.includes(c) && c.dropped > 0, 'each convolver off the send');
  assert.equal(a.reverbZone('Cave'), false, 'no zone without a hold');
  assert.equal(a.setReverb('Cave'), true, 'Better Ambience rules again');
});

test('EG-ZH THE SCOPE (systems/audio.js scaled): every one-shot made inside it plays at its gain times its own volume - flat and positional - nested scopes multiply, and the gain comes back out of it, a throw included (mutants: the scope unread; never restored)', () => {
  const { a, log } = engine();
  a.registerSamples('k', new Float32Array(8), 8000);
  const vol = () => log.gains.at(-1).gain.value;
  a.playOneShot('k', 0.8); assert.equal(vol(), 0.8);
  a.scaled(0.5, () => a.playOneShot('k', 0.8)); assert.equal(vol(), 0.4);
  a.scaled(0.5, () => a.play3d('k', [1, 2, 3], 1)); assert.equal(vol(), 0.5);
  a.scaled(0.5, () => a.scaled(0.5, () => a.playOneShot('k', 1))); assert.equal(vol(), 0.25, 'nested');
  assert.throws(() => a.scaled(0.1, () => { throw new Error('x'); }));
  a.playOneShot('k', 1); assert.equal(vol(), 1, 'restored, even past a throw');
  assert.equal(a.scaled(2, () => 7), 7, 'answers what it ran');
});

test('EG-ZH BETTER AMBIENCE YIELDS (systems/betterAmbience.js updateReverb): while another holds the zone it sets nothing and forgets its cache; the first frame after the release it asserts its wish again - in a dungeon its preset, out of one nothing (mutants: the hold unread; the cache kept, so the wish is never said again)', () => {
  const store = Object.fromEntries(Object.entries(MOD_SETTINGS[BETTER_AMBIENCE_VENDOR].keys).map(([k, d]) => [k, d.default]));
  store.Enabled = true;
  const reverbs = [];
  let held = null;
  const audio = { registerSound: async () => true, playOneShot: () => {}, loop: () => null, loop3d: () => null, setReverb: (p) => { reverbs.push(p); return true; }, reverbHeld: () => held };
  const c = createBetterAmbience({ audio, settings: () => readBetterAmbienceSettings(() => store), random: () => 0, weather: () => 'sunny', fetchClip: async () => null });
  const dungeon = { inside: true, inDungeon: true, entity: { items: [], activeEffects: [] }, pos: [0, 0, 0] };
  c.frame(0, dungeon);
  assert.deepEqual(reverbs, ['Stoneroom'], 'its wish, as ever');
  held = EG_REVERB_OWNER;
  c.frame(0, dungeon); c.frame(0, dungeon);
  assert.deepEqual(reverbs, ['Stoneroom'], 'held: nothing set');
  assert.equal(c.status().reverb, null, 'its cache forgotten');
  held = null;
  c.frame(0, dungeon);
  assert.deepEqual(reverbs, ['Stoneroom', 'Stoneroom'], 'released: its wish said again');
});

/** A client inside a breach of two at hall `h`'s `sg`, its words the director's own (test/net/eliteGates/egfull_client.test.js's), an engine
 *  that records the reverb's calls. */
function inBreach({ seed = 77, h = 2, sg = 'trial' } = {}) {
  const T0 = 1_800_000_000_000, ME = 'acct-0';
  let clock = T0 + EG_SEALED_MS + 60_000;
  const co = [[ME, 'Mac', 1], ['acct-1', 'Ann', 2]];
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: ME, o: 'Mac', ew: 0, rh: 0, seed, op: T0, co, site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 30, clock);
  B.h = h; B.sg = sg; B.wk = clock - 1000; B.cnt = { left: 1_500_000, at: clock - 1000 };
  const entity = { level: 30, health: 80, maxHealth: 100, magicka: 10, maxMagicka: 50, fatigue: 0, stats: { strength: 50, endurance: 50 }, items: [] };
  const player = { pos: realmToDungeon(0, 0, 0), height: 1.8, grounded: true, jumping: false, freezeMotor: 0, arena: null, collider: { move: () => {} } };
  let inside = true;
  const modes = { mode: 'dungeon', egHallBreach: () => (inside ? B.b : null), egHallCircle: () => 1, egPlace: (at) => { player.pos = [...at]; return true; }, egLeave: () => { inside = false; return true; }, egHallReturn: () => null, dungeonCtx: { exitDoors: [] } };
  const online = { welcomes: 1, terminal: false, sendEg: () => true };
  const calls = [];
  const audio = { holdReverb: (o) => { calls.push(['hold', o]); return true; }, reverbZone: (l, i) => calls.push(['zone', l, i]), reverbFade: (p, s) => calls.push(['fade', p, s]), releaseReverb: (o) => calls.push(['release', o]), playOneShot: () => {}, play3d: () => {} };
  const client = createEgClient({ modes: () => modes, online: () => online, hub: () => null, account: { me: () => ME, guest: () => false, keys: async () => ({ ok: false }) }, now: () => clock, entity, player, cam: { pos: [0, 0, 0] },
    say: () => {}, mid: () => {}, site: () => ({}), wire: () => null, landAt: () => true, hurt: () => {}, audio });
  const tell = (w) => { const v = validEgOut(JSON.parse(JSON.stringify(w))); assert.ok(v); client.word(v); };
  tell(egStateOf(B, clock));
  const spec = egHallOf(seed, h, 0);
  const stand = (x, z, y = 0) => { player.pos = realmToDungeon(spec.x0 + x, y, z); };
  stand(spec.arrive.x, spec.arrive.z);
  return { client, B, player, spec, calls, stand, online, leave: () => { inside = false; }, enter: () => { inside = true; }, step: (ms) => { clock += ms; } };
}

test('EG-ZH THE HALL\'S REVERB ON THIS SCREEN (scenes/eliteGates/egClient.js): held once I stand in the breach; the hall my feet stand in made with its base and second; walking into a fragment fades to its preset over 0.4 s, pacing at the mouth inside the hysteresis turns nothing, walking out fades back; standing in another hall makes that hall\'s; out of the breach it is let go once, and every way out lets it go - held through a swap or an answer under way (mutants: never held; the hall made every frame; the mouth unread; never let go)', () => {
  const P = inBreach();
  const { client, calls, spec, stand } = P;
  client.frame();
  assert.deepEqual(calls.slice(0, 2), [['hold', EG_REVERB_OWNER], ['zone', 'Quarry', 'Stoneroom']]);
  assert.equal(client.reverbState().held, true);
  assert.equal(client.reverbState().key, `${P.B.b}:2`, 'my feet\'s hall');
  client.frame(); client.frame();
  assert.equal(calls.filter((c) => c[0] === 'zone').length, 1, 'made once a hall');
  // an engine with no context yet answers false: the hall is asked again until it stands
  const R = createEgReverb({ audio: { holdReverb: () => true, reverbZone: () => false } });
  R.hold();
  assert.equal(R.hall('k', spec), false); assert.equal(R.state().key, '', 'not kept');
  assert.equal(R.hall('k', spec), false, 'asked again');
  assert.equal(R.state().builds, 2);
  assert.equal(calls.filter((c) => c[0] === 'hold').length, 1, 'held once');
  const f = spec.frags[0];
  stand(f.x, f.z0 + 2); client.frame();
  assert.deepEqual(calls.at(-1), ['fade', 'Stoneroom', 0.4]);
  stand(f.x, f.z0 - 0.5); client.frame(); stand(f.x, f.z0 + 0.5); client.frame();
  assert.equal(calls.filter((c) => c[0] === 'fade').length, 1, 'pacing at the mouth turns nothing');
  stand(f.x, f.z0 - 3); client.frame();
  assert.deepEqual(calls.at(-1), ['fade', 'Quarry', 0.4], 'out: the hall\'s own');
  // another hall of the circle (a pull's plate)
  const s3 = egHallOf(77, 3, 0);
  P.player.pos = realmToDungeon(s3.x0 + s3.arrive.x, 0, s3.arrive.z); client.frame();
  assert.equal(client.reverbState().key, `${P.B.b}:3`);
  assert.equal(calls.filter((c) => c[0] === 'zone').length, 2);
  // out of the breach
  P.leave(); client.frame(); client.frame();
  assert.equal(calls.filter((c) => c[0] === 'release').length, 1, 'let go once');
  assert.equal(client.reverbState().held, false);
  P.enter(); client.frame();
  assert.equal(calls.filter((c) => c[0] === 'hold').length, 2, 'held again on the way back in');
  // every way out: the walk out lets it go
  P.online.terminal = true; client.frame();
  assert.equal(calls.filter((c) => c[0] === 'release').length, 2, 'the walk out');
  const SRC = rd('src/scenes/eliteGates/egClient.js');
  assert.match(SRC, /if \(!swapping && !answering\) reverb\.release\(\);/, 'held through a swap or an answer under way');
  assert.match(SRC, /reverb\.release\(\); clampAway\(\);   \/\/ EG-ZH: the hall's reverb let go/, 'walkOut lets it go');
});

test('EG-ZH THE PEERS DOWN (net/peer/peerFx.js, systems/eliteGates/egMix.js): with no scope a peer\'s sound is as it was; the mix\'s `peers(true)` plays every peer sound at EG_MIX.peerDb (4 dB down) through the engine\'s scope - the peers\' blows and hurts, the walkers\' steps, swings and cries, their climbs - and `peers(false)` lets them be (mutants: the scope never set; the gain not the mix\'s; off never clearing)', () => {
  const { a, log } = engine();
  a.registerSamples('k', new Float32Array(8), 8000);
  const vol = () => log.gains.at(-1).gain.value;
  setPeerSoundScope(null);
  peerHeard(() => a.playOneShot('k', 1)); assert.equal(vol(), 1, 'no scope: as it was');
  const mix = createSpireMix({ audio: a });
  assert.equal(mix.peers(true), true);
  peerHeard(() => a.playOneShot('k', 1));
  assert.ok(Math.abs(vol() - egDbGain(-4)) < 1e-12 && EG_MIX.peerDb === -4, `4 dB down: ${vol()}`);
  a.playOneShot('k', 1); assert.equal(vol(), 1, 'my own sounds untouched');
  // the peers' blows and hurts (the fx player plays inside the scope)
  let t = 0;
  const fx = createPeerFxPlayer({ toScene: (p) => [p.x, p.y, p.z], now: () => t, play: { blow: () => a.playOneShot('k', 1), hurt: () => a.playOneShot('k', 1) } });
  fx.update('p1', { hk: 1 }, [0, 0, 0]); fx.frame();
  fx.update('p1', { hk: 2, hp: [5, 0, 5], hb: 1, hq: 20 }, [0, 0, 0]); t = 1; fx.frame();
  assert.ok(Math.abs(vol() - egDbGain(-4)) < 1e-12, 'a peer\'s blow rings 4 dB down');
  assert.equal(mix.heard().peers, true);
  assert.equal(mix.peers(false), false);
  peerHeard(() => a.playOneShot('k', 1)); assert.equal(vol(), 1, 'off: as they were');
  // every peer sound passes through it
  const RP = rd('src/net/remotePlayers.js'), PC = rd('src/net/peer/peerClimb.js'), PF = rd('src/net/peer/peerFx.js');
  assert.match(RP, /function peerSound\(audio, clip, at, volume\) \{\n  peerHeard\(\(\) => \{/, 'the walkers\' steps and swings');
  assert.match(RP, /if \(falloff > 0\) peerHeard\(\(\) => audio\.playOneShot\(peerDeathSound\(peer\?\.look\), falloff\)\);/, 'a peer\'s cry');
  assert.match(PC, /peerHeard\(\(\) => this\.audio\.play3d\(c\.key, at, Math\.min\(1, vol\)/, 'a peer\'s climb');
  assert.match(PF, /if \(!dup\) peerHeard\(\(\) => \(q\.hurt \? play\?\.hurt : play\?\.blow\)\?\.\(/, 'the blows and hurts');
  setPeerSoundScope(null);
});

test('EG-ZH WATCHFIRE\'S TELL AND THE PEERS IN THE FIGHT (scenes/eliteGates/egFight.js): a told blow\'s outline sounds the gate\'s sting at pitch 1.4 where it will land, once, as it first shows - not before its lead, never again, never once it has landed; a blow over the whole floor where I stand; the peers down while the hall\'s fight runs and as they were once it is left (mutants: the tell every frame; at the sting\'s pitch; the peers never down; never let go)', () => {
  assert.deepEqual({ ...EG_TELL_CUE }, { clip: BOSS_CUES.sting.clip, pitch: 1.4, volume: BOSS_CUES.sting.volume, reach: BOSS_CUES.sting.reach });
  assert.equal(EG_MIX.watchfirePitch, 1.4);
  assert.deepEqual(egToldAt({ s: [['l', 1, 2, 3, 4, 4]] }), [1, 2]);
  assert.deepEqual(egToldAt({ s: [['a'], ['d', 5, 6, 3]] }), [5, 6], 'the first stamp with an origin');
  assert.deepEqual(egToldAt({ s: [['a']] }, [7, 8]), [7, 8], 'the whole floor: where I stand');
  assert.equal(egToldAt({ s: [['h', 1, 2, 3]] }), null);
  let spec = null, seed = 0;
  for (seed = 1; seed < 50 && !spec; seed++) { const s = egHallOf(seed, 1, 0); if (s.kind === 'yard') spec = s; }
  seed--;
  const centre = egHallCentre(spec), me = [spec.fight?.x ?? 0, spec.fight?.z ?? 20];
  let t = 50_000;
  const F = { ...EG_FIGHT_EMPTY, h: 1, bodies: [], blows: [], told: [] };
  const E = { b: '0123456789abcdef', h: 1, seed, geo: 0, sg: 'trial', end: null, hw: 1, fight: F, co: [] };
  const played = [];
  const scopes = [];
  const audio = { play3d: (clip, at, v, o) => played.push({ clip, at, pitch: o?.pitch }), scaled: (g, run) => { scopes.push(g); return run(); } };
  const fight = createEgFight({ link: { state: () => E }, now: () => t, feet: () => [centre[0] + me[0], centre[1], centre[2] + me[1]], player: () => ({ health: 100, maxHealth: 100 }), me: () => 'acct-mac', audio });
  F.told = [{ i: 40, at: t + 2000, wu: 1000, sh: 350, heard: t + 900, s: [['d', me[0] + 4, me[1], 3]] }];
  fight.frame();
  assert.equal(played.filter((p) => p.pitch === 1.4).length, 0, 'not before it is heard');
  t += 950; fight.frame();
  const tells = played.filter((p) => p.pitch === 1.4);
  assert.equal(tells.length, 1, 'heard as its outline shows');
  assert.equal(tells[0].clip, BOSS_CUES.sting.clip);
  assert.deepEqual(tells[0].at.map((v) => Math.round(v * 100) / 100), [centre[0] + me[0] + 4, centre[1] + 1, centre[2] + me[1]].map((v) => Math.round(v * 100) / 100), 'where it will land');
  t += 200; fight.frame(); fight.frame();
  assert.equal(played.filter((p) => p.pitch === 1.4).length, 1, 'once a blow');
  F.told.push({ i: 41, at: t - 10, wu: 1000, sh: 350, heard: t - 2000, s: [['d', 0, 0, 3]] });
  fight.frame();
  assert.equal(played.filter((p) => p.pitch === 1.4).length, 1, 'a blow already landed tells nothing');
  assert.equal(fight.state().heard.tells, 1);
  // the peers
  assert.equal(fight.state().heard.peers, true, 'down while the fight runs');
  peerHeard(() => 0);
  assert.ok(Math.abs(scopes.at(-1) - egDbGain(-4)) < 1e-12, 'through the engine\'s scope at 4 dB down');
  fight.leave();
  assert.equal(fight.state().heard.peers, false, 'left: as they were');
  const n = scopes.length; peerHeard(() => 0); assert.equal(scopes.length, n, 'no scope out of the fight');
});
