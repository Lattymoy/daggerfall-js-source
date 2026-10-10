// SERPENT1 (2026-10-04, Mac: "A new world event that requires players with a ship to meet up and take on a large scale
// sea serpent in the ocean"; "make this something truly special"): THE CLIENT'S HALF. Where it rises off the packet
// lanes (systems/serpentSite.js); the cell's words folded (net/serpentLink.js); its blows judged on my own ship
// (systems/serpentStrike.js); the sighting's lines and ring (systems/serpentOmen.js); the host end to end against the
// relay's own brain (scenes/serpentHost.js - the `in`, the volleys gathered, a blow landed, the coil held and broken,
// the whirl's pull, the seams Come Sail Away and the naval host read); the renderer's pure builders; the bar; its voice;
// the hoard; the held map's ring; and the world host's wiring (THE FOUR HOSTS RULE).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { findSerpentSite, sitePixelOfNative, openAround, pointAlong, SITE_LANE_MIN_M } from '../src/systems/serpentSite.js';
import { serpentTimes, isSerpentDay, serpentRing, SERPENT_RING_PIXELS, SERPENT_DIVE_MS, SERPENT_BRAIN_V, SERPENT_NATIVE_PER_M } from '../src/net/serpentLaw.js';
import { foldSerpent, createSerpentLink, SERPENT_STATE_EMPTY, SERPENT_NO_TEXT } from '../src/net/serpentLink.js';
import { mintSerpentReceipt } from '../src/net/serpentReceipt.js';
import { validSerpentOut, cellRoomOfWire, PIXEL_UNITS } from '../src/net/wire.js';
import { MODES_KEPT, SEG_N, MODE } from '../src/net/serpentBody.js';
import {
  newSerpentFight, joinSerpentFight, serpentStateOf, SERPENT_ATTACK_TABLE, CRUSH, GRIP, MAEL_R, MAEL_EYE_R, MAEL_GRIND, SPIT_FLIGHT_MS, RAM_V, ZONES, ADMIT_R,
} from '../src/net/serpentBrain.js';
import { shapeMeets, shipHurt, crushHurt, gripHurt, grindHurt, shoveOf, shoveLeft, maelPull, globAt, poolOf, poolBites, ramHead, shipPoints, SHOVE_S, MAEL_GROW_MS } from '../src/systems/serpentStrike.js';
import { createSerpentOmen, SERPENT_OMEN_SETTLE_MS, SITE_RETRY_MS, insideSerpentRing } from '../src/systems/serpentOmen.js';
import { createSerpentHost, segmentOfTarget, IN_RETRY_MS, IN_RESEND_MS, HIT_GATHER_MS, COIL_LOST_MS, COIL_WORD_WAIT_MS, SERPENT_TARGET } from '../src/scenes/serpentHost.js';
import { bodyMesh, marksMesh, MESH_STRIDE, FLAT_STRIDE, MESH_MAX_VERTS, FLAT_MAX_VERTS } from '../src/render/serpentRender.js';
import { serpentBarModel, SERPENT_CALL_CSS, STUN_CSS, SOUND_WARN_MS, SERPENT_BAR_TEXT } from '../src/ui/serpentBar.js';
import { SERPENT_SOUNDS, playSerpentSound, SERPENT_VOICE_ROWS } from '../src/systems/serpentSounds.js';
import { ENEMY_NAMES } from '../src/characters/enemyBasics.js';
import { NAVAL_CLASSIC } from '../src/systems/naval/navalSounds.js';
import { rollSerpentSpoils, serpentSpoilsList, serpentSpoilsDay, SERPENT_SPOILS_GOLD_PER_LEVEL, STOOD_GOLD, SERPENT_SPOILS_KEYS } from '../src/systems/serpentSpoils.js';
import { RAID_SPOILS_KEYS } from '../src/systems/raidSpoils.js';
import { paintGateRing } from '../src/ui/inkMap.js';
import { GATE_RING_CSS, readGateMark } from '../src/ui/gateMapMark.js';
import { SERPENT_MAP_INK, SERPENT_RING_MAP_CSS } from '../src/ui/serpentMapMark.js';

const close = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
let DAY = 360;
while (!isSerpentDay(DAY)) DAY++;
const TT = serpentTimes(DAY);

// ═══ WHERE IT RISES ═══════════════════════════════════════════════════════════════════════════════

/** A made sea: ports on map pixels, a straight way between each pair in native units (seaLanes.js's own shape). */
const nativeOf = (px, py) => ({ x: (px + 0.5) * PIXEL_UNITS, z: (499 - py + 0.5) * PIXEL_UNITS });
const port = (name, px, py, region = 17) => ({ name, region, road: { x: px, y: py } });
const laneOf = (key, a, b) => ({ key, a, b });
const wayOf = (lane) => {
  const pts = [nativeOf(lane.a.road.x, lane.a.road.y), nativeOf(lane.b.road.x, lane.b.road.y)];
  return { pts, len: (Math.hypot(pts[1].x - pts[0].x, pts[1].z - pts[0].z) / PIXEL_UNITS) * 819.2 };
};

test('SERPENT1 site: on a packet lane, in its middle stretch, in open sea every way about it - the same site for every client on a day, the nearer port naming it, both ports on its card, its ring rolled about it; a lane too short or a sea closed is no site at all (mutants: the open law skipped; the lane\'s length unasked; the farther port named)', () => {
  const lanes = [
    laneOf('A', port('Sentinel', 100, 300), port('Wayrest', 140, 300)),
    laneOf('B', port('Daggerfall', 60, 200), port('Anticlere', 60, 240)),
    laneOf('C', port('Shornhelm', 200, 100), port('Northpoint', 230, 130)),
  ];
  const open = () => true;
  const s = findSerpentSite(DAY, { lanes, wayOf, open });
  assert.ok(s, 'an open sea and long lanes find a site');
  assert.deepEqual(findSerpentSite(DAY, { lanes, wayOf, open }), s, 'every client the same');
  const lane = lanes.find((l) => l.key === s.lane);
  const [a, b] = [lane.a.road, lane.b.road];
  const along = Math.hypot(s.px - a.x, s.py - a.y) / Math.hypot(b.x - a.x, b.y - a.y);
  assert.ok(along > 0.1 && along < 0.9, `its middle stretch (${along})`);
  assert.deepEqual(sitePixelOfNative(s.sx, s.sz), [s.px, s.py]);
  const da = Math.hypot(s.px - a.x, s.py - a.y), db = Math.hypot(s.px - b.x, s.py - b.y);
  assert.equal(s.near, da <= db ? lane.a.name : lane.b.name, 'the nearer port names it');
  assert.deepEqual(s.between, [lane.a.name, lane.b.name]);
  assert.match(s.place, new RegExp(`^${s.near}, `), 'with its province');
  assert.deepEqual(s.ring, serpentRing(DAY, s.sx, s.sz));
  assert.equal(s.ring.r, SERPENT_RING_PIXELS);
  // the open law: a sea closed all about the site found is passed over - every site found is open SITE_CLEAR_PX round
  const shut = (px, py) => !(Math.abs(px - s.px) <= 3 && Math.abs(py - s.py) <= 3);
  const s2 = findSerpentSite(DAY, { lanes, wayOf, open: shut });
  if (s2) assert.ok(openAround(s2.px, s2.py, shut), 'a site found is open about it');
  assert.equal(findSerpentSite(DAY, { lanes, wayOf, open: () => false }), null, 'no open sea, no site');
  const short = [laneOf('S', port('Ilessan', 10, 10), port('Kambria', 13, 10))];
  assert.ok(wayOf(short[0]).len < SITE_LANE_MIN_M);
  assert.equal(findSerpentSite(DAY, { lanes: short, wayOf, open }), null, 'a lane too short is passed over');
  assert.equal(findSerpentSite(DAY, { lanes: [], wayOf, open }), null);
  // pointAlong: a share of the way's length along it
  const w = { pts: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }] };
  assert.deepEqual(pointAlong(w, 0.75), { x: 10, z: 5 });
  assert.deepEqual(pointAlong(w, 2), { x: 10, z: 10 });
});

// ═══ THE CELL'S WORDS, FOLDED ═══════════════════════════════════════════════════════════════════════

const SX = (205 + 0.5) * PIXEL_UNITS, SZ = (499 - 214 + 0.5) * PIXEL_UNITS;
const CELL = cellRoomOfWire(SX, SZ);
const T0 = TT.riseAt + 20_000;
/** A whole state off the relay's own brain, projected as the wire projects it. */
function brainState(now = T0, extra = {}) {
  const f = newSerpentFight(DAY, now, TT.soundAt, 'sethrakul', SX, SZ, 0);
  joinSerpentFight(f, 'acct-0001', 'Ama', 20, 4, now, true);
  const st = validSerpentOut({ ...serpentStateOf(f), ...extra });
  assert.ok(st, 'the brain\'s state passes the wire');
  return { f, st };
}

test('SERPENT1 link: a word before any whole state is nothing; the state replaces all it names; a swim leg or a depth is kept once and in order; the coil\'s words move the coil they name alone; a kill of another day changes nothing (mutants: a word folded before a state; a leg kept twice; a coil word on another coil)', () => {
  const { st } = brainState();
  assert.equal(foldSerpent(SERPENT_STATE_EMPTY, { k: 'hp', h: 1, m: 2 }, T0), SERPENT_STATE_EMPTY);
  let s = foldSerpent(SERPENT_STATE_EMPTY, st, T0);
  assert.equal(s.day, DAY); assert.equal(s.boss, 'sethrakul'); assert.equal(s.hp, st.h); assert.equal(s.heardAt, T0);
  const leg = { k: 0, at: T0 + 5000, x: 1, z: 2, yw: 0.3, v: 11 };
  const s2 = foldSerpent(s, { k: 'sw', l: leg }, T0 + 1);
  assert.equal(foldSerpent(s2, { k: 'sw', l: { ...leg } }, T0 + 2), s2, 'a leg heard twice is kept once');
  assert.deepEqual(s2.legs.map((l) => l.at), [...s2.legs.map((l) => l.at)].sort((x, y) => x - y));
  let m = s2;
  for (let i = 0; i < MODES_KEPT + 3; i++) m = foldSerpent(m, { k: 'dv', at: T0 + 10_000 + i, m: MODE.breach }, T0);
  assert.equal(m.modes.length, MODES_KEPT, 'the depths kept to MODES_KEPT');
  s = foldSerpent(m, { k: 'coil', i: 3, s: 'acct-0001', x: 0, z: 0, th: 0, at: T0, until: T0 + 24_000, h: 60, m: 60 }, T0);
  assert.equal(foldSerpent(s, { k: 'ch', i: 9, h: 10 }, T0), s, 'a word of another coil');
  s = foldSerpent(s, { k: 'ch', i: 3, h: 10 }, T0);
  assert.equal(s.coil.h, 10);
  const broke = foldSerpent(s, { k: 'cb', i: 3, n: 'Ama', at: T0 + 100, su: T0 + 9100 }, T0 + 100);
  assert.deepEqual([broke.coil.h, broke.coil.off, broke.su, broke.broke.n], [0, T0 + 100, T0 + 9100, 'Ama']);
  assert.equal(foldSerpent(s, { k: 'cr', i: 3, at: T0 + 50 }, T0).crushed, T0 + 50);
  assert.equal(foldSerpent(s, { k: 'fell', d: DAY + 2, at: 9, top: [], n: 0 }, T0), s, 'another day\'s kill');
  const dead = foldSerpent(s, { k: 'fell', at: T0 + 5, top: ['Ama'], n: 1 }, T0 + 5);
  assert.deepEqual([dead.fell.at, dead.hp, dead.atk], [T0 + 5, 0, null]);
  assert.equal(foldSerpent(dead, { k: 'fell', at: T0 + 99, top: [], n: 0 }, T0).fell.at, T0 + 5, 'the first kill holds');
  const st2 = brainState(T0 + 1000).st;
  assert.equal(foldSerpent(broke, st2, T0 + 1000).broke?.n, 'Ama', 'a whole state of the same day keeps who broke the coil');
});

test('SERPENT1 link: a refusal said once until the fight is left; a receipt kept once a day, unsigned or not; the hub\'s kill said once a day; a whole state naming a kill never heard keeps it for the omen, unsaid (mutants: the refusal said every word; a receipt handed twice; the state\'s kill said or lost)', async () => {
  const said = [], fells = [], rcpts = [];
  let now = T0;
  const L = createSerpentLink({ now: () => now, say: (t) => said.push(t), onFell: (d, f) => fells.push([d, f.at]), onReceipt: (r) => rcpts.push(r) });
  L.word({ k: 'no', m: 'too far from its waters' }); L.word({ k: 'no', m: 'too far from its waters' });
  assert.deepEqual(said, [SERPENT_NO_TEXT['too far from its waters']]);
  L.leave(); L.word({ k: 'no', m: 'too far from its waters' });
  assert.equal(said.length, 2, 'said again once the fight is left');
  const r = await mintSerpentReceipt({ d: DAY, b: 'sethrakul', s: 'acct-0001', c: 7, x: 'dealt', h: 4, l: 20 }, null, { nowS: 1_800_000_000 });
  L.word({ k: 'rcpt', r }); L.word({ k: 'rcpt', r });
  assert.deepEqual(rcpts, [r]);
  assert.equal(L.receipt(DAY), r);
  L.word({ k: 'fell', d: DAY, at: T0 + 5, top: ['Ama'], n: 2, sx: SX, sz: SZ }); L.word({ k: 'fell', d: DAY, at: T0 + 5, top: ['Ama'], n: 2, sx: SX, sz: SZ });
  assert.deepEqual(fells, [[DAY, T0 + 5]]);
  assert.equal(L.fellAt(DAY, { sx: SX, sz: SZ }), T0 + 5);
  assert.equal(L.fellAt(DAY, null), null);
  const { st } = brainState(T0, { fell: { at: T0 - 50, top: ['Ama'], n: 1 } });
  const L2 = createSerpentLink({ now: () => now, onFell: (d) => fells.push([d, 'said']) });
  L2.word(st);
  assert.equal(L2.fellAt(DAY, { sx: SX, sz: SZ }), T0 - 50, 'kept for the omen');
  assert.equal(fells.length, 1, 'unsaid');
});

// ═══ ITS BLOWS ON MY SHIP ════════════════════════════════════════════════════════════════════════════

const CARRACK = { x: 0, z: 0, yw: 0, hl: 25, hw: 7, maxHull: 1200, maxSail: 600 };
const ROWBOAT = { x: 0, z: 0, yw: 0, hl: 3, hw: 1, maxHull: 120, maxSail: 0 };

test('SERPENT1 strike: each shape meets a ship by her bow, her middle or her stern, her beam its slack - the lash\'s sector its way alone, the roar\'s rings not its eye, the ram\'s lane only as far as its head has run, the coil her middle in its ring; a blow\'s hurt a share of HER whole and points on top (mutants: the middle alone tested; the ram met down its whole lane at once; the hurt in points alone)', () => {
  const at = 1000;
  const lash = { a: SERPENT_ATTACK_TABLE.lash.id, at, x: 0, z: -40, yw: 0, tg: [[0, -40]] };
  assert.equal(shapeMeets(lash, CARRACK), true, 'ahead of it');
  assert.equal(shapeMeets({ ...lash, yw: Math.PI }, CARRACK), false, 'behind it');
  // a carrack's bow inside a breach's disc her middle is not
  const breach = { a: SERPENT_ATTACK_TABLE.breach.id, at, x: 0, z: 0, yw: 0, tg: [[0, 25 + SERPENT_ATTACK_TABLE.breach.r]] };
  assert.equal(shapeMeets(breach, CARRACK), true, 'her bow');
  assert.equal(shapeMeets(breach, ROWBOAT), false);
  const roar = { a: SERPENT_ATTACK_TABLE.roar.id, at, x: 0, z: 0, yw: 0, tg: [[0, 0]] };
  assert.equal(shapeMeets(roar, ROWBOAT), false, 'the roar\'s eye is quiet');
  assert.equal(shapeMeets(roar, { ...ROWBOAT, z: 60 }), true);
  const ram = { a: SERPENT_ATTACK_TABLE.ram.id, at, x: 0, z: -200, yw: 0, tg: [[0, -200], [0, 100]] };
  assert.equal(shapeMeets(ram, ROWBOAT, at + 1000), false, `its head ${RAM_V} m down the lane`);
  assert.equal(shapeMeets(ram, ROWBOAT, at + Math.ceil((200 / RAM_V) * 1000)), true, 'reached her');
  assert.equal(shapeMeets(ram, { ...ROWBOAT, x: 40 }, at + 9000), false, 'off its lane');
  assert.ok(ramHead(ram, at + 1000)[1] > -200 && ramHead(ram, at + 1000)[1] < -100);
  assert.equal(ramHead(ram, at - 1), null);
  const coil = { a: SERPENT_ATTACK_TABLE.coil.id, at, x: 0, z: 0, yw: 0, tg: [[30, 0]] };
  assert.equal(shapeMeets(coil, CARRACK), true);
  assert.equal(shapeMeets(coil, { ...CARRACK, x: -10 }), false, 'her middle out of it, her bow or no');
  assert.equal(shipPoints(CARRACK).length, 3);
  // the hurt: her whole's share and points on top - alike for a rowboat and a carrack
  const h = shipHurt(SERPENT_ATTACK_TABLE.breach, CARRACK);
  assert.deepEqual(h, { hull: Math.round(0.07 * 1200 + 8), sail: Math.round(0.1 * 600), crew: 2 });   // AUDIT SERPENT T1's numbers
  assert.ok(close(shipHurt(SERPENT_ATTACK_TABLE.breach, ROWBOAT).hull / ROWBOAT.maxHull, (0.07 * 120 + 8) / 120, 0.01));
  assert.deepEqual(crushHurt(CARRACK), shipHurt(CRUSH, CARRACK));
});

test('SERPENT1 strike: the grip and the eye grind by the second with their fractions carried (3.4 a second is 3.4, not 3); the throw away from the blow, across the ram\'s lane, dying in SHOVE_S; the whirl pulls in and round, growing, its eye grinding; the glob flies its arc; the venom bites inside its pool while it lasts (mutants: the carry dropped; the pull outward; the pool forever)', () => {
  let carry, hull = 0, crew = 0;
  for (let i = 0; i < 10; i++) { const g = gripHurt(ROWBOAT, 0.1, carry); carry = g.carry; hull += g.hurt.hull; crew += g.hurt.crew; }
  const perS = GRIP.hull * ROWBOAT.maxHull + GRIP.base;
  assert.ok(Math.abs(hull + carry.hull - perS) < 1e-9, 'the grip\'s whole second');
  assert.ok(Math.abs(crew + carry.crew - GRIP.crew) < 1e-9);
  let gc = 0, gh = 0;
  for (let i = 0; i < 4; i++) { const g = grindHurt(CARRACK, 0.25, gc); gc = g.carry; gh += g.hurt.hull; }
  assert.ok(Math.abs(gh + gc - (MAEL_GRIND.hull * 1200 + MAEL_GRIND.base)) < 1e-9);
  const v = shoveOf({ a: SERPENT_ATTACK_TABLE.breach.id, tg: [[0, -10]] }, CARRACK);
  assert.ok(close(v[0], 0) && close(v[1], SERPENT_ATTACK_TABLE.breach.shove), 'away from it');
  const lane = shoveOf({ a: SERPENT_ATTACK_TABLE.ram.id, tg: [[0, -100], [0, 100]] }, { ...CARRACK, x: 5 });
  assert.ok(close(lane[0], SERPENT_ATTACK_TABLE.ram.shove) && close(lane[1], 0), 'across the ram\'s lane, to her side');
  assert.deepEqual(shoveOf({ a: SERPENT_ATTACK_TABLE.spit.id, tg: [[0, 0]] }, CARRACK), [0, 0], 'no throw in venom');
  assert.deepEqual(shoveLeft([4, 0], SHOVE_S), [0, 0]);
  assert.ok(close(shoveLeft([4, 0], SHOVE_S / 2)[0], 2));
  const mael = { at: 0, x: 0, z: 0 };
  const p = maelPull(mael, 100, 0, MAEL_GROW_MS);
  assert.ok(p.v[0] < 0, 'pulled in');
  assert.ok(Math.abs(p.v[1]) > 0, 'and round');
  assert.equal(p.eye, false);
  assert.ok(maelPull(mael, 100, 0, MAEL_GROW_MS / 2).k < 1, 'growing in');
  assert.deepEqual(maelPull(mael, MAEL_R + 1, 0, MAEL_GROW_MS).v, [0, 0], 'none past its edge');
  assert.equal(maelPull(mael, MAEL_EYE_R - 1, 0, MAEL_GROW_MS).eye, true);
  const spit = { a: SERPENT_ATTACK_TABLE.spit.id, at: 5000, x: 0, z: 0, tg: [[0, 100]] };
  assert.equal(globAt(spit, 5000 - SPIT_FLIGHT_MS - 1), null);
  const mid = globAt(spit, 5000 - SPIT_FLIGHT_MS / 2);
  assert.ok(close(mid[2], 50) && mid[1] > 5, 'over the sea halfway');
  const pool = poolOf(spit);
  assert.equal(poolBites(pool, 0, 100, 5001), true);
  assert.equal(poolBites(pool, 0, 100 + pool.r + 1, 5001), false);
  assert.equal(poolBites(pool, 0, 100, pool.until), false, 'dried');
});

// ═══ THE SIGHTING ═══════════════════════════════════════════════════════════════════════════════════

const SITE = Object.freeze({ day: DAY, px: 205, py: 214, sx: SX, sz: SZ, near: 'Sentinel', place: 'Sentinel, Sentinel', between: ['Sentinel', 'Wayrest'], ring: { cx: 205.5, cy: 214.5, r: SERPENT_RING_PIXELS } });

test('AUDIT SERPENT S1: a kill is its SITE\'s - the hub\'s word of another site\'s serpent is kept for that site alone, never marks this state\'s fight slain, and the omen asks the kill of its own site; a whole state of another site\'s fight is not folded; the cell\'s own kill is its fight\'s site\'s (mutants: the kill by day alone; the state folded whatever its site)', () => {
  const fells = [];
  const OTHER = { sx: SX - 3 * PIXEL_UNITS, sz: SZ };
  const L = createSerpentLink({ now: () => T0, onFell: (d, f, at) => fells.push([d, at.sx]), site: () => SITE });
  const { st } = brainState();
  L.word(st);
  L.word({ k: 'fell', d: DAY, at: T0 + 5, top: [], n: 1, ...OTHER });
  assert.deepEqual(fells, [[DAY, OTHER.sx]], 'heard, with its site');
  assert.equal(L.state().fell, null, 'my serpent lives');
  assert.equal(L.fellAt(DAY, SITE), null);
  assert.equal(L.fellAt(DAY, OTHER), T0 + 5);
  L.word(validSerpentOut({ ...st, sx: OTHER.sx, h: 1 }));
  assert.equal(L.state().sx, SX, 'another site\'s whole state is not mine');
  // AUDIT SERPENT 2 F1: a word of a fight names its site - one of no site, or another site's, is nothing to my fight
  const was = L.state();
  L.word(validSerpentOut({ k: 'hp', h: 1, m: was.max }));
  L.word(validSerpentOut({ k: 'hp', h: 1, m: was.max, ...OTHER }));
  L.word({ k: 'fell', at: T0 + 7, top: ['Ama'], n: 1 });
  assert.equal(L.state(), was, 'neither folded');
  assert.equal(L.fellAt(DAY, SITE), null);
  L.word({ k: 'fell', at: T0 + 9, top: ['Ama'], n: 1, sx: SX, sz: SZ });   // the cell's own word, its site its fight's
  assert.equal(L.fellAt(DAY, SITE), T0 + 9);
  assert.deepEqual(fells.at(-1), [DAY, SX]);
  assert.equal(L.state().fell.at, T0 + 9);
  // the omen asks its own site's
  const asked = [];
  const O = createSerpentOmen({ now: () => TT.sealAt + 1000, site: () => SITE, say: () => {}, fellAt: (d, at) => { asked.push(at); return L.fellAt(d, at); } });
  O.frame();
  assert.equal(asked[0], SITE);
  assert.equal(O.current().phase, 'gone', 'slain at T0 + 9, its throes long over');
});

test('SERPENT1 omen: nothing said before its host is ready and settled; each of its lines said once a day as the clock reaches it - a player arriving late hears the one for where it stands; a serpent slain says no sounding; no site is silence, asked again (mutants: a line said twice; a late arrival told every line; the slain sounding; a missing site cached for the day)', () => {
  let now = TT.omenAt + 1000, ready = false, fell = null, asked = 0, siteOk = false;
  const said = [];
  const O = createSerpentOmen({ now: () => now, site: () => { asked++; return siteOk ? SITE : null; }, say: (t) => said.push(t), localTime: () => '04:00', fellAt: () => fell, ready: () => ready, settleMs: SERPENT_OMEN_SETTLE_MS });
  assert.equal(O.frame(), null);
  ready = true;
  O.frame(); now += SERPENT_OMEN_SETTLE_MS - 1; O.frame();
  assert.equal(said.length, 0, 'settling');
  now += 1;
  O.frame();
  assert.equal(said.length, 0, 'no site, no line');
  const before = asked;
  O.frame();
  assert.equal(asked, before, 'not asked every frame');
  siteOk = true; now += SITE_RETRY_MS;
  O.frame();
  assert.equal(said.length, 1, 'the sighting, once a site is found');
  assert.match(said[0], /Sethrakul/);
  assert.match(said[0], /Sentinel/);
  O.frame(); now += 1000; O.frame();
  assert.equal(said.length, 1, 'once');
  now = TT.riseAt + 1000; O.frame(); now += 60_000; O.frame();
  assert.equal(said.length, 2, 'the rising, once');
  now = TT.sealAt + 1000; O.frame();
  assert.equal(said.length, 3, 'the storm closing');
  assert.equal(O.mapMark().cx, SITE.ring.cx);
  assert.ok(insideSerpentRing(O.mapMark(), 205, 214));
  assert.equal(insideSerpentRing(O.mapMark(), 205 + SERPENT_RING_PIXELS + 2, 214), false);
  assert.equal(O.swimming().site, SITE);
  // a player arriving late
  const late = [];
  const O2 = createSerpentOmen({ now: () => now, site: () => SITE, say: (t) => late.push(t), localTime: () => '04:00' });
  O2.frame();
  assert.equal(late.length, 1, 'only where it stands');
  assert.equal(late[0], said[2]);
  // slain: its ring says so while it dies, and it sounds no more
  fell = TT.sealAt + 2000;
  now = fell + 1000; O.frame();
  assert.match(O.mapMark()?.label ?? '', /slain/);
  now = TT.soundAt + 1000; O.frame();
  assert.equal(said.length, 3, 'a slain serpent sounds no more');
  assert.equal(O.mapMark(), null, 'gone');
});

// ═══ THE HOST, END TO END AGAINST THE BRAIN ═══════════════════════════════════════════════════════════

/** The scene's frame is the site's moved (1000, 2000) - a floating origin. */
const OFF = [1000, 2000];
function rig({ shipAt = [60, 0], acct = 'acct-0001' } = {}) {
  let now = T0;
  const sent = [], strikes = [], sounds = [], fx = [], mids = [], says = [], hurts = [];
  const link = createSerpentLink({ now: () => now, site: () => SITE });
  const sw = { day: DAY, site: { sx: SX, sz: SZ }, phase: 'hunt', t: TT };
  const boat = { id: 'mine' };
  const ship = { at: [...shipAt], yaw: 0, atHelm: true, none: false, wrecked: false };
  const host = createSerpentHost({
    now: () => now, link, omen: { swimming: () => sw },
    online: { ready: (cell) => cell === CELL, send: (w, cell) => { sent.push({ ...w, cell }); return true; }, acct: () => acct },
    toScene: (sx, sz, x, z) => [x + OFF[0], z + OFF[1]],
    toSite: (sx, sz, x, z) => [x - OFF[0], z - OFF[1]],
    seaY: () => 0,
    feet: () => [ship.at[0] + OFF[0], 1, ship.at[1] + OFF[1]],
    level: () => 20,
    boat: () => (ship.none ? null : { boat, hull: 4, root: [ship.at[0] + OFF[0], ship.at[1] + OFF[1]], pos: [ship.at[0] + OFF[0], 0, ship.at[1] + OFF[1]], yaw: ship.yaw, hl: 25, hw: 7, maxHull: 1200, maxSail: 600, atHelm: ship.atHelm, wrecked: ship.wrecked }),
    strike: (b, hurt, o) => strikes.push({ b, hurt, o }),
    maxHealth: () => 100, hurt: (n, el) => hurts.push([n, el]),   // PIN MOVED (AUDIT 2 XC4): the bite in points
    say: (t) => says.push(t), mid: (t) => mids.push(t), sound: (k, p) => sounds.push([k, p]), fx: (k, p) => fx.push([k, p]),
  });
  // the cell's word as the relay fans it - its fight's site stamped on it (AUDIT SERPENT 2 F1)
  const hear = (w) => { const v = validSerpentOut(w.k === 'no' || w.k === 'rcpt' || w.sx !== undefined ? w : { ...w, sx: SX, sz: SZ }); assert.ok(v, `the wire passes ${w.k}`); link.word(v); };
  return { host, link, sent, strikes, sounds, fx, mids, says, hurts, boat, ship, hear, sw, at: () => now, step: (ms) => { now += ms; return host.frame(); } };
}

test('SERPENT1 host: the `in` said within sight of its waters to the CELL of its site - its day, its law, my level and my own ship\'s hull (AUDIT SERPENT B4/H2: at her helm or on her deck), the site - soon again while unanswered, seldom once answered; nothing past ADMIT_R (mutants: said every frame; said to my own cell; the hull said aboard no ship of mine; the hull said at the helm alone)', () => {
  const R = rig();
  assert.equal(R.host.frame(), false, 'no state yet');
  assert.deepEqual(R.sent, [{ k: 'in', d: DAY, bv: SERPENT_BRAIN_V, lv: 20, hl: 4, sx: SX, sz: SZ, cell: CELL }]);
  R.step(IN_RETRY_MS - 1);
  assert.equal(R.sent.length, 1);
  R.step(1);
  assert.equal(R.sent.length, 2, 'again, unanswered');
  R.hear(brainState(R.at()).st);
  assert.equal(R.step(10), true, 'the fight is on this screen');
  R.step(IN_RETRY_MS);
  assert.equal(R.sent.filter((w) => w.k === 'in').length, 2, 'answered - not soon again');
  R.step(IN_RESEND_MS);
  assert.equal(R.sent.filter((w) => w.k === 'in').length, 3, 'again after IN_RESEND_MS');
  const far = rig({ shipAt: [ADMIT_R + 10, 0] });
  far.host.frame();
  assert.equal(far.sent.length, 0, 'too far to say it');
  const deck = rig();
  deck.ship.atHelm = false;
  deck.host.frame();
  assert.equal(deck.sent[0].hl, 4, 'on her deck, away from her helm');
  const aboard = rig();
  aboard.ship.none = true;
  aboard.host.frame();
  assert.equal(aboard.sent[0].hl, -1, 'aboard another\'s ship');
});

test('SERPENT1 host: its exposed segments are the shots\' targets in the scene (none slain); my balls on it gathered HIT_GATHER_MS into one word a zone; a blow landing on my ship is struck once with her hurt and a throw her drift carries; a miss is nothing; its landings play for everyone (mutants: every ball a word; a blow struck twice; the drift unscaled)', () => {
  const R = rig();
  R.host.frame();
  R.hear(brainState(R.at()).st);
  R.step(3000);   // risen
  const targets = R.host.targets();
  assert.ok(targets.length > 0 && targets.length <= SEG_N);
  for (const t of targets) {
    assert.ok(t.id.startsWith(SERPENT_TARGET));
    assert.equal(segmentOfTarget(t.id), Number(t.id.slice(SERPENT_TARGET.length)));
    assert.ok(t.box.c.every(Number.isFinite));
  }
  assert.equal(segmentOfTarget('ship:3'), null);
  const seg = segmentOfTarget(targets[targets.length - 1].id);
  R.host.struck(seg, 30); R.host.struck(seg, 12.5);
  R.step(HIT_GATHER_MS - 1);
  assert.equal(R.sent.filter((w) => w.k === 'hit').length, 0, 'gathered');
  R.step(1);
  assert.deepEqual(R.sent.filter((w) => w.k === 'hit').map((w) => [w.d, w.z, w.cell]), [[42.5, ZONES.body, CELL]]);
  // a Rising Maw under my ship
  const at = R.at() + 2000;
  R.hear({ k: 'atk', i: 7, a: SERPENT_ATTACK_TABLE.breach.id, at, x: 0, z: 0, yw: 0, tg: [[50, 0]] });   // under her, a little astern of her middle
  R.step(10);
  assert.equal(R.strikes.length, 0, 'wound up, not landed');
  assert.equal(R.host.bar().atk.aimed, true, 'MOVE - it is laid on my ship');
  R.step(2000);
  assert.equal(R.strikes.length, 1);
  assert.deepEqual(R.strikes[0].hurt, shipHurt(SERPENT_ATTACK_TABLE.breach, { maxHull: 1200, maxSail: 600 }));
  assert.equal(R.strikes[0].b, R.boat);
  assert.ok(R.fx.some(([k]) => k === 'breach') && R.sounds.some(([k]) => k === 'breach'));
  R.step(250);
  assert.equal(R.strikes.length, 1, 'struck once');
  const d = R.host.drift(R.boat);
  assert.ok(d && d[0] > 0 && d[1] === 0, 'thrown off it');
  assert.equal(R.host.drift({ id: 'another' }), null, 'only my boat');
  // a miss
  R.hear({ k: 'atk', i: 8, a: SERPENT_ATTACK_TABLE.breach.id, at: R.at() + 500, x: 0, z: 0, yw: 0, tg: [[-300, 0]] });
  R.step(1000);
  assert.equal(R.strikes.length, 1);
});

test('SERPENT1 host: THE COIL on my ship - inside its ring at the landing she is held (`held`, her place kept by the warp seam, gripped each second) until its word lets her go, a coil whose end is never heard lets her go COIL_LOST_MS past it, and one whose word never comes COIL_WORD_WAIT_MS after; out of it she slipped (`esc`); leaving forgets it all (mutants: held with no word; held for ever; the grip never struck)', () => {
  const R = rig();
  R.host.frame();
  R.hear(brainState(R.at()).st);
  const at = R.at() + 1000;
  R.hear({ k: 'atk', i: 9, a: SERPENT_ATTACK_TABLE.coil.id, at, x: 0, z: 0, yw: 0, tg: [[60, 0]], s: 'acct-0001' });
  R.step(1100);
  assert.deepEqual(R.sent.filter((w) => w.k === 'held').map((w) => [w.i, w.x, w.z]), [[9, 60, 0]]);
  assert.equal(R.host.held, true);
  const hold = R.host.hold(R.boat);
  assert.deepEqual(hold, { pos: [60 + OFF[0], OFF[1]], yaw: 0 });
  assert.equal(R.host.hold({ id: 'another' }), null);
  assert.equal(R.host.drift(R.boat), null, 'held, no drift');
  R.hear({ k: 'coil', i: 9, s: 'acct-0001', x: 60, z: 0, th: 0, at, until: at + 24_000, h: 60, m: 60 });
  R.step(1000); R.step(1000);
  assert.ok(R.strikes.some((s) => s.hurt.hull > 0), 'gripped');
  R.hear({ k: 'cb', i: 9, n: 'Ama', at: R.at(), su: R.at() + 9000 });
  R.step(10);
  assert.equal(R.host.held, false, 'its grip broken');
  assert.equal(R.host.hold(R.boat), null);
  assert.ok(R.says.some((t) => /breaks the coil/.test(t)));
  // a coil whose end is lost
  const at2 = R.at() + 1000;
  R.hear({ k: 'atk', i: 10, a: SERPENT_ATTACK_TABLE.coil.id, at: at2, x: 0, z: 0, yw: 0, tg: [[60, 0]], s: 'acct-0001' });
  R.step(1100);
  R.hear({ k: 'coil', i: 10, s: 'acct-0001', x: 60, z: 0, th: 0, at: at2, until: at2 + 24_000, h: 60, m: 60 });
  R.step(10);
  assert.equal(R.host.held, true);
  while (R.at() + 5000 < at2 + 24_000 + COIL_LOST_MS) { R.step(5000); R.hear({ k: 'hp', h: 50, m: 60 }); }   // the fight goes on - only the coil's end is lost
  R.step(at2 + 24_000 + COIL_LOST_MS - R.at());
  assert.equal(R.host.held, true, 'still held through COIL_LOST_MS past its end');
  R.step(1);
  assert.equal(R.host.held, false, 'let go');
  // slipped
  const S = rig();
  S.host.frame();
  S.hear(brainState(S.at()).st);
  S.hear({ k: 'atk', i: 11, a: SERPENT_ATTACK_TABLE.coil.id, at: S.at() + 500, x: 0, z: 0, yw: 0, tg: [[-200, 0]], s: 'acct-0001' });
  S.step(600);
  assert.deepEqual(S.sent.filter((w) => w.k === 'esc').map((w) => w.i), [11]);
  assert.equal(S.host.held, false);
  // another's coil is no word of mine
  const O = rig({ acct: 'acct-0002' });
  O.host.frame();
  O.hear(brainState(O.at()).st);
  O.hear({ k: 'atk', i: 12, a: SERPENT_ATTACK_TABLE.coil.id, at: O.at() + 500, x: 0, z: 0, yw: 0, tg: [[60, 0]], s: 'acct-0001' });
  O.step(600);
  assert.equal(O.sent.filter((w) => w.k === 'held' || w.k === 'esc').length, 0);
  // held on her own judgement, and the relay never wound it: let go once its word is overdue
  const W = rig();
  W.host.frame();
  W.hear(brainState(W.at()).st);
  W.hear({ k: 'atk', i: 14, a: SERPENT_ATTACK_TABLE.coil.id, at: W.at() + 500, x: 0, z: 0, yw: 0, tg: [[60, 0]], s: 'acct-0001' });
  W.step(600);
  assert.equal(W.host.held, true, 'held before its word comes');
  W.step(COIL_WORD_WAIT_MS);
  assert.equal(W.host.held, true);
  W.step(1);
  assert.equal(W.host.held, false, 'its word never came');
  // leaving
  const Lv = rig();
  Lv.host.frame();
  Lv.hear(brainState(Lv.at()).st);
  Lv.hear({ k: 'atk', i: 13, a: SERPENT_ATTACK_TABLE.coil.id, at: Lv.at() + 500, x: 0, z: 0, yw: 0, tg: [[60, 0]], s: 'acct-0001' });
  Lv.step(600);
  assert.equal(Lv.host.held, true);
  Lv.host.leave();
  assert.equal(Lv.host.held, false);
  assert.equal(Lv.link.state().day, null);
});

test('SERPENT1 host: the whirl pulls my ship toward its heart and round; the venom bites my own body in its pool; the bar and the draw frame read the fight - its name, its health, its phase, the attack in flight, the body over the sea in the scene, its telegraph (mutants: the whirl ignored; the venom never biting; the body in the site\'s frame)', () => {
  const R = rig();
  R.host.frame();
  R.hear(brainState(R.at()).st);
  R.hear({ k: 'mael', at: R.at() - MAEL_GROW_MS, x: 0, z: 0 });
  R.step(10);
  const d = R.host.drift(R.boat);
  assert.ok(d && d[0] < 0, 'pulled in toward the eye');
  R.ship.at = [5, 0];
  R.step(1000);
  assert.ok(R.strikes.some((s) => /eye/.test(s.o?.line ?? '')), 'its eye grinds her');
  // the venom
  R.ship.at = [60, 0];
  const at = R.at() + 300;
  R.hear({ k: 'atk', i: 20, a: SERPENT_ATTACK_TABLE.spit.id, at, x: 0, z: 0, yw: 0, tg: [[60, 0]] });
  R.step(400); R.step(1000);
  assert.ok(R.hurts.length >= 1 && R.hurts[0][1] === 'poison' && R.hurts[0][0] >= 1, 'it bit');
  const bar = R.host.bar();
  assert.equal(bar.name, 'Sethrakul');
  assert.equal(bar.phase, 1);
  assert.ok(bar.max > 0 && bar.hp === bar.max);
  const f = R.host.drawFrame();
  assert.equal(f.points.length, SEG_N + 1);
  const st = R.link.state();
  assert.ok(Math.hypot(f.points[0].x - OFF[0], f.points[0].z - OFF[1]) < 1000, 'in the scene');
  assert.ok(f.points.every((p) => [p.x, p.y, p.z, p.r].every(Number.isFinite)));
  assert.equal(st.day, DAY);
  R.hear({ k: 'atk', i: 21, a: SERPENT_ATTACK_TABLE.lash.id, at: R.at() + 2000, x: 0, z: 0, yw: 0, tg: [[0, 40]] });
  R.step(10); R.step(500);   // first drawn, then half a second into its wind-up
  const f2 = R.host.drawFrame();
  assert.equal(f2.tele.length, 1);
  assert.equal(f2.tele[0].shape, 'sector');
  assert.deepEqual(f2.tele[0].c, [OFF[0], 40 + OFF[1]]);
  assert.ok(f2.tele[0].k > 0 && f2.tele[0].k < 1);
  // the renderer's pure builders over it
  const mesh = new Float32Array(MESH_MAX_VERTS * MESH_STRIDE), flat = new Float32Array(FLAT_MAX_VERTS * FLAT_STRIDE);
  const n = bodyMesh(f2, mesh);
  assert.ok(n > 0 && n % 3 === 0 && n <= MESH_MAX_VERTS);
  assert.ok(mesh.subarray(0, n * MESH_STRIDE).every(Number.isFinite));
  const m = marksMesh(f2, flat);
  assert.ok(m > 0 && m % 3 === 0);
  assert.ok(flat.subarray(0, m * FLAT_STRIDE).every(Number.isFinite));
  assert.equal(marksMesh({ ...f2, tele: [], mael: null, venom: [], glob: null, coil: null }, flat) < m, true, 'the telegraph drew');
});

// ═══ THE BAR, ITS VOICE, ITS HOARD, ITS RING ════════════════════════════════════════════════════════

test('SERPENT1 bar: the gate\'s bar in the sea\'s colours - its health, the attack named in its colour (MOVE when on my ship), the stun before it, the coil\'s health, the ships, the sounding\'s countdown inside SOUND_WARN_MS alone; its fall holds then fades (mutants: the stun under the attack; the countdown always; no fade)', () => {
  const b = { name: 'Sethrakul', title: 'the Shed-Skin of Satakal', hp: 300, max: 1200, phase: 2, phaseName: 'The Coil', fighters: 3, warded: false, stunned: false, stunLeft: 0, coil: { h: 20, m: 60, mine: true }, countdown: null, soundIn: SOUND_WARN_MS + 1, fell: null, gone: null, opening: false, atk: { key: 'ram', name: 'Breaching Ram', t: 0.5, aimed: true }, now: 5000 };
  const m = serpentBarModel(b);
  assert.equal(m.theme, 'sea');
  assert.equal(m.frac, 0.25);
  assert.deepEqual(m.callout, { text: 'Breaching Ram', color: SERPENT_CALL_CSS.ram, t: 0.5, dagon: false, move: true });
  assert.equal(m.wrath, null);
  assert.equal(m.fightersLine, SERPENT_BAR_TEXT.ships(3));
  assert.equal(m.reckonIn, SERPENT_BAR_TEXT.coil(20, 60, true));
  assert.match(m.host, /The Coil/);
  const st = serpentBarModel({ ...b, stunned: true, stunLeft: 4200 });
  assert.equal(st.callout.color, STUN_CSS);
  assert.match(st.callout.text, /! 5s$/, 'AUDIT SERPENT (words): its seconds said as seconds');
  assert.ok(serpentBarModel({ ...b, soundIn: 30_000 }).wrathNear);
  assert.equal(serpentBarModel({ ...b, soundIn: SOUND_WARN_MS }).wrath, 'It dives in 5m 00s');
  const fell = { ...b, fell: { at: 1000 } };
  assert.equal(serpentBarModel(fell, 1500).alpha, 1);
  assert.equal(serpentBarModel(fell, 100_000).alpha, 0);
  assert.equal(serpentBarModel(null), null);
});

test('SERPENT1 voice: DAGGER.SND\'s own records, never a new clip - the Dreugh\'s bark pitched down for its roar and its death, the Lamia\'s hiss, the sea\'s splashes and bubbles - heard further than a gun; a key it has not is silence (mutants: a row moved; a cue unpitched; an unknown key played)', () => {
  assert.equal(ENEMY_NAMES[SERPENT_VOICE_ROWS.dreugh], 'Dreugh');
  assert.equal(ENEMY_NAMES[SERPENT_VOICE_ROWS.lamia], 'Lamia');
  assert.equal(SERPENT_SOUNDS.breach.clip, NAVAL_CLASSIC.splashLarge);
  for (const [k, c] of Object.entries(SERPENT_SOUNDS)) {
    assert.ok(Number.isInteger(c.clip) && c.clip > 0, k);
    assert.ok(c.pitch > 0 && c.pitch < 1, `${k} pitched down`);
    assert.ok(c.maxDistance >= 700 && c.refDistance > 0, k);
  }
  assert.ok(SERPENT_SOUNDS.death.maxDistance > SERPENT_SOUNDS.roar.maxDistance && SERPENT_SOUNDS.roar.maxDistance > 2400);
  const played = [];
  const audio = { play3d: (clip, pos, vol, o) => played.push({ clip, pos, vol, o }) };
  assert.equal(playSerpentSound(audio, 'roar', [1, 2, 3], 0.5), true);
  assert.deepEqual(played[0], { clip: SERPENT_SOUNDS.roar.clip, pos: [1, 2, 3], vol: SERPENT_SOUNDS.roar.volume * 0.5, o: { refDistance: SERPENT_SOUNDS.roar.refDistance, maxDistance: SERPENT_SOUNDS.roar.maxDistance, pitch: SERPENT_SOUNDS.roar.pitch } });
  assert.equal(playSerpentSound(audio, 'hum', [0, 0, 0]), false);
  assert.equal(playSerpentSound(null, 'roar', [0, 0, 0]), false);
  assert.equal(played.length, 1);
});

test('SERPENT1 hoard: the seed\'s own - the same seed, level and earning the same hoard; a ship that dealt has a Rare-or-better piece and a Magic-or-better, one that stood the second alone and STOOD_GOLD of the gold; its own spoils keys, never a raid\'s (mutants: the earning ignored; the gold unscaled; the keys shared)', () => {
  const a = rollSerpentSpoils(12345, 20, 'dealt'), b = rollSerpentSpoils(12345, 20, 'dealt');
  assert.deepEqual(a, b);
  // PIN MOVED (CAST-SPEED): the castSpeed line is a Weapons' and Jewellery's proc kind, so this seed's dai-katana draws
  // it at the last pass and the Coilscale roll after it reads a moved stream - and lands: the set piece third
  assert.equal(a.pieces.length, 3);
  assert.ok(['rare', 'legendary', 'exalted'].includes(a.pieces[0].tier), a.pieces[0].tier);
  assert.equal(a.pieces[2].tier, 'aetheric', 'SERPENT-SET\'s Coilscale piece, last');
  assert.ok(a.pieces.every((p) => p.item.isIdentified));
  assert.ok(a.gold >= 0.8 * SERPENT_SPOILS_GOLD_PER_LEVEL * 20 && a.gold <= 1.2 * SERPENT_SPOILS_GOLD_PER_LEVEL * 20);
  const s = rollSerpentSpoils(12345, 20, 'stood');
  assert.equal(s.pieces.length, 1);
  assert.ok(Math.abs(s.gold - a.gold * STOOD_GOLD) <= 1, 'the same seed\'s gold, its share');
  const list = serpentSpoilsList(12345, 20, 'dealt');
  assert.deepEqual(list.map((p) => p.kind), ['item', 'item', 'item', 'item', 'item', 'gold']);   // PIN MOVED (SERPENT-SET): the gate's embers between the pieces and the gold; PIN MOVED (CAST-SPEED): three pieces before them; PIN MOVED (GEM2): the Old Coil's gem after the pieces, a dealer's
  assert.equal(a.gems.length, 1); assert.equal(s.gems.length, 0, 'a ship that stood: no gem');
  assert.equal(serpentSpoilsDay(DAY), `serpent:${DAY}`);
  assert.notEqual(SERPENT_SPOILS_KEYS.store, RAID_SPOILS_KEYS.store);
  assert.notEqual(SERPENT_SPOILS_KEYS.day, RAID_SPOILS_KEYS.day);
});

test('SERPENT1 ring: the held map reads its mark by the gate\'s reader and paints it by the gate\'s painter in the sea\'s colours; the gate\'s ring keeps its own (mutants: the ink ignored; the gate repainted)', () => {
  const ops = [];
  const pen = () => new Proxy({}, {
    get: (o, k) => (k in o ? o[k] : typeof k === 'string' && /^(save|restore|setLineDash|beginPath|arc|fill|stroke|strokeText|fillText)$/.test(k) ? (...a) => ops.push([k, o.fillStyle, o.strokeStyle, ...a]) : undefined),
    set: (o, k, v) => { o[k] = v; return true; },
  });
  let ctx = pen();
  const view = { ox: 0, oy: 0, scale: 4 };
  const mark = readGateMark(() => ({ day: DAY, cx: 10, cy: 10, r: 3, label: 'Sethrakul', phase: 'hunt' }), { width: 1000, height: 500 });
  paintGateRing(ctx, view, mark, 0, SERPENT_MAP_INK);
  assert.ok(ops.some(([k, , stroke]) => k === 'stroke' && stroke === SERPENT_RING_MAP_CSS));
  assert.ok(ops.some(([k, fill]) => k === 'fillText' && fill === SERPENT_RING_MAP_CSS));
  ops.length = 0;
  ctx = pen();
  paintGateRing(ctx, view, mark, 0);
  assert.ok(ops.some(([k, , stroke]) => k === 'stroke' && stroke === GATE_RING_CSS));
  assert.ok(!ops.some(([, f, s]) => f === SERPENT_RING_MAP_CSS || s === SERPENT_RING_MAP_CSS));
});

// ═══ THE FOUR HOSTS ═════════════════════════════════════════════════════════════════════════════════

test('SERPENT1 hosts: THE WORLD HOST wires it whole - the naval host\'s seam read at a frame, Come Sail Away\'s drift beside its warp, the cell\'s and the hub\'s words to the link, its frame in the online frame and away from it, its body before the sea and its marks after, the held map\'s ring and the compass; the other three hosts are named and carry none of it (THE FOUR HOSTS RULE - by design) (mutants: a seam unwired; a host importing it)', () => {
  const src = (f) => readFileSync(new URL(`../src/scenes/${f}`, import.meta.url), 'utf8');
  const world = src('world.js');
  for (const pin of [
    'get serpent() { return serpentHost; }',
    'drift: (boat) => naval?.drift?.(boat) ?? null',
    "online.onSerpent = (w) => { if (w?.k === 'bd') serpentHost?.wrecked?.(w); else serpentLink?.word(w); };",   // PIN MOVED (INT13): the count's wreck heard beside the link
    'link.onSerpent = (w) => serpentLink?.word(w);',
    'serpentFrame();   // SERPENT1',
    'serpentAway(!onlineOn);',
    'serpent: () => serpentOmen?.mapMark() ?? null',
    'serpent: serpentCompassMark()',
    'onReceipt: (r) => { const c = readSerpentReceipt(r); serpentClaims?.add(',
    'onSpoils: (entry) => grantSerpentSpoils(entry)',
  ]) assert.ok(world.includes(pin), pin);
  const body = world.indexOf('serpentRenderer()?.drawBody(_serpentDraw)'), csa = world.indexOf('if (csaOn()) csa.draw(renderer);   // CSA-B');
  const sea = world.indexOf('serpentRenderer()?.drawSea(_serpentDraw)'), naval = world.indexOf('if (naval?.enabled) navalRender.draw(naval.drawFrame());');
  assert.ok(csa > 0 && body > csa && body - csa < 600, 'the body with the opaque world, after the boats');
  assert.ok(naval > 0 && sea > naval && sea - naval < 400, 'the marks over the sea');
  assert.ok(/THE FOUR HOSTS RULE: THIS host \(scenes\/world\.js\) wires it whole\. scenes\/exterior\.js[\s\S]{0,200}scenes\/worldModes\.js[\s\S]{0,200}scenes\/dungeonContext\.js[\s\S]{0,200}named and left without it/.test(world), 'all four named');
  for (const other of ['exterior.js', 'worldModes.js', 'dungeonContext.js']) assert.ok(!/serpent/i.test(src(other)), `${other} carries no serpent`);
  const naval2 = src('navalHost.js');
  assert.ok(naval2.includes('drift: (boat) => (enabled ? deps.serpent?.drift?.(boat) ?? null : null)'));
  assert.ok(naval2.includes('for (const t of deps.serpent?.targets?.() ?? []) out.push(t);'));
  const csaSrc = readFileSync(new URL('../src/systems/comeSailAway.js', import.meta.url), 'utf8');
  assert.ok(csaSrc.includes('drift ? vAdd(state.currentVector, drift) : state.currentVector'));
});
