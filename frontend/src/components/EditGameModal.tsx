import { useState, useEffect, useRef } from 'react';
import type { GameWithDetails, UpdateGameRequest } from '../types/games';
import { apiClient } from '../lib/api';
import { Button, Alert } from './ui';
import { Modal } from './Modal';
import { GameFormFields, type GameFormData } from './GameFormFields';
import { convertToISO8601, formatDateTimeLocal } from '../lib/utils/dates';
import { useUploadGameBanner, useDeleteGameBanner } from '../hooks/useGameBanner';
import { HelpTooltip } from './ui/HelpTooltip';

interface EditGameModalProps {
  game: GameWithDetails;
  isOpen: boolean;
  onClose: () => void;
  onGameUpdated: () => void;
}

export function EditGameModal({ game, isOpen, onClose, onGameUpdated }: EditGameModalProps) {
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const uploadBanner = useUploadGameBanner();
  const deleteBanner = useDeleteGameBanner();

  const [formData, setFormData] = useState<GameFormData>({
    title: '',
    description: '',
    genre: '',
    max_players: '',
    recruitment_deadline: '',
    start_date: '',
    end_date: '',
    is_anonymous: false,
    auto_accept_audience: false,
    allow_group_conversations: true,
    portrait_avatars: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingBannerFile, setPendingBannerFile] = useState<File | null>(null);
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && game) {
      setFormData({
        title: game.title || '',
        description: game.description || '',
        genre: game.genre || '',
        max_players: game.max_players || '',
        recruitment_deadline: game.recruitment_deadline ? formatDateTimeLocal(game.recruitment_deadline) : '',
        start_date: game.start_date ? formatDateTimeLocal(game.start_date) : '',
        end_date: game.end_date ? formatDateTimeLocal(game.end_date) : '',
        is_anonymous: game.is_anonymous || false,
        auto_accept_audience: game.auto_accept_audience || false,
        allow_group_conversations: game.allow_group_conversations ?? true,
        portrait_avatars: game.portrait_avatars ?? false,
      });
      setError(null);
      setPendingBannerFile(null);
      setBannerPreviewUrl(null);
    }
  }, [isOpen, game]);

  const handleChange = (field: keyof GameFormData, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    if (!formData.description.trim()) {
      setError('Description is required');
      return;
    }

    try {
      setLoading(true);

      const updateData: UpdateGameRequest = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        genre: formData.genre.trim() || undefined,
        max_players: formData.max_players === '' ? undefined : Number(formData.max_players),
        recruitment_deadline: convertToISO8601(formData.recruitment_deadline) || undefined,
        start_date: convertToISO8601(formData.start_date) || undefined,
        end_date: convertToISO8601(formData.end_date) || undefined,
        is_public: true,
        is_anonymous: formData.is_anonymous,
        auto_accept_audience: formData.auto_accept_audience,
        allow_group_conversations: formData.allow_group_conversations ?? true,
        portrait_avatars: formData.portrait_avatars ?? false,
        banner_url: game.banner_url ?? null,
      };

      await apiClient.games.updateGame(game.id, updateData);
      onGameUpdated();
      onClose();
    } catch (_err) {
      setError(_err instanceof Error ? _err.message : 'Failed to update game');
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

      {/* Preview: pending selection takes priority over existing banner */}
      {(bannerPreviewUrl || game.banner_url) && (
        <div className="w-full rounded overflow-hidden" style={{ aspectRatio: '6/1' }}>
          <img
            src={bannerPreviewUrl ?? game.banner_url!}
            alt="Game banner"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Pending selection: confirm or discard before uploading */}
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
                    URL.revokeObjectURL(bannerPreviewUrl);
                    setBannerPreviewUrl(null);
                    setPendingBannerFile(null);
                    onGameUpdated();
                  },
                  onError: () => {
                    URL.revokeObjectURL(bannerPreviewUrl);
                    setBannerPreviewUrl(null);
                    setPendingBannerFile(null);
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
            onClick={() => {
              URL.revokeObjectURL(bannerPreviewUrl);
              setBannerPreviewUrl(null);
              setPendingBannerFile(null);
            }}
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
          if (file) {
            if (bannerPreviewUrl) URL.revokeObjectURL(bannerPreviewUrl);
            setBannerPreviewUrl(URL.createObjectURL(file));
            setPendingBannerFile(file);
          }
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
