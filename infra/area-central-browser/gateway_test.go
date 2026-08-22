package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"testing"
	"time"
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
	webDriver, _ := url.Parse("http://127.0.0.1:4444")
	noVNC, _ := url.Parse("http://127.0.0.1:7900")
	config := configuration{
		browserServiceKey:      []byte("chave"),
		interactiveTokenSecret: secret,
		allowedFrameOrigin:     "https://redeasso.example",
		webDriverUpstream:      webDriver,
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

func signedToken(accessID string, expiresAt time.Time, secret []byte) string {
	payload := base64.RawURLEncoding.EncodeToString([]byte(accessID + "\n" + strconv.FormatInt(expiresAt.Unix(), 10)))
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write([]byte(payload))
	return "v1." + payload + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func testRequest(path string) *http.Request {
	return httptest.NewRequest(http.MethodGet, "http://browser.test"+path, nil)
}
