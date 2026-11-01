// The repository is public, so a model's brief is a Worker secret and never source. A file that talks to a model may
// not hold a string that speaks to it in the second person, which is how every brief opens.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { reviewerPrompt, modAiOn } from '../../server-account/src/modAi.js';
import { claudePrompt, claudeOn } from '../../server-account/src/claudeStaff.js';
import { systemPrompt, translateTable } from '../../tools/translate.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DIRS = ['src', 'server/src', 'server-account/src', 'app', 'tools', 'scripts'];
const SKIP = new Set(['node_modules', 'release', 'dist', 'mutants', 'parity']);
/** A file talks to a model when it names the API, its shared call, or a cached system block. */
const TALKS = /api\.anthropic\.com|messagesCall\(|cache_control/;
/** A string literal that opens by speaking to the model. */
const BRIEF = /(['"`])\s*(You|Your (task|job|role))\b/;

function* files(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(c|m)?js$/.test(name)) yield p;
  }
}

test('PROMPT-HIDDEN the gate catches a brief in the shapes one is written, and not the plumbing', () => {
  for (const line of ["'You sort the notes below.',", '`You are a helper for ${team}.`', '"Your task is to list these."', "  ' You read each row.'"])
    assert.match(line, BRIEF, line);
  for (const line of ["system: [{ type: 'text', text: reviewerPrompt(env) }]", "'not-moderator': 'Only moderators.'", "const you = 'P1';"])
    assert.doesNotMatch(line, BRIEF, line);
  for (const line of ["const URL = 'https://api.anthropic.com/v1/messages';", 'return messagesCall(db, env, fetchFn, body, key);', "cache_control: { type: 'ephemeral' }"])
    assert.match(line, TALKS, line);
});

test('PROMPT-HIDDEN no file that talks to a model holds a brief', () => {
  const found = [];
  let talkers = 0;
  for (const dir of DIRS) {
    for (const p of files(join(ROOT, dir))) {
      const text = readFileSync(p, 'utf8');
      if (!TALKS.test(text)) continue;
      talkers++;
      text.split('\n').forEach((line, i) => { if (BRIEF.test(line)) found.push(`${relative(ROOT, p)}:${i + 1}`); });
    }
  }
  assert.ok(talkers >= 3, 'the reviewer, Claude as staff and the translation tool are all read');
  assert.deepEqual(found, [], 'a brief belongs in a Worker secret, put by the deploy from the repository secrets');
});

test('PROMPT-HIDDEN each brief is its secret alone: no secret, no brief and no call', async () => {
  assert.equal(reviewerPrompt({}), '');
  assert.equal(systemPrompt({ code: 'fr', table: 'Port_Strings' }), '');
  await assert.rejects(translateTable({ code: 'fr', table: 'Port_Strings', model: () => { throw new Error('sent'); }, template: '' }), /no brief/);
  assert.equal(claudePrompt({}), '');
  assert.equal(modAiOn({ MOD_AI: 'shadow', ANTHROPIC_API_KEY: 'k' }), false);
  assert.equal(claudeOn({ CLAUDE_STAFF: 'on', ANTHROPIC_API_KEY: 'k' }), false);
  assert.equal(modAiOn({ MOD_AI: 'shadow', ANTHROPIC_API_KEY: 'k', MOD_AI_PROMPT: 'b' }), true);
  assert.equal(claudeOn({ CLAUDE_STAFF: 'on', ANTHROPIC_API_KEY: 'k', CLAUDE_STAFF_PROMPT: 'b' }), true);
  const deploy = readFileSync(join(ROOT, '.github/workflows/account-deploy.yml'), 'utf8');
  for (const name of ['MOD_AI_PROMPT', 'CLAUDE_STAFF_PROMPT']) {
    assert.ok(deploy.includes(`${name}: \${{ secrets.${name} }}`), `the deploy reads ${name} from the repository secrets`);
    assert.match(deploy, new RegExp(`\\{[^}]*\\b${name}\\b[^}]*\\} \\| with_entries`), `the deploy puts ${name} on the Worker`);
  }
});
