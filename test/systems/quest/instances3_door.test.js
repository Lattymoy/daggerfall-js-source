// INSTANCES (2026-10-15, Mac: "The player approaches, should be met with an enhanced UI popup that lets them select
// public or instanced (if applicable)" - where: "Dungeons with your quest", "Privateer's Hold", "Building interiors";
// bible/11-Multiplayer/Instances.md): THE DOOR. Its law (systems/instancePlaces.js) over the real QuestMachine and Place,
// its page half (scenes/instanceDoor.js) with the real ChoiceWindow and the real digests, the modes host's funnel
// executed from its source, and the sizes a quest's markers and an instance build at (world/smallerDungeons.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parse } from 'acorn';
import { QuestMachine } from '../../../src/systems/quest/machine.js';
import { Place, SITE_TYPES } from '../../../src/systems/quest/place.js';
import { loadQuestTables } from '../../../src/systems/quest/tables.js';
import { relayQuestOnline, repairActiveQuests, questElsewhereLine } from '../../../src/systems/quest/questRepair.js';
import { questsAtSite, openerQuestOf, questMountsHere, questDungeonWhole, partnerInstances, instanceOffer, questInstanceEpoch } from '../../../src/systems/instancePlaces.js';
import { createInstanceDoor, INSTANCE_TEXT, dungeonSite, buildingSite, siteBase } from '../../../src/scenes/instanceDoor.js';
import { instanceRoomOf, instanceWord, INSTANCE_DOOR_WORD } from '../../../src/net/instanceRoom.js';
import { wdunRoomKey } from '../../../src/net/wire.js';
import { makeAnchor, WORLD_CONTEXT } from '../../../src/systems/teleportAnchor.js';
import { dungeonSizeFor, smallerDungeonsStateNow, SMALLER_DUNGEONS_STATE, ONLINE_DUNGEONS_STATE, onlineDungeonSize } from '../../../src/world/smallerDungeons.js';
import { isPrivateersHold, HOLD_ONCE_TEXT } from '../../../src/systems/startDungeon.js';
import { PRIVATEERS_HOLD_MAP_ID } from '../../../src/world/dungeon/dungeonTextures.js';
import { RDB_RESOURCE_TYPES } from '../../../src/formats/blocksFile.js';
{
  const dir = new URL('../../../vendor/dfu-quests/Tables/', import.meta.url);
  const sources = {};
  for (const f of readdirSync(dir)) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = readFileSync(new URL(f, dir), 'utf8').replace(/^﻿/, '');
  loadQuestTables(sources);
}
const read = (f) => readFileSync(new URL(`../../../${f}`, import.meta.url), 'utf8');
const hex = (s, bytes) => createHash('sha256').update(s).digest('hex').slice(0, bytes * 2);
const sym = (name) => ({ name, original: `_${name}_`, clone() { return sym(name); } });
const BARE_SRC = ['Quest: __INS', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'variable _done_'];

/** A running quest of the real machine whose Place `crypt` names `site` (siteDetails as Place's own selects set them). */
function questAt(m, site) {
  const q = m.parseQuestForLists(BARE_SRC, 0, { rolls: () => 0 });
  m.startQuestImmediate(q);
  const p = new Place(q);
  p.symbol = sym('crypt');
  p.siteDetails = { siteType: site.siteType, mapId: site.mapId, buildingKey: site.buildingKey ?? 0, regionIndex: 3, locationName: 'Ruins', magicNumberIndex: 0, selectedMarker: { targetResources: null }, questSpawnMarkers: null, questItemMarkers: null };
  q.resources.set('crypt', p);
  return q;
}
const CRYPT = { siteType: SITE_TYPES.Dungeon, mapId: 52646490 };   // Ruins of The Hold of Coppering (Isle of Balfiera)
const SHOP = { siteType: SITE_TYPES.Building, mapId: 206728581, buildingKey: 131590 };

test('INSTANCES the door\'s law: a running quest whose Place names the site - a dungeon by its map id, a building by its key; the oldest opens the room; an ended, set-aside or moved one names none', () => {
  const m = new QuestMachine();
  assert.deepEqual(questsAtSite(m, CRYPT), []);
  const a = questAt(m, CRYPT), b = questAt(m, CRYPT), c = questAt(m, SHOP);
  assert.deepEqual(questsAtSite(m, CRYPT).map((q) => q.uid).sort(), [a.uid, b.uid].sort());
  assert.equal(openerQuestOf(m, CRYPT), a.uid < b.uid ? a : b, 'the oldest - two quests at one dungeon share one room');
  assert.deepEqual(questsAtSite(m, SHOP), [c]);
  assert.deepEqual(questsAtSite(m, { ...SHOP, buildingKey: 5 }), [], 'another building of the town');
  assert.deepEqual(questsAtSite(m, { siteType: SITE_TYPES.Building, mapId: CRYPT.mapId, buildingKey: 1 }), [], 'a dungeon Place names no building');
  assert.deepEqual(questsAtSite(m, { ...CRYPT, mapId: -CRYPT.mapId }), [], 'the map id read unsigned');
  c.resources.get('crypt').siteDetails.unseated = { buildingKey: SHOP.buildingKey };
  assert.deepEqual(questsAtSite(m, SHOP), [], 'RESEAT-GAPS: a site unseated from its key names none');
  a.questComplete = true;
  b.shelvedAt = 1;
  assert.deepEqual(questsAtSite(m, CRYPT), [], 'ended, set aside');
  assert.equal(openerQuestOf(m, CRYPT), null);
});

test('INSTANCES where a quest\'s things stand: online only in a dungeon whole; offline as DFU\'s frozen size builds. The whole public room is the fallback where no instance can be had', () => {
  assert.equal(questMountsHere({ online: true, builtSize: 'full' }), true);
  assert.equal(questMountsHere({ online: true, builtSize: 'medium' }), false);
  assert.equal(questMountsHere({ online: true, builtSize: 'small' }), false);
  assert.equal(questMountsHere({ online: false, builtSize: 'small' }), true);
  assert.equal(questDungeonWhole({ online: true, instanceOk: false, questHere: true }), true, 'Mac\'s first answer, the fallback');
  assert.equal(questDungeonWhole({ online: true, instanceOk: true, questHere: true }), false, 'the door chooses');
  assert.equal(questDungeonWhole({ online: true, instanceOk: false, questHere: false }), false);
  assert.equal(questDungeonWhole({ online: false, instanceOk: false, questHere: true }), false);
});

test('INSTANCES the sizes: online the quest\'s world and an instance ask for the dungeon whole; the public room keeps the world\'s size; a quest started online is stamped DFU\'s Disabled', () => {
  const loc = { name: 'Ruins of The Hold of Coppering', hasDungeon: true, mapTableData: { mapId: 52646490 }, dungeon: { blocks: Array.from({ length: 13 }, (_, i) => ({ blockName: `N${i}.RDB` })) } };
  assert.equal(onlineDungeonSize(loc), 'medium', 'the world builds it medium (the probe: its entrance walks into a cap)');
  assert.equal(dungeonSizeFor(loc, { online: true }), 'medium');
  assert.equal(dungeonSizeFor(loc, { online: true, whole: true }), 'full');
  assert.equal(dungeonSizeFor(loc, { online: false, whole: true, setting: true }), 'small', 'offline `whole` asks nothing - the settings and DFU\'s frozen size rule');
  assert.equal(smallerDungeonsStateNow(false, false, true, false), SMALLER_DUNGEONS_STATE.Disabled);
  assert.equal(smallerDungeonsStateNow(false, false, false, true), ONLINE_DUNGEONS_STATE, 'offline, the world\'s sizes asked for, as before');
});

test('INSTANCES the load\'s re-lay: a quest stamped at any size but the whole has its dungeon\'s markers enumerated again on the dungeon whole (its world asks so) and is stamped Disabled', () => {
  const m = new QuestMachine();
  const q = questAt(m, { siteType: SITE_TYPES.Dungeon, mapId: 4242 });
  const flat = (x) => ({ type: RDB_RESOURCE_TYPES.Flat, position: x, xPos: x, yPos: 0, zPos: 0, resources: { flatResource: { textureArchive: 199, textureRecord: 11 } } });
  const blockData = { 'N1.RDB': { position: 1000, rdbBlock: { objectRootList: [{ rdbObjects: [flat(1)] }] } }, 'N2.RDB': { position: 2000, rdbBlock: { objectRootList: [{ rdbObjects: [flat(2)] }] } } };
  const whole = { name: 'Ruins', regionIndex: 3, hasDungeon: true, mapTableData: { mapId: 4242 }, dungeon: { blocks: [{ blockName: 'N1.RDB', x: 0, z: 0 }, { blockName: 'N2.RDB', x: 1, z: 0 }] } };
  q.hooks = { ...(q.hooks ?? {}), world: { getBlock: (n) => blockData[n] ?? null, maps: { getRegion: () => ({ mapNameLookup: new Map([['Ruins', 0]]) }), getLocation: () => whole } } };
  q.smallerDungeonsState = ONLINE_DUNGEONS_STATE;
  assert.equal(relayQuestOnline(q), true);
  assert.equal(q.smallerDungeonsState, SMALLER_DUNGEONS_STATE.Disabled);
  assert.deepEqual(q.resources.get('crypt').siteDetails.questSpawnMarkers.map((k) => [k.dungeonX, k.markerID]), [[0, 1001], [1, 2002]], 'the whole dungeon\'s markers');
  assert.equal(relayQuestOnline(q), false, 'again: nothing');
});

test('INSTANCES a quest\'s instance is its own for its life: its epoch minted once and kept by its save - never its uid, which a later quest is minted again after a reload; a partner\'s copy mints its own and a resync keeps it (mutants: minted every entry; the save forgets it; a copy takes the sender\'s; a resync takes the partner\'s)', () => {
  const m = new QuestMachine();
  const q = questAt(m, CRYPT);
  let n = 0;
  const rand = () => ['aaaaaaaa', 'bbbbbbbb', 'cccccccc'][n++];
  assert.equal(q.instanceEpoch, null, 'no room until one opens');
  assert.equal(questInstanceEpoch(null, rand), null);
  assert.equal(questInstanceEpoch(q, rand), 'aaaaaaaa');
  assert.equal(questInstanceEpoch(q, rand), 'aaaaaaaa', 'minted once: every entry of its life one room');
  const data = JSON.parse(JSON.stringify(q.getSaveData()));
  assert.equal(data.instanceEpoch, 'aaaaaaaa');
  const reloaded = new QuestMachine();
  reloaded.restoreSaveData(JSON.parse(JSON.stringify(m.getSaveData())));
  assert.equal(reloaded.getQuest(q.uid).instanceEpoch, 'aaaaaaaa', 'the save keeps it');
  // the defect this closes: an ended quest leaves the machine, and nextUid restarts past the uids a save still holds -
  // so a later quest is minted a finished one's uid. Its room is still its own.
  const later = questAt(new QuestMachine(), CRYPT);
  later.uid = q.uid;
  assert.equal(questInstanceEpoch(later, rand), 'bbbbbbbb', 'the same uid, another quest, another room');
  // a party member's copy
  const friend = new QuestMachine();
  const copy = friend.receiveSharedQuest(data);
  assert.ok(copy);
  assert.equal(copy.instanceEpoch, null, 'a copy is my own quest - never the sender\'s epoch');
  assert.equal(questInstanceEpoch(copy, rand), 'cccccccc');
  friend.updateSharedQuest(copy.questName, data);
  assert.equal(friend.getQuest(copy.uid).instanceEpoch, 'cccccccc', 'a resync keeps the copy\'s own');
});

test('INSTANCES a partner\'s instance at this place: a member standing in an instance ROOM whose public room is this place\'s - matched by the room, never a pixel (Castle Daggerfall and the arena share one) - and whose OWNER is in the party; one row a room, named by its owner; a member away, elsewhere, in the public room or in a stranger\'s room is none', () => {
  const ann = '0123456789abcdef', fi = 'fedcba9876543210', stranger = '1111111111111111';
  const owners = { a1: ann, a6: fi, a2: '2222222222222222', a3: '3333333333333333', a4: '4444444444444444', a5: '5555555555555555', a7: '7777777777777777' };
  const ownerOf = (acct) => owners[acct] ?? null;
  const crypt = 'dungeon:m52646490', shop = 'interior:m206728581.7';
  const members = [
    { acct: 'a2', name: 'Bo', online: true, p: { in: 1, ins: instanceRoomOf(crypt, { owner: ann, epoch: '89abcdef' }) } },   // Bo stands in Ann's room
    { acct: 'a1', name: 'Ann', online: true, p: { in: 0 } },                                                                  // Ann, its owner, outside
    { acct: 'a3', name: 'Cy', online: true, p: { in: 1 } },                                                                   // a public room
    { acct: 'a4', name: 'Di', online: true, p: { in: 1, ins: instanceRoomOf('dungeon:m12345', { owner: fi, epoch: '01234567' }) } },   // another place
    { acct: 'a5', name: 'Ed', online: false, p: { in: 1, ins: instanceRoomOf(crypt, { owner: fi, epoch: '01234567' }) } },   // away
    { acct: 'a6', name: 'Fi', online: true, p: { in: 2, ins: instanceRoomOf(shop, { owner: fi, epoch: '01234567' }) } },
    { acct: 'a7', name: 'Gus', online: true, p: { in: 1, ins: instanceRoomOf(crypt, { owner: stranger, epoch: '01234567' }) } },   // a room of nobody in the party
  ];
  assert.deepEqual(partnerInstances(members, crypt, ownerOf), [{ acct: 'a1', name: 'Ann', owner: ann, epoch: '89abcdef' }], 'named by its owner, not the member seen in it; a stranger\'s room is not offered - the relay would refuse it');
  assert.deepEqual(partnerInstances(members, shop, ownerOf).map((p) => p.name), ['Fi'], 'a building, by its room');
  assert.deepEqual(partnerInstances(members, 'interior:m206728581.8', ownerOf), []);
  assert.deepEqual(partnerInstances(members, null, ownerOf), [], 'no room, no instance');
  assert.deepEqual(partnerInstances(members, crypt), [], 'no owner known, nothing offered');
  const twice = [...members, { acct: 'a8', name: 'Hal', online: true, p: { in: 1, ins: instanceRoomOf(crypt, { owner: ann, epoch: '89abcdef' }) } }];
  assert.equal(partnerInstances(twice, crypt, ownerOf).length, 1, 'two members in one room are one row');
});

test('INSTANCES what the door offers: offline or at an older relay nothing; a quest\'s place public or mine; the Hold mine alone; a partner\'s join; a place with nothing but its public room no popup', () => {
  const partners = [{ name: 'Ann', acct: 'a1', owner: '0123456789abcdef', epoch: '89abcdef' }];
  assert.equal(instanceOffer({ online: false, instanceOk: true, questHere: true }), null);
  assert.equal(instanceOffer({ online: true, instanceOk: false, questHere: true, isHold: true }), null);
  assert.deepEqual(instanceOffer({ online: true, instanceOk: true, questHere: true }), [{ kind: 'public' }, { kind: 'mine' }]);
  assert.deepEqual(instanceOffer({ online: true, instanceOk: true, isHold: true }), [{ kind: 'mine' }], 'HOLD-ONCE: never its public room');
  assert.deepEqual(instanceOffer({ online: true, instanceOk: true, partners }), [{ kind: 'public' }, { kind: 'join', name: 'Ann', acct: 'a1', owner: '0123456789abcdef', epoch: '89abcdef' }]);
  assert.equal(instanceOffer({ online: true, instanceOk: true }), null, 'no popup: the door opens as it always did');
  assert.deepEqual(instanceOffer({ online: true, instanceOk: true, questHere: true, partners }).map((r) => r.kind), ['public', 'join', 'mine'], 'the party\'s room before my own - a copy of the quest has its own room');
  assert.deepEqual(instanceOffer({ online: true, instanceOk: true, isHold: true, partners }).map((r) => r.kind), ['join', 'mine'], 'and at the Hold');
});

/** The door over fake deps: a quest at the crypt, the windows laid over and the lines kept. */
function door({ instanceOk = true, online = true, quest = true, members = [], overlay = true, wild = false } = {}) {
  const m = new QuestMachine();
  const q = quest ? questAt(m, CRYPT) : null;
  const shown = [], said = [];
  const d = createInstanceDoor({
    online: () => online, instanceOk: () => instanceOk, account: () => 'acct-alice', character: () => 'char_alice', members: () => members,
    questMachine: () => m, openOverlay: (win, onClosed) => { if (!overlay) return false; shown.push({ win, onClosed }); return true; }, say: (l) => said.push(l), wild: () => wild,
  });
  return { d, q, m, shown, said };
}
/** Let the door's own awaits (the digests) run until \`cond\`. */
const until = async (cond, ms = 5000) => { const end = Date.now() + ms; while (!cond() && Date.now() < end) await new Promise((r) => setTimeout(r, 2)); };   // the digests are the platform's thread pool's: time, not ticks, under a loaded machine
const COPPERING = { name: 'Ruins of The Hold of Coppering', mapTableData: { mapId: CRYPT.mapId } };
const HOLD = { name: "Privateer's Hold", mapTableData: { mapId: PRIVATEERS_HOLD_MAP_ID } };
const ME = hex('instance:account:acct-alice', 8), ANN = hex('instance:account:acct-ann1', 8);

test('INSTANCES the door (a player\'s): the popup where there is a choice, AWAITED - rows numbered, Public and Your instance, Esc to leave; my instance my account\'s digest and the quest\'s own epoch, every entry of its life one room; Leave, or the window closed any way, enters nothing', async () => {
  const { d, q, shown } = door();
  const site = d.dungeonSite(COPPERING);
  let pending = d.choose(site);
  await until(() => shown.length === 1);
  const { win } = shown[0];
  assert.equal(win.isChoiceWindow, true);
  assert.deepEqual(win.options.map((o) => [o.code, o.label]), [['Digit1', `1 - ${INSTANCE_TEXT.public()}`], ['Digit2', `2 - ${INSTANCE_TEXT.mine()}`], ['Escape', `Esc - ${INSTANCE_TEXT.leave()}`]], 'Leave is the Escape key\'s - a keyed menu takes its codes alone, and nine rows fit Digit1-9');
  assert.deepEqual(win.lines, ['Ruins of The Hold of Coppering', INSTANCE_TEXT.line()]);
  assert.equal(q.instanceEpoch, null, 'no room until one opens');
  win.input('Digit2');
  const first = await pending;
  assert.match(q.instanceEpoch, /^[0-9a-f]{8}$/, 'minted as the quest\'s instance first opened');
  const inst = { owner: ME, epoch: q.instanceEpoch };
  assert.deepEqual(first, { instance: inst, whole: true });
  pending = d.choose(site); await until(() => shown.length === 2); shown[1].win.input('Digit2');
  assert.deepEqual(await pending, { instance: inst, whole: true }, 'the same room every entry of its life');
  pending = d.choose(site); await until(() => shown.length === 3); shown[2].win.input('Digit1');
  assert.deepEqual(await pending, { instance: null, whole: false }, 'Public: the world\'s own room and size');
  pending = d.choose(site); await until(() => shown.length === 4); shown[3].win.input('Escape');
  assert.equal(await pending, null, 'Leave');
  pending = d.choose(site); await until(() => shown.length === 5); shown[4].onClosed();
  assert.equal(await pending, null, 'the window closed some other way');
  pending = d.choose(site); await until(() => shown.length === 6); shown[5].win.dispose();
  assert.equal(await pending, null, 'replaced and disposed - never a door left waiting on nothing');
  const shut = door({ overlay: false });
  assert.equal(await shut.d.choose(site), null, 'no window went up: nothing entered');
});

test('INSTANCES the door (a player\'s): no popup where there is nothing to choose - the rule\'s answer; the Hold its instance alone (its line says why); a partner\'s room a join row named by its owner; a home never asks', async () => {
  const none = door({ quest: false });
  assert.deepEqual(await none.d.choose(none.d.dungeonSite(COPPERING)), { instance: null, whole: false });
  assert.equal(none.shown.length, 0);
  const old = door({ instanceOk: false });
  assert.deepEqual(await old.d.choose(old.d.dungeonSite(COPPERING)), { instance: null, whole: true }, 'an older relay: the quest\'s dungeon whole in its public room');
  assert.equal(old.shown.length, 0);
  const hold = door({ quest: false });
  const p = hold.d.choose(hold.d.dungeonSite(HOLD));
  await until(() => hold.shown.length === 1);
  assert.deepEqual(hold.shown[0].win.options.map((o) => o.label), [`1 - ${INSTANCE_TEXT.mine()}`, `Esc - ${INSTANCE_TEXT.leave()}`]);
  assert.deepEqual(hold.shown[0].win.lines, ["Privateer's Hold", INSTANCE_TEXT.holdLine()]);
  hold.shown[0].win.input('Digit1');
  assert.deepEqual((await p).instance, { owner: ME, epoch: hex('instance:epoch:char_alice:hold', 4) });
  const base = siteBase(dungeonSite(COPPERING));
  const members = [
    { acct: 'acct-bob2', name: 'Bo', online: true, p: { in: 1, ins: instanceRoomOf(base, { owner: ANN, epoch: '89abcdef' }) } },   // Bo in Ann's room
    { acct: 'acct-ann1', name: 'Ann', online: true, p: { in: 0 } },
    { acct: 'acct-cyd3', name: 'Cy', online: true, p: { in: 1, ins: instanceRoomOf(base, { owner: ME, epoch: '01234567' }) } },   // my own room: no join row
    { acct: 'acct-dee4', name: 'Dee', online: true, p: { in: 1, ins: instanceRoomOf(base, { owner: '1111111111111111', epoch: '01234567' }) } },   // a stranger's: none
    { acct: 'acct-eve5', name: 'Eve', online: true, p: { in: 1, ins: instanceRoomOf('dungeon:m12345', { owner: ANN, epoch: '01234567' }) } },   // another place: none
  ];
  const party = door({ quest: false, members });
  const q = party.d.choose(party.d.dungeonSite(COPPERING));
  await until(() => party.shown.length === 1);
  assert.deepEqual(party.shown[0].win.options.map((o) => o.label), [`1 - ${INSTANCE_TEXT.public()}`, `2 - ${INSTANCE_TEXT.join('Ann')}`, `Esc - ${INSTANCE_TEXT.leave()}`]);
  party.shown[0].win.input('Digit2');
  assert.deepEqual(await q, { instance: { owner: ANN, epoch: '89abcdef' }, whole: true });
  const shop = door({ quest: false });
  questAt(shop.m, SHOP);
  const b = shop.d.choose(shop.d.buildingSite(SHOP.mapId, { buildingKey: SHOP.buildingKey }));
  await until(() => shop.shown.length === 1);
  assert.equal(shop.shown.length, 1, 'a building a quest names asks as a dungeon does');
  shop.shown[0].win.input('Escape'); await b;
  assert.deepEqual(await shop.d.choose(shop.d.buildingSite(SHOP.mapId, { buildingKey: SHOP.buildingKey }, { home: true })), { instance: null, whole: true }, 'a home or a house of mine: its owner\'s room, never asked');
  assert.equal(shop.shown.length, 1);
});

test('INSTANCES every other way in (entryFor): NEVER a popup - a quest\'s place its instance (a partner\'s standing there first), whole where none can be had; the Hold mine; else the public room; what a load, an anchor or a staff landing recorded where it may still be had, else the public room laid as it was', async () => {
  const { d, q, shown } = door();
  const site = d.dungeonSite(COPPERING);
  const mine = await d.entryFor(site);
  assert.deepEqual(mine, { instance: { owner: ME, epoch: q.instanceEpoch }, whole: true }, 'a quest\'s transfer into its own place: its instance (S0000016\'s Crux was soft-locked by a popup here)');
  assert.equal(shown.length, 0);
  const base = siteBase(site);
  const together = door({ members: [{ acct: 'acct-ann1', name: 'Ann', online: true, p: { in: 1, ins: instanceRoomOf(base, { owner: ANN, epoch: '89abcdef' }) } }] });
  assert.deepEqual(await together.d.entryFor(together.d.dungeonSite(COPPERING)), { instance: { owner: ANN, epoch: '89abcdef' }, whole: true }, 'the party together');
  assert.deepEqual(await door({ instanceOk: false }).d.entryFor(site), { instance: null, whole: true }, 'an older relay: whole');
  assert.deepEqual(await door({ quest: false }).d.entryFor(site), { instance: null, whole: false }, 'no quest: the public room');
  assert.deepEqual((await door({ quest: false }).d.entryFor(d.dungeonSite(HOLD))).instance, { owner: ME, epoch: hex('instance:epoch:char_alice:hold', 4) }, 'the Hold: mine');
  assert.deepEqual(await door({ quest: false, instanceOk: false }).d.entryFor(d.dungeonSite(HOLD)), { instance: null, whole: false }, 'the Hold at an older relay: its public room (HOLD-ONCE refuses it)');
  assert.deepEqual(await door({ online: false }).d.entryFor(site), { instance: null, whole: false }, 'offline: DFU\'s');
  const zone = door({ wild: true });
  assert.deepEqual(await zone.d.choose(site), { instance: null, whole: true }, 'the open zone: nothing keeps an instance (its dungeons sealed, its halls refused) - no popup ahead of the seal');
  assert.equal(zone.shown.length, 0);
  // recorded
  const word = instanceWord(mine.instance);
  assert.deepEqual(await d.entryFor(site, { ins: word }), { instance: mine.instance, whole: true }, 'my quest\'s room, while it runs');
  const ended = door(); ended.q.questComplete = true;
  assert.deepEqual(await ended.d.entryFor(site, { ins: word }), { instance: null, whole: true }, 'its quest ended: never keyed again - the public room, whole, as the position was taken');
  const annWord = instanceWord({ owner: ANN, epoch: '89abcdef' });
  assert.deepEqual(await together.d.entryFor(site, { ins: annWord }), { instance: { owner: ANN, epoch: '89abcdef' }, whole: true }, 'a partner\'s, its owner in my party');
  assert.deepEqual(await d.entryFor(site, { ins: annWord }), { instance: null, whole: true }, 'its owner no longer of my party');
  assert.deepEqual(await d.entryFor(site, { ins: annWord, staff: true }), { instance: { owner: ANN, epoch: '89abcdef' }, whole: true }, 'a staff landing: the player\'s room (the relay admits staff)');
  assert.deepEqual(await d.entryFor(site, {}), { instance: null, whole: false }, 'recorded public');
  assert.deepEqual(await d.entryFor(site, { whole: true }), { instance: null, whole: true }, 'recorded public, whole');
  const hall = { siteType: SITE_TYPES.Dungeon, mapId: Number(wdunRoomKey('210,99').slice(9)), buildingKey: 0, layout: null, isHold: false, home: false, name: '' };
  assert.deepEqual(await d.entryFor(hall, { ins: word, staff: true }), { instance: null, whole: true }, 'a zone hall keeps none (the relay refuses one)');
});

test('QUEST-ELSEWHERE (FIELD BUGS 2026-10-16c, MD-Geist: "the Objective just did not want to spawn (I tried the dungeon in \'Public\' mode) even after \'Quest Repair\'"): a quest\'s dungeon the world lays smaller in public says so in the popup, before Public is chosen; a repair in that room says where its things are, never "nothing was missing" (mutants: relaid never read; the line never laid; the repair\'s word dropped)', async () => {
  // the site: `relaid` exactly where the world lays the public room smaller (onlineDungeonSize), never the Hold's or a hollow's
  // PIN MOVED (AUDIT FB1019f B1): where it BUILDS it smaller - a dungeon of no more blocks than its size's threshold is
  // the dungeon whole (fb1019f_heirwhole.test.js) - so the ruin has thirteen blocks, which either smaller size lays anew
  const sizes = { full: null, medium: null, small: null };
  for (let id = CRYPT.mapId; Object.values(sizes).some((v) => v == null); id++) if (id !== PRIVATEERS_HOLD_MAP_ID) sizes[onlineDungeonSize({ mapTableData: { mapId: id } })] ??= id;
  const blocks = Array.from({ length: 13 }, (_, i) => ({ blockName: `${i < 9 ? 'N' : 'B'}${String(i).padStart(7, '0')}.RDB`, x: i, z: 0, isStartingBlock: i === 0 }));
  const at = (mapId) => ({ name: 'Ruins of The Hold of Coppering', hasDungeon: true, mapTableData: { mapId }, dungeon: { blocks } });
  assert.deepEqual(Object.values(sizes).map((id) => dungeonSite(at(id)).relaid), [false, true, true]);
  assert.equal(dungeonSite(COPPERING).relaid, false, 'no dungeon named: laid as it is');
  assert.equal(dungeonSite({ ...at(sizes.medium), mapTableData: { mapId: PRIVATEERS_HOLD_MAP_ID } }).relaid, false, 'the main story\'s keeps are laid whole');
  // the popup: the quest's line under the choice where the public room is re-laid, and only there
  const relaid = door();
  relaid.q.resources.get('crypt').siteDetails.mapId = sizes.medium;
  const pending = relaid.d.choose(relaid.d.dungeonSite(at(sizes.medium)));
  await until(() => relaid.shown.length === 1);
  assert.deepEqual(relaid.shown[0].win.lines, ['Ruins of The Hold of Coppering', INSTANCE_TEXT.line(), INSTANCE_TEXT.questPublic()]);
  relaid.shown[0].win.input('Escape');
  await pending;
  const whole = door();
  whole.q.resources.get('crypt').siteDetails.mapId = sizes.full;
  const fullPending = whole.d.choose(whole.d.dungeonSite(at(sizes.full)));
  await until(() => whole.shown.length === 1);
  assert.deepEqual(whole.shown[0].win.lines, ['Ruins of The Hold of Coppering', INSTANCE_TEXT.line()], 'laid whole in public: its things stand there too');
  whole.shown[0].win.input('Escape');
  await fullPending;
  // the repair, in the re-laid room: the mount answers 'elsewhere' (worldModes.js mountQuestResources), and the line says so
  const m = new QuestMachine();
  questAt(m, CRYPT);
  const there = repairActiveQuests(m, { mountCurrentSite: () => 'elsewhere' });
  assert.deepEqual([there.elsewhere, there.text], [true, questElsewhereLine()]);
  assert.match(questElsewhereLine(), /in your own instance/);   // PIN MOVED (VOICE2): no dash aside (Voice.md rule 5)
  const home = repairActiveQuests(m, { mountCurrentSite: () => undefined });
  assert.deepEqual([home.elsewhere, home.text], [false, 'Nothing was missing from your active quest.'], 'anywhere else: as before');
});

test('INSTANCES the door\'s other words: atDoor - Leave spends the press, a row enters; refused - an instance\'s door shut on this page, said once a room; poseWord - inside, the room the relay joined; questElsewhere - once a build', async () => {
  const { d, shown, said } = door();
  const site = d.dungeonSite(COPPERING);
  const went = [];
  let p = d.atDoor(site, (entry) => { went.push(entry); return 'entered'; });
  await until(() => shown.length === 1); shown[0].win.input('Escape');
  assert.equal(await p, true, 'Leave: the press spent, its caller says nothing more');
  assert.deepEqual(went, []);
  p = d.atDoor(site, (entry) => { went.push(entry); return 'entered'; });
  await until(() => shown.length === 2); shown[1].win.input('Digit1');
  assert.equal(await p, 'entered');
  assert.deepEqual(went, [{ instance: null, whole: false }]);
  const room = instanceRoomOf(siteBase(site), { owner: ANN, epoch: '89abcdef' });
  assert.equal(d.refused({ terminal: true, error: INSTANCE_DOOR_WORD, room }), true);
  assert.equal(d.refused({ terminal: true, error: INSTANCE_DOOR_WORD, room }), false, 'said once a room');
  assert.deepEqual(said, [INSTANCE_TEXT.refused()]);
  assert.equal(d.refused({ terminal: true, error: 'busy', room: room.replace('89abcdef', '89abcdee') }), false);
  assert.equal(d.refused({ terminal: false, error: INSTANCE_DOOR_WORD, room: room.replace('89abcdef', '89abcdee') }), false);
  assert.equal(d.refused({ terminal: true, error: INSTANCE_DOOR_WORD, room: 'dungeon:m52646490' }), false, 'a public room\'s refusal is no instance\'s');
  assert.deepEqual(d.poseWord('dungeon', room), { ins: room });
  assert.deepEqual(d.poseWord('exterior', room), {});
  assert.deepEqual(d.poseWord('dungeon', 'dungeon:m52646490.m'), {}, 'its public room: none');
  const build = { ...COPPERING };
  assert.equal(d.questElsewhere(build), true);
  assert.equal(d.questElsewhere(build), false, 'once a build');
  assert.equal(d.questElsewhere({ ...COPPERING }), true, 'the next build says it again');
  assert.deepEqual(said.filter((l) => l === INSTANCE_TEXT.questHere()).length, 2);
});

test('WIPE-RETURN (a field report, 2026-10-25: "Upon Death in an instance, party members and host will desync even if everyone dies and goes back in"): the room the relay last joined me to is offered again at its place\'s door once no pose names it - after the rooms members stand in, one row a room, its owner in my party, never another place\'s, never kept from outside, never one the relay shut on me (mutants: never kept; never offered by the law or the door; before the living; twice; kept from outside; kept past a refusal)', async () => {
  const site = dungeonSite(COPPERING), base = siteBase(site);
  const annRoom = instanceRoomOf(base, { owner: ANN, epoch: '89abcdef' });
  const ann = { acct: 'acct-ann1', name: 'Ann', online: true, p: { in: 1, ins: annRoom } };
  const labels = (win) => win.options.map((o) => o.label);
  // Cy holds no copy of the quest and stands in Ann's room; then the party falls together: each death leaves the room at
  // once (world.js onlineFrame) and wakes outside its door (respawnOnlinePlayer), so no pose names the room any more
  const cy = door({ quest: false, members: [ann] });
  assert.deepEqual(cy.d.poseWord('dungeon', annRoom), { ins: annRoom }, 'the frame\'s word while I stand in it');
  ann.p = { in: 0 };
  let pending = cy.d.choose(site);
  await until(() => cy.shown.length === 1);
  assert.deepEqual(labels(cy.shown[0].win), [`1 - ${INSTANCE_TEXT.public()}`, `2 - ${INSTANCE_TEXT.join('Ann')}`, `Esc - ${INSTANCE_TEXT.leave()}`], 'a popup - it was none, and the door opened on the public room unasked');
  cy.shown[0].win.input('Digit2');
  assert.deepEqual(await pending, { instance: { owner: ANN, epoch: '89abcdef' }, whole: true });
  // Bo holds a copy, whose own instance is another room: Ann's is offered beside it, and every other way in takes it first
  const bo = door({ members: [ann] });
  bo.d.poseWord('dungeon', annRoom);
  pending = bo.d.choose(site);
  await until(() => bo.shown.length === 1);
  assert.deepEqual(labels(bo.shown[0].win), [`1 - ${INSTANCE_TEXT.public()}`, `2 - ${INSTANCE_TEXT.join('Ann')}`, `3 - ${INSTANCE_TEXT.mine()}`, `Esc - ${INSTANCE_TEXT.leave()}`], 'it was Public and their own room alone; the party\'s comes first');
  bo.shown[0].win.input('Digit2');
  assert.deepEqual(await pending, { instance: { owner: ANN, epoch: '89abcdef' }, whole: true });
  assert.deepEqual(await bo.d.entryFor(site), { instance: { owner: ANN, epoch: '89abcdef' }, whole: true }, 'a quest\'s transfer: the party\'s room before my own');
  // after the rooms members stand in now, and one row a room
  const DEE = hex('instance:account:acct-dee4', 8);
  const dee = { acct: 'acct-dee4', name: 'Dee', online: true, p: { in: 1, ins: instanceRoomOf(base, { owner: DEE, epoch: '01234567' }) } };
  const both = door({ quest: false, members: [ann, dee] });
  both.d.poseWord('dungeon', annRoom);
  pending = both.d.choose(site);
  await until(() => both.shown.length === 1);
  assert.deepEqual(labels(both.shown[0].win), [`1 - ${INSTANCE_TEXT.public()}`, `2 - ${INSTANCE_TEXT.join('Dee')}`, `3 - ${INSTANCE_TEXT.join('Ann')}`, `Esc - ${INSTANCE_TEXT.leave()}`], 'where someone stands now comes first');
  both.shown[0].win.input('Escape'); await pending;
  ann.p = { in: 1, ins: annRoom };
  pending = both.d.choose(site);
  await until(() => both.shown.length === 2);
  assert.deepEqual(labels(both.shown[1].win), [`1 - ${INSTANCE_TEXT.public()}`, `2 - ${INSTANCE_TEXT.join('Ann')}`, `3 - ${INSTANCE_TEXT.join('Dee')}`, `Esc - ${INSTANCE_TEXT.leave()}`], 'Ann back inside: her room once');
  both.shown[1].win.input('Escape'); await pending;
  ann.p = { in: 0 };
  // none of these is offered: no popup, the public room as the door opened it before. A popup that does go up is answered
  // (Esc), so the case fails rather than waits on a window nobody closes
  const none = async (d, shown, why) => {
    let got;
    const asked = d.choose(site).then((entry) => { got = entry; });
    await until(() => got !== undefined || shown.length > 0);
    if (shown.length) shown[0].win.input('Escape');
    await asked;
    assert.equal(shown.length, 0, why);
    assert.deepEqual(got, { instance: null, whole: false }, why);
  };
  const left = door({ quest: false, members: [] });
  left.d.poseWord('dungeon', annRoom);
  await none(left.d, left.shown, 'its owner gone from my party - the relay would refuse it');
  const away = door({ quest: false, members: [ann] });
  away.d.poseWord('dungeon', instanceRoomOf('dungeon:m12345', { owner: ANN, epoch: '89abcdef' }));
  await none(away.d, away.shown, 'another place\'s room');
  const outside = door({ quest: false, members: [ann] });
  outside.d.poseWord('dungeon', base);
  outside.d.poseWord('exterior', annRoom);
  await none(outside.d, outside.shown, 'a public room keeps nothing, and a room keyed while I am outside is not one I stood in');
  const shut = door({ quest: false, members: [ann] });
  shut.d.poseWord('dungeon', annRoom);
  assert.equal(shut.d.refused({ terminal: true, error: INSTANCE_DOOR_WORD, room: annRoom }), true);
  await none(shut.d, shut.shown, 'the relay shut it on me - the hub\'s party can be ahead of mine');
});

// worldModes.js's funnels, executed from their source
const WM = read('src/scenes/worldModes.js');
const fns = new Map(), arrows = new Map();
(function walk(n) {
  if (!n || typeof n !== 'object') return;
  if (n.type === 'FunctionDeclaration' && n.id?.name) fns.set(n.id.name, WM.slice(n.start, n.end));
  if (n.type === 'VariableDeclarator' && n.id?.name && n.init?.type === 'ArrowFunctionExpression') arrows.set(n.id.name, WM.slice(n.start, n.end));
  for (const v of Object.values(n)) if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') walk(v);
})(parse(WM, { ecmaVersion: 'latest', sourceType: 'module' }));
function funnel(answer) {
  const said = [], built = [], asked = [];
  const host = { dungeonOnline: () => true, wildDungeonGate: null, instanceDoor: { dungeonSite: (loc) => ({ name: loc.name }), entryFor: async (site, recorded) => { asked.push({ site: site.name, recorded }); return answer; } } };
  const tryEnterDungeon = new Function('host', 'say', 'isPrivateersHold', 'HOLD_ONCE_TEXT', 'gatedTransition', 'dungeonTransition',
    `${fns.get('tryEnterDungeon')} return tryEnterDungeon;`)(host, (l) => said.push(l), isPrivateersHold, HOLD_ONCE_TEXT,
    (step) => step(() => true), async (hit, entries, preferEnterMarker, live, fromLoad, place) => { built.push({ name: hit.dfLocation.name, place }); return true; });
  return { tryEnterDungeon, said, built, asked };
}

test('INSTANCES the funnel (worldModes.js tryEnterDungeon, from its source): the entry is DECIDED, never asked there - a player\'s door\'s answer rides to the build; every other way in takes the door\'s rule (what was recorded handed on); the new game\'s start the Hold\'s public room; an instance of the Hold passes HOLD-ONCE, its public room is refused', async () => {
  assert.doesNotMatch(fns.get('tryEnterDungeon'), /choose|atDoor|ChoiceWindow/, 'no popup can answer "not entered" to a quest\'s transfer');
  const inst = { owner: '0123456789abcdef', epoch: '89abcdef' };
  const handed = funnel(null);
  await handed.tryEnterDungeon({ dfLocation: COPPERING }, [], { entry: { instance: inst, whole: true } });
  assert.deepEqual(handed.asked, [], 'a door\'s answer: the rule never asked');
  assert.deepEqual(handed.built, [{ name: COPPERING.name, place: { instance: inst, whole: true } }]);
  const rule = funnel({ instance: inst, whole: true });
  assert.equal(await rule.tryEnterDungeon({ dfLocation: COPPERING }, []), true);
  assert.deepEqual(rule.asked, [{ site: COPPERING.name, recorded: undefined }], 'a quest\'s transfer, the cemetery, the Abyss: the rule');
  await rule.tryEnterDungeon({ dfLocation: COPPERING }, [], { fromLoad: true, recorded: { ins: 'x' } });
  assert.deepEqual(rule.asked[1], { site: COPPERING.name, recorded: { ins: 'x' } }, 'a load hands on what it recorded');
  const start = funnel({ instance: inst, whole: true });
  await start.tryEnterDungeon({ dfLocation: HOLD }, [], { holdOpen: true });
  assert.deepEqual(start.asked, [], 'the new game\'s start: never the rule');
  assert.deepEqual(start.built, [{ name: HOLD.name, place: null }], 'the Hold\'s public room');
  const staff = funnel({ instance: inst, whole: true });
  await staff.tryEnterDungeon({ dfLocation: HOLD }, [], { holdOpen: true, recorded: { ins: 'x', staff: true } });
  assert.equal(staff.asked.length, 1, 'a staff landing: what it recorded');
  const hold = funnel({ instance: inst, whole: true });
  assert.equal(await hold.tryEnterDungeon({ dfLocation: HOLD }, []), true, 'an instance of the Hold is entered any time');
  assert.deepEqual(hold.said, []);
  const pub = funnel({ instance: null, whole: false });
  assert.equal(await pub.tryEnterDungeon({ dfLocation: HOLD }, []), false, 'its public room: HOLD-ONCE');
  assert.deepEqual(pub.said, [HOLD_ONCE_TEXT]);
  assert.deepEqual(pub.built, []);
});

test('INSTANCES a player\'s door (worldModes.js enterDungeonDoor, enterBuildingDoor, from their source): the door asked, its answer awaited and handed to the entry; Leave enters nothing; a world moved while it was up enters nothing; a home is no instance\'s', async () => {
  const DOOR = { id: 'door' };
  const run = async (name, { answer, mode = 'exterior', bd = { buildingKey: 7 }, home = null, owned = false, doors = [{ localDoor: DOOR }] }) => {
    const calls = [], sites = [];
    const host = { onlineHomes: home ? {} : null, instanceDoor: {
      dungeonSite: (loc) => ({ kind: 'dungeon', name: loc?.name }), buildingSite: (mapId, b, opts) => ({ kind: 'building', mapId, b, ...opts }),
      atDoor: async (site, go) => { sites.push(site); return answer ? go(answer) : true; } } };
    const scope = { host, mode, doorTargets: () => doors, buildingDataForDoor: () => bd, questSceneCtx: () => ({ mapId: 5 }), visitLayoutNow: () => 'classic', homeOf: () => home, houseOwnedAt: () => owned,
      tryEnterDungeon: async (...a) => { calls.push(['dungeon', ...a]); return true; }, enterInteriorCore: async (...a) => { calls.push(['building', ...a]); return true; } };
    const fn = new Function(...Object.keys(scope), `const ${arrows.get('doorStands')}; const ${arrows.get(name)}; return ${name};`)(...Object.values(scope));
    return { got: await fn({ dfLocation: COPPERING, localDoor: DOOR }, ['e']), calls, sites };
  };
  const entry = { instance: null, whole: false };
  const dg = await run('enterDungeonDoor', { answer: entry });
  assert.deepEqual(dg.calls, [['dungeon', { dfLocation: COPPERING, localDoor: DOOR }, ['e'], { entry }]]);
  assert.deepEqual((await run('enterDungeonDoor', { answer: null })).calls, [], 'Leave');
  assert.deepEqual((await run('enterDungeonDoor', { answer: entry, mode: 'dungeon' })).calls, [], 'the world moved while it was up');
  assert.deepEqual((await run('enterDungeonDoor', { answer: entry, doors: [{ localDoor: { id: 'another' } }] })).calls, [], 'the door gone - a teleport while it was up');
  assert.deepEqual((await run('enterBuildingDoor', { answer: entry, doors: [] })).calls, [], 'and a building\'s');
  const bg = await run('enterBuildingDoor', { answer: entry });
  assert.deepEqual(bg.calls, [['building', { dfLocation: COPPERING, localDoor: DOOR }, ['e'], null, entry]]);
  assert.deepEqual(bg.sites, [{ kind: 'building', mapId: 5, b: { buildingKey: 7 }, layout: 'classic', home: false }]);
  assert.equal((await run('enterBuildingDoor', { answer: entry, home: { own: true } })).sites[0].home, true, 'an online home');
  assert.equal((await run('enterBuildingDoor', { answer: entry, owned: true })).sites[0].home, true, 'a house of mine');
});

test('INSTANCES the hosts, by source: the place\'s instance is the MODE\'s - set as a dungeon or a building is built, gone with the mode, read by the room\'s identity; recorded by the save, the anchor and a staff landing, and handed back by each; a re-laid public room mounts no quest\'s things; world.js keys the room and the party pose by what the relay joined', () => {
  assert.match(fns.get('dungeonTransition'), /whole: !!place\?\.whole \}\)/);
  assert.match(fns.get('dungeonTransition'), /placeInstance = place\?\.instance \?\? null;[^\n]*\n\s*dungeonLoc = dfLocation;/);
  assert.match(fns.get('dungeonTransition'), /placeRecord: \(\) => \(place\?\.instance \? \{ ins: instanceWord\(place\.instance\) \} : \{\}\),/);
  assert.match(fns.get('interiorTransition'), /placeInstance = place\?\.instance \?\? null;[^\n]*\n(?:\s*stand[A-Za-z]+\(\);[^\n]*\n)*\s*interiorBuilding = building;/);
  assert.match(WM, /if \(next === 'exterior'\) placeInstance = null;/, 'gone with the mode');
  assert.equal((WM.match(/instance: placeInstance/g) ?? []).length, 2, 'the identity of a dungeon and of a building');
  assert.match(fns.get('interiorIdentity'), /\.\.\.\(placeInstance \? \{ ins: instanceWord\(placeInstance\) \} : \{\}\)/);
  assert.match(WM, /dungeon: \{ \.\.\.\(placeInstance \? \{ ins: instanceWord\(placeInstance\) \} : \{\}\), whole: builtDungeonSize\(dungeonLoc\) === 'full' \} \};/, 'the anchor: room and layout');
  assert.doesNotMatch(fns.get('enterInteriorCore'), /choose|atDoor/, 'a building\'s entry never asks either');
  assert.match(fns.get('enterInteriorCore'), /place = entry \?\? \(restore\?\.ins != null && door \? await door\.entryFor\(/);
  assert.match(fns.get('mountQuestResources'), /host\.instanceDoor\?\.questElsewhere\?\.\(dungeonLoc\); return 'elsewhere'; \}/);   // PIN MOVED (QUEST-ELSEWHERE, FIELD BUGS 2026-10-16c): the gate answers 'elsewhere', and a repair says so
  assert.match(read('src/scenes/dungeonContext.js'), /mapId: mt\.mapId \?\? null, \.\.\.\(opts\.placeRecord\?\.\(\) \?\? \{\}\) \};/);
  const W = read('src/scenes/world.js');
  assert.match(W, /instance: ident\?\.instance \?\? null,/);
  assert.match(W, /\.\.\.instanceDoor\.poseWord\(mode, online\?\.room\),/);
  assert.match(W, /if \(instanceDoor\.refused\(online\)\) modes\?\.forceExitToExterior\?\.\(\);/);
  assert.match(W, /landed = !!\(await modes\?\.startInDungeon\?\.\(\{ recorded: a\.dungeon \?\? \{\} \}\)\);/, 'a Recall');
  assert.match(W, /interior: inside\.interior, dungeon: inside\.dungeon \?\? null,/, 'the anchor is set with the dungeon\'s record');
  assert.match(W, /startInDungeon\?\.\(\{ locationKey: extras\.locationKey, fromLoad: true, recorded: extras\.dungeon \?\? \{\} \}\)/, 'a load');
  assert.match(W, /startInDungeon\?\.\(\{ locationKey: d\.locationKey \?\? null, holdOpen: true, recorded: \{ ins: d\.ins \?\? null, whole: d\.whole === true, staff: true \} \}\)/, 'a staff landing in a dungeon');
  assert.match(W, /\.\.\.\(d\.ins \? \{ ins: d\.ins, staff: true \} : \{\}\) \}, null, \{ strictDoor: true \}\)/, 'and in a building');
  assert.match(W, /var modes = createWorldModes\(\{\n {4}climbFeel[,:][^\n]*\n {4}outsideView,[^\n]*\n {4}instanceDoor,/);
  assert.match(W, /getLocation: \{ value: \(r, l\) => dungeonLocationFor\(maps\.getLocation\(r, l\), \{ questMachine: questBridge\?\.machine, online: params\.has\('online'\), whole: params\.has\('online'\) \}\) \}/, 'the quest\'s world: the dungeon whole online');
});

test('INSTANCES the Recall anchor keeps a dungeon\'s room and layout (systems/teleportAnchor.js makeAnchor) - its instance\'s word and whether it stood whole; a building\'s rides its door identity, outside none; a malformed word is dropped', () => {
  const base = { pixel: { x: 210, y: 99 }, nativeX: 1, nativeZ: 2, y: 3, local: [1, 2, 3] };
  const ins = '0123456789abcdef.89abcdef';
  assert.deepEqual(makeAnchor({ ...base, worldContext: WORLD_CONTEXT.Dungeon, dungeon: { ins, whole: true } }).dungeon, { ins, whole: true });
  assert.deepEqual(makeAnchor({ ...base, worldContext: WORLD_CONTEXT.Dungeon, dungeon: { whole: false } }).dungeon, { whole: false }, 'its public room, at the world\'s size');
  assert.deepEqual(makeAnchor({ ...base, worldContext: WORLD_CONTEXT.Dungeon, dungeon: { ins: 'x', whole: true } }).dungeon, { whole: true });
  assert.equal(makeAnchor({ ...base, worldContext: WORLD_CONTEXT.Dungeon }).dungeon, null, 'an anchor set before: no record - the Recall hands {} (the public room)');
  assert.equal(makeAnchor({ ...base, worldContext: WORLD_CONTEXT.Exterior, dungeon: { ins, whole: true } }).dungeon, null);
});
