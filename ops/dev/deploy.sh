#!/usr/bin/env bash
# DEV-ENV (2026-10-19, bible/01-Overview/Release-Flow.md): ONE COMMIT OF MAIN MADE THE DEV ENVIRONMENT'S.
#
# Run on the dev VM, as dfo, by dev-deploy.yml - once it has put the release at /srv/dfo-dev/releases/<commit>:
#   repo/  server/, server-account/, src/, vendor/ and ops/: what the two Workers bundle, and this
#   site/  main's site, built to call the dev services home (src/net/serviceHome.js)
# The Workers' state - the dev accounts, rooms and saves in /var/lib/dfo-dev/state - is the environment's and outlives
# every release; the account service's migrations are applied to it here, by wrangler's own ledger, each once.
#
# AUDIT RELEASE-FLOW D6: A DEPLOY THAT FAILS LEAVES THE DEV ENVIRONMENT RUNNING. The members' list is checked and applied
# before anything is stopped (a bad one failed the deploy after the swap); and from the stop to the swap the release
# before is still current, so a failure there - a migration refused - starts it again as it was: the migrations apply as
# one batch, and a refused one has written nothing. AUDIT RELEASE-FLOW D7: the release made current is the newest
# (a commit shipped again, to roll back, was pruned as the oldest), the current one is never pruned, and a commit shipped
# again keeps the wrangler it already holds (dev-deploy.yml's rsync leaves node_modules and .wrangler where they are).
set -euo pipefail
sha=${1:-}
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "deploy.sh <commit>: \"$sha\" is no commit" >&2; exit 1; }
SRV=${DFO_DEV_SRV:-/srv/dfo-dev} LIB=${DFO_DEV_LIB:-/var/lib/dfo-dev}   # a test's own places; over ssh, the VM's
rel=$SRV/releases/$sha
if ! { [ -d "$rel/repo/server" ] && [ -f "$rel/site/index.html" ]; }; then echo "$rel holds no release" >&2; exit 1; fi
# D14: wrangler's own log files kept nowhere - the units' output is journald's
export HOME=$LIB/home CI=1 WRANGLER_SEND_METRICS=false WRANGLER_WRITE_LOGS=false
root() { sudo /usr/local/sbin/dfo-dev-root "$@"; }

root peers "$rel/repo/ops/dev/peers.json"

# wrangler, as server/package-lock.json pins it: the one this release holds already (the same commit shipped again), the
# release before's linked when the lock did not move, else installed - into a cache of the release's own, pruned with it
# (D14: ~/.npm grew with every lock that moved)
prev=$(readlink -f "$SRV/current" 2>/dev/null || true)
if [ -x "$rel/repo/server/node_modules/.bin/wrangler" ]; then
  :
elif [ -n "$prev" ] && [ "$prev" != "$rel" ] && [ -d "$prev/repo/server/node_modules" ] && cmp -s "$prev/repo/server/package-lock.json" "$rel/repo/server/package-lock.json"; then
  cp -al "$prev/repo/server/node_modules" "$rel/repo/server/node_modules"
else
  (cd "$rel/repo/server" && npm ci --no-audit --no-fund --loglevel=error --cache "$rel/.npm")
fi
wrangler=$rel/repo/server/node_modules/.bin/wrangler

trap 'echo "the deploy failed before the swap - the release before is started again" >&2; root start' EXIT
root stop
(cd "$rel/repo/server-account" && "$wrangler" d1 migrations apply daggerfall-accounts --local --persist-to "$LIB/state")
touch "$rel"
ln -sfn "$rel" "$SRV/current.next"
mv -T "$SRV/current.next" "$SRV/current"
trap - EXIT
root start

relay='' accounts=''
for _ in $(seq 1 90); do
  relay=$(curl -fsS --max-time 5 http://127.0.0.1:8787/health 2>/dev/null | jq -r '.version // empty' || true)
  accounts=$(curl -fsS --max-time 5 http://127.0.0.1:8788/v1/health 2>/dev/null | jq -r '.v // empty' || true)
  [ -n "$relay" ] && [ -n "$accounts" ] && break
  sleep 2
done
if [ -z "$relay" ] || [ -z "$accounts" ]; then
  echo "the Workers did not come up: relay '${relay}', accounts '${accounts}' (journalctl -u dfo-dev-relay -u dfo-dev-accounts)" >&2
  exit 1
fi
echo "the dev environment runs ${sha:0:12}: relay $relay, account service $accounts"

# the current release and the four newest besides it kept
cur=$(readlink -f "$SRV/current")
find "$SRV/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -rn | cut -d' ' -f2- | { grep -vxF "$cur" || true; } | tail -n +5 | xargs -r rm -rf
