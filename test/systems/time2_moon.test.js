// TIME2 (2026-10-01, Mac: "werewolf forms last insanely long" / "I don't want a band aid, I want a detailed way we can
// do this" / "This needs to be perfect"): ONLINE THE FULL MOON IS A NIGHT. Design: bible/06-Systems/Online-Time-Arc.md
// section 6.1. DFU forces a lycanthrope's change for the whole calendar day either moon is full, and online that day was
// two real hours no rest could shorten (the moon is the sky's, which no rest moves). Online the change is forced while
// the full moon is UP - from the dusk of a full-moon date to the next dawn, thirty real minutes on TIME1's sky - and at
// dawn the lock ends. Offline DFU's whole day stands. THE LAW EXECUTES: the night's date, the full moon up, the round
// online and offline, the round runner's lane, the morning after, and the Hircine ring.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MINUTES_PER_DAY, DAWN_HOUR, DUSK_HOUR, CLASSIC_GAME_START_TIME,
  isFullMoonFromMinutes, nightDateMinutes, isFullMoonNightFromMinutes,
} from '../../src/systems/gameDate.js';
import { createLycanthropyCurse, lycanthropyMagicRound, liveLycanthropy, morphSelf, isWearingHircineRing, HIRCINE_RING_SUBTYPE, YOU_DREAM_OF_THE_MOON } from '../../src/systems/lycanthropy.js';
import { EQUIP_SLOTS, equipTableOf } from '../../src/systems/equip.js';
import { ENCHANTMENT_TYPES } from '../../src/systems/enchantments.js';
import { LYCANTHROPY_TYPES } from '../../src/systems/infection.js';
import { runMagicRoundsFor } from '../../src/systems/worldTick.js';
import { setSpellRecordsByIndex } from '../../src/systems/loot/loot.js';
import { SKY_SEGMENTS, skyClassicMinutes } from '../../src/net/skyLaw.js';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const D = MINUTES_PER_DAY;
/** The first full-moon date on or after the classic start whose day before is no full moon - the night before it
 *  belongs to that quiet date. */
const FULL = (() => {
  const from = Math.floor(CLASSIC_GAME_START_TIME / D) + 1;
  for (let d = from; d < from + 400; d++) if (isFullMoonFromMinutes(d * D + 720) && !isFullMoonFromMinutes((d - 1) * D + 720)) return d * D;   // the full-moon date's first minute
  throw new Error('no full moon after a quiet date in 400 days of the classic start');
})();
const P = () => ({
  isPlayer: true, level: 5, activeEffects: [],
  stats: { strength: 50, agility: 50, endurance: 50, speed: 50, willpower: 50, intelligence: 50, personality: 50, luck: 50 },
  skills: {}, health: 60, maxHealth: 60, items: [], spells: [],
});
const wolf = () => { const p = P(); createLycanthropyCurse(p, LYCANTHROPY_TYPES.Werewolf, { now: 0 }); return p; };

beforeEach(() => setSpellRecordsByIndex(null));

test('TIME2 the night\'s date: a night is named by the date of its dusk - 18:00 of a date to 06:00 of the next; by day there is none', () => {
  const d = 500 * D;
  assert.equal(nightDateMinutes(d + DUSK_HOUR * 60), d, 'dusk opens the date\'s night');
  assert.equal(nightDateMinutes(d + 23 * 60 + 59), d);
  assert.equal(nightDateMinutes(d + D), d, 'midnight is still the night that began at the dusk before it');
  assert.equal(nightDateMinutes(d + D + DAWN_HOUR * 60 - 1), d, 'until the minute before dawn');
  assert.equal(nightDateMinutes(d + D + DAWN_HOUR * 60), null, 'dawn: day');
  assert.equal(nightDateMinutes(d + DUSK_HOUR * 60 - 1), null, 'the minute before dusk: day');
  assert.equal(nightDateMinutes(d + 3 * 60), d - D, 'the small hours belong to the night before');
  assert.equal(nightDateMinutes(d + 3 * 60 + 0.9), d - D, 'a fraction of a minute is its minute');
});

test('TIME2 a full moon UP: the night begun at a full-moon date\'s dusk, and no other hour of it', () => {
  assert.equal(isFullMoonFromMinutes(FULL + 720), true, 'the fixture is a full-moon date');
  assert.equal(isFullMoonNightFromMinutes(FULL + DUSK_HOUR * 60), true, 'its dusk');
  assert.equal(isFullMoonNightFromMinutes(FULL + D + 3 * 60), true, 'the small hours after it - the next date, the same night');
  assert.equal(isFullMoonNightFromMinutes(FULL + D + DAWN_HOUR * 60), false, 'its dawn ends it');
  assert.equal(isFullMoonNightFromMinutes(FULL + 720), false, 'noon of the full-moon date: the moon is not up');
  assert.equal(isFullMoonNightFromMinutes(FULL + 3 * 60), false, 'the small hours OF the full-moon date belong to the night before it, which is no full moon');
  // each night is twelve hours of the sky: thirty real minutes at TimeScale 24
  let up = 0;
  for (let m = FULL; m < FULL + 2 * D; m++) if (isFullMoonNightFromMinutes(m)) up++;
  assert.equal(up, 12 * 60, 'one night of twelve hours across the two dates it spans');
  assert.ok(Math.abs(12 * 60 / SKY_SEGMENTS[0].minutesPerMs / 60_000 - 30) < 1e-9, 'thirty real minutes on the sky');
});

test('TIME2 the round, online: the moon forces the change at its dusk and through its night, never at its noon - and offline DFU\'s whole day', () => {
  const said = [];
  const noon = wolf();
  lycanthropyMagicRound(noon, { nowMinutes: 1, clockMinutes: 900_000, skyMinutes: FULL + 720, moonNight: true, say: (s) => said.push(s) });
  assert.equal(liveLycanthropy(noon).isTransformed, false, 'online the full-moon date\'s noon forces nothing');
  assert.deepEqual(said, []);
  const dusk = wolf();
  lycanthropyMagicRound(dusk, { nowMinutes: 1, clockMinutes: 900_000, skyMinutes: FULL + DUSK_HOUR * 60, moonNight: true, say: (s) => said.push(s) });
  assert.equal(liveLycanthropy(dusk).isTransformed, true, 'the dusk of the full moon forces it');
  assert.deepEqual(said, [YOU_DREAM_OF_THE_MOON], 'with DFU\'s own line');
  const small = wolf();
  lycanthropyMagicRound(small, { nowMinutes: 1, clockMinutes: 900_000, skyMinutes: FULL + D + 4 * 60, moonNight: true });
  assert.equal(liveLycanthropy(small).isTransformed, true, 'and the small hours after it');
  const offline = wolf();
  lycanthropyMagicRound(offline, { nowMinutes: 1, clockMinutes: FULL + 720, skyMinutes: FULL + 720 });
  assert.equal(liveLycanthropy(offline).isTransformed, true, 'offline (no moonNight) DFU\'s whole full-moon day forces it, noon too');
});

test('TIME2 the round runner raises the night\'s rule exactly when a host hands the sky - the online lane - and leaves DFU\'s for every other caller', () => {
  const sinks = {};
  const online = wolf();
  runMagicRoundsFor(online, FULL + 720 - 3, FULL + 720, { sinks, skyMinutes: FULL + 720 });
  assert.equal(liveLycanthropy(online).isTransformed, false, 'a sky handed (online) at the full-moon noon: no change');
  const onlineNight = wolf();
  runMagicRoundsFor(onlineNight, FULL - 3, FULL, { sinks, skyMinutes: FULL + DUSK_HOUR * 60 + 10 });
  assert.equal(liveLycanthropy(onlineNight).isTransformed, true, 'a sky handed in the full moon\'s night: changed, whatever the character\'s own minute');
  const offline = wolf();
  runMagicRoundsFor(offline, FULL + 720 - 3, FULL + 720, { sinks });
  assert.equal(liveLycanthropy(offline).isTransformed, true, 'no sky handed (offline, the one clock): DFU\'s day');
  assert.match(rd('src/systems/worldTick.js'), /lycanthropyMagicRound\(entity, \{ nowMinutes: r \+ 1, clockMinutes, skyMinutes: sky, moonNight: Number\.isFinite\(skyMinutes\), say \}\);/, 'by source: the lane is the sky handed');
});

test('TIME2 the morning after: at dawn the lock ends - the change back holds, and the next round forces nothing until the next full moon\'s dusk', () => {
  const p = wolf();
  lycanthropyMagicRound(p, { nowMinutes: 1, clockMinutes: 900_000, skyMinutes: FULL + DUSK_HOUR * 60, moonNight: true });
  assert.equal(liveLycanthropy(p).isTransformed, true);
  // the night: changing back is ungated, but the next round puts the beast back
  morphSelf(p, { nowMinutes: 900_010 });
  assert.equal(liveLycanthropy(p).isTransformed, false);
  lycanthropyMagicRound(p, { nowMinutes: 2, clockMinutes: 900_011, skyMinutes: FULL + D + 2 * 60, moonNight: true });
  assert.equal(liveLycanthropy(p).isTransformed, true, 'while the moon is up it takes them again');
  // the dawn: changing back holds
  morphSelf(p, { nowMinutes: 900_020 });
  assert.equal(isFullMoonFromMinutes(FULL + D + 720), false, 'the fixture: the date after the full moon is none');
  for (let k = 0; k < 30; k++) lycanthropyMagicRound(p, { nowMinutes: 3 + k, clockMinutes: 900_021 + k, skyMinutes: FULL + D + DAWN_HOUR * 60 + k * 30, moonNight: true });
  assert.equal(liveLycanthropy(p).isTransformed, false, 'from dawn through the day and into the next dusk (no full moon), a round every half hour and no change - the lock has ended');
});

test('TIME2 the Hircine ring still holds the change off, the night of the full moon too', () => {
  const bare = wolf();
  lycanthropyMagicRound(bare, { nowMinutes: 1, clockMinutes: 900_000, skyMinutes: FULL + DUSK_HOUR * 60, moonNight: true });
  assert.equal(liveLycanthropy(bare).isTransformed, true, 'without the ring the night takes them');
  // the ring: an artifact carrying SpecialArtifactEffect param 3 in a ring slot (IsWearingHircineRing, :585-597)
  const ringed = wolf();
  equipTableOf(ringed)[EQUIP_SLOTS.Ring1] = {
    name: 'Ring of Hircine',
    enchantments: [{ type: ENCHANTMENT_TYPES.SpecialArtifactEffect, param: HIRCINE_RING_SUBTYPE }],
  };
  assert.equal(isWearingHircineRing(ringed), true);
  for (const sky of [FULL + DUSK_HOUR * 60, FULL + D + 3 * 60]) {
    lycanthropyMagicRound(ringed, { nowMinutes: 1, clockMinutes: 900_000, skyMinutes: sky, moonNight: true });
    assert.equal(liveLycanthropy(ringed).isTransformed, false, `Hircine masters the moon's night (sky minute ${sky})`);
  }
});

test('TIME2 on the sky: a full moon\'s night is thirty real minutes, and a werewolf meets the two moons\' nights four real hours apart, then none for twenty-eight', () => {
  const from = SKY_SEGMENTS[0].fromMs + 3_600_000;
  const nights = [];
  let inNight = false, start = 0;
  for (let t = from; t < from + 80 * 3_600_000; t += 15_000) {
    const up = isFullMoonNightFromMinutes(skyClassicMinutes(t));
    if (up && !inNight) { inNight = true; start = t; }
    if (!up && inNight) { inNight = false; nights.push({ start, len: t - start }); }
  }
  assert.ok(nights.length >= 4, `${nights.length} full-moon nights in eighty real hours`);
  for (const n of nights) assert.ok(Math.abs(n.len - 30 * 60_000) <= 15_000, `a night of thirty real minutes (${n.len / 60_000})`);
  const gaps = nights.slice(1).map((n, i) => (n.start - nights[i].start) / 3_600_000);
  assert.ok(gaps.every((g) => Math.abs(g - 4) < 0.01 || Math.abs(g - 28) < 0.01), `the gaps: ${gaps.join(', ')} real hours`);
  // AUDIT TIME (second round): both gaps, alternating - a moon a night every four hours would pass the line above
  const short = gaps.map((g) => Math.abs(g - 4) < 0.01);
  assert.ok(short.includes(true) && short.includes(false) && short.every((s, i) => i === 0 || s !== short[i - 1]), `the gaps alternate: ${gaps.join(', ')} real hours`);
});
