// @ts-check
// FOE-TITLE (2026-10-02): WHAT A SPECIAL FOE IS CALLED - one home for every surface that names a foe (the HUD's target
// bar, the hover - at peace only since HOVER-PLAIN, 2026-10-03 - the death line, the body's title). Before it, three copies spelt a LOOT7 champion's trait each their
// own way (ui/hud/hudFoeTarget.js, systems/worldTooltips.js, systems/champions.js championName) and an ELITE FOE was named
// on the target bar alone.
//
//   - a REVENANT (systems/revenant/revenant.js) is called by its own name - "Grushnak the Kinslayer" - and nothing else;
//   - a LOOT7 CHAMPION by its trait before its kind - "Mighty Orc Warlord" (every trait's name is its id title-cased,
//     test/systems/loot7_champions.test.js);
//   - an ELITE FOE by "Elite" before its kind - "Elite Orc Warlord" (a foe is an elite or a champion, never both);
//   - STAFF-EVENT: a staff event's MINI BOSS by "Mighty" before its kind - "Mighty Orc Warlord" (an elite underneath);
//   - RVN6: a revenant's FOLLOWER by its band after its kind - "Orc of Grushnak's Warband" (never a champion or an elite);
//   - BOSS-TRAITS (bible/05-Combat/Boss-Traits.md): a foe with traits by its first trait's word before the rest - "Warded
//     Elite Orc" (the word stamped on the entity, `bossTitle`, so this leaf reads a string); RAID5: a raid's LEADER by its
//     party's word - "Thorned Knight-Captain";
//   - UNQUIET (bible/06-Systems/Revenants.md section 46): a special foe carrying THE MARK (systems/revenant/unquietMark.js -
//     the one that may rise as a revenant) by "Unquiet" before the rest - "Unquiet Elite Orc", "Unquiet Mighty Orc Warlord".
//
// A LEAF: it imports nothing, so the HUD's leaves can ask it.

/** AUDIT WORLD-EVENTS L5-12: how a trait's word and a name compose - systems/bossTraits.js hands the player's language's
 *  (its key `bossTraits.title`), so this leaf stays one; until it does, the word before the name. */
let _traitTitle = (/** @type {string} */ word, /** @type {string} */ name) => `${word} ${name}`;
export function setTraitTitleFormat(fn) { if (typeof fn === 'function') _traitTitle = fn; }

/** @param {any} entity @param {string | null | undefined} base the foe's own name (its kind's, or its career's)
 *  @param {{ traits?: boolean }} [o] `traits` false: no trait's word (AUDIT WORLD-EVENTS L5-12 - the enhanced target frame
 *  names the traits on their own line under the name, and said them twice) */
export function foeTitle(entity, base, { traits = true } = {}) {
  if (!base) return base;
  if (entity?.wildGiant) base = 'Greater Giant';   // GREATER-GIANT: the zone's own giants (systems/wild/wildZone.js GREATER_GIANT_NAME)
  const revenant = entity?.revenant?.name;
  if (typeof revenant === 'string' && revenant) return revenant;
  const band = entity?.bandName;   // RVN6 (bible/12-Enhanced-AI/Feud-Arc.md 17): a revenant's follower, by its band - "Orc of Grushnak's Warband"
  if (typeof band === 'string' && band) return `${base} of ${band}`;
  const c = entity?.champion;
  const named = typeof c === 'string' && c ? `${c.charAt(0).toUpperCase()}${c.slice(1)} ${base}` : base;
  const lead = typeof entity?.raidLeader?.name === 'string' && entity.raidLeader.name ? entity.raidLeader.name : null;   // RAID5: a raid's leader, by its party's word (systems/eliteFoes.js promoteRaidLeader)
  const special = entity?.staffBoss ? `Mighty ${named}` : lead ?? (entity?.eliteFoe ? `Elite ${named}` : named);   // STAFF-EVENT: a staff event's mini boss (systems/eliteFoes.js promoteStaffBoss)
  const traited = traits && typeof entity?.bossTitle === 'string' && entity.bossTitle ? _traitTitle(entity.bossTitle, special) : special;   // BOSS-TRAITS: its first trait's word (systems/bossTraits.js giveBossTraits)
  return entity?.unquiet === true && !entity.wildFoe && !entity.wildGiant && !entity.bout ? `Unquiet ${traited}` : traited;   // UNQUIET: the mark - it may rise (unquietMark.js isUnquiet's own test: AUDIT UNQUIET, never the zone's or the sand's)
}
