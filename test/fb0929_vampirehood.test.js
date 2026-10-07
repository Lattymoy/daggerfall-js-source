// VAMP-HOOD (2026-09-29, Discord #suggestions "PLEASE allow vampires...", Starempire42: "adds the ability to travel
// during the day if you a wearing a cloak or robe with a hood up"; Sir McMobdon: "nice, good idea"; sent in by Mac): THE PORT'S DEPARTURE from
// VampirismEffect.CheckFastTravel (:195-208) and DaggerfallTravelPopUp's arrival clamp (:350-357). Every rule the
// curse's SunDamage flag still keys asks vampirism.js racialSunAverse - the flag, UNLESS the wearer's hood is up, which
// is survival/temperature.js cloakState: the one hood law, the felt temperature's own. Online this is the whole
// complaint: the shared clock runs at 12x, so a day is one real hour the map door refuses, and neither a rest nor a
// trip moves that clock (WORLD5, RESTX2) - the vampire could only wait. The fixtures are the producers': the curse is
// createVampirismCurse's, the cloak ItemBuilder.CreateRandomClothing's (loot.js), the robes Create Item's, worn through
// EquipItem, and the hood raised by the paper doll's own click (useItem.js nextVariant).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createVampirismCurse, racialFastTravelBlock, racialSunAverse, vampirismMagicRound,
  SUNLIGHT_TRAVEL_TEXT, VAMPIRE_HOOD_TEXT, VAMPIRE_STATS, VAMPIRE_STAT_MOD,
} from '../src/systems/vampirism.js';
import { VAMPIRE_CLANS } from '../src/systems/infection.js';
import { createRandomClothing, ITEM_GROUPS } from '../src/systems/loot.js';
import { createTempItem, CREATE_ITEM_ROWS } from '../src/systems/createItem.js';
import { equipItem } from '../src/systems/equip.js';
import { nextVariant, toggleHood } from '../src/systems/useItem.js';
import { EQUIP_SLOTS } from '../src/characters/paperdoll.js';
import { arrivalClampMinutes } from '../src/systems/travel.js';
import { MINUTES_PER_DAY, isDayFromMinutes } from '../src/systems/gameDate.js';
import { setSharedClock, sharedClockOn, worldMinutes } from '../src/systems/worldTick.js';
import { sharedClassicMinutes, wallMsForClassicMinutes } from '../src/net/wire.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const DAY = 400;   // a classic day number, far from the start
const at = (hour, minute = 0) => DAY * MINUTES_PER_DAY + hour * 60 + minute;
const mortal = ({ gender = 'male' } = {}) => ({
  isPlayer: true, name: 'Valentin', race: 'Breton', gender, level: 10,
  stats: { strength: 60, intelligence: 50, willpower: 50, agility: 60, endurance: 60, personality: 50, speed: 60, luck: 50 },
  activeEffects: [], spells: [], items: [], health: 100, maxHealth: 100,
});
const vampire = (opts) => {
  const p = mortal(opts);
  createVampirismCurse(p, VAMPIRE_CLANS.Lyrezi, { now: at(19) });
  return p;
};
/** ItemBuilder.CreateRandomClothing's casual cloak (MensClothing.Casual_cloak 154, WomensClothing's 191): the first
 *  roll draws the template, the second the dye, the third the variant - 0, drawn hood DOWN. */
function casualCloak(gender = 'male') {
  const list = ITEM_GROUPS[gender === 'female' ? 'WomensClothing' : 'MensClothing'];
  const draws = [(list.indexOf(gender === 'female' ? 191 : 154) + 0.5) / list.length, 0, 0];
  return createRandomClothing(gender, () => draws.shift());
}
/** CreateItem's Robes row: CreateMensClothing/CreateWomensClothing(Plain_robes) - variant 0 at a zero roll. */
const ROBES_ROW = CREATE_ITEM_ROWS.findIndex((r) => r.kind === 'robes');

test('VAMP-HOOD: a cloak worn hood down keeps the day\'s refusal and says how to lift it; the doll\'s click raises the hood and the door opens by day as by night', () => {
  const v = vampire();
  const cloak = casualCloak();
  assert.deepEqual([cloak.templateIndex, cloak.variant], [154, 0], 'the producer\'s casual cloak, drawn hood down');
  equipItem(v, cloak);
  assert.ok([EQUIP_SLOTS.Cloak1, EQUIP_SLOTS.Cloak2].includes(cloak.equipSlot) && v.equip.slots[cloak.equipSlot] === cloak,
    'worn, on a cloak slot');
  assert.deepEqual(racialFastTravelBlock(v, at(12)), { text: SUNLIGHT_TRAVEL_TEXT, hint: VAMPIRE_HOOD_TEXT },
    'hood down at noon: DFU\'s refusal, and the way out after it');
  // HOOD-SAID (FIELD BUGS 2026-09-30, PIN MOVED): the line names the button that raises the hood - the pack card's
  // Raise hood (this suite runs on the enhanced skin; test/fb0930_hoodsaid.test.js holds the classic's line)
  assert.equal(VAMPIRE_HOOD_TEXT, 'Raise the hood of a cloak or robe to travel by day - Raise hood, on its card in the pack.');
  // NextVariant cycles the casual cloak's six drawings (the template's `variants`), and the door follows the hood
  // through every one: variants 1, 2 and 5 are drawn hood up (the felt temperature's own reading of them)
  const open = [];
  for (let i = 0; i < 6; i++) { open.push(racialFastTravelBlock(v, at(12)) === null); nextVariant(cloak); }
  assert.deepEqual(open, [false, true, true, false, false, true]);
  assert.equal(cloak.variant, 0, 'six clicks come round to the first drawing');
  assert.equal(racialFastTravelBlock(v, at(22)), null, 'the night was always open');
  nextVariant(cloak);
  assert.equal(racialFastTravelBlock(v, at(6)), null, 'hood up at dawn');
  assert.equal(racialFastTravelBlock(v, at(17, 59)), null, 'and at the day\'s last minute');
});

test('VAMP-HOOD: plain robes with the hood up are a hood too, on either body - and a hood in the pack is none', () => {
  for (const gender of ['male', 'female']) {
    const v = vampire({ gender });
    const robes = createTempItem(ROBES_ROW, { gender, rolls: () => 0 });
    assert.deepEqual([robes.templateIndex, robes.variant], [gender === 'female' ? 200 : 163, 0], `${gender}: plain robes, hood down`);
    equipItem(v, robes);
    assert.equal(v.equip.slots[EQUIP_SLOTS.ChestClothes], robes);
    assert.equal(racialFastTravelBlock(v, at(9))?.text, SUNLIGHT_TRAVEL_TEXT, `${gender}: robes hood down - refused`);
    nextVariant(robes);   // the doll's click: the robes' second drawing, the hood up
    assert.equal(robes.variant, 1);
    assert.equal(racialFastTravelBlock(v, at(9)), null, `${gender}: robes hood up - the door opens`);
  }
  const v = vampire();
  const carried = casualCloak();
  nextVariant(carried);   // hood up, and never put on
  v.items.push(carried);
  assert.equal(racialFastTravelBlock(v, at(12))?.text, SUNLIGHT_TRAVEL_TEXT, 'a hood in the pack keeps no sun off');
  assert.equal(racialSunAverse(mortal()), false, 'no curse, no sun to keep off');
});

test('VAMP-HOOD: the arrival clamp\'s racial arm asks the same hood - a hooded vampire landing at noon lands at noon', () => {
  const v = vampire();
  const cloak = casualCloak();
  equipItem(v, cloak);
  assert.equal(racialSunAverse(v), true, 'bare-headed: the sun reaches the curse');
  assert.equal(arrivalClampMinutes(at(12), { sunAverse: racialSunAverse(v) }), 6 * 60, 'pushed to DuskHour, as DFU pushes it');
  nextVariant(cloak);
  assert.equal(racialSunAverse(v), false, 'hooded: it does not');
  assert.equal(arrivalClampMinutes(at(12), { sunAverse: racialSunAverse(v) }), 0, 'no push');
  // world.js is the one caller: the racial arm through the law, the career's Damage from Sunlight beside it untouched
  assert.match(read('src/scenes/world.js'), /sunAverse: racialSunAverse\(playerEntity\) \|\| careerSunAverse\(playerEntity\),/,
    'HasVampirism() || Career.DamageFromSunlight (DaggerfallTravelPopUp.cs:351), both arms hooded');   // PIN MOVED (HOOD-CAREER): the career's arm asks the hood too
});

test('VAMP-HOOD online: the door reads the shared clock, whose day is one real hour - bare-headed the vampire waits it out, hooded it travels', () => {
  // WORLD5's clock (net/wire.js): TimeScale 12, so the day's twelve hours are ONE real hour, and no rest or trip moves it
  assert.equal(wallMsForClassicMinutes(at(18)) - wallMsForClassicMinutes(at(6)), 60 * 60 * 1000, 'the online day is an hour');
  const noonMs = wallMsForClassicMinutes(at(12));
  setSharedClock(() => sharedClassicMinutes(noonMs));
  try {
    assert.equal(sharedClockOn(), true);
    const nowMin = Math.floor(worldMinutes());   // the door's own read (world.js toggleTravelMap, partyTravelRefusal)
    assert.equal(isDayFromMinutes(nowMin), true, 'the shared noon is day');
    const v = vampire();
    const cloak = casualCloak();
    equipItem(v, cloak);
    assert.equal(racialFastTravelBlock(v, nowMin)?.text, SUNLIGHT_TRAVEL_TEXT, 'bare-headed at the shared noon: refused');
    nextVariant(cloak);
    assert.equal(racialFastTravelBlock(v, nowMin), null, 'hooded at the shared noon: the map opens');
  } finally { setSharedClock(null); }
  // the map door says DFU's line and then the way out; the party's refusal reads the same law off the same clock
  // (MERGE with LIVED1: DFU's line rides sayWithNightfall - online the world's nightfall on its own HUD row, AUDIT LIVED1
  // M - and the hood's way out after both; the party's refusal adds the nightfall to the door's own words)
  const world = read('src/scenes/world.js');
  assert.match(world, /const ftb = racialFastTravelBlock\(playerEntity, nowMin\);\n\s*if \(ftb\) \{ sayWithNightfall\(ftb\.text\); if \(ftb\.hint\) townTalk\.say\(ftb\.hint\); return false; \}/,   // GUIDE2: the door answers the journal's Show on map
    'the map door speaks the hint after the refusal');
  assert.match(world, /const sun = \(careerFastTravelBlock\(playerEntity, nowMin\) \?\? racialFastTravelBlock\(playerEntity, nowMin\)\)\?\.text \?\? null;[^\n]*\n\s*return sun \? withNightfall\(sun\) : null;/, 'the party\'s refusal');   // PIN MOVED (HOOD-CAREER): the career's rung first, both hooded
});

test('HOOD-SUN (2026-10-07, Mac: "The vampire cloak and hood doesn\'t work ingame for shielding against the sun"): the hood shields the stats too - bare-headed in the street\'s sun at noon the seven stats are 20 down (VAMP-DAY), the hood raised they are DFU\'s +20, lowered 20 down again; a hood in the pack shields nothing (mutants: the stats ask no hood; the hood read backwards)', () => {   // PIN MOVED (HOOD-SUN): VAMP-HOOD left the -20 under a hood
  const v = vampire();
  const cloak = casualCloak();
  equipItem(v, cloak);
  const seven = (n) => VAMPIRE_STATS.map((s) => [s, n]);
  const stats = () => VAMPIRE_STATS.map((s) => [s, v.racialOverride.statMods[s]]);
  vampirismMagicRound(v, { nowMinutes: at(12) });
  assert.deepEqual(stats(), seven(-VAMPIRE_STAT_MOD), 'hood down in the street at noon: the sun\'s -20');
  nextVariant(cloak);
  assert.equal(racialFastTravelBlock(v, at(12)), null, 'hooded');
  vampirismMagicRound(v, { nowMinutes: at(12) });
  assert.deepEqual(stats(), seven(VAMPIRE_STAT_MOD), 'hood up at noon: no sun reaches the curse - DFU\'s +20, as under a roof');
  vampirismMagicRound(v, { nowMinutes: at(23) });
  assert.deepEqual(stats(), seven(VAMPIRE_STAT_MOD), 'and by night, as ever');
  toggleHood(cloak);   // the Enhanced pack's Lower hood (HOOD-SAID)
  assert.equal(racialSunAverse(v), true, 'lowered');
  vampirismMagicRound(v, { nowMinutes: at(12) });
  assert.deepEqual(stats(), seven(-VAMPIRE_STAT_MOD), 'the hood lowered: the sun\'s again');
  const w = vampire();
  const packed = casualCloak();
  nextVariant(packed);
  w.items.push(packed);
  vampirismMagicRound(w, { nowMinutes: at(12) });
  assert.equal(w.racialOverride.statMods.strength, -VAMPIRE_STAT_MOD, 'a raised hood in the pack, not worn: the sun\'s -20');
});

test('VAMP-HOOD: ONE hood law - vampirism reads survival/temperature.js cloakState and names no hooded garment of its own; THE FOUR HOSTS', () => {
  const src = read('src/systems/vampirism.js');
  assert.match(src, /^import \{ cloakState \} from '\.\/survival\/temperature\.js';/m, 'the felt temperature\'s hood, imported');
  assert.match(src, /return !cloakState\(entity\.equip\?\.slots \?\? null\)\.hood;/, 'read off the worn table, as the survival feed reads it');
  assert.doesNotMatch(src, /HOODED_|\b(154|155|163|191|192|200)\b/, 'no second list of hooded items');
  // the travel map's door, the party's refusal and the arrival clamp are world.js's alone: exterior.js mounts no map
  // (its header), and the interior and dungeon hosts are inside, where the door refuses before any sun rung
  const world = read('src/scenes/world.js');
  assert.equal((world.match(/racialFastTravelBlock\(playerEntity, nowMin\)/g) ?? []).length, 3, 'the map door, the party\'s refusal and the driver\'s map online (AUDIT IT1 W2, PIN MOVED)');
  for (const host of ['exterior', 'worldModes', 'dungeonContext']) {
    assert.doesNotMatch(read(`src/scenes/${host}.js`), /racialFastTravelBlock|racialSunAverse|arrivalClampMinutes/,
      `${host}.js has no travel door - flagged, nothing to wire`);
  }
});
