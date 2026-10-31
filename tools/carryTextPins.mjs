// CARRY TEXT PINS (LEGIBLE 3, bible/01-Overview/Readability-Arc.md): a test that reads source as text quotes it - a
// string it looks for, a regular expression it matches - and a formatter that moves the code's layout leaves the quote
// behind. This carries those quotes through a change already made in the working tree: a literal that found the code
// before (`git show HEAD:<file>`) and finds nothing now is rewritten to the same code's new text, mapped token by token.
//   node tools/carryTextPins.mjs <changed source ...> --tests <test ...> [--write]
// A string becomes the new text; a regex becomes it escaped, a line break and its indent read as `\n\s*` - and a regex
// a const names (a sweep's, read over files the change may not have reached) matches either text. A regex with a
// capture group is carried only where assert.match or assert.doesNotMatch takes it. What cannot be mapped is named.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tokenizer, parse } from 'acorn';
import { isMain } from './lib/isMain.mjs';

/** A source's tokens and comments in order, each with its span and a key that ignores how it is spelled. */
function tokensOf(source) {
  const comments = [];
  const options = { ecmaVersion: 'latest', allowHashBang: true, onComment: comments };
  let list;
  try {
    list = [...tokenizer(source, { ...options, sourceType: 'module' })];
  } catch {
    comments.length = 0;
    list = [...tokenizer(source, { ...options, sourceType: 'script' })];
  }
  const out = list.map((t) => ({
    key: `${t.type.label}:${t.type.label === 'regexp' ? `${t.value.pattern}/${t.value.flags}` : String(t.value ?? '')}`,
    start: t.start,
    end: t.end,
  }));
  for (const c of comments)
    out.push({ key: `comment:${c.value.replace(/\s+/g, ' ').trim()}`, start: c.start, end: c.end });
  return out.sort((a, b) => a.start - b.start);
}

const OPTIONAL = new Set([';:', ',:', '(:', '):']);
const REACH = 64;

/** Old offsets to new ones, by the tokens the two versions share: `at(o, 'start')` for a span's start, `'end'` for its end. */
export function offsetMap(oldSource, newSource) {
  const a = tokensOf(oldSource),
    b = tokensOf(newSource);
  const matched = new Array(a.length).fill(-1);
  let i = 0,
    j = 0;
  while (i < a.length && j < b.length) {
    if (a[i].key === b[j].key) {
      matched[i++] = j++;
      continue;
    }
    if (OPTIONAL.has(a[i].key)) {
      i++;
      continue;
    }
    if (OPTIONAL.has(b[j].key)) {
      j++;
      continue;
    }
    let found = false;
    for (let r = 1; r <= REACH && !found; r++) {
      if (i + r < a.length && a[i + r].key === b[j].key) {
        i += r;
        found = true;
      } else if (j + r < b.length && a[i].key === b[j + r].key) {
        j += r;
        found = true;
      }
    }
    if (!found) {
      i++;
      j++;
    }
  }
  const same = (k) => oldSource.slice(a[k].start, a[k].end) === newSource.slice(b[matched[k]].start, b[matched[k]].end);
  return (o, side) => {
    for (let k = 0; k < a.length; k++) {
      if (side === 'start' && a[k].end > o) {
        if (matched[k] < 0) return null;
        return a[k].start < o ? (same(k) ? b[matched[k]].start + (o - a[k].start) : null) : b[matched[k]].start;
      }
      if (side === 'end' && a[k].end >= o) {
        if (a[k].start < o && a[k].end > o)
          return matched[k] >= 0 && same(k) ? b[matched[k]].start + (o - a[k].start) : null;
        if (a[k].end === o) return matched[k] >= 0 ? b[matched[k]].end : null;
        const p = k - 1;
        return p >= 0 && matched[p] >= 0 ? b[matched[p]].end : null;
      }
    }
    return side === 'end' && a.length && matched[a.length - 1] >= 0 ? b[matched[a.length - 1]].end : null;
  };
}

const escapeRegex = (s) => s.replace(/[\\^$.*+?()[\]{}|/]/g, '\\$&').replace(/\n[ \t]*/g, '\\n\\s*');
const quoteAs = (q, s) =>
  `${q}${s.replace(/\\/g, '\\\\').replace(new RegExp(q, 'g'), `\\${q}`).replace(/\n/g, '\\n')}${q}`;
const hasCapture = (pattern) => /(^|[^\\])\((?!\?)/.test(pattern.replace(/\[(?:\\.|[^\]])*\]/g, '[]'));

/** A regex's longest run of literal characters (an escaped punctuation mark counts as one), or null under six. */
export function literalRun(pattern) {
  const runs = [];
  let cur = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '\\') {
      const e = pattern[++i];
      if (e !== undefined && /[^A-Za-z0-9]/.test(e)) cur += e;
      else {
        runs.push(cur);
        cur = '';
      }
    } else if ('^$.|()[]{}'.includes(c)) {
      runs.push(cur);
      cur = '';
      if (c === '[') {
        while (i < pattern.length && pattern[i] !== ']') i += pattern[i] === '\\' ? 2 : 1;
      }
    } else if ('*+?'.includes(c)) {
      runs.push(cur.slice(0, -1));
      cur = '';
    } else cur += c;
  }
  runs.push(cur);
  const best = runs.reduce((a, b) => (b.length > a.length ? b : a), '');
  return best.length >= 6 ? best : null;
}

/** The literals of a test that the change left behind, each with its carried spelling (or why it has none). */
export function carriedIn(testSource, sources) {
  const ast = parse(testSource, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true });
  const asserted = new Set();
  const maps = new Map();
  const named = new Set();
  const out = [];
  const walk = (n, parent) => {
    if (!n || typeof n.type !== 'string') return;
    if (
      n.type === 'CallExpression' &&
      n.callee.type === 'MemberExpression' &&
      /^(match|doesNotMatch)$/.test(n.callee.property.name ?? '') &&
      n.callee.object.name === 'assert' &&
      n.arguments[1]?.regex
    )
      asserted.add(n.arguments[1]);
    if (n.type === 'VariableDeclarator' && n.init?.regex) named.add(n.init);
    if (n.type === 'Literal' && (typeof n.value === 'string' || n.regex)) out.push(n);
    if (n.type === 'TemplateLiteral' && n.expressions.length === 0) out.push(n);
    for (const k of Object.keys(n)) {
      const v = n[k];
      if (Array.isArray(v)) v.forEach((c) => walk(c, n));
      else if (v && typeof v.type === 'string') walk(v, n);
    }
  };
  walk(ast, null);
  const found = [];
  for (const lit of out) {
    const regex = lit.regex
      ? (() => {
          try {
            return new RegExp(lit.regex.pattern, lit.regex.flags.replace('g', ''));
          } catch {
            return null;
          }
        })()
      : null;
    const text = lit.type === 'TemplateLiteral' ? lit.quasis[0].value.cooked : lit.value;
    if (!regex && (typeof text !== 'string' || text.length < 12)) continue;
    // a regex is tried only on a text that holds its longest literal run - a pin's pattern over a file it was never
    // written for can backtrack for an hour
    const frag = regex ? literalRun(lit.regex.pattern) : null;
    const hit = (s) =>
      regex
        ? frag && !s.includes(frag)
          ? null
          : regex.exec(s)
        : s.includes(text)
          ? { index: s.indexOf(text), 0: text }
          : null;
    const before = sources.map((s) => ({ s, m: hit(s.old) })).find((x) => x.m);
    if (!before || sources.some((s) => hit(s.new))) continue;
    if (!maps.has(before.s)) maps.set(before.s, offsetMap(before.s.old, before.s.new));
    const map = maps.get(before.s);
    const from = map(before.m.index, 'start'),
      to = map(before.m.index + before.m[0].length, 'end');
    const raw = testSource.slice(lit.start, lit.end);
    if (from == null || to == null || to < from) {
      found.push({ start: lit.start, end: lit.end, raw, why: 'its code found no place in the new text' });
      continue;
    }
    const now = before.s.new.slice(from, to);
    if (regex && hasCapture(lit.regex.pattern) && !asserted.has(lit)) {
      found.push({ start: lit.start, end: lit.end, raw, why: 'a capture group read outside an assertion' });
      continue;
    }
    const spelled = regex
      ? `/${named.has(lit) ? `(?:${lit.regex.pattern}|${escapeRegex(now)})` : escapeRegex(now)}/${lit.regex.flags}`
      : lit.type === 'TemplateLiteral'
        ? `\`${now.replace(/[`\\]|\$\{/g, '\\$&')}\``
        : quoteAs(raw[0], now);
    found.push({ start: lit.start, end: lit.end, raw, spelled });
  }
  return found;
}

/** Each test's literals carried: the new test text, and what was left. */
export function carryTests(tests, changed, read = (f) => readFileSync(f, 'utf8')) {
  const sources = changed.map((f) => ({
    file: f,
    old: execFileSync('git', ['show', `HEAD:${f}`], { encoding: 'utf8', maxBuffer: 1 << 28 }),
    new: read(f),
  }));
  const results = [];
  for (const t of tests) {
    const src = read(t);
    let found;
    try {
      found = carriedIn(src, sources);
    } catch (e) {
      results.push({ test: t, error: e.message });
      continue;
    }
    let text = src;
    for (const f of [...found].sort((x, y) => y.start - x.start))
      if (f.spelled) text = text.slice(0, f.start) + f.spelled + text.slice(f.end);
    results.push({
      test: t,
      text,
      carried: found.filter((f) => f.spelled).length,
      left: found.filter((f) => !f.spelled),
    });
  }
  return results;
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const at = args.indexOf('--tests');
  const changed = args.slice(0, at).filter((a) => !a.startsWith('--'));
  const tests = args.slice(at + 1).filter((a) => !a.startsWith('--'));
  let carried = 0,
    left = 0;
  for (const r of carryTests(tests, changed)) {
    if (r.error) {
      console.log(`ERROR ${r.test}: ${r.error}`);
      left++;
      continue;
    }
    carried += r.carried;
    for (const l of r.left) {
      console.log(`LEFT  ${r.test}: ${l.why} - ${l.raw.slice(0, 100)}`);
      left++;
    }
    if (args.includes('--write') && r.carried) writeFileSync(r.test, r.text);
  }
  console.log(`${carried} text pin(s) carried, ${left} not`);
}
