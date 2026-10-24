// REP3 (2026-09-29, the reputation overhaul) - BANISHMENT, TIMED OR PARDONED. Mac's call: "Timed or pardoned" - "Only
// for Murder and worse. Lifts after about 30 game days (~2.5 real days), or pay for a pardon at the region's palace." The
// pardon is bought at the region's TEMPLE: the watch never enters one, so a banished criminal can reach it (a palace is
// the watch's own ground).
//
// DFU's court rolled banishment for EVERY crime below zero standing (1% at -1, 12% at a first Theft's -8, 28% at a first
// Murder's -20) and nothing ever cleared the bit: a 10% watch roll in that region for the rest of the game.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startCourt, CRIMES, BANISHABLE_CRIMES } from '../../src/systems/court.js';
import {
  banish, isBanished, liftBanishment, banishmentLeft, pardonPrice, grantPardon, BANISHMENT_MINUTES, PARDON_BASE_PRICE,
  challengeDue,
} from '../../src/systems/standing.js';
import { createRegionConditions, snapshotRegionConditions, restoreRegionConditions } from '../../src/systems/region/regionConditions.js';
import { buildDonationFlow } from '../../src/ui/guildServiceWindows.js';
import { SEVERE_PUNISHMENT_BANISHED } from '../../src/systems/encounters.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const citizen = (legal = 0, gold = 1e6) => ({ legalRep: { 4: legal }, goldPieces: gold, items: [], regionConditions: createRegionConditions() });

test('REP3: the court banishes for a Murder or a Treason alone - a lesser crime at -100 is fined or jailed and draws no roll; a Murder at -20 still may be banished (mutants: every crime banishable; the rolls drawn for all)', () => {
  assert.deepEqual([...BANISHABLE_CRIMES].sort((a, b) => a - b), [CRIMES.Murder, CRIMES.High_Treason, CRIMES.Treason]);
  for (const [name, crime] of Object.entries(CRIMES)) {
    if (!crime || BANISHABLE_CRIMES.has(crime)) continue;
    let drawn = 0;
    const c = startCourt(citizen(-100), 4, crime, { rolls: () => { drawn++; return 0; }, dfRand: () => 0 });
    assert.deepEqual([c.punishmentType, drawn], [2, 0], `${name}: fined or jailed, no roll`);
  }
  let dice = 0;
  assert.equal(startCourt(citizen(-20), 4, CRIMES.Murder, { rolls: () => { dice++; return 0; }, dfRand: () => 0 }).punishmentType, 0, 'a Murder: DFU\'s roll stands');
  assert.equal(dice, 1, 'and C#\'s && short-circuit: the second die only when the first fails (AUDIT 21 F5)');
  assert.equal(startCourt(citizen(-20), 4, CRIMES.Murder, { rolls: () => 0.99, dfRand: () => 0 }).punishmentType, 2);
  assert.equal(startCourt(citizen(0), 4, CRIMES.Treason, { rolls: () => 0, dfRand: () => 0 }).punishmentType, 2, 'at zero standing no court banishes (DFU\'s thresholds)');
});

test('REP3: a banishment\'s term is thirty days of the world\'s calendar - read lifted past it, its days left counted; a pre-REP banishment gets its thirty from the first read (mutants: for ever; the term never stamped)', () => {
  const p = citizen();
  banish(p, 4, 1000);
  const r = p.regionConditions[4];
  assert.equal(r.severePunishmentFlags & SEVERE_PUNISHMENT_BANISHED, SEVERE_PUNISHMENT_BANISHED, 'DFU\'s own bit, kept');
  assert.equal(r.banishedUntil, 1000 + BANISHMENT_MINUTES);
  assert.equal(BANISHMENT_MINUTES, 30 * 1440);
  assert.equal(isBanished(p, 4, 1000 + BANISHMENT_MINUTES - 1), true);
  assert.equal(banishmentLeft(p, 4, 1000 + BANISHMENT_MINUTES - 1440), 1440);
  assert.equal(isBanished(p, 4, 1000 + BANISHMENT_MINUTES), false, 'the term run out');
  assert.deepEqual([r.severePunishmentFlags & 1, r.banishedUntil], [0, null], 'and lifted');
  const old = citizen();
  old.regionConditions[4].severePunishmentFlags = SEVERE_PUNISHMENT_BANISHED;   // banished before REP: no term
  assert.equal(isBanished(old, 4, 50), true);
  assert.equal(old.regionConditions[4].banishedUntil, 50 + BANISHMENT_MINUTES, 'given its thirty days');
  liftBanishment(old, 4);
  assert.equal(isBanished(old, 4, 60), false);
  // AUDIT REP F2: PIN MOVED - on the world's TRUSTED clock (worldTick.js trustedWorldMinutes; test/systems/auditrep.test.js)
  assert.match(src('src/scenes/arrestFlow.js'), /banish\(playerEntity, region\(\), trustedWorldMinutes\(\)\);/, 'the court\'s banishment stamps the term, on the world\'s clock');
});

test('REP3: the term rides the save - a banishment standing carries `b`, none does not; a pre-REP save restores none (mutant: the term dropped on save)', () => {
  const store = createRegionConditions();
  store[4].severePunishmentFlags = 1;
  store[4].banishedUntil = 777;
  const snap = snapshotRegionConditions(store);
  assert.equal(snap[4].b, 777);
  assert.equal('b' in snap[5], false);
  assert.equal(restoreRegionConditions(snap)[4].banishedUntil, 777);
  delete snap[4].b;
  assert.equal(restoreRegionConditions(snap)[4].banishedUntil, null);
});

/** The temple's donation priest, over a region. */
function temple(p, { gold } = {}) {
  if (gold != null) p.goldPieces = gold;
  return buildDonationFlow(p, null, 29, {
    rows: () => [], onClose: () => {}, regionIndex: 4, regionName: 'Wayrest', ownNow: () => 9000, worldNow: () => 9000,
  });
}
const text = (win) => (win.top?.rows ?? []).map((r) => r.text).join(' ');

test('REP3: a pardon bought at the temple - offered only to the banished, priced 2,500 then a step more each; paid, the banishment is lifted and the watch gives its day of grace (mutants: the pardon never lifts; the price never rises)', () => {
  const p = citizen(0, 10000);
  assert.doesNotMatch(text(temple(p)), /banished/, 'not banished: DFU\'s donation alone');
  banish(p, 4, 9000 - 1440 * 3);
  const win = temple(p);
  assert.match(text(win), /You are banished from Wayrest for 27 more days\. For 2500 gold the temple will plead for your pardon\. Will you pay\?/);
  win.input('KeyY');
  assert.match(text(win), /You are pardoned\. You may walk the streets of Wayrest again\./);
  assert.deepEqual([p.goldPieces, isBanished(p, 4, 9001)], [10000 - PARDON_BASE_PRICE, false]);
  assert.equal(challengeDue({ ...p, legalRep: { 4: -50 } }, 4, { ownNow: 9001 }), false, 'the grace a pardon gives');
  assert.equal(pardonPrice(p, 4), 2 * PARDON_BASE_PRICE, 'the second pardon here costs twice');
  grantPardon(p, 4, 0);
  assert.equal(pardonPrice(p, 4), 3 * PARDON_BASE_PRICE);
});

// AUDIT REP F4: PIN MOVED - a short purse no longer goes on to DFU's donation field (auditrep.test.js F4: it is offered
// what is left, a cheaper penance, and a Yes ends the asking); a No still goes on to it
test('REP3: a purse short of the pardon is told so; a No goes on to the donation (mutant: the short purse pardoned)', () => {
  const p = citizen(0, 100);
  banish(p, 4, 9000);
  const win = temple(p);
  win.input('KeyY');
  assert.match(text(win), /You do not have enough gold\./);
  assert.equal(isBanished(p, 4, 9001), true);
  const q = citizen(0, 100000);
  banish(q, 4, 9000);
  const w2 = temple(q);
  w2.input('KeyN');
  assert.equal(isBanished(q, 4, 9001), true, 'a No buys nothing');
  assert.ok(w2.top?.field, 'on to DFU\'s donation field');
});
