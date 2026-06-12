import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGameForm } from './useGameForm';

vi.mock('./useGameBanner', () => ({
  useUploadGameBanner: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  useDeleteGameBanner: () => ({ mutate: vi.fn(), isPending: false }),
}));

describe('useGameForm — buildApiPayload', () => {
  it('returns error when title is empty', () => {
    const { result } = renderHook(() => useGameForm());
    const { payload, error } = result.current.buildApiPayload();
    expect(payload).toBeNull();
    expect(error).toMatch(/title/i);
  });

  it('returns error when description is empty', () => {
    const { result } = renderHook(() => useGameForm());
    act(() => result.current.handleChange('title', 'My Game'));
    const { payload, error } = result.current.buildApiPayload();
    expect(payload).toBeNull();
    expect(error).toMatch(/description/i);
  });

  it('returns a payload when title and description are set and no schedule', () => {
    const { result } = renderHook(() => useGameForm());
    act(() => {
      result.current.handleChange('title', 'My Game');
      result.current.handleChange('description', 'A description');
    });
    const { payload, error } = result.current.buildApiPayload();
    expect(error).toBeNull();
    expect(payload).not.toBeNull();
    expect(payload!.common_room_open_day).toBeNull();
    expect(payload!.common_room_close_day).toBeNull();
    expect(payload!.schedule_timezone).toBeNull();
  });

  it('treats Sunday (day 0) as a filled schedule field, not absent', () => {
    const { result } = renderHook(() => useGameForm());
    act(() => {
      result.current.handleChange('title', 'My Game');
      result.current.handleChange('description', 'A description');
      result.current.handleChange('common_room_open_day', 0); // Sunday
      result.current.handleChange('common_room_open_time', '10:00');
      // close fields intentionally omitted — should trigger partial error
    });
    const { payload, error } = result.current.buildApiPayload();
    expect(payload).toBeNull();
    expect(error).toMatch(/all schedule fields/i);
  });

  it('returns error for partial schedule (some but not all 4 fields)', () => {
    const { result } = renderHook(() => useGameForm());
    act(() => {
      result.current.handleChange('title', 'My Game');
      result.current.handleChange('description', 'A description');
      result.current.handleChange('common_room_open_day', 6);
      result.current.handleChange('common_room_open_time', '10:00');
      result.current.handleChange('common_room_close_day', 0);
      // close_time intentionally omitted
    });
    const { payload, error } = result.current.buildApiPayload();
    expect(payload).toBeNull();
    expect(error).toMatch(/all schedule fields/i);
  });

  it('builds a full schedule payload when all 4 fields are set', () => {
    const { result } = renderHook(() => useGameForm());
    act(() => {
      result.current.handleChange('title', 'My Game');
      result.current.handleChange('description', 'A description');
      result.current.handleChange('common_room_open_day', 6);
      result.current.handleChange('common_room_open_time', '10:00');
      result.current.handleChange('common_room_close_day', 0);
      result.current.handleChange('common_room_close_time', '22:00');
    });
    const { payload, error } = result.current.buildApiPayload();
    expect(error).toBeNull();
    expect(payload).not.toBeNull();
    expect(payload!.common_room_open_day).toBe(6);
    expect(payload!.common_room_open_time).toBe('10:00');
    expect(payload!.common_room_close_day).toBe(0);
    expect(payload!.common_room_close_time).toBe('22:00');
    expect(payload!.schedule_timezone).toBeTruthy();
  });

  it('sends all nulls when schedule fields are left blank', () => {
    const { result } = renderHook(() => useGameForm());
    act(() => {
      result.current.handleChange('title', 'My Game');
      result.current.handleChange('description', 'A description');
    });
    const { payload } = result.current.buildApiPayload();
    expect(payload!.common_room_open_day).toBeNull();
    expect(payload!.common_room_open_time).toBeNull();
    expect(payload!.common_room_close_day).toBeNull();
    expect(payload!.common_room_close_time).toBeNull();
    expect(payload!.schedule_timezone).toBeNull();
  });
});
