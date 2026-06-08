// Package handlers — Zoho OAuth authentication for the home page.
//
// Flow:
//  1. Browser visits GET /auth/zoho/login → redirect to Zoho OAuth consent page
//  2. Zoho redirects to GET /auth/zoho/callback?code=... → exchange code, validate
//     email domain, create server-side session, set httpOnly cookie
//  3. All protected home-page API routes check the cookie via ZohoHomeAuthMiddleware
//  4. GET /auth/zoho/status  → returns current user JSON (for frontend auth check)
//  5. POST /auth/zoho/logout → deletes session, clears cookie
package handlers

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// ── Configuration ─────────────────────────────────────────────────

var (
	zohoClientID      string
	zohoClientSecret  string
	zohoAllowedDomain string // e.g. "zohocorp.com" — only this domain is allowed in
	zohoAccountsURL   string // e.g. "https://accounts.zoho.in" or "https://accounts.zoho.com"
)

// SetZohoConfig wires Zoho OAuth parameters into the handlers package.
// Called once from main() before the server starts.
func SetZohoConfig(clientID, clientSecret, allowedDomain, accountsURL string) {
	zohoClientID = clientID
	zohoClientSecret = clientSecret
	zohoAllowedDomain = allowedDomain
	if accountsURL != "" {
		zohoAccountsURL = strings.TrimRight(accountsURL, "/")
	} else {
		zohoAccountsURL = "https://accounts.zoho.in"
	}
}

// zohoRedirectURL derives the OAuth callback URL from the incoming request.
// TLS is always enforced, so the scheme is always "https".
func zohoRedirectURL(r *http.Request) string {
	return "https://" + r.Host + "/auth/zoho/callback"
}

// ── Session store (in-memory) ─────────────────────────────────────

const zohoSessionCookie = "zoho_session" //No I18N
const zohoSessionTTL = 24 * time.Hour

type zohoSession struct {
	UserID    string
	Name      string
	Email     string
	Avatar    string
	ExpiresAt time.Time
}

var zohoSessions sync.Map

func newSessionID() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func storeZohoSession(sess zohoSession) (string, error) {
	sid, err := newSessionID()
	if err != nil {
		return "", err
	}
	sess.ExpiresAt = time.Now().Add(zohoSessionTTL)
	zohoSessions.Store(sid, sess)
	return sid, nil
}

func lookupZohoSession(r *http.Request) (*zohoSession, bool) {
	cookie, err := r.Cookie(zohoSessionCookie)
	if err != nil {
		return nil, false
	}
	val, ok := zohoSessions.Load(cookie.Value)
	if !ok {
		return nil, false
	}
	sess := val.(zohoSession)
	if time.Now().After(sess.ExpiresAt) {
		zohoSessions.Delete(cookie.Value)
		return nil, false
	}
	return &sess, true
}

func removeZohoSession(r *http.Request) {
	if cookie, err := r.Cookie(zohoSessionCookie); err == nil {
		zohoSessions.Delete(cookie.Value)
	}
}

func setZohoCookie(w http.ResponseWriter, sid string, maxAge int) {
	http.SetCookie(w, &http.Cookie{
		Name:     zohoSessionCookie,
		Value:    sid,
		Path:     "/",
		HttpOnly: true,
		Secure:   secureCookies,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   maxAge,
	})
}

// ── JWT payload decode ────────────────────────────────────────────
//
// Safe to do without signature verification: the token arrived directly
// from Zoho's token endpoint as a result of our code exchange — it was
// never supplied by the user.

type zohoIDPayload struct {
	Sub     string `json:"sub"`
	Name    string `json:"name"`
	Email   string `json:"email"`
	Picture string `json:"picture"`
}

func decodeZohoIDToken(idToken string) (*zohoIDPayload, error) {
	parts := strings.Split(idToken, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("malformed JWT: expected 3 parts, got %d", len(parts))
	}
	raw := parts[1]
	// base64url may lack padding — add it
	switch len(raw) % 4 {
	case 2:
		raw += "=="
	case 3:
		raw += "="
	}
	data, err := base64.URLEncoding.DecodeString(raw)
	if err != nil {
		return nil, fmt.Errorf("base64 decode: %w", err)
	}
	var p zohoIDPayload
	if err := json.Unmarshal(data, &p); err != nil {
		return nil, fmt.Errorf("json unmarshal: %w", err)
	}
	return &p, nil
}

// ── Handlers ──────────────────────────────────────────────────────

// HandleZohoLogin redirects the browser to Zoho's OAuth consent page.
func HandleZohoLogin(w http.ResponseWriter, r *http.Request) {
	if zohoClientID == "" {
		http.Error(w, "Zoho OAuth is not configured on this server", http.StatusServiceUnavailable)
		return
	}
	params := url.Values{
		"response_type": {"code"},
		"client_id":     {zohoClientID},
		"scope":         {"profile,email"},
		"redirect_uri":  {zohoRedirectURL(r)},
		"access_type":   {"offline"},
		"prompt":        {"consent"},
	}
	http.Redirect(w, r, zohoAccountsURL+"/oauth/v2/auth?"+params.Encode(), http.StatusFound)
}

// HandleZohoCallback handles the authorization code returned by Zoho.
func HandleZohoCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code") //No I18N
	if code == "" {
		slog.Warn("zoho callback: missing code")
		http.Redirect(w, r, "/?error=no_code", http.StatusFound) //No I18N
		return
	}

	// Exchange authorization code for tokens
	tokenResp, err := exchangeZohoCode(code, zohoRedirectURL(r))
	if err != nil {
		slog.Error("zoho token exchange failed", "error", err)
		http.Redirect(w, r, "/?error=token_exchange_failed", http.StatusFound) //No I18N
		return
	}
	if tokenResp.IDToken == "" {
		slog.Error("zoho: id_token missing from token response")
		http.Redirect(w, r, "/?error=no_id_token", http.StatusFound) //No I18N
		return
	}

	// Decode JWT payload (safe: token came directly from Zoho)
	payload, err := decodeZohoIDToken(tokenResp.IDToken)
	if err != nil {
		slog.Error("zoho: failed to decode id_token", "error", err)
		http.Redirect(w, r, "/?error=id_token_invalid", http.StatusFound) //No I18N
		return
	}

	// Validate email presence and basic format
	if payload.Email == "" || !isValidEmailFormat(payload.Email) {
		slog.Warn("zoho: invalid or missing email in id_token", "email", payload.Email)
		http.Redirect(w, r, "/?error=invalid_email", http.StatusFound) //No I18N
		return
	}

	// Team membership check: email domain must match ZOHO_ALLOWED_DOMAIN
	if zohoAllowedDomain != "" {
		emailLower := strings.ToLower(payload.Email)
		domainSuffix := "@" + strings.ToLower(zohoAllowedDomain)
		if !strings.HasSuffix(emailLower, domainSuffix) {
			slog.Warn("zoho: access denied — non-team member", "email", payload.Email)
			http.Redirect(w, r, "/?error=access_denied", http.StatusFound) //No I18N
			return
		}
	}

	// Create server-side session
	sid, err := storeZohoSession(zohoSession{
		UserID: payload.Sub,
		Name:   payload.Name,
		Email:  payload.Email,
		Avatar: payload.Picture,
	})
	if err != nil {
		slog.Error("zoho: session creation failed", "error", err)
		http.Redirect(w, r, "/?error=session_failed", http.StatusFound) //No I18N
		return
	}

	setZohoCookie(w, sid, int(zohoSessionTTL.Seconds()))
	slog.Info("zoho: login successful", "email", payload.Email)
	http.Redirect(w, r, "/", http.StatusFound)
}

// HandleZohoStatus returns the authenticated user's info, or isLoggedIn:false.
// Always includes "configured" so the frontend can decide whether to show the
// login overlay at all.
func HandleZohoStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	configured := zohoClientID != ""
	sess, ok := lookupZohoSession(r)
	if !ok {
		json.NewEncoder(w).Encode(map[string]interface{}{"configured": configured, "isLoggedIn": false})
		return
	}
	json.NewEncoder(w).Encode(map[string]interface{}{
		"configured": configured,
		"isLoggedIn": true,
		"name":       sess.Name,
		"email":      sess.Email,
		"avatar":     sess.Avatar,
	})
}

// HandleZohoLogout deletes the session and clears the cookie.
func HandleZohoLogout(w http.ResponseWriter, r *http.Request) {
	removeZohoSession(r)
	setZohoCookie(w, "", -1)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// ZohoHomeAuthMiddleware protects API routes.
// Returns 401 JSON when the caller has no valid Zoho session.
// Bypassed automatically when ZOHO_CLIENT_ID is not configured.
func ZohoHomeAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if zohoClientID == "" {
			next.ServeHTTP(w, r)
			return
		}
		if _, ok := lookupZohoSession(r); !ok {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{"error": "authentication required"}) //No I18N
			return
		}
		next.ServeHTTP(w, r)
	})
}

// ZohoPageAuthMiddleware protects page routes (e.g. /explorer/, /docs/).
// Redirects unauthenticated browsers to the home page for Zoho login.
// Bypassed automatically when ZOHO_CLIENT_ID is not configured.
func ZohoPageAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if zohoClientID == "" {
			next.ServeHTTP(w, r)
			return
		}
		if _, ok := lookupZohoSession(r); !ok {
			redirectURL := "/?login_required=" + url.QueryEscape(r.URL.Path) //No I18N
			http.Redirect(w, r, redirectURL, http.StatusFound)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// zohoExemptPath returns true for paths that must work without Zoho auth:
// the login flow itself, infrastructure probes, and home-page static assets
// that render the login screen.
func zohoExemptPath(path string) bool {
	// Auth endpoints (login flow)
	if strings.HasPrefix(path, "/auth/") { //No I18N
		return true
	}
	// Infrastructure probes
	switch path {
	case "/health", "/readyz", "/metrics": //No I18N
		return true
	}
	// Home page root (serves the login screen)
	if path == "/" || path == "/index.html" { //No I18N
		return true
	}
	// Static assets needed for the login screen (CSS, JS, fonts, images)
	if strings.HasPrefix(path, "/css/") || //No I18N
		strings.HasPrefix(path, "/js/") || //No I18N
		strings.HasPrefix(path, "/images/") || //No I18N
		strings.HasPrefix(path, "/fonts/") { //No I18N
		return true
	}
	// Static files (CSS, JS, images, fonts) — including /explorer/ sub-resources.
	// HTML pages are NOT exempt; only non-HTML assets needed to render those pages.
	for _, ext := range []string{".css", ".js", ".ico", ".svg", ".png", ".jpg", ".webp", ".woff2", ".woff", ".ttf", ".webmanifest", ".map"} { //No I18N
		if strings.HasSuffix(path, ext) {
			return true
		}
	}
	return false
}

// ZohoGlobalAuthMiddleware enforces Zoho login for the entire site.
// Exempt paths (auth flow, health probes, home-page login assets) pass through.
// API routes get 401 JSON; page routes get a redirect to the login page.
// Bypassed when ZOHO_CLIENT_ID is not configured.
func ZohoGlobalAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if zohoClientID == "" {
			next.ServeHTTP(w, r)
			return
		}
		if zohoExemptPath(r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}
		if _, ok := lookupZohoSession(r); ok {
			next.ServeHTTP(w, r)
			return
		}
		// Not authenticated — choose response type
		if strings.HasPrefix(r.URL.Path, "/api/") || //No I18N
			strings.HasPrefix(r.URL.Path, "/copilot/") || //No I18N
			r.Header.Get("Accept") == "application/json" { //No I18N
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{"error": "authentication required"}) //No I18N
			return
		}
		// Redirect to home with the original path so we can bounce back after login
		redirectURL := "/?login_required=" + url.QueryEscape(r.URL.Path) //No I18N
		http.Redirect(w, r, redirectURL, http.StatusFound)
	})
}

// ── Internal helpers ──────────────────────────────────────────────

type zohoTokenResponse struct {
	AccessToken string `json:"access_token"`
	IDToken     string `json:"id_token"`
}

func exchangeZohoCode(code, redirectURI string) (*zohoTokenResponse, error) {
	resp, err := http.PostForm(zohoAccountsURL+"/oauth/v2/token", url.Values{ //No I18N
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"redirect_uri":  {redirectURI},
		"client_id":     {zohoClientID},
		"client_secret": {zohoClientSecret},
	})
	if err != nil {
		return nil, fmt.Errorf("http post: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("zoho returned HTTP %d", resp.StatusCode)
	}
	var t zohoTokenResponse
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<16)).Decode(&t); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	return &t, nil
}

// isValidEmailFormat is a minimal email sanity check (defense-in-depth only).
// Domain-level permission is enforced separately via zohoAllowedDomain.
func isValidEmailFormat(email string) bool {
	parts := strings.SplitN(email, "@", 2)
	return len(parts) == 2 && len(parts[0]) > 0 && strings.Contains(parts[1], ".")
}
