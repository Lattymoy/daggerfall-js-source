// AUDIT 68 (2026-09-24), the quest cluster (S29 + S30, src/systems/quest):
// the whole-tree sweep's quest lane, each fix pinned by execution through
// the machine, the share path and the host seams the shipping game wires -
// the shared quest's items, topics and tombstones, the behaviour registry,
// TrainPc, the gold hooks, the symbol save shape, the macro replace, the
// quest item's second click, the relink's orphans, %olf and int.TryParse.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { receiveSharedQuest, prepareQuestShare } from '../src/systems/questShare.js';
import { QuestResourceBehaviour } from '../src/systems/quest/resourceBehaviour.js';
import { PayMoney, KillFoeAction, UnrestrainFoe, RunQuest } from '../src/systems/quest/actions.js';
import { Symbol as QuestSymbol } from '../src/systems/quest/symbol.js';
import { expandQuestString, expandLetterSignoff, getContextValue } from '../src/systems/quest/questMacros.js';
import { QuestListsManager, MEMBERSHIP_STATUS } from '../src/systems/quest/questLists.js';
import { customParseInt } from '../src/systems/quest/place.js';
import { TopicTree } from '../src/systems/topicTree.js';
import { removeOrphanedItems } from '../src/systems/save.js';
import { addItem } from '../src/systems/inventory.js';
import { SKILLS } from '../src/systems/skills.js';
import { SKILL_ADVANCEMENT_MULTIPLIER } from '../src/systems/advancement.js';
import { srand } from '../src/formats/dfRandom.js';
import { GUILD_GROUPS } from '../src/formats/factionFile.js';

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'dfu-quests');
{
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = readFileSync(join(VENDOR, 'Tables', f), 'utf8').replace(/^﻿/, '');
  loadQuestTables(sources);
}

const SRC = {
  __SH: ['Quest: __SH', 'QRC:', 'Message:  1011', ' a reward', '', 'QBN:', 'Item _reward_ gold', '', '_t_ task:', ' give pc _reward_', '', 'variable _pad_'],
  // a delivery: the letter is picked up, then carried to the questor
  __DL: ['Quest: __DL', 'QRC:', 'Message:  1011', ' done', '', 'QBN:', 'Item _letter_ letter', 'Person _npc_ group Questor', '',
    '_s_ task:', ' get item _letter_', '', '_t_ task:', ' toting _letter_ and _npc_ clicked', ' say 1011', '', 'variable _pad_'],
};
const machine = (deps = {}) => new QuestMachine({ nowSeconds: () => 0, showPopup() {}, getQuestSourceLines: (name) => SRC[name] ?? null, ...deps });
const lists = { findQuestMeta: () => null, hasAcceptedOneTime: () => false, markOneTimeAccepted() {} };
/** A sender with `name` live and marked shared, as the Share button leaves it. */
const sender = (name, deps) => {
  const m = machine(deps);
  const q = m.scheduleQuest(SRC[name], 0, { rolls: () => 0 });
  m.tick();
  m.markQuestShared(name);
  return { m, q };
};
const share = (m, q) => prepareQuestShare(m, q.uid).data;

test('AUDIT 68 S29-share-item-questuid: a shared quest\'s Item names the quest that owns it, and a resync keeps THIS world\'s item', () => {
  const { m: A, q } = sender('__DL');
  const B = machine();
  const got = receiveSharedQuest(B, lists, '__DL', share(A, q));
  assert.ok(got.ok && !got.resync);
  const itemOf = (quest) => quest.getResource({ name: 'letter' }).daggerfallUnityItem;
  const mine = itemOf(got.quest);
  assert.equal(mine.questUID, got.quest.uid, 'the received letter names the received quest, not the throwaway parse');
  assert.equal(mine.questSymbol?.name, 'letter');
  // what the host reads off it: the save's orphan sweep keeps the letter the player holds
  const held = [structuredClone(mine)];
  assert.equal(removeOrphanedItems(null, held, (uid) => B.getQuest(uid)), 0, 'a held quest letter is not an orphan');
  // a resync from the partner keeps the letter B already has - it is not re-rolled or re-linked away
  const again = receiveSharedQuest(B, lists, '__DL', share(A, q));
  assert.ok(again.ok && again.resync);
  assert.equal(itemOf(again.quest), mine, 'the same object the player may already hold');
  assert.equal(mine.questUID, got.quest.uid);
  // and the sender's own letter survives a resync coming back
  const aLetter = itemOf(q);
  const back = receiveSharedQuest(A, lists, '__DL', share(B, got.quest));
  assert.ok(back.ok && back.resync);
  assert.equal(itemOf(q), aLetter);
  assert.equal(aLetter.questUID, q.uid);
});

test('AUDIT 68 S29-share-topics: a received quest registers its talk topics, and a resync relinks them to the rebuilt resources', () => {
  // the shipping host's wiring (world.js): the machine's two talk doors onto ONE TopicTree over that machine
  const host = (build) => {
    let m = null;
    const tree = new TopicTree({ getQuest: (id) => m.getQuest(id) });
    m = build({ addQuestTopics: (q) => tree.addQuestTopicsForQuest(q), relinkQuestTopics: (q) => tree.relinkQuestResources(q) });
    return { m, tree };
  };
  const npcInfo = (tree, quest) => tree.dictQuestInfo.get(quest.uid)?.resourceInfo.get('npc') ?? null;
  const A = host((deps) => sender('__DL', deps).m);
  const qa = [...A.m.quests.values()][0];
  assert.equal(npcInfo(A.tree, qa)?.questResource, qa.getResource({ name: 'npc' }), 'the sender registered at accept');
  const B = host((deps) => machine(deps));
  const got = receiveSharedQuest(B.m, lists, '__DL', share(A.m, qa));
  assert.ok(got.ok);
  assert.equal(npcInfo(B.tree, got.quest)?.questResource, got.quest.getResource({ name: 'npc' }),
    'the receiver can ask about the quest\'s people too');
  // a resync rebuilds the resources in place: the topic tree follows the live objects, both ways
  receiveSharedQuest(B.m, lists, '__DL', share(A.m, qa));
  assert.equal(npcInfo(B.tree, got.quest).questResource, got.quest.getResource({ name: 'npc' }));
  receiveSharedQuest(A.m, lists, '__DL', share(B.m, got.quest));
  assert.equal(npcInfo(A.tree, qa).questResource, qa.getResource({ name: 'npc' }), 'where is reads the live Person');
});

test('AUDIT 68 S29-share-name-tombstoned: a week-old tombstone of a repeatable quest is invisible to sharing', () => {
  const A = machine();
  const first = A.scheduleQuest(SRC.__SH, 0); A.tick(); A.tombstoneQuest(first);
  const second = A.scheduleQuest(SRC.__SH, 0); A.tick();
  A.markQuestShared('__SH');
  const B = machine();
  const got = receiveSharedQuest(B, lists, '__SH', share(A, second));
  assert.ok(got.ok);
  const back = receiveSharedQuest(A, lists, '__SH', share(B, got.quest));
  assert.deepEqual([back.ok, back.resync, back.quest === second], [true, true, true],
    'the partner\'s progress lands on the live copy - it was refused as gone off the tombstone');
  assert.equal(A.sharedCandidateNamed('__SH'), second, 'the host\'s sync watch reads the live copy too');
  // a player who finished the repeatable quest alone this week may still take a party member's share
  const C = machine();
  const own = C.scheduleQuest(SRC.__SH, 0); C.tick(); C.tombstoneQuest(own);
  assert.equal(C.hasActiveQuestNamed('__SH'), false);
  assert.equal(receiveSharedQuest(C, lists, '__SH', share(A, second)).ok, true, 'it was refused as active');
});

test('AUDIT 68 S29-behaviour-registry-leak: the behaviour registry prunes itself as it grows, and clearState lets the clicked host go', () => {
  const m = machine();
  const live = new QuestResourceBehaviour(m);
  for (let i = 0; i < 5000; i++) new QuestResourceBehaviour(m).destroyComponent();   // a CreateFoe wave, over and over
  assert.ok(m._behaviourRefs.size < 200, `the registry held ${m._behaviourRefs.size} refs for one live behaviour`);
  assert.deepEqual(m._liveBehaviours(0), [live], 'the live one is never pruned');
  m.setLastNPCClicked({ hash: 1 }, { questBehaviour: null });
  m.clearState();
  assert.equal(m.lastNPCClickedHost, null, 'the load forgets the previous world\'s clicked host with its click');
});

test('AUDIT 68 S29-trainpc-popup-rng: TrainPc shows QuestComplete through the quest\'s popup door and draws its tally on the quest\'s rolls', () => {
  const run = (roll, lines = [' well done']) => {
    const popups = [];
    const entity = { skills: { [SKILLS.Climbing]: 42 }, skillUses: { [SKILLS.Climbing]: 0 }, fatigue: 5000 };
    const m = machine({ showPopup: (q, tokens) => popups.push(tokens), playerEntity: entity, raiseTime() {} });
    srand(1234);   // the DFRandom stream may be anywhere - it must not decide the tally
    m.scheduleQuest(['Quest: __TP', 'QRC:', 'Message:  1004', ...lines, '', 'QBN:', ' train pc Climbing', '', 'variable _pad_'], 0, { rolls: () => roll });
    m.tick();
    return { popups, uses: entity.skillUses[SKILLS.Climbing] };
  };
  const mult = SKILL_ADVANCEMENT_MULTIPLIER[SKILLS.Climbing];
  assert.equal(run(0).uses, 10 * mult, 'Range(10, 21) at its floor');
  assert.equal(run(0.999).uses, 20 * mult, 'and at its ceiling');
  const long = run(0, Array.from({ length: 30 }, (_, i) => ` line ${i}`));
  assert.equal(long.popups.length, 2, 'a 30-line QuestComplete arrives in 22-line boxes, as ShowMessagePopup chunks it');
  // JournalNote's variant rides the quest's rolls too, never Math.random
  const notes = [];
  const m = machine({ world: { addNoteTokens: (t) => notes.push(t[0].text) } });
  const random = Math.random;
  Math.random = () => 0;
  try {
    m.scheduleQuest(['Quest: __JN', 'QRC:', 'Message:  1011', ' first', '<--->', ' second', '', 'QBN:', ' journal note 1011', '', 'variable _pad_'], 0, { rolls: () => 0.9 });
    m.tick();
  } finally { Math.random = random; }
  assert.deepEqual(notes, [' second'], 'variant 1 of 2 at a 0.9 roll');
});

test('AUDIT 68 S29-gold-hook-dup: ClickedNpc\'s gold arm reads and spends GoldPieces through the pair ClickedFoe uses', () => {
  let pieces = 150;
  const spent = [];
  const m = machine({ getGoldPieces: () => pieces, deductGoldPieces: (n) => { pieces -= n; spent.push(n); } });
  const q = m.scheduleQuest(['Quest: __CN', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'Person _pp_ group Questor', '',
    '_t_ task:', ' clicked _pp_ and at least 100 gold otherwise do _broke_', '', 'variable _broke_'], 0);
  m.tick();
  q.getResource({ name: 'pp' }).setPlayerClicked();
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), true, 'ClickedNpc.cs:91-94: GoldPieces covers it');
  assert.deepEqual([spent, pieces], [[100], 50]);
  assert.equal('getGold' in q.hooks, false, 'one hook for one fact');
});

test('AUDIT 68 S29-raw-symbol-saveshape: PayMoney, KillFoe, UnrestrainFoe and RunQuest save their Symbols as every other action does', () => {
  const q = machine().scheduleQuest(SRC.__SH, 0);
  const cases = [
    [PayMoney, ' pay 100 gold do _paid_ otherwise do _not_', ['paidTaskSymbol', 'notTaskSymbol']],
    [KillFoeAction, ' kill foe _f_', ['foeSymbol']],
    [UnrestrainFoe, ' unrestrain foe _f_', ['foeSymbol']],
    [RunQuest, ' run quest __X then _won_ or _lost_', ['successSymbol', 'failureSymbol']],
  ];
  for (const [Cls, line, fields] of cases) {
    const action = new Cls(q).createNew(line, q);
    const data = action.getSaveData();
    const back = new Cls(q);
    back.restoreSaveData(data);
    for (const f of fields) {
      assert.deepEqual(data[f], { original: action[f].original }, `${Cls.typeName}.${f} saves its original alone`);
      assert.ok(back[f] instanceof QuestSymbol, `${Cls.typeName}.${f} restores a Symbol`);
      assert.equal(back[f].name, action[f].name);
    }
  }
  // a save written in the old {original, name} shape still restores, the name re-derived
  const old = new PayMoney(q);
  old.restoreSaveData({ paidTaskSymbol: { original: '_paid_', name: 'nope' }, notTaskSymbol: null, amount: 1, goldOnly: true });
  assert.equal(old.paidTaskSymbol.name, 'paid');
});

test('AUDIT 68 S30-macro-replace-dollar: a macro value is spliced in LITERALLY and every occurrence in the word expands', () => {
  const name = 'Jo$\'hn $&Smith';
  const m = machine({ playerName: () => name });
  const q = m.scheduleQuest(['Quest: __PN', 'QRC:', 'Message:  1011', ' Greetings %pcn. and %pcn/%pcn', '', 'QBN:', 'variable _x_'], 0);
  m.tick();
  assert.equal(q.getMessage(1011).getTextTokens(-1, () => 0)[0].text, ` Greetings ${name}. and ${name}/${name}`);
  assert.equal(expandQuestString(q, '%pcn!'), `${name}!`);
  assert.equal(expandLetterSignoff(q, [{ text: 'From %pcn.' }]), `Letter: From ${name}. `);
});

test('AUDIT 68 S30-click-dup-quest-item: a second click on a quest item\'s stand before the next quest tick gives nothing twice', () => {
  const inventory = [];
  const m = machine({ giveItemToPlayer: (it, front) => addItem(inventory, it, front ? 'front' : 'back') });
  const q = m.scheduleQuest(SRC.__DL, 0);
  m.tick();
  const letter = q.getResource({ name: 'letter' });
  const b = new QuestResourceBehaviour(m);
  b.assignResource(letter);
  letter.questResourceBehaviour = b;
  b.start();
  b.doClick();
  b.doClick();   // the stand is only taken down on the resource's next tick
  assert.deepEqual(inventory, [letter.daggerfallUnityItem], 'ItemCollection.AddItem refuses the item it already holds');
});

test('AUDIT 68 S30-relink-leaks-orphan-resources: a relinked behaviour lets go of the resource a resync discarded', () => {
  const { m: A, q } = sender('__DL');
  const B = machine();
  const got = receiveSharedQuest(B, lists, '__DL', share(A, q));
  const first = got.quest.getResource({ name: 'npc' });
  const b = new QuestResourceBehaviour(B);
  b.assignResource(first);
  first.questResourceBehaviour = b;
  b.start();
  for (let i = 0; i < 5; i++) assert.ok(receiveSharedQuest(B, lists, '__DL', share(A, q)).resync);
  const live = got.quest.getResource({ name: 'npc' });
  assert.equal(b.targetResource, live);
  assert.equal(first.questResourceBehaviour, null, 'the orphan is uncoupled');
  assert.equal(b._destroyHandlers.length, 1, 'one destroy handler - the live resource\'s');
  b.destroyComponent();
  assert.equal(live.questResourceBehaviour, null, 'and the live one still hears the destroy');
});

test('AUDIT 68 S30-olf-wrong-prng: %olf rolls the engine PRNG (the quest\'s rolls), not the DFRandom stream %ol1 seeds', () => {
  const fates = new Set();
  for (const roll of [0, 0.25, 0.45, 0.65, 0.85]) {
    const m = machine({ world: { oldLeaderFate: (i) => `fate${i}` } });
    const q = m.scheduleQuest(['Quest: __OL', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'variable _x_'], 0, { rolls: () => roll });
    srand(1234);   // what %ol1's lordNameForFaction leaves behind: the same seed for the same faction, every time
    fates.add(getContextValue('%olf', q, q.hooks));
  }
  assert.deepEqual([...fates], ['fate0', 'fate1', 'fate2', 'fate3', 'fate4']);
});

test('AUDIT 68 S30-tryparse-dup: int.TryParse and int.Parse have one port, int32 bound and all', () => {
  const schema = 'schema: *name, group, membership, minReq, flag, notes';
  const classic = [schema, 'QA, FightersGuild, M, 0, 0, x', 'QOV, FightersGuild, M, -3000000000, 0, x', 'QWS, FightersGuild, M,  +2 , 0, x'].join('\n');
  const ql = new QuestListsManager({ readListTable: (n) => (n === 'Classic' ? classic : schema) });
  const pool = ql.getGuildQuestPool(GUILD_GROUPS.FightersGuild, MEMBERSHIP_STATUS.Member, 0, 0, 5).map((d) => d.name);
  assert.deepEqual(pool, ['QA', 'QWS'], 'ParseQuestList skips a minReq TryParse overflows - it was filed at -3e9 and offered at any rank');
  assert.throws(() => customParseInt('2147483648'), /int\.Parse overflow/, 'Place.CustomParseInt is int.Parse: it throws past int32');
  assert.equal(customParseInt(' -12 '), -12);
  assert.throws(() => customParseInt('12abc'), /int\.Parse failed/);
});
