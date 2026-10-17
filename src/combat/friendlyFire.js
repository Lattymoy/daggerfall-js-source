// @ts-check
// SHIPMATES (2026-09-29, Mac: "Ally crew member's should have green health bars above their head, and not be able to
// engage in friendly fire") - WHO THE PLAYER'S OWN HARM PASSES BY, one law for every door it goes through: the swing
// (scenes/exteriorFoes.js resolvePlayerHit - the one pool a shipmate stands in: its candidates are never him), the shaft
// and the gun (combat/arrowFlight.js), the spell (scenes/hostMagic.js), the torch, the charge and the trample
// (scenes/world.js). The swing asks `isShipmate` alone: a town's defender keeps MeleeAttackFriendlyProtection's law in
// the watch's own pass (DISC19 W5 - protection off, the swing reaches him).
//
// It was each door's own. A town's DEFENDER (cityGuards.js) was spared by the shaft and the spell; an ally only by the
// swing - and by the swing only while something else stood in reach (the vanilla SphereCast strikes a protected one
// that stands alone) - and by neither the torch nor the charge. So a boarding's hands took the player's arrows, spells,
// torch and charge, and a blow turned them on the player (enemyTargets.js resetAllyTeamOnPlayerAttack).
//
// A SHIPMATE is an ally of the player's standing on a ship's deck (`deckBoat` - the world's deck registry, DECK-WALK: a
// boarding's hands, the crew standing to repel boarders) - or, in a room, another player's (`shipmate`: the owner's foes
// frame names its crew, scenes/exteriorFoes.js `cw`, and the reader stands them as its allies too, as RAID2 stands a
// watchman the owner names): every door passes them by, and their own blasts and shafts pass by the player and each
// other (hostMagic.js). A summoned daedra or a quest's companion keeps DFU's own friendly fire.

/** Whether `t` (a pool's foe) is a shipmate: an ally of the player's, alive, on a ship's deck. */
export const isShipmate = (t) => !!t && (t.deckBoat != null || t.shipmate === true) && !t.dead && t.entity?.team === 'PlayerAlly';

/** Whether the player's own harm passes `t` by: a town's defender, or a shipmate. */
export const sparedByPlayer = (t) => !!t && (t.defender === true || isShipmate(t));

/** ARENA-TEAMS (FIELD BUGS 2026-10-04e, Discord: "The multiple npc arena fights will target each other despite being
 *  on the same team"): two fighters of ONE bout on ONE side (characters/enemy/enemyTargets.js boutGate's `entity.bout`) - the
 *  two-against-one bouts' pair. The gate already kept each other out of their TARGETS; a Mage's or a Healer's area
 *  spell (hostMagic.js explodeAt) still burst on the partner beside it, which read as the two fighting. Its blast
 *  passes a teammate by. A Grand Melee is every fighter a side of its own, so nobody there is anybody's teammate. */
export function boutTeammates(a, b) {
  const x = a?.entity?.bout ?? null, y = b?.entity?.bout ?? null;
  return !!x && !!y && a !== b && String(x.id) === String(y.id) && (x.side | 0) === (y.side | 0);
}
