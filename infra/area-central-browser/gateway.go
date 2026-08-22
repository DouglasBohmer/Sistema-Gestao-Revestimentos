package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

const browserKeyHeader = "X-Redeasso-Browser-Key"

type configuration struct {
	browserServiceKey       []byte
	interactiveTokenSecret  []byte
	allowedFrameOrigin      string
	webDriverUpstream       *url.URL
	noVNCUpstream           *url.URL
}

type accessGrant struct {
	id        string
	expiresAt time.Time
}

type app struct {
	configuration configuration
	webDriver     *httputil.ReverseProxy
	noVNC         *httputil.ReverseProxy
	grantMu       sync.RWMutex
	activeGrant   *accessGrant
}

func main() {
	config, err := configurationFromEnvironment()
	if err != nil {
		log.Print("configuração obrigatória do navegador isolado ausente")
		os.Exit(1)
	}

	server := &http.Server{
		Addr:              "0.0.0.0:" + valueOrDefault(os.Getenv("PORT"), "10000"),
		Handler:           newApp(config),
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       2 * time.Minute,
		MaxHeaderBytes:    16 << 10,
	}
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Print("gateway do navegador isolado foi encerrado")
		os.Exit(1)
	}
}

func configurationFromEnvironment() (configuration, error) {
	browserKey := strings.TrimSpace(os.Getenv("BROWSER_SERVICE_KEY"))
	tokenSecret := strings.TrimSpace(os.Getenv("INTERACTIVE_TOKEN_SECRET"))
	frameOrigin := strings.TrimSpace(os.Getenv("ALLOWED_FRAME_ORIGIN"))
	if browserKey == "" || tokenSecret == "" || frameOrigin == "" {
		return configuration{}, errors.New("missing required secret or origin")
	}
	parsedFrameOrigin, err := url.ParseRequestURI(frameOrigin)
	if err != nil || (parsedFrameOrigin.Scheme != "https" && parsedFrameOrigin.Scheme != "http") ||
		parsedFrameOrigin.Host == "" || parsedFrameOrigin.Path != "" ||
		parsedFrameOrigin.RawQuery != "" || parsedFrameOrigin.Fragment != "" {
		return configuration{}, errors.New("invalid allowed frame origin")
	}
	webDriver, _ := url.Parse("http://127.0.0.1:4444")
	noVNC, _ := url.Parse("http://127.0.0.1:7900")
	return configuration{
		browserServiceKey:      []byte(browserKey),
		interactiveTokenSecret: []byte(tokenSecret),
		allowedFrameOrigin:     frameOrigin,
		webDriverUpstream:      webDriver,
		noVNCUpstream:          noVNC,
	}, nil
}

func newApp(config configuration) *app {
	return &app{
		configuration: config,
		webDriver:     reverseProxy(config.webDriverUpstream, "/webdriver", false, config.allowedFrameOrigin),
		noVNC:         reverseProxy(config.noVNCUpstream, "", true, config.allowedFrameOrigin),
	}
}

func (app *app) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	switch {
	case request.URL.Path == "/healthz":
		app.health(writer, request)
	case strings.HasPrefix(request.URL.Path, "/webdriver/"):
		if !app.internalRequest(request) {
			unauthorized(writer)
			return
		}
		app.webDriver.ServeHTTP(writer, request)
	case strings.HasPrefix(request.URL.Path, "/internal/access/"):
		if !app.internalRequest(request) {
			unauthorized(writer)
			return
		}
		app.accessGrant(writer, request)
	case request.URL.Path == "/websockify":
		if !app.interactiveRequest(request) {
			unauthorized(writer)
			return
		}
		app.noVNC.ServeHTTP(writer, request)
	default:
		if request.Method != http.MethodGet && request.Method != http.MethodHead {
			writer.Header().Set("Allow", "GET, HEAD")
			writer.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		app.noVNC.ServeHTTP(writer, request)
	}
}

func (app *app) health(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet && request.Method != http.MethodHead {
		writer.Header().Set("Allow", "GET, HEAD")
		writer.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	client := &http.Client{Timeout: 2 * time.Second}
	response, err := client.Get("http://127.0.0.1:4444/status")
	if err != nil {
		writer.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		writer.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	writer.Header().Set("Cache-Control", "no-store")
	writer.Header().Set("Content-Type", "application/json")
	_, _ = io.WriteString(writer, `{"status":"ok"}`)
}

func (app *app) internalRequest(request *http.Request) bool {
	provided := []byte(request.Header.Get(browserKeyHeader))
	return len(provided) > 0 && hmac.Equal(provided, app.configuration.browserServiceKey)
}

func (app *app) accessGrant(writer http.ResponseWriter, request *http.Request) {
	accessID := strings.TrimPrefix(request.URL.Path, "/internal/access/")
	if !validAccessID(accessID) {
		writer.WriteHeader(http.StatusBadRequest)
		return
	}
	switch request.Method {
	case http.MethodPut:
		var payload struct {
			ExpiresAt string `json:"expiresAt"`
		}
		decoder := json.NewDecoder(http.MaxBytesReader(writer, request.Body, 1024))
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&payload); err != nil {
			writer.WriteHeader(http.StatusBadRequest)
			return
		}
		expiresAt, err := time.Parse(time.RFC3339, payload.ExpiresAt)
		if err != nil || !validGrantExpiry(expiresAt) {
			writer.WriteHeader(http.StatusBadRequest)
			return
		}
		app.grantMu.Lock()
		app.activeGrant = &accessGrant{id: accessID, expiresAt: expiresAt.UTC()}
		app.grantMu.Unlock()
		writer.Header().Set("Cache-Control", "no-store")
		writer.WriteHeader(http.StatusNoContent)
	case http.MethodDelete:
		app.grantMu.Lock()
		if app.activeGrant != nil && app.activeGrant.id == accessID {
			app.activeGrant = nil
		}
		app.grantMu.Unlock()
		writer.WriteHeader(http.StatusNoContent)
	default:
		writer.Header().Set("Allow", "PUT, DELETE")
		writer.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func (app *app) interactiveRequest(request *http.Request) bool {
	accessID, expiresAt, ok := parseAndVerifyToken(
		request.URL.Query().Get("token"), app.configuration.interactiveTokenSecret)
	if !ok || !expiresAt.After(time.Now()) {
		return false
	}
	app.grantMu.RLock()
	grant := app.activeGrant
	valid := grant != nil && grant.id == accessID && grant.expiresAt.Unix() == expiresAt.Unix()
	app.grantMu.RUnlock()
	if !valid {
		return false
	}
	query := request.URL.Query()
	query.Del("token")
	request.URL.RawQuery = query.Encode()
	return true
}

func reverseProxy(target *url.URL, stripPrefix string, frameSafe bool, frameOrigin string) *httputil.ReverseProxy {
	proxy := httputil.NewSingleHostReverseProxy(target)
	originalDirector := proxy.Director
	proxy.Director = func(request *http.Request) {
		originalDirector(request)
		if stripPrefix != "" {
			request.URL.Path = strings.TrimPrefix(request.URL.Path, stripPrefix)
			if request.URL.Path == "" {
				request.URL.Path = "/"
			}
		}
	}
	proxy.ErrorLog = log.New(io.Discard, "", 0)
	proxy.ErrorHandler = func(writer http.ResponseWriter, request *http.Request, err error) {
		writer.WriteHeader(http.StatusBadGateway)
	}
	if frameSafe {
		proxy.ModifyResponse = func(response *http.Response) error {
			// O noVNC pode enviar X-Frame-Options: SAMEORIGIN. Como o
			// navegador é exibido exclusivamente dentro do app RedeASSO,
			// substituímos a política legada pela CSP restrita à origem
			// configurada. Manter ambos faria o navegador bloquear o iframe.
			response.Header.Del("X-Frame-Options")
			response.Header.Set("Content-Security-Policy", "frame-ancestors "+frameOrigin)
			response.Header.Set("Referrer-Policy", "no-referrer")
			response.Header.Set("Cache-Control", "no-store")
			return nil
		}
	}
	return proxy
}

func parseAndVerifyToken(token string, secret []byte) (string, time.Time, bool) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 || parts[0] != "v1" {
		return "", time.Time{}, false
	}
	providedSignature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return "", time.Time{}, false
	}
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write([]byte(parts[1]))
	if !hmac.Equal(providedSignature, mac.Sum(nil)) {
		return "", time.Time{}, false
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return "", time.Time{}, false
	}
	values := strings.Split(string(payload), "\n")
	if len(values) != 2 || !validAccessID(values[0]) {
		return "", time.Time{}, false
	}
	epoch, err := strconv.ParseInt(values[1], 10, 64)
	if err != nil {
		return "", time.Time{}, false
	}
	return values[0], time.Unix(epoch, 0).UTC(), true
}

func validAccessID(value string) bool {
	if len(value) < 16 || len(value) > 80 {
		return false
	}
	for _, character := range value {
		if (character < 'a' || character > 'z') && (character < 'A' || character > 'Z') &&
			(character < '0' || character > '9') && character != '-' {
			return false
		}
	}
	return true
}

func validGrantExpiry(expiresAt time.Time) bool {
	remaining := time.Until(expiresAt)
	return remaining > 0 && remaining <= 15*time.Minute
}

func unauthorized(writer http.ResponseWriter) {
	writer.Header().Set("Cache-Control", "no-store")
	writer.WriteHeader(http.StatusUnauthorized)
}

func valueOrDefault(value string, defaultValue string) string {
	if strings.TrimSpace(value) == "" {
		return defaultValue
	}
	return value
}
