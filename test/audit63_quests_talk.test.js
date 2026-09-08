// AUDIT 63 - the QUESTS, TALK AND THE NPCs lane.
//
// Eleven missing clauses, each pinned against the REFERENCE value it
// restores rather than against the port's own line, and each written
// so that reverting its fix turns this file red. The mutation that
// kills each pin is named beside it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { Quest } from '../src/systems/quest/quest.js';
import { QuestResourceBehaviour } from '../src/systems/quest/resourceBehaviour.js';
import { createTownTalk } from '../src/scenes/townTalk.js';
import { NPCSession, newNPCData, FACTION_TYPE } from '../src/systems/npcSession.js';
import { getReactionToPlayer } from '../src/systems/talk.js';
import { enchantmentMagicRound } from '../src/systems/enchantments.js';
import { doItemEnchantmentPayloads, PAYLOAD, ENCHANTMENT_TYPES } from '../src/systems/enchantments.js';
import { ARTIFACTS } from '../src/systems/artifactEffects.js';
import { SOCIAL_GROUP_COUNT } from '../src/formats/factionFile.js';
import {
  discoverBuilding, discoveredBuildings, restoreDiscovery, snapshotDiscovery,
  setDiscoveredBuildingCustomName, setLastLockpickAttempt,
  undiscoverBuilding, hasDiscoveredBuilding,
} from '../src/systems/discovery.js';
import { expandMessageBoxTokens } from '../src/systems/talkMacros.js';
import { TextRsc, RSC, TOKEN_TEXT } from '../src/formats/textRsc.js';
import { tokenRows } from '../src/ui/messageBox.js';
import { NativeTalkWindow, TALK_RECTS, COPIED_SHADOW_COLOR } from '../src/ui/nativeTalk.js';

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

// ── F46: MobilePersonMotor's fifth term reaches both hosts ───────────
// MUTANT: delete either `inBeastForm:` line from the two argument
// objects. The law itself is pinned in townpopulation.test.js; only a
// source pin can see the HOSTS, which no test can boot.

test('AUDIT 63 F46: both exterior hosts hand personWantsToStop the live IsInBeastForm (MobilePersonMotor.cs:222,224)', () => {
  for (const f of ['scenes/world.js', 'scenes/exterior.js']) {
    const s = src(f);
    // the term must be INSIDE the personWantsToStop argument object,
    // beside the sibling PlayerEntity read DFU takes on the line above
    const call = s.slice(s.indexOf('personWantsToStop({'));
    assert.match(call.slice(0, 600), /invisible: isInvisible\(playerEntity\),\s*\n\s*inBeastForm: !!playerEntity\.isInBeastForm,/,
      `${f} drops MobilePersonMotor.cs:222`);
  }
  // ...and the flag is the PlayerEntity property (PlayerEntity.cs:193),
  // not a recomputed lycanthropy predicate
  assert.equal(src('scenes/world.js').includes('inBeastForm: isTransformedNow'), false);
});

// ── F4: GetReactionToPlayer_0_1_2 reads LivePersonality ──────────────
// TalkManager.cs:665 `player.Stats.LivePersonality / 5`
// (DaggerfallStats.cs:55 -> GetLiveStatValue). MUTANT: put
// `personality: playerEntity.stats?.personality ?? 50` back at
// townTalk.js's computeTier.

const talkHost = (personality, activeEffects = []) => createTownTalk({
  renderer: { uploadTexture: () => ({}) },
  canvas: { width: 640, height: 400 },
  fetchBytes: async () => { throw new Error('this pin loads no ARENA2'); },
  playerEntity: { name: 'T', stats: { personality }, skills: 30, skillUses: [], activeEffects },
  regionIndex: 0,
});

test('AUDIT 63 F4: a standing Personality mod moves the talk reaction tier (TalkManager.cs:665)', () => {
  // The seed is _talkSeed 0, so srand(0) fixes rollToBeat and the ONLY
  // thing moving between these hosts is the personality term. Tone 1
  // (the default) takes no skill roll, so no other term enters.
  assert.equal(talkHost(50).computeTier(null, 0), 1, 'base 50 -> reaction 10, the middle band');
  // FortifyAttribute on Personality (effects.js pushes it for subType
  // 5): DFU's LivePersonality is base + mods, so the tier climbs.
  assert.equal(talkHost(50, [{ kind: 'fortifyAttribute', stat: 'personality', magnitude: 60 }]).computeTier(null, 0), 2,
    'a fortified Personality bands HIGHER - it did not move at all on the base read');
  // ...and both drain routes fall, through the two different branches
  // of GetLiveStatValue the port's liveStat models.
  assert.equal(talkHost(100).computeTier(null, 0), 2);
  assert.equal(talkHost(100, [{ kind: 'drainAttribute', stat: 'personality', magnitude: 60 }]).computeTier(null, 0), 1,
    'Drain/Transfer Personality lowers the band');
  assert.equal(talkHost(100, [{ kind: 'disease', statMods: { personality: -60 } }]).computeTier(null, 0), 1,
    'and so does an ordinary disease PER column (diseases.js accumulates into statMods)');
  // The stats-less caller keeps the sentinel rather than liveStat's
  // 0-floor, which would band every NPC to tier 0.
  const bare = createTownTalk({
    renderer: { uploadTexture: () => ({}) },
    canvas: { width: 640, height: 400 },
    fetchBytes: async () => { throw new Error('none'); },
    playerEntity: { name: 'T' }, regionIndex: 0,
  });
  assert.equal(bare.computeTier(null, 0), 1, 'no stats = the 50 default, not 0');
});

// ── F6: reactionMods is ELEVEN long ─────────────────────────────────
// PlayerEntity.cs:128-129 `const int socialGroupCount = 11; int[]
// reactionMods = new int[socialGroupCount];`. MUTANT: put
// `new Array(5).fill(0)` back at any of the three mint sites.

test('AUDIT 63 F6: the Masque raises ALL ELEVEN social groups, and TalkManager reads the term for sgroup 5..10', () => {
  assert.equal(SOCIAL_GROUP_COUNT, 11, 'FactionFile.cs:552-566 runs Commoners 0 .. SGroup10 10');
  // The path that manifests: an entity that reaches its first magic
  // round with no reactionMods at all (a classic .SAV import, a
  // headless roll, a BIOG-less chargen). enchantmentMagicRound's
  // ClearReactionMods mints the array - and it must mint ELEVEN.
  const p = {
    isPlayer: true, level: 1, items: [], activeEffects: [], skills: {},
    stats: { personality: 63 },   // trunc(63/5) = 12
  };
  enchantmentMagicRound(p, 1, {});
  assert.equal(p.reactionMods.length, 11,
    'ClearReactionMods is Array.Clear over socialGroupCount (PlayerEntity.cs:1567-1570)');
  const masque = {
    name: 'Artifact', currentCondition: 800, maxCondition: 800,
    enchantments: [{ type: ENCHANTMENT_TYPES.SpecialArtifactEffect, param: ARTIFACTS.MasqueOfClavicus }],
  };
  doItemEnchantmentPayloads(PAYLOAD.MagicRound, masque, { entity: p, round: 1 });
  assert.deepEqual([...p.reactionMods], new Array(11).fill(12),
    'MasqueOfClavicusEffect.cs:39-43 walks Enum.GetValues(SocialGroups) - all eleven');
  // ...and TalkManager.cs:558 adds GetReactionMod for the NPC's
  // UNCLAMPED sgroup, so GuildMembers (7) and SupernaturalBeings (6)
  // must carry it. On the five-long array both answered 0.
  const faction = (sgroup) => ({ id: 1, parent: 0, type: 2, rep: 0, sgroup, ggroup: 0 });
  assert.equal(getReactionToPlayer(faction(0), p), 12, 'Commoners');
  assert.equal(getReactionToPlayer(faction(6), p), 12, 'SupernaturalBeings');
  assert.equal(getReactionToPlayer(faction(7), p), 12, 'GuildMembers');
  assert.equal(getReactionToPlayer(faction(10), p), 12, 'SGroup10');
  // ...and the Masque is a MINTER too (it runs before the magic-round
  // clear on a bare entity, which is exactly the `??=` race that let
  // whichever site ran first fix the length).
  const q = { isPlayer: true, level: 1, items: [], activeEffects: [], skills: {}, stats: { personality: 63 } };
  doItemEnchantmentPayloads(PAYLOAD.MagicRound, masque, { entity: q, round: 1 });
  assert.deepEqual([...q.reactionMods], new Array(11).fill(12));
});

// ── F0: the tombstone's quest-residence undiscover sweep ────────────
// Quest.cs:649-656. MUTANT: delete the loop from quest.js tombstone().

const placeResource = (name, siteDetails) => ({
  isPlace: true, symbol: { name, original: name, clone: () => ({ name, original: name }) }, siteDetails,
});

test('AUDIT 63 F0: TombstoneQuest undiscovers every Place, unfiltered, between the topic scrub and DropAllQuestors (Quest.cs:649-656)', () => {
  const calls = [];
  const q = new Quest({
    nowSeconds: () => 0,
    hooks: {
      removeQuestInfoTopics: () => calls.push(['topics']),
      undiscoverBuilding: (key, name) => calls.push(['undiscover', key, name]),
    },
  });
  q.resources.set('_house_', placeResource('_house_', { buildingKey: 66051, buildingName: 'The Smith Residence' }));
  // a Place whose site never resolved at all - C# would read
  // SiteDetails' default struct, whose int buildingKey is 0 and whose
  // `string buildingName` (DaggerfallUnityStructs.cs:424-441) is NULL
  q.resources.set('_town_', placeResource('_town_', null));
  q.resources.set('_npc_', { isPerson: true, symbol: { name: '_npc_' } });
  q.tombstone();
  assert.deepEqual(calls, [
    ['topics'],
    ['undiscover', 66051, 'The Smith Residence'],
    ['undiscover', 0, null],
  ], 'every Place, in resource order, AFTER RemoveQuestInfoTopicsForSpecificQuest and before DropAllQuestors');
  // C# pre-filters NOTHING - not to residences, not to Building sites.
  // PlayerGPS.cs:1000-1017 makes all three refusals, so a town/dungeon
  // Place reaching the store with key 0 is refused there and not here.
  // The name fallback is NULL, not '': PlayerGPS.cs:1015-1016
  // `if (matchName != null && matchName != db.displayName) return;`
  // only fires for a NON-null name, and '' would arm a gate DFU leaves
  // disarmed.
  assert.strictEqual(calls[2][2], null,
    'a nameless Place passes NULL, not the empty string - PlayerGPS.cs:1015-1016 only tests matchName when it is non-null');
});

test('AUDIT 63 F0: the three site builders C# never assigns a buildingName leave it NULL, so a fixed Building Place IS undiscovered (Place.cs:921/:967/:1088-1101, PlayerGPS.cs:1015-1017)', () => {
  // SetupFixedLocation assigns a REAL buildingKey for its
  // SiteTypes.Building arm (Place.cs:1066 MakeBuildingKey) at :1097
  // but never siteDetails.buildingName - so Quest.cs:655 calls
  // UndiscoverBuilding(realKey, true, null) and the matchName gate
  // (PlayerGPS.cs:1015-1016) never fires: the residence IS removed.
  const p = src('systems/quest/place.js');
  assert.equal((p.match(/buildingName: null,/g) ?? []).length, 3,
    'SelectRemoteDungeonSite, SelectRemoteLocationExteriorSite and SetupFixedLocation - the three sites C# leaves unassigned');
  assert.match(p, /buildingKey, buildingName: null, magicNumberIndex,/,
    'the FIXED site keeps its real buildingKey beside the null name');
  // ...and ConfigureFromPlayerLocation is NOT one of them: Place.cs:314
  // seeds `string buildingName = string.Empty;` and :341 assigns it.
  assert.match(p, /let siteType, buildingKey = 0, buildingName = '';/);

  // end to end through the real store: a discovered residence under a
  // real key is REMOVED by a Place that carries no name.
  const LOC = 'a63f0:Daggerfall';
  restoreDiscovery(null);
  discoverBuilding(LOC, { buildingKey: 66051, name: 'The Smith Residence', buildingType: 17 });   // House1
  assert.equal(hasDiscoveredBuilding(LOC, 66051), true);
  const q = new Quest({
    nowSeconds: () => 0,
    hooks: { undiscoverBuilding: (key, name) => undiscoverBuilding(LOC, key, true, name ?? null) },
  });
  q.resources.set('_house_', placeResource('_house_', { buildingKey: 66051, buildingName: null }));
  q.tombstone();
  assert.equal(hasDiscoveredBuilding(LOC, 66051), false,
    'null matchName disarms PlayerGPS.cs:1015-1016, so :1017 removes the record');

  // ...and a NON-null name that disagrees still refuses (the gate is
  // armed only when the site actually carries a name).
  restoreDiscovery(null);
  discoverBuilding(LOC, { buildingKey: 66051, name: 'The Smith Residence', buildingType: 17 });
  const q2 = new Quest({
    nowSeconds: () => 0,
    hooks: { undiscoverBuilding: (key, name) => undiscoverBuilding(LOC, key, true, name ?? null) },
  });
  q2.resources.set('_house_', placeResource('_house_', { buildingKey: 66051, buildingName: 'Some Other House' }));
  q2.tombstone();
  assert.equal(hasDiscoveredBuilding(LOC, 66051), true);
  restoreDiscovery(null);
});

test('AUDIT 63 F0: a resource that expands a macro to NULL removes the token, as String.Replace does (QuestMacroHelper.cs:120-122, :207-209)', () => {
  const m = src('systems/quest/questMacros.js');
  assert.equal((m.match(/if \(typeof result === 'string' \|\| result === null\) words\[w\] = words\[w\]\.replace\(macro\.token, result \?\? ''\);/g) ?? []).length, 2,
    'both replace seams treat a true/null pair as an EMPTY expansion, not as "did not expand"');
});

test('AUDIT 63 F0: the hook is wired end to end, and the two quest-side callers share ONE closure', () => {
  assert.match(src('systems/quest/machine.js'),
    /undiscoverBuilding: \(buildingKey, buildingName\) => this\.deps\.undiscoverBuilding\?\.\(buildingKey, buildingName\)/);
  assert.match(src('scenes/questBridge.js'),
    /undiscoverBuilding: \(buildingKey, buildingName\) => ctx\.undiscoverBuilding\?\.\(buildingKey, buildingName\)/);
  // PlayerGPS.cs:987-999 resolves the dict from CurrentLocation, so the
  // closure must be keyed on the CURRENT location - a quest that
  // tombstones while the player is elsewhere is a no-op in DFU too.
  assert.match(src('scenes/world.js'),
    /const undiscoverBuildingHere = \(buildingKey, buildingName\) => undiscoverBuilding\(\s*`\$\{_questLoc\(\)\?\.regionIndex \?\? -1\}:\$\{_questLoc\(\)\?\.name \?\? ''\}`, buildingKey, true, buildingName \?\? null\)/);
  // ...and the fixed-city host carries it too: UndiscoverBuilding is a
  // PlayerGPS law, and that host writes the same store under the same
  // key at its own building door.
  assert.match(src('scenes/exterior.js'), /undiscoverBuilding: \(buildingKey, buildingName\) => undiscoverBuilding\(/);
  // ONE closure, taken twice - the talk seam (TalkManager.cs:2958) and
  // the quest bridge (Quest.cs:655) pass the identical triple.
  assert.equal((src('scenes/world.js').match(/undiscoverBuilding: undiscoverBuildingHere,/g) ?? []).length, 2);
});

// ── F1: AddQuestor's individual-NPC scene relink ────────────────────
// Quest.cs:481-497. MUTANT: delete the `if (person.isIndividualNPC)`
// block from quest.js addQuestor.

const personResource = (name, parentQuest, over = {}) => ({
  isPerson: true, displayName: name, isQuestor: false, questResourceBehaviour: null,
  symbol: { name, original: name, clone: () => ({ name, original: name }) },
  isIndividualNPC: true, factionData: { id: 512 }, parentQuest, ...over,
});

test('AUDIT 63 F1: AddQuestor relinks an individual\'s standing behaviour by faction id (Quest.cs:481-497)', () => {
  const q = new Quest({ nowSeconds: () => 0, hooks: { staticNpcQuestBehaviours: () => [] } });
  // a machine that CAN resolve the quest, so a stray start()/cacheTarget
  // would visibly fill targetResource - the pin below turns on that
  const machine = { getQuest: (uid) => (uid === q.uid ? q : null), isIndividualNPC: () => true };
  const behaviour = (factionId, active = true) =>
    new QuestResourceBehaviour(machine, { staticNpcFactionId: factionId, isActive: () => active });
  const mine = behaviour(512);
  const stranger = behaviour(999);
  q.hooks.staticNpcQuestBehaviours = () => [stranger, mine];
  const p = personResource('_lhotun_', q);
  q.resources.set('_lhotun_', p);
  q.addQuestor(p.symbol);

  assert.equal(p.isQuestor, true);
  assert.equal(p.questResourceBehaviour, mine, 'the back-link is written (Quest.cs:490)');
  assert.equal(mine.targetSymbol, p.symbol, 'AssignResource stamped the symbol (QuestResourceBehaviour.cs:217-224)');
  assert.equal(stranger.targetSymbol, null, 'a different faction id is not this Person');
  // AssignResource ALONE. CacheTarget runs only from Start and
  // RestoreSaveData (:124-129, :283), so DFU's relinked behaviour is
  // still holding a null targetResource - calling start() here would
  // make the port hide/destroy and route clicks through a behaviour
  // DFU leaves dormant.
  assert.equal(mine.targetResource, null, 'no CacheTarget - the relink is assign + back-link and nothing else');

  // A NON-individual takes no relink at all.
  const q2 = new Quest({ nowSeconds: () => 0, hooks: { staticNpcQuestBehaviours: () => [behaviour(512)] } });
  const p2 = personResource('_qgiver_', q2, { isIndividualNPC: false });
  q2.resources.set('_qgiver_', p2);
  q2.addQuestor(p2.symbol);
  assert.equal(p2.questResourceBehaviour, null, 'Quest.cs:482 gates the whole block on IsIndividualNPC');

  // ...and a Person whose FactionData is still null must not match a
  // host that carries no faction id either.
  const q3 = new Quest({ nowSeconds: () => 0, hooks: { staticNpcQuestBehaviours: () => [behaviour(undefined)] } });
  const p3 = personResource('_pending_', q3, { factionData: null });
  q3.resources.set('_pending_', p3);
  q3.addQuestor(p3.symbol);
  assert.equal(p3.questResourceBehaviour, null);
});

test('AUDIT 63 F1: the ACTIVE static-NPC cache is composed in every host that stands one', () => {
  // ActiveGameObjectDatabase.cs:307-311 is GetActiveComponents over
  // GetActiveObjects, which keeps only activeInHierarchy objects
  // (:32-46) - so the away arm's SetActive(false) removes a candidate.
  assert.match(src('scenes/worldModes.js'), /if \(b\.host\.isActive\?\.\(\) === false\) return;/);
  assert.match(src('scenes/interiorContext.js'), /isActive: \(\) => pn\.active !== false,/);
  // The street NPCs are static NPCs too (exteriorNpcs' quest pass
  // stands the same bootstrap behaviour), so the streaming host unions
  // them onto the modal hosts' list; the fixed-city host stands none
  // and answers the modal list alone.
  assert.match(src('scenes/world.js'), /staticNpcQuestBehaviours: \(\) => \{/);
  assert.match(src('scenes/exterior.js'), /staticNpcQuestBehaviours: \(\) => modes\?\.activeStaticNpcQuestBehaviours\?\.\(\) \?\? \[\]/);
  assert.match(src('systems/quest/machine.js'),
    /staticNpcQuestBehaviours: \(\) => this\.deps\.world\?\.staticNpcQuestBehaviours\?\.\(\) \?\? \[\]/);
});

// ── F2: DropQuestor destroys the behaviour COMPONENT ────────────────
// Quest.cs:519-523. MUTANT: delete the destroyComponent() call from
// quest.js dropQuestor, or the isComponentDestroyed guards from
// resourceBehaviour.js's update()/doClick().

test('AUDIT 63 F2: DropQuestor destroys a non-individual questor\'s component, and the destroyed component is inert (Quest.cs:519-523)', () => {
  const host = {};
  const machine = { getQuest: () => null, isIndividualNPC: () => false };
  const b = new QuestResourceBehaviour(machine, host);
  host.questBehaviour = b;
  const q = new Quest({ nowSeconds: () => 0 });
  const p = personResource('_qgiver_', q, { isIndividualNPC: false });
  p.questResourceBehaviour = b;
  b.targetResource = p;
  q.resources.set('_qgiver_', p);
  q.questors.set('_qgiver_', { symbol: p.symbol, name: p.displayName });

  q.dropQuestor(p.symbol);
  assert.equal(b.isComponentDestroyed, true, 'MonoBehaviour.Destroy(component)');
  // The port's stand-in for C#'s GetComponent<QuestResourceBehaviour>()
  // is the host's `questBehaviour` field, which PlayerActivate.cs
  // :1523-1528 reads before routing to talk/guild services. After
  // Destroy that read MISSES.
  assert.equal(host.questBehaviour, null, 'the ex-questor stops swallowing every click');
  assert.equal(b.doClick(), false, 'a destroyed component receives no activation');
  // ...and it never Updates again, which is what stops the port's
  // per-frame recouple (:132-141) from undoing the destroy.
  p.questResourceBehaviour = null;
  b.update();
  assert.equal(p.questResourceBehaviour, null, 'Destroy stops Update forever');
  // The GameObject stays standing: destroyComponent must NOT call
  // host.destroy() (Quest.cs:522 destroys the component alone).
  const standing = { destroyed: false, destroy() { this.destroyed = true; } };
  const b2 = new QuestResourceBehaviour(machine, standing);
  b2.destroyComponent();
  assert.equal(standing.destroyed, false, 'the StaticNPC keeps standing');

  // An INDIVIDUAL is skipped - "Individual NPCs have a permanent
  // QuestResourceBehaviour attached ... it must not be removed"
  // (Quest.cs:520).
  const bi = new QuestResourceBehaviour(machine, {});
  const qi = new Quest({ nowSeconds: () => 0 });
  const pi = personResource('_lhotun_', qi);
  pi.questResourceBehaviour = bi;
  qi.resources.set('_lhotun_', pi);
  qi.questors.set('_lhotun_', { symbol: pi.symbol, name: pi.displayName });
  qi.dropQuestor(pi.symbol);
  assert.equal(bi.isComponentDestroyed, false);
});

test('AUDIT 63 F2: the static-NPC behaviours are TICKED, which is what fills the back-link Quest.cs:522 reads', () => {
  // QuestResourceBehaviour.cs:132-141 - "Ensure target resource has
  // this behaviour assigned". The hosts drove this loop for the quest
  // FLATS only, so a questor Person's link was never filled and
  // DropQuestor's null test could not be reached.
  assert.match(src('scenes/worldModes.js'),
    /if \(mode === 'interior'\) for \(const pn of interiorCtx\?\.people \?\? \[\]\) pn\.questBehaviour\?\.update\(\);/);
  assert.match(src('scenes/world.js'), /for \(const pn of entry\.npcs \?\? \[\]\) pn\.questBehaviour\?\.update\(\);/);
});

// ── F3: TalkToNpc's message box ─────────────────────────────────────
// DaggerfallMessageBox.cs:432-441 / :443-450, DaggerfallUI.cs:1346,
// :1355. MUTANT: put the `townTalk.say(... tokensToString ...)` join
// back at world.js's messageBox seam, or expand with the live mcp.

test('AUDIT 63 F3: the box expands macros with a NULL mcp - globals resolve, source rows take [nullMCP]', () => {
  // MacroHelper.GetValue (:502-527): a handler that answers null gives
  // `symbolStr + "[nullMCP]"`, and Oath (:1371-1375) answers null on a
  // null mcp. Every global row still resolves, because it ignores the
  // provider entirely.
  // the ctx is the talk MCP's own shape: `hooks` is the macro bundle
  // (world.js hands the quest machine's), and `source` - the row the
  // TalkManagerDataSource methods come off - is what a NULL mcp
  // withholds.
  // The ctx carries everything the LIVE mcp would need for %oth
  // (raceOfCurrentRegion + factionRaceId + randomText is the talk
  // source's oath()), so the null-mcp door is the ONLY reason the
  // sentinel comes out - expanding with talkMacroHandlers(ctx) here
  // would print the oath and this pin would fail.
  const ctx = {
    hooks: {
      playerName: () => 'Aelwin',
      world: { currentLocation: () => ({ loaded: true, name: 'Daggerfall' }) },
    },
    raceOfCurrentRegion: () => 'Breton',
    factionRaceId: () => 0,
    randomText: () => 'By Azura',
  };
  const out = expandMessageBoxTokens([{ formatting: TOKEN_TEXT, text: '%pcn of %cn says %oth.' }], ctx);
  const text = out.map((t) => t.text).join('');
  assert.match(text, /Aelwin/, '%pcn is a MacroHelper GLOBAL (:779-782) and resolves under a null mcp');
  assert.match(text, /Daggerfall/, '%cn likewise');
  assert.match(text, /%oth\[nullMCP\]/,
    'the source-method row takes the sentinel - expanding it with the live talk MCP would be a NEW departure');
  assert.equal(/By Azura/.test(text), false, 'and the oath the ctx COULD answer is not spoken');
  // and the input tokens are not mutated (the box works on a copy)
  const src0 = [{ formatting: TOKEN_TEXT, text: '%pcn' }];
  expandMessageBoxTokens(src0, ctx);
  assert.equal(src0[0].text, '%pcn');
});

test('AUDIT 63 F3: SetTextTokens(int) is GetRSCTokens - the WHOLE record, no variant draw', () => {
  // TextProvider.cs:167-188 `TextFile.ReadTokens(ref buffer, 0,
  // TextFile.Formatting.EndOfRecord)`. The old seam used
  // variantLinesById, which picks one subrecord AND burns a rolls()
  // value per refusal that DFU never spends.
  const head = [12, 0, /* id 8550 = 0x2166 */ 0x66, 0x21, 12, 0, 0, 0];
  const rec = [...'Hi'].map((c) => c.charCodeAt(0))
    .concat([RSC.NewLine], [...'yo'].map((c) => c.charCodeAt(0)),
      [RSC.SubrecordSeparator], [...'alt'].map((c) => c.charCodeAt(0)), [RSC.EndOfRecord]);
  const bytes = new Uint8Array(12 + rec.length);
  bytes.set(head, 0);
  bytes.set(rec, 12);
  const t = new TextRsc().load(bytes);
  let draws = 0;
  const rolls = () => { draws++; return 0.5; };
  const whole = t.tokensById(8550);
  assert.equal(draws, 0, 'GetRSCTokens makes no draw');
  assert.deepEqual(tokenRows(whole).map((r) => r.text), ['Hi', 'yoalt'],
    'every subrecord of the record, the separator moving no row (MultiFormatTextLabel.cs:331-345)');
  // ...where the GetRandomTokens sibling picks ONE and spends a value
  const variant = t.variantTokensById(8550, rolls);
  assert.equal(draws, 1);
  assert.notDeepEqual(variant, whole);
});

test('AUDIT 63 F3: the seam raises a real parchment through the expansion, on all three arms', () => {
  const w = src('scenes/world.js');
  const seam = w.slice(w.indexOf('messageBox: (x) => {'), w.indexOf('pushTalkWindow: () => {}'));
  assert.match(seam, /townTalk\.recordTokens\(x\)/, 'the int arm is GetRSCTokens, not a random variant');
  assert.match(seam, /formatting: TOKEN_TEXT, text: String\(x \?\? ''\)/,
    'SetText(string) tokenizes into one Text token and expands too (DaggerfallMessageBox.cs:405-408)');
  assert.match(seam, /expandMessageBoxTokens\(tokens, talkMcp\(\)\)/);
  assert.match(seam, /townTalk\.showBox\(/, 'a modal box, never AddHUDText');
  assert.equal(/messageBox: \(x\) => townTalk\.say\(/.test(w), false, 'the HUD line is gone');
  // the racial refusal is a box at both of DFU's own doors
  const tt = src('scenes/townTalk.js');
  assert.equal(/if \(sup\) \{ hud\.add\(sup\.text\); return; \}/.test(tt), false);
  assert.match(tt, /if \(sup\) \{ showOverlay\(new ActionTextBox\(\[sup\.text\]\)\); return; \}/);
});

// ── F47: the racial-override door is TalkToNpc's FIRST ──────────────
// TalkManager.cs:2618-2628. MUTANT: delete the `suppressTalk` dep from
// world.js's NPCSession construction.

test('AUDIT 63 F47: a suppressed conversation computes NO greeting and spends no session state (TalkManager.cs:2620-2628)', () => {
  const calls = [];
  const f = { id: 5, parent: 0, type: FACTION_TYPE.Group, rep: 30, sgroup: 0, ggroup: 0, name: '' };
  const s = new NPCSession({
    factionData: (id) => (id === 5 ? f : null),
    reactionToPlayer: () => 0,
    expandRandomTextRecord: (id) => { calls.push(['record', id]); return `record:${id}`; },
    randomTokens: (id) => { calls.push(['tokens', id]); return [{ text: `tokens:${id}` }]; },
    messageBox: (x) => calls.push(['box', x]),
    pushTalkWindow: () => calls.push(['push']),
    resetNPCKnowledge: () => calls.push(['resetKnowledge']),
    resetToneSession: () => calls.push(['resetTone']),
    // the reputation roll would REJECT and latch alreadyRejectedOnce
    sgroupReputation: () => -1000,
    rolls: () => 0.9,
    suppressTalk: () => 'You get no response.',
  });
  s.npcData = newNPCData({ factionData: f });
  const out = s.talkToNpc();
  assert.equal(out.kind, 'suppressed');
  assert.deepEqual(calls, [['box', 'You get no response.']],
    'the door returns before the greeting, the DFRandom draw, ResetNPCKnowledge and the tone resets');
  assert.equal(s.alreadyRejectedOnce, false, 'and the rejection latch is never touched');
});

test('AUDIT 63 F47: the dep has a writer, in the host and at the engineless door', () => {
  assert.match(src('scenes/world.js'),
    /suppressTalk: \(\) => racialSuppressTalk\(playerEntity\)\?\.text \?\? null,/);
  // ...and the pre-engine fallback returns before openTalkWindow's own
  // gate, so the mobile-click handler checks ahead of both branches
  const tt = src('scenes/townTalk.js');
  assert.match(tt, /const sup0 = racialSuppressTalk\(playerEntity\);\n\s*if \(sup0\) \{ showOverlay\(new ActionTextBox\(\[sup0\.text\]\)\); return; \}/);
  assert.ok(tt.indexOf('const sup0 = racialSuppressTalk(playerEntity);') < tt.indexOf('const eng0 = engine();'),
    'the refusal comes before the engine branch AND before the directory-less fallback');
});

// ── F7: the popup Talk button's questor door ────────────────────────
// TalkManager.cs:757-772. MUTANT: delete the `questOffer` arm from
// popupTalkToStaticNpc, or mount it with mountSpellWindow.

test('AUDIT 63 F7: every TalkToStaticNPC door takes the questor arm FIRST, through the right mount', () => {
  const s = src('scenes/worldModes.js');
  const popup = s.slice(s.indexOf('function popupTalkToStaticNpc'), s.indexOf('function openWitchesCoven'));
  assert.match(popup, /if \(talk2\?\.kind === 'questOffer'\) \{ openQuestOfferFor\(talk2, npcData, mountServiceWindow\); return; \}/,
    'the dead click is closed');
  assert.ok(popup.indexOf("kind === 'questOffer'") < popup.indexOf("kind === 'talk'"),
    'the questor door is TalkToStaticNPC\'s FIRST act, before currentNPCType is set');
  // mountSpellWindow REFUSES an occupied slot in both non-dungeon
  // modes, and this call comes out of a popup that is already in it -
  // the REPLACE-mode door is DFU's own CloseWindow(); PushWindow(next)
  // (DaggerfallGuildServicePopupWindow.cs:383-394).
  assert.equal(/mountSpellWindow\(/.test(popup), false, 'the popup mounts through the replacing door alone');
  // ONE body for both callers, and the click-through door keeps its own
  // (empty) slot mount (PlayerActivate.cs:1552-1568 pushes onto a bare
  // stack).
  assert.match(s, /if \(talk\?\.kind === 'questOffer' && questBridge\) \{ openQuestOfferFor\(talk, npcData, mountSpellWindow\); return; \}/);
  assert.equal((s.match(/function openQuestOfferFor\(/g) ?? []).length, 1,
    'the offer body is written once and parameterised by its mount door');
});

// ── F49: DiscoverBuilding's quest name-override arm ─────────────────
// PlayerGPS.cs:917, :926-927, :945-959, :961-972. MUTANT: drop the
// overrideName parameter, the `overrideName == null &&` half of the
// early-out, the quest consult, or the stamp.

const LOC = '17:Daggerfall';
const house = { buildingKey: 66051, name: 'The Odd Blades', buildingType: 17, factionId: 0, quality: 10 };

test('AUDIT 63 F49: a discovered quest residence takes the quest Place\'s name and raises isOverrideName', () => {
  restoreDiscovery(null);
  // TalkManager.IsBuildingQuestResource's answer for a Place the PC was
  // TOLD about (availableForDialog defaults true, TalkManager.cs:309)
  // but that was never marked on the map.
  const questSource = {
    currentMapID: () => 4242,
    isBuildingQuestResource: (mapID, key) => ({
      isQuestResource: mapID === 4242 && key === 66051,
      overrideBuildingName: 'The Smith Residence',
      pcLearnedAboutExistence: true,
      receivedDirectionalHints: false,
      locationWasMarkedOnMapByNPC: false,
    }),
  };
  assert.equal(discoverBuilding(LOC, house, null, questSource), true);
  const rec = discoveredBuildings(LOC)[0];
  assert.equal(rec.displayName, 'The Smith Residence', 'PlayerGPS.cs:954-958 promotes it to the override');
  assert.equal(rec.isOverrideName, true, ':966 - the flag the automap plate ladder reads (ExteriorAutomap.cs:677)');
  assert.equal(rec.oldDisplayName, 'The Odd Blades', ':963 stashes the displaced name');

  // pcLearnedAboutExistence FALSE = no override at all (:955).
  restoreDiscovery(null);
  discoverBuilding(LOC, house, null, {
    currentMapID: () => 4242,
    isBuildingQuestResource: () => ({ isQuestResource: true, overrideBuildingName: 'The Smith Residence', pcLearnedAboutExistence: false }),
  });
  assert.equal(discoveredBuildings(LOC)[0].isOverrideName, false);
  assert.equal(discoveredBuildings(LOC)[0].displayName, 'The Odd Blades');

  // A name EQUAL to the directory's is no override either (:955's
  // `overrideBuildingName != db.displayName`), and :969-970 would
  // collapse the flag anyway.
  restoreDiscovery(null);
  discoverBuilding(LOC, house, null, {
    currentMapID: () => 4242,
    isBuildingQuestResource: () => ({ isQuestResource: true, overrideBuildingName: 'The Odd Blades', pcLearnedAboutExistence: true }),
  });
  assert.equal(discoveredBuildings(LOC)[0].isOverrideName, false);
  assert.equal(discoveredBuildings(LOC)[0].oldDisplayName, null,
    ':955 refuses the promotion outright, so :963 never runs - a record whose oldDisplayName carries the base name took the override path it should not have');
  // ...and :969-970's collapse is its own clause, reachable only when a
  // CALLER hands an override equal to the base name (the quest arm
  // above can no longer produce that case).
  restoreDiscovery(null);
  discoverBuilding(LOC, house, 'The Odd Blades');
  assert.equal(discoveredBuildings(LOC)[0].isOverrideName, false,
    'PlayerGPS.cs:969-970 - old === display collapses the flag whatever raised it');

  // No seam at all (scenes/exterior.js mounts no topic tree): the
  // member behaves exactly as it did before this arm existed.
  restoreDiscovery(null);
  discoverBuilding(LOC, house);
  assert.deepEqual(
    { n: discoveredBuildings(LOC)[0].displayName, o: discoveredBuildings(LOC)[0].isOverrideName },
    { n: 'The Odd Blades', o: false });
});

test('AUDIT 63 F49: an override BYPASSES the already-discovered early-out and rebuilds the record (PlayerGPS.cs:926-927, :1285-1330)', () => {
  restoreDiscovery(null);
  assert.equal(discoverBuilding(LOC, house), true);
  assert.equal(discoverBuilding(LOC, house), false, 'no override: the second discovery is a no-op');
  // give the record the two columns a MERGE would preserve
  setLastLockpickAttempt(LOC, 66051, 37);
  setDiscoveredBuildingCustomName(LOC, 66051, 'My Place');
  assert.equal(discoveredBuildings(LOC)[0].lastLockpickAttempt, 37);
  // DaggerfallBankManager.cs:440 passes the residence text as the
  // OVERRIDE, and that is exactly the case the `overrideName == null &&`
  // half of :926-927 exists to serve - a house the player had already
  // entered used to keep its old plate.
  assert.equal(discoverBuilding(LOC, house, "Aelwin's residence"), true);
  const rec = discoveredBuildings(LOC)[0];
  assert.equal(rec.displayName, "Aelwin's residence");
  assert.equal(rec.isOverrideName, true);
  // GetBaseBuildingDiscoveryData mints a FRESH struct from the building
  // directory on every call and :973 assigns it over the slot, so the
  // override pass RESETS the per-record columns rather than merging.
  assert.equal(rec.lastLockpickAttempt, 0, 'the fresh struct resets the anti-grind record');
  assert.equal(rec.customUserDisplayName, '', "...and the player's own rename");
  assert.equal(rec.oldDisplayName, 'The Odd Blades', 'the fresh struct always carries the BASE name');
  // The bank caller must hand it as the third argument, not smuggle it
  // in as the synthetic record's `name`.
  assert.match(src('scenes/worldModes.js'),
    /discoverBuilding\(locId, \{ buildingKey: key, buildingType: BUILDING_TYPES\.House1 \}, name\)/);
  // ...and every DiscoverBuilding caller takes the quest seam, because
  // DFU's member asks IsBuildingQuestResource for ITSELF - the door
  // (PlayerEnterExit.cs:1032), the talk map reveal
  // (TalkManager.cs:1290) and the quest bridge's own hook.
  assert.match(src('scenes/worldModes.js'), /discoverBuilding\(locId, bd, null, questBuildingSource\)/);
  assert.match(src('scenes/townTalk.js'), /discoverBuilding\(`\$\{regionNow\(\)\}:\$\{cityName\(\)\}`, building, null, questBuildingSource\)/);
  assert.match(src('scenes/world.js'), /\n\s*null, questBuildingSource\),   \/\/ AUDIT 63 F49/);
  // the seam itself is CurrentMapID + IsBuildingQuestResource, not this
  // store's region:location key (TalkManager.cs:2398 tests mapId)
  assert.match(src('scenes/world.js'),
    /const questBuildingSource = \{\s*\n\s*currentMapID: \(\) => _questLoc\(\)\?\.mapTableData\?\.mapId \?\? 0,/);
});

test('AUDIT 63 F49: a pre-fix save restores with the override columns present, not undefined', () => {
  restoreDiscovery(null);
  discoverBuilding(LOC, house);
  const snap = snapshotDiscovery();
  // a record written before this arm shipped has neither column
  delete snap.buildings[LOC][66051].isOverrideName;
  delete snap.buildings[LOC][66051].oldDisplayName;
  restoreDiscovery(snap);
  const rec = discoveredBuildings(LOC)[0];
  assert.equal(rec.isOverrideName, false);
  assert.equal(rec.oldDisplayName, null, 'null, not \'\' - :969-970 must not collapse a nameless building');
  restoreDiscovery(null);
});

// ── F5: the talk window's Copy-to-logbook button ────────────────────
// DaggerfallTalkWindow.cs:243, :262, :725-737, :299-319, :1280,
// :1551-1592, ListBox.cs:532-537/:773-776, :483-497. MUTANT: delete the
// logbook rect or its click arm, put `index === entries.length - 1`
// back in the draw, or seed conversationSelected at 0.

const logbookHooks = () => {
  const filed = [];
  return {
    filed,
    categories: () => [],
    tone: () => 1,
    setTone: () => {},
    onClose: () => {},
    npcName: 'People of Daggerfall',
    copyToNotebook: (tokens) => filed.push(tokens),
  };
};

test('AUDIT 63 F5: the logbook button marks the SELECTED row and OnPop files it in the notebook', () => {
  assert.deepEqual([...TALK_RECTS.logbook], [118, 158, 67, 18],
    'buttonLogbook Position (118,158) Size (67,18) - DaggerfallTalkWindow.cs:726-727');
  assert.deepEqual([...COPIED_SHADOW_COLOR], [0, 0, 1, 1], 'MarkCopiedListItem\'s Color.blue (:1585-1589)');

  const h = logbookHooks();
  const w = new NativeTalkWindow('Yes?', h);
  // A fresh window has NOTHING selected. SetStartConversation
  // (DaggerfallTalkWindow.cs:635-652), which both Setup (:616) and
  // OnPush (:266) run, opens with `listboxConversation.ClearItems();`
  // - and ListBox.ClearItems (ListBox.cs:532-537) ends in SelectNone
  // (:773-776) `selectedIndex = -1;`. AddItem (:539-577) never assigns
  // selectedIndex, so ListBox.cs:28's `int selectedIndex = 0;` is
  // overwritten on every push and the greeting draws unhighlighted.
  assert.equal(w.conversationSelected, -1);
  // ...so the logbook button copies NOTHING before a selection exists
  // (ButtonLogbook_OnMouseClick :1554-1555 `if (listboxConversation
  // .SelectedIndex < 0) return;`) - the click is still CONSUMED.
  assert.equal(w.click(120, 165), true);
  assert.deepEqual([...w.copyIndexes], [],
    'no selection, no copy - the greeting of a fresh window is not filed');
  w._pushQA('Where is the bank?', 'North of here.');
  assert.equal(w.conversationSelected, 2, ':1280 - always highlight the new answer');

  // a left click toggles that index
  assert.equal(w.click(120, 165), true);
  assert.deepEqual([...w.copyIndexes], [2]);
  w.click(120, 165);
  assert.deepEqual([...w.copyIndexes], [], 'a second click UNMARKS it (:1560-1564)');

  // a RIGHT click takes every row (:1569-1578)
  w.click(120, 165, true);
  assert.deepEqual([...w.copyIndexes].sort((a, b) => a - b), [0, 1, 2]);

  // ...and OnPop files them sorted, as TextQuestion/TextAnswer, with an
  // empty token wherever the run breaks (:307-310). The greeting is a
  // bare string and must normalise to an ANSWER, not to `undefined`.
  w.copyIndexes = new Set([2, 0]);
  w._close();
  assert.deepEqual(h.filed, [[
    { formatting: 'answer', text: 'Yes?' },
    { formatting: 'text', text: '' },
    { formatting: 'answer', text: 'North of here.' },
  ]], 'sorted, with the break token between the non-adjacent pair');

  // an adjacent run gets NO break token
  const w2 = new NativeTalkWindow('Yes?', logbookHooks());
  w2._pushQA('Q', 'A');
  w2.copyIndexes = new Set([1, 2]);
  w2._close();
  assert.deepEqual(w2.hooks.filed[0], [
    { formatting: 'question', text: 'Q' },
    { formatting: 'answer', text: 'A' },
  ]);
});

test('AUDIT 63 F5: the conversation panel is click-selectable, by ListBox\'s PixelWise walk', () => {
  const w = new NativeTalkWindow('Yes?', logbookHooks());
  w._pushQA('Q', 'A');
  // before the first draw the layout is unknown, which is
  // ListBox.cs:469's `listItems.Count == 0` return
  const before = w.conversationSelected;
  w.click(200, 70);
  assert.equal(w.conversationSelected, before, 'no layout, no hit');

  // ListBox.cs:483-497 walks the per-item heights with a
  // rowSpacing*0.5 tolerance; the entries are WRAPPED, so their
  // heights differ and the topic list's fixed-row divide cannot serve.
  w._conversationHeights = [7, 14, 7];   // ROW_H, two wrapped rows, ROW_H
  w.conversationScroll = 0;
  const y0 = TALK_RECTS.conversation[1];
  assert.equal(w.click(200, y0 + 1), true);
  assert.equal(w.conversationSelected, 0);
  assert.equal(w.click(200, y0 + 12), true);
  assert.equal(w.conversationSelected, 1, 'the second entry starts at 7 + rowSpacing 4');
  // entry 1's band runs to yNext - rowSpacing*0.5 = 29 - 2 = 27, so 26
  // is still ITS row and only 30 reaches the third entry
  w.click(200, y0 + 26);
  assert.equal(w.conversationSelected, 1);
  w.click(200, y0 + 30);
  assert.equal(w.conversationSelected, 2);
  // ...and the scroll offset enters the hit, as `scrollIndex + clickY`
  w.conversationSelected = 0;
  w.conversationScroll = 29;
  w.click(200, y0 + 1);
  assert.equal(w.conversationSelected, 2);

  // The DRAW must read that live selection, not restate it.
  const s = src('ui/nativeTalk.js');
  assert.match(s, /const selected = index === this\.conversationSelected;/);
  assert.equal(s.includes('const newest = index === entries.length - 1;'), false,
    'the constant that stood in for listboxConversation.SelectedIndex is gone');
  // ...and the host's notebook sink exists in BOTH hosts that mount the
  // one talk-window door.
  assert.match(src('scenes/world.js'), /townTalk\.notebookSink = \(tokens\) => questBridge\?\.notebook\?\.addNoteTokens\(tokens\);/);
  assert.match(src('scenes/exterior.js'), /townTalk\.notebookSink = \(tokens\) => questBridge\?\.notebook\?\.addNoteTokens\(tokens\);/);
});
