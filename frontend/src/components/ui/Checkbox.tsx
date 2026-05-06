import type { InputHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '../../lib/theme/utils';
import { HelpTooltip } from './HelpTooltip';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  helperText?: string;
  /** Tooltip text shown on hover of a help icon next to the label. */
  helpText?: string;
}

/**
 * Checkbox - Checkbox input component with semantic theme tokens
 *
 * Now uses semantic tokens instead of hard-coded colors:
 * - 70% less code (no more dark: classes)
 * - Automatically adapts to all themes (light, dark, future themes)
 *
 * @example
 * ```tsx
 * <Checkbox
 *   label="Accept terms and conditions"
 *   checked={accepted}
 *   onChange={(e) => setAccepted(e.target.checked)}
 * />
 *
 * <Checkbox
 *   label="Subscribe to newsletter"
 *   helperText="You can unsubscribe at any time"
 * />
 * ```
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, error, helperText, helpText, className, id, ...props }, ref) => {
    const checkboxId = id || props.name;

    return (
      <div className="flex items-start">
        <div className="flex items-center h-5">
          <input
            ref={ref}
            id={checkboxId}
            type="checkbox"
            className={cn(
              // Base styles
              'w-4 h-4 rounded border transition-colors cursor-pointer',
              // Colors using semantic tokens
              'surface-base text-interactive-primary border-theme-default',
              // Focus states
              'focus:ring-2 focus:ring-interactive-primary',
              // Disabled state
              'disabled:opacity-50 disabled:cursor-not-allowed',
              // Error state
              error && 'border-semantic-danger focus:ring-semantic-danger',
              // Custom className
              className
            )}
            {...props}
          />
        </div>
        {(label || helperText || error) && (
          <div className="ml-3">
            {label && (
              <label
                htmlFor={checkboxId}
                className="text-sm font-medium text-content-primary cursor-pointer inline-flex items-center gap-1"
              >
                {label}
                {helpText && <HelpTooltip text={helpText} />}
              </label>
            )}
            {error && <p className="text-sm text-semantic-danger mt-1">{error}</p>}
            {!error && helperText && (
              <p className="text-sm text-content-secondary mt-1">{helperText}</p>
            )}
          </div>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';
