// WBX8 (2026-09-26, Mac: "Improve the sky effect to be more like the /event dread command" - "When I say sky effect,
// I mean daggerfall, not the inside"): THE SKY OVER A GATE BURNS. The omen has always said "The sky burns over the
// wilds near ..." and the overworld's sky never did; now a gate's life (systems/gateOmen.js gateSkyPhaseWeight) and the
// eye's distance from it (gateSkyNear) give the live event's dread a weight of its own - the crimson grade on the sky,
// its fog and the land's light (scenes/world.js takes the greater of the event's and the gate's) - and the event's red
// storm gathers over the gate on a schedule of its own (world/dreadSky.js dreadStrikes' ring, createDreadStorm's
// centre). Design: bible/11-Multiplayer/World-Bosses.md section 12.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  gateSkyPhaseWeight, gateSkyNear, gateSkyWeight, createGateOmen, gateSceneXZ,
  GATE_SKY_KINDLE, GATE_SKY_KINDLE_MS, GATE_SKY_OMEN, GATE_SKY_RISEN, GATE_SKY_FULL_M, GATE_SKY_EDGE_M, GATE_STORM_RING,
} from '../src/systems/gateOmen.js';
import { gateTimes, isGateDay, GATE_COLLAPSE_MS, PIXEL_M } from '../src/net/gateLaw.js';
import { GATE_TOWN_MAX_PX } from '../src/systems/gateSite.js';
import { dreadStrikes, createDreadStorm, DREAD_NEAR_M, DREAD_FAR_M, DREAD_BOLT_COLOR, DREAD_SLOT_MS } from '../src/world/dreadSky.js';
import { thunderOf } from '../src/systems/distantStorms.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
let DAY = 1000;
while (!isGateDay(DAY)) DAY++;
const T = gateTimes(DAY);

test('WBX8 the sky\'s life: nothing before the omen; the omen\'s line kindles it at once and it deepens to the rise, to the opening, whole within its kindling of the opening; whole until his end, cleared as the gate collapses - by his fall after the opening, never by one before it; and never a step, a frame to the next (mutants: burning before the omen; the opening a step; the sky left burning after the collapse; a fall before the opening ending it)', () => {
  assert.equal(gateSkyPhaseWeight(T, T.omenAt - 1), 0, 'quiet before the omen');
  assert.equal(gateSkyPhaseWeight(null, T.openAt), 0);
  assert.equal(gateSkyPhaseWeight(T, NaN), 0);
  assert.ok(gateSkyPhaseWeight(T, T.omenAt + GATE_SKY_KINDLE_MS) >= GATE_SKY_KINDLE, 'the omen\'s line is true at once');
  assert.ok(Math.abs(gateSkyPhaseWeight(T, T.riseAt) - GATE_SKY_OMEN) < 1e-9, 'the omen\'s depth by the rise');
  assert.ok(Math.abs(gateSkyPhaseWeight(T, T.openAt) - GATE_SKY_RISEN) < 1e-9, 'the risen gate\'s by the opening');
  assert.equal(gateSkyPhaseWeight(T, T.openAt + GATE_SKY_KINDLE_MS), 1, 'whole once open');
  assert.equal(gateSkyPhaseWeight(T, T.sealAt + 1000), 1, 'sealed, it still burns');
  assert.equal(gateSkyPhaseWeight(T, T.wrathAt - 1), 1);
  assert.equal(gateSkyPhaseWeight(T, T.wrathAt + GATE_COLLAPSE_MS), 0, 'cleared as the gate collapses');
  const fell = T.openAt + 120_000;
  assert.equal(gateSkyPhaseWeight(T, fell - 1, fell), 1);
  assert.ok(gateSkyPhaseWeight(T, fell + GATE_COLLAPSE_MS / 2, fell) < 1, 'his fall begins its clearing');
  assert.equal(gateSkyPhaseWeight(T, fell + GATE_COLLAPSE_MS, fell), 0, 'and clears it with the collapse');
  assert.equal(gateSkyPhaseWeight(T, T.openAt + 300_000, T.openAt - 60_000), 1, 'a word of a fall before the opening ends nothing (gatePhase\'s own law)');
  let prev = 0, step = 0;
  for (let t = T.omenAt - 1000; t < T.wrathAt + GATE_COLLAPSE_MS + 1000; t += 16) { const w = gateSkyPhaseWeight(T, t); step = Math.max(step, Math.abs(w - prev)); prev = w; }
  assert.ok(step < 0.01, `never a step: ${step.toFixed(4)} a frame at most`);
});

test('WBX8 the sky\'s reach: whole over the gate and over the town it is reached from, thinning to nothing at its edge, never more for a farther eye; the weight is the life\'s by the reach (mutants: the reach inverted; the edge cut short)', () => {
  assert.ok(GATE_SKY_FULL_M >= GATE_TOWN_MAX_PX * PIXEL_M, 'the farthest town a gate is reached from stands under the whole of it');
  assert.ok(GATE_SKY_EDGE_M >= 2 * GATE_SKY_FULL_M, 'and it thins over a wide band round them - the region sees it gathering, never a cliff at a town\'s edge');
  assert.equal(gateSkyNear(0), 1);
  assert.equal(gateSkyNear(GATE_SKY_FULL_M), 1);
  assert.equal(gateSkyNear(GATE_SKY_EDGE_M), 0);
  assert.equal(gateSkyNear(GATE_SKY_EDGE_M * 3), 0);
  assert.equal(gateSkyNear(NaN), 0);
  const mid = gateSkyNear((GATE_SKY_FULL_M + GATE_SKY_EDGE_M) / 2);
  assert.ok(mid > 0.3 && mid < 0.7, `half way, about half: ${mid}`);
  let prev = 1;
  for (let d = 0; d <= GATE_SKY_EDGE_M + 500; d += 250) { const n = gateSkyNear(d); assert.ok(n <= prev + 1e-12, `no farther eye sees more (${d} m)`); prev = n; }
  assert.equal(gateSkyWeight(T, T.openAt + GATE_SKY_KINDLE_MS, null, 100), 1);
  assert.equal(gateSkyWeight(T, T.openAt + GATE_SKY_KINDLE_MS, null, GATE_SKY_EDGE_M + 1), 0);
});

test('WBX8 the omen\'s sky: the site in the scene and the weight for an eye there - from the omen on, before the gate stands; none for an eye past its reach, none with no site (mutants: the sky only while the gate stands; the site\'s spot left out)', () => {
  const site = { px: 400, py: 200, spot: [300, 500], near: 'Fonting', place: 'Fonting', ring: { cx: 400, cy: 200, r: 2 } };
  let now = T.omenAt + 60_000;
  const omen = createGateOmen({ now: () => now, site: () => site, say: () => {}, fellAt: () => null });
  const translate = (px, py) => [px * PIXEL_M, 0, -py * PIXEL_M];
  assert.equal(omen.sky([0, 0, 0], translate), null, 'nothing before the first frame');
  omen.frame();
  assert.equal(omen.current().phase, 'omen');
  assert.equal(omen.standing(), null, 'the gate does not stand in the omen...');
  const [x, z] = gateSceneXZ(site, translate(site.px, site.py));
  const at = omen.sky([x, 10, z], translate);
  assert.ok(at && at.x === x && at.z === z, '...and its sky already burns over the site');
  assert.ok(Math.abs(at.weight - gateSkyPhaseWeight(T, now)) < 1e-12, 'the omen\'s weight, whole reach');
  assert.equal(omen.sky([x + GATE_SKY_EDGE_M + 10, 10, z], translate), null, 'past its reach, nothing');
  now = T.openAt + GATE_SKY_KINDLE_MS;
  omen.frame();
  assert.equal(omen.sky([x + 100, 0, z - 100], translate).weight, 1, 'open: whole over the site');
  const bare = createGateOmen({ now: () => now, site: () => null, say: () => {} });
  bare.frame();
  assert.equal(bare.sky([x, 0, z], translate), null, 'no map data, no site, no sky');
});

test('WBX8 the gate\'s storm: the event\'s strikes\' law on a schedule of its own, round the gate at its own reach, with each strike\'s thunder from its distance to the EYE; left out, the ring and the centre are the event\'s, strike for strike (mutants: the gate\'s storm the event\'s schedule; strikes round the eye; thunder from the gate)', () => {
  const t0 = 1_790_400_000_000, span = 900_000;
  // a slot at a time (a call walks at most DREAD_SLOTS_MAX of them - the latest)
  const walk = (ring) => { const out = []; for (let t = t0; t < t0 + span; t += DREAD_SLOT_MS) out.push(...dreadStrikes(t, t + DREAD_SLOT_MS, 1, ring)); return out; };
  assert.deepEqual(walk(undefined), walk({}), 'the event\'s ring when none is given');
  const ev = walk(undefined), gs = walk(GATE_STORM_RING);
  assert.ok(ev.length > 100 && gs.length > 100, 'both storms strike');
  assert.ok(ev.every((s) => s.distance >= DREAD_NEAR_M && s.distance <= DREAD_FAR_M));
  assert.ok(gs.every((s) => s.distance >= GATE_STORM_RING.near && s.distance <= GATE_STORM_RING.far), 'the gate\'s reach');
  const same = gs.filter((s) => ev.some((e) => e.atMs === s.atMs)).length;
  assert.ok(same < gs.length * 0.2, `a schedule of its own (${same} of ${gs.length} in the event's moments)`);
  const near = gs.filter((s) => s.distance < GATE_STORM_RING.split).length / gs.length;
  assert.ok(Math.abs(near - GATE_STORM_RING.nearShare) < 0.12, `most of it at the gate itself: ${near.toFixed(2)}`);
  // round the centre, heard at the eye
  const storm = createDreadStorm(GATE_STORM_RING);
  const eye = [0, 0, 0], centre = [2500, 0, -1500];
  storm.tick({ sharedMs: t0, eye, weight: 1, centre });
  const strikes = [], sounds = [];
  for (let t = t0 + 50; t <= t0 + 120_000; t += 50) { const r = storm.tick({ sharedMs: t, eye, weight: 1, centre }); strikes.push(...r.strikes.map((s) => ({ ...s, t }))); sounds.push(...r.sounds); }
  assert.ok(strikes.length > 10);
  for (const s of strikes) {
    const d = Math.hypot(s.x - centre[0], s.z - centre[2]);
    assert.ok(d >= GATE_STORM_RING.near - 1e-6 && d <= GATE_STORM_RING.far + 1e-6, 'round the gate');
    assert.equal(s.color, DREAD_BOLT_COLOR, 'the event\'s red');
  }
  const heard = strikes.filter((s) => thunderOf(Math.hypot(s.x - eye[0], s.z - eye[2]))).length;
  assert.ok(sounds.length > 0 && sounds.length <= heard, `thunder for the strikes near enough the eye to be heard (${sounds.length}/${heard})`);
  for (const snd of sounds) {
    const src = strikes.find((s) => s.x === snd.x && s.z === snd.z);
    assert.ok(src, 'a thunder is its strike\'s');
    assert.equal(snd.volume, thunderOf(Math.hypot(src.x - eye[0], src.z - eye[2])).volume, 'as loud as its distance to the ear says');
  }
  // the event's own storm, no centre: round the eye as it always was
  const evStorm = createDreadStorm();
  evStorm.tick({ sharedMs: t0, eye: [100, 0, 100], weight: 1 });
  const r = evStorm.tick({ sharedMs: t0 + 120_000, eye: [100, 0, 100], weight: 1 });
  for (const s of r.strikes) { const d = Math.hypot(s.x - 100, s.z - 100); assert.ok(d >= DREAD_NEAR_M - 1e-6 && d <= DREAD_FAR_M + 1e-6); }
});

test('WBX8 the seams, by source: the host reads the omen\'s sky each exterior frame and takes the greater of it and the event\'s for the sky, the fog and the light; the gate\'s storm is its own, ticked every frame round the site, forgotten on a jump', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /const gateStorm = createDreadStorm\(GATE_STORM_RING\);/);
  assert.match(w, /const gateSky = gateOmen\?\.sky\(mwv\.eye, gateSkyTranslate\) \?\? null;/);
  assert.match(w, /const skyDreadW = Math\.max\(dreadW, gateSky\?\.weight \?\? 0\);/);
  assert.match(w, /sky\.setDread\(skyDreadW, dreadCloudGlow\(boltFrame\.bolts\)\);/);
  assert.match(w, /\(1 - DREAD_KEY_DIM \* skyDreadW\)/);
  assert.match(w, /dreadLight\(SUN_RIG_COLOR, skyDreadW\)\);/);
  assert.match(w, /gateStorm\.tick\(\{ sharedMs: Date\.now\(\) \+ _sharedOffsetMs, eye: mwv\.eye, weight: gateSky\?\.weight \?\? 0, centre: gateSky \? _gateStormC : null \}\);/);
  assert.match(w, /if \(jump\) \{ dreadStorm\.reset\(\); gateStorm\.reset\(\); \}/);
  assert.doesNotMatch(w, /sky\.setDread\(dreadW,/, 'the event alone no longer grades the sky');
});
