// AUDIT 26, wave "characters": two laws the character layer read off
// the wrong line of the C#.
//
//   - EnemyMotor.DoTouchSpell (EnemyMotor.cs:619-628) resets the SHARED
//     melee timer only after its whole `&&` chain has passed, and the
//     chain ENDS with SetReadySpell - which refuses while silenced
//     (EntityEffectManager.cs:314-316). A silenced touch-caster
//     therefore falls back to its ordinary melee swing.
//   - StaticNPC.GetDisplayName (StaticNPC.cs:319) names an NPC after
//     their faction when `factionData.type == FactionTypes.Individual`,
//     and Individual is 4 (FactionFile.cs:538). 3 is Subgroup.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EnemyCaster } from '../src/characters/enemyCasting.js';
import { EnemyAttack, resetMeleeTimer } from '../src/characters/enemyAttack.js';
import {
  staticNpcData, staticNpcName, isChildNPCTexture, isChildNPCData, CHILDREN_FACTION_ID,
} from '../src/characters/staticNpc.js';
import { collectInteriorPeople } from '../src/characters/interiorPeople.js';
import { exteriorNpcRecord } from '../src/characters/exteriorNpcs.js';
import {
  MobileUnit, stateAnims, bowState,
  RANGED_ATTACK1_ANIMS, RANGED_ATTACK2_ANIMS, RANGED_ATTACK2_ANIM_SPEED,
} from '../src/characters/mobileUnit.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import {
  EnemyAI, SEARCH_MULT_MAX, GIVE_UP_TICKS, CLASSIC_UPDATE_INTERVAL,
} from '../src/characters/enemyMotor.js';
import { BANK_TYPES, nameBankOfRegionRace, fullName } from '../src/characters/nameHelper.js';
import { srand } from '../src/formats/dfRandom.js';
import { FACTION_TYPES } from '../src/formats/factionFile.js';
import { RACES } from '../src/systems/races.js';

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const mkSpell = (index, rangeType) => ({ index, rangeType, element: 0, effects: [{ type: 4, subType: 0 }] });
// The DetectedTarget / CanAct gates DFU puts on the cast branches.
const mkAi = (dist) => ({ _dist: dist, inSight: true, detected: true, giveUpTimer: 200, yaw: 0, feet: [0, 0, 0] });
const mkAttack = () => ({ machine: { state: 'Idle' }, meleeTimer: 0, playerLevel: 10, reflexes: 2, rangedAttack: false });

test('audit26 characters: a SILENCED touch-caster does not re-arm the shared melee timer', () => {
  const touchSpell = mkSpell(1, 1);   // ByTouch
  const player = { activeEffects: [] };
  const free = { level: 5, magicka: 100, spells: [touchSpell] };
  // Silence.StartSilence's bundle, as effects.js mints it (classic key 19,255).
  const gagged = { level: 5, magicka: 100, spells: [touchSpell], activeEffects: [{ kind: 'silenced' }] };

  // The unsilenced foe is the control: DoTouchSpell passes, the decision
  // is the cast, and ResetMeleeTimer runs - the LITERAL it writes, off
  // the same roll (Random.Range(1500, 3001) then the level/reflex terms,
  // divided by 980).
  const ok = new EnemyCaster(free, seq(0, 0.5));
  const okAttack = mkAttack();
  const dec = ok.update(0.016, mkAi(2.0), okAttack, [0, 0, 2], player);
  assert.deepEqual(dec, { spell: touchSpell, touch: true });
  assert.equal(okAttack.meleeTimer, resetMeleeTimer(10, 2, 0.5));

  // Silenced: SetReadySpell returns false, so DoTouchSpell returns false
  // WITHOUT reaching ResetMeleeTimer. The timer stays at 0, which is
  // exactly what EnemyAttack needs to swing this frame.
  const silencedCaster = new EnemyCaster(gagged, seq(0, 0.5));
  const attack = mkAttack();
  assert.equal(silencedCaster.update(0.016, mkAi(2.0), attack, [0, 0, 2], player), null);
  assert.equal(attack.meleeTimer, 0,
    'ResetMeleeTimer lives inside DoTouchSpell\'s body, after SetReadySpell');

  // And it stays at 0 across further frames - the classic failure was a
  // perpetual re-arm, one per frame the timer hit 0.
  for (let i = 0; i < 8; i++) silencedCaster.update(0.016, mkAi(2.0), attack, [0, 0, 2], player);
  assert.equal(attack.meleeTimer, 0);

  // `entity.isSilenced` (the DaggerfallEntity flag) refuses the same way.
  const flagged = new EnemyCaster({ level: 5, magicka: 100, spells: [touchSpell], isSilenced: true }, seq(0, 0.5));
  const flagAttack = mkAttack();
  assert.equal(flagged.update(0.016, mkAi(2.0), flagAttack, [0, 0, 2], player), null);
  assert.equal(flagAttack.meleeTimer, 0);
});

test('audit26 characters: GetDisplayName tests FactionTypes.Individual = 4, not Subgroup = 3', () => {
  // FactionFile.cs:530-546, the enum verbatim around the two members
  // this law reads.
  assert.equal(FACTION_TYPES.Group, 2);
  assert.equal(FACTION_TYPES.Subgroup, 3);
  assert.equal(FACTION_TYPES.Individual, 4);

  const d = staticNpcData({ x: 12, y: 34, z: 56, position: 999, buildingKey: 3, locationIndex: 2, factionId: 100 });
  d.race = RACES.Breton;

  // type 4 answers the faction's own name - that is how a named lord is
  // always that lord.
  assert.equal(staticNpcName(d, { getFaction: () => ({ type: 4, name: 'King Gothryd' }) }), 'King Gothryd');

  // type 3 is a SUBGROUP (a knightly order, a temple branch): its NPCs
  // are seeded like everybody else, never named after the group.
  const subgroup = staticNpcName(d, { getFaction: () => ({ type: 3, name: 'The Order of the Candle' }) });
  assert.notEqual(subgroup, 'The Order of the Candle');
  // and it is the SAME generated name the seed gives with no faction at
  // all - the faction arm was not taken.
  assert.equal(subgroup, staticNpcName(d));
});

// ---------------------------------------------------------------
// AUDIT 26 parity, wave "characters"
// ---------------------------------------------------------------

test('audit26 F016: a static NPC is named from the REGION\'s bank, never their race\'s', () => {
  // SetRuntimeData (StaticNPC.cs:290-309) runs at Start() for every
  // placed StaticNPC and its last line is
  //   npcData.nameBank = PlayerGPS.GetNameBankOfCurrentRegion()
  // (:309), which is `(BankTypes)MapsFile.RegionRaces[regionIndex]`
  // (PlayerGPS.cs:421-427) - "in practice this will always be
  // Redguard/Breton". GetDisplayName (:325-326) then generates from
  // npcData.nameBank alone. Nothing in DFU derives a bank from
  // npcData.race.
  const inSentinel = staticNpcData({ position: 4242, factionID: 0 }, {
    raceOfCurrentRegion: () => RACES.Redguard,      // PlayerGPS.GetRaceOfCurrentRegion
  });
  assert.equal(inSentinel.nameBank, BANK_TYPES.Redguard);
  assert.equal(inSentinel.race, RACES.Redguard, 'and the race arm is untouched');

  // A NORD by faction standing in a Redguard region: the race is Nord,
  // the bank is still Redguard.
  const nordInSentinel = staticNpcData({ position: 4242, factionID: 42 }, {
    getFaction: () => ({ race: 0 }),                // FactionRaces.Nord
    raceOfCurrentRegion: () => RACES.Redguard,
  });
  assert.equal(nordInSentinel.race, RACES.Nord);
  assert.equal(nordInSentinel.nameBank, BANK_TYPES.Redguard);

  // ...and the NAME that comes out is the region bank's, computed the
  // way C# computes it: DFRandom.srand(nameSeed) then
  // FullName(nameBank, gender).
  srand(nordInSentinel.nameSeed);
  const regional = fullName(BANK_TYPES.Redguard, nordInSentinel.gender);
  assert.equal(staticNpcName(nordInSentinel), regional);
  srand(nordInSentinel.nameSeed);
  const nordName = fullName(BANK_TYPES.Nord, nordInSentinel.gender);
  assert.notEqual(regional, nordName,
    'the two banks really do differ - a Nord surname ends in "sen"');

  // an explicit bank still overrides (the seam TalkManager's own
  // GetNameBankOfCurrentRegion call at :2848 uses)
  srand(nordInSentinel.nameSeed);
  assert.equal(staticNpcName(nordInSentinel, { nameBank: BANK_TYPES.Nord }), nordName);

  // the hosts' seam: GetNameBankOfCurrentRegion, when a host answers it
  // directly, wins over the race derivation
  assert.equal(staticNpcData({ position: 1 }, {
    raceOfCurrentRegion: () => RACES.Redguard,
    nameBankOfCurrentRegion: () => BANK_TYPES.Breton,
  }).nameBank, BANK_TYPES.Breton);

  // MapsFile.RegionRaces feeds BOTH reads, so the bank falls out of the
  // race: GetRaceOfCurrentRegion is that table value + 1 (:430-434).
  assert.equal(nameBankOfRegionRace(RACES.Breton), BANK_TYPES.Breton);
  assert.equal(nameBankOfRegionRace(RACES.Redguard), BANK_TYPES.Redguard);
  assert.equal(nameBankOfRegionRace(RACES.Nord), BANK_TYPES.Nord);
  assert.equal(nameBankOfRegionRace(0), BANK_TYPES.Breton, 'no region: GetNameBankOfCurrentRegion answers Breton');
});

test('audit26 F020: IsChildNPCData - the texture table and the Children faction', () => {
  // TextureReader.IsChildNPCTexture (TextureReader.cs:1076-1136),
  // archive by archive, verbatim.
  const DFU_TABLE = {
    181: [3],
    182: [4, 5, 6, 18, 36, 37, 38, 42, 43, 52, 53],
    184: [15],
    186: [4, 5, 6, 7, 19, 37, 38, 39, 43, 44, 53, 54],
    197: [3],
    334: [2, 3, 6, 9, 12],
    346: [2, 3, 12, 15, 16, 18],
    357: [5, 6, 7, 8],
  };
  for (const [archive, records] of Object.entries(DFU_TABLE)) {
    const a = Number(archive);
    for (let record = 0; record <= 60; record++) {
      assert.equal(isChildNPCTexture(a, record), records.includes(record),
        `archive ${a} record ${record}`);
    }
  }
  // an archive the table does not name is never a child, whatever the record
  assert.equal(isChildNPCTexture(183, 4), false);
  assert.equal(isChildNPCTexture(175, 3), false);

  // IsChildNPCData (:342-350) is the OR of that and the faction id.
  assert.equal(CHILDREN_FACTION_ID, 514);
  assert.equal(isChildNPCData({ billboardArchiveIndex: 182, billboardRecordIndex: 4, factionID: 0 }), true);
  assert.equal(isChildNPCData({ billboardArchiveIndex: 182, billboardRecordIndex: 7, factionID: 514 }), true,
    'the Children faction alone is enough');
  assert.equal(isChildNPCData({ billboardArchiveIndex: 182, billboardRecordIndex: 7, factionID: 0 }), false);
});

test('audit26 F020: both people paths carry IsChildNPC, so the questor doors can exclude children', () => {
  // StaticNPC.IsChildNPC (:67-70) is a PROPERTY over Data, and
  // TalkToStaticNPC reads it before either questor arm (TalkManager.cs
  // :755, :769). The port's hosts read `pn.isChildNPC` off the person
  // record, so the record mints must derive it.
  const recordData = {
    interior: {
      blockPeopleRecords: [
        { xPos: 1, yPos: 2, zPos: 3, textureArchive: 182, textureRecord: 4, factionID: 0, flags: 0, position: 10 },
        { xPos: 4, yPos: 5, zPos: 6, textureArchive: 182, textureRecord: 7, factionID: 0, flags: 0, position: 11 },
        { xPos: 7, yPos: 8, zPos: 9, textureArchive: 175, textureRecord: 1, factionID: 514, flags: 0, position: 12 },
      ],
    },
  };
  const people = collectInteriorPeople(recordData);
  assert.deepEqual(people.map((p) => p.isChildNPC), [true, false, true]);

  // ...and the street NPCs the exterior overload stands
  const child = exteriorNpcRecord({
    x: 0, y: 0, z: 0, archive: 334, record: 12, factionID: 42, flags: 0, recordPosition: 1,
    rawX: 0, rawY: 0, rawZ: 0,
  });
  assert.equal(child.isChildNPC, true);
  const adult = exteriorNpcRecord({
    x: 0, y: 0, z: 0, archive: 334, record: 13, factionID: 42, flags: 0, recordPosition: 1,
    rawX: 0, rawY: 0, rawZ: 0,
  });
  assert.equal(adult.isChildNPC, false);

  // the host end of the seam, unchanged: it reads the record's flag and
  // hands it to TalkToStaticNPC's two `!isChildNPC` gates.
  const wm = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
  assert.equal((wm.match(/isChildNPC: !!pn\.isChildNPC/g) ?? []).length, 2,
    'both TalkToStaticNPC call sites pass the record flag');
});

test('audit26 F009: a HasRangedAttack2 mobile draws its bow on records 25-29', () => {
  // EnemyBasics.RangedAttack2Anims (:103-113) at RangedAttack2AnimSpeed
  // (:35) - records 25-29 with the three back diagonals mirrored, the
  // same shape as every other table.
  assert.equal(RANGED_ATTACK2_ANIM_SPEED, 10);
  assert.deepEqual(RANGED_ATTACK2_ANIMS.map((a) => a.record), [25, 26, 27, 28, 29, 28, 27, 26]);
  assert.deepEqual(RANGED_ATTACK2_ANIMS.map((a) => a.flip),
    [false, false, false, false, false, true, true, true]);
  assert.deepEqual(RANGED_ATTACK2_ANIMS.map((a) => a.fps), new Array(8).fill(10));
  assert.deepEqual(RANGED_ATTACK1_ANIMS.map((a) => a.record), [20, 21, 22, 23, 24, 23, 22, 21],
    'and RangedAttack1 is still 20-24 (:90-100)');

  // GetStateAnims (DaggerfallMobileUnit.cs:837-842): one case each.
  assert.equal(stateAnims('ranged', 130, true), RANGED_ATTACK1_ANIMS);
  assert.equal(stateAnims('ranged2', 130, true), RANGED_ATTACK2_ANIMS);

  // EnemyMotor.cs:594-597 - RangedAttack1 ONLY when it has 1 and NOT 2.
  assert.equal(bowState({ hasRangedAttack1: true }), 'ranged');
  assert.equal(bowState({ hasRangedAttack1: true, hasRangedAttack2: true }), 'ranged2');
  // the two rows that carry the flag, and one that does not
  assert.equal(ENEMY_BASICS['130'].hasRangedAttack2, true, 'Battlemage');
  assert.equal(ENEMY_BASICS['133'].hasRangedAttack2, true, 'Nightblade');
  assert.equal(bowState(ENEMY_BASICS['130']), 'ranged2');
  assert.equal(bowState(ENEMY_BASICS['133']), 'ranged2');
  assert.equal(ENEMY_BASICS['128'].hasRangedAttack2, undefined, 'Mage: RangedAttack1 only');

  // ...and the sprite that actually renders. The Battlemage also has
  // HasSpellAnimation, so records 20-24 are its SPELL sprites: a bow
  // shot rendering there is the bug this pins.
  const draw = (basics) => {
    const m = new MobileUnit(130, basics, () => 8, () => 0.5);
    m.update(1 / 60, { rangedStriking: true }, 0, [0, 0, 0], [0, 0, 5]);
    return m.update(1 / 60, {}, 0, [0, 0, 0], [0, 0, 5]).record;
  };
  assert.equal(draw(ENEMY_BASICS['130']), 25, 'the Battlemage draws from RangedAttack2Anims');
  assert.equal(draw(ENEMY_BASICS['128']), 20, 'a RangedAttack1-only archer is unchanged');

  // and the -1 marker still looses the arrow from the second table
  const m = new MobileUnit(130, { ...ENEMY_BASICS['130'], rangedAttackAnimFrames: [3, -1, 1] },
    () => 8, () => 0.5);
  m.update(1 / 60, { rangedStriking: true }, 0, [0, 0, 0], [0, 0, 5]);
  assert.equal(m.state, 'ranged2');
  for (let i = 0; i < 6 && !m.shootArrow; i++) m.update(1 / 10, {}, 0, [0, 0, 0], [0, 0, 5]);
  assert.equal(m.shootArrow, true, 'ApplyEnemyState seeds BOTH ranged states from RangedAttackAnimFrames (:250-252)');
  assert.equal(m.doMeleeDamage, false);
});

test('audit26 F010: knockback is CanAct=false - no bow shot and no spell through hit-stun', () => {
  // KnockbackMovement (EnemyMotor.cs:265-320) ends with CanAct = false
  // whenever KnockbackSpeed > 0 (:317), and TakeAction - which holds
  // DoRangedAttack's 1/32 bow roll (:469) and DoTouchSpell (:473) -
  // runs only under `if (CanAct)` (:171-172).
  const shooter = (knockbackSpeed) => {
    const a = new EnemyAttack({ liveSpeed: 50, rolls: () => 0 });
    a.rangedAttack = true;
    const ai = {
      _dist: 20, inSight: true, detected: true, giveUpTimer: 200,
      yaw: 0, feet: [0, 0, 0], knockbackSpeed,
    };
    a.update(CLASSIC_UPDATE_INTERVAL, ai, [0, 0, 20]);
    return a.firedRanged;
  };
  assert.equal(shooter(0), true, 'the control: in band, in sight, the 1/32 roll passes');
  assert.equal(shooter(3), false, 'knocked back, the bow roll never runs');

  // Both EnemyCaster branches, same law.
  const player = { activeEffects: [] };
  const touchSpell = mkSpell(1, 1);           // ByTouch
  const rangedSpell = mkSpell(2, 2);          // SingleTargetAtRange
  const knocked = (dist) => ({ ...mkAi(dist), knockbackSpeed: 3 });

  const touchOk = new EnemyCaster({ level: 5, magicka: 100, spells: [touchSpell] }, seq(0, 0.5));
  assert.deepEqual(touchOk.update(0.016, mkAi(2.0), mkAttack(), [0, 0, 2], player),
    { spell: touchSpell, touch: true });
  const touchHit = new EnemyCaster({ level: 5, magicka: 100, spells: [touchSpell] }, seq(0, 0.5));
  const touchAttack = mkAttack();
  assert.equal(touchHit.update(0.016, knocked(2.0), touchAttack, [0, 0, 2], player), null);
  assert.equal(touchAttack.meleeTimer, 0, 'and DoTouchSpell never reached ResetMeleeTimer');

  const castOk = new EnemyCaster({ level: 5, magicka: 100, spells: [rangedSpell] }, seq(0, 0));
  assert.deepEqual(castOk.update(CLASSIC_UPDATE_INTERVAL, mkAi(20), mkAttack(), [0, 0, 20], player),
    { spell: rangedSpell, touch: false });
  const castHit = new EnemyCaster({ level: 5, magicka: 100, spells: [rangedSpell] }, seq(0, 0));
  assert.equal(castHit.update(CLASSIC_UPDATE_INTERVAL, knocked(20), mkAttack(), [0, 0, 20], player), null);
});

// The wave-35 stand-off fixture: a foe that sees its target at 20 units.
const mkFoe = (opts = {}) => {
  const ai = new EnemyAI({
    raycast: (o, d) => (d[1] < -0.5 ? 1 : Infinity),
    capsuleCast: () => ({ dist: Infinity, key: null }),
    move: () => ({ grounded: true }),
  }, [0, 0, 0], 0, { liveSpeed: 50, ...opts });
  ai.detected = true;
  ai.inSight = true;
  ai.lastKnownTargetPos = [0, 0, 20];
  ai.predictedTargetPos = ai.lastKnownTargetPos;
  ai.destination = ai.lastKnownTargetPos;
  ai._dist = 20;
  return ai;
};

test('audit26 F011: DoRangedAttack comes BEFORE the detour arm, so a shooter stands off mid-detour', () => {
  // TakeAction (EnemyMotor.cs:440-484): DoRangedAttack at :469 and
  // DoTouchSpell at :473 both return early on success, and the
  // `if (avoidObstaclesTimer > 0) AttemptMove(...)` detour override is
  // only reached at :481-484 when neither did. So an in-band shooter
  // with sight and detection does NOT walk its detour - the timer just
  // decays under it.
  const archer = mkFoe({ hasBowAttack: true });
  archer.avoidObstaclesTimer = 0.5;
  archer.detourDestination = [0, 0, 20];
  archer.moving = true;
  archer._classicTick([0, 0, 20]);
  assert.equal(archer.moving, false, 'the stand-off wins over the detour');

  // ...and so does a ranged caster, DoRangedAttack's other half of the
  // `hasBowAttack || CurrentMagicka > 0` gate.
  const caster = mkFoe({ canCastRangedSpell: () => true });
  caster.avoidObstaclesTimer = 0.5;
  caster.detourDestination = [0, 0, 20];
  caster.moving = true;
  caster._classicTick([0, 0, 20]);
  assert.equal(caster.moving, false);

  // A foe with NO ranged option still takes the detour arm - the
  // override is intact, it just sits after the two attack calls.
  const brawler = mkFoe({});
  brawler.avoidObstaclesTimer = 0.5;
  brawler.detourDestination = [0, 0, 20];
  brawler._classicTick([0, 0, 20]);
  assert.equal(brawler.moving, true, 'and a melee foe still walks its detour past melee range');
});

test('audit26 F012: HandleNoAction resets the search ramp on EVERY arm', () => {
  // HandleNoAction (EnemyMotor.cs:354-366): "no target or after giving
  // up finding the target or if target position hasn't been acquired
  // yet" - ONE body for all three arms, and searchMult = 0 is in it
  // (:362). It runs every FixedUpdate, ahead of the `if (CanAct)` gate.

  // the GAVE-UP arm: the ramp is cleared, not carried into the next
  // pursuit as a 10-unit overshoot past the last known position
  const gaveUp = mkFoe({});
  gaveUp.detected = false;
  gaveUp.giveUpTimer = 0;
  gaveUp.searchMult = SEARCH_MULT_MAX;
  gaveUp._classicTick([0, 0, 20]);
  assert.equal(gaveUp.searchMult, 0);
  assert.equal(gaveUp.moving, false, 'and it still takes no action');

  // the SENTINEL arm (PredictedTargetPos == ResetPlayerPos)
  const unseen = mkFoe({});
  unseen.predictedTargetPos = null;
  unseen.searchMult = 4;
  unseen._classicTick([0, 0, 20]);
  assert.equal(unseen.searchMult, 0);

  // a foe that CAN act does not take this body at all - the reset is
  // HandleNoAction's three arms, not something every tick does
  const hunting = mkFoe({});
  hunting.giveUpTimer = GIVE_UP_TICKS;   // detection refills it (:419-420)
  hunting.searchMult = 4;
  assert.equal(hunting._handleNoAction(), false, 'target seen, timer alive: CanAct stays true');
  assert.equal(hunting.searchMult, 4);

  // ...and it runs for a foe that cannot act at all: HandleNoAction is
  // called at :168, the CanAct gate is at :171.
  const pacified = mkFoe({});
  pacified.isHostile = false;
  pacified.giveUpTimer = 0;
  pacified.searchMult = SEARCH_MULT_MAX;
  pacified.update(CLASSIC_UPDATE_INTERVAL, [0, 0, 20], { gameMinutes: 0, playerStealth: 0, rolls: () => 0.5 }, false);
  assert.equal(pacified.searchMult, 0, 'a pacified foe clears its ramp too');

  const stunned = mkFoe({});
  stunned.knockbackSpeed = 3;
  stunned.giveUpTimer = 0;
  stunned.searchMult = SEARCH_MULT_MAX;
  stunned.update(CLASSIC_UPDATE_INTERVAL, [0, 0, 20], { gameMinutes: 0, playerStealth: 0, rolls: () => 0.5 }, false);
  assert.equal(stunned.searchMult, 0, 'and so does one mid-knockback');
});
