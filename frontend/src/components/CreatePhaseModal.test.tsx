import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../test-utils/render';
import { CreatePhaseModal } from './CreatePhaseModal';
import * as timezoneUtils from '../utils/timezone';

// Mock the timezone utilities to verify they're called correctly
vi.mock('../utils/timezone', async () => {
  const actual = await vi.importActual<typeof import('../utils/timezone')>('../utils/timezone');
  return {
    ...actual,
    localDateTimeToUTC: vi.fn(actual.localDateTimeToUTC),
  };
});

describe('CreatePhaseModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnSubmit.mockClear();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-11-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('renders the modal with all form fields', () => {
      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      expect(screen.getByText('Create New Phase')).toBeInTheDocument();
      expect(screen.getByLabelText(/Phase Type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Title/i)).toBeInTheDocument();
      expect(screen.getByTestId('phase-description')).toBeInTheDocument();
      expect(screen.getByLabelText(/Deadline/i)).toBeInTheDocument();
    });

    it('shows phase type options', () => {
      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      const phaseTypeSelect = screen.getByLabelText(/Phase Type/i);
      expect(phaseTypeSelect).toHaveValue('common_room');

      // Check that both options exist
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(2);
      expect(screen.getByRole('option', { name: 'Common Room' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Action Phase' })).toBeInTheDocument();
    });

    it('displays helper text for phase type', () => {
      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      // Check for the actual helper text from PHASE_TYPE_DESCRIPTIONS
      expect(screen.getByText(/Open discussion and roleplay between characters/i)).toBeInTheDocument();
    });

    it('displays submit and cancel buttons', () => {
      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      expect(screen.getByRole('button', { name: /Create Phase/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    });
  });

  describe('Form State', () => {
    it('disables submit button when isSubmitting is true', () => {
      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={true}
        />
      );

      const submitButton = screen.getByRole('button', { name: /Creating.../i });
      expect(submitButton).toBeDisabled();
    });

    it('shows "Creating..." text when submitting', () => {
      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={true}
        />
      );

      expect(screen.getByText('Creating...')).toBeInTheDocument();
    });

    it('shows "Create Phase" text when not submitting', () => {
      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      expect(screen.getByText('Create Phase')).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('calls onSubmit when form is submitted', () => {
      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      const form = screen.getByRole('button', { name: /Create Phase/i }).closest('form');
      expect(form).toBeTruthy();

      fireEvent.submit(form!);

      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    it('calls onSubmit with correct phase_type', () => {
      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      const phaseTypeSelect = screen.getByLabelText(/Phase Type/i);
      fireEvent.change(phaseTypeSelect, { target: { value: 'action' } });

      const form = screen.getByRole('button', { name: /Create Phase/i }).closest('form');
      fireEvent.submit(form!);

      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          phase_type: 'action',
        })
      );
    });

    it('includes title in submission when provided', () => {
      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      const titleInput = screen.getByLabelText(/Title/i);
      fireEvent.change(titleInput, { target: { value: 'Test Phase Title' } });

      const form = screen.getByRole('button', { name: /Create Phase/i }).closest('form');
      fireEvent.submit(form!);

      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Phase Title',
        })
      );
    });

    it('includes description in submission when provided', () => {
      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      const descriptionTextarea = screen.getByTestId('phase-description');
      fireEvent.change(descriptionTextarea, { target: { value: 'Test description' } });

      const form = screen.getByRole('button', { name: /Create Phase/i }).closest('form');
      fireEvent.submit(form!);

      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Test description',
        })
      );
    });

    it('submits undefined for title when empty', () => {
      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      const form = screen.getByRole('button', { name: /Create Phase/i }).closest('form');
      fireEvent.submit(form!);

      const submitData = mockOnSubmit.mock.calls[0][0];
      expect(submitData.title).toBeUndefined();
    });

    it('submits undefined for description when empty', () => {
      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      const form = screen.getByRole('button', { name: /Create Phase/i }).closest('form');
      fireEvent.submit(form!);

      const submitData = mockOnSubmit.mock.calls[0][0];
      expect(submitData.description).toBeUndefined();
    });
  });

  describe('Timezone Conversion Integration', () => {
    it('submits undefined for deadline when not provided', () => {
      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      const form = screen.getByRole('button', { name: /Create Phase/i }).closest('form');
      fireEvent.submit(form!);

      const submitData = mockOnSubmit.mock.calls[0][0];
      expect(submitData.deadline).toBeUndefined();
    });

    it('does not call localDateTimeToUTC when deadline is empty', () => {
      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      const form = screen.getByRole('button', { name: /Create Phase/i }).closest('form');
      fireEvent.submit(form!);

      // localDateTimeToUTC should not be called with empty string
      expect(vi.mocked(timezoneUtils.localDateTimeToUTC)).not.toHaveBeenCalled();
    });

    it('submits undefined for start_time when not provided', () => {
      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      const form = screen.getByRole('button', { name: /Create Phase/i }).closest('form');
      fireEvent.submit(form!);

      const submitData = mockOnSubmit.mock.calls[0][0];
      expect(submitData.start_time).toBeUndefined();
    });

    it('does not call localDateTimeToUTC when start_time is empty', () => {
      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      const form = screen.getByRole('button', { name: /Create Phase/i }).closest('form');
      fireEvent.submit(form!);

      // localDateTimeToUTC should not be called for empty start_time
      expect(vi.mocked(timezoneUtils.localDateTimeToUTC)).not.toHaveBeenCalled();
    });

    // Note: Testing DateTimeInput interactions with timezone conversion is done at the E2E level
    // The DateTimeInput component uses react-datepicker which requires complex interactions
    // Unit tests verify the timezone utility functions work correctly (see timezone.test.ts)
  });

  describe('Cancel Action', () => {
    it('calls onClose when Cancel button is clicked', () => {
      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onSubmit when Cancel is clicked', () => {
      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      fireEvent.click(cancelButton);

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Validation', () => {
    it('requires phase_type to be set', () => {
      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      const phaseTypeSelect = screen.getByLabelText(/Phase Type/i);
      expect(phaseTypeSelect).toBeRequired();
    });

    it('does not require title field', () => {
      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      const titleInput = screen.getByLabelText(/Title/i);
      expect(titleInput).not.toBeRequired();
    });

    it('does not require description field', () => {
      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      const descriptionTextarea = screen.getByTestId('phase-description');
      expect(descriptionTextarea).not.toBeRequired();
    });

    it('does not require deadline field', () => {
      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      const deadlineInput = screen.getByLabelText(/Deadline/i);
      expect(deadlineInput).not.toBeRequired();
    });
  });

  describe('Phase Type Selection', () => {
    it('updates helper text when phase type changes to action', () => {
      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      const phaseTypeSelect = screen.getByLabelText(/Phase Type/i);
      fireEvent.change(phaseTypeSelect, { target: { value: 'action' } });

      // Check for action phase description
      expect(screen.getByText(/Submit private actions to the GM/i)).toBeInTheDocument();
    });

    it('starts with common_room as default phase type', () => {
      renderWithProviders(
        <CreatePhaseModal
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          isSubmitting={false}
        />
      );

      const phaseTypeSelect = screen.getByLabelText(/Phase Type/i) as HTMLSelectElement;
      expect(phaseTypeSelect.value).toBe('common_room');
    });
  });
});
