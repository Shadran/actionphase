import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Faro } from '@grafana/faro-web-sdk';
import {
  loafEventAttributes,
  initLongAnimationFrames,
} from './longAnimationFrames';

function makeEntry(overrides: Record<string, unknown> = {}) {
  return {
    duration: 150,
    blockingDuration: 60,
    renderStart: 120,
    styleAndLayoutStart: 140,
    scripts: [
      {
        duration: 90,
        sourceURL: 'https://app.example.com/assets/index-abc123.js',
        sourceFunctionName: 'renderMessages',
        invoker: 'BUTTON.onclick',
        invokerType: 'event-listener',
      },
    ],
    ...overrides,
  };
}

describe('loafEventAttributes', () => {
  it('stringifies rounded frame + script measurements', () => {
    const attrs = loafEventAttributes(makeEntry({ duration: 149.7 }));

    expect(attrs.duration).toBe('150');
    expect(attrs.blocking_duration).toBe('60');
    expect(attrs.render_start).toBe('120');
    expect(attrs.style_and_layout_start).toBe('140');
    expect(attrs.script_duration).toBe('90');
    expect(attrs.source_function).toBe('renderMessages');
    expect(attrs.invoker).toBe('BUTTON.onclick');
    expect(attrs.invoker_type).toBe('event-listener');
  });

  it('all attribute values are strings', () => {
    const attrs = loafEventAttributes(makeEntry());
    for (const value of Object.values(attrs)) {
      expect(typeof value).toBe('string');
    }
  });

  it('normalizes numeric ids out of the source URL', () => {
    const attrs = loafEventAttributes(
      makeEntry({
        scripts: [
          {
            duration: 90,
            sourceURL: 'https://app.example.com/games/42/chunk.js',
          },
        ],
      })
    );

    expect(attrs.source_url).toBe('/games/{param}/chunk.js');
  });

  it('attributes to the longest-running script in the frame', () => {
    const attrs = loafEventAttributes(
      makeEntry({
        scripts: [
          { duration: 20, sourceFunctionName: 'short' },
          { duration: 88, sourceFunctionName: 'longest' },
          { duration: 40, sourceFunctionName: 'middle' },
        ],
      })
    );

    expect(attrs.source_function).toBe('longest');
    expect(attrs.script_duration).toBe('88');
  });

  it('omits script attributes when there are no scripts', () => {
    const attrs = loafEventAttributes(makeEntry({ scripts: [] }));

    expect(attrs.script_duration).toBeUndefined();
    expect(attrs.source_url).toBeUndefined();
    expect(attrs.source_function).toBeUndefined();
  });
});

describe('initLongAnimationFrames', () => {
  const realPerformanceObserver = globalThis.PerformanceObserver;

  function makeFaro() {
    const pushEvent = vi.fn();
    const faro = { api: { pushEvent } } as unknown as Faro;
    return { faro, pushEvent };
  }

  afterEach(() => {
    globalThis.PerformanceObserver =
      realPerformanceObserver as typeof PerformanceObserver;
    vi.restoreAllMocks();
  });

  it('no-ops (no observe, no throw) when long-animation-frame is unsupported', () => {
    const { observe } = installObserver(['paint', 'largest-contentful-paint']);

    const { faro, pushEvent } = makeFaro();
    expect(() => initLongAnimationFrames(faro)).not.toThrow();
    expect(observe).not.toHaveBeenCalled();
    expect(pushEvent).not.toHaveBeenCalled();
  });

  /** Installs a class-based PerformanceObserver mock (constructable, unlike vi.fn())
   * that records the observe() args and exposes the registered callback so tests can
   * feed it synthetic entries. */
  function installObserver(supportedEntryTypes: readonly string[]) {
    const observe = vi.fn();
    let callback: PerformanceObserverCallback | undefined;

    class FakePerformanceObserver {
      static supportedEntryTypes = supportedEntryTypes;
      constructor(cb: PerformanceObserverCallback) {
        callback = cb;
      }
      observe = observe;
      disconnect = vi.fn();
      takeRecords = vi.fn(() => []);
    }

    globalThis.PerformanceObserver =
      FakePerformanceObserver as unknown as typeof PerformanceObserver;

    const emit = (entries: unknown[]) =>
      callback!(
        { getEntries: () => entries } as unknown as PerformanceObserverEntryList,
        {} as PerformanceObserver
      );

    return { observe, emit };
  }

  it('observes long-animation-frame with buffered: true when supported', () => {
    const { observe } = installObserver(['long-animation-frame']);

    const { faro } = makeFaro();
    initLongAnimationFrames(faro);

    expect(observe).toHaveBeenCalledWith({
      type: 'long-animation-frame',
      buffered: true,
    });
  });

  it('pushes one Faro event per entry above the duration floor', () => {
    const { emit } = installObserver(['long-animation-frame']);

    const { faro, pushEvent } = makeFaro();
    initLongAnimationFrames(faro);

    emit([makeEntry({ duration: 150 })]);

    expect(pushEvent).toHaveBeenCalledTimes(1);
    expect(pushEvent).toHaveBeenCalledWith(
      'long_animation_frame',
      expect.objectContaining({ duration: '150' })
    );
  });

  it('drops entries below the duration floor', () => {
    const { emit } = installObserver(['long-animation-frame']);

    const { faro, pushEvent } = makeFaro();
    initLongAnimationFrames(faro);

    emit([makeEntry({ duration: 80 }), makeEntry({ duration: 150 })]);

    expect(pushEvent).toHaveBeenCalledTimes(1);
  });
});
