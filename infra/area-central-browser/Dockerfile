# syntax=docker/dockerfile:1

FROM golang:1.24-bookworm AS gateway-build
WORKDIR /src
COPY infra/area-central-browser/go.mod ./
COPY infra/area-central-browser/gateway.go infra/area-central-browser/gateway_test.go ./
RUN go mod tidy \
 && CGO_ENABLED=0 go test ./... \
 && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/redeasso-browser-gateway gateway.go

# A imagem Selenium fornece somente Xvfb/noVNC já homologados. O fluxo não
# cria sessões WebDriver: o Chrome abaixo é iniciado diretamente como um
# navegador gráfico comum.
FROM selenium/standalone-chrome:4.44.0-20260505
USER root
COPY --from=gateway-build /out/redeasso-browser-gateway /usr/local/bin/redeasso-browser-gateway
COPY infra/area-central-browser/start.sh /opt/bin/redeasso-browser-start.sh
RUN chmod 0755 /usr/local/bin/redeasso-browser-gateway /opt/bin/redeasso-browser-start.sh
USER seluser

# Só o gateway escuta a porta pública. Selenium (4444), Chrome DevTools
# (9222) e noVNC (7900) ficam internos ao contêiner.
ENV PORT=10000 \
    SE_ENABLE_TRACING=false \
    SE_VNC_NO_PASSWORD=true \
    SE_RECORD_VIDEO=false \
    SE_BROWSER_ARGS_DISABLE_DSHM=--disable-dev-shm-usage
EXPOSE 10000
ENTRYPOINT ["/opt/bin/redeasso-browser-start.sh"]
