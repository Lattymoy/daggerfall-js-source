// mergeMain - the mechanical half of merging main into a long branch (AUDIT RELEASE R3, bible/01-Overview/audits/
// Audit-Release-R3.md "Merging main"). A branch that carries an unpublished relay row and account version meets main's
// own at every merge: the version line, every pin that asserts it, and the plain-English history each pin keeps. The
// rule is the one every merge of this repository has applied by hand (test/net/relayversion.test.js, "A version bump is
// ..."): the branch's release takes the next number past main's newest, its own history clause first, main's whole
// history after it - never a deployed row relabelled. This tool applies that rule to the conflict hunks it recognises and
// leaves every other hunk for a person.
//
//   node tools/mergeMain.mjs              # report: each conflicted file, the hunks it would resolve, the rest
//   node tools/mergeMain.mjs --apply      # resolve the version hunks and the import-only hunks in place
//   node tools/mergeMain.mjs --sweep --apply   # after the conflicts: move every pin still naming either side's old version (without --apply: list them)
//   node tools/mergeMain.mjs --locales --apply   # once the source resolves: the catalog re-read, each language merged
//
// Run it on the conflicted working tree of `git merge origin/main`, before resolving anything else by hand.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMain } from './lib/isMain.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---- the pure half (pinned in test/tooling/mergemain.test.js) -------------------------------------------------------

/** The two version kinds: the relay's (`world<N>`) and the account service's (`acct<N>`). */
export const KINDS = Object.freeze({ relay: 'world', account: 'acct' });

/** The versions a merge renumbers: a kind the branch bumped (its version past the merge base's) that main reached or
 *  passed. A kind the branch never bumped keeps main's number and pins - swept, they named a version no service has.
 *  @param {Record<string, { base: number, ours: number, theirs: number }>} v */
export const renumbered = (v) => Object.keys(v).filter((k) => v[k].ours > v[k].base && v[k].ours <= v[k].theirs);

/** Split a file's text into plain runs and conflict hunks (`<<<<<<<` / optional `|||||||` base / `=======` / `>>>>>>>`). */
export function hunksOf(text) {
  const parts = [];
  let plain = [], h = null, mode = 0;
  for (const l of text.split('\n')) {
    if (!mode && l.startsWith('<<<<<<< ')) { parts.push(plain); plain = []; h = { ours: [], base: [], theirs: [], head: l }; mode = 1; continue; }
    if (mode === 1 && l.startsWith('||||||| ')) { mode = 2; continue; }
    if ((mode === 1 || mode === 2) && l === '=======') { mode = 3; continue; }
    if (mode === 3 && l.startsWith('>>>>>>> ')) { h.tail = l; parts.push(h); h = null; mode = 0; continue; }
    if (mode === 1) h.ours.push(l); else if (mode === 2) h.base.push(l); else if (mode === 3) h.theirs.push(l); else plain.push(l);
  }
  if (mode) throw new Error('an unterminated conflict hunk');
  parts.push(plain);
  return parts;
}

/** Back to text: plain runs as they are, a hunk as its resolution (`lines`) or, unresolved, as it was. */
export function joinHunks(parts) {
  const out = [];
  for (const p of parts) {
    if (Array.isArray(p)) out.push(...p);
    else if (p.lines) out.push(...p.lines);
    else out.push(p.head, ...p.ours, ...(p.base.length ? ['||||||| base', ...p.base] : []), '=======', ...p.theirs, p.tail);
  }
  return out.join('\n');
}

/** The newest version a text names (`world265`), as a number - null for none. */
export function newestIn(text, prefix) {
  let best = null;
  for (const m of String(text).matchAll(new RegExp(`\\b${prefix}(\\d+)\\b`, 'g'))) best = Math.max(best ?? 0, Number(m[1]));
  return best;
}

/** The version a pin line asserts or matches (`'world260'`, `"acct189"`, `= 'acct189'`) - null for none. */
export function assertedIn(line, prefix) {
  const m = new RegExp(`(?:VERSION\\s*(?:,|=)\\s*\\\\?["'\`]|['"]|\\/\\^)${prefix}(\\d+)["'\\\\$]`).exec(line);   // a regex literal too (`/^acct193$/` - the trial's prof pins)
  return m ? Number(m[1]) : null;
}

/** The branch's own clause of a pin's history - the text after `PIN MOVED: <v>, ` up to the next `; PIN MOVED: ` (or the
 *  string's or the comment's end). */
export function ownClause(line, prefix, v) {
  const at = line.indexOf(`PIN MOVED: ${prefix}${v}, `);
  if (at < 0) return null;
  const rest = line.slice(at + `PIN MOVED: ${prefix}${v}, `.length);
  const next = rest.search(new RegExp(`;\\s*PIN MOVED: ${prefix}\\d+`));
  const end = next >= 0 ? next : rest.search(/'\);|'\)\s*;|\s*$/);
  return rest.slice(0, end >= 0 ? end : rest.length).replace(/\.$/, '');
}

/** The note a renumbered clause carries: where it stood and what it passed. */
export const renumberNote = (prefix, was, theirs) => `${prefix}${was} on its branch, renumbered past ${was === theirs ? `${prefix}${was}` : `${prefix}${was}-${prefix}${theirs}`} on main at the merge`;

/**
 * ONE PIN LINE, merged: main's line (its whole history) with its asserted version moved to `next` and the branch's own
 * clause, renumbered, first in its history. Null where the pair is not a version pin of `prefix` both sides.
 */
export function mergePinLine(ours, theirs, prefix, next) {
  const was = assertedIn(ours, prefix) ?? newestIn(ours.match(/PIN MOVED: \w+/)?.[0] ?? '', prefix);
  const mine = assertedIn(theirs, prefix) ?? newestIn(theirs.match(/PIN MOVED: \w+/)?.[0] ?? '', prefix);
  if (was == null || mine == null || ours === theirs) return null;   // one number both sides is a renumber too, when main took the branch's own (the second merge: world268 both)
  let line = theirs.replace(new RegExp(`(["'\\\\^])${prefix}${mine}(["'\\\\$])`), `$1${prefix}${next}$2`);
  const clause = ownClause(ours, prefix, was);
  const tag = `PIN MOVED: ${prefix}${mine}, `;
  if (clause && line.includes(tag)) {
    const noted = /\(/.test(clause) ? clause.replace('(', `(${renumberNote(prefix, was, mine)}; `) : `${clause} (${renumberNote(prefix, was, mine)})`;
    line = line.replace(tag, `PIN MOVED: ${prefix}${next}, ${noted}; ${tag}`);
  } else if (clause) {
    line = `${line}   // PIN MOVED: ${prefix}${next}, ${clause} (${renumberNote(prefix, was, mine)})`;
  }
  return line;
}

/** A hunk of pin lines: each ours line paired with the theirs line at its index; lines equal both sides kept. Null when
 *  the hunk is not wholly version pins of `prefix` (and lines both sides share). */
export function mergePinHunk(h, prefix, next) {
  if (h.ours.length !== h.theirs.length) return null;
  const out = [];
  let moved = 0;
  for (let i = 0; i < h.ours.length; i++) {
    if (h.ours[i] === h.theirs[i]) { out.push(h.ours[i]); continue; }
    const m = mergePinLine(h.ours[i], h.theirs[i], prefix, next);
    if (m == null) return null;
    out.push(m);
    moved++;
  }
  return moved ? out : null;
}

const DECL = {
  world: /^export const RELAY_VERSION = 'world(\d+)';\s+\/\/ world\d+: (.*)$/,
  acct: /^export const ACCOUNT_VERSION = 'acct(\d+)';\s+\/\/ acct\d+: (.*)$/,
};
const TOML = /^ACCOUNT_VERSION = "acct(\d+)"$/;

/**
 * THE VERSION LINE ITSELF (src/net/wire.js RELAY_VERSION, server-account/src/service.js ACCOUNT_VERSION and its
 * wrangler.toml twin): the branch's line renumbered to `next`, its own notes after it (their `(<v>,` moved), main's line
 * as a comment and main's notes after that; a note both sides carry kept once, in main's place.
 */
export function mergeVersionHunk(h, prefix, next) {
  if (prefix === KINDS.account && h.ours.length === 1 && h.theirs.length === 1 && TOML.test(h.ours[0]) && TOML.test(h.theirs[0])) return [`ACCOUNT_VERSION = "acct${next}"`];
  const re = DECL[prefix];
  const o = re.exec(h.ours[0] ?? ''), t = re.exec(h.theirs[0] ?? '');
  if (!o || !t) return null;
  const was = Number(o[1]), mine = Number(t[1]);
  const decl = h.ours[0].slice(0, h.ours[0].indexOf(`'${prefix}${was}'`));
  const theirsRest = h.theirs.slice(1);
  const oursRest = h.ours.slice(1).filter((l) => !theirsRest.includes(l)).map((l) => l.split(`(${prefix}${was},`).join(`(${prefix}${next},`));
  return [
    `${decl}'${prefix}${next}';   // ${prefix}${next}: ${o[2].replace(/^/, `(${renumberNote(prefix, was, mine)}) `)}`,
    ...oursRest,
    `// ${prefix}${mine}: ${t[2]}`,
    ...theirsRest,
  ];
}

/** A hunk whose two sides are one-line imports, each module's names unioned (main's order, the branch's extras after) and
 *  each line's note kept (the branch's, then main's where they differ). Null for anything else. */
export function mergeImportHunk(h) {
  const RE = /^import \{ ([^}]*) \} from '([^']+)';(?:\s+\/\/ (.*))?$/;
  const parse = (lines) => lines.map((l) => { const m = RE.exec(l); return m && { names: m[1].split(',').map((s) => s.trim()).filter(Boolean), mod: m[2], note: m[3] ?? '' }; });
  const o = parse(h.ours), t = parse(h.theirs);
  if (!o.length || !t.length || o.includes(null) || t.includes(null)) return null;
  const mods = [...t.map((x) => x.mod), ...o.map((x) => x.mod).filter((m) => !t.some((x) => x.mod === m))];
  return mods.map((mod) => {
    const a = o.find((x) => x.mod === mod), b = t.find((x) => x.mod === mod);
    const names = [...(b?.names ?? [])];
    for (const n of a?.names ?? []) if (!names.includes(n)) names.push(n);
    const note = a && b && a.note !== b.note ? (b.note.startsWith(a.note) ? b.note : a.note.startsWith(b.note) ? a.note : [a.note, b.note].filter(Boolean).join('; ')) : (a?.note || b?.note || '');   // a note one side only lengthened is that side's
    return `import { ${names.join(', ')} } from '${mod}';${note ? `   // ${note}` : ''}`;
  });
}

/**
 * A LINE NUMBER BOTH SIDES MOVED (`Port-Ledger.md:859` on one side, `:864` on the other, `:854` in the base): the hunk's
 * three sides are the same text but for their numbers, each moved by the rows its side wrote above the line it names -
 * and the merged doc keeps both sides' rows (union), so the merged number is ours + theirs - base. Null unless every
 * side is the same text with only numbers changed (needs the diff3 base: `git checkout --conflict=diff3 -- <file>`).
 */
export function mergeNumbersHunk(h) {
  if (!h.base.length || h.ours.length !== h.base.length || h.theirs.length !== h.base.length) return null;
  const SPLIT = /(\d+)/;
  const out = [];
  for (let i = 0; i < h.base.length; i++) {
    const b = h.base[i].split(SPLIT), o = h.ours[i].split(SPLIT), t = h.theirs[i].split(SPLIT);
    if (b.length !== o.length || b.length !== t.length) return null;
    const line = [];
    for (let k = 0; k < b.length; k++) {
      if (k % 2 === 0) { if (b[k] !== o[k] || b[k] !== t[k]) return null; line.push(b[k]); continue; }
      line.push(String(Number(o[k]) + Number(t[k]) - Number(b[k])));
    }
    out.push(line.join(''));
  }
  return out;
}

/** A pin left outside the conflicts that still asserts an old version - either side's - moved to `next`, with a clause. */
export function sweepLine(line, prefix, olds, next, clause) {
  const v = assertedIn(line, prefix);
  if (v == null || !olds.includes(v)) return line;
  let out = line.replace(new RegExp(`(["'\\\\^])${prefix}${v}(["'\\\\$])`), `$1${prefix}${next}$2`);
  const tag = /PIN MOVED: \w+\d+, /.exec(out)?.[0];
  out = tag ? out.replace(tag, `PIN MOVED: ${prefix}${next}, ${clause}; ${tag}`) : `${out}   // PIN MOVED: ${prefix}${next}, ${clause}`;
  return out;
}

/**
 * A KEYED TABLE, merged three ways (a language's Port_Strings rows, its meta's records): a key either side added is
 * kept, a key one side deleted and the other left as the base had it is gone, a value one side changed is that side's,
 * and where both changed one key differently main's stands (reported in `clashes`). Values compared as JSON.
 * @param {Map<string, any>} base @param {Map<string, any>} ours @param {Map<string, any>} theirs
 */
export function mergeTable(base, ours, theirs) {
  const out = new Map(), clashes = [];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  for (const key of new Set([...ours.keys(), ...theirs.keys(), ...base.keys()])) {
    const b = base.get(key), o = ours.get(key), t = theirs.get(key);
    const inB = base.has(key), inO = ours.has(key), inT = theirs.has(key);
    if (!inO && !inT) continue;
    if (inB && (!inO || !inT)) { const kept = inO ? o : t; if (same(kept, b)) continue; out.set(key, kept); clashes.push(key); continue; }
    if (!inO) { out.set(key, t); continue; }
    if (!inT) { out.set(key, o); continue; }
    if (same(o, t) || same(t, b)) out.set(key, o);
    else { out.set(key, t); if (!same(o, b)) clashes.push(key); }
  }
  return { table: out, clashes };
}

// ---- the tree half ---------------------------------------------------------------------------------------------------

/** THE LANGUAGES (`--locales`): the English catalog read again off the merged source (tools/l10nExtract.mjs), then each
 *  other language's rows and meta merged three ways from the index's stages, in the catalog's order, keys it no longer
 *  holds dropped - what tools/l10nInSession.mjs writes. Run after every source conflict is resolved. */
async function mergeLocales(apply) {
  const { parseStringTableCsv, formatStringTableCsv } = await import('../src/systems/textManager.js');
  const stage = (n, p) => { try { return git('show', `:${n}:${p}`); } catch { return null; } };
  const conflicted = git('diff', '--name-only', '--diff-filter=U').split('\n').filter((p) => /^locales\/[^/]+\/Port_Strings\.(csv|meta\.json)$/.test(p));
  if (conflicted.includes('locales/en/Port_Strings.csv') && apply) execFileSync(process.execPath, ['tools/l10nExtract.mjs'], { cwd: ROOT, stdio: 'inherit' });
  const en = parseStringTableCsv(readFileSync(join(ROOT, 'locales/en/Port_Strings.csv'), 'utf8')).map(([k]) => k);
  for (const p of conflicted) {
    if (p === 'locales/en/Port_Strings.csv') continue;
    const csv = p.endsWith('.csv');
    const read = (n) => { const t = stage(n, p); if (t == null) return new Map(); return csv ? new Map(parseStringTableCsv(t)) : new Map(Object.entries(JSON.parse(t))); };
    const { table, clashes } = mergeTable(read(1), read(2), read(3));
    const ordered = en.filter((k) => table.has(k)).map((k) => [k, table.get(k)]);
    console.log(`${p}: ${ordered.length} rows (${table.size - ordered.length} not in the catalog dropped)${clashes.length ? `, main's kept over a change both made: ${clashes.join(', ')}` : ''}`);
    if (apply) writeFileSync(join(ROOT, p), csv ? formatStringTableCsv(ordered) : `${JSON.stringify(Object.fromEntries(ordered), null, 1)}\n`);
  }
}


const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });

function nextVersions() {
  const wire = git('show', 'MERGE_HEAD:src/net/wire.js'), acct = git('show', 'MERGE_HEAD:server-account/src/service.js');
  const ourWire = git('show', 'HEAD:src/net/wire.js'), ourAcct = git('show', 'HEAD:server-account/src/service.js');
  const base = git('merge-base', 'HEAD', 'MERGE_HEAD').trim();
  const baseWire = git('show', `${base}:src/net/wire.js`), baseAcct = git('show', `${base}:server-account/src/service.js`);
  const at = (text, re) => Number(re.exec(text)[1]);
  const W = /RELAY_VERSION = 'world(\d+)'/, A = /ACCOUNT_VERSION = 'acct(\d+)'/;
  return {
    world: { base: at(baseWire, W), theirs: at(wire, W), ours: at(ourWire, W) },
    acct: { base: at(baseAcct, A), theirs: at(acct, A), ours: at(ourAcct, A) },
  };
}

async function main() {
  const apply = process.argv.includes('--apply'), sweep = process.argv.includes('--sweep');
  if (process.argv.includes('--locales')) return mergeLocales(apply);
  const v = nextVersions();
  const next = { world: v.world.theirs + 1, acct: v.acct.theirs + 1 };
  const moves = renumbered(v);   // AUDIT FB1029g: a kind the branch never bumped is main's as it stands
  if (moves.includes('world')) console.log(`relay: world${v.world.ours} (ours) -> world${next.world} (past main's world${v.world.theirs})`);
  if (moves.includes('acct')) console.log(`account: acct${v.acct.ours} (ours) -> acct${next.acct} (past main's acct${v.acct.theirs})`);
  if (sweep) {
    let n = 0;
    for (const f of git('ls-files', 'test').split('\n').filter((p) => p.endsWith('.js') || p.endsWith('.mjs'))) {
      const text = readFileSync(join(ROOT, f), 'utf8');
      const lines = text.split('\n');
      const out = lines.map((l) => {
        let m = l;
        for (const k of moves) m = sweepLine(m, k, [v[k].ours, v[k].theirs], next[k], `the merge of main (${renumberNote(k, v[k].ours, v[k].theirs)})`);
        return m;
      });
      const moved = out.filter((l, i) => l !== lines[i]).length;
      if (moved) { n += moved; console.log(`  swept ${f}: ${moved}`); if (apply) writeFileSync(join(ROOT, f), out.join('\n')); }
    }
    console.log(`${n} pins ${apply ? 'moved' : 'to move'}`);
    return;
  }
  let left = 0;
  for (const f of git('diff', '--name-only', '--diff-filter=U').split('\n').filter(Boolean)) {
    const parts = hunksOf(readFileSync(join(ROOT, f), 'utf8'));
    let done = 0, all = 0;
    for (const p of parts) {
      if (Array.isArray(p)) continue;
      all++;
      const version = (k) => (moves.includes(k) ? mergeVersionHunk(p, k, next[k]) ?? mergePinHunk(p, k, next[k]) : null);
      p.lines = version('world') ?? version('acct') ?? mergeImportHunk(p) ?? mergeNumbersHunk(p) ?? undefined;
      if (p.lines) done++;
    }
    left += all - done;
    console.log(`${f}: ${done}/${all} hunks mechanical`);
    if (apply && done) writeFileSync(join(ROOT, f), joinHunks(parts));
  }
  console.log(`${left} hunks left for a person`);
}

if (isMain(import.meta.url)) await main();
