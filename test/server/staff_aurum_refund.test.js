// An Aurum buy given back from the staff panel (server-account/src/staffAurum.js), on the real Worker over node:sqlite:
// the preview names the newest buy and what would leave; the confirm gives the Aurum back, takes the ware off as a money
// refund would (keeping what another buy covers), sends a letter, writes the audit row, and a later buy pays again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { staffWords, STAFF_SESSION_HEADER, STAFF_STATUS } from '../../server-account/src/staff.js';
import { STAFF_ROUTES } from '../../server-account/src/service.js';
import { AURUM_REFUND_PATH, aurumRefundPost } from '../../server-account/src/staffAurum.js';
import { SHOP_WARES, shopHeldIds } from '../../src/net/shopLaw.js';

const { subtle } = globalThis.crypto;
const enc = new TextEncoder();
const nowS = () => Math.floor(Date.now() / 1000);
const b64url = (bytes) => Buffer.from(bytes).toString('base64url');
const PASSWORD = 'a good long one';
const BUNDLE = 'bundle:lordofoblivion';
const PYRE = 'kill:pyre';

async function extensionKey() {
  const pair = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = b64url(new Uint8Array(await subtle.exportKey('raw', pair.publicKey)));
  let last = 0;
  const proof = async (what, handle, ts = Math.max(nowS(), last + 1)) => {
    last = Math.max(last, ts);
    const sig = b64url(new Uint8Array(await subtle.sign({ name: 'Ed25519' }, pair.privateKey, enc.encode(staffWords(what, handle.toLowerCase(), ts)))));
    return { pub, ts, sig };
  };
  return { pub, proof };
}

async function stand() {
  const chiefKey = await extensionKey();
  const s = await standService({
    DEVELOPER_HANDLES: 'SirMcMobdon', MODERATOR_HANDLES: 'Asynian', OWNER_HANDLES: 'SirMcMobdon', OWNER_KEYS: `SirMcMobdon:${chiefKey.pub}`,
    AURUM_OPEN: 'on', SHOP_ON_SALE: SHOP_WARES.filter((ware) => ware.alone).map((ware) => ware.id).join(','),
  });
  const raw = s.env.DB._raw;
  const staff = async (path, body = {}, token = null) => {
    const res = await s.fetch(`https://accounts.invalid${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.1', ...(token ? { [STAFF_SESSION_HEADER]: token } : {}) }, body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  for (const handle of ['SirMcMobdon', 'Asynian']) await s.registered(handle);
  const chief = (await staff('/v1/staff/login', { handle: 'SirMcMobdon', password: PASSWORD, ...(await chiefKey.proof('login', 'SirMcMobdon')) })).body;
  const invite = await staff('/v1/staff/invite', { handle: 'Asynian' }, chief.session);
  const modKey = await extensionKey();
  const mod = (await staff('/v1/staff/enroll', { handle: 'Asynian', password: PASSWORD, invite: invite.body.invite, ...(await modKey.proof('enroll', 'Asynian')) })).body;
  const ask = (who, path, body) => s.fetch(`https://accounts.invalid${path}`, body === undefined
    ? { headers: { authorization: `Bearer ${who.secret}` } }
    : { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${who.secret}` }, body: JSON.stringify(body) })
    .then(async (res) => ({ status: res.status, body: await res.json() }));
  const fund = (who, aurum) => raw.prepare("INSERT INTO aurum_ledger (account, kind, ref, amount, day, at) VALUES (?, 'cache', ?, ?, 0, 0)").run(who.id, `fund${Math.random()}`, aurum);
  const balance = async (who) => (await ask(who, '/v1/account')).body.aurum.balance;
  const held = (who) => shopHeldIds(raw.prepare('SELECT shop_wares, shop_held FROM players WHERE id = ?').get(who.id));
  const buy = async (who, id) => {
    const price = (await ask(who, '/v1/account')).body.shop.wares.find((ware) => ware.id === id).price;
    const res = await ask(who, '/v1/aurum/buy', { ware: id, price });
    assert.equal(res.status, 200, `${id} bought: ${JSON.stringify(res.body)}`);
    return res.body;
  };
  const admin = (body) => staff(AURUM_REFUND_PATH, body, chief.session);
  const moderator = (body) => staff(AURUM_REFUND_PATH, body, mod.session);
  return { ...s, raw, fund, balance, held, buy, admin, moderator };
}

test('the refund door is a staff door, and its refusals have statuses', () => {
  assert.ok(STAFF_ROUTES.has(AURUM_REFUND_PATH));
  for (const word of ['no-aurum-buy', 'aurum-buy-moved', 'aurum-refund-busy']) assert.ok(STAFF_STATUS[word] >= 400, word);
});

test('a bundle bought with Aurum is given back: its Aurum returns, its wares leave, a ware bought alone stays', async () => {
  const s = await stand();
  const player = await s.registered('MarioTest');
  s.fund(player, 6000);
  await s.buy(player, PYRE);
  const bundle = await s.buy(player, BUNDLE);
  assert.ok(bundle.spent < 3000, 'the bundle cost less for the pyre held');
  const spent = await s.balance(player);

  const preview = await s.admin({ handle: 'mariotest' });
  assert.equal(preview.status, 200);
  assert.equal(preview.body.buy.ware, BUNDLE, 'the newest buy is the bundle');
  assert.equal(preview.body.buy.aurum, bundle.spent);
  assert.deepEqual(preview.body.buys.map((line) => line.ware), [BUNDLE, PYRE]);
  assert.equal(preview.body.balance, spent);
  assert.equal(preview.body.after, spent + bundle.spent);
  assert.ok(!preview.body.gone.includes(PYRE), 'the pyre is held by its own buy');
  for (const id of [BUNDLE, 'mount:warhorse', 'portal:daedric', 'aura:dominion']) assert.ok(preview.body.gone.includes(id), id);
  assert.equal(await s.balance(player), spent, 'a preview changes nothing');

  const at = preview.body.buy.at;
  assert.equal((await s.admin({ handle: 'mariotest', ware: BUNDLE, at, confirm: true, note: 'asked' })).body.error, 'staff-reason');
  assert.equal((await s.admin({ handle: 'mariotest', ware: BUNDLE, at, confirm: true, reason: 'player-asked' })).body.error, 'staff-note');
  assert.equal((await s.admin({ handle: 'mariotest', ware: BUNDLE, at: at - 1, confirm: true, reason: 'player-asked', note: 'asked' })).body.error, 'aurum-buy-moved');
  assert.equal((await s.admin({ handle: 'mariotest', confirm: true, reason: 'player-asked', note: 'asked' })).body.error, 'body', 'a confirm names the buy');

  const done = await s.admin({ handle: 'mariotest', ware: BUNDLE, at, confirm: true, reason: 'player-asked', note: 'Bought by mistake' });
  assert.equal(done.status, 200, JSON.stringify(done.body));
  assert.equal(done.body.aurum, bundle.spent);
  assert.equal(done.body.balance, spent + bundle.spent);
  assert.equal(await s.balance(player), spent + bundle.spent);
  const now = s.held(player);
  assert.ok(now.includes(PYRE));
  for (const id of [BUNDLE, 'mount:warhorse', 'portal:daedric', 'aura:dominion']) assert.ok(!now.includes(id), id);
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM aurum_ledger WHERE account = ? AND kind = 'buy' AND ref = ?").get(player.id, BUNDLE).n, 0);

  const letter = s.raw.prepare('SELECT subject, body FROM server_post WHERE to_id = ? AND batch LIKE ?').get(player.id, 'aurum-refund-%');
  assert.equal(letter.subject, 'Refunded: Lord of Oblivion');
  assert.match(letter.body, /back on your balance/);
  const row = s.raw.prepare("SELECT outcome, detail FROM staff_audit WHERE act = 'aurum-refund' AND outcome = 'ok'").get();
  assert.equal(JSON.parse(row.detail).note, 'Bought by mistake');

  assert.equal((await s.admin({ handle: 'mariotest', ware: BUNDLE, at, confirm: true, reason: 'player-asked', note: 'again' })).body.error, 'no-aurum-buy', 'given back once');
  const again = await s.buy(player, BUNDLE);
  assert.equal(again.spent, bundle.spent, 'bought again, it is paid again');
});

test('a ware named by staff is given back, not only the newest', async () => {
  const s = await stand();
  const player = await s.registered('ShibaTest');
  s.fund(player, 6000);
  await s.buy(player, PYRE);
  await s.buy(player, BUNDLE);
  const preview = await s.admin({ handle: 'ShibaTest', ware: PYRE });
  assert.equal(preview.body.buy.ware, PYRE);
  assert.deepEqual(preview.body.gone, [PYRE], 'the bundle was sold less the pyre, so it does not give it');
  const done = await s.admin({ handle: 'ShibaTest', ware: PYRE, at: preview.body.buy.at, confirm: true, reason: 'bug', note: 'test' });
  assert.equal(done.body.aurum, 1500);
  assert.ok(!s.held(player).includes(PYRE));
  assert.ok(s.held(player).includes('aura:dominion'), 'the bundle keeps what it paid for');
});

test('only an Admin gives a buy back, and an account with none is told so', async () => {
  const s = await stand();
  const player = await s.registered('NoBuys');
  assert.equal((await s.moderator({ handle: 'NoBuys' })).body.error, 'staff-admin');
  assert.equal((await s.admin({ handle: 'NoBuys' })).body.error, 'no-aurum-buy');
  assert.equal((await s.admin({ handle: 'nobody-here' })).body.error, 'no-player');
  void player;
});

test('the letter is plain and names what left', () => {
  const letter = aurumRefundPost({ ref: BUNDLE, amount: -3000, at: 5 }, [BUNDLE, 'aura:dominion']);
  assert.equal(letter.batch, `aurum-refund-${BUNDLE}-5`);
  assert.match(letter.body, /Its 3,000 Aurum are back on your balance\./);
  assert.match(letter.body, /Off your account: Lord of Oblivion, Daedric Dominion\./);
  assert.ok(letter.body.length <= 1200 && letter.subject.length <= 80);
});
