// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WD3 - A TOWN'S HOMES IN ONE LAYOUT (bible/03-World/Beautiful-Towns.md).
//
// A building key names a building only in one layout of its town, so a
// town that holds homes keeps the layout its oldest home was bought in,
// and every row written there - a home's claim (homes.js) and a guild's
// hall (halls.js) alike - is written in it, or refused.
//
// AUDIT PRE-MERGE 1003 WD1: a hall is a row of `homes` too, and was
// written with no layout (NULL, Daggerfall's own): bought in a Villages
// town it told every client to stand the town classic. So the SQL the
// claim writes with lives here, for both: homes.js reads halls.js (a
// hall's heraldry, on its door), and the hall could not read it back
// from homes.js without a cycle.
// ═══════════════════════════════════════════════════════════════════
import { HOME_LAYOUT_MODS, homeLayoutOk, homeLayoutsMatch } from '../../src/net/homeLaw.js';

// WD3 (AUDIT WD3 R5): a town's homes in ONE layout, in the write itself - the claim's mods each in a home of the town
// or not, as homeLayoutsMatch reads them (versions aside), so two first claims in two layouts at once seat one
export const LAYOUT_MATCH_SQL = HOME_LAYOUT_MODS.map(() => `(instr(COALESCE(t.layout, ''), ?) > 0) = ?`).join(' AND ');
export const layoutMatchBinds = (layout) => {
  const mods = new Set(typeof layout === 'string' && layout ? layout.split('+').map((p) => p.split('@')[0]) : []);
  return HOME_LAYOUT_MODS.flatMap((m) => [`${m}@`, mods.has(m) ? 1 : 0]);
};
/** The layout a new row of the town is written with: its oldest home's stamp - a town of no homes, the row's own. Binds
 *  `mapId, mapId, layout`. */
export const TOWN_LAYOUT_SQL = 'COALESCE((SELECT t.layout FROM homes t WHERE t.map_id = ? ORDER BY t.bought_at, t.building_key LIMIT 1), CASE WHEN EXISTS (SELECT 1 FROM homes t WHERE t.map_id = ?) THEN NULL ELSE ? END)';

/** WD3 (AUDIT WD3 O1): a row in another layout of a town that holds homes is refused - `{ error: 'home-layout',
 *  layout }`, the layout the town keeps for the client to hear - or null. */
export async function townLayoutRefusal(db, mapId, layout) {
  const town = await db.prepare('SELECT layout FROM homes WHERE map_id = ? ORDER BY bought_at, building_key LIMIT 1').bind(mapId).first();
  return town && !homeLayoutsMatch(town.layout, layout) ? { error: 'home-layout', layout: homeLayoutOk(town.layout) ? town.layout ?? null : null } : null;
}
