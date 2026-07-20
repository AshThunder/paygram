import { NavLink } from 'react-router-dom';
import { Icon } from './primitives';

const tabs = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/chat', label: 'Chat', icon: 'chat_bubble' },
  { to: '/activity', label: 'Activity', icon: 'swap_horiz' },
  { to: '/me', label: 'Me', icon: 'person' },
] as const;

export function DemoTabBar() {
  return (
    <nav
      data-testid="tab-bar"
      className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex max-w-[390px] items-center justify-around border-t border-surface-variant bg-surface-container-lowest px-4 py-2 pb-safe"
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={'end' in tab ? tab.end : false}
          data-testid={`tab-${tab.label.toLowerCase()}`}
          className={({ isActive }) =>
            isActive
              ? 'flex flex-col items-center justify-center rounded-xl bg-primary-fixed px-3 py-1 text-primary'
              : 'flex flex-col items-center justify-center rounded-xl px-3 py-1 text-on-surface-variant'
          }
        >
          {({ isActive }) => (
            <>
              <Icon name={tab.icon} className="text-[24px]" filled={isActive} />
              <span className="mt-1 text-[11px] font-medium">{tab.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
