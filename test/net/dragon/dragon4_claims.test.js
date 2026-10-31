// DRAGON4 (bible/11-Multiplayer/Dwarven-Dragon.md section 8): A SLAIN DRAGON'S REWARDS ON THE DEVICE - the carrier
// (net/dragon/dragonClaims.js) keeps a signed receipt until the service settles it, says its lines once, awaits the hoard's
// grant and keeps a receipt whose grant failed, and hears a tame once; the hoard's roll (systems/dragon/dragonSpoils.js) is
// the seed's own; the rewards (scenes/dragonRewards.js) put the hoard in the pack through the world's door and keep a tame
// until it is bound. tools/mutants/dragon4.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDragonClaims, dragonClaimVerdict, DRAGON_CLAIMS_KEY } from '../../../src/net/dragon/dragonClaims.js';
import { rollDragonSpoils, dragonSpoilsList, DRAGON_GOLD_PER_LEVEL, DRAGON_SPOILS_LEGENDARY } from '../../../src/systems/dragon/dragonSpoils.js';
import { createDragonRewards, DRAGON_TAMES_KEY } from '../../../src/scenes/dragonRewards.js';
import { DRAGON_CLAIM_TEXT } from '../../../src/systems/dragon/dragonWords.js';
import { mintDragonReceipt } from '../../../src/net/dragon/dragonReceipt.js';
import { STOOD_GOLD } from '../../../src/systems/serpent/serpentSpoils.js';
import { hearActs } from '../../../src/systems/questlines/qlActs.js';

const { subtle } = globalThis.crypto;
const NOW = Math.floor(Date.now() / 1000);
const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
const R = (o = {}) => mintDragonReceipt({ q: 500_004, b: 0, s: 'acct-0001', c: 42, x: 'dealt', l: 20, ...o }, kp.privateKey, { subtle, nowS: NOW });
const mem = () => { const m = new Map(); return { get: (k) => (m.has(k) ? m.get(k) : null), set: (k, v) => m.set(k, JSON.parse(JSON.stringify(v))), m }; };
const ok = (data) => ({ ok: true, data });
/** Every flush the carrier began has ended (an add flushes at once; a flush asked meanwhile runs after it). */
const settle = () => new Promise((done) => setTimeout(done, 20));

test('DRAGON4 carrier: a receipt counted is said once and let go, its act heard; a guest\'s kept with its line said once; a tame said once and handed on; a grant that fails keeps its receipt (mutants: the act on any answer; a tame said each time; a failed grant settled)', async () => {
  const said = [], tames = [], acts = [];
  hearActs('dragon4-test', (k) => acts.push(k));
  let answer = ok({ recorded: true, slain: 3, spoils: true, tamed: { id: 'dg0123456789abcdef', look: 0, character: 'char-0001' } });
  let failGrant = true;
  const store = mem();
  const C = createDragonClaims({ claim: async () => answer, store, me: () => 'acct-0001', nowS: () => NOW, say: (t) => said.push(t),
    onSpoils: async () => { if (failGrant) throw new Error('the pack was full'); }, onTamed: (t) => tames.push(t.id) });
  const r = await R();
  C.add(r, 'char-0001', 'Ama', 20);
  await settle();
  assert.equal(C.kept().length, 1, 'a grant that failed keeps the receipt');
  assert.deepEqual(tames, ['dg0123456789abcdef']);
  failGrant = false;
  answer = ok({ recorded: false, why: 'claimed', slain: 3, spoils: true, tamed: answer.data.tamed });   // the service's second answer
  await C.flush(); await settle();
  assert.equal(C.kept().length, 0, 'given, then settled');
  assert.deepEqual(tames, ['dg0123456789abcdef'], 'the tame heard once');
  assert.equal(said.filter((x) => x === DRAGON_CLAIM_TEXT.tamed()).length, 1);
  assert.ok(said.includes(DRAGON_CLAIM_TEXT.recorded(3)));
  assert.deepEqual(acts.filter((k) => k === 'dragon-slain'), ['dragon-slain'], 'its act heard, once');
  assert.equal(C.add(r, 'char-0001'), false, 'a settled receipt is never kept again');
  // a guest
  const G = createDragonClaims({ claim: async () => ok({ recorded: false, why: 'guest', slain: 0, spoils: false, tamed: null }), store: mem(), me: () => 'acct-0001', nowS: () => NOW, say: (t) => said.push(t) });
  G.add(await R({ q: 500_007 }), 'char-0001');
  await settle(); await G.flush(); await settle();
  assert.equal(said.filter((x) => x === DRAGON_CLAIM_TEXT.guest()).length, 1, 'said once');
  assert.equal(G.kept().length, 1, 'kept for the week it may still register in');
  assert.equal(dragonClaimVerdict({ ok: false, error: 'renown-character' }), 'done');
  assert.equal(dragonClaimVerdict({ ok: false, error: 'receipt', why: 'signature' }), 'keep');
  assert.equal(dragonClaimVerdict({ ok: false, error: 'receipt', why: 'claims' }), 'done');
  assert.equal(dragonClaimVerdict({ ok: false, error: 'offline' }), 'keep');
  assert.ok(Array.isArray(store.m.get(DRAGON_CLAIMS_KEY)));
  hearActs('dragon4-test', null);
});

test('DRAGON4 the hoard: the seed\'s own - the same seed, level and earning the same hoard; a dealer\'s Rare or better and a Magic or better, a stander\'s Magic or better and STOOD_GOLD of the gold; its gold DRAGON_GOLD_PER_LEVEL a level within a fifth; the Rare piece Legendary about DRAGON_SPOILS_LEGENDARY of the time (mutants: a stander paid a dealer\'s; the Legendary\'s share)', () => {
  const a = dragonSpoilsList(1234, 20, 'dealt'), b = dragonSpoilsList(1234, 20, 'dealt');
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
  const d = rollDragonSpoils(99, 20, 'dealt'), s = rollDragonSpoils(99, 20, 'stood');
  assert.equal(d.pieces.length, 2);
  assert.ok(['rare', 'legendary'].includes(d.pieces[0].tier), d.pieces[0].tier);
  assert.equal(s.pieces.length, 1);
  assert.ok(['magic', 'rare', 'legendary'].includes(s.pieces[0].tier));
  let legendary = 0, gMin = Infinity, gMax = 0;
  for (let seed = 1; seed <= 600; seed++) {
    const h = rollDragonSpoils(seed, 10, 'dealt');
    if (h.pieces[0].tier === 'legendary') legendary++;
    gMin = Math.min(gMin, h.gold); gMax = Math.max(gMax, h.gold);
    assert.ok(h.pieces.every((p) => p.item.isIdentified), 'every piece known');
  }
  assert.ok(gMin >= DRAGON_GOLD_PER_LEVEL * 10 * 0.8 - 1 && gMax <= DRAGON_GOLD_PER_LEVEL * 10 * 1.2 + 1);
  assert.ok(Math.abs(legendary / 600 - DRAGON_SPOILS_LEGENDARY) < 0.06, `${legendary} of 600 Legendary`);
  const st = rollDragonSpoils(5, 10, 'stood').gold, dl = rollDragonSpoils(5, 10, 'dealt').gold;
  assert.ok(Math.abs(st - dl * STOOD_GOLD) <= 1, 'a stander\'s share of the gold');
});

test('DRAGON4 the rewards: a counted receipt\'s hoard into the pack through the world\'s door (every piece and its gold); a tame kept on the device until it is bound (mutants: the hoard never given; a tame forgotten)', async () => {
  const taken = [], storage = new Map();
  const rewardsStorage = { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: (k) => storage.delete(k) };
  const tame = { id: 'dgfedcba9876543210', look: 1, character: 'char-0001' };
  const host = { rewardsStorage, takeSpoil: (p) => taken.push(p.kind), relayNowS: () => NOW, chatNotice: () => {},
    dragonAccount: { me: () => 'acct-0001', claim: async () => ok({ recorded: true, slain: 1, spoils: true, tamed: tame }) } };
  const rw = createDragonRewards(host);
  rw.receipt(await R({ c: 9 }));
  await rw.claims.flush();
  for (let i = 0; i < 20 && !taken.length; i++) await new Promise((done) => setTimeout(done, 5));
  assert.ok(taken.includes('gold') && taken.filter((k) => k === 'item').length === 2, JSON.stringify(taken));
  assert.deepEqual(rw.tames().map((x) => [x.id, x.look, x.w]), [[tame.id, 1, 500_004]]);
  assert.ok(storage.has(DRAGON_TAMES_KEY));
  rw.boundTame(tame.id);
  assert.deepEqual(rw.tames(), []);
});

test('DRAGON4 world: the host\'s wiring - a receipt the link hears to the rewards, the world\'s pack door, the relay\'s clock and the chat\'s line handed in, its claims ticked in every mode, its hoard\'s crash door at a stand-up and the realm save\'s two hooks (mutants: each wire cut)', async () => {
  const { hostText } = await import('../../hostText.mjs');
  const w = hostText('src/scenes/world.js');
  const h = readFileSync(new URL('../../../src/scenes/dragonHost.js', import.meta.url), 'utf8');
  assert.ok(h.includes('onReceipt: (r) => host?.receipt(r) });'), 'PIN MOVED (AUDIT DRAGON): the receipt from the link, in the sky the dragon\'s host makes');
  assert.ok(h.includes('host.tick();   // DRAGON4: its receipts offered in their time, in any mode'), 'PIN MOVED (AUDIT DRAGON): ticked in the sky\'s online frame');
  for (const wired of [
    'takeSpoil, relayNowS, chatNotice: (text) => chatNotice(text),',
    'dragonSky?.recoverSpoils(who, _spoilsInSave);',
    '...(dragonSky?.spoilsHeld(who) ?? [])',
    'dragonSky?.spoilsSaved(who, ids);',
  ]) assert.ok(w.includes(wired), wired);
});
