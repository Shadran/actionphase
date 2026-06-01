package core

import (
	db "actionphase/pkg/db/models"
	"context"
)

// Repository interfaces for mocking and dependency injection
// These interfaces enable fast unit tests by mocking database operations

// UserRepository defines the contract for user data operations
type UserRepository interface {
	CreateUser(ctx context.Context, params db.CreateUserParams) (db.User, error)
	GetUser(ctx context.Context, id int32) (db.User, error)
	GetUserByUsername(ctx context.Context, username string) (db.User, error)
	UpdateUser(ctx context.Context, params db.UpdateUserParams) error
	DeleteUser(ctx context.Context, id int32) error
	ListAllUsers(ctx context.Context, arg db.ListAllUsersParams) ([]db.User, error)
}

// SessionRepository defines the contract for session data operations
type SessionRepository interface {
	CreateSession(ctx context.Context, params db.CreateSessionParams) (db.Session, error)
	GetSession(ctx context.Context, id int32) (db.Session, error)
	GetSessionByToken(ctx context.Context, data string) (db.Session, error)
	DeleteSession(ctx context.Context, id int32) error
	DeleteSessionByToken(ctx context.Context, data string) error
	GetSessionsByUser(ctx context.Context, userID int32) ([]db.Session, error)
}

// GameRepository defines the contract for game data operations
type GameRepository interface {
	CreateGame(ctx context.Context, params db.CreateGameParams) (db.Game, error)
	GetGame(ctx context.Context, id int32) (db.Game, error)
	GetGamesByUser(ctx context.Context, userID int32) ([]db.GetGamesByUserRow, error)
	GetGamesByGM(ctx context.Context, gmUserID int32) ([]db.Game, error)
	GetRecruitingGames(ctx context.Context) ([]db.GetRecruitingGamesRow, error)
	GetGameWithDetails(ctx context.Context, id int32) (db.GetGameWithDetailsRow, error)
	UpdateGame(ctx context.Context, params db.UpdateGameParams) (db.Game, error)
	UpdateGameState(ctx context.Context, params db.UpdateGameStateParams) (db.Game, error)
	DeleteGame(ctx context.Context, id int32) error
}

// GameParticipantRepository defines the contract for game participant operations
type GameParticipantRepository interface {
	AddGameParticipant(ctx context.Context, params db.AddGameParticipantParams) (db.GameParticipant, error)
	GetGameParticipants(ctx context.Context, gameID int32) ([]db.GetGameParticipantsRow, error)
	RemoveGameParticipant(ctx context.Context, params db.RemoveGameParticipantParams) error
	IsUserInGame(ctx context.Context, params db.IsUserInGameParams) (bool, error)
	CanUserJoinGame(ctx context.Context, params db.CanUserJoinGameParams) (string, error)
	GetParticipantRole(ctx context.Context, params db.GetParticipantRoleParams) (string, error)
	UpdateParticipantStatus(ctx context.Context, params db.UpdateParticipantStatusParams) (db.GameParticipant, error)
	GetGameParticipantCount(ctx context.Context, gameID int32) (int64, error)
}

// DatabaseRepository wraps all repository interfaces
type DatabaseRepository struct {
	User            UserRepository
	Session         SessionRepository
	Game            GameRepository
	GameParticipant GameParticipantRepository
}

// Compile-time interface verification
var _ UserRepository = (*db.Queries)(nil)
var _ SessionRepository = (*db.Queries)(nil)
var _ GameRepository = (*db.Queries)(nil)
var _ GameParticipantRepository = (*db.Queries)(nil)
