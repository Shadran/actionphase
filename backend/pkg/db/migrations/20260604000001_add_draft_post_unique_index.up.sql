CREATE UNIQUE INDEX idx_messages_one_draft_per_phase ON messages(phase_id) WHERE is_draft = true AND is_deleted = false;
