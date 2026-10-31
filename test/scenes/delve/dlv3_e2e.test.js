// DLV3 END TO END (AUDIT DLV3: TEST THE SHAPE THE PRODUCER MINTS): the real host (test/scenes/delve/delveRig.mjs) wired to
// the real Room (test/fakeRoom.mjs) - every word it says sent with its pose made current first (net/online.js
// _poseCurrent), every word the room says read through the wire's own law (net/wire.js validDelveOut) before the host
// hears it. A kind whose state the wire drops, a machine that lets its foes go on its own next word, a count carried
// from one attempt into the next: each fails here, where a pin of hand-built frames could not see it.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validDelveOut } from '../../../src/net/wire.js';
import { DP, DELVE_KIND_NAMES, sealSpots, VIGIL_REST_MS, HOLD_GATHER_MS, litanyPlates, litanyShowMs } from '../../../src/net/delve/delveLaw.js';
import { HIT_KINDS } from '../../../src/net/gate/gateBrain.js';
import { Room } from '../../../server/src/index.js';
import { fakeRooms } from '../../fakeRoom.mjs';
import { dungeonOf, seedFor, flush } from './delveRig.mjs';
import { _setDelveWireForTests, wireDelve } from '../../../src/net/delve/delveLink.js';
import { delveCrystalC } from '../../../src/scenes/delve/delveBodies.js';
import { _resetForTests } from '../../../src/systems/uiPrefs.js';

const quiet = async (fn) => { const w = console.warn, i = console.info; console.warn = () => {}; console.info = () => {}; try { return await fn(); } finally { console.warn = w; console.info = i; } };

/** One page in a dungeon's room, its host the rig's, on a clock of the pin's. `fn` gets `go(ms, feet)`: frames of 100 ms
 *  at `feet`, each word the host said delivered, each the room said heard; `log` every room word as read (or dropped).
 *  `lag`: the room hears last frame's feet, as the real page says its pose before the dungeon moves the player. */
async function e2e(kind, fn, { lag = false } = {}) {
  const realNow = Date.now, realKin = Room.prototype._instanceKinOf; let clock = 1_800_000_000_000; Date.now = () => clock;
  Room.prototype._instanceKinOf = async () => false;
  try {
    await quiet(async () => {
      _resetForTests();
      const r = fakeRooms({ now: () => clock }).room('dungeon:m7');
      const ws = r.connect();
      await r.hello(ws, 'id-A', null, { name: 'A', kind: 'linked', tokenSub: 'acct-A', charLevel: 6 });
      const hear = wireDelve({});
      const queue = [];
      _setDelveWireForTests({ send: (w) => { queue.push(w); return true; }, ready: () => true });
      const D = dungeonOf(seedFor(kind), undefined, { online: () => true });
      const s = D.host.sites[0];
      let read = 0;
      const log = [];
      let was = null;
      const go = async (ms, feet) => {
        for (let k = 0; k < ms; k += 100) {
          const heard = lag && was ? was : feet;
          D.host.frame(0.1, feet);
          was = feet;
          clock += 100;
          while (queue.length) {
            const w = queue.shift();
            await r.pose(ws, { x: heard[0], y: heard[1], z: heard[2], yaw: 0, pitch: 0 });
            await r.raw(ws, JSON.stringify({ t: 'dv', ...w }));
          }
          for (; read < ws.sent.length; read++) {
            const m = ws.sent[read];
            if (m.t !== 'dv') continue;
            const p = validDelveOut(m);
            log.push(p ?? { dropped: m });
            if (p) hear(p);
          }
          await flush();
        }
      };
      await fn({ D, s, go, r, log, step: (ms) => { clock += ms; } });
      D.host.destroy();
    });
  } finally { Date.now = realNow; Room.prototype._instanceKinOf = realKin; }
}
const fmsOf = (log) => log.filter((m) => m.k === 'dl' && m.i === 0).map((m) => m.me.fm);

test('DLV3 E2E EVERY KIND ONLINE: woken from its ward, its state read through the wire and none dropped, its pieces there to strike; a page alone the foes\' machine from its first word to the last - never let go by its own word (AUDIT DLV3 1, 4 - mutants: the seals\' window said as a wave\'s size; a puzzle\'s machine offering nothing)', async () => {
  for (const kind of DELVE_KIND_NAMES) {
    await e2e(kind, async ({ D, s, go, log }) => {
      assert.equal(s.kind, kind);
      await go(500, [s.x + 30, s.y, s.z]);
      await go(HOLD_GATHER_MS + 2_000, [s.x, s.y, s.z]);
      assert.deepEqual(log.filter((m) => m.dropped).map((m) => m.dropped.k), [], `${kind}: every word the room said, the wire read`);
      assert.notEqual(D.host.state()[0].p, DP.idle, `${kind}: running`);
      if (kind === 'seals' || kind === 'wellsprings') assert.ok(D.host.breakables().length > 0, `${kind}: its pieces to strike`);
      const fms = fmsOf(log), named = fms.indexOf(1);
      assert.ok(named >= 0 && fms.slice(named).every((f) => f === 1), `${kind}: the machine kept (${fms.join('')})`);
    });
  }
});

test('DLV3 E2E THE SEALS WON ONLINE: the seals risen, each struck within reach of the pose the room heard, broken before their window, the vault my share (AUDIT DLV3 1 - mutants: the window\'s field)', async () => {
  await e2e('seals', async ({ D, s, go }) => {
    await go(500, [s.x + 30, s.y, s.z]);
    await go(4_000, [s.x, s.y, s.z]);
    const st = D.host.state()[0];
    assert.equal(st.p, DP.work);
    for (const [j, at] of sealSpots(s, st.k).entries()) {
      for (let n = 0; n < 20 && (D.host.state()[0].hp[j] ?? 0) > 0; n++) { D.host.hit(delveCrystalC(0, j), 50, HIT_KINDS.Melee); await go(600, at); }
      assert.equal(D.host.state()[0].hp[j] ?? 0, 0, `seal ${j} broken`);
    }
    assert.equal(D.host.state()[0].won, true, 'won online');
    D.host.press('delve:vault:0');
    await go(200, [s.x, s.y, s.z]);
    assert.ok(D.host.contents('delve:vault:0').length > 0, 'my share, rolled when the room says it is mine');
  });
});

test('DLV3 E2E THE VIGIL TWICE: its relic struck dark, rested, woken again - the second attempt\'s count from nothing, never dark without a blow (AUDIT DLV3 3 - mutants: the count carried over)', async () => {
  await e2e('vigil', async ({ D, s, go, log, step }) => {
    await go(500, [s.x + 30, s.y, s.z]);
    await go(HOLD_GATHER_MS + 1_000, [s.x, s.y, s.z]);
    for (let n = 0; n < 60 && D.host.state()[0].p !== DP.idle; n++) { for (const w of D.host.wards()) for (let b = 0; b < 3; b++) w.hurtFromFoe(); await go(1_000, [s.x, s.y, s.z]); }
    const ends = () => log.filter((m) => m.k === 'ev').flatMap((m) => m.ev.map((e) => e.k)).filter((k) => k === 'failed').length;
    assert.equal(ends(), 1, 'the first dark');
    step(VIGIL_REST_MS);
    await go(HOLD_GATHER_MS + 20_000, [s.x, s.y, s.z]);
    assert.notEqual(D.host.state()[0].p, DP.idle, 'woken again');
    assert.equal(ends(), 1, 'twenty seconds and no blow: not dark');
  });
});

test('LITANY-STAND E2E: the Litany won online with the room hearing last frame\'s feet, as the real page says them - each plate walked onto and stood on is lit, the vault my share (mutants: the plate said at this frame\'s feet)', async () => {
  await e2e('litany', async ({ D, s, go }) => {
    const heart = [s.x, s.y, s.z], plates = litanyPlates(s);
    await go(500, [s.x + 30, s.y, s.z]);
    await go(1_500, heart);
    const order = D.host.state()[0].order;
    assert.equal(order.length, 4, 'the order heard while shown');
    await go(litanyShowMs(4), heart);
    assert.equal(D.host.state()[0].p, DP.work);
    for (const [n, j] of order.entries()) {
      await go(300, plates[j]);
      assert.equal(D.host.state()[0].next, n + 1, `plate ${j} lit, stood on`);
      await go(300, heart);
    }
    assert.equal(D.host.state()[0].won, true, 'won online');
    D.host.press('delve:vault:0');
    await go(200, heart);
    const vault = D.host.contents('delve:vault:0');
    assert.ok(vault.length >= 2 && vault[0].isIdentified && vault.at(-1).group === 'Currency', 'my share: the piece, the pile, the gold');
  }, { lag: true });
});
