// AUDIT-STOREFRONT II, lanes B and D (2026-10-29; bible/06-Systems/Battle-Pass.md section 9): the season in the world read
// cold a second time, on the real foe pool and camp law (test/scenes/seasonRig.mjs). A Colossus's fall is read once,
// whatever makes its fissure's record again (B1, D1); a Maul is kept on the device until a save holding it lands, and
// asked again by its own id at the next stand-up (D2); the map's cards are made once while nothing on them moves (D3);
// the camp stands clear of the fissure's wreckage, the Colossus past the crack's end (D4).
// tools/mutants/storefront_audit2_season.json.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CURB_SHARE, WARD_SHARE } from '../../src/systems/bossTraits.js';   // the most blows a camp's foe can take
import { client, settle, HEART_T, memStorage, S1, SCAN } from './seasonRig.mjs';
import { createSeasonHost, SEASON_MAUL_HELD_STORE, SEASON_MAUL_REASK_MS, SEASON_MAUL_ASKS, SEASON_RING_M } from '../../src/scenes/seasonHost.js';
import { setRealmSaveSink, realmSaveSink } from '../../src/scenes/shared.js';
import { COLOSSUS_TEXT, FISSURE_TEXT } from '../../src/systems/pass/seasonWords.js';
import { RESONANT_MAUL } from '../../src/systems/pass/resonantMaul.js';
import { stageFissures, fissureUnderGate, fissureRoster, COLOSSUS_MOBILE } from '../../src/systems/pass/seasonWorld.js';
import { buildFissureModel, fissureStands, fissureLayout, FISSURE_STAND_CLEAR, FISSURE_LEN } from '../../src/world/fissureModel.js';
import { findGateSite } from '../../src/systems/gate/gateSite.js';
import { gateAt } from '../../src/net/gate/gateLaw.js';
import { readFissureMarksIn, fissureMarksKey } from '../../src/ui/fissureMapMark.js';
import { raidMarksKey } from '../../src/ui/eventMapMarks.js';
import { setLocale, currentLocale } from '../../src/systems/textManager.js';

let realNow;
test.before(() => { realNow = Date.now; });
test.afterEach(() => { Date.now = realNow; });
const clocked = (clock) => { Date.now = () => clock.t; return clock; };
const DAY_MS = 86_400_000;
const falls = (c) => c.said.filter((s) => s === COLOSSUS_TEXT.falls()).length;
const heldOf = (store) => JSON.parse(store.getItem(SEASON_MAUL_HELD_STORE) ?? '{}');
/** The most blows a foe can take of one that would kill it outright (bossTraits.js): its ward and then its health, each
 *  at CURB_SHARE a blow - a construct may be the street's elite, curbing or warded (CI found four too few). */
const MOST_BLOWS = Math.ceil((1 + WARD_SHARE) / CURB_SHARE) + 1;
/** Every live foe of the camp killed by its owner's blows - the Colossus's ward first, then its health. */
async function clear(c) {
  for (let i = 0; i < MOST_BLOWS && c.own().length; i++) { for (const x of c.own()) c.kill(x); await settle(); }
  assert.equal(c.own().length, 0, 'the camp cleared');
  await c.beat(); await settle();
}

test('AUDIT-STOREFRONT II (lane B 1, D 1): one fall is read once, whatever makes its fissure\'s record again - the relay\'s clock lost a moment, a walk off and back, a new UTC day: one line, one ask, one Maul (mutants: the fall kept on the fissure\'s record)', async () => {
  const clock = clocked({ t: HEART_T });
  const A = client('aaaa-0001', { clock });
  A.at(30); await A.beat(); await clear(A);
  assert.deepEqual([falls(A), A.service.asks.length, A.taken.length], [1, 1, 1]);
  A.heard = false; await A.beat(); A.heard = true; await A.beat(); await settle();   // every fissure let go and made again
  A.at(5000); await A.beat(); A.at(30); await A.beat(); await settle();   // walked past the build and back
  clock.t += DAY_MS;   // past midnight: the service's day is a new one
  A.heard = false; await A.beat(); A.heard = true; await A.beat(); await settle();
  assert.ok(A.mine().some((x) => x.site === A.f.hSite && x.dead && x.corpse), 'its body lies there still');
  assert.deepEqual([falls(A), A.service.asks.length, A.taken.length], [1, 1, 1], 'its one body read once: no second line, no second Maul');
});

// ── D2: the Maul held until a save holds it ──────────────────────────────────────────────────────────────────────────

test('AUDIT-STOREFRONT II (lane D 2): a Maul whose page went before a save held it is kept on the device and asked again by its own id at the next stand-up - past the stage too - and let go when a save made after it lands; a checkpoint asked at the mint (mutants: the record never kept; the id not the piece\'s; the stand-up asking nothing; asked behind the season\'s gate; a landing that lets nothing go; no checkpoint asked)', async () => {
  const clock = clocked({ t: HEART_T });
  const store = memStorage(), service = { days: new Set(), asks: [], down: false };
  const A = client('aaaa-0001', { clock, storage: store, service });
  A.at(30); await A.beat(); await clear(A);
  assert.equal(A.taken.length, 1);
  const [rid] = service.asks;
  assert.equal(A.taken[0].uid, rid, 'the piece\'s ledger id is its claim\'s');
  assert.deepEqual(Object.keys(heldOf(store)), [rid], 'held on the device from its mint');
  assert.equal(heldOf(store)[rid].who, 'aaaa-0001|char');
  assert.equal(A.asked, 1, 'a checkpoint asked at the mint, not left to the period');
  A.realmSave({ ok: false, error: 'offline' });
  assert.deepEqual(Object.keys(heldOf(store)), [rid], 'a save that did not land lets nothing go');
  // the page goes; the save the next boot plays never held it - and the season is over by then
  const A2 = client('aaaa-0001', { clock, storage: store, service });
  clock.t = S1.toMs + 3_600_000;
  A2.at(30); await A2.beat(); await settle();
  assert.deepEqual(service.asks, [rid, rid], 'asked again by the id it kept');
  assert.deepEqual(A2.taken.map((m) => [m.legendary, m.uid]), [[RESONANT_MAUL.id, rid]], 'the Maul given back, its id its claim\'s');
  assert.deepEqual(Object.keys(heldOf(store)), [rid], 'held until a save holds it');
  A2.realmSave({ ok: true });
  assert.deepEqual(heldOf(store), {}, 'the save landed: let go');
  const A3 = client('aaaa-0001', { clock: { t: HEART_T }, storage: store, service });
  A3.at(30); await A3.beat(); await settle();
  assert.equal(service.asks.length, 2, 'nothing held: nothing asked');
});

test('AUDIT-STOREFRONT II (lane D 2): a held Maul the boot\'s save already holds - a save that landed with its answer lost - is let go at the stand-up and never asked again; another character\'s is left for it (mutants: the save\'s pack unread)', async () => {
  const clock = clocked({ t: HEART_T });
  const store = memStorage(), service = { days: new Set(), asks: [], down: false };
  const B = client('bbbb-0002', { clock, storage: store, service });
  B.at(30); await B.beat(); await clear(B);
  const [rid] = service.asks;
  const other = client('bbbb-0002', { clock, storage: store, service, who: 'bbbb-0002|heir' });
  other.at(30); await other.beat(); await settle();
  assert.deepEqual([service.asks.length, Object.keys(heldOf(store))], [1, [rid]], 'another character of the device asks nothing of it');
  const B2 = client('bbbb-0002', { clock, storage: store, service, entity: { items: [...B.entity.items] } });
  B2.at(30); await B2.beat(); await settle();
  assert.deepEqual([service.asks.length, B2.taken.length], [1, 0], 'the save holds it: never asked again');
  assert.deepEqual(heldOf(store), {}, 'let go');
});

test('AUDIT-STOREFRONT II (lane D 2): only a save made after the mint lets it go - a realm checkpoint handed before it and answered after holds nothing of it; a slot of the character written does, another\'s does not; a load in the session stands the character up again, so a Maul its pack lost is asked again; an owed one with no answer is asked again SEASON_MAUL_REASK_MS on (mutants: a checkpoint handed before the mint lets it go; a slot save unheard; any character\'s slot; the load unheard; never asked again)', async () => {
  const clock = clocked({ t: HEART_T });
  const store = memStorage(), service = { days: new Set(), asks: [], down: false };
  const C = client('cccc-0003', { clock, storage: store, service });
  C.at(30); await C.beat();
  const handed = C.realmPut();   // a checkpoint handed before the Maul came, its answer still out
  await clear(C);
  assert.equal(C.taken.length, 1);
  handed({ ok: true });
  assert.equal(Object.keys(heldOf(store)).length, 1, 'a save handed before the mint holds nothing of it');
  C.slotSave('heir');
  assert.equal(Object.keys(heldOf(store)).length, 1, 'another character\'s slot');
  C.entity.items.length = 0; C.slotLoad('char');   // a load in the session: the pack is the loaded save's, without it
  service.down = true;
  await C.beat(); await settle();
  assert.equal(service.asks.length, 1 + SEASON_MAUL_ASKS, 'stood up again: asked by its id, no answer');
  assert.equal(new Set(service.asks).size, 1, 'by its own id');
  await C.beat(); await settle();
  assert.equal(service.asks.length, 1 + SEASON_MAUL_ASKS, 'not every frame');
  service.down = false;
  clock.t += SEASON_MAUL_REASK_MS; await C.beat(); await settle();
  assert.deepEqual([service.asks.length, C.taken.length], [2 + SEASON_MAUL_ASKS, 2], 'asked again, given back');
  C.slotSave('char');
  assert.deepEqual(heldOf(store), {}, 'the character\'s slot written: let go');
});

test('AUDIT-STOREFRONT II (lane D 2): the season host hears the realm\'s own saves - a checkpoint the composers\' sink puts (scenes/shared.js realmSaveSink) and the realm says landed lets the Maul go, with no host binding (mutants: the sink\'s puts unheard; the season host deaf to them)', async () => {
  const clock = clocked({ t: HEART_T });
  const store = memStorage();
  const D = client('dddd-0004', { clock, storage: store, realSaves: true });
  D.at(30); await D.beat(); await clear(D);
  assert.equal(Object.keys(heldOf(store)).length, 1);
  let answer = () => {};
  setRealmSaveSink(() => new Promise((r) => { answer = r; }));
  try {
    const put = realmSaveSink()({ items: D.entity.items });
    await settle();
    assert.equal(Object.keys(heldOf(store)).length, 1, 'held while its answer is out');
    answer({ ok: true }); await put; await settle();
    assert.deepEqual(heldOf(store), {}, 'landed: let go');
  } finally { setRealmSaveSink(null); }
});

// ── D3: the map's cards ──────────────────────────────────────────────────────────────────────────────────────────────

/** The first hour of the Heart stage whose Bay gate of the day stands beside one of the rig's fissures, and an hour of the
 *  gate day before it (none beside). */
function gateDays() {
  const list = stageFissures(1, 2, SCAN);
  let before = null;
  for (let t = HEART_T; t < S1.stages[2].toMs; t += 3_600_000) {
    const g = findGateSite(gateAt(t, 0).day, SCAN), under = list.find((f) => fissureUnderGate(f, g));
    if (under && before != null) return { before, t, key: under.key };
    if (!under) before = t;
  }
  return null;
}
const quietCards = (marks) => marks.filter((m) => m.tip.lines.includes(FISSURE_TEXT.quiet())).map((m) => m.key);

test('AUDIT-STOREFRONT II (lane D 3): the map\'s cards are made once and answered again while nothing on them moves - a new stage, the day\'s gate moved beside one, another language each makes them again; the held map\'s reader answers the same marks for the same list and box (mutants: the cards made every poll; the stage\'s list unread; the gate\'s day unread; the language unread; the reader made again every poll; the key not the marks\')', () => {
  const days = gateDays();
  assert.ok(days, 'a gate day beside one of the rig\'s fissures');
  const clock = clocked({ t: days.before });
  const A = client('aaaa-0001', { clock });
  const first = A.host.mapMarks();
  assert.ok(first.length > 0 && Object.isFrozen(first));
  assert.equal(A.host.mapMarks(), first, 'the same cards while nothing moved');
  assert.deepEqual(quietCards(first), []);
  clock.t = days.t;   // the next gate day: its gate beside a fissure
  const moved = A.host.mapMarks();
  assert.notEqual(moved, first);
  assert.deepEqual(quietCards(moved), [days.key], 'the card says the fissure gives way');
  assert.equal(A.host.mapMarks(), moved);
  const was = currentLocale();
  try {
    setLocale('de');
    assert.notEqual(A.host.mapMarks(), moved, 'another language: made again');
  } finally { setLocale(was); }
  // a new stage inside one gate day: the stage's own cards, though no gate moved
  const turn = S1.stages[2].fromMs;
  assert.equal(gateAt(turn - 60_000, 0).day, gateAt(turn + 60_000, 0).day, 'one gate day either side');
  clock.t = turn - 60_000;
  const halls = A.host.mapMarks();
  assert.ok(halls.length > 0 && halls.every((m) => m.key.startsWith('1.1.')), 'the Brass Halls\' own');
  clock.t = turn + 60_000;
  assert.ok(A.host.mapMarks().every((m) => m.key.startsWith('1.2.')), 'the Heart\'s own');
  clock.t = turn - 60_000;
  assert.ok(A.host.mapMarks().every((m) => m.key.startsWith('1.1.')));
  // the held map's reader and its key
  const box = { x0: 0, y0: 0, w: 1000, h: 500 };
  const r1 = readFissureMarksIn(() => A.host.mapMarks(), box), r2 = readFissureMarksIn(() => A.host.mapMarks(), box);
  assert.equal(r2, r1, 'the same marks for the same list and box');
  assert.equal(r1.length, halls.length);
  assert.notEqual(readFissureMarksIn(() => A.host.mapMarks(), { ...box, w: 999 }), r1, 'another box: read again');
  assert.equal(fissureMarksKey(r1), raidMarksKey(r1));
});

// ── D4: where the camp stands ────────────────────────────────────────────────────────────────────────────────────────

/** The solid model's faces seen from above, in the fissure's frame (flat ground). */
function solidTris(f) {
  const m = buildFissureModel(f, () => 0, { ground: false }), out = [];
  for (let i = 0; i < m.indices.length; i += 3) {
    const p = (k) => [m.positions[m.indices[k] * 3], m.positions[m.indices[k] * 3 + 2]];
    out.push([p(i), p(i + 1), p(i + 2)]);
  }
  return out;
}
const side = (p, a, b) => (p[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (p[1] - b[1]);
const segDist = (p, a, b) => {
  const dx = b[0] - a[0], dz = b[1] - a[1], l = dx * dx + dz * dz, t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
};
/** How far a point stands from the nearest solid face, metres - 0 over one. */
function clearOf(tris, p) {
  let best = Infinity;
  for (const [a, b, c] of tris) {
    const d1 = side(p, a, b), d2 = side(p, b, c), d3 = side(p, c, a);
    if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) return 0;
    best = Math.min(best, segDist(p, a, b), segDist(p, b, c), segDist(p, c, a));
  }
  return best;
}

test('AUDIT-STOREFRONT II (lane D 4): over hundreds of fissures the camp\'s stands keep off every solid face of the model - each construct FISSURE_STAND_CLEAR.foe clear on the ring, apart; the Colossus FISSURE_STAND_CLEAR.colossus clear, on the crack\'s axis past its end (mutants: a cog\'s footprint its radius alone; the pillar\'s capital unread; the stands unchecked; the Colossus at the heart)', () => {
  let constructs = 0, colossi = 0;
  for (let area = 0; area < 108; area++) {
    for (const [stage, k] of [[2, 0], [area % 2, area % 3 === 0 ? 1 : 0]]) {
      const f = { n: 1, stage, area, k, heart: stage === 2 && k === 0 };
      const tris = solidTris(f), want = fissureRoster(f).length;
      const s = fissureStands(f, want, { ring: SEASON_RING_M, colossus: f.heart });
      assert.equal(s.foes.length, want);
      for (const p of s.foes) {
        const r = Math.hypot(p[0], p[1]);
        assert.ok(r >= SEASON_RING_M[0] - 1e-9 && r <= SEASON_RING_M[1] + 1e-9, `${area}.${stage}: on the ring (${r})`);
        assert.ok(clearOf(tris, p) >= FISSURE_STAND_CLEAR.foe - 1e-9, `${area}.${stage}.${k}: a construct ${clearOf(tris, p)} m from the wreckage`);
        constructs++;
      }
      for (const [i, p] of s.foes.entries()) for (const q of s.foes.slice(i + 1)) assert.ok(Math.hypot(p[0] - q[0], p[1] - q[1]) >= 4, 'apart');
      if (!f.heart) { assert.equal(s.colossus, null); continue; }
      const L = fissureLayout(f), end = [L.spine[0], L.spine[L.spine.length - 1]].find((e) => Math.sign(e.x) === Math.sign(s.colossus[0]));
      assert.ok(Math.abs(s.colossus[0]) > FISSURE_LEN / 2 && s.colossus[1] === end.z, `${area}: the Colossus on the crack's axis past its end`);
      assert.ok(clearOf(tris, s.colossus) >= FISSURE_STAND_CLEAR.colossus - 1e-9, `${area}: the Colossus ${clearOf(tris, s.colossus)} m from the wreckage`);
      colossi++;
    }
  }
  assert.ok(constructs > 500 && colossi === 108, `${constructs} constructs, ${colossi} Colossi`);
});

/** Twelve Bay regions of 320 pixels each, every pixel its own town's - the host's every fissure of every stage. */
function wideScan() {
  const byRegion = new Map(), townAt = new Int32Array(1000 * 500).fill(-1), towns = [];
  for (let region = 0; region < 12; region++) {
    const pixels = [];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 20; x++) {
        const px = 40 + (region % 6) * 25 + x, py = 40 + Math.floor(region / 6) * 20 + y, id = py * 1000 + px;
        pixels.push(id); townAt[id] = towns.length; towns.push({ name: `Town ${towns.length}`, px, py, region });
      }
    }
    byRegion.set(region, Int32Array.from(pixels));
  }
  return { byRegion, towns, townAt };
}

test('AUDIT-STOREFRONT II (lane D 4): the host stands each camp where the fissure\'s own frame says, turned into the world as its model is - every construct and Colossus it stands, at every fissure of every stage, clear of the wreckage and facing the heart (mutants: the ring laid in the world\'s frame; the spot turned the other way)', async () => {
  const scan = wideScan();
  let checked = 0;
  for (const stage of [0, 1, 2]) {
    const clock = clocked({ t: S1.stages[stage].fromMs + 30 * 60_000 }), stood = [];
    let feet = null;
    const host = createSeasonHost({
      state: { pixelTranslation: (px, py, out) => { out[0] = px * 1000; out[1] = 0; out[2] = py * 1000; return out; } },
      exteriorFoes: { foes: [], newCampId: () => 1, reclaimSite() {}, spawnFoe: (career, pos, o) => { stood.push({ career, pos, o }); return Promise.resolve(null); } },
      gateScanOf: () => scan, warmGateScan() {}, surfaceAt: () => 0, player: { feetAt: () => feet }, walkMode: true, playerSpawned: true, online: {}, collider: null,
      _sharedOffsetMs: 0, relayNowS: () => Math.floor(clock.t / 1000), wodSprang() {}, wodUnsprang() {}, say() {}, shake() {}, burst: () => true, who: () => 'a|c',
      storage: null, bindPass: false, roads: null, theatreScans: null, audio: { buffers: new Map(), play3d() {} }, labGrassField: { invalidate() {} },
    });
    for (const f of stageFissures(1, stage, scan)) {
      stood.length = 0;
      feet = [f.px * 1000 + f.spot[0] + 20, 0, f.py * 1000 + f.spot[1]];
      host.frame(); await settle();
      const camp = stood.filter((s) => s.o.site === f.site || s.o.site === f.hSite);
      if (!camp.length) continue;   // beside the day's gate: it gives way
      assert.equal(camp.length, fissureRoster(f).length + (f.hSite ? 1 : 0), f.key);
      const tris = solidTris(f), c = Math.cos(f.yaw), s = Math.sin(f.yaw), hx = f.px * 1000 + f.spot[0], hz = f.py * 1000 + f.spot[1];
      for (const { career, pos, o } of camp) {
        const dx = pos[0] - hx, dz = pos[2] - hz, p = [c * dx - s * dz, s * dx + c * dz];   // the world's offset in the fissure's frame
        const colossus = o.site === f.hSite, toHeart = Math.atan2(-dz, -dx);
        assert.equal(career === COLOSSUS_MOBILE && colossus, colossus);
        assert.ok(clearOf(tris, p) >= (colossus ? FISSURE_STAND_CLEAR.colossus : FISSURE_STAND_CLEAR.foe) - 1e-6, `${f.key}: ${colossus ? 'the Colossus' : 'a construct'} ${clearOf(tris, p)} m from the wreckage`);
        assert.ok(Math.abs(Math.atan2(Math.sin(o.yaw - toHeart), Math.cos(o.yaw - toHeart))) < 1e-9, 'facing the heart');
        checked++;
      }
    }
    host.destroyAll();
  }
  assert.ok(checked > 200, `${checked} stood`);
});
