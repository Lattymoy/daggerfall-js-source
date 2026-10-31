// AUDIT DRAGON (2026-10-29, the owner: "Can we audit everything and ensure perfection"; bible/11-Multiplayer/
// Dwarven-Dragon.md section 13): THE FIGHT'S FINDINGS - a fight whose every share retired stands at the fraction the last
// left at (the gate's `idle`); the ground counted from the landing, never the dive; the Strafing Run's sweep on the wire
// and judged over its length; a kill whose receipts failed tried again; the hub's dragon receipts swept and its cache
// bounded; a seat's part the gate's own time. tools/mutants/dragonaudit.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dragonTimes, dragonFightId, DRAGON_BRAIN_V, DRAGON_NATIVE_PER_M } from '../../../src/net/dragon/dragonLaw.js';
import { roostLeg } from '../../../src/net/dragon/dragonBody.js';
import * as B from '../../../src/net/dragon/dragonBrain.js';
import { DRAGON_SEAM } from '../../../src/net/bossSeam.js';
import { HIT_KINDS, SEAT_KEEP_MS } from '../../../src/net/gate/gateBrain.js';
import { egBlowVerdict } from '../../../src/net/eliteGates/egShape.js';
import { validDragonOut, DRAGON_FIGHT_KEY, DRAGON_TELL_RETRY_MS, cellRoomOfWire, PIXEL_UNITS, DRAGON_RC_PREFIX } from '../../../src/net/wire.js';
import { foldDragon, DRAGON_STATE_EMPTY } from '../../../src/net/dragon/dragonLink.js';
import { sweepDragonReceipts } from '../../../server/src/dragonFights.js';
import { fakeRooms } from '../../fakeRoom.mjs';
import { RELAY_KEY, dragonOmenFrom, siteOf, aged } from '../../dragonOmen.mjs';

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const seeded = (s = 7) => () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
const OMEN = await dragonOmenFrom(500_000), W = OMEN.w;   // DRAGON-HIDDEN: a dragon's watch under the relay's own secret
const T = dragonTimes(OMEN);
const birth = (now = T.landAt + 60_000) => DRAGON_SEAM.new({ w: W, b: 0, sx: 0, sz: 0, now, leaveAt: T.leaveAt, roost: roostLeg(OMEN) });
const BODIES = [{ sub: 'a', x: 10, z: 0 }, { sub: 'b', x: -15, z: 20 }, { sub: 'c', x: 5, z: -25 }];
/** The brain stepped until `pred` holds of a word it says: `{ f, word, now }`. */
function stepUntil(pred, ms = 20 * 60_000) {
  const now0 = T.landAt + 60_000, f = birth(now0);
  for (const b of BODIES) B.joinDragonFight(f, b.sub, b.sub, 20, now0, true);
  const rng = seeded(11);
  for (let now = now0; now < now0 + ms && !f.fell; now += 250) {
    for (const w of B.stepDragonBrain(f, now, BODIES, rng)) if (pred(w)) return { f, word: w, now };
    if (now % 1000 === 0) for (const b of BODIES) B.applyDragonHit(f, b.sub, 20, HIT_KINDS.Shaft, b, now);
  }
  throw new Error('never said');
}

test('AUDIT DRAGON the last share out keeps its fraction: a solo fighter away past DRAGON_ABSENT_RETIRE_MS comes back to the dragon as it left it, and a newcomer joins it there with an empty bucket - never a whole one (mutants: the fraction forgotten)', () => {
  const now = T.landAt + 60_000, f = birth(now);
  B.joinDragonFight(f, 'a', 'A', 20, now, true);
  f.hp = f.max * 0.1;
  B.retireDragonShare(f, f.players.a);
  assert.equal(f.max, 0);
  B.joinDragonFight(f, 'a', 'A', 20, now + 60_000, true);
  assert.ok(Math.abs(f.hp / f.max - 0.1) < 1e-9, `back to ${f.hp / f.max}, not whole`);
  B.retireDragonShare(f, f.players.a);
  B.joinDragonFight(f, 'b', 'B', 20, now + 90_000, true);
  assert.ok(Math.abs(f.hp / f.max - 0.1) < 1e-9, 'a newcomer joins it as it stands');
  assert.equal(f.players.b.bucket, 0, 'with an empty bucket');
});

test('AUDIT DRAGON a Crash Landing grounds it at its landing: through the dive a shaft lands at its own weight and a melee swing is refused; from the landing both land, at GROUNDED_X; the state carries the time and the client folds it (mutants: grounded at the throw; the state\'s time dropped)', () => {
  const { f, word } = stepUntil((w) => w.k === 'md' && w.m === B.DRAGON_MODE.ground);
  assert.equal(f.ma, word.at, 'the mode takes hold at its landing');
  const under = { ...B.dragonPlaceAt(f, word.at), sub: 'a' };
  const pose = { x: under.x + B.WALK_STOP_M / 2, z: under.z, dead: false };
  f.players.a.bucket = 1e9;
  const before = word.at - 500;
  assert.equal(B.dragonGroundedAt(f, before), false);
  assert.equal(B.applyDragonHit(f, 'a', 10, HIT_KINDS.Melee, pose, before), 0, 'no swing reaches it in its dive');
  const shot = B.applyDragonHit(f, 'a', 10, HIT_KINDS.Shaft, pose, before);
  assert.ok(shot > 0 && shot <= 10, `a shaft at its own weight (${shot})`);
  f.players.a.bucket = 1e9;
  assert.equal(B.dragonGroundedAt(f, word.at + 10), true);
  assert.ok(B.applyDragonHit(f, 'a', 10, HIT_KINDS.Melee, pose, word.at + 10) > 10, 'on the ground: the swing lands, at GROUNDED_X');
  const st = B.dragonStateOf(f);
  assert.equal(st.ma, word.at);
  const wired = validDragonOut({ ...st, t: 'dragon', w: W, sx: 0, sz: 0, b: 0 });
  assert.equal(wired.ma, word.at, 'the wire keeps it');
  const folded = foldDragon(DRAGON_STATE_EMPTY, { ...wired, w: W, sx: 0, sz: 0 }, word.at - 1000);
  assert.equal(folded.ma, word.at, 'a joiner mid-dive sees it aloft until it lands');
});

test('AUDIT DRAGON the Strafing Run\'s sweep: its word, the state and the wire carry `sp`, the client keeps it, and a player who steps into its lane during the sweep is struck (mutants: the span dropped at the word; at the wire)', () => {
  const { f, word } = stepUntil((w) => w.k === 'atk' && w.a === B.DRAGON_BLOW.strafe.id);
  assert.equal(word.sp, B.STRAFE_RUN_MS / 2);
  assert.equal(B.dragonStateOf(f).blows.find((b) => b.i === word.i)?.sp, word.sp, 'the state keeps it');
  const wired = validDragonOut({ ...word, t: 'dragon', w: W, sx: 0, sz: 0 });
  assert.equal(wired.sp, word.sp, 'the wire keeps it');
  assert.equal(validDragonOut({ ...word, t: 'dragon', w: W, sx: 0, sz: 0, sp: 60_000 }), null, 'a span past the bound refused');
  const s0 = foldDragon(DRAGON_STATE_EMPTY, { ...validDragonOut({ ...B.dragonStateOf(f), t: 'dragon', w: W, sx: 0, sz: 0 }), w: W, sx: 0, sz: 0 }, word.at - 3000);
  const s1 = foldDragon(s0, { ...wired, w: W, sx: 0, sz: 0 }, word.at - 3000);
  const kept = s1.blows.find((b) => b.i === word.i);
  assert.equal(kept?.sp, word.sp, 'the client keeps it');
  const [, x0, z0, x1, z1] = word.s[0];
  const mid = [(x0 + x1) / 2, (z0 + z1) / 2];
  const inSweep = word.at + word.sp - 100;
  assert.equal(egBlowVerdict(kept, mid[0], mid[1], inSweep, 300), 'hit', 'struck inside its sweep');
  assert.equal(egBlowVerdict({ ...kept, sp: undefined }, mid[0], mid[1], inSweep, 300), 'miss', 'which a blow of no span would miss');
});

test('AUDIT DRAGON a seat\'s part: the gate\'s SEAT_KEEP_MS stood, half a minute (mutants: the time)', () => {
  assert.equal(B.dragonHasPart({ dealt: 0, share: 100, stoodMs: SEAT_KEEP_MS - 1 }), false);
  assert.equal(B.dragonHasPart({ dealt: 0, share: 100, stoodMs: SEAT_KEEP_MS }), true);
  assert.equal(SEAT_KEEP_MS, 30_000);
});

test('AUDIT DRAGON the hub\'s receipts: every expired one swept in its page, a live one kept, a full page goes on; the hub\'s sweep runs it and its cache is the serpent\'s bound (mutants: none swept; the live one swept)', async () => {
  const now = 1_800_000_000_000;
  const store = new Map([[`${DRAGON_RC_PREFIX}acct-1`, { q: 1, r: 'z1.a.b', e: now / 1000 - 1 }], [`${DRAGON_RC_PREFIX}acct-2`, { q: 1, r: 'z1.a.b', e: now / 1000 + 600 }], [`${DRAGON_RC_PREFIX}acct-3`, null]]);
  const room = { state: { storage: { list: async ({ prefix, limit }) => new Map([...store].filter(([k]) => k.startsWith(prefix)).slice(0, limit)) } } };
  const dead = [];
  const r = await sweepDragonReceipts(room, now, null, dead, 10);
  assert.deepEqual(dead.sort(), [`${DRAGON_RC_PREFIX}acct-1`, `${DRAGON_RC_PREFIX}acct-3`]);
  assert.deepEqual([r.full, r.last], [false, `${DRAGON_RC_PREFIX}acct-3`]);
  assert.equal((await sweepDragonReceipts(room, now, null, [], 2)).full, true, 'a full page: the sweep goes on');
  const idx = src('server/src/index.js');
  assert.match(idx, /const dragonRc = await sweepDragonReceipts\(this, now, cur\.get\('sweep:dragonrc'\) \?\? null, dead, SWEEP_PAGE\);/);
  assert.match(idx, /'sweep:dragonrc': dragonRc\.full \? dragonRc\.last : null,/);
  assert.match(src('server/src/dragonFights.js'), /noRcpt: new Bounded\(HUB_KEEP_MAX\),\n\s*stood: new WeakMap\(\),\n\s*judged: new Map\(\),\n\s*refused: new Map\(\),\n\s*asking: new Map\(\),\n\s*budget: new Map\(\),\n\s*\}\);/);   // PIN MOVED (AUDIT DRAGON-CELL II E1): each socket's cell clock beside it; (DRAGON-BUDGET) and the cells judged; (AUDIT DRAGON-CELL III G5) the budgets spent and the asks in flight
});

test('AUDIT DRAGON a kill whose receipts fail to mint is tried again at DRAGON_TELL_RETRY_MS, never left to the fight\'s end two hours on, and then said (mutants: no retry)', async () => {
  const { px: PX, py: PY } = siteOf(OMEN), SX = (PX + 0.5) * PIXEL_UNITS, SZ = (499 - PY + 0.5) * PIXEL_UNITS;   // DRAGON-CELL: a pixel of its omen's cell
  const ID = dragonFightId(W, SX, SZ);
  const at = (mx, mz) => ({ x: SX + mx * DRAGON_NATIVE_PER_M, y: 0, z: SZ + mz * DRAGON_NATIVE_PER_M, yaw: 0, pitch: 0 });
  const subtle = globalThis.crypto.subtle;
  const realNow = Date.now; let clock = T.landAt + 60_000;
  try {
    Date.now = () => clock;
    const world = fakeRooms({ now: () => clock });
    const r = aged(world.room(cellRoomOfWire(SX, SZ)));
    r.env.GATE_SIGNING_KEY = RELAY_KEY.pkcs8;
    const a = r.connect();
    await r.hello(a, 'peer-0001', at(40, 0));
    await r.raw(a, JSON.stringify({ t: 'dragon', k: 'in', w: W, bv: DRAGON_BRAIN_V, lv: 20, sx: SX, sz: SZ }));
    const f = r.room._dg.fights.get(ID);
    const keyOf = r.room._receiptKeyOf.bind(r.room);
    let fail = true;
    r.room._receiptKeyOf = async () => { if (fail) throw new Error('the key store hiccuped'); return keyOf(); };
    f.hp = 5; f.players['acct-peer-0001'].dealt = 1000;
    await r.raw(a, JSON.stringify({ t: 'dragon', k: 'hit', d: 40, r: 1 }));
    for (let i = 0; i < 3; i++) {
      clock = Math.max(clock + B.DRAGON_TICK_MS, r.alarm.at ?? 0); await r.fire();
      assert.equal(f.fell != null && !f.said, true, 'fell, its receipts not yet minted');
      assert.ok(r.alarm.at <= clock + DRAGON_TELL_RETRY_MS, `tried again soon (${r.alarm.at - clock} ms), not at its end`);
    }
    fail = false;
    clock = r.alarm.at; await r.fire();
    assert.equal(r.store.get(`${DRAGON_FIGHT_KEY}:${ID}`).said, true, 'then said');
    assert.ok(a.sent.some((m) => m.t === 'dragon' && m.k === 'rcpt'), 'and its receipt handed');
  } finally { Date.now = realNow; }
});
