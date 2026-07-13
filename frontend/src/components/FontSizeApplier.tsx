import { useEffect } from 'react';
import { useFontSize } from '../hooks/useUserPreferences';
import type { FontSize } from '../lib/api/auth';

const FONT_SIZE_PX: Record<FontSize, string> = {
  small: '13px',
  medium: '16px',
  large: '20px',
};

/**
 * Applies the user's font size preference to the document root so that all
 * rem-based typography scales proportionally.
 */
export function FontSizeApplier() {
  const fontSize = useFontSize();

  useEffect(() => {
    document.documentElement.style.fontSize = FONT_SIZE_PX[fontSize];
  }, [fontSize]);

  return null;
}
