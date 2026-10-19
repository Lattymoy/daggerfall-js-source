#!/usr/bin/env bash
# DEV-ENV (2026-10-19, bible/01-Overview/Release-Flow.md): ONE COMMIT OF MAIN MADE THE DEV ENVIRONMENT'S.
#
# Run on the dev VM, as dfo, by dev-deploy.yml - once it has put the release at /srv/dfo-dev/releases/<commit>:
#   repo/  server/, server-account/, src/, vendor/ and ops/: what the two Workers bundle, and this
#   site/  main's site, built to call the dev services home (src/net/serviceHome.js)
# The Workers' state - the dev accounts, rooms and saves in /var/lib/dfo-dev/state - is the environment's and outlives
# every release; the account service's migrations are applied to it here, by wrangler's own ledger, each once.
set -euo pipefail
sha=${1:-}
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "deploy.sh <commit>: \"$sha\" is no commit" >&2; exit 1; }
rel=/srv/dfo-dev/releases/$sha
if ! { [ -d "$rel/repo/server" ] && [ -f "$rel/site/index.html" ]; }; then echo "$rel holds no release" >&2; exit 1; fi
export HOME=/var/lib/dfo-dev/home CI=1 WRANGLER_SEND_METRICS=false

# wrangler, as server/package-lock.json pins it - the release before's, linked, when the lock did not move
prev=$(readlink -f /srv/dfo-dev/current 2>/dev/null || true)
if [ -n "$prev" ] && [ "$prev" != "$rel" ] && [ -d "$prev/repo/server/node_modules" ] && cmp -s "$prev/repo/server/package-lock.json" "$rel/repo/server/package-lock.json"; then
  cp -al "$prev/repo/server/node_modules" "$rel/repo/server/node_modules"
else
  (cd "$rel/repo/server" && npm ci --no-audit --no-fund --loglevel=error)
fi
wrangler=$rel/repo/server/node_modules/.bin/wrangler

sudo /usr/local/sbin/dfo-dev-root stop
(cd "$rel/repo/server-account" && "$wrangler" d1 migrations apply daggerfall-accounts --local --persist-to /var/lib/dfo-dev/state)
ln -sfn "$rel" /srv/dfo-dev/current.next
mv -T /srv/dfo-dev/current.next /srv/dfo-dev/current
sudo /usr/local/sbin/dfo-dev-root start
sudo /usr/local/sbin/dfo-dev-root peers "$rel/repo/ops/dev/peers.json"

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

# the five newest releases kept, the current among them
find /srv/dfo-dev/releases -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -rn | tail -n +6 | cut -d' ' -f2- | xargs -r rm -rf
