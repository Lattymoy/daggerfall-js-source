# RELEASE-FLOW - main is development, release is production

Opened 2026-10-19, on the request: *"Create a `release` branch. It will be used for deployment of releases so current
relay, account and desktop should look on this branch and not `main`. Actions with this branch should be accessible
only by the certain roles. Deployment should be manual via GitHub Actions"* - with hotfixes branched from release and
merged into main after it, a dev server from main inside a WireGuard network on a VM of its own, a way to run a pull
request's tests by hand, and regular reviews by people given the role.

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
| RELEASE-BRANCH | Production - relay, account service, site, desktop release, every operation on production's data - is dispatched by hand on `release` and runs in the `production` environment (the site in `github-pages`), which admits release alone and waits for a release manager | `deploy.yml`, `relay-deploy.yml`, `account-deploy.yml`, `release-desktop.yml`; the data operations |
| HOTFIX-BACK | A push to release that leaves release holding changes main lacks opens - or brings up to date - one pull request into main | `release-backmerge.yml` |
| CHECK-ASK | `/check` on a pull request runs the whole check on its branch, conflicted or not | `check-ask.yml` |
| ROLES | Who reviews, who releases, who administers: declared in the tree, applied by an admin | `ops/github/settings.json`, `.github/CODEOWNERS`, `tools/repoSettings.mjs` |
| DEV-ENV | main's game, relay and account service on a VM of its own, reached through WireGuard alone | `dev-deploy.yml`, `ops/dev/`, `tools/devPeer.mjs`, `src/net/serviceHome.js` |

Held by `test/tooling/releaseflow.test.js`, `test/tooling/rel4_release.test.js` (the notes) and
`test/net/servicehome.test.js`; `tools/mutants/releaseflow.json` (43 mutants, all dead).

## The branches

- **main** - every change merges here, by a pull request a reviewer approved and the check passed. It is played in the
  dev environment, and nothing in production follows it.
- **release** - production. It moves by pull request alone - a PROMOTION (main into release) or a HOTFIX - with a
  reviewer's approval, the check, and a MERGE COMMIT (the ruleset allows no other method: a promotion's notes are found
  through its second parent, below). Never pushed to, never rewritten.
- **backmerge/release** - the workflow's own: release, on its way back to main.

## Releasing

1. **Promote.** Open a pull request from `main` into `release` ("Promote main"). Promote only while no back-merge
   pull request is open: then main holds all of release and the promotion cannot conflict. A reviewer approves, the
   check passes, merge it (a merge commit).
2. **Dispatch, on release.** In Actions, each of `relay-deploy`, `account-deploy`, `deploy` and `release-desktop` →
   Run workflow → *Use workflow from: release*. A run dispatched on any other branch stops at its first step (the
   desktop release builds run artifacts there and publishes nothing). They may be dispatched together: each waits for
   the one beneath it - the account service for the relay to serve the release's `RELAY_VERSION`, the site for the
   account service to serve its `ACCOUNT_VERSION`.
3. **Approve.** Each run stops at its production job - the relay's and the account service's deploy, the site's
   publish, the desktop release's publish - until a release manager approves it (*Review deployments*). The relay
   deploys only when `RELAY_VERSION` moved, and A RELAY DEPLOY DROPS EVERY CONNECTED PLAYER: approve it at an hour they
   can spare.
4. **Verify.** The relay's and the account service's deploys poll what they deployed until it answers with the
   release's version; `node tools/verify-deploy.mjs` proves the live `/play/` carries a commit of yours.

THE NUMBERS. The installer's version is still REL3's `app-v<major>.<minor>.<commit count>` of the release's commit,
and only grows. REL8's update number counts RELEASE's first-parent line now - one promotion, or one hotfix, one update
(two promotions released at once are two). The notes are still every pull request a release brings
(`scripts/desktopRelease.mjs` `pullRequestsSince`): release's own merges, and under each promotion main's merges since
the release before.

## Where release begins

The update number and the notes both read release's first-parent line from the release before, so the release before
must STAND on that line. Every release cut from release does; so does every one main cut before this, PROVIDED RELEASE
WAS BRANCHED FROM MAIN AT OR AFTER THE LAST OF THEM. Branched earlier - while main was still cutting releases on its
own - release would count from its branch point (an update number main already published) and its first promotion
would bring again every pull request main had released since. `node scripts/desktopRelease.mjs line` asks, and the
desktop release's `version` job and the site's build refuse to publish on a no.

So the branch is begun once, at the cut-over, at this change's merge:

1. Merge the pull request that brings this into main.
2. Bring `release` to main's head - `git fetch origin && git push origin origin/main:release` (a fast-forward: release
   was made from an older main). It must come before step 3, whose ruleset admits no push.
3. Apply the settings - an admin, below (*Roles*).
4. Move production's secrets into the `production` environment (Settings → Environments → production → Add
   environment secret, the same names): `CLOUDFLARE_API_TOKEN`, `PATREON_CLIENT_SECRET`, `PATREON_WEBHOOK_SECRET`,
   `ANTHROPIC_API_KEY`, `DISCORD_BOT_TOKEN` - then DELETE the repository's own copies, or any workflow on any branch
   can still read them. Every job that names one runs in that environment (pinned).
5. The first release: *Releasing*, step 2.

## Hotfixes

1. `git fetch origin && git switch -c hotfix/<name> origin/release` - from release, never main.
2. A pull request into `release`; approved, checked, merged (a merge commit).
3. Dispatch and approve, as for a release.
4. `release-backmerge.yml` has opened (or brought up to date) the pull request from `backmerge/release` into main, and
   dispatched its check. Merge it WITH A MERGE COMMIT, so main's history holds release's commits.

What "release holds changes main lacks" means is asked of git itself: would merging release into main change main's
tree (`git merge-tree`)? So a promotion opens nothing, and neither does a fix already carried to main by hand. A
conflict is said on the pull request and resolved on `backmerge/release` - main merged into it, pushed there - never on
release; a later push to release is merged into that branch on top of the resolution. The workflow's token opens the
pull request, and GitHub starts no `pull_request` run for that - so the workflow dispatches `check.yml` itself.

## `/check` - a pull request's check, whatever its conflicts

GitHub starts no `pull_request` run for a pull request that conflicts with its base - there is no merge to test - so a
conflicted pull request showed no check at all. A comment whose first line is `/check`, from someone who can push here,
dispatches `check.yml` on the pull request's own branch: the whole check on its head, reported as `check` on that
commit, where its merge box reads it. A fork's branch cannot be dispatched here, and `/check` says so; the merge itself
is still tested once the base is merged in. `check.yml` runs on every push to main too, which also saves the shards'
times where every pull request finds them (`09-Testing/Testing.md`, CI-TIMES).

## Roles

| Role | Holds | Who | Where |
|---|---|---|---|
| reviewers | Asked for a review on every pull request; main and release merge only with one's approval (a code owner's), and a push dismisses it | Lattymoy, EdoardoBramini | `.github/CODEOWNERS` = `roles.reviewers` |
| releaseManagers | The required reviewers of `production` and `github-pages`: no deploy, release or production data operation runs without one | Lattymoy | `roles.releaseManagers` |
| admins | The only role that may bypass the rules on main and release - by a pull request alone, and GitHub records it | Lattymoy | `roles.admins` (the repository's admins) |
| dev network members | Reach the dev environment | each by the WireGuard key they made | `ops/dev/peers.json` |

The holders above are the defaults this was written with, FOR THE OWNER TO CONFIRM. A reviewer must be a collaborator
with write access (GitHub ignores a code owner without it). On a repository a personal account owns, GitHub has no
teams and no custom roles, so the roles are people named in the file.

TO CHANGE A ROLE: a pull request editing `ops/github/settings.json` (and `.github/CODEOWNERS` for a reviewer - the
test and the tool hold the two together). Once it is merged, an admin, signed in (`gh auth login`), runs
`node tools/repoSettings.mjs` (what would change) and `node tools/repoSettings.mjs --apply`. A workflow's token cannot
change a repository's settings, and an admin's token kept in CI would hand them to every workflow that read it - so
the settings are applied from an admin's machine, as the account deploy writes Discord's from the tree (DISCORD-CODE).
The tool changes what the file declares and says what else it saw: the Actions token (read by default; it may open a
pull request, as the back-merge does), the three environments (their reviewers and the one branch each admits), and
the rulesets on main and release (a pull request, a code owner's approval, the `check` status; no deletion, no force
push; release a merge commit alone).

## The dev environment

main's site, relay and account service, on a VM of its own (`ops/dev/bootstrap.sh`, Ubuntu 24.04), reached through
WireGuard alone at `https://dev.daggerfalljs.dev`:

- **The network** - `10.66.0.0/24`: the VM `10.66.0.1`, the CI runner `10.66.0.2`, members `10.66.0.3` to `.250`.
  From the internet the VM answers WireGuard (udp 51820) and port 80 - Let's Encrypt's challenge for the site's
  certificate, and a redirect to a door shut outside the network. Inside it: the site (443), SSH and the network's DNS,
  which names `dev.daggerfalljs.dev` `10.66.0.1` (its public record names the VM's own address, for the challenge).
  Members reach each other through the VM - an admin panel on a VM of its own joins as a member. (`ops/dev/nftables.conf`,
  `ops/dev/dnsmasq.conf`.)
- **The services** - Caddy serves one origin (`ops/dev/Caddyfile`): `/relay` the relay and `/accounts` the account
  service, each its Cloudflare runtime run by `wrangler dev` on the loopback (local D1, R2 and Durable Objects, state
  kept in `/var/lib/dfo-dev/state` across deploys; the account service's crons fired by a timer), and the rest main's
  built site - the game at `/play/` and the labs (`viewer.html`, `sky.html`, `cards.html` ...). Each Worker's own doors
  (`/cdn-cgi/`, `/__scheduled`) stay on the loopback. A further service - an admin panel - listens on the loopback and
  takes a `handle_path` beside these two, or is a member of its own.
- **Its own keys** - the dev account service and relay sign and verify with keys made on the VM by the tools
  production's are made with. NOTHING OF PRODUCTION'S IS THERE: no Cloudflare token, no Patreon, Discord or Anthropic
  secret, so what needs those does not run in dev.
- **The build** knows its home: `VITE_DFO_RELAY` and `VITE_DFO_ACCOUNTS`, set at build (`src/net/serviceHome.js`),
  point the game at the dev services; a build without them calls the players' services, as before, and `dev-deploy.yml`
  ships no build that does not name the dev ones.
- **The authorization** is the network itself - only a key in `ops/dev/peers.json` reaches anything - and inside it,
  the game's own accounts, on the dev account service.

JOINING. On your own machine: `node tools/devPeer.mjs member --name <your GitHub login> --ip 10.66.0.<n> --server-key
<the VM's key> --endpoint dev.daggerfalljs.dev:51820` (an unused `n` from `ops/dev/peers.json`; the VM's key is no
secret - bootstrap.sh printed it, the `dev` environment keeps it as `DEV_WG_SERVER_KEY`, and an admin hands it over;
the name's public record is the VM's own address, so it serves as the endpoint). It writes `dfo-dev.conf`
for the WireGuard app - your private key stays in it and nowhere else - and prints the entry `ops/dev/peers.json`
takes. Your pull request adding it is the request to join; a reviewer's approval is the admission; the next dev deploy
lets you in. With the tunnel up, open `https://dev.daggerfalljs.dev` in any browser. Leaving is the line's removal, by
the same road (the deploy applies the whole list, `wg syncconf`).

DEPLOYING. Actions → `dev-deploy` → Run workflow, on main. It builds the site for the dev services, joins the network
as its CI peer, ships the release over SSH inside it, and has the VM make it current (`ops/dev/deploy.sh`: the account
service's migrations on the dev database, the members from the release's `ops/dev/peers.json`, the Workers restarted);
it passes only once the site, the relay and the account service answer through the network, by name and over TLS, with
this commit's versions.

STANDING IT UP (once, an admin):

1. A VM (2 vCPU, 4 GB is room enough) with a public address; a DNS A record `dev.daggerfalljs.dev` → that address.
2. `node tools/devPeer.mjs keys` - the CI runner's WireGuard pair; `ssh-keygen -t ed25519 -N '' -C dfo-dev-deploy -f
   dfo-dev-deploy` - the deploy's SSH pair (no passphrase: CI types none).
3. On the VM: `git clone --depth 1 https://github.com/Lattymoy/daggerfall-js-source /opt/dfo-dev-src` and
   `sudo CI_WG_PUBLIC_KEY=<public half> CI_SSH_PUBLIC_KEY='<dfo-dev-deploy.pub>' /opt/dfo-dev-src/ops/dev/bootstrap.sh`.
   It prints the rest.
4. The repository's `dev` environment: secrets `DEV_WG_PRIVATE_KEY` (the CI pair's private half), `DEV_WG_ENDPOINT`
   (`<address>:51820`), `DEV_SSH_PRIVATE_KEY` (`dfo-dev-deploy`), `DEV_SSH_KNOWN_HOSTS` (the line bootstrap.sh
   printed); variable `DEV_WG_SERVER_KEY` (the VM's public key). The environment admits main alone.
5. Dispatch `dev-deploy` on main; then the members join.

## What needs a person

The cut-over (*Where release begins*); approving each production run; the VM, its DNS record and the `dev`
environment's values; a member's admission (a review, like any other); a role's change, applied by an admin. A
production secret is rotated in the `production` environment; a dev key is made again by deleting it on the VM
(`/etc/dfo-dev/*.env`, `/etc/wireguard/wg0.key`) and running bootstrap.sh again.
