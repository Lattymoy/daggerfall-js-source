// AUDIT 30 (2026-09-29, Mac: "Do it") - THE LAWS OF PROF3-PROF5, AS THE AUDIT FOUND THEM: a herb's key in its one
// spelling; a maker's name well-formed and a record never past its own bound; the mark a claim of its own; a worn
// piece never "100%"; the tax on the running total; a catalogue of what something yields; a piece listable by its
// family; a listing's worth bounded; a piece listed only as it was minted; a plane drawn, not flicked. Each pin failed on
// the code before its fix. bible/06-Systems/Online-Arc.md AUDIT 30.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { material } from '../../src/net/nodeLaw.js';
import { makerName, MAKER_MAX, PLANE_ACT, MASTERWORK } from '../../src/net/recipeLaw.js';
import { mintProductRecord, readProductRecord, productRecordValid, PRODUCT_RECORD_MAX } from '../../src/net/productRecord.js';
import {
  wearText, saleTax, saleTaxOn, marketCatalogue, UNYIELDED, pieceListable, MARKET_WORTH_MAX,
} from '../../src/net/marketLaw.js';
import { MARKS_MAX } from '../../src/net/marksLaw.js';
import { createPlaneAct } from '../../src/systems/planeAct.js';
import { asMinted } from '../../src/systems/smithItems.js';
import { RARE_FLAVOURS } from '../../src/systems/loot/lootRarity.js';

const { subtle } = globalThis.crypto;
const claims = (over = {}) => ({ p: 'f'.repeat(16), s: 'S'.repeat(40), h: 'H'.repeat(40), r: 'longsword:mithril', q: 2, m: 'Silverthorn', c: 7, ...over });

test('AUDIT 30 L1: a herb\'s key is read in its one spelling - `p1:08` is no material (an order for it could never be filled)', () => {
  assert.ok(material('p1:8'));
  for (const k of ['p1:08', 'p1:008', 'p2:09', 'p1:-8', 'p1:8 ']) assert.equal(material(k), null, k);
  assert.equal(marketCatalogue().some((c) => c.key === 'p1:08'), false);
});

test('AUDIT 30 L3: a maker\'s name is well-formed - no lone surrogate kept, no pair split at the cut; a record past its bound is never minted', async () => {
  const cut = makerName(`${'A'.repeat(MAKER_MAX - 1)}\u{1F600}`);
  assert.equal(cut, 'A'.repeat(MAKER_MAX - 1), 'the pair the cut split dropped whole');
  assert.equal(makerName('Ab\ud800c'), 'Abc', 'a lone high surrogate');
  assert.equal(makerName('Ab\udc00c'), 'Abc', 'a lone low surrogate');
  assert.equal(makerName('Silver\u{1F600}thorn'), 'Silver\u{1F600}thorn', 'a whole pair kept');
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const wide = claims({ m: '\u0001'.repeat(MAKER_MAX), h: 'H'.repeat(64), c: 0xffffffff });
  await assert.rejects(mintProductRecord(wide, kp.privateKey, { subtle, nowS: 9_999_999_999 }), RangeError, 'a record its own reader refuses');
  const rec = await mintProductRecord(claims(), kp.privateKey, { subtle, nowS: 1 });
  assert.ok(rec.length <= PRODUCT_RECORD_MAX && readProductRecord(rec));
});

test('AUDIT 30 L4: the maker\'s mark is a claim of the record (`a`), where the law marks a piece - a Masterwork or furniture - and nowhere else', async () => {
  const rec = await mintProductRecord(claims({ q: MASTERWORK, a: true }), null, { subtle, nowS: 1 });
  assert.equal(readProductRecord(rec).a, 1);
  assert.equal(readProductRecord(await mintProductRecord(claims({ q: MASTERWORK }), null, { subtle, nowS: 1 })).a, undefined);
  assert.equal(productRecordValid({ ...claims({ q: MASTERWORK }), i: 1, a: 1 }), true);
  assert.equal(productRecordValid({ ...claims({ r: 'table-small:oak', q: 1 }), i: 1, a: 1 }), true, 'a Master Joiner\'s table at any quality');
  assert.equal(productRecordValid({ ...claims({ q: 2 }), i: 1, a: 1 }), false, 'an Exceptional sword bears no mark');
  assert.equal(productRecordValid({ ...claims({ q: MASTERWORK, m: null }), i: 1, a: 1 }), false, 'no maker, no mark');
  assert.equal(productRecordValid({ ...claims({ q: MASTERWORK }), i: 1, a: true }), false, 'the claim is 1');
});

test('AUDIT 30 L5 + L6: a worn piece never reads "worn to 100%"; the tax is taken on a listing\'s running total', () => {
  assert.deepEqual([995, 999, 994, 5, 1000].map(wearText), ['worn to 99%', 'worn to 99%', 'worn to 99%', 'worn to 1%', null]);
  assert.equal(saleTaxOn(0, 20), 1);
  assert.equal(saleTaxOn(0, 10) + saleTaxOn(10, 10), saleTax(20), 'two buys of ten pay what one of twenty does');
  for (const [b, t] of [[0, 19], [19, 1], [1234, 5678], [99, 1]]) assert.equal(saleTaxOn(b, t), saleTax(b + t) - saleTax(b));
});

test('AUDIT 30 L7 + L2 + L8: the catalogue holds what something yields; a piece is listable by its crafted family; a listing\'s worth is a balance\'s', () => {
  // PROF7 moved it: Hunting yields the Bear Hide; PIN MOVED (AUDIT-SEATS): the sieges' Spoils yield the Warforged ingot and
  // the silk; PIN MOVED (DAEDRIC-SMELT, Professions-Arc.md section 53): the forge smelts the Daedric Ingot, and the heart it
  // takes - loose alone, never counted by the service - is the loose door's, as CLOTH-GEMS' graded gems are
  // (professionLaw.js LOOSE_ONLY_KEYS): nothing waits on a yield
  assert.deepEqual([...UNYIELDED], []);
  const keys = new Set(marketCatalogue().map((c) => c.key));
  for (const k of UNYIELDED) assert.equal(keys.has(k), false, k);
  assert.equal(keys.has('part:daedra-heart'), false, 'DAEDRIC-SMELT: the heart is no catalogue\'s');
  assert.equal(keys.has('ingot:daedric'), true, 'DAEDRIC-SMELT: the ingot is the catalogue\'s now');
  assert.equal(keys.has('ingot:iron') && keys.has('ore:mithril'), true);
  assert.equal(pieceListable('longsword:mithril'), true);
  assert.equal(pieceListable('table-small:oak'), true);
  assert.equal(pieceListable('arrows:north'), false, 'twenty arrows, one product row');
  assert.equal(pieceListable('no-such-recipe'), false);
  assert.equal(MARKET_WORTH_MAX, MARKS_MAX);
});

test('AUDIT 30 C2: a piece is listable only as its record mints it - an item maker\'s enchantment is not the roll, and would be lost on the way', () => {
  const plain = { provenance: 'a'.repeat(16), group: 'Weapons' };
  assert.equal(asMinted(plain), true);
  assert.equal(asMinted({ ...plain, enchantments: [{ type: 1, param: 7 }] }), false, 'a plain piece enchanted');
  const roll = RARE_FLAVOURS.Weapons[0];
  const rare = { ...plain, rarity: 'rare', enchantments: [{ ...roll }] };
  assert.equal(asMinted(rare), true, 'a Masterwork\'s own flavour');
  assert.equal(asMinted({ ...rare, enchantments: [{ ...roll }, { type: 99, param: 1 }] }), false, 'more than its roll');
  assert.equal(asMinted({ ...rare, enchantments: [{ type: 999, param: 1 }] }), false, 'another in its place');
  assert.equal(asMinted({ ...plain, customEnchantments: [{ type: 'x' }] }), false);
  assert.equal(asMinted({ ...plain, legendary: 'x' }), false);
  assert.equal(asMinted({ group: 'Weapons' }), false, 'no provenance');
});

test('AUDIT 30 A1: the plane is drawn, not flicked - its clock starts at the first forward move, and a jump between two events is scored along its line', () => {
  assert.equal(PLANE_ACT.step, 0.025);
  for (const phase of [0.1, 0.25, 0.5, 0.8]) {
    const act = createPlaneAct({ rank: 0, band: 0.85, rng: () => phase });
    act.press(0.02, act.grain(0.02), 0);
    act.move(0.02, act.grain(0.02) + 0.9, 0.6);   // held at the head
    act.move(0.99, act.grain(0.99), 1.3);          // one flick to the foot
    const rep = act.report();
    assert.equal(rep.clean, false, `phase ${phase}: a press held still and one flick`);
    assert.ok(rep.seconds < PLANE_ACT.minS && act.state.devs.length >= 39);
  }
  // a pass drawn along the grain at a steady pace is still clean, however few its events
  const act = createPlaneAct({ rank: 0, band: 1, rng: () => 0.25 });
  act.press(0.02, act.grain(0.02), 0);
  for (let i = 1; i <= 10; i++) { const x = 0.02 + (0.98 * i) / 10; act.move(x, act.grain(Math.min(1, x)), 0.2 * i); }
  const rep = act.report();
  assert.ok(rep.seconds >= PLANE_ACT.minS && rep.seconds <= PLANE_ACT.maxS, String(rep.seconds));
  assert.equal(rep.clean, rep.deviation <= act.state.tol);
});
