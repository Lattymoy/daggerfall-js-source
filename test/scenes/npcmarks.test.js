// NPC-MARKS (2026-10-21): the bobbing marks over the Morrowind bodies whose click is a quest's, a merchant's or a guild's
// (scenes/npcMarksHost.js, render/npcMarkPass.js). The law of who is marked rides the click's own route
// (staticNpcRouteIn - one construction for both), the quest's own behaviour (a real QuestResourceBehaviour on a real
// Quest), and the people lane's own answer of whose body stands (heightOf).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { staticNpcRouteIn, routeMark, questMarked, markKindOf, createNpcMarks, markCrownOf, NPC_MARKS_REACH, NPC_MARKS_FADE, MARK_OVER_HEAD_M } from '../../src/scenes/npcMarksHost.js';
import { NPC_MARKS_MAX, NPC_MARK_KINDS, MARK_BOB_M, MARK_HALF_M, MARK_MIN_RAD, markBob, markQuadVertices, NPC_MARK_FS, NPC_MARK_VS, NpcMarkRenderer } from '../../src/render/npcMarkPass.js';
import { FactionFile } from '../../src/formats/factionFile.js';
import { ARENA_GATE_PEOPLE } from '../../src/world/arena/arenaCity.js';
import { ACTION_FLAGS } from '../../src/world/rdbLayout.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';
import { GUILD_GROUPS, SOCIAL_GROUPS, FACTION_TYPES } from '../../src/formats/factionFile.js';
import { Quest } from '../../src/systems/quest/quest.js';
import { Person } from '../../src/systems/quest/person.js';
import { Symbol as QuestSymbol } from '../../src/systems/quest/symbol.js';
import { QuestResourceBehaviour } from '../../src/systems/quest/resourceBehaviour.js';
import { setPref, getPref } from '../../src/systems/uiPrefs.js';
import { FEATURES } from '../../src/systems/features.js';
import { registerMerchantService, _resetMerchantServices } from '../../src/systems/guild/guildServices.js';
import { NPC_BODY_TIERS } from '../../src/characters/npcBodies.js';
import { glslFunctions, GlslDiscard } from '../glsl.mjs';

const ROOT = join(fileURLToPath(new URL('..', import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');

const faction = (o) => ({ id: 0, ggroup: GUILD_GROUPS.None, sgroup: SOCIAL_GROUPS.None, type: FACTION_TYPES.Group, ...o });
const MERCHANT = faction({ id: 510, sgroup: SOCIAL_GROUPS.Merchants });
const MG_TRAINING = faction({ id: 61, ggroup: GUILD_GROUPS.MagesGuild });   // a guild-service faction (guildserviceflow.test.js U23)
const MAGES_HALL = faction({ id: 40, ggroup: GUILD_GROUPS.MagesGuild });
const COMMONER = faction({ id: 600, sgroup: SOCIAL_GROUPS.Commoners });
const dict = new Map([MERCHANT, MG_TRAINING, MAGES_HALL, COMMONER].map((f) => [f.id, f]));
const shop = { factionId: 0, buildingType: BUILDING_TYPES.GemStore };
const smithy = { factionId: 0, buildingType: BUILDING_TYPES.WeaponSmith };
const house = { factionId: 0, buildingType: BUILDING_TYPES.House1 };
const hall = { factionId: 40, buildingType: BUILDING_TYPES.GuildHall };

/** A quest holding one person, and a behaviour bound to them as the scene mount binds one. */
function questPerson() {
  const quest = new Quest();
  const person = new Person(quest);
  person.symbol = new QuestSymbol('_contact_');
  quest.addResource(person);
  const machine = { getQuest: (uid) => (uid === quest.uid ? quest : null), _registerBehaviour() {} };
  const behaviour = new QuestResourceBehaviour(machine);
  behaviour.assignResource(person);
  return { quest, person, behaviour };
}

test('NPC-MARKS the route is the click\'s: a merchant in a shop, a bank and a tavern earns a coin; in a house, in the street or a commoner, none', () => {
  const kind = (id, building) => routeMark(staticNpcRouteIn({ npcFactionId: id, dict, building }));
  assert.deepEqual(staticNpcRouteIn({ npcFactionId: 510, dict, building: smithy }), { kind: 'merchant', service: 'repair' });
  assert.equal(kind(510, shop), 'merchant');
  assert.equal(kind(510, { factionId: 0, buildingType: BUILDING_TYPES.Bank }), 'merchant');
  assert.equal(kind(510, { factionId: 0, buildingType: BUILDING_TYPES.Tavern }), 'merchant');
  assert.equal(kind(510, house), null, 'a merchant at home talks');
  assert.equal(kind(510, null), null, 'a merchant in the street talks');
  assert.equal(kind(600, shop), null, 'a customer in the shop talks');
  assert.equal(kind(9999, shop), null, 'a faction the table does not hold talks');
  // RR3: a merchant with a custom service (Services.HasCustomMerchantService, PlayerActivate.cs:1574) sells wherever they stand
  try {
    registerMerchantService(510, () => {}, 'Custom', () => true);
    assert.equal(kind(510, null), 'merchant', 'a custom merchant service in the street');
    assert.equal(kind(510, house), 'merchant');
  } finally { _resetMerchantServices(); }
  assert.equal(kind(510, null), null);
});

test('NPC-MARKS a guild\'s servant earns a gem, in the hall and in the street (StaticNPCClick\'s guild arm needs no building); the coven too', () => {
  assert.deepEqual(staticNpcRouteIn({ npcFactionId: 61, dict, building: hall }), { kind: 'guildService', guildGroup: GUILD_GROUPS.MagesGuild, buildingFactionId: 40 });
  assert.equal(routeMark(staticNpcRouteIn({ npcFactionId: 61, dict, building: hall })), 'service');
  assert.equal(routeMark(staticNpcRouteIn({ npcFactionId: 61, dict, building: null })), 'service');
  assert.equal(routeMark({ kind: 'witchesCoven' }), 'service');
  assert.equal(routeMark({ kind: 'talk', spymaster: true }), null);
  assert.equal(routeMark(null), null);
});

test('NPC-MARKS a quest\'s person: marked while the quest is live; set aside, ended, broken or the behaviour destroyed, not', () => {
  const { quest, behaviour } = questPerson();
  assert.equal(questMarked(behaviour), true, 'before any update: the quest resolved off its uid and symbol');
  behaviour.cacheTarget();
  assert.equal(questMarked(behaviour), true);
  quest.shelvedAt = 5; assert.equal(questMarked(behaviour), false, 'QUEST-SHELF: a quest set aside takes no click');
  quest.shelvedAt = null; quest.questComplete = true; assert.equal(questMarked(behaviour), false);
  quest.questComplete = false; quest.questBreak = true; assert.equal(questMarked(behaviour), false);
  quest.questBreak = false; assert.equal(questMarked(behaviour), true);
  behaviour.isComponentDestroyed = true; assert.equal(questMarked(behaviour), false);
  assert.equal(questMarked(null), false);
  const lost = new QuestResourceBehaviour({ getQuest: () => null, _registerBehaviour() {} });
  assert.equal(questMarked(lost), false, 'a behaviour whose quest is gone');
});

test('NPC-MARKS a person\'s mark: the quest\'s over their route\'s; the route read once, never before the faction table; a stand is the quest\'s or no one\'s', () => {
  const ctx = { dict: null, building: shop };
  const keeper = { factionID: 510 };
  assert.equal(markKindOf(keeper, ctx), null, 'no table yet');
  assert.equal(keeper._mwMarkRoute, undefined, 'and nothing kept: asked again');
  ctx.dict = dict;
  assert.equal(markKindOf(keeper, ctx), 'merchant');
  ctx.building = house;
  assert.equal(markKindOf(keeper, ctx), 'merchant', 'read once - a person\'s room does not change while they stand');
  const { behaviour } = questPerson();
  keeper.questBehaviour = behaviour;
  assert.equal(markKindOf(keeper, ctx), 'quest', 'a quest that comes to a marked merchant marks them its own');
  behaviour.isComponentDestroyed = true;
  assert.equal(markKindOf(keeper, ctx), 'merchant', 'and gone, their coin again');
  behaviour.isComponentDestroyed = false;
  const questor = { factionID: 510, questBehaviour: behaviour };
  assert.equal(markKindOf(questor, { dict, building: shop }), 'quest', 'what the quest wants first');
  const stand = { behaviour };
  assert.equal(markKindOf(stand, { dict, building: shop }), 'quest');
  assert.equal(markKindOf({ behaviour: null }, { dict, building: shop }), null);
  assert.equal(markKindOf({ ...questor, active: false }, { dict, building: shop }), null, 'a hidden person');
  assert.equal(markKindOf({ ...questor, dead: true }, { dict, building: shop }), null);
});

/** A fake pass that records what it was handed. */
const fakePass = () => {
  const calls = [];
  return { calls, build: () => ({ drawn: 0, draw(marks, n) { calls.push(marks.slice(0, n).map((m) => ({ ...m, at: [...m.at] }))); this.drawn = n; } }) };
};
const person = (id, x, kind = 'merchant') => ({ factionID: kind === 'merchant' ? 510 : 600, _mwActor: { id }, _mwFeet: [x, 0, 0] });

test('NPC-MARKS the pick: only bodies the lane stands, hung over their own height, nearest first, at most NPC_MARKS_MAX, faded at the reach\'s far end, gone past it', () => {
  const f = fakePass();
  const marks = createNpcMarks(/** @type {any} */ ({}), { build: f.build, reduced: () => true });
  const ctx = { dict, building: shop };
  const people = [person('far', 29), person('a', 3), person('sprite', 2), person('b', 1), person('past', 31), person('talker', 4, 'talk')];
  for (let i = 0; i < 20; i++) people.push(person(`c${i}`, 10 + i * 0.1));
  marks.gather(ctx, people);
  const heights = { sprite: 0 };
  const lane = { heightOf: (id) => heights[id] ?? 1.9 };
  assert.equal(marks.draw(new Float32Array(16), new Float32Array(16), [0, 1.9, 0], lane, 0), true);
  const drawn = f.calls[0];
  assert.equal(NPC_MARKS_MAX, NPC_BODY_TIERS.near.max, 'the most marks: the people lane\'s own Near cap');
  assert.equal(drawn.length, NPC_MARKS_MAX);
  assert.deepEqual(drawn.slice(0, 2).map((m) => m.kind), ['merchant', 'merchant']);
  assert.deepEqual(drawn[0].at, [1, 1.9 + MARK_OVER_HEAD_M, 0], 'over the body\'s own height (still: no bob)');
  assert.equal(drawn[1].at[0], 3, 'the sprite (no body) and the talker earn none');
  assert.ok(drawn.every((m, i) => i === 0 || drawn[i - 1].at[0] <= m.at[0]), 'nearest first');
  assert.ok(!drawn.some((m) => m.at[0] >= 29), 'the far ones past the twelfth are cut');
  assert.ok(drawn.every((m) => m.alpha === 1));
  // the reach's fade, and past it nothing
  marks.gather(ctx, [person('edge', NPC_MARKS_REACH * (1 - NPC_MARKS_FADE / 2)), person('past', NPC_MARKS_REACH + 0.5)]);
  marks.draw(new Float32Array(16), new Float32Array(16), [0, 1.9, 0], lane, 0);
  assert.equal(f.calls[1].length, 1);
  assert.ok(Math.abs(f.calls[1][0].alpha - 0.5) < 1e-9, 'half way through the fade, half seen');
});

test('NPC-MARKS a draw lets its candidates go; off the switch, off the lane or with no pass nothing is drawn', () => {
  const f = fakePass();
  const marks = createNpcMarks(/** @type {any} */ ({}), { build: f.build, reduced: () => true });
  const ctx = { dict, building: shop };
  const lane = { heightOf: () => 1.8 };
  const eye = [0, 1.8, 0], m4 = new Float32Array(16);
  marks.gather(ctx, [person('a', 2)]);
  assert.equal(marks.draw(m4, m4, eye, lane, 0), true);
  assert.equal(marks.draw(m4, m4, eye, lane, 0), false, 'the candidates went with the draw');
  marks.gather(ctx, [person('a', 2)]);
  assert.equal(marks.draw(m4, m4, eye, null, 0), false, 'no lane');
  assert.equal(marks.draw(m4, m4, eye, lane, 0), false, 'and that draw let them go too');
  const was = getPref('npcMarks');
  try {
    setPref('npcMarks', false);
    marks.gather(ctx, [person('a', 2)]);
    assert.equal(marks.draw(m4, m4, eye, lane, 0), false, 'the switch off');
  } finally { setPref('npcMarks', was); }
  const none = createNpcMarks(null);
  none.gather(ctx, [person('a', 2)]);
  assert.equal(none.draw(m4, m4, eye, lane, 0), false, 'no GL context, no pass');
  const broken = createNpcMarks(/** @type {any} */ ({}), { build: () => { throw new Error('no'); } });
  assert.equal(broken.draw(m4, m4, eye, lane, 0), false, 'a pass that would not build draws nothing');
});

test('NPC-MARKS the bob: MARK_BOB_M each way at MARK_BOB_HZ, a phase each, still under reduced motion; the icon\'s three kinds each a shape of the shader\'s', () => {
  assert.equal(markBob(0, 0), 0);
  assert.ok(Math.abs(markBob(0.25, 0) - MARK_BOB_M) < 1e-9);
  assert.ok(Math.abs(markBob(0.75, 0) + MARK_BOB_M) < 1e-9);
  assert.ok(Math.abs(markBob(0, 0.25) - MARK_BOB_M) < 1e-9, 'a phase of its own');
  assert.equal(markBob(0.25, 0, true), 0, 'reduced motion: still');
  assert.ok(Math.abs(markBob(120.25, 0) - markBob(0.25, 0)) < 1e-9, 'the wrapped clock never jumps it');
  assert.deepEqual(NPC_MARK_KINDS, { quest: 0, merchant: 1, service: 2 });
  assert.ok(NPC_MARK_FS.includes(`uKind == ${NPC_MARK_KINDS.quest}`) && NPC_MARK_FS.includes(`uKind == ${NPC_MARK_KINDS.merchant}`), 'the quest\'s and the merchant\'s arms, the gem the rest');
  assert.equal(markQuadVertices().length, 12);
});

test('NPC-MARKS the Features row: on by default, the viewer\'s, under the enhanced skin', () => {
  const row = FEATURES.find((f) => f.id === 'npc-marks');
  assert.ok(row, 'the row stands');
  assert.deepEqual({ ...row.control }, { store: 'prefs', key: 'npcMarks', initial: true, online: 'player' });
  assert.deepEqual([...row.kinds], ['enhanced']);
});

test('NPC-MARKS THE FOUR HOSTS: the interior and the dungeon (worldModes.js), the street (world.js) and the bench (exterior.js) each gather and draw; the dungeon hands its lane; the click asks the same route', () => {
  const wm = src('src/scenes/worldModes.js');
  assert.match(wm, /npcMarks\.gather\(npcMarkCtx, interiorCtx\.people, questFlats\);/);
  assert.match(wm, /npcMarks\.draw\(proj, view, mwv\.eye, peopleBodies, performance\.now\(\) \/ 1000\)/);
  assert.match(wm, /npcMarks\.gather\(npcMarkCtx, dungeonCtx\.people, dungeonQuestFlats\);/);
  assert.match(wm, /npcMarks\.draw\(proj, view, mwv\.eye, dungeonCtx\.peopleLane, performance\.now\(\) \/ 1000\)/);
  assert.match(wm, /const route = staticNpcRouteIn\(\{ npcFactionId: pn\.factionID, dict: townTalk\?\.factionDict \?\? null, building: interiorBuilding \}\);/);
  assert.doesNotMatch(wm, /staticNpcRoute\(\{/, 'no second construction of the route\'s arguments');
  assert.match(src('src/scenes/dungeonContext.js'), /peopleLane: _peopleLane,/);
  const w = src('src/scenes/world.js');
  assert.match(w, /npcMarks\.consider\(pn, streetMarkCtx\);/);
  assert.match(w, /npcMarks\.draw\(proj, view, mwv\.eye, streetPeople, now \/ 1000\)/);
  const ex = src('src/scenes/exterior.js');
  assert.match(ex, /npcMarks\.gather\(standMarkCtx, exteriorNpcs\);/);
  assert.match(ex, /npcMarks\.draw\(proj, view, eye, standPeople, now \/ 1000\)/);
});

/** The icon as the fragment stage draws it, cell by cell, top row first: '.' discarded, '#' the dark rim, 'O' the fill. */
function iconMask(kind) {
  const fns = glslFunctions(NPC_MARK_FS, { vP: [0, 0], uKind: NPC_MARK_KINDS[kind], uAlpha: 1, o: [0, 0, 0, 0] });
  const rows = [];
  for (let y = 15; y >= 0; y--) {
    let r = '';
    for (let x = 0; x < 16; x++) {
      fns.globals.vP = [(x + 0.5) / 8 - 1, (y + 0.5) / 8 - 1];
      try { fns.main(); r += fns.globals.o[0] < 0.2 ? '#' : 'O'; } catch (e) { if (!(e instanceof GlslDiscard)) throw e; r += '.'; }
    }
    rows.push(r);
  }
  return rows;
}

test('NPC-MARKS the icons as the GPU draws them (test/glsl.mjs runs the fragment stage): a "!" whose dot stands apart, a round coin, a gem - each in a dark rim, the corners clear', () => {
  assert.deepEqual(iconMask('quest'), [
    '.....######.....', '.....#OOOO#.....', '.....#OOOO#.....', '.....#OOOO#.....', '.....#OOOO#.....', '.....#OOOO#.....',
    '.....#OOOO#.....', '.....#OOOO#.....', '.....#OOOO#.....', '.....#OOOO#.....', '.....######.....', '.....#OOOO#.....',
    '.....#OOOO#.....', '.....#OOOO#.....', '.....#OOOO#.....', '.....######.....',
  ]);
  assert.deepEqual(iconMask('merchant'), [
    '.....######.....', '...##########...', '..###OOOOOO###..', '.##OOOOOOOOOO##.', '.##OOOOOOOOOO##.', '##OOOOOOOOOOOO##',
    '##OOOOOOOOOOOO##', '##OOOOOOOOOOOO##', '##OOOOOOOOOOOO##', '##OOOOOOOOOOOO##', '##OOOOOOOOOOOO##', '.##OOOOOOOOOO##.',
    '.##OOOOOOOOOO##.', '..###OOOOOO###..', '...##########...', '.....######.....',
  ]);
  assert.deepEqual(iconMask('service'), [
    '.......##.......', '......#OO#......', '.....#OOOO#.....', '....##OOOO##....', '...##OOOOOO##...', '...#OOOOOOOO#...',
    '..#OOOOOOOOOO#..', '.#OOOOOOOOOOOO#.', '.#OOOOOOOOOOOO#.', '..#OOOOOOOOOO#..', '...#OOOOOOOO#...', '...##OOOOOO##...',
    '....##OOOO##....', '.....#OOOO#.....', '......#OO#......', '.......##.......',
  ]);
});

test('NPC-MARKS the quad stands square to the eye at the mark, never under MARK_MIN_RAD of the view (test/glsl.mjs runs the vertex stage)', () => {
  const at = [2, 3, -10], eye = [2, 3, 90];   // 100 m off: the view's floor, not the palm's width
  const fns = glslFunctions(NPC_MARK_VS, { aP: [1, 1], uVP: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], uAt: at, uRight: [1, 0, 0], uEye: eye, uHalf: MARK_HALF_M, uMinRad: MARK_MIN_RAD, vP: [0, 0], gl_Position: [0, 0, 0, 0] });
  fns.main();
  const h = 100 * MARK_MIN_RAD;
  assert.ok(h > MARK_HALF_M);
  const close = (got, want, why) => assert.ok(got.every((v, i) => Math.abs(v - want[i]) < 1e-9), `${why}: ${got} is not ${want}`);
  close(fns.globals.gl_Position, [2 + h, 3 + 2 * h, -10, 1], 'far, the view\'s floor - standing on its point, its top two half-sizes over it');
  fns.globals.uEye = [2, 3, -10.5];
  fns.main();
  close(fns.globals.gl_Position, [2 + MARK_HALF_M, 3 + 2 * MARK_HALF_M, -10, 1], 'near, its own size');
  fns.globals.aP = [-1, -1];
  fns.main();
  close(fns.globals.gl_Position, [2 - MARK_HALF_M, 3, -10, 1], 'AUDIT NPC-MARKS R9: its bottom on the point, at any size - a far mark never sinks into the head');
});

// ═══ AUDIT NPC-MARKS (bible/04-Characters/Morrowind-NPCs.md section 31) ═══

test('AUDIT NPC-MARKS L1: while FACTION.TXT loads its dict is the producer\'s empty Map - a route read then is not kept, and the coin comes when the row does', () => {
  const loading = new FactionFile().factionDict;   // what townTalk.factionDict answers between `new FactionFile()` and its load
  const keeper = { factionID: 510 };
  const ctx = { dict: loading, building: shop };
  assert.equal(markKindOf(keeper, ctx), null);
  assert.equal(keeper._mwMarkRoute, undefined, 'nothing kept while the row is missing');
  loading.set(510, MERCHANT);
  assert.equal(markKindOf(keeper, ctx), 'merchant');
});

test('AUDIT NPC-MARKS L2: a townsperson the work pool holds is marked where the click reaches talk - the offer is the talk arm\'s first door; a door of the route\'s own comes first', () => {
  const work = new Set([7]);
  const ctx = { dict, building: house, offersWork: (pn) => work.has(pn.seed) };
  assert.equal(markKindOf({ factionID: 600, seed: 7 }, ctx), 'quest');
  assert.equal(markKindOf({ factionID: 600, seed: 8 }, ctx), null);
  assert.equal(markKindOf({ factionID: 510, seed: 7 }, { ...ctx, building: shop }), 'merchant', 'a merchant\'s click opens the shop first');
  const p = { factionID: 600, seed: 7 };
  assert.equal(markKindOf(p, ctx), 'quest');
  work.delete(7);
  assert.equal(markKindOf(p, ctx), null, 'read every frame - the offer taken, the mark gone');
  assert.match(src('src/scenes/worldModes.js'), /offersWork: \(pn\) => !!npcSession\?\.isNpcOfferingQuest\(pn\._mwSeed \?\?= staticNpcData\(pn, staticNpcSceneCtx\(pn\)\)\.nameSeed\)/);
  assert.match(src('src/scenes/world.js'), /offersWork: \(pn\) => npcSession\.isNpcOfferingQuest\(pn\._mwSeed \?\?= staticNpcData\(pn, \{ locationIndex: _questLoc\(\)\?\.locationIndex \?\? 0 \}\)\.nameSeed\)/);
});

test('AUDIT NPC-MARKS L3: a guild-service route marks only where a guild answers it - a holy order\'s servant in a building no divine runs is "You get no response."', () => {
  const holy = faction({ id: 241, ggroup: GUILD_GROUPS.HolyOrder });
  const knight = faction({ id: 9998, ggroup: GUILD_GROUPS.KnightlyOrder });
  const d = new Map([[241, holy], [9998, knight]]);
  assert.equal(routeMark({ kind: 'guildService', guildGroup: GUILD_GROUPS.HolyOrder, buildingFactionId: 0 }, d), null);
  assert.equal(routeMark({ kind: 'guildService', guildGroup: GUILD_GROUPS.KnightlyOrder, buildingFactionId: 0 }, d), null, 'an order no hall holds');
  assert.equal(routeMark({ kind: 'guildService', guildGroup: GUILD_GROUPS.FightersGuild, buildingFactionId: 0 }, d), 'service');
});

test('AUDIT NPC-MARKS L4: a person the click cannot reach is no one\'s - no width, or riding a ShowText action (dungeonContext.js npcTargets)', () => {
  const ctx = { dict, building: shop };
  assert.equal(markKindOf({ factionID: 510, width: 0.8 }, ctx), 'merchant');
  assert.equal(markKindOf({ factionID: 510, width: 0 }, ctx), null);
  assert.equal(markKindOf({ factionID: 510, width: 0.8, action: { actionFlag: ACTION_FLAGS.ShowText } }, ctx), null);
  assert.equal(markKindOf({ factionID: 510, width: 0.8, action: { actionFlag: ACTION_FLAGS.ShowTextWithInput } }, ctx), null);
  assert.equal(markKindOf({ factionID: 510, width: 0.8, action: { actionFlag: ACTION_FLAGS.Rotation } }, ctx), 'merchant');
});

test('AUDIT NPC-MARKS L5: the arena\'s officers open their own windows before any route - the gate\'s by their record, the undercroft\'s by their office', () => {
  const ctx = { dict, building: null };
  const offices = ['herald', 'redRecruiter', 'blueRecruiter', 'bookmaker'];
  assert.deepEqual(offices.filter((r) => ARENA_GATE_PEOPLE.some((g) => g.role === r)), offices, 'the gate stands all four');
  for (const g of ARENA_GATE_PEOPLE) {
    const pn = { factionID: 600, position: g.position, textureArchive: g.archive, textureRecord: g.record };
    assert.equal(markKindOf(pn, ctx), offices.includes(g.role) ? 'service' : null, `${g.role}: a warden talks as the city's people do`);
  }
  assert.equal(markKindOf({ factionID: 600, arenaRole: 'pitMaster' }, ctx), 'service');
  assert.equal(markKindOf({ factionID: 600, arenaRole: 'hallKeeper' }, ctx), 'service');
  assert.equal(markKindOf({ factionID: 600, arenaRole: 'warden' }, ctx), null);
  assert.equal(markKindOf({ factionID: 600, arenaRole: 'pitMaster', questBehaviour: questPerson().behaviour }, ctx), 'service',
    'an officer a quest holds: the press opens the office before the quest\'s click is reached (activateStaticNpc before openStaticNpc)');
  assert.equal(markKindOf({ factionID: 600, position: ARENA_GATE_PEOPLE[0].position, textureArchive: 1, textureRecord: 1 }, ctx), null, 'the record, not the position alone');
});

test('AUDIT NPC-MARKS L6: a mod\'s merchant service switched mid-session moves the mark with the click', () => {
  let on = false;
  try {
    registerMerchantService(510, () => {}, 'Custom', () => on);
    const pn = { factionID: 510 };   // a merchant in the street: talk, unless the mod's service is on
    const ctx = { dict, building: null };
    assert.equal(markKindOf(pn, ctx), null);
    on = true;
    assert.equal(markKindOf(pn, ctx), 'merchant');
    on = false;
    assert.equal(markKindOf(pn, ctx), null);
  } finally { _resetMerchantServices(); }
});

test('AUDIT NPC-MARKS L7: under the Billboard Look the crown draws at cos(pitch) of the body\'s height; off, at its height', () => {
  assert.equal(markCrownOf(1.8, [0, 0, 10], [0, 0.9, 0], false), 1.8);
  assert.ok(Math.abs(markCrownOf(1.8, [0, 0, 10], [0, 0.9, 0], true) - 1.8) < 1e-9, 'level: its height');
  const c = markCrownOf(1.8, [0, 0, 10], [0, 10.9, 0], true);
  assert.ok(Math.abs(c - 1.8 * Math.SQRT1_2) < 1e-9, `from 45 degrees above: ${c}`);
  const f = fakePass();
  const marks = createNpcMarks(/** @type {any} */ ({}), { build: f.build, reduced: () => true });
  const was = getPref('mwBillboardLook');
  try {
    setPref('mwBillboardLook', true);
    marks.gather({ dict, building: shop }, [person('a', 5)]);
    marks.draw(new Float32Array(16), new Float32Array(16), [0, 1.9 + 5, 0], { heightOf: () => 1.9 }, 0);
    const want = markCrownOf(1.9, [5, 0, 0], [0, 6.9, 0], true) + MARK_OVER_HEAD_M;
    assert.ok(Math.abs(f.calls[0][0].at[1] - want) < 1e-9, 'the host reads the switch');
  } finally { setPref('mwBillboardLook', was); }
});

/** A WebGL2 stand-in that records each call by name - enough for buildProgram and the pass. */
function stubGl() {
  const calls = [];
  const gl = new Proxy({}, {
    get(_, k) {
      if (k === 'calls') return calls;
      if (typeof k !== 'string' || /^[A-Z_0-9]+$/.test(k)) return k;
      return (...args) => {
        calls.push([k, ...args]);
        if (k === 'getProgramParameter' || k === 'getShaderParameter') return true;
        if (k === 'getUniformLocation') return args[1];
        return { of: k };
      };
    },
  });
  return /** @type {any} */ (gl);
}

test('AUDIT NPC-MARKS R2: the pass binds nothing when no mark will draw (a mark at the reach\'s edge, faded to nothing) - and the host is told the truth either way', () => {
  const gl = stubGl();
  const pass = new NpcMarkRenderer(gl);
  gl.calls.length = 0;
  pass.draw([{ at: [0, 0, 0], kind: 'quest', alpha: 0 }], 1, new Float32Array(16), new Float32Array(16), [0, 0, 0]);
  assert.deepEqual(gl.calls, [], 'no program, no VAO, nothing');
  assert.equal(pass.drawn, 0);
  pass.draw([{ at: [0, 0, 0], kind: 'quest', alpha: 0 }, { at: [1, 0, 0], kind: 'merchant', alpha: 1 }], 2, new Float32Array(16), new Float32Array(16), [0, 0, 0]);
  assert.equal(pass.drawn, 1);
  assert.ok(gl.calls.some((c) => c[0] === 'useProgram'));
  assert.equal(gl.calls.filter((c) => c[0] === 'drawArrays').length, 1);
  // the host: a lone mark at the reach's very edge answers false and binds nothing
  const host = createNpcMarks(stubGl(), { reduced: () => true });
  host.gather({ dict, building: shop }, [person('edge', NPC_MARKS_REACH - 1e-9)]);
  assert.equal(host.draw(new Float32Array(16), new Float32Array(16), [0, 1.9, 0], { heightOf: () => 1.9 }, 0), false);
  host.dispose();
});

test('AUDIT NPC-MARKS R5: the icon\'s right is the billboards\' camRight - the view\'s first row negated, the HANDEDNESS mirror\'s screen right', () => {
  const gl = stubGl();
  const pass = new NpcMarkRenderer(gl);
  const view = new Float32Array(16); view[0] = 0.5; view[4] = 0; view[8] = -0.75;
  pass.draw([{ at: [0, 0, 0], kind: 'quest', alpha: 1 }], 1, new Float32Array(16), view, [0, 0, 0]);
  const right = gl.calls.find((c) => c[0] === 'uniform3f' && c[1] === 'uRight');
  assert.deepEqual(right.slice(2), [-0.5, -0, 0.75]);
});

test('AUDIT NPC-MARKS R3/R4: one pass a GL context, shared by its hosts; the last host to let go frees it, and a second dispose does nothing', () => {
  const gl = stubGl();
  let built = 0;
  const build = (g) => { built++; return new NpcMarkRenderer(g); };
  const a = createNpcMarks(gl, { build }), b = createNpcMarks(gl, { build });
  assert.equal(built, 1, 'the world host and its modes, one program');
  a.dispose();
  assert.ok(!gl.calls.some((c) => c[0] === 'deleteProgram'), 'still held by the other');
  b.dispose();
  assert.equal(gl.calls.filter((c) => c[0] === 'deleteProgram').length, 1);
  assert.equal(gl.calls.filter((c) => c[0] === 'deleteVertexArray').length, 1);
  assert.equal(gl.calls.filter((c) => c[0] === 'deleteBuffer').length, 1);
  b.dispose();
  assert.equal(gl.calls.filter((c) => c[0] === 'deleteProgram').length, 1);
  createNpcMarks(gl, { build });
  assert.equal(built, 2, 'a host after the last let go builds again');
});
