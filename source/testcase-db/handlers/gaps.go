package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/manageengine/uems/testcase-db/models"
)

// ListGaps returns all gap report entries, optionally filtered by ?functionality=
func (h *Handler) ListGaps(w http.ResponseWriter, r *http.Request) {
	functionality := r.URL.Query().Get("functionality")

	query := "SELECT id, tc_id, functionality, missing_util, step_text, suggestion, created_at FROM gap_reports WHERE 1=1"
	args := []interface{}{}

	if functionality != "" {
		query += " AND functionality = ?"
		args = append(args, functionality)
	}
	query += " ORDER BY created_at DESC"

	rows, err := h.db.QueryContext(r.Context(), query, args...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	gaps := []models.GapReport{}
	for rows.Next() {
		var g models.GapReport
		if err := rows.Scan(&g.ID, &g.TCID, &g.Functionality, &g.MissingUtil, &g.StepText, &g.Suggestion, &g.CreatedAt); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		gaps = append(gaps, g)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(gaps)
}

// SaveGap records a new gap report entry.
func (h *Handler) SaveGap(w http.ResponseWriter, r *http.Request) {
	var g models.GapReport
	if err := json.NewDecoder(r.Body).Decode(&g); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	res, err := h.db.ExecContext(r.Context(),
		"INSERT INTO gap_reports (tc_id, functionality, missing_util, step_text, suggestion) VALUES (?, ?, ?, ?, ?)",
		g.TCID, g.Functionality, g.MissingUtil, g.StepText, g.Suggestion,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	id, _ := res.LastInsertId()
	g.ID = int(id)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(g)
}
