import React, { useEffect, useState } from 'react';
import { EventListItem } from '../../../shared/types';
import { api } from '../services/api';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';
import { Link } from '../router/Router';

export const ArchivePage: React.FC = () => {
  const [archivedEvents, setArchivedEvents] = useState<EventListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.events
      .list({ status: 'archived' })
      .then(setArchivedEvents)
      .catch(() => setArchivedEvents([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading archived events..." />;

  return (
    <div className="page-container" style={{ maxWidth: '1000px' }}>
      <div className="card" style={{ padding: '32px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span className="instance-badge">
            <span className="orb"></span>
            <span>Historical Repository</span>
          </span>
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--on-surface)' }}>
          Event Archive & Historical Records
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>
          Browse concluded hackathons, archived evaluation rubrics, and immutable project galleries.
        </p>
      </div>

      {archivedEvents.length === 0 ? (
        <EmptyState
          icon="history"
          title="No Archived Events"
          description="Archived events and historical hackathons will appear here once archived by organizers."
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {archivedEvents.map((ev) => (
            <div key={ev.id} className="card card-clickable">
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--on-surface)', marginBottom: '8px' }}>
                {ev.name}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', lineHeight: 1.5, marginBottom: '16px' }}>
                {ev.description}
              </p>
              <Link to={`/events/${ev.id}`} className="btn btn-secondary btn-sm">
                View Historical Details
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
