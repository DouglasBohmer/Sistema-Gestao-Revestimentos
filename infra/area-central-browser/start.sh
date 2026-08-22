#!/usr/bin/env bash
set -Eeuo pipefail

# O entry point oficial mantém Xvfb, VNC e noVNC. Nenhuma sessão WebDriver é
# criada; o Chrome gráfico abaixo é um processo separado, com perfil efêmero.
/opt/bin/entry_point.sh &
supervisor_pid="$!"
gateway_pid=""
chrome_pid=""

terminate() {
  for pid in "$gateway_pid" "$chrome_pid" "$supervisor_pid"; do
    if [[ -n "$pid" ]]; then
      kill -TERM "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    fi
  done
}
trap terminate EXIT INT TERM

for _ in $(seq 1 30); do
  if [[ -S /tmp/.X11-unix/X99 ]]; then
    break
  fi
  sleep 0.2
done

profile_dir="/tmp/redeasso-normal-chrome"
rm -rf "$profile_dir"
mkdir -p "$profile_dir"

google-chrome \
  --display=:99 \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port=9222 \
  --user-data-dir="$profile_dir" \
  --no-first-run \
  --no-default-browser-check \
  --disable-background-networking \
  --disable-component-update \
  --disable-sync \
  --disable-translate \
  --disable-dev-shm-usage \
  --window-size=1280,800 \
  about:blank &
chrome_pid="$!"

/usr/local/bin/redeasso-browser-gateway &
gateway_pid="$!"

wait -n "$supervisor_pid" "$chrome_pid" "$gateway_pid"
exit "$?"
