// WATCH-PROTECTS (2026-10-06, Mac: "improve the guards" - asked, "The watch protects people": a monster attacking
// townspeople draws the watch to defend them; bible/06-Systems/Living-World.md WATCH-PROTECTS): A TOWNSPERSON AS A
// MONSTER'S QUARRY. DFU's enemy senses weigh other enemies and the player alone - "Civilian Mobile NPCs are not handled
// here" (EnemySenses.cs:739-741) - so no monster ever turned on a townsperson, and the watch never had one to defend.
// In the living world's lane one on the street, not of the watch, stands for the target machine as a body of their own:
// a `civilian` at their feet, hunted by a hostile monster that fights hand to hand (characters/enemyTargets.js
// huntsCivilians), struck down by its first landed blow as DFU's civilian is by the player's (cityGuards.js
// resolveCivilianHit: one hit, `disable()`), and a fight the watch comes to (systems/townWatch.js isTownThreat).

/** A townsperson's height for the target machine's eye and reach (m) - a person's billboard. */
export const QUARRY_HEIGHT = 1.8;

/** The blow a townsperson takes from a monster: one, whatever the monster would deal - one landed blow is death, as the
 *  player's is (the damage formula weighs an armoured body a townsperson does not have). */
export const QUARRY_BLOW = () => 1;

/**
 * The body a townsperson stands as for the monsters. `person` the street's walker (its `living` names them);
 * `struck(quarry, striker)` the host's word when a blow lands - the townsperson killed by another hand (livingTown.js
 * killed). The feet are the host's to keep, in the world's frame, each frame.
 * @param {any} person @param {(quarry: any, striker: any) => void} struck
 */
export function makeQuarry(person, struck) {
  const q = {
    civilian: true, living: person.living, person,
    ai: { feet: [0, 0, 0], height: QUARRY_HEIGHT, centreOffset: QUARRY_HEIGHT / 2, target: null, isHostile: false, wouldBeSpawned: true, yaw: 0 },
    entity: { team: 'Civilian', mobileTeam: 'Civilian', health: 1, maxHealth: 1 },
    /** A monster's landed blow - the first is death, whatever it dealt. Answers 1 that once, else 0. */
    hurtFromFoe(_damage, _dir, striker) {
      if (q.entity.health <= 0) return 0;
      q.entity.health = 0;   // the target machine lets go of a body at no health (enemyTargets.js targetHealth)
      struck(q, striker);
      return 1;
    },
  };
  return q;
}
