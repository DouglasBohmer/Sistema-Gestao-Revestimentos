package main

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestParseAndVerifyTokenAcceptsSignedToken(t *testing.T) {
	secret := []byte("segredo-de-teste")
	expiresAt := time.Now().Add(5 * time.Minute).UTC().Truncate(time.Second)
	token := signedToken("1f332f26-2745-4ae2-b60d-587366c9c8ba", expiresAt, secret)

	accessID, receivedExpiry, valid := parseAndVerifyToken(token, secret)

	if !valid || accessID != "1f332f26-2745-4ae2-b60d-587366c9c8ba" || !receivedExpiry.Equal(expiresAt) {
		t.Fatal("token assinado deveria ser aceito")
	}
}

func TestParseAndVerifyTokenRejectsModifiedToken(t *testing.T) {
	secret := []byte("segredo-de-teste")
	token := signedToken("1f332f26-2745-4ae2-b60d-587366c9c8ba", time.Now().Add(time.Minute), secret)

	_, _, valid := parseAndVerifyToken(token+"x", secret)
	if valid {
		t.Fatal("token modificado não pode ser aceito")
	}
}

func TestInteractiveRequestRequiresActiveGrant(t *testing.T) {
	secret := []byte("segredo-de-teste")
	noVNC, _ := url.Parse("http://127.0.0.1:7900")
	config := configuration{
		browserServiceKey:      []byte("chave"),
		interactiveTokenSecret: secret,
		allowedFrameOrigin:     "https://redeasso.example",
		noVNCUpstream:          noVNC,
	}
	app := newApp(config)
	expiresAt := time.Now().Add(5 * time.Minute).UTC().Truncate(time.Second)
	accessID := "1f332f26-2745-4ae2-b60d-587366c9c8ba"
	token := signedToken(accessID, expiresAt, secret)

	request := testRequest("/websockify?token=" + token)
	if app.interactiveRequest(request) {
		t.Fatal("um token não revogado, mas sem concessão ativa, não pode abrir o noVNC")
	}
	app.activeGrant = &accessGrant{id: accessID, expiresAt: expiresAt}
	request = testRequest("/websockify?token=" + token)
	if !app.interactiveRequest(request) || request.URL.Query().Get("token") != "" {
		t.Fatal("a concessão ativa deve liberar o token e removê-lo antes do proxy")
	}
}

func TestNoVncResponseAllowsOnlyConfiguredFrameOrigin(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("X-Frame-Options", "SAMEORIGIN")
		writer.Header().Set("Content-Security-Policy", "frame-ancestors 'self'")
		writer.WriteHeader(http.StatusOK)
	}))
	defer upstream.Close()

	noVNC, err := url.Parse(upstream.URL)
	if err != nil {
		t.Fatal(err)
	}
	app := newApp(configuration{
		browserServiceKey:      []byte("chave"),
		interactiveTokenSecret: []byte("segredo"),
		allowedFrameOrigin:     "https://redeasso.example",
		noVNCUpstream:          noVNC,
	})

	response := httptest.NewRecorder()
	app.ServeHTTP(response, testRequest("/vnc.html"))

	if response.Code != http.StatusOK {
		t.Fatalf("status inesperado: %d", response.Code)
	}
	if value := response.Header().Get("X-Frame-Options"); value != "" {
		t.Fatalf("X-Frame-Options não deve chegar ao navegador: %q", value)
	}
	if value := response.Header().Get("Content-Security-Policy"); value != "frame-ancestors https://redeasso.example" {
		t.Fatalf("CSP inesperada: %q", value)
	}
}

func signedToken(accessID string, expiresAt time.Time, secret []byte) string {
	payload := base64.RawURLEncoding.EncodeToString([]byte(accessID + "\n" + strconv.FormatInt(expiresAt.Unix(), 10)))
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write([]byte(payload))
	return "v1." + payload + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func testRequest(path string) *http.Request {
	return httptest.NewRequest(http.MethodGet, "http://browser.test"+path, nil)
}

func TestSingleServiceProxiesAPIWithoutRequiringBrowser(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/api/auth/local/login" || r.Header.Get("X-XSRF-TOKEN") != "csrf-fixture" {
			t.Error("proxy deve preservar rota, método e CSRF")
		}
		w.Header().Set("Set-Cookie", "REDEASSO_SESSION=fixture; Secure; HttpOnly")
		w.WriteHeader(http.StatusCreated)
	}))
	defer upstream.Close()
	api, _ := url.Parse(upstream.URL)
	unused, _ := url.Parse("http://127.0.0.1:1")
	application := newApp(configuration{applicationUpstream: api, noVNCUpstream: unused})
	request := httptest.NewRequest(http.MethodPost, "/api/auth/local/login", strings.NewReader(`{}`))
	request.Header.Set("X-XSRF-TOKEN", "csrf-fixture")
	response := httptest.NewRecorder()
	application.ServeHTTP(response, request)
	if response.Code != http.StatusCreated || !strings.Contains(response.Header().Get("Set-Cookie"), "HttpOnly") {
		t.Fatal("API e sessão devem funcionar com Chrome desligado")
	}
}

func TestPublicRequestsCannotAccessBrowserControls(t *testing.T) {
	unused, _ := url.Parse("http://127.0.0.1:1")
	application := newApp(configuration{browserServiceKey: []byte("fixture-key"), noVNCUpstream: unused})
	for _, path := range []string{"/internal/browser/open", "/internal/browser/fixture-session-id/state", "/internal/access/fixture-session-id", "/websockify"} {
		response := httptest.NewRecorder()
		application.ServeHTTP(response, testRequest(path))
		if response.Code != http.StatusUnauthorized {
			t.Fatalf("controle sem credencial liberado: %s", path)
		}
	}
}

func TestAutomaticLoginStateAndCleanupUsingFakeChrome(t *testing.T) {
	assertLoginBrowserPreserved(t, false)
}

func TestFillFailureKeepsActualPageAvailableForInspection(t *testing.T) {
	assertLoginBrowserPreserved(t, true)
}

func assertLoginBrowserPreserved(t *testing.T, failFill bool) {
	t.Helper()
	var mu sync.Mutex
	state := map[string]any{"origin": "https://redeasso.areacentral.com.br", "form": true, "ready": true}
	var filled bool
	var chromeURL string
	upgrader := websocket.Upgrader{}
	chrome := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/json/list" {
			_ = json.NewEncoder(w).Encode([]cdpTarget{{ID: "fixture-page", Type: "page", WebSocketDebuggerURL: strings.Replace(chromeURL, "http://", "ws://", 1) + "/page"}})
			return
		}
		connection, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer connection.Close()
		var command struct {
			ID     int            `json:"id"`
			Method string         `json:"method"`
			Params map[string]any `json:"params"`
		}
		if err := connection.ReadJSON(&command); err != nil {
			return
		}
		mu.Lock()
		defer mu.Unlock()
		result := any(map[string]any{})
		if command.Method == "Runtime.evaluate" {
			expression, _ := command.Params["expression"].(string)
			value := any(state)
			if strings.Contains(expression, "function fillPortalLogin") {
				filled = strings.Contains(expression, "fixture-user") && strings.Contains(expression, "fixture-password")
				if failFill {
					_ = connection.WriteJSON(map[string]any{"id": command.ID, "error": map[string]string{"message": "falha-ficticia-de-preenchimento"}})
					return
				}
				value = true
			}
			result = map[string]any{"result": map[string]any{"value": value}}
		}
		_ = connection.WriteJSON(map[string]any{"id": command.ID, "result": result})
	}))
	defer chrome.Close()
	chromeURL = chrome.URL
	debug, _ := url.Parse(chrome.URL)
	application := newApp(configuration{browserServiceKey: []byte("fixture-key"), chromeDebugURL: debug, noVNCUpstream: debug})
	call := func(method, path, body string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		r.Header.Set(browserKeyHeader, "fixture-key")
		w := httptest.NewRecorder()
		application.ServeHTTP(w, r)
		return w
	}
	body, _ := json.Marshal(openBrowserRequest{LoginURL: "https://redeasso.areacentral.com.br/401/", AccessID: "fixture-session-id", ExpiresAt: time.Now().Add(time.Minute).Format(time.RFC3339), Username: "fixture-user", Password: "fixture-password"})
	response := call(http.MethodPost, "/internal/browser/open", string(body))
	if response.Code != http.StatusCreated || !filled || strings.Contains(response.Body.String(), "fixture-password") {
		t.Fatal("preenchimento deve ser transitório, sem credenciais na resposta")
	}
	expectedStatus := "AUTHENTICATING"
	if failFill {
		expectedStatus = "WAITING_FOR_HUMAN"
	}
	if r := call(http.MethodGet, "/internal/browser/fixture-session-id/state", ""); !strings.Contains(r.Body.String(), expectedStatus) {
		t.Fatalf("esperava estado %s: %s", expectedStatus, r.Body)
	}
	if application.activeGrant == nil || application.activeSession == nil {
		t.Fatal("a página e a concessão devem continuar disponíveis até o cancelamento explícito")
	}
	application.activeSession.startedAt = time.Now().Add(-11 * time.Second)
	if r := call(http.MethodGet, "/internal/browser/fixture-session-id/state", ""); !strings.Contains(r.Body.String(), "WAITING_FOR_HUMAN") {
		t.Fatalf("sem aprovação deve oferecer intervenção: %s", r.Body)
	}
	mu.Lock()
	state["form"] = false
	mu.Unlock()
	if r := call(http.MethodGet, "/internal/browser/fixture-session-id/state", ""); !strings.Contains(r.Body.String(), "READY_TO_COMPLETE") {
		t.Fatalf("esperava sessão pronta: %s", r.Body)
	}
	if r := call(http.MethodDelete, "/internal/browser/fixture-session-id/session", ""); r.Code != http.StatusNoContent || application.activeGrant != nil || application.activeSession != nil {
		t.Fatal("encerramento deve apagar concessão e liberar o navegador")
	}
}

func TestAPIHealthDoesNotStartBrowser(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	}))
	defer upstream.Close()
	api, _ := url.Parse(upstream.URL)
	application := newApp(configuration{applicationUpstream: api, noVNCUpstream: api, browserStartCommand: "nao-deve-ser-executado"})
	response := httptest.NewRecorder()
	application.ServeHTTP(response, testRequest("/api/healthz"))
	if response.Code != http.StatusOK || application.browserProcess != nil {
		t.Fatal("sonda da API deve funcionar sem iniciar navegador")
	}
}

func TestCleanupDoesNotRequireChromeToStillBeAlive(t *testing.T) {
	unused, _ := url.Parse("http://127.0.0.1:1")
	application := newApp(configuration{browserServiceKey: []byte("fixture-key"), noVNCUpstream: unused,
		browserStartCommand: "nao-deve-ser-executado"})
	ctx, cancel := context.WithCancel(context.Background())
	application.activeGrant = &accessGrant{id: "fixture-session-id", ctx: ctx, cancel: cancel}
	application.activeSession = &browserSession{id: "fixture-session-id", expiresAt: time.Now().Add(-time.Second)}
	request := httptest.NewRequest(http.MethodDelete, "/internal/browser/fixture-session-id/session", nil)
	request.Header.Set(browserKeyHeader, "fixture-key")
	response := httptest.NewRecorder()
	application.ServeHTTP(response, request)
	if response.Code != http.StatusNoContent || application.activeSession != nil || application.activeGrant != nil {
		t.Fatal("mesmo após falha/expiração o cancelamento deve liberar a tentativa")
	}
	select {
	case <-ctx.Done():
	default:
		t.Fatal("a conexão interativa também deve ser revogada")
	}
}

func TestCredentialsCannotBeSentToOtherOrigin(t *testing.T) {
	unused, _ := url.Parse("http://127.0.0.1:1")
	application := newApp(configuration{browserServiceKey: []byte("fixture-key"), noVNCUpstream: unused})
	for _, address := range []string{"https://outro.example/401/", "http://redeasso.areacentral.com.br/401/", "https://redeasso.areacentral.com.br:8443/401/", "https://fixture@redeasso.areacentral.com.br/401/"} {
		body, _ := json.Marshal(openBrowserRequest{LoginURL: address, AccessID: "fixture-session-id", ExpiresAt: time.Now().Add(time.Minute).Format(time.RFC3339), Username: "fixture-user", Password: "fixture-password"})
		request := httptest.NewRequest(http.MethodPost, "/internal/browser/open", strings.NewReader(string(body)))
		request.Header.Set(browserKeyHeader, "fixture-key")
		response := httptest.NewRecorder()
		application.ServeHTTP(response, request)
		if response.Code != http.StatusBadRequest {
			t.Fatalf("origem indevida aceita: %s", address)
		}
	}
}
