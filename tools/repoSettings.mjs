// ROLES (RELEASE-FLOW, 2026-10-19, bible/01-Overview/Release-Flow.md): THE REPOSITORY'S SETTINGS ARE CODE.
//
//   node tools/repoSettings.mjs                             what would change - ops/github/settings.json against GitHub's own
//   node tools/repoSettings.mjs --apply                     and change it, as origin/main declares it (this checkout's two
//                                                           files must be origin/main's: `git fetch origin` first)
//   node tools/repoSettings.mjs --apply --without-rulesets  the Actions token and the environments alone - the cut-over's
//                                                           first apply, before release is brought to main
//
// ops/github/settings.json declares who holds which role, the environments the workflows run in and the rules on main,
// release and the release tags; .github/CODEOWNERS names its reviewers (test/tooling/releaseflow.test.js holds the two
// together). A workflow's own token cannot change a repository's settings, and an admin's token kept in CI would hand
// them to any workflow that read it - so this runs on an admin's machine, as that admin (`gh auth login`, once), after a
// change to the file is merged, the way the account deploy writes Discord's settings from the tree (DISCORD-CODE). It
// changes what the file declares and nothing else: a ruleset or an environment it does not name is left as it stands,
// and said. And it applies nothing while GitHub disagrees with the file about WHO holds a role - that is not a setting
// it can change - nor on a private repository, where an account's plan holds no environment reviewers.
//
// The roles, as GitHub can hold them in a repository a personal account owns (no teams and no custom roles - those are
// an organization's):
//   admins           the repository's admins - on an account's own repository, the account alone. The one role that may
//                    bypass a REVIEW (the *-review rulesets: a pull request without a code owner's approval) and the one
//                    that merges into release (release-review's `update`), each by a pull request alone; nobody bypasses
//                    a GATE (the *-gate rulesets: the check, no deletion, no force push)
//   releaseManagers  the required reviewers of `production` and `github-pages`: no production job runs without one's
//                    approval (GitHub's "allow administrators to bypass" stands on an environment as well - the admins
//                    are release managers here)
//   reviewers        .github/CODEOWNERS: GitHub asks them for a review on every pull request, and main and release
//                    merge only with one's approval - never their own, and never after a push of their own (C2)
// The dev network's members are ops/dev/peers.json's (DEV-ENV), each by the WireGuard key they made themselves.
//
// AUDIT RELEASE-FLOW C1-C9, F3, F4 (bible/01-Overview/audits/Audit-Release-Flow.md): the bypass and the check were one
// ruleset, so a bypass skipped the check (C1 - split into gates and reviews); the plan compared some of what it sent
// and called the rest in sync (C3); the roles were read and never checked against GitHub (C5, F4); CODEOWNERS was read
// at its first `*` where GitHub applies the last match (C4); lists were read one page deep and environment names by
// case (C6); seven release managers passed where GitHub takes six, and any checkout was applied (C7).
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { isMain } from './lib/isMain.mjs';

export const SETTINGS_FILE = 'ops/github/settings.json';
export const CODEOWNERS_FILE = '.github/CODEOWNERS';
/** The roles the file declares, each a list of GitHub logins. */
export const ROLES = Object.freeze(['admins', 'releaseManagers', 'reviewers']);
/** The access each role needs, as `collaborators/{login}/permission` names it (maintain reads as write there). */
export const ROLE_ACCESS = Object.freeze({ admins: ['admin'], reviewers: ['admin', 'write'], releaseManagers: ['admin', 'write', 'read'] });
/** GitHub's limit on an environment's required reviewers. */
export const ENV_REVIEWERS_MAX = 6;
/** A GitHub login: letters, digits and single hyphens, at most 39 characters. */
const LOGIN_RE = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

/** The declared settings, read and checked - a file that cannot be applied is refused whole, before GitHub is asked. */
export function readSettings(text) {
  const s = JSON.parse(text);
  const fail = (why) => { throw new Error(`${SETTINGS_FILE}: ${why}`); };
  if (!/^[\w.-]+\/[\w.-]+$/.test(s.repository ?? '')) fail('names no repository');
  for (const role of ROLES) {
    const who = s.roles?.[role];
    if (!Array.isArray(who) || who.length === 0) fail(`roles.${role} names nobody`);
    for (const login of who) if (!LOGIN_RE.test(login)) fail(`roles.${role}: "${login}" is no GitHub login`);
  }
  if (!['read', 'write'].includes(s.actions?.default_workflow_permissions) || typeof s.actions?.can_approve_pull_request_reviews !== 'boolean') fail('actions is incomplete');
  for (const [name, env] of Object.entries(s.environments ?? {})) {
    if (env.reviewers !== null && !ROLES.includes(env.reviewers)) fail(`environments.${name}.reviewers is no role`);
    if (env.reviewers && s.roles[env.reviewers].length > ENV_REVIEWERS_MAX) fail(`environments.${name}: GitHub takes ${ENV_REVIEWERS_MAX} reviewers at most, and ${env.reviewers} names ${s.roles[env.reviewers].length}`);
    if (!Array.isArray(env.branches) || env.branches.length === 0) fail(`environments.${name} admits no branch`);
    if (!Number.isInteger(env.wait_timer) || env.wait_timer < 0 || env.wait_timer > 43200) fail(`environments.${name}.wait_timer is no number of minutes from 0 to 43,200`);
    if (typeof env.prevent_self_review !== 'boolean') fail(`environments.${name}.prevent_self_review is no boolean`);
  }
  for (const r of s.rulesets ?? []) {
    if (!r.name || !['branch', 'tag'].includes(r.target) || !Array.isArray(r.rules) || !r.conditions?.ref_name?.include?.length) fail(`ruleset "${r.name ?? '?'}" is incomplete`);
    if (r.target !== 'branch' && (r.bypass_actors ?? []).some((a) => a.bypass_mode === 'pull_request')) fail(`ruleset "${r.name}": a ${r.target} ruleset has no pull request to bypass by`);
  }
  return s;
}

/** The logins CODEOWNERS names, from its one rule: `*`, every path. AUDIT RELEASE-FLOW C4: GitHub applies the LAST
 *  pattern a path matches, so a second rule - a later `*`, or a path with other owners or none - would quietly take
 *  paths from the reviewers; the file holds the one rule or it is refused. */
export function codeownersReviewers(text) {
  const rules = String(text).split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  if (rules.length !== 1 || !/^\*\s+@/.test(rules[0])) throw new Error(`${CODEOWNERS_FILE}: one rule, \`* @reviewer ...\`, and nothing else - it holds ${rules.length}`);
  return rules[0].split(/\s+/).slice(1).map((o) => o.replace(/^@/, ''));
}

const sorted = (xs) => [...xs].sort();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** What GitHub answers for a parameter nobody set. */
const unset = (v) => v === undefined || v === null || v === false || v === 0 || v === '' || (Array.isArray(v) && v.length === 0);
/** A parameter's value in a form two answers compare by: lists unordered, a check with the app that must report it. */
const norm = (key, v) => {
  if (key === 'required_status_checks') return sorted((v ?? []).map((c) => `${c.context}@${c.integration_id ?? ''}`));
  return Array.isArray(v) ? sorted(v.map(String)) : v;
};

/** Does a ruleset GitHub holds say what the declared one says? Every parameter GitHub answers is compared: one the file
 *  declares by its value, one it does not by being unset - so a hand change to any of them is a difference, and the PUT
 *  that follows sets it back (AUDIT RELEASE-FLOW C3: only the declared ones were compared, and a ruleset narrowed to
 *  squash merges, or holding its check for another app, read as in sync). A rule the file does not declare is one too. */
export function sameRuleset(have, want) {
  if (have.target !== want.target || have.enforcement !== want.enforcement) return false;
  const refs = (r) => ({ include: sorted(r?.conditions?.ref_name?.include ?? []), exclude: sorted(r?.conditions?.ref_name?.exclude ?? []) });
  if (!same(refs(have), refs(want))) return false;
  const actors = (r) => sorted((r.bypass_actors ?? []).map((a) => `${a.actor_type}:${a.actor_id}:${a.bypass_mode}`));
  if (!same(actors(have), actors(want))) return false;
  if (!same(sorted((have.rules ?? []).map((r) => r.type)), sorted(want.rules.map((r) => r.type)))) return false;
  for (const rule of want.rules) {
    const held = (have.rules ?? []).find((r) => r.type === rule.type)?.parameters ?? {};
    const declared = rule.parameters ?? {};
    for (const key of new Set([...Object.keys(declared), ...Object.keys(held)])) {
      if (!(key in declared)) {
        if (!unset(held[key])) return false;
      } else if (!same(norm(key, held[key]), norm(key, declared[key]))) return false;
    }
  }
  return true;
}

/** A role's holders whose access on GitHub is not the role's (ROLE_ACCESS), each said. */
function roleProblems(settings, api) {
  const repo = settings.repository;
  const problems = [];
  const access = new Map();
  for (const role of ROLES) {
    for (const login of settings.roles[role]) {
      if (!access.has(login)) access.set(login, api('GET', `repos/${repo}/collaborators/${login}/permission`)?.permission ?? 'none');
      if (!ROLE_ACCESS[role].includes(access.get(login))) problems.push(`roles.${role}: ${login} holds ${access.get(login)} on GitHub, and the role needs ${ROLE_ACCESS[role].join(' or ')}`);
    }
  }
  return problems;
}

/** CODEOWNERS as main and release hold it on GitHub, against this one: a pull request is reviewed by its BASE branch's
 *  file, so release takes a change to the reviewers at its next promotion (AUDIT RELEASE-FLOW C4) - said, never applied. */
function codeownersNotes(repo, local, api) {
  const notes = [];
  for (const branch of ['main', 'release']) {
    let held = null;
    try {
      const answer = api('GET', `repos/${repo}/contents/${CODEOWNERS_FILE}?ref=${branch}`);
      held = answer?.content ? Buffer.from(answer.content, 'base64').toString('utf8') : null;
    } catch { /* no such file on the branch */ }
    if (held === null) notes.push(`${branch} holds no ${CODEOWNERS_FILE}: its pull requests ask no code owner until it does`);
    else if (held !== local) notes.push(`${branch}'s ${CODEOWNERS_FILE} is not this one: its pull requests are reviewed by the one it holds`);
  }
  return notes;
}

/**
 * What applying the settings would do: `calls`, each one call of GitHub's REST API in the order it must be made
 * ({ what, method, path, body? }); `unmanaged`, what GitHub holds that the file does not name; `problems`, why nothing
 * may be applied (a role GitHub does not give its holders, a private repository); and `notes`. Asked of
 * `api(method, path)` - gh by default, a fake in the tests - which it only reads; `applySettings` makes the calls.
 * `rulesets: false` plans the Actions token and the environments alone (the cut-over's first apply).
 */
export function planSettings(settings, api, { rulesets: withRulesets = true, codeowners = null } = {}) {
  const repo = settings.repository;
  const calls = [];
  const unmanaged = [];
  const problems = [];
  const notes = [];

  // AUDIT RELEASE-FLOW C9: on an account's plan, environment reviewers and wait timers are a public repository's alone
  if (api('GET', `repos/${repo}`)?.private) problems.push(`${repo} is private: GitHub holds no environment reviewers for a private repository on an account's plan, so production would wait for nobody`);
  problems.push(...roleProblems(settings, api));
  if (codeowners !== null) notes.push(...codeownersNotes(repo, codeowners, api));

  const wf = api('GET', `repos/${repo}/actions/permissions/workflow`);
  const actions = settings.actions;
  if (wf?.default_workflow_permissions !== actions.default_workflow_permissions || wf?.can_approve_pull_request_reviews !== actions.can_approve_pull_request_reviews) {
    calls.push({ what: `the Actions token: ${actions.default_workflow_permissions} by default; ${actions.can_approve_pull_request_reviews ? 'may' : 'may not'} open and approve a pull request (release-backmerge.yml opens one; no approval of a workflow's counts for a code owner's)`, method: 'PUT', path: `repos/${repo}/actions/permissions/workflow`, body: actions });
  }

  const ids = new Map();
  const idOf = (login) => {
    if (!ids.has(login)) ids.set(login, api('GET', `users/${login}`).id);
    return ids.get(login);
  };
  // AUDIT RELEASE-FLOW C6: a hundred to a page, and an environment's name as GitHub reads it - in any case
  const held = new Map((api('GET', `repos/${repo}/environments?per_page=100`)?.environments ?? []).map((e) => [e.name.toLowerCase(), e]));
  for (const [name, env] of Object.entries(settings.environments ?? {})) {
    const who = env.reviewers ? settings.roles[env.reviewers] : [];
    const reviewers = who.map((login) => ({ type: 'User', id: idOf(login) }));
    const have = held.get(name.toLowerCase());
    const rules = have?.protection_rules ?? [];
    const asks = rules.find((r) => r.type === 'required_reviewers');
    const haveIds = asks?.reviewers?.map((r) => r.reviewer?.id) ?? [];
    const haveWait = rules.find((r) => r.type === 'wait_timer')?.wait_timer ?? 0;
    const policy = have?.deployment_branch_policy;
    const differs = !have || !same(sorted(haveIds), sorted(reviewers.map((r) => r.id))) || haveWait !== env.wait_timer
      || (reviewers.length > 0 && (asks?.prevent_self_review ?? false) !== env.prevent_self_review)
      || policy?.custom_branch_policies !== true || policy?.protected_branches !== false;
    if (differs) {
      calls.push({
        what: `${have ? 'environment' : 'new environment'} ${name}: ${who.length ? `approved by ${who.join(', ')} (${env.reviewers})${env.prevent_self_review ? ', never by whoever started the run' : ''}` : 'no approval'}${env.wait_timer ? `, ${env.wait_timer} minutes' wait` : ''}, its own branches alone`,
        method: 'PUT',
        path: `repos/${repo}/environments/${name}`,
        body: { wait_timer: env.wait_timer, prevent_self_review: env.prevent_self_review, reviewers, deployment_branch_policy: { protected_branches: false, custom_branch_policies: true } },
      });
    }
    const branches = have && policy?.custom_branch_policies ? (api('GET', `repos/${repo}/environments/${name}/deployment-branch-policies?per_page=100`)?.branch_policies ?? []) : [];
    for (const b of env.branches) {
      if (!branches.some((p) => p.name === b && (p.type ?? 'branch') === 'branch')) {
        calls.push({ what: `environment ${name} admits ${b}`, method: 'POST', path: `repos/${repo}/environments/${name}/deployment-branch-policies`, body: { name: b, type: 'branch' } });
      }
    }
    for (const p of branches) {
      if (!env.branches.includes(p.name) || (p.type ?? 'branch') !== 'branch') {
        calls.push({ what: `environment ${name} no longer admits ${p.type ?? 'branch'} ${p.name}`, method: 'DELETE', path: `repos/${repo}/environments/${name}/deployment-branch-policies/${p.id}` });
      }
    }
  }
  const declaredEnvs = new Set(Object.keys(settings.environments ?? {}).map((n) => n.toLowerCase()));
  for (const [key, e] of held) if (!declaredEnvs.has(key)) unmanaged.push(`environment ${e.name}`);

  if (!withRulesets) return { calls, unmanaged, problems, notes: [...notes, 'the rulesets are left as they stand (--without-rulesets)'] };
  const rulesets = (api('GET', `repos/${repo}/rulesets?per_page=100&includes_parents=false`) ?? []).filter((r) => (r.source_type ?? 'Repository') === 'Repository');
  for (const want of settings.rulesets ?? []) {
    const have = rulesets.find((r) => r.name === want.name);
    if (!have) {
      calls.push({ what: `new ruleset ${want.name}`, method: 'POST', path: `repos/${repo}/rulesets`, body: want });
    } else if (!sameRuleset(api('GET', `repos/${repo}/rulesets/${have.id}`), want)) {
      calls.push({ what: `ruleset ${want.name}, as declared`, method: 'PUT', path: `repos/${repo}/rulesets/${have.id}`, body: want });
    }
  }
  for (const r of rulesets) if (!(settings.rulesets ?? []).some((w) => w.name === r.name)) unmanaged.push(`ruleset ${r.name}`);
  return { calls, unmanaged, problems, notes };
}

/** Makes a plan's calls, in order. */
export function applySettings(calls, api) {
  for (const c of calls) api(c.method, c.path, c.body);
}

/** The files of `local` ({ path: text }) that are not as origin/main holds them - AUDIT RELEASE-FLOW C7: `--apply`
 *  applies what main declares, never a branch's draft or a stale checkout's. `show(path)` is git's `show`. */
export function notMainsOwn(local, show = (p) => execFileSync('git', ['show', `origin/main:${p}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })) {
  return Object.entries(local).filter(([path, text]) => {
    try { return show(path) !== text; } catch { return true; }
  }).map(([path]) => path);
}

/** `gh api`, as the admin running this: a JSON body on stdin, the answer parsed (null when there is none). */
export function ghApi(method, path, body, exec = execFileSync) {
  const args = ['api', '-X', method, path, '-H', 'Accept: application/vnd.github+json'];
  const opts = { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] };
  if (body !== undefined) {
    args.push('--input', '-');
    opts.input = JSON.stringify(body);
  }
  const out = exec('gh', args, opts);
  return out.trim() ? JSON.parse(out) : null;
}

if (isMain(import.meta.url)) {
  const apply = process.argv.includes('--apply');
  const local = { [SETTINGS_FILE]: readFileSync(new URL(`../${SETTINGS_FILE}`, import.meta.url), 'utf8'), [CODEOWNERS_FILE]: readFileSync(new URL(`../${CODEOWNERS_FILE}`, import.meta.url), 'utf8') };
  const settings = readSettings(local[SETTINGS_FILE]);
  const owners = codeownersReviewers(local[CODEOWNERS_FILE]);
  if (!same(owners, settings.roles.reviewers)) {
    console.error(`${CODEOWNERS_FILE} names ${owners.join(', ') || 'nobody'}, and roles.reviewers ${settings.roles.reviewers.join(', ')} - make them one list first`);
    process.exit(1);
  }
  const stale = notMainsOwn(local);
  if (stale.length && apply) {
    console.error(`--apply applies what main declares, and here ${stale.join(' and ')} ${stale.length > 1 ? 'are' : 'is'} not origin/main's - git fetch origin, then run it from main`);
    process.exit(1);
  }
  const { calls, unmanaged, problems, notes } = planSettings(settings, ghApi, { rulesets: !process.argv.includes('--without-rulesets'), codeowners: local[CODEOWNERS_FILE] });
  for (const f of stale) console.log(`note: ${f} here is not origin/main's - this plan is this checkout's`);
  for (const n of notes) console.log(`note: ${n}`);
  for (const c of calls) console.log(`${apply ? 'setting' : 'would set'}: ${c.what}`);
  for (const u of unmanaged) console.log(`left as it stands (not in ${SETTINGS_FILE}): ${u}`);
  if (problems.length) {
    for (const p of problems) console.error(`refused: ${p}`);
    console.error('nothing is applied while GitHub and the file disagree about this');
    process.exit(1);
  }
  if (!calls.length) console.log(`${settings.repository} holds what ${SETTINGS_FILE} declares`);
  else if (apply) applySettings(calls, ghApi);
  else console.log('nothing changed - run again with --apply to set it');
}
