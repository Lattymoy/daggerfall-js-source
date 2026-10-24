// MWNPC8a (2026-10-09, the MW-NPC arc's eighth slice - bible/04-Characters/Morrowind-NPCs.md section 13): THE BUILDING'S
// STANDING PEOPLE IN THEIR BODIES. A StaticNPC's own data (race off the faction, gender off the record's flags) and
// their faction's row (its type, social group and guild group) dress the body: priests, mages, knights and fighters,
// nobles, merchants, the underworld, scholars, and everyone else in the street's outfits; a child and a vampire keep
// their sprites. They stand idle and turn to face the player at a person's pace. worldModes.js offers the room's
// people before its billboards draw. Pinned: the wardrobe per faction, the look (and who keeps a sprite), the turn,
// and the host by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARMOR_MATERIAL } from '../../src/systems/armorMaterials.js';
import { readFileSync } from 'node:fs';
import { wardrobeOf, personLook, personActor, KIND_ROLE, PERSON_TURN_RATE } from '../../src/characters/peopleBodies.js';
import { wornByRole, ARMOR_KITS, WARDROBE_ROLES } from '../../src/characters/wardrobe.js';   // PIN MOVED (MWNPC17, section 25): a look is its role's, dressed off the seed - no one outfit to compare
import { SOCIAL_GROUPS, GUILD_GROUPS, FACTION_TYPES } from '../../src/formats/factionFile.js';
import { RACES } from '../../src/systems/races.js';
import { GENDERS } from '../../src/characters/nameHelper.js';
import { EQUIP_SLOTS } from '../../src/systems/equip.js';
import { ARMOR_ENUM } from '../../src/combat/enemyEquipment.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const fac = (o) => ({ type: FACTION_TYPES.Generic, sgroup: SOCIAL_GROUPS.Commoners, ggroup: GUILD_GROUPS.None, ...o });
const data = (o = {}) => ({ race: RACES.Breton, gender: GENDERS.Male, nameSeed: 77, hash: 5, factionID: 0, billboardArchiveIndex: 182, billboardRecordIndex: 1, ...o });

test('MWNPC8a-1 the wardrobe a faction gives: a temple\'s priest, a mage, a knight in plate, a fighter in what came to hand, a noble, a merchant, the underworld, a scholar - everyone else the street\'s; a vampire none', () => {
  assert.equal(wardrobeOf(null), 'common');
  assert.equal(wardrobeOf(fac({ type: FACTION_TYPES.Temple })), 'priest');
  assert.equal(wardrobeOf(fac({ ggroup: GUILD_GROUPS.HolyOrder })), 'priest');
  assert.equal(wardrobeOf(fac({ ggroup: GUILD_GROUPS.MagesGuild })), 'mage');
  assert.equal(wardrobeOf(fac({ type: FACTION_TYPES.MagicUser })), 'mage');
  // PIN MOVED (MWNPC17): the one 'steel' split - a knightly order's and a court's guard a knight's plate, a fighters'
  // guild's a fighter's armour; a coven's and a necromancer a mage's, the Brotherhood the underworld's
  assert.equal(wardrobeOf(fac({ ggroup: GUILD_GROUPS.KnightlyOrder })), 'knight');
  assert.equal(wardrobeOf(fac({ ggroup: GUILD_GROUPS.FightersGuild })), 'fighter');
  assert.equal(wardrobeOf(fac({ type: FACTION_TYPES.KnightlyGuard })), 'knight');
  assert.equal(wardrobeOf(fac({ type: FACTION_TYPES.WitchesCoven })), 'mage');
  assert.equal(wardrobeOf(fac({ ggroup: GUILD_GROUPS.Necromancers })), 'mage');
  assert.equal(wardrobeOf(fac({ ggroup: GUILD_GROUPS.DarkBrotherHood })), 'underworld');
  for (const k of ['priest', 'mage', 'knight', 'fighter', 'noble', 'merchant', 'underworld', 'scholar', 'common']) assert.ok(WARDROBE_ROLES[KIND_ROLE[k]], `${k} dresses by a role`);
  assert.equal(wardrobeOf(fac({ sgroup: SOCIAL_GROUPS.Nobility })), 'noble');
  assert.equal(wardrobeOf(fac({ type: FACTION_TYPES.Courts })), 'noble');
  assert.equal(wardrobeOf(fac({ sgroup: SOCIAL_GROUPS.Merchants })), 'merchant');
  assert.equal(wardrobeOf(fac({ sgroup: SOCIAL_GROUPS.Underworld })), 'underworld');
  assert.equal(wardrobeOf(fac({ type: FACTION_TYPES.Thieves })), 'underworld');
  assert.equal(wardrobeOf(fac({ sgroup: SOCIAL_GROUPS.Scholars })), 'scholar');
  assert.equal(wardrobeOf(fac({})), 'common');
  assert.equal(wardrobeOf(fac({ type: FACTION_TYPES.VampireClan })), 'none');
  assert.equal(wardrobeOf(fac({ ggroup: GUILD_GROUPS.Vampires })), 'none');
  assert.equal(wardrobeOf(fac({ sgroup: SOCIAL_GROUPS.SupernaturalBeings })), 'none');
  assert.equal(wardrobeOf(fac({ type: FACTION_TYPES.Temple, ggroup: GUILD_GROUPS.Vampires })), 'none', 'a vampire first, whatever else');
});

test('MWNPC8a-2 the look: their race and gender, the faction\'s garments in its dyes, a knight\'s plate, the street\'s outfits for the rest; a child, a vampire, a race the data cannot name keep their sprite; read once', () => {
  // PIN MOVED (MWNPC17, section 25): each look is its role's, dressed off the seed - the role's garments in its dyes,
  // the hint the build reads beside them
  const priest = personLook({}, data({ gender: GENDERS.Female, race: RACES.DarkElf }), fac({ type: FACTION_TYPES.Temple }));
  assert.equal(priest.race, 'DarkElf');
  assert.equal(priest.gender, 'female');
  assert.ok(wornByRole(priest, 'priest'), 'a priestess\'s garments in the temple\'s dyes');
  assert.ok(priest.npc && Number.isInteger(priest.npc.seed), 'and her own picks, head and hair');
  const noble = personLook({}, data(), fac({ sgroup: SOCIAL_GROUPS.Nobility }));
  assert.ok(wornByRole(noble, 'noble') && !wornByRole(noble, 'commoner'), 'a noble\'s, never the street\'s');
  assert.ok(noble.npc.tier >= 1, 'and never on the ladder\'s common rung');
  const knight = personLook({}, data({ race: RACES.Nord }), fac({ ggroup: GUILD_GROUPS.KnightlyOrder }));
  const plate = knight.items.filter((it) => it.group === 'Armor');
  for (const t of [ARMOR_ENUM.Cuirass, ARMOR_ENUM.Greaves, ARMOR_ENUM.Boots, ARMOR_ENUM.Left_Pauldron, ARMOR_ENUM.Right_Pauldron]) assert.ok(plate.some((it) => it.templateIndex === t), `the knight's whole plate: ${t}`);
  assert.equal(new Set(plate.map((it) => it.material)).size, 1, 'of one metal');
  assert.ok(ARMOR_KITS.knight.metals[knight.npc.tier].some(([m]) => m === plate[0].material), 'his rank\'s');
  assert.equal(knight.items.filter((it) => it.equipSlot === EQUIP_SLOTS.Feet).length, 1, 'his boots, no shoes beside');
  const commons = new Set();
  for (let s = 0; s < 40; s++) { const l = personLook({}, data({ nameSeed: s }), null); assert.ok(wornByRole(l, 'commoner')); commons.add(l.items.map((it) => `${it.templateIndex}.${it.dye}`).join()); }
  assert.ok(commons.size >= 38, `the rest in the street's clothes, hardly two alike (${commons.size} of 40)`);
  assert.equal(personLook({}, data({ billboardArchiveIndex: 182, billboardRecordIndex: 4 }), null), null, 'a child keeps their sprite');
  assert.equal(personLook({}, data({ factionID: 514 }), null), null, 'and a child by the children\'s faction');
  assert.equal(personLook({}, data(), fac({ type: FACTION_TYPES.VampireClan })), null, 'a vampire too');
  assert.equal(personLook({}, data({ race: 0 }), null), null, 'a race the data cannot name');
  assert.equal(personLook({}, null, null), null);
  const pn = {};
  const one = personLook(pn, data(), fac({ sgroup: SOCIAL_GROUPS.Merchants }));
  assert.equal(personLook(pn, data({ race: RACES.Nord }), null), one, 'read once - a standing person is one build');
  const keep = { };
  assert.equal(personLook(keep, data({ factionID: 514 }), null), null);
  assert.equal(personLook(keep, data(), null), null, 'and a sprite once is a sprite for good');
  assert.ok(personLook({}, data(), null).faceIndex >= 0);
});

test('MWNPC8a-3 the turn: facing the player the first frame, then turning toward them at a person\'s pace, the short way round; one actor a person, idle', () => {
  const pn = {};
  const look = { race: 'Breton' };
  const a = personActor(pn, look, [0, 0, 0], [0, 1.6, 5], 1 / 60);
  assert.ok(Math.abs(a.yaw - 0) < 1e-9, 'facing +z, where the player stands');
  assert.deepEqual([a.moving, a.running, a.drawn, a.swings, a.hits, a.dead], [false, false, false, 0, 0, 0]);
  assert.equal(personActor(pn, look, [0, 0, 0], [0, 1.6, 5], 1 / 60), a, 'one object');
  const id = a.id;
  // the player steps round to +x: a quarter turn, taken at PERSON_TURN_RATE
  personActor(pn, look, [0, 0, 0], [5, 1.6, 0], 0.1);
  assert.ok(Math.abs(a.yaw - PERSON_TURN_RATE * 0.1) < 1e-9, `a tenth of a second's turn (${a.yaw})`);
  for (let i = 0; i < 20; i++) personActor(pn, look, [0, 0, 0], [5, 1.6, 0], 0.1);
  assert.ok(Math.abs(a.yaw - Math.PI / 2) < 1e-9, 'and there, without overshooting');
  // across the seam: from just short of pi to just past -pi is a short turn, not a whole one
  const q = {};
  personActor(q, look, [0, 0, 0], [0.1, 1.6, -5], 1 / 60);
  personActor(q, look, [0, 0, 0], [-0.1, 1.6, -5], 0.01);
  assert.ok(q._mwYaw < 0 && Math.abs(Math.abs(q._mwYaw) - Math.PI) < 0.02, `the short way round - across pi, not back through 0 (${q._mwYaw})`);
  assert.equal(a.id, id);
  assert.notEqual(personActor({}, look, [0, 0, 0], [0, 0, 1], 0).id, id, 'another person, another id');
});

test('MWNPC8a-4 the building by source: the lane, the look read once and never before the faction table, the people offered before the room\'s billboards draw, and let go with the room at both its doors', () => {
  const m = rd('src/scenes/worldModes.js');
  assert.ok(m.includes("const peopleBodies = createPopulationLane({ laneName: 'people', renderer });"));
  assert.ok(m.includes('if (pn._mwLook !== undefined) return pn._mwLook;\n    const dict = townTalk?.factionDict ?? null;\n    if (!dict) return null;'), 'not before the faction table');
  const frame = m.indexOf('const _peopleOn = peopleBodies.frame();');
  const offer = m.indexOf('if (look) peopleBodies.offer(personActor(pn, look, pn._mwFeet ??= [pn.x, pn.y, pn.z], mwv.eye, dt), pn.standBatch);', frame);
  const reset = m.indexOf('else pn.standBatch.castOnly = false;', offer);
  const draw = m.indexOf('peopleBodies.draw(canvas, proj, view, mwv.eye, dt);', reset);
  const flats = m.indexOf('renderer.drawBillboards([...interiorCtx.billboardBatches,', draw);
  assert.ok(frame > 0 && offer > frame && reset > offer && draw > reset && flats > draw, 'offered, the rest drawn, synced and marked, then the room\'s billboards');
  assert.equal(m.split('peopleBodies.destroy();').length - 1, 2, 'both of the room\'s teardowns');
});
