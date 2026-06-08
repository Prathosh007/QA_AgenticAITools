package db

import (
	"database/sql"

	_ "modernc.org/sqlite"
)

// Init opens (or creates) the SQLite database at path and applies the schema.
func Init(path string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	if err := db.Ping(); err != nil {
		return nil, err
	}
	if err := applySchema(db); err != nil {
		return nil, err
	}
	return db, nil
}

func applySchema(db *sql.DB) error {
	_, err := db.Exec(`
	PRAGMA journal_mode=WAL;

	CREATE TABLE IF NOT EXISTS test_cases (
		id               TEXT PRIMARY KEY,
		functionality    TEXT NOT NULL,
		sub_functionality TEXT,
		title            TEXT,
		category         TEXT,
		priority         TEXT,
		status           TEXT DEFAULT 'active',
		version          INTEGER DEFAULT 1,
		platform         TEXT,
		steps            TEXT,          -- JSON array of step strings
		expected_result  TEXT,
		support_files    TEXT,          -- JSON array of file paths
		issue_id         TEXT,
		created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS goat_payloads (
		tc_id         TEXT PRIMARY KEY,
		functionality TEXT,
		component     TEXT,
		payload       TEXT,            -- full JS execution block as string
		created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS gap_reports (
		id            INTEGER PRIMARY KEY AUTOINCREMENT,
		tc_id         TEXT,
		functionality TEXT,
		missing_util  TEXT,
		step_text     TEXT,
		suggestion    TEXT,
		created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS execution_results (
		id            INTEGER PRIMARY KEY AUTOINCREMENT,
		tc_id         TEXT,
		run_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
		status        TEXT,            -- pass / fail / error
		actual_output TEXT,
		notes         TEXT
	);
	`)
	return err
}
