import {
  initializeFaro,
  getWebInstrumentations,
  type Faro,
} from '@grafana/faro-web-sdk';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';
import { ReactIntegration, createReactRouterV6DataOptions } from '@grafana/faro-react';
import { matchRoutes, useLocation, useNavigationType, createRoutesFromChildren } from 'react-router-dom';

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
        performanceInstrumentation: { enabled: false },
      }),
      new TracingInstrumentation(),
      new ReactIntegration({
        router: createReactRouterV6DataOptions({
          matchRoutes,
          useLocation,
          useNavigationType,
          createRoutesFromChildren,
        }),
      }),
    ],
  });
}

// pushError sends an error to Faro if it is initialized.
// Call this from ErrorBoundary.componentDidCatch.
export function pushError(error: Error, context?: Record<string, string>): void {
  faroInstance?.api.pushError(error, { context });
}

// getFaro returns the Faro instance, or null if not initialized.
export function getFaro(): Faro | null {
  return faroInstance;
}
