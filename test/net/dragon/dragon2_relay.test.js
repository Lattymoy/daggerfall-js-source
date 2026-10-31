// DRAGON2 (bible/11-Multiplayer/Dwarven-Dragon.md sections 4 and 7-8): THE DRAGON ON THE RELAY - over the real Room in a
// real cell (server/src/index.js, its half in server/src/dragonFights.js): the fight stood where its site is, the join and
// its refusals, the beat on the cell's alarm, the fan to who hears it and not past it, a blow from the socket's own pose,
// the kill said once with its receipts, the hub keeping each for its hellos, the fight forgotten after its keeping.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DRAGON_FIGHT_KEY, SOCIAL_ROOM, cellRoomOfWire, PIXEL_UNITS } from '../../../src/net/wire.js';
import { dragonTimes, dragonFightId, DRAGON_BRAIN_V, DRAGON_NATIVE_PER_M, DRAGON_CLIMB_MS } from '../../../src/net/dragon/dragonLaw.js';
import { RELAY_KEY, dragonOmenFrom, siteOf, aged } from '../../dragonOmen.mjs';
import { DRAGON_TICK_MS, DRAGON_OPENING_MS, DRAGON_FAN_R, DRAGON_ADMIT_R, DRAGON_TTK_S } from '../../../src/net/dragon/dragonBrain.js';
import { dpsRef } from '../../../src/net/gate/gateBrain.js';
import { verifyDragonReceipt } from '../../../src/net/dragon/dragonReceipt.js';
import { DRAGON_KEEP_MS } from '../../../server/src/dragonFights.js';
import { fakeRooms } from '../../fakeRoom.mjs';

const subtle = globalThis.crypto.subtle;
const OMEN = await dragonOmenFrom(500_000), { w: W } = OMEN;   // DRAGON-HIDDEN: a dragon's watch under the relay's own secret
const TT = dragonTimes(OMEN);
const { px: PX, py: PY } = siteOf(OMEN);   // DRAGON-CELL: a pixel of its omen's cell
const SX = (PX + 0.5) * PIXEL_UNITS, SZ = (499 - PY + 0.5) * PIXEL_UNITS;
const CELL = cellRoomOfWire(SX, SZ);
const ID = dragonFightId(W, SX, SZ), FIGHT_AT = `${DRAGON_FIGHT_KEY}:${ID}`;
/** A pose `mx` metres east and `mz` north of the site. */
const at = (mx, mz, extra = {}) => ({ x: SX + mx * DRAGON_NATIVE_PER_M, y: 0, z: SZ + mz * DRAGON_NATIVE_PER_M, yaw: 0, pitch: 0, ...extra });
const words = (ws, k) => ws.sent.filter((m) => m.t === 'dragon' && (!k || m.k === k));
const IN = (o = {}) => ({ k: 'in', w: W, bv: DRAGON_BRAIN_V, lv: 20, sx: SX, sz: SZ, ...o });
const fightIn = (r) => r.room._dg?.fights?.get(ID) ?? null;
async function withSky(fn, { start = TT.landAt + 60_000 } = {}) {
  const realNow = Date.now; let clock = start;
  try {
    Date.now = () => clock;
    const world = fakeRooms({ now: () => clock });
    const r = aged(world.room(CELL));
    r.env.GATE_SIGNING_KEY = RELAY_KEY.pkcs8;   // DRAGON-HIDDEN: no secret, no dragon
    const tick = async (n = 1) => { for (let i = 0; i < n; i++) { clock += DRAGON_TICK_MS; if (r.alarm.at != null && clock >= r.alarm.at) await r.fire(); } };
    const say = (ws, o) => r.raw(ws, JSON.stringify({ t: 'dragon', ...o }));
    await fn({ world, r, tick, say, now: () => clock, set: (t) => { clock = t; } });
  } finally { Date.now = realNow; }
}

test('DRAGON2 relay: THE JOIN - `in` from a pose near its site stands the fight in the cell and answers the whole state to its asker, the VERIFIED account joined with its share; the beat goes on the cell\'s alarm and its words reach every fighter and every socket within DRAGON_FAN_R - none past it (mutants: the state fanned to all; the frame\'s name credited; the fan unbounded)', async () => {
  assert.ok(Math.hypot(0, -4200) > DRAGON_FAN_R && cellRoomOfWire(at(0, -4200).x, at(0, -4200).z) === CELL, 'the far socket is in the same cell, past the fan');
  await withSky(async ({ r, tick, say, now }) => {
    const a = r.connect(), b = r.connect(), c = r.connect();
    await r.hello(a, 'peer-0001', at(60, 0)); await r.hello(b, 'peer-0002', at(2500, 0)); await r.hello(c, 'peer-0003', at(0, -4200));
    await say(a, IN());
    const st = words(a, 'st')[0];
    assert.deepEqual([st.w, st.b, st.ph, st.m], [W, 0, 1, DRAGON_TTK_S * dpsRef(20)]);
    assert.ok(fightIn(r).players['acct-peer-0001'], 'the account the token verified');
    assert.equal(r.store.get(FIGHT_AT).w, W, 'kept at once');
    assert.equal(words(b).length + words(c).length, 0, 'the state went to its asker alone');
    assert.equal(r.alarm.at, now() + DRAGON_TICK_MS, 'the beat armed');
    await tick(Math.ceil(DRAGON_OPENING_MS / DRAGON_TICK_MS) + 40);
    const heard = words(a).filter((m) => m.k !== 'st');
    assert.ok(heard.some((m) => m.k === 'atk'), 'it struck after its opening');
    assert.ok(heard.every((m) => m.w === W && m.sx === SX && m.sz === SZ), 'every word names its fight');
    assert.deepEqual(words(b).filter((m) => m.k !== 'st'), heard, 'a watcher in its sky heard every word');
    assert.equal(words(c).length, 0, 'past DRAGON_FAN_R, nothing');
  });
});

test('DRAGON2 relay: THE REFUSALS - a game older than its law (`reload`), a watch the clock is not about, a pose too far from it, a site in another cell (junk - no fight stood) (mutants: each refusal removed)', async () => {
  await withSky(async ({ r, say }) => {
    const a = r.connect(); await r.hello(a, 'peer-0001', at(100, 0));
    await say(a, IN({ bv: 0 }));
    assert.deepEqual(words(a).at(-1), { t: 'dragon', k: 'no', m: 'reload' });
    await say(a, IN({ w: W + 1 }));
    assert.deepEqual(words(a).at(-1), { t: 'dragon', k: 'no', m: 'gone' });
    await say(a, IN({ sx: SX + 20 * PIXEL_UNITS }));
    assert.equal(fightIn(r), null, 'a site in another cell stands nothing here');
    const far = r.connect(); await r.hello(far, 'peer-0002', at(DRAGON_ADMIT_R + 100, 0));
    await say(far, IN());
    assert.deepEqual(words(far).at(-1), { t: 'dragon', k: 'no', m: 'far' });
    assert.equal(fightIn(r), null);
    await say(a, IN());
    assert.ok(fightIn(r).players['acct-peer-0001']);
  });
  await withSky(async ({ r, say }) => {
    const a = r.connect(); await r.hello(a, 'peer-0001', at(100, 0));
    await say(a, IN());
    assert.deepEqual(words(a).at(-1), { t: 'dragon', k: 'no', m: 'gone' }, 'after it leaves, no fight is stood');
    assert.equal(fightIn(r), null);
  }, { start: TT.leaveAt + 1 });
});

test('DRAGON2 relay: A DRAGON_BLOW - believed from where the socket\'s OWN pose stands: before `in` it is not heard, a dead pose lands nothing (mutants: the frame trusted for where it stood; the dead striking)', async () => {
  await withSky(async ({ r, tick, say }) => {
    const a = r.connect(); await r.hello(a, 'peer-0001', at(40, 0));
    await say(a, { k: 'hit', d: 30, r: 1 });
    assert.equal(fightIn(r), null, 'no fight, nothing');
    await say(a, IN());
    await tick(2);
    await say(a, { k: 'hit', d: 30, r: 1 });
    assert.equal(fightIn(r).players['acct-peer-0001'].dealt, 30);
    await r.pose(a, at(40, 0, { dd: 1 }));
    await say(a, { k: 'hit', d: 30, r: 1 });
    assert.equal(fightIn(r).players['acct-peer-0001'].dealt, 30, 'the dead strike nothing');
  });
});

test('DRAGON2 relay: THE KILL - said once to everyone about it, a z1 receipt to exactly the accounts that earned one (signed by GATE_SIGNING_KEY), the fight checkpointed with them, the hub keeping each for its hello; a fighter back at an `in` is handed theirs again; the fight forgotten after its keeping (mutants: a receipt to one who earned nothing; the hub told nothing; said twice)', async () => {
  await withSky(async ({ world, r, tick, say, now, set }) => {
    const hub = world.room(SOCIAL_ROOM);
    const a = r.connect(), w = r.connect(), idle = r.connect();
    await r.hello(a, 'peer-0001', at(40, 0)); await r.hello(w, 'peer-0002', at(1500, 900)); await r.hello(idle, 'peer-0003', at(0, 550));
    await say(a, IN({ lv: 33 }));
    await say(idle, IN());   // in its fight, never near it: it stood nothing and dealt nothing
    const f = fightIn(r);
    await tick(1);
    f.hp = 5;
    f.players['acct-peer-0001'].dealt = 1000;   // a real part in the fight before its last blow
    await say(a, { k: 'hit', d: 40, r: 1 });
    const fell = words(a, 'fell');
    assert.equal(fell.length, 1);
    assert.deepEqual(words(w, 'fell'), fell, 'the watcher heard it');
    const mine = words(a, 'rcpt');
    assert.equal(mine.length, 1);
    assert.equal(words(idle, 'rcpt').length, 0, 'it earned no receipt');
    const ok = await verifyDragonReceipt(mine[0].r, RELAY_KEY.publicKey, { subtle, nowS: Math.floor(now() / 1000) });
    assert.equal(ok.ok, true);
    assert.deepEqual([ok.claims.s, ok.claims.q, ok.claims.b, ok.claims.x, ok.claims.l], ['acct-peer-0001', W, 0, 'dealt', 33]);
    assert.equal(r.store.get(FIGHT_AT).said, true, 'checkpointed with the kill');
    assert.equal(r.store.get(FIGHT_AT).told, true, 'the hub answered');
    const late = hub.connect(); await hub.hello(late, 'peer-0001');
    assert.deepEqual(words(late, 'rcpt').map((m) => m.r), [mine[0].r], 'the hub hands it to a hello');
    await tick(4);
    assert.equal(words(a, 'fell').length, 1, 'said once');
    const back = r.connect(); await r.hello(back, 'peer-0001', at(30, 0));
    await say(back, IN());
    assert.deepEqual(words(back, 'rcpt').map((m) => m.r), [mine[0].r], 'handed again');
    set(TT.leaveAt + DRAGON_KEEP_MS + DRAGON_CLIMB_MS + 1);
    await r.fire();
    assert.equal(r.store.has(FIGHT_AT), false, 'forgotten after its keeping');
  });
});
