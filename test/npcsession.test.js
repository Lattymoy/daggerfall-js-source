// TK-iv - THE QUESTOR DOOR + STATIC TALK.
//
// TalkManager's NPC-session half: the click arms, the target chain,
// the faction resolution, the greeting ladder that decides whether
// the window opens at all, and the questor pool the Work arm draws
// from. Every record id and faction literal below is pinned as a
// NUMBER, never as an expression over the constant the code reads.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NPCSession, newNPCData, GREETINGS, FACTION_TYPE, SOCIAL_GROUP,
  NPC_TYPE, RANDOM_RULER, RANDOM_NOBLE, RANDOM_KNIGHT,
  DISLIKE_GREETING, NEUTRAL_GREETING, LIKE_GREETING, VERY_LIKE_GREETING,
} from '../src/systems/npcSession.js';
import { srand, randomRangeInclusive } from '../src/formats/dfRandom.js';

const faction = (over = {}) => ({
  id: 0, parent: 0, type: 0, rep: 0, sgroup: 0, ggroup: 0, name: '',
  ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0, ...over,
});

function makeSession(over = {}, table = {}) {
  const calls = [];
  const s = new NPCSession({
    factionData: (id) => table[id] ?? null,
    factionName: (id) => table[id]?.name ?? '',
    reactionToPlayer: () => 0,
    expandRandomTextRecord: (id) => { calls.push(['record', id]); return `record:${id}`; },
    randomTokens: (id) => [{ text: `tokens:${id}` }],
    messageBox: (x) => calls.push(['box', x]),
    pushTalkWindow: () => calls.push(['push']),
    onTargetChanged: (x) => calls.push(['target', x]),
    assembleTopicListPerson: () => calls.push(['personList']),
    resetNPCKnowledge: () => calls.push(['resetKnowledge']),
    resetToneSession: () => calls.push(['resetTone']),
    // the greeting road's reputation roll is `Range(0,15) - 10`, so a
    // reputation of 0 is rejected or not depending on the shared srand
    // stream. Every pin that is not ABOUT the roll hands it a
    // reputation that cannot lose; the ones that are about it override
    // this with their own.
    sgroupReputation: () => 1000,
    rolls: () => 0.9,
    ...over,
  });
  return { s, calls };
}

// ---------------------------------------------------------------
// The literals
// ---------------------------------------------------------------

test('the FALL.EXE greeting table is the C# one, entry for entry', () => {
  assert.deepEqual([...GREETINGS], [
    8550, 8551, 8552, 8553, 8554, 8555, 8556, 8557, 8558, 8559, 8560, 8561, 8562, 8562,
    8563, 8564, 8564, 8565, 8566, 8566, 8567, 8568, 8568, 8569, 8570, 8570, 8571,
  ]);
  assert.equal(GREETINGS.length, 27, 'nine indexes of three, and index 8 is the stranger row');
  // the table is NOT a clean run - five records appear twice, and the
  // duplicates are what make some rejections read like the ordinary face
  assert.equal(GREETINGS[12], GREETINGS[13], '8562 twice');
  assert.equal(GREETINGS[15], GREETINGS[16], '8564 twice');
  assert.equal(GREETINGS[18], GREETINGS[19], '8566 twice');
  assert.equal(GREETINGS[21], GREETINGS[22], '8568 twice');
  assert.equal(GREETINGS[24], GREETINGS[25], '8570 twice - the "Well met, stranger" row');
  // the mobile fallbacks
  assert.equal(DISLIKE_GREETING, 7206);
  assert.equal(NEUTRAL_GREETING, 7207);
  assert.equal(LIKE_GREETING, 7208);
  assert.equal(VERY_LIKE_GREETING, 7209);
});

test('the faction enums are FactionFile.cs values, not positions - every member, not just the used ones', () => {
  // A table pinned only where the code reads it is a table half
  // pinned: the unused members are exactly the ones a later slice
  // will reach for. Both are asserted whole, against FactionFile.cs.
  assert.deepEqual({ ...FACTION_TYPE }, {
    None: -1, Daedra: 0, God: 1, Group: 2, Subgroup: 3, Individual: 4,
    Official: 5, VampireClan: 6, Province: 7, WitchesCoven: 8, Temple: 9,
    KnightlyGuard: 10, MagicUser: 11, Generic: 12, Thieves: 13,
    Courts: 14, People: 15,
  });
  assert.deepEqual({ ...SOCIAL_GROUP }, {
    None: -1, Commoners: 0, Merchants: 1, Scholars: 2, Nobility: 3,
    Underworld: 4, SGroup5: 5, SupernaturalBeings: 6, GuildMembers: 7,
  });
  assert.equal(SOCIAL_GROUP.SGroup5, 5, 'and 5 is the clamp bar SetTargetNPC folds at');
  assert.equal(RANDOM_NOBLE, 242);
  assert.equal(RANDOM_RULER, 852);
  assert.equal(RANDOM_KNIGHT, 853);
});

test('a fresh session starts at C#s field initializers', () => {
  const { s } = makeSession();
  assert.equal(s.currentNPCType, NPC_TYPE.Unset);
  assert.equal(s.nameNPC, '');
  assert.equal(s.reactionToPlayer, 0);
  assert.equal(s.alreadyRejectedOnce, false);
  assert.equal(s.sameTalkTargetAsBefore, false);
  assert.equal(s.lastTargetStaticNPC, null);
  assert.equal(s.lastTargetMobileNPC, null);
  assert.equal(s.targetStaticNPC, null);
  assert.equal(s.npcGreetingText, '');
  assert.equal(s.selectedNpcWorkKey, 0, 'the questor key nobody has picked yet');
  assert.equal(s.exteriorUsedForQuestors, 0);
  assert.equal(s.npcsWithWork.size, 0);
  assert.equal(s.castleNPCsSpokenTo.size, 0);
  assert.deepEqual(s.toneReactionForTalkSession, [0, 0, 0]);
  assert.deepEqual({ ...s.npcData }, { ...newNPCData() }, 'and the NPCData is a fresh one');
});

test('THE EMPTY FACTION is all zeros - every field of C#s default struct', () => {
  // A faction the table cannot resolve reads as C#'s default struct,
  // and the greeting ladder compares against every one of these
  // fields. Pinned whole, because "id is 0" is not the same claim.
  const { s } = makeSession({ factionData: () => null });
  assert.deepEqual({ ...s.getParentGroupFaction(null) }, {
    id: 0, parent: 0, type: 0, rep: 0, sgroup: 0, ggroup: 0, name: '',
    ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0,
  });
});

test('newNPCData starts at C#s field initializers - allowGuildResponse alone is TRUE', () => {
  const d = newNPCData();
  assert.equal(d.allowGuildResponse, true, 'the ONE initialised field (:191)');
  assert.equal(d.isSpyMaster, false);
  assert.equal(d.numAnswersGivenTellMeAboutOrRumors, 0);
  assert.equal(d.socialGroup, SOCIAL_GROUP.Commoners);
  assert.equal(d.factionData, null);
  assert.equal(d.npcFactionName, '');
  assert.equal(d.allyFactionName, '');
  assert.equal(d.enemyFactionName, '');
});

// ---------------------------------------------------------------
// The faction resolution (:884-907)
// ---------------------------------------------------------------

test('getStaticNPCFactionData: id 0 splits on the building, and the three generics ride the court', () => {
  const table = { 100: faction({ id: 100, name: 'People' }), 200: faction({ id: 200, name: 'Court' }), 7: faction({ id: 7, name: 'Real' }) };
  const { s } = makeSession({
    peopleOfCurrentRegion: () => 100, courtOfCurrentRegion: () => 200,
  }, table);
  assert.equal(s.getStaticNPCFactionData(0, 'Palace').id, 200, 'a palace nobody belongs to the COURT');
  assert.equal(s.getStaticNPCFactionData(0, 'Tavern').id, 100, 'anywhere else, the PEOPLE');
  assert.equal(s.getStaticNPCFactionData(852, 'Tavern').id, 200, 'Random_Ruler -> court');
  assert.equal(s.getStaticNPCFactionData(242, 'Tavern').id, 200, 'Random_Noble -> court');
  assert.equal(s.getStaticNPCFactionData(853, 'Tavern').id, 200, 'Random_Knight -> court');
  assert.equal(s.getStaticNPCFactionData(7, 'Tavern').id, 7, 'a real faction is left alone');
  // ...even inside a palace: only id 0 reads the building
  assert.equal(s.getStaticNPCFactionData(7, 'Palace').id, 7);
});

test('getParentGroupFaction stops on Group, Province or Temple - and on a missing table', () => {
  const table = {
    1: faction({ id: 1, parent: 2, type: FACTION_TYPE.Individual }),
    2: faction({ id: 2, parent: 3, type: FACTION_TYPE.Subgroup }),
    3: faction({ id: 3, parent: 4, type: FACTION_TYPE.Group, name: 'the group' }),
    4: faction({ id: 4, parent: 0, type: FACTION_TYPE.Province }),
  };
  const { s } = makeSession({}, table);
  assert.equal(s.getParentGroupFaction(table[1]).id, 3, 'walks past the subgroup, stops at the GROUP');
  assert.equal(s.getParentGroupFaction(table[3]).id, 3, 'already a group: no walk');
  assert.equal(s.getParentGroupFaction(table[4]).id, 4, 'a province with no parent stops anyway');
  const temple = faction({ id: 9, parent: 4, type: FACTION_TYPE.Temple });
  assert.equal(s.getParentGroupFaction(temple).id, 9, 'a temple never reaches its god');
  // headless: no faction table at all
  const { s: bare } = makeSession({ factionData: undefined });
  assert.equal(bare.getParentGroupFaction(faction({ id: 5, parent: 6 })).id, 5, 'no table, no walk');
  assert.equal(bare.getParentGroupFaction(null).id, 0, 'and no faction reads the empty one');
});

// ---------------------------------------------------------------
// GetGreetingIndex (:1002-1063)
// ---------------------------------------------------------------

test('getGreetingIndex: no memberships is index 8 with the reputation untouched', () => {
  const { s } = makeSession();
  assert.deepEqual(s.getGreetingIndex(17, faction({ id: 5 })), { greetingIndex: 8, reputation: 17 },
    'a stranger, and the running reputation is handed straight back');
});

test('getGreetingIndex: the same guild returns 0 AT ONCE, before any other test can run', () => {
  const guild = faction({ id: 40, name: 'Mages Guild', enemy1: 99, ally1: 88 });
  const { s } = makeSession({ guildMemberships: () => [{ factionId: 40 }] }, { 40: guild });
  // the NPC group IS the guild, which also trivially shares enemies
  // and allies with itself - the early return is what stops those
  // loops adjusting the reputation
  assert.deepEqual(s.getGreetingIndex(0, guild), { greetingIndex: 0, reputation: 0 });
  assert.equal(s.npcData.npcFactionName, 'Mages Guild');
  assert.equal(s.npcData.pcFactionName, 'Mages Guild', 'both names are the guild');
});

test('getGreetingIndex: a shared parent is index 1 and +15', () => {
  const guild = faction({ id: 40, parent: 7, name: 'Mages Guild' });
  const npcF = faction({ id: 41, parent: 7, name: 'Scribes' });
  const { s } = makeSession({ guildMemberships: () => [{ factionId: 40 }] }, { 40: guild });
  assert.deepEqual(s.getGreetingIndex(0, npcF), { greetingIndex: 1, reputation: 15 });
  assert.equal(s.npcData.npcFactionName, 'Scribes');
  assert.equal(s.npcData.pcFactionName, 'Mages Guild');
  // one being the other's PARENT counts too, and a shared parent of 0
  // does NOT - the `!== 0` guards are load-bearing
  const orphanA = faction({ id: 40, parent: 0, name: 'A' });
  const orphanB = faction({ id: 41, parent: 0, name: 'B' });
  const { s: o } = makeSession({ guildMemberships: () => [{ factionId: 40 }] }, { 40: orphanA });
  assert.equal(o.getGreetingIndex(0, orphanB).greetingIndex, 8, 'two parentless factions are not siblings');
  const child = faction({ id: 41, parent: 40, name: 'child' });
  const { s: c } = makeSession({ guildMemberships: () => [{ factionId: 40 }] }, { 40: orphanA });
  assert.equal(c.getGreetingIndex(0, child).greetingIndex, 1, 'the guild is the NPC group-s parent');
});

test('THE UNGUARDED FIRST ARM: a FORWARD ally match overwrites a better index, a reversed one cannot', () => {
  // C# reads `IsAlly(guild, npc) || IsAlly(npc, guild) && greetingIndex > 2`
  // (:1035). && binds tighter, so only the REVERSED test is guarded.
  // Set up a shared parent (index 1, +15) AND a forward ally link:
  // the ally arm runs anyway and drags the index back down to 2.
  const guild = faction({ id: 40, parent: 7, name: 'Guild', ally1: 41 });
  const npcF = faction({ id: 41, parent: 7, name: 'NPCs' });
  const { s } = makeSession({ guildMemberships: () => [{ factionId: 40 }] }, { 40: guild });
  assert.deepEqual(s.getGreetingIndex(0, npcF), { greetingIndex: 2, reputation: 25 },
    'index 1 overwritten by 2, and BOTH reputation adjustments applied');
  // the reversed direction alone IS guarded, so the same shape with
  // the link the other way keeps index 1
  const guild2 = faction({ id: 40, parent: 7, name: 'Guild' });
  const npcF2 = faction({ id: 41, parent: 7, name: 'NPCs', ally1: 40 });
  const { s: s2 } = makeSession({ guildMemberships: () => [{ factionId: 40 }] }, { 40: guild2 });
  assert.deepEqual(s2.getGreetingIndex(0, npcF2), { greetingIndex: 1, reputation: 15 },
    'the guard on the reversed test holds - this is the asymmetry');
});

test('THE UNGUARDED FIRST ARM again, on the enemy test - and DFUs fixed -20', () => {
  const guild = faction({ id: 40, parent: 7, name: 'Guild', enemy1: 41 });
  const npcF = faction({ id: 41, parent: 7, name: 'NPCs' });
  const { s } = makeSession({ guildMemberships: () => [{ factionId: 40 }] }, { 40: guild });
  // shared parent (1, +15) then the unguarded forward enemy test (3, -20)
  assert.deepEqual(s.getGreetingIndex(0, npcF), { greetingIndex: 3, reputation: -5 },
    'classic SET the reputation to 20 here; DFU decreases by 20, and that is what is kept');
  const guild2 = faction({ id: 40, parent: 7, name: 'Guild' });
  const npcF2 = faction({ id: 41, parent: 7, name: 'NPCs', enemy1: 40 });
  const { s: s2 } = makeSession({ guildMemberships: () => [{ factionId: 40 }] }, { 40: guild2 });
  assert.equal(s2.getGreetingIndex(0, npcF2).greetingIndex, 1, 'reversed and guarded');
});

test('getGreetingIndex: enemies in common (4, +5) and allies in common (5, +5), each guarded properly', () => {
  const guild = faction({ id: 40, name: 'Guild', enemy1: 99 });
  const npcF = faction({ id: 41, name: 'NPCs', enemy2: 99 });
  const { s } = makeSession(
    { guildMemberships: () => [{ factionId: 40 }] },
    { 40: guild, 99: faction({ id: 99, name: 'The Common Enemy' }) });
  assert.deepEqual(s.getGreetingIndex(0, npcF), { greetingIndex: 4, reputation: 5 });
  assert.equal(s.npcData.enemyFactionName, 'The Common Enemy', 'named for the greeting macro');
  // a shared ZERO is not a shared enemy
  const g0 = faction({ id: 40, name: 'Guild' });
  const n0 = faction({ id: 41, name: 'NPCs' });
  const { s: z } = makeSession({ guildMemberships: () => [{ factionId: 40 }] }, { 40: g0 });
  assert.equal(z.getGreetingIndex(0, n0).greetingIndex, 8, 'three zeroes each side, and no match');
  // allies in common
  const ga = faction({ id: 40, name: 'Guild', ally3: 88 });
  const na = faction({ id: 41, name: 'NPCs', ally1: 88 });
  const { s: a } = makeSession(
    { guildMemberships: () => [{ factionId: 40 }] },
    { 40: ga, 88: faction({ id: 88, name: 'The Common Friend' }) });
  assert.deepEqual(a.getGreetingIndex(0, na), { greetingIndex: 5, reputation: 5 });
  assert.equal(a.npcData.allyFactionName, 'The Common Friend');
});

test('getGreetingIndex: the last two arms read the NPCs OWN relations through the table (6 and 7, each -5)', () => {
  // the guild is an ally of one of the NPC's enemies
  const guild = faction({ id: 40, name: 'Guild', ally1: 99 });
  const npcF = faction({ id: 41, name: 'NPCs', enemy1: 99 });
  const { s } = makeSession(
    { guildMemberships: () => [{ factionId: 40 }] },
    { 40: guild, 99: faction({ id: 99, name: 'Their Enemy' }) });
  assert.deepEqual(s.getGreetingIndex(0, npcF), { greetingIndex: 6, reputation: -5 });
  assert.equal(s.npcData.enemyFactionName, 'Their Enemy');
  // the guild is an enemy of one of the NPC's allies
  const g2 = faction({ id: 40, name: 'Guild', enemy1: 88 });
  const n2 = faction({ id: 41, name: 'NPCs', ally1: 88 });
  const { s: s2 } = makeSession(
    { guildMemberships: () => [{ factionId: 40 }] },
    { 40: g2, 88: faction({ id: 88, name: 'Their Friend' }) });
  assert.deepEqual(s2.getGreetingIndex(0, n2), { greetingIndex: 7, reputation: -5 });
  assert.equal(s2.npcData.allyFactionName, 'Their Friend');
  // both arms have to RESOLVE the NPC's own relations to fire: a
  // guild that resolves, pointing at relation ids the table does not
  // carry, reaches neither
  const dangling = faction({ id: 40, parent: 7, name: 'Guild', ally1: 77 });
  const npcDangling = faction({ id: 41, parent: 7, name: 'NPCs', enemy1: 777, ally1: 778 });
  const { s: d } = makeSession(
    { guildMemberships: () => [{ factionId: 40 }] }, { 40: dangling });
  assert.equal(d.getGreetingIndex(0, npcDangling).greetingIndex, 1,
    'only the shared parent fires - the unresolvable relations cannot');
});

test('THE ZERO-FACTION MATCH: an unresolvable guild reads as faction 0, and every empty slot matches it', () => {
  // C#'s GetFactionData leaves its out param as a default struct on a
  // miss, so guildFactionData.id is 0. Two tests then answer TRUE for
  // reasons that are really "both sides are empty": the sibling arm's
  // `npcGroupFaction.parent == guildFactionData.id` matches any
  // parentless faction, and IsAlly/IsEnemy compare an unset allyN or
  // enemyN slot (0) against that same id. Headless, this IS the
  // ladder's behaviour, so it is pinned rather than papered over.
  const npcF = faction({ id: 41, parent: 0, name: 'NPCs', ally1: 5, ally2: 6, ally3: 7, enemy1: 8, enemy2: 9, enemy3: 10 });
  const { s } = makeSession({ guildMemberships: () => [{ factionId: 40 }], factionData: () => null });
  assert.deepEqual(s.getGreetingIndex(0, npcF), { greetingIndex: 1, reputation: 15 },
    'with every slot filled, only the parentless sibling arm can match faction 0');
  // and the ally arm matches faction 0 through an EMPTY slot - but
  // only from the reversed direction, which is guarded, so it needs
  // an NPC faction the sibling arm did not already claim
  const loose = faction({ id: 41, parent: 7, name: 'NPCs', ally1: 5, ally3: 7, enemy1: 8, enemy2: 9, enemy3: 10 });
  const { s: l } = makeSession({ guildMemberships: () => [{ factionId: 40 }], factionData: () => null });
  assert.deepEqual(l.getGreetingIndex(0, loose), { greetingIndex: 2, reputation: 10 },
    'ally2 is unset, and an unset slot IS faction 0');
  // ...and once the sibling arm HAS claimed it at index 1, the same
  // empty slot cannot: the guard on the reversed test holds
  const bothWays = faction({ id: 41, parent: 0, name: 'NPCs', ally1: 5, ally3: 7, enemy1: 8, enemy2: 9, enemy3: 10 });
  const { s: b } = makeSession({ guildMemberships: () => [{ factionId: 40 }], factionData: () => null });
  assert.deepEqual(b.getGreetingIndex(0, bothWays), { greetingIndex: 1, reputation: 15 });
  // an NPC faction with a real parent and no empty slots matches nothing
  const rooted = faction({ id: 41, parent: 7, name: 'NPCs', ally1: 5, ally2: 6, ally3: 7, enemy1: 8, enemy2: 9, enemy3: 10 });
  const { s: r } = makeSession({ guildMemberships: () => [{ factionId: 40 }], factionData: () => null });
  assert.equal(r.getGreetingIndex(0, rooted).greetingIndex, 8);
});

// ---------------------------------------------------------------
// GetNPCGreetingRecord (:943-993)
// ---------------------------------------------------------------

test('getNPCGreetingRecord: a PROVINCE parent skips the faction ladder entirely', () => {
  const table = { 5: faction({ id: 5, parent: 7, type: FACTION_TYPE.Individual }), 7: faction({ id: 7, parent: 0, type: FACTION_TYPE.Province }) };
  const { s } = makeSession({}, table);
  s.npcData = newNPCData({ factionData: table[5] });
  for (const [reaction, record] of [[-1, 7206], [0, 7207], [9, 7207], [10, 7208], [29, 7208], [30, 7209], [999, 7209]]) {
    s.reactionToPlayer = reaction;
    assert.equal(s.getNPCGreetingRecord(), record, `reaction ${reaction}`);
  }
  assert.equal(s.alreadyRejectedOnce, false, 'the province road never rejects');
});

test('THE STRANGER FLOOR: index 8 between rep 6 and 29 matches NEITHER arm and falls through', () => {
  // DFU's improvement over classic: at index 8, rep >= 30 is blocked
  // from the warm face, and the ordinary face needs rep <= 5. An NPC
  // liked a little - rep 6 to 29 - therefore satisfies neither test
  // and drops out of the faction ladder into the plain reaction one.
  const mk = (rep) => {
    const f = faction({ id: 5, parent: 0, type: FACTION_TYPE.Group, rep });
    const { s } = makeSession({ sgroupReputation: () => 1000 }, { 5: f });  // always beats the roll
    s.npcData = newNPCData({ factionData: f });
    s.reactionToPlayer = 30;
    return s;
  };
  assert.equal(mk(5).getNPCGreetingRecord(), GREETINGS[1 + 24], 'rep 5 takes the ordinary stranger face, 8570');
  assert.equal(mk(0).getNPCGreetingRecord(), 8570);
  assert.equal(mk(6).getNPCGreetingRecord(), VERY_LIKE_GREETING, 'rep 6 falls THROUGH to the reaction ladder');
  assert.equal(mk(29).getNPCGreetingRecord(), VERY_LIKE_GREETING, 'and so does 29');
  assert.equal(mk(30).getNPCGreetingRecord(), VERY_LIKE_GREETING, 'rep 30 is blocked from the warm face BY the index-8 test');
});

test('getNPCGreetingRecord: at any index but 8, rep 30 takes the warm face and rep 5 the ordinary one', () => {
  const guild = faction({ id: 40, parent: 7, name: 'Guild' });
  const mk = (rep) => {
    const f = faction({ id: 41, parent: 7, type: FACTION_TYPE.Group, rep });
    const { s } = makeSession(
      { sgroupReputation: () => 1000, guildMemberships: () => [{ factionId: 40 }] },
      { 5: f, 40: guild, 41: f });
    s.npcData = newNPCData({ factionData: f });
    return s;
  };
  // index 1 (shared parent)
  assert.equal(mk(30).getNPCGreetingRecord(), GREETINGS[3], 'rep 30 at index 1 -> 8553');
  assert.equal(GREETINGS[3], 8553);
  assert.equal(mk(5).getNPCGreetingRecord(), GREETINGS[4], 'rep 5 at index 1 -> 8554');
  assert.equal(mk(29).getNPCGreetingRecord(), GREETINGS[4], 'and so does 29 - the second test needs only index != 8');
});

test('THE REJECTION the greeting itself decides: the roll going against the player stamps alreadyRejectedOnce', () => {
  const f = faction({ id: 5, parent: 0, type: FACTION_TYPE.Group, rep: 30 });
  const { s } = makeSession({ sgroupReputation: () => -1000 }, { 5: f });   // never beats the roll
  s.npcData = newNPCData({ factionData: f });
  assert.equal(s.alreadyRejectedOnce, false);
  const record = s.getNPCGreetingRecord();
  assert.equal(record, GREETINGS[2 + 24], 'the index-8 rejection row, 8571');
  assert.equal(GREETINGS[26], 8571);
  assert.equal(s.alreadyRejectedOnce, true, 'the lookup SET the flag - a side effect TalkToNpc reads next');
});

test('the sgroup reputation rides in only BELOW social group 5', () => {
  const seen = [];
  const mk = (sgroup) => {
    const f = faction({ id: 5, parent: 0, type: FACTION_TYPE.Group, rep: 0, sgroup });
    const { s } = makeSession({ sgroupReputation: (g) => { seen.push(g); return 1000; } }, { 5: f });
    s.npcData = newNPCData({ factionData: f });
    s.reactionToPlayer = -999;
    return s;
  };
  mk(4).getNPCGreetingRecord();
  assert.deepEqual(seen, [4], 'group 4 is read');
  seen.length = 0;
  const five = mk(5);
  five.getNPCGreetingRecord();
  assert.deepEqual(seen, [], 'group 5 is NOT - the reputation never arrives, so the roll decides alone');
  assert.equal(five.alreadyRejectedOnce, true, 'and with rep 0 against a roll of -10..5 it can be rejected');
});

// ---------------------------------------------------------------
// The target chain (:805-865)
// ---------------------------------------------------------------

test('setTargetStaticNPC: the social group is CLAMPED to Merchants at 5 and above', () => {
  const mk = (sgroup) => {
    const { s } = makeSession();
    s.setTargetStaticNPC({ displayName: 'Sirien', data: { race: 'Breton' } }, faction({ id: 1, sgroup, ggroup: 3 }));
    return s.npcData;
  };
  assert.equal(mk(0).socialGroup, 0);
  assert.equal(mk(4).socialGroup, 4, 'four is the last group that is itself');
  assert.equal(mk(5).socialGroup, SOCIAL_GROUP.Merchants, 'five and up are MERCHANTS');
  assert.equal(mk(7).socialGroup, SOCIAL_GROUP.Merchants);
  assert.equal(mk(0).guildGroup, 3, 'the guild group is taken whole, unclamped');
  assert.equal(mk(0).race, 'Breton');
  assert.equal(mk(0).isSpyMaster, false, 'the target chain always clears the spymaster flag');
  assert.equal(mk(0).allowGuildResponse, true, 'and a fresh NPCData allows guild responses');
});

test('setTargetMobileNPC: every mobile is a COMMONER of no guild, whatever the faction says', () => {
  const { s, calls } = makeSession();
  s.setTargetMobileNPC({ nameNPC: 'A Passerby', race: 'Redguard', personFaceRecordId: 12 }, faction({ id: 1, sgroup: 3, ggroup: 9 }));
  assert.equal(s.npcData.socialGroup, SOCIAL_GROUP.Commoners, 'C#s literal, not the faction-s sgroup');
  assert.equal(s.npcData.guildGroup, 0);
  assert.equal(s.npcData.factionData.id, 1, 'the faction itself IS kept - it is the greeting-s road');
  assert.equal(s.nameNPC, 'A Passerby');
  assert.deepEqual(calls.filter((c) => c[0] === 'target')[0][1].portrait, { archive: 'CommonFaces', record: 12 },
    'mobiles always draw from CommonFaces');
  assert.ok(calls.some((c) => c[0] === 'personList'), 'the Where-is Person list is rebuilt so a questor can hide');
});

test('a REPEAT click on the same target is a no-op that keeps the NPCData - counter and all', () => {
  const npc = { displayName: 'Sirien', data: { race: 'Breton' } };
  const { s, calls } = makeSession();
  s.setTargetStaticNPC(npc, faction({ id: 1 }));
  s.npcData.numAnswersGivenTellMeAboutOrRumors = 1;
  s.alreadyRejectedOnce = true;
  calls.length = 0;
  s.setTargetStaticNPC(npc, faction({ id: 2 }));
  assert.equal(s.sameTalkTargetAsBefore, true);
  assert.equal(s.npcData.numAnswersGivenTellMeAboutOrRumors, 1, 'the session survives the second click');
  assert.equal(s.npcData.factionData.id, 1, 'and the NEW faction is discarded with the rest of it');
  assert.equal(s.alreadyRejectedOnce, true, 'the rejection is NOT cleared - only a new target clears it');
  assert.deepEqual(calls, [], 'no portrait, no name, no list rebuild');
});

// ---------------------------------------------------------------
// The click arms (:726-803) and TalkToNpc (:2615-2663)
// ---------------------------------------------------------------

test('talkToMobileNPC: the region-s PEOPLE speak for every mobile, and the counter is reset AFTER the target chain', () => {
  const table = { 100: faction({ id: 100, name: 'People of Daggerfall' }) };
  const seenReaction = [];
  const { s } = makeSession({
    peopleOfCurrentRegion: () => 100,
    reactionToPlayer: (f) => { seenReaction.push(f?.id ?? null); return 5; },
  }, table);
  const npc = { nameNPC: 'A Passerby' };
  const out = s.talkToMobileNPC(npc);
  assert.equal(out.kind, 'talk');
  assert.equal(s.currentNPCType, NPC_TYPE.Mobile);
  assert.deepEqual(seenReaction, [100], 'the PEOPLE faction decides the reaction');
  assert.equal(s.reactionToPlayer, 5);
  // the reset lands on a REPEAT click too, where SetTargetNPC returned
  // early and the NPCData survived - which is exactly why C# resets
  // here rather than inside the target chain
  s.npcData.numAnswersGivenTellMeAboutOrRumors = 1;
  s.talkToMobileNPC(npc);
  assert.equal(s.sameTalkTargetAsBefore, true);
  assert.equal(s.npcData.numAnswersGivenTellMeAboutOrRumors, 0, 'one correct answer per talk session, as in classic');
});

test('THE QUESTOR DOOR: a static NPC carrying work opens the OFFER and never reaches the conversation', () => {
  const { s, calls } = makeSession();
  s.npcsWithWork.set(77, { npc: { nameSeed: 77 }, socialGroup: SOCIAL_GROUP.Merchants, buildingName: 'The Inn' });
  const out = s.talkToStaticNPC({ data: { nameSeed: 77, factionID: 0 } });
  assert.equal(out.kind, 'questOffer');
  assert.equal(out.socialGroup, SOCIAL_GROUP.Merchants);
  assert.equal(out.menu, true, 'the menu flag defaults TRUE and rides the offer');
  assert.equal(s.currentNPCType, NPC_TYPE.Unset, 'the door closes BEFORE the NPC type is even set');
  assert.deepEqual(calls, [], 'no greeting, no window, no target chain');
  // a CHILD carrying work is not offered anything
  const { s: kid } = makeSession();
  kid.npcsWithWork.set(77, { npc: { nameSeed: 77 }, socialGroup: 1, buildingName: 'The Inn' });
  assert.equal(kid.talkToStaticNPC({ isChildNPC: true, data: { nameSeed: 77, factionID: 0 } }).kind, 'talk');
  // ...and an active questor closes the door for everyone
  const { s: busy } = makeSession({ isLastNPCClickedAnActiveQuestor: () => true });
  busy.npcsWithWork.set(77, { npc: { nameSeed: 77 }, socialGroup: 1, buildingName: 'The Inn' });
  assert.equal(busy.talkToStaticNPC({ data: { nameSeed: 77, factionID: 0 } }).kind, 'talk');
});

test('talkToStaticNPC: the parent walk stops on SIX types, three of them DFUs own additions', () => {
  const table = {
    1: faction({ id: 1, parent: 2, type: FACTION_TYPE.Subgroup }),
    2: faction({ id: 2, parent: 3, type: FACTION_TYPE.Official }),
    3: faction({ id: 3, parent: 4, type: FACTION_TYPE.Group, name: 'stops here' }),
    4: faction({ id: 4, parent: 0, type: FACTION_TYPE.Province }),
  };
  const seen = [];
  const { s } = makeSession({ reactionToPlayer: (f) => { seen.push(f?.id); return 0; } }, table);
  s.talkToStaticNPC({ data: { factionID: 1 } });
  assert.deepEqual(seen, [3], 'walked 1 -> 2 -> 3 and stopped at the Group');
  for (const [type, name] of [[FACTION_TYPE.People, 'People'], [FACTION_TYPE.Courts, 'Courts'], [FACTION_TYPE.Individual, 'Individual']]) {
    const t = { 1: faction({ id: 1, parent: 2, type }), 2: faction({ id: 2, parent: 0, type: FACTION_TYPE.Group }) };
    const hits = [];
    const { s: p } = makeSession({ reactionToPlayer: (f) => { hits.push(f?.id); return 0; } }, t);
    p.talkToStaticNPC({ data: { factionID: 1 } });
    assert.deepEqual(hits, [1], `${name} stops the walk - DFUs addition, "since they have their own reputation"`);
  }
});

test('talkToStaticNPC: the spymaster flags, and allowGuildResponse-s double negative', () => {
  const mk = (opts) => {
    const { s } = makeSession();
    s.talkToStaticNPC({ data: { factionID: 0 } }, opts);
    return s.npcData;
  };
  assert.equal(mk({}).allowGuildResponse, true, 'the default click allows it');
  assert.equal(mk({ isSpyMaster: true }).allowGuildResponse, true, 'a spymaster FROM the guild menu still allows it');
  assert.equal(mk({ menu: false }).allowGuildResponse, true, 'and so does a non-menu click by anyone else');
  assert.equal(mk({ menu: false, isSpyMaster: true }).allowGuildResponse, false,
    'only both together close it - !(!menu && isSpyMaster)');
  assert.equal(mk({ isSpyMaster: true }).isSpyMaster, true);
});

test('talkToNpc: the three closed doors, in C#s order', () => {
  // 1. the racial override wins over everything, before any reaction
  const { s: sup, calls: sc } = makeSession({ suppressTalk: () => 'You cannot speak.', reactionToPlayer: () => 999 });
  assert.deepEqual(sup.talkToNpc(), { kind: 'suppressed', message: 'You cannot speak.' });
  assert.deepEqual(sc, [['box', 'You cannot speak.']]);
  // 2. reaction BELOW -20 - the boundary itself still talks
  const { s: hated } = makeSession();
  hated.reactionToPlayer = -21;
  assert.equal(hated.talkToNpc().kind, 'noResponse');
  hated.reactionToPlayer = -20;
  assert.equal(hated.talkToNpc().kind, 'talk', '-20 is NOT below -20');
  // 3. a standing rejection
  const { s: rej } = makeSession();
  rej.alreadyRejectedOnce = true;
  assert.equal(rej.talkToNpc().kind, 'noResponse');
});

test('THE REJECTION FOUND MID-GREETING: the record lookup rejects, and the RAW tokens answer in a box', () => {
  // alreadyRejectedOnce is false at the top, so the first door is
  // open - and then GetNPCGreetingRecord sets it. C# tests it AGAIN
  // (:2641) and answers with GetRandomTokens of the record it just
  // chose, in a message box, never opening the window.
  const f = faction({ id: 5, parent: 0, type: FACTION_TYPE.Group, rep: 30 });
  const { s, calls } = makeSession({ sgroupReputation: () => -1000 }, { 5: f });
  s.npcData = newNPCData({ factionData: f });
  const out = s.talkToNpc();
  assert.equal(out.kind, 'rejected');
  assert.equal(out.record, 8571, 'the index-8 rejection row');
  assert.deepEqual(out.tokens, [{ text: 'tokens:8571' }], 'the RAW tokens, not an expanded record');
  assert.ok(!calls.some((c) => c[0] === 'push'), 'and the window never opens');
  assert.ok(!calls.some((c) => c[0] === 'record'), 'nor is the record ever expanded');
});

test('talkToNpc: the window road resets knowledge only for a NEW target, and always resets the tone', () => {
  const { s, calls } = makeSession();
  s.reactionToPlayer = 0;
  s.sameTalkTargetAsBefore = false;
  assert.equal(s.talkToNpc().kind, 'talk');
  assert.ok(calls.some((c) => c[0] === 'resetKnowledge'), 'a new target forgets what the last NPC knew');
  assert.deepEqual(calls.filter((c) => c[0] === 'push').length, 1);
  assert.ok(calls.some((c) => c[0] === 'resetTone'));
  calls.length = 0;
  s.sameTalkTargetAsBefore = true;
  s.talkToNpc();
  assert.ok(!calls.some((c) => c[0] === 'resetKnowledge'), 'the same NPC remembers');
  assert.ok(calls.some((c) => c[0] === 'resetTone'), 'but the tone session restarts either way');
});

// ---------------------------------------------------------------
// The questor pool (:2551-2610, :2762-2876)
// ---------------------------------------------------------------

test('the questor pool: workAvailable, the offer test, and removal', () => {
  const { s } = makeSession();
  assert.equal(s.workAvailable, false, 'an empty pool offers nothing');
  assert.equal(s.isNpcOfferingQuest(77), false);
  s.npcsWithWork.set(77, { npc: { nameSeed: 77 }, socialGroup: 1, buildingName: 'The Inn' });
  assert.equal(s.workAvailable, true);
  assert.equal(s.isNpcOfferingQuest(77), true);
  assert.equal(s.isNpcOfferingQuest(78), false, 'someone else-s seed is not in the pool');
  s.removeNpcQuestor(77);
  assert.equal(s.workAvailable, false, 'the offer flow spends the questor');
});

test('isCastleNpcOfferingQuest: one 25% roll ever, and the pool is stamped only when the guards pass', () => {
  const mkCastle = (roll, over = {}) => {
    const { s } = makeSession({ isPlayerInsideCastle: () => true, rolls: () => roll, ...over });
    return s;
  };
  // Range(0, 4) === 0 is the offer, and 0.9 * 4 = 3
  assert.equal(mkCastle(0.0).isCastleNpcOfferingQuest(77), true, 'a roll of 0 offers');
  assert.equal(mkCastle(0.3).isCastleNpcOfferingQuest(77), false, 'a roll of 1 does not');
  assert.equal(mkCastle(0.9).isCastleNpcOfferingQuest(77), false, 'nor a roll of 3');
  // spoken to either way
  const spent = mkCastle(0.9);
  spent.isCastleNpcOfferingQuest(77);
  assert.equal(spent.castleNPCsSpokenTo.get(77), true, 'a refusal still spends the NPC');
  assert.equal(spent.isCastleNpcOfferingQuest(77), false, 'and the second ask never rolls');
  // ...but a failed GUARD does not spend them
  const outside = makeSession({ isPlayerInsideCastle: () => false, rolls: () => 0 }).s;
  assert.equal(outside.isCastleNpcOfferingQuest(77), false);
  assert.equal(outside.castleNPCsSpokenTo.size, 0, 'outside a castle, nobody is marked as spoken to');
  const busy = mkCastle(0, { isLastNPCClickedAnActiveQuestor: () => true });
  assert.equal(busy.isCastleNpcOfferingQuest(77), false);
  assert.equal(busy.castleNPCsSpokenTo.size, 0, 'nor while a questor is active - they can be rolled later');
});

test('setRandomQuestor / getQuestor*: the pick, the SEEDED name, and the empty-pool no-op', () => {
  const { s } = makeSession({ fullName: (bank, gender) => `${bank}:${gender}` });
  s.selectedNpcWorkKey = 999;
  s.setRandomQuestor();
  assert.equal(s.selectedNpcWorkKey, 999, 'an empty pool leaves the standing key ALONE');
  s.npcsWithWork.set(10, { npc: { nameSeed: 10, nameBank: 'Breton', gender: 'female' }, socialGroup: 1, buildingName: 'The Inn' });
  s.npcsWithWork.set(20, { npc: { nameSeed: 20, nameBank: 'Redguard', gender: 'male' }, socialGroup: 3, buildingName: 'The Palace' });
  s.setRandomQuestor();
  assert.ok([10, 20].includes(s.selectedNpcWorkKey));
  s.selectedNpcWorkKey = 20;
  assert.equal(s.getQuestorName(), 'Redguard:male');
  assert.equal(s.getQuestorGender(), 'male');
  assert.equal(s.getQuestorLocation(), 'The Palace');
  // ...and asking twice answers the same, because the name is seeded
  // by the questor-s own nameSeed
  assert.equal(s.getQuestorName(), 'Redguard:male');
  s.selectedNpcWorkKey = 404;
  assert.equal(s.getQuestorName(), '', 'a key nobody carries answers empty rather than throwing');
  assert.equal(s.getQuestorGender(), null);
  assert.equal(s.getQuestorLocation(), '');
});

test('buildQuestorPool: the 25% roll, the three social groups, and the named-building drop', () => {
  // the candidate's social group is RESOLVED from its faction id, not
  // taken as given - so the fixture hands out faction ids and the
  // table decides
  const npc = (nameSeed, over = {}) => ({ nameSeed, factionID: 1, gender: 'male', isChild: false, ...over });
  const building = (over = {}) => ({
    buildingKey: 5, buildingName: 'The Inn', buildingType: 'Tavern', isNamedBuilding: true, npcs: [], ...over,
  });
  const TABLE = {};
  for (let g = 0; g <= 7; g++) TABLE[g + 1] = faction({ id: g + 1, sgroup: g });
  // Range(0,4) with `< 3` CONTINUING: only a roll of 3 offers work
  const mk = (roll, buildings, over = {}) => {
    const { s } = makeSession(
      { rolls: () => roll, currentLocationIndex: () => 1, nameBankOfCurrentRegion: () => 'Breton', ...over },
      TABLE);
    s.buildQuestorPool(buildings);
    return s;
  };
  assert.equal(mk(0.9, [building({ npcs: [npc(1)] })]).npcsWithWork.size, 1, 'a roll of 3 offers');
  assert.equal(mk(0.5, [building({ npcs: [npc(1)] })]).npcsWithWork.size, 0, 'a roll of 2 does not');
  assert.equal(mk(0.0, [building({ npcs: [npc(1)] })]).npcsWithWork.size, 0, 'nor a roll of 0');
  // only three social groups are candidates at all
  for (const [group, allowed] of [[0, true], [1, true], [2, false], [3, true], [4, false], [5, false], [7, false]]) {
    const s = mk(0.9, [building({ npcs: [npc(1, { factionID: group + 1 })] })]);
    assert.equal(s.npcsWithWork.size, allowed ? 1 : 0, `social group ${group}`);
  }
  // the sgroup is read UNCLAMPED here - a group-5 faction is NOT
  // folded to Merchants the way SetTargetNPC folds it
  assert.equal(mk(0.9, [building({ npcs: [npc(1, { factionID: 6 })] })]).npcsWithWork.size, 0,
    'group 5 is simply not a candidate, not a Merchant');
  // and a candidate with faction id 0 is resolved through the same
  // court/people redirect a click uses
  const viaPeople = mk(0.9, [building({ npcs: [npc(1, { factionID: 0 })] })],
    { peopleOfCurrentRegion: () => 2, courtOfCurrentRegion: () => 3 });
  assert.equal(viaPeople.npcsWithWork.size, 1, 'faction 0 in a tavern reads the PEOPLE, social group 1');
  const viaCourt = mk(0.9, [building({ buildingType: 'Palace', npcs: [npc(1, { factionID: 0 })] })],
    { peopleOfCurrentRegion: () => 2, courtOfCurrentRegion: () => 6 });
  assert.equal(viaCourt.npcsWithWork.size, 0, 'and in a PALACE the court - here a group-5 faction, so no work');
  // a child is dropped AFTER the roll is spent
  assert.equal(mk(0.9, [building({ npcs: [npc(1, { isChild: true })] })]).npcsWithWork.size, 0);
  // an UNNAMED building's candidate is built and then dropped
  assert.equal(mk(0.9, [building({ isNamedBuilding: false, npcs: [npc(1)] })]).npcsWithWork.size, 0);
  // the entry carries the building key, the region's name bank and the
  // building name, and selectedNpcWorkKey follows the LAST one added
  const full = mk(0.9, [building({ npcs: [npc(1), npc(2)] })]);
  assert.equal(full.selectedNpcWorkKey, 2, 'the last questor added is silently selected');
  assert.deepEqual(full.npcsWithWork.get(1), {
    npc: { nameSeed: 1, factionID: 1, gender: 'male', isChild: false, buildingKey: 5, nameBank: 'Breton' },
    socialGroup: SOCIAL_GROUP.Commoners,
    buildingName: 'The Inn',
  });
});

test('buildQuestorPool: the location gate rebuilds ONCE, and an empty walk never claims the location', () => {
  const npc = (nameSeed) => ({ nameSeed, factionID: 1, gender: 'male', isChild: false });
  const buildings = [{ buildingKey: 5, buildingName: 'The Inn', buildingType: 'Tavern', isNamedBuilding: true, npcs: [npc(1)] }];
  let where = 1;
  const { s } = makeSession(
    { rolls: () => 0.9, currentLocationIndex: () => where, nameBankOfCurrentRegion: () => 'Breton' },
    { 1: faction({ id: 1, sgroup: SOCIAL_GROUP.Merchants }) });
  assert.equal(s.buildQuestorPool(buildings), true, 'the first walk builds');
  assert.equal(s.npcsWithWork.size, 1);
  s.removeNpcQuestor(1);
  assert.equal(s.buildQuestorPool(buildings), false, 'the same location does NOT rebuild');
  assert.equal(s.npcsWithWork.size, 0, 'so a spent questor stays spent while you are in town');
  where = 2;
  assert.equal(s.buildQuestorPool(buildings), true, 'a new location rebuilds');
  assert.equal(s.npcsWithWork.size, 1);
  // an empty walk clears the pool but never stamps the flag, so the
  // next call tries again
  where = 3;
  assert.equal(s.buildQuestorPool([]), true);
  assert.equal(s.exteriorUsedForQuestors, 2, 'still the LAST location that had a building to walk');
  assert.equal(s.buildQuestorPool(buildings), true, 'and location 3 is walked properly on the next try');
});

// ---------------------------------------------------------------
// The post-quest greeting (:909-941) and the save halves
// ---------------------------------------------------------------

test('getNPCQuestGreeting: a STATIC questor with a post-quest message greets with it; mobiles never do', () => {
  const person = { isPerson: true, isQuestor: true, isIndividualNPC: false, questorData: { nameSeed: 77 } };
  const quest = { resources: new Map([['_qgiver_', person]]) };
  const expanded = [];
  const deps = {
    questorPostMessages: () => new Map([[1n, [{ text: 'well done' }]]]),
    getQuest: () => quest,
    isNPCDataEqual: (a, b) => a?.nameSeed === b?.nameSeed,
    // ExpandQuestMessage writes back INTO the token it came from
    expandQuestMessage: (q, tokens, reveal) => { expanded.push(reveal); tokens[0].text = 'Well done.'; },
  };
  const { s } = makeSession(deps);
  s.currentNPCType = NPC_TYPE.Static;
  s.lastTargetStaticNPC = { data: { nameSeed: 77 } };
  assert.equal(s.getNPCQuestGreeting(), 'Well done.');
  assert.deepEqual(expanded, [true], 'reveal TRUE - a post-quest greeting can still reveal dialog-linked resources');
  // a DIFFERENT static NPC gets nothing
  s.lastTargetStaticNPC = { data: { nameSeed: 78 } };
  assert.equal(s.getNPCQuestGreeting(), '');
  // an INDIVIDUAL questor matches on the faction id instead
  const individual = { isPerson: true, isQuestor: true, isIndividualNPC: true, questorData: { nameSeed: 1 }, factionData: { id: 300 } };
  const { s: ind } = makeSession({ ...deps, getQuest: () => ({ resources: new Map([['_q_', individual]]) }) });
  ind.currentNPCType = NPC_TYPE.Static;
  ind.lastTargetStaticNPC = { data: { nameSeed: 78, factionID: 300 } };
  assert.equal(ind.getNPCQuestGreeting(), 'Well done.');
  // a MOBILE never reaches the loop
  const { s: mob } = makeSession(deps);
  mob.currentNPCType = NPC_TYPE.Mobile;
  mob.lastTargetStaticNPC = { data: { nameSeed: 77 } };
  assert.equal(mob.getNPCQuestGreeting(), '', 'the type gate is the first line');
  // a message whose quest is gone is skipped, not thrown over
  const { s: gone } = makeSession({ ...deps, getQuest: () => null });
  gone.currentNPCType = NPC_TYPE.Static;
  gone.lastTargetStaticNPC = { data: { nameSeed: 77 } };
  assert.equal(gone.getNPCQuestGreeting(), '');
});

test('the quest greeting SHORT-CIRCUITS the faction one, and rides through talkToNpc', () => {
  const person = { isPerson: true, isQuestor: true, isIndividualNPC: false, questorData: { nameSeed: 77 } };
  const { s, calls } = makeSession({
    questorPostMessages: () => new Map([[1n, [{ text: 'x' }]]]),
    getQuest: () => ({ resources: new Map([['_qgiver_', person]]) }),
    isNPCDataEqual: (a, b) => a?.nameSeed === b?.nameSeed,
    expandQuestMessage: (q, tokens) => { tokens[0].text = 'Thank you again.'; },
  });
  s.currentNPCType = NPC_TYPE.Static;
  s.lastTargetStaticNPC = { data: { nameSeed: 77 } };
  const out = s.talkToNpc();
  assert.deepEqual(out, { kind: 'talk', greeting: 'Thank you again.' });
  assert.ok(!calls.some((c) => c[0] === 'record'), 'no greeting record is ever drawn');
  assert.ok(calls.some((c) => c[0] === 'push'), 'and the window opens on it');
});

test('the conversation save halves round-trip as a detached fixed point', () => {
  const { s } = makeSession();
  s.npcsWithWork.set(10, { npc: { nameSeed: 10, nameBank: 'Breton' }, socialGroup: 1, buildingName: 'The Inn' });
  s.castleNPCsSpokenTo.set(55, true);
  const saved = s.getSaveData();
  // mutating the live session must not reach the snapshot
  s.npcsWithWork.get(10).npc.nameBank = 'CHANGED';
  s.npcsWithWork.set(11, { npc: { nameSeed: 11 }, socialGroup: 1, buildingName: 'x' });
  s.castleNPCsSpokenTo.set(56, true);
  const { s: restored } = makeSession();
  restored.restoreSaveData(saved);
  assert.equal(restored.npcsWithWork.size, 1);
  assert.equal(restored.npcsWithWork.get(10).npc.nameBank, 'Breton', 'the snapshot is detached');
  assert.deepEqual([...restored.castleNPCsSpokenTo.entries()], [[55, true]]);
  // ...and restoring again from the SAME snapshot answers the same
  const { s: again } = makeSession();
  again.restoreSaveData(saved);
  assert.deepEqual(again.getSaveData(), saved, 'a fixed point');
});

test('restoreSaveData: an absent half keeps what the session had - it is never emptied', () => {
  const { s } = makeSession();
  s.npcsWithWork.set(10, { npc: { nameSeed: 10 }, socialGroup: 1, buildingName: 'The Inn' });
  s.castleNPCsSpokenTo.set(55, true);
  s.restoreSaveData({});
  assert.equal(s.npcsWithWork.size, 1, 'C# restores each half only when the save CARRIES it (:2541-2546)');
  assert.equal(s.castleNPCsSpokenTo.size, 1);
  s.restoreSaveData(null);
  assert.equal(s.npcsWithWork.size, 1, 'and a null envelope is the same as an empty one');
  s.restoreSaveData({ npcsWithWork: [], castleNPCsSpokenTo: [] });
  assert.equal(s.npcsWithWork.size, 0, 'an EMPTY half, though, is a real value and does empty it');
  assert.equal(s.castleNPCsSpokenTo.size, 0);
});

test('startNewConversation: the question reset goes THROUGH the seam, and the rebuild is deferred', () => {
  // The question counter, the opening text and the standing list item
  // are TalkManager fields in C# but live on TK-iii's AnswerPipeline
  // here. Keeping copies on this object would be a reset that never
  // reaches the thing doing the answering, so it rides a seam.
  const calls2 = [];
  let needsRebuild = false;
  const { s, calls } = makeSession({
    resetQuestionSession: () => calls2.push('questionReset'),
    needsTopicListRebuild: () => needsRebuild,
    clearTopicListRebuild: () => { needsRebuild = false; },
    assembleTopicLists: () => calls.push(['rebuild']),
    setupRumorMill: () => calls.push(['mill']),
  });
  s.startNewConversation();
  assert.deepEqual(calls2, ['questionReset'], 'the pipeline is told, not shadowed');
  assert.equal(s.numQuestionsAsked, undefined, 'and no second copy is kept here');
  assert.ok(!calls.some((c) => c[0] === 'rebuild'), 'no rebuild unless one was ASKED for');
  assert.ok(calls.some((c) => c[0] === 'mill'), 'the mill is set up every time');
  // the rebuild flag is ONE field in C#, raised by the topic
  // machinery and spent here - a copy on this object would be a flag
  // nothing ever raises
  calls.length = 0;
  needsRebuild = true;
  s.startNewConversation();
  assert.ok(calls.some((c) => c[0] === 'rebuild'));
  assert.equal(needsRebuild, false, 'and it is cleared, so the rebuild happens once');
  assert.equal(s.rebuildTopicLists, undefined, 'no shadow copy here either');
});

test('THE NAMES NOBODY READS are still written correctly by every arm', () => {
  // A grep of the whole DFU tree finds no reader for npcFactionName,
  // pcFactionName, allyFactionName or enemyFactionName - the
  // guild-flavoured greeting macros that would spend them are
  // unimplemented. They are pinned anyway: the day those macros land,
  // the values have to already be right.
  // no shared parent, so the index-4 arm is the one that fires
  const guild = faction({ id: 40, name: 'Mages Guild', enemy1: 99 });
  const npcF = faction({ id: 41, name: 'The Scribes', enemy2: 99 });
  const { s } = makeSession(
    { guildMemberships: () => [{ factionId: 40 }] },
    { 40: guild, 99: faction({ id: 99, name: 'The Common Enemy' }) });
  assert.equal(s.getGreetingIndex(0, npcF).greetingIndex, 4);
  assert.equal(s.npcData.npcFactionName, 'The Scribes', 'the NPC-s group');
  assert.equal(s.npcData.pcFactionName, 'Mages Guild', 'the PC-s guild');
  assert.equal(s.npcData.enemyFactionName, 'The Common Enemy');
  assert.equal(s.npcData.allyFactionName, '', 'untouched by an arm that has no ally to name');
});

test('TalkToNpc clears BOTH halves of the tone session - the cache is this object-s own field', () => {
  // C# clears lastToneIndex AND toneReactionForTalkSession[0..2] in
  // the same four lines (:2659-2662). The first lives on TK-iii's
  // pipeline and rides a seam; the second is TalkManager's field, so
  // it is owned here. A host left to clear it would answer for the
  // next NPC with the last one's cached reaction - the same shape of
  // bug as the tone gate TK-iii's re-read caught.
  const { s, calls } = makeSession();
  assert.deepEqual(s.toneReactionForTalkSession, [0, 0, 0], 'a fresh session starts empty');
  s.toneReactionForTalkSession[0] = 17;
  s.toneReactionForTalkSession[1] = 8;
  s.toneReactionForTalkSession[2] = -4;
  assert.equal(s.talkToNpc().kind, 'talk');
  assert.deepEqual(s.toneReactionForTalkSession, [0, 0, 0], 'all three tones forgotten');
  assert.ok(calls.some((c) => c[0] === 'resetTone'), 'and the pipeline-s half is told too');
  // a door that CLOSES leaves the cache alone - C# returns before the
  // reset in every one of the three
  const { s: hated } = makeSession();
  hated.reactionToPlayer = -21;
  hated.toneReactionForTalkSession[1] = 9;
  assert.equal(hated.talkToNpc().kind, 'noResponse');
  assert.deepEqual(hated.toneReactionForTalkSession, [0, 9, 0], 'no window, no reset');
});

test('THE UNCLONED QUESTOR POST: the expansion writes back into the STORED message, and keeps the default separator', () => {
  // ExpandQuestMessage stores each expanded string back into the token
  // it came from (QuestMacroHelper.cs:157), and C# hands it the array
  // straight out of dictQuestorPostQuestMessage (:927) - no clone.
  // GetAnswerFromTokensArray DOES clone, with DFU's own comment naming
  // the altering macros that must re-evaluate on every ask; this arm
  // does not, so an altering macro here freezes at its first value.
  const person = { isPerson: true, isQuestor: true, isIndividualNPC: false, questorData: { nameSeed: 77 } };
  const stored = [{ text: '%di' }, { text: '' }, { text: 'again' }];
  let n = 0;
  const { s } = makeSession({
    questorPostMessages: () => new Map([[1n, stored]]),
    getQuest: () => ({ resources: new Map([['_q_', person]]) }),
    isNPCDataEqual: (a, b) => a?.nameSeed === b?.nameSeed,
    expandQuestMessage: (q, tokens) => { tokens[0].text = `north${++n}`; },
  });
  s.currentNPCType = NPC_TYPE.Static;
  s.lastTargetStaticNPC = { data: { nameSeed: 77 } };
  assert.equal(s.getNPCQuestGreeting(), 'north1 again', 'the EMPTY token contributes the default separator');
  assert.equal(stored[0].text, 'north1', 'and the STORED message is expanded in place - the macro is gone');
  // asking again re-expands what is already expanded, which is exactly
  // what the clone elsewhere exists to prevent
  assert.equal(s.getNPCQuestGreeting(), 'north2 again');
  assert.equal(stored[0].text, 'north2', 'the stored tokens keep being overwritten');
});

// ---------------------------------------------------------------
// The event handlers (:3593-3629)
// ---------------------------------------------------------------

test('the six subscriptions do only THREE things, and one of them is the odd one out', () => {
  const calls = [];
  const { s } = makeSession({
    raiseTopicListRebuild: () => calls.push('raise'),
    getBuildingList: () => calls.push('buildings'),
    clearQuestInfo: () => calls.push('questInfo'),
    clearRumorMill: () => calls.push('mill'),
  });
  // the four that share two lines: map pixel changed, transition to
  // exterior, transition to dungeon EXTERIOR, and load
  s.onWorldChanged();
  assert.deepEqual(calls, ['raise', 'buildings'], 'ask for a rebuild, then refresh the buildings NOW');
  // the dungeon INTERIOR is the odd one out: it forgets the castle
  // pool and asks for nothing
  calls.length = 0;
  s.castleNPCsSpokenTo.set(1, true);
  s.castleNPCsSpokenTo.set(2, true);
  s.onEnterDungeonInterior();
  assert.equal(s.castleNPCsSpokenTo.size, 0, 'every castle NPC gets a fresh roll on each visit');
  assert.deepEqual(calls, [], 'and this transition alone asks for no rebuild');
  // a new game inherits neither quest topics nor rumors - C#s own
  // comment says why: the classic save import
  calls.length = 0;
  s.onStartGame();
  assert.deepEqual(calls, ['questInfo', 'mill']);
  // ...and the work pool is NOT cleared by any of them: it is the
  // location gate in buildQuestorPool that owns that
  s.npcsWithWork.set(9, { npc: { nameSeed: 9 }, socialGroup: 1, buildingName: 'x' });
  s.onWorldChanged();
  s.onEnterDungeonInterior();
  s.onStartGame();
  assert.equal(s.npcsWithWork.size, 1, 'the work pool survives every one of them');
});

test('the greeting ladder walks EVERY membership: a second guild can beat the first', () => {
  // The guards read `greetingIndex > N`, so they only bite once an
  // earlier membership has already set the index - which needs TWO
  // memberships to see at all. Guild 40 is an enemy (3); guild 50
  // shares a parent (1), and reaches it only because 3 > 1.
  const g40 = faction({ id: 40, name: 'Enemies', enemy1: 41 });
  const g50 = faction({ id: 50, parent: 7, name: 'Cousins' });
  const npcF = faction({ id: 41, parent: 7, name: 'NPCs' });
  const { s } = makeSession(
    { guildMemberships: () => [{ factionId: 40 }, { factionId: 50 }] },
    { 40: g40, 50: g50 });
  assert.deepEqual(s.getGreetingIndex(0, npcF), { greetingIndex: 1, reputation: -5 },
    'the enemy arm fires first (-20), then the sibling arm improves it to 1 (+15)');
  assert.equal(s.npcData.pcFactionName, 'Cousins', 'and the LAST arm to fire names the PC faction');
  // reversed order, the guards hold: once the index is 1, the enemy
  // arm-s reversed test cannot drag it back
  const g40b = faction({ id: 40, name: 'Enemies', enemy1: 41 });
  const npcRev = faction({ id: 41, parent: 7, name: 'NPCs', enemy1: 40 });
  const { s: r } = makeSession(
    { guildMemberships: () => [{ factionId: 50 }, { factionId: 40 }] },
    { 40: g40b, 50: g50 });
  assert.equal(r.getGreetingIndex(0, npcRev).greetingIndex, 3,
    'the FORWARD enemy test is unguarded, so it wins even from index 1 - THE UNGUARDED FIRST ARM again');
});

test('the greeting ladder guards are STRICTLY greater - an equal index never re-fires', () => {
  const shared = (id, over = {}) => faction({ id, parent: 7, name: `f${id}`, ...over });
  // two memberships that BOTH match the same way: the second must not
  // adjust the reputation again
  const g1 = shared(40);
  const g2 = shared(50);
  const npcF = shared(41);
  const { s } = makeSession(
    { guildMemberships: () => [{ factionId: 40 }, { factionId: 50 }] },
    { 40: g1, 50: g2 });
  assert.deepEqual(s.getGreetingIndex(0, npcF), { greetingIndex: 1, reputation: 15 },
    'ONE +15, not two - the guard is > and not >=');
  // the same for the two in-common loops
  const e1 = faction({ id: 40, name: 'a', enemy1: 99 });
  const e2 = faction({ id: 50, name: 'b', enemy1: 99 });
  const npcE = faction({ id: 41, name: 'n', enemy1: 99 });
  const { s: e } = makeSession(
    { guildMemberships: () => [{ factionId: 40 }, { factionId: 50 }] },
    { 40: e1, 50: e2, 99: faction({ id: 99, name: 'shared' }) });
  // 99 is neither faction's id, so the DIRECT enemy test never fires -
  // this is the in-common loop alone, and only once
  assert.deepEqual(e.getGreetingIndex(0, npcE), { greetingIndex: 4, reputation: 5 },
    'ONE +5, however many memberships share that enemy');
  const a1 = faction({ id: 40, name: 'a', ally1: 88 });
  const a2 = faction({ id: 50, name: 'b', ally1: 88 });
  const npcA = faction({ id: 41, name: 'n', ally2: 88 });
  const { s: a } = makeSession(
    { guildMemberships: () => [{ factionId: 40 }, { factionId: 50 }] },
    { 40: a1, 50: a2, 88: faction({ id: 88, name: 'shared' }) });
  assert.deepEqual(a.getGreetingIndex(0, npcA), { greetingIndex: 5, reputation: 5 },
    'and ONE +5 from the allies-in-common loop, however many memberships share it');
});

test('the in-common loops read EXACTLY three slots each, from the first', () => {
  // `for (i = 0; i < 3)` - a fourth slot does not exist, and reading
  // one would compare undefined to undefined and match everything;
  // starting at 1 would blind the arm to slot 1.
  const only1 = faction({ id: 40, name: 'g', enemy1: 99 });
  const npc1 = faction({ id: 41, name: 'n', enemy1: 99 });
  const { s: first } = makeSession(
    { guildMemberships: () => [{ factionId: 40 }] },
    { 40: only1, 99: faction({ id: 99, name: 'e' }) });
  assert.equal(first.getGreetingIndex(0, npc1).greetingIndex, 4, 'slot 1 on BOTH sides is read');
  const only3 = faction({ id: 40, name: 'g', ally3: 88 });
  const npc3 = faction({ id: 41, name: 'n', ally3: 88 });
  const { s: third } = makeSession(
    { guildMemberships: () => [{ factionId: 40 }] },
    { 40: only3, 88: faction({ id: 88, name: 'a' }) });
  assert.equal(third.getGreetingIndex(0, npc3).greetingIndex, 5, 'and slot 3 on both sides');
  // two factions sharing NOTHING match nothing - which is only true
  // because the loops stop at three
  const none = faction({ id: 40, name: 'g', ally1: 1, ally2: 2, ally3: 3, enemy1: 4, enemy2: 5, enemy3: 6 });
  const npcN = faction({ id: 41, parent: 7, name: 'n', ally1: 11, ally2: 12, ally3: 13, enemy1: 14, enemy2: 15, enemy3: 16 });
  const { s: n } = makeSession({ guildMemberships: () => [{ factionId: 40 }] }, { 40: none });
  assert.equal(n.getGreetingIndex(0, npcN).greetingIndex, 8, 'no fourth slot to match on');
});

test('the sibling test needs BOTH parents non-zero for its first arm', () => {
  // `g.parent !== 0 && npcF.parent !== 0 && g.parent === npcF.parent`
  // - the two guards are ANDed, so a guild with no parent cannot be
  // a sibling of anything through this arm
  const orphanGuild = faction({ id: 40, parent: 0, name: 'g' });
  const rooted = faction({ id: 41, parent: 7, name: 'n' });
  const { s } = makeSession({ guildMemberships: () => [{ factionId: 40 }] }, { 40: orphanGuild });
  assert.equal(s.getGreetingIndex(0, rooted).greetingIndex, 8,
    'a parentless guild is nobodys sibling - and 41s parent 7 is not the guilds id 40 either');
});

test('THE HEADLESS CHARTER: every absent seam on this module reads its C# default', () => {
  const bare = new NPCSession({});
  // the faction resolution with no PlayerGPS at all: id 0 either way
  assert.equal(bare.getStaticNPCFactionData(0, 'Palace'), null, 'no court seam, no faction');
  assert.equal(bare.getStaticNPCFactionData(0, 'Tavern'), null, 'no people seam either');
  // the click arms still answer, on a reaction of 0
  const out = bare.talkToMobileNPC({ nameNPC: 'A Passerby' });
  assert.equal(bare.reactionToPlayer, 0, 'no reaction seam is a reaction of ZERO, not a refusal');
  assert.equal(out.kind, 'talk', 'so the window road is open');
  assert.equal(bare.npcData.factionData, null);
  // a static click with no nameSeed reads seed 0
  const bare2 = new NPCSession({});
  bare2.npcsWithWork.set(0, { npc: { nameSeed: 0 }, socialGroup: 1, buildingName: 'x' });
  assert.equal(bare2.talkToStaticNPC({ data: {} }).kind, 'questOffer',
    'an absent nameSeed is SEED 0, and seed 0 is a real pool key');
  // the castle arm with no seam is not in a castle
  const bare3 = new NPCSession({});
  assert.equal(bare3.isCastleNpcOfferingQuest(1), false, 'no castle seam, no castle');
  assert.equal(bare3.castleNPCsSpokenTo.size, 0);
  // the pool gate with no location seam reads 0, which the fresh
  // exteriorUsedForQuestors already is - so the walk is skipped
  const bare4 = new NPCSession({});
  assert.equal(bare4.buildQuestorPool([{ buildingKey: 1, isNamedBuilding: true, npcs: [] }]), false,
    'location 0 is where we already are');
});

test('the mobile portrait record and the static name fall to their C# defaults', () => {
  const { s, calls } = makeSession();
  s.setTargetMobileNPC({}, faction({ id: 1 }));
  assert.deepEqual(calls.filter((c) => c[0] === 'target')[0][1].portrait, { archive: 'CommonFaces', record: 0 },
    'no face id is record ZERO');
  assert.equal(s.nameNPC, '', 'and no name is the empty string');
});

test('THE REPUTATION ROLL: Range(0,15) - 10, and equality PASSES', () => {
  // C# rolls `DFRandom.random_range_inclusive(0, 15) - 10`, so the bar
  // is -10..5. Seeding the shared stream makes the roll knowable, and
  // the pin then sits exactly on it: reputation === reaction must take
  // the greeting, not the rejection.
  const probe = (rep, seed) => {
    const f = faction({ id: 5, parent: 0, type: FACTION_TYPE.Group, rep: 0 });
    const { s } = makeSession({ sgroupReputation: () => rep }, { 5: f });
    s.npcData = newNPCData({ factionData: f });
    srand(seed);
    return { record: s.getNPCGreetingRecord(), rejected: s.alreadyRejectedOnce };
  };
  // find the roll this seed produces, then sit on it
  srand(12345);
  const reaction = randomRangeInclusive(0, 15) - 10;
  assert.ok(reaction >= -10 && reaction <= 5, 'the bar is always within -10..5');
  const onTheBar = probe(reaction, 12345);
  assert.equal(onTheBar.rejected, false, 'reputation EQUAL to the reaction is not a rejection');
  assert.equal(onTheBar.record, GREETINGS[1 + 24], 'it takes the ordinary stranger face');
  const under = probe(reaction - 1, 12345);
  assert.equal(under.rejected, true, 'one below IS');
  assert.equal(under.record, GREETINGS[2 + 24]);
});

test('the castle door is shut to CHILDREN, and open with no castle seam only when one says so', () => {
  const { s } = makeSession({ isPlayerInsideCastle: () => true, rolls: () => 0 });
  assert.equal(s.talkToStaticNPC({ isChildNPC: true, data: { nameSeed: 5, factionID: 0 } }).kind, 'talk',
    'a child in a castle is never offered work');
  assert.equal(s.castleNPCsSpokenTo.size, 0, 'and is not even marked as spoken to');
  assert.equal(s.talkToStaticNPC({ data: { nameSeed: 6, factionID: 0 } }).kind, 'questOffer',
    'an adult beside them is');
});

test('the static click resets the one-answer counter too, on a repeat click', () => {
  const npc = { displayName: 'Sirien', data: { nameSeed: 3, factionID: 0 } };
  const { s } = makeSession();
  s.talkToStaticNPC(npc);
  s.npcData.numAnswersGivenTellMeAboutOrRumors = 1;
  s.talkToStaticNPC(npc);
  assert.equal(s.sameTalkTargetAsBefore, true);
  assert.equal(s.npcData.numAnswersGivenTellMeAboutOrRumors, 0,
    'one correct answer per talk session, even for the same NPC (:798)');
});

test('the 25% questor roll is Range(0, FOUR) - the denominator decides who is offered work', () => {
  const npc = (nameSeed) => ({ nameSeed, factionID: 1, gender: 'male', isChild: false });
  const buildings = [{ buildingKey: 5, buildingName: 'The Inn', buildingType: 'Tavern', isNamedBuilding: true, npcs: [npc(1)] }];
  const at = (roll) => {
    const { s } = makeSession(
      { rolls: () => roll, currentLocationIndex: () => 1, nameBankOfCurrentRegion: () => 'B' },
      { 1: faction({ id: 1, sgroup: SOCIAL_GROUP.Merchants }) });
    s.buildQuestorPool(buildings);
    return s.npcsWithWork.size;
  };
  // floor(0.7 * 4) = 2, which is BELOW 3 and continues; a five-sided
  // roll would make it 3 and offer
  assert.equal(at(0.7), 0, 'a roll of 2 of four gets no work');
  assert.equal(at(0.9), 1, 'a roll of 3 of four does');
  assert.equal(at(0.74), 0, 'and the boundary sits between them');
  assert.equal(at(0.75), 1);
});

test('the pool resolves an ABSENT factionID as 0, through the same redirect', () => {
  const buildings = [{
    buildingKey: 5, buildingName: 'The Inn', buildingType: 'Tavern', isNamedBuilding: true,
    npcs: [{ nameSeed: 1, gender: 'male', isChild: false }],   // no factionID at all
  }];
  const { s } = makeSession(
    { rolls: () => 0.9, currentLocationIndex: () => 1, nameBankOfCurrentRegion: () => 'B',
      peopleOfCurrentRegion: () => 2 },
    { 2: faction({ id: 2, sgroup: SOCIAL_GROUP.Merchants }) });
  s.buildQuestorPool(buildings);
  assert.equal(s.npcsWithWork.size, 1, 'no faction id is faction 0, which reads the region PEOPLE');
});

test('the quest greeting needs a REAL match: no comparison seam is no greeting', () => {
  const person = { isPerson: true, isQuestor: true, isIndividualNPC: false, questorData: { nameSeed: 77 } };
  const { s } = makeSession({
    questorPostMessages: () => new Map([[1n, [{ text: 'x' }]]]),
    getQuest: () => ({ resources: new Map([['_q_', person]]) }),
    isNPCDataEqual: undefined,   // no comparison seam
    expandQuestMessage: (q, tokens) => { tokens[0].text = 'WRONG'; },
  });
  s.currentNPCType = NPC_TYPE.Static;
  s.lastTargetStaticNPC = { data: { nameSeed: 78 } };
  assert.equal(s.getNPCQuestGreeting(), '',
    'an unproven match is NOT a match - the default is false, not true');
});

test('the offer flow spends the pool entry only OUTSIDE a castle - and the seam defaults to outside', () => {
  // isCastleNpcOfferingQuest reads the same seam, so with none
  // attached the castle arm cannot fire at all
  const { s } = makeSession({ isPlayerInsideCastle: undefined, rolls: () => 0 });
  assert.equal(s.isCastleNpcOfferingQuest(1), false, 'no seam is NOT inside a castle');
});
