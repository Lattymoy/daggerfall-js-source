// FIELD BUGS 2026-10-14 FINE-MENDS (Dweme... on the Discord: "I was stopped by the guards and paid a fine of 560 gold.
// After that, I was stopped again and had to pay the same 560 gold, even though I hadn't committed any new crimes. Now
// it's happening for the third time"; Mac: "Fine raises standing"). REP1's fine bought a day's grace and nothing else: the
// standing that stopped the player was the standing that stopped them again, for the same sum. A fine paid on the spot
// mends the name a temple penance's step, never past the watch's line. Through the real watch (REP1's rig) and the
// real legal-notice line. bible/01-Overview/bugs/Field-Bugs-2026-10-14.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settleChallenge, banish, knownCriminal, PENANCE_POINTS, KNOWN_CRIMINAL_BELOW, CHALLENGE_GRACE_MINUTES } from '../../src/systems/standing.js';
import { createStandingWatch, STANDING_LOOK_MS, installLegalNotices } from '../../src/scenes/standingHost.js';
import { createRegionConditions } from '../../src/systems/region/regionConditions.js';

const player = (legal, gold = 5000) => ({ legalRep: { 3: legal }, goldPieces: gold, items: [], health: 50, regionConditions: createRegionConditions() });
function watchRig(legal) {
  const p = player(legal);
  const t = { ms: 0, own: 5000, world: 5000 };
  const shown = [], said = [];
  const watch = createStandingWatch({
    playerEntity: p,
    townTalk: { showOverlay: (w) => shown.push(w), say: (l) => said.push(l) },
    arrestFlow: { inCourt: () => false, surrenderToChallenge: () => true },
    cityGuards: { guardSeesPlayer: () => ({ guard: true }) },
    guardPool: () => [], playerFeet: () => [0, 0, 0], regionIndex: () => 3, regionName: () => 'Daggerfall',
    ownNow: () => t.own, worldNow: () => t.world, crimeResponse: () => {}, onStreet: () => true, blocked: () => false, clock: () => t.ms,
  });
  const look = () => { t.ms += STANDING_LOOK_MS; return watch.frame(); };
  return { p, t, shown, said, look };
}

test('FINE-MENDS: the reporter\'s 560 at -15 - paid, the name mends five and is at the line: the grace run out, the watch stops them no more; the HUD says the standing rose (mutants: the fine mends nothing; past the line)', () => {
  const r = watchRig(-15);
  const off = installLegalNotices({ playerEntity: r.p, say: (l) => r.said.push(l), regionName: () => 'Daggerfall' });
  try {
    assert.equal(r.look(), true);
    assert.equal(r.shown[0].lines[1], 'Pay a fine of 560 gold, or come with me.');
    r.shown[0].input('KeyP');
    assert.equal(r.p.goldPieces, 5000 - 560);
    assert.equal(r.p.legalRep[3], KNOWN_CRIMINAL_BELOW, 'five points, to the line');
    assert.match(r.said.join('\n'), /Your standing with the law of Daggerfall rises \(\+5\)\./);
    r.t.own += CHALLENGE_GRACE_MINUTES + 1;
    assert.equal(r.look(), false, 'no known face: no third stop');
  } finally { off(); }
});

test('FINE-MENDS: the step is a penance\'s, never past the line - -40 mends to -35 and is stopped again, for less; -12 mends two; at the line or above nothing; a banished face mends its number and is still known while the term stands', () => {
  const r = watchRig(-40);
  r.look();
  r.shown[0].input('KeyP');
  assert.equal(r.p.legalRep[3], -40 + PENANCE_POINTS);
  r.t.own += CHALLENGE_GRACE_MINUTES + 1;
  assert.equal(r.look(), true, 'still under the line: the next stop');
  assert.equal(r.shown[1].lines[1], 'Pay a fine of 640 gold, or come with me.', 'its standing\'s price, less than the first (680 at -40)');
  const near = player(-12);
  assert.equal(settleChallenge(near, 3), 2);
  assert.equal(near.legalRep[3], -10);
  for (const v of [-10, 0, 20]) { const q = player(v); assert.equal(settleChallenge(q, 3), 0); assert.equal(q.legalRep[3], v); }
  const b = player(-30);
  banish(b, 3, 0);
  assert.equal(settleChallenge(b, 3), PENANCE_POINTS);
  assert.equal(knownCriminal(b, 3, { ownNow: 10, worldNow: 10 }), true, 'banished, the face is known whatever the number');
});
