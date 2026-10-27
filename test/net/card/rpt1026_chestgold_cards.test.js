// RPT1026-CARDBANK (a private report: a gold table's stake gone from the purse after a stand with nobody seated - and the
// next buy-in offering it again with what was earned since; AUDIT RPT1026 M2: paraphrased): a gold table's cash-out is paid into
// the bank account of the region it was staked from (Tavern-Cards.md section 23, THE CLAIM), the buy-in's offer reads the
// purse and that account together - and nothing said where the stake had gone. The book here is the real one
// (net/card/cardStakes.js) over its door and a realm act as realmGoldAct runs one; the receipt is the relay's own mint.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createCardStakes, CARD_STAKES_KEY, cardBankedText } from '../../../src/net/card/cardStakes.js';
import { mintCardReceipt } from '../../../src/net/card/cardReceipt.js';

const { subtle } = webcrypto;
const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

function rig(cashout) {
  const store = new Map(), purse = { gold: 336, bank: 0 };
  const door = {
    stake: async (req) => ({ ok: true, data: { stake: `order-${req.rid}`, id: 'abcdabcdabcdabcdab12', realm: { seq: 2 } } }),
    cashout: async (req) => cashout(req),
  };
  const realm = {
    async act({ reserve = null, apply = null, call }) {
      const undo = reserve ? reserve() : null;
      const r = await call({ id: 'R', lease: 'L', seq: 1 });
      if (r?.ok) apply?.(r); else if (!r?.unknown) undo?.();
      return r;
    },
  };
  const wallet = () => ({ gold: () => purse.gold + purse.bank, pay: (n) => { purse.gold -= n; return () => { purse.gold += n; }; }, bank: (n) => { purse.bank += n; } });
  const book = createCardStakes({ door, realm, wallet, character: () => 'CH1', region: () => 17, storage: { get: (k) => store.get(k), set: (k, v) => store.set(k, v) }, now: () => 1_000_000, rand: () => 0.5 });
  return { book, store, purse };
}

test('RPT1026-CARDBANK a stake that comes home says where it went: into the bank, not the purse it came from', async () => {
  const r = rig(() => ({ ok: true, data: { gold: 336, realm: { seq: 3 } } }));
  const got = await r.book.stake({ room: 'interior:m1.2', table: 0, bb: 10, amount: 336 });
  assert.equal(got.ok, true);
  assert.equal(r.purse.gold, 0, 'the buy-in left the purse');
  r.book.seated(got.id);
  // nobody sat: the player stands, and the relay hands back the whole stake
  const receipt = await mintCardReceipt({ s: 'acct-me', j: got.id, r: 336, w: 'stood' }, null, { subtle, nowS: 1000 });
  assert.equal(r.book.receive(receipt), got.id);
  assert.deepEqual(r.store.get(CARD_STAKES_KEY), []);
  const said = [];
  await r.book.claim((l) => said.push(l));
  assert.equal(r.purse.gold, 0, 'the purse stays empty - the report\'s empty purse');
  assert.equal(r.purse.bank, 336, 'the stake is in the bank account');
  assert.deepEqual(said, ['The card table paid 336 gold into your account at the Bank of the Empire.']);
  assert.equal(said[0], cardBankedText(336));
  // a repeat the record already had pays the device nothing, and says nothing
  const again = rig(() => ({ ok: true, data: { gold: 336, repeat: true } }));
  again.book.receive(receipt);
  const quiet = [];
  await again.book.claim((l) => quiet.push(l));
  assert.deepEqual(quiet, []);
});

test('RPT1026-CARDBANK both of the host\'s claims say it: a cash-out heard, and the kept receipts claimed on a visit (after a reload)', () => {
  const wm = read('src/scenes/worldModes.js');
  assert.match(wm, /if \(j\) \{ host\.cardOnline\?\.send\(\{ op: 'ack', table: f\.table, j \}\); host\.cardStakes\.claim\(say\); \}/);
  assert.match(wm, /host\.cardStakes\?\.recover\(\)\.then\(\(\) => host\.cardStakes\.claim\(say\)\)\.catch\(\(\) => \{\}\);/);
  assert.match(wm, /\n  const say = \(l, delay\) => \{ if \(townTalk\?\.say\) townTalk\.say\(l, delay\);/, 'the host\'s own say, the line the HUD shows');
});
