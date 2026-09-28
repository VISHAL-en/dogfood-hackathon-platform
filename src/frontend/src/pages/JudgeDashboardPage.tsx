import React, { useEffect, useState } from 'react';
import { Link } from '../router/Router';
import { JudgeAssignment } from '../../../shared/types';
import { api, ApiError } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { StatusPill } from '../components/StatusPill';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';

export const JudgeDashboardPage: React.FC = () => {
  const [assignments, setAssignments] = useState<JudgeAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();

  useEffect(() => {
    setLoading(true);
    api.judging
      .getMyAssignments()
      .then((data) => {
        setAssignments(data);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Failed to load judge assignments');
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) return <LoadingState message="Loading your assigned submissions..." />;

  const completedCount = assignments.filter((a) => a.status === 'completed').length;
  const pendingCount = assignments.length - completedCount;

  return (
    <div className="page-container">
      {/* Top Header Card */}
      <div className="card" style={{ marginBottom: '28px', padding: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className="instance-badge">
                <span className="orb"></span>
                <span>Arbiter Jury Session</span>
              </span>
              <span style={{ fontSize: '12px', color: 'var(--outline)' }}>•</span>
              <span style={{ fontSize: '12px', color: 'var(--on-surface-variant)' }}>Judge: {user?.name}</span>
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--on-surface)' }}>
              Arbiter Judge Workspace
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>
              Strict backend score isolation active. Peer scores and evaluations from other jury members are strictly isolated and hidden.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ textAlign: 'center', padding: '10px 16px', background: 'var(--surface-low)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--on-surface)' }} className="tabular-nums">
                {assignments.length}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--outline)', textTransform: 'uppercase', fontWeight: 600 }}>Total Assigned</div>
            </div>
            <div style={{ textAlign: 'center', padding: '10px 16px', background: 'var(--surface-low)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--status-done-fg)' }} className="tabular-nums">
                {completedCount}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--outline)', textTransform: 'uppercase', fontWeight: 600 }}>Completed</div>
            </div>
            <div style={{ textAlign: 'center', padding: '10px 16px', background: 'var(--surface-low)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--status-judge-fg)' }} className="tabular-nums">
                {pendingCount}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--outline)', textTransform: 'uppercase', fontWeight: 600 }}>Pending</div>
            </div>
          </div>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Assignments Table */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--on-surface)', marginBottom: '16px' }}>
          Assigned Projects for Review ({assignments.length})
        </h2>

        {assignments.length === 0 ? (
          <EmptyState
            icon="task_alt"
            title="No assignments queued"
            description="You currently have no project submissions assigned for evaluation. Organizers assign submissions during the active judging window."
          />
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Submission / Project</th>
                  <th>Event</th>
                  <th>Assigned Date</th>
                  <th style={{ textAlign: 'right' }}>Evaluation Action</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((asgn) => (
                  <tr key={asgn.id}>
                    <td>
                      <StatusPill status={asgn.status} label={asgn.status === 'completed' ? 'Graded' : 'Needs Score'} />
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--on-surface)' }}>
                        {asgn.submissionTitle || asgn.submissionId}
                      </div>
                      {asgn.teamName && (
                        <div style={{ fontSize: '12px', color: 'var(--outline)' }}>
                          Team: {asgn.teamName}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="hash-pill">{asgn.eventName || asgn.eventId}</span>
                    </td>
                    <td className="tabular-nums" style={{ fontSize: '12px', color: 'var(--outline)' }}>
                      {new Date(asgn.assignedAt).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link
                        to={`/judge/assignments/${asgn.id}`}
                        className={`btn btn-sm ${asgn.status === 'completed' ? 'btn-secondary' : 'btn-primary'}`}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                          {asgn.status === 'completed' ? 'visibility' : 'rate_review'}
                        </span>
                        <span>{asgn.status === 'completed' ? 'Review Score' : 'Evaluate Project'}</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
