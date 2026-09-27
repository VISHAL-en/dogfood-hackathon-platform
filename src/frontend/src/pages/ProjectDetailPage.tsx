import React, { useEffect, useState } from 'react';
import { useParams, Link } from '../router/Router';
import { SubmissionDetail, VotingRound, VotingBallotItem, CommunityComment } from '../../../shared/types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { LoadingState } from '../components/LoadingState';
import { ErrorBanner } from '../components/ErrorBanner';

export const ProjectDetailPage: React.FC = () => {
  const { idOrSlug } = useParams<{ idOrSlug: string }>();
  const { user } = useAuth();

  const [project, setProject] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Voting State
  const [votingRound, setVotingRound] = useState<VotingRound | null>(null);
  const [candidate, setCandidate] = useState<VotingBallotItem | null>(null);
  const [voteLoading, setVoteLoading] = useState(false);
  const [voteMessage, setVoteMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Comments State
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [authorDisplayName, setAuthorDisplayName] = useState(user?.name || '');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  // Load project details
  useEffect(() => {
    if (!idOrSlug) return;
    setLoading(true);
    api.gallery
      .getDetail(idOrSlug)
      .then((data) => {
        setProject(data);
      })
      .catch((err) => {
        setError(err.message || 'Project not found in gallery');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [idOrSlug]);

  // Keep author display name synced with user if logged in
  useEffect(() => {
    if (user?.name && !authorDisplayName) {
      setAuthorDisplayName(user.name);
    }
  }, [user]);

  // Check voting round & ballot for this project
  useEffect(() => {
    if (!project) return;

    api.voting.getRounds(project.eventId)
      .then(async (rounds) => {
        if (!rounds || rounds.length === 0) return;
        const active = rounds.find(r => r.status === 'voting_open') || rounds[0];
        setVotingRound(active);

        // If voting is open, fetch voter's ballot to see if voted
        if (active.status === 'voting_open') {
          try {
            const ballot = await api.voting.getBallot(project.eventId, active.id);
            const foundCandidate = ballot.candidates.find(c => c.submissionId === project.id);
            if (foundCandidate) {
              setCandidate(foundCandidate);
            }
          } catch {
            // Ballot unavailable or error
          }
        }

        // Fetch comments for this submission in the round
        if (active) {
          loadComments(project.eventId, active.id, project.id);
        }
      })
      .catch(() => {});
  }, [project]);

  const loadComments = async (eventId: string, roundId: string, submissionId: string) => {
    setCommentsLoading(true);
    try {
      const list = await api.voting.getComments(eventId, roundId, submissionId);
      setComments(list);
    } catch {
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleCastVote = async () => {
    if (!project || !votingRound || !candidate) return;
    setVoteLoading(true);
    setVoteMessage(null);

    try {
      await api.voting.castVote(project.eventId, votingRound.id, candidate.candidateId);
      setCandidate(prev => prev ? { ...prev, hasVoted: true } : null);
      setVoteMessage({ type: 'success', text: 'Thank you! Your community vote has been recorded.' });
    } catch (err: any) {
      if (err?.status === 409 || err?.code === 'CONFLICT') {
        setCandidate(prev => prev ? { ...prev, hasVoted: true } : null);
        setVoteMessage({ type: 'info', text: 'You have already voted for this project in this round.' });
      } else if (err?.status === 429 || err?.code === 'RATE_LIMIT_EXCEEDED') {
        setVoteMessage({
          type: 'error',
          text: 'Rate limit exceeded: maximum 30 votes per 10 minutes. Please wait before voting again.'
        });
      } else {
        setVoteMessage({ type: 'error', text: err?.message || 'Failed to submit vote.' });
      }
    } finally {
      setVoteLoading(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !votingRound) return;
    if (!commentBody.trim()) return;

    setCommentSubmitting(true);
    setCommentError(null);

    try {
      const newComment = await api.voting.createComment(
        project.eventId,
        votingRound.id,
        project.id,
        commentBody.trim(),
        authorDisplayName.trim() || undefined
      );
      setComments(prev => [...prev, newComment]);
      setCommentBody('');
    } catch (err: any) {
      if (err?.status === 429 || err?.code === 'RATE_LIMIT_EXCEEDED') {
        setCommentError('Comment rate limit reached (max 10 comments per 10 minutes). Please wait before posting again.');
      } else {
        setCommentError(err?.message || 'Failed to post comment.');
      }
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!project || !votingRound) return;
    try {
      await api.voting.deleteComment(project.eventId, votingRound.id, commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (err: any) {
      alert(err?.message || 'Failed to delete comment');
    }
  };

  if (loading) return <LoadingState message="Loading project details..." />;

  if (error || !project) {
    return (
      <div className="page-container">
        <ErrorBanner message={error || 'Project not found'} />
        <Link to="/gallery" className="btn btn-secondary btn-sm" style={{ marginTop: '16px' }}>
          Back to Gallery
        </Link>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: '1000px' }}>
      <div style={{ marginBottom: '16px' }}>
        <Link to="/gallery" style={{ fontSize: '13px', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
          <span>Back to Project Gallery</span>
        </Link>
      </div>

      <div className="card" style={{ padding: '36px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', background: 'var(--primary-container)', color: 'var(--on-primary-container)', padding: '3px 10px', borderRadius: 'var(--radius-pill)', fontWeight: 600 }}>
                {project.trackName || 'General Track'}
              </span>
              <span className="hash-pill">{project.eventName}</span>
            </div>
            <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--on-surface)', letterSpacing: '-0.02em', marginBottom: '8px' }}>
              {project.title}
            </h1>
            <p style={{ fontSize: '15px', color: 'var(--on-surface-variant)', lineHeight: 1.5 }}>
              {project.shortDescription}
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {project.repoUrl && (
              <a href={project.repoUrl} target="_blank" rel="noreferrer" className="btn btn-secondary">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>code</span>
                <span>View Repository</span>
              </a>
            )}
            {project.demoUrl && (
              <a href={project.demoUrl} target="_blank" rel="noreferrer" className="btn btn-primary">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>open_in_new</span>
                <span>Live Demonstration</span>
              </a>
            )}
            {project.videoUrl && (
              <a href={project.videoUrl} target="_blank" rel="noreferrer" className="btn btn-secondary">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>smart_display</span>
                <span>Video Pitch</span>
              </a>
            )}
          </div>
        </div>

        {/* Team & Submission Metadata Strip */}
        <div
          style={{
            marginTop: '24px',
            paddingTop: '20px',
            borderTop: '1px solid var(--outline-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px'
          }}
        >
          <div>
            <span style={{ fontSize: '11px', color: 'var(--outline)', textTransform: 'uppercase', fontWeight: 600 }}>Crafted by</span>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--on-surface)', marginTop: '2px' }}>
              Team: {project.teamName}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--outline)', marginRight: '6px' }}>Team Roster:</span>
            {project.members.map((m) => (
              <span
                key={m.id}
                style={{
                  fontSize: '11px',
                  background: 'var(--surface-container)',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-pill)',
                  fontWeight: 500
                }}
              >
                {m.userName} {m.role === 'captain' && '★'}
              </span>
            ))}
          </div>

          {project.submittedAt && (
            <div style={{ fontSize: '12px', color: 'var(--outline)' }} className="tabular-nums">
              Submitted: {new Date(project.submittedAt).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      {/* Community Voting Action Strip */}
      {votingRound && votingRound.status === 'voting_open' && candidate && (
        <div
          className="card"
          style={{
            padding: '24px 32px',
            marginBottom: '28px',
            background: 'linear-gradient(135deg, rgba(0, 113, 227, 0.06) 0%, rgba(219, 225, 255, 0.25) 100%)',
            border: '1px solid rgba(0, 113, 227, 0.25)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', background: 'var(--primary)', color: 'white', padding: '2px 8px', borderRadius: 'var(--radius-pill)', fontWeight: 700, letterSpacing: '0.04em' }}>
                COMMUNITY VOTING ACTIVE
              </span>
              <span style={{ fontSize: '11px', color: 'var(--outline)', fontFamily: 'var(--font-mono)' }}>
                Ballot #{candidate.position + 1}
              </span>
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--on-surface)', margin: 0 }}>
              Support this project with your community ballot
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', margin: '4px 0 0 0' }}>
              Voters can vote once per candidate. Results are hidden during voting to eliminate bias.
            </p>
          </div>

          <div>
            {candidate.hasVoted ? (
              <span
                className="badge"
                style={{
                  background: 'var(--status-done-bg)',
                  color: 'var(--status-done-fg)',
                  border: '1px solid var(--status-done-border)',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>
                <span>You Voted for this Project</span>
              </span>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={voteLoading}
                onClick={handleCastVote}
                style={{ padding: '8px 20px', fontSize: '14px' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>how_to_vote</span>
                <span>{voteLoading ? 'Casting Vote...' : 'Vote for this Project'}</span>
              </button>
            )}
          </div>

          {voteMessage && (
            <div
              style={{
                width: '100%',
                marginTop: '12px',
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background:
                  voteMessage.type === 'success'
                    ? 'rgba(16, 185, 129, 0.1)'
                    : voteMessage.type === 'info'
                    ? 'rgba(0, 113, 227, 0.1)'
                    : 'rgba(186, 26, 26, 0.1)',
                color:
                  voteMessage.type === 'success'
                    ? 'var(--status-done-fg)'
                    : voteMessage.type === 'info'
                    ? 'var(--primary)'
                    : 'var(--error)'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                {voteMessage.type === 'success' ? 'check_circle' : voteMessage.type === 'info' ? 'info' : 'error'}
              </span>
              <span>{voteMessage.text}</span>
            </div>
          )}
        </div>
      )}

      {/* Project Description & Architecture Documentation */}
      <div className="card" style={{ padding: '36px', marginBottom: '28px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--on-surface)', marginBottom: '16px' }}>
          Technical Narrative & Architecture
        </h2>
        <div style={{ whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: 1.7, color: 'var(--on-surface-variant)' }}>
          {project.description}
        </div>
      </div>

      {/* Community Comments Section */}
      <div className="card" style={{ padding: '36px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '24px' }}>
              chat_bubble
            </span>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--on-surface)', margin: 0 }}>
              Community Feedback & Discussion
            </h2>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                background: 'var(--surface-container-high)',
                color: 'var(--on-surface-variant)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-pill)'
              }}
            >
              {comments.length}
            </span>
          </div>
        </div>

        {/* Comment Submission Form */}
        {votingRound && votingRound.status === 'voting_open' ? (
          <form onSubmit={handlePostComment} style={{ marginBottom: '28px' }}>
            <div style={{ marginBottom: '12px' }}>
              <input
                type="text"
                className="input-text"
                placeholder="Your Display Name (optional, defaults to Community Member)"
                value={authorDisplayName}
                onChange={(e) => setAuthorDisplayName(e.target.value)}
                maxLength={100}
                style={{ maxWidth: '360px', marginBottom: '10px' }}
              />
              <textarea
                className="input-text"
                placeholder="Share respectful feedback, architecture questions, or praise for this project..."
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                maxLength={1000}
                rows={3}
                style={{ width: '100%', resize: 'vertical' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--outline)' }}>
                  {commentBody.length} / 1000 characters
                </span>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={commentSubmitting || !commentBody.trim()}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>send</span>
                  <span>{commentSubmitting ? 'Posting...' : 'Post Comment'}</span>
                </button>
              </div>
            </div>

            {commentError && (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  background: 'rgba(186, 26, 26, 0.1)',
                  color: 'var(--error)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>error</span>
                <span>{commentError}</span>
              </div>
            )}
          </form>
        ) : (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface-container-low)',
              fontSize: '12px',
              color: 'var(--outline)',
              marginBottom: '24px'
            }}
          >
            Community feedback is closed for this voting round.
          </div>
        )}

        {/* Comments List */}
        {commentsLoading ? (
          <LoadingState message="Loading community comments..." />
        ) : comments.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '32px 16px',
              background: 'var(--surface-container-low)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--on-surface-variant)'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '36px', color: 'var(--outline)', opacity: 0.6 }}>
              forum
            </span>
            <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '8px' }}>No community comments yet</div>
            <div style={{ fontSize: '12px', color: 'var(--outline)', marginTop: '2px' }}>
              Be the first to share constructive feedback with the team!
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {comments.map((c) => {
              const canDelete =
                (user && c.authorUserId === user.id) ||
                user?.role === 'organizer' ||
                user?.role === 'admin';

              return (
                <div
                  key={c.id}
                  style={{
                    padding: '16px 20px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--surface-container-low)',
                    border: '1px solid var(--outline-border)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: 'var(--radius-pill)',
                          background: 'var(--primary-container)',
                          color: 'var(--on-primary-container)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: 700
                        }}
                      >
                        {c.authorDisplayName.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--on-surface)' }}>
                        {c.authorDisplayName}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--outline)' }}>
                        {new Date(c.createdAt).toLocaleDateString()}
                      </span>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(c.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--outline)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '2px'
                          }}
                          title="Delete comment"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <p style={{ fontSize: '13px', color: 'var(--on-surface)', lineHeight: 1.5, whiteSpace: 'pre-wrap', margin: 0 }}>
                    {c.body}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
