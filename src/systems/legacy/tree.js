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
  /** The unit a person stands in: themself, and a spouse beside them (a member's spouse who married in). */
  const spouseOf = (p) => (p?.spouse != null && byId.has(p.spouse) ? byId.get(p.spouse) : null);
  const placed = new Map();   // id -> { x, y }
  const nodes = [];
  const couples = [];
  const families = [];
  const childrenOfUnit = (p, s) => {
    const ids = new Set([...(p.children ?? []), ...(s?.children ?? [])]);
    return [...ids].map((id) => byId.get(id)).filter((c) => c && !placed.has(c.id) && (c.parents ?? []).includes(p.id)).sort((a, b) => a.id - b.id);
  };
  const widthMemo = new Map();
  /** Slots the unit rooted at p needs: its own (1 or 2), or its children's sum, whichever is wider. */
  function width(p, seen = new Set()) {
    if (widthMemo.has(p.id)) return widthMemo.get(p.id);
    if (seen.has(p.id)) return 1;
    seen.add(p.id);
    const s = spouseOf(p);
    const own = s ? 2 : 1;
    const kids = [...new Set([...(p.children ?? []), ...(s?.children ?? [])])].map((id) => byId.get(id)).filter((c) => c && (c.parents ?? [])[0] === p.id);
    const sum = kids.reduce((n, c) => n + width(c, seen), 0);
    const w = Math.max(own, sum);
    widthMemo.set(p.id, w);
    return w;
  }
  function place(p, x0) {
    if (placed.has(p.id)) return 0;
    const s = spouseOf(p);
    const w = width(p);
    const own = s && !placed.has(s.id) ? 2 : 1;
    const left = x0 + (w - own) / 2;
    placed.set(p.id, { x: left, y: p.gen });
    nodes.push({ id: p.id, x: left, y: p.gen });
    if (own === 2) {
      placed.set(s.id, { x: left + 1, y: p.gen });
      nodes.push({ id: s.id, x: left + 1, y: p.gen });
      couples.push({ a: p.id, b: s.id });
    }
    // children: only those whose FIRST parent is p hang under p's unit (a child of two members hangs once)
    const kids = childrenOfUnit(p, s).filter((c) => (c.parents ?? [])[0] === p.id);
    let cx = x0;
    for (const c of kids) { place(c, cx); cx += width(c); }
    if (kids.length) families.push({ parents: own === 2 ? [p.id, s.id] : [p.id], children: kids.map((c) => c.id) });
    return w;
  }
  // the roots: members with no recorded parent who are not a spouse who married in, the founder's line first
  const roots = people.filter((p) => !(p.parents ?? []).length && p.kind !== 'resident' && !people.some((o) => o.spouse === p.id && o.id < p.id && o.kind === 'member' && !(o.parents ?? []).length && false))
    .sort((a, b) => a.gen - b.gen || a.id - b.id);
  let x = 0;
  for (const r of roots) { if (placed.has(r.id)) continue; x += place(r, x); }
  // anyone the walk missed (a child whose parent is gone from the record) - kept, at the right, never dropped
  for (const p of people) if (!placed.has(p.id)) { placed.set(p.id, { x, y: p.gen }); nodes.push({ id: p.id, x, y: p.gen }); x += 1; }
  const depth = nodes.reduce((m, n) => Math.max(m, n.y), 0) + 1;
  return { nodes, couples, families, width: Math.max(1, x), depth };
}
