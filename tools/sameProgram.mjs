// SAME PROGRAM - proof that a mechanical change changed nothing (LEGIBLE 2, bible/01-Overview/Readability-Arc.md).
//
// A formatter or a rename is supposed to change how code reads and nothing about what it does. Tests can only sample
// that; this checks it whole. Two versions of a file are parsed and their syntax trees compared node by node:
//
//   - Layout, comments, quote style, redundant parentheses and trailing commas are not in the tree, so they are free.
//   - A literal is compared by its value (`'a'` and `"a"`, `1e3` and `1000` are the same), a template by its text.
//   - A name is compared by what it MEANS, not how it is spelled: every variable is resolved to its declaration
//     (eslint-scope), and the two versions must pair their variables one to one. A variable may change its name only
//     when the change is asked for (`renames`), and a rename that makes a name resolve to a different variable - a
//     local renamed onto a global's name, say - is caught, because the pairing breaks.
//   - Names other files can see never change: exported declarations, import and export specifiers' outer names,
//     property keys and member names (`obj.name`, `{ name }`, class members), labels. A rename of one of those is a
//     change to every file that uses it, which no single-file comparison can prove.
//   - A file with `with` or a direct `eval(` cannot have its variables resolved statically, so no rename in it is
//     accepted.
//   - One thing a rename changes that no tree can hold: the `name` a renamed function or class carries at run time
//     (`f.name`, a stack trace, a function assigned to a renamed `const`). A rename passes here; the slice that makes
//     it checks that nothing reads that name.
//
//   node tools/sameProgram.mjs before.js after.js [--rename old=new ...]
//   node tools/sameProgram.mjs --against <git rev> [path ...] [--rename old=new ...]
//       every .js/.mjs that differs between the rev and the working tree (or the paths named); exit 1 if any is not
//       the same program, with where the two first differ.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parse } from 'acorn';
import { analyze } from 'eslint-scope';
import { isMain } from './lib/isMain.mjs';

/** Fields that record where a node is, or how it was spelled - never what it does. */
const POSITION_FIELDS = new Set(['start', 'end', 'loc', 'range', 'raw']);
/** Fields compared by the rules below instead of as plain data. */
const RULE_FIELDS = new Set(['shorthand']);

function parseProgram(src) {
  const options = { ecmaVersion: 'latest', locations: true, ranges: true, allowHashBang: true };
  try {
    return { ast: parse(src, { ...options, sourceType: 'module' }), sourceType: 'module' };
  } catch {
    return { ast: parse(src, { ...options, sourceType: 'script' }), sourceType: 'script' };
  }
}

/**
 * What every identifier in a tree is: a variable (resolved through its scope), a global it reaches without a
 * declaration, or an outer name that must keep its spelling (a property key, a member name, an export's name).
 */
function identifierRoles(ast, sourceType) {
  const scopes = analyze(ast, { ecmaVersion: 2025, sourceType, fallback: 'iteration' });
  const variableOf = new Map();
  for (const scope of scopes.scopes) {
    for (const variable of scope.variables) {
      for (const identifier of variable.identifiers) variableOf.set(identifier, variable);
    }
    for (const reference of scope.references) {
      if (reference.resolved) variableOf.set(reference.identifier, reference.resolved);
    }
  }

  const fixedName = new Set();   // identifiers whose spelling other code depends on
  let dynamicScope = false;      // `with` or a direct eval: names cannot be resolved statically
  const markDeclaredNames = (declaration) => {
    if (!declaration) return;
    if (declaration.id) fixedName.add(declaration.id);
    for (const declarator of declaration.declarations ?? []) collectPatternNames(declarator.id, fixedName);
  };
  walk(ast, (node) => {
    switch (node.type) {
      case 'MemberExpression':
        if (!node.computed) fixedName.add(node.property);
        break;
      case 'Property':
      case 'MethodDefinition':
      case 'PropertyDefinition':
        if (!node.computed) fixedName.add(node.key);
        break;
      case 'ExportAllDeclaration':
        if (node.exported) fixedName.add(node.exported);
        break;
      case 'ExportNamedDeclaration':
        markDeclaredNames(node.declaration);
        break;
      case 'ExportDefaultDeclaration':
        if (node.declaration?.id) fixedName.add(node.declaration.id);
        break;
      case 'LabeledStatement':
      case 'BreakStatement':
      case 'ContinueStatement':
        if (node.label) fixedName.add(node.label);
        break;
      case 'MetaProperty':
        fixedName.add(node.meta);
        fixedName.add(node.property);
        break;
      case 'WithStatement':
        dynamicScope = true;
        break;
      case 'CallExpression':
        if (node.callee.type === 'Identifier' && node.callee.name === 'eval') dynamicScope = true;
        break;
    }
  });
  return { variableOf, fixedName, dynamicScope };
}

function collectPatternNames(pattern, into) {
  if (!pattern) return;
  switch (pattern.type) {
    case 'Identifier': into.add(pattern); break;
    case 'ObjectPattern': for (const p of pattern.properties) collectPatternNames(p.type === 'RestElement' ? p.argument : p.value, into); break;
    case 'ArrayPattern': for (const element of pattern.elements) collectPatternNames(element, into); break;
    case 'RestElement': collectPatternNames(pattern.argument, into); break;
    case 'AssignmentPattern': collectPatternNames(pattern.left, into); break;
  }
}

/** Visit every node of a tree, parents before children. */
function walk(node, visit) {
  if (!node || typeof node.type !== 'string') return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (POSITION_FIELDS.has(key)) continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const child of value) if (child && typeof child.type === 'string') walk(child, visit);
    } else if (value && typeof value.type === 'string') {
      walk(value, visit);
    }
  }
}

class Difference extends Error {
  constructor(why, before, after) {
    super(why);
    this.before = before;
    this.after = after;
  }
}

/**
 * Whether two sources are the same program.
 * @param {string} beforeSrc
 * @param {string} afterSrc
 * @param {{ renames?: Record<string, string> }} [options] - variable names the change was asked to rename, old -> new
 * @returns {{ same: true } | { same: false, why: string, before: {line: number, column: number} | null, after: {line: number, column: number} | null }}
 */
export function sameProgram(beforeSrc, afterSrc, { renames = {} } = {}) {
  let before, after;
  try { before = parseProgram(beforeSrc); } catch (e) { return { same: false, why: `the first version does not parse: ${e.message}`, before: null, after: null }; }
  try { after = parseProgram(afterSrc); } catch (e) { return { same: false, why: `the second version does not parse: ${e.message}`, before: null, after: null }; }
  if (before.sourceType !== after.sourceType) return { same: false, why: `one version parses only as a ${before.sourceType}, the other only as a ${after.sourceType}`, before: null, after: null };

  const roles = [identifierRoles(before.ast, before.sourceType), identifierRoles(after.ast, after.sourceType)];
  const pairedForward = new Map(), pairedBack = new Map();   // variable of the first version <-> of the second

  const where = (node) => (node?.loc ? { line: node.loc.start.line, column: node.loc.start.column } : null);
  const differ = (why, a, b) => { throw new Difference(why, where(a), where(b)); };

  const compareIdentifiers = (a, b, { local = false } = {}) => {
    const [first, second] = roles;
    const fixedA = !local && first.fixedName.has(a), fixedB = !local && second.fixedName.has(b);
    if (fixedA || fixedB) {
      if (fixedA !== fixedB) differ(`\`${a.name}\` and \`${b.name}\` stand in different roles`, a, b);
      if (a.name !== b.name) differ(`\`${a.name}\` became \`${b.name}\` where other code reads the name itself (a property, a member, an export or import name, a label)`, a, b);
      return;
    }
    const varA = first.variableOf.get(a), varB = second.variableOf.get(b);
    if (!varA || !varB) {
      if (varA || varB) differ(`\`${a.name}\` and \`${b.name}\` do not both name a declared variable - one of them now reaches a different binding or a global`, a, b);
      if (a.name !== b.name) differ(`the global \`${a.name}\` became \`${b.name}\``, a, b);
      return;
    }
    if (a.name !== b.name) {
      if (renames[a.name] !== b.name) differ(`\`${a.name}\` was renamed to \`${b.name}\`, and that rename was not asked for`, a, b);
      if (first.dynamicScope || second.dynamicScope) differ('a rename in a file with `with` or a direct `eval(` cannot be proven', a, b);
    }
    const pairedWith = pairedForward.get(varA), pairedFrom = pairedBack.get(varB);
    if (pairedWith === undefined && pairedFrom === undefined) {
      pairedForward.set(varA, varB);
      pairedBack.set(varB, varA);
    } else if (pairedWith !== varB || pairedFrom !== varA) {
      differ(`\`${a.name}\` / \`${b.name}\` resolve to a different declaration than the same name did elsewhere in the file`, a, b);
    }
  };

  const compareValues = (a, b, node, otherNode, field) => {
    if (a === b) return;
    if (typeof a === 'bigint' && typeof b === 'bigint' && a === b) return;
    differ(`\`${field}\` differs: ${JSON.stringify(String(a))} vs ${JSON.stringify(String(b))}`, node, otherNode);
  };

  const compareNodes = (a, b) => {
    if (a === null || a === undefined || b === null || b === undefined) {
      if ((a ?? null) !== (b ?? null)) differ('a part is present in one version and missing in the other', a ?? b, b ?? a);
      return;
    }
    if (a.type !== b.type) differ(`a ${a.type} became a ${b.type}`, a, b);
    if (a.type === 'Identifier' || a.type === 'PrivateIdentifier') {
      if (a.type === 'PrivateIdentifier') { if (a.name !== b.name) differ(`#${a.name} became #${b.name}`, a, b); return; }
      compareIdentifiers(a, b);
      return;
    }
    if (a.type === 'ImportSpecifier' || a.type === 'ExportSpecifier') {
      // `import { a }` and `export { k }` hold ONE node as both names (acorn); the outer name is other code's and
      // keeps its spelling, the local one is a variable like any other - `import { a as b }` renames only the local
      const outer = a.type === 'ImportSpecifier' ? 'imported' : 'exported';
      const outerName = (n) => n[outer].name ?? n[outer].value;
      if (outerName(a) !== outerName(b)) differ(`the ${outer} name \`${outerName(a)}\` became \`${outerName(b)}\``, a, b);
      if (a.local.type === 'Identifier' && b.local.type === 'Identifier') compareIdentifiers(a.local, b.local, { local: true });
      else compareNodes(a.local, b.local);
      return;
    }
    if (a.type === 'Literal') {
      if (a.regex || b.regex) {
        if (a.regex?.pattern !== b.regex?.pattern || a.regex?.flags !== b.regex?.flags) differ('a regular expression differs', a, b);
        return;
      }
      if (a.bigint !== undefined || b.bigint !== undefined) { compareValues(a.bigint, b.bigint, a, b, 'bigint'); return; }
      if (!Object.is(a.value, b.value)) differ(`the literal ${a.raw} became ${b.raw}`, a, b);
      return;
    }
    if (a.type === 'TemplateElement') {
      if (a.value.raw !== b.value.raw || a.value.cooked !== b.value.cooked || a.tail !== b.tail) differ('a template literal\'s text differs', a, b);
      return;
    }
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      if (POSITION_FIELDS.has(key) || RULE_FIELDS.has(key)) continue;
      const valueA = a[key], valueB = b[key];
      if (Array.isArray(valueA) || Array.isArray(valueB)) {
        if (!Array.isArray(valueA) || !Array.isArray(valueB) || valueA.length !== valueB.length) differ(`the ${a.type}'s \`${key}\` has a different number of parts`, a, b);
        for (let i = 0; i < valueA.length; i++) compareNodes(valueA[i], valueB[i]);
      } else if ((valueA && typeof valueA === 'object' && typeof valueA.type === 'string') || (valueB && typeof valueB === 'object' && typeof valueB.type === 'string')) {
        compareNodes(valueA, valueB);
      } else {
        compareValues(valueA, valueB, a, b, `${a.type}.${key}`);
      }
    }
  };

  try {
    compareNodes(before.ast, after.ast);
    return { same: true };
  } catch (e) {
    if (!(e instanceof Difference)) throw e;
    return { same: false, why: e.message, before: e.before, after: e.after };
  }
}

function parseRenames(args) {
  const renames = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== '--rename') continue;
    const [from, to] = String(args[i + 1] ?? '').split('=');
    if (!from || !to) throw new Error(`--rename takes old=new, not ${args[i + 1]}`);
    renames[from] = to;
  }
  return renames;
}

function main(args) {
  const renames = parseRenames(args);
  const plain = args.filter((a, i) => a !== '--rename' && args[i - 1] !== '--rename' && a !== '--against' && args[i - 1] !== '--against');
  const report = (label, result) => {
    if (result.same) return 0;
    const at = (p) => (p ? `${p.line}:${p.column + 1}` : '?');
    console.log(`  NOT THE SAME  ${label}  (${at(result.before)} -> ${at(result.after)}): ${result.why}`);
    return 1;
  };
  const againstAt = args.indexOf('--against');
  if (againstAt >= 0) {
    const rev = args[againstAt + 1];
    const named = plain.filter((p) => /\.m?js$/.test(p));
    const changed = execFileSync('git', ['diff', '--name-status', rev, '--', ...(named.length ? named : ['*.js', '*.mjs'])], { encoding: 'utf8', maxBuffer: 1 << 28 })
      .split('\n').filter(Boolean).map((l) => l.split('\t'));
    let bad = 0;
    for (const [status, path] of changed) {
      if (status !== 'M') { console.log(`  NOT THE SAME  ${path}  (${status === 'A' ? 'added' : status === 'D' ? 'deleted' : status}): a file added, deleted or renamed is not a mechanical change to it`); bad++; continue; }
      const old = execFileSync('git', ['show', `${rev}:${path}`], { encoding: 'utf8', maxBuffer: 1 << 28 });
      bad += report(path, sameProgram(old, readFileSync(path, 'utf8'), { renames }));
    }
    console.log(`${changed.length} file(s) compared against ${rev}: ${changed.length - bad} the same program, ${bad} not`);
    return bad ? 1 : 0;
  }
  if (plain.length !== 2) {
    console.error('usage: node tools/sameProgram.mjs before.js after.js [--rename old=new ...]\n       node tools/sameProgram.mjs --against <rev> [path ...] [--rename old=new ...]');
    return 2;
  }
  const bad = report(`${plain[0]} -> ${plain[1]}`, sameProgram(readFileSync(plain[0], 'utf8'), readFileSync(plain[1], 'utf8'), { renames }));
  if (!bad) console.log('the same program');
  return bad;
}

if (isMain(import.meta.url)) process.exit(main(process.argv.slice(2)));
