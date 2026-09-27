import React, { useEffect, useState } from 'react';
import { Link, useLocation } from '../router/Router';
import { EventListItem, VotingRound, PublicVotingResultsResponse } from '../../../shared/types';
import { api } from '../services/api';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';

export const PublicResultsPage: React.FC = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialEvent = queryParams.get('event') || '';

  const [events, setEvents] = useState<EventListItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState(initialEvent);
  const [loading, setLoading] = useState(true);
  const [resultsResponse, setResultsResponse] = useState<PublicVotingResultsResponse | null>(null);
  const [activeOrLatestRound, setActiveOrLatestRound] = useState<VotingRound | null>(null);

  // Load events
  useEffect(() => {
    api.events.list().then((evList) => {
      setEvents(evList);
      if (!selectedEventId && evList.length > 0) {
        setSelectedEventId(evList[0].id);
      }
    }).catch(() => {});
  }, []);

  // Fetch results when selected event changes
  useEffect(() => {
    if (!selectedEventId) return;

    setLoading(true);
    setResultsResponse(null);
    setActiveOrLatestRound(null);

    api.voting.getRounds(selectedEventId)
      .then(async (rounds) => {
        if (!rounds || rounds.length === 0) {
          setLoading(false);
          return;
        }

        const published = rounds.find(r => r.status === 'results_published');
        const latest = rounds[0];
        setActiveOrLatestRound(latest);

        if (published) {
          try {
            const data = await api.voting.getResults(selectedEventId, published.id);
            setResultsResponse(data);
          } catch {
            setResultsResponse(null);
          }
        }
      })
      .catch(() => {
        setResultsResponse(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedEventId]);

  const selectedEvent = events.find(e => e.id === selectedEventId);

  return (
    <div className="page-container" style={{ maxWidth: '1080px', margin: '0 auto', padding: '32px 16px' }}>
      {/* Page Header */}
      <div className="card" style={{ padding: '32px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className="instance-badge">
                <span className="orb"></span>
                <span>Public Community Standings</span>
              </span>
              {resultsResponse ? (
                <span className="badge" style={{ background: 'var(--status-done-bg)', color: 'var(--status-done-fg)', border: '1px solid var(--status-done-border)', fontSize: '11px', fontWeight: 700 }}>
                  RESULTS PUBLISHED
                </span>
              ) : (
                <span className="badge" style={{ background: 'var(--surface-container)', color: 'var(--outline)', fontSize: '11px', fontWeight: 600 }}>
                  PRE-PUBLICATION
                </span>
              )}
            </div>

            <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--on-surface)', letterSpacing: '-0.02em', margin: '8px 0 4px 0' }}>
              Tournament Results & Standings
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', margin: 0, maxWidth: '750px' }}>
              Verified community voting standings aggregated from cryptographically randomized ballots.
              Results are strictly hidden until officially published by the event organizer.
            </p>
          </div>

          {events.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '12px', color: 'var(--outline)', fontWeight: 600 }}>Event:</span>
              <select
                className="select-input"
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                style={{ width: '220px', fontWeight: 600 }}
              >
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <LoadingState message="Checking community results publication status..." />
      ) : resultsResponse && resultsResponse.results.length > 0 ? (
        <div>
          {/* Summary Metric Ribbon */}
          <div
            className="card"
            style={{
              padding: '20px 28px',
              marginBottom: '24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px',
              background: 'linear-gradient(135deg, rgba(0, 113, 227, 0.04) 0%, rgba(16, 185, 129, 0.06) 100%)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--outline)', textTransform: 'uppercase', fontWeight: 600 }}>Total Votes Cast</span>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)', marginTop: '2px' }} className="tabular-nums">
                  {resultsResponse.totalVotes}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: 'var(--outline)', textTransform: 'uppercase', fontWeight: 600 }}>Published On</span>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--on-surface)', marginTop: '4px' }}>
                  {new Date(resultsResponse.resultsPublishedAt).toLocaleDateString()}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: 'var(--outline)', textTransform: 'uppercase', fontWeight: 600 }}>Competing Projects</span>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--on-surface)', marginTop: '4px' }}>
                  {resultsResponse.results.length} Finalists
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--status-done-fg)' }}>
                verified
              </span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--on-surface)' }}>
                Anti-Anchoring Publication Verified
              </span>
            </div>
          </div>

          {/* Results Leaderboard Table / Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {resultsResponse.results.map((item) => {
              const isTop1 = item.rank === 1;
              const isTop2 = item.rank === 2;
              const isTop3 = item.rank === 3;

              return (
                <div
                  key={item.submissionId}
                  className="card"
                  style={{
                    padding: '24px 28px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '16px',
                    border: isTop1
                      ? '1px solid rgba(217, 119, 6, 0.4)'
                      : isTop2
                      ? '1px solid rgba(113, 119, 133, 0.3)'
                      : isTop3
                      ? '1px solid rgba(180, 83, 9, 0.3)'
                      : '1px solid var(--outline-border)',
                    background: isTop1
                      ? 'linear-gradient(135deg, rgba(254, 243, 199, 0.3) 0%, rgba(255, 255, 255, 0.9) 100%)'
                      : 'var(--surface-lowest)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    {/* Rank Badge */}
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '18px',
                        background: isTop1
                          ? '#fef3c7'
                          : isTop2
                          ? '#f1f5f9'
                          : isTop3
                          ? '#ffedd5'
                          : 'var(--surface-container)',
                        color: isTop1
                          ? '#b45309'
                          : isTop2
                          ? '#475569'
                          : isTop3
                          ? '#9a3412'
                          : 'var(--on-surface-variant)'
                      }}
                      className="tabular-nums"
                    >
                      {isTop1 ? '🥇' : isTop2 ? '🥈' : isTop3 ? '🥉' : `#${item.rank}`}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--outline)', fontWeight: 600 }}>
                          Team: {item.teamName}
                        </span>
                        {isTop1 && (
                          <span style={{ fontSize: '10px', background: '#fef3c7', color: '#b45309', padding: '1px 6px', borderRadius: 'var(--radius-pill)', fontWeight: 700 }}>
                            COMMUNITY CHAMPION
                          </span>
                        )}
                      </div>
                      <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--on-surface)', margin: 0 }}>
                        {item.title}
                      </h3>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    {/* Votes Count Pill */}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)' }} className="tabular-nums">
                        {item.voteCount}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--outline)', textTransform: 'uppercase', fontWeight: 600 }}>
                        Community Votes
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Link to={`/results/${item.slug}`} className="btn btn-primary btn-sm">
                        <span>Result Dossier</span>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
                      </Link>
                      <Link to={`/gallery/${item.slug}`} className="btn btn-secondary btn-sm">
                        <span>Inspect Project</span>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          {/* Honest Pre-Publication / Unavailable State */}
          <EmptyState
            icon="lock_clock"
            title="Community Results Not Yet Published"
            description={`Community voting results for "${selectedEvent?.name || 'this event'}" remain strictly hidden during voting and auditing to eliminate anchoring bias. Results will become available here once officially published by the event organizer.`}
          />

          {activeOrLatestRound && (
            <div
              style={{
                maxWidth: '600px',
                margin: '24px auto 0 auto',
                padding: '16px 20px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--surface-container-low)',
                border: '1px solid var(--outline-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '12px'
              }}
            >
              <span style={{ color: 'var(--outline)' }}>Current Voting Round Status:</span>
              <span
                style={{
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color:
                    activeOrLatestRound.status === 'voting_open'
                      ? 'var(--primary)'
                      : activeOrLatestRound.status === 'voting_closed'
                      ? 'var(--status-judge-fg)'
                      : 'var(--outline)'
                }}
              >
                {activeOrLatestRound.status === 'voting_open'
                  ? 'Voting in Progress'
                  : activeOrLatestRound.status === 'voting_closed'
                  ? 'Voting Closed (Auditing in Progress)'
                  : activeOrLatestRound.status}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '24px' }}>
            <Link to="/gallery" className="btn btn-primary btn-sm">
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>grid_view</span>
              <span>Browse Public Project Gallery</span>
            </Link>
            <Link to="/events" className="btn btn-secondary btn-sm">
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>explore</span>
              <span>Explore Hackathons</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
