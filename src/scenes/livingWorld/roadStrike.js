// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LW7 (2026-10-05, bible/06-Systems/Living-World.md "LW7"): A SWING AT THE ROAD'S TRAVELLERS. A swing that met nobody in
// the street is offered to the living world's travellers on the road - the body on the look ray within the weapon's reach
// (the talk ray's own pick, SOC5's one cylinder), no wall before it: DFU's one-hit civilian (WeaponManager.cs:504-521,
// less the watch - there is none on the road), struck down for good (the roads' deed, livingRoads.js slain - which LW11
// carries to the road's region as a Murder when a witness reaches a town, caravanHost.js slain), the blood, the
// Brotherhood's five and the racial override's hit. Moved out of world.js bootWorld (HOST-SPLIT) by ROAD-SPARE.
//
// FIELD BUGS 2026-10-25i ROAD-SPARE (the Discord's #bug-reports, pepsiorcoke, "Player gets a bounty when defending
// themselves against quest NPC's who attack": "Assassin's are attacking me for escorting another NPC and I choose to
// defend myself and my escort target guards approach me with a hefty fee of 500+ gold"). PROTECT-FIGHT's law
// (cityGuards.js playerSparesPerson: under Protect Bystanders, a fight - encounters.js fightNear since AUDIT FB1025i D3 - or a raid
// passes the townspeople by) was asked of the street's walkers and never of the road's: a swing at an attacker just
// past the reach landed on the traveller on the look ray - the caravan's own merchant, in an escort's fight - and one
// hit was a Murder reported, -20 of the region's law at the town, the name the watch knows (standing.js, under -10),
// and the watch's stop asking its fine (600 gold from a clean name). The road's travellers take the street's law now:
// one it spares stops the swing (no deed, no door behind them bashed - AUDIT 29g's law); no fight, or the protection
// off, and a blow at a traveller is DFU's.
// THE LIKELY CAUSE, NOT A PROVEN ONE (AUDIT FB1025i D1): the reporter's save was not read. The quest's own attackers
// and their deaths charge nothing, and the one other path to the same fine is DFU's own script and stands -
// A0C00Y17's watch branch (two Warriors with a warrant), refused: `legal repute -20`, known, 600 gold (pinned as
// intended in test/systems/livingWorld/fb1025i_roadspare.test.js).
// ═══════════════════════════════════════════════════════════════════
import { nearestPerson } from '../townTalk.js';
import { WEAPON_REACH } from '../../combat/playerWeapon.js';
import { LETHAL_HIT } from '../../combat/blood/bloodDecals.js';
import { tallyCrimeGuildRequirements } from '../../systems/crimeGuilds.js';
import { playerWeaponHitEntity } from '../../systems/worldTick.js';

/** The swing stopped on a traveller the player spares - it met someone (no door behind them is bashed). */
export const ROAD_SPARED = Object.freeze({ spared: true });
/** A traveller struck down. */
export const ROAD_STRUCK = Object.freeze({ struck: true });

/**
 * The road's strike, over the host's live parts. Answers what the street's civilian pass answers (cityGuards.js
 * resolveCivilianHit): false, the swing met nobody; ROAD_SPARED; or ROAD_STRUCK.
 * @param {{ roads: () => any, open: () => boolean, collider: any, cityGuards: any, hitEffects: any, playerEntity: any }} deps -
 *   `roads()` the roads' layer (null before it stands); `open()` whether a swing may meet one now (the living world on,
 *   the player in the open world); `cityGuards` the street's pool, whose playerSparesPerson is the one law of who a
 *   blow passes by; `hitEffects` the street's blood pool (the road is the open world's alone)
 */
export function createRoadStrike({ roads, open, collider, cityGuards, hitEffects, playerEntity }) {
  /** @param {number[]} eye @param {number[]} dir */
  return function strikeRoad(eye, dir) {
    const layer = roads();
    if (!layer || !open()) return false;
    /** @type {any} */   // a seat of the street's shape ({ person, pos }), the talk ray's own pick (SOC5: the one cylinder)
    const near = nearestPerson(eye, dir, layer.talkSeats());
    if (!near || near.distance > WEAPON_REACH) return false;
    const wall = collider.raycast(eye, dir, near.distance);
    if (Number.isFinite(wall) && wall < near.distance - 1e-3) return false;
    if (cityGuards.playerSparesPerson(near.entry.person)) return ROAD_SPARED;   // ROAD-SPARE: the street's law, on the road
    if (!layer.slain(near.entry.person)) return false;
    hitEffects.showBloodSplash(0, [eye[0] + dir[0] * near.distance, eye[1] + dir[1] * near.distance, eye[2] + dir[2] * near.distance], null, LETHAL_HIT);
    tallyCrimeGuildRequirements(playerEntity, false, 5);
    playerWeaponHitEntity(playerEntity, { health: 0 }, { isCivilian: true });
    return ROAD_STRUCK;
  };
}
