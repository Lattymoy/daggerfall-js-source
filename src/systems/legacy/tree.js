// @ts-check
// LEGACY3 (bible/06-Systems/Legacy-Arc.md section 11): THE TREE'S LAYOUT - Project Legacy's `FamilyLegacyWindow`
// (`ConstructTreeFromCharacterData`, `DrawFamilyTree`, `DrawRootSiblings`) as a pure function of the record.
//
// The mod built the layout into Unity panels while it walked the record, from a `static FamilyNode root` (U5: a second
// window shared the first's tree) and a sibling-placement loop that guessed widths off the sprite sheet. Here the
// layout is computed whole and handed to the window: every generation a row, a couple side by side on a married
// branch (the mod's S_MARRIED_LEFT/RIGHT; an "Unknown" partner is never invented - the port draws only who is
// recorded), their children hung beneath the couple's midpoint (S_OFFSPRING_DOWN), siblings joined by a bar
// (S_CONNECTOR_SIBLING_*), and the founder's own generation's other roots beside them (`DrawRootSiblings`).
//
// Units are slots: one slot per person; a couple is two. `x` is the slot's left edge in slots, `y` the generation.

/**
 * @param {{ people: Array<{ id:number, gen:number, parents:number[], children:number[], spouse:number|null, kind:string }> }} family
 * @returns {{ nodes: Array<{ id:number, x:number, y:number }>, couples: Array<{ a:number, b:number }>,
 *   families: Array<{ parents:number[], children:number[] }>, width:number, depth:number }}
 */
export function layoutTree(family) {
  const people = family?.people ?? [];
  const byId = new Map(people.map((p) => [p.id, p]));
  const isMember = (p) => (p?.kind ?? 'member') === 'member';
  /** AUDIT LEGACY III A14/U4: EVERY SPOUSE A MEMBER HAS HAD stands in their unit - the one wed now, and each before (a
   *  spouse who died, a union the realm ended): the unit read the member's current spouse alone, so a member wed twice
   *  had the first marriage's children hung under the second spouse, and the first spouse cut off at the row's far end
   *  (a player's character a root of its own). One wed in by their link to the member, or as the other parent of a
   *  child of theirs; another member only by both their links. Oldest wedding first. */
  const spouseMemo = new Map();
  const spousesOf = (p) => {
    if (spouseMemo.has(p.id)) return spouseMemo.get(p.id);
    const out = new Set();
    for (const q of people) if (q.id !== p.id && q.spouse === p.id && (!isMember(q) || p.spouse === q.id)) out.add(q);
    if (p.spouse != null && byId.has(p.spouse)) out.add(byId.get(p.spouse));
    for (const id of p.children ?? []) {
      for (const pid of byId.get(id)?.parents ?? []) { const q = byId.get(pid); if (q && q.id !== p.id && !isMember(q)) out.add(q); }
    }
    const list = [...out].sort((a, b) => (Number(a.wedAt) || 0) - (Number(b.wedAt) || 0) || a.id - b.id);
    spouseMemo.set(p.id, list);
    return list;
  };
  const placed = new Map();   // id -> { x, y }
  const nodes = [];
  const couples = [];
  const families = [];
  /** The children that hang under p's unit: those whose FIRST parent is p (a child of two members hangs once). */
  const kidsOf = (p) => [...new Set(p.children ?? [])].map((id) => byId.get(id)).filter((c) => c && (c.parents ?? [])[0] === p.id).sort((a, b) => a.id - b.id);
  const widthMemo = new Map();
  /** Slots the unit rooted at p needs: its own (the member and each spouse), or its children's sum, whichever is wider. */
  function width(p, seen = new Set()) {
    if (widthMemo.has(p.id)) return widthMemo.get(p.id);
    if (seen.has(p.id)) return 1;
    seen.add(p.id);
    const own = 1 + spousesOf(p).length;
    const sum = kidsOf(p).reduce((n, c) => n + width(c, seen), 0);
    const w = Math.max(own, sum);
    widthMemo.set(p.id, w);
    return w;
  }
  function place(p, x0) {
    if (placed.has(p.id)) return 0;
    const ss = spousesOf(p).filter((s) => !placed.has(s.id));
    const w = width(p);
    const own = 1 + ss.length;
    const left = x0 + (w - own) / 2;
    // the earlier spouses on the left, the member, the last wed on the right - each couple's line its own
    let at = left;
    for (const q of [...ss.slice(0, -1), p, ...ss.slice(-1)]) { placed.set(q.id, { x: at, y: p.gen }); nodes.push({ id: q.id, x: at, y: p.gen }); at += 1; }
    for (const q of ss) couples.push({ a: p.id, b: q.id });
    // each child under the couple its own parents name - every marriage's children beneath it, in the weddings' order
    const kids = kidsOf(p).filter((c) => !placed.has(c.id));
    const order = [...spousesOf(p).map((q) => q.id), null];
    const groups = new Map(order.map((k) => [k, []]));
    for (const c of kids) {
      const other = (c.parents ?? []).find((id) => id !== p.id) ?? null;
      if (!groups.has(other)) groups.set(other, []);
      groups.get(other).push(c);
    }
    let cx = x0;
    for (const [other, list] of groups) {
      if (!list.length) continue;
      for (const c of list) { place(c, cx); cx += width(c); }
      families.push({ parents: other != null ? [p.id, other] : [p.id], children: list.map((c) => c.id) });
    }
    return w;
  }
  // the roots: members with no recorded parent - one wed in hangs beside their spouse's plate (never a root of their
  // own), the founder's line first. AUDIT LEGACY II F14: a dead `&& false` clause dropped
  const roots = people.filter((p) => !(p.parents ?? []).length && isMember(p))
    .sort((a, b) => a.gen - b.gen || a.id - b.id);
  let x = 0;
  for (const r of roots) { if (placed.has(r.id)) continue; x += place(r, x); }
  // anyone the walk missed (a child whose parent is gone from the record) - kept, at the right, never dropped
  for (const p of people) if (!placed.has(p.id)) { placed.set(p.id, { x, y: p.gen }); nodes.push({ id: p.id, x, y: p.gen }); x += 1; }
  const depth = nodes.reduce((m, n) => Math.max(m, n.y), 0) + 1;
  return { nodes, couples, families, width: Math.max(1, x), depth };
}
