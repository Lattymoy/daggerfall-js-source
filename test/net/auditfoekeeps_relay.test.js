// AUDIT FOE-KEEPS E2 (2026-10-24, bible/01-Overview/audits/Audit-Foe-Keeps.md - the owner, asked: "Credit the last
// player"). Lane E: the referee named a killer only when its own bar reached none, and a fighter's save health is the
// foes' alone - so a player losing a fight denied its winner everything by dying to a foe, a fall or the sea first, and
// since FOE-KEEPS such a death drops nothing ("You keep what you carry", where it once laid the bag for any taker).
// WILD_KILL_CREDIT_MS stood in systems/wild/wildZone.js for exactly this ("a foe's last swing after a player's - the
// player who brought you down") and nothing read it. Now a fighter's own word that it left the zone dying (`zone` 0 with
// `dd`) is the kill of the last fair player to strike it within WILD_REF.creditMs (net/wild/wildRef.js wildCredit): its
// fall made, said to the room and signed as a blow's is. Over the real relay room (test/fakeRoom.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newWildRef, wildZone, wildBlow, wildCredit, WILD_REF } from '../../src/net/wild/wildRef.js';
import { SIEGE_UNITS_PER_M, SIEGE_HIT } from '../../src/net/siege/siegeRef.js';
import { readWildReceipt } from '../../src/net/wild/wildReceipt.js';
import { WILD_KILL_CREDIT_MS } from '../../src/systems/wild/wildZone.js';
import { validWildData, validWildRefOut, worldRoom, PIXEL_UNITS } from '../../src/net/wire.js';
import { fakeRoom } from '../fakeRoom.mjs';

const { subtle } = globalThis.crypto;
const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const M = SIEGE_UNITS_PER_M;
const at = (x) => ({ x: 1000 * M + x * M, y: 0, z: 1000 * M });

test('AUDIT FOE-KEEPS E2 THE LAW (wildRef.js wildCredit): a death the referee did not see falls to the last fair player whose blow landed within WILD_REF.creditMs - WILD_KILL_CREDIT_MS, pinned equal - in the room that blow was refereed in; none past it, none for a blow the referee refused (kin), none twice, none once its striker is gone (mutants: the window unread; the last blow unkept; a kin blow kept; credited twice; the striker unasked)', () => {
  assert.equal(WILD_REF.creditMs, WILD_KILL_CREDIT_MS, 'one number at both ends');
  const stand = () => {
    const st = newWildRef();
    wildZone(st, 'acct-a', { id: 'peer-a', lv: 10, ci: 'r-a' }, true, at(-1), 0);
    wildZone(st, 'acct-b', { id: 'peer-b', lv: 10, ci: 'r-b' }, true, at(1), 0);
    return st;
  };
  const hit = (st, now, o = {}) => wildBlow(st, 'acct-a', 'acct-b', { d: 999, r: SIEGE_HIT.Melee, held: { w: -1, m: 0 }, rid: 'aaaaaaaaaaaa', room: 'world:400,120', ...o }, now);
  // inside the window: the striker's kill
  const st = stand();
  const h = hit(st, 1_000);
  assert.ok(h.ok && h.dealt > 0 && !h.fell, 'a blow that does not fell');
  const c = wildCredit(st, 'acct-b', 'bbbbbbbbbbbb', 1_000 + WILD_REF.creditMs);
  assert.ok(c, 'credited at the window\'s last moment');
  assert.deepEqual([c.fall.r, c.fall.fallen, c.fall.fallenId, c.fall.ci, c.fall.killer, c.fall.killerId, c.fall.kc, c.fall.m, c.fall.w, c.fall.picked], ['bbbbbbbbbbbb', 'acct-b', 'peer-b', 'r-b', 'acct-a', 'peer-a', 'r-a', 'world:400,120', -1, false]);
  assert.equal(st.falls.get('bbbbbbbbbbbb'), c.fall, 'kept for its pick and its signing');
  assert.equal(st.fighters.get('acct-b').down, true, 'down - its rise is the referee\'s, as a blow\'s fall is');
  assert.equal(wildCredit(st, 'acct-b', 'cccccccccccc', 1_000 + WILD_REF.creditMs), null, 'never twice');
  // past the window: a foe's death
  const late = stand();
  hit(late, 1_000);
  assert.equal(wildCredit(late, 'acct-b', 'bbbbbbbbbbbb', 1_001 + WILD_REF.creditMs), null);
  // never struck
  assert.equal(wildCredit(stand(), 'acct-b', 'bbbbbbbbbbbb', 1_000), null);
  // a blow the referee refused (kin: one party, its truce, a duel's two, one guild) is no blow
  const kin = stand();
  assert.equal(hit(kin, 1_000, { kin: true }).ok, false);
  assert.equal(wildCredit(kin, 'acct-b', 'bbbbbbbbbbbb', 1_500), null);
  // its striker gone from the room's memory
  const gone = stand();
  hit(gone, 1_000);
  gone.fighters.delete('acct-a');
  assert.equal(wildCredit(gone, 'acct-b', 'bbbbbbbbbbbb', 1_500), null);
  // a fall the referee saw is no second fall
  const seen = stand();
  for (let k = 0, now = 1_000; k < 400 && !seen.fighters.get('acct-b').down; k++, now += 300) hit(seen, now, { rid: `f${String(k).padStart(11, '0')}` });
  assert.equal(seen.fighters.get('acct-b').down, true);
  assert.equal(wildCredit(seen, 'acct-b', 'bbbbbbbbbbbb', 200_000), null);
});

test('AUDIT FOE-KEEPS E2 THE WIRE AND THE CLIENT: the zone word carries `dd` only as a word that it left the zone dying; my own game says it so when my health is gone (mutants: dd kept on a word that it stands in the zone; the host never saying it)', () => {
  assert.deepEqual(validWildData({ k: 'zone', z: 0, dd: 1 }), { k: 'zone', z: 0, dd: 1 });
  assert.deepEqual(validWildData({ k: 'zone', z: 1, dd: 1 }), { k: 'zone', z: 1 }, 'never with a word that it stands in it');
  assert.deepEqual(validWildData({ k: 'zone', z: 0, dd: true }), { k: 'zone', z: 0 }, 'one shape alone');
  assert.ok(rd('src/scenes/world.js').includes('    online?.setWildZone?.(wildCan() ? 1 : 0, playerEntity.health <= 0);'), 'the host says it');
  const o = rd('src/net/online.js');
  assert.ok(o.includes("this._sayZone(this._ws, v, !v && dead);"));
  assert.ok(o.includes("ws.send(JSON.stringify({ t: 'wild', data: { k: 'zone', z, ...(dead ? { dd: 1 } : {}) } }));"));
  assert.ok(rd('server/src/index.js').includes("if (k === 'zone') { await this._wildZoneWord(a, m.data.z, now, m.data.dd === 1); return; }"), 'the relay hands it on');
});

test('AUDIT FOE-KEEPS E2 THE RELAY: a player\'s blow, then my word that I left the zone dying inside the credit - the room hears my fall at that player\'s hand, the killer\'s pick signs it and the receipt names us both; a word without `dd`, or past the credit, is a foe\'s death and no fall (mutants: the relay\'s credit unasked; the fall unsaid)', async () => {
  const realNow = Date.now; let clock = 1_800_000_000_000; Date.now = () => clock;
  try {
    const PX = 400, PY = 120, CELL = worldRoom(PX, PY);
    const BASE = { x: PX * PIXEL_UNITS + 16384, z: (499 - PY) * PIXEL_UNITS + 16384 };
    const P = (x) => ({ x: BASE.x + x * M, y: 0, z: BASE.z, yaw: 0, pitch: 0 });
    const W = (x) => [BASE.x + x * M, 0, BASE.z];
    const LOOK = { race: 'Nord', gender: 'male', faceIndex: 0, items: [] };
    const refs = (ws, k) => ws.sent.filter((m) => m.t === 'wref' && (!k || m.k === k));
    const run = async (gapMs, word) => {
      const r = fakeRoom(CELL, { now: () => clock });
      const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
      r.env.GATE_SIGNING_KEY = Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64');
      const say = (ws, d) => r.raw(ws, JSON.stringify({ t: 'wild', data: d }));
      const join = async (id, x, ci) => { const ws = r.connect(); await r.hello(ws, id, P(x), { lv: 10, look: LOOK, rc: 1, ci }); return ws; };
      const a = await join('peer-0001', -1, 'r00000000000000000a02'), b = await join('peer-0002', 1, 'r00000000000000000a01'), c = await join('peer-0003', 30, 'r00000000000000000a03');
      for (const ws of [a, b]) await say(ws, { k: 'zone', z: 1 });
      clock += 300;
      await say(a, { k: 'strike', to: 'peer-0002', n: 1, by: 'melee', p: W(-1), d: 999 });
      assert.equal(refs(b, 'hp').length, 1, 'the blow landed');
      assert.equal(refs(b, 'fell').length, 0, 'and felled nobody');
      clock += gapMs;
      await say(b, word);
      return { r, a, b, c, say, kp };
    };
    const z = await run(WILD_KILL_CREDIT_MS - 500, { k: 'zone', z: 0, dd: 1 });
    const f = refs(z.b, 'fell')[0];
    assert.ok(f && validWildRefOut(f), 'my fall, said to me');
    assert.deepEqual([f.id, f.by], ['peer-0002', 'peer-0001'], 'at the striker\'s hand');
    assert.deepEqual(refs(z.c, 'fell'), [f], 'and to the room');
    await z.say(z.a, { k: 'pick', r: f.r, w: -1 });
    const rcB = refs(z.b, 'rc')[0], rcA = refs(z.a, 'rc')[0];
    assert.ok(rcB && rcA, 'signed and handed to us both');
    const claims = readWildReceipt(rcB.rc);
    assert.equal(claims.r, f.r);
    assert.notEqual(claims.f, claims.k, 'its fallen and its killer');
    assert.equal(claims.c, 'r00000000000000000a01', 'my realm character - the record the service takes the drop off');
    // no `dd`: a step out of the zone, no death
    assert.equal(refs((await run(1_000, { k: 'zone', z: 0 })).b, 'fell').length, 0);
    // past the credit: a foe's death
    assert.equal(refs((await run(WILD_KILL_CREDIT_MS + 500, { k: 'zone', z: 0, dd: 1 })).b, 'fell').length, 0);
  } finally { Date.now = realNow; }
});
