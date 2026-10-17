// AUDIT EG IV (2026-10-13, the Elite Gates arc's fourth audit; bible/11-Multiplayer/Elite-Gates.md sections 5, 22, 23 and
// 29) - THE NET GROUP'S CLIENT HALF, PINNED on this screen's own client (scenes/eliteGates/egClient.js createEgClient), its account
// door a recording stand-in that answers as the service does (test/net/eliteGates/egaudit4_net_service.test.js holds the service to it),
// its receipts minted (net/eliteGates/egReceipt.js mintEgReceipt), its call the hub's word through the wire (net/wire.js validEgOut):
//   lane3 #1   an open's ask kept on the device before it goes, asked again by its own id when its answer is lost - across
//              a reload - the stake it took kept for its void; `none` doubted a while, any other word settling it;
//   lane3 #2   a receipt the service counted never claimed again (its `claimed` said again), and a re-claim's Marks and deed
//              never handed on to the host;
//   lane3 #10  the balance in its asks' order, and *The key turns to rust.* said;
//   lane4 #14  the answer's refusals asked again as the admission lands; a step under way refusing the call's in silence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEgClient, EG_OPENS_KEY, EG_OPENS_MAX, EG_OPEN_AGAIN_MS, EG_OPEN_SURE_S, EG_OPEN_LOST, EG_STAKES_KEY, EG_VOID_WAIT_MS, EG_COUNTED_KEY, EG_CLAIM_RETRY_MS, EG_STAKE_LOOK_MS } from '../../../src/scenes/eliteGates/egClient.js';
import { EG_TEXT, EG_SEALED_MS, EG_ADMIT_MAX_MS } from '../../../src/net/eliteGates/egLaw.js';
import { mintEgReceipt } from '../../../src/net/eliteGates/egReceipt.js';
import { egRcId } from '../../../src/net/eliteGates/egDurable.js';
import { validEgOut, SOCIAL_ROOM } from '../../../src/net/wire.js';
import { weirKeysHeld, weirKeys } from '../../../src/systems/eliteGates/weirKey.js';

const { subtle } = globalThis.crypto;
const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const T0 = 1_800_000_000_000, ME = 'acct-mac', B = '0123456789abcdef';
const SITE = { px: 300, py: 200, x: 1000, y: 0, z: 2000, yaw: 0 };
const settle = async () => { for (let k = 0; k < 20; k++) await new Promise((r) => setImmediate(r)); };
function memStore() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => m.delete(k), m }; }
/** A promise and its resolve, for an answer the test lands when it says. */
const later = () => { let resolve; const p = new Promise((r) => { resolve = r; }); return { p, resolve }; };

/**
 * This screen's client on open ground over a driven clock (Date.now too: the device's own stamps): the account door `acct`
 * laid over a stand-in that records every ask; the hub link records its words; the mode machine's mode `st.mode`.
 */
function rig(t, { acct = {}, store = memStore(), keys = 0, stepping = false } = {}) {
  let clock = T0;
  t.mock.method(Date, 'now', () => clock);
  const L = { said: [], hub: [], asks: [], paid: [], portal: { opened: 0, cleared: 0 } };
  const st = { mode: 'exterior', stepping };
  const modes = { get mode() { return st.mode; }, get stepping() { return st.stepping; }, egHallBreach: () => null, egHallCircle: () => null, stepThroughFire: async () => true, enterEgHall: () => true };
  const hub = { egOk: true, sendEg: (k, f = {}) => { L.hub.push({ k, ...f }); return true; } };
  const entity = { level: 20, health: 100, maxHealth: 100, items: keys ? [weirKeys(keys)] : [] };
  const account = { me: () => ME, guest: () => false, keys: async () => ({ ok: false }), ...acct };
  const client = createEgClient({ modes: () => modes, online: () => ({ sendEg: () => true }), hub: () => hub, account, now: () => clock, entity, player: { pos: [0, 0, 0] }, cam: { pos: [0, 0, 0], yaw: 0 },
    say: (s) => L.said.push(s), site: () => ({}), wire: () => SITE, landAt: () => true, hurt: () => {}, store, paid: (c, d) => L.paid.push([c, d]),
    callPortal: { open: () => { L.portal.opened++; return { at: [0, 0, 0] }; }, clear: () => { L.portal.cleared++; }, tick: () => {}, standing: () => false }, feet: () => [0, 0, 0] });
  return { client, L, st, store, entity, step: (ms) => { clock += ms; }, now: () => clock };
}
const kept = (store, key) => JSON.parse(store.getItem(key) ?? '[]');

// ── lane3 #1 ───────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV lane3 #1 AN OPEN\'S LOST ANSWER IS NO LOST KEY, THIS SCREEN\'S HALF (sections 22 and 23): the open\'s request id is kept on the device before it is asked; an answer that never came (the wait\'s end, a dropped connection) leaves it kept and is said as the shut road, and EG_OPEN_AGAIN_MS on it is asked again by that id (`again`) - the stake it took kept as one no call answered, so its void is asked EG_VOID_WAIT_MS past its stake; a reload asks a kept one at once; `none` is doubted EG_OPEN_SURE_S past the ask, then let go; any word the service says settles an ask; a breach held (`live`) asks a kept one at once (mutants: kept after the answer; never kept; asked again without `again`; the stake unkept; `none` believed at once; the lost words read as an answer)', async (t) => {
  assert.deepEqual([EG_OPEN_AGAIN_MS, EG_OPEN_SURE_S, EG_OPENS_MAX, [...EG_OPEN_LOST]], [30_000, 120, 4, ['offline', 'server']]);
  const stakes = new Map();
  let lose = true, keptBefore = null;
  const R = rig(t, { keys: 1, acct: {
    open: async (rq, rh, opts = {}) => {
      R.L.asks.push({ rq, again: !!opts.again });
      if (opts.again) { const s = stakes.get(rq); return s ? { ok: true, data: { order: 'v1.order.lost', b: B, ez: 'e'.repeat(24), keys: 0, until: s.at + 12_000, rh: 0, at: s.at } } : { ok: false, error: 'none' }; }
      keptBefore = kept(R.store, EG_OPENS_KEY).map((p) => p.rq);
      stakes.set(rq, { at: Math.floor(Date.now() / 1000) });
      return lose ? { ok: false, error: 'offline' } : { ok: true, data: { order: 'v1.order.good', b: B, ez: 'e'.repeat(24), keys: 0, until: 0, rh: 0 } };
    } } });
  assert.equal(R.client.useKey(), EG_TEXT.opening);
  await settle();
  const [ask] = R.L.asks;
  assert.deepEqual(keptBefore, [ask.rq], 'kept on the device before it was asked');
  assert.deepEqual(kept(R.store, EG_OPENS_KEY).map((p) => [p.rq, p.s]), [[ask.rq, ME]], 'its answer lost: kept still');
  assert.ok(R.L.said.includes(EG_TEXT.shut), 'said as the road shut');
  R.client.frame(); await settle();
  assert.equal(R.L.asks.length, 1, 'not again before EG_OPEN_AGAIN_MS');
  R.step(EG_OPEN_AGAIN_MS); R.client.frame(); await settle();
  assert.deepEqual(R.L.asks[1], { rq: ask.rq, again: true }, 'asked again by its own id');
  assert.deepEqual(kept(R.store, EG_STAKES_KEY), [{ b: B, z: 'v1.order.lost', at: stakes.get(ask.rq).at }], 'the stake it took kept, as of its own issue');
  assert.deepEqual(kept(R.store, EG_OPENS_KEY), [], 'and the ask let go');
  assert.equal(weirKeysHeld(R.entity.items), 0, 'the pack told the key is staked');
  assert.ok(!R.L.said.includes(EG_TEXT.rust), 'a staked key is no rust');
  R.step(EG_VOID_WAIT_MS); R.client.frame(); await settle();
  assert.deepEqual(R.L.hub.filter((w) => w.k === 'void'), [{ k: 'void', z: 'v1.order.lost' }], 'its void asked of the hub');
  // a reload: the kept ask found and asked at once; `none` doubted until EG_OPEN_SURE_S, then let go
  const store = memStore();
  store.setItem(EG_OPENS_KEY, JSON.stringify([{ rq: 'rqneverlanded000cc', s: ME, at: Math.floor(T0 / 1000) }]));
  const asked = [];
  const R2 = rig(t, { store, acct: { open: async (rq, rh, opts = {}) => { asked.push([rq, !!opts.again]); return { ok: false, error: 'none' }; } } });
  R2.client.frame(); await settle();
  assert.deepEqual(asked, [['rqneverlanded000cc', true]], 'reloaded: asked again at once');
  assert.equal(kept(store, EG_OPENS_KEY).length, 1, '`none` inside EG_OPEN_SURE_S: the first may still be landing');
  R2.step(EG_OPEN_SURE_S * 1000); R2.client.frame(); await settle();
  assert.equal(asked.length, 2);
  assert.deepEqual(kept(store, EG_OPENS_KEY), [], 'past it: let go - no key was taken');
  // any word the service says settles the ask: a refusal let go at once; `live` asks a kept one at once
  const S3 = memStore();
  S3.setItem(EG_OPENS_KEY, JSON.stringify([{ rq: 'rqoldlost00000000dd', s: ME, at: Math.floor(T0 / 1000) - 10 }]));
  const asks3 = [];
  const R3 = rig(t, { store: S3, keys: 1, acct: { open: async (rq, rh, opts = {}) => { asks3.push([rq, !!opts.again]); return opts.again ? { ok: false, error: 'offline' } : { ok: false, error: 'live', b: B }; } } });
  R3.client.frame(); await settle();
  assert.equal(asks3.length, 1, 'the old ask asked, its answer lost again');
  R3.client.useKey(); await settle();
  const fresh = asks3[1][0];
  assert.ok(!kept(S3, EG_OPENS_KEY).some((p) => p.rq === fresh), 'a refusal is an answer: the fresh ask let go');
  R3.client.frame(); await settle();
  assert.deepEqual(asks3[2], ['rqoldlost00000000dd', true], '`live`: the kept ask asked again at once, never EG_OPEN_AGAIN_MS on');
  lose = false;
});

// ── lane3 #2 ───────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV lane3 #2 A RECEIPT COUNTED IS NEVER CLAIMED AGAIN, AND A RE-CLAIM\'S MARKS ARE NEVER SHOWN AGAIN (section 23, step 5; section 19): a Redoubt\'s receipt claimed is remembered on the device (EG_COUNTED_KEY) for its life - handed again (the hub\'s held copy before its `claimed` landed) it is not claimed, its `claimed` is said again; one whose first answer was lost and is answered `again` hands the host its spoils with no Marks and no deed (the card and lines were the struck claim\'s) (mutants: the counted unread; the counted unkept; the Marks handed on with `again`)', async (t) => {
  const claims = [];
  const R = rig(t, { acct: { claim: async (r) => { claims.push(r); return claims.length === 2 ? { ok: false, error: 'offline' } : { ok: true, data: { recorded: claims.length === 1, ...(claims.length === 1 ? {} : { again: true }), q: 'w', b: B, w: claims.length, keys: 0, marks: { struck: 20 }, deed: null, paid: true } }; } } });
  const nowS = Math.floor(T0 / 1000);
  const mint = (w) => mintEgReceipt({ q: 'w', b: B, s: ME, z: 'z'.repeat(20), c: 7, w, h: 5 * w, t: 600, n: 1, ew: 0, l: 20 }, null, { subtle, nowS });
  const r1 = await mint(1);
  R.client.word(validEgOut({ k: 'rcpt', r: r1 }), SOCIAL_ROOM); await settle();
  assert.equal(claims.length, 1, 'claimed');
  assert.deepEqual(R.L.paid.map(([, d]) => d.marks), [{ struck: 20 }], 'the struck claim\'s Marks handed on');
  assert.deepEqual(kept(R.store, EG_COUNTED_KEY).map((x) => [x.id, x.s]), [[egRcId({ b: B, q: 'w', w: 1 }), ME]], 'remembered');
  R.L.hub.length = 0;
  for (let k = 0; k < 3; k++) { R.client.word(validEgOut({ k: 'rcpt', r: r1 }), SOCIAL_ROOM); await settle(); }
  assert.equal(claims.length, 1, 'handed again three times: never claimed again');
  assert.deepEqual(R.L.hub.filter((w) => w.k === 'claimed'), Array(3).fill({ k: 'claimed', b: B, q: 'w', w: 1 }), 'its `claimed` said again, so the hub lets go');
  // a second Redoubt's: its first answer lost, then answered `again` - the spoils on, the Marks and the deed not
  const r2 = await mint(2);
  R.client.word(validEgOut({ k: 'rcpt', r: r2 }), SOCIAL_ROOM); await settle();
  assert.equal(claims.length, 2, 'asked, its answer lost');
  R.step(EG_CLAIM_RETRY_MS); R.client.frame(); await settle();
  assert.equal(claims.length, 3, 'asked again');
  const [c2, d2] = R.L.paid.at(-1);
  assert.deepEqual([c2.w, d2.again, d2.marks, d2.deed, d2.paid], [2, true, null, null, true], 'its spoils handed on, no Marks and no deed');
});

// ── lane3 #10 ──────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV lane3 #10 THE BALANCE IN ITS ASKS\' ORDER, AND THE RUST (section 5): a keys answer asked before a claim but landing after it is never applied over the claim\'s - the pack keeps the newer count; an answer that takes a key the pack showed says *The key turns to rust.* - never for the key its own open staked; a balance the screen did not ask for (a gate\'s claim) is applied and the balance asked again (mutants: answers applied as they land; the rust unsaid; said for the open\'s own stake)', async (t) => {
  const slow = later();
  let keysAsks = 0;
  const R = rig(t, { keys: 2, acct: {
    keys: async () => { keysAsks++; return keysAsks === 1 ? slow.p : { ok: true, data: { keys: 3 } }; },
    claim: async () => ({ ok: true, data: { recorded: true, q: 'x', b: B, keys: 4 } }),
    open: async () => ({ ok: true, data: { order: 'v1.order.good', b: B, ez: 'e'.repeat(24), keys: 3, until: 0, rh: 0 } }),
  } });
  R.client.frame();   // the balance asked (keysAt never) - its answer slow
  await settle();
  const x = await mintEgReceipt({ q: 'x', b: B, s: ME, z: 'z'.repeat(20), c: 1, h: 3, t: 60, n: 1, ew: 0, l: 20, why: 'home' }, null, { subtle, nowS: Math.floor(T0 / 1000) });
  R.client.word(validEgOut({ k: 'rcpt', r: x }), SOCIAL_ROOM); await settle();
  assert.equal(weirKeysHeld(R.entity.items), 4, 'the claim\'s balance');
  slow.resolve({ ok: true, data: { keys: 1 } }); await settle();
  assert.equal(weirKeysHeld(R.entity.items), 4, 'the older ask\'s answer, landing after, never applied over it');
  assert.ok(!R.L.said.includes(EG_TEXT.rust), 'and no rust for it');
  // the open's own stake: no rust
  R.client.useKey(); await settle();
  assert.equal(weirKeysHeld(R.entity.items), 3);
  assert.ok(!R.L.said.includes(EG_TEXT.rust), 'the key it staked is no rust');
  // a key the pack showed that the service does not count
  R.entity.items.push(weirKeys(2));   // a phantom pair in the pack
  R.step(10 * 60_000); R.client.frame(); await settle();
  assert.equal(weirKeysHeld(R.entity.items), 3, 'restacked to the count');
  assert.ok(R.L.said.includes(EG_TEXT.rust), '*The key turns to rust.*');
  // a balance this screen did not ask: applied, and the balance asked again
  const before = keysAsks;
  R.client.restack(9); await settle();
  assert.equal(keysAsks, before + 1, 'asked again after it');
  assert.equal(weirKeysHeld(R.entity.items), 3, 'the asked answer stands over it');
  assert.match(rd('bible/11-Multiplayer/Elite-Gates.md'), /in the order the asks went \(ASYNC NEVER DROPS\)/);
});

// ── lane4 #14 ──────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV lane4 #14 THE ANSWER\'S REFUSALS ASKED AGAIN AS THE ADMISSION LANDS (section 29: "every refusal is checked again when its async answer lands"): a member who stepped indoors while the admission was asked is told to answer from open ground - never "no room" - and the order is kept, so the answer from open ground needs no second ask; one whose window closed meanwhile is told the breach closed; the call\'s portal entered while another step is under way is refused in silence and stands (mutants: the mode unchecked after; the phase unchecked after; the step under way said as a shut Spire)', async (t) => {
  const pending = [];
  const R = rig(t, { acct: { admit: async () => { const l = later(); pending.push(l); return l.p; } } });
  const call = (b, op) => R.client.word(validEgOut({ k: 'call', b, o: 'Ann', os: 'acct-ann', seed: 1, op, rh: 0, co: [['acct-ann', 'Ann', 1], [ME, 'Mac', 2]], site: SITE, ew: 0, wg: [], sg: 'A'.repeat(86) }), SOCIAL_ROOM);
  call(B, R.now() - EG_SEALED_MS - 1000);
  R.client.command(''); await settle();
  assert.equal(pending.length, 1, 'the admission asked');
  R.st.mode = 'interior';
  pending[0].resolve({ ok: true, data: { order: 'v1.admit.order' } }); await settle();
  assert.ok(R.L.said.includes(EG_TEXT.indoors), 'indoors now: said so');
  assert.ok(!R.L.said.includes(EG_TEXT.room), 'never "no room"');
  assert.equal(R.L.portal.opened, 0);
  R.st.mode = 'exterior';
  R.client.command(''); await settle();
  assert.equal(pending.length, 1, 'the order kept: no second ask');
  assert.equal(R.L.portal.opened, 1, 'the portal at my feet');
  // the window closing while it is asked
  const B2 = 'fedcba9876543210';
  call(B2, R.now() - EG_SEALED_MS - 1000);
  R.client.command(''); await settle();
  R.step(EG_ADMIT_MAX_MS);
  pending[1].resolve({ ok: true, data: { order: 'v1.admit.later' } }); await settle();
  assert.ok(R.L.said.includes(EG_TEXT.late('Ann')), 'the window closed meanwhile: the late line');
  // the portal entered under another step: refused in silence, the portal standing
  const S = rig(t, { stepping: true, acct: { admit: async () => ({ ok: true, data: { order: 'v1.admit.order' } }) } });
  S.client.word(validEgOut({ k: 'call', b: B, o: 'Ann', os: 'acct-ann', seed: 1, op: S.now() - EG_SEALED_MS - 1000, rh: 0, co: [['acct-ann', 'Ann', 1], [ME, 'Mac', 2]], site: SITE, ew: 0, wg: [], sg: 'A'.repeat(86) }), SOCIAL_ROOM);
  S.st.stepping = false;
  S.client.command(''); await settle();
  assert.equal(S.L.portal.opened, 1);
  S.st.stepping = true;
  const said = S.L.said.length;
  assert.equal(S.client.portalEntered(), false, 'another step under way');
  assert.equal(S.L.portal.cleared, 0, 'the portal stands for the step after it');
  assert.equal(S.L.said.length, said, 'nothing said - no shut Spire');
});
