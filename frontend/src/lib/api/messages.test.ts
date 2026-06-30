import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/LoggingService', () => ({
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  setCorrelationId: vi.fn(),
  getFaro: vi.fn(),
}));

vi.mock('@opentelemetry/api', () => ({
  context: { with: vi.fn((ctx, fn) => fn()), active: vi.fn(() => ({})) },
  trace: { getTracer: vi.fn(() => ({ startActiveSpan: vi.fn((name, fn) => fn({ end: vi.fn(), setStatus: vi.fn(), recordException: vi.fn() })) })) },
  propagation: { inject: vi.fn() },
  SpanStatusCode: { OK: 'OK', ERROR: 'ERROR' },
}));

vi.mock('@/lib/faro', () => ({ getFaro: vi.fn(() => null) }));

import { MessagesApi } from './messages';

describe('MessagesApi.getRecentComments', () => {
  let api: MessagesApi;
  let mockGet: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    api = new MessagesApi();
    mockGet = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).client = { get: mockGet };
  });

  it('flattens parent_character_avatar_url from nested parent object', async () => {
    mockGet.mockResolvedValue({
      data: {
        comments: [
          {
            id: 1,
            game_id: 42,
            parent_id: 5,
            post_id: 10,
            author_id: 2,
            character_id: 3,
            content: 'Reply text',
            created_at: '2026-06-01T12:00:00Z',
            edited_at: null,
            edit_count: 0,
            deleted_at: null,
            is_deleted: false,
            author_username: 'player1',
            character_name: 'Aragorn',
            character_avatar_url: 'http://example.com/aragorn.png',
            parent: {
              content: 'Original post',
              created_at: '2026-06-01T11:00:00Z',
              deleted_at: null,
              is_deleted: false,
              message_type: 'post',
              author_username: 'gm1',
              character_name: 'Gandalf',
              character_avatar_url: 'http://example.com/gandalf.png',
            },
          },
        ],
        total: 1,
      },
    });

    const result = await api.getRecentComments(42);
    const comment = result.data.comments[0];

    expect(comment.parent_character_avatar_url).toBe('http://example.com/gandalf.png');
  });

  it('sets parent_character_avatar_url to undefined when parent has no avatar', async () => {
    mockGet.mockResolvedValue({
      data: {
        comments: [
          {
            id: 2,
            game_id: 42,
            parent_id: 6,
            post_id: 11,
            author_id: 2,
            character_id: 3,
            content: 'Reply',
            created_at: '2026-06-01T12:00:00Z',
            edited_at: null,
            edit_count: 0,
            deleted_at: null,
            is_deleted: false,
            author_username: 'player1',
            character_name: 'Aragorn',
            character_avatar_url: null,
            parent: {
              content: 'Post without avatar',
              created_at: '2026-06-01T11:00:00Z',
              deleted_at: null,
              is_deleted: false,
              message_type: 'post',
              author_username: 'gm1',
              character_name: 'Frodo',
              character_avatar_url: null,
            },
          },
        ],
        total: 1,
      },
    });

    const result = await api.getRecentComments(42);
    const comment = result.data.comments[0];

    expect(comment.parent_character_avatar_url).toBeNull();
  });
});
