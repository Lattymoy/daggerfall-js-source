// FIELD BUGS 2026-10-12g HOLD-KEPT ("Housing items lost in storage": "a lot of lagging and my housing decorations didnt
// load ... the boxes i had put all my legendaries and rares along with some potions was gone, i relogged and checked but
// it stayed empty"). A house's own chest was its record's INDEX in the room's list (`container:<i>`, worldModes.js
// currentSceneState): a placement whose model did not stand (interiorContext.js skips it) moved every chest after it
// down one, the restore laid each record on the next chest along, and the last record - no chest at its index - was
// dropped, and written over at the next save. A chest's record now says which chest it is - its model, and where it
// stands in the building's own frame - and is matched by that; a record written before says its index, as ever, and
// takes a chest no record has named. The host sets down what an unmatched record held. bible/01-Overview/bugs/Field-Bugs-2026-10-12g.md.

/** How far a chest may stand from where its record says and still be that chest (metres, the building's frame). */
export const CHEST_MATCH_REACH = 0.5;

const r2 = (v) => Math.round(v * 100) / 100;

/** A chest's identity for its record: its model and where its placement stands, from `origin` (the building's). */
export function chestIdentity(chest, origin) {
  const m = chest?.matrix;
  return m ? { model: chest.modelIdNum, at: [r2(m[12] - origin[0]), r2(m[13] - origin[1]), r2(m[14] - origin[2])] } : {};
}

/** Each house-chest record (`container:<i>`) of `records` to its chest among `chests` (each `{ modelIdNum, matrix }`):
 *  by what it is and where it stands first, the nearest within CHEST_MATCH_REACH; then a record without either by its
 *  index, onto a chest no record has named. A Map of record -> chest; a record it leaves out has no chest this visit. */
export function matchChests(records, chests, origin) {
  const list = chests ?? [], out = new Map(), taken = new Set();
  const mine = (records ?? []).filter((c) => typeof c?.key === 'string' && c.key.startsWith('container:'));
  const named = (c) => c.model != null && Array.isArray(c.at);
  for (const c of mine) {
    if (!named(c)) continue;
    let best = null, bd = CHEST_MATCH_REACH ** 2;
    for (const t of list) {
      if (taken.has(t) || t.modelIdNum !== c.model || !t.matrix) continue;
      const d = (t.matrix[12] - origin[0] - c.at[0]) ** 2 + (t.matrix[13] - origin[1] - c.at[1]) ** 2 + (t.matrix[14] - origin[2] - c.at[2]) ** 2;
      if (d <= bd) { bd = d; best = t; }
    }
    if (best) { out.set(c, best); taken.add(best); }
  }
  for (const c of mine) {
    if (named(c)) continue;
    const t = list[+c.key.split(':')[1]];
    if (t && !taken.has(t)) { out.set(c, t); taken.add(t); }
  }
  return out;
}
