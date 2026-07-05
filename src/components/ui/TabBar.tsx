import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/', label: 'Chat', icon: '💬' },
  { to: '/activity', label: 'Activity', icon: '📋' },
  { to: '/collect', label: 'Collect', icon: '🎯' },
  { to: '/me', label: 'Me', icon: '👤' },
];

export function TabBar() {
  return (
    <nav className="flex border-t border-surface-border bg-surface-dark">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center py-2.5 text-xs font-medium transition-colors ${
              isActive ? 'text-brand' : 'text-text-muted hover:text-text-secondary'
            }`
          }
        >
          <span className="text-base mb-0.5">{tab.icon}</span>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
