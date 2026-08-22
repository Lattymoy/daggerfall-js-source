// Q4-v - THE HOST BRIDGE: the NPC-data law (StaticNPC.SetLayoutData /
// GetPositionHash with the famous nameSeed precedence quirk), the
// QuestMachine.Update pacing (tick at 10 Hz of real time, excess
// DROPPED), the offer-flow guild surface (IsSatisfyQuestReqByLevel's
// two overrides), tokensToRows / offerBoxes (the ServiceFlowWindow
// face of the Q4-ii steps), the end-to-end guild offer over fs-backed
// data seams, clickNpc, ClearState, the save envelope round-trip, and
// the notebook's two DaggerfallDateTime header shapes. The bridge is
// PURE WIRING over the pinned Q1-Q4 law modules; these pins hold the
// wiring itself still.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadQuestTables } from '../src/systems/quest/tables.js';
import {
  positionHash, staticNpcData, SATISFY_QUEST_BY_LEVEL_GROUPS,
  offerGuildSurface, tokensToRows, createQuestBridge, layoutNpcData,
} from '../src/scenes/questBridge.js';
import { ZERO_NPC_DATA, NPC_CONTEXT } from '../src/characters/staticNpc.js';
import { TICKS_PER_SECOND, QUEST_MESSAGES } from '../src/systems/quest/machine.js';
import { FAIL_QUEST_FLAVOUR_ID } from '../src/systems/quest/offerFlow.js';
import { GUILD_GROUPS, SOCIAL_GROUPS } from '../src/formats/factionFile.js';
import { GENDERS } from '../src/characters/nameHelper.js';
import { daySuffix, dateTimeString, midDateTimeString } from '../src/systems/gameDate.js';

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'dfu-quests');
const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');

function loadTables() {
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) {
    if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = read(join(VENDOR, 'Tables', f));
  }
  loadQuestTables(sources);
}
loadTables();

// The offerable quest (the Q4-ii fixture): the three fixed offer
// messages + a bare QBN.
const OFFER_SRC = [
  'Quest: __OFR',
  'DisplayName: The Offered Errand',
  'QRC:',
  `QuestorOffer:  [${QUEST_MESSAGES.QuestorOffer}]`,
  '<ce> Would you fetch the thing?',
  '',
  `RefuseQuest:  [${QUEST_MESSAGES.RefuseQuest}]`,
  '<ce> Bah. Off with you.',
  '',
  `AcceptQuest:  [${QUEST_MESSAGES.AcceptQuest}]`,
  '<ce> Good. The thing awaits.',
  '',
  'QBN:',
  'variable _done_',
];

const LIST_HEAD = 'schema: *name, group, membership, minReq, flag, notes';
const rowsOf = (...rows) => [LIST_HEAD, ...rows].join('\n');

/** A bridge over controlled data seams; extra ctx merges over the
 *  deterministic base. */
function makeBridge(over = {}, listRow = '__OFR, FightersGuild, M, 0, 0, x') {
  return createQuestBridge({
    data: {
      readListTable: (name) => (name === 'Classic' ? rowsOf(listRow) : null),
      getQuestSourceLines: (name) => (name === '__OFR' ? OFFER_SRC : null),
    },
    classicSeconds: () => 0,
    playerEntity: { name: 'Hero', level: 3, gender: 'male' },
    getReputation: () => 0,
    dateTimeString: () => '13:30:00 on 4th of Morning Star, 3E405',
    midDateTimeString: () => '13:30:00 04 Morning Star 3E405',
    cityName: () => 'Daggerfall',
    ...over,
  });
}

// ---------------------------------------------------------------
// The NPC-data law (StaticNPC.cs:210-224, :333-336)
// ---------------------------------------------------------------

test('positionHash: x ^ y<<2 ^ z>>2 - shifts bind tighter than xor, int32 semantics', () => {
  assert.equal(positionHash(10, 3, 9), 10 ^ (3 << 2) ^ (9 >> 2), 'the C# precedence: x ^ (y<<2) ^ (z>>2)');
  assert.equal(positionHash(10, 3, 9), 4);
  // negative z takes C#'s ARITHMETIC shift, exactly what JS >> does
  assert.equal(positionHash(0, 0, -5), -2);
  // y<<2 overflows int32 and wraps - 0x40000000<<2 is 0, not 2^32
  assert.equal(positionHash(0, 0x40000000, 0), 0);
});

test('staticNpcData: the nameSeed precedence quirk - position ^ (buildingKey + locationIndex)', () => {
  const pn = { rawX: 10, rawY: 3, rawZ: 9, flags: 0, factionID: 510, textureArchive: 182, textureRecord: 15, position: 3855 };
  const data = staticNpcData(pn, { mapId: 987, locationIndex: 23, buildingKey: 100 });
  // C# StaticNPC.cs:218: `(int)position ^ buildingKey + locationIndex`
  // - the + binds TIGHTER, so the seed is position ^ (SUM), never
  // (position ^ buildingKey) + locationIndex.
  assert.equal(data.nameSeed, (3855 ^ (100 + 23)) | 0);
  assert.notEqual(data.nameSeed, (3855 ^ 100) + 23, 'the wrong precedence reads differently on these inputs');
  assert.equal(data.hash, positionHash(10, 3, 9));
  assert.equal(data.factionID, 510);
  assert.equal(data.billboardArchiveIndex, 182, 'the questor flat-pick reads these back (Q4-iii)');
  assert.equal(data.billboardRecordIndex, 15);
  assert.equal(data.buildingKey, 100);
  assert.equal(data.mapID, 987);
});

test('staticNpcData gender: flags & 32 exactly - 32 female, 0 male, other bits ignored', () => {
  const at = (flags) => staticNpcData({ flags }, {}).gender;
  assert.equal(at(0), GENDERS.Male);
  assert.equal(at(32), GENDERS.Female);
  assert.equal(at(33), GENDERS.Female, 'bit 32 decides whatever rides beside it');
  assert.equal(at(31), GENDERS.Male, 'all lower bits set is still male');
});

test('staticNpcData: the empty record in the empty context is the all-zeros struct (C# defaults)', () => {
  // AUDIT 24 (the seven-slice sweep): all THIRTEEN fields now, because
  // NPCData is a struct and C# has no partial one. The port's literal
  // carried nine, and the four it dropped were not decoration - `race`
  // is what QuestMCP.Oath's clicked-NPC arm reads, and `context` is
  // what the castle-questor topic gate reads.
  const zero = {
    hash: 0, flags: 0, factionID: 0, billboardArchiveIndex: 0, billboardRecordIndex: 0,
    nameSeed: 0, gender: GENDERS.Male, race: 0, context: 0, mapID: 0,
    locationID: 0, buildingKey: 0, nameBank: 0,
  };
  assert.deepEqual(staticNpcData({}, {}), zero);
  assert.deepEqual(staticNpcData({}), zero, 'the context itself defaults to the zero scene');
  assert.deepEqual(Object.keys(staticNpcData({})).sort(), Object.keys(ZERO_NPC_DATA).sort(),
    'and the mint answers exactly the struct - no field can be quietly dropped again');
  // and `race` is DERIVED, not left at the struct zero: a named faction
  // lends its own, which is what QuestMCP.Oath's clicked-NPC arm reads
  const named = staticNpcData({ factionID: 42 }, {
    getFaction: () => ({ race: 7 }),        // FactionRaces.DarkElf
    raceOfCurrentRegion: () => 3,           // Races.Nord
  });
  assert.equal(named.race, 4, 'FactionRaces 7 is Races.DarkElf (4)');
  const unfactioned = staticNpcData({ factionID: 0 }, { raceOfCurrentRegion: () => 3 });
  assert.equal(unfactioned.race, 3, 'and faction 0 takes the region, as GetRaceFromFaction does');
});

test('AUDIT 24: layoutNpcData is SetLayoutData\'s direct overload - race, context, and the nameSeed fallback', () => {
  // StaticNPC.cs:245-255. Nine fields; it writes NEITHER buildingKey
  // NOR mapID, and it is the only overload that stamps Context.Custom.
  const d = layoutNpcData({
    hash: 77, gender: GENDERS.Female, factionID: 0, nameSeed: -1,
    raceOfCurrentRegion: () => 3,   // Races.Nord
  });
  assert.equal(d.flags, 32, 'female is flags 32, derived from the gender - not carried in');
  assert.equal(d.nameSeed, 77, 'nameSeed -1 falls back to the HASH');
  assert.equal(d.race, 3, 'faction 0 sends GetRaceFromFaction to the region');
  assert.equal(d.context, NPC_CONTEXT.Custom, 'the only overload that stamps one - though Custom is the struct zero anyway');
  assert.equal(d.buildingKey, 0);
  assert.equal(d.mapID, 0);
  const male = layoutNpcData({ hash: 5, gender: GENDERS.Male, nameSeed: 900 });
  assert.equal(male.flags, 0);
  assert.equal(male.nameSeed, 900, 'a real seed stands');
  // a NAMED faction lends its race instead
  const named = layoutNpcData({
    hash: 5, gender: GENDERS.Male, factionID: 42,
    getFaction: () => ({ race: 7 }),          // FactionRaces.DarkElf
    raceOfCurrentRegion: () => 3,
  });
  assert.equal(named.race, 4, 'FactionRaces 7 is Races.DarkElf (4), not the region');
});

// ---------------------------------------------------------------
// QuestMachine.Update pacing (QuestMachine.cs:305-320)
// ---------------------------------------------------------------

test('tick: 1/ticksPerSecond of REAL time; the timer resets to ZERO on fire, dropping the excess', () => {
  assert.equal(TICKS_PER_SECOND, 10, 'QuestMachine.cs ticksPerSecond = 10');
  const bridge = makeBridge();
  assert.equal(bridge.tick(0.05), false, 'under the threshold: no tick');
  assert.equal(bridge.tick(0.06), true, '0.11 accumulated >= 0.1: tick fires');
  // C# sets updateTimer = 0 (not -= interval): the 0.01 excess is GONE
  assert.equal(bridge.tick(0.05), false, 'the excess did not carry - a fresh 0.05 does not fire');
  assert.equal(bridge.tick(0.05), true, 'and the next 0.05 crosses again from zero');
});

// ---------------------------------------------------------------
// The guild surface + the box faces
// ---------------------------------------------------------------

test('IsSatisfyQuestReqByLevel: base false with EXACTLY two overrides - MagesGuild and KnightlyOrder', () => {
  assert.deepEqual([...SATISFY_QUEST_BY_LEVEL_GROUPS].sort((a, b) => a - b),
    [GUILD_GROUPS.MagesGuild, GUILD_GROUPS.KnightlyOrder].sort((a, b) => a - b));
  assert.equal(offerGuildSurface({ guildGroup: GUILD_GROUPS.MagesGuild }).isSatisfyQuestReqByLevel(), true);
  assert.equal(offerGuildSurface({ guildGroup: GUILD_GROUPS.KnightlyOrder }).isSatisfyQuestReqByLevel(), true);
  assert.equal(offerGuildSurface({ guildGroup: GUILD_GROUPS.FightersGuild }).isSatisfyQuestReqByLevel(), false);
  assert.equal(offerGuildSurface({ guildGroup: GUILD_GROUPS.HolyOrder }).isSatisfyQuestReqByLevel(), false);
});

test('offerGuildSurface: membership presence IS isMember; rank/deity/reputation pass through', () => {
  const s = offerGuildSurface({ guildGroup: GUILD_GROUPS.FightersGuild, guild: { divine: 'Kynareth' }, membership: { rank: 4 }, reputation: 17 });
  assert.equal(s.isMember(), true);
  assert.equal(s.rank, 4);
  assert.equal(s.deity, 'Kynareth');
  assert.equal(s.getReputation(), 17);
  const n = offerGuildSurface({ guildGroup: GUILD_GROUPS.FightersGuild, guild: null, membership: null });
  assert.equal(n.isMember(), false);
  assert.equal(n.rank, 0);
  assert.equal(n.deity, '');
  assert.equal(n.getReputation(), 0);
});

test('tokensToRows: text appends, every formatting token breaks, trailing text flushes', () => {
  const t = (text) => ({ formatting: 'text', text });
  const br = { formatting: 'newline' };
  assert.deepEqual(tokensToRows([t('a'), t('b'), br, t('c')]), ['ab', 'c']);
  assert.deepEqual(tokensToRows([t('a'), br]), ['a'], 'a trailing break flushes nothing extra');
  assert.deepEqual(tokensToRows([br]), [''], 'a bare break is one empty row');
  assert.deepEqual(tokensToRows([]), []);
  assert.deepEqual(tokensToRows(null), []);
});

test('offerBoxes: the step-kind mapping - silent faces show nothing, offers carry YesNo recursion', () => {
  const bridge = makeBridge();
  const rows = (id) => [`text:${id}`];
  assert.deepEqual(bridge.offerBoxes(null, rows), []);
  assert.deepEqual(bridge.offerBoxes({ kind: 'close' }, rows), []);
  assert.deepEqual(bridge.offerBoxes({ kind: 'fail', textId: 600 }, rows), [{ rows: ['text:600'] }]);
  assert.deepEqual(bridge.offerBoxes({ kind: 'accepted', popup: null }, rows), [], 'a popupless answer shows nothing (C#)');
  const accepted = { kind: 'accepted', popup: { tokens: [{ formatting: 'text', text: 'Done' }] } };
  assert.deepEqual(bridge.offerBoxes(accepted, rows), [{ rows: ['Done'] }]);
  const step = {
    kind: 'offer',
    prompt: { tokens: [{ formatting: 'text', text: 'Fetch?' }] },
    respond: (yes) => (yes ? accepted : { kind: 'refused', popup: null }),
  };
  const [box] = bridge.offerBoxes(step, rows);
  assert.deepEqual(box.rows, ['Fetch?']);
  assert.equal(box.buttons, 'YesNo');
  assert.deepEqual(box.onYes(), [{ rows: ['Done'] }], 'Yes recurses into the answer step boxes');
  assert.deepEqual(box.onNo(), [], 'a popupless refuse closes silently');
});

test('the bare bridge: absent ctx seams answer the headless charter values', () => {
  const bridge = createQuestBridge({ data: { readListTable: () => null, getQuestSourceLines: () => null } });
  const d = bridge.machine.deps;
  assert.equal(d.nowSeconds(), 0);
  assert.equal(d.playerLevel(), 0);
  assert.equal(d.playerGender(), 'male');
  assert.equal(d.playerName(), null);
  assert.equal(d.playerRaceName(), null);
  assert.equal(d.getReputation(1), 0);
  assert.equal(d.getGold(), 0);
  assert.equal(d.playerHasItem({}), false);
  assert.equal(d.carriesQuestItem({}), false);
  assert.equal(d.isPlayerInTown(), false);
  assert.equal(d.regionPriceAdjustment(), 0);
  assert.equal(d.getGuild(41), null);
  assert.equal(bridge.offerFlow.deps.isPlayerInsideCastle(), false, 'the castle gate reads open by default');
  assert.equal(bridge.offerFlow.deps.getGuildFactionId(5), 0, 'GetGuildFactionId falls to 0 with no seam');
});

// ---------------------------------------------------------------
// The end-to-end guild offer over the data seams
// ---------------------------------------------------------------

test('offerGuildQuest end-to-end: list table -> pool -> offer step -> accept starts the quest', () => {
  const bridge = makeBridge();
  const step = bridge.offerGuildQuest({
    guildGroup: GUILD_GROUPS.FightersGuild,
    guild: { divine: '' }, membership: { rank: 0 }, reputation: 0,
    buildingFactionId: 41,
  });
  assert.equal(step.kind, 'offer');
  assert.match(step.prompt.tokens.map((t) => t.text ?? '').join(''), /Would you fetch the thing\?/);
  const answer = step.respond(true);
  assert.equal(answer.kind, 'accepted');
  assert.match(answer.popup.tokens.map((t) => t.text ?? '').join(''), /The thing awaits/);
  const quests = [...bridge.machine.quests.values()];
  assert.equal(quests.length, 1, 'the accepted quest is LIVE in the machine');
  assert.equal(quests[0].questName, '__OFR');
});

test('the lists ride DFU PlayerNudity OFF - an adult (X) row never pools, the offer fails', () => {
  const bridge = makeBridge({}, '__OFR, FightersGuild, M, 0, X, x');
  const step = bridge.offerGuildQuest({ guildGroup: GUILD_GROUPS.FightersGuild, guild: { divine: '' }, membership: { rank: 0 }, reputation: 0 });
  assert.equal(step.kind, 'fail');
  assert.equal(step.textId, FAIL_QUEST_FLAVOUR_ID);
});

test('offerGuildQuest: buildingFactionId defaults to 0 - the variant groups home there', () => {
  // HolyOrder/KnightlyOrder home the quest's factionId on the BUILDING
  // faction (Q4-ii); with none passed, the C# zero rides through to
  // the started quest.
  const bridge = makeBridge({}, '__OFR, KnightlyOrder, M, 0, 0, x');
  const step = bridge.offerGuildQuest({ guildGroup: GUILD_GROUPS.KnightlyOrder, guild: { divine: '' }, membership: { rank: 0 }, reputation: 0 });
  assert.equal(step.kind, 'offer');
  step.respond(true);
  assert.equal([...bridge.machine.quests.values()][0].factionId, 0);
});

test('the vendored pack answers the bridge data contract from disk (the questData shape)', () => {
  // The same seams scenes/questData.js serves in the browser, fs-backed
  // here: QuestList-Classic exists and __A0C00Y00 parses to lines.
  const pack = {
    readListTable: (name) => { try { return read(join(VENDOR, 'Tables', `QuestList-${name}.txt`)); } catch { return null; } },
    getQuestSourceLines: (name) => { try { return read(join(VENDOR, 'Quests', `${name}.txt`)).split(/\r?\n/); } catch { return null; } },
  };
  assert.ok(pack.readListTable('Classic')?.length > 0, 'QuestList-Classic.txt is in the pack');
  assert.ok(pack.getQuestSourceLines('M0B00Y16')?.length > 0, 'a classic quest source reads as lines');
  assert.equal(pack.readListTable('NoSuchList'), null);
});

// ---------------------------------------------------------------
// clickNpc + ClearState + the save envelope
// ---------------------------------------------------------------

test('mountScene rides the Q4-iii walk: siteType/mapId/buildingKey reach getSiteLinks (default 0)', () => {
  const bridge = makeBridge();
  const calls = [];
  bridge.machine.getSiteLinks = (...a) => { calls.push(a); return []; };
  bridge.mountScene({ currentMapId: () => 77 }, 3, 40);
  bridge.mountScene({ currentMapId: () => 77 }, 3);
  assert.deepEqual(calls, [[3, 77, 40], [3, 77, 0]], 'the C# zero default rides when the host passes none');
});

test('clickNpc derives the NPCData and stamps LastNPCClicked on the machine', () => {
  const bridge = makeBridge();
  const pn = { rawX: 1, rawY: 2, rawZ: 3, flags: 32, factionID: 510, textureArchive: 182, textureRecord: 15, position: 777 };
  const data = bridge.clickNpc(pn, { mapId: 55, locationIndex: 9, buildingKey: 40 });
  assert.equal(bridge.machine.getLastNPCClicked(), data, 'the stamp IS the derived record');
  assert.equal(data.nameSeed, (777 ^ (40 + 9)) | 0);
  assert.equal(data.gender, GENDERS.Female);
  assert.equal(data.mapID, 55);
});

test('clearState (QuestMachine.cs:533-546): quests, siteLinks, questsToInvoke, lastNPCClicked wipe', () => {
  const bridge = makeBridge();
  const step = bridge.offerGuildQuest({ guildGroup: GUILD_GROUPS.FightersGuild, guild: { divine: '' }, membership: { rank: 0 }, reputation: 0 });
  step.respond(true);
  bridge.clickNpc({ position: 1 }, {});
  assert.equal(bridge.machine.quests.size, 1);
  assert.notEqual(bridge.machine.getLastNPCClicked(), null);
  bridge.machine.clearState();
  assert.equal(bridge.machine.quests.size, 0);
  assert.deepEqual(bridge.machine.siteLinks, []);
  assert.deepEqual(bridge.machine.questsToInvoke, []);
  assert.equal(bridge.machine.lastNPCClicked, null);
});

test('snapshot/restore: the whole envelope round-trips into a fresh bridge as a fixed point', () => {
  const a = makeBridge();
  const step = a.offerGuildQuest({ guildGroup: GUILD_GROUPS.FightersGuild, guild: { divine: '' }, membership: { rank: 0 }, reputation: 0 });
  step.respond(true);
  a.notebook.addNote('The bridge remembers.');
  a.questLists.oneTimeQuestsAccepted = ['__ONCE'];
  const snap = a.snapshot();
  assert.equal(snap.machine.quests.length, 1);
  assert.deepEqual(snap.oneTimeQuestsAccepted, ['__ONCE']);

  const b = makeBridge();
  b.restore(structuredClone(snap));
  assert.equal(b.machine.quests.size, 1);
  assert.equal([...b.machine.quests.values()][0].questName, '__OFR');
  assert.deepEqual(b.questLists.oneTimeQuestsAccepted, ['__ONCE']);
  assert.match(JSON.stringify(b.notebook.getSaveData()), /The bridge remembers\./);
  assert.deepEqual(b.snapshot(), snap, 'restore(snapshot) is a fixed point');
});

test('restore clears the live machine first (the C# load path), and restore(null) is a no-op', () => {
  const bridge = makeBridge();
  const step = bridge.offerGuildQuest({ guildGroup: GUILD_GROUPS.FightersGuild, guild: { divine: '' }, membership: { rank: 0 }, reputation: 0 });
  step.respond(true);
  const snap = bridge.snapshot();
  // restoring over a LIVE machine must not collide with the standing
  // quest ('An item with the same key has already been added') - the
  // ClearState call is what stands between restore and that throw.
  bridge.restore(structuredClone(snap));
  assert.equal(bridge.machine.quests.size, 1, 'one quest, not a duplicate-uid casualty');
  bridge.restore(null);
  assert.equal(bridge.machine.quests.size, 1, 'restore(null) leaves the machine standing');
});

test('the tombstone filing wires into the notebook (ctx.addFinishedQuest -> PlayerNotebook)', () => {
  const bridge = makeBridge();
  const msg = {
    parentQuest: { displayName: 'The Wired Errand', questSuccess: true },
    getTextTokens: () => [{ formatting: 'text', text: 'won' }],
  };
  bridge.machine.deps.addFinishedQuest([msg]);
  const filed = JSON.stringify(bridge.notebook.getSaveData().finishedQuestEntries);
  assert.match(filed, /The Wired Errand/);
  assert.match(filed, /won/);
});

test('onQuestStarted fans to the one-time recording AND the ctx listener', () => {
  const seen = [];
  const bridge = makeBridge({ onQuestStarted: (q) => seen.push(q.questName) });
  bridge.questLists.oneTimeQuestsAccepted = [];
  bridge.machine.deps.onQuestStarted({ oneTime: true, questName: '__1X' });
  assert.deepEqual(bridge.questLists.oneTimeQuestsAccepted, ['__1X'], 'noteQuestStarted recorded the one-time');
  assert.deepEqual(seen, ['__1X'], 'the extra listener heard it too');
});

// ---------------------------------------------------------------
// The notebook's DaggerfallDateTime header shapes (gameDate Q4-v)
// ---------------------------------------------------------------

test('daySuffix (DaggerfallDateTime.cs:641-652): st/nd/rd only on 1/21, 2/22, 3/23', () => {
  assert.equal(daySuffix(1), 'st');
  assert.equal(daySuffix(21), 'st');
  assert.equal(daySuffix(2), 'nd');
  assert.equal(daySuffix(22), 'nd');
  assert.equal(daySuffix(3), 'rd');
  assert.equal(daySuffix(23), 'rd');
  assert.equal(daySuffix(4), 'th');
  assert.equal(daySuffix(11), 'th', 'C# has no teens rule - 11 takes th because only 1/21 take st');
});

test('DateTimeString: day UNPADDED, the {5:00} spec dropped on the month-name string', () => {
  const d = { year: 405, month: 0, day: 3, hour: 13, minute: 30, second: 0 };
  assert.equal(dateTimeString(d), '13:30:00 on 4th of Morning Star, 3E405');
});

test('MidDateTimeString: the day IS padded ({3:00} on the int), no suffix, no comma', () => {
  const d = { year: 405, month: 0, day: 3, hour: 13, minute: 30, second: 0 };
  assert.equal(midDateTimeString(d), '13:30:00 04 Morning Star 3E405');
  const late = { year: 405, month: 11, day: 24, hour: 9, minute: 5, second: 59 };
  assert.equal(midDateTimeString(late), '09:05:59 25 Evening Star 3E405');
  assert.equal(dateTimeString(late), '09:05:59 on 25th of Evening Star, 3E405');
});

test('the pad TRUNCATES fractional components (the live clock hands fractional minutes through)', () => {
  // C#'s Hour/Minute/Second are ints; the port's dateFromClassicMinutes
  // can carry a fractional second off the ticker - {0:00} must floor,
  // never round 59.9 up to the impossible '60'.
  const d = { year: 405, month: 0, day: 0, hour: 13, minute: 30, second: 59.9 };
  assert.equal(dateTimeString(d), '13:30:59 on 1st of Morning Star, 3E405');
});

// ---------------------------------------------------------------
// TK-iv/TK-v: THE QUESTOR DOOR through the bridge
// ---------------------------------------------------------------

test('offerSocialQuest: the questor door lands on Q4-iis social arm, and spends the pool entry', () => {
  // TalkToStaticNPC opens DaggerfallQuestOfferWindow instead of the
  // talk window when the clicked NPC is carrying work (:758-770). The
  // bridge is the wire between the NPC session's pool and the offer
  // flow that has been waiting for it since Q4-ii.
  const spent = [];
  // a MERCHANTS row, not a guild one - the social pool is keyed by
  // FactionFile's SocialGroups names
  const bridge = makeBridge({ removeNpcQuestor: (seed) => spent.push(seed) },
    '__OFR, Merchants, M, 0, 0, x');
  const step = bridge.offerSocialQuest({ factionID: 41, nameSeed: 77, gender: GENDERS.Male }, SOCIAL_GROUPS.Merchants, true);
  assert.equal(step.kind, 'offer', 'a social questor offers from the Classic pool');
  assert.deepEqual(spent, [77], 'and the potential questor leaves the work pool BEFORE the offer resolves');
  const answer = step.respond(true);
  assert.equal(answer.kind, 'accepted');
  assert.equal([...bridge.machine.quests.values()].length, 1, 'the accepted quest is LIVE');
});

test('the questor door stays SHUT for an NPC already questoring an active quest', () => {
  const spent = [];
  const bridge = makeBridge({ removeNpcQuestor: (seed) => spent.push(seed) },
    '__OFR, Merchants, M, 0, 0, x');
  // an active questor: the machine's last-clicked NPC IS a running
  // quest's questor
  const step0 = bridge.offerSocialQuest({ factionID: 41, nameSeed: 77, gender: GENDERS.Male }, SOCIAL_GROUPS.Merchants, true);
  step0.respond(true);
  const quest = [...bridge.machine.quests.values()][0];
  const questor = [...quest.resources.values()].find((r) => r.isPerson && r.isQuestor);
  if (questor) {
    bridge.machine.setLastNPCClicked(questor.questorData);
    const step = bridge.offerSocialQuest({ factionID: 41, nameSeed: 78, gender: GENDERS.Male }, SOCIAL_GROUPS.Merchants, true);
    assert.equal(step.kind, 'close', 'the door closes silently on an active questor');
    assert.deepEqual(spent, [77, 78], 'but the pool entry is spent FIRST, either way - C#s ctor half');
  }
});
