// The repository is public, so a model's brief is never source: a service's is a Worker secret, a tool's an env var or
// an ignored file. A file that talks to a model, or a module it imports, may not hold a string that speaks to the model
// in the second person, which is how a brief opens. Where `.prompts/` holds drafts, no line of them may be in the tree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

import { reviewerPrompt, modAiOn, modAiBriefMissing } from '../../server-account/src/modAi.js';
import { claudePrompt, claudeOn } from '../../server-account/src/claudeStaff.js';
import { systemPrompt } from '../../tools/translate.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DIRS = ['src', 'server/src', 'server-account/src', 'app', 'tools', 'scripts'];
const SKIP = new Set(['node_modules', 'release', 'dist', 'mutants', 'parity']);
/** A file talks to a model when it names the API, its shared call, or a cached system block. */
const TALKS = /api\.anthropic\.com|messagesCall\(|cache_control/;
/** A string literal that opens by speaking to the model. */
const BRIEF = /(['"`])\s*(You|Your (task|job|role)|Act as)\b/;
/** In a module a talker imports, only a long one: a short "You are not..." there is a player's message. */
const BRIEF_LONG = /(['"`])\s*(You|Your (task|job|role)|Act as)\b[^'"`]{60,}/;
/** A relative import, whose module may hold the brief its importer sends. */
const IMPORT = /\bfrom\s+['"](\.{1,2}\/[^'"]+)['"]|\bimport\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g;
/** A draft's line short enough to be a common phrase is not a quote of it. */
const QUOTE_MIN = 40;

function* files(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(c|m)?js$/.test(name)) yield p;
  }
}

/** The files that talk to a model, and the modules they import. */
function briefHomes() {
  const talkers = [];
  for (const dir of DIRS) for (const p of files(join(ROOT, dir))) if (TALKS.test(readFileSync(p, 'utf8'))) talkers.push(p);
  const homes = new Set(talkers);
  for (const p of talkers) {
    for (const m of readFileSync(p, 'utf8').matchAll(IMPORT)) {
      const dep = resolve(dirname(p), m[1] ?? m[2]);
      if (existsSync(dep) && !dep.includes('node_modules')) homes.add(dep);
    }
  }
  return { talkers, homes: [...homes].map((p) => ({ p, shape: talkers.includes(p) ? BRIEF : BRIEF_LONG })) };
}

test('PROMPT-HIDDEN the gate catches a brief in the shapes one is written, and not the plumbing', () => {
  for (const line of ["'You sort the notes below.',", '`You are a helper for ${team}.`', '"Your task is to list these."', "  ' You read each row.'", "'Act as the desk.'"])
    assert.match(line, BRIEF, line);
  for (const line of ["system: [{ type: 'text', text: reviewerPrompt(env) }]", "'not-moderator': 'Only moderators.'", "const you = 'P1';"])
    assert.doesNotMatch(line, BRIEF, line);
  for (const line of ["const URL = 'https://api.anthropic.com/v1/messages';", 'return messagesCall(db, env, fetchFn, body, key);', "cache_control: { type: 'ephemeral' }"])
    assert.match(line, TALKS, line);
  assert.match("  'You review each line a player wrote against the rules they agreed to.',", BRIEF_LONG);
  assert.doesNotMatch("'not-moderator': 'You are not a moderator in the game.',", BRIEF_LONG);
  assert.deepEqual([..."import { a } from './briefs.js';\nconst b = await import('../x/y.mjs');".matchAll(IMPORT)].map((m) => m[1] ?? m[2]), ['./briefs.js', '../x/y.mjs']);
});

test('PROMPT-HIDDEN no file that talks to a model, nor a module it imports, holds a brief', () => {
  const { talkers, homes } = briefHomes();
  assert.ok(talkers.length >= 3, 'the reviewer, Claude as staff and the translation tool are all read');
  assert.ok(homes.some(({ p }) => p.endsWith('src/net/safety/conduct.js')), 'the modules a talker imports are read too');
  const found = [];
  for (const { p, shape } of homes) {
    readFileSync(p, 'utf8').split('\n').forEach((line, i) => { if (shape.test(line)) found.push(`${relative(ROOT, p)}:${i + 1}`); });
  }
  assert.deepEqual(found, [], 'a brief belongs in a secret or .prompts/, never in the repository');
});

test('PROMPT-HIDDEN where .prompts/ holds drafts, no tracked file quotes a line of them', (t) => {
  const dir = join(ROOT, '.prompts');
  const drafts = existsSync(dir) ? readdirSync(dir).filter((n) => statSync(join(dir, n)).isFile()) : [];
  if (!drafts.length) return t.skip('no drafts here - the check runs where the owner keeps them');
  const quotes = new Set();
  for (const n of drafts) {
    for (const raw of readFileSync(join(dir, n), 'utf8').split(/\r?\n/)) {
      const line = raw.replace(/^(icu|dfu|glossary)\|/, '').trim();
      if (line.length >= QUOTE_MIN) quotes.add(line);
    }
  }
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }).split('\0').filter(Boolean);
  const found = [];
  for (const f of tracked) {
    if (!/\.(c|m)?js$|\.(md|json|ya?ml|toml|sql|txt|html|css)$/.test(f) || f.startsWith('vendor/')) continue;
    let text;
    try { text = readFileSync(join(ROOT, f), 'utf8'); } catch { continue; }
    for (const q of quotes) if (text.includes(q)) found.push(`${f}: ${q.slice(0, 50)}...`);
  }
  assert.deepEqual(found, [], 'a draft brief is quoted in the tree');
});

test('PROMPT-HIDDEN each brief is its secret alone: no secret, no brief and no call; a missing brief is a fault', () => {
  assert.equal(reviewerPrompt({}), '');
  assert.equal(systemPrompt({ code: 'fr', table: 'Port_Strings' }), '');
  assert.equal(claudePrompt({}), '');
  assert.equal(modAiOn({ MOD_AI: 'shadow', ANTHROPIC_API_KEY: 'k' }), false);
  assert.equal(modAiBriefMissing({ MOD_AI: 'shadow', ANTHROPIC_API_KEY: 'k' }), true, 'switched on, keyed, no brief');
  assert.equal(modAiBriefMissing({ MOD_AI: 'off', ANTHROPIC_API_KEY: 'k' }), false);
  assert.equal(claudeOn({ CLAUDE_STAFF: 'on', ANTHROPIC_API_KEY: 'k' }), false);
  assert.equal(modAiOn({ MOD_AI: 'shadow', ANTHROPIC_API_KEY: 'k', MOD_AI_PROMPT: 'b' }), true);
  assert.equal(claudeOn({ CLAUDE_STAFF: 'on', ANTHROPIC_API_KEY: 'k', CLAUDE_STAFF_PROMPT: 'b' }), true);
  const deploy = readFileSync(join(ROOT, '.github/workflows/account-deploy.yml'), 'utf8');
  for (const name of ['MOD_AI_PROMPT', 'CLAUDE_STAFF_PROMPT']) {
    assert.ok(deploy.includes(`${name}: \${{ secrets.${name} }}`), `the deploy reads ${name} from the repository secrets`);
    assert.match(deploy, new RegExp(`\\{[^}]*\\b${name}\\b[^}]*\\} \\| with_entries`), `the deploy puts ${name} on the Worker`);
  }
});
