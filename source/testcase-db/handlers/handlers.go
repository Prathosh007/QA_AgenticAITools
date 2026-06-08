package handlers

import "database/sql"

// Handler holds the DB connection for all route handlers.
type Handler struct {
	db *sql.DB
}

// New creates a Handler with the given database connection.
func New(db *sql.DB) *Handler {
	return &Handler{db: db}
}
