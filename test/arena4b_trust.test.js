// ARENA4b (2026-10-03, the audit of ARENA4's ladder trust): A LADDER FIGHTER'S VITALITY IS THE RELAY'S. ARENA4 let the
// `in` word's client-claimed `lv` and `mh` win over anything signed, so a modified client could fight the Grand Champion
// with the health it named. Now the token signs the character's level (`cl`, net/identityToken.js claimsValid - the
// account service mints it, another stream's), the relay carries it onto the socket (server/src/index.js `_named`),
// and the vitality is that level's alone (net/arenaLaw.js ladderVitality) - the word's health read by nothing; a token
// from a service before `cl` falls back to the claimed level held to the tier's own top plus a margin.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRooms } from './fakeRoom.mjs';
import { mintToken, verifyToken, claimsValid, CHARACTER_LEVEL_MIN, CHARACTER_LEVEL_MAX, characterLevelIssuable } from '../src/net/identityToken.js';
import {
  arenaBoutRoom, ladderVitality, ladderVitalityAt, ladderLevelCap, LADDER_LV_MARGIN, ARENA_CL_MIN, ARENA_CL_MAX, ARENA_FLOOR_CENTRE, PVE_HP_MAX, validArenaIn,
} from '../src/net/arenaLaw.js';
import { createArenaOnline } from '../src/scenes/arenaOnline.js';
import { arenaLadderOf } from '../src/net/arenaLaw.js';

const { subtle } = globalThis.crypto;
const C = ARENA_FLOOR_CENTRE;
const arena = (ws) => ws.sent.filter((m) => m.t === 'arena');
const last = (ws, k) => arena(ws).filter((m) => m.k === k).at(-1) ?? null;
const word = (r, ws, w) => r.raw(ws, JSON.stringify({ t: 'arena', ...w }));

test('ARENA4b the `cl` claim: a token may sign its character\'s level - a whole number 1..1000, absent from an older service; anything else refused at the minter and the verifier (mutants: the bound unchecked; a fraction taken; the claim dropped at the mint)', async () => {
  const base = { s: 'acct-ceryn', n: 'Ceryn', k: 'linked', i: 1_800_000_000, e: 1_800_000_300 };
  assert.equal(claimsValid(base), true, 'absent - a service before ARENA4b');
  for (const cl of [1, 7, 1000]) assert.equal(claimsValid({ ...base, cl }), true, `cl ${cl}`);
  for (const cl of [0, 1001, 6.5, '7', null, -3, Number.NaN]) assert.equal(claimsValid({ ...base, cl }), false, `cl ${String(cl)}`);
  assert.deepEqual([CHARACTER_LEVEL_MIN, CHARACTER_LEVEL_MAX], [ARENA_CL_MIN, ARENA_CL_MAX], 'the relay\'s law pinned to the token\'s bound');
  assert.equal(characterLevelIssuable(12), true);
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const tok = await mintToken({ s: 'acct-ceryn', n: 'Ceryn', k: 'linked', cl: 12 }, kp.privateKey, { subtle, nowS: 1_800_000_000 });
  const r = await verifyToken(tok, kp.publicKey, { subtle, nowS: 1_800_000_010 });
  assert.equal(r.ok, true);
  assert.equal(r.claims.cl, 12, 'signed and read back');
  const bare = await verifyToken(await mintToken({ s: 'acct-ceryn', n: 'Ceryn', k: 'linked' }, kp.privateKey, { subtle, nowS: 1_800_000_000 }), kp.publicKey, { subtle, nowS: 1_800_000_010 });
  assert.equal('cl' in bare.claims, false, 'a mint naming no character: the bytes as before');
  await assert.rejects(mintToken({ s: 'acct-ceryn', n: 'Ceryn', k: 'linked', cl: 1001 }, kp.privateKey, { subtle, nowS: 1_800_000_000 }), /refused/);
});

test('ARENA4b the ladder\'s vitality law: the signed level\'s honest most, bounded; without it the claimed level held to the tier\'s top opponent plus the margin (mutants: the claimed level believed past the cap; the cap off the wrong tier; the margin dropped)', () => {
  assert.equal(ladderVitalityAt(1), 55);
  assert.equal(ladderVitalityAt(10), 325);
  assert.equal(ladderVitalityAt(500), PVE_HP_MAX, 'bounded');
  assert.equal(LADDER_LV_MARGIN, 5);
  assert.deepEqual(Array.from({ length: 10 }, (_, t) => ladderLevelCap(t)), [8, 10, 12, 14, 16, 17, 21, 24, 24, 26], 'each tier\'s top opponent (a monster at its DFU level) plus five');
  assert.equal(ladderVitality(7, 60, 0), ladderVitalityAt(7), 'the signed level, whatever the word says');
  assert.equal(ladderVitality(12, 60, 0), ladderVitalityAt(8), 'AUDIT PRE-MERGE 1003 S2: and held to the tier\'s cap as a claimed one is (the client writes the tile it is read off)');
  assert.equal(ladderVitality(null, 60, 0), ladderVitalityAt(8), 'no signed level: the claim held to the Pit\'s cap');
  assert.equal(ladderVitality(undefined, 4, 0), ladderVitalityAt(4), 'an honest claim under the cap stands');
  assert.equal(ladderVitality(null, 60, 9), ladderVitalityAt(26), 'the Grand Melee\'s cap');
  assert.equal(ladderVitality(0, 3, 0), ladderVitalityAt(3), 'a cl out of bounds is no signed level');
  assert.deepEqual(validArenaIn({ k: 'in', r: 'f', tier: 0, bout: 0, lv: 3, mh: 90 }), { k: 'in', r: 'f', tier: 0, bout: 0, lv: 3, mh: 90 }, 'an older build\'s `mh` still on the wire, read by nothing');
});

/** A ladder bout opened by its fighter, as the relay holds it. */
async function ladderBout(extra, inWord) {
  const W = fakeRooms();
  const R = W.room(arenaBoutRoom('00000000000000ab'));
  const p = R.connect();
  await R.hello(p, 'fight-ceryn', { x: C[0] - 6, y: 0.3, z: C[2], yaw: 0, pitch: 0, mv: 0 }, { name: 'Ceryn', kind: 'linked', tokenSub: 'acct-ceryn', ...extra });
  await word(R, p, { k: 'in', r: 'f', tier: 0, bout: 1, ...inWord });
  return { R, p, st: last(p, 'st') };
}

test('ARENA4b the relay holds a ladder fighter at the signed level\'s vitality: the token\'s `cl` carried onto the socket, the word\'s health and level not believed; an old token\'s claimed level held to the tier\'s cap (mutants: the word\'s health believed; the token\'s level not carried; the claim uncapped)', async () => {
  // AUDIT PRE-MERGE 1003 S2: a signed level under the Pit's cap (8) - one over it is held to it (test/audit1003_server.test.js)
  const signed = await ladderBout({ charLevel: 7 }, { lv: 60, mh: 99999 });
  assert.equal(signed.st.f.find((f) => f[0] === 'p0')[4], ladderVitalityAt(7), 'the token\'s level, not the word\'s');
  assert.equal(signed.R.room._attach(signed.p).cl, 7, 'carried onto the socket off the signature');
  assert.equal((await signed.R.room._boutOf()).f[0].cl, 7, 'and onto the bout\'s fighter');
  const low = await ladderBout({ charLevel: 7 }, { lv: 7, mh: 5 });
  assert.equal(low.st.f.find((f) => f[0] === 'p0')[4], ladderVitalityAt(7), 'nor a lower health named: the vitality is the relay\'s');
  const old = await ladderBout({}, { lv: 60, mh: 99999 });
  assert.equal(old.st.f.find((f) => f[0] === 'p0')[4], ladderVitalityAt(ladderLevelCap(0)), 'an older service\'s token: the claim held to the Pit\'s cap');
  const honest = await ladderBout({}, { lv: 3 });
  assert.equal(honest.st.f.find((f) => f[0] === 'p0')[4], ladderVitalityAt(3));
});

test('ARENA4b the client\'s ladder `in`: the tier, the bout and my level - no health of mine is said (mutants: the health sent)', async () => {
  const boutSent = [];
  const session = { status: 'open', arenaOk: true, room: 'world:1,1', sendArena: (w) => { boutSent.push(w); return true; } };
  const board = { me: { ladder: arenaLadderOf([{ tier: 0, bout: 0 }]) } };
  const entered = [];
  const A = createArenaOnline({ now: () => 0, session: () => session, makeHall: () => ({ status: 'open', join() {}, leave() {}, sendArena: () => true }), bouts: { ask() {}, relayWord: () => true, dismiss() {}, holds: () => false, relay: () => null },
    account: { board: async () => ({ ok: true, data: board }), claim: async () => ({ ok: true, data: {} }), me: () => null }, enterFloor: (k, o) => { entered.push([k, o]); return true; }, level: () => 12, maxHealth: () => 140 });
  A.model();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(A.fightLadder().ok, true);
  session.room = arenaBoutRoom(entered.at(-1)[1]);
  A.tick();
  assert.deepEqual(boutSent, [{ k: 'in', r: 'f', tier: 0, bout: 1, lv: 12 }]);
});
