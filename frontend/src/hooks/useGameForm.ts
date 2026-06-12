import { useState, useCallback } from 'react';
import type { GameWithDetails, CreateGameRequest } from '../types/games';
import type { GameFormData } from '../components/GameFormFields';
import { convertToISO8601, formatDateTimeLocal } from '../lib/utils/dates';
import { useUploadGameBanner, useDeleteGameBanner } from './useGameBanner';

const BLANK_FORM_DATA: GameFormData = {
  title: '',
  description: '',
  genre: '',
  max_players: 6,
  recruitment_deadline: '',
  start_date: '',
  end_date: '',
  is_anonymous: false,
  auto_accept_audience: false,
  allow_group_conversations: true,
  portrait_avatars: true,
  common_room_open_day: '',
  common_room_open_time: '',
  common_room_close_day: '',
  common_room_close_time: '',
};

export function gameToFormData(game: GameWithDetails): GameFormData {
  return {
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
    common_room_open_day: game.common_room_open_day ?? '',
    common_room_open_time: game.common_room_open_time ? game.common_room_open_time.slice(0, 5) : '',
    common_room_close_day: game.common_room_close_day ?? '',
    common_room_close_time: game.common_room_close_time ? game.common_room_close_time.slice(0, 5) : '',
  };
}

export interface BuildPayloadResult {
  payload: CreateGameRequest | null;
  error: string | null;
}

export interface UploadPendingBannerCallbacks {
  onSuccess?: () => void;
  onError?: () => void;
}

export function useGameForm(initialData?: GameWithDetails) {
  const [formData, setFormData] = useState<GameFormData>(() =>
    initialData ? gameToFormData(initialData) : { ...BLANK_FORM_DATA }
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingBannerFile, setPendingBannerFile] = useState<File | null>(null);
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(null);

  const uploadBanner = useUploadGameBanner();
  const deleteBanner = useDeleteGameBanner();

  const handleChange = useCallback(
    (field: keyof GameFormData, value: string | number | boolean) => {
      setFormData(prev => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleBannerFileSelect = useCallback((file: File) => {
    setBannerPreviewUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setPendingBannerFile(file);
  }, []);

  const discardPendingBanner = useCallback(() => {
    setBannerPreviewUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPendingBannerFile(null);
  }, []);

  const uploadPendingBanner = useCallback(
    (gameId: number, callbacks: UploadPendingBannerCallbacks) => {
      if (!pendingBannerFile) {
        callbacks.onSuccess?.();
        return;
      }
      uploadBanner.mutate(
        { gameId, file: pendingBannerFile },
        {
          onSuccess: () => {
            setBannerPreviewUrl(prev => {
              if (prev) URL.revokeObjectURL(prev);
              return null;
            });
            setPendingBannerFile(null);
            callbacks.onSuccess?.();
          },
          onError: () => {
            setBannerPreviewUrl(prev => {
              if (prev) URL.revokeObjectURL(prev);
              return null;
            });
            setPendingBannerFile(null);
            callbacks.onError?.();
          },
        }
      );
    },
    [pendingBannerFile, uploadBanner]
  );

  const buildApiPayload = useCallback((): BuildPayloadResult => {
    if (!formData.title.trim()) {
      return { payload: null, error: 'Game title is required' };
    }
    if (!formData.description.trim()) {
      return { payload: null, error: 'Game description is required' };
    }

    const scheduleFieldsFilled = [
      formData.common_room_open_day,
      formData.common_room_open_time,
      formData.common_room_close_day,
      formData.common_room_close_time,
    ].filter(v => v !== '').length;

    if (scheduleFieldsFilled > 0 && scheduleFieldsFilled < 4) {
      return {
        payload: null,
        error:
          'Please fill in all schedule fields (open day, open time, close day, and close time) or leave them all blank.',
      };
    }

    const hasSchedule = scheduleFieldsFilled === 4;

    const payload: CreateGameRequest = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      genre: formData.genre.trim() || undefined,
      max_players: formData.max_players === '' ? undefined : Number(formData.max_players),
      start_date: convertToISO8601(formData.start_date) || undefined,
      end_date: convertToISO8601(formData.end_date) || undefined,
      recruitment_deadline: convertToISO8601(formData.recruitment_deadline) || undefined,
      is_anonymous: formData.is_anonymous,
      auto_accept_audience: formData.auto_accept_audience,
      allow_group_conversations: formData.allow_group_conversations ?? true,
      portrait_avatars: formData.portrait_avatars ?? false,
      common_room_open_day: hasSchedule ? Number(formData.common_room_open_day) : null,
      common_room_open_time: hasSchedule ? formData.common_room_open_time : null,
      common_room_close_day: hasSchedule ? Number(formData.common_room_close_day) : null,
      common_room_close_time: hasSchedule ? formData.common_room_close_time : null,
      schedule_timezone: hasSchedule ? Intl.DateTimeFormat().resolvedOptions().timeZone : null,
    } as CreateGameRequest;

    return { payload, error: null };
  }, [formData]);

  return {
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
    uploadPendingBanner,
    uploadBanner,
    deleteBanner,
    buildApiPayload,
  };
}
