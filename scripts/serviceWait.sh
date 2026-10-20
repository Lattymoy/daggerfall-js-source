#!/usr/bin/env bash
# RELEASE-FLOW (2026-10-19, bible/01-Overview/Release-Flow.md), AUDIT RELEASE-FLOW A6: A BUILD REACHES THE PLAYERS ONLY
# ONCE THE SERVICES IT TALKS TO SERVE IT.
#
#   scripts/serviceWait.sh    in a checkout of the build: wait until the relay serves the build's RELAY_VERSION (or a
#                             later one) and the account service its ACCOUNT_VERSION (or a later one) - both asked every
#                             twenty seconds for five hours fifty minutes by the clock (inside a job's six); exit 1 if
#                             they never do, so nothing is published
#
# Read off the tree, never typed: the relay's version (src/net/wire.js) and host (src/net/online.js DEFAULT_SERVER), the
# account service's version (server-account/src/service.js) and base (src/net/accountClient.js DEFAULT_ACCOUNT_SERVICE).
#
# The site waited for the account service alone (AUDIT PRE-MERGE 0929 T2: forms that ask what a service from before them
# records as never asked), and nothing waited for the relay while every push deployed the relay too. Since RELEASE-FLOW
# the deploys are dispatched together and approved apart - the relay's at an hour the players can spare, since it drops
# them all - so a release that moved only RELAY_VERSION put a client ahead of its relay for as long as that approval
# waited: the one case the relay's drift-deploy had closed (online.js). The site's publish (deploy.yml) and the desktop
# release's (release-desktop.yml) both wait here. As long as the chain may take: the account deploy itself waits up to
# five and a half hours on the relay (account-deploy.yml), and this outwaits it by more than its own deploy and checks.
#
# BY THE CLOCK, NOT BY A COUNT OF ASKS (AUDIT RELEASE-FLOW A6): 1050 asks twenty seconds apart was five hours fifty
# minutes only while an ask took no time, and a round asks twice, each up to fifteen seconds - services slow to answer
# would have run the job into GitHub's six-hour ceiling, killed with nothing said. No round starts after the budget, so
# the last ends within thirty seconds of it; with answers that take no time it is the same 1050 rounds.
set -euo pipefail
relay_want=$(grep -oP "^export const RELAY_VERSION = '\K[^']+" src/net/wire.js || true)
relay_host=$(grep -oP "^export const DEFAULT_SERVER = 'wss://\K[^'/]+" src/net/online.js || true)
want=$(grep -oP "^export const ACCOUNT_VERSION = '\K[^']+" server-account/src/service.js || true)
base=$(grep -oP "^export const DEFAULT_ACCOUNT_SERVICE = '\K[^']+" src/net/accountClient.js || true)
for v in relay_want relay_host want base; do
  [ -n "${!v}" ] || { echo "::error::could not read $v off the tree - nothing is published"; exit 1; }
done
# a version is a name with a number at its end (world215, acct160): the one wanted, or a later one
n() { printf '%s' "$1" | grep -oE '[0-9]+$' || echo -1; }
served() { [ "$1" = "$2" ] || { [ -n "$1" ] && [ "$(n "$1")" -ge "$(n "$2")" ]; }; }
deadline=$(( $(date +%s) + 21000 ))
for ((i = 1; ; i++)); do
  relay=$(curl -fsS --max-time 15 "https://$relay_host/health" | sed -n 's/.*"version":"\([^"]*\)".*/\1/p' || true)
  got=$(curl -fsS --max-time 15 "$base/v1/health" | sed -n 's/.*"v":"\([^"]*\)".*/\1/p' || true)
  if served "$relay" "$relay_want" && served "$got" "$want"; then
    echo "the relay serves $relay and the account service $got - this build may reach the players"
    exit 0
  fi
  # the next round, twenty seconds on, would start past the budget: none does
  [ $(( $(date +%s) + 20 )) -lt "$deadline" ] || break
  echo "the relay serves '${relay:-unreachable}' (this build: $relay_want), the account service '${got:-unreachable}' ($want) - waiting (round $i)"
  sleep 20
done
echo "::error::the relay and the account service never came to serve $relay_want and $want in five hours fifty minutes - not publishing a build they would not answer (see relay-deploy.yml's and account-deploy.yml's runs, then re-run this)"
exit 1
