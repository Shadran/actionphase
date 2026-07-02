package core

// CharacterActivityStats holds public and private message counts for a character.
// PrivateMessages is nil when the requester is not authorized to see it.
type CharacterActivityStats struct {
	PublicMessages  int64  `json:"public_messages"`
	PrivateMessages *int64 `json:"private_messages,omitempty"`
}

// CreateCharacterRequest is the domain request for creating a character.
type CreateCharacterRequest struct {
	GameID        int32
	UserID        *int32 // nil for GM-controlled NPCs
	Name          string
	CharacterType string // "player_character", "npc"
}

// CharacterDataRequest is the domain request for setting character module data.
type CharacterDataRequest struct {
	CharacterID int32
	ModuleType  string
	FieldName   string
	FieldValue  string
	FieldType   string
	IsPublic    bool
}
