#!/usr/bin/env bash
# deploy/provision.sh — run once as root on a fresh Ubuntu 24.04 Lightsail instance:
#   scp -r deploy ubuntu@<ip>:/tmp/deploy && ssh ubuntu@<ip> sudo bash /tmp/deploy/provision.sh
# Idempotent: safe to re-run after editing the Caddyfile or the unit.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
DOMAIN=scrims.hnguyentran.com

# 1 GB swap: the box has 1 GB RAM and runs Node plus Postgres.
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
sysctl -w vm.swappiness=10 >/dev/null
echo 'vm.swappiness=10' > /etc/sysctl.d/90-owscrims.conf

apt-get update -q
apt-get install -y -q ca-certificates curl gnupg lsb-release debian-keyring debian-archive-keyring apt-transport-https rsync

# Node 24 (NodeSource)
if ! command -v node >/dev/null || [[ "$(node -v)" != v24* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y -q nodejs
fi

# Postgres 18 (PGDG)
if ! command -v psql >/dev/null; then
  install -d /usr/share/postgresql-common/pgdg
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
  apt-get update -q
  apt-get install -y -q postgresql-18
fi
PGCONF=/etc/postgresql/18/main/postgresql.conf
sed -i "s/^#\?listen_addresses.*/listen_addresses = 'localhost'/" "$PGCONF"
sed -i "s/^#\?shared_buffers.*/shared_buffers = 64MB/" "$PGCONF"
sed -i "s/^#\?max_connections.*/max_connections = 50/" "$PGCONF"
sed -i "s/^#\?work_mem.*/work_mem = 2MB/" "$PGCONF"
systemctl restart postgresql

# App user, role, directories
id -u owscrims >/dev/null 2>&1 || useradd --system --create-home --home-dir /var/lib/ow-scrims --shell /bin/bash owscrims
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='owscrims'" | grep -q 1 || sudo -u postgres psql -c "CREATE ROLE owscrims LOGIN CREATEDB"
install -d -o owscrims -g owscrims /opt/ow-scrims /var/lib/ow-scrims/sandboxes /var/lib/ow-scrims/logs /var/lib/ow-scrims/map-images
install -d -m 750 -o root -g owscrims /etc/ow-scrims
[[ -f /etc/ow-scrims/env ]] || install -m 640 -o root -g owscrims "$HERE/env.example" /etc/ow-scrims/env

# Caddy (official repo)
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q && apt-get install -y -q caddy
fi
install -m 644 "$HERE/Caddyfile" /etc/caddy/Caddyfile
systemctl enable --now caddy
systemctl reload caddy

# systemd unit
install -m 644 "$HERE/ow-scrims.service" /etc/systemd/system/ow-scrims.service
systemctl daemon-reload
systemctl enable ow-scrims

echo "provisioned. Point an A record for $DOMAIN at this box, then run deploy/deploy.sh and pnpm push-snapshot from the laptop."
