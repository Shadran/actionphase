#!/bin/bash
set -euo pipefail

# Load E2E parallel worker users (workers 1-5)
# Worker 0 users are already in common/01_users.sql loaded by apply_common.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_NAME="${DB_NAME:-actionphase}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-example}"

PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
    -f "$SCRIPT_DIR/common/01_users_e2e_workers.sql" --quiet
