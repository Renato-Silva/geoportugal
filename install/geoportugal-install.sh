#!/usr/bin/env bash

# Runs inside the container, called by ct/geoportugal.sh.
# Source: https://github.com/Renato-Silva/geoportugal

source /dev/stdin <<<"$FUNCTIONS_FILE_PATH"
color
verb_ip6
catch_errors
setting_up_container
network_check
update_os

msg_info "Installing Dependencies"
$STD apt install -y git
msg_ok "Installed Dependencies"

NODE_VERSION="24" setup_nodejs

msg_info "Installing GeoPortugal (takes a few minutes)"
$STD git clone -b master https://github.com/Renato-Silva/geoportugal.git /opt/geoportugal
cd /opt/geoportugal || exit
cp .env.example .env
chmod 600 .env
$STD npm ci --no-audit --no-fund
$STD npm run build
git rev-parse HEAD >.output/.built-commit
msg_ok "Installed GeoPortugal"

msg_info "Creating Service"
# systemd reads .env as root and passes it on; the imagery archive lives in /var/lib/geoportugal
cat <<SERVICE >/etc/systemd/system/geoportugal.service
[Unit]
Description=GeoPortugal
After=network-online.target
Wants=network-online.target

[Service]
DynamicUser=yes
StateDirectory=geoportugal
WorkingDirectory=/opt/geoportugal
EnvironmentFile=/opt/geoportugal/.env
Environment=NODE_ENV=production HOST=0.0.0.0 PORT=3000 NUXT_ARCHIVE_DIR=/var/lib/geoportugal/archive
ExecStart=/usr/bin/node .output/server/index.mjs
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE
systemctl enable -q --now geoportugal
msg_ok "Created Service"

motd_ssh
customize
cleanup_lxc
