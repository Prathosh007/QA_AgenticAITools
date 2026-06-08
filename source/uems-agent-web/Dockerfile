FROM golang:1.23-alpine AS builder
RUN apk add --no-cache git
WORKDIR /app
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ .
ARG VERSION=dev
ARG COMMIT=unknown
ARG BUILD_TIME=unknown
RUN CGO_ENABLED=0 go build -ldflags "-X main.version=${VERSION} -X main.commitSHA=${COMMIT} -X main.buildTime=${BUILD_TIME}" -o /uems-agent-web ./server

FROM alpine:3.20
RUN apk add --no-cache git ripgrep ca-certificates
COPY --from=builder /uems-agent-web /usr/local/bin/uems-agent-web

# Copy shared data from repo root (guidelines, agents, repos.json)
COPY guidelines/ /app/guidelines/
COPY agents/ /app/agents/
COPY source/common/repos.json /app/repos.json

WORKDIR /app

# All values are overridable via env vars at runtime
ENV UEMS_HOST=0.0.0.0
ENV UEMS_PORT=8443
ENV UEMS_GUIDELINES_DIR=/app/guidelines
ENV UEMS_PROMPTS_DIR=/app/agents/orchestrator/agents
ENV UEMS_REPO_DATA=/app/repos.json

EXPOSE 8443
ENTRYPOINT ["uems-agent-web"]
