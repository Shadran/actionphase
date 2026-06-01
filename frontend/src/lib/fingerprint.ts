import FingerprintJS from '@fingerprintjs/fingerprintjs';

let cached: Promise<string | null> | null = null;

export function getDeviceFingerprint(): Promise<string | null> {
  if (!cached) {
    cached = FingerprintJS.load()
      .then(fp => fp.get())
      .then(result => result.visitorId)
      .catch(() => null);
  }
  return cached;
}
