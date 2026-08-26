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
import { EnemyCaster } from '../src/characters/enemyCasting.js';
import { resetMeleeTimer } from '../src/characters/enemyAttack.js';
import { staticNpcData, staticNpcName } from '../src/characters/staticNpc.js';
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
