#!/usr/bin/env bash
set -Eeuo pipefail

# Inicia somente os componentes usados pelo login. O Grid Java e o serviço
# de vídeo da imagem base consumiam memória sem participar deste fluxo.
export DISPLAY=:99
pids=()

terminate() {
  for pid in "${pids[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait || true
  # Só remove o perfil efêmero criado por este processo, nunca um perfil pessoal.
  if [[ "${profile_dir:-}" == /tmp/redeasso-chrome.* && -d "$profile_dir" ]]; then
    rm -rf -- "$profile_dir"
  fi
}
trap terminate EXIT
trap 'exit 143' INT TERM

Xvfb :99 -screen 0 1280x800x24 -nolisten tcp -ac &
pids+=("$!")
for _ in $(seq 1 100); do
  if [[ -S /tmp/.X11-unix/X99 ]]; then
    break
  fi
  sleep 0.2
done

if [[ ! -S /tmp/.X11-unix/X99 ]]; then
  echo 'O display do navegador não iniciou.' >&2
  exit 1
fi

fluxbox -display :99 &
pids+=("$!")
x11vnc -localhost -display :99 -rfbport 5900 -nopw -forever -shared -quiet &
pids+=("$!")
websockify --web "${NOVNC_WEB_DIR:-/opt/bin/noVNC}" 127.0.0.1:7900 127.0.0.1:5900 &
pids+=("$!")
profile_dir="$(mktemp -d /tmp/redeasso-chrome.XXXXXX)"

"${CHROME_BIN:-google-chrome}" \
  --display=:99 \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port=9222 \
  --user-data-dir="$profile_dir" \
  --no-first-run \
  --no-default-browser-check \
  --disable-background-networking \
  --disable-component-update \
  --disable-sync \
  --disable-extensions \
  --renderer-process-limit=2 \
  --disable-translate \
  --disable-dev-shm-usage \
  --password-store=basic \
  --disable-save-password-bubble \
  --window-size=1280,800 \
  ${CHROME_CONTAINER_ARGS:-} \
  about:blank &
pids+=("$!")

if [[ "${BROWSER_ONLY:-false}" != true ]]; then
  /usr/local/bin/redeasso-browser-gateway &
  pids+=("$!")
fi

wait -n "${pids[@]}"
exit "$?"
