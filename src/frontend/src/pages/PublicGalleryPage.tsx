import React, { useEffect, useState, useMemo } from 'react';
import { Link, useLocation } from '../router/Router';
import { GalleryItem, EventListItem, VotingRound, VotingBallot, VotingBallotItem } from '../../../shared/types';
import { api } from '../services/api';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';

export const PublicGalleryPage: React.FC = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialEvent = queryParams.get('event') || '';

  const [items, setItems] = useState<GalleryItem[]>([]);
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(initialEvent);

  // Community Voting State
  const [votingRound, setVotingRound] = useState<VotingRound | null>(null);
  const [ballot, setBallot] = useState<VotingBallot | null>(null);
  const [votingActionLoading, setVotingActionLoading] = useState<string | null>(null);
  const [bannerNotice, setBannerNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Load events list on mount
  useEffect(() => {
    api.events.list().then((evList) => {
      setEvents(evList);
      if (!selectedEvent && evList.length > 0) {
        setSelectedEvent(evList[0].id);
      }
    }).catch(() => {});
  }, []);

  // Fetch gallery submissions
  useEffect(() => {
    setLoading(true);
    api.gallery
      .list({
        search: search.trim() ? search : undefined,
        event: selectedEvent ? selectedEvent : undefined
      })
      .then((res) => {
        setItems(res.items);
      })
      .catch(() => {
        setItems([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [search, selectedEvent]);

  // Check voting round & ballot for selected event
  useEffect(() => {
    if (!selectedEvent) {
      setVotingRound(null);
      setBallot(null);
      return;
    }

    api.voting.getRounds(selectedEvent)
      .then(async (rounds) => {
        if (!rounds || rounds.length === 0) {
          setVotingRound(null);
          setBallot(null);
          return;
        }
        // Pick the active or latest round
        const active = rounds.find(r => r.status === 'voting_open') || rounds[0];
        setVotingRound(active);

        if (active.status === 'voting_open') {
          try {
            const voterBallot = await api.voting.getBallot(selectedEvent, active.id);
            setBallot(voterBallot);
          } catch {
            setBallot(null);
          }
        } else {
          setBallot(null);
        }
      })
      .catch(() => {
        setVotingRound(null);
        setBallot(null);
      });
  }, [selectedEvent]);

  // Map candidate by submission ID from the server-generated ballot
  const candidateMap = useMemo(() => {
    const map = new Map<string, VotingBallotItem>();
    if (ballot?.candidates) {
      for (const cand of ballot.candidates) {
        map.set(cand.submissionId, cand);
      }
    }
    return map;
  }, [ballot]);

  // Authoritative server ballot ordering:
  // When community voting is active and a ballot is returned, render candidate projects
  // in the exact randomized permutation order provided by the backend to eliminate position bias.
  const displayItems = useMemo(() => {
    if (!votingRound || votingRound.status !== 'voting_open' || !ballot?.candidates?.length) {
      return items;
    }

    const itemMap = new Map<string, GalleryItem>();
    for (const it of items) itemMap.set(it.id, it);

    const ordered: GalleryItem[] = [];
    for (const cand of ballot.candidates) {
      const match = itemMap.get(cand.submissionId);
      if (match) {
        ordered.push(match);
      }
    }

    // Append non-candidate items if any exist
    for (const it of items) {
      if (!ordered.some(o => o.id === it.id)) {
        ordered.push(it);
      }
    }
    return ordered;
  }, [items, ballot, votingRound]);

  // Cast community vote
  const handleCastVote = async (candidateId: string, projectTitle: string) => {
    if (!selectedEvent || !votingRound) return;
    setVotingActionLoading(candidateId);
    setBannerNotice(null);

    try {
      await api.voting.castVote(selectedEvent, votingRound.id, candidateId);
      // Mark as voted in local ballot state
      setBallot(prev => {
        if (!prev) return null;
        return {
          ...prev,
          candidates: prev.candidates.map(c =>
            c.candidateId === candidateId ? { ...c, hasVoted: true } : c
          )
        };
      });
      setBannerNotice({ type: 'success', text: `Vote recorded for "${projectTitle}"!` });
    } catch (err: any) {
      if (err?.status === 409 || err?.code === 'CONFLICT') {
        setBannerNotice({ type: 'info', text: `You have already voted for "${projectTitle}" in this round.` });
        // Update local state to reflect recorded vote
        setBallot(prev => {
          if (!prev) return null;
          return {
            ...prev,
            candidates: prev.candidates.map(c =>
              c.candidateId === candidateId ? { ...c, hasVoted: true } : c
            )
          };
        });
      } else if (err?.status === 429 || err?.code === 'RATE_LIMIT_EXCEEDED') {
        setBannerNotice({
          type: 'error',
          text: 'Rate limit reached (max 30 votes per 10 minutes). Please wait a few moments before voting again.'
        });
      } else {
        setBannerNotice({ type: 'error', text: err?.message || 'Failed to submit vote.' });
      }
    } finally {
      setVotingActionLoading(null);
    }
  };

  return (
    <div className="page-container">
      {/* Gallery Header */}
      <div className="page-header">
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase' }}>
            Public Submissions Showcase
          </div>
          <h1 className="page-title" style={{ marginTop: '2px' }}>Project Gallery</h1>
          <p className="page-subtitle">
            Explore verified submissions, autonomous toolchains, and offline prototypes built during hackathons on this platform.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ position: 'relative', width: '320px' }}>
          <span
            className="material-symbols-outlined"
            style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--outline)', fontSize: '18px' }}
          >
            search
          </span>
          <input
            type="text"
            className="input-text"
            placeholder="Search projects, stack, or keywords..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '36px' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '12px', color: 'var(--outline)', fontWeight: 600 }}>Filter Event:</span>
          <select
            className="select-input"
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            style={{ width: '220px' }}
          >
            <option value="">All Events</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Community Voting Status Banner */}
      {votingRound && votingRound.status === 'voting_open' && (
        <div
          className="card"
          style={{
            padding: '16px 20px',
            marginBottom: '20px',
            background: 'linear-gradient(135deg, rgba(0, 113, 227, 0.08) 0%, rgba(219, 225, 255, 0.25) 100%)',
            border: '1px solid rgba(0, 113, 227, 0.2)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '28px', color: 'var(--primary)' }}>
                how_to_vote
              </span>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', background: 'var(--primary)', color: 'white', padding: '2px 8px', borderRadius: 'var(--radius-pill)', fontWeight: 700, letterSpacing: '0.04em' }}>
                    COMMUNITY VOTING ACTIVE
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--outline)', fontFamily: 'var(--font-mono)' }}>
                    Ballot Order Randomized Server-Side
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--on-surface)', marginTop: '4px', margin: 0 }}>
                  Evaluate projects and cast your votes below. To eliminate position bias, candidates are rendered in the authoritative server-randomized order.
                </p>
              </div>
            </div>
            {ballot && (
              <div style={{ fontSize: '12px', color: 'var(--outline)', fontFamily: 'var(--font-mono)' }}>
                {ballot.candidates.filter(c => c.hasVoted).length} of {ballot.candidates.length} Voted
              </div>
            )}
          </div>
        </div>
      )}

      {/* Published Results Banner */}
      {votingRound && votingRound.status === 'results_published' && (
        <div
          className="card"
          style={{
            padding: '16px 20px',
            marginBottom: '20px',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.2)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--status-done-fg)', fontSize: '24px' }}>
                emoji_events
              </span>
              <div>
                <strong style={{ color: 'var(--on-surface)' }}>Community Voting Results Published!</strong>
                <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)' }}>
                  Final community vote tallies and tournament rankings are live.
                </div>
              </div>
            </div>
            <Link to="/results" className="btn btn-primary btn-sm">
              <span>View Standings</span>
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
            </Link>
          </div>
        </div>
      )}

      {/* Notice Banner (Errors, Duplicates, Rate Limits, Success) */}
      {bannerNotice && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background:
              bannerNotice.type === 'success'
                ? 'rgba(16, 185, 129, 0.1)'
                : bannerNotice.type === 'info'
                ? 'rgba(0, 113, 227, 0.1)'
                : 'rgba(186, 26, 26, 0.1)',
            color:
              bannerNotice.type === 'success'
                ? 'var(--status-done-fg)'
                : bannerNotice.type === 'info'
                ? 'var(--primary)'
                : 'var(--error)',
            border: `1px solid ${
              bannerNotice.type === 'success'
                ? 'var(--status-done-border)'
                : bannerNotice.type === 'info'
                ? 'rgba(0, 113, 227, 0.2)'
                : 'var(--error-container)'
            }`
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
            {bannerNotice.type === 'success' ? 'check_circle' : bannerNotice.type === 'info' ? 'info' : 'error'}
          </span>
          <span>{bannerNotice.text}</span>
        </div>
      )}

      {/* Gallery Cards Grid */}
      {loading ? (
        <LoadingState message="Fetching submitted projects..." />
      ) : displayItems.length === 0 ? (
        <EmptyState
          icon="deployed_code"
          title="No published submissions found"
          description="Projects appear in the gallery once finalized and submitted by their team captains."
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '24px' }}>
          {displayItems.map((item) => {
            const candidate = candidateMap.get(item.id);
            const isVotingActive = votingRound?.status === 'voting_open' && Boolean(candidate);

            return (
              <div
                key={item.id}
                className="card card-clickable"
                style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}
              >
                <div>
                  {/* Thumbnail Mock Visual Area */}
                  <div
                    style={{
                      height: '160px',
                      borderRadius: 'var(--radius-md)',
                      background: 'linear-gradient(135deg, #eff4fa 0%, #dbe1ff 100%)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '16px',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '44px', color: 'var(--primary)', opacity: 0.85 }}>
                      terminal
                    </span>
                    <div
                      style={{
                        position: 'absolute',
                        top: '10px',
                        left: '10px',
                        background: 'rgba(255, 255, 255, 0.9)',
                        backdropFilter: 'blur(8px)',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--primary)'
                      }}
                    >
                      {item.trackName || 'General Track'}
                    </div>

                    {/* Randomized Ballot Position indicator */}
                    {candidate && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '10px',
                          right: '10px',
                          background: 'rgba(26, 27, 31, 0.75)',
                          backdropFilter: 'blur(8px)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-pill)',
                          fontSize: '10px',
                          fontWeight: 600,
                          color: 'white',
                          fontFamily: 'var(--font-mono)'
                        }}
                      >
                        Ballot #{candidate.position + 1}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--outline)', fontFamily: 'var(--font-mono)' }}>
                      {item.eventName}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--outline)' }}>
                      Team: <strong>{item.teamName}</strong>
                    </span>
                  </div>

                  <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--on-surface)', marginBottom: '8px' }}>
                    {item.title}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', lineHeight: 1.5, marginBottom: '16px' }}>
                    {item.shortDescription}
                  </p>

                  {/* Community Voting Strip on Card */}
                  {isVotingActive && candidate && (
                    <div
                      style={{
                        padding: '10px 12px',
                        marginBottom: '16px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--surface-container-low)',
                        border: '1px solid var(--outline-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <span style={{ fontSize: '11px', color: 'var(--outline)', fontWeight: 600 }}>Community Vote:</span>
                      {candidate.hasVoted ? (
                        <span
                          className="badge"
                          style={{
                            background: 'var(--status-done-bg)',
                            color: 'var(--status-done-fg)',
                            border: '1px solid var(--status-done-border)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            padding: '3px 8px'
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check_circle</span>
                          <span>Voted</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={votingActionLoading === candidate.candidateId}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleCastVote(candidate.candidateId, item.title);
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>how_to_vote</span>
                          <span>{votingActionLoading === candidate.candidateId ? 'Voting...' : 'Vote'}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    paddingTop: '16px',
                    borderTop: '1px solid var(--outline-border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {item.repoUrl && (
                      <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--outline)' }} title="Repo available">
                        code
                      </span>
                    )}
                    {item.demoUrl && (
                      <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--outline)' }} title="Demo live">
                        language
                      </span>
                    )}
                    {item.videoUrl && (
                      <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--outline)' }} title="Video walkthrough">
                        smart_display
                      </span>
                    )}
                  </div>

                  <Link to={`/gallery/${item.slug}`} className="btn btn-secondary btn-sm">
                    <span>Inspect Project</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
