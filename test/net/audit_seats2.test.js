// AUDIT SEATS-2 (2026-10-02, Mac: "Can we do a deep comprehensive audit on everything"): THE SEATS ARC AUDITED AGAIN,
// after SEAT2b part two, SEAT-HALL and CROWN-HALL - five lanes (the service, the relay, the shared law against the spec,
// the client, the design's coverage), every finding verified, fixed and pinned here. `06-Systems/Online-Arc.md` AUDIT
// SEATS-2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { titheStanding, standingWeek, seatTitheCap, seatHoldingLines, TITHE_CAP, EDICT_WORDS, STANDING_CHANGES } from '../../src/net/townSeatLaw.js';
import { fortWorkLine, fortMayRaise, APOTHECARY_OPEN, marketHallTitheCap } from '../../src/net/fortLaw.js';
import { TIDE_WORDS } from '../../src/net/tideLaw.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('AUDIT SEATS-2 L1: THE MARKET HALL\'S TITHE CAP (7.5: "the Tithe\'s cap +1%" a tier) is the cap the Seat tab offers, its words say and Standing is judged on (7.3: "at or below half its cap ... above three quarters of its cap") - the service\'s titheCapAt, everywhere (mutants: the cap unpassed; the tab\'s base cap; the words\' base cap)', () => {
  assert.equal(marketHallTitheCap(TITHE_CAP.palace, 3), 13);
  assert.equal(titheStanding('palace', 6), 0, 'the base cap: 6 is over half of 10');
  assert.equal(titheStanding('palace', 6, 13), STANDING_CHANGES.titheLow, 'a tier-3 Market Hall: 6 is under half of 13');
  assert.equal(titheStanding('palace', 8, 12), 0, '8 is under three quarters of 12');
  assert.equal(titheStanding('palace', 8), STANDING_CHANGES.titheHigh);
  const base = { tier: 'palace', standing: 50, tithe: 6, watched: true };
  assert.notEqual(standingWeek({ ...base, titheCap: 13 }).standing, standingWeek(base).standing, 'the Turning\'s week reads the seat\'s cap');
  const seat = { tier: 'palace', forts: { market: 2 } };
  assert.equal(seatTitheCap(seat), 12);
  assert.equal(seatTitheCap({ tier: 'crown' }), TITHE_CAP.crown);
  assert.match(seatHoldingLines({ ...seat, name: 'Anticlere' }, { upkeep: 2500, standing: 50 }).join(' '), /the Tithe at most 12%/);
  assert.match(src('src/ui/seatTab.js'), /const cap = seatTitheCap\(seat\);/);
  assert.match(src('server-account/src/seatTurning.js'), /titheCap: marketHallTitheCap\(TITHE_CAP\[h\.tier\] \?\? 0, f\.market \?\? 0\)/);
  assert.match(src('src/net/townSeatLaw.js'), /tier: s\.tier, titheCap: s\.holder\.titheCap \?\? null,/);
});

test('AUDIT SEATS-2 L3, L4, L5, L7: a crown\'s Gatehouse stands from the first and says so; the Bounty\'s camps are the town\'s bailiwick\'s, said so; the Apothecary raised by no one until its stations stand (PROF12: they stand - raised now); the Incursion\'s Drakes said (mutants: the crown\'s line; the Apothecary\'s gate)', () => {
  assert.equal(fortWorkLine('gatehouse', { tier: 0 }, { seatTier: 'crown' }), 'Gatehouse: standing - its vitality 20,000.');
  assert.equal(fortWorkLine('gatehouse', { tier: 0 }, { seatTier: 'palace' }), 'Gatehouse: none raised.');
  assert.match(src('src/ui/seatWorks.js'), /fortWorkLine\(w\.id, row, \{ nameOf, seatTier: seat\.tier,/);
  assert.match(EDICT_WORDS.bounty, /^Camps near the town yield double/);
  // PIN MOVED (PROF12, Mac: "2 and 4"): the Apothecary's three stand - Cooking's fire, Jewelcrafting's bench, Alchemy's
  // station - and it is raised (Professions-Arc 37; Seats-Arc 7.5)
  assert.equal(APOTHECARY_OPEN, true);
  assert.equal(fortMayRaise('apothecary', { tier: 'palace' }), true);
  assert.equal(fortMayRaise('forge', { tier: 'palace' }), true);
  assert.equal(TIDE_WORDS.daedra, 'Gate kills give double influence and double silver.');
});

test('AUDIT SEATS-2 L6 (Appendix B: "windows 5, edicts 5" an account an hour): the window keeps its own five, apart from the Edict\'s and the Tithe\'s (mutant: the window on the levers\' bucket)', () => {
  const b = src('server-account/src/seatBattles.js');
  assert.match(b, /if \(seatPhaseOf\(nowS \* 1000\) !== 'muster'\) return \{ error: 'window-reckoning' \};\n  if \(await overRate\(\{ db, nowS \}, `seat-window:\$\{player\.id\}`, SEAT_EDICTS_HOUR, 3600\)\)/);
});
