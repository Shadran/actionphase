package core

import (
	db "actionphase/pkg/db/models"
	"context"
)

// Mock implementations for repository interfaces
// These enable fast unit testing without database dependencies

// MockUserRepository provides a mock implementation of UserRepository
type MockUserRepository struct {
	CreateUserFn        func(ctx context.Context, params db.CreateUserParams) (db.User, error)
	GetUserFn           func(ctx context.Context, id int32) (db.User, error)
	GetUserByUsernameFn func(ctx context.Context, username string) (db.User, error)
	UpdateUserFn        func(ctx context.Context, params db.UpdateUserParams) error
	DeleteUserFn        func(ctx context.Context, id int32) error
	ListAllUsersFn      func(ctx context.Context, arg db.ListAllUsersParams) ([]db.User, error)
}

func (m *MockUserRepository) CreateUser(ctx context.Context, params db.CreateUserParams) (db.User, error) {
	if m.CreateUserFn != nil {
		return m.CreateUserFn(ctx, params)
	}
	return db.User{}, nil
}

func (m *MockUserRepository) GetUser(ctx context.Context, id int32) (db.User, error) {
	if m.GetUserFn != nil {
		return m.GetUserFn(ctx, id)
	}
	return db.User{}, nil
}

func (m *MockUserRepository) GetUserByUsername(ctx context.Context, username string) (db.User, error) {
	if m.GetUserByUsernameFn != nil {
		return m.GetUserByUsernameFn(ctx, username)
	}
	return db.User{}, nil
}

func (m *MockUserRepository) UpdateUser(ctx context.Context, params db.UpdateUserParams) error {
	if m.UpdateUserFn != nil {
		return m.UpdateUserFn(ctx, params)
	}
	return nil
}

func (m *MockUserRepository) DeleteUser(ctx context.Context, id int32) error {
	if m.DeleteUserFn != nil {
		return m.DeleteUserFn(ctx, id)
	}
	return nil
}

func (m *MockUserRepository) ListAllUsers(ctx context.Context, arg db.ListAllUsersParams) ([]db.User, error) {
	if m.ListAllUsersFn != nil {
		return m.ListAllUsersFn(ctx, arg)
	}
	return []db.User{}, nil
}

// MockSessionRepository provides a mock implementation of SessionRepository
type MockSessionRepository struct {
	CreateSessionFn        func(ctx context.Context, params db.CreateSessionParams) (db.Session, error)
	GetSessionFn           func(ctx context.Context, id int32) (db.Session, error)
	GetSessionByTokenFn    func(ctx context.Context, data string) (db.Session, error)
	DeleteSessionFn        func(ctx context.Context, id int32) error
	DeleteSessionByTokenFn func(ctx context.Context, data string) error
	GetSessionsByUserFn    func(ctx context.Context, userID int32) ([]db.Session, error)
}

func (m *MockSessionRepository) CreateSession(ctx context.Context, params db.CreateSessionParams) (db.Session, error) {
	if m.CreateSessionFn != nil {
		return m.CreateSessionFn(ctx, params)
	}
	return db.Session{}, nil
}

func (m *MockSessionRepository) GetSession(ctx context.Context, id int32) (db.Session, error) {
	if m.GetSessionFn != nil {
		return m.GetSessionFn(ctx, id)
	}
	return db.Session{}, nil
}

func (m *MockSessionRepository) GetSessionByToken(ctx context.Context, data string) (db.Session, error) {
	if m.GetSessionByTokenFn != nil {
		return m.GetSessionByTokenFn(ctx, data)
	}
	return db.Session{}, nil
}

func (m *MockSessionRepository) DeleteSession(ctx context.Context, id int32) error {
	if m.DeleteSessionFn != nil {
		return m.DeleteSessionFn(ctx, id)
	}
	return nil
}

func (m *MockSessionRepository) DeleteSessionByToken(ctx context.Context, data string) error {
	if m.DeleteSessionByTokenFn != nil {
		return m.DeleteSessionByTokenFn(ctx, data)
	}
	return nil
}

func (m *MockSessionRepository) GetSessionsByUser(ctx context.Context, userID int32) ([]db.Session, error) {
	if m.GetSessionsByUserFn != nil {
		return m.GetSessionsByUserFn(ctx, userID)
	}
	return []db.Session{}, nil
}

// MockGameRepository provides a mock implementation of GameRepository
type MockGameRepository struct {
	CreateGameFn         func(ctx context.Context, params db.CreateGameParams) (db.Game, error)
	GetGameFn            func(ctx context.Context, id int32) (db.Game, error)
	GetGamesByUserFn     func(ctx context.Context, userID int32) ([]db.GetGamesByUserRow, error)
	GetGamesByGMFn       func(ctx context.Context, gmUserID int32) ([]db.Game, error)
	GetRecruitingGamesFn func(ctx context.Context) ([]db.GetRecruitingGamesRow, error)
	GetGameWithDetailsFn func(ctx context.Context, id int32) (db.GetGameWithDetailsRow, error)
	UpdateGameFn         func(ctx context.Context, params db.UpdateGameParams) (db.Game, error)
	UpdateGameStateFn    func(ctx context.Context, params db.UpdateGameStateParams) (db.Game, error)
	DeleteGameFn         func(ctx context.Context, id int32) error
}

func (m *MockGameRepository) CreateGame(ctx context.Context, params db.CreateGameParams) (db.Game, error) {
	if m.CreateGameFn != nil {
		return m.CreateGameFn(ctx, params)
	}
	return db.Game{}, nil
}

func (m *MockGameRepository) GetGame(ctx context.Context, id int32) (db.Game, error) {
	if m.GetGameFn != nil {
		return m.GetGameFn(ctx, id)
	}
	return db.Game{}, nil
}

func (m *MockGameRepository) GetGamesByUser(ctx context.Context, userID int32) ([]db.GetGamesByUserRow, error) {
	if m.GetGamesByUserFn != nil {
		return m.GetGamesByUserFn(ctx, userID)
	}
	return []db.GetGamesByUserRow{}, nil
}

func (m *MockGameRepository) GetGamesByGM(ctx context.Context, gmUserID int32) ([]db.Game, error) {
	if m.GetGamesByGMFn != nil {
		return m.GetGamesByGMFn(ctx, gmUserID)
	}
	return []db.Game{}, nil
}

func (m *MockGameRepository) GetRecruitingGames(ctx context.Context) ([]db.GetRecruitingGamesRow, error) {
	if m.GetRecruitingGamesFn != nil {
		return m.GetRecruitingGamesFn(ctx)
	}
	return []db.GetRecruitingGamesRow{}, nil
}

func (m *MockGameRepository) GetGameWithDetails(ctx context.Context, id int32) (db.GetGameWithDetailsRow, error) {
	if m.GetGameWithDetailsFn != nil {
		return m.GetGameWithDetailsFn(ctx, id)
	}
	return db.GetGameWithDetailsRow{}, nil
}

func (m *MockGameRepository) UpdateGame(ctx context.Context, params db.UpdateGameParams) (db.Game, error) {
	if m.UpdateGameFn != nil {
		return m.UpdateGameFn(ctx, params)
	}
	return db.Game{}, nil
}

func (m *MockGameRepository) UpdateGameState(ctx context.Context, params db.UpdateGameStateParams) (db.Game, error) {
	if m.UpdateGameStateFn != nil {
		return m.UpdateGameStateFn(ctx, params)
	}
	return db.Game{}, nil
}

func (m *MockGameRepository) DeleteGame(ctx context.Context, id int32) error {
	if m.DeleteGameFn != nil {
		return m.DeleteGameFn(ctx, id)
	}
	return nil
}

// MockGameParticipantRepository provides a mock implementation of GameParticipantRepository
type MockGameParticipantRepository struct {
	AddGameParticipantFn      func(ctx context.Context, params db.AddGameParticipantParams) (db.GameParticipant, error)
	GetGameParticipantsFn     func(ctx context.Context, gameID int32) ([]db.GetGameParticipantsRow, error)
	RemoveGameParticipantFn   func(ctx context.Context, params db.RemoveGameParticipantParams) error
	IsUserInGameFn            func(ctx context.Context, params db.IsUserInGameParams) (bool, error)
	CanUserJoinGameFn         func(ctx context.Context, params db.CanUserJoinGameParams) (string, error)
	GetParticipantRoleFn      func(ctx context.Context, params db.GetParticipantRoleParams) (string, error)
	UpdateParticipantStatusFn func(ctx context.Context, params db.UpdateParticipantStatusParams) (db.GameParticipant, error)
	GetGameParticipantCountFn func(ctx context.Context, gameID int32) (int64, error)
}

func (m *MockGameParticipantRepository) AddGameParticipant(ctx context.Context, params db.AddGameParticipantParams) (db.GameParticipant, error) {
	if m.AddGameParticipantFn != nil {
		return m.AddGameParticipantFn(ctx, params)
	}
	return db.GameParticipant{}, nil
}

func (m *MockGameParticipantRepository) GetGameParticipants(ctx context.Context, gameID int32) ([]db.GetGameParticipantsRow, error) {
	if m.GetGameParticipantsFn != nil {
		return m.GetGameParticipantsFn(ctx, gameID)
	}
	return []db.GetGameParticipantsRow{}, nil
}

func (m *MockGameParticipantRepository) RemoveGameParticipant(ctx context.Context, params db.RemoveGameParticipantParams) error {
	if m.RemoveGameParticipantFn != nil {
		return m.RemoveGameParticipantFn(ctx, params)
	}
	return nil
}

func (m *MockGameParticipantRepository) IsUserInGame(ctx context.Context, params db.IsUserInGameParams) (bool, error) {
	if m.IsUserInGameFn != nil {
		return m.IsUserInGameFn(ctx, params)
	}
	return false, nil
}

func (m *MockGameParticipantRepository) CanUserJoinGame(ctx context.Context, params db.CanUserJoinGameParams) (string, error) {
	if m.CanUserJoinGameFn != nil {
		return m.CanUserJoinGameFn(ctx, params)
	}
	return "can_join", nil
}

func (m *MockGameParticipantRepository) GetParticipantRole(ctx context.Context, params db.GetParticipantRoleParams) (string, error) {
	if m.GetParticipantRoleFn != nil {
		return m.GetParticipantRoleFn(ctx, params)
	}
	return "player", nil
}

func (m *MockGameParticipantRepository) UpdateParticipantStatus(ctx context.Context, params db.UpdateParticipantStatusParams) (db.GameParticipant, error) {
	if m.UpdateParticipantStatusFn != nil {
		return m.UpdateParticipantStatusFn(ctx, params)
	}
	return db.GameParticipant{}, nil
}

func (m *MockGameParticipantRepository) GetGameParticipantCount(ctx context.Context, gameID int32) (int64, error) {
	if m.GetGameParticipantCountFn != nil {
		return m.GetGameParticipantCountFn(ctx, gameID)
	}
	return 0, nil
}

// MockDatabaseRepository provides a mock implementation of DatabaseRepository
type MockDatabaseRepository struct {
	User            UserRepository
	Session         SessionRepository
	Game            GameRepository
	GameParticipant GameParticipantRepository
}

// NewMockDatabaseRepository creates a new mock database repository with default mocks
func NewMockDatabaseRepository() *MockDatabaseRepository {
	return &MockDatabaseRepository{
		User:            &MockUserRepository{},
		Session:         &MockSessionRepository{},
		Game:            &MockGameRepository{},
		GameParticipant: &MockGameParticipantRepository{},
	}
}
