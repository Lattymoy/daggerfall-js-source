// ONE SQL LITERAL, for the operator's tools whose statements wrangler runs - `wrangler d1 execute` takes no parameters,
// so a value is written into its statement: tools/realmRestore.mjs's restore file, and PURSE-BACK's bindings
// (tools/lib/wranglerBindings.mjs), which bind the account service's own statements this way. Moved here from
// realmRestore.mjs (PURSE-BACK, 2026-10-19), which hands it on.

/** One SQL literal. The tables hold text and whole numbers; anything else is refused rather than guessed at. */
export function lit(/** @type {unknown} */ v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number' && Number.isSafeInteger(v)) return String(v);
  if (typeof v === 'bigint') return String(v);
  if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
  throw new Error(`lit: a value no statement here writes: ${typeof v}`);
}
