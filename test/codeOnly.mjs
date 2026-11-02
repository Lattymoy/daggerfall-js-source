// A SOURCE PIN READS CODE, NEVER PROSE (AUDIT 28e). The records lane reverted five pinned lines and kept each old text
// as a trailing comment - `currentLocationMapId: () => (_musicLoc)... // currentLocationMapId: () => travelOriginMapId(),`
// - and every text pin on them stayed green: the hazard bible/09-Testing/Testing-Rows-2026-10-19.md records ("A VACUOUS PIN CAUGHT ITSELF").
// This is test/systems/rest/restwhere.test.js's walk made shared: `//` and `/* */` comments blanked, strings kept whole. It knows
// nothing of regex literals, so it is for a SLICE - a function, a block, a small file - never a whole host file, where
// one `/'/` could put the walk out of step. Pins then ask for their line exactly once in what is left.
import assert from 'node:assert/strict';

export function codeOnly(s) {
  let out = '';
  let i = 0;
  while (i < s.length) {
    const two = s.slice(i, i + 2);
    const c = s[i];
    if (two === '//') { const nl = s.indexOf('\n', i); i = nl < 0 ? s.length : nl; continue; }
    if (two === '/*') { const e = s.indexOf('*/', i); i = e < 0 ? s.length : e + 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; out += c; i++;
      while (i < s.length && s[i] !== q) { if (s[i] === '\\') { out += s[i]; i++; } out += s[i]; i++; }
      out += s[i] ?? ''; i++; continue;
    }
    out += c; i++;
  }
  return out;
}

/** `re` (global) matches the CODE of `src` exactly once. */
export function codeHasOnce(src, re, message) {
  const g = re.flags.includes('g') ? re : new RegExp(re.source, `${re.flags}g`);
  assert.equal((codeOnly(src).match(g) || []).length, 1, message ?? `${re} once, in code`);
}
