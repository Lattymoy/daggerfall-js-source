# AUDIT RELEASE-FLOW - production from `release`, the hotfix road, `/check`, the roles, the dev VM, 2026-10-19

The owner: *"Can we give this a proper audit and ensure perfection"*, of RELEASE-FLOW (`Release-Flow.md`, pull request
#1060) at `13aba3f5d`. Six cold lanes read a frozen copy of it: A, the production workflows (GitHub's docs, a toy git
repository driving the snapshot's own release scripts, a treeless clone of the real history, read-only API calls); B,
HOTFIX-BACK, CHECK-ASK and `check.yml` (the workflows' own steps run against scratch repositories and a recording `gh`;
GitHub's docs); C, the roles (every API body checked against GitHub's own OpenAPI description, the live repository read
with GET alone, the tool driven by a fake `gh`); D, the dev VM (wrangler 4.131.1 and miniflare read from source, and
Ubuntu 24.04's own caddy, nft, dnsmasq, systemd, rsync and wireguard-tools run); E, the client's wiring (Vite's build
and dev server run, tsc, esbuild bundles); F, the record and the pins (every bible gate, the claims against the code,
the recorded mutants traced).

Every finding was verified before it was fixed - reproduced where it could be run, read off the documentation where it
could not - and each fix is pinned by a test that fails on the audited code. The fixes changed things beyond what a lane
saw, and those were verified the same way (*Found in verification*). Mutation-proven: `tools/mutants/releaseflow.json`
(134, all dead), and the records re-aimed in `audit0929_terms.json`, `deploy_wait.json`, `flow1.json`, `patreonlink.json`,
`rel4.json` and `perfon4.json`.

## Lane A - the production workflows

| ID | Sev | Finding | Fix |
|---|---|---|---|
| A1 | Major | **A release could be published with no approval.** The publish needs only a workflow's own token, so the environment gated this release-desktop.yml alone: any writer could dispatch the file as an older commit holds it (no environment there) on a branch pushed at that commit, or push an `app-v*` tag at one - and a bogus high version, marked latest, would have held every later release from the updater. | IN PART: the release tags are a ruleset's (`release-tags`: never moved or deleted but by an admin). RECORDED for the owner: the whole gate is an identity only `production` holds (a GitHub App whose key is that environment's secret) publishing the releases, and creating `app-v*` tags restricted to it (`Release-Flow.md`, *What GitHub does not hold yet*). |
| A2 | Risk | **An approval the day after found nothing to publish.** The desktop installers were kept a day, the site's artifact the action's default day, while a job waits on its reviewers up to thirty days. | Kept a week (`retention-days: 7`), the runbook says to dispatch again past it. |
| A3 | Risk | **Any dispatch of the site cancelled an approved publish** - `group: pages`, cancelled in progress - even one on main that then stopped at its door. | Release's runs one group, never cancelled; any other run a group of its own (release-desktop's shape). Extended in verification (V4). |
| A4 | Risk | **Deploying over a relay whose `/health` did not answer took `force`**, which also voids every live siege and Elite Breach - and the drift read an unreachable relay as a deploy, so the 500-seed sweep ran and an approval was asked for a deploy that would refuse. | Its own input, `blind`, which keeps every wait; refused in `drift`, before the sweep or an approval. |
| A5 | Risk | **A data operation pending behind a deploy was cancelled by the next one dispatched** - GitHub keeps one pending run a group. | `queue: max` on the account service's shared group, the post and the clears. Extended in verification (V3). |
| A6 | Risk | **The site and the desktop release waited for the account service alone** - and the desktop release for nothing - while the relay's deploy waits on its own approval: a release that moved only `RELAY_VERSION` put every client ahead of its relay. | `scripts/serviceWait.sh`, run by both publishes: the relay's version and the account service's, by the clock (V2). |
| A7 | Risk | **The site job built the preview branch's code holding the right to publish** (`pages`, `id-token` on every job). | The publishing job alone holds them; the workflow reads by default. With F2. |

## Lane B - HOTFIX-BACK, CHECK-ASK and `check.yml`

| ID | Sev | Finding | Fix |
|---|---|---|---|
| B1 | Major | **A dispatched `check` never counts for a pull request** (GitHub's own docs), and a pull request a workflow's token opens gets its `pull_request` run held for approval. The back-merge dispatched an uncountable check; its real one waited, unsaid; `/check` put nothing on the pull request. | Nothing dispatched for the back-merge: its body and the runbook say *Approve workflows to run*. A dispatched run says its result on the commit as a status of its own, `check (asked)` - which informs, and never passes a pull request (said wherever `/check` is described). |
| B2 | Major | **Any GitHub user could take the back-merge** with a fork's branch named `backmerge/release`: `gh pr list --head` filters no repository, so the workflow wrote its body onto the stranger's pull request and opened none. Reproduced with the workflow's own step. | The REST lookup `head=<owner>:backmerge/release`, and this repository's own branch alone. |
| B3 | Major | **"Promote only while no back-merge is open" was false**: the lack was the trees' alone and asked on release's pushes alone, so a fix carried to main by hand, or a back-merge squashed, left the histories apart and the next promotion conflicting. Reproduced: both conflict. | The lack is history OR tree; asked on every push to main as well, and by hand; the runbook says how a conflicted promotion is resolved. |
| B4 | Risk | **A merge into the open back-merge that made a workflow file no branch holds is refused to the workflow's token**, and the run failed unsaid. From the docs, not run on GitHub. | A refused push is said on the pull request, for a person. |
| B5 | Risk | **`/check` on the promotion (main's branch) cancelled main's own run**, the one that counts. | The event in the concurrency group. |
| B6 | Nit | **A `/check` over 64 KB died of SIGPIPE** (reproduced), and **every reader's `/check` made the bot speak.** | The first line read by bash alone; a reader gets a reaction. |

## Lane C - the roles

| ID | Sev | Finding | Fix |
|---|---|---|---|
| C1 | Major | **The admin bypass and the required check were one ruleset**, so a bypass merge skipped the check - and every pull request a session opens is the owner's own, whose approval must be another's or the bypass. | Split: the GATES (the check, no deletion, no force push) bypassed by nobody; the REVIEWS bypassed by an admin, by a pull request alone. |
| C2 | Risk | **A reviewer could approve code they pushed themselves** (`require_last_push_approval` off). | On. |
| C3 | Risk | **The plan called in sync what it never compared**: `prevent_self_review`, `wait_timer`, any undeclared ruleset parameter, the check's app. Probed. | Every field compared; an undeclared one must be GitHub's unset default; the check pinned to GitHub Actions (`integration_id` 15368). |
| C4 | Risk | **CODEOWNERS was read at its first `*`** where GitHub applies the last match; release's lags main's; "may open a pull request" understated "create and approve". | Exactly one rule; the plan reads CODEOWNERS as main and release hold it; worded as GitHub does. |
| C5 | Risk | **`roles.admins` was never applied, the reviewers' write access never checked**, and an environment's admins may approve past its reviewers. | The roles checked against GitHub's collaborators - nothing applied while they disagree; the admin bypass on an environment documented (the admin is a release manager). With F4. |
| C6 | Nit | **Lists read one page deep, environment names by case.** Probed. | `per_page=100`; names compared as GitHub compares them. |
| C7 | Nit | **Seven release managers passed** where GitHub takes six; **any checkout was applied.** | Capped at six; `--apply` refuses files that are not origin/main's. |
| C8 | Risk | **The cut-over had a window**: release brought up before the environments that guard it existed, a dispatch there creating one bare. | `--apply --without-rulesets` first, then release, then the rulesets; the runbook's order. |
| C9 | Risk | **The gate holds on a public repository alone** (the plans' environment reviewers). | The tool refuses a private repository; said. |

## Lane D - the dev VM

| ID | Sev | Finding | Fix |
|---|---|---|---|
| D1 | Blocker | **Re-running bootstrap.sh as root wrote and chowned through paths the deploy's user owns**: a symlink swapped in between runs made `/etc` dfo's, and the next `sudo` dfo's code. Reproduced (install and the key's write through a symlink). | Root writes nothing beneath a directory dfo owns: `/var/lib/dfo-dev` root's first, dfo's places refused unless directories, what lies beneath them made by dfo, the deploy's key root's own file that sshd reads for dfo. A model of the section's writes over an earlier layout holds it. |
| D2 | Major | **Caddy's admin API answered any local process**: `POST /load` from dfo's code turned port 80 into a public proxy to a Worker (reproduced on caddy 2.6.2). | `admin off` (bootstrap restarts Caddy, never reloads). |
| D3 | Major | **The dev feeds and law door never ran**: the relay and the service send nothing to a URL that is not `https://`, and the units gave `http://` ones. | `https://` URLs through the bindings (the URL names the path); each driven with its unit's own value (`test/net/devenv_feeds.test.js`). |
| D4 | Major | **Every member reached every other member's machine** through the VM. | Forwarded to the services' addresses alone (`10.66.0.3`-`.9`). |
| D5 | Risk | **A members' list could take the CI runner's key** and with it the deploy's road in (reproduced); **a failed strip synced an empty config.** | The base's keys refused to a member; a strip that fails or gives nothing syncs nothing. |
| D6 | Risk | **A failed migration left dev down**, and a bad members' list failed the deploy after the swap. | The members applied first; a failure before the swap starts the release before again. |
| D7 | Risk | **A commit shipped again deleted its running release's wrangler**; **a rollback deleted the release made current** (the prune by first-made time; reproduced). | rsync leaves `node_modules` and `.wrangler`; the release made current is the newest and the current never pruned - pinned under a clock set back too. |
| D8 | Nit | **`--link-dest` linked nothing** - fresh mtimes; every release a whole copy (reproduced). | By content: `--checksum --no-times`. |
| D9 | Risk | **The site name's AAAA was asked upstream** (reproduced on dnsmasq 2.91), so a public IPv6 record would send members to a shut door; and the VM answers all a member's names. | The name kept on the network for both families, its subdomains handed on (verified on dnsmasq). RECORDED: the VM as members' resolver is the design's cost, said in the doc. |
| D10 | Nit | **The certificate tried TLS-ALPN at a shut 443; HTTP/3 was offered over a UDP 443 open nowhere** (verified). | The HTTP challenge alone; `protocols h1 h2`. |
| D11 | Risk | **The deploy key opened a forwarding shell from anywhere it reached; "key login only" was never set.** | `restrict,from="10.66.0.2"`; key login alone, first of the drop-ins (verified with sshd 9.6). RECORDED: a member can reach sshd, which takes keys alone. |
| D12 | Risk | **The dev build ran every dependency's install scripts, with sudo, in the job that then wrote the network's key and the deploy's.** | Two jobs: the build hands the site on and holds no secret; the deploy runs nothing a dependency ships. |
| D13 | Risk | **Node's checksums came over the same channel, unsigned; x64 alone; never updated.** | Pinned version and per-architecture SHA-256s from a signed release (verified with gpgv against nodejs/release-keys); a moved pin reinstalls. |
| D14 | Nit | **A reboot before the first deploy restarted the units forever; the cron failed each minute with the service down; wrangler kept its own log files; `~/.npm` grew.** | `ConditionPathExists`; the cron passes a service not listening; `WRANGLER_WRITE_LOGS=false` (verified in wrangler's source); the npm cache the release's own. |

## Lane E - the client's wiring

| ID | Sev | Finding | Fix |
|---|---|---|---|
| E1 | Risk | **A stamp the client refused became the players' services** - a dev build of main's code signing members into production - and the deploy's grep saw the text, not what the page calls. Latent; reproduced in node. | A refused stamp throws (it calls no service home); the dev deploy asks the client's own laws before it builds. |
| E2 | Risk | **`npm run dev` ignored the stamp**, and reading the whole env object inlined every `VITE_*` variable into the bundle (reproduced). | `import.meta.env?.VITE_DFO_*` by name, with Vite's types; pinned through the dev server's own transform. |
| E3 | Nit | **The build test passed a mutant that read `process.env`.** | The built text asserted; the module imported in a child with no stamp in its environment. |

## Lane F - the record and the pins

| ID | Sev | Finding | Fix |
|---|---|---|---|
| F1 | Major | **`/check` skipped the hosts' ceilings** (gated by the event name; reproduced), while the record called it the whole check. | `verify.yml`'s `ceilings` input: on in `check.yml`, off in the deploys. |
| F2 | Major | **The players' site served the preview branch's tip**, which any writer moves and no review or release saw, on the origin that keeps the account's secret. | Built at the commit `deploy.yml` names (the branch's tip since 2026-08-26), with no token in its checkout; moving it is a pull request. |
| F3 | Major | **"Nothing that is not a release manager merges into release" was unenforced.** | Release's `update` rule: an admin merges it, by a pull request. Home.md and CLAUDE.md say what GitHub holds and what is the house's rule. |
| F4 | Major | **`roles.admins` had no effect.** | C5. |
| F5 | Risk | **Nothing held the dev release's directories to the Workers' import graphs**; and the account Worker's shared laws reach it only if its deploy is dispatched. | Both graphs held inside the shipped directories; the runbook dispatches the account deploy every release. |
| F6 | Nit | **Old process stated as current**: two incident tools "on main", the update notice's table, Host-Split's ceiling, Desktop-App's REL3 and REL8 headings, four comments, three test titles, the account deploy's messages. | Each corrected; the prose law reads the site's cadence two more ways. |
| F7 | Nit | **Settings the page states were unpinned; the self-review reason was wrong; a named mutant had no record.** | Pinned; the reason corrected; the record written. |
| F8 | Nit | **The dev update number contradicted itself.** | No build of main is numbered: a dev build names its commit. |

## Found in verification

| ID | Sev | Finding | Fix |
|---|---|---|---|
| V1 | Bug | **A quote ended inside a message**: the account deploy's chat-safety step, rewritten by this audit's own message fixes (F6), would have died on a syntax error after its Worker went live. Caught re-reading the diff before it was committed; nothing in the suite read the step. | Every `run:` of every workflow is parsed by `bash -n` in the suite. |
| V2 | Risk | **The wait's budget was a count of asks** (DEPLOY-WAIT's 1050 x 20 s), true only while an ask takes no time - and A6 asks twice a round, each up to 15 s: slow services would have run the job into GitHub's six-hour ceiling, killed with nothing said. | By the clock: no round starts past five hours fifty minutes; the last ends within thirty seconds of it. |
| V3 | Risk | **A5's class was wider than lane A's five**: the two production load reads (each its own hours), the release notes (one pull request's edit a run) and main's new realm rollback (merged during the audit). | One law over every workflow: a group whose runs carry their own ask queues them; the groups whose newest run is the one meant are named. |
| V4 | Risk | **A3's class**: the relay deploy shared one group across branches, so a stray dispatch took a pending release run's place; the dev deploy the same for main. | Their own branch's group, as deploy.yml's. |
| V5 | Risk | **main's realm-rollback.yml, merged during the audit, held production's token outside the environment**, run "on main". | RELEASE-FLOW's terms, as every data operation: the production environment, on release, queued. |

## Checked and sound

Every production secret is used inside `production` alone; no `secrets: inherit`; the dev deploy reads only `DEV_*`. The
release guards stop everything downstream; no `event_name == 'push'` test remains; the waits run one way (site → account
service → relay) and cannot deadlock. The update numbers, the notes and REL7's renotes over promotions, hotfixes and a
back-merge (a toy repository with the snapshot's own code); DA13's update size across real manifests (5.76%). The
rulesets' and environments' API bodies against GitHub's OpenAPI; the calls' order; the tool never deletes what it does
not name. `/check`'s injection surface (nothing checked out; inputs as environment); its permission read; forks refused.
merge-tree's exits and the conflict path. The VM: dfo-dev-root's input validation, file modes, nftables for both
families, dnsmasq bound to the network, Caddy's refusals of the Workers' own doors in every spelling, wrangler's flags
and its D1 ledger, the units' hardening, a reboot. The client: every call site uses the build's home; an unstamped
build behaves as before; neither Worker bundles the client's home. Every bible gate, before and after.

## Seen, not this change's

With ARENA2 (`tools/fetch-data.sh`), three tests fail on main - at `e30547354` and again at `6906e5672` - exactly as on
this branch: IT1's and WD1's vendored patches rebuilding their authors' files (`it1_worlddata`, `wd1_worlddata`) and
CRATE-FREE's real-data landing (`fb1004d_cratefree`). EG-ZD's spans' clock test is a load flake: it fakes `Date.now`,
but the span seconds run on the real `performance.now` (`render/deadlands.js` anchoredClock), and it allows 50 ms of
real time between two readings.

F1's other half, seen after the audit: merging main (#1047, QUESTLINES) on 2026-10-20 found main's own `bootWorld` one
logical line over its ceiling. Each pull request had fit against the base it saw, and main's push runs skipped the
ceiling as `/check` did - the same event-name gate - so main stood over it unmeasured until the questlines' own
follow-up took it back out (#1073, the ask door built in the quest bridge). With F1's fix, `check.yml` holds the
ceiling on main's pushes too, so the next overflow turns main's own check red the push it lands.
