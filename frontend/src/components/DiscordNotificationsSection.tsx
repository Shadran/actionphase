import { useQueryClient } from '@tanstack/react-query';
import { Button, Card, CardBody, CardHeader, Spinner, Alert } from '@/components/ui';
import { useDiscordStatus } from '../hooks/useDiscordStatus';
import { useUserPreferences, useUpdateUserPreferences } from '../hooks/useUserPreferences';
import { apiClient } from '../lib/api';
import type { NotificationTypePref } from '../lib/api/auth';

// ─────────────────────────────────────────────────────────────────────────────
// Notification type metadata
// ─────────────────────────────────────────────────────────────────────────────

interface NotificationTypeInfo {
  key: NotificationTypePref;
  label: string;
  description: string;
  defaultOn: boolean;
}

const DIRECT_EVENTS: NotificationTypeInfo[] = [
  {
    key: 'private_message',
    label: 'Private Messages',
    description: 'When another character sends you a private message',
    defaultOn: true,
  },
  {
    key: 'action_result',
    label: 'Action Results',
    description: 'When the GM publishes a result for your action',
    defaultOn: true,
  },
  {
    key: 'character_approved',
    label: 'Character Approved',
    description: 'When the GM approves your character',
    defaultOn: true,
  },
  {
    key: 'application_approved',
    label: 'Application Approved',
    description: 'When your game application is approved',
    defaultOn: true,
  },
  {
    key: 'handout_published',
    label: 'New Handout',
    description: 'When the GM publishes a new handout',
    defaultOn: true,
  },
  {
    key: 'common_room_post',
    label: 'Common Room Posts',
    description: 'When the GM posts in the common room (typically signals the start of a new phase)',
    defaultOn: true,
  },
];

const GAME_ACTIVITY: NotificationTypeInfo[] = [
  {
    key: 'comment_reply',
    label: 'Comment Replies',
    description: 'When someone replies to your comment',
    defaultOn: false,
  },
  {
    key: 'character_mention',
    label: 'Character Mentions',
    description: 'When your character is @mentioned in a post or comment',
    defaultOn: false,
  },
  {
    key: 'action_submitted',
    label: 'Action Submitted (GM)',
    description: 'When a player submits an action (for GMs)',
    defaultOn: false,
  },
  {
    key: 'phase_created',
    label: 'Phase Changes',
    description: 'When a new game phase begins',
    defaultOn: false,
  },
  {
    key: 'game_state_changed',
    label: 'Game State Changes',
    description: 'When the game is paused, resumed, or ends',
    defaultOn: false,
  },
  {
    key: 'application_submitted',
    label: 'Application Submitted (GM)',
    description: 'When a player applies to your game (for GMs)',
    defaultOn: false,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Toggle row
// ─────────────────────────────────────────────────────────────────────────────

interface ToggleRowProps {
  info: NotificationTypeInfo;
  enabled: boolean;
  onChange: (key: NotificationTypePref, enabled: boolean) => void;
}

function ToggleRow({ info, enabled, onChange }: ToggleRowProps) {
  return (
    <div
      className="flex items-center justify-between py-3 border-b border-border-primary last:border-0"
      data-testid={`discord-toggle-${info.key}`}
    >
      <div className="flex-1 min-w-0 mr-4">
        <div className="text-sm font-medium text-text-primary">{info.label}</div>
        <div className="text-xs text-text-secondary mt-0.5">{info.description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={`Toggle ${info.label} Discord notifications`}
        onClick={() => onChange(info.key, !enabled)}
        className={[
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-interactive-primary focus:ring-offset-2 shrink-0',
          enabled ? 'bg-interactive-primary' : 'bg-bg-secondary',
        ].join(' ')}
      >
        <span
          className={[
            'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
            enabled ? 'translate-x-6' : 'translate-x-1',
          ].join(' ')}
        />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main section
// ─────────────────────────────────────────────────────────────────────────────

export function DiscordNotificationsSection() {
  const queryClient = useQueryClient();
  const { data: discordStatus, isLoading: statusLoading, error: statusError } = useDiscordStatus();
  const { data: preferences, isLoading: prefsLoading } = useUserPreferences();
  const updatePreferences = useUpdateUserPreferences();

  const handleConnect = async () => {
    try {
      const response = await apiClient.auth.getDiscordConnectURL();
      window.location.href = response.data.url;
    } catch {
      // silently ignore; user will see no redirect
    }
  };

  const handleDisconnect = async () => {
    try {
      await apiClient.auth.disconnectDiscord();
      queryClient.invalidateQueries({ queryKey: ['discordStatus'] });
    } catch {
      // silently ignore; query state will remain unchanged
    }
  };

  const handleToggle = (key: NotificationTypePref, enabled: boolean) => {
    const current = preferences?.discord_notifications ?? {};
    updatePreferences.mutate({
      theme: preferences?.theme ?? 'auto',
      comment_read_mode: preferences?.comment_read_mode ?? 'auto',
      discord_notifications: {
        ...current,
        [key]: enabled,
      },
    });
  };

  const isEnabled = (info: NotificationTypeInfo): boolean => {
    const prefs = preferences?.discord_notifications;
    if (prefs && info.key in prefs) {
      return prefs[info.key] ?? info.defaultOn;
    }
    return info.defaultOn;
  };

  if (statusLoading || prefsLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (statusError) {
    return (
      <Alert variant="danger" title="Failed to load Discord status">
        Please refresh the page and try again.
      </Alert>
    );
  }

  // ── Not linked ────────────────────────────────────────────────────────────

  if (!discordStatus?.linked) {
    return (
      <Card variant="default" padding="md">
        <CardHeader>
          <h3 className="text-lg font-semibold text-text-heading">Discord Notifications</h3>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Connect your Discord account to receive ActionPhase notifications as direct messages.
              You can control which notification types are delivered to Discord.
            </p>
            <Button
              variant="primary"
              onClick={handleConnect}
              data-testid="discord-connect-button"
            >
              Connect Discord
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  // ── Linked ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <Card variant="default" padding="md">
        <CardHeader>
          <h3 className="text-lg font-semibold text-text-heading">Discord Account</h3>
        </CardHeader>
        <CardBody>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">
                Connected as{' '}
                <span className="font-semibold" data-testid="discord-username">
                  {discordStatus.discord_username}
                </span>
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                Discord DMs are enabled based on your preferences below.
              </p>
            </div>
            <Button
              variant="danger"
              onClick={handleDisconnect}
              data-testid="discord-disconnect-button"
            >
              Disconnect
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card variant="default" padding="md">
        <CardHeader>
          <h3 className="text-lg font-semibold text-text-heading">Direct Events</h3>
          <p className="text-sm text-text-secondary mt-1">
            High-priority events that affect you directly. These default to on.
          </p>
        </CardHeader>
        <CardBody>
          {DIRECT_EVENTS.map((info) => (
            <ToggleRow
              key={info.key}
              info={info}
              enabled={isEnabled(info)}
              onChange={handleToggle}
            />
          ))}
        </CardBody>
      </Card>

      <Card variant="default" padding="md">
        <CardHeader>
          <h3 className="text-lg font-semibold text-text-heading">Game Activity</h3>
          <p className="text-sm text-text-secondary mt-1">
            Game-wide events. These default to off to avoid notification overload.
          </p>
        </CardHeader>
        <CardBody>
          {GAME_ACTIVITY.map((info) => (
            <ToggleRow
              key={info.key}
              info={info}
              enabled={isEnabled(info)}
              onChange={handleToggle}
            />
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
