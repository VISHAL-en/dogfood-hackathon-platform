import React from 'react';
import { Link, useLocation } from '../router/Router';

export interface SidebarItem {
  label: string;
  path: string;
  icon: string;
  badge?: string | number;
}

export interface SidebarSection {
  title?: string;
  items: SidebarItem[];
}

export interface SidebarProps {
  sections?: SidebarSection[];
  headerTitle?: string;
  headerSubtitle?: string;
  activeItem?: string;
  role?: string;
  eventId?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sections,
  headerTitle,
  headerSubtitle,
  role,
  eventId
}) => {
  const { pathname } = useLocation();

  const computedSections: SidebarSection[] = sections || (role === 'organizer' && eventId ? [
    {
      title: 'Event Management',
      items: [
        { label: 'Event Settings', path: `/organizer/events/${eventId}/settings`, icon: 'settings' },
        { label: 'Submissions', path: `/organizer/events/${eventId}/submissions`, icon: 'inventory_2' },
        { label: 'Teams', path: `/organizer/events/${eventId}/teams`, icon: 'groups' },
        { label: 'Participants', path: `/organizer/events/${eventId}/participants`, icon: 'person' },
      ]
    },
    {
      title: 'Judging & Normalization',
      items: [
        { label: 'Judges Roster', path: `/organizer/events/${eventId}/judges`, icon: 'gavel' },
        { label: 'Live Progress', path: `/organizer/events/${eventId}/judging/progress`, icon: 'monitoring' },
        { label: 'Normalization', path: `/organizer/events/${eventId}/judging/normalization`, icon: 'tune' },
        { label: 'Results & Audit', path: `/organizer/events/${eventId}/results`, icon: 'fact_check' },
      ]
    }
  ] : []);

  return (
    <aside className="workspace-sidebar">
      {headerTitle && (
        <div style={{ padding: '0 8px 12px 8px', borderBottom: '1px solid var(--outline-border)' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--on-surface)' }}>{headerTitle}</h2>
          {headerSubtitle && (
            <p style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '2px' }}>
              {headerSubtitle}
            </p>
          )}
        </div>
      )}

      {computedSections.map((sec, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {sec.title && <div className="sidebar-section-title">{sec.title}</div>}
          {sec.items.map((item) => {
            const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  {item.icon}
                </span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-pill)',
                      background: isActive ? 'var(--primary-container)' : 'var(--surface-container)',
                      color: isActive ? 'var(--on-primary-container)' : 'var(--on-surface-variant)',
                      fontWeight: 600
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </aside>
  );
};
