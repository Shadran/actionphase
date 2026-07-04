import type { Span } from '@opentelemetry/api';

/**
 * Derives a low-cardinality `http.route` from a raw request URL by stripping the
 * query string and replacing dynamic path segments with `{param}` placeholders.
 *
 * Why this exists: Faro's XHR/fetch instrumentation names spans `{METHOD}` with no
 * route, so Grafana's Application Observability collapses every request into five
 * verb buckets (GET/POST/PUT/PATCH/DELETE). Setting `http.route` lets us rename the
 * span to `{METHOD} /api/v1/games/{param}/characters`, restoring per-endpoint RED
 * metrics without the opposite failure mode (one operation per game id).
 *
 * ActionPhase resource ids are numeric, so the primary rule collapses any numeric
 * path segment. A couple of string-id segments (usernames) are handled explicitly
 * so they don't leak high-cardinality values as distinct operations.
 */
export function deriveHttpRoute(rawUrl: string): string {
  // Drop the query string and fragment — they fragment the route badly.
  let path = rawUrl.split('?')[0].split('#')[0];

  // Absolute URL -> pathname only. Faro reports http.url as an absolute URL.
  try {
    path = new URL(path, window.location.origin).pathname;
  } catch {
    // Already a bare path; keep as-is.
  }

  // String ids that a numeric rule can't catch: /users/username/{username}/...
  path = path.replace(/\/username\/[^/]+/g, '/username/{param}');

  // Numeric ids: any path segment that is all digits.
  path = path.replace(/\/\d+(?=\/|$)/g, '/{param}');

  return path;
}

/** First numeric segment after `/games/`, if present — business context for filtering. */
export function extractGameId(rawUrl: string): string | undefined {
  const match = /\/games\/(\d+)(?=\/|$|\?)/.exec(rawUrl);
  return match?.[1];
}

/**
 * Reads `http.url`/`http.method` already set on an HTTP client span and enriches it
 * with a derived `http.route`, a `{METHOD} {route}` name, and `app.game.id`.
 *
 * Shared by the fetch and XHR `applyCustomAttributesOnSpan` hooks. Reads attributes
 * off the SDK span implementation (the public `Span` type omits `attributes`).
 */
export function enrichHttpSpan(span: Span): void {
  const attrs = (span as unknown as { attributes?: Record<string, unknown> })
    .attributes;
  const url = attrs?.['http.url'];
  if (typeof url !== 'string' || url.length === 0) {
    return;
  }

  const route = deriveHttpRoute(url);
  span.setAttribute('http.route', route);

  const method = attrs?.['http.method'];
  if (typeof method === 'string' && method.length > 0) {
    span.updateName(`${method} ${route}`);
  }

  const gameId = extractGameId(url);
  if (gameId) {
    span.setAttribute('app.game.id', gameId);
  }
}
