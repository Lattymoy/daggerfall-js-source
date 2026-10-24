// GATHER-FEEL (2026-10-13, Mac: "I want to improve gathering, add gathering sounds and overall make the experience more
// palatable"): THE GATHERING'S SOUNDS AND ITS LAST BLOW (bible/06-Systems/Professions-Arc.md section 44). The thirty-six
// clips of our own (tools/gatherSfx.mjs -> public/sfx/gather-*.wav); the ear (systems/gatherSounds.js) over the real act
// machines - every beat, a blow heard as it lands (systems/chopAct.js and mineAct.js `landsIn`, characters/weaponStates.js
// MELEE_HIT_SHARE), the node's place and the net's, the water's own beats, the variety, the classic skin's DFU cues; and
// the host (scenes/gatherHost.js) over the real kinds - the act fed to the ear, the tool kept in the hand through its
// last swing, the node going as the blow lands, a tree's fall and a vein's rubble heard, the logs gathered up, the goods
// and a rank.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { GATHER_SFX, GATHER_SFX_FILES, GATHER_SAY, GATHER_SOUND, installGatherSounds, _resetGatherSounds, gatherClip, actBeats, netLanding, createGatherEar } from '../../src/systems/gatherSounds.js';
import { enhancedSoundsOn } from '../../src/systems/enhancedSounds.js';
import { PROF_CUES } from '../../src/systems/professions/profSounds.js';
import { createChopAct } from '../../src/systems/chopAct.js';
import { createMineAct, MINE_POINTS } from '../../src/systems/mineAct.js';
import { createHerbAct } from '../../src/systems/herbAct.js';
import { createTraceAct } from '../../src/systems/traceAct.js';
import { createFishAct, FLY_S } from '../../src/systems/fishAct.js';
import { CHOP_ACT, MINE_ACT, HERB_ACT, BASKET_ACT, TRACE_ACT, FISH_ACT, chopsFor } from '../../src/net/professionLaw.js';
import { HIT_FRAME_MELEE, MELEE_NUM_FRAMES, MELEE_HIT_SHARE } from '../../src/characters/weaponStates.js';
import { DEFAULT_ACTIVATION_DISTANCE } from '../../src/player/activate.js';
import { FALL_S } from '../../src/scenes/treeHost.js';
import { PICK_HAND } from '../../src/scenes/mineHost.js';
import { createGatherHost } from '../../src/scenes/gatherHost.js';
import { setForagingHost } from '../../src/systems/foraging/foragingInstall.js';
import { FEATURES } from '../../src/systems/features.js';
import { dice, bus, sfxOf, tick, PX, rig, arrive, strikeOut, lands } from '../gatherRig.mjs';   // GATHER-FEEL II: the rig, shared

const ROOT = join(fileURLToPath(new URL('..', import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
/** An ear with the sounds on, the clips unloaded, over a bus of its own. */
function ear({ on = () => true, rand = dice(0.5), cue = () => {} } = {}) {
  const audio = bus();
  return { audio, e: createGatherEar({ audio, on, rand, cue, install: false }) };
}
const keysOf = (shots) => shots.map((s) => s.key);
/** One host frame of a machine and the ear, in the host's order (scenes/gatherHost.js tick: every machine stepped, then
 *  the ear framed) - AUDIT GATHER-FEEL LANDING: a blow is said as its machine lands it, so the machine must run. */
const both = (e, act, dt, at, input = {}) => { act.tick(dt, input); e.frame(dt, act, at); };
function wavHeader(b) {
  const s = (o) => b.toString('latin1', o, o + 4);
  return { riff: s(0), wave: s(8), fmt: s(12), format: b.readUInt16LE(20), channels: b.readUInt16LE(22), rate: b.readUInt32LE(24), bits: b.readUInt16LE(34), data: s(36), dataLen: b.readUInt32LE(40) };
}

// ═══ THE CLIPS ═══════════════════════════════════════════════════════════════════════════════════════════════════════

test('GATHER-FEEL G1: the thirty-six clips - one file a key, each DAGGER.SND\'s own (PCM, mono, 8-bit, 11025 Hz), whole, on the provenance page and the doctrine\'s allow-list, baked deterministically: tools/gatherSfx.mjs writes the shipped bytes; every beat says a clip, and every clip is said (mutants: a key without a file, an unseeded noise)', () => {
  const keys = Object.values(GATHER_SFX).flat();
  assert.equal(keys.length, 36, 'thirty-six clips');
  assert.equal(new Set(keys).size, keys.length, 'no key twice');
  assert.deepEqual(Object.keys(GATHER_SFX_FILES).sort(), keys.slice().sort(), 'a file for every key');
  assert.equal(new Set(Object.values(GATHER_SFX_FILES)).size, keys.length, 'one file a key');
  const sources = src('public/sfx/SOURCES.md');
  const doctrine = src('test/tooling/doctrine.test.js');
  for (const file of Object.values(GATHER_SFX_FILES)) {
    const bytes = readFileSync(join(ROOT, 'public/sfx', file));
    const h = wavHeader(bytes);
    assert.deepEqual([h.riff, h.wave, h.fmt, h.data], ['RIFF', 'WAVE', 'fmt ', 'data'], file);
    assert.deepEqual([h.format, h.channels, h.rate, h.bits], [1, 1, 11025, 8], `${file}: DAGGER.SND's format`);
    assert.equal(h.dataLen, bytes.length - 44, `${file}: whole`);
    assert.ok(h.dataLen > 11025 * 0.1, `${file}: a sound, not a click`);
    assert.ok(sources.includes(`| \`${file}\` |`), `${file}: its provenance row`);
    assert.ok(doctrine.includes(`['public/sfx/${file}', 'OURS - GATHER-FEEL:`), `${file}: the doctrine's row`);
  }
  // every beat's sound is a clip's, and every clip a beat's
  for (const [name, say] of Object.entries(GATHER_SAY)) assert.ok(GATHER_SFX[say.sfx], `${name}: ${say.sfx} is a sound`);
  assert.deepEqual([...new Set(Object.values(GATHER_SAY).map((s) => s.sfx))].sort(), Object.keys(GATHER_SFX).sort(), 'no clip shipped that no beat says');
  const dir = mkdtempSync(join(tmpdir(), 'gathersfx-'));
  try {
    execFileSync(process.execPath, [join(ROOT, 'tools/gatherSfx.mjs')], { cwd: dir, stdio: 'pipe' });
    for (const f of Object.values(GATHER_SFX_FILES)) {
      assert.ok(readFileSync(join(dir, 'public/sfx', f)).equals(readFileSync(join(ROOT, 'public/sfx', f))), `${f}: the bake's bytes`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('GATHER-FEEL G2: the fall is the felled tree\'s - its first crack at the clip\'s start (the blow that fells it), its ground struck FALL_S later, as the tipping picture lies flat (scenes/treeHost.js); the tool takes FALL_S from the tree host (mutant: the ground struck early)', () => {
  const b = readFileSync(join(ROOT, 'public/sfx', GATHER_SFX_FILES['gather:fall']));
  const x = Array.from(b.subarray(44), (v) => (v - 128) / 128);
  // the level a 5 ms window at a time: the clip's loudest the ground's, its onset the first past the hinge's cracks to
  // reach half of it (the rush builds below it)
  const W = Math.round(11025 * 0.005);
  const level = [];
  for (let i = 0; i + W <= x.length; i += W) { let s2 = 0; for (let j = i; j < i + W; j++) s2 += x[j] * x[j]; level.push(Math.sqrt(s2 / W)); }
  const loudest = Math.max(...level);
  const top = level.indexOf(loudest) * 0.005;
  assert.ok(top >= FALL_S && top <= FALL_S + 0.15, `the clip's loudest is the ground's: ${top.toFixed(3)} s`);
  const onset = level.findIndex((l, k) => k * 0.005 >= 0.7 && l >= 0.5 * loudest) * 0.005;   // past the hinge's cracks
  assert.ok(Math.abs(onset - FALL_S) <= 0.02, `the ground struck at ${onset.toFixed(3)} s, FALL_S ${FALL_S}`);
  const peak = Math.max(...x.map(Math.abs));
  assert.ok(x.slice(0, Math.round(11025 * 0.02)).some((v) => Math.abs(v) > 0.1 * peak), 'the first crack at once');
  assert.match(src('tools/gatherSfx.mjs'), /import \{ FALL_S \} from '\.\.\/src\/scenes\/treeHost\.js';/);
  assert.match(src('tools/gatherSfx.mjs'), /const LEN = 2\.75, HIT = FALL_S;/);
});

test('GATHER-FEEL G3: the clips register on the bus once - under their keys, a clip that will not load is silence and the rest still take, and a bus with no door loads nothing', async () => {
  _resetGatherSounds();
  const regs = [];
  const audio = { registerSound: async (k) => { regs.push(k); return k !== 'gather:fall'; } };
  const fetchBytes = async (file) => { if (file === 'gather-rank.wav') throw new Error('404'); return new Uint8Array(8); };
  assert.equal(await installGatherSounds(audio, { fetchBytes }), 34, 'thirty-four took: one the decoder refused, one never came');
  assert.equal(regs.length, 35, 'each key offered once (the one that never came, never)');
  assert.ok(regs.every((k) => k in GATHER_SFX_FILES));
  assert.equal(await installGatherSounds(audio, { fetchBytes }), 34, 'once: the second call answers the first');
  assert.equal(regs.length, 35, '...and offers nothing again');
  _resetGatherSounds();
  assert.equal(await installGatherSounds({}, { fetchBytes }), 0, 'no registerSound, no load');
  _resetGatherSounds();
});

// ═══ THE MACHINES: A BLOW LANDS ON ITS HIT FRAME ═════════════════════════════════════════════════════════════════════

test('GATHER-FEEL G4: a chop and a strike land on DFU\'s melee hit frame - MELEE_HIT_SHARE its two of the strike\'s five; `landsIn` the swing\'s share still to come, nothing once landed; the swing runs out after the act\'s end and counts nothing there (mutants: the share off the frames, landsIn the whole swing, the swing frozen at the end)', () => {
  assert.equal(MELEE_HIT_SHARE, HIT_FRAME_MELEE / MELEE_NUM_FRAMES.StrikeDown);
  assert.equal(MELEE_HIT_SHARE, 0.4, 'frame 2 of 5');
  const chop = createChopAct({ tier: 1 });
  assert.equal(chop.landsIn, 0, 'nothing in the air');
  chop.tick(0.01, { attack: true });
  assert.ok(near(chop.landsIn, CHOP_ACT.swingS * MELEE_HIT_SHARE), `the blow ${chop.landsIn} s off`);
  chop.tick(CHOP_ACT.swingS * MELEE_HIT_SHARE - 0.01);
  assert.ok(chop.landsIn > 0 && chop.landsIn < 0.011, 'nearly landed');
  chop.tick(0.02);
  assert.equal(chop.landsIn, 0, 'landed');
  assert.ok(chop.swing > 0, 'the swing follows through after it');
  const mine = createMineAct({ tier: 1, rng: dice(0, 0.3, 0.6, 0.9) });
  mine.tick(0.01, { attack: true, aim: { yaw: 0, pitch: 0 } });
  assert.ok(near(mine.landsIn, MINE_ACT.swingS * MELEE_HIT_SHARE));
  // the act's end: the last swing still runs out, and nothing more counts
  const fell = createChopAct({ tier: 1 });
  for (let i = 0; i < 20 && !fell.state.done; i++) { fell.tick(CHOP_ACT.swingS + 0.01); fell.tick(0.001, { attack: true }); }
  assert.equal(fell.state.done, true);
  const chops = fell.state.chops;
  assert.ok(fell.landsIn > 0, 'the felling chop is in the air at the end');
  fell.tick(0.1, { attack: true });
  assert.ok(fell.swing > 0 && fell.swing < 1, 'its swing runs on past the end');
  assert.equal(fell.state.chops, chops, 'and counts nothing');
  fell.tick(CHOP_ACT.swingS);
  assert.equal(fell.swing, 0, 'run out');
  const vein = createMineAct({ tier: 1, rng: dice(0, 0.3, 0.6, 0.9) });
  for (let i = 0; i < 20 && !vein.state.done; i++) { vein.tick(MINE_ACT.swingS + 0.01); vein.tick(0.001, { attack: true, aim: { yaw: 50, pitch: 50 } }); }
  assert.equal(vein.state.done, true);
  vein.tick(0.1);
  assert.ok(vein.swing > 0 && vein.swing < 1, 'the last strike\'s swing runs on past the end');
});

// ═══ THE BEATS ═══════════════════════════════════════════════════════════════════════════════════════════════════════

/** The beats of each frame of a real act, by `drive(act, i)` - [name, delay] per beat, frame by frame. */
function beatsOf(act, frames, drive) {
  const prev = {};
  const out = [];
  for (let i = 0; i < frames; i++) {
    drive(act, i);
    for (const b of actBeats(prev, act.state, act.landsIn ?? 0)) out.push([b.name, Math.round(b.delay * 1000) / 1000, Math.round(b.pitch * 1000) / 1000]);
    if (act.state.done || act.state.cancelled) break;
  }
  return out;
}

test('GATHER-FEEL G5: the chop\'s beats - the swing at once, the blow as it lands (a Clean Cut its own), the tree\'s creak once at half its chops just after the blow that bent it, never on the felling chop (mutants: the blow on the press, the creak every chop, the creak on the fall)', () => {
  const lands = Math.round(CHOP_ACT.swingS * MELEE_HIT_SHARE * 1000) / 1000;
  const creak = Math.round((CHOP_ACT.swingS * MELEE_HIT_SHARE + GATHER_SOUND.CREAK_AFTER_S) * 1000) / 1000;
  // five plain chops on a tier-1 tree: the creak after the third (points 3 of 5 past half)
  const plain = beatsOf(createChopAct({ tier: 1 }), 40, (a, i) => { if (i % 2) a.tick(0.001, { attack: true }); else a.tick(CHOP_ACT.swingS + 0.01); });
  assert.equal(chopsFor(1), 5);
  assert.deepEqual(plain, [
    ['swing', 0, 1], ['chop', lands, 1],
    ['swing', 0, 1], ['chop', lands, 1],
    ['swing', 0, 1], ['chop', lands, 1], ['creak', creak, 1],
    ['swing', 0, 1], ['chop', lands, 1],
    ['swing', 0, 1], ['chop', lands, 1],
  ]);
  // Clean Cuts: each worth two - the creak after the second, and the third fells it (no creak on the felling chop)
  const clean = beatsOf(createChopAct({ tier: 1 }), 40, (a, i) => { if (i % 2) a.tick(0.0001, { attack: true }); else a.tick(CHOP_ACT.ringS); });
  assert.deepEqual(clean, [['swing', 0, 1], ['chopClean', lands, 1], ['swing', 0, 1], ['chopClean', lands, 1], ['creak', creak, 1], ['swing', 0, 1], ['chopClean', lands, 1]]);
  // a Lumberjack's three: plain, then the Clean Cut that both bends and fells it - the fall groans its own
  const quick = beatsOf(createChopAct({ tier: 1, lumberjack: true }), 40, (a, i) => {
    if (i === 0) a.tick(0.001, { attack: true });
    else if (i === 1) a.tick(CHOP_ACT.ringS);
    else a.tick(0.0001, { attack: true });
  });
  assert.equal(chopsFor(1, true), 3);
  assert.deepEqual(quick, [['swing', 0, 1], ['chop', lands, 1], ['swing', 0, 1], ['chopClean', lands, 1]]);
});

test('GATHER-FEEL G6: the strike\'s beats - the pick\'s swing (a heavier head, lower), the blow as it lands, the ore ringing on the glint (mutants: the glint crossed, the pick\'s swing the axe\'s)', () => {
  const lands = Math.round(MINE_ACT.swingS * MELEE_HIT_SHARE * 1000) / 1000;
  const p = GATHER_SOUND.PICK_SWING_PITCH;
  const a = createMineAct({ tier: 1, rng: dice(0, 0.3, 0.6, 0.9) });
  const out = beatsOf(a, 40, (m, i) => {
    if (i % 2) m.tick(0.001, { attack: true, aim: i === 1 ? { yaw: MINE_POINTS[m.state.glint][0], pitch: MINE_POINTS[m.state.glint][1] } : { yaw: 40, pitch: 40 } });
    else m.tick(MINE_ACT.swingS + 0.01);
  });
  assert.deepEqual(out.slice(0, 4), [['swing', 0, p], ['pickGlint', lands, 1], ['swing', 0, p], ['pick', lands, 1]]);
  assert.ok(p < 1);
});

test('GATHER-FEEL G7: the herb\'s beats - a kneel among the leaves as the act begins; the steady hand bruised once; the herb pulled at the end, bruised or not; the Basket\'s glint shown, a find, a glint gone unfound (mutants: the kneel lost, the pluck on a let-go, a bruise every frame)', () => {
  const hand = beatsOf(createHerbAct({ kind: 'hand' }), 40, (a) => a.tick(0.1));
  assert.deepEqual(hand.map((b) => b[0]), ['kneel', 'pluck']);
  const turn = { yaw: 0, pitch: 0 };
  const steady = beatsOf(createHerbAct({ kind: 'steady' }), 60, (a, i) => { if (i === 3) turn.yaw = 10; a.tick(0.1, { held: true, view: turn, pos: { x: 0, z: 0 } }); });
  assert.deepEqual(steady.map((b) => b[0]), ['kneel', 'bruise', 'pluck'], 'bruised once, and pulled');
  assert.ok(HERB_ACT.steadyS < 6);
  const letGo = beatsOf(createHerbAct({ kind: 'steady' }), 60, (a, i) => a.tick(0.1, { held: i < 4, view: turn, pos: { x: 0, z: 0 } }));
  assert.deepEqual(letGo.map((b) => b[0]), ['kneel'], 'let go before the end: nothing pulled');
  // the Basket: three glints - found, missed, found
  const basket = beatsOf(createHerbAct({ kind: 'basket', rng: dice(0.1, 0.5, 0.9) }), 400, (a) => {
    const st = a.state;
    const press = st.spot >= 0 && st.showing > 0.2 && st.find !== 1;
    a.tick(0.05, { attack: press });
  });
  assert.deepEqual(basket.map((b) => b[0]), ['kneel', 'sparkle', 'find', 'sparkle', 'miss', 'sparkle', 'find']);
  assert.equal(BASKET_ACT.finds, 3);
});

test('GATHER-FEEL G8: the knife\'s beats - the knife going in, each point passed a stroke, its pitch climbing along the line, a slip a tear, the pelt off at the end; Gentle acts the pelt alone (mutants: the pitch flat, the slip unheard)', () => {
  const t = createTraceAct({ tier: 1, rng: dice(0.5) });
  const pts = t.state.points;
  let k = 0, slipped = false;
  const out = beatsOf(t, 400, (a) => {
    // hold on the first point, slip once after the second, then draw the line to its end
    const p = pts[Math.min(pts.length - 1, Math.floor(k))];
    if (!slipped && k >= 2) { slipped = true; k = 0; a.tick(0.05, { held: false, aim: { yaw: p[0], pitch: p[1] } }); return; }
    a.tick(0.05, { held: true, aim: { yaw: p[0], pitch: p[1] } });
    k += 0.5;
  });
  const names = out.map((b) => b[0]);
  assert.equal(names[0], 'knife');
  assert.ok(names.includes('tear'), 'the slip torn');
  assert.equal(names.at(-1), 'peel');
  const strokes = out.filter((b) => b[0] === 'slice');
  assert.ok(strokes.length >= pts.length - 2, `a stroke a point: ${JSON.stringify(out)}`);
  const lastRun = strokes.slice(-(pts.length - 2));
  for (let i = 1; i < lastRun.length; i++) assert.ok(lastRun[i][2] > lastRun[i - 1][2], 'the pitch climbs along the line');
  assert.ok(lastRun[0][2] >= GATHER_SOUND.SLICE_FROM && lastRun.at(-1)[2] <= GATHER_SOUND.SLICE_TO + 1e-9);
  const gentle = beatsOf(createTraceAct({ tier: 1, gentle: true }), 200, (a) => a.tick(0.1, { held: true }));
  assert.deepEqual(gentle.map((b) => b[0]), ['peel']);
  assert.ok(TRACE_ACT.gentleS < 20);
});

test('GATHER-FEEL G9: the net\'s beats - thrown (on the act\'s first frame where a tapped E never wound it), landing, the tug, the haul begun, the net in at the end; the classic cues each beat stands for (mutants: the first frame unheard, the net in unheard)', () => {
  const f = createFishAct({ rng: dice(0) });
  let haul = false;
  const out = beatsOf(f, 2000, (a) => {
    const st = a.state;
    if (st.phase === 'tug') { a.tick(0.01, { attack: true }); haul = true; return; }
    a.tick(0.05, { held: false });
  });
  assert.ok(haul);
  assert.deepEqual(out.map((b) => b[0]), ['throw', 'netLand', 'tug', 'hauling', 'netOut'], 'a tapped E throws at once');
  assert.ok(FLY_S > 0 && FISH_ACT.waitMinS > 0);
  // the classic skin: what the HUD said for each beat before the ear (systems/professions/profSounds.js)
  const classic = Object.fromEntries(Object.entries(GATHER_SAY).filter(([, s]) => s.classic).map(([n, s]) => [n, s.classic]));
  assert.deepEqual(classic, { chop: 'strike', chopClean: 'glint', pick: 'strike', pickGlint: 'glint', bruise: 'slip', find: 'tick', miss: 'slip', slice: 'tick', tear: 'slip', throw: 'swing', netLand: 'splash', tug: 'tug', hauling: 'tick', clean: 'clean' });
  for (const c of Object.values(classic)) assert.ok(PROF_CUES[c], `${c}: a DFU cue`);
});

// ═══ THE EAR ═════════════════════════════════════════════════════════════════════════════════════════════════════════

test('GATHER-FEEL G10: the ear says a blow as it LANDS (its machine counting it landed - AUDIT GATHER-FEEL LANDING), at its node in reach at full volume; the swing at the ear at once; a sound of several never the one just heard, its pitch moved a little; a chime never moved; the act\'s blow that lands after the next act begins lands on its own node (mutants: the delay dropped, the node\'s reach, the repeat, the chime moved)', () => {
  // PIN MOVED (AUDIT GATHER-FEEL LANDING): the ear no longer times a blow on its own clock - it waits for the machine to
  // land it, so the pin steps the machine before each ear frame, as the host does
  const { audio, e } = ear({ rand: dice(0.5) });
  const node = [10, 2, 30];
  const a = createChopAct({ tier: 1 });
  e.frame(0.016, a, node);
  both(e, a, 0.001, node, { attack: true });
  assert.deepEqual(keysOf(audio.shots).map(sfxOf), ['swing'], 'the swing at once, the blow still in the air');
  assert.equal(audio.shots[0].at, null, 'the swing at the ear');
  assert.equal(audio.shots[0].volume, GATHER_SAY.swing.volume);
  both(e, a, CHOP_ACT.swingS * MELEE_HIT_SHARE - 0.01, node);
  assert.equal(audio.shots.length, 1, 'not yet');
  both(e, a, 0.02, node);
  assert.equal(sfxOf(audio.shots[1].key), 'chop', 'landed');
  assert.deepEqual(audio.shots[1].at, node, 'at the node');
  assert.equal(audio.shots[1].ref, DEFAULT_ACTIVATION_DISTANCE, 'a node in reach at its full volume');
  assert.equal(audio.shots[1].volume, GATHER_SAY.chop.volume);
  // never the same chop twice running, whatever the dice say
  const { audio: b2, e: e2 } = ear({ rand: dice(0) });
  const t2 = createChopAct({ tier: 6 });
  e2.frame(0.01, t2, node);
  for (let i = 0; i < 6; i++) { t2.tick(CHOP_ACT.swingS + 0.01); e2.frame(0.5, t2, node); t2.tick(0.001, { attack: true }); e2.frame(0.5, t2, node); }
  const chops = b2.shots.filter((s) => sfxOf(s.key) === 'chop').map((s) => s.key);
  assert.ok(chops.length >= 5);
  for (let i = 1; i < chops.length; i++) assert.notEqual(chops[i], chops[i - 1], 'never the one just heard');
  // the pitch: moved within the jitter; a chime never
  const { audio: b3, e: e3 } = ear({ rand: dice(1) });
  e3.say('logs');
  e3.say('clean');
  e3.frame(0.01);
  assert.ok(near(b3.shots[0].pitch, 1 + GATHER_SOUND.PITCH_JITTER), 'moved up to the jitter');
  assert.equal(b3.shots[1].pitch, 1, 'a chime keeps its note');
  // the last blow of an act still lands where it was struck when the next act has begun elsewhere
  const { audio: b4, e: e4 } = ear();
  const first = createMineAct({ tier: 1, rng: dice(0, 0.3, 0.6, 0.9) });
  e4.frame(0.01, first, [1, 0, 1]);
  both(e4, first, 0.001, [1, 0, 1], { attack: true, aim: { yaw: 40, pitch: 40 } });
  first.tick(0.05); e4.frame(0.05, createHerbAct({ kind: 'hand' }), [50, 0, 50]);   // its last swing still stepped (the host's `swings`)
  first.tick(0.2); e4.frame(0.2, null);
  const pick = b4.shots.find((s) => sfxOf(s.key) === 'pick');
  assert.deepEqual(pick?.at, [1, 0, 1], 'its own node');
});

test('GATHER-FEEL G11: the net\'s place - where it landed, along the look\'s bearing at the throw\'s metres, out to NET_REF_M at full volume; a plip by the floats while it waits, the catch fighting while it hauls, quicker and louder slipping outside the band (mutants: the plip\'s clock, the slip\'s haste)', () => {
  assert.deepEqual(netLanding([0, 1.6, 0], [0, 1, 3], 8), [0, 1, 8]);
  assert.deepEqual(netLanding([0, 1.6, 0], [3, 1, 0], 5), [5, 1, 0]);
  assert.equal(netLanding(null, [0, 0, 1], 5), null);
  assert.equal(netLanding([0, 0, 0], [0, 0, 0], 5), null, 'no bearing, no place');
  const { audio, e } = ear({ rand: dice(0) });
  const f = createFishAct({ rng: dice(0) });
  const eye = [0, 1.6, 0], at = [0, 1, 3];
  let t = 0;
  const plips = [];
  while (!f.state.done && t < 60) {
    const st = f.state;
    if (st.phase === 'tug') f.tick(0.01, { attack: true });
    else f.tick(0.05, { held: st.phase === 'wind' ? t < 1 : st.phase === 'haul' && st.weight > st.bandAt + st.bandW / 2 });   // wound a second: thrown well past the cast's point
    const n = audio.shots.length;
    e.frame(0.05, f, at, eye);
    for (const s of audio.shots.slice(n)) if (sfxOf(s.key) === 'plip') plips.push(t);
    t += 0.05;
  }
  const land = audio.shots.find((s) => sfxOf(s.key) === 'netLand');
  const m = f.state.throwM;
  assert.ok(m > FISH_ACT.throwMinM + 2 && m <= FISH_ACT.throwMaxM, `wound, thrown ${m} m`);
  assert.ok(near(land.at[2], m, 1e-6) && near(land.at[0], 0) && land.at[1] === 1, `landed ${m} m out along the look`);
  assert.equal(land.ref, GATHER_SOUND.NET_REF_M);
  assert.ok(audio.shots.find((s) => sfxOf(s.key) === 'tug')?.at, 'the tug at the net');
  // the plips: none sooner than PLIP_MIN_S apart, never more than PLIP_MAX_S
  for (let i = 1; i < plips.length; i++) {
    const gap = plips[i] - plips[i - 1];
    assert.ok(gap >= GATHER_SOUND.PLIP_MIN_S - 0.06 && gap <= GATHER_SOUND.PLIP_MAX_S + 0.06, `a plip ${gap} s after the last`);
  }
  assert.ok(f.state.waitS < GATHER_SOUND.PLIP_MIN_S || plips.length > 0, 'the wait heard');
  // the haul: a slipping catch fights every THRASH_SLIP_S, louder
  const { audio: b2, e: e2 } = ear({ rand: dice(0) });
  const g = createFishAct({ rng: dice(0) });
  for (let i = 0; i < 4000 && g.state.phase !== 'haul'; i++) { if (g.state.phase === 'tug') g.tick(0.01, { attack: true }); else g.tick(0.05); e2.frame(0.05, g, at, eye); }
  assert.equal(g.state.phase, 'haul');
  const n0 = b2.shots.length;
  const when = [];   // the frame each fight was heard on
  for (let i = 0; i < 30 && !g.state.done; i++) {
    g.state.weight = 1; g.state.speed = 0;   // the weight held hard against the top, the band let fall: slipping all along
    g.tick(0.05, { held: false });
    const before = b2.shots.length;
    e2.frame(0.05, g, at, eye);
    for (const s of b2.shots.slice(before)) if (s.key.startsWith('gather:thrash')) when.push({ i, s });
  }
  const fights = when.map((w) => w.s);
  assert.ok(fights.length >= 3, `the catch fights slipping: ${fights.length} in a second and a half`);
  for (let k = 2; k < when.length; k++) {
    const gap = (when[k].i - when[k - 1].i) * 0.05;
    assert.ok(Math.abs(gap - GATHER_SOUND.THRASH_SLIP_S) <= 0.051, `slipping, a fight every ${GATHER_SOUND.THRASH_SLIP_S} s: ${gap.toFixed(2)}`);
  }
  assert.equal(b2.shots.slice(n0).length, fights.length);
  assert.ok(near(fights[0].volume, GATHER_SAY.thrash.volume * GATHER_SOUND.THRASH_SLIP_GAIN), 'louder');
});

test('GATHER-FEEL G12: a beat said - at its own place or the ear, after its delay; a burst of goods rings once (its gap), a rank\'s chime after the goods\' bag; stop() drops the stopped act\'s blows in the air, never a finished act\'s nor a beat said (mutants: the gap dropped, the rank at once, stop dropping all)', () => {
  const { audio, e } = ear();
  e.say('fall', [5, 0, 5]);
  e.say('haul'); e.say('haul');
  e.say('rank');
  e.frame(0.01);
  assert.deepEqual(keysOf(audio.shots).map(sfxOf), ['fall', 'haul'], 'the fall at once, one bag of two');
  assert.deepEqual(audio.shots[0].at, [5, 0, 5]);
  e.frame(GATHER_SAY.rank.after - 0.02);
  assert.equal(audio.shots.length, 2, 'the rank waits on the bag');
  e.frame(0.02);
  assert.equal(sfxOf(audio.shots[2].key), 'rank');
  e.frame(GATHER_SAY.haul.gap);
  e.say('haul');
  e.frame(0.01);
  assert.equal(sfxOf(audio.shots.at(-1).key), 'haul', 'a bag again once its gap has passed');
  // stop(): a cancelled act's blow goes with it; a finished act's blow and a said chime land
  const { audio: b2, e: e2 } = ear();
  const done = createMineAct({ tier: 1, rng: dice(0, 0.3, 0.6, 0.9) });
  e2.frame(0.01, done, [1, 0, 1]);
  for (let i = 0; i < 20 && !done.state.done; i++) { both(e2, done, MINE_ACT.swingS + 0.01, [1, 0, 1]); both(e2, done, 0.001, [1, 0, 1], { attack: true, aim: { yaw: 40, pitch: 40 } }); }
  e2.say('clean', null, { delay: 0.1 });
  const next = createChopAct({ tier: 1 });
  done.tick(0.01); e2.frame(0.01, next, [9, 0, 9]);   // PIN MOVED (AUDIT GATHER-FEEL LANDING): the finished act's last swing stepped, as the host steps it
  done.tick(0.001); both(e2, next, 0.001, [9, 0, 9], { attack: true });
  e2.stop();
  assert.ok(!e2.pending.includes('chop'), 'the stopped act\'s blow let go - never held for a landing its machine will not make (AUDIT GATHER-FEEL LANDING)');
  const before = b2.shots.length;
  done.tick(0.5); e2.frame(0.5);
  const after = keysOf(b2.shots.slice(before)).map(sfxOf);
  assert.deepEqual(after.sort(), ['clean', 'pick'], 'the vein\'s last blow and the chime land; the cancelled chop never does');
});

test('GATHER-FEEL G13: the classic skin - the switch off, each beat says the DFU cue the HUD said for it before, on the blow\'s time, and nothing for the port\'s own beats; never a clip of ours; the clips load the first frame the switch is on, never off (mutants: the switch ignored, the classic cue on the press)', async () => {
  const cues = [];
  const { audio, e } = ear({ on: () => false, cue: (c) => cues.push(c) });
  const node = [0, 0, 3];
  const a = createChopAct({ tier: 1 });
  e.frame(0.01, a, node);
  both(e, a, 0.001, node, { attack: true });
  assert.deepEqual(cues, [], 'the blow still in the air');
  both(e, a, CHOP_ACT.swingS * MELEE_HIT_SHARE + 0.01, node);   // PIN MOVED (AUDIT GATHER-FEEL LANDING): the machine lands it
  assert.deepEqual(cues, ['strike'], 'DFU\'s hit, as the blow lands');
  e.say('fall', node); e.say('haul'); e.say('rank'); e.say('logs');
  e.say('clean');
  e.frame(1);
  assert.deepEqual(cues, ['strike', 'clean'], 'the clean finish DFU\'s lock click; the port\'s own beats nothing');
  assert.deepEqual(audio.shots, [], 'never a clip of ours');
  // the switch: the port's own sounds', and the clips' load
  assert.match(src('src/systems/gatherSounds.js'), /export function createGatherEar\(\{ audio = null, on = enhancedSoundsOn, rand = Math\.random, cue = profCue, install = true \} = \{\}\) \{/);
  assert.equal(typeof enhancedSoundsOn, 'function');
  const realFetch = globalThis.fetch;
  const urls = [];
  try {
    globalThis.fetch = async (url) => { urls.push(String(url)); return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }; };
    const regs = [];
    const bus2 = { ...bus(), registerSound: async (k) => { regs.push(k); return true; } };
    _resetGatherSounds();
    createGatherEar({ audio: bus2, on: () => false }).frame(0.01);
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(urls.length, 0, 'off: nothing loaded');
    const on = createGatherEar({ audio: bus2, on: () => true });
    on.frame(0.01); on.frame(0.01);
    for (let i = 0; i < 80 && regs.length < 36; i++) await new Promise((r) => setTimeout(r, 0));
    assert.equal(urls.length, 36, 'the frame itself loaded them, once each');
    assert.ok(urls.every((u) => /\/sfx\/gather-[a-z-]+(-\d)?\.wav$/.test(u)), 'from public/sfx');
    assert.deepEqual(regs.slice().sort(), Object.keys(GATHER_SFX_FILES).sort(), '...registered under their keys');
  } finally { globalThis.fetch = realFetch; _resetGatherSounds(); }
});

// ═══ THE HOST ════════════════════════════════════════════════════════════════════════════════════════════════════════


test('GATHER-FEEL G14: the last blow is seen and heard landing - the act ends on its press, the Pick-Axe stays in the hand through the rest of its swing and is put away as it runs out; the vein stands until the blow lands, then goes, its rubble heard at its place; the blow\'s clack before it, the swing\'s rush at once (mutants: the hand put away on the press, the vein gone on the press, the rubble unheard, the follow-through never put away)', async () => {
  try {
    const t = await rig();
    const v = t.host.nodesOf(PX, 150).find((n) => n.what === 'vein' && n.tier === 1);
    assert.ok(v, 'a tier-1 vein');
    await arrive(t, v);
    const drawn = t.centers();
    strikeOut(t, v);
    const hand = t.host.handTool();
    assert.deepEqual({ ...hand, frame: 0 }, { ...PICK_HAND, state: 'StrikeDown', frame: 0 }, 'the Pick-Axe still in the hand, mid-strike');
    for (let i = 0; i < 4; i++) await tick();   // a pixel stood again stands on its textures' answer
    assert.equal(t.centers(), drawn, 'the vein stands under the blow still falling');
    assert.ok(!t.audio.shots.some((s) => sfxOf(s.key) === 'rubble'));
    t.host.tick(lands - 0.05);
    for (let i = 0; i < 4; i++) await tick();
    assert.equal(t.centers(), drawn, 'not yet landed');
    const clacksBefore = t.audio.shots.filter((s) => /gather:pick/.test(s.key)).length;
    const frameBefore = t.host.handTool().frame;
    t.host.tick(0.06);
    for (let i = 0; i < 4; i++) await tick();
    assert.equal(t.centers(), drawn - 3, 'landed: the vein goes');
    assert.ok(t.host.handTool().frame > frameBefore, 'the strike drawn on');
    const rubble = t.audio.shots.find((s) => sfxOf(s.key) === 'rubble');
    assert.ok(rubble, 'its rubble heard');
    assert.ok(Math.abs(rubble.at[0] - v.local[0]) < 1e-6 && Math.abs(rubble.at[2] - v.local[2]) < 1e-6, 'at the vein');
    assert.equal(t.audio.shots.filter((s) => /gather:pick/.test(s.key)).length, clacksBefore + 1, 'the last blow\'s clack in the frame it lands, with the rubble');
    assert.ok(t.audio.shots.filter((s) => sfxOf(s.key) === 'swing').length >= 2, 'the swing\'s rush with every strike');
    t.host.tick(MINE_ACT.swingS);
    assert.equal(t.host.handTool(), null, 'the swing run out: put away');
    // the answer: the goods' bag, and a rank risen its chime after it
    t.gate.answers.shift()({ ok: true, data: { node: v.key, kind: 'ore', material: 'metal:iron', qty: 3, xp: 22, track: { profession: 'mining', xp: 300, rank: 2 }, today: 1 } });
    for (let i = 0; i < 6; i++) await tick();
    t.host.tick(0.016);
    assert.ok(t.audio.shots.some((s) => sfxOf(s.key) === 'haul'), 'the goods into the bag');
    t.host.tick(GATHER_SAY.rank.after);
    assert.ok(t.said.some((x) => /Mining 0 -> 2/.test(x)));
    assert.equal(sfxOf(t.audio.shots.at(-1).key), 'rank', 'the rank\'s chime after it');
    t.host.dispose();
  } finally { setForagingHost(null); }
});

test('GATHER-FEEL G14b: a harvest answered before its last blow lands waits for it - the vein still stands under the falling pick, then goes as the blow lands, its rubble heard once (mutant: the answer falls it early)', async () => {
  try {
    const t = await rig();
    const v = t.host.nodesOf(PX, 150).find((n) => n.what === 'vein' && n.tier === 1);
    await arrive(t, v);
    const drawn = t.centers();
    strikeOut(t, v);
    t.gate.answers.shift()();   // the service quick: answered before the blow lands
    for (let i = 0; i < 6; i++) await tick();
    t.host.tick(0.016);
    for (let i = 0; i < 4; i++) await tick();
    assert.ok(t.book.taken(v.key, 'ore'), 'answered');
    assert.equal(t.centers(), drawn, 'answered, and still standing under the blow');
    assert.ok(!t.audio.shots.some((s) => sfxOf(s.key) === 'rubble'));
    t.host.tick(lands);
    for (let i = 0; i < 4; i++) await tick();
    assert.equal(t.centers(), drawn - 3, 'the blow landed: gone');
    t.host.tick(MINE_ACT.swingS);
    assert.equal(t.audio.shots.filter((s) => sfxOf(s.key) === 'rubble').length, 1, 'its rubble heard once');
    t.host.dispose();
  } finally { setForagingHost(null); }
});

test('GATHER-FEEL G15: a harvest refused before its last blow lands takes nothing down - the vein stands, no rubble; one taken elsewhere goes unheard, as GATHER-SPEED stands it; Escape mid-act drops the blow still in the air with the hand (mutants: a refusal leaves the landing, Escape keeps the blow)', async () => {
  try {
    const t = await rig();
    const veinsHere = t.host.nodesOf(PX, 150).filter((n) => n.what === 'vein' && n.tier === 1);
    const v = veinsHere[0];
    await arrive(t, v);
    const drawn = t.centers();
    strikeOut(t, v);
    t.gate.answers.shift()({ ok: false, error: 'prof-rank' });
    for (let i = 0; i < 6; i++) await tick();
    t.host.tick(0.016);
    t.host.tick(MINE_ACT.swingS);
    for (let i = 0; i < 4; i++) await tick();
    assert.equal(t.centers(), drawn, 'refused: it never went');
    assert.ok(!t.audio.shots.some((s) => sfxOf(s.key) === 'rubble'), 'no rubble');
    // taken elsewhere (another session's): it goes - stood again as another's, never felled by this blow
    const x = veinsHere[1];
    assert.ok(x, 'a second tier-1 vein');
    await arrive(t, x);
    const drawn2 = t.centers();
    strikeOut(t, x);
    t.gate.answers.shift()({ ok: false, error: 'node-taken' });
    for (let i = 0; i < 6; i++) await tick();
    t.host.tick(0.016);
    t.host.tick(MINE_ACT.swingS);
    for (let i = 0; i < 4; i++) await tick();
    assert.equal(t.centers(), drawn2 - 3, 'another\'s: gone');
    assert.ok(!t.audio.shots.some((s) => sfxOf(s.key) === 'rubble'), 'unheard - this blow took nothing down');
    // Escape: a strike in the air, then the act ended - its clack never lands (at the refused vein, standing still)
    const w = v;
    t.face(w);
    t.host.tick(0.016);
    assert.equal(t.host.press(), true);
    t.host.tick(MINE_ACT.swingS + 0.01);
    t.input.v = { held: false, attack: true, choice: false };
    t.host.tick(0.001);
    t.input.v = { held: false, attack: false, choice: false };
    const n = t.audio.shots.length;
    assert.equal(t.host.cancel(), true);
    assert.deepEqual(t.e.pending.filter((k) => /^pick/.test(k)), [], 'its blow let go at once, never held (AUDIT GATHER-FEEL LANDING)');
    t.host.tick(MINE_ACT.swingS);
    assert.ok(!t.audio.shots.slice(n).some((s) => /gather:pick/.test(s.key)), 'the blow went with the hand');
    assert.equal(t.host.handTool(), null);
    t.host.dispose();
  } finally { setForagingHost(null); }
});

test('GATHER-FEEL G16: an act with nothing in the air goes at its end - a patch\'s last harvest (its herbs, then its Basket) takes its flats down on the frame the search ends; the kneel and the herb pulled heard at the patch (mutant: the act with no blow left waiting)', async () => {
  try {
    const t = await rig({ answer: (b) => ({ ok: true, data: { node: b.node, kind: b.kind, material: 'herb:red-rose', qty: 1, xp: 5, track: { profession: 'herbalism', xp: 5, rank: 0 }, today: 1 } }) });
    const p = t.host.nodesOf(PX, 150).find((n) => n.kind === 'herb' && n.tier === 1);
    assert.ok(p, 'a tier-1 patch');
    const drawn = t.centers();
    t.face(p);
    t.host.tick(0.016);
    assert.equal(t.host.press(), true, 'the herbs first');
    for (let i = 0; i < 40 && t.host.acting(); i++) t.host.tick(0.05);
    assert.equal(t.host.acting(), false);
    for (let i = 0; i < 4; i++) await tick();
    assert.equal(t.centers(), drawn, 'the herbs alone: the patch stands for its food');
    const heard = keysOf(t.audio.shots).map(sfxOf);
    assert.deepEqual(heard.filter((s) => s === 'rustle' || s === 'pluck'), ['rustle', 'pluck'], 'the kneel, the herb pulled');
    assert.ok(t.audio.shots.find((s) => sfxOf(s.key) === 'pluck').at, 'at the patch');
    t.face(p);
    t.host.tick(0.016);
    assert.equal(t.host.press(), true, 'then the Basket');
    let ended = false;
    for (let i = 0; i < 400 && !ended; i++) { t.host.tick(0.05); ended = !t.host.acting(); }
    assert.ok(ended);
    for (let i = 0; i < 4; i++) await tick();   // no host frame past the search's end: what goes went with it
    assert.ok(t.centers() < drawn, 'the frame the search ended: the patch gone, nothing waiting on a blow');
    t.host.dispose();
  } finally { setForagingHost(null); }
});

test('GATHER-FEEL G17: a tree falls heard - its creak at half its chops, the fall from the frame the felling blow lands, at the tree; its logs heard gathered up when walked over (mutants: the fall unheard, the logs unheard)', async () => {
  try {
    const t = await rig({ answer: (b) => ({ ok: true, data: { node: b.node, kind: b.kind, material: 'log:oak', qty: 3, xp: 30, track: { profession: 'logging', xp: 30, rank: 0 }, today: 1 } }) });
    const n = t.host.nodesOf(PX, 150).find((x) => x.what === 'tree' && x.tier <= 2);
    assert.ok(n, 'a tree');
    t.face(n);
    t.host.tick(0.016);
    assert.equal(t.host.press(), true);
    for (let i = 0; i < 12 && t.host.acting(); i++) {
      t.input.v = { held: false, attack: false, choice: false };
      t.host.tick(CHOP_ACT.swingS + 0.01);
      t.input.v = { held: false, attack: true, choice: false };
      t.host.tick(0.001);
    }
    t.input.v = { held: false, attack: false, choice: false };
    assert.equal(t.host.acting(), false);
    t.host.tick(0.2);
    const names = keysOf(t.audio.shots).map(sfxOf);
    assert.equal(names.filter((s) => s === 'creak').length, 1, 'one creak');
    assert.ok(names.indexOf('creak') < names.lastIndexOf('chop'), 'at half its chops');
    const fall = t.audio.shots.find((s) => sfxOf(s.key) === 'fall');
    assert.ok(fall, 'the fall heard');
    assert.ok(Math.abs(fall.at[0] - n.local[0]) < 1e-6 && Math.abs(fall.at[2] - n.local[2]) < 1e-6, 'at the tree');
    t.gate.answers.shift()();
    for (let i = 0; i < 6; i++) await tick();
    // the logs at its foot, walked over
    for (let i = 0; i < 8; i++) { t.host.tick(0.25); await tick(); }
    const before = t.audio.shots.length;
    for (const dx of [-1, -0.5, 0, 0.5, 1]) for (const dz of [-1, -0.5, 0, 0.5, 1]) {
      for (const r of [0.5, 1, 1.5, 2, 2.5, 3]) { t.feet[0] = n.local[0] + dx * r; t.feet[2] = n.local[2] + dz * r; t.host.tick(0.016); }
    }
    assert.ok(t.audio.shots.slice(before).some((s) => sfxOf(s.key) === 'logs'), 'the logs gathered up');
    t.host.dispose();
  } finally { setForagingHost(null); }
});

test('GATHER-FEEL G18: the hosts - the world hands the gathering host its bus (the street, a dungeon and a building are the one host\'s); the host feeds the ear the act every frame and the idle frame too; the Enhanced sounds row says the gathering (mutants: the bus unhanded, the idle frame unfed)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /\n\s+audio,   \/\/ GATHER-FEEL: the bus the gathering's ear says the acts on/);
  const g = src('src/scenes/gatherHost.js');
  assert.match(g, /const ear = deps\.ear \?\? createGatherEar\(\{ audio: deps\.audio \?\? null \}\);/);
  assert.match(g, /ear\.frame\(dt, act\.act, act\.world, pos\);/);
  assert.match(g, /ear\.frame\(dt, null\);   \/\/ GATHER-FEEL: a finished act's last blow still lands/);
  assert.match(g, /handTool: \(\) => \(act\?\.hand \? act\.hand\(act\) : follow\?\.hand \? follow\.hand\(follow\) : null\),/);
  for (const f of ['worldModes', 'dungeonContext', 'exterior']) assert.doesNotMatch(src(`src/scenes/${f}.js`), /createGatherHost\(/, `${f}: no host of its own - the world's one`);
  const row = FEATURES.find((f) => f.id === 'enhanced-sounds');
  assert.match(row.note, /gather/i, 'the row says it');
});
