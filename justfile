# ActionPhase Development Commands
# Consolidated from 93 → 25 commands for better discoverability
#
# Quick Reference:
#   just help          - Show this help
#   just dev           - Start development environment
#   just test          - Run backend tests
#   just test-fe       - Run frontend tests
#   just e2e           - Run E2E tests
#   just build         - Build backend
#
# For detailed help on any command with subcommands, run:
#   just <command> help

# Show available commands
help:
  @just --list

# Deploy latest changes on this server (run from /opt/actionphase); use 'just deploy no-cache' to force full rebuild
deploy no_cache="":
  #!/usr/bin/env bash
  if [ "{{no_cache}}" = "no-cache" ]; then
    NO_CACHE=true ./scripts/deploy-production.sh
  else
    ./scripts/deploy-production.sh
  fi

# Launch Claude Code editor
claude:
    CLAUDE_CONFIG_DIR="$HOME/.claude-personal" ~/.local/bin/claude

# ═══════════════════════════════════════════════════════════════════════════
# DATABASE COMMANDS
# ═══════════════════════════════════════════════════════════════════════════

# Database operations: up, down, reset, create, setup
db action="help":
  #!/usr/bin/env bash
  case "{{action}}" in
    up)
      docker-compose up -d db
      ;;
    down)
      docker-compose down db
      ;;
    reset)
      docker-compose down db
      docker-compose up -d db
      echo "Database reset complete"
      ;;
    create)
      echo "Creating ActionPhase databases..."
      echo "Waiting for PostgreSQL to be ready..."
      sleep 3
      createdb -h localhost -U postgres -W actionphase 2>/dev/null || echo "Database 'actionphase' already exists or creation failed"
      createdb -h localhost -U postgres -W actionphase_test 2>/dev/null || echo "Database 'actionphase_test' already exists or creation failed"
      echo "Databases created successfully"
      echo "Note: You may be prompted for password 'example' (from docker-compose.yml)"
      ;;
    setup)
      just db up
      just db create
      echo "Database setup complete!"
      echo "Next steps:"
      echo "  1. Run migrations: just migrate"
      echo "  2. Start the backend: just dev"
      ;;
    help|*)
      echo "Usage: just db [action]"
      echo ""
      echo "Actions:"
      echo "  up        Start database container"
      echo "  down      Stop database container"
      echo "  reset     Reset database (down + up)"
      echo "  create    Create dev and test databases"
      echo "  setup     Full database setup (up + create)"
      ;;
  esac

# ═══════════════════════════════════════════════════════════════════════════
# MIGRATION COMMANDS
# ═══════════════════════════════════════════════════════════════════════════

# Migration operations: create, status, rollback, test
migration action="" name="":
  #!/usr/bin/env bash
  DB_URL="postgres://postgres:example@localhost:5432/actionphase?sslmode=disable"
  TEST_DB_URL="postgres://postgres:example@localhost:5432/actionphase_test?sslmode=disable"

  case "{{action}}" in
    create)
      if [ -z "{{name}}" ]; then
        echo "❌ Migration name required"
        echo "Usage: just migration create <name>"
        exit 1
      fi
      migrate create -ext sql -dir backend/pkg/db/migrations {{name}}
      ;;
    status)
      migrate -source file://backend/pkg/db/migrations -database "$DB_URL" version
      ;;
    rollback)
      migrate -source file://backend/pkg/db/migrations -database "$DB_URL" down
      ;;
    test)
      migrate -source file://backend/pkg/db/migrations -database "$TEST_DB_URL" up
      ;;
    help|*)
      echo "Usage: just migration [action]"
      echo ""
      echo "Actions:"
      echo "  create <name>    Create new migration"
      echo "  status           Show migration status"
      echo "  rollback         Rollback last migration"
      echo "  test             Apply migrations to test database"
      ;;
  esac

# Apply migrations to development database
migrate:
  migrate -source file://backend/pkg/db/migrations -database "postgres://postgres:example@localhost:5432/actionphase?sslmode=disable" up

# Apply migrations to test database
migrate_test:
  migrate -source file://backend/pkg/db/migrations -database "postgres://postgres:example@localhost:5432/actionphase_test?sslmode=disable" up

# Drop and recreate test database, then apply all migrations from scratch
# Use this when the test DB gets into a dirty/broken migration state
reset_test_db:
  #!/usr/bin/env bash
  echo "Dropping test database..."
  PGPASSWORD=example psql -h localhost -p 5432 -U postgres -d postgres -c "DROP DATABASE IF EXISTS actionphase_test;"
  echo "Creating test database..."
  PGPASSWORD=example psql -h localhost -p 5432 -U postgres -d postgres -c "CREATE DATABASE actionphase_test;"
  echo "Applying migrations..."
  just migrate_test
  echo "✅ Test database reset complete"

# ═══════════════════════════════════════════════════════════════════════════
# TEST DATA COMMANDS
# ═══════════════════════════════════════════════════════════════════════════

# Apply test data fixtures to development database
test-fixtures:
  @echo "Applying test data fixtures..."
  @./backend/pkg/db/test_fixtures/apply_all.sh
  @echo "✅ Test data loaded successfully!"

# Reset and reload test data
test-data action="reload":
  #!/usr/bin/env bash
  case "{{action}}" in
    reset)
      echo "Resetting test data..."
      PGPASSWORD=example psql -h localhost -p 5432 -U postgres -d actionphase -f backend/pkg/db/test_fixtures/00_reset.sql
      echo "✅ Test data reset complete"
      ;;
    reload)
      echo "Resetting test data..."
      PGPASSWORD=example psql -h localhost -p 5432 -U postgres -d actionphase -f backend/pkg/db/test_fixtures/00_reset.sql
      echo "Applying test data fixtures..."
      ./backend/pkg/db/test_fixtures/apply_all.sh
      echo "🎉 Test data reloaded!"
      echo ""
      echo "Test Accounts Available:"
      echo "  GM: test_gm@example.com / testpassword123"
      echo "  Players: test_player1@example.com through test_player5@example.com / testpassword123"
      echo "  Audience: test_audience@example.com / testpassword123"
      ;;
    *)
      echo "Usage: just test-data [action]"
      echo ""
      echo "Actions:"
      echo "  reset     Reset test data only"
      echo "  reload    Full reset and reload (default)"
      ;;
  esac

# Load only common base data (users and config)
load-common:
  #!/usr/bin/env bash
  set -euo pipefail
  echo "🧹 Loading common base data..."
  DB_NAME=actionphase ./backend/pkg/db/test_fixtures/apply_common.sh
  echo "✅ Common data loaded (users only, no games)"

# Load demo data for staging/showcase
load-demo:
  #!/usr/bin/env bash
  set -euo pipefail
  echo "🎭 Loading demo showcase data..."
  DB_NAME=actionphase ./backend/pkg/db/test_fixtures/apply_demo.sh
  echo "✅ Demo data loaded (rich, human-friendly content)"

# Load E2E test fixtures (worker-specific for parallel execution)
load-e2e:
  #!/usr/bin/env bash
  set -euo pipefail
  echo "🤖 Loading E2E test fixtures for parallel execution (6 workers)..."

  # Apply common fixtures first
  echo "📦 Applying common fixtures..."
  bash ./backend/pkg/db/test_fixtures/apply_common.sh

  # Apply worker-specific fixtures for all 6 workers
  echo "🔧 Applying worker-specific fixtures..."
  for i in 0 1 2 3 4 5; do
    echo "  Worker $i..."
    DB_NAME=actionphase ./backend/pkg/db/test_fixtures/apply_e2e_worker.sh $i > /dev/null 2>&1
  done

  echo "✅ E2E fixtures loaded for 6 parallel workers (isolated test games)"

# Load all data (dev only) - same as test-fixtures but with new structure
load-all:
  #!/usr/bin/env bash
  set -euo pipefail
  echo "⚠️  Loading ALL data (demo + E2E)..."
  just load-demo
  just load-e2e
  echo "✅ All data loaded (not recommended for staging)"

# ═══════════════════════════════════════════════════════════════════════════
# CODE GENERATION
# ═══════════════════════════════════════════════════════════════════════════

# Generate SQL code using sqlc
sqlgen:
  cd backend/pkg/db && sqlc generate

# ═══════════════════════════════════════════════════════════════════════════
# GO BACKEND COMMANDS
# ═══════════════════════════════════════════════════════════════════════════

# Go module maintenance
tidy:
  cd backend && go mod tidy

# Format Go code
fmt:
  cd backend && go fmt ./...

# Run Go vet
vet:
  #!/usr/bin/env bash
  cd backend
  # Exclude pkg/docs/dist (embedded frontend assets)
  packages=$(go list ./... | grep -v '/pkg/docs/dist')
  if [ -n "$packages" ]; then
    go vet $packages
  else
    echo "No packages to vet"
  fi

# Run backend linters (fmt + vet)
lint: fmt vet
  @echo "Go linting complete"

# ═══════════════════════════════════════════════════════════════════════════
# BUILD COMMANDS
# ═══════════════════════════════════════════════════════════════════════════

# Build backend
build:
  cd backend && go build ./...

# Build with options: backend, frontend, all, binary, ci
build-all target="backend" *flags="":
  #!/usr/bin/env bash
  case "{{target}}" in
    backend)
      cd backend && go build ./...
      ;;
    frontend)
      cd frontend && npm run build
      ;;
    binary)
      echo "Building backend binary..."
      cd backend && go build -o /tmp/actionphase-backend main.go
      echo "✅ Binary built: /tmp/actionphase-backend"
      ;;
    all)
      echo "Building backend..."
      cd backend && go build ./...
      echo "Building frontend..."
      cd frontend && npm run build
      echo "✅ All builds complete"
      ;;
    ci)
      echo "Running CI builds..."
      cd backend && go build ./...
      cd frontend && npm run build
      echo "✅ CI build complete"
      ;;
    *)
      echo "Usage: just build-all [target]"
      echo ""
      echo "Targets:"
      echo "  backend     Build backend (default)"
      echo "  frontend    Build frontend"
      echo "  binary      Build backend binary to /tmp"
      echo "  all         Build backend + frontend"
      echo "  ci          CI build (backend + frontend)"
      ;;
  esac

# ═══════════════════════════════════════════════════════════════════════════
# DEVELOPMENT WORKFLOW
# ═══════════════════════════════════════════════════════════════════════════

# Complete development environment setup
dev-setup: tidy
  @just db setup
  @echo "Setting up development environment..."
  @echo "Creating .env file if it doesn't exist..."
  @if [ ! -f .env ]; then cp .env.example .env; echo "✓ Created .env from .env.example"; fi
  @echo ""
  @echo "🎉 Development environment setup complete!"
  @echo ""
  @echo "Next steps:"
  @echo "  1. Review and customize .env file if needed"
  @echo "  2. Run migrations: just migrate"
  @echo "  3. Start development: just dev"

# Start development environment (backend only)
dev:
  @echo "Starting ActionPhase development environment..."
  @echo "📋 Checking environment..."
  @if [ ! -f .env ]; then echo "❌ .env file not found. Run 'just dev-setup' first."; exit 1; fi
  @echo "✓ .env file found"
  @echo "✓ Starting database..."
  @just db up
  @sleep 2
  @echo "✓ Database running"
  @echo ""
  @echo "🚀 Starting backend server..."
  @echo "   Backend: http://localhost:3000"
  @echo "   Database: localhost:5432"
  @echo ""
  @echo "Press Ctrl+C to stop"
  cd backend && go run main.go

# Start services: backend, frontend, or all
start service="backend":
  #!/usr/bin/env bash
  case "{{service}}" in
    backend)
      cd backend && go run main.go
      ;;
    frontend)
      cd frontend && npm run dev
      ;;
    all)
      echo "Starting full development environment..."
      echo "Backend: http://localhost:3000"
      echo "Frontend: http://localhost:5173"
      echo "Press Ctrl+C to stop all services"
      trap 'kill 0' SIGINT; \
      (cd backend && go run main.go) & \
      (cd frontend && npm run dev) & \
      wait
      ;;
    *)
      echo "Usage: just start [service]"
      echo ""
      echo "Services:"
      echo "  backend     Start backend only (default)"
      echo "  frontend    Start frontend only"
      echo "  all         Start both backend and frontend"
      ;;
  esac

# ═══════════════════════════════════════════════════════════════════════════
# BACKEND TESTING
# ═══════════════════════════════════════════════════════════════════════════

# Helper function to clean test database
_clean_test_db:
  #!/usr/bin/env bash
  echo "🧹 Cleaning actionphase_test database for integration tests..."
  PGPASSWORD=example psql -h localhost -p 5432 -U postgres -d actionphase_test -q -c "
  DO \$\$
  DECLARE
      r RECORD;
  BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
      END LOOP;
  END \$\$;
  " 2>&1 | grep -v "NOTICE" || true
  echo "✅ Test database cleaned"

# Run all backend tests (default: everything with database)
test:
  @echo "🧪 Running all backend tests (integration + mocks)..."
  @just _clean_test_db
  cd backend && TEST_DATABASE_URL="postgres://postgres:example@localhost:5432/actionphase_test?sslmode=disable" SKIP_DB_TESTS=false go test -p=1 ./...

# Run fast mock tests only (no database required)
test-mocks:
  @echo "⚡ Running mock tests only (fast, parallel)..."
  cd backend && SKIP_DB_TESTS=true go test ./...

# Run database service integration tests only
test-integration:
  @echo "🗄️  Running database integration tests..."
  @just _clean_test_db
  cd backend && TEST_DATABASE_URL="postgres://postgres:example@localhost:5432/actionphase_test?sslmode=disable" SKIP_DB_TESTS=false go test -p=1 ./pkg/db/services/...

# Run tests with coverage report
test-coverage:
  @echo "📊 Running all tests with coverage..."
  @just _clean_test_db
  cd backend && TEST_DATABASE_URL="postgres://postgres:example@localhost:5432/actionphase_test?sslmode=disable" SKIP_DB_TESTS=false go test -p=1 -coverprofile=coverage.out ./...
  @echo ""
  @echo "Coverage report generated: backend/coverage.out"
  @cd backend && go tool cover -func=coverage.out | tail -1

# Run tests with race detector
test-race:
  @echo "🔍 Running tests with race detector..."
  @just _clean_test_db
  cd backend && TEST_DATABASE_URL="postgres://postgres:example@localhost:5432/actionphase_test?sslmode=disable" SKIP_DB_TESTS=false go test -p=1 -race ./...

# Clean test cache
test-clean:
  cd backend && go clean -testcache
  @echo "✅ Test cache cleaned"

# Run specific test by name
test-run pattern:
  @echo "🎯 Running tests matching: {{pattern}}"
  @just _clean_test_db
  cd backend && TEST_DATABASE_URL="postgres://postgres:example@localhost:5432/actionphase_test?sslmode=disable" SKIP_DB_TESTS=false go test -p=1 -v -run {{pattern}} ./...

# ═══════════════════════════════════════════════════════════════════════════
# FRONTEND TESTING
# ═══════════════════════════════════════════════════════════════════════════

# Run frontend tests (default: run once)
test-frontend:
  cd frontend && npm test

# Frontend testing with options
test-fe mode="run" file="":
  #!/usr/bin/env bash
  cd frontend

  case "{{mode}}" in
    run)
      npm test
      ;;
    watch)
      npm run test:watch
      ;;
    coverage)
      npm run test:coverage
      ;;
    ui)
      npm run test:ui
      ;;
    file)
      if [ -z "{{file}}" ]; then
        echo "❌ File path required for file mode"
        echo "Usage: just test-fe file path/to/test.tsx"
        exit 1
      fi
      npm test -- {{file}}
      ;;
    *)
      echo "Usage: just test-fe [mode] [file]"
      echo ""
      echo "Modes:"
      echo "  run         Run tests once (default)"
      echo "  watch       Run tests in watch mode"
      echo "  coverage    Run tests with coverage report"
      echo "  ui          Run tests with interactive UI"
      echo "  file <path> Run specific test file"
      ;;
  esac

# ═══════════════════════════════════════════════════════════════════════════
# E2E TESTING
# ═══════════════════════════════════════════════════════════════════════════

# Run E2E tests on both desktop and mobile (sequential to avoid fixture conflicts)
e2e:
  @just e2e-desktop
  @just e2e-mobile

# Run E2E tests on mobile only (Pixel 5)
e2e-mobile:
  @echo "🔄 Applying E2E test fixtures..."
  @just load-e2e
  @echo ""
  cd frontend && npx playwright test --project=mobile-chrome

# Run E2E tests on desktop only (Chrome)
e2e-desktop:
  @echo "🔄 Applying E2E test fixtures..."
  @just load-e2e
  @echo ""
  cd frontend && npx playwright test --project=chromium

# E2E testing with options
e2e-test mode="headless" file="":
  #!/usr/bin/env bash

  # Apply fixtures first
  echo "🔄 Applying E2E test fixtures..."
  just load-e2e
  echo ""

  cd frontend

  case "{{mode}}" in
    headless)
      npm run test:e2e
      ;;
    headed)
      npm run test:e2e:headed
      ;;
    ui)
      npm run test:e2e:ui
      ;;
    debug)
      npm run test:e2e:debug
      ;;
    report)
      npm run test:e2e:report
      ;;
    file)
      if [ -z "{{file}}" ]; then
        echo "❌ File path required for file mode"
        echo "Usage: just e2e-test file path/to/test.spec.ts"
        exit 1
      fi
      npx playwright test {{file}}
      ;;
    *)
      echo "Usage: just e2e-test [mode] [file]"
      echo ""
      echo "Modes:"
      echo "  headless    Run headless (default)"
      echo "  headed      Run with browser visible"
      echo "  ui          Run with interactive UI"
      echo "  debug       Run in debug mode"
      echo "  report      Show test report"
      echo "  file <path> Run specific test file"
      ;;
  esac

# ═══════════════════════════════════════════════════════════════════════════
# PROCESS MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════

# Kill processes: backend, frontend, all, or port
kill target="all" port="3000":
  #!/usr/bin/env bash
  case "{{target}}" in
    backend)
      echo "Stopping backend..."
      pkill -f "go run main.go" || pkill -f "actionphase-backend" || echo "Backend not running"
      ;;
    frontend)
      echo "Stopping frontend..."
      pkill -f "vite" || pkill -f "npm run dev" || echo "Frontend not running"
      ;;
    all)
      echo "Stopping all services..."
      pkill -f "go run main.go" || pkill -f "actionphase-backend" || true
      pkill -f "vite" || pkill -f "npm run dev" || true
      echo "✅ All services stopped"
      ;;
    port)
      echo "Killing process on port {{port}}..."
      lsof -ti:{{port}} | xargs kill -9 2>/dev/null || echo "No process on port {{port}}"
      ;;
    *)
      echo "Usage: just kill [target] [port]"
      echo ""
      echo "Targets:"
      echo "  backend     Kill backend process"
      echo "  frontend    Kill frontend process"
      echo "  all         Kill all processes (default)"
      echo "  port <num>  Kill process on specific port"
      ;;
  esac

# Restart services: backend, frontend, or all
restart target="backend":
  #!/usr/bin/env bash
  case "{{target}}" in
    backend)
      echo "🔄 Restarting backend..."
      just kill backend
      sleep 1
      echo "Building..."
      cd backend && go build -o /tmp/actionphase-backend main.go
      echo "Starting backend..."
      /tmp/actionphase-backend &
      echo "✅ Backend restarted (PID: $!)"
      echo "Logs: just logs backend --follow"
      ;;
    frontend)
      echo "🔄 Restarting frontend..."
      just kill frontend
      sleep 1
      echo "Starting frontend..."
      cd frontend && npm run dev > /tmp/frontend.log 2>&1 &
      echo "✅ Frontend restarted (PID: $!)"
      echo "Logs: just logs frontend --follow"
      ;;
    all)
      echo "🔄 Restarting all services..."
      just restart backend
      echo ""
      just restart frontend
      echo ""
      echo "✅ All services restarted!"
      ;;
    *)
      echo "Usage: just restart [target]"
      echo ""
      echo "Targets:"
      echo "  backend     Restart backend (default)"
      echo "  frontend    Restart frontend"
      echo "  all         Restart all services"
      ;;
  esac

# ═══════════════════════════════════════════════════════════════════════════
# LOGGING
# ═══════════════════════════════════════════════════════════════════════════

# View logs: backend, frontend, or all
logs target="backend" lines="50" follow="false":
  #!/usr/bin/env bash
  case "{{target}}" in
    backend)
      if [ "{{follow}}" = "true" ] || [ "{{follow}}" = "--follow" ]; then
        tail -f /tmp/backend.log 2>/dev/null || echo "Backend log not found"
      else
        tail -n {{lines}} /tmp/backend.log 2>/dev/null || echo "Backend log not found"
      fi
      ;;
    frontend)
      if [ "{{follow}}" = "true" ] || [ "{{follow}}" = "--follow" ]; then
        tail -f /tmp/frontend.log 2>/dev/null || echo "Frontend log not found"
      else
        tail -n {{lines}} /tmp/frontend.log 2>/dev/null || echo "Frontend log not found"
      fi
      ;;
    all)
      echo "=== Backend Logs (last {{lines}} lines) ==="
      tail -n {{lines}} /tmp/backend.log 2>/dev/null || echo "Backend log not found"
      echo ""
      echo "=== Frontend Logs (last {{lines}} lines) ==="
      tail -n {{lines}} /tmp/frontend.log 2>/dev/null || echo "Frontend log not found"
      ;;
    *)
      echo "Usage: just logs [target] [lines] [--follow]"
      echo ""
      echo "Targets:"
      echo "  backend     View backend logs (default)"
      echo "  frontend    View frontend logs"
      echo "  all         View all logs"
      echo ""
      echo "Options:"
      echo "  lines       Number of lines to show (default: 50)"
      echo "  --follow    Follow log in real-time"
      ;;
  esac

# ═══════════════════════════════════════════════════════════════════════════
# STATUS & HEALTH
# ═══════════════════════════════════════════════════════════════════════════

# Complete system status check
status:
  @echo "═══════════════════════════════════════════════════════════"
  @echo "            ActionPhase System Status"
  @echo "═══════════════════════════════════════════════════════════"
  @echo ""
  @echo "=== Services ==="
  @echo -n "Backend:  "
  @if pgrep -f "go run main.go" > /dev/null || pgrep -f "actionphase-backend" > /dev/null; then \
    echo "✅ Running"; \
  else \
    echo "❌ Not running"; \
  fi
  @echo -n "Frontend: "
  @if pgrep -f "vite" > /dev/null; then \
    echo "✅ Running"; \
  else \
    echo "❌ Not running"; \
  fi
  @echo ""
  @echo "=== Database ==="
  @if docker ps | grep -q actionphase-db; then \
    echo "✅ Database container is running"; \
  else \
    echo "❌ Database container is not running"; \
  fi
  @echo ""
  @just migration status 2>/dev/null || echo "❌ Database connection failed"
  @echo ""
  @echo "=== API Health ==="
  @echo -n "Health endpoint: "
  @curl -sf http://localhost:3000/health > /dev/null 2>&1 && echo "✅ Healthy" || echo "❌ Down"
  @echo ""
  @echo "=== Git Status ==="
  @git status --short | head -10
  @echo ""
  @echo "═══════════════════════════════════════════════════════════"

# ═══════════════════════════════════════════════════════════════════════════
# CLEANUP
# ═══════════════════════════════════════════════════════════════════════════

# Clean build artifacts and caches
clean:
  @echo "Cleaning build artifacts..."
  @cd backend && go clean -testcache
  @cd backend && go clean
  @cd frontend && rm -rf node_modules/.cache dist 2>/dev/null || true
  @echo "✅ Cleanup complete"

# ═══════════════════════════════════════════════════════════════════════════
# CI/CD
# ═══════════════════════════════════════════════════════════════════════════

# Run CI test suite
ci-test: lint
  @just test-backend --race
  @just test-frontend
  @echo "✅ CI test suite complete"

# Run full test suite (backend + frontend)
test-all:
  @just test-backend --all
  @just test-frontend
  @echo "✅ All tests complete"

# ═══════════════════════════════════════════════════════════════════════════
# FRONTEND PACKAGE MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════

# Install frontend dependencies
install-frontend:
  cd frontend && npm install

# Lint frontend code
lint-frontend:
  cd frontend && npm run lint

# Preview frontend build
preview-frontend:
  cd frontend && npm run preview

# ═══════════════════════════════════════════════════════════════════════════
# DOCUMENTATION
# ═══════════════════════════════════════════════════════════════════════════

# Start documentation development server
docs-dev:
  cd docs-site && npm run docs:dev

# Build documentation site
docs-build:
  cd docs-site && npm install && npm run docs:build
  @echo "✅ Documentation built to docs-site/.vitepress/dist"

# Preview built documentation
docs-preview:
  cd docs-site && npm run docs:preview

# Install documentation dependencies
docs-install:
  cd docs-site && npm install

# Build and embed documentation in backend
docs-embed: docs-build
  @echo "📦 Embedding documentation in backend..."
  rm -rf backend/pkg/docs/dist
  cp -r docs-site/.vitepress/dist backend/pkg/docs/dist
  @echo "✅ Documentation embedded at backend/pkg/docs/dist"
  @echo "🔧 Rebuild backend to include updated docs: just build or go run backend/main.go"

# Validate API documentation completeness
api-docs-validate:
  #!/usr/bin/env bash
  cd backend
  go run scripts/validate-api-docs.go

# Generate skeleton documentation for undocumented routes
api-docs-generate:
  #!/usr/bin/env bash
  cd backend
  go run scripts/generate-doc-skeleton.go
