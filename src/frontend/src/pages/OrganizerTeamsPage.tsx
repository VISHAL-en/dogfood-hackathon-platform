import React, { useEffect, useState } from 'react';
import { useParams, Link } from '../router/Router';
import { GalleryItem } from '../../../shared/types';
import { api } from '../services/api';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';

export const OrganizerTeamsPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [submissions, setSubmissions] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    api.gallery
      .list({ event: eventId })
      .then((res) => setSubmissions(res.items))
      .catch(() => setSubmissions([]))
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) return <LoadingState message="Loading event teams roster..." />;

  return (
    <div className="page-container" style={{ maxWidth: '1000px' }}>
      <div style={{ marginBottom: '16px' }}>
        <Link to="/organizer" style={{ fontSize: '13px', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
          <span>Back to Organizer Console</span>
        </Link>
      </div>

      <div className="card" style={{ padding: '28px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span className="instance-badge">
            <span className="orb"></span>
            <span>Roster Control</span>
          </span>
          <span className="hash-pill">{eventId}</span>
        </div>
        <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--on-surface)' }}>
          Teams & Participant Management
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>
          Overview of registered teams, active members, and project status across this event.
        </p>
      </div>

      {submissions.length === 0 ? (
        <EmptyState
          icon="group_off"
          title="No teams registered yet"
          description="Teams formed during registration will appear in this management directory."
        />
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Team Name</th>
                <th>Project Title</th>
                <th>Track</th>
                <th>Submission Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((sub) => (
                <tr key={sub.id}>
                  <td>
                    <strong style={{ fontSize: '14px', color: 'var(--on-surface)' }}>{sub.teamName}</strong>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{sub.title}</span>
                  </td>
                  <td>
                    <span className="hash-pill">{sub.trackName || 'General'}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--status-done-fg)', background: 'var(--status-done-bg)', padding: '2px 8px', borderRadius: 'var(--radius-pill)' }}>
                      Submitted
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Link to={`/gallery/${sub.slug}`} className="btn btn-secondary btn-sm">
                      Inspect
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
