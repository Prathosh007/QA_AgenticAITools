package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/manageengine/uems/testcase-db/models"
)

// ListTestCases returns all test cases, optionally filtered by ?functionality= and ?status=
func (h *Handler) ListTestCases(w http.ResponseWriter, r *http.Request) {
	functionality := r.URL.Query().Get("functionality")
	status := r.URL.Query().Get("status")

	query := `SELECT id, functionality, sub_functionality, title, category, priority, status,
		version, platform, steps, expected_result, support_files, issue_id, created_at, updated_at
		FROM test_cases WHERE 1=1`
	args := []interface{}{}

	if functionality != "" {
		query += " AND functionality = ?"
		args = append(args, functionality)
	}
	if status != "" {
		query += " AND status = ?"
		args = append(args, status)
	}
	query += " ORDER BY id"

	rows, err := h.db.QueryContext(r.Context(), query, args...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	tcs := []models.TestCase{}
	for rows.Next() {
		var tc models.TestCase
		var stepsJSON, supportFilesJSON string
		if err := rows.Scan(&tc.ID, &tc.Functionality, &tc.SubFunctionality, &tc.Title,
			&tc.Category, &tc.Priority, &tc.Status, &tc.Version, &tc.Platform,
			&stepsJSON, &tc.ExpectedResult, &supportFilesJSON,
			&tc.IssueID, &tc.CreatedAt, &tc.UpdatedAt); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		_ = json.Unmarshal([]byte(stepsJSON), &tc.Steps)
		_ = json.Unmarshal([]byte(supportFilesJSON), &tc.SupportFiles)
		tcs = append(tcs, tc)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tcs)
}

// GetTestCase returns a single test case by ID.
func (h *Handler) GetTestCase(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var tc models.TestCase
	var stepsJSON, supportFilesJSON string
	err := h.db.QueryRowContext(r.Context(),
		`SELECT id, functionality, sub_functionality, title, category, priority, status,
		version, platform, steps, expected_result, support_files, issue_id, created_at, updated_at
		FROM test_cases WHERE id = ?`, id,
	).Scan(&tc.ID, &tc.Functionality, &tc.SubFunctionality, &tc.Title,
		&tc.Category, &tc.Priority, &tc.Status, &tc.Version, &tc.Platform,
		&stepsJSON, &tc.ExpectedResult, &supportFilesJSON,
		&tc.IssueID, &tc.CreatedAt, &tc.UpdatedAt)

	if err == sql.ErrNoRows {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	_ = json.Unmarshal([]byte(stepsJSON), &tc.Steps)
	_ = json.Unmarshal([]byte(supportFilesJSON), &tc.SupportFiles)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tc)
}

// CreateTestCase inserts a new test case, or upserts (increments version) if the ID already exists.
func (h *Handler) CreateTestCase(w http.ResponseWriter, r *http.Request) {
	var tc models.TestCase
	if err := json.NewDecoder(r.Body).Decode(&tc); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	stepsJSON, _ := json.Marshal(tc.Steps)
	supportFilesJSON, _ := json.Marshal(tc.SupportFiles)
	if tc.Status == "" {
		tc.Status = "active"
	}
	if tc.Version == 0 {
		tc.Version = 1
	}
	now := time.Now().UTC().Format(time.RFC3339)

	_, err := h.db.ExecContext(r.Context(),
		`INSERT INTO test_cases
			(id, functionality, sub_functionality, title, category, priority, status,
			version, platform, steps, expected_result, support_files, issue_id, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			functionality=excluded.functionality,
			sub_functionality=excluded.sub_functionality,
			title=excluded.title,
			category=excluded.category,
			priority=excluded.priority,
			status=excluded.status,
			version=test_cases.version+1,
			platform=excluded.platform,
			steps=excluded.steps,
			expected_result=excluded.expected_result,
			support_files=excluded.support_files,
			issue_id=excluded.issue_id,
			updated_at=excluded.updated_at`,
		tc.ID, tc.Functionality, tc.SubFunctionality, tc.Title,
		tc.Category, tc.Priority, tc.Status, tc.Version, tc.Platform,
		string(stepsJSON), tc.ExpectedResult, string(supportFilesJSON),
		tc.IssueID, now, now,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	tc.CreatedAt = now
	tc.UpdatedAt = now
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(tc)
}

// UpdateTestCase updates fields of an existing test case and increments its version.
func (h *Handler) UpdateTestCase(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var tc models.TestCase
	if err := json.NewDecoder(r.Body).Decode(&tc); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	stepsJSON, _ := json.Marshal(tc.Steps)
	supportFilesJSON, _ := json.Marshal(tc.SupportFiles)
	now := time.Now().UTC().Format(time.RFC3339)

	res, err := h.db.ExecContext(r.Context(),
		`UPDATE test_cases SET
			functionality=?, sub_functionality=?, title=?, category=?, priority=?,
			status=?, version=version+1, platform=?, steps=?, expected_result=?,
			support_files=?, issue_id=?, updated_at=?
		WHERE id=?`,
		tc.Functionality, tc.SubFunctionality, tc.Title, tc.Category, tc.Priority,
		tc.Status, tc.Platform, string(stepsJSON), tc.ExpectedResult,
		string(supportFilesJSON), tc.IssueID, now, id,
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
	json.NewEncoder(w).Encode(map[string]string{"updated": id})
}

// DeleteTestCase soft-deletes a test case by setting status = "deprecated".
func (h *Handler) DeleteTestCase(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	now := time.Now().UTC().Format(time.RFC3339)

	res, err := h.db.ExecContext(r.Context(),
		"UPDATE test_cases SET status='deprecated', updated_at=? WHERE id=?", now, id,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
