import { vi } from 'vitest';

/**
 * Installs a callback-capturing IntersectionObserver stub and returns a handle
 * for firing intersections from tests.
 *
 * setupTests.ts already installs a silent no-op IntersectionObserver before
 * each test; call this in a test-file `beforeEach` when the test needs to
 * *drive* the observer (e.g. simulate an infinite-scroll sentinel entering the
 * viewport) rather than merely tolerate its existence.
 *
 * The handle fires the callback of the most recently constructed observer,
 * which for a component with several observers (read tracking, sentinels) is
 * the last one attached during the render — parent effects run after children,
 * so a parent's sentinel observer wins.
 */
export function stubIntersectionObserver() {
  let callback: IntersectionObserverCallback | null = null;

  class CapturingIntersectionObserver {
    constructor(cb: IntersectionObserverCallback) {
      callback = cb;
    }
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
    takeRecords = vi.fn(() => [] as IntersectionObserverEntry[]);
  }

  vi.stubGlobal('IntersectionObserver', CapturingIntersectionObserver);

  return {
    /** True once a component has constructed an observer. */
    hasObserver: () => callback !== null,
    /** Fire the latest observer's callback as if its target became visible. */
    intersect() {
      callback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    },
  };
}
