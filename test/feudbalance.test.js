// FEUD BALANCE (bible/12-Enhanced-AI/Feud-Arc.md section 31's OPEN 22-24 and the FEUD BALANCE record; Mac, 2026-10-05,
// on AUDIT FEUD's measured misses: each as recommended). OPEN 22 - a revenant's will is broken by its weakness, or by ONE
// stagger or ONE perfect dodge of its blow (two staggers came one rank-3 fight in nine). OPEN 23 - its last stand rises
// to 30 / 35 / 40% of its health by rank (35 / 45 / 55%: a rank 5 was 3.25 times a rank 1's fight). OPEN 24 - dodging
// pays in the will and in the blows not taken, never in speed: the harness's target is a perfect dodger struck by a
// tenth of a trader's telegraphed blows or fewer, and no slower.
// Pinned: the law; the will through the ledger's counts (a perfect dodge, a stagger) and the fate's own ask; the page's
// words; the harness's target and its verdict through the real measure. (The brain's writer of a perfect dodge - mine
// alone, only when I left its shape - is pinned in auditfeud2's B1.)
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};

const N = await import('../src/systems/revenant.js');
const F = await import('../src/systems/revenantFeud.js');
const L = await import('../src/systems/feudLedger.js');
const FT = await import('../src/systems/revenantFate.js');
const PG = await import('../src/ui/revenantPage.js');
const { setPref, _resetForTests } = await import('../src/systems/uiPrefs.js');
const { MOBILE_TYPES: M } = await import('../src/characters/mobileTypes.js');

const me = { isPlayer: true, name: 'Ayla Stormwind', characterId: 'char-feudbalance', level: 8, items: [] };
beforeEach(() => { _resetForTests(); setPref('lootRarity', true); N._resetRevenantForTests(); _store.clear(); });
/** A rank-`rank` revenant stood on a real entity, its pool record (`f`) as the doors hold it. */
function stood(rank = 3) {
  const r = N.revenantDeed(me, { mobileType: M.Orc, level: 6, champion: 'mighty', health: 5, maxHealth: 50, team: 'Monster' }, 'fled', { mobileType: M.Orc, rolls: () => 0 });
  r.rank = rank;
  const entity = { mobileType: M.Orc, level: 6, health: 60, maxHealth: 60, team: 'Monster', items: [] };
  N.applyRevenant(entity, r);
  return { entity, mobileType: M.Orc, ai: { feet: [0, 0, 0] } };
}

test('FEUD BALANCE THE LAW: one stagger or one perfect dodge breaks the will (its weakness ever did); the last stand at 30 / 35 / 40% (mutants: two again; the perfect dodge uncounted; a share moved)', () => {
  assert.equal(F.WILL_STAGGERS, 1);
  assert.equal(F.willBroken({ staggers: 0, perfect: 0, weak: 0 }), false);
  assert.equal(F.willBroken({ staggers: 0, perfect: 1, weak: 0 }), true, 'a perfect dodge');
  assert.equal(F.willBroken({ staggers: 1, perfect: 0, weak: 0 }), true, 'a stagger');
  assert.equal(F.willBroken({ dodged: 5, backHits: 5 }), false, 'a dodge that was not perfect, a blow at its back: neither');
  assert.deepEqual({ ...F.LAST_STAND_HEALTH }, { 3: 0.3, 4: 0.35, 5: 0.4 });
});

test('FEUD BALANCE THE WILL, THROUGH THE LEDGER: a rank-3 one\'s will holds until my perfect dodge (or my stagger) is written in its fight - then it does not (mutants: the ledger unread)', () => {
  const f = stood(3);
  assert.equal(FT.revenantWillHolds(f), true, 'nothing yet');
  L.noteFeud(f.entity, 'dodged');
  assert.equal(FT.revenantWillHolds(f), true, 'a plain dodge is no perfect one');
  L.noteFeud(f.entity, 'perfect');
  assert.equal(FT.revenantWillHolds(f), false, 'my perfect dodge broke it');
  const g = stood(3);
  L.noteFeud(g.entity, 'staggers');
  assert.equal(FT.revenantWillHolds(g), false, 'my stagger broke it');
  assert.equal(FT.revenantWillHolds(stood(2)), false, 'under rank 3 there is no will to break');
});

test('FEUD BALANCE THE PAGE: its will\'s rule says all three ways; its last stand its new share (mutants: the old words)', () => {
  assert.equal(PG.willWords({ rank: 3 }), 'Its will must be broken - strike its weakness, stagger it, or dodge its blow perfectly.');
  assert.equal(PG.lastStandWords({ rank: 4 }), 'Last stand: once a fight it rises again, at 35% of its health.');
});

test('FEUD BALANCE THE HARNESS: dodging pays in the blows not taken - a tenth of a trader\'s or fewer, and no slower - and the verdict reads both (mutants: the share moved; the time unread)', async () => {
  const { FEUD_TARGETS } = await import('../tools/tellDuel.mjs');
  assert.equal(FEUD_TARGETS.DODGE_SPARES, 0.1);
  assert.equal('DODGE_PAYS' in FEUD_TARGETS, false, 'the old time share is gone');
  // PIN MOVED (AUDIT FEUD 2: the verdict is its own function - its ratios from the cells' unrounded means)
  const { feudVerdict, measureFeud } = await import('../tools/tellDuel.mjs');
  const cell = (weapon, mode, weak, mean, hits, kneel = 0.5) => ({ weapon, mode, weak, kneel, raw: { mean, hitsOnMe: hits } });
  const ranks = ['trade', 'dodge'].flatMap((mode) => [1, 2, 3, 4, 5].map((rank) => ({ mode, rank, raw: { mean: 5 + rank, hitsOnMe: 0 } })));
  const v = (dodgeMean, dodgeHits) => feudVerdict([cell('Longsword', 'trade', false, 12, 2), cell('Longsword', 'dodge', false, dodgeMean, dodgeHits), cell('Longsword', 'trade', true, 9, 1.6, 1)], ranks).DODGE_PAYS;
  assert.deepEqual(v(11, 0.1), { struck: 0.05, time: 0.917, held: true }, 'a twentieth of the blows, faster');
  assert.equal(v(13, 0.1).held, false, 'slower: not paid');
  assert.equal(v(11, 0.4).held, false, 'struck a fifth as often: not paid');
  assert.deepEqual(Object.keys(measureFeud({ fights: 2, weapons: ['Longsword'] }).verdict.DODGE_PAYS).sort(), ['held', 'struck', 'time'], 'the real measure reads it so');
});
