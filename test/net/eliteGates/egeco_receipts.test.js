// EG-E3 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 16.5, 23 and 20): THE
// RECEIPTS THE RELAY MINTS, MINTED - the two ends the relay says that the receipt law refused (a witness forsaking, THE
// SEAL), the bound every reader holds a receipt to kept by the mint itself (its optional lists trimmed oldest first, the
// claims the service pays by never), and the end receipt's two new fields: the breach's Wager and the Annals' pages the
// breach gave the member. Every receipt here is the director's own (net/eliteGates/egBrain.js), signed and verified as the relay
// and the service do it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mintEgReceipt, readEgReceipt, verifyEgReceipt, egReceiptValid, EG_RECEIPT_MAX, EG_END_WHYS, EG_RECEIPT_TRIMS } from '../../../src/net/eliteGates/egReceipt.js';
import { egBreachNew, egEnter, egFall, egForsake, egEnd } from '../../../src/net/eliteGates/egBrain.js';
import { EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { validEgOut } from '../../../src/net/wire.js';

const { subtle } = globalThis.crypto;
const T0 = 1_800_000_000_000;
const NOW_S = Math.floor(T0 / 1000);
const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
const sign = (claims, nowS = NOW_S) => mintEgReceipt(claims, kp.privateKey, { subtle, nowS });
const verify = (r, nowS = NOW_S) => verifyEgReceipt(r, kp.publicKey, { subtle, nowS });
/** A breach of `n`, every member admitted, its first hall woken (the director's own record). */
function breach(n = 2, { wg = [] } = {}) {
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}000`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: co[0][0], o: 'M0', ew: 0, rh: 0, seed: 7, op: T0, co, site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg });
  const now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) assert.equal(egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 30, now), null);
  B.h = 3; B.sg = 'trial'; B.wk = now; B.cleared = 2;
  return { B, now, co };
}
/** The receipts the breach owes, signed as the room signs them (its own seed each). */
const minted = (B) => Promise.all(B.owe.map((o, k) => sign({ ...o.claims, c: 1000 + k }).then((r) => ({ sub: o.sub, r }))));

test('EG-E3 THE ENDS THE RELAY SAYS: a witness forsaking (egForsake) and THE SEAL (egEnd \'seal\', a good end - its Reliquaries open) each mint a receipt the service verifies; before, the law\'s list lacked both and the mint threw, so a forsaken member\'s end and stake were never said (mutants: \'forsake\' or \'seal\' off EG_END_WHYS)', async () => {
  assert.ok(EG_END_WHYS.includes('forsake') && EG_END_WHYS.includes('seal'));
  const { B, now, co } = breach(3);
  egFall(B, co[1][0], now, [], { x: 1, z: 1 });
  assert.equal(egForsake(B, co[1][0], now + 1000, []), true);
  B.mem[co[0][0]].rel = [1, 2];
  egEnd(B, 'seal', now + 2000, []);
  const rs = await minted(B);
  const by = Object.fromEntries(rs.map(({ sub, r }) => [sub, r]));
  const f = await verify(by[co[1][0]]);
  assert.ok(f.ok, f.why);
  assert.deepEqual([f.claims.q, f.claims.why, f.claims.s, f.claims.fl], ['x', 'forsake', co[1][0], 1]);
  assert.equal(f.claims.rl, undefined, 'a forsaking opens no Reliquary');
  const s = await verify(by[co[0][0]]);
  assert.ok(s.ok, s.why);
  assert.deepEqual([s.claims.q, s.claims.why, s.claims.rl], ['x', 'seal', [1, 2]], 'THE SEAL is a good end: the Reliquaries open');
  assert.equal((await verify(by[co[2][0]])).claims.why, 'seal');
  // the law refuses a why the relay never says
  assert.ok(!egReceiptValid({ ...f.claims, why: 'quit' }));
});

test('EG-E3 THE BOUND, THE WORST CASE: every id at its longest (a 40-character account, a 32-character order, a 16-letter lord), 32 Vestiges, three Wager decrees, its feats and a lone Court on a Redoubt; 64 Reliquaries, the Wager and every Annals page on an end - each minted inside EG_RECEIPT_MAX, read, verified and carried by the wire, its lists trimmed oldest first and every claim the service pays by whole (mutants: no trim; the newest trimmed; the bound measured unsigned; the guard gone)', async () => {
  const ids = { b: 'f'.repeat(16), s: 'A'.repeat(40), z: 'z'.repeat(32) };
  const nowS = 4_000_000_000;
  const vs = Array.from({ length: 32 }, (_, i) => [i % 27, 1 + (i % 3)]);
  const w = { q: 'w', ...ids, c: 0xffffffff, w: 19_999, h: 99_999, t: 7 * 24 * 3600, n: 8, ew: 999, l: 999, vs, fl: 2, lb: 1, wg: [31, 30, 29], lk: 'q'.repeat(16), ft: 7 };
  const rw = await sign(w, nowS);
  assert.ok(rw.length <= EG_RECEIPT_MAX, `${rw.length}`);
  assert.ok(rw.length > EG_RECEIPT_MAX - 20, 'trimmed only as far as the bound asks');
  const cw = (await verify(rw, nowS)).claims;
  assert.ok(cw, 'verified');
  assert.ok(cw.vs.length > 0 && cw.vs.length < 32, `${cw.vs.length} kept`);
  assert.deepEqual(cw.vs, vs.slice(32 - cw.vs.length), 'the oldest Vestiges go first, the newest kept');
  for (const k of ['q', 'b', 's', 'z', 'c', 'w', 'h', 't', 'n', 'ew', 'l', 'fl', 'lb', 'wg', 'lk', 'ft']) assert.deepEqual(cw[k], w[k], `${k} whole`);
  assert.deepEqual(validEgOut({ k: 'rcpt', r: rw }), { k: 'rcpt', r: rw }, 'the wire carries it');
  assert.ok(readEgReceipt(rw)?.signed);
  const rl = Array.from({ length: 64 }, (_, i) => i + 1);
  const x = { q: 'x', ...ids, c: 0xffffffff, h: 99_999, t: 7 * 24 * 3600, n: 8, ew: 999, l: 999, why: 'home', rl, fl: 1, wg: [31, 30, 29], an: 2 ** 30 - 1 };
  const rx = await sign(x, nowS);
  assert.ok(rx.length <= EG_RECEIPT_MAX, `${rx.length}`);
  const cx = (await verify(rx, nowS)).claims;
  assert.ok(cx.rl.length > 0 && cx.rl.length < 64);
  assert.deepEqual(cx.rl, rl.slice(64 - cx.rl.length), 'the oldest Reliquaries go first');
  for (const k of ['q', 'b', 's', 'z', 'c', 'h', 't', 'n', 'ew', 'l', 'why', 'fl', 'wg', 'an']) assert.deepEqual(cx[k], x[k], `${k} whole`);
  // unsigned, it trims as the signed one does: the bound is the signed receipt's
  const ux = readEgReceipt(await mintEgReceipt(x, null, { subtle, nowS }));
  assert.deepEqual(ux.rl, cx.rl);
  // the Vestiges before the Reliquaries, in the law's order
  assert.deepEqual([...EG_RECEIPT_TRIMS], ['vs', 'rl']);
  // PIN MOVED (AUDIT EG IV, lane3 #7): an end carrying the Vestiges too (`{ ...x, vs }`) was minted here, every Vestige
  // trimmed before a Reliquary - a shape the mint never makes, which the receipt now refuses (each list its kind's alone)
  await assert.rejects(mintEgReceipt({ ...x, vs }, null, { subtle, nowS }), /could not verify/, 'an end carries no Vestiges');
  // a receipt under the bound is minted as it was asked
  const small = readEgReceipt(await sign({ ...w, vs: vs.slice(0, 5) }, nowS));
  assert.deepEqual(small.vs, vs.slice(0, 5));
  // and nothing past it is ever signed: a claim set no trim can hold is refused, never minted long
  await assert.rejects(() => sign({ ...w, vs: [], zz: 'x'.repeat(600) }, nowS), /inside its bound/);
  // the wire's bound is the receipt's
  assert.match(readFileSync(new URL('../../../src/net/wire.js', import.meta.url), 'utf8'), new RegExp(`const EG_RECEIPT_WIRE_MAX = ${EG_RECEIPT_MAX};`));
});

test('EG-E3 THE END RECEIPT\'S NEW FIELDS: a wagered breach\'s `x` carries its Wager (`wg`, as its `w` does) and the Annals\' pages the breach gave the member (`an`, bit p for page p) - none when it gave none, none on an unwagered breach; the receipt law reads them (mutants: the Wager off the end; the pages off it)', async () => {
  const { B, now, co } = breach(2, { wg: [3, 17] });
  B.mem[co[0][0]].pages = (1 << 4) | (2 ** 20) | (2 ** 29);
  egEnd(B, 'tear', now + 5000, []);
  const rs = await minted(B);
  const a = (await verify(rs.find((x) => x.sub === co[0][0]).r)).claims;
  assert.deepEqual([a.why, a.wg, a.an], ['tear', [3, 17], (1 << 4) | (2 ** 20) | (2 ** 29)]);
  const b = (await verify(rs.find((x) => x.sub === co[1][0]).r)).claims;
  assert.deepEqual(b.wg, [3, 17]);
  assert.equal(b.an, undefined, 'no page given, none said');
  const plain = breach(1);
  plain.B.mem[plain.co[0][0]].pages = 1;
  egEnd(plain.B, 'last', plain.now + 5000, []);
  const c = (await verify((await minted(plain.B))[0].r)).claims;
  assert.equal(c.wg, undefined, 'an unwagered breach says no Wager');
  assert.equal(c.an, 1);
});
