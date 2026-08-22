package main

import (
	"context"
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

	"github.com/gorilla/websocket"
)

const browserKeyHeader = "X-Redeasso-Browser-Key"

type configuration struct {
	browserServiceKey      []byte
	interactiveTokenSecret []byte
	allowedFrameOrigin     string
	chromeDebugURL         *url.URL
	noVNCUpstream          *url.URL
}

type accessGrant struct {
	id        string
	expiresAt time.Time
}

type browserSession struct {
	id       string
	targetID string
}

type cdpTarget struct {
	ID                   string `json:"id"`
	Type                 string `json:"type"`
	WebSocketDebuggerURL string `json:"webSocketDebuggerUrl"`
}

type app struct {
	configuration configuration
	noVNC         *httputil.ReverseProxy
	grantMu       sync.RWMutex
	activeGrant   *accessGrant
	sessionMu     sync.Mutex
	activeSession *browserSession
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
	chromeDebug, _ := url.Parse("http://127.0.0.1:9222")
	noVNC, _ := url.Parse("http://127.0.0.1:7900")
	return configuration{
		browserServiceKey:      []byte(browserKey),
		interactiveTokenSecret: []byte(tokenSecret),
		allowedFrameOrigin:     frameOrigin,
		chromeDebugURL:         chromeDebug,
		noVNCUpstream:          noVNC,
	}, nil
}

func newApp(config configuration) *app {
	return &app{
		configuration: config,
		noVNC:         reverseProxy(config.noVNCUpstream, "", true, config.allowedFrameOrigin),
	}
}

func (app *app) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	switch {
	case request.URL.Path == "/healthz":
		app.health(writer, request)
	case request.URL.Path == "/internal/browser/open":
		if !app.internalRequest(request) {
			unauthorized(writer)
			return
		}
		app.openBrowser(writer, request)
	case strings.HasPrefix(request.URL.Path, "/internal/browser/"):
		if !app.internalRequest(request) {
			unauthorized(writer)
			return
		}
		app.browserOperation(writer, request)
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
	ctx, cancel := context.WithTimeout(request.Context(), 2*time.Second)
	defer cancel()
	requestURL := app.configuration.chromeDebugURL.ResolveReference(&url.URL{Path: "/json/version"})
	probe, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL.String(), nil)
	if err != nil {
		writer.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	response, err := (&http.Client{}).Do(probe)
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

type openBrowserRequest struct {
	LoginURL  string `json:"loginUrl"`
	AccessID  string `json:"accessId"`
	ExpiresAt string `json:"expiresAt"`
}

func (app *app) openBrowser(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writer.Header().Set("Allow", http.MethodPost)
		writer.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var payload openBrowserRequest
	decoder := json.NewDecoder(http.MaxBytesReader(writer, request.Body, 2048))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&payload); err != nil {
		writer.WriteHeader(http.StatusBadRequest)
		return
	}
	loginURL, err := url.ParseRequestURI(payload.LoginURL)
	if err != nil || loginURL.Scheme != "https" || loginURL.Host == "" || !validAccessID(payload.AccessID) {
		writer.WriteHeader(http.StatusBadRequest)
		return
	}
	expiresAt, err := time.Parse(time.RFC3339, payload.ExpiresAt)
	if err != nil || !validGrantExpiry(expiresAt) {
		writer.WriteHeader(http.StatusBadRequest)
		return
	}

	app.sessionMu.Lock()
	defer app.sessionMu.Unlock()
	if app.activeSession != nil {
		writer.WriteHeader(http.StatusConflict)
		return
	}
	target, err := app.pageTarget(request.Context(), "")
	if err != nil || app.clearCookiesAndNavigate(request.Context(), target, loginURL.String()) != nil {
		writer.WriteHeader(http.StatusServiceUnavailable)
		return
	}

	app.activeSession = &browserSession{id: payload.AccessID, targetID: target.ID}
	app.grantMu.Lock()
	app.activeGrant = &accessGrant{id: payload.AccessID, expiresAt: expiresAt.UTC()}
	app.grantMu.Unlock()
	writeJSON(writer, http.StatusCreated, map[string]string{"id": payload.AccessID})
}

func (app *app) browserOperation(writer http.ResponseWriter, request *http.Request) {
	rest := strings.TrimPrefix(request.URL.Path, "/internal/browser/")
	parts := strings.Split(rest, "/")
	if len(parts) != 2 || !validAccessID(parts[0]) {
		writer.WriteHeader(http.StatusNotFound)
		return
	}
	sessionID, operation := parts[0], parts[1]
	app.sessionMu.Lock()
	defer app.sessionMu.Unlock()
	if app.activeSession == nil || app.activeSession.id != sessionID {
		writer.WriteHeader(http.StatusNotFound)
		return
	}
	target, err := app.pageTarget(request.Context(), app.activeSession.targetID)
	if err != nil {
		writer.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	switch {
	case request.Method == http.MethodGet && operation == "cookies":
		app.browserCookies(writer, request, target)
	case request.Method == http.MethodGet && operation == "login-form":
		app.loginForm(writer, request, target)
	case request.Method == http.MethodDelete && operation == "session":
		if app.clearCookiesAndNavigate(request.Context(), target, "about:blank") != nil {
			writer.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		app.activeSession = nil
		writer.WriteHeader(http.StatusNoContent)
	default:
		writer.WriteHeader(http.StatusNotFound)
	}
}

func (app *app) browserCookies(writer http.ResponseWriter, request *http.Request, target cdpTarget) {
	var result struct {
		Cookies json.RawMessage `json:"cookies"`
	}
	if err := app.callPage(request.Context(), target, "Network.getAllCookies", map[string]any{}, &result); err != nil {
		writer.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	if len(result.Cookies) == 0 {
		result.Cookies = json.RawMessage("[]")
	}
	writeJSON(writer, http.StatusOK, map[string]json.RawMessage{"cookies": result.Cookies})
}

func (app *app) loginForm(writer http.ResponseWriter, request *http.Request, target cdpTarget) {
	var result struct {
		Result struct {
			Value bool `json:"value"`
		} `json:"result"`
	}
	params := map[string]any{
		"expression":    "Boolean(document.querySelector('input[type=\"password\"], input[name*=\"senha\" i], input[name*=\"password\" i]'))",
		"returnByValue": true,
	}
	if err := app.callPage(request.Context(), target, "Runtime.evaluate", params, &result); err != nil {
		writer.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	writeJSON(writer, http.StatusOK, map[string]bool{"displayed": result.Result.Value})
}

func (app *app) clearCookiesAndNavigate(ctx context.Context, target cdpTarget, targetURL string) error {
	if err := app.callPage(ctx, target, "Network.clearBrowserCookies", map[string]any{}, nil); err != nil {
		return err
	}
	if err := app.callPage(ctx, target, "Page.navigate", map[string]string{"url": targetURL}, nil); err != nil {
		return err
	}
	return app.callPage(ctx, target, "Page.bringToFront", map[string]any{}, nil)
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

func (app *app) pageTarget(ctx context.Context, expectedID string) (cdpTarget, error) {
	requestURL := app.configuration.chromeDebugURL.ResolveReference(&url.URL{Path: "/json/list"})
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL.String(), nil)
	if err != nil {
		return cdpTarget{}, err
	}
	response, err := (&http.Client{Timeout: 5 * time.Second}).Do(request)
	if err != nil {
		return cdpTarget{}, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return cdpTarget{}, errors.New("chrome debug endpoint unavailable")
	}
	var targets []cdpTarget
	if err := json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&targets); err != nil {
		return cdpTarget{}, err
	}
	for _, target := range targets {
		if target.Type != "page" || target.WebSocketDebuggerURL == "" {
			continue
		}
		if expectedID == "" || target.ID == expectedID {
			return target, nil
		}
	}
	return cdpTarget{}, errors.New("chrome page target unavailable")
}

func (app *app) callPage(parent context.Context, target cdpTarget, method string, params any, result any) error {
	ctx, cancel := context.WithTimeout(parent, 10*time.Second)
	defer cancel()
	connection, _, err := websocket.DefaultDialer.DialContext(ctx, target.WebSocketDebuggerURL, nil)
	if err != nil {
		return err
	}
	defer connection.Close()
	return cdpCall(ctx, connection, method, params, result)
}

func cdpCall(ctx context.Context, connection *websocket.Conn, method string, params any, result any) error {
	payload, err := json.Marshal(map[string]any{"id": 1, "method": method, "params": params})
	if err != nil {
		return err
	}
	if deadline, ok := ctx.Deadline(); ok {
		_ = connection.SetWriteDeadline(deadline)
		_ = connection.SetReadDeadline(deadline)
	}
	if err := connection.WriteMessage(websocket.TextMessage, payload); err != nil {
		return err
	}
	for {
		_, message, err := connection.ReadMessage()
		if err != nil {
			return err
		}
		var response struct {
			ID     int             `json:"id"`
			Result json.RawMessage `json:"result"`
			Error  *struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		if err := json.Unmarshal(message, &response); err != nil {
			return err
		}
		if response.ID != 1 {
			continue
		}
		if response.Error != nil {
			return errors.New(response.Error.Message)
		}
		if result != nil && len(response.Result) > 0 {
			return json.Unmarshal(response.Result, result)
		}
		return nil
	}
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

func writeJSON(writer http.ResponseWriter, status int, value any) {
	writer.Header().Set("Cache-Control", "no-store")
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(value)
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
