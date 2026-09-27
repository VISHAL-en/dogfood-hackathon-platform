import React, { useEffect, useState } from 'react';
import { useParams, Link } from '../router/Router';
import { TeamWithDetails, TeamMember } from '../../../shared/types';
import { api, ApiError } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { LoadingState } from '../components/LoadingState';
import { ErrorBanner } from '../components/ErrorBanner';
import { Modal } from '../components/Modal';

export const TeamManagementPage: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const [team, setTeam] = useState<TeamWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const { user } = useAuth();

  const loadTeam = () => {
    if (!teamId) return;
    setLoading(true);
    api.teams
      .getById(teamId)
      .then((data) => setTeam(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTeam();
  }, [teamId]);

  const isCaptain = (team?.members || []).some((m: TeamMember) => m.userId === user?.id && m.role === 'captain');

  const handleGenerateInvite = async () => {
    if (!teamId) return;
    setInviteLoading(true);
    setInviteError(null);
    try {
      const res = await api.teams.createInvitation(teamId);
      setInviteToken(res.token);
    } catch (err: unknown) {
      if (err instanceof ApiError) setInviteError(err.message);
      else setInviteError('Failed to generate invite token');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!teamId || !confirm('Remove this member from the team?')) return;
    try {
      await api.teams.removeMember(teamId, userId);
      loadTeam();
    } catch (err: unknown) {
      if (err instanceof ApiError) alert(err.message);
      else alert('Failed to remove member');
    }
  };

  if (loading) {
    return <LoadingState message="Loading team roster..." />;
  }

  if (error || !team) {
    return (
      <div className="page-container">
        <ErrorBanner message={error || 'Team not found'} />
        <Link to="/events" className="btn btn-secondary btn-sm" style={{ marginTop: '16px' }}>
          Back to Events
        </Link>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Top Header Card */}
      <div className="card" style={{ marginBottom: '24px', padding: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className="hash-pill">{team.slug}</span>
              <span style={{ fontSize: '12px', color: 'var(--outline)' }}>•</span>
              <Link to={`/events/${team.eventId}`} style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: 500 }}>
                {(team as any).eventName || 'Event Details'}
              </Link>
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--on-surface)' }}>{team.name}</h1>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            {isCaptain && (
              <button onClick={() => { setShowInviteModal(true); setInviteToken(null); }} className="btn btn-secondary">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>person_add</span>
                <span>Invite Teammate</span>
              </button>
            )}
            <Link to={`/events/${team.eventId}/submission`} className="btn btn-primary">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>upload_file</span>
              <span>Project Submission</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Members Section */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--on-surface)' }}>
            Roster ({team.members?.length ?? 0} members)
          </h2>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Member Name</th>
                <th>Role</th>
                <th>Joined At</th>
                {isCaptain && <th style={{ textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {(team.members || []).map((m: TeamMember) => (
                <tr key={m.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: m.role === 'captain' ? 'var(--primary)' : 'var(--surface-container)',
                          color: m.role === 'captain' ? '#fff' : 'var(--on-surface)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '11px'
                        }}
                      >
                        {m.userName.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600 }}>{m.userName}</span>
                      {m.userId === user?.id && (
                        <span style={{ fontSize: '10px', color: 'var(--outline)', background: 'var(--surface-low)', padding: '1px 6px', borderRadius: '4px' }}>You</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-pill)',
                        background: m.role === 'captain' ? 'var(--primary-container)' : 'var(--surface-container)',
                        color: m.role === 'captain' ? 'var(--on-primary-container)' : 'var(--on-surface-variant)',
                        textTransform: 'capitalize'
                      }}
                    >
                      {m.role}
                    </span>
                  </td>
                  <td className="tabular-nums" style={{ color: 'var(--outline)', fontSize: '12px' }}>
                    {new Date(m.joinedAt).toLocaleDateString()}
                  </td>
                  {isCaptain && (
                    <td style={{ textAlign: 'right' }}>
                      {m.role !== 'captain' && (
                        <button
                          onClick={() => handleRemoveMember(m.userId)}
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--error)' }}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Member Modal */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Invite Teammate"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)' }}>
            Generate a secure, single-use invitation token to invite a teammate to {team.name}.
          </p>

          {inviteError && <ErrorBanner message={inviteError} />}

          {inviteToken ? (
            <div>
              <label className="form-label">Single-Use Invitation Token</label>
              <div className="code-box" style={{ padding: '12px', userSelect: 'all', fontSize: '13px', fontWeight: 600, color: 'var(--primary)' }}>
                {inviteToken}
              </div>
              <p style={{ fontSize: '11px', color: 'var(--outline)', marginTop: '6px' }}>
                Share this token with your teammate. They can accept it via the event registration page.
              </p>
            </div>
          ) : (
            <button
              onClick={handleGenerateInvite}
              disabled={inviteLoading}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              {inviteLoading ? 'Generating Token...' : 'Generate New Invite Token'}
            </button>
          )}
        </div>
      </Modal>
    </div>
  );
};
