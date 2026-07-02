import { useEffect, useState } from 'react';

interface UseInfiniteScrollSentinelOptions {
  /** When false, no observer is attached (e.g. no more pages, or a fetch is in flight). */
  enabled: boolean;
  /** Called when the sentinel enters the (root-margin-expanded) viewport. */
  onIntersect: () => void;
  /** Lookahead margin, e.g. '800px' to start loading ~2 screens early. */
  rootMargin?: string;
  threshold?: number;
}

/**
 * Attaches an IntersectionObserver to a sentinel element for infinite scroll.
 *
 * Returns a callback ref — pass it as `ref` on the sentinel element. Using a
 * callback ref (backed by state) instead of a RefObject makes the observer
 * re-attach automatically when the sentinel unmounts and remounts (e.g. a
 * collapsible section), which a plain ref in a dep array cannot do.
 *
 * An intersection that fires immediately on observe is intentional: it means
 * the loaded content doesn't fill the viewport yet, so the next page should
 * load right away. Pass a stable (or deliberately keyed) `onIntersect` — the
 * observer is re-created whenever its identity changes, which re-checks
 * intersection and is what keeps back-to-back pages loading while the
 * sentinel stays visible.
 */
export function useInfiniteScrollSentinel({
  enabled,
  onIntersect,
  rootMargin,
  threshold,
}: UseInfiniteScrollSentinelOptions): (node: Element | null) => void {
  const [sentinel, setSentinel] = useState<Element | null>(null);

  useEffect(() => {
    if (!sentinel || !enabled) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onIntersect();
        }
      },
      { rootMargin, threshold }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel, enabled, onIntersect, rootMargin, threshold]);

  return setSentinel;
}
