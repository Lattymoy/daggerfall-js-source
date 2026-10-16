// SUMMON-OFFER (bible/01-Overview/bugs/Field-Bugs-2026-10-14.md; a player on the Discord, "Daedra Summoning bugged":
// "Summoned Hermaeus Mora at the Mages Guild online, paid 100k. No video, no offer, no message. The save now has
// Hermaeus Mora (faction 8) flags = 65 (Summoned set), and quest W0C00Y00 is not among the active quests" - and, after:
// "trying to summon Mora in the Dak'Fron region - which does not meet the requirements for the quest").
//
// DFU's ConfirmSummon_OnButtonClick spends the gold, sets the Summoned flag, and only then asks GetQuest for the
// prince's quest; GetQuest answers null when the parse throws, and W0C00Y00's `Place _palace_ remote palace` throws in a
// region without a palace. Nothing was shown, the gold was gone, and the flag turned every later summoning of him into
// "You have summoned %dae once". Here the quest is asked for where DFU asks and the decision is its step's: no step,
// nothing spent and nothing recorded, and the summoner says so.
//
// Over the real producers: the vendored W0C00Y00 through the real bridge, QuestMachine, QuestListsManager and offer
// flow, in one crafted region with a palace and the same region without one (test/fb1004dTowns.mjs's shapes - the
// MAPS.BSA directory, the RMB blocks and their quest markers, a dungeon's RDB block); the real faction store.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTables, rmbBlock, rdbBlock, town, dungeon, worldOf, mark, SPAWN, ITEM } from '../fb1004dTowns.mjs';
import { createQuestBridge } from '../../src/scenes/quest/questBridge.js';
import { FACTION_TYPES } from '../../src/formats/factionFile.js';
import { DAEDRA, SHEOGORATH_INDEX, attemptSummoning, noQuestText } from '../../src/systems/daedraSummoning.js';
import { FACTION_FLAGS, ensureFactionRep, getFlag } from '../../src/systems/faction/factionRep.js';

loadTables();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const QUESTS = join(ROOT, 'vendor/dfu-quests/Quests');
const TABLES = join(ROOT, 'vendor/dfu-quests/Tables');
const MAGES_GUILD = 40;
const HERMAEUS = DAEDRA.find((d) => d.name === 'Hermaeus Mora');
const MERIDIA = DAEDRA.find((d) => d.name === 'Meridia');

/** One region: the player in the Mages Guild's town; a town with a library, one of houses, one whose block stands a
 *  palace - or, `palace: false`, a house where the palace stood (Dak'fron's lack) - and a dungeon. Each building's
 *  interior carries a quest spawn and item marker; the directory lists what the blocks hold, as MAPS.BSA's does. */
function region({ palace }) {
  const both = [mark(SPAWN, 10, 0, 10), mark(ITEM, 20, 0, 20)];
  const blocks = new Map([
    ['GUILD.RMB', rmbBlock('GUILD.RMB', [{ type: 12, markers: both }, { type: 17, markers: both }])],
    ['LIB.RMB', rmbBlock('LIB.RMB', [{ type: 10, markers: both }, { type: 17, markers: both }, { type: 18, markers: both }])],
    ['HOUSES.RMB', rmbBlock('HOUSES.RMB', [{ type: 17, markers: both }, { type: 18, markers: both }, { type: 19, markers: both }])],
    ['CROWN.RMB', rmbBlock('CROWN.RMB', [{ type: palace ? 16 : 17, markers: both }])],
    ['DUNG.RDB', rdbBlock()],
  ]);
  const locations = [
    town({ name: 'Guildtown', locationIndex: 0, mapId: 1000, grid: ['GUILD.RMB'] }),
    town({ name: 'Libton', locationIndex: 1, mapId: 1001, grid: ['LIB.RMB'] }),
    town({ name: 'Houseby', locationIndex: 2, mapId: 1002, grid: ['HOUSES.RMB'] }),
    town({ name: 'Crownhold', locationIndex: 3, mapId: 1003, grid: ['CROWN.RMB'] }),
    dungeon({ name: 'Deepkeep', locationIndex: 4, mapId: 1004, dungeonType: 0 }),
  ];
  for (const l of locations) {
    l.exterior.buildings = l.exterior.exteriorData.blockNames.flatMap((n) => blocks.get(n).rmbBlock.fldHeader.buildingDataList.map((b) => ({ ...b })));
  }
  const world = worldOf({ locations, blocks, current: locations[0] });
  const any = world.getFactionData;
  // Hermaeus Mora is FACTION.TXT's Daedra (type 0) - SetupIndividualNPC refuses a named NPC of any other type
  world.getFactionData = (id) => (id === HERMAEUS.factionId ? { id, type: FACTION_TYPES.Daedra, name: HERMAEUS.name, race: -1 } : any(id));
  return world;
}

/** The real bridge over `world` and the vendored corpus - the one the street hosts build. */
const bridgeOver = (world) => createQuestBridge({
  data: {
    readListTable: (n) => (existsSync(join(TABLES, `${n}.txt`)) ? readFileSync(join(TABLES, `${n}.txt`), 'utf8') : ''),
    getQuestSourceLines: (n) => {
      const f = join(QUESTS, `${n}.txt`);
      return existsSync(f) ? readFileSync(f, 'utf8').replace(/^﻿/, '').split(/\r?\n/) : null;
    },
  },
  world, classicSeconds: () => 0, playerEntity: { level: 1, name: 'Tester' },
});
/** `fn` with the quest log's warnings caught, and them. */
function heard(fn) {
  const said = [];
  const w = console.warn, i = console.info;
  console.warn = (...a) => said.push(a.join(' ')); console.info = () => {};
  try { return { value: fn(), said }; } finally { console.warn = w; console.info = i; }
}
/** The summoning rolls: Sheogorath stays away (100 > 5), the prince answers (1 <= 60). */
const answers = () => { const v = [0.99, 0]; let n = 0; return () => v[Math.min(n++, v.length - 1)]; };

test('SUMMON-OFFER: the producer - the bridge offers Hermaeus Mora\'s W0C00Y00 in a region with a palace, and offers NOTHING (no step) in the same region without one, the parse refused at _palace_', () => {
  const withPalace = bridgeOver(region({ palace: true }));
  const yes = heard(() => withPalace.offerDaedricQuest(HERMAEUS.quest, MAGES_GUILD));
  assert.equal(yes.value?.kind, 'offer', 'a palace in the region: the offer');
  assert.equal(withPalace.offerFlow.offeredQuest?.questName, 'W0C00Y00');

  const without = bridgeOver(region({ palace: false }));
  const no = heard(() => without.offerDaedricQuest(HERMAEUS.quest, MAGES_GUILD));
  assert.equal(no.value, null, 'no palace: no quest, and no step - not a silent close step the summoning would take for an offer');
  assert.equal(without.offerFlow.offeredQuest, null);
  assert.ok(no.said.some((s) => /Search failed to locate matching remote site for Place _palace_/.test(s)),
    'and it is the region that refused it - the palace, as the player\'s Dak\'fron');
});

test('SUMMON-OFFER: the summoning - where his quest cannot be made he is not recorded and nothing is to be spent; where it can, DFU\'s outcome, the offer in hand', () => {
  const summon = (bridge, store) => heard(() => attemptSummoning({
    daedra: HERMAEUS, summonerRep: 100, gold: 150000, rolls: answers(),
    hasSummoned: (fid) => getFlag(store, fid, FACTION_FLAGS.Summoned),
    offerQuest: (questName) => bridge.offerDaedricQuest(questName, MAGES_GUILD),
  })).value;

  // Dak'fron: no palace. The player's store as the report's save holds it before the summoning - FACTION.TXT's own
  // 0x01 on faction 8, no Summoned (65 after the bug: 0x41)
  const store = ensureFactionRep({}, new Map([[HERMAEUS.factionId, { id: HERMAEUS.factionId, flags: 0x01, rep: 0 }]]));
  assert.equal(getFlag(store, HERMAEUS.factionId, FACTION_FLAGS.Summoned), false, 'a first summoning of him');
  const none = summon(bridgeOver(region({ palace: false })), store);
  assert.equal(none.kind, 'noQuest', 'the prince answered, and his quest cannot be made here');
  assert.equal(none.daedra, HERMAEUS);
  assert.equal(none.quest, 'W0C00Y00');
  assert.equal('flag' in none, false, 'no Summoned flag to record');
  assert.match(noQuestText(none.daedra), /^Hermaeus Mora answers, but has no task for you in this region\. You keep your gold/,
    'and the summoner says why, and that the gold stays');

  // the same summoning where a palace stands: the quest, flagged, and its offer
  const some = summon(bridgeOver(region({ palace: true })), store);
  assert.equal(some.kind, 'quest');
  assert.equal(some.cost, 100000, 'the summoner\'s price - rep 100 - spent on this outcome alone of the two');
  assert.equal(some.flag, FACTION_FLAGS.Summoned);
  assert.equal(some.offered?.kind, 'offer', 'the offer step the film window reads');
});

test('SUMMON-OFFER: the quest is asked for where DFU asks - for the prince who ANSWERED, never on a missed roll, never for one met before', () => {
  const asked = [];
  const offerQuest = (q) => { asked.push(q); return null; };
  // Sheogorath gatecrashes (1 <= 5) and answers (1 <= 30 + 0 + 0): his quest is the one asked for
  const sheo = attemptSummoning({ daedra: MERIDIA, gold: 1e6, rolls: () => 0, offerQuest });
  assert.equal(sheo.kind, 'noQuest');
  assert.equal(sheo.daedra, DAEDRA[SHEOGORATH_INDEX]);
  assert.deepEqual(asked, ['60C00Y00'], 'the Mad One\'s quest, not Meridia\'s');
  // a missed roll asks nothing: the failure is DFU's, and paid
  asked.length = 0;
  const missed = attemptSummoning({ daedra: MERIDIA, gold: 1e6, rolls: () => 0.99, offerQuest });
  assert.equal(missed.kind, 'failed');
  assert.deepEqual(asked, []);
  // a prince met before greets, and no quest is made
  const before = attemptSummoning({ daedra: MERIDIA, gold: 1e6, rolls: answers(), hasSummoned: () => true, offerQuest });
  assert.equal(before.kind, 'greeting');
  assert.deepEqual(asked, []);
});

test('SUMMON-OFFER: the host - the quest is made inside the Yes, through the bridge, and the no-quest answer returns before the gold is spent or the prince recorded; one quest a summoning', () => {
  const wm = readFileSync(join(ROOT, 'src/scenes/worldModes.js'), 'utf8');
  const yes = wm.indexOf('const summon = (called) => {');
  const ask = wm.indexOf('offerQuest: (questName) => questBridge?.offerDaedricQuest?.(questName, summonerId) ?? null,');
  const roll = wm.indexOf('const r = attemptSummoning({');
  const none = wm.indexOf("if (r.kind === 'noQuest') return { rows: [{ text: noQuestText(r.daedra), center: true }] };");
  const pay = wm.indexOf('deductGold(playerEntity, r.cost);');
  const record = wm.indexOf('setFlag(store, r.daedra.factionId, r.flag);');
  const offered = wm.indexOf('const offered = r.offered;');
  assert.ok(yes > 0 && yes < roll && roll < ask, 'the summoning law is handed the bridge\'s offer');
  assert.ok(ask < none && none < pay && pay < record && record < offered,
    'no quest: answered before the gold and the flag; a quest: paid, recorded, then offered');
  assert.equal(wm.split('offerDaedricQuest').length, 2, 'the quest is made once - the law\'s ask - and never again after the gold');
  assert.equal(wm.slice(none, pay).includes('deductGold'), false);
});
