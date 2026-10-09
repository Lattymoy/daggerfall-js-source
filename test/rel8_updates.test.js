// REL8 (2026-10-09, Mac: "Let's officially start numbering updates beginning with 0.0.1"; `01-Overview/Desktop-App.md`
// REL8) - EVERY MERGE TO MAIN IS A NUMBERED UPDATE. MAJOR.MINOR is the line (scripts/updateLine.mjs, by hand); PATCH is
// the count of main's first-parent commits from the merge that last changed the line - derived, never bumped, so the
// merge that brings the line is 0.0.1 whatever merged before it. The number is stamped into the build beside the
// commit (scripts/buildTag.mjs), shown in the game, named on the release and read back by the launcher's news; the
// installers keep their own version (the updater never takes a lower one).
//
// Run over real git histories made here (this checkout is shallow, as CI's are), the real scripts, the host's own
// lines and the workflows as written.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { updateNumber, UPDATE_LINE_FILE, UPDATE_LINE_RE, UPDATE_RE, UPDATE_ENV } from '../scripts/updateNumber.mjs';
import { UPDATE_LINE } from '../scripts/updateLine.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const require = createRequire(import.meta.url);
const L = require('../app/lib/launcherState.cjs');

/** A scratch repository with `main`, and a hand to commit and merge in it as GitHub's merge button does. */
function repo(t) {
  const d = mkdtempSync(join(tmpdir(), 'rel8-'));
  t.after(() => rmSync(d, { recursive: true, force: true }));
  const git = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: d, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q', '-b', 'main');
  const put = (p, text) => { mkdirSync(join(d, p, '..'), { recursive: true }); writeFileSync(join(d, p), text); };
  const commit = (msg) => { git('add', '-A'); git('commit', '-qm', msg); return git('rev-parse', 'HEAD'); };
  /** A pull request: a branch off main, its commits, merged with a merge commit (`--no-ff`). */
  const pr = (name, edits) => {
    git('checkout', '-qb', name);
    for (const [p, text] of edits) { put(p, text); commit(`${name}: ${p}`); }
    git('checkout', '-q', 'main');
    git('merge', '-q', '--no-ff', name, '-m', `Merge pull request ${name}`);
    return git('rev-parse', 'HEAD');
  };
  const at = (rev = 'HEAD') => updateNumber({ at: rev, cwd: d, env: {} });
  return { d, git, put, commit, pr, at };
}
const LINE_TEXT = readFileSync(join(ROOT, UPDATE_LINE_FILE), 'utf8');
const lineAs = (v) => LINE_TEXT.replace(UPDATE_LINE_RE, `export const UPDATE_LINE = '${v}';`);

test('REL8: the merge that brings the line is Update 0.0.1 - whatever merged before it - and each merge to main after it the next; a commit pushed to main is one too; a comment edit moves nothing; a new line starts at its .1', (t) => {
  const r = repo(t);
  r.put('a.txt', 'a\n'); r.commit('root');
  assert.equal(r.at(), null, 'no line yet: no number');
  r.pr('other', [['b.txt', 'b\n']]);   // another pull request merged first
  const first = r.pr('numbering', [['c.txt', 'c\n'], [UPDATE_LINE_FILE, LINE_TEXT], ['d.txt', 'd\n']]);
  assert.equal(r.at(), '0.0.1', 'the merge that brought the line');
  r.git('checkout', '-q', 'numbering');
  assert.equal(r.at(), '0.0.2', 'on the branch it counts its own commits - only main\'s are updates (its merge is still 0.0.1)');
  r.git('checkout', '-q', 'main');
  r.pr('next', [['e.txt', 'e\n'], ['f.txt', 'f\n']]);
  assert.equal(r.at(), '0.0.2', 'one merge, one update - however many commits it carries');
  r.put('g.txt', 'g\n'); r.commit('pushed to main');
  assert.equal(r.at(), '0.0.3', 'a commit on main is a release of its own (REL3)');
  r.pr('comment', [[UPDATE_LINE_FILE, `// a note\n${LINE_TEXT}`]]);
  assert.equal(r.at(), '0.0.4', 'the file\'s comments are not the line');
  assert.equal(r.at(first), '0.0.1', 'a commit keeps its number');
  r.pr('minor', [[UPDATE_LINE_FILE, lineAs('0.1')]]);
  assert.equal(r.at(), '0.1.1', 'a new line: its first merge is .1');
  r.pr('after', [['h.txt', 'h\n']]);
  assert.equal(r.at(), '0.1.2');
  r.pr('major', [[UPDATE_LINE_FILE, lineAs('1.0')]]);
  assert.equal(r.at(), '1.0.1');
});

test('REL8: a clone with no history says nothing rather than a wrong number (CI\'s depth-1 checkout counted from its cut); the release\'s legs are TOLD the number, digits only', (t) => {
  const r = repo(t);
  r.put('a.txt', 'a\n'); r.commit('root');
  r.pr('numbering', [[UPDATE_LINE_FILE, LINE_TEXT]]);
  r.pr('next', [['b.txt', 'b\n']]);
  assert.equal(r.at(), '0.0.2');
  const shallow = mkdtempSync(join(tmpdir(), 'rel8-shallow-'));
  t.after(() => rmSync(shallow, { recursive: true, force: true }));
  execFileSync('git', ['clone', '-q', '--depth', '1', `file://${r.d}`, shallow], { stdio: 'ignore' });
  assert.equal(updateNumber({ cwd: shallow, env: {} }), null, 'depth 1: unknown');
  assert.equal(updateNumber({ cwd: shallow, env: { [UPDATE_ENV]: '0.0.2' } }), '0.0.2', 'told by the job that derived it');
  for (const bad of ['0.0', 'v0.0.2', '0.0.2;touch x', '0.0.2\n1', 'x']) assert.equal(updateNumber({ cwd: shallow, env: { [UPDATE_ENV]: bad } }), null, JSON.stringify(bad));
  assert.equal(updateNumber({ cwd: tmpdir(), env: {} }), null, 'no git: unknown, never a throw');
});

test('REL8: the build stamps it beside the commit - src/buildTag.js UPDATE, the number or null', (t) => {
  const r = repo(t);
  r.put('a.txt', 'a\n'); r.commit('root');
  mkdirSync(join(r.d, 'src'));
  const stamp = (env = {}) => {
    const out = spawnSync(process.execPath, [join(ROOT, 'scripts/buildTag.mjs')], { cwd: r.d, encoding: 'utf8', env: { ...process.env, [UPDATE_ENV]: '', ...env } });
    assert.equal(out.status, 0, out.stderr);
    return readFileSync(join(r.d, 'src/buildTag.js'), 'utf8');
  };
  const sha = () => r.git('rev-parse', 'HEAD').slice(0, 12);
  assert.equal(stamp(), `export const BUILD_TAG = '${sha()}';\nexport const UPDATE = null;\n`, 'no line: null');
  r.pr('numbering', [[UPDATE_LINE_FILE, LINE_TEXT]]);
  assert.equal(stamp(), `export const BUILD_TAG = '${sha()}';\nexport const UPDATE = '0.0.1';\n`);
  assert.equal(stamp({ [UPDATE_ENV]: '0.0.7' }), `export const BUILD_TAG = '${sha()}';\nexport const UPDATE = '0.0.7';\n`, 'told');
  // the committed stamp (what a checkout carries before its first build) knows no number
  assert.match(rd('src/buildTag.js'), /^export const BUILD_TAG = '[0-9a-f]{12}';\nexport const UPDATE = null;\n$/);
});

test('REL8: the line is one declaration, found by its diff - this checkout\'s line is 0.0, and the search and the reader both see it', () => {
  assert.equal(UPDATE_LINE, '0.0', 'Mac: "beginning with 0.0.1"');
  assert.equal(LINE_TEXT.match(new RegExp(UPDATE_LINE_RE.source, 'gm'))?.length, 1, 'one line the reader reads');
  assert.equal(LINE_TEXT.split('\n').filter((l) => /^export const UPDATE_LINE = /.test(l)).length, 1, 'one line the diff search finds');
  assert.ok(UPDATE_RE.test(`${UPDATE_LINE}.1`));
});

test('REL8: the game says it - the pause window\'s version line leads with the number and keeps the commit for a report, a build that cannot know it says the commit alone; the About pane has its row', () => {
  const pause = rd('src/ui/pauseWindow.js');
  assert.match(pause, /import \{ BUILD_TAG, UPDATE \} from '\.\.\/buildTag\.js';/);
  const line = pause.match(/^ {4}const ver = [^;]+;/m)?.[0];
  assert.ok(line, 'the line');
  const ver = (UPDATE, BUILD_TAG) => new Function('UPDATE', 'BUILD_TAG', `${line}\nreturn ver;`)(UPDATE, BUILD_TAG);
  assert.equal(ver('0.0.1', 'abcdef012345'), 'Daggerfall Online 0.0.1 (abcdef012345)');
  assert.equal(ver(null, 'abcdef012345'), 'Daggerfall Online abcdef012345');
  const menu = rd('src/ui/enhancedMenu.js');
  assert.match(menu, /\['Update', UPDATE \?\? 'a development build'\],[^\n]*\n\s*\['Build', BUILD_TAG\],/);
});

test('REL8: the site and the release derive it where the history is whole, and every leg is told the one number; the release is named for it', () => {
  const deploy = rd('.github/workflows/deploy.yml');
  assert.match(deploy, /- name: Checkout production\n\s+uses: actions\/checkout@v4\n\s+with:\n\s+ref: \$\{\{ needs\.main\.outputs\.sha \}\}\n\s+path: production\n(?:\s+#[^\n]*\n)*\s+fetch-depth: 0\n/, 'the production build counts main\'s history');
  const rel = rd('.github/workflows/release-desktop.yml');
  assert.match(rel, /\n {6}update: \$\{\{ steps\.reltag\.outputs\.update \}\}\n/, 'the version job\'s output');
  assert.match(rel, /UPDATE=\$\(node scripts\/updateNumber\.mjs\)\n\s+if \[ -n "\$UPDATE" \] && ! \[\[ "\$UPDATE" =~ \^\[0-9\]\+\\\.\[0-9\]\+\\\.\[0-9\]\+\$ \]\]; then/, 'derived once, digits only');
  assert.match(rel, /echo "update=\$UPDATE" >> "\$GITHUB_OUTPUT"/);
  assert.match(rel, /- name: Build the site\n\s+env:\n\s+DFO_UPDATE: \$\{\{ needs\.version\.outputs\.update \}\}[^\n]*\n\s+run: npm run build\n/, 'each leg stamps the game it packs');
  assert.equal(UPDATE_ENV, 'DFO_UPDATE');
  assert.match(rel, /name: \$\{\{ needs\.version\.outputs\.update != '' && format\('Update \{0\}', needs\.version\.outputs\.update\) \|\| needs\.version\.outputs\.tag \}\}/, 'the release named "Update <n>", the tag where there is none');
  assert.match(rel, /tag_name: \$\{\{ needs\.version\.outputs\.tag \}\}/, 'the tag is still the installer\'s number - the updater compares it');
});

test('REL8: the launcher\'s news reads the release\'s name back - "Update 0.0.1" is the update, any other name none - keeps it in news.json and heads the notes with it', () => {
  const name = 'Update 0.0.1';
  assert.equal(L.updateOfName(name), '0.0.1', 'the words the release is named in (release-desktop.yml format(\'Update {0}\'))');
  for (const n of ['app-v0.1.7200', 'Update 0.0', 'Update 0.0.1 hotfix', 'update 0.0.1', '', null]) assert.equal(L.updateOfName(n), null, String(n));
  const news = L.newsFrom([
    { tag_name: 'app-v0.1.7200', name, body: 'Notes', published_at: '2026-10-09T00:00:00Z' },
    { tag_name: 'app-v0.1.7170', name: 'app-v0.1.7170', body: 'Old', published_at: '2026-10-08T00:00:00Z' },
  ]);
  assert.deepEqual(news, [
    { version: '0.1.7200', date: '2026-10-09T00:00:00Z', text: 'Notes', update: '0.0.1' },
    { version: '0.1.7170', date: '2026-10-08T00:00:00Z', text: 'Old' },
  ], 'the version stays the installer\'s - what the badges compare');
  assert.deepEqual(L.cachedNews({ items: [...news, { version: '0.1.7100', text: 'x', update: '0.0.1; x' }] }).map((n) => n.update ?? null), ['0.0.1', null, null], 'news.json keeps a number, never anything else');
  assert.match(rd('app/launcher/launcher.js'), /head\.append\(el\('span', 'ver', note\.update \? `Update \$\{note\.update\}` : `v\$\{note\.version\}`\)\);/);
});
