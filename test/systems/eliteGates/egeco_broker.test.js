// EG-E1 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 19, THE SINK): THE
// BROKER'S PANOPLY SINK ON THE CLIENT - the sale's two halves (systems/sigil/sigilBroker.js panoplySale: the piece minted, the
// embers out of the pack, the account service asked, a refusal giving them back, a lost answer asked after, the piece in
// the pack and saved), and the Broker's window (ui/brokerWindow.js): "The Battlemage's Panoply" under the insignia, the
// nine pieces by name, its price and its week, each row's Buy saying why not ("Need 15 more", "Bought", "Next week"), a
// press "Buying..." with nothing else pressable until the account answers, a row's card; and none of it without its deps.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { panoplySale, stoneCount, spendableStonesIn, brokerStock, brokerOwed, _resetOwed } from '../../../src/systems/sigil/sigilBroker.js';
import { sigilStone } from '../../../src/systems/gate/gateSpoils.js';
import { REGALIA, mintAetheric } from '../../../src/systems/aetheric.js';
import { EG_SINK_EMBERS, EG_PANOPLY_IDS } from '../../../src/net/eliteGates/egPay.js';
import { fakeDom } from '../../invdrag.mjs';
import { claimHauls, CLAIM_SOURCE } from '../../../src/ui/haulCards.js';
import {
  mountBrokerWindow, panoplyRows, panoplyLabel, panoplyWhy, PANOPLY_HEAD, PANOPLY_SUB, PANOPLY_NAMES, PANOPLY_KINDS, PANOPLY_CARD, stonesText,
} from '../../../src/ui/brokerWindow.js';

/** A pack's stack of `n` Deadlands Embers - one record, as addItem makes it. */
const stack = (n) => Object.assign(sigilStone(), { stackCount: n });
const count = (pack) => stoneCount(spendableStonesIn(pack));
/** A real Aetheric piece, as the host's mint makes one (the Panoply's records are the host's - a Regalia piece here). */
const minted = () => mintAetheric(REGALIA[0]);

test('EG-E1 THE PANOPLY SALE, BOTH HALVES (systems/sigil/sigilBroker.js panoplySale): the piece minted, then the 20 embers out of the pack BEFORE the service is asked; held, the piece in the pack (no Broker price on it) and saved once; refused, the embers back and nothing saved; the answer lost (unreached, a 5xx) asked after BY ITS REQUEST ID (AUDIT FB1024, BROKER-RID) - held, the sale; fenced, the embers back; a short pack, a piece not the Panoply\'s or one the host cannot mint asks nothing (mutants: the embers never given back; a lost answer taken for a refusal; the piece never added; the sale never saved; the price taken after the service)', async () => {
  const piece = EG_PANOPLY_IDS[3];
  let saved = 0;
  const save = () => { saved++; };
  const io = (over) => ({ save, account: 'acct-1', settle: async () => { throw new Error('asked'); }, ...over });
  // held: the price out before the answer, the piece in after it - the press's request id sent with it
  let pack = [stack(25)], seen = null, asked = [];
  let r = await panoplySale(piece, io({ items: pack, mint: () => Object.assign(minted(), { stonesPaid: 20 }), buy: async (id, rid) => { asked.push([id, typeof rid]); seen = count(pack); return { ok: true, data: { ok: true, piece: id, week: 30, purse: 5 } }; } }));
  assert.deepEqual([r.ok, asked, seen, count(pack), saved], [true, [[piece, 'string']], 5, 5, 1]);
  assert.ok(pack.includes(r.item), 'the piece in the pack');
  assert.equal(r.item.stonesPaid, undefined, 'no Broker price on it: not the day\'s stock, no dismantle pays it back');
  assert.equal(r.data.purse, 5);
  // the service's own refusal: the embers back, the lost answer's question never asked
  for (const refused of [{ ok: false, error: 'short', status: 409 }, { ok: false, error: 'bought', status: 409 }, { ok: false, error: 'guest', status: 403 }, { ok: false, error: 'no-session' }]) {
    pack = [stack(25)]; saved = 0;
    r = await panoplySale(piece, io({ items: pack, mint: minted, buy: async () => refused }));
    assert.deepEqual([r, count(pack), saved, pack.length], [{ ok: false, error: refused.error }, 25, 0, 1], refused.error);
  }
  // the answer lost, the sale written: asked after by its id - held, and this ask the first: the sale
  for (const lost of [{ ok: false, error: 'offline' }, { ok: false, error: 'server', status: 502 }]) {
    pack = [stack(20)]; saved = 0;
    let sent = null;
    r = await panoplySale(piece, io({ items: pack, mint: minted, rid: 'b' + 'q'.repeat(15), buy: async () => lost, settle: async (body) => { sent = body; return { ok: true, data: { held: true, kind: 'panoply', item: piece, by: body.nonce, week: 30 } }; } }));
    assert.deepEqual([r.ok, count(pack), saved, pack.includes(r.item), sent.rid], [true, 0, 1, true, 'b' + 'q'.repeat(15)], `${lost.error}: held - the sale`);
  }
  // lost and fenced (the service never wrote it, and now never will): the embers back
  pack = [stack(20)]; saved = 0;
  r = await panoplySale(piece, io({ items: pack, mint: minted, buy: async () => { throw new Error('reset'); }, settle: async () => ({ ok: true, data: { held: false } }) }));
  assert.deepEqual([r, count(pack), saved], [{ ok: false, error: 'offline' }, 20, 0]);
  // PIN MOVED (BROKER-RID, AUDIT FB1024): not heard either - OWED, never given back blind (test/systems/fb1024_embersowed.test.js)
  for (const settle of [async () => ({ ok: false, error: 'offline' }), async () => { throw new Error('offline'); }]) {
    _resetOwed(); pack = [stack(20)]; saved = 0;
    r = await panoplySale(piece, io({ items: pack, mint: minted, settle, buy: async () => { throw new Error('reset'); } }));
    assert.deepEqual([r, count(pack), saved, brokerOwed().length], [{ ok: false, error: 'unheard' }, 0, 1, 1]);
  }
  _resetOwed();
  // nothing asked: a short pack, a piece not the Panoply's, a piece the host cannot mint
  let calls = 0;
  const buy = async () => { calls++; return { ok: true }; };
  pack = [stack(19)];
  assert.deepEqual(await panoplySale(piece, io({ items: pack, mint: minted, buy })), { ok: false, error: 'stones' });
  pack = [stack(40)];
  assert.deepEqual(await panoplySale('title:gatebreaker', io({ items: pack, mint: minted, buy })), { ok: false, error: 'piece' });
  assert.deepEqual(await panoplySale(piece, io({ items: pack, mint: () => null, buy })), { ok: false, error: 'piece' });
  assert.deepEqual([calls, count(pack)], [0, 40], 'nothing asked, nothing spent');
  assert.equal(EG_SINK_EMBERS, 20);
});

test('EG-E1 THE PANOPLY\'S ROWS AND WORDS (ui/brokerWindow.js): the nine pieces in the pay law\'s order, each named as section 19\'s table names it; the week\'s sale marks its piece bought and the rest spent; unknown, all may be bought; the button and its reason (mutants: a piece unnamed; the week\'s piece not marked; the others still offered)', () => {
  assert.deepEqual(Object.keys(PANOPLY_NAMES), [...EG_PANOPLY_IDS]);
  assert.deepEqual(Object.keys(PANOPLY_KINDS), [...EG_PANOPLY_IDS]);
  assert.deepEqual(Object.values(PANOPLY_NAMES), ['The Battlemage\'s Warhelm', 'The Battlemage\'s Right Pauldron', 'The Battlemage\'s Left Pauldron', 'The Battlemage\'s Cuirass',
    'The Battlemage\'s Gauntlets', 'The Battlemage\'s Greaves', 'The Battlemage\'s Boots', 'The Spire-Shield', 'The Spire-Saber']);
  assert.deepEqual([PANOPLY_KINDS['panoply-shield'], PANOPLY_KINDS['panoply-saber']], ['Kite Shield', 'Saber']);
  const open = panoplyRows(null);
  assert.equal(open.length, 9);
  assert.ok(open.every((r) => !r.bought && !r.spent && r.name === PANOPLY_NAMES[r.id]));
  const week = panoplyRows({ week: 30, piece: 'panoply-boots' });
  assert.deepEqual(week.filter((r) => r.bought).map((r) => r.id), ['panoply-boots']);
  assert.ok(week.every((r) => r.spent), 'one a week: the rest are spent');
  assert.deepEqual([panoplyLabel(open[0], { have: 25, pending: false }), panoplyLabel(open[0], { have: 5, pending: false }), panoplyLabel(week[6], { have: 99, pending: false }), panoplyLabel(week[0], { have: 99, pending: false }), panoplyLabel(open[0], { have: 25, pending: true })],
    ['Buy', 'Need 15 more', 'Bought', 'Next week', 'Buying...']);
  assert.deepEqual([panoplyWhy(open[0], 25), panoplyWhy(open[0], 19) !== '', panoplyWhy(week[6], 99), panoplyWhy(week[0], 99)], ['', true, 'Bought this week', 'One a week. This week\'s is bought']);
  assert.equal(PANOPLY_HEAD, 'The Battlemage\'s Panoply');
  assert.equal(PANOPLY_SUB, 'One a week.');
  assert.ok(PANOPLY_CARD.every((s) => s.endsWith('.') && !/\S - \S/.test(s)));
  // a Redoubt's silver, carded as a Redoubt's (ui/haulCards.js - the host's claimHauls(data, 'eg'))
  assert.equal(CLAIM_SOURCE.eg, 'Redoubt taken');
  assert.equal(claimHauls({ marks: { struck: 20, balance: 20, combat: { earned: 20, max: 150 } } }, 'eg')[0].source, 'Redoubt taken');
});

/** withDom (test/invdrag.mjs), for a flow that awaits: the fake document stands until `fn` settles. */
async function withDomAsync(fn) {
  const dom = fakeDom();
  const saved = { doc: globalThis.document, hadDoc: 'document' in globalThis, add: globalThis.addEventListener, rem: globalThis.removeEventListener, raf: globalThis.requestAnimationFrame };
  globalThis.document = dom.doc;
  globalThis.addEventListener = dom.win.addEventListener;
  globalThis.removeEventListener = dom.win.removeEventListener;
  globalThis.requestAnimationFrame = () => 0;
  try { return await fn(dom); } finally {
    if (saved.hadDoc) globalThis.document = saved.doc; else delete globalThis.document;
    globalThis.addEventListener = saved.add;
    globalThis.removeEventListener = saved.rem;
    globalThis.requestAnimationFrame = saved.raf;
  }
}
const kids = (n, cls) => (n?.children ?? []).flatMap((c) => [...(c.classList?.contains(cls) ? [c] : []), ...kids(c, cls)]);
const one = (n, cls) => kids(n, cls)[0] ?? null;
const settle = () => new Promise((r) => setTimeout(r, 0));

test('EG-E1 THE BROKER\'S WINDOW SELLS THE PANOPLY: under the insignia, "The Battlemage\'s Panoply" with its price and its week, a row a piece by name in the wares\' own grid, each a control; a short purse says how many more; a press says "Buying..." with every other sale held until the account answers, then the word, the piece bought and the rest "Next week"; a row pressed shows its card; the week asked once as the window opens; without its deps the window draws none of it (mutants: the rows never drawn; a short purse offered the Buy; the wares pressable mid-sale; the bought state unread)', async () => {
  await withDomAsync(async () => {
    const day = 20_000, stock = brokerStock(day);
    let sink = null, loads = 0, answer = null, sold = 0;
    const asked = [];
    const purse = [stack(25)];
    const host = document.createElement('div');
    document.body.append(host);
    const view = mountBrokerWindow(host, {
      stock: () => stock, day: () => day, now: () => 0, items: () => purse, bought: () => [], picture: () => null, wearer: null, nameOf: (it) => it.name,
      buy: () => { sold++; return { ok: true }; },
      panoply: { rows: () => panoplyRows(sink), load: async () => { loads++; }, buy: (id) => { asked.push(id); return new Promise((res) => { answer = res; }); } },
    });
    try {
      await settle();
      assert.equal(loads, 1, 'the week asked once, as the window opens');
      const shell = one(host, 'broker-shell');
      const head = one(shell, 'broker-panoply-head');
      assert.ok(head, 'its heading');
      assert.equal(one(head, 'broker-insignia-title').textContent, PANOPLY_HEAD);
      assert.equal(one(head, 'broker-set').textContent, `${stonesText(20)}. One a week.`);
      let rows = kids(shell, 'broker-panoply');
      assert.deepEqual(rows.map((r) => r.dataset.panoply), [...EG_PANOPLY_IDS]);
      assert.deepEqual(rows.map((r) => one(r, 'broker-name').textContent), Object.values(PANOPLY_NAMES));
      assert.ok(rows.every((r) => r.classList.contains('broker-offer') && r.attrs.role === 'button' && r.attrs.tabindex === '0'), 'controls, in the wares\' grid');
      assert.ok(rows.every((r) => one(r, 'broker-price').textContent === '20 Deadlands Embers'));
      const btn = (r) => one(r, 'broker-buy');
      assert.ok(rows.every((r) => btn(r).textContent === 'Buy' && btn(r).attrs.disabled === undefined), 'twenty-five embers buy any piece');
      // a short purse
      purse[0].stackCount = 5;
      view.repaint();
      rows = kids(shell, 'broker-panoply');
      assert.ok(rows.every((r) => btn(r).textContent === 'Need 15 more' && btn(r).attrs.disabled === ''), 'five embers buy none');
      btn(rows[0]).onclick({ stopPropagation() {} });
      assert.deepEqual(asked, [], 'a disabled Buy sells nothing');
      purse[0].stackCount = 25;
      view.repaint();
      // the card
      rows = kids(shell, 'broker-panoply');
      rows[7].onkeydown({ key: 'Enter', target: rows[7], preventDefault() {} });
      const card = one(shell, 'broker-panoply-card');
      assert.ok(card, 'a row pressed shows its card');
      assert.equal(card.children.find((c) => c.tagName === 'H3').textContent, 'The Spire-Shield');
      assert.equal(kids(shell, 'broker-card').length, 1, 'one card - the piece\'s');
      // the buy: pending until the account answers, every other sale held
      rows = kids(shell, 'broker-panoply');
      btn(rows[1]).onclick({ stopPropagation() {} });
      await settle();
      assert.deepEqual(asked, ['panoply-right-pauldron']);
      rows = kids(shell, 'broker-panoply');
      assert.equal(btn(rows[1]).textContent, 'Buying...');
      assert.ok(rows.every((r) => btn(r).attrs.disabled === ''), 'no second piece pressable');
      const wares = kids(shell, 'broker-offer').filter((r) => !r.classList.contains('broker-panoply'));
      assert.ok(wares.length > 0 && wares.every((r) => btn(r).attrs.disabled === ''), 'nor a ware');
      btn(wares[0]).onclick({ stopPropagation() {} });
      assert.equal(sold, 0, 'nor sold by a press that reaches it');
      sink = { week: 30, piece: 'panoply-right-pauldron' };
      answer({ ok: true, text: 'Bought: The Battlemage\'s Right Pauldron, for 20 Deadlands Embers.' });
      await settle(); await settle();
      assert.equal(one(shell, 'broker-note').textContent, 'Bought: The Battlemage\'s Right Pauldron, for 20 Deadlands Embers.');
      rows = kids(shell, 'broker-panoply');
      assert.deepEqual(rows.map((r) => btn(r).textContent), EG_PANOPLY_IDS.map((id) => (id === 'panoply-right-pauldron' ? 'Bought' : 'Next week')));
      assert.equal(one(rows[1], 'broker-price').textContent, 'Bought');
      assert.ok(kids(shell, 'broker-offer').filter((r) => !r.classList.contains('broker-panoply')).every((r) => btn(r).attrs.disabled === undefined), 'answered: the wares pressable again');
    } finally { view.unmount(); }
    // no deps: the window as it was
    const bare = document.createElement('div');
    document.body.append(bare);
    const plain = mountBrokerWindow(bare, { stock: () => stock, day: () => day, now: () => 0, items: () => purse, bought: () => [], buy: () => ({ ok: true }), picture: () => null, wearer: null, nameOf: (it) => it.name });
    try {
      assert.equal(kids(bare, 'broker-panoply').length, 0);
      assert.equal(one(bare, 'broker-panoply-head'), null);
    } finally { plain.unmount(); }
  });
});
