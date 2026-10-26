// FB1024 (2026-10-24, #bug-reports: "the effect checks param === 2 && (ctx?.inDarkness?.() ?? false) ...
// hostEnchant.js defines inSunlight and inHolyPlace in createEnchantCtx(), but apparently never provides
// inDarkness"): Regens Health: In Darkness healed nothing in any host. RegensHealth.cs:97-98 asks
// PlayerEnterExit.IsPlayerInDarkness, which is `!isPlayerInSunlight` (PlayerEnterExit.cs:201). No pin had ever run
// that arm (E1's fed the InSunlight arm a hand-built ctx - AUDIT FB1024 #15); these build the ctx from the producer
// every host mounts (TEST THE SHAPE THE PRODUCER MINTS). Record: bible/01-Overview/bugs/Field-Bugs-2026-10-24.md.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { setPassiveSpecialsHost, playerInSunlight, playerInDarkness } from '../../src/systems/passiveSpecials.js';
import { ENCHANTMENT_TYPES as T, enchantmentMagicRound } from '../../src/systems/enchantments.js';
import { createEnchantCtx } from '../../src/scenes/hostEnchant.js';
import { ITEM_GROUPS } from '../../src/characters/equipRules.js';
import { CLASSIC_GAME_START_TIME, dateFromClassicMinutes } from '../../src/systems/gameDate.js';

const at = (hour) => { let m = CLASSIC_GAME_START_TIME; while (dateFromClassicMinutes(m).hour !== hour) m++; return m; };
const NOON = at(12);
const MIDNIGHT = at(0);

const ring = (param) => ({
  name: 'Ring', templateIndex: 135, group: ITEM_GROUPS.Jewellery, currentCondition: 100, maxCondition: 100,
  equipSlot: 9, enchantments: [{ type: T.RegensHealth, param }],
});
const wearer = (items) => ({ name: 'W', isPlayer: true, health: 20, maxHealth: 30, items, level: 5, stats: {}, skills: [] });
const mountedCtx = (pe) => createEnchantCtx({ playerEntity: pe, spellsByIndex: () => new Map(), now: () => 0, sinks: {}, magic: {} });
const host = (now, inside = false) => setPassiveSpecialsHost({ now: () => now, isInside: () => inside });
const eightRounds = (w, ctx) => { for (let r = 1; r <= 8; r++) enchantmentMagicRound(w, r, { ctx }); return w.health; };

beforeEach(() => setPassiveSpecialsHost(null));

test('FB1024: IsPlayerInDarkness is !IsPlayerInSunlight (PlayerEnterExit.cs:201)', () => {
  for (const [now, inside] of [[NOON, false], [NOON, true], [MIDNIGHT, false], [MIDNIGHT, true]]) {
    host(now, inside);
    assert.equal(playerInDarkness(), !playerInSunlight(), `hour ${dateFromClassicMinutes(now).hour}, inside ${inside}`);
  }
  host(NOON, true);
  assert.equal(playerInDarkness(), true, 'a roof at noon is dark (the career\'s own law is not - passiveSpecials)');
  host(NOON, false);
  assert.equal(playerInDarkness(), false, 'the open street at noon is not');
  // AUDIT FB1024 (lane A N1): no host and no clock - idle, never "midnight"
  setPassiveSpecialsHost(null);
  assert.equal(playerInDarkness(), false, 'headless: the arm idles');
  assert.equal(playerInDarkness(MIDNIGHT), true, 'a clock handed in still answers');
});

test('FB1024: the mounted enchant ctx answers inDarkness, and Regens Health: In Darkness heals through it', () => {
  const w = wearer([ring(2)]);
  const ctx = mountedCtx(w);
  assert.equal(typeof ctx.inDarkness, 'function', 'createEnchantCtx carries the arm RegensHealth asks');
  host(MIDNIGHT);
  assert.equal(eightRounds(w, ctx), 22, 'outdoors at midnight: +1 at rounds 4 and 8');
  const shop = wearer([ring(2)]);
  host(NOON, true);
  assert.equal(eightRounds(shop, mountedCtx(shop)), 22, 'inside at noon: dark too');
  const street = wearer([ring(2)]);
  host(NOON);
  assert.equal(eightRounds(street, mountedCtx(street)), 20, 'the noon street: nothing');
});

test('FB1024: In Sunlight stays its mirror through the same ctx', () => {
  const w = wearer([ring(1)]);
  host(NOON);
  assert.equal(eightRounds(w, mountedCtx(w)), 22);
  const n = wearer([ring(1)]);
  host(MIDNIGHT);
  assert.equal(eightRounds(n, mountedCtx(n)), 20);
});
