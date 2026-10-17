// @ts-check
// TRADE1's CANON, a leaf: stable JSON (sorted keys), so two records that mean the same thing compare equal whatever key
// order a client wrote. net/tradeSession.js compares a commit with the offer it locked by it; REALM P2.1 moved it here
// so the account Worker, which settles a realm trade by the same comparison (net/realm/realmTradeLaw.js), bundles this
// function and not the client's whole trade machine.

/** Stable JSON (sorted keys) so two records that mean the same thing compare equal whatever key order a client wrote. */
export function canon(/** @type {any} */ v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
}
