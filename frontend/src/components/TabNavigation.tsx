import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface Tab {
  id: string;
  label: string;
  badge?: number | string;
  icon?: ReactNode;
}

interface TabNavigationProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  /** When provided, tabs render as <a> links for right-click / middle-click / Cmd+click support */
  getTabHref?: (tabId: string) => string;
}

/**
 * TabNavigation - Responsive tab component with dropdown on mobile
 *
 * Desktop: Horizontal tab bar with icons and labels
 * Mobile: Dropdown select menu for better space utilization
 */
export function TabNavigation({ tabs, activeTab, onTabChange, getTabHref }: TabNavigationProps) {

  return (
    <div className="border-b border-theme-default surface-base md:rounded-t-lg">
      {/* Mobile: Dropdown Select */}
      <div className="md:hidden relative">
        <label htmlFor="tab-select" className="sr-only">
          Select a tab
        </label>
        <select
          id="tab-select"
          value={activeTab}
          onChange={(e) => onTabChange(e.target.value)}
          className="block w-full py-3 pl-2 pr-10 text-base font-semibold surface-raised text-content-primary border border-border-primary md:rounded-t-lg shadow-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-interactive-primary focus:border-interactive-primary transition-all"
          style={{ backgroundImage: 'none' }}
        >
          {tabs.map((tab) => (
            <option key={tab.id} value={tab.id}>
              {tab.label}
              {tab.badge !== undefined ? ` (${tab.badge})` : ''}
            </option>
          ))}
        </select>
        {/* Dropdown chevron icon */}
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          <svg className="h-5 w-5 text-content-secondary" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </div>
      </div>

      {/* Desktop: Horizontal Tab Bar */}
      <nav className="hidden md:flex -mb-px overflow-x-auto" role="tablist" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const className = `
            whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm flex items-center gap-2
            transition-colors duration-200
            ${isActive
              ? 'border-interactive-primary text-interactive-primary'
              : 'border-transparent text-content-secondary hover:text-content-primary hover:border-theme-default'
            }
          `;
          const sharedProps = {
            role: 'tab' as const,
            className,
            'aria-selected': isActive,
            'aria-current': isActive ? ('page' as const) : undefined,
            'data-testid': `tab-${tab.id}`,
          };
          const content = (
            <>
              {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`
                    ml-2 py-0.5 px-2 rounded-full text-xs font-medium
                    ${isActive
                      ? 'bg-semantic-info-subtle text-content-primary'
                      : 'surface-raised text-content-secondary'
                    }
                  `}
                >
                  {tab.badge}
                </span>
              )}
            </>
          );
          return getTabHref ? (
            <Link
              key={tab.id}
              {...sharedProps}
              to={getTabHref(tab.id)}
            >
              {content}
            </Link>
          ) : (
            <button
              key={tab.id}
              {...sharedProps}
              onClick={() => onTabChange(tab.id)}
            >
              {content}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
