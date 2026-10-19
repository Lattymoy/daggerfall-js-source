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
import { readSettings, codeownersReviewers, planSettings, sameRuleset, notMainsOwn, ROLES } from '../../tools/repoSettings.mjs';
import { wgKeyPair, wgPublicOf, memberConfig, memberIpProblem, WG_KEY_RE, MEMBER_NAME_RE, NETWORK } from '../../tools/devPeer.mjs';
import { releaseLineProblem, previousReleaseTag } from '../../scripts/desktopRelease.mjs';

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
    '      */pulls\\?*) printf "%s\\n" "${FAKE_PULLS:-[]}" ;;',
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
  assert.deepEqual(settings.environments.production, { reviewers: 'releaseManagers', branches: ['release'], wait_timer: 0, prevent_self_review: false });
  assert.deepEqual(settings.environments['github-pages'], { reviewers: 'releaseManagers', branches: ['release'], wait_timer: 0, prevent_self_review: false });
  assert.deepEqual(settings.environments.dev, { reviewers: null, branches: ['main'], wait_timer: 0, prevent_self_review: false });
  assert.equal(onOf(WF('check.yml')), 'on:\n  pull_request:\n  push:\n    branches: [main]\n  workflow_dispatch:\n\n');
});

test('RELEASE-BRANCH: where release begins - the release before must stand on the first-parent line a release is cut from, since the update number counts that line and the notes read it from there: release branched at main\'s last release passes, and so does every release cut from release after it, a hotfix\'s and a promotion\'s; branched before it, both would repeat main\'s, so the desktop release and the site refuse, said; the release before is the newest a commit holds BY VERSION, whatever git\'s describe would call nearest (mutants: the line read as ancestry; the line unread; the refusal passed; the desktop release unasked; the site unasked; the release before by name; the release before by nearness)', { skip: BASH }, (t) => {
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
  git('tag', 'app-v0.1.10');                  // the hotfix, released
  merged(23, 'f3', 'main');
  promoted('release');
  assert.equal(previousReleaseTag('app-v0.1.12', run), 'app-v0.1.10', 'the newest BY VERSION - 10 after 4, where a sort by name puts 4 first');
  assert.equal(releaseLineProblem('app-v0.1.12', run), null, 'and a promotion\'s after that');
});

// ═══ ROLES: WHO REVIEWS, WHO RELEASES ═════════════════════════════════════════════════════════════════════════════

test('ROLES: the settings read whole and hold what the record says - the gates (the check from GitHub Actions, no deletion, no force push) bypassed by nobody, the reviews (one code owner\'s approval, a push dismisses it, never after the approver\'s own push) by the admins through a pull request alone; release merged into by the admins alone, by a merge commit alone (a promotion\'s notes are found through its second parent); a release tag never moved or deleted; the Actions token read-only by default; CODEOWNERS one rule naming the reviewers, in order (mutants: CODEOWNERS and the roles apart; a squash into release; the check bypassed with the review; a reviewer approving their own push; the check from any app; release merged into by any writer; a second CODEOWNERS rule read)', () => {
  const settings = readSettings(rd('ops/github/settings.json'));
  assert.deepEqual(codeownersReviewers(rd('.github/CODEOWNERS')), settings.roles.reviewers, 'CODEOWNERS is roles.reviewers');
  for (const role of ROLES) assert.ok(settings.roles[role].length > 0, role);
  assert.deepEqual(settings.actions, { default_workflow_permissions: 'read', can_approve_pull_request_reviews: true }, 'read by default; may open the back-merge');
  const set = (name) => settings.rulesets.find((r) => r.name === name);
  const ADMIN_BY_PR = [{ actor_id: 5, actor_type: 'RepositoryRole', bypass_mode: 'pull_request' }];
  for (const branch of ['main', 'release']) {
    const gate = set(`${branch}-gate`), review = set(`${branch}-review`);
    for (const r of [gate, review]) assert.deepEqual(r.conditions.ref_name, { include: [`refs/heads/${branch}`], exclude: [] });
    assert.deepEqual(gate.bypass_actors, [], `${branch}: nobody bypasses the gate - not the check, not a deletion, not a force push (AUDIT RELEASE-FLOW C1)`);
    assert.deepEqual(gate.rules.map((x) => x.type).sort(), ['deletion', 'non_fast_forward', 'required_status_checks']);
    assert.deepEqual(gate.rules.find((x) => x.type === 'required_status_checks').parameters,
      { strict_required_status_checks_policy: false, do_not_enforce_on_create: false, required_status_checks: [{ context: 'check', integration_id: 15368 }] }, `${branch}: the check, from GitHub Actions alone`);
    assert.deepEqual(review.bypass_actors, ADMIN_BY_PR, `${branch}: the admins skip a review, by a pull request alone`);
    const pr = review.rules.find((x) => x.type === 'pull_request').parameters;
    assert.deepEqual({ ...pr, allowed_merge_methods: undefined }, {
      required_approving_review_count: 1, dismiss_stale_reviews_on_push: true, require_code_owner_review: true,
      require_last_push_approval: true, required_review_thread_resolution: false, allowed_merge_methods: undefined,
    }, `${branch}: a code owner's approval, never after the approver's own push (C2)`);
  }
  assert.deepEqual(set('main-review').rules.map((x) => x.type), ['pull_request'], 'any writer merges a reviewed pull request into main');
  assert.deepEqual(set('main-review').rules[0].parameters.allowed_merge_methods, ['merge', 'squash', 'rebase']);
  assert.deepEqual(set('release-review').rules.map((x) => x.type).sort(), ['pull_request', 'update'], 'release is updated by its bypass alone - the admins, by a pull request (F3)');
  assert.deepEqual(set('release-review').rules.find((x) => x.type === 'pull_request').parameters.allowed_merge_methods, ['merge']);
  const tags = set('release-tags');
  assert.equal(tags.target, 'tag');
  assert.deepEqual(tags.conditions.ref_name.include, ['refs/tags/app-v*']);
  assert.deepEqual(tags.rules.map((x) => x.type).sort(), ['deletion', 'update'], 'a published release\'s tag is never moved or deleted - created, by the release');
  assert.deepEqual(settings.rulesets.map((r) => r.name).sort(), ['main-gate', 'main-review', 'release-gate', 'release-review', 'release-tags']);
  for (const [name, env] of Object.entries(settings.environments)) assert.equal(env.wait_timer, 0, name);
  assert.deepEqual([settings.environments.production.reviewers, settings.environments['github-pages'].reviewers, settings.environments.dev.reviewers], ['releaseManagers', 'releaseManagers', null]);
  // refused whole, before GitHub is asked
  const file = rd('ops/github/settings.json');
  assert.throws(() => readSettings(file.replace('"releaseManagers": ["Lattymoy"]', '"releaseManagers": []')), /releaseManagers names nobody/);
  assert.throws(() => readSettings(file.replace('"reviewers": "releaseManagers", "branches": ["release"], "wait_timer": 0', '"reviewers": "everyone", "branches": ["release"], "wait_timer": 0')), /is no role/);
  assert.throws(() => readSettings(file.replace('"releaseManagers": ["Lattymoy"]', `"releaseManagers": [${['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((x) => `"${x}"`).join(', ')}]`)), /GitHub takes 6 reviewers at most/, 'seven release managers (C7)');
  assert.throws(() => readSettings(file.replace('"wait_timer": 0, "prevent_self_review": false }', '"wait_timer": 43201, "prevent_self_review": false }')), /wait_timer is no number of minutes/);
  assert.throws(() => readSettings(file.replace('"bypass_mode": "always"', '"bypass_mode": "pull_request"')), /a tag ruleset has no pull request to bypass by/);
  // C4: GitHub applies a path's LAST matching pattern - one rule, or none read
  const owners = rd('.github/CODEOWNERS');
  for (const tail of ['* @mallory\n', '/.github/workflows/\n', '/src/ @mallory\n']) {
    assert.throws(() => codeownersReviewers(`${owners}${tail}`), /one rule, `\* @reviewer \.\.\.`, and nothing else - it holds 2/, tail.trim());
  }
});

/** GitHub, as `gh api` answers the plan: `state` its settings now. Every list read a hundred to a page (C6). */
const githubAs = (settings, state) => (method, path) => {
  const repo = settings.repository;
  const ids = { Lattymoy: 98724681, EdoardoBramini: 241148409 };
  assert.equal(method, 'GET', 'the plan only reads');
  if (path === `repos/${repo}`) return { private: state.private ?? false };
  const perm = /^repos\/[^/]+\/[^/]+\/collaborators\/([^/]+)\/permission$/.exec(path);
  if (perm) return { permission: (state.access ?? {})[perm[1]] ?? (perm[1] === 'Lattymoy' ? 'admin' : 'write') };
  const owners = /^repos\/[^/]+\/[^/]+\/contents\/\.github\/CODEOWNERS\?ref=(main|release)$/.exec(path);
  if (owners) {
    const text = (state.codeowners ?? {})[owners[1]];
    if (text === undefined) throw new Error('HTTP 404');
    return { content: Buffer.from(text).toString('base64') };
  }
  if (path === `repos/${repo}/actions/permissions/workflow`) return state.workflow;
  if (path.startsWith('users/')) return { id: ids[path.slice(6)] };
  if (path === `repos/${repo}/environments?per_page=100`) return { environments: state.environments };
  const pol = /^repos\/[^/]+\/[^/]+\/environments\/([^/]+)\/deployment-branch-policies\?per_page=100$/.exec(path);
  if (pol) return { branch_policies: state.policies[pol[1]] ?? state.policies[pol[1].toLowerCase()] ?? [] };
  if (path === `repos/${repo}/rulesets?per_page=100&includes_parents=false`) return state.rulesets.map(({ id, name }) => ({ id, name, source_type: 'Repository' }));
  const rs = /\/rulesets\/(\d+)$/.exec(path);
  if (rs) return state.rulesets.find((r) => r.id === Number(rs[1]));
  throw new Error(`asked ${path}`);
};

/** GitHub as it answers once the settings are set: reviewers by their whole record, its defaults beside the parameters. */
function heldAs(settings) {
  const ids = { Lattymoy: 98724681, EdoardoBramini: 241148409 };
  return {
    workflow: { ...settings.actions },
    environments: Object.entries(settings.environments).map(([name, env]) => ({
      name, deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
      protection_rules: [
        ...(env.reviewers ? [{ type: 'required_reviewers', prevent_self_review: env.prevent_self_review, reviewers: settings.roles[env.reviewers].map((l) => ({ type: 'User', reviewer: { login: l, id: ids[l] } })) }] : []),
        { type: 'branch_policy' },
      ],
    })),
    policies: Object.fromEntries(Object.entries(settings.environments).map(([name, env]) => [name, env.branches.map((b, i) => ({ id: i + 1, name: b, type: 'branch' }))])),
    rulesets: settings.rulesets.map((r, i) => ({
      ...structuredClone(r), id: 100 + i, source_type: 'Repository',
      rules: r.rules.map((x) => (x.type === 'pull_request' ? { ...x, parameters: { automatic_copilot_code_review_enabled: false, required_reviewers: [], ...x.parameters } } : structuredClone(x))),
    })),
  };
}

test('ROLES: the plan - a repository with nothing set gets every setting, in the order GitHub needs; one that holds them gets nothing; GitHub\'s own unset defaults are no difference, and everything the file sends is compared - a reviewer who may approve their own run, a wait, a narrowed merge, the check left to another app, a rule GitHub enforces on creation (AUDIT RELEASE-FLOW C3); an environment\'s name in any case is that environment (C6); a branch an environment no longer admits is taken off (mutants: the plan blind to a moved branch; a default read as a change; an undeclared parameter unseen; prevent_self_review unread; the wait unread; the check\'s app unread; an environment\'s name by case)', () => {
  const settings = readSettings(rd('ops/github/settings.json'));
  const repo = settings.repository;
  const ids = { Lattymoy: 98724681, EdoardoBramini: 241148409 };
  const plan = (state, opts) => planSettings(settings, githubAs(settings, state), opts);
  const paths = (p) => p.calls.map((c) => `${c.method} ${c.path.replace(`repos/${repo}/`, '')}`);
  const bare = plan({ workflow: { default_workflow_permissions: 'write', can_approve_pull_request_reviews: false }, environments: [], policies: {}, rulesets: [] });
  assert.deepEqual(paths(bare), [
    'PUT actions/permissions/workflow',
    'PUT environments/production', 'POST environments/production/deployment-branch-policies',
    'PUT environments/github-pages', 'POST environments/github-pages/deployment-branch-policies',
    'PUT environments/dev', 'POST environments/dev/deployment-branch-policies',
    'POST rulesets', 'POST rulesets', 'POST rulesets', 'POST rulesets', 'POST rulesets',
  ]);
  assert.deepEqual(bare.calls[1].body, { wait_timer: 0, prevent_self_review: false, reviewers: [{ type: 'User', id: ids.Lattymoy }], deployment_branch_policy: { protected_branches: false, custom_branch_policies: true } }, 'production asks the release managers');
  assert.deepEqual(bare.calls[5].body.reviewers, [], 'dev asks nobody');
  assert.deepEqual(bare.calls[2].body, { name: 'release', type: 'branch' });
  assert.deepEqual(paths(plan({ workflow: { default_workflow_permissions: 'write', can_approve_pull_request_reviews: false }, environments: [], policies: {}, rulesets: [] }, { rulesets: false })).filter((c) => c.includes('rulesets')), [],
    '--without-rulesets: the token and the environments alone (C8)');
  const held = heldAs(settings);
  assert.deepEqual(plan(held).calls, [], 'a repository that holds the settings is left alone');
  // every field the file sends, compared (C3)
  const variant = (fn) => { const h = structuredClone(held); fn(h); return paths(plan(h)); };
  const envOf = (h, name) => h.environments.find((e) => e.name === name);
  assert.deepEqual(variant((h) => { envOf(h, 'production').protection_rules[0].prevent_self_review = true; }), ['PUT environments/production'], 'a release manager kept from approving the run they started - with one, nothing ships');
  assert.deepEqual(variant((h) => { envOf(h, 'production').protection_rules.push({ type: 'wait_timer', wait_timer: 43200 }); }), ['PUT environments/production'], 'a month\'s wait');
  const ruleOf = (h, name, type) => h.rulesets.find((r) => r.name === name).rules.find((x) => x.type === type).parameters;
  assert.deepEqual(variant((h) => { ruleOf(h, 'main-review', 'pull_request').allowed_merge_methods = ['squash']; }), ['PUT rulesets/101'], 'main narrowed to squash');
  assert.deepEqual(variant((h) => { ruleOf(h, 'main-review', 'pull_request').required_reviewers = [{ minimum_approvals: 1 }]; }), ['PUT rulesets/101'], 'a parameter the file does not declare, set');
  assert.deepEqual(variant((h) => { ruleOf(h, 'main-gate', 'required_status_checks').required_status_checks = [{ context: 'check', integration_id: 999 }]; }), ['PUT rulesets/100'], 'the check left to another app');
  assert.deepEqual(variant((h) => { ruleOf(h, 'release-gate', 'required_status_checks').do_not_enforce_on_create = true; }), ['PUT rulesets/102']);
  assert.deepEqual(variant((h) => { h.rulesets[0].rules.push({ type: 'creation' }); }), ['PUT rulesets/100'], 'a rule the file does not declare is one');
  // C6: an environment's name in any case is that environment - neither made again nor left unmanaged
  const upper = structuredClone(held);
  envOf(upper, 'production').name = 'Production';
  upper.policies.Production = upper.policies.production;
  assert.deepEqual(plan(upper).calls, []);
  assert.deepEqual(plan(upper).unmanaged, []);
  const pagesFromMain = { ...held, policies: { ...held.policies, 'github-pages': [{ id: 7, name: 'main', type: 'branch' }] } };
  assert.deepEqual(paths(plan(pagesFromMain)), ['POST environments/github-pages/deployment-branch-policies', 'DELETE environments/github-pages/deployment-branch-policies/7'], 'Pages from release, and no more from main');
  const want = settings.rulesets[1];
  assert.equal(sameRuleset(held.rulesets[1], want), true);
  const looser = structuredClone(held.rulesets[1]);
  looser.rules.find((x) => x.type === 'pull_request').parameters.required_approving_review_count = 0;
  assert.equal(sameRuleset(looser, want), false, 'an approval taken off is a difference');
});

test('ROLES: nothing is applied while GitHub disagrees with the file about who holds a role, nor on a private repository; CODEOWNERS as main and release hold it is said; and `--apply` applies origin/main\'s files alone (AUDIT RELEASE-FLOW C4, C5, C7, C9; F4) (mutants: the roles unread on GitHub; a private repository planned; the apply of any checkout)', () => {
  const settings = readSettings(rd('ops/github/settings.json'));
  const owners = rd('.github/CODEOWNERS');
  const plan = (state) => planSettings(settings, githubAs(settings, { ...heldAs(settings), ...state }), { codeowners: owners });
  const clean = plan({ codeowners: { main: owners, release: owners } });
  assert.deepEqual([clean.problems, clean.notes, clean.calls], [[], [], []], 'GitHub and the file agree');
  assert.deepEqual(plan({ codeowners: { main: owners, release: owners }, access: { EdoardoBramini: 'read' } }).problems,
    ['roles.reviewers: EdoardoBramini holds read on GitHub, and the role needs admin or write'], 'a code owner without write access counts for nothing');
  assert.deepEqual(plan({ codeowners: { main: owners, release: owners }, access: { Lattymoy: 'write' } }).problems,
    ['roles.admins: Lattymoy holds write on GitHub, and the role needs admin'], 'roles.admins is GitHub\'s, checked');
  assert.match(plan({ codeowners: { main: owners, release: owners }, private: true }).problems[0], /is private: GitHub holds no environment reviewers/);
  assert.deepEqual(plan({ codeowners: { main: owners } }).notes, ['release holds no .github/CODEOWNERS: its pull requests ask no code owner until it does']);
  assert.deepEqual(plan({ codeowners: { main: owners, release: '* @Lattymoy\n' } }).notes, ['release\'s .github/CODEOWNERS is not this one: its pull requests are reviewed by the one it holds']);
  // C7: origin/main's files, or nothing applied
  const local = { 'ops/github/settings.json': 'S', '.github/CODEOWNERS': 'C' };
  assert.deepEqual(notMainsOwn(local, (p) => local[p]), []);
  assert.deepEqual(notMainsOwn(local, (p) => (p === '.github/CODEOWNERS' ? 'older' : local[p])), ['.github/CODEOWNERS']);
  assert.deepEqual(notMainsOwn(local, () => { throw new Error('no origin/main'); }), ['ops/github/settings.json', '.github/CODEOWNERS'], 'no main to read is no main\'s file');
  const cli = rd('tools/repoSettings.mjs');
  assert.match(cli, /const stale = notMainsOwn\(local\);\n {2}if \(stale\.length && apply\) \{\n[^\n]*\n {4}process\.exit\(1\);/, 'the CLI refuses to apply a checkout that is not main\'s');
  assert.match(cli, /if \(problems\.length\) \{\n[^\n]*\n[^\n]*\n {4}process\.exit\(1\);\n {2}\}\n[^\n]*\n {2}else if \(apply\) applySettings\(calls, ghApi\);/, 'and applies nothing over a problem');
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
    env: { PATH: `${bin}:${process.env.PATH}`, HOME: tmp, GITHUB_OUTPUT: out, RUNNER_TEMP: tmp, GITHUB_REPOSITORY: 'o/r', GITHUB_REPOSITORY_OWNER: 'o', GH_CALLS: join(tmp, 'calls'), ...env },
  });
  const outputs = Object.fromEntries(readFileSync(out, 'utf8').trim().split('\n').filter(Boolean).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
  return { ...r, outputs, calls: callsOf(join(tmp, 'calls')), tmp };
}

test('HOTFIX-BACK: every push to release or main, and a hand, asks what release holds that main lacks - a commit of its own main\'s history does not hold, or a change merging release would make to main\'s tree - so a promotion opens nothing, a hotfix opens the back-merge with its commits named, and a fix main holds another way - carried by hand, or a back-merge squashed - opens it again until main\'s history holds release\'s, after which the next promotion cannot conflict (AUDIT RELEASE-FLOW B3) (mutants: a promotion read as a lack; a conflict read as nothing; the history unasked; main\'s pushes unwatched)', { skip: BASH }, (t) => {
  assert.equal(onOf(WF('release-backmerge.yml')), 'on:\n  push:\n    branches: [release, main]\n  workflow_dispatch:\n\n', 'every update to release and to main, and by hand');
  const r = remote(t);
  const ask = () => backStep(t, r.runner(), 'What release has that main does not');
  const promotable = () => spawnSync('git', ['merge-tree', '--write-tree', 'release', 'main'], { cwd: r.origin }).status === 0;
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
  // the same fix carried to main by hand: the trees agree and the histories do not - main's next change to the line
  // would conflict at the promotion with no back-merge open (the experiment the audit ran), so it is a lack
  r.git(r.work, 'checkout', '-q', 'main');
  r.put('game.txt', 'one\nTWO\nthree\n'); r.commit('carried by hand');
  r.git(r.work, 'push', '-q', 'origin', 'main');
  assert.equal(ask().outputs.lack, 'yes', 'a fix main holds another way still comes back, as history');
  // a back-merge squashed is the same case; one merged with a merge commit ends it - and the promotion after is clean
  r.git(r.work, 'merge', '-q', '--squash', 'release');
  r.git(r.work, 'commit', '-qm', 'Back-merge release into main (#9)', '--allow-empty');
  r.git(r.work, 'push', '-q', 'origin', 'main');
  assert.equal(ask().outputs.lack, 'yes', 'a squashed back-merge opens the next');
  r.git(r.work, 'merge', '-q', '--no-ff', '-m', 'Merge pull request #10 from o/backmerge/release', 'release');
  r.git(r.work, 'push', '-q', 'origin', 'main');
  assert.equal(ask().outputs.lack, '', 'main\'s history holds release\'s: nothing to bring back');
  r.put('game.txt', 'one\nTWO!\nthree\n'); r.commit('main moves the line on');
  r.git(r.work, 'push', '-q', 'origin', 'main');
  assert.equal(ask().outputs.lack, '');
  assert.ok(promotable(), 'and the promotion cannot conflict');
  // main moved the same line another way and release fixes it again: the merge conflicts - a lack, for a person
  r.git(r.work, 'checkout', '-q', 'release');
  r.put('game.txt', 'one\nII\nthree\n'); r.commit('Fix it again');
  r.git(r.work, 'push', '-q', 'origin', 'release');
  got = ask();
  assert.equal(got.status, 0, got.stderr);
  assert.equal(got.outputs.lack, 'yes', 'a conflict is a lack');
  // main takes release's history keeping its own line; then a promotion resolved by hand carries a change of the
  // merge's own, and main moves that line another way: no commit of release's is missing from main, and the merge
  // conflicts - a lack all the same, asked of the trees
  r.git(r.work, 'checkout', '-q', 'main');
  r.git(r.work, 'merge', '-q', '--no-ff', '-s', 'ours', '-m', 'Merge pull request #11 from o/backmerge/release', 'release');
  r.git(r.work, 'push', '-q', 'origin', 'main');
  assert.equal(ask().outputs.lack, '', 'release\'s history held, its line not taken');
  r.git(r.work, 'checkout', '-q', 'release');
  r.git(r.work, 'merge', '-q', '--no-ff', '--no-commit', 'main');
  r.put('game.txt', 'one\nRELEASE-ONLY\nthree\n');
  r.git(r.work, 'commit', '-qam', 'Merge pull request #12 from o/main');
  r.git(r.work, 'push', '-q', 'origin', 'release');
  r.git(r.work, 'checkout', '-q', 'main');
  r.put('game.txt', 'one\nMAIN-ONLY\nthree\n'); r.commit('main moves it once more');
  r.git(r.work, 'push', '-q', 'origin', 'main');
  got = ask();
  assert.equal(got.outputs.lack, 'yes', 'a merge of release\'s own that conflicts with main');
  assert.match(readFileSync(join(got.tmp, 'commits.md'), 'utf8'), /none of its own: release's merges carry changes main does not/);
});

test('HOTFIX-BACK: the branch - set to release when no back-merge is open, never forced past a push it did not read; release MERGED INTO it when one is, keeping a resolution pushed there; a merge that conflicts, or that GitHub refuses this token, left to a person, said on the pull request and nothing pushed; a fork\'s branch of the same name never taken for the back-merge (AUDIT RELEASE-FLOW B2, B4) - then the pull request opened or brought up to date, telling its reviewer to approve its held check, and nothing dispatched that no pull request reads (B1) (mutants: release forced over an open branch; the conflict pushed; a fork\'s pull request taken; a refused push unsaid; forced past a push; the approval unsaid)', { skip: BASH }, (t) => {
  const r = remote(t);
  r.git(r.work, 'checkout', '-q', '-b', 'release', 'origin/release');
  r.put('fix.txt', 'fixed\n'); r.commit('Fix one');
  r.git(r.work, 'push', '-q', 'origin', 'release');
  const head = (ref) => execFileSync('git', ['rev-parse', ref], { cwd: r.origin, encoding: 'utf8' }).trim();
  const keep = (pulls, env = {}) => backStep(t, r.runner(), 'Keep backmerge/release level with release', { FAKE_PULLS: JSON.stringify(pulls), ...env });
  const ours = (n) => ({ number: n, head: { repo: { full_name: 'o/r' } } });
  // none open: the branch is release's head, whatever an old one held - and a stranger's fork of the name is not ours
  let got = keep([{ number: 77, head: { repo: { full_name: 'stranger/r' } } }]);
  assert.equal(got.status, 0, got.stderr);
  assert.equal(got.outputs.pr, '', 'a fork\'s backmerge/release is not the back-merge');
  assert.equal(head('backmerge/release'), head('release'));
  assert.deepEqual(got.calls.map((c) => c.slice(0, 2)), [['api', 'repos/o/r/pulls?state=open&base=main&head=o:backmerge/release&per_page=100']], 'this repository\'s owner\'s branch, asked by REST');
  // never forced past a push this run did not read
  const stale = r.runner();
  r.git(r.work, 'fetch', '-q', 'origin');
  r.git(r.work, 'checkout', '-q', '-b', 'backmerge/release', 'origin/backmerge/release');
  r.put('someone.txt', 'pushed meanwhile\n'); r.commit('a push since');
  r.git(r.work, 'push', '-q', 'origin', 'backmerge/release');
  const theirs = head('backmerge/release');
  got = backStep(t, stale, 'Keep backmerge/release level with release', { FAKE_PULLS: '[]' });
  assert.notEqual(got.status, 0, 'the lease refuses');
  assert.equal(head('backmerge/release'), theirs, 'their push stands');
  // one open, and someone resolved a conflict on it: release is merged in, the resolution kept
  r.put('resolution.txt', 'by hand\n'); r.commit('Merge main into backmerge/release');
  r.git(r.work, 'push', '-q', 'origin', 'backmerge/release');
  const resolved = head('backmerge/release');
  r.git(r.work, 'checkout', '-q', 'release');
  r.put('fix2.txt', 'fixed\n'); r.commit('Fix two');
  r.git(r.work, 'push', '-q', 'origin', 'release');
  got = keep([{ number: 77, head: { repo: { full_name: 'stranger/r' } } }, ours(41)]);
  assert.equal(got.status, 0, got.stderr);
  assert.equal(got.outputs.pr, '41', 'ours, after a stranger\'s');
  const ancestor = (a, b) => spawnSync('git', ['merge-base', '--is-ancestor', a, b], { cwd: r.origin }).status === 0;
  assert.ok(ancestor(resolved, head('backmerge/release')) && ancestor(head('release'), head('backmerge/release')), 'both kept: the resolution and release');
  // GitHub refuses the push (a workflow file this token may not write): said, nothing pushed, the run green
  const hook = join(r.origin, 'hooks', 'pre-receive');
  writeFileSync(hook, '#!/bin/sh\nwhile read old new ref; do [ "$ref" = refs/heads/backmerge/release ] && { echo "refusing to allow a GitHub App to create or update workflow" >&2; exit 1; }; done\nexit 0\n');
  chmodSync(hook, 0o755);
  let before = head('backmerge/release');
  r.put('fix3.txt', 'fixed\n'); r.commit('Fix three');
  r.git(r.work, 'push', '-q', 'origin', 'release');
  got = keep([ours(41)]);
  assert.equal(got.status, 0, got.stderr);
  assert.equal(got.outputs.conflict, 'yes');
  assert.equal(head('backmerge/release'), before);
  assert.deepEqual(got.calls.at(-1).slice(0, 3), ['pr', 'comment', '41'], 'said on the pull request');
  rmSync(hook);
  // release moves the resolved file another way: the merge conflicts - said, nothing pushed
  before = head('backmerge/release');
  r.put('resolution.txt', 'release says otherwise\n'); r.commit('Fix four');
  r.git(r.work, 'push', '-q', 'origin', 'release');
  got = keep([ours(41)]);
  assert.equal(got.status, 0, got.stderr);
  assert.equal(got.outputs.conflict, 'yes');
  assert.equal(head('backmerge/release'), before, 'nothing pushed over the branch');
  assert.deepEqual(got.calls.at(-1).slice(0, 3), ['pr', 'comment', '41'], 'said on the pull request');
  // the pull request: opened when none is, its body naming the commits; brought up to date when one is
  const commits = scratch(t, 'c');
  writeFileSync(join(commits, 'commits.md'), '- abc1234 Fix one\n');
  const open = backStep(t, r.runner(), 'The pull request into main', { PR: '', RUNNER_TEMP: commits });
  assert.equal(open.status, 0, open.stderr);
  assert.deepEqual(open.calls[0].slice(0, 6), ['pr', 'create', '--repo', 'o/r', '--base', 'main']);
  assert.ok(open.calls[0].includes('backmerge/release'));
  const body = readFileSync(join(commits, 'body.md'), 'utf8');
  assert.match(body, /\n- abc1234 Fix one\n/);
  assert.match(body, /\*\*Its check waits for you\.\*\* GitHub holds the `check` of a pull request that a workflow opened or pushed until\nsomeone who can push here approves it: \*Approve workflows to run\*/, 'the held run named, and how to start it');
  assert.match(body, /\*\*Merge it with a merge commit, not a squash\*\*/);
  assert.doesNotMatch(body, /^#+ *patch[ -]?notes/im, 'a back-merge carries no patch notes - its fix\'s release did');
  const edit = backStep(t, r.runner(), 'The pull request into main', { PR: '41', RUNNER_TEMP: commits });
  assert.deepEqual(edit.calls[0].slice(0, 3), ['pr', 'edit', '41']);
  const yml = WF('release-backmerge.yml');
  assert.doesNotMatch(yml, /gh workflow run/, 'nothing dispatched: GitHub reads no dispatched run\'s check for a pull request');
  const job = jobsOf(yml)[0].text;
  assert.match(job, /\n {4}permissions:\n {6}contents: write[^\n]*\n {6}pull-requests: write[^\n]*\n {4}env:\n/, 'and no `actions` to dispatch with');
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

test('CHECK-ASK: `/check` from someone who can push dispatches check.yml on the pull request\'s own branch and says so with a reaction; a reader is answered by a reaction alone (AUDIT RELEASE-FLOW B6), a fork\'s pull request told why it cannot be, a closed one that it is closed; a comment that is not `/check` asks nothing, and a long one asks as a short one does; nothing of the comment is pasted into the script (mutants: anyone may ask; a fork\'s branch dispatched; the check dispatched on the default branch; the answer by GraphQL; a reader commented on; the first line by a pipe)', { skip: BASH }, (t) => {
  const yml = WF('check-ask.yml');
  assert.equal(onOf(yml), 'on:\n  issue_comment:\n    types: [created]\n\n');
  assert.match(yml, /\n {4}if: github\.event\.issue\.pull_request && startsWith\(github\.event\.comment\.body, '\/check'\)\n/);
  assert.doesNotMatch(runBlock(yml, 'Dispatch the check on the pull request\'s branch'), /\$\{\{/, 'the comment reaches bash through the environment alone');
  assert.doesNotMatch(yml, /actions\/checkout/, 'no pull request\'s code is checked out under this token');
  const ok = askCheck(t);
  assert.deepEqual(ok.calls.map((c) => c.slice(0, 2).join(' ')), ['api repos/o/r/collaborators/someone/permission', 'api repos/o/r/pulls/12', 'workflow run', 'api -X']);
  assert.deepEqual(ok.calls[2], ['workflow', 'run', 'check.yml', '--repo', 'o/r', '--ref', 'feature/x'], 'the pull request\'s own branch');
  assert.deepEqual(ok.calls[3], ['api', '-X', 'POST', 'repos/o/r/issues/comments/345/reactions', '-f', 'content=rocket', '--silent'], 'a reaction says it was asked');
  assert.equal(ok.said, null, 'and nothing more');
  for (const permission of ['admin', 'maintain']) assert.ok(askCheck(t, { permission }).calls.some((c) => c[0] === 'workflow'), permission);
  for (const permission of ['read', 'triage', 'none']) {
    const no = askCheck(t, { permission });
    assert.ok(!no.calls.some((c) => c[0] === 'workflow'), `${permission}: nothing dispatched`);
    assert.equal(no.said, null, `${permission}: no comment - anyone could make the bot speak (B6)`);
    assert.deepEqual(no.calls.at(-1), ['api', '-X', 'POST', 'repos/o/r/issues/comments/345/reactions', '-f', 'content=-1', '--silent'], `${permission}: a reaction alone`);
  }
  const fork = askCheck(t, { pull: { head: { repo: { full_name: 'stranger/r' }, ref: 'main', sha: 'a'.repeat(40) } } });
  assert.ok(!fork.calls.some((c) => c[0] === 'workflow'), 'a fork\'s branch is not this repository\'s');
  assert.match(fork.said, /`stranger\/r`'s - merge its base into it/);
  assert.ok(fork.calls.some((c) => c.join(' ') === `api -X POST repos/o/r/issues/12/comments -F body=@${fork.tmp}/say.md --silent`),
    'said on the pull request\'s issue, by REST - the job holds issues: write, and GraphQL\'s addComment asks pull-requests: write');
  const closed = askCheck(t, { pull: { state: 'closed' } });
  assert.ok(!closed.calls.some((c) => c[0] === 'workflow'));
  assert.match(closed.said, /closed - nothing to check/);
  for (const body of ['/checkout', '/check please', 'please /check']) assert.deepEqual(askCheck(t, { body }).calls, [], `"${body}": nothing asked`);
  assert.ok(askCheck(t, { body: '/check\r\nthe tests again' }).calls.some((c) => c[0] === 'workflow'), 'the first line is the ask');
  assert.ok(askCheck(t, { body: '/check  \t\r\n' }).calls.some((c) => c[0] === 'workflow'), 'trailing space aside');
  assert.ok(askCheck(t, { body: `/check\n${'a pasted log line\n'.repeat(5000)}` }).calls.some((c) => c[0] === 'workflow'), 'a 90 KB comment asks as a short one does (B6)');
});

test('CHECK-ASK: check.yml says a dispatched run\'s result on its commit as `check (asked)` - pending when it begins, success or failure as its parts end - because GitHub reads no check a dispatched run reports for a pull request (AUDIT RELEASE-FLOW B1); its runs are grouped by event too, so a `/check` never cancels main\'s own (B5); and every check of a change holds the hosts to their ceilings, a deploy\'s never (F1) (mutants: the asked run silent; the asked run named the required check; a dispatch cancelling main\'s check; the ceilings off for a check; a deploy held to them; the ceiling told by the event)', { skip: BASH }, (t) => {
  const yml = WF('check.yml');
  assert.match(yml, /\nconcurrency:\n {2}group: check-\$\{\{ github\.event_name \}\}-\$\{\{ github\.event\.pull_request\.number \|\| github\.ref \}\}\n {2}cancel-in-progress: true\n/);
  const jobs = Object.fromEntries(jobsOf(yml).map((j) => [j.name, j.text]));
  assert.match(jobs.asked, /\n {4}if: github\.event_name == 'workflow_dispatch'\n/);
  assert.match(jobs.answered, /\n {4}if: \$\{\{ always\(\) && github\.event_name == 'workflow_dispatch' \}\}\n {4}needs: \[verify\]\n/);
  for (const name of ['asked', 'answered']) assert.match(jobs[name], /\n {4}permissions:\n {6}statuses: write\n/, `${name}: a status, and nothing more`);
  /** A status job's script, run as the runner runs it against a gh that records: the call it made. */
  const said = (script, env = {}) => {
    const tmp = scratch(t, 'status');
    const bin = fakeGh(tmp);
    const r = spawnSync('bash', ['-e', '-c', script], {
      encoding: 'utf8', env: { PATH: `${bin}:${process.env.PATH}`, GITHUB_REPOSITORY: 'o/r', GITHUB_SHA: 'f'.repeat(40), GITHUB_SERVER_URL: 'https://github.com', GITHUB_RUN_ID: '9', GH_CALLS: join(tmp, 'calls'), ...env },
    });
    assert.equal(r.status, 0, r.stderr);
    return callsOf(join(tmp, 'calls'))[0];
  };
  const status = (call) => Object.fromEntries(call.filter((_, i) => call[i - 1] === '-f').map((kv) => [kv.slice(0, kv.indexOf('=')), kv.slice(kv.indexOf('=') + 1)]));
  const begun = said(/\n {8}run: (gh api [^\n]+)\n/.exec(jobs.asked)[1]);
  assert.equal(begun[3], `repos/o/r/statuses/${'f'.repeat(40)}`, 'on the commit the run checks');
  assert.deepEqual(status(begun), { state: 'pending', context: 'check (asked)', description: 'the whole check, asked by /check', target_url: 'https://github.com/o/r/actions/runs/9' });
  const done = (result) => said(runBlock(jobs.answered, 'Said as done'), { RESULT: result });
  assert.deepEqual(status(done('success')), { state: 'success', context: 'check (asked)', description: 'the whole check: success', target_url: 'https://github.com/o/r/actions/runs/9' });
  for (const result of ['failure', 'cancelled', 'skipped']) assert.equal(status(done(result)).state, 'failure', result);
  // F1: the ceilings, said by the caller
  const verify = WF('verify.yml');
  assert.match(verify, /\n {6}ceilings:\n(?: {8}#[^\n]*\n)* {8}description: [^\n]+\n {8}type: boolean\n {8}default: true\n/);
  assert.match(verify, /- name: Test shard \$\{\{ matrix\.shard \}\} of 8\n {8}env:\n {10}DFO_HOST_CEILINGS: \$\{\{ inputs\.ceilings && '1' \|\| '0' \}\}\n/);
  assert.doesNotMatch(jobs.verify, /ceilings/, 'a change\'s check keeps them on');
  for (const f of ['deploy.yml', 'relay-deploy.yml', 'account-deploy.yml', 'release-desktop.yml']) {
    assert.match(WF(f), /uses: \.\/\.github\/workflows\/verify\.yml\n {4}with:\n(?: {6}[^\n]*\n)*? {6}ceilings: false/, `${f}: a deploy is never held by a ceiling`);
  }
  assert.match(rd('test/scenes/hostceiling.test.js'), /^const GATED = process\.env\.DFO_HOST_CEILINGS !== '0';$/m);
  assert.doesNotMatch(rd('test/scenes/hostceiling.test.js'), /GITHUB_EVENT_NAME\b(?!, which)/, 'never told by the event');
});

// ═══ DEV-ENV: MAIN, ON ITS OWN VM, INSIDE WIREGUARD ══════════════════════════════════════════════════════════════

test('DEV-ENV: the dev deploy is dispatched on main alone, in the dev environment; it builds the site to call the dev services home and ships nothing that does not - its stamps asked of the client\'s own laws before anything is built (AUDIT RELEASE-FLOW E1); it passes only when the site, the relay and the account service answer with this commit, by name and over TLS through the network (mutants: the build unstamped; a deploy from any branch; the stamps unasked)', { skip: BASH }, (t) => {
  const yml = WF('dev-deploy.yml');
  assert.equal(onOf(yml), 'on:\n  workflow_dispatch:\n\n');
  const [job] = jobsOf(yml);
  assert.match(job.text, /\n {4}environment: dev\n/);
  assert.ok(job.text.includes('    steps:\n      - name: Only main is the dev environment\'s\n        if: github.ref != \'refs/heads/main\'\n'), 'the door is the first step');
  assert.match(yml, /\n {6}DEV_HOST: dev\.daggerfalljs\.dev\n/);
  assert.match(yml, /VITE_DFO_RELAY: wss:\/\/\$\{\{ env\.DEV_HOST \}\}\/relay\n {10}VITE_DFO_ACCOUNTS: https:\/\/\$\{\{ env\.DEV_HOST \}\}\/accounts\n/, 'the stamp src/net/serviceHome.js reads');
  const build = runBlock(yml, 'Build the site for the dev environment');
  assert.match(build, /npm run build\nif ! grep -rqF "\$VITE_DFO_RELAY" dist\/assets \|\| ! grep -rqF "\$VITE_DFO_ACCOUNTS" dist\/assets; then\n[^\n]*\n {2}exit 1\n/);
  // the step run as the runner runs it, `npm` a stand-in that marks it was reached: a stamp the client refuses builds nothing
  const asked = (relay, accounts) => {
    const tmp = scratch(t, 'stamp');
    mkdirSync(join(tmp, 'bin'));
    writeFileSync(join(tmp, 'bin', 'npm'), '#!/bin/bash\ntouch "$BUILT"\nexit 1\n');
    chmodSync(join(tmp, 'bin', 'npm'), 0o755);
    const r = spawnSync('bash', ['-e', '-c', build], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, PATH: `${join(tmp, 'bin')}:${process.env.PATH}`, BUILT: join(tmp, 'built'), VITE_DFO_RELAY: relay, VITE_DFO_ACCOUNTS: accounts } });
    return { built: existsSync(join(tmp, 'built')), status: r.status };
  };
  const [relay, accounts] = ['wss://dev.daggerfalljs.dev/relay', 'https://dev.daggerfalljs.dev/accounts'];
  assert.equal(asked(relay, accounts).built, true, 'the stamps the workflow writes are the client\'s own');
  for (const [r, a] of [['ws://10.66.0.1:8787', accounts], [relay, 'http://10.66.0.1:8788'], [`${relay}/`, accounts], [relay, `${accounts}/`], ['', accounts]]) {
    const run = asked(r, a);
    assert.ok(!run.built && run.status !== 0, `${r} and ${a}: refused before the build`);
  }
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
