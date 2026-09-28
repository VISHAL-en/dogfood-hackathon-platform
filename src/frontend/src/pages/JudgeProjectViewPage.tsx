import React, { useEffect, useState } from 'react';
import { useParams, Link } from '../router/Router';
import { JudgeAssignment, Rubric, JudgeScore, SubmissionDetail } from '../../../shared/types';
import { api, ApiError } from '../services/api';
import { LoadingState } from '../components/LoadingState';
import { ErrorBanner } from '../components/ErrorBanner';
import { StatusPill } from '../components/StatusPill';
import { LiveRubricDrawer } from '../components/LiveRubricDrawer';

export const JudgeProjectViewPage: React.FC = () => {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const [assignment, setAssignment] = useState<JudgeAssignment | null>(null);
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [rubric, setRubric] = useState<Rubric | null>(null);
  const [myScores, setMyScores] = useState<JudgeScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);

  const loadData = () => {
    if (!assignmentId) return;
    setLoading(true);
    setError(null);

    api.judging
      .getAssignmentById(assignmentId)
      .then(async (asgn) => {
        setAssignment(asgn);
        // Fetch active rubric for the event, scores, and submission details
        const [activeRubric, scores, subDetail] = await Promise.all([
          api.judging.getActiveRubric(asgn.eventId).catch(() => null),
          api.judging.getMyScores({ assignment: asgn.id }).catch(() => []),
          api.submissions.getById(asgn.submissionId).catch(() => null)
        ]);
        setRubric(activeRubric);
        setMyScores(scores);
        setSubmission(subDetail);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError) setError(err.message);
        else setError('Failed to load assigned project');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, [assignmentId]);

  if (loading) return <LoadingState message="Loading assigned project for evaluation..." />;

  if (error || !assignment) {
    return (
      <div className="page-container">
        <ErrorBanner message={error || 'Assignment not found or unauthorized'} />
        <Link to="/judge" className="btn btn-secondary btn-sm" style={{ marginTop: '16px' }}>
          Back to Judge Dashboard
        </Link>
      </div>
    );
  }

  const sub = submission;
  if (!sub) {
    return (
      <div className="page-container">
        <ErrorBanner message="Submission details could not be loaded for this assignment." />
      </div>
    );
  }

  const initialScoresMap: Record<string, { score: number; comment?: string | null }> = {};
  for (const s of myScores) {
    initialScoresMap[s.criterionId] = { score: s.score, comment: s.comment };
  }

  return (
    <div className="page-container" style={{ maxWidth: '1100px' }}>
      <div style={{ marginBottom: '16px' }}>
        <Link to="/judge" style={{ fontSize: '13px', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
          <span>Back to Arbiter Judge Dashboard</span>
        </Link>
      </div>

      {/* Top Banner Card */}
      <div className="card" style={{ padding: '32px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <StatusPill status={assignment.status} label={assignment.status === 'completed' ? 'Graded' : 'Needs Score'} />
              <span className="hash-pill">{sub.trackName || 'General Track'}</span>
              <span style={{ fontSize: '12px', color: 'var(--outline)' }}>Team: {sub.teamName}</span>
            </div>
            <h1 style={{ fontSize: '30px', fontWeight: 800, color: 'var(--on-surface)', letterSpacing: '-0.02em', marginBottom: '8px' }}>
              {sub.title}
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--on-surface-variant)', maxWidth: '750px', lineHeight: 1.5 }}>
              {sub.shortDescription}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setShowDrawer(true)}
              className="btn btn-primary btn-lg"
              style={{ boxShadow: '0 4px 12px rgba(0, 113, 227, 0.3)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>grading</span>
              <span>{assignment.status === 'completed' ? 'Update Evaluation' : 'Score Project'}</span>
            </button>
          </div>
        </div>

        {/* Demo Links Row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--outline-border)' }}>
          {sub.demoUrl && (
            <a href={sub.demoUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>open_in_new</span>
              <span>Open Live Demo</span>
            </a>
          )}
          {sub.repoUrl && (
            <a href={sub.repoUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>code</span>
              <span>Inspect Repository</span>
            </a>
          )}
          {sub.videoUrl && (
            <a href={sub.videoUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>smart_display</span>
              <span>Video Pitch</span>
            </a>
          )}
        </div>
      </div>

      {/* Two-Column Inspector Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Narrative & Architecture */}
        <div className="card" style={{ padding: '28px' }}>
          <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--on-surface)', marginBottom: '14px' }}>
            Project Narrative & Architecture
          </h2>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: 1.7, color: 'var(--on-surface-variant)' }}>
            {sub.description}
          </div>
        </div>

        {/* Evaluation Summary Card */}
        <div className="card" style={{ padding: '28px' }}>
          <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--on-surface)', marginBottom: '14px' }}>
            Your Score Card
          </h2>

          {assignment.status === 'completed' ? (
            <div>
              <div style={{ marginBottom: '16px', background: 'var(--surface-low)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--outline)', fontWeight: 600 }}>Status</span>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--status-done-fg)', marginTop: '2px' }}>
                  ✓ Completed & Submitted
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {myScores.map((s) => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--outline-border)', paddingBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--on-surface)' }}>Criterion {s.criterionId.replace('crit_', '')}</span>
                    <span style={{ fontSize: '13px', fontWeight: 700 }} className="tabular-nums">{s.score} pts</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setShowDrawer(true)}
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', marginTop: '16px' }}
              >
                Modify Submitted Scores
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '36px', color: 'var(--outline)' }}>
                pending_actions
              </span>
              <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', margin: '10px 0 16px 0' }}>
                You have not submitted scores for this project yet.
              </p>
              <button
                onClick={() => setShowDrawer(true)}
                className="btn btn-primary btn-sm"
                style={{ width: '100%' }}
              >
                Open Scoring Drawer
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Live Rubric Drawer */}
      {rubric && (
        <LiveRubricDrawer
          isOpen={showDrawer}
          onClose={() => setShowDrawer(false)}
          assignmentId={assignment.id}
          submission={sub}
          rubric={rubric}
          initialScores={initialScoresMap}
          onScoreSubmitted={loadData}
        />
      )}
    </div>
  );
};
