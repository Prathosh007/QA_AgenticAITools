package main

import (
	"log/slog"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/manageengine/uems/testcase-db/db"
	"github.com/manageengine/uems/testcase-db/handlers"
)

func main() {
	dbPath := "testcases.db"
	if p := os.Getenv("DB_PATH"); p != "" {
		dbPath = p
	}

	database, err := db.Init(dbPath)
	if err != nil {
		slog.Error("failed to init database", "error", err)
		os.Exit(1)
	}
	defer database.Close()

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	})

	h := handlers.New(database)

	r.Route("/testcases", func(r chi.Router) {
		r.Get("/", h.ListTestCases)
		r.Post("/", h.CreateTestCase)
		r.Get("/{id}", h.GetTestCase)
		r.Put("/{id}", h.UpdateTestCase)
		r.Delete("/{id}", h.DeleteTestCase)
	})

	r.Route("/payloads", func(r chi.Router) {
		r.Get("/", h.ListPayloads)
		r.Post("/", h.SavePayload)
		r.Get("/{tcId}", h.GetPayload)
		r.Put("/{tcId}", h.UpdatePayload)
	})

	r.Route("/gaps", func(r chi.Router) {
		r.Get("/", h.ListGaps)
		r.Post("/", h.SaveGap)
	})

	r.Route("/results", func(r chi.Router) {
		r.Get("/{tcId}", h.GetResults)
		r.Post("/", h.SaveResult)
	})

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	port := ":3000"
	if p := os.Getenv("PORT"); p != "" {
		port = ":" + p
	}
	slog.Info("testcase-db server starting", "port", port, "db", dbPath)
	if err := http.ListenAndServe(port, r); err != nil {
		slog.Error("server failed", "error", err)
		os.Exit(1)
	}
}
