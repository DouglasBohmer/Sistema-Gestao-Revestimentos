# syntax=docker/dockerfile:1

FROM golang:1.24-bookworm AS gateway-build
WORKDIR /src
COPY infra/area-central-browser/go.mod infra/area-central-browser/gateway.go infra/area-central-browser/gateway_test.go ./
RUN CGO_ENABLED=0 go test ./... && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/redeasso-browser-gateway gateway.go

FROM selenium/standalone-chrome:4.44.0-20260505
USER root
COPY --from=gateway-build /out/redeasso-browser-gateway /usr/local/bin/redeasso-browser-gateway
COPY infra/area-central-browser/start.sh /opt/bin/redeasso-browser-start.sh
RUN chmod 0755 /usr/local/bin/redeasso-browser-gateway /opt/bin/redeasso-browser-start.sh
USER seluser

# Só o gateway escuta a porta pública. Selenium (4444) e noVNC (7900)
# permanecem dentro do contêiner e são alcançados apenas por ele.
ENV PORT=10000 \
    SE_NODE_MAX_SESSIONS=1 \
    SE_NODE_OVERRIDE_MAX_SESSIONS=false \
    SE_VNC_NO_PASSWORD=true \
    SE_ENABLE_TRACING=false \
    SE_BROWSER_ARGS_DISABLE_DSHM=--disable-dev-shm-usage
EXPOSE 10000
ENTRYPOINT ["/opt/bin/redeasso-browser-start.sh"]
