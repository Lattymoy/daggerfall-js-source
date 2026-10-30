// SERPENT-RETRY (2026-10-29, the owner: "finish the not done and not fixed"; bible/11-Multiplayer/Sea-Serpent.md): A KILL
// WHOSE RECEIPTS FAIL TO MINT IS TRIED AGAIN. The beat scheduled the next step only for a kill already said, so a mint that
// threw (the key store hiccuping) left the fight's alarm at its end - its keeping, hours on, when the fight is forgotten
// and no fighter is paid. The dragon's AUDIT DRAGON found the same gap in its own beat. tools/mutants/serpentretry.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SERPENT_FIGHT_KEY, SERPENT_TELL_RETRY_MS, serpentFightId, cellRoomOfWire, PIXEL_UNITS } from '../../../src/net/wire.js';
import { serpentTimes, serpentSiteKey, SERPENT_BRAIN_V, SERPENT_NATIVE_PER_M } from '../../../src/net/serpent/serpentLaw.js';
import { SERPENT_TICK_MS } from '../../../src/net/serpent/serpentBrain.js';
import { fakeRooms } from '../../fakeRoom.mjs';

const { subtle } = globalThis.crypto;
const DAY = 363, TT = serpentTimes(DAY);
const PX = 205, PY = 214;
const SX = (PX + 0.5) * PIXEL_UNITS, SZ = (499 - PY + 0.5) * PIXEL_UNITS;
const at = (mx, mz) => ({ x: SX + mx * SERPENT_NATIVE_PER_M, y: 0, z: SZ + mz * SERPENT_NATIVE_PER_M, yaw: 0, pitch: 0 });
const ID = serpentFightId(DAY, serpentSiteKey(SX, SZ));

test('SERPENT-RETRY a kill whose receipts fail to mint is tried again at SERPENT_TELL_RETRY_MS, never left to the fight\'s end, and then said with its receipt (mutants: no retry)', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64');
  const realNow = Date.now; let clock = TT.riseAt + 20_000;
  try {
    Date.now = () => clock;
    const world = fakeRooms({ now: () => clock });
    const r = world.room(cellRoomOfWire(SX, SZ));
    r.env.GATE_SIGNING_KEY = pkcs8;
    const a = r.connect(); await r.hello(a, 'peer-0001', at(120, 0));
    const say = (o) => r.raw(a, JSON.stringify({ t: 'serpent', ...o }));
    await say({ k: 'in', d: DAY, bv: SERPENT_BRAIN_V, lv: 20, hl: 4, sx: SX, sz: SZ });
    clock += SERPENT_TICK_MS; if (r.alarm.at != null && clock >= r.alarm.at) await r.fire();
    const f = r.room._serpents.get(ID);
    f.legs = [{ k: 1, at: clock - 30_000, x: -60, z: 0, yw: 0, v: 11, r: 60, sd: 1, j: 1 }];
    f.modes = [{ at: clock - 30_000, m: 1 }];
    f.hp = 5; f.nextAt = Infinity;
    const keyOf = r.room._receiptKeyOf.bind(r.room);
    let fail = true;
    r.room._receiptKeyOf = async () => { if (fail) throw new Error('the key store hiccuped'); return keyOf(); };
    await say({ k: 'hit', d: 40, z: 0 });
    assert.ok(f.fell, 'slain');
    for (let i = 0; i < 3; i++) {
      clock = Math.max(clock + SERPENT_TICK_MS, r.alarm.at ?? 0); await r.fire();
      assert.equal(f.fell != null && !f.said, true, 'fell, its receipts not yet minted');
      assert.ok(r.alarm.at <= clock + SERPENT_TELL_RETRY_MS, `tried again soon (${r.alarm.at - clock} ms), not at its end`);
    }
    fail = false;
    clock = r.alarm.at; await r.fire();
    assert.equal(r.store.get(`${SERPENT_FIGHT_KEY}:${ID}`).said, true, 'then said');
    assert.ok(a.sent.some((m) => m.t === 'serpent' && m.k === 'rcpt'), 'and its receipt handed');
  } finally { Date.now = realNow; }
});
