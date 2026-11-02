// REP2 (2026-09-29, the reputation overhaul) - A SENTENCE PAYS THE DEBT. Mac's call for what serving time or paying the
// fine gives back: "The charge, with a mark" ("Lesser crimes come back in full; Murder and Assault leave half as a lasting
// mark"). And from the same signed shape: "Surrender is always honoured, unless you killed a watchman during that chase."
//
// DFU's RaiseReputationForDoingSentence gave back half the loss less one (Conspiracy 0, Vagrancy one point MORE lost) -
// "Serving time doesnt fix rep. Tried 8 times" (FIELD BUGS 2026-09-29g, ! OG). It refused an involuntary surrender below
// -20 and on a coin flip from -20 to 0, and let the blow kill. Its surrender box re-armed with every fresh wave, and each
// wave's first hit charged the crime again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CRIMES, REPUTATION_LOSS_PER_CRIME, sentenceRefund, raiseRepForSentence, lowerRepForCrime, surrenderToCityGuards,
  startCourt, MARKED_CRIMES, legalRepOf,
} from '../../src/systems/court.js';
import { createArrestFlow } from '../../src/scenes/arrestFlow.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('REP2: the refund - every lesser crime\'s charge comes back whole (legal and the People\'s half); Assault, Murder and the two Treasons keep half; an acquittal gives all of it back (mutants: DFU\'s half-less-one; the mark on every crime; the acquittal marked)', () => {
  assert.deepEqual([...MARKED_CRIMES].sort((a, b) => a - b), [CRIMES.Assault, CRIMES.Murder, CRIMES.High_Treason, CRIMES.Treason]);
  for (const [name, crime] of Object.entries(CRIMES)) {
    if (!crime) continue;
    const loss = REPUTATION_LOSS_PER_CRIME[crime];
    const r = sentenceRefund(crime);
    if (MARKED_CRIMES.has(crime)) assert.deepEqual(r, { legal: Math.ceil(loss / 2), people: Math.ceil(Math.trunc(loss / 2) / 2) }, name);
    else assert.deepEqual(r, { legal: loss, people: Math.trunc(loss / 2) }, name);
    assert.deepEqual(sentenceRefund(crime, { acquitted: true }), { legal: loss, people: Math.trunc(loss / 2) }, `${name}, acquitted`);
  }
  assert.deepEqual([sentenceRefund(CRIMES.Murder), sentenceRefund(CRIMES.Criminal_Conspiracy), sentenceRefund(CRIMES.Vagrancy)],
    [{ legal: 10, people: 5 }, { legal: 2, people: 1 }, { legal: 1, people: 0 }], 'Murder keeps -10; Conspiracy and Vagrancy nothing');
});

test('REP2: the report - eight Conspiracy arrests, each served, leave the name where it started (DFU: -16); a Murder served leaves half its mark (mutant: the sentence credits nothing)', () => {
  const p = { legalRep: { 5: -12 } };
  for (let i = 0; i < 8; i++) {
    lowerRepForCrime(p, 5, CRIMES.Criminal_Conspiracy);
    raiseRepForSentence(p, { crime: CRIMES.Criminal_Conspiracy, regionIndex: 5 });
  }
  assert.equal(legalRepOf(p, 5), -12);
  const m = { legalRep: { 5: 0 } };
  lowerRepForCrime(m, 5, CRIMES.Murder);
  raiseRepForSentence(m, { crime: CRIMES.Murder, regionIndex: 5 });
  assert.equal(legalRepOf(m, 5), -10);
  raiseRepForSentence(m, { crime: CRIMES.Murder, regionIndex: 5 }, { acquitted: true });
  assert.equal(legalRepOf(m, 5), 10, 'an acquittal\'s credit is the whole charge');
});

test('REP2: the surrender - a beaten criminal is taken at any standing, voluntary or not; refused only when a watchman fell to them in the chase; a dead body is never taken (mutants: DFU\'s -20 line; the coin; the watchman ignored)', () => {
  for (const rep of [-100, -21, -20, -5, 0, 40]) {
    const p = { health: 7, legalRep: { 1: rep } };
    assert.equal(surrenderToCityGuards(p, 1, false, { setHealth1: () => { p.health = 1; } }), true, `involuntary at ${rep}`);
    assert.equal(p.health, 1, 'the vitals write still comes first');
    assert.equal(surrenderToCityGuards({ health: 7, legalRep: { 1: rep } }, 1, true), true, `voluntary at ${rep}`);
  }
  assert.equal(surrenderToCityGuards({ health: 7, watchSlain: true }, 1, false), false, 'a watchman slain: the blow lands');
  assert.equal(surrenderToCityGuards({ health: 7, watchSlain: true }, 1, true), true, '...but a voluntary surrender is still taken');
  assert.equal(surrenderToCityGuards({ health: 0 }, 1, true), false);
  assert.match(src('src/scenes/cityGuards.js'), /tallyCrimeGuildRequirements\(playerEntity, false, 1\);\n(?:\s*\/\/[^\n]*\n)*\s*playerEntity\.watchSlain = true;/,
    'the player\'s kill of a watchman sets it');
});

/** The arrest flow over a stub overlay (the boxes' fallback texts; no court art). */
function flowRig(crime = CRIMES.Theft, legal = 0) {
  const shown = [];
  const townTalk = { texts: () => null, showOverlay: (w) => shown.push(w), pushOverlay: (w) => shown.push(w), overlay: null, factionDict: null, locationName: 'Daggerfall' };
  const p = { name: 'P', health: 40, crimeCommitted: crime, legalRep: { 2: legal }, skills: 30, skillUses: [], stats: { personality: 50 }, items: [], goldPieces: 0 };
  const flow = createArrestFlow({ townTalk, playerEntity: p, regionIndex: 2, rolls: () => 0.99, advanceDays: () => {}, advanceMinutes: () => {} });
  return { p, flow, shown };
}

test('REP2: a crime is charged ONCE per chase - a second wave\'s surrender box charges nothing more; a worse crime in the chase is charged as itself; the chase ends with the crime (mutants: every wave charged; the worse crime free)', () => {
  const r = flowRig(CRIMES.Theft);
  const hit = () => r.flow.onGuardHit(5, () => {});
  assert.equal(hit(), true, 'the first wave: the box');
  assert.equal(legalRepOf(r.p, 2), -8);
  r.shown.at(-1).input('KeyN');   // fight on
  r.p.haveShownSurrenderDialogue = false;   // the wave is outrun (cityGuards: no watchman standing)
  hit();
  assert.equal(legalRepOf(r.p, 2), -8, 'the next wave: the same crime, not charged again (DFU: -16)');
  r.shown.at(-1).input('KeyN');
  r.p.haveShownSurrenderDialogue = false;
  r.p.crimeCommitted = CRIMES.Murder;   // a watchman killed in the chase
  hit();
  assert.equal(legalRepOf(r.p, 2), -28, 'the Murder is its own charge');
  dispose(r);
  assert.match(src('src/scenes/cityGuards.js'), /if \(!playerEntity\.crimeCommitted\) \{ playerEntity\.chargedCrime = 0; playerEntity\.watchSlain = false; \}/,
    'the crime cleared by any door clears the chase');
});

test('REP2: a load ends the chase with the trial - the loaded save\'s crime is charged at its own first box (mutant: the charge carried across the load)', () => {
  const r = flowRig(CRIMES.Theft);
  r.flow.onGuardHit(5, () => {});
  assert.equal(legalRepOf(r.p, 2), -8);
  r.p.watchSlain = true;
  r.flow.abandon();   // a load (AUDIT DISC28 AR-1): the loaded character is wanted for a Theft of its own
  r.p.haveShownSurrenderDialogue = false;
  r.p.legalRep = { 2: 0 };
  r.flow.onGuardHit(5, () => {});
  assert.deepEqual([legalRepOf(r.p, 2), r.p.watchSlain], [-8, false], 'charged again, the slain watchman forgotten');
  dispose(r);
});

test('REP2: come quietly at the watch\'s stop - a Conspiracy charged once and the court opened, as a voluntary surrender (mutant: no charge)', () => {
  const r = flowRig(0, -20);
  assert.equal(r.flow.surrenderToChallenge(), true);
  assert.deepEqual([r.p.crimeCommitted, legalRepOf(r.p, 2), r.p.arrested], [CRIMES.Criminal_Conspiracy, -22, true]);
  dispose(r);
});

test('REP2: an acquittal through the court gives the whole charge back - an Assault pleaded and won leaves no mark (mutant: the acquittal credited as a sentence)', () => {
  const shown = [];
  const townTalk = { texts: () => null, showOverlay: (w) => shown.push(w), pushOverlay: (w) => shown.push(w), overlay: null, factionDict: null, locationName: 'Daggerfall' };
  const p = { name: 'P', health: 40, crimeCommitted: CRIMES.Assault, legalRep: { 2: 0 }, skills: 30, skillUses: [], stats: { personality: 50 }, items: [], goldPieces: 0 };
  const flow = createArrestFlow({ townTalk, playerEntity: p, regionIndex: 2, rolls: () => 0, advanceDays: () => {}, advanceMinutes: () => {} });
  flow.onGuardHit(5, () => {});
  shown.at(-1).input('KeyY');      // surrender
  assert.equal(legalRepOf(p, 2), -8);
  shown.at(-1).input('KeyN');      // not guilty
  shown.at(-1).input('KeyD');      // debate - a roll of 0 is under any chance: free
  assert.equal(legalRepOf(p, 2), 0, 'the charge back whole (a sentence would have left -4)');
  flow.dispose();
});

test('REP2: a GOOD name no longer makes a fine dearer - the base at any standing above zero; a bad name\'s price is DFU\'s (mutant: DFU\'s good-side term)', () => {
  const fineAt = (crime, legal) => startCourt({ legalRep: { 1: legal }, goldPieces: 1e9, items: [] }, 1, crime, { rolls: () => 0.99, dfRand: () => 1 }).fine;
  assert.equal(fineAt(CRIMES.Theft, 60), fineAt(CRIMES.Theft, 0));
  assert.equal(fineAt(CRIMES.Assault, 90), fineAt(CRIMES.Assault, 0));
  assert.ok(fineAt(CRIMES.Assault, -40) > fineAt(CRIMES.Assault, 0), 'a bad name still pays more');
});

function dispose(r) { r.flow.dispose(); }
