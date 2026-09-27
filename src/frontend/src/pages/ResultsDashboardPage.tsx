import React, { useEffect, useState } from 'react';
import { useParams, Link } from '../router/Router';
import { NormalizationRun, NormalizedSubmissionScore } from '../../../shared/types';
import { api } from '../services/api';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';

export const ResultsDashboardPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [runs, setRuns] = useState<NormalizationRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [subScores, setSubScores] = useState<NormalizedSubmissionScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If no eventId in route, pick default event_dogfood_2026 or list
    const targetEvent = eventId || 'event_dogfood_2026';
    setLoading(true);

    api.normalization
      .listRuns(targetEvent)
      .then((data) => {
        setRuns(data);
        const completed = data.find((r) => r.status === 'completed');
        if (completed) {
          setSelectedRunId(completed.id);
          return api.normalization.getResults(targetEvent, completed.id);
        }
        return null;
      })
      .then((res) => {
        if (res) {
          setSubScores(res.submissionScores);
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
      });
  }, [eventId]);

  const handleSelectRun = async (rId: string) => {
    setSelectedRunId(rId);
    const targetEvent = eventId || 'event_dogfood_2026';
    try {
      const res = await api.normalization.getResults(targetEvent, rId);
      setSubScores(res.submissionScores);
    } catch {
      setSubScores([]);
    }
  };

  if (loading) return <LoadingState message="Loading normalized evaluation results..." />;

  return (
    <div className="page-container" style={{ maxWidth: '1100px' }}>
      <div className="card" style={{ padding: '32px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className="instance-badge">
                <span className="orb"></span>
                <span>Deterministic Jury Results</span>
              </span>
              <span className="hash-pill">{eventId || 'event_dogfood_2026'}</span>
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>
              Evaluation Results & Normalized Leaderboard
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', marginTop: '4px', maxWidth: '750px' }}>
              Leaderboard generated strictly through deterministic population z-score normalization.
              Raw scores are permanently immutable.
            </p>
          </div>

          {runs.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '12px', color: 'var(--outline)', fontWeight: 600 }}>Run:</span>
              <select
                className="select-input"
                value={selectedRunId || ''}
                onChange={(e) => handleSelectRun(e.target.value)}
                style={{ width: '220px' }}
              >
                {runs.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id} ({new Date(r.createdAt).toLocaleTimeString()})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {subScores.length === 0 ? (
        <EmptyState
          icon="leaderboard"
          title="No finalized normalized results available"
          description="Standings will appear once an organizer executes a cross-judge normalization run."
          action={
            <Link to={`/organizer/events/${eventId || 'event_dogfood_2026'}/judging/normalization`} className="btn btn-primary btn-sm">
              Open Normalization Console
            </Link>
          }
        />
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>Rank</th>
                <th>Project Submission</th>
                <th>Aggregate Z-Score</th>
                <th>Normalized 0–100 Score</th>
                <th>Jury Count</th>
                <th style={{ textAlign: 'right' }}>Gallery</th>
              </tr>
            </thead>
            <tbody>
              {subScores.map((s, idx) => (
                <tr key={s.id}>
                  <td>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: idx === 0 ? '#ffd700' : idx === 1 ? '#c0c0c0' : idx === 2 ? '#cd7f32' : 'var(--surface-container)',
                        color: idx < 3 ? '#000' : 'var(--on-surface)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '12px'
                      }}
                      className="tabular-nums"
                    >
                      {idx + 1}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, fontSize: '14px', fontFamily: 'var(--font-mono)' }}>
                      {s.submissionId}
                    </span>
                  </td>
                  <td className="tabular-nums" style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {s.aggregateZ >= 0 ? `+${s.aggregateZ.toFixed(4)}` : s.aggregateZ.toFixed(4)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--primary)' }} className="tabular-nums">
                        {s.presentationScore.toFixed(2)}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--outline)' }}>/ 100</span>
                    </div>
                  </td>
                  <td className="tabular-nums" style={{ fontSize: '12px', color: 'var(--outline)' }}>
                    {s.judgeCount} Judges
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Link to="/gallery" className="btn btn-ghost btn-sm">
                      View Demo
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
