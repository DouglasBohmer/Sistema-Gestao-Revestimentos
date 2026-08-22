#!/usr/bin/env bash
set -Eeuo pipefail

/opt/bin/entry_point.sh &
selenium_pid="$!"
gateway_pid=""

terminate() {
  if [[ -n "$gateway_pid" ]]; then
    kill -TERM "$gateway_pid" 2>/dev/null || true
    wait "$gateway_pid" 2>/dev/null || true
  fi
  kill -TERM "$selenium_pid" 2>/dev/null || true
  wait "$selenium_pid" 2>/dev/null || true
}

trap terminate EXIT INT TERM
/usr/local/bin/redeasso-browser-gateway &
gateway_pid="$!"

wait -n "$selenium_pid" "$gateway_pid"
exit_code="$?"
exit "$exit_code"
