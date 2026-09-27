import React, { useEffect, useState } from 'react';
import { useParams, Link } from '../router/Router';
import { EventWithDetails, Rubric, EventTrack, EventPrize } from '../../../shared/types';
import { api, ApiError } from '../services/api';
import { LoadingState } from '../components/LoadingState';
import { ErrorBanner } from '../components/ErrorBanner';
import { StatusPill } from '../components/StatusPill';

export const EventSettingsPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventWithDetails | null>(null);
  const [rubric, setRubric] = useState<Rubric | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Track form
  const [newTrackName, setNewTrackName] = useState('');
  const [newTrackDesc, setNewTrackDesc] = useState('');

  // Prize form
  const [newPrizeName, setNewPrizeName] = useState('');
  const [newPrizeDesc, setNewPrizeDesc] = useState('');
  const [newPrizeAmount, setNewPrizeAmount] = useState(5000);

  const loadData = () => {
    if (!eventId) return;
    setLoading(true);
    Promise.all([
      api.events.getByIdOrSlug(eventId),
      api.judging.getActiveRubric(eventId).catch(() => null)
    ])
      .then(([evData, rubData]) => {
        setEvent(evData);
        setRubric(rubData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [eventId]);

  const handleAddTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !newTrackName.trim()) return;
    try {
      await api.events.addTrack(eventId, { name: newTrackName.trim(), description: newTrackDesc.trim() });
      setNewTrackName('');
      setNewTrackDesc('');
      setSuccessMsg('Track added successfully');
      loadData();
    } catch (err: unknown) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to add track');
    }
  };

  const handleAddPrize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !newPrizeName.trim()) return;
    try {
      await api.events.addPrize(eventId, { name: newPrizeName.trim(), description: newPrizeDesc.trim(), amount: newPrizeAmount });
      setNewPrizeName('');
      setNewPrizeDesc('');
      setSuccessMsg('Prize added successfully');
      loadData();
    } catch (err: unknown) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to add prize');
    }
  };

  if (loading) return <LoadingState message="Loading event settings and rubric..." />;

  if (!event) {
    return (
      <div className="page-container">
        <ErrorBanner message={error || 'Event not found'} />
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: '1000px' }}>
      <div style={{ marginBottom: '16px' }}>
        <Link to="/organizer" style={{ fontSize: '13px', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
          <span>Back to Organizer Console</span>
        </Link>
      </div>

      <div className="card" style={{ padding: '32px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--on-surface)' }}>
            Event Configuration: {event.name}
          </h1>
          <StatusPill status={event.status} />
        </div>
        <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)' }}>
          Manage evaluation rubrics, competition tracks, and monetary awards.
        </p>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      {successMsg && (
        <div className="alert alert-success">
          <span className="material-symbols-outlined">check_circle</span>
          <span>{successMsg}</span>
        </div>
      )}

      {/* Rubric Configuration Section */}
      <div className="card" style={{ padding: '28px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--on-surface)' }}>
              Active Weighted Rubric
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--on-surface-variant)' }}>
              Authoritative criteria used for scoring and cross-judge normalization. Total weights must sum to 100.
            </p>
          </div>
          {rubric && (
            <span style={{ fontSize: '12px', background: 'var(--status-done-bg)', color: 'var(--status-done-fg)', padding: '3px 10px', borderRadius: 'var(--radius-pill)', fontWeight: 600 }}>
              ✓ Locked & Active (v{rubric.version})
            </span>
          )}
        </div>

        {rubric ? (
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--on-surface)', marginBottom: '12px' }}>
              {rubric.name}
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Position</th>
                    <th>Criterion Name</th>
                    <th>Weight (%)</th>
                    <th>Max Score</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {(rubric.criteria || []).map((c) => (
                    <tr key={c.id}>
                      <td className="tabular-nums">#{c.position}</td>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td>
                        <strong className="tabular-nums" style={{ color: 'var(--primary)' }}>{c.weight}%</strong>
                      </td>
                      <td className="tabular-nums">{c.maxScore} pts</td>
                      <td style={{ fontSize: '12px', color: 'var(--on-surface-variant)' }}>{c.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p style={{ color: 'var(--outline)', fontSize: '13px' }}>
            No active rubric configured for this event. Use the CLI or judging service to seed default criteria.
          </p>
        )}
      </div>

      {/* Tracks & Prizes Dual Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Tracks Card */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--on-surface)', marginBottom: '12px' }}>
            Add Competition Track
          </h3>
          <form onSubmit={handleAddTrack} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="text"
              className="input-text"
              placeholder="Track Name (e.g. AI Agents)"
              value={newTrackName}
              onChange={(e) => setNewTrackName(e.target.value)}
              required
            />
            <textarea
              className="textarea-input"
              placeholder="Track requirements..."
              value={newTrackDesc}
              onChange={(e) => setNewTrackDesc(e.target.value)}
              style={{ minHeight: '60px' }}
            />
            <button type="submit" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-end' }}>
              Add Track
            </button>
          </form>

          <div style={{ marginTop: '16px', borderTop: '1px solid var(--outline-border)', paddingTop: '12px' }}>
            <span style={{ fontSize: '11px', color: 'var(--outline)', textTransform: 'uppercase', fontWeight: 600 }}>Existing Tracks ({event.tracks.length})</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
              {event.tracks.map((t: EventTrack) => (
                <div key={t.id} style={{ fontSize: '12px', background: 'var(--surface-low)', padding: '6px 10px', borderRadius: 'var(--radius-sm)' }}>
                  <strong>{t.name}</strong> • <span style={{ color: 'var(--outline)' }}>{t.slug}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Prizes Card */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--on-surface)', marginBottom: '12px' }}>
            Add Award / Prize
          </h3>
          <form onSubmit={handleAddPrize} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="text"
              className="input-text"
              placeholder="Prize Name (e.g. Grand Champion)"
              value={newPrizeName}
              onChange={(e) => setNewPrizeName(e.target.value)}
              required
            />
            <input
              type="number"
              className="input-text"
              placeholder="Amount USD"
              value={newPrizeAmount}
              onChange={(e) => setNewPrizeAmount(parseInt(e.target.value) || 0)}
              required
            />
            <textarea
              className="textarea-input"
              placeholder="Award criteria..."
              value={newPrizeDesc}
              onChange={(e) => setNewPrizeDesc(e.target.value)}
              style={{ minHeight: '60px' }}
            />
            <button type="submit" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-end' }}>
              Add Prize
            </button>
          </form>

          <div style={{ marginTop: '16px', borderTop: '1px solid var(--outline-border)', paddingTop: '12px' }}>
            <span style={{ fontSize: '11px', color: 'var(--outline)', textTransform: 'uppercase', fontWeight: 600 }}>Declared Awards ({event.prizes.length})</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
              {event.prizes.map((p: EventPrize) => (
                <div key={p.id} style={{ fontSize: '12px', background: 'var(--surface-low)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between' }}>
                  <span><strong>{p.name}</strong></span>
                  <span style={{ fontWeight: 700, color: '#d97706' }}>${p.amount.toLocaleString()} {p.currency}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
