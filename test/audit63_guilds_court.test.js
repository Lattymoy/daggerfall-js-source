// AUDIT 63, the guilds/court lane. Five of the lane's six laws pinned
// against the REFERENCE's value rather than the port's line:
//   F9  RevealGuildHallOnMap + PlayerGPS.DiscoverBuilding's override arm
//   F10 the court's not-guilty chance reads LIVE Personality
//   F11 CalculateTradePrice reads LivePersonality on every caller
//   F12 MakeSpells' door gate ("You have no spellbook!")
//   F33 ActivateMobileEnemy - the living-foe arm of the activate ladder
// (F8, the classic-import membership name, is pinned beside its own
// fixture in classicsave.test.js.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { pleaNotGuilty, CRIMES, changeLegalRep } from '../src/systems/court.js';
import { SKILLS } from '../src/systems/skills.js';
import { cureDiseaseOffer } from '../src/systems/guildServiceActions.js';
import { GUILDS, joinGuild } from '../src/systems/guilds.js';
import { startDisease } from '../src/systems/diseases.js';
import {
  discoverBuilding, discoveredBuildings, restoreDiscovery, snapshotDiscovery,
  hasDiscoveredBuilding,
} from '../src/systems/discovery.js';
import { revealGuildHallsOnMap } from '../src/systems/guildHallReveal.js';
import { hasSpellbook, SPELLBOOK_TEMPLATE_INDEX } from '../src/systems/spellMaker.js';
import { activateMobileEnemy, tryMobileEnemyActivate, youSeeEnemyText } from '../src/player/mobileEnemyActivate.js';
import { PICKPOCKET_DISTANCE, TOO_FAR_AWAY_TEXT, DEFAULT_ACTIVATION_DISTANCE, pickActivatableHit } from '../src/player/activate.js';
import { pickpocket } from '../src/systems/talk.js';

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

// ── F10: DaggerfallCourtWindow.cs:385-386 ─────────────────────────

const defendant = (over = {}) => ({
  isPlayer: true, health: 1, goldPieces: 500, items: [],
  skills: Object.fromEntries(Object.values(SKILLS).map((s) => [s, 40])),
  skillUses: Object.fromEntries(Object.values(SKILLS).map((s) => [s, 0])),
  stats: { personality: 60 }, activeEffects: [], legalRep: { 17: 0 }, ...over,
});

test('AUDIT 63 F10: the not-guilty chance reads LIVE Personality, so a drain moves it by half the magnitude', () => {
  const court = () => ({ regionIndex: 17, punishmentType: 2, fine: 100, daysInPrison: 3 });
  // chance = legalRep + (skill + Personality)/2 = 0 + (40 + 60)/2 = 50.
  // A roll of exactly 50 FAILS (`>= chance`), 49 passes - so the pair
  // of rolls straddling the boundary reads the chance out of the law.
  assert.equal(pleaNotGuilty(court(), defendant(), true, { rolls: seq(0.49) }).outcome, 'free');
  assert.equal(pleaNotGuilty(court(), defendant(), true, { rolls: seq(0.50, 0.5) }).outcome, 'guilty');
  // Drain Personality 20 -> live 40 -> chance 40: the SAME 0.49 roll
  // now fails, which the permanent read could never notice.
  const drained = defendant({
    activeEffects: [{ kind: 'drainAttribute', stat: 'personality', magnitude: 20 }],
  });
  assert.equal(pleaNotGuilty(court(), drained, true, { rolls: seq(0.50, 0.5) }).outcome, 'guilty');
  assert.equal(pleaNotGuilty(court(), drained, true, { rolls: seq(0.39) }).outcome, 'free');
  assert.equal(pleaNotGuilty(court(), drained, true, { rolls: seq(0.40, 0.5) }).outcome, 'guilty',
    'GetLiveStatValue(Personality): 60 - 20 = 40, so the boundary moves 10 points');
  // ...and a fortify moves it the other way, past where the permanent
  // read's boundary was.
  const fortified = defendant({
    activeEffects: [{ kind: 'fortifyAttribute', stat: 'personality', magnitude: 20 }],
  });
  assert.equal(pleaNotGuilty(court(), fortified, true, { rolls: seq(0.59) }).outcome, 'free');
  assert.equal(pleaNotGuilty(court(), fortified, true, { rolls: seq(0.60, 0.5) }).outcome, 'guilty');
  // the no-stats fallback the port has always had is untouched (50)
  const noStats = defendant({ stats: {} });
  assert.equal(pleaNotGuilty(court(), noStats, true, { rolls: seq(0.44) }).outcome, 'free');
  assert.equal(pleaNotGuilty(court(), noStats, true, { rolls: seq(0.45, 0.5) }).outcome, 'guilty');
  // and LegalRep still rides the same sum (DaggerfallCourtWindow.cs:385)
  const repped = defendant();
  changeLegalRep(repped, 17, CRIMES.Pickpocketing, 10);
  assert.notEqual(pleaNotGuilty(court(), repped, true, { rolls: seq(0.50, 0.5) }).outcome,
    pleaNotGuilty(court(), defendant(), true, { rolls: seq(0.50, 0.5) }).outcome);
});

// ── F11: FormulaHelper.cs:1993 / :1999 - LivePersonality ──────────

test('AUDIT 63 F11: the temple quotes a DRAINED customer a higher price - CalculateTradePrice reads LivePersonality', () => {
  const mk = () => {
    const e = {
      isPlayer: true, level: 2, goldPieces: 5000, items: [],
      skills: Object.fromEntries(Object.values(SKILLS).map((s) => [s, 20])),
      skillUses: Object.fromEntries(Object.values(SKILLS).map((s) => [s, 0])),
      stats: { personality: 50 }, activeEffects: [],
    };
    startDisease(e, 0, 0, () => 0);
    return e;
  };
  const plain = cureDiseaseOffer(mk(), GUILDS.FightersGuild, null, { quality: 10, nowClassicMinutes: 0 });
  const drainedEntity = mk();
  drainedEntity.activeEffects.push({ kind: 'drainAttribute', stat: 'personality', magnitude: 30 });
  const drained = cureDiseaseOffer(drainedEntity, GUILDS.FightersGuild, null, { quality: 10, nowClassicMinutes: 0 });
  // the BUYING branch is `(100 - LivePersonality)`, so a lower live
  // Personality RAISES the quote (FormulaHelper.cs:1999)
  assert.ok(drained.cost > plain.cost, `${drained.cost} !> ${plain.cost}`);
  const fortifiedEntity = mk();
  fortifiedEntity.activeEffects.push({ kind: 'fortifyAttribute', stat: 'personality', magnitude: 30 });
  const fortified = cureDiseaseOffer(fortifiedEntity, GUILDS.FightersGuild, null, { quality: 10, nowClassicMinutes: 0 });
  assert.ok(fortified.cost < plain.cost, `${fortified.cost} !< ${plain.cost}`);
});

test('AUDIT 63 F11: every host site that builds the formula\'s skills object reads the stat LIVE', () => {
  // The law is one formula's one input, so the sweep is over the file
  // that owns the other six call sites (trade, keyed shelf, static-NPC
  // service, spellbook buy mode, repair).
  const wm = read('../src/scenes/worldModes.js');
  assert.equal(/personality:\s*playerEntity\.stats\?\.personality\s*\?\?\s*50/.test(wm), false,
    'no host site may pass the PERMANENT stat into CalculateTradePrice');
  assert.equal((wm.match(/liveStat\(playerEntity, 'personality'\)/g) ?? []).length, 6,
    'all six worldModes sites read LivePersonality');
  const ga = read('../src/systems/guildServiceActions.js');
  assert.ok(/liveStat\(entity, 'personality'\)/.test(ga), 'and the temple cure with them');
});

// ── F12: DaggerfallGuildServicePopupWindow.cs:389-395 ─────────────

test('AUDIT 63 F12: MakeSpells is refused AT THE DOOR without a spellbook, and the popup closes', () => {
  const book = { group: 'MiscItems', templateIndex: SPELLBOOK_TEMPLATE_INDEX };
  assert.equal(SPELLBOOK_TEMPLATE_INDEX, 132);   // MiscItems.Spellbook
  assert.equal(hasSpellbook({ items: [book] }), true);
  assert.equal(hasSpellbook({ items: [{ group: 'MiscItems', templateIndex: 131 }] }), false);
  assert.equal(hasSpellbook({}), false);
  const wm = read('../src/scenes/worldModes.js');
  const arm = wm.slice(wm.indexOf("destination === 'guildServiceSpellMaker'"));
  const gate = arm.slice(0, arm.indexOf('new SpellMakerWindow'));
  assert.ok(/if \(!hasSpellbook\(playerEntity\)\)/.test(gate),
    'the pack test runs BEFORE the window is built (:391 decides whether it opens at all)');
  assert.ok(/You have no spellbook!/.test(gate),
    'the localized noSpellbook string (Internal_Strings.csv:656), not the ladder\'s TEXT.RSC 1703');
  assert.ok(/closesWindow: true/.test(gate),
    'DFU CloseWindow()s on BOTH branches (:390), so the refusal stands over a closed popup');
  // and DFU keeps the SECOND gate: the Buy ladder still owns 1703
  const sm = read('../src/systems/spellMaker.js');
  assert.ok(/if \(!hasSpellbook\(entity\)\) return \{ ok: false, textId: NO_SPELLBOOK_ID \}/.test(sm));
});

// ── F9: ThievesGuild.cs:241-247 / PlayerGPS.cs:917-973 ────────────

const HALL = { buildingKey: 7001, name: '', factionId: 42, buildingType: 19, quality: 40 };
const SHOP = { buildingKey: 7002, name: 'The Odd Shop', factionId: 0, buildingType: 6, quality: 40 };

test('AUDIT 63 F9: DiscoverBuilding\'s override arm - it ignores the already-discovered bail and stamps isOverrideName', () => {
  restoreDiscovery(null);
  // the plain arm is unchanged: a second plain discovery is a no-op
  assert.equal(discoverBuilding('r:loc', SHOP), true);
  assert.equal(discoverBuilding('r:loc', SHOP), false, ':926-927 - already discovered');
  // the override arm proceeds ANYWAY (:926 is gated on overrideName == null)
  assert.equal(discoverBuilding('r:loc', SHOP, 'The Thieves Guild'), true);
  const rec = discoveredBuildings('r:loc').find((r) => r.buildingKey === SHOP.buildingKey);
  assert.equal(rec.displayName, 'The Thieves Guild');
  assert.equal(rec.oldDisplayName, 'The Odd Shop', ':965-966 - the canonical name is stashed ONCE');
  assert.equal(rec.isOverrideName, true);   // :968
  // :971-972 - an override that says nothing new clears the flag again
  discoverBuilding('r:loc', SHOP, 'The Odd Shop');
  const back = discoveredBuildings('r:loc').find((r) => r.buildingKey === SHOP.buildingKey);
  assert.equal(back.isOverrideName, false);
  assert.equal(back.displayName, 'The Odd Shop');
  // and the two new columns survive the save envelope
  const snap = snapshotDiscovery();
  restoreDiscovery(null);
  restoreDiscovery(snap);
  assert.equal(discoveredBuildings('r:loc')[0].oldDisplayName, 'The Odd Shop');
  restoreDiscovery(null);
});

test('AUDIT 63 F9: a Thieves Guild member\'s hideout is revealed under its FACTION name; a non-member\'s is not', () => {
  restoreDiscovery(null);
  const dict = new Map([[42, { id: 42, name: 'The Thieves Guild' }], [108, { id: 108, name: 'The Dark Brotherhood' }]]);
  const factionName = (id) => dict.get(id)?.name ?? '';
  const buildings = [HALL, SHOP];
  // a non-member's book reveals nothing (DFU never registered the events)
  assert.equal(revealGuildHallsOnMap({}, 'r:loc', buildings, { factionName }), 0);
  assert.equal(hasDiscoveredBuilding('r:loc', HALL.buildingKey), false);
  // a member's does, and ONLY the buildings of that faction
  // (BuildingDirectory.GetBuildingsOfFaction, :147-154)
  const book = {};
  joinGuild(book, GUILDS.ThievesGuild, 0);
  assert.equal(revealGuildHallsOnMap(book, 'r:loc', buildings, { factionName }), 1);
  const rec = discoveredBuildings('r:loc').find((r) => r.buildingKey === HALL.buildingKey);
  assert.equal(rec.displayName, 'The Thieves Guild',
    'GetGuildName -> GetAffiliation (Guild.cs:170-176) is FACTION.TXT\'s name, read live');
  assert.equal(rec.isOverrideName, true,
    'the hall is a House2 RESIDENCE - only isOverrideName puts a plate on it (ExteriorAutomap.cs:672-680)');
  assert.equal(hasDiscoveredBuilding('r:loc', SHOP.buildingKey), false);
  // the Dark Brotherhood is the same set on its own faction
  const db = {};
  joinGuild(db, GUILDS.DarkBrotherhood, 0);
  const lair = { ...HALL, buildingKey: 7003, factionId: 108 };
  assert.equal(revealGuildHallsOnMap(db, 'r:loc', [lair], { factionName }), 1);
  assert.equal(discoveredBuildings('r:loc').find((r) => r.buildingKey === 7003).displayName,
    'The Dark Brotherhood');
  restoreDiscovery(null);
});

test('AUDIT 63 F9: BOTH exterior hosts drive the reveal, at DFU\'s own moments', () => {
  const world = read('../src/scenes/world.js');
  assert.ok(/const revealMemberGuildHalls = \(\) =>/.test(world));
  // Join (ThievesGuild.cs:168-173) - guildInitiationQuestEnded is the
  // port's only door into either guild
  assert.ok(/initiated\.length\) revealMemberGuildHalls\(\)/.test(world));
  // and the location-rect entry the same host already edges on (F062)
  const rect = world.slice(world.indexOf('_inRect && !_wasInLocationRect'));
  assert.ok(rect.slice(0, 900).includes('revealMemberGuildHalls()'),
    'the enter-rect edge is where RegisterEvents subscribed (:200)');
  // review round: the name is GetAffiliation's FACTION.TXT read
  // (Guild.cs:170-176), whose "unknown-guild" fallback (:175) answers a
  // MISSING RECORD and never an unread file - so BOTH hosts wait on the
  // file before writing an override name into the discovery record.
  const reveal = world.slice(world.indexOf('const revealMemberGuildHalls'));
  const body = reveal.slice(0, reveal.indexOf('revealGuildHallsOnMap('));
  assert.ok(/ensureFactions\?\.\(\)/.test(body),
    'the streaming host reveals before FACTION.TXT is read - the plate saves as unknown-guild');
  const ext = read('../src/scenes/exterior.js');
  assert.ok(/revealGuildHallsOnMap\(activeMemberships\(playerEntity\)/.test(ext),
    'the fixed-city host arms it at load - its one location becomes available exactly once');
  // the pool is the FULL building set, not the talk directory
  assert.ok(/buildingSummaries\(dfLocation\.exterior\?\.buildings/.test(ext));
  // the streaming host's pool is the FULL set too, resolved inside the
  // one reveal (the wait between the two is a microtask, not a re-read)
  assert.ok(/buildingSummaries\(dfLoc\.exterior\?\.buildings/.test(reveal.slice(0, reveal.indexOf('};'))));
  assert.ok(/revealGuildHallsOnMap\(activeMemberships\(playerEntity\)/.test(reveal.slice(0, reveal.indexOf('};'))));
});

// ── F33: PlayerActivate.cs:800-841 + :1611-1673 ───────────────────

const classFoe = (over = {}) => ({
  dead: false,
  mobileType: 145,   // Knight - EnemyBasics' class range (>= 128)
  entity: { isClass: true, level: 3, ...(over.entity ?? {}) },
  ai: { isHostile: false, makeEnemyHostileToAttacker() { this.attacked = true; }, ...(over.ai ?? {}) },
});
const thief = () => ({
  isPlayer: true, level: 8, goldPieces: 0, items: [],
  skills: Object.fromEntries(Object.values(SKILLS).map((s) => [s, 50])),
  skillUses: Object.fromEntries(Object.values(SKILLS).map((s) => [s, 0])),
  stats: { personality: 50 }, activeEffects: [],
});

test('AUDIT 63 F33: the Steal arm - the level difference reaches the chance, and the enemy failure is aggro, not a crime', () => {
  // chance = Pickpocket 50 + 5*(playerLevel 8 - targetLevel 3) = 75.
  // A townsperson's would be 50, so the same roll separates them.
  const foe = classFoe();
  const player = thief();
  let hostile = 0;
  const lines = [];
  assert.equal(activateMobileEnemy(foe, 1, 'steal', player, {
    hud: (t) => lines.push(t), modal: (t) => lines.push(t),
    makeEnemiesHostile: () => { hostile++; },
    rolls: seq(0.74, 0.5, 0.5),   // SuccessRoll(75) passes at 74
  }), true);
  assert.ok(lines.some((l) => /pinched/.test(l)), `success at 74 (chance 75): ${lines}`);
  assert.equal(hostile, 0);
  // the same roll against a townsperson-shaped chance (50) FAILS, which
  // is what proves targetLevel reached FormulaHelper.cs:262-265
  const foe2 = classFoe({ entity: { level: 13 } });   // 50 + 5*(8-13) = 25
  const out = [];
  let hostile2 = 0;
  const robbed = thief();   // the entity the arm actually RUNS against
  activateMobileEnemy(foe2, 1, 'steal', robbed, {
    hud: (t) => out.push(t), modal: (t) => out.push(t),
    makeEnemiesHostile: () => { hostile2++; },
    rolls: seq(0.74, 0.5, 0.5),
  });
  assert.ok(out.some((l) => /not successful/.test(l)), `${out}`);
  // :1654-1658 - `if (target == null) // target is a townsperson` - so a
  // failed ENEMY pickpocket writes no crime and spawns no guards. Read
  // off the player the failing roll was actually run against.
  assert.equal(robbed.crimeCommitted, undefined,
    'PlayerActivate.cs:1655 gates the crime write on a NULL target');
  // and the townsperson twin, same failing roll, DOES set it - which is
  // what makes the line above a gate and not an empty object
  const mugged = thief();
  const twin = pickpocket(mugged, { rolls: seq(0.74, 0.5, 0.5) });   // no target: the :1655 arm
  assert.equal(twin.success, false);
  assert.equal(mugged.crimeCommitted, 'Pickpocketing',
    ':1657 - PlayerEntity.Crimes.Pickpocketing on the townsperson arm alone');
  // :1667-1671: the room turns, and the struck foe learns where you are
  assert.equal(hostile2, 1, 'MakeEnemiesHostile runs because the foe was NOT hostile');
  assert.equal(foe2.ai.attacked, true);
});

test('AUDIT 63 F33: the arm\'s gate ORDER - class, then the attempt flag, then the distance', () => {
  // a MONSTER breaks out silently and still consumes (:827-828)
  const rat = { dead: false, mobileType: 5, entity: { isClass: false, level: 1 }, ai: {} };
  const said = [];
  assert.equal(activateMobileEnemy(rat, 1, 'steal', thief(),
    { hud: (t) => said.push(t), midScreen: (t) => said.push(t) }), true);
  assert.deepEqual(said, []);
  // the distance test is NESTED INSIDE the flag (:830-836): an
  // already-attempted foe says nothing AT ANY RANGE
  const done = classFoe({ entity: { pickpocketAttempted: true } });
  assert.equal(activateMobileEnemy(done, PICKPOCKET_DISTANCE + 50, 'steal', thief(),
    { hud: (t) => said.push(t), midScreen: (t) => said.push(t) }), true);
  assert.deepEqual(said, []);
  // an untried foe beyond 3.2 gets the one line and no roll. AUDIT 64
  // F34: PlayerActivate.cs:834 speaks THAT line through
  // DaggerfallUI.SetMidScreenText - the HUD's centred label - while the
  // pickpocket RESULT below is a PopupMessage/MessageBox (:838 ->
  // :1611), so the arm carries two sinks and this one takes midScreen.
  const far = classFoe();
  const mid = [];
  assert.equal(activateMobileEnemy(far, PICKPOCKET_DISTANCE + 0.01, 'steal', thief(),
    { hud: (t) => said.push(t), midScreen: (t) => mid.push(t) }), true);
  assert.deepEqual(said, [], 'the refusal does not queue a popup row');
  assert.deepEqual(mid, [TOO_FAR_AWAY_TEXT]);
  assert.equal(far.entity.pickpocketAttempted, undefined, 'the flag is set only when the roll runs (:837)');
  // one attempt per foe (:830)
  const once = classFoe();
  const p = thief();
  activateMobileEnemy(once, 1, 'steal', p, { rolls: seq(0.99, 0.5, 0.5), hud: () => {}, midScreen: () => {}, makeEnemiesHostile: () => {} });
  assert.equal(once.entity.pickpocketAttempted, true);
  const after = [];
  activateMobileEnemy(once, 1, 'steal', p, { hud: (t) => after.push(t), midScreen: (t) => after.push(t), modal: (t) => after.push(t) });
  assert.deepEqual(after, [], 'the second click is silent');
});

test('AUDIT 63 F33: Info/Grab/Talk pop the youSeeA / youSeeAn line with no distance gate', () => {
  assert.equal(youSeeEnemyText('Knight'), 'You see a Knight.');
  assert.equal(youSeeEnemyText('Assassin'), 'You see an Assassin.');   // :817's vowel test
  const said = [];
  assert.equal(activateMobileEnemy(classFoe(), 400, 'info', thief(), { hud: (t) => said.push(t) }), true);
  assert.deepEqual(said, ['You see a Knight.']);
  for (const mode of ['grab', 'talk']) {
    const out = [];
    activateMobileEnemy(classFoe(), 60, mode, thief(), { hud: (t) => out.push(t) });
    assert.deepEqual(out, ['You see a Knight.'], `${mode} takes the same arm (:814-816)`);
  }
});

test('AUDIT 63 F33: all five activation ladders carry the arm - the four hosts and the standalone dungeon', () => {
  for (const [file, n] of [['../src/scenes/world.js', 2], ['../src/scenes/exterior.js', 2],
    ['../src/scenes/worldModes.js', 4], ['../src/scenes/dungeon.js', 2]]) {
    const src = read(file);
    assert.ok(/tryMobileEnemyActivate/.test(src), `${file} has no ActivateMobileEnemy arm`);
    assert.equal((src.match(/_enemyArm\(/g) ?? []).length, n,
      `${file}: the NEAR call decided against the ladder, and the FAR call after it`);
    // review round: the NEAR call must be handed a rival distance -
    // DFU's one raycast (:314) reaches :419 only for its own hit
    assert.ok(/_enemyArm\(DEFAULT_ACTIVATION_DISTANCE, /.test(src),
      `${file}: the NEAR call takes no rival distance, so it dispatches foe-first`);
  }
  // and the pickpocket law is ONE law with an optional target, as
  // DFU's Pickpocket(target = null) is
  const talk = read('../src/systems/talk.js');
  assert.ok(/export function pickpocket\(player, \{ target = null/.test(talk));
  assert.ok(/if \(!target && !racialSuppressCrime\(player\)\)/.test(talk),
    'the crime write is the townsperson arm alone (:1655)');
});

test('AUDIT 63 F33 (review): the enemy arm loses to a NEARER activatable - DFU dispatches on its ONE hit', () => {
  // The scene: eye at the origin looking down +Z, a chest whose box the
  // ray enters at 0.8 and a live Knight whose box it enters at 2.55 -
  // both inside DefaultActivationDistance (3.2).
  const eye = [0, 1, 0];
  const dir = [0, 0, 1];
  const collider = { raycast: () => Infinity };
  const chest = [{ key: 'loot:0', aabb: { min: [-0.5, 0.5, 0.8], max: [0.5, 1.5, 1.4] } }];
  const foe = classFoe();
  foe.ai.feet = [0, 0, 2.55];
  foe.ai.height = 1.8;
  const pick = pickActivatableHit(eye, dir, chest, collider);
  assert.equal(pick.key, 'loot:0');
  assert.ok(Math.abs(pick.distance - 0.8) < 1e-6, `chest at ${pick.distance}`);
  // the foe alone IS a hit at 2.55 - the pick is not the thing at fault
  const said = [];
  assert.equal(tryMobileEnemyActivate(eye, dir, [foe], collider, DEFAULT_ACTIVATION_DISTANCE,
    'grab', thief(), { hud: (t) => said.push(t) }), true);
  assert.deepEqual(said, ['You see a Knight.']);
  // ...but with the chest's 0.8 as the rival it must NOT consume:
  // PlayerActivate.cs:419 (MobileEnemyCheck, :1243-1248) reads the same
  // RaycastHit :314 produced, so the chest was the thing the ray struck.
  const foe2 = classFoe();
  foe2.ai.feet = [0, 0, 2.55];
  const quiet = [];
  assert.equal(tryMobileEnemyActivate(eye, dir, [foe2], collider, DEFAULT_ACTIVATION_DISTANCE,
    'grab', thief(), { hud: (t) => quiet.push(t), nearerThan: pick.distance }), false,
  'a foe behind a chest at arm\'s length must not eat the click');
  assert.deepEqual(quiet, []);
  // and Steal is the same gate - no roll, no attempt flag burned
  const foe3 = classFoe();
  foe3.ai.feet = [0, 0, 2.55];
  assert.equal(tryMobileEnemyActivate(eye, dir, [foe3], collider, DEFAULT_ACTIVATION_DISTANCE,
    'steal', thief(), { hud: () => {}, modal: () => {}, nearerThan: pick.distance }), false);
  assert.equal(foe3.entity.pickpocketAttempted, undefined, ':837 was never reached');
  // the foe NEARER than the ladder's winner still takes it (2.55 < 3.0)
  const foe4 = classFoe();
  foe4.ai.feet = [0, 0, 2.55];
  const heard = [];
  assert.equal(tryMobileEnemyActivate(eye, dir, [foe4], collider, DEFAULT_ACTIVATION_DISTANCE,
    'grab', thief(), { hud: (t) => heard.push(t), nearerThan: 3.0 }), true);
  assert.deepEqual(heard, ['You see a Knight.']);
});
