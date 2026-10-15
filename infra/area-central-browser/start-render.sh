#!/usr/bin/env bash
set -Eeuo pipefail

# Somente o gateway escuta a porta pública. Spring, CDP e VNC ficam em loopback.
export PORT="${PORT:-10000}"
spring_port=8080
if [[ "$PORT" == "$spring_port" ]]; then spring_port=8081; fi
export APP_UPSTREAM="http://127.0.0.1:$spring_port"
export BROWSER_SERVICE_KEY="${AREA_CENTRAL_BROWSER_SERVICE_KEY:-$(openssl rand -hex 32)}"
export INTERACTIVE_TOKEN_SECRET="${AREA_CENTRAL_INTERACTIVE_TOKEN_SECRET:-$(openssl rand -hex 32)}"
export AREA_CENTRAL_BROWSER_SERVICE_KEY="$BROWSER_SERVICE_KEY"
export AREA_CENTRAL_INTERACTIVE_TOKEN_SECRET="$INTERACTIVE_TOKEN_SECRET"
export AREA_CENTRAL_BROWSER_GATEWAY_URL="http://127.0.0.1:$PORT"
export ALLOWED_FRAME_ORIGIN="${AREA_CENTRAL_ALLOWED_FRAME_ORIGIN:-https://redeasso.assocom.workers.dev}"
if [[ -n "${RENDER_EXTERNAL_URL:-}" ]]; then
  export AREA_CENTRAL_INTERACTIVE_URL="${RENDER_EXTERNAL_URL%/}/vnc.html"
else
  export AREA_CENTRAL_INTERACTIVE_URL="${AREA_CENTRAL_INTERACTIVE_URL:-http://localhost:$PORT/vnc.html}"
fi
export AREA_CENTRAL_READ_TIMEOUT="${AREA_CENTRAL_READ_TIMEOUT:-90s}"
export REDEASSO_INTEGRATION_AREA_CENTRAL_ENABLED="${REDEASSO_INTEGRATION_AREA_CENTRAL_ENABLED:-true}"
pids=()
terminate() {
  for pid in "${pids[@]}"; do kill -TERM "$pid" 2>/dev/null || true; done
  wait || true
}
trap terminate EXIT
trap 'exit 143' INT TERM
APP_ADDRESS=127.0.0.1 PORT="$spring_port" java -jar /app/redeasso.jar &
pids+=("$!")
/usr/local/bin/redeasso-browser-gateway &
pids+=("$!")
wait -n "${pids[@]}"
