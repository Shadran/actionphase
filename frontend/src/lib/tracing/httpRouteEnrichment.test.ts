import { describe, it, expect, vi } from 'vitest';
import type { Span } from '@opentelemetry/api';
import {
  deriveHttpRoute,
  extractGameId,
  enrichHttpSpan,
} from './httpRouteEnrichment';

describe('deriveHttpRoute', () => {
  it('collapses numeric ids to {param}', () => {
    expect(deriveHttpRoute('/api/v1/games/42/characters')).toBe(
      '/api/v1/games/{param}/characters'
    );
  });

  it('collapses multiple numeric ids in one path', () => {
    expect(
      deriveHttpRoute('/api/v1/games/42/conversations/7/messages/99')
    ).toBe('/api/v1/games/{param}/conversations/{param}/messages/{param}');
  });

  it('collapses a trailing numeric id', () => {
    expect(deriveHttpRoute('/api/v1/characters/123')).toBe(
      '/api/v1/characters/{param}'
    );
  });

  it('strips the query string before deriving the route', () => {
    expect(
      deriveHttpRoute('/api/v1/games/42/posts?page=2&limit=20')
    ).toBe('/api/v1/games/{param}/posts');
  });

  it('strips a fragment', () => {
    expect(deriveHttpRoute('/api/v1/games/42#top')).toBe(
      '/api/v1/games/{param}'
    );
  });

  it('reduces an absolute URL to its pathname', () => {
    expect(
      deriveHttpRoute('https://app.example.com/api/v1/games/42/characters')
    ).toBe('/api/v1/games/{param}/characters');
  });

  it('masks string username ids', () => {
    expect(
      deriveHttpRoute('/api/v1/users/username/alice_99/profile')
    ).toBe('/api/v1/users/username/{param}/profile');
  });

  it('leaves static routes untouched', () => {
    expect(deriveHttpRoute('/api/v1/auth/login')).toBe('/api/v1/auth/login');
  });

  it('does not mangle a literal /games without an id', () => {
    expect(deriveHttpRoute('/api/v1/games/')).toBe('/api/v1/games/');
  });
});

describe('extractGameId', () => {
  it('extracts the game id from a nested path', () => {
    expect(extractGameId('/api/v1/games/42/characters')).toBe('42');
  });

  it('extracts a trailing game id', () => {
    expect(extractGameId('/api/v1/games/7')).toBe('7');
  });

  it('extracts a game id before a query string', () => {
    expect(extractGameId('/api/v1/games/7?foo=bar')).toBe('7');
  });

  it('returns undefined when there is no game id', () => {
    expect(extractGameId('/api/v1/auth/login')).toBeUndefined();
  });
});

describe('enrichHttpSpan', () => {
  function makeSpan(attributes: Record<string, unknown>) {
    const setAttribute = vi.fn();
    const updateName = vi.fn();
    const span = { attributes, setAttribute, updateName } as unknown as Span;
    return { span, setAttribute, updateName };
  }

  it('sets http.route, renames the span, and sets app.game.id', () => {
    const { span, setAttribute, updateName } = makeSpan({
      'http.url': 'https://app.example.com/api/v1/games/42/characters',
      'http.method': 'GET',
    });

    enrichHttpSpan(span);

    expect(setAttribute).toHaveBeenCalledWith(
      'http.route',
      '/api/v1/games/{param}/characters'
    );
    expect(updateName).toHaveBeenCalledWith(
      'GET /api/v1/games/{param}/characters'
    );
    expect(setAttribute).toHaveBeenCalledWith('app.game.id', '42');
  });

  it('does nothing when http.url is absent', () => {
    const { span, setAttribute, updateName } = makeSpan({
      'http.method': 'GET',
    });

    enrichHttpSpan(span);

    expect(setAttribute).not.toHaveBeenCalled();
    expect(updateName).not.toHaveBeenCalled();
  });

  it('sets the route but skips renaming when method is missing', () => {
    const { span, setAttribute, updateName } = makeSpan({
      'http.url': '/api/v1/auth/login',
    });

    enrichHttpSpan(span);

    expect(setAttribute).toHaveBeenCalledWith('http.route', '/api/v1/auth/login');
    expect(updateName).not.toHaveBeenCalled();
  });

  it('omits app.game.id for non-game routes', () => {
    const { span, setAttribute } = makeSpan({
      'http.url': '/api/v1/auth/login',
      'http.method': 'POST',
    });

    enrichHttpSpan(span);

    expect(setAttribute).not.toHaveBeenCalledWith(
      'app.game.id',
      expect.anything()
    );
  });
});
