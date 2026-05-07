# Claude AI Context Directory

This directory contains all AI-specific context and instructions for working with the ActionPhase codebase.

## Directory Structure

### `/context/` - Read Before Coding
**These files should be read before performing specific tasks:**

- **TESTING.md** - Read before writing any tests (backend or frontend)
- **ARCHITECTURE.md** - Read for architectural context and patterns
- **STATE_MANAGEMENT.md** - Read before working on frontend state
- **FRONTEND_STYLING.md** - Read before creating/modifying ANY frontend component (dark mode required!)
- **TEST_DATA.md** - Read when working with test data and fixtures

### `/reference/` - Detailed Implementation Guides
**Comprehensive guides for specific implementation topics:**

- **BACKEND_ARCHITECTURE.md** - Detailed backend architecture guide
- **FRONTEND_ERROR_HANDLING.md** - Frontend error handling patterns
- **TESTING_GUIDE.md** - Testing implementation guide
- **LOGGING_STANDARDS.md** - Logging best practices
- **API_DOCUMENTATION.md** - API endpoint documentation
- **API_TESTING_WITH_CURL.md** - Complete curl-based API testing guide
- **JUSTFILE_QUICK_REFERENCE.md** - Quick reference for justfile commands
- And more...

### `/commands/` - Custom Slash Commands
**Detailed protocols for common tasks**

- **debug-e2e-test.md** - Mandatory protocol for debugging E2E test failures using Playwright MCP
- **implement-features.md** - Structured approach for implementing multiple features with TodoWrite
- **challenge-assumptions.md** - Protocol for clarifying ambiguous requirements before implementation

### `/planning/` - Session Planning & Task Tracking
**Persistent planning documents that survive across sessions:**

Use this directory to:
- Track multi-session implementation plans
- Document feature roadmaps and milestones
- Keep TODO lists for ongoing work
- Store design decisions and exploration notes

This allows for continuity between AI sessions and provides historical context for planning decisions.

## External Documentation References

### Architecture Decision Records (ADRs)
**Location**: `/docs-site/developer/architecture/adrs/`

Read ADRs for understanding architectural decisions:
- ADR-001: Technology Stack Selection
- ADR-002: Database Design Approach
- ADR-003: Authentication Strategy
- ADR-004: API Design Principles
- ADR-005: Frontend State Management
- ADR-006: Observability Approach
- ADR-007: Testing Strategy

**Note**: ADRs are served via VitePress at http://localhost:3000/docs/developer/architecture/adrs/

### System Architecture
**Location**: `/docs-site/developer/architecture/`

- overview.md - High-level system design
- components.md - How components communicate

**Note**: Architecture docs are served via VitePress at http://localhost:3000/docs/developer/architecture/

### Testing Documentation
**Location**: `/docs-site/developer/testing/`

- COVERAGE_STATUS.md - Current test coverage status
- TEST_COVERAGE_REFERENCE.md - Coverage metrics and recommendations
- TEST_DATA.md - Test fixtures and data setup
- E2E_QUICK_START.md - E2E testing quick reference
- E2E_FIXTURES.md - E2E test fixture documentation

**Note**: Testing docs are served via VitePress at http://localhost:3000/docs/developer/testing/

### Remaining docs/ Directory
**Location**: `/docs/`

Active documentation files (not in docs-site yet):
- Development guides (API docs automation, deployment)
- Operations guides (logging, deployment scripts)
- Feature implementation summaries
- State management details

## Workflow: When to Read What

### Before Writing Tests
1. Read `.claude/context/TESTING.md`
2. Review `/docs-site/developer/testing/COVERAGE_STATUS.md`
3. Reference `/docs-site/developer/architecture/adrs/007-testing-strategy.md`
4. Check `.claude/reference/TESTING_GUIDE.md` for implementation details

### Before Implementing Features
1. Read `.claude/context/ARCHITECTURE.md`
2. Review relevant ADRs in `/docs-site/developer/architecture/adrs/`
3. Check `/docs-site/developer/architecture/` for system design context

### Before Frontend State Work
1. Read `.claude/context/STATE_MANAGEMENT.md`
2. Review `/docs-site/developer/architecture/adrs/005-frontend-state-management.md`
3. Reference `/docs/features/STATE_MANAGEMENT.md`

### Before Working with Test Data
1. Read `.claude/context/TEST_DATA.md`
2. Review `/docs-site/developer/testing/TEST_DATA.md` for detailed fixture information
3. Check `/backend/pkg/db/test_fixtures/` for actual fixtures

### Before API Changes
1. Review `/docs-site/developer/architecture/adrs/004-api-design-principles.md`
2. Check `.claude/reference/API_DOCUMENTATION.md`
3. Review `.claude/reference/ERROR_HANDLING.md`

### Before Writing E2E Tests (CRITICAL)
**⚠️ E2E tests are the LAST step, NEVER the first!**

**Mandatory Pre-E2E Checklist:**
1. ✅ Backend unit test passes: `SKIP_DB_TESTS=true go test ./pkg/... -v`
2. ✅ API returns correct data: `curl http://localhost:3000/api/v1/... | jq`
3. ✅ Component test passes: `npm test -- Component.test.tsx`
4. ✅ Systems running: `curl http://localhost:3000/health && curl http://localhost:5173`

**E2E Test Rules:**
- Run synchronously: `npx playwright test --reporter=list` (NO `&`)
- One concern per test
- Use `data-testid` selectors
- Wait for specific conditions, not arbitrary timeouts

**See**: `.claude/context/TESTING.md` E2E section, `frontend/e2e/STATUS.md` for current coverage, and `frontend/e2e/README.md` for the complete guide

## Quick Start for AI

When starting a coding task:
1. Check CLAUDE.md in project root for general instructions
2. Identify the task type (testing, feature, frontend, etc.)
3. Read the relevant context files from `.claude/context/`
4. Reference detailed guides in `.claude/reference/` as needed
5. Check relevant ADRs for architectural decisions

## Maintenance

- Keep context files concise (< 500 lines)
- Update this README when adding new context files
- Move detailed implementation guides to `.claude/reference/`
- Keep ADRs in `/docs-site/developer/architecture/adrs/` (single source of truth)
- Update CLAUDE.md to reference new context files
