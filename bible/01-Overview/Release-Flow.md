# RELEASE-FLOW - main is development, release is production

Opened 2026-10-19, on the request: *"Create a `release` branch. It will be used for deployment of releases so current
relay, account and desktop should look on this branch and not `main`. Actions with this branch should be accessible
only by the certain roles. Deployment should be manual via GitHub Actions"* - with hotfixes branched from release and
merged into main after it, a dev server from main inside a WireGuard network on a VM of its own, a way to run a pull
request's tests by hand, and regular reviews by people given the role. Audited the same day, the owner: *"Can we give
this a proper audit and ensure perfection"* - six cold lanes, every finding verified, fixed and pinned or recorded:
`audits/Audit-Release-Flow.md`.

It retires REL3's every-merge release (`Desktop-App.md`), SRV-N/CI's relay deploy on every push to main and ACC1-CI's
account deploy on a path filter: since this, NOTHING THE PLAYERS USE MOVES WHEN MAIN MOVES.

```
 feature ──PR──▶ main ──dev-deploy (by hand)──▶ https://dev.daggerfalljs.dev   (inside WireGuard alone)
                  │
                  └──promotion PR──▶ release ──dispatch + a release manager's approval──▶ the players
                                      ▲    │
 hotfix/<x> (from release) ──PR───────┘    └──back-merge PR (opened by release-backmerge.yml)──▶ main
```

| Part | What | Where |
|---|---|---|
| RELEASE-BRANCH | Production - relay, account service, site, desktop release, every operation on production's data - is dispatched by hand on `release` and runs in the `production` environment (the site in `github-pages`), which admits release alone and waits for a release manager | `deploy.yml`, `relay-deploy.yml`, `account-deploy.yml`, `release-desktop.yml`; the data operations; `scripts/serviceWait.sh` |
| HOTFIX-BACK | Whenever release holds what main lacks, one pull request into main brings it back | `release-backmerge.yml` |
| CHECK-ASK | `/check` on a pull request runs the whole check on its branch, conflicted or not, and says its result on the head commit | `check-ask.yml`, `check.yml` |
| ROLES | Who reviews, who releases, who administers: declared in the tree, applied by an admin | `ops/github/settings.json`, `.github/CODEOWNERS`, `tools/repoSettings.mjs` |
| DEV-ENV | main's game, relay and account service on a VM of its own, reached through WireGuard alone | `dev-deploy.yml`, `ops/dev/`, `tools/devPeer.mjs`, `src/net/serviceHome.js` |

Held by `test/tooling/releaseflow.test.js`, `test/tooling/rel4_release.test.js` (the notes), `test/net/servicehome.test.js`,
`test/net/devenv_feeds.test.js`, and by each deploy's own pins (`relaydeploy`, `accountdeploy`, `audit0929_terms`,
`flow1_ci`, `citimes`); `tools/mutants/releaseflow.json` (134 mutants, all dead).

## The branches

- **main** - every change merges here, by a pull request a reviewer approved and the check passed. It is played in the
  dev environment, and nothing in production follows it.
- **release** - production. It moves by pull request alone - a PROMOTION (main into release) or a HOTFIX - with a code
  owner's approval, the check, and a MERGE COMMIT (the ruleset allows no other method: a promotion's notes are found
  through its second parent, below); and AN ADMIN MERGES IT - the `update` rule refuses everyone else, the admins
  bypassing it by a pull request alone (AUDIT RELEASE-FLOW F3). Never pushed to, never rewritten.
- **backmerge/release** - the workflow's own: release, on its way back to main.
- **the release tags** (`app-v*`) - a ruleset's: never moved, never deleted, but by an admin.

## Releasing

1. **Promote.** Open a pull request from `main` into `release` ("Promote main"). Promote only while no back-merge
   pull request is open: then main holds all of release and the promotion cannot conflict. A reviewer approves, the
   check passes, an admin merges it (a merge commit). A promotion that conflicts all the same - release took a fix
   main does not hold - is resolved on a branch from main with release merged into it, never on release.
2. **Dispatch, on release - all four, every release.** In Actions, each of `relay-deploy`, `account-deploy`, `deploy`
   and `release-desktop` → Run workflow → *Use workflow from: release*. A run dispatched on any other branch stops at
   its first step (the desktop release builds run artifacts there and publishes nothing), and never cancels release's
   own. The account service's deploy drops nobody and goes every release: the laws it shares with the game move without
   its `ACCOUNT_VERSION` (AUDIT RELEASE-FLOW F5). They may be dispatched together, and each waits for what it talks to:
   the account service for the relay to serve the release's `RELAY_VERSION`; the site and the desktop release for both
   - the relay its `RELAY_VERSION`, the account service its `ACCOUNT_VERSION` (`scripts/serviceWait.sh`, five hours
   fifty minutes by the clock; AUDIT RELEASE-FLOW A6: the site waited for the account service alone, the desktop
   release for nothing).
3. **Approve.** Each run stops at its production job - the relay's and the account service's deploy, the site's
   publish, the desktop release's publish - until a release manager approves it (*Review deployments*). GitHub lets
   anyone who can push here press *Run workflow*; it is the approval that is a release manager's alone. What a run
   publishes is kept a week while it waits (AUDIT RELEASE-FLOW A2: a day, so an approval the day after found nothing);
   past that, dispatch it again. The relay deploys only when `RELAY_VERSION` moved, and A RELAY DEPLOY DROPS EVERY
   CONNECTED PLAYER: approve it at an hour they can spare. It waits out a live siege and the Spire's breaches unless
   dispatched with `force` (which voids them); a relay whose `/health` does not answer is deployed over only with
   `blind`, which keeps every wait (AUDIT RELEASE-FLOW A4: it was `force`'s, and voided them all) - and is refused
   before the suite runs or an approval is asked.
4. **Verify.** The relay's and the account service's deploys poll what they deployed until it answers with the
   release's version; `node tools/verify-deploy.mjs` proves the live `/play/` carries a commit of yours.

The production data operations - recovery, a guild grant, a realm restore, revive or rollback, a server post, the
clears and the two load reads - are dispatched on release and approved the same way. Each waits its turn in its group:
a run behind another is queued, never cancelled by the next (AUDIT RELEASE-FLOW A5).

THE NUMBERS. The installer's version is still REL3's `app-v<major>.<minor>.<commit count>` of the release's commit,
and only grows. REL8's update number counts RELEASE's first-parent line now - one promotion, or one hotfix, one update
(two promotions released at once are two); no build of main is numbered - a dev build names its commit (AUDIT
RELEASE-FLOW F8). The notes are still every pull request a release brings (`scripts/desktopRelease.mjs`
`pullRequestsSince`): release's own merges, and under each promotion main's merges since the release before - the
newest release the commit holds BY VERSION (`git tag --merged --sort=-v:refname`; git's `describe` picked by nearness,
differently from one git to the next).

THE PREVIEW. `/preview/exact-face-atlas/` is built at the commit `deploy.yml` names, never its branch's tip, which any
writer moved and no review saw, on the players' own origin (AUDIT RELEASE-FLOW F2). Moving it is a pull request,
reviewed and promoted like any change. Only the publishing job holds the right to publish (`pages`, `id-token`;
AUDIT RELEASE-FLOW A7).

## Where release begins

The update number and the notes both read release's first-parent line from the release before, so the release before
must STAND on that line. Every release cut from release does; so does every one main cut before this, PROVIDED RELEASE
WAS BRANCHED FROM MAIN AT OR AFTER THE LAST OF THEM. Branched earlier - while main was still cutting releases on its
own - release would count from its branch point (an update number main already published) and its first promotion
would bring again every pull request main had released since. `node scripts/desktopRelease.mjs line` asks, and the
desktop release's `version` job and the site's build refuse to publish on a no.

So the branch is begun once, at the cut-over, at this change's merge - in this order, so that no moment holds the new
workflows on release without the environments that guard them (AUDIT RELEASE-FLOW C8), nor release's rules before
release has been brought up:

1. Merge the pull request that brings this into main.
2. An admin, from a checkout of main: `git fetch origin && node tools/repoSettings.mjs --apply --without-rulesets` -
   the Actions token and the three environments, each admitting its one branch and asking its reviewers.
3. Bring `release` to main's head - `git push origin origin/main:release` (a fast-forward: release was made from an
   older main). It must come before step 4, whose rulesets admit no push.
4. `node tools/repoSettings.mjs --apply` - the rulesets too. It refuses while GitHub disagrees with the file about who
   holds a role, and on a private repository (whose plan holds no environment reviewers).
5. Move production's secrets into the `production` environment (Settings → Environments → production → Add
   environment secret, the same names): `CLOUDFLARE_API_TOKEN`, `PATREON_CLIENT_SECRET`, `PATREON_WEBHOOK_SECRET`,
   `ANTHROPIC_API_KEY`, `DISCORD_BOT_TOKEN` - then DELETE the repository's own copies, or any workflow on any branch
   can still read them. Every job that names one runs in that environment (pinned).
6. The first release: *Releasing*, step 2.

## Hotfixes

1. `git fetch origin && git switch -c hotfix/<name> origin/release` - from release, never main.
2. A pull request into `release`; approved, checked, merged by an admin (a merge commit).
3. Dispatch and approve, as for a release.
4. `release-backmerge.yml` has opened (or brought up to date) the pull request from `backmerge/release` into main.
   ITS CHECK WAITS FOR YOU: GitHub holds the `check` of a pull request a workflow's token opened or pushed until
   someone who can push here approves it - *Approve workflows to run*, in its merge box, after every push the workflow
   makes (AUDIT RELEASE-FLOW B1: a check dispatched instead is never read for a pull request). Merge it WITH A MERGE
   COMMIT, so main's history holds release's commits.

What "release holds what main lacks" means is asked of git itself (AUDIT RELEASE-FLOW B3): a commit of release's own -
not a merge - that main's history does not hold, or a merge of release into main that would change main's tree
(`git merge-tree`). History as well as the tree, because a fix carried to main by hand, or a back-merge squashed, leaves
the trees alike and the histories apart - and main's next change to those lines then conflicts with release at the next
promotion. So it is asked on every push to main as well as to release, and by hand; a back-merge squashed opens the next
at once, showing no change - merge that one all the same. A conflict, or a merge the workflow's token may not push (one
that makes a workflow file no branch holds), is said on the pull request and resolved by a person on
`backmerge/release` - release or main merged into it, pushed there - never on release. Only this repository's own
branch is the back-merge; a fork's of the same name is not (AUDIT RELEASE-FLOW B2).

## `/check` - a pull request's check, whatever its conflicts

GitHub starts no `pull_request` run for a pull request that conflicts with its base - there is no merge to test - so a
conflicted pull request showed no check at all. A comment whose first line is `/check`, from someone who can push here,
dispatches `check.yml` on the pull request's own branch: verify.yml's every part on its head, the hosts' ceilings among
them (AUDIT RELEASE-FLOW F1). Its result is said on that commit as a status of its own, `check (asked)`, which the pull
request shows. It is NOT the required `check`: GitHub reads no check a dispatched run reports for a pull request, so
`/check` informs and cannot pass one - its required `check` is the `pull_request` run on its merge, which comes once it
merges cleanly. A fork's branch cannot be dispatched here, and `/check` says so; someone who cannot push here gets a
reaction and no more. `check.yml` runs on every push to main too, in a group of its own (a `/check` on main never
cancels it), which also saves the shards' times where every pull request finds them (`09-Testing/Testing.md`,
CI-TIMES).

## Roles

| Role | Holds | Who | Where |
|---|---|---|---|
| reviewers | Asked for a review on every pull request; main and release merge only with one's approval (a code owner's - never their own, and never after a push of their own), and a push dismisses it | Lattymoy, EdoardoBramini | `.github/CODEOWNERS` = `roles.reviewers` |
| releaseManagers | The required reviewers of `production` and `github-pages`: no deploy, release or production data operation runs without one's approval | Lattymoy | `roles.releaseManagers` |
| admins | The repository's admins - on an account's own repository, the account alone. The one role that merges into release, and the one that may bypass a review (by a pull request alone; GitHub records it). Nobody bypasses a gate: the check, no deletion, no force push | Lattymoy | `roles.admins` |
| dev network members | Reach the dev environment | each by the WireGuard key they made | `ops/dev/peers.json` |

The holders above are the defaults this was written with, FOR THE OWNER TO CONFIRM. A reviewer must be a collaborator
with write access (GitHub ignores a code owner without it); the tool checks every role's holders against GitHub and
applies nothing while they disagree. A pull request a session opens is the owner's own - the sessions push as the
owner - so its approval is another reviewer's, or the admin bypasses the review by the pull request (GitHub records
it); the check is bypassed by nobody (AUDIT RELEASE-FLOW C1). On a repository a personal account owns, GitHub has no teams and no custom roles,
so the roles are people named in the file. A release manager may approve a run they dispatched themselves
(`prevent_self_review` is off) - with self-review prevented, a run a release manager dispatched would wait on another
release manager, and there is one. An environment's admins may approve past its reviewers (GitHub's own setting); the
admin here is a release manager.

TO CHANGE A ROLE: a pull request editing `ops/github/settings.json` (and `.github/CODEOWNERS` for a reviewer - the
test and the tool hold the two together). Once it is merged, an admin, signed in (`gh auth login`), runs
`node tools/repoSettings.mjs` (what would change) and `node tools/repoSettings.mjs --apply`, from a checkout whose two
files are origin/main's. A workflow's token cannot change a repository's settings, and an admin's token kept in CI
would hand them to every workflow that read it - so the settings are applied from an admin's machine, as the account
deploy writes Discord's from the tree (DISCORD-CODE). The tool changes what the file declares, compares every field it
sends (an undeclared one must be GitHub's own unset default), and says what else it saw: the Actions token (read by
default; it may open a pull request, as the back-merge does), the three environments (their reviewers, the one branch
each admits, no wait), the rulesets - main's and release's GATES (the `check` status from GitHub Actions, no deletion,
no force push; bypassed by nobody), their REVIEWS (a pull request with a code owner's approval; release's a merge
commit alone, and its `update` rule) and the release tags' - and which CODEOWNERS main and release hold.

## What GitHub does not hold yet (for the owner)

- **A release can still be published without an approval** (AUDIT RELEASE-FLOW A1, recorded). The publish needs only
  a workflow's own token, so the environment gates this repository's release-desktop.yml - but any writer can dispatch
  the file as an OLDER commit holds it (one from before this, with no environment), or publish a release through the
  API by hand. The release tags are a ruleset's now (never moved or deleted but by an admin); the whole gate is an
  identity only `production` holds - a GitHub App whose key is that environment's secret - publishing the releases,
  and creating `app-v*` tags restricted to it. That is the owner's to create and grant.
- **Who may dispatch** is everyone who can push; the approval is a release manager's alone (above).

## The dev environment

main's site, relay and account service, on a VM of its own (`ops/dev/bootstrap.sh`, Ubuntu 24.04), reached through
WireGuard alone at `https://dev.daggerfalljs.dev`:

- **The network** - `10.66.0.0/24`: the VM `10.66.0.1`, the CI runner `10.66.0.2`, members `10.66.0.3` to `.250` -
  `.3` to `.9` the team's services (a VM of its own, such as an admin panel), people from `.10`. From the internet the
  VM answers WireGuard (udp 51820) and port 80 - Let's Encrypt's challenge for the site's certificate, and a redirect
  to a door shut outside the network. Inside it: the site (443), SSH (keys alone) and the network's DNS. A member
  reaches the VM and, through it, the services' addresses - never another member's machine (AUDIT RELEASE-FLOW D4).
  (`ops/dev/nftables.conf`.)
- **Its DNS** names `dev.daggerfalljs.dev` `10.66.0.1` for both address families - no public IPv6 address of the VM
  reaches a member (AUDIT RELEASE-FLOW D9) - and hands every other name on (`ops/dev/dnsmasq.conf`). What a member
  accepts by it: while the tunnel is up the VM answers every name they look up (forwarding it, logging none), and
  with the VM down their names go with it until they disconnect. On Linux, wg-quick needs `resolvconf` for it.
- **The services** - Caddy serves one origin (`ops/dev/Caddyfile`): `/relay` the relay and `/accounts` the account
  service, each its Cloudflare runtime run by `wrangler dev` on the loopback (local D1, R2 and Durable Objects, state
  kept in `/var/lib/dfo-dev/state` across deploys; the account service's crons fired by a timer; the relay's feeds and
  the service's law door posted through their bindings - AUDIT RELEASE-FLOW D3), and the rest main's built site - the
  game at `/play/` and the labs (`viewer.html`, `sky.html`, `cards.html` ...). Each Worker's own doors (`/cdn-cgi/`,
  `/__scheduled`) stay on the loopback, and Caddy keeps no admin API (AUDIT RELEASE-FLOW D2). A further service - an
  admin panel - listens on the loopback and takes a `handle_path` beside these two, or is a member at a services'
  address.
- **Its own keys** - the dev account service and relay sign and verify with keys made on the VM by the tools
  production's are made with. NOTHING OF PRODUCTION'S IS THERE: no Cloudflare token, no Patreon, Discord or Anthropic
  secret, so what needs those does not run in dev.
- **The build** knows its home: `VITE_DFO_RELAY` and `VITE_DFO_ACCOUNTS`, set at build (`src/net/serviceHome.js`),
  point the game at the dev services; a build without them calls the players' services, as before, a stamp the client
  would refuse fails the build, and `dev-deploy.yml` ships no build that does not name the dev ones.
- **The authorization** is the network itself - only a key in `ops/dev/peers.json` reaches anything - and inside it,
  the game's own accounts, on the dev account service.

JOINING. On your own machine: `node tools/devPeer.mjs member --name <your GitHub login> --ip 10.66.0.<n> --server-key
<the VM's key> --endpoint dev.daggerfalljs.dev:51820` (an unused `n` from `ops/dev/peers.json`, from 10; the VM's key
is no secret - bootstrap.sh printed it, the `dev` environment keeps it as `DEV_WG_SERVER_KEY`, and an admin hands it
over; the name's public record is the VM's own address, so it serves as the endpoint). It writes `dfo-dev.conf` for
the WireGuard app - your private key stays in it and nowhere else - and prints the entry `ops/dev/peers.json` takes.
Your pull request adding it is the request to join; a reviewer's approval is the admission; the next dev deploy lets
you in. With the tunnel up, open `https://dev.daggerfalljs.dev` in any browser. Leaving is the line's removal, by the
same road (the deploy applies the whole list, `wg syncconf`; a key the VM or the CI runner holds is refused - AUDIT
RELEASE-FLOW D5).

DEPLOYING. Actions → `dev-deploy` → Run workflow, on main. One job builds the site for the dev services and hands it
on; another - the only one holding the network's key and the deploy's - joins the network as its CI peer, ships the
release over SSH inside it (linked to the release before by content), and has the VM make it current (AUDIT
RELEASE-FLOW D12). On the VM, `ops/dev/deploy.sh` applies the members first, then stops the Workers, applies the
account service's migrations to the dev database, makes the release current and starts them; a failure before the
swap starts the release before again (AUDIT RELEASE-FLOW D6), and the five newest releases are kept, the current among
them (D7). It passes only once the site, the relay and the account service answer through the network, by name and
over TLS, with this commit's versions.

STANDING IT UP (once, an admin):

1. A VM (2 vCPU, 4 GB is room enough) with a public address; a DNS A record `dev.daggerfalljs.dev` → that address.
2. `node tools/devPeer.mjs keys` - the CI runner's WireGuard pair; `ssh-keygen -t ed25519 -N '' -C dfo-dev-deploy -f
   dfo-dev-deploy` - the deploy's SSH pair (no passphrase: CI types none).
3. On the VM: `git clone --depth 1 https://github.com/Lattymoy/daggerfall-js-source /opt/dfo-dev-src` and
   `sudo CI_WG_PUBLIC_KEY=<public half> CI_SSH_PUBLIC_KEY='<dfo-dev-deploy.pub>' /opt/dfo-dev-src/ops/dev/bootstrap.sh`.
   It prints the rest. It installs Node at the version and hash it pins (AUDIT RELEASE-FLOW D13), takes SSH keys
   alone, and the deploy's key from the CI runner's address alone (D11).
4. The repository's `dev` environment: secrets `DEV_WG_PRIVATE_KEY` (the CI pair's private half), `DEV_WG_ENDPOINT`
   (`<address>:51820`), `DEV_SSH_PRIVATE_KEY` (`dfo-dev-deploy`), `DEV_SSH_KNOWN_HOSTS` (the line bootstrap.sh
   printed); variable `DEV_WG_SERVER_KEY` (the VM's public key). The environment admits main alone.
5. Dispatch `dev-deploy` on main; then the members join.

Running bootstrap.sh again - after a `git pull` there, whenever a file beside it changes - runs main's own script as
root: read what moved first. It writes nothing as root beneath a directory the deploy's user owns (AUDIT RELEASE-FLOW
D1: such a path could be swapped for a symlink to `/etc`).

## What needs a person

The cut-over (*Where release begins*); approving each production run; the VM, its DNS record and the `dev`
environment's values; a member's admission (a review, like any other); a role's change, applied by an admin; the
identity that would gate the releases (*What GitHub does not hold yet*). A production secret is rotated in the
`production` environment; a dev key is made again by deleting it on the VM (`/etc/dfo-dev/*.env`,
`/etc/wireguard/wg0.key`) and running bootstrap.sh again.
