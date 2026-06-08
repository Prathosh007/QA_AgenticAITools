.PHONY: build run clean tidy

VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)
COMMIT  ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo unknown)
BUILD_TIME ?= $(shell date -u +%Y-%m-%dT%H:%M:%SZ)
LDFLAGS = -X main.version=$(VERSION) -X main.commitSHA=$(COMMIT) -X main.buildTime=$(BUILD_TIME)

# Configurable via env or make args; defaults match .env.example
UEMS_PORT       ?= 443
UEMS_PUBLIC_DIR ?= frontend
UEMS_REPO_DIR   ?= data/repos

# Build the Go server
build:
	cd backend && go build -ldflags "$(LDFLAGS)" -o ../bin/uems-agent-web ./server

# Run locally (relative paths from source/uems-agent-web/)
run: build
	./bin/uems-agent-web \
		-port $(UEMS_PORT) \
		-public $(UEMS_PUBLIC_DIR) \
		-repos $(UEMS_REPO_DIR) \
		-guidelines ../../guidelines \
		-prompts ../../agents/orchestrator/agents \
		-repo-data ../common/repos.json

# Tidy Go modules
tidy:
	cd backend && go mod tidy

# Clean build artifacts
clean:
	rm -rf bin/
