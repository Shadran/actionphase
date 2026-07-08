import type { Faro } from '@grafana/faro-web-sdk';
import { deriveHttpRoute } from './httpRouteEnrichment';

/**
 * Long Animation Frames (LoAF) instrumentation.
 *
 * INP attribution names the *element* that was interacted with (`svg.h-6.w-6>path`)
 * and only fires on interactions. LoAF closes both gaps: a `PerformanceObserver` for
 * `long-animation-frame` entries reports any main-thread block, attributed to the
 * *script source URL + function*, and fires regardless of whether an interaction
 * triggered it — so it also catches on-load render jank and background updates that
 * INP never sees.
 *
 * Chromium-only today (Firefox/Safari lack the entry type and this no-ops there);
 * INP still covers those browsers. Complements, does not replace, INP.
 */

/** Duration floor (ms) for reporting. Above the 50ms LoAF spec minimum to keep event
 * volume/cost sane — a 50ms frame is common and rarely actionable. Tune against real
 * event volume. */
const MIN_DURATION_MS = 100;

/** Faro EventAttributes values must be strings. */
const LOAF_EVENT_NAME = 'long_animation_frame';

// The DOM lib shipped with our TS target does not yet include the LoAF timing types,
// so we describe the subset of the shape we read. See
// https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongAnimationFrameTiming
interface ScriptTiming {
  duration: number;
  sourceURL?: string;
  sourceFunctionName?: string;
  invoker?: string;
  invokerType?: string;
}

interface LongAnimationFrameTiming {
  duration: number;
  blockingDuration?: number;
  renderStart?: number;
  styleAndLayoutStart?: number;
  scripts?: ScriptTiming[];
}

/** Normalize the current route to low cardinality for grouping (reuses the numeric-id
 * collapsing rules from the HTTP route enrichment). */
function currentRoute(): string {
  return deriveHttpRoute(window.location.pathname);
}

/** Normalize a script source URL to low cardinality: drop the query string and collapse
 * numeric path segments so ids in chunk URLs don't fragment grouping. */
function normalizeSourceURL(url: string): string {
  return deriveHttpRoute(url);
}

/** Build the Faro event attributes for a LoAF entry. All values are strings, as Faro's
 * EventAttributes requires. Attribution comes from the longest script in the frame. */
export function loafEventAttributes(
  entry: LongAnimationFrameTiming
): Record<string, string> {
  const attrs: Record<string, string> = {
    duration: String(Math.round(entry.duration)),
    page_route: currentRoute(),
  };

  if (typeof entry.blockingDuration === 'number') {
    attrs.blocking_duration = String(Math.round(entry.blockingDuration));
  }
  if (typeof entry.renderStart === 'number') {
    attrs.render_start = String(Math.round(entry.renderStart));
  }
  if (typeof entry.styleAndLayoutStart === 'number') {
    attrs.style_and_layout_start = String(Math.round(entry.styleAndLayoutStart));
  }

  // Attribute to the longest-running script in the frame — that's the code most
  // responsible for the block.
  const longest = (entry.scripts ?? []).reduce<ScriptTiming | undefined>(
    (max, s) => (max === undefined || s.duration > max.duration ? s : max),
    undefined
  );

  if (longest) {
    attrs.script_duration = String(Math.round(longest.duration));
    if (longest.sourceURL) {
      attrs.source_url = normalizeSourceURL(longest.sourceURL);
    }
    if (longest.sourceFunctionName) {
      attrs.source_function = longest.sourceFunctionName;
    }
    if (longest.invoker) {
      attrs.invoker = longest.invoker;
    }
    if (longest.invokerType) {
      attrs.invoker_type = longest.invokerType;
    }
  }

  return attrs;
}

/**
 * Registers a PerformanceObserver for `long-animation-frame` entries, pushing a Faro
 * event for each frame over MIN_DURATION_MS. Reads from the already-registered Faro
 * instance; safe to call after `initializeFaro(...)` returns. No-op where the entry
 * type is unsupported.
 */
export function initLongAnimationFrames(faro: Faro): void {
  const supported =
    typeof PerformanceObserver !== 'undefined' &&
    PerformanceObserver.supportedEntryTypes?.includes('long-animation-frame');

  if (!supported) {
    return;
  }

  const observer = new PerformanceObserver((list) => {
    for (const rawEntry of list.getEntries()) {
      const entry = rawEntry as unknown as LongAnimationFrameTiming;
      if (entry.duration < MIN_DURATION_MS) {
        continue;
      }
      faro.api.pushEvent(LOAF_EVENT_NAME, loafEventAttributes(entry));
    }
  });

  observer.observe({
    type: 'long-animation-frame',
    buffered: true,
  } as PerformanceObserverInit);
}
