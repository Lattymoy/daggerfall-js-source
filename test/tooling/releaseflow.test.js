// RELEASE-FLOW (2026-10-19, bible/01-Overview/Release-Flow.md): MAIN IS DEVELOPMENT, RELEASE IS PRODUCTION.
//
// Production - the relay, the account service, the site and the desktop release, and every operation on production's
// data - moves only from `release`, only when a release manager dispatches it and approves it; main is the dev
// environment's, deployed by hand to a VM of its own inside WireGuard (DEV-ENV). A hotfix is merged into release first
// and comes back to main by a pull request the workflow opens (HOTFIX-BACK); `/check` runs a pull request's whole check
// whatever its conflicts (CHECK-ASK); and who reviews, releases and joins the dev network is code (ROLES). A workflow
// runs on GitHub, never in node, so what can be held is held here: the triggers, the doors, the environments, the
// settings they name - and the workflows' own bash, run as a runner runs it, against real git and a `gh` that records.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync, mkdirSync, chmodSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { readSettings, codeownersReviewers, planSettings, sameRuleset, ROLES } from '../../tools/repoSettings.mjs';
import { wgKeyPair, wgPublicOf, memberConfig, memberIpProblem, WG_KEY_RE, MEMBER_NAME_RE, NETWORK } from '../../tools/devPeer.mjs';
import { releaseLineProblem } from '../../scripts/desktopRelease.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const WF = (name) => rd(`.github/workflows/${name}`);
const WORKFLOWS = readdirSync(join(ROOT, '.github/workflows')).filter((f) => f.endsWith('.yml')).sort();
const BASH = process.platform === 'win32' ? 'the steps are bash' : false;

/** A step's `run: |` block, by its name, as the runner hands it to bash (the block's own indentation taken off). */
function runBlock(yml, stepName) {
  const at = yml.indexOf(`- name: ${stepName}\n`);
  assert.ok(at >= 0, `no step named "${stepName}"`);
  const from = yml.indexOf('run: |\n', at) + 'run: |\n'.length;
  const lines = [];
  for (const line of yml.slice(from).split('\n')) {
    if (line.trim() && !line.startsWith('          ')) break;
    lines.push(line.slice(10));
  }
  return lines.join('\n');
}

/** A workflow's `on:` block, as written. */
const onOf = (yml) => yml.slice(yml.search(/^on:/m), yml.search(/^(permissions|concurrency|jobs):/m));

/** A workflow's jobs, each { name, text } - a job is a two-space key under `jobs:`. */
function jobsOf(yml) {
  const body = yml.slice(yml.search(/^jobs:\n/m) + 'jobs:\n'.length);
  const out = [];
  for (const m of body.matchAll(/^ {2}([A-Za-z0-9_-]+):\n/gm)) out.push({ name: m[1], at: m.index });
  return out.map((j, i) => ({ name: j.name, text: body.slice(j.at, out[i + 1]?.at ?? body.length) }));
}

/** A scratch directory, gone after the test. */
const scratch = (t, label) => { const d = mkdtempSync(join(tmpdir(), `relflow-${label}-`)); t.after(() => rmSync(d, { recursive: true, force: true })); return d; };

/** A `gh` that records each call (one line, its arguments tab-joined) and answers from the environment. */
function fakeGh(dir) {
  const bin = join(dir, 'bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'gh'), [
    '#!/bin/bash',
    'printf "%s\\t" "$@" >> "$GH_CALLS"; printf "\\n" >> "$GH_CALLS"',
    'case "$1 $2" in',
    '  "pr list") printf "%s\\n" "${FAKE_PR:-}" ;;',
    '  "api repos/"*) case "$2" in',
    '      */permission) printf "%s\\n" "${FAKE_PERMISSION:-none}" ;;',
    '      */pulls/*) printf "%s\\n" "$FAKE_PULL" ;;',
    '    esac ;;',
    'esac',
    'exit 0',
    '',
  ].join('\n'));
  chmodSync(join(bin, 'gh'), 0o755);
  return bin;
}
const callsOf = (file) => (existsSync(file) ? readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => l.replace(/\t$/, '').split('\t')) : []);

const PRODUCTION = ['deploy.yml', 'relay-deploy.yml', 'account-deploy.yml', 'release-desktop.yml'];
const PRODUCTION_SECRETS = ['CLOUDFLARE_API_TOKEN', 'PATREON_CLIENT_SECRET', 'PATREON_WEBHOOK_SECRET', 'ANTHROPIC_API_KEY', 'DISCORD_BOT_TOKEN'];

// ═══ RELEASE-BRANCH: PRODUCTION FROM RELEASE, BY HAND, APPROVED ═══════════════════════════════════════════════════

test('RELEASE-BRANCH: the four production workflows are dispatched by hand and pushed by nothing; the three deploys stop a run on any branch but release before they check anything out; the desktop release derives a tag on release alone (mutants: the site published from main again; a deploy from any branch)', () => {
  for (const f of PRODUCTION) {
    const on = onOf(WF(f));
    assert.match(on, /^on:\n {2}workflow_dispatch:\n/, `${f}: a dispatch`);
    assert.doesNotMatch(on, /\n {2}(push|pull_request|pull_request_target|schedule|workflow_run|release):/, `${f}: and nothing else starts it`);
  }
  for (const [f, guard] of [['deploy.yml', 'Only release publishes the site'], ['relay-deploy.yml', 'Only release deploys the relay'], ['account-deploy.yml', 'Only release deploys the account service']]) {
    const [first] = jobsOf(WF(f));
    const steps = first.text.slice(first.text.indexOf('    steps:\n'));
    assert.ok(steps.startsWith(`    steps:\n      - name: ${guard}\n        if: github.ref != 'refs/heads/release'\n`), `${f}: its first job's first step is the door (${first.name})`);
    assert.match(runBlock(first.text, guard), /^echo "::error::[^\n]*release[^\n]*"\nexit 1\n*$/, `${f}: and it fails the run, said`);
  }
  assert.match(runBlock(WF('release-desktop.yml'), 'Resolve release version'), /^TAG=''\nif \[ "\$GITHUB_REF" = refs\/heads\/release \]; then\n/);
});

test('RELEASE-BRANCH: every job that holds one of production\'s secrets runs in the production environment, and every job that holds a dev one in the dev environment - the environments keep the secrets and ask their reviewers; the publishing jobs too (mutants: the deploy out of the environment; a data operation out of it; the publish out of it)', () => {
  let held = 0;
  for (const f of WORKFLOWS) {
    for (const job of jobsOf(WF(f))) {
      const secrets = [...job.text.matchAll(/\bsecrets\.([A-Z0-9_]+)/g)].map((m) => m[1]);
      const prod = secrets.filter((s) => PRODUCTION_SECRETS.includes(s));
      const dev = secrets.filter((s) => s.startsWith('DEV_'));
      assert.deepEqual(secrets.filter((s) => !prod.includes(s) && !dev.includes(s)), [], `${f} ${job.name}: a secret this pin does not know - name its environment here`);
      if (prod.length) { held++; assert.match(job.text, /\n {4}environment: production\n/, `${f} ${job.name} holds ${prod.join(', ')} outside the production environment`); }
      if (dev.length) assert.match(job.text, /\n {4}environment: dev\n/, `${f} ${job.name} holds ${dev.join(', ')} outside the dev environment`);
    }
  }
  assert.ok(held >= 10, `the walk found the jobs it must (${held}): the two deploys and the eight operations`);
  const publish = jobsOf(WF('release-desktop.yml')).find((j) => j.name === 'publish');
  assert.match(publish.text, /\n {4}environment: production\n/, 'the desktop release is published with a release manager\'s approval');
  const pages = jobsOf(WF('deploy.yml')).find((j) => j.name === 'deploy');
  assert.match(pages.text, /\n {4}environment:\n {6}name: github-pages\n/, 'the site is published in its own protected environment');
});

test('RELEASE-BRANCH: the environments the workflows name are the ones ops/github/settings.json declares - production and github-pages admit release alone and ask the release managers, dev admits main alone; check.yml runs on pull requests, on main and by hand (mutants: production admitting main; a workflow\'s environment undeclared)', () => {
  const settings = readSettings(rd('ops/github/settings.json'));
  const named = new Set();
  for (const f of WORKFLOWS) {
    for (const m of WF(f).matchAll(/\n {4}environment:(?: (\S+)|\n {6}name: (\S+))\n/g)) named.add(m[1] ?? m[2]);
  }
  assert.deepEqual([...named].sort(), Object.keys(settings.environments).sort(), 'every environment a workflow names is declared, and none declared unused');
  assert.deepEqual(settings.environments.production, { reviewers: 'releaseManagers', branches: ['release'] });
  assert.deepEqual(settings.environments['github-pages'], { reviewers: 'releaseManagers', branches: ['release'] });
  assert.deepEqual(settings.environments.dev, { reviewers: null, branches: ['main'] });
  assert.equal(onOf(WF('check.yml')), 'on:\n  pull_request:\n  push:\n    branches: [main]\n  workflow_dispatch:\n\n');
});

test('RELEASE-BRANCH: where release begins - the release before must stand on the first-parent line a release is cut from, since the update number counts that line and the notes read it from there: release branched at main\'s last release passes, and so does every release cut from release after it, a hotfix\'s and a promotion\'s; branched before it, both would repeat main\'s, so the desktop release and the site refuse, said (mutants: the line read as ancestry; the line unread; the refusal passed; the desktop release unasked; the site unasked)', { skip: BASH }, (t) => {
  // both jobs that publish an update number ask, before they publish it
  assert.match(runBlock(WF('release-desktop.yml'), 'Resolve release version'), /^if \[ "\$GITHUB_REF" = refs\/heads\/release \]; then\n(?: {2}[^\n]*\n)*? {2}node scripts\/desktopRelease\.mjs line "\$TAG"\nfi\n/m,
    'the desktop release asks on release, of the tag it is about to cut');
  const site = jobsOf(WF('deploy.yml')).find((j) => j.name === 'site').text;
  const asks = site.indexOf('        run: node scripts/desktopRelease.mjs line\n        working-directory: production\n');
  assert.ok(asks > 0 && asks < site.indexOf('- name: Build production'), 'the site asks in its production checkout, before it builds');

  const repo = scratch(t, 'line');
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  const run = (args) => git(...args);
  let n = 0;
  const commit = (msg) => { writeFileSync(join(repo, `${n++}.txt`), `${msg}\n`); git('add', '-A'); git('commit', '-q', '-m', msg); };
  /** A pull request into `base`: a branch off it, a commit, GitHub's merge commit. */
  const merged = (pr, branch, base) => {
    git('checkout', '-q', '-b', branch, base);
    commit(`${branch} work`);
    git('checkout', '-q', base);
    git('merge', '--no-ff', '-q', '-m', `Merge pull request #${pr} from o/${branch}`, branch);
  };
  /** main into `into`, by the promotion's pull request. */
  const promoted = (into) => {
    git('checkout', '-q', into);
    git('merge', '--no-ff', '-q', '-m', 'Merge pull request #90 from o/main', 'main');
  };
  const line = (...args) => spawnSync(process.execPath, [join(ROOT, 'scripts/desktopRelease.mjs'), 'line', ...args], { cwd: repo, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'probe@example.invalid');
  git('config', 'user.name', 'probe');
  git('config', 'commit.gpgsign', 'false');
  commit('start');
  assert.equal(releaseLineProblem('app-v0.1.9', run), null, 'no release before it: nothing to stand on');
  git('tag', 'app-v0.1.1');
  git('branch', 'early');                     // release, branched too soon
  merged(21, 'f1', 'main');
  git('tag', 'app-v0.1.2');                   // main's last release, cut after that
  git('branch', 'release');                   // release, branched at it
  merged(22, 'f2', 'main');

  promoted('early');
  assert.match(releaseLineProblem('app-v0.1.9', run) ?? '', /^app-v0\.1\.2 \([0-9a-f]{12}\) is not on HEAD's first-parent line: /,
    'main\'s last release is an ancestor - through the promotion - and not on the line');
  const refused = line('app-v0.1.9');
  assert.equal(refused.status, 1, 'the step fails');
  assert.match(refused.stderr, /^nothing is released: app-v0\.1\.2 .*Where release begins/);

  promoted('release');
  assert.equal(releaseLineProblem('app-v0.1.9', run), null, 'branched at main\'s last release: it stands on the line');
  assert.equal(line('app-v0.1.9').status, 0);
  git('tag', 'app-v0.1.4');                   // the first release cut from release
  assert.equal(releaseLineProblem('', run), null, 'the site deployed after its desktop release reads HEAD\'s own tag');
  merged(31, 'hotfix/x', 'release');
  assert.equal(releaseLineProblem('app-v0.1.6', run), null, 'a hotfix\'s release: the release before it is on the line');
  merged(23, 'f3', 'main');
  promoted('release');
  assert.equal(releaseLineProblem('app-v0.1.9', run), null, 'and a promotion\'s after that');
});

// ═══ ROLES: WHO REVIEWS, WHO RELEASES ═════════════════════════════════════════════════════════════════════════════

test('ROLES: the settings read whole; CODEOWNERS names the reviewers, in order; main and release take a pull request, a code owner\'s approval and the check, and release a merge commit alone (a promotion\'s notes are found through its second parent); the admins may bypass by a pull request only (mutants: CODEOWNERS and the roles apart; a squash into release)', () => {
  const settings = readSettings(rd('ops/github/settings.json'));
  assert.deepEqual(codeownersReviewers(rd('.github/CODEOWNERS')), settings.roles.reviewers, 'CODEOWNERS is roles.reviewers');
  for (const role of ROLES) assert.ok(settings.roles[role].length > 0, role);
  for (const name of ['main', 'release']) {
    const r = settings.rulesets.find((x) => x.name === name);
    assert.deepEqual(r.conditions.ref_name.include, [`refs/heads/${name}`]);
    assert.deepEqual(r.bypass_actors, [{ actor_id: 5, actor_type: 'RepositoryRole', bypass_mode: 'pull_request' }], `${name}: the admins, by a pull request`);
    const types = r.rules.map((x) => x.type).sort();
    assert.deepEqual(types, ['deletion', 'non_fast_forward', 'pull_request', 'required_status_checks']);
    const pr = r.rules.find((x) => x.type === 'pull_request').parameters;
    assert.equal(pr.required_approving_review_count, 1);
    assert.equal(pr.require_code_owner_review, true, `${name}: a reviewer's approval, not any writer's`);
    assert.deepEqual(r.rules.find((x) => x.type === 'required_status_checks').parameters.required_status_checks, [{ context: 'check' }]);
  }
  assert.deepEqual(settings.rulesets.find((x) => x.name === 'release').rules.find((x) => x.type === 'pull_request').parameters.allowed_merge_methods, ['merge']);
  assert.throws(() => readSettings(rd('ops/github/settings.json').replace('"releaseManagers": ["Lattymoy"]', '"releaseManagers": []')), /releaseManagers names nobody/);
  assert.throws(() => readSettings(rd('ops/github/settings.json').replace('"reviewers": "releaseManagers"', '"reviewers": "everyone"')), /is no role/);
});

test('ROLES: the plan - a repository with nothing set gets every setting, in the order GitHub needs; one that holds them gets nothing; GitHub\'s own defaults beside a ruleset\'s are no difference; a branch an environment no longer admits is taken off (mutants: the plan blind to a moved branch; a default read as a change)', () => {
  const settings = readSettings(rd('ops/github/settings.json'));
  const repo = settings.repository;
  const ids = { Lattymoy: 98724681, EdoardoBramini: 241148409 };
  const api = (state) => (method, path) => {
    assert.equal(method, 'GET', 'the plan only reads');
    if (path === `repos/${repo}/actions/permissions/workflow`) return state.workflow;
    if (path.startsWith('users/')) return { id: ids[path.slice(6)] };
    if (path === `repos/${repo}/environments`) return { environments: state.environments };
    const pol = /^repos\/[^/]+\/[^/]+\/environments\/([^/]+)\/deployment-branch-policies$/.exec(path);
    if (pol) return { branch_policies: state.policies[pol[1]] ?? [] };
    if (path === `repos/${repo}/rulesets`) return state.rulesets.map(({ id, name }) => ({ id, name, source_type: 'Repository' }));
    const rs = /\/rulesets\/(\d+)$/.exec(path);
    if (rs) return state.rulesets.find((r) => r.id === Number(rs[1]));
    throw new Error(`asked ${path}`);
  };
  const bare = planSettings(settings, api({ workflow: { default_workflow_permissions: 'write', can_approve_pull_request_reviews: false }, environments: [], policies: {}, rulesets: [] }));
  assert.deepEqual(bare.calls.map((c) => `${c.method} ${c.path.replace(`repos/${repo}/`, '')}`), [
    'PUT actions/permissions/workflow',
    'PUT environments/production', 'POST environments/production/deployment-branch-policies',
    'PUT environments/github-pages', 'POST environments/github-pages/deployment-branch-policies',
    'PUT environments/dev', 'POST environments/dev/deployment-branch-policies',
    'POST rulesets', 'POST rulesets',
  ]);
  assert.deepEqual(bare.calls[1].body.reviewers, [{ type: 'User', id: ids.Lattymoy }], 'production asks the release managers');
  assert.deepEqual(bare.calls[5].body.reviewers, [], 'dev asks nobody');
  assert.deepEqual(bare.calls[2].body, { name: 'release', type: 'branch' });
  // GitHub as it answers once set: reviewers by their whole record, defaults beside the declared parameters
  const held = {
    workflow: { ...settings.actions },
    environments: Object.entries(settings.environments).map(([name, env]) => ({
      name, deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
      protection_rules: env.reviewers ? [{ type: 'required_reviewers', prevent_self_review: false, reviewers: settings.roles[env.reviewers].map((l) => ({ type: 'User', reviewer: { login: l, id: ids[l] } })) }] : [],
    })),
    policies: Object.fromEntries(Object.entries(settings.environments).map(([name, env]) => [name, env.branches.map((b, i) => ({ id: i + 1, name: b, type: 'branch' }))])),
    rulesets: settings.rulesets.map((r, i) => ({
      ...r, id: 100 + i, source_type: 'Repository',
      rules: r.rules.map((x) => (x.type === 'pull_request' ? { ...x, parameters: { allowed_merge_methods: ['merge', 'squash', 'rebase'], automatic_copilot_code_review_enabled: false, ...x.parameters } } : x)),
    })),
  };
  assert.deepEqual(planSettings(settings, api(held)).calls, [], 'a repository that holds the settings is left alone');
  const pagesFromMain = { ...held, policies: { ...held.policies, 'github-pages': [{ id: 7, name: 'main', type: 'branch' }] } };
  assert.deepEqual(planSettings(settings, api(pagesFromMain)).calls.map((c) => `${c.method} ${c.path.replace(`repos/${repo}/`, '')}`),
    ['POST environments/github-pages/deployment-branch-policies', 'DELETE environments/github-pages/deployment-branch-policies/7'], 'Pages from release, and no more from main');
  const want = settings.rulesets[0];
  assert.equal(sameRuleset(held.rulesets[0], want), true);
  const looser = structuredClone(held.rulesets[0]);
  looser.rules.find((x) => x.type === 'pull_request').parameters.required_approving_review_count = 0;
  assert.equal(sameRuleset(looser, want), false, 'an approval taken off is a difference');
  assert.equal(sameRuleset({ ...held.rulesets[0], rules: [...held.rulesets[0].rules, { type: 'creation' }] }, want), false, 'a rule the file does not declare is one');
});

// ═══ HOTFIX-BACK: A FIX ON RELEASE COMES BACK TO MAIN ═════════════════════════════════════════════════════════════

/** A remote with main and release, and a hand to work in it as GitHub's merge button does. */
function remote(t) {
  const d = scratch(t, 'back');
  const git = (cwd, ...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...a], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const origin = join(d, 'origin.git');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin]);
  const work = join(d, 'work');
  execFileSync('git', ['clone', '-q', origin, work], { stdio: 'ignore' });
  const put = (p, text) => writeFileSync(join(work, p), text);
  const commit = (msg) => { git(work, 'add', '-A'); git(work, 'commit', '-qm', msg); };
  git(work, 'checkout', '-q', '-b', 'main');
  put('game.txt', 'one\ntwo\nthree\n'); commit('root');
  git(work, 'push', '-q', 'origin', 'main');
  git(work, 'push', '-q', 'origin', 'main:release');
  /** the runner's checkout of release as a push to it starts the workflow: every branch fetched */
  const runner = () => {
    const r = join(d, `runner-${Math.random().toString(36).slice(2)}`);
    execFileSync('git', ['clone', '-q', '--branch', 'release', origin, r], { stdio: 'ignore' });
    return r;
  };
  return { d, git, work, put, commit, runner, origin };
}

/** One step of release-backmerge.yml, run in a runner checkout as GitHub runs it. */
function backStep(t, cwd, name, env = {}) {
  const tmp = scratch(t, 'tmp');
  const out = join(tmp, 'output');
  writeFileSync(out, '');
  const bin = fakeGh(tmp);
  const r = spawnSync('bash', ['-e', '-c', runBlock(WF('release-backmerge.yml'), name)], {
    cwd, encoding: 'utf8',
    env: { PATH: `${bin}:${process.env.PATH}`, HOME: tmp, GITHUB_OUTPUT: out, RUNNER_TEMP: tmp, GITHUB_REPOSITORY: 'o/r', GH_CALLS: join(tmp, 'calls'), ...env },
  });
  const outputs = Object.fromEntries(readFileSync(out, 'utf8').trim().split('\n').filter(Boolean).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
  return { ...r, outputs, calls: callsOf(join(tmp, 'calls')), tmp };
}

test('HOTFIX-BACK: every push to release asks one question - would merging release into main change main - so a promotion opens nothing, a hotfix opens the back-merge with its commits named, a fix carried to main by hand opens nothing, and a conflicting fix opens it all the same (mutants: a promotion read as a lack; a conflict read as nothing)', { skip: BASH }, (t) => {
  assert.equal(onOf(WF('release-backmerge.yml')), 'on:\n  push:\n    branches: [release]\n\n', 'every update to release, and nothing else');
  const r = remote(t);
  const ask = () => backStep(t, r.runner(), 'What release has that main does not');
  // a promotion: main merged into release brings main nothing
  r.put('feature.txt', 'f\n'); r.commit('a feature on main');
  r.git(r.work, 'push', '-q', 'origin', 'main');
  r.git(r.work, 'checkout', '-q', '-b', 'release', 'origin/release');
  r.git(r.work, 'merge', '-q', '--no-ff', '-m', 'Merge pull request #2 from o/main', 'main');
  r.git(r.work, 'push', '-q', 'origin', 'release');
  let got = ask();
  assert.equal(got.status, 0, got.stderr);
  assert.equal(got.outputs.lack, '', 'a promotion opens nothing');
  // a hotfix on release
  r.put('game.txt', 'one\nTWO\nthree\n'); r.commit('Fix the second line');
  r.git(r.work, 'push', '-q', 'origin', 'release');
  got = ask();
  assert.equal(got.outputs.lack, 'yes');
  assert.match(readFileSync(join(got.tmp, 'commits.md'), 'utf8'), /^- [0-9a-f]{7,} Fix the second line\n$/, 'its commits named, the merges not');
  // the same fix carried to main by hand: nothing to bring back
  r.git(r.work, 'checkout', '-q', 'main');
  r.put('game.txt', 'one\nTWO\nthree\n'); r.commit('carried by hand');
  r.git(r.work, 'push', '-q', 'origin', 'main');
  assert.equal(ask().outputs.lack, '', 'main already holds it');
  // main moved the same line another way: the merge conflicts - still a lack, for a person to resolve
  r.put('game.txt', 'one\n2\nthree\n'); r.commit('main changes it again');
  r.git(r.work, 'push', '-q', 'origin', 'main');
  r.git(r.work, 'checkout', '-q', 'release');
  r.put('game.txt', 'one\nII\nthree\n'); r.commit('Fix it again');
  r.git(r.work, 'push', '-q', 'origin', 'release');
  got = ask();
  assert.equal(got.status, 0, got.stderr);
  assert.equal(got.outputs.lack, 'yes', 'a conflict is a lack');
});

test('HOTFIX-BACK: the branch - set to release when no back-merge is open; release MERGED INTO it when one is, keeping a resolution pushed there; a merge that conflicts left to a person, said on the pull request and nothing pushed - then the pull request opened or brought up to date, and its check dispatched (mutants: release forced over an open branch; the conflict pushed)', { skip: BASH }, (t) => {
  const r = remote(t);
  r.git(r.work, 'checkout', '-q', '-b', 'release', 'origin/release');
  r.put('fix.txt', 'fixed\n'); r.commit('Fix one');
  r.git(r.work, 'push', '-q', 'origin', 'release');
  const head = (ref) => execFileSync('git', ['rev-parse', ref], { cwd: r.origin, encoding: 'utf8' }).trim();
  // none open: the branch is release's head, whatever an old one held
  let got = backStep(t, r.runner(), 'Keep backmerge/release level with release', { FAKE_PR: '' });
  assert.equal(got.status, 0, got.stderr);
  assert.equal(head('backmerge/release'), head('release'));
  assert.deepEqual(got.calls.map((c) => c.slice(0, 2)), [['pr', 'list']]);
  // one open, and someone resolved a conflict on it: release is merged in, the resolution kept
  r.git(r.work, 'fetch', '-q', 'origin');
  r.git(r.work, 'checkout', '-q', '-b', 'backmerge/release', 'origin/backmerge/release');
  r.put('resolution.txt', 'by hand\n'); r.commit('Merge main into backmerge/release');
  r.git(r.work, 'push', '-q', 'origin', 'backmerge/release');
  const resolved = head('backmerge/release');
  r.git(r.work, 'checkout', '-q', 'release');
  r.put('fix2.txt', 'fixed\n'); r.commit('Fix two');
  r.git(r.work, 'push', '-q', 'origin', 'release');
  got = backStep(t, r.runner(), 'Keep backmerge/release level with release', { FAKE_PR: '41' });
  assert.equal(got.status, 0, got.stderr);
  assert.equal(got.outputs.pr, '41');
  const ancestor = (a, b) => spawnSync('git', ['merge-base', '--is-ancestor', a, b], { cwd: r.origin }).status === 0;
  assert.ok(ancestor(resolved, head('backmerge/release')) && ancestor(head('release'), head('backmerge/release')), 'both kept: the resolution and release');
  // release moves the resolved file another way: the merge conflicts - said, nothing pushed
  const before = head('backmerge/release');
  r.put('resolution.txt', 'release says otherwise\n'); r.commit('Fix three');
  r.git(r.work, 'push', '-q', 'origin', 'release');
  got = backStep(t, r.runner(), 'Keep backmerge/release level with release', { FAKE_PR: '41' });
  assert.equal(got.status, 0, got.stderr);
  assert.equal(got.outputs.conflict, 'yes');
  assert.equal(head('backmerge/release'), before, 'nothing pushed over the branch');
  assert.deepEqual(got.calls.at(-1).slice(0, 3), ['pr', 'comment', '41'], 'said on the pull request');
  // the pull request: opened when none is, its body naming the commits; brought up to date when one is - and checked
  const commits = scratch(t, 'c');
  writeFileSync(join(commits, 'commits.md'), '- abc1234 Fix one\n');
  const open = backStep(t, r.runner(), 'The pull request into main', { PR: '', RUNNER_TEMP: commits });
  assert.equal(open.status, 0, open.stderr);
  assert.deepEqual(open.calls[0].slice(0, 6), ['pr', 'create', '--repo', 'o/r', '--base', 'main']);
  assert.ok(open.calls[0].includes('backmerge/release'));
  const body = readFileSync(join(commits, 'body.md'), 'utf8');
  assert.match(body, /\n- abc1234 Fix one\n/);
  assert.match(body, /\*\*Merge it with a merge commit, not a squash\*\*/);
  assert.doesNotMatch(body, /^#+ *patch[ -]?notes/im, 'a back-merge carries no patch notes - its fix\'s release did');
  const edit = backStep(t, r.runner(), 'The pull request into main', { PR: '41', RUNNER_TEMP: commits });
  assert.deepEqual(edit.calls[0].slice(0, 3), ['pr', 'edit', '41']);
  const yml = WF('release-backmerge.yml');
  assert.match(yml, /- name: Its check\n {8}if: steps\.lack\.outputs\.lack == 'yes' && steps\.branch\.outputs\.conflict != 'yes'\n {8}run: gh workflow run check\.yml --repo "\$GITHUB_REPOSITORY" --ref backmerge\/release\n/,
    'a pull request the workflow opens starts no run of its own - the check is asked for');
  const job = jobsOf(yml)[0].text;
  assert.match(job, /\n {4}permissions:\n {6}contents: write[^\n]*\n {6}pull-requests: write[^\n]*\n {6}actions: write[^\n]*\n/);
});

// ═══ CHECK-ASK: `/check` ON A PULL REQUEST ════════════════════════════════════════════════════════════════════════

/** check-ask.yml's step, run as GitHub runs it for a comment. */
function askCheck(t, { body = '/check', permission = 'write', pull = {} } = {}) {
  const tmp = scratch(t, 'ask');
  const bin = fakeGh(tmp);
  const pr = { state: 'open', head: { repo: { full_name: 'o/r' }, ref: 'feature/x', sha: 'f'.repeat(40) }, ...pull };
  const r = spawnSync('bash', ['-e', '-c', runBlock(WF('check-ask.yml'), 'Dispatch the check on the pull request\'s branch')], {
    cwd: tmp, encoding: 'utf8',
    env: { PATH: `${bin}:${process.env.PATH}`, RUNNER_TEMP: tmp, GITHUB_REPOSITORY: 'o/r', GH_CALLS: join(tmp, 'calls'), PR: '12', WHO: 'someone', COMMENT: '345', BODY: body, FAKE_PERMISSION: permission, FAKE_PULL: JSON.stringify(pr) },
  });
  assert.equal(r.status, 0, r.stderr);
  return { tmp, calls: callsOf(join(tmp, 'calls')), said: existsSync(join(tmp, 'say.md')) ? readFileSync(join(tmp, 'say.md'), 'utf8') : null };
}

test('CHECK-ASK: `/check` from someone who can push dispatches check.yml on the pull request\'s own branch and says so with a reaction; a reader is told who may ask, a fork\'s pull request why it cannot be, a closed one that it is closed; a comment that is not `/check` asks nothing; and nothing of the comment is pasted into the script (mutants: anyone may ask; a fork\'s branch dispatched; the check dispatched on the default branch)', { skip: BASH }, (t) => {
  const yml = WF('check-ask.yml');
  assert.equal(onOf(yml), 'on:\n  issue_comment:\n    types: [created]\n\n');
  assert.match(yml, /\n {4}if: github\.event\.issue\.pull_request && startsWith\(github\.event\.comment\.body, '\/check'\)\n/);
  assert.doesNotMatch(runBlock(yml, 'Dispatch the check on the pull request\'s branch'), /\$\{\{/, 'the comment reaches bash through the environment alone');
  assert.doesNotMatch(yml, /actions\/checkout/, 'no pull request\'s code is checked out under this token');
  const ok = askCheck(t);
  assert.deepEqual(ok.calls.map((c) => c.slice(0, 2).join(' ')), ['api repos/o/r/collaborators/someone/permission', 'api repos/o/r/pulls/12', 'workflow run', 'api -X']);
  assert.deepEqual(ok.calls[2], ['workflow', 'run', 'check.yml', '--repo', 'o/r', '--ref', 'feature/x'], 'the pull request\'s own branch');
  assert.ok(ok.calls[3].includes('repos/o/r/issues/comments/345/reactions') && ok.calls[3].includes('content=rocket'), 'a reaction says it was asked');
  assert.equal(ok.said, null, 'and nothing more');
  for (const permission of ['admin', 'maintain']) assert.ok(askCheck(t, { permission }).calls.some((c) => c[0] === 'workflow'), permission);
  for (const permission of ['read', 'triage', 'none']) {
    const no = askCheck(t, { permission });
    assert.ok(!no.calls.some((c) => c[0] === 'workflow'), `${permission}: nothing dispatched`);
    assert.match(no.said, /someone who can push here, and @someone cannot/);
    assert.ok(no.calls.some((c) => c.join(' ') === `api -X POST repos/o/r/issues/12/comments -F body=@${no.tmp}/say.md --silent`),
      `${permission}: said on the pull request's issue, by REST - the job holds issues: write, and GraphQL's addComment asks pull-requests: write`);
  }
  const fork = askCheck(t, { pull: { head: { repo: { full_name: 'stranger/r' }, ref: 'main', sha: 'a'.repeat(40) } } });
  assert.ok(!fork.calls.some((c) => c[0] === 'workflow'), 'a fork\'s branch is not this repository\'s');
  assert.match(fork.said, /`stranger\/r`'s - merge its base into it/);
  const closed = askCheck(t, { pull: { state: 'closed' } });
  assert.ok(!closed.calls.some((c) => c[0] === 'workflow'));
  assert.match(closed.said, /closed - nothing to check/);
  for (const body of ['/checkout', '/check please', 'please /check']) assert.deepEqual(askCheck(t, { body }).calls, [], `"${body}": nothing asked`);
  assert.ok(askCheck(t, { body: '/check\r\nthe tests again' }).calls.some((c) => c[0] === 'workflow'), 'the first line is the ask');
});

// ═══ DEV-ENV: MAIN, ON ITS OWN VM, INSIDE WIREGUARD ══════════════════════════════════════════════════════════════

test('DEV-ENV: the dev deploy is dispatched on main alone, in the dev environment; it builds the site to call the dev services home and ships nothing that does not; it passes only when the site, the relay and the account service answer with this commit, by name and over TLS through the network (mutants: the build unstamped; a deploy from any branch)', () => {
  const yml = WF('dev-deploy.yml');
  assert.equal(onOf(yml), 'on:\n  workflow_dispatch:\n\n');
  const [job] = jobsOf(yml);
  assert.match(job.text, /\n {4}environment: dev\n/);
  assert.ok(job.text.includes('    steps:\n      - name: Only main is the dev environment\'s\n        if: github.ref != \'refs/heads/main\'\n'), 'the door is the first step');
  assert.match(yml, /\n {6}DEV_HOST: dev\.daggerfalljs\.dev\n/);
  assert.match(yml, /VITE_DFO_RELAY: wss:\/\/\$\{\{ env\.DEV_HOST \}\}\/relay\n {10}VITE_DFO_ACCOUNTS: https:\/\/\$\{\{ env\.DEV_HOST \}\}\/accounts\n/, 'the stamp src/net/serviceHome.js reads');
  const build = runBlock(yml, 'Build the site for the dev environment');
  assert.match(build, /npm run build\nif ! grep -rqF "\$VITE_DFO_RELAY" dist\/assets \|\| ! grep -rqF "\$VITE_DFO_ACCOUNTS" dist\/assets; then\n[^\n]*\n {2}exit 1\n/);
  const answers = runBlock(yml, 'The dev environment answers with this commit');
  assert.match(answers, /grep -oP "\^export const RELAY_VERSION = '\\K\[\^'\]\+" src\/net\/wire\.js/);
  assert.match(answers, /grep -oP "\^export const ACCOUNT_VERSION = '\\K\[\^'\]\+" server-account\/src\/service\.js/);
  assert.match(answers, /--resolve "\$DEV_HOST:443:10\.66\.0\.1" "https:\/\/\$DEV_HOST\$1"/, 'by name, at the VM\'s network address');
  assert.doesNotMatch(answers, /\s-k\b|--insecure/, 'and over TLS that is checked');
  assert.match(yml, /\$ssh dfo@10\.66\.0\.1 "\$rel\/repo\/ops\/dev\/deploy\.sh" "\$GITHUB_SHA"/);
  for (const f of readdirSync(join(ROOT, 'ops/dev'))) assert.doesNotMatch(rd(`ops/dev/${f}`), /mackcothran|workers\.dev/, `ops/dev/${f} names a production service`);
});

test('DEV-ENV: the VM\'s parts agree - the Workers\' ports in their units, in Caddy and in the deploy\'s check; the crons it fires are the account service\'s own; the Caddyfile keeps each Worker\'s own doors off the network; the keys are made by the tools production\'s deploy uses, on the VM (mutants: a cron of its own; the explorer open to the network)', () => {
  const relay = rd('ops/dev/dfo-dev-relay.service'), accounts = rd('ops/dev/dfo-dev-accounts.service');
  const caddy = rd('ops/dev/Caddyfile'), deploy = rd('ops/dev/deploy.sh');
  for (const [unit, port, path, health] of [[relay, 8787, 'relay', '/health'], [accounts, 8788, 'accounts', '/v1/health']]) {
    assert.match(unit, new RegExp(`--ip 127\\.0\\.0\\.1 --port ${port} `), `${path}: on the loopback alone`);
    assert.match(unit, /\nUser=dfo\n/);
    assert.match(unit, /--persist-to \/var\/lib\/dfo-dev\/state /, 'the state outlives every release');
    assert.match(caddy, new RegExp(`handle_path /${path}/\\* \\{\\n\\t\\t@inner path /cdn-cgi/\\* /__\\*\\n\\t\\trespond @inner 404\\n\\t\\treverse_proxy 127\\.0\\.0\\.1:${port} \\{\\n\\t\\t\\theader_up Cf-Connecting-Ip \\{remote_host\\}\\n`), `${path}: proxied, its own doors refused`);
    assert.ok(deploy.includes(`http://127.0.0.1:${port}${health}`), `${path}: the deploy waits for it`);
  }
  assert.match(relay, /--var MOD_FEED_URL:http:\/\/127\.0\.0\.1:8788\/v1\/mod\/feed --var GRANT_FEED_URL:http:\/\/127\.0\.0\.1:8788\/v1\/mod\/grant-feed /, 'the relay\'s feeds are the dev account service\'s');
  assert.match(accounts, /--var RELAY_LAW_URL:http:\/\/127\.0\.0\.1:8787\/v1\/law /, 'and the service\'s law door the dev relay\'s');
  const crons = JSON.parse(/^crons = (\[[^\]]*\])$/m.exec(rd('server-account/wrangler.toml'))[1]);
  const fired = [...rd('ops/dev/dfo-dev-cron').matchAll(/__scheduled\?cron=([^']+)'/g)].map((m) => m[1].replace(/\+/g, ' '));
  assert.deepEqual(fired, crons, 'the dev environment fires the crons production\'s Worker is given');
  const boot = rd('ops/dev/bootstrap.sh');
  assert.match(boot, /node "\$HERE\/\.\.\/\.\.\/tools\/mintIdentityKeys\.mjs" --pipe/);
  assert.match(boot, /node "\$HERE\/\.\.\/\.\.\/tools\/mintGateKeys\.mjs" --pipe/);
  assert.match(rd('ops/dev/nftables.conf'), /\n\t\tudp dport 51820 accept\n\t\ttcp dport 80 accept\n\t\t@PUBLIC_SSH@\n\t\tiifname "wg0" tcp dport \{ 22, 443 \} accept\n/, 'from outside: WireGuard and the challenge; the rest from inside');
});

test('DEV-ENV: the members\' list is checked whole before any of it is applied - the committed one passes; a key, an address or a name that is not one, or one twice, is refused and the network left as it was; the members\' tool makes WireGuard\'s own keys and holds a member to the same rules (mutants: a stranger\'s address taken; a key twice)', { skip: BASH }, (t) => {
  const d = scratch(t, 'peers');
  const wgDir = join(d, 'wg');
  mkdirSync(wgDir);
  writeFileSync(join(wgDir, 'wg0.base'), '[Interface]\nAddress = 10.66.0.1/24\n');
  writeFileSync(join(wgDir, 'wg0.conf'), 'the network as it was\n');
  const bin = join(d, 'bin');
  mkdirSync(bin);
  for (const tool of ['wg', 'wg-quick']) { writeFileSync(join(bin, tool), '#!/bin/bash\necho "$0 $*" >> "$WG_CALLS"\n'); chmodSync(join(bin, tool), 0o755); }
  const apply = (list) => {
    const file = join(d, 'peers.json');
    writeFileSync(file, typeof list === 'string' ? list : JSON.stringify(list));
    return spawnSync('bash', [join(ROOT, 'ops/dev/dfo-dev-root'), 'peers', file], { encoding: 'utf8', env: { PATH: `${bin}:${process.env.PATH}`, DFO_DEV_WG_DIR: wgDir, WG_CALLS: join(d, 'calls') } });
  };
  const conf = () => readFileSync(join(wgDir, 'wg0.conf'), 'utf8');
  const a = wgKeyPair().publicKey, b = wgKeyPair().publicKey;
  for (const [list, why] of [
    [[{ name: 'a', key: a, ip: '10.66.0.2' }], /no member's address/],
    [[{ name: 'a', key: a, ip: '10.66.0.251' }], /no member's address/],
    [[{ name: 'a', key: a, ip: '10.66.0.07' }], /no member's address/],
    [[{ name: 'a', key: a, ip: '192.168.1.5' }], /no member's address/],
    [[{ name: 'a', key: 'not-a-key', ip: '10.66.0.10' }], /no WireGuard public key/],
    [[{ name: '-a', key: a, ip: '10.66.0.10' }], /is no name/],
    [[{ name: 'a\nb', key: a, ip: '10.66.0.10' }], /is no name/],
    [[{ name: 'a', key: a, ip: '10.66.0.10' }, { name: 'b', key: a, ip: '10.66.0.11' }], /key .* is a second member's too/],
    [[{ name: 'a', key: a, ip: '10.66.0.10' }, { name: 'b', key: b, ip: '10.66.0.10' }], /ip 10\.66\.0\.10 is a second member's too/],
    ['{"a": 1}', /no list of members/],
  ]) {
    const r = apply(list);
    assert.notEqual(r.status, 0, `${JSON.stringify(list)} was taken`);
    assert.match(r.stderr, why);
    assert.equal(conf(), 'the network as it was\n', 'nothing applied');
  }
  const ok = apply([{ name: 'Lattymoy', key: a, ip: '10.66.0.10' }, { name: 'admin-panel', key: b, ip: '10.66.0.3' }]);
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(conf(), `[Interface]\nAddress = 10.66.0.1/24\n\n# Lattymoy\n[Peer]\nPublicKey = ${a}\nAllowedIPs = 10.66.0.10/32\n\n# admin-panel\n[Peer]\nPublicKey = ${b}\nAllowedIPs = 10.66.0.3/32\n`);
  assert.match(readFileSync(join(d, 'calls'), 'utf8'), /wg syncconf wg0 /, 'applied without dropping a session');
  const committed = spawnSync('bash', [join(ROOT, 'ops/dev/dfo-dev-root'), 'peers', join(ROOT, 'ops/dev/peers.json')], { encoding: 'utf8', env: { PATH: `${bin}:${process.env.PATH}`, DFO_DEV_WG_DIR: wgDir, WG_CALLS: join(d, 'calls') } });
  assert.equal(committed.status, 0, `ops/dev/peers.json: ${committed.stderr}`);
  // the tool: X25519 as RFC 7748 has it (WireGuard's own), a member's config, the helper's rules
  const hex = (h) => Buffer.from(h, 'hex').toString('base64');
  assert.equal(wgPublicOf(hex('77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a')), hex('8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a'));
  const pair = wgKeyPair();
  assert.ok(WG_KEY_RE.test(pair.privateKey) && WG_KEY_RE.test(pair.publicKey) && wgPublicOf(pair.privateKey) === pair.publicKey);
  assert.equal(memberConfig({ privateKey: 'P', ip: '10.66.0.10', serverKey: 'S', endpoint: 'h:51820' }),
    '[Interface]\nPrivateKey = P\nAddress = 10.66.0.10/32\nDNS = 10.66.0.1\n\n[Peer]\nPublicKey = S\nEndpoint = h:51820\nAllowedIPs = 10.66.0.0/24\nPersistentKeepalive = 25\n');
  for (const ip of ['10.66.0.2', '10.66.0.251', '10.66.0.07', '10.66.1.10']) assert.ok(memberIpProblem(ip), ip);
  assert.equal(memberIpProblem('10.66.0.3'), null);
  const helper = rd('ops/dev/dfo-dev-root');
  assert.ok(helper.includes(`[[ "$name" =~ ${MEMBER_NAME_RE.source} ]]`), 'one rule for a name');
  assert.ok(helper.includes(`[[ "$key" =~ ${WG_KEY_RE.source} ]]`), 'one rule for a key');
  assert.ok(helper.includes(`-lt ${NETWORK.first} ]`) && helper.includes(`-gt ${NETWORK.last} ]`), 'one range of members');
});
