// PVP-VILLAIN-KEEP (the PvP rework, 2026-10-29; bible/11-Multiplayer/PvP-Rework.md PVP-VILLAIN-KEEP): THE VILLAIN METER
// KEPT. The account service writes a fall's signed points onto its killer's character (server-account/src/villainy.js,
// migration 0192), once with the fall; a raid's claim and a Renown report lower it; the mint signs it (`vl`); the relay's
// referee seeds a fighter from it, the larger of the carried and the signed. The service is the real Worker over the
// real migrations (test/accountDb.mjs); the relay the real Room (test/fakeRoom.mjs).
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { standService } from '../accountDb.mjs';
import { seatRealm } from '../realmSeat.mjs';
import { mintWildReceipt } from '../../src/net/wild/wildReceipt.js';
import { mintRaidReceipt } from '../../src/net/raid/raidReceipt.js';
import { newWildRef, wildZone, wildCarry, wildCarryOf, wildTokenAtt, WILD_GRACE } from '../../src/net/wild/wildRef.js';
import { claimsValid, mintToken, verifyToken, TOKEN_VILLAINY_MAX, villainyIssuable } from '../../src/net/identityToken.js';
import { villainFallSteps, villainReportDown, VILLAIN_REPORT_DOWN_MAX } from '../../server-account/src/villainy.js';
import { realmMintFacts } from '../../server-account/src/realm.js';
import { VILLAIN, villainMonsterLowers, villainQuestLowers } from '../../src/systems/wild/villainLaw.js';
import { createRenownTracker, renownRid } from '../../src/net/renownTracker.js';
import { worldRoom, PIXEL_UNITS } from '../../src/net/wire.js';
import { SIEGE_UNITS_PER_M } from '../../src/net/siege/siegeRef.js';
import { fakeRoom } from '../fakeRoom.mjs';

const { subtle } = globalThis.crypto;
const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const nowS = () => Math.floor(Date.now() / 1000);
const quiet = async (fn) => { const w = console.warn, i = console.info; console.warn = () => {}; console.info = () => {}; try { return await fn(); } finally { console.warn = w; console.info = i; } };
const CELL = worldRoom(520, 110);

/** Two registered players, each seated as a realm character: Example Player falls, Borin kills. */
async function stood() {
  const svc = await standService();
  const ex = await svc.registered('ExamplePlayer'), bo = await svc.registered('Borin');
  const X = await seatRealm(svc.env, ex.secret, 'Example Player');
  const B = await seatRealm(svc.env, bo.secret, 'Borin');
  const raw = svc.env.DB._raw;
  const meter = (id = B.id) => raw.prepare('SELECT villainy FROM realm_characters WHERE id = ?').get(id).villainy;
  const set = (n, id = B.id) => raw.prepare('UPDATE realm_characters SET villainy = ? WHERE id = ?').run(n, id);
  const receipt = (o = {}) => mintWildReceipt({ f: ex.id, c: X.id, k: bo.id, kc: B.id, r: o.r ?? '0123456789ab', w: -1, ...(o.vp !== undefined ? { vp: o.vp } : { vp: 500 }) }, svc.gatePriv, { subtle, nowS: nowS() });
  const fall = async (o = {}) => quiet(async () => svc.call('/v1/wild/fall', { room: CELL, receipt: await receipt(o), realm: X.at(), letters: 1 }, ex.secret));
  return { svc, ex, bo, X, B, raw, meter, set, fall };
}

test('PVP-VILLAIN-KEEP THE STORE (migration 0192, villainy.js villainFallSteps, wild.js): a fall\'s signed points onto its killer\'s character in the fall\'s own batch - once a remains, asked again nothing more; held to 10,000; a REPEAT-SHIELD fall still counts; the fallen\'s own meter untouched (mutants: the step unwired; the top unheld; the shield\'s fall uncounted; the killer\'s account unasked)', async () => {
  assert.match(rd('server-account/migrations/0192_villainy.sql'), /ALTER TABLE realm_characters ADD COLUMN villainy INTEGER NOT NULL DEFAULT 0;/);
  assert.equal(readdirSync(new URL('../../server-account/migrations', import.meta.url)).filter((f) => /^0192_/.test(f)).length, 1, 'one migration of its number');
  const s = await stood();
  assert.equal(s.meter(), 0, 'every character starts at 0');
  const first = await s.fall();
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(s.meter(), 500, 'the receipt\'s points on the killer');
  assert.equal(s.meter(s.X.id), 0, 'none on the fallen');
  assert.equal((await s.fall()).status, 200);
  assert.equal(s.meter(), 500, 'asked again: the same remains, nothing more');
  const shielded = await s.fall({ r: '0123456789ac', vp: 2000 });
  assert.equal(shielded.body.shield, true, 'the same hand inside the half hour: shielded');
  assert.equal(s.meter(), 2500, 'a shielded kill is still a kill its killer chose');
  s.set(9_900);
  await s.fall({ r: '0123456789ad', vp: 2000 });
  assert.equal(s.meter(), VILLAIN.max, 'held to 10,000');
  // the steps alone
  const db = { prepare: (q) => ({ bind: (...a) => ({ q, a }) }) };
  assert.deepEqual(villainFallSteps(db, { k: 'acct-k', kc: 'r'.padEnd(21, 'a') }), [], 'no points: no step');
  assert.deepEqual(villainFallSteps(db, { k: 'acct-k', kc: 'nope', vp: 100 }), [], 'no character: no step');
  const [st] = villainFallSteps(db, { k: 'acct-k', kc: `r${'a'.repeat(20)}`, vp: 100 });
  assert.match(st.q, /WHERE id = \?1 AND player = \?2/, 'the killer\'s own account\'s character alone');
  assert.deepEqual(st.a, [`r${'a'.repeat(20)}`, 'acct-k', 10_000, 100]);
});

test('PVP-VILLAIN-KEEP THE LOWERING (villainy.js, raids.js claimRaid, the /v1/renown/xp route): a raid\'s claim takes 500 once, none while red; a Renown report takes its tab\'s `vd`, never more than the XP it credited, nothing for a repeat (it credits none), never below 0 (mutants: the raid unwired; red raids counted; the raid\'s floor gone; a claim counted twice; the credit unbounded; the report\'s top; the route unwired; the floor gone)', async () => {
  const s = await stood();
  s.set(1_200);
  const raid = async (key) => s.svc.call('/v1/raid/claim', { receipt: await mintRaidReceipt({ w: key, s: s.bo.id, c: 777, y: 2 }, s.svc.gateKey, { subtle, nowS: nowS() }), character: s.B.id, name: 'Borin' }, s.bo.secret);
  const r1 = await raid('17:3:1000');
  assert.equal(r1.status, 200, JSON.stringify(r1.body));
  assert.equal(r1.body.recorded, true, JSON.stringify(r1.body));
  assert.equal(s.meter(), 700, 'a raid: 500 off');
  assert.equal((await raid('17:3:1000')).body.recorded, false, 'claimed already');
  assert.equal(s.meter(), 700, 'a claim asked again takes nothing more');
  s.set(5_000);
  assert.equal((await raid('17:3:1001')).body.recorded, true);
  assert.equal(s.meter(), 5_000, 'a villain\'s raid is not counted');
  s.set(300);
  assert.equal((await raid('17:3:1002')).body.recorded, true);
  assert.equal(s.meter(), 0, 'a raid takes it to 0, never past');
  // the Renown report
  s.set(300);
  const report = (o) => s.svc.call('/v1/renown/xp', { character: s.B.id, ...o }, s.bo.secret);
  const id1 = renownRid(), id2 = renownRid();
  const a = await report({ xp: 40, rid: id1, vd: 201 });
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.equal(s.meter(), 300 - Math.min(201, a.body.credited), 'within what it credited');
  assert.ok(a.body.credited > 0 && a.body.credited < 201, `the report credited ${a.body.credited}`);
  const was = s.meter();
  assert.equal((await report({ xp: 40, rid: id1, vd: 201 })).body.repeat, true);
  assert.equal(s.meter(), was, 'a repeat takes nothing');
  await report({ xp: 2_000, rid: id2, vd: 2_000 });
  assert.equal(s.meter(), 0, 'never below 0');
  assert.equal(villainReportDown(5, { credited: 0 }), 0);
  assert.equal(villainReportDown(-3, { credited: 100 }), 0);
  assert.equal(villainReportDown(1.5, { credited: 100 }), 0);
  assert.equal(villainReportDown(50_000, { credited: 40_000 }), VILLAIN_REPORT_DOWN_MAX, 'a report\'s top');
});

test('PVP-VILLAIN-KEEP THE TOKEN (realm.js realmMintFacts, identityToken.js, the mint): the meter signed as `vl` beside the realm\'s yes, absent at 0; a claim of 0, past 10,000, not whole or without `rc` 1 refused (mutants: the meter unread; unsigned; unchecked; the realm\'s yes unasked)', async () => {
  const s = await stood();
  assert.equal((await realmMintFacts({ db: s.svc.env.DB }, s.bo.id, s.B.id)).vl, 0);
  const tok = async () => {
    const r = await s.svc.call('/v1/auth/token', { character: s.B.id }, s.bo.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return JSON.parse(Buffer.from(r.body.token.split('.')[1], 'base64url').toString());
  };
  assert.equal((await tok()).vl, undefined, 'a meter at 0: the bytes as before');
  s.set(6_400);
  assert.equal((await realmMintFacts({ db: s.svc.env.DB }, s.bo.id, s.B.id)).vl, 6_400);
  assert.equal((await tok()).vl, 6_400, 'signed');
  assert.equal(TOKEN_VILLAINY_MAX, VILLAIN.max, 'the token\'s top is the law\'s');
  const base = { s: 'acct-0001', n: 'Example Player', k: 'linked', i: 100, e: 200, rc: 1, ci: `r${'a'.repeat(20)}` };
  assert.equal(claimsValid({ ...base, vl: 10_000 }), true);
  for (const vl of [0, 10_001, 1.5, '50']) assert.equal(claimsValid({ ...base, vl }), false, String(vl));
  assert.equal(claimsValid({ ...base, rc: 0, ci: undefined, vl: 50 }), false, 'beside the realm\'s yes alone');
  assert.deepEqual([villainyIssuable(1), villainyIssuable(0)], [true, false]);
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const t = await mintToken({ ...base, vl: 3_000 }, kp.privateKey, { subtle, nowS: 150 });
  assert.equal((await verifyToken(t, kp.publicKey, { subtle, nowS: 150 })).claims.vl, 3_000);
});

const M = SIEGE_UNITS_PER_M;
const PX = 520, PY = 110;
const BASE = { x: PX * PIXEL_UNITS + 16384, z: (499 - PY) * PIXEL_UNITS + 16384 };
const P = (x) => ({ x: BASE.x + x * M, y: 0, z: BASE.z, yaw: 0, pitch: 0 });
const LOOK = { race: 'Nord', gender: 'male', faceIndex: 0, items: [] };

test('PVP-VILLAIN-KEEP THE RELAY (wildRef.js wildZone, wildTokenAtt, server/src/index.js): a fighter seeded from its token\'s `vl` - the larger of it and what it carries - so a fresh relay never forgets; a villain by its token is red at its entry and told its meter (mutants: the token unread; the smaller kept; the socket never carrying it)', async () => {
  const st = newWildRef();
  const x = wildZone(st, 'acct-a', { id: 'peer-a', lv: 10, cl: 40, ci: 'r-a', fl: 0, vl: 6_000 }, true, null, 0);
  assert.equal(x.vi, 6_000, 'seeded');
  assert.equal(x.flag, true, 'red: the flag held up');
  const carry = wildCarryOf({ ...wildCarry(st, 'acct-a', 1_000), vi: 7_500 });
  const st2 = newWildRef();
  assert.equal(wildZone(st2, 'acct-a', { id: 'peer-a', lv: 10, cl: 40, ci: 'r-a', carry, vl: 6_000 }, true, null, 2_000).vi, 7_500, 'the carry, the larger');
  const st3 = newWildRef();
  assert.equal(wildZone(st3, 'acct-a', { id: 'peer-a', lv: 10, cl: 40, ci: 'r-a', carry: wildCarryOf({ ...carry, vi: 100 }), vl: 6_000 }, true, null, 2_000).vi, 6_000, 'the token, the larger');
  assert.equal(wildZone(newWildRef(), 'acct-a', { id: 'peer-a', lv: 10, cl: 40, ci: 'r-a' }, true, null, 0).vi, undefined, 'no token meter: none');
  assert.deepEqual(wildTokenAtt({ ci: 'r-a', vl: 3_000 }), { ci: 'r-a', vl: 3_000 });
  assert.deepEqual(wildTokenAtt({ ci: 'r-a' }), { ci: 'r-a' });
  // the real room: a token's meter at its door
  const realNow = Date.now; let clock = 1_800_000_000_000; Date.now = () => clock;
  try {
    const r = fakeRoom(CELL, { now: () => clock });
    const ws = r.connect();
    await r.hello(ws, 'peer-0001', P(0), { lv: 10, look: LOOK, rc: 1, ci: 'r00000000000000000a02', charLevel: 45, vl: 5_200 });
    await r.raw(ws, JSON.stringify({ t: 'wild', data: { k: 'zone', z: 1, fl: 0 } }));
    assert.deepEqual(ws.sent.filter((m) => m.t === 'wref' && m.k === 'vil').map((m) => m.n), [5_200], 'told its meter at its entry');
    assert.ok(ws.sent.some((m) => m.t === 'wref' && m.k === 'flag' && m.id === 'peer-0001' && m.f === 1 && m.v === 1), 'red at once');
    clock += WILD_GRACE.ms;
  } finally { Date.now = realNow; }
});

test('PVP-VILLAIN-KEEP THE PAGE (net/renownTracker.js, scenes/world.js): a kill of a monster at my level and a quest done ride the next Renown report as `vd`, never more than its XP; a lost report keeps them (mutants: the kill\'s word unsent; the quest\'s; the report\'s bound)', async () => {
  const sent = [];
  let ok = false;
  const tr = createRenownTracker({ report: async (...a) => { sent.push(a); return ok ? { ok: true, data: {} } : { ok: false, error: 'offline' }; }, character: () => 'r-a', rid: (() => { let n = 0; return () => `r${++n}`; })(), now: () => 0 });
  tr.earn(10, villainMonsterLowers(40, 39));
  tr.earn(10, villainMonsterLowers(40, 30));
  tr.earn(300, villainQuestLowers());
  await tr.flush(0);
  assert.equal(sent[0][5], 201, 'a monster at my level less 1 and a quest');
  ok = true;
  await tr.flush(60_000);
  assert.equal(sent[1][5], 201, 'the held report sent again as it was');
  tr.earn(5, 200);
  await tr.flush(120_000);
  assert.equal(sent[2][5], 5, 'never more than the report\'s XP');
  const w = rd('src/scenes/world.js');
  assert.match(w, /renownTracker\.earn\(xp, villainMonsterLowers\(playerEntity\.level, renownFoeLevel\(foe\)\)\);/);
  assert.match(w, /renownTracker\.earn\(xp, villainQuestLowers\(\)\);/);
  assert.match(w, /report: \(c, xp, name, rid, region, vd\) => \{[^}]*renownAccount\.report\(c, xp, name, rid, region, vd\); \},/);
  assert.match(rd('src/net/accountClient.js'), /\.\.\.\(vd > 0 \? \{ vd \} : \{\}\)/);
});
