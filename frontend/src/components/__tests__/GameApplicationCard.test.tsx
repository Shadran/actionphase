import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test-utils/render';
import { GameApplicationCard } from '../GameApplicationCard';
import type { GameApplication } from '../../types/games';

const baseApplication: GameApplication = {
  id: 1,
  game_id: 10,
  user_id: 42,
  username: 'alice',
  avatar_url: undefined,
  role: 'player',
  status: 'pending',
  message: 'I would love to join!',
  applied_at: '2024-01-15T10:00:00Z',
  reviewed_at: undefined,
};

describe('GameApplicationCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders applicant username and role', () => {
    renderWithProviders(<GameApplicationCard application={baseApplication} />);
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText(/player/i)).toBeInTheDocument();
  });

  it('renders application message when present', () => {
    renderWithProviders(<GameApplicationCard application={baseApplication} />);
    expect(screen.getByText(/"I would love to join!"/)).toBeInTheDocument();
  });

  it('does not render message section when message is absent', () => {
    const noMsg = { ...baseApplication, message: '' };
    renderWithProviders(<GameApplicationCard application={noMsg} />);
    expect(screen.queryByText(/application message/i)).not.toBeInTheDocument();
  });

  it('shows status badge', () => {
    renderWithProviders(<GameApplicationCard application={baseApplication} />);
    expect(screen.getByTestId('application-status-badge')).toHaveTextContent('Pending Review');
  });

  it('shows approved status badge', () => {
    renderWithProviders(<GameApplicationCard application={{ ...baseApplication, status: 'approved' }} />);
    expect(screen.getByTestId('application-status-badge')).toHaveTextContent('Approved');
  });

  it('does not show GM action buttons when isGM is false', () => {
    renderWithProviders(
      <GameApplicationCard application={baseApplication} isGM={false} gameState="recruitment" />
    );
    expect(screen.queryByTestId('approve-application-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reject-application-button')).not.toBeInTheDocument();
  });

  it('does not show action buttons when gameState is not recruitment', () => {
    renderWithProviders(
      <GameApplicationCard application={baseApplication} isGM gameState="in_progress" />
    );
    expect(screen.queryByTestId('approve-application-button')).not.toBeInTheDocument();
  });

  it('shows Approve and Reject buttons for GM with pending application in recruitment', () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    renderWithProviders(
      <GameApplicationCard
        application={baseApplication}
        isGM
        gameState="recruitment"
        onApprove={onApprove}
        onReject={onReject}
      />
    );
    expect(screen.getByTestId('approve-application-button')).toBeInTheDocument();
    expect(screen.getByTestId('reject-application-button')).toBeInTheDocument();
  });

  it('calls onApprove when Approve is clicked', async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn().mockResolvedValue(undefined);
    const onReject = vi.fn();
    renderWithProviders(
      <GameApplicationCard
        application={baseApplication}
        isGM
        gameState="recruitment"
        onApprove={onApprove}
        onReject={onReject}
      />
    );
    await user.click(screen.getByTestId('approve-application-button'));
    expect(onApprove).toHaveBeenCalledWith(1);
  });

  it('shows confirm modal before rejecting', async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    const onReject = vi.fn();
    renderWithProviders(
      <GameApplicationCard
        application={baseApplication}
        isGM
        gameState="recruitment"
        onApprove={onApprove}
        onReject={onReject}
      />
    );
    await user.click(screen.getByTestId('reject-application-button'));
    expect(screen.getByText('Reject Application')).toBeInTheDocument();
    expect(screen.getByText(/are you sure you want to reject alice/i)).toBeInTheDocument();
  });

  it('calls onReject after confirming rejection', async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    const onReject = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <GameApplicationCard
        application={baseApplication}
        isGM
        gameState="recruitment"
        onApprove={onApprove}
        onReject={onReject}
      />
    );
    await user.click(screen.getByTestId('reject-application-button'));
    // Confirm button inside the modal (distinct from the card's reject trigger)
    const confirmButtons = screen.getAllByRole('button', { name: /^reject$/i });
    await user.click(confirmButtons[confirmButtons.length - 1]);
    expect(onReject).toHaveBeenCalledWith(1);
  });

  it('shows only Reject button for approved application (can revoke)', () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    renderWithProviders(
      <GameApplicationCard
        application={{ ...baseApplication, status: 'approved' }}
        isGM
        gameState="recruitment"
        onApprove={onApprove}
        onReject={onReject}
      />
    );
    expect(screen.getByTestId('reject-application-button')).toBeInTheDocument();
    expect(screen.queryByTestId('approve-application-button')).not.toBeInTheDocument();
  });

  it('shows only Approve button for rejected application (can reinstate)', () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    renderWithProviders(
      <GameApplicationCard
        application={{ ...baseApplication, status: 'rejected' }}
        isGM
        gameState="recruitment"
        onApprove={onApprove}
        onReject={onReject}
      />
    );
    expect(screen.getByTestId('approve-application-button')).toBeInTheDocument();
    expect(screen.queryByTestId('reject-application-button')).not.toBeInTheDocument();
  });

  it('renders initials avatar when no avatar_url', () => {
    renderWithProviders(<GameApplicationCard application={baseApplication} />);
    // Single-word username produces first character only
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('renders img when avatar_url is provided', () => {
    const withAvatar = { ...baseApplication, avatar_url: 'https://example.com/avatar.png' };
    renderWithProviders(<GameApplicationCard application={withAvatar} />);
    expect(screen.getByRole('img', { name: /alice's avatar/i })).toBeInTheDocument();
  });
});
