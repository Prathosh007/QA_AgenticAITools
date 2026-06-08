package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/manageengine/uems/testcase-db/models"
)

// GetResults returns all execution results for a test case ID, most recent first.
func (h *Handler) GetResults(w http.ResponseWriter, r *http.Request) {
	tcID := chi.URLParam(r, "tcId")

	rows, err := h.db.QueryContext(r.Context(),
		"SELECT id, tc_id, run_at, status, actual_output, notes FROM execution_results WHERE tc_id = ? ORDER BY run_at DESC",
		tcID,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	results := []models.ExecutionResult{}
	for rows.Next() {
		var res models.ExecutionResult
		if err := rows.Scan(&res.ID, &res.TCID, &res.RunAt, &res.Status, &res.ActualOutput, &res.Notes); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		results = append(results, res)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

// SaveResult records the outcome of a GOAT test run for a test case.
func (h *Handler) SaveResult(w http.ResponseWriter, r *http.Request) {
	var res models.ExecutionResult
	if err := json.NewDecoder(r.Body).Decode(&res); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	dbRes, err := h.db.ExecContext(r.Context(),
		"INSERT INTO execution_results (tc_id, status, actual_output, notes) VALUES (?, ?, ?, ?)",
		res.TCID, res.Status, res.ActualOutput, res.Notes,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	id, _ := dbRes.LastInsertId()
	res.ID = int(id)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(res)
}
