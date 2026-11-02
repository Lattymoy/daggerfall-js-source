// THE UI'S SHEETS, READ AS RULES, AND THE CLASSES A MODULE WRITES (HUD-CLASS, AUDIT 2026-10-05). Every module under
// src/ui may inject a sheet into the one game document, so a rule in any of them styles every element that matches
// it: the poise track's bare state 'empty' took the windows' .empty box (POISE-BOX), the status widget's bare 'side'
// the windows' .side column, an empty spell socket and an empty gun battery the .empty box's margin. A pin on that
// reads RULES and WRITES, never source text, so a comment, a word of prose or a JS read like `b.empty` is never taken
// for a selector or a class.
//
// THE SHEETS: every string a UI module exports that reads as CSS, evaluated - the text the game injects, every
// `${}` filled (a selector built from a role list is read as built) - and every string and template literal in the
// modules' source (acorn), for the sheets no module exports. A small walker reads a text as CSS only when the whole
// of it is CSS (every block a declaration list), so markup and code yield nothing. In a literal a template's hole is
// HOLE: glued into a compound it stays part of it (`#${ID}.on` is an id's); standing alone among rules, or before a
// declaration, it is a chunk of rules or of declarations from another literal, read where that one is; a selector
// that is a hole entire is computed, and its sheet must be one the evaluated exports carry.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as acorn from 'acorn';

export const HOLE = '__hole__';
const ROOT = new URL('../', import.meta.url).pathname;
const kids = (n) => Object.keys(n).filter((k) => k !== 'loc').flatMap((k) => (Array.isArray(n[k]) ? n[k] : [n[k]])).filter((v) => v && typeof v.type === 'string');
const isFn = (n) => /Function/.test(n.type);

/** Every string and template literal in a module: [{ text, line }] - a template's holes as HOLE. */
export function literalsOf(ast) {
  const out = [];
  (function walk(n) {
    if (n.type === 'TemplateLiteral') out.push({ text: n.quasis.map((q) => q.value.cooked ?? q.value.raw).join(HOLE), line: n.loc.start.line });
    else if (n.type === 'Literal' && typeof n.value === 'string') out.push({ text: n.value, line: n.loc.start.line });
    for (const c of kids(n)) walk(c);
  })(ast);
  return out;
}

/** `s` split at `sep` outside quotes and brackets. */
function split(s, sep) {
  const out = [];
  let cur = '', depth = 0, q = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { cur += c; if (c === q && s[i - 1] !== '\\') q = null; continue; }
    if (c === '"' || c === "'") q = c;
    else if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === sep && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

const STANDALONE_HOLE = new RegExp(`(^|\\s)(${HOLE})+(?=\\s|$)`, 'g');
const LEADING_HOLES = new RegExp(`^(${HOLE}\\s*)+`);
const DECL = /^(--[\w-]+|-?[a-zA-Z][\w-]*)\s*:/;
/**
 * The CSS rules of a text, [{ sel, body, at }] (`at` the @media/@supports it stands under) - null when the text is not
 * CSS throughout. An at-rule that holds no selectors (@keyframes, @font-face, @property) is passed over whole.
 */
export function rulesOf(text) {
  const s = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const out = [];
  const close = (i) => {   // from just inside a '{': the index just past its '}'
    let d = 1, q = null;
    for (; i < s.length; i++) {
      const c = s[i];
      if (q) { if (c === q && s[i - 1] !== '\\') q = null; continue; }
      if (c === '"' || c === "'") q = c;
      else if (c === '{') d++;
      else if (c === '}' && --d === 0) return i + 1;
    }
    return Infinity;
  };
  const sheet = (from, to, at) => {
    for (let i = from; i < to;) {
      const k = s.indexOf('{', i);
      if (k < 0 || k >= to) return !s.slice(i, to).replaceAll(HOLE, '').trim();
      const raw = s.slice(i, k).replace(/^\s*@(import|charset|namespace)\b[^;]*;/g, '');
      const pre = raw.replace(STANDALONE_HOLE, ' ').trim();
      const end = close(k + 1);
      if (end > to) return false;
      const body = s.slice(k + 1, end - 1);
      if (/^@(media|supports|container|layer|document)\b/.test(pre)) { if (!sheet(k + 1, end - 1, [...at, pre])) return false; }
      else if (!/^@[\w-]+/.test(pre)) {
        if (/[;}]/.test(pre) || (!pre && !raw.includes(HOLE))) return false;
        const decls = split(body, ';').map((d) => d.trim().replace(LEADING_HOLES, '')).filter(Boolean);
        if (!decls.every((d) => DECL.test(d))) return false;
        out.push({ sel: pre || HOLE, body: body.trim(), at });   // a selector a hole entire: computed
      }
      i = end;
    }
    return true;
  };
  return sheet(0, s.length, []) ? out : null;
}

/** A text that LOOKS like a sheet: a selector-ish prelude, then a block that opens on a declaration. */
export const looksLikeCss = (text) => /(^|[\s};])[.#@]?-?[_a-zA-Z][\w-]*[^{};`]*\{\s*(--)?[a-z-]+\s*:\s*[^\s;]/.test(text);

const files = (dir) => readdirSync(join(ROOT, dir)).sort().flatMap((f) => {
  const p = `${dir}/${f}`;
  return statSync(join(ROOT, p)).isDirectory() ? files(p) : p.endsWith('.js') ? [p] : [];
});
const modules = new Map();
/** A module's source and tree, parsed once. */
export function moduleOf(file) {
  if (!modules.has(file)) {
    const src = readFileSync(join(ROOT, file), 'utf8');
    modules.set(file, { file, src, ast: acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true }) });
  }
  return modules.get(file);
}
/** Every module under src/ui - each may inject a sheet into the game's document. */
export const uiModules = () => files('src/ui');
/** Every module under src/ that writes a class into the game's document - src/tools are pages of their own (enhanced.html,
 *  the viewers), never the game's. */
export const classWriters = () => files('src').filter((f) => !f.startsWith('src/tools/') && /classList|className|setAttribute\(\s*['"]class['"]/.test(readFileSync(join(ROOT, f), 'utf8')));

let literalCache = null;
/**
 * The rules in every UI module's string and template literals - the sheets as written, holes kept: [{ where, sel, body,
 * at }]. `unread`: a literal that looks like CSS and does not read; `computed`: the literals with a selector built
 * entire, which only an evaluated sheet shows. Reads source alone - no module is imported.
 */
export function literalSheetRules() {
  if (literalCache) return literalCache;
  const rules = [], unread = [], computed = [];
  for (const file of uiModules()) {
    for (const lit of literalsOf(moduleOf(file).ast)) {
      if (!lit.text.includes('{')) continue;
      const rs = rulesOf(lit.text);
      if (rs == null) { if (looksLikeCss(lit.text)) unread.push(`${file}:${lit.line}`); continue; }
      if (rs.some((r) => r.sel === HOLE)) computed.push({ where: `${file}:${lit.line}`, text: lit.text });
      for (const r of rs) rules.push({ where: `${file}:${lit.line}`, ...r });
    }
  }
  literalCache = { rules, unread, computed };
  return literalCache;
}

let sheetCache = null;
/**
 * Every rule the game's sheets hold: the evaluated exports (every UI module imported), then the literals. `unread` as
 * above; `uncomputed`: a literal with a selector built entire whose text no evaluated export carries, so the rules it
 * builds go unread.
 */
export async function uiSheetRules() {
  if (sheetCache) return sheetCache;
  const rules = [], evaluated = [];
  for (const file of uiModules()) {
    const mod = await import(pathToFileURL(join(ROOT, file)).href);
    for (const [name, v] of Object.entries(mod)) {
      if (typeof v !== 'string' || !v.includes('{')) continue;
      const rs = rulesOf(v);
      if (!rs?.length) continue;
      evaluated.push(v);
      for (const r of rs) rules.push({ where: `${file} ${name}`, ...r });
    }
  }
  const all = evaluated.join('\n');
  const lits = literalSheetRules();
  const uncomputed = lits.computed.filter(({ text }) => {
    const piece = text.split(HOLE).map((x) => x.trim()).sort((a, b) => b.length - a.length)[0];
    return !piece || !all.includes(piece);
  }).map((c) => c.where);
  sheetCache = { rules: [...rules, ...lits.rules], unread: lits.unread, uncomputed, evaluated: evaluated.length };
  return sheetCache;
}

/** A selector's compounds (split at its combinators, outside () and []), each with its pseudo-classes dropped. */
export function compounds(sel) {
  const out = [];
  let cur = '', depth = 0;
  for (const c of sel) {
    if (c === '(' || c === '[') depth++;
    if (c === ')' || c === ']') depth--;
    if (depth === 0 && /[\s>+~]/.test(c)) { if (cur) out.push(cur); cur = ''; continue; }
    cur += c;
  }
  if (cur) out.push(cur);
  return out.map((c) => c.replace(/::?[\w-]+(\((?:[^()]|\([^()]*\))*\))?/g, ''));
}
export const classesOf = (compound) => [...compound.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]);
export const selectorsOf = (rule) => split(rule.sel, ',').map((s) => s.trim()).filter(Boolean);

/**
 * The rules that style an element wearing classes the HUD writes from OUTSIDE the HUD's own rules: the selector's
 * subject wants only classes the HUD writes (`words`); each ancestor could be the page (html, body, :root) or a HUD
 * element (classes the HUD writes, or a bare tag); and no compound names a class the HUD alone writes (`own`) - such a
 * rule is the HUD's, aimed at it. An id narrows a compound to an element that is not the HUD's.
 */
export function collisions(rules, words, own) {
  const out = [];
  for (const r of rules) {
    for (const sel of selectorsOf(r)) {
      const cs = compounds(sel);
      const subj = classesOf(cs[cs.length - 1]);
      if (!subj.length || cs[cs.length - 1].includes('#') || !subj.every((c) => words.has(c))) continue;
      const reach = cs.slice(0, -1).every((c) => {
        if (c.includes('#')) return false;
        if (/^(html|body)\b/.test(c) || c === '' || c === '*' || c.startsWith(':root')) return true;
        return classesOf(c).every((x) => words.has(x));
      });
      if (!reach || cs.some((c) => classesOf(c).some((x) => own.has(x)))) continue;
      out.push(`${r.where} ${r.at.length ? `${r.at.join(' ')} ` : ''}${sel} { ${r.body.replace(/\s+/g, ' ').slice(0, 60)} }`);
    }
  }
  return out;
}

// ── THE CLASSES A MODULE WRITES ──────────────────────────────────────────────────────────────────────────────────

const CAP = 512;
const cross = (a, b) => { const out = []; for (const x of a) for (const y of b) { out.push(x + y); if (out.length >= CAP) return out; } return out; };

/**
 * Every class write in a module - classList.add/remove/toggle/replace, className =, setAttribute('class', ...) and
 * markup's class="" - its strings resolved through the module: literals, conditionals, templates, `+`, a
 * `[...].filter(Boolean).join(' ')`, a const in scope, a for-of over a literal array (or an array of arrays,
 * destructured), a module function's returns, a parameter through every call of its function (so a helper like
 * `el(tag, cls)` is read at its callers), and a callback's parameter through the call its host makes of it
 * (`set('cls', v, (v) => { n.className = v; })`). What cannot be resolved is a hole, named `fn:expression` (the nearest
 * named function round it). Returns { words: Map<word, line[]>, holes: [{ key, line, prefix, bare }] } - a hole glued
 * after a prefix with a '-' in it (poise-${state}, hud-q${slot}) is in the module's own namespace; one without
 * (`${t.kind}`) is BARE, a word the data chooses.
 */
export function classWrites(file) {
  const { src, ast } = moduleOf(file);
  const parent = new Map();
  (function link(n, p) { parent.set(n, p); for (const c of kids(n)) link(c, n); })(ast, null);
  const walk = (n, f, intoFns = true) => { f(n); for (const c of kids(n)) if (intoFns || !isFn(c)) walk(c, f, intoFns); };
  const holes = [];
  const fnOf = (n) => { for (let p = parent.get(n); p; p = parent.get(p)) if (isFn(p)) return p; return null; };
  const nameOf = (f) => { const p = parent.get(f); return f.id?.name ?? (p?.type === 'VariableDeclarator' ? p.id.name : (p?.type === 'Property' || p?.type === 'MethodDefinition') ? p.key.name : null); };
  const fnName = (n) => { for (let f = fnOf(n); f; f = fnOf(f)) { const nm = nameOf(f); if (nm) return nm; } return '<module>'; };
  const hole = (n) => { holes.push({ key: `${fnName(n)}:${src.slice(n.start, n.end)}`, line: n.loc.start.line }); return `\u0000${holes.length - 1}\u0000`; };
  const declOf = (st, name) => {
    const d = st.type === 'ExportNamedDeclaration' ? st.declaration : st;
    if (d?.type === 'FunctionDeclaration' && d.id?.name === name) return { kind: 'fn', fn: d };
    if (d?.type !== 'VariableDeclaration') return null;
    for (const v of d.declarations) {
      if (v.id.type === 'Identifier' && v.id.name === name) return d.kind !== 'const' ? { kind: 'open' } : v.init && isFn(v.init) ? { kind: 'fn', fn: v.init } : { kind: 'const', init: v.init };
      if (v.id.type !== 'Identifier' && new RegExp(`\\b${name}\\b`).test(src.slice(v.id.start, v.id.end))) return { kind: 'open' };
    }
    return null;
  };
  function binding(id) {
    for (let p = parent.get(id); p; p = parent.get(p)) {
      if (isFn(p)) {
        const i = p.params.findIndex((q) => (q.type === 'AssignmentPattern' ? q.left : q).name === id.name);
        if (i >= 0) return { kind: 'param', fn: p, index: i };
      }
      if ((p.type === 'ForOfStatement' || p.type === 'ForInStatement') && p.left.type === 'VariableDeclaration') {
        const v = p.left.declarations[0].id;
        if (p.type === 'ForOfStatement' && v.type === 'Identifier' && v.name === id.name) return { kind: 'of', right: p.right, at: -1 };
        if (p.type === 'ForOfStatement' && v.type === 'ArrayPattern') {
          const at = v.elements.findIndex((x) => x?.type === 'Identifier' && x.name === id.name);
          if (at >= 0) return { kind: 'of', right: p.right, at };
        }
        if (new RegExp(`\\b${id.name}\\b`).test(src.slice(v.start, v.end))) return { kind: 'open' };
      }
      const body = p.type === 'Program' || p.type === 'BlockStatement' ? p.body : p.type === 'SwitchCase' ? p.consequent : null;
      for (const st of body ?? []) { const d = declOf(st, id.name); if (d) return d; }
    }
    return null;
  }
  const callsOf = (fn) => {
    const name = nameOf(fn);
    const calls = [];
    let escapes = false;
    walk(ast, (n) => {
      if (n.type !== 'Identifier' || n.name !== name) return;
      const p = parent.get(n);
      if ((p.type === 'VariableDeclarator' || p.type === 'FunctionDeclaration') && p.id === n) return;
      if ((p.type === 'MemberExpression' && p.property === n && !p.computed) || (p.type === 'Property' && p.key === n && !p.shorthand)) return;
      const b = binding(n);
      if (b?.kind !== 'fn' || b.fn !== fn) return;
      if (p.type === 'CallExpression' && p.callee === n) calls.push(p); else escapes = true;
    });
    return { calls, escapes };
  };
  // a callback's parameter: the host it is handed to calls it - with what the host was itself handed at that call
  const viaHost = (fn, index) => {
    const c = parent.get(fn);
    if (c?.type !== 'CallExpression' || c.callee.type !== 'Identifier') return null;
    const j = c.arguments.indexOf(fn), host = binding(c.callee);
    if (j < 0 || host?.kind !== 'fn') return null;
    const out = [];
    let called = false;
    walk(host.fn.body, (d) => {
      if (d.type !== 'CallExpression' || d.callee.type !== 'Identifier') return;
      const cb = binding(d.callee);
      if (cb?.kind !== 'param' || cb.fn !== host.fn || cb.index !== j) return;
      called = true;
      const a = d.arguments[index];
      const ab = a?.type === 'Identifier' ? binding(a) : null;
      if (ab?.kind === 'param' && ab.fn === host.fn) out.push(...strings(c.arguments[ab.index]));
      else out.push(...strings(a));
    }, false);
    return called ? out : null;
  };
  const returnsOf = (fn) => {
    if (fn.body.type !== 'BlockStatement') return [fn.body];
    const out = [];
    walk(fn.body, (n) => { if (n.type === 'ReturnStatement' && n.argument) out.push(n.argument); }, false);
    return out;
  };
  const busy = new Set();
  function strings(e) {
    if (!e) return [''];
    if (busy.has(e)) return [hole(e)];
    busy.add(e);
    try { return resolve(e).slice(0, CAP); } finally { busy.delete(e); }
  }
  function resolve(e) {
    switch (e.type) {
      case 'Literal': return [e.value == null || e.value === false ? '' : String(e.value)];
      case 'TemplateLiteral': {
        let acc = [e.quasis[0].value.cooked];
        e.expressions.forEach((x, i) => { acc = cross(cross(acc, strings(x)), [e.quasis[i + 1].value.cooked]); });
        return acc;
      }
      case 'ConditionalExpression': return [...strings(e.consequent), ...strings(e.alternate)];
      case 'LogicalExpression': return e.operator === '&&' ? ['', ...strings(e.right)] : [...strings(e.left), ...strings(e.right)];
      case 'BinaryExpression': return e.operator === '+' ? cross(strings(e.left), strings(e.right)) : [hole(e)];
      case 'Identifier': {
        const b = binding(e);
        if (b?.kind === 'const') return strings(b.init);
        if (b?.kind === 'of' && b.right.type === 'ArrayExpression') {
          return b.right.elements.flatMap((x) => (b.at < 0 ? strings(x) : x?.type === 'ArrayExpression' ? strings(x.elements[b.at]) : [hole(e)]));
        }
        if (b?.kind === 'param') {
          if (!nameOf(b.fn)) return viaHost(b.fn, b.index) ?? [hole(e)];
          const { calls, escapes } = callsOf(b.fn);
          const out = calls.flatMap((c) => strings(c.arguments[b.index]));
          return escapes || !calls.length ? [...out, hole(e)] : out;
        }
        return [hole(e)];
      }
      case 'CallExpression': {
        const m = e.callee.type === 'MemberExpression' ? e.callee.property.name : null;
        if (m === 'join' && e.arguments.length === 1 && e.arguments[0].type === 'Literal') {
          let arr = e.callee.object;
          if (arr.type === 'CallExpression' && arr.callee.type === 'MemberExpression' && arr.callee.property.name === 'filter') arr = arr.callee.object;
          if (arr.type === 'ArrayExpression') return arr.elements.reduce((acc, x, i) => cross(cross(acc, [i ? e.arguments[0].value : '']), strings(x)), ['']);
        }
        if (e.callee.type === 'Identifier') { const b = binding(e.callee); if (b?.kind === 'fn') return returnsOf(b.fn).flatMap((r) => strings(r)); }
        return [hole(e)];
      }
      default: return [hole(e)];
    }
  }
  const writes = [];
  walk(ast, (n) => {
    if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression') {
      const m = n.callee.property.name, on = n.callee.object;
      if (on.type === 'MemberExpression' && on.property.name === 'classList') {
        if (m === 'add' || m === 'remove' || m === 'replace') writes.push(...n.arguments);
        if (m === 'toggle' && n.arguments[0]) writes.push(n.arguments[0]);
      }
      if (m === 'setAttribute' && n.arguments[0]?.value === 'class' && n.arguments[1]) writes.push(n.arguments[1]);
    }
    if (n.type === 'AssignmentExpression' && n.left.type === 'MemberExpression' && n.left.property.name === 'className') writes.push(n.right);
  });
  const words = new Map();
  const found = [];
  const take = (text, line, markup = false) => {
    for (const w of text.split(/\s+/).filter(Boolean)) {
      const at = w.indexOf('\u0000');
      if (at < 0) { if (!words.has(w)) words.set(w, []); words.get(w).push(line); continue; }
      // a hole in markup has no expression to name: its literal's line names it
      const h = markup ? { key: `markup:${line}`, line } : holes[Number(w.slice(at + 1, w.indexOf('\u0000', at + 1)))];
      found.push({ ...h, prefix: w.slice(0, at) });
    }
  };
  for (const e of writes) for (const s of strings(e)) take(s, e.loc.start.line);
  for (const lit of literalsOf(ast)) for (const m of lit.text.matchAll(/\bclass="([^"]*)"/g)) take(m[1].replaceAll(HOLE, '\u0000'), lit.line, true);
  const uniq = new Map();
  for (const h of found) {
    const bare = !h.prefix.includes('-');
    if (!uniq.has(h.key) || (bare && !uniq.get(h.key).bare)) uniq.set(h.key, { key: h.key, line: h.line, prefix: h.prefix, bare });
  }
  return { words, holes: [...uniq.values()] };
}

/**
 * The strings a module mints for a property (`kind: 'buff'`, `chips: [...].filter(Boolean)`) in its object literals,
 * or in one function's (`within`) - the values of a class word the HUD fills from that producer's data. Throws on a
 * value it cannot read: a producer that passes its data through is not a closed list.
 */
export function mintedFor(file, prop, { within = null } = {}) {
  const { src, ast } = moduleOf(file);
  const out = new Set();
  let scope = within ? null : ast;
  (function find(n) {
    if (scope) return;
    if (isFn(n) && n.id?.name === within) scope = n;
    else if (n.type === 'VariableDeclarator' && n.id.name === within && n.init && isFn(n.init)) scope = n.init;
    else for (const c of kids(n)) find(c);
  })(ast);
  if (!scope) throw new Error(`${file}: no function ${within}`);
  (function walk(n) {
    if (n.type === 'Property' && (n.key.name ?? n.key.value) === prop && !isFn(n.value)) {
      const arr = n.value.type === 'ArrayExpression' ? n.value : n.value.type === 'CallExpression' && n.value.callee.object?.type === 'ArrayExpression' ? n.value.callee.object : null;
      for (const v of arr ? arr.elements : [n.value]) {
        (function lit(x) {
          if (x.type === 'Literal') { if (x.value != null && x.value !== '') out.add(String(x.value)); }
          else if (x.type === 'ConditionalExpression') { lit(x.consequent); lit(x.alternate); }
          else throw new Error(`${file}:${x.loc.start.line} ${prop}: ${src.slice(x.start, x.end)} is not a literal`);
        })(v);
      }
    }
    for (const c of kids(n)) walk(c);
  })(scope);
  return [...out].sort();
}
