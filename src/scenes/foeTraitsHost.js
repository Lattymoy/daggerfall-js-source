// @ts-check
// AUDIT WORLD-EVENTS (2026-10-25, the owner: "Audit this. Ensure perfection"; bible/01-Overview/audits/Audit-World-Events.md,
// bible/05-Combat/Boss-Traits.md): THE FOE POOLS' BOSS TRAITS, out of the hosts' bodies (HOST-SPLIT, bible/01-Overview/
// Host-Split.md - scenes/dungeonContext.js wires each in one call, scenes/exteriorFoes.js the striker's door):
//   - L2-13: my blow's floating number told again where a trait resisted it (the door decides after the formula reports);
//   - L2-3: the room's record carries a copy's WRATH (`bw`) and its WARD's share (`bv`) to every joiner, and an own lane's
//     elite its mark and its traits (`z`, `bt` - a searched grave's elite was a plain foe on every peer); a joiner's copy
//     takes them (wrathful as the host's, its ward drawn as the host holds it, both said);
//   - L2-7: a joiner's copy keeps no ward of its own (no blow of the room's spends it - the divert comes first, so it
//     showed whole after the host's broke), and a client that takes the room over stands one where its copy had none;
//   - L5-4: the Spire's lords - its host bodies a lord's (scenes/eliteGates/egFight.js) - carry their two traits off their
//     names, as the court's Warden and the Remnant do, said once when met.
import { bossTraitsOf, bossTraitMask, bossTraitsOfMask, giveBossTraits, hasBossTrait, markBossWrath, bossWardShare, standBossWard,
  bossClockS, tickBossClock, bossTraitsTick, bossStrikeAt, bossTraitsTaught, bossWardBrokeLine, bossWrathLine, relayBossTraits, bossTraitWords,
  bossTraitsMetLine } from '../systems/bossTraits.js';
import { promoteEliteFoe } from '../systems/eliteFoes.js';
import { retellHit } from '../ui/hitNumbers.js';
import { t } from '../systems/textManager.js';

/** A copy's trait fields for the room's record: its wrath, its ward's share - and, on an own lane's record (`seeded`: its
 *  peers stand it off the record alone), its elite's mark and its traits. */
export function traitWire(entity, seeded = false) {
  const out = /** @type {Record<string, number>} */ ({});
  if (!bossTraitsOf(entity).length) return out;
  if (entity.bossWrath) out.bw = 1;
  if (entity.bossWard) out.bv = bossWardShare(entity, bossClockS());
  if (seeded && entity.eliteFoe) { out.z = 1; out.bt = bossTraitMask(entity.bossTraits); }
  return out;
}
/** The fields' share of the record's change key. */
export const traitWireKey = (r) => `${r.bw ?? 0},${r.bv ?? -1}`;
/** A joiner's copy takes the host's word on it: an own lane's elite and its traits (at most an elite's one, two a raid's
 *  leader's), its wrath, its ward's share - the ward's break and the wrath said here too (`say`, in `nameOf()`). */
export function readTraitWire(entity, r, say, nameOf) {
  if (!entity || !r) return;
  if (r.z === 1 && !entity.eliteFoe) promoteEliteFoe(entity, { own: false });
  if (entity.eliteFoe && Number.isInteger(r.bt) && !bossTraitsOf(entity).length) giveBossTraits(entity, bossTraitsOfMask(r.bt, entity.raidLeader ? 2 : 1), { own: false });
  if (r.bw === 1 && markBossWrath(entity)) say?.(bossWrathLine(nameOf()));
  if (r.bv !== undefined && hasBossTrait(entity, 'warded')) {
    if (entity.bossWardShown > 0 && r.bv === 0) say?.(bossWardBrokeLine(nameOf()));
    entity.bossWardShown = r.bv / 100;
  }
}
/** The room changes hands: a copy I step now stands a ward (its last shown share), one I only draw keeps none. */
export function traitsAuthority(entity, on) {
  if (!entity || !hasBossTrait(entity, 'warded')) return;
  if (on) standBossWard(entity, bossClockS());
  else { if (entity.bossWard) entity.bossWardShown = bossWardShare(entity, bossClockS()) / 100; entity.bossWard = undefined; }
}
/** A host body that is a LORD (the Spire's - its target's `lord`): its two traits off its name and kind, said once. */
export function hostLordTraits(q, say) {
  if (!q?.lord || !q.entity || bossTraitsOf(q.entity).length) return;
  const name = q.name ?? q.entity.name ?? '';
  if (giveBossTraits(q.entity, relayBossTraits(name, q.mobile), { own: false })) say?.(bossTraitsMetLine(name, bossTraitWords(q.entity)));
}
/** THE STRIKER'S DOOR for my blow, as the exterior pool's: resisted, its thorns at me, and (L5-6) each trait's rule told
 *  once, at my first blow on one. */
export function strikeTraits(entity, damage, kind, weapon, element, whole, thorns, say) {
  const d = bossStrikeAt(entity, damage, kind, weapon, element, whole, thorns);
  if (d !== damage) retellHit(entity, d, t('bossTraits.tag.resisted', 'Resisted'));   // L2-13: the number that landed, said so
  for (const l of bossTraitsTaught(entity)) say?.(l);
  return d;
}
/** A frame of the room's foes (L2-5): the traits' clock (`dt` 0 holds it), and - on the client that steps them - a wrath
 *  come due turns on it, struck or not (said in `nameOf(f)`). */
export function traitsFrame(foes, authority, dt, say, nameOf) {
  const s = tickBossClock(performance.now(), !(dt > 0));
  if (!authority) return;
  for (const f of foes) if (!f?.dead && f.entity?.bossWrathFrom != null && bossTraitsTick(f.entity, s) === 'wrath') say?.(bossWrathLine(nameOf(f)));
}
