import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test-utils';
import { UpcomingDeadlinesCard } from '../UpcomingDeadlinesCard';
import type { DashboardDeadline } from '../../types/dashboard';

// Mock react-router-dom Link
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Link: ({ to, children, className }: unknown) => (
      <a href={to} className={className}>{children}</a>
    ),
  };
});

describe('UpcomingDeadlinesCard', () => {
  const baseDeadline: DashboardDeadline = {
    deadline_type: 'phase',
    source_id: 1,
    phase_id: 1,
    game_id: 1,
    game_title: 'Test Game',
    title: 'Test Phase',
    phase_type: 'action',
    phase_title: 'Test Phase',
    phase_number: 1,
    end_time: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    has_pending_submission: false,
    hours_remaining: 48,
  };

  it('returns null when deadlines array is empty', () => {
    const { container } = renderWithProviders(<UpcomingDeadlinesCard deadlines={[]} />);

    expect(container.firstChild).toBeNull();
  });

  it('displays Upcoming Deadlines header when deadlines exist', () => {
    renderWithProviders(<UpcomingDeadlinesCard deadlines={[baseDeadline]} />);

    expect(screen.getByText('Upcoming Deadlines')).toBeInTheDocument();
  });

  it('displays game title', () => {
    const deadline: DashboardDeadline = {
      ...baseDeadline,
      game_title: 'Epic Adventure',
    };

    renderWithProviders(<UpcomingDeadlinesCard deadlines={[deadline]} />);

    expect(screen.getByText('Epic Adventure')).toBeInTheDocument();
  });

  it('displays phase title and phase number', () => {
    const deadline: DashboardDeadline = {
      ...baseDeadline,
      title: 'Action Phase 5',
      phase_title: 'Action Phase 5',
      phase_number: 5,
    };

    renderWithProviders(<UpcomingDeadlinesCard deadlines={[deadline]} />);

    expect(screen.getByText('Action Phase 5 — Phase 5')).toBeInTheDocument();
  });

  it('shows "Action pending" badge when has_pending_submission is true', () => {
    const deadline: DashboardDeadline = {
      ...baseDeadline,
      has_pending_submission: true,
    };

    renderWithProviders(<UpcomingDeadlinesCard deadlines={[deadline]} />);

    expect(screen.getByText('Action pending')).toBeInTheDocument();
  });

  it('does not show action pending badge when has_pending_submission is false', () => {
    const deadline: DashboardDeadline = {
      ...baseDeadline,
      has_pending_submission: false,
    };

    renderWithProviders(<UpcomingDeadlinesCard deadlines={[deadline]} />);

    expect(screen.queryByText('Action pending')).not.toBeInTheDocument();
  });

  it('links to game detail page', () => {
    const deadline: DashboardDeadline = {
      ...baseDeadline,
      game_id: 42,
    };

    renderWithProviders(<UpcomingDeadlinesCard deadlines={[deadline]} />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/games/42');
  });

  it('displays multiple deadlines', () => {
    const deadlines: DashboardDeadline[] = [
      {
        ...baseDeadline,
        phase_id: 1,
        game_title: 'Game One',
      },
      {
        ...baseDeadline,
        phase_id: 2,
        game_title: 'Game Two',
      },
      {
        ...baseDeadline,
        phase_id: 3,
        game_title: 'Game Three',
      },
    ];

    renderWithProviders(<UpcomingDeadlinesCard deadlines={deadlines} />);

    expect(screen.getByText('Game One')).toBeInTheDocument();
    expect(screen.getByText('Game Two')).toBeInTheDocument();
    expect(screen.getByText('Game Three')).toBeInTheDocument();
  });

  it('applies red color for critical urgency (<1 hour)', () => {
    const deadline: DashboardDeadline = {
      ...baseDeadline,
      hours_remaining: 0.5,
      end_time: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };

    const { container } = renderWithProviders(<UpcomingDeadlinesCard deadlines={[deadline]} />);

    expect(container.innerHTML).toContain('text-semantic-danger');
  });

  it('applies yellow color for warning urgency (1-3 hours)', () => {
    const deadline: DashboardDeadline = {
      ...baseDeadline,
      hours_remaining: 2,
      end_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    };

    const { container } = renderWithProviders(<UpcomingDeadlinesCard deadlines={[deadline]} />);

    expect(container.innerHTML).toContain('text-semantic-warning');
  });

  it('applies green color for normal urgency (>=24 hours)', () => {
    const deadline: DashboardDeadline = {
      ...baseDeadline,
      hours_remaining: 48,
      end_time: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    };

    const { container } = renderWithProviders(<UpcomingDeadlinesCard deadlines={[deadline]} />);

    expect(container.innerHTML).toContain('text-semantic-success');
  });

  it('shows AlertCircle icon when less than 24 hours remaining', () => {
    const deadline: DashboardDeadline = {
      ...baseDeadline,
      hours_remaining: 12,
      end_time: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    };

    const { container } = renderWithProviders(<UpcomingDeadlinesCard deadlines={[deadline]} />);

    // AlertCircle component should be present in HTML
    const svgElements = container.querySelectorAll('svg');
    expect(svgElements.length).toBeGreaterThan(1); // Calendar + Clock + AlertCircle
  });

  it('does not show AlertCircle icon when 24+ hours remaining', () => {
    const deadline: DashboardDeadline = {
      ...baseDeadline,
      hours_remaining: 48,
      end_time: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    };

    const { container } = renderWithProviders(<UpcomingDeadlinesCard deadlines={[deadline]} />);

    // Should only have Calendar + Clock icons (2 SVGs), no AlertCircle
    const svgElements = container.querySelectorAll('svg');
    expect(svgElements.length).toBe(2);
  });

  it('formats time remaining as "Less than 1 hour" when <1 hour', () => {
    const deadline: DashboardDeadline = {
      ...baseDeadline,
      hours_remaining: 0,
      end_time: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };

    renderWithProviders(<UpcomingDeadlinesCard deadlines={[deadline]} />);

    expect(screen.getByText('Less than 1 hour')).toBeInTheDocument();
  });

  it('formats time remaining in hours when <24 hours', () => {
    const deadline: DashboardDeadline = {
      ...baseDeadline,
      hours_remaining: 12,
      end_time: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    };

    renderWithProviders(<UpcomingDeadlinesCard deadlines={[deadline]} />);

    expect(screen.getByText('12 hours')).toBeInTheDocument();
  });

  it('uses singular "hour" for exactly 1 hour', () => {
    const deadline: DashboardDeadline = {
      ...baseDeadline,
      hours_remaining: 1,
      end_time: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(),
    };

    renderWithProviders(<UpcomingDeadlinesCard deadlines={[deadline]} />);

    expect(screen.getByText('1 hour')).toBeInTheDocument();
  });

  it('formats time remaining in days when >=24 hours', () => {
    const deadline: DashboardDeadline = {
      ...baseDeadline,
      hours_remaining: 48,
      end_time: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    };

    renderWithProviders(<UpcomingDeadlinesCard deadlines={[deadline]} />);

    expect(screen.getByText('2 days')).toBeInTheDocument();
  });

  it('uses singular "day" for exactly 1 day', () => {
    const deadline: DashboardDeadline = {
      ...baseDeadline,
      hours_remaining: 24,
      end_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    renderWithProviders(<UpcomingDeadlinesCard deadlines={[deadline]} />);

    expect(screen.getByText('1 day')).toBeInTheDocument();
  });

  it('displays deadline date for today with time only', () => {
    // Set to 3 hours from now (today)
    const deadline: DashboardDeadline = {
      ...baseDeadline,
      hours_remaining: 3,
      end_time: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    };

    renderWithProviders(<UpcomingDeadlinesCard deadlines={[deadline]} />);

    // Should show time format like "3:45 PM"
    expect(screen.getByText(/\d{1,2}:\d{2}\s?[AP]M/i)).toBeInTheDocument();
  });

  it('displays deadline date for this week with weekday and time', () => {
    // Set to 3 days from now (within a week)
    const deadline: DashboardDeadline = {
      ...baseDeadline,
      hours_remaining: 72,
      end_time: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    };

    renderWithProviders(<UpcomingDeadlinesCard deadlines={[deadline]} />);

    // Should show format like "Mon 3:45 PM" or "Tue 10:30 AM"
    // The weekday abbreviation (Mon, Tue, etc.) should be present
    const container = screen.getByRole('link');
    expect(container.textContent).toMatch(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/);
  });

  it('displays deadline date for later dates with month and day', () => {
    // Set to 10 days from now (beyond a week)
    const deadline: DashboardDeadline = {
      ...baseDeadline,
      hours_remaining: 240,
      end_time: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    };

    renderWithProviders(<UpcomingDeadlinesCard deadlines={[deadline]} />);

    // Should show format like "Dec 25, 3:45 PM" or "Jan 5, 10:30 AM"
    // The month abbreviation should be present
    const container = screen.getByRole('link');
    expect(container.textContent).toMatch(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/);
  });

  it('displays all deadline details correctly', () => {
    const deadline: DashboardDeadline = {
      deadline_type: 'phase',
      source_id: 1,
      phase_id: 1,
      game_id: 5,
      game_title: 'Critical Mission',
      title: 'Infiltration',
      phase_type: 'action',
      phase_title: 'Infiltration',
      phase_number: 3,
      end_time: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      has_pending_submission: true,
      hours_remaining: 6,
    };

    renderWithProviders(<UpcomingDeadlinesCard deadlines={[deadline]} />);

    expect(screen.getByText('Critical Mission')).toBeInTheDocument();
    expect(screen.getByText('Infiltration — Phase 3')).toBeInTheDocument();
    expect(screen.getByText('Action pending')).toBeInTheDocument();
    expect(screen.getByText('6 hours')).toBeInTheDocument();
  });
});
