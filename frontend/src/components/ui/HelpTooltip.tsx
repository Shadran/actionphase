import { InformationCircleIcon } from '@heroicons/react/24/outline';

interface HelpTooltipProps {
  text: string;
}

/**
 * HelpTooltip - A small info icon that reveals help text on hover.
 *
 * Replaces parenthetical clarifications in labels, allowing longer and more
 * detailed help text without cluttering the label line.
 *
 * @example
 * ```tsx
 * <label className="flex items-center gap-1">
 *   Anonymous Mode
 *   <HelpTooltip text="Hides character ownership and NPC status from players." />
 * </label>
 * ```
 */
export function HelpTooltip({ text }: HelpTooltipProps) {
  return (
    <span className="group relative inline-flex items-center">
      <InformationCircleIcon
        className="w-4 h-4 text-content-tertiary hover:text-content-primary cursor-help transition-colors"
        aria-label={text}
        role="img"
      />

      {/* Tooltip panel */}
      <span
        role="tooltip"
        className="
          invisible group-hover:visible
          absolute left-1/2 -translate-x-1/2 bottom-full mb-2
          w-64 p-3 rounded-lg
          bg-surface-raised border border-border-primary shadow-lg
          text-xs text-content-primary font-normal
          z-50 pointer-events-none
          whitespace-normal text-left
        "
      >
        {text}
        {/* Arrow pointing down to icon */}
        <span
          className="
            absolute top-full left-1/2 -translate-x-1/2 -mt-1
            border-8 border-transparent border-t-surface-raised
          "
        />
      </span>
    </span>
  );
}
