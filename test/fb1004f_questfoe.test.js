// QUEST-FOE-LINE (FIELD BUGS 2026-10-04f, the Discord's #bug-reports "Bugged Quests": "The quest The Assassin ... has
// you track down and kill Rodyn Buckingston. I am at his location, he doesn't spawn. I double checked with multiple
// NPCs on his location as well"; the owner, of a line naming the foe as the quest's: "Do it").
//
// The trace first, over the real parser and machine (test/fb1004dTowns.mjs's region): A0C00Y08 stands the named man at
// `_place_`, and walking in hides him and hot-places ONE restrained class foe on his marker - here, every draw at 0.55,
// the Rogue. The foe stands in a REAL foe pool (scenes/exteriorFoes.js - the interior host's `interiorFoes` is one,
// minted the same way), stood as the interior adapter's standFoe stands it, and the pool's own hover answers it. Then the
// line's law, a clause a pin; then the hosts.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { addQuestResourceObjects } from '../src/systems/quest/sceneMount.js';
import { SITE_TYPES } from '../src/systems/quest/place.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { questFoeLine, questFoeSubs, QUEST_FOE_PREFIX } from '../src/systems/questFoeLine.js';
import { resolveHover } from '../src/systems/worldHover.js';
import { drawLootPanel } from '../src/ui/classicLootPanel.js';
import { loadTables, questScript, mark, rmbBlock, town, worldOf, SPAWN, ITEM } from './fb1004dTowns.mjs';

loadTables();
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const settle = () => new Promise((r) => setTimeout(r, 0));

/** A class's CLASS*.CFG as ClassFile reads it (formats/classFile.js): the career's 16-byte name at byte 28, and the
 *  50s of an average career. */
function classCfg(name) {
  const b = new Uint8Array(80); const v = new DataView(b.buffer);
  for (let i = 0; i < name.length; i++) b[28 + i] = name.charCodeAt(i);
  v.setUint16(52, 10, true);
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, 50, true);
  return b;
}
const CAREERS = { 'CLASS01.CFG': 'Spellsword', 'CLASS06.CFG': 'Bard', 'CLASS08.CFG': 'Rogue', 'CLASS13.CFG': 'Archer' };
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const player = () => ({ level: 1, reflexes: 2, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50 }, crimeCommitted: 4 });
/** A foe pool with its host's deps (test/audit68_exterior.test.js's rig, the class careers named). */
const pool = () => createExteriorFoes({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, destroyBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
  fetchBytes: async (n) => { if (CAREERS[n]) return classCfg(CAREERS[n]); throw new Error(`no ${n} in this pin`); },
  getTexture: async () => stubTex, uploadRecordFrame: () => {},
  currentMinute: () => 0, currentPixelKey: () => '3,12',
  playerEntity: player(), audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.9, say: () => {},
});

/** The Assassin, taken in Tristycton Hamlet; `_place_` a building of it (every draw 0.55). The player walks in, the
 *  layout mounts, and the machine runs - its hot-place standing the foe through `standFoe` as worldModes.js's interior
 *  adapter does (interiorFoes.spawnFoe with the behaviour, the marker's feet, questMarker). */
async function assassin() {
  const T = BUILDING_TYPES;
  const blk = rmbBlock('TEST.RMB', [T.House1, T.Tavern, T.GeneralStore, T.House2, T.Temple, T.Armorer].map((type) => ({ type, markers: [mark(SPAWN, 10, 0, 10), mark(SPAWN, 20, 0, 20), mark(ITEM, 5, 0, 5)] })));
  const here = town({ name: 'Tristycton Hamlet', locationIndex: 0, mapId: 777, grid: ['TEST.RMB'] });
  const there = town({ name: 'Chesterwick Hamlet', locationIndex: 1, mapId: 778, grid: ['TEST.RMB'] });
  let inside = null;
  const world = worldOf({ locations: [here, there], blocks: new Map([['TEST.RMB', blk]]), current: here, inside: () => inside });
  const foes = pool();
  const behaviours = [], spawns = [];
  const adapter = {
    currentMapId: () => 777, findBehaviours: () => behaviours,
    standNPC: ({ behaviour }) => { behaviours.push(behaviour); return { setActive() {}, destroy() {}, staticNpcFactionId: 0 }; },
    standItem: ({ behaviour }) => { behaviours.push(behaviour); return null; },
    standFoe: ({ foe, gender, position, behaviour }) => {
      behaviours.push(behaviour);
      spawns.push(foes.spawnFoe(foe.foeType, [position.x, position.y, position.z], { gender, questBehaviour: behaviour, feetGiven: true, questMarker: true }));
      return null;
    },
  };
  world.mountCurrentSiteQuestResources = () => addQuestResourceObjects(machine, adapter, SITE_TYPES.Building, inside.building.buildingKey);
  let now = 0;
  const machine = new QuestMachine({ nowSeconds: () => now, world, getReputation: () => 0, changeReputation: () => {}, changeLegalRep: () => {}, playerGender: () => 'male', playerLevel: () => 5, showPopup: () => {} });
  const quest = machine.scheduleQuest(questScript('A0C00Y08'), 0, { rolls: () => 0.55 });
  machine.tick();
  const site = quest.getPlace({ name: 'place' }).siteDetails;
  inside = { building: { buildingKey: site.buildingKey, name: site.buildingName } };
  addQuestResourceObjects(machine, adapter, SITE_TYPES.Building, site.buildingKey);
  for (let i = 0; i < 3; i++) { now += 1; machine.tick(); }
  const stood = await Promise.all(spawns);
  for (const b of behaviours) b.update();   // the frame's QuestResourceBehaviour.Update: the restraint lands
  const darkbBehaviour = behaviours.find((b) => b.targetResource === quest.getResource({ name: 'darkb' }));
  return { machine, quest, foes, stood, darkbBehaviour, tick: () => { now += 1; machine.tick(); } };
}
const keyOf = (foes, f) => foes.liveTargets().find((t) => t.key === `mobileFoe:${f.uid}`)?.key;
const triggered = (quest, name) => [...quest.tasks.values()].find((t) => t.symbol?.name === name)?.triggered ?? false;

test('QUEST-FOE-LINE, the trace: in the right room Rodyn is hidden and a peaceful Rogue stands on his marker - the plaque names it "Rogue" and, under it, "Quest: The Assassin"; it is the kill the quest counts', async () => {
  const { quest, foes, stood, darkbBehaviour, tick } = await assassin();
  assert.equal(quest.displayName, 'The Assassin');
  assert.equal(quest.getResource({ name: 'darkb' }).isHidden, true, '`hide npc _darkb_`: the named man is gone');
  assert.ok(darkbBehaviour, 'he stood at the layout');
  assert.equal(stood.length, 1, 'one foe hot-placed (`pick one of`)');
  const [f] = stood;
  assert.ok(f, 'the pool stood it');
  const rogue = quest.getResource({ name: 'rogue' });
  assert.equal(f.questBehaviour.targetResource, rogue, 'the Rogue of the four (every draw 0.55)');
  assert.equal(f.ai.isHostile, false, '`restrain foe`: it stands at peace');
  assert.deepEqual(quest.getPlace({ name: 'place' }).siteDetails.selectedMarker.targetResources.map((s) => s.name), ['darkb', 'rogue'], 'on the very marker chosen for him');

  const key = keyOf(foes, f);
  assert.ok(key, 'a live target of the pool');
  assert.deepEqual(foes.liveHoverName(key), { title: 'Rogue', subs: ['Quest: The Assassin'] }, 'its career, and whose it is');
  const frame = resolveHover({ key, distance: 2, reach: 6.4 }, { name: (k) => foes.liveHoverName(k) });
  assert.deepEqual([frame.kind, frame.title, frame.subs], ['name', 'Rogue', ['Quest: The Assassin']], 'the plaque\'s frame: the line is a sub-line under the name');
  // the man himself is no foe: his behaviour says nothing
  assert.equal(questFoeLine(darkbBehaviour), null, 'a quest PERSON carries no line');

  // and it IS the target: the kill fires `killed 1 _rogue_`
  assert.equal(triggered(quest, 'S.07'), false);
  foes.damageFoe(f, 9999, [0, 0, 0], null, { fromPlayer: true, kind: 'spell' });
  await settle();
  assert.equal(f.dead, true);
  f.questBehaviour.update();   // the injured event first - QuestResourceBehaviour.Update returns on it, death next frame
  f.questBehaviour.update();
  tick();
  assert.equal(rogue.killCount, 1);
  assert.equal(triggered(quest, 'S.07'), true, 'the kill the quest counts');
});

test('QUEST-FOE-LINE, the law: a hostile foe says nothing; a foe no quest stood gets no line; nor does a quest\'s foe whose quest has ended, has written no entry, or has no name; the journal\'s title, never its kind', async () => {
  const { quest, foes, stood: [f] } = await assassin();
  const key = keyOf(foes, f);
  // the line is the journal's word for the quest, cut of its kind label as every journal face cuts it
  assert.equal(QUEST_FOE_PREFIX, 'Quest: ');
  quest.displayName = 'Main Quest: The Assassin';
  assert.deepEqual(questFoeSubs(f), ['Quest: The Assassin'], 'ui/questRail.js questTitleOf');
  quest.displayName = 'The Assassin';
  // NOTHING THE JOURNAL HAS NOT SAID
  quest.removeLogStep(0);
  assert.deepEqual(questFoeSubs(f), [], 'a quest with no entry in the journal says nothing');
  quest.addLogStep(0, 1010);
  assert.deepEqual(questFoeSubs(f), ['Quest: The Assassin']);
  quest.displayName = null;
  assert.deepEqual(questFoeSubs(f), [], 'a quest with no display name (28 of the corpus) says nothing');
  quest.displayName = 'The Assassin';
  // a hostile foe is never named at all - HOVER-PLAIN, unchanged
  f.ai.isHostile = true;
  assert.equal(foes.liveHoverName(key), null);
  f.ai.isHostile = false;
  // a plain foe: the frame it always had
  const plain = await foes.spawnFoe(136, [30, 0, 30], { feetGiven: true });
  plain.ai.isHostile = false;
  assert.deepEqual(foes.liveHoverName(keyOf(foes, plain)), { title: 'Rogue', subs: [] }, 'no line on a foe no quest stood');
  assert.deepEqual(questFoeSubs(null), []);
  // the quest's end
  quest.questComplete = true;
  assert.deepEqual(questFoeSubs(f), [], 'a quest that has ended says nothing');
});

test('QUEST-FOE-LINE, the hosts: the interior and the dungeon live-foe arms hand the line; the street\'s is the pool\'s (both above-ground hosts name through it); the watch is no quest\'s; the classic panel draws no name frame', () => {
  // the interior host (scenes/worldModes.js) - the report's own room
  const wm = rd('src/scenes/worldModes.js');
  const interior = wm.slice(wm.indexOf("if (key.startsWith('mobileFoe:')) {\n        const f = liveFoeFor(interiorFoePool(), key, 'mobileFoe');"));
  assert.match(interior.slice(0, 600), /return t \? \{ title: t, subs: questFoeSubs\(f\) \} : null;/, 'the interior arm');
  assert.match(wm, /import \{ questFoeSubs \} from '\.\.\/systems\/questFoeLine\.js';/);
  // the dungeon host
  const dc = rd('src/scenes/dungeonContext.js');
  assert.match(dc, /return t \? \{ title: f\.yielded \? `\$\{t\} - beaten` : t, subs: questFoeSubs\(f\) \} : null;/, 'the dungeon arm');
  // the street: world.js and exterior.js name their live foes through the pool's own liveHoverName (driven above)
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) assert.match(rd(host), /exteriorFoes\.liveHoverName/, `${host} names through the pool`);
  // the watch: no quest stands a watchman (a quest's `create foe` and `place foe` stand into the foe pools)
  assert.doesNotMatch(rd('src/scenes/cityGuards.js'), /questFoeSubs/);
  // the classic skins: their panel draws a pile's rows and nothing else, so the line is the enhanced plaque's alone
  const font = { fnt: { fixedHeight: 7 } };
  assert.equal(drawLootPanel({}, {}, font, { key: 'mobileFoe:1', kind: 'name', title: 'Rogue', subs: ['Quest: The Assassin'], rows: [], rest: 0, empty: false }), false);
});
