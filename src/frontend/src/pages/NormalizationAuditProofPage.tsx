import React, { useEffect, useState } from 'react';
import { useParams, Link } from '../router/Router';
import { NormalizationRunDetail, NormalizationVerificationResult } from '../../../shared/types';
import { api, ApiError } from '../services/api';
import { LoadingState } from '../components/LoadingState';
import { ErrorBanner } from '../components/ErrorBanner';

export const NormalizationAuditProofPage: React.FC = () => {
  const { eventId, runId } = useParams<{ eventId: string; runId: string }>();
  const [run, setRun] = useState<NormalizationRunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<NormalizationVerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId || !runId) return;
    setLoading(true);
    api.normalization
      .getRunDetail(eventId, runId)
      .then((data) => {
        setRun(data);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError) setError(err.message);
        else setError('Failed to load audit proof data');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [eventId, runId]);

  const handleVerifyProof = async () => {
    if (!eventId || !runId) return;
    setVerifying(true);
    try {
      const res = await api.normalization.verifyProof(eventId, runId);
      setVerificationResult(res);
    } catch (err: unknown) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Proof verification failed');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) return <LoadingState message="Loading cryptographic audit proof..." />;

  if (error || !run) {
    return (
      <div className="page-container">
        <ErrorBanner message={error || 'Normalization run proof not found'} />
        <Link to={`/organizer/events/${eventId}/judging/normalization`} className="btn btn-secondary btn-sm" style={{ marginTop: '16px' }}>
          Back to Normalization Workspace
        </Link>
      </div>
    );
  }

  const proof = run.proofMetadata;

  return (
    <div className="page-container" style={{ maxWidth: '1100px' }}>
      <div style={{ marginBottom: '16px' }}>
        <Link to={`/organizer/events/${eventId}/judging/normalization`} style={{ fontSize: '13px', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
          <span>Back to Normalization Workspace</span>
        </Link>
      </div>

      {/* Header Card */}
      <div className="card" style={{ padding: '32px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className="instance-badge">
                <span className="orb"></span>
                <span>SHA-256 Proof Record</span>
              </span>
              <span className="hash-pill">{run.id}</span>
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>
              Normalization Audit & Proof Verification
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', marginTop: '4px', maxWidth: '750px' }}>
              Cryptographic evidence proving that normalized scores were derived deterministically from eligible judge evaluations.
              Reconstructs canonical JSON and recomputes the SHA-256 digest on demand.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleVerifyProof}
              disabled={verifying}
              className="btn btn-primary"
              style={{ boxShadow: '0 4px 12px rgba(0, 113, 227, 0.3)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>verified</span>
              <span>{verifying ? 'Recomputing Digest...' : 'Verify Canonical Proof'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Verification Result Banner */}
      {verificationResult && (
        <div
          className={`alert ${verificationResult.verified ? 'alert-success' : 'alert-error'}`}
          style={{ marginBottom: '24px', padding: '16px 20px' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>
            {verificationResult.verified ? 'verified_user' : 'gpp_bad'}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '14px' }}>
              {verificationResult.verified
                ? 'Cryptographic Proof Integrity Verified (100% Match)'
                : 'Proof Integrity Check FAILED — Stored Digest Does Not Match Calculated Hash'}
            </div>
            <div style={{ fontSize: '12px', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
              Stored Hash: {verificationResult.stored_hash}
            </div>
            <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
              Calculated Hash: {verificationResult.calculated_hash}
            </div>
          </div>
        </div>
      )}

      {/* SHA-256 Digest Card */}
      <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '14px', textTransform: 'uppercase', color: 'var(--outline)', fontWeight: 700, marginBottom: '8px' }}>
          SHA-256 Canonical Proof Hash
        </h3>
        <div className="code-box" style={{ padding: '14px', fontSize: '13px', fontWeight: 700, color: 'var(--primary)' }}>
          {run.proofHash || 'Pending calculation'}
        </div>
        <p style={{ fontSize: '11px', color: 'var(--outline)', marginTop: '8px' }}>
          Generated via SHA-256 over deterministic lexicographically-sorted JSON with fixed 8-decimal precision representation.
        </p>
      </div>

      {/* Population & Exclusion Evidence Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '18px' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--outline)', fontWeight: 600 }}>Eligible Scores</span>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--on-surface)', marginTop: '4px' }} className="tabular-nums">
            {run.inputScoreCount}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>Processed in run</div>
        </div>

        <div className="card" style={{ padding: '18px' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--outline)', fontWeight: 600 }}>Active Judges</span>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--on-surface)', marginTop: '4px' }} className="tabular-nums">
            {run.judgeCount}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>Jury members</div>
        </div>

        <div className="card" style={{ padding: '18px' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--outline)', fontWeight: 600 }}>Submissions</span>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--on-surface)', marginTop: '4px' }} className="tabular-nums">
            {run.submissionCount}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>Evaluated projects</div>
        </div>

        <div className="card" style={{ padding: '18px' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--outline)', fontWeight: 600 }}>Incomplete Excluded</span>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--status-judge-fg)', marginTop: '4px' }} className="tabular-nums">
            {proof?.excludedIncompleteAssignmentCount ?? 0}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>Assignments omitted</div>
        </div>

        <div className="card" style={{ padding: '18px' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--outline)', fontWeight: 600 }}>Zero-Variance Cases</span>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }} className="tabular-nums">
            {proof?.zeroVarianceCount ?? 0}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>Fallback z=0 applied</div>
        </div>
      </div>

      {/* Per Judge & Criterion Population Statistics Matrix */}
      {proof?.judgeCriterionStats && proof.judgeCriterionStats.length > 0 && (
        <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--on-surface)' }}>
                Per-Judge / Per-Criterion Population Parameters ($\mu, \sigma$)
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '2px' }}>
                Sorted deterministically by <code>judgeId ASC, criterionId ASC</code>.
              </p>
            </div>
            <span className="hash-pill">Algorithm: {proof.methodVersion}</span>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Judge Identifier</th>
                  <th>Criterion ID</th>
                  <th>Count ($N$)</th>
                  <th>Population Mean ($\mu$)</th>
                  <th>Population Stddev ($\sigma$)</th>
                  <th>Zero-Variance Fallback</th>
                </tr>
              </thead>
              <tbody>
                {proof.judgeCriterionStats.map((stat, idx) => (
                  <tr key={idx}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{stat.judgeId}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{stat.criterionId}</td>
                    <td className="tabular-nums">{stat.count}</td>
                    <td className="tabular-nums" style={{ fontWeight: 600 }}>{stat.mean.toFixed(4)}</td>
                    <td className="tabular-nums" style={{ fontWeight: 600 }}>{stat.populationStddev.toFixed(4)}</td>
                    <td>
                      {stat.zeroVariance ? (
                        <span style={{ fontSize: '11px', background: 'rgba(217, 119, 6, 0.1)', color: '#d97706', padding: '2px 8px', borderRadius: 'var(--radius-pill)', fontWeight: 600 }}>
                          Yes ($z=0$ applied)
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--outline)' }}>No ($\sigma &gt; 0$)</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Raw Canonical Proof Payload Inspector */}
      {run.metadataJson && (
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '14px', textTransform: 'uppercase', color: 'var(--outline)', fontWeight: 700, marginBottom: '8px' }}>
            Canonical Proof Evidence Payload
          </h3>
          <pre className="code-box" style={{ maxHeight: '240px', overflowY: 'auto' }}>
            {JSON.stringify(JSON.parse(run.metadataJson), null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
