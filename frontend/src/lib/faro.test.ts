import { describe, it, expect, vi, beforeEach } from 'vitest';

// Fake Faro API shared across the module under test.
const setUser = vi.fn();
const resetUser = vi.fn();
const fakeFaro = { api: { setUser, resetUser } };

vi.mock('@grafana/faro-web-sdk', () => ({
  initializeFaro: vi.fn(() => fakeFaro),
  getWebInstrumentations: vi.fn(() => []),
}));
vi.mock('@grafana/faro-web-tracing', () => ({
  TracingInstrumentation: vi.fn(),
}));
vi.mock('@grafana/faro-react', () => ({
  ReactIntegration: vi.fn(),
  createReactRouterV6DataOptions: vi.fn(),
}));
vi.mock('react-router-dom', () => ({ matchRoutes: vi.fn() }));
vi.mock('@opentelemetry/instrumentation-document-load', () => ({
  DocumentLoadInstrumentation: vi.fn(),
}));
vi.mock('@opentelemetry/instrumentation', () => ({
  registerInstrumentations: vi.fn(),
}));

describe('faro user metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_FARO_ENABLED', 'true');
    vi.stubEnv('VITE_FARO_URL', 'https://faro.example.com/collect');
  });

  it('setFaroUser sends only the id, stringified, and no PII', async () => {
    const { initFaro, setFaroUser } = await import('./faro');
    initFaro();

    setFaroUser(42);

    expect(setUser).toHaveBeenCalledTimes(1);
    expect(setUser).toHaveBeenCalledWith({ id: '42' });
    // Guard against leaking email/username into Grafana.
    const arg = setUser.mock.calls[0][0];
    expect(arg).not.toHaveProperty('email');
    expect(arg).not.toHaveProperty('username');
  });

  it('clearFaroUser resets the Faro user', async () => {
    const { initFaro, clearFaroUser } = await import('./faro');
    initFaro();

    clearFaroUser();

    expect(resetUser).toHaveBeenCalledTimes(1);
  });

  it('setFaroUser is a no-op before Faro is initialized', async () => {
    vi.stubEnv('VITE_FARO_ENABLED', 'false');
    vi.resetModules();
    const { initFaro, setFaroUser } = await import('./faro');
    initFaro(); // disabled -> no instance created

    expect(() => setFaroUser(1)).not.toThrow();
    expect(setUser).not.toHaveBeenCalled();
  });
});
