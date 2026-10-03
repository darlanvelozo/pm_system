#!/bin/sh
# Keeps PUBLIC_URL (QR code target and allowed origin) equal to the current Quick Tunnel hostname.
set -eu
cd "$(dirname "$0")"
host=$(curl -fsS --max-time 5 http://127.0.0.1:20241/quicktunnel | sed -n 's/.*"hostname":"\([^"]*\)".*/\1/p')
[ -n "$host" ] || exit 0
url="https://$host"
current=$(sed -n 's/^PUBLIC_URL=//p' .env)
[ "$url" = "$current" ] && exit 0
sed -i "s|^PUBLIC_URL=.*|PUBLIC_URL=$url|" .env
echo "$url" > public-url.txt
docker compose up -d api >/dev/null 2>&1
logger -t bo24 "URL pública atualizada: $url"
