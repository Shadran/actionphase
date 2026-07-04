import { BaseApiClient } from './client';
import type {
  GamePhase,
  CreatePhaseRequest,
  UpdatePhaseRequest,
  UpdateDeadlineRequest,
  ActionSubmission,
  ActionSubmissionRequest,
  ActionWithDetails,
  ActionResult,
  DraftCharacterUpdate,
  CreateDraftCharacterUpdateRequest,
  UpdateDraftCharacterUpdateRequest
} from '../../types/phases';

/**
 * Phases and Actions API client
 * Handles phase management, action submissions, and action results
 */
export class PhasesApi extends BaseApiClient {
  // Phase endpoints
  async createPhase(gameId: number, data: CreatePhaseRequest) {
    return this.client.post<GamePhase>(`/api/v1/games/${gameId}/phases`, data);
  }

  async getCurrentPhase(gameId: number) {
    return this.client.get<{ phase: GamePhase | null }>(`/api/v1/games/${gameId}/current-phase`);
  }

  async getGamePhases(gameId: number) {
    return this.client.get<GamePhase[]>(`/api/v1/games/${gameId}/phases`);
  }

  async activatePhase(phaseId: number) {
    return this.client.post<GamePhase>(`/api/v1/phases/${phaseId}/activate`);
  }

  async updatePhaseDeadline(phaseId: number, data: UpdateDeadlineRequest) {
    return this.client.put<GamePhase>(`/api/v1/phases/${phaseId}/deadline`, data);
  }

  async updatePhase(phaseId: number, data: UpdatePhaseRequest) {
    return this.client.put<GamePhase>(`/api/v1/phases/${phaseId}`, data);
  }

  async deletePhase(phaseId: number) {
    return this.client.delete(`/api/v1/phases/${phaseId}`);
  }

  // Action endpoints
  async submitAction(gameId: number, data: ActionSubmissionRequest) {
    return this.client.post<ActionSubmission>(`/api/v1/games/${gameId}/actions`, data);
  }

  async getUserActions(gameId: number) {
    return this.client.get<ActionWithDetails[]>(`/api/v1/games/${gameId}/actions/mine`);
  }

  async getGameActions(gameId: number) {
    return this.client.get<ActionWithDetails[]>(`/api/v1/games/${gameId}/actions`);
  }

  async getUserResults(gameId: number) {
    return this.client.get<ActionResult[]>(`/api/v1/games/${gameId}/results/mine`);
  }

  async getGameResults(gameId: number) {
    return this.client.get<ActionResult[]>(`/api/v1/games/${gameId}/results`);
  }

  async createActionResult(gameId: number, data: { user_id: number; character_id?: number; action_submission_id?: number; content: string; is_published?: boolean }) {
    return this.client.post<ActionResult>(`/api/v1/games/${gameId}/results`, data);
  }

  async publishAllPhaseResults(gameId: number, phaseId: number) {
    return this.client.post(`/api/v1/games/${gameId}/phases/${phaseId}/results/publish`);
  }

  async getUnpublishedResultsCount(gameId: number, phaseId: number) {
    return this.client.get<{ count: number }>(`/api/v1/games/${gameId}/phases/${phaseId}/results/unpublished-count`);
  }

  async updateActionResult(gameId: number, resultId: number, data: { content: string }) {
    return this.client.put<ActionResult>(`/api/v1/games/${gameId}/results/${resultId}`, data);
  }

  async publishActionResult(gameId: number, resultId: number) {
    return this.client.post<ActionResult>(`/api/v1/games/${gameId}/results/${resultId}/publish`);
  }

  async deleteActionResult(gameId: number, resultId: number) {
    return this.client.delete(`/api/v1/games/${gameId}/results/${resultId}`);
  }

  // Draft character update endpoints
  async createDraftCharacterUpdate(gameId: number, resultId: number, data: CreateDraftCharacterUpdateRequest) {
    return this.client.post<DraftCharacterUpdate>(
      `/api/v1/games/${gameId}/results/${resultId}/character-updates`,
      data
    );
  }

  async getDraftCharacterUpdates(gameId: number, resultId: number) {
    return this.client.get<DraftCharacterUpdate[]>(
      `/api/v1/games/${gameId}/results/${resultId}/character-updates`
    );
  }

  async getDraftUpdateCount(gameId: number, resultId: number) {
    return this.client.get<{ count: number }>(
      `/api/v1/games/${gameId}/results/${resultId}/character-updates/count`
    );
  }

  async updateDraftCharacterUpdate(
    gameId: number,
    resultId: number,
    draftId: number,
    data: UpdateDraftCharacterUpdateRequest
  ) {
    return this.client.put<DraftCharacterUpdate>(
      `/api/v1/games/${gameId}/results/${resultId}/character-updates/${draftId}`,
      data
    );
  }

  async deleteDraftCharacterUpdate(gameId: number, resultId: number, draftId: number) {
    return this.client.delete(`/api/v1/games/${gameId}/results/${resultId}/character-updates/${draftId}`);
  }
}
