package core

import "errors"

// ErrNotImplemented is returned by mock methods that have not been implemented
var ErrNotImplemented = errors.New("not implemented")

// ErrCharacterNotControlled is returned when a user attempts to use a character they don't control
var ErrCharacterNotControlled = errors.New("you do not control this character")

// ErrDraftPostExists is returned when attempting to create a draft post for a phase that already has one
var ErrDraftPostExists = errors.New("a draft post already exists for this phase")
