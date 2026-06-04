package db

import (
	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	"actionphase/pkg/observability"
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ========================================
// Phase 4: TestSuite and ServiceFactory for DB Package
// ========================================

// TestSuite provides a comprehensive test environment with automatic cleanup
// and easy access to services and test data factories.
//
// Usage:
//
//	suite := db.NewTestSuite(t).
//	    WithCleanup("characters").
//	    Setup()
//	defer suite.Cleanup()
//
//	// Use services
//	characterService := suite.CharacterService()
//	character := suite.Factory().NewCharacter().InGame(game).Create()
type TestSuite struct {
	t              core.TestingInterface
	db             *core.TestDatabase
	factory        *core.TestDataFactory
	cleanupTables  []string
	setupFixtures  bool
	fixtures       *core.TestFixtures
	serviceFactory *ServiceFactory
}

// NewTestSuite creates a new test suite builder
func NewTestSuite(t core.TestingInterface) *TestSuite {
	return &TestSuite{
		t:             t,
		cleanupTables: []string{},
		setupFixtures: false,
	}
}

// WithCleanup sets the tables to cleanup using a preset or custom list
func (ts *TestSuite) WithCleanup(preset string) *TestSuite {
	ts.cleanupTables = core.CleanupPresets[preset]
	if ts.cleanupTables == nil {
		// If preset not found, treat as single table name
		ts.cleanupTables = []string{preset}
	}
	return ts
}

// WithTables sets custom tables for cleanup
func (ts *TestSuite) WithTables(tables ...string) *TestSuite {
	ts.cleanupTables = tables
	return ts
}

// WithFixtures enables automatic fixture setup
func (ts *TestSuite) WithFixtures() *TestSuite {
	ts.setupFixtures = true
	return ts
}

// Setup initializes the test suite (must be called after builder methods)
func (ts *TestSuite) Setup() *TestSuite {
	ts.db = core.NewTestDatabase(ts.t)
	ts.factory = core.NewTestDataFactory(ts.db, ts.t)
	ts.serviceFactory = NewServiceFactory(ts.db.Pool)

	if ts.setupFixtures {
		ts.fixtures = ts.db.SetupFixtures(ts.t)
	}

	return ts
}

// Cleanup performs test cleanup (call with defer)
func (ts *TestSuite) Cleanup() {
	if ts.db != nil {
		if len(ts.cleanupTables) > 0 {
			ts.db.CleanupTables(ts.t, ts.cleanupTables...)
		}
		ts.db.Close()
	}
}

// DB returns the test database
func (ts *TestSuite) DB() *core.TestDatabase {
	return ts.db
}

// Factory returns the test data factory
func (ts *TestSuite) Factory() *core.TestDataFactory {
	return ts.factory
}

// Fixtures returns the test fixtures (if WithFixtures was called)
func (ts *TestSuite) Fixtures() *core.TestFixtures {
	return ts.fixtures
}

// Pool returns the database connection pool
func (ts *TestSuite) Pool() *pgxpool.Pool {
	return ts.db.Pool
}

// Service factory methods - delegate to ServiceFactory
func (ts *TestSuite) UserService() *UserService {
	return ts.serviceFactory.UserService()
}

func (ts *TestSuite) SessionService() *SessionService {
	return ts.serviceFactory.SessionService()
}

func (ts *TestSuite) GameService() *GameService {
	return ts.serviceFactory.GameService()
}

func (ts *TestSuite) GameApplicationService() *GameApplicationService {
	return ts.serviceFactory.GameApplicationService()
}

func (ts *TestSuite) CharacterService() *CharacterService {
	return ts.serviceFactory.CharacterService()
}

func (ts *TestSuite) HandoutService() *HandoutService {
	return ts.serviceFactory.HandoutService()
}

func (ts *TestSuite) DeadlineService() *DeadlineService {
	return ts.serviceFactory.DeadlineService()
}

func (ts *TestSuite) PollService() *PollService {
	return ts.serviceFactory.PollService()
}

// TransitionGameTo is a convenience helper for transitioning game states
func (ts *TestSuite) TransitionGameTo(game models.Game, newState string) *models.Game {
	gameService := ts.GameService()
	updatedGame, err := gameService.UpdateGameState(context.Background(), game.ID, newState)
	if err != nil {
		ts.t.Fatalf("Failed to transition game to %s: %v", newState, err)
	}
	return updatedGame
}

// AddParticipant is a convenience helper for adding game participants
func (ts *TestSuite) AddParticipant(game models.Game, user models.User, role string) *models.GameParticipant {
	gameService := ts.GameService()
	participant, err := gameService.AddGameParticipant(context.Background(), game.ID, user.ID, role)
	if err != nil {
		ts.t.Fatalf("Failed to add participant to game: %v", err)
	}
	return participant
}

// ========================================
// ServiceFactory
// ========================================

// ServiceFactory provides easy creation of service instances with database connection
type ServiceFactory struct {
	pool   *pgxpool.Pool
	logger *observability.Logger
}

// NewServiceFactory creates a new service factory
func NewServiceFactory(pool *pgxpool.Pool) *ServiceFactory {
	obsLogger := observability.NewLogger("test", "error")
	return &ServiceFactory{
		pool:   pool,
		logger: obsLogger,
	}
}

// UserService creates a new UserService
func (sf *ServiceFactory) UserService() *UserService {
	return &UserService{DB: sf.pool, Logger: sf.logger}
}

// SessionService creates a new SessionService
func (sf *ServiceFactory) SessionService() *SessionService {
	return &SessionService{DB: sf.pool, Logger: sf.logger}
}

// GameService creates a new GameService
func (sf *ServiceFactory) GameService() *GameService {
	return &GameService{DB: sf.pool, Logger: sf.logger}
}

// GameApplicationService creates a new GameApplicationService
func (sf *ServiceFactory) GameApplicationService() *GameApplicationService {
	return &GameApplicationService{DB: sf.pool, Logger: sf.logger}
}

// CharacterService creates a new CharacterService
func (sf *ServiceFactory) CharacterService() *CharacterService {
	return &CharacterService{DB: sf.pool, Logger: sf.logger}
}

// HandoutService creates a new HandoutService
func (sf *ServiceFactory) HandoutService() *HandoutService {
	return &HandoutService{DB: sf.pool}
}

// DeadlineService creates a new DeadlineService
func (sf *ServiceFactory) DeadlineService() *DeadlineService {
	return &DeadlineService{DB: sf.pool, Logger: sf.logger}
}

// PollService creates a new PollService
func (sf *ServiceFactory) PollService() *PollService {
	return &PollService{DB: sf.pool, Logger: sf.logger}
}

// NotificationService creates a new NotificationService
func (sf *ServiceFactory) NotificationService() *NotificationService {
	return &NotificationService{DB: sf.pool, Logger: sf.logger}
}
