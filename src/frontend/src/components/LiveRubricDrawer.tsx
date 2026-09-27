import React, { useState, useEffect } from 'react';
import { Rubric, SubmitScoreItem, SubmissionDetail } from '../../../shared/types';
import { api, ApiError } from '../services/api';
import { ErrorBanner } from './ErrorBanner';

interface LiveRubricDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  assignmentId: string;
  submission: SubmissionDetail;
  rubric: Rubric;
  initialScores?: Record<string, { score: number; comment?: string | null }>;
  onScoreSubmitted: () => void;
}

export const LiveRubricDrawer: React.FC<LiveRubricDrawerProps> = ({
  isOpen,
  onClose,
  assignmentId,
  submission,
  rubric,
  initialScores = {},
  onScoreSubmitted
}) => {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const sMap: Record<string, number> = {};
    const cMap: Record<string, string> = {};
    const criteria = rubric.criteria || [];

    for (const crit of criteria) {
      if (initialScores[crit.id]) {
        sMap[crit.id] = initialScores[crit.id].score;
        cMap[crit.id] = initialScores[crit.id].comment || '';
      } else {
        sMap[crit.id] = Math.round(crit.maxScore * 0.8 * 10) / 10;
        cMap[crit.id] = '';
      }
    }
    setScores(sMap);
    setComments(cMap);
  }, [rubric, initialScores]);

  if (!isOpen) return null;

  const criteria = rubric.criteria || [];

  // Calculate live weighted preview
  let totalWeightedScore = 0;
  for (const crit of criteria) {
    const s = scores[crit.id] ?? 0;
    const normalized = crit.maxScore > 0 ? s / crit.maxScore : 0;
    totalWeightedScore += normalized * crit.weight;
  }

  const handleSubmit = async () => {
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);

    try {
      const payload: SubmitScoreItem[] = criteria.map((crit) => ({
        criterionId: crit.id,
        score: scores[crit.id] ?? 0,
        comment: comments[crit.id] || null
      }));

      await api.judging.submitScores(assignmentId, payload);
      setSuccessMsg('Evaluation submitted successfully!');
      setTimeout(() => {
        onScoreSubmitted();
        onClose();
      }, 900);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to submit evaluation');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-pane" onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--outline-border)',
            background: 'var(--surface-elevated)',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '20px' }}>
                grading
              </span>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--on-surface)' }}>
                Live Rubric Evaluation
              </h3>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '2px' }}>
              {submission.title} • {submission.teamName}
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '11px', color: 'var(--outline)', textTransform: 'uppercase', fontWeight: 600 }}>
              Weighted Total
            </span>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)' }} className="tabular-nums">
              {totalWeightedScore.toFixed(1)} <span style={{ fontSize: '12px', color: 'var(--outline)' }}>/ 100</span>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
          {successMsg && (
            <div className="alert alert-success">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>
              <span>{successMsg}</span>
            </div>
          )}

          <div style={{ background: 'var(--surface-low)', padding: '12px 16px', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--on-surface-variant)' }}>
            <strong>Rubric:</strong> {rubric.name} (v{rubric.version}) • Strict judge score isolation is enforced on the server. Peer scores are never visible.
          </div>

          {criteria.map((crit) => {
            const currentScore = scores[crit.id] ?? 0;
            return (
              <div
                key={crit.id}
                style={{
                  background: 'var(--surface-lowest)',
                  border: '1px solid var(--outline-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  boxShadow: 'var(--shadow-card)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--on-surface)' }}>{crit.name}</h4>
                    <p style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '2px' }}>{crit.description}</p>
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      background: 'var(--surface-container)',
                      color: 'var(--primary)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-pill)',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Weight: {crit.weight}%
                  </span>
                </div>

                <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <input
                    type="range"
                    min="0"
                    max={crit.maxScore}
                    step="0.5"
                    value={currentScore}
                    onChange={(e) => setScores({ ...scores, [crit.id]: parseFloat(e.target.value) })}
                    style={{ flex: 1, accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  <div style={{ width: '70px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="number"
                      min="0"
                      max={crit.maxScore}
                      step="0.1"
                      value={currentScore}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) setScores({ ...scores, [crit.id]: val });
                      }}
                      className="input-text"
                      style={{ height: '32px', textAlign: 'center', padding: '0 4px', fontWeight: 600 }}
                    />
                    <span style={{ fontSize: '11px', color: 'var(--outline)' }}>/ {crit.maxScore}</span>
                  </div>
                </div>

                <div style={{ marginTop: '10px' }}>
                  <textarea
                    placeholder="Optional feedback remarks on this criterion..."
                    value={comments[crit.id] || ''}
                    onChange={(e) => setComments({ ...comments, [crit.id]: e.target.value })}
                    className="textarea-input"
                    style={{ minHeight: '50px', fontSize: '12px' }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--outline-border)',
            background: 'var(--surface-low)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting} className="btn btn-primary">
            {submitting ? 'Submitting...' : 'Submit Evaluation'}
          </button>
        </div>
      </div>
    </div>
  );
};
