#!/usr/bin/env bash
# DEV-ENV (2026-10-19, bible/01-Overview/Release-Flow.md): THE DEV ENVIRONMENT'S VM, STOOD UP.
#
# Run once, as root, on a fresh Ubuntu 24.04 VM of its own - from a clone of this repository (it is public):
#
#   git clone --depth 1 https://github.com/Lattymoy/daggerfall-js-source /opt/dfo-dev-src
#   sudo CI_WG_PUBLIC_KEY=... CI_SSH_PUBLIC_KEY='ssh-ed25519 ...' /opt/dfo-dev-src/ops/dev/bootstrap.sh
#
# and again (a `git pull` first) whenever a file beside it changes: every step is idempotent, the keys it makes are
# made once, and the dev state (its accounts, rooms and saves, /var/lib/dfo-dev) is kept.
#
# What it stands up - main's game, the relay and the account service in their Cloudflare runtime (workerd, by
# `wrangler dev`, with local D1, R2 and Durable Objects) - is reached through WIREGUARD ALONE:
#   - the one door from the internet is WireGuard's (udp 51820); and port 80, where Caddy answers Let's Encrypt's
#     challenge for the site's certificate and redirects everything else to a door that is shut outside the network
#   - inside the network (10.66.0.0/24, this VM 10.66.0.1): the site at https://$DEV_HOST - /relay and /accounts the
#     two Workers - SSH, and the network's own DNS, which names $DEV_HOST 10.66.0.1 for its members (a public record
#     names this VM's own address, for the certificate's challenge)
#   - the network's members are ops/dev/peers.json's, applied by every dev deploy; the CI runner's key (CI_WG_PUBLIC_KEY,
#     10.66.0.2) is held here, so a deploy can never shut its own door
# SSH outside the network is shut too, unless KEEP_PUBLIC_SSH=1 - the provider's console is the way back in.
#
#   DEV_HOST           the site's name (default dev.daggerfalljs.dev); its public A record names this VM's address
#   CI_WG_PUBLIC_KEY   the CI runner's WireGuard public key (`node tools/devPeer.mjs keys`; its private half is the
#                      `dev` environment's DEV_WG_PRIVATE_KEY secret)
#   CI_SSH_PUBLIC_KEY  the deploy's SSH public key (its private half is the `dev` environment's DEV_SSH_PRIVATE_KEY)
#   KEEP_PUBLIC_SSH    1 keeps SSH open outside the network (key login only)
set -euo pipefail

DEV_HOST=${DEV_HOST:-dev.daggerfalljs.dev}
KEEP_PUBLIC_SSH=${KEEP_PUBLIC_SSH:-0}
HERE=$(cd "$(dirname "$0")" && pwd)
NODE_MAJOR=22

[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
[[ "${CI_WG_PUBLIC_KEY:-}" =~ ^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw480]=$ ]] || { echo "CI_WG_PUBLIC_KEY is no WireGuard key" >&2; exit 1; }
[[ "${CI_SSH_PUBLIC_KEY:-}" =~ ^ssh-(ed25519|rsa)\ [A-Za-z0-9+/=]+ ]] || { echo "CI_SSH_PUBLIC_KEY is no SSH public key" >&2; exit 1; }
[[ "$DEV_HOST" =~ ^[a-z0-9.-]+$ ]] || { echo "DEV_HOST is no host name" >&2; exit 1; }

echo "== packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q wireguard-tools nftables dnsmasq caddy jq curl rsync xz-utils ca-certificates

echo "== node $NODE_MAJOR (nodejs.org's own build, its checksum checked)"
if ! node --version 2>/dev/null | grep -q "^v$NODE_MAJOR\."; then
  base="https://nodejs.org/dist/latest-v$NODE_MAJOR.x"
  tmp=$(mktemp -d)
  curl -fsSL "$base/SHASUMS256.txt" -o "$tmp/SHASUMS256.txt"
  file=$(grep -oE "node-v$NODE_MAJOR\.[0-9]+\.[0-9]+-linux-x64\.tar\.xz" "$tmp/SHASUMS256.txt" | head -n 1)
  curl -fsSL "$base/$file" -o "$tmp/$file"
  (cd "$tmp" && grep " $file\$" SHASUMS256.txt | sha256sum -c -)
  tar -xJf "$tmp/$file" -C /usr/local --strip-components=1
  rm -rf "$tmp"
fi
node --version

echo "== the deploy's user and its places"
id dfo >/dev/null 2>&1 || useradd --system --create-home --home-dir /var/lib/dfo-dev/home --shell /bin/bash dfo
install -d -o dfo -g dfo -m 0755 /srv/dfo-dev /srv/dfo-dev/releases /var/lib/dfo-dev /var/lib/dfo-dev/state /var/lib/dfo-dev/home
install -d -o dfo -g dfo -m 0700 /var/lib/dfo-dev/home/.ssh
printf '%s\n' "$CI_SSH_PUBLIC_KEY" > /var/lib/dfo-dev/home/.ssh/authorized_keys
chown dfo:dfo /var/lib/dfo-dev/home/.ssh/authorized_keys && chmod 0600 /var/lib/dfo-dev/home/.ssh/authorized_keys
install -d -m 0750 -g dfo /etc/dfo-dev

echo "== the Workers' keys: the dev environment's own pair, made once - never production's"
if [ ! -s /etc/dfo-dev/accounts.env ] || [ ! -s /etc/dfo-dev/relay.env ]; then
  { read -r ipriv; read -r ipub; } < <(node "$HERE/../../tools/mintIdentityKeys.mjs" --pipe)
  { read -r gpriv; read -r gpub; } < <(node "$HERE/../../tools/mintGateKeys.mjs" --pipe)
  umask 027
  printf 'IDENTITY_PRIVATE_KEY=%s\nIDENTITY_PUBLIC_KEY=%s\nGATE_PUBLIC_KEY=%s\n' "$ipriv" "$ipub" "$gpub" > /etc/dfo-dev/accounts.env
  printf 'GATE_SIGNING_KEY=%s\nIDENTITY_PUBLIC_KEY=%s\n' "$gpriv" "$ipub" > /etc/dfo-dev/relay.env
  umask 022
  chgrp dfo /etc/dfo-dev/accounts.env /etc/dfo-dev/relay.env
  chmod 0640 /etc/dfo-dev/accounts.env /etc/dfo-dev/relay.env
fi

echo "== WireGuard: this VM 10.66.0.1, the CI runner 10.66.0.2"
install -d -m 0700 /etc/wireguard
[ -s /etc/wireguard/wg0.key ] || (umask 077 && wg genkey > /etc/wireguard/wg0.key)
umask 077
cat > /etc/wireguard/wg0.base <<EOF
[Interface]
Address = 10.66.0.1/24
ListenPort = 51820
PrivateKey = $(cat /etc/wireguard/wg0.key)

# the CI runner (dev-deploy.yml) - held here, so a deploy's own peer list can never shut its door
[Peer]
PublicKey = $CI_WG_PUBLIC_KEY
AllowedIPs = 10.66.0.2/32
EOF
umask 022
[ -s /etc/wireguard/wg0.conf ] || install -m 0600 /etc/wireguard/wg0.base /etc/wireguard/wg0.conf
echo 'net.ipv4.ip_forward = 1' > /etc/sysctl.d/90-dfo-dev.conf
sysctl -q -p /etc/sysctl.d/90-dfo-dev.conf
install -m 0755 "$HERE/dfo-dev-root" /usr/local/sbin/dfo-dev-root
systemctl enable -q --now wg-quick@wg0
# the members as the current release names them (none before the first deploy) - over the base just written
if [ -e /srv/dfo-dev/current ]; then /usr/local/sbin/dfo-dev-root peers /srv/dfo-dev/current/repo/ops/dev/peers.json; else /usr/local/sbin/dfo-dev-root peers; fi

echo "== the firewall: WireGuard and the certificate's challenge from outside, the rest from inside alone"
sed -e "s/@PUBLIC_SSH@/$([ "$KEEP_PUBLIC_SSH" = 1 ] && echo 'tcp dport 22 accept' || echo '# ssh: inside the network alone')/" "$HERE/nftables.conf" > /etc/nftables.conf
nft -c -f /etc/nftables.conf
systemctl enable -q nftables
systemctl restart nftables

echo "== the network's DNS: $DEV_HOST is 10.66.0.1 inside it"
sed -e "s/@DEV_HOST@/$DEV_HOST/g" "$HERE/dnsmasq.conf" > /etc/dnsmasq.d/dfo-dev.conf
systemctl enable -q dnsmasq
systemctl restart dnsmasq

echo "== the services"
install -m 0644 "$HERE/dfo-dev-relay.service" "$HERE/dfo-dev-accounts.service" "$HERE/dfo-dev-cron.service" "$HERE/dfo-dev-cron.timer" /etc/systemd/system/
install -m 0755 "$HERE/dfo-dev-cron" /usr/local/bin/dfo-dev-cron
printf 'dfo ALL=(root) NOPASSWD: /usr/local/sbin/dfo-dev-root\n' > /etc/sudoers.d/dfo-dev
chmod 0440 /etc/sudoers.d/dfo-dev
visudo -cq
install -d /etc/systemd/system/caddy.service.d
printf '[Service]\nEnvironment=DFO_DEV_HOST=%s\n' "$DEV_HOST" > /etc/systemd/system/caddy.service.d/dfo-dev.conf
install -m 0644 "$HERE/Caddyfile" /etc/caddy/Caddyfile
systemctl daemon-reload
DFO_DEV_HOST=$DEV_HOST caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl enable -q dfo-dev-relay dfo-dev-accounts dfo-dev-cron.timer caddy
systemctl restart caddy
if [ -e /srv/dfo-dev/current ]; then /usr/local/sbin/dfo-dev-root start; fi

cat <<EOF

== DONE. For the repository's \`dev\` environment (bible/01-Overview/Release-Flow.md, DEV-ENV):
   this VM's WireGuard public key (the variable DEV_WG_SERVER_KEY, and every member's config):
     $(wg pubkey < /etc/wireguard/wg0.key)
   its WireGuard endpoint (the secret DEV_WG_ENDPOINT): <this VM's public address>:51820
   its SSH host key, as known_hosts names it inside the network (the secret DEV_SSH_KNOWN_HOSTS):
     $(awk '{print "10.66.0.1", $1, $2}' /etc/ssh/ssh_host_ed25519_key.pub)
   and the public A record: $DEV_HOST -> this VM's public address (the certificate's challenge).
Then dispatch dev-deploy.yml on main.
EOF
