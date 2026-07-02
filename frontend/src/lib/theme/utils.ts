import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines class names with proper precedence using clsx and tailwind-merge.
 *
 * Benefits:
 * - Handles conditional classes (clsx)
 * - Resolves Tailwind class conflicts (tailwind-merge)
 * - Type-safe with ClassValue types
 *
 * @example
 * cn('px-2 py-1', condition && 'bg-blue-500', 'px-4') // => 'py-1 bg-blue-500 px-4'
 * cn('text-sm', { 'font-bold': isActive }) // => 'text-sm font-bold' (if isActive)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Type-safe variant configuration for components.
 * Inspired by CVA (Class Variance Authority) but simplified.
 */
type TVConfig<V extends Record<string, Record<string, string>>> = {
  /** Base classes applied to all variants */
  base?: string;

  /** Variant definitions */
  variants?: V;

  /** Default variant values */
  defaultVariants?: Partial<{ [K in keyof V]: keyof V[K] }>;
};

/**
 * Props type for tv() function calls
 */
type TVProps<V extends Record<string, Record<string, string>>> = Partial<{
  [K in keyof V]: keyof V[K];
}> & {
  className?: string;
};

/**
 * Creates a type-safe variant utility for components.
 *
 * This utility helps create component variants with:
 * - Type safety and autocomplete
 * - Default variant values
 * - Automatic class merging
 * - Clean API for consumers
 *
 * @example
 * const buttonStyles = tv({
 *   base: 'rounded-lg font-medium transition-colors',
 *   variants: {
 *     variant: {
 *       primary: 'bg-interactive-primary text-content-inverse',
 *       secondary: 'surface-raised text-content-primary',
 *     },
 *     size: {
 *       sm: 'px-3 py-1.5 text-sm',
 *       md: 'px-4 py-2 text-base',
 *       lg: 'px-6 py-3 text-lg',
 *     },
 *   },
 *   defaultVariants: {
 *     variant: 'primary',
 *     size: 'md',
 *   },
 * });
 *
 * // Usage in component:
 * <button className={buttonStyles({ variant: 'primary', size: 'lg' })}>
 *   Click me
 * </button>
 *
 * // Or with additional classes:
 * <button className={buttonStyles({ variant: 'secondary', className: 'mt-4' })}>
 *   Cancel
 * </button>
 */
export function tv<V extends Record<string, Record<string, string>>>(
  config: TVConfig<V>
) {
  return (props: TVProps<V> = {}) => {
    let className = config.base || '';

    // Apply variant classes
    if (config.variants) {
      Object.entries(config.variants).forEach(([variantKey, variantValues]) => {
        // Get value from props or default
        const value =
          props[variantKey as keyof V] ??
          config.defaultVariants?.[variantKey as keyof V];

        // Apply variant class if value exists
        if (value && variantValues[value as string]) {
          className = cn(className, variantValues[value as string]);
        }
      });
    }

    // Merge with custom className
    return cn(className, props.className);
  };
}

