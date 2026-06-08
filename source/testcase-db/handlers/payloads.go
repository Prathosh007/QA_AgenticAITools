package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/manageengine/uems/testcase-db/models"
)

// ListPayloads returns all GOAT payloads, optionally filtered by ?functionality=
func (h *Handler) ListPayloads(w http.ResponseWriter, r *http.Request) {
	functionality := r.URL.Query().Get("functionality")

	query := "SELECT tc_id, functionality, component, payload, created_at, updated_at FROM goat_payloads WHERE 1=1"
	args := []interface{}{}

	if functionality != "" {
		query += " AND functionality = ?"
		args = append(args, functionality)
	}
	query += " ORDER BY tc_id"

	rows, err := h.db.QueryContext(r.Context(), query, args...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	payloads := []models.GoatPayload{}
	for rows.Next() {
		var p models.GoatPayload
		if err := rows.Scan(&p.TCID, &p.Functionality, &p.Component, &p.Payload, &p.CreatedAt, &p.UpdatedAt); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		payloads = append(payloads, p)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(payloads)
}

// GetPayload returns the GOAT payload for a single test case ID.
func (h *Handler) GetPayload(w http.ResponseWriter, r *http.Request) {
	tcID := chi.URLParam(r, "tcId")

	var p models.GoatPayload
	err := h.db.QueryRowContext(r.Context(),
		"SELECT tc_id, functionality, component, payload, created_at, updated_at FROM goat_payloads WHERE tc_id = ?",
		tcID,
	).Scan(&p.TCID, &p.Functionality, &p.Component, &p.Payload, &p.CreatedAt, &p.UpdatedAt)

	if err == sql.ErrNoRows {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(p)
}

// SavePayload inserts or replaces the GOAT payload for a test case.
func (h *Handler) SavePayload(w http.ResponseWriter, r *http.Request) {
	var p models.GoatPayload
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	now := time.Now().UTC().Format(time.RFC3339)

	_, err := h.db.ExecContext(r.Context(),
		`INSERT INTO goat_payloads (tc_id, functionality, component, payload, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(tc_id) DO UPDATE SET
			functionality=excluded.functionality,
			component=excluded.component,
			payload=excluded.payload,
			updated_at=excluded.updated_at`,
		p.TCID, p.Functionality, p.Component, p.Payload, now, now,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	p.CreatedAt = now
	p.UpdatedAt = now
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(p)
}

// UpdatePayload updates the component and payload for an existing GOAT payload entry.
func (h *Handler) UpdatePayload(w http.ResponseWriter, r *http.Request) {
	tcID := chi.URLParam(r, "tcId")

	var p models.GoatPayload
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	now := time.Now().UTC().Format(time.RFC3339)

	res, err := h.db.ExecContext(r.Context(),
		"UPDATE goat_payloads SET component=?, payload=?, updated_at=? WHERE tc_id=?",
		p.Component, p.Payload, now, tcID,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"updated": tcID})
}
