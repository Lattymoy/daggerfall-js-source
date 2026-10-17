// EG-E (2026-10-12, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md section 19, FEATS OF THE SPIRE): THE LORDS'
// FEATS (net/eliteGates/egFeats.js) - three a lord, judged by the relay at the lord's fall from what its Court saw (Unbroken: no
// member fell; Swift: felled within EG_FEAT_SWIFT_MS of its wake; its own signature), said on each earner's Redoubt
// receipt with the lord's key (net/eliteGates/egBrain.js redoubt; net/eliteGates/egReceipt.js `lk`, `ft`); a band's lords' feats, all held,
// its Master.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egFeatBits, egFeatName, egBandMastered, EG_FEAT_SIGNS, EG_FEAT_BANDS, EG_FEAT_SWIFT_MS, EG_FEAT_TWINS_MS, EG_FEATS_ALL } from '../../../src/net/eliteGates/egFeats.js';
import { egBreachNew, egEnter, egStep } from '../../../src/net/eliteGates/egBrain.js';
import { egHallOf, egFirstHallOf, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egReceiptValid } from '../../../src/net/eliteGates/egReceipt.js';
import { EG_BOSS_KEYS } from '../../../src/net/eliteGates/egLords.js';

const T0 = 1_800_000_000_000;

// PIN MOVED (EG-ZB, section 19's own example): Grath's signature reads who a burning bridge caught (the census's `F.cg`),
// no longer his Scorches - its pins below set the bridges burned (`mem.burnI`) and a catch.
test('EG-E THE FEATS (section 19): every lord three - Unbroken, Swift and its own signature; a champion none; each signature read off its Court (Grath felled with no member caught by a burning bridge - EG-ZB, every Examination passed, the Twins within 3 s, Garoth before the Covenant...); a band mastered when all its lords\' feats are held (mutants: a fall still Unbroken; a slow fall Swift; a bridge\'s catch forgiven)', () => {
  const lords = EG_BOSS_KEYS.filter((k) => !['kynreeve', 'kynmarcher', 'markynaz'].includes(k));
  assert.deepEqual(Object.keys(EG_FEAT_SIGNS).sort(), [...lords].sort(), 'every lord its signature');
  assert.deepEqual(EG_FEAT_BANDS.flat().sort(), [...lords].sort(), 'every lord in one band');
  const now = 1_000_000;
  const F = (o = {}) => ({ fellThisHall: 0, lordAt: now - 60_000, said: {}, mem: {}, ...o });
  assert.equal(egFeatBits('kynreeve', F(), { now }), 0, 'a champion keeps no feats');
  assert.equal(egFeatBits('hound', F({ mem: { burnI: 0 } }), { now }), EG_FEATS_ALL);
  assert.equal(egFeatBits('hound', F({ mem: { burnI: 0 }, cg: { 'Burning Bridge': ['acct-1'] } }), { now }), 0b011, 'a member caught by a burning bridge is not the signature');
  assert.equal(egFeatBits('hound', F({ fellThisHall: 1, mem: { burnI: 0 } }), { now }), 0b110, 'a fall breaks Unbroken');
  assert.equal(egFeatBits('hound', F({ lordAt: now - EG_FEAT_SWIFT_MS - 1 }), { now }), 0b001, 'past its par, not Swift');
  assert.equal(egFeatBits('spellmaster', F({ said: { passed: 2, failed: 1 } }), { now }) & 4, 0, 'a failed Examination');
  assert.equal(egFeatBits('spellmaster', F({ said: { passed: 2 } }), { now }) & 4, 4);
  // PIN MOVED (AUDIT EG V, b: lane1 #6 - the Twins' falls read off their own bodies, `fellAt` as net/eliteGates/egLords.js egLordHit sets it on
  // a lord body of `key` 'twins', never the Redoubt's beat; test/net/eliteGates/egaudit5_b.test.js drives them through the director)
  const twins = (gap) => ({ bodies: [{ key: 'twins', pt: 0, fellAt: now - gap }, { key: 'twins', pt: 1, fellAt: now }] });
  assert.equal(egFeatBits('twins', F(twins(EG_FEAT_TWINS_MS)), { now }) & 4, 4, 'within 3 s');
  assert.equal(egFeatBits('twins', F(twins(EG_FEAT_TWINS_MS + 1)), { now }) & 4, 0);
  assert.equal(egFeatBits('garoth', F(), { now, covenant: 1 }) & 4, 0, 'after the Covenant pressed');
  // PIN MOVED (AUDIT EG V, b: lane1 #4 - the Breakdown read off the Colossus's own body, its kneel as net/eliteGates/egLords.js's phase sets it)
  const knelt = { bodies: [{ key: 'colossus', kneelUntil: now - 1000 }] };
  assert.equal(egFeatBits('colossus', F(knelt), { now }) & 4, 4);
  assert.equal(egFeatBits('colossus', F({ ...knelt, said: { relit: 1 } }), { now }) & 4, 0, 'a heart relit');
  assert.equal(egFeatBits('colossus', F({ said: { phase: 2 } }), { now }) & 4, 0, 'no Breakdown of its own: another lord\'s phase words earn nothing');
  assert.deepEqual([0, 1, 2].map((k) => egFeatName('wyrm', k)), ['Unbroken', 'Swift', 'Brought to Earth']);
  const held = Object.fromEntries(EG_FEAT_BANDS[0].map((k) => [k, 7]));
  assert.equal(egBandMastered(held, 0), true);
  assert.equal(egBandMastered({ ...held, ilthys: 3 }, 0), false, 'one feat short');
});

test('EG-E THE FEATS ON THE RECEIPT (sections 19 and 23): a Court felled owes each earner a Redoubt receipt naming its lord and its feats as the Court earned them; the receipt\'s law takes `lk` and `ft` and refuses them out of shape (mutants: the feats left off; a fourth bit)', () => {
  let found = null;
  for (let seed = 1; seed < 200 && !found; seed++) { const h = egFirstHallOf(1) + 4, s = egHallOf(seed, h, 0); if (s.lord === 'hound') found = { seed, h }; }
  assert.ok(found);
  let s = found.seed;
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const co = [['acct-0', 'M0', 1], ['acct-1', 'M1', 2]];
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed: found.seed, op: T0, co, site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now);
  const spec = egHallOf(found.seed, found.h, 0);
  B.h = found.h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const at = { sx: spec.x0 + spec.arrive.x, z: spec.arrive.z };
  const step = () => { now += 250; return egStep(B, now, co.map(([sub]) => ({ sub, ...at, dead: false, at: now })), rng); };
  for (let k = 0; k < 60 && B.sg !== 'trial'; k++) step();
  assert.equal(B.sg, 'trial');
  // the Court's beats are counted as they are spoken: in the ring the lord wakes, and Grath's Scent is said
  const ring = { sx: spec.x0 + spec.ring.x, z: spec.ring.z };
  const stepAt = (p) => { now += 250; return egStep(B, now, co.map(([sub]) => ({ sub, ...p, dead: false, at: now })), rng); };
  for (let k = 0; k < 100 && !(B.F.said?.scent > 0); k++) stepAt(ring);
  assert.ok(B.F.said?.scent >= 1, 'the Scent counted');
  B.F.lordAt = now - 30_000; B.F.said = { scorched: 2 }; B.F.fellThisHall = 0; B.F.mem.lordsFell = 1; B.F.mem.burnI = 0; B.F.cg = {};   // PIN MOVED (EG-ZB): the bridges burned, none caught
  for (const [sub] of co) { B.mem[sub].dc = 100; B.mem[sub].act = 3; }
  step();
  const owed = B.owe.filter((o) => o.claims.q === 'w');
  assert.equal(owed.length, 2, 'each earner a Redoubt receipt');
  for (const o of owed) { assert.equal(o.claims.lk, 'hound'); assert.equal(o.claims.ft, 7, 'Unbroken, Swift and Unsinged'); }
  const c = { ...owed[0].claims, c: 5, i: 1_800_000_000, e: 1_800_000_000 + 3600, h: owed[0].claims.h };
  assert.equal(egReceiptValid(c), true);
  assert.equal(egReceiptValid({ ...c, ft: 8 }), false, 'a fourth bit');
  assert.equal(egReceiptValid({ ...c, lk: 'Hound!' }), false);
});
