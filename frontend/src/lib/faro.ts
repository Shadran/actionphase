import {
  initializeFaro,
  getWebInstrumentations,
  type Faro,
} from '@grafana/faro-web-sdk';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';
import { ReactIntegration, createReactRouterV6DataOptions } from '@grafana/faro-react';
import { matchRoutes } from 'react-router-dom';
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { enrichHttpSpan } from './tracing/httpRouteEnrichment';

let faroInstance: Faro | null = null;

export function initFaro(): void {
  const enabled = import.meta.env.VITE_FARO_ENABLED === 'true';
  const url = import.meta.env.VITE_FARO_URL;

  if (!enabled || !url) {
    return;
  }

  faroInstance = initializeFaro({
    url,
    app: {
      name: import.meta.env.VITE_FARO_APP_NAME ?? 'actionphase',
      version: '1.0.0',
      environment: import.meta.env.VITE_ENVIRONMENT ?? 'development',
    },
    instrumentations: [
      ...getWebInstrumentations({
        captureConsole: true,
        enablePerformanceInstrumentation: false,
      }),
      new TracingInstrumentation({
        // Enrich HTTP client spans with a low-cardinality `http.route`, a
        // `{METHOD} {route}` name, and `app.game.id` so Grafana Application
        // Observability groups by endpoint instead of by bare HTTP verb.
        // axios uses XHR; the fetch hook covers any direct `fetch()` calls.
        instrumentationOptions: {
          xhrInstrumentationOptions: {
            applyCustomAttributesOnSpan: (span) => enrichHttpSpan(span),
          },
          fetchInstrumentationOptions: {
            applyCustomAttributesOnSpan: (span) => enrichHttpSpan(span),
          },
        },
      }),
      new ReactIntegration({
        router: createReactRouterV6DataOptions({
          matchRoutes,
        }),
      }),
    ],
  });

  // Register document-load separately rather than via TracingInstrumentation's
  // `instrumentations` array: overriding that array would drop Faro's own
  // FaroXhrInstrumentation glue and its self-ignore guard (Faro auto-ignores its
  // collector URL to avoid tracing its own exports). TracingInstrumentation's
  // provider.register() has already set the global tracer provider, so
  // DocumentLoadInstrumentation binds to it and exports through Faro's pipeline.
  // It emits a `documentLoad` waterfall span (DNS/TCP/TLS/TTFB/DOM) once per full
  // page load — not per SPA route change.
  registerInstrumentations({
    instrumentations: [new DocumentLoadInstrumentation()],
  });
}

// pushError sends an error to Faro if it is initialized.
// Call this from ErrorBoundary.componentDidCatch.
export function pushError(error: Error, context?: Record<string, string>): void {
  faroInstance?.api.pushError(error, { context });
}

// setFaroUser attaches the current user's id to Faro's session metadata, which
// its FaroMetaAttributesSpanProcessor copies onto every span as `user.id` — giving
// traces business context to filter by. We deliberately send only the id, not
// email/username, to keep PII out of Grafana. No-op if Faro isn't initialized.
export function setFaroUser(userId: number): void {
  faroInstance?.api.setUser({ id: String(userId) });
}

// clearFaroUser removes user metadata on logout so subsequent anonymous spans
// aren't attributed to the previous user.
export function clearFaroUser(): void {
  faroInstance?.api.resetUser();
}

