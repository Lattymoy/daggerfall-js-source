// DRAGON3 (bible/11-Multiplayer/Dwarven-Dragon.md section 7): A SLAIN DRAGON'S REMAINS ON THE RELAY - over the real Room in a real
// cell (server/src/dragonFights.js): its state said every DRAGON_STATE_SEND_MS to who hears it while its remains lie, never
// after; and an `in` past its leaving answered with its state before its `gone`, so a player who comes after the kill sees
// it lying, not the clock's dragon still circling. tools/mutants/dragon3.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cellRoomOfWire, PIXEL_UNITS } from '../../../src/net/wire.js';
import { dragonTimes, dragonFightId, DRAGON_BRAIN_V, DRAGON_NATIVE_PER_M, DRAGON_CLIMB_MS, DRAGON_REMAINS_MS } from '../../../src/net/dragon/dragonLaw.js';
import { DRAGON_TICK_MS, DRAGON_STATE_SEND_MS } from '../../../src/net/dragon/dragonBrain.js';
import { fakeRooms } from '../../fakeRoom.mjs';
import { RELAY_KEY, dragonOmenFrom } from '../../dragonOmen.mjs';

const OMEN = await dragonOmenFrom(500_000), { w: W } = OMEN;   // DRAGON-HIDDEN: a dragon's watch under the relay's own secret
const TT = dragonTimes(OMEN);
const PX = 205, PY = 214;
const SX = (PX + 0.5) * PIXEL_UNITS, SZ = (499 - PY + 0.5) * PIXEL_UNITS;
const CELL = cellRoomOfWire(SX, SZ);
const ID = dragonFightId(W, SX, SZ);
const at = (mx, mz) => ({ x: SX + mx * DRAGON_NATIVE_PER_M, y: 0, z: SZ + mz * DRAGON_NATIVE_PER_M, yaw: 0, pitch: 0 });
const words = (ws, k) => ws.sent.filter((m) => m.t === 'dragon' && (!k || m.k === k));
const IN = () => ({ k: 'in', w: W, bv: DRAGON_BRAIN_V, lv: 20, sx: SX, sz: SZ });

test('DRAGON3 relay: ITS REMAINS ARE TOLD - once slain, its state (with its fall) goes to who hears it every DRAGON_STATE_SEND_MS while its remains lie, and none after; an `in` past its leaving hears its state, then its `gone` (mutants: the remains untold; told for ever; the late `in` answered with `gone` alone)', async () => {
  const realNow = Date.now; let clock = TT.landAt + 60_000;
  try {
    Date.now = () => clock;
    const world = fakeRooms({ now: () => clock });
    const r = world.room(CELL);
    r.env.GATE_SIGNING_KEY = RELAY_KEY.pkcs8;   // DRAGON-HIDDEN: no secret, no dragon
    const say = (ws, o) => r.raw(ws, JSON.stringify({ t: 'dragon', ...o }));
    const a = r.connect(), far = r.connect();
    await r.hello(a, 'peer-0001', at(40, 0)); await r.hello(far, 'peer-0002', at(2500, 0));
    await say(a, IN());
    const f = r.room._dg.fights.get(ID);
    clock += DRAGON_TICK_MS; await r.fire();
    f.hp = 5; f.players['acct-peer-0001'].dealt = 1000;
    await say(a, { k: 'hit', d: 40, r: 1 });
    assert.equal(words(far, 'fell').length, 1, 'the kill heard');
    const before = words(far, 'st').length;
    for (let k = 0; k < 4; k++) { clock += DRAGON_STATE_SEND_MS; if (r.alarm.at != null && clock >= r.alarm.at) await r.fire(); }
    const told = words(far, 'st').slice(before);
    assert.ok(told.length >= 3, `its remains told (${told.length})`);
    assert.ok(told.every((m) => m.fell && m.w === W && m.sx === SX), 'its fall in each');
    clock = f.fell.at + DRAGON_REMAINS_MS + 1;
    if (r.alarm.at != null) await r.fire();
    const after = words(far, 'st').length;
    clock += 3 * DRAGON_STATE_SEND_MS;
    if (r.alarm.at != null && clock >= r.alarm.at) await r.fire();
    assert.equal(words(far, 'st').length, after, 'none once its remains have lain their time');
    // a player come after its leaving, while a late kill's remains still lie
    clock = TT.leaveAt + DRAGON_CLIMB_MS + 1000;
    f.fell.at = TT.leaveAt - 1000;
    const late = r.connect(); await r.hello(late, 'peer-0003', at(30, 0));
    await say(late, IN());
    const got = words(late);
    assert.deepEqual(got.map((m) => m.k), ['st', 'no'], JSON.stringify(got.map((m) => m.k)));
    assert.ok(got[0].fell && got[1].m === 'gone');
  } finally { Date.now = realNow; }
});
