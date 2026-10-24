// THE HOST MOVE - a group of a host function's members moved, verbatim, into a module of its own (HOST-SPLIT,
// bible/01-Overview/Host-Split.md, MOVE, DON'T REWRITE).
//
//   node tools/hostMove.mjs src/scenes/world.js --group tvBadgeOf,TV_PEER_HEAD_M,travelViewMarks \
//        --to src/scenes/travelViewMarks.js --name createTravelViewMarks            the plan, nothing written
//   ... --write                                                                      the move
//
// A move by hand of a block that reads sixty names of its host's scope is where a silent change hides - a `let` read
// as a copy goes stale, a `const` read before its line throws. This decides every name by rule, so each move is the
// same move and its review is a review of the rules, once:
//
//   - the group is CONTIGUOUS members of the host function, so its code runs at the very point in the host's
//     sequence it ran before - the host constructs the module where the group stood;
//   - a host name the group reads is handed over BY VALUE (destructured once, at construction) when its value cannot
//     change and is already made there: a `const`, `class` or never-written `let` declared above the group, a
//     function declaration (hoisted), a never-written parameter;
//   - every other host name is handed over LIVE - a getter (and a setter when the group writes it) on the handles,
//     and the group's every use of it reads `host.<name>`: a `let` someone writes, a `const` declared below the group
//     (read at the use, as before - never touched in its temporal dead zone);
//   - a name the group's own code declares (a parameter, an inner `const`) shadows the host's and is left alone -
//     resolved by scope, not by spelling;
//   - module-scope names come along as imports from the host's own import lines; a host-module top-level declaration
//     the group reads is refused (move it to a shared module first);
//   - the names the group declares that the rest of the host uses are returned, and the host destructures them where
//     the group stood. One the host uses ABOVE the group is reported - read it; a function declaration was hoisted.
//
// What it cannot see, it refuses; what it moved it prints. Read the diff.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, relative, basename } from 'node:path';
import { parse } from 'acorn';
import { isMain } from './lib/isMain.mjs';
import { parseModule, findHostFunction, scopeOf } from './hostScope.mjs';

/** The names a pattern binds. */
function bound(p, out = []) {
  if (!p) return out;
  if (p.type === 'Identifier') out.push(p.name);
  else if (p.type === 'ObjectPattern') for (const q of p.properties) bound(q.type === 'RestElement' ? q.argument : q.value, out);
  else if (p.type === 'ArrayPattern') for (const q of p.elements) bound(q, out);
  else if (p.type === 'RestElement') bound(p.argument, out);
  else if (p.type === 'AssignmentPattern') bound(p.left, out);
  return out;
}

const isFn = (n) => n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression';
const childKeys = (n) => Object.keys(n).filter((k) => k !== 'loc' && k !== 'start' && k !== 'end' && k !== 'type');

/** Every identifier a subtree names - references and bindings alike, never a non-computed key. */
function namesIn(roots) {
  const out = new Set();
  const walk = (n, parent, key) => {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'Identifier') {
      const isKey = (parent?.type === 'MemberExpression' && key === 'property' && !parent.computed)
        || ((parent?.type === 'Property' || parent?.type === 'MethodDefinition' || parent?.type === 'PropertyDefinition') && key === 'key' && !parent.computed && !parent.shorthand);
      if (!isKey) out.add(n.name);
      return;
    }
    for (const k of childKeys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach((c) => walk(c, n, k)); else walk(v, n, k); }
  };
  for (const r of roots) walk(r, null, null);
  return out;
}

/** Whether a function's own body reads `this` (an arrow inside it reads the same `this`; a nested function does not). */
function readsThis(fnNode) {
  let found = false;
  const walk = (n) => {
    if (!n || typeof n.type !== 'string' || found) return;
    if (n.type === 'ThisExpression') { found = true; return; }
    if (n !== fnNode && (n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression')) return;
    for (const k of childKeys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else walk(v); }
  };
  walk(fnNode);
  return found;
}

/** Names a block (or function body / program) declares directly: let/const/class at block level; var and function
 *  declarations hoisted to the nearest function - over-approximated here as the block that holds them, which only
 *  ever shadows MORE, so a host reference is never wrongly left as a local one by it... except a `var` declared in an
 *  inner block and read outside it; such a group is refused below. */
function blockDecls(stmts) {
  const out = new Set();
  for (const s of stmts) {
    if (s.type === 'VariableDeclaration') for (const d of s.declarations) for (const n of bound(d.id)) out.add(n);
    else if ((s.type === 'FunctionDeclaration' || s.type === 'ClassDeclaration') && s.id) out.add(s.id.name);
  }
  return out;
}

/** Every host-scope reference in `roots`: [{ node, name, parent, key }] - identifiers that resolve to no declaration
 *  inside the group, by scope. `own` are the group's own top-level names (resolved in the module, left alone). */
function hostRefs(roots, own) {
  const refs = [];
  let varInBlock = false, keyedNext = false;
  const walk = (n, parent, key, scopes) => {
    if (n.type === 'Identifier') {
      const isKey = (parent?.type === 'MemberExpression' && key === 'property' && !parent.computed)
        || ((parent?.type === 'Property' || parent?.type === 'MethodDefinition' || parent?.type === 'PropertyDefinition') && key === 'key' && !parent.computed)
        || (parent?.type === 'LabeledStatement' || parent?.type === 'BreakStatement' || parent?.type === 'ContinueStatement');
      if (isKey) return;
      if (own.has(n.name) || scopes.some((s) => s.has(n.name))) return;
      refs.push({ node: n, name: n.name, parent, key, keyed: keyedNext });
      keyedNext = false;
      return;
    }
    if (n.type === 'MetaProperty') return;   // new.target, import.meta - no binding
    if (n.type === 'Property' && n.shorthand && n.value?.type === 'AssignmentPattern' && n.value.left.type === 'Identifier') {
      keyedNext = true;   // the default's own target, next: it keeps its key when rewritten
      walk(n.value.left, n.value, 'left', scopes);
      keyedNext = false;
      walk(n.value.right, n.value, 'right', scopes);
      return;
    }
    let inner = scopes;
    if (isFn(n)) {
      const ps = new Set(n.params.flatMap((p) => bound(p)));
      if (n.id && n.type === 'FunctionExpression') ps.add(n.id.name);
      const pscopes = [...scopes, ps];
      // the parameters' defaults in the parameters' scope; the body in its own, inside it. The declaration's own id
      // is the outer scope's.
      for (const p of n.params) walkPattern(p, pscopes);
      walk(n.body, n, 'body', [...pscopes, n.body.type === 'BlockStatement' ? blockDecls(n.body.body) : new Set()]);
      return;
    }
    if (n.type === 'BlockStatement' || n.type === 'Program' || n.type === 'StaticBlock') inner = [...scopes, blockDecls(n.body)];
    if (n.type === 'SwitchStatement') inner = [...scopes, blockDecls(n.cases.flatMap((c) => c.consequent))];
    if (n.type === 'ForStatement' || n.type === 'ForInStatement' || n.type === 'ForOfStatement') {
      const head = n.type === 'ForStatement' ? n.init : n.left;
      if (head?.type === 'VariableDeclaration') inner = [...scopes, new Set(head.declarations.flatMap((d) => bound(d.id)))];
    }
    if (n.type === 'CatchClause' && n.param) inner = [...scopes, new Set(bound(n.param))];
    if (n.type === 'ClassExpression' && n.id) inner = [...scopes, new Set([n.id.name])];
    if (n.type === 'VariableDeclaration' && n.kind === 'var' && parent && !isFn(parent) && parent.type !== 'Program') varInBlock = true;
    if (n.type === 'VariableDeclarator') { walkPattern(n.id, inner); if (n.init) walk(n.init, n, 'init', inner); return; }
    for (const k of childKeys(n)) {
      const v = n[k];
      if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === 'string') walk(c, n, k, inner); }
      else if (v && typeof v.type === 'string') walk(v, n, k, inner);
    }
  };
  // a binding pattern's own names are declarations, not references - but its defaults and computed keys are reads
  const walkPattern = (p, scopes) => {
    if (!p) return;
    if (p.type === 'AssignmentPattern') { walkPattern(p.left, scopes); walk(p.right, p, 'right', scopes); }
    else if (p.type === 'ObjectPattern') for (const q of p.properties) { if (q.type === 'RestElement') walkPattern(q.argument, scopes); else { if (q.computed) walk(q.key, q, 'key', scopes); walkPattern(q.value, scopes); } }
    else if (p.type === 'ArrayPattern') for (const q of p.elements) walkPattern(q, scopes);
    else if (p.type === 'RestElement') walkPattern(p.argument, scopes);
    else if (p.type === 'MemberExpression') walk(p, null, null, scopes);   // an assignment target, `a.b = ...`
  };
  for (const r of roots) {
    if (r.type === 'VariableDeclaration') for (const d of r.declarations) { walkPattern(d.id, []); if (d.init) walk(d.init, d, 'init', []); }
    else if (r.type === 'FunctionDeclaration') walk({ ...r, type: 'FunctionExpression', id: null }, null, null, []);
    else walk(r, null, null, []);
  }
  return { refs, varInBlock };
}

/** The plan for moving `names` out of `hostFile`'s host function into `toFile` as `createName`. */
export function planMove({ hostFile, fn, names, toFile, ctor, handle = 'host' }) {
  const src = readFileSync(hostFile, 'utf8');
  // parseModule's options, with the comments kept - the doc block above the group moves with it
  const comments = [];
  const ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true, allowHashBang: true, onComment: comments });
  const host = findHostFunction(ast, fn);
  if (!host) throw new Error(`no host function${fn ? ` ${fn}` : ''} in ${hostFile}`);
  const { members, owner } = scopeOf(host);
  const refuse = [];

  // THE GROUP: contiguous members
  const group = [...new Set(names.map((n) => { const m = owner.get(n); if (!m) refuse.push(`${n} is not a member of ${host.name}`); return m; }).filter(Boolean))].sort((a, b) => a.i - b.i);
  if (refuse.length) return { refuse };
  for (let k = 1; k < group.length; k++) if (group[k].i !== group[k - 1].i + 1) refuse.push(`the group is not contiguous: ${group[k - 1].names[0]} and ${group[k].names[0]} have members between them`);
  const first = group[0], last = group[group.length - 1];
  const own = new Set(group.flatMap((m) => m.names));
  for (const m of group) if (m.isLet) refuse.push(`${m.names.join(', ')}: a group-declared let would need a live export - move its writers with it`);

  // every host-scope name: where declared, how
  const params = host.fn.params.flatMap((p) => bound(p));
  const declAt = new Map();   // name -> { m, kind }
  for (const m of members) {
    const s = m.stmt;
    const kind = s.type === 'VariableDeclaration' ? s.kind : s.type === 'FunctionDeclaration' ? 'function' : s.type === 'ClassDeclaration' ? 'class' : null;
    for (const n of m.names) declAt.set(n, { m, kind });
  }
  const writtenAnywhere = new Set();
  for (const m of members) {
    for (const n of m.wrote) writtenAnywhere.add(n);
    // a `let x;` declared bare and first given a value by assignment is written; its own initializer is not a write
  }

  // the module scope: imports, and top-level declarations
  const imports = new Map();   // local -> { source, imported, kind }
  const topLevel = new Set();
  for (const s of ast.body) {
    if (s.type === 'ImportDeclaration') for (const sp of s.specifiers) imports.set(sp.local.name, { source: s.source.value, imported: sp.type === 'ImportSpecifier' ? (sp.imported.name ?? sp.imported.value) : sp.type === 'ImportDefaultSpecifier' ? 'default' : '*' });
    const d = s.type === 'ExportNamedDeclaration' ? s.declaration : s.type === 'ExportDefaultDeclaration' ? s.declaration : s;
    if (!d) continue;
    if (d.type === 'VariableDeclaration') for (const x of d.declarations) for (const n of bound(x.id)) topLevel.add(n);
    else if ((d.type === 'FunctionDeclaration' || d.type === 'ClassDeclaration') && d.id) topLevel.add(d.id.name);
  }

  const { refs, varInBlock } = hostRefs(group.map((m) => m.stmt), own);
  if (varInBlock) refuse.push('the group declares a `var` inside a block - its scope is the function, and this tool resolves by block; move it by hand');
  if (namesIn(group.map((m) => m.stmt)).has(handle) || own.has(handle)) refuse.push(`the group already uses the name \`${handle}\` (a reference or an inner binding would capture the rewrite) - pass --handle`);

  const byValue = new Set(), live = new Set(), writes = new Set(), mod = new Map(), stray = new Set();
  for (const r of refs) {
    const n = r.name;
    if (declAt.has(n) || params.includes(n)) {
      const d = declAt.get(n);
      const neverWritten = !writtenAnywhere.has(n);
      const above = d && d.m.i < first.i;
      const settled = d
        ? (d.kind === 'function' && neverWritten) || (above && (d.kind === 'const' || (d.kind === 'class' && neverWritten) || ((d.kind === 'let' || d.kind === 'var') && neverWritten && d.m.stmt.declarations?.every((x) => x.init))))
        : neverWritten;   // a parameter
      (settled ? byValue : live).add(n);
    } else if (imports.has(n)) mod.set(n, imports.get(n));
    else if (topLevel.has(n)) stray.add(n);
    // anything else is a global (Math, window, performance...) - left as it is
  }
  // what the group assigns of the host's (by spelling - a local of the same name only makes a name live that need not be)
  for (const m of group) for (const n of m.wrote) if (!own.has(n) && (declAt.has(n) || params.includes(n)) && refs.some((r) => r.name === n)) writes.add(n);
  for (const n of writes) { byValue.delete(n); live.add(n); }
  for (const n of stray) refuse.push(`${n} is a top-level declaration of ${hostFile} - move it to a module both can import first`);
  for (const n of live) {
    if (!refs.some((r) => r.name === n && r.parent?.type === 'CallExpression' && r.key === 'callee')) continue;
    const d = declAt.get(n);
    const fnNode = d?.kind === 'function' ? d.m.stmt : d?.m.stmt.declarations?.find((x) => x.id.type === 'Identifier' && x.id.name === n)?.init;
    if (fnNode && fnNode.type !== 'ArrowFunctionExpression' && isFn(fnNode) && readsThis(fnNode)) refuse.push(`${n} is called live, and \`${handle}.${n}()\` would make \`this\` the handles object - its function reads \`this\`; move it by hand`);
  }

  // what the rest of the host uses of the group, and whether any of it is used above the group
  const exported = new Set(), above = [];
  for (const m of members) {
    if (group.includes(m)) continue;
    for (const n of m.read) if (own.has(n)) { exported.add(n); if (m.i < first.i) above.push(`${n} (used by ${m.names[0] ?? `<${m.stmt.type}>`}, above the group)`); }
  }
  for (const m of members) if (!group.includes(m)) for (const n of m.wrote) if (own.has(n)) refuse.push(`${n} is assigned outside the group`);

  // the text: the group's span, with its doc comment above
  let start = first.stmt.start;
  const lineStart = (pos) => src.lastIndexOf('\n', pos - 1) + 1;
  start = lineStart(start);
  for (let k = comments.length - 1; k >= 0; k--) {
    const c = comments[k];
    if (c.end > start) continue;
    // FIELD BUGS 2026-10-14 (PARTY-LOOT's move): a comment that ENDS a code line above is that line's, never the group's
    // doc - taken as one, its line (a host `let` above the group) went into the module and out of the host
    if (src.slice(lineStart(c.start), c.start).trim()) break;
    const between = src.slice(c.end, start);
    if (/^[ \t]*\n?[ \t]*$/.test(between) && !/\n\s*\n/.test(between)) start = lineStart(c.start); else break;
  }
  const end = src.indexOf('\n', last.stmt.end) + 1 || src.length;

  return { refuse, src, host, group, first, last, start, end, refs, byValue, live, writes, mod, exported, above, handle, hostFile, toFile, ctor };
}

export function renderMove(p) {
  const { src, start, end, refs, byValue, live, writes, mod, exported, handle, hostFile, toFile, ctor, host } = p;
  // the module: the group's text, every live reference read through the handle
  const edits = refs.filter((r) => live.has(r.name)).map((r) => {
    const shorthand = (r.parent?.type === 'Property' && r.parent.shorthand && r.key === 'value') || r.keyed;
    return { from: r.node.start, to: r.node.end, text: shorthand ? `${r.name}: ${handle}.${r.name}` : `${handle}.${r.name}` };
  }).sort((a, b) => b.from - a.from);
  let body = src.slice(start, end);
  for (const e of edits) body = body.slice(0, e.from - start) + e.text + body.slice(e.to - start);

  const rel = (spec) => {
    if (!spec.startsWith('.')) return spec;
    const abs = new URL(spec, `file://${process.cwd()}/${hostFile}`).pathname;
    let r = relative(dirname(`${process.cwd()}/${toFile}`), abs);
    if (!r.startsWith('.')) r = `./${r}`;
    return r;
  };
  const bySource = new Map();
  for (const [local, { source, imported }] of [...mod].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (!bySource.has(source)) bySource.set(source, []);
    bySource.get(source).push(imported === 'default' ? { def: local } : imported === '*' ? { ns: local } : imported === local ? local : `${imported} as ${local}`);
  }
  const importLines = [...bySource].map(([source, list]) => {
    const def = list.find((x) => x.def)?.def, ns = list.find((x) => x.ns)?.ns, named = list.filter((x) => typeof x === 'string');
    const parts = [def, ns ? `* as ${ns}` : null, named.length ? `{ ${named.join(', ')} }` : null].filter(Boolean);
    return `import ${parts.join(', ')} from '${rel(source)}';`;
  });
  const sortedValue = [...byValue].sort();
  const sortedLive = [...live].sort();
  const ret = [...exported].sort();
  const wrap = (items, indent, width = 118) => {
    const lines = []; let cur = '';
    for (const it of items) { if (cur && (indent + cur + it).length + 2 > width) { lines.push(cur.trimEnd()); cur = ''; } cur += `${it}, `; }
    if (cur) lines.push(cur.replace(/, $/, ''));
    return lines.map((l) => indent + l).join('\n');
  };
  const moduleText = `${[
    `// HOST-SPLIT: moved verbatim out of ${hostFile}'s ${host.name} (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.`,
    `// The host constructs it where the code stood. What it reads of the host's scope comes through \`${handle}\`: the`,
    '// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its',
    `// use as \`${handle}.<name>\` - as the code read them where it was.`,
    ...importLines,
    '',
    `/** @param {any} ${handle} */`,
    `export function ${ctor}(${handle}) {`,
    sortedValue.length ? `  const {\n${wrap(sortedValue, '    ')}\n  } = ${handle};` : null,
    body.replace(/\n$/, ''),
    ret.length ? `  return { ${ret.join(', ')} };` : null,
    '}',
  ].filter((x) => x !== null).join('\n')}\n`;

  // the host: the group's span replaced by the construction
  const getters = sortedLive.map((n) => `get ${n}() { return ${n}; },${writes.has(n) ? ` set ${n}(v) { ${n} = v; },` : ''}`);
  const construction = [
    `  ${ret.length ? `const { ${ret.join(', ')} } = ` : ''}${ctor}({   // HOST-SPLIT: ${toFile}`,
    sortedValue.length ? `${wrap(sortedValue, '    ')},` : null,
    ...getters.map((g) => `    ${g}`),
    '  });',
  ].filter((x) => x !== null).join('\n');
  let hostText = src.slice(0, start) + construction + '\n' + src.slice(end);
  // the import of the constructor, after the host's last import
  const lastImport = [...hostText.matchAll(/^import [^;]+;[^\n]*\n/gm)].pop();
  const spec = `./${relative(dirname(hostFile), toFile).replace(/\\/g, '/')}`;
  const line = `import { ${ctor} } from '${spec.startsWith('./..') ? spec.slice(2) : spec}';   // HOST-SPLIT\n`;
  const at = lastImport ? lastImport.index + lastImport[0].length : 0;
  hostText = hostText.slice(0, at) + line + hostText.slice(at);
  return { moduleText, hostText, importLines, construction };
}

/** Imports of the host that nothing in the host reads any more - after a move, the ones the group took with it. */
export function unusedImports(hostText, candidates) {
  const ast = parseModule(hostText);
  const used = new Set();
  const walk = (n, parent, key) => {
    if (n.type === 'ImportDeclaration') return;
    if (n.type === 'Identifier') {
      const isKey = (parent?.type === 'MemberExpression' && key === 'property' && !parent.computed)
        || ((parent?.type === 'Property' || parent?.type === 'MethodDefinition' || parent?.type === 'PropertyDefinition') && key === 'key' && !parent.computed);
      if (!isKey) used.add(n.name);
      return;
    }
    for (const k of childKeys(n)) {
      const v = n[k];
      if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === 'string') walk(c, n, k); }
      else if (v && typeof v.type === 'string') walk(v, n, k);
    }
  };
  walk(ast, null, null);
  return [...candidates].filter((n) => !used.has(n));
}

/** The host's import lines with `names` taken out (a line left empty goes). */
export function dropImports(hostText, names) {
  if (!names.length) return hostText;
  const ast = parseModule(hostText);
  const edits = [];
  for (const s of ast.body) {
    if (s.type !== 'ImportDeclaration') continue;
    const keep = s.specifiers.filter((sp) => !names.includes(sp.local.name));
    if (keep.length === s.specifiers.length) continue;
    if (!keep.length) {
      const lineStart = hostText.lastIndexOf('\n', s.start - 1) + 1, lineEnd = hostText.indexOf('\n', s.end) + 1 || hostText.length;
      const alone = !hostText.slice(lineStart, s.start).trim() && /^\s*(\/\/[^\n]*)?\n?$/.test(hostText.slice(s.end, lineEnd));
      if (alone) edits.push({ from: lineStart, to: lineEnd, text: '' });
      else edits.push({ from: s.start, to: s.end + (/^ +/.exec(hostText.slice(s.end))?.[0].length ?? 0), text: '' });
      continue;
    }
    const named = keep.filter((sp) => sp.type === 'ImportSpecifier').map((sp) => { const im = sp.imported.name ?? sp.imported.value; return im === sp.local.name ? im : `${im} as ${sp.local.name}`; });
    const def = keep.find((sp) => sp.type === 'ImportDefaultSpecifier')?.local.name;
    const ns = keep.find((sp) => sp.type === 'ImportNamespaceSpecifier')?.local.name;
    const parts = [def, ns ? `* as ${ns}` : null, named.length ? `{ ${named.join(', ')} }` : null].filter(Boolean);
    edits.push({ from: s.start, to: s.end, text: `import ${parts.join(', ')} from '${s.source.value}';` });
  }
  for (const e of edits.sort((a, b) => b.from - a.from)) hostText = hostText.slice(0, e.from) + e.text + hostText.slice(e.to);
  return hostText;
}

/** A text from the host as it reads in the moved module: each live name read through the handle. */
const asMoved = (text, live, handle) => {
  let t = text;
  for (const n of live) t = t.replace(new RegExp(`(?<![\\w$.])${n.replace(/\$/g, '\\$')}(?![\\w$])`, 'g'), `${handle}.${n}`);
  return t;
};
const count = (hay, needle) => hay.split(needle).length - 1;

/** Each element of a JSON array of objects, as [start, end) of its own braces - a scan that knows strings, so a brace
 *  in a quoted value is no brace, and a record's fields are found in whatever order it wrote them. */
function recordSpans(text) {
  const spans = [];
  let depth = 0, inString = false, from = -1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) { if (c === '\\') i++; else if (c === '"') inString = false; continue; }
    if (c === '"') inString = true;
    else if (c === '[' || c === '{') { depth++; if (c === '{' && depth === 2) from = i; }
    else if (c === ']' || c === '}') { if (c === '}' && depth === 2) spans.push([from, i + 1]); depth--; }
  }
  return spans;
}

/** THE RECORDS MOVE WITH THE CODE: every mutant record (tools/mutants/*.json) and every doc anchor (bible/**, the
 *  CITE-ANCHOR form - a file's name, a colon, the quoted line) that named moved text in the host is pointed at the module - verbatim where the
 *  text moved verbatim, through the handle where a live name was rewritten. What it cannot place once, it reports. */
export function retargetRecords({ hostFile, toFile, handle = 'host', write = false, root = '.' }) {
  const host = readFileSync(`${root}/${hostFile}`, 'utf8'), mod = readFileSync(`${root}/${toFile}`, 'utf8');
  const live = [...new Set([...mod.matchAll(new RegExp(`(?<![\\w$.])${handle}\\.([A-Za-z_$][\\w$]*)`, 'g'))].map((m) => m[1]))];
  const report = { records: 0, anchors: 0, unplaced: [] };
  const mutDir = `${root}/tools/mutants`;
  for (const f of readdirSync(mutDir).filter((n) => n.endsWith('.json')).sort()) {
    const path = `${mutDir}/${f}`, text = readFileSync(path, 'utf8');
    let list;
    try { list = JSON.parse(text); } catch { continue; }
    if (!Array.isArray(list)) continue;
    // edited IN PLACE, never re-serialised: each list keeps its own layout, and the diff is the three strings that moved.
    // A record opens with its "name" (every list's shape; a quote inside a value is escaped, so the key cannot stand in
    // one), so a record's text runs from its name to the next.
    const spans = recordSpans(text);
    if (spans.length !== list.length) { if (list.some((m) => m.file === hostFile && !host.includes(m.old))) report.unplaced.push(`${f}: its records could not be told apart - by hand`); continue; }
    let out = text;
    for (let k = list.length - 1; k >= 0; k--) {
      const m = list[k];
      if (m.file !== hostFile || host.includes(m.old)) continue;
      const old = count(mod, m.old) === 1 ? m.old : asMoved(m.old, live, handle);
      if (count(mod, old) !== 1) { report.unplaced.push(`${f}::${m.name}`); continue; }
      const nw = old === m.old ? m.new : asMoved(m.new, live, handle);
      const [from, to] = spans[k];   // the record's own braces - its fields and nobody else's
      let span = out.slice(from, to);
      const swaps = [[m.file, toFile], [m.old, old], [m.new, nw]].filter(([a, b]) => a !== b);
      if (!swaps.every(([a]) => count(span, JSON.stringify(a)) === 1)) { report.unplaced.push(`${f}::${m.name} (its strings are not written as JSON writes them)`); continue; }
      for (const [a, b] of swaps) span = span.replace(JSON.stringify(a), () => JSON.stringify(b));
      out = out.slice(0, from) + span + out.slice(to);
      report.records++;
    }
    if (out !== text && write) {
      JSON.parse(out);   // still a list - a bad edit throws here, before it is written
      writeFileSync(path, out);
    }
  }
  const hostBase = basename(hostFile), toBase = basename(toFile);
  const docs = [];
  const walkDocs = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { if (e.isDirectory()) walkDocs(`${d}/${e.name}`); else if (e.name.endsWith('.md')) docs.push(`${d}/${e.name}`); } };
  walkDocs(`${root}/bible`);
  const anchor = new RegExp(`(?<![\\w.-])((?:[\\w./-]*/)?)${hostBase.replace('.', '\\.')}:"((?:[^"\\\\]|\\\\.)+)"`, 'g');
  for (const path of docs) {
    const text = readFileSync(path, 'utf8');
    let changed = false;
    const out = text.replace(anchor, (all, dir, quote) => {
      if (host.includes(quote)) return all;
      const q = count(mod, quote) === 1 ? quote : asMoved(quote, live, handle);
      if (count(mod, q) !== 1) { report.unplaced.push(`${path.slice(root.length + 1)}: ${all}`); return all; }
      changed = true; report.anchors++;
      return `${dir}${toBase}:"${q}"`;   // the module stands beside its host (main refuses otherwise), so the anchor's path keeps its folder
    });
    if (changed && write) writeFileSync(path, out);
  }
  return report;
}

function main(args) {
  if (args[0] === '--records') {
    // the records of a move already written: node tools/hostMove.mjs --records <host> <module> [--write]
    const r = retargetRecords({ hostFile: args[1], toFile: args[2], write: args.includes('--write') });
    console.log(`records retargeted: ${r.records}; anchors retargeted: ${r.anchors}${r.unplaced.length ? `\nUNPLACED - by hand:\n  ${r.unplaced.join('\n  ')}` : ''}`);
    return;
  }
  const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const hostFile = args[0];
  const names = opt('--group')?.split(',').map((s) => s.trim());
  const toFile = opt('--to'), ctor = opt('--name');
  if (!hostFile || !names || !toFile || !ctor) {
    console.error('usage: node tools/hostMove.mjs <host> --group a,b --to src/scenes/x.js --name createX [--fn host] [--handle host] [--write]');
    process.exit(2);
  }
  if (existsSync(toFile)) { console.error(`${toFile} exists - a move writes a new module`); process.exit(1); }
  if (dirname(toFile) !== dirname(hostFile)) { console.error(`${toFile} is not beside ${hostFile} - a host's modules stand in its own folder`); process.exit(1); }
  const p = planMove({ hostFile, fn: opt('--fn'), names, toFile, ctor, handle: opt('--handle') ?? 'host' });
  if (p.refuse.length) { console.error(`REFUSED:\n  ${p.refuse.join('\n  ')}`); process.exit(1); }
  const r = renderMove(p);
  const dropped = unusedImports(r.hostText, [...p.mod.keys()]);
  const hostText = dropImports(r.hostText, dropped);
  const lines = (s) => s.split('\n').length;
  console.log(`${basename(hostFile)} ${p.host.name}: ${p.group.length} members, lines ${p.first.stmt.loc.start.line}-${p.last.stmt.loc.end.line} -> ${toFile} ${ctor}`);
  console.log(`  by value (${p.byValue.size}): ${[...p.byValue].sort().join(', ') || '-'}`);
  console.log(`  live     (${p.live.size}): ${[...p.live].sort().map((n) => (p.writes.has(n) ? `${n} (written)` : n)).join(', ') || '-'}`);
  console.log(`  imports  (${p.mod.size}): ${r.importLines.length} lines; the host drops ${dropped.length} it no longer reads${dropped.length ? `: ${dropped.join(', ')}` : ''}`);
  console.log(`  returns  : ${[...p.exported].sort().join(', ') || '-'}`);
  if (p.above.length) console.log(`  READ THESE - used above the group: ${p.above.join('; ')}`);
  console.log(`  host ${lines(p.src)} -> ${lines(hostText)} lines; module ${lines(r.moduleText)} lines`);
  if (args.includes('--write')) {
    writeFileSync(toFile, r.moduleText);
    writeFileSync(hostFile, hostText);
    const rec = retargetRecords({ hostFile, toFile, handle: opt('--handle') ?? 'host', write: true });
    console.log(`  written. Records retargeted: ${rec.records}; anchors: ${rec.anchors}${rec.unplaced.length ? `\n  UNPLACED - by hand:\n    ${rec.unplaced.join('\n    ')}` : ''}`);
  }
}

if (isMain(import.meta.url)) main(process.argv.slice(2));
