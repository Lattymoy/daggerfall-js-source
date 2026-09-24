// QL-FRAME1 + LOOT-GONE1 (2026-09-24, the contributor's soft-lock report): activating a ground pile with QuickLoot on
// ran `if (quickLootTake(...)) return;` INSIDE frame(), so a take - or its refusal, "You cannot carry any more stuff." -
// left the frame before requestAnimationFrame(frame) at its foot and the game loop stopped: no look, no walk, no foes.
// And a pile gone between the hover and the press (pileFor null) threw building its hooks, which ends a rAF loop too.
//
// THE LAW, read off the AST rather than a line: every `return` whose nearest function is a host's frame() either
// re-requests the frame first or is the P0 kill (a later boot or an unwind retired this loop). A return added anywhere
// in the frame body without the re-request is exactly this soft-lock, and fails here by name.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const HOSTS = ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js'];

/** Each `return` whose nearest enclosing function is `function frame(...)`, with the statements before it in its block. */
function frameReturns(src) {
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  const out = [];
  const walk = (n, fn, block) => {
    if (!n || typeof n.type !== 'string') return;
    const inFn = /Function/.test(n.type) ? n : fn;
    if (n.type === 'ReturnStatement' && fn?.type === 'FunctionDeclaration' && fn.id?.name === 'frame') out.push({ line: n.loc.start.line, node: n, block });
    for (const k of Object.keys(n)) {
      const v = n[k];
      const nextBlock = (n.type === 'BlockStatement' || n.type === 'Program') ? n : block;
      if (Array.isArray(v)) v.forEach((c) => walk(c, inFn, nextBlock)); else if (v && typeof v.type === 'string') walk(v, inFn, nextBlock);
    }
  };
  walk(ast, null, null);
  return out;
}

test('QL-FRAME1: every return inside a host\'s frame() re-requests the frame first or is the P0 kill - a return that does neither is the soft-lock (mutants: `if (quickLootTake(...)) return;` back in either host)', () => {
  for (const f of HOSTS) {
    const src = rd(f);
    const lines = src.split('\n');
    const rets = frameReturns(src);
    assert.ok(rets.length >= 2, `${f}: the frame and its returns are found`);
    for (const r of rets) {
      const text = lines[r.line - 1];
      const before = r.block?.body ? r.block.body.slice(0, r.block.body.findIndex((s) => s.start <= r.node.start && r.node.end <= s.end) + 1) : [];
      const reRequested = /requestAnimationFrame\(frame\)/.test(text) || before.some((s) => /requestAnimationFrame\(frame\)/.test(src.slice(s.start, s.end)) && s.end <= r.node.start);
      const kill = /if \(!frameAlive\(_frameToken\)\)/.test(text);
      assert.ok(reRequested || kill, `${f}:${r.line} leaves frame() without the next frame: ${text.trim().slice(0, 120)}`);
    }
  }
});

test('LOOT-GONE1 + QL-FRAME1: the ground-pile arm in both hosts is worldModes\' own shape - a pile gone since the hover opens nothing, a handled quick-loot press opens no window, and neither leaves the frame (mutants: the null pile built into hooks; the window opened after a take)', () => {
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const src = rd(f);
    const arm = src.slice(src.indexOf('const pile = droppedLoot.pileFor(dropKey);'), src.indexOf('else modes.tryEnter().then(', src.indexOf('const pile = droppedLoot.pileFor(dropKey);')));
    const code = arm.replace(/\/\/[^\n]*/g, '');   // the arm's CODE - its comments say what the old return did
    assert.match(arm, /if \(pile\) \{\s*const _hooks = droppedLootHooks\(pile\);/, `${f}: the hooks only for a pile that is there`);
    assert.match(arm, /if \(!quickLootTake\(dropKey, _hooks, playerEntity, [^\n]*\)\) \{\s*(?:\/\/[^\n]*\n\s*)*const w = makeInventoryWindow\(\{/, `${f}: the window only for a press quick-loot did not handle`);
    assert.doesNotMatch(code, /\breturn\b/, `${f}: nothing in the arm leaves the frame`);
  }
  // worldModes' twin, the shape both hosts took
  assert.match(rd('src/scenes/worldModes.js'), /if \(pile\) \{\s*const _hooks = droppedLootHooks\(pile\);[^\n]*\n[^\n]*\n\s*if \(!quickLootTake\(key, _hooks,/);
});
