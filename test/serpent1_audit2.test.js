// AUDIT SERPENT 2 (2026-10-04, the owner: "audit it and make sure it's perfect"): the pins of the second audit's findings
// (bible/01-Overview/Audit-Sea-Serpent.md, AUDIT SERPENT 2) - each a law that failed before its fix. THE WIRE AND THE
// LINK: every word of a fight names its site, and a client folds its own site's alone - a forged site in the next cell,
// heard on an honest ship's socket there, never reads as her serpent (F1). THE TIMELINE: a word that changes nothing is
// never kept twice, on the relay or a client (F2). THE CLIENT: a refusal never mutes a ship (F3); a landing judged on its
// own moment or not at all (F4); the shots' targets made once a frame (F9). THE BRAIN: a newcomer's `in` from past
// ENGAGE_R keeps no share at the fight (F5); the ram chosen only at ships its lane reaches (F7). THE RELAY: a slain
// serpent never let go while its waters stand open, a fight one ship keeps never idle (F6); a still fight never written
// again (F8).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { cellRoomOfWire, PIXEL_UNITS, SERPENT_FIGHT_KEY, serpentFightId, validSerpentOut } from '../src/net/wire.js';
import { serpentTimes, serpentSiteKey, SERPENT_BRAIN_V, SERPENT_NATIVE_PER_M } from '../src/net/serpentLaw.js';
import {
  newSerpentFight, joinSerpentFight, stepSerpentBrain, serpentStateOf, serpentAttacksFor, ramReach, refOf,
  SERPENT_ATTACK_TABLE, SERPENT_TICK_MS, SERPENT_TTK_S, FAN_R, ENGAGE_R, ARENA_R, SERPENT_SLEEP_MS,
} from '../src/net/serpentBrain.js';
import { LEG, MODE, headAt, onTimeline, sameMode } from '../src/net/serpentBody.js';
import { createSerpentLink } from '../src/net/serpentLink.js';
import { createSerpentHost, LAND_JUDGE_MS, HIT_GATHER_MS } from '../src/scenes/serpentHost.js';
import { HULL } from '../src/systems/naval/navalShips.js';
import { fakeRooms } from './fakeRoom.mjs';

const subtle = globalThis.crypto.subtle;
const DAY = 363;
const TT = serpentTimes(DAY);
const T0 = TT.riseAt + 20_000;
/** The day's site, and one three map pixels west in the same cell. */
const A = { sx: (205 + 0.5) * PIXEL_UNITS, sz: (499 - 214 + 0.5) * PIXEL_UNITS };
const B = { sx: A.sx - 3 * PIXEL_UNITS, sz: A.sz };
const CELL = cellRoomOfWire(A.sx, A.sz);
/** A seeded [0,1) source (mulberry32). */
function seeded(seed = 1) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** A pose `mx` metres east and `mz` north of a site. */
const at = (s, mx, mz) => ({ x: s.sx + mx * SERPENT_NATIVE_PER_M, y: 0, z: s.sz + mz * SERPENT_NATIVE_PER_M, yaw: 0, pitch: 0 });
const words = (ws, k) => ws.sent.filter((m) => m.t === 'serpent' && (!k || m.k === k));
const IN = (s) => ({ k: 'in', d: DAY, bv: SERPENT_BRAIN_V, lv: 20, hl: 4, sx: s.sx, sz: s.sz });
const fightAt = (r, s) => r.room._serpents?.get(serpentFightId(DAY, serpentSiteKey(s.sx, s.sz))) ?? null;
/** A fight swum where a blow from its waters lands, its next attack held off. */
function surfaced(f, now) {
  f.legs = [{ k: 1, at: now - 30_000, x: -60, z: 0, yw: 0, v: 11, r: 60, sd: 1, j: 1 }];
  f.modes = [{ at: now - 30_000, m: 1 }];
  f.nextAt = Infinity;
  return f;
}
/** The relay's world on a clock of the pin's own - Date.now put back whatever the pin (or its setup) throws. */
async function withSea(fn, { start = T0 } = {}) {
  const realNow = Date.now;
  let clock = start;
  try {
    Date.now = () => clock;
    const world = fakeRooms({ now: () => clock });
    const say = (r, ws, o) => r.raw(ws, JSON.stringify({ t: 'serpent', ...o }));
    await fn({ world, say, now: () => clock, set: (t) => { clock = t; } });
  } finally { Date.now = realNow; }
}
const signer = async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  return Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64');
};
/** Beats of a room's fight until `n` have passed. */
async function beats(r, n, now, set) { for (let i = 0; i < n; i++) { set(now() + SERPENT_TICK_MS); if (r.alarm.at != null && now() >= r.alarm.at) await r.fire(); } }

// ═══ F1: EVERY WORD NAMES ITS SITE ═══════════════════════════════════════════════════════════════════════

test('AUDIT SERPENT 2 F1: every word a fight says names its site, and a client folds its own site\'s alone - a forged site in the NEXT cell, its fight heard by an honest ship\'s socket there by her pose, never reads as her serpent: not its swim, not its blows, not its kill (mutants: the stamp left off the fan; an unnamed word folded; a word of another site folded)', async () => {
  // the honest site at its cell's east edge, the forged one 1.6 km east, over the line
  const HA = { sx: (207 + 0.5) * PIXEL_UNITS, sz: (499 - 214 + 0.5) * PIXEL_UNITS };
  const HB = { sx: HA.sx + 2 * PIXEL_UNITS, sz: HA.sz };
  const CA = cellRoomOfWire(HA.sx, HA.sz), CB = cellRoomOfWire(HB.sx, HB.sz);
  assert.notEqual(CA, CB, 'two cells');
  const ship = at(HA, 120, 0);
  assert.ok(Math.hypot(ship.x - HB.sx, ship.z - HB.sz) / SERPENT_NATIVE_PER_M < FAN_R, 'her pose about the forged waters');
  await withSea(async ({ world, say, now, set }) => {
    const ra = world.room(CA), rb = world.room(CB);
    rb.env.GATE_SIGNING_KEY = await signer();
    // the honest ship: her own cell's socket says `in`; her halo's socket in the next cell stands her pose there alone
    const own = ra.connect(); await ra.hello(own, 'peer-0001', ship);
    const halo = rb.connect(); await rb.hello(halo, 'peer-0001', ship);
    const forger = rb.connect(); await rb.hello(forger, 'peer-0005', at(HB, 100, 0));
    await say(ra, own, IN(HA)); await say(rb, forger, IN(HB));
    const L = createSerpentLink({ now, site: () => ({ day: DAY, ...HA }) });
    const fold = (ws) => { for (const m of words(ws)) { const { t, ...w } = m; const v = validSerpentOut(w); if (v) L.word(v); } };
    fold(own);
    const mine = L.state();
    assert.equal(mine.sx, HA.sx, 'her own fight\'s state');
    // the forged fight swims and strikes, then falls - every word of it on her halo's socket
    const fb = fightAt(rb, HB);
    fb.openUntil = 0; fb.nextAt = 0;
    await beats(rb, 40, now, set);
    surfaced(fb, now()); fb.hp = 5;
    await say(rb, forger, { k: 'hit', d: 40, z: 0 });
    assert.ok(fb.fell, 'the forged serpent fell');
    const forged = words(halo);
    assert.ok(['sw', 'dv', 'atk', 'fell'].every((k) => forged.some((m) => m.k === k)), 'her halo heard the forged fight');
    assert.ok(forged.every((m) => m.sx === HB.sx && m.sz === HB.sz), 'every word naming its site');
    fold(halo);
    assert.equal(L.state(), mine, 'none of it folded into hers');
    assert.equal(L.fellAt(DAY, HA), null, 'her serpent lives');
    // and her own fight's words, each naming hers, folded as ever
    await beats(ra, 8, now, set);
    assert.ok(words(own).filter((m) => m.k !== 'st').every((m) => m.sx === HA.sx && m.sz === HA.sz));
    fold(own);
    assert.notEqual(L.state(), mine, 'her own fight heard');
  });
});

// ═══ F2: ONE TIMELINE, NO WORD KEPT TWICE ════════════════════════════════════════════════════════════════

test('AUDIT SERPENT 2 F2: a word that changes nothing is never kept twice - a breach begun in the beat that sent a strayed head to surface said "deep now" again after dropping the surfacing; the relay kept the word twice and every client took it for one it had and kept the surfacing; now the relay\'s ride and track and the client\'s are one - PIN MOVED (SERPENT3): the beat that takes up a slept room (serpentResume) and begins an attack in it (mutants: the duplicate kept on the relay; the client\'s check before the rule)', () => {
  const SOUND = T0 + 25 * 60_000;
  let breaches = 0;
  for (let seed = 1; seed <= 24; seed++) {
    const f = newSerpentFight(DAY, T0 - 60_000, SOUND, 'sethrakul', 0, 0, 0);
    assert.ok(joinSerpentFight(f, 'acct-0001', 'Ama', 20, HULL.Carrack, T0 - 60_000, true));
    f.legs = [{ k: LEG.line, at: T0 - 1000, x: 0, z: 650, yw: 0, v: 11 }];   // its head swum past its waters...
    f.modes = [{ at: T0 - 60_000, m: MODE.breach }];
    f.openUntil = T0; f.nextAt = T0;
    assert.ok(Math.hypot(headAt(f.legs, T0).x, headAt(f.legs, T0).z) > ARENA_R, 'strayed');
    assert.ok(T0 - f.lastTickAt > SERPENT_SLEEP_MS, '...in a room that slept: taken up in the beat');
    const L = createSerpentLink({ now: () => T0, site: () => ({ day: DAY, sx: 0, sz: 0 }) });
    const fold = (ws) => { for (const w of ws) { const v = validSerpentOut(w.k === 'st' ? w : { ...w, sx: 0, sz: 0 }); assert.ok(v, `the wire passes ${w.k}`); L.word(v); } };
    fold([serpentStateOf(f)]);
    f.lastStateAt = T0;   // no whole state on this beat to write over the client's fold - its words alone
    const said = stepSerpentBrain(f, T0, [{ sub: 'acct-0001', x: 0, z: 400, dead: false }], seeded(seed));
    assert.ok(!said.some((w) => w.k === 'st'));
    fold(said);
    if (said.some((w) => w.k === 'atk')) breaches++;
    assert.deepEqual(L.state().modes, f.modes, `seed ${seed}: one ride`);
    assert.deepEqual(L.state().legs, f.legs, `seed ${seed}: one track`);
    assert.ok(f.modes.every((m, i) => !i || m.at !== f.modes[i - 1].at || m.m !== f.modes[i - 1].m), `seed ${seed}: no mode kept twice`);
  }
  assert.ok(breaches > 0, 'an attack begun in the beat that took it up');
  // the law itself, both halves: a ride already ridden, said again as the word that drops one still to come, changes the
  // track (said - every client drops it too) and is kept once; said again, it changes nothing and is never kept twice
  const modes = [{ at: 1, m: MODE.deep }, { at: 5, m: MODE.breach }];
  assert.equal(onTimeline(modes, { at: 3, m: MODE.deep }, sameMode), true, 'said: it dropped the breach still to come');
  assert.deepEqual(modes, [{ at: 1, m: MODE.deep }]);
  assert.equal(onTimeline(modes, { at: 3, m: MODE.deep }, sameMode), false, 'said again: nothing');
  assert.deepEqual(modes, [{ at: 1, m: MODE.deep }], 'never kept twice');
  // the client folds the rule FIRST: a word naming a ride it already holds still drops the ride the relay dropped
  const L = createSerpentLink({ now: () => T0, site: () => ({ day: DAY, sx: 0, sz: 0 }) });
  const f0 = newSerpentFight(DAY, T0 - 60_000, T0 + 25 * 60_000, 'sethrakul', 0, 0, 0);
  assert.ok(joinSerpentFight(f0, 'acct-0001', 'Ama', 20, HULL.Carrack, T0 - 60_000, true));
  f0.modes = [{ at: T0 - 1000, m: MODE.deep }, { at: T0 + 2000, m: MODE.breach }];
  L.word(validSerpentOut(serpentStateOf(f0)));
  L.word(validSerpentOut({ k: 'dv', at: T0 - 1000, m: MODE.deep, sx: 0, sz: 0 }));
  assert.deepEqual(L.state().modes, [{ at: T0 - 1000, m: MODE.deep }], 'the breach the relay dropped, dropped');
});

// ═══ F5 / F7: THE BRAIN ═════════════════════════════════════════════════════════════════════════════════

test('AUDIT SERPENT 2 F5: a newcomer whose first `in` is from past ENGAGE_R joins with her share out of its health and unseen - anchored off she brings none, and the first beat that finds her at the fight brings it in; S8 held only a known fighter to it (mutants: the far newcomer\'s share brought at once; her seen time now)', () => {
  const SOUND = T0 + 25 * 60_000;
  const f = newSerpentFight(DAY, T0, SOUND, 'sethrakul', 0, 0, 0);
  assert.ok(joinSerpentFight(f, 'a', 'Ama', 20, HULL.Carrack, T0, true));
  const max = f.max;
  assert.ok(joinSerpentFight(f, 'b', 'Bo', 20, HULL.LargeGalley, T0, true, null, false), 'she joins');
  assert.equal(f.max, max, 'her share not in its health');
  const near = { sub: 'a', x: 0, z: 300, dead: false };
  for (let t = T0 + SERPENT_TICK_MS; t <= T0 + 5000; t += SERPENT_TICK_MS) stepSerpentBrain(f, t, [near, { sub: 'b', x: 0, z: ENGAGE_R + 500, dead: false }], () => 0.5);
  assert.equal(f.max, max, 'anchored past the fight, none');
  stepSerpentBrain(f, T0 + 5000 + SERPENT_TICK_MS, [near, { sub: 'b', x: 0, z: ENGAGE_R - 100, dead: false }], () => 0.5);
  assert.ok(Math.abs(f.max - (max + SERPENT_TTK_S * refOf(HULL.LargeGalley))) < 1e-6, 'come to the fight, her share in');
});

test('AUDIT SERPENT 2 F7: the ram is chosen only at a ship its lane reaches - its range within the wind-up\'s crawl and its run; at 240 m it spent 9.8 s running at ships up to 70 m past its lane\'s end (mutant: the old range)', () => {
  const ram = SERPENT_ATTACK_TABLE.ram;
  assert.ok(ram.range <= ramReach(), `${ram.range} m within its ${ramReach().toFixed(1)} m`);
  assert.ok(ramReach() - ram.range < 10, 'and near all of it');
  assert.ok(!serpentAttacksFor(1, 200, true).includes(ram), 'never at 200 m');
  assert.ok(serpentAttacksFor(1, 150, true).includes(ram), 'at 150 m');
});

// ═══ F3 / F4 / F9: THE CLIENT ═══════════════════════════════════════════════════════════════════════════

/** The host over a link on the site's own frame (the scene the site's), the relay's words stamped as it fans them. */
function rig() {
  let now = T0;
  const sent = [], strikes = [];
  const link = createSerpentLink({ now: () => now, site: () => ({ day: DAY, ...A }) });
  const sw = { day: DAY, site: { ...A }, phase: 'hunt', t: TT };
  const boat = { id: 'mine' };
  const ship = { at: [60, 0], wrecked: false };
  const host = createSerpentHost({
    now: () => now, link, omen: { swimming: () => sw },
    online: { ready: (cell) => cell === CELL, send: (w, cell) => { sent.push({ ...w, cell }); return true; }, acct: () => 'acct-0001' },
    toScene: (sx, sz, x, z) => [x, z], toSite: (sx, sz, x, z) => [x, z], seaY: () => 0,
    feet: () => [ship.at[0], 1, ship.at[1]], level: () => 20,
    boat: () => ({ boat, hull: 4, root: [ship.at[0], ship.at[1]], pos: [ship.at[0], 0, ship.at[1]], yaw: 0, hl: 25, hw: 7, maxHull: 1200, maxSail: 600, atHelm: true, wrecked: ship.wrecked }),
    strike: (b, hurt) => strikes.push(hurt), hurt: () => {}, say: () => {}, mid: () => {}, sound: () => {}, fx: () => {},
  });
  const hear = (w) => { const v = validSerpentOut(w.k === 'st' || w.k === 'no' ? w : { ...w, ...A }); assert.ok(v, `the wire passes ${w.k}`); link.word(v); };
  const f = newSerpentFight(DAY, now, TT.soundAt, 'sethrakul', A.sx, A.sz, 0);
  joinSerpentFight(f, 'acct-0001', 'Ama', 20, 4, now, true);
  host.frame();
  hear(serpentStateOf(f));
  return { host, link, sent, strikes, ship, hear, at: () => now, step: (ms) => { now += ms; return host.frame(); } };
}
const blowAt = (i, at, A_ = SERPENT_ATTACK_TABLE.breach) => ({ k: 'atk', i, a: A_.id, at, x: 0, z: 0, yw: 0, tg: [[50, 0]] });

test('AUDIT SERPENT 2 F3: a refusal never mutes my ship - the cell hears the words of an account its fight counts alone, so a ship turned away (her `in` a moment before the rising on a clock run ahead: "the serpent is gone") and let in by her next `in` fires and says her wreck (mutants: the day\'s bar on the volleys; on the wreck)', () => {
  const R = rig();
  R.hear({ k: 'no', m: 'the serpent is gone' });
  R.host.struck(5, 30);
  R.step(HIT_GATHER_MS);
  R.ship.wrecked = true;
  R.step(10);
  assert.deepEqual(R.sent.filter((w) => w.k === 'hit').map((w) => w.d), [30], 'her volley said');
  assert.deepEqual(R.sent.filter((w) => w.k === 'wr').map((w) => w.w), [1], 'her wreck said');
  assert.equal(typeof R.host.refused, 'undefined', 'no door for a bar');
});

test('AUDIT SERPENT 2 F4: a landing is judged on my ship on its own moment or not at all - one first seen after it landed (a ship sailing in on its recovery), or past a frame stalled over it, strikes nothing; its venom lies on the water all the same; one on its moment strikes (mutants: judged however late; the venom left off a late spit)', () => {
  const late = rig();
  late.hear(blowAt(1, late.at() - 2500));   // landed 2.5 s ago, its recovery holding it in the state
  late.step(10);
  assert.equal(late.strikes.length, 0, 'seen after it landed');
  const stall = rig();
  stall.hear(blowAt(1, stall.at() + 1000));
  stall.step(10);
  stall.step(1000 + LAND_JUDGE_MS + 1500);
  assert.equal(stall.strikes.length, 0, 'a frame stalled over it');
  const spit = rig();
  spit.hear({ ...blowAt(2, spit.at() - 2000, SERPENT_ATTACK_TABLE.spit), tg: [[60, 0]] });
  spit.step(10);
  assert.equal(spit.strikes.length, 0);
  assert.equal(spit.host._pools().length, 1, 'its venom on the water');
  const on = rig();
  on.hear(blowAt(1, on.at() + 1000));
  on.step(10); on.step(1000);
  assert.equal(on.strikes.length, 1, 'on its moment, struck');
});

test('AUDIT SERPENT 2 F9: the shots\' targets are made once a frame - the shots\' field, the look and the aim each ask, and each ask walked the spine twice and boxed every segment again (mutant: made at every ask)', () => {
  const H = rig();
  H.step(8000);
  const t1 = H.host.targets();
  assert.ok(t1.length > 0, 'segments above the sea');
  assert.equal(H.host.targets(), t1, 'asked again in the frame: the one made');
  H.step(16);
  const t2 = H.host.targets();
  assert.notEqual(t2, t1, 'a new frame, made again');
  assert.notDeepEqual(t2.map((t) => t.box), t1.map((t) => t.box), 'where it has swum');
});

// ═══ F6 / F8: THE RELAY ═════════════════════════════════════════════════════════════════════════════════

test('AUDIT SERPENT 2 F6: a slain serpent is never let go for another site\'s fight while its waters stand open - a ship whose hub word was missed finds it slain, never a new one at full health; a fight one ship keeps about its waters is never idle; only one nobody keeps gives way (mutants: the slain let go at its kill; a lone ship\'s fight let go)', async () => {
  await withSea(async ({ world, say, now }) => {
    const r = world.room(CELL);
    const site = (k) => ({ sx: A.sx + k * 30 * SERPENT_NATIVE_PER_M, sz: A.sz });
    const socks = [];
    for (let k = 0; k < 3; k++) { const ws = r.connect(); await r.hello(ws, `peer-000${k + 1}`, at(site(k), 0, 40)); await say(r, ws, IN(site(k))); socks.push(ws); }
    const f0 = fightAt(r, site(0));
    f0.fell = { at: now(), top: [], n: 1 }; f0.said = true; f0.told = true;   // slain, and the hub told
    await r.drop(socks[2]);   // site 2's ship gone - nobody keeps its waters; site 1's lone ship keeps hers, no part yet
    const e = r.connect(); await r.hello(e, 'peer-0004', at(site(3), 0, 40));
    await say(r, e, IN(site(3)));
    assert.ok(fightAt(r, site(3)), 'a new site stood');
    assert.equal(fightAt(r, site(2)), null, 'in the place of the one nobody keeps');
    assert.equal(fightAt(r, site(0)), f0, 'the slain kept');
    assert.ok(fightAt(r, site(1)), 'the lone ship\'s kept');
    const g = r.connect(); await r.hello(g, 'peer-0005', at(site(4), 0, 40));
    await say(r, g, IN(site(4)));
    assert.deepEqual(words(g).at(-1), { t: 'serpent', k: 'no', m: 'the waters are full' }, 'a fifth refused - every fight kept');
    const back = r.connect(); await r.hello(back, 'peer-0006', at(site(0), 0, 60));
    await say(r, back, IN(site(0)));
    assert.equal(words(back).at(-1).m, 'it is already slain');
    assert.equal(fightAt(r, site(0)), f0, 'never born again at full health');
  });
});

test('AUDIT SERPENT 2 F8: a fight is written as it is stepped - a slain one beside a live one is never written again on the live one\'s beats, and one sounded is written once, at its sounding (mutant: every kept fight written every 2 s)', async () => {
  await withSea(async ({ world, say, now, set }) => {
    const r = world.room(CELL);
    const a = r.connect(), b = r.connect();
    await r.hello(a, 'peer-0001', at(A, 120, 0)); await r.hello(b, 'peer-0002', at(B, 120, 0));
    await say(r, a, IN(A)); await say(r, b, IN(B));
    const fb = fightAt(r, B);
    fb.fell = { at: now(), top: [], n: 1 }; fb.said = true; fb.told = true;
    const keyOf = (s) => `${SERPENT_FIGHT_KEY}:${serpentFightId(DAY, serpentSiteKey(s.sx, s.sz))}`;
    const puts = new Map();
    const put = r.state.storage.put.bind(r.state.storage);
    r.state.storage.put = (k, v) => { if (typeof k === 'string') puts.set(k, (puts.get(k) ?? 0) + 1); return put(k, v); };
    await beats(r, 40, now, set);
    assert.ok((puts.get(keyOf(A)) ?? 0) >= 3, 'the live fight checkpointed on its beat');
    assert.equal(puts.get(keyOf(B)) ?? 0, 0, 'the slain never written again');
    set(TT.soundAt - 1000);
    await beats(r, 1, now, set);   // a checkpoint on its beat, under a second before its sounding
    puts.clear();
    await beats(r, 3, now, set);
    assert.ok(fightAt(r, A).gone, 'sounded');
    assert.equal(puts.get(keyOf(A)), 1, 'written at its sounding, the checkpoint\'s two seconds or no');
    await beats(r, 40, now, set);
    assert.equal(puts.get(keyOf(A)), 1, 'and never again');
  });
});
