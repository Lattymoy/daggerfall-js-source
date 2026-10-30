// @ts-check
// FIXED-PVE STAGE 6 (bible/05-Combat/Fixed-PvE.md section 8): WHOM A FOE FIGHTS. A foe keeps a threat table: damage
// counts whole, healing half (split over the foes in the fight), a hold or a stun a fixed sum, a taunt puts the taunter
// on top. It turns only when a new player passes the old target by a margin - wider at range - so it does not flicker,
// and it never picks one it cannot reach. Threat steers the foe and nothing else: it pays no reward (pveContribution.js
// does). Pure: the authority that hears the blows keeps the table. Ledger A (FIXED-PVE).

/** What each act is worth in threat, per point (damage, healing) or per act (control, special). */
export const THREAT = Object.freeze({ damage: 1, healing: 0.5, control: 30, special: 20 });
/** How far past the current target a challenger must pull: 10% in reach of a blow, 30% from further off. */
export const TURN_MARGIN = Object.freeze({ near: 1.1, far: 1.3, nearMetres: 4 });
/** A taunt's lead over the top, and how long it holds the foe. */
export const TAUNT = Object.freeze({ lead: 1.1, holdS: 4 });
/** Threat fades by this share a second once a player stops acting on the foe, after this grace. */
export const THREAT_FADE = Object.freeze({ perS: 0.1, graceS: 10 });

/** A fresh table. */
export const threatTable = () => ({ /** @type {Map<string, { v: number, at: number }>} */ by: new Map(), target: /** @type {string|null} */ (null), tauntUntil: 0 });

/**
 * Add `amount` of act `kind` by player `id` at time `now` (seconds). Healing is split over `foes` (the foes fighting the
 * one healed); a taunt sets the taunter above the top and holds the foe.
 * @param {ReturnType<typeof threatTable>} t @param {string} id @param {'damage'|'healing'|'control'|'special'|'taunt'} kind
 * @param {number} [amount] @param {{ now?: number, foes?: number }} [o]
 */
export function addThreat(t, id, kind, amount = 1, { now = 0, foes = 1 } = {}) {
  const cur = t.by.get(id)?.v ?? 0;
  if (kind === 'taunt') {
    const top = Math.max(0, ...[...t.by.values()].map((e) => e.v));
    t.by.set(id, { v: Math.max(cur, top * TAUNT.lead + 1), at: now });
    t.target = id; t.tauntUntil = now + TAUNT.holdS;
    return;
  }
  const per = kind === 'damage' || kind === 'healing' ? THREAT[kind] * Math.max(0, amount) : THREAT[kind];
  const v = kind === 'healing' ? per / Math.max(1, foes) : per;
  t.by.set(id, { v: cur + v, at: now });
}

/** Fade every player idle past the grace to `now`. @param {ReturnType<typeof threatTable>} t @param {number} now @param {number} [dt] */
export function fadeThreat(t, now, dt = 1) {
  for (const [id, e] of t.by) {
    if (now - e.at <= THREAT_FADE.graceS) continue;
    e.v *= Math.max(0, 1 - THREAT_FADE.perS * dt);
    if (e.v < 1) { t.by.delete(id); if (t.target === id) t.target = null; }
  }
}

/**
 * The foe's target among `seen` (players it can perceive: id, distance in metres, whether it can reach them): the
 * current one while a taunt holds or nobody passes it by the margin, else the top. Unreachable players are skipped.
 * @param {ReturnType<typeof threatTable>} t @param {Array<{ id: string, dist: number, reachable: boolean }>} seen @param {number} [now]
 */
export function threatTarget(t, seen, now = 0) {
  const ok = seen.filter((p) => p.reachable && t.by.has(p.id));
  if (!ok.length) return (t.target = null);
  const cur = ok.find((p) => p.id === t.target);
  if (cur && now < t.tauntUntil) return cur.id;
  const best = ok.reduce((a, b) => ((t.by.get(b.id)?.v ?? 0) > (t.by.get(a.id)?.v ?? 0) ? b : a));
  if (cur && best.id !== cur.id) {
    const margin = best.dist <= TURN_MARGIN.nearMetres ? TURN_MARGIN.near : TURN_MARGIN.far;
    if ((t.by.get(best.id)?.v ?? 0) < (t.by.get(cur.id)?.v ?? 0) * margin) return cur.id;
  }
  return (t.target = best.id);
}
