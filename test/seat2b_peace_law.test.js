// SEAT2b part two (2026-10-01, Mac: "Finish the seats"; "Let's pick up 482"): THE WORKS AT PEACE, THEIR LAW - a
// Siegewright's project a day sooner; what the Watchtowers see and say; whether a town is coastal and a Harbour a port
// for its holder's members; the Shrine's Standing row; the Ram Kit as the Stores hold it (bible/11-Multiplayer/
// Seats-Arc.md 7.5; Professions-Arc 3.3, 4.8; net/fortLaw.js, net/townSeatLaw.js, net/professionLaw.js,
// systems/travelPorts.js). `06-Systems/Online-Arc.md` SEAT2b part two.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fortStandsAt, SIEGEWRIGHT_DAYS, FORT_TIER_DAYS, towersSee, towersText, watchtowerShare, coastalAt, harbourPortFor, RAM_KIT_KEY,
  shrineStanding,
} from '../src/net/fortLaw.js';
import { standingWeek, seatStandingLine, guildWords } from '../src/net/townSeatLaw.js';
import {
  RAM_KIT, materialOf, withdrawable, NO_PACK_FORM, MATERIAL_FAMILIES, isSiegewright, specOk, SPECIALISATIONS,
} from '../src/net/professionLaw.js';
import { recipeById, recipeOpen, takesQuality } from '../src/net/recipeLaw.js';
import { material } from '../src/net/nodeLaw.js';
import { marketCatalogue } from '../src/net/marketLaw.js';
import { hasPort, hasPortFor, setSeatHarbours } from '../src/systems/travelPorts.js';

const DAY = 86400;

test('SEAT2b part two THE SIEGEWRIGHT\'S DAY: a project begun by a Siegewright stands a day sooner at every tier - 1, 3 and 6 days; anyone else\'s 2, 4 and 7; Carpentry\'s choice at 100 is chosen now (mutants: the day; its tiers; the choice)', () => {
  assert.equal(SIEGEWRIGHT_DAYS, 1, 'Professions-Arc 3.3: "siege works a day sooner"');
  assert.deepEqual([1, 2, 3].map((t) => fortStandsAt(1000, t)), FORT_TIER_DAYS.map((d) => 1000 + d * DAY));
  assert.deepEqual([1, 2, 3].map((t) => fortStandsAt(1000, t, { siegewright: true })), [1000 + DAY, 1000 + 3 * DAY, 1000 + 6 * DAY]);
  assert.equal(fortStandsAt(1000, 1, { siegewright: false }), 1000 + 2 * DAY);
  assert.equal(fortStandsAt(1000, 4, { siegewright: true }), null, 'no fourth tier');
  assert.equal(fortStandsAt(NaN, 1, { siegewright: true }), null);
  assert.deepEqual([isSiegewright({ 100: 'siegewright' }), isSiegewright({ 100: 'master-joiner' }), isSiegewright({ 50: 'siegewright' }), isSiegewright(null)], [true, false, false, false]);
  assert.equal(specOk('carpentry', 100, 'siegewright'), true);
  // PIN MOVED (CRAFT3, Professions-Arc 41): Carpentry is a discipline of Building - the Siegewright Building's choice at 100
  assert.equal(SPECIALISATIONS.carpentry, undefined, 'no track of its own');
  assert.equal(SPECIALISATIONS.building[100].find((s) => s.id === 'siegewright')?.later, undefined);
  assert.equal(specOk('building', 100, 'siegewright'), true);
});

test('SEAT2b part two WHAT THE WATCHTOWERS SEE: every challenger at or past half the holder\'s defence (tier 1) or a quarter (tier 2), the most dangerous first; never the holder, never without towers or a defence; the word names the seat, the guild and the share (mutants: the share; at the line; the holder; the order; the words)', () => {
  const standings = [
    { guild: 'gh', influence: 9000 }, { guild: 'ga', influence: 500 }, { guild: 'gb', influence: 499 }, { guild: 'gc', influence: 900 },
    { guild: 'gd', influence: 250 }, { guild: 'ge', influence: 900 },
  ];
  assert.deepEqual(watchtowerShare(1), 0.5);
  assert.deepEqual(towersSee(standings, { holder: 'gh', defence: 1000, t: 1 }), [
    { guild: 'gc', influence: 900, share: 0.5 }, { guild: 'ge', influence: 900, share: 0.5 }, { guild: 'ga', influence: 500, share: 0.5 },
  ], 'half of 1,000: 500 has passed it, 499 has not; level, by the guild\'s id');
  assert.deepEqual(towersSee(standings, { holder: 'gh', defence: 1000, t: 2 }).map((w) => [w.guild, w.share]),
    [['gc', 0.25], ['ge', 0.25], ['ga', 0.25], ['gb', 0.25], ['gd', 0.25]], 'a quarter: 250 and up');
  assert.deepEqual(towersSee(standings, { holder: 'gh', defence: 1000, t: 0 }), [], 'no towers');
  assert.deepEqual(towersSee(standings, { holder: 'gh', defence: 0, t: 2 }), [], 'no defence: nothing to pass');
  assert.deepEqual(towersSee(standings, { holder: 'gh', defence: null, t: 2 }), []);
  assert.deepEqual(towersSee(null, { holder: 'gh', defence: 10, t: 1 }), []);
  assert.equal(towersSee(standings, { holder: 'gc', defence: 1000, t: 1 }).some((w) => w.guild === 'gc'), false, 'the holder is never its own danger');
  assert.equal(towersText('Anticlere', guildWords({ name: 'The Iron Circle', tag: 'IC' }), 0.5), 'The Watchtowers of Anticlere see the Iron Circle <IC> past half of our defence.');
  assert.equal(towersText('Anticlere', guildWords({ name: 'Ebon Oath', tag: 'EO' }), 0.25), 'The Watchtowers of Anticlere see Ebon Oath <EO> past a quarter of our defence.');
});

test('SEAT2b part two A COAST AND A HARBOUR: a town is coastal where its own pixel or one of the eight about it is sea, or a harbour stands there already; a Harbour at tier 1 is a port for its holder\'s members alone - Travel Options\' list kept, the host\'s word added and a bad word none (mutants: the eight; the port; the holder; the tier; the seam)', () => {
  const sea = new Set(['11,10']);
  const isWater = (x, y) => sea.has(`${x},${y}`);
  assert.equal(coastalAt(10, 10, isWater), true, 'the sea east of it');
  assert.equal(coastalAt(12, 11, isWater), true, 'the sea north-west of it');
  assert.equal(coastalAt(11, 10, isWater), true, 'its own pixel');
  assert.equal(coastalAt(13, 10, isWater), false, 'two pixels from the sea');
  assert.equal(coastalAt(13, 10, isWater, true), true, 'a harbour drawn there');
  assert.equal(coastalAt(NaN, 10, isWater), false);
  assert.equal(coastalAt(10, 10, null), false);
  const seat = { key: 3021, holder: { guild: { id: 'gsh' } }, forts: { harbour: 1 } };
  assert.equal(harbourPortFor(seat, 'gsh'), true);
  assert.equal(harbourPortFor(seat, 'geo'), false, 'another guild\'s');
  assert.equal(harbourPortFor(seat, null), false, 'no guild');
  assert.equal(harbourPortFor({ ...seat, forts: { harbour: 0 } }, 'gsh'), false, 'no Harbour standing');
  assert.equal(harbourPortFor({ ...seat, forts: null }, 'gsh'), false);
  assert.equal(harbourPortFor({ ...seat, holder: null }, 'gsh'), false, 'unheld');
  assert.equal(harbourPortFor(null, 'gsh'), false);
  try {
    assert.equal(hasPortFor(199102), true, 'Travel Options\' own (Daggerfall\'s Whitecroft)');
    assert.equal(hasPortFor(3021), false, 'no word yet');
    setSeatHarbours((id) => harbourPortFor(id === 3021 ? seat : null, 'gsh'));
    assert.equal(hasPortFor(3021), true, 'the host\'s word: a members\' Harbour');
    assert.equal(hasPort(3021), false, 'the mod\'s list untouched');
    assert.equal(hasPortFor(3022), false);
    assert.equal(hasPortFor(null), false);
    setSeatHarbours(() => { throw new Error('torn'); });
    assert.equal(hasPortFor(3021), false, 'a word that throws is none');
    setSeatHarbours(() => 'yes');
    assert.equal(hasPortFor(3021), false, 'only true');
    setSeatHarbours(null);
    assert.equal(hasPortFor(3021), false, 'cleared');
    assert.equal(hasPortFor(199102), true);
  } finally { setSeatHarbours(null); }
});

test('SEAT2b part two THE SHRINE\'S STANDING: a Shrine\'s tier is its Standing row each week - +1, +2 - beside the rest, within 100; the standings line names its part of the holder\'s week (mutants: the row; the bound; the words)', () => {
  assert.deepEqual([shrineStanding(0), shrineStanding(1), shrineStanding(2)], [0, 1, 2]);
  const base = standingWeek({ tier: 'palace', standing: 50 });
  const w = standingWeek({ tier: 'palace', standing: 50, shrine: shrineStanding(2) });
  assert.deepEqual(w.changes, [...base.changes, ['shrine', 2]]);
  assert.equal(w.standing, base.standing + 2);
  assert.equal(standingWeek({ tier: 'palace', standing: 99, shrine: 2 }).standing, 100, 'within 100');
  assert.deepEqual(standingWeek({ tier: 'palace', standing: 50, shrine: -3 }).changes, base.changes, 'never a loss');
  assert.deepEqual(standingWeek({ tier: 'palace', standing: 50, shrine: 'x' }).changes, base.changes);
  assert.equal(seatStandingLine({ guild: { name: 'The Silver Hand', tag: 'SH' }, influence: 8393, shrine: 100 }, 0), '1. the Silver Hand <SH> - 8,393 influence (its Shrine\'s 100)');
  assert.equal(seatStandingLine({ guild: { name: 'The Silver Hand', tag: 'SH' }, influence: 8393 }, 0), '1. the Silver Hand <SH> - 8,393 influence');
});

test('SEAT2b part two THE RAM KIT IN THE STORES: a siege work, template 690, tier 5, worth its inputs at their values (108); never to the pack; on the market as a Stores material; made at Carpentry 60 at no quality (mutants: the worth; the pack; the family)', () => {
  const r = recipeById('ramkit:oak');
  assert.deepEqual(materialOf(RAM_KIT_KEY), { key: 'work:ram', family: 'siege', tier: 5, value: 108, templateIndex: 690 });
  assert.equal(RAM_KIT.key, RAM_KIT_KEY);
  assert.equal(material(RAM_KIT_KEY).value, r.inputs.reduce((a, i) => a + i.n * material(i.key).value, 0), 'the inputs\' worth: a writ\'s pay and a delivery\'s influence keep the materials\'');
  assert.ok(MATERIAL_FAMILIES.some(([f, w]) => f === 'siege' && w === 'Siege Works'));
  assert.deepEqual([...NO_PACK_FORM], [RAM_KIT_KEY, 'essence:arcane']);   // AUDIT PROF12 E1 (PIN MOVED): and Arcane Essence
  assert.equal(withdrawable(RAM_KIT_KEY), false, 'its road is the writ\'s');
  assert.ok(marketCatalogue().some((m) => m.key === RAM_KIT_KEY && m.family === 'siege'), 'a Stores material lists - a sale makes it bought');
  assert.deepEqual([r.kind, r.rank, recipeOpen(r, 60), recipeOpen(r, 59), takesQuality(r)], ['siege', 60, true, false, false]);
});
