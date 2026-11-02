// WEBKIT-TLA (bible/01-Overview/bugs/Field-Bugs-2026-10-29g.md; AUDIT FB1029g TLA-1): THE GUARD ON WHAT SHIPS. A top-level
// await makes every graph that imports its module async, and WebKit before Safari 27 resolves a second import() of such a
// graph before it has run - the iPhone's "undefined is not a constructor". test/tree/toplevelawait.test.js reads the
// source; this reads the build's own chunks, so vendor code, a template-literal import and anything the bundler emits are
// held too. Only a page's own entry, which nothing imports, may await.
import * as acorn from 'acorn';

/** The lines of a module's top-level awaits - an `await` or a `for await` outside every function - from its text.
 *  @param {string} text @returns {number[]} */
export function topLevelAwaits(text) {
  const ast = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  const out = [];
  const visit = (node, inFn) => {
    if (!node || typeof node.type !== 'string') return;
    if (/Function/.test(node.type) || node.type === 'StaticBlock') inFn = true;
    if (!inFn && (node.type === 'AwaitExpression' || (node.type === 'ForOfStatement' && node.await)))
      out.push(node.loc.start.line);
    for (const k in node) {
      const v = node[k];
      if (Array.isArray(v)) for (const c of v) visit(c, inFn);
      else if (v && typeof v.type === 'string') visit(v, inFn);
    }
  };
  visit(ast, false);
  return out;
}

/** The chunks of a bundle that something imports (no entry) and that await at their top level, each `name (line n)`.
 *  @param {Record<string, any>} bundle */
export function importedAwaitingChunks(bundle) {
  const bad = [];
  for (const c of Object.values(bundle)) {
    if (c?.type !== 'chunk' || c.isEntry || !/\bawait\b/.test(c.code)) continue;
    const lines = topLevelAwaits(c.code);
    if (lines.length) bad.push(`${c.fileName} (line ${lines[0]})`);
  }
  return bad;
}

/** The build's plugin: a chunk another imports that awaits at its top level fails the build. */
export function noImportedTopLevelAwait() {
  return {
    name: 'no-imported-top-level-await',
    apply: /** @type {const} */ ('build'),
    /** @this {{ error: (msg: string) => never }} @param {any} _o @param {Record<string, any>} bundle */
    generateBundle(_o, bundle) {
      const bad = importedAwaitingChunks(bundle);
      if (bad.length)
        this.error(
          `WEBKIT-TLA: a chunk another imports awaits at its top level - ${bad.join(', ')}. WebKit before Safari 27 runs its importers first.`,
        );
    },
  };
}
