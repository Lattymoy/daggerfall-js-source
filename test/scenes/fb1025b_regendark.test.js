// FIELD BUGS 2026-10-25b REGEN-DARK ("Regens Health: In Darkness" enchantment never activates). The shared enchant ctx
// (scenes/hostEnchant.js createEnchantCtx) mounted inSunlight and inHolyPlace but no inDarkness, so RegensHealth's
// InDarkness arm read an absent seam and stayed off in every host. These run the real mount over the real
// passiveSpecials host seam: DFU's IsPlayerInDarkness is "Same as !IsPlayerInSunlight" (PlayerEnterExit.cs), the
// flag RegensHealth.cs:97-98 reads. Record: bible/01-Overview/bugs/Field-Bugs-2026-10-25b.md.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { createEnchantCtx } from '../../src/scenes/hostEnchant.js';
import { setPassiveSpecialsHost } from '../../src/systems/passiveSpecials.js';
import { setDefaultEnchantCtx, enchantmentMagicRound, ENCHANTMENT_TYPES as T } from '../../src/systems/enchantments.js';
import { ITEM_GROUPS } from '../../src/characters/equipRules.js';
import { CLASSIC_GAME_START_TIME, dateFromClassicMinutes } from '../../src/systems/gameDate.js';

// Real classic minutes (the V2a epoch lesson), one by day and one by night.
const minuteAtHour = (hour) => {
  let m = CLASSIC_GAME_START_TIME;
  while (dateFromClassicMinutes(m).hour !== hour) m++;
  return m;
};
const NOON = minuteAtHour(12);
const MIDNIGHT = minuteAtHour(0);

const IN_DARKNESS = 2;   // RegensHealth.Params: AllTheTime 0, InSunlight 1, InDarkness 2

const darkRing = () => ({
  name: 'Ring', templateIndex: 135, group: ITEM_GROUPS.Jewellery,
  currentCondition: 100, maxCondition: 100, equipSlot: 9,
  enchantments: [{ type: T.RegensHealth, param: IN_DARKNESS }],
});

const mountCtx = (player) => createEnchantCtx({
  playerEntity: player, spellsByIndex: () => new Map(), now: () => 0, sinks: {}, say() {},
  magic: {}, foes: () => [], foeSinks: () => ({}),
});

let previousHost = null;
const placePlayer = ({ minute, inside = false, prison = false }) => {
  previousHost = setPassiveSpecialsHost({ now: () => minute, isInside: () => inside, inPrison: () => prison });
};

afterEach(() => {
  setPassiveSpecialsHost(previousHost);
  previousHost = null;
  setDefaultEnchantCtx(null);
});

test('REGEN-DARK: the mounted ctx answers darkness as the complement of sunlight', () => {
  const ctx = mountCtx({ isPlayer: true });
  const cases = [
    { where: 'outdoors by night', minute: MIDNIGHT, dark: true },
    { where: 'outdoors by day', minute: NOON, dark: false },
    { where: 'indoors by day', minute: NOON, inside: true, dark: true },
    { where: 'in prison by day', minute: NOON, prison: true, dark: true },
  ];
  for (const { where, dark, ...place } of cases) {
    placePlayer(place);
    assert.equal(ctx.inDarkness(), dark, where);
    assert.equal(ctx.inSunlight(), !dark, `${where}: the sunlight flag is its complement`);
    setPassiveSpecialsHost(previousHost);
  }
});

test('REGEN-DARK: a worn RegensHealth(InDarkness) heals at night and not in the sun, through the mounted ctx', () => {
  const regenOver8Rounds = (place) => {
    const player = { isPlayer: true, name: 'P', health: 20, maxHealth: 30, items: [darkRing()], level: 5, stats: {}, skills: [40, 40, 40, 40] };
    setDefaultEnchantCtx(mountCtx(player));
    placePlayer(place);
    for (let round = 1; round <= 8; round++) enchantmentMagicRound(player, round);
    setPassiveSpecialsHost(previousHost);
    return player.health - 20;
  };
  assert.equal(regenOver8Rounds({ minute: MIDNIGHT }), 2, '+1 at rounds 4 and 8 outdoors by night');
  assert.equal(regenOver8Rounds({ minute: NOON, inside: true }), 2, 'indoors by day counts as darkness');
  assert.equal(regenOver8Rounds({ minute: NOON }), 0, 'outdoors by day the ring rests');
});
