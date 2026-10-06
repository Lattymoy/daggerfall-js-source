// AUDIT SERPENT (2026-10-04, Mac: "I definitely want to do a conprehensive audit on this and ensure its absolute
// perfection"): the pins of the audit's findings ON THE CLIENT AND IN THE BOOKS (bible/01-Overview/Audit-Sea-Serpent.md) -
// each a law that failed before its fix. The host end to end against the brain's own words: a new day's attacks judged
// afresh (H3), a silent fight left (M5), the phase a ship sails in on not said, my ship held in the site's frame (L1), a
// word the socket would not take said with the next (L3), the wreck
// said (T2), MOVE down a ram's whole lane (B2), the coil's ring met by any of her (B5), the head its first two segments
// and the guns' lead (T4), the maelstrom's waters laid as it winds (T8), the ram's wake in the scene (M3); the omen
// offline (L4); the claims (D3, D6); the cards (D4); the words; and the world's and the naval host's wiring by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { serpentTimes, serpentBossById, SERPENT_BOSSES } from '../src/net/serpentLaw.js';
import { createSerpentLink, foldSerpent, SERPENT_STATE_EMPTY, SERPENT_NO_TEXT } from '../src/net/serpentLink.js';
import { mintSerpentReceipt } from '../src/net/serpentReceipt.js';
import { importReceiptKey } from '../src/net/gateReceipt.js';
import { validSerpentOut, cellRoomOfWire, PIXEL_UNITS, SERPENT_NO_WORDS } from '../src/net/wire.js';
import { bodyAt, segExposed, LEG, MODE } from '../src/net/serpentBody.js';
import { newSerpentFight, joinSerpentFight, serpentStateOf, SERPENT_ATTACK_TABLE, ZONES, MAEL_R, ramLen, RAM_V } from '../src/net/serpentBrain.js';
import { shapeMeets } from '../src/systems/serpentStrike.js';
import { createSerpentOmen } from '../src/systems/serpentOmen.js';
import { createSerpentHost, HIT_GATHER_MS, SERPENT_HEARD_MS, LEAD_DT_MS } from '../src/scenes/serpentHost.js';
import { bodyMesh, spineRings, MESH_STRIDE, MESH_MAX_VERTS, RING_SIDES, SECTION_H } from '../src/render/serpentRender.js';
import { createSerpentClaims, SERPENT_CLAIMS_MAX, SERPENT_CLAIM_TEXT } from '../src/net/serpentClaims.js';
import { SPOILS_SPENT_MAX } from '../src/scenes/spoilsPool.js';
import { SERPENT_SPOILS_TEXT } from '../src/systems/serpentSpoils.js';
import { profileSerpentLine, profileView } from '../src/ui/profileWindow.js';
import { serpentBarModel } from '../src/ui/serpentBar.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DAY = 363, DAY2 = 365;
const TT = serpentTimes(DAY);
const SX = (205 + 0.5) * PIXEL_UNITS, SZ = (499 - 214 + 0.5) * PIXEL_UNITS;
const CELL = cellRoomOfWire(SX, SZ);
const T0 = TT.riseAt + 20_000;
/** A whole state off the relay's own brain, projected as the wire projects it. */
function brainState(now = T0, day = DAY, extra = {}) {
  const f = newSerpentFight(day, now, serpentTimes(day).soundAt, 'sethrakul', SX, SZ, 0);
  joinSerpentFight(f, 'acct-0001', 'Ama', 20, 4, now, true);
  const st = validSerpentOut({ ...serpentStateOf(f), ...extra });
  assert.ok(st, 'the brain\'s state passes the wire');
  return st;
}
/** The host over a link, its scene the site's moved by a floating origin (`off`, which moves under it). */
function rig({ shipAt = [60, 0] } = {}) {
  let now = T0;
  const sent = [], strikes = [], fx = [], mids = [];
  const off = [1000, 2000];
  const io = { ok: true };
  const link = createSerpentLink({ now: () => now, site: () => ({ day: sw.day, sx: SX, sz: SZ }) });
  const sw = { day: DAY, site: { sx: SX, sz: SZ }, phase: 'hunt', t: TT };
  const boat = { id: 'mine' };
  const ship = { at: [...shipAt], yaw: 0, wrecked: false };
  const host = createSerpentHost({
    now: () => now, link, omen: { swimming: () => sw },
    online: { ready: (cell) => cell === CELL, send: (w, cell) => { if (!io.ok) return false; sent.push({ ...w, cell }); return true; }, acct: () => 'acct-0001' },
    toScene: (sx, sz, x, z) => [x + off[0], z + off[1]],
    toSite: (sx, sz, x, z) => [x - off[0], z - off[1]],
    seaY: () => 0,
    feet: () => [ship.at[0] + off[0], 1, ship.at[1] + off[1]],
    level: () => 20,
    boat: () => ({ boat, hull: 4, root: [ship.at[0] + off[0], ship.at[1] + off[1]], pos: [ship.at[0] + off[0], 0, ship.at[1] + off[1]], yaw: ship.yaw, hl: 25, hw: 7, maxHull: 1200, maxSail: 600, atHelm: true, wrecked: ship.wrecked }),
    strike: (b, hurt, o) => strikes.push({ b, hurt, o }),
    hurt: () => {}, say: () => {}, mid: (t) => mids.push(t), sound: () => {}, fx: (k, p) => fx.push([k, p]),
  });
  // the cell's word as the relay fans it - its fight's site stamped on it (AUDIT SERPENT 2 F1)
  const hear = (w) => { const v = validSerpentOut(w.k === 'no' || w.k === 'rcpt' || w.sx !== undefined ? w : { ...w, sx: SX, sz: SZ }); assert.ok(v, `the wire passes ${w.k}`); link.word(v); };
  return { host, link, sent, strikes, fx, mids, boat, ship, hear, sw, off, io, at: () => now, step: (ms) => { now += ms; return host.frame(); } };
}
const breachAt = (i, at, x = 50) => ({ k: 'atk', i, a: SERPENT_ATTACK_TABLE.breach.id, at, x: 0, z: 0, yw: 0, tg: [[x, 0]] });

test('AUDIT SERPENT H3/M5: a new day\'s fight forgets the last one\'s attacks - its first, numbered from one again, is judged; a fight alive whose cell says nothing for SERPENT_HEARD_MS is left (and asked for again), one slain is not (its throes play); the phase a ship sails in on is not said as if it turned (mutants: the memory kept across days; the silent fight drawn for ever; the throes cut; the joining phase announced)', () => {
  const R = rig();
  R.host.frame();
  R.hear(brainState(R.at()));
  R.hear(breachAt(1, R.at() + 1000));
  R.step(1100);
  assert.equal(R.strikes.length, 1, 'the first day\'s first attack');
  // the next serpent day: a new fight, its attacks numbered from one again
  R.sw.day = DAY2; R.sw.t = serpentTimes(DAY2);
  R.step(10);
  R.hear(brainState(R.at(), DAY2));
  R.hear(breachAt(1, R.at() + 1000));
  R.step(1100);
  assert.equal(R.strikes.length, 2, 'judged - never taken for the last day\'s');
  // silence
  const ins = () => R.sent.filter((w) => w.k === 'in').length;
  const before = ins();
  R.step(SERPENT_HEARD_MS - 1200);
  assert.equal(R.link.state().day, DAY2, 'heard lately enough');
  R.step(1300);
  assert.equal(R.link.state().day, null, 'left');
  R.step(3000);
  assert.ok(ins() > before, 'and asked for again');
  // AUDIT SERPENT S4/M1: a kill or a sounding lets a holding coil go on this screen, its `cx` heard or not
  const held = foldSerpent(foldSerpent(SERPENT_STATE_EMPTY, brainState(T0), T0), { k: 'coil', i: 4, s: 'acct-0001', x: 0, z: 0, th: 0, at: T0, until: T0 + 24_000, h: 60, m: 60 }, T0);
  assert.equal(foldSerpent(held, { k: 'gone', at: T0 + 500 }, T0 + 500).coil.off, T0 + 500, 'gone: let go');
  assert.equal(foldSerpent(held, { k: 'fell', at: T0 + 600, top: [], n: 1 }, T0 + 600).coil.off, T0 + 600, 'slain: let go');
  // slain: no word after the fall, and its throes play out
  const S = rig();
  S.host.frame();
  S.hear(brainState(S.at()));
  S.hear({ k: 'fell', at: S.at(), top: ['Ama'], n: 1 });
  S.step(SERPENT_HEARD_MS + 500);
  assert.equal(S.link.state().day, DAY, 'a slain serpent is never left for its silence');
  assert.ok(S.host.drawFrame(), 'its throes drawn');
  // sailing in on its second phase: nothing said; its third, said
  const P = rig();
  P.host.frame();
  P.hear(brainState(P.at(), DAY, { ph: 2 }));
  P.step(10);
  assert.equal(P.mids.length, 0, 'the phase it stood in when I came');
  P.hear({ k: 'ph', n: 3, until: P.at() + 4000 });
  P.step(10);
  assert.deepEqual(P.mids, [`${serpentBossById('sethrakul').name}: The Maelstrom`]);
});

test('AUDIT SERPENT L1/L3/T2: my ship held in the site\'s frame - a scene whose origin moves under her keeps her where the coil took her; a word the socket would not take is said with the next; my ship\'s wreck said as it comes and her floating again (mutants: the hold in scene metres; the gathered damage dropped; the wreck unsaid or said every frame). S7/H1\'s day-bar on a refused ship\'s volleys is gone - AUDIT SERPENT 2 F3 (serpent1_audit2.test.js)', () => {
  const R = rig();
  R.host.frame();
  R.hear(brainState(R.at()));
  const at = R.at() + 1000;
  R.hear({ k: 'atk', i: 9, a: SERPENT_ATTACK_TABLE.coil.id, at, x: 0, z: 0, yw: 0, tg: [[60, 0]], s: 'acct-0001' });
  R.step(1100);
  assert.equal(R.host.held, true);
  assert.deepEqual(R.host.hold(R.boat).pos, [60 + 1000, 0 + 2000]);
  R.off[0] -= 500; R.off[1] += 250;   // the world re-centred under her
  assert.deepEqual(R.host.hold(R.boat).pos, [60 + 500, 0 + 2250], 'where the coil took her, in the new scene');
  // L3
  const H = rig();
  H.host.frame();
  H.hear(brainState(H.at()));
  H.io.ok = false;
  H.host.struck(5, 30);
  H.step(HIT_GATHER_MS);
  H.io.ok = true;
  H.host.struck(5, 12);
  H.step(HIT_GATHER_MS);
  assert.deepEqual(H.sent.filter((w) => w.k === 'hit').map((w) => [w.d, w.z]), [[42, ZONES.body]], 'the refused word said with the next');
  // T2
  const W = rig();
  W.host.frame();
  W.hear(brainState(W.at()));
  W.step(10); W.step(10);
  const wr = () => W.sent.filter((w) => w.k === 'wr').map((w) => [w.w, w.cell]);
  assert.deepEqual(wr(), [], 'afloat from the first: nothing to say');
  W.ship.wrecked = true;
  W.step(10); W.step(10);
  assert.deepEqual(wr(), [[1, CELL]], 'wrecked, said once');
  W.ship.wrecked = false;
  W.step(10);
  assert.deepEqual(wr(), [[1, CELL], [0, CELL]], 'afloat again');
});

test('AUDIT SERPENT B2/B5/T4/T8/M3: MOVE for a ship anywhere down a ram\'s lane as it winds; the coil\'s ring met by any of her; its head its first two segments, its segments carrying their way for the guns\' lead; the maelstrom\'s waters laid on the sea as it winds; the ram\'s wake a point in the scene (mutants: the lane where its head is; her middle alone; the head segment 0 alone; no way; no wind-up disc; the wake two numbers)', () => {
  const R = rig();
  R.host.frame();
  R.hear(brainState(R.at()));
  R.step(3000);
  const at = R.at() + 2500;
  R.hear({ k: 'atk', i: 5, a: SERPENT_ATTACK_TABLE.ram.id, at, x: 60, z: -120, yw: 0, tg: [[60, -120], [60, -120 + ramLen()]] });
  // PIN MOVED (AUDIT SHIPS C4, 2026-10-06): the ram's wake is its dash's (scenes/serpentHost.js dashWake), over its head as
  // it runs down its lane - its run and its sounding said with its word, as the relay says them (serpentBrain.js begin);
  // it was its judging's, and stopped where the ram struck my ship
  R.hear({ k: 'sw', l: { k: LEG.line, at, x: 60, z: -120, yw: 0, v: RAM_V } });
  R.hear({ k: 'dv', at: at - SERPENT_ATTACK_TABLE.ram.windup, m: MODE.deep });
  R.step(10);
  assert.ok(!shapeMeets({ a: SERPENT_ATTACK_TABLE.ram.id, at, tg: [[60, -120], [60, -120 + ramLen()]] }, { x: 60, z: 0, yw: 0, hl: 25, hw: 7 }, at), 'its head not at her as it lands');
  assert.equal(R.host.bar().atk.aimed, true, 'MOVE - she lies 120 m down its lane');
  R.step(at - R.at() + 1500);
  const wake = R.fx.filter(([k]) => k === 'wake');
  assert.ok(wake.length > 0 && wake.every(([, p]) => p.length === 3 && p.every(Number.isFinite) && p[1] === 0), 'its wake on the sea, in the scene');
  // B5: the ring laid on her helm astern - her middle outside it, her stern in
  const coil = { a: SERPENT_ATTACK_TABLE.coil.id, at: 0, x: 0, z: 0, yw: 0, tg: [[0, -60]] };
  const carrack = { x: 0, z: 0, yw: 0, hl: 25, hw: 7 };
  assert.ok(Math.hypot(0, 60) > SERPENT_ATTACK_TABLE.coil.r && Math.hypot(0, 60 - 25) <= SERPENT_ATTACK_TABLE.coil.r);
  assert.equal(shapeMeets(coil, carrack), true);
  assert.equal(shapeMeets({ ...coil, tg: [[0, -100]] }, carrack), false);
  // T4: stunned on the water, its second segment is its head; every target its way
  const H = rig();
  H.host.frame();
  H.hear(brainState(H.at()));
  H.step(6000);
  H.hear({ k: 'cb', i: 77, n: 'Ama', at: H.at(), su: H.at() + 9000 });
  H.step(10);
  const pts = bodyAt(H.link.state(), H.at(), []);
  assert.ok(segExposed(pts, 0), 'its head above the sea');
  H.host.struck(1, 10);
  H.step(HIT_GATHER_MS);
  assert.deepEqual(H.sent.filter((w) => w.k === 'hit').map((w) => w.z), [ZONES.head]);
  const targets = H.host.targets();
  assert.ok(targets.length && targets.every((t) => t.v.length === 3 && t.v.every(Number.isFinite)));
  const here = bodyAt(H.link.state(), H.at(), []), ahead = bodyAt(H.link.state(), H.at() + LEAD_DT_MS, []);
  const i0 = Number(targets[0].id.split(':')[1]);
  assert.ok(Math.abs(targets[0].v[0] - (ahead[i0].x - here[i0].x) * 1000 / LEAD_DT_MS) < 1e-6, 'its way, scene m/s');
  assert.ok(Math.abs(targets[0].v[2] - (ahead[i0].z - here[i0].z) * 1000 / LEAD_DT_MS) < 1e-6);
  // T8
  const M = rig();
  M.host.frame();
  M.hear(brainState(M.at()));
  M.step(3000);
  M.hear({ k: 'atk', i: 6, a: SERPENT_ATTACK_TABLE.mael.id, at: M.at() + 4000, x: 0, z: 0, yw: 0, tg: [] });
  M.step(10); M.step(1000);   // first seen, then a second into its wind-up
  const disc = M.host.drawFrame().tele.find((t) => t.key === 'mael');
  assert.ok(disc, 'its waters laid as it winds');
  assert.deepEqual([disc.shape, disc.r, disc.c], ['disc', MAEL_R, [1000, 2000]]);
  assert.ok(disc.k > 0 && disc.k < 1);
});

test('AUDIT SERPENT L4/L5: offline the omen stands nothing - no ring, no mark - until it is ready and settled again, its lines not said twice; the tube of the body is its rings\' own vertices from a buffer kept frame to frame (mutants: the omen kept offline; a ring vertex out of place)', () => {
  const SITE = { day: DAY, sx: SX, sz: SZ, near: 'Sentinel', place: 'Sentinel', between: null, ring: { cx: 205.5, cy: 214.5, r: 3 } };
  const said = [];
  let now = TT.riseAt + 1000;
  const O = createSerpentOmen({ now: () => now, site: () => SITE, say: (t) => said.push(t) });
  O.frame();
  assert.ok(O.mapMark() && O.swimming());
  O.reset();
  assert.equal(O.mapMark(), null);
  assert.equal(O.swimming(), null);
  O.frame();
  assert.equal(said.length, 1, 'not said again');
  // the tube
  const points = Array.from({ length: 24 }, (_, i) => ({ x: i * 6, y: Math.sin(i) * 2, z: Math.cos(i * 0.4) * 9, r: 3 - i * 0.08, yw: 0 }));
  const out = new Float32Array(MESH_MAX_VERTS * MESH_STRIDE);
  const f = { t: 0, seaY: 0, points, tele: [], glob: null, stunned: false, dying: false };
  bodyMesh(f, out);
  const rings = spineRings(points);
  const at = (v) => [...out.slice(v * MESH_STRIDE, v * MESH_STRIDE + 3)];
  const near = (a, b) => a.every((x, i) => Math.abs(x - b[i]) < 1e-3);
  const side0 = (g, k) => g.p.map((p, j) => p + g.n[j] * SECTION_H * g.r * k);
  assert.ok(near(at(0), side0(rings[0], 0.35)), 'the snout\'s ring, closed');
  assert.ok(near(at(1), side0(rings[1], 1)), 'the next ring');
  assert.ok(near(at(6 * RING_SIDES), side0(rings[1], 1)), 'the next band begins on it');
  const again = new Float32Array(out.length);
  bodyMesh(f, again);
  assert.deepEqual(again, out, 'the same frame, the same mesh');
});

test('AUDIT SERPENT D3/D6: the device keeps fewer receipts than the spoils pool remembers spent; a hoard whose grant fails leaves its receipt unsettled, and the next offer gives it (mutants: the cap past the pool\'s memory; settled before the grant)', async () => {
  assert.ok(SERPENT_CLAIMS_MAX < SPOILS_SPENT_MAX);
  assert.equal(SERPENT_CLAIMS_MAX, 24);
  const kp = await globalThis.crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const priv = await importReceiptKey(Buffer.from(await globalThis.crypto.subtle.exportKey('pkcs8', kp.privateKey)).toString('base64'), { subtle: globalThis.crypto.subtle });
  const nowS = 1_800_000_000;
  const r = await mintSerpentReceipt({ d: DAY, b: 'sethrakul', s: 'acct-0001', c: 9, x: 'dealt', h: 4, l: 20 }, priv, { subtle: globalThis.crypto.subtle, nowS });
  const store = new Map();
  let fail = true, given = 0, clock = 0;
  const claims = createSerpentClaims({
    claim: async () => ({ ok: true, data: { recorded: true, slain: 1, renown: { credited: 0 }, spoils: true } }),
    onSpoils: async () => { await null; if (fail) throw new Error('the pack would not take it'); given++; },
    store: { get: (k) => store.get(k), set: (k, v) => store.set(k, v) }, nowS: () => nowS, nowMs: () => clock, me: () => 'acct-0001',
  });
  const warn = console.warn; console.warn = () => {};
  try {
    claims.add(r, 'char-0001', 'Ama', 20);
    await new Promise((done) => setImmediate(done));
    assert.equal(claims.kept().length, 1, 'kept - its hoard not given');
    fail = false;
    await claims.flush();
    assert.equal(given, 1);
    assert.equal(claims.kept().length, 0, 'given, then settled');
  } finally { console.warn = warn; }
});

test('AUDIT SERPENT D4/B8/B10/B11 and the words: the inspect card and the account card say the serpents slain; every refusal has its words; the hoard is in the pack; the serpent named off the table (mutants: no line; a word unsaid; the hold claimed; a name written in)', () => {
  assert.equal(profileSerpentLine({ serpents: { slain: 3 } }), 'Serpents slain: 3');
  assert.equal(profileSerpentLine({ serpents: { slain: 0 } }), null);
  assert.equal(profileSerpentLine(null), null);
  assert.equal(profileView({ record: { serpents: { slain: 2 } } }).serpents, 'Serpents slain: 2');
  assert.match(src('src/ui/profileWindow.js'), /if \(v\.serpents\) head\.append\(el\('div', 'dfprofile-line dfprofile-serpents', v\.serpents\)\);/);
  assert.match(src('src/ui/enhancedAccount.js'), /const serpents = serpentRecordText\(flow\.account\.serpents\);\n\s+if \(serpents\) row\('Serpents slain', serpents\);/);
  for (const w of SERPENT_NO_WORDS) assert.ok(SERPENT_NO_TEXT[w], `words for "${w}"`);
  assert.equal(SERPENT_NO_TEXT['it is already slain'], 'The serpent is already slain.');
  const boss = { ...SERPENT_BOSSES[0], name: 'Vharos' };
  assert.equal(SERPENT_SPOILS_TEXT.granted(boss), 'Vharos\'s hoard is yours - it is in your pack.');
  assert.doesNotMatch(SERPENT_SPOILS_TEXT.granted(boss), /hold/);
  assert.equal(SERPENT_SPOILS_TEXT.kept('Ama', boss), 'Vharos\'s hoard waits for Ama.');
  assert.match(SERPENT_CLAIM_TEXT.recorded(2, 0, boss), /^The Bay will remember Vharos's fall\./);
  assert.equal(serpentBarModel({ name: 'S', title: 'T', hp: 1, max: 2, phase: 2, phaseName: 'x', fighters: 1, stunned: true, stunLeft: 8200, now: 0 }).callout.text, 'Stunned - strike its head! 9s');
  assert.doesNotMatch(src('src/scenes/serpentHost.js'), /[`'"]Sethrakul/, 'no name written in the host\'s words');
});

test('AUDIT SERPENT M4/S1/L4/D2/D6/D5 and L2/B6/T4: the world\'s wiring and the naval host\'s, by source - no `in` with the sea fight off; no refusal to the host (AUDIT SERPENT 2 F3); the kill said for my own site alone; the omen reset offline; the hoard at the fight\'s level, its grant\'s promise the carrier\'s; a ball in its hide a hit in the tally; the brace halving its blows; the guns leading it (mutants: each line reverted)', () => {
  const w = src('src/scenes/world.js'), n = src('src/scenes/navalHost.js');
  assert.match(w, /ready: \(cell\) => navalOn\(\) && !!online\?\.serpentReady\?\.\(cell\)/);
  assert.doesNotMatch(w, /serpentHost\?\.refused/);
  assert.match(w, /onFell: \(day, f, at\) => \{ const site = serpentOmen\?\.current\?\.\(\)\?\.site; if \(!site \|\| site\.day !== day \|\| !sameSerpentSite\(site, at\)\) return;/);
  assert.match(w, /site: \(\) => serpentOmen\?\.current\?\.\(\)\?\.site \?\? null/);
  assert.match(w, /fellAt: \(day, site\) => serpentLink\.fellAt\(day, site\)/);
  assert.match(w, /if \(offline\) \{ serpentHost\?\.leave\(\); serpentOmen\?\.reset\(\); \}/);
  assert.match(w, /const level = spoilsLevel\(entry\.ch === characterIdOf\(playerEntity\) \? playerEntity\.level \?\? 1 : Number\(entry\.lv\) \|\| c\.l \|\| 1, c\.l\);/);
  assert.match(w, /return spoilsLock\(\(\) => serpentSpoils\.grant\(/);
  assert.match(n, /if \(segmentOfTarget\(e\.target\) != null\) \{ t\.hits\+\+; t\.ended\+\+; \}/);
  assert.match(n, /const k = st\.guns\.braced \? BRACE_TAKEN : 1;\n\s+const change = st\.damage\.apply\(k < 1 \? \{ \.\.\.hurt, hull: Math\.round\(\(hurt\.hull \?\? 0\) \* k\), sail: Math\.round\(\(hurt\.sail \?\? 0\) \* k\) \} : hurt, clock\);/);
  assert.match(n, /const v = best\.e \? velocityOf\(best\.e\.ship\) : best\.v;/);
  assert.match(n, /ships\.push\(\{ e: SERPENT_AIM, v: t\.v \?\? \[0, 0, 0\]/);
  assert.match(src('src/net/online.js'), /isSocialRoom\(room\) \? r\.k === 'fell' \|\| r\.k === 'rcpt' : isCellRoom\(room\)/, 'the hub hands a receipt (S5)');
});
