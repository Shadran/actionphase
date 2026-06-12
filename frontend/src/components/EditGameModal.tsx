import { useEffect, useRef } from 'react';
import type { GameWithDetails, UpdateGameRequest } from '../types/games';
import { apiClient } from '../lib/api';
import { Button, Alert } from './ui';
import { Modal } from './Modal';
import { GameFormFields } from './GameFormFields';
import { HelpTooltip } from './ui/HelpTooltip';
import { useGameForm, gameToFormData } from '../hooks/useGameForm';

interface EditGameModalProps {
  game: GameWithDetails;
  isOpen: boolean;
  onClose: () => void;
  onGameUpdated: () => void;
}

export function EditGameModal({ game, isOpen, onClose, onGameUpdated }: EditGameModalProps) {
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const {
    formData,
    setFormData,
    handleChange,
    error,
    setError,
    loading,
    setLoading,
    pendingBannerFile,
    bannerPreviewUrl,
    handleBannerFileSelect,
    discardPendingBanner,
    uploadBanner,
    deleteBanner,
    buildApiPayload,
  } = useGameForm(game);

  useEffect(() => {
    if (isOpen && game) {
      setFormData(gameToFormData(game));
      setError(null);
    }
  }, [isOpen, game, setFormData, setError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const { payload, error: validationError } = buildApiPayload();
    if (!payload) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);
      const updateData: UpdateGameRequest = {
        ...payload,
        is_public: true,
      };
      await apiClient.games.updateGame(game.id, updateData);
      onGameUpdated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update game');
    } finally {
      setLoading(false);
    }
  };

  const bannerUpload = (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <label className="block text-sm font-medium text-text-primary">Game Banner <span className="text-content-secondary font-normal">(optional)</span></label>
        <HelpTooltip text="A wide horizontal image shown at the top of your game page. Best at 6:1 aspect ratio (e.g. 1200×200px) — images will be cropped to fit." />
      </div>

      {(bannerPreviewUrl || game.banner_url) && (
        <div className="w-full rounded overflow-hidden" style={{ aspectRatio: '6/1' }}>
          <img
            src={bannerPreviewUrl ?? game.banner_url!}
            alt="Game banner"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {bannerPreviewUrl ? (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => {
              if (pendingBannerFile) {
                uploadBanner.mutate({ gameId: game.id, file: pendingBannerFile }, {
                  onSuccess: () => {
                    discardPendingBanner();
                    onGameUpdated();
                  },
                  onError: () => {
                    discardPendingBanner();
                  },
                });
              }
            }}
            loading={uploadBanner.isPending}
          >
            Use this image
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={uploadBanner.isPending}
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
            disabled={deleteBanner.isPending}
          >
            {game.banner_url ? 'Replace Banner' : 'Upload Banner'}
          </Button>
          {game.banner_url && (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => deleteBanner.mutate(game.id, { onSuccess: onGameUpdated })}
              loading={deleteBanner.isPending}
            >
              Remove Banner
            </Button>
          )}
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
        <p className="text-sm text-red-600">Failed to upload banner. Please try again.</p>
      )}
      {deleteBanner.isError && (
        <p className="text-sm text-red-600">Failed to remove banner. Please try again.</p>
      )}
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Game">
      {error && (
        <Alert variant="danger" className="mb-4" dismissible onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <GameFormFields
          formData={formData}
          onChange={handleChange}
          bannerUpload={bannerUpload}
        />

        {error && (
          <Alert variant="danger">
            {error}
          </Alert>
        )}

        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            className="flex-1"
          >
            Save Changes
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
