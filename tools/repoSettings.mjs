// ROLES (RELEASE-FLOW, 2026-10-19, bible/01-Overview/Release-Flow.md): THE REPOSITORY'S SETTINGS ARE CODE.
//
//   node tools/repoSettings.mjs            what would change - ops/github/settings.json against GitHub's own (gh api)
//   node tools/repoSettings.mjs --apply    and change it
//
// ops/github/settings.json declares who holds which role, the environments the workflows run in and the rules on main
// and release; .github/CODEOWNERS names its reviewers (test/tooling/releaseflow.test.js holds the two together). A
// workflow's own token cannot change a repository's settings, and an admin's token kept in CI would hand them to any
// workflow that read it - so this runs on an admin's machine, as that admin (`gh auth login`, once), after a change to
// the file is merged, the way the account deploy writes Discord's settings from the tree (DISCORD-CODE). It changes what
// the file declares and nothing else: a ruleset or an environment it does not name is left as it stands, and said.
//
// The roles, as GitHub can hold them in a repository a personal account owns (no teams and no custom roles - those
// are an organization's):
//   admins           the repository's admins - the one role that may bypass the rules on main and release, and only by
//                    a pull request (GitHub records each bypass)
//   releaseManagers  the required reviewers of `production` and `github-pages`: no production deploy, release or
//                    production data operation runs without one's approval
//   reviewers        .github/CODEOWNERS: GitHub asks them for a review on every pull request, and main and release
//                    merge only with one's approval
// The dev network's members are ops/dev/peers.json's (DEV-ENV), each by the WireGuard key they made themselves.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { isMain } from './lib/isMain.mjs';

export const SETTINGS_FILE = 'ops/github/settings.json';
export const CODEOWNERS_FILE = '.github/CODEOWNERS';
/** The roles the file declares, each a list of GitHub logins. */
export const ROLES = Object.freeze(['admins', 'releaseManagers', 'reviewers']);
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
    if (!Array.isArray(env.branches) || env.branches.length === 0) fail(`environments.${name} admits no branch`);
  }
  for (const r of s.rulesets ?? []) {
    if (!r.name || r.target !== 'branch' || !Array.isArray(r.rules) || !r.conditions?.ref_name?.include?.length) fail(`ruleset "${r.name ?? '?'}" is incomplete`);
  }
  return s;
}

/** The logins CODEOWNERS gives every path (its `*` line), in the file's order. */
export function codeownersReviewers(text) {
  const line = String(text).split('\n').find((l) => /^\*\s/.test(l));
  return line ? line.trim().split(/\s+/).slice(1).map((o) => o.replace(/^@/, '')) : [];
}

const sorted = (xs) => [...xs].sort();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Does a ruleset GitHub holds say what the declared one says? Only what the file declares is compared - GitHub answers
 *  defaults for parameters a ruleset never set - and a rule the file does not declare is a difference. */
export function sameRuleset(have, want) {
  if (have.target !== want.target || have.enforcement !== want.enforcement) return false;
  const refs = (r) => ({ include: sorted(r?.conditions?.ref_name?.include ?? []), exclude: sorted(r?.conditions?.ref_name?.exclude ?? []) });
  if (!same(refs(have), refs(want))) return false;
  const actors = (r) => sorted((r.bypass_actors ?? []).map((a) => `${a.actor_type}:${a.actor_id}:${a.bypass_mode}`));
  if (!same(actors(have), actors(want))) return false;
  if (!same(sorted((have.rules ?? []).map((r) => r.type)), sorted(want.rules.map((r) => r.type)))) return false;
  for (const rule of want.rules) {
    const held = (have.rules ?? []).find((r) => r.type === rule.type);
    for (const [key, value] of Object.entries(rule.parameters ?? {})) {
      const got = held?.parameters?.[key];
      if (key === 'required_status_checks') {
        if (!same(sorted((got ?? []).map((c) => c.context)), sorted(value.map((c) => c.context)))) return false;
      } else if (!same(Array.isArray(value) ? sorted(got ?? []) : got, Array.isArray(value) ? sorted(value) : value)) return false;
    }
  }
  return true;
}

/**
 * What applying the settings would do: `calls`, each one call of GitHub's REST API in the order it must be made
 * ({ what, method, path, body? }), and `unmanaged`, what GitHub holds that the file does not name. Asked of
 * `api(method, path)` - gh by default, a fake in the tests - which it only reads; `applySettings` makes the calls.
 */
export function planSettings(settings, api) {
  const repo = settings.repository;
  const calls = [];
  const unmanaged = [];

  const wf = api('GET', `repos/${repo}/actions/permissions/workflow`);
  const actions = settings.actions;
  if (wf?.default_workflow_permissions !== actions.default_workflow_permissions || wf?.can_approve_pull_request_reviews !== actions.can_approve_pull_request_reviews) {
    calls.push({ what: `the Actions token: ${actions.default_workflow_permissions} by default; ${actions.can_approve_pull_request_reviews ? 'may' : 'may not'} open a pull request (release-backmerge.yml opens one)`, method: 'PUT', path: `repos/${repo}/actions/permissions/workflow`, body: actions });
  }

  const ids = new Map();
  const idOf = (login) => {
    if (!ids.has(login)) ids.set(login, api('GET', `users/${login}`).id);
    return ids.get(login);
  };
  const held = new Map((api('GET', `repos/${repo}/environments`)?.environments ?? []).map((e) => [e.name, e]));
  for (const [name, env] of Object.entries(settings.environments ?? {})) {
    const who = env.reviewers ? settings.roles[env.reviewers] : [];
    const reviewers = who.map((login) => ({ type: 'User', id: idOf(login) }));
    const have = held.get(name);
    const haveIds = (have?.protection_rules ?? []).find((r) => r.type === 'required_reviewers')?.reviewers?.map((r) => r.reviewer?.id) ?? [];
    const policy = have?.deployment_branch_policy;
    if (!have || !same(sorted(haveIds), sorted(reviewers.map((r) => r.id))) || policy?.custom_branch_policies !== true || policy?.protected_branches !== false) {
      calls.push({
        what: `${have ? 'environment' : 'new environment'} ${name}: ${who.length ? `approved by ${who.join(', ')} (${env.reviewers})` : 'no approval'}, its own branches alone`,
        method: 'PUT',
        path: `repos/${repo}/environments/${name}`,
        body: { wait_timer: 0, prevent_self_review: false, reviewers, deployment_branch_policy: { protected_branches: false, custom_branch_policies: true } },
      });
    }
    const branches = have && policy?.custom_branch_policies ? (api('GET', `repos/${repo}/environments/${name}/deployment-branch-policies`)?.branch_policies ?? []) : [];
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
  for (const name of held.keys()) if (!(name in (settings.environments ?? {}))) unmanaged.push(`environment ${name}`);

  const rulesets = (api('GET', `repos/${repo}/rulesets`) ?? []).filter((r) => (r.source_type ?? 'Repository') === 'Repository');
  for (const want of settings.rulesets ?? []) {
    const have = rulesets.find((r) => r.name === want.name);
    if (!have) {
      calls.push({ what: `new ruleset ${want.name}`, method: 'POST', path: `repos/${repo}/rulesets`, body: want });
    } else if (!sameRuleset(api('GET', `repos/${repo}/rulesets/${have.id}`), want)) {
      calls.push({ what: `ruleset ${want.name}, as declared`, method: 'PUT', path: `repos/${repo}/rulesets/${have.id}`, body: want });
    }
  }
  for (const r of rulesets) if (!(settings.rulesets ?? []).some((w) => w.name === r.name)) unmanaged.push(`ruleset ${r.name}`);
  return { calls, unmanaged };
}

/** Makes a plan's calls, in order. */
export function applySettings(calls, api) {
  for (const c of calls) api(c.method, c.path, c.body);
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
  const settings = readSettings(readFileSync(new URL(`../${SETTINGS_FILE}`, import.meta.url), 'utf8'));
  const owners = codeownersReviewers(readFileSync(new URL(`../${CODEOWNERS_FILE}`, import.meta.url), 'utf8'));
  if (!same(owners, settings.roles.reviewers)) {
    console.error(`${CODEOWNERS_FILE} names ${owners.join(', ') || 'nobody'}, and roles.reviewers ${settings.roles.reviewers.join(', ')} - make them one list first`);
    process.exit(1);
  }
  const { calls, unmanaged } = planSettings(settings, ghApi);
  for (const c of calls) console.log(`${apply ? 'setting' : 'would set'}: ${c.what}`);
  for (const u of unmanaged) console.log(`left as it stands (not in ${SETTINGS_FILE}): ${u}`);
  if (!calls.length) console.log(`${settings.repository} holds what ${SETTINGS_FILE} declares`);
  else if (apply) applySettings(calls, ghApi);
  else console.log('nothing changed - run again with --apply to set it');
}
