// REP4 (2026-09-29, the reputation overhaul) - THE ROAD BACK. Mac's call for how a bad name recovers: "Earn it + faster
// drift" - "Temple penance, paid reparations (price rises each use), regional contracts and raid defence, plus negative
// standing drifting back about 1 point per 7 game days (~14 real hours)."
//
// DFU's one road back was NormalizeReputations: a point toward zero every 112 game days (about nine real days online),
// so -100 to 0 was some two and a half real years; nothing could be paid or done.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runCalendarArms, normalizeAcross, DAY_ARMS } from '../../src/systems/worldTick.js';
import { RECOVERY_INTERVAL_MINUTES, NORMALIZE_INTERVAL_MINUTES, legalRepOf, setLegalRepNotifier } from '../../src/systems/court.js';
import {
  penancePrice, penanceHelps, doPenance, rewardContract, PENANCE_POINTS, PENANCE_BASE_PRICE, CONTRACT_LEGAL_GAIN,
} from '../../src/systems/standing.js';
import { buildDonationFlow } from '../../src/ui/guildServiceWindows.js';
import { createRegionConditions } from '../../src/systems/region/regionConditions.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
/** A faction store of the shape changeReputation walks, two plain factions. */
const store = (a, b) => {
  const dict = new Map([[1, { id: 1, rep: a, parent: 0, ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0, type: 0 }],
    [2, { id: 2, rep: b, parent: 0, ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0, type: 0 }]]);
  return { dict };
};

test('REP4: lived, a standing below zero recovers a point every seven days - legal and faction alike; a positive standing wears down on DFU\'s 112 days only, and the 112th day pays a bad name one point, not two (mutants: DFU\'s 112-day recovery; the week wearing the good down; the boundary paying twice)', () => {
  assert.deepEqual([RECOVERY_INTERVAL_MINUTES, NORMALIZE_INTERVAL_MINUTES % RECOVERY_INTERVAL_MINUTES], [7 * 1440, 0]);
  const e = { legalRep: { 1: -30, 2: 30 }, factionRep: store(-30, 30) };
  // [1, 16 weeks + 1): the minute values 10080, 20160 ... 161280 - sixteen boundaries, the last DFU's own
  runCalendarArms(e, 1, NORMALIZE_INTERVAL_MINUTES + 1, { arms: DAY_ARMS.own });
  assert.deepEqual(e.legalRep, { 1: -14, 2: 29 }, 'sixteen weeks: sixteen points back; the good name one point down, at the 112th day');
  assert.deepEqual([e.factionRep.dict.get(1).rep, e.factionRep.dict.get(2).rep], [-14, 29]);
  const shielded = { legalRep: { 1: -30 }, preventNormalizingReputations: true };
  runCalendarArms(shielded, 1, RECOVERY_INTERVAL_MINUTES + 1, { arms: DAY_ARMS.own });
  assert.equal(shielded.legalRep[1], -30, 'the prison skip\'s shield holds the week too');
});

test('REP4: away, every week the world\'s calendar crossed pays a bad name its point - a good name is kept (TM-1\'s "Recovery only") (mutant: the absence on DFU\'s 112 days)', () => {
  const e = { legalRep: { 1: -30, 2: 30 } };
  assert.equal(normalizeAcross(e, 1, 5 * RECOVERY_INTERVAL_MINUTES + 1), 5);
  assert.deepEqual(e.legalRep, { 1: -25, 2: 30 });
});

test('REP4: a penance - five points of a region\'s law back toward zero and never past it; 200 gold, then 400, 600; nothing to mend at zero or above (mutants: past zero; the price flat)', () => {
  assert.deepEqual([PENANCE_POINTS, PENANCE_BASE_PRICE], [5, 200]);
  const p = { legalRep: { 7: -12 } };
  assert.equal(penanceHelps(p, 7), true);
  assert.equal(penancePrice(p, 7), 200);
  assert.equal(doPenance(p, 7), 5);
  assert.deepEqual([legalRepOf(p, 7), penancePrice(p, 7)], [-7, 400]);
  doPenance(p, 7);
  assert.equal(doPenance(p, 7), 2, 'the last two points');
  assert.deepEqual([legalRepOf(p, 7), penanceHelps(p, 7), penancePrice(p, 7)], [0, false, 800]);
  assert.equal(doPenance({ legalRep: { 7: 10 } }, 7), 0, 'a good name buys nothing');
});

test('REP4: the temple\'s priest offers the penance to a bad name in the temple\'s own region, and the law says it (mutant: the offer never paid)', () => {
  const p = { legalRep: { 4: -20 }, goldPieces: 1000, items: [], regionConditions: createRegionConditions() };
  const heard = [];
  setLegalRepNotifier((n) => heard.push(n));
  try {
    const win = buildDonationFlow(p, null, 29, { rows: () => [], onClose: () => {}, regionIndex: 4, regionName: 'Wayrest', ownNow: () => 0 });
    const text = () => (win.top?.rows ?? []).map((r) => r.text).join(' ');
    assert.match(text(), /Your name stands ill with the law of Wayrest\. For 200 gold the temple will do penance on your behalf\. Will you pay\?/);
    win.input('KeyY');
    assert.match(text(), /Your penance is accepted \(\+5\)\./);
    assert.deepEqual([legalRepOf(p, 4), p.goldPieces, heard.at(-1)?.cause?.kind], [-15, 800, 'penance']);
  } finally { setLegalRepNotifier(null); }
  assert.doesNotMatch((buildDonationFlow({ legalRep: { 4: 3 }, goldPieces: 0, items: [] }, null, 29, { rows: () => [], onClose: () => {}, regionIndex: 4 }).top?.rows ?? []).map((r) => r.text).join(' '), /penance/,
    'a good name: DFU\'s donation alone');
});

test('REP4: a bounty contract finished pays its board\'s region two points of law, to the band\'s top; the host names the region (mutant: the thanks never paid)', () => {
  assert.equal(CONTRACT_LEGAL_GAIN, 2);
  const p = { legalRep: { 9: -40 } };
  assert.equal(rewardContract(p, 9), 2);
  assert.equal(legalRepOf(p, 9), -38);
  const top = { legalRep: { 9: 99 } };
  assert.equal(rewardContract(top, 9), 1, 'never past 100');
  assert.match(src('src/scenes/bountyHost.js'), /const region = deps\.regionAt\?\.\(posting\.town\.px, posting\.town\.py\);\n\s*if \(Number\.isInteger\(region\) && region >= 0 && entity\) rewardContract\(entity, region\);/);
  assert.match(src('src/scenes/world.js'), /regionAt: \(px, py\) => maps\.getRegionIndexAt\(px, py\),/);
});
