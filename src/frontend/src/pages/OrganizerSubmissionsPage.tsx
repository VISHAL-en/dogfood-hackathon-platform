import React, { useEffect, useState } from 'react';
import { useParams, Link } from '../router/Router';
import { GalleryItem } from '../../../shared/types';
import { api } from '../services/api';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';
import { StatusPill } from '../components/StatusPill';

export const OrganizerSubmissionsPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [submissions, setSubmissions] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    api.gallery
      .list({ event: eventId, search: search.trim() || undefined })
      .then((res) => {
        setSubmissions(res.items);
      })
      .catch(() => {
        setSubmissions([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [eventId, search]);

  if (loading) return <LoadingState message="Loading event submissions..." />;

  return (
    <div className="page-container" style={{ maxWidth: '1200px' }}>
      <div style={{ marginBottom: '16px' }}>
        <Link to="/organizer" style={{ fontSize: '13px', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
          <span>Back to Organizer Console</span>
        </Link>
      </div>

      <div className="card" style={{ padding: '28px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span className="instance-badge">
                <span className="orb"></span>
                <span>Submissions & Eligibility</span>
              </span>
              <span className="hash-pill">{eventId}</span>
            </div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--on-surface)' }}>
              Submissions Management & Eligibility Review
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>
              Review project submissions, track assignment, and verify repository eligibility prior to judging.
            </p>
          </div>

          <div style={{ width: '280px' }}>
            <input
              type="text"
              className="input-text"
              placeholder="Search submissions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {submissions.length === 0 ? (
        <EmptyState
          icon="folder_off"
          title="No submissions found"
          description="Submitted projects will appear here once participants finalize their drafts."
        />
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Title / Project Slug</th>
                <th>Team</th>
                <th>Track</th>
                <th>Repository</th>
                <th>Submitted Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((sub) => (
                <tr key={sub.id}>
                  <td>
                    <StatusPill status="submitted" />
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--on-surface)' }}>{sub.title}</div>
                    <div style={{ fontSize: '11px', color: 'var(--outline)', fontFamily: 'var(--font-mono)' }}>{sub.slug}</div>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{sub.teamName}</span>
                  </td>
                  <td>
                    <span className="hash-pill">{sub.trackName || 'General'}</span>
                  </td>
                  <td>
                    {sub.repoUrl ? (
                      <a href={sub.repoUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>code</span>
                        <span>Repo</span>
                      </a>
                    ) : (
                      <span style={{ color: 'var(--outline)', fontSize: '12px' }}>—</span>
                    )}
                  </td>
                  <td className="tabular-nums" style={{ fontSize: '12px', color: 'var(--outline)' }}>
                    {new Date(sub.submittedAt).toLocaleDateString()}
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
