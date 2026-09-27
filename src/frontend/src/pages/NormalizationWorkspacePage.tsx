import React, { useEffect, useState } from 'react';
import { useParams, Link } from '../router/Router';
import { NormalizationRun, NormalizationResult, NormalizedSubmissionScore } from '../../../shared/types';
import { api, ApiError } from '../services/api';
import { LoadingState } from '../components/LoadingState';
import { ErrorBanner } from '../components/ErrorBanner';
import { StatusPill } from '../components/StatusPill';

export const NormalizationWorkspacePage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [runs, setRuns] = useState<NormalizationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Selected run for live results inspection
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [results, setResults] = useState<NormalizationResult[]>([]);
  const [subScores, setSubScores] = useState<NormalizedSubmissionScore[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);

  const loadRuns = () => {
    if (!eventId) return;
    setLoading(true);
    api.normalization
      .listRuns(eventId)
      .then((data) => {
        setRuns(data);
        if (data.length > 0 && !selectedRunId) {
          setSelectedRunId(data[0].id);
        }
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError) setError(err.message);
        else setError('Failed to load normalization runs');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRuns();
  }, [eventId]);

  useEffect(() => {
    if (!eventId || !selectedRunId) return;
    setResultsLoading(true);
    api.normalization
      .getResults(eventId, selectedRunId)
      .then((data) => {
        setResults(data.results);
        setSubScores(data.submissionScores);
      })
      .catch(() => {
        setResults([]);
        setSubScores([]);
      })
      .finally(() => {
        setResultsLoading(false);
      });
  }, [eventId, selectedRunId]);

  const handleExecuteNormalization = async () => {
    if (!eventId) return;
    setRunning(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await api.normalization.createRun(eventId);
      setSuccessMsg(`Normalization run ${res.id} completed successfully with ${res.inputScoreCount} scores.`);
      loadRuns();
      setSelectedRunId(res.id);
    } catch (err: unknown) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Normalization run failed. Verify that an active rubric exists and assignments are completed.');
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <LoadingState message="Loading normalization engine workspace..." />;

  return (
    <div className="page-container" style={{ maxWidth: '1300px' }}>
      <div style={{ marginBottom: '16px' }}>
        <Link to="/organizer" style={{ fontSize: '13px', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
          <span>Back to Organizer Console</span>
        </Link>
      </div>

      {/* Header Card */}
      <div className="card" style={{ padding: '32px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className="instance-badge">
                <span className="orb"></span>
                <span>Deterministic Engine • zscore-population-v1</span>
              </span>
              <span style={{ fontSize: '12px', color: 'var(--outline)' }}>•</span>
              <span className="hash-pill">{eventId}</span>
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>
              Cross-Judge Normalization Workspace
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', maxWidth: '780px', marginTop: '4px' }}>
              Normalizes raw jury scores using deterministic population z-scores ($\mu, \sigma$) and rubric weights.
              Raw scores are strictly immutable; each run generates a cryptographic SHA-256 proof hash.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleExecuteNormalization}
              disabled={running}
              className="btn btn-primary btn-lg"
              style={{ boxShadow: '0 4px 12px rgba(0, 113, 227, 0.3)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>play_circle</span>
              <span>{running ? 'Calculating Population Statistics...' : 'Run Normalization'}</span>
            </button>
          </div>
        </div>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      {successMsg && (
        <div className="alert alert-success">
          <span className="material-symbols-outlined">check_circle</span>
          <span>{successMsg}</span>
        </div>
      )}

      {/* Normalization Runs Table */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--on-surface)' }}>
            Execution History ({runs.length} Runs)
          </h2>
          <span style={{ fontSize: '12px', color: 'var(--outline)' }}>
            Re-runs create new immutable records • Previous runs are permanently preserved
          </span>
        </div>

        {runs.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '36px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '36px', color: 'var(--outline)' }}>
              functions
            </span>
            <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', marginTop: '8px' }}>
              No normalization runs executed yet for this event. Click <strong>Run Normalization</strong> above to start.
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Run Identifier</th>
                  <th>Algorithm</th>
                  <th>Inputs</th>
                  <th>SHA-256 Proof Hash</th>
                  <th>Completed At</th>
                  <th style={{ textAlign: 'right' }}>Audit Actions</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => {
                  const isSelected = r.id === selectedRunId;
                  return (
                    <tr
                      key={r.id}
                      style={{ background: isSelected ? 'var(--canvas-subtle)' : undefined }}
                    >
                      <td>
                        <StatusPill status={r.status} />
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                          {r.id}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '11px', background: 'var(--surface-container)', padding: '2px 6px', borderRadius: 'var(--radius-xs)', fontFamily: 'var(--font-mono)' }}>
                          {r.methodVersion}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: '12px' }} className="tabular-nums">
                          <strong>{r.inputScoreCount}</strong> scores • {r.judgeCount} judges • {r.submissionCount} projects
                        </div>
                      </td>
                      <td>
                        {r.proofHash ? (
                          <span className="hash-pill" style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }} title={r.proofHash}>
                            {r.proofHash.substring(0, 16)}...
                          </span>
                        ) : (
                          <span style={{ color: 'var(--outline)', fontSize: '11px' }}>Pending</span>
                        )}
                      </td>
                      <td className="tabular-nums" style={{ fontSize: '12px', color: 'var(--outline)' }}>
                        {r.completedAt ? new Date(r.completedAt).toLocaleTimeString() : 'Running'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          <button
                            onClick={() => setSelectedRunId(r.id)}
                            className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                          >
                            <span>Inspect Scores</span>
                          </button>
                          <Link
                            to={`/organizer/events/${r.eventId}/judging/normalization/${r.id}`}
                            className="btn btn-secondary btn-sm"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>verified</span>
                            <span>Proof Audit</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selected Run Project Standings & Scores Table */}
      {selectedRunId && (
        <div className="card" style={{ padding: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--outline)', fontWeight: 600 }}>
                Derived Analytical Scores
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--on-surface)' }}>
                Normalized Standings for Run {selectedRunId}
              </h3>
            </div>

            <Link
              to={`/organizer/events/${eventId}/judging/normalization/${selectedRunId}`}
              className="btn btn-primary btn-sm"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>verified</span>
              <span>Cryptographic Proof View</span>
            </Link>
          </div>

          {resultsLoading ? (
            <LoadingState message="Calculating normalized results view..." />
          ) : subScores.length === 0 ? (
            <p style={{ color: 'var(--outline)', fontSize: '13px' }}>No evaluated project scores available for this run.</p>
          ) : (
            <div>
              <div className="table-container" style={{ marginBottom: '24px' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Submission ID</th>
                      <th>Aggregate Z-Score</th>
                      <th>0–100 Presentation Score</th>
                      <th>Eligible Judges</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subScores.map((s, idx) => (
                      <tr key={s.id}>
                        <td>
                          <span
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              background: idx === 0 ? 'var(--primary-container)' : 'var(--surface-container)',
                              color: idx === 0 ? 'var(--on-primary-container)' : 'var(--on-surface)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '11px'
                            }}
                          >
                            {idx + 1}
                          </span>
                        </td>
                        <td>
                          <strong style={{ fontFamily: 'var(--font-mono)' }}>{s.submissionId}</strong>
                        </td>
                        <td className="tabular-nums" style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600 }}>
                          {s.aggregateZ >= 0 ? `+${s.aggregateZ.toFixed(4)}` : s.aggregateZ.toFixed(4)}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--primary)' }} className="tabular-nums">
                              {s.presentationScore.toFixed(2)}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--outline)' }}>/ 100</span>
                          </div>
                        </td>
                        <td>
                          <span className="tabular-nums" style={{ fontSize: '12px' }}>{s.judgeCount} Jury Members</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Detailed Breakdown of Individual Normalized Criteria */}
              <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--on-surface)', marginBottom: '12px' }}>
                Criterion Normalization Detail (Sample Results)
              </h4>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Judge ID</th>
                      <th>Submission ID</th>
                      <th>Raw Score</th>
                      <th>Judge $\mu$</th>
                      <th>Judge $\sigma$</th>
                      <th>Z-Score</th>
                      <th>Weight</th>
                      <th>Weighted Contribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.slice(0, 8).map((r) => (
                      <tr key={r.id}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{r.judgeId}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{r.submissionId}</td>
                        <td className="tabular-nums" style={{ fontWeight: 600 }}>{r.rawScore}</td>
                        <td className="tabular-nums">{r.judgeMean.toFixed(2)}</td>
                        <td className="tabular-nums">{r.judgeStddev.toFixed(2)}</td>
                        <td className="tabular-nums" style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          {r.zScore >= 0 ? `+${r.zScore.toFixed(4)}` : r.zScore.toFixed(4)}
                        </td>
                        <td className="tabular-nums">{r.criterionWeight}%</td>
                        <td className="tabular-nums" style={{ color: 'var(--primary)', fontWeight: 700 }}>
                          {r.weightedNormalizedScore >= 0 ? `+${r.weightedNormalizedScore.toFixed(4)}` : r.weightedNormalizedScore.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
