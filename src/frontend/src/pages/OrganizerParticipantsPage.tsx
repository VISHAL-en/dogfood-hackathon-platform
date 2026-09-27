import React, { useState, useEffect } from 'react';
import { useParams, Link } from '../router/Router';
import { TeamWithDetails } from '../../../shared/types';
import { api } from '../services/api';
import { Sidebar } from '../components/Sidebar';
import { LoadingState } from '../components/LoadingState';
import { ErrorBanner } from '../components/ErrorBanner';

export const OrganizerParticipantsPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [teams, setTeams] = useState<TeamWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!eventId) return;
    loadData();
  }, [eventId]);

  const loadData = async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.teams.listByEvent(eventId);
      setTeams(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load participants');
    } finally {
      setLoading(false);
    }
  };

  const filteredTeams = teams.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalMembers = teams.reduce((acc, t) => acc + (t.memberCount || t.members?.length || 1), 0);

  return (
    <div className="admin-layout">
      <Sidebar activeItem="participants" role="organizer" eventId={eventId} />

      <main className="admin-content">
        <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Link to="/organizer" style={{ fontSize: '13px', color: 'var(--color-primary)', textDecoration: 'none' }}>
                &larr; Events
              </Link>
              <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>/</span>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Roster</span>
            </div>
            <h1 className="page-title">Participants & Team Roster</h1>
            <p className="page-subtitle">Track registered hackers, team formations, and participation metrics across all tracks.</p>
          </div>
        </header>

        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        {loading ? (
          <LoadingState message="Loading participant roster..." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="grid grid-cols-3" style={{ gap: '16px' }}>
              <div className="card" style={{ padding: '16px' }}>
                <span className="text-secondary" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Registered Teams</span>
                <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '4px' }} className="tnum">
                  {teams.length}
                </div>
              </div>
              <div className="card" style={{ padding: '16px' }}>
                <span className="text-secondary" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estimated Hackers</span>
                <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '4px', color: 'var(--color-primary)' }} className="tnum">
                  {totalMembers}
                </div>
              </div>
              <div className="card" style={{ padding: '16px' }}>
                <span className="text-secondary" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg Team Size</span>
                <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '4px' }} className="tnum">
                  {teams.length > 0 ? (totalMembers / teams.length).toFixed(1) : '0.0'}
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-text-secondary)' }}>search</span>
                  <input
                    type="text"
                    placeholder="Search by team name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', width: '220px' }}
                  />
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  Showing {filteredTeams.length} of {teams.length} teams
                </div>
              </div>

              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Team Name</th>
                      <th>Members</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTeams.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-secondary)' }}>
                          No registered teams found matching search.
                        </td>
                      </tr>
                    ) : (
                      filteredTeams.map((t) => (
                        <tr key={t.id}>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: '13px' }}>{t.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>ID: {t.id}</div>
                          </td>
                          <td className="tnum">
                            <span className="badge" style={{ background: 'var(--color-surface-subtle)', color: 'var(--color-text)' }}>
                              {t.memberCount ?? t.members?.length ?? 1} members
                            </span>
                          </td>
                          <td className="tnum" style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                            {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : 'N/A'}
                          </td>
                          <td>
                            <Link to={`/teams/${t.id}`} className="button button-outline" style={{ padding: '4px 8px', fontSize: '12px', textDecoration: 'none' }}>
                              Manage Team
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
