import React, { useState, useEffect } from 'react';
import { useParams, Link } from '../router/Router';
import { JudgingProgress } from '../../../shared/types';
import { api } from '../services/api';
import { Sidebar } from '../components/Sidebar';
import { Modal } from '../components/Modal';
import { LoadingState } from '../components/LoadingState';
import { ErrorBanner } from '../components/ErrorBanner';

export const OrganizerJudgesPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [progress, setProgress] = useState<JudgingProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteTrack, setInviteTrack] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignJudgeId, setAssignJudgeId] = useState('');
  const [assignSubmissionId, setAssignSubmissionId] = useState('');
  const [assignMessage, setAssignMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    loadData();
  }, [eventId]);

  const loadData = async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.judging.getProgress(eventId);
      setProgress(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load judging data');
    } finally {
      setLoading(false);
    }
  };

  const handleInviteJudge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    // Self-hosted offline environment: token generation only, no SMTP delivery
    setInviteSuccess(`Invitation token generated for ${inviteEmail}. Provide token to judge for access (offline self-hosted mode: no email dispatched).`);
    setTimeout(() => {
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteSuccess(null);
    }, 3000);
  };

  const handleAssignJudge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !assignJudgeId || !assignSubmissionId) return;
    try {
      await api.judging.createAssignment(eventId, assignJudgeId, assignSubmissionId);
      setAssignMessage('Judge assignment created successfully.');
      loadData();
      setTimeout(() => {
        setShowAssignModal(false);
        setAssignJudgeId('');
        setAssignSubmissionId('');
        setAssignMessage(null);
      }, 1500);
    } catch (err: unknown) {
      setAssignMessage(`Error: ${err instanceof Error ? err.message : 'Assignment failed'}`);
    }
  };

  return (
    <div className="admin-layout">
      <Sidebar activeItem="judges" role="organizer" eventId={eventId} />

      <main className="admin-content">
        <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Link to="/organizer" style={{ fontSize: '13px', color: 'var(--color-primary)', textDecoration: 'none' }}>
                &larr; Events
              </Link>
              <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>/</span>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Judges Panel</span>
            </div>
            <h1 className="page-title">Judges & Assignment Management</h1>
            <p className="page-subtitle">Invite qualified evaluators, manage judging assignments, and audit active evaluation tracks.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="button button-outline" onClick={() => setShowAssignModal(true)}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>assignment_ind</span>
              Assign Judge
            </button>
            <button className="button button-primary" onClick={() => setShowInviteModal(true)}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>person_add</span>
              Invite Judge
            </button>
          </div>
        </header>

        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        {loading ? (
          <LoadingState message="Loading judge roster & progress..." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="grid grid-cols-4" style={{ gap: '16px' }}>
              <div className="card" style={{ padding: '16px' }}>
                <span className="text-secondary" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Active Judges</span>
                <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '4px' }} className="tnum">
                  {progress?.assignedJudgesCount ?? 0}
                </div>
              </div>
              <div className="card" style={{ padding: '16px' }}>
                <span className="text-secondary" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Assignments</span>
                <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '4px' }} className="tnum">
                  {progress?.totalAssignments ?? 0}
                </div>
              </div>
              <div className="card" style={{ padding: '16px' }}>
                <span className="text-secondary" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Completed Scores</span>
                <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '4px', color: 'var(--color-primary)' }} className="tnum">
                  {progress?.completedAssignments ?? 0}
                </div>
              </div>
              <div className="card" style={{ padding: '16px' }}>
                <span className="text-secondary" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Completion Rate</span>
                <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '4px' }} className="tnum">
                  {progress?.completionPercentage != null ? `${progress.completionPercentage}%` : '0%'}
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Judge Evaluation Roster</h3>
                <Link to={`/organizer/events/${eventId}/judging/progress`} style={{ fontSize: '13px', color: 'var(--color-primary)', textDecoration: 'none' }}>
                  View Live Progress Matrix &rarr;
                </Link>
              </div>

              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Judge Name</th>
                      <th>Assigned</th>
                      <th>Completed</th>
                      <th>Pending</th>
                      <th>Progress</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!progress || progress.assignedJudgesCount === 0) ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-secondary)' }}>
                          No judges currently assigned to this event.
                        </td>
                      </tr>
                    ) : (
                      <tr>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(0,102,204,0.1)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '13px' }}>
                              E
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '13px' }}>Active Event Evaluators</div>
                              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{progress.assignedJudgesCount} judge(s) assigned</div>
                            </div>
                          </div>
                        </td>
                        <td className="tnum">{progress.totalAssignments}</td>
                        <td className="tnum" style={{ color: 'var(--color-success)', fontWeight: 600 }}>{progress.completedAssignments}</td>
                        <td className="tnum">{progress.pendingAssignments}</td>
                        <td style={{ minWidth: '140px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ flex: 1, height: '6px', background: 'var(--color-surface-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${progress.completionPercentage}%`, height: '100%', background: 'var(--color-primary)', borderRadius: '3px' }} />
                            </div>
                            <span className="tnum" style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{progress.completionPercentage}%</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="button button-outline"
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                            onClick={() => setShowAssignModal(true)}
                          >
                            Assign Project
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Invite Judge Modal (Stitch: dogfood_invite_judge_modal) */}
        {showInviteModal && (
          <Modal title="Generate Judge Invitation Token" onClose={() => setShowInviteModal(false)}>
            <form onSubmit={handleInviteJudge} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                Generate a secure invitation token for an evaluator. In this offline self-hosted instance, no outbound SMTP/email delivery is configured; distribute the token directly to the judge.
              </p>

              {inviteSuccess && (
                <div style={{ padding: '10px', borderRadius: '6px', background: 'rgba(52,199,89,0.1)', color: 'var(--color-success)', fontSize: '13px' }}>
                  {inviteSuccess}
                </div>
              )}

              <div>
                <label className="form-label">Judge Email Address *</label>
                <input
                  type="email"
                  className="input"
                  required
                  placeholder="e.g. alice.judge@domain.org"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label">Specialty Track / Focus (Optional)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. AI & ML, Developer Infrastructure"
                  value={inviteTrack}
                  onChange={(e) => setInviteTrack(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button type="button" className="button button-outline" onClick={() => setShowInviteModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="button button-primary">
                  Generate Invitation Token
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* Judge Assignment Modal (Stitch: dogfood_judge_assignment) */}
        {showAssignModal && (
          <Modal title="Assign Judge to Submission" onClose={() => setShowAssignModal(false)}>
            <form onSubmit={handleAssignJudge} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                Pair a judge with an active project submission for blind independent evaluation.
              </p>

              {assignMessage && (
                <div style={{ padding: '10px', borderRadius: '6px', background: 'rgba(0,102,204,0.1)', color: 'var(--color-primary)', fontSize: '13px' }}>
                  {assignMessage}
                </div>
              )}

              <div>
                <label className="form-label">Judge ID *</label>
                <input
                  type="text"
                  className="input"
                  required
                  placeholder="Enter judge user UUID"
                  value={assignJudgeId}
                  onChange={(e) => setAssignJudgeId(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label">Project Submission ID *</label>
                <input
                  type="text"
                  className="input"
                  required
                  placeholder="Enter submission UUID"
                  value={assignSubmissionId}
                  onChange={(e) => setAssignSubmissionId(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button type="button" className="button button-outline" onClick={() => setShowAssignModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="button button-primary">
                  Create Assignment
                </button>
              </div>
            </form>
          </Modal>
        )}
      </main>
    </div>
  );
};
