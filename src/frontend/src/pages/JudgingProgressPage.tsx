import React, { useEffect, useState } from 'react';
import { useParams, Link } from '../router/Router';
import { JudgingProgress } from '../../../shared/types';
import { api, ApiError } from '../services/api';
import { LoadingState } from '../components/LoadingState';
import { ErrorBanner } from '../components/ErrorBanner';

export const JudgingProgressPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [progress, setProgress] = useState<JudgingProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    api.judging
      .getProgress(eventId)
      .then((data) => {
        setProgress(data);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError) setError(err.message);
        else setError('Failed to load judging progress');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [eventId]);

  if (loading) return <LoadingState message="Loading judging progress..." />;

  return (
    <div className="page-container" style={{ maxWidth: '1000px' }}>
      <div style={{ marginBottom: '16px' }}>
        <Link to="/organizer" style={{ fontSize: '13px', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
          <span>Back to Organizer Console</span>
        </Link>
      </div>

      {/* Header Card */}
      <div className="card" style={{ padding: '32px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className="instance-badge">
                <span className="orb"></span>
                <span>Real-Time Evaluation Monitor</span>
              </span>
              <span className="hash-pill">{eventId}</span>
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--on-surface)' }}>
              Judging Progress & Turnout
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>
              Aggregate metrics across all assigned jury members. Peer scores remain strictly isolated.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <a href={`/exports/scores.csv?eventId=${eventId}`} target="_blank" rel="noreferrer" className="btn btn-secondary">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>download</span>
              <span>Export Scores CSV</span>
            </a>
            <Link to={`/organizer/events/${eventId}/judging/normalization`} className="btn btn-primary">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>functions</span>
              <span>Open Normalization</span>
            </Link>
          </div>
        </div>

        {/* Progress Bar Strip */}
        {progress && (
          <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--outline-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--on-surface)' }}>
                Overall Completion ({progress.completedAssignments} / {progress.totalAssignments} Evaluations)
              </span>
              <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--primary)' }} className="tabular-nums">
                {progress.completionPercentage.toFixed(1)}%
              </span>
            </div>

            <div style={{ width: '100%', height: '10px', background: 'var(--surface-container)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${progress.completionPercentage}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--primary) 0%, #316bf3 100%)',
                  borderRadius: 'var(--radius-pill)',
                  transition: 'width 0.4s ease'
                }}
              />
            </div>
          </div>
        )}
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Progress Metrics Cards */}
      {progress && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
          <div className="card" style={{ padding: '24px' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--outline)', fontWeight: 600 }}>Active Judges</span>
            <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--on-surface)', marginTop: '4px' }} className="tabular-nums">
              {progress.assignedJudgesCount}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>Distinct jury evaluators</div>
          </div>

          <div className="card" style={{ padding: '24px' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--outline)', fontWeight: 600 }}>Projects Assigned</span>
            <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--on-surface)', marginTop: '4px' }} className="tabular-nums">
              {progress.assignedSubmissionsCount}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>Submissions in jury pool</div>
          </div>

          <div className="card" style={{ padding: '24px' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--status-done-fg)', fontWeight: 600 }}>Graded Assignments</span>
            <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--status-done-fg)', marginTop: '4px' }} className="tabular-nums">
              {progress.completedAssignments}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>Complete rubric records</div>
          </div>

          <div className="card" style={{ padding: '24px' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--status-judge-fg)', fontWeight: 600 }}>Pending Assignments</span>
            <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--status-judge-fg)', marginTop: '4px' }} className="tabular-nums">
              {progress.pendingAssignments}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>Awaiting jury completion</div>
          </div>
        </div>
      )}
    </div>
  );
};
