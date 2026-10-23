// FIELD BUGS 2026-10-21d SENTENCE-MENDS, PATROL-GRACE and CURFEW-REFUND (the Discord's #bug-reports, "Retaining
// criminal status even after going to prison and serving sentence": "Guards will still chase you down and kill you, even
// if you have already been to prison for the crime committed"; today, iamamitten: "this is STILL happening online ... I
// did that one 'help me go to (place) without the guards getting me' job and now I'm a criminal, apparently for life ...
// Does serving time NOT count as 'doing penance'?"). The job is A0C00Y17 (The Escort): refusing the watch its warrant is
// `legal repute -20` (`_S.17_: when _no_ and _S.01_`), and the watch knows a face under -10. A sentence gave back only
// the charge it tried (REP2) - so a name under the line before the arrest walked out as known as it went in, the stop's
// own "come quietly" a closed loop, the road's patrols drawing at once outside the gate, and a Curfew town keeping two
// points of every sentence. The record: bible/01-Overview/bugs/Field-Bugs-2026-10-21d.md.
//
// The real watch's stop (createStandingWatch), the real arrest flow (the court, the guilty plea, the prison screen served
// day by day, ReleaseFromPrison), on the character's own clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createArrestFlow } from '../../src/scenes/arrestFlow.js';
import { createStandingWatch, STANDING_LOOK_MS, legalNoticeLine } from '../../src/scenes/standingHost.js';
import { legalRepOf, changeLegalRep, setCrimeRepFactor, setLegalRepNotifier, CRIMES, sentenceRefund, startCourt, REPUTATION_LOSS_PER_CRIME } from '../../src/systems/court.js';
import { knownCriminal, challengeDue, patrolHalts, sentenceMends, banish, KNOWN_CRIMINAL_BELOW, PENANCE_POINTS, CHALLENGE_GRACE_MINUTES, CHALLENGE_COOLDOWN_MINUTES } from '../../src/systems/standing.js';
import { ownMinutes, trustedWorldMinutes, setWorldMinutes, MINUTES_PER_DAY } from '../../src/systems/worldTick.js';
import { createRegionConditions } from '../../src/systems/region/regionConditions.js';
import { setSeed, rand } from '../../src/formats/dfRandom.js';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DAGGERFALL = 17;

/** A prisoner, a court and a watch over one town's overlay stack (showOverlay replaces the top, pushOverlay stacks). */
function rig({ rep = -20, rolls = () => 0.99 } = {}) {
  setWorldMinutes(600000);
  const p = { name: 'Amitten', health: 60, maxHealth: 60, legalRep: {}, items: [], goldPieces: 0, skills: 30, skillUses: [], stats: { personality: 50 }, regionConditions: createRegionConditions() };
  if (rep) changeLegalRep(p, DAGGERFALL, rep);   // A0C00Y17's `legal repute -20` (world.js's quest hook: no cause)
  const stack = [];
  const townTalk = {
    texts: () => null, factionDict: null, locationName: 'Daggerfall', say() {},
    get overlay() { return stack.at(-1)?.w ?? null; },
    showOverlay(w, onClosed = null) { const top = stack.pop(); if (top && top.w !== w) top.w.dispose?.(); stack.push({ w, onClosed }); },
    pushOverlay(w, onClosed = null) { stack.push({ w, onClosed }); },
    get overlayActive() { return stack.length > 0; },
  };
  const drain = () => { for (let k = 0; k < 50 && stack.length && stack.at(-1).w.done; k++) stack.pop().onClosed?.(); };
  const flow = createArrestFlow({ townTalk, playerEntity: p, regionIndex: () => DAGGERFALL, rolls, worldNow: () => trustedWorldMinutes() });
  let ms = 0;
  const watch = createStandingWatch({
    playerEntity: p, townTalk, arrestFlow: flow, cityGuards: { guardSeesPlayer: () => ({ guard: true }) },
    guardPool: () => [], playerFeet: () => [0, 0, 0], regionIndex: () => DAGGERFALL, regionName: () => 'Daggerfall',
    ownNow: () => ownMinutes(), worldNow: () => trustedWorldMinutes(), crimeResponse: () => {}, onStreet: () => true,
    blocked: () => stack.length > 0, clock: () => ms,
  });
  const clocks = () => ({ ownNow: ownMinutes(), worldNow: trustedWorldMinutes() });
  /** Stopped by the watch, "S - come quietly", "G - guilty", the sentence served day by day, released. */
  const comeQuietly = ({ between = () => {} } = {}) => {
    ms += STANDING_LOOK_MS;
    if (!watch.frame()) return null;
    stack.at(-1).w.input('KeyS'); drain();
    const charged = legalRepOf(p, DAGGERFALL);
    between();   // after the charge, before the court's plea
    stack.at(-1).w.input('KeyG'); drain();
    const prison = stack.at(-1)?.w;
    let days = 0, sentenced = null;
    if (prison?.daysInPrisonLeft != null) {
      sentenced = legalRepOf(p, DAGGERFALL);   // AUDIT FB1021d SM-1: under the prison screen, no day served yet
      days = prison.daysInPrison; for (let k = 0; k < 500 && !prison.done; k++) prison.tick(1); drain();
    }
    while (stack.length) { stack.at(-1).w.done = true; drain(); }
    return { charged, days, sentenced, after: legalRepOf(p, DAGGERFALL) };
  };
  /** A crime the watch caught (`crimeCommitted`), its court: "G - guilty", the sentence served, released. */
  const tried = (crime) => {
    p.crimeCommitted = crime;
    flow.startCourtFlow(); drain();
    stack.at(-1).w.input('KeyG'); drain();
    const prison = stack.at(-1)?.w;
    if (prison?.daysInPrisonLeft != null) { for (let k = 0; k < 500 && !prison.done; k++) prison.tick(1); drain(); }
    while (stack.length) { stack.at(-1).w.done = true; drain(); }
    return legalRepOf(p, DAGGERFALL);
  };
  return { p, comeQuietly, tried, clocks, wait: (m) => setWorldMinutes(ownMinutes() + m) };
}

test('SENTENCE-MENDS: the report - the escort\'s -20, stopped, "come quietly", a sentence served: released a penance\'s step better (-15) and said so, once its days are served (AUDIT FB1021d SM-1); the next stop\'s sentence clears the name (-10) - no stop due, no patrol, after the grace (mutants: the prison\'s mend dropped, the mend past the line, the mend at the sentence)', () => {
  const notices = [];
  setLegalRepNotifier(({ after, delta, cause }) => notices.push(legalNoticeLine({ name: 'Daggerfall', after, delta, cause })));
  try {
    const r = rig();
    assert.equal(knownCriminal(r.p, DAGGERFALL, r.clocks()), true, 'the escort\'s -20: a face the watch knows');
    const one = r.comeQuietly();
    assert.ok(one && one.days > 0, `a sentence with days: ${JSON.stringify(one)}`);
    assert.deepEqual([one.charged, one.after], [-22, -20 + PENANCE_POINTS], 'the Conspiracy charged and given back, and the name mended a step');
    assert.equal(one.sentenced, -20, 'AUDIT FB1021d SM-1: under the prison screen the charge is given back (DFU\'s state 3) and nothing mended - a save there keeps no mend no day paid for');
    assert.ok(notices.some((n) => /^Time served mends your name in Daggerfall \(\+5\)\./.test(n)), notices.join(' | '));
    assert.equal(patrolHalts(r.p, DAGGERFALL, r.clocks()), false, 'PATROL-GRACE: no knight draws on the courthouse steps');
    r.wait(CHALLENGE_GRACE_MINUTES + CHALLENGE_COOLDOWN_MINUTES);
    assert.equal(patrolHalts(r.p, DAGGERFALL, r.clocks()), true, 'still known at -15, past the grace');
    const two = r.comeQuietly();
    assert.equal(two?.after, KNOWN_CRIMINAL_BELOW, 'the second sentence clears the name to the line, never past it');
    r.wait(CHALLENGE_GRACE_MINUTES + CHALLENGE_COOLDOWN_MINUTES);
    assert.equal(knownCriminal(r.p, DAGGERFALL, r.clocks()), false);
    assert.equal(challengeDue(r.p, DAGGERFALL, r.clocks()), false, 'no stop');
    assert.equal(patrolHalts(r.p, DAGGERFALL, r.clocks()), false, 'no patrol');
  } finally { setLegalRepNotifier(null); }
});

test('SENTENCE-MENDS: what it is not - a Murder served from a clean name keeps its mark at the line (the mend only lifts a name under it, and never past it); a name above the line is not raised; it answers the name the prisoner came in with, never the crime\'s own mark (AUDIT FB1021d SM-3), and once a grace (SM-4); the law is one with the fine\'s (FINE-MENDS\' step) (mutants: the mark worn, the grace unread)', () => {
  const p = { legalRep: {} };
  changeLegalRep(p, DAGGERFALL, -REPUTATION_LOSS_PER_CRIME[CRIMES.Murder]);
  const refund = sentenceRefund(CRIMES.Murder);
  changeLegalRep(p, DAGGERFALL, refund.legal);
  assert.equal(legalRepOf(p, DAGGERFALL), -Math.floor(REPUTATION_LOSS_PER_CRIME[CRIMES.Murder] / 2), 'REP2\'s mark');
  assert.equal(sentenceMends(p, DAGGERFALL), 0, 'the mark stands at the line');
  const near = { legalRep: { [DAGGERFALL]: -12 } };
  assert.deepEqual([sentenceMends(near, DAGGERFALL), legalRepOf(near, DAGGERFALL)], [2, KNOWN_CRIMINAL_BELOW], 'two points under the line: two back, to the line');
  const q = { legalRep: { [DAGGERFALL]: -3 } };
  assert.equal(sentenceMends(q, DAGGERFALL), 0, 'above the line, nothing to mend');
  // AUDIT FB1021d SM-3: the name the prisoner CAME IN WITH (`from`, the standing before the charge) - never the crime's
  // own mark, which is the court's due (REP2, DFU's)
  const treason = { legalRep: { [DAGGERFALL]: -18 } };
  assert.equal(sentenceMends(treason, DAGGERFALL, { from: 0 }), 0, 'a Treason from a clean name keeps its -18');
  const murder = { legalRep: { [DAGGERFALL]: -15 } };
  assert.equal(sentenceMends(murder, DAGGERFALL, { from: -5 }), 0, 'a Murder from -5 keeps its mark (-15): -5 was over the line');
  const escort = { legalRep: { [DAGGERFALL]: -30 } };
  assert.equal(sentenceMends(escort, DAGGERFALL, { from: -12 }), 2, 'from -12: two of the name came in under the line, two back');
  assert.equal(sentenceMends({ legalRep: { [DAGGERFALL]: -20 } }, DAGGERFALL, { from: -20 }), PENANCE_POINTS, 'the escort\'s -20: the step');
  // SM-4: once a grace - an answer inside the day's grace the last one gave mends nothing more
  const graced = { legalRep: { [DAGGERFALL]: -20 }, standing: { challengeAt: {}, graceUntil: { [DAGGERFALL]: 5000 }, penance: {}, pardons: {}, warned: {} } };
  assert.equal(sentenceMends(graced, DAGGERFALL, { from: -20, ownNow: 4999 }), 0, 'inside the grace: nothing');
  assert.equal(sentenceMends(graced, DAGGERFALL, { from: -20, ownNow: 5000 }), PENANCE_POINTS, 'the grace run out: the step');
  // the zero-day arm's read is the live one: the prison arm reads the clock once a day at least is served (advanceDays),
  // and the grace standing then was granted before the arrest - so it refuses nothing there (its mutant is recorded equivalent)
  assert.ok(CHALLENGE_GRACE_MINUTES <= MINUTES_PER_DAY, 'a grace outlasts no sentence - lengthened, the prison arm\'s read is live: SENTENCE-MENDS-ownNow-unhanded is no longer equivalent');
  const s = readFileSync(join(ROOT, 'src/systems/standing.js'), 'utf8');
  assert.match(s, /export function settleChallenge\(player, regionIndex\) \{ return mendToLine\(player, regionIndex, 'fine'\); \}/, 'the fine and the sentence share one law');
});

test('SENTENCE-MENDS (AUDIT FB1021d SM-3): through the court, a Murder tried from -5 keeps REP2\'s mark (-15) - the name the prisoner came in with stood over the line, and the crime\'s own mark is the court\'s due; from the escort\'s -20, the step (mutants: the name it came in with unkept, the mark worn)', () => {
  const marked = rig({ rep: -5 });
  assert.equal(marked.tried(CRIMES.Murder), -5 - REPUTATION_LOSS_PER_CRIME[CRIMES.Murder] + sentenceRefund(CRIMES.Murder).legal, 'charged, half given back, no mend');
  const named = rig({ rep: -20 });
  assert.equal(named.tried(CRIMES.Murder), -20 - REPUTATION_LOSS_PER_CRIME[CRIMES.Murder] + sentenceRefund(CRIMES.Murder).legal + PENANCE_POINTS, 'the escort\'s name under it: the step');
});

test('SENTENCE-MENDS: the court\'s fine paid with no days mends as the sentence does; an acquittal gives back the charge and mends nothing (mutants: the zero-day mend dropped)', () => {
  // the zero-day arm: every unit of the penalty in coin - DFU's coin per unit (DFRandom: odd a fine, even three days),
  // the first seed whose coins all land odd
  const units = startCourt({ legalRep: { [DAGGERFALL]: -22 }, goldPieces: 1e6 }, DAGGERFALL, CRIMES.Criminal_Conspiracy, { rolls: () => 0.99, dfRand: () => 1 }).fine / 40;
  let seed = 1;
  for (; seed < 1e7; seed++) { setSeed(seed); let odd = 0; while (odd < units && (rand() & 1) !== 0) odd++; if (odd === units) break; }
  const fined = rig({ rep: -20 });
  fined.p.goldPieces = 100000;
  setSeed(seed);
  const r = fined.comeQuietly();
  assert.equal(r?.days, 0, `a court that fined and set no days (seed ${seed}, ${units} coins)`);
  assert.equal(r.after, -20 + PENANCE_POINTS, `fined in court, no days: ${JSON.stringify(r)}`);
  // an acquittal (a Not Guilty plea that wins) - DFU's free arm: the whole charge back, nothing past it
  const p = { legalRep: { [DAGGERFALL]: -22 } };
  const back = sentenceRefund(CRIMES.Criminal_Conspiracy, { acquitted: true });
  changeLegalRep(p, DAGGERFALL, back.legal);
  assert.equal(legalRepOf(p, DAGGERFALL), -20);
  const a = readFileSync(join(ROOT, 'src/scenes/arrestFlow.js'), 'utf8');
  const free = a.slice(a.indexOf("if (r.outcome === 'free') {"), a.indexOf('function finish(result, court) {'));
  assert.ok(free.length > 0 && !free.includes('sentenceMends('), 'the free arm mends nothing');
  const tail = a.slice(a.indexOf('    // AUDIT 39 F98: both of those arms DO refill'));
  assert.match(tail, /sentenceMends\(playerEntity, court\.regionIndex, \{ from: court\.from, ownNow: ownMinutes\(\) \}\);[^\n]*\n\s+fillVitalSigns\(playerEntity\);\n\s+release\(\);/, 'the zero-day arm mends, then refills and releases (F98)');
  // AUDIT FB1021d SM-5: a banishment repairs nothing (DFU's state 4) - its arm mends nothing
  const banished = a.slice(a.indexOf("if (result.outcome === 'banished') {"), a.indexOf("if (result.outcome === 'executed') {"));
  assert.ok(banished.length > 0 && !banished.includes('sentenceMends('), 'the banishment arm mends nothing');
});

test('CURFEW-REFUND: a Curfew town\'s Conspiracy, charged double, comes back double - the sentence nets the mend, not -2 a time; the People\'s half was never doubled (mutants: the factor unkept, unread)', () => {
  setCrimeRepFactor(() => 2);
  try {
    const r = rig();
    const one = r.comeQuietly({ between: () => setCrimeRepFactor(null) });   // AUDIT FB1021d SM-5: the edict lifted between the charge and the court
    assert.equal(one.charged, -24, 'charged double');
    assert.equal(one.after, -20 + PENANCE_POINTS, 'given back as charged - the court reads the charge\'s factor, not the town\'s now - and mended');
  } finally { setCrimeRepFactor(null); }
  assert.equal(sentenceRefund(CRIMES.Criminal_Conspiracy, { acquitted: true, factor: 2 }).legal, 2 * REPUTATION_LOSS_PER_CRIME[CRIMES.Criminal_Conspiracy], 'an acquittal gives back the doubled charge whole');
  assert.deepEqual(sentenceRefund(CRIMES.Criminal_Conspiracy, { factor: 2 }), { legal: 2 * REPUTATION_LOSS_PER_CRIME[CRIMES.Criminal_Conspiracy], people: Math.trunc(REPUTATION_LOSS_PER_CRIME[CRIMES.Criminal_Conspiracy] / 2) });
  assert.equal(sentenceRefund(CRIMES.Murder, { factor: 2 }).legal, REPUTATION_LOSS_PER_CRIME[CRIMES.Murder], 'a marked crime keeps half of what was charged');
});

test('PATROL-GRACE: the road\'s patrol asks the grace an answered law gives - world.js\'s LW9 `wanted` reads patrolHalts (mutants: the patrol blind to the grace, the host back on knownCriminal)', () => {
  const p = { legalRep: { [DAGGERFALL]: -20 }, standing: null };
  const now = { ownNow: 1000, worldNow: 1000 };
  assert.equal(patrolHalts(p, DAGGERFALL, now), true, 'a known criminal, no grace');
  p.standing = { challengeAt: {}, graceUntil: { [DAGGERFALL]: 1000 + CHALLENGE_GRACE_MINUTES }, penance: {}, pardons: {}, warned: {} };
  assert.equal(patrolHalts(p, DAGGERFALL, now), false, 'inside the grace');
  assert.equal(patrolHalts(p, DAGGERFALL, { ownNow: 1000 + CHALLENGE_GRACE_MINUTES, worldNow: 0 }), true, 'the grace run out');
  assert.equal(patrolHalts({ legalRep: { [DAGGERFALL]: -5 } }, DAGGERFALL, now), false, 'no criminal');
  // AUDIT FB1021d SM-5: a banished player, whatever the name, is met
  const exile = { legalRep: { [DAGGERFALL]: 10 }, regionConditions: createRegionConditions() };
  assert.equal(banish(exile, DAGGERFALL, 1000), true);
  assert.equal(patrolHalts(exile, DAGGERFALL, now), true, 'banished: the patrol halts them');
  const w = readFileSync(join(ROOT, 'src/scenes/world.js'), 'utf8');
  assert.match(w, /wanted: \(res, trip\) => \(res\.job === 'patrol' && trip\?\.from\?\.region != null && patrolHalts\(playerEntity, trip\.from\.region,/);
});
