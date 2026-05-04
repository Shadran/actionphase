import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../test-utils/render';
import { EditPhaseModal } from './EditPhaseModal';
import * as timezoneUtils from '../utils/timezone';
import type { GamePhase } from '../types/phases';

vi.mock('../utils/timezone', async () => {
  const actual = await vi.importActual<typeof import('../utils/timezone')>('../utils/timezone');
  return {
    ...actual,
    utcToLocalDateTime: vi.fn(actual.utcToLocalDateTime),
  };
});

const basePhase: GamePhase = {
  id: 1,
  game_id: 100,
  phase_type: 'common_room',
  phase_number: 1,
  title: 'Original Title',
  description: 'Original description',
  is_active: false,
  is_published: false,
  start_time: undefined,
  created_at: '2025-01-01T00:00:00Z',
};

describe('EditPhaseModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnSubmit.mockClear();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('renders the modal with all form fields', () => {
      renderWithProviders(
        <EditPhaseModal
          phase={basePhase}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      expect(screen.getByText('Edit Phase')).toBeInTheDocument();
      expect(screen.getByLabelText(/Title/i)).toBeInTheDocument();
      expect(screen.getByTestId('phase-description')).toBeInTheDocument();
      expect(screen.getByLabelText(/Auto-activate at/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Deadline/i)).toBeInTheDocument();
    });

    it('shows the phase type and number as read-only', () => {
      renderWithProviders(
        <EditPhaseModal
          phase={basePhase}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      expect(screen.getByText(/Common Room.*Phase 1/i)).toBeInTheDocument();
    });

    it('pre-populates title and description from existing phase', () => {
      renderWithProviders(
        <EditPhaseModal
          phase={basePhase}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      expect(screen.getByLabelText(/Title/i)).toHaveValue('Original Title');
      expect(screen.getByTestId('phase-description')).toHaveValue('Original description');
    });

    it('pre-populates start_time field when phase has a start_time', () => {
      const phaseWithStartTime: GamePhase = {
        ...basePhase,
        start_time: '2025-06-20T18:00:00Z',
      };

      renderWithProviders(
        <EditPhaseModal
          phase={phaseWithStartTime}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      // utcToLocalDateTime should have been called to convert the stored UTC value
      expect(timezoneUtils.utcToLocalDateTime).toHaveBeenCalledWith('2025-06-20T18:00:00Z');
      // The field should have a non-empty value
      const startTimeInput = screen.getByLabelText(/Auto-activate at/i);
      expect(startTimeInput).toHaveValue();
    });

    it('renders empty start_time field when phase has no start_time', () => {
      renderWithProviders(
        <EditPhaseModal
          phase={{ ...basePhase, start_time: undefined }}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      const startTimeInput = screen.getByLabelText(/Auto-activate at/i);
      expect(startTimeInput).toHaveValue('');
    });

    it('shows Save Changes and Cancel buttons', () => {
      renderWithProviders(
        <EditPhaseModal
          phase={basePhase}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      expect(screen.getByRole('button', { name: /Save Changes/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    });

    it('shows "Saving..." and disables button when isSubmitting', () => {
      renderWithProviders(
        <EditPhaseModal
          phase={basePhase}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={true}
        />
      );

      const submitButton = screen.getByRole('button', { name: /Saving.../i });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Form Submission', () => {
    it('submits title and description when filled', () => {
      renderWithProviders(
        <EditPhaseModal
          phase={basePhase}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'New Title' } });
      fireEvent.change(screen.getByTestId('phase-description'), { target: { value: 'New description' } });
      fireEvent.submit(screen.getByRole('button', { name: /Save Changes/i }).closest('form')!);

      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Title',
          description: 'New description',
        })
      );
    });

    it('submits undefined for title when field is cleared', () => {
      renderWithProviders(
        <EditPhaseModal
          phase={basePhase}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: '' } });
      fireEvent.submit(screen.getByRole('button', { name: /Save Changes/i }).closest('form')!);

      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ title: undefined })
      );
    });

    it('submits start_time as a UTC ISO string when pre-populated from phase', () => {
      // DateTimeInput uses react-datepicker which requires complex interactions in tests,
      // so we verify the round-trip via a phase that already has start_time set.
      const phaseWithStart: GamePhase = {
        ...basePhase,
        start_time: '2025-06-20T18:00:00Z',
      };

      renderWithProviders(
        <EditPhaseModal
          phase={phaseWithStart}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      // utcToLocalDateTime converts on load; localDateTimeToUTC converts back on submit
      fireEvent.submit(screen.getByRole('button', { name: /Save Changes/i }).closest('form')!);

      const submitted = mockOnSubmit.mock.calls[0][0];
      expect(submitted.start_time).toBeDefined();
      expect(submitted.start_time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('submits undefined for start_time when field is empty', () => {
      renderWithProviders(
        <EditPhaseModal
          phase={basePhase}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      // start_time is already empty on basePhase; just submit
      fireEvent.submit(screen.getByRole('button', { name: /Save Changes/i }).closest('form')!);

      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ start_time: undefined })
      );
    });

    it('submits undefined for start_time when an existing value is cleared', () => {
      const phaseWithStartTime: GamePhase = {
        ...basePhase,
        start_time: '2025-06-20T18:00:00Z',
      };

      renderWithProviders(
        <EditPhaseModal
          phase={phaseWithStartTime}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      // Clear the start_time field
      fireEvent.change(screen.getByLabelText(/Auto-activate at/i), { target: { value: '' } });
      fireEvent.submit(screen.getByRole('button', { name: /Save Changes/i }).closest('form')!);

      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ start_time: undefined })
      );
    });
  });

  describe('Cancel action', () => {
    it('calls onClose when Cancel button is clicked', () => {
      renderWithProviders(
        <EditPhaseModal
          phase={basePhase}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });
});
