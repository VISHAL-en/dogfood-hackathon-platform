import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from '../router/Router';
import { EventWithDetails } from '../../../shared/types';
import { api, ApiError } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { LoadingState } from '../components/LoadingState';
import { ErrorBanner } from '../components/ErrorBanner';

export const EventRegistrationPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [teamName, setTeamName] = useState('');
  const [teamSlug, setTeamSlug] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    api.events
      .getByIdOrSlug(eventId)
      .then((data) => setEvent(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [eventId]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !teamName.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const team = await api.teams.create(eventId, {
        name: teamName.trim(),
        slug: teamSlug.trim() || undefined
      });
      navigate(`/teams/${team.id}`);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to create team. Ensure registration is currently open.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteToken.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await api.teams.acceptInvitation(inviteToken.trim());
      navigate(`/teams/${res.team.id}`);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Invalid or expired invitation token.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading event registration..." />;
  }

  if (!user) {
    return (
      <div className="page-container" style={{ maxWidth: '520px', textAlign: 'center' }}>
        <div className="card" style={{ padding: '36px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Authentication Required</h2>
          <p style={{ color: 'var(--on-surface-variant)', fontSize: '13px', marginBottom: '20px' }}>
            You must be logged in as a participant to register for this event.
          </p>
          <Link to="/login" className="btn btn-primary" style={{ width: '100%' }}>
            Sign In to Continue
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: '580px' }}>
      <div className="card" style={{ padding: '36px', borderRadius: 'var(--radius-xl)' }}>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--primary)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
            Event Registration
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--on-surface)', marginTop: '4px' }}>
            {event?.name || 'Hackathon Registration'}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>
            Form a new team as captain or join an existing crew with an invitation token.
          </p>
        </div>

        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        {/* Mode Selector */}
        <div className="segmented-control" style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', marginBottom: '24px' }}>
          <button
            type="button"
            className={`segmented-item ${mode === 'create' ? 'active' : ''}`}
            onClick={() => setMode('create')}
          >
            Create New Team
          </button>
          <button
            type="button"
            className={`segmented-item ${mode === 'join' ? 'active' : ''}`}
            onClick={() => setMode('join')}
          >
            Join with Invitation
          </button>
        </div>

        {mode === 'create' ? (
          <form onSubmit={handleCreateTeam} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="team-name">
                Team Name *
              </label>
              <input
                id="team-name"
                type="text"
                className="input-text"
                placeholder="e.g. Sentinel Labs"
                value={teamName}
                onChange={(e) => {
                  setTeamName(e.target.value);
                  if (!teamSlug) {
                    setTeamSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''));
                  }
                }}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="team-slug">
                Team Slug (URL Identifier)
              </label>
              <input
                id="team-slug"
                type="text"
                className="input-text"
                placeholder="e.g. sentinel-labs"
                value={teamSlug}
                onChange={(e) => setTeamSlug(e.target.value)}
              />
              <span className="form-sublabel">Must be unique per event.</span>
            </div>

            <button type="submit" disabled={submitting} className="btn btn-primary" style={{ width: '100%', height: '40px', marginTop: '8px' }}>
              {submitting ? 'Registering Team...' : 'Create Team & Enter Event'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoinTeam} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="invite-token">
                Team Invitation Token *
              </label>
              <input
                id="invite-token"
                type="text"
                className="input-text"
                placeholder="Paste the invitation token from your team captain"
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
                required
              />
            </div>

            <button type="submit" disabled={submitting} className="btn btn-primary" style={{ width: '100%', height: '40px', marginTop: '8px' }}>
              {submitting ? 'Validating Token...' : 'Accept Invitation & Join'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
