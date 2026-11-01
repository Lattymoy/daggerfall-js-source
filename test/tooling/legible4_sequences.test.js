// LEGIBLE 4 (AUDIT, 2026-10-31; bible/01-Overview/Readability-Arc.md): no-sequences at its default lets a sequence in
// its own parentheses pass - `(act(), answer)`, the form the formatter writes - so the rule is strict, and the files
// that held one when it turned strict are held at their counts. A count that falls is written down; one that rises fails.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ESLint } from 'eslint';
import config, { SEQUENCES_HELD } from '../../eslint.config.js';

const ROOT = new URL('../../', import.meta.url).pathname;
const STRICT = ['error', { allowInParentheses: false }];

test('LEGIBLE 4 strict: a parenthesized comma sequence is refused in shipped code but in the held files (mutants: the strict block lenient; a held file read strictly)', async () => {
  const eslint = new ESLint({ cwd: ROOT });
  for (const f of ['src/ui/hud/hud.js', 'server/src/index.js', 'server-account/src/index.js', 'tools/format.mjs', 'scripts/openFileLimit.mjs']) {
    const rule = (await eslint.calculateConfigForFile(f)).rules['no-sequences'];
    assert.deepEqual(rule, [2, { allowInParentheses: false }], `${f}: strict`);
  }
  for (const f of Object.keys(SEQUENCES_HELD)) {
    const rule = (await eslint.calculateConfigForFile(f)).rules['no-sequences'];
    assert.deepEqual(rule, [2, { allowInParentheses: true }], `${f}: held, a bare sequence still refused`);
  }
});

test('LEGIBLE 4 held: each held file holds exactly its count of parenthesized sequences - the list only shrinks (mutants: a count raised; a sequence rewritten without its count lowered)', async () => {
  const strict = config.map((c) => (c.rules?.['no-sequences'] ? { ...c, rules: { ...c.rules, 'no-sequences': STRICT } } : c));
  const eslint = new ESLint({ cwd: ROOT, overrideConfigFile: true, overrideConfig: strict });
  const files = Object.keys(SEQUENCES_HELD);
  const now = {};
  for (const r of await eslint.lintFiles(files)) {
    now[r.filePath.slice(ROOT.length)] = r.messages.filter((m) => m.ruleId === 'no-sequences').length;
  }
  for (const f of files) assert.equal(now[f], SEQUENCES_HELD[f], `${f}: ${now[f]} parenthesized sequence(s), held at ${SEQUENCES_HELD[f]}`);
});
