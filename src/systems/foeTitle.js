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
//   - UNQUIET (bible/06-Systems/Revenants.md section 46): a special foe carrying THE MARK (systems/revenant/unquietMark.js -
//     the one that may rise as a revenant) by "Unquiet" before the rest - "Unquiet Elite Orc", "Unquiet Mighty Orc Warlord".
//
// A LEAF: it imports nothing, so the HUD's leaves can ask it.

/** @param {any} entity @param {string | null | undefined} base the foe's own name (its kind's, or its career's) */
export function foeTitle(entity, base) {
  if (!base) return base;
  if (entity?.wildGiant) base = 'Greater Giant';   // GREATER-GIANT: the zone's own giants (systems/wild/wildZone.js GREATER_GIANT_NAME)
  const revenant = entity?.revenant?.name;
  if (typeof revenant === 'string' && revenant) return revenant;
  const band = entity?.bandName;   // RVN6 (bible/12-Enhanced-AI/Feud-Arc.md 17): a revenant's follower, by its band - "Orc of Grushnak's Warband"
  if (typeof band === 'string' && band) return `${base} of ${band}`;
  const c = entity?.champion;
  const named = typeof c === 'string' && c ? `${c.charAt(0).toUpperCase()}${c.slice(1)} ${base}` : base;
  const special = entity?.staffBoss ? `Mighty ${named}` : entity?.eliteFoe ? `Elite ${named}` : named;   // STAFF-EVENT: a staff event's mini boss (systems/eliteFoes.js promoteStaffBoss)
  return entity?.unquiet === true && !entity.wildFoe && !entity.wildGiant && !entity.bout ? `Unquiet ${special}` : special;   // UNQUIET: the mark - it may rise (unquietMark.js isUnquiet's own test: AUDIT UNQUIET, never the zone's or the sand's)
}
