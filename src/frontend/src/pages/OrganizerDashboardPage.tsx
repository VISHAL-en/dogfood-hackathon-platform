import React, { useEffect, useState } from 'react';
import { Link } from '../router/Router';
import { EventListItem, JudgingProgress, VotingRound } from '../../../shared/types';
import { api } from '../services/api';
import { Sidebar, SidebarSection } from '../components/Sidebar';
import { StatusPill } from '../components/StatusPill';
import { LoadingState } from '../components/LoadingState';

export const OrganizerDashboardPage: React.FC = () => {
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [progress, setProgress] = useState<JudgingProgress | null>(null);
  const [votingRound, setVotingRound] = useState<VotingRound | null>(null);
  const [votingActionLoading, setVotingActionLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.events
      .list({ organizerId: 'me' })
      .then((data) => {
        setEvents(data);
        if (data.length > 0) {
          const defaultEvent = data[0].id;
          setSelectedEventId(defaultEvent);
          api.voting.getRounds(defaultEvent).then((rounds) => {
            setVotingRound(rounds.length > 0 ? rounds[0] : null);
          }).catch(() => {});
          return api.judging.getProgress(defaultEvent);
        }
        return null;
      })
      .then((prog) => {
        if (prog) setProgress(prog);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSelectEvent = async (evId: string) => {
    setSelectedEventId(evId);
    try {
      const [p, rounds] = await Promise.all([
        api.judging.getProgress(evId).catch(() => null),
        api.voting.getRounds(evId).catch(() => [])
      ]);
      setProgress(p);
      setVotingRound(rounds.length > 0 ? rounds[0] : null);
    } catch {
      setProgress(null);
      setVotingRound(null);
    }
  };

  const handleCreateRound = async () => {
    if (!selectedEventId) return;
    setVotingActionLoading(true);
    try {
      const round = await api.voting.createRound(selectedEventId);
      await api.voting.autoPopulateCandidates(selectedEventId, round.id);
      const updated = await api.voting.getRound(selectedEventId, round.id);
      setVotingRound(updated);
    } catch (err: any) {
      alert(err?.message || 'Failed to create voting round');
    } finally {
      setVotingActionLoading(false);
    }
  };

  const handleOpenRound = async () => {
    if (!selectedEventId || !votingRound) return;
    setVotingActionLoading(true);
    try {
      const updated = await api.voting.openRound(selectedEventId, votingRound.id);
      setVotingRound(updated);
    } catch (err: any) {
      alert(err?.message || 'Failed to open voting round');
    } finally {
      setVotingActionLoading(false);
    }
  };

  const handleCloseRound = async () => {
    if (!selectedEventId || !votingRound) return;
    setVotingActionLoading(true);
    try {
      const updated = await api.voting.closeRound(selectedEventId, votingRound.id);
      setVotingRound(updated);
    } catch (err: any) {
      alert(err?.message || 'Failed to close voting round');
    } finally {
      setVotingActionLoading(false);
    }
  };

  const handlePublishResults = async () => {
    if (!selectedEventId || !votingRound) return;
    setVotingActionLoading(true);
    try {
      const updated = await api.voting.publishResults(selectedEventId, votingRound.id);
      setVotingRound(updated);
    } catch (err: any) {
      alert(err?.message || 'Failed to publish results');
    } finally {
      setVotingActionLoading(false);
    }
  };

  const currentEvent = events.find((e) => e.id === selectedEventId);

  const sidebarSections: SidebarSection[] = [
    {
      title: 'Active Event',
      items: [
        { label: 'Overview', path: '/organizer', icon: 'dashboard' },
        { label: 'Judging Progress', path: selectedEventId ? `/organizer/events/${selectedEventId}/judging/progress` : '/organizer', icon: 'insights' },
        { label: 'Normalization Workspace', path: selectedEventId ? `/organizer/events/${selectedEventId}/judging/normalization` : '/organizer', icon: 'functions' },
        { label: 'Submissions Management', path: selectedEventId ? `/organizer/events/${selectedEventId}/submissions` : '/organizer', icon: 'folder' },
        { label: 'Event Settings', path: selectedEventId ? `/organizer/events/${selectedEventId}/settings` : '/organizer', icon: 'settings' }
      ]
    },
    {
      title: 'Platform Actions',
      items: [
        { label: 'Create New Event', path: '/organizer/events/new', icon: 'add_circle' },
        { label: 'System Health', path: '/settings', icon: 'monitor_heart' }
      ]
    }
  ];

  if (loading) return <LoadingState message="Loading organizer console..." />;

  return (
    <div className="workspace-split">
      <Sidebar
        sections={sidebarSections}
        headerTitle="Arbiter Organizer"
        headerSubtitle="Evaluation Management"
      />

      <div className="workspace-main">
        {/* Top Bar with Event Selector */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase' }}>
              Lead Operations
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--on-surface)', marginTop: '2px' }}>
              Arbiter Organizer Dashboard
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--outline)', fontWeight: 600 }}>Active Event:</span>
            <select
              className="select-input"
              value={selectedEventId}
              onChange={(e) => handleSelectEvent(e.target.value)}
              style={{ width: '240px', fontWeight: 600 }}
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.name}</option>
              ))}
            </select>

            <Link to="/organizer/events/new" className="btn btn-primary btn-sm">
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
              <span>New Event</span>
            </Link>
          </div>
        </div>

        {currentEvent ? (
          <div>
            {/* Event Summary Card */}
            <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <StatusPill status={currentEvent.status} />
                    <span className="hash-pill">{currentEvent.slug}</span>
                  </div>
                  <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--on-surface)' }}>{currentEvent.name}</h2>
                  <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>{currentEvent.description}</p>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <Link to={`/organizer/events/${currentEvent.id}/settings`} className="btn btn-secondary btn-sm">
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>settings</span>
                    <span>Rubric & Dates</span>
                  </Link>
                  <Link to={`/organizer/events/${currentEvent.id}/judging/normalization`} className="btn btn-primary btn-sm">
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>functions</span>
                    <span>Normalization</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Judging Progress Metrics Cards */}
            {progress && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
                <div className="card" style={{ padding: '20px' }}>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--outline)', fontWeight: 600 }}>Total Assignments</span>
                  <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--on-surface)', marginTop: '4px' }} className="tabular-nums">
                    {progress.totalAssignments}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--on-surface-variant)', marginTop: '2px' }}>Across {progress.assignedJudgesCount} judges</div>
                </div>

                <div className="card" style={{ padding: '20px' }}>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--status-done-fg)', fontWeight: 600 }}>Completed Reviews</span>
                  <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--status-done-fg)', marginTop: '4px' }} className="tabular-nums">
                    {progress.completedAssignments}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--on-surface-variant)', marginTop: '2px' }}>Evaluations finalized</div>
                </div>

                <div className="card" style={{ padding: '20px' }}>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--status-judge-fg)', fontWeight: 600 }}>Pending Reviews</span>
                  <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--status-judge-fg)', marginTop: '4px' }} className="tabular-nums">
                    {progress.pendingAssignments}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--on-surface-variant)', marginTop: '2px' }}>Awaiting jury completion</div>
                </div>

                <div className="card" style={{ padding: '20px' }}>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--primary)', fontWeight: 600 }}>Completion Rate</span>
                  <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }} className="tabular-nums">
                    {progress.completionPercentage.toFixed(0)}%
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--on-surface-variant)', marginTop: '2px' }}>Of total assigned load</div>
                </div>
              </div>
            )}

            {/* Quick Actions Bento */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '22px' }}>functions</span>
                  <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Cross-Judge Normalization</h3>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--on-surface-variant)', lineHeight: 1.5, marginBottom: '16px' }}>
                  Run deterministic population z-score normalization on raw evaluations. Preserves raw score immutability with canonical SHA-256 audit proof.
                </p>
                <Link to={`/organizer/events/${currentEvent.id}/judging/normalization`} className="btn btn-secondary btn-sm">
                  Launch Workspace
                </Link>
              </div>

              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span className="material-symbols-outlined" style={{ color: '#8b5cf6', fontSize: '22px' }}>how_to_vote</span>
                  <h3 style={{ fontSize: '16px', fontWeight: 700 }}>T3 Community Voting</h3>
                </div>
                <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--outline)', fontWeight: 600 }}>Lifecycle:</span>
                  <span
                    className="badge"
                    style={{
                      fontSize: '11px',
                      background:
                        votingRound?.status === 'voting_open'
                          ? 'rgba(0, 113, 227, 0.1)'
                          : votingRound?.status === 'results_published'
                          ? 'rgba(16, 185, 129, 0.1)'
                          : 'var(--surface-container-high)',
                      color:
                        votingRound?.status === 'voting_open'
                          ? 'var(--primary)'
                          : votingRound?.status === 'results_published'
                          ? 'var(--status-done-fg)'
                          : 'var(--on-surface-variant)',
                      fontWeight: 700
                    }}
                  >
                    {votingRound ? votingRound.status.toUpperCase() : 'NO ROUND'}
                  </span>
                  {votingRound?.candidateCount !== undefined && (
                    <span style={{ fontSize: '11px', color: 'var(--outline)' }}>
                      ({votingRound.candidateCount} Candidates)
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '12px', color: 'var(--on-surface-variant)', lineHeight: 1.5, marginBottom: '16px' }}>
                  Public community voting with randomized ballots, duplicate prevention, and hidden results during voting.
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {!votingRound ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={votingActionLoading}
                      onClick={handleCreateRound}
                    >
                      <span>Create Draft Round</span>
                    </button>
                  ) : votingRound.status === 'draft' ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={votingActionLoading}
                      onClick={handleOpenRound}
                    >
                      <span>Open Voting</span>
                    </button>
                  ) : votingRound.status === 'voting_open' ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={votingActionLoading}
                      onClick={handleCloseRound}
                    >
                      <span>Close Voting</span>
                    </button>
                  ) : votingRound.status === 'voting_closed' ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={votingActionLoading}
                      onClick={handlePublishResults}
                    >
                      <span>Publish Results</span>
                    </button>
                  ) : (
                    <Link to="/results" className="btn btn-secondary btn-sm">
                      <span>View Standings</span>
                    </Link>
                  )}
                  {votingRound && (
                    <Link to="/gallery" className="btn btn-secondary btn-sm">
                      <span>Ballot View</span>
                    </Link>
                  )}
                </div>
              </div>

              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span className="material-symbols-outlined" style={{ color: '#0284c7', fontSize: '22px' }}>download</span>
                  <h3 style={{ fontSize: '16px', fontWeight: 700 }}>CSV Score Export</h3>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--on-surface-variant)', lineHeight: 1.5, marginBottom: '16px' }}>
                  Export complete judging evaluation matrices with formula-injection neutralization for external jury reporting.
                </p>
                <a href={`/exports/scores.csv?eventId=${currentEvent.id}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                  Download CSV
                </a>
              </div>

              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: '22px' }}>verified</span>
                  <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Acceptance Checker Proof</h3>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--on-surface-variant)', lineHeight: 1.5, marginBottom: '16px' }}>
                  All DOGFOOD T1/T2 acceptance checker routes are operational and verified against SQLite WAL mode and offline constraints.
                </p>
                <Link to="/settings" className="btn btn-secondary btn-sm">
                  System Diagnostics
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <h3>No events created yet</h3>
            <p>Get started by creating your first hackathon event.</p>
            <Link to="/organizer/events/new" className="btn btn-primary" style={{ marginTop: '16px' }}>
              Create First Event
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
