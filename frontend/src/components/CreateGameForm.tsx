import { useRef } from 'react';
import { apiClient } from '../lib/api';
import { Button, Alert } from './ui';
import { GameFormFields } from './GameFormFields';
import { HelpTooltip } from './ui/HelpTooltip';
import { useGameForm } from '../hooks/useGameForm';

interface CreateGameFormProps {
  onSuccess?: (gameId: number) => void;
  onCancel?: () => void;
}

export const CreateGameForm = ({ onSuccess, onCancel }: CreateGameFormProps) => {
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const {
    formData,
    handleChange,
    error,
    setError,
    loading,
    setLoading,
    pendingBannerFile,
    bannerPreviewUrl,
    handleBannerFileSelect,
    discardPendingBanner,
    uploadPendingBanner,
    uploadBanner,
    buildApiPayload,
  } = useGameForm();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const { payload, error: validationError } = buildApiPayload();
    if (!payload) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.games.createGame(payload);
      const gameId = response.data.id;

      if (pendingBannerFile) {
        uploadPendingBanner(gameId, {
          onSuccess: () => onSuccess?.(gameId),
          onError: () => onSuccess?.(gameId),
        });
      } else {
        onSuccess?.(gameId);
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } }; message?: string };
      const errorMessage =
        axiosErr?.response?.data?.error ||
        (axiosErr?.message && axiosErr.message !== 'Network Error'
          ? axiosErr.message
          : 'Failed to create game');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const bannerUpload = (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <label className="block text-sm font-medium text-text-primary">
          Game Banner <span className="text-content-secondary font-normal">(optional)</span>
        </label>
        <HelpTooltip text="A wide horizontal image shown at the top of your game page. Best at 6:1 aspect ratio (e.g. 1200×200px) — images will be cropped to fit." />
      </div>

      {bannerPreviewUrl && (
        <div className="w-full rounded overflow-hidden" style={{ aspectRatio: '6/1' }}>
          <img src={bannerPreviewUrl} alt="Game banner preview" className="w-full h-full object-cover" />
        </div>
      )}

      {bannerPreviewUrl ? (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={discardPendingBanner}
          >
            Choose different
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => bannerInputRef.current?.click()}
          >
            Upload Banner
          </Button>
        </div>
      )}

      <input
        ref={bannerInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleBannerFileSelect(file);
          e.target.value = '';
        }}
      />
      {uploadBanner.isError && (
        <p className="text-sm text-danger-text">Failed to upload banner. Please try again.</p>
      )}
      {bannerPreviewUrl && (
        <p className="text-xs text-content-secondary">
          The banner will upload after the game is created.
        </p>
      )}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">
      {error && (
        <Alert variant="danger" className="mb-6" dismissible onDismiss={() => setError(null)} data-testid="error-message">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <GameFormFields
          formData={formData}
          onChange={handleChange}
          bannerUpload={bannerUpload}
        />

        <Alert variant="info" title="Game Creation Process">
          <ul className="text-sm space-y-1 list-disc list-inside">
            <li>Your game will start in "Setup" mode after creation</li>
            <li>Switch to "Recruitment" when ready to accept players</li>
            <li>Players can join until the recruitment deadline</li>
            <li>Move to "Character Creation" once recruitment is complete</li>
          </ul>
        </Alert>

        {error && (
          <Alert variant="danger">
            {error}
          </Alert>
        )}

        <div className="flex gap-4 pt-4">
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            className="flex-1"
            data-testid="create-game-submit"
          >
            {loading ? 'Creating Game...' : 'Create Game'}
          </Button>
          {onCancel && (
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              className="px-6"
            >
              Cancel
            </Button>
          )}
        </div>
      </form>
    </div>
  );
};
